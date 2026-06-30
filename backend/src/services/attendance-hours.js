'use strict';

// ─── Default configuration ────────────────────────────────────────────────────
// Every value is a named, overridable parameter.

const DEFAULT_CONFIG = {
  scheduled_start: '07:00',   // HH:MM 24-hour; applies to weekday & Saturday only
  scheduled_end:   '15:45',

  unpaid_lunch_minutes:              30,
  paid_break_minutes:                15,
  // Deduct the full 45 min (lunch + break) only when worked_span >= this value.
  // Below the threshold, deduct nothing.  Gives exactly 8.0 h for a 07:00-15:45 day.
  break_deduction_threshold_hours:    5,

  grace_period_minutes: 0,    // punch-exact (reserved; not yet applied)
  rounding_minutes:     0,    // no rounding (reserved; not yet applied)

  normal_day_hours:  8,       // informational — flags under_hours_day when net < this
  normal_week_hours: 40,      // informational — flags under_hours_week when week net < this

  daily_ot_threshold_hours:   10,  // net above this → weekday_ot bucket (daily OT)
  weekly_ot_threshold_hours:  45,  // weekly regular net above this → weekday_ot (weekly OT)

  daily_offschedule_buffer_minutes: 60,  // see buffer logic below

  max_shift_hours: 14,        // elapsed > this → over_max_shift flag, not bucketed

  debounce_seconds: 30,       // same-type punches within this window → keep first only
};

// ─── Internal helpers ─────────────────────────────────────────────────────────

// Set a "HH:MM" time of day on the calendar date of `ref` (local time).
function applyTimeOfDay(hmStr, ref) {
  const [h, m] = hmStr.split(':').map(Number);
  const d = new Date(ref);
  d.setHours(h, m, 0, 0);
  return d;
}

// "YYYY-MM-DD" for the local calendar date of a Date.
function localDateStr(d) {
  const y  = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const dy = String(d.getDate()).padStart(2, '0');
  return `${y}-${mo}-${dy}`;
}

// ISO 8601 week label: "YYYY-Www".
function isoWeekKey(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dow = d.getUTCDay() || 7;            // Mon=1 … Sun=7
  d.setUTCDate(d.getUTCDate() + 4 - dow);   // move to Thursday of this ISO week
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d - yearStart) / 86_400_000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

// Remove same-type punches that arrive within `seconds` of each other (keep first).
function dedupe(sorted, seconds) {
  if (!seconds || seconds <= 0) return sorted;
  const out = [];
  for (const p of sorted) {
    const prev = out[out.length - 1];
    if (prev && prev.type === p.type && (p.time - prev.time) / 1_000 <= seconds) continue;
    out.push(p);
  }
  return out;
}

// State-machine that turns a flat punch list into raw shift descriptors.
//   status: 'ok' | 'missing_punch' | 'orphan_clock_out'
function pairPunches(punches) {
  const raw = [];
  let pendingIn = null;

  for (const p of punches) {
    if (p.type === 'clock_in') {
      if (pendingIn !== null) {
        // Second clock_in before a clock_out — close the first as missing_punch.
        raw.push({ in: pendingIn, out: null, status: 'missing_punch' });
      }
      pendingIn = p;
    } else {
      // clock_out
      if (pendingIn === null) {
        raw.push({ in: null, out: p, status: 'orphan_clock_out' });
      } else {
        raw.push({ in: pendingIn, out: p, status: 'ok' });
        pendingIn = null;
      }
    }
  }

  if (pendingIn !== null) {
    raw.push({ in: pendingIn, out: null, status: 'missing_punch' });
  }
  return raw;
}

// Resolve the day-type string from a Date.
// getDayType may be a function(dateStr) or a plain object {dateStr → dayType}.
function resolveDayType(getDayType, date) {
  const key = localDateStr(date);
  return typeof getDayType === 'function'
    ? getDayType(key)
    : (getDayType[key] || 'weekday');
}

// ─── Per-shift computation ────────────────────────────────────────────────────

// Internal fields prefixed with _ are stripped before the result is returned.
function processShift(raw, cfg, getDayType) {
  const shift = {
    clock_in:  raw.in  ? raw.in.time  : null,
    clock_out: raw.out ? raw.out.time : null,
    net_hours: null,
    status:    raw.status,
    flags:     raw.status !== 'ok' ? [raw.status] : [],
    _reg: 0,   // min(net, daily_ot_threshold) — feeds weekly OT calc
    _dot: 0,   // daily OT hours (above daily threshold)
    _hot: 0,   // holiday OT hours (Sunday / public_holiday)
  };

  if (raw.status !== 'ok') return shift;

  const t_in  = raw.in.time;
  const t_out = raw.out.time;

  const elapsed_h = (t_out - t_in) / 3_600_000;

  if (elapsed_h > cfg.max_shift_hours) {
    shift.flags.push('over_max_shift');
    shift.status = 'over_max_shift';
    return shift;
  }

  const dayType  = resolveDayType(getDayType, t_in);
  const isHoliday = dayType === 'sunday' || dayType === 'public_holiday';

  // ── Off-schedule buffer (weekday / Saturday only) ─────────────────────────
  //
  // off_schedule = (minutes before scheduled_start) + (minutes after scheduled_end)
  //   ≤ buffer  → discard all off-schedule time; worked_span shrinks by that amount
  //   > buffer  → discard exactly `buffer` minutes; the rest counts toward thresholds
  //
  // Sunday / public_holiday: no buffer — every attended minute counts.

  let worked_span_h;

  if (isHoliday || dayType === 'night_shift') {
    worked_span_h = elapsed_h;
  } else {
    const sStart = applyTimeOfDay(cfg.scheduled_start, t_in);
    const sEnd   = applyTimeOfDay(cfg.scheduled_end,   t_in);

    const early_min = Math.max(0, (sStart - t_in) / 60_000);
    const late_min  = Math.max(0, (t_out  - sEnd) / 60_000);
    const off_min   = early_min + late_min;

    const discard_min = Math.min(off_min, cfg.daily_offschedule_buffer_minutes);
    worked_span_h = Math.max(0, elapsed_h - discard_min / 60);
  }

  // ── Break deduction ───────────────────────────────────────────────────────
  //
  // Single flat deduction: if worked_span >= threshold (5 h), subtract 45 min
  // (30 unpaid lunch + 15 paid break).  Below the threshold, deduct nothing.
  // This yields exactly 8.0 h net for a standard 07:00-15:45 day.

  const break_h = (cfg.unpaid_lunch_minutes + cfg.paid_break_minutes) / 60;
  const net_h = worked_span_h >= cfg.break_deduction_threshold_hours
    ? worked_span_h - break_h
    : worked_span_h;

  shift.net_hours = net_h;
  shift.status    = 'ok';

  // ── OT bucket classification ──────────────────────────────────────────────

  if (isHoliday) {
    // All net hours → 2x holiday bucket; do NOT count toward weekly 45 threshold.
    shift._hot = net_h;
  } else {
    // Daily OT first: hours above the daily threshold go to weekday_ot bucket.
    const dot = Math.max(0, net_h - cfg.daily_ot_threshold_hours);
    shift._dot = dot;
    shift._reg = Math.min(net_h, cfg.daily_ot_threshold_hours);

    // under_hours_day applies to weekdays only (not Saturday).
    if (dayType === 'weekday' && net_h < cfg.normal_day_hours) {
      shift.flags.push('under_hours_day');
    }
  }

  return shift;
}

// ─── Weekly rollup ────────────────────────────────────────────────────────────

function weeklyRollup(processed, cfg) {
  const map = new Map();

  for (const s of processed) {
    if (s.net_hours === null) continue;   // missing_punch / orphan / over_max_shift

    const key = isoWeekKey(s.clock_in);
    if (!map.has(key)) {
      map.set(key, { key, reg: 0, dot: 0, hot: 0 });
    }
    const w = map.get(key);
    w.reg += s._reg;   // capped-at-daily non-holiday hours
    w.dot += s._dot;   // daily OT hours from this week
    w.hot += s._hot;   // holiday OT hours
  }

  return [...map.values()]
    .sort((a, b) => a.key.localeCompare(b.key))
    .map(w => {
      const thr = cfg.weekly_ot_threshold_hours;

      // Weekly OT: regular (non-holiday, non-daily-OT) hours beyond the threshold.
      // The 40-45 band is normal rate; only > 45 triggers weekly OT.
      // No double-counting: hours already in _dot are excluded from _reg.
      const weekly_ot = Math.max(0, w.reg - thr);
      const normal    = Math.min(w.reg, thr);

      const flags = [];

      // under_hours_week: total non-holiday net hours for the week < normal_week_hours.
      // (w.reg + w.dot) reconstructs the full non-holiday net, uncapped.
      if ((w.reg + w.dot) < cfg.normal_week_hours) {
        flags.push('under_hours_week');
      }

      return {
        iso_week:         w.key,
        normal_hours:     normal,
        weekday_ot_hours: w.dot + weekly_ot,
        holiday_ot_hours: w.hot,
        flags,
      };
    });
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Classify one user's punch records into hour buckets.
 *
 * Pure function — no I/O, no database access, no side effects.
 * Buckets are LABELS for a downstream payroll system; this function never
 * multiplies by a rate or outputs currency.
 *
 * @param {Array<{type:'clock_in'|'clock_out', time:Date|string}>} punches
 *   Unsorted is fine; the function sorts internally.
 *
 * @param {Object} [rules]
 *   Override any field from DEFAULT_CONFIG.
 *
 * @param {((dateStr: string) => string) | Object} getDayType
 *   Maps a local date string 'YYYY-MM-DD' to one of:
 *   'weekday' | 'saturday' | 'sunday' | 'public_holiday'
 *   The caller is responsible for supplying public-holiday information.
 *   Can be a function or a plain lookup object.
 *
 * @returns {{
 *   shifts: Array<{
 *     clock_in:  Date|null,
 *     clock_out: Date|null,
 *     net_hours: number|null,
 *     status:    string,
 *     flags:     string[]
 *   }>,
 *   weeks: Array<{
 *     iso_week:         string,
 *     normal_hours:     number,
 *     weekday_ot_hours: number,
 *     holiday_ot_hours: number,
 *     flags:            string[]
 *   }>
 * }}
 */
function classifyHours(punches, rules, getDayType) {
  const cfg = Object.assign({}, DEFAULT_CONFIG, rules);

  // Normalise input: coerce times to Date, sort ascending.
  const sorted = punches
    .map(p => ({ type: p.type, time: new Date(p.time) }))
    .sort((a, b) => a.time - b.time);

  // Suppress same-type duplicate scans (e.g. double-tap on a reader).
  const deduped = dedupe(sorted, cfg.debounce_seconds);

  // Build raw shift descriptors via state machine.
  const raw = pairPunches(deduped);

  // Compute per-shift metrics (includes private _reg / _dot / _hot fields).
  const withBuckets = raw.map(r => processShift(r, cfg, getDayType));

  // Weekly rollup (reads private fields before they are stripped).
  const weeks = weeklyRollup(withBuckets, cfg);

  // Strip private accumulator fields from the public shift objects.
  const shifts = withBuckets.map(({ _reg, _dot, _hot, ...pub }) => pub);

  return { shifts, weeks };
}

module.exports = { classifyHours, DEFAULT_CONFIG };
