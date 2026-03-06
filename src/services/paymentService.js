const axios = require('axios');
const crypto = require('crypto');
const { PaymentTransaction, PendingPaymentTransaction, Appointment, Caregiver, User, TimeSlot, PendingBooking, CaregiverEarnings, sequelize } = require('../models');
const { PAYMENT_STATUS } = require('../utils/constants');
const paymentConfig = require('../config/payment');
const logger = require('../utils/logger');
const { getPrimaryFrontendUrl } = require('../utils/config');
const { sendPaymentConfirmation, sendPaymentFailureNotification, sendCaregiverAppointmentNotification } = require('./emailService');
const bookingService = require('./bookingService');
const NotificationHelper = require('../utils/notificationHelper');

/**
 * Initialize Paychangu Payment for Booking
 * Creates a payment request without existing appointment
 */
const initiateBookingPayment = async (bookingData, customerDetails, pendingBookingId) => {
  try {
    const { timeSlotId, specialtyId, sessionType, notes, patientId, caregiverId } = bookingData;
    
    // Get specialty to calculate fees
    const { Specialty } = require('../models');
    const specialty = await Specialty.findByPk(specialtyId);
    if (!specialty) {
      throw new Error('Specialty not found');
    }

    const bookingFee = parseFloat(specialty.bookingFee || 0);
    const sessionFee = parseFloat(specialty.sessionFee || 0);

    // Calculate convenience fee
    const convenienceFeePercentage = paymentConfig.paychangu.convenienceFeePercentage;
    const bookingConvenienceFee = Math.round((bookingFee * convenienceFeePercentage) / 100);
    const totalBookingAmount = parseFloat((bookingFee + bookingConvenienceFee).toFixed(2));

    // Generate unique transaction reference
    const tx_ref = `HC-BOOKING-${timeSlotId}-${Date.now()}`;

    // Use total booking fee for initial payment (including convenience fee)
    const paymentAmount = totalBookingAmount;
    const paymentType = 'booking_fee';

    // Paychangu API payload - matching working test format
    const paymentData = {
      amount: paymentAmount,
      currency: paymentConfig.paychangu.currency,
      email: customerDetails.email,
      first_name: customerDetails.firstName,
      last_name: customerDetails.lastName,
      phone_number: customerDetails.phone,
      callback_url: `${paymentConfig.paychangu.webhookBaseUrl}/api/payments/webhook`,
      return_url: `${getPrimaryFrontendUrl()}/dashboard/billing?status=success`,
      tx_ref: tx_ref,
      customization: {
        title: 'CareConnect Booking Payment',
        description: `Booking Fee for Appointment with ${specialty.name}`
      }
    };

    // Log payment data for debugging
    console.log('💳 Initiating Paychangu payment:');
    console.log('📤 PAYCHANGU REQUEST BODY:', JSON.stringify(paymentData, null, 2));
    console.log('📤 PAYCHANGU REQUEST URL:', `${paymentConfig.paychangu.apiUrl}/payment`);
    console.log('📤 PAYCHANGU REQUEST HEADERS:', {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${paymentConfig.paychangu.secretKey ? '[REDACTED]' : 'NOT_SET'}`
    });

    // Call Paychangu API
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

    // Create pending payment transaction record
    const pendingTransaction = await PendingPaymentTransaction.create({
      pendingBookingId: pendingBookingId,
      amount: paymentAmount,
      currency: paymentConfig.paychangu.currency,
      paymentMethod: 'paychangu',
      paymentType: paymentType,
      tx_ref: tx_ref,
      status: PAYMENT_STATUS.PENDING,
      metadata: {
        checkout_url: response.data.data?.checkout_url,
        tx_ref: response.data.data?.data?.tx_ref || tx_ref,
        mode: response.data.data?.data?.mode,
        paymentType: paymentType,
        bookingData: {
          timeSlotId,
          specialtyId,
          sessionType,
          notes,
          patientId,
          caregiverId,
          bookingFee,
          sessionFee
        },
        feeBreakdown: {
          baseFee: bookingFee,
          convenienceFee: bookingConvenienceFee,
          convenienceFeePercentage: convenienceFeePercentage,
          totalAmount: totalBookingAmount
        }
      }
    });

    logger.info(`Booking payment initiated: ${tx_ref}`, {
      timeSlotId,
      specialtyId,
      amount: paymentAmount,
      bookingFee,
      sessionFee
    });

    return {
      transaction: pendingTransaction,
      checkoutUrl: response.data.data.checkout_url,
      tx_ref: response.data.data.data.tx_ref,
      status: response.data.status
    };
  } catch (error) {
    console.error('❌ Paychangu API Error:', {
      message: error.message,
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      config: {
        url: error.config?.url,
        method: error.config?.method,
        data: error.config?.data
      }
    });
    
    logger.error('Payment initiation failed:', error);
    
    // Return more specific error message
    const errorMessage = error.response?.data?.message || error.response?.data?.error || error.message;
    throw new Error(`Payment creation failed: ${errorMessage}`);
  }
};

/**
 * Verify Paychangu Payment
 * Check payment status using transaction reference
 */
const verifyPayment = async (tx_ref) => {
  try {
    const response = await axios.get(
      `${paymentConfig.paychangu.apiUrl}/verify-payment/${tx_ref}`,
      {
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${paymentConfig.paychangu.secretKey}`
        }
      }
    );

    return response.data;
  } catch (error) {
    logger.error('Payment verification failed:', error);
    throw new Error(`Payment verification failed: ${error.message}`);
  }
};

/**
 * Process Webhook from Paychangu
 * Validate and update payment status with pending booking integration
 */
const processWebhook = async (webhookData, signature) => {
  const t = await sequelize.transaction();

  try {
    // Verify webhook signature (skip for GET redirects or if no signature/secret)
    if (signature && signature !== 'SKIP_SIGNATURE_VERIFICATION' && paymentConfig.paychangu.webhookSecret) {
      const isValid = verifyWebhookSignature(webhookData, signature);
      if (!isValid) {
        throw new Error('Invalid webhook signature');
      }
    }

    const { tx_ref, status, amount } = webhookData;

    // Find pending payment transaction by tx_ref
    const pendingTransaction = await PendingPaymentTransaction.findOne({
      where: { tx_ref: tx_ref },
      transaction: t
    });

    if (!pendingTransaction) {
      logger.warn(`Pending transaction not found for tx_ref: ${tx_ref}`);
      await t.rollback();
      return null;
    }

    // Check if already processed (idempotency)
    if (pendingTransaction.status === PAYMENT_STATUS.COMPLETED) {
      logger.info(`Payment ${tx_ref} already processed, skipping`);
      await t.commit();
      return pendingTransaction;
    }

    // Update pending transaction status
    let newStatus = PAYMENT_STATUS.PENDING;
    if (status === 'successful' || status === 'success') {
      newStatus = PAYMENT_STATUS.COMPLETED;
      pendingTransaction.paidAt = new Date();
    } else if (status === 'failed') {
      newStatus = PAYMENT_STATUS.FAILED;
    }

    pendingTransaction.status = newStatus;
    await pendingTransaction.save({ transaction: t });

    // Handle successful payment
    if (newStatus === PAYMENT_STATUS.COMPLETED) {
      let appointment;

      // Find pending booking by tx_ref
      const pendingBooking = await PendingBooking.findOne({
        where: { tx_ref: tx_ref },
        transaction: t
      });

      if (pendingBooking) {
        // Convert pending booking to appointment
        const { appointment: newAppointment } = await bookingService.convertPendingBookingToAppointment(
          pendingBooking.id,
          tx_ref,
          t
        );

        appointment = newAppointment;

        // Extract fee breakdown from metadata
        const feeBreakdown = pendingTransaction.metadata?.feeBreakdown || {};

        // Transfer pending payment to actual PaymentTransaction table
        const actualTransaction = await PaymentTransaction.create({
          appointmentId: appointment.id,
          amount: pendingTransaction.amount,
          baseFee: feeBreakdown.baseFee || null,
          taxRate: feeBreakdown.taxRate || null,
          taxAmount: feeBreakdown.taxAmount || null,
          convenienceFeeRate: feeBreakdown.convenienceFeeRate || feeBreakdown.convenienceFeePercentage || null,
          convenienceFeeAmount: feeBreakdown.convenienceFeeAmount || feeBreakdown.convenienceFee || null,
          platformCommissionRate: feeBreakdown.platformCommissionRate || null,
          platformCommissionAmount: feeBreakdown.platformCommissionAmount || null,
          caregiverEarnings: feeBreakdown.caregiverEarnings || null,
          currency: pendingTransaction.currency,
          paymentMethod: pendingTransaction.paymentMethod,
          paymentType: pendingTransaction.paymentType,
          stripePaymentIntentId: pendingTransaction.tx_ref,
          status: PAYMENT_STATUS.COMPLETED,
          paidAt: pendingTransaction.paidAt,
          metadata: pendingTransaction.metadata
        }, { transaction: t });

        // Mark pending transaction as converted
        await pendingTransaction.update({
          convertedToPaymentId: actualTransaction.id
        }, { transaction: t });

        // Update caregiver earnings if caregiverEarnings exists (for booking fees that have earnings)
        if (actualTransaction.caregiverEarnings && actualTransaction.caregiverEarnings > 0) {
          await updateCaregiverEarnings(appointment.caregiverId, actualTransaction.caregiverEarnings, t);
        }

        logger.info(`Pending payment ${pendingTransaction.id} converted to payment ${actualTransaction.id}`);
      } else if (pendingTransaction.appointmentId) {
        // Handle session fee payment for existing appointment
        logger.info(`Processing session fee payment for appointment ${pendingTransaction.appointmentId}`);

        appointment = await Appointment.findByPk(pendingTransaction.appointmentId, { transaction: t });

        if (!appointment) {
          throw new Error(`Appointment ${pendingTransaction.appointmentId} not found for session fee payment`);
        }

        // Calculate overall payment status
        const overallPaymentStatus = appointment.bookingFeeStatus === PAYMENT_STATUS.COMPLETED ? 'completed' : 'partial';

        // Update appointment session fee status and mark as attended
        const { QueryTypes } = require('sequelize');
        const currentTime = new Date();

        await sequelize.query(
          `UPDATE appointments SET
           session_fee_status = 'completed',
           session_paid_at = ?,
           paymentStatus = ?,
           status = 'session_attended'
           WHERE id = ?`,
          {
            replacements: [currentTime, overallPaymentStatus, appointment.id],
            type: QueryTypes.UPDATE,
            transaction: t
          }
        );

        // Extract fee breakdown from metadata
        // Parse metadata if it's a string (handle double-encoded JSON)
        let metadata = pendingTransaction.metadata;
        if (typeof metadata === 'string') {
          try {
            metadata = JSON.parse(metadata);
            // Handle double-encoded JSON
            if (typeof metadata === 'string') {
              metadata = JSON.parse(metadata);
            }
          } catch (e) {
            console.error('Failed to parse metadata JSON:', e);
            metadata = {};
          }
        }
        const sessionFeeBreakdown = metadata?.feeBreakdown || {};
        
        // Debug: Log the metadata to see what's stored
        console.log('🔍 DEBUG - Pending transaction metadata:', JSON.stringify(pendingTransaction.metadata, null, 2));
        console.log('🔍 DEBUG - Parsed metadata:', JSON.stringify(metadata, null, 2));
        console.log('🔍 DEBUG - Session fee breakdown:', JSON.stringify(sessionFeeBreakdown, null, 2));
        console.log('🔍 DEBUG - caregiverEarnings from breakdown:', sessionFeeBreakdown.caregiverEarnings);

        // Create actual PaymentTransaction record
        const actualTransaction = await PaymentTransaction.create({
          appointmentId: appointment.id,
          amount: pendingTransaction.amount,
          baseFee: sessionFeeBreakdown.baseFee || null,
          taxRate: sessionFeeBreakdown.taxRate || null,
          taxAmount: sessionFeeBreakdown.taxAmount || null,
          convenienceFeeRate: sessionFeeBreakdown.convenienceFeeRate || sessionFeeBreakdown.convenienceFeePercentage || null,
          convenienceFeeAmount: sessionFeeBreakdown.convenienceFeeAmount || sessionFeeBreakdown.convenienceFee || null,
          platformCommissionRate: sessionFeeBreakdown.platformCommissionRate || null,
          platformCommissionAmount: sessionFeeBreakdown.platformCommissionAmount || null,
          caregiverEarnings: sessionFeeBreakdown.caregiverEarnings || null,
          currency: pendingTransaction.currency,
          paymentMethod: pendingTransaction.paymentMethod,
          paymentType: 'session_fee',
          stripePaymentIntentId: pendingTransaction.tx_ref,
          status: PAYMENT_STATUS.COMPLETED,
          paidAt: pendingTransaction.paidAt,
          metadata: pendingTransaction.metadata
        }, { transaction: t });
        
        // Debug: Log the created transaction
        console.log('🔍 DEBUG - Created actualTransaction caregiverEarnings:', actualTransaction.caregiverEarnings);

        // Mark pending transaction as converted
        await pendingTransaction.update({
          convertedToPaymentId: actualTransaction.id
        }, { transaction: t });

        // Update caregiver earnings if caregiverEarnings exists
        if (actualTransaction.caregiverEarnings && actualTransaction.caregiverEarnings > 0) {
          // Check if care report already exists (handles out-of-order webhook)
          const { CareSessionReport } = require('../models');
          const existingReport = await CareSessionReport.findOne({
            where: { appointmentId: appointment.id },
            transaction: t
          });

          // Lock earnings until care report is uploaded (unless report already exists)
          const shouldLock = !existingReport;
          await updateCaregiverEarnings(appointment.caregiverId, actualTransaction.caregiverEarnings, t, shouldLock);
        }

        logger.info(`Session fee payment ${actualTransaction.id} completed for appointment ${appointment.id}`);
        
        // Create payment notifications for session fee
        try {
          const { Patient } = require('../models');
          const fullAppointment = await Appointment.findByPk(appointment.id, {
            include: [
              { model: Patient, include: [{ model: User }] },
              { model: Caregiver, include: [{ model: User }] }
            ]
          });
          
          await NotificationHelper.createPaymentNotifications({
            id: actualTransaction.id,
            patientId: fullAppointment?.Patient?.User?.id,
            caregiverId: fullAppointment?.Caregiver?.User?.id,
            amount: actualTransaction.amount,
            caregiverEarnings: actualTransaction.caregiverEarnings,
            status: 'completed',
            paymentType: 'session_fee',
            region: fullAppointment?.Caregiver?.region
          });
        } catch (notificationError) {
          console.error('Failed to create session fee payment notifications:', notificationError);
        }
      } else {
        // Invalid pending transaction state
        throw new Error(`Invalid pending transaction: missing both pendingBookingId and appointmentId for tx_ref ${tx_ref}`);
      }

      // Commit transaction before sending emails
      await t.commit();

      // Send confirmation email (outside transaction)
      if (appointment) {
        try {
          const { Patient } = require('../models');
          const fullAppointment = await Appointment.findByPk(appointment.id, {
            include: [
              { model: Caregiver, include: [{ model: User }] },
              { model: Patient, include: [{ model: User }] },
              { model: TimeSlot }
            ]
          });

          // Construct magic links only for teleconference sessions
          const appUrl = getPrimaryFrontendUrl();
          const patientMeetingUrl = fullAppointment.sessionType === 'teleconference' && fullAppointment.patientMeetingToken
            ? `${appUrl}/meeting/join/${fullAppointment.patientMeetingToken}`
            : null;
          const caregiverMeetingUrl = fullAppointment.sessionType === 'teleconference' && fullAppointment.caregiverMeetingToken
            ? `${appUrl}/meeting/join/${fullAppointment.caregiverMeetingToken}`
            : null;

          // Send payment confirmation to patient
          if (fullAppointment?.Patient?.User?.email) {
            await sendPaymentConfirmation(fullAppointment.Patient.User.email, {
              patientName: `${fullAppointment.Patient.User.firstName} ${fullAppointment.Patient.User.lastName}`,
              amount: pendingTransaction.amount,
              transactionId: tx_ref,
              appointmentDate: fullAppointment.TimeSlot?.date || fullAppointment.scheduledDate,
              caregiverName: fullAppointment.Caregiver?.User ?
                `${fullAppointment.Caregiver.User.firstName} ${fullAppointment.Caregiver.User.lastName}` :
                'Your Caregiver',
              jitsiMeetingUrl: patientMeetingUrl
            });
            logger.info(`Payment confirmation email sent to patient: ${fullAppointment.Patient.User.email}`);
          }

          // Send appropriate notification to caregiver based on payment type
          if (fullAppointment?.Caregiver?.User?.email) {
            if (pendingTransaction.paymentType === 'booking_fee') {
              // For booking fee: send appointment notification
              await sendCaregiverAppointmentNotification(fullAppointment.Caregiver.User.email, {
                caregiverName: `${fullAppointment.Caregiver.User.firstName} ${fullAppointment.Caregiver.User.lastName}`,
                patientName: `${fullAppointment.Patient.User.firstName} ${fullAppointment.Patient.User.lastName}`,
                scheduledDate: fullAppointment.scheduledDate,
                sessionType: fullAppointment.sessionType,
                duration: fullAppointment.duration,
                notes: fullAppointment.notes,
                jitsiMeetingUrl: caregiverMeetingUrl
              });
              logger.info(`New appointment notification sent to caregiver: ${fullAppointment.Caregiver.User.email}`);
            } else if (pendingTransaction.paymentType === 'session_fee') {
              // For session fee: send payment confirmation (caregiver earns money)
              await sendPaymentConfirmation(fullAppointment.Caregiver.User.email, {
                patientName: `${fullAppointment.Patient.User.firstName} ${fullAppointment.Patient.User.lastName}`,
                amount: pendingTransaction.amount,
                transactionId: tx_ref,
                appointmentDate: fullAppointment.TimeSlot?.date || fullAppointment.scheduledDate,
                caregiverName: `${fullAppointment.Caregiver.User.firstName} ${fullAppointment.Caregiver.User.lastName}`,
                jitsiMeetingUrl: caregiverMeetingUrl
              });
              logger.info(`Session fee payment confirmation sent to caregiver: ${fullAppointment.Caregiver.User.email}`);
            }
          }
        } catch (emailError) {
          logger.error('Failed to send payment confirmation email:', emailError);
        }
      }

      return pendingTransaction;
    }

    // Handle failed payment
    if (newStatus === PAYMENT_STATUS.FAILED) {
      // Find pending booking associated with this transaction
      const pendingBooking = await PendingBooking.findOne({
        where: {
          tx_ref: tx_ref
        },
        transaction: t
      });

      if (pendingBooking && pendingBooking.status !== 'expired' && pendingBooking.status !== 'payment_failed') {
        // Release pending booking and slot
        await bookingService.releasePendingBooking(pendingBooking.id, 'payment_failed', t);
        logger.info(`Released pending booking ${pendingBooking.id} due to payment failure`);
      }

      await t.commit();

      // Send failure notification email (outside transaction)
      if (pendingBooking) {
        try {
          const { Patient } = require('../models');
          const bookingWithPatient = await PendingBooking.findByPk(pendingBooking.id, {
            include: [{ model: Patient, include: [{ model: User }] }]
          });

          if (bookingWithPatient?.Patient?.User?.email) {
            await sendPaymentFailureNotification(bookingWithPatient.Patient.User.email, {
              patientName: `${bookingWithPatient.Patient.User.firstName} ${bookingWithPatient.Patient.User.lastName}`,
              tx_ref: tx_ref,
              amount: pendingTransaction.amount,
              bookingId: pendingBooking.id
            });

            // Mark notification as sent
            await bookingWithPatient.update({ notificationSent: true });

            logger.info(`Payment failure notification sent to: ${bookingWithPatient.Patient.User.email}`);
          }
        } catch (emailError) {
          logger.error('Failed to send payment failure notification:', emailError);
        }
      }

      return pendingTransaction;
    }

    // For pending status, just commit
    await t.commit();
    logger.info(`Payment webhook processed: ${tx_ref}`, { status: newStatus });

    return pendingTransaction;
  } catch (error) {
    await t.rollback();
    logger.error('Webhook processing failed:', error);
    throw error;
  }
};

/**
 * Update Caregiver Earnings
 * Add earnings to caregiver's total and wallet/locked balance
 * @param {number} caregiverId
 * @param {number} earnedAmount
 * @param {object} transaction - Sequelize transaction
 * @param {boolean} shouldLock - If true, add to lockedBalance instead of walletBalance
 */
const updateCaregiverEarnings = async (caregiverId, earnedAmount, transaction = null, shouldLock = false) => {
  try {
    // Find or create caregiver earnings record
    const [earnings] = await CaregiverEarnings.findOrCreate({
      where: { caregiverId: caregiverId },
      defaults: {
        caregiverId: caregiverId,
        totalCaregiverEarnings: 0,
        walletBalance: 0,
        lockedBalance: 0
      },
      transaction
    });

    const updateData = {
      totalCaregiverEarnings: parseFloat(earnings.totalCaregiverEarnings) + parseFloat(earnedAmount)
    };

    if (shouldLock) {
      // Lock earnings until care report is submitted
      updateData.lockedBalance = parseFloat(earnings.lockedBalance || 0) + parseFloat(earnedAmount);
    } else {
      // Add directly to available wallet balance
      updateData.walletBalance = parseFloat(earnings.walletBalance) + parseFloat(earnedAmount);
    }

    await earnings.update(updateData, { transaction });

    logger.info(`Updated caregiver ${caregiverId} earnings: +${earnedAmount} MWK (locked: ${shouldLock})`);
    return earnings;
  } catch (error) {
    logger.error('Failed to update caregiver earnings:', error);
    throw error;
  }
};

/**
 * Verify Webhook Signature
 * Ensures webhook is from Paychangu
 */
const verifyWebhookSignature = (data, signature) => {
  const webhookSecret = paymentConfig.paychangu.webhookSecret;
  const hash = crypto
    .createHmac('sha256', webhookSecret)
    .update(JSON.stringify(data))
    .digest('hex');

  return hash === signature;
};

/**
 * Get Payment by Transaction Reference
 */
const getPaymentByTxRef = async (tx_ref) => {
  try {
    const transaction = await PaymentTransaction.findOne({
      where: { stripePaymentIntentId: tx_ref },
      include: [{ model: Appointment }]
    });

    return transaction;
  } catch (error) {
    logger.error('Get payment failed:', error);
    throw new Error(`Failed to retrieve payment: ${error.message}`);
  }
};

/**
 * Get All Payments for an Appointment
 */
const getAppointmentPayments = async (appointmentId) => {
  try {
    const transactions = await PaymentTransaction.findAll({
      where: { appointmentId },
      order: [['createdAt', 'DESC']]
    });

    return transactions;
  } catch (error) {
    logger.error('Get appointment payments failed:', error);
    throw new Error(`Failed to retrieve payments: ${error.message}`);
  }
};


/**
 * Process Withdrawal via PayChangu
 */
const processWithdrawal = async (withdrawalData) => {
  try {
    const { amount, recipientType, recipientNumber, reference, operator, bankCode, accountName } = withdrawalData;

    // Input validation
    if (!amount || amount <= 0) {
      throw new Error('Invalid amount');
    }
    if (!recipientNumber || recipientNumber.length < 8) {
      throw new Error('Invalid recipient number');
    }

    let payoutData, endpoint;

    if (recipientType === 'mobile_money') {
      // Validate operator
      if (!['airtel', 'tnm'].includes(operator)) {
        throw new Error('Invalid mobile money operator');
      }
      
      // Round to nearest integer (fair rounding)
      // Math.round: 77.5 → 78, 77.4 → 77 (fairer than Math.ceil which always rounds up)
      const roundedAmount = Math.round(parseFloat(amount));
      
      // Format phone number correctly for PayChangu (9 digits without leading 0)
      let formattedPhone = recipientNumber;
      
      // Remove any existing country code or + symbols and leading 0
      formattedPhone = formattedPhone.replace(/^\+?265/, '').replace(/^0/, '');
      
      // Ensure exactly 9 digits (no country code, no leading 0)
      if (formattedPhone.length !== 9) {
        throw new Error(`Invalid phone number format. Expected 9 digits, got ${formattedPhone.length}`);
      }
      
      // Map operator to PayChangu operator ref_id
      const operatorRefIds = {
        'airtel': '20be6c20-adeb-4b5b-a7ba-0769820df4fb',
        'tnm': '27494cb5-ba9e-437f-a114-4e7a7686bcca'
      };
      
      // Use correct PayChangu mobile money payout structure
      payoutData = {
        mobile_money_operator_ref_id: operatorRefIds[operator],
        mobile: formattedPhone,
        amount: roundedAmount,
        charge_id: reference
      };
      endpoint = '/mobile-money/payouts/initialize';
      
    } else if (recipientType === 'bank') {
      // Validate required bank fields
      if (!bankCode || !accountName) {
        throw new Error('Bank code and account name are required for bank transfers');
      }
      
      // Round to nearest integer (fair rounding)
      // Math.round: 77.5 → 78, 77.4 → 77 (fairer than Math.ceil which always rounds up)
      const roundedAmount = Math.round(parseFloat(amount));
      
      // Use correct PayChangu bank payout structure
      payoutData = {
        payout_method: 'bank_transfer',
        bank_uuid: bankCode, // bankCode should be the bank UUID from PayChangu
        account_name: accountName,
        account_number: recipientNumber,
        amount: roundedAmount,
        charge_id: reference
      };
      endpoint = '/direct-charge/payouts/initialize';
      
    } else {
      throw new Error('Invalid recipient type');
    }

    logger.info(`💳 Withdrawal API Request:`, {
      endpoint: `${paymentConfig.paychangu.apiUrl}${endpoint}`,
      reference: reference,
      originalAmount: parseFloat(amount),
      roundedAmount: payoutData.amount,
      recipientType: recipientType,
      recipientNumber: recipientNumber.substring(0, 6) + '***',
      formattedPhone: payoutData.mobile?.substring(0, 8) + '***' || 'N/A',
      operator: operator || 'N/A',
      operatorRefId: payoutData.mobile_money_operator_ref_id || 'N/A',
      bankUuid: payoutData.bank_uuid || 'N/A'
    });

    const response = await axios.post(
      `${paymentConfig.paychangu.apiUrl}${endpoint}`,
      payoutData,
      {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${paymentConfig.paychangu.secretKey}`
        }
      }
    );

    logger.info(`✅ Withdrawal API Response:`, {
      reference: reference,
      status: response.data.status,
      payoutId: response.data.data?.charge_id || response.data.data?.ref_id,
      message: response.data.message
    });
    
    return response.data;
  } catch (error) {
    logger.error(`❌ Withdrawal API Error:`, {
      reference: withdrawalData.reference,
      error: error.message,
      status: error.response?.status,
      statusText: error.response?.statusText,
      responseData: error.response?.data,
      recipientType: withdrawalData.recipientType,
      amount: withdrawalData.amount
    });
    throw error;
  }
};

module.exports = {
  initiateBookingPayment,
  verifyPayment,
  processWebhook,
  verifyWebhookSignature,
  getPaymentByTxRef,
  getAppointmentPayments,
  updateCaregiverEarnings,
  processWithdrawal
};

