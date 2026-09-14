'use strict';

const { pool } = require('./auth-service');
const NotificationService = require('./notification-service');

const EXECUTIVE_ROLES = ['admin', 'cfo', 'ceo'];

// Auto-generation lead time for MONTHLY_RECURRING items: how many days
// before the next occurrence's due date the scheduler creates the next
// compliance_items row. 10 days, per the session's suggested default.
// Worth flagging: for a monthly-cadence item, a 10-day lead time means
// the 30_DAY and 15_DAY reminder-ladder tiers (if a category uses the
// default ladder) will both already be "reached" the moment the item is
// generated, and fire together in the same run rather than with real
// advance notice -- only 10_DAY and 5_DAY get genuine lead time. This is
// an inherent property of monthly recurrence against a 30/15/10/5 ladder,
// not a flaw in the 10-day choice: generating far enough ahead for a real
// 30-day lead (e.g. 35+ days) would mean the "next" item already exists
// for most of the current item's own lifecycle, which is worse.
const MONTHLY_GENERATION_LEAD_DAYS = 10;

// ── Helpers ──────────────────────────────────────────────────────────────────

function tierLabelForThreshold(days) {
  return `${days}_DAY`;
}

// Clamps for short months (e.g. day_of_month_due=31 in February -> Feb 28/29).
// Always returns a date >= `from`.
function nextOccurrenceOfDayOfMonth(dayOfMonth, from) {
  const tryDate = (year, month) => {
    const lastDayOfMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    const day = Math.min(dayOfMonth, lastDayOfMonth);
    return new Date(Date.UTC(year, month, day));
  };
  let candidate = tryDate(from.getUTCFullYear(), from.getUTCMonth());
  if (candidate < from) {
    candidate = tryDate(from.getUTCFullYear(), from.getUTCMonth() + 1);
  }
  return candidate;
}

function toDateOnlyString(date) {
  return date.toISOString().split('T')[0];
}

// ── Step 2a: reminder ladder ─────────────────────────────────────────────────

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

      const tier = tierLabelForThreshold(threshold);

      // "Ever sent" check (not just today) -- these tiers fire once per
      // item, with catch-up if a scheduler run was missed on the exact day.
      const already = await pool.query(
        `SELECT 1 FROM compliance_reminder_log WHERE item_id = $1 AND tier = $2 LIMIT 1`,
        [item.item_id, tier]
      );
      if (already.rows.length > 0) continue;

      const emails = await NotificationService.getEmailsByRole(EXECUTIVE_ROLES);
      summary.reminders_sent.push({ item_id: item.item_id, tier, days_until_due: item.days_until_due, recipients: emails });

      if (!dryRun) {
        await pool.query(
          `INSERT INTO compliance_reminder_log (item_id, tier) VALUES ($1, $2)
           ON CONFLICT (item_id, tier, sent_date) DO NOTHING`,
          [item.item_id, tier]
        );
        const html = `<p>Compliance item is due in ${item.days_until_due} day(s) (due ${toDateOnlyString(new Date(item.due_date))}).</p>
          <p>Please log in to the Vilagio ERP Compliance module to review.</p>`;
        NotificationService.sendEmail(emails, `Compliance Reminder: ${tier.replace('_', ' ')} — item due soon`, html).catch(console.error);
      }
    }
  }
}

// ── Step 2b/2c: NON_COMPLIANT transition + daily escalation ────────────────

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

  // Already-NON_COMPLIANT items with no ack (includes items just flipped
  // above, once committed) plus, in dry-run mode, the ones that WOULD have
  // just flipped (since the DB was never actually updated).
  const alreadyNonCompliant = await pool.query(`
    SELECT ci.item_id FROM compliance_items ci
    WHERE ci.status = 'NON_COMPLIANT'
      AND NOT EXISTS (SELECT 1 FROM compliance_acknowledgements a WHERE a.item_id = ci.item_id)
  `);
  const escalationCandidateIds = new Set(alreadyNonCompliant.rows.map((r) => r.item_id));
  if (dryRun) dryRunFlippedIds.forEach((id) => escalationCandidateIds.add(id));

  const emails = await NotificationService.getEmailsByRole(EXECUTIVE_ROLES);

  for (const itemId of escalationCandidateIds) {
    if (!dryRun) {
      const inserted = await pool.query(
        `INSERT INTO compliance_reminder_log (item_id, tier) VALUES ($1, 'OVERDUE_ESCALATION')
         ON CONFLICT (item_id, tier, sent_date) DO NOTHING
         RETURNING reminder_log_id`,
        [itemId]
      );
      if (inserted.rows.length === 0) continue; // already escalated today

      const html = `<p>A compliance item is overdue and unacknowledged.</p>
        <p>Please log in to the Vilagio ERP Compliance module to review immediately.</p>`;
      NotificationService.sendEmail(emails, `OVERDUE: Compliance Item Requires Immediate Action`, html).catch(console.error);
      summary.escalations_sent.push({ item_id: itemId, recipients: emails });
    } else {
      // Dry run: report whether today's escalation for this item has
      // already been logged (so the summary reflects real would-skip too).
      const already = await pool.query(
        `SELECT 1 FROM compliance_reminder_log WHERE item_id = $1 AND tier = 'OVERDUE_ESCALATION' AND sent_date = CURRENT_DATE LIMIT 1`,
        [itemId]
      );
      if (already.rows.length > 0) continue;
      summary.escalations_sent.push({ item_id: itemId, recipients: emails });
    }
  }
}

// ── Step 3: monthly auto-generation ─────────────────────────────────────────

async function processMonthlyRecurrence(dryRun, summary) {
  const rules = await pool.query(`
    SELECT rule_id, category_id, day_of_month_due, last_reapproved_by
    FROM compliance_recurrence_rule
    WHERE is_active = true AND recurrence_type = 'MONTHLY_RECURRING'
  `);

  const today = new Date(Date.UTC(
    new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate()
  ));

  for (const rule of rules.rows) {
    const existing = await pool.query(
      `SELECT item_id FROM compliance_items WHERE recurrence_rule_id = $1 AND due_date >= CURRENT_DATE LIMIT 1`,
      [rule.rule_id]
    );
    if (existing.rows.length > 0) continue; // upcoming occurrence already exists

    if (rule.day_of_month_due == null) continue; // rule not fully configured

    const nextDue = nextOccurrenceOfDayOfMonth(rule.day_of_month_due, today);
    const daysUntil = Math.round((nextDue - today) / (1000 * 60 * 60 * 24));
    if (daysUntil > MONTHLY_GENERATION_LEAD_DAYS) continue; // too early to generate yet

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
      await pool.query(
        `INSERT INTO compliance_items (category_id, due_date, status, created_by, approved_by, approved_at, recurrence_rule_id)
         VALUES ($1, $2, 'APPROVED', $3, $3, CURRENT_TIMESTAMP, $4)`,
        [rule.category_id, dueDateStr, actor, rule.rule_id]
      );
    }
  }
}

// ── Step 4: 12-month re-approval reminder ───────────────────────────────────
//
// compliance_reminder_log.item_id is NOT NULL and its tier CHECK constraint
// only allows the 5 item-level values -- there is no schema-supported way to
// log a rule-level (not item-level) reminder without either changing that
// schema (out of this session's scope) or risking corrupting a real item's
// own ladder/escalation dedup by reusing one of its tier values against an
// unrelated row. Flagging this rather than silently picking a workaround:
// this reminder is NOT persisted to compliance_reminder_log at all, and
// instead fires every day the rule is within the 30-day window (the same
// "repeat until resolved" shape as OVERDUE_ESCALATION), gated purely by
// next_reapproval_due. The correct long-term fix is a small follow-up
// migration (a nullable item_id + a new rule_id column, or a separate
// compliance_rule_reminder_log table) -- deliberately not done here.
async function processReapprovalReminders(dryRun, summary) {
  const rules = await pool.query(`
    SELECT rule_id, category_id, next_reapproval_due
    FROM compliance_recurrence_rule
    WHERE is_active = true AND next_reapproval_due <= (CURRENT_DATE + INTERVAL '30 days')
  `);

  if (rules.rows.length === 0) return;

  const emails = await NotificationService.getEmailsByRole(EXECUTIVE_ROLES);

  for (const rule of rules.rows) {
    summary.reapproval_reminders_sent.push({ rule_id: rule.rule_id, next_reapproval_due: rule.next_reapproval_due, recipients: emails });
    if (!dryRun) {
      const html = `<p>A recurring compliance category's annual re-approval is due on ${toDateOnlyString(new Date(rule.next_reapproval_due))}.</p>
        <p>Please log in to the Vilagio ERP Compliance module to review and re-approve.</p>`;
      NotificationService.sendEmail(emails, `Compliance Re-Approval Due Within 30 Days`, html).catch(console.error);
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
  };

  await processReminderLadder(dryRun, summary);
  await processNonCompliantAndEscalations(dryRun, summary);
  await processMonthlyRecurrence(dryRun, summary);
  await processReapprovalReminders(dryRun, summary);

  return summary;
}

module.exports = { runScheduler, EXECUTIVE_ROLES, nextOccurrenceOfDayOfMonth, tierLabelForThreshold };
