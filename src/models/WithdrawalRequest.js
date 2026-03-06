const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const WithdrawalRequest = sequelize.define('WithdrawalRequest', {
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
  requestedAmount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    field: 'requested_amount',
    comment: 'Amount caregiver requested to withdraw'
  },
  withdrawalFee: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0.00,
    field: 'withdrawal_fee',
    comment: 'Transaction fee deducted from withdrawal'
  },
  netPayout: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    field: 'net_payout',
    comment: 'Actual amount sent to caregiver (requested_amount - withdrawal_fee)'
  },
  recipientType: {
    type: DataTypes.ENUM('mobile_money', 'bank'),
    allowNull: false,
    defaultValue: 'mobile_money',
    field: 'recipient_type'
  },
  recipientNumber: {
    type: DataTypes.STRING(50),
    allowNull: true,
    field: 'recipient_number',
    comment: 'Phone number or bank account number'
  },
  status: {
    type: DataTypes.ENUM('pending', 'processing', 'completed', 'failed'),
    allowNull: false,
    defaultValue: 'pending'
  },
  payoutReference: {
    type: DataTypes.STRING(255),
    allowNull: true,
    unique: true,
    field: 'payout_reference',
    comment: 'PayChangu payout transaction reference'
  },
  paychanguResponse: {
    type: DataTypes.JSON,
    allowNull: true,
    field: 'paychangu_response',
    comment: 'Store PayChangu API response for debugging'
  },
  failureReason: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'failure_reason',
    comment: 'Reason for withdrawal failure'
  },
  requestedAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
    field: 'requested_at'
  },
  processedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'processed_at'
  }
}, {
  tableName: 'withdrawal_requests',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

module.exports = WithdrawalRequest;