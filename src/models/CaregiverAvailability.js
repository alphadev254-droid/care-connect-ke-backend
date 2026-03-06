const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const CaregiverAvailability = sequelize.define('CaregiverAvailability', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  caregiverId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'Caregivers',
      key: 'id'
    }
  },
  dayOfWeek: {
    type: DataTypes.INTEGER,
    allowNull: false, // 0=Sunday, 1=Monday, ..., 6=Saturday
    validate: {
      min: 0,
      max: 6
    }
  },
  startTime: {
    type: DataTypes.TIME,
    allowNull: false
  },
  endTime: {
    type: DataTypes.TIME,
    allowNull: false
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  }
}, {
  tableName: 'caregiver_availability',
  timestamps: true
});

module.exports = CaregiverAvailability;