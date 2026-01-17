// src/api/routes/auth.js
// Authentication routes: login, logout, token refresh, password change

const express = require('express');
const router = express.Router();
const db = require('../../utils/db');
const {
  generateToken,
  generateRefreshToken,
  comparePassword,
  hashPassword,
  verifyToken,
} = require('../../utils/auth');
const { authenticate } = require('../../middleware/authenticate');

/**
 * POST /api/auth/login
 * User login endpoint
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Missing credentials',
        message: 'Email and password are required',
      });
    }

    // Find user by email
    const result = await db.query(
      `SELECT 
        user_id, 
        email, 
        password_hash, 
        full_name, 
        role, 
        employee_id, 
        badge_number,
        is_active,
        last_login
      FROM users 
      WHERE email = $1`,
      [email.toLowerCase()]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials',
        message: 'Email or password is incorrect',
      });
    }

    const user = result.rows[0];

    // Check if user is active
    if (!user.is_active) {
      return res.status(401).json({
        success: false,
        error: 'Account disabled',
        message: 'This account has been disabled',
      });
    }

    // Verify password
    const isPasswordValid = await comparePassword(password, user.password_hash);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials',
        message: 'Email or password is incorrect',
      });
    }

    // Update last login time
    await db.query(
      'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE user_id = $1',
      [user.user_id]
    );

    // Generate tokens
    const token = generateToken(user);
    const refreshToken = generateRefreshToken(user);

    // Remove sensitive data
    delete user.password_hash;

    // Log successful login
    console.log(`✅ User logged in: ${user.email} (${user.role})`);

    res.json({
      success: true,
      message: 'Login successful',
      token,
      refreshToken,
      user: {
        user_id: user.user_id,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
        employee_id: user.employee_id,
        badge_number: user.badge_number,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      error: 'Login failed',
      message: 'An error occurred during login',
    });
  }
});

/**
 * POST /api/auth/logout
 * User logout endpoint (requires authentication)
 */
router.post('/logout', authenticate, async (req, res) => {
  try {
    // In a production app, you might want to:
    // - Add token to a blacklist in Redis
    // - Clear refresh token from database
    // - Log the logout event

    console.log(`👋 User logged out: ${req.user.email}`);

    res.json({
      success: true,
      message: 'Logout successful',
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      error: 'Logout failed',
      message: 'An error occurred during logout',
    });
  }
});

/**
 * POST /api/auth/refresh
 * Refresh access token using refresh token
 */
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        error: 'Missing refresh token',
        message: 'Refresh token is required',
      });
    }

    // Verify refresh token
    let decoded;
    try {
      decoded = verifyToken(refreshToken);
    } catch (error) {
      return res.status(401).json({
        success: false,
        error: 'Invalid refresh token',
        message: error.message,
      });
    }

    // Verify it's a refresh token
    if (decoded.type !== 'refresh') {
      return res.status(401).json({
        success: false,
        error: 'Invalid token type',
        message: 'This is not a refresh token',
      });
    }

    // Get user from database
    const result = await db.query(
      'SELECT user_id, email, full_name, role, employee_id, badge_number, is_active FROM users WHERE user_id = $1',
      [decoded.user_id]
    );

    if (result.rows.length === 0 || !result.rows[0].is_active) {
      return res.status(401).json({
        success: false,
        error: 'User not found',
        message: 'User associated with this token is not active',
      });
    }

    const user = result.rows[0];

    // Generate new access token
    const newToken = generateToken(user);

    res.json({
      success: true,
      message: 'Token refreshed successfully',
      token: newToken,
    });
  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(500).json({
      success: false,
      error: 'Token refresh failed',
      message: 'An error occurred during token refresh',
    });
  }
});

/**
 * GET /api/auth/me
 * Get current user information
 */
router.get('/me', authenticate, async (req, res) => {
  try {
    // User is already attached by authenticate middleware
    res.json({
      success: true,
      user: {
        user_id: req.user.user_id,
        email: req.user.email,
        full_name: req.user.full_name,
        role: req.user.role,
        employee_id: req.user.employee_id,
        badge_number: req.user.badge_number,
      },
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get user',
      message: 'An error occurred while fetching user information',
    });
  }
});

/**
 * POST /api/auth/change-password
 * Change user password (requires authentication)
 */
router.post('/change-password', authenticate, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    // Validate input
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        error: 'Missing passwords',
        message: 'Current password and new password are required',
      });
    }

    // Validate new password strength
    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        error: 'Weak password',
        message: 'New password must be at least 8 characters long',
      });
    }

    // Get current password hash
    const result = await db.query(
      'SELECT password_hash FROM users WHERE user_id = $1',
      [req.user.user_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    // Verify current password
    const isPasswordValid = await comparePassword(
      currentPassword,
      result.rows[0].password_hash
    );

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        error: 'Invalid password',
        message: 'Current password is incorrect',
      });
    }

    // Hash new password
    const newPasswordHash = await hashPassword(newPassword);

    // Update password
    await db.query(
      'UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE user_id = $2',
      [newPasswordHash, req.user.user_id]
    );

    console.log(`🔐 Password changed for user: ${req.user.email}`);

    res.json({
      success: true,
      message: 'Password changed successfully',
    });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      success: false,
      error: 'Password change failed',
      message: 'An error occurred while changing password',
    });
  }
});

/**
 * POST /api/auth/verify-token
 * Verify if a token is valid (useful for frontend)
 */
router.post('/verify-token', async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        error: 'Missing token',
        message: 'Token is required',
      });
    }

    try {
      const decoded = verifyToken(token);
      
      res.json({
        success: true,
        valid: true,
        user: {
          user_id: decoded.user_id,
          email: decoded.email,
          role: decoded.role,
        },
      });
    } catch (error) {
      res.json({
        success: true,
        valid: false,
        error: error.message,
      });
    }
  } catch (error) {
    console.error('Token verification error:', error);
    res.status(500).json({
      success: false,
      error: 'Verification failed',
      message: 'An error occurred during token verification',
    });
  }
});

module.exports = router;
