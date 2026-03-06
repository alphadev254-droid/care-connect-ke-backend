const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Location = sequelize.define('Location', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  region: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      notEmpty: true
    }
  },
  district: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      notEmpty: true
    }
  },
  traditionalAuthority: {
    type: DataTypes.STRING,
    allowNull: false,
    field: 'traditional_authority',
    validate: {
      notEmpty: true
    }
  },
  village: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      notEmpty: true
    }
  }
}, {
  tableName: 'locations',
  timestamps: true,
  indexes: [
    {
      fields: ['region']
    },
    {
      fields: ['district']
    },
    {
      fields: ['traditional_authority']
    },
    {
      fields: ['region', 'district']
    },
    {
      fields: ['district', 'traditional_authority']
    }
  ]
});

module.exports = Location;