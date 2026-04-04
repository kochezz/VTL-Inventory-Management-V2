// ============================================================================
// LAB ROUTES — QC Water Testing Module
// backend/src/routes/lab-routes.js
// ============================================================================

const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth-middleware');
const labService = require('../services/lab-service');

// Apply JWT auth to all lab routes
router.use(authenticate);

// ── Parameter Specs ──────────────────────────────────────────────────────────

// GET /api/lab/specs  — all authenticated users
router.get('/specs', async (req, res) => {
  try {
    const specs = await labService.getParameterSpecs();
    res.json({ specs });
  } catch (err) {
    console.error('GET /lab/specs error:', err);
    res.status(500).json({ error: 'Failed to fetch parameter specs' });
  }
});

// PUT /api/lab/specs/:code  — managers only
router.put('/specs/:code', authorize(['admin', 'manager']), async (req, res) => {
  try {
    const specs = await labService.updateParameterSpec(
      req.params.code,
      req.body,
      req.user.user_id
    );
    res.json({ specs, message: 'Specification updated successfully' });
  } catch (err) {
    console.error('PUT /lab/specs error:', err);
    res.status(500).json({ error: 'Failed to update specification' });
  }
});

// ── Dashboard Stats ───────────────────────────────────────────────────────────

// GET /api/lab/stats
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
// NOTE: defined BEFORE /tests/:id to avoid route conflict

// GET /api/lab/tests/today/valid
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

// GET /api/lab/tests
router.get('/tests', async (req, res) => {
  try {
    const tests = await labService.listLabTests(req.query);
    res.json({ tests });
  } catch (err) {
    console.error('GET /lab/tests error:', err);
    res.status(500).json({ error: 'Failed to fetch lab tests' });
  }
});

// POST /api/lab/tests
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

// GET /api/lab/tests/:id
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

// ── Workflow Actions ──────────────────────────────────────────────────────────

// POST /api/lab/tests/:id/submit  — Stage 1: Analyst submits
router.post('/tests/:id/submit', authorize(['admin', 'manager', 'qa', 'staff', 'operator']), async (req, res) => {
  try {
    const { signature_verified } = req.body;
    if (!signature_verified) {
      return res.status(400).json({ error: 'Digital signature verification is required' });
    }
    const test = await labService.submitLabTest(req.params.id, req.user.user_id, true);
    res.json({ test, message: 'Test submitted for QA Supervisor review' });
  } catch (err) {
    console.error('POST /lab/tests/:id/submit error:', err);
    res.status(400).json({ error: err.message || 'Failed to submit lab test' });
  }
});

// POST /api/lab/tests/:id/supervisor-review  — Stage 2
router.post('/tests/:id/supervisor-review', authorize(['admin', 'manager', 'qa']), async (req, res) => {
  try {
    const { action, comments, deviation_note, signature_verified } = req.body;
    if (!action) return res.status(400).json({ error: 'Action is required: approve / reject / conditional' });
    if (!signature_verified) return res.status(400).json({ error: 'Digital signature verification is required' });

    const test = await labService.supervisorReview(
      req.params.id, req.user.user_id, action, comments, deviation_note, true
    );
    res.json({ test, message: `Test ${action}d by QA Supervisor` });
  } catch (err) {
    console.error('POST /lab/tests/:id/supervisor-review error:', err);
    res.status(400).json({ error: err.message || 'Failed to process supervisor review' });
  }
});

// POST /api/lab/tests/:id/manager-signoff  — Stage 3
router.post('/tests/:id/manager-signoff', authorize(['admin', 'manager']), async (req, res) => {
  try {
    const { action, comments, deviation_note, signature_verified } = req.body;
    if (!action) return res.status(400).json({ error: 'Action is required: approve / reject / conditional' });
    if (!signature_verified) return res.status(400).json({ error: 'Digital signature verification is required' });

    const test = await labService.managerSignoff(
      req.params.id, req.user.user_id, action, comments, deviation_note, true
    );
    res.json({ test, message: `Certificate ${action === 'reject' ? 'rejected' : 'issued'} by QA Manager` });
  } catch (err) {
    console.error('POST /lab/tests/:id/manager-signoff error:', err);
    res.status(400).json({ error: err.message || 'Failed to process manager sign-off' });
  }
});

module.exports = router;
