'use strict';

require('dotenv').config();

const requiredEnvVars = [
  'JWT_SECRET',
  'JWT_REFRESH_SECRET',
  'JWT_RESET_SECRET',
];

// Warn about missing optional env vars in production
const optionalEnvVars = [
  'SMTP_HOST',
  'SMTP_USER',
  'SMTP_PASS',
];

const WEAK_DEFAULT_SECRETS = [
  'local-offline-jwt-secret-key-1234567890',
  'local-offline-refresh-secret-key-1234567890',
  'local-offline-reset-secret-key-1234567890',
];

function validateEnvironment() {
  if (process.env.NODE_ENV === 'production') {
    const missingOptional = optionalEnvVars.filter((key) => !process.env[key]);
    if (missingOptional.length > 0) {
      console.warn(`Warning: Optional env vars not set: ${missingOptional.join(', ')}`);
    }

    // In production, reject weak/default secrets
    const activeSecret = process.env.JWT_SECRET || '';
    if (WEAK_DEFAULT_SECRETS.includes(activeSecret) || activeSecret.length < 32) {
      throw new Error('FATAL: JWT_SECRET is insecure. Use a strong random secret (≥32 chars) in production.');
    }
  } else {
    // In development, warn if using default secrets
    const usingDefaults = !process.env.JWT_SECRET || WEAK_DEFAULT_SECRETS.includes(process.env.JWT_SECRET);
    if (usingDefaults) {
      console.warn('⚠️  [DEV] Using default JWT secrets — OK for development only. Set strong secrets before deploying.');
    }
  }
}

const config = {
  node_env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 5000,


  jwt: {
    secret: process.env.JWT_SECRET || 'local-offline-jwt-secret-key-1234567890',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'local-offline-refresh-secret-key-1234567890',
    resetSecret: process.env.JWT_RESET_SECRET || 'local-offline-reset-secret-key-1234567890',
    expire: process.env.JWT_EXPIRE || '24h',
    refreshExpire: process.env.JWT_REFRESH_EXPIRE || '7d',
  },

  cors: {
    frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  },

  email: {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT, 10) || 587,
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.SMTP_FROM || 'noreply@hardwareshop.com',
  },

  app: {
    name: process.env.APP_NAME || 'Hardware Shop IMS',
    sessionTimeout: parseInt(process.env.SESSION_TIMEOUT, 10) || 1800000, // 30 min
  },

  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 900000, // 15 min
    max: parseInt(process.env.RATE_LIMIT_MAX, 10) || 5,
  },
};

module.exports = { config, validateEnvironment };
