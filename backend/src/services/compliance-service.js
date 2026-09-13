'use strict';

const { pool } = require('./auth-service');

const EXECUTIVE_ROLES = ['admin', 'cfo', 'ceo'];

// ─── Items ──────────────────────────────────────────────────────────────────

const createComplianceItem = async ({ category_id, issued_date, due_date, evidence_file_ref, created_by }) => {
  const result = await pool.query(
    `INSERT INTO compliance_items (category_id, issued_date, due_date, evidence_file_ref, created_by, status)
     VALUES ($1, $2, $3, $4, $5, 'DRAFT')
     RETURNING *`,
    [category_id, issued_date || null, due_date, evidence_file_ref || null, created_by]
  );
  return result.rows[0];
};

const getComplianceItem = async (itemId) => {
  const result = await pool.query(`SELECT * FROM compliance_items WHERE item_id = $1`, [itemId]);
  return result.rows[0];
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

  const result = await pool.query(
    `UPDATE compliance_items SET status = 'PENDING_APPROVAL', updated_at = CURRENT_TIMESTAMP
     WHERE item_id = $1 RETURNING *`,
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
        const ruleRes = await client.query(
          `INSERT INTO compliance_recurrence_rule
             (category_id, recurrence_type, next_reapproval_due, last_reapproved_at, last_reapproved_by)
           VALUES ($1, $2, (CURRENT_DATE + INTERVAL '12 months'), CURRENT_TIMESTAMP, $3)
           RETURNING *`,
          [item.category_id, category.recurrence_type, approverId]
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
  createComplianceItem,
  getComplianceItem,
  submitComplianceItem,
  approveComplianceItem,
  rejectComplianceItem,
};
