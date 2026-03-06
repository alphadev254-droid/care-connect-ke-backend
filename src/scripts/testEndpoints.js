const axios = require('axios');
require('dotenv').config();

const testEndpoints = async () => {
  try {
    console.log('🧪 Testing backend endpoints...');
    
    // First login to get token
    const loginResponse = await axios.post('http://localhost:5000/api/auth/login', {
      email: 'brianndesa262@gmail.com',
      password: 'brian001' // Use the actual password
    });
    
    const token = loginResponse.data.token;
    console.log('✅ Login successful, token received');
    
    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
    
    // Test GET /users/profile
    console.log('\n📋 Testing GET /users/profile...');
    const profileResponse = await axios.get('http://localhost:5000/api/users/profile', { headers });
    console.log('✅ Profile endpoint response:');
    console.log(JSON.stringify(profileResponse.data, null, 2));
    
    // Test PUT /users/profile
    console.log('\n📋 Testing PUT /users/profile...');
    const updateData = {
      firstName: 'Brian',
      lastName: 'Albert',
      phone: '+265 998 95 15 10',
      address: 'Updated address test',
      medicalHistory: 'Test medical history update'
    };
    
    const updateResponse = await axios.put('http://localhost:5000/api/users/profile', updateData, { headers });
    console.log('✅ Profile update response:');
    console.log(JSON.stringify(updateResponse.data, null, 2));
    
    // Test GET /appointments
    console.log('\n📋 Testing GET /appointments...');
    const appointmentsResponse = await axios.get('http://localhost:5000/api/appointments?limit=5', { headers });
    console.log('✅ Appointments endpoint response:');
    console.log(JSON.stringify(appointmentsResponse.data, null, 2));
    
    // Test GET /caregivers
    console.log('\n📋 Testing GET /caregivers...');
    const caregiversResponse = await axios.get('http://localhost:5000/api/caregivers', { headers });
    console.log('✅ Caregivers endpoint response:');
    console.log(JSON.stringify(caregiversResponse.data, null, 2));
    
    console.log('\n🎉 All endpoint tests completed successfully!');
    
  } catch (error) {
    console.error('❌ Endpoint test failed:');
    console.error(`   Error: ${error.message}`);
    if (error.response) {
      console.error(`   Status: ${error.response.status}`);
      console.error(`   Response: ${JSON.stringify(error.response.data, null, 2)}`);
    }
  }
};

if (require.main === module) {
  testEndpoints();
}

module.exports = testEndpoints;