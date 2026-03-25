const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Settlement = sequelize.define('Settlement', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  caregiverId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'caregiver_id',
    references: { model: 'caregivers', key: 'id' }
  },
  subaccountCode: {
    type: DataTypes.STRING,
    allowNull: false,
    field: 'subaccount_code'
  },
  paystackSettlementId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    unique: true,
    field: 'paystack_settlement_id'
  },
  amount: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false
  },
  totalFees: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: true,
    field: 'total_fees'
  },
  status: {
    type: DataTypes.ENUM('pending', 'processing', 'processed', 'failed'),
    defaultValue: 'pending'
  },
  settledAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'settled_at'
  },
  integration: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  metadata: {
    type: DataTypes.JSON,
    allowNull: true
  }
}, {
  tableName: 'settlements',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

module.exports = Settlement;
