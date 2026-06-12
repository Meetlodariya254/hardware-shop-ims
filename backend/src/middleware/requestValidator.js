'use strict';

/**
 * Factory function that returns a validation middleware using the provided Joi schema.
 * Validates req.body by default, or req.query for GET requests.
 */
function validate(schema, target = 'body') {
  return (req, res, next) => {
    const data = target === 'query' ? req.query : req.body;

    const { error, value } = schema.validate(data, {
      abortEarly: false, // Return all errors, not just the first
      stripUnknown: true, // Remove unknown fields
    });

    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        data: null,
        error: {
          code: 'VALIDATION_ERROR',
          details: error.details.map((d) => ({
            field: d.path.join('.'),
            message: d.message.replace(/['"]/g, ''),
          })),
        },
        timestamp: new Date().toISOString(),
      });
    }

    // Replace the body/query with cleaned (stripped unknown) value
    if (target === 'query') {
      req.query = value;
    } else {
      req.body = value;
    }

    next();
  };
}

module.exports = { validate };
