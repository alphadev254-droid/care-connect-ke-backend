const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const { VERIFICATION_STATUS } = require('../utils/constants');

const Caregiver = sequelize.define('Caregiver', {
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
  licensingInstitution: {
    type: DataTypes.STRING,
    allowNull: true
  },
  licenseNumber: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  experience: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  qualifications: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  verificationStatus: {
    type: DataTypes.ENUM,
    values: Object.values(VERIFICATION_STATUS),
    defaultValue: VERIFICATION_STATUS.PENDING
  },
  hourlyRate: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  availability: {
    type: DataTypes.JSON
  },
  bio: {
    type: DataTypes.TEXT
  },
  profileImage: {
    type: DataTypes.STRING
  },
  supportingDocuments: {
    type: DataTypes.JSON
  },
  idDocuments: {
    type: DataTypes.JSON,
    comment: 'ID documents uploaded during registration'
  },
  appointmentDuration: {
    type: DataTypes.INTEGER,
    defaultValue: parseInt(process.env.DEFAULT_APPOINTMENT_DURATION) || 180,
    comment: 'Default appointment duration in minutes'
  },
  autoConfirm: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    comment: 'Auto-confirm appointments after payment'
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
    type: DataTypes.JSON,
    allowNull: true,
    field: 'traditional_authority',
    comment: 'Array of Traditional Authorities the caregiver serves',
    get() {
      const value = this.getDataValue('traditionalAuthority');
      if (!value) return [];
      if (typeof value === 'string') {
        try {
          return JSON.parse(value);
        } catch {
          return [value]; // Convert legacy single value to array
        }
      }
      return Array.isArray(value) ? value : [value];
    }
  },
  village: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: 'Array of Villages the caregiver serves',
    get() {
      const value = this.getDataValue('village');
      if (!value) return [];
      if (typeof value === 'string') {
        try {
          return JSON.parse(value);
        } catch {
          return [value]; // Convert legacy single value to array
        }
      }
      return Array.isArray(value) ? value : [value];
    }
  },
  referralBoostScore: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: 'Boost score from successful referrals (1 point per converted referral)'
  },
  referralCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: 'Total number of converted referrals'
  }
}, {
  tableName: 'caregivers'
});

module.exports = Caregiver;