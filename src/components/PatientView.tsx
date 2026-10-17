'use client';

import React, { useState } from 'react';
import {
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
} from 'lucide-react';
import { Profile, PractitionerProfile, Booking } from '@/types/database';
import {
  formatVND,
  formatDateTime,
  getCurrentDeviceLocation,
} from '@/lib/utils-medical';

interface PatientViewProps {
  currentUser: Profile;
  practitioners: Record<string, PractitionerProfile>;
  profiles: Profile[];
  bookings: Booking[];
  onCreateBooking: (
    newBooking: Partial<Booking>
  ) => Promise<{ success: boolean; message?: string; booking?: Booking }> | void;
  onCancelBooking: (bookingId: string) => void;
  onSubmitReview: (bookingId: string, rating: number, review: string) => void;
}

const SERVICE_PRICES: Record<string, number> = {
  'Châm cứu & Bấm huyệt đả thông kinh lạc': 400000,
  'Điều trị đau vai gáy, thoát vị đĩa đệm tại nhà': 450000,
  'Vật lý trị liệu & Phục hồi chức năng sau tai biến': 500000,
  'Khám Nội tổng quát & Kê đơn thuốc thang YHCT': 500000,
  'Xoa bóp dưỡng sinh & Chườm ngải cứu': 350000,
};

export default function PatientView({
  currentUser,
  practitioners,
  profiles,
  bookings,
  onCreateBooking,
  onCancelBooking,
  onSubmitReview,
}: PatientViewProps) {
  const [activeTab, setActiveTab] = useState<'BOOKING' | 'RECORDS'>('BOOKING');

  // Booking form state
  const [selectedPractitionerId, setSelectedPractitionerId] = useState<string | null>(null);
  const [serviceName, setServiceName] = useState('Châm cứu & Bấm huyệt đả thông kinh lạc');
  const [address, setAddress] = useState(currentUser.default_address || '');
  const [symptomNotes, setSymptomNotes] = useState('');
  const [isLocating, setIsLocating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formMsg, setFormMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Review modal state
  const [reviewBookingId, setReviewBookingId] = useState<string | null>(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');

  // 1-1 Isolation: STRICT FILTERING FOR THIS PATIENT ONLY
  const myBookings = bookings.filter((b) => b.patient_id === currentUser.id);

  // Active bookings (ongoing)
  const activeBookings = myBookings.filter((b) =>
    ['PENDING', 'CONFIRMED', 'ON_THE_WAY', 'IN_PROGRESS'].includes(b.status)
  );

  // Past bookings (completed or cancelled)
  const pastBookings = myBookings.filter((b) =>
    ['COMPLETED', 'CANCELLED_PATIENT', 'CANCELLED_DOCTOR'].includes(b.status)
  );

  // Verified & online practitioners
  const verifiedDoctors = Object.values(practitioners).filter(
    (p) => p.is_verified && p.is_online
  );

  const handleGetGPS = async () => {
    setIsLocating(true);
    setFormMsg(null);
    try {
      const loc = await getCurrentDeviceLocation();
      setAddress((prev) => (prev ? prev : `Tọa độ GPS: ${loc.lat.toFixed(5)}, ${loc.lng.toFixed(5)}`));
      setFormMsg({ type: 'success', text: `Đã lấy tọa độ GPS thực tế (${loc.lat.toFixed(4)}, ${loc.lng.toFixed(4)})` });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Lỗi lấy GPS';
      setFormMsg({ type: 'error', text: msg });
    } finally {
      setIsLocating(false);
    }
  };

  const handleSubmitBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    setFormMsg(null);

    if (!address.trim()) {
      setFormMsg({ type: 'error', text: 'Vui lòng nhập địa chỉ nhận khám tại nhà.' });
      return;
    }

    setIsSubmitting(true);
    try {
      let serviceFee = SERVICE_PRICES[serviceName] || 400000;
      let commissionRate = 15.0;

      if (selectedPractitionerId && practitioners[selectedPractitionerId]) {
        serviceFee = practitioners[selectedPractitionerId].base_service_fee || serviceFee;
        commissionRate = practitioners[selectedPractitionerId].commission_rate || 15.0;
      }

      const commissionAmount = Math.round((serviceFee * commissionRate) / 100);
      const bookingCode = `KB-${Date.now().toString().slice(-6)}`;

      const res = await onCreateBooking({
        booking_code: bookingCode,
        patient_id: currentUser.id,
        practitioner_id: selectedPractitionerId,
        service_name: serviceName,
        address: address.trim(),
        patient_phone: currentUser.phone,
        lat: 10.7769,
        lng: 106.6951,
        symptom_notes: symptomNotes.trim(),
        appointment_time: new Date(Date.now() + 2 * 3600 * 1000).toISOString(),
        service_fee: serviceFee,
        travel_surcharge: 0,
        commission_rate: commissionRate,
        commission_amount: commissionAmount,
        status: 'PENDING',
      });

      if (res && !res.success) {
        setFormMsg({ type: 'error', text: res.message || 'Không thể tạo đơn khám!' });
      } else {
        setFormMsg({
          type: 'success',
          text: (res && res.message) || `Đặt lịch thành công mã [${bookingCode}]! Vui lòng chờ Thầy thuốc xác nhận nhận ca.`,
        });
        setSymptomNotes('');
        setSelectedPractitionerId(null);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } finally {
      setIsSubmitting(false);
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

  return (
    <div className="w-full max-w-2xl mx-auto px-4 pb-20">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-emerald-700 via-teal-700 to-emerald-800 rounded-3xl p-5 sm:p-6 text-white shadow-xl shadow-emerald-900/10 mb-5 relative overflow-hidden">
        <div className="relative z-10">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs uppercase tracking-wider font-bold bg-white/20 px-2.5 py-0.5 rounded-full inline-block mb-1">
                Phân hệ Bệnh Nhân
              </span>
              <h2 className="text-xl sm:text-2xl font-extrabold">{currentUser.full_name}</h2>
              <p className="text-xs text-emerald-100 font-mono mt-0.5">SĐT: {currentUser.phone}</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20">
              <HeartPulse className="w-7 h-7 text-emerald-200" />
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-white/15 text-xs text-emerald-100 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-300" />
            <span>Chế độ cô lập dữ liệu 1-1: Chỉ xem và quản lý ca khám của riêng bạn.</span>
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
                return (
                  <div
                    key={b.id}
                    className="p-5 rounded-3xl bg-white border-2 border-emerald-500/30 shadow-lg shadow-emerald-500/5 space-y-3.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono font-bold text-slate-500">{b.booking_code}</span>
                          {getStatusBadge(b.status)}
                        </div>
                        <h4 className="text-base font-bold text-slate-900 mt-1">{b.service_name}</h4>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-extrabold text-emerald-700">{formatVND(b.service_fee + b.travel_surcharge)}</div>
                        <div className="text-[10px] text-slate-500">Thu tiền mặt tại nhà</div>
                      </div>
                    </div>

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
                        <span>Hẹn khám: {formatDateTime(b.appointment_time)}</span>
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

                    {/* Cancel Action (Hoàn 100% tiền tạm giữ cho Thầy thuốc - Không phạt cọc) */}
                    <div className="pt-2 flex justify-end">
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm('Bạn chắc chắn muốn hủy lịch khám này? Phí nền tảng sẽ được hoàn trả 100% cho Thầy thuốc.')) {
                            onCancelBooking(b.id);
                          }
                        }}
                        className="text-xs text-rose-600 hover:text-rose-800 font-semibold flex items-center gap-1 px-3 py-1.5 rounded-xl hover:bg-rose-50 transition-all"
                      >
                        <XCircle className="w-3.5 h-3.5" /> Hủy lịch khám (Không phạt cọc)
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Form Create New Booking */}
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
              {/* Step 1: Choose Doctor or Auto */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Bước 1: Chọn Thầy thuốc có Chứng chỉ hành nghề
                </label>

                {/* Auto select pill */}
                <div
                  onClick={() => setSelectedPractitionerId(null)}
                  className={`p-3.5 rounded-2xl border-2 cursor-pointer transition-all mb-2.5 flex items-center justify-between ${
                    selectedPractitionerId === null
                      ? 'border-emerald-600 bg-emerald-50/50'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                      <Sparkles className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-xs sm:text-sm font-bold text-slate-900">
                        Hệ thống tự động tìm Thầy thuốc gần nhất
                      </div>
                      <div className="text-[11px] text-slate-500">
                        Ưu tiên thầy thuốc đang online trong bán kính 5km
                      </div>
                    </div>
                  </div>
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${selectedPractitionerId === null ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-300'}`}>
                    {selectedPractitionerId === null && <CheckCircle2 className="w-3.5 h-3.5" />}
                  </div>
                </div>

                {/* List verified doctors */}
                <div className="space-y-2">
                  <div className="text-[11px] font-bold text-slate-500 uppercase">Hoặc chọn đích danh Thầy thuốc:</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {verifiedDoctors.map((doc) => {
                      const docProfile = profiles.find((p) => p.id === doc.user_id);
                      if (!docProfile) return null;
                      const isSelected = selectedPractitionerId === doc.user_id;

                      return (
                        <div
                          key={doc.id}
                          onClick={() => setSelectedPractitionerId(doc.user_id)}
                          className={`p-3 rounded-2xl border-2 cursor-pointer transition-all ${
                            isSelected
                              ? 'border-emerald-600 bg-emerald-50/60 shadow-sm'
                              : 'border-slate-200 hover:border-emerald-200 bg-white'
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <div>
                              <div className="text-xs font-bold text-slate-900 flex items-center gap-1">
                                {docProfile.full_name}
                                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                              </div>
                              <div className="text-[10px] text-emerald-700 font-mono mt-0.5">
                                {doc.license_number}
                              </div>
                            </div>
                            <span className="inline-flex items-center gap-0.5 text-[11px] font-bold text-amber-600">
                              <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                              {doc.rating_avg.toFixed(1)}
                            </span>
                          </div>

                          <div className="mt-2 text-[11px] text-slate-500 line-clamp-1">
                            {doc.specialties.join(', ')}
                          </div>

                          <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                            <span className="font-extrabold text-emerald-800">{formatVND(doc.base_service_fee)}</span>
                            <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-semibold">
                              Online
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Step 2: Service & Address */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Bước 2: Chọn dịch vụ y học cổ truyền
                </label>
                <select
                  value={serviceName}
                  onChange={(e) => setServiceName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs sm:text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="Châm cứu & Bấm huyệt đả thông kinh lạc">Châm cứu & Bấm huyệt đả thông kinh lạc (400.000đ)</option>
                  <option value="Điều trị đau vai gáy, thoát vị đĩa đệm tại nhà">Điều trị đau vai gáy, thoát vị đĩa đệm tại nhà (450.000đ)</option>
                  <option value="Vật lý trị liệu & Phục hồi chức năng sau tai biến">Vật lý trị liệu & Phục hồi chức năng sau tai biến (500.000đ)</option>
                  <option value="Khám Nội tổng quát & Kê đơn thuốc thang YHCT">Khám Nội tổng quát & Kê đơn thuốc thang YHCT (500.000đ)</option>
                  <option value="Xoa bóp dưỡng sinh & Chườm ngải cứu">Xoa bóp dưỡng sinh & Chườm ngải cứu (350.000đ)</option>
                </select>
              </div>

              {/* Address with GPS */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Địa chỉ nhà bạn *
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

              {/* Symptom */}
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

      {/* TAB 2: MEDICAL RECORDS & REVIEWS (BỆNH ÁN 3 MỤC) */}
      {activeTab === 'RECORDS' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <FileText className="w-4 h-4 text-emerald-600" />
              Sổ Bệnh Án Điện Tử Của Bạn ({pastBookings.length})
            </h3>
            <span className="text-[11px] text-slate-500">Bảo mật chuẩn y khoa</span>
          </div>

          {pastBookings.length === 0 ? (
            <div className="p-8 text-center bg-white rounded-3xl border border-slate-200">
              <FileText className="w-12 h-12 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-bold text-slate-700">Chưa có hồ sơ bệnh án nào</p>
              <p className="text-xs text-slate-500 mt-1">
                Sau khi Thầy thuốc hoàn tất ca khám và ghi bệnh án 3 mục, thông tin sẽ được lưu giữ tại đây trọn đời.
              </p>
            </div>
          ) : (
            pastBookings.map((b) => {
              const doctor = getDoctorProfile(b.practitioner_id);
              const isCompleted = b.status === 'COMPLETED';

              return (
                <div
                  key={b.id}
                  className="p-5 rounded-3xl bg-white border border-slate-200 shadow-md space-y-3.5"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold text-slate-500">{b.booking_code}</span>
                        {getStatusBadge(b.status)}
                      </div>
                      <h4 className="text-sm font-bold text-slate-900 mt-1">{b.service_name}</h4>
                    </div>
                    <span className="text-xs font-mono text-slate-500">{formatDateTime(b.appointment_time)}</span>
                  </div>

                  {doctor && doctor.prof && (
                    <div className="text-xs text-slate-600 flex items-center gap-1.5 font-medium">
                      <span>Thầy thuốc điều trị:</span>
                      <strong className="text-slate-900">{doctor.prof.full_name}</strong>
                      <span className="text-emerald-700 font-mono">({doctor.detail?.license_number})</span>
                    </div>
                  )}

                  {/* 3-Part Medical Record Section */}
                  {isCompleted && (
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
                  )}

                  {/* Rating Section */}
                  {isCompleted && (
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
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Review Modal */}
      {reviewBookingId && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-5 space-y-4 shadow-2xl animate-in fade-in zoom-in-95">
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
    </div>
  );
}
