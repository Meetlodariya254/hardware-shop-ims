-- ─── App Settings Table ──────────────────────────────────────────────────────
-- Stores configurable settings like SMTP credentials in the database
-- so clients don't need to edit any files.

CREATE TABLE IF NOT EXISTS app_settings (
  setting_key   TEXT PRIMARY KEY NOT NULL,
  setting_value TEXT,
  description   TEXT,
  updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default SMTP settings (empty — client fills these in Settings page)
INSERT OR IGNORE INTO app_settings (setting_key, setting_value, description) VALUES
  ('smtp_host',      'smtp.gmail.com',      'SMTP server hostname'),
  ('smtp_port',      '587',                 'SMTP server port (587 for TLS, 465 for SSL)'),
  ('smtp_user',      '',                    'Your Gmail address (e.g. yourshop@gmail.com)'),
  ('smtp_pass',      '',                    'Gmail App Password (16-character code from Google Account)'),
  ('smtp_from_name', 'Hardware Shop IMS',   'Display name shown in sent emails'),
  ('smtp_enabled',   '0',                   'Set to 1 to enable email notifications');
