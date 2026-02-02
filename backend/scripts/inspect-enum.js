const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function checkEnum() {
    const client = await pool.connect();
    try {
        const res = await client.query(`SELECT enumlabel FROM pg_enum JOIN pg_type ON pg_enum.enumtypid = pg_type.oid WHERE pg_type.typname = 'transaction_type'`);
        console.log(res.rows);
        const fs = require('fs');
        fs.writeFileSync('enum.log', JSON.stringify(res.rows, null, 2), 'utf8');
    } finally {
        client.release();
        pool.end();
    }
}
checkEnum();
