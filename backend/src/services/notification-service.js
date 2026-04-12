// backend/src/services/notification-service.js
// ============================================================================
// Uses Resend HTTP API (HTTPS port 443) instead of SMTP (port 587)
// Reason: Render blocks outbound SMTP (ETIMEDOUT on port 587).
//         Resend's HTTP API uses port 443 which is always open on Render.
// Install: npm install resend   (in your backend folder)
// ============================================================================

const { Resend } = require('resend');
const { pool } = require('../config/database');

const resend = new Resend(process.env.SMTP_PASS); // Reuses existing SMTP_PASS env var (Resend API key)

// Log config on startup so Render logs confirm vars are loaded
console.log('📧 Resend HTTP API initialised:', {
  apiKey: process.env.SMTP_PASS ? `set (${process.env.SMTP_PASS.length} chars)` : '❌ NOT SET',
  from:   process.env.EMAIL_FROM   || '❌ NOT SET',
  frontend: process.env.FRONTEND_URL || '❌ NOT SET',
});

// ── Helpers ───────────────────────────────────────────────────────────────────

const getEmailsByRole = async (roles) => {
  try {
    const result = await pool.query(
      `SELECT email FROM users WHERE role = ANY($1) AND is_active = true`,
      [roles]
    );
    return result.rows.map(row => row.email);
  } catch (error) {
    console.error('📧 Error fetching emails by role:', error.message);
    return [];
  }
};

const sendEmail = async (to, subject, htmlContent) => {
  if (!to || to.length === 0) {
    console.warn('📧 sendEmail: no recipients for subject:', subject);
    return { success: false, error: 'No recipients' };
  }

  console.log(`📧 Sending: "${subject}" → [${to.join(', ')}]`);

  try {
    const { data, error } = await resend.emails.send({
      from: process.env.EMAIL_FROM
        ? `Vilagio ERP <${process.env.EMAIL_FROM}>`
        : 'Vilagio ERP <noreply@vilag.io>',
      to,               // Resend accepts an array directly
      subject,
      html: htmlContent,
    });

    if (error) {
      console.error('❌ Resend API error:', error);
      return { success: false, error };
    } else {
      console.log(`✉️  Email sent: ${subject} [id: ${data?.id}]`);
      return { success: true, id: data?.id };
    }
  } catch (err) {
    console.error('❌ sendEmail exception:', err.message);
    return { success: false, error: err.message };
  }
};

// ============================================================================
// CRM & VENDOR NOTIFICATIONS
// ============================================================================

const notifyCustomerPendingApproval = async (tradingName, tierName, onboardedByName, rolesToNotify) => {
  const emails = await getEmailsByRole(rolesToNotify);
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
      <div style="background-color:#3b82f6;padding:20px;text-align:center;color:white;"><h2>Action Required: Customer Approval</h2></div>
      <div style="padding:20px;color:#334155;">
        <p>Hello Executive Team,</p>
        <p>A new customer account has been onboarded by <strong>${onboardedByName}</strong> and requires your approval.</p>
        <div style="background-color:#f8fafc;padding:15px;border-radius:6px;margin:20px 0;">
          <p style="margin:0 0 10px 0;"><strong>Customer:</strong> ${tradingName}</p>
          <p style="margin:0;"><strong>Tier:</strong> ${tierName}</p>
        </div>
        <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/crm/customers" style="display:inline-block;background-color:#3b82f6;color:white;padding:10px 20px;text-decoration:none;border-radius:5px;">Review Customer</a>
      </div>
    </div>`;
  await sendEmail(emails, `Pending Approval: New Customer (${tradingName})`, html);
};

const notifyCustomerStatus = async (tradingName, status, salesRepEmail, approverName, reason = '') => {
  const isApproved = status === 'APPROVED';
  const color = isApproved ? '#10b981' : '#ef4444';
  const title = isApproved ? 'Customer Approved' : 'Customer Revision Required';
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
      <div style="background-color:${color};padding:20px;text-align:center;color:white;"><h2>${title}</h2></div>
      <div style="padding:20px;color:#334155;">
        <p>Hello,</p>
        <p>The onboarding request for <strong>${tradingName}</strong> has been reviewed by ${approverName}.</p>
        <div style="background-color:#f8fafc;padding:15px;border-radius:6px;margin:20px 0;">
          <p style="margin:0 0 10px 0;"><strong>Status:</strong> <span style="color:${color};font-weight:bold;">${status}</span></p>
          ${!isApproved ? `<p style="margin:0;color:#b91c1c;"><strong>Reason:</strong> ${reason}</p>` : ''}
        </div>
      </div>
    </div>`;
  await sendEmail([salesRepEmail], `Customer Update: ${tradingName}`, html);
};

// ============================================================================
// PURCHASE ORDER NOTIFICATIONS
// ============================================================================

const notifyPOPendingApproval = async (poNumber, totalUsd, vendorName, raisedByName, rolesToNotify) => {
  const emails = await getEmailsByRole(rolesToNotify);
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
      <div style="background-color:#8b5cf6;padding:20px;text-align:center;color:white;"><h2>Action Required: PO Approval</h2></div>
      <div style="padding:20px;color:#334155;">
        <p>Hello Executive Team,</p>
        <p>A Purchase Order has been raised by <strong>${raisedByName}</strong> and is pending your signature.</p>
        <div style="background-color:#f5f3ff;border:1px solid #c4b5fd;padding:15px;border-radius:6px;margin:20px 0;">
          <p style="margin:0 0 10px 0;"><strong>PO Number:</strong> ${poNumber}</p>
          <p style="margin:0 0 10px 0;"><strong>Vendor:</strong> ${vendorName}</p>
          <p style="margin:0;font-weight:bold;color:#6d28d9;"><strong>Total Amount:</strong> $${totalUsd.toFixed(2)} USD (Equivalent)</p>
        </div>
        <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/purchasing" style="display:inline-block;background-color:#8b5cf6;color:white;padding:10px 20px;text-decoration:none;border-radius:5px;">Review Purchase Order</a>
      </div>
    </div>`;
  await sendEmail(emails, `Pending PO Approval: ${poNumber}`, html);
};

const notifyPOStatus = async (poNumber, status, creatorEmail, approverName, reason = '') => {
  const isApproved = status === 'APPROVED';
  const color = isApproved ? '#10b981' : '#ef4444';
  const title = isApproved ? 'Purchase Order Approved' : 'Purchase Order Rejected';
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
      <div style="background-color:${color};padding:20px;text-align:center;color:white;"><h2>${title}</h2></div>
      <div style="padding:20px;color:#334155;">
        <p>Hello,</p>
        <p>Your Purchase Order <strong>${poNumber}</strong> has been reviewed by ${approverName}.</p>
        <div style="background-color:#f8fafc;padding:15px;border-radius:6px;margin:20px 0;">
          <p style="margin:0 0 10px 0;"><strong>Status:</strong> <span style="color:${color};font-weight:bold;">${status}</span></p>
          ${!isApproved ? `<p style="margin:0;color:#b91c1c;"><strong>Reason:</strong> ${reason}</p>` : ''}
        </div>
      </div>
    </div>`;
  await sendEmail([creatorEmail], `PO Update: ${poNumber}`, html);
};

// ============================================================================
// PRODUCTION NOTIFICATIONS
// ============================================================================

const notifyQAPendingReview = async (batchNumber, productName, submittedBy) => {
  const qaEmails = await getEmailsByRole(['qa', 'admin']);
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
      <div style="background-color:#3b82f6;padding:20px;text-align:center;color:white;">
        <h2>Action Required: QA Review</h2>
      </div>
      <div style="padding:20px;color:#334155;">
        <p>Hello QA Team,</p>
        <p>A new batch has been submitted for quality assurance review by <strong>${submittedBy}</strong>.</p>
        <div style="background-color:#f8fafc;padding:15px;border-radius:6px;margin:20px 0;">
          <p style="margin:0 0 10px 0;"><strong>Batch Number:</strong> ${batchNumber}</p>
          <p style="margin:0;"><strong>Product:</strong> ${productName}</p>
        </div>
        <p>Please log in to the Vilagio ERP to review the IPQC records and provide your electronic signature.</p>
        <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/production" style="display:inline-block;background-color:#3b82f6;color:white;padding:10px 20px;text-decoration:none;border-radius:5px;margin-top:10px;">Go to Dashboard</a>
      </div>
    </div>`;
  await sendEmail(qaEmails, `QA Review Required: Batch ${batchNumber}`, html);
};

const notifyBatchRejected = async (batchNumber, productName, rejectedBy, reason) => {
  const managerEmails = await getEmailsByRole(['manager', 'admin']);
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
      <div style="background-color:#ef4444;padding:20px;text-align:center;color:white;">
        <h2>Critical Alert: Batch Rejected</h2>
      </div>
      <div style="padding:20px;color:#334155;">
        <p>Attention Management,</p>
        <p>A production batch has been <strong>REJECTED</strong> during the QA review process.</p>
        <div style="background-color:#fef2f2;border:1px solid #fca5a5;padding:15px;border-radius:6px;margin:20px 0;">
          <p style="margin:0 0 10px 0;"><strong>Batch Number:</strong> ${batchNumber}</p>
          <p style="margin:0 0 10px 0;"><strong>Product:</strong> ${productName}</p>
          <p style="margin:0 0 10px 0;"><strong>Rejected By:</strong> ${rejectedBy}</p>
          <p style="margin:0;color:#b91c1c;"><strong>Reason:</strong> ${reason}</p>
        </div>
        <p>Immediate corrective action may be required.</p>
      </div>
    </div>`;
  await sendEmail(managerEmails, `URGENT: Batch Rejected - ${batchNumber}`, html);
};

const notifyLowStock = async (productName, sku, currentStock, reorderLevel) => {
  const managerEmails = await getEmailsByRole(['manager', 'admin']);
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
      <div style="background-color:#f59e0b;padding:20px;text-align:center;color:white;">
        <h2>Inventory Alert: Low Stock</h2>
      </div>
      <div style="padding:20px;color:#334155;">
        <p>Attention Procurement/Management,</p>
        <p>The following item has fallen below its minimum required threshold:</p>
        <div style="background-color:#fffbeb;border:1px solid #fde68a;padding:15px;border-radius:6px;margin:20px 0;">
          <p style="margin:0 0 10px 0;"><strong>Product:</strong> ${productName} (${sku})</p>
          <p style="margin:0 0 10px 0;color:#b45309;"><strong>Current Stock:</strong> ${currentStock}</p>
          <p style="margin:0;"><strong>Reorder Threshold:</strong> ${reorderLevel}</p>
        </div>
        <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/inventory" style="display:inline-block;background-color:#f59e0b;color:white;padding:10px 20px;text-decoration:none;border-radius:5px;margin-top:10px;">Review Inventory</a>
      </div>
    </div>`;
  await sendEmail(managerEmails, `Low Stock Alert: ${productName}`, html);
};

// ============================================================================
// QMS NOTIFICATIONS
// ============================================================================

const notifyQADocumentReview = async (docCode, docName, versionNumber, authorName) => {
  const qaEmails = await getEmailsByRole(['qa', 'admin', 'manager']);
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
      <div style="background-color:#3b82f6;padding:20px;text-align:center;">
        <h2 style="color:white;margin:0;">QA Review Required</h2>
      </div>
      <div style="padding:30px;background-color:#ffffff;">
        <p style="font-size:16px;color:#374151;">Hello QA Team,</p>
        <p style="font-size:16px;color:#374151;">A QMS document has been drafted and submitted for your official review and approval.</p>
        <div style="background-color:#f3f4f6;padding:15px;border-radius:6px;margin:20px 0;">
          <p style="margin:5px 0;"><strong>Document Code:</strong> ${docCode}</p>
          <p style="margin:5px 0;"><strong>Document Name:</strong> ${docName}</p>
          <p style="margin:5px 0;"><strong>Version:</strong> v${versionNumber}</p>
          <p style="margin:5px 0;"><strong>Authored By:</strong> ${authorName}</p>
        </div>
        <div style="text-align:center;margin-top:30px;">
          <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/qms/documents" style="background-color:#3b82f6;color:white;padding:12px 24px;text-decoration:none;border-radius:6px;font-weight:bold;display:inline-block;">View in Master Register</a>
        </div>
      </div>
    </div>`;
  await sendEmail(qaEmails, `ACTION REQUIRED: QMS Document Ready for QA Review (${docCode})`, html);
};

const notifyNCRAssigned = async (ncrCode, description, assignedToEmail) => {
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
      <div style="background-color:#ef4444;padding:20px;text-align:center;color:white;">
        <h2>NCR Assignment Action Required</h2>
      </div>
      <div style="padding:20px;color:#334155;">
        <p>You have been assigned as lead investigator for a new Non-Conformance Report (NCR).</p>
        <div style="background-color:#fef2f2;border:1px solid #fca5a5;padding:15px;border-radius:6px;margin:20px 0;">
          <p style="margin:0 0 10px 0;"><strong>NCR Code:</strong> ${ncrCode}</p>
          <p style="margin:0;"><strong>Description:</strong> ${description}</p>
        </div>
        <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/qms/ncr" style="display:inline-block;background-color:#ef4444;color:white;padding:10px 20px;text-decoration:none;border-radius:5px;margin-top:10px;">View NCR Dashboard</a>
      </div>
    </div>`;
  await sendEmail([assignedToEmail], `ACTION REQUIRED: Assigned to ${ncrCode}`, html);
};

const notifyCAPAAssigned = async (capaCode, ncrCode, actionDescription, dueDate, assignedToEmail) => {
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
      <div style="background-color:#8b5cf6;padding:20px;text-align:center;color:white;">
        <h2>CAPA Action Required</h2>
      </div>
      <div style="padding:20px;color:#334155;">
        <p>You have been assigned as Action Owner for a Corrective & Preventive Action (CAPA).</p>
        <div style="background-color:#f5f3ff;border:1px solid #c4b5fd;padding:15px;border-radius:6px;margin:20px 0;">
          <p style="margin:0 0 10px 0;"><strong>CAPA Code:</strong> ${capaCode} (Linked to ${ncrCode})</p>
          <p style="margin:0 0 10px 0;"><strong>Action Required:</strong> ${actionDescription}</p>
          <p style="margin:0;color:#b91c1c;"><strong>Target Due Date:</strong> ${dueDate}</p>
        </div>
        <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/qms/capa" style="display:inline-block;background-color:#8b5cf6;color:white;padding:10px 20px;text-decoration:none;border-radius:5px;margin-top:10px;">View CAPA Dashboard</a>
      </div>
    </div>`;
  await sendEmail([assignedToEmail], `ACTION REQUIRED: Assigned to ${capaCode}`, html);
};

const notifyAuditInvite = async (auditCode, auditType, auditDate, scope, leadAuditorName, participantEmails) => {
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
      <div style="background-color:#0d9488;padding:20px;text-align:center;color:white;">
        <h2 style="margin:0;">Internal Audit Invitation</h2>
      </div>
      <div style="padding:20px;color:#334155;">
        <p>You have been invited to participate in an upcoming Internal Quality Audit.</p>
        <div style="background-color:#f0fdfa;border:1px solid #ccfbf1;padding:15px;border-radius:6px;margin:20px 0;">
          <p style="margin:0 0 10px 0;"><strong>Audit Code:</strong> ${auditCode}</p>
          <p style="margin:0 0 10px 0;"><strong>Audit Type:</strong> ${auditType}</p>
          <p style="margin:0 0 10px 0;"><strong>Scheduled Date:</strong> ${new Date(auditDate).toLocaleString()}</p>
          <p style="margin:0 0 10px 0;"><strong>Lead Auditor:</strong> ${leadAuditorName}</p>
          <p style="margin:0;color:#0f766e;"><strong>Scope:</strong> ${scope}</p>
        </div>
        <div style="text-align:center;margin-top:30px;">
          <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/qms/audits" style="background-color:#0d9488;color:white;padding:12px 24px;text-decoration:none;border-radius:6px;font-weight:bold;display:inline-block;">View Audit Dashboard</a>
        </div>
      </div>
    </div>`;
  await sendEmail(participantEmails, `Audit Invitation: ${auditCode} (${auditType})`, html);
};

// ============================================================================
// QMS PHASE 2 NOTIFICATIONS
// ============================================================================

const notifyDocumentReviewDue = async (docCode, docName, versionNumber, reviewDueDate, ownerName, ownerEmail) => {
  const formattedDate = new Date(reviewDueDate).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'long', year: 'numeric'
  });
  const isOverdue   = new Date(reviewDueDate) < new Date();
  const headerColor = isOverdue ? '#ef4444' : '#f59e0b';
  const statusLabel = isOverdue ? 'OVERDUE FOR REVIEW' : 'REVIEW DUE SOON';
  const emoji       = isOverdue ? '🔴' : '🟡';

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
      <div style="background-color:${headerColor};padding:20px;text-align:center;color:white;">
        <h2 style="margin:0;">${emoji} Controlled Document: ${statusLabel}</h2>
        <p style="margin:6px 0 0;font-size:13px;opacity:0.85;">Vilagio QMS — Document Control</p>
      </div>
      <div style="padding:24px 30px;color:#334155;">
        <p>Hello ${ownerName},</p>
        <p>A controlled document under your ownership is ${isOverdue ? '<strong>overdue</strong>' : 'due'} for its periodic review. As the document owner, you are responsible for initiating a review and determining whether a revision is required.</p>
        <div style="background-color:#f8fafc;border:1px solid #e2e8f0;padding:15px;border-radius:6px;margin:20px 0;">
          <p style="margin:0 0 8px 0;"><strong>Document:</strong> ${docCode} — ${docName}</p>
          <p style="margin:0 0 8px 0;"><strong>Current Version:</strong> v${versionNumber}</p>
          <p style="margin:0;color:${headerColor};font-weight:bold;"><strong>Review Due:</strong> ${formattedDate}</p>
        </div>
        <p style="font-size:13px;color:#64748b;">If this document remains valid without changes, open it in the QMS and dismiss the review task. If changes are required, create a new revision.</p>
        <div style="text-align:center;margin-top:20px;">
          <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/qms/documents" style="background-color:${headerColor};color:white;padding:12px 28px;text-decoration:none;border-radius:6px;font-weight:bold;display:inline-block;">Open QMS Document Register</a>
        </div>
      </div>
      <div style="background-color:#f1f5f9;padding:12px 30px;border-top:1px solid #e2e8f0;text-align:center;">
        <p style="color:#94a3b8;font-size:11px;margin:0;">Vilagio Technologies Ltd. · Controlled Document Management System</p>
      </div>
    </div>`;

  return sendEmail([ownerEmail], `[QMS] ${statusLabel}: ${docCode} — ${docName}`, html);
};

const notifyQAReviewDueBroadcast = async (docCode, docName, versionNumber, reviewDueDate) => {
  const recipients = await getEmailsByRole(['qa', 'admin', 'manager', 'ceo']);
  if (!recipients.length) return;

  const formattedDate = new Date(reviewDueDate).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'long', year: 'numeric'
  });
  const isOverdue   = new Date(reviewDueDate) < new Date();
  const headerColor = isOverdue ? '#ef4444' : '#f59e0b';
  const statusLabel = isOverdue ? 'OVERDUE' : 'DUE SOON';

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
      <div style="background-color:${headerColor};padding:20px;text-align:center;color:white;">
        <h2 style="margin:0;">📋 QMS Periodic Review Alert</h2>
        <p style="margin:6px 0 0;font-size:13px;opacity:0.85;">${statusLabel}: ${docCode}</p>
      </div>
      <div style="padding:24px 30px;color:#334155;">
        <p>This is an automated QMS system alert for your awareness. The following controlled document is ${isOverdue ? 'overdue for' : 'approaching'} its annual periodic review.</p>
        <div style="background-color:#f8fafc;border:1px solid #e2e8f0;padding:15px;border-radius:6px;margin:20px 0;">
          <p style="margin:0 0 8px 0;"><strong>Document:</strong> ${docCode} — ${docName}</p>
          <p style="margin:0 0 8px 0;"><strong>Version:</strong> v${versionNumber}</p>
          <p style="margin:0;color:${headerColor};font-weight:bold;"><strong>Review Due:</strong> ${formattedDate}</p>
        </div>
        <p style="font-size:13px;color:#64748b;">The document owner has been notified directly. This alert is for QMS oversight visibility.</p>
        <div style="text-align:center;margin-top:20px;">
          <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/qms/documents" style="background-color:#3b82f6;color:white;padding:12px 28px;text-decoration:none;border-radius:6px;font-weight:bold;display:inline-block;">View in QMS</a>
        </div>
      </div>
      <div style="background-color:#f1f5f9;padding:12px 30px;border-top:1px solid #e2e8f0;text-align:center;">
        <p style="color:#94a3b8;font-size:11px;margin:0;">Vilagio Technologies Ltd. · QMS Automated Alert</p>
      </div>
    </div>`;

  return sendEmail(recipients, `[QMS Alert] Periodic Review ${statusLabel}: ${docCode}`, html);
};

const notifyDocumentOverdue = async (docCode, docName, dueDate, ownerName, ownerEmail) => {
  const formattedDate = new Date(dueDate).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'long', year: 'numeric'
  });
  const daysOverdue = Math.floor((Date.now() - new Date(dueDate).getTime()) / (1000 * 60 * 60 * 24));

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
      <div style="background-color:#ef4444;padding:20px;text-align:center;color:white;">
        <h2 style="margin:0;">🔴 OVERDUE: Document Review Required</h2>
        <p style="margin:6px 0 0;font-size:13px;opacity:0.85;">${daysOverdue} day${daysOverdue !== 1 ? 's' : ''} past due date — Escalation Notice</p>
      </div>
      <div style="padding:24px 30px;color:#334155;">
        <p>Hello ${ownerName},</p>
        <p>This is an escalation notice. The controlled document below has not been actioned and is now <strong>${daysOverdue} days overdue</strong> for its periodic review.</p>
        <div style="background-color:#fef2f2;border:1px solid #fca5a5;padding:15px;border-radius:6px;margin:20px 0;">
          <p style="margin:0 0 8px 0;"><strong>Document:</strong> ${docCode} — ${docName}</p>
          <p style="margin:0;color:#b91c1c;font-weight:bold;"><strong>Was due:</strong> ${formattedDate}</p>
        </div>
        <div style="background-color:#fffbeb;border-left:4px solid #f59e0b;padding:12px 16px;border-radius:0 6px 6px 0;margin-bottom:20px;">
          <p style="margin:0;color:#92400e;font-size:13px;"><strong>Action required:</strong> Log in to the QMS and either dismiss this review (if no changes are needed) or create a new revision. Continued inaction may affect your GMP compliance status.</p>
        </div>
        <div style="text-align:center;margin-top:10px;">
          <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/qms/documents" style="background-color:#ef4444;color:white;padding:12px 28px;text-decoration:none;border-radius:6px;font-weight:bold;display:inline-block;">Action Now in QMS</a>
        </div>
      </div>
      <div style="background-color:#f1f5f9;padding:12px 30px;border-top:1px solid #e2e8f0;text-align:center;">
        <p style="color:#94a3b8;font-size:11px;margin:0;">Vilagio Technologies Ltd. · GMP Compliant Document Management</p>
      </div>
    </div>`;

  return sendEmail([ownerEmail], `[URGENT] QMS Document Overdue: ${docCode} — ${daysOverdue} days past due`, html);
};

const notifyTrainingRequired = async (docCode, docName, versionNumber, recipientName, recipientEmail) => {
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
      <div style="background-color:#3b82f6;padding:20px;text-align:center;color:white;">
        <h2 style="margin:0;">📚 Action Required: Document Training</h2>
        <p style="margin:6px 0 0;font-size:13px;opacity:0.85;">Vilagio QMS — Training Management</p>
      </div>
      <div style="padding:24px 30px;color:#334155;">
        <p>Hello ${recipientName},</p>
        <p>A controlled document that applies to your role has been officially released. You are required to read and acknowledge this document before carrying out activities it governs.</p>
        <div style="background-color:#eff6ff;border:1px solid #bfdbfe;padding:15px;border-radius:6px;margin:20px 0;">
          <p style="margin:0 0 8px 0;font-size:15px;"><strong>${docCode} — ${docName}</strong></p>
          <p style="margin:0;"><strong>Version:</strong> v${versionNumber} (newly released)</p>
        </div>
        <div style="background-color:#f0fdf4;border-left:4px solid #22c55e;padding:12px 16px;border-radius:0 6px 6px 0;margin-bottom:20px;">
          <p style="margin:0;color:#166534;font-size:13px;"><strong>How to acknowledge:</strong> Log into the Vilagio ERP → QMS → Training Matrix → find this document → click <strong>Acknowledge</strong> and enter your login password as your electronic signature.</p>
        </div>
        <div style="text-align:center;margin-top:10px;">
          <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/qms/training" style="background-color:#3b82f6;color:white;padding:12px 28px;text-decoration:none;border-radius:6px;font-weight:bold;display:inline-block;">Go to Training Matrix</a>
        </div>
      </div>
      <div style="background-color:#f1f5f9;padding:12px 30px;border-top:1px solid #e2e8f0;text-align:center;">
        <p style="color:#94a3b8;font-size:11px;margin:0;">This training requirement was auto-assigned on document release. Vilagio Technologies Ltd.</p>
      </div>
    </div>`;

  return sendEmail([recipientEmail], `[QMS Training] Action Required: ${docCode} v${versionNumber} — ${docName}`, html);
};

// ============================================================================
// QC LAB NOTIFICATIONS
// ============================================================================

const notifyLabQAPendingReview = async (testNumber, shift, analystName, testDate) => {
  const qaEmails = await getEmailsByRole(['qa', 'admin']);
  const formattedDate = new Date(testDate).toLocaleDateString('en-GB', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric'
  });
  const shiftLabel = shift.charAt(0).toUpperCase() + shift.slice(1);
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
      <div style="background-color:#3b82f6;padding:20px;text-align:center;color:white;">
        <h2 style="margin:0;">🧪 Action Required: Water Quality Test Review</h2>
        <p style="margin:6px 0 0;font-size:13px;opacity:0.85;">QC Laboratory — Vilagio Technologies Ltd.</p>
      </div>
      <div style="padding:24px 30px;color:#334155;">
        <p>Hello QA Team,</p>
        <p>A water quality test has been recorded and submitted by <strong>${analystName}</strong>. Your review and electronic sign-off is required before a Certificate of Analysis can be issued.</p>
        <div style="background-color:#f8fafc;border:1px solid #e2e8f0;padding:15px;border-radius:6px;margin:20px 0;">
          <p style="margin:0 0 8px 0;"><strong>Test Reference:</strong> ${testNumber}</p>
          <p style="margin:0 0 8px 0;"><strong>Test Date:</strong> ${formattedDate}</p>
          <p style="margin:0 0 8px 0;"><strong>Shift:</strong> ${shiftLabel}</p>
          <p style="margin:0 0 8px 0;"><strong>Recorded By:</strong> ${analystName}</p>
          <p style="margin:0;"><strong>Parameters:</strong> pH · RO Conductivity · Ozone Residue · TDS · Dissolved O₂ · Turbidity · Microbial</p>
        </div>
        <div style="background-color:#fffbeb;border-left:4px solid #f59e0b;padding:12px 16px;border-radius:0 6px 6px 0;margin-bottom:20px;">
          <p style="margin:0;color:#92400e;font-size:13px;"><strong>⚡ Production is on hold</strong> until a valid Certificate of Analysis is issued for this shift.</p>
        </div>
        <div style="text-align:center;margin-top:10px;">
          <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/lab" style="background-color:#3b82f6;color:white;padding:12px 28px;text-decoration:none;border-radius:6px;font-weight:bold;display:inline-block;">Review in QC Lab</a>
        </div>
      </div>
      <div style="background-color:#f1f5f9;padding:12px 30px;border-top:1px solid #e2e8f0;text-align:center;">
        <p style="color:#94a3b8;font-size:11px;margin:0;">Vilagio Technologies Ltd. · www.vilag.io · GMP Compliant QC Management</p>
      </div>
    </div>`;
  await sendEmail(qaEmails, `[QC Lab] Review Required: Water Quality Test ${testNumber}`, html);
};

const notifyLabTestRejected = async (testNumber, analystName, qaName, rejectionReason) => {
  const recipients = await getEmailsByRole(['qa', 'admin', 'manager']);
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
      <div style="background-color:#ef4444;padding:20px;text-align:center;color:white;">
        <h2 style="margin:0;">❌ Water Quality Test Rejected — Re-test Required</h2>
        <p style="margin:6px 0 0;font-size:13px;opacity:0.85;">QC Laboratory — Vilagio Technologies Ltd.</p>
      </div>
      <div style="padding:24px 30px;color:#334155;">
        <p>A water quality test has been reviewed and <strong>rejected</strong> by QA. No Certificate of Analysis has been issued.</p>
        <div style="background-color:#fef2f2;border:1px solid #fca5a5;padding:15px;border-radius:6px;margin:20px 0;">
          <p style="margin:0 0 8px 0;"><strong>Test Reference:</strong> ${testNumber}</p>
          <p style="margin:0 0 8px 0;"><strong>Recorded By:</strong> ${analystName}</p>
          <p style="margin:0 0 8px 0;"><strong>Rejected By:</strong> ${qaName}</p>
          <p style="margin:0;color:#b91c1c;"><strong>Rejection Reason:</strong> ${rejectionReason || 'See QC Lab system for details'}</p>
        </div>
        <div style="background-color:#fffbeb;border-left:4px solid #f59e0b;padding:12px 16px;border-radius:0 6px 6px 0;">
          <p style="margin:0;color:#92400e;font-size:13px;"><strong>Next steps:</strong> ${analystName} must perform a re-test and resubmit for QA review. <strong>Production must not commence</strong> until a valid Certificate of Analysis is on file.</p>
        </div>
      </div>
      <div style="background-color:#f1f5f9;padding:12px 30px;border-top:1px solid #e2e8f0;text-align:center;">
        <p style="color:#94a3b8;font-size:11px;margin:0;">Vilagio Technologies Ltd. · www.vilag.io · GMP Compliant QC Management</p>
      </div>
    </div>`;
  await sendEmail(recipients, `[QC Lab] REJECTED: Water Quality Test ${testNumber} — Re-test Required`, html);
};

const notifyLabCertificateIssued = async (testNumber, certNumber, status, qaName, analystName, deviationNote) => {
  const recipients = await getEmailsByRole(['qa', 'admin', 'manager']);
  const isConditional = status === 'conditional_pass';
  const headerColor = isConditional ? '#f59e0b' : '#10b981';
  const statusLabel  = isConditional ? 'CONDITIONAL PASS' : 'APPROVED — PASS';
  const emoji        = isConditional ? '⚠️' : '✅';
  const conditionalBlock = isConditional && deviationNote ? `
    <div style="background-color:#fffbeb;border-left:4px solid #f59e0b;padding:12px 16px;border-radius:0 6px 6px 0;margin-bottom:20px;">
      <p style="margin:0 0 4px;color:#92400e;font-weight:bold;font-size:13px;">⚠️ Conditional Certificate — Deviation Note</p>
      <p style="margin:0;color:#78350f;font-size:13px;">${deviationNote}</p>
    </div>` : '';
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
      <div style="background-color:${headerColor};padding:20px;text-align:center;color:white;">
        <h2 style="margin:0;">${emoji} Certificate of Analysis Issued — ${statusLabel}</h2>
        <p style="margin:6px 0 0;font-size:13px;opacity:0.85;">QC Laboratory — Vilagio Technologies Ltd.</p>
      </div>
      <div style="padding:24px 30px;color:#334155;">
        <p>A water quality Certificate of Analysis has been signed off by <strong>${qaName}</strong>. Production may now proceed for this shift.</p>
        <div style="background-color:#f0fdf4;border:1px solid #bbf7d0;padding:15px;border-radius:6px;margin:20px 0;">
          <p style="margin:0 0 8px 0;font-size:15px;"><strong>Certificate No.: ${certNumber}</strong></p>
          <p style="margin:0 0 8px 0;"><strong>Test Reference:</strong> ${testNumber}</p>
          <p style="margin:0 0 8px 0;"><strong>Recorded By:</strong> ${analystName}</p>
          <p style="margin:0 0 8px 0;"><strong>QA Sign-off By:</strong> ${qaName}</p>
          <p style="margin:0;color:${isConditional ? '#d97706' : '#059669'};"><strong>Result:</strong> ${statusLabel}</p>
        </div>
        ${conditionalBlock}
        <div style="text-align:center;margin-top:10px;">
          <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/lab" style="background-color:${headerColor};color:white;padding:12px 28px;text-decoration:none;border-radius:6px;font-weight:bold;display:inline-block;">View Certificate in QC Lab</a>
        </div>
      </div>
      <div style="background-color:#f1f5f9;padding:12px 30px;border-top:1px solid #e2e8f0;text-align:center;">
        <p style="color:#94a3b8;font-size:11px;margin:0;">Vilagio Technologies Ltd. · www.vilag.io · GMP Compliant QC Management</p>
      </div>
    </div>`;
  await sendEmail(recipients, `[QC Lab] Certificate Issued: ${certNumber} — ${statusLabel}`, html);
};

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  sendEmail, // Exposed for custom dynamic emails from routes
  // CRM & Vendors
  notifyCustomerPendingApproval,
  notifyCustomerStatus,
  // PO
  notifyPOPendingApproval,
  notifyPOStatus,
  // Production
  notifyQAPendingReview,
  notifyBatchRejected,
  notifyLowStock,
  // QMS
  notifyQADocumentReview,
  notifyNCRAssigned,
  notifyCAPAAssigned,
  notifyAuditInvite,
  // QMS Phase 2
  notifyDocumentReviewDue,
  notifyQAReviewDueBroadcast,
  notifyDocumentOverdue,
  notifyTrainingRequired,
  // QC Lab
  notifyLabQAPendingReview,
  notifyLabTestRejected,
  notifyLabCertificateIssued,
};