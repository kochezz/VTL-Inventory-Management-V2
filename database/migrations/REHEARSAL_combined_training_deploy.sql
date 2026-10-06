-- ============================================================================
-- REHEARSAL SCRIPT -- Session L, Step 4
-- NOT a migration file in its own right -- combines the two real migrations
-- (20261005_qms_training_requirements_sectionize.sql and
-- 20261006_qms_dept_compliance_exclude_voided.sql) into ONE transaction, for
-- a single rehearsal run against a fresh Neon branch created from
-- production. The two files remain the actual, separately-tracked
-- migrations; this is a one-time convenience wrapper so schema + seed + view
-- change land together or not at all.
--
-- Usage: run this file's contents against the fresh rehearsal branch, then
-- run a dry-run reconcile (see REHEARSAL_dry_run_request.md) and compare
-- its to_create/to_void counts against this branch's own 74/34 baseline.
-- ============================================================================

BEGIN;

-- ── From 20261005_qms_training_requirements_sectionize.sql ──────────────────

ALTER TABLE qms_training_requirements ADD COLUMN section_id UUID REFERENCES qms_sections(section_id);
ALTER TABLE qms_training_requirements ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE qms_training_requirements DROP CONSTRAINT qms_training_requirements_role_doc_type_key;
ALTER TABLE qms_training_requirements ADD CONSTRAINT qms_training_requirements_role_doc_type_section_key
  UNIQUE (role, doc_type, section_id);

UPDATE qms_training_requirements SET is_active = false WHERE doc_type IN ('SOP', 'POL');

INSERT INTO qms_training_requirements (role, doc_type, section_id, is_active)
SELECT role, doc_type, section_id, true FROM (VALUES
  ('engineering',         'CORE'),
  ('hr_manager',          'CORE'),
  ('admin',               'CORE'),
  ('operator',            'CORE'),
  ('staff',               'CORE'),
  ('qa',                  'CORE'),
  ('production_manager',  'CORE'),
  ('warehouse_staff',     'CORE'),
  ('cfo',                 'CORE'),
  ('ceo',                 'CORE'),
  ('super_viewer',        'CORE'),
  ('manager',             'CORE'),
  ('hr_admin',            'CORE'),
  ('sales',               'CORE'),
  ('warehouse_manager',   'CORE'),
  ('engineering_manager', 'CORE'),
  ('junior_accountant',   'CORE'),
  ('engineering',         'HSE'),
  ('hr_manager',          'HSE'),
  ('admin',               'HSE'),
  ('operator',            'HSE'),
  ('staff',               'HSE'),
  ('qa',                  'HSE'),
  ('production_manager',  'HSE'),
  ('warehouse_staff',     'HSE'),
  ('cfo',                 'HSE'),
  ('ceo',                 'HSE'),
  ('super_viewer',        'HSE'),
  ('manager',             'HSE'),
  ('hr_admin',            'HSE'),
  ('sales',               'HSE'),
  ('warehouse_manager',   'HSE'),
  ('engineering_manager', 'HSE'),
  ('junior_accountant',   'HSE'),
  ('engineering',         'WT'),
  ('engineering_manager', 'WT'),
  ('qa',                  'WT'),
  ('operator',            'WT'),
  ('production_manager',  'WT'),
  ('engineering',         'ENG'),
  ('engineering_manager', 'ENG'),
  ('qa',                  'QC'),
  ('operator',            'PRO'),
  ('qa',                  'PRO'),
  ('engineering',         'PRO'),
  ('engineering_manager', 'PRO'),
  ('manager',             'PRO'),
  ('production_manager',  'PRO'),
  ('operator',            'GMP'),
  ('qa',                  'GMP'),
  ('engineering',         'GMP'),
  ('engineering_manager', 'GMP'),
  ('manager',             'GMP'),
  ('production_manager',  'GMP'),
  ('warehouse_manager',   'WH'),
  ('warehouse_staff',     'WH'),
  ('manager',             'WH'),
  ('qa',                  'REC'),
  ('manager',             'REC'),
  ('admin',               'REC'),
  ('cfo',                 'REC'),
  ('ceo',                 'REC'),
  ('admin',               'HR'),
  ('hr_admin',            'HR'),
  ('hr_manager',          'HR'),
  ('admin',               'IT')
) AS mapping(role, section_code)
CROSS JOIN LATERAL (SELECT 'SOP'::varchar AS doc_type UNION ALL SELECT 'POL') dt
JOIN qms_sections s ON s.section_code = mapping.section_code;

-- ── From 20261006_qms_dept_compliance_exclude_voided.sql ────────────────────
-- CREATE OR REPLACE VIEW, not DROP+CREATE: confirmed (Session L, Step 5)
-- against production's live definition that no column name, type, or order
-- changes -- only count-reset to five identical columns
-- (department, total_tasks, completed_tasks, pending_tasks, completion_pct).

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
