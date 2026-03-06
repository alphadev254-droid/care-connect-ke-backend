const express = require('express');
const {
  createOrUpdateCareReport,
  getCareReportByAppointment,
  getPatientCareReports,
  getCaregiverCareReports,
  deleteCareReport
} = require('../controllers/careReportController');
const { authenticateToken } = require('../middleware/auth.middleware');
const { upload } = require('../middleware/upload.middleware');

const router = express.Router();

router.use(authenticateToken);

// Create or update care report (caregiver only) - with file uploads
router.post('/', upload.array('attachments', 10), createOrUpdateCareReport);

// Get care report by appointment ID
router.get('/appointment/:appointmentId', getCareReportByAppointment);

// Get all care reports for the authenticated patient
router.get('/patient', getPatientCareReports);

// Get all care reports created by the authenticated caregiver
router.get('/caregiver', getCaregiverCareReports);

// Delete care report
router.delete('/:id', deleteCareReport);

module.exports = router;
