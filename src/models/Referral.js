const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Referral = sequelize.define('Referral', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  caregiverId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'caregivers', key: 'id' },
    comment: 'The caregiver who created this referral'
  },
  referralCode: {
    type: DataTypes.STRING(10),
    allowNull: false,
    unique: true,
    comment: 'Unique referral code (e.g., CARE7X9K2L)'
  },
  patientId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: { model: 'patients', key: 'id' },
    comment: 'The patient who used this referral code (null until conversion)'
  },
  referredCaregiverId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: { model: 'caregivers', key: 'id' },
    comment: 'The caregiver who used this referral code (null until conversion)'
  },
  referralType: {
    type: DataTypes.ENUM('patient', 'caregiver'),
    allowNull: true,
    comment: 'Type of referral: patient or caregiver'
  },
  status: {
    type: DataTypes.ENUM('pending', 'converted', 'cancelled'),
    defaultValue: 'pending',
    comment: 'pending: link shared, converted: patient/caregiver registered, cancelled: account deleted'
  },
  convertedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'When the referral converted (patient completed registration)'
  },
  expiresAt: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'Optional expiration date for referral codes'
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
