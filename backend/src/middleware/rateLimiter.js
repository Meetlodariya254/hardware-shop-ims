'use strict';

const rateLimit = require('express-rate-limit');

/**
 * Strict rate limiter for auth endpoints (login)
 * 5 attempts per 15 minutes
 */
const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many login attempts. Please try again after 15 minutes.',
    data: null,
    error: { code: 'RATE_LIMIT_EXCEEDED' },
    timestamp: new Date().toISOString(),
  },
  skipSuccessfulRequests: true, // Don't count successful logins
});

/**
 * General API rate limiter
 * 500 requests per 15 minutes
 */
const generalRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests. Please slow down.',
    data: null,
    error: { code: 'RATE_LIMIT_EXCEEDED' },
    timestamp: new Date().toISOString(),
  },
});

/**
 * Password reset rate limiter
 * 3 attempts per hour
 */
const passwordResetRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many password reset attempts. Please try again after 1 hour.',
    data: null,
    error: { code: 'RATE_LIMIT_EXCEEDED' },
    timestamp: new Date().toISOString(),
  },
});

module.exports = { loginRateLimiter, generalRateLimiter, passwordResetRateLimiter };
