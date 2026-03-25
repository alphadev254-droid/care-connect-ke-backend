const { CareSessionReport, Appointment, Patient, Caregiver, User } = require('../models');
const { createStatusAlert } = require('../services/notificationService');
const { uploadToCloudinary } = require('../services/cloudinaryService');
const { PATIENT_STATUS, APPOINTMENT_STATUS } = require('../utils/constants');
const jwt = require('jsonwebtoken');

const DOC_SECRET = process.env.FILE_SIGN_SECRET || process.env.JWT_SECRET;
const DOC_TTL = parseInt(process.env.FILE_URL_TTL_SECONDS) || 120;

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

    const caregiver = await Caregiver.findOne({ where: { userId: req.user.id } });
    if (!caregiver) {
      return res.status(403).json({ error: 'Caregiver profile not found' });
    }
    if (appointment.caregiverId !== caregiver.id) {
      return res.status(403).json({ error: 'Unauthorized - This appointment does not belong to you' });
    }

    const existingReport = await CareSessionReport.findOne({ where: { appointmentId } });

    let parsedVitals = vitals;
    if (typeof vitals === 'string') {
      try {
        parsedVitals = JSON.parse(vitals);
      } catch {
        parsedVitals = {};
      }
    }

    const reportPayload = {
      appointmentId,
      observations,
      interventions,
      vitals: parsedVitals,
      patientStatus,
      sessionSummary,
      recommendations,
      followUpRequired: followUpRequired === 'true' || followUpRequired === true,
      followUpDate: followUpDate || null
    };

    // If no new attachments were uploaded, keep existing attachments on edit.
    if (uploadedAttachments.length > 0) {
      reportPayload.attachments = uploadedAttachments;
    }

    // Upsert report: create on first upload, update on subsequent saves.
    const report = existingReport
      ? await existingReport.update(reportPayload)
      : await CareSessionReport.create({
          ...reportPayload,
          attachments: uploadedAttachments
        });

    // Update appointment status to completed
    appointment.status = APPOINTMENT_STATUS.COMPLETED;
    await appointment.save();

    // Create status alert if needed
    const isNewReport = !existingReport;
    if (
      isNewReport &&
      [PATIENT_STATUS.DETERIORATING, PATIENT_STATUS.CRITICAL, PATIENT_STATUS.DECEASED].includes(patientStatus)
    ) {
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

    res.status(existingReport ? 200 : 201).json({ report });
  } catch (error) {
    next(error);
  }
};

const getReportAttachmentToken = async (req, res, next) => {
  try {
    const { id, index } = req.params;
    const attachmentIndex = parseInt(index, 10);

    if (Number.isNaN(attachmentIndex) || attachmentIndex < 0) {
      return res.status(400).json({ error: 'Invalid attachment index' });
    }

    const report = await CareSessionReport.findByPk(id, {
      include: [{ model: Appointment, attributes: ['id', 'patientId', 'caregiverId'] }]
    });

    if (!report) return res.status(404).json({ error: 'Report not found' });
    if (!report.Appointment) return res.status(404).json({ error: 'Appointment not found for report' });

    // Ownership checks: caregiver for this appointment OR patient for this appointment OR admin roles.
    const role = req.user?.role;
    const isAdmin = ['system_manager', 'regional_manager', 'Accountant'].includes(role);

    let allowed = isAdmin;

    if (!allowed && role === 'caregiver') {
      const caregiver = await Caregiver.findOne({ where: { userId: req.user.id }, attributes: ['id'] });
      allowed = !!caregiver && caregiver.id === report.Appointment.caregiverId;
    }

    if (!allowed && role === 'patient') {
      const patient = await Patient.findOne({ where: { userId: req.user.id }, attributes: ['id'] });
      allowed = !!patient && patient.id === report.Appointment.patientId;
    }

    if (!allowed) return res.status(403).json({ error: 'Access denied' });

    const attachments = Array.isArray(report.attachments) ? report.attachments : [];
    const attachment = attachments[attachmentIndex];
    const filename = attachment?.public_id;

    if (!filename || typeof filename !== 'string') {
      return res.status(404).json({ error: 'Attachment not found' });
    }

    const token = jwt.sign(
      { filename, userId: req.user.id, purpose: 'doc_view', scope: 'care_report_attachment', reportId: report.id },
      DOC_SECRET,
      { expiresIn: DOC_TTL }
    );

    res.json({ token, viewUrl: `/api/documents/view?token=${token}` });
  } catch (error) {
    next(error);
  }
};

const getReports = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, patientId } = req.query;
    const offset = (page - 1) * limit;
    const isSlim = req.query.slim === 'true' || req.query.projection === 'dashboard';
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
          ...(isSlim ? { attributes: ['id', 'patientId', 'caregiverId', 'specialtyId', 'timeSlotId', 'scheduledDate'] } : {}),
          include: [
            ...(isSlim
              ? []
              : [
                  { model: Patient, include: [{ model: User }] },
                  {
                    model: Caregiver,
                    include: [{
                      model: User,
                      attributes: ['firstName', 'lastName', 'email']
                    }]
                  }
                ])
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
  getReportAttachmentToken,
  getReports,
  getReportById
};