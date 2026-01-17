// src/utils/db.js
// Database connection utility using PostgreSQL
// Uses connection pooling for better performance
// Now uses centralized config from src/config/database.js

const { Pool } = require('pg');
const { config, getConnectionString, getSummary } = require('../config/database');

// Create connection pool using centralized configuration
const pool = new Pool({
  connectionString: getConnectionString(),
  ssl: config.connection.ssl,
  max: config.pool.max,
  min: config.pool.min,
  idleTimeoutMillis: config.pool.idleTimeoutMillis,
  connectionTimeoutMillis: config.pool.connectionTimeoutMillis,
  // Apply query settings
  statement_timeout: config.query.statement_timeout,
  idle_in_transaction_session_timeout: config.query.idle_in_transaction_session_timeout,
});

// Log pool events if configured
if (config.app.logQueries) {
  pool.on('connect', (client) => {
    console.log('🔌 New database connection established');
  });

  pool.on('acquire', () => {
    console.log('📤 Client acquired from pool');
  });

  pool.on('remove', () => {
    console.log('📥 Client removed from pool');
  });
}

pool.on('error', (err, client) => {
  console.error('❌ Unexpected database error:', err);
  if (config.app.logErrors) {
    console.error('   Client:', client ? 'Active' : 'No client');
    console.error('   Error details:', err.stack);
  }
});

/**
 * Execute a query with parameters
 * @param {string} text - SQL query
 * @param {Array} params - Query parameters
 * @returns {Promise<Object>} Query result
 */
const query = async (text, params) => {
  const start = Date.now();
  
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    
    if (config.app.logQueries) {
      console.log('✅ Query executed:', {
        query: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
        duration: `${duration}ms`,
        rows: result.rowCount
      });
    }
    
    return result;
  } catch (error) {
    const duration = Date.now() - start;
    
    if (config.app.logErrors) {
      console.error('❌ Database query error:', {
        query: text.substring(0, 100),
        duration: `${duration}ms`,
        error: error.message
      });
    }
    
    throw error;
  }
};

/**
 * Get a client from the pool for transactions
 * @returns {Promise<Object>} Database client
 */
const getClient = async () => {
  const client = await pool.connect();
  const query = client.query;
  const release = client.release;
  
  // Set a timeout to detect clients checked out for too long
  const timeout = setTimeout(() => {
    console.error('⚠️  A client has been checked out for more than 5 seconds!');
    if (client.lastQuery) {
      console.error('   Last query:', client.lastQuery[0].substring(0, 100));
    }
  }, 5000);
  
  // Track last query for debugging
  client.query = (...args) => {
    client.lastQuery = args;
    return query.apply(client, args);
  };
  
  client.release = () => {
    clearTimeout(timeout);
    client.query = query;
    client.release = release;
    return release.apply(client);
  };
  
  return client;
};

/**
 * Execute multiple queries in a transaction
 * @param {Function} callback - Function containing queries to execute
 * @param {string} isolationLevel - Transaction isolation level
 * @returns {Promise<any>} Result of the callback
 */
const transaction = async (callback, isolationLevel = config.transaction.isolationLevel) => {
  const client = await getClient();
  
  try {
    // Begin transaction with specified isolation level
    await client.query(`BEGIN ISOLATION LEVEL ${isolationLevel}`);
    
    // Set transaction timeout
    await client.query(`SET LOCAL statement_timeout = '${config.transaction.timeout}s'`);
    
    const result = await callback(client);
    
    await client.query('COMMIT');
    
    if (config.app.logQueries) {
      console.log('✅ Transaction committed successfully');
    }
    
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    
    if (config.app.logErrors) {
      console.error('❌ Transaction rolled back:', error.message);
    }
    
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Test database connection with retry logic
 * @param {number} retries - Number of retry attempts
 * @returns {Promise<boolean>} True if connection successful
 */
const testConnection = async (retries = config.app.maxRetries) => {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const result = await query(
        'SELECT NOW() as now, current_database() as database, version() as version'
      );
      
      console.log('✅ Database connection test successful');
      console.log('   Database:', result.rows[0].database);
      console.log('   Server time:', result.rows[0].now);
      console.log('   PostgreSQL version:', result.rows[0].version.split(',')[0]);
      
      // Print pool status
      console.log('\n📊 Connection Pool Status:');
      console.log('   Total connections:', pool.totalCount);
      console.log('   Idle connections:', pool.idleCount);
      console.log('   Waiting requests:', pool.waitingCount);
      
      return true;
    } catch (error) {
      console.error(`❌ Database connection test failed (attempt ${attempt}/${retries}):`, error.message);
      
      if (attempt < retries && config.app.retryConnection) {
        console.log(`   Retrying in ${config.app.retryDelay}ms...`);
        await new Promise(resolve => setTimeout(resolve, config.app.retryDelay));
      } else {
        console.error('\n💡 Troubleshooting tips:');
        console.error('   1. Check DATABASE_URL in .env file');
        console.error('   2. Verify database is running');
        console.error('   3. Check network connectivity');
        console.error('   4. Verify SSL settings for Neon');
        return false;
      }
    }
  }
  
  return false;
};

/**
 * Get current pool statistics
 * @returns {Object} Pool statistics
 */
const getPoolStats = () => {
  return {
    totalCount: pool.totalCount,
    idleCount: pool.idleCount,
    waitingCount: pool.waitingCount,
    config: {
      max: config.pool.max,
      min: config.pool.min,
    }
  };
};

/**
 * Check database health
 * @returns {Promise<Object>} Health check result
 */
const healthCheck = async () => {
  try {
    const start = Date.now();
    await query('SELECT 1');
    const latency = Date.now() - start;
    
    return {
      status: 'healthy',
      latency: `${latency}ms`,
      pool: getPoolStats(),
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString(),
    };
  }
};

/**
 * Close all connections in the pool
 * @returns {Promise<void>}
 */
const closePool = async () => {
  await pool.end();
  console.log('🔌 Database pool closed');
};

/**
 * Graceful shutdown handler
 */
const gracefulShutdown = async () => {
  console.log('\n🛑 Graceful shutdown initiated...');
  await closePool();
  console.log('✅ All database connections closed');
  process.exit(0);
};

// Register shutdown handlers
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// Export pool and utility functions
module.exports = {
  query,
  getClient,
  transaction,
  testConnection,
  healthCheck,
  getPoolStats,
  closePool,
  pool
};

// If run directly, test the connection and show config
if (require.main === module) {
  console.log('🚀 Testing database connection...\n');
  
  // Show configuration summary
  console.log('📊 Configuration:');
  console.log(JSON.stringify(getSummary(), null, 2));
  console.log('');
  
  // Test connection
  testConnection()
    .then(async (success) => {
      if (success) {
        // Run health check
        console.log('\n🏥 Health Check:');
        const health = await healthCheck();
        console.log(JSON.stringify(health, null, 2));
      }
      
      await closePool();
      process.exit(success ? 0 : 1);
    })
    .catch((error) => {
      console.error('❌ Connection test failed:', error);
      process.exit(1);
    });
}
