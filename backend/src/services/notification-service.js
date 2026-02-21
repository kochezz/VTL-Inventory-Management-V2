// backend/src/services/notification-service.js
const nodemailer = require('nodemailer');
const { pool } = require('../config/database');

// Create reusable transporter object using standard SMTP transport
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: process.env.SMTP_PORT == 465, // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

/**
 * Fetch emails of all active users belonging to specific roles
 */
const getEmailsByRole = async (roles) => {
  try {
    const query = `
      SELECT email 
      FROM users 
      WHERE role = ANY($1) 
      AND is_active = true
    `;
    const result = await pool.query(query, [roles]);
    return result.rows.map(row => row.email);
  } catch (error) {
    console.error('Error fetching emails by role:', error);
    return [];
  }
};

/**
 * Core function to send an email
 */
const sendEmail = async (to, subject, htmlContent) => {
  if (!to || to.length === 0) return; // Don't send if no recipients

  try {
    const info = await transporter.sendMail({
      from: `"Vilagio ERP" <${process.env.EMAIL_FROM}>`,
      to: to.join(', '), // Joins array of emails: "qa1@vilag.io, qa2@vilag.io"
      subject: subject,
      html: htmlContent,
    });
    console.log(`✉️ Email sent: ${subject} [${info.messageId}]`);
  } catch (error) {
    console.error('❌ Error sending email:', error);
  }
};

// ============================================================================
// SPECIFIC NOTIFICATION TRIGGERS
// ============================================================================

/**
 * Triggered when Production submits a batch for QA Review
 */
const notifyQAPendingReview = async (batchNumber, productName, submittedBy) => {
  const qaEmails = await getEmailsByRole(['qa', 'admin']);
  
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
      <div style="background-color: #3b82f6; padding: 20px; text-align: center; color: white;">
        <h2>Action Required: QA Review</h2>
      </div>
      <div style="padding: 20px; color: #334155;">
        <p>Hello QA Team,</p>
        <p>A new batch has been submitted for quality assurance review by <strong>${submittedBy}</strong>.</p>
        <div style="background-color: #f8fafc; padding: 15px; border-radius: 6px; margin: 20px 0;">
          <p style="margin: 0 0 10px 0;"><strong>Batch Number:</strong> ${batchNumber}</p>
          <p style="margin: 0;"><strong>Product:</strong> ${productName}</p>
        </div>
        <p>Please log in to the Vilagio ERP to review the IPQC records and provide your electronic signature.</p>
        <a href="${process.env.FRONTEND_URL}/production" style="display: inline-block; background-color: #3b82f6; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin-top: 10px;">Go to Dashboard</a>
      </div>
    </div>
  `;

  await sendEmail(qaEmails, `QA Review Required: Batch ${batchNumber}`, html);
};

/**
 * Triggered when QA rejects a batch or IPQC stage
 */
const notifyBatchRejected = async (batchNumber, productName, rejectedBy, reason) => {
  const managerEmails = await getEmailsByRole(['manager', 'admin']);
  
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
      <div style="background-color: #ef4444; padding: 20px; text-align: center; color: white;">
        <h2>Critical Alert: Batch Rejected</h2>
      </div>
      <div style="padding: 20px; color: #334155;">
        <p>Attention Management,</p>
        <p>A production batch has been <strong>REJECTED</strong> during the QA review process.</p>
        <div style="background-color: #fef2f2; border: 1px solid #fca5a5; padding: 15px; border-radius: 6px; margin: 20px 0;">
          <p style="margin: 0 0 10px 0;"><strong>Batch Number:</strong> ${batchNumber}</p>
          <p style="margin: 0 0 10px 0;"><strong>Product:</strong> ${productName}</p>
          <p style="margin: 0 0 10px 0;"><strong>Rejected By:</strong> ${rejectedBy}</p>
          <p style="margin: 0; color: #b91c1c;"><strong>Reason:</strong> ${reason}</p>
        </div>
        <p>Immediate corrective action may be required.</p>
      </div>
    </div>
  `;

  await sendEmail(managerEmails, `URGENT: Batch Rejected - ${batchNumber}`, html);
};

/**
 * Triggered when an item falls below its reorder level
 */
const notifyLowStock = async (productName, sku, currentStock, reorderLevel) => {
  const managerEmails = await getEmailsByRole(['manager', 'admin']);
  
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
      <div style="background-color: #f59e0b; padding: 20px; text-align: center; color: white;">
        <h2>Inventory Alert: Low Stock</h2>
      </div>
      <div style="padding: 20px; color: #334155;">
        <p>Attention Procurement/Management,</p>
        <p>The following item has fallen below its minimum required threshold:</p>
        <div style="background-color: #fffbeb; border: 1px solid #fde68a; padding: 15px; border-radius: 6px; margin: 20px 0;">
          <p style="margin: 0 0 10px 0;"><strong>Product:</strong> ${productName} (${sku})</p>
          <p style="margin: 0 0 10px 0; color: #b45309;"><strong>Current Stock:</strong> ${currentStock}</p>
          <p style="margin: 0;"><strong>Reorder Threshold:</strong> ${reorderLevel}</p>
        </div>
        <a href="${process.env.FRONTEND_URL}/inventory" style="display: inline-block; background-color: #f59e0b; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin-top: 10px;">Review Inventory</a>
      </div>
    </div>
  `;

  await sendEmail(managerEmails, `Low Stock Alert: ${productName}`, html);
};

module.exports = {
  notifyQAPendingReview,
  notifyBatchRejected,
  notifyLowStock
};