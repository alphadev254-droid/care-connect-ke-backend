const { sequelize } = require('../models');

async function checkAllTablesAutoIncrement() {
  try {
    console.log('🔍 Checking all tables for AUTO_INCREMENT issues...\n');

    // Get all tables
    const [tables] = await sequelize.query("SHOW TABLES");
    const tableNames = Object.values(tables[0]);

    const issues = [];

    for (const tableName of tableNames) {
      // Get table structure
      const [columns] = await sequelize.query(`DESCRIBE ${tableName}`);

      // Find id column
      const idColumn = columns.find(col => col.Field === 'id');

      if (idColumn) {
        const hasAutoIncrement = idColumn.Extra.includes('auto_increment');
        const isPrimaryKey = idColumn.Key === 'PRI';

        if (!hasAutoIncrement || !isPrimaryKey) {
          issues.push({
            table: tableName,
            hasAutoIncrement,
            isPrimaryKey,
            column: idColumn
          });

          console.log(`❌ ${tableName}:`);
          console.log(`   - PRIMARY KEY: ${isPrimaryKey ? '✅' : '❌'}`);
          console.log(`   - AUTO_INCREMENT: ${hasAutoIncrement ? '✅' : '❌'}`);
        } else {
          console.log(`✅ ${tableName} - OK`);
        }
      }
    }

    if (issues.length > 0) {
      console.log(`\n\n⚠️  Found ${issues.length} table(s) with issues:\n`);

      for (const issue of issues) {
        console.log(`\n📋 ${issue.table}:`);
        console.log(`   SQL to fix:`);
        console.log(`   ALTER TABLE ${issue.table} MODIFY id INT NOT NULL AUTO_INCREMENT PRIMARY KEY;`);
      }
    } else {
      console.log('\n\n✅ All tables have proper AUTO_INCREMENT configuration!');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
  process.exit(0);
}

checkAllTablesAutoIncrement();
