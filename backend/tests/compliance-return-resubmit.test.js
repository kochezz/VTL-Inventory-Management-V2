'use strict';

// Compliance Module Phase C: RETURNED status for categories and items,
// the return -> edit -> resubmit loop, and the scheduler's 7-day stale-
// RETURNED-item nudge to Admin. Real HTTP calls against a running dev
// server, real DB (production, per this session's explicit one-time
// exception -- no Neon branch available) -- see tests/README.md.

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
  uploadTestEvidence,
  waitForMockEmail,
  callScheduler,
} = require('./helpers/test-helper');

const cleanup = new Cleanup();
let adminToken, adminHeaders, adminUser;
let jrToken, jrHeaders, jrUser;
let cfoToken, cfoHeaders, cfoUser;
let managerToken, managerHeaders;

before(async () => {
  await assertServerReachable();

  adminToken = await login(process.env.TEST_ADMIN_EMAIL, process.env.TEST_ADMIN_PASSWORD);
  adminHeaders = authHeaders(adminToken);
  ({ user: adminUser } = await signTokenForRole('admin'));

  ({ token: jrToken, user: jrUser } = await signTokenForRole('junior_accountant'));
  jrHeaders = authHeaders(jrToken);

  ({ token: cfoToken, user: cfoUser } = await signTokenForRole('cfo'));
  cfoHeaders = authHeaders(cfoToken);

  ({ token: managerToken } = await signTokenForRole('manager'));
  managerHeaders = authHeaders(managerToken);
});

after(async () => {
  await cleanup.run();
});

// A fresh, uniquely-named ONE_OFF category per test -- avoids any cross-
// test interference from the return/resubmit status churn this whole file
// exercises. Created by whichever headers are passed (usually jrHeaders,
// matching "junior_accountant proposes, executive decides").
async function createCategory(headers, overrides = {}) {
  const res = await axios.post(`${BASE_URL}/api/compliance/categories`, {
    name: `TEST SUITE - return/resubmit ${Date.now()}-${Math.random().toString(36).slice(2)}`,
    cadence_type: 'ONE_OFF',
    ...overrides,
  }, headers);
  cleanup.trackCategory(res.data.category_id);
  return res.data;
}

async function createAndSubmitItem(headers, categoryId) {
  const createRes = await axios.post(`${BASE_URL}/api/compliance/items`, {
    category_id: categoryId, due_date: '2027-05-01', evidence_file_ref: 'x.pdf',
  }, headers);
  cleanup.trackItem(createRes.data.item_id);
  await uploadTestEvidence(createRes.data.item_id, headers);
  await axios.post(`${BASE_URL}/api/compliance/items/${createRes.data.item_id}/submit`, {}, headers);
  return createRes.data.item_id;
}

// ── Categories: return ──────────────────────────────────────────────────────

test('returning a category with a reason under 10 chars is rejected with 400', async () => {
  const cat = await createCategory(jrHeaders);
  await assert.rejects(
    () => axios.post(`${BASE_URL}/api/compliance/categories/${cat.category_id}/return`, { reason: 'too short' }, adminHeaders),
    (err) => err.response?.status === 400
  );
});

test('admin returns a PENDING_APPROVAL category for revision -> RETURNED, creator notified', async () => {
  const cat = await createCategory(jrHeaders);
  const since = new Date();
  const res = await axios.post(
    `${BASE_URL}/api/compliance/categories/${cat.category_id}/return`,
    { reason: 'Please add a regulator name before resubmitting.' },
    adminHeaders
  );
  assert.equal(res.status, 200);
  assert.equal(res.data.status, 'RETURNED');
  assert.equal(res.data.rejection_reason, 'Please add a regulator name before resubmitting.');

  const mail = await waitForMockEmail({ subject: 'Compliance Category Returned for Revision', sentAfter: since });
  assert.ok(mail, 'expected a return-notification email to the creator');
  assert.ok(mail.to.includes(jrUser.email));
});

test('returning an already-ACTIVE category is rejected with 400', async () => {
  const cat = await createCategory(jrHeaders);
  await axios.post(`${BASE_URL}/api/compliance/categories/${cat.category_id}/approve`, {}, adminHeaders);
  await assert.rejects(
    () => axios.post(`${BASE_URL}/api/compliance/categories/${cat.category_id}/return`, { reason: 'Valid length reason but wrong status.' }, adminHeaders),
    (err) => err.response?.status === 400
  );
});

test('concurrent return attempts on the same PENDING_APPROVAL category: exactly one succeeds', async () => {
  const cat = await createCategory(jrHeaders);
  const results = await Promise.allSettled([
    axios.post(`${BASE_URL}/api/compliance/categories/${cat.category_id}/return`, { reason: 'First concurrent return attempt.' }, adminHeaders),
    axios.post(`${BASE_URL}/api/compliance/categories/${cat.category_id}/return`, { reason: 'Second concurrent return attempt.' }, cfoHeaders),
  ]);
  const succeeded = results.filter((r) => r.status === 'fulfilled' && r.value.status === 200).length;
  const failed = results.filter((r) => r.status === 'rejected').length;
  assert.equal(succeeded, 1, 'exactly one of the two concurrent returns should succeed');
  assert.equal(failed, 1, 'the other must fail (400 or 409), not silently no-op or crash');
});

// ── Categories: resubmit ────────────────────────────────────────────────────

test('creator resubmits a RETURNED category -> PENDING_APPROVAL, decision fields cleared, approvers notified', async () => {
  const cat = await createCategory(jrHeaders);
  await axios.post(`${BASE_URL}/api/compliance/categories/${cat.category_id}/return`, { reason: 'Needs a regulator name attached please.' }, adminHeaders);

  const since = new Date();
  const res = await axios.post(`${BASE_URL}/api/compliance/categories/${cat.category_id}/resubmit`, {}, jrHeaders);
  assert.equal(res.status, 200);
  assert.equal(res.data.status, 'PENDING_APPROVAL');
  assert.equal(res.data.rejection_reason, null);
  assert.equal(res.data.approved_by, null);

  const mail = await waitForMockEmail({ subject: 'Action Required: Compliance Category Resubmitted for Approval', sentAfter: since });
  assert.ok(mail, 'expected approvers to be re-notified on resubmit');
});

test('a non-creator, non-admin resubmitting a RETURNED category gets 403', async () => {
  const cat = await createCategory(jrHeaders);
  await axios.post(`${BASE_URL}/api/compliance/categories/${cat.category_id}/return`, { reason: 'Needs more detail added please.' }, adminHeaders);
  // cfo is an executive but not literally "admin" -- resubmit is creator-
  // or-Admin specifically, same scoping submitComplianceItem already used.
  await assert.rejects(
    () => axios.post(`${BASE_URL}/api/compliance/categories/${cat.category_id}/resubmit`, {}, cfoHeaders),
    (err) => err.response?.status === 403
  );
});

test('resubmitting a category that is not RETURNED is rejected', async () => {
  const cat = await createCategory(jrHeaders); // still PENDING_APPROVAL
  await assert.rejects(
    () => axios.post(`${BASE_URL}/api/compliance/categories/${cat.category_id}/resubmit`, {}, jrHeaders),
    (err) => err.response?.status === 409
  );
});

// ── Categories: edit while RETURNED ─────────────────────────────────────────

test('creator can edit a RETURNED category, then resubmit', async () => {
  const cat = await createCategory(jrHeaders);
  await axios.post(`${BASE_URL}/api/compliance/categories/${cat.category_id}/return`, { reason: 'Please set a proper regulator name.' }, adminHeaders);

  const patchRes = await axios.patch(`${BASE_URL}/api/compliance/categories/${cat.category_id}`, { regulator: 'ZRA' }, jrHeaders);
  assert.equal(patchRes.status, 200);
  assert.equal(patchRes.data.regulator, 'ZRA');

  const resubmitRes = await axios.post(`${BASE_URL}/api/compliance/categories/${cat.category_id}/resubmit`, {}, jrHeaders);
  assert.equal(resubmitRes.data.status, 'PENDING_APPROVAL');
});

test('creator cannot edit their own category before it has been RETURNED', async () => {
  const cat = await createCategory(jrHeaders); // still PENDING_APPROVAL
  await assert.rejects(
    () => axios.patch(`${BASE_URL}/api/compliance/categories/${cat.category_id}`, { regulator: 'ZRA' }, jrHeaders),
    (err) => err.response?.status === 400
  );
});

test('a non-creator, non-executive cannot edit a RETURNED category', async () => {
  const cat = await createCategory(jrHeaders);
  await axios.post(`${BASE_URL}/api/compliance/categories/${cat.category_id}/return`, { reason: 'Please fix the category name field.' }, adminHeaders);
  await assert.rejects(
    () => axios.patch(`${BASE_URL}/api/compliance/categories/${cat.category_id}`, { regulator: 'ZRA' }, managerHeaders),
    (err) => err.response?.status === 403
  );
});

test('an executive can still edit anchor_date on an ACTIVE RECURRING category regardless of RETURNED-only rule', async () => {
  // Regression check: Phase C's "editable ONLY when RETURNED" rule is an
  // ADDITIONAL allowance for the creator, not a narrowing of the
  // executive's pre-existing, any-status edit access (the "Set First Due
  // Date" feature built in Phase B for backfilling the 7 categories the
  // flexible-cadence migration left unconfigured).
  const createRes = await axios.post(`${BASE_URL}/api/compliance/categories`, {
    name: `TEST SUITE - exec anchor edit regression ${Math.random().toString(36).slice(2)}`,
    cadence_type: 'RECURRING', interval_months: 1, anchor_date: '2027-01-01',
  }, adminHeaders);
  cleanup.trackCategory(createRes.data.category_id);
  await axios.post(`${BASE_URL}/api/compliance/categories/${createRes.data.category_id}/approve`, {}, cfoHeaders);

  const patchRes = await axios.patch(
    `${BASE_URL}/api/compliance/categories/${createRes.data.category_id}`,
    { anchor_date: '2027-02-01' },
    adminHeaders
  );
  assert.equal(patchRes.status, 200);
  assert.equal(patchRes.data.anchor_date.slice(0, 10), '2027-02-01');
});

// ── Categories: audit_log ────────────────────────────────────────────────────

test('every category decision (return/edit/resubmit/approve) writes an audit_log row with old/new values', async () => {
  const cat = await createCategory(jrHeaders);

  await axios.post(`${BASE_URL}/api/compliance/categories/${cat.category_id}/return`, { reason: 'Please double check the name field.' }, adminHeaders);
  const returnLog = await pool.query(
    `SELECT * FROM audit_log WHERE table_name = 'compliance_categories' AND record_id = $1 AND action = 'RETURNED'`,
    [cat.category_id]
  );
  assert.equal(returnLog.rows.length, 1);
  assert.ok(returnLog.rows[0].old_values);
  assert.ok(returnLog.rows[0].new_values);

  await axios.patch(`${BASE_URL}/api/compliance/categories/${cat.category_id}`, { regulator: 'ZRA' }, jrHeaders);
  const editLog = await pool.query(
    `SELECT * FROM audit_log WHERE table_name = 'compliance_categories' AND record_id = $1 AND action = 'EDITED'`,
    [cat.category_id]
  );
  assert.equal(editLog.rows.length, 1);

  await axios.post(`${BASE_URL}/api/compliance/categories/${cat.category_id}/resubmit`, {}, jrHeaders);
  const resubmitLog = await pool.query(
    `SELECT * FROM audit_log WHERE table_name = 'compliance_categories' AND record_id = $1 AND action = 'RESUBMITTED'`,
    [cat.category_id]
  );
  assert.equal(resubmitLog.rows.length, 1);

  await axios.post(`${BASE_URL}/api/compliance/categories/${cat.category_id}/approve`, {}, adminHeaders);
  const approveLog = await pool.query(
    `SELECT * FROM audit_log WHERE table_name = 'compliance_categories' AND record_id = $1 AND action = 'APPROVED'`,
    [cat.category_id]
  );
  assert.equal(approveLog.rows.length, 1);
});

// ── Items: return ────────────────────────────────────────────────────────────

test('returning an item with a reason under 10 chars is rejected with 400', async () => {
  const cat = await createCategory(jrHeaders);
  await axios.post(`${BASE_URL}/api/compliance/categories/${cat.category_id}/approve`, {}, adminHeaders);
  const itemId = await createAndSubmitItem(jrHeaders, cat.category_id);
  await assert.rejects(
    () => axios.post(`${BASE_URL}/api/compliance/items/${itemId}/return`, { reason: 'nope' }, adminHeaders),
    (err) => err.response?.status === 400
  );
});

test('admin returns a PENDING_APPROVAL item for revision -> RETURNED, creator notified', async () => {
  const cat = await createCategory(jrHeaders);
  await axios.post(`${BASE_URL}/api/compliance/categories/${cat.category_id}/approve`, {}, adminHeaders);
  const itemId = await createAndSubmitItem(jrHeaders, cat.category_id);

  const since = new Date();
  const res = await axios.post(
    `${BASE_URL}/api/compliance/items/${itemId}/return`,
    { reason: 'The evidence scan is illegible, please redo it.' },
    adminHeaders
  );
  assert.equal(res.status, 200);
  assert.equal(res.data.status, 'RETURNED');

  const mail = await waitForMockEmail({ subject: 'Compliance Item Returned for Revision', sentAfter: since });
  assert.ok(mail, 'expected a return-notification email to the creator');
  assert.ok(mail.to.includes(jrUser.email));
});

test('resubmitting a RETURNED item with no evidence attached is rejected with 400', async () => {
  const cat = await createCategory(jrHeaders);
  await axios.post(`${BASE_URL}/api/compliance/categories/${cat.category_id}/approve`, {}, adminHeaders);
  const itemId = await createAndSubmitItem(jrHeaders, cat.category_id);
  await axios.post(`${BASE_URL}/api/compliance/items/${itemId}/return`, { reason: 'Evidence file is illegible, please redo.' }, adminHeaders);

  // No delete-evidence endpoint exists (by design -- evidence upload is an
  // upsert, never a delete), so this simulates "somehow missing" directly,
  // to exercise resubmitComplianceItem's own defensive re-check rather than
  // leaving it permanently unreachable through the real API surface.
  await pool.query(`DELETE FROM compliance_item_evidence WHERE item_id = $1`, [itemId]);

  await assert.rejects(
    () => axios.post(`${BASE_URL}/api/compliance/items/${itemId}/resubmit`, {}, jrHeaders),
    (err) => err.response?.status === 400
  );
});

test('concurrent approve attempts on the same PENDING_APPROVAL item: exactly one succeeds', async () => {
  const cat = await createCategory(jrHeaders);
  await axios.post(`${BASE_URL}/api/compliance/categories/${cat.category_id}/approve`, {}, adminHeaders);
  const itemId = await createAndSubmitItem(jrHeaders, cat.category_id);

  const results = await Promise.allSettled([
    axios.post(`${BASE_URL}/api/compliance/items/${itemId}/approve`, {}, adminHeaders),
    axios.post(`${BASE_URL}/api/compliance/items/${itemId}/approve`, {}, cfoHeaders),
  ]);
  const succeeded = results.filter((r) => r.status === 'fulfilled' && r.value.status === 200).length;
  const failed = results.filter((r) => r.status === 'rejected').length;
  assert.equal(succeeded, 1, 'exactly one of the two concurrent approvals should succeed');
  assert.equal(failed, 1, 'the other must fail, not silently double-approve or crash');
});

// ── Items: PATCH (new route) ─────────────────────────────────────────────────

test('creator can edit due_date on a RETURNED ONE_OFF item', async () => {
  const cat = await createCategory(jrHeaders);
  await axios.post(`${BASE_URL}/api/compliance/categories/${cat.category_id}/approve`, {}, adminHeaders);
  const itemId = await createAndSubmitItem(jrHeaders, cat.category_id);
  await axios.post(`${BASE_URL}/api/compliance/items/${itemId}/return`, { reason: 'Due date entered incorrectly, please fix.' }, adminHeaders);

  const patchRes = await axios.patch(`${BASE_URL}/api/compliance/items/${itemId}`, { due_date: '2027-06-01' }, jrHeaders);
  assert.equal(patchRes.status, 200);
  assert.equal(patchRes.data.due_date.slice(0, 10), '2027-06-01');
});

test('due_date cannot be edited on a RETURNED item under a RECURRING category', async () => {
  const catRes = await axios.post(`${BASE_URL}/api/compliance/categories`, {
    name: `TEST SUITE - recurring due_date edit block ${Math.random().toString(36).slice(2)}`,
    cadence_type: 'RECURRING', interval_months: 1, anchor_date: '2027-01-15',
  }, adminHeaders);
  cleanup.trackCategory(catRes.data.category_id);
  await axios.post(`${BASE_URL}/api/compliance/categories/${catRes.data.category_id}/approve`, {}, cfoHeaders);

  const itemId = await createAndSubmitItem(jrHeaders, catRes.data.category_id);
  await axios.post(`${BASE_URL}/api/compliance/items/${itemId}/return`, { reason: 'Please review this recurring item please.' }, adminHeaders);

  await assert.rejects(
    () => axios.patch(`${BASE_URL}/api/compliance/items/${itemId}`, { due_date: '2027-08-01' }, jrHeaders),
    (err) => err.response?.status === 400
  );
});

test('editing a REJECTED item is forbidden -- can only edit while RETURNED', async () => {
  const cat = await createCategory(jrHeaders);
  await axios.post(`${BASE_URL}/api/compliance/categories/${cat.category_id}/approve`, {}, adminHeaders);
  const itemId = await createAndSubmitItem(jrHeaders, cat.category_id);
  await axios.post(`${BASE_URL}/api/compliance/items/${itemId}/reject`, { reason: 'This item has incorrect information.' }, adminHeaders);

  await assert.rejects(
    () => axios.patch(`${BASE_URL}/api/compliance/items/${itemId}`, { issued_date: '2027-01-01' }, jrHeaders),
    (err) => err.response?.status === 400
  );
});

test('a non-author, non-admin cannot edit a RETURNED item', async () => {
  const cat = await createCategory(jrHeaders);
  await axios.post(`${BASE_URL}/api/compliance/categories/${cat.category_id}/approve`, {}, adminHeaders);
  const itemId = await createAndSubmitItem(jrHeaders, cat.category_id);
  await axios.post(`${BASE_URL}/api/compliance/items/${itemId}/return`, { reason: 'Please attach a clearer scan please.' }, adminHeaders);

  // cfo is an executive but not literally "admin" -- edit access is
  // creator-or-Admin specifically, same scoping as resubmit.
  await assert.rejects(
    () => axios.patch(`${BASE_URL}/api/compliance/items/${itemId}`, { issued_date: '2027-01-01' }, cfoHeaders),
    (err) => err.response?.status === 403
  );
});

// ── Items: self-approval still applies after resubmit ───────────────────────

test('self-approval rules still apply after a returned item is resubmitted and self-approved', async () => {
  const cat = await createCategory(adminHeaders);
  await axios.post(`${BASE_URL}/api/compliance/categories/${cat.category_id}/approve`, {}, cfoHeaders);
  const itemId = await createAndSubmitItem(adminHeaders, cat.category_id); // admin creates + submits own item
  await axios.post(`${BASE_URL}/api/compliance/items/${itemId}/return`, { reason: 'Please double check the due date.' }, cfoHeaders);
  await axios.post(`${BASE_URL}/api/compliance/items/${itemId}/resubmit`, {}, adminHeaders);

  await assert.rejects(
    () => axios.post(`${BASE_URL}/api/compliance/items/${itemId}/approve`, {}, adminHeaders),
    (err) => err.response?.status === 400
  );

  const approveRes = await axios.post(
    `${BASE_URL}/api/compliance/items/${itemId}/approve`,
    { justification: 'Time-sensitive, approving my own resubmission.' },
    adminHeaders
  );
  assert.equal(approveRes.data.item.is_self_approved, true);
});

// ── Scheduler: RETURNED items are exempt from reminders/escalation, but ────
// ── notify Admin once stale for 7+ days ─────────────────────────────────────

test('a RETURNED item gets no reminder-ladder or escalation activity while RETURNED', async () => {
  const cat = await createCategory(jrHeaders);
  await axios.post(`${BASE_URL}/api/compliance/categories/${cat.category_id}/approve`, {}, adminHeaders);
  const itemId = await createAndSubmitItem(jrHeaders, cat.category_id);
  await axios.post(`${BASE_URL}/api/compliance/items/${itemId}/return`, { reason: 'Please redo this item entirely please.' }, adminHeaders);

  const run = await callScheduler({ dryRun: false });
  assert.ok(!run.data.reminders_sent.some((r) => r.item_id === itemId));
  assert.ok(!run.data.escalations_sent.some((r) => r.item_id === itemId));
  assert.ok(!run.data.items_flipped_non_compliant.some((r) => r.item_id === itemId));
});

test('a RETURNED item stale for 7+ days notifies Admin once per day, not on every run', async () => {
  const cat = await createCategory(jrHeaders);
  await axios.post(`${BASE_URL}/api/compliance/categories/${cat.category_id}/approve`, {}, adminHeaders);
  const itemId = await createAndSubmitItem(jrHeaders, cat.category_id);
  await axios.post(`${BASE_URL}/api/compliance/items/${itemId}/return`, { reason: 'This item needs a full rework please.' }, adminHeaders);
  await pool.query(`UPDATE compliance_items SET updated_at = CURRENT_TIMESTAMP - INTERVAL '8 days' WHERE item_id = $1`, [itemId]);

  const since = new Date();
  const run1 = await callScheduler({ dryRun: false });
  assert.ok(run1.data.returned_stale_notified.some((r) => r.item_id === itemId), 'expected the stale RETURNED item to be reported on the first run');

  const mail = await waitForMockEmail({ subject: 'Compliance Item Returned 7+ Days Ago — Needs Follow-up', sentAfter: since });
  assert.ok(mail, 'expected the mocked Admin follow-up email to have been recorded');
  assert.ok(mail.to.includes(adminUser.email));

  const run2 = await callScheduler({ dryRun: false });
  assert.ok(!run2.data.returned_stale_notified.some((r) => r.item_id === itemId), 'must not notify a second time the same day');
});
