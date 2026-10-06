#!/usr/bin/env node
'use strict';

// Session L. Undoes one live reconcileTrainingTasks run, scoped by the
// audit_log entry that run wrote (audit_log.action = 'RECONCILE',
// table_name = 'qms_training_tasks', new_values = { created_task_ids,
// voided_task_ids }).
//
// - Deletes every task in created_task_ids, but ONLY if it is still
//   PENDING. A task that was created by the run and has since been
//   COMPLETED by the user is real training history -- never deleted, and
//   reported as skipped.
// - Restores every task in voided_task_ids back to PENDING, but ONLY if
//   it is still VOIDED (not already touched by something else since).
// - Refuses to run twice against the same audit entry (checks for its own
//   prior UNDO audit row first) unless --force is passed.
// - Writes its own audit_log row (action = 'UNDO_RECONCILE') referencing
//   the original audit_id, so the undo itself is traceable.
//
// Usage:
//   node scripts/undo-training-reconcile.js <audit_id> [--force] [--yes]
//
// Without --yes, prints what it WOULD do and exits without writing
// anything -- the same dry-run-by-default convention as the reconcile
// endpoint itself.

require('dotenv').config({ path: process.env.ENV_FILE || undefined });
const { pool } = require('../src/services/auth-service');

async function main() {
  const auditId = process.argv[2];
  const force = process.argv.includes('--force');
  const confirmed = process.argv.includes('--yes');

  if (!auditId) {
    console.error('Usage: node scripts/undo-training-reconcile.js <audit_id> [--force] [--yes]');
    process.exit(1);
  }

  const auditRes = await pool.query(
    `SELECT audit_id, action, table_name, new_values, performed_at FROM audit_log WHERE audit_id = $1`,
    [auditId]
  );
  if (auditRes.rows.length === 0) {
    console.error(`No audit_log row found for audit_id ${auditId}`);
    process.exit(1);
  }
  const audit = auditRes.rows[0];
  if (audit.action !== 'RECONCILE' || audit.table_name !== 'qms_training_tasks') {
    console.error(`audit_id ${auditId} is not a training reconcile entry (action=${audit.action}, table_name=${audit.table_name}). Refusing.`);
    process.exit(1);
  }

  const { created_task_ids: createdIds = [], voided_task_ids: voidedIds = [] } = audit.new_values || {};
  console.log(`Reconcile run ${auditId} (performed_at ${audit.performed_at}): ${createdIds.length} created, ${voidedIds.length} voided.`);

  if (!force) {
    const priorUndo = await pool.query(
      `SELECT audit_id FROM audit_log WHERE action = 'UNDO_RECONCILE' AND record_id = $1`,
      [auditId]
    );
    if (priorUndo.rows.length > 0) {
      console.error(`Already undone by audit_log ${priorUndo.rows[0].audit_id}. Pass --force to redo anyway.`);
      process.exit(1);
    }
  }

  // Classify before writing anything, so a dry run (no --yes) shows exactly
  // what would happen, including what would be SKIPPED and why.
  const createdRows = createdIds.length
    ? (await pool.query(`SELECT task_id, status FROM qms_training_tasks WHERE task_id = ANY($1)`, [createdIds])).rows
    : [];
  const voidedRows = voidedIds.length
    ? (await pool.query(`SELECT task_id, status FROM qms_training_tasks WHERE task_id = ANY($1)`, [voidedIds])).rows
    : [];

  const toDelete = createdRows.filter((r) => r.status === 'PENDING').map((r) => r.task_id);
  const skippedCreated = createdRows.filter((r) => r.status !== 'PENDING');
  const toRestore = voidedRows.filter((r) => r.status === 'VOIDED').map((r) => r.task_id);
  const skippedVoided = voidedRows.filter((r) => r.status !== 'VOIDED');

  console.log(`Would delete ${toDelete.length} created task(s) (still PENDING).`);
  if (skippedCreated.length) {
    console.log(`  Skipping ${skippedCreated.length} created task(s) no longer PENDING (real history, not touched):`,
      skippedCreated.map((r) => `${r.task_id}=${r.status}`).join(', '));
  }
  console.log(`Would restore ${toRestore.length} voided task(s) back to PENDING (still VOIDED).`);
  if (skippedVoided.length) {
    console.log(`  Skipping ${skippedVoided.length} voided task(s) no longer VOIDED (already changed since):`,
      skippedVoided.map((r) => `${r.task_id}=${r.status}`).join(', '));
  }

  if (!confirmed) {
    console.log('\nDry run only -- pass --yes to actually write these changes.');
    await pool.end();
    return;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    if (toDelete.length) {
      await client.query(`DELETE FROM qms_training_tasks WHERE task_id = ANY($1)`, [toDelete]);
    }
    if (toRestore.length) {
      await client.query(
        `UPDATE qms_training_tasks SET status = 'PENDING' WHERE task_id = ANY($1) AND status = 'VOIDED'`,
        [toRestore]
      );
    }
    await client.query(
      `INSERT INTO audit_log (audit_id, table_name, record_id, action, new_values, performed_at)
       VALUES (gen_random_uuid(), 'qms_training_tasks', $1, 'UNDO_RECONCILE', $2, NOW())`,
      [auditId, JSON.stringify({ undid_audit_id: auditId, deleted_task_ids: toDelete, restored_task_ids: toRestore, skipped_created: skippedCreated, skipped_voided: skippedVoided })]
    );
    await client.query('COMMIT');
    console.log(`\nDone. Deleted ${toDelete.length}, restored ${toRestore.length}.`);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error('Undo failed:', err);
  process.exit(1);
});
