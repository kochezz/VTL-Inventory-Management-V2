const { Pool } = require('pg');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function checkAuditCols() {
    const client = await pool.connect();
    try {
        const res = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'audit_log'
    `);
        fs.writeFileSync('audit_cols.log', JSON.stringify(res.rows, null, 2), 'utf8');
    } finally {
        client.release();
        pool.end();
    }
}
checkAuditCols();
