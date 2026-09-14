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

require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });

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
      `already running (npm run dev, or node server.js) before "npm test". Original error: ${err.message}`
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
  const result = await pool.query(
    `SELECT user_id, email, role, full_name FROM users WHERE role = $1 AND is_active = true LIMIT 1`,
    [role]
  );
  if (result.rows.length === 0) {
    throw new Error(`No active user with role '${role}' exists in the DB -- cannot sign a test token for it.`);
  }
  const user = result.rows[0];
  const token = jwt.sign(
    { user_id: user.user_id, email: user.email, role: user.role, full_name: user.full_name },
    process.env.JWT_SECRET,
    { expiresIn: '15m' }
  );
  return { token, user };
}

// Tracks every row a test creates so it can be deleted afterward. Pass one
// per test (or per test file, via a shared `after` hook) and call
// `.run()` once the test's assertions are done.
class Cleanup {
  constructor() {
    this.complianceItemIds = [];
    this.complianceCategoryIds = [];
  }
  trackItem(id) { if (id) this.complianceItemIds.push(id); }
  trackCategory(id) { if (id) this.complianceCategoryIds.push(id); }

  async run() {
    if (this.complianceItemIds.length) {
      // Child rows first -- neither compliance_reminder_log nor
      // compliance_acknowledgements has ON DELETE CASCADE, so deleting the
      // item first would hit a foreign key violation once a test has
      // exercised the scheduler or the acknowledge endpoint.
      await pool.query(`DELETE FROM compliance_reminder_log WHERE item_id = ANY($1)`, [this.complianceItemIds]);
      await pool.query(`DELETE FROM compliance_acknowledgements WHERE item_id = ANY($1)`, [this.complianceItemIds]);
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
        await pool.query(`DELETE FROM compliance_items WHERE item_id = ANY($1)`, [leftoverIds]);
      }
      await pool.query(`DELETE FROM compliance_recurrence_rule WHERE category_id = ANY($1)`, [this.complianceCategoryIds]);
      await pool.query(`DELETE FROM compliance_categories WHERE category_id = ANY($1)`, [this.complianceCategoryIds]);
    }
  }
}

async function createComplianceCategory({ name, regulator = 'TEST', recurrence_type = 'ONE_OFF_EXPIRY' }) {
  const result = await pool.query(
    `INSERT INTO compliance_categories (name, regulator, recurrence_type) VALUES ($1, $2, $3) RETURNING category_id`,
    [name, regulator, recurrence_type]
  );
  return result.rows[0].category_id;
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
async function backdateReminderLog(itemId, tier, sentDate) {
  await pool.query(
    `UPDATE compliance_reminder_log SET sent_date = $1, sent_at = $1::date WHERE item_id = $2 AND tier = $3`,
    [sentDate, itemId, tier]
  );
}

module.exports = {
  BASE_URL,
  pool,
  assertServerReachable,
  login,
  authHeaders,
  signTokenForRole,
  Cleanup,
  createComplianceCategory,
  getUserRow,
  waitForResendEmail,
  callScheduler,
  backdateReminderLog,
};
