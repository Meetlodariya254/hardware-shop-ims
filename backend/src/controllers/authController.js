'use strict';

const { query, withTransaction } = require('../config/database');
const { hashPassword, comparePassword } = require('../utils/passwordUtils');
const {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  generatePasswordResetToken,
  verifyPasswordResetToken,
} = require('../utils/tokenUtils');
const { sendPasswordResetEmail } = require('../utils/emailService');
const { createError } = require('../middleware/errorHandler');

// ─── Helper ────────────────────────────────────────────────────────────────────

function successResponse(res, data, message = 'Success', statusCode = 200) {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
    error: null,
    timestamp: new Date().toISOString(),
  });
}

function setAuthCookies(res, accessToken, refreshToken) {
  const isProduction = process.env.NODE_ENV === 'production';
  
  res.cookie('access_token', accessToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'strict' : 'lax',
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
  });

  res.cookie('refresh_token', refreshToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'strict' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });
}

// ─── Register ─────────────────────────────────────────────────────────────────

async function register(req, res, next) {
  try {
    const {
      email, password, shop_owner_name, shop_name,
      phone_number, address, city, gst_number,
    } = req.body;

    // Check if email already exists
    const existing = await query('SELECT user_id FROM users WHERE email = $1', [email.toLowerCase()]);
    if (existing.rows.length > 0) {
      throw createError('An account with this email already exists', 409, 'EMAIL_EXISTS');
    }

    const password_hash = await hashPassword(password);

    const result = await query(
      `INSERT INTO users 
        (email, password_hash, shop_owner_name, shop_name, phone_number, address, city, gst_number)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING user_id, email, shop_owner_name, shop_name, phone_number, city, gst_number, created_at`,
      [
        email.toLowerCase(), password_hash, shop_owner_name,
        shop_name || null, phone_number || null, address || null,
        city || null, gst_number || null,
      ]
    );

    const user = result.rows[0];

    const tokenPayload = { user_id: user.user_id, email: user.email };
    const accessToken = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);

    setAuthCookies(res, accessToken, refreshToken);

    return successResponse(res, {
      user,
    }, 'Account created successfully', 201);
  } catch (err) {
    next(err);
  }
}

// ─── Login ────────────────────────────────────────────────────────────────────

async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    const result = await query(
      `SELECT user_id, email, password_hash, shop_owner_name, shop_name, 
              phone_number, city, gst_number, address, is_active 
       FROM users WHERE email = $1`,
      [email.toLowerCase()]
    );

    if (result.rows.length === 0) {
      throw createError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
    }

    const user = result.rows[0];

    if (!user.is_active) {
      throw createError('Your account has been deactivated. Please contact support.', 401, 'ACCOUNT_INACTIVE');
    }

    const isValid = await comparePassword(password, user.password_hash);
    if (!isValid) {
      throw createError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
    }

    // Update last login
    await query('UPDATE users SET last_login = NOW() WHERE user_id = $1', [user.user_id]);

    const { password_hash, ...userWithoutPassword } = user;
    const tokenPayload = { user_id: user.user_id, email: user.email };
    const accessToken = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);

    setAuthCookies(res, accessToken, refreshToken);

    return successResponse(res, {
      user: userWithoutPassword,
    }, 'Login successful');
  } catch (err) {
    next(err);
  }
}

// ─── Refresh Token ────────────────────────────────────────────────────────────

async function refreshToken(req, res, next) {
  try {
    const refresh_token = req.cookies.refresh_token || req.body.refresh_token;

    if (!refresh_token) {
      throw createError('Refresh token is required', 400, 'NO_REFRESH_TOKEN');
    }

    let decoded;
    try {
      decoded = verifyRefreshToken(refresh_token);
    } catch (err) {
      throw createError('Invalid or expired refresh token', 401, 'INVALID_REFRESH_TOKEN');
    }

    // Verify user still exists and is active
    const result = await query(
      'SELECT user_id, email, is_active FROM users WHERE user_id = $1',
      [decoded.user_id]
    );

    if (result.rows.length === 0 || !result.rows[0].is_active) {
      throw createError('User account not found or inactive', 401, 'USER_NOT_FOUND');
    }

    const user = result.rows[0];
    const tokenPayload = { user_id: user.user_id, email: user.email };
    const newAccessToken = generateAccessToken(tokenPayload);
    const newRefreshToken = generateRefreshToken(tokenPayload);

    setAuthCookies(res, newAccessToken, newRefreshToken);

    return successResponse(res, null, 'Token refreshed successfully');
  } catch (err) {
    next(err);
  }
}

// ─── Logout ───────────────────────────────────────────────────────────────────

async function logout(req, res, next) {
  try {
    res.clearCookie('access_token');
    res.clearCookie('refresh_token');
    return successResponse(res, null, 'Logged out successfully');
  } catch (err) {
    next(err);
  }
}

// ─── Forgot Password ──────────────────────────────────────────────────────────

async function forgotPassword(req, res, next) {
  try {
    const { email } = req.body;

    const result = await query(
      'SELECT user_id, email, shop_owner_name FROM users WHERE email = $1 AND is_active = 1',
      [email.toLowerCase()]
    );

    // Always return success to prevent email enumeration
    if (result.rows.length === 0) {
      return successResponse(res, null, 'If an account exists with this email, a reset link has been sent.');
    }

    const user = result.rows[0];
    const resetToken = generatePasswordResetToken({ user_id: user.user_id, type: 'password_reset' });

    const emailResult = await sendPasswordResetEmail(user.email, resetToken, user.shop_owner_name);

    // If SMTP is not configured (local desktop app), include the reset token
    // directly in the response so the frontend can navigate to the reset page immediately.
    const responseData = emailResult?.messageId === 'stub'
      ? { resetToken, localMode: true }
      : null;

    const message = responseData
      ? 'Redirecting you to the password reset page...'
      : 'Password reset link has been sent to your email.';

    return successResponse(res, responseData, message);
  } catch (err) {
    next(err);
  }
}

// ─── Reset Password ───────────────────────────────────────────────────────────


async function resetPassword(req, res, next) {
  try {
    const { token, new_password } = req.body;

    let decoded;
    try {
      decoded = verifyPasswordResetToken(token);
    } catch (err) {
      throw createError('Password reset link is invalid or has expired', 400, 'INVALID_RESET_TOKEN');
    }

    if (decoded.type !== 'password_reset') {
      throw createError('Invalid reset token type', 400, 'INVALID_RESET_TOKEN');
    }

    const password_hash = await hashPassword(new_password);

    const result = await query(
      'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE user_id = $2 RETURNING user_id',
      [password_hash, decoded.user_id]
    );

    if (result.rows.length === 0) {
      throw createError('User not found', 404, 'USER_NOT_FOUND');
    }

    return successResponse(res, null, 'Password has been reset successfully. Please log in.');
  } catch (err) {
    next(err);
  }
}

// ─── Get Profile ─────────────────────────────────────────────────────────────

async function getProfile(req, res, next) {
  try {
    const result = await query(
      `SELECT user_id, email, shop_owner_name, shop_name, phone_number, 
              address, city, gst_number, last_login, created_at
       FROM users WHERE user_id = $1`,
      [req.user.user_id]
    );

    if (result.rows.length === 0) {
      throw createError('User not found', 404, 'USER_NOT_FOUND');
    }

    return successResponse(res, result.rows[0], 'Profile retrieved successfully');
  } catch (err) {
    next(err);
  }
}

// ─── Update Profile ───────────────────────────────────────────────────────────

async function updateProfile(req, res, next) {
  try {
    const { shop_owner_name, shop_name, phone_number, address, city, gst_number } = req.body;

    const result = await query(
      `UPDATE users SET
        shop_owner_name = COALESCE($1, shop_owner_name),
        shop_name = COALESCE($2, shop_name),
        phone_number = COALESCE($3, phone_number),
        address = COALESCE($4, address),
        city = COALESCE($5, city),
        gst_number = COALESCE($6, gst_number),
        updated_at = NOW()
       WHERE user_id = $7
       RETURNING user_id, email, shop_owner_name, shop_name, phone_number, address, city, gst_number`,
      [
        shop_owner_name || null, shop_name || null, phone_number || null,
        address || null, city || null, gst_number || null,
        req.user.user_id,
      ]
    );

    return successResponse(res, result.rows[0], 'Profile updated successfully');
  } catch (err) {
    next(err);
  }
}

// ─── Change Password ──────────────────────────────────────────────────────────

async function changePassword(req, res, next) {
  try {
    const { current_password, new_password } = req.body;

    const result = await query(
      'SELECT password_hash FROM users WHERE user_id = $1',
      [req.user.user_id]
    );

    if (result.rows.length === 0) {
      throw createError('User not found', 404, 'USER_NOT_FOUND');
    }

    const isValid = await comparePassword(current_password, result.rows[0].password_hash);
    if (!isValid) {
      throw createError('Current password is incorrect', 400, 'INVALID_CURRENT_PASSWORD');
    }

    if (current_password === new_password) {
      throw createError('New password must be different from current password', 400, 'SAME_PASSWORD');
    }

    const password_hash = await hashPassword(new_password);
    await query(
      'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE user_id = $2',
      [password_hash, req.user.user_id]
    );

    return successResponse(res, null, 'Password changed successfully');
  } catch (err) {
    next(err);
  }
}

module.exports = {
  register, login, refreshToken, logout,
  forgotPassword, resetPassword,
  getProfile, updateProfile, changePassword,
};
