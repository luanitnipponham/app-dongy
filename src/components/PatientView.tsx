'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  LogOut,
  Calendar,
  Clock,
  MapPin,
  Phone,
  MessageCircle,
  Star,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Navigation,
  FileText,
  UserCheck,
  ChevronRight,
  HeartPulse,
  Activity,
  Send,
  Sparkles,
  User,
  ChevronsUpDown,
} from 'lucide-react';
import { Profile, PractitionerProfile, Booking, ServiceItem } from '@/types/database';
import { INITIAL_SERVICES } from '@/lib/mock-data';
import {
  formatVND,
  formatDateTime,
  describeTimeUntil,
  formatAppointmentLabel,
  nextWorkingSlot,
  isWithinWorkingHours,
  WORKING_HOURS_LABEL,
  WORKING_HOUR_START,
  WORKING_HOUR_END,
  toVietnamDateParts,
  vietnamDateTimeToDate,
  getCurrentDeviceLocation,
} from '@/lib/utils-medical';
import CollapsibleRow from './CollapsibleRow';
import { serverNow, serverDate, onClockSync } from '@/lib/server-clock';

interface PatientViewProps {
  currentUser: Profile;
  practitioners: Record<string, PractitionerProfile>;
  profiles: Profile[];
  bookings: Booking[];
  services?: ServiceItem[];
  onCreateBooking: (
    newBooking: Partial<Booking>
  ) => Promise<{ success: boolean; message?: string; booking?: Booking }> | void;
  onCancelBooking: (
    bookingId: string,
    reason?: string
  ) => Promise<{ success: boolean; message?: string } | boolean | void> | void;
  onSubmitReview: (bookingId: string, rating: number, review: string) => void;
  onLogout?: () => void;
}

// Bảng giá dự phòng tĩnh (nếu chưa truyền services từ Cloud/Admin)
const FALLBACK_SERVICE_PRICES: Record<string, number> = {
  'Châm cứu & Bấm huyệt đả thông kinh lạc': 400000,
  'Điều trị đau vai gáy, thoát vị đĩa đệm tại nhà': 450000,
  'Vật lý trị liệu & Phục hồi chức năng sau tai biến': 500000,
  'Khám Nội tổng quát & Kê đơn thuốc thang YHCT': 500000,
  'Xoa bóp dưỡng sinh & Chườm ngải cứu': 350000,
};

// ===========================================================================
// KIỂM TRA THẦY THUỐC CÓ BẬN TRÙNG GIỜ KHÔNG
// Mục đích: Bệnh nhân chọn đích danh một Thầy thuốc đang kẹt ca khác thì được
// báo ngay tại form để đổi ngày/giờ, thay vì tạo đơn PENDING nằm im không ai
// nhận rồi bệnh nhân tưởng hỏng và đặt lại nhiều lần.
// ===========================================================================

// Thời gian di chuyển tối thiểu giữa 2 ca khám tại nhà (phút)
const TRAVEL_BUFFER_MINUTES = 30;

// Các trạng thái chiếm chỗ lịch của Thầy thuốc
const OCCUPYING_STATUSES = ['PENDING', 'CONFIRMED', 'ON_THE_WAY', 'IN_PROGRESS'];

/**
 * Tìm ca khám của Thầy thuốc bị chồng lấn với khung giờ Bệnh nhân muốn đặt.
 * Hai ca coi là chồng nhau khi cách nhau ít hơn (thời lượng khám + thời gian di chuyển).
 */
function findScheduleConflict(
  doctorId: string,
  slotTime: Date,
  durationMinutes: number,
  allBookings: Booking[]
): Booking | null {
  const windowMs = (durationMinutes + TRAVEL_BUFFER_MINUTES) * 60 * 1000;
  return (
    allBookings.find((b) => {
      if (b.practitioner_id !== doctorId) return false;
      if (!OCCUPYING_STATUSES.includes(b.status)) return false;
      const existing = new Date(b.appointment_time).getTime();
      if (Number.isNaN(existing)) return false;
      return Math.abs(existing - slotTime.getTime()) < windowMs;
    }) || null
  );
}

/** Thầy thuốc đang trực tiếp khám cho bệnh nhân khác ngay lúc này */
function isDoctorOnDuty(doctorId: string, allBookings: Booking[]): boolean {
  return allBookings.some(
    (b) =>
      b.practitioner_id === doctorId &&
      ['ON_THE_WAY', 'IN_PROGRESS'].includes(b.status)
  );
}

/** Gợi ý các khung giờ trống gần nhất sau khung giờ bị trùng */
function suggestFreeSlots(
  doctorId: string,
  fromTime: Date,
  durationMinutes: number,
  allBookings: Booking[],
  maxSuggestions = 3
): Date[] {
  const stepMs = (durationMinutes + TRAVEL_BUFFER_MINUTES) * 60 * 1000;
  const result: Date[] = [];
  const cursor = new Date(fromTime.getTime());

  // Dò tối đa 48 bước (khoảng 3 ngày) để tìm khung trống
  for (let i = 0; i < 48 && result.length < maxSuggestions; i++) {
    cursor.setTime(cursor.getTime() + stepMs);

    // Chỉ gợi ý trong giờ làm việc của Thầy thuốc (8h00 - 20h00 giờ Việt Nam)
    if (!isWithinWorkingHours(cursor)) continue;
    if (cursor.getTime() <= serverNow()) continue;
    if (!findScheduleConflict(doctorId, cursor, durationMinutes, allBookings)) {
      result.push(new Date(cursor.getTime()));
    }
  }
  return result;
}


export default function PatientView({
  currentUser,
  practitioners,
  profiles,
  bookings,
  services = INITIAL_SERVICES,
  onCreateBooking,
  onCancelBooking,
  onSubmitReview,
  onLogout,
}: PatientViewProps) {
  const [activeTab, setActiveTab] = useState<'BOOKING' | 'RECORDS'>('BOOKING');

  // Vẽ lại khi đồng hồ server đồng bộ xong và mỗi 30 giây, để con số đếm ngược
  // tới giờ hẹn luôn đúng mà không cần tải lại trang.
  const [, forceTick] = useState(0);
  useEffect(() => {
    const unsubscribe = onClockSync(() => forceTick((n) => n + 1));
    const timer = setInterval(() => forceTick((n) => n + 1), 30000);
    return () => {
      unsubscribe();
      clearInterval(timer);
    };
  }, []);

  // ======== BOOKING FORM STATE ========
  // Bước 1: Chọn Thầy thuốc
  const [doctorSelectionMode, setDoctorSelectionMode] = useState<'AUTO' | 'MANUAL'>('AUTO');
  const [selectedPractitionerId, setSelectedPractitionerId] = useState<string | null>(null);
  // Popup chọn Thầy thuốc: danh sách dài vẫn xem được trọn vẹn, có ô tìm kiếm
  const [showDoctorModal, setShowDoctorModal] = useState(false);
  const [doctorSearch, setDoctorSearch] = useState('');

  // Bước 2: Chọn dịch vụ, nhập địa chỉ, triệu chứng
  // Danh sách dịch vụ đang mở phục vụ (active) từ Admin
  const activeServices: ServiceItem[] = (services && services.length > 0 ? services : INITIAL_SERVICES).filter(
    (s: ServiceItem) => s.is_active !== false
  );

  const [serviceName, setServiceName] = useState<string>(() => {
    return activeServices[0]?.name || 'Châm cứu & Bấm huyệt đả thông kinh lạc';
  });

  // Tự động chọn dịch vụ đầu tiên hợp lệ nếu dịch vụ hiện tại bị Admin xóa
  useEffect(() => {
    if (activeServices.length > 0 && !activeServices.some((s: ServiceItem) => s.name === serviceName)) {
      setServiceName(activeServices[0].name);
    }
  }, [activeServices, serviceName]);

  const selectedServiceObj = activeServices.find((s: ServiceItem) => s.name === serviceName);
  const getServiceFee = (name: string): number => {
    const found = activeServices.find((s: ServiceItem) => s.name === name);
    if (found) return found.price;
    return FALLBACK_SERVICE_PRICES[name] || 400000;
  };
  const [address, setAddress] = useState(currentUser.default_address || '');
  const [symptomNotes, setSymptomNotes] = useState('');
  const [isLocating, setIsLocating] = useState(false);
  // Toạ độ GPS thật của Bệnh nhân. Trước đây kết quả định vị bị bỏ đi và mọi đơn
  // đều ghi cứng toạ độ trung tâm TP.HCM, khiến khoảng cách Check-in của Thầy thuốc
  // trở thành số vô nghĩa (vi phạm nguyên tắc Ghi nhận GPS mềm).
  const [gpsCoords, setGpsCoords] = useState<{ lat: number; lng: number } | null>(null);

  // Ngày giờ hẹn khám - mặc định 2 giờ sau GIỜ SERVER, hiển thị theo múi giờ VN.
  // Bản cũ trộn toISOString() (giờ UTC) với getHours() (giờ máy) nên lúc nửa đêm
  // ngày và giờ bị lệch nhau một ngày.
  // Mặc định 2 giờ sau giờ server, nhưng phải rơi vào giờ làm việc 8h-20h.
  // Ngoài giờ thì tự đẩy tới 8h00 của ca làm việc gần nhất.
  const [appointmentDate, setAppointmentDate] = useState(
    () => toVietnamDateParts(nextWorkingSlot(new Date(serverNow() + 2 * 3600 * 1000))).date
  );
  const [appointmentTime, setAppointmentTime] = useState(
    () => toVietnamDateParts(nextWorkingSlot(new Date(serverNow() + 2 * 3600 * 1000))).time
  );


  // Form submission
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [formMsg, setFormMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Review modal state
  // So benh an: thu gon tung ca, bam vao moi xem chi tiet benh an 3 muc
  // Ca kham dang dien ra: thu gon, mac dinh mo ca moi nhat
  const [expandedActiveId, setExpandedActiveId] = useState<string | null>(null);
  const [expandedRecordId, setExpandedRecordId] = useState<string | null>(null);
  const [reviewBookingId, setReviewBookingId] = useState<string | null>(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');

  // Xử lý hủy lịch khám triệt để (Không phạt cọc - Ngăn tải lại xuất hiện lệnh cũ)
  const handleCancelBookingClick = async (bookingId: string, bookingCode: string) => {
    if (cancellingId) return;
    const reasonInput = prompt(
      `XÁC NHẬN HỦY LỊCH KHÁM [${bookingCode}]:\n\nBạn có chắc chắn muốn hủy ca khám này không? (Không phạt cọc)\n\nVui lòng nhập lý do hủy lịch:`,
      'Bệnh nhân có việc bận đột xuất'
    );
    if (reasonInput === null) {
      return;
    }

    setCancellingId(bookingId);
    setFormMsg(null);

    try {
      const res = await onCancelBooking(
        bookingId,
        reasonInput.trim() || 'Bệnh nhân có việc bận đột xuất'
      );
      if (res && typeof res === 'object' && 'success' in res && !res.success) {
        setFormMsg({
          type: 'error',
          text: res.message || 'Không thể hủy lịch khám lúc này. Vui lòng thử lại!',
        });
      } else {
        setFormMsg({
          type: 'success',
          text: `Đã hủy triệt để ca khám mã [${bookingCode}] thành công! Lệnh khám đã được gỡ bỏ hoàn toàn.`,
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Lỗi khi hủy lịch khám.';
      setFormMsg({ type: 'error', text: msg });
    } finally {
      setCancellingId(null);
    }
  };

  // 1-1 Isolation: STRICT FILTERING FOR THIS PATIENT ONLY
  const myBookings = bookings.filter((b) => b.patient_id === currentUser.id);

  // Active bookings (ongoing)
  const activeBookings = myBookings.filter((b) =>
    ['PENDING', 'CONFIRMED', 'ON_THE_WAY', 'IN_PROGRESS'].includes(b.status)
  );

  // Sổ bệnh án điện tử: CHỈ hiển thị ca khám ĐÃ HOÀN TẤT (COMPLETED) có bệnh án y khoa
  // Tuyệt đối KHÔNG hiển thị log các ca hủy đặt hẹn
  const completedBookings = myBookings.filter((b) => b.status === 'COMPLETED');

  // Danh sách Thầy thuốc đã được Admin duyệt CCHN (eKYC Gatekeeper).
  // Trước đây lọc thêm `is_online` nên danh sách thường trống hoặc thiếu bác sỹ
  // mới được duyệt (vì trạng thái Online chưa kịp bật / trước đây không lưu được
  // xuống Supabase). Nay hiển thị toàn bộ bác sỹ đã duyệt, xếp người đang Online
  // lên trước và gắn nhãn trạng thái rõ ràng để Bệnh nhân tự quyết định.
  const verifiedDoctors = Object.values(practitioners)
    .filter((p) => p.is_verified)
    .sort((a, b) => {
      if (a.is_online !== b.is_online) return a.is_online ? -1 : 1;
      return Number(b.rating_avg || 0) - Number(a.rating_avg || 0);
    });

  // Lọc theo từ khoá tìm kiếm trong popup chọn Thầy thuốc
  const doctorSearchResults = verifiedDoctors.filter((doc) => {
    const kw = doctorSearch.trim().toLowerCase();
    if (!kw) return true;
    const docProfile = profiles.find((p) => p.id === doc.user_id);
    return (
      (docProfile?.full_name || '').toLowerCase().includes(kw) ||
      (doc.specialties || []).join(' ').toLowerCase().includes(kw) ||
      (doc.license_number || '').toLowerCase().includes(kw)
    );
  });

  const selectedDoctor = selectedPractitionerId
    ? practitioners[selectedPractitionerId]
    : null;
  const selectedDoctorProfile = selectedPractitionerId
    ? profiles.find((p) => p.id === selectedPractitionerId)
    : null;

  // ===== KIỂM TRA TRÙNG LỊCH CỦA THẦY THUỐC ĐƯỢC CHỌN ĐÍCH DANH =====
  // Chỉ áp dụng cho chế độ MANUAL. Chế độ AUTO phát đơn cho mọi Thầy thuốc hợp lệ
  // nên không thể trùng lịch của riêng ai.
  const serviceDuration = selectedServiceObj?.duration_minutes || 60;
  const requestedSlot = vietnamDateTimeToDate(appointmentDate, appointmentTime);
  const isRequestedSlotValid = !Number.isNaN(requestedSlot.getTime());

  const scheduleConflict =
    doctorSelectionMode === 'MANUAL' && selectedPractitionerId && isRequestedSlotValid
      ? findScheduleConflict(selectedPractitionerId, requestedSlot, serviceDuration, bookings)
      : null;

  const freeSlotSuggestions = scheduleConflict
    ? suggestFreeSlots(selectedPractitionerId!, requestedSlot, serviceDuration, bookings)
    : [];

  // Đặt nhanh theo khung giờ được gợi ý
  const applySuggestedSlot = (d: Date) => {
    const pad = (n: number) => String(n).padStart(2, '0');
    setAppointmentDate(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`);
    setAppointmentTime(`${pad(d.getHours())}:${pad(d.getMinutes())}`);
    setFormMsg(null);
  };

  const handleGetGPS = async () => {
    setIsLocating(true);
    setFormMsg(null);
    try {
      const loc = await getCurrentDeviceLocation();
      // Lưu toạ độ thật để gửi kèm đơn khám, đồng thời vẫn giữ địa chỉ chữ do
      // Bệnh nhân nhập (Google Maps Deep Link ưu tiên địa chỉ chữ cho chính xác).
      setGpsCoords({ lat: loc.lat, lng: loc.lng });
      setAddress((prev) => (prev ? prev : `Tọa độ GPS: ${loc.lat.toFixed(5)}, ${loc.lng.toFixed(5)}`));
      setFormMsg({
        type: 'success',
        text: `Đã ghi nhận tọa độ GPS thực tế (${loc.lat.toFixed(5)}, ${loc.lng.toFixed(5)}). Tọa độ này sẽ được gửi kèm đơn khám để Thầy thuốc Check-in chính xác.`,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Lỗi lấy GPS';
      setFormMsg({ type: 'error', text: msg });
    } finally {
      setIsLocating(false);
    }
  };

  // Ref-based lock: survives React re-renders, true mutex
  const submittingLockRef = useRef(false);

  const handleSubmitBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Double-check: both state and ref lock
    if (isSubmitting || submittingLockRef.current) return;

    setFormMsg(null);

    if (!address.trim()) {
      setFormMsg({ type: 'error', text: 'Vui lòng nhập địa chỉ nhận khám tại nhà.' });
      return;
    }

    // Validate ngày giờ hẹn khám theo GIỜ SERVER (chỉnh lùi đồng hồ máy cũng không đặt được quá khứ)
    const selectedDateTime = vietnamDateTimeToDate(appointmentDate, appointmentTime);
    const now = serverDate();
    if (selectedDateTime <= now) {
      setFormMsg({ type: 'error', text: 'Ngày giờ hẹn khám phải sau thời điểm hiện tại. Vui lòng chọn lại.' });
      return;
    }

    // Ràng buộc giờ làm việc của Thầy thuốc. Đặt ngoài khung này thì không ai
    // nhận ca, đơn sẽ nằm PENDING vô ích.
    if (!isWithinWorkingHours(selectedDateTime)) {
      setFormMsg({
        type: 'error',
        text: `Thầy thuốc chỉ nhận khám trong khung giờ ${WORKING_HOURS_LABEL} hằng ngày. Vui lòng chọn lại giờ khám.`,
      });
      return;
    }

    // Validate chọn thầy thuốc đích danh
    if (doctorSelectionMode === 'MANUAL' && !selectedPractitionerId) {
      setFormMsg({ type: 'error', text: 'Vui lòng chọn một Thầy thuốc hoặc chuyển sang chế độ Tự động tìm.' });
      return;
    }

    // CHẶN ĐẶT TRÙNG GIỜ: không cho tạo đơn mà Thầy thuốc chắc chắn không nhận được,
    // tránh đơn PENDING nằm im không ai trả lời.
    if (scheduleConflict) {
      setFormMsg({
        type: 'error',
        text: `${selectedDoctorProfile?.full_name || 'Thầy thuốc'} đã có ca khám lúc ${formatDateTime(
          scheduleConflict.appointment_time
        )}. Vui lòng chọn khung giờ khác hoặc chuyển sang chế độ "Tự động tìm".`,
      });
      return;
    }

    // Acquire both locks immediately
    setIsSubmitting(true);
    submittingLockRef.current = true;

    try {
      // Giá dịch vụ luôn lấy từ bảng giá SERVICE_PRICES theo dịch vụ đã chọn
      const serviceFee = selectedServiceObj?.price || getServiceFee(serviceName);
      const commissionRate = 15.0;
      const commissionAmount = Math.round((serviceFee * commissionRate) / 100);
      const bookingCode = `KB-${Date.now().toString().slice(-6)}`;

      const practitionerIdToSend = doctorSelectionMode === 'MANUAL' ? selectedPractitionerId : null;

      const res = await onCreateBooking({
        booking_code: bookingCode,
        patient_id: currentUser.id,
        practitioner_id: practitionerIdToSend,
        service_name: serviceName,
        address: address.trim(),
        patient_phone: currentUser.phone,
        // Dùng toạ độ GPS thật nếu Bệnh nhân đã bấm định vị; nếu không thì mới
        // rơi về toạ độ trung tâm TP.HCM làm mặc định.
        lat: gpsCoords?.lat ?? 10.7769,
        lng: gpsCoords?.lng ?? 106.6951,
        symptom_notes: symptomNotes.trim(),
        appointment_time: selectedDateTime.toISOString(),
        service_fee: serviceFee,
        travel_surcharge: 0,
        commission_rate: commissionRate,
        commission_amount: commissionAmount,
        status: 'PENDING',
      });

      if (res && !res.success) {
        setFormMsg({ type: 'error', text: res.message || 'Không thể tạo đơn khám!' });
        // Release locks immediately on error so user can retry
        setIsSubmitting(false);
        submittingLockRef.current = false;
      } else {
        setFormMsg({
          type: 'success',
          text: (res && res.message) || `Đặt lịch thành công mã [${bookingCode}]! Vui lòng chờ Thầy thuốc xác nhận nhận ca.`,
        });
        setSymptomNotes('');
        window.scrollTo({ top: 0, behavior: 'smooth' });

        // Keep button locked for 5 seconds after success to prevent rapid re-submit
        setTimeout(() => {
          setIsSubmitting(false);
          submittingLockRef.current = false;
        }, 5000);
      }
    } catch {
      setIsSubmitting(false);
      submittingLockRef.current = false;
    }
  };

  const getStatusBadge = (status: Booking['status']) => {
    switch (status) {
      case 'PENDING':
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 animate-pulse">Chờ Thầy thuốc nhận ca</span>;
      case 'CONFIRMED':
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800">Đã nhận ca (Đã khóa tiền)</span>;
      case 'ON_THE_WAY':
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-100 text-indigo-800">Thầy thuốc đang tới</span>;
      case 'IN_PROGRESS':
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-purple-100 text-purple-800">Đang khám tại nhà</span>;
      case 'COMPLETED':
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">Khám hoàn tất</span>;
      case 'CANCELLED_PATIENT':
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800">Bệnh nhân đã hủy</span>;
      case 'CANCELLED_DOCTOR':
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-slate-200 text-slate-800">Thầy thuốc báo bận</span>;
      default:
        return null;
    }
  };

  const getDoctorProfile = (doctorId: string | null) => {
    if (!doctorId) return null;
    const prof = profiles.find((p) => p.id === doctorId);
    const detail = practitioners[doctorId];
    return { prof, detail };
  };

  // Số tiền Bệnh nhân phải trả. KHÔNG tính/hiển thị phí nền tảng ở phân hệ này -
  // đó là khoản trừ từ Ví Tín Dụng của Thầy thuốc, không liên quan tới Bệnh nhân.
  const currentServiceFee = selectedServiceObj?.price || getServiceFee(serviceName);
  const totalPatientPay = currentServiceFee;

  return (
    <div className="w-full max-w-2xl mx-auto px-4 pb-20">
      {/* Top Banner - Compact Mobile-First */}
      <div className="bg-gradient-to-r from-emerald-700 via-teal-700 to-emerald-800 rounded-2xl p-3 sm:p-4 text-white shadow-md shadow-emerald-900/10 mb-3 relative overflow-hidden">
        <div className="relative z-10 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20 shrink-0">
              <HeartPulse className="w-5 h-5 text-emerald-200" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] uppercase tracking-wider font-bold bg-white/20 px-1.5 py-0.5 rounded-md inline-block">
                  Bệnh Nhân
                </span>
                <span className="text-[11px] text-emerald-200 truncate font-mono">
                  {currentUser.phone}
                </span>
              </div>
              <h2 className="text-base sm:text-xl font-extrabold truncate leading-tight mt-0.5">
                {currentUser.full_name}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="hidden sm:inline-flex items-center gap-1 text-[11px] text-emerald-200 bg-emerald-900/40 px-2 py-1 rounded-lg border border-emerald-500/20">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-300" />
              <span>Bảo mật 1-1</span>
            </span>
            {onLogout && (
              <button
                type="button"
                onClick={onLogout}
                className="px-2.5 py-1.5 rounded-xl bg-white/15 hover:bg-rose-500/80 active:bg-rose-600 text-white text-xs font-bold transition-all flex items-center gap-1 border border-white/20 shadow-xs shrink-0 active:scale-95"
                title="Đăng xuất khỏi tài khoản"
              >
                <LogOut className="w-3.5 h-3.5 text-rose-300" />
                <span className="text-xs">Đăng xuất</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex bg-slate-100 p-1.5 rounded-2xl mb-6">
        <button
          type="button"
          onClick={() => setActiveTab('BOOKING')}
          className={`flex-1 py-2.5 text-xs sm:text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-2 ${
            activeTab === 'BOOKING'
              ? 'bg-white text-emerald-800 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Calendar className="w-4 h-4" /> Đặt Lịch & Kết Nối Thầy Thuốc
          {activeBookings.length > 0 && (
            <span className="w-5 h-5 rounded-full bg-emerald-600 text-white text-[11px] flex items-center justify-center font-bold">
              {activeBookings.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('RECORDS')}
          className={`flex-1 py-2.5 text-xs sm:text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-2 ${
            activeTab === 'RECORDS'
              ? 'bg-white text-emerald-800 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <FileText className="w-4 h-4" /> Sổ Bệnh Án & Đánh Giá
        </button>
      </div>

      {/* TAB 1: BOOKING & ACTIVE STATUS */}
      {activeTab === 'BOOKING' && (
        <div className="space-y-6">
          {/* Active Bookings List */}
          {activeBookings.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <Activity className="w-4 h-4 text-emerald-600 animate-spin" />
                Ca Khám Đang Diễn Ra ({activeBookings.length})
              </h3>

              {activeBookings.map((b) => {
                const doctor = getDoctorProfile(b.practitioner_id);
                const until = describeTimeUntil(b.appointment_time);
                return (
                  <CollapsibleRow
                    key={b.id}
                    accent="emerald"
                    isOpen={expandedActiveId === b.id}
                    onToggle={() => setExpandedActiveId(expandedActiveId === b.id ? null : b.id)}
                    code={b.booking_code}
                    badge={getStatusBadge(b.status)}
                    title={b.service_name}
                    subtitle={
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-400 shrink-0" />
                        {formatAppointmentLabel(b.appointment_time)}
                        <span className="text-slate-300">•</span>
                        <span
                          className={
                            until.tone === 'late'
                              ? 'text-rose-600 font-bold'
                              : until.tone === 'soon'
                              ? 'text-amber-600 font-bold'
                              : 'text-slate-500'
                          }
                        >
                          {until.text}
                        </span>
                      </span>
                    }
                    right={
                      <>
                        <div className="text-xs font-extrabold text-emerald-700">
                          {formatVND(b.service_fee + b.travel_surcharge)}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          {doctor?.prof ? 'Đã có thầy thuốc' : 'Đang tìm'}
                        </div>
                      </>
                    }
                  >

                    <div className="p-3 bg-slate-50 rounded-2xl text-xs space-y-1.5 border border-slate-100">
                      <div className="flex items-start gap-2 text-slate-700">
                        <MapPin className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                        <span>{b.address}</span>
                      </div>
                      {b.symptom_notes && (
                        <div className="flex items-start gap-2 text-slate-600 italic">
                          <HeartPulse className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                          <span>Triệu chứng: {b.symptom_notes}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-2 text-slate-500 font-mono text-[11px]">
                        <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>Hẹn khám: {formatAppointmentLabel(b.appointment_time)}</span>
                      </div>
                    </div>

                    {/* Practitioner Assigned Card */}
                    {doctor && doctor.prof ? (
                      <div className="p-3 rounded-2xl bg-emerald-50/70 border border-emerald-200 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-emerald-700 text-white font-bold flex items-center justify-center text-sm shadow">
                            {doctor.prof.full_name.slice(0, 2)}
                          </div>
                          <div>
                            <div className="text-xs font-bold text-slate-900 flex items-center gap-1">
                              {doctor.prof.full_name}
                              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                            </div>
                            <div className="text-[11px] text-emerald-800 font-mono">
                              CCHN: {doctor.detail?.license_number || 'Đã xác thực'}
                            </div>
                          </div>
                        </div>

                        {/* Communication Buttons: Call & Zalo */}
                        <div className="flex items-center gap-1.5">
                          <a
                            href={`tel:${doctor.prof.phone}`}
                            className="p-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm flex items-center gap-1 text-xs font-bold"
                            title="Gọi điện cho Thầy thuốc"
                          >
                            <Phone className="w-3.5 h-3.5" /> Gọi
                          </a>
                          <a
                            href={`https://zalo.me/${doctor.prof.phone}`}
                            target="_blank"
                            rel="noreferrer"
                            className="p-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-sm flex items-center gap-1 text-xs font-bold"
                            title="Nhắn Zalo"
                          >
                            <MessageCircle className="w-3.5 h-3.5" /> Zalo
                          </a>
                        </div>
                      </div>
                    ) : (
                      <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center gap-2">
                        <Clock className="w-4 h-4 text-amber-600 shrink-0 animate-spin" />
                        <span>Hệ thống đang phát đơn tới các Thầy thuốc online gần bạn nhất...</span>
                      </div>
                    )}

                    {/* Cancel Action (Hoàn 100% tiền tạm giữ cho Thầy thuốc - Không phạt cọc - Hủy triệt để) */}
                    <div className="pt-2 flex justify-end">
                      <button
                        type="button"
                        disabled={cancellingId === b.id}
                        onClick={() => handleCancelBookingClick(b.id, b.booking_code)}
                        className={`text-xs font-semibold flex items-center gap-1.5 px-3.5 py-2 rounded-xl transition-all ${
                          cancellingId === b.id
                            ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                            : 'text-rose-600 hover:text-rose-800 hover:bg-rose-50 border border-rose-200'
                        }`}
                      >
                        {cancellingId === b.id ? (
                          <>
                            <Clock className="w-3.5 h-3.5 animate-spin" /> Đang hủy lịch khám...
                          </>
                        ) : (
                          <>
                            <XCircle className="w-3.5 h-3.5" /> Hủy lịch khám (Không phạt cọc)
                          </>
                        )}
                      </button>
                    </div>
                  </CollapsibleRow>
                );
              })}
            </div>
          )}

          {/* ====== FORM ĐẶT LỊCH KHÁM HOÀN CHỈNH ====== */}
          <div className="p-5 sm:p-6 rounded-3xl bg-white border border-slate-200 shadow-xl shadow-slate-200/50">
            <h3 className="text-base font-extrabold text-slate-800 flex items-center gap-2 mb-4">
              <Calendar className="w-5 h-5 text-emerald-600" />
              Đặt Lịch Khám Chữa Bệnh Tại Nhà
            </h3>

            {formMsg && (
              <div
                className={`mb-4 p-3.5 rounded-2xl text-xs sm:text-sm flex items-start gap-2.5 ${
                  formMsg.type === 'success'
                    ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                    : 'bg-rose-50 border border-rose-200 text-rose-700'
                }`}
              >
                {formMsg.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                )}
                <span>{formMsg.text}</span>
              </div>
            )}

            <form onSubmit={handleSubmitBooking} className="space-y-4">

              {/* ===== BƯỚC 1: CHỌN THẦY THUỐC ===== */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  <span className="inline-flex items-center gap-1.5">
                    <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                    Bước 1: Chọn Thầy Thuốc
                  </span>
                </label>

                {/* Toggle: Tự động / Chọn đích danh */}
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <button
                    type="button"
                    onClick={() => {
                      setDoctorSelectionMode('AUTO');
                      setSelectedPractitionerId(null);
                    }}
                    className={`p-3 rounded-2xl border-2 text-left transition-all ${
                      doctorSelectionMode === 'AUTO'
                        ? 'border-emerald-600 bg-emerald-50/50 shadow-sm'
                        : 'border-slate-200 bg-slate-50 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                          doctorSelectionMode === 'AUTO' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                        }`}>
                          <Sparkles className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-slate-900">Tự động tìm</div>
                          <div className="text-[10px] text-slate-500">Thầy thuốc gần nhất</div>
                        </div>
                      </div>
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                        doctorSelectionMode === 'AUTO' ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-300'
                      }`}>
                        {doctorSelectionMode === 'AUTO' && <CheckCircle2 className="w-3.5 h-3.5" />}
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDoctorSelectionMode('MANUAL')}
                    className={`p-3 rounded-2xl border-2 text-left transition-all ${
                      doctorSelectionMode === 'MANUAL'
                        ? 'border-emerald-600 bg-emerald-50/50 shadow-sm'
                        : 'border-slate-200 bg-slate-50 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                          doctorSelectionMode === 'MANUAL' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                        }`}>
                          <User className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-slate-900">Chọn đích danh</div>
                          <div className="text-[10px] text-slate-500">Thầy thuốc uy tín</div>
                        </div>
                      </div>
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                        doctorSelectionMode === 'MANUAL' ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-300'
                      }`}>
                        {doctorSelectionMode === 'MANUAL' && <CheckCircle2 className="w-3.5 h-3.5" />}
                      </div>
                    </div>
                  </button>
                </div>

                {/* Nút mở Popup chọn Thầy thuốc (danh sách dài vẫn xem được trọn vẹn) */}
                {doctorSelectionMode === 'MANUAL' && (
                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={() => {
                        setDoctorSearch('');
                        setShowDoctorModal(true);
                      }}
                      className="w-full p-3.5 rounded-2xl border-2 border-emerald-300 bg-emerald-50/40 hover:bg-emerald-50 text-left transition-all flex items-center justify-between gap-3"
                    >
                      {selectedDoctor && selectedDoctorProfile ? (
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-600 to-teal-600 text-white font-bold flex items-center justify-center text-xs shadow shrink-0">
                            {selectedDoctorProfile.full_name.slice(0, 2)}
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-slate-900 flex items-center gap-1 truncate">
                              {selectedDoctorProfile.full_name}
                              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            </div>
                            <div className="text-[10px] text-emerald-700 font-mono truncate">
                              CCHN: {selectedDoctor.license_number}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center shrink-0">
                            <User className="w-5 h-5" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-slate-900">Bấm để chọn Thầy thuốc</div>
                            <div className="text-[10px] text-slate-500">
                              {verifiedDoctors.length} Thầy thuốc đã được duyệt CCHN
                            </div>
                          </div>
                        </div>
                      )}
                      <span className="text-[11px] font-bold text-emerald-700 shrink-0 px-2 py-1 rounded-lg bg-white border border-emerald-200">
                        {selectedDoctor ? 'Đổi' : 'Xem danh sách'}
                      </span>
                    </button>

                    {!selectedPractitionerId && (
                      <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-2.5 py-1.5">
                        Bạn chưa chọn Thầy thuốc. Hãy bấm nút trên để chọn, hoặc chuyển về chế độ Tự động tìm.
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* ===== BƯỚC 2: CHỌN DỊCH VỤ ===== */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  <span className="inline-flex items-center gap-1.5">
                    <HeartPulse className="w-3.5 h-3.5 text-emerald-600" />
                    Bước 2: Chọn dịch vụ y học cổ truyền
                  </span>
                </label>
                <select
                  value={serviceName}
                  onChange={(e) => setServiceName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs sm:text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  {activeServices.map((s: ServiceItem) => (
                    <option key={s.id || s.name} value={s.name}>
                      {s.name} ({formatVND(s.price)})
                    </option>
                  ))}
                </select>
              </div>

              {/* ===== NGÀY & GIỜ HẸN KHÁM ===== */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  <span className="inline-flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-emerald-600" />
                    Bước 3: Chọn ngày & giờ hẹn khám *
                  </span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] text-slate-500 mb-0.5 font-semibold">Ngày khám</label>
                    <input
                      type="date"
                      value={appointmentDate}
                      onChange={(e) => setAppointmentDate(e.target.value)}
                      min={toVietnamDateParts(serverDate()).date}
                      required
                      className="w-full px-3 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-500 mb-0.5 font-semibold">
                      Giờ khám ({WORKING_HOURS_LABEL})
                    </label>
                    <input
                      type="time"
                      value={appointmentTime}
                      onChange={(e) => setAppointmentTime(e.target.value)}
                      required
                      // Giới hạn ngay tại ô nhập theo ca làm việc của Thầy thuốc
                      min={`${String(WORKING_HOUR_START).padStart(2, '0')}:00`}
                      max={`${String(WORKING_HOUR_END).padStart(2, '0')}:00`}
                      className="w-full px-3 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                    />
                  </div>
                </div>
                {/* Xác nhận lại bằng chữ thường ngày. Ô "Giờ khám" của trình duyệt
                    hiển thị dạng 12 giờ (vd "12:59 SA") rất dễ bị đọc nhầm thành
                    buổi trưa, nên in lại rõ ràng kèm mốc ngày tương đối. */}
                {isRequestedSlotValid && !isWithinWorkingHours(requestedSlot) ? (
                  // Báo ngay khi vừa chọn, không đợi tới lúc bấm Đặt lịch
                  <div className="mt-1.5 p-2.5 rounded-xl bg-rose-50 border-2 border-rose-300 text-[11px] text-rose-800 space-y-2">
                    <div className="flex items-start gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                      <span>
                        Thầy thuốc chỉ nhận khám trong khung{' '}
                        <strong>{WORKING_HOURS_LABEL}</strong> hằng ngày. Giờ bạn chọn nằm ngoài ca
                        làm việc nên sẽ không có Thầy thuốc nào nhận.
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => applySuggestedSlot(nextWorkingSlot(requestedSlot))}
                      className="w-full py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-[11px]"
                    >
                      Chuyển sang {formatAppointmentLabel(nextWorkingSlot(requestedSlot).toISOString())}
                    </button>
                  </div>
                ) : (
                  isRequestedSlotValid && (
                    <div className="mt-1.5 p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-700 flex items-start gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                      <span>
                        Bạn đang hẹn khám lúc{' '}
                        <strong className="text-slate-900">
                          {formatAppointmentLabel(requestedSlot.toISOString())}
                        </strong>
                        {requestedSlot.getTime() > serverNow() && (
                          <>
                            {' '}
                            <span className="text-emerald-700 font-semibold">
                              ({describeTimeUntil(requestedSlot.toISOString()).text} nữa)
                            </span>
                          </>
                        )}
                        .
                      </span>
                    </div>
                  )
                )}
                <p className="text-[10px] text-slate-400 mt-1 italic">
                  Vui lòng đặt trước ít nhất 1 giờ để Thầy thuốc chuẩn bị di chuyển.
                </p>

                {/* CẢNH BÁO THẦY THUỐC BẬN TRÙNG GIỜ + gợi ý khung giờ trống.
                    Chặn ngay tại form để không tạo ra đơn PENDING không ai nhận. */}
                {scheduleConflict && (
                  <div className="mt-2.5 p-3 rounded-2xl bg-amber-50 border-2 border-amber-300 space-y-2">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <div className="text-[11px] text-amber-900 leading-relaxed">
                        <strong>{selectedDoctorProfile?.full_name || 'Thầy thuốc'}</strong> đã có ca
                        khám lúc{' '}
                        <strong>{formatDateTime(scheduleConflict.appointment_time)}</strong>, không
                        thể nhận thêm ca vào khung giờ bạn chọn.
                      </div>
                    </div>

                    {freeSlotSuggestions.length > 0 && (
                      <div>
                        <div className="text-[10px] font-bold text-amber-800 uppercase tracking-wide mb-1.5">
                          Khung giờ còn trống gần nhất:
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {freeSlotSuggestions.map((d) => (
                            <button
                              key={d.toISOString()}
                              type="button"
                              onClick={() => applySuggestedSlot(d)}
                              className="px-2.5 py-1.5 rounded-xl bg-white border border-amber-300 hover:bg-amber-100 text-[11px] font-bold text-amber-900 transition-colors"
                            >
                              {formatDateTime(d.toISOString())}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        setDoctorSelectionMode('AUTO');
                        setSelectedPractitionerId(null);
                      }}
                      className="w-full py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold"
                    >
                      Hoặc để hệ thống tự tìm Thầy thuốc đang rảnh
                    </button>
                  </div>
                )}
              </div>

              {/* ===== ĐỊA CHỈ + GPS ===== */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    <span className="inline-flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                      Bước 4: Địa chỉ nhà bạn *
                    </span>
                  </label>
                  <button
                    type="button"
                    onClick={handleGetGPS}
                    disabled={isLocating}
                    className="text-[11px] font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 bg-emerald-50 px-2.5 py-1 rounded-xl border border-emerald-200"
                  >
                    <Navigation className="w-3 h-3" />
                    {isLocating ? 'Đang định vị...' : 'Lấy vị trí GPS'}
                  </button>
                </div>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Số nhà, Tên đường, Phường, Quận..."
                  required
                  className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* ===== TRIỆU CHỨNG ===== */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Mô tả triệu chứng / Bệnh lý hiện tại
                </label>
                <textarea
                  rows={2}
                  value={symptomNotes}
                  onChange={(e) => setSymptomNotes(e.target.value)}
                  placeholder="VD: Bị đau vùng thắt lưng lan xuống đùi, tê bì bàn chân, huyết áp bình thường..."
                  className="w-full px-3.5 py-2 rounded-2xl bg-slate-50 border border-slate-200 text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>


              {/* ===== SỐ TIỀN BỆNH NHÂN PHẢI TRẢ =====
                  CHỦ Ý CHỈ HIỂN THỊ ĐÚNG SỐ TIỀN KHÁCH TRẢ.
                  Phí nền tảng (chiết khấu sàn) là thỏa thuận riêng giữa Nền tảng và
                  Thầy thuốc, trừ thẳng từ Ví Tín Dụng của Thầy thuốc. Phơi con số đó
                  ra cho Bệnh nhân là để lộ thu nhập thực nhận của Thầy thuốc - rất
                  nhạy cảm và dễ gây mặc cả ngoài luồng. Bảng kê chiết khấu đầy đủ
                  vẫn giữ nguyên bên phân hệ Thầy thuốc và Admin. */}
              <div className="p-3.5 rounded-2xl bg-gradient-to-br from-slate-50 to-emerald-50/30 border border-emerald-200/60">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-extrabold text-slate-900 text-sm">
                    Tổng thu tiền mặt tại nhà:
                  </span>
                  <span className="font-extrabold text-emerald-700 text-lg">
                    {formatVND(totalPatientPay)}
                  </span>
                </div>
                <p className="text-[10px] text-slate-500 italic mt-1">
                  Thanh toán trực tiếp cho Thầy thuốc sau khi khám xong. Không phải trả thêm bất kỳ khoản nào.
                </p>
              </div>

              {/* ===== NÚT ĐẶT LỊCH ===== */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold text-sm shadow-lg shadow-emerald-600/25 transition-all flex items-center justify-center gap-2 active:scale-[0.99] cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <Clock className="w-4 h-4 animate-spin" />
                    Đang tạo đơn & kết nối Thầy thuốc...
                  </>
                ) : (
                  <>
                    Xác Nhận Đặt Lịch Khám Tại Nhà <Send className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* TAB 2: MEDICAL RECORDS & REVIEWS (BỆNH ÁN 3 MỤC - CHỈ CA ĐÃ HOÀN TẤT) */}
      {activeTab === 'RECORDS' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <FileText className="w-4 h-4 text-emerald-600" />
              Sổ Bệnh Án Điện Tử Của Bạn ({completedBookings.length})
            </h3>
            <span className="text-[11px] text-slate-500">Bảo mật chuẩn y khoa</span>
          </div>

          {completedBookings.length === 0 ? (
            <div className="p-8 text-center bg-white rounded-3xl border border-slate-200">
              <FileText className="w-12 h-12 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-bold text-slate-700">Chưa có hồ sơ bệnh án nào</p>
              <p className="text-xs text-slate-500 mt-1">
                Sau khi Thầy thuốc hoàn tất ca khám và ghi bệnh án 3 mục, hồ sơ y khoa chính thức sẽ được lưu giữ tại đây trọn đời.
              </p>
            </div>
          ) : (
            completedBookings.map((b) => {
              const doctor = getDoctorProfile(b.practitioner_id);

              return (
                <CollapsibleRow
                  key={b.id}
                  accent="teal"
                  isOpen={expandedRecordId === b.id}
                  onToggle={() =>
                    setExpandedRecordId(expandedRecordId === b.id ? null : b.id)
                  }
                  code={b.booking_code}
                  badge={getStatusBadge(b.status)}
                  title={b.service_name}
                  subtitle={
                    doctor?.prof
                      ? `${doctor.prof.full_name} • ${formatDateTime(b.appointment_time)}`
                      : formatDateTime(b.appointment_time)
                  }
                  right={
                    b.patient_rating ? (
                      <span className="flex items-center gap-0.5 text-amber-500">
                        <Star className="w-3 h-3 fill-amber-400" />
                        <span className="text-[11px] font-bold text-slate-700">
                          {b.patient_rating}
                        </span>
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold text-amber-700 whitespace-nowrap">
                        Chưa đánh giá
                      </span>
                    )
                  }
                >
                  {doctor && doctor.prof && (
                    <div className="text-xs text-slate-600 flex items-center gap-1.5 font-medium">
                      <span>Thầy thuốc điều trị:</span>
                      <strong className="text-slate-900">{doctor.prof.full_name}</strong>
                      <span className="text-emerald-700 font-mono">({doctor.detail?.license_number})</span>
                    </div>
                  )}

                  {/* 3-Part Medical Record Section */}
                  <div className="p-4 bg-teal-50/60 rounded-2xl border border-teal-200/80 space-y-3">
                    <div className="text-xs font-extrabold text-teal-900 flex items-center gap-1.5 uppercase">
                      <HeartPulse className="w-4 h-4 text-teal-700" />
                      Bệnh Án Điện Tử 3 Mục Chuẩn Y Khoa
                    </div>

                    <div className="space-y-2 text-xs">
                      <div className="bg-white p-2.5 rounded-xl border border-teal-100">
                        <span className="font-bold text-teal-950 block mb-0.5">
                          1. Chẩn đoán bệnh / Mạch tượng:
                        </span>
                        <p className="text-slate-700 whitespace-pre-wrap">
                          {b.medical_diagnosis || 'Chẩn đoán chưa cập nhật'}
                        </p>
                      </div>

                      <div className="bg-white p-2.5 rounded-xl border border-teal-100">
                        <span className="font-bold text-teal-950 block mb-0.5">
                          2. Thủ thuật đã thực hiện & Đơn thuốc:
                        </span>
                        <p className="text-slate-700 whitespace-pre-wrap">
                          {b.treatment_notes || 'Chưa ghi chú thủ thuật'}
                        </p>
                      </div>

                      <div className="bg-white p-2.5 rounded-xl border border-teal-100">
                        <span className="font-bold text-teal-950 block mb-0.5">
                          3. Lời dặn dò bác sĩ & Lịch hẹn tái khám:
                        </span>
                        <p className="text-slate-700 whitespace-pre-wrap">
                          {b.doctor_advice || 'Uống đủ nước, sinh hoạt điều độ.'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Rating Section */}
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                      {b.patient_rating ? (
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-slate-500">Đánh giá của bạn:</span>
                          <div className="flex text-amber-400">
                            {[1, 2, 3, 4, 5].map((s) => (
                              <Star
                                key={s}
                                className={`w-3.5 h-3.5 ${
                                  s <= (b.patient_rating || 0)
                                    ? 'fill-amber-400'
                                    : 'text-slate-200'
                                }`}
                              />
                            ))}
                          </div>
                          {b.patient_review && (
                            <span className="text-xs text-slate-600 italic ml-2">
                              &ldquo;{b.patient_review}&rdquo;
                            </span>
                          )}
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setReviewBookingId(b.id);
                            setReviewRating(5);
                            setReviewComment('');
                          }}
                          className="text-xs font-bold text-amber-700 hover:text-amber-800 bg-amber-50 hover:bg-amber-100 px-3 py-1.5 rounded-xl border border-amber-200 flex items-center gap-1 transition-all"
                        >
                          <Star className="w-3.5 h-3.5 fill-amber-400" />
                          Đánh giá Thầy thuốc 1-5 sao
                        </button>
                      )}
                    </div>
                </CollapsibleRow>
              );
            })
          )}
        </div>
      )}

      {/* Review Modal */}
      {reviewBookingId && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-start sm:items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-sm w-full p-5 space-y-4 shadow-2xl animate-in fade-in zoom-in-95 my-auto max-h-[90vh] overflow-y-auto scrollbar-slim">
            <h4 className="text-base font-extrabold text-slate-900 text-center">
              Đánh Giá Ca Khám Tại Nhà
            </h4>
            <div className="flex justify-center gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setReviewRating(star)}
                  className="p-1 hover:scale-110 transition-transform"
                >
                  <Star
                    className={`w-7 h-7 ${
                      star <= reviewRating
                        ? 'fill-amber-400 text-amber-400'
                        : 'text-slate-300'
                    }`}
                  />
                </button>
              ))}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Lời nhận xét / Góp ý
              </label>
              <textarea
                rows={3}
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                placeholder="Thầy thuốc tận tâm, châm cứu nhẹ nhàng..."
                className="w-full p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setReviewBookingId(null)}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
              >
                Đóng
              </button>
              <button
                type="button"
                onClick={() => {
                  onSubmitReview(reviewBookingId, reviewRating, reviewComment);
                  setReviewBookingId(null);
                }}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-md"
              >
                Gửi Đánh Giá
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ===== POPUP CHỌN THẦY THUỐC (xem được trọn danh sách dài + tìm kiếm) ===== */}
      {showDoctorModal && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setShowDoctorModal(false)}
        >
          <div
            className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[88vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header popup */}
            <div className="p-4 border-b border-slate-200 shrink-0">
              <div className="flex items-center justify-between gap-2 mb-3">
                <div>
                  <h4 className="text-sm font-extrabold text-slate-900 uppercase tracking-wide flex items-center gap-1.5">
                    <UserCheck className="w-4 h-4 text-emerald-600" />
                    Chọn Thầy Thuốc
                  </h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {verifiedDoctors.length} Thầy thuốc đã được Admin duyệt Chứng chỉ hành nghề
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowDoctorModal(false)}
                  className="w-8 h-8 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 font-bold shrink-0"
                >
                  ✕
                </button>
              </div>

              <input
                type="text"
                value={doctorSearch}
                onChange={(e) => setDoctorSearch(e.target.value)}
                placeholder="Tìm theo tên, chuyên khoa hoặc số CCHN..."
                className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            {/* Danh sách cuộn được */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-slate-50/50">
              {doctorSearchResults.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500">
                  <User className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                  {verifiedDoctors.length === 0
                    ? 'Chưa có Thầy thuốc nào được Admin duyệt CCHN. Vui lòng chọn chế độ Tự động tìm.'
                    : 'Không tìm thấy Thầy thuốc khớp từ khoá này.'}
                </div>
              ) : (
                doctorSearchResults.map((doc) => {
                  const docProfile = profiles.find((p) => p.id === doc.user_id);
                  if (!docProfile) return null;
                  const isSelected = selectedPractitionerId === doc.user_id;
                  return (
                    <button
                      key={doc.user_id}
                      type="button"
                      onClick={() => {
                        setSelectedPractitionerId(doc.user_id);
                        setShowDoctorModal(false);
                      }}
                      className={`w-full p-3 rounded-2xl border-2 text-left transition-all flex items-center justify-between gap-3 ${
                        isSelected
                          ? 'border-emerald-500 bg-emerald-50 shadow-sm'
                          : 'border-transparent bg-white hover:border-emerald-200 hover:shadow-xs'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="w-11 h-11 rounded-full bg-gradient-to-br from-emerald-600 to-teal-600 text-white font-bold flex items-center justify-center text-xs shadow shrink-0">
                          {docProfile.full_name.slice(0, 2)}
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-slate-900 flex items-center gap-1 truncate">
                            {docProfile.full_name}
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          </div>
                          <div className="text-[10px] text-slate-500 truncate">
                            {doc.specialties?.join(', ') || 'Y học cổ truyền'}
                          </div>
                          <div className="text-[10px] text-emerald-700 font-mono truncate">
                            CCHN: {doc.license_number}
                          </div>
                          <div className="flex items-center gap-1 mt-1 flex-wrap">
                            <span
                              className={`inline-block px-1.5 py-0.5 rounded-md text-[9px] font-extrabold uppercase ${
                                doc.is_online
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-slate-100 text-slate-500'
                              }`}
                            >
                              {doc.is_online ? '● Đang online' : '○ Đang offline'}
                            </span>

                            {/* Báo trước Thầy thuốc đang kẹt ca để Bệnh nhân khỏi
                                chọn rồi mới biết là trùng giờ */}
                            {isDoctorOnDuty(doc.user_id, bookings) && (
                              <span className="inline-block px-1.5 py-0.5 rounded-md text-[9px] font-extrabold uppercase bg-amber-100 text-amber-800">
                                ● Đang bận ca khám
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="flex items-center gap-0.5 text-amber-500 justify-end">
                          <Star className="w-3 h-3 fill-amber-400" />
                          <span className="text-[10px] font-bold text-slate-700">
                            {doc.rating_avg}
                          </span>
                        </div>
                        <div className="text-[9px] text-slate-400 mt-0.5">
                          {doc.completed_jobs || 0} ca
                        </div>
                        <div
                          className={`w-4 h-4 rounded-full border-2 mt-1.5 ml-auto flex items-center justify-center ${
                            isSelected
                              ? 'border-emerald-600 bg-emerald-600 text-white'
                              : 'border-slate-300'
                          }`}
                        >
                          {isSelected && <CheckCircle2 className="w-3 h-3" />}
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            {/* Footer popup */}
            <div className="p-3 border-t border-slate-200 shrink-0 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setSelectedPractitionerId(null);
                  setDoctorSelectionMode('AUTO');
                  setShowDoctorModal(false);
                }}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 border border-slate-200"
              >
                Để hệ thống tự tìm
              </button>
              <button
                type="button"
                onClick={() => setShowDoctorModal(false)}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md"
              >
                Xong
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer Logout Button for Mobile */}
      {onLogout && (
        <div className="mt-8 pt-4 pb-12 border-t border-slate-200/80 flex flex-col items-center justify-center gap-2">
          <button
            type="button"
            onClick={onLogout}
            className="w-full sm:w-auto px-6 py-2.5 rounded-2xl bg-rose-50 hover:bg-rose-100 active:bg-rose-200 text-rose-700 text-xs font-bold transition-all flex items-center justify-center gap-2 border border-rose-200 shadow-xs active:scale-95"
          >
            <LogOut className="w-4 h-4 text-rose-600" />
            <span>Đăng xuất tài khoản ({currentUser.phone})</span>
          </button>
          <p className="text-[11px] text-slate-400">Đông Y HomeCare • Bảo mật thông tin bệnh nhân</p>
        </div>
      )}
    </div>
  );
}
