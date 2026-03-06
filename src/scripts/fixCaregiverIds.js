const { Caregiver, User } = require('../models');

async function fixCaregiverIds() {
  try {
    console.log('🔍 Checking for caregivers with invalid IDs...\n');

    // Find all caregivers
    const caregivers = await Caregiver.findAll({
      include: [{ model: User, attributes: ['id', 'firstName', 'lastName', 'email'] }]
    });

    console.log(`Found ${caregivers.length} total caregivers\n`);

    let invalidCount = 0;
    for (const caregiver of caregivers) {
      console.log(`Caregiver ID: ${caregiver.id}, User ID: ${caregiver.userId}, Email: ${caregiver.User?.email}`);
      
      if (!caregiver.id || caregiver.id === 0) {
        invalidCount++;
        console.log(`❌ INVALID: Caregiver has id=${caregiver.id}`);
      }
    }

    console.log(`\n📊 Summary:`);
    console.log(`   Total caregivers: ${caregivers.length}`);
    console.log(`   Invalid IDs: ${invalidCount}`);

    if (invalidCount > 0) {
      console.log(`\n⚠️  You have ${invalidCount} caregiver(s) with invalid IDs!`);
      console.log(`   This is likely a database issue. The ID field should be AUTO_INCREMENT.`);
      console.log(`\n💡 To fix this, you need to:`);
      console.log(`   1. Check your MySQL database structure`);
      console.log(`   2. Ensure the 'caregivers' table 'id' column is AUTO_INCREMENT`);
      console.log(`   3. Delete invalid records and recreate them properly`);
    } else {
      console.log(`\n✅ All caregiver IDs are valid!`);
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
  process.exit(0);
}

fixCaregiverIds();
