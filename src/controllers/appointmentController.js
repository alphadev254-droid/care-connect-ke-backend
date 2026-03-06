const { Appointment, Patient, Caregiver, User, Specialty, TimeSlot } = require('../models');
const { APPOINTMENT_STATUS, USER_ROLES, TIMESLOT_STATUS, PAYMENT_STATUS } = require('../utils/constants');
const { sendAppointmentConfirmation } = require('../services/emailService');
const NotificationHelper = require('../utils/notificationHelper');
const { getPrimaryFrontendUrl } = require('../utils/config');

/**
 * @deprecated This endpoint is deprecated and should not be used for new bookings
 * Use POST /api/payments/initiate-booking instead for race-condition-free booking
 *
 * This function creates appointments directly without payment integration and
 * doesn't use transaction-based slot locking, making it vulnerable to race conditions.
 *
 * The new flow:
 * 1. POST /api/payments/initiate-booking - Locks slot, creates pending booking, initiates payment
 * 2. Payment webhook automatically creates appointment on successful payment
 * 3. Automatic cleanup releases expired slots after 10 minutes
 */
const createAppointment = async (req, res, next) => {
  try {
    // Return deprecation warning
    return res.status(410).json({
      error: 'This endpoint is deprecated',
      message: 'Please use POST /api/payments/initiate-booking for creating new bookings',
      documentation: {
        newEndpoint: '/api/payments/initiate-booking',
        method: 'POST',
        requiredFields: ['timeSlotId', 'specialtyId'],
        optionalFields: ['sessionType', 'notes', 'phoneNumber', 'locationId'],
        description: 'Initiates booking with payment and automatic appointment creation on payment success'
      },
      reason: 'The new booking flow prevents race conditions and includes automatic cleanup of expired bookings'
    });

    /* LEGACY CODE - PRESERVED FOR REFERENCE
    const { timeSlotId, specialtyId, sessionType, notes } = req.body;

    // Get patient ID from authenticated user
    const patient = await Patient.findOne({ where: { userId: req.user.id } });
    if (!patient) {
      return res.status(403).json({ error: 'Only patients can create appointments' });
    }

    // Verify time slot is locked and available
    const timeSlot = await TimeSlot.findByPk(timeSlotId);
    if (!timeSlot || timeSlot.status !== TIMESLOT_STATUS.LOCKED) {
      return res.status(400).json({ error: 'Time slot not available or not locked' });
    }

    // Check if slot lock is still valid
    if (timeSlot.lockedUntil && new Date() > timeSlot.lockedUntil) {
      await timeSlot.update({ status: TIMESLOT_STATUS.AVAILABLE, lockedUntil: null });
      return res.status(400).json({ error: 'Time slot lock expired' });
    }

    // Get specialty to fetch booking and session fees
    const specialty = await Specialty.findByPk(specialtyId);
    if (!specialty) {
      return res.status(404).json({ error: 'Specialty not found' });
    }

    const bookingFee = specialty.bookingFee || 0;
    const sessionFee = specialty.sessionFee || 0;
    const totalCost = parseFloat(bookingFee) + parseFloat(sessionFee);

    const appointment = await Appointment.create({
      patientId: patient.id,
      caregiverId: timeSlot.caregiverId,
      specialtyId,
      scheduledDate: new Date(`${timeSlot.date} ${timeSlot.startTime}`),
      duration: timeSlot.duration,
      sessionType,
      notes,
      bookingFee,
      sessionFee,
      totalCost,
      timeSlotId,
      bookingFeeStatus: PAYMENT_STATUS.PENDING,
      sessionFeeStatus: PAYMENT_STATUS.PENDING,
      paymentStatus: PAYMENT_STATUS.PENDING,
      bookedAt: new Date()
    });

    // Mark time slot as booked
    await timeSlot.update({
      status: TIMESLOT_STATUS.BOOKED,
      isBooked: true,
      appointmentId: appointment.id,
      lockedUntil: null
    });

    res.status(201).json({
      appointment,
      timeSlot,
      fees: {
        bookingFee,
        sessionFee,
        totalCost
      }
    });
    */
  } catch (error) {
    next(error);
  }
};

const getAppointments = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = {};
    
    if (req.user.role === USER_ROLES.PATIENT) {
      const patient = await Patient.findOne({ where: { userId: req.user.id } });
      whereClause.patientId = patient.id;
    } else if (req.user.role === USER_ROLES.CAREGIVER) {
      const caregiver = await Caregiver.findOne({ where: { userId: req.user.id } });
      whereClause.caregiverId = caregiver.id;
      // Show appointments where at least booking fee is paid
      whereClause.bookingFeeStatus = PAYMENT_STATUS.COMPLETED;
    }

    if (status) {
      whereClause.status = status;
    }

    const appointments = await Appointment.findAndCountAll({
      where: whereClause,
      include: [
        { model: Patient, include: [{ model: User }] },
        { model: Caregiver, include: [{ model: User }] },
        { model: Specialty },
        { model: TimeSlot }
      ],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['scheduledDate', 'DESC']]
    });

    res.json({
      appointments: appointments.rows,
      total: appointments.count,
      page: parseInt(page),
      totalPages: Math.ceil(appointments.count / limit)
    });
  } catch (error) {
    next(error);
  }
};

const getAppointmentById = async (req, res, next) => {
  try {
    const appointment = await Appointment.findByPk(req.params.id, {
      include: [
        { model: Patient, include: [{ model: User }] },
        { model: Caregiver, include: [{ model: User }] },
        { model: Specialty },
        { model: TimeSlot }
      ]
    });

    if (!appointment) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    res.json({ appointment });
  } catch (error) {
    next(error);
  }
};

const updateAppointmentStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    const appointment = await Appointment.findByPk(req.params.id, {
      include: [{ model: TimeSlot }]
    });

    if (!appointment) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    appointment.status = status;
    await appointment.save();

    // Create notifications for appointment status change
    try {
      if (status === APPOINTMENT_STATUS.CONFIRMED) {
        await NotificationHelper.createAppointmentNotifications({
          id: appointment.id,
          caregiverId: appointment.caregiverId,
          patientId: appointment.patientId,
          date: new Date(appointment.scheduledDate).toLocaleDateString(),
          time: appointment.TimeSlot?.startTime || 'TBD'
        });
      }
    } catch (notificationError) {
      console.error('Failed to create appointment notifications:', notificationError);
    }

    // If cancelled, free up the time slot
    if (status === APPOINTMENT_STATUS.CANCELLED && appointment.TimeSlot) {
      await appointment.TimeSlot.update({
        status: TIMESLOT_STATUS.AVAILABLE,
        isBooked: false,
        appointmentId: null
      });
    }

    res.json({ appointment });
  } catch (error) {
    next(error);
  }
};

const confirmPayment = async (req, res, next) => {
  try {
    const { appointmentId, paymentType = 'booking_fee' } = req.body;

    const appointment = await Appointment.findByPk(appointmentId, {
      include: [{ model: Caregiver }, { model: TimeSlot }]
    });

    if (!appointment) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    // Update payment status based on payment type
    if (paymentType === 'booking_fee') {
      appointment.bookingFeeStatus = PAYMENT_STATUS.COMPLETED;
      appointment.bookedAt = new Date();

      // Auto-confirm if caregiver has auto-confirm enabled
      if (appointment.Caregiver.autoConfirm) {
        appointment.status = APPOINTMENT_STATUS.CONFIRMED;
      }
    } else if (paymentType === 'session_fee') {
      appointment.sessionFeeStatus = PAYMENT_STATUS.COMPLETED;
      appointment.sessionPaidAt = new Date();
    }

    // Update overall payment status
    if (appointment.bookingFeeStatus === PAYMENT_STATUS.COMPLETED &&
        appointment.sessionFeeStatus === PAYMENT_STATUS.COMPLETED) {
      appointment.paymentStatus = PAYMENT_STATUS.COMPLETED;
    }

    await appointment.save();

    res.json({ appointment });
  } catch (error) {
    next(error);
  }
};

const paySessionFee = async (req, res, next) => {
  try {
    const { appointmentId } = req.body;

    const appointment = await Appointment.findByPk(appointmentId);
    if (!appointment) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    // Check if booking fee was paid
    if (appointment.bookingFeeStatus !== PAYMENT_STATUS.COMPLETED) {
      return res.status(400).json({ error: 'Booking fee must be paid first' });
    }

    // Check if session fee is already paid
    if (appointment.sessionFeeStatus === PAYMENT_STATUS.COMPLETED) {
      return res.status(400).json({ error: 'Session fee already paid' });
    }

    // Update session fee status
    appointment.sessionFeeStatus = PAYMENT_STATUS.COMPLETED;
    appointment.sessionPaidAt = new Date();

    // Update overall payment status
    if (appointment.bookingFeeStatus === PAYMENT_STATUS.COMPLETED) {
      appointment.paymentStatus = PAYMENT_STATUS.COMPLETED;
    }

    await appointment.save();

    res.json({
      success: true,
      message: 'Session fee paid successfully',
      appointment
    });
  } catch (error) {
    next(error);
  }
};

const submitPatientFeedback = async (req, res, next) => {
  try {
    const { appointmentId, feedback, rating } = req.body;

    // Get patient from authenticated user
    const patient = await Patient.findOne({ where: { userId: req.user.id } });
    if (!patient) {
      return res.status(403).json({ error: 'Only patients can submit feedback' });
    }

    const appointment = await Appointment.findByPk(appointmentId);
    if (!appointment) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    // Verify this appointment belongs to the patient
    if (appointment.patientId !== patient.id) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Check if session fee was paid
    if (appointment.sessionFeeStatus !== PAYMENT_STATUS.COMPLETED) {
      return res.status(400).json({ error: 'Session fee must be paid before submitting feedback' });
    }

    // Update feedback
    appointment.patientFeedback = feedback;
    if (rating) {
      appointment.patientRating = rating;
    }

    await appointment.save();

    res.json({
      success: true,
      message: 'Feedback submitted successfully',
      appointment
    });
  } catch (error) {
    next(error);
  }
};

const markAppointmentCompleted = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Get caregiver from authenticated user
    const caregiver = await Caregiver.findOne({ where: { userId: req.user.id } });
    if (!caregiver) {
      return res.status(403).json({ error: 'Only caregivers can mark appointments as completed' });
    }

    const appointment = await Appointment.findByPk(id);
    if (!appointment) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    // Verify this appointment belongs to the caregiver
    if (appointment.caregiverId !== caregiver.id) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Check if session fee was paid
    if (appointment.sessionFeeStatus !== PAYMENT_STATUS.COMPLETED) {
      return res.status(400).json({ error: 'Session fee must be paid before marking as completed' });
    }

    // Mark as completed
    appointment.status = APPOINTMENT_STATUS.COMPLETED;
    await appointment.save();

    res.json({
      success: true,
      message: 'Appointment marked as completed',
      appointment
    });
  } catch (error) {
    next(error);
  }
};

const rescheduleAppointment = async (req, res, next) => {
  const transaction = await Appointment.sequelize.transaction();
  
  try {
    const { id } = req.params;
    const { newTimeSlotId, reason, rescheduleBy = 'patient' } = req.body;
    
    const cutoffHours = parseInt(process.env.RESCHEDULE_CUTOFF_HOURS) || 12;
    const maxReschedules = parseInt(process.env.MAX_RESCHEDULES_PER_APPOINTMENT) || 2;

    // Find appointment with related data
    const appointment = await Appointment.findByPk(id, {
      include: [
        { model: Patient, include: [{ model: User }] },
        { model: Caregiver, include: [{ model: User }] },
        { model: TimeSlot }
      ],
      transaction
    });

    if (!appointment) {
      await transaction.rollback();
      return res.status(404).json({ error: 'Appointment not found' });
    }

    // Verify user authorization
    let isAuthorized = false;
    if (req.user.role === 'patient') {
      const patient = await Patient.findOne({ where: { userId: req.user.id } });
      isAuthorized = patient && appointment.patientId === patient.id;
    } else if (req.user.role === 'caregiver') {
      const caregiver = await Caregiver.findOne({ where: { userId: req.user.id } });
      isAuthorized = caregiver && appointment.caregiverId === caregiver.id;
    }

    if (!isAuthorized) {
      await transaction.rollback();
      return res.status(403).json({ error: 'Not authorized to reschedule this appointment' });
    }

    // Validate appointment status
    if (appointment.status !== 'session_waiting') {
      await transaction.rollback();
      return res.status(400).json({ error: 'Only confirmed appointments can be rescheduled' });
    }

    // Check reschedule count limit
    if (appointment.rescheduleCount >= maxReschedules) {
      await transaction.rollback();
      return res.status(400).json({ 
        error: `Maximum reschedules exceeded (${maxReschedules} allowed)` 
      });
    }

    // Check time cutoff
    const hoursUntilAppointment = (new Date(appointment.scheduledDate) - new Date()) / (1000 * 60 * 60);
    if (hoursUntilAppointment < cutoffHours) {
      await transaction.rollback();
      return res.status(400).json({ 
        error: `Cannot reschedule within ${cutoffHours} hours of appointment` 
      });
    }

    // Verify new time slot
    const newTimeSlot = await TimeSlot.findByPk(newTimeSlotId, { transaction });
    if (!newTimeSlot) {
      await transaction.rollback();
      return res.status(404).json({ error: 'New time slot not found' });
    }

    if (newTimeSlot.caregiverId !== appointment.caregiverId) {
      await transaction.rollback();
      return res.status(400).json({ error: 'Can only reschedule to slots from the same caregiver' });
    }

    if (newTimeSlot.status !== 'available') {
      await transaction.rollback();
      return res.status(400).json({ error: 'New time slot is not available' });
    }

    // Check if new slot is in the future
    const newSlotDateTime = new Date(`${newTimeSlot.date} ${newTimeSlot.startTime}`);
    if (newSlotDateTime <= new Date()) {
      await transaction.rollback();
      return res.status(400).json({ error: 'Cannot reschedule to a past date/time' });
    }

    // Release old time slot
    if (appointment.TimeSlot) {
      await appointment.TimeSlot.update({
        status: 'available',
        isBooked: false,
        appointmentId: null
      }, { transaction });
    }

    // Book new time slot
    await newTimeSlot.update({
      status: 'booked',
      isBooked: true,
      appointmentId: appointment.id
    }, { transaction });

    // Update reschedule history
    const rescheduleHistory = appointment.rescheduleHistory || [];
    rescheduleHistory.push({
      from: {
        date: appointment.TimeSlot?.date,
        startTime: appointment.TimeSlot?.startTime,
        endTime: appointment.TimeSlot?.endTime
      },
      to: {
        date: newTimeSlot.date,
        startTime: newTimeSlot.startTime,
        endTime: newTimeSlot.endTime
      },
      rescheduleBy,
      reason,
      timestamp: new Date()
    });

    // Update appointment
    await appointment.update({
      timeSlotId: newTimeSlotId,
      scheduledDate: new Date(`${newTimeSlot.date} ${newTimeSlot.startTime}`),
      rescheduleCount: appointment.rescheduleCount + 1,
      lastRescheduledAt: new Date(),
      rescheduleHistory
    }, { transaction });

    await transaction.commit();

    // Send email notifications to both parties
    try {
      const emailService = require('../services/emailService');
      const patientEmail = appointment.Patient.User.email;
      const caregiverEmail = appointment.Caregiver.User.email;
      const newDateTime = `${new Date(newTimeSlot.date).toLocaleDateString()} at ${newTimeSlot.startTime}`;

      // Construct magic links for each participant
      const appUrl = getPrimaryFrontendUrl() || 'http://localhost:8080';
      const patientMeetingUrl = appointment.patientMeetingToken
        ? `${appUrl}/meeting/join/${appointment.patientMeetingToken}`
        : null;
      const caregiverMeetingUrl = appointment.caregiverMeetingToken
        ? `${appUrl}/meeting/join/${appointment.caregiverMeetingToken}`
        : null;

      // Send email to patient with their magic link
      await emailService.sendRescheduleNotification(
        patientEmail,
        appointment.Patient.User.firstName,
        rescheduleBy,
        rescheduleBy === 'patient' ? `${appointment.Patient.User.firstName} ${appointment.Patient.User.lastName}` : `${appointment.Caregiver.User.firstName} ${appointment.Caregiver.User.lastName}`,
        newDateTime,
        patientMeetingUrl
      );

      // Send email to caregiver with their magic link
      await emailService.sendRescheduleNotification(
        caregiverEmail,
        appointment.Caregiver.User.firstName,
        rescheduleBy,
        rescheduleBy === 'patient' ? `${appointment.Patient.User.firstName} ${appointment.Patient.User.lastName}` : `${appointment.Caregiver.User.firstName} ${appointment.Caregiver.User.lastName}`,
        newDateTime,
        caregiverMeetingUrl
      );
    } catch (emailError) {
      console.error('Failed to send reschedule notification:', emailError);
    }

    // Return updated appointment
    const updatedAppointment = await Appointment.findByPk(id, {
      include: [
        { model: Patient, include: [{ model: User }] },
        { model: Caregiver, include: [{ model: User }] },
        { model: Specialty },
        { model: TimeSlot }
      ]
    });

    res.json({
      success: true,
      message: 'Appointment rescheduled successfully',
      appointment: updatedAppointment
    });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};

const cancelAppointment = async (req, res, next) => {
  const transaction = await Appointment.sequelize.transaction();
  
  try {
    const { id } = req.params;
    const { reason } = req.body;
    
    const cutoffHours = parseInt(process.env.CANCELLATION_CUTOFF_HOURS) || 16;

    // Find appointment with related data
    const appointment = await Appointment.findByPk(id, {
      include: [
        { model: Patient, include: [{ model: User }] },
        { model: Caregiver, include: [{ model: User }] },
        { model: TimeSlot }
      ],
      transaction
    });

    if (!appointment) {
      await transaction.rollback();
      return res.status(404).json({ error: 'Appointment not found' });
    }

    // Only patients can cancel appointments
    const patient = await Patient.findOne({ where: { userId: req.user.id } });
    if (!patient || appointment.patientId !== patient.id) {
      await transaction.rollback();
      return res.status(403).json({ error: 'Only patients can cancel their own appointments' });
    }

    // Check if appointment is already cancelled
    if (appointment.status === 'cancelled') {
      await transaction.rollback();
      return res.status(400).json({ error: 'Appointment is already cancelled' });
    }

    // Check if appointment is completed
    if (appointment.status === 'completed') {
      await transaction.rollback();
      return res.status(400).json({ error: 'Cannot cancel completed appointments' });
    }

    // Check time cutoff (16 hours before appointment)
    const hoursUntilAppointment = (new Date(appointment.scheduledDate) - new Date()) / (1000 * 60 * 60);
    if (hoursUntilAppointment < cutoffHours) {
      await transaction.rollback();
      return res.status(400).json({ 
        error: `Cannot cancel within ${cutoffHours} hours of appointment` 
      });
    }

    // Release time slot
    if (appointment.TimeSlot) {
      await appointment.TimeSlot.update({
        status: 'available',
        isBooked: false,
        appointmentId: null
      }, { transaction });
    }

    // Update appointment
    await appointment.update({
      status: 'cancelled',
      cancellationReason: reason,
      cancelledAt: new Date(),
      cancelledBy: 'patient'
    }, { transaction });

    await transaction.commit();

    // Send email notifications
    try {
      const emailService = require('../services/emailService');
      const patientEmail = appointment.Patient.User.email;
      const caregiverEmail = appointment.Caregiver.User.email;
      const appointmentDateTime = `${new Date(appointment.scheduledDate).toLocaleDateString()} at ${appointment.TimeSlot?.startTime}`;
      
      // Send cancellation notification to both parties
      await emailService.sendCancellationNotification(
        patientEmail,
        appointment.Patient.User.firstName,
        appointmentDateTime,
        reason
      );
      
      await emailService.sendCancellationNotification(
        caregiverEmail,
        appointment.Caregiver.User.firstName,
        appointmentDateTime,
        reason
      );
    } catch (emailError) {
      console.error('Failed to send cancellation notification:', emailError);
    }

    // Return updated appointment
    const updatedAppointment = await Appointment.findByPk(id, {
      include: [
        { model: Patient, include: [{ model: User }] },
        { model: Caregiver, include: [{ model: User }] },
        { model: Specialty },
        { model: TimeSlot }
      ]
    });

    res.json({
      success: true,
      message: 'Appointment cancelled successfully',
      appointment: updatedAppointment
    });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};

const autoCleanupDueBookings = async (req, res, next) => {
  try {
    const cleanupHours = parseInt(process.env.AUTO_CLEANUP_DUE_HOURS) || 30;
    const cutoffTime = new Date(Date.now() - (cleanupHours * 60 * 60 * 1000));

    // Find appointments that are 30+ hours past their scheduled end time
    const dueAppointments = await Appointment.findAll({
      where: {
        status: ['scheduled', 'confirmed', 'session_waiting'],
        scheduledDate: {
          [require('sequelize').Op.lt]: cutoffTime
        }
      },
      include: [{ model: TimeSlot }]
    });

    let cleanedCount = 0;
    
    for (const appointment of dueAppointments) {
      const transaction = await Appointment.sequelize.transaction();
      
      try {
        // Release time slot
        if (appointment.TimeSlot) {
          await appointment.TimeSlot.update({
            status: 'available',
            isBooked: false,
            appointmentId: null
          }, { transaction });
        }

        // Cancel appointment
        await appointment.update({
          status: 'cancelled',
          cancellationReason: 'Automatically cancelled - appointment overdue',
          cancelledAt: new Date(),
          cancelledBy: 'system'
        }, { transaction });

        await transaction.commit();
        cleanedCount++;
      } catch (error) {
        await transaction.rollback();
        console.error(`Failed to cleanup appointment ${appointment.id}:`, error);
      }
    }

    res.json({
      success: true,
      message: `Cleaned up ${cleanedCount} overdue appointments`,
      cleanedCount,
      totalFound: dueAppointments.length
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get Jitsi meeting details for a teleconference appointment
 * GET /api/appointments/:id/jitsi
 */
const getJitsiMeetingDetails = async (req, res, next) => {
  try {
    const appointment = await Appointment.findByPk(req.params.id, {
      include: [
        { model: Patient, include: [{ model: User }] },
        { model: Caregiver, include: [{ model: User }] },
        { model: Specialty }
      ]
    });

    if (!appointment) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    // Check if appointment is a teleconference
    if (appointment.sessionType !== 'teleconference' && appointment.sessionType !== 'video') {
      return res.status(400).json({
        error: 'This appointment is not a teleconference session',
        sessionType: appointment.sessionType
      });
    }

    // Check if Jitsi link exists
    if (!appointment.jitsiRoomName || !appointment.jitsiMeetingUrl) {
      return res.status(404).json({
        error: 'Jitsi meeting link not found for this appointment',
        message: 'The meeting link may not have been generated yet'
      });
    }

    // Verify user has access to this appointment
    const { Caregiver: CaregiverModel } = require('../models');
    const userRole = req.user.role;

    if (userRole === USER_ROLES.PATIENT) {
      const patient = await Patient.findOne({ where: { userId: req.user.id } });
      if (appointment.patientId !== patient.id) {
        return res.status(403).json({ error: 'Access denied to this appointment' });
      }
    } else if (userRole === USER_ROLES.CAREGIVER) {
      const caregiver = await CaregiverModel.findOne({ where: { userId: req.user.id } });
      if (appointment.caregiverId !== caregiver.id) {
        return res.status(403).json({ error: 'Access denied to this appointment' });
      }
    }

    // Check if meeting is currently accessible
    const { canJoinMeeting } = require('../services/jitsiService');
    const accessCheck = canJoinMeeting(
      appointment.scheduledDate,
      appointment.duration || 60 // Default 60 minutes if not set
    );

    // Return Jitsi meeting details
    res.json({
      appointmentId: appointment.id,
      sessionType: appointment.sessionType,
      scheduledDate: appointment.scheduledDate,
      duration: appointment.duration,
      status: appointment.status,
      jitsi: {
        roomName: appointment.jitsiRoomName,
        meetingUrl: appointment.jitsiMeetingUrl,
        access: {
          canJoin: accessCheck.canJoin,
          status: accessCheck.status,
          message: accessCheck.message,
          availableAt: accessCheck.availableAt,
          expiresAt: accessCheck.expiresAt,
          timeUntilExpiry: accessCheck.timeUntilExpiry || null
        }
      },
      participants: {
        patient: {
          id: appointment.Patient.id,
          name: `${appointment.Patient.User.firstName} ${appointment.Patient.User.lastName}`,
          email: appointment.Patient.User.email
        },
        caregiver: {
          id: appointment.Caregiver.id,
          name: `${appointment.Caregiver.User.firstName} ${appointment.Caregiver.User.lastName}`,
          specialty: appointment.Specialty.name
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createAppointment,
  getAppointments,
  getAppointmentById,
  updateAppointmentStatus,
  confirmPayment,
  paySessionFee,
  submitPatientFeedback,
  markAppointmentCompleted,
  rescheduleAppointment,
  cancelAppointment,
  autoCleanupDueBookings,
  getJitsiMeetingDetails
};