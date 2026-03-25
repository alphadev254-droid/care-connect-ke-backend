const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const CaregiverAvailability = sequelize.define('CaregiverAvailability', {
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
  dayOfWeek: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: { min: 0, max: 6 }
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
