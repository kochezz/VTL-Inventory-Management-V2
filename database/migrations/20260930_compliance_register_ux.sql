-- ============================================================================
-- Migration: compliance_register_ux
-- Date:      2026-09-30
-- ============================================================================
-- WHAT THIS DOES
-- feature/compliance-register-ux, Step 2. Introduces obligation_kind
-- (FILING vs RENEWAL) as the axis that decides which of the two generators
-- (scheduler, or verification) is allowed to create a category's next
-- period, plus the new period-status vocabulary (UPCOMING/EVIDENCE_
-- SUBMITTED/VERIFIED -- no OVERDUE, per explicit decision) additively
-- alongside the existing DRAFT/PENDING_APPROVAL/APPROVED/REJECTED/
-- NON_COMPLIANT/RETURNED/ARCHIVED values (legacy rows are left as-is, not
-- rewritten -- see the Step 1 dry-run report for why).
--
-- NOT INCLUDED IN THIS MIGRATION (explicit exclusions, per instruction):
--   - ZPPA: no obligation_kind-driven item/rule change. The next RENEWAL
--     period's due date must come from the certificate's actual printed
--     expiry, not a guess -- excluded until that's provided.
--   - PACRA's malformed RETURNED item (due_date '82027-02-10'): shown to
--     the user with its full audit history, not corrected here -- their
--     call, not assumed.
--   - NAPSA (ACTIVE): obligation_kind backfilled (FILING) but no rule/item
--     created -- its real due date is still being confirmed manually.
--
-- SEQUENCING (per instruction): this migration and the Step 2 code deploy
-- ship together, not this migration alone first. Applying the UPCOMING
-- rows below before the scheduler/reminder code changes are live would
-- leave WCFCB's and PACRA's new periods un-reminded (the current deployed
-- scheduler only reminds status = 'APPROVED'). See the PR description's
-- deploy checklist.
-- ============================================================================

BEGIN;

-- ── Schema ──────────────────────────────────────────────────────────────────

ALTER TABLE compliance_categories ADD COLUMN obligation_kind VARCHAR(20)
  CHECK (obligation_kind IN ('FILING', 'RENEWAL'));
ALTER TABLE compliance_categories ADD COLUMN responsible_user_id UUID REFERENCES users(user_id);

ALTER TABLE compliance_items ADD COLUMN filed_late BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE compliance_item_evidence ADD COLUMN certificate_expiry_date DATE;

ALTER TABLE compliance_items DROP CONSTRAINT compliance_items_status_check;
ALTER TABLE compliance_items ADD CONSTRAINT compliance_items_status_check
  CHECK (status IN ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'NON_COMPLIANT', 'RETURNED', 'ARCHIVED',
                     'UPCOMING', 'EVIDENCE_SUBMITTED', 'VERIFIED'));

ALTER TABLE compliance_reminder_log DROP CONSTRAINT compliance_reminder_log_tier_type_check;
ALTER TABLE compliance_reminder_log ADD CONSTRAINT compliance_reminder_log_tier_type_check
  CHECK (tier_type IN ('DAYS_BEFORE', 'OVERDUE_ESCALATION', 'REAPPROVAL_REMINDER', 'RETURNED_STALE', 'VERIFICATION_OVERDUE'));

-- ── obligation_kind backfill (proposed, confirmed by user) ─────────────────

UPDATE compliance_categories SET obligation_kind = 'FILING'
  WHERE name IN ('VAT', 'PAYE', 'NHIMA', 'TOT', 'NAPSA', 'WORKERS COMPENSATION FUND CONTROL BOARD');
UPDATE compliance_categories SET obligation_kind = 'RENEWAL'
  WHERE name IN ('TCC', 'ZPPA');
-- LAND OCCUPIERS CERTIFICATE: left NULL -- pending confirmation of whether it expires.

-- PACRA Annual Return: FILING, cadence changed from ONE_OFF to RECURRING
-- (12 months), anchor_date proposed from the existing APPROVED item's due
-- date -- pending confirmation before this migration is applied for real.
UPDATE compliance_categories
  SET obligation_kind = 'FILING', cadence_type = 'RECURRING', interval_months = 12,
      anchor_date = '2027-08-21', due_day_of_month = 21
  WHERE name = 'PACRA Annual Return';

-- ── WCFCB: recurrence rule + first UPCOMING period ──────────────────────────
-- (dry-run verified in Step 1; category is FILING + RECURRING, fully
-- configured, zero items -- exactly the gap this feature exists to close.)

INSERT INTO compliance_recurrence_rule (category_id, interval_months, day_of_month_due, next_reapproval_due, last_reapproved_at, last_reapproved_by)
SELECT category_id, interval_months, due_day_of_month, (approved_at::date + INTERVAL '12 months'), approved_at, approved_by
FROM compliance_categories
WHERE name = 'WORKERS COMPENSATION FUND CONTROL BOARD' AND status = 'ACTIVE';

INSERT INTO compliance_items (category_id, due_date, status, created_by, recurrence_rule_id)
SELECT cc.category_id, cc.anchor_date, 'UPCOMING', cc.approved_by, r.rule_id
FROM compliance_categories cc
JOIN compliance_recurrence_rule r ON r.category_id = cc.category_id
WHERE cc.name = 'WORKERS COMPENSATION FUND CONTROL BOARD' AND cc.status = 'ACTIVE';

-- ── PACRA: convert the evidence-less APPROVED item to UPCOMING ─────────────
-- (its real due_date, 2027-08-21, is untouched -- only status/approval
-- fields change. The malformed RETURNED sibling is NOT touched here.)

UPDATE compliance_items ci
  SET status = 'UPCOMING', approved_by = NULL, approved_at = NULL
  FROM compliance_categories cc
  WHERE ci.category_id = cc.category_id AND cc.name = 'PACRA Annual Return'
    AND ci.status = 'APPROVED';

COMMIT;

-- ============================================================================
-- ROLLBACK (manual, not automatic).
-- ============================================================================
-- BEGIN;
-- UPDATE compliance_items SET status = 'APPROVED' WHERE item_id = (
--   SELECT ci.item_id FROM compliance_items ci JOIN compliance_categories cc ON cc.category_id = ci.category_id
--   WHERE cc.name = 'PACRA Annual Return' AND ci.status = 'UPCOMING'
-- ); -- approved_by/approved_at cannot be un-cleared; re-set manually if needed.
--
-- DELETE FROM compliance_items WHERE category_id = (
--   SELECT category_id FROM compliance_categories WHERE name = 'WORKERS COMPENSATION FUND CONTROL BOARD' AND status = 'ACTIVE'
-- ) AND status = 'UPCOMING';
-- DELETE FROM compliance_recurrence_rule WHERE category_id = (
--   SELECT category_id FROM compliance_categories WHERE name = 'WORKERS COMPENSATION FUND CONTROL BOARD' AND status = 'ACTIVE'
-- );
--
-- UPDATE compliance_categories SET obligation_kind = NULL, cadence_type = 'ONE_OFF', interval_months = NULL, anchor_date = NULL, due_day_of_month = NULL
--   WHERE name = 'PACRA Annual Return';
-- UPDATE compliance_categories SET obligation_kind = NULL WHERE obligation_kind IS NOT NULL;
--
-- ALTER TABLE compliance_reminder_log DROP CONSTRAINT compliance_reminder_log_tier_type_check;
-- ALTER TABLE compliance_reminder_log ADD CONSTRAINT compliance_reminder_log_tier_type_check
--   CHECK (tier_type IN ('DAYS_BEFORE', 'OVERDUE_ESCALATION', 'REAPPROVAL_REMINDER', 'RETURNED_STALE'));
--
-- ALTER TABLE compliance_items DROP CONSTRAINT compliance_items_status_check;
-- ALTER TABLE compliance_items ADD CONSTRAINT compliance_items_status_check
--   CHECK (status IN ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'NON_COMPLIANT', 'RETURNED', 'ARCHIVED'));
--
-- ALTER TABLE compliance_item_evidence DROP COLUMN certificate_expiry_date;
-- ALTER TABLE compliance_items DROP COLUMN filed_late;
-- ALTER TABLE compliance_categories DROP COLUMN responsible_user_id;
-- ALTER TABLE compliance_categories DROP COLUMN obligation_kind;
-- COMMIT;
