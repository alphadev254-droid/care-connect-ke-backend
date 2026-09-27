const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const TABLE_NAME = 'caresessionreports';

const columns = [
  ['actual_check_in', { type: DataTypes.DATE, allowNull: true }],
  ['actual_check_out', { type: DataTypes.DATE, allowNull: true }],
  ['session_status', { type: DataTypes.STRING, allowNull: true }],
  ['session_status_reason', { type: DataTypes.STRING, allowNull: true }],
  ['care_provided', { type: DataTypes.JSON, allowNull: true }],
  ['session_outcome', { type: DataTypes.STRING, allowNull: true }],
  ['incomplete_reason', { type: DataTypes.JSON, allowNull: true }],
  ['additional_assistance', { type: DataTypes.STRING, allowNull: true }],
  ['safety_incident', { type: DataTypes.STRING, allowNull: true }],
  ['follow_up_actions', { type: DataTypes.JSON, allowNull: true }],
  ['caregiver_confirmed', { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false }]
];

const getExistingColumns = async () => {
  const [existing] = await sequelize.query(`DESCRIBE \`${TABLE_NAME}\``);
  return new Set(existing.map((column) => column.Field));
};

const run = async () => {
  const queryInterface = sequelize.getQueryInterface();
  const existingColumns = await getExistingColumns();

  for (const [name, definition] of columns) {
    if (existingColumns.has(name)) {
      console.log(`Skipping ${name}; already exists`);
      continue;
    }

    await queryInterface.addColumn(TABLE_NAME, name, definition);
    console.log(`Added ${name}`);
  }

  console.log('Operational care report fields are ready');
};

run()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Failed to add operational care report fields:', error);
    process.exit(1);
  });
