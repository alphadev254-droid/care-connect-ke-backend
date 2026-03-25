const express = require('express');
const { authenticateToken } = require('../middleware/auth.middleware');
const { requirePermission } = require('../middleware/permissions');
const { PaymentTransaction, Appointment, Patient, User, Caregiver, Specialty } = require('../models');
const { Op, fn, literal, col } = require('sequelize');

const router = express.Router();
router.use(authenticateToken);

// ── Shared date range builder ──────────────────────────────────────────────
function buildDateRange(period, startDate, endDate) {
  const now = new Date();
  let dateStart, dateEnd;

  if (period === 'custom' && startDate && endDate) {
    dateStart = new Date(startDate);
    dateEnd   = new Date(endDate);
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
        dateEnd   = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
        break;
      case 'this-year':
        dateStart = new Date(now.getFullYear(), 0, 1);
        break;
      default:
        dateStart = new Date(now.getFullYear(), now.getMonth(), 1);
    }
    if (!dateEnd) dateEnd = new Date();
  }

  return { dateStart, dateEnd };
}

// ── Column whitelists (only what the frontend renders) ─────────────────────
//
// PaymentTransaction: id, amount, baseFee, convenienceFeeRate, convenienceFeeAmount,
//   platformCommissionRate, platformCommissionAmount, caregiverEarnings,
//   paymentType, currency, paymentMethod, paystackReference, status, createdAt
//
// Appointment: id, patientId, caregiverId, scheduledDate, duration, sessionType, status
//
// Patient: id, region, district, traditionalAuthority, village   (+ User below)
// Caregiver: id, region, district, traditionalAuthority, village (+ User below)
// User: firstName, lastName, email, phone
// Specialty: name

const TRANSACTION_ATTRS = [
  'id', 'appointmentId', 'baseFee',
  
  'platformCommissionRate', 'platformCommissionAmount',
  'caregiverEarnings', 'paymentType', 'currency',
  'paymentMethod', 'paystackReference', 'status', 'createdAt',
];

const TRANSACTION_ATTRS_ADM = [
  'id', 'appointmentId', 'amount', 'baseFee',
  'convenienceFeeRate', 'convenienceFeeAmount',
  'platformCommissionRate', 'platformCommissionAmount',
  'caregiverEarnings', 'paymentType', 'currency',
  'paymentMethod', 'paystackReference', 'status', 'createdAt',
];

const APPOINTMENT_ATTRS  = ['id', 'patientId', 'caregiverId', 'scheduledDate', 'duration', 'sessionType', 'status'];
const PATIENT_ATTRS      = ['id', 'userId', 'region', 'district', 'traditionalAuthority', 'village'];
const CAREGIVER_ATTRS    = ['id', 'userId', 'region', 'district', 'traditionalAuthority', 'village'];
const USER_ATTRS         = ['firstName', 'lastName', 'email', 'phone'];
const SPECIALTY_ATTRS    = ['name'];

// ── /earnings/admin ────────────────────────────────────────────────────────
router.get('/admin', requirePermission('view_financial_reports'), async (req, res, next) => {
  try {
    const {
      period = 'this-month', caregiverId, region, district,
      traditionalAuthority, village, patientSearch,
      startDate, endDate,
      page = 1, limit = 100, summary,
    } = req.query;

    if (!['system_manager', 'regional_manager', 'Accountant'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Access denied. Admin role required.' });
    }

    // Regional restriction
    let userRegionFilter = null;
    if (req.user.role === 'regional_manager' || req.user.role === 'Accountant') {
      const userProfile = await User.findByPk(req.user.id, { attributes: ['assignedRegion'] });
      if (userProfile?.assignedRegion && userProfile.assignedRegion !== 'all') {
        userRegionFilter = userProfile.assignedRegion;
      }
    }

    const { dateStart, dateEnd } = buildDateRange(period, startDate, endDate);
    const whereConditions = { createdAt: { [Op.gte]: dateStart, [Op.lte]: dateEnd } };

    // Build filter objects
    const appointmentWhere = {};
    const caregiverWhere   = {};
    const patientWhere     = {};
    const patientUserWhere = {};

    if (userRegionFilter)                                         caregiverWhere.region = userRegionFilter;
    else if (region && region !== 'all')                          caregiverWhere.region = region;
    if (caregiverId && caregiverId !== 'all')                     appointmentWhere.caregiverId = caregiverId;
    if (district && district !== 'all')                           caregiverWhere.district = district;
    if (traditionalAuthority && traditionalAuthority !== 'all')   caregiverWhere.traditionalAuthority = traditionalAuthority;
    if (village && village !== 'all')                             caregiverWhere.village = village;

    if (patientSearch) {
      patientUserWhere[Op.or] = [
        { firstName: { [Op.like]: `%${patientSearch}%` } },
        { lastName:  { [Op.like]: `%${patientSearch}%` } },
        { email:     { [Op.like]: `%${patientSearch}%` } },
      ];
    }

    const hasCaregiverFilter   = Object.keys(caregiverWhere).length > 0;
    const hasAppointmentFilter = Object.keys(appointmentWhere).length > 0;
    const hasPatientFilter     = Object.keys(patientWhere).length > 0;
    const hasPatientUserFilter = Object.keys(patientUserWhere).length > 0;
    const needsAppointmentJoin = hasCaregiverFilter || hasAppointmentFilter || hasPatientFilter || hasPatientUserFilter;

    // ── summary=true ───────────────────────────────────────────────────────
    if (summary === 'true') {
      const aggIncludes = [{
        model: Appointment,
        required: needsAppointmentJoin,
        where: hasAppointmentFilter ? appointmentWhere : undefined,
        attributes: [],
        include: [
          ...(hasCaregiverFilter ? [{
            model: Caregiver, where: caregiverWhere, required: true, attributes: [],
          }] : []),
          ...(hasPatientFilter || hasPatientUserFilter ? [{
            model: Patient,
            required: true,
            where: hasPatientFilter ? patientWhere : undefined,
            attributes: [],
            include: hasPatientUserFilter ? [{
              model: User, where: patientUserWhere, required: true, attributes: [],
            }] : [],
          }] : []),
        ],
      }];

      const rows = await PaymentTransaction.findAll({
        attributes: [
          [fn('SUM', literal("CASE WHEN `PaymentTransaction`.`status` = 'completed' THEN `PaymentTransaction`.`amount` ELSE 0 END")),                       'totalAmount'],
          [fn('SUM', literal("CASE WHEN `PaymentTransaction`.`status` = 'completed' THEN `PaymentTransaction`.`platformCommissionAmount` ELSE 0 END")),      'totalCommission'],
          [fn('SUM', literal("CASE WHEN `PaymentTransaction`.`status` = 'completed' THEN `PaymentTransaction`.`convenienceFeeAmount` ELSE 0 END")),          'totalConvenienceFee'],
          [fn('SUM', literal("CASE WHEN `PaymentTransaction`.`status` = 'completed' THEN `PaymentTransaction`.`caregiverEarnings` ELSE 0 END")),             'totalCaregiverEarnings'],
          [fn('COUNT', literal("CASE WHEN `PaymentTransaction`.`status` = 'completed' THEN 1 END")),                                                         'completedCount'],
        ],
        where: whereConditions,
        include: aggIncludes,
        raw: true,
      });

      const s = rows[0] || {};
      return res.json({
        totalAmount:            parseFloat(s.totalAmount            || 0).toFixed(2),
        totalCommission:        parseFloat(s.totalCommission        || 0).toFixed(2),
        totalConvenienceFee:    parseFloat(s.totalConvenienceFee    || 0).toFixed(2),
        totalCaregiverEarnings: parseFloat(s.totalCaregiverEarnings || 0).toFixed(2),
        completedCount:         parseInt(s.completedCount           || 0),
      });
    }

    // ── Paginated table rows ───────────────────────────────────────────────
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const { count, rows: transactions } = await PaymentTransaction.findAndCountAll({
      attributes: TRANSACTION_ATTRS_ADM,
      where: whereConditions,
      include: [{
        model: Appointment,
        attributes: APPOINTMENT_ATTRS,
        required: needsAppointmentJoin,
        where: hasAppointmentFilter ? appointmentWhere : undefined,
        include: [
          {
            model: Patient,
            attributes: PATIENT_ATTRS,
            required: hasPatientFilter || hasPatientUserFilter,
            where: hasPatientFilter ? patientWhere : undefined,
            include: [{
              model: User,
              attributes: USER_ATTRS,
              where: hasPatientUserFilter ? patientUserWhere : undefined,
              required: hasPatientUserFilter,
            }],
          },
          {
            model: Caregiver,
            attributes: CAREGIVER_ATTRS,
            required: hasCaregiverFilter,
            where: hasCaregiverFilter ? caregiverWhere : undefined,
            include: [{ model: User, attributes: USER_ATTRS }],
          },
          { model: Specialty, attributes: SPECIALTY_ATTRS },
        ],
      }],
      order:    [['createdAt', 'DESC']],
      limit:    parseInt(limit),
      offset,
      distinct: true,
    });

    // Unique caregiver/patient counts across full filtered set
    const countRows = await PaymentTransaction.findAll({
      attributes: [
        [fn('COUNT', literal('DISTINCT `Appointment`.`caregiverId`')), 'uniqueCaregivers'],
        [fn('COUNT', literal('DISTINCT `Appointment`.`patientId`')),   'uniquePatients'],
      ],
      where: whereConditions,
      include: [{
        model: Appointment,
        required: needsAppointmentJoin,
        where: hasAppointmentFilter ? appointmentWhere : undefined,
        attributes: [],
        include: [
          ...(hasCaregiverFilter ? [{
            model: Caregiver, where: caregiverWhere, required: true, attributes: [],
          }] : []),
          ...(hasPatientFilter || hasPatientUserFilter ? [{
            model: Patient,
            required: true,
            where: hasPatientFilter ? patientWhere : undefined,
            attributes: [],
            include: hasPatientUserFilter ? [{
              model: User, where: patientUserWhere, required: true, attributes: [],
            }] : [],
          }] : []),
        ],
      }],
      raw: true,
    });

    // completedSessions count from Appointment table
    const completedSessions = await Appointment.count({
      where: {
        status: 'session_attended',
        createdAt: { [Op.gte]: dateStart, [Op.lte]: dateEnd },
        ...(hasAppointmentFilter ? appointmentWhere : {}),
      },
      include: hasCaregiverFilter
        ? [{ model: Caregiver, where: caregiverWhere, required: true }]
        : [],
    });

    const cr = countRows[0] || {};
    res.json({
      completedSessions,
      uniqueCaregivers: parseInt(cr.uniqueCaregivers || 0),
      uniquePatients:   parseInt(cr.uniquePatients   || 0),
      transactions,
      pagination: {
        currentPage:  parseInt(page),
        totalPages:   Math.ceil(count / parseInt(limit)),
        totalRecords: count,
        pageSize:     parseInt(limit),
      },
    });
  } catch (error) {
    next(error);
  }
});

// ── /earnings/caregiver ────────────────────────────────────────────────────
router.get('/caregiver', requirePermission('view_financial_reports'), async (req, res, next) => {
  try {
    const {
      period = 'this-month', startDate, endDate,
      patientSearch, region, district, traditionalAuthority, village,
      page = 1, limit = 100, summary,
    } = req.query;

    const caregiver = await Caregiver.findOne({ where: { userId: req.user.id } });
    if (!caregiver) return res.status(404).json({ error: 'Caregiver profile not found' });

    const { dateStart, dateEnd } = buildDateRange(period, startDate, endDate);
    const whereConditions  = { createdAt: { [Op.gte]: dateStart, [Op.lte]: dateEnd } };
    const appointmentWhere = { caregiverId: caregiver.id };

    // Build patient filters BEFORE summary branch
    const patientWhere     = {};
    const patientUserWhere = {};

    if (patientSearch) {
      patientUserWhere[Op.or] = [
        { firstName: { [Op.like]: `%${patientSearch}%` } },
        { lastName:  { [Op.like]: `%${patientSearch}%` } },
        { email:     { [Op.like]: `%${patientSearch}%` } },
      ];
    }
    if (region && region !== 'all')                             patientWhere.region = region;
    if (district && district !== 'all')                         patientWhere.district = district;
    if (traditionalAuthority && traditionalAuthority !== 'all') patientWhere.traditionalAuthority = traditionalAuthority;
    if (village && village !== 'all')                           patientWhere.village = village;

    const hasPatientFilter     = Object.keys(patientWhere).length > 0;
    const hasPatientUserFilter = Object.keys(patientUserWhere).length > 0;

    // ── summary=true ───────────────────────────────────────────────────────
    if (summary === 'true') {
      const rows = await PaymentTransaction.findAll({
        attributes: [
          [fn('SUM', literal("CASE WHEN `PaymentTransaction`.`status` = 'completed' AND `PaymentTransaction`.`payment_type` = 'session_fee' THEN `PaymentTransaction`.`caregiverEarnings` ELSE 0 END")), 'netEarnings'],
          [fn('SUM', literal("CASE WHEN `PaymentTransaction`.`status` = 'completed' AND `PaymentTransaction`.`payment_type` = 'session_fee' THEN `PaymentTransaction`.`platformCommissionAmount` ELSE 0 END")), 'totalCommission'],
          [fn('COUNT', literal("CASE WHEN `PaymentTransaction`.`status` = 'completed' AND `PaymentTransaction`.`payment_type` = 'session_fee' THEN 1 END")), 'sessionsCompleted'],
        ],
        where: whereConditions,
        include: [{
          model: Appointment,
          where: appointmentWhere,
          required: true,
          attributes: [],
          include: (hasPatientFilter || hasPatientUserFilter) ? [{
            model: Patient,
            required: true,
            where: hasPatientFilter ? patientWhere : undefined,
            attributes: [],
            include: hasPatientUserFilter ? [{
              model: User, where: patientUserWhere, required: true, attributes: [],
            }] : [],
          }] : [],
        }],
        raw: true,
      });

      const s        = rows[0] || {};
      const net      = parseFloat(s.netEarnings     || 0);
      const sessions = parseInt(s.sessionsCompleted || 0);
      return res.json({
        netEarnings:       net.toFixed(2),
        totalCommission:   parseFloat(s.totalCommission || 0).toFixed(2),
        sessionsCompleted: sessions,
        averagePerSession: sessions > 0 ? (net / sessions).toFixed(2) : '0.00',
      });
    }

    // ── Paginated table rows ───────────────────────────────────────────────
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const { count, rows: transactions } = await PaymentTransaction.findAndCountAll({
      attributes: TRANSACTION_ATTRS,
      where: whereConditions,
      include: [{
        model: Appointment,
        attributes: APPOINTMENT_ATTRS,
        where: appointmentWhere,
        required: true,
        include: [
          {
            model: Patient,
            attributes: PATIENT_ATTRS,
            required: hasPatientFilter || hasPatientUserFilter,
            where: hasPatientFilter ? patientWhere : undefined,
            include: [{
              model: User,
              attributes: USER_ATTRS,
              where: hasPatientUserFilter ? patientUserWhere : undefined,
              required: hasPatientUserFilter,
            }],
          },
          { model: Specialty, attributes: SPECIALTY_ATTRS },
        ],
      }],
      order:    [['createdAt', 'DESC']],
      limit:    parseInt(limit),
      offset,
      distinct: true,
    });

    res.json({
      transactions,
      pagination: {
        currentPage:  parseInt(page),
        totalPages:   Math.ceil(count / parseInt(limit)),
        totalRecords: count,
        pageSize:     parseInt(limit),
      },
    });
  } catch (error) {
    next(error);
  }
});

// ── /earnings/caregivers/search ────────────────────────────────────────────
router.get('/caregivers/search', requirePermission('view_financial_reports'), async (req, res, next) => {
  try {
    const { q, region } = req.query;
    if (!q || q.length < 2) return res.json({ caregivers: [] });

    const userWhere = {
      [Op.or]: [
        { firstName: { [Op.like]: `%${q}%` } },
        { lastName:  { [Op.like]: `%${q}%` } },
        { email:     { [Op.like]: `%${q}%` } },
      ],
    };

    const caregiverWhere = {};
    if (region) caregiverWhere.region = region;

    const caregivers = await Caregiver.findAll({
      attributes: ['id', 'userId'],
      where: Object.keys(caregiverWhere).length > 0 ? caregiverWhere : undefined,
      include: [{
        model: User,
        attributes: ['firstName', 'lastName', 'email'],
        where: userWhere,
      }],
      limit: 20,
    });

    res.json({ caregivers });
  } catch (error) {
    next(error);
  }
});

// ── /earnings/payments/history (patient) ──────────────────────────────────
router.get('/payments/history', requirePermission('view_financial_reports'), async (req, res, next) => {
  try {
    const { period = 'this-month', startDate, endDate, page = 1, limit = 100 } = req.query;

    const patient = await Patient.findOne({ where: { userId: req.user.id } });
    if (!patient) return res.status(404).json({ error: 'Patient profile not found' });

    const { dateStart, dateEnd } = buildDateRange(period, startDate, endDate);
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const { count, rows: payments } = await PaymentTransaction.findAndCountAll({
      attributes: TRANSACTION_ATTRS,
      where: { createdAt: { [Op.gte]: dateStart, [Op.lte]: dateEnd } },
      include: [{
        model: Appointment,
        attributes: APPOINTMENT_ATTRS,
        where: { patientId: patient.id },
        required: true,
        include: [
          {
            model: Caregiver,
            attributes: CAREGIVER_ATTRS,
            include: [{ model: User, attributes: USER_ATTRS }],
          },
          { model: Specialty, attributes: SPECIALTY_ATTRS },
        ],
      }],
      order:    [['createdAt', 'DESC']],
      limit:    parseInt(limit),
      offset,
      distinct: true,
    });

    // thisMonth from DB — correct even when paginated
    const now        = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthAgg   = await PaymentTransaction.findAll({
      attributes: [[fn('SUM', col('amount')), 'thisMonth']],
      where: {
        status:    'completed',
        createdAt: { [Op.gte]: monthStart, [Op.lte]: dateEnd },
      },
      include: [{
        model: Appointment,
        where: { patientId: patient.id },
        required: true,
        attributes: [],
      }],
      raw: true,
    });

    res.json({
      thisMonth: parseFloat(monthAgg[0]?.thisMonth || 0).toFixed(2),
      payments,
      pagination: {
        currentPage:  parseInt(page),
        totalPages:   Math.ceil(count / parseInt(limit)),
        totalRecords: count,
        pageSize:     parseInt(limit),
      },
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;