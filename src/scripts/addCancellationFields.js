const { Sequelize } = require('sequelize');
const sequelize = require('../config/database');

const addCancellationFields = async () => {
  try {
    console.log('🔄 Adding cancellation fields to appointments table...');

    // Check if columns exist first, then add if they don't
    const [results] = await sequelize.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'appointments' 
      AND COLUMN_NAME IN ('cancellation_reason', 'cancelled_at', 'cancelled_by')
    `);

    const existingColumns = results.map(row => row.COLUMN_NAME);

    // Add cancellation_reason if it doesn't exist
    if (!existingColumns.includes('cancellation_reason')) {
      await sequelize.query(`
        ALTER TABLE appointments 
        ADD COLUMN cancellation_reason TEXT NULL 
        COMMENT 'Reason for appointment cancellation'
      `);
      console.log('✅ Added cancellation_reason column');
    } else {
      console.log('ℹ️ cancellation_reason column already exists');
    }

    // Add cancelled_at if it doesn't exist
    if (!existingColumns.includes('cancelled_at')) {
      await sequelize.query(`
        ALTER TABLE appointments 
        ADD COLUMN cancelled_at DATETIME NULL 
        COMMENT 'Timestamp when appointment was cancelled'
      `);
      console.log('✅ Added cancelled_at column');
    } else {
      console.log('ℹ️ cancelled_at column already exists');
    }

    // Add cancelled_by if it doesn't exist
    if (!existingColumns.includes('cancelled_by')) {
      await sequelize.query(`
        ALTER TABLE appointments 
        ADD COLUMN cancelled_by ENUM('patient', 'system') NULL 
        COMMENT 'Who cancelled the appointment'
      `);
      console.log('✅ Added cancelled_by column');
    } else {
      console.log('ℹ️ cancelled_by column already exists');
    }

    console.log('✅ Successfully processed cancellation fields');

  } catch (error) {
    console.error('❌ Error adding cancellation fields:', error);
    throw error;
  }
};

// Run the migration if this file is executed directly
if (require.main === module) {
  addCancellationFields()
    .then(() => {
      console.log('🎉 Migration completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Migration failed:', error);
      process.exit(1);
    });
}

module.exports = addCancellationFields;