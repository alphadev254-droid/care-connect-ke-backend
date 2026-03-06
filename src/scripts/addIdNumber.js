const { User } = require('../models');

const addIdNumberColumn = async () => {
  try {
    // Add the idNumber column to the users table
    await User.sequelize.query(`
      ALTER TABLE users 
      ADD COLUMN idNumber VARCHAR(255) UNIQUE AFTER phone
    `);
    
    console.log('✅ Successfully added idNumber column to users table');
  } catch (error) {
    if (error.message.includes('Duplicate column name')) {
      console.log('ℹ️ idNumber column already exists');
    } else {
      console.error('❌ Error adding idNumber column:', error.message);
    }
  }
};

// Run if called directly
if (require.main === module) {
  addIdNumberColumn()
    .then(() => process.exit(0))
    .catch(error => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = addIdNumberColumn;