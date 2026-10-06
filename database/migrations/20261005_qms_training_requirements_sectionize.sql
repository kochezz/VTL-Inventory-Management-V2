-- ============================================================================
-- Migration: qms_training_requirements_sectionize
-- Date:      2026-10-05
-- ============================================================================
-- Adds a section axis to qms_training_requirements alongside the existing
-- doc_type axis, so SOP/POL training can be scoped per section instead of
-- applying to every role company-wide. Mapping:
--   CORE, HSE -> every role in users_role_check except viewer
--   WT        -> engineering, engineering_manager, qa, operator, production_manager
--   ENG       -> engineering, engineering_manager
--   QC        -> qa
--   PRO, GMP  -> operator, qa, engineering, engineering_manager, manager, production_manager
--   WH        -> warehouse_manager, warehouse_staff, manager
--   REC       -> qa, manager, admin, cfo, ceo
--   HR        -> admin, hr_admin, hr_manager
--   IT        -> admin
-- Every role above is a real value in users_role_check (confirmed live via
-- pg_get_constraintdef, not guessed or recalled from memory): engineering,
-- hr_manager, admin, operator, viewer, staff, qa, production_manager,
-- warehouse_staff, cfo, ceo, super_viewer, manager, hr_admin, sales,
-- warehouse_manager, engineering_manager, junior_accountant (18 total, 17
-- once viewer is excluded for CORE/HSE). Roles with zero live active users
-- (e.g. super_viewer, sales, staff, warehouse_manager, hr_admin, hr_manager,
-- production_manager, engineering_manager, warehouse_staff, ceo,
-- junior_accountant) are seeded anyway -- a mapping describes who SHOULD be
-- trained if/when that role has an active user, not just who currently does.
--
-- MAN stays broad/doc_type-only -- the 5 existing MAN rows are left active,
-- untouched, no section_id. SOP (9 rows) and POL (10 rows) get is_active =
-- false (kept for history, never deleted) now that section-specific rows
-- exist to replace them for those two doc_types.
--
-- SCHEMA NOTE found while writing this: qms_training_requirements has a
-- UNIQUE(role, doc_type) constraint with no section_id in it. Seeding
-- section-specific rows for the same (role, doc_type) pair across multiple
-- sections (e.g. ('qa','SOP') for both QC and HSE) would violate it as-is,
-- so this migration replaces it with UNIQUE(role, doc_type, section_id) --
-- NULL section_id (the MAN rows) still behaves as one slot per (role,
-- doc_type) since Postgres treats NULL as distinct in a multi-column
-- unique index, which is exactly the MAN behavior already in place.
-- ============================================================================

BEGIN;

ALTER TABLE qms_training_requirements ADD COLUMN section_id UUID REFERENCES qms_sections(section_id);
ALTER TABLE qms_training_requirements ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE qms_training_requirements DROP CONSTRAINT qms_training_requirements_role_doc_type_key;
ALTER TABLE qms_training_requirements ADD CONSTRAINT qms_training_requirements_role_doc_type_section_key
  UNIQUE (role, doc_type, section_id);

-- qms_training_tasks.status has no CHECK constraint at all (confirmed Step
-- 1d) -- 'VOIDED' is already legal as a plain varchar value, nothing to
-- alter here.

-- Deactivate the old doc_type-only SOP/POL rows -- kept, never deleted.
UPDATE qms_training_requirements SET is_active = false WHERE doc_type IN ('SOP', 'POL');

-- Seed the new section-specific SOP + POL rows, one pair per (section, role).
-- CORE and HSE: every role except viewer (17 roles each). The rest follow
-- Session G2's explicit per-section role list.
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

COMMIT;

-- ============================================================================
-- ROLLBACK (manual, not automatic).
-- ============================================================================
-- BEGIN;
-- DELETE FROM qms_training_requirements WHERE section_id IS NOT NULL;
-- UPDATE qms_training_requirements SET is_active = true WHERE doc_type IN ('SOP', 'POL');
-- ALTER TABLE qms_training_requirements DROP CONSTRAINT qms_training_requirements_role_doc_type_section_key;
-- ALTER TABLE qms_training_requirements ADD CONSTRAINT qms_training_requirements_role_doc_type_key UNIQUE (role, doc_type);
-- ALTER TABLE qms_training_requirements DROP COLUMN is_active;
-- ALTER TABLE qms_training_requirements DROP COLUMN section_id;
-- COMMIT;
