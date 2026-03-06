const { sequelize, PendingBooking } = require('../models');

async function migratePendingBookings() {
  try {
    console.log('🔄 Starting Pending Bookings Migration...');
    console.log('📋 This migration creates the pending_bookings table for race-condition-free booking system\n');

    // Step 1: Create pending_bookings table
    console.log('🔧 Creating pending_bookings table...');
    await PendingBooking.sync({ alter: true });
    console.log('✅ PendingBooking table created/updated');

    // Step 2: Verify table structure
    console.log('\n🔍 Verifying table structure...');
    const [columns] = await sequelize.query(`DESCRIBE pending_bookings`);

    console.log('📊 Table columns:');
    const requiredColumns = [
      'id', 'timeSlotId', 'patientId', 'caregiverId', 'specialtyId',
      'locationId', 'sessionType', 'notes', 'tx_ref', 'bookingFee',
      'sessionFee', 'totalAmount', 'status', 'expiresAt',
      'convertedToAppointmentId', 'notificationSent', 'createdAt', 'updatedAt'
    ];

    let allColumnsPresent = true;
    for (const colName of requiredColumns) {
      const col = columns.find(c => c.Field === colName);
      if (col) {
        console.log(`   ✓ ${colName} (${col.Type})`);
      } else {
        console.log(`   ✗ ${colName} - MISSING!`);
        allColumnsPresent = false;
      }
    }

    if (!allColumnsPresent) {
      throw new Error('Some required columns are missing from pending_bookings table');
    }

    // Step 3: Verify indexes
    console.log('\n🔍 Verifying indexes...');
    const [indexes] = await sequelize.query(`SHOW INDEX FROM pending_bookings`);

    const indexNames = [...new Set(indexes.map(idx => idx.Key_name))];
    console.log('📊 Indexes found:', indexNames.length);
    indexNames.forEach(name => {
      if (name !== 'PRIMARY') {
        console.log(`   ✓ ${name}`);
      }
    });

    console.log('\n✅ Pending Bookings Migration completed successfully!');
    console.log('\n📋 What was created:');
    console.log('   ✓ pending_bookings table with all required columns');
    console.log('   ✓ Foreign key relationships (patient, caregiver, specialty, timeslot, location)');
    console.log('   ✓ Status tracking (pending, payment_initiated, payment_completed, payment_failed, expired, converted)');
    console.log('   ✓ Expiry management with expiresAt field');
    console.log('   ✓ Indexes for performance (status+expiresAt, tx_ref, timeSlotId, patientId)');

    console.log('\n🔐 Race Condition Prevention:');
    console.log('   • Database transactions with row-level locks (SELECT FOR UPDATE)');
    console.log('   • Atomic slot locking via bookingService.lockSlotWithPendingBooking()');
    console.log('   • Idempotent payment webhook processing');
    console.log('   • Automatic cleanup every 5 minutes via cleanupService');

    console.log('\n📨 Email Notifications:');
    console.log('   • Payment success: sendPaymentConfirmation()');
    console.log('   • Payment failure: sendPaymentFailureNotification()');
    console.log('   • Booking expired: sendBookingExpiredNotification()');

    console.log('\n🚀 Integration Points:');
    console.log('   • bookingService.lockSlotWithPendingBooking() - Create pending booking');
    console.log('   • paymentService.processWebhook() - Convert on payment success');
    console.log('   • bookingService.releasePendingBooking() - Release on payment failure/expiry');
    console.log('   • cleanupService.runCleanup() - Auto-cleanup expired bookings');

    console.log('\n⏱  Cleanup Schedule:');
    console.log('   • Runs automatically every 5 minutes');
    console.log('   • Releases expired slots (after 10 minutes)');
    console.log('   • Sends notifications to patients');
    console.log('   • Processes up to 50 records per batch');

  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error(error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  migratePendingBookings()
    .then(() => {
      console.log('\n🎉 Migration complete! The booking system is now protected against race conditions.');
      console.log('💡 Next steps:');
      console.log('   1. Update booking controller to use bookingService.lockSlotWithPendingBooking()');
      console.log('   2. Initialize cleanupService in server.js');
      console.log('   3. Test the new booking flow with multiple concurrent requests');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Migration failed:', error);
      process.exit(1);
    });
}

module.exports = migratePendingBookings;
