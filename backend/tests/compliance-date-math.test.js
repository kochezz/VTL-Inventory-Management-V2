'use strict';

// feature/compliance-register-ux, Step 0 fix verification. Pure date-math
// functions only -- no DB, no server -- so this suite is run three times,
// once per TZ, rather than the usual real-HTTP-against-a-running-server
// pattern the rest of tests/ uses (see tests/README.md):
//   TZ=Africa/Johannesburg node --test tests/compliance-date-math.test.js   (UTC+2, this project's own dev machine)
//   TZ=Pacific/Kiritimati   node --test tests/compliance-date-math.test.js   (UTC+14, the earliest civil timezone)
//   TZ=Pacific/Pago_Pago    node --test tests/compliance-date-math.test.js   (UTC-11, one of the latest)
// Every expected value below is a hardcoded literal -- if nextDueDateClamped
// or validateDateOnly ever went back to constructing a Date object from a
// DB-read value and reading it back with a UTC method, at least one of
// these three runs would disagree with the hardcoded literal and fail.
// All three must pass identically for the fix to be considered verified.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { nextDueDateClamped, validateDateOnly } = require('../src/services/compliance-service');

test(`process TZ is ${process.env.TZ || '(unset -- pass TZ=... explicitly)'}`, () => {
  assert.ok(true);
});

test('nextDueDateClamped: anchor on the 1st, monthly', () => {
  assert.equal(nextDueDateClamped('2026-01-01', 1, 1), '2026-02-01');
});

test('nextDueDateClamped: anchor on the 1st, quarterly', () => {
  assert.equal(nextDueDateClamped('2026-01-01', 3, 1), '2026-04-01');
});

test('nextDueDateClamped: anchor on the 1st, annual, crosses a year boundary', () => {
  assert.equal(nextDueDateClamped('2026-12-01', 1, 1), '2027-01-01');
});

test('nextDueDateClamped: day 28 into a non-leap February', () => {
  assert.equal(nextDueDateClamped('2026-01-28', 1, 28), '2026-02-28');
});

test('nextDueDateClamped: day 29 clamps into a non-leap February', () => {
  assert.equal(nextDueDateClamped('2026-01-29', 1, 29), '2026-02-28');
});

test('nextDueDateClamped: day 30 clamps into a non-leap February', () => {
  assert.equal(nextDueDateClamped('2026-01-30', 1, 30), '2026-02-28');
});

test('nextDueDateClamped: day 31 clamps into a non-leap February', () => {
  assert.equal(nextDueDateClamped('2026-01-31', 1, 31), '2026-02-28');
});

test('nextDueDateClamped: day 31 clamps into a 30-day month (April)', () => {
  assert.equal(nextDueDateClamped('2026-01-31', 3, 31), '2026-04-30');
});

test('nextDueDateClamped: 29 Feb in a leap year, monthly, clamps into March 29 (not clamped -- March has 31 days)', () => {
  assert.equal(nextDueDateClamped('2028-02-29', 1, 29), '2028-03-29');
});

test('nextDueDateClamped: 29 Feb in a leap year, annual, lands back on 28 Feb the following (non-leap) year', () => {
  assert.equal(nextDueDateClamped('2028-02-29', 12, 29), '2029-02-28');
});

test('nextDueDateClamped: 29 Feb leap year to the next leap year (4-year interval) stays on the 29th', () => {
  assert.equal(nextDueDateClamped('2028-02-29', 48, 29), '2032-02-29');
});

test('nextDueDateClamped: day 31 anchor, quarterly, real production case (WCFCB)', () => {
  assert.equal(nextDueDateClamped('2026-12-31', 3, 31), '2027-03-31');
});

test('validateDateOnly: rejects a 5-digit year (the PACRA data-quality case)', () => {
  assert.throws(() => validateDateOnly('82027-02-10', 'due_date'), /YYYY-MM-DD format/);
});

test('validateDateOnly: rejects a year below 2000', () => {
  assert.throws(() => validateDateOnly('1999-06-15', 'due_date'), /year must be between 2000 and 2100/);
});

test('validateDateOnly: rejects a year above 2100', () => {
  assert.throws(() => validateDateOnly('2101-01-01', 'due_date'), /year must be between 2000 and 2100/);
});

test('validateDateOnly: accepts 29 Feb in a leap year', () => {
  assert.equal(validateDateOnly('2028-02-29', 'anchor_date'), '2028-02-29');
});

test('validateDateOnly: rejects 29 Feb in a non-leap year', () => {
  assert.throws(() => validateDateOnly('2026-02-29', 'anchor_date'), /not a valid date/);
});

test('validateDateOnly: rejects 31 April (30-day month)', () => {
  assert.throws(() => validateDateOnly('2026-04-31', 'due_date'), /not a valid date/);
});

test('validateDateOnly: accepts a well-formed boundary date, year 2100', () => {
  assert.equal(validateDateOnly('2100-12-31', 'due_date'), '2100-12-31');
});

test('validateDateOnly: accepts a well-formed boundary date, year 2000', () => {
  assert.equal(validateDateOnly('2000-01-01', 'due_date'), '2000-01-01');
});
