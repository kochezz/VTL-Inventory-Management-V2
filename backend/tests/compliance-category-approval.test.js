'use strict';

// Compliance Module: category creation opened to junior_accountant, gated by
// a PENDING_APPROVAL -> ACTIVE/REJECTED approval workflow mirroring
// compliance_items' existing self-approval pattern.
//
// Covers Step 5 of that session's plan: creation lands PENDING_APPROVAL and
// is invisible to the Register picker (?status=ACTIVE) until approved;
// approve/reject role gates; the self-approval decision (an executive's own
// category needs a *different* executive, OR the same executive with an
// explicit justification); the PACRA category's backfill to ACTIVE is
// unaffected by any of this.

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const axios = require('axios');

const {
  BASE_URL,
  pool,
  assertServerReachable,
  login,
  authHeaders,
  signTokenForRole,
  Cleanup,
} = require('./helpers/test-helper');

const cleanup = new Cleanup();
let adminToken, adminHeaders, adminUser;
let cfoToken, cfoHeaders, cfoUser;
let jrToken, jrHeaders, jrUser;

before(async () => {
  await assertServerReachable();

  adminToken = await login(process.env.TEST_ADMIN_EMAIL, process.env.TEST_ADMIN_PASSWORD);
  adminHeaders = authHeaders(adminToken);
  ({ user: adminUser } = await signTokenForRole('admin')); // real login above; this is only for the user row

  ({ token: cfoToken, user: cfoUser } = await signTokenForRole('cfo'));
  cfoHeaders = authHeaders(cfoToken);

  ({ token: jrToken, user: jrUser } = await signTokenForRole('junior_accountant'));
  jrHeaders = authHeaders(jrToken);
});

after(async () => {
  await cleanup.run();
});

async function createCategory(headers, nameSuffix) {
  const res = await axios.post(
    `${BASE_URL}/api/compliance/categories`,
    {
      name: `TEST SUITE - category approval ${nameSuffix}`,
      recurrence_type: 'ONE_OFF_EXPIRY',
      reminder_ladder_days: [30, 15, 5],
    },
    headers
  );
  cleanup.trackCategory(res.data.category_id);
  return res.data;
}

// ── Creation lands PENDING_APPROVAL and is invisible to the picker ─────────

test('junior_accountant creates a category -> PENDING_APPROVAL, absent from the ACTIVE picker view', async () => {
  const created = await createCategory(jrHeaders, 'jr picker visibility');
  assert.equal(created.status, 'PENDING_APPROVAL');

  const pickerView = await axios.get(`${BASE_URL}/api/compliance/categories?status=ACTIVE`, jrHeaders);
  assert.ok(
    !pickerView.data.some((c) => c.category_id === created.category_id),
    'a PENDING_APPROVAL category must not appear in the status=ACTIVE picker view'
  );

  const pendingView = await axios.get(`${BASE_URL}/api/compliance/categories?status=PENDING_APPROVAL&active_only=false`, adminHeaders);
  assert.ok(pendingView.data.some((c) => c.category_id === created.category_id), 'should appear in the pending-approval queue view');
});

// ── Approve/reject role gate ────────────────────────────────────────────────

test('junior_accountant gets 403 approving a category', async () => {
  const created = await createCategory(adminHeaders, 'jr approve blocked');
  await assert.rejects(
    () => axios.post(`${BASE_URL}/api/compliance/categories/${created.category_id}/approve`, {}, jrHeaders),
    (err) => err.response?.status === 403
  );
});

test('junior_accountant gets 403 rejecting a category', async () => {
  const created = await createCategory(adminHeaders, 'jr reject blocked');
  await assert.rejects(
    () => axios.post(`${BASE_URL}/api/compliance/categories/${created.category_id}/reject`, { reason: 'no' }, jrHeaders),
    (err) => err.response?.status === 403
  );
});

// ── Approve: happy path, now appears in the picker ──────────────────────────

test('admin approves a junior_accountant-created category -> ACTIVE, now appears in the picker', async () => {
  const created = await createCategory(jrHeaders, 'jr create, admin approve');

  const approveRes = await axios.post(`${BASE_URL}/api/compliance/categories/${created.category_id}/approve`, {}, adminHeaders);
  assert.equal(approveRes.status, 200);
  assert.equal(approveRes.data.category.status, 'ACTIVE');
  assert.equal(approveRes.data.category.approved_by, adminUser.user_id);
  assert.ok(approveRes.data.category.approved_at);
  assert.equal(approveRes.data.is_self_approved, false);

  const pickerView = await axios.get(`${BASE_URL}/api/compliance/categories?status=ACTIVE`, jrHeaders);
  assert.ok(pickerView.data.some((c) => c.category_id === created.category_id), 'now-ACTIVE category should appear in the picker view');
});

// ── Reject: happy path, stays unusable, reason recorded ─────────────────────

test('cfo rejects a junior_accountant-created category -> REJECTED, reason recorded, still absent from the picker', async () => {
  const created = await createCategory(jrHeaders, 'jr create, cfo reject');

  const rejectRes = await axios.post(
    `${BASE_URL}/api/compliance/categories/${created.category_id}/reject`,
    { reason: 'TEST SUITE - duplicate of an existing obligation' },
    cfoHeaders
  );
  assert.equal(rejectRes.status, 200);
  assert.equal(rejectRes.data.status, 'REJECTED');
  assert.equal(rejectRes.data.rejection_reason, 'TEST SUITE - duplicate of an existing obligation');

  const pickerView = await axios.get(`${BASE_URL}/api/compliance/categories?status=ACTIVE`, jrHeaders);
  assert.ok(!pickerView.data.some((c) => c.category_id === created.category_id));
});

test('rejecting without a reason is rejected with 400', async () => {
  const created = await createCategory(jrHeaders, 'reject needs reason');
  await assert.rejects(
    () => axios.post(`${BASE_URL}/api/compliance/categories/${created.category_id}/reject`, {}, adminHeaders),
    (err) => err.response?.status === 400
  );
});

// ── Self-approval decision: mirrors compliance_items -- same executive CAN
// approve their own category, but only with an explicit justification. ─────

test('admin approving their own category without justification is rejected with 400', async () => {
  const created = await createCategory(adminHeaders, 'self-approve no justification');
  await assert.rejects(
    () => axios.post(`${BASE_URL}/api/compliance/categories/${created.category_id}/approve`, {}, adminHeaders),
    (err) => err.response?.status === 400
  );
});

test('admin approving their own category WITH justification succeeds and is flagged is_self_approved', async () => {
  const created = await createCategory(adminHeaders, 'self-approve with justification');
  const res = await axios.post(
    `${BASE_URL}/api/compliance/categories/${created.category_id}/approve`,
    { justification: 'TEST SUITE - only executive available at the time, cross-checked against the regulator notice manually' },
    adminHeaders
  );
  assert.equal(res.status, 200);
  assert.equal(res.data.category.status, 'ACTIVE');
  assert.equal(res.data.is_self_approved, true);
  assert.equal(res.data.category.is_self_approved, true);
  assert.equal(
    res.data.category.self_approval_justification,
    'TEST SUITE - only executive available at the time, cross-checked against the regulator notice manually'
  );
});

test('cfo approving admin-created category needs no justification (not self-approval)', async () => {
  const created = await createCategory(adminHeaders, 'cross-executive approve');
  const res = await axios.post(`${BASE_URL}/api/compliance/categories/${created.category_id}/approve`, {}, cfoHeaders);
  assert.equal(res.status, 200);
  assert.equal(res.data.is_self_approved, false);
  assert.equal(res.data.category.self_approval_justification, null);
});

// ── Re-processing guard ─────────────────────────────────────────────────────

test('approving an already-ACTIVE category is rejected with 400', async () => {
  const created = await createCategory(jrHeaders, 'double approve');
  await axios.post(`${BASE_URL}/api/compliance/categories/${created.category_id}/approve`, {}, adminHeaders);

  await assert.rejects(
    () => axios.post(`${BASE_URL}/api/compliance/categories/${created.category_id}/approve`, {}, cfoHeaders),
    (err) => err.response?.status === 400
  );
});

test('rejecting an already-REJECTED category is rejected with 400', async () => {
  const created = await createCategory(jrHeaders, 'double reject');
  await axios.post(`${BASE_URL}/api/compliance/categories/${created.category_id}/reject`, { reason: 'first pass' }, adminHeaders);

  await assert.rejects(
    () => axios.post(`${BASE_URL}/api/compliance/categories/${created.category_id}/reject`, { reason: 'second pass' }, cfoHeaders),
    (err) => err.response?.status === 400
  );
});

// ── PACRA backfill unaffected ────────────────────────────────────────────────

test('the real PACRA Annual Return category was backfilled to ACTIVE and is unaffected', async () => {
  const result = await pool.query(
    `SELECT status, approved_by, rejection_reason FROM compliance_categories WHERE name = 'PACRA Annual Return'`
  );
  assert.equal(result.rows.length, 1, 'expected exactly one PACRA Annual Return category');
  assert.equal(result.rows[0].status, 'ACTIVE');
  assert.equal(result.rows[0].rejection_reason, null);

  const pickerView = await axios.get(`${BASE_URL}/api/compliance/categories?status=ACTIVE`, jrHeaders);
  assert.ok(pickerView.data.some((c) => c.name === 'PACRA Annual Return'));
});
