const { sequelize } = require('../models');

async function fixAllTables() {
  try {
    console.log('🔍 Checking and fixing ALL tables...\n');

    // Get all tables
    const [tables] = await sequelize.query("SHOW TABLES");
    const dbName = Object.keys(tables[0])[0];
    const tableNames = tables.map(t => t[dbName]);

    console.log(`Found ${tableNames.length} tables\n`);

    const fixed = [];
    const alreadyOk = [];
    const noIdColumn = [];

    for (const tableName of tableNames) {
      try {
        // Get table structure
        const [columns] = await sequelize.query(`DESCRIBE ${tableName}`);

        // Find id column
        const idColumn = columns.find(col => col.Field === 'id');

        if (!idColumn) {
          noIdColumn.push(tableName);
          console.log(`⚠️  ${tableName} - No 'id' column, skipping`);
          continue;
        }

        const hasAutoIncrement = idColumn.Extra.includes('auto_increment');
        const isPrimaryKey = idColumn.Key === 'PRI';

        if (!hasAutoIncrement || !isPrimaryKey) {
          console.log(`\n🔧 Fixing ${tableName}...`);
          console.log(`   Current state: PRIMARY=${isPrimaryKey}, AUTO_INCREMENT=${hasAutoIncrement}`);

          try {
            // Try to fix
            await sequelize.query(
              `ALTER TABLE ${tableName} MODIFY id INT NOT NULL AUTO_INCREMENT PRIMARY KEY`
            );

            // Verify fix
            const [updatedColumns] = await sequelize.query(`DESCRIBE ${tableName}`);
            const updatedIdColumn = updatedColumns.find(col => col.Field === 'id');

            if (updatedIdColumn.Extra.includes('auto_increment') && updatedIdColumn.Key === 'PRI') {
              console.log(`   ✅ Fixed successfully!`);
              fixed.push(tableName);
            } else {
              console.log(`   ⚠️  Fix may not have worked completely`);
            }
          } catch (error) {
            if (error.message.includes('Multiple primary key')) {
              console.log(`   ⚠️  Table already has a different primary key structure`);
            } else {
              console.log(`   ❌ Error: ${error.message}`);
            }
          }
        } else {
          console.log(`✅ ${tableName} - Already OK`);
          alreadyOk.push(tableName);
        }
      } catch (error) {
        console.log(`❌ ${tableName} - Error: ${error.message}`);
      }
    }

    console.log('\n\n📊 SUMMARY:');
    console.log('═══════════════════════════════════════\n');
    console.log(`✅ Already OK: ${alreadyOk.length} tables`);
    if (alreadyOk.length > 0) {
      alreadyOk.forEach(t => console.log(`   - ${t}`));
    }

    console.log(`\n🔧 Fixed: ${fixed.length} tables`);
    if (fixed.length > 0) {
      fixed.forEach(t => console.log(`   - ${t}`));
    }

    console.log(`\n⚠️  No 'id' column: ${noIdColumn.length} tables`);
    if (noIdColumn.length > 0) {
      noIdColumn.forEach(t => console.log(`   - ${t}`));
    }

    console.log('\n✨ All tables processed!');

  } catch (error) {
    console.error('❌ Fatal Error:', error);
  }
  process.exit(0);
}

fixAllTables();
