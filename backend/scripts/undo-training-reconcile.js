#!/usr/bin/env node
'use strict';

// Session L/M. Undoes one live reconcileTrainingTasks run, scoped by the
// audit_log entry that run wrote (audit_log.action = 'RECONCILE',
// table_name = 'qms_training_tasks', new_values = { created_task_ids,
// voided_task_ids, affected_user_ids }).
//
// - Deletes every task in created_task_ids, but ONLY if it is still PENDING
//   AND has no qms_training_records row (user_id, doc_id, version_id)
//   acknowledged after this run's performed_at. Either one means a real
//   person has acted on it since -- never deleted, reported as skipped.
//   (A COMPLETED task already fails the PENDING check; the records check
//   additionally catches a race where the record landed but the task's own
//   status hasn't synced to COMPLETED yet -- see syncTrainingTaskCompletion,
//   qms-scheduler.js, which only runs every 24h.)
// - Restores every task in voided_task_ids back to PENDING, but ONLY if it
//   is still VOIDED (not already touched by something else since).
// - Refuses to run if a LATER reconcile audit entry (performed_at > this
//   one's) touched ANY of the same users (affected_user_ids intersect),
//   unless --force -- undoing an earlier run after a later one has already
//   reconciled the same users could resurrect/re-void the wrong things.
// - Refuses to run twice against the same audit entry (checks for its own
//   prior UNDO audit row first) unless --force.
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

  const { created_task_ids: createdIds = [], voided_task_ids: voidedIds = [], affected_user_ids: affectedUserIds = [] } = audit.new_values || {};
  console.log(`Reconcile run ${auditId} (performed_at ${audit.performed_at}): ${createdIds.length} created, ${voidedIds.length} voided, ${affectedUserIds.length} user(s) affected.`);

  if (!force) {
    const priorUndo = await pool.query(
      `SELECT audit_id FROM audit_log WHERE action = 'UNDO_RECONCILE' AND record_id = $1`,
      [auditId]
    );
    if (priorUndo.rows.length > 0) {
      console.error(`Already undone by audit_log ${priorUndo.rows[0].audit_id}. Pass --force to redo anyway.`);
      process.exit(1);
    }

    if (affectedUserIds.length > 0) {
      const laterRuns = await pool.query(
        `SELECT audit_id, performed_at, new_values->'affected_user_ids' AS affected_user_ids
         FROM audit_log
         WHERE action = 'RECONCILE' AND table_name = 'qms_training_tasks'
           AND performed_at > $1 AND audit_id != $2`,
        [audit.performed_at, auditId]
      );
      const overlapping = laterRuns.rows.filter((row) => {
        const theirUsers = row.affected_user_ids || [];
        return theirUsers.some((u) => affectedUserIds.includes(u));
      });
      if (overlapping.length > 0) {
        console.error(
          `Refusing: ${overlapping.length} later reconcile run(s) touched one or more of the same user(s) ` +
          `(${overlapping.map((r) => r.audit_id).join(', ')}). Undoing this run now could conflict with what ` +
          `those later runs did. Pass --force to proceed anyway.`
        );
        process.exit(1);
      }
    }
  }

  // Classify before writing anything, so a dry run (no --yes) shows exactly
  // what would happen, including what would be SKIPPED and why.
  const createdRows = createdIds.length
    ? (await pool.query(`SELECT task_id, user_id, doc_id, version_id, status FROM qms_training_tasks WHERE task_id = ANY($1)`, [createdIds])).rows
    : [];
  const voidedRows = voidedIds.length
    ? (await pool.query(`SELECT task_id, status FROM qms_training_tasks WHERE task_id = ANY($1)`, [voidedIds])).rows
    : [];

  // Look for a training record acknowledged AFTER this run for any of the
  // created rows' (user_id, doc_id, version_id) -- i.e. someone actually did
  // the training since this run created the task. Narrowed by user_id in
  // SQL (ANY over a single-column array is safe and indexable); the exact
  // triple match happens in JS since the candidate set here is always small
  // (one reconcile run's worth of created tasks).
  const pendingCreated = createdRows.filter((r) => r.status === 'PENDING');
  let recordsAfterRun = [];
  if (pendingCreated.length > 0) {
    recordsAfterRun = (await pool.query(
      `SELECT user_id, doc_id, version_id FROM qms_training_records
       WHERE user_id = ANY($1) AND acknowledged_at > $2`,
      [pendingCreated.map((r) => r.user_id), audit.performed_at]
    )).rows;
  }
  const hasRecordAfterRun = (row) => recordsAfterRun.some(
    (rec) => rec.user_id === row.user_id && rec.doc_id === row.doc_id && rec.version_id === row.version_id
  );

  const toDelete = pendingCreated.filter((r) => !hasRecordAfterRun(r)).map((r) => r.task_id);
  const skippedCreated = [
    ...createdRows.filter((r) => r.status !== 'PENDING').map((r) => ({ task_id: r.task_id, reason: `status=${r.status}` })),
    ...pendingCreated.filter((r) => hasRecordAfterRun(r)).map((r) => ({ task_id: r.task_id, reason: 'acknowledged (qms_training_records) after this run' })),
  ];
  const toRestore = voidedRows.filter((r) => r.status === 'VOIDED').map((r) => r.task_id);
  const skippedVoided = voidedRows.filter((r) => r.status !== 'VOIDED').map((r) => ({ task_id: r.task_id, reason: `status=${r.status}` }));

  console.log(`Would delete ${toDelete.length} created task(s) (still PENDING, no acknowledgement since).`);
  if (skippedCreated.length) {
    console.log(`  Skipping ${skippedCreated.length} created task(s) -- real history, not touched:`,
      skippedCreated.map((r) => `${r.task_id} (${r.reason})`).join(', '));
  }
  console.log(`Would restore ${toRestore.length} voided task(s) back to PENDING (still VOIDED).`);
  if (skippedVoided.length) {
    console.log(`  Skipping ${skippedVoided.length} voided task(s) -- already changed since:`,
      skippedVoided.map((r) => `${r.task_id} (${r.reason})`).join(', '));
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
