const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const { ALERT_SEVERITY } = require('../utils/constants');

const StatusAlert = sequelize.define('StatusAlert', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  patientId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'patients', key: 'id' }
  },
  reportId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'caresessionreports', key: 'id' }
  },
  severity: {
    type: DataTypes.ENUM,
    values: Object.values(ALERT_SEVERITY),
    allowNull: false
  },
  message: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  isRead: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  readAt: {
    type: DataTypes.DATE
  }
}, {
  tableName: 'statusalerts'
});

module.exports = StatusAlert;