const { sequelize } = require('../models');

async function fixAvailabilityTable() {
  try {
    console.log('🔧 Fixing caregiver_availability table...\n');

    // First, add primary key and auto_increment
    console.log('1️⃣ Adding PRIMARY KEY and AUTO_INCREMENT to id column...');
    await sequelize.query(
      'ALTER TABLE caregiver_availability MODIFY id INT NOT NULL AUTO_INCREMENT PRIMARY KEY'
    );
    console.log('✅ Primary key and auto_increment added\n');

    // Verify the fix
    console.log('2️⃣ Verifying the fix...');
    const [results] = await sequelize.query('DESCRIBE caregiver_availability');
    const idColumn = results.find(col => col.Field === 'id');
    
    console.log('ID column after fix:', idColumn);

    if (idColumn.Extra.includes('auto_increment') && idColumn.Key === 'PRI') {
      console.log('\n✅ SUCCESS! Table is now properly configured.');
      console.log('   - id is PRIMARY KEY');
      console.log('   - id has AUTO_INCREMENT');
      console.log('\n🎉 You can now try saving availability again!');
    } else {
      console.log('\n⚠️  Something went wrong. Please check manually.');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.message.includes('Multiple primary key')) {
      console.log('\n⚠️  Table already has a primary key.');
      console.log('💡 Try this instead:');
      console.log('   ALTER TABLE caregiver_availability MODIFY id INT NOT NULL AUTO_INCREMENT;');
    }
  }
  process.exit(0);
}

fixAvailabilityTable();
