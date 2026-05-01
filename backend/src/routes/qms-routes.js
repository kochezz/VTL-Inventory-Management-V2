// ============================================================================
// VILAGIO ERP — QMS ROUTES (PHASES 1 - 5 MERGED COMPLETE FILE)
// ============================================================================

const express = require('express');
const router  = express.Router();
const multer  = require('multer');
const qmsService = require('../services/qms-service');
const pdfService = require('../services/qms-pdf-service'); 
const templateService = require('../services/qms-template-service'); // Phase 5
const { pool } = require('../config/database'); // Required for Phase 5 assembled route
const { authenticate, authorize } = require('../middleware/auth-middleware');

// File upload middleware (memory storage — service writes to disk/S3)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = [
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/msword',
      'application/vnd.ms-excel',
      'application/pdf',
    ];
    allowed.includes(file.mimetype)
      ? cb(null, true)
      : cb(new Error('Only Word, Excel, and PDF files are accepted.'));
  }
});

// ── All routes below require authentication EXCEPT the public inspector routes ──
// Public routes are defined first, before router.use(authenticate)

// ============================================================================
// PUBLIC — External auditor inspector view (token-gated, no login required)
// ============================================================================

router.get('/inspect/:token', async (req, res) => {
  try {
    const tokenRecord = await qmsService.resolveShareToken(req.params.token);
    if (!tokenRecord) {
      return res.status(404).json({
        error: 'This link is invalid, has expired, or has been revoked.',
        expired: true
      });
    }
    const pack = await qmsService.getInspectorPack(tokenRecord.doc_id);
    // Attach token metadata so the UI can show expiry info
    pack.share_token_info = {
      expires_at:    tokenRecord.expires_at,
      access_count:  tokenRecord.access_count,
      recipient_note: tokenRecord.recipient_note,
    };
    res.json(pack);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── 4A — Public token-gated PDF download ──────────────────────────────────────
router.get('/inspect/:token/pdf', async (req, res) => {
  try {
    const tokenRecord = await qmsService.resolveShareToken(req.params.token);
    if (!tokenRecord) {
      return res.status(404).json({ error: 'Link is invalid, expired, or revoked.' });
    }
    const mode = req.query.mode === 'full' ? 'full' : 'current';
    await pdfService.generateAuditPack(tokenRecord.doc_id, mode, res);
  } catch (e) {
    if (!res.headersSent) {
      res.status(500).json({ error: e.message });
    }
  }
});

// ── All routes below this line require authentication ──────────────────────
router.use(authenticate);

// ============================================================================
// SCHEMA HELPERS (Updated in Phase 5)
// ============================================================================

router.get('/schema/:doc_type', (req, res) => {
  const { doc_type } = req.params;
  const defaultStrategy = qmsService.getDefaultStrategy(doc_type);
  const isStructuredType = ['SOP', 'POL', 'MAN'].includes(doc_type);

  res.json({
    doc_type,
    content_strategy: defaultStrategy,
    sections: qmsService.getSectionSchema(doc_type),
    authoring_options: isStructuredType
      ? [
          { value: 'structured',    label: 'Structured editor',      description: 'Fill in sections directly in the ERP using the built-in text editor' },
          { value: 'word_template', label: 'Word template (offline)', description: 'Download a pre-populated Word template, author in Microsoft Word, then upload the completed file' },
        ]
      : [
          { value: 'upload', label: 'File upload', description: 'Design the template in Word or Excel and upload it' },
        ],
    template_available: isStructuredType,
  });
});

router.get('/users', async (req, res) => {
  try { res.json(await qmsService.listUsers()); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// ============================================================================
// DASHBOARD & STATS
// ============================================================================

router.get('/stats', async (req, res) => {
  try { res.json(await qmsService.getCompletionStats()); }
  catch (e) { res.status(500).json({ error: 'Failed to retrieve QMS statistics' }); }
});

router.get('/dashboard-summary', async (req, res) => {
  try { res.json(await qmsService.getDashboardSummary()); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/my-tasks', async (req, res) => {
  try { res.json(await qmsService.getMyTasks(req.user.user_id)); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// ── 4B — Compliance dashboard (single combined endpoint) ─────────────────────
router.get('/compliance',
  authorize(['admin', 'qa', 'manager', 'ceo', 'cfo']),
  async (req, res) => {
    try {
      res.json(await qmsService.getComplianceDashboard());
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  }
);

// ── 4C — Review calendar ─────────────────────────────────────────────────────
router.get('/review-calendar', async (req, res) => {
  try {
    res.json(await qmsService.getReviewCalendar());
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ============================================================================
// DOCUMENT HIERARCHY (3C)
// ============================================================================

router.get('/hierarchy', async (req, res) => {
  try {
    res.json(await qmsService.getDocumentHierarchy(req.query.section_id || null));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/documents/:id/lineage', async (req, res) => {
  try { res.json(await qmsService.getDocumentLineage(req.params.id)); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// ============================================================================
// DOCUMENT LIST & AUTO-SEQUENCER
// ============================================================================

router.get('/documents', async (req, res) => {
  try {
    res.json(await qmsService.listDocuments({
      section_id: req.query.section_id,
      status:     req.query.status
    }));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// MUST be before /documents/:id
router.get('/documents/next-code',
  authorize(['admin', 'manager', 'qa', 'ceo', 'cfo', 'engineering']),
  async (req, res) => {
    try {
      const { section_id, doc_type } = req.query;
      if (!section_id || !doc_type)
        return res.status(400).json({ error: 'section_id and doc_type are required.' });
      res.json(await qmsService.getNextDocumentCode(section_id, doc_type));
    } catch (e) { res.status(500).json({ error: e.message }); }
  }
);

// ============================================================================
// DOCUMENT DETAIL & CRUD
// ============================================================================

router.get('/documents/:id', async (req, res) => {
  try { res.json(await qmsService.getDocumentById(req.params.id)); }
  catch (e) { res.status(404).json({ error: e.message }); }
});

router.post('/documents', async (req, res) => {
  try {
    res.status(201).json(await qmsService.createDocument(req.body, req.user.user_id));
  } catch (e) {
    if (e.code === '23505') return res.status(400).json({ error: 'A document with this code already exists.' });
    res.status(500).json({ error: e.message });
  }
});

router.put('/documents/:id',
  authorize(['admin', 'manager', 'qa', 'ceo', 'cfo']),
  async (req, res) => {
    try {
      res.json(await qmsService.updateDocumentMetadata(req.params.id, req.body, req.user.user_id));
    } catch (e) {
      if (e.code === '23505') return res.status(400).json({ error: 'A document with this code already exists.' });
      res.status(500).json({ error: e.message });
    }
  }
);

// ── Withdrawal ────────────────────────────────────────────────────────────────

router.post('/documents/:id/withdraw',
  authorize(['admin', 'qa', 'manager', 'ceo', 'cfo']),
  async (req, res) => {
    try {
      const { signature_password, withdraw_reason } = req.body;
      if (!signature_password) return res.status(400).json({ error: 'Digital signature is required.' });
      if (!withdraw_reason)    return res.status(400).json({ error: 'Withdrawal reason is required.' });
      const ip = req.ip || req.headers['x-forwarded-for'];
      res.json(await qmsService.withdrawDocument(req.params.id, req.user.user_id, signature_password, withdraw_reason, ip));
    } catch (e) { res.status(400).json({ error: e.message }); }
  }
);

// ── Audit trail (internal) ────────────────────────────────────────────────────

router.get('/documents/:id/audit-trail', async (req, res) => {
  try { res.json(await qmsService.getAuditTrail(req.params.id)); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Inspector view (internal — authenticated) ─────────────────────────────────

router.get('/documents/:id/inspector',
  authorize(['admin', 'qa', 'manager', 'ceo', 'cfo']),
  async (req, res) => {
    try { res.json(await qmsService.getInspectorPack(req.params.id)); }
    catch (e) { res.status(500).json({ error: e.message }); }
  }
);

// ── 4A — PDF audit pack download (internal) ───────────────────────────────────
router.get('/documents/:id/pdf',
  authorize(['admin', 'qa', 'manager', 'ceo', 'cfo']),
  async (req, res) => {
    try {
      const mode = req.query.mode === 'full' ? 'full' : 'current';
      await pdfService.generateAuditPack(req.params.id, mode, res);
    } catch (e) {
      // If headers not yet sent, return JSON error
      if (!res.headersSent) {
        res.status(500).json({ error: e.message });
      }
    }
  }
);

// ── Share tokens ──────────────────────────────────────────────────────────────

router.get('/documents/:id/share-token',
  authorize(['admin', 'qa', 'manager', 'ceo', 'cfo']),
  async (req, res) => {
    try { res.json(await qmsService.getActiveShareToken(req.params.id)); }
    catch (e) { res.status(500).json({ error: e.message }); }
  }
);

router.post('/documents/:id/share-token',
  authorize(['admin', 'qa', 'manager', 'ceo', 'cfo']),
  async (req, res) => {
    try {
      const { expiry_days = 30, recipient_note = '' } = req.body;
      const result = await qmsService.createShareToken(
        req.params.id, req.user.user_id, expiry_days, recipient_note
      );
      res.status(201).json(result);
    } catch (e) { res.status(400).json({ error: e.message }); }
  }
);

router.delete('/documents/:id/share-token',
  authorize(['admin', 'qa', 'manager', 'ceo', 'cfo']),
  async (req, res) => {
    try { res.json(await qmsService.revokeShareToken(req.params.id, req.user.user_id)); }
    catch (e) { res.status(500).json({ error: e.message }); }
  }
);

// ── Traceability (3A) ─────────────────────────────────────────────────────────

router.get('/documents/:id/traceability', async (req, res) => {
  try { res.json(await qmsService.getDocumentTraceability(req.params.id)); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// ============================================================================
// DOCUMENT LINKS
// ============================================================================

router.post('/document-links', async (req, res) => {
  try {
    const { parent_doc_id, child_doc_id, relationship } = req.body;
    if (!parent_doc_id || !child_doc_id || !relationship)
      return res.status(400).json({ error: 'parent_doc_id, child_doc_id, and relationship are required.' });
    res.status(201).json(await qmsService.addDocumentLink(parent_doc_id, child_doc_id, relationship, req.user.user_id));
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.delete('/document-links/:linkId',
  authorize(['admin', 'qa', 'manager']),
  async (req, res) => {
    try { res.json(await qmsService.removeDocumentLink(req.params.linkId)); }
    catch (e) { res.status(500).json({ error: e.message }); }
  }
);

// ============================================================================
// VERSION LIFECYCLE 
// ============================================================================

router.post('/documents/:id/draft', async (req, res) => {
  try {
    const { change_reason, authoring_choice } = req.body;
    res.status(201).json(await qmsService.createDraft(req.params.id, req.user.user_id, change_reason, authoring_choice));
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.put('/versions/:versionId', async (req, res) => {
  try {
    res.json(await qmsService.updateDraft(req.params.versionId, req.body.content_data, req.user.user_id));
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// ── Phase 5: Template Generation & Assembled Document Downloads ───────────────

router.get('/versions/:versionId/template', async (req, res) => {
  try {
    const verRes = await qmsService.getVersionForTemplate(req.params.versionId, req.user.user_id);
    await templateService.generateBlankTemplate(
      verRes.doc_id,
      req.params.versionId,
      req.user.user_id,
      res
    );
  } catch (e) {
    if (!res.headersSent) res.status(400).json({ error: e.message });
  }
});

router.get('/documents/:id/assembled',
  authorize(['admin', 'qa', 'manager', 'ceo', 'cfo']),
  async (req, res) => {
    try {
      const doc = await qmsService.getDocumentById(req.params.id);

      // If a released version exists, serve that (normal post-release path)
      let versionId = doc.current_version_id;

      // If no released version yet (DRAFT or REVIEW), fall back to the most
      // recent version so QA reviewers can download the draft for review
      if (!versionId) {
        const latestRes = await pool.query(
          `SELECT version_id
             FROM qms_document_versions
            WHERE doc_id = $1
            ORDER BY created_at DESC
            LIMIT 1`,
          [req.params.id]
        );
        if (!latestRes.rows.length) {
          return res.status(404).json({ error: 'No version found for this document.' });
        }
        versionId = latestRes.rows[0].version_id;
      }

      await templateService.streamAssembledDocument(req.params.id, versionId, res);
    } catch (e) {
      if (!res.headersSent) res.status(500).json({ error: e.message });
    }
  }
);

router.get('/versions/:versionId/assembled',
  authorize(['admin', 'qa', 'manager', 'ceo', 'cfo']),
  async (req, res) => {
    try {
      const verRes = await pool.query('SELECT doc_id FROM qms_document_versions WHERE version_id = $1', [req.params.versionId]);
      if (!verRes.rows.length) return res.status(404).json({ error: 'Version not found' });
      await templateService.streamAssembledDocument(verRes.rows[0].doc_id, req.params.versionId, res);
    } catch (e) {
      if (!res.headersSent) res.status(500).json({ error: e.message });
    }
  }
);

// File upload
router.post('/versions/:versionId/file', upload.single('document_file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });
    res.json(await qmsService.uploadVersionFile(
      req.params.versionId, req.file.buffer, req.file.originalname, req.user.user_id
    ));
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.get('/versions/:versionId/file', async (req, res) => {
  try {
    const { fileBuffer, originalName } = await qmsService.getVersionFile(req.params.versionId);
    res.setHeader('Content-Disposition', `attachment; filename="${originalName}"`);
    res.setHeader('Content-Type', 'application/octet-stream');
    res.send(fileBuffer); // Send buffer directly instead of using res.sendFile()
  } catch (e) { 
    res.status(404).json({ error: e.message }); 
  }
});

// NCR/CAPA traceability links on a draft version (3A)
router.post('/versions/:versionId/link-ncr', async (req, res) => {
  try {
    const { ncr_id } = req.body;
    if (!ncr_id) return res.status(400).json({ error: 'ncr_id is required.' });
    res.json(await qmsService.linkVersionToNCR(req.params.versionId, ncr_id, req.user.user_id));
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.post('/versions/:versionId/link-capa', async (req, res) => {
  try {
    const { capa_id } = req.body;
    if (!capa_id) return res.status(400).json({ error: 'capa_id is required.' });
    res.json(await qmsService.linkVersionToCAPA(req.params.versionId, capa_id, req.user.user_id));
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.post('/versions/:versionId/submit', async (req, res) => {
  try {
    // Guard: word_template documents must have an uploaded file before review
    const verCheck = await pool.query(
      `SELECT content_strategy, file_original_name FROM qms_document_versions WHERE version_id = $1`,
      [req.params.versionId]
    );
    // Note: We now check file_original_name instead of file_path
    if (verCheck.rows.length && verCheck.rows[0].content_strategy === 'word_template' && !verCheck.rows[0].file_original_name) {
      return res.status(400).json({
        error: 'Cannot submit for review: no completed document has been uploaded yet. Download the template, author the document in Word, then upload the completed file before submitting.'
      });
    }
    const { reviewer_id } = req.body;
    res.json(await qmsService.submitForReview(req.params.versionId, reviewer_id || null, req.user.user_id));
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.post('/versions/:versionId/recall', async (req, res) => {
  try {
    res.json(await qmsService.recallDraft(req.params.versionId, req.user.user_id));
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.post('/versions/:versionId/reject',
  authorize(['admin', 'qa', 'manager', 'ceo', 'cfo']),
  async (req, res) => {
    try {
      const { reason } = req.body;
      if (!reason) return res.status(400).json({ error: 'Rejection reason is required.' });
      res.json(await qmsService.rejectReview(req.params.versionId, req.user.user_id, reason));
    } catch (e) { res.status(400).json({ error: e.message }); }
  }
);

router.post('/versions/:versionId/sign-off',
  authorize(['admin', 'qa']),
  async (req, res) => {
    try {
      const { signature_password } = req.body;
      if (!signature_password) return res.status(400).json({ error: 'Digital signature is required.' });
      const ip = req.ip || req.headers['x-forwarded-for'];
      res.json(await qmsService.signOffReview(req.params.versionId, req.user.user_id, signature_password, ip));
    } catch (e) { res.status(400).json({ error: e.message }); }
  }
);

router.post('/versions/:versionId/approve',
  authorize(['admin', 'qa', 'manager', 'ceo', 'cfo']),
  async (req, res) => {
    try {
      const { signature_password } = req.body;
      if (!signature_password)
        return res.status(400).json({ error: 'Digital signature is required per 21 CFR Part 11.' });
      const ip = req.ip || req.headers['x-forwarded-for'];
      res.json(await qmsService.releaseDocument(req.params.versionId, req.user.user_id, signature_password, ip));
    } catch (e) { res.status(400).json({ error: e.message }); }
  }
);

// ============================================================================
// NCR & CAPA
// ============================================================================

router.get('/ncrs', async (req, res) => {
  try { res.json(await qmsService.listNCRs({ status: req.query.status })); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// Open NCRs list for traceability dropdown (3A)
router.get('/ncrs/open', async (req, res) => {
  try { res.json(await qmsService.getOpenNCRs()); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/qms/ncrs/:id — full NCR detail for mobile app
router.get('/ncrs/:id', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT n.*, r.full_name AS raised_by_name, a.full_name AS assigned_to_name
       FROM qms_ncr n
       LEFT JOIN users r ON n.raised_by::uuid = r.user_id
       LEFT JOIN users a ON n.assigned_to::uuid = a.user_id
       WHERE n.ncr_id = $1`,
      [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'NCR not found' });
    res.json(result.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/ncrs/:id/document-impact', async (req, res) => {
  try { res.json(await qmsService.getNCRDocumentImpact(req.params.id)); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/ncrs', async (req, res) => {
  try {
    res.status(201).json(await qmsService.createNCR(req.body, req.user.user_id, req.body.signature_password));
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.put('/ncrs/:id', async (req, res) => {
  try {
    res.json(await qmsService.updateNCR(req.params.id, req.body, req.user.user_id, req.body.signature_password));
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.get('/capas', async (req, res) => {
  try { res.json(await qmsService.listCAPAs({ status: req.query.status })); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// Open CAPAs list for traceability dropdown (3A)
router.get('/capas/open', async (req, res) => {
  try { res.json(await qmsService.getOpenCAPAs()); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/capas', async (req, res) => {
  try {
    res.status(201).json(await qmsService.createCAPA(req.body, req.user.user_id, req.body.signature_password));
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.put('/capas/:id', async (req, res) => {
  try {
    res.json(await qmsService.updateCAPA(req.params.id, req.body, req.user.user_id, req.body.signature_password));
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// ============================================================================
// AUDITS
// ============================================================================

router.get('/audits', async (req, res) => {
  try { res.json(await qmsService.listAudits()); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/audits', async (req, res) => {
  try { res.status(201).json(await qmsService.createAudit(req.body)); }
  catch (e) { res.status(400).json({ error: e.message }); }
});

router.put('/audits/:id', async (req, res) => {
  try {
    res.json(await qmsService.updateAudit(req.params.id, req.body, req.user.user_id, req.body.signature_password));
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// ============================================================================
// TRAINING
// ============================================================================

router.get('/training', async (req, res) => {
  try { res.json(await qmsService.getTrainingMatrix()); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/training/acknowledge', async (req, res) => {
  try {
    const { doc_id, signature_password } = req.body;
    res.json(await qmsService.acknowledgeDocument(req.user.user_id, doc_id, signature_password));
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// ============================================================================
// REVIEW TASKS (Phase 2)
// ============================================================================

router.get('/review-tasks',
  authorize(['admin', 'qa', 'manager', 'ceo', 'cfo']),
  async (req, res) => {
    try { res.json(await qmsService.listReviewTasks({ status: req.query.status || 'OPEN' })); }
    catch (e) { res.status(500).json({ error: e.message }); }
  }
);

router.post('/review-tasks/:taskId/dismiss',
  authorize(['admin', 'qa', 'manager', 'ceo', 'cfo', 'engineering']),
  async (req, res) => {
    try { res.json(await qmsService.dismissReviewTask(req.params.taskId, req.user.user_id)); }
    catch (e) { res.status(400).json({ error: e.message }); }
  }
);

// ============================================================================
// SECTIONS
// ============================================================================

router.get('/sections', async (req, res) => {
  try { res.json(await qmsService.listSections()); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;