'use strict';
// test-attendance-hours.js — cases 1-11
// Run with: node test-attendance-hours.js

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

// ─── Case 1 ───────────────────────────────────────────────────────────────────
// Weekday 07:00-15:45: elapsed 8h45m, off_schedule 0 → discard 0.
// worked_span 8.75h ≥ 5h → -0.75h → net 8.0h. No OT.
section(1, 'Weekday 07:00-15:45 → net 8.0h, all normal, no flags');
{
  const { shifts, weeks } = classifyHours([
    p('clock_in',  '2026-06-22T07:00:00'),
    p('clock_out', '2026-06-22T15:45:00'),
  ], {}, weekday);

  check('status ok',            shifts[0].status,           'ok');
  check('net = 8.0h',           shifts[0].net_hours,        8.0);
  check('no shift flags',       shifts[0].flags.length,     0);
  check('week normal = 8.0',    weeks[0].normal_hours,      8.0);
  check('week weekday_ot = 0',  weeks[0].weekday_ot_hours,  0);
  check('week holiday_ot = 0',  weeks[0].holiday_ot_hours,  0);
}

// ─── Case 2 ───────────────────────────────────────────────────────────────────
// Night shift: caller flags clock-in date as 'night_shift' → buffer skipped.
// 8h elapsed; worked_span 8h; ≥5h → -0.75h → net 7.25h. Weekday OT bucketing applies.
// Clock_out date (Tue) resolves as 'weekday' but is irrelevant — type is from clock_in.
section(2, 'Night-shift Mon 22:00 → Tue 06:00 (night_shift type) → net 7.25h, weekday buckets');
{
  const getDayType = (d) => d === '2026-06-22' ? 'night_shift' : 'weekday';
  const { shifts } = classifyHours([
    p('clock_in',  '2026-06-22T22:00:00'),   // Monday — night_shift
    p('clock_out', '2026-06-23T06:00:00'),   // Tuesday
  ], {}, getDayType);

  check('status ok',         shifts[0].status,      'ok');
  check('net = 7.25h',       shifts[0].net_hours,   7.25);
}

// ─── Case 3 ───────────────────────────────────────────────────────────────────
// Single clock_in, no clock_out → missing_punch, net null.
section(3, 'clock_in with no clock_out → missing_punch, net null');
{
  const { shifts } = classifyHours([
    p('clock_in', '2026-06-22T07:00:00'),
  ], {}, weekday);

  check('1 shift',               shifts.length,        1);
  check('missing_punch',         shifts[0].status,     'missing_punch');
  check('net null',              shifts[0].net_hours,  null);
  check('flag missing_punch',    shifts[0].flags.includes('missing_punch'), true);
}

// ─── Case 4 ───────────────────────────────────────────────────────────────────
// Single clock_out, no preceding clock_in → SURFACED (not silently dropped).
section(4, 'Orphan clock_out → surfaced with orphan_clock_out status, not dropped');
{
  const { shifts } = classifyHours([
    p('clock_out', '2026-06-22T08:00:00'),
  ], {}, weekday);

  check('not dropped — 1 shift',       shifts.length,                              1);
  check('status orphan_clock_out',      shifts[0].status,                           'orphan_clock_out');
  check('flag orphan_clock_out',        shifts[0].flags.includes('orphan_clock_out'), true);
  check('net null',                     shifts[0].net_hours,                         null);
  check('clock_in is null',             shifts[0].clock_in,                          null);
}

// ─── Case 5 ───────────────────────────────────────────────────────────────────
// Day 1: clock_in only → missing_punch.
// Day 2: clean 07:00-15:45 shift → net 8.0h.
// (Two clock_ins 24h apart are NOT debounced; state machine flags the first as missing.)
section(5, 'Day 1 clock_in only (missing_punch); Day 2 clean 07:00-15:45 → net 8.0h');
{
  const { shifts } = classifyHours([
    p('clock_in',  '2026-06-22T07:00:00'),   // Day 1 — no matching clock_out
    p('clock_in',  '2026-06-23T07:00:00'),   // Day 2 — triggers missing_punch on Day 1
    p('clock_out', '2026-06-23T15:45:00'),   // Day 2 clock_out
  ], {}, weekday);

  check('2 shifts',                  shifts.length,        2);
  check('shift 0 missing_punch',     shifts[0].status,     'missing_punch');
  check('shift 0 net null',          shifts[0].net_hours,  null);
  check('shift 1 ok',                shifts[1].status,     'ok');
  check('shift 1 net = 8.0h',        shifts[1].net_hours,  8.0);
}

// ─── Case 6 ───────────────────────────────────────────────────────────────────
// Two identical clock_in punches 28 s apart → debounce (default 30 s) keeps only first.
// Resulting single shift 07:00-15:45 → net 8.0h.
section(6, 'Double-scan 28 s apart → debounced to one clock_in → net 8.0h');
{
  const { shifts } = classifyHours([
    p('clock_in',  '2026-06-22T07:00:00'),
    p('clock_in',  '2026-06-22T07:00:28'),   // 28 s later, same type → discarded
    p('clock_out', '2026-06-22T15:45:00'),
  ], {}, weekday);

  check('exactly 1 shift',     shifts.length,        1);
  check('status ok',           shifts[0].status,     'ok');
  check('net = 8.0h',          shifts[0].net_hours,  8.0);
}

// ─── Case 7 ───────────────────────────────────────────────────────────────────
// Weekday 07:00-19:00: elapsed 12h.
// Buffer: late = 19:00-15:45 = 195 min > 60 → discard 60 → worked_span 11h.
// net = 11 - 0.75 = 10.25h. Daily OT = 0.25h (_reg 10h, _dot 0.25h).
// week.normal = 10h, week.weekday_ot = 0.25h.
section(7, 'Weekday 07:00-19:00 → worked_span 11h → net 10.25h, 0.25h daily OT');
{
  const { shifts, weeks } = classifyHours([
    p('clock_in',  '2026-06-22T07:00:00'),
    p('clock_out', '2026-06-22T19:00:00'),
  ], {}, weekday);

  check('status ok',                 shifts[0].status,           'ok');
  check('net = 10.25h',              shifts[0].net_hours,        10.25);
  check('week normal = 10.0h',       weeks[0].normal_hours,      10.0);
  check('week weekday_ot = 0.25h',   weeks[0].weekday_ot_hours,  0.25);
  check('week holiday_ot = 0',       weeks[0].holiday_ot_hours,  0);
}

// ─── Case 8 ───────────────────────────────────────────────────────────────────
// 5× weekday 07:00-17:00: late = 75 min > 60 → discard 60 → worked_span 9h → net 8.25h.
// Week: 41.25h < 45 → zero weekly OT. 41.25 ≥ 40 → no under_hours_week flag.
section(8, '5× 07:00-17:00 → net 8.25h/day, 41.25h/week, zero OT, no under_hours_week');
{
  const days = ['2026-06-22','2026-06-23','2026-06-24','2026-06-25','2026-06-26'];
  const punches = days.flatMap(d => [
    p('clock_in',  `${d}T07:00:00`),
    p('clock_out', `${d}T17:00:00`),
  ]);
  const { shifts, weeks } = classifyHours(punches, {}, weekday);

  check('5 shifts',                    shifts.length,               5);
  check('each net = 8.25h',            shifts.every(s => Math.abs(s.net_hours - 8.25) < 1e-9), true);
  check('week normal = 41.25h',        weeks[0].normal_hours,       41.25);
  check('week weekday_ot = 0',         weeks[0].weekday_ot_hours,   0);
  check('no under_hours_week',         weeks[0].flags.includes('under_hours_week'), false);
}

// ─── Case 9 ───────────────────────────────────────────────────────────────────
// 5× weekday 07:00-17:45: late = 120 min > 60 → discard 60 → worked_span 9.75h → net 9.0h.
// Week: 45.0h = threshold exactly → weekly_ot = max(0, 45-45) = 0.
section(9, '5× 07:00-17:45 → net 9.0h/day, 45.0h/week, ZERO OT (45 is the line)');
{
  const days = ['2026-06-22','2026-06-23','2026-06-24','2026-06-25','2026-06-26'];
  const punches = days.flatMap(d => [
    p('clock_in',  `${d}T07:00:00`),
    p('clock_out', `${d}T17:45:00`),
  ]);
  const { shifts, weeks } = classifyHours(punches, {}, weekday);

  check('each net = 9.0h',        shifts.every(s => Math.abs(s.net_hours - 9.0) < 1e-9), true);
  check('week normal = 45.0h',    weeks[0].normal_hours,     45.0);
  check('week weekday_ot = 0',    weeks[0].weekday_ot_hours, 0);
}

// ─── Case 10 ──────────────────────────────────────────────────────────────────
// 5× weekday 07:00-18:15: late = 150 min > 60 → discard 60 → worked_span 10.25h → net 9.5h.
// 9.5 < 10 → no daily OT. _reg_sum = 47.5. weekly_ot = 47.5 - 45 = 2.5h.
section(10, '5× 07:00-18:15 → net 9.5h/day, 47.5h/week, 2.5h weekly OT, no daily OT');
{
  const days = ['2026-06-22','2026-06-23','2026-06-24','2026-06-25','2026-06-26'];
  const punches = days.flatMap(d => [
    p('clock_in',  `${d}T07:00:00`),
    p('clock_out', `${d}T18:15:00`),
  ]);
  const { shifts, weeks } = classifyHours(punches, {}, weekday);

  check('each net = 9.5h',         shifts.every(s => Math.abs(s.net_hours - 9.5) < 1e-9), true);
  check('week normal = 45.0h',     weeks[0].normal_hours,     45.0);
  check('week weekday_ot = 2.5h',  weeks[0].weekday_ot_hours, 2.5);
}

// ─── Case 11 ──────────────────────────────────────────────────────────────────
// Mon 07:00-19:00: net 10.25h → _reg 10, _dot 0.25.
// Tue-Fri 07:00-18:15 each: net 9.5h → _reg 9.5, _dot 0.
// _reg_sum = 10 + 4×9.5 = 48. weekly_ot = 48-45 = 3h.
// weekday_ot = _dot(0.25) + weekly_ot(3) = 3.25h  ← NOT 3.5h (no double-count).
// Proof: Mon's 0.25h daily OT is in _dot, excluded from _reg (10 not 10.25),
//        so it never re-enters the 48h total and is not counted twice.
section(11, 'Daily OT + weekly OT: 0.25h + 3.0h = 3.25h total, no double-count');
{
  const punches = [
    p('clock_in',  '2026-06-22T07:00:00'),   // Mon → net 10.25h, _reg 10, _dot 0.25
    p('clock_out', '2026-06-22T19:00:00'),
    p('clock_in',  '2026-06-23T07:00:00'),   // Tue → net 9.5h, _reg 9.5
    p('clock_out', '2026-06-23T18:15:00'),
    p('clock_in',  '2026-06-24T07:00:00'),
    p('clock_out', '2026-06-24T18:15:00'),
    p('clock_in',  '2026-06-25T07:00:00'),
    p('clock_out', '2026-06-25T18:15:00'),
    p('clock_in',  '2026-06-26T07:00:00'),
    p('clock_out', '2026-06-26T18:15:00'),
  ];
  const { shifts, weeks } = classifyHours(punches, {}, weekday);

  check('Mon net = 10.25h',                Math.abs(shifts[0].net_hours - 10.25) < 1e-9,    true);
  check('Tue-Fri net = 9.5h each',         shifts.slice(1).every(s => Math.abs(s.net_hours - 9.5) < 1e-9), true);
  check('week normal = 45.0h',             weeks[0].normal_hours,     45.0);
  check('weekday_ot = 3.25h (not 3.5)',    weeks[0].weekday_ot_hours, 3.25);
  check('no holiday OT',                   weeks[0].holiday_ot_hours, 0);
}

// ─── Summary ──────────────────────────────────────────────────────────────────

console.log(`\n${'═'.repeat(64)}`);
console.log(`RESULTS  ${passed} passed  ${failed} failed`);
console.log('═'.repeat(64));
process.exit(failed > 0 ? 1 : 0);
