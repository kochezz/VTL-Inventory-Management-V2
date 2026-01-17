// src/utils/auth.js
// JWT Authentication Utilities
// Handles token generation, verification, and password hashing

const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// Configuration
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';
const SALT_ROUNDS = 10;

// Validate JWT_SECRET exists
if (!JWT_SECRET) {
  console.error('❌ JWT_SECRET is not defined in environment variables!');
  console.error('   Add JWT_SECRET to your .env file');
  console.error('   Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET is required in production');
  }
}

/**
 * Generate JWT access token
 * @param {Object} user - User object
 * @returns {string} JWT token
 */
function generateToken(user) {
  const payload = {
    user_id: user.user_id,
    email: user.email,
    role: user.role,
    employee_id: user.employee_id,
  };

  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
    issuer: 'vilagio-inventory',
    audience: 'vilagio-users',
  });
}

/**
 * Generate refresh token
 * @param {Object} user - User object
 * @returns {string} Refresh token
 */
function generateRefreshToken(user) {
  const payload = {
    user_id: user.user_id,
    type: 'refresh',
  };

  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_REFRESH_EXPIRES_IN,
    issuer: 'vilagio-inventory',
    audience: 'vilagio-users',
  });
}

/**
 * Verify JWT token
 * @param {string} token - JWT token to verify
 * @returns {Object} Decoded token payload
 * @throws {Error} If token is invalid
 */
function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET, {
      issuer: 'vilagio-inventory',
      audience: 'vilagio-users',
    });
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw new Error('Token has expired');
    } else if (error.name === 'JsonWebTokenError') {
      throw new Error('Invalid token');
    } else {
      throw error;
    }
  }
}

/**
 * Hash password using bcrypt
 * @param {string} password - Plain text password
 * @returns {Promise<string>} Hashed password
 */
async function hashPassword(password) {
  return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Compare password with hash
 * @param {string} password - Plain text password
 * @param {string} hash - Hashed password
 * @returns {Promise<boolean>} True if password matches
 */
async function comparePassword(password, hash) {
  return bcrypt.compare(password, hash);
}

/**
 * Extract token from Authorization header
 * @param {string} authHeader - Authorization header value
 * @returns {string|null} Token or null
 */
function extractTokenFromHeader(authHeader) {
  if (!authHeader) {
    return null;
  }

  // Support both "Bearer <token>" and just "<token>"
  const parts = authHeader.split(' ');
  if (parts.length === 2 && parts[0] === 'Bearer') {
    return parts[1];
  } else if (parts.length === 1) {
    return parts[0];
  }

  return null;
}

/**
 * Decode token without verification (for debugging)
 * @param {string} token - JWT token
 * @returns {Object} Decoded token payload
 */
function decodeToken(token) {
  return jwt.decode(token);
}

/**
 * Check if user has required role
 * @param {Object} user - User object from token
 * @param {string|Array<string>} roles - Required role(s)
 * @returns {boolean} True if user has required role
 */
function hasRole(user, roles) {
  if (!user || !user.role) {
    return false;
  }

  if (typeof roles === 'string') {
    return user.role === roles;
  }

  if (Array.isArray(roles)) {
    return roles.includes(user.role);
  }

  return false;
}

/**
 * Check if user has any of the required permissions
 * @param {Object} user - User object from token
 * @param {Array<string>} requiredRoles - Array of acceptable roles
 * @returns {boolean} True if user has any of the roles
 */
function hasAnyRole(user, requiredRoles) {
  if (!user || !user.role) {
    return false;
  }

  return requiredRoles.includes(user.role);
}

/**
 * Role hierarchy for permission checks
 * Higher index = more permissions
 */
const ROLE_HIERARCHY = [
  'viewer',
  'warehouse_staff',
  'production_manager',
  'warehouse_manager',
  'admin',
];

/**
 * Check if user role has at least the minimum required level
 * @param {Object} user - User object from token
 * @param {string} minimumRole - Minimum required role
 * @returns {boolean} True if user role is equal or higher
 */
function hasMinimumRole(user, minimumRole) {
  if (!user || !user.role) {
    return false;
  }

  const userRoleIndex = ROLE_HIERARCHY.indexOf(user.role);
  const requiredRoleIndex = ROLE_HIERARCHY.indexOf(minimumRole);

  if (userRoleIndex === -1 || requiredRoleIndex === -1) {
    return false;
  }

  return userRoleIndex >= requiredRoleIndex;
}

/**
 * Generate password reset token
 * @param {Object} user - User object
 * @returns {string} Reset token
 */
function generatePasswordResetToken(user) {
  const payload = {
    user_id: user.user_id,
    email: user.email,
    type: 'password_reset',
  };

  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: '1h', // Reset tokens expire in 1 hour
    issuer: 'vilagio-inventory',
    audience: 'vilagio-users',
  });
}

/**
 * Verify password reset token
 * @param {string} token - Reset token
 * @returns {Object} Decoded token payload
 * @throws {Error} If token is invalid or wrong type
 */
function verifyPasswordResetToken(token) {
  const decoded = verifyToken(token);
  
  if (decoded.type !== 'password_reset') {
    throw new Error('Invalid token type');
  }

  return decoded;
}

/**
 * Get token expiration time
 * @param {string} token - JWT token
 * @returns {Date|null} Expiration date or null
 */
function getTokenExpiration(token) {
  try {
    const decoded = jwt.decode(token);
    if (decoded && decoded.exp) {
      return new Date(decoded.exp * 1000);
    }
    return null;
  } catch (error) {
    return null;
  }
}

/**
 * Check if token is expired
 * @param {string} token - JWT token
 * @returns {boolean} True if token is expired
 */
function isTokenExpired(token) {
  const expiration = getTokenExpiration(token);
  if (!expiration) {
    return true;
  }
  return expiration < new Date();
}

module.exports = {
  // Token operations
  generateToken,
  generateRefreshToken,
  verifyToken,
  decodeToken,
  extractTokenFromHeader,
  getTokenExpiration,
  isTokenExpired,
  
  // Password operations
  hashPassword,
  comparePassword,
  
  // Role/permission checks
  hasRole,
  hasAnyRole,
  hasMinimumRole,
  ROLE_HIERARCHY,
  
  // Password reset
  generatePasswordResetToken,
  verifyPasswordResetToken,
};

// If run directly, test the utilities
if (require.main === module) {
  console.log('🔐 Testing Auth Utilities...\n');

  // Test 1: Password hashing
  console.log('Test 1: Password Hashing');
  const testPassword = 'admin123';
  hashPassword(testPassword)
    .then(hash => {
      console.log('  ✅ Password hashed successfully');
      console.log('  Hash:', hash.substring(0, 20) + '...');
      return comparePassword(testPassword, hash);
    })
    .then(isValid => {
      console.log('  ✅ Password comparison:', isValid ? 'PASSED' : 'FAILED');
    });

  // Test 2: Token generation and verification
  console.log('\nTest 2: JWT Token');
  const testUser = {
    user_id: '123e4567-e89b-12d3-a456-426614174000',
    email: 'test@vilagio.io',
    role: 'admin',
    employee_id: 'VTL001',
  };

  const token = generateToken(testUser);
  console.log('  ✅ Token generated');
  console.log('  Token:', token.substring(0, 30) + '...');

  try {
    const decoded = verifyToken(token);
    console.log('  ✅ Token verified successfully');
    console.log('  User ID:', decoded.user_id);
    console.log('  Email:', decoded.email);
    console.log('  Role:', decoded.role);
  } catch (error) {
    console.log('  ❌ Token verification failed:', error.message);
  }

  // Test 3: Token expiration
  console.log('\nTest 3: Token Expiration');
  const expiration = getTokenExpiration(token);
  console.log('  Token expires at:', expiration);
  console.log('  Is expired?', isTokenExpired(token));

  // Test 4: Role checks
  console.log('\nTest 4: Role Checks');
  console.log('  Has admin role?', hasRole(testUser, 'admin'));
  console.log('  Has viewer role?', hasRole(testUser, 'viewer'));
  console.log('  Has minimum warehouse_staff?', hasMinimumRole(testUser, 'warehouse_staff'));
  console.log('  Has minimum admin?', hasMinimumRole(testUser, 'admin'));

  console.log('\n✅ All tests completed!');
}
