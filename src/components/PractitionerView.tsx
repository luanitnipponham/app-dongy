'use client';

import React, { useState } from 'react';
import {
  FileBadge,
  ShieldAlert,
  ShieldCheck,
  MapPin,
  Phone,
  MessageCircle,
  Navigation,
  Wallet,
  Clock,
  CheckCircle2,
  XCircle,
  QrCode,
  DollarSign,
  AlertTriangle,
  History,
  FileText,
  HeartPulse,
  Send,
  Eye,
  PlusCircle,
  ChevronRight,
  ExternalLink,
  Map,
  Compass,
} from 'lucide-react';
import {
  Profile,
  PractitionerProfile,
  Booking,
  Wallet as WalletType,
  WalletTransaction,
} from '@/types/database';
import {
  formatVND,
  formatDateTime,
  maskPhoneNumber,
  getVietQRUrl,
  getGoogleMapsDirectionsUrl,
  getCurrentDeviceLocation,
  calculateDistanceInMeters,
} from '@/lib/utils-medical';

interface PractitionerViewProps {
  currentUser: Profile;
  practitioner: PractitionerProfile;
  wallet: WalletType;
  transactions: WalletTransaction[];
  bookings: Booking[];
  profiles: Profile[];
  onAcceptBooking: (bookingId: string) => Promise<boolean>;
  onCheckInGPS: (bookingId: string, lat: number, lng: number, distance: number) => void;
  onUpdateStatus: (bookingId: string, status: Booking['status']) => void;
  onCompleteBooking: (
    bookingId: string,
    diagnosis: string,
    treatment: string,
    advice: string
  ) => Promise<boolean>;
  onCancelBooking: (
    bookingId: string
  ) => Promise<{ success: boolean; message?: string } | boolean | void> | void;
  onDepositWallet: (amount: number) => void;
  onToggleOnline: (isOnline: boolean) => void;
}

export default function PractitionerView({
  currentUser,
  practitioner,
  wallet,
  transactions,
  bookings,
  profiles,
  onAcceptBooking,
  onCheckInGPS,
  onUpdateStatus,
  onCompleteBooking,
  onCancelBooking,
  onDepositWallet,
  onToggleOnline,
}: PractitionerViewProps) {
  const [activeTab, setActiveTab] = useState<'ACTIVE_JOBS' | 'WALLET' | 'HISTORY'>('ACTIVE_JOBS');

  // Medical Record Form State (Active booking)
  const [editingBookingId, setEditingBookingId] = useState<string | null>(null);
  const [diagnosis, setDiagnosis] = useState('');
  const [treatment, setTreatment] = useState('');
  const [advice, setAdvice] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // VietQR Modal State
  const [showQRModal, setShowQRModal] = useState(false);
  const [depositAmount, setDepositAmount] = useState(200000);

  // GPS Check-in checking state
  const [isCheckingIn, setIsCheckingIn] = useState<string | null>(null);

  // 1. GATEKEEPER CHECK: Is verified by Admin?
  if (!practitioner.is_verified) {
    return (
      <div className="w-full max-w-lg mx-auto px-4 py-8">
        <div className="bg-white rounded-3xl p-6 sm:p-8 border-2 border-amber-300 shadow-2xl text-center space-y-4">
          <div className="w-16 h-16 rounded-3xl bg-amber-100 text-amber-700 mx-auto flex items-center justify-center ring-8 ring-amber-50">
            <ShieldAlert className="w-9 h-9" />
          </div>

          <div>
            <span className="px-3 py-1 rounded-full text-xs font-extrabold uppercase bg-amber-100 text-amber-800 tracking-wider">
              Chờ Thẩm Định Pháp Lý eKYC
            </span>
            <h2 className="text-xl font-extrabold text-slate-800 mt-2">
              Hồ Sơ CCHN Đang Được Admin Thẩm Định
            </h2>
            <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
              Theo quy chuẩn an toàn Y tế, tài khoản Thầy thuốc cần được Admin phê duyệt Chứng chỉ
              hành nghề trước khi có thể bật Online và nhận bệnh nhân.
            </p>
          </div>

          {/* Submission summary */}
          <div className="p-4 bg-slate-50 rounded-2xl text-left text-xs space-y-2 border border-slate-200">
            <div>
              <span className="text-slate-500 font-medium">Thầy thuốc:</span>{' '}
              <strong className="text-slate-900">{currentUser.full_name}</strong>
            </div>
            <div>
              <span className="text-slate-500 font-medium">Số CCHN:</span>{' '}
              <span className="font-mono font-bold text-emerald-700">
                {practitioner.license_number || 'Chưa cung cấp'}
              </span>
            </div>
            <div>
              <span className="text-slate-500 font-medium">Cơ quan cấp phép:</span>{' '}
              <span className="font-semibold text-slate-800">{practitioner.issued_by}</span>
            </div>

            {practitioner.license_image_url && (
              <div className="pt-2">
                <span className="text-slate-500 font-medium block mb-1">Ảnh chứng chỉ đã nộp:</span>
                <div className="h-36 rounded-xl overflow-hidden border border-slate-300 relative group">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={practitioner.license_image_url}
                    alt="Giấy phép hành nghề"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center text-white text-xs opacity-0 group-hover:opacity-100 transition-opacity">
                    <Eye className="w-4 h-4 mr-1" /> Xem ảnh lớn
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="pt-2 flex flex-col gap-2">
            <a
              href="https://zalo.me/0999888999"
              target="_blank"
              rel="noreferrer"
              className="w-full py-3 px-4 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20"
            >
              <MessageCircle className="w-4 h-4" /> Nhắn Zalo Admin Duyệt Nhanh
            </a>
            <p className="text-[11px] text-slate-400">
              * Bạn có thể đăng nhập bằng tài khoản <strong>Lương y Trần Hữu Đức</strong> hoặc{' '}
              <strong>Admin</strong> trên thanh Quick Login để trải nghiệm ngay.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // 2. STRICT 1-1 ISOLATION FILTERING:
  // Practitioner X only sees:
  // a) Bookings assigned directly to X (practitioner_id === currentUser.id)
  // b) Open unassigned bookings (practitioner_id === null AND status === 'PENDING')
  // Strictly CANNOT see bookings assigned to Practitioner Y!
  const relevantBookings = bookings.filter((b) => {
    if (b.practitioner_id === currentUser.id) return true;
    if (b.practitioner_id === null && b.status === 'PENDING') return true;
    return false;
  });

  const pendingBookings = relevantBookings.filter((b) => b.status === 'PENDING');
  const activeJobs = relevantBookings.filter((b) =>
    ['CONFIRMED', 'ON_THE_WAY', 'IN_PROGRESS'].includes(b.status)
  );
  const completedJobs = relevantBookings.filter(
    (b) =>
      b.practitioner_id === currentUser.id &&
      ['COMPLETED', 'CANCELLED_PATIENT', 'CANCELLED_DOCTOR'].includes(b.status)
  );

  const handleAccept = async (b: Booking) => {
    setActionError(null);
    setActionSuccess(null);

    if (wallet.available_balance < b.commission_amount) {
      setActionError(
        `Số dư Ví Tín Dụng (${formatVND(
          wallet.available_balance
        )}) không đủ để tạm giữ phí nền tảng (${formatVND(
          b.commission_amount
        )}). Vui lòng nạp thêm qua VietQR!`
      );
      setShowQRModal(true);
      return;
    }

    const ok = await onAcceptBooking(b.id);
    if (ok) {
      setActionSuccess(`Đã nhận ca khám ${b.booking_code}! Phí nền tảng đã được tạm giữ an toàn.`);
    }
  };

  const handleCheckIn = async (b: Booking) => {
    setIsCheckingIn(b.id);
    setActionError(null);
    try {
      const loc = await getCurrentDeviceLocation();
      const distance = calculateDistanceInMeters(loc.lat, loc.lng, b.lat, b.lng);
      onCheckInGPS(b.id, loc.lat, loc.lng, distance);
      if (distance > 500) {
        setActionSuccess(
          `Ghi nhận GPS: Vị trí của bạn cách địa chỉ khách ~${distance}m (Cảnh báo mềm - Vẫn cho phép khám).`
        );
      } else {
        setActionSuccess(`Check-in thành công tại nhà khách (~${distance}m).`);
      }
    } catch {
      // Fallback soft check-in without GPS
      onCheckInGPS(b.id, b.lat, b.lng, 0);
      setActionSuccess('Đã ghi nhận Check-in có mặt tại nhà khách.');
    } finally {
      setIsCheckingIn(null);
    }
  };

  const handleFinishJob = async (b: Booking) => {
    if (!diagnosis.trim()) {
      setActionError('BẮT BUỘC: Vui lòng ghi Mục 1: Chẩn đoán bệnh trước khi hoàn tất ca.');
      return;
    }

    const ok = await onCompleteBooking(b.id, diagnosis.trim(), treatment.trim(), advice.trim());
    if (ok) {
      setActionSuccess(`Ca khám ${b.booking_code} đã hoàn tất và lưu vào Sổ bệnh án của Bệnh nhân!`);
      setEditingBookingId(null);
      setDiagnosis('');
      setTreatment('');
      setAdvice('');
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto px-4 pb-20">
      {/* Top Banner with Online toggle & Wallet Balance */}
      <div className="bg-gradient-to-r from-teal-800 via-emerald-800 to-teal-900 rounded-3xl p-5 sm:p-6 text-white shadow-xl shadow-teal-950/20 mb-5">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase tracking-wider font-extrabold bg-white/20 px-2.5 py-0.5 rounded-full inline-block">
                Thầy Thuốc CCHN
              </span>
              <span className="text-xs text-teal-200 font-mono">
                {practitioner.license_number}
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-extrabold mt-1">{currentUser.full_name}</h2>
            <div className="text-xs text-teal-100 flex items-center gap-1.5 mt-0.5">
              <span>{practitioner.specialties.join(' • ')}</span>
            </div>
          </div>

          {/* Online Toggle Button */}
          <button
            type="button"
            onClick={() => onToggleOnline(!practitioner.is_online)}
            className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 shadow ${
              practitioner.is_online
                ? 'bg-emerald-400 text-emerald-950 hover:bg-emerald-300 ring-2 ring-emerald-300'
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                practitioner.is_online ? 'bg-emerald-950 animate-ping' : 'bg-slate-400'
              }`}
            />
            {practitioner.is_online ? 'Đang Sẵn Sàng (Online)' : 'Đang Tạm Ẩn (Offline)'}
          </button>
        </div>

        {/* Quick Wallet Summary Pill */}
        <div className="mt-4 pt-3.5 border-t border-white/15 grid grid-cols-2 gap-3 text-xs">
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-2.5">
            <div className="text-teal-200 text-[11px]">Ví khả dụng (Có thể nhận ca):</div>
            <div className="text-base font-extrabold text-white mt-0.5">
              {formatVND(wallet.available_balance)}
            </div>
          </div>
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-2.5">
            <div className="text-teal-200 text-[11px]">Đang tạm giữ phí nền tảng:</div>
            <div className="text-base font-extrabold text-amber-300 mt-0.5">
              {formatVND(wallet.locked_balance)}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex bg-slate-100 p-1.5 rounded-2xl mb-6">
        <button
          type="button"
          onClick={() => setActiveTab('ACTIVE_JOBS')}
          className={`flex-1 py-2.5 text-xs sm:text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'ACTIVE_JOBS'
              ? 'bg-white text-teal-800 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Compass className="w-4 h-4" /> Ca Khám & Bệnh Án
          {pendingBookings.length + activeJobs.length > 0 && (
            <span className="w-5 h-5 rounded-full bg-teal-700 text-white text-[11px] flex items-center justify-center font-bold">
              {pendingBookings.length + activeJobs.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('WALLET')}
          className={`flex-1 py-2.5 text-xs sm:text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'WALLET'
              ? 'bg-white text-teal-800 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Wallet className="w-4 h-4" /> Ví Tín Dụng & VietQR
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('HISTORY')}
          className={`flex-1 py-2.5 text-xs sm:text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'HISTORY'
              ? 'bg-white text-teal-800 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <History className="w-4 h-4" /> Lịch Sử Khám ({completedJobs.length})
        </button>
      </div>

      {/* Action Messages */}
      {actionError && (
        <div className="mb-4 p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs sm:text-sm flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{actionError}</span>
        </div>
      )}
      {actionSuccess && (
        <div className="mb-4 p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs sm:text-sm flex items-start gap-2.5">
          <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* TAB 1: ACTIVE JOBS & PENDING REQUESTS */}
      {activeTab === 'ACTIVE_JOBS' && (
        <div className="space-y-6">
          {/* Ongoing in-progress jobs */}
          {activeJobs.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <HeartPulse className="w-4 h-4 text-emerald-600" />
                Ca Khám Đang Phụ Trách ({activeJobs.length})
              </h3>

              {activeJobs.map((b) => {
                const patient = profiles.find((p) => p.id === b.patient_id);
                const isEditingMedicalRecord = editingBookingId === b.id;

                return (
                  <div
                    key={b.id}
                    className="p-5 rounded-3xl bg-white border-2 border-teal-500 shadow-xl shadow-teal-500/5 space-y-4"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono font-bold text-slate-500">
                            {b.booking_code}
                          </span>
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-teal-100 text-teal-800">
                            {b.status === 'CONFIRMED'
                              ? 'Đã Nhận Ca'
                              : b.status === 'ON_THE_WAY'
                              ? 'Đang Di Chuyển'
                              : 'Đang Khám Tại Nhà'}
                          </span>
                        </div>
                        <h4 className="text-base font-bold text-slate-900 mt-1">{b.service_name}</h4>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-extrabold text-teal-800">
                          {formatVND(b.service_fee + b.travel_surcharge)}
                        </div>
                        <div className="text-[10px] text-slate-500">Tiền mặt thu tại nhà</div>
                      </div>
                    </div>

                    {/* Full Patient Contact Unlocked (After Escrow Lock) */}
                    <div className="p-3.5 bg-slate-50 rounded-2xl space-y-2 border border-slate-200 text-xs">
                      <div className="flex items-center justify-between font-bold text-slate-900">
                        <span>Bệnh nhân: {patient?.full_name || 'Khách hàng'}</span>
                        <span className="font-mono text-emerald-700">{b.patient_phone}</span>
                      </div>
                      <div className="flex items-start gap-1.5 text-slate-700">
                        <MapPin className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                        <span>{b.address}</span>
                      </div>
                      {b.symptom_notes && (
                        <div className="text-slate-600 italic bg-white p-2 rounded-xl border border-slate-100">
                          Triệu chứng: {b.symptom_notes}
                        </div>
                      )}
                    </div>

                    {/* HIGHLIGHT: FREE GOOGLE MAPS DEEP LINK & CONTACT BUTTONS */}
                    <div className="space-y-2">
                      <a
                        href={getGoogleMapsDirectionsUrl(b.address, b.lat, b.lng)}
                        target="_blank"
                        rel="noreferrer"
                        className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-blue-500/25 transition-all"
                      >
                        <Map className="w-4 h-4" />
                        Mở Google Maps Chỉ Đường Miễn Phí (Xe Máy)
                        <ExternalLink className="w-3.5 h-3.5 ml-1" />
                      </a>

                      <div className="grid grid-cols-2 gap-2">
                        <a
                          href={`tel:${b.patient_phone}`}
                          className="py-2.5 px-3 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold flex items-center justify-center gap-1.5"
                        >
                          <Phone className="w-3.5 h-3.5" /> Gọi Cho Khách
                        </a>
                        <a
                          href={`https://zalo.me/${b.patient_phone}`}
                          target="_blank"
                          rel="noreferrer"
                          className="py-2.5 px-3 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 text-xs font-bold flex items-center justify-center gap-1.5"
                        >
                          <MessageCircle className="w-3.5 h-3.5" /> Mở Zalo
                        </a>
                      </div>
                    </div>

                    {/* Status Stepper & Soft GPS Check-in */}
                    <div className="p-3 bg-teal-50/70 rounded-2xl border border-teal-200 space-y-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-teal-950">Tiến trình phục vụ:</span>
                        <div className="flex items-center gap-1.5">
                          {b.status === 'CONFIRMED' && (
                            <button
                              type="button"
                              onClick={() => onUpdateStatus(b.id, 'ON_THE_WAY')}
                              className="px-2.5 py-1 rounded-lg bg-teal-700 text-white font-bold hover:bg-teal-800"
                            >
                              Tôi đang di chuyển
                            </button>
                          )}
                          {(b.status === 'CONFIRMED' || b.status === 'ON_THE_WAY') && (
                            <button
                              type="button"
                              onClick={() => handleCheckIn(b)}
                              disabled={isCheckingIn === b.id}
                              className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white font-bold hover:bg-emerald-700 flex items-center gap-1"
                            >
                              <Navigation className="w-3 h-3" />
                              {isCheckingIn === b.id ? 'Đang GPS...' : 'Check-in tại nhà'}
                            </button>
                          )}
                        </div>
                      </div>

                      {b.checkin_distance_meters !== undefined && b.checkin_distance_meters !== null && (
                        <div className="text-[11px] text-teal-800 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          Đã check-in GPS (Khoảng cách ghi nhận ~{b.checkin_distance_meters}m)
                        </div>
                      )}
                    </div>

                    {/* 3-PART MEDICAL RECORD FORM & FINISH JOB */}
                    {isEditingMedicalRecord ? (
                      <div className="p-4 bg-emerald-50/60 rounded-2xl border border-emerald-300 space-y-3">
                        <div className="text-xs font-extrabold text-emerald-950 uppercase flex items-center gap-1.5">
                          <FileText className="w-4 h-4 text-emerald-700" />
                          Bệnh Án Điện Tử 3 Mục Chuẩn Y Khoa
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 mb-0.5">
                            1. Chẩn đoán bệnh / Mạch tượng (Bắt buộc) *
                          </label>
                          <textarea
                            rows={2}
                            value={diagnosis}
                            onChange={(e) => setDiagnosis(e.target.value)}
                            placeholder="VD: Chứng phong hàn tý, kinh lạc bế tắc gây co cứng cơ thang vai..."
                            className="w-full p-2.5 rounded-xl bg-white border border-slate-300 text-xs focus:ring-2 focus:ring-emerald-500"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 mb-0.5">
                            2. Thủ thuật đã thực hiện & Đơn thuốc YHCT
                          </label>
                          <textarea
                            rows={2}
                            value={treatment}
                            onChange={(e) => setTreatment(e.target.value)}
                            placeholder="VD: Điện châm huyệt Phong trì, Kiên tỉnh, Hợp cốc 25 phút. Xoa bóp cơ thang..."
                            className="w-full p-2.5 rounded-xl bg-white border border-slate-300 text-xs focus:ring-2 focus:ring-emerald-500"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 mb-0.5">
                            3. Lời dặn dò bác sĩ & Lịch hẹn tái khám
                          </label>
                          <textarea
                            rows={2}
                            value={advice}
                            onChange={(e) => setAdvice(e.target.value)}
                            placeholder="VD: Giữ ấm vùng cổ, tránh quạt thốc thẳng, tái khám vào thứ 4..."
                            className="w-full p-2.5 rounded-xl bg-white border border-slate-300 text-xs focus:ring-2 focus:ring-emerald-500"
                          />
                        </div>

                        <div className="flex gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => setEditingBookingId(null)}
                            className="flex-1 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200"
                          >
                            Đóng Form
                          </button>
                          <button
                            type="button"
                            onClick={() => handleFinishJob(b)}
                            className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md flex items-center justify-center gap-1.5"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            Hoàn Tất Khám & Quyết Toán Phí
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingBookingId(b.id);
                          setDiagnosis(b.medical_diagnosis || '');
                          setTreatment(b.treatment_notes || '');
                          setAdvice(b.doctor_advice || '');
                        }}
                        className="w-full py-2.5 px-4 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-sm"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        Ghi Bệnh Án 3 Mục & Hoàn Tất Ca Khám
                      </button>
                    )}

                    {/* Cancel button (Refund 100% lock fee) */}
                    <div className="pt-1 flex justify-end">
                      <button
                        type="button"
                        onClick={async () => {
                          if (
                            confirm(
                              'Bạn có việc bận đột xuất muốn hủy ca này? Hệ thống sẽ HOÀN TRẢ 100% phí tạm giữ về ví của bạn (Không phạt cọc).'
                            )
                          ) {
                            await onCancelBooking(b.id);
                          }
                        }}
                        className="text-[11px] text-slate-400 hover:text-rose-600 flex items-center gap-1 transition-colors"
                      >
                        <XCircle className="w-3 h-3" /> Báo bận / Hủy ca (Hoàn 100% tiền tạm giữ)
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Pending requests (chờ nhận ca) */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-500" />
                Đơn Khám Chờ Bạn Nhận ({pendingBookings.length})
              </h3>
              <span className="text-[11px] text-slate-500 font-medium">Mô hình chiết khấu Grab</span>
            </div>

            {pendingBookings.length === 0 ? (
              <div className="p-8 text-center bg-white rounded-3xl border border-slate-200">
                <Clock className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <p className="text-sm font-bold text-slate-700">Hiện không có đơn khám mới</p>
                <p className="text-xs text-slate-500 mt-1">
                  Đơn khám mới từ bệnh nhân chọn bạn hoặc đơn tự do trong khu vực sẽ xuất hiện tại đây ngay khi có.
                </p>
              </div>
            ) : (
              pendingBookings.map((b) => {
                const isDedicated = b.practitioner_id === currentUser.id;

                return (
                  <div
                    key={b.id}
                    className="p-5 rounded-3xl bg-white border border-slate-200 shadow-md space-y-3.5 hover:border-teal-300 transition-all"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono font-bold text-slate-500">
                            {b.booking_code}
                          </span>
                          {isDedicated ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-200">
                              Khách Chọn Đích Danh Bạn
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800">
                              Đơn Tự Do
                            </span>
                          )}
                        </div>
                        <h4 className="text-base font-bold text-slate-900 mt-1">{b.service_name}</h4>
                      </div>
                    </div>

                    {/* Masked patient phone (Chống đi đêm trước khi nhận ca) */}
                    <div className="p-3 bg-slate-50 rounded-2xl text-xs space-y-1.5 border border-slate-100">
                      <div className="flex items-center justify-between text-slate-700 font-medium">
                        <span className="text-slate-500">Số điện thoại khách:</span>
                        <span className="font-mono font-bold text-slate-800 bg-white px-2 py-0.5 rounded border border-slate-200">
                          {maskPhoneNumber(b.patient_phone)}
                        </span>
                      </div>
                      <div className="flex items-start gap-1.5 text-slate-700">
                        <MapPin className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                        <span>{b.address}</span>
                      </div>
                      {b.symptom_notes && (
                        <div className="text-slate-600 italic">Triệu chứng: {b.symptom_notes}</div>
                      )}
                    </div>

                    {/* Financial Breakdown (Kiểu Grab Minh Bạch) */}
                    <div className="p-3.5 bg-amber-50/70 rounded-2xl border border-amber-200/80 space-y-1.5 text-xs">
                      <div className="font-extrabold text-amber-950 uppercase tracking-wide flex items-center justify-between">
                        <span>Tài chính ca khám:</span>
                        <span className="text-sm text-emerald-800">
                          Thu khách: {formatVND(b.service_fee + b.travel_surcharge)}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-[11px] pt-1 text-slate-700">
                        <div>
                          • Giá khám: <strong>{formatVND(b.service_fee)}</strong>
                        </div>
                        <div>
                          • Phụ phí xăng xe (hưởng 100%): <strong>{formatVND(b.travel_surcharge)}</strong>
                        </div>
                        <div className="col-span-2 text-rose-700 font-semibold">
                          • Phí nền tảng ({b.commission_rate}%):{' '}
                          <strong>{formatVND(b.commission_amount)}</strong> (Tạm giữ khi bấm nhận)
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleAccept(b)}
                      className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-teal-700 to-emerald-700 hover:from-teal-800 hover:to-emerald-800 text-white font-bold text-xs sm:text-sm shadow-lg shadow-teal-700/20 transition-all flex items-center justify-center gap-2 active:scale-[0.99]"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Nhận Ca Khám (Tạm Giữ {formatVND(b.commission_amount)})
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* TAB 2: WALLET & VIETQR */}
      {activeTab === 'WALLET' && (
        <div className="space-y-5">
          {/* Main Wallet Balance Card */}
          <div className="p-6 rounded-3xl bg-gradient-to-br from-slate-900 via-teal-950 to-slate-900 text-white shadow-2xl relative overflow-hidden">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs uppercase font-extrabold tracking-wider text-teal-300 flex items-center gap-1.5">
                <Wallet className="w-4 h-4" /> Ví Tín Dụng Liên Kết (Grab Model)
              </span>
              <span className="text-[10px] bg-teal-500/20 text-teal-300 border border-teal-500/30 px-2 py-0.5 rounded-full font-mono">
                {currentUser.phone}
              </span>
            </div>

            <div className="mt-3">
              <div className="text-xs text-slate-400">Số Dư Khả Dụng Để Nhận Ca:</div>
              <div className="text-3xl sm:text-4xl font-black text-white mt-1 tracking-tight">
                {formatVND(wallet.available_balance)}
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-xs">
              <span className="text-slate-400">Đang tạm giữ phí nền tảng:</span>
              <span className="font-extrabold text-amber-300">{formatVND(wallet.locked_balance)}</span>
            </div>

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setShowQRModal(true)}
                className="flex-1 py-3 px-4 rounded-2xl bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-teal-500/30 transition-all"
              >
                <QrCode className="w-4 h-4" /> Nạp Tiền Bằng VietQR Tự Động
              </button>
            </div>
          </div>

          {/* Quick simulation buttons for testing */}
          <div className="p-4 bg-white rounded-2xl border border-slate-200 text-xs flex items-center justify-between">
            <span className="text-slate-600 font-medium">Thử nghiệm cộng tiền ví (Demo):</span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => onDepositWallet(200000)}
                className="px-3 py-1.5 rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-800 font-bold border border-teal-200"
              >
                +200.000đ
              </button>
              <button
                type="button"
                onClick={() => onDepositWallet(500000)}
                className="px-3 py-1.5 rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-800 font-bold border border-teal-200"
              >
                +500.000đ
              </button>
            </div>
          </div>

          {/* Transaction Ledger */}
          <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-md space-y-3">
            <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <History className="w-4 h-4 text-teal-700" />
              Sổ Cái Biến Động Ví Tín Dụng
            </h4>

            {transactions.length === 0 ? (
              <p className="text-xs text-slate-400 py-3 text-center">Chưa có giao dịch ví nào.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {transactions.map((tx) => (
                  <div key={tx.id} className="py-2.5 flex items-center justify-between text-xs">
                    <div>
                      <div className="font-bold text-slate-800">{tx.description}</div>
                      <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                        {formatDateTime(tx.created_at)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div
                        className={`font-extrabold ${
                          tx.type === 'DEPOSIT' || tx.type === 'REFUND_LOCK'
                            ? 'text-emerald-700'
                            : tx.type === 'LOCK_COMMISSION'
                            ? 'text-amber-600'
                            : 'text-rose-600'
                        }`}
                      >
                        {tx.type === 'DEPOSIT' || tx.type === 'REFUND_LOCK' ? '+' : '-'}
                        {formatVND(tx.amount)}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        Số dư sau: {formatVND(tx.balance_after)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: HISTORY */}
      {activeTab === 'HISTORY' && (
        <div className="space-y-4">
          <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-2">
            <History className="w-4 h-4 text-teal-700" />
            Lịch Sử Ca Khám Đã Phụ Trách ({completedJobs.length})
          </h3>

          {completedJobs.length === 0 ? (
            <div className="p-8 text-center bg-white rounded-3xl border border-slate-200">
              <History className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-bold text-slate-700">Chưa có ca khám nào hoàn tất</p>
            </div>
          ) : (
            completedJobs.map((b) => (
              <div
                key={b.id}
                className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm text-xs space-y-2"
              >
                <div className="flex items-center justify-between font-bold text-slate-800">
                  <span className="font-mono">{b.booking_code}</span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] ${
                      b.status === 'COMPLETED'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-rose-100 text-rose-800'
                    }`}
                  >
                    {b.status === 'COMPLETED' ? 'Hoàn tất' : 'Đã hủy'}
                  </span>
                </div>
                <div>{b.service_name}</div>
                <div className="text-slate-500">{b.address}</div>
                {b.medical_diagnosis && (
                  <div className="bg-slate-50 p-2 rounded-xl text-slate-700 font-mono text-[11px]">
                    Chẩn đoán: {b.medical_diagnosis}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* VIETQR DEPOSIT MODAL */}
      {showQRModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-5 space-y-4 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-extrabold text-slate-900 uppercase">
                Nạp Ví Tín Dụng Qua VietQR
              </h4>
              <button
                type="button"
                onClick={() => setShowQRModal(false)}
                className="text-slate-400 hover:text-slate-600 font-bold text-sm"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2">
              <label className="block text-[11px] font-bold text-slate-700">Chọn số tiền nạp:</label>
              <div className="grid grid-cols-3 gap-2">
                {[100000, 200000, 500000].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setDepositAmount(amt)}
                    className={`py-2 rounded-xl text-xs font-bold border transition-all ${
                      depositAmount === amt
                        ? 'border-teal-600 bg-teal-50 text-teal-800'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    {amt / 1000}k
                  </button>
                ))}
              </div>
            </div>

            {/* Generated QR Code Image */}
            <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 text-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={getVietQRUrl(depositAmount, currentUser.phone)}
                alt="VietQR nạp ví"
                className="w-48 h-48 mx-auto rounded-xl object-contain shadow-xs bg-white p-1"
              />
              <div className="text-[11px] text-slate-600 mt-2 font-mono">
                Nội dung CK: <strong>NAPVI {currentUser.phone}</strong>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  onDepositWallet(depositAmount);
                  setShowQRModal(false);
                  setActionSuccess(`Nạp thành công ${formatVND(depositAmount)} vào Ví Tín Dụng!`);
                }}
                className="w-full py-3 rounded-2xl bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs shadow-md"
              >
                Xác Nhận Nạp Tiền Thành Công (Mô Phỏng)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
