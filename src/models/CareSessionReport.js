const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const { PATIENT_STATUS } = require('../utils/constants');

const CareSessionReport = sequelize.define('CareSessionReport', {
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
  observations: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Caregiver observations during the session'
  },
  interventions: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Interventions performed during the session'
  },
  vitals: {
    type: DataTypes.JSON,
    defaultValue: {},
    comment: 'Patient vitals: { bloodPressure, heartRate, temperature, respiratoryRate, oxygenSaturation, bloodSugar }'
  },
  patientStatus: {
    type: DataTypes.ENUM,
    values: Object.values(PATIENT_STATUS),
    allowNull: true,
    comment: 'Overall patient status assessment'
  },
  sessionSummary: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'General summary of the care session'
  },
  recommendations: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Recommendations for patient care going forward'
  },
  followUpRequired: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: 'Whether follow-up session is required'
  },
  followUpDate: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'follow_up_date',
    comment: 'Recommended follow-up date if required'
  },
  attachments: {
    type: DataTypes.JSON,
    defaultValue: [],
    comment: 'Array of uploaded documents/files related to the session'
  },
  medications: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Medications prescribed or administered'
  },
  activities: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Activities performed with patient (exercises, therapy, etc.)'
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Additional notes from caregiver'
  }
}, {
  tableName: 'caresessionreports'
});

module.exports = CareSessionReport;