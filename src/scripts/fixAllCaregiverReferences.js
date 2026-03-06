const { sequelize } = require('../models');

async function fixAllCaregiverReferences() {
  try {
    console.log('🔍 Finding all tables with caregiver references...\n');

    // Check all tables that might reference caregivers
    const tablesToCheck = [
      'caregiverspecialties',
      'caregiver_availability', 
      'time_slots',
      'appointments',
      'caregiver_recommendations',
      'care_session_reports'
    ];

    for (const table of tablesToCheck) {
      console.log(`\n📋 Checking ${table}...`);
      
      try {
        // Check if table exists and has caregiverId column
        const [rows] = await sequelize.query(`
          SELECT * FROM ${table} WHERE caregiverId = 0 OR CaregiverId = 0
        `);

        if (rows.length > 0) {
          console.log(`   ⚠️  Found ${rows.length} row(s) with caregiverId = 0`);
          console.log(`   Updating to caregiverId = 1...`);
          
          // Update caregiverId from 0 to 1
          await sequelize.query(`
            UPDATE ${table} SET caregiverId = 1 WHERE caregiverId = 0
          `);
          
          // Also try CaregiverId (capitalized)
          await sequelize.query(`
            UPDATE ${table} SET CaregiverId = 1 WHERE CaregiverId = 0
          `);
          
          console.log(`   ✅ Updated ${table}`);
        } else {
          console.log(`   ✅ No records with caregiverId = 0`);
        }
      } catch (error) {
        if (error.message.includes("doesn't exist") || error.message.includes("Unknown column")) {
          console.log(`   ℹ️  Table doesn't exist or no caregiverId column - skipping`);
        } else {
          console.log(`   ❌ Error: ${error.message}`);
        }
      }
    }

    console.log('\n\n📊 Summary - Checking all references...');
    
    // Verify all are updated
    for (const table of tablesToCheck) {
      try {
        const [rows] = await sequelize.query(`
          SELECT COUNT(*) as count FROM ${table} 
          WHERE caregiverId = 0 OR CaregiverId = 0
        `);
        
        if (rows[0].count > 0) {
          console.log(`   ❌ ${table}: Still has ${rows[0].count} records with caregiverId = 0`);
        } else {
          const [totalRows] = await sequelize.query(`
            SELECT COUNT(*) as count FROM ${table} 
            WHERE caregiverId = 1 OR CaregiverId = 1
          `);
          console.log(`   ✅ ${table}: ${totalRows[0].count} records with caregiverId = 1`);
        }
      } catch (error) {
        // Skip if table doesn't exist
      }
    }

    console.log('\n✨ All caregiver references updated!');

  } catch (error) {
    console.error('❌ Error:', error);
  }
  process.exit(0);
}

fixAllCaregiverReferences();
