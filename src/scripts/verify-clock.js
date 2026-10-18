// Kiem chung logic gio - sao chep y nguyen cong thuc trong utils-medical.ts
let FAKE_SERVER_NOW = null;
function serverNow() { return FAKE_SERVER_NOW !== null ? FAKE_SERVER_NOW : Date.now(); }

function describeTimeUntil(iso) {
  const target = new Date(iso).getTime();
  if (Number.isNaN(target)) return { text: 'Chưa rõ giờ hẹn', tone: 'late' };
  const diffMs = target - serverNow();
  const totalMins = Math.round(Math.abs(diffMs) / 60000);
  const days = Math.floor(totalMins / 1440);
  const hours = Math.floor((totalMins % 1440) / 60);
  const mins = totalMins % 60;
  let span;
  if (days > 0) span = `${days} ngày${hours > 0 ? ` ${hours} giờ` : ''}`;
  else if (hours > 0) span = `${hours} giờ${mins > 0 ? ` ${mins} phút` : ''}`;
  else span = `${totalMins} phút`;
  if (diffMs < 0) return { text: `Đã quá hẹn ${span}`, tone: 'late' };
  return { text: `Còn ${span}`, tone: totalMins <= 120 ? 'soon' : 'ok' };
}

function formatDateTime(isoString) {
  return new Intl.DateTimeFormat('vi-VN', {
    hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit',
    year: 'numeric', timeZone: 'Asia/Ho_Chi_Minh',
  }).format(new Date(isoString));
}

function toVietnamDateParts(date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
    timeZone: 'Asia/Ho_Chi_Minh',
  }).formatToParts(date);
  const get = (t) => (parts.find((p) => p.type === t) || {}).value || '00';
  return { date: `${get('year')}-${get('month')}-${get('day')}`, time: `${get('hour')}:${get('minute')}` };
}

function vietnamDateTimeToDate(d, t) { return new Date(`${d}T${t}:00+07:00`); }

let pass = 0, fail = 0;
function check(label, actual, expected) {
  if (actual === expected) { console.log('   PASS  ' + label + '  -> ' + actual); pass++; }
  else { console.log('   FAIL  ' + label + '\n         nhan duoc: ' + actual + '\n         mong doi : ' + expected); fail++; }
}

console.log('Mui gio cua tien trinh Node hien tai: ' + Intl.DateTimeFormat().resolvedOptions().timeZone);

console.log('\n=== TEST 1: Dung canh bao trong anh chup man hinh ===');
// 22:48 ngay 18/10/2026 gio VN  ->  hen 00:46 ngay 19/10/2026 gio VN
FAKE_SERVER_NOW = new Date('2026-10-18T22:48:00+07:00').getTime();
const appt = '2026-10-19T00:46:00+07:00';
check('Dem nguoc (truoc day bao sai "Con 1 gio")', describeTimeUntil(appt).text, 'Còn 1 giờ 58 phút');
check('Hien thi gio hen theo gio VN', formatDateTime(appt), '00:46 19/10/2026');

console.log('\n=== TEST 2: Cac moc thoi gian khac ===');
FAKE_SERVER_NOW = new Date('2026-10-18T10:00:00+07:00').getTime();
check('Con 45 phut', describeTimeUntil('2026-10-18T10:45:00+07:00').text, 'Còn 45 phút');
check('Con dung 2 gio', describeTimeUntil('2026-10-18T12:00:00+07:00').text, 'Còn 2 giờ');
check('Con 3 gio 30 phut', describeTimeUntil('2026-10-18T13:30:00+07:00').text, 'Còn 3 giờ 30 phút');
check('Con 1 ngay 2 gio', describeTimeUntil('2026-10-19T12:00:00+07:00').text, 'Còn 1 ngày 2 giờ');
check('Qua hen 25 phut', describeTimeUntil('2026-10-18T09:35:00+07:00').text, 'Đã quá hẹn 25 phút');
check('Qua hen 1 gio 30 phut', describeTimeUntil('2026-10-18T08:30:00+07:00').text, 'Đã quá hẹn 1 giờ 30 phút');

console.log('\n=== TEST 3: Mau canh bao (tone) ===');
check('Duoi 2 gio -> soon', describeTimeUntil('2026-10-18T11:30:00+07:00').tone, 'soon');
check('Tren 2 gio -> ok', describeTimeUntil('2026-10-18T15:00:00+07:00').tone, 'ok');
check('Da qua hen -> late', describeTimeUntil('2026-10-18T09:00:00+07:00').tone, 'late');

console.log('\n=== TEST 4: Loi ngay/gio lech nhau luc nua dem (bug cu) ===');
// 02:00 sang gio VN = 19:00 ngay HOM TRUOC theo UTC
FAKE_SERVER_NOW = new Date('2026-10-19T02:00:00+07:00').getTime();
const parts = toVietnamDateParts(new Date(serverNow()));
check('Ngay theo gio VN (khong bi lui 1 ngay)', parts.date, '2026-10-19');
check('Gio theo gio VN', parts.time, '02:00');
// Cach cu: toISOString().slice(0,10) cho ra ngay UTC
const oldWay = new Date(serverNow()).toISOString().slice(0, 10);
console.log('   (cach cu toISOString cho ra: ' + oldWay + '  <- lech 1 ngay)');

console.log('\n=== TEST 5: Dat lich theo gio VN du may sai mui gio ===');
const d = vietnamDateTimeToDate('2026-10-19', '08:30');
check('08:30 gio VN = 01:30 UTC', d.toISOString(), '2026-10-19T01:30:00.000Z');
check('Hien thi lai dung 08:30', formatDateTime(d.toISOString()), '08:30 19/10/2026');

const line = '============================================================';
console.log('\n' + line + '\nKET QUA: ' + pass + ' PASS / ' + fail + ' FAIL\n' + line);
if (fail > 0) process.exitCode = 1;

// ============================================================
// PHAN BO SUNG: NHAN GIO HEN CO MOC NGAY TUONG DOI
// ============================================================
function formatAppointmentLabel(iso) {
  const target = new Date(iso);
  if (Number.isNaN(target.getTime())) return iso;
  const nowParts = toVietnamDateParts(new Date(serverNow()));
  const tParts = toVietnamDateParts(target);
  const dayDiff = Math.round(
    (Date.parse(`${tParts.date}T00:00:00Z`) - Date.parse(`${nowParts.date}T00:00:00Z`)) / 86400000
  );
  const hour = Number(tParts.time.slice(0, 2));
  const time = tParts.time;
  const dd = tParts.date.slice(8, 10);
  const mm = tParts.date.slice(5, 7);
  const yyyy = tParts.date.slice(0, 4);
  if (dayDiff === 0) return `${time} hôm nay (${dd}/${mm})`;
  if (dayDiff === 1) return hour < 6 ? `${time} rạng sáng mai (${dd}/${mm})` : `${time} ngày mai (${dd}/${mm})`;
  if (dayDiff === 2) return `${time} ngày kia (${dd}/${mm})`;
  if (dayDiff === -1) return `${time} hôm qua (${dd}/${mm})`;
  return `${time} ${dd}/${mm}/${yyyy}`;
}

let pass2 = 0, fail2 = 0;
function check2(label, actual, expected) {
  if (actual === expected) { console.log('   PASS  ' + label + '  -> ' + actual); pass2++; }
  else { console.log('   FAIL  ' + label + '\n         nhan duoc: ' + actual + '\n         mong doi : ' + expected); fail2++; }
}

console.log('\n=== TEST 6: Nhan gio hen quanh luc nua dem (dung canh trong anh) ===');
// Gio server that tu DB: 23:02 ngay 18/10/2026
FAKE_SERVER_NOW = new Date('2026-10-18T23:02:00+07:00').getTime();
check2('Hen 00:46 hom sau -> "rang sang mai"',
  formatAppointmentLabel('2026-10-19T00:46:00+07:00'), '00:46 rạng sáng mai (19/10)');
check2('Dem nguoc van dung 1 gio 44 phut',
  describeTimeUntil('2026-10-19T00:46:00+07:00').text, 'Còn 1 giờ 44 phút');

console.log('\n=== TEST 7: Cac moc ngay tuong doi khac ===');
FAKE_SERVER_NOW = new Date('2026-10-18T09:00:00+07:00').getTime();
check2('Cung ngay -> "hom nay"', formatAppointmentLabel('2026-10-18T15:30:00+07:00'), '15:30 hôm nay (18/10)');
check2('Hom sau buoi chieu -> "ngay mai"', formatAppointmentLabel('2026-10-19T14:00:00+07:00'), '14:00 ngày mai (19/10)');
check2('Hom sau truoc 6h -> "rang sang mai"', formatAppointmentLabel('2026-10-19T05:30:00+07:00'), '05:30 rạng sáng mai (19/10)');
check2('Hai ngay sau -> "ngay kia"', formatAppointmentLabel('2026-10-20T10:00:00+07:00'), '10:00 ngày kia (20/10)');
check2('Xa hon -> ngay day du', formatAppointmentLabel('2026-10-25T10:00:00+07:00'), '10:00 25/10/2026');
check2('Hom qua -> "hom qua"', formatAppointmentLabel('2026-10-17T10:00:00+07:00'), '10:00 hôm qua (17/10)');

const line2 = '============================================================';
console.log('\n' + line2 + '\nNHAN GIO HEN: ' + pass2 + ' PASS / ' + fail2 + ' FAIL\n' + line2);
if (fail2 > 0) process.exitCode = 1;

// ============================================================
// PHAN BO SUNG: CA LAM VIEC THAY THUOC 8h00 - 20h00
// ============================================================
const WORKING_HOUR_START = 8, WORKING_HOUR_END = 20;
function vietnamMinutesOfDay(date) {
  const { time } = toVietnamDateParts(date);
  return Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
}
function isWithinWorkingHours(date) {
  const m = vietnamMinutesOfDay(date);
  return m >= WORKING_HOUR_START * 60 && m <= WORKING_HOUR_END * 60;
}
function addDaysToDateStr(dateStr, days) {
  return new Date(Date.parse(`${dateStr}T00:00:00Z`) + days * 86400000).toISOString().slice(0, 10);
}
function nextWorkingSlot(from) {
  if (isWithinWorkingHours(from)) return from;
  const { date } = toVietnamDateParts(from);
  const m = vietnamMinutesOfDay(from);
  if (m < WORKING_HOUR_START * 60) return vietnamDateTimeToDate(date, '08:00');
  return vietnamDateTimeToDate(addDaysToDateStr(date, 1), '08:00');
}

let pass3 = 0, fail3 = 0;
function check3(label, actual, expected) {
  if (actual === expected) { console.log('   PASS  ' + label + '  -> ' + actual); pass3++; }
  else { console.log('   FAIL  ' + label + '\n         nhan duoc: ' + actual + '\n         mong doi : ' + expected); fail3++; }
}

console.log('\n=== TEST 8: Chap nhan / tu choi theo ca lam viec 8h-20h ===');
check3('07:59 -> ngoai gio', isWithinWorkingHours(vietnamDateTimeToDate('2026-10-19', '07:59')), false);
check3('08:00 -> hop le (dau ca)', isWithinWorkingHours(vietnamDateTimeToDate('2026-10-19', '08:00')), true);
check3('12:30 -> hop le', isWithinWorkingHours(vietnamDateTimeToDate('2026-10-19', '12:30')), true);
check3('20:00 -> hop le (cuoi ca)', isWithinWorkingHours(vietnamDateTimeToDate('2026-10-19', '20:00')), true);
check3('20:01 -> ngoai gio', isWithinWorkingHours(vietnamDateTimeToDate('2026-10-19', '20:01')), false);
check3('00:46 rang sang -> ngoai gio', isWithinWorkingHours(vietnamDateTimeToDate('2026-10-19', '00:46')), false);

console.log('\n=== TEST 9: Tu day ve ca lam viec gan nhat ===');
check3('05:30 -> 08:00 cung ngay',
  formatDateTime(nextWorkingSlot(vietnamDateTimeToDate('2026-10-19', '05:30')).toISOString()), '08:00 19/10/2026');
check3('22:30 -> 08:00 hom sau',
  formatDateTime(nextWorkingSlot(vietnamDateTimeToDate('2026-10-18', '22:30')).toISOString()), '08:00 19/10/2026');
check3('00:46 rang sang -> 08:00 cung ngay',
  formatDateTime(nextWorkingSlot(vietnamDateTimeToDate('2026-10-19', '00:46')).toISOString()), '08:00 19/10/2026');
check3('14:00 dang trong ca -> giu nguyen',
  formatDateTime(nextWorkingSlot(vietnamDateTimeToDate('2026-10-19', '14:00')).toISOString()), '14:00 19/10/2026');
check3('Cuoi thang: 23:00 ngay 31/10 -> 08:00 ngay 01/11',
  formatDateTime(nextWorkingSlot(vietnamDateTimeToDate('2026-10-31', '23:00')).toISOString()), '08:00 01/11/2026');

console.log('\n=== TEST 10: Gia tri mac dinh cua form luon hop le ===');
[['2026-10-18T23:02:00+07:00', 'dat luc 23h dem'],
 ['2026-10-19T06:00:00+07:00', 'dat luc 6h sang'],
 ['2026-10-19T10:00:00+07:00', 'dat luc 10h sang'],
 ['2026-10-19T19:30:00+07:00', 'dat luc 19h30']].forEach(([iso, desc]) => {
  FAKE_SERVER_NOW = new Date(iso).getTime();
  const def = nextWorkingSlot(new Date(serverNow() + 2 * 3600 * 1000));
  check3(desc + ' -> mac dinh nam trong ca', isWithinWorkingHours(def), true);
});

const line3 = '============================================================';
console.log('\n' + line3 + '\nCA LAM VIEC 8h-20h: ' + pass3 + ' PASS / ' + fail3 + ' FAIL\n' + line3);
if (fail3 > 0) process.exitCode = 1;
