const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const { TIMESLOT_STATUS } = require('../utils/constants');

const TimeSlot = sequelize.define('TimeSlot', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  caregiverId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'caregivers', key: 'id' }
  },
  date: {
    type: DataTypes.DATEONLY,
    allowNull: false
  },
  startTime: {
    type: DataTypes.TIME,
    allowNull: false
  },
  endTime: {
    type: DataTypes.TIME,
    allowNull: false
  },
  duration: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 180,
    comment: 'Duration in minutes'
  },
  status: {
    type: DataTypes.ENUM,
    values: Object.values(TIMESLOT_STATUS),
    defaultValue: TIMESLOT_STATUS.AVAILABLE
  },
  lockedUntil: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'Slot locked until this time for payment processing'
  },
  isBooked: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  appointmentId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: { model: 'appointments', key: 'id' }
  },
  availabilityId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: { model: 'caregiver_availability', key: 'id' },
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
    comment: 'Links time slot to the availability that generated it'
  }
}, {
  tableName: 'time_slots',
  timestamps: true,
  indexes: [
    { unique: true, fields: ['caregiverId', 'date', 'startTime'] }
  ]
});

module.exports = TimeSlot;
