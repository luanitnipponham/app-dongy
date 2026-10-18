import { supabase, isSupabaseConfigured } from '@/lib/supabase/client';

/**
 * ===========================================================================
 * ĐỒNG HỒ CHUẨN LẤY TỪ SERVER (CHỐNG THIẾT BỊ SAI GIỜ)
 * ===========================================================================
 * Điện thoại / máy tính của Bệnh nhân và Thầy thuốc có thể bị sai giờ, sai múi
 * giờ, hoặc bị chỉnh lệch cố ý. Nếu tin vào `Date.now()` của thiết bị thì:
 *   - "Còn bao lâu tới giờ hẹn" hiển thị sai cho cả hai bên;
 *   - Kiểm tra trùng lịch Thầy thuốc sai;
 *   - Chặn đặt lịch trong quá khứ bị vô hiệu (chỉnh lùi đồng hồ là đặt được).
 *
 * Cách làm: khi có mạng, gọi RPC `get_server_time()` của Supabase để lấy giờ
 * chuẩn, tính ĐỘ LỆCH giữa đồng hồ máy và đồng hồ server, rồi mọi nơi dùng
 * `serverNow()` thay cho `Date.now()`.
 *
 * Khi mất mạng: giữ nguyên độ lệch đã đồng bộ lần gần nhất, vẫn chính xác vì
 * đồng hồ thiết bị chạy đều, chỉ bị lệch gốc.
 */

// Độ lệch (ms) cần CỘNG vào Date.now() để ra giờ server
let clockOffsetMs = 0;
let isSynced = false;
let lastSyncAt = 0;
let syncInFlight: Promise<boolean> | null = null;

/** Các component muốn vẽ lại khi đồng hồ được đồng bộ xong */
type Listener = () => void;
const listeners = new Set<Listener>();

function notify() {
  listeners.forEach((fn) => {
    try {
      fn();
    } catch {
      /* bỏ qua lỗi của từng listener */
    }
  });
}

/** Đăng ký nhận thông báo khi đồng hồ đồng bộ xong. Trả về hàm hủy đăng ký. */
export function onClockSync(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/**
 * Thời điểm hiện tại theo ĐỒNG HỒ SERVER (mili-giây epoch).
 * Dùng thay cho Date.now() ở mọi chỗ liên quan tới lịch hẹn.
 */
export function serverNow(): number {
  return Date.now() + clockOffsetMs;
}

/** Đối tượng Date theo giờ server */
export function serverDate(): Date {
  return new Date(serverNow());
}

/** Đồng hồ đã đồng bộ được với server chưa */
export function isClockSynced(): boolean {
  return isSynced;
}

/** Đồng hồ thiết bị đang lệch bao nhiêu mili-giây so với server (dương = máy chậm) */
export function getClockOffsetMs(): number {
  return clockOffsetMs;
}

/**
 * Đồng bộ đồng hồ với server Supabase.
 * Bù một nửa thời gian khứ hồi (round-trip) để bớt sai số đường truyền.
 */
export async function syncServerClock(): Promise<boolean> {
  if (!isSupabaseConfigured) return false;

  // Đang có một lần đồng bộ chạy dở thì dùng chung kết quả
  if (syncInFlight) return syncInFlight;

  syncInFlight = (async () => {
    try {
      const sentAt = Date.now();
      const { data, error } = await supabase.rpc('get_server_time');
      const receivedAt = Date.now();

      if (error || !data) {
        if (error) console.warn('Không lấy được giờ server:', error.message);
        return false;
      }

      const serverMs = new Date(data as string).getTime();
      if (Number.isNaN(serverMs)) return false;

      // Giả định độ trễ đi và về bằng nhau -> giờ server ứng với giữa quãng khứ hồi
      const roundTrip = receivedAt - sentAt;
      const localMidpoint = sentAt + roundTrip / 2;

      clockOffsetMs = serverMs - localMidpoint;
      isSynced = true;
      lastSyncAt = receivedAt;

      if (Math.abs(clockOffsetMs) > 60_000) {
        console.warn(
          `Đồng hồ thiết bị lệch ${Math.round(clockOffsetMs / 1000)} giây so với server. ` +
            'Ứng dụng đã tự bù để tính đúng giờ Việt Nam.'
        );
      }

      notify();
      return true;
    } catch (err) {
      console.warn('Lỗi đồng bộ đồng hồ server:', err);
      return false;
    } finally {
      syncInFlight = null;
    }
  })();

  return syncInFlight;
}

/** Thời điểm đồng bộ gần nhất (theo đồng hồ máy) */
export function getLastSyncAt(): number {
  return lastSyncAt;
}

/**
 * Bật đồng bộ định kỳ. Trả về hàm dọn dẹp.
 * Đồng bộ lại khi: khởi động, quay lại tab, có mạng trở lại, và mỗi 5 phút.
 */
export function startClockSync(intervalMs = 5 * 60 * 1000): () => void {
  void syncServerClock();

  const timer = setInterval(() => {
    void syncServerClock();
  }, intervalMs);

  const onVisible = () => {
    if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
      void syncServerClock();
    }
  };
  const onOnline = () => {
    void syncServerClock();
  };

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', onVisible);
  }
  if (typeof window !== 'undefined') {
    window.addEventListener('online', onOnline);
  }

  return () => {
    clearInterval(timer);
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', onVisible);
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', onOnline);
    }
  };
}
