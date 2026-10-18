-- Cập nhật RPC hủy ca: bổ sung đếm số ca Thầy thuốc tự hủy.
-- CHỈ để Admin đối soát, KHÔNG phạt tiền, KHÔNG trừ điểm uy tín.
CREATE OR REPLACE FUNCTION public.cancel_booking_and_refund_lock(
  p_booking_id UUID,
  p_cancelled_by_role TEXT,
  p_cancel_reason TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $fn$
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

  IF v_booking.status IN ('CANCELLED_PATIENT', 'CANCELLED_DOCTOR') THEN
    RETURN jsonb_build_object('success', true, 'already_cancelled', true);
  END IF;

  IF p_cancelled_by_role = 'PATIENT' THEN
    v_new_status := 'CANCELLED_PATIENT';
    v_final_reason := COALESCE(p_cancel_reason, 'Bệnh nhân có việc bận đột xuất');
  ELSIF p_cancelled_by_role = 'ADMIN' THEN
    v_new_status := 'CANCELLED_DOCTOR';
    v_final_reason := COALESCE(p_cancel_reason, 'Admin điều phối hủy đơn');
  ELSE
    v_new_status := 'CANCELLED_DOCTOR';
    v_final_reason := COALESCE(p_cancel_reason, 'Thầy thuốc báo bận / Nghi vấn lừa đảo, bảo vệ an toàn');
  END IF;

  -- Hoàn trả 100% phí tạm giữ (KHÔNG PHẠT CỌC)
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

  -- Thống kê số ca Thầy thuốc tự hủy, chỉ phục vụ Admin đối soát minh bạch
  IF p_cancelled_by_role = 'PRACTITIONER' AND v_booking.practitioner_id IS NOT NULL THEN
    UPDATE public.practitioner_profiles
    SET cancelled_jobs = COALESCE(cancelled_jobs, 0) + 1, updated_at = NOW()
    WHERE user_id = v_booking.practitioner_id;
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
$fn$;
