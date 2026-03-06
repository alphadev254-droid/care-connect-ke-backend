const { sequelize } = require('../models');

async function syncDatabase() {
  try {
    console.log('Syncing database models...');
    await sequelize.sync({ alter: true });
    console.log('✅ Database models synced successfully');
    process.exit(0);
  } catch (error) {
    console.error('❌ Database sync failed:', error);
    process.exit(1);
  }
}

syncDatabase();