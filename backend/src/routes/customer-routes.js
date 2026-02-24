const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs'); 
const { pool } = require('../services/auth-service'); 
const CustomerService = require('../services/customer-service');
const { authenticate, authorize } = require('../middleware/auth-middleware');

// ============================================================================
// 1. CREATE CUSTOMER (ONBOARDING)
// Roles Allowed: Sales, Manager, Admin
// ============================================================================
router.post('/', authenticate, authorize(['sales', 'manager', 'admin']), async (req, res) => {
  try {
    const userId = req.user.user_id;
    const customerData = req.body;

    const result = await CustomerService.createCustomer(customerData, userId);
    
    // TODO: Trigger Email Notification to CFO that a new customer needs approval.
    // If result.tier === 'T3' (Chain), the roadmap says we must ALSO email the CEO!
    
    res.status(201).json(result);
  } catch (error) {
    console.error('Create Customer Error:', error);
    res.status(400).json({ error: error.message || 'Failed to onboard customer' });
  }
});

// ============================================================================
// 2. FETCH CUSTOMERS LIST (CRM Directory)
// Roles Allowed: All authenticated users
// ============================================================================
router.get('/', authenticate, async (req, res) => {
  try {
    const filters = {
      status: req.query.status
    };

    const customers = await CustomerService.listCustomers(filters);
    res.json(customers);
  } catch (error) {
    console.error('List Customers Error:', error);
    res.status(500).json({ error: 'Failed to retrieve customers directory' });
  }
});

// ============================================================================
// 3. GET SINGLE CUSTOMER DETAILS
// Roles Allowed: All authenticated users
// ============================================================================
router.get('/:id', authenticate, async (req, res) => {
  try {
    const customerId = req.params.id;
    const customer = await CustomerService.getCustomerById(customerId);
    res.json(customer);
  } catch (error) {
    console.error('Get Customer Error:', error);
    res.status(404).json({ error: error.message || 'Customer not found' });
  }
});

// ============================================================================
// 4. APPROVE CUSTOMER (Generates VTL-CUS ID)
// Roles Allowed: CFO, Admin
// ============================================================================
router.post('/:id/approve', authenticate, authorize(['cfo', 'admin']), async (req, res) => {
  try {
    const customerId = req.params.id;
    const approverId = req.user.user_id;
    const { notes, signature_password } = req.body;

    if (!signature_password) {
      return res.status(400).json({ error: 'Digital signature (password) is required to approve credit limits and onboarding.' });
    }

    // 1. Verify the Approver's Password
    const userResult = await pool.query('SELECT password_hash FROM users WHERE user_id = $1', [approverId]);
    if (userResult.rows.length === 0) return res.status(401).json({ error: 'User not found.' });
    
    const isValidPassword = await bcrypt.compare(signature_password, userResult.rows[0].password_hash);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid digital signature. Password incorrect.' });
    }

    // 2. Execute Approval and Generate VTL-CUS ID
    const result = await CustomerService.approveCustomer(customerId, approverId, notes);
    
    // TODO: Trigger Email Notification back to the Sales Rep saying the customer is active!
    
    res.json(result);
  } catch (error) {
    console.error('Approve Customer Error:', error);
    res.status(400).json({ error: error.message || 'Failed to approve customer' });
  }
});

// ============================================================================
// 5. REJECT CUSTOMER (Return to Sales for Revision)
// Roles Allowed: CFO, Admin
// ============================================================================
router.post('/:id/reject', authenticate, authorize(['cfo', 'admin']), async (req, res) => {
  try {
    const customerId = req.params.id;
    const approverId = req.user.user_id;
    const { reason, signature_password } = req.body;

    if (!reason) return res.status(400).json({ error: 'Rejection reason is required' });
    if (!signature_password) return res.status(400).json({ error: 'Digital signature (password) is required.' });

    // 1. Verify the Approver's Password
    const userResult = await pool.query('SELECT password_hash FROM users WHERE user_id = $1', [approverId]);
    if (userResult.rows.length === 0) return res.status(401).json({ error: 'User not found.' });
    
    const isValidPassword = await bcrypt.compare(signature_password, userResult.rows[0].password_hash);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid digital signature. Password incorrect.' });
    }

    // 2. Execute Rejection
    const result = await CustomerService.rejectCustomer(customerId, approverId, reason);
    
    // TODO: Trigger Email Notification back to the Sales Rep with the revision notes.
    
    res.json(result);
  } catch (error) {
    console.error('Reject Customer Error:', error);
    res.status(400).json({ error: error.message || 'Failed to reject customer' });
  }
});

module.exports = router;