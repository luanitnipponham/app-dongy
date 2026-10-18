import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Đông Y HomeCare - Đặt Lịch Khám Chữa Bệnh Tại Nhà Chuẩn eKYC",
  description: "Hệ thống đặt lịch khám chữa bệnh Y học Cổ truyền tại nhà chuẩn eKYC Y khoa, cô lập dữ liệu 1-1 và đối soát ví minh bạch.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="vi"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
