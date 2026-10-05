-- ============================================================================
-- Migration: qms_training_requirements_sectionize
-- Date:      2026-10-05
-- ============================================================================
-- Session G, Step 2. Applied to the Neon TEST branch only (not production --
-- that's a separate, later decision). Adds the section axis to
-- qms_training_requirements alongside the existing doc_type axis, per the
-- Session B proposal (used as-is, per explicit instruction, since the
-- "approved mapping table" placeholder in the Session G prompt was never
-- filled in):
--   CORE -> admin, qa, manager, cfo
--   WT   -> operator
--   PRO  -> operator
--   QC   -> qa
--   GMP  -> operator, qa
--   ENG  -> engineering
--   WH   -> warehouse_manager
--   HSE  -> admin, manager, qa, engineering
--   REC  -> qa, manager, admin, cfo
--   HR   -> admin
--   IT   -> admin
-- Every role above is a real value in users_role_check (confirmed, not
-- guessed): engineering, hr_manager, admin, operator, viewer, staff, qa,
-- production_manager, warehouse_staff, cfo, ceo, super_viewer, manager,
-- hr_admin, sales, warehouse_manager, engineering_manager, junior_accountant.
-- warehouse_manager/hr_admin/hr_manager/production_manager/engineering_manager/
-- warehouse_staff currently have zero live active users -- seeded anyway,
-- per instruction ("roles with no active user stay mapped").
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
INSERT INTO qms_training_requirements (role, doc_type, section_id, is_active)
SELECT role, doc_type, section_id, true FROM (VALUES
  ('admin',             'CORE'),
  ('qa',                'CORE'),
  ('manager',           'CORE'),
  ('cfo',               'CORE'),
  ('operator',          'WT'),
  ('operator',          'PRO'),
  ('qa',                'QC'),
  ('operator',          'GMP'),
  ('qa',                'GMP'),
  ('engineering',       'ENG'),
  ('warehouse_manager', 'WH'),
  ('admin',             'HSE'),
  ('manager',           'HSE'),
  ('qa',                'HSE'),
  ('engineering',       'HSE'),
  ('qa',                'REC'),
  ('manager',           'REC'),
  ('admin',             'REC'),
  ('cfo',               'REC'),
  ('admin',             'HR'),
  ('admin',             'IT')
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
