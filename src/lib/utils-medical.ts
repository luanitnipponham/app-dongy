// Bộ tiện ích cốt lõi Y tế & Định vị & VietQR theo đặc tả wfdongy.md

import { serverNow } from "@/lib/server-clock";

// 1. Tạo URL ảnh mã QR chuyển khoản tự động (VietQR QuickLink)
export function getVietQRUrl(amount: number, practitionerPhone: string): string {
  const BANK_ID = "VCB";
  const ACCOUNT_NO = "1234567899";
  const ACCOUNT_NAME = "NEN TANG Y TE HOMECARE";
  const cleanPhone = practitionerPhone.replace(/\s+/g, "");
  const addInfo = `NAPVI ${cleanPhone}`;

  return `https://img.vietqr.io/image/${BANK_ID}-${ACCOUNT_NO}-compact2.png?amount=${amount}&addInfo=${encodeURIComponent(addInfo)}&accountName=${encodeURIComponent(ACCOUNT_NAME)}`;
}

// 2. Mở trực tiếp ứng dụng Google Maps MIỄN PHÍ 100% trên điện thoại (Ưu tiên địa chỉ rõ ràng + tọa độ)
export function getGoogleMapsDirectionsUrl(
  destAddress: string,
  destLat?: number | null,
  destLng?: number | null
): string {
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
        reject(
          new Error("Không lấy được GPS. Hệ thống sẽ dùng địa chỉ văn bản để mở Google Maps.")
        );
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  });
}

// 4. Tính khoảng cách Haversine (mét) để ghi nhận Check-in GPS mềm (Không khóa cứng)
export function calculateDistanceInMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
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

// 6. Định dạng tiền tệ VNĐ
export function formatVND(amount: number): string {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(amount);
}

// 7. Định dạng ngày giờ theo MÚI GIỜ VIỆT NAM
// BẮT BUỘC chỉ định timeZone: 'Asia/Ho_Chi_Minh'. Nếu để trình duyệt tự chọn thì
// máy nào đặt sai múi giờ (hoặc để UTC) sẽ hiển thị lệch nhiều tiếng, trong khi
// cả Bệnh nhân lẫn Thầy thuốc đều phải nhìn thấy CÙNG một giờ hẹn.
export function formatDateTime(isoString: string): string {
  try {
    const date = new Date(isoString);
    return new Intl.DateTimeFormat("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      timeZone: "Asia/Ho_Chi_Minh",
    }).format(date);
  } catch {
    return isoString;
  }
}

// 7b. Tách ngày (YYYY-MM-DD) và giờ (HH:mm) theo múi giờ Việt Nam
// Dùng để điền sẵn / giới hạn ô chọn ngày giờ trong form đặt lịch.
export function toVietnamDateParts(date: Date): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Ho_Chi_Minh",
  }).formatToParts(date);

  const get = (type: string) => parts.find((p) => p.type === type)?.value || "00";
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    time: `${get("hour")}:${get("minute")}`,
  };
}

// 7c. Đổi "ngày + giờ người dùng chọn" (hiểu theo giờ Việt Nam) sang mốc thời gian thật
// Nếu dùng `new Date('2026-10-19T08:30:00')` thì JavaScript hiểu theo múi giờ của
// THIẾT BỊ, nên máy đặt sai múi giờ sẽ tạo ra đơn lệch giờ so với thực tế.
export function vietnamDateTimeToDate(dateStr: string, timeStr: string): Date {
  // Việt Nam dùng UTC+7 cố định quanh năm (không có giờ mùa hè)
  return new Date(`${dateStr}T${timeStr}:00+07:00`);
}

// 9. Mô tả khoảng thời gian còn lại tới giờ hẹn khám
// Dùng chung cho cả phân hệ Bệnh nhân và Thầy thuốc để hai bên luôn thấy CÙNG
// một con số. Phải tính đủ cả giờ LẪN phút: chỉ lấy Math.floor(phút / 60) sẽ
// hiển thị "Còn 1 giờ" cho khoảng cách thực tế 1 giờ 58 phút (sai gần 1 tiếng).
export function describeTimeUntil(iso: string): {
  text: string;
  tone: 'ok' | 'soon' | 'late';
} {
  const target = new Date(iso).getTime();
  if (Number.isNaN(target)) return { text: 'Chưa rõ giờ hẹn', tone: 'late' };

  // Dùng giờ SERVER, không dùng Date.now() của thiết bị (máy có thể sai giờ)
  const diffMs = target - serverNow();
  const totalMins = Math.round(Math.abs(diffMs) / 60000);

  const days = Math.floor(totalMins / 1440);
  const hours = Math.floor((totalMins % 1440) / 60);
  const mins = totalMins % 60;

  let span: string;
  if (days > 0) {
    span = `${days} ngày${hours > 0 ? ` ${hours} giờ` : ''}`;
  } else if (hours > 0) {
    span = `${hours} giờ${mins > 0 ? ` ${mins} phút` : ''}`;
  } else {
    span = `${totalMins} phút`;
  }

  if (diffMs < 0) return { text: `Đã quá hẹn ${span}`, tone: 'late' };

  // Dưới 2 giờ là sắp tới giờ hẹn -> tô màu cảnh báo
  return { text: `Còn ${span}`, tone: totalMins <= 120 ? 'soon' : 'ok' };
}

// ===========================================================================
// 10. KHUNG GIỜ LÀM VIỆC CỦA THẦY THUỐC: 8h00 - 20h00 (giờ Việt Nam)
// Bệnh nhân chỉ được đặt lịch trong khung này. Ngoài giờ thì không Thầy thuốc
// nào nhận ca, đơn sẽ nằm PENDING vô ích.
// Quy ước: 20:00 là mốc BẮT ĐẦU khám muộn nhất được chấp nhận.
// ===========================================================================
export const WORKING_HOUR_START = 8;
export const WORKING_HOUR_END = 20;
export const WORKING_HOURS_LABEL = "08:00 - 20:00";

/** Số phút tính từ 0h của một mốc thời gian, theo giờ Việt Nam */
function vietnamMinutesOfDay(date: Date): number {
  const { time } = toVietnamDateParts(date);
  return Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
}

/** Mốc hẹn có nằm trong giờ làm việc không */
export function isWithinWorkingHours(date: Date): boolean {
  const mins = vietnamMinutesOfDay(date);
  return mins >= WORKING_HOUR_START * 60 && mins <= WORKING_HOUR_END * 60;
}

/** Cộng thêm số ngày vào chuỗi ngày dạng YYYY-MM-DD */
function addDaysToDateStr(dateStr: string, days: number): string {
  const d = new Date(Date.parse(`${dateStr}T00:00:00Z`) + days * 86400000);
  return d.toISOString().slice(0, 10);
}

/**
 * Mốc hẹn hợp lệ gần nhất kể từ `from`:
 *  - Đang trong giờ làm việc  -> giữ nguyên
 *  - Trước 8h sáng            -> đẩy tới 8h00 cùng ngày
 *  - Sau 20h tối              -> đẩy tới 8h00 sáng hôm sau
 */
export function nextWorkingSlot(from: Date): Date {
  if (isWithinWorkingHours(from)) return from;

  const { date } = toVietnamDateParts(from);
  const mins = vietnamMinutesOfDay(from);

  if (mins < WORKING_HOUR_START * 60) {
    return vietnamDateTimeToDate(date, "08:00");
  }
  return vietnamDateTimeToDate(addDaysToDateStr(date, 1), "08:00");
}

// 9b. Nhãn giờ hẹn CÓ MỐC NGÀY TƯƠNG ĐỐI, chống hiểu nhầm quanh lúc nửa đêm.
// Ví dụ lúc 23:02 ngày 18/10 mà hẹn 00:46 ngày 19/10 thì chỉ còn 1 giờ 44 phút,
// nhưng nếu chỉ in "00:46 19/10/2026" người dùng sẽ tưởng còn hơn một ngày.
// Nay in thành "00:46 rạng sáng mai (19/10)" nên đọc là hiểu ngay.
export function formatAppointmentLabel(iso: string): string {
  const target = new Date(iso);
  if (Number.isNaN(target.getTime())) return iso;

  const nowParts = toVietnamDateParts(new Date(serverNow()));
  const tParts = toVietnamDateParts(target);

  // Số ngày lệch tính theo NGÀY LỊCH Việt Nam (không phải theo số giờ chênh)
  const dayDiff = Math.round(
    (Date.parse(`${tParts.date}T00:00:00Z`) - Date.parse(`${nowParts.date}T00:00:00Z`)) / 86400000
  );

  const hour = Number(tParts.time.slice(0, 2));
  const time = tParts.time;
  const dd = tParts.date.slice(8, 10);
  const mm = tParts.date.slice(5, 7);
  const yyyy = tParts.date.slice(0, 4);

  if (dayDiff === 0) return `${time} hôm nay (${dd}/${mm})`;
  if (dayDiff === 1) {
    // Trước 6 giờ sáng gọi là "rạng sáng mai" cho sát cách nói thường ngày
    return hour < 6 ? `${time} rạng sáng mai (${dd}/${mm})` : `${time} ngày mai (${dd}/${mm})`;
  }
  if (dayDiff === 2) return `${time} ngày kia (${dd}/${mm})`;
  if (dayDiff === -1) return `${time} hôm qua (${dd}/${mm})`;
  return `${time} ${dd}/${mm}/${yyyy}`;
}

// 8b. Che địa chỉ chi tiết trước khi nhận ca (chống đi đêm bỏ qua nền tảng)
// Chỉ giữ lại phần khu vực (Phường/Quận/Tỉnh) ở cuối địa chỉ để Thầy thuốc vẫn
// ước lượng được đường đi, nhưng không thể tự liên hệ trực tiếp với Bệnh nhân.
export function getAreaOnly(address: string): string {
  if (!address) return 'Chưa có địa chỉ';
  const parts = address
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length <= 1) return 'Khu vực sẽ hiện sau khi nhận ca';
  // Lấy tối đa 2 cấp hành chính cuối (VD: "Quận 1, TP.HCM")
  return `${parts.slice(-2).join(', ')} (ẩn số nhà & tên đường)`;
}

// 8. Che số điện thoại bảo mật trước khi nhận ca (chống đi đêm)
export function maskPhoneNumber(phone: string): string {
  const clean = normalizePhoneNumber(phone);
  if (clean.length >= 10) {
    return `${clean.slice(0, 4)}***${clean.slice(-3)}`;
  }
  return clean;
}
