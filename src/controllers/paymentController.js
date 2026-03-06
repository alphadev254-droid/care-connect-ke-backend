const {
  initiateBookingPayment,
  verifyPayment,
  processWebhook,
  getPaymentByTxRef,
  getAppointmentPayments
} = require('../services/paymentService');
const bookingService = require('../services/bookingService');
const { User, Patient, TimeSlot, Location } = require('../models');
const paymentConfig = require('../config/payment');
const { getPrimaryFrontendUrl } = require('../utils/config');

/**
 * Initiate Booking Payment with Race Condition Prevention
 * Uses pending bookings and database transactions for atomic slot locking
 * POST /api/payments/initiate-booking
 */
const initiateBookingPaymentEndpoint = async (req, res, next) => {
  try {
    const { timeSlotId, specialtyId, sessionType, notes, phoneNumber, locationId } = req.body;

    // Validate required fields
    if (!timeSlotId || !specialtyId) {
      return res.status(400).json({
        error: 'Missing required fields: timeSlotId and specialtyId are required'
      });
    }

    // Get patient details
    const patient = await Patient.findOne({
      where: { userId: req.user.id },
      include: [{ model: User }]
    });

    if (!patient) {
      return res.status(404).json({ error: 'Patient profile not found' });
    }

    // Get time slot to retrieve caregiver ID
    const timeSlot = await TimeSlot.findByPk(timeSlotId);
    if (!timeSlot) {
      return res.status(404).json({ error: 'Time slot not found' });
    }

    // Prepare booking data
    const bookingData = {
      timeSlotId,
      specialtyId,
      sessionType: sessionType || 'in_person',
      notes: notes || null,
      patientId: patient.id,
      caregiverId: timeSlot.caregiverId,
      locationId: locationId || null
    };

    // Step 1: Atomically lock slot and create pending booking with transaction
    const { pendingBooking, lockedUntil } = await bookingService.lockSlotWithPendingBooking(bookingData);

    console.log('✅ Pending booking created:', {
      id: pendingBooking.id,
      timeSlotId: pendingBooking.timeSlotId,
      expiresAt: lockedUntil
    });

    // Step 2: Prepare customer details for payment
    const customerDetails = {
      email: patient.User.email,
      firstName: patient.User.firstName,
      lastName: patient.User.lastName,
      phone: phoneNumber || patient.User.phone || '+265 998 95 15 10'
    };

    // Step 3: Initiate payment with Paychangu
    const paymentResult = await initiateBookingPayment(bookingData, customerDetails, pendingBooking.id);

    console.log('💳 Payment initiated:', {
      tx_ref: paymentResult.tx_ref,
      checkoutUrl: paymentResult.checkoutUrl
    });

    // Step 4: Update pending booking with payment reference and link to pending transaction
    await pendingBooking.update({
      tx_ref: paymentResult.tx_ref,
      status: 'payment_initiated'
    });

    // Update pending payment transaction with booking ID
    await paymentResult.transaction.update({
      pendingBookingId: pendingBooking.id
    });

    console.log('🔗 Pending booking linked to payment:', {
      pendingBookingId: pendingBooking.id,
      tx_ref: paymentResult.tx_ref
    });

    // Extract fee breakdown from transaction metadata
    const feeBreakdown = paymentResult.transaction.metadata?.feeBreakdown || {};

    // Return response with checkout URL and fee breakdown
    res.status(201).json({
      message: 'Booking payment initiated successfully',
      checkoutUrl: paymentResult.checkoutUrl,
      tx_ref: paymentResult.tx_ref,
      pendingBookingId: pendingBooking.id,
      expiresAt: lockedUntil,
      expiresInMinutes: 10,
      transaction: paymentResult.transaction,
      bookingFee: feeBreakdown.baseFee || pendingBooking.bookingFee,
      convenienceFee: feeBreakdown.convenienceFee || 0,
      convenienceFeePercentage: feeBreakdown.convenienceFeePercentage || 0,
      sessionFee: pendingBooking.sessionFee,
      totalAmount: feeBreakdown.totalAmount || pendingBooking.bookingFee
    });
  } catch (error) {
    console.error('❌ Booking payment initiation failed:', error);

    // Provide user-friendly error messages
    if (error.message.includes('not available')) {
      return res.status(409).json({
        error: 'This time slot is no longer available. Please select a different time slot.',
        code: 'SLOT_UNAVAILABLE'
      });
    }

    if (error.message.includes('not found')) {
      return res.status(404).json({
        error: error.message,
        code: 'RESOURCE_NOT_FOUND'
      });
    }

    next(error);
  }
};


/**
 * Verify Payment Status
 * GET /api/payments/verify/:tx_ref
 */
const verifyPaymentStatus = async (req, res, next) => {
  try {
    const { tx_ref } = req.params;

    const paymentStatus = await verifyPayment(tx_ref);
    const transaction = await getPaymentByTxRef(tx_ref);

    res.json({
      payment: paymentStatus,
      transaction
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Handle Paychangu Webhook
 * POST /api/payments/webhook
 */
const handlePaymentWebhook = async (req, res, next) => {
  // Log everything coming in
  console.log('🔔 WEBHOOK RECEIVED - FULL REQUEST DETAILS:');
  console.log('Method:', req.method);
  console.log('URL:', req.url);
  console.log('Query Params:', req.query);
  console.log('Headers:', JSON.stringify(req.headers, null, 2));
  console.log('Body:', JSON.stringify(req.body, null, 2));
  console.log('Raw Body Type:', typeof req.body);
  console.log('Content-Type:', req.headers['content-type']);
  console.log('User-Agent:', req.headers['user-agent']);
  console.log('Referer:', req.headers['referer']);
  console.log('IP:', req.ip || req.connection.remoteAddress);
  
  try {
    // Handle both GET and POST requests
    if (req.method === 'GET') {
      console.log('⚠️ Received GET request - this might be a redirect, not a webhook');
      const tx_ref = req.query.tx_ref;
      if (tx_ref) {
        console.log('🔍 GET request with tx_ref:', tx_ref);
        
        // ✅ SECURE: Verify payment status with Paychangu
        try {
          console.log('🔍 Verifying payment with Paychangu API...');
          const paymentStatus = await verifyPayment(tx_ref);
          console.log('💳 Payment verification result:', paymentStatus);
          
          // Process payment if successful
          if (paymentStatus.status === 'successful' || paymentStatus.status === 'success') {
            const mockWebhookData = {
              tx_ref: tx_ref,
              status: paymentStatus.data?.status || paymentStatus.status,
              amount: paymentStatus.data?.amount || paymentStatus.amount
            };
            
            console.log('🔄 Processing payment via GET redirect...');
            const transaction = await processWebhook(mockWebhookData, 'SKIP_SIGNATURE_VERIFICATION');
            
            if (transaction) {
              console.log('✅ Payment processed successfully via GET redirect');
              return res.redirect(`${getPrimaryFrontendUrl()}/dashboard/billing?status=success&tx_ref=${tx_ref}`);
            } else {
              console.log('❌ Payment processing failed');
              return res.redirect(`${getPrimaryFrontendUrl()}/dashboard/billing?status=failed&tx_ref=${tx_ref}`);
            }
          } else {
            console.log('❌ Payment verification failed - status:', paymentStatus.status);
            return res.redirect(`${getPrimaryFrontendUrl()}/dashboard/billing?status=failed&tx_ref=${tx_ref}`);
          }
        } catch (error) {
          console.error('❌ Payment verification failed:', error);
          return res.redirect(`${getPrimaryFrontendUrl()}/dashboard/billing?status=failed&tx_ref=${tx_ref}`);
        }
      }
      return res.status(200).json({ message: 'Webhook endpoint active' });
    }

    const webhookData = req.body;
    
    // Validate webhook data structure
    if (!webhookData || typeof webhookData !== 'object') {
      console.log('❌ Invalid webhook data structure');
      return res.status(400).json({ error: 'Invalid webhook data' });
    }

    if (!webhookData.tx_ref) {
      console.log('❌ Missing tx_ref in webhook data');
      return res.status(400).json({ error: 'Missing transaction reference' });
    }

    // Try multiple possible signature header names
    const signature = req.headers['x-paychangu-signature'] || 
                     req.headers['x-webhook-signature'] || 
                     req.headers['signature'] ||
                     req.headers['x-signature'] ||
                     req.headers['paychangu-signature'];

    console.log('📋 Webhook details:', {
      hasSignature: !!signature,
      signature: signature,
      dataKeys: Object.keys(webhookData || {}),
      tx_ref: webhookData.tx_ref,
      status: webhookData.status
    });

    // For testing purposes, allow webhooks without signature in development
    if (!signature && process.env.NODE_ENV === 'production') {
      console.log('❌ Missing webhook signature in production');
      return res.status(400).json({ error: 'Missing webhook signature' });
    }

    // Process webhook with or without signature verification
    const transaction = await processWebhook(webhookData, signature);

    if (!transaction) {
      console.log('❌ Transaction not found for tx_ref:', webhookData.tx_ref);
      return res.status(404).json({ error: 'Transaction not found' });
    }

    console.log('✅ Webhook processed successfully');
    res.json({
      message: 'Webhook processed successfully',
      status: transaction.status,
      tx_ref: webhookData.tx_ref
    });
  } catch (error) {
    console.error('❌ Webhook error:', error);
    res.status(500).json({ 
      error: 'Webhook processing failed',
      message: error.message 
    });
  }
};

/**
 * Get Appointment Payments
 * GET /api/payments/appointment/:appointmentId
 */
const getPaymentsForAppointment = async (req, res, next) => {
  try {
    const { appointmentId } = req.params;

    const payments = await getAppointmentPayments(appointmentId);

    res.json({
      payments,
      total: payments.length
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get User's Payment History
 * GET /api/payments/history
 */
const getPaymentHistory = async (req, res, next) => {
  try {
    const patient = await Patient.findOne({ where: { userId: req.user.id } });

    if (!patient) {
      return res.status(404).json({ error: 'Patient profile not found' });
    }

    const { PaymentTransaction, Appointment } = require('../models');

    const payments = await PaymentTransaction.findAll({
      include: [{
        model: Appointment,
        where: { patientId: patient.id }
      }],
      order: [['createdAt', 'DESC']]
    });

    res.json({
      payments,
      total: payments.length
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Initiate Session Fee Payment
 * POST /api/payments/initiate-session
 */
const initiateSessionPayment = async (req, res, next) => {
  try {
    const { appointmentId } = req.body;

    if (!appointmentId) {
      return res.status(400).json({
        error: 'Missing required field: appointmentId'
      });
    }

    // Get patient details
    const patient = await Patient.findOne({
      where: { userId: req.user.id },
      include: [{ model: User }]
    });

    if (!patient) {
      return res.status(404).json({ error: 'Patient profile not found' });
    }

    // Get appointment details
    const { Appointment, Specialty } = require('../models');
    const appointment = await Appointment.findOne({
      where: { id: appointmentId, patientId: patient.id },
      include: [{ model: Specialty }]
    });

    if (!appointment) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    // Check if session fee is already paid
    if (appointment.sessionFeeStatus === 'completed') {
      return res.status(400).json({ error: 'Session fee already paid' });
    }

    // Prepare customer details
    const customerDetails = {
      email: patient.User.email,
      firstName: patient.User.firstName,
      lastName: patient.User.lastName,
      phone: patient.User.phone || '+265 998 95 15 10'
    };

    // Create pending payment transaction for session fee
    const { PendingPaymentTransaction } = require('../models');
    const baseFee = parseFloat(appointment.sessionFee || appointment.Specialty?.sessionFee || 0);

    // Get rates from config (these will be saved to DB for audit trail)
    const taxRate = paymentConfig.paychangu.taxRate;
    const convenienceFeeRate = paymentConfig.paychangu.convenienceFeePercentage;
    const platformCommissionRate = paymentConfig.paychangu.platformCommissionRate;

    // Calculate all fees
    const taxAmount = Math.round((baseFee * taxRate) / 100);
    const convenienceFeeAmount = Math.round((baseFee * convenienceFeeRate) / 100);
    const platformCommissionAmount = Math.round((baseFee * platformCommissionRate) / 100);
    const caregiverEarnings = baseFee - platformCommissionAmount;
    const totalSessionAmount = parseFloat((baseFee + taxAmount + convenienceFeeAmount).toFixed(2));

    const tx_ref = `HC-${appointmentId}-${Date.now()}`;

    const pendingTransaction = await PendingPaymentTransaction.create({
      appointmentId: appointmentId,
      amount: totalSessionAmount,
      paymentType: 'session_fee',
      currency: 'MWK',
      paymentMethod: 'mobile_money',
      tx_ref: tx_ref,
      status: 'pending',
      pendingBookingId: null, // Explicitly set to null for session payments
      metadata: {
        feeBreakdown: {
          baseFee: baseFee,
          taxRate: taxRate,
          taxAmount: taxAmount,
          convenienceFeeRate: convenienceFeeRate,
          convenienceFeeAmount: convenienceFeeAmount,
          platformCommissionRate: platformCommissionRate,
          platformCommissionAmount: platformCommissionAmount,
          caregiverEarnings: caregiverEarnings,
          totalAmount: totalSessionAmount
        }
      }
    });

    // Use existing payment service but with pending transaction approach
    const axios = require('axios');

    const paymentData = {
      amount: totalSessionAmount,
      currency: 'MWK',
      email: customerDetails.email,
      first_name: customerDetails.firstName,
      last_name: customerDetails.lastName,
      phone_number: customerDetails.phone,
      callback_url: `${paymentConfig.paychangu.webhookBaseUrl}/api/payments/webhook`,
      return_url: `${getPrimaryFrontendUrl()}/appointments`,
      tx_ref: tx_ref,
      customization: {
        title: 'CareConnect ',
        description: `Session Fee for Appointment #${appointmentId} (incl. ${taxRate}% tax & ${convenienceFeeRate}% processing fee)`
      }
    };

    const response = await axios.post(
      `${paymentConfig.paychangu.apiUrl}/payment`,
      paymentData,
      {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${paymentConfig.paychangu.secretKey}`
        }
      }
    );

    const checkoutUrl = response.data.data.checkout_url;

    res.status(201).json({
      message: 'Session fee payment initiated successfully',
      checkoutUrl: checkoutUrl,
      tx_ref: tx_ref,
      transaction: pendingTransaction,
      baseFee: baseFee,
      taxRate: taxRate,
      taxAmount: taxAmount,
      convenienceFeeRate: convenienceFeeRate,
      convenienceFeeAmount: convenienceFeeAmount,
      platformCommissionRate: platformCommissionRate,
      platformCommissionAmount: platformCommissionAmount,
      caregiverEarnings: caregiverEarnings,
      totalAmount: totalSessionAmount
    });
  } catch (error) {
    console.error('❌ Session payment initiation failed:', error);
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
