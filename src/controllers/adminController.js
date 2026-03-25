const { User, Caregiver, Patient, Role, Permission, RolePermission } = require('../models');
const { sanitizeUser } = require('../utils/helpers');
const NotificationHelper = require('../utils/notificationHelper');

const getPendingCaregivers = async (req, res, next) => {
  try {
    const caregiverRole = await Role.findOne({ where: { name: 'caregiver' } });
    
    const pendingCaregivers = await User.findAll({
      where: { 
        role_id: caregiverRole.id,
        isActive: false 
      },
      include: [
        { model: Caregiver },
        { model: Role }
      ],
      order: [['createdAt', 'DESC']]
    });

    res.json({ caregivers: pendingCaregivers.map(sanitizeUser) });
  } catch (error) {
    next(error);
  }
};

const verifyCaregiver = async (req, res, next) => {
  try {
    const { userId } = req.params;
    
    const user = await User.findByPk(userId, {
      include: [{ model: Caregiver }]
    });
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (!user.Caregiver) {
      return res.status(400).json({ error: 'User is not a caregiver' });
    }

    // Update caregiver verification status
    await user.Caregiver.update({ verificationStatus: 'verified' });
    
    // Create notification for caregiver verification
    try {
      await NotificationHelper.createCaregiverVerificationNotifications(
        user.id, 
        'verified', 
        user.Caregiver.region
      );
    } catch (notificationError) {
      console.error('Failed to create verification notifications:', notificationError);
    }
    
    // Queue verification email to caregiver
    const EmailScheduler = require('../services/emailScheduler');
    await EmailScheduler.queueEmail(user.email, 'caregiver_verification', {
      firstName: user.firstName
    });
    
    res.json({ 
      message: 'Caregiver verified successfully',
      user: sanitizeUser(user)
    });
  } catch (error) {
    next(error);
  }
};

const rejectCaregiver = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { reason } = req.body;
    
    if (!reason || reason.trim() === '') {
      return res.status(400).json({ error: 'Rejection reason is required' });
    }

    const user = await User.findByPk(userId, {
      include: [{ model: Caregiver }]
    });
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (!user.Caregiver) {
      return res.status(400).json({ error: 'User is not a caregiver' });
    }

    // Update caregiver verification status
    await user.Caregiver.update({ verificationStatus: 'REJECTED' });
    
    // Create notification for caregiver rejection
    try {
      await NotificationHelper.createCaregiverVerificationNotifications(
        user.id, 
        'REJECTED', 
        user.Caregiver.region
      );
    } catch (notificationError) {
      console.error('Failed to create rejection notifications:', notificationError);
    }
    
    // Queue rejection email with reason
    const EmailScheduler = require('../services/emailScheduler');
    await EmailScheduler.queueEmail(user.email, 'caregiver_rejection', {
      firstName: user.firstName,
      reason: reason.trim()
    });
    
    res.json({ message: 'Caregiver application rejected' });
  } catch (error) {
    next(error);
  }
};

const toggleUserStatus = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { isActive } = req.body;
    
    const user = await User.findByPk(userId, {
      include: [{ model: Role }]
    });
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Update user status
    await user.update({ isActive });
    
    // Queue status change email
    const EmailScheduler = require('../services/emailScheduler');
    await EmailScheduler.queueEmail(user.email, 'account_status_change', {
      firstName: user.firstName,
      status: isActive ? 'activated' : 'deactivated'
    });
    
    res.json({ 
      message: `User ${isActive ? 'activated' : 'deactivated'} successfully`,
      user: sanitizeUser(user)
    });
  } catch (error) {
    next(error);
  }
};

const getAllUsers = async (req, res, next) => {
  try {
    const { 
      page = 1, 
      limit = 100, 
      search, 
      role, 
      specialty, 
      status,
      slim
    } = req.query;

    // slim=true: dashboard only needs id, firstName, lastName, isActive, Role.name
    if (slim === 'true') {
      const { Op } = require('sequelize');
      const { count, rows: users } = await User.findAndCountAll({
        attributes: ['id', 'firstName', 'lastName', 'isActive'],
        include: [{ model: Role, attributes: ['id', 'name'], required: true }],
        order: [['createdAt', 'DESC']],
        limit: parseInt(limit),
        offset: (parseInt(page) - 1) * parseInt(limit)
      });
      return res.json({
        users: users.map(u => ({
          id: u.id,
          firstName: u.firstName,
          lastName: u.lastName,
          isActive: u.isActive,
          Role: { name: u.Role?.name }
        })),
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / parseInt(limit))
      });
    }
    
    const { Specialty, sequelize, Patient, Caregiver } = require('../models');
    const { Op } = require('sequelize');
    
    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    // Check user permissions to determine which roles they can view
    const userPermissions = req.user.permissions || [];
    const allowedRoles = [];
    
    if (userPermissions.includes('view_caregivers')) allowedRoles.push('caregiver');
    if (userPermissions.includes('view_patients')) allowedRoles.push('patient');
    if (userPermissions.includes('view_accountants')) allowedRoles.push('Accountant');
    if (userPermissions.includes('view_regional_managers')) allowedRoles.push('regional_manager');
    if (userPermissions.includes('view_system_managers')) allowedRoles.push('system_manager');
    
    console.log('User permissions:', userPermissions);
    console.log('Allowed roles:', allowedRoles);

    if (allowedRoles.length === 0) {
      return res.status(403).json({ error: 'No permission to view any users' });
    }

    // Get current user to check assigned region
    const currentUser = await User.findByPk(req.user.id, {
      include: [{ model: Role }]
    });

    console.log('Current user:', {
      id: currentUser.id,
      role: currentUser.Role?.name,
      assignedRegion: currentUser.assignedRegion
    });
    console.log('Query params - role:', role, 'search:', search, 'status:', status);
    
    // Build where conditions
    const userWhere = {};
    const roleWhere = {};
    
    if (search) {
      userWhere[Op.or] = [
        { firstName: { [Op.like]: `%${search}%` } },
        { lastName: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } }
      ];
    }
    
    if (role && role !== 'all') {
      roleWhere.name = role;
    } else {
      // Filter by allowed roles
      roleWhere.name = { [Op.in]: allowedRoles };
    }
    
    // Handle status filter
    let caregiverStatusWhere = {};
    if (status && status !== 'all') {
      if (status === 'rejected') {
        // For rejected status, filter caregivers with REJECTED verification status
        caregiverStatusWhere.verificationStatus = 'REJECTED';
        // Only show caregivers for rejected status
        roleWhere.name = 'caregiver';
      } else {
        // For active/inactive, filter by user's isActive status
        userWhere.isActive = status === 'active';
      }
    }

    // Add region filtering for regional managers and accountants
    let regionFilter = null;
    if (currentUser.Role?.name === 'regional_manager' || currentUser.Role?.name === 'Accountant') {
      if (currentUser.assignedRegion && currentUser.assignedRegion !== 'all') {
        regionFilter = currentUser.assignedRegion;
      }
    }
    
    console.log('Region filter:', regionFilter);
    console.log('Role where:', roleWhere);
    
    // Build query with region filtering at database level
    // Merge caregiver filters (region + verification status)
    let caregiverWhere = { ...caregiverStatusWhere };
    if (regionFilter) {
      caregiverWhere.region = regionFilter;
    }

    const queryOptions = {
      where: userWhere,
      include: [
        {
          model: Role,
          where: roleWhere,
          required: true
        },
        {
          model: Caregiver,
          required: status === 'rejected' ? true : false, // Make required for rejected status
          where: Object.keys(caregiverWhere).length > 0 ? caregiverWhere : undefined,
          include: specialty && specialty !== 'all' ? [{
            model: Specialty,
            where: { id: specialty },
            through: { attributes: [] },
            required: true
          }] : [{
            model: Specialty,
            through: { attributes: [] },
            required: false
          }]
        },
        {
          model: Patient,
          required: false,
          where: regionFilter ? { region: regionFilter } : undefined
        }
      ],
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: offset
    };
    
    // Apply region filtering by making includes required when filtering
    if (regionFilter) {
      console.log('=== REGION FILTER DETECTED ===');
      // Check which roles are being queried to determine which includes to make required
      const rolesBeingQueried = Array.isArray(roleWhere.name?.[Op.in]) ? roleWhere.name[Op.in] : [roleWhere.name];
      console.log('Roles being queried:', rolesBeingQueried);

      // If filtering multiple roles that include both caregivers and patients, use OR condition
      if (rolesBeingQueried.includes('caregiver') && rolesBeingQueried.includes('patient')) {
        console.log('Both caregiver and patient roles detected - using raw SQL approach');
        // Build WHERE conditions for region filtering based on permissions
        const regionConditions = [];
        
        if (rolesBeingQueried.includes('caregiver') && userPermissions.includes('view_caregivers')) {
          regionConditions.push('(r.name = \'caregiver\' AND c.region = :regionFilter)');
        }
        
        if (rolesBeingQueried.includes('patient') && userPermissions.includes('view_patients')) {
          regionConditions.push('(r.name = \'patient\' AND p.region = :regionFilter)');
        }
        
        if (regionConditions.length > 0) {
          console.log('=== EXECUTING RAW SQL QUERY ===');
          console.log('Region filter:', regionFilter);
          console.log('Roles being queried:', rolesBeingQueried);
          console.log('Region conditions:', regionConditions);

          // Use raw SQL for region filtering with proper permission-based conditions
          const usersResult = await sequelize.query(`
            SELECT DISTINCT u.*, r.name as role_name
            FROM users u
            INNER JOIN roles r ON u.role_id = r.id
            LEFT JOIN caregivers c ON u.id = c.userId
            LEFT JOIN patients p ON u.id = p.userId
            WHERE r.name IN (:allowedRoles)
            AND (${regionConditions.join(' OR ')})
            ${search ? 'AND (u.firstName LIKE :search OR u.lastName LIKE :search OR u.email LIKE :search)' : ''}
            ${status && status !== 'all' && status !== 'rejected' ? 'AND u.isActive = :isActive' : ''}
            ${status === 'rejected' ? 'AND c.verificationStatus = \'REJECTED\'' : ''}
            ORDER BY u.createdAt DESC
            LIMIT :limit OFFSET :offset
          `, {
            replacements: {
              allowedRoles: rolesBeingQueried,
              regionFilter,
              ...(search && { search: `%${search}%` }),
              ...(status && status !== 'all' && status !== 'rejected' && { isActive: status === 'active' }),
              limit: parseInt(limit),
              offset
            },
            type: sequelize.QueryTypes.SELECT
          });

          const users = usersResult || [];
          console.log(`Raw SQL returned ${users.length} users`);
          if (users.length > 0) {
            console.log('Sample user roles:', users.slice(0, 3).map(u => ({ id: u.id, role: u.role_name })));
          }

          // Get total count
          const countResult = await sequelize.query(`
            SELECT COUNT(DISTINCT u.id) as count
            FROM users u
            INNER JOIN roles r ON u.role_id = r.id
            LEFT JOIN caregivers c ON u.id = c.userId
            LEFT JOIN patients p ON u.id = p.userId
            WHERE r.name IN (:allowedRoles)
            AND (${regionConditions.join(' OR ')})
            ${search ? 'AND (u.firstName LIKE :search OR u.lastName LIKE :search OR u.email LIKE :search)' : ''}
            ${status && status !== 'all' && status !== 'rejected' ? 'AND u.isActive = :isActive' : ''}
            ${status === 'rejected' ? 'AND c.verificationStatus = \'REJECTED\'' : ''}
          `, {
            replacements: {
              allowedRoles: rolesBeingQueried,
              regionFilter,
              ...(search && { search: `%${search}%` }),
              ...(status && status !== 'all' && status !== 'rejected' && { isActive: status === 'active' })
            },
            type: sequelize.QueryTypes.SELECT
          });
          
          const totalCount = countResult?.[0]?.count || 0;
          
          // Fetch full user objects for the results
          const userIds = users?.map(u => u.id) || [];
          if (userIds.length === 0) {
            return res.json({ 
              users: [],
              total: totalCount,
              page: parseInt(page),
              limit: parseInt(limit),
              totalPages: Math.ceil(totalCount / parseInt(limit))
            });
          }
          
          const fullUsers = await User.findAll({
            where: { id: { [Op.in]: userIds } },
            include: [
              { model: Role },
              { model: Caregiver, required: false },
              { model: Patient, required: false }
            ],
            order: [['createdAt', 'DESC']]
          });
          
          return res.json({
            users: fullUsers.map(sanitizeUser),
            total: totalCount,
            page: parseInt(page),
            limit: parseInt(limit),
            totalPages: Math.ceil(totalCount / parseInt(limit))
          });
        }
      } else {
        // Only set includes as required when filtering a single role type
        if (rolesBeingQueried.includes('caregiver')) {
          queryOptions.include[1].required = true;
        }
        if (rolesBeingQueried.includes('patient')) {
          queryOptions.include[2].required = true;
        }
      }
    }
    
    // If filtering by specialty, we need to ensure only caregivers are returned
    if (specialty && specialty !== 'all') {
      queryOptions.include[1].required = true;
    }
    
    const { count, rows: users } = await User.findAndCountAll(queryOptions);
    
    res.json({ 
      users: users.map(sanitizeUser),
      total: count,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(count / parseInt(limit))
    });
  } catch (error) {
    next(error);
  }
};

const getUserStats = async (req, res, next) => {
  try {
    // Check user permissions to determine which stats they can view
    const userPermissions = req.user.permissions || [];
    const stats = {};
    
    // Get current user to check assigned region
    const currentUser = await User.findByPk(req.user.id, {
      include: [{ model: Role }]
    });
    
    // Determine region filter
    let regionFilter = null;
    if (currentUser.Role?.name === 'regional_manager' || currentUser.Role?.name === 'Accountant') {
      if (currentUser.assignedRegion && currentUser.assignedRegion !== 'all') {
        regionFilter = currentUser.assignedRegion;
      }
    }
    
    // Get total users count based on permissions
    let totalCount = 0;
    let activeCount = 0;
    
    if (userPermissions.includes('view_caregivers')) {
      const caregiverRole = await Role.findOne({ where: { name: 'caregiver' } });
      if (caregiverRole) {
        const caregiverWhere = { role_id: caregiverRole.id };
        const activeCaregiverWhere = { role_id: caregiverRole.id, isActive: true };
        
        if (regionFilter) {
          const { Caregiver } = require('../models');
          const caregivers = await User.count({
            where: caregiverWhere,
            include: [{ model: Caregiver, where: { region: regionFilter }, required: true }]
          });
          const activeCaregivers = await User.count({
            where: activeCaregiverWhere,
            include: [{ model: Caregiver, where: { region: regionFilter }, required: true }]
          });
          stats.caregivers = caregivers;
          totalCount += caregivers;
          activeCount += activeCaregivers;
        } else {
          const caregivers = await User.count({ where: caregiverWhere });
          const activeCaregivers = await User.count({ where: activeCaregiverWhere });
          stats.caregivers = caregivers;
          totalCount += caregivers;
          activeCount += activeCaregivers;
        }
      }
    }
    
    if (userPermissions.includes('view_patients')) {
      const patientRole = await Role.findOne({ where: { name: 'patient' } });
      if (patientRole) {
        const patientWhere = { role_id: patientRole.id };
        const activePatientWhere = { role_id: patientRole.id, isActive: true };
        
        if (regionFilter) {
          const { Patient } = require('../models');
          const patients = await User.count({
            where: patientWhere,
            include: [{ model: Patient, where: { region: regionFilter }, required: true }]
          });
          const activePatients = await User.count({
            where: activePatientWhere,
            include: [{ model: Patient, where: { region: regionFilter }, required: true }]
          });
          stats.patients = patients;
          totalCount += patients;
          activeCount += activePatients;
        } else {
          const patients = await User.count({ where: patientWhere });
          const activePatients = await User.count({ where: activePatientWhere });
          stats.patients = patients;
          totalCount += patients;
          activeCount += activePatients;
        }
      }
    }
    
    if (userPermissions.includes('view_accountants')) {
      const accountantRole = await Role.findOne({ where: { name: 'Accountant' } });
      if (accountantRole) {
        const accountants = await User.count({ where: { role_id: accountantRole.id } });
        const activeAccountants = await User.count({ where: { role_id: accountantRole.id, isActive: true } });
        stats.accountants = accountants;
        totalCount += accountants;
        activeCount += activeAccountants;
      }
    }
    
    if (userPermissions.includes('view_regional_managers')) {
      const regionalManagerRole = await Role.findOne({ where: { name: 'regional_manager' } });
      if (regionalManagerRole) {
        const regionalManagers = await User.count({ where: { role_id: regionalManagerRole.id } });
        const activeRegionalManagers = await User.count({ where: { role_id: regionalManagerRole.id, isActive: true } });
        stats.regionalManagers = regionalManagers;
        totalCount += regionalManagers;
        activeCount += activeRegionalManagers;
      }
    }
    
    if (userPermissions.includes('view_system_managers')) {
      const systemManagerRole = await Role.findOne({ where: { name: 'system_manager' } });
      if (systemManagerRole) {
        const systemManagers = await User.count({ where: { role_id: systemManagerRole.id } });
        const activeSystemManagers = await User.count({ where: { role_id: systemManagerRole.id, isActive: true } });
        stats.systemManagers = systemManagers;
        totalCount += systemManagers;
        activeCount += activeSystemManagers;
      }
    }
    
    stats.total = totalCount;
    stats.active = activeCount;
    
    res.json(stats);
  } catch (error) {
    next(error);
  }
};

// Roles Management
const getAllRoles = async (req, res, next) => {
  try {
    const { sequelize } = require('../models');
    const { Location } = require('../models');
    
    // Check user permissions to determine which roles they can view
    const userPermissions = req.user.permissions || [];
    const allowedRoles = [];
    
    if (userPermissions.includes('view_caregivers')) allowedRoles.push('caregiver');
    if (userPermissions.includes('view_patients')) allowedRoles.push('patient');
    if (userPermissions.includes('view_accountants')) allowedRoles.push('Accountant');
    if (userPermissions.includes('view_regional_managers')) allowedRoles.push('regional_manager');
    if (userPermissions.includes('view_system_managers')) allowedRoles.push('system_manager');
    if (userPermissions.includes('view_roles')) {
      // If user has view_roles permission, they can see all roles
      const allRoles = await Role.findAll({
        attributes: [
          'id',
          'name', 
          'description',
          'createdAt',
          'updatedAt',
          [sequelize.fn('COUNT', sequelize.col('Users.id')), 'userCount']
        ],
        include: [{
          model: User,
          attributes: [],
          required: false
        }],
        group: ['Role.id'],
        order: [['name', 'ASC']]
      });
      
      const regions = await Location.findAll({
        attributes: [[sequelize.fn('DISTINCT', sequelize.col('region')), 'region']],
        order: [['region', 'ASC']]
      });
      
      return res.json({ roles: allRoles, regions: regions.map(r => r.region) });
    }
    
    if (allowedRoles.length === 0) {
      return res.status(403).json({ error: 'No permission to view any roles' });
    }
    
    // Filter roles based on permissions
    const roles = await Role.findAll({
      attributes: [
        'id',
        'name', 
        'description',
        'createdAt',
        'updatedAt',
        [sequelize.fn('COUNT', sequelize.col('Users.id')), 'userCount']
      ],
      where: {
        name: { [require('sequelize').Op.in]: allowedRoles }
      },
      include: [{
        model: User,
        attributes: [],
        required: false
      }],
      group: ['Role.id'],
      order: [['name', 'ASC']]
    });

    const regions = await Location.findAll({
      attributes: [[sequelize.fn('DISTINCT', sequelize.col('region')), 'region']],
      order: [['region', 'ASC']]
    });

    res.json({ roles, regions: regions.map(r => r.region) });
  } catch (error) {
    next(error);
  }
};

const updateUser = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const {
      firstName,
      lastName,
      email,
      phone,
      dateOfBirth,
      address,
      isActive,
      roleId,
      assignedRegion,
      caregiverData
    } = req.body;

    // Get current user to check assigned region
    const currentUser = await User.findByPk(req.user.id, {
      include: [{ model: Role }]
    });

    const user = await User.findByPk(userId, {
      include: [
        { model: Role },
        { model: Caregiver, required: false },
        { model: Patient, required: false }
      ]
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Prevent editing system_manager users
    if (user.Role?.name === 'system_manager') {
      return res.status(403).json({ error: 'Cannot edit system manager users' });
    }

    // Prevent assigning system_manager role
    if (roleId) {
      const newRole = await Role.findByPk(roleId);
      if (newRole?.name === 'system_manager') {
        return res.status(403).json({ error: 'Cannot assign system_manager role' });
      }
    }

    // Check region access for regional managers and accountants
    if (currentUser.Role?.name === 'regional_manager' || currentUser.Role?.name === 'Accountant') {
      if (currentUser.assignedRegion && currentUser.assignedRegion !== 'all') {
        const userRegion = user.Patient?.region || user.Caregiver?.region;
        if (userRegion && userRegion !== currentUser.assignedRegion) {
          return res.status(403).json({ error: 'Access denied - user not in your assigned region' });
        }
      }
    }

    // Update basic user info
    await user.update({
      firstName,
      lastName,
      email,
      phone,
      dateOfBirth,
      address,
      isActive,
      role_id: roleId,
      assignedRegion
    });

    // Update caregiver data if provided
    if (caregiverData && user.Caregiver) {
      await user.Caregiver.update({
        specialtyId: caregiverData.specialtyId,
        yearsOfExperience: caregiverData.yearsOfExperience,
        bio: caregiverData.bio,
        serviceLocations: caregiverData.serviceLocations
      });
    }

    // Reload user with updated data
    await user.reload({
      include: [
        { model: Role },
        { model: Caregiver, required: false }
      ]
    });

    res.json({
      message: 'User updated successfully',
      user: sanitizeUser(user)
    });
  } catch (error) {
    next(error);
  }
};

const getAllPermissions = async (req, res, next) => {
  try {
    const { roleId } = req.query;
    
    if (roleId) {
      // Get permissions for specific role
      const role = await Role.findByPk(roleId, {
        include: [{
          model: Permission,
          through: { attributes: [] }
        }]
      });
      
      if (!role) {
        return res.status(404).json({ error: 'Role not found' });
      }
      
      const allPermissions = await Permission.findAll({
        order: [['name', 'ASC']]
      });
      
      const rolePermissionIds = role.Permissions.map(p => p.id);
      
      const permissionsWithStatus = allPermissions.map(permission => ({
        ...permission.toJSON(),
        hasPermission: rolePermissionIds.includes(permission.id)
      }));
      
      res.json({ permissions: permissionsWithStatus, role });
    } else {
      // Get all permissions
      const permissions = await Permission.findAll({
        order: [['name', 'ASC']]
      });
      
      res.json({ permissions });
    }
  } catch (error) {
    next(error);
  }
};

const updateRolePermissions = async (req, res, next) => {
  try {
    const { roleId } = req.params;
    const { permissionId, hasPermission } = req.body;
    
    const role = await Role.findByPk(roleId);
    if (!role) {
      return res.status(404).json({ error: 'Role not found' });
    }
    
    // Prevent editing system_manager permissions
    if (role.name === 'system_manager') {
      return res.status(403).json({ error: 'Cannot modify system manager permissions' });
    }
    
    const permission = await Permission.findByPk(permissionId);
    if (!permission) {
      return res.status(404).json({ error: 'Permission not found' });
    }
    
    if (hasPermission) {
      await RolePermission.findOrCreate({
        where: { role_id: roleId, permission_id: permissionId }
      });
    } else {
      await RolePermission.destroy({
        where: { role_id: roleId, permission_id: permissionId }
      });
    }
    
    res.json({ message: 'Role permissions updated successfully' });
  } catch (error) {
    next(error);
  }
};

const createUser = async (req, res, next) => {
  try {
    const { firstName, lastName, email, phone, idNumber, password, roleId, assignedRegion } = req.body;

    // Check if email already exists
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: 'Email already exists' });
    }

    // Prevent creating system_manager users
    if (roleId) {
      const role = await Role.findByPk(roleId);
      if (role?.name === 'system_manager') {
        return res.status(403).json({ error: 'Cannot create system_manager users' });
      }
    }

    // Hash the provided password
    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = await User.create({
      firstName,
      lastName,
      email,
      phone,
      idNumber: idNumber || null,
      password: hashedPassword,
      role_id: roleId,
      assignedRegion: (assignedRegion && assignedRegion !== 'all') ? assignedRegion : null,
      isActive: true
    });
    
    // Reload with role
    await user.reload({ include: [{ model: Role }] });
    
    // Queue welcome email
    const EmailScheduler = require('../services/emailScheduler');
    await EmailScheduler.queueEmail(email, 'user_welcome', {
      email,
      firstName,
      lastName,
      password,
      role: user.Role.name,
      assignedRegion: assignedRegion || 'All regions'
    });
    
    res.json({
      message: 'User created successfully',
      user: sanitizeUser(user)
    });
  } catch (error) {
    next(error);
  }
};

// Send custom email to caregiver
const sendEmailToCaregiver = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { subject, message } = req.body;

    if (!subject || subject.trim() === '') {
      return res.status(400).json({ error: 'Email subject is required' });
    }

    if (!message || message.trim() === '') {
      return res.status(400).json({ error: 'Email message is required' });
    }

    const user = await User.findByPk(userId, {
      include: [{ model: Caregiver }, { model: Role }]
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (!user.Caregiver) {
      return res.status(400).json({ error: 'User is not a caregiver' });
    }

    // Get current user (sender) name
    const sender = await User.findByPk(req.user.id);
    const senderName = `${sender.firstName} ${sender.lastName}`;

    // Send email
    const { sendCustomMessageToCaregiver } = require('../services/emailService');
    await sendCustomMessageToCaregiver(
      user.email,
      user.firstName,
      senderName,
      subject.trim(),
      message.trim()
    );

    res.json({
      message: 'Email sent successfully to ' + user.email,
      recipient: {
        id: user.id,
        name: `${user.firstName} ${user.lastName}`,
        email: user.email
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getPendingCaregivers,
  verifyCaregiver,
  rejectCaregiver,
  toggleUserStatus,
  getAllUsers,
  getUserStats,
  getAllRoles,
  updateUser,
  getAllPermissions,
  updateRolePermissions,
  createUser,
  sendEmailToCaregiver
};