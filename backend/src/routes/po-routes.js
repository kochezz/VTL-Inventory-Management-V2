const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs'); 
const { pool } = require('../services/auth-service'); 
const PurchaseOrderService = require('../services/po-service');
const { authenticate, authorize } = require('../middleware/auth-middleware');

// ============================================================================
// FETCH LIVE EXCHANGE RATE
// ============================================================================
router.get('/exchange-rate', authenticate, async (req, res) => {
  try {
    const rate = await posService.getLiveExchangeRate();
    res.json({ exchange_rate: rate });
  } catch (err) {
    console.error('GET /sales/exchange-rate error:', err);
    res.status(500).json({ error: 'Failed to fetch live exchange rate' });
  }
});

// ============================================================================
// 1. CREATE PURCHASE ORDER
// ============================================================================
router.post('/', authenticate, authorize(['sales', 'manager', 'admin', 'ceo', 'cfo']), async (req, res) => {
  try {
    const userId = req.user.user_id;
    const poData = req.body;

    // Emails are now natively handled inside the createPO service function
    const result = await PurchaseOrderService.createPO(poData, userId);
    
    res.status(201).json(result);
  } catch (error) {
    console.error('Create PO Error:', error);
    res.status(400).json({ error: error.message || 'Failed to create Purchase Order' });
  }
});

// ============================================================================
// 2. FETCH PURCHASE ORDERS LIST
// ============================================================================
router.get('/', authenticate, async (req, res) => {
  try {
    const filters = {
      status: req.query.status,
      vendor_id: req.query.vendor_id
    };

    const pos = await PurchaseOrderService.listPOs(filters);
    res.json(pos);
  } catch (error) {
    console.error('List POs Error:', error);
    res.status(500).json({ error: 'Failed to retrieve Purchase Orders' });
  }
});

// ============================================================================
// 3. GET SINGLE PO DETAILS
// ============================================================================
router.get('/:id', authenticate, async (req, res) => {
  try {
    const poId = req.params.id;
    const po = await PurchaseOrderService.getPOById(poId);
    res.json(po);
  } catch (error) {
    console.error('Get PO Error:', error);
    res.status(404).json({ error: error.message || 'Purchase Order not found' });
  }
});

// ============================================================================
// 4. APPROVE PURCHASE ORDER (CFO or CEO)
// ============================================================================
router.post('/:id/approve', authenticate, authorize(['cfo', 'ceo', 'admin']), async (req, res) => {
  try {
    const poId = req.params.id;
    const approverId = req.user.user_id;
    const { signature_password, acting_role } = req.body;

    if (!signature_password) {
      return res.status(400).json({ error: 'Digital signature (password) is required.' });
    }

    let approverRole = req.user.role.toLowerCase();
    if (approverRole === 'admin') {
      approverRole = acting_role ? acting_role.toLowerCase() : 'cfo'; 
    }

    const userResult = await pool.query('SELECT password_hash FROM users WHERE user_id = $1', [approverId]);
    if (userResult.rows.length === 0) return res.status(401).json({ error: 'User not found.' });
    
    const isValidPassword = await bcrypt.compare(signature_password, userResult.rows[0].password_hash);
    if (!isValidPassword) return res.status(401).json({ error: 'Invalid digital signature. Password incorrect.' });

    // Emails are now natively handled inside the approvePO service function
    const result = await PurchaseOrderService.approvePO(poId, approverId, approverRole);
    
    res.json(result);
  } catch (error) {
    console.error('Approve PO Error:', error);
    res.status(400).json({ error: error.message || 'Failed to approve Purchase Order' });
  }
});

// ============================================================================
// 5. REJECT PURCHASE ORDER (CFO or CEO)
// ============================================================================
router.post('/:id/reject', authenticate, authorize(['cfo', 'ceo', 'admin']), async (req, res) => {
  try {
    const poId = req.params.id;
    const approverId = req.user.user_id;
    const { reason, signature_password, acting_role } = req.body;

    if (!reason) return res.status(400).json({ error: 'Rejection reason is required' });
    if (!signature_password) return res.status(400).json({ error: 'Digital signature (password) is required.' });

    let approverRole = req.user.role.toLowerCase();
    if (approverRole === 'admin') {
      approverRole = acting_role ? acting_role.toLowerCase() : 'cfo'; 
    }

    const userResult = await pool.query('SELECT password_hash FROM users WHERE user_id = $1', [approverId]);
    if (userResult.rows.length === 0) return res.status(401).json({ error: 'User not found.' });
    
    const isValidPassword = await bcrypt.compare(signature_password, userResult.rows[0].password_hash);
    if (!isValidPassword) return res.status(401).json({ error: 'Invalid digital signature. Password incorrect.' });

    // Emails are now natively handled inside the rejectPO service function
    const result = await PurchaseOrderService.rejectPO(poId, approverId, approverRole, reason);
    
    res.json(result);
  } catch (error) {
    console.error('Reject PO Error:', error);
    res.status(400).json({ error: error.message || 'Failed to reject Purchase Order' });
  }
});

module.exports = router;