-- ============================================================================
-- Migration: compliance_schema
-- Date:      2026-09-13
-- ============================================================================
-- WHAT THIS DOES
-- Creates 5 new, additive tables for the Compliance Module (Phase 1 of
-- VTL-Compliance-Module-Roadmap.md): compliance_categories,
-- compliance_items, compliance_reminder_log, compliance_acknowledgements,
-- compliance_recurrence_rule. No existing table is altered by this file
-- (the users_role_check change lives in the separate
-- 20260913_add_junior_accountant_role.sql migration). No inventory,
-- production, HR, CRM, PO, or QMS table is touched.
--
-- UUID / FK CASTING
-- Every FK to users.user_id is declared UUID REFERENCES users(user_id) --
-- matching users.user_id's actual live type (confirmed UUID via
-- information_schema, not assumed), avoiding the uuid-vs-character-varying
-- cast mismatch that broke a QMS view previously (see
-- 20260721_fix_qms_compliance_views.sql history). All new primary keys use
-- UUID DEFAULT uuid_generate_v4(), matching the uuid-ossp pattern already
-- used throughout this schema (e.g. maintenance_notifications.notification_id).
--
-- DECISIONS MADE HERE THAT GO BEYOND THE ROADMAP'S LITERAL TEXT
-- (flagged explicitly rather than silently resolved, per project convention)
--
-- 1. compliance_items: the roadmap lists "expiry_date or due_date" as if
--    choosing between two columns. Collapsed to a single `due_date DATE
--    NOT NULL` column instead, because Phase 3's reminder engine needs one
--    uniform "days until due" computation regardless of whether the
--    category is a one-off expiry or a recurring due date -- branching on
--    two differently-named columns would just complicate that query for no
--    benefit. `issued_date` is kept as its own separate, optional column.
--
-- 2. compliance_reminder_log: the roadmap's table description says "one
--    row per (item_id, tier) so a tier is never sent twice," but Phase 3
--    separately requires OVERDUE_ESCALATION to send DAILY until
--    acknowledged -- those two statements directly conflict if read as a
--    single hard UNIQUE(item_id, tier) constraint (it would block the
--    2nd day's escalation email entirely). Resolved by adding a
--    `sent_date DATE` column and constraining UNIQUE(item_id, tier,
--    sent_date): the 30/15/10/5-day tiers still get true once-ever
--    protection in practice (Phase 3's own logic only ever fires them once,
--    on one day, matching the roadmap's intent), while OVERDUE_ESCALATION
--    naturally gets one row per calendar day, matching "daily...until
--    acknowledged." This is a schema-level reconciliation of an internal
--    contradiction in the roadmap doc, not an arbitrary addition -- flagging
--    it for confirmation rather than assuming it's uncontroversial.
--
-- 3. compliance_items.rejection_reason (TEXT, nullable) was added even
--    though not in the table's own bullet list in Phase 1, because Phase 2
--    explicitly describes a reject action that "notifies creator" and
--    Phase 5's approval queue explicitly shows "approve/reject with
--    reason" -- a reason has nowhere else to live without this column.
--
-- 4. compliance_recurrence_rule.last_reapproved_by (UUID REFERENCES
--    users(user_id), nullable) was added even though only
--    last_reapproved_at is listed in Phase 1, because every other
--    approval-style column in this schema (qa_approved_by, cfo_approved_by,
--    approved_by, etc.) pairs a timestamp with a "who did it" FK, and a
--    12-month re-approval checkpoint with no recorded approver would be an
--    audit gap relative to the rest of this codebase's own convention.
--
-- 5. compliance_recurrence_rule.recurrence_type is constrained to
--    ('MONTHLY_RECURRING', 'ANNUAL_RECURRING') only -- not
--    ONE_OFF_EXPIRY -- because Phase 3 only ever describes recurrence
--    rules doing two things (auto-generating the next monthly instance,
--    and the 12-month re-approval checkpoint), neither of which applies to
--    a one-off item. A ONE_OFF_EXPIRY category is expected to have zero
--    rows in this table.
--
-- All five tables, plus their indexes, are created in one transaction so
-- this migration either fully applies or not at all.
-- ============================================================================

BEGIN;

-- ── compliance_categories ────────────────────────────────────────────────────
CREATE TABLE compliance_categories (
  category_id           UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  name                  VARCHAR(255)  NOT NULL,
  regulator             VARCHAR(255),
  recurrence_type       VARCHAR(30)   NOT NULL CHECK (recurrence_type IN ('ONE_OFF_EXPIRY', 'MONTHLY_RECURRING', 'ANNUAL_RECURRING')),
  reminder_ladder_days  INTEGER[]     NOT NULL DEFAULT ARRAY[30, 15, 10, 5],
  is_active             BOOLEAN       NOT NULL DEFAULT true,
  created_at            TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at            TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ── compliance_items ─────────────────────────────────────────────────────────
CREATE TABLE compliance_items (
  item_id                       UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  category_id                   UUID          NOT NULL REFERENCES compliance_categories(category_id),
  issued_date                   DATE,
  due_date                      DATE          NOT NULL,
  evidence_file_ref             TEXT,
  status                        VARCHAR(20)   NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'NON_COMPLIANT')),
  created_by                    UUID          NOT NULL REFERENCES users(user_id),
  approved_by                   UUID          REFERENCES users(user_id),
  approved_at                   TIMESTAMP,
  rejection_reason              TEXT,
  is_self_approved              BOOLEAN       NOT NULL DEFAULT false,
  self_approval_justification   TEXT,
  next_reapproval_due           DATE,
  created_at                    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at                    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT compliance_items_self_approval_justification_required
    CHECK (is_self_approved = false OR (self_approval_justification IS NOT NULL AND btrim(self_approval_justification) <> ''))
);

CREATE INDEX idx_compliance_items_status_due_date ON compliance_items (status, due_date);
CREATE INDEX idx_compliance_items_category_id ON compliance_items (category_id);
CREATE INDEX idx_compliance_items_created_by ON compliance_items (created_by);

-- ── compliance_reminder_log ──────────────────────────────────────────────────
CREATE TABLE compliance_reminder_log (
  reminder_log_id  UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  item_id          UUID        NOT NULL REFERENCES compliance_items(item_id),
  tier             VARCHAR(30) NOT NULL CHECK (tier IN ('30_DAY', '15_DAY', '10_DAY', '5_DAY', 'OVERDUE_ESCALATION')),
  sent_at          TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  sent_date        DATE        NOT NULL DEFAULT CURRENT_DATE,
  CONSTRAINT compliance_reminder_log_item_tier_day_unique UNIQUE (item_id, tier, sent_date)
);

CREATE INDEX idx_compliance_reminder_log_item_id ON compliance_reminder_log (item_id);

-- ── compliance_acknowledgements ──────────────────────────────────────────────
CREATE TABLE compliance_acknowledgements (
  acknowledgement_id  UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  item_id             UUID        NOT NULL REFERENCES compliance_items(item_id),
  acknowledged_by     UUID        NOT NULL REFERENCES users(user_id),
  acknowledged_at     TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  note                TEXT,
  CONSTRAINT compliance_acknowledgements_item_id_unique UNIQUE (item_id)
);

-- ── compliance_recurrence_rule ───────────────────────────────────────────────
CREATE TABLE compliance_recurrence_rule (
  rule_id             UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  category_id         UUID        NOT NULL REFERENCES compliance_categories(category_id),
  recurrence_type     VARCHAR(30) NOT NULL CHECK (recurrence_type IN ('MONTHLY_RECURRING', 'ANNUAL_RECURRING')),
  day_of_month_due    INTEGER     CHECK (day_of_month_due BETWEEN 1 AND 31),
  last_reapproved_at  TIMESTAMP,
  last_reapproved_by  UUID        REFERENCES users(user_id),
  next_reapproval_due DATE        NOT NULL,
  is_active           BOOLEAN     NOT NULL DEFAULT true,
  created_at          TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT compliance_recurrence_rule_category_id_unique UNIQUE (category_id)
);

COMMIT;

-- ============================================================================
-- ROLLBACK (manual, not automatic -- run only if this needs to be undone)
-- Order matters: FK-dependent tables first.
-- ============================================================================
-- BEGIN;
-- DROP TABLE IF EXISTS compliance_recurrence_rule;
-- DROP TABLE IF EXISTS compliance_acknowledgements;
-- DROP TABLE IF EXISTS compliance_reminder_log;
-- DROP TABLE IF EXISTS compliance_items;
-- DROP TABLE IF EXISTS compliance_categories;
-- COMMIT;
