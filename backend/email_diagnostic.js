// ============================================================================
// EMAIL DIAGNOSTIC SCRIPT
// backend/email_diagnostic.js
// ============================================================================
// Run this from your backend folder:
//   node email_diagnostic.js
//
// It will tell you exactly why the email is not sending.
// ============================================================================

require('dotenv').config();
const { pool } = require('./src/config/database');

async function runDiagnostic() {
  console.log('\n============================================================');
  console.log('  VILAGIO ERP — Email Notification Diagnostic');
  console.log('============================================================\n');

  // ── 1. Check SMTP environment variables ────────────────────────────────────
  console.log('STEP 1: SMTP Environment Variables');
  console.log('------------------------------------------------------------');
  const smtpVars = {
    SMTP_HOST:  process.env.SMTP_HOST,
    SMTP_PORT:  process.env.SMTP_PORT,
    SMTP_USER:  process.env.SMTP_USER,
    SMTP_PASS:  process.env.SMTP_PASS ? '*** (set)' : '❌ NOT SET',
    EMAIL_FROM: process.env.EMAIL_FROM,
    FRONTEND_URL: process.env.FRONTEND_URL,
  };

  let smtpOk = true;
  for (const [key, val] of Object.entries(smtpVars)) {
    const status = val ? '✅' : '❌ MISSING';
    if (!val) smtpOk = false;
    console.log(`  ${status}  ${key} = ${val || 'NOT SET'}`);
  }

  if (!smtpOk) {
    console.log('\n  ⚠️  SMTP vars are missing. Add them to your .env / Render environment.\n');
  }

  // ── 2. Check who would receive the QA lab notification ────────────────────
  console.log('\nSTEP 2: Recipients for notifyLabQAPendingReview');
  console.log('  (queries users WHERE role IN (\'qa\', \'admin\') AND is_active = true)');
  console.log('------------------------------------------------------------');
  try {
    const result = await pool.query(`
      SELECT user_id, full_name, email, role, is_active
      FROM users
      WHERE role = ANY($1) AND is_active = true
      ORDER BY role, full_name
    `, [['qa', 'admin']]);

    if (result.rows.length === 0) {
      console.log('  ❌ NO RECIPIENTS FOUND — no active users with role qa or admin!');
      console.log('  This is why no email was sent. Fix the role or add the email.');
    } else {
      console.log(`  ✅ ${result.rows.length} recipient(s) found:`);
      result.rows.forEach(u => {
        console.log(`     • ${u.full_name} (${u.role}) — ${u.email}`);
      });
    }
  } catch (err) {
    console.log('  ❌ Database query failed:', err.message);
  }

  // ── 3. Check your own user's role ─────────────────────────────────────────
  console.log('\nSTEP 3: Admin user details');
  console.log('------------------------------------------------------------');
  try {
    const result = await pool.query(`
      SELECT user_id, full_name, email, role, is_active
      FROM users
      WHERE email = 'admin@vilag.io'
      LIMIT 1
    `);
    if (result.rows.length === 0) {
      console.log('  ❌ admin@vilag.io not found in users table');
    } else {
      const u = result.rows[0];
      console.log(`  User:   ${u.full_name}`);
      console.log(`  Email:  ${u.email}`);
      console.log(`  Role:   ${u.role}`);
      console.log(`  Active: ${u.is_active}`);
      if (!['qa', 'admin'].includes(u.role)) {
        console.log(`  ⚠️  Role '${u.role}' is NOT in the qa/admin query — email won't be sent to this user`);
      } else if (!u.is_active) {
        console.log(`  ⚠️  User is inactive — won't receive emails`);
      } else {
        console.log(`  ✅ This user should receive QA lab notifications`);
      }
    }
  } catch (err) {
    console.log('  ❌ Database query failed:', err.message);
  }

  // ── 4. Test SMTP connection ────────────────────────────────────────────────
  console.log('\nSTEP 4: SMTP Connection Test');
  console.log('------------------------------------------------------------');
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.log('  ⏭️  Skipped — SMTP vars not configured (see Step 1)');
  } else {
    try {
      const nodemailer = require('nodemailer');
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_PORT == 465,
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      });
      await transporter.verify();
      console.log('  ✅ SMTP connection verified successfully');
    } catch (err) {
      console.log('  ❌ SMTP connection FAILED:', err.message);
      console.log('  Check your SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS values');
    }
  }

  // ── 5. Send a test email ───────────────────────────────────────────────────
  console.log('\nSTEP 5: Send Test Email');
  console.log('------------------------------------------------------------');
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS || !process.env.EMAIL_FROM) {
    console.log('  ⏭️  Skipped — SMTP not configured');
  } else {
    try {
      const nodemailer = require('nodemailer');
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_PORT == 465,
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      });

      // Get the admin email to send the test to
      const adminResult = await pool.query(
        `SELECT email FROM users WHERE role = ANY($1) AND is_active = true LIMIT 1`,
        [['qa', 'admin']]
      );

      if (adminResult.rows.length === 0) {
        console.log('  ⏭️  No QA/admin users to send test to');
      } else {
        const testRecipient = adminResult.rows[0].email;
        await transporter.sendMail({
          from: `"Vilagio ERP Test" <${process.env.EMAIL_FROM}>`,
          to: testRecipient,
          subject: '[VTL ERP] ✅ Email Diagnostic Test — Notifications Working',
          html: `
            <div style="font-family: Arial, sans-serif; padding: 20px; border: 2px solid #10b981; border-radius: 8px; max-width: 500px;">
              <h2 style="color: #059669;">✅ Email Test Successful</h2>
              <p>This confirms the Vilagio ERP notification system can reach <strong>${testRecipient}</strong>.</p>
              <p style="color: #64748b; font-size: 13px;">Sent by: email_diagnostic.js — ${new Date().toLocaleString()}</p>
            </div>
          `,
        });
        console.log(`  ✅ Test email sent to: ${testRecipient}`);
        console.log('  Check your inbox (and spam folder)');
      }
    } catch (err) {
      console.log('  ❌ Test email FAILED:', err.message);
    }
  }

  console.log('\n============================================================');
  console.log('  Diagnostic complete. Check results above.');
  console.log('============================================================\n');

  await pool.end();
  process.exit(0);
}

runDiagnostic().catch(err => {
  console.error('Diagnostic script crashed:', err);
  process.exit(1);
});
