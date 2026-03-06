const { USER_ROLES } = require('../utils/constants');

const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const userRoles = Array.isArray(roles) ? roles : [roles];
    
    if (!userRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    next();
  };
};

const requirePatient = requireRole(USER_ROLES.PATIENT);
const requireCaregiver = requireRole(USER_ROLES.CAREGIVER);
const requirePhysician = requireRole(USER_ROLES.PRIMARY_PHYSICIAN);
const requireAdmin = requireRole([USER_ROLES.SYSTEM_MANAGER, USER_ROLES.REGIONAL_MANAGER, 'Accountant']);

module.exports = {
  requireRole,
  requirePatient,
  requireCaregiver,
  requirePhysician,
  requireAdmin
};