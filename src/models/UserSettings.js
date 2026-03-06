const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const UserSettings = sequelize.define('UserSettings', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    notifications: {
      type: DataTypes.TEXT('long'),
      defaultValue: JSON.stringify({
        email: true,
        sms: true,
        push: true,
        appointments: true,
        reminders: true,
        marketing: false
      }),
      get() {
        const value = this.getDataValue('notifications');
        try {
          return value ? JSON.parse(value) : {
            email: true,
            sms: true,
            push: true,
            appointments: true,
            reminders: true,
            marketing: false
          };
        } catch (e) {
          return {
            email: true,
            sms: true,
            push: true,
            appointments: true,
            reminders: true,
            marketing: false
          };
        }
      },
      set(value) {
        this.setDataValue('notifications', JSON.stringify(value));
      }
    },
    privacy: {
      type: DataTypes.TEXT('long'),
      defaultValue: JSON.stringify({
        profileVisibility: 'private',
        dataSharing: false,
        analytics: true
      }),
      get() {
        const value = this.getDataValue('privacy');
        try {
          return value ? JSON.parse(value) : {
            profileVisibility: 'private',
            dataSharing: false,
            analytics: true
          };
        } catch (e) {
          return {
            profileVisibility: 'private',
            dataSharing: false,
            analytics: true
          };
        }
      },
      set(value) {
        this.setDataValue('privacy', JSON.stringify(value));
      }
    },
    preferences: {
      type: DataTypes.TEXT('long'),
      defaultValue: JSON.stringify({
        language: 'en',
        timezone: 'Africa/Blantyre',
        theme: 'system',
        soundEnabled: true
      }),
      get() {
        const value = this.getDataValue('preferences');
        try {
          return value ? JSON.parse(value) : {
            language: 'en',
            timezone: 'Africa/Blantyre',
            theme: 'system',
            soundEnabled: true
          };
        } catch (e) {
          return {
            language: 'en',
            timezone: 'Africa/Blantyre',
            theme: 'system',
            soundEnabled: true
          };
        }
      },
      set(value) {
        this.setDataValue('preferences', JSON.stringify(value));
      }
    }
}, {
  tableName: 'user_settings',
  timestamps: true
});

module.exports = UserSettings;