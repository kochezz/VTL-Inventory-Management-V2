const { Resend } = require('resend');
const { pool } = require('./auth-service');

// Resend HTTP API — matches notification-service.js's proven pattern.
// Render blocks outbound SMTP (ETIMEDOUT on port 587); Resend uses
// HTTPS port 443, which is always open. Do NOT revert to nodemailer.
const resend = new Resend(process.env.SMTP_PASS);

const FROM_ADDRESS = process.env.EMAIL_FROM
  ? `Vilagio ERP <${process.env.EMAIL_FROM}>`
  : 'Vilagio ERP <noreply@vilag.io>';

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

// Shared by every function below — resolves an equipment_id/floc_id pair
// into a human-readable label. Was duplicated inline before; now one
// place to get it right.
async function resolveAssetLabel(equipmentId, flocId) {
  if (equipmentId) {
    const eq = await pool.query(`SELECT name, equipment_code FROM equipment WHERE equipment_id = $1`, [equipmentId]);
    if (eq.rows.length > 0) return `${eq.rows[0].equipment_code} — ${eq.rows[0].name}`;
  } else if (flocId) {
    const fl = await pool.query(`SELECT name, floc_code FROM functional_locations WHERE floc_id = $1`, [flocId]);
    if (fl.rows.length > 0) return `${fl.rows[0].floc_code} — ${fl.rows[0].name}`;
  }
  return 'Unspecified asset';
}

async function send({ subject, title, titleColor, bodyHtml, recipients, logLabel }) {
  if (recipients.length === 0) {
    console.log(`⚠️ [Engineering Email] No active engineering/admin users to notify for ${logLabel}.`);
    return;
  }
  try {
    const { data, error } = await resend.emails.send({
      from: FROM_ADDRESS,
      to: recipients,
      subject,
      html: wrapEmail(title, titleColor, bodyHtml),
    });
    if (error) {
      console.error(`❌ [Engineering Email] Failed to send ${logLabel}:`, error);
    } else {
      console.log(`✅ [Engineering Email] ${logLabel} sent to: ${recipients.join(',')} [id: ${data?.id}]`);
    }
  } catch (error) {
    console.error(`❌ [Engineering Email] Failed to send ${logLabel}:`, error);
  }
}

class EngineeringEmailService {
  // Instant alert for EVERY new notification — Breakdown AND Maintenance
  // Request both fire immediately now. Styling/urgency differs by type;
  // the trigger no longer does.
  static async notifyNewIssue(notification) {
    const recipients = await getRecipients();
    const assetLabel = await resolveAssetLabel(notification.equipment_id, notification.floc_id);
    const isBreakdown = notification.notification_type === 'BREAKDOWN';

    let reporterName = 'Unknown';
    if (notification.reported_by) {
      const u = await pool.query(`SELECT full_name FROM users WHERE user_id = $1`, [notification.reported_by]);
      if (u.rows.length > 0) reporterName = u.rows[0].full_name;
    }

    const body = `
      <p><strong>${notification.notification_number}</strong> — ${isBreakdown ? 'a breakdown' : 'a maintenance request'} has just been reported by ${reporterName}.</p>
      <p><strong>Asset/Location:</strong> ${assetLabel}</p>
      <p><strong>Description:</strong> ${notification.short_description}</p>
      ${notification.caused_unplanned_downtime ? '<p style="color:#f87171;"><strong>This has caused unplanned downtime.</strong></p>' : ''}
      <p>Please log in to the Vilagio ERP Engineering module to review and convert this into a work order.</p>
    `;

    await send({
      subject: isBreakdown
        ? `🚨 Breakdown Reported: ${assetLabel} — ${notification.notification_number}`
        : `Maintenance Request: ${assetLabel} — ${notification.notification_number}`,
      title: isBreakdown ? 'Breakdown Reported' : 'Maintenance Request Reported',
      titleColor: isBreakdown ? '#f87171' : '#60a5fa',
      bodyHtml: body,
      recipients,
      logLabel: `new-issue alert for ${notification.notification_number}`,
    });
  }

  // Fires when ANY work order is created — whether raised directly or
  // converted from a notification (both paths go through the same
  // createWorkOrder() call, so one trigger point covers both).
  static async notifyWorkOrderCreated(workOrder) {
    const recipients = await getRecipients();
    const assetLabel = await resolveAssetLabel(workOrder.equipment_id, workOrder.floc_id);

    let createdByName = 'Unknown';
    if (workOrder.created_by) {
      const u = await pool.query(`SELECT full_name FROM users WHERE user_id = $1`, [workOrder.created_by]);
      if (u.rows.length > 0) createdByName = u.rows[0].full_name;
    }

    const body = `
      <p><strong>${workOrder.wo_number}</strong> has been raised by ${createdByName}.</p>
      <p><strong>Type:</strong> ${workOrder.order_type.replace('_', ' ')} &nbsp; <strong>Priority:</strong> ${workOrder.priority}</p>
      <p><strong>Asset/Location:</strong> ${assetLabel}</p>
      <p><strong>Description:</strong> ${workOrder.short_description}</p>
      <p>Currently in <strong>${workOrder.status}</strong> status. Log in to the Vilagio ERP Engineering module to review.</p>
    `;

    await send({
      subject: `New Work Order: ${workOrder.wo_number} — ${assetLabel}`,
      title: 'New Work Order Raised',
      titleColor: '#60a5fa',
      bodyHtml: body,
      recipients,
      logLabel: `work order created alert for ${workOrder.wo_number}`,
    });
  }

  // Fires specifically when a work order's status transitions to
  // APPROVED (the manager-only-gated transition).
  static async notifyWorkOrderApproved(workOrder) {
    const recipients = await getRecipients();
    const assetLabel = await resolveAssetLabel(workOrder.equipment_id, workOrder.floc_id);

    const body = `
      <p><strong>${workOrder.wo_number}</strong> has been approved and is ready to be scheduled and executed.</p>
      <p><strong>Asset/Location:</strong> ${assetLabel}</p>
      <p><strong>Description:</strong> ${workOrder.short_description}</p>
      <p>Log in to the Vilagio ERP Engineering module to schedule and begin work.</p>
    `;

    await send({
      subject: `Work Order Approved: ${workOrder.wo_number} — ${assetLabel}`,
      title: 'Work Order Approved',
      titleColor: '#4ade80',
      bodyHtml: body,
      recipients,
      logLabel: `work order approved alert for ${workOrder.wo_number}`,
    });
  }

  // Unchanged — daily digest of everything still OPEN, regardless of
  // whether it already triggered an instant alert. This remains a
  // useful reminder for anything not yet acted on, not just a fallback
  // for types that lacked an instant alert.
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

      const { data, error } = await resend.emails.send({
        from: FROM_ADDRESS,
        to: recipients,
        subject: `Engineering Daily Digest — ${openResult.rows.length} open notification${openResult.rows.length !== 1 ? 's' : ''}`,
        html: wrapEmail('Engineering Daily Digest', '#60a5fa', body),
      });

      if (error) {
        console.error('❌ [Engineering Email] Failed to send daily digest:', error);
      } else {
        console.log(`✅ [Engineering Email] Daily digest sent (${openResult.rows.length} open) to: ${recipients.join(',')} [id: ${data?.id}]`);
      }
    } catch (error) {
      console.error('❌ [Engineering Email] Failed to send daily digest:', error);
    }
  }
}

module.exports = EngineeringEmailService;
