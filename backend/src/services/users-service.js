const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');
const { pool } = require('./auth-service');

/**
 * Get all users (excluding password hashes)
 */
const getAllUsers = async () => {
  try {
    const query = `
      SELECT 
        user_id,
        email,
        full_name,
        role,
        is_active,
        is_verified,
        created_at,
        updated_at,
        last_login
      FROM users
      ORDER BY created_at DESC
    `;

    const result = await pool.query(query);
    return result.rows;
  } catch (error) {
    console.error('❌ Get all users error:', error.message);
    throw error;
  }
};

/**
 * Get single user by ID (excluding password hash)
 */
const getUserById = async (userId) => {
  try {
    const query = `
      SELECT 
        user_id,
        email,
        full_name,
        role,
        is_active,
        is_verified,
        created_at,
        updated_at,
        last_login
      FROM users
      WHERE user_id = $1
    `;

    const result = await pool.query(query, [userId]);

    if (result.rows.length === 0) {
      throw new Error('User not found');
    }

    return result.rows[0];
  } catch (error) {
    console.error('❌ Get user by ID error:', error.message);
    throw error;
  }
};

/**
 * Create new user
 */
const createUser = async (userData) => {
  try {
    const { email, full_name, password, role, is_active, is_verified } = userData;

    // Validate role
    const validRoles = ['admin', 'manager', 'staff', 'viewer'];
    if (!validRoles.includes(role)) {
      throw new Error(`Invalid role. Must be one of: ${validRoles.join(', ')}`);
    }

    // Check if email already exists
    const emailCheck = await pool.query(
      'SELECT user_id FROM users WHERE email = $1',
      [email]
    );

    if (emailCheck.rows.length > 0) {
      throw new Error('Email already exists');
    }

    // Hash password
    const saltRounds = 10;
    const password_hash = await bcrypt.hash(password, saltRounds);

    // Generate UUID
    const user_id = uuidv4();

    // Insert user
    const query = `
      INSERT INTO users (
        user_id,
        email,
        full_name,
        password_hash,
        role,
        is_active,
        is_verified,
        created_at,
        updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
      RETURNING 
        user_id,
        email,
        full_name,
        role,
        is_active,
        is_verified,
        created_at,
        updated_at,
        last_login
    `;

    const result = await pool.query(query, [
      user_id,
      email,
      full_name,
      password_hash,
      role,
      is_active,
      is_verified
    ]);

    console.log(`✅ User created: ${email} (${role})`);

    return result.rows[0];
  } catch (error) {
    console.error('❌ Create user error:', error.message);
    throw error;
  }
};

/**
 * Update existing user
 */
const updateUser = async (userId, userData) => {
  try {
    const { email, full_name, password, role, is_active, is_verified } = userData;

    // Check if user exists
    const userCheck = await pool.query(
      'SELECT user_id FROM users WHERE user_id = $1',
      [userId]
    );

    if (userCheck.rows.length === 0) {
      throw new Error('User not found');
    }

    // Validate role if provided
    if (role) {
      const validRoles = ['admin', 'manager', 'staff', 'viewer'];
      if (!validRoles.includes(role)) {
        throw new Error(`Invalid role. Must be one of: ${validRoles.join(', ')}`);
      }
    }

    // Check if email is being changed and already exists
    if (email) {
      const emailCheck = await pool.query(
        'SELECT user_id FROM users WHERE email = $1 AND user_id != $2',
        [email, userId]
      );

      if (emailCheck.rows.length > 0) {
        throw new Error('Email already exists');
      }
    }

    // Build update query dynamically
    const updates = [];
    const values = [];
    let paramCount = 1;

    if (email) {
      updates.push(`email = $${paramCount}`);
      values.push(email);
      paramCount++;
    }

    if (full_name) {
      updates.push(`full_name = $${paramCount}`);
      values.push(full_name);
      paramCount++;
    }

    if (password) {
      const saltRounds = 10;
      const password_hash = await bcrypt.hash(password, saltRounds);
      updates.push(`password_hash = $${paramCount}`);
      values.push(password_hash);
      paramCount++;
    }

    if (role) {
      updates.push(`role = $${paramCount}`);
      values.push(role);
      paramCount++;
    }

    if (is_active !== undefined) {
      updates.push(`is_active = $${paramCount}`);
      values.push(is_active);
      paramCount++;
    }

    if (is_verified !== undefined) {
      updates.push(`is_verified = $${paramCount}`);
      values.push(is_verified);
      paramCount++;
    }

    // Always update updated_at
    updates.push(`updated_at = NOW()`);

    // Add user_id as last parameter
    values.push(userId);

    const query = `
      UPDATE users
      SET ${updates.join(', ')}
      WHERE user_id = $${paramCount}
      RETURNING 
        user_id,
        email,
        full_name,
        role,
        is_active,
        is_verified,
        created_at,
        updated_at,
        last_login
    `;

    const result = await pool.query(query, values);

    console.log(`✅ User updated: ${result.rows[0].email}`);

    return result.rows[0];
  } catch (error) {
    console.error('❌ Update user error:', error.message);
    throw error;
  }
};

/**
 * Delete user
 */
const deleteUser = async (userId) => {
  try {
    // Check if user exists
    const userCheck = await pool.query(
      'SELECT email FROM users WHERE user_id = $1',
      [userId]
    );

    if (userCheck.rows.length === 0) {
      throw new Error('User not found');
    }

    const email = userCheck.rows[0].email;

    // Delete user (this will cascade delete sessions, etc.)
    await pool.query('DELETE FROM users WHERE user_id = $1', [userId]);

    console.log(`✅ User deleted: ${email}`);

    return { message: 'User deleted successfully' };
  } catch (error) {
    console.error('❌ Delete user error:', error.message);
    throw error;
  }
};

/**
 * Update user active status
 */
const updateUserStatus = async (userId, isActive) => {
  try {
    const query = `
      UPDATE users
      SET is_active = $1, updated_at = NOW()
      WHERE user_id = $2
      RETURNING 
        user_id,
        email,
        full_name,
        role,
        is_active,
        is_verified,
        created_at,
        updated_at,
        last_login
    `;

    const result = await pool.query(query, [isActive, userId]);

    if (result.rows.length === 0) {
      throw new Error('User not found');
    }

    console.log(`✅ User status updated: ${result.rows[0].email} -> ${isActive ? 'active' : 'inactive'}`);

    return result.rows[0];
  } catch (error) {
    console.error('❌ Update user status error:', error.message);
    throw error;
  }
};

/**
 * Initiate password reset (generate token and send email)
 */
const initiatePasswordReset = async (userId) => {
  try {
    // Get user
    const userQuery = await pool.query(
      'SELECT email, full_name FROM users WHERE user_id = $1 AND is_active = true',
      [userId]
    );

    if (userQuery.rows.length === 0) {
      throw new Error('User not found or inactive');
    }

    const user = userQuery.rows[0];

    // Generate reset token
    const crypto = require('crypto');
    const resetToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');

    // Store reset token (expires in 1 hour)
    await pool.query(
      `INSERT INTO password_reset_tokens (user_id, token, expires_at, created_at)
       VALUES ($1, $2, NOW() + INTERVAL '1 hour', NOW())`,
      [userId, hashedToken]
    );

    // TODO: Send email with reset link
    // For now, just log the token (in production, send actual email)
    console.log(`🔑 Password reset token for ${user.email}: ${resetToken}`);
    console.log(`   (In production, this would be sent via email)`);

    console.log(`✅ Password reset initiated for: ${user.email}`);

    return {
      message: 'Password reset email sent successfully',
      // Don't send token in production!
      dev_token: process.env.NODE_ENV === 'development' ? resetToken : undefined
    };
  } catch (error) {
    console.error('❌ Initiate password reset error:', error.message);
    throw error;
  }
};

/**
 * Get user statistics
 */
const getUserStats = async () => {
  try {
    const query = `
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE is_active = true) as active,
        COUNT(*) FILTER (WHERE is_active = false) as inactive,
        COUNT(*) FILTER (WHERE role = 'admin') as admins,
        COUNT(*) FILTER (WHERE role = 'manager') as managers,
        COUNT(*) FILTER (WHERE role = 'staff') as staff,
        COUNT(*) FILTER (WHERE role = 'viewer') as viewers,
        COUNT(*) FILTER (WHERE is_verified = true) as verified,
        COUNT(*) FILTER (WHERE is_verified = false) as unverified,
        COUNT(*) FILTER (WHERE last_login > NOW() - INTERVAL '7 days') as active_last_week
      FROM users
    `;

    const result = await pool.query(query);
    return result.rows[0];
  } catch (error) {
    console.error('❌ Get user stats error:', error.message);
    throw error;
  }
};

module.exports = {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  updateUserStatus,
  initiatePasswordReset,
  getUserStats
};
