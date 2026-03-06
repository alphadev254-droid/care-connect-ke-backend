const { sequelize } = require('../models');

async function initializeDatabase() {
  try {
    console.log('🔄 Connecting to database...');
    await sequelize.authenticate();
    console.log('✅ Database connection established successfully.');

    console.log('🔄 Synchronizing database tables...');
    await sequelize.sync({ force: false, alter: true });
    console.log('✅ Database tables synchronized successfully.');

    console.log('🎉 Database initialization completed!');
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

if (require.main === module) {
  initializeDatabase();
}

module.exports = initializeDatabase;