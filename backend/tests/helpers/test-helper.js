'use strict';

// Shared helper for the integration test suite under backend/tests/.
//
// These tests make real HTTP calls against a real running dev server, which
// commits its own writes in its own request-scoped DB transaction -- a
// client-side BEGIN/ROLLBACK wrapped around a *separate* pool connection in
// this file cannot undo those. So instead of a literal rollback, every test
// tracks exactly which rows it created and this helper deletes them
// afterward. This is the same pattern proven by hand across every ad hoc
// verification script in this project's history (Phase 0 through the Phase 2
// merge sessions) -- real writes, explicit tracked cleanup, not mocks.

// Loads .env.test, NOT .env -- these tests must never run against
// production (an incident this project has already had once with the
// return/resubmit suite). assertDatabaseIsNotProduction below is the actual
// enforcement, not just this path choice: even if .env.test is ever
// accidentally left pointing at the production host, the guard aborts the
// whole run before any test executes, rather than relying on everyone
// remembering to check.
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env.test') });

const { assertDatabaseIsNotProduction, extractHost } = require('./db-safety-guard');
assertDatabaseIsNotProduction(process.env.DATABASE_URL, path.join(__dirname, '..', '..', '.env'));

const axios = require('axios');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
const { Resend } = require('resend');

const BASE_URL = process.env.TEST_API_BASE_URL || 'http://localhost:3001';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const resend = new Resend(process.env.SMTP_PASS);

async function assertServerReachable() {
  try {
    await axios.get(`${BASE_URL}/health`, { timeout: 5000 });
  } catch (err) {
    throw new Error(
      `Cannot reach ${BASE_URL}/health -- these tests require the backend dev server ` +
      `already running (npm run dev:test-server) before "npm test". Original error: ${err.message}`
    );
  }

  // This process's OWN pool is already guarded (assertDatabaseIsNotProduction
  // above), but every HTTP-driven test action runs against whatever server
  // is actually listening on BASE_URL -- which could be a plain `npm run
  // dev` (real .env, no mock) left running from something else. /api/_test
  // only exists at all when that server was started with
  // MOCK_EMAIL_TRANSPORT on (see test-debug-routes.js) -- its absence, or a
  // host mismatch, means the server under test isn't the test-branch one.
  const testHost = extractHost(process.env.DATABASE_URL);
  let serverDbRes;
  try {
    serverDbRes = await axios.get(`${BASE_URL}/api/_test/db-host`, { timeout: 5000 });
  } catch (err) {
    throw new Error(
      `SAFETY GUARD: ${BASE_URL}/api/_test/db-host is unreachable -- the server under test was ` +
      `not started with npm run dev:test-server (which sets MOCK_EMAIL_TRANSPORT and ENV_FILE=.env.test). ` +
      `Refusing to run tests against a server whose database can't be confirmed. Original error: ${err.message}`
    );
  }
  if (serverDbRes.data.host !== testHost) {
    throw new Error(
      `SAFETY GUARD: the server at ${BASE_URL} is using database host "${serverDbRes.data.host}", ` +
      `but this test process's own DATABASE_URL (.env.test) is "${testHost}". Refusing to run tests -- ` +
      `restart the server with npm run dev:test-server so both point at the same test branch.`
    );
  }
}

async function login(email, password) {
  const res = await axios.post(`${BASE_URL}/api/auth/login`, { email, password });
  return res.data.token;
}

function authHeaders(token) {
  return { headers: { Authorization: `Bearer ${token}` } };
}

// Finds a real, active user holding the given role -- ground truth from the
// live DB, never a hardcoded user_id -- and signs a token for them using the
// exact same shape/secret as auth-service.js's generateAccessToken. This is
// deliberately NOT the same as the ad hoc chat-session pattern (which reset
// real employees' passwords and logged in for real): a checked-in suite that
// runs repeatedly (locally, in CI) should not have the side effect of
// resetting real people's credentials every run. The resulting JWT is
// otherwise indistinguishable from one minted by a real login -- nothing
// about the request pipeline, middleware, or DB is mocked.
async function signTokenForRole(role) {
  // Root cause of the 2026-10 customer-test leak: this query used to have
  // neither an exclusion nor an ORDER BY, so a leftover disposable fixture
  // from a crashed password-management.test.js run (also role=
  // junior_accountant, also is_active=true at the time) could get picked
  // "at random" by role-permissions.test.js's own before() hook instead of
  // the real junior_accountant -- and whatever that test then created
  // (2 "TEST SUITE Customer Access Check" customers) ended up permanently
  // owned by a disposable account nobody could later delete without an FK
  // violation. Excluding anything named like a disposable fixture, plus a
  // stable ORDER BY, makes which real user gets signed both correct and
  // deterministic.
  const result = await pool.query(
    `SELECT user_id, email, role, full_name FROM users
     WHERE role = $1 AND is_active = true AND full_name NOT ILIKE 'Test Suite%'
     ORDER BY created_at ASC LIMIT 1`,
    [role]
  );
  let user;
  let created = false;
  if (result.rows.length === 0) {
    // Session H: no active user currently holds this role (e.g. deactivated
    // in an earlier roster cleanup) -- that used to throw here, failing
    // every test in the calling file's before() hook. Create one tracked,
    // disposable user for this role instead of reactivating the real
    // (deliberately deactivated) account -- a fresh row/UUID, no relation
    // to it. The caller gets back created: true and is responsible for
    // deleting this row in its own after() (see cleanupRoleUser below, or
    // Cleanup.trackUser for files already using that class).
    const email = `test-suite-role-${role}-${Date.now()}@vilag.io`;
    const insertRes = await pool.query(
      `INSERT INTO users (email, full_name, password_hash, role, is_active)
       VALUES ($1, $2, 'not-a-real-hash', $3, true)
       RETURNING user_id, email, role, full_name`,
      [email, `TEST SUITE Disposable ${role} User`, role]
    );
    user = insertRes.rows[0];
    created = true;
  } else {
    user = result.rows[0];
  }
  const token = jwt.sign(
    { user_id: user.user_id, email: user.email, role: user.role, full_name: user.full_name },
    process.env.JWT_SECRET,
    { expiresIn: '15m' }
  );
  return { token, user, created };
}

// FK-safe delete-or-deactivate for a disposable user signTokenForRole
// created -- mirrors the established pattern elsewhere in this file (delete,
// and only if something unrelated references the row, deactivate instead of
// leaving the delete attempt silently failed). For files not already using
// the Cleanup class below.
async function cleanupRoleUser(userId) {
  if (!userId) return;
  await pool.query(`DELETE FROM qms_training_tasks WHERE user_id = $1`, [userId]);
  await pool.query(`DELETE FROM users WHERE user_id = $1`, [userId]).catch(async () => {
    await pool.query(`UPDATE users SET is_active = false WHERE user_id = $1`, [userId]);
    console.warn(`⚠️  Disposable role-user ${userId} has live references and could not be deleted -- deactivated instead.`);
  });
}

// Tracks every row a test creates so it can be deleted afterward. Pass one
// per test (or per test file, via a shared `after` hook) and call
// `.run()` once the test's assertions are done.
class Cleanup {
  constructor() {
    this.complianceItemIds = [];
    this.complianceCategoryIds = [];
    this.disposableUserIds = [];
  }
  trackItem(id) { if (id) this.complianceItemIds.push(id); }
  trackCategory(id) { if (id) this.complianceCategoryIds.push(id); }
  // Session H: for a disposable user signTokenForRole created (created:
  // true in its return value) because no active user held that role.
  trackUser(id) { if (id) this.disposableUserIds.push(id); }

  async run() {
    if (this.disposableUserIds.length) {
      for (const userId of this.disposableUserIds) {
        await cleanupRoleUser(userId);
      }
    }
    if (this.complianceItemIds.length) {
      // Child rows first -- neither compliance_reminder_log nor
      // compliance_acknowledgements nor compliance_item_evidence has ON
      // DELETE CASCADE, so deleting the item first would hit a foreign key
      // violation once a test has exercised the scheduler, the acknowledge
      // endpoint, or (now that submit requires it) an evidence upload.
      await pool.query(`DELETE FROM compliance_reminder_log WHERE item_id = ANY($1)`, [this.complianceItemIds]);
      await pool.query(`DELETE FROM compliance_acknowledgements WHERE item_id = ANY($1)`, [this.complianceItemIds]);
      await pool.query(`DELETE FROM compliance_item_evidence WHERE item_id = ANY($1)`, [this.complianceItemIds]);
      await pool.query(`DELETE FROM compliance_items WHERE item_id = ANY($1)`, [this.complianceItemIds]);
    }
    if (this.complianceCategoryIds.length) {
      // Any items still pointing at a to-be-deleted category (e.g.
      // scheduler-auto-generated ones never individually tracked) need their
      // own child rows cleared first too, same reasoning as above.
      const leftoverItems = await pool.query(
        `SELECT item_id FROM compliance_items WHERE category_id = ANY($1)`,
        [this.complianceCategoryIds]
      );
      const leftoverIds = leftoverItems.rows.map((r) => r.item_id);
      if (leftoverIds.length) {
        await pool.query(`DELETE FROM compliance_reminder_log WHERE item_id = ANY($1)`, [leftoverIds]);
        await pool.query(`DELETE FROM compliance_acknowledgements WHERE item_id = ANY($1)`, [leftoverIds]);
        await pool.query(`DELETE FROM compliance_item_evidence WHERE item_id = ANY($1)`, [leftoverIds]);
        await pool.query(`DELETE FROM compliance_items WHERE item_id = ANY($1)`, [leftoverIds]);
      }
      // Rule-scoped reminder_log rows (REAPPROVAL_REMINDER) reference
      // compliance_recurrence_rule.rule_id -- must go before the rule itself.
      await pool.query(
        `DELETE FROM compliance_reminder_log WHERE rule_id IN (
           SELECT rule_id FROM compliance_recurrence_rule WHERE category_id = ANY($1)
         )`,
        [this.complianceCategoryIds]
      );
      await pool.query(`DELETE FROM compliance_recurrence_rule WHERE category_id = ANY($1)`, [this.complianceCategoryIds]);
      await pool.query(`DELETE FROM compliance_categories WHERE category_id = ANY($1)`, [this.complianceCategoryIds]);
    }
  }
}

// Submitting an item now requires a PDF evidence row to exist (see
// compliance-service.js's submitComplianceItem) -- every test file that
// creates-then-submits an item needs this first. The byte content doesn't
// need to be a real, renderable PDF; multer's fileFilter checks the form
// part's declared Content-Type, not the bytes.
async function uploadTestEvidence(itemId, headers) {
  const fd = new FormData();
  fd.append('evidence', new Blob([Buffer.from('%PDF-1.4 test evidence')], { type: 'application/pdf' }), 'test-evidence.pdf');
  return axios.post(`${BASE_URL}/api/compliance/items/${itemId}/evidence`, fd, headers);
}

// Back-compat shim: every existing call site across the test suite passes
// only `recurrence_type` (the pre-flexible-cadence field) -- this derives
// the new cadence_type/interval_months/due_day_of_month/anchor_date from
// it automatically so none of those call sites need to change, while still
// allowing a test to pass the new fields directly when it specifically
// wants to exercise a custom interval.
// obligation_kind defaults to FILING -- createComplianceItem/
// approveComplianceCategory now both require it to be set (feature/
// compliance-register-ux, Step 2), so a category created without one is
// unusable by almost every test that used to just need "a normal
// category." Pass obligation_kind: 'RENEWAL' explicitly for the tests that
// specifically exercise the renewal-only-generator behavior.
async function createComplianceCategory({
  name, regulator = 'TEST', recurrence_type = 'ONE_OFF_EXPIRY',
  cadence_type, interval_months, due_day_of_month, anchor_date, obligation_kind = 'FILING',
}) {
  if (cadence_type === undefined) {
    if (recurrence_type === 'ONE_OFF_EXPIRY') {
      cadence_type = 'ONE_OFF';
    } else if (recurrence_type === 'MONTHLY_RECURRING') {
      cadence_type = 'RECURRING';
      interval_months = interval_months ?? 1;
    } else if (recurrence_type === 'ANNUAL_RECURRING') {
      cadence_type = 'RECURRING';
      interval_months = interval_months ?? 12;
    }
  }
  // A real anchor/due-day so a RECURRING test category is immediately
  // usable by createComplianceItem/the scheduler without every test having
  // to set these explicitly -- today's date is as good a default as any
  // for a disposable test fixture. Uses strict `undefined` checks (not `??`)
  // so a caller CAN explicitly pass anchor_date: null to opt out and get an
  // unconfigured RECURRING category on purpose (e.g. to test the "cadence
  // isn't configured yet" rejection).
  if (cadence_type === 'RECURRING') {
    const today = new Date();
    if (anchor_date === undefined) anchor_date = today.toISOString().split('T')[0];
    if (due_day_of_month === undefined) due_day_of_month = today.getUTCDate();
  }

  const result = await pool.query(
    `INSERT INTO compliance_categories (name, regulator, recurrence_type, cadence_type, interval_months, due_day_of_month, anchor_date, obligation_kind)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING category_id`,
    [name, regulator, recurrence_type, cadence_type, interval_months ?? null, due_day_of_month ?? null, anchor_date ?? null, obligation_kind]
  );
  return result.rows[0].category_id;
}

// Raw insert, bypassing createComplianceItem entirely -- the only way left
// to reach DRAFT: the real API now always creates an UPCOMING item
// (feature/compliance-register-ux Step 2), and submitComplianceItem
// explicitly rejects any UPCOMING/EVIDENCE_SUBMITTED/VERIFIED item
// (assertNotNewVocabularyItem). The legacy DRAFT -> submit -> PENDING_
// APPROVAL -> approve/reject/return -> resubmit machinery is still fully
// live in the service layer (grandfathered rows created before this
// feature still need it to work), so this is what exercises it -- same
// "direct DB insert for a test fixture" convention createComplianceCategory
// above already uses. Doesn't require the category to be ACTIVE (a raw
// insert bypasses that check too), matching the real grandfathered rows
// this simulates, most of which predate the ACTIVE-category requirement.
async function createLegacyDraftItem(categoryId, createdBy, { dueDate = '2027-05-01' } = {}) {
  const result = await pool.query(
    `INSERT INTO compliance_items (category_id, due_date, evidence_file_ref, created_by, status)
     VALUES ($1, $2, $3, $4, 'DRAFT') RETURNING item_id`,
    [categoryId, dueDate, 'legacy-fixture.pdf', createdBy]
  );
  return result.rows[0].item_id;
}

async function getUserRow(userId) {
  const result = await pool.query(
    `SELECT role, department, job_title, reports_to, password_hash, requires_password_change FROM users WHERE user_id = $1`,
    [userId]
  );
  return result.rows[0];
}

// Polls the real Resend API (same account the app itself sends through --
// not a mock) for a matching sent email, since these are fire-and-forget
// sends from the route handler and the HTTP response returns before the
// send necessarily completes. Retries briefly to absorb that race.
//
// resend.emails.list() caps at 20 items per page with no way to widen it
// (a `limit` query param is silently ignored) -- this account has enough
// accumulated volume from months of ad hoc verification work that a
// genuinely-just-sent email can already be past page 1 by the time this
// polls. Pages forward with the `after` cursor (confirmed to work) rather
// than trusting page 1 alone.
async function waitForResendEmail({ subject, sentAfter, timeoutMs = 20000, intervalMs = 1500, maxPages = 5 }) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    let cursor;
    for (let page = 0; page < maxPages; page++) {
      const { data } = cursor
        ? await resend.emails.list({ query: { after: cursor } })
        : await resend.emails.list();
      const items = data?.data || [];
      const match = items.find((e) => e.subject === subject && new Date(e.created_at) >= sentAfter);
      if (match) return match;
      if (!data?.has_more || items.length === 0) break;
      cursor = items[items.length - 1].id;
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return null;
}

// Polls the server's own mock-email debug endpoint (only exists when the
// server was started with MOCK_EMAIL_TRANSPORT=true -- see
// notification-service.js / test-debug-routes.js) for a matching recorded
// send. Same shape and race-absorbing retry as waitForResendEmail, against
// an in-memory record instead of Resend's real history -- no quota cost,
// no network round-trip to a third party, and precise: it asserts the exact
// recipient list and subject that were actually recorded, not just "no
// error was thrown" or a log line a human would have to read.
async function waitForMockEmail({ subject, sentAfter, timeoutMs = 10000, intervalMs = 300 }) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const { data } = await axios.get(`${BASE_URL}/api/_test/email-log`);
    const match = (data?.emails || []).find(
      (e) => e.subject === subject && new Date(e.timestamp) >= sentAfter
    );
    if (match) return match;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return null;
}

// Calls the compliance scheduler webhook exactly as an external cron
// service would -- no JWT, just the shared secret header. Pass
// omitSecret: true to send no header at all (a plain `secret: undefined`
// argument can't express that -- JS destructuring defaults trigger on an
// explicit `undefined` too, so it would silently fall back to the real
// secret instead of testing its absence).
async function callScheduler({ dryRun = false, secret, omitSecret = false } = {}) {
  const headers = {};
  if (!omitSecret) headers['X-Scheduler-Secret'] = secret !== undefined ? secret : process.env.COMPLIANCE_SCHEDULER_SECRET;
  return axios.post(`${BASE_URL}/api/compliance/scheduler/run`, { dryRun }, { headers });
}

// Backdates a reminder_log row's sent_date -- there is no API for this (by
// design; sent_date always defaults to CURRENT_DATE on insert), needed only
// to simulate "yesterday's escalation already went out" without literally
// waiting a day in a test.
async function backdateReminderLog(itemId, tierType, sentDate) {
  await pool.query(
    `UPDATE compliance_reminder_log SET sent_date = $1, sent_at = $1::date WHERE item_id = $2 AND tier_type = $3`,
    [sentDate, itemId, tierType]
  );
}

module.exports = {
  BASE_URL,
  pool,
  assertServerReachable,
  login,
  authHeaders,
  signTokenForRole,
  cleanupRoleUser,
  Cleanup,
  createComplianceCategory,
  createLegacyDraftItem,
  uploadTestEvidence,
  getUserRow,
  waitForResendEmail,
  waitForMockEmail,
  callScheduler,
  backdateReminderLog,
};
