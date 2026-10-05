'use strict';

// Session G, Step 4. Real HTTP calls against the running test server, real
// DB (test branch) -- see backend/tests/README.md. Covers
// reconcileTrainingTasks (qms-service.js) and its wiring into user
// creation / role change (users-service.js).
//
// Uses the CORE section mapping seeded by the 2026-10-05 sectionize
// migration (admin/qa/manager/cfo require CORE SOP+POL) as a real,
// already-active fixture rather than inventing a throwaway
// qms_training_requirements row -- one less thing to clean up, and proves
// the actual seeded data works, not just a synthetic case.
//
// All steps are nested t.test() subtests under ONE outer test() -- matching
// this suite's own established convention elsewhere (role-permissions.test.js
// etc.) -- rather than independent top-level test() calls, because Node's
// test runner does NOT guarantee strict ordering across separate top-level
// tests in the same file. The first version of this file used independent
// top-level tests and intermittently saw a later step's "before" query read
// an empty task list that an earlier step had already (by its own
// assertions) populated -- i.e. actual interleaving, not a flake.

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const axios = require('axios');

const {
  BASE_URL,
  pool,
  assertServerReachable,
  login,
  authHeaders,
} = require('./helpers/test-helper');

const qmsService = require('../src/services/qms-service');

let adminHeaders;
let disposableUserId;

async function cleanup() {
  const failures = [];
  if (disposableUserId) {
    try {
      await pool.query(`DELETE FROM qms_training_tasks WHERE user_id = $1`, [disposableUserId]);
    } catch (e) { failures.push(`qms_training_tasks: ${e.message}`); }
    try {
      await pool.query(`DELETE FROM users WHERE user_id = $1`, [disposableUserId]);
    } catch (e) { failures.push(`users: ${e.message}`); }
  }
  if (failures.length > 0) {
    console.error(`⚠️  Cleanup FAILED for disposable user ${disposableUserId}: ${failures.join('; ')}`);
  }
  return failures;
}

before(async () => {
  await assertServerReachable();
  const adminToken = await login(process.env.TEST_ADMIN_EMAIL, process.env.TEST_ADMIN_PASSWORD);
  adminHeaders = authHeaders(adminToken);
});

after(async () => {
  const failures = await cleanup();
  assert.equal(failures.length, 0, `cleanup must leave zero residue -- failures: ${JSON.stringify(failures)}`);
});

// Polls for the fire-and-forget reconcileTrainingTasksAsync call
// (users-service.js) to land, rather than assuming a fixed delay.
async function waitForTasks(userId, predicate, timeoutMs = 8000) {
  const start = Date.now();
  let rows;
  while (Date.now() - start < timeoutMs) {
    const res = await pool.query(`SELECT task_id, doc_id, status, version_id FROM qms_training_tasks WHERE user_id = $1`, [userId]);
    rows = res.rows;
    if (predicate(rows)) return rows;
    await new Promise((r) => setTimeout(r, 300));
  }
  return rows;
}

test('reconcileTrainingTasks: user creation, idempotency, dry-run, COMPLETED protection, role change', async (t) => {
  await t.test('new user with role=qa gets real PENDING tasks (via POST /api/users)', async () => {
    const disposableEmail = `test-suite-reconcile-${Date.now()}@vilag.io`;
    const createRes = await axios.post(
      `${BASE_URL}/api/users`,
      {
        email: disposableEmail,
        full_name: 'TEST SUITE Reconcile Disposable User',
        password: 'InitialPass123!',
        role: 'qa',
        is_active: true,
      },
      adminHeaders
    );
    assert.equal(createRes.status, 201);
    disposableUserId = createRes.data.user_id;

    const rows = await waitForTasks(disposableUserId, (r) => r.length > 0, 20000);
    assert.ok(rows && rows.length > 0, 'expected the async reconcile call to create at least one PENDING task for a qa-role user');
    assert.ok(rows.every((r) => r.status === 'PENDING'), 'all freshly-created tasks should be PENDING');
  });

  await t.test('second reconcile run for the same user is a no-op (idempotent)', async () => {
    const before = await pool.query(`SELECT task_id, status FROM qms_training_tasks WHERE user_id = $1 ORDER BY task_id`, [disposableUserId]);
    assert.ok(before.rows.length > 0, 'sanity check: prior step should have left PENDING rows in place');

    const results = await qmsService.reconcileTrainingTasks({ userId: disposableUserId, dryRun: false });
    const mine = results.find((r) => r.user_id === disposableUserId);
    assert.ok(mine, 'expected a result row for this user');
    assert.equal(mine.to_create.length, 0, 'second run should create nothing new');
    assert.equal(mine.to_void.length, 0, 'second run should void nothing new');

    const after = await pool.query(`SELECT task_id, status FROM qms_training_tasks WHERE user_id = $1 ORDER BY task_id`, [disposableUserId]);
    assert.deepEqual(after.rows, before.rows, 'task rows must be byte-identical after a no-op reconcile');
  });

  await t.test('dry-run reports a real pending change but writes nothing', async () => {
    // Manufacture a genuine "something to create" case: delete one of this
    // user's own PENDING task rows directly, so the resolver now sees a
    // required doc with no task row at all. A dry-run should report it in
    // to_create -- and, critically, the row must still be absent
    // afterward, proving dry-run actually suppressed the write (not just
    // that a no-op stays a no-op, which the previous step already covers).
    const target = await pool.query(`SELECT task_id, doc_id, version_id FROM qms_training_tasks WHERE user_id = $1 AND status = 'PENDING' LIMIT 1`, [disposableUserId]);
    assert.ok(target.rows.length > 0, 'expected at least one PENDING task to delete for this test');
    const { doc_id, version_id } = target.rows[0];
    await pool.query(`DELETE FROM qms_training_tasks WHERE task_id = $1`, [target.rows[0].task_id]);

    const existsBefore = await pool.query(`SELECT 1 FROM qms_training_tasks WHERE user_id = $1 AND version_id = $2`, [disposableUserId, version_id]);
    assert.equal(existsBefore.rows.length, 0, 'sanity check: the row should genuinely be gone before the dry-run');

    const dryRunResults = await qmsService.reconcileTrainingTasks({ userId: disposableUserId, dryRun: true });
    const mineDry = dryRunResults.find((r) => r.user_id === disposableUserId);
    assert.ok(mineDry, 'expected a dry-run result row for this user');
    assert.ok(
      mineDry.to_create.some((c) => c.doc_id === doc_id && c.version_id === version_id),
      'expected the dry-run to report the deleted task as something it would create'
    );

    const existsAfterDryRun = await pool.query(`SELECT 1 FROM qms_training_tasks WHERE user_id = $1 AND version_id = $2`, [disposableUserId, version_id]);
    assert.equal(existsAfterDryRun.rows.length, 0, 'dry-run must not actually create the row');

    // Real (non-dry) run should now actually create it, proving the
    // absence above was dry-run suppression, not some other bug.
    const realResults = await qmsService.reconcileTrainingTasks({ userId: disposableUserId, dryRun: false });
    const mineReal = realResults.find((r) => r.user_id === disposableUserId);
    assert.ok(mineReal.to_create.some((c) => c.doc_id === doc_id && c.version_id === version_id));
    const existsAfterRealRun = await pool.query(`SELECT 1 FROM qms_training_tasks WHERE user_id = $1 AND version_id = $2`, [disposableUserId, version_id]);
    assert.equal(existsAfterRealRun.rows.length, 1, 'the real (non-dry) run must actually recreate the row');
  });

  await t.test('COMPLETED tasks are never touched by reconcile, even when the role changes away', async () => {
    const pendingRes = await pool.query(`SELECT task_id, version_id FROM qms_training_tasks WHERE user_id = $1 AND status = 'PENDING' LIMIT 1`, [disposableUserId]);
    assert.ok(pendingRes.rows.length > 0, 'expected at least one PENDING task to complete for this test');
    const completedTaskId = pendingRes.rows[0].task_id;
    await pool.query(`UPDATE qms_training_tasks SET status = 'COMPLETED', completed_at = CURRENT_TIMESTAMP WHERE task_id = $1`, [completedTaskId]);

    // Change role to 'viewer' (zero qms_training_requirements rows) via the
    // real PUT /api/users/:id route -- every PENDING task should VOID, but
    // the one just marked COMPLETED must survive untouched.
    const updateRes = await axios.put(`${BASE_URL}/api/users/${disposableUserId}`, { role: 'viewer' }, adminHeaders);
    assert.equal(updateRes.status, 200);

    const rows = await waitForTasks(
      disposableUserId,
      (r) => r.filter((x) => x.status === 'PENDING').length === 0,
      20000,
    );
    const completedRow = rows.find((r) => r.task_id === completedTaskId);
    assert.ok(completedRow, 'the completed task row must still exist');
    assert.equal(completedRow.status, 'COMPLETED', 'a COMPLETED task must never be voided by a role change');

    const stillPending = rows.filter((r) => r.status === 'PENDING');
    assert.equal(stillPending.length, 0, 'every other PENDING task should have been voided once role no longer requires anything');
    const voided = rows.filter((r) => r.status === 'VOIDED');
    assert.ok(voided.length > 0, 'expected at least one task to be VOIDED by the role change to viewer');
  });

  await t.test('role change creates new tasks for the new role\'s requirements, never deletes rows', async () => {
    // Currently viewer (zero requirements, all prior PENDING voided by the
    // previous step). Change to 'engineering' (ENG section requirement).
    const beforeRes = await pool.query(`SELECT task_id, status FROM qms_training_tasks WHERE user_id = $1`, [disposableUserId]);
    const beforeTaskIds = new Set(beforeRes.rows.map((r) => r.task_id));

    await axios.put(`${BASE_URL}/api/users/${disposableUserId}`, { role: 'engineering' }, adminHeaders);
    await new Promise((r) => setTimeout(r, 1500)); // let the async reconcile call settle either way

    // Not asserting a specific count -- how many ENG-section SOP/POL docs
    // are RELEASED can change over time (0 at the time of Session G's own
    // investigation). What's asserted is the mechanism: nothing
    // pre-existing was deleted (row count only grows or stays level), and
    // any genuinely new row starts PENDING.
    const afterRes = await pool.query(`SELECT task_id, status FROM qms_training_tasks WHERE user_id = $1`, [disposableUserId]);
    assert.ok(afterRes.rows.length >= beforeRes.rows.length, 'reconcile must never delete rows -- count can only grow or stay level');
    for (const row of afterRes.rows) {
      if (beforeTaskIds.has(row.task_id)) continue;
      assert.equal(row.status, 'PENDING', 'a newly-created task from a role change must start PENDING');
    }
  });
});
