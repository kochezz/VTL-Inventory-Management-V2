const express = require('express');
const router = express.Router();
const MetricsService = require('../services/metrics-service');
const { authenticate, authorize } = require('../middleware/auth-middleware');

// ============================================================================
// GET VENDOR & CRM METRICS
// Roles Allowed: Admin, CEO, CFO, Manager
// ============================================================================
router.get('/crm-vendor', authenticate, authorize(['admin', 'ceo', 'cfo', 'manager']), async (req, res) => {
  try {
    const metrics = await MetricsService.getVendorAndCRMMetrics();
    res.json(metrics);
  } catch (error) {
    console.error('Metrics API Error:', error);
    res.status(500).json({ error: 'Failed to retrieve metrics dashboard data' });
  }
});

module.exports = router;