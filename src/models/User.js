const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const { USER_ROLES } = require('../utils/constants');

const User = sequelize.define('User', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    validate: { isEmail: true }
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false
  },
  firstName: {
    type: DataTypes.STRING,
    allowNull: false
  },
  lastName: {
    type: DataTypes.STRING,
    allowNull: false
  },
  phone: {
    type: DataTypes.STRING,
    allowNull: false
  },
  idNumber: {
    type: DataTypes.STRING,
    allowNull: true,
    unique: true
  },
  role_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'roles', key: 'id' }
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  resetPasswordToken: {
    type: DataTypes.STRING,
    allowNull: true
  },
  resetPasswordExpires: {
    type: DataTypes.DATE,
    allowNull: true
  },
  assignedRegion: {
    type: DataTypes.STRING,
    allowNull: true
  },
  profileImage: {
    type: DataTypes.STRING,
    allowNull: true
  }
}, {
  tableName: 'users'
});

module.exports = User;
