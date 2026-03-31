const express = require('express');
const router = express.Router();
const inventoryService = require('../services/inventory-service');
const { authenticate, authorize } = require('../middleware/auth-middleware');

// All inventory routes require authentication
router.use(authenticate);

// POST /api/inventory/transactions - Create any inventory transaction
// VIEWERS CANNOT CREATE TRANSACTIONS
router.post('/transactions', authorize(['admin', 'manager', 'staff', 'operator', 'ceo', 'cfo']), async (req, res) => {
  try {
    const {
      product_id,
      from_location_id,
      to_location_id,
      quantity,
      transaction_type,
      reference_number,
      notes,
      unit_cost
    } = req.body;

    // Validation
    if (!product_id || !quantity || !transaction_type) {
      return res.status(400).json({ 
        message: 'Missing required fields: product_id, quantity, transaction_type' 
      });
    }

    const validTypes = ['RECEIVE', 'ISSUE', 'TRANSFER', 'ADJUSTMENT', 'RETURN', 'DAMAGE'];
    if (!validTypes.includes(transaction_type)) {
      return res.status(400).json({ 
        message: `Invalid transaction_type. Must be one of: ${validTypes.join(', ')}` 
      });
    }

    // Validate locations based on transaction type
    if (['RECEIVE', 'RETURN'].includes(transaction_type) && !to_location_id) {
      return res.status(400).json({ message: 'to_location_id is required for RECEIVE/RETURN transactions' });
    }
    
    if (['ISSUE', 'DAMAGE'].includes(transaction_type) && !from_location_id) {
      return res.status(400).json({ message: 'from_location_id is required for ISSUE/DAMAGE transactions' });
    }

    if (transaction_type === 'TRANSFER' && (!from_location_id || !to_location_id)) {
      return res.status(400).json({ message: 'Both from_location_id and to_location_id are required for TRANSFER transactions' });
    }

    const result = await inventoryService.createTransaction({
      product_id,
      from_location_id,
      to_location_id,
      quantity: parseFloat(quantity),
      transaction_type,
      reference_number,
      notes,
      unit_cost: unit_cost ? parseFloat(unit_cost) : null,
      performed_by: req.user.user_id
    });

    res.status(201).json(result);
  } catch (error) {
    console.error('❌ Transaction route error:', error.message);
    res.status(400).json({ message: error.message });
  }
});

// GET /api/inventory/transactions - Get transaction history
router.get('/transactions', async (req, res) => {
  try {
    const filters = {
      product_id: req.query.product_id,
      transaction_type: req.query.transaction_type,
      location_id: req.query.location_id,
      start_date: req.query.start_date,
      end_date: req.query.end_date,
      limit: parseInt(req.query.limit) || 50,
      offset: parseInt(req.query.offset) || 0
    };

    const result = await inventoryService.getTransactionHistory(filters);
    res.json(result);
  } catch (error) {
    console.error('❌ Get transactions route error:', error.message);
    res.status(500).json({ message: error.message });
  }
});

// GET /api/inventory/locations - Get all active locations
// ALL ROLES CAN VIEW LOCATIONS
router.get('/locations', async (req, res) => {
  try {
    const locations = await inventoryService.getLocations();
    res.json(locations);
  } catch (error) {
    console.error('❌ Get locations route error:', error.message);
    res.status(500).json({ message: error.message });
  }
});

// POST /api/inventory/check-availability - Check stock availability
// VIEWERS CANNOT CHECK AVAILABILITY (they don't need it since they can't transact)
router.post('/check-availability', authorize(['admin', 'manager', 'staff', 'operator', 'ceo', 'cfo']), async (req, res) => {
  try {
    const { product_id, location_id, required_quantity } = req.body;

    if (!product_id || !location_id || !required_quantity) {
      return res.status(400).json({ 
        message: 'Missing required fields: product_id, location_id, required_quantity' 
      });
    }

    console.log('🔍 Checking stock availability:', {
      product_id,
      location_id,
      required_quantity
    });

    const availability = await inventoryService.checkStockAvailability(
      product_id,
      location_id,
      parseFloat(required_quantity)
    );

    console.log('✅ Availability check complete:', availability);

    res.json(availability);
  } catch (error) {
    console.error('❌ Check availability route error:', error.message);
    res.status(500).json({ message: error.message });
  }
});

// GET /api/inventory/adjustment-reasons - Get list of adjustment reasons
// ALL ROLES CAN VIEW (read-only data)
router.get('/adjustment-reasons', (req, res) => {
  try {
    const reasons = inventoryService.getAdjustmentReasons();
    res.json(reasons);
  } catch (error) {
    console.error('❌ Get adjustment reasons error:', error.message);
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;