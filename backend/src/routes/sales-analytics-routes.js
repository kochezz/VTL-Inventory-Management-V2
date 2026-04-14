// ============================================================================
// SALES ANALYTICS ROUTES — Phase D2 + D3
// backend/src/routes/sales-analytics-routes.js
//
// Add to server.js:
//   const salesAnalyticsRoutes = require('./src/routes/sales-analytics-routes');
//   app.use('/api/sales-analytics', salesAnalyticsRoutes);
// ============================================================================

const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth-middleware');
const { getSalesAnalytics, getSalesCSVExport } = require('../services/sales-analytics-service');

// GET /api/sales-analytics/dashboard?timeRange=30d
router.get('/dashboard', authenticate, authorize(['admin', 'manager', 'ceo', 'cfo']), async (req, res) => {
  try {
    const { timeRange = '30d' } = req.query;
    const data = await getSalesAnalytics(timeRange);
    res.json({ success: true, data });
  } catch (err) {
    console.error('GET /sales-analytics/dashboard error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/sales-analytics/export?timeRange=30d&exportType=transactions
router.get('/export', authenticate, authorize(['admin', 'manager', 'ceo', 'cfo']), async (req, res) => {
  try {
    const { timeRange = '30d', exportType = 'transactions' } = req.query;
    const csv = await getSalesCSVExport(timeRange, exportType);
    const filename = `VTL_Sales_${exportType}_${timeRange}_${new Date().toISOString().split('T')[0]}.csv`;
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  } catch (err) {
    console.error('GET /sales-analytics/export error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
