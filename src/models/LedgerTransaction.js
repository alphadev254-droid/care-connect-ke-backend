const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

module.exports = sequelize.define(
  "LedgerTransaction",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    eventType: {
      type: DataTypes.STRING(50),
      allowNull: false,
      field: "event_type",
    },
    referenceType: {
      type: DataTypes.STRING(50),
      allowNull: false,
      field: "reference_type",
    },
    referenceId: {
      type: DataTypes.STRING(191),
      allowNull: false,
      field: "reference_id",
    },
    idempotencyKey: {
      type: DataTypes.STRING(191),
      allowNull: false,
      unique: true,
      field: "idempotency_key",
    },
    currency: {
      type: DataTypes.STRING(3),
      allowNull: false,
      defaultValue: "MWK",
    },
    description: { type: DataTypes.STRING(255), allowNull: true },
    metadata: { type: DataTypes.JSON, allowNull: true },
  },
  {
    tableName: "ledger_transactions",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: false,
  },
);
