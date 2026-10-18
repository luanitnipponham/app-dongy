-- ============================================================================
-- MIGRATION SỬA LỖI LOGIC VẬN HÀNH & BỔ SUNG DỮ LIỆU CÒN THIẾU
-- Dự án: App Đông Y Homecare
-- Ngày: 18/10/2026
--
-- CÁCH CHẠY: Mở Supabase SQL Editor -> dán toàn bộ file này -> Run.
-- File này an toàn khi chạy lại nhiều lần (idempotent).
--
-- CÁC LỖI ĐƯỢC SỬA:
--  1. Hàm cancel_booking_and_refund_lock bị TRÙNG 2 overload (2 và 3 tham số)
--     -> PostgREST trả về PGRST203 "Could not choose the best candidate function".
--  2. Admin điều phối đổi Thầy thuốc KHÔNG chuyển phí tạm giữ: Thầy thuốc cũ bị
--     giam tiền vĩnh viễn, Thầy thuốc mới nhận ca mà không bị khóa phí nền tảng.
--  3. Đơn do Admin hủy bị ghi thành CANCELLED_DOCTOR -> oan cho Thầy thuốc.
--  4. Thiếu index trên các cột lọc nóng (patient_id, practitioner_id, status).
-- ============================================================================


-- ----------------------------------------------------------------------------
-- PHẦN 1: DỌN HÀM RPC BỊ TRÙNG OVERLOAD
-- Giữ lại duy nhất bản 3 tham số (có p_cancel_reason) mà ứng dụng đang gọi.
-- ----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.cancel_booking_and_refund_lock(UUID, TEXT);


-- ----------------------------------------------------------------------------
-- PHẦN 2: BỔ SUNG CỘT CÒN THIẾU
-- ----------------------------------------------------------------------------

-- 2.1. Ghi nhận CHÍNH XÁC ai đã hủy đơn (PATIENT | PRACTITIONER | ADMIN).
-- Trước đây Admin hủy đơn bị lưu thành 'CANCELLED_DOCTOR', làm sai lệch số liệu
-- đối soát và oan cho Thầy thuốc.
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS cancelled_by_role TEXT;

-- 2.2. Lý do Admin từ chối / tạm khóa hồ sơ CCHN của Thầy thuốc
ALTER TABLE public.practitioner_profiles
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- 2.3. Mốc thời gian Admin duyệt CCHN (phục vụ tra cứu & đối soát pháp lý)
ALTER TABLE public.practitioner_profiles
  ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;


-- ----------------------------------------------------------------------------
-- PHẦN 3: CẬP NHẬT HÀM HỦY ĐƠN - GHI ĐÚNG VAI TRÒ NGƯỜI HỦY
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cancel_booking_and_refund_lock(
  p_booking_id UUID,
  p_cancelled_by_role TEXT,
  p_cancel_reason TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_wallet public.wallets%ROWTYPE;
  v_booking public.bookings%ROWTYPE;
  v_new_status booking_status;
  v_final_reason TEXT;
BEGIN
  SELECT * INTO v_booking FROM public.bookings WHERE id = p_booking_id FOR UPDATE;

  IF v_booking.id IS NULL THEN
    RAISE EXCEPTION 'Không tìm thấy ca khám cần hủy.';
  END IF;

  IF v_booking.status = 'COMPLETED' THEN
    RAISE EXCEPTION 'Ca khám đã hoàn tất không thể hủy.';
  END IF;

  -- Đã hủy trước đó -> không hoàn tiền lần hai (chống hoàn trùng)
  IF v_booking.status IN ('CANCELLED_PATIENT', 'CANCELLED_DOCTOR') THEN
    RETURN jsonb_build_object('success', true, 'already_cancelled', true);
  END IF;

  IF p_cancelled_by_role = 'PATIENT' THEN
    v_new_status := 'CANCELLED_PATIENT';
    v_final_reason := COALESCE(p_cancel_reason, 'Bệnh nhân có việc bận đột xuất');
  ELSIF p_cancelled_by_role = 'ADMIN' THEN
    -- Admin điều phối hủy: giữ nhãn CANCELLED_DOCTOR cho tương thích ENUM cũ,
    -- nhưng cột cancelled_by_role ghi rõ 'ADMIN' để không oan cho Thầy thuốc.
    v_new_status := 'CANCELLED_DOCTOR';
    v_final_reason := COALESCE(p_cancel_reason, 'Admin điều phối hủy đơn');
  ELSE
    v_new_status := 'CANCELLED_DOCTOR';
    v_final_reason := COALESCE(p_cancel_reason, 'Thầy thuốc báo bận / Nghi vấn lừa đảo, bảo vệ an toàn');
  END IF;

  -- Hoàn trả 100% phí tạm giữ nếu đơn đã từng khóa tiền (KHÔNG PHẠT CỌC)
  IF v_booking.status IN ('CONFIRMED', 'ON_THE_WAY', 'IN_PROGRESS')
     AND v_booking.practitioner_id IS NOT NULL THEN
    SELECT * INTO v_wallet FROM public.wallets
      WHERE user_id = v_booking.practitioner_id FOR UPDATE;

    IF v_wallet.id IS NOT NULL THEN
      UPDATE public.wallets
      SET available_balance = available_balance + v_booking.commission_amount,
          locked_balance = GREATEST(0, locked_balance - v_booking.commission_amount),
          updated_at = NOW()
      WHERE id = v_wallet.id;

      INSERT INTO public.wallet_transactions
        (wallet_id, booking_id, amount, type, balance_after, description)
      VALUES (
        v_wallet.id, p_booking_id, v_booking.commission_amount, 'REFUND_LOCK',
        v_wallet.available_balance + v_booking.commission_amount,
        'Hoàn trả 100% phí tạm giữ do hủy đơn ' || v_booking.booking_code || ' (Không phạt cọc)'
      );
    END IF;
  END IF;

  UPDATE public.bookings
  SET status = v_new_status,
      cancelled_at = NOW(),
      cancelled_by_role = p_cancelled_by_role,
      cancel_reason = v_final_reason,
      updated_at = NOW()
  WHERE id = p_booking_id;

  RETURN jsonb_build_object('success', true);
END;
$$;


-- ----------------------------------------------------------------------------
-- PHẦN 4: HÀM MỚI - ADMIN ĐIỀU PHỐI ĐỔI THẦY THUỐC (CHUYỂN PHÍ TẠM GIỮ NGUYÊN TỬ)
--
-- Toàn bộ nghiệp vụ nằm trong 1 transaction duy nhất:
--   a) Thẩm định CCHN của Thầy thuốc được điều phối tới.
--   b) Khóa phí nền tảng trong ví Thầy thuốc MỚI (báo lỗi nếu ví không đủ).
--   c) Hoàn trả 100% phí tạm giữ cho Thầy thuốc CŨ (không phạt cọc).
--   d) Gán lại đơn.
-- Truyền p_new_practitioner_id = NULL để thu hồi đơn về danh sách đơn tự do.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reassign_booking_to_practitioner(
  p_booking_id UUID,
  p_new_practitioner_id UUID DEFAULT NULL,
  p_reason TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_booking public.bookings%ROWTYPE;
  v_prac public.practitioner_profiles%ROWTYPE;
  v_old_wallet public.wallets%ROWTYPE;
  v_new_wallet public.wallets%ROWTYPE;
  v_was_locked BOOLEAN;
BEGIN
  SELECT * INTO v_booking FROM public.bookings WHERE id = p_booking_id FOR UPDATE;

  IF v_booking.id IS NULL THEN
    RAISE EXCEPTION 'Không tìm thấy ca khám cần điều phối.';
  END IF;

  IF v_booking.status IN ('COMPLETED', 'CANCELLED_PATIENT', 'CANCELLED_DOCTOR') THEN
    RAISE EXCEPTION 'Ca khám đã kết thúc, không thể điều phối lại.';
  END IF;

  -- Không có thay đổi gì
  IF v_booking.practitioner_id IS NOT DISTINCT FROM p_new_practitioner_id THEN
    RETURN jsonb_build_object('success', true, 'unchanged', true);
  END IF;

  v_was_locked := v_booking.status IN ('CONFIRMED', 'ON_THE_WAY', 'IN_PROGRESS')
                  AND v_booking.practitioner_id IS NOT NULL;

  -- (a)(b) Thẩm định & khóa phí nền tảng của Thầy thuốc MỚI
  IF p_new_practitioner_id IS NOT NULL THEN
    SELECT * INTO v_prac FROM public.practitioner_profiles
      WHERE user_id = p_new_practitioner_id FOR UPDATE;

    IF v_prac.user_id IS NULL THEN
      RAISE EXCEPTION 'Thầy thuốc được điều phối không có hồ sơ chuyên môn.';
    END IF;

    IF v_prac.is_verified IS NOT TRUE
       OR v_prac.license_number IS NULL
       OR v_prac.license_number = '' THEN
      RAISE EXCEPTION 'Thầy thuốc được điều phối chưa được Admin duyệt Chứng chỉ hành nghề.';
    END IF;

    SELECT * INTO v_new_wallet FROM public.wallets
      WHERE user_id = p_new_practitioner_id FOR UPDATE;

    IF v_new_wallet.id IS NULL THEN
      RAISE EXCEPTION 'Thầy thuốc được điều phối chưa có Ví Tín Dụng liên kết.';
    END IF;

    IF v_new_wallet.available_balance < v_booking.commission_amount THEN
      RAISE EXCEPTION 'Ví Tín Dụng của Thầy thuốc được điều phối không đủ % VNĐ để tạm giữ phí nền tảng.',
        v_booking.commission_amount;
    END IF;

    UPDATE public.wallets
    SET available_balance = available_balance - v_booking.commission_amount,
        locked_balance = locked_balance + v_booking.commission_amount,
        updated_at = NOW()
    WHERE id = v_new_wallet.id;

    INSERT INTO public.wallet_transactions
      (wallet_id, booking_id, amount, type, balance_after, description)
    VALUES (
      v_new_wallet.id, p_booking_id, v_booking.commission_amount, 'LOCK_COMMISSION',
      v_new_wallet.available_balance - v_booking.commission_amount,
      'Admin điều phối: tạm giữ phí nền tảng đơn ' || v_booking.booking_code
    );
  END IF;

  -- (c) Hoàn trả 100% cho Thầy thuốc CŨ (không phạt cọc, không trừ uy tín)
  IF v_was_locked THEN
    SELECT * INTO v_old_wallet FROM public.wallets
      WHERE user_id = v_booking.practitioner_id FOR UPDATE;

    IF v_old_wallet.id IS NOT NULL THEN
      UPDATE public.wallets
      SET available_balance = available_balance + v_booking.commission_amount,
          locked_balance = GREATEST(0, locked_balance - v_booking.commission_amount),
          updated_at = NOW()
      WHERE id = v_old_wallet.id;

      INSERT INTO public.wallet_transactions
        (wallet_id, booking_id, amount, type, balance_after, description)
      VALUES (
        v_old_wallet.id, p_booking_id, v_booking.commission_amount, 'REFUND_LOCK',
        v_old_wallet.available_balance + v_booking.commission_amount,
        'Hoàn trả 100% phí tạm giữ do Admin điều phối đổi Thầy thuốc đơn '
          || v_booking.booking_code || ' (Không phạt cọc)'
      );
    END IF;
  END IF;

  -- (d) Gán lại đơn
  UPDATE public.bookings
  SET practitioner_id = p_new_practitioner_id,
      status = CASE
                 WHEN p_new_practitioner_id IS NULL THEN 'PENDING'::booking_status
                 ELSE 'CONFIRMED'::booking_status
               END,
      cancel_reason = COALESCE(p_reason, cancel_reason),
      updated_at = NOW()
  WHERE id = p_booking_id;

  RETURN jsonb_build_object('success', true);
END;
$$;


-- ----------------------------------------------------------------------------
-- PHẦN 5: HÀM MỚI - ADMIN CỘNG / TRỪ VÍ TÍN DỤNG AN TOÀN
-- Thay cho việc client đọc số dư rồi ghi đè giá trị tuyệt đối (gây mất cập nhật
-- khi có 2 thao tác đồng thời). Hàm này cộng/trừ tương đối trong 1 transaction.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_adjust_wallet(
  p_user_id UUID,
  p_amount NUMERIC,
  p_description TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_wallet public.wallets%ROWTYPE;
  v_new_balance NUMERIC;
BEGIN
  SELECT * INTO v_wallet FROM public.wallets WHERE user_id = p_user_id FOR UPDATE;

  -- Tự tạo ví nếu Thầy thuốc chưa có
  IF v_wallet.id IS NULL THEN
    INSERT INTO public.wallets (user_id, available_balance, locked_balance)
    VALUES (p_user_id, 0, 0)
    RETURNING * INTO v_wallet;
  END IF;

  v_new_balance := v_wallet.available_balance + p_amount;

  IF v_new_balance < 0 THEN
    RAISE EXCEPTION 'Không thể trừ % VNĐ: số dư khả dụng chỉ còn % VNĐ.',
      ABS(p_amount), v_wallet.available_balance;
  END IF;

  UPDATE public.wallets
  SET available_balance = v_new_balance, updated_at = NOW()
  WHERE id = v_wallet.id;

  INSERT INTO public.wallet_transactions
    (wallet_id, booking_id, amount, type, balance_after, description)
  VALUES (
    v_wallet.id, NULL, ABS(p_amount),
    CASE WHEN p_amount >= 0 THEN 'DEPOSIT'::tx_type ELSE 'DEDUCT_COMMISSION'::tx_type END,
    v_new_balance,
    COALESCE(p_description, 'Admin điều chỉnh số dư Ví Tín Dụng')
  );

  RETURN jsonb_build_object('success', true, 'available_balance', v_new_balance);
END;
$$;


-- ----------------------------------------------------------------------------
-- PHẦN 6: INDEX CHO CÁC CỘT LỌC NÓNG
-- Phân hệ nào cũng lọc theo patient_id / practitioner_id / status liên tục.
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_bookings_patient_id ON public.bookings (patient_id);
CREATE INDEX IF NOT EXISTS idx_bookings_practitioner_id ON public.bookings (practitioner_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON public.bookings (status);
CREATE INDEX IF NOT EXISTS idx_bookings_created_at ON public.bookings (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wallet_tx_wallet_id ON public.wallet_transactions (wallet_id);
CREATE INDEX IF NOT EXISTS idx_wallet_tx_booking_id ON public.wallet_transactions (booking_id);
CREATE INDEX IF NOT EXISTS idx_prac_is_verified ON public.practitioner_profiles (is_verified);


-- ----------------------------------------------------------------------------
-- PHẦN 7: BẢO ĐẢM MỌI THẦY THUỐC ĐỀU CÓ VÍ TÍN DỤNG
-- Thiếu ví là Thầy thuốc không bấm được "Nhận Ca Khám".
-- ----------------------------------------------------------------------------
INSERT INTO public.wallets (user_id, available_balance, locked_balance)
SELECT pp.user_id, 0, 0
FROM public.practitioner_profiles pp
LEFT JOIN public.wallets w ON w.user_id = pp.user_id
WHERE w.id IS NULL
ON CONFLICT (user_id) DO NOTHING;


-- ----------------------------------------------------------------------------
-- PHẦN 8: BẬT REALTIME CHO CÁC BẢNG CÒN THIẾU
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.wallet_transactions;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- ----------------------------------------------------------------------------
-- PHẦN 9: KIỂM TRA SAU KHI CHẠY
-- ----------------------------------------------------------------------------
SELECT p.proname AS ten_ham, pg_get_function_identity_arguments(p.oid) AS tham_so
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    'accept_booking_with_escrow',
    'complete_booking_and_deduct_commission',
    'cancel_booking_and_refund_lock',
    'reassign_booking_to_practitioner',
    'admin_adjust_wallet'
  )
ORDER BY p.proname;
-- KỲ VỌNG: đúng 5 dòng, và cancel_booking_and_refund_lock CHỈ xuất hiện 1 lần.


-- ----------------------------------------------------------------------------
-- PHẦN 10: ĐỒNG HỒ CHUẨN TỪ SERVER (CHỐNG ĐỒNG HỒ THIẾT BỊ SAI GIỜ)
-- Điện thoại / máy tính của Bệnh nhân hay Thầy thuốc có thể bị sai giờ, sai múi
-- giờ hoặc cố tình chỉnh lệch. Mọi tính toán "còn bao lâu tới giờ hẹn", kiểm tra
-- trùng lịch và chặn đặt lịch quá khứ đều phải dựa trên giờ của server.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_server_time()
RETURNS TIMESTAMPTZ
LANGUAGE sql
STABLE
AS $$
  SELECT now();
$$;
