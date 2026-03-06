const { CareSessionReport, Appointment, Patient, Caregiver, User } = require('../models');
const { createStatusAlert } = require('../services/notificationService');
const { uploadToCloudinary } = require('../services/cloudinaryService');
const { PATIENT_STATUS, APPOINTMENT_STATUS } = require('../utils/constants');

const createReport = async (req, res, next) => {
  try {
    const {
      appointmentId,
      observations,
      interventions,
      vitals,
      patientStatus,
      sessionSummary,
      recommendations,
      followUpRequired,
      followUpDate
    } = req.body;

    // Handle file uploads
    let uploadedAttachments = [];
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const uploadResult = await uploadToCloudinary(file, 'care-reports');
        uploadedAttachments.push({
          url: uploadResult.url,
          public_id: uploadResult.public_id,
          filename: file.originalname,
          format: uploadResult.format
        });
      }
    }

    // Verify appointment exists and belongs to caregiver
    const appointment = await Appointment.findByPk(appointmentId, {
      include: [{ model: Patient, include: [{ model: User }] }]
    });

    if (!appointment) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    const report = await CareSessionReport.create({
      appointmentId,
      observations,
      interventions,
      vitals: typeof vitals === 'string' ? JSON.parse(vitals) : vitals,
      patientStatus,
      sessionSummary,
      recommendations,
      followUpRequired: followUpRequired === 'true',
      followUpDate: followUpDate || null,
      attachments: uploadedAttachments
    });

    // Update appointment status to completed
    appointment.status = APPOINTMENT_STATUS.COMPLETED;
    await appointment.save();

    // Create status alert if needed
    if ([PATIENT_STATUS.DETERIORATING, PATIENT_STATUS.CRITICAL, PATIENT_STATUS.DECEASED].includes(patientStatus)) {
      try {
        // Use patient's email from User table
        const patientEmail = appointment.Patient.User.email;
        if (patientEmail && patientEmail.includes('@') && patientEmail.includes('.')) {
          await createStatusAlert(
            appointment.patientId,
            report.id,
            patientStatus,
            {
              name: `${appointment.Patient.User.firstName} ${appointment.Patient.User.lastName}`,
              emergencyContactEmail: patientEmail
            }
          );
        } else {
          console.log('Skipping status alert - invalid or missing patient email');
        }
      } catch (alertError) {
        console.error('Status alert creation failed:', alertError.message);
        // Don't fail the entire report creation if alert fails
      }
    }

    res.status(201).json({ report });
  } catch (error) {
    next(error);
  }
};

const getReports = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, patientId } = req.query;
    const offset = (page - 1) * limit;
    const { USER_ROLES } = require('../utils/constants');

    let whereClause = {};
    let appointmentWhere = {};

    // Filter reports based on user role
    if (req.user.role === USER_ROLES.PATIENT) {
      const patient = await Patient.findOne({ where: { userId: req.user.id } });
      if (patient) {
        appointmentWhere.patientId = patient.id;
      }
    } else if (req.user.role === USER_ROLES.CAREGIVER) {
      const caregiver = await Caregiver.findOne({ where: { userId: req.user.id } });
      if (caregiver) {
        appointmentWhere.caregiverId = caregiver.id;
      }
    }
    // For admins/physicians, allow viewing all reports (no filter)

    // Optional additional filter by patientId from query
    if (patientId) {
      appointmentWhere.patientId = patientId;
    }

    const reports = await CareSessionReport.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: Appointment,
          where: Object.keys(appointmentWhere).length > 0 ? appointmentWhere : undefined,
          required: true,
          include: [
            { model: Patient, include: [{ model: User }] },
            {
              model: Caregiver,
              include: [{
                model: User,
                attributes: ['firstName', 'lastName', 'email']
              }]
            }
          ]
        }
      ],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['createdAt', 'DESC']]
    });

    res.json({
      reports: reports.rows,
      total: reports.count,
      page: parseInt(page),
      totalPages: Math.ceil(reports.count / limit)
    });
  } catch (error) {
    next(error);
  }
};

const getReportById = async (req, res, next) => {
  try {
    const report = await CareSessionReport.findByPk(req.params.id, {
      include: [
        {
          model: Appointment,
          include: [
            { model: Patient, include: [{ model: User }] },
            { 
              model: Caregiver, 
              include: [{ 
                model: User,
                attributes: ['firstName', 'lastName', 'email']
              }]
            }
          ]
        }
      ]
    });

    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
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