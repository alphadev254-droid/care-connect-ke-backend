const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const CaregiverRecommendation = sequelize.define('CaregiverRecommendation', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  physicianId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'primaryphysicians', key: 'id' }
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
  reason: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  isAccepted: {
    type: DataTypes.BOOLEAN,
    defaultValue: null
  },
  acceptedAt: {
    type: DataTypes.DATE
  }
}, {
  tableName: 'caregiverrecommendations'
});

module.exports = CaregiverRecommendation;