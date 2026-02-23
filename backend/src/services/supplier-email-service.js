const nodemailer = require('nodemailer');
const { pool } = require('./auth-service'); // Need DB access to look up user emails

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

class SupplierEmailService {
  
  // 1. Notify QA Team when Sales submits a new vendor
  static async notifyQAPending(vendor) {
    try {
      // Find all active QA users in the database
      const qaUsers = await pool.query("SELECT email FROM users WHERE role = 'qa' AND is_active = true");
      
      if (qaUsers.rows.length === 0) {
        console.log('⚠️ No active QA users found to notify.');
        return;
      }

      // Extract emails into a comma-separated list
      const qaEmails = qaUsers.rows.map(u => u.email).join(',');

      const mailOptions = {
        from: process.env.EMAIL_FROM,
        to: qaEmails,
        subject: `Action Required: New Supplier Awaiting QA - ${vendor.legal_name}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #334155; border-radius: 8px; background-color: #0f172a; color: #f8fafc;">
            <h2 style="color: #60a5fa; border-bottom: 1px solid #334155; padding-bottom: 10px;">New Supplier Assessment Ready for Review</h2>
            <p>A new supplier registration for <strong>${vendor.legal_name}</strong> has been submitted by the Sales team and is awaiting your verification.</p>
            <p><strong>Primary Category:</strong> ${vendor.primary_category}</p>
            <br/>
            <p>Please log in to the Vilagio ERP to execute the QA Review, verify the documentation, and assign a VTL Supplier ID.</p>
            <hr style="border-color: #334155; margin: 20px 0;" />
            <p style="font-size: 12px; color: #94a3b8;">This is an automated notification from the Vilagio Vendor Management System.</p>
          </div>
        `
      };

      await transporter.sendMail(mailOptions);
      console.log(`✅ QA Notification emailed successfully to: ${qaEmails}`);
    } catch (error) {
      console.error('❌ Failed to send QA notification email:', error);
    }
  }

  // 2. Notify Sales User when QA approves or rejects their vendor
  static async notifySalesResult(vendor, action) {
    try {
      // Find the specific Sales user who created this vendor draft
      const creator = await pool.query("SELECT email, full_name FROM users WHERE user_id = $1", [vendor.created_by]);
      
      if (creator.rows.length === 0) return;
      
      const salesEmail = creator.rows[0].email;
      const isApproved = action === 'APPROVED' || action === 'CONDITIONALLY_APPROVED';
      const statusColor = isApproved ? '#4ade80' : '#fb923c'; // Green or Orange

      const mailOptions = {
        from: process.env.EMAIL_FROM,
        to: salesEmail,
        subject: `Supplier Assessment ${isApproved ? 'Approved' : 'Rejected'} - ${vendor.legal_name}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #334155; border-radius: 8px; background-color: #0f172a; color: #f8fafc;">
            <h2 style="color: ${statusColor}; border-bottom: 1px solid #334155; padding-bottom: 10px;">
              Supplier Assessment Update
            </h2>
            <p>Hello ${creator.rows[0].full_name},</p>
            <p>The supplier registration for <strong>${vendor.legal_name}</strong> has been <strong>${action.replace('_', ' ')}</strong> by the QA team.</p>
            
            ${isApproved 
              ? `<p><strong>VTL Supplier ID:</strong> <span style="color: #60a5fa; font-family: monospace; font-size: 16px;">${vendor.vtl_supplier_id}</span></p>
                 <p>This vendor is now active on the Approved Vendor List (AVL) and is eligible for Purchase Orders.</p>` 
              : `<p style="color: #fb923c;"><strong>Action Required:</strong> Please review the QA notes below, make the necessary corrections, and resubmit the vendor.</p>`
            }
            
            ${vendor.qa_notes ? `<div style="background-color: #1e293b; padding: 15px; border-left: 4px solid ${statusColor}; margin-top: 15px;"><strong>QA Notes:</strong><br/>${vendor.qa_notes}</div>` : ''}
            
            <hr style="border-color: #334155; margin: 20px 0;" />
            <p style="font-size: 12px; color: #94a3b8;">This is an automated notification from the Vilagio Vendor Management System.</p>
          </div>
        `
      };

      await transporter.sendMail(mailOptions);
      console.log(`✅ Sales Notification emailed successfully to: ${salesEmail}`);
    } catch (error) {
      console.error('❌ Failed to send Sales notification email:', error);
    }
  }
}

module.exports = SupplierEmailService;