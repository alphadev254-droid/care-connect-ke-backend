const { TimeSlot, Appointment, Caregiver, PendingBooking, Specialty, sequelize } = require('../models');
const { TIMESLOT_STATUS, APPOINTMENT_STATUS, PAYMENT_STATUS } = require('../utils/constants');
const { Op } = require('sequelize');
const logger = require('../utils/logger');
const { generateJitsiMeeting } = require('./jitsiService');

class BookingService {
  async lockSlotForBooking(timeSlotId, lockDurationMinutes = 10) {
    const slot = await TimeSlot.findByPk(timeSlotId);
    
    if (!slot || slot.status !== TIMESLOT_STATUS.AVAILABLE) {
      throw new Error('Time slot not available');
    }

    const lockedUntil = new Date(Date.now() + lockDurationMinutes * 60000);
    
    await slot.update({
      status: TIMESLOT_STATUS.LOCKED,
      lockedUntil
    });

    return { slot, lockedUntil };
  }

  async createBookingWithPayment(bookingData) {
    const { timeSlotId, patientId, specialtyId, sessionType, notes } = bookingData;

    // Verify slot is locked
    const timeSlot = await TimeSlot.findByPk(timeSlotId);
    if (!timeSlot || timeSlot.status !== TIMESLOT_STATUS.LOCKED) {
      throw new Error('Time slot not locked or unavailable');
    }

    // Create appointment
    const appointment = await Appointment.create({
      patientId,
      caregiverId: timeSlot.caregiverId,
      specialtyId,
      scheduledDate: new Date(`${timeSlot.date} ${timeSlot.startTime}`),
      duration: timeSlot.duration,
      sessionType,
      notes,
      totalCost: timeSlot.price,
      timeSlotId,
      paymentStatus: PAYMENT_STATUS.PENDING,
      bookedAt: new Date()
    });

    // Generate Jitsi meeting link for all appointments
    const jitsiMeeting = generateJitsiMeeting(
      appointment.id,
      patientId,
      timeSlot.caregiverId
    );

    // Update appointment with Jitsi details and magic link tokens
    await appointment.update({
      jitsiRoomName: jitsiMeeting.roomName,
      jitsiMeetingUrl: jitsiMeeting.meetingUrl,
      patientMeetingToken: jitsiMeeting.patientToken,
      caregiverMeetingToken: jitsiMeeting.caregiverToken
    });

    logger.info('Jitsi meeting created for appointment', {
      appointmentId: appointment.id,
      sessionType: sessionType,
      roomName: jitsiMeeting.roomName,
      patientMeetingUrl: jitsiMeeting.patientMeetingUrl,
      caregiverMeetingUrl: jitsiMeeting.caregiverMeetingUrl
    });

    return appointment;
  }

  async confirmBookingPayment(appointmentId) {
    const appointment = await Appointment.findByPk(appointmentId, {
      include: [{ model: Caregiver }, { model: TimeSlot }]
    });

    if (!appointment) {
      throw new Error('Appointment not found');
    }

    // Update payment status
    appointment.paymentStatus = PAYMENT_STATUS.COMPLETED;
    
    // Auto-confirm if caregiver allows it
    if (appointment.Caregiver.autoConfirm) {
      appointment.status = APPOINTMENT_STATUS.CONFIRMED;
    }
    
    await appointment.save();

    // Mark time slot as booked
    await appointment.TimeSlot.update({
      status: TIMESLOT_STATUS.BOOKED,
      isBooked: true,
      appointmentId: appointment.id,
      lockedUntil: null
    });

    return appointment;
  }

  /**
   * Atomically lock slot and create pending booking with transaction
   * Prevents race conditions using SELECT FOR UPDATE
   */
  async lockSlotWithPendingBooking(bookingData, transaction = null) {
    const shouldCommit = !transaction;
    const t = transaction || await sequelize.transaction();

    try {
      const { timeSlotId, patientId, specialtyId, sessionType, notes, locationId } = bookingData;

      // Lock the time slot row to prevent concurrent bookings
      const timeSlot = await TimeSlot.findByPk(timeSlotId, {
        lock: t.LOCK.UPDATE,
        transaction: t
      });

      if (!timeSlot) {
        throw new Error('Time slot not found');
      }

      if (timeSlot.status !== TIMESLOT_STATUS.AVAILABLE) {
        // Check if slot is locked but not expired (allow proceeding if recently locked)
        if (timeSlot.status === TIMESLOT_STATUS.LOCKED && 
            timeSlot.lockedUntil && 
            new Date(timeSlot.lockedUntil) > new Date()) {
          console.log('Time slot is locked but not expired, proceeding with booking');
        } else {
          console.log('Time slot status check failed:', {
            timeSlotId,
            currentStatus: timeSlot.status,
            expectedStatus: TIMESLOT_STATUS.AVAILABLE,
            isBooked: timeSlot.isBooked,
            lockedUntil: timeSlot.lockedUntil
          });
          throw new Error(`Time slot not available (current status: ${timeSlot.status}, isBooked: ${timeSlot.isBooked})`);
        }
      }

      // Get specialty for fees
      const specialty = await Specialty.findByPk(specialtyId, { transaction: t });
      if (!specialty) {
        throw new Error('Specialty not found');
      }

      // Calculate expiry time (10 minutes from now)
      const lockedUntil = new Date(Date.now() + 10 * 60000);

      // Update time slot to LOCKED
      await timeSlot.update({
        status: TIMESLOT_STATUS.LOCKED,
        lockedUntil
      }, { transaction: t });

      // Create pending booking
      const pendingBooking = await PendingBooking.create({
        timeSlotId,
        patientId,
        caregiverId: timeSlot.caregiverId,
        specialtyId,
        locationId,
        sessionType,
        notes,
        bookingFee: specialty.bookingFee,
        sessionFee: specialty.sessionFee,
        totalAmount: parseFloat(specialty.bookingFee) + parseFloat(specialty.sessionFee),
        status: 'pending',
        expiresAt: lockedUntil
      }, { transaction: t });

      if (shouldCommit) {
        await t.commit();
      }

      logger.info('Slot locked with pending booking', {
        timeSlotId,
        pendingBookingId: pendingBooking.id,
        expiresAt: lockedUntil
      });

      return { timeSlot, pendingBooking, lockedUntil };

    } catch (error) {
      if (shouldCommit) {
        await t.rollback();
      }
      logger.error('Failed to lock slot with pending booking:', error);
      throw error;
    }
  }

  /**
   * Convert pending booking to appointment after successful payment
   */
  async convertPendingBookingToAppointment(pendingBookingId, tx_ref, transaction = null) {
    const shouldCommit = !transaction;
    const t = transaction || await sequelize.transaction();

    try {
      // Lock pending booking row
      const pendingBooking = await PendingBooking.findByPk(pendingBookingId, {
        lock: t.LOCK.UPDATE,
        transaction: t
      });

      if (!pendingBooking) {
        throw new Error('Pending booking not found');
      }

      if (pendingBooking.status === 'converted') {
        logger.warn(`Pending booking ${pendingBookingId} already converted`);
        const appointment = await Appointment.findByPk(pendingBooking.convertedToAppointmentId, { transaction: t });
        return { appointment, pendingBooking };
      }

      // Lock time slot
      const timeSlot = await TimeSlot.findByPk(pendingBooking.timeSlotId, {
        lock: t.LOCK.UPDATE,
        transaction: t
      });

      if (!timeSlot) {
        throw new Error('Time slot not found');
      }

      // Prepare appointment data
      const appointmentData = {
        patientId: pendingBooking.patientId,
        caregiverId: pendingBooking.caregiverId,
        specialtyId: pendingBooking.specialtyId,
        locationId: pendingBooking.locationId,
        scheduledDate: new Date(`${timeSlot.date} ${timeSlot.startTime}`),
        duration: timeSlot.duration,
        sessionType: pendingBooking.sessionType,
        notes: pendingBooking.notes,
        bookingFee: pendingBooking.bookingFee,
        sessionFee: pendingBooking.sessionFee,
        totalCost: pendingBooking.totalAmount,
        timeSlotId: pendingBooking.timeSlotId,
        status: APPOINTMENT_STATUS.SESSION_WAITING,
        bookingFeeStatus: PAYMENT_STATUS.COMPLETED,
        sessionFeeStatus: PAYMENT_STATUS.PENDING,
        paymentStatus: 'partial',
        bookedAt: new Date()
      };

      // Create appointment first to get the ID
      const appointment = await Appointment.create(appointmentData, { transaction: t });

      // Only generate Jitsi meeting link for teleconference appointments
      if (pendingBooking.sessionType === 'teleconference') {
        const jitsiMeeting = generateJitsiMeeting(
          appointment.id,
          pendingBooking.patientId,
          pendingBooking.caregiverId
        );

        // Update appointment with Jitsi details and magic link tokens
        await appointment.update({
          jitsiRoomName: jitsiMeeting.roomName,
          jitsiMeetingUrl: jitsiMeeting.meetingUrl,
          patientMeetingToken: jitsiMeeting.patientToken,
          caregiverMeetingToken: jitsiMeeting.caregiverToken
        }, { transaction: t });

        logger.info('Jitsi meeting created for teleconference appointment', {
          appointmentId: appointment.id,
          sessionType: pendingBooking.sessionType,
          roomName: jitsiMeeting.roomName,
          patientMeetingUrl: jitsiMeeting.patientMeetingUrl,
          caregiverMeetingUrl: jitsiMeeting.caregiverMeetingUrl
        });
      } else {
        logger.info('Skipping Jitsi meeting creation for in-person appointment', {
          appointmentId: appointment.id,
          sessionType: pendingBooking.sessionType
        });
      }

      // Update pending booking status
      await pendingBooking.update({
        status: 'converted',
        convertedToAppointmentId: appointment.id
      }, { transaction: t });

      // Update time slot to BOOKED
      await timeSlot.update({
        status: TIMESLOT_STATUS.BOOKED,
        isBooked: true,
        appointmentId: appointment.id,
        lockedUntil: null
      }, { transaction: t });

      if (shouldCommit) {
        await t.commit();
      }

      logger.info('Pending booking converted to appointment', {
        pendingBookingId,
        appointmentId: appointment.id,
        timeSlotId: timeSlot.id
      });

      return { appointment, pendingBooking };

    } catch (error) {
      if (shouldCommit) {
        await t.rollback();
      }
      logger.error('Failed to convert pending booking to appointment:', error);
      throw error;
    }
  }

  /**
   * Release pending booking and slot when payment fails or expires
   */
  async releasePendingBooking(pendingBookingId, reason = 'payment_failed', transaction = null) {
    const shouldCommit = !transaction;
    const t = transaction || await sequelize.transaction();

    try {
      // Lock pending booking
      const pendingBooking = await PendingBooking.findByPk(pendingBookingId, {
        lock: t.LOCK.UPDATE,
        transaction: t
      });

      if (!pendingBooking) {
        logger.warn(`Pending booking ${pendingBookingId} not found`);
        if (shouldCommit) await t.commit();
        return null;
      }

      // Lock time slot
      const timeSlot = await TimeSlot.findByPk(pendingBooking.timeSlotId, {
        lock: t.LOCK.UPDATE,
        transaction: t
      });

      // Update pending booking status
      await pendingBooking.update({
        status: reason === 'expired' ? 'expired' : 'payment_failed'
      }, { transaction: t });

      // Release time slot if still locked
      if (timeSlot && timeSlot.status === TIMESLOT_STATUS.LOCKED) {
        await timeSlot.update({
          status: TIMESLOT_STATUS.AVAILABLE,
          lockedUntil: null,
          isBooked: false
        }, { transaction: t });
      }

      if (shouldCommit) {
        await t.commit();
      }

      logger.info('Pending booking released', {
        pendingBookingId,
        timeSlotId: pendingBooking.timeSlotId,
        reason
      });

      return { pendingBooking, timeSlot };

    } catch (error) {
      if (shouldCommit) {
        await t.rollback();
      }
      logger.error('Failed to release pending booking:', error);
      throw error;
    }
  }

  /**
   * Enhanced cleanup - release expired locks and pending bookings
   */
  async releaseExpiredLocks() {
    const startTime = Date.now();
    let slotsReleased = 0;
    let pendingBookingsExpired = 0;
    const errors = [];

    try {
      // Find expired pending bookings
      const expiredPendingBookings = await PendingBooking.findAll({
        where: {
          status: { [Op.in]: ['pending', 'payment_initiated'] },
          expiresAt: { [Op.lt]: new Date() }
        },
        limit: 50 // Process in batches
      });

      // Release each expired pending booking
      for (const pendingBooking of expiredPendingBookings) {
        try {
          await this.releasePendingBooking(pendingBooking.id, 'expired');
          pendingBookingsExpired++;
          slotsReleased++;
        } catch (error) {
          logger.error(`Failed to release pending booking ${pendingBooking.id}:`, error);
          errors.push({ pendingBookingId: pendingBooking.id, error: error.message });
        }
      }

      // Also check for orphaned locked slots (backup cleanup)
      const orphanedSlots = await TimeSlot.findAll({
        where: {
          status: TIMESLOT_STATUS.LOCKED,
          lockedUntil: { [Op.lt]: new Date() }
        },
        limit: 50
      });

      for (const slot of orphanedSlots) {
        try {
          await slot.update({
            status: TIMESLOT_STATUS.AVAILABLE,
            lockedUntil: null
          });
          slotsReleased++;
        } catch (error) {
          logger.error(`Failed to release orphaned slot ${slot.id}:`, error);
          errors.push({ timeSlotId: slot.id, error: error.message });
        }
      }

      const duration = Date.now() - startTime;
      const result = {
        pendingBookingsExpired,
        slotsReleased,
        errors,
        duration
      };

      logger.info('Cleanup completed', result);
      return result;

    } catch (error) {
      logger.error('Cleanup job failed:', error);
      throw error;
    }
  }
}

module.exports = new BookingService();