// ============================================================================
// VILAGIO ERP - QMS ROUTES (PHASE 1)
// ============================================================================

const express = require('express');
const router = express.Router();
const qmsService = require('../services/qms-service');
const { authenticate, authorize } = require('../middleware/auth-middleware');

// All QMS routes require authentication
router.use(authenticate);

// 1. Get Dashboard Completion Stats (X of 121)
router.get('/stats', async (req, res) => {
  try {
    const stats = await qmsService.getCompletionStats();
    res.json(stats);
  } catch (error) {
    console.error('QMS Stats Error:', error);
    res.status(500).json({ error: 'Failed to retrieve QMS statistics' });
  }
});

// 2. List all documents (Master Register)
router.get('/documents', async (req, res) => {
  try {
    const filters = {
      section_id: req.query.section_id,
      status: req.query.status
    };
    const docs = await qmsService.listDocuments(filters);
    res.json(docs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 3. Get specific document details and version history
router.get('/documents/:id', async (req, res) => {
  try {
    const doc = await qmsService.getDocumentById(req.params.id);
    res.json(doc);
  } catch (error) {
    res.status(404).json({ error: error.message });
  }
});

// 4. Create a Draft
// Any authenticated user can potentially draft a document (controlled by frontend UI)
router.post('/documents/:id/draft', async (req, res) => {
  try {
    const result = await qmsService.createDraft(req.params.id, req.user.user_id);
    res.status(201).json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// 5. Update Draft Content (Autosave functionality)
router.put('/versions/:versionId', async (req, res) => {
  try {
    const { content_data } = req.body;
    const result = await qmsService.updateDraft(req.params.versionId, content_data, req.user.user_id);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// 6. Submit for Review
router.post('/versions/:versionId/submit', async (req, res) => {
  try {
    const result = await qmsService.submitForReview(req.params.versionId);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// 7. Approve & Release Document (The Gatekeeper)
// Strict Authorization: Only QA, Managers, or Admins can approve documents
router.post('/versions/:versionId/approve', authorize(['admin', 'qa', 'manager', 'ceo']), async (req, res) => {
  try {
    const { signature_password } = req.body;
    
    if (!signature_password) {
      return res.status(400).json({ error: 'Digital signature (password) is required to release documents per 21 CFR Part 11.' });
    }

    const result = await qmsService.releaseDocument(req.params.versionId, req.user.user_id, signature_password);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// ============================================================================
// PHASE 2: NCR & CAPA ROUTES
// ============================================================================

// --- NCR Routes ---
router.get('/ncrs', async (req, res) => {
  try {
    const filters = { status: req.query.status };
    const ncrs = await qmsService.listNCRs(filters);
    res.json(ncrs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/ncrs', async (req, res) => {
  try {
    const result = await qmsService.createNCR(req.body, req.user.user_id, req.body.signature_password);
    res.status(201).json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.put('/ncrs/:id', async (req, res) => {
  try {
    const result = await qmsService.updateNCR(req.params.id, req.body, req.user.user_id, req.body.signature_password);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// --- CAPA Routes ---
router.get('/capas', async (req, res) => {
  try {
    const filters = { status: req.query.status };
    const capas = await qmsService.listCAPAs(filters);
    res.json(capas);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/capas', async (req, res) => {
  try {
    const result = await qmsService.createCAPA(req.body, req.user.user_id, req.body.signature_password);
    res.status(201).json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.put('/capas/:id', async (req, res) => {
  try {
    const result = await qmsService.updateCAPA(req.params.id, req.body, req.user.user_id, req.body.signature_password);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});
// ============================================================================
// PHASE 3: AUDIT ROUTES
// ============================================================================

router.get('/audits', async (req, res) => {
  try {
    const audits = await qmsService.listAudits();
    res.json(audits);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/audits', async (req, res) => {
  try {
    const result = await qmsService.createAudit(req.body);
    res.status(201).json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.put('/audits/:id', async (req, res) => {
  try {
    const result = await qmsService.updateAudit(req.params.id, req.body, req.user.user_id, req.body.signature_password);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});
// ============================================================================
// PHASE 3: TRAINING MATRIX ROUTES
// ============================================================================

router.get('/training', async (req, res) => {
  try {
    const matrix = await qmsService.getTrainingMatrix();
    res.json(matrix);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/training/acknowledge', async (req, res) => {
  try {
    const { doc_id, signature_password } = req.body;
    const result = await qmsService.acknowledgeDocument(req.user.user_id, doc_id, signature_password);
    res.status(200).json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});
router.post('/documents', async (req, res) => {
  try {
    const result = await qmsService.createDocument(req.body, req.user.user_id);
    res.status(201).json(result);
  } catch (error) {
    if (error.code === '23505') { // Postgres Unique Violation
      return res.status(400).json({ error: 'A document with this code already exists.' });
    }
    res.status(500).json({ error: error.message });
  }
});

// Also make sure you have a route to fetch sections for the dropdown:
router.get('/sections', async (req, res) => {
  try {
    const sections = await qmsService.listSections();
    res.json(sections);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
module.exports = router;