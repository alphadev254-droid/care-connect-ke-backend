const { User, Role, Permission } = require('../models');

// Middleware to check if user has required permission
const requirePermission = (permissionName) => {
  return async (req, res, next) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      // Get user with role and permissions
      const user = await User.findByPk(userId, {
        include: [{
          model: Role,
          include: [{
            model: Permission,
            through: { attributes: [] }
          }]
        }]
      });

      if (!user || !user.Role) {
        return res.status(403).json({ error: 'Access denied - no role assigned' });
      }

      // Attach permissions to request for use in controllers
      req.user.permissions = user.Role.Permissions.map(p => p.name);

      // Check if user has the required permission
      const hasPermission = user.Role.Permissions.some(
        permission => permission.name === permissionName
      );

      if (!hasPermission) {
        return res.status(403).json({ 
          error: `Access denied - requires ${permissionName} permission` 
        });
      }

      next();
    } catch (error) {
      console.error('Permission check error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };
};

// Middleware to check multiple permissions (user needs at least one)
const requireAnyPermission = (permissionNames) => {
  return async (req, res, next) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const user = await User.findByPk(userId, {
        include: [{
          model: Role,
          include: [{
            model: Permission,
            through: { attributes: [] }
          }]
        }]
      });

      if (!user || !user.Role) {
        return res.status(403).json({ error: 'Access denied - no role assigned' });
      }

      // Attach permissions to request for use in controllers
      req.user.permissions = user.Role.Permissions.map(p => p.name);

      const hasAnyPermission = user.Role.Permissions.some(
        permission => permissionNames.includes(permission.name)
      );

      if (!hasAnyPermission) {
        return res.status(403).json({ 
          error: `Access denied - requires one of: ${permissionNames.join(', ')}` 
        });
      }

      next();
    } catch (error) {
      console.error('Permission check error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };
};

module.exports = {
  requirePermission,
  requireAnyPermission
};