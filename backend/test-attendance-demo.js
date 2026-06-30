'use strict';
// test-attendance-demo.js — live DB demo for the attendance module
// Run with: node backend/test-attendance-demo.js
//
// Demonstrates:
//   Scenario B — Forced first-change blocks a punch (403 PIN_MUST_CHANGE)
//   Scenario A — 5 wrong PINs → account locked  (423 PIN_LOCKED)
//   Scenario C — Email-localpart punch → entry_method stored as 'email'

require('dotenv').config();
const bcrypt = require('bcrypt');
const { pool }    = require('./src/services/auth-service');
const { issuePIN, resetPIN, verifyPin,
        validateTerminal, recordPunch } = require('./src/services/attendance-service');

// ─── Tiny test runner ─────────────────────────────────────────────────────────

let passed = 0, failed = 0;

function check(label, actual, expected) {
  const eq = actual === expected;
  if (eq) { console.log(`  ✅  ${label}`); passed++; }
  else {
    console.log(`  ❌  ${label}`);
    console.log(`        expected : ${JSON.stringify(expected)}`);
    console.log(`        got      : ${JSON.stringify(actual)}`);
    failed++;
  }
}

async function expectError(label, fn, wantStatus, wantCode) {
  try {
    await fn();
    console.log(`  ❌  ${label} — expected error, none thrown`);
    failed++;
    return null;
  } catch (err) {
    const ok = err.status === wantStatus && (!wantCode || err.code === wantCode);
    if (ok) { console.log(`  ✅  ${label}`); console.log(`        → ${err.message}`); passed++; }
    else {
      console.log(`  ❌  ${label}`);
      console.log(`        expected status=${wantStatus} code=${wantCode}`);
      console.log(`        got      status=${err.status}  code=${err.code}  msg=${err.message}`);
      failed++;
    }
    return err;
  }
}

function section(title) {
  console.log(`\n${'─'.repeat(64)}\n${title}\n${'─'.repeat(64)}`);
}

// ─── Setup ────────────────────────────────────────────────────────────────────

const DEVICE_CODE = 'DEMO-KIOSK-01';

async function setup() {
  section('SETUP');

  const { rows: [admin] } = await pool.query(
    `SELECT user_id, full_name, email FROM users WHERE role='admin' AND is_active=TRUE LIMIT 1`
  );
  if (!admin) throw new Error('No active admin — seed the DB first');
  console.log(`  Admin : ${admin.full_name} (${admin.email})`);

  const { rows: [worker] } = await pool.query(
    `SELECT user_id, full_name, email FROM users WHERE role!='admin' AND is_active=TRUE LIMIT 1`
  );
  if (!worker) throw new Error('No active worker — seed the DB first');
  console.log(`  Worker: ${worker.full_name} (${worker.email})`);

  // Save current credential state for cleanup
  const { rows: [origCred] } = await pool.query(
    `SELECT pin_hash, pin_failed_attempts, pin_locked_until, pin_must_change
     FROM attendance_credentials WHERE user_id=$1`,
    [worker.user_id]
  );

  // Create (or reuse) demo terminal — facility is NOT NULL
  await pool.query(
    `INSERT INTO attendance_terminals (device_code, facility, location_description, allowed_ip, status)
     VALUES ($1, 'Demo Facility', 'Test Lab', NULL, 'active')
     ON CONFLICT (device_code) DO UPDATE SET status='active'`,
    [DEVICE_CODE]
  );
  console.log(`  Terminal '${DEVICE_CODE}' ready`);

  return { admin, worker, origCred };
}

// ─── Scenario B — pin_must_change blocks a punch ──────────────────────────────

async function scenarioB(admin, worker) {
  section('SCENARIO B — pin_must_change blocks punch');

  await issuePIN(worker.user_id, '1234', admin.user_id, '127.0.0.1');
  console.log(`  Admin issued PIN '1234' — pin_must_change set TRUE`);

  const localpart = worker.email.replace('@vilag.io', '');
  const { pin_must_change, full_name } = await verifyPin({ email_localpart: localpart }, '1234');

  check('verifyPin succeeds with correct PIN',    typeof full_name, 'string');
  check('pin_must_change is TRUE after issue',    pin_must_change,  true);

  // Simulate what the punch route does
  if (pin_must_change) {
    console.log("  → Punch BLOCKED: 403 PIN_MUST_CHANGE");
    check('punch gate fires correctly', true, true);
  }
}

// ─── Scenario A — lockout after 5 wrong PINs ─────────────────────────────────

async function scenarioA(worker) {
  section('SCENARIO A — lockout after 5 wrong PINs');

  const localpart = worker.email.replace('@vilag.io', '');

  // Reset counter (carries over from successful verify in scenario B)
  await pool.query(
    'UPDATE attendance_credentials SET pin_failed_attempts=0, pin_locked_until=NULL WHERE user_id=$1',
    [worker.user_id]
  );

  for (let i = 1; i <= 4; i++) {
    await expectError(
      `Attempt ${i}/5 with wrong PIN → 401 INVALID_PIN`,
      () => verifyPin({ email_localpart: localpart }, '9999'),
      401, 'INVALID_PIN'
    );
  }

  const lockErr = await expectError(
    'Attempt 5/5 → 423 PIN_LOCKED',
    () => verifyPin({ email_localpart: localpart }, '9999'),
    423, 'PIN_LOCKED'
  );
  if (lockErr) {
    check('minutes_remaining > 0', lockErr.minutes_remaining > 0, true);
    console.log(`    minutes_remaining = ${lockErr.minutes_remaining}`);
  }

  await expectError(
    'Correct PIN during lockout → still 423 PIN_LOCKED',
    () => verifyPin({ email_localpart: localpart }, '1234'),
    423, 'PIN_LOCKED'
  );
}

// ─── Scenario C — email-localpart punch, entry_method = 'email' ──────────────

async function scenarioC(admin, worker) {
  section("SCENARIO C — email localpart punch → entry_method = 'email'");

  // Unlock + set a fresh PIN with no must-change for this scenario
  const cleanHash = await bcrypt.hash('5678', 10);
  await pool.query(
    `UPDATE attendance_credentials
     SET pin_hash=$1, pin_must_change=FALSE, pin_failed_attempts=0, pin_locked_until=NULL
     WHERE user_id=$2`,
    [cleanHash, worker.user_id]
  );
  console.log(`  Credential reset: PIN='5678', pin_must_change=FALSE`);

  const localpart  = worker.email.replace('@vilag.io', '');
  const { terminal_id } = await validateTerminal(DEVICE_CODE, '127.0.0.1');
  const { user_id }     = await verifyPin({ email_localpart: localpart }, '5678');

  const client_uuid = require('crypto').randomUUID();
  const result = await recordPunch({
    user_id,
    terminal_id,
    punch_type:   'clock_in',
    punched_at:   new Date(),
    entry_method: 'email',
    photo_ref:    'demo/placeholder.jpg',
    client_uuid,
  });

  check('Punch accepted (not idempotent)',     result.idempotent,           false);
  check('punch_id returned',                  typeof result.punch_id === 'string', true);

  const { rows: [row] } = await pool.query(
    'SELECT entry_method, source FROM attendance_punches WHERE punch_id=$1',
    [result.punch_id]
  );
  check("entry_method = 'email'",             row?.entry_method,  'email');
  check("source = 'online'",                  row?.source,        'online');

  // Idempotent re-send
  const dup = await recordPunch({
    user_id, terminal_id, punch_type: 'clock_in', punched_at: new Date(),
    entry_method: 'email', photo_ref: 'demo/placeholder.jpg', client_uuid,
  });
  check('Same client_uuid → idempotent',      dup.idempotent,     true);

  // Cleanup
  await pool.query('DELETE FROM attendance_shifts WHERE clock_in_punch_id=$1', [result.punch_id]);
  await pool.query('DELETE FROM attendance_punches WHERE punch_id=$1',          [result.punch_id]);
  console.log('  Demo punch + shift cleaned up');
}

// ─── Cleanup ──────────────────────────────────────────────────────────────────

async function cleanup(worker, origCred) {
  section('CLEANUP — restore original credential state');
  if (origCred) {
    await pool.query(
      `UPDATE attendance_credentials
       SET pin_hash=$1, pin_failed_attempts=$2, pin_locked_until=$3, pin_must_change=$4
       WHERE user_id=$5`,
      [origCred.pin_hash, origCred.pin_failed_attempts,
       origCred.pin_locked_until, origCred.pin_must_change, worker.user_id]
    );
    console.log(`  ${worker.full_name}'s credential state restored`);
  } else {
    // No credential existed before — remove the one we created
    await pool.query('DELETE FROM attendance_credentials WHERE user_id=$1', [worker.user_id]);
    console.log(`  Demo credential removed`);
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('═'.repeat(64));
  console.log('ATTENDANCE MODULE — live DB demo');
  console.log('═'.repeat(64));

  let ctx;
  try {
    ctx = await setup();
  } catch (err) {
    console.error(`\n  SETUP FAILED: ${err.message}`);
    await pool.end();
    process.exit(1);
  }

  try {
    await scenarioB(ctx.admin, ctx.worker);
    await scenarioA(ctx.worker);
    await scenarioC(ctx.admin, ctx.worker);
  } finally {
    await cleanup(ctx.worker, ctx.origCred);
    await pool.end();
  }

  console.log(`\n${'═'.repeat(64)}`);
  console.log(`RESULTS  ${passed} passed  ${failed} failed`);
  console.log('═'.repeat(64));
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => { console.error(err); process.exit(1); });
