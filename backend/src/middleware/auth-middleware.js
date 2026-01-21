const jwt = require('jsonwebtoken');

// Authenticate middleware - verifies JWT token
const authenticate = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      return res.status(401).json({ message: 'No token provided' });
    }

    // Extract token from "Bearer TOKEN" format
    const token = authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ message: 'Invalid token format' });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Attach user info to request
    req.user = decoded;
    
    console.log(`✅ Authenticated user: ${decoded.email} (${decoded.role})`);
    
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        message: 'Token expired',
        code: 'TOKEN_EXPIRED'
      });
    }
    return res.status(401).json({ 
      message: 'Invalid token',
      code: 'INVALID_TOKEN'
    });
  }
};

// Authorize middleware - checks user role
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    if (!roles.includes(req.user.role)) {
      console.log(`❌ Forbidden: User ${req.user.email} (${req.user.role}) attempted to access ${roles.join(', ')} only route`);
      return res.status(403).json({ 
        message: 'Forbidden: Insufficient permissions',
        required_roles: roles,
        user_role: req.user.role
      });
    }

    console.log(`✅ Authorized: ${req.user.email} has required role: ${req.user.role}`);
    next();
  };
};

module.exports = { 
  authenticate, 
  authorize 
};
