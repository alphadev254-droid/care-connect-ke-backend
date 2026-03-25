const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Notification = sequelize.define('Notification', {
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
  title: {
    type: DataTypes.STRING,
    allowNull: false
  },
  message: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  type: {
    type: DataTypes.ENUM('appointment', 'payment', 'verification', 'system', 'reminder'),
    allowNull: false,
    defaultValue: 'system'
  },
  isRead: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  priority: {
    type: DataTypes.ENUM('low', 'medium', 'high', 'urgent'),
    defaultValue: 'medium'
  },
  relatedId: {
    type: DataTypes.UUID,
    allowNull: true
  },
  relatedType: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  region: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  expiresAt: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  tableName: 'notifications',
  indexes: [
    { fields: ['userId', 'isRead'] },
    { fields: ['region'] },
    { fields: ['type'] },
    { fields: ['createdAt'] }
  ]
});

module.exports = Notification;
