const express = require('express');
const { body } = require('express-validator');
const {
  createAppointment,
  getAppointments,
  updateAppointmentStatus,
  getAppointmentById,
  confirmPayment,
  paySessionFee,
  submitPatientFeedback,
  markAppointmentCompleted,
  rescheduleAppointment,
  cancelAppointment,
  autoCleanupDueBookings,
  getJitsiMeetingDetails
} = require('../controllers/appointmentController');
const { authenticateToken } = require('../middleware/auth.middleware');
const { handleValidationErrors } = require('../middleware/validator.middleware');

const router = express.Router();

const createAppointmentValidation = [
  body('timeSlotId').isInt(),
  body('specialtyId').isInt(),
  body('sessionType').isIn(['in_person', 'teleconference'])
];

router.use(authenticateToken);

router.post('/', createAppointmentValidation, handleValidationErrors, createAppointment);
router.get('/', getAppointments);
router.get('/caregiver', async (req, res, next) => {
  try {
    const { Appointment, Patient, User, Specialty, Caregiver } = require('../models');
    
    // Find caregiver by user ID
    const caregiver = await Caregiver.findOne({ where: { userId: req.user.id } });
    if (!caregiver) {
      return res.status(404).json({ error: 'Caregiver profile not found' });
    }

    const appointments = await Appointment.findAll({
      where: { caregiverId: caregiver.id },
      include: [
        {
          model: Patient,
          include: [{ model: User, attributes: ['firstName', 'lastName', 'email', 'phone'] }]
        },
        { model: Specialty, attributes: ['name'] }
      ],
      order: [['scheduledDate', 'DESC']]
    });

    res.json({ appointments });
  } catch (error) {
    next(error);
  }
});
router.get('/:id', getAppointmentById);
router.get('/:id/jitsi', getJitsiMeetingDetails);
router.patch('/:id/status', updateAppointmentStatus);
router.post('/confirm-payment', confirmPayment);
router.post('/pay-session-fee', paySessionFee);
router.post('/submit-feedback', submitPatientFeedback);
router.patch('/:id/complete', markAppointmentCompleted);
router.post('/:id/reschedule', [
  body('newTimeSlotId').isInt(),
  body('reason').optional().isString()
], handleValidationErrors, rescheduleAppointment);

router.post('/:id/cancel', [
  body('reason').optional().isString()
], handleValidationErrors, cancelAppointment);

router.post('/cleanup-due-bookings', autoCleanupDueBookings);

module.exports = router;