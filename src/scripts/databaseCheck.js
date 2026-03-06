require('dotenv').config();
const mysql = require('mysql2/promise');

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'brianndesa001',
  database: process.env.DB_NAME || 'home_care_db',
  port: parseInt(process.env.DB_PORT) || 3306
};

console.log('Using database config:', {
  host: dbConfig.host,
  user: dbConfig.user,
  database: dbConfig.database,
  port: dbConfig.port,
  password: '***'
});

async function checkDatabase() {
  let connection;

  try {
    console.log('🔌 Connecting to database...');
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ Connected to database successfully\n');

    // 1. Check if referrals table exists and has all columns
    console.log('📋 Checking referrals table structure...');
    const [columns] = await connection.query(`
      SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = 'home_care_db'
      AND TABLE_NAME = 'referrals'
      ORDER BY ORDINAL_POSITION
    `);

    console.log('\nReferrals table columns:');
    columns.forEach(col => {
      console.log(`  - ${col.COLUMN_NAME} (${col.DATA_TYPE})`);
    });

    // Check if new columns exist
    const hasReferredCaregiverId = columns.some(col => col.COLUMN_NAME === 'referredCaregiverId');
    const hasReferralType = columns.some(col => col.COLUMN_NAME === 'referralType');

    if (!hasReferredCaregiverId || !hasReferralType) {
      console.log('\n⚠️  Missing new referral columns. Adding them...');

      if (!hasReferredCaregiverId) {
        await connection.query(`
          ALTER TABLE referrals
          ADD COLUMN referredCaregiverId INT NULL
          COMMENT 'The caregiver who used this referral code (null until conversion)'
        `);
        console.log('✅ Added referredCaregiverId column');
      }

      if (!hasReferralType) {
        await connection.query(`
          ALTER TABLE referrals
          ADD COLUMN referralType ENUM('patient', 'caregiver') NULL
          COMMENT 'Type of referral: patient or caregiver'
        `);
        console.log('✅ Added referralType column');
      }

      // Add foreign key if needed
      await connection.query(`
        ALTER TABLE referrals
        ADD CONSTRAINT fk_referrals_referred_caregiver
        FOREIGN KEY (referredCaregiverId) REFERENCES caregivers(id)
        ON DELETE SET NULL
      `).catch(err => {
        if (!err.message.includes('Duplicate')) {
          throw err;
        }
      });

      // Add index if needed
      await connection.query(`
        CREATE INDEX idx_referrals_referred_caregiver
        ON referrals(referredCaregiverId)
      `).catch(err => {
        if (!err.message.includes('Duplicate')) {
          throw err;
        }
      });
    } else {
      console.log('✅ All referral columns exist');
    }

    // 2. Check caregivers table for boost score columns
    console.log('\n📋 Checking caregivers table for referral boost columns...');
    const [caregiverCols] = await connection.query(`
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = 'home_care_db'
      AND TABLE_NAME = 'caregivers'
      AND COLUMN_NAME IN ('referralBoostScore', 'referralCount')
    `);

    if (caregiverCols.length < 2) {
      console.log('⚠️  Missing boost score columns. Adding them...');

      const hasBoostScore = caregiverCols.some(col => col.COLUMN_NAME === 'referralBoostScore');
      const hasReferralCount = caregiverCols.some(col => col.COLUMN_NAME === 'referralCount');

      if (!hasBoostScore) {
        await connection.query(`
          ALTER TABLE caregivers
          ADD COLUMN referralBoostScore INT DEFAULT 0
          COMMENT 'Boost score from successful referrals'
        `);
        console.log('✅ Added referralBoostScore column');
      }

      if (!hasReferralCount) {
        await connection.query(`
          ALTER TABLE caregivers
          ADD COLUMN referralCount INT DEFAULT 0
          COMMENT 'Total number of converted referrals'
        `);
        console.log('✅ Added referralCount column');
      }
    } else {
      console.log('✅ All caregiver boost columns exist');
    }

    // 3. Check current referrals
    console.log('\n📊 Current referrals in database:');
    const [referrals] = await connection.query(`
      SELECT
        r.id,
        r.referralCode,
        r.status,
        r.referralType,
        r.patientId,
        r.referredCaregiverId,
        r.caregiverId,
        c.referralBoostScore,
        c.referralCount,
        u.firstName,
        u.lastName
      FROM referrals r
      LEFT JOIN caregivers c ON r.caregiverId = c.id
      LEFT JOIN users u ON c.userId = u.id
      ORDER BY r.createdAt DESC
      LIMIT 10
    `);

    if (referrals.length === 0) {
      console.log('  No referrals found');
    } else {
      referrals.forEach(ref => {
        console.log(`\n  Referral #${ref.id}:`);
        console.log(`    Code: ${ref.referralCode}`);
        console.log(`    Status: ${ref.status}`);
        console.log(`    Type: ${ref.referralType || 'N/A'}`);
        console.log(`    Referring Caregiver: ${ref.firstName} ${ref.lastName} (ID: ${ref.caregiverId})`);
        console.log(`    Boost Score: ${ref.referralBoostScore || 0}`);
        console.log(`    Referral Count: ${ref.referralCount || 0}`);
        console.log(`    Patient ID: ${ref.patientId || 'None'}`);
        console.log(`    Referred Caregiver ID: ${ref.referredCaregiverId || 'None'}`);
      });
    }

    // 4. Check for pending referrals that should be converted
    console.log('\n\n🔍 Checking for pending referrals with linked patients...');
    const [pendingWithPatients] = await connection.query(`
      SELECT r.*, p.userId as patientUserId
      FROM referrals r
      LEFT JOIN patients p ON r.patientId = p.id
      WHERE r.status = 'pending' AND r.patientId IS NOT NULL
    `);

    if (pendingWithPatients.length > 0) {
      console.log(`⚠️  Found ${pendingWithPatients.length} pending referrals with patients that should be converted!`);

      for (const ref of pendingWithPatients) {
        console.log(`\n  Converting referral ${ref.referralCode}...`);

        // Update referral status
        await connection.query(`
          UPDATE referrals
          SET status = 'converted',
              referralType = 'patient',
              convertedAt = NOW()
          WHERE id = ?
        `, [ref.id]);

        // Increment caregiver boost score
        await connection.query(`
          UPDATE caregivers
          SET referralBoostScore = referralBoostScore + 1,
              referralCount = referralCount + 1
          WHERE id = ?
        `, [ref.caregiverId]);

        console.log(`  ✅ Converted referral ${ref.referralCode}`);
      }
    } else {
      console.log('✅ No pending referrals need conversion');
    }

    // 5. Summary
    console.log('\n\n📈 Caregiver Boost Score Summary:');
    const [boostSummary] = await connection.query(`
      SELECT
        c.id,
        u.firstName,
        u.lastName,
        c.referralBoostScore,
        c.referralCount,
        (SELECT COUNT(*) FROM referrals WHERE caregiverId = c.id AND status = 'converted') as actualConverted
      FROM caregivers c
      JOIN users u ON c.userId = u.id
      WHERE c.referralBoostScore > 0 OR c.referralCount > 0
      ORDER BY c.referralBoostScore DESC
    `);

    if (boostSummary.length === 0) {
      console.log('  No caregivers with boost scores yet');
    } else {
      boostSummary.forEach(cg => {
        console.log(`\n  ${cg.firstName} ${cg.lastName} (ID: ${cg.id})`);
        console.log(`    Boost Score: ${cg.referralBoostScore}`);
        console.log(`    Referral Count: ${cg.referralCount}`);
        console.log(`    Actual Converted: ${cg.actualConverted}`);
      });
    }

    console.log('\n\n✅ Database check complete!');

  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n🔌 Database connection closed');
    }
  }
}

// Run the check
checkDatabase()
  .then(() => {
    console.log('\n✨ All done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Failed:', error);
    process.exit(1);
  });
