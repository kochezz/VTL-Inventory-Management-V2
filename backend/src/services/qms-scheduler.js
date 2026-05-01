// ============================================================================
// VILAGIO ERP — QMS PERIODIC REVIEW SCHEDULER
// backend/src/services/qms-scheduler.js
//
// Render does not support true cron jobs on starter/standard plans.
// Pattern used: setInterval on server startup — runs the check once daily.
// On Render, the server restarts on every deploy, so the interval resets.
// That is acceptable — a missed daily check resolves on next deploy/restart.
//
// Register in server.js:
//   const qmsScheduler = require('./src/services/qms-scheduler');
//   qmsScheduler.start();
// ============================================================================

const { pool } = require('../config/database');
const notificationService = require('./notification-service');

const INTERVAL_MS    = 24 * 60 * 60 * 1000; // 24 hours
const WARN_DAYS      = 30;                    // alert when due within 30 days
const OVERDUE_DAYS   = 0;                     // also alert when already overdue

// ── Main check function ──────────────────────────────────────────────────────

async function runReviewCheck() {
  console.log('📋 [QMS Scheduler] Running periodic review check...');

  try {
    // Find released documents whose review is due within WARN_DAYS
    // and don't already have an OPEN review task
    const dueQuery = `
      SELECT
        d.doc_id,
        d.doc_code,
        d.doc_name,
        d.doc_type,
        d.doc_owner,
        v.review_due_date,
        v.version_number,
        u.full_name  AS owner_name,
        u.email      AS owner_email
      FROM qms_documents d
      JOIN qms_document_versions v ON d.current_version_id = v.version_id
      LEFT JOIN users u ON d.doc_owner = u.user_id::text
      WHERE d.status = 'RELEASED'
        AND v.review_due_date IS NOT NULL
        AND v.review_due_date <= NOW() + INTERVAL '${WARN_DAYS} days'
        AND NOT EXISTS (
          SELECT 1 FROM qms_review_tasks rt
          WHERE rt.doc_id = d.doc_id AND rt.status = 'OPEN'
        )
      ORDER BY v.review_due_date ASC
    `;

    const dueResult = await pool.query(dueQuery);

    if (dueResult.rows.length === 0) {
      console.log('📋 [QMS Scheduler] No documents due for review. All clear.');
      return;
    }

    console.log(`📋 [QMS Scheduler] ${dueResult.rows.length} document(s) due for review — creating tasks.`);

    for (const doc of dueResult.rows) {
      try {
        // Create the review task
        await pool.query(`
          INSERT INTO qms_review_tasks (doc_id, assigned_to, due_date, status, notified_at)
          VALUES ($1, $2, $3, 'OPEN', CURRENT_TIMESTAMP)
          ON CONFLICT (doc_id, status) DO UPDATE
            SET notified_at = CURRENT_TIMESTAMP
        `, [doc.doc_id, doc.doc_owner || null, doc.review_due_date]);

        // Send notification to the document owner (if assigned)
        if (doc.owner_email) {
          await notificationService.notifyDocumentReviewDue(
            doc.doc_code,
            doc.doc_name,
            doc.version_number,
            doc.review_due_date,
            doc.owner_name,
            doc.owner_email
          ).catch(e => console.error(`📧 Review notification failed for ${doc.doc_code}:`, e));
        }

        // Also notify QA/admin roles regardless of doc_owner assignment
        await notificationService.notifyQAReviewDueBroadcast(
          doc.doc_code,
          doc.doc_name,
          doc.version_number,
          doc.review_due_date
        ).catch(e => console.error(`📧 QA broadcast failed for ${doc.doc_code}:`, e));

        console.log(`  ✅ Review task created: ${doc.doc_code} (due: ${new Date(doc.review_due_date).toLocaleDateString()})`);
      } catch (docError) {
        console.error(`  ❌ Failed to process ${doc.doc_code}:`, docError.message);
      }
    }

    // Also log overdue tasks that are still OPEN (re-notify weekly)
    const overdueQuery = `
      SELECT rt.task_id, d.doc_code, d.doc_name, rt.due_date, rt.notified_at,
             u.email AS owner_email, u.full_name AS owner_name
      FROM qms_review_tasks rt
      JOIN qms_documents d ON rt.doc_id = d.doc_id
      LEFT JOIN users u ON rt.assigned_to = u.user_id::text
      WHERE rt.status = 'OPEN'
        AND rt.due_date < NOW()
        AND (rt.notified_at IS NULL OR rt.notified_at < NOW() - INTERVAL '7 days')
    `;
    const overdueResult = await pool.query(overdueQuery);

    for (const task of overdueResult.rows) {
      console.warn(`  ⚠️  OVERDUE: ${task.doc_code} was due ${new Date(task.due_date).toLocaleDateString()}`);
      if (task.owner_email) {
        await notificationService.notifyDocumentOverdue(
          task.doc_code,
          task.doc_name,
          task.due_date,
          task.owner_name,
          task.owner_email
        ).catch(e => console.error(`📧 Overdue notification failed for ${task.doc_code}:`, e));
      }
      await pool.query(
        `UPDATE qms_review_tasks SET notified_at = CURRENT_TIMESTAMP WHERE task_id = $1`,
        [task.task_id]
      );
    }

    console.log('📋 [QMS Scheduler] Review check complete.');
  } catch (error) {
    console.error('❌ [QMS Scheduler] Review check failed:', error.message);
  }
}

// ── Training task cleanup ────────────────────────────────────────────────────
// Marks training tasks as COMPLETED when the user has acknowledged the doc.
// Runs alongside the review check.

async function syncTrainingTaskCompletion() {
  try {
    const result = await pool.query(`
      UPDATE qms_training_tasks tt
      SET status = 'COMPLETED', completed_at = tr.acknowledged_at
      FROM qms_training_records tr
      WHERE tt.version_id = tr.version_id
        AND tt.user_id    = tr.user_id
        AND tt.status     = 'PENDING'
      RETURNING tt.task_id
    `);
    if (result.rowCount > 0) {
      console.log(`📋 [QMS Scheduler] Synced ${result.rowCount} training task(s) to COMPLETED.`);
    }
  } catch (error) {
    console.error('❌ [QMS Scheduler] Training sync failed:', error.message);
  }
}

// ── Scheduler start ──────────────────────────────────────────────────────────

function start() {
  console.log('📋 [QMS Scheduler] Starting — will run review check every 24h.');

  // Run immediately on startup (catches anything missed while server was down)
  setTimeout(async () => {
    await runReviewCheck();
    await syncTrainingTaskCompletion();
  }, 10_000); // 10s delay — let the DB pool warm up first

  // Then repeat every 24 hours
  setInterval(async () => {
    await runReviewCheck();
    await syncTrainingTaskCompletion();
  }, INTERVAL_MS);
}

module.exports = { start, runReviewCheck, syncTrainingTaskCompletion };
