const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const MeetingSettings = sequelize.define('MeetingSettings', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  defaultDuration: {
    type: DataTypes.INTEGER,
    defaultValue: 60,
    field: 'default_duration',
    comment: 'Default meeting duration in minutes'
  },
  allowEarlyJoin: {
    type: DataTypes.INTEGER,
    defaultValue: 15,
    field: 'allow_early_join',
    comment: 'Minutes before appointment to allow joining'
  },
  maxLateJoin: {
    type: DataTypes.INTEGER,
    defaultValue: 30,
    field: 'max_late_join',
    comment: 'Minutes after appointment end to allow joining'
  },
  maxMeetingDuration: {
    type: DataTypes.INTEGER,
    defaultValue: 180,
    field: 'max_meeting_duration',
    comment: 'Maximum meeting duration in minutes (3 hours)'
  },
  autoEndAfter: {
    type: DataTypes.INTEGER,
    defaultValue: 200,
    field: 'auto_end_after',
    comment: 'Auto-end meeting after this many minutes'
  },
  recordMeetings: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'record_meetings',
    comment: 'Enable meeting recording'
  },
  requireModerator: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    field: 'require_moderator',
    comment: 'Caregiver must join first'
  },
  enableChat: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    field: 'enable_chat',
    comment: 'Enable chat feature'
  },
  enableScreenShare: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    field: 'enable_screen_share',
    comment: 'Enable screen sharing'
  },
  enableRecording: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'enable_recording',
    comment: 'Enable recording button'
  },
  videoQuality: {
    type: DataTypes.ENUM('360p', '720p', '1080p'),
    defaultValue: '720p',
    field: 'video_quality',
    comment: 'Default video quality'
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    field: 'is_active',
    comment: 'Is this settings profile active'
  }
}, {
  tableName: 'meeting_settings',
  timestamps: true
});

module.exports = MeetingSettings;
