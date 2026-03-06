const sequelize = require('../config/database');

async function addLocationFields() {
  try {
    console.log('Adding location fields to Patient and Caregiver tables...');
    
    // Add location fields to patients table
    await sequelize.query(`
      ALTER TABLE patients 
      ADD COLUMN region VARCHAR(255),
      ADD COLUMN district VARCHAR(255),
      ADD COLUMN traditional_authority VARCHAR(255),
      ADD COLUMN village VARCHAR(255)
    `);
    
    console.log('Added location fields to patients table');
    
    // Add location fields to caregivers table
    await sequelize.query(`
      ALTER TABLE caregivers 
      ADD COLUMN region VARCHAR(255),
      ADD COLUMN district VARCHAR(255),
      ADD COLUMN traditional_authority VARCHAR(255),
      ADD COLUMN village VARCHAR(255)
    `);
    
    console.log('Added location fields to caregivers table');
    console.log('Location fields migration completed successfully!');
    
  } catch (error) {
    console.error('Error adding location fields:', error);
    throw error;
  } finally {
    await sequelize.close();
  }
}

if (require.main === module) {
  addLocationFields()
    .then(() => {
      console.log('Migration completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}

module.exports = addLocationFields;