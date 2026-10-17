// Bộ tiện ích cốt lõi Y tế & Định vị & VietQR theo đặc tả wfdongy.md

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

// 7. Định dạng ngày giờ Việt Nam
export function formatDateTime(isoString: string): string {
  try {
    const date = new Date(isoString);
    return new Intl.DateTimeFormat("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(date);
  } catch {
    return isoString;
  }
}

// 8. Che số điện thoại bảo mật trước khi nhận ca (chống đi đêm)
export function maskPhoneNumber(phone: string): string {
  const clean = normalizePhoneNumber(phone);
  if (clean.length >= 10) {
    return `${clean.slice(0, 4)}***${clean.slice(-3)}`;
  }
  return clean;
}
