const axios = require('axios');
require('dotenv').config();

const testPaychanguConnection = async () => {
  try {
    console.log('🔄 Testing Paychangu API connection...');
    
    const testPayment = {
      amount: 1000, // MWK 1000
      currency: 'MWK',
      email: 'test@example.com',
      first_name: 'Test',
      last_name: 'User',
      phone_number: '+265 998 95 15 10',
      callback_url: `${process.env.WEBHOOK_BASE_URL}/api/payments/webhook`,
      return_url: `${process.env.FRONTEND_URL}/dashboard/billing?status=success`,
      tx_ref: `TEST-${Date.now()}`,
      customization: {
        title: 'CareConnect Test',
        description: 'Test payment integration with phone +265 998 95 15 10'
      }
    };

    const response = await axios.post(
      'https://api.paychangu.com/payment',
      testPayment,
      {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.TEST_SECRET_KEY}`
        }
      }
    );

    console.log('✅ Paychangu API connection successful!');
    console.log('📋 Full API Response:');
    console.log(JSON.stringify(response.data, null, 2));
    
    // Extract actual response fields
    const paymentData = response.data.data || response.data;
    console.log('\n📋 Parsed Payment Details:');
    console.log(`   Payment ID: ${paymentData.payment_id || paymentData.id || 'N/A'}`);
    console.log(`   Checkout URL: ${paymentData.checkout_url || paymentData.payment_url || 'N/A'}`);
    console.log(`   Status: ${paymentData.status || response.data.status || 'N/A'}`);
    console.log(`   Transaction Ref: ${paymentData.tx_ref || 'N/A'}`);
    
    return response.data;
  } catch (error) {
    console.error('❌ Paychangu API connection failed:');
    console.error(`   Error: ${error.message}`);
    if (error.response) {
      console.error(`   Status: ${error.response.status}`);
      console.error(`   Response: ${JSON.stringify(error.response.data, null, 2)}`);
    }
    throw error;
  }
};

// Run test if called directly
if (require.main === module) {
  testPaychanguConnection()
    .then(() => {
      console.log('\n🎉 Paychangu integration test completed successfully!');
      process.exit(0);
    })
    .catch(() => {
      console.log('\n💥 Paychangu integration test failed!');
      process.exit(1);
    });
}

module.exports = testPaychanguConnection;