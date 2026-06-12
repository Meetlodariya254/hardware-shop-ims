'use strict';

const { query } = require('../config/database');
const { createError } = require('../middleware/errorHandler');
const nodemailer = require('nodemailer');

// ─── Helper ────────────────────────────────────────────────────────────────────
function successResponse(res, data, message = 'Success', statusCode = 200) {
  return res.status(statusCode).json({
    success: true, message, data, error: null,
    timestamp: new Date().toISOString(),
  });
}

// ─── Get All Settings ─────────────────────────────────────────────────────────
async function getSettings(req, res, next) {
  try {
    const result = await query('SELECT setting_key, setting_value, description FROM app_settings');

    // Mask the password for security
    const settings = {};
    result.rows.forEach(row => {
      settings[row.setting_key] = {
        value: row.setting_key === 'smtp_pass' && row.setting_value
          ? '••••••••••••••••'  // masked
          : (row.setting_value || ''),
        description: row.description,
      };
    });

    return successResponse(res, settings, 'Settings retrieved');
  } catch (err) {
    next(err);
  }
}

// ─── Update Settings ──────────────────────────────────────────────────────────
async function updateSettings(req, res, next) {
  try {
    const updates = req.body; // { smtp_host, smtp_port, smtp_user, smtp_pass, smtp_from_name, smtp_enabled }

    const allowedKeys = ['smtp_host', 'smtp_port', 'smtp_user', 'smtp_pass', 'smtp_from_name', 'smtp_enabled'];

    for (const [key, value] of Object.entries(updates)) {
      if (!allowedKeys.includes(key)) continue;

      // Don't overwrite password if the masked placeholder was submitted
      if (key === 'smtp_pass' && value === '••••••••••••••••') continue;

      await query(
        `UPDATE app_settings SET setting_value = $1, updated_at = CURRENT_TIMESTAMP WHERE setting_key = $2`,
        [String(value), key]
      );
    }

    return successResponse(res, null, 'Settings saved successfully');
  } catch (err) {
    next(err);
  }
}

// ─── Test Email ───────────────────────────────────────────────────────────────
async function testEmail(req, res, next) {
  try {
    const result = await query(
      'SELECT setting_key, setting_value FROM app_settings WHERE setting_key IN ($1, $2, $3, $4, $5)',
      ['smtp_host', 'smtp_port', 'smtp_user', 'smtp_pass', 'smtp_from_name']
    );

    const cfg = {};
    result.rows.forEach(r => { cfg[r.setting_key] = r.setting_value; });

    if (!cfg.smtp_user || !cfg.smtp_pass) {
      throw createError('SMTP credentials are not configured. Please enter your Gmail address and App Password first.', 400, 'SMTP_NOT_CONFIGURED');
    }

    const transporter = nodemailer.createTransport({
      host: cfg.smtp_host || 'smtp.gmail.com',
      port: parseInt(cfg.smtp_port, 10) || 587,
      secure: parseInt(cfg.smtp_port, 10) === 465,
      auth: { user: cfg.smtp_user, pass: cfg.smtp_pass },
    });

    await transporter.verify();

    await transporter.sendMail({
      from: `"${cfg.smtp_from_name || 'Hardware Shop IMS'}" <${cfg.smtp_user}>`,
      to: cfg.smtp_user, // Send to self as a test
      subject: '✅ Email Test — Hardware Shop IMS',
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
          <h2 style="color:#1e40af">✅ Email Configuration Successful!</h2>
          <p>Your email settings are working correctly.</p>
          <p>Forgot Password emails will now be sent to users when they request a password reset.</p>
          <hr/>
          <p style="color:#6b7280;font-size:12px">Hardware Shop IMS — Inventory Management System</p>
        </div>
      `,
    });

    // Mark email as enabled
    await query(
      'UPDATE app_settings SET setting_value = $1 WHERE setting_key = $2',
      ['1', 'smtp_enabled']
    );

    return successResponse(res, null, `Test email sent to ${cfg.smtp_user}. Check your inbox!`);
  } catch (err) {
    if (err.code === 'SMTP_NOT_CONFIGURED') { next(err); return; }
    next(createError(`Email test failed: ${err.message}. Please check your credentials.`, 400, 'SMTP_TEST_FAILED'));
  }
}

module.exports = { getSettings, updateSettings, testEmail };
