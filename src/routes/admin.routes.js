const express = require('express');
const { getPendingCaregivers, verifyCaregiver, rejectCaregiver, toggleUserStatus, getAllUsers, getUserStats, getAllRoles, updateUser, getAllPermissions, updateRolePermissions, createUser, sendEmailToCaregiver } = require('../controllers/adminController');
const { authenticateToken } = require('../middleware/auth.middleware');
const { requireAdmin } = require('../middleware/roleCheck.middleware');
const { requirePermission, requireAnyPermission } = require('../middleware/permissions');
const { sanitizeUser } = require('../utils/helpers');

const router = express.Router();

router.use(authenticateToken);
router.use(requireAdmin);

router.get('/caregivers/pending', requirePermission('view_caregivers'), getPendingCaregivers);

// Get caregivers with region-based access control
router.get('/caregivers', requireAnyPermission(['view_caregivers', 'view_users']), async (req, res, next) => {
  try {
    const { User, Role, Caregiver, Specialty } = require('../models');
    const { Op } = require('sequelize');
    
    // Get current user to check assigned region
    const currentUser = await User.findByPk(req.user.id, {
      include: [{ model: Role }]
    });
    
    const caregiverRole = await Role.findOne({ where: { name: 'caregiver' } });
    
    let whereClause = {
      role_id: caregiverRole.id,
      isActive: true
    };
    
    let caregiverWhereClause = {};
    
    // Apply region filtering for regional managers and accountants
    if (currentUser.Role?.name === 'regional_manager' || currentUser.Role?.name === 'Accountant') {
      if (currentUser.assignedRegion && currentUser.assignedRegion !== 'all') {
        caregiverWhereClause.region = currentUser.assignedRegion;
      }
    }
    
    const caregivers = await User.findAll({
      where: whereClause,
      include: [
        {
          model: Caregiver,
          where: caregiverWhereClause,
          required: true,
          include: [
            {
              model: Specialty,
              through: { attributes: [] },
              attributes: ['id', 'name', 'description', 'sessionFee', 'bookingFee']
            }
          ]
        },
        { model: Role }
      ],
      order: [['createdAt', 'DESC']]
    });
    
    res.json({
      success: true,
      caregivers: caregivers.map(sanitizeUser)
    });
  } catch (error) {
    next(error);
  }
});
router.get('/caregivers/pending-verification', requirePermission('view_caregivers'), async (req, res, next) => {
  try {
    const { User, Role, Caregiver } = require('../models');
    const { page = 1, limit = 100 } = req.query;
    const caregiverRole = await Role.findOne({ where: { name: 'caregiver' } });

    const { count, rows: pendingCaregivers } = await User.findAndCountAll({
      where: {
        role_id: caregiverRole.id
      },
      include: [
        {
          model: Caregiver,
          where: { verificationStatus: 'pending' }
        },
        { model: Role }
      ],
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: (parseInt(page) - 1) * parseInt(limit),
      distinct: true
    });

    res.json({
      caregivers: pendingCaregivers.map(sanitizeUser),
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(count / parseInt(limit)),
        totalRecords: count
      }
    });
  } catch (error) {
    next(error);
  }
});
router.put('/caregivers/:userId/verify', requirePermission('approve_caregivers'), verifyCaregiver);
router.put('/caregivers/:userId/reject', requirePermission('approve_caregivers'), rejectCaregiver);
router.post('/caregivers/:userId/send-email', requireAnyPermission(['edit_caregivers', 'approve_caregivers']), sendEmailToCaregiver);
router.put('/users/:userId/toggle-status', requireAnyPermission(['edit_caregivers', 'edit_patients', 'edit_accountants', 'edit_regional_managers']), toggleUserStatus);
router.get('/users', requireAnyPermission(['view_users', 'view_caregivers', 'view_patients', 'view_accountants', 'view_regional_managers', 'view_system_managers']), getAllUsers);
router.post('/users', requirePermission('create_users'), createUser);
router.get('/users/stats', requireAnyPermission(['view_users', 'view_caregivers', 'view_patients', 'view_accountants', 'view_regional_managers', 'view_system_managers']), getUserStats);

// Roles Management Routes
router.get('/roles', requireAnyPermission(['view_roles', 'create_users', 'view_caregivers', 'view_patients', 'view_accountants', 'view_regional_managers', 'view_system_managers']), getAllRoles);

// Permissions Management Routes
router.get('/permissions', requirePermission('view_permissions'), getAllPermissions);
router.put('/roles/:roleId/permissions', requirePermission('assign_permissions'), updateRolePermissions);

// Admin Withdrawals Management
router.get('/withdrawals', requirePermission('view_withdrawal_requests'), async (req, res, next) => {
  try {
    const { User, Role, Caregiver, CaregiverEarnings, WithdrawalRequest, sequelize } = require('../models');
    const { Op } = require('sequelize');
    
    const { 
      page = 1, 
      limit = 20, 
      region, 
      search,
      sortBy = 'totalEarnings',
      sortOrder = 'DESC'
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    // Get current user for region filtering
    const currentUser = await User.findByPk(req.user.id, {
      include: [{ model: Role }]
    });
    
    let caregiverWhereClause = {
      verificationStatus: 'APPROVED'
    };
    
    // Apply region filtering for regional managers
    if (currentUser.Role?.name === 'regional_manager' || currentUser.Role?.name === 'Accountant') {
      if (currentUser.assignedRegion && currentUser.assignedRegion !== 'all') {
        caregiverWhereClause.region = currentUser.assignedRegion;
      }
    }
    
    // Add region filter if specified
    if (region) {
      caregiverWhereClause.region = region;
    }
    
    // Build user search clause
    let userWhereClause = {};
    if (search) {
      userWhereClause[Op.or] = [
        { firstName: { [Op.like]: `%${search}%` } },
        { lastName: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } }
      ];
    }

    // Get caregiver role
    const caregiverRole = await Role.findOne({ where: { name: 'caregiver' } });

    // Single optimized query with all data
    const { count, rows: caregivers } = await User.findAndCountAll({
      where: {
        ...userWhereClause,
        role_id: caregiverRole.id,
        isActive: true
      },
      include: [
        {
          model: Caregiver,
          where: caregiverWhereClause,
          required: true,
          include: [
            {
              model: CaregiverEarnings,
              required: false,
              attributes: ['totalCaregiverEarnings', 'walletBalance']
            }
          ]
        }
      ],
      attributes: ['id', 'firstName', 'lastName', 'email', 'phone', 'createdAt'],
      order: [
        sortBy === 'name' ? ['firstName', sortOrder] :
        ['createdAt', sortOrder]
      ],
      limit: parseInt(limit),
      offset: offset,
      distinct: true,
      subQuery: false
    });

    res.json({
      success: true,
      data: {
        caregivers: caregivers.map(caregiver => ({
          id: caregiver.id,
          name: `${caregiver.firstName} ${caregiver.lastName}`,
          email: caregiver.email,
          phone: caregiver.phone,
          region: caregiver.Caregiver?.region,
          district: caregiver.Caregiver?.district,
          totalEarnings: parseFloat(caregiver.Caregiver?.CaregiverEarning?.totalCaregiverEarnings || 0),
          availableBalance: parseFloat(caregiver.Caregiver?.CaregiverEarning?.walletBalance || 0),
          joinedAt: caregiver.createdAt
        })),
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(count / parseInt(limit)),
          totalRecords: count,
          pageSize: parseInt(limit)
        },
        stats: {
          recentWithdrawals: []
        }
      }
    });
  } catch (error) {
    console.error('Admin withdrawals error:', error);
    next(error);
  }
});

// Get specific caregiver withdrawal details
router.get('/withdrawals/caregiver/:caregiverId', requirePermission('view_withdrawal_requests'), async (req, res, next) => {
  try {
    const { WithdrawalRequest, CaregiverEarnings, Caregiver, User } = require('../models');
    const { page = 1, limit = 10 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const [earnings, withdrawals] = await Promise.all([
      CaregiverEarnings.findOne({
        where: { caregiverId: req.params.caregiverId }
      }),
      
      WithdrawalRequest.findAndCountAll({
        where: { caregiverId: req.params.caregiverId },
        order: [['requestedAt', 'DESC']],
        limit: parseInt(limit),
        offset: offset
      })
    ]);

    res.json({
      success: true,
      data: {
        earnings: {
          totalEarnings: parseFloat(earnings?.totalCaregiverEarnings || 0),
          availableBalance: parseFloat(earnings?.walletBalance || 0)
        },
        withdrawals: withdrawals.rows,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(withdrawals.count / parseInt(limit)),
          totalRecords: withdrawals.count,
          pageSize: parseInt(limit)
        }
      }
    });
  } catch (error) {
    console.error('Caregiver withdrawal details error:', error);
    next(error);
  }
});

router.get('/reports', (req, res) => {
  res.json({
    message: 'Admin reports endpoint',
    period: req.query.period || 'this-month'
  });
});

// Analytics: Appointments by Specialty
router.get('/analytics/specialty-appointments', async (req, res, next) => {
  try {
    const { Appointment, Specialty, sequelize } = require('../models');
    const { Op } = require('sequelize');

    const { period = 'this-month' } = req.query;

    // Calculate date range
    let startDate = new Date();
    switch (period) {
      case 'this-week':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case 'last-month':
        startDate.setMonth(startDate.getMonth() - 2);
        break;
      case 'this-year':
        startDate.setMonth(0);
        startDate.setDate(1);
        break;
      case 'this-month':
      default:
        startDate.setMonth(startDate.getMonth() - 1);
    }

    const specialtyStats = await Appointment.findAll({
      attributes: [
        'specialtyId',
        [sequelize.fn('COUNT', sequelize.col('Appointment.id')), 'appointmentCount'],
        [sequelize.fn('SUM', sequelize.col('totalCost')), 'totalRevenue'],
        [sequelize.fn('AVG', sequelize.col('totalCost')), 'avgRevenue']
      ],
      where: {
        createdAt: { [Op.gte]: startDate }
      },
      include: [{
        model: Specialty,
        attributes: ['id', 'name', 'sessionFee', 'bookingFee']
      }],
      group: ['specialtyId', 'Specialty.id'],
      order: [[sequelize.fn('COUNT', sequelize.col('Appointment.id')), 'DESC']],
      raw: false
    });

    res.json({
      success: true,
      data: specialtyStats,
      period
    });
  } catch (error) {
    next(error);
  }
});

// Analytics: Top Caregivers by Appointments
router.get('/analytics/top-caregivers', async (req, res, next) => {
  try {
    const { Appointment, User, Caregiver, sequelize } = require('../models');
    const { Op } = require('sequelize');

    const { period = 'this-month', limit = 10 } = req.query;

    let startDate = new Date();
    switch (period) {
      case 'this-week':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case 'last-month':
        startDate.setMonth(startDate.getMonth() - 2);
        break;
      case 'this-year':
        startDate.setMonth(0);
        startDate.setDate(1);
        break;
      case 'this-month':
      default:
        startDate.setMonth(startDate.getMonth() - 1);
    }

    const topCaregivers = await Appointment.findAll({
      attributes: [
        'caregiverId',
        [sequelize.fn('COUNT', sequelize.col('Appointment.id')), 'appointmentCount'],
        [sequelize.fn('SUM', sequelize.col('totalCost')), 'totalEarnings']
      ],
      where: {
        createdAt: { [Op.gte]: startDate }
      },
      include: [{
        model: Caregiver,
        include: [{
          model: User,
          attributes: ['id', 'firstName', 'lastName', 'email']
        }]
      }],
      group: ['caregiverId', 'Caregiver.id', 'Caregiver.User.id'],
      order: [[sequelize.fn('COUNT', sequelize.col('Appointment.id')), 'DESC']],
      limit: parseInt(limit),
      raw: false
    });

    res.json({
      success: true,
      data: topCaregivers,
      period
    });
  } catch (error) {
    next(error);
  }
});

// Analytics: Appointment Statistics
router.get('/analytics/appointment-stats', async (req, res, next) => {
  try {
    const { Appointment, sequelize } = require('../models');
    const { Op } = require('sequelize');

    const { period = 'this-month' } = req.query;

    let startDate = new Date();
    switch (period) {
      case 'this-week':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case 'last-month':
        startDate.setMonth(startDate.getMonth() - 2);
        break;
      case 'this-year':
        startDate.setMonth(0);
        startDate.setDate(1);
        break;
      case 'this-month':
      default:
        startDate.setMonth(startDate.getMonth() - 1);
    }

    const stats = await Appointment.findAll({
      attributes: [
        'status',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
        [sequelize.fn('SUM', sequelize.col('totalCost')), 'totalAmount']
      ],
      where: {
        createdAt: { [Op.gte]: startDate }
      },
      group: ['status'],
      raw: true
    });

    const total = await Appointment.count({
      where: {
        createdAt: { [Op.gte]: startDate }
      }
    });

    const totalRevenue = await Appointment.sum('totalCost', {
      where: {
        createdAt: { [Op.gte]: startDate },
        status: 'completed'
      }
    });

    res.json({
      success: true,
      data: {
        byStatus: stats,
        total,
        totalRevenue: totalRevenue || 0
      },
      period
    });
  } catch (error) {
    next(error);
  }
});

// Analytics: Revenue by Specialty
router.get('/analytics/revenue-by-specialty', async (req, res, next) => {
  try {
    const { Appointment, Specialty, sequelize } = require('../models');
    const { Op } = require('sequelize');

    const { period = 'this-month' } = req.query;

    let startDate = new Date();
    switch (period) {
      case 'this-week':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case 'last-month':
        startDate.setMonth(startDate.getMonth() - 2);
        break;
      case 'this-year':
        startDate.setMonth(0);
        startDate.setDate(1);
        break;
      case 'this-month':
      default:
        startDate.setMonth(startDate.getMonth() - 1);
    }

    const revenueStats = await Appointment.findAll({
      attributes: [
        'specialtyId',
        [sequelize.fn('SUM', sequelize.col('totalCost')), 'totalRevenue'],
        [sequelize.fn('COUNT', sequelize.col('Appointment.id')), 'appointmentCount']
      ],
      where: {
        createdAt: { [Op.gte]: startDate },
        status: 'completed'
      },
      include: [{
        model: Specialty,
        attributes: ['id', 'name', 'sessionFee', 'bookingFee']
      }],
      group: ['specialtyId', 'Specialty.id'],
      order: [[sequelize.fn('SUM', sequelize.col('totalCost')), 'DESC']],
      raw: false
    });

    res.json({
      success: true,
      data: revenueStats,
      period
    });
  } catch (error) {
    next(error);
  }
});

router.get('/users/:userId', requireAnyPermission(['view_caregivers', 'view_patients', 'view_accountants', 'view_regional_managers', 'view_system_managers']), async (req, res, next) => {
  try {
    const { User, Role, Patient, Caregiver, Specialty } = require('../models');
    
    // Get current user to check assigned region
    const currentUser = await User.findByPk(req.user.id, {
      include: [{ model: Role }]
    });
    
    const user = await User.findByPk(req.params.userId, {
      include: [
        { model: Role },
        { model: Patient, required: false },
        {
          model: Caregiver,
          required: false,
          include: [{ model: Specialty, through: { attributes: [] } }]
        }
      ]
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
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

    res.json({ user: sanitizeUser(user) });
  } catch (error) {
    next(error);
  }
});

router.put('/users/:userId', requireAnyPermission(['edit_caregivers', 'edit_patients', 'edit_accountants', 'edit_regional_managers']), updateUser);

// Get caregiver appointments with patient and transaction details
router.get('/caregivers/:caregiverId/appointments', requirePermission('view_caregivers'), async (req, res, next) => {
  try {
    const { Appointment, Patient, User, Specialty, PaymentTransaction } = require('../models');
    const { caregiverId } = req.params;

    const appointments = await Appointment.findAll({
      where: { caregiverId },
      include: [
        {
          model: Patient,
          include: [{
            model: User,
            attributes: ['id', 'firstName', 'lastName', 'email', 'phone']
          }]
        },
        {
          model: Specialty,
          attributes: ['id', 'name']
        },
        {
          model: PaymentTransaction,
          required: false,
          attributes: ['id', 'amount', 'status', 'paystackReference', 'createdAt']
        }
      ],
      order: [['scheduledDate', 'DESC']]
    });

    res.json({
      success: true,
      appointments
    });
  } catch (error) {
    next(error);
  }
});

// Get unique patients served by caregiver
router.get('/caregivers/:caregiverId/patients', async (req, res, next) => {
  try {
    const { Appointment, Patient, User, sequelize } = require('../models');
    const { caregiverId } = req.params;

    const patients = await Appointment.findAll({
      where: { caregiverId },
      attributes: [
        'patientId',
        [sequelize.fn('COUNT', sequelize.col('Appointment.id')), 'appointmentCount'],
        [sequelize.fn('MAX', sequelize.col('Appointment.scheduledDate')), 'lastAppointment']
      ],
      include: [{
        model: Patient,
        include: [{
          model: User,
          attributes: ['id', 'firstName', 'lastName', 'email', 'phone']
        }]
      }],
      group: ['patientId', 'Patient.id', 'Patient.User.id'],
      order: [[sequelize.fn('MAX', sequelize.col('Appointment.scheduledDate')), 'DESC']],
      raw: false
    });

    res.json({
      success: true,
      patients
    });
  } catch (error) {
    next(error);
  }
});

// Get caregiver transactions
router.get('/caregivers/:caregiverId/transactions', async (req, res, next) => {
  try {
    const { Appointment, PaymentTransaction, Patient, User, Specialty } = require('../models');
    const { caregiverId } = req.params;

    const transactions = await PaymentTransaction.findAll({
      include: [{
        model: Appointment,
        where: { caregiverId },
        include: [
          {
            model: Patient,
            include: [{
              model: User,
              attributes: ['id', 'firstName', 'lastName', 'email']
            }]
          },
          {
            model: Specialty,
            attributes: ['id', 'name']
          }
        ]
      }],
      order: [['createdAt', 'DESC']]
    });

    const totalEarnings = transactions
      .filter(t => t.status === 'completed')
      .reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);

    res.json({
      success: true,
      transactions,
      totalEarnings
    });
  } catch (error) {
    next(error);
  }
});

router.delete('/users/:userId', requirePermission('delete_users'), async (req, res, next) => {
  try {
    const { User, Caregiver, Role } = require('../models');

    const user = await User.findByPk(req.params.userId, {
      include: [
        { model: Role },
        { model: Caregiver }
      ]
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Prevent deleting yourself
    if (user.id === req.user.id) {
      return res.status(403).json({ error: 'You cannot delete your own account' });
    }

    // Only allow deletion of inactive/deactivated users or rejected caregivers
    const isInactive = !user.isActive;
    const isRejectedCaregiver = user.Role?.name === 'caregiver' && user.Caregiver?.verificationStatus === 'REJECTED';

    if (!isInactive && !isRejectedCaregiver) {
      return res.status(403).json({
        error: 'Only inactive/deactivated users or rejected caregivers can be deleted. Deactivate the user first.'
      });
    }

    await user.destroy();

    res.json({
      success: true,
      message: `User ${user.firstName} ${user.lastName} deleted successfully`
    });
  } catch (error) {
    next(error);
  }
});

// Location-wise statistics for caregivers
router.get('/analytics/caregivers-by-location', async (req, res, next) => {
  try {
    const { User, Role, Caregiver, sequelize } = require('../models');
    const { groupBy = 'region' } = req.query; // region, district, traditionalAuthority, village

    const caregiverRole = await Role.findOne({ where: { name: 'caregiver' } });

    let groupFields = [];
    let selectFields = [];

    if (groupBy === 'region' || groupBy === 'all') {
      groupFields.push(sequelize.literal('`Caregiver`.`region`'));
      selectFields.push([sequelize.col('Caregiver.region'), 'region']);
    }
    if (groupBy === 'district' || groupBy === 'all') {
      groupFields.push(sequelize.literal('`Caregiver`.`district`'));
      selectFields.push([sequelize.col('Caregiver.district'), 'district']);
    }
    if (groupBy === 'traditionalAuthority' || groupBy === 'all') {
      groupFields.push(sequelize.literal('`Caregiver`.`traditional_authority`'));
      selectFields.push([sequelize.literal('`Caregiver`.`traditional_authority`'), 'traditionalAuthority']);
    }
    if (groupBy === 'village' || groupBy === 'all') {
      groupFields.push(sequelize.literal('`Caregiver`.`village`'));
      selectFields.push([sequelize.col('Caregiver.village'), 'village']);
    }

    // Default to region if nothing specified
    if (groupFields.length === 0) {
      groupFields = [sequelize.literal('`Caregiver`.`region`')];
      selectFields = [[sequelize.col('Caregiver.region'), 'region']];
    }

    const locationStats = await User.findAll({
      attributes: [
        ...selectFields,
        [sequelize.fn('COUNT', sequelize.col('User.id')), 'caregiverCount']
      ],
      where: {
        role_id: caregiverRole.id,
        isActive: true
      },
      include: [{
        model: Caregiver,
        attributes: [],
        where: {
          verificationStatus: 'verified'
        }
      }],
      group: groupFields,
      order: [[sequelize.fn('COUNT', sequelize.col('User.id')), 'DESC']],
      raw: true
    });

    res.json({
      success: true,
      data: locationStats,
      groupBy
    });
  } catch (error) {
    console.error('Caregivers by location error:', error.message);
    console.error('Full error:', error);
    next(error);
  }
});

// Location-wise statistics for patients
router.get('/analytics/patients-by-location', async (req, res, next) => {
  try {
    const { User, Role, Patient, sequelize } = require('../models');
    const { groupBy = 'region' } = req.query;

    const patientRole = await Role.findOne({ where: { name: 'patient' } });

    let groupFields = [];
    let selectFields = [];

    if (groupBy === 'region' || groupBy === 'all') {
      groupFields.push(sequelize.literal('`Patient`.`region`'));
      selectFields.push([sequelize.col('Patient.region'), 'region']);
    }
    if (groupBy === 'district' || groupBy === 'all') {
      groupFields.push(sequelize.literal('`Patient`.`district`'));
      selectFields.push([sequelize.col('Patient.district'), 'district']);
    }
    if (groupBy === 'traditionalAuthority' || groupBy === 'all') {
      groupFields.push(sequelize.literal('`Patient`.`traditional_authority`'));
      selectFields.push([sequelize.literal('`Patient`.`traditional_authority`'), 'traditionalAuthority']);
    }
    if (groupBy === 'village' || groupBy === 'all') {
      groupFields.push(sequelize.literal('`Patient`.`village`'));
      selectFields.push([sequelize.col('Patient.village'), 'village']);
    }

    if (groupFields.length === 0) {
      groupFields = [sequelize.literal('`Patient`.`region`')];
      selectFields = [[sequelize.col('Patient.region'), 'region']];
    }

    const locationStats = await User.findAll({
      attributes: [
        ...selectFields,
        [sequelize.fn('COUNT', sequelize.col('User.id')), 'patientCount']
      ],
      where: {
        role_id: patientRole.id,
        isActive: true
      },
      include: [{
        model: Patient,
        attributes: [],
        required: true
      }],
      group: groupFields,
      order: [[sequelize.fn('COUNT', sequelize.col('User.id')), 'DESC']],
      raw: true
    });

    res.json({
      success: true,
      data: locationStats,
      groupBy
    });
  } catch (error) {
    console.error('Patients by location error:', error.message);
    console.error('Full error:', error);
    next(error);
  }
});

// Combined location statistics
router.get('/analytics/location-summary', async (req, res, next) => {
  try {
    const { User, Role, Caregiver, Patient, sequelize } = require('../models');

    const caregiverRole = await Role.findOne({ where: { name: 'caregiver' } });
    const patientRole = await Role.findOne({ where: { name: 'patient' } });

    // Get caregivers by region
    const caregiversByRegion = await User.findAll({
      attributes: [
        [sequelize.col('Caregiver.region'), 'region'],
        [sequelize.fn('COUNT', sequelize.col('User.id')), 'count']
      ],
      where: {
        role_id: caregiverRole.id,
        isActive: true
      },
      include: [{
        model: Caregiver,
        attributes: [],
        where: { verificationStatus: 'verified' }
      }],
      group: [sequelize.literal('`Caregiver`.`region`')],
      raw: true
    });

    // Get patients by region
    const patientsByRegion = await User.findAll({
      attributes: [
        [sequelize.col('Patient.region'), 'region'],
        [sequelize.fn('COUNT', sequelize.col('User.id')), 'count']
      ],
      where: {
        role_id: patientRole.id,
        isActive: true
      },
      include: [{
        model: Patient,
        attributes: [],
        required: true
      }],
      group: [sequelize.literal('`Patient`.`region`')],
      raw: true
    });

    // Combine data by region
    const regionMap = new Map();

    caregiversByRegion.forEach(item => {
      if (item.region) {
        regionMap.set(item.region, {
          region: item.region,
          caregivers: parseInt(item.count) || 0,
          patients: 0
        });
      }
    });

    patientsByRegion.forEach(item => {
      if (item.region) {
        if (regionMap.has(item.region)) {
          regionMap.get(item.region).patients = parseInt(item.count) || 0;
        } else {
          regionMap.set(item.region, {
            region: item.region,
            caregivers: 0,
            patients: parseInt(item.count) || 0
          });
        }
      }
    });

    const summary = Array.from(regionMap.values())
      .sort((a, b) => (b.caregivers + b.patients) - (a.caregivers + a.patients));

    res.json({
      success: true,
      data: summary
    });
  } catch (error) {
    next(error);
  }
});

// Admin Withdrawal Management Routes
router.get('/withdrawals/overview', requirePermission('view_withdrawal_requests'), async (req, res, next) => {
  try {
    const { CaregiverEarnings, WithdrawalRequest, Caregiver, User, Role, sequelize } = require('../models');
    const { Op } = require('sequelize');
    const { page = 1, limit = 20, search = '', region = '', caregiverId = '' } = req.query;

    // Get current user for region filtering
    const currentUser = await User.findByPk(req.user.id, {
      include: [{ model: Role }]
    });

    const userWhere = {};
    if (search) {
      userWhere[Op.or] = [
        { firstName: { [Op.like]: `%${search}%` } },
        { lastName: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } }
      ];
    }

    const caregiverWhere = { verificationStatus: 'APPROVED' };

    // Apply region filtering for regional managers and accountants
    if (currentUser.Role?.name === 'regional_manager' || currentUser.Role?.name === 'Accountant') {
      if (currentUser.assignedRegion && currentUser.assignedRegion !== 'all') {
        caregiverWhere.region = currentUser.assignedRegion;
      }
    }

    if (region) caregiverWhere.region = region;
    if (caregiverId) caregiverWhere.id = parseInt(caregiverId);

    const { count, rows: caregivers } = await Caregiver.findAndCountAll({
      where: caregiverWhere,
      include: [
        {
          model: User,
          attributes: ['id', 'firstName', 'lastName', 'email', 'phone'],
          where: userWhere,
          required: true
        },
        { model: CaregiverEarnings, required: false }
      ],
      order: [[{ model: User }, 'firstName', 'ASC']],
      limit: parseInt(limit),
      offset: (parseInt(page) - 1) * parseInt(limit),
      distinct: true
    });

    // Get withdrawal stats for the returned caregivers only
    const caregiverIds = caregivers.map(c => c.id);
    const withdrawalStats = await WithdrawalRequest.findAll({
      attributes: [
        [sequelize.col('caregiver_id'), 'caregiverId'],
        [sequelize.fn('COUNT', sequelize.col('id')), 'totalWithdrawals'],
        [sequelize.fn('SUM', sequelize.col('requested_amount')), 'totalWithdrawn'],
        [sequelize.fn('MAX', sequelize.col('requested_at')), 'lastWithdrawal']
      ],
      where: { caregiverId: { [Op.in]: caregiverIds } },
      group: ['caregiver_id'],
      raw: true
    });

    const withdrawalMap = new Map();
    withdrawalStats.forEach(stat => {
      withdrawalMap.set(stat.caregiverId, stat);
    });

    const overview = caregivers.map(caregiver => {
      const earnings = caregiver.CaregiverEarning || {};
      const wStat = withdrawalMap.get(caregiver.id) || {};
      return {
        id: caregiver.id,
        name: `${caregiver.User.firstName} ${caregiver.User.lastName}`,
        email: caregiver.User.email,
        phone: caregiver.User.phone,
        totalEarnings: parseFloat(earnings.totalCaregiverEarnings || 0).toFixed(2),
        availableBalance: parseFloat(earnings.walletBalance || 0).toFixed(2),
        lockedBalance: parseFloat(earnings.lockedBalance || 0).toFixed(2),
        totalWithdrawals: parseInt(wStat.totalWithdrawals || 0),
        totalWithdrawn: parseFloat(wStat.totalWithdrawn || 0).toFixed(2),
        lastWithdrawal: wStat.lastWithdrawal || null,
        region: caregiver.region,
        district: caregiver.district
      };
    });

    res.json({
      success: true,
      caregivers: overview,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(count / parseInt(limit)),
        totalRecords: count
      }
    });
  } catch (error) {
    next(error);
  }
});

router.get('/withdrawals/history', requirePermission('view_withdrawal_requests'), async (req, res, next) => {
  try {
    const { WithdrawalRequest, Caregiver, User, Role } = require('../models');
    const { page = 1, limit = 50, status, caregiverId } = req.query;

    // Get current user for region filtering
    const currentUser = await User.findByPk(req.user.id, {
      include: [{ model: Role }]
    });

    let whereClause = {};
    if (status) whereClause.status = status;
    if (caregiverId) whereClause.caregiverId = caregiverId;

    // Build caregiver where clause for region filtering
    let caregiverWhere = {};
    if (currentUser.Role?.name === 'regional_manager' || currentUser.Role?.name === 'Accountant') {
      if (currentUser.assignedRegion && currentUser.assignedRegion !== 'all') {
        caregiverWhere.region = currentUser.assignedRegion;
      }
    }

    const { count, rows: withdrawals } = await WithdrawalRequest.findAndCountAll({
      where: whereClause,
      include: [{
        model: Caregiver,
        where: Object.keys(caregiverWhere).length > 0 ? caregiverWhere : undefined,
        required: true,
        include: [{
          model: User,
          attributes: ['firstName', 'lastName', 'email']
        }]
      }],
      order: [['requestedAt', 'DESC']],
      limit: parseInt(limit),
      offset: (parseInt(page) - 1) * parseInt(limit)
    });

    res.json({
      success: true,
      withdrawals,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(count / parseInt(limit)),
        totalRecords: count
      }
    });
  } catch (error) {
    next(error);
  }
});

router.get('/withdrawals/stats', requirePermission('view_withdrawal_requests'), async (req, res, next) => {
  try {
    const { WithdrawalRequest, CaregiverEarnings, Caregiver, User, Role, sequelize } = require('../models');
    const { Op } = require('sequelize');

    // Get current user for region filtering
    const currentUser = await User.findByPk(req.user.id, {
      include: [{ model: Role }]
    });

    // Get list of caregiver IDs in the assigned region (if applicable)
    let caregiverIds = null;
    if (currentUser.Role?.name === 'regional_manager' || currentUser.Role?.name === 'Accountant') {
      if (currentUser.assignedRegion && currentUser.assignedRegion !== 'all') {
        const caregivers = await Caregiver.findAll({
          where: { region: currentUser.assignedRegion },
          attributes: ['id']
        });
        caregiverIds = caregivers.map(c => c.id);
      }
    }

    // Build where clause for withdrawal requests
    const withdrawalWhere = caregiverIds ? { caregiverId: { [Op.in]: caregiverIds } } : {};
    const earningsWhere = caregiverIds ? { caregiverId: { [Op.in]: caregiverIds } } : {};

    const totalPending = await WithdrawalRequest.sum('requestedAmount', {
      where: { ...withdrawalWhere, status: 'pending' }
    }) || 0;

    const totalProcessed = await WithdrawalRequest.sum('netPayout', {
      where: { ...withdrawalWhere, status: 'completed' }
    }) || 0;

    const totalAvailableBalance = await CaregiverEarnings.sum('walletBalance', {
      where: earningsWhere
    }) || 0;

    const totalLockedBalance = await CaregiverEarnings.sum('lockedBalance', {
      where: earningsWhere
    }) || 0;

    const monthlyStats = await WithdrawalRequest.findAll({
      attributes: [
        [sequelize.fn('DATE_FORMAT', sequelize.col('requested_at'), '%Y-%m'), 'month'],
        [sequelize.fn('COUNT', sequelize.col('WithdrawalRequest.id')), 'count'],
        [sequelize.fn('SUM', sequelize.col('net_payout')), 'totalAmount']
      ],
      where: {
        ...withdrawalWhere,
        requestedAt: {
          [Op.gte]: new Date(new Date().setMonth(new Date().getMonth() - 12))
        }
      },
      group: [sequelize.fn('DATE_FORMAT', sequelize.col('requested_at'), '%Y-%m')],
      order: [[sequelize.fn('DATE_FORMAT', sequelize.col('requested_at'), '%Y-%m'), 'ASC']],
      raw: true
    });

    res.json({
      success: true,
      stats: {
        totalPending,
        totalProcessed,
        totalAvailableBalance,
        totalLockedBalance,
        monthlyStats
      }
    });
  } catch (error) {
    next(error);
  }
});

// Get PayChangu wallet balance (live balance from payment provider)
router.get('/withdrawals/paychangu-balance', requirePermission('view_paychangu_balance'), async (req, res, next) => {
  try {
    const axios = require('axios');
    const paymentConfig = require('../config/payment');

    const response = await axios.get(`${paymentConfig.paychangu.apiUrl}/wallet-balance`, {
      params: { currency: 'MWK' },
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${paymentConfig.paychangu.secretKey}`
      }
    });

    res.json({
      success: true,
      balance: response.data.data
    });
  } catch (error) {
    console.error('Failed to fetch PayChangu balance:', error.response?.data || error.message);
    next(error);
  }
});

module.exports = router;