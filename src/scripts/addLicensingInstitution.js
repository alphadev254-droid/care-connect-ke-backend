const { Caregiver } = require('../models');

const addLicensingInstitutionColumn = async () => {
  try {
    // Add the licensingInstitution column to the caregivers table
    await Caregiver.sequelize.query(`
      ALTER TABLE caregivers 
      ADD COLUMN licensingInstitution VARCHAR(255) AFTER userId
    `);
    
    console.log('✅ Successfully added licensingInstitution column to caregivers table');
  } catch (error) {
    if (error.message.includes('Duplicate column name')) {
      console.log('ℹ️ licensingInstitution column already exists');
    } else {
      console.error('❌ Error adding licensingInstitution column:', error.message);
    }
  }
};

// Run if called directly
if (require.main === module) {
  addLicensingInstitutionColumn()
    .then(() => process.exit(0))
    .catch(error => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = addLicensingInstitutionColumn;