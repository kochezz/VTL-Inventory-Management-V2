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
// PRODUCTION NOTIFICATIONS (existing — unchanged)
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

// ============================================================================
// QC LAB NOTIFICATIONS (Phase B — new)
// ============================================================================

/**
 * Triggered when a Lab Analyst submits water quality test results for QA review.
 * Called from: lab-service.js → submitLabTest()
 * Recipients: all active users with role qa or admin
 */
const notifyLabQAPendingReview = async (testNumber, shift, analystName, testDate) => {
  const qaEmails = await getEmailsByRole(['qa', 'admin']);

  const formattedDate = new Date(testDate).toLocaleDateString('en-GB', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric'
  });
  const shiftLabel = shift.charAt(0).toUpperCase() + shift.slice(1);

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
      <div style="background-color: #3b82f6; padding: 20px; text-align: center; color: white;">
        <h2 style="margin: 0;">🧪 Action Required: Water Quality Test Review</h2>
        <p style="margin: 6px 0 0; font-size: 13px; opacity: 0.85;">QC Laboratory — Vilagio Technologies Ltd.</p>
      </div>
      <div style="padding: 24px 30px; color: #334155;">
        <p>Hello QA Team,</p>
        <p>A water quality test has been recorded and submitted by <strong>${analystName}</strong>. Your review and electronic sign-off is required before a Certificate of Analysis can be issued and production can commence.</p>
        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 15px; border-radius: 6px; margin: 20px 0;">
          <p style="margin: 0 0 8px 0;"><strong>Test Reference:</strong> ${testNumber}</p>
          <p style="margin: 0 0 8px 0;"><strong>Test Date:</strong> ${formattedDate}</p>
          <p style="margin: 0 0 8px 0;"><strong>Shift:</strong> ${shiftLabel}</p>
          <p style="margin: 0 0 8px 0;"><strong>Recorded By:</strong> ${analystName}</p>
          <p style="margin: 0;"><strong>Parameters:</strong> pH · RO Conductivity · Ozone Residue · TDS · Dissolved O₂ · Turbidity · Microbial</p>
        </div>
        <div style="background-color: #fffbeb; border-left: 4px solid #f59e0b; padding: 12px 16px; border-radius: 0 6px 6px 0; margin-bottom: 20px;">
          <p style="margin: 0; color: #92400e; font-size: 13px;">
            <strong>⚡ Production is on hold</strong> until a valid Certificate of Analysis is issued for this shift. Please complete your review promptly.
          </p>
        </div>
        <div style="text-align: center; margin-top: 10px;">
          <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/lab" style="background-color: #3b82f6; color: white; padding: 12px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Review in QC Lab</a>
        </div>
      </div>
      <div style="background-color: #f1f5f9; padding: 12px 30px; border-top: 1px solid #e2e8f0; text-align: center;">
        <p style="color: #94a3b8; font-size: 11px; margin: 0;">Vilagio Technologies Ltd. · www.vilag.io · GMP Compliant QC Management</p>
      </div>
    </div>
  `;

  await sendEmail(qaEmails, `[QC Lab] Review Required: Water Quality Test ${testNumber}`, html);
};

/**
 * Triggered when QA rejects a water quality test — re-test required.
 * Called from: lab-service.js → qaReview() when action === 'reject'
 * Recipients: QA team + admin (analyst is notified via the ERP dashboard)
 */
const notifyLabTestRejected = async (testNumber, analystName, qaName, rejectionReason) => {
  const recipients = await getEmailsByRole(['qa', 'admin', 'manager']);

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
      <div style="background-color: #ef4444; padding: 20px; text-align: center; color: white;">
        <h2 style="margin: 0;">❌ Water Quality Test Rejected — Re-test Required</h2>
        <p style="margin: 6px 0 0; font-size: 13px; opacity: 0.85;">QC Laboratory — Vilagio Technologies Ltd.</p>
      </div>
      <div style="padding: 24px 30px; color: #334155;">
        <p>Hello,</p>
        <p>A water quality test has been reviewed and <strong>rejected</strong> by QA. No Certificate of Analysis has been issued. The Lab Analyst must perform a re-test before production can proceed.</p>
        <div style="background-color: #fef2f2; border: 1px solid #fca5a5; padding: 15px; border-radius: 6px; margin: 20px 0;">
          <p style="margin: 0 0 8px 0;"><strong>Test Reference:</strong> ${testNumber}</p>
          <p style="margin: 0 0 8px 0;"><strong>Recorded By:</strong> ${analystName}</p>
          <p style="margin: 0 0 8px 0;"><strong>Rejected By:</strong> ${qaName}</p>
          <p style="margin: 0; color: #b91c1c;"><strong>Rejection Reason:</strong> ${rejectionReason || 'See QC Lab system for details'}</p>
        </div>
        <div style="background-color: #fffbeb; border-left: 4px solid #f59e0b; padding: 12px 16px; border-radius: 0 6px 6px 0; margin-bottom: 20px;">
          <p style="margin: 0; color: #92400e; font-size: 13px;">
            <strong>Next steps:</strong> The Lab Analyst (<strong>${analystName}</strong>) must perform a new test, record all 7 parameters, and resubmit for QA sign-off. <strong>Production must not commence</strong> until a valid Certificate of Analysis is on file for this shift.
          </p>
        </div>
        <div style="text-align: center; margin-top: 10px;">
          <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/lab" style="background-color: #ef4444; color: white; padding: 12px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">View in QC Lab</a>
        </div>
      </div>
      <div style="background-color: #f1f5f9; padding: 12px 30px; border-top: 1px solid #e2e8f0; text-align: center;">
        <p style="color: #94a3b8; font-size: 11px; margin: 0;">Vilagio Technologies Ltd. · www.vilag.io · GMP Compliant QC Management</p>
      </div>
    </div>
  `;

  await sendEmail(recipients, `[QC Lab] REJECTED: Water Quality Test ${testNumber} — Re-test Required`, html);
};

/**
 * Triggered when QA approves a water quality test and issues a Certificate of Analysis.
 * Called from: lab-service.js → qaReview() when action === 'approve' or 'conditional'
 * Recipients: QA team + admin + managers (production team can now proceed)
 */
const notifyLabCertificateIssued = async (testNumber, certNumber, status, qaName, analystName, deviationNote) => {
  const recipients = await getEmailsByRole(['qa', 'admin', 'manager']);

  const isConditional = status === 'conditional_pass';
  const headerColor   = isConditional ? '#f59e0b' : '#10b981';
  const statusLabel   = isConditional ? 'CONDITIONAL PASS' : 'APPROVED — PASS';
  const emoji         = isConditional ? '⚠️' : '✅';

  const conditionalBlock = isConditional && deviationNote ? `
    <div style="background-color: #fffbeb; border-left: 4px solid #f59e0b; padding: 12px 16px; border-radius: 0 6px 6px 0; margin-bottom: 20px;">
      <p style="margin: 0 0 4px; color: #92400e; font-weight: bold; font-size: 13px;">⚠️ Conditional Certificate — Deviation Note</p>
      <p style="margin: 0; color: #78350f; font-size: 13px;">${deviationNote}</p>
      <p style="margin: 8px 0 0; color: #92400e; font-size: 12px;">
        The Production Manager must acknowledge this deviation before commencing the production run.
      </p>
    </div>
  ` : '';

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
      <div style="background-color: ${headerColor}; padding: 20px; text-align: center; color: white;">
        <h2 style="margin: 0;">${emoji} Certificate of Analysis Issued — ${statusLabel}</h2>
        <p style="margin: 6px 0 0; font-size: 13px; opacity: 0.85;">QC Laboratory — Vilagio Technologies Ltd.</p>
      </div>
      <div style="padding: 24px 30px; color: #334155;">
        <p>Hello,</p>
        <p>A water quality Certificate of Analysis has been signed off by <strong>${qaName}</strong>. Production may now proceed for this shift.</p>
        <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; padding: 15px; border-radius: 6px; margin: 20px 0;">
          <p style="margin: 0 0 8px 0; font-size: 15px;"><strong>Certificate No.: ${certNumber}</strong></p>
          <p style="margin: 0 0 8px 0;"><strong>Test Reference:</strong> ${testNumber}</p>
          <p style="margin: 0 0 8px 0;"><strong>Recorded By:</strong> ${analystName}</p>
          <p style="margin: 0 0 8px 0;"><strong>QA Sign-off By:</strong> ${qaName}</p>
          <p style="margin: 0; color: ${isConditional ? '#d97706' : '#059669'};"><strong>Result:</strong> ${statusLabel}</p>
        </div>
        ${conditionalBlock}
        <div style="background-color: #eff6ff; border-left: 4px solid #3b82f6; padding: 12px 16px; border-radius: 0 6px 6px 0; margin-bottom: 20px;">
          <p style="margin: 0; color: #1e40af; font-size: 13px;">
            The CoA PDF can be downloaded from the <strong>QC Lab</strong> section of the Vilagio ERP. This certificate is valid for the production shift on today's date only.
          </p>
        </div>
        <div style="text-align: center; margin-top: 10px;">
          <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/lab" style="background-color: ${headerColor}; color: white; padding: 12px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">View Certificate in QC Lab</a>
        </div>
      </div>
      <div style="background-color: #f1f5f9; padding: 12px 30px; border-top: 1px solid #e2e8f0; text-align: center;">
        <p style="color: #94a3b8; font-size: 11px; margin: 0;">Vilagio Technologies Ltd. · www.vilag.io · GMP Compliant QC Management</p>
      </div>
    </div>
  `;

  await sendEmail(
    recipients,
    `[QC Lab] Certificate Issued: ${certNumber} — ${statusLabel}`,
    html
  );
};

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  // Production
  notifyQAPendingReview,
  notifyBatchRejected,
  notifyLowStock,
  // QMS
  notifyQADocumentReview,
  notifyNCRAssigned,
  notifyCAPAAssigned,
  notifyAuditInvite,
  // QC Lab (Phase B)
  notifyLabQAPendingReview,
  notifyLabTestRejected,
  notifyLabCertificateIssued,
};
