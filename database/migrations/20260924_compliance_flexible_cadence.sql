-- ============================================================================
-- Migration: compliance_flexible_cadence
-- Date:      2026-09-24
-- ============================================================================
-- WHAT THIS DOES
-- Phase B of the Compliance Module cadence/rework session
-- (feature/compliance-cadence-and-rework). Replaces the fixed 3-value
-- recurrence_type enum (ONE_OFF_EXPIRY | MONTHLY_RECURRING |
-- ANNUAL_RECURRING) with a flexible cadence model that supports any
-- 1-60 month interval, and restructures compliance_reminder_log's dedup
-- key from a single free-text tier string to a typed tier_type +
-- days_before pair. Backfills all 10 live categories. No inventory,
-- production, HR, CRM, PO, or QMS table is touched.
--
-- NOTE ON EXECUTION HISTORY
-- This migration was applied directly against the live database during
-- the session that wrote it (in three steps: dry run, apply, then a
-- follow-up gap found by tracing compliance_recurrence_rule's own
-- constraints). This file is the after-the-fact durable record, written
-- to match exactly what was applied, for reproducibility and rollback
-- reference -- not a not-yet-applied change. A separate, later production
-- readiness check found compliance_reminder_log's two new unique indexes
-- don't actually deduplicate NULL days_before rows (standard btree NULL
-- semantics); that fix is 20260924_compliance_reminder_log_dedup_fix.sql,
-- kept as its own file/commit since it's a genuinely separate defect
-- found afterward, not part of this migration's original design.
--
-- DECISIONS MADE HERE
--
-- 1. cadence_type (ONE_OFF | RECURRING) + interval_months (1-60) replace
--    recurrence_type. recurrence_type is kept, made nullable, and left
--    unread by new application code for one release rather than dropped
--    outright -- avoids a hard cutover for any code/reports not yet
--    updated. compliance_recurrence_rule.recurrence_type is likewise left
--    in place and nullable for the same reason.
--
-- 2. due_day_of_month moves from compliance_items to compliance_categories
--    (every item under a category shares the same due day now -- that's
--    the point of the category defining its own cadence). compliance_items
--    keeps its own day_of_month_due column, unread by new code, so the 3
--    pre-migration items remain readable.
--
-- 3. anchor_date (first due date) is the source of truth for a RECURRING
--    category's cadence; due_day_of_month is derived from it unless
--    explicitly overridden. Deliberately NOT required at the DB level
--    (no CHECK forcing anchor_date IS NOT NULL when cadence_type =
--    'RECURRING') -- enforced at the application layer instead, because 7
--    of the 8 live RECURRING categories (NAPSA, NHIMA, PAYE, TOT, VAT,
--    Workers Compensation Fund, TCC) have no existing items to derive a
--    due day from. Per explicit instruction not to guess, these are
--    backfilled with cadence_type/interval_months set but
--    anchor_date/due_day_of_month left NULL, to be filled in via the
--    Categories page by an executive. The application's item-creation
--    path 400s with an explanatory message until that happens -- ZPPA is
--    the only RECURRING category with a real item to derive a day from
--    (due_day_of_month 8, from its one item's due date).
--
-- 4. compliance_reminder_log's dedup key changes from tier (VARCHAR,
--    values like '30_DAY'/'OVERDUE_ESCALATION') to tier_type
--    (DAYS_BEFORE | OVERDUE_ESCALATION | REAPPROVAL_REMINDER) +
--    days_before (INT, required iff DAYS_BEFORE). The table was empty
--    (0 rows) at migration time, so this is a clean structural replace,
--    not a data migration -- verified empty via a guard that aborted the
--    migration if it wasn't.
--
-- 5. compliance_items gets a new UNIQUE(recurrence_rule_id, due_date)
--    WHERE recurrence_rule_id IS NOT NULL index -- the scheduler's actual
--    idempotency guarantee for auto-generated recurring items (ON
--    CONFLICT DO NOTHING), not just the "does an upcoming occurrence
--    already exist" pre-check in application code.
--
-- 6. compliance_recurrence_rule gained interval_months (1-60) and had its
--    existing recurrence_type CHECK relaxed to allow NULL -- a gap the
--    original plan didn't cover: this table's recurrence_type CHECK was
--    hard-restricted to exactly MONTHLY_RECURRING/ANNUAL_RECURRING, which
--    would have rejected the rule-bootstrap INSERT for any custom
--    interval category (e.g. quarterly, biennial) the moment one was
--    approved. Caught by tracing the bootstrap path before it shipped,
--    not by a runtime failure.
-- ============================================================================

BEGIN;

-- ── compliance_categories ────────────────────────────────────────────────────
ALTER TABLE compliance_categories
  ADD COLUMN cadence_type      VARCHAR(20),
  ADD COLUMN interval_months   INTEGER,
  ADD COLUMN due_day_of_month  INTEGER,
  ADD COLUMN anchor_date       DATE;

ALTER TABLE compliance_categories
  ADD CONSTRAINT compliance_categories_cadence_type_check
    CHECK (cadence_type IS NULL OR cadence_type IN ('ONE_OFF', 'RECURRING')),
  ADD CONSTRAINT compliance_categories_interval_months_check
    CHECK (
      (cadence_type = 'ONE_OFF' AND interval_months IS NULL)
      OR (cadence_type = 'RECURRING' AND interval_months BETWEEN 1 AND 60)
      OR (cadence_type IS NULL)
    ),
  ADD CONSTRAINT compliance_categories_due_day_of_month_check
    CHECK (due_day_of_month IS NULL OR due_day_of_month BETWEEN 1 AND 31);

ALTER TABLE compliance_categories ALTER COLUMN recurrence_type DROP NOT NULL;

-- Backfill: map the old 3-value enum onto the new cadence model for all
-- existing rows (generic, not tied to specific categories).
UPDATE compliance_categories SET cadence_type = 'ONE_OFF', interval_months = NULL
  WHERE recurrence_type = 'ONE_OFF_EXPIRY';
UPDATE compliance_categories SET cadence_type = 'RECURRING', interval_months = 1
  WHERE recurrence_type = 'MONTHLY_RECURRING';
UPDATE compliance_categories SET cadence_type = 'RECURRING', interval_months = 12
  WHERE recurrence_type = 'ANNUAL_RECURRING';

-- ZPPA is the one RECURRING category with an existing item to derive a due
-- day from (its item is due on the 8th) -- case-by-case, human-reviewed,
-- not a rule applied to the other 7 (see decision 3 above).
UPDATE compliance_categories
  SET due_day_of_month = 8, anchor_date = '2027-07-08'
  WHERE name = 'ZPPA';

-- ── compliance_reminder_log ──────────────────────────────────────────────────
-- Table was empty at migration time (verified by the original migration
-- script, which aborted if it wasn't) -- a clean structural replace.
ALTER TABLE compliance_reminder_log DROP CONSTRAINT compliance_reminder_log_item_tier_day_unique;
DROP INDEX IF EXISTS idx_compliance_reminder_log_item_id;
ALTER TABLE compliance_reminder_log DROP COLUMN tier;
ALTER TABLE compliance_reminder_log ADD COLUMN rule_id UUID REFERENCES compliance_recurrence_rule(rule_id);
ALTER TABLE compliance_reminder_log ALTER COLUMN item_id DROP NOT NULL;
ALTER TABLE compliance_reminder_log
  ADD COLUMN tier_type    VARCHAR(30),
  ADD COLUMN days_before  INTEGER;

ALTER TABLE compliance_reminder_log
  ADD CONSTRAINT compliance_reminder_log_tier_type_check
    CHECK (tier_type IN ('DAYS_BEFORE', 'OVERDUE_ESCALATION', 'REAPPROVAL_REMINDER')),
  ADD CONSTRAINT compliance_reminder_log_days_before_check
    CHECK (
      (tier_type = 'DAYS_BEFORE' AND days_before IS NOT NULL AND days_before > 0)
      OR (tier_type <> 'DAYS_BEFORE' AND days_before IS NULL)
    ),
  ADD CONSTRAINT compliance_reminder_log_item_xor_rule
    CHECK ((item_id IS NOT NULL AND rule_id IS NULL) OR (item_id IS NULL AND rule_id IS NOT NULL));

CREATE INDEX idx_compliance_reminder_log_item_id ON compliance_reminder_log (item_id);

-- NOTE: as originally applied, these two indexes used plain btree
-- uniqueness (NULL days_before never equals another NULL), which does
-- NOT actually dedupe OVERDUE_ESCALATION/REAPPROVAL_REMINDER rows -- see
-- 20260924_compliance_reminder_log_dedup_fix.sql for the correction.
CREATE UNIQUE INDEX compliance_reminder_log_item_tier_day_unique
  ON compliance_reminder_log (item_id, tier_type, days_before, sent_date);
CREATE UNIQUE INDEX compliance_reminder_log_rule_tier_day_unique
  ON compliance_reminder_log (rule_id, tier_type, days_before, sent_date)
  WHERE (rule_id IS NOT NULL);

-- ── compliance_items ─────────────────────────────────────────────────────────
-- Scheduler idempotency guarantee for auto-generated recurring items.
CREATE UNIQUE INDEX compliance_items_rule_due_date_unique
  ON compliance_items (recurrence_rule_id, due_date)
  WHERE (recurrence_rule_id IS NOT NULL);

-- ── compliance_recurrence_rule ───────────────────────────────────────────────
-- Gap found while tracing the rule-bootstrap path (see decision 6 above):
-- this table's own recurrence_type CHECK was hard-restricted to exactly
-- MONTHLY_RECURRING/ANNUAL_RECURRING and would reject any custom interval.
ALTER TABLE compliance_recurrence_rule ALTER COLUMN recurrence_type DROP NOT NULL;
ALTER TABLE compliance_recurrence_rule ADD COLUMN interval_months INTEGER;
ALTER TABLE compliance_recurrence_rule
  ADD CONSTRAINT compliance_recurrence_rule_interval_months_check
    CHECK (interval_months IS NULL OR interval_months BETWEEN 1 AND 60);

COMMIT;

-- ============================================================================
-- ROLLBACK (manual, not automatic -- run only if this needs to be undone)
-- Reverses compliance_reminder_log to its pre-migration shape too, so run
-- this BEFORE 20260924_compliance_reminder_log_dedup_fix.sql's own
-- rollback if both need reversing (that file's rollback assumes tier_type/
-- days_before still exist).
-- ============================================================================
-- BEGIN;
-- ALTER TABLE compliance_recurrence_rule DROP CONSTRAINT compliance_recurrence_rule_interval_months_check;
-- ALTER TABLE compliance_recurrence_rule DROP COLUMN interval_months;
-- ALTER TABLE compliance_recurrence_rule ALTER COLUMN recurrence_type SET NOT NULL;
--
-- DROP INDEX compliance_items_rule_due_date_unique;
--
-- DROP INDEX compliance_reminder_log_rule_tier_day_unique;
-- DROP INDEX compliance_reminder_log_item_tier_day_unique;
-- DROP INDEX idx_compliance_reminder_log_item_id;
-- ALTER TABLE compliance_reminder_log DROP CONSTRAINT compliance_reminder_log_item_xor_rule;
-- ALTER TABLE compliance_reminder_log DROP CONSTRAINT compliance_reminder_log_days_before_check;
-- ALTER TABLE compliance_reminder_log DROP CONSTRAINT compliance_reminder_log_tier_type_check;
-- ALTER TABLE compliance_reminder_log DROP COLUMN tier_type;
-- ALTER TABLE compliance_reminder_log DROP COLUMN days_before;
-- ALTER TABLE compliance_reminder_log ALTER COLUMN item_id SET NOT NULL; -- only safe if no rule_id rows exist
-- ALTER TABLE compliance_reminder_log DROP COLUMN rule_id;
-- ALTER TABLE compliance_reminder_log ADD COLUMN tier VARCHAR(30);
-- -- tier's original data is unrecoverable (dropped, not backed up -- table
-- -- was empty at migration time, so this is a structural revert only).
-- ALTER TABLE compliance_reminder_log ADD CONSTRAINT compliance_reminder_log_tier_check
--   CHECK (tier IN ('30_DAY', '15_DAY', '10_DAY', '5_DAY', 'OVERDUE_ESCALATION'));
-- CREATE INDEX idx_compliance_reminder_log_item_id ON compliance_reminder_log (item_id);
-- ALTER TABLE compliance_reminder_log ADD CONSTRAINT compliance_reminder_log_item_tier_day_unique
--   UNIQUE (item_id, tier, sent_date);
--
-- UPDATE compliance_categories SET cadence_type = NULL, interval_months = NULL, due_day_of_month = NULL, anchor_date = NULL;
-- ALTER TABLE compliance_categories ALTER COLUMN recurrence_type SET NOT NULL;
-- ALTER TABLE compliance_categories DROP CONSTRAINT compliance_categories_due_day_of_month_check;
-- ALTER TABLE compliance_categories DROP CONSTRAINT compliance_categories_interval_months_check;
-- ALTER TABLE compliance_categories DROP CONSTRAINT compliance_categories_cadence_type_check;
-- ALTER TABLE compliance_categories DROP COLUMN cadence_type;
-- ALTER TABLE compliance_categories DROP COLUMN interval_months;
-- ALTER TABLE compliance_categories DROP COLUMN due_day_of_month;
-- ALTER TABLE compliance_categories DROP COLUMN anchor_date;
-- COMMIT;
