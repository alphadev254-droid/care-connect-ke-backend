const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const MeetingSettings = sequelize.define('MeetingSettings', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  defaultDuration: { type: DataTypes.INTEGER, defaultValue: 60, field: 'default_duration' },
  allowEarlyJoin: { type: DataTypes.INTEGER, defaultValue: 15, field: 'allow_early_join' },
  maxLateJoin: { type: DataTypes.INTEGER, defaultValue: 30, field: 'max_late_join' },
  maxMeetingDuration: { type: DataTypes.INTEGER, defaultValue: 180, field: 'max_meeting_duration' },
  autoEndAfter: { type: DataTypes.INTEGER, defaultValue: 200, field: 'auto_end_after' },
  recordMeetings: { type: DataTypes.BOOLEAN, defaultValue: false, field: 'record_meetings' },
  requireModerator: { type: DataTypes.BOOLEAN, defaultValue: true, field: 'require_moderator' },
  enableChat: { type: DataTypes.BOOLEAN, defaultValue: true, field: 'enable_chat' },
  enableScreenShare: { type: DataTypes.BOOLEAN, defaultValue: true, field: 'enable_screen_share' },
  enableRecording: { type: DataTypes.BOOLEAN, defaultValue: false, field: 'enable_recording' },
  videoQuality: { type: DataTypes.ENUM('360p', '720p', '1080p'), defaultValue: '720p', field: 'video_quality' },
  isActive: { type: DataTypes.BOOLEAN, defaultValue: true, field: 'is_active' }
}, {
  tableName: 'meeting_settings',
  timestamps: true
});

module.exports = MeetingSettings;
