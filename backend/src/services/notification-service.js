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

/**
 * Triggered when a QMS Document is submitted for QA Review
 */
const notifyQADocumentReview = async (docCode, docName, versionNumber, authorName) => {
  const qaEmails = await getEmailsByRole(['qa', 'admin', 'manager']);
  
  const subject = `ACTION REQUIRED: QMS Document Ready for QA Review (${docCode})`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
      <div style="background-color: #3b82f6; padding: 20px; text-align: center;">
        <h2 style="color: white; margin: 0;">QA Review Required</h2>
      </div>
      <div style="padding: 30px; background-color: #ffffff;">
        <p style="font-size: 16px; color: #374151;">Hello QA Team,</p>
        <p style="font-size: 16px; color: #374151;">A Quality Management System (QMS) document has been drafted and submitted for your official review and approval.</p>
        
        <div style="background-color: #f3f4f6; padding: 15px; border-radius: 6px; margin: 20px 0;">
          <p style="margin: 5px 0;"><strong>Document Code:</strong> ${docCode}</p>
          <p style="margin: 5px 0;"><strong>Document Name:</strong> ${docName}</p>
          <p style="margin: 5px 0;"><strong>Version:</strong> v${versionNumber}</p>
          <p style="margin: 5px 0;"><strong>Authored By:</strong> ${authorName}</p>
        </div>
        
        <p style="font-size: 14px; color: #6b7280;">Please log in to the Vilagio ERP to review the contents and apply your 21 CFR Part 11 digital signature to release this document.</p>
        
        <div style="text-align: center; margin-top: 30px;">
          <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/qms/documents" style="background-color: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">View in Master Register</a>
        </div>
      </div>
    </div>
  `;
  
  await sendEmail(qaEmails, subject, html);
};

/**
 * Triggered when an NCR is assigned to a user
 */
const notifyNCRAssigned = async (ncrCode, description, assignedToEmail) => {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
      <div style="background-color: #ef4444; padding: 20px; text-align: center; color: white;">
        <h2>NCR Assignment Action Required</h2>
      </div>
      <div style="padding: 20px; color: #334155;">
        <p>Hello,</p>
        <p>You have been assigned as the lead investigator for a new Non-Conformance Report (NCR).</p>
        <div style="background-color: #fef2f2; border: 1px solid #fca5a5; padding: 15px; border-radius: 6px; margin: 20px 0;">
          <p style="margin: 0 0 10px 0;"><strong>NCR Code:</strong> ${ncrCode}</p>
          <p style="margin: 0;"><strong>Description:</strong> ${description}</p>
        </div>
        <p>Please log in to the Vilagio ERP to conduct your Root Cause Analysis and log the immediate resolution.</p>
        <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/qms/ncr" style="display: inline-block; background-color: #ef4444; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin-top: 10px;">View NCR Dashboard</a>
      </div>
    </div>
  `;
  await sendEmail([assignedToEmail], `ACTION REQUIRED: Assigned to ${ncrCode}`, html);
};

/**
 * Triggered when a CAPA is assigned to a user
 */
const notifyCAPAAssigned = async (capaCode, ncrCode, actionDescription, dueDate, assignedToEmail) => {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
      <div style="background-color: #8b5cf6; padding: 20px; text-align: center; color: white;">
        <h2>CAPA Action Required</h2>
      </div>
      <div style="padding: 20px; color: #334155;">
        <p>Hello,</p>
        <p>You have been assigned as the Action Owner for a Corrective & Preventive Action (CAPA).</p>
        <div style="background-color: #f5f3ff; border: 1px solid #c4b5fd; padding: 15px; border-radius: 6px; margin: 20px 0;">
          <p style="margin: 0 0 10px 0;"><strong>CAPA Code:</strong> ${capaCode} (Linked to ${ncrCode})</p>
          <p style="margin: 0 0 10px 0;"><strong>Action Required:</strong> ${actionDescription}</p>
          <p style="margin: 0; color: #b91c1c;"><strong>Target Due Date:</strong> ${dueDate}</p>
        </div>
        <p>Please implement the required fix and update the status in the Vilagio ERP for final QA Verification.</p>
        <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/qms/capa" style="display: inline-block; background-color: #8b5cf6; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin-top: 10px;">View CAPA Dashboard</a>
      </div>
    </div>
  `;
  await sendEmail([assignedToEmail], `ACTION REQUIRED: Assigned to ${capaCode}`, html);
};
/**
 * Triggered when a new Internal Audit is scheduled with invited participants
 */
const notifyAuditInvite = async (auditCode, auditType, auditDate, scope, leadAuditorName, participantEmails) => {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
      <div style="background-color: #0d9488; padding: 20px; text-align: center; color: white;">
        <h2 style="margin: 0;">Internal Audit Invitation</h2>
      </div>
      <div style="padding: 20px; color: #334155;">
        <p>Hello,</p>
        <p>You have been invited to participate in an upcoming Internal Quality Audit.</p>
        <div style="background-color: #f0fdfa; border: 1px solid #ccfbf1; padding: 15px; border-radius: 6px; margin: 20px 0;">
          <p style="margin: 0 0 10px 0;"><strong>Audit Code:</strong> ${auditCode}</p>
          <p style="margin: 0 0 10px 0;"><strong>Audit Type:</strong> ${auditType}</p>
          <p style="margin: 0 0 10px 0;"><strong>Scheduled Date:</strong> ${new Date(auditDate).toLocaleString()}</p>
          <p style="margin: 0 0 10px 0;"><strong>Lead Auditor:</strong> ${leadAuditorName}</p>
          <p style="margin: 0; color: #0f766e;"><strong>Scope / Areas:</strong> ${scope}</p>
        </div>
        <p>Please review the scope and ensure your respective areas are prepared for the walk-through.</p>
        <div style="text-align: center; margin-top: 30px;">
          <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/qms/audits" style="background-color: #0d9488; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">View Audit Dashboard</a>
        </div>
      </div>
    </div>
  `;
  await sendEmail(participantEmails, `Audit Invitation: ${auditCode} (${auditType})`, html);
};

// DON'T FORGET TO EXPORT THEM:
module.exports = {
  notifyQAPendingReview,
  notifyBatchRejected,
  notifyLowStock,
  notifyQADocumentReview,
  notifyNCRAssigned, 
  notifyCAPAAssigned,
  notifyAuditInvite  
};
