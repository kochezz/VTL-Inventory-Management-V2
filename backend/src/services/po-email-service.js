const nodemailer = require('nodemailer');
const { pool } = require('./auth-service'); // We need DB access to look up emails and PO details

// Initialize the mailer using your existing Resend .env credentials
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

class POEmailService {
  
  // Helper to grab rich PO data for the email templates
  static async getPODetailsForEmail(poId) {
    const res = await pool.query(`
      SELECT p.po_number, p.total_amount, p.currency, p.status, p.raised_by,
             v.legal_name as vendor_name, u.full_name as creator_name, u.email as creator_email
      FROM purchase_orders p
      JOIN vendors v ON p.vendor_id = v.vendor_id
      JOIN users u ON p.raised_by = u.user_id
      WHERE p.po_id = $1
    `, [poId]);
    return res.rows[0];
  }

  // 1. Notify CFO or CEO that a PO needs their approval
  static async notifyPendingApproval(poId, targetRole) {
    try {
      const po = await this.getPODetailsForEmail(poId);
      if (!po) return;

      // Find all active users in the target role (CFO or CEO)
      const approvers = await pool.query("SELECT email FROM users WHERE role = $1 AND is_active = true", [targetRole.toLowerCase()]);
      
      if (approvers.rows.length === 0) {
        console.log(`⚠️ No active ${targetRole.toUpperCase()} users found to notify.`);
        return;
      }

      const approverEmails = approvers.rows.map(u => u.email).join(',');

      const mailOptions = {
        from: process.env.EMAIL_FROM,
        to: approverEmails,
        subject: `Action Required: PO Approval Needed - ${po.po_number}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #334155; border-radius: 8px; background-color: #0f172a; color: #f8fafc;">
            <h2 style="color: #60a5fa; border-bottom: 1px solid #334155; padding-bottom: 10px;">Purchase Order Awaiting Your Approval</h2>
            <p>A new Purchase Order has been raised by <strong>${po.creator_name}</strong> and requires your digital signature.</p>
            
            <table style="width: 100%; margin: 20px 0; border-collapse: collapse;">
              <tr><td style="padding: 8px; border-bottom: 1px solid #1e293b; color: #94a3b8;">PO Number:</td><td style="padding: 8px; border-bottom: 1px solid #1e293b; font-family: monospace; font-size: 16px; color: #f8fafc;">${po.po_number}</td></tr>
              <tr><td style="padding: 8px; border-bottom: 1px solid #1e293b; color: #94a3b8;">Vendor:</td><td style="padding: 8px; border-bottom: 1px solid #1e293b; font-weight: bold; color: #f8fafc;">${po.vendor_name}</td></tr>
              <tr><td style="padding: 8px; border-bottom: 1px solid #1e293b; color: #94a3b8;">Total Value:</td><td style="padding: 8px; border-bottom: 1px solid #1e293b; color: #f8fafc;">${po.currency} ${parseFloat(po.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td></tr>
            </table>
            
            <p>Please log in to the Vilagio ERP to view the attached PDF quotation and execute your approval.</p>
            <hr style="border-color: #334155; margin: 20px 0;" />
            <p style="font-size: 12px; color: #94a3b8;">This is an automated notification from the Vilagio Procurement System.</p>
          </div>
        `
      };

      await transporter.sendMail(mailOptions);
      console.log(`✅ PO Approval Notification emailed successfully to: ${approverEmails}`);
    } catch (error) {
      console.error('❌ Failed to send PO approval notification email:', error);
    }
  }

  // 2. Notify the Sales/Creator when their PO is Fully Approved or Rejected
  static async notifyPOResult(poId, action, reason = '') {
    try {
      const po = await this.getPODetailsForEmail(poId);
      if (!po) return;
      
      const isApproved = action === 'APPROVED';
      const statusColor = isApproved ? '#4ade80' : '#fb923c'; 
      const actionText = isApproved ? 'Fully Approved' : 'Rejected';

      const mailOptions = {
        from: process.env.EMAIL_FROM,
        to: po.creator_email,
        subject: `Purchase Order ${actionText} - ${po.po_number}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #334155; border-radius: 8px; background-color: #0f172a; color: #f8fafc;">
            <h2 style="color: ${statusColor}; border-bottom: 1px solid #334155; padding-bottom: 10px;">
              Purchase Order Update
            </h2>
            <p>Hello ${po.creator_name},</p>
            <p>Your Purchase Order <strong>${po.po_number}</strong> for <strong>${po.vendor_name}</strong> has been <strong>${actionText.toLowerCase()}</strong> by management.</p>
            
            ${isApproved 
              ? `<p>This PO is now officially authorized. The PDF document can now be sent to the vendor, and the Warehouse has been notified to expect the delivery.</p>` 
              : `<p style="color: #fb923c;"><strong>Action Required:</strong> Please review the rejection notes below and create a new PO if necessary.</p>`
            }
            
            ${reason ? `<div style="background-color: #1e293b; padding: 15px; border-left: 4px solid ${statusColor}; margin-top: 15px;"><strong>Management Notes:</strong><br/>${reason}</div>` : ''}
            
            <hr style="border-color: #334155; margin: 20px 0;" />
            <p style="font-size: 12px; color: #94a3b8;">This is an automated notification from the Vilagio Procurement System.</p>
          </div>
        `
      };

      await transporter.sendMail(mailOptions);
      console.log(`✅ PO Result Notification emailed successfully to: ${po.creator_email}`);
    } catch (error) {
      console.error('❌ Failed to send PO result notification email:', error);
    }
  }
}

module.exports = POEmailService;