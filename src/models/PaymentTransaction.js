const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const { PAYMENT_STATUS } = require('../utils/constants');

const PaymentTransaction = sequelize.define('PaymentTransaction', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  appointmentId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'appointments', key: 'id' }
  },
  amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    comment: 'Total amount paid by patient (base + tax + convenience fee)'
  },
  baseFee: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    comment: 'Base fee before tax and convenience fee'
  },
  taxRate: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: true,
    comment: 'Tax rate percentage used (saved from ENV at transaction time)'
  },
  taxAmount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    comment: 'Tax amount charged'
  },
  convenienceFeeRate: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: true,
    comment: 'Convenience/processing fee rate percentage (saved from ENV)'
  },
  convenienceFeeAmount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    comment: 'Convenience/processing fee amount'
  },
  platformCommissionRate: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: true,
    comment: 'Platform commission rate percentage (saved from ENV)'
  },
  platformCommissionAmount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    comment: 'Platform commission amount (deducted from base fee)'
  },
  caregiverEarnings: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    comment: 'Amount payable to caregiver (baseFee - platformCommission)'
  },
  paymentType: {
    type: DataTypes.ENUM('booking_fee', 'session_fee'),
    allowNull: false,
    defaultValue: 'booking_fee',
    field: 'payment_type',
    comment: 'Type of payment: booking_fee or session_fee'
  },
  currency: {
    type: DataTypes.STRING,
    defaultValue: 'MWK'
  },
  paymentMethod: {
    type: DataTypes.STRING,
    allowNull: false
  },
  stripePaymentIntentId: {
    type: DataTypes.STRING
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
    type: DataTypes.JSON,
    comment: 'Additional payment metadata'
  }
}, {
  tableName: 'paymenttransactions'
});

module.exports = PaymentTransaction;