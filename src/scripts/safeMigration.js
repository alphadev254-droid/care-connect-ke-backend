const { sequelize } = require('../models');

async function safeMigration() {
  try {
    console.log('🔄 Starting Safe Migration...');

    // Step 1: Create tables without foreign keys first
    console.log('📊 Creating base tables...');
    
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS caregiver_availability (
        id INT AUTO_INCREMENT PRIMARY KEY,
        caregiverId INT NOT NULL,
        dayOfWeek INT NOT NULL,
        startTime TIME NOT NULL,
        endTime TIME NOT NULL,
        isActive BOOLEAN DEFAULT TRUE,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ CaregiverAvailability table created');

    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS time_slots (
        id INT AUTO_INCREMENT PRIMARY KEY,
        caregiverId INT NOT NULL,
        date DATE NOT NULL,
        startTime TIME NOT NULL,
        endTime TIME NOT NULL,
        duration INT NOT NULL,
        price DECIMAL(10,2) NOT NULL,
        status ENUM('available', 'locked', 'booked') DEFAULT 'available',
        lockedUntil TIMESTAMP NULL,
        isBooked BOOLEAN DEFAULT FALSE,
        appointmentId INT NULL,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY unique_slot (caregiverId, date, startTime)
      )
    `);
    console.log('✅ TimeSlot table created');

    // Step 2: Add new columns to existing tables
    console.log('🔧 Adding new columns...');
    
    // Add columns to Caregivers table
    try {
      await sequelize.query(`
        ALTER TABLE Caregivers 
        ADD COLUMN appointmentDuration INT DEFAULT 60,
        ADD COLUMN autoConfirm BOOLEAN DEFAULT TRUE
      `);
      console.log('✅ Added columns to Caregivers table');
    } catch (error) {
      if (error.message.includes('Duplicate column')) {
        console.log('⚠️  Columns already exist in Caregivers table');
      } else {
        throw error;
      }
    }

    // Add columns to Appointments table
    try {
      await sequelize.query(`
        ALTER TABLE Appointments 
        ADD COLUMN timeSlotId INT NULL,
        ADD COLUMN paymentStatus ENUM('pending', 'completed', 'failed', 'refunded') DEFAULT 'pending',
        ADD COLUMN bookedAt TIMESTAMP NULL
      `);
      console.log('✅ Added columns to Appointments table');
    } catch (error) {
      if (error.message.includes('Duplicate column')) {
        console.log('⚠️  Columns already exist in Appointments table');
      } else {
        throw error;
      }
    }

    // Step 3: Add foreign key constraints
    console.log('🔗 Adding foreign key constraints...');
    
    try {
      await sequelize.query(`
        ALTER TABLE time_slots 
        ADD CONSTRAINT fk_timeslot_caregiver 
        FOREIGN KEY (caregiverId) REFERENCES Caregivers(id)
      `);
      console.log('✅ Added foreign key: time_slots -> Caregivers');
    } catch (error) {
      if (error.message.includes('already exists')) {
        console.log('⚠️  Foreign key already exists: time_slots -> Caregivers');
      } else {
        console.log('⚠️  Could not add foreign key: time_slots -> Caregivers');
      }
    }

    try {
      await sequelize.query(`
        ALTER TABLE Appointments 
        ADD CONSTRAINT fk_appointment_timeslot 
        FOREIGN KEY (timeSlotId) REFERENCES time_slots(id)
      `);
      console.log('✅ Added foreign key: Appointments -> time_slots');
    } catch (error) {
      if (error.message.includes('already exists')) {
        console.log('⚠️  Foreign key already exists: Appointments -> time_slots');
      } else {
        console.log('⚠️  Could not add foreign key: Appointments -> time_slots');
      }
    }

    console.log('✅ Safe Migration completed successfully!');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    throw error;
  }
}

module.exports = safeMigration;