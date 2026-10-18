/**
 * ============================================================================
 * ĐỐI SOÁT & HOÀN TRẢ TIỀN TẠM GIỮ BỊ TREO TRONG VÍ THẦY THUỐC
 *
 * BỐI CẢNH: Các phiên bản cũ của ứng dụng hủy đơn bằng một lệnh UPDATE chỉ đổi
 * `status`, KHÔNG hoàn lại khoản `locked_balance` đã tạm giữ. Hậu quả là tiền
 * của Thầy thuốc bị giam vĩnh viễn, vi phạm nguyên tắc "Không phạt cọc".
 *
 * Lỗi đã được sửa trong mã nguồn (mọi lệnh hủy nay đi qua RPC
 * `cancel_booking_and_refund_lock`), nhưng các khoản treo CŨ vẫn còn trên DB.
 * Script này dọn nốt phần tồn đọng đó.
 *
 * NGUYÊN TẮC AN TOÀN:
 *   - Mặc định CHỈ XEM (dry-run), không ghi gì cả.
 *   - Muốn ghi thật phải truyền tham số --apply.
 *   - Mọi thay đổi nằm trong MỘT transaction, lỗi giữa chừng là rollback sạch.
 *   - Mỗi khoản hoàn đều ghi một dòng REFUND_LOCK vào sổ cái để truy vết.
 *   - Chỉ hoàn cho đơn ĐÃ HỦY mà ĐÃ TỪNG bị khóa tiền và CHƯA từng được hoàn.
 *
 * CÁCH CHẠY:
 *   npm run reconcile:wallets           -> chỉ xem, không ghi
 *   npm run reconcile:wallets -- --apply -> ghi thật
 * ============================================================================
 */

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const APPLY = process.argv.includes('--apply');
const PROJ = path.join(__dirname, '../..');

const envRaw = fs.readFileSync(path.join(PROJ, '.env.local'), 'utf8');
const env = {};
envRaw.split('\n').forEach((l) => {
  const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
});

const vnd = (n) => Number(n).toLocaleString('vi-VN') + ' d';

(async () => {
  const c = new Client({
    connectionString: env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await c.connect();

  console.log('='.repeat(70));
  console.log(' DOI SOAT TIEN TAM GIU BI TREO TRONG VI THAY THUOC');
  console.log(' Che do: ' + (APPLY ? '*** GHI THAT (--apply) ***' : 'CHI XEM (dry-run)'));
  console.log('='.repeat(70));

  // ------------------------------------------------------------------
  // 1. Cac don DA HUY, DA TUNG khoa tien, nhung CHUA he duoc hoan
  // ------------------------------------------------------------------
  const stuck = await c.query(`
    SELECT b.id, b.booking_code, b.status, b.commission_amount,
           b.practitioner_id, p.full_name AS thay_thuoc, w.id AS wallet_id,
           w.available_balance, w.locked_balance
    FROM public.bookings b
    JOIN public.profiles p ON p.id = b.practitioner_id
    JOIN public.wallets  w ON w.user_id = b.practitioner_id
    WHERE b.status IN ('CANCELLED_PATIENT','CANCELLED_DOCTOR')
      AND EXISTS (SELECT 1 FROM public.wallet_transactions t
                  WHERE t.booking_id = b.id AND t.type = 'LOCK_COMMISSION')
      AND NOT EXISTS (SELECT 1 FROM public.wallet_transactions t
                      WHERE t.booking_id = b.id AND t.type = 'REFUND_LOCK')
    ORDER BY p.full_name, b.booking_code
  `);

  console.log('\n--- (A) DON DA HUY NHUNG CHUA HOAN TIEN TAM GIU ---');
  if (stuck.rows.length === 0) {
    console.log('    Khong co don nao. Sach.');
  } else {
    console.table(
      stuck.rows.map((r) => ({
        ma_don: r.booking_code,
        thay_thuoc: r.thay_thuoc,
        trang_thai: r.status,
        can_hoan: vnd(r.commission_amount),
      }))
    );
  }

  // ------------------------------------------------------------------
  // 2. Doi chieu locked_balance thuc te vs so tien DANG THUC SU bi khoa
  //    (chi cac don dang chay moi duoc phep giu tien)
  // ------------------------------------------------------------------
  const drift = await c.query(`
    SELECT w.id AS wallet_id, p.full_name AS thay_thuoc,
           w.available_balance, w.locked_balance,
           COALESCE((SELECT SUM(b.commission_amount) FROM public.bookings b
                     WHERE b.practitioner_id = w.user_id
                       AND b.status IN ('CONFIRMED','ON_THE_WAY','IN_PROGRESS')), 0)
             AS locked_dung_ra
    FROM public.wallets w
    JOIN public.profiles p ON p.id = w.user_id
    ORDER BY p.full_name
  `);

  console.log('\n--- (B) DOI CHIEU SO DU TAM GIU TUNG VI ---');
  console.table(
    drift.rows.map((r) => ({
      thay_thuoc: r.thay_thuoc,
      kha_dung: vnd(r.available_balance),
      dang_giu: vnd(r.locked_balance),
      dung_ra_phai_giu: vnd(r.locked_dung_ra),
      chenh_lech: vnd(Number(r.locked_balance) - Number(r.locked_dung_ra)),
    }))
  );

  const totalStuck = drift.rows.reduce(
    (s, r) => s + Math.max(0, Number(r.locked_balance) - Number(r.locked_dung_ra)),
    0
  );

  console.log('\n--- KET LUAN ---');
  console.log('    So don can hoan tien  : ' + stuck.rows.length);
  console.log('    Tong tien dang bi treo: ' + vnd(totalStuck));

  if (totalStuck === 0) {
    console.log('\n    Khong co gi phai sua.');
    await c.end();
    return;
  }

  if (!APPLY) {
    console.log('\n    Day moi la BAN XEM TRUOC, chua ghi gi vao database.');
    console.log('    Muon thuc hien that, chay:  npm run reconcile:wallets -- --apply');
    await c.end();
    return;
  }

  // ------------------------------------------------------------------
  // 3. GHI THAT - tat ca trong mot transaction
  // ------------------------------------------------------------------
  console.log('\n--- DANG GHI VAO DATABASE ---');
  await c.query('BEGIN');
  try {
    // 3a. Ghi mot dong REFUND_LOCK cho tung don bi treo (de truy vet)
    for (const r of stuck.rows) {
      await c.query(
        `INSERT INTO public.wallet_transactions
           (wallet_id, booking_id, amount, type, balance_after, description)
         VALUES ($1, $2, $3, 'REFUND_LOCK', 0,
                 'Doi soat he thong: hoan tra 100% phi tam giu con treo cua don '
                 || $4 || ' (Khong phat coc)')`,
        [r.wallet_id, r.id, r.commission_amount, r.booking_code]
      );
      console.log(
        `    + ${r.booking_code} | ${r.thay_thuoc} | hoan ${vnd(r.commission_amount)}`
      );
    }

    // 3b. Dat lai locked_balance dung bang tong cac ca DANG CHAY,
    //     phan chenh lech tra ve available_balance
    const upd = await c.query(`
      WITH dung_ra AS (
        SELECT w.id AS wallet_id,
               COALESCE((SELECT SUM(b.commission_amount) FROM public.bookings b
                         WHERE b.practitioner_id = w.user_id
                           AND b.status IN ('CONFIRMED','ON_THE_WAY','IN_PROGRESS')), 0)
                 AS can_giu,
               w.locked_balance AS dang_giu
        FROM public.wallets w
      )
      UPDATE public.wallets w
      SET available_balance = w.available_balance + (d.dang_giu - d.can_giu),
          locked_balance    = d.can_giu,
          updated_at        = NOW()
      FROM dung_ra d
      WHERE w.id = d.wallet_id AND d.dang_giu <> d.can_giu
      RETURNING w.user_id, w.available_balance, w.locked_balance
    `);

    // 3c. Ghi lai balance_after cho dung sau khi so du da chot
    await c.query(`
      UPDATE public.wallet_transactions t
      SET balance_after = w.available_balance
      FROM public.wallets w
      WHERE t.wallet_id = w.id
        AND t.balance_after = 0
        AND t.description LIKE 'Doi soat he thong:%'
    `);

    await c.query('COMMIT');
    console.log(`\n    Da cap nhat ${upd.rowCount} vi. HOAN TAT.`);
  } catch (e) {
    await c.query('ROLLBACK');
    console.error('\n    LOI -> da ROLLBACK, database giu nguyen:', e.message);
    await c.end();
    process.exit(1);
  }

  // ------------------------------------------------------------------
  // 4. Kiem tra lai sau khi ghi
  // ------------------------------------------------------------------
  const after = await c.query(`
    SELECT p.full_name AS thay_thuoc, w.available_balance, w.locked_balance,
           COALESCE((SELECT SUM(b.commission_amount) FROM public.bookings b
                     WHERE b.practitioner_id = w.user_id
                       AND b.status IN ('CONFIRMED','ON_THE_WAY','IN_PROGRESS')), 0)
             AS locked_dung_ra
    FROM public.wallets w JOIN public.profiles p ON p.id = w.user_id
    ORDER BY p.full_name
  `);

  console.log('\n--- KIEM TRA LAI SAU KHI GHI ---');
  console.table(
    after.rows.map((r) => ({
      thay_thuoc: r.thay_thuoc,
      kha_dung: vnd(r.available_balance),
      dang_giu: vnd(r.locked_balance),
      dung_ra_phai_giu: vnd(r.locked_dung_ra),
      khop:
        Number(r.locked_balance) === Number(r.locked_dung_ra) ? 'DUNG' : 'VAN LECH',
    }))
  );

  await c.end();
})().catch((e) => {
  console.error('FATAL:', e.message);
  process.exit(1);
});
