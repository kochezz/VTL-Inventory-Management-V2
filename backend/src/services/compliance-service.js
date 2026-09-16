'use strict';

const { pool } = require('./auth-service');

const EXECUTIVE_ROLES = ['admin', 'cfo', 'ceo'];
const RECURRENCE_TYPES = ['ONE_OFF_EXPIRY', 'MONTHLY_RECURRING', 'ANNUAL_RECURRING'];
const DEFAULT_REMINDER_LADDER_DAYS = [30, 15, 10, 5];

// ─── Categories (Phase 5) ───────────────────────────────────────────────────
// Categories were previously only ever created by direct DB insert (see
// tests/helpers/test-helper.js's createComplianceCategory, and every ad hoc
// verification script across Phases 2-4). This is the first real API
// surface for them -- create/list/update, deliberately NOT delete (a
// category with items pointing at it should be deactivated, not removed).

const createComplianceCategory = async ({ name, regulator, recurrence_type, reminder_ladder_days }) => {
  if (!name || !name.trim()) {
    const err = new Error('name is required.');
    err.statusCode = 400;
    throw err;
  }
  if (!RECURRENCE_TYPES.includes(recurrence_type)) {
    const err = new Error(`recurrence_type must be one of: ${RECURRENCE_TYPES.join(', ')}.`);
    err.statusCode = 400;
    throw err;
  }

  const ladder = reminder_ladder_days ?? DEFAULT_REMINDER_LADDER_DAYS;
  if (!Array.isArray(ladder) || ladder.length === 0 || !ladder.every((d) => Number.isInteger(d) && d > 0)) {
    const err = new Error('reminder_ladder_days must be a non-empty array of positive integers.');
    err.statusCode = 400;
    throw err;
  }

  const result = await pool.query(
    `INSERT INTO compliance_categories (name, regulator, recurrence_type, reminder_ladder_days)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [name.trim(), regulator || null, recurrence_type, ladder]
  );
  return result.rows[0];
};

const listComplianceCategories = async ({ activeOnly } = {}) => {
  const result = await pool.query(
    activeOnly
      ? `SELECT * FROM compliance_categories WHERE is_active = true ORDER BY name`
      : `SELECT * FROM compliance_categories ORDER BY name`
  );
  return result.rows;
};

// Deliberately does not allow changing recurrence_type: the scheduler
// (compliance-scheduler-service.js) and the approval-time recurrence-rule
// bootstrap both key their logic off a category's recurrence_type at the
// moment each item/rule was created. Changing it out from under existing
// items/rules would leave their behavior inconsistent with a category that
// no longer describes them -- a category whose cadence was set up wrong
// should be deactivated and recreated, not mutated in place.
const updateComplianceCategory = async (categoryId, updates) => {
  const existing = await pool.query(`SELECT * FROM compliance_categories WHERE category_id = $1`, [categoryId]);
  if (existing.rows.length === 0) {
    const err = new Error('Compliance category not found.');
    err.statusCode = 404;
    throw err;
  }

  if ('recurrence_type' in updates) {
    const err = new Error('recurrence_type cannot be changed after creation. Deactivate this category and create a new one instead.');
    err.statusCode = 400;
    throw err;
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

  if (fields.length === 0) {
    const err = new Error('No updatable fields provided (name, regulator, reminder_ladder_days, is_active).');
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

// day_of_month_due is required (1-31) when the item's category is
// MONTHLY_RECURRING -- enforced here at the application layer rather than a
// column-level NOT NULL, since the column is legitimately NULL for
// ONE_OFF_EXPIRY/ANNUAL_RECURRING items. This is the only point in the
// item's lifecycle where the creator (who knows the cadence) provides it;
// approveComplianceItem's recurrence-rule bootstrap below just carries it
// forward onto compliance_recurrence_rule, it doesn't collect it.
const createComplianceItem = async ({ category_id, issued_date, due_date, evidence_file_ref, day_of_month_due, created_by }) => {
  const categoryRes = await pool.query(
    `SELECT recurrence_type FROM compliance_categories WHERE category_id = $1`,
    [category_id]
  );
  const category = categoryRes.rows[0];
  if (!category) {
    const err = new Error('Compliance category not found.');
    err.statusCode = 404;
    throw err;
  }

  let dayOfMonthDue = day_of_month_due ?? null;
  if (category.recurrence_type === 'MONTHLY_RECURRING') {
    dayOfMonthDue = Number(day_of_month_due);
    if (!Number.isInteger(dayOfMonthDue) || dayOfMonthDue < 1 || dayOfMonthDue > 31) {
      const err = new Error('day_of_month_due (1-31) is required for MONTHLY_RECURRING categories.');
      err.statusCode = 400;
      throw err;
    }
  }

  const result = await pool.query(
    `INSERT INTO compliance_items (category_id, issued_date, due_date, evidence_file_ref, day_of_month_due, created_by, status)
     VALUES ($1, $2, $3, $4, $5, $6, 'DRAFT')
     RETURNING *`,
    [category_id, issued_date || null, due_date, evidence_file_ref || null, dayOfMonthDue, created_by]
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
              (SELECT array_agg(DISTINCT crl.tier ORDER BY crl.tier) FROM compliance_reminder_log crl WHERE crl.item_id = ci.item_id),
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
    // ever hitting it in the first place.
    let recurrenceRuleCreated = null;
    const categoryRes = await client.query(
      `SELECT recurrence_type FROM compliance_categories WHERE category_id = $1`,
      [item.category_id]
    );
    const category = categoryRes.rows[0];

    if (category && (category.recurrence_type === 'MONTHLY_RECURRING' || category.recurrence_type === 'ANNUAL_RECURRING')) {
      const existingRule = await client.query(
        `SELECT rule_id FROM compliance_recurrence_rule WHERE category_id = $1`,
        [item.category_id]
      );
      if (existingRule.rows.length === 0) {
        // item.day_of_month_due is set at creation time (required for
        // MONTHLY_RECURRING, see createComplianceItem above) and carried
        // straight onto the rule here -- this is what fixes the scheduler's
        // Step 3 monthly-generation logic, which previously always found
        // day_of_month_due NULL on every rule it bootstrapped.
        const ruleRes = await client.query(
          `INSERT INTO compliance_recurrence_rule
             (category_id, recurrence_type, day_of_month_due, next_reapproval_due, last_reapproved_at, last_reapproved_by)
           VALUES ($1, $2, $3, (CURRENT_DATE + INTERVAL '12 months'), CURRENT_TIMESTAMP, $4)
           RETURNING *`,
          [item.category_id, category.recurrence_type, item.day_of_month_due, approverId]
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
              (SELECT array_agg(DISTINCT crl.tier ORDER BY crl.tier) FROM compliance_reminder_log crl WHERE crl.item_id = ci.item_id),
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
  createComplianceCategory,
  listComplianceCategories,
  updateComplianceCategory,
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
