const express = require('express');
const router = express.Router();
const GoodsReceiptService = require('../services/grn-service');
const { authenticate, authorize } = require('../middleware/auth-middleware');

// ============================================================================
// 1. CREATE GOODS RECEIPT NOTE (GRN)
// Roles Allowed: Warehouse, Manager, Admin
// ============================================================================
router.post('/', authenticate, authorize(['warehouse', 'manager', 'admin']), async (req, res) => {
  try {
    const userId = req.user.user_id; // Extracted securely from the JWT token
    const grnData = req.body;

    // Validate minimum required payload
    if (!grnData.po_id || !grnData.items || grnData.items.length === 0) {
      return res.status(400).json({ error: 'Purchase Order ID and at least one line item are required to generate a GRN.' });
    }

    const result = await GoodsReceiptService.createGRN(grnData, userId);
    
    // Future Enhancement: You could trigger an email to Finance here to let them know the invoice is ready for payment!
    
    res.status(201).json(result);
  } catch (error) {
    console.error('Create GRN Error:', error);
    res.status(400).json({ error: error.message || 'Failed to generate Goods Receipt Note' });
  }
});

// ============================================================================
// 2. FETCH GRN LIST (Warehouse Dashboard)
// Roles Allowed: All authenticated users
// ============================================================================
router.get('/', authenticate, async (req, res) => {
  try {
    const filters = {
      receipt_type: req.query.receipt_type
    };

    const grns = await GoodsReceiptService.listGRNs(filters);
    res.json(grns);
  } catch (error) {
    console.error('List GRNs Error:', error);
    res.status(500).json({ error: 'Failed to retrieve Goods Receipt Notes' });
  }
});

// ============================================================================
// 3. GET SINGLE GRN DETAILS
// Roles Allowed: All authenticated users
// ============================================================================
router.get('/:id', authenticate, async (req, res) => {
  try {
    const grnId = req.params.id;
    const grn = await GoodsReceiptService.getGRNById(grnId);
    res.json(grn);
  } catch (error) {
    console.error('Get GRN Error:', error);
    res.status(404).json({ error: error.message || 'Goods Receipt Note not found' });
  }
});

module.exports = router;