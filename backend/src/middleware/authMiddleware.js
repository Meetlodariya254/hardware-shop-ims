'use strict';

const { verifyAccessToken } = require('../utils/tokenUtils');

/**
 * Middleware to verify JWT access token and attach user info to request.
 */
function authenticate(req, res, next) {
  const authHeader = req.headers['authorization'];
  let token = null;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  } else if (req.cookies && req.cookies.access_token) {
    token = req.cookies.access_token;
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'No token provided. Please log in.',
      data: null,
      error: { code: 'NO_TOKEN' },
      timestamp: new Date().toISOString(),
    });
  }

  try {
    const decoded = verifyAccessToken(token);
    req.user = {
      user_id: decoded.user_id,
      email: decoded.email,
    };
    next();
  } catch (err) {
    let message = 'Invalid token. Please log in again.';
    let code = 'INVALID_TOKEN';

    if (err.name === 'TokenExpiredError') {
      message = 'Token expired. Please refresh your session.';
      code = 'TOKEN_EXPIRED';
    }

    return res.status(401).json({
      success: false,
      message,
      data: null,
      error: { code },
      timestamp: new Date().toISOString(),
    });
  }
}

module.exports = { authenticate };
