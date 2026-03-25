const {
  initiateBookingPayment,
  verifyPayment,
  processWebhook,
  getPaymentByTxRef,
  getAppointmentPayments
} = require('../services/paymentService');
const paystackService = require('../services/paystackService');
const bookingService = require('../services/bookingService');
const { User, Patient, TimeSlot, PaystackSubaccount } = require('../models');
const { getPrimaryFrontendUrl } = require('../utils/config');

/**
 * POST /api/payments/initiate-booking
 */
const initiateBookingPaymentEndpoint = async (req, res, next) => {
  try {
    const { timeSlotId, specialtyId, sessionType, notes, phoneNumber, locationId, paymentMethod } = req.body;

    if (!timeSlotId || !specialtyId) {
      return res.status(400).json({ error: 'Missing required fields: timeSlotId and specialtyId' });
    }
    if (!paymentMethod || !['card', 'mobile_money'].includes(paymentMethod)) {
      return res.status(400).json({ error: 'paymentMethod must be card or mobile_money' });
    }

    const patient = await Patient.findOne({ where: { userId: req.user.id }, include: [{ model: User }] });
    if (!patient) return res.status(404).json({ error: 'Patient profile not found' });

    const timeSlot = await TimeSlot.findByPk(timeSlotId);
    if (!timeSlot) return res.status(404).json({ error: 'Time slot not found' });

    const bookingData = {
      timeSlotId, specialtyId,
      sessionType: sessionType || 'in_person',
      notes: notes || null,
      patientId: patient.id,
      caregiverId: timeSlot.caregiverId,
      locationId: locationId || null,
      paymentMethod
    };

    const { pendingBooking, lockedUntil } = await bookingService.lockSlotWithPendingBooking(bookingData);

    const customerDetails = {
      email: patient.User.email,
      firstName: patient.User.firstName,
      lastName: patient.User.lastName,
      phone: phoneNumber || patient.User.phone
    };

    const paymentResult = await initiateBookingPayment(bookingData, customerDetails, pendingBooking.id);

    await pendingBooking.update({ tx_ref: paymentResult.tx_ref, status: 'payment_initiated' });
    await paymentResult.transaction.update({ pendingBookingId: pendingBooking.id });

    const feeBreakdown = paymentResult.transaction.metadata?.feeBreakdown || {};

    res.status(201).json({
      message: 'Booking payment initiated successfully',
      checkoutUrl: paymentResult.checkoutUrl,
      tx_ref: paymentResult.tx_ref,
      pendingBookingId: pendingBooking.id,
      expiresAt: lockedUntil,
      expiresInMinutes: 10,
      bookingFee: feeBreakdown.baseFee || pendingBooking.bookingFee,
      convenienceFee: feeBreakdown.convenienceFee || 0,
      convenienceFeePercentage: feeBreakdown.convenienceFeeRate || 0,
      sessionFee: pendingBooking.sessionFee,
      totalAmount: feeBreakdown.totalAmount || pendingBooking.bookingFee
    });
  } catch (error) {
    if (error.message === 'CAREGIVER_NO_SUBACCOUNT') {
      return res.status(400).json({ error: 'Payment failed. This caregiver has not set up their payment account yet. Please try booking a different caregiver.' });
    }
    if (error.message?.includes('not available')) {
      return res.status(409).json({ error: 'This time slot is no longer available.', code: 'SLOT_UNAVAILABLE' });
    }
    if (error.message?.includes('not found')) {
      return res.status(404).json({ error: error.message, code: 'RESOURCE_NOT_FOUND' });
    }
    next(error);
  }
};

/**
 * POST /api/payments/initiate-session
 */
const initiateSessionPayment = async (req, res, next) => {
  try {
    const { appointmentId, paymentMethod } = req.body;
    if (!appointmentId) return res.status(400).json({ error: 'Missing required field: appointmentId' });
    if (!paymentMethod || !['card', 'mobile_money'].includes(paymentMethod)) {
      return res.status(400).json({ error: 'paymentMethod must be card or mobile_money' });
    }

    const patient = await Patient.findOne({ where: { userId: req.user.id }, include: [{ model: User }] });
    if (!patient) return res.status(404).json({ error: 'Patient profile not found' });

    const { Appointment, Specialty, PendingPaymentTransaction } = require('../models');
    const appointment = await Appointment.findOne({
      where: { id: appointmentId, patientId: patient.id },
      include: [{ model: Specialty }]
    });
    if (!appointment) return res.status(404).json({ error: 'Appointment not found' });
    if (appointment.sessionFeeStatus === 'completed') return res.status(400).json({ error: 'Session fee already paid' });

    const baseFee = parseFloat(appointment.sessionFee || appointment.Specialty?.sessionFee || 0);
    const fees = paystackService.calculateFees(baseFee, paymentMethod);
    const channels = paymentMethod === 'card' ? ['card'] : ['mobile_money'];

    // Get caregiver subaccount — required for payment split
    const subaccount = await PaystackSubaccount.findOne({
      where: { caregiverId: appointment.caregiverId, isActive: true }
    });
    if (!subaccount) throw new Error('CAREGIVER_NO_SUBACCOUNT');

    const paymentData = await paystackService.initializePayment({
      email: patient.User.email,
      amount: fees.totalAmount,
      tx_ref: `HC-SESSION-${appointmentId}-${Date.now()}`,
      subaccountCode: subaccount?.subaccountCode || null,
      transactionCharge: fees.transactionCharge,
      callbackUrl: `${process.env.WEBHOOK_BASE_URL}/api/payments/webhook`,
      returnUrl: `${getPrimaryFrontendUrl()}/appointments`,
      channels,
      metadata: {
        type: 'session_fee',
        appointmentId,
        patientId: patient.id,
        caregiverId: appointment.caregiverId
      }
    });

    await PendingPaymentTransaction.create({
      appointmentId,
      amount: fees.totalAmount,
      paymentType: 'session_fee',
      currency: 'KES',
      paymentMethod: 'paystack',
      tx_ref: paymentData.reference,
      status: 'pending',
      pendingBookingId: null,
      metadata: { feeBreakdown: fees }
    });

    res.status(201).json({
      message: 'Session fee payment initiated successfully',
      checkoutUrl: paymentData.authorization_url,
      tx_ref: paymentData.reference,
      baseFee: fees.baseFee,
      convenienceFeeRate: fees.convenienceFeeRate,
      convenienceFee: fees.convenienceFee,
      platformCommissionRate: fees.platformCommissionRate,
      platformCommission: fees.platformCommission,
      caregiverEarnings: fees.caregiverEarnings,
      totalAmount: fees.totalAmount
    });
  } catch (error) {
    if (error.message === 'CAREGIVER_NO_SUBACCOUNT') {
      return res.status(400).json({ error: 'Payment failed. This caregiver has not set up their payment account yet. Please try booking a different caregiver.' });
    }
    next(error);
  }
};

/**
 * GET /api/payments/verify/:reference
 */
const verifyPaymentStatus = async (req, res, next) => {
  try {
    const { reference } = req.params;
    const paymentStatus = await verifyPayment(reference);
    const transaction = await getPaymentByTxRef(reference);
    res.json({ payment: paymentStatus, transaction });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/payments/webhook  (also handles GET redirect from Paystack)
 */
const handlePaymentWebhook = async (req, res, next) => {
  try {
    if (req.method === 'GET') {
      const reference = req.query.reference || req.query.tx_ref;
      if (reference) {
        try {
          const paymentData = await verifyPayment(reference);
          if (paymentData.status === 'success') {
            const mockEvent = { event: 'charge.success', data: paymentData };
            await processWebhook(mockEvent, null, null);
            return res.redirect(`${getPrimaryFrontendUrl()}/dashboard/billing?status=success&reference=${reference}`);
          }
        } catch (err) {
          // fall through to failed redirect
        }
        return res.redirect(`${getPrimaryFrontendUrl()}/dashboard/billing?status=failed&reference=${reference}`);
      }
      return res.status(200).json({ message: 'Webhook endpoint active' });
    }

    // POST webhook — verify signature using raw body
    const signature = req.headers['x-paystack-signature'];
    const rawBody = req.rawBody;

    if (signature && rawBody) {
      const isValid = require('../services/paystackService').verifyWebhookSignature(rawBody, signature);
      if (!isValid) {
        return res.status(400).json({ error: 'Invalid webhook signature' });
      }
    }

    const webhookData = req.body;
    if (!webhookData?.data?.reference && !webhookData?.data?.tx_ref) {
      return res.status(400).json({ error: 'Missing transaction reference' });
    }

    const transaction = await processWebhook(webhookData, rawBody, signature);

    // Always return 200 to prevent Paystack retries
    res.status(200).json({ received: true });
  } catch (error) {
    // Still return 200 to Paystack
    res.status(200).json({ received: true });
  }
};

/**
 * GET /api/payments/appointment/:appointmentId
 */
const getPaymentsForAppointment = async (req, res, next) => {
  try {
    const payments = await getAppointmentPayments(req.params.appointmentId);
    res.json({ payments, total: payments.length });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/payments/history
 */
const getPaymentHistory = async (req, res, next) => {
  try {
    const patient = await Patient.findOne({ where: { userId: req.user.id } });
    if (!patient) return res.status(404).json({ error: 'Patient profile not found' });

    const { PaymentTransaction, Appointment } = require('../models');
    const payments = await PaymentTransaction.findAll({
      attributes: ['id', 'appointmentId', 'amount', 'baseFee', 'convenienceFeeAmount', 'paymentType', 'currency', 'paymentMethod', 'channel', 'paystackReference', 'status', 'paidAt', 'createdAt'],
      include: [{
        model: Appointment,
        where: { patientId: patient.id },
        attributes: ['id', 'scheduledDate', 'sessionType', 'bookingFee', 'sessionFee', 'totalCost']
      }],
      order: [['createdAt', 'DESC']]
    });

    const maskedPayments = payments.map(p => {
      const data = p.toJSON();
      const ref = data.paystackReference || '';
      data.paystackReference = ref.length > 18 ? `${ref.slice(0, 18)}****` : ref;
      if (data.Appointment?.id) {
        data.appointmentRef = `APT-${data.Appointment.id.toString().slice(0, 8).toUpperCase()}`;
      }
      return data;
    });

    res.json({ payments: maskedPayments, total: maskedPayments.length });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  initiateBookingPaymentEndpoint,
  initiateSessionPayment,
  verifyPaymentStatus,
  handlePaymentWebhook,
  getPaymentsForAppointment,
  getPaymentHistory
};
