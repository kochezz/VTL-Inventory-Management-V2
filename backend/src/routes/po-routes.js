const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs'); 
const { pool } = require('../services/auth-service'); 
const PurchaseOrderService = require('../services/po-service');
const POEmailService = require('../services/po-email-service'); // <-- Imported the new Email Service
const { authenticate, authorize } = require('../middleware/auth-middleware');

// ============================================================================
// 1. CREATE PURCHASE ORDER
// ============================================================================
router.post('/', authenticate, authorize(['sales', 'manager', 'admin']), async (req, res) => {
  try {
    const userId = req.user.user_id;
    const poData = req.body;

    const result = await PurchaseOrderService.createPO(poData, userId);
    
    // Determine who needs to be emailed based on the initial USD calculation
    const nextRole = result.status === 'PENDING_CEO' ? 'ceo' : 'cfo';
    POEmailService.notifyPendingApproval(result.po_id, nextRole).catch(console.error);
    
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
    const filters = { status: req.query.status };
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
// 4. APPROVE PURCHASE ORDER (CFO & CEO TIERS)
// ============================================================================
router.post('/:id/approve', authenticate, authorize(['cfo', 'ceo', 'admin']), async (req, res) => {
  try {
    const poId = req.params.id;
    const approverId = req.user.user_id;
    const { notes, signature_password, acting_role } = req.body;

    if (!signature_password) return res.status(400).json({ error: 'Digital signature (password) is required.' });

    let approverRole = req.user.role.toLowerCase();
    if (approverRole === 'admin') {
      approverRole = acting_role ? acting_role.toLowerCase() : 'cfo'; 
    }

    const userResult = await pool.query('SELECT password_hash FROM users WHERE user_id = $1', [approverId]);
    if (userResult.rows.length === 0) return res.status(401).json({ error: 'User not found.' });
    
    const isValidPassword = await bcrypt.compare(signature_password, userResult.rows[0].password_hash);
    if (!isValidPassword) return res.status(401).json({ error: 'Invalid digital signature. Password incorrect.' });

    const result = await PurchaseOrderService.approvePO(poId, approverId, approverRole, notes);
    
    // Email Routing Logic
    if (result.status === 'PENDING_CEO') {
      // CFO approved it, but it's over $1,000, so email the CEO next
      POEmailService.notifyPendingApproval(poId, 'ceo').catch(console.error);
    } else if (result.status === 'APPROVED') {
      // It reached the end of the line! Email the Sales user the good news
      POEmailService.notifyPOResult(poId, 'APPROVED', notes).catch(console.error);
    }
    
    res.json(result);
  } catch (error) {
    console.error('Approve PO Error:', error);
    res.status(400).json({ error: error.message || 'Failed to approve PO' });
  }
});

// ============================================================================
// 5. REJECT PURCHASE ORDER
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

    const result = await PurchaseOrderService.rejectPO(poId, approverId, approverRole, reason);
    
    // Email the Sales user the bad news
    POEmailService.notifyPOResult(poId, 'REJECTED', reason).catch(console.error);
    
    res.json(result);
  } catch (error) {
    console.error('Reject PO Error:', error);
    res.status(400).json({ error: error.message || 'Failed to reject PO' });
  }
});

module.exports = router;