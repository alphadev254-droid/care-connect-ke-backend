const express = require('express');
const { authenticateToken } = require('../middleware/auth.middleware');
const { requirePermission } = require('../middleware/permissions');
const { PaymentTransaction, Appointment, Patient, User, Caregiver, Specialty } = require('../models');
const { Op } = require('sequelize');

const router = express.Router();

router.use(authenticateToken);

// Get earnings for admin (all platform earnings)
router.get('/admin', requirePermission('view_financial_reports'), async (req, res, next) => {
  try {
    const { period = 'this-month', caregiverId, region, district, traditionalAuthority, village, patientSearch, startDate, endDate, page = 1, limit = 100, summary } = req.query;
    
    // Check if user has permission and role
    if (!['system_manager', 'regional_manager', 'Accountant'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Access denied. Admin role required.' });
    }

    // Get user's assigned region for filtering
    let userRegionFilter = null;
    if (req.user.role === 'regional_manager' || req.user.role === 'Accountant') {
      const userProfile = await User.findByPk(req.user.id, { attributes: ['assignedRegion'] });
      if (userProfile?.assignedRegion && userProfile.assignedRegion !== 'all') {
        userRegionFilter = userProfile.assignedRegion;
      }
    }

    // Get date range
    const now = new Date();
    let dateStart, dateEnd;
    if (period === 'custom' && startDate && endDate) {
      dateStart = new Date(startDate);
      dateEnd = new Date(endDate);
      dateEnd.setHours(23, 59, 59, 999);
    } else {
      switch (period) {
        case 'this-week':  dateStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay()); break;
        case 'this-month': dateStart = new Date(now.getFullYear(), now.getMonth(), 1); break;
        case 'last-month':
          dateStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
          dateEnd   = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
          break;
        case 'this-year':  dateStart = new Date(now.getFullYear(), 0, 1); break;
        default:           dateStart = new Date(now.getFullYear(), now.getMonth(), 1);
      }
      if (!dateEnd) dateEnd = new Date();
    }

    const whereConditions = { createdAt: { [Op.gte]: dateStart, [Op.lte]: dateEnd } };
    const appointmentWhere = {};
    const caregiverWhere = {};

    if (userRegionFilter) {
      caregiverWhere.region = userRegionFilter;
    } else if (region && region !== 'all') {
      caregiverWhere.region = region;
    }
    if (caregiverId && caregiverId !== 'all') appointmentWhere.caregiverId = caregiverId;
    if (district && district !== 'all') caregiverWhere.district = district;
    if (traditionalAuthority && traditionalAuthority !== 'all') caregiverWhere.traditionalAuthority = traditionalAuthority;
    if (village && village !== 'all') caregiverWhere.village = village;

    const hasCaregiverFilter = Object.keys(caregiverWhere).length > 0;
    const hasAppointmentFilter = Object.keys(appointmentWhere).length > 0;

    // ── summary=true: return only aggregates, no rows ──────────────────────
    if (summary === 'true') {
      const sequelize = require('../config/database');
      const { fn, col, literal } = require('sequelize');

      const aggIncludes = [
        {
          model: Appointment,
          required: hasCaregiverFilter || hasAppointmentFilter,
          where: hasAppointmentFilter ? appointmentWhere : undefined,
          attributes: [],
          include: hasCaregiverFilter ? [{
            model: Caregiver,
            where: caregiverWhere,
            required: true,
            attributes: []
          }] : []
        }
      ];

      const rows = await PaymentTransaction.findAll({
        attributes: [
          [fn('SUM', literal('CASE WHEN PaymentTransaction.status = \'completed\' THEN PaymentTransaction.amount ELSE 0 END')), 'totalAmount'],
          [fn('SUM', literal('CASE WHEN PaymentTransaction.status = \'completed\' THEN PaymentTransaction.platformCommissionAmount ELSE 0 END')), 'totalCommission'],
          [fn('SUM', literal('CASE WHEN PaymentTransaction.status = \'completed\' THEN PaymentTransaction.convenienceFeeAmount ELSE 0 END')), 'totalConvenienceFee'],
          [fn('SUM', literal('CASE WHEN PaymentTransaction.status = \'completed\' THEN PaymentTransaction.caregiverEarnings ELSE 0 END')), 'totalCaregiverEarnings'],
          [fn('COUNT', literal('CASE WHEN PaymentTransaction.status = \'completed\' THEN 1 END')), 'completedCount']
        ],
        where: whereConditions,
        include: aggIncludes,
        raw: true
      });

      const s = rows[0] || {};
      return res.json({
        totalAmount:           parseFloat(s.totalAmount || 0).toFixed(2),
        totalCommission:       parseFloat(s.totalCommission || 0).toFixed(2),
        totalConvenienceFee:   parseFloat(s.totalConvenienceFee || 0).toFixed(2),
        totalCaregiverEarnings:parseFloat(s.totalCaregiverEarnings || 0).toFixed(2),
        completedCount:        parseInt(s.completedCount || 0)
      });
    }

    // Calculate pagination
    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    // Get all transactions with proper includes
    const { count, rows: transactions } = await PaymentTransaction.findAndCountAll({
      include: [
        {
          model: Appointment,
          required: Object.keys(caregiverWhere).length > 0 || Object.keys(appointmentWhere).length > 0,
          where: Object.keys(appointmentWhere).length > 0 ? appointmentWhere : undefined,
          include: [
            {
              model: Patient,
              required: Object.keys(patientUserWhere).length > 0 || Object.keys(patientWhere).length > 0,
              where: Object.keys(patientWhere).length > 0 ? patientWhere : undefined,
              include: [{ 
                model: User, 
                attributes: ['firstName', 'lastName', 'email', 'phone'],
                where: Object.keys(patientUserWhere).length > 0 ? patientUserWhere : undefined,
                required: Object.keys(patientUserWhere).length > 0
              }]
            },
            {
              model: Caregiver,
              where: Object.keys(caregiverWhere).length > 0 ? caregiverWhere : undefined,
              required: Object.keys(caregiverWhere).length > 0,
              include: [{ 
                model: User, 
                attributes: ['firstName', 'lastName', 'email', 'phone'] 
              }]
            },
            {
              model: Specialty,
              attributes: ['name']
            }
          ]
        }
      ],
      where: whereConditions,
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: offset
    });

    // Get completed appointments count (session_attended status)
    const completedAppointments = await Appointment.count({
      where: {
        status: 'session_attended',
        createdAt: { 
          [Op.gte]: dateStart,
          [Op.lte]: dateEnd
        },
        ...(Object.keys(appointmentWhere).length > 0 ? appointmentWhere : {})
      },
      include: Object.keys(caregiverWhere).length > 0 ? [{
        model: Caregiver,
        where: caregiverWhere,
        required: true
      }] : []
    });

    // Calculate totals (only completed transactions)
    const completedTransactions = transactions.filter(t => t.status === 'completed');
    const total = completedTransactions.reduce((sum, t) => sum + parseFloat(t.amount), 0);
    const thisMonth = completedTransactions
      .filter(t => t.createdAt >= new Date(now.getFullYear(), now.getMonth(), 1))
      .reduce((sum, t) => sum + parseFloat(t.amount), 0);
    
    const uniqueCaregivers = new Set(transactions.map(t => t.Appointment?.caregiverId)).size;
    const uniquePatients = new Set(transactions.map(t => t.Appointment?.patientId)).size;

    res.json({
      total: total.toFixed(2),
      thisMonth: thisMonth.toFixed(2),
      completedSessions: completedAppointments,
      uniqueCaregivers,
      uniquePatients,
      transactions,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(count / parseInt(limit)),
        totalRecords: count,
        pageSize: parseInt(limit)
      }
    });
  } catch (error) {
    next(error);
  }
});

// Get earnings for caregiver
router.get('/caregiver', async (req, res, next) => {
  try {
    const { period = 'this-month', startDate, endDate, patientSearch, region, district, traditionalAuthority, village, page = 1, limit = 100, summary } = req.query;
    
    const caregiver = await Caregiver.findOne({ where: { userId: req.user.id } });
    if (!caregiver) return res.status(404).json({ error: 'Caregiver profile not found' });

    const now = new Date();
    let dateStart, dateEnd;
    if (period === 'custom' && startDate && endDate) {
      dateStart = new Date(startDate);
      dateEnd = new Date(endDate);
      dateEnd.setHours(23, 59, 59, 999);
    } else {
      switch (period) {
        case 'this-week':  dateStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay()); break;
        case 'this-month': dateStart = new Date(now.getFullYear(), now.getMonth(), 1); break;
        case 'last-month':
          dateStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
          dateEnd   = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
          break;
        case 'this-year':  dateStart = new Date(now.getFullYear(), 0, 1); break;
        default:           dateStart = new Date(now.getFullYear(), now.getMonth(), 1);
      }
      if (!dateEnd) dateEnd = new Date();
    }

    const whereConditions = { createdAt: { [Op.gte]: dateStart, [Op.lte]: dateEnd } };
    const appointmentWhere = { caregiverId: caregiver.id };

    // ── summary=true: return only aggregates, no rows ──────────────────────
    if (summary === 'true') {
      const { fn, literal } = require('sequelize');
      const rows = await PaymentTransaction.findAll({
        attributes: [
          [fn('SUM', literal("CASE WHEN PaymentTransaction.status = 'completed' AND `PaymentTransaction`.`payment_type` = 'session_fee' THEN PaymentTransaction.caregiverEarnings ELSE 0 END")), 'netEarnings'],
          [fn('SUM', literal("CASE WHEN PaymentTransaction.status = 'completed' AND `PaymentTransaction`.`payment_type` = 'session_fee' THEN PaymentTransaction.platformCommissionAmount ELSE 0 END")), 'totalCommission'],
          [fn('COUNT', literal("CASE WHEN PaymentTransaction.status = 'completed' AND `PaymentTransaction`.`payment_type` = 'session_fee' THEN 1 END")), 'sessionsCompleted']
        ],
        where: whereConditions,
        include: [{ model: Appointment, where: appointmentWhere, required: true, attributes: [] }],
        raw: true
      });
      const s = rows[0] || {};
      const net = parseFloat(s.netEarnings || 0);
      const sessions = parseInt(s.sessionsCompleted || 0);
      return res.json({
        netEarnings:      net.toFixed(2),
        totalCommission:  parseFloat(s.totalCommission || 0).toFixed(2),
        sessionsCompleted: sessions,
        averagePerSession: sessions > 0 ? (net / sessions).toFixed(2) : '0.00'
      });
    }

    // Filter by patient search
    if (patientSearch) {
      patientUserWhere[Op.or] = [
        { firstName: { [Op.like]: `%${patientSearch}%` } },
        { lastName: { [Op.like]: `%${patientSearch}%` } },
        { email: { [Op.like]: `%${patientSearch}%` } }
      ];
    }

    // Filter by patient location
    if (region && region !== 'all') {
      patientWhere.region = region;
    }
    if (district && district !== 'all') {
      patientWhere.district = district;
    }
    if (traditionalAuthority && traditionalAuthority !== 'all') {
      patientWhere.traditionalAuthority = traditionalAuthority;
    }
    if (village && village !== 'all') {
      patientWhere.village = village;
    }

    // Calculate pagination
    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Get transactions for caregiver's appointments
    const { count, rows: transactions } = await PaymentTransaction.findAndCountAll({
      include: [
        {
          model: Appointment,
          where: appointmentWhere,
          required: true,
          include: [
            {
              model: Patient,
              where: Object.keys(patientWhere).length > 0 ? patientWhere : undefined,
              required: Object.keys(patientWhere).length > 0 || Object.keys(patientUserWhere).length > 0,
              include: [{ 
                model: User, 
                attributes: ['firstName', 'lastName', 'email', 'phone'],
                where: Object.keys(patientUserWhere).length > 0 ? patientUserWhere : undefined,
                required: Object.keys(patientUserWhere).length > 0
              }]
            },
            {
              model: Specialty,
              attributes: ['name']
            }
          ]
        }
      ],
      where: whereConditions,
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: offset
    });

    // Calculate totals
    const total = transactions.reduce((sum, t) => sum + parseFloat(t.amount), 0);
    const thisMonth = transactions
      .filter(t => t.createdAt >= new Date(now.getFullYear(), now.getMonth(), 1))
      .reduce((sum, t) => sum + parseFloat(t.amount), 0);
    
    const sessionsCompleted = transactions.filter(t => t.status === 'completed').length;
    const averagePerSession = sessionsCompleted > 0 ? total / sessionsCompleted : 0;

    res.json({
      total: total.toFixed(2),
      thisMonth: thisMonth.toFixed(2),
      sessionsCompleted,
      averagePerSession: averagePerSession.toFixed(2),
      transactions,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(count / parseInt(limit)),
        totalRecords: count,
        pageSize: parseInt(limit)
      }
    });
  } catch (error) {
    next(error);
  }
});

// Search caregivers by name or email
router.get('/caregivers/search', async (req, res, next) => {
  try {
    const { q, region } = req.query;
    
    if (!q || q.length < 2) {
      return res.json({ caregivers: [] });
    }

    const whereConditions = {
      [Op.or]: [
        { firstName: { [Op.like]: `%${q}%` } },
        { lastName: { [Op.like]: `%${q}%` } },
        { email: { [Op.like]: `%${q}%` } }
      ]
    };

    const caregiverWhere = {};
    if (region) {
      caregiverWhere.region = region;
    }

    const caregivers = await Caregiver.findAll({
      where: Object.keys(caregiverWhere).length > 0 ? caregiverWhere : undefined,
      include: [{
        model: User,
        attributes: ['firstName', 'lastName', 'email'],
        where: whereConditions
      }],
      limit: 20
    });

    res.json({ caregivers });
  } catch (error) {
    next(error);
  }
});

// Add payment history endpoint for patients
router.get('/payments/history', async (req, res, next) => {
  try {
    const { 
      period = 'this-month', 
      startDate, 
      endDate,
      page = 1, 
      limit = 100 
    } = req.query;
    
    // Find patient by user ID
    const patient = await Patient.findOne({ where: { userId: req.user.id } });
    if (!patient) {
      return res.status(404).json({ error: 'Patient profile not found' });
    }

    // Get date range based on period or custom dates
    const now = new Date();
    let dateStart, dateEnd;
    
    if (period === 'custom' && startDate && endDate) {
      dateStart = new Date(startDate);
      dateEnd = new Date(endDate);
      dateEnd.setHours(23, 59, 59, 999);
    } else {
      switch (period) {
        case 'this-week':
          dateStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
          break;
        case 'this-month':
          dateStart = new Date(now.getFullYear(), now.getMonth(), 1);
          break;
        case 'last-month':
          dateStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
          dateEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
          break;
        case 'this-year':
          dateStart = new Date(now.getFullYear(), 0, 1);
          break;
        default:
          dateStart = new Date(now.getFullYear(), now.getMonth(), 1);
      }
      if (!dateEnd) {
        dateEnd = new Date();
      }
    }

    // Calculate pagination
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const { count, rows: payments } = await PaymentTransaction.findAndCountAll({
      include: [{
        model: Appointment,
        where: { patientId: patient.id },
        include: [{
          model: Caregiver,
          include: [{ model: User, attributes: ['firstName', 'lastName'] }]
        }, {
          model: Specialty,
          attributes: ['name']
        }]
      }],
      where: {
        createdAt: { 
          [Op.gte]: dateStart,
          [Op.lte]: dateEnd
        }
      },
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: offset
    });

    const total = payments.reduce((sum, p) => sum + parseFloat(p.amount), 0);
    const thisMonth = payments
      .filter(p => p.createdAt >= new Date(now.getFullYear(), now.getMonth(), 1))
      .reduce((sum, p) => sum + parseFloat(p.amount), 0);

    res.json({
      total: total.toFixed(2),
      thisMonth: thisMonth.toFixed(2),
      payments,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(count / parseInt(limit)),
        totalRecords: count,
        pageSize: parseInt(limit)
      }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
