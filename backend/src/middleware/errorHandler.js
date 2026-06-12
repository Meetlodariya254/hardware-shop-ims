'use strict';

/**
 * Global error handler middleware.
 * Must be registered last in Express middleware chain.
 */
function errorHandler(err, req, res, next) {
  console.error('Error:', err.message);
  if (process.env.NODE_ENV === 'development') {
    console.error(err.stack);
  }

  // Postgres-specific errors
  if (err.code === '23505') {
    return res.status(409).json({
      success: false,
      message: 'A record with this information already exists',
      data: null,
      error: { code: 'DUPLICATE_ENTRY', details: err.detail },
      timestamp: new Date().toISOString(),
    });
  }

  if (err.code === '23503') {
    return res.status(400).json({
      success: false,
      message: 'Referenced record does not exist',
      data: null,
      error: { code: 'FOREIGN_KEY_VIOLATION', details: err.detail },
      timestamp: new Date().toISOString(),
    });
  }

  if (err.code === '23502') {
    return res.status(400).json({
      success: false,
      message: 'A required field is missing',
      data: null,
      error: { code: 'NOT_NULL_VIOLATION', details: err.column },
      timestamp: new Date().toISOString(),
    });
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      message: 'Invalid authentication token',
      data: null,
      error: { code: 'INVALID_TOKEN' },
      timestamp: new Date().toISOString(),
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      message: 'Authentication token has expired',
      data: null,
      error: { code: 'TOKEN_EXPIRED' },
      timestamp: new Date().toISOString(),
    });
  }

  // Validation errors (from validators.js)
  if (err.isJoi) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      data: null,
      error: {
        code: 'VALIDATION_ERROR',
        details: err.details.map((d) => ({
          field: d.path.join('.'),
          message: d.message,
        })),
      },
      timestamp: new Date().toISOString(),
    });
  }

  // Application-specific known errors
  if (err.statusCode) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
      data: null,
      error: { code: err.code || 'APP_ERROR' },
      timestamp: new Date().toISOString(),
    });
  }

  // Generic server error
  res.status(500).json({
    success: false,
    message: 'Internal server error. Please try again later.',
    data: null,
    error: {
      code: 'SERVER_ERROR',
      // Only expose details in development
      ...(process.env.NODE_ENV === 'development' && { details: err.message }),
    },
    timestamp: new Date().toISOString(),
  });
}

/**
 * Helper to create application errors with status codes
 */
function createError(message, statusCode, code) {
  const err = new Error(message);
  err.statusCode = statusCode;
  err.code = code || 'APP_ERROR';
  return err;
}

module.exports = { errorHandler, createError };
