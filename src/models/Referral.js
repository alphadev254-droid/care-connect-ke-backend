const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Referral = sequelize.define('Referral', {
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
  referralCode: {
    type: DataTypes.STRING(10),
    allowNull: false,
    unique: true
  },
  patientId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: { model: 'patients', key: 'id' }
  },
  referredCaregiverId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: { model: 'caregivers', key: 'id' }
  },
  referralType: {
    type: DataTypes.ENUM('patient', 'caregiver'),
    allowNull: true
  },
  status: {
    type: DataTypes.ENUM('pending', 'converted', 'cancelled'),
    defaultValue: 'pending'
  },
  convertedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  expiresAt: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  tableName: 'referrals',
  timestamps: true,
  indexes: [
    { fields: ['caregiverId'] },
    { fields: ['referralCode'], unique: true },
    { fields: ['status'] },
    { fields: ['patientId'] }
  ]
});

module.exports = Referral;
