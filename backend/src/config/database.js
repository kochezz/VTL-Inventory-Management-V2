// src/config/database.js
// Database configuration + Pool for Vilagio Inventory Management System

require("dotenv").config();
const { Pool } = require("pg");

/**
 * Database configuration object (kept from your original file)
 */
const config = {
  connection: {
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false, // Required for Neon PostgreSQL
    },
  },

  pool: {
    min: parseInt(process.env.DB_POOL_MIN) || 0,
    max: parseInt(process.env.DB_POOL_MAX) || 10,
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 30000,
  },

  query: {
    statement_timeout: 30000,
    idle_in_transaction_session_timeout: 10000,
  },

  alternative: {
    host: process.env.PGHOST,
    port: parseInt(process.env.PGPORT) || 5432,
    database: process.env.PGDATABASE,
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    ssl: { rejectUnauthorized: false },
  },

  app: {
    logQueries: process.env.NODE_ENV === "development",
    logErrors: true,
    retryConnection: true,
    maxRetries: 3,
    retryDelay: 1000,
  },
};

// ---- existing helper functions (kept) ----
function validateConfig() {
  const errors = [];
  const warnings = [];

  if (!process.env.DATABASE_URL && !process.env.PGHOST) {
    errors.push("Missing DATABASE_URL or PGHOST in environment variables");
  }
  if (!process.env.DATABASE_URL && !process.env.PGDATABASE) {
    errors.push("Missing PGDATABASE in environment variables");
  }
  if (!process.env.DATABASE_URL && !process.env.PGUSER) {
    errors.push("Missing PGUSER in environment variables");
  }
  if (!process.env.DATABASE_URL && !process.env.PGPASSWORD) {
    errors.push("Missing PGPASSWORD in environment variables");
  }

  if (config.pool.min > config.pool.max) {
    errors.push("DB_POOL_MIN cannot be greater than DB_POOL_MAX");
  }

  if (process.env.NODE_ENV === "production") {
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET.includes("change_this")) {
      warnings.push("JWT_SECRET should be changed in production");
    }
    if (config.app.logQueries) {
      warnings.push("Query logging is enabled in production (performance impact)");
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

function getConnectionString() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;

  const { host, port, database, user, password } = config.alternative;
  return `postgresql://${user}:${password}@${host}:${port}/${database}?sslmode=require`;
}

function getSummary() {
  return {
    database: process.env.PGDATABASE || "vilagio_inventory",
    host: process.env.PGHOST ? process.env.PGHOST.substring(0, 20) + "..." : "localhost",
    poolMin: config.pool.min,
    poolMax: config.pool.max,
    environment: process.env.NODE_ENV || "development",
  };
}

// Validate on load (same idea as your original)
const validation = validateConfig();
if (!validation.valid) {
  console.error("❌ Database configuration errors:");
  validation.errors.forEach((e) => console.error(`   - ${e}`));
  if (process.env.NODE_ENV === "production") {
    throw new Error("Invalid database configuration");
  }
}
if (validation.warnings.length) {
  console.warn("⚠️  Database configuration warnings:");
  validation.warnings.forEach((w) => console.warn(`   - ${w}`));
}

// ✅ REAL PG POOL EXPORT (this is what production-service needs)
const pool = new Pool({
  connectionString: getConnectionString(),
  ssl: { rejectUnauthorized: false },
  max: config.pool.max,
  min: config.pool.min,
  idleTimeoutMillis: config.pool.idleTimeoutMillis,
  connectionTimeoutMillis: config.pool.connectionTimeoutMillis,
});

// Non-fatal error handler — prevents Node.js from crashing on
// "Connection terminated unexpectedly" (Neon idle drop)
pool.on("error", (err) => {
  console.error("PG pool error (non-fatal):", err.message);
});

module.exports = {
  pool, // ✅ important
  config,
  validateConfig,
  getConnectionString,
  getSummary,
};
