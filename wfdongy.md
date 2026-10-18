# TÀI LIỆU ĐẶC TẢ KỸ THUẬT & QUY TRÌNH THỰC THI: HỆ THỐNG ĐẶT LỊCH KHÁM CHỮA BỆNH TẠI NHÀ (ANTIGRAVITY MASTER WORKFLOW)

## PHẦN 1: TỔNG QUAN KIẾN TRÚC & NGUYÊN TẮC VẬN HÀNH CỐT LÕI
- **Tech Stack:** Next.js (App Router, TypeScript, Tailwind CSS, Mobile-First PWA), Supabase (PostgreSQL, Realtime, RPC Stored Procedures, Row Level Security), Vercel & GitHub.
- **5 Nguyên Tắc Nghiệp Vụ Bắt Buộc (Core Business Rules):**
  1. **Cổng Đăng Nhập Thông Minh & Kiểm Duyệt Chứng Chỉ Hành Nghề (eKYC Gatekeeper):**
     - Trang chủ tích hợp Cổng Đăng nhập chung (nhập Số điện thoại + Mật khẩu tự động nhận diện Role: `PATIENT`, `PRACTITIONER`, hoặc `ADMIN`) và Thanh Demo Quick Login 1 chạm.
     - **Bệnh nhân:** Đăng ký nhanh 3 giây -> Vào đặt lịch ngay.
     - **Thầy thuốc:** Khi đăng ký **BẮT BUỘC** phải nhập **Số Chứng chỉ hành nghề (`license_number`)**, **Nơi cấp (`issued_by`)**, và **Tải ảnh chụp Giấy phép hành nghề (`license_image_url`)**. Tài khoản mới tạo mặc định `is_verified = false` (Chờ Admin duyệt). Khi chưa được Admin duyệt, Thầy thuốc đăng nhập vào sẽ bị khóa ở màn hình *"Chờ thẩm định Chứng chỉ hành nghề"*, tuyệt đối không được bật Online hay nhận bệnh nhân.
     - **Admin:** Không cho phép tự đăng ký ngoài trang chủ. Admin có quyền cao nhất: Duyệt/Từ chối Chứng chỉ hành nghề, Reset mật khẩu cho User, Quản lý danh mục dịch vụ và Giám sát toàn hệ thống, xem trực tiếp ảnh chứng chỉ và bệnh án trên form quản trị .
  2. **Cô Lập Dữ Liệu 1-1 Giữa Bệnh Nhân & Thầy Thuốc (Strict Pairwise Isolation):**
     - Khi **Bệnh nhân A đặt lịch khám thì hệ thống sẽ tự động gửi đơn cho tất cả các thầy thuốc đã đăng ký hợp lệ trên hệ thống (ưu tiên thầy thuốc chưa nhận book được lịch nào từ bệnh nhân) , say khi thầy thuốc nhận lệnh của bệnh nhân A gửi thì chỉ duy nhất Bệnh nhân A và Thầy thuốc X nhìn thấy thông tin ca khám và bệnh án của nhau. Các Thầy thuốc khác (Y, Z) hoàn toàn không nhìn thấy đơn này.
     - **Che thông tin chống "đi đêm" trước khi nhận ca:** Khi đơn đang ở trạng thái `PENDING` (chờ Thầy thuốc bấm Nhận ca), SĐT của bệnh nhân bị che (`0901***567`). Chỉ khi Thầy thuốc bấm **"Nhận Ca Khám"** (hệ thống đã tạm khóa phí chiết khấu nền tảng trong Ví Tín Dụng), toàn bộ SĐT, nút Gọi điện, nút Chat Zalo và Địa chỉ mới được mở khóa.
     - **Admin thấy toàn quyền (Full Visibility):** Admin thấy 100% mọi đơn đặt lịch, mọi trạng thái kết nối, bệnh án và biến động ví của tất cả Thầy thuốc và Bệnh nhân; đồng thời có quyền **Điều phối / Đổi Thầy thuốc phụ trách** nếu Thầy thuốc được chọn bận đột xuất.
  3. **Mô Hình Phí Chiết Khấu Nền Tảng Kiểu Grab Việt Nam (Không Phạt Cọc):**
     - Thầy thuốc nạp tiền vào **Ví Tín Dụng Liên Kết** bằng mã **VietQR QuickLink** tự động điền sẵn số tiền và SĐT.
     - Khi nhận lịch: Hệ thống tạm giữ (`LOCK_COMMISSION`) đúng phần phí chiết khấu nền tảng (VD: 15% - 20% giá dịch vụ, không tính chiết khấu trên phụ phí xăng xe).
     - Khi hoàn tất khám và lưu bệnh án 3 mục: Hệ thống khấu trừ vĩnh viễn (`DEDUCT_COMMISSION`) phí nền tảng từ khoản tạm giữ.
     - **KHÔNG PHẠT TIỀN CỌC:** Nếu đơn bị hủy (do Bệnh nhân hủy hoặc Thầy thuốc báo bận hủy lịch), hệ thống **hoàn trả 100% số tiền đang tạm giữ (`REFUND_LOCK`)** về lại số dư khả dụng của Thầy thuốc.
  4. **Mở Ứng Dụng Google Maps Miễn Phí 100% Trên Điện Thoại:**
     - Ngay khi Thầy thuốc nhận đơn và biết địa chỉ Bệnh nhân, bấm nút **"Mở Google Maps Chỉ Đường"** sẽ kích hoạt Google Maps Universal Deep Link (`travelmode=two-wheeler`), tự động bật ứng dụng Google Maps miễn phí trên iOS/Android dẫn đường theo cả địa chỉ chữ lẫn tọa độ GPS mà không tốn bất kỳ chi phí Google Maps API nào.
  5. **Ghi Nhận GPS Mềm & Liên Lạc Nhanh (Gọi Điện / Zalo 1 Chạm):**
     - Tích hợp nút Gọi điện (`tel:`) và Mở Zalo (`https://zalo.me/`) trực tiếp giữa Bệnh nhân và Thầy thuốc sau khi kết nối.
     - Khi Thầy thuốc bấm Check-in tại nhà khách, hệ thống ghi nhận tọa độ GPS thực tế và tính khoảng cách (nếu lệch xa chỉ cảnh báo mềm chứ không khóa cứng, tránh lỗi GPS trong chung cư/hẻm sâu).

---

## PHẦN 2: CƠ SỞ DỮ LIỆU SUPABASE HOÀN CHỈNH (CHẠY TRONG SQL EDITOR)

```sql
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
-- QUY TẮC HỦY LỊCH TRIỆT ĐỂ (KHÔNG LƯU VẾT ĐANG CHẠY):
-- Khi Bệnh nhân bấm "Hủy lịch khám (Không phạt cọc)", hệ thống thực thi cập nhật ngay lập tức:
-- 1. Trạng thái (status) chuyển vĩnh viễn sang 'CANCELLED_PATIENT' trên DB Supabase (và hoàn trả 100% phí tạm giữ cho Thầy thuốc nếu đơn đã nhận).
-- 2. Đơn hủy được gỡ bỏ dứt điểm khỏi danh sách ca khám đang hoạt động (activeBookings), không còn chạy lệnh.
-- 3. Khi Bệnh nhân thoát app, F5 tải lại trang, hoặc đăng nhập/vào lại hệ thống sau đó: Lệnh khám đã hủy triệt để, không bao giờ còn hiển thị ở trạng thái đang đặt/đang chạy.
-- 4. Đơn đã hủy chỉ xuất hiện ở mục "Sổ Bệnh Án & Đánh Giá" (pastBookings) với huy hiệu "Bệnh nhân đã hủy".
CREATE TABLE IF NOT EXISTS public.bookings (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  booking_code VARCHAR(30) UNIQUE NOT NULL,
  patient_id UUID REFERENCES public.profiles(id) NOT NULL,
  practitioner_id UUID REFERENCES public.profiles(id), -- NULL khi tự động tìm thầy thuốc, có ID khi chọn đích danh hoặc khi thầy thuốc nhận ca
  service_name TEXT NOT NULL,
  address TEXT NOT NULL,
  patient_phone VARCHAR(20) NOT NULL,
  lat DOUBLE PRECISION DEFAULT 10.7769,
  lng DOUBLE PRECISION DEFAULT 106.7009,
  symptom_notes TEXT,
  appointment_time TIMESTAMPTZ NOT NULL,
  
  -- Tài chính minh bạch kiểu Grab (Loại bỏ mục phụ phí xăng xe theo yêu cầu)
  service_fee NUMERIC(12, 2) NOT NULL,                 -- Giá khám dịch vụ (từ bảng giá niêm yết)
  travel_surcharge NUMERIC(12, 2) DEFAULT 0,           -- Phụ phí xăng xe (mặc định 0đ - đã bãi bỏ mục chọn phụ phí)
  commission_rate NUMERIC(5, 2) NOT NULL DEFAULT 15.0, -- % Phí nền tảng (Chỉ tính trên service_fee)
  commission_amount NUMERIC(12, 2) NOT NULL,           -- Số tiền phí nền tảng Admin thu
  
  -- Trạng thái: PENDING, CONFIRMED, ON_THE_WAY, IN_PROGRESS, COMPLETED, CANCELLED_PATIENT, CANCELLED_DOCTOR
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
  booking_id UUID REFERENCES public.bookings(id),
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
ON CONFLICT (phone) DO NOTHING;

INSERT INTO public.practitioner_profiles (user_id, specialties, license_number, license_image_url, issued_by, years_of_experience, base_service_fee, commission_rate, is_verified, is_online, rating_avg, total_reviews)
VALUES
  ('22222222-2222-2222-2222-222222222222', ARRAY['Châm cứu', 'Bấm huyệt', 'Đau cơ xương khớp'], 'CCHN-HCM-08912/BYT', 'https://images.unsplash.com/photo-1584515979956-d9f6e5d09982?w=600', 'Sở Y Tế TP.HCM', 12, 400000, 15.00, true, true, 4.95, 38),
  ('66666666-6666-6666-6666-666666666666', ARRAY['Khám Nội tổng quát', 'Chăm sóc người cao tuổi'], 'CCHN-HCM-04521/BYT', 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=600', 'Bộ Y Tế', 8, 500000, 15.00, true, true, 4.90, 24),
  ('44444444-4444-4444-4444-444444444444', ARRAY['Vật lý trị liệu', 'Phục hồi chức năng'], 'CCHN-HN-11290/BYT', 'https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=600', 'Sở Y Tế Hà Nội', 4, 450000, 15.00, false, false, 5.00, 0)
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO public.wallets (user_id, available_balance, locked_balance)
VALUES
  ('22222222-2222-2222-2222-222222222222', 1000000, 60000),
  ('66666666-6666-6666-6666-666666666666', 800000, 0),
  ('44444444-4444-4444-4444-444444444444', 0, 0)
ON CONFLICT (user_id) DO NOTHING;

-- Tạo sẵn 2 đơn mẫu để thấy ngay sự cô lập 1-1:
-- Đơn 1: Bệnh nhân Nguyễn Văn An chọn đích danh Lương y Trần Hữu Đức
INSERT INTO public.bookings (booking_code, patient_id, practitioner_id, service_name, address, patient_phone, lat, lng, symptom_notes, appointment_time, service_fee, travel_surcharge, commission_rate, commission_amount, status)
VALUES
  ('KB-261017-01', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'Châm cứu & Bấm huyệt trị đau vai gáy tại nhà', '125 Nguyễn Thị Minh Khai, Quận 1, TP.HCM', '0901234567', 10.7769, 106.6951, 'Đau cứng cổ vai gáy lan xuống tay phải 3 ngày nay.', NOW() + INTERVAL '2 hours', 400000, 30000, 15.00, 60000, 'CONFIRMED')
ON CONFLICT (booking_code) DO NOTHING;
```

---

## PHẦN 3: BỘ TIỆN ÍCH CỐT LÕI (`src/lib/utils-medical.ts`)

```typescript
// 1. Tạo URL ảnh mã QR chuyển khoản tự động (VietQR QuickLink)
export function getVietQRUrl(amount: number, practitionerPhone: string) {
  const BANK_ID = "VCB";
  const ACCOUNT_NO = "1234567899";
  const ACCOUNT_NAME = "NEN TANG Y TE HOMECARE";
  const cleanPhone = practitionerPhone.replace(/\s+/g, "");
  const addInfo = `NAPVI ${cleanPhone}`;

  return `https://img.vietqr.io/image/${BANK_ID}-${ACCOUNT_NO}-compact2.png?amount=${amount}&addInfo=${encodeURIComponent(addInfo)}&accountName=${encodeURIComponent(ACCOUNT_NAME)}`;
}

// 2. Mở trực tiếp ứng dụng Google Maps MIỄN PHÍ 100% trên điện thoại (Ưu tiên địa chỉ rõ ràng + tọa độ)
export function getGoogleMapsDirectionsUrl(destAddress: string, destLat?: number | null, destLng?: number | null): string {
  if (destAddress && destAddress.trim().length > 5) {
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destAddress.trim())}&travelmode=two-wheeler`;
  }
  if (destLat && destLng) {
    return `https://www.google.com/maps/dir/?api=1&destination=${destLat},${destLng}&travelmode=two-wheeler`;
  }
  return `https://www.google.com/maps`;
}

// 3. Lấy tọa độ GPS thực tế từ trình duyệt điện thoại (Mobile Geolocation API)
export function getCurrentDeviceLocation(): Promise<{ lat: number; lng: number }> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !navigator.geolocation) {
      reject(new Error("Thiết bị không hỗ trợ định vị GPS."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      () => {
        reject(new Error("Không lấy được GPS. Hệ thống sẽ dùng địa chỉ văn bản để mở Google Maps."));
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  });
}

// 4. Tính khoảng cách Haversine (mét) để ghi nhận Check-in GPS mềm (Không khóa cứng)
export function calculateDistanceInMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371e3;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

// 5. Chuẩn hóa Số điện thoại Việt Nam (loại bỏ khoảng trắng, đổi +84 thành 0)
export function normalizePhoneNumber(phone: string): string {
  return phone.replace(/\s+/g, "").replace(/^\+84/, "0").trim();
}
```

---

## PHẦN 4: HƯỚNG DẪN TỪNG BƯỚC CHO ANTIGRAVITY (6 PROMPTS TUẦN TỰ)

Bạn hãy copy **lần lượt từng Prompt dưới đây** dán vào khung chat của Antigravity. Đợi Antigravity chạy xong từng bước rồi mới dán bước tiếp theo:

### [PROMPT BƯỚC 1]: Khởi tạo dự án, Kết nối Supabase & Tạo Tiện ích Google Maps + VietQR
> "Đọc file `workflow.txt`. Hãy khởi tạo dự án Next.js App Router (TypeScript, Tailwind CSS) nếu chưa có, cài đặt `@supabase/supabase-js`, `@supabase/ssr`, và `lucide-react`. Tạo file `src/lib/supabase/client.ts` kết nối Supabase và tạo file `src/lib/utils-medical.ts` chứa đầy đủ 5 hàm tiện ích từ PHẦN 3 của `workflow.txt` (`getVietQRUrl`, `getGoogleMapsDirectionsUrl`, `getCurrentDeviceLocation`, `calculateDistanceInMeters`, `normalizePhoneNumber`)."

### [PROMPT BƯỚC 2]: Xây dựng Trang chủ kiêm Cổng Đăng Nhập / Đăng Ký Thông Minh (`src/components/AuthPortal.tsx`)
> "Hãy tạo Component `src/components/AuthPortal.tsx` chuẩn Mobile-First làm Cổng Đăng Nhập & Đăng Ký trên trang chủ theo đúng đặc tả trong `workflow.txt`:
> 1. **Banner Thương hiệu Y tế uy tín** ở đầu trang.
> 2. **Tab Đăng Nhập Thông Minh (Dùng chung cho cả 3 Role):**
>    - Ô nhập Số điện thoại (`inputMode='tel'`, tự động chuẩn hóa bằng `normalizePhoneNumber`) + Ô Mật khẩu (có nút con mắt Hiện/Ẩn mật khẩu).
>    - Nút 'Quên mật khẩu? Liên hệ Admin qua Zalo để cấp lại mật khẩu miễn phí'.
>    - Khi bấm Đăng nhập: Truy vấn bảng `profiles` (kèm `practitioner_profiles` và `wallets`) để tự động nhận diện Role (`PATIENT`, `PRACTITIONER`, hoặc `ADMIN`) và dẫn vào phân hệ tương ứng.
> 3. **Tab Đăng Ký Tài Khoản Mới (Chỉ cho phép chọn Bệnh Nhân hoặc Thầy Thuốc, ẩn quyền tự đăng ký Admin):**
>    - **Nếu chọn Bệnh Nhân (`PATIENT`):** Chỉ cần nhập Họ tên, Số điện thoại, Mật khẩu, Địa chỉ nhà mặc định -> Đăng ký xong tự động đăng nhập thẳng vào màn hình Đặt lịch.
>    - **Nếu chọn Thầy Thuốc (`PRACTITIONER`):** **BẮT BUỘC** phải nhập đầy đủ Hồ sơ Pháp lý Y tế:
>      + Họ tên, Số điện thoại, Mật khẩu, Chuyên khoa, Giá khám đề xuất.
>      + **Số Chứng chỉ hành nghề (`license_number`)** (Bắt buộc).
>      + **Cơ quan cấp (`issued_by`)** (VD: Sở Y Tế TP.HCM / Bộ Y Tế).
>      + **Tải ảnh chụp Giấy phép / Chứng chỉ hành nghề (`license_image_url`)** (Cho phép chọn ảnh từ máy điện thoại đọc sang Base64 Preview hoặc dán link ảnh).
>      + Khi tạo tài khoản Thầy thuốc mới: Lưu `is_verified = false` vào `practitioner_profiles` và khởi tạo ví `wallets` số dư 0đ.
> 4. **Thanh 'Đăng Nhập Nhanh 1 Chạm (Demo Quick Login)' ở cuối trang:** Có 5 nút bấm 1 chạm để test ngay lập tức sự cô lập 1-1:
>    - `Bệnh nhân Nguyễn Văn An (0901234567)`
>    - `Lương y Trần Hữu Đức - Đã duyệt CCHN (0988777666)`
>    - `BS. Lê Thị Mai - Đã duyệt CCHN (0912345678)`
>    - `BS. Phạm Minh Tuấn - Chờ duyệt CCHN (0977555444)`
>    - `Admin Quản Trị Hệ Thống (0999888999)`"

### [PROMPT BƯỚC 3]: Xây dựng Phân hệ Bệnh Nhân (`src/components/PatientView.tsx`) - Chọn Thầy thuốc & Cô lập 1-1
> "Hãy tạo Component Giao diện Mobile cho Bệnh nhân tại `src/components/PatientView.tsx`:
> - **Quy tắc Cô lập 1-1 bắt buộc:** Mọi truy vấn lấy danh sách lịch khám và sổ bệnh án của Bệnh nhân chỉ được lấy các dòng có `patient_id === currentUser.id`. Bệnh nhân A tuyệt đối không nhìn thấy lịch khám hay bệnh án của Bệnh nhân B.
> - Giao diện gồm 2 tab:
>   1. **Tab Đặt Lịch & Kết Nối Thầy Thuốc:**
>      - Bước 1: Hiển thị danh sách các Thầy thuốc đã được Admin duyệt Chứng chỉ hành nghề (`is_verified === true` và `is_online === true`) gồm Tên, Chuyên khoa, Số CCHN đã xác thực, Giá khám, Điểm sao. Cho phép Bệnh nhân bấm **'Chọn đích danh Thầy thuốc này'** (gán `practitioner_id` = ID Thầy thuốc được chọn) HOẶC chọn mặc định **'Để hệ thống tự tìm Thầy thuốc gần nhất'** (`practitioner_id = null`, hệ thống tự phát đơn đến tất cả Thầy thuốc hợp lệ).
>      - Bước 2: Chọn dịch vụ y học cổ truyền theo bảng giá niêm yết, chọn ngày & giờ hẹn khám, nhập địa chỉ nhà (có nút lấy tọa độ GPS hiện tại), nhập triệu chứng hiện tại (đã bãi bỏ phụ phí xăng xe). Bảng kê tài chính Grab minh bạch hiển thị giá dịch vụ và phí nền tảng.
>      - Bước 3: Danh sách Ca khám đang diễn ra của Bệnh nhân: Hiển thị rõ trạng thái, thông tin Thầy thuốc phụ trách, nút **'Gọi điện cho Thầy thuốc' (`tel:`)**, nút **'Nhắn Zalo' (`https://zalo.me/`)**, và nút **Hủy lịch khám (Không phạt cọc)**. Khi Bệnh nhân bấm Hủy, hệ thống xử lý hủy dứt điểm tức thì (cập nhật vĩnh viễn lên Supabase DB `status = 'CANCELLED_PATIENT'` và hoàn 100% tiền tạm giữ cho Thầy thuốc nếu có), gỡ bỏ hoàn toàn khỏi danh sách ca đang chạy. Khi thoát ra vào lại hoặc F5 tải lại trang, tuyệt đối không bị hiện lại lệnh đang đặt. Đơn đã hủy chuyển sang Tab 2.
>   2. **Tab Sổ Bệnh Án Điện Tử & Đánh Giá:**
>      - Tra cứu lịch sử khám của bản thân, xem chi tiết **Bệnh án 3 mục** do Thầy thuốc ghi (1. Chẩn đoán, 2. Thủ thuật & Đơn thuốc, 3. Lời dặn & Hẹn tái khám), xem các đơn đã hủy của mình và cho phép chấm điểm 1-5 sao cho Thầy thuốc sau khi khám xong."

### [PROMPT BƯỚC 4]: Xây dựng Phân hệ Thầy Thuốc (`src/components/PractitionerView.tsx`) - Mở Google Maps Miễn Phí & Ví Kiểu Grab
> "Hãy tạo Component Giao diện Mobile cho Thầy thuốc tại `src/components/PractitionerView.tsx`:
> 1. **Chốt chặn Chứng chỉ hành nghề (`License Gatekeeper`):**
>    - Nếu `practitioner.is_verified === false` (hoặc chưa có `license_number`), khóa toàn bộ tính năng nhận đơn và hiển thị màn hình: *'Hồ sơ Chứng chỉ hành nghề của bạn đang chờ Admin thẩm định'* kèm ảnh chứng chỉ đã nộp, nút cập nhật lại hồ sơ và nút liên hệ Zalo Admin.
> 2. **Quy tắc Cô lập 1-1 bắt buộc:**
>    - Thầy thuốc X **CHỈ ĐƯỢC NHÌN THẤY** các đơn khám có `practitioner_id === currentUser.id` (bệnh nhân chọn đích danh mình) HOẶC các đơn tự do chưa chọn ai (`practitioner_id === null` và `status === 'PENDING'`). Tuyệt đối không hiển thị các đơn mà bệnh nhân đã chọn đích danh Thầy thuốc Y!
> 3. **Khi `is_verified === true`, hiển thị 3 tab chuyên nghiệp:**
>    - **Tab 1: Ca Khám & Bệnh Án:**
>      + Khi đơn ở trạng thái `PENDING`: Hiển thị minh bạch kiểu Grab: `Thu tiền mặt khách: ...đ` | `Phụ phí xăng xe (hưởng 100%): ...đ` | `Phí nền tảng (15%): ...đ`. SĐT bệnh nhân được che (`0901***567`) cho đến khi bấm nút **'Nhận Ca Khám'** (gọi RPC `accept_booking_with_escrow`).
>      + Ngay sau khi bấm Nhận Ca Khám (`CONFIRMED` / `ON_THE_WAY` / `IN_PROGRESS`): Mở khóa đầy đủ SĐT bệnh nhân, hiện nút **'Gọi Điện'**, **'Nhắn Zalo'**, và nổi bật nhất là nút lớn **'Mở Google Maps Chỉ Đường Miễn Phí'** (mở tab mới với `getGoogleMapsDirectionsUrl(booking.address, booking.lat, booking.lng)` để tự bật app Google Maps trên điện thoại dẫn đường đến tận địa chỉ bệnh nhân).
>      + Có nút **'Check-in GPS đến nhà bệnh nhân'** (ghi nhận GPS mềm, không chặn cứng) và **Form Bệnh Án 3 Mục** (1. Chẩn đoán bệnh, 2. Thủ thuật & Đơn thuốc, 3. Lời dặn dò & Ngày tái khám) kèm nút **'Hoàn Tất Ca Khám'** (gọi RPC `complete_booking_and_deduct_commission`). Có nút 'Báo bận / Hủy ca' (hoàn trả 100% phí tạm giữ, không phạt cọc).
>    - **Tab 2: Ví Tín Dụng Liên Kết & VietQR:** Hiển thị Số dư khả dụng, Số tiền đang tạm giữ, bảng kê chiết khấu từng ca và tạo mã QR nạp tiền tự động bằng `getVietQRUrl` (kèm nút mô phỏng nạp tiền thành công để test ngay).
>    - **Tab 3: Tra Cứu Lịch Sử Khám:** Chỉ tra cứu các bệnh nhân đã kết nối với chính Thầy thuốc này."

### [PROMPT BƯỚC 5]: Xây dựng Phân hệ Admin Quản Trị Toàn Quyền (`src/components/AdminView.tsx`)
> "Hãy tạo Component Giao diện Quản trị viên tại `src/components/AdminView.tsx` (Admin có quyền nhìn thấy 100% dữ liệu của mọi Thầy thuốc và Bệnh nhân). Bao gồm 4 tab:
> 1. **Duyệt Chứng Chỉ Hành Nghề (eKYC Thầy Thuốc):** Hiển thị danh sách Thầy thuốc chờ duyệt (`is_verified = false`) có huy hiệu cảnh báo đỏ và danh sách đã duyệt. Cho phép Admin xem Số CCHN, Nơi cấp, xem ảnh chụp Giấy phép hành nghề, và bấm **'Phê Duyệt Hoạt Động'** (`is_verified = true`) hoặc **'Từ Chối / Tạm Khóa'**.
> 2. **Giám Sát Tất Cả Lịch Khám & Điều Phối (Full Visibility):** Xem toàn bộ các ca khám đang diễn ra và đã hoàn tất trên toàn hệ thống, xem rõ Bệnh nhân nào đang kết nối với Thầy thuốc nào, xem nội dung Bệnh án 3 mục. Đặc biệt có tính năng **'Điều phối / Đổi Thầy thuốc'** (cho phép Admin chọn gán lại `practitioner_id` sang Thầy thuốc khác nếu cần) và nút **'Hủy đơn & Hoàn trả 100% phí tạm giữ cho Thầy thuốc'**.
> 3. **Quản Lý User (Thêm / Sửa / Xóa / Reset Mật Khẩu):** Quản lý toàn bộ Bệnh nhân và Thầy thuốc, điều chỉnh % chiết khấu nền tảng hợp lý (mặc định 15%), cộng tiền vào Ví Tín Dụng cho Thầy thuốc, hoặc bấm **'Đặt lại mật khẩu (Reset Password)'** giúp người dùng quên mật khẩu.
> 4. **Đối Soát Phí Nền Tảng (Mô hình Grab):** Thống kê tổng doanh thu dịch vụ toàn sàn, tổng phí chiết khấu nền tảng Admin thu được, và số dư Ví Tín Dụng của từng Thầy thuốc."

### [PROMPT BƯỚC 6]: Ghép nối toàn bộ vào `src/app/page.tsx`, Bật Realtime & Kiểm tra Build
> "Hãy cập nhật file `src/app/page.tsx` để kết nối hoàn chỉnh `AuthPortal`, `PatientView`, `PractitionerView`, và `AdminView` với dữ liệu Supabase (kèm cơ chế Fallback thông minh sang State đồng bộ nếu chưa cấu hình biến môi trường để không bao giờ bị lỗi màn hình trắng). Thêm một thanh Header nhỏ ở trên cùng khi đã đăng nhập hiển thị Tên tài khoản hiện tại, Vai trò, nút **'Chuyển nhanh tài khoản Test (Bệnh nhân An / Lương y Đức / BS. Mai / BS. Tuấn chờ duyệt / Admin)'** để kiểm chứng ngay lập tức quy tắc: *Khi Bệnh nhân An chọn Lương y Đức thì chỉ An và Đức thấy đơn của nhau, BS. Mai hoàn toàn không thấy, còn Admin thấy tất cả*. Cuối cùng, hãy chạy `npm run build` để kiểm tra và sửa sạch mọi lỗi TypeScript nếu có."