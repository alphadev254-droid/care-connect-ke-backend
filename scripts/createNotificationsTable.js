const { sequelize } = require('../src/models');

async function createNotificationsTable() {
  try {
    console.log('Creating notifications table...');
    
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id INT PRIMARY KEY AUTO_INCREMENT,
        userId INT NOT NULL,
        title VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        type ENUM('appointment', 'payment', 'verification', 'system', 'reminder') NOT NULL DEFAULT 'system',
        isRead BOOLEAN DEFAULT FALSE,
        priority ENUM('low', 'medium', 'high', 'urgent') DEFAULT 'medium',
        relatedId INT NULL,
        relatedType VARCHAR(50) NULL,
        region VARCHAR(100) NULL,
        expiresAt TIMESTAMP NULL,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        
        INDEX idx_user_unread (userId, isRead),
        INDEX idx_region (region),
        INDEX idx_type (type),
        INDEX idx_created (createdAt),
        
        FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
    
    console.log('✅ Notifications table created successfully!');
    
    // Create some sample notifications
    console.log('Creating sample notifications...');
    
    await sequelize.query(`
      INSERT INTO notifications (userId, title, message, type, priority, isRead) VALUES
      (1, 'Welcome to CareConnect', 'Thank you for joining our healthcare platform!', 'system', 'medium', false),
      (1, 'Profile Setup Complete', 'Your profile has been set up successfully.', 'system', 'low', false),
      (2, 'New Feature Available', 'Check out our new teleconference feature!', 'system', 'medium', false)
    `);
    
    console.log('✅ Sample notifications created!');
    
  } catch (error) {
    console.error('❌ Error creating notifications table:', error);
  } finally {
    await sequelize.close();
  }
}

// Run the migration
createNotificationsTable();