-- ============================================================================
-- Migration: vendor_four_eyes_tracking
-- Date:      2026-10-08
-- ============================================================================
-- MUST RUN BEFORE THE BACKEND DEPLOY. feat/qa-vendor-intake-four-eyes's
-- backend code (supplier-service.js's updateVendor, submitForQA, and
-- approveVendor) reads and writes submitted_by/last_edited_by directly --
-- deploying that code before this migration runs will error on every
-- vendor update, submit, or approve call.
--
-- WHAT THIS DOES
-- Adds the two columns approveVendor's four-eyes rule checks alongside the
-- already-existing created_by: submitted_by (set by submitForQA) and
-- last_edited_by (set by updateVendor). Together with created_by, these
-- let approveVendor refuse an approval from anyone who created, last
-- edited, or submitted the same vendor -- no role is exempt, including
-- admin, CEO and CFO.
--
-- IF NOT EXISTS on both ALTERs -- safe to re-run, matches this migration
-- being a pure additive column change with no backfill needed (existing
-- vendor rows simply have NULL for both, which the four-eyes check already
-- treats as "nobody", not a match).
-- ============================================================================

BEGIN;

ALTER TABLE vendors ADD COLUMN IF NOT EXISTS submitted_by UUID REFERENCES users(user_id);
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS last_edited_by UUID REFERENCES users(user_id);

COMMIT;

-- ============================================================================
-- ROLLBACK (manual, not automatic).
-- ============================================================================
-- BEGIN;
-- ALTER TABLE vendors DROP COLUMN IF EXISTS last_edited_by;
-- ALTER TABLE vendors DROP COLUMN IF EXISTS submitted_by;
-- COMMIT;
