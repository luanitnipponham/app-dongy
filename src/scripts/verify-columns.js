const fs = require('fs');
const envRaw = fs.readFileSync('C:/Users/Admin/Desktop/app-dongy/.env.local', 'utf8');
const env = {};
envRaw.split('\n').forEach((l) => {
  const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
});
const URL = env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const H = { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' };

async function rest(method, q, body) {
  const r = await fetch(URL + '/rest/v1/' + q, {
    method, headers: H, body: body ? JSON.stringify(body) : undefined });
  const t = await r.text();
  let j = null; try { j = JSON.parse(t); } catch (e) {}
  return { ok: r.ok, status: r.status, body: t, json: j };
}
async function rpc(name, args) {
  const r = await fetch(URL + '/rest/v1/rpc/' + name, {
    method: 'POST', headers: H, body: JSON.stringify(args) });
  return { ok: r.ok, status: r.status, body: await r.text() };
}

let pass = 0, fail = 0;
function check(label, cond, extra) {
  if (cond) { console.log('   PASS  ' + label); pass++; }
  else { console.log('   FAIL  ' + label + (extra ? ' -> ' + extra : '')); fail++; }
}

const now = new Date().toISOString();
const P = { id: crypto.randomUUID(), phone: '0900000901' };
const D = { id: crypto.randomUUID(), phone: '0900000902' };

async function cleanup() {
  await rest('DELETE', 'profiles?phone=eq.' + P.phone);
  await rest('DELETE', 'profiles?phone=eq.' + D.phone);
}

(async () => {
  await cleanup();
  console.log('=== CHUAN BI ===');
  await rest('POST', 'profiles', [{ id: P.id, phone: P.phone, password_hash: '123456',
    full_name: 'ZZTEST BN cot moi', role: 'PATIENT', is_active: true, created_at: now, updated_at: now }]);
  await rest('POST', 'profiles', [{ id: D.id, phone: D.phone, password_hash: '123456',
    full_name: 'ZZTEST TT cot moi', role: 'PRACTITIONER', is_active: true, created_at: now, updated_at: now }]);
  await rest('POST', 'practitioner_profiles', [{ id: crypto.randomUUID(), user_id: D.id,
    specialties: ['Cham cuu'], license_number: 'CCHN-ZZ-902', license_image_url: 'https://x/y.jpg',
    issued_by: 'So Y Te', years_of_experience: 5, base_service_fee: 400000, commission_rate: 15.0,
    is_verified: true, is_online: true, rating_avg: 5, total_reviews: 0,
    completed_jobs: 0, cancelled_jobs: 0, updated_at: now }]);
  await rest('POST', 'wallets', [{ id: crypto.randomUUID(), user_id: D.id,
    available_balance: 500000, locked_balance: 0, updated_at: now }]);
  console.log('   Da tao 1 benh nhan + 1 thay thuoc test');

  console.log('\n=== TEST A: verified_at + rejection_reason ===');
  await rest('PATCH', 'practitioner_profiles?user_id=eq.' + D.id,
    { is_verified: true, is_online: true, verified_at: now, rejection_reason: null, updated_at: now });
  let pr = (await rest('GET', 'practitioner_profiles?user_id=eq.' + D.id + '&select=verified_at,rejection_reason')).json[0];
  check('Duyet CCHN -> ghi verified_at', !!pr.verified_at, 'thuc te: ' + pr.verified_at);
  check('Duyet CCHN -> xoa rejection_reason', pr.rejection_reason === null);

  await rest('PATCH', 'practitioner_profiles?user_id=eq.' + D.id,
    { is_verified: false, is_online: false, verified_at: null,
      rejection_reason: 'Anh chung chi khong ro net', updated_at: now });
  pr = (await rest('GET', 'practitioner_profiles?user_id=eq.' + D.id + '&select=verified_at,rejection_reason')).json[0];
  check('Tu choi -> ghi dung ly do', pr.rejection_reason === 'Anh chung chi khong ro net', 'thuc te: ' + pr.rejection_reason);
  check('Tu choi -> xoa verified_at', pr.verified_at === null);

  console.log('\n=== TEST B: cancelled_jobs tang khi THAY THUOC tu huy ===');
  await rest('PATCH', 'practitioner_profiles?user_id=eq.' + D.id,
    { is_verified: true, is_online: true, cancelled_jobs: 0, updated_at: now });

  const mk = async () => {
    const id = crypto.randomUUID();
    await rest('POST', 'bookings', [{ id, booking_code: 'ZZ-' + id.slice(0, 6),
      patient_id: P.id, practitioner_id: null, service_name: 'ZZTEST',
      address: '1 Le Loi, Quan 1, TP.HCM', patient_phone: P.phone, lat: 10.7, lng: 106.7,
      appointment_time: new Date(Date.now() + 7200000).toISOString(),
      service_fee: 400000, travel_surcharge: 0, commission_rate: 15, commission_amount: 60000,
      status: 'PENDING', created_at: now, updated_at: now }]);
    return id;
  };
  const getCancelled = async () =>
    Number((await rest('GET', 'practitioner_profiles?user_id=eq.' + D.id + '&select=cancelled_jobs')).json[0].cancelled_jobs);

  // Thay thuoc tu huy
  let b = await mk();
  await rpc('accept_booking_with_escrow', { p_booking_id: b, p_practitioner_id: D.id });
  await rpc('cancel_booking_and_refund_lock', { p_booking_id: b, p_cancelled_by_role: 'PRACTITIONER', p_cancel_reason: 'ZZTEST bao ban' });
  check('Thay thuoc tu huy -> cancelled_jobs = 1', (await getCancelled()) === 1, 'thuc te: ' + (await getCancelled()));

  // Benh nhan huy -> KHONG duoc tang
  b = await mk();
  await rpc('accept_booking_with_escrow', { p_booking_id: b, p_practitioner_id: D.id });
  await rpc('cancel_booking_and_refund_lock', { p_booking_id: b, p_cancelled_by_role: 'PATIENT', p_cancel_reason: 'ZZTEST BN huy' });
  check('Benh nhan huy -> KHONG tang (van = 1)', (await getCancelled()) === 1, 'thuc te: ' + (await getCancelled()));

  // Admin huy -> KHONG duoc tang
  b = await mk();
  await rpc('accept_booking_with_escrow', { p_booking_id: b, p_practitioner_id: D.id });
  await rpc('cancel_booking_and_refund_lock', { p_booking_id: b, p_cancelled_by_role: 'ADMIN', p_cancel_reason: 'ZZTEST Admin huy' });
  check('Admin huy -> KHONG tang (van = 1)', (await getCancelled()) === 1, 'thuc te: ' + (await getCancelled()));

  // Vi phai tro ve nguyen ven (khong phat coc)
  const w = (await rest('GET', 'wallets?user_id=eq.' + D.id + '&select=available_balance,locked_balance')).json[0];
  check('Hoan 100% sau 3 lan huy (av 500.000, lk 0)',
    Number(w.available_balance) === 500000 && Number(w.locked_balance) === 0,
    'av=' + w.available_balance + ' lk=' + w.locked_balance);

  console.log('\n=== DON DEP ===');
  await cleanup();
  console.log('   Da xoa tai khoan test');

  const line = '============================================================';
  console.log('\n' + line + '\nCOT DU LIEU MOI: ' + pass + ' PASS / ' + fail + ' FAIL\n' + line);
  process.exit(fail > 0 ? 1 : 0);
})().catch(async (e) => { console.error('FATAL', e); await cleanup(); process.exit(1); });
