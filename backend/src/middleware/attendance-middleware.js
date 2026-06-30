'use strict';

const ATTENDANCE_ADMIN_ROLES = ['admin'];

const ATTENDANCE_MANAGER_ROLES = [
  'admin',
  'hr_admin',
  'hr_manager',
  'manager',
  'production_manager',
  'warehouse_manager',
  'ceo',
  'cfo',
];

const requireAttendanceAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: 'User not authenticated' });
  }
  if (!ATTENDANCE_ADMIN_ROLES.includes(req.user.role)) {
    return res.status(403).json({ message: 'Access denied. Admin role required.' });
  }
  next();
};

const requireAttendanceManager = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: 'User not authenticated' });
  }
  if (!ATTENDANCE_MANAGER_ROLES.includes(req.user.role)) {
    return res.status(403).json({ message: 'Access denied. Manager role required.' });
  }
  next();
};

module.exports = { requireAttendanceAdmin, requireAttendanceManager };
