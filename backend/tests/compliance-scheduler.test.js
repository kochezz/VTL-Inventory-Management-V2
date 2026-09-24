'use strict';

// Compliance Module Phase 3+4: scheduler webhook, reminder ladder,
// NON_COMPLIANT transition/escalation, monthly recurrence, 12-month
// re-approval reminder, and the acknowledgement endpoint.
//
// This scheduler is a global batch job by design -- it processes every
// APPROVED item in the DB, not just ones this file creates. Assertions
// below filter the webhook's summary by this file's own item_ids rather
// than asserting exact array lengths, so this file stays correct even if
// another test file's compliance items exist at the same moment (node:test
// runs separate test files concurrently by default). At the time this was
// written there was zero real (non-test) compliance data in the DB, but
// that will stop being true once the module is in real use -- worth
// remembering that non-dry-run scheduler calls in tests will then be
// touching real data too, since there's no way to scope a real run to
// "just this test" without adding scoping the spec never asked for.

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const axios = require('axios');

const {
  BASE_URL,
  assertServerReachable,
  login,
  authHeaders,
  signTokenForRole,
  Cleanup,
  createComplianceCategory,
  pool,
  callScheduler,
  backdateReminderLog,
  waitForMockEmail,
  uploadTestEvidence,
} = require('./helpers/test-helper');

const cleanup = new Cleanup();
let adminToken, adminHeaders, adminUser;
let jrToken, jrHeaders;
let viewerToken, viewerHeaders;

function isoDate(offsetDays) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().split('T')[0];
}

before(async () => {
  await assertServerReachable();
  adminToken = await login(process.env.TEST_ADMIN_EMAIL, process.env.TEST_ADMIN_PASSWORD);
  adminHeaders = authHeaders(adminToken);
  ({ user: adminUser } = await signTokenForRole('admin'));

  ({ token: jrToken } = await signTokenForRole('junior_accountant'));
  jrHeaders = authHeaders(jrToken);

  ({ token: viewerToken } = await signTokenForRole('viewer'));
  viewerHeaders = authHeaders(viewerToken);
});

after(async () => {
  await cleanup.run();
});

// Creates a real item through the real create->submit->approve flow
// (junior_accountant creates, admin approves -- not a self-approval, so no
// justification needed) and returns its final row. due_date only matters
// for a ONE_OFF category -- a RECURRING category computes it server-side
// from the category's own anchor_date/due_day_of_month and ignores this.
async function createApprovedItem(categoryId, dueDateOffsetDays) {
  const body = { category_id: categoryId, evidence_file_ref: 'scheduler-test.pdf' };
  if (dueDateOffsetDays !== undefined) body.due_date = isoDate(dueDateOffsetDays);
  const createRes = await axios.post(`${BASE_URL}/api/compliance/items`, body, jrHeaders);
  cleanup.trackItem(createRes.data.item_id);
  await uploadTestEvidence(createRes.data.item_id, jrHeaders);
  await axios.post(`${BASE_URL}/api/compliance/items/${createRes.data.item_id}/submit`, {}, jrHeaders);
  const approveRes = await axios.post(`${BASE_URL}/api/compliance/items/${createRes.data.item_id}/approve`, {}, adminHeaders);
  return approveRes.data.item;
}

async function getItemRow(itemId) {
  const r = await pool.query(`SELECT * FROM compliance_items WHERE item_id = $1`, [itemId]);
  return r.rows[0];
}

async function reminderLogRows(itemId, tierType) {
  const r = await pool.query(
    `SELECT tier_type, days_before, sent_date FROM compliance_reminder_log WHERE item_id = $1 AND tier_type = $2 ORDER BY sent_date`,
    [itemId, tierType]
  );
  return r.rows;
}

// ── 7a: webhook auth ─────────────────────────────────────────────────────────

test('scheduler webhook rejects missing/wrong secret (401), runs no logic', async (t) => {
  const categoryId = await createComplianceCategory({ name: 'TEST SUITE - webhook auth', recurrence_type: 'ONE_OFF_EXPIRY' });
  cleanup.trackCategory(categoryId);
  const item = await createApprovedItem(categoryId, -1); // overdue, would flip if the scheduler actually ran

  await t.test('missing secret -> 401', async () => {
    await assert.rejects(
      () => callScheduler({ omitSecret: true }),
      (err) => err.response?.status === 401
    );
  });

  await t.test('wrong secret -> 401', async () => {
    await assert.rejects(
      () => callScheduler({ secret: 'definitely-wrong' }),
      (err) => err.response?.status === 401
    );
  });

  await t.test('item status untouched by either rejected call', async () => {
    const row = await getItemRow(item.item_id);
    assert.equal(row.status, 'APPROVED');
  });
});

// ── 7b: reminder ladder ──────────────────────────────────────────────────────

test('item at all four ladder thresholds gets exactly one reminder per tier; a second same-day run does not duplicate', async () => {
  const categoryId = await createComplianceCategory({ name: 'TEST SUITE - reminder ladder', recurrence_type: 'ONE_OFF_EXPIRY' });
  cleanup.trackCategory(categoryId);
  // due in 5 days -- days_until_due (5) <= every one of the default ladder's
  // [30,15,10,5], so all four tiers are "reached" simultaneously on a fresh item.
  const item = await createApprovedItem(categoryId, 5);

  const since = new Date();
  const run1 = await callScheduler({ dryRun: false });
  const mine1 = run1.data.reminders_sent.filter((r) => r.item_id === item.item_id);
  const daysBefore1 = mine1.map((r) => r.days_before).sort((a, b) => a - b);
  assert.deepEqual(daysBefore1, [5, 10, 15, 30]);

  const dbRows = await pool.query(
    `SELECT days_before FROM compliance_reminder_log WHERE item_id = $1 AND tier_type = 'DAYS_BEFORE' ORDER BY days_before`,
    [item.item_id]
  );
  assert.equal(dbRows.rows.length, 4, 'expected exactly 4 reminder_log rows after the first run');

  // Precise check against what notification-service actually recorded, not
  // just the API summary/DB rows -- confirms a real sendEmail() call
  // happened with the exact subject the reminder ladder is supposed to use.
  const mockedEmail = await waitForMockEmail({ subject: 'Compliance Reminder: 30 days before due', sentAfter: since });
  assert.ok(mockedEmail, 'expected a mocked "Compliance Reminder: 30 days before due" email to have been recorded');

  const run2 = await callScheduler({ dryRun: false });
  const mine2 = run2.data.reminders_sent.filter((r) => r.item_id === item.item_id);
  assert.equal(mine2.length, 0, 'a second same-day run must not re-send any already-sent tier');

  const dbRowsAfter = await pool.query(
    `SELECT days_before FROM compliance_reminder_log WHERE item_id = $1 AND tier_type = 'DAYS_BEFORE'`,
    [item.item_id]
  );
  assert.equal(dbRowsAfter.rows.length, 4, 'row count must be unchanged after the second run');
});

// ── 7c: NON_COMPLIANT transition + daily escalation ─────────────────────────

test('overdue item with no ack flips to NON_COMPLIANT once, escalates once per day (proven across a simulated day boundary)', async () => {
  const categoryId = await createComplianceCategory({ name: 'TEST SUITE - non-compliant', recurrence_type: 'ONE_OFF_EXPIRY' });
  cleanup.trackCategory(categoryId);
  const item = await createApprovedItem(categoryId, -1); // overdue

  const since = new Date();
  const run1 = await callScheduler({ dryRun: false });
  assert.ok(run1.data.items_flipped_non_compliant.some((r) => r.item_id === item.item_id));
  assert.ok(run1.data.escalations_sent.some((r) => r.item_id === item.item_id));

  const mockedEmail = await waitForMockEmail({ subject: 'OVERDUE: Compliance Item Requires Immediate Action', sentAfter: since });
  assert.ok(mockedEmail, 'expected the escalation email to have actually been recorded, not just reported in the summary');

  const row1 = await getItemRow(item.item_id);
  assert.equal(row1.status, 'NON_COMPLIANT');

  let escalationRows = await reminderLogRows(item.item_id, 'OVERDUE_ESCALATION');
  assert.equal(escalationRows.length, 1, 'expected exactly one escalation row after the first run');

  const run2 = await callScheduler({ dryRun: false });
  assert.ok(!run2.data.items_flipped_non_compliant.some((r) => r.item_id === item.item_id), 'must not re-flip an already-NON_COMPLIANT item');
  assert.ok(!run2.data.escalations_sent.some((r) => r.item_id === item.item_id), 'must not double-escalate the same day');

  escalationRows = await reminderLogRows(item.item_id, 'OVERDUE_ESCALATION');
  assert.equal(escalationRows.length, 1, 'row count must be unchanged after the second same-day run');

  // Simulate a day passing: backdate today's escalation row to yesterday,
  // then run "today" again and confirm a genuinely new escalation fires --
  // proving daily-until-acknowledged, not just once-ever.
  await backdateReminderLog(item.item_id, 'OVERDUE_ESCALATION', isoDate(-1));

  const run3 = await callScheduler({ dryRun: false });
  assert.ok(run3.data.escalations_sent.some((r) => r.item_id === item.item_id), 'expected a fresh escalation once the prior one is a day old');

  escalationRows = await reminderLogRows(item.item_id, 'OVERDUE_ESCALATION');
  assert.equal(escalationRows.length, 2, 'expected a second escalation row (yesterday + today)');
});

// ── 7d: monthly recurrence ────────────────────────────────────────────────────

test('monthly recurrence: first run generates the next item, a same-day second run does not duplicate it', async () => {
  // Target the occurrence the scheduler should generate: 5 days from today,
  // inside the 10-day generation window. anchor_date is set to exactly ONE
  // interval (1 month) before that target, same day-of-month (clamped to
  // that month's end, mirroring nextDueDateClamped's own clamping) -- this
  // guarantees the scheduler's "anchor + 1 month" computation lands back on
  // `target` regardless of what day of the month "today" happens to be,
  // instead of a fixed "-20 days" offset that only lines up near month-end.
  // anchor_date being a month in the past also means it does NOT satisfy the
  // "already exists for the upcoming occurrence" check (due_date >= today),
  // so generation isn't skipped for that reason -- that check doesn't
  // distinguish the anchor from a genuinely-generated next occurrence, which
  // is correct: in real usage an anchor's due_date should already align
  // with the rule's cadence. Using a month-old anchor here simulates "the
  // current instance has already passed, time to generate the next one."
  const target = new Date();
  target.setUTCDate(target.getUTCDate() + 5);
  const dayOfMonthDue = target.getUTCDate();

  const anchorYear = target.getUTCFullYear();
  const anchorMonth = target.getUTCMonth() - 1;
  const lastDayOfAnchorMonth = new Date(Date.UTC(anchorYear, anchorMonth + 1, 0)).getUTCDate();
  const anchorDate = new Date(Date.UTC(anchorYear, anchorMonth, Math.min(dayOfMonthDue, lastDayOfAnchorMonth)));

  const categoryId = await createComplianceCategory({
    name: 'TEST SUITE - monthly recurrence',
    recurrence_type: 'MONTHLY_RECURRING',
    anchor_date: anchorDate.toISOString().split('T')[0],
    due_day_of_month: dayOfMonthDue,
  });
  cleanup.trackCategory(categoryId);

  // The approve-time rule bootstrap (Phase 2 logic) carries the category's
  // due_day_of_month straight onto compliance_recurrence_rule.day_of_month_due,
  // so this is a fresh, non-test-patched row exercising Phase 3's real
  // generation logic end to end, not a row hand-fixed after the fact.
  const anchor = await createApprovedItem(categoryId);

  const ruleRes = await pool.query(`SELECT rule_id, day_of_month_due FROM compliance_recurrence_rule WHERE category_id = $1`, [categoryId]);
  assert.equal(ruleRes.rows.length, 1, 'expected the first approval to bootstrap exactly one recurrence rule');
  assert.equal(ruleRes.rows[0].day_of_month_due, dayOfMonthDue, 'day_of_month_due should already be set on the rule from creation, with no manual patch');
  const ruleId = ruleRes.rows[0].rule_id;

  const run1 = await callScheduler({ dryRun: false });
  const generated1 = run1.data.recurring_items_generated.filter((g) => g.rule_id === ruleId);
  assert.equal(generated1.length, 1, 'expected exactly one generated item for this rule');

  // The anchor item ALSO has recurrence_rule_id set (Phase 2's bootstrap
  // links the item that created the rule back to it), so the expected total
  // here is 2 -- anchor + newly generated -- not 1.
  const itemsAfterRun1 = await pool.query(`SELECT item_id, due_date FROM compliance_items WHERE recurrence_rule_id = $1`, [ruleId]);
  assert.equal(itemsAfterRun1.rows.length, 2, 'expected the anchor plus exactly one newly generated item');
  const generatedItem = itemsAfterRun1.rows.find((r) => r.item_id !== anchor.item_id);
  assert.ok(generatedItem, 'the newly generated item must be distinct from the anchor');
  cleanup.trackItem(generatedItem.item_id);

  const run2 = await callScheduler({ dryRun: false });
  const generated2 = run2.data.recurring_items_generated.filter((g) => g.rule_id === ruleId);
  assert.equal(generated2.length, 0, 'a same-day second run must not generate a duplicate');

  const itemsAfterRun2 = await pool.query(`SELECT item_id FROM compliance_items WHERE recurrence_rule_id = $1`, [ruleId]);
  assert.equal(itemsAfterRun2.rows.length, 2, 'still anchor + one generated item after the second run -- no duplicate');
});

// ── 7d-2: 12-month re-approval reminder dedup ────────────────────────────────

test('12-month re-approval reminder: two scheduler runs same day send exactly one reminder, not two', async () => {
  const categoryId = await createComplianceCategory({ name: 'TEST SUITE - reapproval reminder dedup', recurrence_type: 'ANNUAL_RECURRING' });
  cleanup.trackCategory(categoryId);
  const anchor = await createApprovedItem(categoryId, -5);

  const ruleRes = await pool.query(`SELECT rule_id FROM compliance_recurrence_rule WHERE category_id = $1`, [categoryId]);
  assert.equal(ruleRes.rows.length, 1, 'expected the first approval to bootstrap exactly one recurrence rule');
  const ruleId = ruleRes.rows[0].rule_id;

  // Pull next_reapproval_due inside the 30-day window (bootstrap sets it
  // ~12 months out by default) -- direct UPDATE here is the same pattern
  // already used elsewhere in this file to simulate time passing without
  // literally waiting.
  await pool.query(`UPDATE compliance_recurrence_rule SET next_reapproval_due = CURRENT_DATE + INTERVAL '10 days' WHERE rule_id = $1`, [ruleId]);

  const since = new Date();
  const run1 = await callScheduler({ dryRun: false });
  const mine1 = run1.data.reapproval_reminders_sent.filter((r) => r.rule_id === ruleId);
  assert.equal(mine1.length, 1, 'expected exactly one reapproval reminder on the first run');

  const mockedEmail = await waitForMockEmail({ subject: 'Compliance Re-Approval Due Within 30 Days', sentAfter: since });
  assert.ok(mockedEmail, 'expected the reapproval reminder email to have actually been recorded');

  const logRows1 = await pool.query(`SELECT reminder_log_id FROM compliance_reminder_log WHERE rule_id = $1 AND tier_type = 'REAPPROVAL_REMINDER'`, [ruleId]);
  assert.equal(logRows1.rows.length, 1, 'expected exactly one REAPPROVAL_REMINDER log row after the first run');

  const run2 = await callScheduler({ dryRun: false });
  const mine2 = run2.data.reapproval_reminders_sent.filter((r) => r.rule_id === ruleId);
  assert.equal(mine2.length, 0, 'a second same-day run must not send a duplicate reapproval reminder');

  const logRows2 = await pool.query(`SELECT reminder_log_id FROM compliance_reminder_log WHERE rule_id = $1 AND tier_type = 'REAPPROVAL_REMINDER'`, [ruleId]);
  assert.equal(logRows2.rows.length, 1, 'row count must be unchanged after the second same-day run');
});

// ── 7e/7f: acknowledgement ───────────────────────────────────────────────────

test('a viewer-role token gets 403 on the acknowledge endpoint', async () => {
  const categoryId = await createComplianceCategory({ name: 'TEST SUITE - ack role gate', recurrence_type: 'ONE_OFF_EXPIRY' });
  cleanup.trackCategory(categoryId);
  const item = await createApprovedItem(categoryId, 10);

  await assert.rejects(
    () => axios.post(`${BASE_URL}/api/compliance/items/${item.item_id}/acknowledge`, {}, viewerHeaders),
    (err) => err.response?.status === 403
  );
});

test('acknowledging an overdue item stops further escalation on the next scheduler run', async () => {
  const categoryId = await createComplianceCategory({ name: 'TEST SUITE - ack stops escalation', recurrence_type: 'ONE_OFF_EXPIRY' });
  cleanup.trackCategory(categoryId);
  const item = await createApprovedItem(categoryId, -2);

  const run1 = await callScheduler({ dryRun: false });
  assert.ok(run1.data.escalations_sent.some((r) => r.item_id === item.item_id));

  const since = new Date();
  const ackRes = await axios.post(`${BASE_URL}/api/compliance/items/${item.item_id}/acknowledge`, { note: 'Resolved late.' }, jrHeaders);
  assert.equal(ackRes.status, 201);

  const mockedEmail = await waitForMockEmail({ subject: 'Compliance Item Acknowledged', sentAfter: since });
  assert.ok(mockedEmail, 'expected the acknowledgement email to have actually been recorded');

  const run2 = await callScheduler({ dryRun: false });
  assert.ok(!run2.data.escalations_sent.some((r) => r.item_id === item.item_id), 'must not escalate an acknowledged item');

  const row = await getItemRow(item.item_id);
  assert.equal(row.status, 'NON_COMPLIANT', 'acknowledging must NOT revert NON_COMPLIANT back to APPROVED');
});

test('a second acknowledgement attempt on the same item gets 409', async () => {
  const categoryId = await createComplianceCategory({ name: 'TEST SUITE - double ack', recurrence_type: 'ONE_OFF_EXPIRY' });
  cleanup.trackCategory(categoryId);
  const item = await createApprovedItem(categoryId, 10);

  const first = await axios.post(`${BASE_URL}/api/compliance/items/${item.item_id}/acknowledge`, {}, jrHeaders);
  assert.equal(first.status, 201);

  await assert.rejects(
    () => axios.post(`${BASE_URL}/api/compliance/items/${item.item_id}/acknowledge`, {}, jrHeaders),
    (err) => err.response?.status === 409
  );
});

// ── 7g: dry-run mode ──────────────────────────────────────────────────────────

test('dry-run mode reports what would happen but writes nothing and sends nothing', async () => {
  const categoryId = await createComplianceCategory({ name: 'TEST SUITE - dry run', recurrence_type: 'ONE_OFF_EXPIRY' });
  cleanup.trackCategory(categoryId);
  const reminderItem = await createApprovedItem(categoryId, 5); // would trigger all 4 ladder tiers
  const overdueItem = await createApprovedItem(categoryId, -1); // would flip to NON_COMPLIANT

  const before = {
    reminderLogCount: (await pool.query(`SELECT 1 FROM compliance_reminder_log WHERE item_id = ANY($1)`, [[reminderItem.item_id, overdueItem.item_id]])).rows.length,
    overdueStatus: (await getItemRow(overdueItem.item_id)).status,
    mockLogCount: (await axios.get(`${BASE_URL}/api/_test/email-log`)).data.emails.length,
  };
  assert.equal(before.reminderLogCount, 0);
  assert.equal(before.overdueStatus, 'APPROVED');

  const dry = await callScheduler({ dryRun: true });
  assert.equal(dry.data.dry_run, true);
  assert.ok(dry.data.reminders_sent.some((r) => r.item_id === reminderItem.item_id), 'summary should report the reminders that WOULD have sent');
  assert.ok(dry.data.items_flipped_non_compliant.some((r) => r.item_id === overdueItem.item_id), 'summary should report the item that WOULD have flipped');
  assert.ok(dry.data.escalations_sent.some((r) => r.item_id === overdueItem.item_id), 'summary should report the escalation that WOULD have sent');

  const after = {
    reminderLogCount: (await pool.query(`SELECT 1 FROM compliance_reminder_log WHERE item_id = ANY($1)`, [[reminderItem.item_id, overdueItem.item_id]])).rows.length,
    overdueStatus: (await getItemRow(overdueItem.item_id)).status,
    mockLogCount: (await axios.get(`${BASE_URL}/api/_test/email-log`)).data.emails.length,
  };
  assert.equal(after.reminderLogCount, 0, 'dry-run must not write any reminder_log rows');
  assert.equal(after.overdueStatus, 'APPROVED', 'dry-run must not change item status');
  // Direct check against notification-service's own record, replacing the
  // old proxy reasoning ("zero new reminder_log rows implies zero sendEmail
  // calls, since both live in the same `if (!dryRun)` branches"). This
  // asserts the actual thing that matters -- no sendEmail() call happened --
  // instead of inferring it from an unrelated table.
  assert.equal(after.mockLogCount, before.mockLogCount, 'dry-run must not record any mock email sends');
});
