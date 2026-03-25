const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const CaregiverEarnings = sequelize.define('CaregiverEarnings', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  caregiverId: {
    type: DataTypes.UUID,
    allowNull: false,
    unique: true,
    field: 'caregiver_id',
    references: { model: 'caregivers', key: 'id' }
  },
  totalCaregiverEarnings: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0.00,
    field: 'total_caregiver_earnings'
  },
  walletBalance: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0.00,
    field: 'wallet_balance'
  }
}, {
  tableName: 'caregiver_earnings',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

module.exports = CaregiverEarnings;
