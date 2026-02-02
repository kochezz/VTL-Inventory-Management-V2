const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function checkData() {
    const client = await pool.connect();
    try {
        const products = await client.query("SELECT sku FROM products WHERE sku LIKE 'PREFORM%' OR sku = 'CAP-GENERIC'");
        console.log('Products found:', products.rows.map(r => r.sku));

        const locations = await client.query("SELECT location_code FROM warehouse_locations WHERE location_code IN ('A-01-BIN-01', 'WH-MAIN', 'PROD-FLOOR')");
        console.log('Locations found:', locations.rows.map(r => r.location_code));

        const inventory = await client.query(`
      SELECT p.sku, wl.location_code, i.quantity_on_hand 
      FROM inventory i
      JOIN products p ON i.product_id = p.product_id
      JOIN warehouse_locations wl ON i.location_id = wl.location_id
      WHERE p.sku IN ('PREFORM-750ML-25G', 'PREFORM-500ML-18G', 'CAP-GENERIC')
    `);
        console.log('Inventory records:', inventory.rows);

    } finally {
        client.release();
        pool.end();
    }
}
checkData();
