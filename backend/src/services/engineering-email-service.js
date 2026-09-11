const nodemailer = require('nodemailer');
const { pool } = require('./auth-service');

// Same transporter setup as supplier-email-service.js / po-email-service.js —
// reusing the existing SMTP config, not introducing a second email system.
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// Same dark-theme wrapper styling as the existing email templates —
// matches the app's own visual identity, not a new look.
const wrapEmail = (title, titleColor, bodyHtml) => `
  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #334155; border-radius: 8px; background-color: #0f172a; color: #f8fafc;">
    <h2 style="color: ${titleColor}; border-bottom: 1px solid #334155; padding-bottom: 10px;">${title}</h2>
    ${bodyHtml}
    <hr style="border-color: #334155; margin: 20px 0;" />
    <p style="font-size: 12px; color: #94a3b8;">This is an automated notification from the Vilagio Engineering module.</p>
  </div>
`;

async function getRecipients() {
  const result = await pool.query(
    `SELECT email FROM users WHERE role IN ('engineering', 'engineering_manager', 'admin') AND is_active = true`
  );
  return result.rows.map((r) => r.email);
}

class EngineeringEmailService {
  // Immediate alert — BREAKDOWN notifications only. Called without await
  // from the route handler, same fire-and-forget pattern as
  // SupplierEmailService.notifyQAPending — an email failure must never
  // fail or delay the actual notification-creation response.
  static async notifyBreakdown(notification) {
    try {
      const recipients = await getRecipients();
      if (recipients.length === 0) {
        console.log('⚠️ [Engineering Email] No active engineering/admin users to notify.');
        return;
      }

      let assetLabel = 'Unspecified asset';
      if (notification.equipment_id) {
        const eq = await pool.query(`SELECT name, equipment_code FROM equipment WHERE equipment_id = $1`, [notification.equipment_id]);
        if (eq.rows.length > 0) assetLabel = `${eq.rows[0].equipment_code} — ${eq.rows[0].name}`;
      } else if (notification.floc_id) {
        const fl = await pool.query(`SELECT name, floc_code FROM functional_locations WHERE floc_id = $1`, [notification.floc_id]);
        if (fl.rows.length > 0) assetLabel = `${fl.rows[0].floc_code} — ${fl.rows[0].name}`;
      }

      const body = `
        <p><strong>${notification.notification_number}</strong> — a breakdown has just been reported.</p>
        <p><strong>Asset/Location:</strong> ${assetLabel}</p>
        <p><strong>Description:</strong> ${notification.short_description}</p>
        ${notification.caused_unplanned_downtime ? '<p style="color:#f87171;"><strong>This has caused unplanned downtime.</strong></p>' : ''}
        <p>Please log in to the Vilagio ERP Engineering module to review and convert this into a work order.</p>
      `;

      await transporter.sendMail({
        from: process.env.EMAIL_FROM,
        to: recipients.join(','),
        subject: `🚨 Breakdown Reported: ${assetLabel} — ${notification.notification_number}`,
        html: wrapEmail('Breakdown Reported', '#f87171', body),
      });

      console.log(`✅ [Engineering Email] Breakdown alert sent for ${notification.notification_number} to: ${recipients.join(',')}`);
    } catch (error) {
      console.error('❌ [Engineering Email] Failed to send breakdown alert:', error);
    }
  }

  // Daily digest — every notification still OPEN (not yet converted,
  // closed, or rejected). Skips sending entirely if there's nothing open,
  // matching how pm-scheduler.js logs "nothing due" and returns rather
  // than sending an empty notice.
  static async sendDailyDigest() {
    try {
      const openResult = await pool.query(`
        SELECT mn.*, e.name AS equipment_name, e.equipment_code, fl.name AS floc_name, fl.floc_code
        FROM maintenance_notifications mn
        LEFT JOIN equipment e ON e.equipment_id = mn.equipment_id
        LEFT JOIN functional_locations fl ON fl.floc_id = mn.floc_id
        WHERE mn.status = 'OPEN'
        ORDER BY mn.created_at
      `);

      if (openResult.rows.length === 0) {
        console.log('🔧 [Engineering Email] No open notifications — skipping daily digest.');
        return;
      }

      const recipients = await getRecipients();
      if (recipients.length === 0) {
        console.log('⚠️ [Engineering Email] No active engineering/admin users to notify.');
        return;
      }

      const rows = openResult.rows.map((n) => {
        const asset = n.equipment_name
          ? `${n.equipment_code} — ${n.equipment_name}`
          : n.floc_name ? `${n.floc_code} — ${n.floc_name}` : '—';
        const ageDays = Math.floor((Date.now() - new Date(n.created_at).getTime()) / (1000 * 60 * 60 * 24));
        const typeColor = n.notification_type === 'BREAKDOWN' ? '#f87171' : '#60a5fa';
        return `
          <tr>
            <td style="padding:8px; border-bottom:1px solid #334155;">${n.notification_number}</td>
            <td style="padding:8px; border-bottom:1px solid #334155; color:${typeColor};">${n.notification_type.replace('_', ' ')}</td>
            <td style="padding:8px; border-bottom:1px solid #334155;">${asset}</td>
            <td style="padding:8px; border-bottom:1px solid #334155;">${n.short_description}</td>
            <td style="padding:8px; border-bottom:1px solid #334155;">${ageDays}d</td>
          </tr>
        `;
      }).join('');

      const body = `
        <p>${openResult.rows.length} notification${openResult.rows.length !== 1 ? 's' : ''} still awaiting action:</p>
        <table style="width:100%; border-collapse: collapse; margin-top: 10px; font-size: 14px;">
          <thead>
            <tr style="text-align:left; color:#94a3b8;">
              <th style="padding:8px; border-bottom:1px solid #334155;">Number</th>
              <th style="padding:8px; border-bottom:1px solid #334155;">Type</th>
              <th style="padding:8px; border-bottom:1px solid #334155;">Asset</th>
              <th style="padding:8px; border-bottom:1px solid #334155;">Description</th>
              <th style="padding:8px; border-bottom:1px solid #334155;">Open</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        <p style="margin-top:16px;">Please log in to the Vilagio ERP Engineering module to review and act on these.</p>
      `;

      await transporter.sendMail({
        from: process.env.EMAIL_FROM,
        to: recipients.join(','),
        subject: `Engineering Daily Digest — ${openResult.rows.length} open notification${openResult.rows.length !== 1 ? 's' : ''}`,
        html: wrapEmail('Engineering Daily Digest', '#60a5fa', body),
      });

      console.log(`✅ [Engineering Email] Daily digest sent (${openResult.rows.length} open) to: ${recipients.join(',')}`);
    } catch (error) {
      console.error('❌ [Engineering Email] Failed to send daily digest:', error);
    }
  }
}

module.exports = EngineeringEmailService;
