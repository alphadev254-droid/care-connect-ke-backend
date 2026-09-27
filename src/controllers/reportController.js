const {
  CareSessionReport,
  Appointment,
  Patient,
  Caregiver,
  User,
  Specialty,
  TimeSlot,
  PaymentTransaction,
  CaregiverEarnings,
  sequelize
} = require('../models');
const { USER_ROLES, APPOINTMENT_STATUS, PAYMENT_STATUS } = require('../utils/constants');

const parseJsonArray = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return value ? [value] : [];
    }
  }
  return [];
};

const parseNullableDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const unlockCaregiverEarnings = async ({ appointmentId, caregiverId }) => {
  const sessionFeePayment = await PaymentTransaction.findOne({
    where: {
      appointmentId,
      paymentType: 'session_fee',
      status: PAYMENT_STATUS.COMPLETED
    }
  });

  if (!sessionFeePayment || Number(sessionFeePayment.caregiverEarnings) <= 0) return;

  const unlockAmount = Number(sessionFeePayment.caregiverEarnings);
  const transaction = await sequelize.transaction();

  try {
    const earnings = await CaregiverEarnings.findOne({
      where: { caregiverId },
      transaction,
      lock: transaction.LOCK.UPDATE
    });

    if (earnings && Number(earnings.lockedBalance) >= unlockAmount) {
      await earnings.update({
        lockedBalance: Number(earnings.lockedBalance) - unlockAmount,
        walletBalance: Number(earnings.walletBalance) + unlockAmount
      }, { transaction });
    }

    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

const getReportIncludes = () => [
  {
    model: Appointment,
    include: [
      { model: Patient, include: [{ model: User }] },
      {
        model: Caregiver,
        include: [{ model: User, attributes: ['firstName', 'lastName', 'email'] }]
      },
      { model: Specialty },
      { model: TimeSlot }
    ]
  }
];

const createReport = async (req, res, next) => {
  try {
    const {
      appointmentId,
      actualCheckIn,
      actualCheckOut,
      sessionStatus,
      sessionStatusReason,
      careProvided,
      sessionOutcome,
      incompleteReason,
      additionalAssistance,
      safetyIncident,
      followUpActions,
      caregiverConfirmed
    } = req.body;

    const caregiver = await Caregiver.findOne({ where: { userId: req.user.id } });
    if (!caregiver) {
      return res.status(403).json({ error: 'Only caregivers can create care reports' });
    }

    const appointment = await Appointment.findByPk(appointmentId, {
      include: [{ model: TimeSlot }, { model: Patient, include: [{ model: User }] }]
    });

    if (!appointment) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    if (appointment.caregiverId !== caregiver.id) {
      return res.status(403).json({ error: 'Unauthorized - this appointment does not belong to you' });
    }

    if (appointment.sessionFeeStatus !== PAYMENT_STATUS.COMPLETED) {
      return res.status(400).json({ error: 'Session fee must be paid before creating a care report' });
    }

    const normalizedSessionStatus = sessionStatus || '';
    const normalizedSessionOutcome = sessionOutcome || '';
    const normalizedSafetyIncident = safetyIncident || '';
    const normalizedFollowUpActions = parseJsonArray(followUpActions);

    if (!normalizedSessionStatus || !normalizedSessionOutcome || !normalizedSafetyIncident) {
      return res.status(400).json({ error: 'Session status, outcome, and safety/incident fields are required' });
    }

    if (caregiverConfirmed !== true && caregiverConfirmed !== 'true') {
      return res.status(400).json({ error: 'Caregiver confirmation is required' });
    }

    const reportData = {
      appointmentId,
      actualCheckIn: parseNullableDate(actualCheckIn),
      actualCheckOut: parseNullableDate(actualCheckOut),
      sessionStatus: normalizedSessionStatus,
      sessionStatusReason: sessionStatusReason || null,
      careProvided: parseJsonArray(careProvided),
      sessionOutcome: normalizedSessionOutcome,
      incompleteReason: parseJsonArray(incompleteReason),
      additionalAssistance: additionalAssistance || null,
      safetyIncident: normalizedSafetyIncident,
      followUpActions: normalizedFollowUpActions,
      caregiverConfirmed: true,
      followUpRequired: normalizedFollowUpActions.some((action) => action !== 'none'),
      patientStatus: null,
      observations: null,
      interventions: null,
      sessionSummary: null,
      recommendations: null,
      medications: null,
      activities: null,
      notes: null,
      vitals: {},
      attachments: []
    };

    let report = await CareSessionReport.findOne({ where: { appointmentId } });
    const isNewReport = !report;

    if (report) {
      await report.update(reportData);
    } else {
      report = await CareSessionReport.create(reportData);
    }

    if (appointment.status !== APPOINTMENT_STATUS.SESSION_ATTENDED) {
      await appointment.update({ status: APPOINTMENT_STATUS.SESSION_ATTENDED });
    }

    if (isNewReport) {
      try {
        await unlockCaregiverEarnings({ appointmentId, caregiverId: caregiver.id });
      } catch (earningsError) {
        console.error('Error unlocking caregiver earnings:', earningsError);
      }
    }

    const fullReport = await CareSessionReport.findByPk(report.id, {
      include: getReportIncludes()
    });

    res.status(isNewReport ? 201 : 200).json({ report: fullReport });
  } catch (error) {
    next(error);
  }
};

const getReports = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, patientId } = req.query;
    const offset = (Number(page) - 1) * Number(limit);
    const appointmentWhere = {};

    if (req.user.role === USER_ROLES.PATIENT) {
      return res.json({ reports: [], total: 0, page: Number(page), totalPages: 0 });
    }

    if (req.user.role === USER_ROLES.CAREGIVER) {
      const caregiver = await Caregiver.findOne({ where: { userId: req.user.id } });
      if (!caregiver) {
        return res.status(403).json({ error: 'Caregiver profile not found' });
      }
      appointmentWhere.caregiverId = caregiver.id;
    }

    if (patientId) appointmentWhere.patientId = patientId;

    const reports = await CareSessionReport.findAndCountAll({
      include: [
        {
          model: Appointment,
          where: Object.keys(appointmentWhere).length > 0 ? appointmentWhere : undefined,
          required: true,
          include: getReportIncludes()[0].include
        }
      ],
      limit: Number(limit),
      offset,
      order: [['createdAt', 'DESC']]
    });

    res.json({
      reports: reports.rows,
      total: reports.count,
      page: Number(page),
      totalPages: Math.ceil(reports.count / Number(limit))
    });
  } catch (error) {
    next(error);
  }
};

const getReportById = async (req, res, next) => {
  try {
    const report = await CareSessionReport.findByPk(req.params.id, {
      include: getReportIncludes()
    });

    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    if (req.user.role === USER_ROLES.PATIENT) {
      return res.status(403).json({ error: 'Patients cannot access care reports' });
    }

    res.json({ report });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createReport,
  getReports,
  getReportById
};
