-- ============================================================================
-- Migration: compliance_archive_status
-- Date:      2026-09-29
-- ============================================================================
-- WHAT THIS DOES
-- feature/compliance-archive-and-evidence-view. Adds an ARCHIVED status for
-- both compliance_categories and compliance_items -- a real soft delete:
-- row kept, hidden from default lists, excluded from the scheduler,
-- reminders, escalations and configuration prompts. Two CHECK constraints
-- widened (DROP + re-ADD, Postgres has no ALTER CHECK IN PLACE), and three
-- new columns added to each table to support it. No data touched. Dry-run
-- shown to and approved by the user before this was applied, per the
-- standing rule from the Phase B production incident.
--
-- WHAT ARCHIVED MEANS
-- DRAFT item (never submitted)      -> hard delete, not ARCHIVED (no row kept).
-- RETURNED  -> "Withdraw" -> ARCHIVED   (author or admin; reason required)
-- REJECTED  -> "Archive"  -> ARCHIVED   (author or admin; reason optional)
-- ARCHIVED  -> "Restore"  -> previous_status   (admin only)
-- ACTIVE has no direct archive path in this migration -- retiring an ACTIVE
-- category is deferred to the future change-request/retire design (goes
-- through executive approval), not part of this phase.
--
-- previous_status is what makes Restore a plain column read instead of
-- reverse-engineering the prior status from audit_log. archived_reason/
-- archived_at record the withdraw/archive action itself; every archive,
-- withdraw, delete and restore additionally writes a full audit_log row
-- (actor, reason, previous status), same as every other compliance
-- transition this project has -- these columns are a convenience for
-- display, not a substitute for the audit trail.
-- ============================================================================

BEGIN;

ALTER TABLE compliance_categories DROP CONSTRAINT compliance_categories_status_check;
ALTER TABLE compliance_categories ADD CONSTRAINT compliance_categories_status_check
  CHECK (status IN ('PENDING_APPROVAL', 'ACTIVE', 'REJECTED', 'RETURNED', 'ARCHIVED'));

ALTER TABLE compliance_items DROP CONSTRAINT compliance_items_status_check;
ALTER TABLE compliance_items ADD CONSTRAINT compliance_items_status_check
  CHECK (status IN ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'NON_COMPLIANT', 'RETURNED', 'ARCHIVED'));

ALTER TABLE compliance_categories ADD COLUMN previous_status VARCHAR(20);
ALTER TABLE compliance_categories ADD COLUMN archived_reason TEXT;
ALTER TABLE compliance_categories ADD COLUMN archived_at TIMESTAMPTZ;

ALTER TABLE compliance_items ADD COLUMN previous_status VARCHAR(20);
ALTER TABLE compliance_items ADD COLUMN archived_reason TEXT;
ALTER TABLE compliance_items ADD COLUMN archived_at TIMESTAMPTZ;

COMMIT;

-- ============================================================================
-- ROLLBACK (manual, not automatic -- run only if this needs to be undone).
-- Reverting the status CHECKs while any row actually has status = ARCHIVED
-- would violate the narrower constraint -- resolve those rows first (restore
-- or delete them) or this will fail loudly rather than silently corrupt
-- data, which is the correct behavior.
-- ============================================================================
-- BEGIN;
-- ALTER TABLE compliance_items DROP COLUMN archived_at;
-- ALTER TABLE compliance_items DROP COLUMN archived_reason;
-- ALTER TABLE compliance_items DROP COLUMN previous_status;
--
-- ALTER TABLE compliance_categories DROP COLUMN archived_at;
-- ALTER TABLE compliance_categories DROP COLUMN archived_reason;
-- ALTER TABLE compliance_categories DROP COLUMN previous_status;
--
-- ALTER TABLE compliance_items DROP CONSTRAINT compliance_items_status_check;
-- ALTER TABLE compliance_items ADD CONSTRAINT compliance_items_status_check
--   CHECK (status IN ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'NON_COMPLIANT', 'RETURNED'));
--
-- ALTER TABLE compliance_categories DROP CONSTRAINT compliance_categories_status_check;
-- ALTER TABLE compliance_categories ADD CONSTRAINT compliance_categories_status_check
--   CHECK (status IN ('PENDING_APPROVAL', 'ACTIVE', 'REJECTED', 'RETURNED'));
-- COMMIT;
