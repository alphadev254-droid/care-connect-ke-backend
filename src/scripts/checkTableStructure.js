const { sequelize } = require('../models');

async function checkTableStructure() {
  try {
    console.log('🔍 Checking caregiver_availability table structure...\n');

    const [results] = await sequelize.query('DESCRIBE caregiver_availability');
    
    console.log('Table structure:');
    console.table(results);

    const idColumn = results.find(col => col.Field === 'id');
    console.log('\n📌 ID column details:', idColumn);

    if (!idColumn.Extra.includes('auto_increment')) {
      console.log('\n❌ PROBLEM: id column is NOT auto_increment!');
      console.log('\n💡 Fix with this SQL:');
      console.log('ALTER TABLE caregiver_availability MODIFY id INT NOT NULL AUTO_INCREMENT;');
    } else {
      console.log('\n✅ ID column has auto_increment');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
  process.exit(0);
}

checkTableStructure();
