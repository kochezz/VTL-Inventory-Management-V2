-- ============================================================================
-- Migration: qms_training_pending_exclude_inactive
-- Date:      2026-10-05
-- ============================================================================
-- WHAT THIS DOES
-- Following the 2026-10-03 user-roster cleanup (5 accounts deactivated,
-- is_active = false), the company-wide "Training Pending" KPI on
-- GET /qms/compliance and GET /qms/dashboard-summary was still counting
-- qms_training_tasks rows for deactivated users -- a deactivated employee's
-- leftover PENDING tasks have no one left to act on them and shouldn't be
-- reported as outstanding compliance work. Before this fix: 97 PENDING
-- tasks counted; 22 of those belong to deactivated users (Womb Mate: 19,
-- John Smith: 3); after: 75.
--
-- Only PENDING counts are filtered by is_active. training_completed is left
-- untouched deliberately -- a now-deactivated employee's past completed
-- acknowledgement is a real historical compliance record, not something to
-- un-count. This mirrors createTrainingTasksForRelease (qms-service.js),
-- which already only creates new tasks for is_active = true users -- this
-- migration closes the read side to match, not the write side (already
-- correct).
--
-- qms_dept_training_compliance (the per-department breakdown on the same
-- dashboard) was checked and already filters u.is_active = true -- not
-- touched here, nothing to fix.
--
-- The per-user queries (dashboard-routes.js /stats, qms-service.js
-- getMyTasks) were checked and need no fix -- they're scoped to the
-- currently-authenticated user via $1 = req.user.user_id, and a
-- deactivated user cannot log in to begin with, so there's no "other
-- deactivated user" to inflate those.
-- ============================================================================

BEGIN;

CREATE OR REPLACE VIEW qms_compliance_summary AS
 SELECT ( SELECT count(*) AS count
           FROM qms_documents) AS total_docs,
    ( SELECT count(*) AS count
           FROM qms_documents
          WHERE qms_documents.status::text = 'RELEASED'::text) AS released,
    ( SELECT count(*) AS count
           FROM qms_documents
          WHERE qms_documents.status::text = 'RELEASED'::text) AS active_docs,
    ( SELECT count(*) AS count
           FROM qms_documents
          WHERE qms_documents.status::text = 'REVIEW'::text) AS in_review,
    ( SELECT count(*) AS count
           FROM qms_documents
          WHERE qms_documents.status::text = 'DRAFT'::text) AS draft,
    ( SELECT count(*) AS count
           FROM qms_documents
          WHERE qms_documents.status::text = 'WITHDRAWN'::text) AS withdrawn,
    ( SELECT count(*) AS count
           FROM qms_documents
          WHERE qms_documents.status::text = 'PLANNED'::text) AS planned,
    ( SELECT count(*) AS count
           FROM qms_documents
          WHERE qms_documents.status::text <> ALL (ARRAY['WITHDRAWN'::character varying, 'PLANNED'::character varying]::text[])) AS total_active,
    ( SELECT count(*) AS count
           FROM qms_review_calendar
          WHERE qms_review_calendar.urgency = 'overdue'::text) AS overdue_review,
    ( SELECT count(*) AS count
           FROM qms_review_calendar
          WHERE qms_review_calendar.urgency = 'critical'::text) AS due_within_30d,
    ( SELECT count(*) AS count
           FROM qms_ncr
          WHERE qms_ncr.status::text = ANY (ARRAY['OPEN'::character varying, 'CAPA_REQUIRED'::character varying]::text[])) AS ncr_open,
    ( SELECT count(*) AS count
           FROM qms_ncr
          WHERE qms_ncr.status::text = ANY (ARRAY['CLOSED'::character varying, 'VERIFIED'::character varying]::text[])) AS ncr_closed,
    ( SELECT count(*) AS count
           FROM qms_ncr_age_analysis
          WHERE qms_ncr_age_analysis.age_band = ANY (ARRAY['aging'::text, 'overdue'::text, 'critical'::text])) AS ncr_aged_open,
    ( SELECT count(*) AS count
           FROM qms_capa
          WHERE qms_capa.status::text = ANY (ARRAY['OPEN'::character varying, 'IN_PROGRESS'::character varying]::text[])) AS capa_open,
    ( SELECT count(*) AS count
           FROM qms_capa
          WHERE qms_capa.status::text = ANY (ARRAY['VERIFIED'::character varying, 'CLOSED'::character varying]::text[])) AS capa_closed,
    ( SELECT count(*) AS count
           FROM qms_capa
          WHERE (qms_capa.status::text <> ALL (ARRAY['CLOSED'::character varying, 'VERIFIED'::character varying]::text[])) AND qms_capa.due_date < now()) AS capa_overdue,
    ( SELECT count(*) AS count
           FROM qms_training_tasks tt
           JOIN users u ON u.user_id = tt.user_id
          WHERE tt.status::text = 'PENDING'::text AND u.is_active = true) AS pending_training,
    ( SELECT count(*) AS count
           FROM qms_training_tasks tt
           JOIN users u ON u.user_id = tt.user_id
          WHERE tt.status::text = 'PENDING'::text AND u.is_active = true) AS training_pending,
    ( SELECT count(*) AS count
           FROM qms_training_tasks
          WHERE qms_training_tasks.status::text = 'COMPLETED'::text) AS training_completed;

COMMIT;

-- ============================================================================
-- ROLLBACK (manual, not automatic) -- restores the pre-fix view exactly.
-- ============================================================================
-- BEGIN;
-- CREATE OR REPLACE VIEW qms_compliance_summary AS
--  SELECT ( SELECT count(*) AS count FROM qms_documents) AS total_docs,
--     ( SELECT count(*) AS count FROM qms_documents WHERE qms_documents.status::text = 'RELEASED'::text) AS released,
--     ( SELECT count(*) AS count FROM qms_documents WHERE qms_documents.status::text = 'RELEASED'::text) AS active_docs,
--     ( SELECT count(*) AS count FROM qms_documents WHERE qms_documents.status::text = 'REVIEW'::text) AS in_review,
--     ( SELECT count(*) AS count FROM qms_documents WHERE qms_documents.status::text = 'DRAFT'::text) AS draft,
--     ( SELECT count(*) AS count FROM qms_documents WHERE qms_documents.status::text = 'WITHDRAWN'::text) AS withdrawn,
--     ( SELECT count(*) AS count FROM qms_documents WHERE qms_documents.status::text = 'PLANNED'::text) AS planned,
--     ( SELECT count(*) AS count FROM qms_documents WHERE qms_documents.status::text <> ALL (ARRAY['WITHDRAWN'::character varying, 'PLANNED'::character varying]::text[])) AS total_active,
--     ( SELECT count(*) AS count FROM qms_review_calendar WHERE qms_review_calendar.urgency = 'overdue'::text) AS overdue_review,
--     ( SELECT count(*) AS count FROM qms_review_calendar WHERE qms_review_calendar.urgency = 'critical'::text) AS due_within_30d,
--     ( SELECT count(*) AS count FROM qms_ncr WHERE qms_ncr.status::text = ANY (ARRAY['OPEN'::character varying, 'CAPA_REQUIRED'::character varying]::text[])) AS ncr_open,
--     ( SELECT count(*) AS count FROM qms_ncr WHERE qms_ncr.status::text = ANY (ARRAY['CLOSED'::character varying, 'VERIFIED'::character varying]::text[])) AS ncr_closed,
--     ( SELECT count(*) AS count FROM qms_ncr_age_analysis WHERE qms_ncr_age_analysis.age_band = ANY (ARRAY['aging'::text, 'overdue'::text, 'critical'::text])) AS ncr_aged_open,
--     ( SELECT count(*) AS count FROM qms_capa WHERE qms_capa.status::text = ANY (ARRAY['OPEN'::character varying, 'IN_PROGRESS'::character varying]::text[])) AS capa_open,
--     ( SELECT count(*) AS count FROM qms_capa WHERE qms_capa.status::text = ANY (ARRAY['VERIFIED'::character varying, 'CLOSED'::character varying]::text[])) AS capa_closed,
--     ( SELECT count(*) AS count FROM qms_capa WHERE (qms_capa.status::text <> ALL (ARRAY['CLOSED'::character varying, 'VERIFIED'::character varying]::text[])) AND qms_capa.due_date < now()) AS capa_overdue,
--     ( SELECT count(*) AS count FROM qms_training_tasks WHERE qms_training_tasks.status::text = 'PENDING'::text) AS pending_training,
--     ( SELECT count(*) AS count FROM qms_training_tasks WHERE qms_training_tasks.status::text = 'PENDING'::text) AS training_pending,
--     ( SELECT count(*) AS count FROM qms_training_tasks WHERE qms_training_tasks.status::text = 'COMPLETED'::text) AS training_completed;
-- COMMIT;
