const { Pool } = require('pg');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function checkConstraints() {
    const client = await pool.connect();
    try {
        const res = await client.query(`
      SELECT conname, pg_get_constraintdef(oid)
      FROM pg_constraint
      WHERE conrelid = 'audit_log'::regclass
    `);
        fs.writeFileSync('constraints.log', JSON.stringify(res.rows, null, 2), 'utf8');
    } finally {
        client.release();
        pool.end();
    }
}
checkConstraints();
