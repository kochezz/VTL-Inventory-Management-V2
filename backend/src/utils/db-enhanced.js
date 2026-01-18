// src/utils/db-enhanced.js
// Enhanced Database Connection with Resilience and Monitoring
// Adds retry logic, connection pooling, and health monitoring to database operations

const { Pool } = require('pg');
const { handleDatabaseError, retryWithBackoff, DatabaseError } = require('./error-handler');

// Connection configuration
const connectionConfig = {
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 20, // Maximum number of connections in pool
  idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
  connectionTimeoutMillis: 10000, // Return error after 10 seconds if connection cannot be established
  maxUses: 7500, // Close connections after 7500 uses
  application_name: 'vilagio_inventory_backend',
};

// Create connection pool
const pool = new Pool(connectionConfig);

// Connection pool event handlers
pool.on('connect', (client) => {
  console.log('✅ New database client connected');
});

pool.on('acquire', () => {
  // Client acquired from pool
});

pool.on('remove', () => {
  console.log('🔌 Client removed from pool');
});

pool.on('error', (err, client) => {
  console.error('❌ Unexpected database pool error:', err);
  // Don't exit - let the pool handle reconnection
});

/**
 * Execute a query with automatic retry and error handling
 */
async function query(text, params = []) {
  return retryWithBackoff(async () => {
    try {
      const start = Date.now();
      const result = await pool.query(text, params);
      const duration = Date.now() - start;
      
      // Log slow queries (> 1 second)
      if (duration > 1000) {
        console.warn(`⚠️ Slow query detected (${duration}ms):`, {
          query: text.substring(0, 100),
          duration: `${duration}ms`,
        });
      }
      
      return result;
    } catch (error) {
      throw handleDatabaseError(error, 'query');
    }
  }, 3, 500);
}

/**
 * Execute a transaction with automatic rollback on error
 */
async function transaction(callback) {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Transaction rolled back:', error.message);
    throw handleDatabaseError(error, 'transaction');
  } finally {
    client.release();
  }
}

/**
 * Execute a batch operation with transaction support
 */
async function batchQuery(queries) {
  return transaction(async (client) => {
    const results = [];
    
    for (const { text, params } of queries) {
      const result = await client.query(text, params);
      results.push(result);
    }
    
    return results;
  });
}

/**
 * Get connection pool statistics
 */
function getPoolStats() {
  return {
    total: pool.totalCount,
    idle: pool.idleCount,
    waiting: pool.waitingCount,
    max: connectionConfig.max,
  };
}

/**
 * Check database health
 */
async function healthCheck() {
  try {
    const start = Date.now();
    const result = await query('SELECT NOW() as now, version() as version');
    const duration = Date.now() - start;
    
    const poolStats = getPoolStats();
    
    return {
      status: 'healthy',
      timestamp: result.rows[0].now,
      response_time_ms: duration,
      database_version: result.rows[0].version.split(' ')[1],
      connection_pool: {
        total: poolStats.total,
        idle: poolStats.idle,
        waiting: poolStats.waiting,
        max: poolStats.max,
        utilization_percent: Math.round((poolStats.total / poolStats.max) * 100),
      },
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date(),
    };
  }
}

/**
 * Test database connection
 */
async function testConnection() {
  try {
    const health = await healthCheck();
    if (health.status === 'healthy') {
      console.log('✅ Database connection healthy');
      console.log('   Response time:', health.response_time_ms, 'ms');
      console.log('   Pool utilization:', health.connection_pool.utilization_percent + '%');
      return true;
    } else {
      console.error('❌ Database connection unhealthy:', health.error);
      return false;
    }
  } catch (error) {
    console.error('❌ Database connection test failed:', error.message);
    return false;
  }
}

/**
 * Close all connections and end pool
 */
async function closePool() {
  try {
    await pool.end();
    console.log('👋 Database pool closed');
  } catch (error) {
    console.error('❌ Error closing pool:', error.message);
  }
}

/**
 * Execute query with timeout
 */
async function queryWithTimeout(text, params = [], timeoutMs = 30000) {
  return Promise.race([
    query(text, params),
    new Promise((_, reject) =>
      setTimeout(
        () => reject(new DatabaseError('Query timeout exceeded', { timeout: timeoutMs })),
        timeoutMs
      )
    ),
  ]);
}

/**
 * Get active connections count
 */
async function getActiveConnections() {
  try {
    const result = await query(
      `SELECT COUNT(*) as count 
       FROM pg_stat_activity 
       WHERE datname = current_database() 
       AND state = 'active'`
    );
    return parseInt(result.rows[0].count);
  } catch (error) {
    console.error('Error getting active connections:', error.message);
    return -1;
  }
}

/**
 * Get database size
 */
async function getDatabaseSize() {
  try {
    const result = await query(
      `SELECT pg_size_pretty(pg_database_size(current_database())) as size`
    );
    return result.rows[0].size;
  } catch (error) {
    console.error('Error getting database size:', error.message);
    return 'Unknown';
  }
}

/**
 * Get table sizes
 */
async function getTableSizes() {
  try {
    const result = await query(`
      SELECT 
        schemaname,
        tablename,
        pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size,
        pg_total_relation_size(schemaname||'.'||tablename) AS size_bytes
      FROM pg_tables
      WHERE schemaname = 'public'
      ORDER BY size_bytes DESC
      LIMIT 10
    `);
    return result.rows;
  } catch (error) {
    console.error('Error getting table sizes:', error.message);
    return [];
  }
}

/**
 * Vacuum analyze database (maintenance)
 */
async function vacuumAnalyze() {
  try {
    console.log('🧹 Running VACUUM ANALYZE...');
    await query('VACUUM ANALYZE');
    console.log('✅ VACUUM ANALYZE completed');
    return true;
  } catch (error) {
    console.error('❌ VACUUM ANALYZE failed:', error.message);
    return false;
  }
}

/**
 * Get connection pool metrics for monitoring
 */
function getDetailedPoolMetrics() {
  const stats = getPoolStats();
  
  return {
    pool_size: {
      total: stats.total,
      idle: stats.idle,
      active: stats.total - stats.idle,
      waiting: stats.waiting,
      max: stats.max,
    },
    utilization: {
      percent: Math.round((stats.total / stats.max) * 100),
      is_overloaded: stats.waiting > 0,
      available_connections: stats.max - stats.total,
    },
    health: {
      status: stats.waiting > 5 ? 'degraded' : 'healthy',
      warning: stats.waiting > 0 ? 'Connection pool under pressure' : null,
    },
  };
}

/**
 * Check if database is ready to accept connections
 */
async function isDatabaseReady() {
  try {
    await query('SELECT 1');
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Wait for database to be ready (useful for startup)
 */
async function waitForDatabase(maxAttempts = 30, delayMs = 2000) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (await isDatabaseReady()) {
      console.log(`✅ Database ready after ${attempt} attempt(s)`);
      return true;
    }
    
    console.log(`⏳ Waiting for database... (attempt ${attempt}/${maxAttempts})`);
    await new Promise(resolve => setTimeout(resolve, delayMs));
  }
  
  throw new DatabaseError('Database failed to become ready');
}

module.exports = {
  // Core database operations
  query,
  transaction,
  batchQuery,
  queryWithTimeout,
  
  // Connection management
  pool,
  closePool,
  testConnection,
  waitForDatabase,
  isDatabaseReady,
  
  // Monitoring
  healthCheck,
  getPoolStats,
  getDetailedPoolMetrics,
  getActiveConnections,
  getDatabaseSize,
  getTableSizes,
  
  // Maintenance
  vacuumAnalyze,
};
