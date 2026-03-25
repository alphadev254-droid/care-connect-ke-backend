const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const { PAYMENT_STATUS } = require('../utils/constants');

const PaymentTransaction = sequelize.define('PaymentTransaction', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  appointmentId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'appointments', key: 'id' }
  },
  amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  baseFee: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true
  },
  convenienceFeeRate: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: true
  },
  convenienceFeeAmount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true
  },
  platformCommissionRate: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: true
  },
  platformCommissionAmount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true
  },
  caregiverEarnings: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true
  },
  paymentType: {
    type: DataTypes.ENUM('booking_fee', 'session_fee'),
    allowNull: false,
    defaultValue: 'booking_fee',
    field: 'payment_type'
  },
  currency: {
    type: DataTypes.STRING,
    defaultValue: 'KES'
  },
  paymentMethod: {
    type: DataTypes.STRING,
    allowNull: false
  },
  paystackReference: {
    type: DataTypes.STRING,
    field: 'paystack_reference'
  },
  subaccountCode: {
    type: DataTypes.STRING,
    allowNull: true,
    field: 'subaccount_code'
  },
  transactionCharge: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    field: 'transaction_charge'
  },
  channel: {
    type: DataTypes.STRING,
    allowNull: true
  },
  status: {
    type: DataTypes.ENUM,
    values: Object.values(PAYMENT_STATUS),
    defaultValue: PAYMENT_STATUS.PENDING
  },
  paidAt: {
    type: DataTypes.DATE
  },
  refundedAt: {
    type: DataTypes.DATE
  },
  metadata: {
    type: DataTypes.JSON
  }
}, {
  tableName: 'paymenttransactions'
});

module.exports = PaymentTransaction;
