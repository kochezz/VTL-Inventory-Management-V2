const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function runFixes() {
  const client = await pool.connect();
  console.log('Connected to database...');

  try {
    await client.query('BEGIN');

    // 1. Add status column to inventory_transactions
    console.log('Step 1: Checking/Adding status column...');
    await client.query(`
      ALTER TABLE inventory_transactions 
      ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'completed';
    `);
    console.log('✅ Status column added/verified.');

    // 2. Verify inventory table structure
    console.log('Step 2: Verifying inventory table structure...');
    await client.query(`
      ALTER TABLE inventory ADD COLUMN IF NOT EXISTS uom VARCHAR(20);
      ALTER TABLE inventory ADD COLUMN IF NOT EXISTS last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
      ALTER TABLE inventory ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
      
      UPDATE inventory SET uom = 'piece' WHERE uom IS NULL;
      UPDATE inventory SET last_updated = CURRENT_TIMESTAMP WHERE last_updated IS NULL;
      UPDATE inventory SET created_at = CURRENT_TIMESTAMP WHERE created_at IS NULL;
    `);

    // Add constraint if missing
    await client.query(`
      DO $$ 
      BEGIN
          IF NOT EXISTS (
              SELECT 1 FROM pg_constraint 
              WHERE conname = 'unique_product_location'
          ) THEN
              ALTER TABLE inventory 
              ADD CONSTRAINT unique_product_location 
              UNIQUE (product_id, location_id);
          END IF;
      END $$;
    `);
    console.log('✅ Inventory table structure verified.');

    // 3. Add sample data
    console.log('Step 3: Adding sample inventory data...');
    const result = await client.query(`
      INSERT INTO inventory (
        product_id, 
        location_id, 
        quantity_on_hand, 
        quantity_allocated, 
        uom, 
        last_updated, 
        created_at
      )
      SELECT 
          p.product_id,
          wl.location_id,
          10000,
          0,
          p.base_uom,
          CURRENT_TIMESTAMP,
          CURRENT_TIMESTAMP
      FROM products p
      CROSS JOIN warehouse_locations wl
      WHERE p.sku IN ('PREFORM-750ML-25G', 'PREFORM-500ML-18G', 'CAP-GENERIC')
        AND wl.location_code IN ('A-01-BIN-01', 'A-01-BIN-02', 'WH-MAIN', 'PROD-FLOOR')
        AND NOT EXISTS (
          SELECT 1 FROM inventory i 
          WHERE i.product_id = p.product_id 
          AND i.location_id = wl.location_id
        )
      RETURNING inventory_id;
    `);
    console.log(`✅ Sample data added. Rows inserted: ${result.rowCount}`);

    await client.query('COMMIT');
    console.log('🎉 All fixes applied successfully!');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error running fixes:', error);
  } finally {
    client.release();
    pool.end();
  }
}

runFixes();
