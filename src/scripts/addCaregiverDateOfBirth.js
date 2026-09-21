require('dotenv').config();
const sequelize = require('../config/database');

const TABLE_NAME = 'caregivers';
const COLUMN_NAME = 'dateOfBirth';

async function columnExists() {
  const [columns] = await sequelize.query(
    `
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
        AND COLUMN_NAME = ?
      LIMIT 1
    `,
    { replacements: [TABLE_NAME, COLUMN_NAME] }
  );

  return columns.length > 0;
}

async function run() {
  try {
    await sequelize.authenticate();

    if (await columnExists()) {
      console.log(`No change needed: ${TABLE_NAME}.${COLUMN_NAME} already exists.`);
      return;
    }

    await sequelize.query(`
      ALTER TABLE \`${TABLE_NAME}\`
      ADD COLUMN \`${COLUMN_NAME}\` DATE NULL AFTER \`experience\`
    `);

    console.log(`Migration complete: added ${TABLE_NAME}.${COLUMN_NAME}.`);
  } catch (error) {
    console.error('Migration failed:', error.message);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
}

run();
