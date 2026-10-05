-- ============================================================================
-- DRAFT migration: hr_offboarding_fields -- NOT APPLIED, NOT FOR EXECUTION YET
-- Date:      2026-10-05
-- ============================================================================
-- Session D (Employee Offboarding -- Investigation and Design Proposal Only).
-- This file is a DESIGN DRAFT ONLY. It has not been run against the test
-- branch or production. Do not run it without a separate, explicit
-- go-ahead -- this session's scope was read-only investigation plus this one
-- unapplied file.
--
-- WHAT THIS ADDS, AND WHY
--
-- hr_employees already has exit_date (date) and exit_reason (text) columns,
-- and its hr_status enum already includes 'exited' as a valid value -- all
-- three have existed since this table was created, and all three have NEVER
-- been used (zero rows, confirmed Step 1). Nothing currently writes to them.
-- So this draft does NOT duplicate those two -- it reuses exit_reason as-is,
-- and adds effective_date as a clearly-named alias of what exit_date was
-- presumably meant to mean, kept as a separate new column rather than
-- renaming exit_date, so nothing existing (even though nothing reads it
-- today) silently changes shape.
--
-- Net new in this draft: exit_type (the one genuinely missing field) on
-- hr_employees, and archived_at/archived_by on users -- mirroring the exact
-- soft-delete pattern compliance_categories/compliance_items already use in
-- this codebase (status + previous_status + archived_reason + archived_at),
-- so offboarding a user follows a pattern this project has already settled
-- on, not a new one invented for this feature alone.
--
-- TEST_ACCOUNT is in exit_type's value set specifically so the 2026-10-03
-- roster cleanup (Womb Mate, John Smith, Report Viewer, Warehouse Manager,
-- Test Suite Password Disposable User -- deactivated via a raw is_active
-- flip, no exit_type recorded at the time) can be backfilled distinctly
-- from a real person's real exit, if this migration is ever actually run.
-- Womb Mate and John Smith are real employees who left employment for real
-- reasons unknown to this session (not test accounts) -- they would get
-- whatever real exit_type is true, not TEST_ACCOUNT, on backfill; the other
-- three are synthetic/disposable and would get TEST_ACCOUNT.
-- ============================================================================

-- BEGIN;

ALTER TABLE hr_employees ADD COLUMN exit_type VARCHAR(30)
  CHECK (exit_type IN (
    'RESIGNATION', 'TERMINATION', 'END_OF_CONTRACT', 'REDUNDANCY',
    'RETIREMENT', 'TEST_ACCOUNT', 'OTHER'
  ));

ALTER TABLE hr_employees ADD COLUMN effective_date DATE;
-- Documented alias of the pre-existing, never-used exit_date -- new
-- offboarding code should write effective_date; exit_date is left exactly
-- as it is (still there, still unused by anything), not renamed or dropped,
-- so this migration carries zero risk to existing (nonexistent) readers.

ALTER TABLE users ADD COLUMN archived_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN archived_by UUID REFERENCES users(user_id);
-- Same two-column shape as compliance_categories.archived_at/archived_reason
-- and compliance_items' equivalent (this codebase's one existing soft-delete
-- convention). archived_by (who performed the offboarding action) has no
-- equivalent on the compliance tables, which instead record the actor only
-- via audit_log.user_id -- added explicitly here since Step 3 found this
-- project's own users table has nowhere else that records "who deactivated
-- this account," unlike every compliance soft-delete this session already
-- built (which has audit_log as a fallback). archived_reason is NOT
-- duplicated here -- hr_employees.exit_reason already carries that meaning
-- for a real employee exit, and a free-text users.archived_reason would just
-- be a second place the same fact could drift out of sync with it. A
-- synthetic/placeholder account with no hr_employees row (Report Viewer,
-- Warehouse Manager, the disposable test user) has nothing to drift against,
-- so exit_type = 'TEST_ACCOUNT' plus the audit_log ANNOTATION entry the
-- offboarding transaction below writes is enough of a reason trail for
-- those three.

-- COMMIT;

-- ============================================================================
-- ROLLBACK (manual, not automatic).
-- ============================================================================
-- BEGIN;
-- ALTER TABLE users DROP COLUMN archived_by;
-- ALTER TABLE users DROP COLUMN archived_at;
-- ALTER TABLE hr_employees DROP COLUMN effective_date;
-- ALTER TABLE hr_employees DROP COLUMN exit_type;
-- COMMIT;
