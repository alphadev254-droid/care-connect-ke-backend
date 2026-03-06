const sequelize = require('../config/database');

async function addCaregiverReferrals() {
  try {
    console.log('🔄 Adding caregiver referral support...');

    // Add referredCaregiverId column
    await sequelize.query(`
      ALTER TABLE referrals
      ADD COLUMN IF NOT EXISTS referredCaregiverId INT NULL
      COMMENT 'The caregiver who used this referral code (null until conversion)'
    `);
    console.log('✅ Added referredCaregiverId column');

    // Add referralType column
    await sequelize.query(`
      ALTER TABLE referrals
      ADD COLUMN IF NOT EXISTS referralType ENUM('patient', 'caregiver') NULL
      COMMENT 'Type of referral: patient or caregiver'
    `);
    console.log('✅ Added referralType column');

    // Add foreign key constraint for referredCaregiverId
    await sequelize.query(`
      ALTER TABLE referrals
      ADD CONSTRAINT fk_referrals_referred_caregiver
      FOREIGN KEY (referredCaregiverId) REFERENCES caregivers(id)
      ON DELETE SET NULL
    `).catch(err => {
      if (err.message.includes('Duplicate')) {
        console.log('⚠️  Foreign key constraint already exists, skipping...');
      } else {
        throw err;
      }
    });
    console.log('✅ Added foreign key constraint');

    // Add index for referredCaregiverId
    await sequelize.query(`
      CREATE INDEX idx_referrals_referred_caregiver
      ON referrals(referredCaregiverId)
    `).catch(err => {
      if (err.message.includes('Duplicate')) {
        console.log('⚠️  Index already exists, skipping...');
      } else {
        throw err;
      }
    });
    console.log('✅ Added index for referredCaregiverId');

    console.log('🎉 Caregiver referral support added successfully!');
  } catch (error) {
    console.error('❌ Error adding caregiver referral support:', error);
    throw error;
  }
}

// Run if executed directly
if (require.main === module) {
  addCaregiverReferrals()
    .then(() => {
      console.log('✅ Migration complete');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Migration failed:', error);
      process.exit(1);
    });
}

module.exports = addCaregiverReferrals;
