// ============================================================================
// VILAGIO ERP — PM DUE-CHECK SCHEDULER
// backend/src/services/pm-scheduler.js
//
// Mirrors backend/src/services/qms-scheduler.js's pattern exactly:
// Render doesn't support true cron on starter/standard plans, so this uses
// setInterval, started on server boot with an initial delay to let the DB
// pool warm up. A missed daily check resolves itself on next deploy/restart,
// same tradeoff qms-scheduler.js already accepts.
//
// This does NOT reimplement PM-plan-to-work-order conversion — it calls
// engineeringService.generateWorkOrderFromPMPlan() unchanged, the exact
// function already verified manually in Phase 4 Stage C (idempotency,
// checklist copying, plan rescheduling all proven there). This file is
// only the "when to call it automatically" layer.
//
// Register in server.js:
//   const pmScheduler = require('./src/services/pm-scheduler');
//   pmScheduler.start();
// ============================================================================

const { pool } = require('./auth-service');
const engineeringService = require('./engineering-service');

const INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

async function runPMDueCheck() {
  console.log('🔧 [PM Scheduler] Running PM due-check...');

  try {
    // A plan is due if EITHER its calendar date has arrived OR its counter
    // threshold has been reached (BOTH_FIRST_DUE = whichever comes first,
    // which this OR structure gives for free — it doesn't require both).
    // The NOT EXISTS clause is the same idempotency guard already inside
    // generateWorkOrderFromPMPlan itself — checking it here too means the
    // scheduler doesn't even attempt a call it knows will be rejected.
    const dueQuery = `
      SELECT pp.pm_plan_id, pp.title
      FROM pm_plans pp
      LEFT JOIN measuring_points mp ON mp.point_id = pp.counter_point_id
      WHERE pp.is_active = TRUE
        AND (
          (pp.trigger_type IN ('CALENDAR', 'BOTH_FIRST_DUE')
             AND pp.next_due_date IS NOT NULL
             AND pp.next_due_date <= CURRENT_DATE)
          OR
          (pp.trigger_type IN ('COUNTER', 'BOTH_FIRST_DUE')
             AND pp.next_due_counter IS NOT NULL
             AND mp.current_value IS NOT NULL
             AND mp.current_value >= pp.next_due_counter)
        )
        AND NOT EXISTS (
          SELECT 1 FROM work_orders wo
          WHERE wo.pm_plan_id = pp.pm_plan_id
            AND wo.status NOT IN ('CLOSED', 'CANCELLED')
        )
    `;
    const dueResult = await pool.query(dueQuery);

    if (dueResult.rows.length === 0) {
      console.log('🔧 [PM Scheduler] No PM plans due. All clear.');
      return;
    }

    // Auto-generated work orders still need a real, valid created_by user
    // (work_orders.created_by is NOT NULL). Resolved fresh each run rather
    // than cached, so it stays correct if the active admin account changes.
    const adminResult = await pool.query(
      `SELECT user_id FROM users WHERE role = 'admin' AND is_active = TRUE ORDER BY created_at LIMIT 1`
    );
    if (adminResult.rows.length === 0) {
      console.error('❌ [PM Scheduler] No active admin user found — cannot attribute auto-generated work orders. Skipping this cycle.');
      return;
    }
    const systemUserId = adminResult.rows[0].user_id;

    console.log(`🔧 [PM Scheduler] ${dueResult.rows.length} PM plan(s) due — generating work orders.`);

    for (const plan of dueResult.rows) {
      try {
        const wo = await engineeringService.generateWorkOrderFromPMPlan(plan.pm_plan_id, systemUserId);
        console.log(`🔧 [PM Scheduler] Generated ${wo.wo_number} for PM plan "${plan.title}".`);
      } catch (error) {
        // One plan failing (e.g. a race where a work order was created
        // between the due-check query and this call) must not stop the
        // rest of the batch from being processed.
        console.error(`❌ [PM Scheduler] Failed to generate a work order for PM plan "${plan.title}" (${plan.pm_plan_id}):`, error.message);
      }
    }
  } catch (error) {
    console.error('❌ [PM Scheduler] Due-check failed:', error.message);
  }
}

function start() {
  console.log('🔧 [PM Scheduler] Starting — will run PM due-check every 24h.');

  // 15s delay, not 10s (qms-scheduler's delay) — deliberately staggered so
  // both schedulers don't hit the DB pool at the exact same instant on a
  // cold start.
  setTimeout(async () => {
    await runPMDueCheck();
  }, 15_000);

  setInterval(async () => {
    await runPMDueCheck();
  }, INTERVAL_MS);
}

module.exports = { start, runPMDueCheck };
