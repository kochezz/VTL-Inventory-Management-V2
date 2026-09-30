'use strict';

// Checked-in port of the ad hoc verification scripts run by hand across the
// Compliance Module Phase 2 session and its follow-up verification session.
// Real HTTP calls against a running dev server, real DB, real Resend sends --
// see backend/tests/README.md for what this assumes before running.
//
// Rewritten for feature/compliance-register-ux, Step 2: items no longer go
// through DRAFT -> submit -> PENDING_APPROVAL -> approve. A freshly-created
// item starts UPCOMING; uploading evidence moves it to EVIDENCE_SUBMITTED;
// verifyComplianceItem (not approveComplianceItem) is the new "complete for
// this period" action, with the same verifier-must-differ-from-uploader
// self-approval-style exception approveComplianceItem always had. The old
// /submit and /approve endpoints now explicitly reject any item on the new
// statuses (assertNotNewVocabularyItem) -- every test below that used to
// exercise them now exercises /evidence + /verify (or /return-evidence, the
// new counterpart to /reject) instead. The MONTHLY_RECURRING bootstrap test
// moved wholesale: the recurrence rule is now created at CATEGORY approval
// (approveComplianceCategory), not first-item approval.

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');

const {
  BASE_URL,
  pool,
  assertServerReachable,
  login,
  authHeaders,
  signTokenForRole,
  Cleanup,
  createComplianceCategory,
  waitForResendEmail,
  uploadTestEvidence,
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
let managerToken, managerHeaders, managerUser;
let oneOffCategoryId;

before(async () => {
  await assertServerReachable();

  adminToken = await login(process.env.TEST_ADMIN_EMAIL, process.env.TEST_ADMIN_PASSWORD);
  adminHeaders = authHeaders(adminToken);
  ({ user: adminUser } = await signTokenForRole('admin')); // reuse for its email lookup only; adminToken above is the real login

  ({ token: jrToken, user: jrUser } = await signTokenForRole('junior_accountant'));
  jrHeaders = authHeaders(jrToken);

  ({ token: cfoToken, user: cfoUser } = await signTokenForRole('cfo'));
  cfoHeaders = authHeaders(cfoToken);

  // manager -- widened to the full initiator tier (same as junior_accountant)
  // in this session: create/submit/evidence/acknowledge, but never
  // approve/reject, same as junior_accountant.
  ({ token: managerToken, user: managerUser } = await signTokenForRole('manager'));
  managerHeaders = authHeaders(managerToken);

  oneOffCategoryId = await createComplianceCategory({
    name: 'TEST SUITE - one-off category',
    recurrence_type: 'ONE_OFF_EXPIRY',
  });
  cleanup.trackCategory(oneOffCategoryId);
  // Manual item registration requires an ACTIVE category (createComplianceItem)
  // -- the raw-insert helper above leaves every test category PENDING_APPROVAL.
  await axios.post(`${BASE_URL}/api/compliance/categories/${oneOffCategoryId}/approve`, {}, adminHeaders);
});

after(async () => {
  await cleanup.run();
});

// Creates an item and uploads evidence, landing it on EVIDENCE_SUBMITTED --
// the new model's equivalent of the old create->submit->PENDING_APPROVAL.
async function createAndSubmitEvidence(headers, categoryId, dueDate) {
  const body = { category_id: categoryId, evidence_file_ref: 'test.pdf' };
  if (dueDate != null) body.due_date = dueDate;
  const createRes = await axios.post(`${BASE_URL}/api/compliance/items`, body, headers);
  cleanup.trackItem(createRes.data.item_id);
  await uploadTestEvidence(createRes.data.item_id, headers);
  return createRes.data.item_id;
}

test('junior_accountant can create an item and upload evidence', async () => {
  const createRes = await axios.post(
    `${BASE_URL}/api/compliance/items`,
    { category_id: oneOffCategoryId, due_date: '2027-01-15', evidence_file_ref: 'test.pdf' },
    jrHeaders
  );
  cleanup.trackItem(createRes.data.item_id);
  assert.equal(createRes.status, 201);
  assert.equal(createRes.data.status, 'UPCOMING');

  await uploadTestEvidence(createRes.data.item_id, jrHeaders);
  const itemRes = await axios.get(`${BASE_URL}/api/compliance/items/${createRes.data.item_id}`, jrHeaders);
  assert.equal(itemRes.data.status, 'EVIDENCE_SUBMITTED');
});

test('junior_accountant is blocked from verifying (403)', async () => {
  const itemId = await createAndSubmitEvidence(jrHeaders, oneOffCategoryId, '2027-01-16');
  await assert.rejects(
    () => axios.post(`${BASE_URL}/api/compliance/items/${itemId}/verify`, {}, jrHeaders),
    (err) => err.response?.status === 403
  );
});

// ── manager: full initiator tier, same as junior_accountant ────────────────

test('manager can create an item and upload evidence', async () => {
  const createRes = await axios.post(
    `${BASE_URL}/api/compliance/items`,
    { category_id: oneOffCategoryId, due_date: '2027-01-17', evidence_file_ref: 'test.pdf' },
    managerHeaders
  );
  cleanup.trackItem(createRes.data.item_id);
  assert.equal(createRes.status, 201);
  assert.equal(createRes.data.status, 'UPCOMING');
  assert.equal(createRes.data.created_by, managerUser.user_id);

  await uploadTestEvidence(createRes.data.item_id, managerHeaders);
  const itemRes = await axios.get(`${BASE_URL}/api/compliance/items/${createRes.data.item_id}`, managerHeaders);
  assert.equal(itemRes.data.status, 'EVIDENCE_SUBMITTED');
});

test('manager is blocked from verifying or returning evidence (403) -- including their own upload', async () => {
  const itemId = await createAndSubmitEvidence(managerHeaders, oneOffCategoryId, '2027-01-18');
  // authorize() rejects manager before the service layer's self-approval
  // check is ever reached -- there is no "manager self-verifies with
  // justification" path, same as junior_accountant.
  await assert.rejects(
    () => axios.post(`${BASE_URL}/api/compliance/items/${itemId}/verify`, { justification: 'trying anyway' }, managerHeaders),
    (err) => err.response?.status === 403
  );
  await assert.rejects(
    () => axios.post(`${BASE_URL}/api/compliance/items/${itemId}/return-evidence`, { reason: 'trying anyway, long enough reason' }, managerHeaders),
    (err) => err.response?.status === 403
  );
});

test('manager can acknowledge a NON_COMPLIANT item (junior_accountant-equivalent acknowledge access)', async () => {
  const itemId = await createAndSubmitEvidence(adminHeaders, oneOffCategoryId, '2027-01-19');
  // cfo verifies admin's upload -- not self-verification, so no
  // justification needed here; using adminHeaders for both would hit the
  // (unrelated) self-verification justification requirement instead.
  await axios.post(`${BASE_URL}/api/compliance/items/${itemId}/verify`, {}, cfoHeaders);
  // Force it NON_COMPLIANT directly -- same shortcut the scheduler tests use
  // elsewhere in this suite; the scheduler itself is not under test here.
  await pool.query(`UPDATE compliance_items SET status = 'NON_COMPLIANT' WHERE item_id = $1`, [itemId]);
  const ackRes = await axios.post(`${BASE_URL}/api/compliance/items/${itemId}/acknowledge`, { note: 'manager ack test' }, managerHeaders);
  assert.equal(ackRes.status, 201);
});

test('admin can verify someone else\'s evidence (not self-verification)', async () => {
  const itemId = await createAndSubmitEvidence(jrHeaders, oneOffCategoryId, '2027-02-17');
  const verifyRes = await axios.post(`${BASE_URL}/api/compliance/items/${itemId}/verify`, {}, adminHeaders);
  assert.equal(verifyRes.status, 200);
  assert.equal(verifyRes.data.item.status, 'VERIFIED');
  assert.equal(verifyRes.data.isSelfVerification, undefined); // not echoed on the item row itself
});

test('self-verification without justification is rejected with 400', async () => {
  const itemId = await createAndSubmitEvidence(adminHeaders, oneOffCategoryId, '2027-02-18');
  await assert.rejects(
    () => axios.post(`${BASE_URL}/api/compliance/items/${itemId}/verify`, {}, adminHeaders),
    (err) => err.response?.status === 400
  );
});

test('self-verification with justification notifies the OTHER two executive roles dynamically', emailTestOpts, async (t) => {
  await t.test('admin as actor -> notifies cfo (not admin itself)', async () => {
    const itemId = await createAndSubmitEvidence(adminHeaders, oneOffCategoryId, '2027-02-19');
    const since = new Date();
    const verifyRes = await axios.post(
      `${BASE_URL}/api/compliance/items/${itemId}/verify`,
      { justification: 'Test suite: admin self-verification coverage.' },
      adminHeaders
    );
    assert.equal(verifyRes.status, 200);

    const sent = await waitForResendEmail({ subject: 'Self-Verified — Review Required', sentAfter: since });
    assert.ok(sent, 'expected a "Self-Verified — Review Required" email to have been sent');
    assert.ok(sent.to.includes(cfoUser.email), `expected cfo (${cfoUser.email}) in recipients, got ${JSON.stringify(sent.to)}`);
    assert.ok(!sent.to.includes(adminUser.email), `admin must NOT be in its own self-verification notification, got ${JSON.stringify(sent.to)}`);
  });

  await t.test('cfo as actor (the gap found in the prior verification session) -> notifies admin (not cfo itself)', async () => {
    const itemId = await createAndSubmitEvidence(cfoHeaders, oneOffCategoryId, '2027-02-20');
    const since = new Date();
    const verifyRes = await axios.post(
      `${BASE_URL}/api/compliance/items/${itemId}/verify`,
      { justification: 'Test suite: cfo self-verification coverage.' },
      cfoHeaders
    );
    assert.equal(verifyRes.status, 200);

    const sent = await waitForResendEmail({ subject: 'Self-Verified — Review Required', sentAfter: since });
    assert.ok(sent, 'expected a "Self-Verified — Review Required" email to have been sent');
    assert.ok(sent.to.includes(adminUser.email), `expected admin (${adminUser.email}) in recipients, got ${JSON.stringify(sent.to)}`);
    assert.ok(!sent.to.includes(cfoUser.email), `cfo must NOT be in its own self-verification notification, got ${JSON.stringify(sent.to)}`);
  });
});

// The rule now bootstraps at CATEGORY approval (approveComplianceCategory),
// not first-item approval -- moved wholesale from the old model, where a
// FILING+RECURRING category's very first item-approval used to create it.
// A fresh category is used here (not the shared oneOffCategoryId/monthly
// fixture) so the bootstrap moment itself is directly observable.
test('approving a FILING RECURRING category bootstraps the recurrence rule and first UPCOMING period exactly once', async () => {
  const categoryId = await createComplianceCategory({
    name: 'TEST SUITE - monthly bootstrap',
    recurrence_type: 'MONTHLY_RECURRING',
    interval_months: 1,
    anchor_date: '2026-09-15',
    due_day_of_month: 15,
  });
  cleanup.trackCategory(categoryId);

  const approveRes = await axios.post(`${BASE_URL}/api/compliance/categories/${categoryId}/approve`, {}, adminHeaders);
  assert.equal(approveRes.status, 200);
  assert.ok(approveRes.data.recurrence_rule_created, 'expected a recurrence rule to be created on category approval');
  assert.equal(approveRes.data.recurrence_rule_created.day_of_month_due, 15);
  assert.equal(approveRes.data.recurrence_rule_created.interval_months, 1);
  assert.ok(approveRes.data.first_item_created, 'expected a first UPCOMING period to be created on category approval');
  assert.equal(approveRes.data.first_item_created.status, 'UPCOMING');
  assert.equal(approveRes.data.first_item_created.due_date, '2026-09-15');
  cleanup.trackItem(approveRes.data.first_item_created.item_id);

  const rows = await pool.query(`SELECT rule_id FROM compliance_recurrence_rule WHERE category_id = $1`, [categoryId]);
  assert.equal(rows.rows.length, 1, 'exactly one recurrence rule row, from this one approval');

  const itemRows = await pool.query(`SELECT item_id FROM compliance_items WHERE category_id = $1`, [categoryId]);
  assert.equal(itemRows.rows.length, 1, 'exactly one item, the bootstrapped first period');
});

// Moved from "creating an item under an unconfigured RECURRING category is
// rejected" -- manual item creation is blocked for EVERY FILING+RECURRING
// category now, configured or not (createComplianceItem), so the
// meaningful check has moved earlier, to approval: a RECURRING category
// with no anchor_date can never be approved in the first place.
test('approving a RECURRING category whose cadence is not yet configured is rejected with 400', async () => {
  const unconfiguredCategoryId = await createComplianceCategory({
    name: 'TEST SUITE - unconfigured recurring category',
    recurrence_type: 'MONTHLY_RECURRING',
    interval_months: 1,
    anchor_date: null,
    due_day_of_month: null,
  });
  cleanup.trackCategory(unconfiguredCategoryId);

  await assert.rejects(
    () => axios.post(`${BASE_URL}/api/compliance/categories/${unconfiguredCategoryId}/approve`, {}, adminHeaders),
    (err) => err.response?.status === 400
  );
});

test('return-evidence without a reason is rejected with 400', async () => {
  const itemId = await createAndSubmitEvidence(jrHeaders, oneOffCategoryId, '2027-02-21');
  await assert.rejects(
    () => axios.post(`${BASE_URL}/api/compliance/items/${itemId}/return-evidence`, {}, adminHeaders),
    (err) => err.response?.status === 400
  );
});

test('return-evidence with a reason succeeds and notifies the uploader', emailTestOpts, async () => {
  const itemId = await createAndSubmitEvidence(jrHeaders, oneOffCategoryId, '2027-02-22');
  const since = new Date();
  const returnRes = await axios.post(
    `${BASE_URL}/api/compliance/items/${itemId}/return-evidence`,
    { reason: 'Test suite: evidence illegible, please resubmit.' },
    adminHeaders
  );
  assert.equal(returnRes.status, 200);
  assert.equal(returnRes.data.status, 'UPCOMING');

  const sent = await waitForResendEmail({ subject: 'Compliance Evidence Returned for Correction', sentAfter: since });
  assert.ok(sent, 'expected a "Compliance Evidence Returned for Correction" email to have been sent');
  assert.ok(sent.to.includes(jrUser.email), `expected the uploader's email (${jrUser.email}) in recipients, got ${JSON.stringify(sent.to)}`);
});
