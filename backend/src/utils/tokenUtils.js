'use strict';

const jwt = require('jsonwebtoken');
const { config } = require('../config/environment');

/**
 * Generate an access token (short-lived)
 */
function generateAccessToken(payload) {
  return jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.expire,
    issuer: 'hardware-shop-ims',
  });
}

/**
 * Generate a refresh token (long-lived)
 */
function generateRefreshToken(payload) {
  return jwt.sign(payload, config.jwt.refreshSecret, {
    expiresIn: config.jwt.refreshExpire,
    issuer: 'hardware-shop-ims',
  });
}

/**
 * Verify an access token
 */
function verifyAccessToken(token) {
  return jwt.verify(token, config.jwt.secret, {
    issuer: 'hardware-shop-ims',
  });
}

/**
 * Verify a refresh token
 */
function verifyRefreshToken(token) {
  return jwt.verify(token, config.jwt.refreshSecret, {
    issuer: 'hardware-shop-ims',
  });
}

/**
 * Generate a short-lived token for password reset (1 hour)
 */
function generatePasswordResetToken(payload) {
  return jwt.sign(payload, config.jwt.resetSecret, {
    expiresIn: '1h',
    issuer: 'hardware-shop-ims-reset',
  });
}

/**
 * Verify a password reset token
 */
function verifyPasswordResetToken(token) {
  return jwt.verify(token, config.jwt.resetSecret, {
    issuer: 'hardware-shop-ims-reset',
  });
}

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  generatePasswordResetToken,
  verifyPasswordResetToken,
};
