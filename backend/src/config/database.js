// src/config/database.js
// Database configuration for Vilagio Inventory Management System
// Centralizes all database-related settings

require('dotenv').config();

/**
 * Database configuration object
 */
const config = {
  // Connection settings
  connection: {
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false // Required for Neon PostgreSQL
    }
  },

  // Connection pool settings
  pool: {
    min: parseInt(process.env.DB_POOL_MIN) || 2,
    max: parseInt(process.env.DB_POOL_MAX) || 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  },

  // Query settings
  query: {
    // Maximum query execution time (30 seconds)
    statement_timeout: 30000,
    
    // Idle in transaction timeout (10 seconds)
    idle_in_transaction_session_timeout: 10000,
  },

  // Alternative connection parameters (if not using DATABASE_URL)
  alternative: {
    host: process.env.PGHOST,
    port: parseInt(process.env.PGPORT) || 5432,
    database: process.env.PGDATABASE,
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    ssl: {
      rejectUnauthorized: false
    }
  },

  // Application settings
  app: {
    // Enable query logging in development
    logQueries: process.env.NODE_ENV === 'development',
    
    // Enable detailed error logging
    logErrors: true,
    
    // Retry failed connections
    retryConnection: true,
    maxRetries: 3,
    retryDelay: 1000, // milliseconds
  },

  // Transaction settings
  transaction: {
    // Default transaction isolation level
    // Options: 'READ UNCOMMITTED', 'READ COMMITTED', 'REPEATABLE READ', 'SERIALIZABLE'
    isolationLevel: 'READ COMMITTED',
    
    // Transaction timeout (seconds)
    timeout: 30,
  },

  // Database feature flags
  features: {
    // Enable batch tracking
    batchTracking: process.env.ENABLE_BATCH_TRACKING !== 'false',
    
    // Enable barcode scanning
    barcodeScanning: process.env.ENABLE_BARCODE_SCANNING !== 'false',
    
    // Enable production orders
    productionOrders: process.env.ENABLE_PRODUCTION_ORDERS !== 'false',
    
    // Enable audit logging
    auditLog: process.env.ENABLE_AUDIT_LOG !== 'false',
  },

  // Alert configuration
  alerts: {
    // Enable low stock alerts
    lowStockEnabled: process.env.ENABLE_LOW_STOCK_ALERTS !== 'false',
    
    // Enable expiry alerts
    expiryEnabled: process.env.ENABLE_EXPIRY_ALERTS !== 'false',
    
    // Check intervals (in minutes)
    lowStockCheckInterval: parseInt(process.env.LOW_STOCK_CHECK_INTERVAL) || 60,
    expiryCheckInterval: parseInt(process.env.EXPIRY_CHECK_INTERVAL) || 1440, // 24 hours
    
    // Alert thresholds
    lowStockThreshold: 0.2, // Alert when stock is 20% of reorder point
    expiryWarningDays: 30, // Alert 30 days before expiry
  },
};

/**
 * Validate configuration
 * @returns {Object} Validation result
 */
function validateConfig() {
  const errors = [];
  const warnings = [];

  // Check required environment variables
  if (!process.env.DATABASE_URL && !process.env.PGHOST) {
    errors.push('Missing DATABASE_URL or PGHOST in environment variables');
  }

  if (!process.env.DATABASE_URL && !process.env.PGDATABASE) {
    errors.push('Missing PGDATABASE in environment variables');
  }

  if (!process.env.DATABASE_URL && !process.env.PGUSER) {
    errors.push('Missing PGUSER in environment variables');
  }

  if (!process.env.DATABASE_URL && !process.env.PGPASSWORD) {
    errors.push('Missing PGPASSWORD in environment variables');
  }

  // Check pool settings
  if (config.pool.min > config.pool.max) {
    errors.push('DB_POOL_MIN cannot be greater than DB_POOL_MAX');
  }

  // Warnings for development
  if (process.env.NODE_ENV === 'production') {
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'your-super-secret-jwt-key-change-this-in-production') {
      warnings.push('JWT_SECRET should be changed in production');
    }

    if (config.app.logQueries) {
      warnings.push('Query logging is enabled in production (performance impact)');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Get connection string
 * @returns {string} Database connection string
 */
function getConnectionString() {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }

  const { host, port, database, user, password } = config.alternative;
  return `postgresql://${user}:${password}@${host}:${port}/${database}?sslmode=require`;
}

/**
 * Print configuration summary (safe for logging)
 * @returns {Object} Safe configuration summary
 */
function getSummary() {
  return {
    database: process.env.PGDATABASE || 'vilagio_inventory',
    host: process.env.PGHOST ? process.env.PGHOST.substring(0, 20) + '...' : 'localhost',
    poolMin: config.pool.min,
    poolMax: config.pool.max,
    features: config.features,
    alerts: {
      lowStock: config.alerts.lowStockEnabled,
      expiry: config.alerts.expiryEnabled,
    },
    environment: process.env.NODE_ENV || 'development',
  };
}

// Validate configuration on load
const validation = validateConfig();
if (!validation.valid) {
  console.error('❌ Database configuration errors:');
  validation.errors.forEach(error => console.error(`   - ${error}`));
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Invalid database configuration');
  }
}

if (validation.warnings.length > 0) {
  console.warn('⚠️  Database configuration warnings:');
  validation.warnings.forEach(warning => console.warn(`   - ${warning}`));
}

// Export configuration
module.exports = {
  config,
  validateConfig,
  getConnectionString,
  getSummary,
};

// If run directly, print configuration summary
if (require.main === module) {
  console.log('📊 Database Configuration Summary:');
  console.log(JSON.stringify(getSummary(), null, 2));
  
  const validation = validateConfig();
  console.log('\n✅ Configuration validation:', validation.valid ? 'PASSED' : 'FAILED');
  
  if (validation.errors.length > 0) {
    console.log('\n❌ Errors:');
    validation.errors.forEach(error => console.log(`   - ${error}`));
  }
  
  if (validation.warnings.length > 0) {
    console.log('\n⚠️  Warnings:');
    validation.warnings.forEach(warning => console.log(`   - ${warning}`));
  }
}
