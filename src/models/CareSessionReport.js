const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const { PATIENT_STATUS } = require('../utils/constants');

const CareSessionReport = sequelize.define('CareSessionReport', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  appointmentId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'appointments', key: 'id' }
  },
  observations: { type: DataTypes.TEXT, allowNull: true },
  interventions: { type: DataTypes.TEXT, allowNull: true },
  vitals: { type: DataTypes.JSON, defaultValue: {} },
  patientStatus: {
    type: DataTypes.ENUM,
    values: Object.values(PATIENT_STATUS),
    allowNull: true
  },
  sessionSummary: { type: DataTypes.TEXT, allowNull: true },
  recommendations: { type: DataTypes.TEXT, allowNull: true },
  followUpRequired: { type: DataTypes.BOOLEAN, defaultValue: false },
  followUpDate: { type: DataTypes.DATE, allowNull: true, field: 'follow_up_date' },
  attachments: { type: DataTypes.JSON, defaultValue: [] },
  medications: { type: DataTypes.TEXT, allowNull: true },
  activities: { type: DataTypes.TEXT, allowNull: true },
  notes: { type: DataTypes.TEXT, allowNull: true }
}, {
  tableName: 'caresessionreports'
});

module.exports = CareSessionReport;
