const { sequelize } = require('../models');

async function verifyAllTables() {
  try {
    console.log('🔍 Verifying all tables...\n');

    const [tables] = await sequelize.query('SHOW TABLES');
    const dbName = Object.keys(tables[0])[0];
    const tableNames = tables.map(t => t[dbName]);

    let allGood = true;
    let issueCount = 0;

    for (const tableName of tableNames) {
      const [cols] = await sequelize.query(`DESCRIBE ${tableName}`);
      const idCol = cols.find(c => c.Field === 'id');

      if (idCol) {
        const hasAuto = idCol.Extra.includes('auto_increment');
        const isPrimary = idCol.Key === 'PRI';

        if (!hasAuto || !isPrimary) {
          console.log(`❌ ${tableName}: PRIMARY=${isPrimary}, AUTO_INCREMENT=${hasAuto}`);
          allGood = false;
          issueCount++;
        } else {
          console.log(`✅ ${tableName}`);
        }
      }
    }

    console.log('\n' + '═'.repeat(50));
    if (allGood) {
      console.log('✅ ALL TABLES VERIFIED - Everything is properly configured!');
      console.log('🎉 Your database is now ready to use!');
    } else {
      console.log(`❌ Found ${issueCount} table(s) with issues`);
    }

  } catch (error) {
    console.error('Error:', error.message);
  }
  process.exit(0);
}

verifyAllTables();
