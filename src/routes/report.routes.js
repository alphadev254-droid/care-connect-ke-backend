const express = require('express');
const { body } = require('express-validator');
const { createReport, getReports, getReportById } = require('../controllers/reportController');
const { authenticateToken } = require('../middleware/auth.middleware');
const { requireCaregiver } = require('../middleware/roleCheck.middleware');
const { handleValidationErrors } = require('../middleware/validator.middleware');
const { upload } = require('../middleware/upload.middleware');

const router = express.Router();

const createReportValidation = [
  body('appointmentId').isInt(),
  body('observations').trim().notEmpty(),
  body('interventions').trim().notEmpty(),
  body('patientStatus').isIn(['stable', 'improving', 'deteriorating', 'critical', 'cured', 'deceased']),
  body('sessionSummary').trim().notEmpty()
];

router.use(authenticateToken);

router.post('/', requireCaregiver, upload.array('attachments', 5), createReportValidation, handleValidationErrors, createReport);
router.get('/', getReports);
router.get('/caregiver', async (req, res, next) => {
  try {
    const { CareSessionReport, Appointment, Patient, User, Caregiver } = require('../models');
    
    // Find caregiver by user ID
    const caregiver = await Caregiver.findOne({ where: { userId: req.user.id } });
    if (!caregiver) {
      return res.status(404).json({ error: 'Caregiver profile not found' });
    }

    const reports = await CareSessionReport.findAll({
      include: [
        {
          model: Appointment,
          where: { caregiverId: caregiver.id },
          include: [
            {
              model: Patient,
              include: [{ model: User, attributes: ['firstName', 'lastName'] }]
            }
          ]
        }
      ],
      order: [['createdAt', 'DESC']]
    });

    res.json({ reports });
  } catch (error) {
    next(error);
  }
});
router.get('/physician', async (req, res, next) => {
  try {
    const { CareSessionReport, Appointment, Patient, User, PrimaryPhysician } = require('../models');
    
    // Find physician by user ID
    const physician = await PrimaryPhysician.findOne({ where: { userId: req.user.id } });
    if (!physician) {
      return res.status(404).json({ error: 'Physician profile not found' });
    }

    // Get reports for patients under this physician's care
    const reports = await CareSessionReport.findAll({
      include: [
        {
          model: Appointment,
          include: [
            {
              model: Patient,
              include: [{ model: User, attributes: ['firstName', 'lastName'] }]
            }
          ]
        }
      ],
      order: [['createdAt', 'DESC']]
    });

    res.json({ reports });
  } catch (error) {
    next(error);
  }
});
router.get('/:id', getReportById);

module.exports = router;