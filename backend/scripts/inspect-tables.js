const { Pool } = require('pg');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function checkTables() {
    const client = await pool.connect();
    try {
        const res = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
    `);
        fs.writeFileSync('tables.log', JSON.stringify(res.rows, null, 2), 'utf8');
    } finally {
        client.release();
        pool.end();
    }
}
checkTables();
