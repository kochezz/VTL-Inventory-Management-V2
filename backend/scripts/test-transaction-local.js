const { createTransaction, pool } = require('../src/services/inventory-service');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { Pool } = require('pg');
const testPool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function runLocalTest() {
    const client = await testPool.connect();
    try {
        console.log('Fetching Admin User...');
        const userRes = await client.query("SELECT user_id FROM users WHERE email = 'admin@vilag.io'");
        const userId = userRes.rows[0].user_id;

        console.log('Fetching Product/Location...');
        const prodRes = await client.query("SELECT product_id, base_uom FROM products LIMIT 1");
        const locRes = await client.query("SELECT location_id FROM warehouse_locations WHERE location_type = 'warehouse' LIMIT 1");

        if (prodRes.rows.length === 0 || locRes.rows.length === 0) {
            throw new Error('No product or location found');
        }

        const productId = prodRes.rows[0].product_id;
        const locationId = locRes.rows[0].location_id;

        console.log(`Product: ${productId}, Location: ${locationId}`);

        console.log('Testing createTransaction directly...');
        const result = await createTransaction({
            product_id: productId,
            transaction_type: 'RECEIVE',
            quantity: 5,
            to_location_id: locationId,
            performed_by: userId,
            notes: 'Local script test',
            unit_cost: 1.0
        });

        console.log('✅ Transaction Created!');
        console.log('Number:', result.transaction.transaction_number);
        console.log('Status:', result.transaction.status);
        fs.writeFileSync('success.log', `Success: ${result.transaction.transaction_number}`, 'utf8');

    } catch (error) {
        let msg = `Error: ${error.message}\nDetail: ${error.detail}\nTable: ${error.table}\nColumn: ${error.column}\nStack: ${error.stack}`;
        fs.writeFileSync('error.log', msg, 'utf8');
        console.error('See error.log');
    } finally {
        client.release();
        testPool.end();
        process.exit(0);
    }
}

runLocalTest();
