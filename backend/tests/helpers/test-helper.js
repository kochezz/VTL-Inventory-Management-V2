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
      await pool.query(`DELETE FROM compliance_items WHERE item_id = ANY($1)`, [this.complianceItemIds]);
    }
    if (this.complianceCategoryIds.length) {
      // A category's recurrence rule (if any) cascades via its own FK to
      // compliance_items.recurrence_rule_id already being cleared above by
      // the item delete; delete the rule row directly by category_id too,
      // since a category can have a rule with no remaining item pointing at it.
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
async function waitForResendEmail({ subject, sentAfter, timeoutMs = 8000, intervalMs = 1000 }) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const { data } = await resend.emails.list();
    const match = (data?.data || []).find(
      (e) => e.subject === subject && new Date(e.created_at) >= sentAfter
    );
    if (match) return match;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return null;
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
};
