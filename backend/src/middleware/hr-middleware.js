'use strict';

const HR_ACCESS_ROLES = ['admin', 'hr_admin', 'hr_manager'];
const HR_ADMIN_ROLES  = ['admin', 'hr_admin'];

const requireHrAccess = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: 'User not authenticated' });
  }
  if (!HR_ACCESS_ROLES.includes(req.user.role)) {
    return res.status(403).json({ message: 'Access denied. HR role required.' });
  }
  next();
};

const requireHrAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: 'User not authenticated' });
  }
  if (!HR_ADMIN_ROLES.includes(req.user.role)) {
    return res.status(403).json({ message: 'Access denied. HR role required.' });
  }
  next();
};

module.exports = { requireHrAccess, requireHrAdmin };
