const sequelize = require('../config/database');

async function addJitsiFields() {
  try {
    console.log('Adding Jitsi fields to appointments table...');

    // Add jitsiRoomName field
    await sequelize.query(`
      ALTER TABLE appointments
      ADD COLUMN IF NOT EXISTS jitsi_room_name VARCHAR(255) NULL
      COMMENT 'Jitsi meeting room name for teleconference appointments'
    `);
    console.log('✓ Added jitsi_room_name field');

    // Add jitsiMeetingUrl field
    await sequelize.query(`
      ALTER TABLE appointments
      ADD COLUMN IF NOT EXISTS jitsi_meeting_url VARCHAR(500) NULL
      COMMENT 'Full Jitsi meeting URL for teleconference appointments'
    `);
    console.log('✓ Added jitsi_meeting_url field');

    // Add index on jitsiRoomName for faster lookups
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_appointments_jitsi_room
      ON appointments(jitsi_room_name)
    `);
    console.log('✓ Created index on jitsi_room_name');

    console.log('\n✅ Successfully added Jitsi fields to appointments table!');
    console.log('\nNext steps:');
    console.log('1. Restart your backend server');
    console.log('2. Test creating a teleconference appointment');
    console.log('3. Jitsi links will be automatically generated for new appointments\n');

  } catch (error) {
    console.error('❌ Error adding Jitsi fields:', error);
    throw error;
  } finally {
    await sequelize.close();
  }
}

// Run if called directly
if (require.main === module) {
  addJitsiFields()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = addJitsiFields;
