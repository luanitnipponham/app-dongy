'use client';

import React, { useState } from 'react';
import {
  LogOut,
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
  UserPlus,
  Pencil,
  Trash2,
  Plus,
  Lock,
  User,
  Shield,
  Check,
  X,
  Sparkles,
  Clock,
  FileText,
} from 'lucide-react';
import {
  Profile,
  PractitionerProfile,
  Booking,
  Wallet,
  WalletTransaction,
  UserRole,
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
  onCancelBookingByAdmin: (
    bookingId: string,
    reason?: string
  ) => Promise<{ success: boolean; message?: string } | boolean | void> | void;
  onResetPassword: (
    userId: string,
    newPassword?: string
  ) => Promise<{ success: boolean; message?: string }> | void;
  onAdjustWallet: (userId: string, amount: number) => void;
  onUpdateCommissionRate: (userId: string, newRate: number) => void;
  onCreateUser?: (data: {
    profile: Omit<Profile, 'id' | 'created_at' | 'updated_at'>;
    practitioner?: Partial<PractitionerProfile>;
    initialBalance?: number;
  }) => Promise<{ success: boolean; message?: string }>;
  onUpdateUser?: (
    userId: string,
    data: {
      profile: Partial<Profile>;
      practitioner?: Partial<PractitionerProfile>;
    }
  ) => Promise<{ success: boolean; message?: string }>;
  onDeleteUser?: (userId: string) => Promise<{ success: boolean; message?: string }>;
  onLogout?: () => void;
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
  onCreateUser,
  onUpdateUser,
  onDeleteUser,
  onLogout,
}: AdminViewProps) {
  const [activeTab, setActiveTab] = useState<'EKYC' | 'BOOKINGS' | 'USERS' | 'REVENUE'>('EKYC');
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const [adminMsg, setAdminMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Reassign modal state
  const [reassignBookingId, setReassignBookingId] = useState<string | null>(null);
  const [targetDoctorId, setTargetDoctorId] = useState<string>('');

  // User Management state
  const [searchUser, setSearchUser] = useState<string>('');
  const [filterRole, setFilterRole] = useState<'ALL' | 'PATIENT' | 'PRACTITIONER' | 'ADMIN'>('ALL');
  const [showPasswordMap, setShowPasswordMap] = useState<Record<string, boolean>>({});

  // Create User modal state
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [createForm, setCreateForm] = useState({
    fullName: '',
    phone: '',
    password: '123456',
    role: 'PATIENT' as UserRole,
    address: '',
    cchnNumber: '',
    issuedBy: 'Sở Y Tế TP.HCM',
    experienceYears: 5,
    specialties: 'Châm cứu, Xoa bóp bấm huyệt',
    isVerified: true,
    initialBalance: 500000,
  });

  // Edit User modal state
  const [editingUser, setEditingUser] = useState<Profile | null>(null);
  const [editForm, setEditForm] = useState({
    fullName: '',
    phone: '',
    password: '',
    role: 'PATIENT' as UserRole,
    address: '',
    isActive: true,
    cchnNumber: '',
    issuedBy: '',
    experienceYears: 5,
    specialties: '',
    isVerified: true,
    commissionRate: 15,
  });

  // Reset Password modal state
  const [resetModalUser, setResetModalUser] = useState<Profile | null>(null);
  const [customPassword, setCustomPassword] = useState<string>('');

  // Delete User modal state
  const [deletingUser, setDeletingUser] = useState<Profile | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [modalError, setModalError] = useState<string | null>(null);

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

  // Filtered profiles for User Management tab
  const filteredProfiles: Profile[] = profiles.filter((u) => {
    const matchRole = filterRole === 'ALL' || u.role === filterRole;
    const term = searchUser.trim().toLowerCase();
    const matchSearch =
      !term ||
      u.full_name.toLowerCase().includes(term) ||
      u.phone.includes(term) ||
      (u.default_address && u.default_address.toLowerCase().includes(term));
    return matchRole && matchSearch;
  });

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
          <div className="flex flex-col items-end gap-2 shrink-0">
            <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center border border-white/20">
              <ShieldCheck className="w-7 h-7 text-purple-300" />
            </div>
            {onLogout && (
              <button
                type="button"
                onClick={onLogout}
                className="px-3 py-1 rounded-xl bg-white/15 hover:bg-rose-500/80 text-white text-xs font-bold transition-all flex items-center gap-1.5 border border-white/20 shadow-xs"
                title="Đăng xuất"
              >
                <LogOut className="w-3.5 h-3.5 text-rose-300" />
                <span>Đăng xuất</span>
              </button>
            )}
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
                        {b.status === 'CANCELLED_DOCTOR' ? (
                          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-rose-100 text-rose-800 border border-rose-300 flex items-center gap-1">
                            <ShieldAlert className="w-3.5 h-3.5 text-rose-600" /> Bác Sĩ / Thầy Thuốc Hủy Ca
                          </span>
                        ) : b.status === 'CANCELLED_PATIENT' ? (
                          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1">
                            <XCircle className="w-3.5 h-3.5 text-amber-700" /> Bệnh Nhân Hủy Ca
                          </span>
                        ) : b.status === 'COMPLETED' ? (
                          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            Đã Hoàn Tất
                          </span>
                        ) : b.status === 'CONFIRMED' ? (
                          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
                            Đã Nhận Ca
                          </span>
                        ) : b.status === 'ON_THE_WAY' ? (
                          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">
                            Đang Di Chuyển
                          </span>
                        ) : b.status === 'IN_PROGRESS' ? (
                          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-teal-100 text-teal-800 border border-teal-200">
                            Đang Khám
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-800">
                            {b.status}
                          </span>
                        )}
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

                  {/* THÔNG TIN CHI TIẾT HỦY LỊCH (NGÀY/THÁNG/NĂM, GIỜ/PHÚT & LÝ DO HỦY CA) */}
                  {b.status.startsWith('CANCELLED') && (
                    <div className="p-3.5 rounded-2xl bg-rose-50/90 border-2 border-rose-300 text-xs space-y-2.5 shadow-xs">
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-rose-200/80 pb-2">
                        <div className="flex items-center gap-1.5 font-black text-rose-900 text-xs sm:text-sm">
                          <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
                          <span>
                            {b.status === 'CANCELLED_DOCTOR'
                              ? 'ĐƠN HỦY BỞI BÁC SĨ / THẦY THUỐC'
                              : 'ĐƠN HỦY BỞI BỆNH NHÂN'}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 font-bold text-slate-800 bg-white px-2.5 py-1 rounded-xl border border-rose-300 text-[11px] shadow-xs">
                          <Clock className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                          <span>Thời điểm hủy:</span>
                          <span className="font-mono text-rose-700 font-extrabold">
                            {formatDateTime(b.cancelled_at || b.updated_at)}
                          </span>
                        </div>
                      </div>

                      {/* Ghi chú lý do hủy của Bác sĩ / Bệnh nhân */}
                      <div className="bg-white p-3 rounded-xl border border-rose-200 space-y-1">
                        <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 uppercase tracking-wide">
                          <span className="flex items-center gap-1 text-slate-800">
                            <FileText className="w-3.5 h-3.5 text-rose-600" />
                            {b.status === 'CANCELLED_DOCTOR'
                              ? 'Lý do & Ghi chú của Bác sĩ / Thầy thuốc:'
                              : 'Lý do Bệnh nhân hủy lịch:'}
                          </span>
                          {b.status === 'CANCELLED_DOCTOR' && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                              Bảo vệ an toàn Thầy thuốc
                            </span>
                          )}
                        </div>
                        <p className="text-slate-900 font-semibold text-xs leading-relaxed pl-1 pt-0.5 italic">
                          "{b.cancel_reason ||
                            (b.status === 'CANCELLED_DOCTOR'
                              ? 'Thầy thuốc báo bận / Nghi vấn bệnh nhân có dấu hiệu bất thường, hủy ca bảo vệ bản thân.'
                              : 'Bệnh nhân có việc bận đột xuất / thay đổi kế hoạch.')}"
                        </p>
                      </div>

                      {/* Đối soát trạng thái ví tiền */}
                      <div className="flex flex-wrap items-center justify-between gap-1 text-[11px] text-emerald-900 font-semibold px-1 pt-0.5">
                        <span className="flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          Đã hoàn trả 100% phí tạm giữ ({formatVND(b.commission_amount)}) về ví Thầy thuốc
                        </span>
                        <span className="text-slate-600 font-medium">✓ Không phạt cọc</span>
                      </div>
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
                        onClick={async () => {
                          const adminReason = prompt(
                            `XÁC NHẬN HỦY ĐƠN [${b.booking_code}]:\n\nTiền tạm giữ (nếu có) sẽ được HOÀN TRẢ 100% cho Thầy thuốc (Không phạt cọc).\n\nVui lòng nhập lý do Admin hủy ca:`,
                            'Admin điều phối hủy theo yêu cầu'
                          );
                          if (adminReason !== null) {
                            await onCancelBookingByAdmin(b.id, adminReason.trim() || 'Admin điều phối hủy');
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
          {/* Action Header & Search */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <Users className="w-4 h-4 text-purple-700" />
                Quản Lý Tài Khoản Toàn Hệ Thống ({filteredProfiles.length}/{profiles.length})
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Toàn quyền thêm mới, cập nhật hồ sơ, đổi mật khẩu và xóa tài khoản.
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                setCreateForm({
                  fullName: '',
                  phone: '',
                  password: '123456',
                  role: 'PATIENT',
                  address: '',
                  cchnNumber: '',
                  issuedBy: 'Sở Y Tế TP.HCM',
                  experienceYears: 5,
                  specialties: 'Châm cứu, Xoa bóp bấm huyệt',
                  isVerified: true,
                  initialBalance: 500000,
                });
                setModalError(null);
                setShowCreateModal(true);
              }}
              className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-purple-700 to-indigo-600 hover:from-purple-800 hover:to-indigo-700 text-white font-bold text-xs shadow-md shadow-purple-900/20 flex items-center justify-center gap-1.5 transition-all cursor-pointer shrink-0"
            >
              <UserPlus className="w-4 h-4" />
              + Thêm Tài Khoản Mới
            </button>
          </div>

          {/* Search & Filter Bar */}
          <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchUser}
                onChange={(e) => setSearchUser(e.target.value)}
                placeholder="Tìm theo tên, số điện thoại, địa chỉ..."
                className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 focus:outline-none focus:border-purple-500"
              />
              {searchUser && (
                <button
                  type="button"
                  onClick={() => setSearchUser('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Role Filter Chips */}
            <div className="flex items-center gap-1 overflow-x-auto text-[11px] font-bold">
              <button
                type="button"
                onClick={() => setFilterRole('ALL')}
                className={`px-2.5 py-1 rounded-xl transition-all ${
                  filterRole === 'ALL'
                    ? 'bg-purple-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Tất cả ({profiles.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterRole('PATIENT')}
                className={`px-2.5 py-1 rounded-xl transition-all ${
                  filterRole === 'PATIENT'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                }`}
              >
                Bệnh nhân ({profiles.filter((p) => p.role === 'PATIENT').length})
              </button>
              <button
                type="button"
                onClick={() => setFilterRole('PRACTITIONER')}
                className={`px-2.5 py-1 rounded-xl transition-all ${
                  filterRole === 'PRACTITIONER'
                    ? 'bg-teal-700 text-white'
                    : 'bg-teal-50 text-teal-800 hover:bg-teal-100'
                }`}
              >
                Thầy thuốc ({profiles.filter((p) => p.role === 'PRACTITIONER').length})
              </button>
              <button
                type="button"
                onClick={() => setFilterRole('ADMIN')}
                className={`px-2.5 py-1 rounded-xl transition-all ${
                  filterRole === 'ADMIN'
                    ? 'bg-purple-700 text-white'
                    : 'bg-purple-50 text-purple-800 hover:bg-purple-100'
                }`}
              >
                Admin ({profiles.filter((p) => p.role === 'ADMIN').length})
              </button>
            </div>
          </div>

          {/* User List */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-md divide-y divide-slate-100 overflow-hidden">
            {filteredProfiles.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">
                Không tìm thấy người dùng nào phù hợp với điều kiện tìm kiếm.
              </div>
            ) : (
              filteredProfiles.map((user) => {
                const prac = practitioners[user.id];
                const wallet = wallets[user.id];
                const isPasswordShown = !!showPasswordMap[user.id];

                return (
                  <div
                    key={user.id}
                    className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs hover:bg-slate-50/60 transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      {/* Avatar initial */}
                      <div
                        className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black text-sm shrink-0 shadow-xs ${
                          user.role === 'ADMIN'
                            ? 'bg-purple-100 text-purple-900 border border-purple-200'
                            : user.role === 'PRACTITIONER'
                            ? 'bg-teal-100 text-teal-900 border border-teal-200'
                            : 'bg-emerald-100 text-emerald-900 border border-emerald-200'
                        }`}
                      >
                        {user.full_name ? user.full_name.charAt(0).toUpperCase() : 'U'}
                      </div>

                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <strong className="text-sm font-extrabold text-slate-900">
                            {user.full_name}
                          </strong>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                              user.role === 'ADMIN'
                                ? 'bg-purple-100 text-purple-900 border border-purple-200'
                                : user.role === 'PRACTITIONER'
                                ? 'bg-teal-100 text-teal-900 border border-teal-200'
                                : 'bg-emerald-100 text-emerald-900 border border-emerald-200'
                            }`}
                          >
                            {user.role === 'PATIENT' ? 'Bệnh nhân' : user.role === 'PRACTITIONER' ? 'Thầy thuốc' : 'Admin'}
                          </span>

                          {user.is_active === false && (
                            <span className="px-1.5 py-0.2 rounded-full bg-rose-100 text-rose-800 text-[10px] font-bold">
                              Tạm khóa
                            </span>
                          )}

                          {user.id === currentUser.id && (
                            <span className="px-1.5 py-0.2 rounded-full bg-amber-100 text-amber-900 text-[10px] font-bold">
                              Bạn đang đăng nhập
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-slate-500 font-mono text-[11px]">
                          <span className="flex items-center gap-1 text-slate-700 font-bold">
                            <Phone className="w-3 h-3 text-slate-400" />
                            {user.phone}
                          </span>
                          <span className="flex items-center gap-1">
                            <Lock className="w-3 h-3 text-slate-400" />
                            MK:{' '}
                            <span className="font-bold text-slate-800">
                              {isPasswordShown ? user.password_hash : '••••••'}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                setShowPasswordMap((prev) => ({
                                  ...prev,
                                  [user.id]: !prev[user.id],
                                }))
                              }
                              className="text-slate-400 hover:text-slate-600 p-0.5 ml-0.5"
                              title={isPasswordShown ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                            >
                              <Eye className="w-3 h-3" />
                            </button>
                          </span>
                        </div>

                        {user.default_address && (
                          <div className="text-slate-500 text-[11px] line-clamp-1">
                            📍 {user.default_address}
                          </div>
                        )}

                        {/* Practitioner metadata if applicable */}
                        {user.role === 'PRACTITIONER' && prac && (
                          <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px]">
                            <span className="px-2 py-0.5 rounded-lg bg-slate-100 text-slate-700 font-mono font-bold border border-slate-200">
                              CCHN: {prac.license_number}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded-lg font-bold border ${
                                prac.is_verified
                                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                  : 'bg-amber-50 text-amber-900 border-amber-200'
                              }`}
                            >
                              {prac.is_verified ? '✓ Đã duyệt CCHN' : '⏳ Chờ duyệt CCHN'}
                            </span>
                            {wallet && (
                              <span className="px-2 py-0.5 rounded-lg bg-teal-50 text-teal-800 font-bold border border-teal-200">
                                Ví: {formatVND(wallet.available_balance)}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Actions toolbar */}
                    <div className="flex flex-wrap items-center gap-1.5 self-end md:self-center shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100 w-full md:w-auto justify-end">
                      {/* Top-up wallet for practitioner */}
                      {user.role === 'PRACTITIONER' && (
                        <button
                          type="button"
                          onClick={() => {
                            onAdjustWallet(user.id, 200000);
                            setAdminMsg({
                              type: 'success',
                              text: `Đã cộng 200.000đ vào Ví của ${user.full_name}`,
                            });
                          }}
                          className="px-2.5 py-1.5 rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 font-bold text-[11px] flex items-center gap-1 cursor-pointer transition-colors"
                          title="Cộng nhanh 200.000đ vào ví"
                        >
                          <CreditCard className="w-3 h-3" />
                          +200k Ví
                        </button>
                      )}

                      {/* Edit Button */}
                      <button
                        type="button"
                        onClick={() => {
                          const p = practitioners[user.id];
                          setModalError(null);
                          setEditingUser(user);
                          setEditForm({
                            fullName: user.full_name,
                            phone: user.phone,
                            password: user.password_hash,
                            role: user.role,
                            address: user.default_address || '',
                            isActive: user.is_active ?? true,
                            cchnNumber: p?.license_number || '',
                            issuedBy: p?.issued_by || 'Sở Y Tế',
                            experienceYears: p?.years_of_experience || 5,
                            specialties: p?.specialties ? p.specialties.join(', ') : '',
                            isVerified: p?.is_verified ?? true,
                            commissionRate: p?.commission_rate || 15,
                          });
                        }}
                        className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] flex items-center gap-1 cursor-pointer transition-colors"
                        title="Chỉnh sửa thông tin"
                      >
                        <Pencil className="w-3 h-3 text-slate-500" />
                        Sửa
                      </button>

                      {/* Reset Password Button */}
                      <button
                        type="button"
                        onClick={() => {
                          setModalError(null);
                          setResetModalUser(user);
                          setCustomPassword('');
                        }}
                        className="px-2.5 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 font-bold text-[11px] flex items-center gap-1 cursor-pointer transition-colors"
                        title="Đặt lại mật khẩu"
                      >
                        <KeyRound className="w-3 h-3 text-amber-600" />
                        Reset MK
                      </button>

                      {/* Delete Button (safe check) */}
                      {user.id !== currentUser.id && (
                        <button
                          type="button"
                          onClick={() => {
                            setModalError(null);
                            setDeletingUser(user);
                          }}
                          className="px-2.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-[11px] flex items-center gap-1 cursor-pointer transition-colors"
                          title="Xóa tài khoản"
                        >
                          <Trash2 className="w-3 h-3 text-rose-600" />
                          Xóa
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
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

      {/* 1. MODAL TẠO MỚI TÀI KHOẢN */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in-95 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-800 flex items-center justify-center font-bold">
                  <UserPlus className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-extrabold text-slate-900 uppercase">
                    Thêm Người Dùng Mới
                  </h4>
                  <p className="text-[11px] text-slate-500">Khởi tạo tài khoản và phân quyền hệ thống</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-slate-600 font-bold text-sm p-1"
              >
                ✕
              </button>
            </div>

            {modalError && (
              <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-300 text-rose-800 text-xs font-bold flex items-start gap-2.5 animate-in fade-in">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
                <span>{modalError}</span>
              </div>
            )}

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setModalError(null);
                if (!createForm.fullName.trim() || !createForm.phone.trim()) {
                  setModalError('Vui lòng nhập đầy đủ Họ tên và Số điện thoại!');
                  return;
                }

                setIsSubmitting(true);
                try {
                  if (onCreateUser) {
                    const res = await onCreateUser({
                      profile: {
                        phone: createForm.phone.trim(),
                        password_hash: createForm.password.trim() || '123456',
                        full_name: createForm.fullName.trim(),
                        avatar_url: null,
                        default_address: createForm.address.trim() || null,
                        role: createForm.role,
                        is_active: true,
                      },
                      practitioner:
                        createForm.role === 'PRACTITIONER'
                          ? {
                              license_number:
                                createForm.cchnNumber.trim() ||
                                'CCHN-' + Math.floor(1000 + Math.random() * 9000),
                              issued_by: createForm.issuedBy.trim() || 'Sở Y Tế TP.HCM',
                              years_of_experience: Number(createForm.experienceYears) || 5,
                              specialties: createForm.specialties
                                ? createForm.specialties.split(',').map((s) => s.trim())
                                : ['Châm cứu', 'Xoa bóp'],
                              is_verified: createForm.isVerified,
                            }
                          : undefined,
                      initialBalance: createForm.initialBalance,
                    });

                    if (res.success) {
                      setAdminMsg({ type: 'success', text: res.message || 'Thêm tài khoản thành công!' });
                      setShowCreateModal(false);
                      setModalError(null);
                    } else {
                      setModalError(res.message || 'Có lỗi xảy ra khi tạo tài khoản!');
                      setAdminMsg({ type: 'error', text: res.message || 'Có lỗi xảy ra khi tạo tài khoản!' });
                    }
                  }
                } finally {
                  setIsSubmitting(false);
                }
              }}
              className="space-y-3.5 text-xs"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Họ và Tên <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={createForm.fullName}
                    onChange={(e) => setCreateForm({ ...createForm, fullName: e.target.value })}
                    placeholder="VD: Nguyễn Văn Nam"
                    className="w-full p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-900 focus:outline-none focus:border-purple-600"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Số Điện Thoại <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="tel"
                    required
                    value={createForm.phone}
                    onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })}
                    placeholder="VD: 0988111222"
                    className="w-full p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono font-semibold text-slate-900 focus:outline-none focus:border-purple-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Mật Khẩu Khởi Tạo</label>
                  <input
                    type="text"
                    value={createForm.password}
                    onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                    placeholder="Mặc định: 123456"
                    className="w-full p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono font-semibold text-slate-900 focus:outline-none focus:border-purple-600"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Vai Trò (Role) <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={createForm.role}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, role: e.target.value as UserRole })
                    }
                    className="w-full p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:border-purple-600"
                  >
                    <option value="PATIENT">Bệnh nhân (PATIENT)</option>
                    <option value="PRACTITIONER">Thầy thuốc / Bác sĩ (PRACTITIONER)</option>
                    <option value="ADMIN">Quản trị viên (ADMIN)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Địa Chỉ Mặc Định</label>
                <input
                  type="text"
                  value={createForm.address}
                  onChange={(e) => setCreateForm({ ...createForm, address: e.target.value })}
                  placeholder="VD: 123 Nguyễn Huệ, Phường Bến Nghé, Quận 1, TP.HCM"
                  className="w-full p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-purple-600"
                />
              </div>

              {/* Chi tiết bổ sung nếu là Thầy thuốc */}
              {createForm.role === 'PRACTITIONER' && (
                <div className="p-3.5 bg-teal-50/70 border border-teal-200 rounded-2xl space-y-3 mt-2">
                  <div className="font-extrabold text-teal-900 text-xs flex items-center gap-1.5">
                    <FileBadge className="w-3.5 h-3.5 text-teal-700" />
                    Thông Tin Pháp Lý Thầy Thuốc (CCHN & Ví):
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="block font-bold text-teal-800 text-[11px] mb-1">
                        Số Chứng Chỉ Hành Nghề (CCHN)
                      </label>
                      <input
                        type="text"
                        value={createForm.cchnNumber}
                        onChange={(e) =>
                          setCreateForm({ ...createForm, cchnNumber: e.target.value })
                        }
                        placeholder="VD: CCHN-2026-8888"
                        className="w-full p-2 rounded-lg bg-white border border-teal-200 text-xs font-mono font-bold text-slate-800"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-teal-800 text-[11px] mb-1">
                        Cơ Quan Cấp CCHN
                      </label>
                      <input
                        type="text"
                        value={createForm.issuedBy}
                        onChange={(e) => setCreateForm({ ...createForm, issuedBy: e.target.value })}
                        placeholder="VD: Sở Y Tế TP.HCM"
                        className="w-full p-2 rounded-lg bg-white border border-teal-200 text-xs text-slate-800"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="block font-bold text-teal-800 text-[11px] mb-1">
                        Năm Kinh Nghiệm
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="50"
                        value={createForm.experienceYears}
                        onChange={(e) =>
                          setCreateForm({ ...createForm, experienceYears: Number(e.target.value) })
                        }
                        className="w-full p-2 rounded-lg bg-white border border-teal-200 text-xs font-bold text-slate-800"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-teal-800 text-[11px] mb-1">
                        Nạp Ví Ban Đầu (VNĐ)
                      </label>
                      <input
                        type="number"
                        step="50000"
                        value={createForm.initialBalance}
                        onChange={(e) =>
                          setCreateForm({ ...createForm, initialBalance: Number(e.target.value) })
                        }
                        className="w-full p-2 rounded-lg bg-white border border-teal-200 text-xs font-bold text-slate-800 font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold text-teal-800 text-[11px] mb-1">
                      Chuyên Khoa / Kỹ Thuật (cách nhau dấu phẩy)
                    </label>
                    <input
                      type="text"
                      value={createForm.specialties}
                      onChange={(e) =>
                        setCreateForm({ ...createForm, specialties: e.target.value })
                      }
                      placeholder="Châm cứu, Xoa bóp bấm huyệt, Phục hồi chức năng..."
                      className="w-full p-2 rounded-lg bg-white border border-teal-200 text-xs text-slate-800"
                    />
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="checkbox"
                      id="create_is_verified"
                      checked={createForm.isVerified}
                      onChange={(e) =>
                        setCreateForm({ ...createForm, isVerified: e.target.checked })
                      }
                      className="w-4 h-4 rounded text-teal-600 cursor-pointer"
                    />
                    <label
                      htmlFor="create_is_verified"
                      className="text-xs font-bold text-teal-900 cursor-pointer"
                    >
                      Duyệt sẵn CCHN ngay (Sẵn sàng nhận ca khám)
                    </label>
                  </div>
                </div>
              )}

              <div className="flex gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 py-2.5 rounded-xl font-bold text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  Hủy Bỏ
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-2.5 rounded-xl bg-purple-700 hover:bg-purple-800 text-white font-bold shadow-md shadow-purple-900/20 flex items-center justify-center gap-1.5 transition-all"
                >
                  <Plus className="w-4 h-4" />
                  {isSubmitting ? 'Đang tạo...' : 'Tạo Tài Khoản'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. MODAL CẬP NHẬT / SỬA THÔNG TIN NGƯỜI DÙNG */}
      {editingUser && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in-95 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold">
                  <Pencil className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-extrabold text-slate-900 uppercase">
                    Cập Nhật Người Dùng
                  </h4>
                  <p className="text-[11px] text-slate-500 font-mono">ID: {editingUser.id}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEditingUser(null);
                  setModalError(null);
                }}
                className="text-slate-400 hover:text-slate-600 font-bold text-sm p-1"
              >
                ✕
              </button>
            </div>

            {modalError && (
              <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-300 text-rose-800 text-xs font-bold flex items-start gap-2.5 animate-in fade-in">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
                <span>{modalError}</span>
              </div>
            )}

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setModalError(null);
                if (!editForm.fullName.trim() || !editForm.phone.trim()) {
                  setModalError('Họ tên và Số điện thoại không được để trống!');
                  return;
                }

                setIsSubmitting(true);
                try {
                  if (onUpdateUser) {
                    const res = await onUpdateUser(editingUser.id, {
                      profile: {
                        full_name: editForm.fullName.trim(),
                        phone: editForm.phone.trim(),
                        password_hash: editForm.password.trim() || editingUser.password_hash,
                        role: editForm.role,
                        default_address: editForm.address.trim() || null,
                        is_active: editForm.isActive,
                      },
                      practitioner:
                        editForm.role === 'PRACTITIONER'
                          ? {
                              license_number: editForm.cchnNumber.trim(),
                              issued_by: editForm.issuedBy.trim(),
                              years_of_experience: Number(editForm.experienceYears) || 5,
                              commission_rate: Number(editForm.commissionRate) || 15,
                              specialties: editForm.specialties
                                ? editForm.specialties.split(',').map((s) => s.trim())
                                : [],
                              is_verified: editForm.isVerified,
                            }
                          : undefined,
                    });

                    if (res.success) {
                      setAdminMsg({ type: 'success', text: res.message || 'Cập nhật thành công!' });
                      setEditingUser(null);
                      setModalError(null);
                    } else {
                      setModalError(res.message || 'Cập nhật thất bại!');
                      setAdminMsg({ type: 'error', text: res.message || 'Cập nhật thất bại!' });
                    }
                  }
                } finally {
                  setIsSubmitting(false);
                }
              }}
              className="space-y-3.5 text-xs"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Họ và Tên</label>
                  <input
                    type="text"
                    required
                    value={editForm.fullName}
                    onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })}
                    className="w-full p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-900 focus:outline-none focus:border-purple-600"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Số Điện Thoại</label>
                  <input
                    type="tel"
                    required
                    value={editForm.phone}
                    onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                    className="w-full p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono font-semibold text-slate-900 focus:outline-none focus:border-purple-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Mật Khẩu</label>
                  <input
                    type="text"
                    value={editForm.password}
                    onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                    className="w-full p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono font-semibold text-slate-900 focus:outline-none focus:border-purple-600"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Vai Trò</label>
                  <select
                    value={editForm.role}
                    onChange={(e) =>
                      setEditForm({ ...editForm, role: e.target.value as UserRole })
                    }
                    className="w-full p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:border-purple-600"
                  >
                    <option value="PATIENT">Bệnh nhân (PATIENT)</option>
                    <option value="PRACTITIONER">Thầy thuốc / Bác sĩ (PRACTITIONER)</option>
                    <option value="ADMIN">Quản trị viên (ADMIN)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Địa Chỉ</label>
                <input
                  type="text"
                  value={editForm.address}
                  onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                  className="w-full p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-purple-600"
                />
              </div>

              <div className="flex items-center gap-2 py-1">
                <input
                  type="checkbox"
                  id="edit_is_active"
                  checked={editForm.isActive}
                  onChange={(e) => setEditForm({ ...editForm, isActive: e.target.checked })}
                  className="w-4 h-4 rounded text-purple-600 cursor-pointer"
                />
                <label
                  htmlFor="edit_is_active"
                  className="text-xs font-bold text-slate-800 cursor-pointer"
                >
                  Tài khoản đang hoạt động bình thường (bỏ chọn để Tạm khóa)
                </label>
              </div>

              {/* Thông tin thêm nếu là Practitioner */}
              {(editForm.role === 'PRACTITIONER' || practitioners[editingUser.id]) && (
                <div className="p-3.5 bg-teal-50/70 border border-teal-200 rounded-2xl space-y-2.5 mt-2">
                  <div className="font-extrabold text-teal-900 text-xs">
                    Thông Tin Hồ Sơ Thầy Thuốc:
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="block font-bold text-teal-800 text-[11px] mb-1">Số CCHN</label>
                      <input
                        type="text"
                        value={editForm.cchnNumber}
                        onChange={(e) => setEditForm({ ...editForm, cchnNumber: e.target.value })}
                        className="w-full p-2 rounded-lg bg-white border border-teal-200 text-xs font-mono font-bold"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-teal-800 text-[11px] mb-1">Cơ Quan Cấp</label>
                      <input
                        type="text"
                        value={editForm.issuedBy}
                        onChange={(e) => setEditForm({ ...editForm, issuedBy: e.target.value })}
                        className="w-full p-2 rounded-lg bg-white border border-teal-200 text-xs"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="block font-bold text-teal-800 text-[11px] mb-1">Năm Kinh Nghiệm</label>
                      <input
                        type="number"
                        value={editForm.experienceYears}
                        onChange={(e) =>
                          setEditForm({ ...editForm, experienceYears: Number(e.target.value) })
                        }
                        className="w-full p-2 rounded-lg bg-white border border-teal-200 text-xs font-bold"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-teal-800 text-[11px] mb-1">Chiết Khấu Sàn (%)</label>
                      <input
                        type="number"
                        min="0"
                        max="50"
                        value={editForm.commissionRate}
                        onChange={(e) =>
                          setEditForm({ ...editForm, commissionRate: Number(e.target.value) })
                        }
                        className="w-full p-2 rounded-lg bg-white border border-teal-200 text-xs font-bold font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold text-teal-800 text-[11px] mb-1">Chuyên Khoa</label>
                    <input
                      type="text"
                      value={editForm.specialties}
                      onChange={(e) => setEditForm({ ...editForm, specialties: e.target.value })}
                      className="w-full p-2 rounded-lg bg-white border border-teal-200 text-xs"
                    />
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="checkbox"
                      id="edit_is_verified"
                      checked={editForm.isVerified}
                      onChange={(e) => setEditForm({ ...editForm, isVerified: e.target.checked })}
                      className="w-4 h-4 rounded text-teal-600 cursor-pointer"
                    />
                    <label
                      htmlFor="edit_is_verified"
                      className="text-xs font-bold text-teal-900 cursor-pointer"
                    >
                      Đã Thẩm Định Pháp Lý CCHN Hợp Lệ
                    </label>
                  </div>
                </div>
              )}

              <div className="flex gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setEditingUser(null)}
                  className="flex-1 py-2.5 rounded-xl font-bold text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-2.5 rounded-xl bg-purple-700 hover:bg-purple-800 text-white font-bold shadow-md shadow-purple-900/20 transition-all"
                >
                  {isSubmitting ? 'Đang lưu...' : 'Lưu Thay Đổi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. MODAL ĐẶT LẠI MẬT KHẨU */}
      {resetModalUser && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold">
                  <KeyRound className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-extrabold text-slate-900 uppercase">
                    Đặt Lại Mật Khẩu
                  </h4>
                  <p className="text-[11px] text-slate-500 font-bold">{resetModalUser.full_name}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setResetModalUser(null);
                  setModalError(null);
                }}
                className="text-slate-400 hover:text-slate-600 font-bold text-sm"
              >
                ✕
              </button>
            </div>

            {modalError && (
              <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-300 text-rose-800 text-xs font-bold flex items-start gap-2.5 animate-in fade-in">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
                <span>{modalError}</span>
              </div>
            )}

            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 text-xs space-y-1">
              <div className="text-slate-600">Số điện thoại: <strong className="text-slate-900 font-mono">{resetModalUser.phone}</strong></div>
              <div className="text-slate-600">Mật khẩu hiện tại: <strong className="text-purple-700 font-mono">{resetModalUser.password_hash}</strong></div>
            </div>

            <div className="space-y-3 text-xs">
              {/* Quick Reset 123456 */}
              <button
                type="button"
                disabled={isSubmitting}
                onClick={async () => {
                  setModalError(null);
                  setIsSubmitting(true);
                  try {
                    const res = await onResetPassword(resetModalUser.id, '123456');
                    if (res && !res.success) {
                      setModalError(res.message || 'Không thể đặt lại mật khẩu!');
                      setAdminMsg({ type: 'error', text: res.message || 'Không thể đặt lại mật khẩu!' });
                    } else {
                      setAdminMsg({
                        type: 'success',
                        text: (res && res.message) || `Đã reset mật khẩu của ${resetModalUser.full_name} về '123456'!`,
                      });
                      setResetModalUser(null);
                      setModalError(null);
                    }
                  } finally {
                    setIsSubmitting(false);
                  }
                }}
                className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold flex items-center justify-center gap-1.5 shadow-sm transition-colors cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                {isSubmitting ? 'Đang xử lý...' : '1-Click: Reset về Mặc Định "123456"'}
              </button>

              <div className="relative flex py-1 items-center">
                <div className="flex-grow border-t border-slate-200"></div>
                <span className="flex-shrink mx-2 text-[10px] text-slate-400 uppercase font-bold">Hoặc tự nhập mật khẩu</span>
                <div className="flex-grow border-t border-slate-200"></div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Mật Khẩu Mới Tùy Chọn:</label>
                <input
                  type="text"
                  value={customPassword}
                  onChange={(e) => setCustomPassword(e.target.value)}
                  placeholder="Nhập mật khẩu mới..."
                  className="w-full p-2.5 rounded-xl bg-slate-50 border border-slate-200 font-mono font-bold text-slate-900 focus:outline-none focus:border-purple-600 text-xs"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setResetModalUser(null);
                    setModalError(null);
                  }}
                  className="flex-1 py-2 rounded-xl text-slate-600 font-bold hover:bg-slate-100"
                >
                  Đóng
                </button>
                <button
                  type="button"
                  disabled={!customPassword.trim() || isSubmitting}
                  onClick={async () => {
                    if (customPassword.trim()) {
                      setModalError(null);
                      setIsSubmitting(true);
                      try {
                        const res = await onResetPassword(resetModalUser.id, customPassword.trim());
                        if (res && !res.success) {
                          setModalError(res.message || 'Không thể đổi mật khẩu!');
                          setAdminMsg({ type: 'error', text: res.message || 'Không thể đổi mật khẩu!' });
                        } else {
                          setAdminMsg({
                            type: 'success',
                            text: (res && res.message) || `Đã đổi mật khẩu của ${resetModalUser.full_name} thành '${customPassword.trim()}'!`,
                          });
                          setResetModalUser(null);
                          setModalError(null);
                        }
                      } finally {
                        setIsSubmitting(false);
                      }
                    }
                  }}
                  className="flex-1 py-2 rounded-xl bg-purple-700 hover:bg-purple-800 disabled:opacity-50 text-white font-bold shadow-md transition-colors"
                >
                  {isSubmitting ? 'Đang đổi...' : 'Xác Nhận Đổi'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. MODAL XÁC NHẬN XÓA TÀI KHOẢN */}
      {deletingUser && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>

            {modalError && (
              <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-300 text-rose-800 text-xs font-bold flex items-start gap-2.5 animate-in fade-in">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
                <span>{modalError}</span>
              </div>
            )}

            <div className="text-center space-y-1">
              <h4 className="text-base font-black text-slate-900">Xác Nhận Xóa Tài Khoản?</h4>
              <p className="text-xs text-slate-600">
                Bạn có chắc chắn muốn xóa tài khoản{' '}
                <strong className="text-slate-900">{deletingUser.full_name}</strong> (SĐT:{' '}
                <span className="font-mono font-bold">{deletingUser.phone}</span>)?
              </p>
            </div>

            <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-[11px] text-rose-800">
              ⚠️ <strong>Cảnh báo:</strong> Thao tác này sẽ xóa vĩnh viễn hồ sơ và dữ liệu liên quan khỏi hệ thống!
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => {
                  setDeletingUser(null);
                  setModalError(null);
                }}
                className="flex-1 py-2.5 rounded-xl font-bold text-slate-600 hover:bg-slate-100 text-xs"
              >
                Hủy Bỏ
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={async () => {
                  if (onDeleteUser) {
                    setModalError(null);
                    setIsSubmitting(true);
                    try {
                      const res = await onDeleteUser(deletingUser.id);
                      if (res.success) {
                        setAdminMsg({ type: 'success', text: res.message || 'Đã xóa người dùng thành công!' });
                        setDeletingUser(null);
                        setModalError(null);
                      } else {
                        setModalError(res.message || 'Không thể xóa người dùng!');
                        setAdminMsg({ type: 'error', text: res.message || 'Không thể xóa người dùng!' });
                      }
                    } finally {
                      setIsSubmitting(false);
                    }
                  }
                }}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md shadow-rose-900/20"
              >
                {isSubmitting ? 'Đang xóa...' : 'Xóa Vĩnh Viễn'}
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
            <span>Đăng xuất quyền Quản trị ({currentUser.phone})</span>
          </button>
          <p className="text-[11px] text-slate-400">Đông Y HomeCare • Quản trị hệ thống an toàn</p>
        </div>
      )}
    </div>
  );
}
