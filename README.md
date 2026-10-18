# 🌿 App Đông Y HomeCare

> **Nền tảng Đặt Lịch Khám Chữa Bệnh Y Học Cổ Truyền Tại Nhà (Mô hình Grab Việt Nam)**  
> Next.js 16 (App Router) + Supabase Realtime (PostgreSQL) + Tailwind CSS + PWA Mobile-First

---

## 📋 Tài Liệu Bàn Giao Cho AI (AI Handover)

👉 **Nếu bạn chuyển sang dùng AI khác (Claude, ChatGPT, Cursor, Windsurf, Copilot, Antigravity mới):**  
Vui lòng xem và cung cấp file **[`AI_HANDOFF.md`](./AI_HANDOFF.md)** cho AI. Trong file đó đã có sẵn **Prompt 1-chạm**, toàn bộ kiến trúc 5 bảng dữ liệu, 5 nguyên tắc nghiệp vụ cốt lõi, và kết quả vượt qua **100% 7 Tầng Kiểm Thử An Toàn**.

Tài liệu đặc tả nghiệp vụ chi tiết: **[`wfdongy.md`](./wfdongy.md)**.

---

## 🚀 Khởi Chạy Nhanh

### 1. Cài đặt thư viện:
```bash
npm install
```

### 2. Cấu hình biến môi trường:
Đảm bảo file `.env.local` đã có:
```env
NEXT_PUBLIC_SUPABASE_URL=https://hvkwepswkgqnbneqagno.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

### 3. Kiểm thử 7 Tầng An Toàn Toàn Diện:
```bash
npm run test:layers
```

### 4. Khởi chạy Server cục bộ:
```bash
npm run dev
```
Truy cập [http://localhost:3000](http://localhost:3000) trên trình duyệt hoặc điện thoại.

---

## 🔑 Tài Khoản Dùng Thử Mẫu (Demo Accounts)

- **Bệnh nhân:** `0901234567` (MK: `123456`)
- **Thầy thuốc (Đã duyệt CCHN):** `0988777666` (MK: `123456`)
- **Thầy thuốc (Chờ duyệt CCHN):** `0977555444` (MK: `123456`)
- **Admin Quản Trị Toàn Quyền:** `0999888999` (MK: `123456`)

---

## 🛠️ Công Nghệ & Tiện Ích Y Tế
- **Google Maps 2 Bánh Miễn Phí:** Deep link Universal dẫn đường bằng xe máy không tốn phí Google Maps API.
- **VietQR QuickLink:** Tự động tạo mã QR nạp ví cho Thầy thuốc theo cú pháp `NAPVI <SĐT>`.
- **Ví Ký Quỹ Kiểu Grab:** Tạm giữ 15% phí nền tảng khi nhận ca, không phạt tiền cọc khi hủy ca nhằm bảo vệ an toàn cho Thầy thuốc.
- **Bệnh Án 3 Mục Chuẩn Y Khoa:** Chẩn đoán/Mạch tượng - Thủ thuật & Đơn thuốc - Lời dặn & Hẹn tái khám.
