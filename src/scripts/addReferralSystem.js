const { Sequelize } = require('sequelize');
const sequelize = require('../config/database');

const addReferralSystem = async () => {
  try {
    console.log('🔄 Adding referral system tables and fields...');

    // Step 1: Create referrals table if it doesn't exist
    console.log('\n📋 Creating referrals table...');
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS referrals (
        id INT AUTO_INCREMENT PRIMARY KEY,
        caregiverId INT NOT NULL COMMENT 'The caregiver who created this referral',
        referralCode VARCHAR(10) NOT NULL UNIQUE COMMENT 'Unique referral code (e.g., CARE7X9K2L)',
        patientId INT NULL COMMENT 'The patient who used this referral code (null until conversion)',
        status ENUM('pending', 'converted', 'cancelled') DEFAULT 'pending' COMMENT 'pending: link shared, converted: patient registered, cancelled: patient deleted account',
        convertedAt DATETIME NULL COMMENT 'When the referral converted (patient completed registration)',
        expiresAt DATETIME NULL COMMENT 'Optional expiration date for referral codes',
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

        FOREIGN KEY (caregiverId) REFERENCES caregivers(id) ON DELETE CASCADE,
        FOREIGN KEY (patientId) REFERENCES patients(id) ON DELETE SET NULL,

        INDEX idx_caregiverId (caregiverId),
        INDEX idx_referralCode (referralCode),
        INDEX idx_status (status),
        INDEX idx_patientId (patientId)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ Referrals table created/verified');

    // Step 2: Check if referral fields exist in caregivers table
    console.log('\n📋 Checking caregiver table for referral fields...');
    const [results] = await sequelize.query(`
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'caregivers'
      AND COLUMN_NAME IN ('referralBoostScore', 'referralCount')
    `);

    const existingColumns = results.map(row => row.COLUMN_NAME);

    // Step 3: Add referralBoostScore if it doesn't exist
    if (!existingColumns.includes('referralBoostScore')) {
      await sequelize.query(`
        ALTER TABLE caregivers
        ADD COLUMN referralBoostScore INT DEFAULT 0
        COMMENT 'Boost score from successful referrals (1 point per converted referral)'
      `);
      console.log('✅ Added referralBoostScore column');
    } else {
      console.log('ℹ️  referralBoostScore column already exists');
    }

    // Step 4: Add referralCount if it doesn't exist
    if (!existingColumns.includes('referralCount')) {
      await sequelize.query(`
        ALTER TABLE caregivers
        ADD COLUMN referralCount INT DEFAULT 0
        COMMENT 'Total number of converted referrals'
      `);
      console.log('✅ Added referralCount column');
    } else {
      console.log('ℹ️  referralCount column already exists');
    }

    // Step 5: Add indexes for sorting/filtering by boost score
    console.log('\n📋 Creating indexes for referral fields...');

    try {
      await sequelize.query(`
        CREATE INDEX idx_referralBoostScore ON caregivers(referralBoostScore)
      `);
      console.log('✅ Created index on referralBoostScore');
    } catch (error) {
      if (error.message.includes('Duplicate key name')) {
        console.log('ℹ️  Index idx_referralBoostScore already exists');
      } else {
        throw error;
      }
    }

    try {
      await sequelize.query(`
        CREATE INDEX idx_referralCount ON caregivers(referralCount)
      `);
      console.log('✅ Created index on referralCount');
    } catch (error) {
      if (error.message.includes('Duplicate key name')) {
        console.log('ℹ️  Index idx_referralCount already exists');
      } else {
        throw error;
      }
    }

    console.log('\n✅ Successfully added referral system to database');
    console.log('\n📊 Summary:');
    console.log('   - referrals table created');
    console.log('   - caregivers.referralBoostScore added');
    console.log('   - caregivers.referralCount added');
    console.log('   - Indexes created for performance');

  } catch (error) {
    console.error('❌ Error adding referral system:', error);
    throw error;
  }
};

// Run the migration if this file is executed directly
if (require.main === module) {
  addReferralSystem()
    .then(() => {
      console.log('\n🎉 Referral system migration completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Migration failed:', error);
      process.exit(1);
    });
}

module.exports = addReferralSystem;
