// src/routes/production-reports-routes.js
// Production Reports API Routes - Based on ACTUAL database schema

const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth-middleware');
const productionReportingService = require('../services/production-reporting-service');
const { pool } = require('../services/auth-service');
const path = require('path');

/**
 * GET /api/production/reports/batch/:batchId/preview
 * Preview batch production report data (JSON)
 */
router.get('/batch/:batchId/preview', authenticate, async (req, res) => {
  try {
    const { batchId } = req.params;
    
    const reportData = await productionReportingService.generateBatchProductionReport(batchId);
    
    res.json({
      success: true,
      report: reportData
    });
    
  } catch (error) {
    console.error('Error generating batch report preview:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate batch report preview',
      error: error.message
    });
  }
});

/**
 * GET /api/production/reports/batch/:batchId/pdf
 * Download batch production report as PDF
 */
router.get('/batch/:batchId/pdf', authenticate, async (req, res) => {
  try {
    const { batchId } = req.params;
    
    // Updated path to look for the JPEG logo to prevent PDFKit crashes
    const logoPath = path.join(__dirname, '../../../frontend/public/logo-black.jpg');
    
    const pdfBuffer = await productionReportingService.exportBatchProductionReportToPDF(
      batchId,
      logoPath
    );
    
    // Get batch number for filename
    const reportData = await productionReportingService.generateBatchProductionReport(batchId);
    const filename = `Production_Report_${reportData.batch.batch_number}_${Date.now()}.pdf`;
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    
    res.send(pdfBuffer);
    
  } catch (error) {
    console.error('Error generating batch PDF report:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate PDF report',
      error: error.message
    });
  }
});

/**
 * POST /api/production/reports/summary
 * Generate production summary report with filters
 */
router.post('/summary', authenticate, async (req, res) => {
  try {
    const filters = req.body;
    
    const reportData = await productionReportingService.generateProductionSummaryReport(filters);
    
    res.json({
      success: true,
      report: reportData
    });
    
  } catch (error) {
    console.error('Error generating production summary:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate production summary',
      error: error.message
    });
  }
});

/**
 * GET /api/production/reports/batches
 * Get list of batches for reporting - UPDATED TO INCLUDE STORAGE LOCATIONS
 */
router.get('/batches', authenticate, async (req, res) => {
  try {
    const { status, start_date, end_date, product_id } = req.query;
    
    // Added storage_locations subquery to fetch real-time warehouse data
    let query = `
      SELECT 
        pb.batch_id,
        pb.batch_number,
        pb.batch_record_code,
        COALESCE(pb.product_name, p.product_name) as product_name,
        pb.pack_size,
        pb.product_category,
        pb.production_date,
        pb.production_line,
        pb.shift,
        pb.planned_quantity,
        pb.actual_output,
        pb.rejected_bottles,
        pb.yield_percentage,
        pb.status,
        pb.current_gate,
        pb.line_supervisor_name,
        pb.qa_manager_name,
        pb.created_at,
        pb.production_started_at,
        pb.production_completed_at,
        pb.qa_released_at,
        CAST((SELECT COUNT(*) FROM batch_ipqc_records bir WHERE bir.batch_id = pb.batch_id) AS INTEGER) as stages_completed,
        GREATEST(CAST(COALESCE(brm.stages_required, 6) AS INTEGER), 6) as stages_required,
        brm.all_stages_approved,
        brm.qa_released,
        brm.has_deviations,
        (SELECT string_agg(DISTINCT wl.location_name, ', ')
         FROM inventory i
         JOIN warehouse_locations wl ON i.location_id = wl.location_id
         WHERE i.product_id = pb.product_id AND i.quantity_on_hand > 0) as storage_locations
      FROM production_batches pb
      LEFT JOIN batch_record_metadata brm ON pb.batch_id = brm.batch_id
      LEFT JOIN products p ON pb.product_id = p.product_id
      WHERE 1=1
    `;
    
    const params = [];
    let paramCount = 1;
    
    if (status) {
      query += ` AND pb.status = $${paramCount}`;
      params.push(status);
      paramCount++;
    }
    
    if (start_date) {
      query += ` AND pb.production_date >= $${paramCount}`;
      params.push(start_date);
      paramCount++;
    }
    
    if (end_date) {
      query += ` AND pb.production_date <= $${paramCount}`;
      params.push(end_date);
      paramCount++;
    }
    
    if (product_id) {
      query += ` AND pb.product_id = $${paramCount}`;
      params.push(product_id);
      paramCount++;
    }
    
    query += ` ORDER BY pb.production_date DESC, pb.created_at DESC LIMIT 100`;
    
    const result = await pool.query(query, params);
    
    res.json({
      success: true,
      batches: result.rows
    });
    
  } catch (error) {
    console.error('Error fetching batches for reporting:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch batches',
      error: error.message
    });
  }
});

module.exports = router;