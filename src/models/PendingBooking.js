const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const PendingBooking = sequelize.define('PendingBooking', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  timeSlotId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'time_slots',
      key: 'id'
    }
  },
  patientId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'patients',
      key: 'id'
    }
  },
  caregiverId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'caregivers',
      key: 'id'
    }
  },
  specialtyId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'specialties',
      key: 'id'
    }
  },
  locationId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'locations',
      key: 'id'
    }
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
  // Payment tracking
  tx_ref: {
    type: DataTypes.STRING,
    allowNull: true,
    unique: true,
    comment: 'Payment transaction reference from payment gateway'
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
  // Status tracking
  status: {
    type: DataTypes.ENUM('pending', 'payment_initiated', 'payment_completed', 'payment_failed', 'expired', 'converted'),
    defaultValue: 'pending',
    comment: 'Booking lifecycle status'
  },
  // Expiry management
  expiresAt: {
    type: DataTypes.DATE,
    allowNull: false,
    comment: 'When this pending booking expires (typically 10 minutes from creation)'
  },
  convertedToAppointmentId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'appointments',
      key: 'id'
    },
    comment: 'ID of appointment if this pending booking was converted'
  },
  notificationSent: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: 'Whether expiry/failure notification was sent to patient'
  }
}, {
  tableName: 'pending_bookings',
  timestamps: true,
  indexes: [
    {
      fields: ['status', 'expiresAt'],
      name: 'idx_pending_status_expires'
    },
    {
      fields: ['tx_ref'],
      name: 'idx_pending_tx_ref'
    },
    {
      fields: ['timeSlotId'],
      name: 'idx_pending_timeslot'
    },
    {
      fields: ['patientId'],
      name: 'idx_pending_patient'
    }
  ]
});

module.exports = PendingBooking;
