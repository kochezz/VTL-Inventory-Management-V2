// src/middleware/authenticate.js
// Express middleware for JWT authentication and authorization

const { verifyToken, extractTokenFromHeader, hasRole, hasMinimumRole } = require('../utils/auth');
const db = require('../utils/db');

/**
 * Middleware to authenticate JWT token
 * Extracts and verifies token, attaches user to req.user
 */
async function authenticate(req, res, next) {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    const token = extractTokenFromHeader(authHeader);

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        message: 'No token provided',
      });
    }

    // Verify token
    let decoded;
    try {
      decoded = verifyToken(token);
    } catch (error) {
      return res.status(401).json({
        success: false,
        error: 'Invalid token',
        message: error.message,
      });
    }

    // Optional: Verify user still exists and is active
    const result = await db.query(
      'SELECT user_id, email, full_name, role, employee_id, badge_number, is_active FROM users WHERE user_id = $1',
      [decoded.user_id]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        error: 'User not found',
        message: 'User associated with this token no longer exists',
      });
    }

    const user = result.rows[0];

    if (!user.is_active) {
      return res.status(401).json({
        success: false,
        error: 'Account disabled',
        message: 'This user account has been disabled',
      });
    }

    // Attach user to request object
    req.user = user;
    req.token = token;

    next();
  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(500).json({
      success: false,
      error: 'Authentication failed',
      message: 'An error occurred during authentication',
    });
  }
}

/**
 * Middleware factory to require specific role(s)
 * @param {string|Array<string>} roles - Required role(s)
 * @returns {Function} Express middleware
 */
function requireRole(roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        message: 'User must be authenticated',
      });
    }

    // Convert single role to array
    const requiredRoles = Array.isArray(roles) ? roles : [roles];

    if (!requiredRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions',
        message: `This action requires one of the following roles: ${requiredRoles.join(', ')}`,
        userRole: req.user.role,
      });
    }

    next();
  };
}

/**
 * Middleware factory to require minimum role level
 * @param {string} minimumRole - Minimum required role
 * @returns {Function} Express middleware
 */
function requireMinimumRole(minimumRole) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        message: 'User must be authenticated',
      });
    }

    if (!hasMinimumRole(req.user, minimumRole)) {
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions',
        message: `This action requires at least ${minimumRole} role`,
        userRole: req.user.role,
      });
    }

    next();
  };
}

/**
 * Middleware to require admin role
 */
function requireAdmin(req, res, next) {
  return requireRole('admin')(req, res, next);
}

/**
 * Middleware to require warehouse manager or admin
 */
function requireWarehouseManager(req, res, next) {
  return requireRole(['warehouse_manager', 'admin'])(req, res, next);
}

/**
 * Middleware for optional authentication
 * Attaches user if token is valid, but doesn't require it
 */
async function optionalAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    const token = extractTokenFromHeader(authHeader);

    if (!token) {
      // No token provided, continue without user
      req.user = null;
      return next();
    }

    // Try to verify token
    try {
      const decoded = verifyToken(token);

      // Get user from database
      const result = await db.query(
        'SELECT user_id, email, full_name, role, employee_id, badge_number, is_active FROM users WHERE user_id = $1',
        [decoded.user_id]
      );

      if (result.rows.length > 0 && result.rows[0].is_active) {
        req.user = result.rows[0];
      } else {
        req.user = null;
      }
    } catch (error) {
      // Invalid token, continue without user
      req.user = null;
    }

    next();
  } catch (error) {
    console.error('Optional auth error:', error);
    req.user = null;
    next();
  }
}

/**
 * Middleware to check if user can modify a resource
 * Admins can modify anything, others only their own
 */
function canModifyResource(getUserIdFromResource) {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    // Admins can modify anything
    if (req.user.role === 'admin') {
      return next();
    }

    // Get resource owner
    const resourceUserId = await getUserIdFromResource(req);

    if (!resourceUserId || resourceUserId !== req.user.user_id) {
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions',
        message: 'You can only modify your own resources',
      });
    }

    next();
  };
}

/**
 * Middleware to log authenticated requests
 */
function logAuthenticatedRequest(req, res, next) {
  if (req.user) {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} - User: ${req.user.email} (${req.user.role})`);
  }
  next();
}

/**
 * Middleware to rate limit by user
 * Simple in-memory rate limiter (use Redis in production)
 */
const userRequestCounts = new Map();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 100;

function rateLimit(req, res, next) {
  if (!req.user) {
    return next();
  }

  const userId = req.user.user_id;
  const now = Date.now();

  // Get or create user's request history
  let userRequests = userRequestCounts.get(userId);
  
  if (!userRequests) {
    userRequests = [];
    userRequestCounts.set(userId, userRequests);
  }

  // Remove old requests outside the window
  userRequests = userRequests.filter(timestamp => now - timestamp < RATE_LIMIT_WINDOW);
  userRequestCounts.set(userId, userRequests);

  // Check if limit exceeded
  if (userRequests.length >= RATE_LIMIT_MAX_REQUESTS) {
    return res.status(429).json({
      success: false,
      error: 'Rate limit exceeded',
      message: `Maximum ${RATE_LIMIT_MAX_REQUESTS} requests per minute`,
      retryAfter: Math.ceil(RATE_LIMIT_WINDOW / 1000),
    });
  }

  // Add current request
  userRequests.push(now);

  // Add rate limit headers
  res.set({
    'X-RateLimit-Limit': RATE_LIMIT_MAX_REQUESTS,
    'X-RateLimit-Remaining': RATE_LIMIT_MAX_REQUESTS - userRequests.length,
    'X-RateLimit-Reset': new Date(now + RATE_LIMIT_WINDOW).toISOString(),
  });

  next();
}

module.exports = {
  authenticate,
  requireRole,
  requireMinimumRole,
  requireAdmin,
  requireWarehouseManager,
  optionalAuth,
  canModifyResource,
  logAuthenticatedRequest,
  rateLimit,
};
