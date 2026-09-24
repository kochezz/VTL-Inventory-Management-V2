-- ============================================================================
-- Migration: compliance_reminder_log_dedup_fix
-- Date:      2026-09-24
-- ============================================================================
-- WHAT THIS DOES
-- Fixes a production bug in the two dedup unique indexes added by
-- 20260924_compliance_flexible_cadence.sql. Follow-up to that migration,
-- kept as its own file/commit because it's a distinct defect found during
-- a later production-readiness check, not part of that migration's
-- original design.
--
-- THE BUG
-- compliance_reminder_log_item_tier_day_unique and
-- compliance_reminder_log_rule_tier_day_unique were created as plain
-- btree UNIQUE indexes on (item_id, tier_type, days_before, sent_date)
-- and (rule_id, tier_type, days_before, sent_date). Standard SQL NULL
-- semantics mean NULL is never equal to another NULL for uniqueness
-- purposes -- and days_before is ALWAYS NULL for the OVERDUE_ESCALATION
-- and REAPPROVAL_REMINDER tier types (only DAYS_BEFORE rows have a
-- non-NULL days_before). The scheduler's escalation/reapproval-reminder
-- inserts rely on `ON CONFLICT (...) DO NOTHING` against these indexes to
-- send each one once per day -- with plain NULL semantics that never
-- actually matches, so the scheduler would silently send a duplicate
-- escalation email and a duplicate re-approval reminder email on every
-- run once this was deployed, not just once per day as designed.
--
-- Confirmed directly (not guessed): rerunning the scheduler test suite
-- surfaced both "must not double-escalate the same day" and "a second
-- same-day run must not send a duplicate reapproval reminder" failing
-- (actual: a duplicate WAS sent) before this fix, and passing after it.
--
-- THE FIX
-- PostgreSQL 15+ (this DB is PG17) supports NULLS NOT DISTINCT on unique
-- indexes, which treats NULL as equal to NULL for uniqueness purposes --
-- exactly the dedup semantics the scheduler's ON CONFLICT already assumed.
-- Both indexes are dropped and recreated with that option. No column or
-- constraint changes; existing rows are unaffected (table had 0 rows at
-- the time this was found).
-- ============================================================================

BEGIN;

DROP INDEX compliance_reminder_log_item_tier_day_unique;
CREATE UNIQUE INDEX compliance_reminder_log_item_tier_day_unique
  ON compliance_reminder_log (item_id, tier_type, days_before, sent_date)
  NULLS NOT DISTINCT;

DROP INDEX compliance_reminder_log_rule_tier_day_unique;
CREATE UNIQUE INDEX compliance_reminder_log_rule_tier_day_unique
  ON compliance_reminder_log (rule_id, tier_type, days_before, sent_date)
  NULLS NOT DISTINCT
  WHERE (rule_id IS NOT NULL);

COMMIT;

-- ============================================================================
-- ROLLBACK (manual, not automatic -- reverts to the buggy plain-unique
-- indexes; there is no good reason to run this, kept only for symmetry
-- with this project's migration file convention)
-- ============================================================================
-- BEGIN;
-- DROP INDEX compliance_reminder_log_item_tier_day_unique;
-- CREATE UNIQUE INDEX compliance_reminder_log_item_tier_day_unique
--   ON compliance_reminder_log (item_id, tier_type, days_before, sent_date);
--
-- DROP INDEX compliance_reminder_log_rule_tier_day_unique;
-- CREATE UNIQUE INDEX compliance_reminder_log_rule_tier_day_unique
--   ON compliance_reminder_log (rule_id, tier_type, days_before, sent_date)
--   WHERE (rule_id IS NOT NULL);
-- COMMIT;
