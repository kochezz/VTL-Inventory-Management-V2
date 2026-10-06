-- ============================================================================
-- Migration: qms_dept_compliance_exclude_voided
-- Date:      2026-10-06 (Session G2, Step 5)
-- ============================================================================
-- WHAT THIS DOES
-- qms_dept_training_compliance's total_tasks was COUNT(tt.task_id) with no
-- status filter at all -- it counts PENDING, COMPLETED and VOIDED rows
-- together. VOIDED didn't exist as a real write path until Session G's
-- reconcileTrainingTasks (2026-10-05), so this was correct when first
-- written; it is wrong now. A VOIDED row means "no longer required" -- it
-- should count toward neither completed_tasks nor the denominator, but it
-- currently inflates total_tasks and so deflates completion_pct for any
-- department with voided history.
--
-- Fix: total_tasks now excludes VOIDED explicitly. completed_tasks and
-- pending_tasks were already correct (each filters to its own exact
-- status, so VOIDED was never double-counted there).
--
-- qms_compliance_summary was checked and is already correct -- its
-- pending_training/training_pending both filter status = 'PENDING'
-- explicitly (VOIDED != PENDING, so excluded automatically), and
-- training_completed filters status = 'COMPLETED' explicitly. Not touched.
-- ============================================================================

BEGIN;

CREATE OR REPLACE VIEW qms_dept_training_compliance AS
 SELECT u.department,
    count(tt.task_id) FILTER (WHERE tt.status::text <> 'VOIDED'::text) AS total_tasks,
    count(tt.task_id) FILTER (WHERE tt.status::text = 'COMPLETED'::text) AS completed_tasks,
    count(tt.task_id) FILTER (WHERE tt.status::text = 'PENDING'::text) AS pending_tasks,
    COALESCE(round(count(tt.task_id) FILTER (WHERE tt.status::text = 'COMPLETED'::text)::numeric / NULLIF(count(tt.task_id) FILTER (WHERE tt.status::text <> 'VOIDED'::text), 0)::numeric * 100::numeric, 1), 0::numeric) AS completion_pct
   FROM users u
     LEFT JOIN qms_training_tasks tt ON u.user_id = tt.user_id
  WHERE u.is_active = true AND u.department IS NOT NULL
  GROUP BY u.department;

COMMIT;

-- ============================================================================
-- ROLLBACK (manual, not automatic) -- restores the pre-fix view exactly.
-- ============================================================================
-- BEGIN;
-- CREATE OR REPLACE VIEW qms_dept_training_compliance AS
--  SELECT u.department,
--     count(tt.task_id) AS total_tasks,
--     count(tt.task_id) FILTER (WHERE tt.status::text = 'COMPLETED'::text) AS completed_tasks,
--     count(tt.task_id) FILTER (WHERE tt.status::text = 'PENDING'::text) AS pending_tasks,
--     COALESCE(round(count(tt.task_id) FILTER (WHERE tt.status::text = 'COMPLETED'::text)::numeric / NULLIF(count(tt.task_id), 0)::numeric * 100::numeric, 1), 0::numeric) AS completion_pct
--    FROM users u
--      LEFT JOIN qms_training_tasks tt ON u.user_id = tt.user_id
--   WHERE u.is_active = true AND u.department IS NOT NULL
--   GROUP BY u.department;
-- COMMIT;
