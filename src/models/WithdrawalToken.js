const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const WithdrawalToken = sequelize.define('WithdrawalToken', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  caregiverId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'caregiver_id',
    references: { model: 'caregivers', key: 'id' }
  },
  token: {
    type: DataTypes.STRING(6),
    allowNull: false,
    comment: '6-digit withdrawal verification token'
  },
  expiresAt: {
    type: DataTypes.DATE,
    allowNull: false,
    field: 'expires_at',
    comment: 'Token expiry time (3 minutes from creation)'
  },
  used: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
    comment: 'Whether token has been used'
  }
}, {
  tableName: 'withdrawal_tokens',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  underscored: true
});

module.exports = WithdrawalToken;