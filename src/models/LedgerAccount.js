const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

module.exports = sequelize.define(
  "LedgerAccount",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    accountKey: {
      type: DataTypes.STRING(191),
      allowNull: false,
      unique: true,
      field: "account_key",
    },
    caregiverId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: "caregiver_id",
      references: { model: "caregivers", key: "id" },
    },
    accountType: {
      type: DataTypes.ENUM(
        "caregiver_locked",
        "caregiver_available",
        "caregiver_reserved",
        "paychangu_clearing",
        "withdrawal_fee_revenue",
        "migration_opening",
      ),
      allowNull: false,
      field: "account_type",
    },
    currency: {
      type: DataTypes.STRING(3),
      allowNull: false,
      defaultValue: "MWK",
    },
    currentBalance: {
      type: DataTypes.DECIMAL(14, 2),
      allowNull: false,
      defaultValue: 0,
      field: "current_balance",
    },
  },
  {
    tableName: "ledger_accounts",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  },
);
