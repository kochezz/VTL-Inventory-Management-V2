// ============================================================================
// MOBILE ROUTES — Aggregate endpoints for VTL Executive mobile app
// ============================================================================

const express = require('express');
const router  = express.Router();
const { authenticate } = require('../middleware/auth-middleware');
const mobileService    = require('../services/mobile-service');

router.use(authenticate);

router.get('/dashboard', async (req, res) => {
  try {
    const data = await mobileService.getDashboardSummary();
    res.json(data);
  } catch (err) {
    console.error('❌ GET /api/mobile/dashboard:', err.message);
    res.status(500).json({ message: 'Failed to load dashboard summary' });
  }
});

router.get('/alerts', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const data = await mobileService.getAlertFeed(limit);
    res.json(data);
  } catch (err) {
    console.error('❌ GET /api/mobile/alerts:', err.message);
    res.status(500).json({ message: 'Failed to load alerts' });
  }
});

router.get('/operations', async (req, res) => {
  try {
    const data = await mobileService.getOperationsSummary();
    res.json(data);
  } catch (err) {
    console.error('❌ GET /api/mobile/operations:', err.message);
    res.status(500).json({ message: 'Failed to load operations summary' });
  }
});

router.get('/quality', async (req, res) => {
  try {
    const data = await mobileService.getQualitySummary();
    res.json(data);
  } catch (err) {
    console.error('❌ GET /api/mobile/quality:', err.message);
    res.status(500).json({ message: 'Failed to load quality summary' });
  }
});

router.get('/people', async (req, res) => {
  try {
    const data = await mobileService.getPeopleSummary();
    res.json(data);
  } catch (err) {
    console.error('❌ GET /api/mobile/people:', err.message);
    res.status(500).json({ message: 'Failed to load people summary' });
  }
});

router.get('/commercial', async (req, res) => {
  try {
    const data = await mobileService.getCommercialSummary();
    res.json(data);
  } catch (err) {
    console.error('❌ GET /api/mobile/commercial:', err.message);
    res.status(500).json({ message: 'Failed to load commercial summary' });
  }
});

router.post('/register-device', async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ message: 'token is required' });
    const result = await mobileService.registerDevice(req.user.user_id, token);
    res.json(result);
  } catch (err) {
    console.error('❌ POST /api/mobile/register-device:', err.message);
    res.status(500).json({ message: 'Failed to register device' });
  }
});

module.exports = router;
