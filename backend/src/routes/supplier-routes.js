const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs'); 
const { pool } = require('../services/auth-service'); 
const SupplierService = require('../services/supplier-service');
const { authenticate, authorize } = require('../middleware/auth-middleware');
const SupplierEmailService = require('../services/supplier-email-service');

// ============================================================================
// 1. CREATE VENDOR DRAFT
// Roles Allowed: Sales, Admin, Manager, CEO, CFO
// ============================================================================
router.post('/', authenticate, authorize(['sales', 'admin', 'manager', 'ceo', 'cfo']), async (req, res) => {
  try {
    const userId = req.user.user_id; 
    const vendorData = req.body;

    const result = await SupplierService.createVendor(vendorData, userId);
    res.status(201).json(result);
  } catch (error) {
    console.error('Create Vendor Error:', error);
    res.status(500).json({ error: 'Failed to create vendor draft' });
  }
});

// ============================================================================
// 1.5 UPDATE VENDOR DRAFT (EDIT)
// Roles Allowed: Sales, Admin, Manager, CEO, CFO
// ============================================================================
router.put('/:id', authenticate, authorize(['sales', 'admin', 'manager', 'ceo', 'cfo']), async (req, res) => {
  try {
    const vendorId = req.params.id;
    const userId = req.user.user_id;
    const vendorData = req.body;

    const result = await SupplierService.updateVendor(vendorId, vendorData, userId);
    res.json(result);
  } catch (error) {
    console.error('Update Vendor Error:', error);
    res.status(500).json({ error: 'Failed to update vendor record' });
  }
});

// ============================================================================
// 2. FETCH VENDORS (Approved Vendor List & Dashboards)
// Roles Allowed: All authenticated users
// ============================================================================
router.get('/', authenticate, async (req, res) => {
  try {
    const filters = {
      avl_only: req.query.avl_only === 'true',
      status: req.query.status,
      category: req.query.category
    };

    const vendors = await SupplierService.listVendors(filters);
    res.json(vendors);
  } catch (error) {
    console.error('List Vendors Error:', error);
    res.status(500).json({ error: 'Failed to retrieve vendors' });
  }
});

// ============================================================================
// 3. GET SINGLE VENDOR PROFILE
// Roles Allowed: All authenticated users
// ============================================================================
router.get('/:id', authenticate, async (req, res) => {
  try {
    const vendorId = req.params.id;
    const vendor = await SupplierService.getVendorById(vendorId);
    res.json(vendor);
  } catch (error) {
    console.error('Get Vendor Error:', error);
    res.status(404).json({ error: error.message || 'Vendor not found' });
  }
});

// ============================================================================
// 4. SUBMIT FOR QA REVIEW
// Roles Allowed: Sales, Admin, Manager, CEO, CFO
// ============================================================================
router.post('/:id/submit', authenticate, authorize(['sales', 'admin', 'manager', 'ceo', 'cfo']), async (req, res) => {
  try {
    const vendorId = req.params.id;
    const updatedVendor = await SupplierService.submitForQA(vendorId);
    
    SupplierEmailService.notifyQAPending(updatedVendor).catch(console.error);
    
    res.json({ message: 'Vendor submitted for QA review successfully', vendor: updatedVendor });
  } catch (error) {
    console.error('Submit Vendor Error:', error);
    res.status(400).json({ error: error.message || 'Failed to submit vendor' });
  }
});

// ============================================================================
// 5. QA APPROVAL (With Password Verification)
// Roles Allowed: QA, Admin, CEO, CFO
// ============================================================================
router.post('/:id/approve', authenticate, authorize(['qa', 'admin', 'ceo', 'cfo']), async (req, res) => {
  try {
    const vendorId = req.params.id;
    const qaUserId = req.user.user_id;
    const { is_conditional, notes, signature_password } = req.body;

    if (!signature_password) {
      return res.status(400).json({ error: 'Digital signature (password) is required.' });
    }

    const userResult = await pool.query('SELECT password_hash FROM users WHERE user_id = $1', [qaUserId]);
    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: 'User not found.' });
    }
    
    const isValidPassword = await bcrypt.compare(signature_password, userResult.rows[0].password_hash);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid digital signature. Password incorrect.' });
    }

    const approvalData = {
      is_conditional: is_conditional || false,
      notes: notes || ''
    };

    const approvedVendor = await SupplierService.approveVendor(vendorId, qaUserId, approvalData);
    
    SupplierEmailService.notifySalesResult(approvedVendor, approvedVendor.status).catch(console.error);
    
    res.json({ 
      message: 'Vendor approved successfully and added to AVL', 
      vtl_supplier_id: approvedVendor.vtl_supplier_id,
      vendor: approvedVendor 
    });
  } catch (error) {
    console.error('Approve Vendor Error:', error);
    res.status(400).json({ error: error.message || 'Failed to approve vendor' });
  }
});

// ============================================================================
// 6. QA REJECTION (With Password Verification)
// Roles Allowed: QA, Admin, CEO, CFO
// ============================================================================
router.post('/:id/reject', authenticate, authorize(['qa', 'admin', 'ceo', 'cfo']), async (req, res) => {
  try {
    const vendorId = req.params.id;
    const qaUserId = req.user.user_id;
    const { reason, signature_password } = req.body;

    if (!reason) {
      return res.status(400).json({ error: 'Rejection reason is required' });
    }
    if (!signature_password) {
      return res.status(400).json({ error: 'Digital signature (password) is required.' });
    }

    const userResult = await pool.query('SELECT password_hash FROM users WHERE user_id = $1', [qaUserId]);
    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: 'User not found.' });
    }
    
    const isValidPassword = await bcrypt.compare(signature_password, userResult.rows[0].password_hash);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid digital signature. Password incorrect.' });
    }

    const rejectedVendor = await SupplierService.rejectVendor(vendorId, qaUserId, reason);
    
    SupplierEmailService.notifySalesResult(rejectedVendor, 'REVISION_REQUIRED').catch(console.error);
    
    res.json({ message: 'Vendor returned to Sales for revision', vendor: rejectedVendor });
  } catch (error) {
    console.error('Reject Vendor Error:', error);
    res.status(400).json({ error: error.message || 'Failed to reject vendor' });
  }
});

module.exports = router;