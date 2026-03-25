const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Location = sequelize.define('Location', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  region: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'County'
  },
  district: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'Constituency'
  },
  traditionalAuthority: {
    type: DataTypes.STRING,
    allowNull: false,
    field: 'traditional_authority',
    comment: 'Ward'
  },
  village: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'Ward (same as traditionalAuthority)'
  }
}, {
  tableName: 'locations',
  timestamps: true,
  indexes: [
    { fields: ['region'] },
    { fields: ['district'] },
    { fields: ['traditional_authority'] },
    { fields: ['region', 'district'] },
    { fields: ['district', 'traditional_authority'] }
  ]
});

module.exports = Location;
