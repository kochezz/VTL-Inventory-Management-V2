-- ============================================================================
-- Migration: capture_unversioned_views
-- Date:      2026-07-21
-- ============================================================================
-- WHAT THIS IS
-- This migration is a retroactive CAPTURE, not a fix. A database-wide view
-- audit conducted on 2026-07-21 (see docs/QMS_COMPLIANCE_DASHBOARD_AUDIT.md,
-- "database-wide view provenance audit" section) found that 20 of the 29
-- views currently live in the production database have no CREATE VIEW
-- statement anywhere in this repository's history -- they exist only inside
-- the database itself, with no way to reproduce, review, or diff them from
-- git. This migration writes down their EXACT current live definitions
-- (pulled read-only via pg_get_viewdef('<name>'::regclass, true), not
-- reconstructed or cleaned up) so the schema becomes reproducible from git
-- going forward.
--
-- WHAT THIS IS NOT
-- This does not fix, improve, rename, or alter the behavior of any view.
-- Known problems (e.g. qms_compliance_summary missing columns the
-- Compliance Dashboard frontend expects; qms_dept_training_compliance's
-- compliance_percentage/completion_pct name mismatch) are deliberately
-- left exactly as they are live today. Fixing them is a separate,
-- intentionally-deferred step.
--
-- IS THIS A NO-OP AGAINST THE LIVE DATABASE?
-- Yes. Every statement below is CREATE OR REPLACE VIEW using the exact
-- definition pg_get_viewdef() returned for that view at capture time.
-- Running this migration against the live database changes nothing --
-- Postgres will replace each view with an identical definition. Its only
-- purpose is to make these 20 views' current behavior visible in git,
-- diffable in PRs, and restorable if the live database is ever rebuilt
-- from schema files.
--
-- CLASSIFICATION (preserved from the 2026-07-21 audit -- matters for
-- follow-up work; do not lose this distinction in future edits)
--   PHANTOM  -- actively queried by tracked backend code today (cited below
--              per view). If this view's shape is ever wrong, something in
--              the running application breaks or misreports.
--   ORPHANED -- no consumer found anywhere in this repo's current code or
--              git history. May be used by something outside this repo, or
--              may be dead. Safer to leave alone until an owner is found.
--
-- 10 PHANTOM views captured here: qms_compliance_summary,
--   qms_dept_training_compliance, qms_ncr_age_analysis, qms_review_calendar,
--   ipqc_compliance_summary, ipqc_pending_qa_reviews, batch_next_ipqc_stage,
--   batch_record_completion, v_hr_employee_profile, v_hr_holiday_summary
-- 10 ORPHANED views captured here: view_available_stock, v_daily_scan_stats,
--   v_product_scan_history, v_location_scan_activity, v_pending_qa_approvals,
--   v_product_bom_details, v_lab_test_summary, v_sales_summary,
--   v_sku_sales_performance, v_customer_sales_profile
--
-- NOTE ON THE SOURCE LIST: an earlier draft of this migration's scope
-- (per the audit's own Step 3 report) miscounted two views. v_hr_dashboard
-- is NOT included here -- it already has a CREATE VIEW in
-- "docs/HR Extension/vtl_hr_schema.sql" (versioned, though drifted from
-- live -- a separate, already-documented issue, not an unversioned-view
-- issue). v_product_bom_details was reclassified from PHANTOM to ORPHANED
-- after this capture step found no actual query against it anywhere in
-- tracked code (only prose mentions in old session-handoff docs) -- see its
-- note below.
--
-- This migration was NOT run against the live database. It is a new file;
-- no existing file (database/schema.sql, docs/HR Extension/vtl_hr_schema.sql,
-- or any other migration) was modified to produce it.
-- ============================================================================

-- [PHANTOM, captured 2026-07-21] Actively queried by backend/src/services/qms-service.js,
--   getComplianceDashboard() -- powers GET /qms/compliance (the QMS Compliance Dashboard). Subject
--   of the 2026-07-21 QMS Compliance Dashboard audit (docs/QMS_COMPLIANCE_DASHBOARD_AUDIT.md) --
--   this view is missing several columns the dashboard frontend expects. Captured as-is, not fixed.
CREATE OR REPLACE VIEW qms_compliance_summary AS
SELECT ( SELECT count(*) AS count
           FROM qms_documents
          WHERE qms_documents.status::text = 'RELEASED'::text) AS active_docs,
    ( SELECT count(*) AS count
           FROM qms_ncr
          WHERE qms_ncr.status::text = ANY (ARRAY['OPEN'::character varying, 'CAPA_REQUIRED'::character varying]::text[])) AS ncr_open,
    ( SELECT count(*) AS count
           FROM qms_capa
          WHERE qms_capa.status::text = ANY (ARRAY['OPEN'::character varying, 'IN_PROGRESS'::character varying]::text[])) AS capa_open,
    ( SELECT count(*) AS count
           FROM qms_capa
          WHERE qms_capa.status::text = ANY (ARRAY['VERIFIED'::character varying, 'CLOSED'::character varying]::text[])) AS capa_closed,
    ( SELECT count(*) AS count
           FROM qms_training_tasks
          WHERE qms_training_tasks.status::text = 'PENDING'::text) AS pending_training;


-- [PHANTOM, captured 2026-07-21] Actively queried by backend/src/services/qms-service.js,
--   getComplianceDashboard() -- feeds the 'Training Completion by Department' panel on the QMS
--   Compliance Dashboard. Its compliance_percentage column does not match the frontend's expected
--   completion_pct key (see audit doc). Captured as-is, not fixed.
CREATE OR REPLACE VIEW qms_dept_training_compliance AS
SELECT u.department,
    count(tt.task_id) AS total_tasks,
    count(tt.task_id) FILTER (WHERE tt.status::text = 'COMPLETED'::text) AS completed_tasks,
    count(tt.task_id) FILTER (WHERE tt.status::text = 'PENDING'::text) AS pending_tasks,
    COALESCE(round(count(tt.task_id) FILTER (WHERE tt.status::text = 'COMPLETED'::text)::numeric / NULLIF(count(tt.task_id), 0)::numeric * 100::numeric, 1), 0::numeric) AS compliance_percentage
   FROM users u
     LEFT JOIN qms_training_tasks tt ON u.user_id = tt.user_id
  WHERE u.is_active = true AND u.department IS NOT NULL
  GROUP BY u.department;


-- [PHANTOM, captured 2026-07-21] Actively queried by backend/src/services/qms-service.js,
--   getComplianceDashboard() -- feeds the NCR Age Analysis panel on the QMS Compliance Dashboard.
CREATE OR REPLACE VIEW qms_ncr_age_analysis AS
SELECT ncr_id,
    ncr_code,
    description,
    severity,
    status,
    created_at,
    EXTRACT(day FROM CURRENT_TIMESTAMP - created_at::timestamp with time zone) AS days_open,
        CASE
            WHEN status::text = ANY (ARRAY['CLOSED'::character varying, 'VERIFIED'::character varying]::text[]) THEN 'closed'::text
            WHEN EXTRACT(day FROM CURRENT_TIMESTAMP - created_at::timestamp with time zone) > 90::numeric THEN 'critical'::text
            WHEN EXTRACT(day FROM CURRENT_TIMESTAMP - created_at::timestamp with time zone) > 60::numeric THEN 'overdue'::text
            WHEN EXTRACT(day FROM CURRENT_TIMESTAMP - created_at::timestamp with time zone) > 30::numeric THEN 'aging'::text
            ELSE 'recent'::text
        END AS age_band
   FROM qms_ncr;


-- [PHANTOM, captured 2026-07-21] Actively queried by backend/src/services/qms-service.js,
--   getComplianceDashboard() and getReviewCalendar() -- feeds the Review Calendar / due-soon
--   ribbon. Verified correct against ground truth in the 2026-07-21 audit.
CREATE OR REPLACE VIEW qms_review_calendar AS
SELECT d.doc_id,
    d.doc_code,
    d.doc_name,
    d.doc_type,
    d.doc_owner AS department,
    v.version_number,
    v.review_due_date,
    EXTRACT(year FROM v.review_due_date) AS due_year,
    EXTRACT(month FROM v.review_due_date) AS due_month,
        CASE
            WHEN v.review_due_date < CURRENT_TIMESTAMP THEN 'overdue'::text
            WHEN v.review_due_date < (CURRENT_TIMESTAMP + '30 days'::interval) THEN 'critical'::text
            WHEN v.review_due_date < (CURRENT_TIMESTAMP + '90 days'::interval) THEN 'soon'::text
            ELSE 'scheduled'::text
        END AS urgency
   FROM qms_documents d
     JOIN qms_document_versions v ON d.current_version_id = v.version_id
  WHERE d.status::text = 'RELEASED'::text AND v.review_due_date IS NOT NULL;


-- [PHANTOM, captured 2026-07-21] Actively queried by backend/src/services/production-service.js,
--   getIPQCHistory() -- returns batch-level IPQC pass/fail compliance rate.
CREATE OR REPLACE VIEW ipqc_compliance_summary AS
SELECT batch_id,
    count(*) AS total_checks,
    count(*) FILTER (WHERE all_checks_passed = true) AS passed_checks,
    count(*) FILTER (WHERE all_checks_passed = false) AS failed_checks,
        CASE
            WHEN count(*) > 0 THEN round(count(*) FILTER (WHERE all_checks_passed = true)::numeric / count(*)::numeric * 100::numeric, 2)
            ELSE 0::numeric
        END AS compliance_rate,
    min(check_time) AS first_check,
    max(check_time) AS last_check
   FROM batch_ipqc_records
  GROUP BY batch_id;


-- [PHANTOM, captured 2026-07-21] Actively queried by backend/src/services/production-service.js,
--   getPendingIPQCReviews() -- lists batch IPQC records awaiting QA sign-off.
CREATE OR REPLACE VIEW ipqc_pending_qa_reviews AS
SELECT ipqc_id,
    batch_id,
    check_sequence,
    check_time,
    fill_volume_ml,
    fill_volume_within_spec,
    cap_torque_nm,
    cap_torque_within_spec,
    visual_inspection_pass,
    visual_inspection_notes,
    label_position_correct,
    label_position_notes,
    coding_legible,
    coding_notes,
    all_checks_passed,
    operator_id,
    operator_name,
    notes,
    created_at,
    updated_at,
    qa_status,
    qa_reviewed_by,
    qa_reviewed_by_name,
    qa_reviewed_at,
    qa_rejection_reason
   FROM batch_ipqc_records
  WHERE qa_status::text = 'pending_qa_review'::text;


-- [PHANTOM, captured 2026-07-21] Actively queried by backend/src/services/production-service.js,
--   getNextIPQCStage() -- determines the next unapproved IPQC stage for a batch.
CREATE OR REPLACE VIEW batch_next_ipqc_stage AS
WITH latest_approved_stage AS (
         SELECT pb.batch_id,
            pb.product_id,
            pb.batch_number,
            COALESCE(max(ipqc.stage_sequence), 0) AS current_max_sequence
           FROM production_batches pb
             LEFT JOIN batch_ipqc_records ipqc ON pb.batch_id = ipqc.batch_id AND ipqc.qa_status::text = 'qa_approved'::text
          GROUP BY pb.batch_id, pb.product_id, pb.batch_number
        )
 SELECT las.batch_id,
    las.product_id,
    las.batch_number,
    las.current_max_sequence + 1 AS next_stage_sequence,
    isd.stage_id AS next_stage_id,
    isd.stage_name AS next_stage_name,
    isd.stage_code AS next_stage_code,
    isd.stage_category AS next_stage_category
   FROM latest_approved_stage las
     LEFT JOIN ipqc_stage_definitions isd ON las.product_id = isd.product_id AND isd.stage_sequence = (las.current_max_sequence + 1);


-- [PHANTOM, captured 2026-07-21] Actively queried by backend/src/services/production-service.js,
--   getBatchById() and getBatchRecordCompletion() -- reports stage-completion percentage for a
--   production batch record.
CREATE OR REPLACE VIEW batch_record_completion AS
SELECT pb.batch_id,
    pb.batch_number,
    pb.product_name,
    count(DISTINCT isd.stage_id) AS total_stages,
    count(DISTINCT
        CASE
            WHEN ipqc.qa_status::text = 'qa_approved'::text THEN ipqc.stage_id
            ELSE NULL::uuid
        END) AS completed_stages,
    round(count(DISTINCT
        CASE
            WHEN ipqc.qa_status::text = 'qa_approved'::text THEN ipqc.stage_id
            ELSE NULL::uuid
        END)::numeric / NULLIF(count(DISTINCT isd.stage_id), 0)::numeric * 100::numeric, 2) AS completion_percentage,
        CASE
            WHEN count(DISTINCT isd.stage_id) = count(DISTINCT
            CASE
                WHEN ipqc.qa_status::text = 'qa_approved'::text THEN ipqc.stage_id
                ELSE NULL::uuid
            END) AND count(DISTINCT isd.stage_id) > 0 THEN true
            ELSE false
        END AS all_stages_complete
   FROM production_batches pb
     LEFT JOIN ipqc_stage_definitions isd ON pb.product_id = isd.product_id AND isd.is_active = true
     LEFT JOIN batch_ipqc_records ipqc ON pb.batch_id = ipqc.batch_id AND ipqc.stage_id = isd.stage_id
  GROUP BY pb.batch_id, pb.batch_number, pb.product_name;


-- [PHANTOM, captured 2026-07-21] Actively queried by backend/src/services/hr-service.js,
--   getAllEmployees() and getEmployeeByUserId() -- the primary per-employee HR profile read model.
--   Note: 5 sibling HR views (v_hr_dashboard, v_hr_onboarding_tracker, v_hr_sop_compliance,
--   v_hr_probation_schedule, v_hr_compliance_snapshot) ARE versioned in docs/HR
--   Extension/vtl_hr_schema.sql -- this one and v_hr_holiday_summary were never added to that file
--   despite being built in the same session (commit 22cec32, 2026-05-11).
CREATE OR REPLACE VIEW v_hr_employee_profile AS
SELECT u.user_id,
    u.employee_number,
    u.full_name,
    u.preferred_name,
    u.email,
    u.photo_url,
    u.date_of_birth,
    u.gender,
    u.nationality,
    u.national_id,
    u.home_address,
    u.personal_email,
    u.phone_number,
    u.emergency_contacts,
    u.job_title,
    u.department,
    u.reports_to AS reports_to_name,
    u.employment_date,
    u.employment_status,
    u.employment_type,
    u.role,
    u.badge_number,
    u.is_active,
    u.last_login,
    d.name AS department_structured,
    mgr.full_name AS manager_name,
    e.hr_status,
    e.contract_type,
    e.probation_end_date,
    e.probation_extended_to,
    COALESCE(e.probation_extended_to, e.probation_end_date) AS effective_probation_end,
    e.confirmation_date,
    e.exit_date,
    e.onboarding_complete,
    e.basic_salary_zmw,
    e.salary_effective_date,
    COALESCE(e.probation_extended_to, e.probation_end_date) - CURRENT_DATE AS days_to_probation_end,
        CASE
            WHEN e.onboarding_complete = true THEN 100
            ELSE COALESCE(round(100.0 * count(op.user_id) FILTER (WHERE op.status = ANY (ARRAY['completed'::hr_module_status, 'not_applicable'::hr_module_status]))::numeric / NULLIF(count(op.user_id), 0)::numeric, 0)::integer, 0)
        END AS onboarding_pct,
    (EXISTS ( SELECT 1
           FROM hr_pips p
          WHERE p.user_id = u.user_id AND p.is_active)) AS has_active_pip,
    ( SELECT r.outcome
           FROM hr_reviews r
          WHERE r.user_id = u.user_id
          ORDER BY r.review_date DESC
         LIMIT 1) AS latest_review_outcome
   FROM users u
     LEFT JOIN hr_employees e ON e.user_id = u.user_id
     LEFT JOIN hr_departments d ON d.id = e.department_id
     LEFT JOIN users mgr ON mgr.user_id = e.reports_to_user_id
     LEFT JOIN hr_onboarding_progress op ON op.user_id = u.user_id
  WHERE u.is_active = true
  GROUP BY u.user_id, u.employee_number, u.full_name, u.preferred_name, u.email, u.photo_url, u.date_of_birth, u.gender, u.nationality, u.national_id, u.home_address, u.personal_email, u.phone_number, u.emergency_contacts, u.job_title, u.department, u.reports_to, u.employment_date, u.employment_status, u.employment_type, u.role, u.badge_number, u.is_active, u.last_login, d.name, mgr.full_name, e.hr_status, e.contract_type, e.probation_end_date, e.probation_extended_to, e.confirmation_date, e.exit_date, e.onboarding_complete, e.basic_salary_zmw, e.salary_effective_date;


-- [PHANTOM, captured 2026-07-21] Actively queried by backend/src/services/hr-service.js,
--   getLeaveBalance() -- per-employee annual/sick leave balance and current-year approved/pending
--   day counts.
CREATE OR REPLACE VIEW v_hr_holiday_summary AS
SELECT u.user_id,
    u.full_name,
    u.department,
    lb.leave_year,
    lb.annual_entitlement,
    lb.annual_taken,
    lb.annual_carried_over,
    lb.annual_balance,
    lb.sick_entitlement,
    lb.sick_taken,
    lb.sick_balance,
    COALESCE(( SELECT sum(hr.days_requested) AS sum
           FROM holiday_requests hr
          WHERE hr.user_id = u.user_id AND hr.status::text = 'Approved'::text AND EXTRACT(year FROM hr.start_date) = lb.leave_year::numeric), 0::bigint) AS approved_days_from_requests,
    COALESCE(( SELECT sum(hr.days_requested) AS sum
           FROM holiday_requests hr
          WHERE hr.user_id = u.user_id AND hr.status::text = 'Pending'::text AND EXTRACT(year FROM hr.start_date) = lb.leave_year::numeric), 0::bigint) AS pending_days
   FROM users u
     JOIN hr_leave_balances lb ON lb.user_id = u.user_id
  WHERE u.is_active = true;


-- [ORPHANED, captured 2026-07-21] No consumer found anywhere in this repo's current code or git
--   history. The README lists this as one of 5 original Phase-1 views alongside
--   v_current_stock/v_low_stock_items/v_expiring_batches/v_transaction_history -- that claim is
--   INCORRECT: unlike those 4, this view has zero presence in database/schema.sql or anywhere else
--   in version control (confirmed via the 2026-07-21 audit).
CREATE OR REPLACE VIEW view_available_stock AS
SELECT i.inventory_id,
    i.product_id,
    i.location_id,
    i.batch_id,
    i.quantity_on_hand,
    i.quantity_allocated,
    i.quantity_available,
    i.uom,
    i.last_counted_date,
    i.last_counted_by,
    i.created_at,
    i.updated_at
   FROM inventory i
     JOIN batches b ON i.batch_id = b.batch_id
  WHERE b.qc_status::text = 'approved'::text;


-- [ORPHANED, captured 2026-07-21] No consumer found anywhere in this repo's current code or git
--   history. Live only -- presumably queried by something outside this repository (BI tool, script,
--   or another service).
CREATE OR REPLACE VIEW v_daily_scan_stats AS
SELECT date(scanned_at) AS scan_date,
    scan_type,
    scan_action,
    scan_result,
    count(*) AS total_scans,
    count(DISTINCT scanned_by) AS unique_users,
    avg(scan_duration_ms) AS avg_scan_time_ms,
    avg(scan_quality_score) AS avg_quality_score,
    count(
        CASE
            WHEN scan_result::text = 'success'::text THEN 1
            ELSE NULL::integer
        END) AS successful_scans,
    count(
        CASE
            WHEN scan_result::text = 'failed'::text THEN 1
            ELSE NULL::integer
        END) AS failed_scans
   FROM barcode_scans
  WHERE scanned_at >= (CURRENT_DATE - '30 days'::interval)
  GROUP BY (date(scanned_at)), scan_type, scan_action, scan_result
  ORDER BY (date(scanned_at)) DESC;


-- [ORPHANED, captured 2026-07-21] No consumer found anywhere in this repo's current code or git
--   history. Live only.
CREATE OR REPLACE VIEW v_product_scan_history AS
SELECT bs.scan_id,
    bs.scanned_at,
    bs.scan_action,
    bs.scan_result,
    bs.scan_duration_ms,
    p.sku,
    p.product_name,
    p.barcode_data,
    u.full_name AS scanned_by_name,
    u.email AS scanned_by_email,
    wl.location_name,
    bs.device_type,
    bs.error_message
   FROM barcode_scans bs
     LEFT JOIN products p ON bs.product_id = p.product_id
     LEFT JOIN users u ON bs.scanned_by = u.user_id
     LEFT JOIN warehouse_locations wl ON bs.location_id = wl.location_id
  WHERE bs.scan_type::text = 'product'::text
  ORDER BY bs.scanned_at DESC;


-- [ORPHANED, captured 2026-07-21] No consumer found anywhere in this repo's current code or git
--   history. Live only.
CREATE OR REPLACE VIEW v_location_scan_activity AS
SELECT wl.location_id,
    wl.location_name,
    wl.location_barcode,
    count(bs.scan_id) AS total_scans,
    count(
        CASE
            WHEN bs.scan_result::text = 'success'::text THEN 1
            ELSE NULL::integer
        END) AS successful_scans,
    max(bs.scanned_at) AS last_scanned_at,
    count(DISTINCT bs.scanned_by) AS unique_scanners
   FROM warehouse_locations wl
     LEFT JOIN barcode_scans bs ON wl.location_id = bs.location_id
  WHERE bs.scanned_at >= (CURRENT_DATE - '30 days'::interval)
  GROUP BY wl.location_id, wl.location_name, wl.location_barcode;


-- [ORPHANED, captured 2026-07-21] No consumer found anywhere in this repo's current code or git
--   history. Live only.
CREATE OR REPLACE VIEW v_pending_qa_approvals AS
SELECT g.gate_id,
    g.batch_id,
    b.batch_number,
    b.product_name,
    g.gate_number,
    g.gate_name,
    g.required_role,
    g.created_at,
    EXTRACT(epoch FROM now() - g.created_at::timestamp with time zone) / 60::numeric AS minutes_pending,
    b.line_supervisor_name,
    b.created_by_name
   FROM batch_qa_gates g
     JOIN production_batches b ON g.batch_id = b.batch_id
  WHERE g.status::text = 'pending'::text
  ORDER BY g.created_at;


-- [ORPHANED, captured 2026-07-21] RECLASSIFIED during this capture: the 2026-07-21 audit's Step 3
--   report initially grouped this with the production-service.js 'phantom' views by association,
--   but a direct check found no actual query against it anywhere in current tracked code -- only
--   prose mentions in docs/06_Feb_COMPLETE_SESSION_HANDOFF.md and
--   docs/FEB_COMPREHENSIVE_PROJECT_SUMMARY.md describing it as a 'helper view'. No live consumer
--   confirmed; treated as orphaned.
CREATE OR REPLACE VIEW v_product_bom_details AS
SELECT bom.bom_id,
    bom.finished_product_id,
    fp.sku AS finished_product_sku,
    fp.product_name AS finished_product_name,
    bom.component_product_id,
    cp.sku AS component_sku,
    cp.product_name AS component_name,
    bom.component_type,
    bom.quantity_per_unit,
    bom.is_active,
    COALESCE(sum(inv.quantity_on_hand), 0::numeric) AS total_stock_available,
    count(DISTINCT inv.location_id) FILTER (WHERE inv.quantity_on_hand > 0::numeric) AS locations_with_stock,
    bom.created_at,
    bom.updated_at
   FROM product_bom bom
     JOIN products fp ON bom.finished_product_id = fp.product_id
     JOIN products cp ON bom.component_product_id = cp.product_id
     LEFT JOIN inventory inv ON cp.product_id = inv.product_id
  WHERE bom.is_active = true
  GROUP BY bom.bom_id, bom.finished_product_id, fp.sku, fp.product_name, bom.component_product_id, cp.sku, cp.product_name, bom.component_type, bom.quantity_per_unit, bom.is_active, bom.created_at, bom.updated_at;


-- [ORPHANED, captured 2026-07-21] No consumer found anywhere in this repo's current code or git
--   history. Live only.
CREATE OR REPLACE VIEW v_lab_test_summary AS
SELECT lwt.test_id,
    lwt.test_number,
    lwt.test_date,
    lwt.shift,
    lwt.overall_status,
    lwt.certificate_number,
    lwt.pdf_url,
    lwt.ro_system_reference,
    lwt.equipment_calibration_ref,
    lwt.notes,
    lwt.created_at,
    lwt.submitted_at,
    lwt.approved_at,
    analyst.full_name AS analyst_name,
    analyst.employee_id AS analyst_employee_id,
    supervisor.full_name AS supervisor_name,
    manager.full_name AS manager_name,
    pb.batch_number,
    count(ltp.param_id) AS total_params,
    count(
        CASE
            WHEN ltp.status::text = 'pass'::text THEN 1
            ELSE NULL::integer
        END) AS params_passed,
    count(
        CASE
            WHEN ltp.status::text = 'fail'::text THEN 1
            ELSE NULL::integer
        END) AS params_failed,
    count(
        CASE
            WHEN ltp.status::text = 'warning'::text THEN 1
            ELSE NULL::integer
        END) AS params_warning,
        CASE
            WHEN lwt.overall_status::text = 'pass'::text THEN true
            WHEN lwt.overall_status::text = 'conditional_pass'::text THEN true
            ELSE false
        END AS is_valid_for_production
   FROM lab_water_tests lwt
     JOIN users analyst ON lwt.analyst_id = analyst.user_id
     LEFT JOIN users supervisor ON lwt.qa_supervisor_id = supervisor.user_id
     LEFT JOIN users manager ON lwt.qa_manager_id = manager.user_id
     LEFT JOIN production_batches pb ON lwt.batch_id = pb.batch_id
     LEFT JOIN lab_test_parameters ltp ON lwt.test_id = ltp.test_id
  GROUP BY lwt.test_id, lwt.test_number, lwt.test_date, lwt.shift, lwt.overall_status, lwt.certificate_number, lwt.pdf_url, lwt.ro_system_reference, lwt.equipment_calibration_ref, lwt.notes, lwt.created_at, lwt.submitted_at, lwt.approved_at, analyst.full_name, analyst.employee_id, supervisor.full_name, manager.full_name, pb.batch_number;


-- [ORPHANED, captured 2026-07-21] No consumer found anywhere in this repo's current code or git
--   history. Live only.
CREATE OR REPLACE VIEW v_sales_summary AS
SELECT date(transaction_date) AS sale_date,
    count(*) AS transaction_count,
    sum(total_amount) AS total_revenue,
    avg(total_amount) AS avg_transaction_value,
    sum(order_discount_amount) AS total_discounts,
    count(DISTINCT customer_id) AS unique_customers,
    sum(
        CASE
            WHEN payment_method::text = 'cash'::text THEN cash_amount
            ELSE 0::numeric
        END) AS cash_collected,
    sum(
        CASE
            WHEN payment_method::text = ANY (ARRAY['mobile'::character varying, 'mixed'::character varying]::text[]) THEN mobile_amount
            ELSE 0::numeric
        END) AS mobile_collected,
    sum(
        CASE
            WHEN payment_method::text = ANY (ARRAY['card'::character varying, 'mixed'::character varying]::text[]) THEN card_amount
            ELSE 0::numeric
        END) AS card_collected
   FROM sales_transactions st
  WHERE status::text = 'completed'::text
  GROUP BY (date(transaction_date))
  ORDER BY (date(transaction_date)) DESC;


-- [ORPHANED, captured 2026-07-21] No consumer found anywhere in this repo's current code or git
--   history. Live only.
CREATE OR REPLACE VIEW v_sku_sales_performance AS
SELECT p.sku,
    p.product_name,
    sum(stl.quantity) AS units_sold,
    sum(stl.line_total) AS revenue,
    avg(stl.unit_price) AS avg_selling_price,
    sum(stl.line_discount) AS total_discounts,
    count(DISTINCT stl.transaction_id) AS transaction_count
   FROM sales_transaction_lines stl
     JOIN products p ON stl.product_id = p.product_id
     JOIN sales_transactions st ON stl.transaction_id = st.transaction_id
  WHERE st.status::text = 'completed'::text
  GROUP BY p.product_id, p.sku, p.product_name
  ORDER BY (sum(stl.line_total)) DESC;


-- [ORPHANED, captured 2026-07-21] No consumer found anywhere in this repo's current code or git
--   history. Live only.
CREATE OR REPLACE VIEW v_customer_sales_profile AS
SELECT c.customer_id,
    c.vtl_customer_id,
    c.trading_name,
    c.tier,
    count(st.transaction_id) AS total_transactions,
    sum(st.total_amount) AS lifetime_value,
    avg(st.total_amount) AS avg_order_value,
    max(st.transaction_date) AS last_purchase_date,
    min(st.transaction_date) AS first_purchase_date
   FROM customers c
     JOIN sales_transactions st ON c.customer_id = st.customer_id
  WHERE st.status::text = 'completed'::text
  GROUP BY c.customer_id, c.vtl_customer_id, c.trading_name, c.tier
  ORDER BY (sum(st.total_amount)) DESC;


