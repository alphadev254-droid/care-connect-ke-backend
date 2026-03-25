const express = require('express');
const { authenticateToken } = require('../middleware/auth.middleware');
const {
  initiateBookingPaymentEndpoint,
  initiateSessionPayment,
  verifyPaymentStatus,
  handlePaymentWebhook,
  getPaymentsForAppointment,
  getPaymentHistory
} = require('../controllers/paymentController');
const paystackService = require('../services/paystackService');
const { Specialty, Appointment, Patient } = require('../models');

const router = express.Router();

// Webhook endpoint (no auth required)
router.get('/webhook', handlePaymentWebhook);
router.post('/webhook', handlePaymentWebhook);

// Authenticated routes
router.use(authenticateToken);

/**
 * GET /api/payments/fee-preview
 * Returns fee breakdown for a given base amount and payment method.
 * Query params: amount (number), paymentMethod (card|mobile_money)
 * OR: specialtyId + feeType (booking_fee|session_fee) + paymentMethod
 */
router.get('/fee-preview', async (req, res, next) => {
  try {
    const { paymentMethod, specialtyId, feeType, appointmentId } = req.query;

    if (!paymentMethod || !['card', 'mobile_money'].includes(paymentMethod)) {
      return res.status(400).json({ error: 'paymentMethod must be card or mobile_money' });
    }

    let baseFee;

    if (appointmentId) {
      const patient = await Patient.findOne({ where: { userId: req.user.id } });
      const appt = await Appointment.findOne({ where: { id: appointmentId, patientId: patient?.id } });
      if (!appt) return res.status(404).json({ error: 'Appointment not found' });
      baseFee = parseFloat(appt.sessionFee || 0);
    } else if (specialtyId && feeType) {
      const specialty = await Specialty.findByPk(specialtyId);
      if (!specialty) return res.status(404).json({ error: 'Specialty not found' });
      baseFee = parseFloat(feeType === 'session_fee' ? specialty.sessionFee : specialty.bookingFee || 0);
    } else {
      return res.status(400).json({ error: 'Provide specialtyId+feeType or appointmentId' });
    }

    const fees = paystackService.calculateFees(baseFee, paymentMethod);
    return res.json(fees);
  } catch (err) {
    next(err);
  }
});

// Initiate booking payment (creates appointment after payment)
router.post('/initiate-booking', initiateBookingPaymentEndpoint);

// Initiate session fee payment (for existing appointments)
router.post('/initiate-session', initiateSessionPayment);

// Verify payment status
router.get('/verify/:tx_ref', verifyPaymentStatus);

// Get payments for specific appointment
router.get('/appointment/:appointmentId', getPaymentsForAppointment);

// Get payment history for current user
router.get('/history', getPaymentHistory);

module.exports = router;