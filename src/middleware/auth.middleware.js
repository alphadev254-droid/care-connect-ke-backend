const jwt = require('jsonwebtoken');
const { jwtSecret } = require('../config/auth');
const { User } = require('../models');

const authenticateToken = async (req, res, next) => {
  const token = req.cookies.token ||
    (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : null);

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const decoded = jwt.verify(token, jwtSecret);
    const { Role, Caregiver, Patient, PrimaryPhysician } = require('../models');
    const user = await User.findByPk(decoded.userId, {
      include: [
        { model: Role },
        { model: Caregiver, required: false },
        { model: Patient, required: false },
        { model: PrimaryPhysician, required: false }
      ]
    });

    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'Invalid or inactive user' });
    }

    // Add role name to user object for easier access
    req.user = {
      ...user.toJSON(),
      role: user.Role?.name
    };
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Invalid token' });
  }
};

// Role-based authorization middleware
const requireRole = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const userRole = req.user.role;

    // Check if user's role is in the allowed roles array
    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({
        error: `Access denied. Required role: ${allowedRoles.join(' or ')}`
      });
    }

    next();
  };
};

module.exports = { authenticateToken, requireRole };