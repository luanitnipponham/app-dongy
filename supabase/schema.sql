-- ====================================================================
-- HỆ THỐNG ĐẶT LỊCH KHÁM CHỮA BỆNH TẠI NHÀ (SUPABASE MASTER SCHEMA)
-- Dự án: hvkwepswkgqnbneqagno (https://supabase.com/dashboard/project/hvkwepswkgqnbneqagno)
-- ====================================================================

-- 1. Kích hoạt Extension tạo UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Tạo các kiểu dữ liệu ENUM
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('PATIENT', 'PRACTITIONER', 'ADMIN');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE booking_status AS ENUM (
    'PENDING',           -- Chờ thầy thuốc xác nhận nhận ca
    'CONFIRMED',         -- Đã nhận ca (Đã tạm giữ phí nền tảng)
    'ON_THE_WAY',        -- Thầy thuốc đang di chuyển (Google Maps)
    'IN_PROGRESS',       -- Đang khám tại nhà
    'COMPLETED',         -- Hoàn tất khám & Lưu bệnh án (Đã quyết toán phí nền tảng)
    'CANCELLED_PATIENT', -- Bệnh nhân hủy (Hoàn trả 100% phí tạm giữ cho Thầy thuốc)
    'CANCELLED_DOCTOR'   -- Thầy thuốc hủy (Hoàn trả 100% phí tạm giữ, không phạt tiền)
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE tx_type AS ENUM (
    'DEPOSIT',           -- Nạp tiền vào Ví Tín Dụng qua VietQR
    'LOCK_COMMISSION',   -- Tạm giữ phí nền tảng khi nhận ca
    'DEDUCT_COMMISSION', -- Quyết toán phí nền tảng khi hoàn tất khám
    'REFUND_LOCK'        -- Mở khóa hoàn lại 100% tiền tạm giữ khi hủy ca
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 3. Bảng Profiles (Quản lý tài khoản của cả 3 phân hệ)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  phone VARCHAR(20) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL DEFAULT '123456',
  full_name TEXT NOT NULL,
  avatar_url TEXT,
  default_address TEXT,
  role user_role DEFAULT 'PATIENT'::user_role NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Bảng Hồ sơ Thầy thuốc (Bắt buộc Chứng chỉ hành nghề & Duyệt eKYC)
CREATE TABLE IF NOT EXISTS public.practitioner_profiles (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE UNIQUE NOT NULL,
  specialties TEXT[] DEFAULT '{}',
  license_number TEXT NOT NULL,               -- Số Chứng chỉ hành nghề (Bắt buộc)
  license_image_url TEXT NOT NULL,            -- Ảnh chụp Giấy phép hành nghề (Bắt buộc)
  issued_by TEXT DEFAULT 'Sở Y Tế',           -- Cơ quan cấp phép
  years_of_experience INT DEFAULT 5,
  bio TEXT,
  base_service_fee NUMERIC(12, 2) DEFAULT 400000,
  commission_rate NUMERIC(5, 2) DEFAULT 15.00, -- Chiết khấu nền tảng hợp lý kiểu Grab (VD: 15%)
  is_verified BOOLEAN DEFAULT false,          -- BẮT BUỘC: Admin duyệt mới thành true
  rejection_reason TEXT,
  is_online BOOLEAN DEFAULT false,
  current_lat DOUBLE PRECISION DEFAULT 10.7769,
  current_lng DOUBLE PRECISION DEFAULT 106.7009,
  rating_avg NUMERIC(3, 2) DEFAULT 5.00,
  total_reviews INT DEFAULT 12,
  completed_jobs INT DEFAULT 0,
  cancelled_jobs INT DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Bảng Ví Tín Dụng Liên Kết (Dành cho Thầy thuốc)
CREATE TABLE IF NOT EXISTS public.wallets (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE UNIQUE NOT NULL,
  available_balance NUMERIC(14, 2) DEFAULT 0 CHECK (available_balance >= 0),
  locked_balance NUMERIC(14, 2) DEFAULT 0 CHECK (locked_balance >= 0),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Bảng Đặt lịch khám (Cô lập 1-1 giữa patient_id và practitioner_id)
CREATE TABLE IF NOT EXISTS public.bookings (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  booking_code VARCHAR(30) UNIQUE NOT NULL,
  patient_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  practitioner_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE, -- Nếu chọn đích danh sẽ lưu ngay ID Thầy thuốc đó
  service_name TEXT NOT NULL,
  address TEXT NOT NULL,
  patient_phone VARCHAR(20) NOT NULL,
  lat DOUBLE PRECISION DEFAULT 10.7769,
  lng DOUBLE PRECISION DEFAULT 106.7009,
  symptom_notes TEXT,
  appointment_time TIMESTAMPTZ NOT NULL,
  
  -- Tài chính minh bạch kiểu Grab
  service_fee NUMERIC(12, 2) NOT NULL,                 -- Giá khám dịch vụ
  travel_surcharge NUMERIC(12, 2) DEFAULT 0,           -- Phụ phí xăng xe/ngoài giờ (Thầy thuốc hưởng 100%)
  commission_rate NUMERIC(5, 2) NOT NULL DEFAULT 15.0, -- % Phí nền tảng (Chỉ tính trên service_fee)
  commission_amount NUMERIC(12, 2) NOT NULL,           -- Số tiền phí nền tảng Admin thu
  
  status booking_status DEFAULT 'PENDING'::booking_status NOT NULL,
  
  -- Bệnh án điện tử 3 mục chuẩn Y khoa
  medical_diagnosis TEXT,                              -- 1. Chẩn đoán bệnh / Mạch tượng
  treatment_notes TEXT,                                -- 2. Thủ thuật đã làm & Đơn thuốc
  doctor_advice TEXT,                                  -- 3. Lời dặn dò & Lịch hẹn tái khám
  
  patient_rating INT CHECK (patient_rating >= 1 AND patient_rating <= 5),
  patient_review TEXT,
  checkin_lat DOUBLE PRECISION,
  checkin_lng DOUBLE PRECISION,
  checkin_distance_meters NUMERIC(10, 2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Bảng Lịch sử giao dịch Ví (Sổ cái đối soát minh bạch)
CREATE TABLE IF NOT EXISTS public.wallet_transactions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  wallet_id UUID REFERENCES public.wallets(id) ON DELETE CASCADE NOT NULL,
  booking_id UUID REFERENCES public.bookings(id) ON DELETE CASCADE,
  amount NUMERIC(14, 2) NOT NULL,
  type tx_type NOT NULL,
  balance_after NUMERIC(14, 2) NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. HÀM RPC 1: Thầy thuốc Nhận Ca -> Kiểm tra Chứng chỉ + Kiểm tra quyền 1-1 + Tạm giữ phí nền tảng
CREATE OR REPLACE FUNCTION accept_booking_with_escrow(
  p_booking_id UUID,
  p_practitioner_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_wallet public.wallets%ROWTYPE;
  v_booking public.bookings%ROWTYPE;
  v_prac public.practitioner_profiles%ROWTYPE;
BEGIN
  -- 1. Bắt buộc Thầy thuốc phải có Chứng chỉ hành nghề đã được Admin duyệt
  SELECT * INTO v_prac FROM public.practitioner_profiles WHERE user_id = p_practitioner_id;
  IF v_prac.is_verified IS NOT TRUE OR v_prac.license_number IS NULL OR v_prac.license_number = '' THEN
    RAISE EXCEPTION 'Tài khoản chưa được Admin duyệt Chứng chỉ hành nghề. Bạn chưa thể nhận lịch!';
  END IF;

  -- 2. Khóa dòng booking và kiểm tra cô lập 1-1
  SELECT * INTO v_booking FROM public.bookings WHERE id = p_booking_id FOR UPDATE;
  IF v_booking.status != 'PENDING' THEN
    RAISE EXCEPTION 'Lịch khám này đã được xác nhận hoặc đã hủy.';
  END IF;
  IF v_booking.practitioner_id IS NOT NULL AND v_booking.practitioner_id != p_practitioner_id THEN
    RAISE EXCEPTION 'Bệnh nhân đã chọn đích danh một Thầy thuốc khác cho ca khám này.';
  END IF;

  -- 3. Kiểm tra số dư Ví Tín Dụng để tạm giữ phí nền tảng
  SELECT * INTO v_wallet FROM public.wallets WHERE user_id = p_practitioner_id FOR UPDATE;
  IF v_wallet.available_balance < v_booking.commission_amount THEN
    RAISE EXCEPTION 'Số dư Ví Tín Dụng không đủ (% VNĐ) để tạm giữ phí nền tảng. Vui lòng nạp thêm qua mã VietQR.', v_booking.commission_amount;
  END IF;

  -- 4. Tạm giữ phí nền tảng
  UPDATE public.wallets
  SET available_balance = available_balance - v_booking.commission_amount,
      locked_balance = locked_balance + v_booking.commission_amount,
      updated_at = NOW()
  WHERE id = v_wallet.id;

  -- 5. Gán cứng Thầy thuốc vào đơn và chuyển sang CONFIRMED
  UPDATE public.bookings
  SET practitioner_id = p_practitioner_id,
      status = 'CONFIRMED',
      updated_at = NOW()
  WHERE id = p_booking_id;

  INSERT INTO public.wallet_transactions (wallet_id, booking_id, amount, type, balance_after, description)
  VALUES (
    v_wallet.id, p_booking_id, v_booking.commission_amount, 'LOCK_COMMISSION',
    v_wallet.available_balance - v_booking.commission_amount,
    'Tạm giữ phí nền tảng (' || v_booking.commission_rate || '%) cho đơn ' || v_booking.booking_code
  );

  RETURN jsonb_build_object('success', true, 'booking_code', v_booking.booking_code);
END;
$$;

-- 9. HÀM RPC 2: Hoàn tất khám & Lưu bệnh án 3 mục -> Quyết toán phí nền tảng
CREATE OR REPLACE FUNCTION complete_booking_and_deduct_commission(
  p_booking_id UUID,
  p_practitioner_id UUID,
  p_diagnosis TEXT,
  p_treatment TEXT DEFAULT '',
  p_advice TEXT DEFAULT ''
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_wallet public.wallets%ROWTYPE;
  v_booking public.bookings%ROWTYPE;
BEGIN
  SELECT * INTO v_booking FROM public.bookings
  WHERE id = p_booking_id AND practitioner_id = p_practitioner_id FOR UPDATE;

  IF v_booking.status NOT IN ('CONFIRMED', 'ON_THE_WAY', 'IN_PROGRESS') THEN
    RAISE EXCEPTION 'Trạng thái ca khám không hợp lệ để hoàn tất.';
  END IF;

  SELECT * INTO v_wallet FROM public.wallets WHERE user_id = p_practitioner_id FOR UPDATE;

  -- Khấu trừ phí nền tảng từ khoản đang tạm giữ
  UPDATE public.wallets
  SET locked_balance = GREATEST(0, locked_balance - v_booking.commission_amount),
      updated_at = NOW()
  WHERE id = v_wallet.id;

  -- Lưu bệnh án 3 mục liên kết sang Sổ bệnh án của Bệnh nhân
  UPDATE public.bookings
  SET status = 'COMPLETED',
      medical_diagnosis = p_diagnosis,
      treatment_notes = p_treatment,
      doctor_advice = p_advice,
      updated_at = NOW()
  WHERE id = p_booking_id;

  UPDATE public.practitioner_profiles
  SET completed_jobs = completed_jobs + 1, updated_at = NOW()
  WHERE user_id = p_practitioner_id;

  INSERT INTO public.wallet_transactions (wallet_id, booking_id, amount, type, balance_after, description)
  VALUES (
    v_wallet.id, p_booking_id, v_booking.commission_amount, 'DEDUCT_COMMISSION',
    v_wallet.available_balance,
    'Quyết toán phí kết nối nền tảng đơn ' || v_booking.booking_code
  );

  RETURN jsonb_build_object('success', true);
END;
$$;

-- 10. HÀM RPC 3: Hủy lịch khám (KHÔNG PHẠT CỌC - Hoàn trả 100% phí tạm giữ về Ví khả dụng)
CREATE OR REPLACE FUNCTION cancel_booking_and_refund_lock(
  p_booking_id UUID,
  p_cancelled_by_role TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_wallet public.wallets%ROWTYPE;
  v_booking public.bookings%ROWTYPE;
  v_new_status booking_status;
BEGIN
  SELECT * INTO v_booking FROM public.bookings WHERE id = p_booking_id FOR UPDATE;

  IF v_booking.status = 'COMPLETED' THEN
    RAISE EXCEPTION 'Ca khám đã hoàn tất không thể hủy.';
  END IF;

  IF p_cancelled_by_role = 'PATIENT' THEN
    v_new_status := 'CANCELLED_PATIENT';
  ELSE
    v_new_status := 'CANCELLED_DOCTOR';
  END IF;

  -- Nếu đơn đã từng khóa phí nền tảng (CONFIRMED, ON_THE_WAY, IN_PROGRESS) -> Hoàn trả 100% cho Thầy thuốc
  IF v_booking.status IN ('CONFIRMED', 'ON_THE_WAY', 'IN_PROGRESS') AND v_booking.practitioner_id IS NOT NULL THEN
    SELECT * INTO v_wallet FROM public.wallets WHERE user_id = v_booking.practitioner_id FOR UPDATE;

    UPDATE public.wallets
    SET available_balance = available_balance + v_booking.commission_amount,
        locked_balance = GREATEST(0, locked_balance - v_booking.commission_amount),
        updated_at = NOW()
    WHERE id = v_wallet.id;

    INSERT INTO public.wallet_transactions (wallet_id, booking_id, amount, type, balance_after, description)
    VALUES (
      v_wallet.id, p_booking_id, v_booking.commission_amount, 'REFUND_LOCK',
      v_wallet.available_balance + v_booking.commission_amount,
      'Hoàn trả 100% phí tạm giữ do hủy đơn ' || v_booking.booking_code || ' (Không phạt cọc)'
    );
  END IF;

  UPDATE public.bookings
  SET status = v_new_status, updated_at = NOW()
  WHERE id = p_booking_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- 11. Bật Realtime cho các bảng
ALTER PUBLICATION supabase_realtime ADD TABLE public.bookings;
ALTER PUBLICATION supabase_realtime ADD TABLE public.wallets;
ALTER PUBLICATION supabase_realtime ADD TABLE public.practitioner_profiles;

-- 12. Dữ liệu mẫu (Seed Data) để test ngay lập tức
INSERT INTO public.profiles (id, phone, password_hash, full_name, default_address, role)
VALUES
  ('11111111-1111-1111-1111-111111111111', '0901234567', '123456', 'Nguyễn Văn An', '125 Nguyễn Thị Minh Khai, Phường Bến Thành, Quận 1, TP.HCM', 'PATIENT'),
  ('55555555-5555-5555-5555-555555555555', '0909999888', '123456', 'Trần Thị Bích Ngọc', '240 Phan Đăng Lưu, Quận Phú Nhuận, TP.HCM', 'PATIENT'),
  ('22222222-2222-2222-2222-222222222222', '0988777666', '123456', 'Lương y Trần Hữu Đức', 'Quận 1, TP.HCM', 'PRACTITIONER'),
  ('66666666-6666-6666-6666-666666666666', '0912345678', '123456', 'BS. Lê Thị Mai', 'Quận 3, TP.HCM', 'PRACTITIONER'),
  ('44444444-4444-4444-4444-444444444444', '0977555444', '123456', 'BS. Phạm Minh Tuấn (Chờ duyệt CCHN)', 'Quận Bình Thạnh, TP.HCM', 'PRACTITIONER'),
  ('33333333-3333-3333-3333-333333333333', '0999888999', '123456', 'Admin Quản Trị Hệ Thống', 'TP.HCM', 'ADMIN')
ON CONFLICT (phone) DO UPDATE 
SET full_name = EXCLUDED.full_name,
    default_address = EXCLUDED.default_address,
    role = EXCLUDED.role;

INSERT INTO public.practitioner_profiles (user_id, specialties, license_number, license_image_url, issued_by, years_of_experience, base_service_fee, commission_rate, is_verified, is_online, rating_avg, total_reviews)
VALUES
  ('22222222-2222-2222-2222-222222222222', ARRAY['Châm cứu', 'Bấm huyệt', 'Đau cơ xương khớp'], 'CCHN-HCM-08912/BYT', 'https://images.unsplash.com/photo-1584515979956-d9f6e5d09982?w=600', 'Sở Y Tế TP.HCM', 12, 400000, 15.00, true, true, 4.95, 38),
  ('66666666-6666-6666-6666-666666666666', ARRAY['Khám Nội tổng quát', 'Chăm sóc người cao tuổi'], 'CCHN-HCM-04521/BYT', 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=600', 'Bộ Y Tế', 8, 500000, 15.00, true, true, 4.90, 24),
  ('44444444-4444-4444-4444-444444444444', ARRAY['Vật lý trị liệu', 'Phục hồi chức năng'], 'CCHN-HN-11290/BYT', 'https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=600', 'Sở Y Tế Hà Nội', 4, 450000, 15.00, false, false, 5.00, 0)
ON CONFLICT (user_id) DO UPDATE
SET specialties = EXCLUDED.specialties,
    license_number = EXCLUDED.license_number,
    license_image_url = EXCLUDED.license_image_url,
    issued_by = EXCLUDED.issued_by,
    is_verified = EXCLUDED.is_verified,
    is_online = EXCLUDED.is_online;

INSERT INTO public.wallets (user_id, available_balance, locked_balance)
VALUES
  ('22222222-2222-2222-2222-222222222222', 1000000, 60000),
  ('66666666-6666-6666-6666-666666666666', 800000, 0),
  ('44444444-4444-4444-4444-444444444444', 0, 0)
ON CONFLICT (user_id) DO UPDATE
SET available_balance = EXCLUDED.available_balance,
    locked_balance = EXCLUDED.locked_balance;

INSERT INTO public.bookings (booking_code, patient_id, practitioner_id, service_name, address, patient_phone, lat, lng, symptom_notes, appointment_time, service_fee, travel_surcharge, commission_rate, commission_amount, status)
VALUES
  ('KB-261017-01', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'Châm cứu & Bấm huyệt trị đau vai gáy tại nhà', '125 Nguyễn Thị Minh Khai, Quận 1, TP.HCM', '0901234567', 10.7769, 106.6951, 'Đau cứng cổ vai gáy lan xuống tay phải 3 ngày nay.', NOW() + INTERVAL '2 hours', 400000, 30000, 15.00, 60000, 'CONFIRMED')
ON CONFLICT (booking_code) DO NOTHING;
