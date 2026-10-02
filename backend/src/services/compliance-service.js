'use strict';

const { types: pgTypes } = require('pg');
const { pool } = require('./auth-service');

// node-postgres's DEFAULT type parser for a DATE column builds a JS Date at
// LOCAL midnight of the calendar date, not UTC midnight. Reading that Date
// back out with a UTC method (getUTCDate/toISOString) on any machine whose
// local timezone isn't UTC silently shifts the displayed/derived date by a
// day -- confirmed live during feature/compliance-register-ux Step 0 (masked
// in production only because Render's runtime happens to be UTC; would bite
// immediately on local dev or if the deploy platform's timezone ever
// changes). Fix: every compliance query gets DATE columns back as plain
// 'YYYY-MM-DD' strings instead, via a type-parser override scoped to just
// these queries -- NOT pg.types.setTypeParser globally, which would affect
// every other module sharing this same pool (QMS, inventory expiry dates,
// etc.), something this fix must not touch.
const DATE_OID = 1082;
const dateAsTextParsers = {
  getTypeParser: (oid, format) => (oid === DATE_OID ? (val) => val : pgTypes.getTypeParser(oid, format)),
};

// Drop-in replacement for a pg Pool/PoolClient's .query(text, values) --
// same call shape, so every existing call site in this module works
// unchanged, just returns DATE columns as text. `db` below wraps the shared
// pool for this file's own bare pool.query(...) calls; withTransaction wraps
// each checked-out client the same way before handing it to its callback.
function wrapQueryable(queryable) {
  return { query: (text, values) => queryable.query({ text, values, types: dateAsTextParsers }) };
}

const db = wrapQueryable(pool);

const EXECUTIVE_ROLES = ['admin', 'cfo', 'ceo'];

// FILING and RENEWAL each have exactly one generator for a category's next
// period, and never the other (feature/compliance-register-ux, Step 2):
//   FILING  -- the scheduler (processRecurrence) and the one-time bootstrap
//              on category approval. Never manual, never verification.
//   RENEWAL -- verification only (verifyComplianceItem creates the next
//              UPCOMING period from the certificate's confirmed expiry).
//              The scheduler explicitly skips RENEWAL categories. The very
//              FIRST period for a RENEWAL category has no prior period to
//              verify, so it's manually registered once (createComplianceItem
//              allows exactly one such registration), same as a ONE_OFF item.
const OBLIGATION_KINDS = ['FILING', 'RENEWAL'];

// New-vocabulary statuses a legacy endpoint (submit/approve/reject/return/
// resubmit) should never see -- a period on one of these already went
// through upload/verify, not draft/submit/approve, so hitting one of the
// old endpoints means the caller (an old bookmark, a stale frontend build,
// a script) is using the wrong API surface entirely, not just the wrong
// status. Kept separate from each function's own real status guard (e.g.
// submit still needs DRAFT specifically) so this gives a distinct,
// actionable message instead of a generic "wrong status" one.
const NEW_VOCABULARY_STATUSES = ['UPCOMING', 'EVIDENCE_SUBMITTED', 'VERIFIED'];

function assertNotNewVocabularyItem(item, legacyActionName) {
  if (NEW_VOCABULARY_STATUSES.includes(item.status)) {
    const err = new Error(
      `This item (${item.status}) uses the new evidence/verify lifecycle, not the legacy ${legacyActionName} flow. ` +
      `Use POST /items/:id/evidence and POST /items/:id/verify instead.`
    );
    err.statusCode = 400;
    throw err;
  }
}

// Deprecated (unread by anything below) -- kept only because the column
// itself is kept for one release per the flexible-cadence migration. New
// code validates against CADENCE_TYPES instead.
const RECURRENCE_TYPES = ['ONE_OFF_EXPIRY', 'MONTHLY_RECURRING', 'ANNUAL_RECURRING'];

const CADENCE_TYPES = ['ONE_OFF', 'RECURRING'];
const MIN_INTERVAL_MONTHS = 1;
const MAX_INTERVAL_MONTHS = 60;

// Single config object for the reminder-ladder DEFAULT pre-filled at
// category creation -- interval only ever sets the starting point; the
// ladder itself stays per-category and freely overridable afterward (see
// createComplianceCategory below, which accepts an explicit
// reminder_ladder_days and only falls back to this when none is given).
// RENEWAL gets a longer-lead default (60/30/15/7) regardless of interval --
// a certificate renewal typically needs more runway to arrange than a
// routine filing does -- per explicit instruction; existing categories keep
// whatever ladder they already have, this only affects new ones.
function defaultReminderLadderForCadence(cadenceType, intervalMonths, obligationKind) {
  if (obligationKind === 'RENEWAL') return [60, 30, 15, 7];
  if (cadenceType === 'RECURRING' && intervalMonths === 1) return [5];
  if (cadenceType === 'RECURRING' && intervalMonths >= 2 && intervalMonths <= 5) return [14, 7, 3];
  return [30, 15, 10]; // ONE_OFF, or RECURRING >= 6 months
}

// The one and only place "next due = previous + interval, day clamped to
// month end" is computed -- shared by manual item registration
// (createComplianceItem below) and the scheduler's auto-generation
// (compliance-scheduler-service.js), so the two can never drift apart.
// Pure string/integer arithmetic -- baseDateStr and the return value are
// both plain 'YYYY-MM-DD' strings throughout, never a Date object built
// from a DB-read value (see the dateAsTextParsers comment above for why).
function nextDueDateClamped(baseDateStr, intervalMonths, dueDayOfMonth) {
  const [baseYear, baseMonth] = baseDateStr.split('-').map(Number); // baseMonth is 1-12
  const totalMonths = baseYear * 12 + (baseMonth - 1) + intervalMonths;
  const targetYear = Math.floor(totalMonths / 12);
  const targetMonth = (totalMonths % 12) + 1; // back to 1-12
  // Date.UTC/getUTCDate here are pure calendar-math primitives on integers
  // this function already owns -- UTC in, UTC out, no dependency on the
  // Node process's own timezone (unlike parsing a date back out of the DB).
  const lastDayOfTargetMonth = new Date(Date.UTC(targetYear, targetMonth, 0)).getUTCDate();
  const day = Math.min(dueDayOfMonth, lastDayOfTargetMonth);
  return `${targetYear}-${String(targetMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

// Validates a caller-supplied date-only string: real calendar date, plausible
// year. The PACRA data-quality issue found in Step 0 -- a 5-digit year,
// "82027", reached compliance_items.due_date with nothing catching it -- is
// exactly what the year-range check closes. Never constructs a Date object
// from the value itself; returns the same validated string back.
function validateDateOnly(value, fieldName) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const err = new Error(`${fieldName} must be a date in YYYY-MM-DD format.`);
    err.statusCode = 400;
    throw err;
  }
  const [year, month, day] = value.split('-').map(Number);
  if (year < 2000 || year > 2100) {
    const err = new Error(`${fieldName}'s year must be between 2000 and 2100.`);
    err.statusCode = 400;
    throw err;
  }
  if (month < 1 || month > 12) {
    const err = new Error(`${fieldName} is not a valid date.`);
    err.statusCode = 400;
    throw err;
  }
  const lastDayOfMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (day < 1 || day > lastDayOfMonth) {
    const err = new Error(`${fieldName} is not a valid date.`);
    err.statusCode = 400;
    throw err;
  }
  return value;
}

// Shared minimum for a return/reject reason (Phase C) -- long enough to
// force an actual explanation, not a one-word brush-off like "no".
const MIN_REASON_LENGTH = 10;

function validateReason(reason, action) {
  if (!reason || reason.trim().length < MIN_REASON_LENGTH) {
    const err = new Error(`A ${action} reason of at least ${MIN_REASON_LENGTH} characters is required.`);
    err.statusCode = 400;
    throw err;
  }
  return reason.trim();
}

// Runs `work(client)` inside BEGIN/COMMIT/ROLLBACK with the same crash-safe
// client.on('error') handler approveComplianceItem has always needed (see
// its own comment for why: a client checked out via pool.connect() emits
// connection-level errors directly on itself, which pool-level handlers
// never see -- unhandled, that's an uncaught exception that crashes the
// whole process, confirmed live once already in this codebase's history).
// Centralised here since Phase C adds several more manual-transaction
// functions (return/resubmit/edit, for both categories and items) that all
// need the identical protection.
const withTransaction = async (work) => {
  const client = await pool.connect();
  client.on('error', (err) => {
    console.error('❌ Unexpected error on compliance client connection:', err.message);
  });
  try {
    await client.query('BEGIN');
    // work() gets the date-as-text-wrapped client, not the raw one -- every
    // client.query(...) call inside an approve/reject/return/archive/etc.
    // function needs the same DATE-column-as-string behavior db.query(...)
    // gives bare pool queries. BEGIN/COMMIT/ROLLBACK above run on the raw
    // client since they return no rows.
    const result = await work(wrapQueryable(client));
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

// Every approve/return/reject/resubmit/edit writes one of these in the same
// transaction as its status/field change, per Phase C's explicit
// requirement -- reuses the existing, already-append-only audit_log table
// rather than a new one (confirmed via grep before this session: nothing
// in this codebase ever UPDATEs or DELETEs an audit_log row).
const writeAuditLog = async (client, { tableName, recordId, action, oldValues, newValues, userId }) => {
  await client.query(
    `INSERT INTO audit_log (table_name, record_id, action, old_values, new_values, performed_by, user_id)
     VALUES ($1, $2, $3, $4, $5, $6, $6)`,
    [
      tableName, recordId, action,
      oldValues ? JSON.stringify(oldValues) : null,
      newValues ? JSON.stringify(newValues) : null,
      userId,
    ]
  );
};

// Shallow-picks a subset of keys from a row for an audit_log old/new
// snapshot -- narrows to just the fields a given edit actually touched
// rather than dumping the entire row both ways.
function pickFields(row, keys) {
  const out = {};
  for (const k of keys) out[k] = row[k];
  return out;
}

// ─── Categories (Phase 5) ───────────────────────────────────────────────────
// Categories were previously only ever created by direct DB insert (see
// tests/helpers/test-helper.js's createComplianceCategory, and every ad hoc
// verification script across Phases 2-4). This is the first real API
// surface for them -- create/list/update, deliberately NOT delete (a
// category with items pointing at it should be deactivated, not removed).

// Every new category lands PENDING_APPROVAL regardless of who creates it --
// including admin/cfo/ceo. Mirrors compliance_items' self-approval pattern
// exactly (an executive CAN approve their own category, but only with a
// mandatory justification -- see approveComplianceCategory below), not a
// stricter "must be a different person" rule. A category defines the
// reminder ladder and cadence every future item under it inherits, so it's
// at least as consequential as a single item and deserves the same
// deliberate-approval step, not a rubber stamp -- but a hard block on
// self-approval would risk a real bottleneck given this org currently has
// only two active executives (admin, cfo) and zero active ceo.
// Shared between createComplianceCategory and updateComplianceCategory's
// RETURNED-only cadence-edit path (Bug 2, Phase C addendum) -- "editable,
// validated by the same rules as creation" means literally the same
// function, not a re-typed copy that could quietly drift from it.
// Returns the normalized { cadenceType, intervalMonths, dueDayOfMonth,
// anchorDate } to persist, or throws a 400.
function validateCadenceFields({ cadence_type, interval_months, anchor_date, due_day_of_month, obligation_kind }) {
  if (!CADENCE_TYPES.includes(cadence_type)) {
    const err = new Error(`cadence_type must be one of: ${CADENCE_TYPES.join(', ')}.`);
    err.statusCode = 400;
    throw err;
  }

  if (cadence_type === 'ONE_OFF') {
    return { cadenceType: 'ONE_OFF', intervalMonths: null, dueDayOfMonth: null, anchorDate: null };
  }

  const intervalMonths = Number(interval_months);
  if (!Number.isInteger(intervalMonths) || intervalMonths < MIN_INTERVAL_MONTHS || intervalMonths > MAX_INTERVAL_MONTHS) {
    const err = new Error(`interval_months is required for a RECURRING category and must be an integer between ${MIN_INTERVAL_MONTHS} and ${MAX_INTERVAL_MONTHS}.`);
    err.statusCode = 400;
    throw err;
  }
  // anchor_date is the source of truth for "first due date" -- required at
  // the API layer (not just the UI) ONLY for FILING, whose one generator
  // (the scheduler/approval bootstrap) needs it to create the first period
  // itself. A RENEWAL category's due date always comes from the certificate
  // actually held, supplied at item-registration time -- interval_months
  // here is purely informational (how often this kind of cert typically
  // renews), so anchor_date/due_day_of_month stay optional and are left
  // null unless the caller supplies anchor_date anyway.
  if (obligation_kind !== 'RENEWAL' && !anchor_date) {
    const err = new Error('anchor_date (first due date) is required for a RECURRING category.');
    err.statusCode = 400;
    throw err;
  }
  if (!anchor_date) {
    return { cadenceType: 'RECURRING', intervalMonths, dueDayOfMonth: null, anchorDate: null };
  }
  const anchorDate = validateDateOnly(anchor_date, 'anchor_date');
  const anchorDay = Number(anchorDate.split('-')[2]);
  const dueDayOfMonth = due_day_of_month != null ? Number(due_day_of_month) : anchorDay;
  if (!Number.isInteger(dueDayOfMonth) || dueDayOfMonth < 1 || dueDayOfMonth > 31) {
    const err = new Error('due_day_of_month must be an integer between 1 and 31.');
    err.statusCode = 400;
    throw err;
  }
  return { cadenceType: 'RECURRING', intervalMonths, dueDayOfMonth, anchorDate };
}

const createComplianceCategory = async ({
  name, regulator, cadence_type, interval_months, due_day_of_month, anchor_date,
  reminder_ladder_days, obligation_kind, responsible_user_id, created_by,
}) => {
  if (!name || !name.trim()) {
    const err = new Error('name is required.');
    err.statusCode = 400;
    throw err;
  }
  // Required going forward (Phase 2 point 4) -- the one existing exception
  // (LAND OCCUPIERS CERTIFICATE, left NULL pending confirmation of whether
  // it expires) is legacy data from before this field existed, not a case
  // new creation should be allowed to reproduce.
  if (!OBLIGATION_KINDS.includes(obligation_kind)) {
    const err = new Error(`obligation_kind must be one of: ${OBLIGATION_KINDS.join(', ')}.`);
    err.statusCode = 400;
    throw err;
  }

  const { cadenceType: cadence_type_v, intervalMonths, dueDayOfMonth, anchorDate } = validateCadenceFields({
    cadence_type, interval_months, anchor_date, due_day_of_month, obligation_kind,
  });
  cadence_type = cadence_type_v;

  const ladder = reminder_ladder_days ?? defaultReminderLadderForCadence(cadence_type, intervalMonths, obligation_kind);
  if (!Array.isArray(ladder) || ladder.length === 0 || !ladder.every((d) => Number.isInteger(d) && d > 0)) {
    const err = new Error('reminder_ladder_days must be a non-empty array of positive integers.');
    err.statusCode = 400;
    throw err;
  }

  const result = await db.query(
    `INSERT INTO compliance_categories
       (name, regulator, cadence_type, interval_months, due_day_of_month, anchor_date, reminder_ladder_days,
        obligation_kind, responsible_user_id, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
    [name.trim(), regulator || null, cadence_type, intervalMonths, dueDayOfMonth, anchorDate, ladder,
     obligation_kind, responsible_user_id || null, created_by]
  );
  return result.rows[0];
};

// status filter powers three different views with one function:
//   - Register's category picker: status: 'ACTIVE' (+ activeOnly for
//     is_active -- both must hold, see the route for how they're combined).
//   - Categories management page: no status filter, everything.
//   - Approval queue: status: 'PENDING_APPROVAL'.
const listComplianceCategories = async ({ activeOnly, status, showArchived } = {}) => {
  const conditions = [];
  const values = [];
  let i = 1;

  if (activeOnly) conditions.push(`is_active = true`);
  if (status) { conditions.push(`status = $${i++}`); values.push(status); }
  // ARCHIVED is hidden from every default list -- a caller sees it only by
  // explicitly asking for it (showArchived) or by filtering to that exact
  // status, same "off by default" rule the spec asks for on every list.
  if (!showArchived && !status) conditions.push(`status != 'ARCHIVED'`);

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const result = await db.query(`SELECT * FROM compliance_categories ${whereClause} ORDER BY name`, values);
  return result.rows;
};

const getComplianceCategoryDetail = async (categoryId) => {
  const result = await db.query(`SELECT * FROM compliance_categories WHERE category_id = $1`, [categoryId]);
  return result.rows[0];
};

// Atomic single-query status transition -- WHERE status = 'PENDING_APPROVAL'
// in the UPDATE itself is the concurrency guard (a second, simultaneous
// approve/reject affects 0 rows and gets a clean 409), so this doesn't need
// a manual pool.connect()/BEGIN/COMMIT transaction at all. Unlike
// approveComplianceItem, there's no check-then-act sequence here (no
// recurrence-rule bootstrap for categories) worth carrying that pattern's
// crash-risk class for (see approveComplianceItem's client.on('error') fix
// and why it was needed).
const approveComplianceCategory = async (categoryId, approverId, approverRole, justification) => {
  return withTransaction(async (client) => {
    const categoryRes = await client.query(`SELECT * FROM compliance_categories WHERE category_id = $1 FOR UPDATE`, [categoryId]);
    if (categoryRes.rows.length === 0) {
      const err = new Error('Compliance category not found.');
      err.statusCode = 404;
      throw err;
    }
    const category = categoryRes.rows[0];

    if (category.status !== 'PENDING_APPROVAL') {
      const err = new Error(`Category is currently ${category.status}; must be PENDING_APPROVAL to approve.`);
      err.statusCode = 400;
      throw err;
    }
    // A FILING + RECURRING category can't generate anything without
    // anchor_date -- approving it in that state is exactly what produced
    // VAT/PAYE/NHIMA/TOT's "ACTIVE but generates nothing forever" gap
    // (feature/compliance-register-ux Phase 1). Blocked at approval, not
    // just flagged after the fact. RENEWAL is exempt: its cadence is
    // informational only, and TCC/ZPPA are proof this isn't optional to
    // get right -- TCC has sat ACTIVE with anchor_date NULL since before
    // this check existed, and that's correct for a RENEWAL category, not
    // a gap to close.
    if (category.cadence_type === 'RECURRING' && category.obligation_kind === 'FILING' && !category.anchor_date) {
      const err = new Error('This RECURRING category has no first due date set -- an executive must set the cadence before it can be approved.');
      err.statusCode = 400;
      throw err;
    }

    const isSelfApproval = category.created_by === approverId;
    if (isSelfApproval && !EXECUTIVE_ROLES.includes(approverRole)) {
      const err = new Error('Cannot approve your own submission.');
      err.statusCode = 403;
      throw err;
    }
    if (isSelfApproval && (!justification || !justification.trim())) {
      const err = new Error('Justification is required for self-approval.');
      err.statusCode = 400;
      throw err;
    }

    const result = await client.query(
      `UPDATE compliance_categories
       SET status = 'ACTIVE', approved_by = $1, approved_at = CURRENT_TIMESTAMP,
           is_self_approved = $2, self_approval_justification = $3, updated_at = CURRENT_TIMESTAMP
       WHERE category_id = $4 AND status = 'PENDING_APPROVAL'
       RETURNING *`,
      [approverId, isSelfApproval, isSelfApproval ? justification : null, categoryId]
    );
    if (result.rows.length === 0) {
      const err = new Error('This category was already processed (approved or rejected) by someone else.');
      err.statusCode = 409;
      throw err;
    }
    const category2 = result.rows[0];
    await writeAuditLog(client, {
      tableName: 'compliance_categories', recordId: categoryId, action: 'APPROVED',
      oldValues: { status: category.status },
      newValues: { status: category2.status, is_self_approved: category2.is_self_approved },
      userId: approverId,
    });

    // FILING's one generator: bootstrap the rule and the first period right
    // here, so the Register/detail view is never empty for a newly-approved
    // obligation. RENEWAL categories get neither -- their first period is a
    // one-time manual registration (there's no prior certificate to have
    // verified yet); see createComplianceItem/verifyComplianceItem.
    let recurrenceRuleCreated = null;
    let firstItemCreated = null;
    if (category2.cadence_type === 'RECURRING' && category2.obligation_kind === 'FILING') {
      const ruleRes = await client.query(
        `INSERT INTO compliance_recurrence_rule (category_id, interval_months, day_of_month_due, next_reapproval_due, last_reapproved_at, last_reapproved_by)
         VALUES ($1, $2, $3, (CURRENT_DATE + INTERVAL '12 months'), CURRENT_TIMESTAMP, $4)
         RETURNING *`,
        [categoryId, category2.interval_months, category2.due_day_of_month, approverId]
      );
      recurrenceRuleCreated = ruleRes.rows[0];
      const itemRes = await client.query(
        `INSERT INTO compliance_items (category_id, due_date, status, created_by, recurrence_rule_id)
         VALUES ($1, $2, 'UPCOMING', $3, $4) RETURNING *`,
        [categoryId, category2.anchor_date, approverId, recurrenceRuleCreated.rule_id]
      );
      firstItemCreated = itemRes.rows[0];
    }

    return { category: category2, isSelfApproval, recurrenceRuleCreated, firstItemCreated };
  });
};

const rejectComplianceCategory = async (categoryId, reason, actorId) => {
  const cleanReason = validateReason(reason, 'rejection');

  return withTransaction(async (client) => {
    const categoryRes = await client.query(`SELECT * FROM compliance_categories WHERE category_id = $1 FOR UPDATE`, [categoryId]);
    if (categoryRes.rows.length === 0) {
      const err = new Error('Compliance category not found.');
      err.statusCode = 404;
      throw err;
    }
    const before = categoryRes.rows[0];
    if (before.status !== 'PENDING_APPROVAL') {
      const err = new Error(`Category is currently ${before.status}; must be PENDING_APPROVAL to reject.`);
      err.statusCode = 400;
      throw err;
    }

    const result = await client.query(
      `UPDATE compliance_categories SET status = 'REJECTED', rejection_reason = $1, updated_at = CURRENT_TIMESTAMP
       WHERE category_id = $2 AND status = 'PENDING_APPROVAL' RETURNING *`,
      [cleanReason, categoryId]
    );
    if (result.rows.length === 0) {
      const err = new Error('This category was already processed (approved or rejected) by someone else.');
      err.statusCode = 409;
      throw err;
    }
    const after = result.rows[0];
    await writeAuditLog(client, {
      tableName: 'compliance_categories', recordId: categoryId, action: 'REJECTED',
      oldValues: { status: before.status }, newValues: { status: after.status, rejection_reason: after.rejection_reason },
      userId: actorId,
    });
    return after;
  });
};

// New Phase C action: send a PENDING_APPROVAL category back to its creator
// instead of an outright reject. Same reason-length bar as reject, same
// atomic status-guard/409/audit_log shape -- the only difference from
// reject is the resulting status (RETURNED, not REJECTED) and that a
// RETURNED category can come back via resubmitComplianceCategory below,
// where a rejected one cannot.
const returnComplianceCategory = async (categoryId, reason, actorId) => {
  const cleanReason = validateReason(reason, 'return');

  return withTransaction(async (client) => {
    const categoryRes = await client.query(`SELECT * FROM compliance_categories WHERE category_id = $1 FOR UPDATE`, [categoryId]);
    if (categoryRes.rows.length === 0) {
      const err = new Error('Compliance category not found.');
      err.statusCode = 404;
      throw err;
    }
    const before = categoryRes.rows[0];
    if (before.status !== 'PENDING_APPROVAL') {
      const err = new Error(`Category is currently ${before.status}; must be PENDING_APPROVAL to return.`);
      err.statusCode = 400;
      throw err;
    }

    const result = await client.query(
      `UPDATE compliance_categories SET status = 'RETURNED', rejection_reason = $1, updated_at = CURRENT_TIMESTAMP
       WHERE category_id = $2 AND status = 'PENDING_APPROVAL' RETURNING *`,
      [cleanReason, categoryId]
    );
    if (result.rows.length === 0) {
      const err = new Error('This category was already processed (approved, rejected, or returned) by someone else.');
      err.statusCode = 409;
      throw err;
    }
    const after = result.rows[0];
    await writeAuditLog(client, {
      tableName: 'compliance_categories', recordId: categoryId, action: 'RETURNED',
      oldValues: { status: before.status }, newValues: { status: after.status, rejection_reason: after.rejection_reason },
      userId: actorId,
    });
    return after;
  });
};

// RETURNED -> PENDING_APPROVAL. Creator or admin only (server-side
// enforced, not just a hidden button). Clears every previous-decision
// field so the next approver sees a clean slate, not stale approval/
// rejection data from before the return -- self-approval rules apply
// unchanged on the resubmitted category's eventual approval, same as any
// other PENDING_APPROVAL category.
const resubmitComplianceCategory = async (categoryId, actorId, isAdmin) => {
  return withTransaction(async (client) => {
    const categoryRes = await client.query(`SELECT * FROM compliance_categories WHERE category_id = $1 FOR UPDATE`, [categoryId]);
    if (categoryRes.rows.length === 0) {
      const err = new Error('Compliance category not found.');
      err.statusCode = 404;
      throw err;
    }
    const before = categoryRes.rows[0];
    if (before.created_by !== actorId && !isAdmin) {
      const err = new Error('Only the creator or an admin can resubmit this category.');
      err.statusCode = 403;
      throw err;
    }

    const result = await client.query(
      `UPDATE compliance_categories
       SET status = 'PENDING_APPROVAL', approved_by = NULL, approved_at = NULL,
           is_self_approved = false, self_approval_justification = NULL, rejection_reason = NULL,
           updated_at = CURRENT_TIMESTAMP
       WHERE category_id = $1 AND status = 'RETURNED'
       RETURNING *`,
      [categoryId]
    );
    if (result.rows.length === 0) {
      const err = new Error(`Category is currently ${before.status}; must be RETURNED to resubmit.`);
      err.statusCode = 409;
      throw err;
    }
    const after = result.rows[0];
    await writeAuditLog(client, {
      tableName: 'compliance_categories', recordId: categoryId, action: 'RESUBMITTED',
      oldValues: { status: before.status }, newValues: { status: after.status },
      userId: actorId,
    });
    return after;
  });
};

// ─── Archive / withdraw / restore / delete (feature/compliance-archive-and-
// evidence-view) ─────────────────────────────────────────────────────────
// ARCHIVED is a real soft delete: row kept, hidden from default lists,
// excluded from the scheduler/reminders/escalations/configuration prompts.
// Categories only reach ARCHIVED from RETURNED (withdraw) or REJECTED
// (archive) in this phase -- ACTIVE has no direct archive path; retiring an
// ACTIVE category is deferred to the future change-request/retire design.
// "Author or admin" matches this file's existing creator-gate pattern
// (resubmitComplianceCategory, updateComplianceCategory's creator path):
// the literal 'admin' role, not the wider EXECUTIVE_ROLES set.

const withdrawComplianceCategory = async (categoryId, reason, actorId, isAdmin) => {
  const cleanReason = validateReason(reason, 'withdrawal');

  return withTransaction(async (client) => {
    const categoryRes = await client.query(`SELECT * FROM compliance_categories WHERE category_id = $1 FOR UPDATE`, [categoryId]);
    if (categoryRes.rows.length === 0) {
      const err = new Error('Compliance category not found.');
      err.statusCode = 404;
      throw err;
    }
    const before = categoryRes.rows[0];
    if (before.created_by !== actorId && !isAdmin) {
      const err = new Error('Only the creator or an admin can withdraw this category.');
      err.statusCode = 403;
      throw err;
    }

    const result = await client.query(
      `UPDATE compliance_categories
       SET status = 'ARCHIVED', previous_status = status, archived_reason = $1, archived_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE category_id = $2 AND status = 'RETURNED'
       RETURNING *`,
      [cleanReason, categoryId]
    );
    if (result.rows.length === 0) {
      const err = new Error(`Category is currently ${before.status}; must be RETURNED to withdraw.`);
      err.statusCode = 409;
      throw err;
    }
    const after = result.rows[0];
    await writeAuditLog(client, {
      tableName: 'compliance_categories', recordId: categoryId, action: 'WITHDRAWN',
      oldValues: { status: before.status }, newValues: { status: after.status, archived_reason: after.archived_reason },
      userId: actorId,
    });
    return after;
  });
};

const archiveComplianceCategory = async (categoryId, reason, actorId, isAdmin) => {
  const cleanReason = reason && reason.trim() ? reason.trim() : null;

  return withTransaction(async (client) => {
    const categoryRes = await client.query(`SELECT * FROM compliance_categories WHERE category_id = $1 FOR UPDATE`, [categoryId]);
    if (categoryRes.rows.length === 0) {
      const err = new Error('Compliance category not found.');
      err.statusCode = 404;
      throw err;
    }
    const before = categoryRes.rows[0];
    if (before.created_by !== actorId && !isAdmin) {
      const err = new Error('Only the creator or an admin can archive this category.');
      err.statusCode = 403;
      throw err;
    }

    const result = await client.query(
      `UPDATE compliance_categories
       SET status = 'ARCHIVED', previous_status = status, archived_reason = $1, archived_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE category_id = $2 AND status = 'REJECTED'
       RETURNING *`,
      [cleanReason, categoryId]
    );
    if (result.rows.length === 0) {
      const err = new Error(`Category is currently ${before.status}; must be REJECTED to archive.`);
      err.statusCode = 409;
      throw err;
    }
    const after = result.rows[0];
    await writeAuditLog(client, {
      tableName: 'compliance_categories', recordId: categoryId, action: 'ARCHIVED',
      oldValues: { status: before.status }, newValues: { status: after.status, archived_reason: after.archived_reason },
      userId: actorId,
    });
    return after;
  });
};

// Admin-only, matching the spec exactly (narrower than the author-or-admin
// gate on withdraw/archive -- restoring is treated as a more consequential
// action than archiving, since it puts the category back in front of the
// scheduler/lists/approval flow).
const restoreComplianceCategory = async (categoryId, actorId) => {
  return withTransaction(async (client) => {
    const categoryRes = await client.query(`SELECT * FROM compliance_categories WHERE category_id = $1 FOR UPDATE`, [categoryId]);
    if (categoryRes.rows.length === 0) {
      const err = new Error('Compliance category not found.');
      err.statusCode = 404;
      throw err;
    }
    const before = categoryRes.rows[0];
    if (before.status !== 'ARCHIVED') {
      const err = new Error(`Category is currently ${before.status}; must be ARCHIVED to restore.`);
      err.statusCode = 400;
      throw err;
    }

    const result = await client.query(
      `UPDATE compliance_categories
       SET status = $1, previous_status = NULL, archived_reason = NULL, archived_at = NULL,
           updated_at = CURRENT_TIMESTAMP
       WHERE category_id = $2 AND status = 'ARCHIVED'
       RETURNING *`,
      [before.previous_status, categoryId]
    );
    if (result.rows.length === 0) {
      const err = new Error('This category is no longer ARCHIVED (status changed by someone else).');
      err.statusCode = 409;
      throw err;
    }
    const after = result.rows[0];
    await writeAuditLog(client, {
      tableName: 'compliance_categories', recordId: categoryId, action: 'RESTORED',
      oldValues: { status: before.status }, newValues: { status: after.status },
      userId: actorId,
    });
    return after;
  });
};

// cadence_type/interval_months are locked EXCEPT while the category is
// RETURNED (Bug 2, Phase C addendum). The original reasoning still holds
// for everything else: the scheduler and the approval-time recurrence-
// rule bootstrap key their logic off a category's cadence at the moment
// each item/rule was created, so changing it out from under existing
// items/rules would leave their behavior inconsistent with a category
// that no longer describes them -- once ACTIVE, a category whose cadence
// was set up wrong should still be deactivated and recreated, not mutated
// in place. But a RETURNED category can never have gotten that far: the
// status graph only reaches RETURNED from PENDING_APPROVAL, and ACTIVE is
// terminal (nothing transitions a category back out of it), so a
// recurrence rule or generated item can only exist under a category that
// has already been ACTIVE at least once -- a RETURNED category, by
// construction, has never been approved and so has neither. Fixing its
// cadence there is equivalent to fixing it before creation, not mutating
// something downstream already depends on.
//
// Also deliberately does not accept `status` -- status only ever moves via
// approveComplianceCategory/rejectComplianceCategory below. is_active and
// status are different concerns: is_active is "still in use" (toggleable
// any time, by design, regardless of approval history); status is "has
// this been vetted at all." Letting this generic update touch status would
// let someone silently reactivate a REJECTED category, or flip a still-
// PENDING one straight to ACTIVE without ever going through approve() --
// exactly the conflation the session asked to avoid.
// actorId/actorRole are optional (test-helper/scripted callers that
// pre-date Phase C omit them) -- when omitted, this behaves exactly as
// before: unrestricted by requester identity, any status. Passing them is
// what enables Phase C's second, narrower edit path: the category's own
// creator, editing while it's RETURNED, to fix it up before resubmitting.
// Executives keep the original, unrestricted-by-status access this
// function has always given them (e.g. backfilling anchor_date on an
// ACTIVE category) -- Phase C's "editable ONLY when RETURNED" rule adds a
// new allowance for the creator, it does not narrow the executive one.
const updateComplianceCategory = async (categoryId, updates, actorId, actorRole) => {
  return withTransaction(async (client) => {
    const existing = await client.query(`SELECT * FROM compliance_categories WHERE category_id = $1 FOR UPDATE`, [categoryId]);
    if (existing.rows.length === 0) {
      const err = new Error('Compliance category not found.');
      err.statusCode = 404;
      throw err;
    }
    const category = existing.rows[0];

    // recurrence_type is deprecated and unread -- always locked, no
    // exception (nothing should ever set it again; see Bug 1's "delete
    // every frontend read of recurrence_type").
    if ('recurrence_type' in updates) {
      const err = new Error('recurrence_type is deprecated and cannot be set.');
      err.statusCode = 400;
      throw err;
    }
    const editingCadenceShape = 'cadence_type' in updates || 'interval_months' in updates;
    if (editingCadenceShape && category.status !== 'RETURNED') {
      const err = new Error('cadence_type/interval_months cannot be changed after creation unless the category is RETURNED. Deactivate this category and create a new one instead.');
      err.statusCode = 400;
      throw err;
    }

    const isExecutive = actorRole != null && EXECUTIVE_ROLES.includes(actorRole);
    let requireReturnedStatus = false;
    if (actorId !== undefined && !isExecutive) {
      if (category.created_by !== actorId) {
        const err = new Error('Only the creator or an executive can edit this category.');
        err.statusCode = 403;
        throw err;
      }
      if (category.status !== 'RETURNED') {
        const err = new Error(`Category is currently ${category.status}; the creator can only edit it while RETURNED.`);
        err.statusCode = 400;
        throw err;
      }
      if ('is_active' in updates) {
        const err = new Error('is_active can only be changed by an executive.');
        err.statusCode = 403;
        throw err;
      }
      requireReturnedStatus = true;
    }

    const fields = [];
    const values = [];
    let i = 1;

    if ('name' in updates) {
      if (!updates.name || !updates.name.trim()) {
        const err = new Error('name cannot be empty.');
        err.statusCode = 400;
        throw err;
      }
      fields.push(`name = $${i++}`); values.push(updates.name.trim());
    }
    if ('regulator' in updates) {
      fields.push(`regulator = $${i++}`); values.push(updates.regulator || null);
    }
    if ('reminder_ladder_days' in updates) {
      const ladder = updates.reminder_ladder_days;
      if (!Array.isArray(ladder) || ladder.length === 0 || !ladder.every((d) => Number.isInteger(d) && d > 0)) {
        const err = new Error('reminder_ladder_days must be a non-empty array of positive integers.');
        err.statusCode = 400;
        throw err;
      }
      fields.push(`reminder_ladder_days = $${i++}`); values.push(ladder);
    }
    if ('is_active' in updates) {
      fields.push(`is_active = $${i++}`); values.push(!!updates.is_active);
    }
    if ('responsible_user_id' in updates) {
      if (!isExecutive) {
        const err = new Error('responsible_user_id can only be changed by an executive.');
        err.statusCode = 403;
        throw err;
      }
      fields.push(`responsible_user_id = $${i++}`); values.push(updates.responsible_user_id || null);
    }
    if (editingCadenceShape || 'anchor_date' in updates || 'due_day_of_month' in updates) {
      // Same validation as creation (validateCadenceFields), fed with the
      // EFFECTIVE cadence: whatever this request is changing, falling back
      // to the category's existing values for anything it isn't. This is
      // what lets "just move the first due date" (Phase B's existing
      // executive-only anchor_date edit on an ACTIVE category) keep working
      // exactly as before -- cadence_type/interval_months aren't in that
      // request, so the effective values are just the category's own,
      // already-valid ones -- while also correctly handling a RETURNED
      // category's cadence_type actually changing shape (e.g. ONE_OFF ->
      // RECURRING now requires anchor_date; RECURRING -> ONE_OFF clears it).
      const effective = {
        cadence_type: 'cadence_type' in updates ? updates.cadence_type : category.cadence_type,
        interval_months: 'interval_months' in updates ? updates.interval_months : category.interval_months,
        anchor_date: 'anchor_date' in updates ? updates.anchor_date : category.anchor_date,
        due_day_of_month: 'due_day_of_month' in updates ? updates.due_day_of_month : category.due_day_of_month,
        // Not editable through this function -- always the category's own.
        obligation_kind: category.obligation_kind,
      };
      // Preserves the pre-existing guard: setting anchor_date/due_day_of_month
      // on a category that is (and remains) ONE_OFF is still rejected, not
      // silently discarded by the validator's own ONE_OFF short-circuit.
      if (!editingCadenceShape && ('anchor_date' in updates || 'due_day_of_month' in updates) && effective.cadence_type !== 'RECURRING') {
        const err = new Error('anchor_date/due_day_of_month only apply to a RECURRING category.');
        err.statusCode = 400;
        throw err;
      }
      const { cadenceType, intervalMonths, dueDayOfMonth, anchorDate } = validateCadenceFields(effective);
      fields.push(`cadence_type = $${i++}`); values.push(cadenceType);
      fields.push(`interval_months = $${i++}`); values.push(intervalMonths);
      fields.push(`anchor_date = $${i++}`); values.push(anchorDate);
      fields.push(`due_day_of_month = $${i++}`); values.push(dueDayOfMonth);
    }

    if (fields.length === 0) {
      const err = new Error('No updatable fields provided (name, regulator, reminder_ladder_days, is_active, cadence_type, interval_months, anchor_date, due_day_of_month).');
      err.statusCode = 400;
      throw err;
    }

    fields.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(categoryId);
    const whereClause = requireReturnedStatus
      ? `WHERE category_id = $${i} AND status = 'RETURNED'`
      : `WHERE category_id = $${i}`;
    const result = await client.query(
      `UPDATE compliance_categories SET ${fields.join(', ')} ${whereClause} RETURNING *`,
      values
    );
    if (result.rows.length === 0) {
      // Only reachable via the creator-while-RETURNED path -- the
      // executive path has no status condition in its WHERE clause, so it
      // can only ever return 0 rows via the earlier not-found check.
      const err = new Error('This category is no longer RETURNED (status changed by someone else).');
      err.statusCode = 409;
      throw err;
    }
    const after = result.rows[0];
    if (actorId !== undefined) {
      await writeAuditLog(client, {
        tableName: 'compliance_categories', recordId: categoryId, action: 'EDITED',
        oldValues: pickFields(category, Object.keys(updates)),
        newValues: pickFields(after, Object.keys(updates)),
        userId: actorId,
      });
    }
    return after;
  });
};

// ─── Items ──────────────────────────────────────────────────────────────────

// Manual registration is now allowed in exactly two cases (feature/
// compliance-register-ux, Step 2 -- see the OBLIGATION_KINDS comment):
//   - RENEWAL, and this is the very first period ever (no prior certificate
//     to have verified) -- due_date is the currently-held certificate's
//     expiry, freely entered.
//   - ONE_OFF + FILING (or a legacy category with no obligation_kind set
//     yet) -- unchanged from before, due_date freely entered.
// FILING + RECURRING is blocked outright: its periods only ever come from
// approveComplianceCategory's bootstrap or the scheduler now, never a
// manual POST. New items start life as UPCOMING, not DRAFT -- the old
// DRAFT -> submit -> evidence -> approve chain is superseded by upload ->
// EVIDENCE_SUBMITTED -> verify -> VERIFIED (uploadComplianceEvidence/
// verifyComplianceItem below); DRAFT/submit/approve stay working unchanged
// for items already in that state before this feature shipped.
const createComplianceItem = async ({ category_id, issued_date, due_date, evidence_file_ref, created_by }) => {
  const categoryRes = await db.query(
    `SELECT * FROM compliance_categories WHERE category_id = $1`,
    [category_id]
  );
  const category = categoryRes.rows[0];
  if (!category) {
    const err = new Error('Compliance category not found.');
    err.statusCode = 404;
    throw err;
  }
  if (category.status !== 'ACTIVE') {
    const err = new Error(`This category is ${category.status}, not ACTIVE -- items can only be registered against an active category.`);
    err.statusCode = 400;
    throw err;
  }
  if (!category.obligation_kind) {
    const err = new Error(`This category's obligation_kind (FILING or RENEWAL) hasn't been set yet -- an executive needs to set it before items can be registered.`);
    err.statusCode = 400;
    throw err;
  }

  const validatedIssuedDate = issued_date ? validateDateOnly(issued_date, 'issued_date') : null;
  if (validatedIssuedDate && validatedIssuedDate > new Date().toISOString().slice(0, 10)) {
    const err = new Error('issued_date cannot be in the future.');
    err.statusCode = 400;
    throw err;
  }

  let computedDueDate;
  if (category.obligation_kind === 'RENEWAL') {
    const existing = await db.query(`SELECT 1 FROM compliance_items WHERE category_id = $1 LIMIT 1`, [category_id]);
    if (existing.rows.length > 0) {
      const err = new Error(`This category already has a period on record -- the next RENEWAL period is created automatically when the current one is verified, not by registering a new one.`);
      err.statusCode = 400;
      throw err;
    }
    if (!due_date) {
      const err = new Error(`due_date (the currently-held certificate's expiry) is required.`);
      err.statusCode = 400;
      throw err;
    }
    computedDueDate = validateDateOnly(due_date, 'due_date');
    if (validatedIssuedDate && computedDueDate <= validatedIssuedDate) {
      const err = new Error(`due_date (the certificate's expiry) must be after issued_date.`);
      err.statusCode = 400;
      throw err;
    }
  } else if (category.cadence_type === 'RECURRING') {
    const err = new Error(`Periods for this category are generated automatically (on approval and by the scheduler) -- manual registration isn't available for a FILING RECURRING category.`);
    err.statusCode = 400;
    throw err;
  } else {
    if (!due_date) {
      const err = new Error('due_date is required for a one-off category.');
      err.statusCode = 400;
      throw err;
    }
    computedDueDate = validateDateOnly(due_date, 'due_date');
  }

  const result = await db.query(
    `INSERT INTO compliance_items (category_id, issued_date, due_date, evidence_file_ref, created_by, status)
     VALUES ($1, $2, $3, $4, $5, 'UPCOMING')
     RETURNING *`,
    [category_id, validatedIssuedDate, computedDueDate, evidence_file_ref || null, created_by]
  );
  return result.rows[0];
};

const getComplianceItem = async (itemId) => {
  const result = await db.query(`SELECT * FROM compliance_items WHERE item_id = $1`, [itemId]);
  return result.rows[0];
};

// Lists items with category info, ack status, and which reminder tiers have
// fired -- the fields the approval queue / my-tasks / item-detail UIs all
// need, in one call rather than N+1 requests per item.
//
// Role scoping (not just an authorize() gate, since "which items" differs
// by role, not just "can you hit this route at all"):
//   - EXECUTIVE_ROLES (admin/cfo/ceo): every item, no restriction -- they
//     can approve/reject anything, so they need visibility into everything.
//   - junior_accountant: items they created (any status -- they need to see
//     their own DRAFT/REJECTED items to act on them) OR any NON_COMPLIANT
//     item with no acknowledgement yet (acknowledge is open to this role
//     for ANY item, not just ones they created, so "my tasks" has to
//     include those too, not just their own submissions).
// This is a judgment call filling a gap the original Phase 2-4 spec never
// defined (there's no "assignee" concept in this schema) -- flagging it
// rather than assuming silently, since a different scoping rule would be
// an easy, reasonable alternative.
//
// categoryId bypasses the created-by/NON_COMPLIANT personal-scoping above
// entirely, for ANY role -- it's what backs the evidence-view detail page
// (feature/compliance-archive-and-evidence-view item 3), where "the history
// of generated items" for a category means every item under it, not just
// the caller's own. The route deciding who may view a given category at
// all is what actually gates this (same split of responsibility as
// canViewItem/getComplianceItemDetail above); this function only fetches.
const listComplianceItems = async ({ role, userId, status, needsAcknowledgement, mine, categoryId, showArchived }) => {
  const conditions = [];
  const values = [];
  let i = 1;

  if (categoryId) {
    conditions.push(`ci.category_id = $${i++}`);
    values.push(categoryId);
  } else if (!EXECUTIVE_ROLES.includes(role)) {
    conditions.push(`(ci.created_by = $${i} OR (ci.status = 'NON_COMPLIANT' AND ca.acknowledgement_id IS NULL))`);
    values.push(userId);
    i++;
  } else if (mine) {
    conditions.push(`ci.created_by = $${i}`);
    values.push(userId);
    i++;
  }

  if (status) {
    const statuses = Array.isArray(status) ? status : [status];
    conditions.push(`ci.status = ANY($${i})`);
    values.push(statuses);
    i++;
  }

  if (needsAcknowledgement) {
    conditions.push(`ci.status = 'NON_COMPLIANT' AND ca.acknowledgement_id IS NULL`);
  }

  if (!showArchived && !status) conditions.push(`ci.status != 'ARCHIVED'`);

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const result = await db.query(
    `SELECT ci.*,
            cc.name AS category_name, cc.regulator, cc.recurrence_type, cc.cadence_type, cc.reminder_ladder_days, cc.obligation_kind,
            (ci.due_date - CURRENT_DATE) AS days_until_due,
            (ca.acknowledgement_id IS NOT NULL) AS is_acknowledged,
            approver.full_name AS approved_by_name,
            COALESCE(
              (SELECT array_agg(tier_label ORDER BY tier_label) FROM (
                 SELECT DISTINCT
                   (CASE WHEN crl.tier_type = 'DAYS_BEFORE' THEN crl.days_before::text || '_DAY' ELSE crl.tier_type END) AS tier_label
                 FROM compliance_reminder_log crl WHERE crl.item_id = ci.item_id
               ) t),
              ARRAY[]::varchar[]
            ) AS reminder_tiers_fired
     FROM compliance_items ci
     JOIN compliance_categories cc ON cc.category_id = ci.category_id
     LEFT JOIN compliance_acknowledgements ca ON ca.item_id = ci.item_id
     LEFT JOIN users approver ON approver.user_id = ci.approved_by
     ${whereClause}
     ORDER BY ci.due_date ASC`,
    values
  );
  return result.rows;
};

const submitComplianceItem = async (itemId, userId, isAdmin) => {
  const item = await getComplianceItem(itemId);
  if (!item) throw new Error('Compliance item not found');
  assertNotNewVocabularyItem(item, 'submit');

  if (item.created_by !== userId && !isAdmin) {
    const err = new Error('Only the creator or an admin can submit this item.');
    err.statusCode = 403;
    throw err;
  }
  if (item.status !== 'DRAFT') {
    const err = new Error(`Item is currently ${item.status}; must be DRAFT to submit.`);
    err.statusCode = 400;
    throw err;
  }

  const evidenceCheck = await db.query(`SELECT 1 FROM compliance_item_evidence WHERE item_id = $1`, [itemId]);
  if (evidenceCheck.rows.length === 0) {
    const err = new Error('A PDF evidence file must be attached before this item can be submitted for approval.');
    err.statusCode = 400;
    throw err;
  }

  const result = await db.query(
    `UPDATE compliance_items SET status = 'PENDING_APPROVAL', updated_at = CURRENT_TIMESTAMP
     WHERE item_id = $1 RETURNING *`,
    [itemId]
  );
  return result.rows[0];
};

// ─── Evidence (PDF upload/download) ────────────────────────────────────────
// One row per item, upsert-replace on re-upload -- matches this codebase's
// own established pattern for exactly this scenario (qms_document_files:
// INSERT ... ON CONFLICT (version_id) DO UPDATE). A compliance item's
// evidence represents "the current filing," not a draft history; the
// item's own audit fields already record that/when evidence was attached.
// certificateExpiryDate is required when the item's category is RENEWAL
// (the uploader enters the certificate's new expiry; verifyComplianceItem
// below is what "the verifier confirms it" means -- verifying is the
// confirmation, there's no separate edit-and-confirm step). For a period
// currently UPCOMING or NON_COMPLIANT, this also moves it to
// EVIDENCE_SUBMITTED and records filed_late if the due date has already
// passed -- a one-way flag (OR'd, never cleared) per the explicit decision
// that a late-then-verified period keeps a permanent record of that.
// Legacy items already in the old DRAFT/PENDING_APPROVAL/APPROVED/RETURNED
// flow are untouched here (upload still just replaces the file, same as
// before this feature) -- only the two new statuses trigger the new
// behavior.
const uploadComplianceEvidence = async ({ itemId, fileBuffer, filename, fileSizeBytes, uploadedBy, certificateExpiryDate }) => {
  return withTransaction(async (client) => {
    const itemRes = await client.query(
      `SELECT ci.*, cc.obligation_kind, cc.responsible_user_id, cc.name AS category_name
       FROM compliance_items ci JOIN compliance_categories cc ON cc.category_id = ci.category_id WHERE ci.item_id = $1 FOR UPDATE`,
      [itemId]
    );
    const item = itemRes.rows[0];
    if (!item) {
      const err = new Error('Compliance item not found.');
      err.statusCode = 404;
      throw err;
    }
    if (item.obligation_kind === 'RENEWAL') {
      if (!certificateExpiryDate) {
        const err = new Error(`certificate_expiry_date is required when uploading evidence for a RENEWAL obligation.`);
        err.statusCode = 400;
        throw err;
      }
      validateDateOnly(certificateExpiryDate, 'certificate_expiry_date');
    }

    const evidenceRes = await client.query(
      `INSERT INTO compliance_item_evidence (item_id, file_data, filename, file_size_bytes, uploaded_by, certificate_expiry_date)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (item_id) DO UPDATE
         SET file_data = EXCLUDED.file_data, filename = EXCLUDED.filename,
             file_size_bytes = EXCLUDED.file_size_bytes, uploaded_by = EXCLUDED.uploaded_by,
             certificate_expiry_date = EXCLUDED.certificate_expiry_date, uploaded_at = CURRENT_TIMESTAMP
       RETURNING evidence_id, item_id, filename, file_size_bytes, uploaded_by, uploaded_at, certificate_expiry_date`,
      [itemId, fileBuffer, filename, fileSizeBytes, uploadedBy, certificateExpiryDate || null]
    );

    let movedToEvidenceSubmitted = false;
    if (item.status === 'UPCOMING' || item.status === 'NON_COMPLIANT') {
      await client.query(
        `UPDATE compliance_items
         SET status = 'EVIDENCE_SUBMITTED', filed_late = filed_late OR (due_date < CURRENT_DATE), updated_at = CURRENT_TIMESTAMP
         WHERE item_id = $1`,
        [itemId]
      );
      await writeAuditLog(client, {
        tableName: 'compliance_items', recordId: itemId, action: 'EVIDENCE_SUBMITTED',
        oldValues: { status: item.status }, newValues: { status: 'EVIDENCE_SUBMITTED' },
        userId: uploadedBy,
      });
      movedToEvidenceSubmitted = true;
    }

    return {
      evidence: evidenceRes.rows[0],
      movedToEvidenceSubmitted,
      categoryName: item.category_name,
      responsibleUserId: item.responsible_user_id,
    };
  });
};

const getComplianceEvidence = async (itemId) => {
  const result = await db.query(
    `SELECT file_data, filename FROM compliance_item_evidence WHERE item_id = $1`,
    [itemId]
  );
  return result.rows[0];
};

// VERIFIED is the new model's "complete for this period" state (compare
// approveComplianceItem below, which still does that job for legacy items).
// Verifier must differ from the evidence's uploader, with the same
// executive-plus-justification self-approval exception every other
// approval action in this module already has. RENEWAL's one generator:
// verifying creates the category's next UPCOMING period here, at the
// expiry the uploader entered (processRecurrence explicitly skips RENEWAL
// categories -- see compliance-scheduler-service.js).
// correctedExpiryDate lets the verifier fix a wrong expiry the uploader
// entered, rather than rejecting the whole upload over one bad field --
// "the verifier confirms it" (the expiry) means either accepting it as
// uploaded or correcting it right here, both still counting as
// verification. When given, it overwrites compliance_item_evidence's own
// certificate_expiry_date too (so the corrected value is what the history
// table shows from now on, not the original wrong one), and it's what the
// next RENEWAL period gets generated at.
const verifyComplianceItem = async (itemId, verifierId, verifierRole, justification, correctedExpiryDate) => {
  return withTransaction(async (client) => {
    const itemRes = await client.query(
      `SELECT ci.*, cc.obligation_kind, cc.category_id AS cat_id
       FROM compliance_items ci JOIN compliance_categories cc ON cc.category_id = ci.category_id
       WHERE ci.item_id = $1 FOR UPDATE`,
      [itemId]
    );
    const item = itemRes.rows[0];
    if (!item) {
      const err = new Error('Compliance item not found.');
      err.statusCode = 404;
      throw err;
    }
    if (item.status !== 'EVIDENCE_SUBMITTED') {
      const err = new Error(`Item is currently ${item.status}; must be EVIDENCE_SUBMITTED to verify.`);
      err.statusCode = 400;
      throw err;
    }

    let evidenceRes = await client.query(
      `SELECT uploaded_by, certificate_expiry_date FROM compliance_item_evidence WHERE item_id = $1`,
      [itemId]
    );
    if (correctedExpiryDate) {
      const validated = validateDateOnly(correctedExpiryDate, 'corrected_expiry_date');
      evidenceRes = await client.query(
        `UPDATE compliance_item_evidence SET certificate_expiry_date = $1 WHERE item_id = $2
         RETURNING uploaded_by, certificate_expiry_date`,
        [validated, itemId]
      );
      if (evidenceRes.rows.length === 0) {
        const err = new Error('No evidence on file for this item to correct.');
        err.statusCode = 400;
        throw err;
      }
    }
    const evidence = evidenceRes.rows[0];
    const isSelfVerification = evidence && evidence.uploaded_by === verifierId;
    if (isSelfVerification && !EXECUTIVE_ROLES.includes(verifierRole)) {
      const err = new Error('Cannot verify evidence you uploaded yourself.');
      err.statusCode = 403;
      throw err;
    }
    if (isSelfVerification && (!justification || !justification.trim())) {
      const err = new Error('Justification is required to verify your own upload.');
      err.statusCode = 400;
      throw err;
    }

    const result = await client.query(
      `UPDATE compliance_items
       SET status = 'VERIFIED', approved_by = $1, approved_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE item_id = $2 AND status = 'EVIDENCE_SUBMITTED'
       RETURNING *`,
      [verifierId, itemId]
    );
    if (result.rows.length === 0) {
      const err = new Error('This item is no longer EVIDENCE_SUBMITTED (verified or changed by someone else).');
      err.statusCode = 409;
      throw err;
    }
    const after = result.rows[0];
    await writeAuditLog(client, {
      tableName: 'compliance_items', recordId: itemId, action: 'VERIFIED',
      oldValues: { status: 'EVIDENCE_SUBMITTED' },
      newValues: {
        status: after.status, is_self_verified: isSelfVerification, filed_late: after.filed_late,
        expiry_corrected_to: correctedExpiryDate || undefined,
      },
      userId: verifierId,
    });

    let nextPeriodCreated = null;
    if (item.obligation_kind === 'RENEWAL') {
      if (!evidence || !evidence.certificate_expiry_date) {
        const err = new Error('No certificate expiry date on file for this evidence -- cannot create the next renewal period.');
        err.statusCode = 400;
        throw err;
      }
      const nextRes = await client.query(
        `INSERT INTO compliance_items (category_id, due_date, status, created_by)
         VALUES ($1, $2, 'UPCOMING', $3) RETURNING *`,
        [item.cat_id, evidence.certificate_expiry_date, verifierId]
      );
      nextPeriodCreated = nextRes.rows[0];
    }

    return { item: after, isSelfVerification, nextPeriodCreated };
  });
};

// The verifier's counterpart to a bad upload: not "verified," bad
// evidence (wrong document, wrong period, illegible scan) -- bounced back
// to await a fresh upload rather than forced through as VERIFIED or left
// stuck. Reason required, same >=10-char bar every other return action in
// this module has. Lands back on UPCOMING unless the due date has already
// passed, in which case NON_COMPLIANT is the honest state (no evidence
// currently on file, past due) -- matches exactly what would have happened
// if no evidence had ever been uploaded.
const returnEvidence = async (itemId, reason, actorId, actorRole) => {
  const cleanReason = validateReason(reason, 'evidence return');

  return withTransaction(async (client) => {
    const itemRes = await client.query(`SELECT * FROM compliance_items WHERE item_id = $1 FOR UPDATE`, [itemId]);
    const before = itemRes.rows[0];
    if (!before) {
      const err = new Error('Compliance item not found.');
      err.statusCode = 404;
      throw err;
    }
    if (before.status !== 'EVIDENCE_SUBMITTED') {
      const err = new Error(`Item is currently ${before.status}; must be EVIDENCE_SUBMITTED to return its evidence.`);
      err.statusCode = 400;
      throw err;
    }
    if (!EXECUTIVE_ROLES.includes(actorRole)) {
      const err = new Error('Only an executive can return evidence for correction.');
      err.statusCode = 403;
      throw err;
    }

    const newStatus = before.due_date < new Date().toISOString().slice(0, 10) ? 'NON_COMPLIANT' : 'UPCOMING';
    const result = await client.query(
      `UPDATE compliance_items SET status = $1, rejection_reason = $2, updated_at = CURRENT_TIMESTAMP
       WHERE item_id = $3 AND status = 'EVIDENCE_SUBMITTED' RETURNING *`,
      [newStatus, cleanReason, itemId]
    );
    if (result.rows.length === 0) {
      const err = new Error('This item is no longer EVIDENCE_SUBMITTED (verified or changed by someone else).');
      err.statusCode = 409;
      throw err;
    }
    const after = result.rows[0];
    await writeAuditLog(client, {
      tableName: 'compliance_items', recordId: itemId, action: 'EVIDENCE_RETURNED',
      oldValues: { status: before.status }, newValues: { status: after.status, return_reason: cleanReason },
      userId: actorId,
    });
    return after;
  });
};

// Approve — handles both ordinary approval and self-approval (executive
// roles only, justification required), and the "annual approval at point
// of creation" recurrence-rule bootstrap for MONTHLY_RECURRING /
// ANNUAL_RECURRING categories.
const approveComplianceItem = async (itemId, approverId, approverRole, justification) => {
  return withTransaction(async (client) => {
    const itemRes = await client.query(`SELECT * FROM compliance_items WHERE item_id = $1 FOR UPDATE`, [itemId]);
    if (itemRes.rows.length === 0) {
      const err = new Error('Compliance item not found');
      err.statusCode = 404;
      throw err;
    }
    const item = itemRes.rows[0];
    assertNotNewVocabularyItem(item, 'approve');

    if (item.status !== 'PENDING_APPROVAL') {
      const err = new Error(`Item is currently ${item.status}; must be PENDING_APPROVAL to approve.`);
      err.statusCode = 400;
      throw err;
    }

    const isSelfApproval = item.created_by === approverId;

    // Self-approval guard: only executive roles may approve their own
    // submission. In practice this route is already gated to
    // admin/cfo/ceo only, so this branch is a defense-in-depth restatement
    // of that same rule at the data layer, not a currently-reachable path
    // given today's authorize() array -- kept explicit per the locked
    // decision rather than relying solely on route-level middleware.
    if (isSelfApproval && !EXECUTIVE_ROLES.includes(approverRole)) {
      const err = new Error('Cannot approve your own submission.');
      err.statusCode = 403;
      throw err;
    }
    if (isSelfApproval && (!justification || !justification.trim())) {
      const err = new Error('Justification is required for self-approval.');
      err.statusCode = 400;
      throw err;
    }

    const updateRes = await client.query(
      `UPDATE compliance_items
       SET status = 'APPROVED', approved_by = $1, approved_at = CURRENT_TIMESTAMP,
           is_self_approved = $2, self_approval_justification = $3, updated_at = CURRENT_TIMESTAMP
       WHERE item_id = $4
       RETURNING *`,
      [approverId, isSelfApproval, isSelfApproval ? justification : null, itemId]
    );
    let updatedItem = updateRes.rows[0];

    // "Annual approval at point of creation" -- bootstrap the recurrence
    // rule the first time a recurring category's item is approved. The
    // UNIQUE(category_id) constraint is the backstop; this check-before-
    // insert is what keeps a second approval under the same category from
    // ever hitting it in the first place. 12-month re-approval stays fixed
    // regardless of interval_months, per the explicit decision to keep that
    // rule unchanged.
    let recurrenceRuleCreated = null;
    const categoryRes = await client.query(
      `SELECT * FROM compliance_categories WHERE category_id = $1`,
      [item.category_id]
    );
    const category = categoryRes.rows[0];

    if (category && category.cadence_type === 'RECURRING') {
      const existingRule = await client.query(
        `SELECT rule_id FROM compliance_recurrence_rule WHERE category_id = $1`,
        [item.category_id]
      );
      if (existingRule.rows.length === 0) {
        // due_day_of_month/interval_months now come from the category (due
        // day moved there in the flexible-cadence migration) rather than
        // the item -- copied onto the rule here the same way this table
        // has always duplicated day_of_month_due, so the scheduler only
        // ever needs to read this one row, not join back to the category
        // for every generation check.
        const ruleRes = await client.query(
          `INSERT INTO compliance_recurrence_rule
             (category_id, interval_months, day_of_month_due, next_reapproval_due, last_reapproved_at, last_reapproved_by)
           VALUES ($1, $2, $3, (CURRENT_DATE + INTERVAL '12 months'), CURRENT_TIMESTAMP, $4)
           RETURNING *`,
          [item.category_id, category.interval_months, category.due_day_of_month, approverId]
        );
        recurrenceRuleCreated = ruleRes.rows[0];

        const linkedRes = await client.query(
          `UPDATE compliance_items SET recurrence_rule_id = $1 WHERE item_id = $2 RETURNING *`,
          [recurrenceRuleCreated.rule_id, itemId]
        );
        updatedItem = linkedRes.rows[0];
      }
    }

    await writeAuditLog(client, {
      tableName: 'compliance_items', recordId: itemId, action: 'APPROVED',
      oldValues: { status: item.status },
      newValues: { status: updatedItem.status, is_self_approved: updatedItem.is_self_approved },
      userId: approverId,
    });

    return { item: updatedItem, isSelfApproval, recurrenceRuleCreated };
  });
};

// Single-item version of listComplianceItems's joined shape -- used for a
// detail view. Does NOT enforce role-scoping itself (the route decides
// whether the requester is allowed to see this particular item); it only
// fetches and shapes the data.
const getComplianceItemDetail = async (itemId) => {
  const result = await db.query(
    `SELECT ci.*,
            cc.name AS category_name, cc.regulator, cc.recurrence_type, cc.cadence_type, cc.reminder_ladder_days, cc.obligation_kind,
            (ci.due_date - CURRENT_DATE) AS days_until_due,
            (ca.acknowledgement_id IS NOT NULL) AS is_acknowledged,
            COALESCE(
              (SELECT array_agg(tier_label ORDER BY tier_label) FROM (
                 SELECT DISTINCT
                   (CASE WHEN crl.tier_type = 'DAYS_BEFORE' THEN crl.days_before::text || '_DAY' ELSE crl.tier_type END) AS tier_label
                 FROM compliance_reminder_log crl WHERE crl.item_id = ci.item_id
               ) t),
              ARRAY[]::varchar[]
            ) AS reminder_tiers_fired
     FROM compliance_items ci
     JOIN compliance_categories cc ON cc.category_id = ci.category_id
     LEFT JOIN compliance_acknowledgements ca ON ca.item_id = ci.item_id
     WHERE ci.item_id = $1`,
    [itemId]
  );
  return result.rows[0];
};

// Reason now requires >=10 characters (Phase C), and this now runs as a
// proper atomic transaction with a status-guard + audit_log write --
// fixing a real gap the earlier version had: its final UPDATE's WHERE
// clause DID include status = 'PENDING_APPROVAL', but nothing checked the
// UPDATE's row count afterward, so a concurrent approve winning the race
// would silently return undefined (result.rows[0] on an empty array)
// instead of a clean 409. Found while building Phase C's concurrent-
// double-decision tests, not by a live incident.
const rejectComplianceItem = async (itemId, reason, actorId) => {
  const cleanReason = validateReason(reason, 'rejection');

  return withTransaction(async (client) => {
    const itemRes = await client.query(`SELECT * FROM compliance_items WHERE item_id = $1 FOR UPDATE`, [itemId]);
    if (itemRes.rows.length === 0) {
      const err = new Error('Compliance item not found');
      err.statusCode = 404;
      throw err;
    }
    const before = itemRes.rows[0];
    assertNotNewVocabularyItem(before, 'reject');
    if (before.status !== 'PENDING_APPROVAL') {
      const err = new Error(`Item is currently ${before.status}; must be PENDING_APPROVAL to reject.`);
      err.statusCode = 400;
      throw err;
    }

    const result = await client.query(
      `UPDATE compliance_items SET status = 'REJECTED', rejection_reason = $1, updated_at = CURRENT_TIMESTAMP
       WHERE item_id = $2 AND status = 'PENDING_APPROVAL' RETURNING *`,
      [cleanReason, itemId]
    );
    if (result.rows.length === 0) {
      const err = new Error('This item was already processed (approved, rejected, or returned) by someone else.');
      err.statusCode = 409;
      throw err;
    }
    const after = result.rows[0];
    await writeAuditLog(client, {
      tableName: 'compliance_items', recordId: itemId, action: 'REJECTED',
      oldValues: { status: before.status }, newValues: { status: after.status, rejection_reason: after.rejection_reason },
      userId: actorId,
    });
    return after;
  });
};

// New Phase C action: send a PENDING_APPROVAL item back to its creator
// instead of an outright reject. Same shape as rejectComplianceItem
// (reason >=10 chars, atomic status-guard, audit_log) -- only the
// resulting status differs (RETURNED, not REJECTED), and only a RETURNED
// item can come back via resubmitComplianceItem below.
const returnComplianceItem = async (itemId, reason, actorId) => {
  const cleanReason = validateReason(reason, 'return');

  return withTransaction(async (client) => {
    const itemRes = await client.query(`SELECT * FROM compliance_items WHERE item_id = $1 FOR UPDATE`, [itemId]);
    if (itemRes.rows.length === 0) {
      const err = new Error('Compliance item not found');
      err.statusCode = 404;
      throw err;
    }
    const before = itemRes.rows[0];
    assertNotNewVocabularyItem(before, 'return');
    if (before.status !== 'PENDING_APPROVAL') {
      const err = new Error(`Item is currently ${before.status}; must be PENDING_APPROVAL to return.`);
      err.statusCode = 400;
      throw err;
    }

    const result = await client.query(
      `UPDATE compliance_items SET status = 'RETURNED', rejection_reason = $1, updated_at = CURRENT_TIMESTAMP
       WHERE item_id = $2 AND status = 'PENDING_APPROVAL' RETURNING *`,
      [cleanReason, itemId]
    );
    if (result.rows.length === 0) {
      const err = new Error('This item was already processed (approved, rejected, or returned) by someone else.');
      err.statusCode = 409;
      throw err;
    }
    const after = result.rows[0];
    await writeAuditLog(client, {
      tableName: 'compliance_items', recordId: itemId, action: 'RETURNED',
      oldValues: { status: before.status }, newValues: { status: after.status, rejection_reason: after.rejection_reason },
      userId: actorId,
    });
    return after;
  });
};

// RETURNED -> PENDING_APPROVAL. Creator or admin only, server-side
// enforced. Clears every previous-decision field (a clean slate for the
// next approver) and re-checks the evidence requirement -- the whole
// point of a return is "fix something," which for an item most often
// means replacing the evidence PDF (POST /items/:id/evidence already
// upserts regardless of status, so that part needed no change), and a
// resubmit without ever having re-attached one would silently skip
// straight back to PENDING_APPROVAL with nothing actually fixed. Self-
// approval rules apply unchanged on the resubmitted item's eventual
// approval, same as submitComplianceItem's original DRAFT->PENDING_
// APPROVAL transition.
const resubmitComplianceItem = async (itemId, actorId, isAdmin) => {
  return withTransaction(async (client) => {
    const itemRes = await client.query(`SELECT * FROM compliance_items WHERE item_id = $1 FOR UPDATE`, [itemId]);
    if (itemRes.rows.length === 0) {
      const err = new Error('Compliance item not found');
      err.statusCode = 404;
      throw err;
    }
    const before = itemRes.rows[0];
    assertNotNewVocabularyItem(before, 'resubmit');
    if (before.created_by !== actorId && !isAdmin) {
      const err = new Error('Only the creator or an admin can resubmit this item.');
      err.statusCode = 403;
      throw err;
    }

    const evidenceCheck = await client.query(`SELECT 1 FROM compliance_item_evidence WHERE item_id = $1`, [itemId]);
    if (evidenceCheck.rows.length === 0) {
      const err = new Error('A PDF evidence file must be attached before this item can be resubmitted.');
      err.statusCode = 400;
      throw err;
    }

    const result = await client.query(
      `UPDATE compliance_items
       SET status = 'PENDING_APPROVAL', approved_by = NULL, approved_at = NULL,
           is_self_approved = false, self_approval_justification = NULL, rejection_reason = NULL,
           updated_at = CURRENT_TIMESTAMP
       WHERE item_id = $1 AND status = 'RETURNED'
       RETURNING *`,
      [itemId]
    );
    if (result.rows.length === 0) {
      const err = new Error(`Item is currently ${before.status}; must be RETURNED to resubmit.`);
      err.statusCode = 409;
      throw err;
    }
    const after = result.rows[0];
    await writeAuditLog(client, {
      tableName: 'compliance_items', recordId: itemId, action: 'RESUBMITTED',
      oldValues: { status: before.status }, newValues: { status: after.status },
      userId: actorId,
    });
    return after;
  });
};

// New Phase C route (PATCH /items/:id didn't exist before this). Creator
// or admin only, and only while RETURNED -- server-side enforced, not
// just a hidden button, mirroring updateComplianceCategory's creator-path
// exactly. due_date is only editable for a ONE_OFF category (a RECURRING
// one still computes it server-side, same rule as creation/registration);
// evidence_file_ref is just the human-readable label, the actual PDF goes
// through the existing (unchanged) evidence upload endpoint.
const updateComplianceItem = async (itemId, updates, actorId, isAdmin) => {
  return withTransaction(async (client) => {
    const existing = await client.query(`SELECT * FROM compliance_items WHERE item_id = $1 FOR UPDATE`, [itemId]);
    if (existing.rows.length === 0) {
      const err = new Error('Compliance item not found.');
      err.statusCode = 404;
      throw err;
    }
    const item = existing.rows[0];

    if (item.created_by !== actorId && !isAdmin) {
      const err = new Error('Only the creator or an admin can edit this item.');
      err.statusCode = 403;
      throw err;
    }
    if (item.status !== 'RETURNED') {
      const err = new Error(`Item is currently ${item.status}; can only be edited while RETURNED.`);
      err.statusCode = 400;
      throw err;
    }

    const fields = [];
    const values = [];
    let i = 1;

    if ('issued_date' in updates) {
      fields.push(`issued_date = $${i++}`); values.push(updates.issued_date ? validateDateOnly(updates.issued_date, 'issued_date') : null);
    }
    if ('due_date' in updates) {
      const catRes = await client.query(`SELECT cadence_type FROM compliance_categories WHERE category_id = $1`, [item.category_id]);
      if (catRes.rows[0]?.cadence_type === 'RECURRING') {
        const err = new Error('due_date cannot be edited for a RECURRING category -- it is computed from the category cadence.');
        err.statusCode = 400;
        throw err;
      }
      if (!updates.due_date) {
        const err = new Error('due_date cannot be cleared.');
        err.statusCode = 400;
        throw err;
      }
      fields.push(`due_date = $${i++}`); values.push(validateDateOnly(updates.due_date, 'due_date'));
    }
    if ('evidence_file_ref' in updates) {
      fields.push(`evidence_file_ref = $${i++}`); values.push(updates.evidence_file_ref || null);
    }

    if (fields.length === 0) {
      const err = new Error('No updatable fields provided (issued_date, due_date, evidence_file_ref).');
      err.statusCode = 400;
      throw err;
    }

    fields.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(itemId);
    const result = await client.query(
      `UPDATE compliance_items SET ${fields.join(', ')} WHERE item_id = $${i} AND status = 'RETURNED' RETURNING *`,
      values
    );
    if (result.rows.length === 0) {
      const err = new Error('This item is no longer RETURNED (status changed by someone else).');
      err.statusCode = 409;
      throw err;
    }
    const after = result.rows[0];
    await writeAuditLog(client, {
      tableName: 'compliance_items', recordId: itemId, action: 'EDITED',
      oldValues: pickFields(item, Object.keys(updates)),
      newValues: pickFields(after, Object.keys(updates)),
      userId: actorId,
    });
    return after;
  });
};

// ─── Archive / withdraw / restore / delete -- items ────────────────────────
// Mirrors the category-side functions above exactly (same status guards,
// same author-or-admin gate, same audit_log shape). DRAFT hard-delete has
// no category equivalent -- categories never have a DRAFT status.

const deleteComplianceItem = async (itemId, actorId, isAdmin) => {
  return withTransaction(async (client) => {
    const itemRes = await client.query(`SELECT * FROM compliance_items WHERE item_id = $1 FOR UPDATE`, [itemId]);
    if (itemRes.rows.length === 0) {
      const err = new Error('Compliance item not found.');
      err.statusCode = 404;
      throw err;
    }
    const item = itemRes.rows[0];
    if (item.created_by !== actorId && !isAdmin) {
      const err = new Error('Only the creator or an admin can delete this item.');
      err.statusCode = 403;
      throw err;
    }
    if (item.status !== 'DRAFT') {
      const err = new Error(`Item is currently ${item.status}; only a DRAFT item can be deleted.`);
      err.statusCode = 400;
      throw err;
    }

    // Full row logged as old_values BEFORE the delete -- a hard delete has
    // no other record of what existed once the row is gone.
    await writeAuditLog(client, {
      tableName: 'compliance_items', recordId: itemId, action: 'DELETED',
      oldValues: item, newValues: null,
      userId: actorId,
    });
    const result = await client.query(`DELETE FROM compliance_items WHERE item_id = $1 AND status = 'DRAFT'`, [itemId]);
    if (result.rowCount === 0) {
      const err = new Error('This item is no longer DRAFT (status changed by someone else).');
      err.statusCode = 409;
      throw err;
    }
    return { deleted: true, item_id: itemId };
  });
};

const withdrawComplianceItem = async (itemId, reason, actorId, isAdmin) => {
  const cleanReason = validateReason(reason, 'withdrawal');

  return withTransaction(async (client) => {
    const itemRes = await client.query(`SELECT * FROM compliance_items WHERE item_id = $1 FOR UPDATE`, [itemId]);
    if (itemRes.rows.length === 0) {
      const err = new Error('Compliance item not found.');
      err.statusCode = 404;
      throw err;
    }
    const before = itemRes.rows[0];
    if (before.created_by !== actorId && !isAdmin) {
      const err = new Error('Only the creator or an admin can withdraw this item.');
      err.statusCode = 403;
      throw err;
    }

    const result = await client.query(
      `UPDATE compliance_items
       SET status = 'ARCHIVED', previous_status = status, archived_reason = $1, archived_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE item_id = $2 AND status = 'RETURNED'
       RETURNING *`,
      [cleanReason, itemId]
    );
    if (result.rows.length === 0) {
      const err = new Error(`Item is currently ${before.status}; must be RETURNED to withdraw.`);
      err.statusCode = 409;
      throw err;
    }
    const after = result.rows[0];
    await writeAuditLog(client, {
      tableName: 'compliance_items', recordId: itemId, action: 'WITHDRAWN',
      oldValues: { status: before.status }, newValues: { status: after.status, archived_reason: after.archived_reason },
      userId: actorId,
    });
    return after;
  });
};

const archiveComplianceItem = async (itemId, reason, actorId, isAdmin) => {
  const cleanReason = reason && reason.trim() ? reason.trim() : null;

  return withTransaction(async (client) => {
    const itemRes = await client.query(`SELECT * FROM compliance_items WHERE item_id = $1 FOR UPDATE`, [itemId]);
    if (itemRes.rows.length === 0) {
      const err = new Error('Compliance item not found.');
      err.statusCode = 404;
      throw err;
    }
    const before = itemRes.rows[0];
    if (before.created_by !== actorId && !isAdmin) {
      const err = new Error('Only the creator or an admin can archive this item.');
      err.statusCode = 403;
      throw err;
    }

    const result = await client.query(
      `UPDATE compliance_items
       SET status = 'ARCHIVED', previous_status = status, archived_reason = $1, archived_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE item_id = $2 AND status = 'REJECTED'
       RETURNING *`,
      [cleanReason, itemId]
    );
    if (result.rows.length === 0) {
      const err = new Error(`Item is currently ${before.status}; must be REJECTED to archive.`);
      err.statusCode = 409;
      throw err;
    }
    const after = result.rows[0];
    await writeAuditLog(client, {
      tableName: 'compliance_items', recordId: itemId, action: 'ARCHIVED',
      oldValues: { status: before.status }, newValues: { status: after.status, archived_reason: after.archived_reason },
      userId: actorId,
    });
    return after;
  });
};

const restoreComplianceItem = async (itemId, actorId) => {
  return withTransaction(async (client) => {
    const itemRes = await client.query(`SELECT * FROM compliance_items WHERE item_id = $1 FOR UPDATE`, [itemId]);
    if (itemRes.rows.length === 0) {
      const err = new Error('Compliance item not found.');
      err.statusCode = 404;
      throw err;
    }
    const before = itemRes.rows[0];
    if (before.status !== 'ARCHIVED') {
      const err = new Error(`Item is currently ${before.status}; must be ARCHIVED to restore.`);
      err.statusCode = 400;
      throw err;
    }

    const result = await client.query(
      `UPDATE compliance_items
       SET status = $1, previous_status = NULL, archived_reason = NULL, archived_at = NULL,
           updated_at = CURRENT_TIMESTAMP
       WHERE item_id = $2 AND status = 'ARCHIVED'
       RETURNING *`,
      [before.previous_status, itemId]
    );
    if (result.rows.length === 0) {
      const err = new Error('This item is no longer ARCHIVED (status changed by someone else).');
      err.statusCode = 409;
      throw err;
    }
    const after = result.rows[0];
    await writeAuditLog(client, {
      tableName: 'compliance_items', recordId: itemId, action: 'RESTORED',
      oldValues: { status: before.status }, newValues: { status: after.status },
      userId: actorId,
    });
    return after;
  });
};

module.exports = {
  EXECUTIVE_ROLES,
  OBLIGATION_KINDS,
  RECURRENCE_TYPES,
  CADENCE_TYPES,
  MIN_INTERVAL_MONTHS,
  MAX_INTERVAL_MONTHS,
  defaultReminderLadderForCadence,
  nextDueDateClamped,
  validateDateOnly,
  wrapQueryable,
  createComplianceCategory,
  listComplianceCategories,
  getComplianceCategoryDetail,
  updateComplianceCategory,
  approveComplianceCategory,
  rejectComplianceCategory,
  returnComplianceCategory,
  resubmitComplianceCategory,
  withdrawComplianceCategory,
  archiveComplianceCategory,
  restoreComplianceCategory,
  createComplianceItem,
  getComplianceItem,
  getComplianceItemDetail,
  listComplianceItems,
  submitComplianceItem,
  approveComplianceItem,
  rejectComplianceItem,
  returnComplianceItem,
  resubmitComplianceItem,
  updateComplianceItem,
  deleteComplianceItem,
  withdrawComplianceItem,
  archiveComplianceItem,
  restoreComplianceItem,
  uploadComplianceEvidence,
  getComplianceEvidence,
  verifyComplianceItem,
  returnEvidence,
};
