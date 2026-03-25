const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const { APPOINTMENT_STATUS, SESSION_TYPE, PAYMENT_STATUS } = require('../utils/constants');

const Appointment = sequelize.define('Appointment', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  patientId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'patients', key: 'id' }
  },
  caregiverId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'caregivers', key: 'id' }
  },
  specialtyId: {
    type: DataTypes.UUID,
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
    allowNull: false
  },
  sessionFee: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  totalCost: {
    type: DataTypes.DECIMAL(10, 2)
  },
  timeSlotId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: { model: 'time_slots', key: 'id' }
  },
  bookingFeeStatus: {
    type: DataTypes.ENUM,
    values: Object.values(PAYMENT_STATUS),
    defaultValue: PAYMENT_STATUS.PENDING,
    field: 'booking_fee_status'
  },
  sessionFeeStatus: {
    type: DataTypes.ENUM,
    values: Object.values(PAYMENT_STATUS),
    defaultValue: PAYMENT_STATUS.PENDING,
    field: 'session_fee_status'
  },
  paymentStatus: {
    type: DataTypes.ENUM,
    values: Object.values(PAYMENT_STATUS),
    defaultValue: PAYMENT_STATUS.PENDING
  },
  bookedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  sessionPaidAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'session_paid_at'
  },
  patientFeedback: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'patient_feedback'
  },
  patientRating: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'patient_rating',
    validate: { min: 1, max: 5 }
  },
  rescheduleCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    field: 'reschedule_count'
  },
  lastRescheduledAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'last_rescheduled_at'
  },
  rescheduleHistory: {
    type: DataTypes.JSON,
    allowNull: true,
    field: 'reschedule_history'
  },
  cancellationReason: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'cancellation_reason'
  },
  cancelledAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'cancelled_at'
  },
  cancelledBy: {
    type: DataTypes.ENUM('patient', 'system'),
    allowNull: true,
    field: 'cancelled_by'
  },
  jitsiRoomName: {
    type: DataTypes.STRING(255),
    allowNull: true,
    field: 'jitsi_room_name'
  },
  jitsiMeetingUrl: {
    type: DataTypes.STRING(500),
    allowNull: true,
    field: 'jitsi_meeting_url'
  },
  patientMeetingToken: {
    type: DataTypes.STRING(64),
    allowNull: true,
    field: 'patient_meeting_token'
  },
  caregiverMeetingToken: {
    type: DataTypes.STRING(64),
    allowNull: true,
    field: 'caregiver_meeting_token'
  }
}, {
  tableName: 'appointments'
});

module.exports = Appointment;
