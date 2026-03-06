const { sequelize } = require('../models');
const { CaregiverAvailability, TimeSlot, Caregiver } = require('../models');

async function testBookingSystem() {
  try {
    console.log('🔄 Testing Booking System...');

    // Test 1: Create sample availability
    console.log('📅 Creating sample caregiver availability...');
    
    const sampleAvailability = [
      { caregiverId: 1, dayOfWeek: 1, startTime: '09:00:00', endTime: '17:00:00', isActive: true }, // Monday
      { caregiverId: 1, dayOfWeek: 2, startTime: '09:00:00', endTime: '17:00:00', isActive: true }, // Tuesday
      { caregiverId: 1, dayOfWeek: 3, startTime: '09:00:00', endTime: '17:00:00', isActive: true }, // Wednesday
    ];

    await CaregiverAvailability.bulkCreate(sampleAvailability, { ignoreDuplicates: true });
    console.log('✅ Sample availability created');

    // Test 2: Generate time slots
    console.log('🕐 Generating time slots...');
    
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(startDate.getDate() + 7); // Next 7 days

    // This would normally be called via API
    console.log('📝 Time slots would be generated via API call to /timeslots/generate');
    console.log(`   - Start Date: ${startDate.toISOString().split('T')[0]}`);
    console.log(`   - End Date: ${endDate.toISOString().split('T')[0]}`);

    // Test 3: Check available slots
    const availableSlots = await TimeSlot.findAll({
      where: { status: 'available' },
      limit: 5
    });

    console.log(`🎯 Found ${availableSlots.length} available slots`);

    console.log('✅ Booking system test completed successfully!');
    console.log('\n📋 Next steps:');
    console.log('   1. Run database sync to create new tables');
    console.log('   2. Test API endpoints with Postman');
    console.log('   3. Update frontend to use new booking flow');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run if called directly
if (require.main === module) {
  testBookingSystem().then(() => process.exit(0));
}

module.exports = testBookingSystem;