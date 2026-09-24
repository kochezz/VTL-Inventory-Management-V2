'use strict';

const { pool } = require('./auth-service');
const NotificationService = require('./notification-service');
const complianceService = require('./compliance-service');

const EXECUTIVE_ROLES = ['admin', 'cfo', 'ceo'];

// Auto-generation lead time for RECURRING items: how many days before the
// next occurrence's due date the scheduler creates the next
// compliance_items row. Kept as a single flat constant applying to every
// interval (1 to 60 months) rather than scaling with interval_months --
// the flexible-cadence session didn't ask for interval-scaled lead times,
// and a flat 10 days is a reasonable, easy-to-reason-about default for a
// first pass. Worth revisiting later if a 24-month (biennial) category
// wants more runway than a 10-day heads-up gives it.
const RECURRENCE_GENERATION_LEAD_DAYS = 10;

// ── Helpers ──────────────────────────────────────────────────────────────────

function toDateOnlyString(date) {
  return date.toISOString().split('T')[0];
}

// ── Step 2a: reminder ladder ─────────────────────────────────────────────────
// Unchanged in spirit from before the flexible-cadence session: reads
// whatever reminder_ladder_days is actually stored per category (always
// has been data-driven, never hard-coded per cadence type) -- only the
// reminder_log write shape changed, from a single `tier` string column to
// tier_type='DAYS_BEFORE' + days_before=<threshold>.

async function processReminderLadder(dryRun, summary) {
  const items = await pool.query(`
    SELECT ci.item_id, ci.due_date, ci.category_id,
           (ci.due_date - CURRENT_DATE) AS days_until_due,
           cc.reminder_ladder_days
    FROM compliance_items ci
    JOIN compliance_categories cc ON cc.category_id = ci.category_id
    WHERE ci.status = 'APPROVED'
  `);

  for (const item of items.rows) {
    const thresholds = item.reminder_ladder_days || [];
    for (const threshold of thresholds) {
      if (item.days_until_due > threshold) continue; // not reached yet

      // "Ever sent" check (not just today) -- these tiers fire once per
      // item, with catch-up if a scheduler run was missed on the exact day.
      const already = await pool.query(
        `SELECT 1 FROM compliance_reminder_log WHERE item_id = $1 AND tier_type = 'DAYS_BEFORE' AND days_before = $2 LIMIT 1`,
        [item.item_id, threshold]
      );
      if (already.rows.length > 0) continue;

      const emails = await NotificationService.getComplianceNotificationEmails(EXECUTIVE_ROLES);
      summary.reminders_sent.push({ item_id: item.item_id, days_before: threshold, days_until_due: item.days_until_due, recipients: emails });

      if (!dryRun) {
        await pool.query(
          `INSERT INTO compliance_reminder_log (item_id, tier_type, days_before) VALUES ($1, 'DAYS_BEFORE', $2)
           ON CONFLICT (item_id, tier_type, days_before, sent_date) DO NOTHING`,
          [item.item_id, threshold]
        );
        const html = `<p>Compliance item is due in ${item.days_until_due} day(s) (due ${toDateOnlyString(new Date(item.due_date))}).</p>
          <p>Please log in to the Vilagio ERP Compliance module to review.</p>`;
        NotificationService.sendEmail(emails, `Compliance Reminder: ${threshold} days before due`, html).catch(console.error);
      }
    }
  }
}

// ── Step 2b/2c: NON_COMPLIANT transition + daily escalation ────────────────
// Unchanged logic -- purely status/due-date/ack based, never depended on
// cadence. Only the reminder_log write shape changed.

async function processNonCompliantAndEscalations(dryRun, summary) {
  const newlyOverdue = await pool.query(`
    SELECT ci.item_id FROM compliance_items ci
    WHERE ci.status = 'APPROVED' AND ci.due_date < CURRENT_DATE
      AND NOT EXISTS (SELECT 1 FROM compliance_acknowledgements a WHERE a.item_id = ci.item_id)
  `);

  const dryRunFlippedIds = [];
  for (const row of newlyOverdue.rows) {
    summary.items_flipped_non_compliant.push({ item_id: row.item_id });
    if (!dryRun) {
      await pool.query(
        `UPDATE compliance_items SET status = 'NON_COMPLIANT', updated_at = CURRENT_TIMESTAMP
         WHERE item_id = $1 AND status = 'APPROVED'`,
        [row.item_id]
      );
    } else {
      dryRunFlippedIds.push(row.item_id);
    }
  }

  const alreadyNonCompliant = await pool.query(`
    SELECT ci.item_id FROM compliance_items ci
    WHERE ci.status = 'NON_COMPLIANT'
      AND NOT EXISTS (SELECT 1 FROM compliance_acknowledgements a WHERE a.item_id = ci.item_id)
  `);
  const escalationCandidateIds = new Set(alreadyNonCompliant.rows.map((r) => r.item_id));
  if (dryRun) dryRunFlippedIds.forEach((id) => escalationCandidateIds.add(id));

  const emails = await NotificationService.getComplianceNotificationEmails(EXECUTIVE_ROLES);

  for (const itemId of escalationCandidateIds) {
    if (!dryRun) {
      const inserted = await pool.query(
        `INSERT INTO compliance_reminder_log (item_id, tier_type) VALUES ($1, 'OVERDUE_ESCALATION')
         ON CONFLICT (item_id, tier_type, days_before, sent_date) DO NOTHING
         RETURNING reminder_log_id`,
        [itemId]
      );
      if (inserted.rows.length === 0) continue; // already escalated today

      const html = `<p>A compliance item is overdue and unacknowledged.</p>
        <p>Please log in to the Vilagio ERP Compliance module to review immediately.</p>`;
      NotificationService.sendEmail(emails, `OVERDUE: Compliance Item Requires Immediate Action`, html).catch(console.error);
      summary.escalations_sent.push({ item_id: itemId, recipients: emails });
    } else {
      const already = await pool.query(
        `SELECT 1 FROM compliance_reminder_log WHERE item_id = $1 AND tier_type = 'OVERDUE_ESCALATION' AND sent_date = CURRENT_DATE LIMIT 1`,
        [itemId]
      );
      if (already.rows.length > 0) continue;
      summary.escalations_sent.push({ item_id: itemId, recipients: emails });
    }
  }
}

// ── Step 3: recurrence auto-generation (generalised from monthly-only) ─────
// next due = previous due + interval_months, day clamped to month end --
// applies to every RECURRING cadence now, including ANNUAL (per explicit
// decision this session; previously only MONTHLY_RECURRING ever
// auto-generated). Idempotent via compliance_items_rule_due_date_unique
// (UNIQUE(recurrence_rule_id, due_date) WHERE recurrence_rule_id IS NOT
// NULL) -- ON CONFLICT DO NOTHING is the actual guarantee; the "does an
// upcoming occurrence already exist" check below is what keeps this from
// generating a second occurrence too far in advance, not what prevents
// duplicates (the unique index does that).
async function processRecurrence(dryRun, summary) {
  const rules = await pool.query(`
    SELECT rule_id, category_id, interval_months, day_of_month_due, last_reapproved_by
    FROM compliance_recurrence_rule
    WHERE is_active = true
  `);

  const today = new Date(Date.UTC(
    new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate()
  ));

  for (const rule of rules.rows) {
    if (rule.interval_months == null || rule.day_of_month_due == null) continue; // rule not fully configured

    const existing = await pool.query(
      `SELECT item_id, due_date FROM compliance_items WHERE recurrence_rule_id = $1 AND due_date >= CURRENT_DATE ORDER BY due_date DESC LIMIT 1`,
      [rule.rule_id]
    );

    let nextDue;
    if (existing.rows.length > 0) {
      continue; // upcoming occurrence already exists
    } else {
      // No upcoming occurrence -- base the next one off the most recent
      // occurrence ever generated for this rule (any status), or today if
      // this rule has literally never generated anything yet.
      const mostRecentAny = await pool.query(
        `SELECT due_date FROM compliance_items WHERE recurrence_rule_id = $1 ORDER BY due_date DESC LIMIT 1`,
        [rule.rule_id]
      );
      const base = mostRecentAny.rows.length > 0 ? new Date(mostRecentAny.rows[0].due_date) : today;
      nextDue = complianceService.nextDueDateClamped(base, rule.interval_months, rule.day_of_month_due);
    }

    const daysUntil = Math.round((nextDue - today) / (1000 * 60 * 60 * 24));
    if (daysUntil > RECURRENCE_GENERATION_LEAD_DAYS) continue; // too early to generate yet

    const dueDateStr = toDateOnlyString(nextDue);
    summary.recurring_items_generated.push({ rule_id: rule.rule_id, category_id: rule.category_id, due_date: dueDateStr });

    if (!dryRun) {
      // Attributed to the rule's last_reapproved_by -- the person
      // accountable for this recurring obligation -- since there is no
      // "system" user in this app and created_by is NOT NULL.
      const actor = rule.last_reapproved_by;
      if (!actor) {
        console.error(`⚠️ [Compliance Scheduler] Cannot auto-generate item for rule ${rule.rule_id}: no last_reapproved_by set.`);
        continue;
      }
      const insertRes = await pool.query(
        `INSERT INTO compliance_items (category_id, due_date, status, created_by, approved_by, approved_at, recurrence_rule_id)
         VALUES ($1, $2, 'APPROVED', $3, $3, CURRENT_TIMESTAMP, $4)
         ON CONFLICT (recurrence_rule_id, due_date) WHERE recurrence_rule_id IS NOT NULL DO NOTHING
         RETURNING item_id`,
        [rule.category_id, dueDateStr, actor, rule.rule_id]
      );
      if (insertRes.rows.length === 0) continue; // idempotency guard caught a concurrent/duplicate run

      await pool.query(
        `INSERT INTO audit_log (table_name, record_id, action, new_values, performed_by, user_id)
         VALUES ('compliance_items', $1, 'AUTO_GENERATED', $2, $3, $3)`,
        [insertRes.rows[0].item_id, JSON.stringify({ rule_id: rule.rule_id, category_id: rule.category_id, due_date: dueDateStr }), actor]
      );
    }
  }
}

// ── Step 4: 12-month re-approval reminder ───────────────────────────────────
// Unchanged -- fixed 12 months regardless of interval_months, per the
// explicit decision to keep this rule exactly as it was. Only the
// reminder_log write shape changed.
async function processReapprovalReminders(dryRun, summary) {
  const rules = await pool.query(`
    SELECT rule_id, category_id, next_reapproval_due
    FROM compliance_recurrence_rule
    WHERE is_active = true AND next_reapproval_due <= (CURRENT_DATE + INTERVAL '30 days')
  `);

  if (rules.rows.length === 0) return;

  const emails = await NotificationService.getComplianceNotificationEmails(EXECUTIVE_ROLES);

  for (const rule of rules.rows) {
    if (!dryRun) {
      const inserted = await pool.query(
        `INSERT INTO compliance_reminder_log (rule_id, tier_type) VALUES ($1, 'REAPPROVAL_REMINDER')
         ON CONFLICT (rule_id, tier_type, days_before, sent_date) WHERE rule_id IS NOT NULL DO NOTHING
         RETURNING reminder_log_id`,
        [rule.rule_id]
      );
      if (inserted.rows.length === 0) continue; // already reminded today

      summary.reapproval_reminders_sent.push({ rule_id: rule.rule_id, next_reapproval_due: rule.next_reapproval_due, recipients: emails });
      const html = `<p>A recurring compliance category's annual re-approval is due on ${toDateOnlyString(new Date(rule.next_reapproval_due))}.</p>
        <p>Please log in to the Vilagio ERP Compliance module to review and re-approve.</p>`;
      NotificationService.sendEmail(emails, `Compliance Re-Approval Due Within 30 Days`, html).catch(console.error);
    } else {
      const already = await pool.query(
        `SELECT 1 FROM compliance_reminder_log WHERE rule_id = $1 AND tier_type = 'REAPPROVAL_REMINDER' AND sent_date = CURRENT_DATE LIMIT 1`,
        [rule.rule_id]
      );
      if (already.rows.length > 0) continue;
      summary.reapproval_reminders_sent.push({ rule_id: rule.rule_id, next_reapproval_due: rule.next_reapproval_due, recipients: emails });
    }
  }
}

// ── Step 5: RETURNED item gone stale (Phase C) ──────────────────────────────
// A RETURNED item is deliberately excluded from processReminderLadder/
// processNonCompliantAndEscalations above (both only ever look at
// status = 'APPROVED') -- no reminders, no escalation, while it's waiting
// on the creator to fix and resubmit it. This is the one exception: if
// it's sat RETURNED for more than 7 days with nobody resubmitting it,
// Admin gets a nudge so it doesn't just quietly rot. Scoped to items only,
// not categories -- categories have no due date or reminder ladder to
// reason about urgency around, and the spec this was built from ties this
// specifically to "reminders/escalation," machinery that only exists for
// items. Same once-per-day dedup shape as OVERDUE_ESCALATION.
async function processReturnedStaleNotifications(dryRun, summary) {
  const staleItems = await pool.query(`
    SELECT item_id FROM compliance_items
    WHERE status = 'RETURNED' AND updated_at <= (CURRENT_TIMESTAMP - INTERVAL '7 days')
  `);

  if (staleItems.rows.length === 0) return;

  const emails = await NotificationService.getComplianceNotificationEmails(['admin']);

  for (const row of staleItems.rows) {
    if (!dryRun) {
      const inserted = await pool.query(
        `INSERT INTO compliance_reminder_log (item_id, tier_type) VALUES ($1, 'RETURNED_STALE')
         ON CONFLICT (item_id, tier_type, days_before, sent_date) DO NOTHING
         RETURNING reminder_log_id`,
        [row.item_id]
      );
      if (inserted.rows.length === 0) continue; // already notified today

      summary.returned_stale_notified.push({ item_id: row.item_id, recipients: emails });
      const html = `<p>A compliance item was returned for revision more than 7 days ago and has not been resubmitted.</p>
        <p>Please follow up with the creator, or review it directly in the Vilagio ERP Compliance module.</p>`;
      NotificationService.sendEmail(emails, `Compliance Item Returned 7+ Days Ago — Needs Follow-up`, html).catch(console.error);
    } else {
      const already = await pool.query(
        `SELECT 1 FROM compliance_reminder_log WHERE item_id = $1 AND tier_type = 'RETURNED_STALE' AND sent_date = CURRENT_DATE LIMIT 1`,
        [row.item_id]
      );
      if (already.rows.length > 0) continue;
      summary.returned_stale_notified.push({ item_id: row.item_id, recipients: emails });
    }
  }
}

// ── Entry point ──────────────────────────────────────────────────────────────

async function runScheduler({ dryRun = false } = {}) {
  const summary = {
    dry_run: dryRun,
    reminders_sent: [],
    items_flipped_non_compliant: [],
    escalations_sent: [],
    recurring_items_generated: [],
    reapproval_reminders_sent: [],
    returned_stale_notified: [],
  };

  await processReminderLadder(dryRun, summary);
  await processNonCompliantAndEscalations(dryRun, summary);
  await processRecurrence(dryRun, summary);
  await processReapprovalReminders(dryRun, summary);
  await processReturnedStaleNotifications(dryRun, summary);

  return summary;
}

module.exports = { runScheduler, EXECUTIVE_ROLES };
