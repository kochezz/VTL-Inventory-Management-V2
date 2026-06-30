'use strict';
// test-attendance-hours-2.js — cases 12-22
// Run with: node test-attendance-hours-2.js

const { classifyHours } = require('./src/services/attendance-hours');

// ─── Test runner ──────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function check(label, actual, expected) {
  const eq = typeof expected === 'number'
    ? Math.abs(actual - expected) < 1e-9
    : actual === expected;
  if (eq) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.log(`  ❌ ${label}`);
    console.log(`       expected : ${JSON.stringify(expected)}`);
    console.log(`       got      : ${JSON.stringify(actual)}`);
    failed++;
  }
}

function section(n, title) {
  console.log(`\n${'─'.repeat(64)}`);
  console.log(`Test ${n}: ${title}`);
  console.log('─'.repeat(64));
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const weekday = () => 'weekday';
function p(type, iso) { return { type, time: new Date(iso) }; }

// ─── Case 12 ──────────────────────────────────────────────────────────────────
// Sunday 07:00-13:00: elapsed 6h; no buffer on Sunday; worked_span 6h.
// 6h ≥ 5h → -0.75h → net 5.25h.  All → holiday_ot bucket; zero toward weekly 45.
section(12, 'Sunday 6h worked → net 5.25h, all holiday_ot, zero toward weekly 45');
{
  const getDayType = (d) => d === '2026-06-28' ? 'sunday' : 'weekday';
  const { shifts, weeks } = classifyHours([
    p('clock_in',  '2026-06-28T07:00:00'),
    p('clock_out', '2026-06-28T13:00:00'),   // 6h elapsed
  ], {}, getDayType);

  check('status ok',                       shifts[0].status,           'ok');
  check('net = 5.25h',                     shifts[0].net_hours,        5.25);
  check('holiday_ot = 5.25h',              weeks[0].holiday_ot_hours,  5.25);
  check('normal = 0 (not toward 45 line)', weeks[0].normal_hours,      0);
  check('weekday_ot = 0',                  weeks[0].weekday_ot_hours,  0);
}

// ─── Case 13 ──────────────────────────────────────────────────────────────────
// Public holiday 07:00-15:00: elapsed 8h; no buffer; worked_span 8h.
// 8h ≥ 5h → -0.75h → net 7.25h.  All → holiday_ot bucket.
section(13, 'Public holiday 8h worked → net 7.25h, all holiday_ot');
{
  const getDayType = () => 'public_holiday';
  const { shifts, weeks } = classifyHours([
    p('clock_in',  '2026-06-22T07:00:00'),
    p('clock_out', '2026-06-22T15:00:00'),   // 8h elapsed
  ], {}, getDayType);

  check('status ok',              shifts[0].status,           'ok');
  check('net = 7.25h',            shifts[0].net_hours,        7.25);
  check('holiday_ot = 7.25h',     weeks[0].holiday_ot_hours,  7.25);
  check('normal = 0',             weeks[0].normal_hours,      0);
  check('weekday_ot = 0',         weeks[0].weekday_ot_hours,  0);
}

// ─── Case 14 ──────────────────────────────────────────────────────────────────
// Mon-Fri standard 07:00-15:45 → net 8.0h each → 40.0h reg.
// Saturday 07:00-12:00: elapsed 5h; off=0 → worked_span 5h;
// 5h ≥ 5h threshold → -0.75h → net 4.25h → _reg (Saturday counts toward weekly 45).
// _reg_sum = 40.0 + 4.25 = 44.25h < 45 → zero weekly OT.
// Saturday does NOT fire under_hours_day (that flag is weekday-only).
section(14, 'Sat 07:00-12:00 after 40h Mon-Fri → net 4.25h, week 44.25h, zero OT');
{
  const getDayType = (d) => d === '2026-06-27' ? 'saturday' : 'weekday';
  const punches = [
    p('clock_in',  '2026-06-22T07:00:00'), p('clock_out', '2026-06-22T15:45:00'),
    p('clock_in',  '2026-06-23T07:00:00'), p('clock_out', '2026-06-23T15:45:00'),
    p('clock_in',  '2026-06-24T07:00:00'), p('clock_out', '2026-06-24T15:45:00'),
    p('clock_in',  '2026-06-25T07:00:00'), p('clock_out', '2026-06-25T15:45:00'),
    p('clock_in',  '2026-06-26T07:00:00'), p('clock_out', '2026-06-26T15:45:00'),
    p('clock_in',  '2026-06-27T07:00:00'), p('clock_out', '2026-06-27T12:00:00'),
  ];
  const { shifts, weeks } = classifyHours(punches, {}, getDayType);

  check('6 shifts',                         shifts.length,             6);
  check('Sat net = 4.25h',                  shifts[5].net_hours,       4.25);
  check('Sat no under_hours_day (weekday-only flag)', shifts[5].flags.includes('under_hours_day'), false);
  check('week normal = 44.25h',             weeks[0].normal_hours,     44.25);
  check('week weekday_ot = 0',              weeks[0].weekday_ot_hours, 0);
  check('week holiday_ot = 0',              weeks[0].holiday_ot_hours, 0);
}

// ─── Case 15 ──────────────────────────────────────────────────────────────────
// Weekday 07:00-13:30: elapsed 6.5h; off=0 → worked_span 6.5h.
// 6.5h ≥ 5h → -0.75h → net 5.75h.  Flag under_hours_day (5.75 < 8).
section(15, 'Weekday 6.5h worked → net 5.75h (not 6.0h), under_hours_day');
{
  const { shifts } = classifyHours([
    p('clock_in',  '2026-06-22T07:00:00'),
    p('clock_out', '2026-06-22T13:30:00'),   // 6.5h elapsed
  ], {}, weekday);

  check('status ok',        shifts[0].status,                         'ok');
  check('net = 5.75h',      shifts[0].net_hours,                      5.75);
  check('under_hours_day',  shifts[0].flags.includes('under_hours_day'), true);
}

// ─── Case 16 ──────────────────────────────────────────────────────────────────
// Weekday 07:00-11:30: elapsed 4.5h; off=0 → worked_span 4.5h.
// 4.5h < 5h threshold → NO deduction → net 4.5h exactly.
// Flag under_hours_day (4.5 < 8).
section(16, 'Weekday 4.5h worked (below 5h threshold) → net 4.5h, nothing deducted, under_hours_day');
{
  const { shifts } = classifyHours([
    p('clock_in',  '2026-06-22T07:00:00'),
    p('clock_out', '2026-06-22T11:30:00'),   // 4.5h elapsed
  ], {}, weekday);

  check('status ok',        shifts[0].status,                         'ok');
  check('net = 4.5h',       shifts[0].net_hours,                      4.5);
  check('under_hours_day',  shifts[0].flags.includes('under_hours_day'), true);
}

// ─── Case 17 ──────────────────────────────────────────────────────────────────
// 07:00-22:00: elapsed 15h > max_shift_hours (14) → over_max_shift.
// net remains null; shift is skipped in weekly rollup → weeks is empty.
section(17, '15h elapsed > 14h max → over_max_shift flag, net null, not in weekly rollup');
{
  const { shifts, weeks } = classifyHours([
    p('clock_in',  '2026-06-22T07:00:00'),
    p('clock_out', '2026-06-22T22:00:00'),   // 15h elapsed
  ], {}, weekday);

  check('status over_max_shift',    shifts[0].status,                          'over_max_shift');
  check('flag over_max_shift',      shifts[0].flags.includes('over_max_shift'), true);
  check('net null (not bucketed)',   shifts[0].net_hours,                       null);
  check('not in weekly rollup',      weeks.length,                              0);
}

// ─── Case 18 ──────────────────────────────────────────────────────────────────
// In 06:20 (40 min early), out 16:04 (19 min late).
// off = 40 + 19 = 59 min ≤ 60 → discard ALL 59 min.
// elapsed = 9h44m = 584 min; worked_span = (584-59)/60 = 8.75h; net = 8.75-0.75 = 8.0h.
// No threshold pushed — 59 off-schedule min vanish entirely.
section(18, 'Buffer ≤60 (off=59 min): all discarded → worked_span 8.75h → net 8.0h');
{
  const { shifts, weeks } = classifyHours([
    p('clock_in',  '2026-06-22T06:20:00'),   // 40 min early
    p('clock_out', '2026-06-22T16:04:00'),   // 19 min late  → off = 59 min
  ], {}, weekday);

  check('status ok',              shifts[0].status,          'ok');
  check('net = 8.0h',             shifts[0].net_hours,       8.0);
  check('no under_hours_day',     shifts[0].flags.includes('under_hours_day'), false);
  check('week normal = 8.0h',     weeks[0].normal_hours,     8.0);
  check('week weekday_ot = 0',    weeks[0].weekday_ot_hours, 0);
}

// ─── Case 19 ──────────────────────────────────────────────────────────────────
// In 06:30 (30 min early), out 16:30 (45 min late).
// off = 30 + 45 = 75 min > 60 → discard exactly 60; 15 min count.
// elapsed = 10h; worked_span = 10 - 1 = 9h; net = 9 - 0.75 = 8.25h.
// 0.25h beyond 8.0h accumulates toward weekly 45 threshold.
section(19, 'Buffer >60 (off=75 min): 60 discarded, 15 kept → worked_span 9h → net 8.25h');
{
  const { shifts, weeks } = classifyHours([
    p('clock_in',  '2026-06-22T06:30:00'),   // 30 min early
    p('clock_out', '2026-06-22T16:30:00'),   // 45 min late  → off = 75 min
  ], {}, weekday);

  check('status ok',                   shifts[0].status,          'ok');
  check('net = 8.25h',                 shifts[0].net_hours,       8.25);
  check('week normal = 8.25h (>8.0)',  weeks[0].normal_hours,     8.25);
  check('week weekday_ot = 0',         weeks[0].weekday_ot_hours, 0);
}

// ─── Case 20 ──────────────────────────────────────────────────────────────────
// 59 off-schedule min every Mon-Fri → all discarded each day → net 8.0h/day.
// Proves buffered minutes do NOT accumulate across the week.
// Week: 5 × 8.0 = 40.0h, zero OT, no under_hours_week (40 is not < 40).
section(20, '59 off-min every day Mon-Fri → 40.0h/week, zero OT (buffer does not accumulate)');
{
  const days = ['2026-06-22','2026-06-23','2026-06-24','2026-06-25','2026-06-26'];
  const punches = days.flatMap(d => [
    p('clock_in',  `${d}T06:20:00`),   // 40 min early
    p('clock_out', `${d}T16:04:00`),   // 19 min late → off = 59 min → all discarded
  ]);
  const { shifts, weeks } = classifyHours(punches, {}, weekday);

  check('5 shifts',                    shifts.length,               5);
  check('each net = 8.0h',             shifts.every(s => Math.abs(s.net_hours - 8.0) < 1e-9), true);
  check('week normal = 40.0h',         weeks[0].normal_hours,       40.0);
  check('week weekday_ot = 0',         weeks[0].weekday_ot_hours,   0);
  check('no under_hours_week',         weeks[0].flags.includes('under_hours_week'), false);
}

// ─── Case 21 ──────────────────────────────────────────────────────────────────
// In 07:30 (30 min LATE, not early), out 16:15 (30 min late).
// early = 0; late = 30 min; off = 30 ≤ 60 → discard 30 min.
// elapsed = 8h45m = 525 min; worked_span = (525-30)/60 = 8.25h (= 07:30 to 15:45).
// net = 8.25 - 0.75 = 7.5h EXACTLY.  Flag under_hours_day (7.5 < 8).
// Late-in cuts the day with no offset credit: the buffer only reclaims the late-out.
section(21, 'Late-in 07:30, out 16:15 → worked_span 8h15m → net 7.5h exactly, under_hours_day');
{
  const { shifts } = classifyHours([
    p('clock_in',  '2026-06-22T07:30:00'),   // 30 min late (not early → early_min = 0)
    p('clock_out', '2026-06-22T16:15:00'),   // 30 min late → off = 30 min → all discarded
  ], {}, weekday);

  check('status ok',          shifts[0].status,                         'ok');
  check('net = 7.5h exactly', shifts[0].net_hours,                      7.5);
  check('under_hours_day',    shifts[0].flags.includes('under_hours_day'), true);
}

// ─── Case 22 ──────────────────────────────────────────────────────────────────
// Public holiday 06:30-16:30: isHoliday=true → buffer NOT applied.
// elapsed = 10h; worked_span = 10h; 10h ≥ 5h → -0.75h → net 9.25h.
// ALL → holiday_ot (2×) bucket.
section(22, 'Public holiday ignores buffer: 06:30-16:30 → 10h elapsed → net 9.25h, all holiday_ot');
{
  const getDayType = () => 'public_holiday';
  const { shifts, weeks } = classifyHours([
    p('clock_in',  '2026-06-22T06:30:00'),
    p('clock_out', '2026-06-22T16:30:00'),   // 10h elapsed; buffer irrelevant
  ], {}, getDayType);

  check('status ok',           shifts[0].status,           'ok');
  check('net = 9.25h',         shifts[0].net_hours,        9.25);
  check('holiday_ot = 9.25h',  weeks[0].holiday_ot_hours,  9.25);
  check('normal = 0',          weeks[0].normal_hours,      0);
  check('weekday_ot = 0',      weeks[0].weekday_ot_hours,  0);
}

// ─── Summary ──────────────────────────────────────────────────────────────────

console.log(`\n${'═'.repeat(64)}`);
console.log(`RESULTS  ${passed} passed  ${failed} failed`);
console.log('═'.repeat(64));
process.exit(failed > 0 ? 1 : 0);
