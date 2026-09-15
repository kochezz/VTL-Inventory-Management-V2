'use strict';

// Checked-in port of the ad hoc verification scripts run by hand across the
// Compliance Module Phase 2 session and its follow-up verification session.
// Real HTTP calls against a running dev server, real DB, real Resend sends --
// see backend/tests/README.md for what this assumes before running.

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');

const {
  BASE_URL,
  assertServerReachable,
  login,
  authHeaders,
  signTokenForRole,
  Cleanup,
  createComplianceCategory,
  waitForResendEmail,
} = require('./helpers/test-helper');

const axios = require('axios');

// These two tests are the ONLY ones in the whole suite meant to hit live
// Resend (waitForResendEmail-based, real delivery confirmation) -- every
// other test's notification checks go through the mocked sendEmail() via
// waitForMockEmail (see notification-service.js / tests/README.md).
// Skipped by default on purpose, not just because Resend's daily quota was
// once exhausted (2026-09-14, since resolved) -- real-delivery checks
// should be a deliberate, occasional opt-in, not something every `npm
// test` run does. Running them requires BOTH SKIP_EMAIL_DELIVERY_TESTS=false
// here AND a server started WITHOUT MOCK_EMAIL_TRANSPORT (npm run dev, not
// dev:test-server) -- otherwise sendEmail() never reaches Resend and
// these will just time out finding nothing.
const SKIP_EMAIL_DELIVERY_TESTS = process.env.SKIP_EMAIL_DELIVERY_TESTS !== 'false';
const emailTestOpts = SKIP_EMAIL_DELIVERY_TESTS
  ? { skip: 'Real-delivery test, opt-in only -- set SKIP_EMAIL_DELIVERY_TESTS=false and start the server without MOCK_EMAIL_TRANSPORT to run it' }
  : {};

const cleanup = new Cleanup();
let adminToken, adminHeaders, adminUser;
let jrToken, jrHeaders, jrUser;
let cfoToken, cfoHeaders, cfoUser;
let oneOffCategoryId, monthlyCategoryId;

before(async () => {
  await assertServerReachable();

  adminToken = await login(process.env.TEST_ADMIN_EMAIL, process.env.TEST_ADMIN_PASSWORD);
  adminHeaders = authHeaders(adminToken);
  ({ user: adminUser } = await signTokenForRole('admin')); // reuse for its email lookup only; adminToken above is the real login

  ({ token: jrToken, user: jrUser } = await signTokenForRole('junior_accountant'));
  jrHeaders = authHeaders(jrToken);

  ({ token: cfoToken, user: cfoUser } = await signTokenForRole('cfo'));
  cfoHeaders = authHeaders(cfoToken);

  oneOffCategoryId = await createComplianceCategory({
    name: 'TEST SUITE - one-off category',
    recurrence_type: 'ONE_OFF_EXPIRY',
  });
  cleanup.trackCategory(oneOffCategoryId);

  monthlyCategoryId = await createComplianceCategory({
    name: 'TEST SUITE - monthly recurring category',
    recurrence_type: 'MONTHLY_RECURRING',
  });
  cleanup.trackCategory(monthlyCategoryId);
});

after(async () => {
  await cleanup.run();
});

async function createAndSubmit(headers, categoryId, dueDate, dayOfMonthDue) {
  const body = { category_id: categoryId, due_date: dueDate, evidence_file_ref: 'test.pdf' };
  if (dayOfMonthDue != null) body.day_of_month_due = dayOfMonthDue;
  const createRes = await axios.post(`${BASE_URL}/api/compliance/items`, body, headers);
  cleanup.trackItem(createRes.data.item_id);
  await axios.post(`${BASE_URL}/api/compliance/items/${createRes.data.item_id}/submit`, {}, headers);
  return createRes.data.item_id;
}

test('junior_accountant can create and submit a compliance item', async () => {
  const createRes = await axios.post(
    `${BASE_URL}/api/compliance/items`,
    { category_id: oneOffCategoryId, due_date: '2027-01-15', evidence_file_ref: 'test.pdf' },
    jrHeaders
  );
  cleanup.trackItem(createRes.data.item_id);
  assert.equal(createRes.status, 201);
  assert.equal(createRes.data.status, 'DRAFT');

  const submitRes = await axios.post(`${BASE_URL}/api/compliance/items/${createRes.data.item_id}/submit`, {}, jrHeaders);
  assert.equal(submitRes.status, 200);
  assert.equal(submitRes.data.status, 'PENDING_APPROVAL');
});

test('junior_accountant is blocked from approving (403)', async () => {
  const itemId = await createAndSubmit(jrHeaders, oneOffCategoryId, '2027-01-16');
  await assert.rejects(
    () => axios.post(`${BASE_URL}/api/compliance/items/${itemId}/approve`, {}, jrHeaders),
    (err) => err.response?.status === 403
  );
});

test('admin can approve someone else\'s item (not self-approval)', async () => {
  const itemId = await createAndSubmit(jrHeaders, oneOffCategoryId, '2027-01-17');
  const approveRes = await axios.post(`${BASE_URL}/api/compliance/items/${itemId}/approve`, {}, adminHeaders);
  assert.equal(approveRes.status, 200);
  assert.equal(approveRes.data.item.status, 'APPROVED');
  assert.equal(approveRes.data.item.is_self_approved, false);
});

test('self-approval without justification is rejected with 400', async () => {
  const itemId = await createAndSubmit(adminHeaders, oneOffCategoryId, '2027-01-18');
  await assert.rejects(
    () => axios.post(`${BASE_URL}/api/compliance/items/${itemId}/approve`, {}, adminHeaders),
    (err) => err.response?.status === 400
  );
});

test('self-approval with justification notifies the OTHER two executive roles dynamically', emailTestOpts, async (t) => {
  await t.test('admin as actor -> notifies cfo (not admin itself)', async () => {
    const itemId = await createAndSubmit(adminHeaders, oneOffCategoryId, '2027-01-19');
    const since = new Date();
    const approveRes = await axios.post(
      `${BASE_URL}/api/compliance/items/${itemId}/approve`,
      { justification: 'Test suite: admin self-approval coverage.' },
      adminHeaders
    );
    assert.equal(approveRes.status, 200);
    assert.equal(approveRes.data.item.is_self_approved, true);

    const sent = await waitForResendEmail({ subject: 'Self-Approved — Review Required', sentAfter: since });
    assert.ok(sent, 'expected a "Self-Approved — Review Required" email to have been sent');
    assert.ok(sent.to.includes(cfoUser.email), `expected cfo (${cfoUser.email}) in recipients, got ${JSON.stringify(sent.to)}`);
    assert.ok(!sent.to.includes(adminUser.email), `admin must NOT be in its own self-approval notification, got ${JSON.stringify(sent.to)}`);
  });

  await t.test('cfo as actor (the gap found in the prior verification session) -> notifies admin (not cfo itself)', async () => {
    const itemId = await createAndSubmit(cfoHeaders, oneOffCategoryId, '2027-01-20');
    const since = new Date();
    const approveRes = await axios.post(
      `${BASE_URL}/api/compliance/items/${itemId}/approve`,
      { justification: 'Test suite: cfo self-approval coverage.' },
      cfoHeaders
    );
    assert.equal(approveRes.status, 200);
    assert.equal(approveRes.data.item.is_self_approved, true);

    const sent = await waitForResendEmail({ subject: 'Self-Approved — Review Required', sentAfter: since });
    assert.ok(sent, 'expected a "Self-Approved — Review Required" email to have been sent');
    assert.ok(sent.to.includes(adminUser.email), `expected admin (${adminUser.email}) in recipients, got ${JSON.stringify(sent.to)}`);
    assert.ok(!sent.to.includes(cfoUser.email), `cfo must NOT be in its own self-approval notification, got ${JSON.stringify(sent.to)}`);
  });
});

test('approving a MONTHLY_RECURRING category bootstraps the recurrence rule exactly once', async (t) => {
  let firstRuleId;

  await t.test('first approval under the category creates exactly one rule row, day_of_month_due carried onto it', async () => {
    const itemId = await createAndSubmit(jrHeaders, monthlyCategoryId, '2026-10-15', 15);
    const approveRes = await axios.post(`${BASE_URL}/api/compliance/items/${itemId}/approve`, {}, adminHeaders);
    assert.ok(approveRes.data.recurrence_rule_created, 'expected a recurrence rule to be created on first approval');
    firstRuleId = approveRes.data.recurrence_rule_created.rule_id;
    assert.equal(approveRes.data.recurrence_rule_created.day_of_month_due, 15, 'day_of_month_due should be carried from the item onto the new rule');

    const dueDate = new Date(approveRes.data.recurrence_rule_created.next_reapproval_due);
    const expected = new Date();
    expected.setUTCFullYear(expected.getUTCFullYear() + 1);
    const diffDays = Math.abs((dueDate - expected) / (1000 * 60 * 60 * 24));
    assert.ok(diffDays < 2, `next_reapproval_due should be ~12 months out, got ${dueDate.toISOString()}`);
  });

  await t.test('second approval under the same category does not duplicate the rule', async () => {
    const itemId = await createAndSubmit(jrHeaders, monthlyCategoryId, '2026-11-15', 15);
    const approveRes = await axios.post(`${BASE_URL}/api/compliance/items/${itemId}/approve`, {}, adminHeaders);
    assert.equal(approveRes.data.recurrence_rule_created, null, 'a second approval under the same category must not create another rule row');

    const { pool } = require('./helpers/test-helper');
    const rows = await pool.query(`SELECT rule_id FROM compliance_recurrence_rule WHERE category_id = $1`, [monthlyCategoryId]);
    assert.equal(rows.rows.length, 1);
    assert.equal(rows.rows[0].rule_id, firstRuleId);
  });
});

test('creating a MONTHLY_RECURRING item without day_of_month_due is rejected with 400', async () => {
  await assert.rejects(
    () => axios.post(
      `${BASE_URL}/api/compliance/items`,
      { category_id: monthlyCategoryId, due_date: '2026-12-15', evidence_file_ref: 'test.pdf' },
      jrHeaders
    ),
    (err) => err.response?.status === 400
  );
});

test('reject without a reason is rejected with 400', async () => {
  const itemId = await createAndSubmit(jrHeaders, oneOffCategoryId, '2027-01-21');
  await assert.rejects(
    () => axios.post(`${BASE_URL}/api/compliance/items/${itemId}/reject`, {}, adminHeaders),
    (err) => err.response?.status === 400
  );
});

test('reject with a reason succeeds and notifies the creator', emailTestOpts, async () => {
  const itemId = await createAndSubmit(jrHeaders, oneOffCategoryId, '2027-01-22');
  const since = new Date();
  const rejectRes = await axios.post(
    `${BASE_URL}/api/compliance/items/${itemId}/reject`,
    { reason: 'Test suite: evidence illegible, please resubmit.' },
    adminHeaders
  );
  assert.equal(rejectRes.status, 200);
  assert.equal(rejectRes.data.status, 'REJECTED');

  const sent = await waitForResendEmail({ subject: 'Compliance Item Rejected', sentAfter: since });
  assert.ok(sent, 'expected a "Compliance Item Rejected" email to have been sent');
  assert.ok(sent.to.includes(jrUser.email), `expected the creator's email (${jrUser.email}) in recipients, got ${JSON.stringify(sent.to)}`);
});
