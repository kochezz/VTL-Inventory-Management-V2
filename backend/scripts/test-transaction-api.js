const axios = require('axios');

const API_URL = 'http://localhost:3001/api';
const ADMIN_EMAIL = 'admin@vilag.io';
const ADMIN_PASSWORD = 'Admin@123';

async function runTest() {
    try {
        console.log('1. Attempting Login...');
        const loginRes = await axios.post(`${API_URL}/auth/login`, {
            email: ADMIN_EMAIL,
            password: ADMIN_PASSWORD
        });

        // CORRECTION: use accessToken, not token
        const token = loginRes.data.accessToken;
        console.log('✅ Login successful.');
        console.log('Token received:', token ? token.substring(0, 20) + '...' : 'UNDEFINED');

        if (!token) {
            throw new Error('No access token received from login');
        }

        console.log('2. Fetching Product and Location...');
        const productsRes = await axios.get(`${API_URL}/products`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        const locationsRes = await axios.get(`${API_URL}/inventory/locations`, {
            headers: { Authorization: `Bearer ${token}` }
        });

        if (productsRes.data.products.length === 0 || locationsRes.data.length === 0) {
            throw new Error('No products or locations found to test with.');
        }

        const product = productsRes.data.products[0];
        const location = locationsRes.data.find(l => l.location_type === 'warehouse') || locationsRes.data[0];

        console.log(`Using Product: ${product.product_name} (${product.product_id})`);
        console.log(`Using Location: ${location.location_name} (${location.location_id})`);

        console.log('3. creating RECEIVE Transaction...');
        const transactionData = {
            product_id: product.product_id,
            transaction_type: 'RECEIVE',
            quantity: 10,
            to_location_id: location.location_id,
            notes: 'Automated test transaction from fix script',
            unit_cost: 1.50
        };

        const txnRes = await axios.post(`${API_URL}/inventory/transactions`, transactionData, {
            headers: { Authorization: `Bearer ${token}` }
        });

        console.log('✅ Transaction Created Successfully!');
        console.log('Transaction Number:', txnRes.data.transaction.transaction_number);
        console.log('Status:', txnRes.data.transaction.status);

    } catch (error) {
        console.error('❌ Test Failed:', error.message);
        if (error.response) {
            console.error('Response Data:', error.response.data);
        }
    }
}

runTest();
