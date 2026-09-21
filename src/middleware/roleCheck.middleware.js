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

const requireVerifiedCaregiver = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  if (req.user.role !== USER_ROLES.CAREGIVER) {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }

  const verificationStatus = req.user.Caregiver?.verificationStatus;
  if (!['APPROVED', 'verified'].includes(verificationStatus)) {
    return res.status(403).json({
      error: 'Caregiver verification required',
      code: 'CAREGIVER_VERIFICATION_REQUIRED'
    });
  }

  next();
};

module.exports = {
  requireRole,
  requirePatient,
  requireCaregiver,
  requireVerifiedCaregiver,
  requirePhysician,
  requireAdmin
};
