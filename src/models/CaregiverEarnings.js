const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const CaregiverEarnings = sequelize.define(
  "CaregiverEarnings",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    caregiverId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      unique: true,
      field: "caregiver_id",
      references: { model: "caregivers", key: "id" },
    },
    totalCaregiverEarnings: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0.0,
      field: "total_caregiver_earnings",
      comment: "Lifetime total earnings (only increases)",
    },
    walletBalance: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0.0,
      field: "wallet_balance",
      comment: "Current available balance for withdrawal",
    },
    lockedBalance: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0.0,
      field: "locked_balance",
      comment: "Earnings locked pending care report submission",
    },
    reservedBalance: {
      type: DataTypes.DECIMAL(14, 2),
      allowNull: false,
      defaultValue: 0,
      field: "reserved_balance",
      comment: "Funds reserved while payout is processing",
    },
    totalPaid: {
      type: DataTypes.DECIMAL(14, 2),
      allowNull: false,
      defaultValue: 0,
      field: "total_paid",
      comment: "Lifetime completed payouts",
    },
  },
  {
    tableName: "caregiver_earnings",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  },
);

module.exports = CaregiverEarnings;
