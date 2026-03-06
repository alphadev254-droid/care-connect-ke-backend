const { sequelize } = require('../models');
const { 
  TimeSlot, 
  CaregiverAvailability, 
  Appointment, 
  Caregiver 
} = require('../models');

async function migrateBookingSystem() {
  try {
    console.log('🔄 Starting Booking System Migration...');

    // Step 1: Update Caregiver table first (no foreign keys)
    console.log('🔧 Updating Caregiver table...');
    await Caregiver.sync({ alter: true });
    console.log('✅ Caregiver table updated with new columns');

    // Step 2: Create new tables
    console.log('📊 Creating new tables...');
    
    await CaregiverAvailability.sync({ alter: true });
    console.log('✅ CaregiverAvailability table created/updated');
    
    await TimeSlot.sync({ alter: true });
    console.log('✅ TimeSlot table created/updated');

    // Step 3: Update Appointment table (after TimeSlot exists)
    console.log('🔧 Updating Appointment table...');
    await Appointment.sync({ alter: true });
    console.log('✅ Appointment table updated with new columns');

    // Step 3: Create sample data for testing
    console.log('📝 Creating sample data...');
    
    // Check if caregiver exists
    const caregiver = await Caregiver.findByPk(1);
    if (caregiver) {
      // Update caregiver with default values
      await caregiver.update({
        appointmentDuration: 60,
        autoConfirm: true
      });
      console.log('✅ Updated caregiver with default booking settings');

      // Create sample availability
      const sampleAvailability = [
        { caregiverId: 1, dayOfWeek: 1, startTime: '09:00:00', endTime: '17:00:00', isActive: true },
        { caregiverId: 1, dayOfWeek: 2, startTime: '09:00:00', endTime: '17:00:00', isActive: true },
        { caregiverId: 1, dayOfWeek: 3, startTime: '09:00:00', endTime: '17:00:00', isActive: true },
        { caregiverId: 1, dayOfWeek: 4, startTime: '09:00:00', endTime: '17:00:00', isActive: true },
        { caregiverId: 1, dayOfWeek: 5, startTime: '09:00:00', endTime: '17:00:00', isActive: true }
      ];

      await CaregiverAvailability.bulkCreate(sampleAvailability, { 
        ignoreDuplicates: true 
      });
      console.log('✅ Sample availability created');

      // Generate sample time slots for next 7 days
      const slots = [];
      const today = new Date();
      
      for (let i = 0; i < 7; i++) {
        const date = new Date(today);
        date.setDate(today.getDate() + i);
        const dayOfWeek = date.getDay();
        
        // Only create slots for weekdays (1-5)
        if (dayOfWeek >= 1 && dayOfWeek <= 5) {
          for (let hour = 9; hour < 17; hour++) {
            slots.push({
              caregiverId: 1,
              date: date.toISOString().split('T')[0],
              startTime: `${hour.toString().padStart(2, '0')}:00:00`,
              endTime: `${(hour + 1).toString().padStart(2, '0')}:00:00`,
              duration: 60,
              price: 75000,
              status: 'available',
              isBooked: false
            });
          }
        }
      }

      await TimeSlot.bulkCreate(slots, { ignoreDuplicates: true });
      console.log(`✅ Created ${slots.length} sample time slots`);
    } else {
      console.log('⚠️  No caregiver found with ID 1, skipping sample data creation');
    }

    console.log('✅ Booking System Migration completed successfully!');
    console.log('\n📋 What was created:');
    console.log('   ✓ CaregiverAvailability table');
    console.log('   ✓ TimeSlot table');
    console.log('   ✓ Updated Caregiver table (appointmentDuration, autoConfirm)');
    console.log('   ✓ Updated Appointment table (timeSlotId, paymentStatus, bookedAt)');
    console.log('   ✓ Sample availability and time slots');
    
    console.log('\n🚀 Ready to test:');
    console.log('   • GET /timeslots/available - View available slots');
    console.log('   • POST /availability - Set caregiver availability');
    console.log('   • POST /timeslots/generate - Generate new slots');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error(error);
  }
}

// Run if called directly
if (require.main === module) {
  migrateBookingSystem()
    .then(() => {
      console.log('🎉 Migration complete!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Migration failed:', error);
      process.exit(1);
    });
}

module.exports = migrateBookingSystem;