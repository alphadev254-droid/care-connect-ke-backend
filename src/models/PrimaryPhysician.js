const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const { VERIFICATION_STATUS } = require('../utils/constants');

const PrimaryPhysician = sequelize.define('PrimaryPhysician', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'users', key: 'id' }
  },
  medicalLicenseNumber: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  specialization: {
    type: DataTypes.STRING,
    allowNull: false
  },
  hospitalAffiliation: {
    type: DataTypes.STRING
  },
  verificationStatus: {
    type: DataTypes.ENUM,
    values: Object.values(VERIFICATION_STATUS),
    defaultValue: VERIFICATION_STATUS.PENDING
  }
}, {
  tableName: 'primaryphysicians'
});

module.exports = PrimaryPhysician;
