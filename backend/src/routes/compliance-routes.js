'use strict';

const express = require('express');
const router = express.Router();

const { authenticate, authorize } = require('../middleware/auth-middleware');
const complianceService = require('../services/compliance-service');
const { pool } = require('../services/auth-service');
const NotificationService = require('../services/notification-service');

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

module.exports = router;
