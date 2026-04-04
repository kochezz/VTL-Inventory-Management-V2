// ============================================================================
// LAB ROUTES — QC Water Testing Module
// backend/src/routes/lab-routes.js
// ============================================================================

const express = require('express');
const router  = express.Router();
const { authenticate, authorize } = require('../middleware/auth-middleware');
const labService  = require('../services/lab-service');
const labPdfService = require('../services/lab-pdf-service');

router.use(authenticate);

// ── Parameter Specs ───────────────────────────────────────────────────────────

router.get('/specs', async (req, res) => {
  try {
    const specs = await labService.getParameterSpecs();
    res.json({ specs });
  } catch (err) {
    console.error('GET /lab/specs error:', err);
    res.status(500).json({ error: 'Failed to fetch parameter specs' });
  }
});

router.put('/specs/:code', authorize(['admin', 'manager']), async (req, res) => {
  try {
    const specs = await labService.updateParameterSpec(
      req.params.code, req.body, req.user.user_id
    );
    res.json({ specs, message: 'Specification updated successfully' });
  } catch (err) {
    console.error('PUT /lab/specs error:', err);
    res.status(500).json({ error: 'Failed to update specification' });
  }
});

// ── Dashboard Stats ───────────────────────────────────────────────────────────

router.get('/stats', async (req, res) => {
  try {
    const stats = await labService.getLabDashboardStats();
    res.json({ stats });
  } catch (err) {
    console.error('GET /lab/stats error:', err);
    res.status(500).json({ error: 'Failed to fetch lab stats' });
  }
});

// ── Today's Valid Certificates — Gate 1 integration ──────────────────────────
// NOTE: Must be before /tests/:id to avoid route conflict

router.get('/tests/today/valid', async (req, res) => {
  try {
    const certificates = await labService.getTodaysValidCertificates();
    res.json({ certificates });
  } catch (err) {
    console.error('GET /lab/tests/today/valid error:', err);
    res.status(500).json({ error: 'Failed to fetch valid certificates' });
  }
});

// ── Test CRUD ─────────────────────────────────────────────────────────────────

router.get('/tests', async (req, res) => {
  try {
    const tests = await labService.listLabTests(req.query);
    res.json({ tests });
  } catch (err) {
    console.error('GET /lab/tests error:', err);
    res.status(500).json({ error: 'Failed to fetch lab tests' });
  }
});

router.post('/tests', authorize(['admin', 'manager', 'qa', 'staff', 'operator']), async (req, res) => {
  try {
    if (!req.body.parameters || req.body.parameters.length === 0) {
      return res.status(400).json({ error: 'At least one parameter reading is required' });
    }
    const test = await labService.createLabTest(req.body, req.user.user_id);
    res.status(201).json({ test, message: 'Lab test created successfully' });
  } catch (err) {
    console.error('POST /lab/tests error:', err);
    res.status(500).json({ error: err.message || 'Failed to create lab test' });
  }
});

router.get('/tests/:id', async (req, res) => {
  try {
    const test = await labService.getLabTestById(req.params.id);
    if (!test) return res.status(404).json({ error: 'Lab test not found' });
    res.json({ test });
  } catch (err) {
    console.error('GET /lab/tests/:id error:', err);
    res.status(500).json({ error: 'Failed to fetch lab test' });
  }
});

// ── Stage 1: Analyst submits results ─────────────────────────────────────────
// Any authenticated lab user can submit their own test

router.post('/tests/:id/submit', authorize(['admin', 'manager', 'qa', 'staff', 'operator']), async (req, res) => {
  try {
    const { signature_verified } = req.body;
    if (!signature_verified) {
      return res.status(400).json({ error: 'Digital signature verification is required' });
    }
    const test = await labService.submitLabTest(req.params.id, req.user.user_id, true);
    res.json({ test, message: 'Results submitted. Awaiting QA review.' });
  } catch (err) {
    console.error('POST /lab/tests/:id/submit error:', err);
    res.status(400).json({ error: err.message || 'Failed to submit lab test' });
  }
});

// ── Stage 2: QA Review & Sign-off ────────────────────────────────────────────
// Only QA, admin, and managers can release results
// This is the single authority gate — no supervisor/manager split

router.post('/tests/:id/qa-review', authorize(['admin', 'manager', 'qa']), async (req, res) => {
  try {
    const { action, comments, deviation_note, signature_verified } = req.body;
    if (!action) {
      return res.status(400).json({ error: 'Action is required: approve / reject / conditional' });
    }
    if (!signature_verified) {
      return res.status(400).json({ error: 'Digital signature verification is required' });
    }
    const test = await labService.qaReview(
      req.params.id, req.user.user_id,
      action, comments, deviation_note, true
    );
    const msg = action === 'reject'
      ? 'Test rejected. Re-test required.'
      : `Certificate ${test.certificate_number} issued successfully.`;
    res.json({ test, message: msg });
  } catch (err) {
    console.error('POST /lab/tests/:id/qa-review error:', err);
    res.status(400).json({ error: err.message || 'Failed to process QA review' });
  }
});

// ── CoA PDF Generation ────────────────────────────────────────────────────────
// Only available after QA has approved (status: pass or conditional_pass)

router.get('/tests/:id/certificate/pdf', async (req, res) => {
  try {
    const test = await labService.getLabTestById(req.params.id);
    if (!test) {
      return res.status(404).json({ error: 'Lab test not found' });
    }
    if (!['pass', 'conditional_pass'].includes(test.overall_status)) {
      return res.status(400).json({
        error: 'Certificate can only be generated for QA-approved tests'
      });
    }

    // __dirname = src/routes/ — go up 3 levels to project root, then into public/
    // This matches the path structure used by production-reporting-service.js
    const path = require('path');
    const logoPath = path.join(__dirname, '../../../public/logo-black.png');
    const pdfBuffer = await labPdfService.generateCoAPDF(test, logoPath);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="CoA_${test.certificate_number || test.test_number}.pdf"`
    );
    res.send(pdfBuffer);
  } catch (err) {
    console.error('GET /lab/tests/:id/certificate/pdf error:', err);
    res.status(500).json({ error: 'Failed to generate certificate PDF' });
  }
});

module.exports = router;
