// ============================================================================
// VILAGIO ERP — QMS ROUTES (PHASE 1 & 2 MERGED)
// ============================================================================

const express = require('express');
const router = express.Router();
const multer = require('multer');
const qmsService = require('../services/qms-service');
const { authenticate, authorize } = require('../middleware/auth-middleware');

// File upload middleware (memory storage — service writes to disk)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB max
  fileFilter: (req, file, cb) => {
    const allowed = [
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',       // .xlsx
      'application/msword',        // .doc
      'application/vnd.ms-excel',  // .xls
      'application/pdf',           // .pdf
    ];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only Word, Excel, and PDF files are accepted for QMS document uploads.'));
    }
  }
});

// All QMS routes require authentication
router.use(authenticate);

// ── Schema helpers ────────────────────────────────────────────────────────────

// Returns the section schema and default content_strategy for a given doc type
// Used by the frontend editor to know which mode and which sections to render
router.get('/schema/:doc_type', (req, res) => {
  const { doc_type } = req.params;
  res.json({
    doc_type,
    content_strategy: qmsService.getDefaultStrategy(doc_type),
    sections: qmsService.getSectionSchema(doc_type),
  });
});

// Active users list (for reviewer assignment dropdown)
router.get('/users', async (req, res) => {
  try {
    const users = await qmsService.listUsers();
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── Dashboard & lists ─────────────────────────────────────────────────────────

router.get('/stats', async (req, res) => {
  try {
    res.json(await qmsService.getCompletionStats());
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve QMS statistics' });
  }
});

router.get('/documents', async (req, res) => {
  try {
    const filters = { section_id: req.query.section_id, status: req.query.status };
    res.json(await qmsService.listDocuments(filters));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── Auto-sequencer (MUST be before /documents/:id) ───────────────────────────

router.get('/documents/next-code',
  authorize(['admin', 'manager', 'qa', 'ceo', 'cfo', 'engineering']),
  async (req, res) => {
    try {
      const { section_id, doc_type } = req.query;
      if (!section_id || !doc_type) {
        return res.status(400).json({ error: 'section_id and doc_type are required.' });
      }
      res.json(await qmsService.getNextDocumentCode(section_id, doc_type));
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);

// ── Document CRUD ─────────────────────────────────────────────────────────────

router.get('/documents/:id', async (req, res) => {
  try {
    res.json(await qmsService.getDocumentById(req.params.id));
  } catch (error) {
    res.status(404).json({ error: error.message });
  }
});

router.post('/documents', async (req, res) => {
  try {
    const result = await qmsService.createDocument(req.body, req.user.user_id);
    res.status(201).json(result);
  } catch (error) {
    if (error.code === '23505') return res.status(400).json({ error: 'A document with this code already exists.' });
    res.status(500).json({ error: error.message });
  }
});

router.put('/documents/:id',
  authorize(['admin', 'manager', 'qa', 'ceo', 'cfo']),
  async (req, res) => {
    try {
      const result = await qmsService.updateDocumentMetadata(req.params.id, req.body, req.user.user_id);
      res.json(result);
    } catch (error) {
      if (error.code === '23505') return res.status(400).json({ error: 'A document with this code already exists.' });
      res.status(500).json({ error: error.message });
    }
  }
);

// ── Withdrawal ────────────────────────────────────────────────────────────────

router.post('/documents/:id/withdraw',
  authorize(['admin', 'qa', 'manager', 'ceo']),
  async (req, res) => {
    try {
      const { signature_password, withdraw_reason } = req.body;
      if (!signature_password) return res.status(400).json({ error: 'Digital signature password is required.' });
      if (!withdraw_reason)    return res.status(400).json({ error: 'A withdrawal reason is required.' });
      const ip = req.ip || req.headers['x-forwarded-for'];
      res.json(await qmsService.withdrawDocument(req.params.id, req.user.user_id, signature_password, withdraw_reason, ip));
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }
);

// ── Audit trail ───────────────────────────────────────────────────────────────

router.get('/documents/:id/audit-trail', async (req, res) => {
  try {
    res.json(await qmsService.getAuditTrail(req.params.id));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── Document links ────────────────────────────────────────────────────────────

router.post('/document-links', async (req, res) => {
  try {
    const { parent_doc_id, child_doc_id, relationship } = req.body;
    if (!parent_doc_id || !child_doc_id || !relationship) {
      return res.status(400).json({ error: 'parent_doc_id, child_doc_id, and relationship are required.' });
    }
    const result = await qmsService.addDocumentLink(parent_doc_id, child_doc_id, relationship, req.user.user_id);
    res.status(201).json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.delete('/document-links/:linkId', authorize(['admin', 'qa', 'manager']), async (req, res) => {
  try {
    res.json(await qmsService.removeDocumentLink(req.params.linkId));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── Version lifecycle ─────────────────────────────────────────────────────────

// Create draft — now accepts change_reason in body
router.post('/documents/:id/draft', async (req, res) => {
  try {
    const { change_reason } = req.body;
    const result = await qmsService.createDraft(req.params.id, req.user.user_id, change_reason);
    res.status(201).json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Save draft content (autosave)
router.put('/versions/:versionId', async (req, res) => {
  try {
    const result = await qmsService.updateDraft(req.params.versionId, req.body.content_data, req.user.user_id);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Upload file to draft version
router.post('/versions/:versionId/file', upload.single('document_file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });
    const result = await qmsService.uploadVersionFile(
      req.params.versionId,
      req.file.buffer,
      req.file.originalname,
      req.user.user_id
    );
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Download file from any version
router.get('/versions/:versionId/file', async (req, res) => {
  try {
    const { filePath, originalName } = await qmsService.getVersionFile(req.params.versionId);
    res.setHeader('Content-Disposition', `attachment; filename="${originalName}"`);
    res.sendFile(filePath);
  } catch (error) {
    res.status(404).json({ error: error.message });
  }
});

// Submit for review — now accepts reviewer_id in body
router.post('/versions/:versionId/submit', async (req, res) => {
  try {
    const { reviewer_id } = req.body;
    const result = await qmsService.submitForReview(req.params.versionId, reviewer_id || null, req.user.user_id);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Approve & release — passes IP for audit trail
router.post('/versions/:versionId/approve',
  authorize(['admin', 'qa', 'manager', 'ceo', 'cfo']),
  // Note: engineering, sales, staff, operator, super_viewer, viewer
  // cannot approve/release documents — this is intentional.
  async (req, res) => {
    try {
      const { signature_password } = req.body;
      if (!signature_password) {
        return res.status(400).json({ error: 'Digital signature is required per 21 CFR Part 11.' });
      }
      const ip = req.ip || req.headers['x-forwarded-for'];
      res.json(await qmsService.releaseDocument(req.params.versionId, req.user.user_id, signature_password, ip));
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }
);

// ── NCR & CAPA ───────────────────────────────────────────────────────────────

router.get('/ncrs', async (req, res) => {
  try { res.json(await qmsService.listNCRs({ status: req.query.status })); }
  catch (error) { res.status(500).json({ error: error.message }); }
});

router.post('/ncrs', async (req, res) => {
  try {
    res.status(201).json(await qmsService.createNCR(req.body, req.user.user_id, req.body.signature_password));
  } catch (error) { res.status(400).json({ error: error.message }); }
});

router.put('/ncrs/:id', async (req, res) => {
  try {
    res.json(await qmsService.updateNCR(req.params.id, req.body, req.user.user_id, req.body.signature_password));
  } catch (error) { res.status(400).json({ error: error.message }); }
});

router.get('/capas', async (req, res) => {
  try { res.json(await qmsService.listCAPAs({ status: req.query.status })); }
  catch (error) { res.status(500).json({ error: error.message }); }
});

router.post('/capas', async (req, res) => {
  try {
    res.status(201).json(await qmsService.createCAPA(req.body, req.user.user_id, req.body.signature_password));
  } catch (error) { res.status(400).json({ error: error.message }); }
});

router.put('/capas/:id', async (req, res) => {
  try {
    res.json(await qmsService.updateCAPA(req.params.id, req.body, req.user.user_id, req.body.signature_password));
  } catch (error) { res.status(400).json({ error: error.message }); }
});

// ── Audits ────────────────────────────────────────────────────────────────────

router.get('/audits', async (req, res) => {
  try { res.json(await qmsService.listAudits()); }
  catch (error) { res.status(500).json({ error: error.message }); }
});

router.post('/audits', async (req, res) => {
  try { res.status(201).json(await qmsService.createAudit(req.body)); }
  catch (error) { res.status(400).json({ error: error.message }); }
});

router.put('/audits/:id', async (req, res) => {
  try {
    res.json(await qmsService.updateAudit(req.params.id, req.body, req.user.user_id, req.body.signature_password));
  } catch (error) { res.status(400).json({ error: error.message }); }
});

// ── Training ─────────────────────────────────────────────────────────────────

router.get('/training', async (req, res) => {
  try { res.json(await qmsService.getTrainingMatrix()); }
  catch (error) { res.status(500).json({ error: error.message }); }
});

router.post('/training/acknowledge', async (req, res) => {
  try {
    const { doc_id, signature_password } = req.body;
    res.json(await qmsService.acknowledgeDocument(req.user.user_id, doc_id, signature_password));
  } catch (error) { res.status(400).json({ error: error.message }); }
});

// ── Sections ─────────────────────────────────────────────────────────────────

router.get('/sections', async (req, res) => {
  try { res.json(await qmsService.listSections()); }
  catch (error) { res.status(500).json({ error: error.message }); }
});

// ============================================================================
// PHASE 2 ROUTES (NEW)
// ============================================================================

// GET /qms/my-tasks
// All open tasks for the authenticated user (any role can have tasks)
router.get('/my-tasks', async (req, res) => {
  try {
    res.json(await qmsService.getMyTasks(req.user.user_id));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /qms/dashboard-summary
// Aggregated counts for the QMS dashboard hero panel (any authenticated user)
router.get('/dashboard-summary', async (req, res) => {
  try {
    res.json(await qmsService.getDashboardSummary());
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /qms/review-tasks
// Periodic review task list — QA/admin/manager oversight view
router.get('/review-tasks',
  authorize(['admin', 'qa', 'manager', 'ceo', 'cfo']),
  async (req, res) => {
    try {
      res.json(await qmsService.listReviewTasks({ status: req.query.status || 'OPEN' }));
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);

// POST /qms/review-tasks/:taskId/dismiss
// Doc owner or QA/admin can dismiss (document confirmed valid, no revision needed)
router.post('/review-tasks/:taskId/dismiss',
  authorize(['admin', 'qa', 'manager', 'ceo', 'cfo', 'engineering']),
  async (req, res) => {
    try {
      res.json(await qmsService.dismissReviewTask(req.params.taskId, req.user.user_id));
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }
);

module.exports = router;