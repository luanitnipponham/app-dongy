# 📋 TÀI LIỆU BÀN GIAO TOÀN DIỆN CHO AI TIẾP TỤC PHÁT TRIỂN DỰ ÁN
> **Dự án:** App Đông Y Homecare (Nền tảng Đặt Lịch Khám Chữa Bệnh Y Học Cổ Truyền Tại Nhà Theo Mô Hình Grab)  
> **Ngày cập nhật:** 18/10/2026  
> **Trạng thái hệ thống:** Đã vượt qua **100% 7 Tầng Kiểm Thử An Toàn (`npm run test:layers`)** - Build thành công 0 lỗi.

---

## ⚡ 1. PROMPT MẪU 1 CHẠM GIAO VIỆC CHO AI TIẾP THEO
*(Bạn chỉ cần copy toàn bộ đoạn text trong khung dưới đây và dán vào cửa sổ chat của bất kỳ AI nào: Claude 3.5 Sonnet, GPT-4o, Cursor, Windsurf, hoặc Antigravity):*

```markdown
Chào bạn, tôi đang phát triển dự án "App Đông Y Homecare" (hệ thống đặt lịch khám chữa bệnh Đông y tại nhà kiểu Grab).
Trước khi bắt đầu, bạn hãy ĐỌC KỸ file `AI_HANDOFF.md` và file `wfdongy.md` ở thư mục gốc của dự án.
Dự án hiện đã hoàn tất 100% 7 tầng kiểm thử (`npm run test:layers` PASS), code chạy Next.js 16 (App Router) + Supabase Realtime + PostgreSQL.

Nhiệm vụ của bạn trong phiên làm việc này là:
[HÃY ĐIỀN NHIỆM VỤ BẠN MUỐN LÀM Ở ĐÂY, VÍ DỤ:
- Phát triển thêm tính năng gửi tin nhắn Chat trực tiếp giữa Bệnh nhân và Thầy thuốc
- Tích hợp Webhook SePAY/Casso tự động cộng tiền Ví khi quét VietQR
- Xuất file PDF Sổ Bệnh Án điện tử để in ra giấy cho Bệnh nhân
- Hoặc kiểm tra và deploy hoàn chỉnh lên Vercel]

Yêu cầu bất di bất dịch:
1. Tuyệt đối tuân thủ 5 Nguyên tắc Nghiệp vụ cốt lõi (eKYC Chứng chỉ hành nghề, Cô lập 1-1, Mô hình Ví Grab không phạt cọc, Google Maps 2 bánh miễn phí, Chống spam).
2. Sau khi viết code xong, luôn chạy `npm run test:layers` và `npm run build` để bảo đảm hệ thống không bị lỗi.
```

---

## 🏗️ 2. TỔNG QUAN KIẾN TRÚC & TECH STACK

| Thành phần | Công nghệ / Phiên bản | Chi tiết sử dụng |
| :--- | :--- | :--- |
| **Framework** | Next.js 16.4.2 (App Router, Turbopack) | Server Components & Client Components tối ưu SEO, Mobile-First PWA |
| **Giao diện** | React 19.3.0 + Tailwind CSS v4 | Thiết kế Mobile-First phong cách Y tế cao cấp, màu Xanh Ngọc Trúc Lam & Hổ Phách Đông Y |
| **Icons** | Lucide React | Toàn bộ biểu tượng y tế, định vị, ví tiền, xếp hạng |
| **Backend & DB** | Supabase (PostgreSQL 15+) | Kết nối qua Pooler Sydney (Port 6543) + Supabase Realtime WebSockets |
| **Fallback Sync** | 5s Polling Mechanism | Cơ chế đồng bộ ngầm dự phòng tự hồi phục state nếu mất kết nối socket |
| **Bản đồ** | Google Maps Universal Deep Link | `travelmode=two-wheeler`, mở app Google Maps trên điện thoại miễn phí 100% |
| **Thanh toán QR** | VietQR QuickLink Generator | Tự động tạo mã QR nạp tiền ví điền sẵn tài khoản & nội dung cú pháp |

---

## 🔒 3. 5 NGUYÊN TẮC NGHIỆP VỤ BẮT BUỘC (CORE BUSINESS RULES)

1. **eKYC Gatekeeper & Chứng chỉ hành nghề (CCHN):**
   - Thầy thuốc khi đăng ký **bắt buộc** nhập Số CCHN (`license_number`), Nơi cấp (`issued_by`) và ảnh chụp giấy phép (`license_image_url`).
   - Tài khoản mới tạo mặc định `is_verified = false`. Khi đăng nhập, Thầy thuốc bị khóa tại màn hình *"Chờ Admin thẩm định CCHN"*, không được bật Online hay nhận bệnh nhân.
   - Chỉ Admin mới có quyền duyệt (`is_verified = true`) để kích hoạt Thầy thuốc.

2. **Cô lập dữ liệu 1-1 (Strict Pairwise Isolation):**
   - Khi Bệnh nhân A đặt lịch với Thầy thuốc B (hoặc Thầy thuốc B bấm nhận ca tự do), chỉ duy nhất Bệnh nhân A và Thầy thuốc B thấy ca khám và bệnh án của nhau. Các thầy thuốc khác (C, D) hoàn toàn không thấy.
   - **Che SĐT chống "đi đêm":** Khi đơn ở trạng thái `PENDING`, SĐT bệnh nhân bị che dạng `0901***567`. Chỉ khi Thầy thuốc bấm **"Nhận Ca Khám"** (hệ thống đã tạm khóa phí nền tảng trong Ví), toàn bộ SĐT, nút Gọi điện, nút Zalo và Địa chỉ mới được mở khóa.
   - Admin có quyền xem 100% dữ liệu toàn sàn và có quyền điều phối/đổi thầy thuốc khi cần.

3. **Mô hình Phí Nền Tảng Kiểu Grab & Không Phạt Cọc (Bảo Vệ Thầy Thuốc):**
   - Khi nhận ca: Hệ thống tạm giữ (`LOCK_COMMISSION`) 15% phí dịch vụ trong Ví Tín Dụng.
   - Khi hoàn tất khám và lưu bệnh án 3 mục: Khấu trừ vĩnh viễn (`DEDUCT_COMMISSION`).
   - **Cơ chế an toàn phòng chống lừa đảo:** Thầy thuốc có nút **"Báo bận / Hủy ca"** in đậm nổi bật. Nếu phát hiện khách có dấu hiệu bất thường, nghi vấn lừa đảo hoặc có việc khẩn cấp, Thầy thuốc được quyền HỦY CA NGAY LẬP TỨC. Hệ thống **hoàn trả 100% tiền tạm giữ (`REFUND_LOCK`)**, tuyệt đối không phạt tiền cọc, không trừ điểm uy tín.

4. **Chỉ đường Google Maps 1 Chạm Miễn Phí 100%:**
   - Sử dụng hàm `getGoogleMapsDirectionsUrl(destAddress, lat, lng)` kích hoạt Deep Link `travelmode=two-wheeler`, tự động bật app Google Maps trên Android/iOS mà không tốn chi phí Google Maps API.

5. **Ghi nhận GPS Mềm & Chống Spam:**
   - Check-in tại nhà khách ghi nhận tọa độ GPS thực tế và tính khoảng cách (nếu lệch xa chỉ cảnh báo nhắc nhở chứ không khóa cứng, tránh lỗi GPS trong chung cư cao tầng hoặc hẻm sâu).
   - Bộ lọc chặn spam: Khóa nút submit ngay lập tức (`isSubmitting`) và chặn tạo đơn trùng lặp cùng bệnh nhân & dịch vụ trong 10 giây.

---

## 📂 4. BẢN ĐỒ CÁC FILE QUAN TRỌNG TRONG DỰ ÁN

```
app-dongy/
├── AI_HANDOFF.md                  <-- TÀI LIỆU BÀN GIAO NÀY
├── wfdongy.md                     <-- ĐẶC TẢ KỸ THUẬT GỐC & QUY TRÌNH MASTER
├── README.md                      <-- Giới thiệu dự án & hướng dẫn chạy nhanh
├── .env.local                     <-- Chứa NEXT_PUBLIC_SUPABASE_URL và ANON_KEY
├── package.json                   <-- Scripts, dependencies Next.js, Supabase, Lucide
│
├── supabase/
│   └── schema.sql                 <-- Toàn bộ DDL, bảng, ENUMs, triggers và 3 hàm RPC
│
├── src/
│   ├── app/
│   │   ├── layout.tsx             <-- Layout chuẩn Mobile-First PWA
│   │   ├── globals.css            <-- Tailwind CSS v4 theme & components
│   │   └── page.tsx               <-- Orchestrator quản lý State, Realtime, Polling, Routing
│   │
│   ├── components/
│   │   ├── AuthPortal.tsx         <-- Cổng Đăng nhập/Đăng ký thông minh (3 Role, eKYC)
│   │   ├── PatientView.tsx        <-- Phân hệ Bệnh nhân (Đặt lịch, Sổ bệnh án 3 mục, Đánh giá)
│   │   ├── PractitionerView.tsx   <-- Phân hệ Thầy thuốc (Gatekeeper CCHN, Nhận ca Grab, Bản đồ, Ví VietQR)
│   │   └── AdminView.tsx          <-- Phân hệ Admin (Duyệt eKYC, Quản lý dịch vụ, Điều phối, Reset pass)
│   │
│   ├── lib/
│   │   ├── mock-data.ts           <-- Dữ liệu mẫu khởi tạo chuẩn (Seed Profiles, Bookings, Services)
│   │   ├── utils-medical.ts       <-- Hàm tính VietQR, Google Maps URL, GPS Haversine, Chuẩn hóa SĐT
│   │   └── supabase/
│   │       └── client.ts          <-- Supabase Client Instance (Browser / SSR)
│   │
│   ├── scripts/
│   │   ├── verify-7-layers.js     <-- Kịch bản kiểm thử tự động 7 TẦNG AN TOÀN
│   │   ├── update-fkeys.js        <-- Script cập nhật CASCADE delete cho PostgreSQL
│   │   └── migrate.js             <-- Script migration tự động
│   │
│   └── types/
│       └── database.ts            <-- Toàn bộ Types & Interfaces TypeScript
```

---

## 🗄️ 5. CƠ SỞ DỮ LIỆU POSTGRESQL & RPC TRÊN SUPABASE

Hệ thống hoạt động trên 5 bảng dữ liệu cốt lõi (xem chi tiết tại [`supabase/schema.sql`](file:///c:/Users/Admin/Desktop/app-dongy/supabase/schema.sql)):

1. **`public.profiles`**: Tài khoản người dùng (id, phone UNIQUE, password_hash, full_name, role: `PATIENT` | `PRACTITIONER` | `ADMIN`, is_active).
2. **`public.practitioner_profiles`**: Hồ sơ Thầy thuốc (user_id FK, license_number, license_image_url, issued_by, is_verified, is_online, rating_avg, base_service_fee, commission_rate...).
3. **`public.wallets`**: Ví tín dụng của Thầy thuốc (user_id FK, available_balance, locked_balance).
4. **`public.bookings`**: Lịch khám chữa bệnh (booking_code, patient_id FK, practitioner_id FK, service_name, address, patient_phone, lat, lng, symptom_notes, service_fee, travel_surcharge, commission_rate, commission_amount, status, medical_diagnosis, treatment_notes, doctor_advice, cancelled_at, cancel_reason...).
5. **`public.wallet_transactions`**: Sổ cái giao dịch ví (wallet_id FK, booking_id FK, amount, type: `DEPOSIT` | `LOCK_COMMISSION` | `DEDUCT_COMMISSION` | `REFUND_LOCK`, balance_after).

### 3 Hàm RPC PostgreSQL quan trọng:
- `accept_booking_with_escrow(p_booking_id, p_practitioner_id)`: Thẩm định CCHN -> Kiểm tra cô lập -> Tạm khóa phí nền tảng trong ví -> Đổi status thành `CONFIRMED`.
- `complete_booking_and_deduct_commission(p_booking_id, p_practitioner_id, p_diagnosis, p_treatment, p_advice)`: Lưu bệnh án 3 mục -> Khấu trừ phí nền tảng từ khoản tạm giữ -> Tăng số ca hoàn tất.
- `cancel_booking_and_refund_lock(p_booking_id, p_cancelled_by_role)`: Đổi status thành `CANCELLED_PATIENT` hoặc `CANCELLED_DOCTOR` -> Hoàn trả 100% tiền tạm giữ về Ví khả dụng (Không phạt cọc).

---

## 🧪 6. KẾT QUẢ KIỂM THỬ 7 TẦNG (PASS 100%)

Chạy lệnh kiểm tra bất kỳ lúc nào:
```bash
npm run test:layers
```

Kết quả đã được kiểm chứng tự động:
- **Tầng 1 (Môi trường):** Supabase URL & Anon Key hợp lệ trong `.env.local`.
- **Tầng 2 (PostgreSQL):** Kết nối Pooler Sydney port 6543, đầy đủ 5/5 bảng, FK cascade hoàn hảo.
- **Tầng 3 (Tài khoản):** 100% số điện thoại là duy nhất, không trùng lặp tài khoản.
- **Tầng 4 (Ví tín dụng):** 100% ví có số dư >= 0, logic khóa tiền chuẩn xác.
- **Tầng 5 (Cô lập 1-1):** 100% đơn liên kết đúng bệnh nhân và thầy thuốc, tuân thủ ENUM status.
- **Tầng 6 (Chống spam):** Disable nút khi submit + cooldown 10 giây chặn đúp đơn.
- **Tầng 7 (Build Next.js):** `npm run build` hoàn tất 100% với 0 lỗi TypeScript (Strict Mode).

---

## 🔑 7. TÀI KHOẢN DÙNG THỬ (DEMO QUICK LOGIN)

| Vai trò | Họ tên | Số điện thoại | Mật khẩu | Trạng thái |
| :--- | :--- | :--- | :--- | :--- |
| **Bệnh nhân** | Nguyễn Văn An | `0901234567` | `123456` | Hoạt động bình thường |
| **Bệnh nhân** | Trần Thị Bích Ngọc | `0909999888` | `123456` | Hoạt động bình thường |
| **Thầy thuốc** | Lương y Trần Hữu Đức | `0988777666` | `123456` | Đã duyệt CCHN (`is_verified = true`) |
| **Thầy thuốc** | BS. Lê Thị Mai | `0912345678` | `123456` | Đã duyệt CCHN (`is_verified = true`) |
| **Thầy thuốc** | BS. Phạm Minh Tuấn | `0977555444` | `123456` | Chờ duyệt CCHN (`is_verified = false`) |
| **Admin** | Quản Trị Hệ Thống | `0999888999` | `123456` | Toàn quyền quản trị sàn |

---

## 🚀 8. LỘ TRÌNH CÔNG VIỆC TIẾP THEO (GỢI Ý CHO PHIÊN LÀM VIỆC TỚI)

Nếu bạn muốn giao việc cho AI tiếp theo xây dựng thêm tính năng, dưới đây là danh sách ưu tiên cao:

1. **Thông Báo Đẩy Thời Gian Thực (Push Notifications / Zalo ZNS / SMS):**
   - Khi Bệnh nhân đặt lịch -> Gửi thông báo ngay cho Thầy thuốc.
   - Khi Thầy thuốc nhận lịch / bấm On the way -> Bệnh nhân nhận chuông báo.
2. **Tích Hợp Tự Động Duyệt Nạp Tiền VietQR (Webhook SePAY hoặc Casso):**
   - Hiện tại Thầy thuốc nạp tiền bằng cách chuyển khoản theo mã VietQR tạo sẵn. Có thể tích hợp webhook bắt biến động số dư ngân hàng để tự động cộng `available_balance` trong bảng `wallets`.
3. **Chat Trực Tiếp Thời Gian Thực (In-app Realtime Chat):**
   - Tạo bảng `messages` (booking_id, sender_id, receiver_id, content, created_at) để Bệnh nhân và Thầy thuốc nhắn tin trực tiếp trong app bên cạnh nút Zalo/Gọi điện.
4. **Xuất PDF Sổ Bệnh Án Điện Tử (Export Medical Record):**
   - Thêm nút "Tải PDF Bệnh Án" tại tab Sổ Bệnh Án để bệnh nhân lưu về máy hoặc in ra giấy nộp bảo hiểm.
5. **Triển Khai Lên Vercel (Production Deployment):**
   - Đã cấu hình sẵn, chỉ cần kết nối repo GitHub với Vercel và nạp biến môi trường từ `.env.local`.

---

## 🛠️ 9. CÁC LỆNH CẦN THIẾT

- `npm run dev`: Chạy server phát triển tại [http://localhost:3000](http://localhost:3000)
- `npm run test:layers`: Chạy bộ chẩn đoán tự động 7 tầng an toàn
- `npm run build`: Kiểm tra biên dịch production của Next.js
- `git status` / `git push`: Đẩy commit lên GitHub
