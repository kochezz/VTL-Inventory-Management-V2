// create-admin.js
// Script to create admin user in Vilagio Inventory System
// Run this from your backend folder: node create-admin.js

require('dotenv').config();
const bcrypt = require('bcrypt');
const { Client } = require('pg');

async function createAdminUser() {
  console.log('\n🔐 Creating Admin User for Vilagio Inventory System\n');
  
  // Get database connection from environment
  const connectionString = process.env.DATABASE_URL;
  
  if (!connectionString) {
    console.error('❌ ERROR: DATABASE_URL not found in .env file');
    console.log('   Add this to your .env file:');
    console.log('   DATABASE_URL=your-neon-connection-string');
    process.exit(1);
  }
  
  const client = new Client({ connectionString });
  
  try {
    // Connect to database
    console.log('📡 Connecting to database...');
    await client.connect();
    console.log('✅ Connected!\n');
    
    // Check if admin already exists
    console.log('🔍 Checking if admin user exists...');
    const checkResult = await client.query(
      'SELECT email FROM users WHERE email = $1',
      ['admin@vilag.io']
    );
    
    if (checkResult.rows.length > 0) {
      console.log('⚠️  Admin user already exists: admin@vilag.io');
      console.log('   If you need to reset the password, delete the user first or use the change password feature.\n');
      await client.end();
      return;
    }
    
    // Generate password hash
    console.log('🔐 Generating secure password hash...');
    const password = 'Admin@123';
    const passwordHash = await bcrypt.hash(password, 10);
    console.log('✅ Password hashed!\n');
    
    // Create admin user
    console.log('👤 Creating admin user...');
    const insertResult = await client.query(
      `INSERT INTO users (email, password_hash, full_name, role, is_active, is_verified)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING email, full_name, role`,
      ['admin@vilag.io', passwordHash, 'System Administrator', 'admin', true, true]
    );
    
    const user = insertResult.rows[0];
    
    console.log('✅ Admin user created successfully!\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📧 Email:    admin@vilag.io');
    console.log('🔑 Password: Admin@123');
    console.log('👤 Name:     System Administrator');
    console.log('🎭 Role:     admin');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\n⚠️  IMPORTANT: Change this password immediately after first login!\n');
    
  } catch (error) {
    console.error('❌ Error creating admin user:', error.message);
    
    if (error.code === '23503') {
      console.log('\n💡 This error usually means the "roles" table is missing or empty.');
      console.log('   Run auth-missing-tables.sql first to create the roles table.');
    } else if (error.code === '42703') {
      console.log('\n💡 This error means the users table is missing some columns.');
      console.log('   You may need to run the full auth-schema.sql file.');
    }
    
  } finally {
    await client.end();
    console.log('🔌 Database connection closed.\n');
  }
}

// Run the script
createAdminUser();
