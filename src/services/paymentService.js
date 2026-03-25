const { PaymentTransaction, PendingPaymentTransaction, Appointment, Caregiver, User, TimeSlot, PendingBooking, CaregiverEarnings, PaystackSubaccount, sequelize } = require('../models');
const { PAYMENT_STATUS } = require('../utils/constants');
const paystackService = require('./paystackService');
const logger = require('../utils/logger');
const { getPrimaryFrontendUrl } = require('../utils/config');
const { sendPaymentConfirmation, sendPaymentFailureNotification, sendCaregiverAppointmentNotification } = require('./emailService');
const bookingService = require('./bookingService');
const NotificationHelper = require('../utils/notificationHelper');

/**
 * Initiate Paystack Payment for Booking
 */
const initiateBookingPayment = async (bookingData, customerDetails, pendingBookingId) => {
  try {
    const { timeSlotId, specialtyId, sessionType, notes, patientId, caregiverId, paymentMethod } = bookingData;
    const channel = paymentMethod || 'mobile_money';
    const channels = channel === 'card' ? ['card'] : ['mobile_money'];

    const { Specialty } = require('../models');
    const specialty = await Specialty.findByPk(specialtyId);
    if (!specialty) throw new Error('Specialty not found');

    const bookingFee = parseFloat(specialty.bookingFee || 0);
    const sessionFee = parseFloat(specialty.sessionFee || 0);
    const fees = paystackService.calculateFees(bookingFee, channel);

    const tx_ref = `HC-BOOKING-${timeSlotId}-${Date.now()}`;

    // Get caregiver subaccount — required for payment split
    const subaccount = await PaystackSubaccount.findOne({ where: { caregiverId, isActive: true } });
    if (!subaccount) throw new Error('CAREGIVER_NO_SUBACCOUNT');

    const paymentData = await paystackService.initializePayment({
      email: customerDetails.email,
      amount: fees.totalAmount,
      tx_ref,
      subaccountCode: subaccount?.subaccountCode || null,
      transactionCharge: fees.transactionCharge,
      callbackUrl: `${process.env.WEBHOOK_BASE_URL}/api/payments/webhook`,
      returnUrl: `${getPrimaryFrontendUrl()}/dashboard/billing`,
      channels,
      metadata: {
        type: 'booking_fee',
        pendingBookingId,
        patientId,
        caregiverId,
        timeSlotId,
        specialtyId,
        sessionType,
        notes
      }
    });

    const pendingTransaction = await PendingPaymentTransaction.create({
      pendingBookingId,
      amount: fees.totalAmount,
      currency: 'KES',
      paymentMethod: 'paystack',
      paymentType: 'booking_fee',
      tx_ref,
      status: PAYMENT_STATUS.PENDING,
      metadata: {
        paystackReference: paymentData.reference,
        feeBreakdown: { ...fees, bookingFee, sessionFee }
      }
    });

    return {
      transaction: pendingTransaction,
      checkoutUrl: paymentData.authorization_url,
      tx_ref: paymentData.reference,
      status: 'success'
    };
  } catch (error) {
    logger.error('Payment initiation failed:', error);
    throw error;
  }
};

/**
 * Verify Paystack Payment
 */
const verifyPayment = async (reference) => {
  return paystackService.verifyPayment(reference);
};

/**
 * Process Paystack Webhook (charge.success event)
 */
const processWebhook = async (webhookData, rawBody, signature) => {
  const t = await sequelize.transaction();

  try {
    // Verify signature if provided
    if (signature && rawBody) {
      const isValid = paystackService.verifyWebhookSignature(rawBody, signature);
      if (!isValid) throw new Error('Invalid webhook signature');
    }

    // Only process charge.success
    const event = webhookData.event;
    const data = webhookData.data || webhookData;

    const tx_ref = data.reference || data.tx_ref;
    const status = data.status;
    const amount = data.amount ? data.amount / 100 : data.amount; // convert from kobo

    if (event && event !== 'charge.success' && status !== 'success' && status !== 'successful') {
      await t.rollback();
      return null;
    }

    const pendingTransaction = await PendingPaymentTransaction.findOne({
      where: { tx_ref },
      transaction: t
    });

    if (!pendingTransaction) {
      logger.warn(`Pending transaction not found for reference: ${tx_ref}`);
      await t.rollback();
      return null;
    }

    if (pendingTransaction.status === PAYMENT_STATUS.COMPLETED) {
      logger.info(`Payment ${tx_ref} already processed`);
      await t.commit();
      return pendingTransaction;
    }

    let newStatus = PAYMENT_STATUS.PENDING;
    if (status === 'success' || status === 'successful') {
      newStatus = PAYMENT_STATUS.COMPLETED;
      pendingTransaction.paidAt = new Date();
    } else if (status === 'failed') {
      newStatus = PAYMENT_STATUS.FAILED;
    }

    pendingTransaction.status = newStatus;
    await pendingTransaction.save({ transaction: t });

    if (newStatus === PAYMENT_STATUS.COMPLETED) {
      let appointment;
      const pendingBooking = await PendingBooking.findOne({ where: { tx_ref }, transaction: t });

      if (pendingBooking) {
        const { appointment: newAppointment } = await bookingService.convertPendingBookingToAppointment(
          pendingBooking.id, tx_ref, t
        );
        appointment = newAppointment;

        let bookingMetadata = pendingTransaction.metadata;
        if (typeof bookingMetadata === 'string') {
          try { bookingMetadata = JSON.parse(bookingMetadata); } catch { bookingMetadata = {}; }
        }
        const feeBreakdown = bookingMetadata?.feeBreakdown || {};

        const actualTransaction = await PaymentTransaction.create({
          appointmentId: appointment.id,
          amount: pendingTransaction.amount,
          baseFee: feeBreakdown.baseFee || null,
          convenienceFeeRate: feeBreakdown.convenienceFeeRate || null,
          convenienceFeeAmount: feeBreakdown.convenienceFee || null,
          platformCommissionRate: feeBreakdown.platformCommissionRate || null,
          platformCommissionAmount: feeBreakdown.platformCommission || null,
          caregiverEarnings: feeBreakdown.caregiverEarnings || null,
          currency: 'KES',
          paymentMethod: 'paystack',
          paymentType: 'booking_fee',
          paystackReference: tx_ref,
          subaccountCode: data.subaccount?.subaccount_code || null,
          transactionCharge: feeBreakdown.transactionCharge || null,
          channel: data.channel || null,
          status: PAYMENT_STATUS.COMPLETED,
          paidAt: pendingTransaction.paidAt,
          metadata: { paystackData: data, feeBreakdown }
        }, { transaction: t });

        await pendingTransaction.update({ convertedToPaymentId: actualTransaction.id }, { transaction: t });

        if (actualTransaction.caregiverEarnings && actualTransaction.caregiverEarnings > 0) {
          await updateCaregiverEarnings(appointment.caregiverId, actualTransaction.caregiverEarnings, t);
        }

      } else if (pendingTransaction.appointmentId) {
        appointment = await Appointment.findByPk(pendingTransaction.appointmentId, { transaction: t });
        if (!appointment) throw new Error(`Appointment ${pendingTransaction.appointmentId} not found`);

        const { QueryTypes } = require('sequelize');
        await sequelize.query(
          `UPDATE appointments SET session_fee_status = 'completed', session_paid_at = ?, paymentStatus = 'completed', status = 'session_attended' WHERE id = ?`,
          { replacements: [new Date(), appointment.id], type: QueryTypes.UPDATE, transaction: t }
        );

        let metadata = pendingTransaction.metadata;
        if (typeof metadata === 'string') {
          try { metadata = JSON.parse(metadata); } catch { metadata = {}; }
        }
        const feeBreakdown = metadata?.feeBreakdown || {};

        const actualTransaction = await PaymentTransaction.create({
          appointmentId: appointment.id,
          amount: pendingTransaction.amount,
          baseFee: feeBreakdown.baseFee || null,
          convenienceFeeRate: feeBreakdown.convenienceFeeRate || null,
          convenienceFeeAmount: feeBreakdown.convenienceFee || null,
          platformCommissionRate: feeBreakdown.platformCommissionRate || null,
          platformCommissionAmount: feeBreakdown.platformCommission || null,
          caregiverEarnings: feeBreakdown.caregiverEarnings || null,
          currency: 'KES',
          paymentMethod: 'paystack',
          paymentType: 'session_fee',
          paystackReference: tx_ref,
          subaccountCode: data.subaccount?.subaccount_code || null,
          transactionCharge: feeBreakdown.transactionCharge || null,
          channel: data.channel || null,
          status: PAYMENT_STATUS.COMPLETED,
          paidAt: pendingTransaction.paidAt,
          metadata: { paystackData: data, feeBreakdown }
        }, { transaction: t });

        await pendingTransaction.update({ convertedToPaymentId: actualTransaction.id }, { transaction: t });

        if (actualTransaction.caregiverEarnings && actualTransaction.caregiverEarnings > 0) {
          await updateCaregiverEarnings(appointment.caregiverId, actualTransaction.caregiverEarnings, t);
        }

        // Notifications
        try {
          const { Patient } = require('../models');
          const fullAppointment = await Appointment.findByPk(appointment.id, {
            include: [{ model: Patient, include: [{ model: User }] }, { model: Caregiver, include: [{ model: User }] }]
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
        } catch (err) {
          logger.error('Failed to create session fee notifications:', err);
        }
      } else {
        throw new Error(`Invalid pending transaction: missing pendingBookingId and appointmentId for ${tx_ref}`);
      }

      await t.commit();

      // Send emails outside transaction
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

          const appUrl = getPrimaryFrontendUrl();
          const patientMeetingUrl = fullAppointment.sessionType === 'teleconference' && fullAppointment.patientMeetingToken
            ? `${appUrl}/meeting/join/${fullAppointment.patientMeetingToken}` : null;
          const caregiverMeetingUrl = fullAppointment.sessionType === 'teleconference' && fullAppointment.caregiverMeetingToken
            ? `${appUrl}/meeting/join/${fullAppointment.caregiverMeetingToken}` : null;

          if (fullAppointment?.Patient?.User?.email) {
            await sendPaymentConfirmation(fullAppointment.Patient.User.email, {
              patientName: `${fullAppointment.Patient.User.firstName} ${fullAppointment.Patient.User.lastName}`,
              amount: pendingTransaction.amount,
              transactionId: tx_ref,
              appointmentDate: fullAppointment.TimeSlot?.date || fullAppointment.scheduledDate,
              caregiverName: fullAppointment.Caregiver?.User
                ? `${fullAppointment.Caregiver.User.firstName} ${fullAppointment.Caregiver.User.lastName}` : 'Your Caregiver',
              jitsiMeetingUrl: patientMeetingUrl
            });
          }

          if (fullAppointment?.Caregiver?.User?.email) {
            if (pendingTransaction.paymentType === 'booking_fee') {
              await sendCaregiverAppointmentNotification(fullAppointment.Caregiver.User.email, {
                caregiverName: `${fullAppointment.Caregiver.User.firstName} ${fullAppointment.Caregiver.User.lastName}`,
                patientName: `${fullAppointment.Patient.User.firstName} ${fullAppointment.Patient.User.lastName}`,
                scheduledDate: fullAppointment.scheduledDate,
                sessionType: fullAppointment.sessionType,
                duration: fullAppointment.duration,
                notes: fullAppointment.notes,
                jitsiMeetingUrl: caregiverMeetingUrl
              });
            } else {
              await sendPaymentConfirmation(fullAppointment.Caregiver.User.email, {
                patientName: `${fullAppointment.Patient.User.firstName} ${fullAppointment.Patient.User.lastName}`,
                amount: pendingTransaction.amount,
                transactionId: tx_ref,
                appointmentDate: fullAppointment.TimeSlot?.date || fullAppointment.scheduledDate,
                caregiverName: `${fullAppointment.Caregiver.User.firstName} ${fullAppointment.Caregiver.User.lastName}`,
                jitsiMeetingUrl: caregiverMeetingUrl
              });
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
      const pendingBooking = await PendingBooking.findOne({ where: { tx_ref }, transaction: t });

      if (pendingBooking && !['expired', 'payment_failed'].includes(pendingBooking.status)) {
        await bookingService.releasePendingBooking(pendingBooking.id, 'payment_failed', t);
      }

      await t.commit();

      if (pendingBooking) {
        try {
          const { Patient } = require('../models');
          const bookingWithPatient = await PendingBooking.findByPk(pendingBooking.id, {
            include: [{ model: Patient, include: [{ model: User }] }]
          });
          if (bookingWithPatient?.Patient?.User?.email) {
            await sendPaymentFailureNotification(bookingWithPatient.Patient.User.email, {
              patientName: `${bookingWithPatient.Patient.User.firstName} ${bookingWithPatient.Patient.User.lastName}`,
              tx_ref,
              amount: pendingTransaction.amount,
              bookingId: pendingBooking.id
            });
            await bookingWithPatient.update({ notificationSent: true });
          }
        } catch (emailError) {
          logger.error('Failed to send payment failure notification:', emailError);
        }
      }

      return pendingTransaction;
    }

    await t.commit();
    return pendingTransaction;
  } catch (error) {
    await t.rollback();
    logger.error('Webhook processing failed:', error);
    throw error;
  }
};

/**
 * Update Caregiver Earnings (no locking — Paystack settles directly)
 */
const updateCaregiverEarnings = async (caregiverId, earnedAmount, transaction = null) => {
  try {
    const [earnings] = await CaregiverEarnings.findOrCreate({
      where: { caregiverId },
      defaults: { caregiverId, totalCaregiverEarnings: 0, walletBalance: 0 },
      transaction
    });

    await earnings.update({
      totalCaregiverEarnings: parseFloat(earnings.totalCaregiverEarnings) + parseFloat(earnedAmount),
      walletBalance: parseFloat(earnings.walletBalance) + parseFloat(earnedAmount)
    }, { transaction });

    logger.info(`Updated caregiver ${caregiverId} earnings: +${earnedAmount} KES`);
    return earnings;
  } catch (error) {
    logger.error('Failed to update caregiver earnings:', error);
    throw error;
  }
};

/**
 * Get Payment by Transaction Reference
 */
const getPaymentByTxRef = async (tx_ref) => {
  return PaymentTransaction.findOne({
    where: { paystackReference: tx_ref },
    include: [{ model: Appointment }]
  });
};

/**
 * Get All Payments for an Appointment
 */
const getAppointmentPayments = async (appointmentId) => {
  return PaymentTransaction.findAll({
    where: { appointmentId },
    order: [['createdAt', 'DESC']]
  });
};

module.exports = {
  initiateBookingPayment,
  verifyPayment,
  processWebhook,
  updateCaregiverEarnings,
  getPaymentByTxRef,
  getAppointmentPayments
};
