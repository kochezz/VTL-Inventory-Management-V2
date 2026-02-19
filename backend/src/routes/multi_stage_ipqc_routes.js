// ============================================================================
// MULTI-STAGE IPQC API ROUTES
// Add these routes to your existing production-routes.js file
// ============================================================================

// Import the new functions (add to existing imports at top of file)
const {
  getIPQCStagesForProduct,
  getNextIPQCStage,
  recordMultiStageIPQC,
  getBatchRecordCompletion,
  initializeBatchRecordMetadata
} = require('../services/production-service');

// ============================================================================
// ROUTE 1: Get IPQC stages for a product
// GET /api/production/products/:productId/ipqc-stages
// ============================================================================
router.get('/products/:productId/ipqc-stages', authenticate, async (req, res) => {
  try {
    const { productId } = req.params;
    const result = await getIPQCStagesForProduct(productId);
    res.json(result);
  } catch (error) {
    console.error('Error getting IPQC stages:', error);
    res.status(500).json({ 
      success: false,
      message: error.message 
    });
  }
});

// ============================================================================
// ROUTE 2: Get next required IPQC stage for a batch
// GET /api/production/batches/:batchId/ipqc/next-stage
// ============================================================================
router.get('/batches/:batchId/ipqc/next-stage', authenticate, async (req, res) => {
  try {
    const { batchId } = req.params;
    const result = await getNextIPQCStage(batchId);
    res.json(result);
  } catch (error) {
    console.error('Error getting next IPQC stage:', error);
    res.status(500).json({ 
      success: false,
      message: error.message 
    });
  }
});

// ============================================================================
// ROUTE 3: Record multi-stage IPQC check
// POST /api/production/batches/:batchId/ipqc/multi-stage
// ============================================================================
router.post('/batches/:batchId/ipqc/multi-stage', authenticate, async (req, res) => {
  try {
    const { batchId } = req.params;
    const ipqcData = req.body;
    const user = { 
      user_id: req.user.user_id, 
      full_name: req.user.full_name 
    };
    
    const result = await recordMultiStageIPQC(batchId, ipqcData, user);
    res.json(result);
  } catch (error) {
    console.error('Error recording multi-stage IPQC:', error);
    res.status(500).json({ 
      success: false,
      message: error.message 
    });
  }
});

// ============================================================================
// ROUTE 4: Get batch record completion status
// GET /api/production/batches/:batchId/batch-record/completion
// ============================================================================
router.get('/batches/:batchId/batch-record/completion', authenticate, async (req, res) => {
  try {
    const { batchId } = req.params;
    const result = await getBatchRecordCompletion(batchId);
    res.json(result);
  } catch (error) {
    console.error('Error getting batch record completion:', error);
    res.status(500).json({ 
      success: false,
      message: error.message 
    });
  }
});

// ============================================================================
// ROUTE 5: Initialize batch record metadata (usually called automatically)
// POST /api/production/batches/:batchId/batch-record/initialize
// ============================================================================
router.post('/batches/:batchId/batch-record/initialize', authenticate, async (req, res) => {
  try {
    const { batchId } = req.params;
    const { productId } = req.body;
    
    const result = await initializeBatchRecordMetadata(batchId, productId);
    res.json(result);
  } catch (error) {
    console.error('Error initializing batch record metadata:', error);
    res.status(500).json({ 
      success: false,
      message: error.message 
    });
  }
});
