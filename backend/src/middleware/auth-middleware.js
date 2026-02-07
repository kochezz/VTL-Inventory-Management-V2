const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';

/**
 * Authentication middleware - verifies JWT token
 */
const authenticate = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      return res.status(401).json({ message: 'No authorization header provided' });
    }

    const token = authHeader.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    
    req.user = decoded;
    next();
  } catch (error) {
    console.error('Authentication error:', error.message);
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token expired' });
    }
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: 'Invalid token' });
    }
    
    return res.status(401).json({ message: 'Authentication failed' });
  }
};

/**
 * Authorization middleware - checks user role
 * Can accept single role or array of roles
 * 
 * Usage:
 * - authorize('admin') - only admin
 * - authorize(['admin', 'qa']) - admin OR qa
 */
const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'User not authenticated' });
    }

    const userRole = req.user.role;
    
    // Flatten array if roles passed as array
    const roles = allowedRoles.flat();
    
    if (!roles.includes(userRole)) {
      return res.status(403).json({ 
        message: `Access denied. Required role(s): ${roles.join(' or ')}. Your role: ${userRole}` 
      });
    }

    next();
  };
};

/**
 * Check if user has QA approval permissions
 * QA and Admin can approve
 */
const canApproveQA = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: 'User not authenticated' });
  }

  const userRole = req.user.role;
  
  if (userRole !== 'admin' && userRole !== 'qa') {
    return res.status(403).json({ 
      message: 'Access denied. Only QA personnel and administrators can approve QA gates.' 
    });
  }

  next();
};

/**
 * Check if user is admin
 */
const isAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: 'User not authenticated' });
  }

  if (req.user.role !== 'admin') {
    return res.status(403).json({ 
      message: 'Access denied. Administrator privileges required.' 
    });
  }

  next();
};

module.exports = {
  authenticate,
  authorize,
  canApproveQA,
  isAdmin
};
