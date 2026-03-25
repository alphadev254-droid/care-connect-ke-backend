const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const PendingBooking = sequelize.define('PendingBooking', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  timeSlotId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'time_slots', key: 'id' }
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
  locationId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: { model: 'locations', key: 'id' }
  },
  sessionType: {
    type: DataTypes.ENUM('in_person', 'teleconference'),
    allowNull: false,
    defaultValue: 'in_person'
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  tx_ref: {
    type: DataTypes.STRING,
    allowNull: true,
    unique: true
  },
  bookingFee: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  sessionFee: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  totalAmount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  status: {
    type: DataTypes.ENUM('pending', 'payment_initiated', 'payment_completed', 'payment_failed', 'expired', 'converted'),
    defaultValue: 'pending'
  },
  expiresAt: {
    type: DataTypes.DATE,
    allowNull: false
  },
  convertedToAppointmentId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: { model: 'appointments', key: 'id' }
  },
  notificationSent: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  }
}, {
  tableName: 'pending_bookings',
  timestamps: true,
  indexes: [
    { fields: ['status', 'expiresAt'], name: 'idx_pending_status_expires' },
    { fields: ['tx_ref'], name: 'idx_pending_tx_ref' },
    { fields: ['timeSlotId'], name: 'idx_pending_timeslot' },
    { fields: ['patientId'], name: 'idx_pending_patient' }
  ]
});

module.exports = PendingBooking;
