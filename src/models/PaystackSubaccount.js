const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const PaystackSubaccount = sequelize.define('PaystackSubaccount', {
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
  businessName: {
    type: DataTypes.STRING,
    allowNull: false,
    field: 'business_name'
  },
  settlementBank: {
    type: DataTypes.STRING,
    allowNull: false,
    field: 'settlement_bank'
  },
  accountNumber: {
    type: DataTypes.STRING,
    allowNull: false,
    field: 'account_number'
  },
  accountName: {
    type: DataTypes.STRING,
    allowNull: true,
    field: 'account_name'
  },
  subaccountCode: {
    type: DataTypes.STRING,
    allowNull: true,
    unique: true,
    field: 'subaccount_code'
  },
  percentageCharge: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: false,
    defaultValue: 78.00,
    field: 'percentage_charge'
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    field: 'is_active'
  },
  paystackResponse: {
    type: DataTypes.JSON,
    allowNull: true,
    field: 'paystack_response'
  }
}, {
  tableName: 'paystack_subaccounts',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

module.exports = PaystackSubaccount;
