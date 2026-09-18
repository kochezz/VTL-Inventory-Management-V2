'use strict';

const ENGINEERING_ACCESS_ROLES = ['admin', 'engineering', 'engineering_manager'];
const ENGINEERING_MANAGER_ROLES = ['admin', 'engineering_manager'];

// Read-only visibility for Finance -- purchase and stock-level planning
// needs asset data, not write access. Kept as its own middleware (rather
// than widening ENGINEERING_ACCESS_ROLES itself) so it's obvious at each
// route which ones are meant to stay engineering-only (notifications, work
// orders, task lists, PM schedule) versus which are Asset Register reads
// specifically opened to Finance.
const ASSET_REGISTER_READ_ROLES = ['admin', 'engineering', 'engineering_manager', 'junior_accountant', 'manager', 'cfo', 'ceo'];

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

const requireAssetRegisterRead = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: 'User not authenticated' });
  }
  if (!ASSET_REGISTER_READ_ROLES.includes(req.user.role)) {
    return res.status(403).json({ message: 'Access denied. Engineering or Finance role required.' });
  }
  next();
};

module.exports = { requireEngineeringAccess, requireEngineeringManager, requireAssetRegisterRead };
