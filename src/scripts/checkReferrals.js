const { Referral, Caregiver, Patient, User } = require('../models');

const checkReferrals = async () => {
  try {
    console.log('🔍 Checking referrals in database...\n');

    // Get all referrals
    const referrals = await Referral.findAll({
      include: [
        {
          model: Caregiver,
          as: 'Caregiver',
          include: [{ model: User }]
        },
        {
          model: Patient,
          required: false,
          include: [{ model: User }]
        },
        {
          model: Caregiver,
          as: 'ReferredCaregiver',
          required: false,
          include: [{ model: User }]
        }
      ],
      order: [['createdAt', 'DESC']]
    });

    console.log(`📊 Total referrals: ${referrals.length}\n`);

    if (referrals.length === 0) {
      console.log('⚠️  No referrals found in database!');
      console.log('💡 Caregivers need to generate referral codes first from their Profile page.');
      return;
    }

    referrals.forEach((ref, index) => {
      console.log(`\n${index + 1}. Referral ID: ${ref.id}`);
      console.log(`   Code: ${ref.referralCode}`);
      console.log(`   Status: ${ref.status}`);
      console.log(`   Type: ${ref.referralType || 'N/A'}`);
      console.log(`   Referring Caregiver: ${ref.Caregiver?.User?.firstName} ${ref.Caregiver?.User?.lastName} (ID: ${ref.caregiverId})`);

      if (ref.patientId && ref.Patient) {
        console.log(`   Referred Patient: ${ref.Patient?.User?.firstName} ${ref.Patient?.User?.lastName} (ID: ${ref.patientId})`);
        console.log(`   Converted: ${ref.convertedAt}`);
      } else if (ref.referredCaregiverId && ref.ReferredCaregiver) {
        console.log(`   Referred Caregiver: ${ref.ReferredCaregiver?.User?.firstName} ${ref.ReferredCaregiver?.User?.lastName} (ID: ${ref.referredCaregiverId})`);
        console.log(`   Converted: ${ref.convertedAt}`);
      } else {
        console.log(`   Referred User: None (pending)`);
      }
      console.log(`   Created: ${ref.createdAt}`);
    });

    // Check caregiver boost scores
    console.log('\n\n📈 Caregiver Boost Scores:');
    const caregivers = await Caregiver.findAll({
      include: [{ model: User }],
      where: {
        referralBoostScore: { [require('sequelize').Op.gt]: 0 }
      }
    });

    if (caregivers.length === 0) {
      console.log('   No caregivers with boost scores yet.');
    } else {
      caregivers.forEach(cg => {
        console.log(`   ${cg.User.firstName} ${cg.User.lastName}: Boost=${cg.referralBoostScore}, Count=${cg.referralCount}`);
      });
    }

    console.log('\n✅ Check complete!');
  } catch (error) {
    console.error('❌ Error checking referrals:', error);
  }
};

// Run if executed directly
if (require.main === module) {
  checkReferrals()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Failed:', error);
      process.exit(1);
    });
}

module.exports = checkReferrals;
