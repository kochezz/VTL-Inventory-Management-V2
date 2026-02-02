// Direct Database Test for Warehouse Locations
// Run this with: node test-db-locations.js

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function testLocations() {
  console.log('🔍 Testing Database Directly\n');
  console.log('='.repeat(60));

  try {
    // Test 1: Check if table exists
    console.log('\n📊 Test 1: Check if warehouse_locations table exists');
    console.log('-'.repeat(60));
    
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'warehouse_locations'
      );
    `);
    
    if (tableCheck.rows[0].exists) {
      console.log('✅ warehouse_locations table exists');
    } else {
      console.log('❌ warehouse_locations table NOT FOUND');
      console.log('   You may need to create this table in Neon SQL Editor');
      pool.end();
      return;
    }

    // Test 2: Count total locations
    console.log('\n📊 Test 2: Count locations');
    console.log('-'.repeat(60));
    
    const countResult = await pool.query(
      'SELECT COUNT(*) as total FROM warehouse_locations'
    );
    console.log(`✅ Total locations in database: ${countResult.rows[0].total}`);

    // Test 3: Count active locations
    const activeCount = await pool.query(
      'SELECT COUNT(*) as total FROM warehouse_locations WHERE is_active = true'
    );
    console.log(`✅ Active locations: ${activeCount.rows[0].total}`);

    // Test 4: Get all locations
    console.log('\n📊 Test 3: Fetch all locations');
    console.log('-'.repeat(60));
    
    const result = await pool.query(`
      SELECT 
        location_id,
        location_code,
        location_name,
        location_type,
        is_active
      FROM warehouse_locations
      ORDER BY location_code
    `);

    if (result.rows.length === 0) {
      console.log('⚠️  No locations found in database');
      console.log('   You may need to populate warehouse_locations table');
    } else {
      console.log(`✅ Found ${result.rows.length} locations:\n`);
      
      result.rows.forEach((location, index) => {
        console.log(`${index + 1}. ${location.location_code} - ${location.location_name}`);
        console.log(`   Type: ${location.location_type}`);
        console.log(`   Active: ${location.is_active ? 'Yes' : 'No'}`);
        console.log(`   ID: ${location.location_id}`);
        console.log('');
      });
    }

    // Test 5: Show table structure
    console.log('\n📊 Test 4: Table structure');
    console.log('-'.repeat(60));
    
    const columnsResult = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'warehouse_locations'
      ORDER BY ordinal_position
    `);
    
    console.log('Columns in warehouse_locations table:');
    columnsResult.rows.forEach(col => {
      console.log(`  - ${col.column_name} (${col.data_type}) ${col.is_nullable === 'NO' ? 'NOT NULL' : 'NULLABLE'}`);
    });

  } catch (error) {
    console.error('\n❌ Database Error:', error.message);
    console.error('❌ Error details:', error);
  } finally {
    await pool.end();
    console.log('\n' + '='.repeat(60));
    console.log('Test complete\n');
  }
}

testLocations();
