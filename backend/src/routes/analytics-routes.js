// backend/src/routes/analytics-routes.js
const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth-middleware');
const analyticsService = require('../services/analytics-service');

/**
 * GET /api/analytics/dashboard
 * Retrieves fully calculated BI metrics based on a time range
 */
router.get('/dashboard', authenticate, async (req, res) => {
  try {
    const { timeRange } = req.query; // '7d', '30d', '90d', '1y', 'all'
    
    const dashboardData = await analyticsService.getDashboardMetrics(timeRange);
    
    res.json({
      success: true,
      data: dashboardData
    });
    
  } catch (error) {
    console.error('Error fetching analytics dashboard data:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate analytics data',
      error: error.message
    });
  }
});

module.exports = router;