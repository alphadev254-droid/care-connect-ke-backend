const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const { APPOINTMENT_STATUS, SESSION_TYPE, PAYMENT_STATUS } = require('../utils/constants');

const Appointment = sequelize.define('Appointment', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  patientId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'patients', key: 'id' }
  },
  caregiverId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'caregivers', key: 'id' }
  },
  specialtyId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'specialties', key: 'id' }
  },
  scheduledDate: {
    type: DataTypes.DATE,
    allowNull: false
  },
  duration: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  sessionType: {
    type: DataTypes.ENUM,
    values: Object.values(SESSION_TYPE),
    allowNull: false
  },
  status: {
    type: DataTypes.ENUM,
    values: Object.values(APPOINTMENT_STATUS),
    defaultValue: APPOINTMENT_STATUS.PENDING
  },
  notes: {
    type: DataTypes.TEXT
  },
  bookingFee: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    comment: 'Booking fee amount for this appointment'
  },
  sessionFee: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    comment: 'Session fee amount for this appointment'
  },
  totalCost: {
    type: DataTypes.DECIMAL(10, 2)
  },
  timeSlotId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'time_slots',
      key: 'id'
    }
  },
  bookingFeeStatus: {
    type: DataTypes.ENUM,
    values: Object.values(PAYMENT_STATUS),
    defaultValue: PAYMENT_STATUS.PENDING,
    field: 'booking_fee_status',
    comment: 'Payment status for booking fee'
  },
  sessionFeeStatus: {
    type: DataTypes.ENUM,
    values: Object.values(PAYMENT_STATUS),
    defaultValue: PAYMENT_STATUS.PENDING,
    field: 'session_fee_status',
    comment: 'Payment status for session fee'
  },
  paymentStatus: {
    type: DataTypes.ENUM,
    values: Object.values(PAYMENT_STATUS),
    defaultValue: PAYMENT_STATUS.PENDING,
    comment: 'Overall payment status (deprecated - use bookingFeeStatus and sessionFeeStatus)'
  },
  bookedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  sessionPaidAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'session_paid_at',
    comment: 'Timestamp when session fee was paid'
  },
  patientFeedback: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'patient_feedback',
    comment: 'Patient feedback/comment for this session (admin-only visibility)'
  },
  patientRating: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'patient_rating',
    validate: {
      min: 1,
      max: 5
    },
    comment: 'Patient rating for this session (1-5 stars)'
  },
  rescheduleCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    field: 'reschedule_count',
    comment: 'Number of times this appointment has been rescheduled'
  },
  lastRescheduledAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'last_rescheduled_at',
    comment: 'Timestamp of last reschedule'
  },
  rescheduleHistory: {
    type: DataTypes.JSON,
    allowNull: true,
    field: 'reschedule_history',
    comment: 'History of reschedules with timestamps and reasons'
  },
  cancellationReason: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'cancellation_reason',
    comment: 'Reason for appointment cancellation'
  },
  cancelledAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'cancelled_at',
    comment: 'Timestamp when appointment was cancelled'
  },
  cancelledBy: {
    type: DataTypes.ENUM('patient', 'system'),
    allowNull: true,
    field: 'cancelled_by',
    comment: 'Who cancelled the appointment'
  },
  jitsiRoomName: {
    type: DataTypes.STRING(255),
    allowNull: true,
    field: 'jitsi_room_name',
    comment: 'Jitsi meeting room name for teleconference appointments'
  },
  jitsiMeetingUrl: {
    type: DataTypes.STRING(500),
    allowNull: true,
    field: 'jitsi_meeting_url',
    comment: 'Full Jitsi meeting URL for teleconference appointments'
  },
  patientMeetingToken: {
    type: DataTypes.STRING(64),
    allowNull: true,
    field: 'patient_meeting_token',
    comment: 'Unique token for patient to join meeting'
  },
  caregiverMeetingToken: {
    type: DataTypes.STRING(64),
    allowNull: true,
    field: 'caregiver_meeting_token',
    comment: 'Unique token for caregiver to join meeting'
  }
}, {
  tableName: 'appointments'
});

module.exports = Appointment;