const { sequelize } = require('../models');

const createEmailQueueTable = async () => {
  try {
    console.log('Creating EmailQueue table...');
    
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS EmailQueues (
        id INT AUTO_INCREMENT PRIMARY KEY,
        \`to\` VARCHAR(255) NOT NULL,
        subject VARCHAR(255) NOT NULL,
        template VARCHAR(255) NOT NULL,
        data JSON NOT NULL,
        status ENUM('pending', 'sent', 'failed') DEFAULT 'pending',
        attempts INT DEFAULT 0,
        error TEXT,
        scheduledAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        sentAt DATETIME,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    
    console.log('✅ EmailQueue table created successfully');
  } catch (error) {
    console.error('❌ Failed to create EmailQueue table:', error);
    throw error;
  }
};

// Run if called directly
if (require.main === module) {
  createEmailQueueTable()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = { createEmailQueueTable };