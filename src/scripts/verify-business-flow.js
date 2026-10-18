const fs = require('fs');
const path = require('path');
const PROJ = path.join(__dirname, '../..');
const envRaw = fs.readFileSync(path.join(PROJ, '.env.local'), 'utf8');
const env = {};
envRaw.split('\n').forEach((l) => {
  const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
});
const URL = env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const H = { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' };

async function rest(method, q, body, extra) {
  const r = await fetch(URL + '/rest/v1/' + q, {
    method,
    headers: Object.assign({}, H, extra || {}),
    body: body ? JSON.stringify(body) : undefined,
  });
  const t = await r.text();
  let j = null;
  try { j = JSON.parse(t); } catch (e) { j = null; }
  return { status: r.status, ok: r.ok, body: t, json: j };
}
async function rpc(name, args) {
  const r = await fetch(URL + '/rest/v1/rpc/' + name, {
    method: 'POST', headers: H, body: JSON.stringify(args),
  });
  const t = await r.text();
  return { status: r.status, ok: r.ok, body: t };
}
async function wallet(uid) {
  const r = await rest('GET', 'wallets?user_id=eq.' + uid + '&select=available_balance,locked_balance');
  return r.json && r.json[0] ? r.json[0] : { available_balance: null, locked_balance: null };
}
async function booking(id) {
  const r = await rest('GET', 'bookings?id=eq.' + id + '&select=status,practitioner_id,cancelled_by_role,cancelled_at,cancel_reason,medical_diagnosis');
  return r.json && r.json[0] ? r.json[0] : {};
}

let pass = 0, fail = 0;
function check(label, cond, extra) {
  if (cond) { console.log('   PASS  ' + label); pass++; }
  else { console.log('   FAIL  ' + label + (extra ? '  -> ' + extra : '')); fail++; }
}
function vnd(n) { return Number(n).toLocaleString('vi-VN'); }

const P  = { id: crypto.randomUUID(), phone: '0900000801', name: 'ZZTEST Benh nhan' };
const DA = { id: crypto.randomUUID(), phone: '0900000802', name: 'ZZTEST Thay thuoc A' };
const DB = { id: crypto.randomUUID(), phone: '0900000803', name: 'ZZTEST Thay thuoc B' };
const DC = { id: crypto.randomUUID(), phone: '0900000804', name: 'ZZTEST Thay thuoc C chua duyet' };
const now = new Date().toISOString();
const FEE = 400000, COMM = 60000;

async function cleanup() {
  for (const u of [P, DA, DB, DC]) await rest('DELETE', 'profiles?phone=eq.' + u.phone);
}

async function mkDoctor(d, verified, balance) {
  await rest('POST', 'profiles', [{
    id: d.id, phone: d.phone, password_hash: '123456', full_name: d.name,
    role: 'PRACTITIONER', is_active: true, created_at: now, updated_at: now,
  }]);
  await rest('POST', 'practitioner_profiles', [{
    id: crypto.randomUUID(), user_id: d.id, specialties: ['Cham cuu'],
    license_number: 'CCHN-ZZ-' + d.phone.slice(-3),
    license_image_url: 'https://example.com/x.jpg', issued_by: 'So Y Te',
    years_of_experience: 5, base_service_fee: FEE, commission_rate: 15.0,
    is_verified: verified, is_online: verified, rating_avg: 5.0, total_reviews: 0,
    completed_jobs: 0, cancelled_jobs: 0, updated_at: now,
  }]);
  await rest('POST', 'wallets', [{
    id: crypto.randomUUID(), user_id: d.id,
    available_balance: balance, locked_balance: 0, updated_at: now,
  }]);
}

async function mkBooking(practitionerId) {
  const id = crypto.randomUUID();
  const r = await rest('POST', 'bookings', [{
    id, booking_code: 'ZZ-' + id.slice(0, 6), patient_id: P.id,
    practitioner_id: practitionerId, service_name: 'ZZTEST Cham cuu',
    address: '1 Nguyen Hue, Quan 1, TP.HCM', patient_phone: P.phone,
    lat: 10.7769, lng: 106.6951,
    appointment_time: new Date(Date.now() + 7200000).toISOString(),
    service_fee: FEE, travel_surcharge: 0, commission_rate: 15.0,
    commission_amount: COMM, status: 'PENDING', created_at: now, updated_at: now,
  }]);
  if (!r.ok) { console.log('   (khong tao duoc booking: ' + r.body.slice(0, 200) + ')'); return null; }
  return id;
}

async function main() {
  console.log('=== CHUAN BI DU LIEU TEST ===');
  await cleanup();
  await rest('POST', 'profiles', [{
    id: P.id, phone: P.phone, password_hash: '123456', full_name: P.name,
    role: 'PATIENT', default_address: '1 Nguyen Hue, Quan 1, TP.HCM',
    is_active: true, created_at: now, updated_at: now,
  }]);
  await mkDoctor(DA, true, 500000);
  await mkDoctor(DB, true, 500000);
  await mkDoctor(DC, false, 500000);
  console.log('   1 benh nhan + 3 thay thuoc (A,B da duyet CCHN | C chua duyet)');

  let r, bk, wA, wB;

  console.log('\n=== TEST 1: eKYC Gatekeeper - chua duyet CCHN khong duoc nhan ca ===');
  const b1 = await mkBooking(null);
  r = await rpc('accept_booking_with_escrow', { p_booking_id: b1, p_practitioner_id: DC.id });
  check('RPC tu choi thay thuoc chua duyet CCHN', !r.ok && r.body.indexOf('duyệt Chứng chỉ') >= 0, r.body.slice(0, 150));
  check('Don van con PENDING', (await booking(b1)).status === 'PENDING');

  console.log('\n=== TEST 2: Thay thuoc A nhan ca -> tam giu 15% phi nen tang ===');
  r = await rpc('accept_booking_with_escrow', { p_booking_id: b1, p_practitioner_id: DA.id });
  check('RPC nhan ca thanh cong', r.ok, r.body.slice(0, 200));
  wA = await wallet(DA.id);
  check('Vi A: available 500.000 -> ' + vnd(wA.available_balance), Number(wA.available_balance) === 500000 - COMM);
  check('Vi A: locked 0 -> ' + vnd(wA.locked_balance), Number(wA.locked_balance) === COMM);
  bk = await booking(b1);
  check('Don CONFIRMED va gan dung thay thuoc A', bk.status === 'CONFIRMED' && bk.practitioner_id === DA.id);

  console.log('\n=== TEST 3: Co lap 1-1 - thay thuoc B khong gianh duoc don cua A ===');
  r = await rpc('accept_booking_with_escrow', { p_booking_id: b1, p_practitioner_id: DB.id });
  check('RPC chan thay thuoc thu hai', !r.ok, 'B gianh duoc don cua A!');
  wB = await wallet(DB.id);
  check('Vi B KHONG bi tru tien oan', Number(wB.available_balance) === 500000 && Number(wB.locked_balance) === 0);

  console.log('\n=== TEST 4: ADMIN DIEU PHOI doi thay thuoc A -> B (loi da bao) ===');
  r = await rpc('reassign_booking_to_practitioner', { p_booking_id: b1, p_new_practitioner_id: DB.id, p_reason: 'Thay thuoc A bao ban' });
  check('RPC dieu phoi thanh cong', r.ok, r.body.slice(0, 250));
  bk = await booking(b1);
  check('Don da gan sang thay thuoc B', bk.practitioner_id === DB.id);
  check('Don o trang thai CONFIRMED', bk.status === 'CONFIRMED');
  wA = await wallet(DA.id); wB = await wallet(DB.id);
  check('Thay thuoc A duoc HOAN 100% (av 500.000 / lk 0)',
    Number(wA.available_balance) === 500000 && Number(wA.locked_balance) === 0,
    'thuc te av=' + wA.available_balance + ' lk=' + wA.locked_balance);
  check('Thay thuoc B bi KHOA phi nen tang (av 440.000 / lk 60.000)',
    Number(wB.available_balance) === 500000 - COMM && Number(wB.locked_balance) === COMM,
    'thuc te av=' + wB.available_balance + ' lk=' + wB.locked_balance);

  console.log('\n=== TEST 5: Khong duoc dieu phoi sang nguoi CHUA duyet CCHN ===');
  r = await rpc('reassign_booking_to_practitioner', { p_booking_id: b1, p_new_practitioner_id: DC.id, p_reason: null });
  check('RPC chan dieu phoi sang nguoi chua duyet CCHN', !r.ok && r.body.indexOf('duyệt Chứng chỉ') >= 0, r.body.slice(0, 150));
  check('Don van thuoc thay thuoc B', (await booking(b1)).practitioner_id === DB.id);

  console.log('\n=== TEST 6: Hoan tat ca kham + luu benh an 3 muc + quyet toan phi ===');
  r = await rpc('complete_booking_and_deduct_commission', {
    p_booking_id: b1, p_practitioner_id: DB.id,
    p_diagnosis: 'Dau vai gay do phong han', p_treatment: 'Cham cuu 30 phut', p_advice: 'Tai kham sau 3 ngay',
  });
  check('RPC hoan tat thanh cong', r.ok, r.body.slice(0, 250));
  bk = await booking(b1); wB = await wallet(DB.id);
  check('Don COMPLETED + co benh an', bk.status === 'COMPLETED' && bk.medical_diagnosis === 'Dau vai gay do phong han');
  check('Vi B: QUYET TOAN phi (av 440.000 / lk 0)',
    Number(wB.available_balance) === 500000 - COMM && Number(wB.locked_balance) === 0,
    'thuc te av=' + wB.available_balance + ' lk=' + wB.locked_balance);

  console.log('\n=== TEST 7: Khong duoc dieu phoi / huy don DA HOAN TAT ===');
  r = await rpc('reassign_booking_to_practitioner', { p_booking_id: b1, p_new_practitioner_id: DA.id });
  check('Chan dieu phoi don da COMPLETED', !r.ok);
  r = await rpc('cancel_booking_and_refund_lock', { p_booking_id: b1, p_cancelled_by_role: 'ADMIN', p_cancel_reason: 'test' });
  check('Chan huy don da COMPLETED', !r.ok);

  console.log('\n=== TEST 8: Bao ban/Huy ca -> HOAN 100%, KHONG PHAT COC ===');
  const b2 = await mkBooking(null);
  await rpc('accept_booking_with_escrow', { p_booking_id: b2, p_practitioner_id: DA.id });
  wA = await wallet(DA.id);
  check('Da khoa phi nen tang truoc khi huy', Number(wA.locked_balance) === COMM);
  r = await rpc('cancel_booking_and_refund_lock', { p_booking_id: b2, p_cancelled_by_role: 'PRACTITIONER', p_cancel_reason: 'Nghi van benh nhan lua dao' });
  check('RPC huy ca thanh cong', r.ok, r.body.slice(0, 200));
  wA = await wallet(DA.id); bk = await booking(b2);
  check('HOAN 100% (av 500.000 / lk 0) - khong phat coc',
    Number(wA.available_balance) === 500000 && Number(wA.locked_balance) === 0,
    'thuc te av=' + wA.available_balance + ' lk=' + wA.locked_balance);
  check('Trang thai CANCELLED_DOCTOR', bk.status === 'CANCELLED_DOCTOR');
  check('Co ghi cancelled_at (ngay/gio huy)', !!bk.cancelled_at);
  check('Co ghi dung ly do huy', bk.cancel_reason === 'Nghi van benh nhan lua dao');
  check('Co ghi cancelled_by_role = PRACTITIONER', bk.cancelled_by_role === 'PRACTITIONER', 'thuc te: ' + bk.cancelled_by_role);

  console.log('\n=== TEST 9: Huy lan 2 KHONG duoc hoan tien them (chong hoan trung) ===');
  r = await rpc('cancel_booking_and_refund_lock', { p_booking_id: b2, p_cancelled_by_role: 'PATIENT', p_cancel_reason: 'huy lai' });
  wA = await wallet(DA.id);
  check('Khong hoan tien lan hai (van 500.000)', Number(wA.available_balance) === 500000, 'thuc te av=' + wA.available_balance);

  console.log('\n=== TEST 10: ADMIN huy don -> ghi dung nguoi huy (khong oan thay thuoc) ===');
  const b3 = await mkBooking(null);
  await rpc('accept_booking_with_escrow', { p_booking_id: b3, p_practitioner_id: DA.id });
  r = await rpc('cancel_booking_and_refund_lock', { p_booking_id: b3, p_cancelled_by_role: 'ADMIN', p_cancel_reason: 'Admin dieu phoi huy' });
  bk = await booking(b3); wA = await wallet(DA.id);
  check('cancelled_by_role = ADMIN', bk.cancelled_by_role === 'ADMIN', 'thuc te: ' + bk.cancelled_by_role);
  check('Thay thuoc A duoc hoan 100%', Number(wA.available_balance) === 500000 && Number(wA.locked_balance) === 0);

  console.log('\n=== TEST 11: Vi khong du tien thi KHONG duoc nhan ca ===');
  await rest('PATCH', 'wallets?user_id=eq.' + DA.id, { available_balance: 10000, locked_balance: 0 });
  const b4 = await mkBooking(null);
  r = await rpc('accept_booking_with_escrow', { p_booking_id: b4, p_practitioner_id: DA.id });
  check('RPC chan vi khong du so du', !r.ok && r.body.indexOf('không đủ') >= 0, r.body.slice(0, 150));
  check('Don van PENDING', (await booking(b4)).status === 'PENDING');

  console.log('\n=== TEST 12: Admin cong/tru vi an toan (admin_adjust_wallet) ===');
  r = await rpc('admin_adjust_wallet', { p_user_id: DA.id, p_amount: 90000, p_description: 'ZZTEST Admin cong tien' });
  check('Cong 90.000 thanh cong', r.ok, r.body.slice(0, 150));
  wA = await wallet(DA.id);
  check('So du 10.000 -> 100.000', Number(wA.available_balance) === 100000, 'thuc te ' + wA.available_balance);
  r = await rpc('admin_adjust_wallet', { p_user_id: DA.id, p_amount: -500000, p_description: 'ZZTEST tru qua tay' });
  check('Chan tru vuot so du (khong de vi am)', !r.ok && r.body.indexOf('Không thể trừ') >= 0, r.body.slice(0, 150));
  wA = await wallet(DA.id);
  check('So du giu nguyen 100.000 sau khi bi chan', Number(wA.available_balance) === 100000);

  console.log('\n=== TEST 13: Admin THU HOI don ve danh sach don tu do ===');
  await rest('PATCH', 'wallets?user_id=eq.' + DB.id, { available_balance: 500000, locked_balance: 0 });
  const b5 = await mkBooking(null);
  await rpc('accept_booking_with_escrow', { p_booking_id: b5, p_practitioner_id: DB.id });
  r = await rpc('reassign_booking_to_practitioner', { p_booking_id: b5, p_new_practitioner_id: null, p_reason: 'Thu hoi ve don tu do' });
  check('RPC thu hoi thanh cong', r.ok, r.body.slice(0, 250));
  bk = await booking(b5); wB = await wallet(DB.id);
  check('Don ve PENDING va khong con thay thuoc', bk.status === 'PENDING' && bk.practitioner_id === null);
  check('Thay thuoc B duoc hoan 100%',
    Number(wB.available_balance) === 500000 && Number(wB.locked_balance) === 0,
    'thuc te av=' + wB.available_balance + ' lk=' + wB.locked_balance);

  console.log('\n=== DON DEP TAI KHOAN TEST ===');
  await cleanup();
  const phones = [P, DA, DB, DC].map(function (u) { return u.phone; }).join(',');
  const left = await rest('GET', 'profiles?phone=in.(' + phones + ')&select=phone');
  console.log('   Con lai sau don dep: ' + (left.json ? left.json.length : '?') + ' tai khoan');

  const line = '============================================================';
  console.log('\n' + line + '\nKET QUA: ' + pass + ' PASS / ' + fail + ' FAIL\n' + line);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch(async function (e) {
  console.error('FATAL', e);
  await cleanup();
  process.exit(1);
});
