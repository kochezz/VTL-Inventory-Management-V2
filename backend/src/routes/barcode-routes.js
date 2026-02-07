// =====================================================
// VILAGIO BARCODE ROUTES
// File: barcode-routes.js
// Location: backend/routes/barcode-routes.js
// Purpose: API endpoints for barcode scanning
// =====================================================

const express = require('express');
const router = express.Router();
const barcodeService = require('../services/barcode-service');
const { authenticate, authorize } = require('../middleware/auth-middleware');

// =====================================================
// PUBLIC ENDPOINTS (with authentication)
// =====================================================

/**
 * POST /api/barcode/scan/product
 * Scan and lookup a product by barcode
 * Body: { barcodeData, scanAction, deviceType, scanDurationMs }
 */
router.post('/scan/product', authenticate, async (req, res) => {
  try {
    const { 
      barcodeData, 
      scanAction = 'lookup',
      deviceType = 'web-camera',
      scanDurationMs = null,
      scanQualityScore = null
    } = req.body;

    if (!barcodeData) {
      return res.status(400).json({ 
        success: false,
        message: 'Barcode data is required' 
      });
    }

    const startTime = Date.now();

    // Lookup product
    const product = await barcodeService.lookupProductByBarcode(barcodeData);
    
    const lookupTime = Date.now() - startTime;

    // Record the scan
    const scanRecord = await barcodeService.recordScan({
      barcodeData,
      barcodeType: product?.barcode_type || 'CODE128',
      scanType: 'product',
      scanAction,
      scanResult: product ? 'success' : 'not_found',
      productId: product?.product_id || null,
      scannedBy: req.user.userId,
      deviceType,
      scanDurationMs: scanDurationMs || lookupTime,
      scanQualityScore,
      errorMessage: product ? null : 'Product not found',
      metadata: { lookupTimeMs: lookupTime }
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found with this barcode',
        barcodeData,
        scanId: scanRecord.scan_id
      });
    }

    res.json({
      success: true,
      data: product,
      scanId: scanRecord.scan_id,
      lookupTimeMs: lookupTime
    });

  } catch (error) {
    console.error('Error scanning product barcode:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error scanning barcode',
      error: error.message 
    });
  }
});

/**
 * POST /api/barcode/scan/location
 * Scan and lookup a warehouse location by barcode
 * Body: { barcodeData, scanAction, deviceType }
 */
router.post('/scan/location', authenticate, async (req, res) => {
  try {
    const { 
      barcodeData, 
      scanAction = 'lookup',
      deviceType = 'web-camera',
      scanDurationMs = null
    } = req.body;

    if (!barcodeData) {
      return res.status(400).json({ 
        success: false,
        message: 'Barcode data is required' 
      });
    }

    const startTime = Date.now();

    // Lookup location
    const location = await barcodeService.lookupLocationByBarcode(barcodeData);
    
    const lookupTime = Date.now() - startTime;

    // Record the scan
    const scanRecord = await barcodeService.recordScan({
      barcodeData,
      barcodeType: location?.barcode_type || 'CODE128',
      scanType: 'location',
      scanAction,
      scanResult: location ? 'success' : 'not_found',
      locationId: location?.location_id || null,
      scannedBy: req.user.userId,
      deviceType,
      scanDurationMs: scanDurationMs || lookupTime,
      errorMessage: location ? null : 'Location not found'
    });

    if (!location) {
      return res.status(404).json({
        success: false,
        message: 'Location not found with this barcode',
        barcodeData,
        scanId: scanRecord.scan_id
      });
    }

    res.json({
      success: true,
      data: location,
      scanId: scanRecord.scan_id,
      lookupTimeMs: lookupTime
    });

  } catch (error) {
    console.error('Error scanning location barcode:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error scanning barcode',
      error: error.message 
    });
  }
});

/**
 * POST /api/barcode/record-scan
 * Manually record a barcode scan (for audit purposes)
 * Body: { barcodeData, scanType, scanAction, productId, locationId, ... }
 */
router.post('/record-scan', authenticate, async (req, res) => {
  try {
    const scanData = {
      ...req.body,
      scannedBy: req.user.userId
    };

    const scanRecord = await barcodeService.recordScan(scanData);

    res.json({
      success: true,
      data: scanRecord
    });

  } catch (error) {
    console.error('Error recording scan:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error recording scan',
      error: error.message 
    });
  }
});

// =====================================================
// BARCODE GENERATION ENDPOINTS
// =====================================================

/**
 * POST /api/barcode/generate/product/:productId
 * Generate barcode for a specific product
 * Params: productId
 * Body: { barcodeType }
 */
router.post('/generate/product/:productId', 
  authenticate, 
  authorize('admin', 'manager'), 
  async (req, res) => {
    try {
      const { productId } = req.params;
      const { barcodeType = 'CODE128' } = req.body;

      const result = await barcodeService.generateProductBarcode(productId, barcodeType);

      res.json({
        success: true,
        data: result
      });

    } catch (error) {
      console.error('Error generating product barcode:', error);
      res.status(500).json({ 
        success: false,
        message: error.message 
      });
    }
});

/**
 * POST /api/barcode/generate/location/:locationId
 * Generate barcode for a warehouse location
 * Params: locationId
 * Body: { barcodeType }
 */
router.post('/generate/location/:locationId', 
  authenticate, 
  authorize('admin', 'manager'), 
  async (req, res) => {
    try {
      const { locationId } = req.params;
      const { barcodeType = 'CODE128' } = req.body;

      const result = await barcodeService.generateLocationBarcode(locationId, barcodeType);

      res.json({
        success: true,
        data: result
      });

    } catch (error) {
      console.error('Error generating location barcode:', error);
      res.status(500).json({ 
        success: false,
        message: error.message 
      });
    }
});

/**
 * POST /api/barcode/generate/products/batch
 * Generate barcodes for multiple products at once
 * Body: { productIds: [], barcodeType }
 */
router.post('/generate/products/batch', 
  authenticate, 
  authorize('admin', 'manager'), 
  async (req, res) => {
    try {
      const { productIds, barcodeType = 'CODE128' } = req.body;

      if (!Array.isArray(productIds) || productIds.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'productIds array is required'
        });
      }

      const results = await barcodeService.batchGenerateProductBarcodes(productIds, barcodeType);

      const successCount = results.filter(r => r.status !== 'failed').length;
      const failureCount = results.length - successCount;

      res.json({
        success: true,
        data: {
          total: results.length,
          successful: successCount,
          failed: failureCount,
          results
        }
      });

    } catch (error) {
      console.error('Error generating batch barcodes:', error);
      res.status(500).json({ 
        success: false,
        message: error.message 
      });
    }
});

// =====================================================
// STATISTICS & REPORTING ENDPOINTS
// =====================================================

/**
 * GET /api/barcode/statistics
 * Get barcode scanning statistics
 * Query: startDate, endDate, scanType, userId
 */
router.get('/statistics', 
  authenticate, 
  authorize('admin', 'manager'), 
  async (req, res) => {
    try {
      const filters = {
        startDate: req.query.startDate,
        endDate: req.query.endDate,
        scanType: req.query.scanType,
        userId: req.query.userId
      };

      const stats = await barcodeService.getScanStatistics(filters);

      res.json({
        success: true,
        data: stats
      });

    } catch (error) {
      console.error('Error fetching scan statistics:', error);
      res.status(500).json({ 
        success: false,
        message: error.message 
      });
    }
});

/**
 * GET /api/barcode/scans/recent
 * Get recent scan history
 * Query: limit, offset, scanType, userId
 */
router.get('/scans/recent', authenticate, async (req, res) => {
  try {
    const filters = {
      limit: parseInt(req.query.limit) || 50,
      offset: parseInt(req.query.offset) || 0,
      scanType: req.query.scanType,
      userId: req.query.userId
    };

    const scans = await barcodeService.getRecentScans(filters);

    res.json({
      success: true,
      data: scans,
      count: scans.length
    });

  } catch (error) {
    console.error('Error fetching recent scans:', error);
    res.status(500).json({ 
      success: false,
      message: error.message 
    });
  }
});

// =====================================================
// CONFIGURATION ENDPOINTS
// =====================================================

/**
 * GET /api/barcode/configuration
 * Get barcode system configuration
 */
router.get('/configuration', authenticate, async (req, res) => {
  try {
    const config = await barcodeService.getBarcodeConfiguration();

    res.json({
      success: true,
      data: config
    });

  } catch (error) {
    console.error('Error fetching configuration:', error);
    res.status(500).json({ 
      success: false,
      message: error.message 
    });
  }
});

/**
 * PUT /api/barcode/configuration/:configKey
 * Update a configuration setting
 * Params: configKey
 * Body: { value }
 */
router.put('/configuration/:configKey', 
  authenticate, 
  authorize('admin'), 
  async (req, res) => {
    try {
      const { configKey } = req.params;
      const { value } = req.body;

      if (value === undefined) {
        return res.status(400).json({
          success: false,
          message: 'value is required'
        });
      }

      const result = await barcodeService.updateBarcodeConfiguration(
        configKey, 
        value, 
        req.user.userId
      );

      res.json({
        success: true,
        data: result
      });

    } catch (error) {
      console.error('Error updating configuration:', error);
      res.status(500).json({ 
        success: false,
        message: error.message 
      });
    }
});

module.exports = router;
