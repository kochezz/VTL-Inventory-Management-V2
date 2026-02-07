// ============================================================================
// VILAGIO ERP - PRODUCTION ROUTES
// ============================================================================

const express = require('express');
const router = express.Router();

// Import authentication middleware - handles different export formats
const authMiddleware = require('../middleware/auth-middleware');
const authenticate = authMiddleware.authenticate || authMiddleware;

// Import production service
const productionService = require('../services/production-service');

// Verify imports loaded correctly
if (typeof authenticate !== 'function') {
  console.error('❌ authenticate is not a function. Type:', typeof authenticate);
  console.error('authMiddleware:', authMiddleware);
  throw new Error('Authentication middleware not loaded correctly');
}

if (typeof productionService !== 'object' || !productionService.listBatches) {
  console.error('❌ productionService not loaded correctly');
  console.error('Type:', typeof productionService);
  console.error('Has listBatches?', typeof productionService.listBatches);
  throw new Error('Production service not loaded correctly');
}

console.log('✅ Production routes: middleware and service loaded successfully');

// ============================================================================
// PRODUCTS & BOM ENDPOINTS
// ============================================================================

router.get('/finished-products', authenticate, async (req, res) => {
  try {
    const products = await productionService.getFinishedProducts();
    res.json(products);
  } catch (error) {
    console.error('Error fetching finished products:', error);
    res.status(500).json({ 
      error: 'Failed to fetch finished products',
      message: error.message 
    });
  }
});

router.get('/available-components', authenticate, async (req, res) => {
  try {
    const { productId } = req.query;
    
    if (!productId) {
      return res.status(400).json({ error: 'productId is required' });
    }
    
    const components = await productionService.getAvailableComponents(productId);
    res.json(components);
  } catch (error) {
    console.error('Error fetching available components:', error);
    res.status(500).json({ 
      error: 'Failed to fetch components',
      message: error.message 
    });
  }
});

router.post('/validate-components', authenticate, async (req, res) => {
  try {
    const { productId, requiredQuantity } = req.body;
    
    if (!productId || !requiredQuantity) {
      return res.status(400).json({ 
        error: 'productId and requiredQuantity are required' 
      });
    }
    
    const validation = await productionService.validateComponentAvailability(
      productId, 
      parseInt(requiredQuantity)
    );
    
    res.json(validation);
  } catch (error) {
    console.error('Error validating components:', error);
    res.status(500).json({ 
      error: 'Failed to validate components',
      message: error.message 
    });
  }
});

// ============================================================================
// BATCH MANAGEMENT ENDPOINTS
// ============================================================================

router.post('/batches', authenticate, async (req, res) => {
  try {
    const userId = req.user.user_id;
    const batchData = req.body;
    
    // ✅ FIX: Destructure to avoid double nesting
    const { batch } = await productionService.createBatch(batchData, userId);
    
    console.log('✅ Returning batch:', batch);
    
    res.status(201).json({
      success: true,
      message: 'Batch created successfully',
      batch
    });
  } catch (error) {
    console.error('Error creating batch:', error);
    res.status(500).json({ 
      error: 'Failed to create batch',
      message: error.message 
    });
  }
});

router.get('/batches', authenticate, async (req, res) => {
  try {
    console.log('📋 Fetching batches...');
    
    const filters = {
      status: req.query.status,
      productId: req.query.productId,
      dateFrom: req.query.dateFrom,
      dateTo: req.query.dateTo
    };
    
    // ✅ FIX: Destructure the response
    const result = await productionService.listBatches(filters);
    
    console.log(`✅ Found ${result.batches.length} batches`);
    
    res.json(result);  // Returns { batches: [...], total: N }
  } catch (error) {
    console.error('❌ Error listing batches:', error);
    res.status(500).json({ 
      error: 'Failed to list batches',
      message: error.message
    });
  }
});

router.get('/batches/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await productionService.getBatchById(id);
    res.json(result);
  } catch (error) {
    console.error('Error fetching batch details:', error);
    
    if (error.message === 'Batch not found') {
      return res.status(404).json({ 
        error: 'Batch not found',
        message: error.message 
      });
    }
    
    res.status(500).json({ 
      error: 'Failed to fetch batch details',
      message: error.message 
    });
  }
});

router.post('/batches/:id/assign-components', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { components } = req.body;
    const userId = req.user.user_id;
    
    if (!components || !Array.isArray(components)) {
      return res.status(400).json({ 
        error: 'components array is required' 
      });
    }
    
    const result = await productionService.assignComponents(id, components, userId);
    res.json(result);
  } catch (error) {
    console.error('Error assigning components:', error);
    res.status(500).json({ 
      error: 'Failed to assign components',
      message: error.message 
    });
  }
});

router.post('/batches/:id/submit-for-qa', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.user_id;
    const result = await productionService.submitForQA(id, userId);
    res.json(result);
  } catch (error) {
    console.error('Error submitting batch for QA:', error);
    res.status(500).json({ 
      error: 'Failed to submit batch for QA',
      message: error.message 
    });
  }
});

// ============================================================================
// QA GATES (PLACEHOLDERS)
// ============================================================================

router.get('/qa-gates/pending', authenticate, async (req, res) => {
  res.json({ message: 'QA Gates feature coming in Step 3', pending: [] });
});

router.post('/qa-gates/:id/approve', authenticate, async (req, res) => {
  res.json({ message: 'QA approval feature coming in Step 3', success: false });
});

router.post('/qa-gates/:id/reject', authenticate, async (req, res) => {
  res.json({ message: 'QA rejection feature coming in Step 3', success: false });
});

// ============================================================================
// PRODUCTION OPERATIONS (PLACEHOLDERS)
// ============================================================================

router.post('/batches/:id/start-setup', authenticate, async (req, res) => {
  res.json({ message: 'Production setup feature coming in Step 4', success: false });
});

router.post('/ipqc', authenticate, async (req, res) => {
  res.json({ message: 'IPQC logging feature coming in Step 4', success: false });
});

router.post('/water-treatment', authenticate, async (req, res) => {
  res.json({ message: 'Water treatment logging feature coming in Step 4', success: false });
});

router.post('/line-setup', authenticate, async (req, res) => {
  res.json({ message: 'Line setup logging feature coming in Step 4', success: false });
});

router.post('/batches/:id/complete', authenticate, async (req, res) => {
  res.json({ message: 'Batch completion feature coming in Step 4', success: false });
});

// ============================================================================
// DASHBOARD
// ============================================================================

router.get('/dashboard/active', authenticate, async (req, res) => {
  try {
    const activeBatches = await productionService.listBatches({ status: 'in_progress' });
    res.json({ active: activeBatches, count: activeBatches.length });
  } catch (error) {
    console.error('Error fetching active batches:', error);
    res.status(500).json({ 
      error: 'Failed to fetch active batches',
      message: error.message 
    });
  }
});

// ============================================================================
// STATUS TRANSITION ENDPOINTS
// ============================================================================

// Submit batch for QA
router.post('/batches/:id/submit-qa', authenticate, async (req, res) => {
  try {
    const result = await productionService.submitForQA(req.params.id, req.user.user_id);
    res.json(result);
  } catch (error) {
    console.error('Error submitting for QA:', error);
    res.status(500).json({ error: 'Failed to submit for QA', message: error.message });
  }
});

// Approve QA gate
router.post('/batches/:batchId/qa-gates/:gateId/approve', authenticate, async (req, res) => {
  try {
    const result = await productionService.approveQAGate(
      req.params.batchId,
      req.params.gateId,
      req.user.user_id
    );
    res.json(result);
  } catch (error) {
    console.error('Error approving QA gate:', error);
    res.status(500).json({ error: 'Failed to approve QA gate', message: error.message });
  }
});

// Reject QA gate
router.post('/batches/:batchId/qa-gates/:gateId/reject', authenticate, async (req, res) => {
  try {
    const { reason } = req.body;
    const result = await productionService.rejectQAGate(
      req.params.batchId,
      req.params.gateId,
      req.user.user_id,
      reason || 'Rejected by QA'
    );
    res.json(result);
  } catch (error) {
    console.error('Error rejecting QA gate:', error);
    res.status(500).json({ error: 'Failed to reject QA gate', message: error.message });
  }
});

// Start production
router.post('/batches/:id/start', authenticate, async (req, res) => {
  try {
    const result = await productionService.startProduction(req.params.id, req.user.user_id);
    res.json(result);
  } catch (error) {
    console.error('Error starting production:', error);
    res.status(500).json({ error: 'Failed to start production', message: error.message });
  }
});

// Complete production
router.post('/batches/:id/complete', authenticate, async (req, res) => {
  try {
    const { actual_output, rejected_bottles } = req.body;
    const result = await productionService.completeProduction(req.params.id, {
      actual_output: actual_output || 0,
      rejected_bottles: rejected_bottles || 0
    });
    res.json(result);
  } catch (error) {
    console.error('Error completing production:', error);
    res.status(500).json({ error: 'Failed to complete production', message: error.message });
  }
});

// CRITICAL: Export the router directly (not an object)
module.exports = router;
