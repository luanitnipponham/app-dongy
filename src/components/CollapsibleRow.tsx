'use client';

import React from 'react';
import { ChevronDown } from 'lucide-react';

/**
 * DÒNG DANH SÁCH THU GỌN DÙNG CHUNG CHO CẢ 3 PHÂN HỆ
 *
 * Vấn đề: các danh sách (đơn khám, hồ sơ CCHN, tài khoản người dùng, sổ bệnh án)
 * trước đây mở sẵn toàn bộ chi tiết, nên một màn hình có thể dài hàng nghìn pixel
 * và gần như không kiểm soát được trên điện thoại.
 *
 * Cách giải quyết: mỗi mục chỉ còn 1 dòng tiêu đề gọn chứa đủ thông tin nhận diện
 * (mã, nhãn trạng thái, tên, số tiền). Bấm vào mới mở phần chi tiết bên dưới.
 */

export type RowAccent = 'purple' | 'emerald' | 'teal' | 'amber' | 'rose' | 'slate';

const ACCENT_OPEN: Record<RowAccent, string> = {
  purple: 'bg-purple-50/60',
  emerald: 'bg-emerald-50/60',
  teal: 'bg-teal-50/60',
  amber: 'bg-amber-50/60',
  rose: 'bg-rose-50/60',
  slate: 'bg-slate-50',
};

const ACCENT_ICON: Record<RowAccent, string> = {
  purple: 'text-purple-700',
  emerald: 'text-emerald-700',
  teal: 'text-teal-700',
  amber: 'text-amber-700',
  rose: 'text-rose-700',
  slate: 'text-slate-700',
};

interface CollapsibleRowProps {
  isOpen: boolean;
  onToggle: () => void;
  /** Mã ngắn hiển thị mờ ở đầu dòng (mã đơn, số CCHN, SĐT...) */
  code?: React.ReactNode;
  /** Nhãn trạng thái nằm cạnh mã */
  badge?: React.ReactNode;
  /** Dòng chữ chính */
  title: React.ReactNode;
  /** Dòng phụ mô tả ngắn */
  subtitle?: React.ReactNode;
  /** Khối thông tin bên phải (số tiền, điểm sao...) */
  right?: React.ReactNode;
  /** Ảnh đại diện / chữ cái đầu bên trái */
  leading?: React.ReactNode;
  accent?: RowAccent;
  /**
   * Chế độ nén: gộp mã + nhãn + tiêu đề lên CÙNG MỘT DÒNG.
   * Dùng cho các danh sách tra cứu dài (lịch sử khám) nơi các mục gần giống
   * nhau, bày 3 dòng cho mỗi mục làm màn hình dài gấp ba mà không thêm thông tin.
   */
  dense?: boolean;
  children: React.ReactNode;
}

export default function CollapsibleRow({
  isOpen,
  onToggle,
  code,
  badge,
  title,
  subtitle,
  right,
  leading,
  accent = 'slate',
  dense = false,
  children,
}: CollapsibleRowProps) {
  return (
    <div className="rounded-2xl bg-white border border-slate-200 shadow-xs overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        className={`w-full text-left flex items-center gap-2.5 transition-colors ${
          dense ? 'px-3 py-2' : 'p-3.5'
        } ${isOpen ? ACCENT_OPEN[accent] : 'hover:bg-slate-50'}`}
      >
        <ChevronDown
          className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${
            isOpen ? `rotate-180 ${ACCENT_ICON[accent]}` : ''
          }`}
        />

        {leading}

        {dense ? (
          // Một dòng duy nhất: mã · nhãn · tên · mô tả phụ
          <div className="min-w-0 flex-1 flex items-center gap-2">
            {code && (
              <span className="font-mono font-bold text-[11px] text-slate-400 shrink-0">
                {code}
              </span>
            )}
            {badge}
            <span className="text-xs font-bold text-slate-900 truncate">{title}</span>
            {subtitle && (
              <span className="text-[11px] text-slate-400 truncate hidden sm:inline shrink-0">
                {subtitle}
              </span>
            )}
          </div>
        ) : (
          <div className="min-w-0 flex-1">
            {(code || badge) && (
              <div className="flex items-center gap-1.5 flex-wrap">
                {code && (
                  <span className="font-mono font-bold text-[11px] text-slate-500">{code}</span>
                )}
                {badge}
              </div>
            )}
            <div className="text-xs font-bold text-slate-900 truncate mt-0.5">{title}</div>
            {subtitle && <div className="text-[11px] text-slate-500 truncate">{subtitle}</div>}
          </div>
        )}

        {right && <div className="text-right shrink-0">{right}</div>}
      </button>

      {isOpen && (
        <div className="px-3.5 pb-3.5 pt-3 space-y-3 border-t border-slate-100 bg-slate-50/40">
          {children}
        </div>
      )}
    </div>
  );
}
