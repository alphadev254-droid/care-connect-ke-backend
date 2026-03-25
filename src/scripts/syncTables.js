require('dotenv').config({ path: require('path').join(__dirname, '../../../.env') });
const db = require('../models');

const args = process.argv.slice(2);
const mode = args[0];

async function syncTables() {
  try {
    await db.sequelize.authenticate();
    console.log('✅ Database connected');

    if (mode === '--alter') {
      // Fix invalid JSON in traditional_authority before altering
      console.log('🔧 Fixing invalid JSON in traditional_authority...');
      await db.sequelize.query(`
        UPDATE caregivers 
        SET traditional_authority = NULL 
        WHERE traditional_authority IS NOT NULL 
        AND traditional_authority NOT REGEXP '^[\\[{"0-9]'
      `);
      console.log('✅ Invalid JSON cleaned');
    }

    if (mode === '--force') {
      // Drops and recreates ALL tables (destroys data!)
      console.log('⚠️  Force syncing — all tables will be dropped and recreated...');
      await db.sequelize.query('SET FOREIGN_KEY_CHECKS = 0');
      await db.sequelize.sync({ force: true });
      await db.sequelize.query('SET FOREIGN_KEY_CHECKS = 1');
      console.log('✅ All tables recreated');
    } else if (mode === '--alter') {
      // Adds new columns/tables without dropping data
      console.log('🔄 Alter syncing — adding missing tables and columns...');
      await db.sequelize.sync({ alter: true });
      console.log('✅ Tables altered');
    } else {
      // Only creates tables that don't exist
      console.log('➕ Syncing — creating missing tables only...');
      await db.sequelize.sync();
      console.log('✅ Missing tables created');
    }
  } catch (error) {
    console.error('❌ Sync failed:', error.message);
  } finally {
    await db.sequelize.close();
  }
}

syncTables();
