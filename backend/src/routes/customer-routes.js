const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs'); 
const { pool } = require('../services/auth-service'); 
const CustomerService = require('../services/customer-service');
const { authenticate, authorize } = require('../middleware/auth-middleware');
const { Resend } = require('resend');

// ============================================================================
// 1. CREATE CUSTOMER (ONBOARDING)
// Roles Allowed: Sales, Manager, Admin
// ============================================================================
router.post('/', authenticate, authorize(['sales', 'manager', 'admin', 'ceo', 'cfo']), async (req, res) => {
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
// 2. SEND ONBOARDING REQUEST EMAIL
// Triggered from POS or CRM when a prospect is not yet registered
// Roles Allowed: Sales, Staff, Manager, Admin
// ============================================================================
router.post('/onboarding-request', authenticate, authorize(['sales', 'staff', 'manager', 'admin', 'ceo']), async (req, res) => {
  try {
    const {
      to_email,
      contact_name,
      business_name,
      phone,
      tier,
      territory,
      cashier_note,
      sent_by,
      email_html,
      email_subject,
    } = req.body;

    if (!to_email || !to_email.includes('@')) {
      return res.status(400).json({ error: 'A valid email address is required' });
    }
    if (!email_html) {
      return res.status(400).json({ error: 'Email content is required' });
    }

    const resend = new Resend(process.env.SMTP_PASS);

    const { data, error } = await resend.emails.send({
      from: process.env.EMAIL_FROM
        ? `Vilagio Technologies Ltd. <${process.env.EMAIL_FROM}>`
        : 'Vilagio Technologies Ltd. <noreply@vilag.io>',
      to:      [to_email.trim()],
      subject: email_subject || 'FreshDrip Water — Customer Account Registration Request',
      html:    email_html,
    });

    if (error) {
      console.error('❌ Onboarding request email failed:', error);
      return res.status(500).json({ error: `Email delivery failed: ${error.message}` });
    }

    console.log(`📧 Onboarding request sent to ${to_email} by ${sent_by || req.user?.full_name} [id: ${data?.id}]`);

    res.json({
      message: `Onboarding request sent to ${to_email}`,
      email_id: data?.id,
    });

  } catch (err) {
    console.error('POST /customers/onboarding-request error:', err);
    res.status(500).json({ error: err.message || 'Failed to send onboarding request' });
  }
});

// ============================================================================
// 3. FETCH CUSTOMERS LIST (CRM Directory)
// Roles Allowed: All authenticated users
// ============================================================================
router.get('/', authenticate, async (req, res) => {
  try {
    const filters = {
      status: req.query.status,
      tier: req.query.tier
    };

    const customers = await CustomerService.listCustomers(filters);
    res.json(customers);
  } catch (error) {
    console.error('List Customers Error:', error);
    res.status(500).json({ error: 'Failed to retrieve customers' });
  }
});

// ============================================================================
// 4. GET SINGLE CUSTOMER DETAILS
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
// 5. APPROVE CUSTOMER
// Required: Digital Signature Password
// Roles Allowed: CFO, Admin (CEO for T3)
// ============================================================================
router.post('/:id/approve', authenticate, authorize(['cfo', 'ceo', 'admin']), async (req, res) => {
  try {
    const customerId = req.params.id;
    const approverId = req.user.user_id;
    const { signature_password } = req.body;

    if (!signature_password) {
      return res.status(400).json({ error: 'Digital signature (password) is required to approve customers.' });
    }

    // Verify the Approver's Password (21 CFR Part 11 pattern)
    const userResult = await pool.query('SELECT password_hash FROM users WHERE user_id = $1', [approverId]);
    if (userResult.rows.length === 0) return res.status(401).json({ error: 'User not found.' });
    
    const isValidPassword = await bcrypt.compare(signature_password, userResult.rows[0].password_hash);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid digital signature. Password incorrect.' });
    }

    const result = await CustomerService.approveCustomer(customerId, approverId);
    
    // TODO: Trigger Email Notification back to the Sales Rep that the customer is approved!
    
    res.json(result);
  } catch (error) {
    console.error('Approve Customer Error:', error);
    res.status(400).json({ error: error.message || 'Failed to approve customer' });
  }
});

// ============================================================================
// 6. REJECT CUSTOMER
// Required: Digital Signature Password & Reason (For Revision)
// Roles Allowed: CFO, Admin
// ============================================================================
router.post('/:id/reject', authenticate, authorize(['cfo', 'ceo', 'admin']), async (req, res) => {
  try {
    const customerId = req.params.id;
    const approverId = req.user.user_id;
    const { reason, signature_password } = req.body;

    if (!reason) return res.status(400).json({ error: 'Rejection reason is required' });
    if (!signature_password) return res.status(400).json({ error: 'Digital signature (password) is required.' });

    // Verify the Approver's Password
    const userResult = await pool.query('SELECT password_hash FROM users WHERE user_id = $1', [approverId]);
    if (userResult.rows.length === 0) return res.status(401).json({ error: 'User not found.' });
    
    const isValidPassword = await bcrypt.compare(signature_password, userResult.rows[0].password_hash);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid digital signature. Password incorrect.' });
    }

    const result = await CustomerService.rejectCustomer(customerId, approverId, reason);
    
    // TODO: Trigger Email Notification back to the Sales Rep with the revision notes.
    
    res.json(result);
  } catch (error) {
    console.error('Reject Customer Error:', error);
    res.status(400).json({ error: error.message || 'Failed to reject customer' });
  }
});

module.exports = router;
