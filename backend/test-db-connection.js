require('dotenv').config();
const { Pool } = require('pg');

console.log('🔍 Testing Database Connection...\n');

// Check if DATABASE_URL exists
if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL not found in .env file');
  console.log('\nMake sure your .env file has:');
  console.log('DATABASE_URL=postgresql://user:pass@host/database?sslmode=require\n');
  process.exit(1);
}

// Show partial URL (hide password)
const urlParts = process.env.DATABASE_URL.split('@');
if (urlParts.length > 1) {
  const beforeAt = urlParts[0].split(':')[0] + ':****';
  const afterAt = urlParts[1];
  console.log('📍 Database URL: ' + beforeAt + '@' + afterAt);
} else {
  console.log('📍 Database URL format seems incorrect');
}

// Create pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Test connection
async function testConnection() {
  try {
    console.log('\n⏳ Connecting to database...');
    
    const client = await pool.connect();
    console.log('✅ Connected to database successfully!\n');
    
    // Test query
    console.log('⏳ Running test query...');
    const result = await client.query('SELECT NOW() as time, current_database() as db, current_user as user');
    console.log('✅ Query successful!\n');
    
    console.log('📊 Connection Details:');
    console.log('   Time:', result.rows[0].time);
    console.log('   Database:', result.rows[0].db);
    console.log('   User:', result.rows[0].user);
    
    // Check if users table exists
    console.log('\n⏳ Checking if users table exists...');
    const tableCheck = await client.query(
      "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'users')"
    );
    
    if (tableCheck.rows[0].exists) {
      console.log('✅ Users table exists');
      
      // Count users
      const userCount = await client.query('SELECT COUNT(*) FROM users');
      console.log(`✅ Found ${userCount.rows[0].count} users in database`);
      
      // Check for admin user
      const adminCheck = await client.query("SELECT email, full_name, role FROM users WHERE email = 'admin@vilag.io'");
      if (adminCheck.rows.length > 0) {
        console.log('✅ Admin user found:', adminCheck.rows[0].full_name, '(' + adminCheck.rows[0].role + ')');
      } else {
        console.log('⚠️  Admin user (admin@vilag.io) not found');
      }
    } else {
      console.log('❌ Users table does NOT exist - database schema may not be set up');
    }
    
    client.release();
    
    console.log('\n🎉 All database tests passed!\n');
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ Database Connection Error:');
    console.error('   Message:', error.message);
    
    if (error.message.includes('password authentication failed')) {
      console.log('\n💡 Solution: Check your password in DATABASE_URL');
    } else if (error.message.includes('getaddrinfo ENOTFOUND')) {
      console.log('\n💡 Solution: Check your database host URL');
    } else if (error.message.includes('does not exist')) {
      console.log('\n💡 Solution: Check your database name');
    } else {
      console.log('\n💡 Solution: Verify your complete DATABASE_URL in .env');
    }
    
    console.log('\nExpected format:');
    console.log('DATABASE_URL=postgresql://user:password@host.neon.tech/dbname?sslmode=require\n');
    
    process.exit(1);
  }
}

testConnection();
