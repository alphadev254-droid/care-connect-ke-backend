require('dotenv').config();
const db = require('../models');
const logger = require('../utils/logger');

async function initializeDatabase() {
  try {
    // Test database connection
    await db.sequelize.authenticate();
    logger.info('✅ Database connection established');
    
    // Drop and recreate all tables to fix key issues
    await db.sequelize.sync({ force: true });
    logger.info('✅ Database tables synchronized');
    
    console.log('Database initialization completed successfully!');
    process.exit(0);
  } catch (error) {
    logger.error('❌ Failed to initialize database:', error);
    process.exit(1);
  }
}

initializeDatabase();