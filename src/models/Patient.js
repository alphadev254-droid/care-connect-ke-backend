const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Patient = sequelize.define('Patient', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'users', key: 'id' }
  },
  dateOfBirth: {
    type: DataTypes.DATE,
    allowNull: false
  },
  address: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  emergencyContact: {
    type: DataTypes.STRING,
    allowNull: false
  },
  medicalHistory: {
    type: DataTypes.TEXT
  },
  currentMedications: {
    type: DataTypes.TEXT
  },
  allergies: {
    type: DataTypes.TEXT
  },
  region: {
    type: DataTypes.STRING,
    allowNull: true
  },
  district: {
    type: DataTypes.STRING,
    allowNull: true
  },
  traditionalAuthority: {
    type: DataTypes.STRING,
    allowNull: true,
    field: 'traditional_authority'
  },
  village: {
    type: DataTypes.STRING,
    allowNull: true
  },
  patientType: {
    type: DataTypes.ENUM('adult', 'child', 'elderly'),
    defaultValue: 'adult',
    allowNull: false
  },
  guardianFirstName: {
    type: DataTypes.STRING,
    allowNull: true
  },
  guardianLastName: {
    type: DataTypes.STRING,
    allowNull: true
  },
  guardianPhone: {
    type: DataTypes.STRING,
    allowNull: true
  },
  guardianEmail: {
    type: DataTypes.STRING,
    allowNull: true
  },
  guardianRelationship: {
    type: DataTypes.STRING,
    allowNull: true
  },
  guardianIdNumber: {
    type: DataTypes.STRING,
    allowNull: true
  }
}, {
  tableName: 'patients'
});

module.exports = Patient;