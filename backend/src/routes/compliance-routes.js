'use strict';

const express = require('express');
const router = express.Router();

const crypto = require('crypto');
const { authenticate, authorize } = require('../middleware/auth-middleware');
const complianceService = require('../services/compliance-service');
const schedulerService = require('../services/compliance-scheduler-service');
const { pool } = require('../services/auth-service');
const NotificationService = require('../services/notification-service');

// ─── Scheduler webhook — registered BEFORE router.use(authenticate) below,
// so it never requires a user JWT. Called by an external cron service, not
// a logged-in user; authenticated purely via the shared secret header. ────

function timingSafeSecretMatch(provided, expected) {
  // Hashing both to a fixed length sidesteps two problems with a naive
  // Buffer.from(a).length !== Buffer.from(b).length check:
  // crypto.timingSafeEqual throws on mismatched buffer lengths, and a
  // length-based early exit would itself leak the secret's length via timing.
  const providedHash = crypto.createHash('sha256').update(String(provided || '')).digest();
  const expectedHash = crypto.createHash('sha256').update(String(expected || '')).digest();
  return crypto.timingSafeEqual(providedHash, expectedHash);
}

router.post('/scheduler/run', async (req, res) => {
  const provided = req.headers['x-scheduler-secret'];
  const expected = process.env.COMPLIANCE_SCHEDULER_SECRET;

  if (!provided || !expected || !timingSafeSecretMatch(provided, expected)) {
    return res.status(401).json({ message: 'Invalid or missing X-Scheduler-Secret.' });
  }

  try {
    const dryRun = req.body?.dryRun === true;
    const summary = await schedulerService.runScheduler({ dryRun });
    res.json(summary);
  } catch (error) {
    console.error('❌ [Compliance Scheduler] Run failed:', error);
    res.status(500).json({ message: error.message });
  }
});

router.use(authenticate);

const getUserEmail = async (userId) => {
  const result = await pool.query(`SELECT email FROM users WHERE user_id = $1`, [userId]);
  return result.rows[0]?.email;
};

// ─── Create ─────────────────────────────────────────────────────────────────

router.post('/items', authorize(['junior_accountant', 'admin', 'cfo', 'ceo']), async (req, res) => {
  try {
    const { category_id, issued_date, due_date, evidence_file_ref } = req.body;
    if (!category_id || !due_date) {
      return res.status(400).json({ message: 'category_id and due_date are required.' });
    }
    const item = await complianceService.createComplianceItem({
      category_id, issued_date, due_date, evidence_file_ref,
      created_by: req.user.user_id
    });
    res.status(201).json(item);
  } catch (error) {
    res.status(error.statusCode || 400).json({ message: error.message });
  }
});

// ─── Submit ─────────────────────────────────────────────────────────────────

router.post('/items/:id/submit', async (req, res) => {
  try {
    const isAdmin = req.user.role === 'admin';
    const item = await complianceService.submitComplianceItem(req.params.id, req.user.user_id, isAdmin);

    const emails = await NotificationService.getEmailsByRole(['admin', 'cfo', 'ceo']);
    const html = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
        <div style="background-color:#3b82f6;padding:20px;text-align:center;color:white;"><h2>Compliance Item Awaiting Approval</h2></div>
        <div style="padding:20px;color:#334155;">
          <p>A compliance item has been submitted and requires your approval.</p>
          <p><strong>Due date:</strong> ${item.due_date}</p>
          <p>Please log in to the Vilagio ERP Compliance module to review.</p>
        </div>
      </div>`;
    NotificationService.sendEmail(emails, `Action Required: Compliance Item Pending Approval`, html).catch(console.error);

    res.json(item);
  } catch (error) {
    res.status(error.statusCode || 400).json({ message: error.message });
  }
});

// ─── Approve ────────────────────────────────────────────────────────────────

router.post('/items/:id/approve', authorize(['admin', 'cfo', 'ceo']), async (req, res) => {
  try {
    const { justification } = req.body;
    const { item, isSelfApproval, recurrenceRuleCreated } = await complianceService.approveComplianceItem(
      req.params.id, req.user.user_id, req.user.role, justification
    );

    if (isSelfApproval) {
      const otherExecutiveRoles = complianceService.EXECUTIVE_ROLES.filter(r => r !== req.user.role);
      const emails = await NotificationService.getEmailsByRole(otherExecutiveRoles);
      const html = `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
          <div style="background-color:#fb923c;padding:20px;text-align:center;color:white;"><h2>Self-Approved — Review</h2></div>
          <div style="padding:20px;color:#334155;">
            <p>A compliance item was self-approved by <strong>${req.user.full_name}</strong> (${req.user.role.toUpperCase()}).</p>
            <p><strong>Justification:</strong> ${item.self_approval_justification}</p>
            <p>Please log in to the Vilagio ERP Compliance module to review.</p>
          </div>
        </div>`;
      NotificationService.sendEmail(emails, `Self-Approved — Review Required`, html).catch(console.error);
    } else {
      const creatorEmail = await getUserEmail(item.created_by);
      if (creatorEmail) {
        const html = `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
            <div style="background-color:#4ade80;padding:20px;text-align:center;color:white;"><h2>Compliance Item Approved</h2></div>
            <div style="padding:20px;color:#334155;">
              <p>Your compliance item has been approved.</p>
            </div>
          </div>`;
        NotificationService.sendEmail([creatorEmail], `Compliance Item Approved`, html).catch(console.error);
      }
    }

    res.json({ item, recurrence_rule_created: recurrenceRuleCreated });
  } catch (error) {
    res.status(error.statusCode || 400).json({ message: error.message });
  }
});

// ─── Reject ─────────────────────────────────────────────────────────────────

router.post('/items/:id/reject', authorize(['admin', 'cfo', 'ceo']), async (req, res) => {
  try {
    const { reason } = req.body;
    const item = await complianceService.rejectComplianceItem(req.params.id, reason);

    const creatorEmail = await getUserEmail(item.created_by);
    if (creatorEmail) {
      const html = `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
          <div style="background-color:#fb923c;padding:20px;text-align:center;color:white;"><h2>Compliance Item Rejected</h2></div>
          <div style="padding:20px;color:#334155;">
            <p>Your compliance item was rejected.</p>
            <p><strong>Reason:</strong> ${item.rejection_reason}</p>
          </div>
        </div>`;
      NotificationService.sendEmail([creatorEmail], `Compliance Item Rejected`, html).catch(console.error);
    }

    res.json(item);
  } catch (error) {
    res.status(error.statusCode || 400).json({ message: error.message });
  }
});

// ─── Acknowledge (Phase 4) ──────────────────────────────────────────────────
// Any authenticated user, not role-restricted -- per the session spec. Worth
// confirming this is actually intended: every other compliance action
// (create/submit/approve/reject) is role-gated, and this is the one place a
// plain viewer-role user could act on a compliance item with no other stake
// in it. Implemented as specified; flagging rather than silently narrowing it.
router.post('/items/:id/acknowledge', async (req, res) => {
  try {
    const { note } = req.body;
    const itemId = req.params.id;

    const itemCheck = await pool.query(`SELECT item_id, status FROM compliance_items WHERE item_id = $1`, [itemId]);
    if (itemCheck.rows.length === 0) {
      return res.status(404).json({ message: 'Compliance item not found.' });
    }

    const existing = await pool.query(`SELECT 1 FROM compliance_acknowledgements WHERE item_id = $1`, [itemId]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ message: 'This item has already been acknowledged.' });
    }

    // NON_COMPLIANT is not reverted on acknowledgement -- the event stays on
    // record even after late resolution; only the reminder/escalation cycle
    // stops (the scheduler's queries already exclude any item with an ack
    // row). Implemented as specified; flagging per the session's own ask
    // rather than silently assuming this is definitely the intended design.
    const result = await pool.query(
      `INSERT INTO compliance_acknowledgements (item_id, acknowledged_by, note) VALUES ($1, $2, $3) RETURNING *`,
      [itemId, req.user.user_id, note || null]
    );

    const emails = await NotificationService.getEmailsByRole(['admin', 'cfo', 'ceo']);
    const html = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
        <div style="background-color:#4ade80;padding:20px;text-align:center;color:white;"><h2>Compliance Item Acknowledged</h2></div>
        <div style="padding:20px;color:#334155;">
          <p>A compliance item has been acknowledged by <strong>${req.user.full_name}</strong>.</p>
          ${note ? `<p><strong>Note:</strong> ${note}</p>` : ''}
        </div>
      </div>`;
    NotificationService.sendEmail(emails, `Compliance Item Acknowledged`, html).catch(console.error);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    if (error.code === '23505') { // unique_violation -- race-condition backstop for the check above
      return res.status(409).json({ message: 'This item has already been acknowledged.' });
    }
    res.status(error.statusCode || 400).json({ message: error.message });
  }
});

module.exports = router;
