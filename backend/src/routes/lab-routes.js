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
// FIX: Added array brackets to authorize
router.put('/specs/:code', authorize(['admin', 'manager']), async (req, res) => {
  try {
    const updated = await labService.updateParameterSpec(req.params.code, req.body);
    res.json(updated);
  } catch (err) {
    console.error('PUT /lab/specs error:', err);
    res.status(400).json({ error: err.message || 'Failed to update spec' });
  }
});

// ── Lab Tests ────────────────────────────────────────────────────────────────

// GET /api/lab/stats — overview for the dashboard
router.get('/stats', async (req, res) => {
  try {
    const stats = await labService.getLabStats();
    res.json(stats);
  } catch (err) {
    console.error('GET /lab/stats error:', err);
    res.status(500).json({ error: 'Failed to fetch lab stats' });
  }
});

// GET /api/lab/tests/today/valid — specifically for production checks
router.get('/tests/today/valid', async (req, res) => {
  try {
    const isValid = await labService.hasValidTestToday();
    res.json({ valid_test_exists: isValid });
  } catch (err) {
    console.error('GET /lab/tests/today/valid error:', err);
    res.status(500).json({ error: 'Failed to check today\'s tests' });
  }
});

// GET /api/lab/tests — list tests with filters
router.get('/tests', async (req, res) => {
  try {
    const filters = req.query; // pass query params directly
    const tests = await labService.listTests(filters);
    res.json(tests);
  } catch (err) {
    console.error('GET /lab/tests error:', err);
    res.status(500).json({ error: 'Failed to list lab tests' });
  }
});

// POST /api/lab/tests — create a new draft test
// FIX: Added array brackets to authorize
router.post('/tests', authorize(['admin', 'manager', 'qa', 'staff', 'operator']), async (req, res) => {
  try {
    const userId = req.user.user_id;
    const test = await labService.createTest(req.body, userId);
    res.status(201).json(test);
  } catch (err) {
    console.error('POST /lab/tests error:', err);
    res.status(400).json({ error: err.message || 'Failed to create lab test' });
  }
});

// GET /api/lab/tests/:id — get a specific test with its results
router.get('/tests/:id', async (req, res) => {
  try {
    const test = await labService.getTestById(req.params.id);
    if (!test) return res.status(404).json({ error: 'Test not found' });
    res.json(test);
  } catch (err) {
    console.error('GET /lab/tests/:id error:', err);
    res.status(500).json({ error: 'Failed to fetch lab test details' });
  }
});

// POST /api/lab/tests/:id/submit — Analyst submits the draft
// FIX: Added array brackets to authorize
router.post('/tests/:id/submit', authorize(['admin', 'manager', 'qa', 'staff', 'operator']), async (req, res) => {
  try {
    const userId = req.user.user_id;
    const test = await labService.submitTest(req.params.id, userId);
    res.json({ message: 'Test submitted successfully', test });
  } catch (err) {
    console.error('POST /lab/tests/:id/submit error:', err);
    res.status(400).json({ error: err.message || 'Failed to submit test' });
  }
});

// POST /api/lab/tests/:id/supervisor-review — QA Supervisor signs off
// FIX: Added array brackets to authorize
router.post('/tests/:id/supervisor-review', authorize(['admin', 'manager', 'qa']), async (req, res) => {
  try {
    const userId = req.user.user_id;
    const { signature_password, comments } = req.body;
    
    // (Optional) Implement password check for 21 CFR Part 11 here if required
    
    const test = await labService.supervisorReview(req.params.id, userId, comments);
    res.json({ message: 'Supervisor review applied', test });
  } catch (err) {
    console.error('POST /lab/tests/:id/supervisor-review error:', err);
    res.status(400).json({ error: err.message || 'Failed to process supervisor review' });
  }
});

// POST /api/lab/tests/:id/manager-signoff — QA Manager final release (generates COA)
// FIX: Added array brackets to authorize
router.post('/tests/:id/manager-signoff', authorize(['admin', 'manager']), async (req, res) => {
  try {
    const userId = req.user.user_id;
    const { signature_password, comments } = req.body;
    
    // (Optional) Implement password check here as well
    
    const test = await labService.managerSignoff(req.params.id, userId, comments);
    res.json({ message: 'Manager sign-off complete. COA generated.', test });
  } catch (err) {
    console.error('POST /lab/tests/:id/manager-signoff error:', err);
    res.status(400).json({ error: err.message || 'Failed to process manager sign-off' });
  }
});

module.exports = router;