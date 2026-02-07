const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');

// Database connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Test database connection
pool.on('connect', () => {
  console.log('✅ Database connected successfully');
});

pool.on('error', (err) => {
  console.error('❌ Database connection error:', err);
});

// Generate access token (short-lived)
const generateAccessToken = (user) => {
  return jwt.sign(
    { 
      user_id: user.user_id, 
      email: user.email, 
      role: user.role,
      full_name: user.full_name
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '15m' }
  );
};

// Generate refresh token (long-lived)
const generateRefreshToken = (user) => {
  return jwt.sign(
    { user_id: user.user_id },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' }
  );
};

// Login function
const login = async (email, password, ipAddress, userAgent) => {
  try {
    console.log(`🔐 Login attempt for: ${email}`);

    // Find user by email
    const userResult = await pool.query(
      'SELECT * FROM users WHERE email = $1 AND is_active = true',
      [email]
    );

    if (userResult.rows.length === 0) {
      console.log(`❌ User not found or inactive: ${email}`);
      throw new Error('Invalid credentials');
    }

    const user = userResult.rows[0];
    console.log(`✅ User found: ${user.full_name} (${user.role})`);

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    
    if (!isValidPassword) {
      console.log(`❌ Invalid password for: ${email}`);
      throw new Error('Invalid credentials');
    }

    console.log(`✅ Password verified for: ${email}`);

    // Generate tokens
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    console.log(`✅ Tokens generated for: ${email}`);

    // Store refresh token in session
    await pool.query(
      `INSERT INTO user_sessions (user_id, refresh_token, ip_address, user_agent, expires_at)
       VALUES ($1, $2, $3, $4, NOW() + INTERVAL '7 days')`,
      [user.user_id, refreshToken, ipAddress, userAgent]
    );

    console.log(`✅ Session created for: ${email}`);

    // Update last login
    await pool.query(
      'UPDATE users SET last_login = NOW() WHERE user_id = $1',
      [user.user_id]
    );

    console.log(`✅ Last login updated for: ${email}`);

    // Return user data and tokens (don't send password hash)
    const { password_hash, ...userData } = user;
    
    console.log(`🎉 Login successful for: ${email}`);
    
    return {
      user: userData,
      accessToken,
      refreshToken
    };
  } catch (error) {
    console.error('❌ Login error:', error.message);
    throw error;
  }
};

// Logout function
const logout = async (refreshToken) => {
  try {
    console.log('🔐 Logout attempt');
    
    await pool.query(
      'UPDATE user_sessions SET is_revoked = true WHERE refresh_token = $1',
      [refreshToken]
    );
    
    console.log('✅ Session revoked successfully');
    return { message: 'Logged out successfully' };
  } catch (error) {
    console.error('❌ Logout error:', error.message);
    throw error;
  }
};

// Refresh token function
const refreshAccessToken = async (refreshToken) => {
  try {
    console.log('🔐 Token refresh attempt');
    
    // Verify refresh token
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);

    // Check if session is valid
    const sessionResult = await pool.query(
      `SELECT * FROM user_sessions 
       WHERE refresh_token = $1 
       AND is_revoked = false 
       AND expires_at > NOW()`,
      [refreshToken]
    );

    if (sessionResult.rows.length === 0) {
      console.log('❌ Invalid or expired refresh token');
      throw new Error('Invalid refresh token');
    }

    // Get user
    const userResult = await pool.query(
      'SELECT * FROM users WHERE user_id = $1 AND is_active = true',
      [decoded.user_id]
    );

    if (userResult.rows.length === 0) {
      console.log('❌ User not found or inactive');
      throw new Error('User not found');
    }

    const user = userResult.rows[0];

    // Generate new access token
    const newAccessToken = generateAccessToken(user);

    const { password_hash, ...userData } = user;

    console.log(`✅ Token refreshed for: ${user.email}`);

    return {
      accessToken: newAccessToken,
      user: userData
    };
  } catch (error) {
    console.error('❌ Token refresh error:', error.message);
    throw error;
  }
};

// Verify token function
const verifyToken = (token) => {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return decoded;
  } catch (error) {
    throw new Error('Invalid or expired token');
  }
};

module.exports = {
  login,
  logout,
  refreshAccessToken,
  verifyToken,
  pool // Export pool for other services
};
