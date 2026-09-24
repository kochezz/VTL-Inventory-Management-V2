-- ============================================================================
-- Migration: compliance_returned_status
-- Date:      2026-09-24
-- ============================================================================
-- WHAT THIS DOES
-- Phase C of the Compliance Module rework (feature/compliance-cadence-and-
-- rework, continued past Phase B's merge to main). Adds a RETURNED status
-- for both compliance_categories and compliance_items, and a matching
-- RETURNED_STALE tier_type for compliance_reminder_log so the scheduler
-- can nudge Admin once a returned item has sat untouched for 7+ days.
-- Purely additive: two CHECK constraints widened (DROP + re-ADD, since
-- Postgres has no ALTER CHECK IN PLACE), no columns added or dropped, no
-- data touched. Dry-run shown to and approved by the user before this was
-- applied, per the standing rule from the Phase B production incident.
--
-- WHAT RETURNED MEANS
-- A third approver action alongside Approve/Reject: "send this back to the
-- creator to fix, don't reject it outright." PENDING_APPROVAL -> RETURNED
-- (reason required, >=10 chars, reusing the existing rejection_reason
-- column on both tables -- status already distinguishes a return from a
-- reject, a second reason column would be redundant) -> creator or Admin
-- edits it -> RETURNED -> PENDING_APPROVAL (resubmit, clears the previous
-- decision fields, re-notifies approvers).
--
-- SCOPE NOTE: the "no reminders/escalation while RETURNED, notify Admin
-- after 7 days" behavior is items-only, per the spec's own wording (it
-- ties the 7-day nudge to "reminders/escalation," machinery categories
-- don't have -- categories have no due date or reminder ladder to reason
-- about urgency around). Categories get RETURNED/resubmit; items get
-- RETURNED/resubmit AND the 7-day staleness nudge.
-- ============================================================================

BEGIN;

ALTER TABLE compliance_categories DROP CONSTRAINT compliance_categories_status_check;
ALTER TABLE compliance_categories ADD CONSTRAINT compliance_categories_status_check
  CHECK (status IN ('PENDING_APPROVAL', 'ACTIVE', 'REJECTED', 'RETURNED'));

ALTER TABLE compliance_items DROP CONSTRAINT compliance_items_status_check;
ALTER TABLE compliance_items ADD CONSTRAINT compliance_items_status_check
  CHECK (status IN ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'NON_COMPLIANT', 'RETURNED'));

-- RETURNED_STALE is item-scoped (item_id set, rule_id NULL, days_before
-- NULL) -- same dedup shape as OVERDUE_ESCALATION, "once per day until
-- resolved" (here: until resubmitted).
ALTER TABLE compliance_reminder_log DROP CONSTRAINT compliance_reminder_log_tier_type_check;
ALTER TABLE compliance_reminder_log ADD CONSTRAINT compliance_reminder_log_tier_type_check
  CHECK (tier_type IN ('DAYS_BEFORE', 'OVERDUE_ESCALATION', 'REAPPROVAL_REMINDER', 'RETURNED_STALE'));
ALTER TABLE compliance_reminder_log DROP CONSTRAINT compliance_reminder_log_days_before_check;
ALTER TABLE compliance_reminder_log ADD CONSTRAINT compliance_reminder_log_days_before_check
  CHECK (
    (tier_type = 'DAYS_BEFORE' AND days_before IS NOT NULL AND days_before > 0)
    OR (tier_type <> 'DAYS_BEFORE' AND days_before IS NULL)
  );

COMMIT;

-- ============================================================================
-- ROLLBACK (manual, not automatic -- run only if this needs to be undone).
-- Reverting these CHECKs while any row actually has status/tier_type =
-- RETURNED*/RETURNED_STALE would violate the narrower constraint -- check
-- for and resolve those rows first (e.g. move them back to PENDING_APPROVAL/
-- delete the reminder_log rows) or this will fail loudly rather than
-- silently corrupt data, which is the correct behavior.
-- ============================================================================
-- BEGIN;
-- ALTER TABLE compliance_reminder_log DROP CONSTRAINT compliance_reminder_log_days_before_check;
-- ALTER TABLE compliance_reminder_log ADD CONSTRAINT compliance_reminder_log_days_before_check
--   CHECK (
--     (tier_type = 'DAYS_BEFORE' AND days_before IS NOT NULL AND days_before > 0)
--     OR (tier_type <> 'DAYS_BEFORE' AND days_before IS NULL)
--   );
-- ALTER TABLE compliance_reminder_log DROP CONSTRAINT compliance_reminder_log_tier_type_check;
-- ALTER TABLE compliance_reminder_log ADD CONSTRAINT compliance_reminder_log_tier_type_check
--   CHECK (tier_type IN ('DAYS_BEFORE', 'OVERDUE_ESCALATION', 'REAPPROVAL_REMINDER'));
--
-- ALTER TABLE compliance_items DROP CONSTRAINT compliance_items_status_check;
-- ALTER TABLE compliance_items ADD CONSTRAINT compliance_items_status_check
--   CHECK (status IN ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'NON_COMPLIANT'));
--
-- ALTER TABLE compliance_categories DROP CONSTRAINT compliance_categories_status_check;
-- ALTER TABLE compliance_categories ADD CONSTRAINT compliance_categories_status_check
--   CHECK (status IN ('PENDING_APPROVAL', 'ACTIVE', 'REJECTED'));
-- COMMIT;
