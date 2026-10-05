'use strict';

// Regression test for the 2026-10-05 fix: qms_compliance_summary's
// pending_training/training_pending counts (surfaced on GET /qms/compliance
// and GET /qms/dashboard-summary as the "Training Pending" KPI) used to
// count every PENDING qms_training_tasks row regardless of whether the
// assigned user was still active -- the 2026-10-03 roster cleanup
// (5 accounts deactivated) left 22 such leftover tasks still inflating the
// company-wide count. This test is DB-direct (no HTTP server required,
// unlike the compliance integration suite) since the fix itself is a
// Postgres view, not an Express route -- it creates one disposable user +
// one disposable training task, confirms the view counts it while active,
// then confirms it stops counting the moment the user is deactivated.
//
// Uses test-helper's `pool`, which is wired to .env.test -- NOT production
// (see db-safety-guard.js). Does not require the dev server running.

const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { pool } = require('./helpers/test-helper');

let disposableUserId;
let taskId;

async function getPendingTrainingCount() {
  const res = await pool.query(`SELECT pending_training FROM qms_compliance_summary`);
  return parseInt(res.rows[0].pending_training, 10);
}

after(async () => {
  if (taskId) await pool.query(`DELETE FROM qms_training_tasks WHERE task_id = $1`, [taskId]);
  if (disposableUserId) await pool.query(`DELETE FROM users WHERE user_id = $1`, [disposableUserId]);
});

test('a deactivated user\'s pending training task is excluded from qms_compliance_summary.pending_training', async () => {
  const docRes = await pool.query(
    `SELECT doc_id, current_version_id FROM qms_documents WHERE status = 'RELEASED' AND current_version_id IS NOT NULL LIMIT 1`
  );
  assert.ok(docRes.rows.length > 0, 'expected at least one RELEASED qms_document to exist to attach a test training task to');
  const { doc_id, current_version_id } = docRes.rows[0];

  const userRes = await pool.query(
    `INSERT INTO users (email, full_name, password_hash, role, is_active)
     VALUES ($1, 'TEST SUITE Disposable Training User', 'not-a-real-hash', 'viewer', true)
     RETURNING user_id`,
    [`test-suite-training-pending-${Date.now()}@vilag.io`]
  );
  disposableUserId = userRes.rows[0].user_id;

  const taskRes = await pool.query(
    `INSERT INTO qms_training_tasks (doc_id, version_id, user_id, status)
     VALUES ($1, $2, $3, 'PENDING')
     RETURNING task_id`,
    [doc_id, current_version_id, disposableUserId]
  );
  taskId = taskRes.rows[0].task_id;

  const countWhileActive = await getPendingTrainingCount();

  await pool.query(`UPDATE users SET is_active = false WHERE user_id = $1`, [disposableUserId]);
  const countWhileDeactivated = await getPendingTrainingCount();

  assert.equal(
    countWhileDeactivated, countWhileActive - 1,
    `expected pending_training to drop by exactly 1 once the task's user was deactivated (was ${countWhileActive}, now ${countWhileDeactivated})`
  );
});
