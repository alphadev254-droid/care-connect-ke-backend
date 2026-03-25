const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const CaregiverRecommendation = sequelize.define('CaregiverRecommendation', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  physicianId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'primaryphysicians', key: 'id' }
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
