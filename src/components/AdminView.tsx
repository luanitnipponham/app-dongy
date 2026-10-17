'use client';

import React, { useState } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Users,
  Calendar,
  DollarSign,
  FileBadge,
  Eye,
  RefreshCw,
  Search,
  KeyRound,
  UserCheck,
  AlertTriangle,
  ArrowRightLeft,
  HeartPulse,
  CreditCard,
  Building,
  Phone,
} from 'lucide-react';
import {
  Profile,
  PractitionerProfile,
  Booking,
  Wallet,
  WalletTransaction,
} from '@/types/database';
import { formatVND, formatDateTime } from '@/lib/utils-medical';

interface AdminViewProps {
  currentUser: Profile;
  profiles: Profile[];
  practitioners: Record<string, PractitionerProfile>;
  wallets: Record<string, Wallet>;
  bookings: Booking[];
  transactions: WalletTransaction[];
  onVerifyPractitioner: (userId: string, isVerified: boolean) => void;
  onReassignDoctor: (bookingId: string, newDoctorId: string) => void;
  onCancelBookingByAdmin: (bookingId: string) => void;
  onResetPassword: (userId: string) => void;
  onAdjustWallet: (userId: string, amount: number) => void;
  onUpdateCommissionRate: (userId: string, newRate: number) => void;
}

export default function AdminView({
  currentUser,
  profiles,
  practitioners,
  wallets,
  bookings,
  transactions,
  onVerifyPractitioner,
  onReassignDoctor,
  onCancelBookingByAdmin,
  onResetPassword,
  onAdjustWallet,
  onUpdateCommissionRate,
}: AdminViewProps) {
  const [activeTab, setActiveTab] = useState<'EKYC' | 'BOOKINGS' | 'USERS' | 'REVENUE'>('EKYC');
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const [adminMsg, setAdminMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Reassign modal state
  const [reassignBookingId, setReassignBookingId] = useState<string | null>(null);
  const [targetDoctorId, setTargetDoctorId] = useState<string>('');

  // Top-level metrics
  const unverifiedPractitioners = Object.values(practitioners).filter((p) => !p.is_verified);
  const verifiedPractitioners = Object.values(practitioners).filter((p) => p.is_verified);

  const completedBookings = bookings.filter((b) => b.status === 'COMPLETED');
  const totalGrossRevenue = completedBookings.reduce(
    (sum, b) => sum + (b.service_fee + b.travel_surcharge),
    0
  );
  const totalPlatformFees = completedBookings.reduce(
    (sum, b) => sum + b.commission_amount,
    0
  );

  return (
    <div className="w-full max-w-4xl mx-auto px-4 pb-20">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-purple-900 via-indigo-900 to-slate-900 rounded-3xl p-5 sm:p-6 text-white shadow-xl shadow-purple-950/20 mb-5">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase tracking-wider font-extrabold bg-purple-500/30 text-purple-200 border border-purple-400/40 px-2.5 py-0.5 rounded-full inline-block">
                Trung Tâm Điều Phối & Quản Trị Hệ Thống
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black mt-1">Toàn Quyền Quản Trị (Admin SuperUser)</h2>
            <p className="text-xs text-purple-200 mt-0.5 font-medium">
              Giám sát 100% ca khám, phê duyệt Chứng chỉ hành nghề eKYC, quản lý tài chính ví tín dụng.
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center border border-white/20">
            <ShieldCheck className="w-7 h-7 text-purple-300" />
          </div>
        </div>

        {/* Quick KPI stats row */}
        <div className="mt-4 pt-3.5 border-t border-white/15 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
          <div className="bg-white/10 rounded-2xl p-2.5">
            <div className="text-purple-200 text-[11px]">Hồ sơ CCHN chờ duyệt:</div>
            <div className="text-lg font-black text-amber-300 mt-0.5 flex items-center gap-1.5">
              {unverifiedPractitioners.length}
              {unverifiedPractitioners.length > 0 && (
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
              )}
            </div>
          </div>
          <div className="bg-white/10 rounded-2xl p-2.5">
            <div className="text-purple-200 text-[11px]">Tổng số ca toàn sàn:</div>
            <div className="text-lg font-black text-white mt-0.5">{bookings.length}</div>
          </div>
          <div className="bg-white/10 rounded-2xl p-2.5">
            <div className="text-purple-200 text-[11px]">Tổng doanh thu dịch vụ:</div>
            <div className="text-lg font-black text-emerald-300 mt-0.5">
              {formatVND(totalGrossRevenue)}
            </div>
          </div>
          <div className="bg-white/10 rounded-2xl p-2.5">
            <div className="text-purple-200 text-[11px]">Phí nền tảng thu được:</div>
            <div className="text-lg font-black text-amber-300 mt-0.5">
              {formatVND(totalPlatformFees)}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex bg-slate-100 p-1.5 rounded-2xl mb-6 overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab('EKYC')}
          className={`flex-1 min-w-[130px] py-2.5 text-xs sm:text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'EKYC'
              ? 'bg-white text-purple-900 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <FileBadge className="w-4 h-4" /> Duyệt CCHN
          {unverifiedPractitioners.length > 0 && (
            <span className="px-1.5 py-0.2 rounded-full bg-amber-500 text-white text-[10px] font-black">
              {unverifiedPractitioners.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('BOOKINGS')}
          className={`flex-1 min-w-[130px] py-2.5 text-xs sm:text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'BOOKINGS'
              ? 'bg-white text-purple-900 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Calendar className="w-4 h-4" /> Giám Sát & Điều Phối
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('USERS')}
          className={`flex-1 min-w-[130px] py-2.5 text-xs sm:text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'USERS'
              ? 'bg-white text-purple-900 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Users className="w-4 h-4" /> Quản Lý User & Reset MK
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('REVENUE')}
          className={`flex-1 min-w-[130px] py-2.5 text-xs sm:text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'REVENUE'
              ? 'bg-white text-purple-900 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <DollarSign className="w-4 h-4" /> Đối Soát Sàn (Grab)
        </button>
      </div>

      {adminMsg && (
        <div
          className={`mb-4 p-3.5 rounded-2xl text-xs sm:text-sm flex items-start gap-2.5 ${
            adminMsg.type === 'success'
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border border-rose-200 text-rose-800'
          }`}
        >
          {adminMsg.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
          ) : (
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          )}
          <span>{adminMsg.text}</span>
        </div>
      )}

      {/* TAB 1: EKYC PRACTITIONER VERIFICATION */}
      {activeTab === 'EKYC' && (
        <div className="space-y-6">
          {/* Pending approval queue */}
          <div className="space-y-3">
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-500" />
              Danh Sách Chờ Thẩm Định Pháp Lý CCHN ({unverifiedPractitioners.length})
            </h3>

            {unverifiedPractitioners.length === 0 ? (
              <div className="p-6 bg-white rounded-3xl border border-slate-200 text-center text-xs text-slate-500">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-1.5" />
                Tất cả hồ sơ Thầy thuốc đã được thẩm định xong!
              </div>
            ) : (
              unverifiedPractitioners.map((prac) => {
                const user = profiles.find((p) => p.id === prac.user_id);
                if (!user) return null;

                return (
                  <div
                    key={prac.id}
                    className="p-5 rounded-3xl bg-amber-50/50 border-2 border-amber-300 shadow-md space-y-3"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-900 text-base">
                            {user.full_name}
                          </span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-200 text-amber-900">
                            Chờ Phê Duyệt
                          </span>
                        </div>
                        <div className="text-xs text-slate-600 font-mono mt-0.5">
                          SĐT: {user.phone} • Chuyên khoa: {prac.specialties.join(', ')}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            onVerifyPractitioner(user.id, true);
                            setAdminMsg({
                              type: 'success',
                              text: `Đã phê duyệt CCHN cho Thầy thuốc ${user.full_name}! Tài khoản đã được kích hoạt nhận bệnh nhân.`,
                            });
                          }}
                          className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-md"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" /> Phê Duyệt Hoạt Động
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (confirm(`Từ chối hồ sơ của ${user.full_name}?`)) {
                              onVerifyPractitioner(user.id, false);
                            }
                          }}
                          className="px-3 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-xs"
                        >
                          Từ Chối
                        </button>
                      </div>
                    </div>

                    <div className="p-3 bg-white rounded-2xl border border-amber-200 text-xs grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <div className="text-slate-500 font-medium">Số Chứng Chỉ Hành Nghề:</div>
                        <div className="font-mono font-bold text-emerald-800 text-sm mt-0.5">
                          {prac.license_number}
                        </div>
                        <div className="text-slate-500 font-medium mt-1">Cơ quan cấp phép:</div>
                        <div className="font-bold text-slate-800">{prac.issued_by}</div>
                      </div>

                      <div>
                        <div className="text-slate-500 font-medium mb-1">Ảnh chụp Giấy phép hành nghề:</div>
                        {prac.license_image_url ? (
                          <div
                            onClick={() => setSelectedPhoto(prac.license_image_url)}
                            className="h-24 w-40 rounded-xl overflow-hidden border border-slate-300 cursor-pointer relative group"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={prac.license_image_url}
                              alt="Chứng chỉ"
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                            />
                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center text-white text-[10px] opacity-0 group-hover:opacity-100 transition-opacity">
                              <Eye className="w-3.5 h-3.5 mr-1" /> Phóng to
                            </div>
                          </div>
                        ) : (
                          <span className="text-rose-500 italic">Chưa tải ảnh</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Already verified list */}
          <div className="space-y-3 pt-3">
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              Thầy Thuốc Đang Hoạt Động Hợp Pháp ({verifiedPractitioners.length})
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {verifiedPractitioners.map((prac) => {
                const user = profiles.find((p) => p.id === prac.user_id);
                if (!user) return null;
                const wallet = wallets[prac.user_id];

                return (
                  <div
                    key={prac.id}
                    className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm text-xs space-y-2"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-bold text-slate-900 flex items-center gap-1">
                          {user.full_name}
                          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                        </div>
                        <div className="text-emerald-700 font-mono text-[11px] mt-0.5">
                          {prac.license_number}
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                        {prac.is_online ? 'Online' : 'Offline'}
                      </span>
                    </div>

                    <div className="p-2 bg-slate-50 rounded-xl text-[11px] space-y-1">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Ví khả dụng:</span>
                        <strong className="text-slate-800 font-mono">
                          {formatVND(wallet?.available_balance || 0)}
                        </strong>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Đang tạm giữ:</span>
                        <strong className="text-amber-600 font-mono">
                          {formatVND(wallet?.locked_balance || 0)}
                        </strong>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Chiết khấu sàn:</span>
                        <strong className="text-purple-700">{prac.commission_rate}%</strong>
                      </div>
                    </div>

                    <div className="flex justify-end gap-1.5 pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm(`Tạm khóa hoạt động của ${user.full_name}?`)) {
                            onVerifyPractitioner(user.id, false);
                          }
                        }}
                        className="text-[11px] text-rose-600 hover:text-rose-800 px-2 py-1 rounded-lg hover:bg-rose-50"
                      >
                        Tạm Khóa Hoạt Động
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: FULL VISIBILITY BOOKING MONITOR & REASSIGNMENT */}
      {activeTab === 'BOOKINGS' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <Calendar className="w-4 h-4 text-purple-700" />
              Giám Sát 100% Đơn Khám Toàn Sàn ({bookings.length})
            </h3>
            <span className="text-xs text-slate-500">Chế độ điều phối trung tâm</span>
          </div>

          <div className="space-y-3">
            {bookings.map((b) => {
              const patient = profiles.find((p) => p.id === b.patient_id);
              const doctor = profiles.find((p) => p.id === b.practitioner_id);

              return (
                <div
                  key={b.id}
                  className="p-5 rounded-3xl bg-white border border-slate-200 shadow-md space-y-3"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-xs text-slate-500">
                          {b.booking_code}
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-800">
                          {b.status}
                        </span>
                      </div>
                      <h4 className="text-sm font-bold text-slate-900 mt-0.5">{b.service_name}</h4>
                    </div>

                    <div className="text-right">
                      <div className="text-sm font-extrabold text-purple-900">
                        {formatVND(b.service_fee + b.travel_surcharge)}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        Phí sàn ({b.commission_rate}%):{' '}
                        <strong className="text-amber-700">{formatVND(b.commission_amount)}</strong>
                      </div>
                    </div>
                  </div>

                  {/* Pairwise Connection Details */}
                  <div className="p-3 bg-slate-50 rounded-2xl grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs border border-slate-100">
                    <div>
                      <span className="text-slate-500 font-medium">Bệnh nhân:</span>{' '}
                      <strong className="text-slate-900">{patient?.full_name}</strong>
                      <div className="font-mono text-slate-600">{b.patient_phone}</div>
                      <div className="text-slate-500 text-[11px] mt-0.5">{b.address}</div>
                    </div>
                    <div>
                      <span className="text-slate-500 font-medium">Thầy thuốc phụ trách:</span>{' '}
                      {doctor ? (
                        <div>
                          <strong className="text-teal-800">{doctor.full_name}</strong>
                          <div className="font-mono text-slate-600">{doctor.phone}</div>
                        </div>
                      ) : (
                        <span className="text-amber-600 font-bold block">
                          Chưa có Thầy thuốc nhận ca
                        </span>
                      )}
                    </div>
                  </div>

                  {/* 3-Part Medical record viewer for Admin audit */}
                  {b.medical_diagnosis && (
                    <div className="p-3 bg-teal-50/50 rounded-2xl border border-teal-200 text-xs space-y-1">
                      <div className="font-bold text-teal-950 flex items-center gap-1">
                        <HeartPulse className="w-3.5 h-3.5 text-teal-700" />
                        Bệnh Án 3 Mục:
                      </div>
                      <div>• Chẩn đoán: {b.medical_diagnosis}</div>
                      {b.treatment_notes && <div>• Thủ thuật & Thuốc: {b.treatment_notes}</div>}
                      {b.doctor_advice && <div>• Lời dặn: {b.doctor_advice}</div>}
                    </div>
                  )}

                  {/* Admin Dispatch Actions */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => {
                        setReassignBookingId(b.id);
                        setTargetDoctorId(b.practitioner_id || '');
                      }}
                      className="px-3 py-1.5 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-900 font-bold text-xs flex items-center gap-1 border border-purple-200"
                    >
                      <ArrowRightLeft className="w-3.5 h-3.5" /> Điều Phối / Đổi Thầy Thuốc
                    </button>

                    {b.status !== 'COMPLETED' && !b.status.startsWith('CANCELLED') && (
                      <button
                        type="button"
                        onClick={() => {
                          if (
                            confirm(
                              'Admin hủy ca khám này? Tiền tạm giữ (nếu có) sẽ được HOÀN TRẢ 100% cho Thầy thuốc (Không phạt cọc).'
                            )
                          ) {
                            onCancelBookingByAdmin(b.id);
                            setAdminMsg({
                              type: 'success',
                              text: `Đã hủy đơn ${b.booking_code} và hoàn trả 100% phí tạm giữ cho Thầy thuốc.`,
                            });
                          }
                        }}
                        className="px-3 py-1.5 rounded-xl text-rose-600 hover:bg-rose-50 text-xs font-semibold flex items-center gap-1"
                      >
                        <XCircle className="w-3.5 h-3.5" /> Hủy Đơn & Hoàn Phí Tạm Giữ
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 3: USER MANAGEMENT & RESET PASSWORD */}
      {activeTab === 'USERS' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <Users className="w-4 h-4 text-purple-700" />
              Quản Lý Tài Khoản Toàn Hệ Thống ({profiles.length})
            </h3>
          </div>

          <div className="bg-white rounded-3xl border border-slate-200 shadow-md divide-y divide-slate-100 overflow-hidden">
            {profiles.map((user) => {
              const prac = practitioners[user.id];
              const wallet = wallets[user.id];

              return (
                <div
                  key={user.id}
                  className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <strong className="text-sm text-slate-900">{user.full_name}</strong>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          user.role === 'ADMIN'
                            ? 'bg-purple-100 text-purple-900'
                            : user.role === 'PRACTITIONER'
                            ? 'bg-teal-100 text-teal-900'
                            : 'bg-emerald-100 text-emerald-900'
                        }`}
                      >
                        {user.role}
                      </span>
                    </div>
                    <div className="text-slate-500 font-mono mt-0.5">
                      SĐT: {user.phone} • MK: {user.password_hash}
                    </div>
                    {user.default_address && (
                      <div className="text-slate-500 text-[11px] mt-0.5">{user.default_address}</div>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {/* Add funds to wallet for practitioner */}
                    {user.role === 'PRACTITIONER' && (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            onAdjustWallet(user.id, 200000);
                            setAdminMsg({
                              type: 'success',
                              text: `Đã cộng 200.000đ vào Ví của ${user.full_name}`,
                            });
                          }}
                          className="px-2.5 py-1.5 rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 font-bold text-[11px]"
                        >
                          +200k Ví
                        </button>
                      </div>
                    )}

                    {/* Reset Password Button */}
                    <button
                      type="button"
                      onClick={() => {
                        onResetPassword(user.id);
                        setAdminMsg({
                          type: 'success',
                          text: `Đã reset mật khẩu của ${user.full_name} về '123456'!`,
                        });
                      }}
                      className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] flex items-center gap-1"
                    >
                      <KeyRound className="w-3 h-3 text-slate-500" />
                      Reset MK (123456)
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 4: REVENUE & ESCROW AUDITING (GRAB MODEL) */}
      {activeTab === 'REVENUE' && (
        <div className="space-y-4">
          <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-emerald-600" />
            Đối Soát & Sổ Cái Chiết Khấu Sàn
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-4 bg-white rounded-3xl border border-slate-200 shadow-sm text-xs">
              <span className="text-slate-500">Tổng doanh thu dịch vụ:</span>
              <div className="text-xl font-black text-slate-900 mt-1">
                {formatVND(totalGrossRevenue)}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">Tiền mặt khách trả thầy thuốc</div>
            </div>

            <div className="p-4 bg-white rounded-3xl border border-slate-200 shadow-sm text-xs">
              <span className="text-slate-500">Phí sàn quyết toán (Grab 15%):</span>
              <div className="text-xl font-black text-purple-700 mt-1">
                {formatVND(totalPlatformFees)}
              </div>
              <div className="text-[10px] text-purple-400 mt-0.5">Admin đã khấu trừ vĩnh viễn</div>
            </div>

            <div className="p-4 bg-white rounded-3xl border border-slate-200 shadow-sm text-xs">
              <span className="text-slate-500">Tổng tiền đang tạm giữ (Escrow):</span>
              <div className="text-xl font-black text-amber-600 mt-1">
                {formatVND(
                  Object.values(wallets).reduce((sum, w) => sum + w.locked_balance, 0)
                )}
              </div>
              <div className="text-[10px] text-amber-500 mt-0.5">Đang khóa an toàn cho các ca</div>
            </div>
          </div>

          {/* Audit ledger of recent transactions */}
          <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-md space-y-3">
            <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">
              Nhật Ký Biến Động Sàn Toàn Bộ
            </h4>
            <div className="divide-y divide-slate-100 text-xs">
              {transactions.map((tx) => (
                <div key={tx.id} className="py-2.5 flex items-center justify-between">
                  <div>
                    <div className="font-bold text-slate-800">{tx.description}</div>
                    <div className="text-[10px] text-slate-400 font-mono">
                      {formatDateTime(tx.created_at)}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-purple-900">{formatVND(tx.amount)}</span>
                    <span className="block text-[10px] text-slate-400 uppercase">{tx.type}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* DISPATCH / REASSIGN MODAL */}
      {reassignBookingId && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-5 space-y-4 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-black text-slate-900 uppercase">
                Điều Phối / Đổi Thầy Thuốc
              </h4>
              <button
                type="button"
                onClick={() => setReassignBookingId(null)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Chọn Thầy thuốc đã được duyệt CCHN để điều phối lại ca khám này:
            </p>

            <select
              value={targetDoctorId}
              onChange={(e) => setTargetDoctorId(e.target.value)}
              className="w-full p-2.5 rounded-xl bg-slate-50 border border-slate-300 text-xs font-medium text-slate-800"
            >
              <option value="">-- Để trống (Phát đơn tự do) --</option>
              {verifiedPractitioners.map((prac) => {
                const u = profiles.find((p) => p.id === prac.user_id);
                return (
                  <option key={prac.id} value={prac.user_id}>
                    {u?.full_name} ({prac.license_number})
                  </option>
                );
              })}
            </select>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setReassignBookingId(null)}
                className="flex-1 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={() => {
                  onReassignDoctor(reassignBookingId, targetDoctorId);
                  setReassignBookingId(null);
                  setAdminMsg({
                    type: 'success',
                    text: 'Đã điều phối và gán lại Thầy thuốc phụ trách thành công!',
                  });
                }}
                className="flex-1 py-2 rounded-xl bg-purple-700 hover:bg-purple-800 text-white font-bold text-xs shadow-md"
              >
                Xác Nhận Đổi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PHOTO PREVIEW MODAL */}
      {selectedPhoto && (
        <div
          onClick={() => setSelectedPhoto(null)}
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 cursor-pointer"
        >
          <div className="max-w-xl max-h-[85vh] bg-white rounded-3xl overflow-hidden p-2 shadow-2xl">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={selectedPhoto}
              alt="Giấy phép phóng to"
              className="max-h-[80vh] w-auto mx-auto object-contain rounded-2xl"
            />
          </div>
        </div>
      )}
    </div>
  );
}
