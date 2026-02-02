// Test Inventory Endpoints
// Run this with: node test-inventory.js

require('dotenv').config();
const axios = require('axios');

const API_URL = 'http://localhost:3001/api';

// Replace with your actual token from login
const TEST_TOKEN = 'YOUR_TOKEN_HERE';

async function testEndpoints() {
  console.log('🧪 Testing Inventory Endpoints\n');
  console.log('='.repeat(50));

  try {
    // Test 1: Get locations
    console.log('\n📍 Test 1: GET /api/inventory/locations');
    console.log('-'.repeat(50));
    
    const locationsResponse = await axios.get(`${API_URL}/inventory/locations`, {
      headers: { Authorization: `Bearer ${TEST_TOKEN}` }
    });
    
    console.log('✅ Status:', locationsResponse.status);
    console.log('📊 Response data:');
    console.log(JSON.stringify(locationsResponse.data, null, 2));
    console.log(`\n✅ Found ${locationsResponse.data.length} locations`);
    
    if (locationsResponse.data.length > 0) {
      console.log('\n📍 Sample location:');
      console.log(JSON.stringify(locationsResponse.data[0], null, 2));
    }

  } catch (error) {
    if (error.response) {
      console.error('❌ Error Response:', error.response.status);
      console.error('❌ Error Data:', error.response.data);
    } else if (error.request) {
      console.error('❌ No response received:', error.message);
    } else {
      console.error('❌ Error:', error.message);
    }
  }

  console.log('\n' + '='.repeat(50));
}

// Check if token is set
if (TEST_TOKEN === 'YOUR_TOKEN_HERE') {
  console.log('❌ ERROR: Please update TEST_TOKEN in test-inventory.js');
  console.log('\nSteps to get token:');
  console.log('1. Login at http://localhost:3000/login');
  console.log('2. Open browser DevTools (F12)');
  console.log('3. Go to Application > Local Storage > http://localhost:3000');
  console.log('4. Copy the "token" value');
  console.log('5. Paste it in TEST_TOKEN variable in this file\n');
  process.exit(1);
}

testEndpoints();
