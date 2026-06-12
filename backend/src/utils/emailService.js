'use strict';

const nodemailer = require('nodemailer');

/**
 * Load SMTP config from the database (app_settings table).
 * This way the client can configure email from the Settings page
 * without editing any files or rebuilding the app.
 */
async function getSmtpConfig() {
  try {
    const { query } = require('../config/database');
    const result = await query(
      'SELECT setting_key, setting_value FROM app_settings WHERE setting_key IN ($1, $2, $3, $4, $5, $6)',
      ['smtp_host', 'smtp_port', 'smtp_user', 'smtp_pass', 'smtp_from_name', 'smtp_enabled']
    );

    const cfg = {};
    result.rows.forEach(r => { cfg[r.setting_key] = r.setting_value; });
    return cfg;
  } catch {
    return {}; // DB not ready yet — return empty config
  }
}

/**
 * Create a fresh transporter using the database-stored credentials.
 * Called fresh on each email send so changes take effect immediately.
 */
async function createTransporter() {
  const cfg = await getSmtpConfig();

  if (!cfg.smtp_enabled || cfg.smtp_enabled !== '1') return null;
  if (!cfg.smtp_user || !cfg.smtp_pass) return null;

  return nodemailer.createTransport({
    host: cfg.smtp_host || 'smtp.gmail.com',
    port: parseInt(cfg.smtp_port, 10) || 587,
    secure: parseInt(cfg.smtp_port, 10) === 465,
    auth: {
      user: cfg.smtp_user,
      pass: cfg.smtp_pass,
    },
  });
}

/**
 * Send password reset email.
 * If SMTP is not configured, returns a stub so the app can fall back
 * to the local-mode token flow.
 */
async function sendPasswordResetEmail(to, resetToken, shopName) {
  // The reset URL uses localhost:5000 since the Electron app serves from there
  const resetUrl = `http://localhost:5000/reset-password?token=${resetToken}`;

  const transport = await createTransporter();

  if (!transport) {
    console.log(`[EMAIL STUB] Password reset link for ${to}: ${resetUrl}`);
    return { messageId: 'stub', resetUrl };
  }

  const cfg = await getSmtpConfig();
  const fromName = cfg.smtp_from_name || 'Hardware Shop IMS';

  const info = await transport.sendMail({
    from: `"${fromName}" <${cfg.smtp_user}>`,
    to,
    subject: 'Password Reset Request — Hardware Shop IMS',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#f8fafc;padding:20px;border-radius:12px">
        <div style="background:white;border-radius:10px;padding:30px;border:1px solid #e2e8f0">
          <h2 style="color:#1e40af;margin:0 0 20px">🔐 Password Reset Request</h2>
          <p style="color:#374151">Hello <strong>${shopName}</strong>,</p>
          <p style="color:#374151">You requested a password reset for your Hardware Shop IMS account.</p>
          <p style="color:#374151">Click the button below to reset your password. <strong>This link is valid for 1 hour.</strong></p>
          <div style="text-align:center;margin:30px 0">
            <a href="${resetUrl}"
               style="background:#1e40af;color:white;padding:14px 32px;
                      text-decoration:none;border-radius:8px;font-weight:bold;font-size:16px;display:inline-block">
              Reset My Password
            </a>
          </div>
          <p style="color:#6b7280;font-size:13px">
            Or copy this link into the app:<br/>
            <a href="${resetUrl}" style="color:#1e40af">${resetUrl}</a>
          </p>
          <p style="color:#9ca3af;font-size:12px">If you didn't request this, you can safely ignore this email.</p>
          <hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0"/>
          <p style="color:#9ca3af;font-size:11px;margin:0">Hardware Shop IMS — Inventory Management System</p>
        </div>
      </div>
    `,
  });

  return info;
}

/**
 * Send sales receipt email.
 */
async function sendReceiptEmail(to, customerName, invoiceNumber, receiptHtml) {
  const transport = await createTransporter();
  if (!transport) {
    console.log(`[EMAIL STUB] Receipt for ${to} (Invoice: ${invoiceNumber})`);
    return { messageId: 'stub' };
  }
  const cfg = await getSmtpConfig();
  return transport.sendMail({
    from: `"${cfg.smtp_from_name || 'Hardware Shop IMS'}" <${cfg.smtp_user}>`,
    to,
    subject: `Invoice #${invoiceNumber} — Hardware Shop`,
    html: receiptHtml,
  });
}

module.exports = { sendPasswordResetEmail, sendReceiptEmail };
