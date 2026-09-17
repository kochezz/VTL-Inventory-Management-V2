'use strict';

const express = require('express');
const router = express.Router();

const crypto = require('crypto');
const multer = require('multer');
const { authenticate, authorize } = require('../middleware/auth-middleware');
const complianceService = require('../services/compliance-service');
const schedulerService = require('../services/compliance-scheduler-service');
const { pool } = require('../services/auth-service');
const NotificationService = require('../services/notification-service');

// Same memoryStorage pattern already established for QMS file uploads --
// the buffer is stored straight into Neon (compliance_item_evidence),
// never written to local disk. 10MB is generous for a scanned certificate
// without being reckless.
const evidenceUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    file.mimetype === 'application/pdf'
      ? cb(null, true)
      : cb(new Error('Only PDF files are accepted.'));
  },
});

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

// ─── Categories ──────────────────────────────────────────────────────────────
// junior_accountant AND manager can PROPOSE a category, but every new one
// lands PENDING_APPROVAL regardless of who created it -- an executive still
// has to approve it before it's usable (see /categories/:id/approve below),
// which is what actually closes the "no executive ever has to look at it"
// gap. Only the approval/reject/edit actions stay executive-only. manager is
// scoped to create+list here only -- it does NOT get My Tasks/Register
// Item/Approval Queue access, since only the Categories-page gap was in
// scope for this extension.

router.post('/categories', authorize(['junior_accountant', 'manager', 'admin', 'cfo', 'ceo']), async (req, res) => {
  try {
    const { name, regulator, recurrence_type, reminder_ladder_days } = req.body;
    const category = await complianceService.createComplianceCategory({
      name, regulator, recurrence_type, reminder_ladder_days,
      created_by: req.user.user_id,
    });
    res.status(201).json(category);
  } catch (error) {
    res.status(error.statusCode || 400).json({ message: error.message });
  }
});

// junior_accountant, manager, and the 3 executive roles can list categories
// (junior_accountant needs this for the item-registration category picker,
// and both non-executive roles need it to see their own pending proposals
// on the Categories page) -- only creating/editing/approving is more
// restricted. ?status=ACTIVE (combined with the default active_only=true)
// is what the Register page's picker uses to exclude PENDING_APPROVAL/
// REJECTED categories -- the actual enforcement mechanism, not just a UI
// nicety.
router.get('/categories', authorize(['junior_accountant', 'manager', 'admin', 'cfo', 'ceo']), async (req, res) => {
  try {
    const activeOnly = req.query.active_only !== 'false'; // defaults to true
    const status = req.query.status || undefined;
    const categories = await complianceService.listComplianceCategories({ activeOnly, status });
    res.json(categories);
  } catch (error) {
    res.status(error.statusCode || 400).json({ message: error.message });
  }
});

router.patch('/categories/:id', authorize(['admin', 'cfo', 'ceo']), async (req, res) => {
  try {
    const category = await complianceService.updateComplianceCategory(req.params.id, req.body);
    res.json(category);
  } catch (error) {
    res.status(error.statusCode || 400).json({ message: error.message });
  }
});

router.post('/categories/:id/approve', authorize(['admin', 'cfo', 'ceo']), async (req, res) => {
  try {
    const { justification } = req.body;
    const { category, isSelfApproval } = await complianceService.approveComplianceCategory(
      req.params.id, req.user.user_id, req.user.role, justification
    );
    res.json({ category, is_self_approved: isSelfApproval });
  } catch (error) {
    res.status(error.statusCode || 400).json({ message: error.message });
  }
});

router.post('/categories/:id/reject', authorize(['admin', 'cfo', 'ceo']), async (req, res) => {
  try {
    const { reason } = req.body;
    const category = await complianceService.rejectComplianceCategory(req.params.id, reason);
    res.json(category);
  } catch (error) {
    res.status(error.statusCode || 400).json({ message: error.message });
  }
});

// ─── List / detail ──────────────────────────────────────────────────────────

router.get('/items', authorize(['junior_accountant', 'manager', 'admin', 'cfo', 'ceo']), async (req, res) => {
  try {
    const { status, needs_acknowledgement, mine } = req.query;
    const items = await complianceService.listComplianceItems({
      role: req.user.role,
      userId: req.user.user_id,
      status: status ? status.split(',') : undefined,
      needsAcknowledgement: needs_acknowledgement === 'true',
      mine: mine === 'true',
    });
    res.json(items);
  } catch (error) {
    res.status(error.statusCode || 400).json({ message: error.message });
  }
});

// Same visibility rule the list endpoint applies: a non-executive can only
// see their own item, or one that's open for acknowledgement. Shared here
// so the evidence GET route below enforces the identical rule rather than
// a hand-copied restatement of it.
function canViewItem(item, user) {
  const isExecutive = complianceService.EXECUTIVE_ROLES.includes(user.role);
  const isOwnItem = item.created_by === user.user_id;
  const isOpenForAck = item.status === 'NON_COMPLIANT' && !item.is_acknowledged;
  return isExecutive || isOwnItem || isOpenForAck;
}

router.get('/items/:id', authorize(['junior_accountant', 'manager', 'admin', 'cfo', 'ceo']), async (req, res) => {
  try {
    const item = await complianceService.getComplianceItemDetail(req.params.id);
    if (!item) return res.status(404).json({ message: 'Compliance item not found.' });

    if (!canViewItem(item, req.user)) {
      return res.status(403).json({ message: 'You do not have access to this compliance item.' });
    }

    res.json(item);
  } catch (error) {
    res.status(error.statusCode || 400).json({ message: error.message });
  }
});

// ─── Evidence (PDF upload/download) ─────────────────────────────────────────

router.post('/items/:id/evidence', authorize(['junior_accountant', 'manager', 'admin', 'cfo', 'ceo']), (req, res) => {
  evidenceUpload.single('evidence')(req, res, async (err) => {
    // multer's fileFilter/limits errors land here, not in a try/catch --
    // handled explicitly so they come back as a clean 400, not the global
    // error handler's generic 500 (which is what QMS's own upload route
    // falls back to today for the same kind of error).
    if (err) {
      const message = err.code === 'LIMIT_FILE_SIZE'
        ? 'File exceeds the 10MB limit.'
        : err.message || 'Upload failed.';
      return res.status(400).json({ message });
    }
    if (!req.file) return res.status(400).json({ message: 'No file uploaded.' });

    try {
      const evidence = await complianceService.uploadComplianceEvidence({
        itemId: req.params.id,
        fileBuffer: req.file.buffer,
        filename: req.file.originalname,
        fileSizeBytes: req.file.size,
        uploadedBy: req.user.user_id,
      });
      res.status(201).json(evidence);
    } catch (error) {
      res.status(error.statusCode || 400).json({ message: error.message });
    }
  });
});

router.get('/items/:id/evidence', authorize(['junior_accountant', 'manager', 'admin', 'cfo', 'ceo']), async (req, res) => {
  try {
    const item = await complianceService.getComplianceItemDetail(req.params.id);
    if (!item) return res.status(404).json({ message: 'Compliance item not found.' });
    if (!canViewItem(item, req.user)) {
      return res.status(403).json({ message: 'You do not have access to this compliance item.' });
    }

    const evidence = await complianceService.getComplianceEvidence(req.params.id);
    if (!evidence) return res.status(404).json({ message: 'No evidence file has been uploaded for this item.' });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${evidence.filename || 'evidence.pdf'}"`);
    res.send(evidence.file_data);
  } catch (error) {
    res.status(error.statusCode || 400).json({ message: error.message });
  }
});

// ─── Create ─────────────────────────────────────────────────────────────────

router.post('/items', authorize(['junior_accountant', 'manager', 'admin', 'cfo', 'ceo']), async (req, res) => {
  try {
    const { category_id, issued_date, due_date, evidence_file_ref, day_of_month_due } = req.body;
    if (!category_id || !due_date) {
      return res.status(400).json({ message: 'category_id and due_date are required.' });
    }
    const item = await complianceService.createComplianceItem({
      category_id, issued_date, due_date, evidence_file_ref, day_of_month_due,
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

    const emails = await NotificationService.getComplianceNotificationEmails(['admin', 'cfo', 'ceo']);
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
      const emails = await NotificationService.getComplianceNotificationEmails(otherExecutiveRoles);
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
// Restricted to the same role set as create/submit -- a plain viewer-role
// user has no stake in a compliance item and shouldn't be able to act on one.
router.post('/items/:id/acknowledge', authorize(['junior_accountant', 'manager', 'admin', 'cfo', 'ceo']), async (req, res) => {
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

    const emails = await NotificationService.getComplianceNotificationEmails(['admin', 'cfo', 'ceo']);
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
