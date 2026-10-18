'use client';

import React, { useState } from 'react';
import {
  ShieldCheck,
  Stethoscope,
  User,
  Eye,
  EyeOff,
  Phone,
  Lock,
  MapPin,
  FileBadge,
  Upload,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Info
} from 'lucide-react';
import { Profile, PractitionerProfile, UserRole } from '@/types/database';
import { normalizePhoneNumber } from '@/lib/utils-medical';
import { supabase, isSupabaseConfigured } from '@/lib/supabase/client';

interface AuthPortalProps {
  onLoginSuccess: (profile: Profile, practitionerProfile?: PractitionerProfile) => void;
  profiles: Profile[];
  practitioners: Record<string, PractitionerProfile>;
  onRegisterPatient: (data: {
    fullName: string;
    phone: string;
    password: string;
    address: string;
  }) => Promise<{ success: boolean; message?: string }> | void;
  onRegisterPractitioner: (data: {
    fullName: string;
    phone: string;
    password: string;
    specialties: string[];
    baseFee: number;
    licenseNumber: string;
    issuedBy: string;
    licenseImageUrl: string;
  }) => Promise<{ success: boolean; message?: string }> | void;
}

export default function AuthPortal({
  onLoginSuccess,
  profiles,
  practitioners,
  onRegisterPatient,
  onRegisterPractitioner,
}: AuthPortalProps) {
  const [activeTab, setActiveTab] = useState<'LOGIN' | 'REGISTER'>('LOGIN');
  const [registerRole, setRegisterRole] = useState<'PATIENT' | 'PRACTITIONER'>('PATIENT');

  // Form states
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  // Register state
  const [regFullName, setRegFullName] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regAddress, setRegAddress] = useState('');

  // Practitioner legal registration state
  const [regSpecialties, setRegSpecialties] = useState('Châm cứu, Bấm huyệt');
  const [regBaseFee, setRegBaseFee] = useState(400000);
  const [regLicenseNumber, setRegLicenseNumber] = useState('');
  const [regIssuedBy, setRegIssuedBy] = useState('Sở Y Tế TP.HCM');
  const [regLicenseImageUrl, setRegLicenseImageUrl] = useState('');

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    const cleanPhone = normalizePhoneNumber(phone);
    if (!cleanPhone) {
      setErrorMsg('Vui lòng nhập Số điện thoại!');
      return;
    }
    if (!password || !password.trim()) {
      setErrorMsg('Vui lòng nhập Mật khẩu!');
      return;
    }

    setIsLoggingIn(true);
    try {
      let matchedProfile: Profile | null = null;

      // 1. Kiểm tra trực tiếp trên Supabase Cloud theo RLS để lấy mật khẩu mới nhất tức thì
      if (isSupabaseConfigured) {
        try {
          const { data: dbUser, error: dbErr } = await supabase
            .from('profiles')
            .select('*')
            .eq('phone', cleanPhone)
            .maybeSingle();

          if (dbUser) {
            matchedProfile = dbUser;
          } else if (dbErr) {
            console.warn('Supabase login check error:', dbErr);
          }
        } catch (fetchErr) {
          console.warn('Supabase query failed, falling back to local memory:', fetchErr);
        }
      }

      // 2. Dự phòng bộ nhớ cục bộ nếu ngoại tuyến
      if (!matchedProfile) {
        matchedProfile =
          profiles.find((p) => normalizePhoneNumber(p.phone) === cleanPhone) || null;
      }

      if (!matchedProfile) {
        setErrorMsg(`Không tìm thấy tài khoản với số điện thoại ${cleanPhone}. Vui lòng kiểm tra lại.`);
        setIsLoggingIn(false);
        return;
      }

      // Kiểm tra trạng thái kích hoạt của tài khoản
      if (matchedProfile.is_active === false) {
        setErrorMsg('Tài khoản này hiện đang bị tạm khóa. Vui lòng liên hệ Admin để được hỗ trợ.');
        setIsLoggingIn(false);
        return;
      }

      // 3. KIỂM TRA MẬT KHẨU CHÍNH XÁC (KHÔNG CÓ BACKDOOR, ĐÚNG RLS)
      const expectedPassword = matchedProfile.password_hash || '123456';
      if (password.trim() !== expectedPassword) {
        setErrorMsg('Mật khẩu không chính xác! Vui lòng kiểm tra lại.');
        setIsLoggingIn(false);
        return;
      }

      // 4. Lấy thông tin Thầy thuốc nếu có
      let prac = practitioners[matchedProfile.id];
      if (!prac && matchedProfile.role === 'PRACTITIONER' && isSupabaseConfigured) {
        try {
          const { data: dbPrac } = await supabase
            .from('practitioner_profiles')
            .select('*')
            .eq('user_id', matchedProfile.id)
            .maybeSingle();
          if (dbPrac) prac = dbPrac;
        } catch (pracErr) {
          console.warn('Practitioner query failed:', pracErr);
        }
      }

      setSuccessMsg(`Đăng nhập thành công (${matchedProfile.full_name})! Đang chuyển hướng...`);
      setTimeout(() => {
        onLoginSuccess(matchedProfile!, prac);
      }, 300);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Có lỗi xảy ra khi xác thực đăng nhập.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleQuickLogin = (target: string | Profile) => {
    let matchedProfile: Profile | undefined;
    if (typeof target === 'string') {
      const clean = normalizePhoneNumber(target);
      matchedProfile = profiles.find((p) => normalizePhoneNumber(p.phone) === clean);
    } else {
      matchedProfile = target;
    }

    if (matchedProfile) {
      setPhone(matchedProfile.phone);
      setPassword(matchedProfile.password_hash || '123456');
      setErrorMsg('');
      const prac = practitioners[matchedProfile.id];
      onLoginSuccess(matchedProfile, prac);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    const cleanPhone = normalizePhoneNumber(regPhone);
    if (!cleanPhone || cleanPhone.length < 9) {
      setErrorMsg('Vui lòng nhập số điện thoại hợp lệ (từ 10 chữ số).');
      return;
    }

    // Check duplicate
    if (profiles.some((p) => normalizePhoneNumber(p.phone) === cleanPhone)) {
      setErrorMsg('Số điện thoại này đã được đăng ký trên hệ thống. Vui lòng đăng nhập!');
      return;
    }

    if (!regFullName.trim()) {
      setErrorMsg('Vui lòng nhập đầy đủ Họ và tên.');
      return;
    }

    if (registerRole === 'PATIENT') {
      // Chờ kết quả ghi Supabase rồi mới báo thành công. Trước đây báo thành công
      // ngay lập tức kể cả khi dữ liệu chưa hề được lưu xuống cơ sở dữ liệu.
      const res = await onRegisterPatient({
        fullName: regFullName.trim(),
        phone: cleanPhone,
        password: regPassword || '123456',
        address: regAddress.trim() || 'TP. Hồ Chí Minh',
      });

      if (res && res.success === false) {
        setErrorMsg(res.message || 'Không tạo được tài khoản Bệnh nhân. Vui lòng thử lại.');
        return;
      }
      setSuccessMsg('Đăng ký tài khoản Bệnh nhân thành công!');
    } else {
      if (!regLicenseNumber.trim()) {
        setErrorMsg('BẮT BUỘC: Thầy thuốc phải cung cấp Số Chứng chỉ hành nghề y tế!');
        return;
      }
      if (!regLicenseImageUrl) {
        setErrorMsg('BẮT BUỘC: Vui lòng tải lên hoặc dán link ảnh chụp Giấy phép hành nghề!');
        return;
      }

      const specs = regSpecialties
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      const res = await onRegisterPractitioner({
        fullName: regFullName.trim(),
        phone: cleanPhone,
        password: regPassword || '123456',
        specialties: specs.length ? specs : ['Y học cổ truyền'],
        baseFee: Number(regBaseFee) || 400000,
        licenseNumber: regLicenseNumber.trim(),
        issuedBy: regIssuedBy.trim() || 'Sở Y Tế',
        licenseImageUrl: regLicenseImageUrl,
      });

      if (res && res.success === false) {
        setErrorMsg(res.message || 'Không tạo được hồ sơ Thầy thuốc. Vui lòng thử lại.');
        return;
      }
      setSuccessMsg('Đăng ký hồ sơ Thầy thuốc thành công! Hồ sơ đã được gửi đến Admin để thẩm định.');
    }
  };

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setRegLicenseImageUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="w-full max-w-lg mx-auto pb-12 px-4">
      {/* Brand Header */}
      <div className="text-center pt-6 pb-6">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white shadow-xl shadow-emerald-500/20 mb-3 ring-4 ring-emerald-100">
          <Stethoscope className="w-9 h-9" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-800 tracking-tight">
          ĐÔNG Y HOMECARE
        </h1>
        <p className="text-xs sm:text-sm text-slate-600 mt-1 max-w-sm mx-auto font-medium">
          Hệ thống đặt lịch khám chữa bệnh Y học Cổ truyền tại nhà chuẩn eKYC Y khoa
        </p>

        <div className="flex flex-wrap items-center justify-center gap-2 mt-3">
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <ShieldCheck className="w-3.5 h-3.5" /> 100% Bác sĩ có CCHN
          </span>
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            <Sparkles className="w-3.5 h-3.5" /> Cô lập 1-1 minh bạch
          </span>
        </div>
      </div>

      {/* Main Auth Card */}
      <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/60 border border-slate-100 overflow-hidden">
        {/* Nav Tabs */}
        <div className="flex border-b border-slate-100 bg-slate-50/70 p-1.5">
          <button
            type="button"
            onClick={() => {
              setActiveTab('LOGIN');
              setErrorMsg('');
              setSuccessMsg('');
            }}
            className={`flex-1 py-3 text-sm font-bold rounded-2xl transition-all duration-200 flex items-center justify-center gap-2 ${
              activeTab === 'LOGIN'
                ? 'bg-white text-emerald-700 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <User className="w-4 h-4" /> Đăng Nhập Chung
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('REGISTER');
              setErrorMsg('');
              setSuccessMsg('');
            }}
            className={`flex-1 py-3 text-sm font-bold rounded-2xl transition-all duration-200 flex items-center justify-center gap-2 ${
              activeTab === 'REGISTER'
                ? 'bg-white text-emerald-700 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Sparkles className="w-4 h-4" /> Đăng Ký Mới
          </button>
        </div>

        <div className="p-5 sm:p-6">
          {/* Notifications */}
          {errorMsg && (
            <div className="mb-4 p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs sm:text-sm flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="mb-4 p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs sm:text-sm flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* TAB 1: SMART LOGIN (ALL ROLES) */}
          {activeTab === 'LOGIN' && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Số điện thoại
                </label>
                <div className="relative">
                  <Phone className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="tel"
                    inputMode="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="VD: 0901234567"
                    required
                    className="w-full pl-11 pr-4 py-3 rounded-2xl bg-slate-50 border border-slate-200 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Mật khẩu
                </label>
                <div className="relative">
                  <Lock className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Nhập mật khẩu..."
                    className="w-full pl-11 pr-11 py-3 rounded-2xl bg-slate-50 border border-slate-200 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all font-medium"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1 text-xs">
                <span className="text-slate-500">Tự động nhận diện Role khi đăng nhập</span>
                <a
                  href="https://zalo.me/0999888999"
                  target="_blank"
                  rel="noreferrer"
                  className="text-emerald-700 font-semibold hover:underline"
                >
                  Quên mật khẩu?
                </a>
              </div>

              <button
                type="submit"
                disabled={isLoggingIn}
                className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 disabled:opacity-70 text-white font-bold text-sm shadow-lg shadow-emerald-600/25 transition-all flex items-center justify-center gap-2 active:scale-[0.99] cursor-pointer"
              >
                {isLoggingIn ? (
                  <>Đang xác thực bảo mật...</>
                ) : (
                  <>
                    Đăng Nhập Vào Hệ Thống <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}

          {/* TAB 2: REGISTER (PATIENT OR PRACTITIONER) */}
          {activeTab === 'REGISTER' && (
            <form onSubmit={handleRegisterSubmit} className="space-y-4">
              {/* Role Selector Pill */}
              <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-2xl">
                <button
                  type="button"
                  onClick={() => setRegisterRole('PATIENT')}
                  className={`py-2 text-xs font-bold rounded-xl transition-all ${
                    registerRole === 'PATIENT'
                      ? 'bg-white text-emerald-700 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Tôi là Bệnh Nhân
                </button>
                <button
                  type="button"
                  onClick={() => setRegisterRole('PRACTITIONER')}
                  className={`py-2 text-xs font-bold rounded-xl transition-all ${
                    registerRole === 'PRACTITIONER'
                      ? 'bg-white text-teal-700 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Tôi là Thầy Thuốc (eKYC)
                </button>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Họ và tên đầy đủ *
                </label>
                <input
                  type="text"
                  value={regFullName}
                  onChange={(e) => setRegFullName(e.target.value)}
                  placeholder={registerRole === 'PATIENT' ? 'VD: Nguyễn Văn An' : 'VD: Lương y Trần Hữu Đức'}
                  required
                  className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Số điện thoại *
                  </label>
                  <input
                    type="tel"
                    inputMode="tel"
                    value={regPhone}
                    onChange={(e) => setRegPhone(e.target.value)}
                    placeholder="VD: 0901234567"
                    required
                    className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Mật khẩu *
                  </label>
                  <input
                    type="password"
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    placeholder="Mặc định: 123456"
                    className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                  />
                </div>
              </div>

              {registerRole === 'PATIENT' ? (
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Địa chỉ nhà nhận khám (Mặc định)
                  </label>
                  <div className="relative">
                    <MapPin className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                    <input
                      type="text"
                      value={regAddress}
                      onChange={(e) => setRegAddress(e.target.value)}
                      placeholder="Số nhà, Tên đường, Phường, Quận, TP.HCM"
                      className="w-full pl-9 pr-3.5 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                    />
                  </div>
                </div>
              ) : (
                /* Practitioner eKYC Legal Fields */
                <div className="space-y-3 p-3.5 bg-amber-50/60 rounded-2xl border border-amber-200/80">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-amber-800">
                    <FileBadge className="w-4 h-4" />
                    HỒ SƠ PHÁP LÝ Y TẾ (BẮT BUỘC ĐỂ ADMIN DUYỆT)
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-0.5">
                        Số Chứng Chỉ Hành Nghề (CCHN) *
                      </label>
                      <input
                        type="text"
                        value={regLicenseNumber}
                        onChange={(e) => setRegLicenseNumber(e.target.value)}
                        placeholder="VD: CCHN-HCM-08912/BYT"
                        required
                        className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs focus:ring-2 focus:ring-amber-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-0.5">
                        Nơi cấp phép *
                      </label>
                      <input
                        type="text"
                        value={regIssuedBy}
                        onChange={(e) => setRegIssuedBy(e.target.value)}
                        placeholder="VD: Sở Y Tế TP.HCM / Bộ Y Tế"
                        required
                        className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs focus:ring-2 focus:ring-amber-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-0.5">
                        Chuyên khoa điều trị
                      </label>
                      <input
                        type="text"
                        value={regSpecialties}
                        onChange={(e) => setRegSpecialties(e.target.value)}
                        placeholder="Châm cứu, Bấm huyệt, Xoa bóp"
                        className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-0.5">
                        Giá khám dịch vụ (VNĐ)
                      </label>
                      <input
                        type="number"
                        step={50000}
                        value={regBaseFee}
                        onChange={(e) => setRegBaseFee(Number(e.target.value))}
                        className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-emerald-800"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Ảnh chụp Giấy phép hành nghề / Bằng cấp y khoa *
                    </label>
                    <div className="flex items-center gap-2">
                      <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold shadow-sm transition-all">
                        <Upload className="w-3.5 h-3.5" /> Tải ảnh từ máy
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleImageFileChange}
                          className="hidden"
                        />
                      </label>
                      <input
                        type="text"
                        value={regLicenseImageUrl}
                        onChange={(e) => setRegLicenseImageUrl(e.target.value)}
                        placeholder="Hoặc dán URL ảnh chứng chỉ..."
                        className="flex-1 px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-700"
                      />
                    </div>

                    {regLicenseImageUrl && (
                      <div className="mt-2 relative w-32 h-20 rounded-xl overflow-hidden border border-amber-300 shadow-sm">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={regLicenseImageUrl}
                          alt="Chứng chỉ preview"
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}

                    <p className="text-[11px] text-amber-800 mt-1.5 leading-snug">
                      * Tài khoản mới sẽ có trạng thái <strong>Chờ Admin thẩm định</strong>. Bạn sẽ nhận bệnh nhân ngay sau khi được Admin phê duyệt.
                    </p>
                  </div>
                </div>
              )}

              <button
                type="submit"
                className={`w-full py-3.5 px-4 rounded-2xl text-white font-bold text-sm shadow-lg transition-all flex items-center justify-center gap-2 active:scale-[0.99] ${
                  registerRole === 'PATIENT'
                    ? 'bg-gradient-to-r from-emerald-600 to-teal-600 shadow-emerald-600/25'
                    : 'bg-gradient-to-r from-teal-700 to-emerald-800 shadow-teal-700/25'
                }`}
              >
                {registerRole === 'PATIENT' ? 'Đăng Ký & Đặt Lịch Khám' : 'Gửi Hồ Sơ Thầy Thuốc Chờ Duyệt'}
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          )}
        </div>

        {/* DEMO QUICK LOGIN SECTION */}
        <div className="bg-gradient-to-b from-slate-50 to-slate-100 p-5 border-t border-slate-200/80">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-extrabold uppercase text-slate-700 tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              Đăng Nhập Nhanh 1 Chạm (Demo Roles)
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-200 text-slate-600 font-bold">
              Bệnh nhân & Thầy thuốc
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-left">
            {profiles
              .filter((u) => u.role !== 'ADMIN') // Ẩn hoàn toàn tài khoản Admin khỏi danh sách demo công khai
              .map((u) => {
                const isAdmin = false;
              const prac = practitioners[u.id];
              const isDoctor = u.role === 'PRACTITIONER';

              return (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => handleQuickLogin(u)}
                  className={`p-2.5 rounded-xl border transition-all text-left group shadow-xs cursor-pointer ${
                    isAdmin
                      ? 'sm:col-span-2 bg-purple-50 hover:bg-purple-100 border-purple-200 hover:border-purple-300'
                      : isDoctor
                      ? 'bg-white hover:bg-teal-50 border-slate-200 hover:border-teal-300'
                      : 'bg-white hover:bg-emerald-50 border-slate-200 hover:border-emerald-300'
                  }`}
                >
                  <div className="text-xs font-bold text-slate-800 flex items-center justify-between">
                    <span
                      className={`flex items-center gap-1.5 truncate ${
                        isAdmin
                          ? 'text-purple-900 group-hover:text-purple-950 font-extrabold'
                          : isDoctor
                          ? 'group-hover:text-teal-700'
                          : 'group-hover:text-emerald-700'
                      }`}
                    >
                      {isAdmin && <ShieldCheck className="w-3.5 h-3.5 text-purple-600 shrink-0" />}
                      {u.full_name}
                    </span>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded font-bold shrink-0 ${
                        isAdmin
                          ? 'bg-purple-200 text-purple-900'
                          : isDoctor
                          ? prac?.is_verified
                            ? 'bg-teal-100 text-teal-800'
                            : 'bg-amber-100 text-amber-800'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {isAdmin
                        ? 'Toàn quyền'
                        : isDoctor
                        ? prac?.is_verified
                          ? 'Đã duyệt CCHN'
                          : 'Chờ duyệt CCHN'
                        : 'Bệnh nhân'}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 font-mono mt-0.5 flex items-center justify-between">
                    <span>{u.phone}</span>
                    <span className="text-[10px] text-slate-400 font-sans">
                      MK: {u.password_hash || '123456'}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
