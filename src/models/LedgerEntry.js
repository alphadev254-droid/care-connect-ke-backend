const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

module.exports = sequelize.define(
  "LedgerEntry",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    ledgerTransactionId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: "ledger_transaction_id",
    },
    accountId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: "account_id",
    },
    direction: { type: DataTypes.ENUM("debit", "credit"), allowNull: false },
    amount: { type: DataTypes.DECIMAL(14, 2), allowNull: false },
    balanceBefore: {
      type: DataTypes.DECIMAL(14, 2),
      allowNull: false,
      field: "balance_before",
    },
    balanceAfter: {
      type: DataTypes.DECIMAL(14, 2),
      allowNull: false,
      field: "balance_after",
    },
    currency: {
      type: DataTypes.STRING(3),
      allowNull: false,
      defaultValue: "MWK",
    },
  },
  {
    tableName: "ledger_entries",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: false,
  },
);
