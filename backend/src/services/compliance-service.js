'use strict';

const { pool } = require('./auth-service');

const EXECUTIVE_ROLES = ['admin', 'cfo', 'ceo'];

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
function defaultReminderLadderForCadence(cadenceType, intervalMonths) {
  if (cadenceType === 'RECURRING' && intervalMonths === 1) return [5];
  if (cadenceType === 'RECURRING' && intervalMonths >= 2 && intervalMonths <= 5) return [14, 7, 3];
  return [30, 15, 10]; // ONE_OFF, or RECURRING >= 6 months
}

// The one and only place "next due = previous + interval, day clamped to
// month end" is computed -- shared by manual item registration
// (createComplianceItem below) and the scheduler's auto-generation
// (compliance-scheduler-service.js), so the two can never drift apart.
// `baseDate` is a real JS Date (UTC, date-only); returns a Date, also UTC
// date-only. Correctly handles month-index overflow (Date.UTC normalizes
// month > 11 into the following year on its own).
function nextDueDateClamped(baseDate, intervalMonths, dueDayOfMonth) {
  const year = baseDate.getUTCFullYear();
  const month = baseDate.getUTCMonth() + intervalMonths;
  const lastDayOfTargetMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const day = Math.min(dueDayOfMonth, lastDayOfTargetMonth);
  return new Date(Date.UTC(year, month, day));
}

function toDateOnlyString(date) {
  return date.toISOString().split('T')[0];
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
const createComplianceCategory = async ({
  name, regulator, cadence_type, interval_months, due_day_of_month, anchor_date,
  reminder_ladder_days, created_by,
}) => {
  if (!name || !name.trim()) {
    const err = new Error('name is required.');
    err.statusCode = 400;
    throw err;
  }
  if (!CADENCE_TYPES.includes(cadence_type)) {
    const err = new Error(`cadence_type must be one of: ${CADENCE_TYPES.join(', ')}.`);
    err.statusCode = 400;
    throw err;
  }

  let intervalMonths = null;
  let dueDayOfMonth = null;
  let anchorDate = null;

  if (cadence_type === 'RECURRING') {
    intervalMonths = Number(interval_months);
    if (!Number.isInteger(intervalMonths) || intervalMonths < MIN_INTERVAL_MONTHS || intervalMonths > MAX_INTERVAL_MONTHS) {
      const err = new Error(`interval_months is required for a RECURRING category and must be an integer between ${MIN_INTERVAL_MONTHS} and ${MAX_INTERVAL_MONTHS}.`);
      err.statusCode = 400;
      throw err;
    }
    // anchor_date is the source of truth for "first due date" -- required
    // at the API layer (not just the UI) so frontend and backend can never
    // drift on this, the same standard this project's own retrospective on
    // the junior_accountant access bug asked for. due_day_of_month is
    // auto-derived from anchor_date's own day-of-month unless the caller
    // explicitly overrides it (kept as its own column for the scheduler's
    // clamping math, not because it's independently meaningful).
    if (!anchor_date) {
      const err = new Error('anchor_date (first due date) is required for a RECURRING category.');
      err.statusCode = 400;
      throw err;
    }
    const parsedAnchor = new Date(anchor_date);
    if (isNaN(parsedAnchor.getTime())) {
      const err = new Error('anchor_date is not a valid date.');
      err.statusCode = 400;
      throw err;
    }
    anchorDate = toDateOnlyString(parsedAnchor);
    dueDayOfMonth = due_day_of_month != null ? Number(due_day_of_month) : parsedAnchor.getUTCDate();
    if (!Number.isInteger(dueDayOfMonth) || dueDayOfMonth < 1 || dueDayOfMonth > 31) {
      const err = new Error('due_day_of_month must be an integer between 1 and 31.');
      err.statusCode = 400;
      throw err;
    }
  }

  const ladder = reminder_ladder_days ?? defaultReminderLadderForCadence(cadence_type, intervalMonths);
  if (!Array.isArray(ladder) || ladder.length === 0 || !ladder.every((d) => Number.isInteger(d) && d > 0)) {
    const err = new Error('reminder_ladder_days must be a non-empty array of positive integers.');
    err.statusCode = 400;
    throw err;
  }

  const result = await pool.query(
    `INSERT INTO compliance_categories
       (name, regulator, cadence_type, interval_months, due_day_of_month, anchor_date, reminder_ladder_days, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
    [name.trim(), regulator || null, cadence_type, intervalMonths, dueDayOfMonth, anchorDate, ladder, created_by]
  );
  return result.rows[0];
};

// Next occurrence for a RECURRING category that has no upcoming item yet --
// either its very first occurrence (anchor_date itself, if nothing has ever
// been registered) or one interval past the most recent existing item.
// Shared by createComplianceItem (manual registration) and the scheduler's
// auto-generation, so the two never compute a different answer for the
// same category.
const nextDueDateForCategory = async (category) => {
  const mostRecent = await pool.query(
    `SELECT due_date FROM compliance_items WHERE category_id = $1 ORDER BY due_date DESC LIMIT 1`,
    [category.category_id]
  );
  if (mostRecent.rows.length === 0) {
    return new Date(category.anchor_date);
  }
  const base = new Date(mostRecent.rows[0].due_date);
  return nextDueDateClamped(base, category.interval_months, category.due_day_of_month);
};

// status filter powers three different views with one function:
//   - Register's category picker: status: 'ACTIVE' (+ activeOnly for
//     is_active -- both must hold, see the route for how they're combined).
//   - Categories management page: no status filter, everything.
//   - Approval queue: status: 'PENDING_APPROVAL'.
const listComplianceCategories = async ({ activeOnly, status } = {}) => {
  const conditions = [];
  const values = [];
  let i = 1;

  if (activeOnly) conditions.push(`is_active = true`);
  if (status) { conditions.push(`status = $${i++}`); values.push(status); }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const result = await pool.query(`SELECT * FROM compliance_categories ${whereClause} ORDER BY name`, values);
  return result.rows;
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
  const categoryRes = await pool.query(`SELECT * FROM compliance_categories WHERE category_id = $1`, [categoryId]);
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

  const result = await pool.query(
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
  return { category: result.rows[0], isSelfApproval };
};

const rejectComplianceCategory = async (categoryId, reason) => {
  if (!reason || !reason.trim()) {
    const err = new Error('A rejection reason is required.');
    err.statusCode = 400;
    throw err;
  }

  const categoryRes = await pool.query(`SELECT * FROM compliance_categories WHERE category_id = $1`, [categoryId]);
  if (categoryRes.rows.length === 0) {
    const err = new Error('Compliance category not found.');
    err.statusCode = 404;
    throw err;
  }
  if (categoryRes.rows[0].status !== 'PENDING_APPROVAL') {
    const err = new Error(`Category is currently ${categoryRes.rows[0].status}; must be PENDING_APPROVAL to reject.`);
    err.statusCode = 400;
    throw err;
  }

  const result = await pool.query(
    `UPDATE compliance_categories SET status = 'REJECTED', rejection_reason = $1, updated_at = CURRENT_TIMESTAMP
     WHERE category_id = $2 AND status = 'PENDING_APPROVAL' RETURNING *`,
    [reason, categoryId]
  );
  if (result.rows.length === 0) {
    const err = new Error('This category was already processed (approved or rejected) by someone else.');
    err.statusCode = 409;
    throw err;
  }
  return result.rows[0];
};

// Deliberately does not allow changing cadence_type/interval_months
// (formerly recurrence_type): the scheduler and the approval-time
// recurrence-rule bootstrap both key their logic off a category's cadence
// at the moment each item/rule was created. Changing it out from under
// existing items/rules would leave their behavior inconsistent with a
// category that no longer describes them -- a category whose cadence was
// set up wrong should be deactivated and recreated, not mutated in place.
// due_day_of_month/anchor_date CAN be edited (e.g. filling in the 7
// categories the flexible-cadence migration left NULL), since that's
// completing configuration, not changing the cadence's shape.
//
// Also deliberately does not accept `status` -- status only ever moves via
// approveComplianceCategory/rejectComplianceCategory below. is_active and
// status are different concerns: is_active is "still in use" (toggleable
// any time, by design, regardless of approval history); status is "has
// this been vetted at all." Letting this generic update touch status would
// let someone silently reactivate a REJECTED category, or flip a still-
// PENDING one straight to ACTIVE without ever going through approve() --
// exactly the conflation the session asked to avoid.
const updateComplianceCategory = async (categoryId, updates) => {
  const existing = await pool.query(`SELECT * FROM compliance_categories WHERE category_id = $1`, [categoryId]);
  if (existing.rows.length === 0) {
    const err = new Error('Compliance category not found.');
    err.statusCode = 404;
    throw err;
  }
  const category = existing.rows[0];

  for (const locked of ['recurrence_type', 'cadence_type', 'interval_months']) {
    if (locked in updates) {
      const err = new Error(`${locked} cannot be changed after creation. Deactivate this category and create a new one instead.`);
      err.statusCode = 400;
      throw err;
    }
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
  if ('anchor_date' in updates || 'due_day_of_month' in updates) {
    if (category.cadence_type !== 'RECURRING') {
      const err = new Error('anchor_date/due_day_of_month only apply to a RECURRING category.');
      err.statusCode = 400;
      throw err;
    }
    const anchorDate = 'anchor_date' in updates ? updates.anchor_date : category.anchor_date;
    if (!anchorDate) {
      const err = new Error('anchor_date cannot be cleared once set.');
      err.statusCode = 400;
      throw err;
    }
    const parsedAnchor = new Date(anchorDate);
    if (isNaN(parsedAnchor.getTime())) {
      const err = new Error('anchor_date is not a valid date.');
      err.statusCode = 400;
      throw err;
    }
    const dueDayOfMonth = 'due_day_of_month' in updates && updates.due_day_of_month != null
      ? Number(updates.due_day_of_month)
      : parsedAnchor.getUTCDate();
    if (!Number.isInteger(dueDayOfMonth) || dueDayOfMonth < 1 || dueDayOfMonth > 31) {
      const err = new Error('due_day_of_month must be an integer between 1 and 31.');
      err.statusCode = 400;
      throw err;
    }
    fields.push(`anchor_date = $${i++}`); values.push(toDateOnlyString(parsedAnchor));
    fields.push(`due_day_of_month = $${i++}`); values.push(dueDayOfMonth);
  }

  if (fields.length === 0) {
    const err = new Error('No updatable fields provided (name, regulator, reminder_ladder_days, is_active, anchor_date, due_day_of_month).');
    err.statusCode = 400;
    throw err;
  }

  fields.push(`updated_at = CURRENT_TIMESTAMP`);
  values.push(categoryId);
  const result = await pool.query(
    `UPDATE compliance_categories SET ${fields.join(', ')} WHERE category_id = $${i} RETURNING *`,
    values
  );
  return result.rows[0];
};

// ─── Items ──────────────────────────────────────────────────────────────────

// due_date is no longer collected from the caller for a RECURRING category
// -- it's computed from the category's own cadence (nextDueDateForCategory,
// shared with the scheduler), so a manually-registered item can never drift
// from what the category actually defines. ONE_OFF categories are
// unchanged: due_date is required, freely chosen by the creator, since
// there's no cadence to compute from. day_of_month_due is no longer
// collected either -- due day now lives on the category (see the flexible-
// cadence migration); the column stays on compliance_items only so the 3
// pre-migration items remain readable, nothing new writes to it.
const createComplianceItem = async ({ category_id, issued_date, due_date, evidence_file_ref, created_by }) => {
  const categoryRes = await pool.query(
    `SELECT * FROM compliance_categories WHERE category_id = $1`,
    [category_id]
  );
  const category = categoryRes.rows[0];
  if (!category) {
    const err = new Error('Compliance category not found.');
    err.statusCode = 404;
    throw err;
  }

  let computedDueDate;
  if (category.cadence_type === 'RECURRING') {
    if (!category.anchor_date || !category.due_day_of_month) {
      const err = new Error(
        `This category's cadence isn't fully configured yet (missing anchor date / due day). ` +
        `An executive needs to set this on the Categories page before items can be registered against it.`
      );
      err.statusCode = 400;
      throw err;
    }
    computedDueDate = toDateOnlyString(await nextDueDateForCategory(category));
  } else {
    if (!due_date) {
      const err = new Error('due_date is required for a one-off category.');
      err.statusCode = 400;
      throw err;
    }
    computedDueDate = due_date;
  }

  const result = await pool.query(
    `INSERT INTO compliance_items (category_id, issued_date, due_date, evidence_file_ref, created_by, status)
     VALUES ($1, $2, $3, $4, $5, 'DRAFT')
     RETURNING *`,
    [category_id, issued_date || null, computedDueDate, evidence_file_ref || null, created_by]
  );
  return result.rows[0];
};

const getComplianceItem = async (itemId) => {
  const result = await pool.query(`SELECT * FROM compliance_items WHERE item_id = $1`, [itemId]);
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
const listComplianceItems = async ({ role, userId, status, needsAcknowledgement, mine }) => {
  const conditions = [];
  const values = [];
  let i = 1;

  if (!EXECUTIVE_ROLES.includes(role)) {
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

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const result = await pool.query(
    `SELECT ci.*,
            cc.name AS category_name, cc.regulator, cc.recurrence_type, cc.reminder_ladder_days,
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
     ${whereClause}
     ORDER BY ci.due_date ASC`,
    values
  );
  return result.rows;
};

const submitComplianceItem = async (itemId, userId, isAdmin) => {
  const item = await getComplianceItem(itemId);
  if (!item) throw new Error('Compliance item not found');

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

  const evidenceCheck = await pool.query(`SELECT 1 FROM compliance_item_evidence WHERE item_id = $1`, [itemId]);
  if (evidenceCheck.rows.length === 0) {
    const err = new Error('A PDF evidence file must be attached before this item can be submitted for approval.');
    err.statusCode = 400;
    throw err;
  }

  const result = await pool.query(
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
const uploadComplianceEvidence = async ({ itemId, fileBuffer, filename, fileSizeBytes, uploadedBy }) => {
  const item = await getComplianceItem(itemId);
  if (!item) {
    const err = new Error('Compliance item not found.');
    err.statusCode = 404;
    throw err;
  }

  const result = await pool.query(
    `INSERT INTO compliance_item_evidence (item_id, file_data, filename, file_size_bytes, uploaded_by)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (item_id) DO UPDATE
       SET file_data = EXCLUDED.file_data, filename = EXCLUDED.filename,
           file_size_bytes = EXCLUDED.file_size_bytes, uploaded_by = EXCLUDED.uploaded_by,
           uploaded_at = CURRENT_TIMESTAMP
     RETURNING evidence_id, item_id, filename, file_size_bytes, uploaded_by, uploaded_at`,
    [itemId, fileBuffer, filename, fileSizeBytes, uploadedBy]
  );
  return result.rows[0];
};

const getComplianceEvidence = async (itemId) => {
  const result = await pool.query(
    `SELECT file_data, filename FROM compliance_item_evidence WHERE item_id = $1`,
    [itemId]
  );
  return result.rows[0];
};

// Approve — handles both ordinary approval and self-approval (executive
// roles only, justification required), and the "annual approval at point
// of creation" recurrence-rule bootstrap for MONTHLY_RECURRING /
// ANNUAL_RECURRING categories.
const approveComplianceItem = async (itemId, approverId, approverRole, justification) => {
  const client = await pool.connect();
  // A pool-level pool.on('error', ...) only catches errors on IDLE clients
  // sitting in the pool -- a client actively checked out via pool.connect()
  // (this manual BEGIN/COMMIT transaction) emits its own 'error' event
  // directly on itself if the underlying connection drops mid-transaction,
  // and with no listener here that becomes an uncaught exception that
  // crashes the whole process (confirmed live: a real Neon connection drop
  // during this exact transaction did exactly that). Log-and-continue, same
  // policy as every pool-level handler elsewhere in this codebase -- the
  // surrounding try/catch below already handles ROLLBACK for the normal
  // query-promise-rejection path; this only covers the async, out-of-band
  // connection-level error pg-pool doesn't route through that promise.
  client.on('error', (err) => {
    console.error('❌ Unexpected error on compliance-approval client connection:', err.message);
  });
  try {
    await client.query('BEGIN');

    const itemRes = await client.query(`SELECT * FROM compliance_items WHERE item_id = $1 FOR UPDATE`, [itemId]);
    if (itemRes.rows.length === 0) {
      const err = new Error('Compliance item not found');
      err.statusCode = 404;
      throw err;
    }
    const item = itemRes.rows[0];

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

    await client.query('COMMIT');
    return { item: updatedItem, isSelfApproval, recurrenceRuleCreated };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

// Single-item version of listComplianceItems's joined shape -- used for a
// detail view. Does NOT enforce role-scoping itself (the route decides
// whether the requester is allowed to see this particular item); it only
// fetches and shapes the data.
const getComplianceItemDetail = async (itemId) => {
  const result = await pool.query(
    `SELECT ci.*,
            cc.name AS category_name, cc.regulator, cc.recurrence_type, cc.reminder_ladder_days,
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

const rejectComplianceItem = async (itemId, reason) => {
  if (!reason || !reason.trim()) {
    const err = new Error('A rejection reason is required.');
    err.statusCode = 400;
    throw err;
  }

  const itemRes = await pool.query(`SELECT * FROM compliance_items WHERE item_id = $1`, [itemId]);
  if (itemRes.rows.length === 0) {
    const err = new Error('Compliance item not found');
    err.statusCode = 404;
    throw err;
  }
  const item = itemRes.rows[0];
  if (item.status !== 'PENDING_APPROVAL') {
    const err = new Error(`Item is currently ${item.status}; must be PENDING_APPROVAL to reject.`);
    err.statusCode = 400;
    throw err;
  }

  const result = await pool.query(
    `UPDATE compliance_items SET status = 'REJECTED', rejection_reason = $1, updated_at = CURRENT_TIMESTAMP
     WHERE item_id = $2 RETURNING *`,
    [reason, itemId]
  );
  return result.rows[0];
};

module.exports = {
  EXECUTIVE_ROLES,
  RECURRENCE_TYPES,
  CADENCE_TYPES,
  MIN_INTERVAL_MONTHS,
  MAX_INTERVAL_MONTHS,
  defaultReminderLadderForCadence,
  nextDueDateClamped,
  nextDueDateForCategory,
  createComplianceCategory,
  listComplianceCategories,
  updateComplianceCategory,
  approveComplianceCategory,
  rejectComplianceCategory,
  createComplianceItem,
  getComplianceItem,
  getComplianceItemDetail,
  listComplianceItems,
  submitComplianceItem,
  approveComplianceItem,
  rejectComplianceItem,
  uploadComplianceEvidence,
  getComplianceEvidence,
};
