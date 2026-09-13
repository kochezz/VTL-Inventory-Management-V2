-- ============================================================================
-- Migration: compliance_items_recurrence_rule_id
-- Date:      2026-09-13
-- ============================================================================
-- WHAT THIS DOES
-- Additive-only: adds compliance_items.recurrence_rule_id (UUID,
-- nullable, REFERENCES compliance_recurrence_rule(rule_id)). Null for
-- one-off items and the first instance of a recurring category; Phase 3
-- sets it on every instance it auto-generates going forward, linking
-- each generated item back to the rule that produced it.
-- ============================================================================

BEGIN;

ALTER TABLE compliance_items
  ADD COLUMN recurrence_rule_id UUID REFERENCES compliance_recurrence_rule(rule_id);

COMMIT;

-- ============================================================================
-- ROLLBACK (manual, not automatic)
-- ============================================================================
-- BEGIN;
-- ALTER TABLE compliance_items DROP COLUMN recurrence_rule_id;
-- COMMIT;
