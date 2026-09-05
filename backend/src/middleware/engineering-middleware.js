'use strict';

const ENGINEERING_ACCESS_ROLES = ['admin', 'engineering', 'engineering_manager'];
const ENGINEERING_MANAGER_ROLES = ['admin', 'engineering_manager'];

const requireEngineeringAccess = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: 'User not authenticated' });
  }
  if (!ENGINEERING_ACCESS_ROLES.includes(req.user.role)) {
    return res.status(403).json({ message: 'Access denied. Engineering role required.' });
  }
  next();
};

const requireEngineeringManager = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: 'User not authenticated' });
  }
  if (!ENGINEERING_MANAGER_ROLES.includes(req.user.role)) {
    return res.status(403).json({ message: 'Access denied. Engineering manager role required.' });
  }
  next();
};

module.exports = { requireEngineeringAccess, requireEngineeringManager };
