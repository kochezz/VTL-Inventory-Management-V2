-- ============================================================================
-- Migration: fix_qms_compliance_views
-- Date:      2026-07-21
-- ============================================================================
-- WHAT THIS FIXES
-- The QMS Compliance Dashboard (GET /qms/compliance, frontend
-- app/qms/compliance/page.tsx) reads a "summary" object that this codebase
-- expects to carry 17+ fields (in_review, overdue_review, total_docs,
-- released, training_pending, etc). The live qms_compliance_summary view
-- only ever returned 5 columns (active_docs, ncr_open, capa_open,
-- capa_closed, pending_training), so every other field silently rendered as
-- 0 (or, via divide-by-zero fallbacks in the frontend, a misleading 100%).
-- Full root-cause writeup: docs/QMS_COMPLIANCE_DASHBOARD_AUDIT.md.
--
-- This migration replaces qms_compliance_summary with a corrected
-- definition that adds every field the dashboard actually reads, and fixes
-- qms_dept_training_compliance's compliance_percentage/completion_pct name
-- mismatch (the dashboard's department-training panel had the same bug).
--
-- WHY DROP + CREATE INSTEAD OF CREATE OR REPLACE VIEW
-- A prior version of this migration used CREATE OR REPLACE VIEW for both
-- statements and was proven, against the live database, to fail on both:
--   ERROR: cannot change name of view column "active_docs" to "total_docs"
--   ERROR: cannot change name of view column "compliance_percentage" to "completion_pct"
-- Postgres only allows CREATE OR REPLACE VIEW to append brand-new columns
-- at the end, while keeping every existing column at its original name and
-- position. qms_compliance_summary needed new columns inserted before the
-- old first column, and qms_dept_training_compliance needed an existing
-- column renamed -- neither is possible without DROP + CREATE (or ALTER
-- VIEW ... RENAME COLUMN, which doesn't cover the reordering case either).
--
-- Before writing this version, dependency and privilege safety was checked
-- live against the database:
--   * pg_depend: zero other views/rules depend on qms_compliance_summary or
--     qms_dept_training_compliance (0 rows returned).
--   * information_schema.table_privileges: only the owning role
--     (neondb_owner) has any privileges on either view -- these are the
--     implicit owner grants, not separate GRANTs that a DROP+CREATE (which
--     produces a new object with fresh owner-default privileges) could lose.
-- Both DROP+CREATE pairs are wrapped in a single BEGIN...COMMIT below, so
-- either both views are replaced or neither is -- there is no window where
-- one view is dropped and not yet recreated.
--
-- DESIGN NOTES (unchanged from the previous version of this migration)
-- * overdue_review and due_within_30d deliberately do NOT re-derive the
--   review-due-date bucket math. They are scalar subqueries against
--   qms_review_calendar's already-correct, already-audited `urgency` CASE
--   logic (urgency='overdue' / urgency='critical' respectively), so this
--   view can never drift out of sync with the Review Calendar page's
--   definition of "overdue"/"due soon" for a document review.
-- * ncr_aged_open reuses qms_ncr_age_analysis's age_band classification for
--   the same reason -- one place defines "how old is too old", not two.
-- * capa_overdue reuses the exact same predicate already used elsewhere in
--   this codebase (backend/src/services/mobile-service.js
--   getDashboardSummary(), "overdue_capas": status NOT IN ('CLOSED',
--   'VERIFIED') AND due_date < NOW()) for consistency with an existing,
--   already-shipped definition of CAPA overdue.
-- * active_docs is kept (as an exact duplicate of the new `released` column)
--   purely for backward compatibility. A full-codebase grep confirmed
--   nothing currently reads active_docs from this view, so this is
--   precautionary, not load-bearing -- safe to drop in a future cleanup.
-- * pending_training is kept unchanged (also just a duplicate of the new
--   `training_pending` column). A full-codebase grep confirmed the *only*
--   places reading a field literally named "pending_training" are
--   dashboard-service.js / dashboard-routes.js / frontend/app/dashboard --
--   and that field comes from a completely separate, unrelated per-user
--   query in dashboard-service.js, NOT from this view. So renaming
--   pending_training outright here would have been safe too, but it costs
--   nothing to keep both names and it removes any doubt.
-- * qms_dept_training_compliance: compliance_percentage -> completion_pct
--   to match the sole consumer, frontend/app/qms/compliance/page.tsx:262
--   (`dept.completion_pct`). A full-codebase grep confirmed nothing else
--   reads "compliance_percentage" from this view, so this is a plain
--   rename with no other consumer to preserve compatibility for. Logic is
--   otherwise byte-identical to the previous definition.
--
-- VERIFICATION
-- Every column in qms_compliance_summary was proven correct by running its
-- SELECT body as a plain read-only ad-hoc query (no CREATE) against the
-- live database on 2026-07-21 and cross-checking every value against
-- independently written ground-truth COUNT queries, including a dedicated
-- pass on ncr_closed and capa_overdue specifically. See
-- docs/QMS_COMPLIANCE_DASHBOARD_AUDIT.md and the QMS stats consolidation
-- report for the full actual-vs-expected tables.
-- ============================================================================

BEGIN;

-- qms_compliance_summary: corrected -- adds every field the Compliance
-- Dashboard (getComplianceDashboard() in qms-service.js) actually reads.
-- See design notes above for overdue_review/due_within_30d/ncr_aged_open/
-- capa_overdue sourcing and for why active_docs/pending_training are kept.
DROP VIEW qms_compliance_summary;

CREATE VIEW qms_compliance_summary AS
SELECT
    (SELECT COUNT(*) FROM qms_documents)                                    AS total_docs,
    (SELECT COUNT(*) FROM qms_documents WHERE status = 'RELEASED')          AS released,
    (SELECT COUNT(*) FROM qms_documents WHERE status = 'RELEASED')          AS active_docs,
    (SELECT COUNT(*) FROM qms_documents WHERE status = 'REVIEW')            AS in_review,
    (SELECT COUNT(*) FROM qms_documents WHERE status = 'DRAFT')             AS draft,
    (SELECT COUNT(*) FROM qms_documents WHERE status = 'WITHDRAWN')         AS withdrawn,
    (SELECT COUNT(*) FROM qms_documents WHERE status = 'PLANNED')           AS planned,
    (SELECT COUNT(*) FROM qms_documents WHERE status NOT IN ('WITHDRAWN', 'PLANNED')) AS total_active,

    (SELECT COUNT(*) FROM qms_review_calendar WHERE urgency = 'overdue')    AS overdue_review,
    (SELECT COUNT(*) FROM qms_review_calendar WHERE urgency = 'critical')   AS due_within_30d,

    (SELECT COUNT(*) FROM qms_ncr WHERE status IN ('OPEN', 'CAPA_REQUIRED')) AS ncr_open,
    (SELECT COUNT(*) FROM qms_ncr WHERE status IN ('CLOSED', 'VERIFIED'))    AS ncr_closed,
    (SELECT COUNT(*) FROM qms_ncr_age_analysis WHERE age_band IN ('aging', 'overdue', 'critical')) AS ncr_aged_open,

    (SELECT COUNT(*) FROM qms_capa WHERE status IN ('OPEN', 'IN_PROGRESS'))  AS capa_open,
    (SELECT COUNT(*) FROM qms_capa WHERE status IN ('VERIFIED', 'CLOSED'))   AS capa_closed,
    (SELECT COUNT(*) FROM qms_capa WHERE status NOT IN ('CLOSED', 'VERIFIED') AND due_date < NOW()) AS capa_overdue,

    (SELECT COUNT(*) FROM qms_training_tasks WHERE status = 'PENDING')     AS pending_training,
    (SELECT COUNT(*) FROM qms_training_tasks WHERE status = 'PENDING')     AS training_pending,
    (SELECT COUNT(*) FROM qms_training_tasks WHERE status = 'COMPLETED')   AS training_completed;


-- qms_dept_training_compliance: rename compliance_percentage -> completion_pct.
-- See design notes above.
DROP VIEW qms_dept_training_compliance;

CREATE VIEW qms_dept_training_compliance AS
SELECT u.department,
    count(tt.task_id) AS total_tasks,
    count(tt.task_id) FILTER (WHERE tt.status::text = 'COMPLETED'::text) AS completed_tasks,
    count(tt.task_id) FILTER (WHERE tt.status::text = 'PENDING'::text) AS pending_tasks,
    COALESCE(round(count(tt.task_id) FILTER (WHERE tt.status::text = 'COMPLETED'::text)::numeric / NULLIF(count(tt.task_id), 0)::numeric * 100::numeric, 1), 0::numeric) AS completion_pct
   FROM users u
     LEFT JOIN qms_training_tasks tt ON u.user_id = tt.user_id
  WHERE u.is_active = true AND u.department IS NOT NULL
  GROUP BY u.department;

COMMIT;
