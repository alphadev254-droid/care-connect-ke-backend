const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const WithdrawalToken = sequelize.define(
  "WithdrawalToken",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    caregiverId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: "caregiver_id",
      references: { model: "caregivers", key: "id" },
    },
    token: {
      type: DataTypes.STRING(64),
      allowNull: false,
      comment: "HMAC-SHA256 digest of the verification token",
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: false,
      field: "expires_at",
      comment: "Token expiry time (3 minutes from creation)",
    },
    used: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: "Whether token has been used",
    },
    attemptCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: "attempt_count",
    },
  },
  {
    tableName: "withdrawal_tokens",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    underscored: true,
  },
);

module.exports = WithdrawalToken;
