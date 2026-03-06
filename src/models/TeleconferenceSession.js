const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const TeleconferenceSession = sequelize.define('TeleconferenceSession', {
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
  roomId: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  startTime: {
    type: DataTypes.DATE
  },
  endTime: {
    type: DataTypes.DATE
  },
  recordingUrl: {
    type: DataTypes.STRING
  },
  transcription: {
    type: DataTypes.TEXT
  },
  chatHistory: {
    type: DataTypes.JSON
  }
}, {
  tableName: 'teleconferencesessions'
});

module.exports = TeleconferenceSession;