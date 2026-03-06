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

const router = express.Router();

// Webhook endpoint (no auth required)
router.get('/webhook', handlePaymentWebhook);
router.post('/webhook', handlePaymentWebhook);

// Authenticated routes
router.use(authenticateToken);

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