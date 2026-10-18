const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const PROJ = 'C:/Users/Admin/Desktop/app-dongy';
const envRaw = fs.readFileSync(path.join(PROJ, '.env.local'), 'utf8');
const env = {};
envRaw.split('\n').forEach((l) => {
  const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
});

// Gom toan bo ma nguon de do xem cot nao duoc ghi
const SRC_FILES = [
  'src/app/page.tsx',
  'src/components/PatientView.tsx',
  'src/components/PractitionerView.tsx',
  'src/components/AdminView.tsx',
  'src/components/AuthPortal.tsx',
  'supabase/migration-fix-logic.sql',
  'supabase/schema.sql',
];
let src = '';
SRC_FILES.forEach((f) => {
  try { src += fs.readFileSync(path.join(PROJ, f), 'utf8') + '\n'; } catch (e) {}
});

// Cot he thong, khong can ung dung ghi tay
const SYSTEM_COLS = new Set([
  'id', 'created_at', 'updated_at',
]);

(async () => {
  const c = new Client({ connectionString: env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();

  const r = await c.query(`
    SELECT table_name, column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name IN ('profiles','practitioner_profiles','wallets','bookings',
                         'wallet_transactions','services')
    ORDER BY table_name, ordinal_position
  `);

  const missing = [];
  const byTable = {};
  r.rows.forEach((row) => {
    (byTable[row.table_name] = byTable[row.table_name] || []).push(row);
  });

  console.log('='.repeat(72));
  console.log(' RA SOAT: COT NAO TREN SUPABASE CHUA DUOC UNG DUNG GHI DU LIEU');
  console.log('='.repeat(72));

  Object.keys(byTable).sort().forEach((t) => {
    const unwritten = byTable[t].filter((col) => {
      if (SYSTEM_COLS.has(col.column_name)) return false;
      // Coi la "co ghi" neu ten cot xuat hien trong ma nguon
      return !src.includes(col.column_name);
    });

    console.log('\n### ' + t + ' (' + byTable[t].length + ' cot) ###');
    if (unwritten.length === 0) {
      console.log('    Tat ca cot deu duoc ung dung dung den.');
    } else {
      unwritten.forEach((col) => {
        console.log('    CHUA DUNG: ' + col.column_name + '  (' + col.data_type + ')');
        missing.push(t + '.' + col.column_name);
      });
    }
  });

  // Kiem tra nguoc lai: cac cot QUAN TRONG co thuc su co du lieu khong
  console.log('\n' + '='.repeat(72));
  console.log(' KIEM TRA DU LIEU THUC TE CUA CAC COT QUAN TRONG');
  console.log('='.repeat(72));

  const checks = [
    ['bookings', 'symptom_notes', 'Trieu chung benh nhan nhap'],
    ['bookings', 'checkin_lat', 'GPS check-in cua thay thuoc'],
    ['bookings', 'checkin_distance_meters', 'Khoang cach check-in'],
    ['bookings', 'medical_diagnosis', 'Benh an muc 1'],
    ['bookings', 'treatment_notes', 'Benh an muc 2'],
    ['bookings', 'doctor_advice', 'Benh an muc 3'],
    ['bookings', 'patient_rating', 'Danh gia sao'],
    ['bookings', 'patient_review', 'Nhan xet cua benh nhan'],
    ['bookings', 'cancelled_at', 'Thoi diem huy'],
    ['bookings', 'cancel_reason', 'Ly do huy'],
    ['bookings', 'cancelled_by_role', 'Ai huy don'],
    ['practitioner_profiles', 'bio', 'Gioi thieu thay thuoc'],
    ['practitioner_profiles', 'rejection_reason', 'Ly do tu choi CCHN'],
    ['practitioner_profiles', 'verified_at', 'Thoi diem duyet CCHN'],
    ['practitioner_profiles', 'years_of_experience', 'So nam kinh nghiem'],
    ['practitioner_profiles', 'current_lat', 'Vi tri thay thuoc'],
    ['practitioner_profiles', 'cancelled_jobs', 'So ca da huy'],
    ['profiles', 'avatar_url', 'Anh dai dien'],
    ['profiles', 'default_address', 'Dia chi mac dinh'],
    ['services', 'duration_minutes', 'Thoi luong dich vu'],
  ];

  const rows = [];
  for (const [table, col, desc] of checks) {
    try {
      const q = await c.query(
        `SELECT count(*) AS tong, count(${col}) AS co_du_lieu FROM public.${table}`
      );
      rows.push({
        bang: table,
        cot: col,
        y_nghia: desc,
        tong_dong: q.rows[0].tong,
        co_du_lieu: q.rows[0].co_du_lieu,
        trang_thai: Number(q.rows[0].co_du_lieu) > 0 ? 'CO' : 'TRONG',
      });
    } catch (e) {
      rows.push({ bang: table, cot: col, y_nghia: desc, trang_thai: 'LOI: ' + e.message });
    }
  }
  console.table(rows);

  console.log('\n--- TONG KET ---');
  if (missing.length === 0) {
    console.log('    Khong co cot nao bi bo quen trong ma nguon.');
  } else {
    console.log('    Cot chua duoc ma nguon dung den: ' + missing.join(', '));
  }

  await c.end();
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
