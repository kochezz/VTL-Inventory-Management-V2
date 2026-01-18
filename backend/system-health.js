// system-health.js
// System Health Monitoring and Diagnostics Tool
// Provides comprehensive system status overview

require('dotenv').config();
const db = require('./src/utils/db');

/**
 * Get system overview
 */
async function getSystemOverview() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║       VILAGIO INVENTORY SYSTEM - HEALTH DASHBOARD         ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');
  
  const timestamp = new Date().toISOString();
  console.log(`Report Generated: ${timestamp}\n`);
}

/**
 * Database connectivity and version
 */
async function checkDatabaseConnection() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('DATABASE CONNECTION');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  try {
    const start = Date.now();
    const result = await db.query('SELECT NOW() as now, version() as version, current_database() as database');
    const duration = Date.now() - start;
    
    const info = result.rows[0];
    const version = info.version.split(' ');
    
    console.log('Status:            ✅ CONNECTED');
    console.log(`Database Name:     ${info.database}`);
    console.log(`PostgreSQL:        ${version[0]} ${version[1]}`);
    console.log(`Response Time:     ${duration}ms`);
    console.log(`Timestamp:         ${info.now}`);
    
    return true;
  } catch (error) {
    console.log('Status:            ❌ DISCONNECTED');
    console.log(`Error:             ${error.message}`);
    return false;
  }
}

/**
 * Database size and growth
 */
async function checkDatabaseSize() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('DATABASE SIZE');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  try {
    // Overall database size
    const sizeResult = await db.query(
      "SELECT pg_size_pretty(pg_database_size(current_database())) as size"
    );
    console.log(`Total Size:        ${sizeResult.rows[0].size}`);
    
    // Table sizes
    const tableSizes = await db.query(`
      SELECT 
        tablename,
        pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size,
        pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) AS data_size,
        pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename) - pg_relation_size(schemaname||'.'||tablename)) AS index_size
      FROM pg_tables
      WHERE schemaname = 'public'
      ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
      LIMIT 10
    `);
    
    console.log('\nTop 10 Tables by Size:');
    console.log('┌─────────────────────────────┬──────────┬───────────┬────────────┐');
    console.log('│ Table Name                  │ Total    │ Data      │ Indexes    │');
    console.log('├─────────────────────────────┼──────────┼───────────┼────────────┤');
    tableSizes.rows.forEach(row => {
      console.log(`│ ${row.tablename.padEnd(27)} │ ${row.size.padEnd(8)} │ ${row.data_size.padEnd(9)} │ ${row.index_size.padEnd(10)} │`);
    });
    console.log('└─────────────────────────────┴──────────┴───────────┴────────────┘');
    
  } catch (error) {
    console.log(`Error: ${error.message}`);
  }
}

/**
 * Record counts
 */
async function checkRecordCounts() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('RECORD COUNTS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  try {
    const tables = [
      'products',
      'product_categories',
      'inventory',
      'batches',
      'inventory_transactions',
      'warehouse_locations',
      'suppliers',
      'users'
    ];
    
    console.log('┌─────────────────────────────┬──────────────┐');
    console.log('│ Table                       │ Row Count    │');
    console.log('├─────────────────────────────┼──────────────┤');
    
    for (const table of tables) {
      try {
        const result = await db.query(`SELECT COUNT(*) as count FROM ${table}`);
        const count = parseInt(result.rows[0].count).toLocaleString();
        console.log(`│ ${table.padEnd(27)} │ ${count.padStart(12)} │`);
      } catch (error) {
        console.log(`│ ${table.padEnd(27)} │ N/A          │`);
      }
    }
    
    console.log('└─────────────────────────────┴──────────────┘');
    
  } catch (error) {
    console.log(`Error: ${error.message}`);
  }
}

/**
 * Connection pool status
 */
async function checkConnectionPool() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('CONNECTION POOL');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  try {
    const result = await db.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE state = 'active') as active,
        COUNT(*) FILTER (WHERE state = 'idle') as idle
      FROM pg_stat_activity 
      WHERE datname = current_database()
    `);
    
    const stats = result.rows[0];
    const maxConnections = 100; // Default PostgreSQL setting
    const utilization = (parseInt(stats.total) / maxConnections * 100).toFixed(1);
    
    console.log(`Total Connections:    ${stats.total}`);
    console.log(`Active Connections:   ${stats.active}`);
    console.log(`Idle Connections:     ${stats.idle}`);
    console.log(`Max Connections:      ${maxConnections}`);
    console.log(`Utilization:          ${utilization}%`);
    
    if (utilization > 80) {
      console.log('\n⚠️  WARNING: High connection pool utilization');
    } else if (utilization > 50) {
      console.log('\n⚡ Connection pool usage moderate');
    } else {
      console.log('\n✅ Connection pool usage healthy');
    }
    
  } catch (error) {
    console.log(`Error: ${error.message}`);
  }
}

/**
 * Inventory statistics
 */
async function checkInventoryStats() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('INVENTORY STATISTICS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  try {
    // Total inventory value
    const valueResult = await db.query(`
      SELECT 
        SUM(i.quantity_on_hand * COALESCE(p.standard_cost, 0)) as total_value
      FROM inventory i
      JOIN products p ON i.product_id = p.product_id
    `);
    const totalValue = parseFloat(valueResult.rows[0].total_value || 0);
    
    // Stock status breakdown
    const statusResult = await db.query(`
      SELECT 
        COUNT(*) FILTER (WHERE i.quantity_on_hand <= p.minimum_stock_level) as critical,
        COUNT(*) FILTER (WHERE i.quantity_on_hand > p.minimum_stock_level AND i.quantity_on_hand <= p.reorder_point) as low,
        COUNT(*) FILTER (WHERE i.quantity_on_hand > p.reorder_point) as ok,
        COUNT(*) as total
      FROM inventory i
      JOIN products p ON i.product_id = p.product_id
    `);
    const status = statusResult.rows[0];
    
    // Active batches
    const batchResult = await db.query(
      "SELECT COUNT(*) as count FROM batches WHERE status = 'active'"
    );
    const activeBatches = parseInt(batchResult.rows[0].count);
    
    // Batches by QC status
    const qcResult = await db.query(`
      SELECT 
        qc_status,
        COUNT(*) as count
      FROM batches
      WHERE status = 'active'
      GROUP BY qc_status
      ORDER BY qc_status
    `);
    
    console.log(`Total Inventory Value:    $${totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
    console.log(`\nInventory Items:`);
    console.log(`  Total Items:            ${status.total}`);
    console.log(`  Critical (Below Min):   ${status.critical} ${status.critical > 0 ? '⚠️' : '✅'}`);
    console.log(`  Low (Below Reorder):    ${status.low} ${status.low > 0 ? '⚡' : '✅'}`);
    console.log(`  OK (Above Reorder):     ${status.ok} ✅`);
    
    console.log(`\nActive Batches:           ${activeBatches}`);
    if (qcResult.rows.length > 0) {
      console.log('  By QC Status:');
      qcResult.rows.forEach(row => {
        const icon = row.qc_status === 'approved' ? '✅' : 
                     row.qc_status === 'pending' ? '⏳' :
                     row.qc_status === 'rejected' ? '❌' : '⚠️';
        console.log(`    ${row.qc_status.padEnd(15)} ${row.count.toString().padStart(4)} ${icon}`);
      });
    }
    
  } catch (error) {
    console.log(`Error: ${error.message}`);
  }
}

/**
 * Recent activity
 */
async function checkRecentActivity() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('RECENT ACTIVITY (Last 7 Days)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  try {
    const result = await db.query(`
      SELECT 
        transaction_type,
        COUNT(*) as count,
        SUM(quantity) as total_quantity
      FROM inventory_transactions
      WHERE transaction_date >= CURRENT_DATE - INTERVAL '7 days'
      GROUP BY transaction_type
      ORDER BY transaction_type
    `);
    
    if (result.rows.length === 0) {
      console.log('No transactions in the last 7 days');
    } else {
      console.log('┌─────────────────┬────────┬─────────────────┐');
      console.log('│ Transaction     │ Count  │ Total Quantity  │');
      console.log('├─────────────────┼────────┼─────────────────┤');
      result.rows.forEach(row => {
        const qty = parseFloat(row.total_quantity || 0).toLocaleString();
        console.log(`│ ${row.transaction_type.padEnd(15)} │ ${row.count.toString().padStart(6)} │ ${qty.padStart(15)} │`);
      });
      console.log('└─────────────────┴────────┴─────────────────┘');
    }
    
  } catch (error) {
    console.log(`Error: ${error.message}`);
  }
}

/**
 * System recommendations
 */
async function provideRecommendations() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('RECOMMENDATIONS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  const recommendations = [];
  
  try {
    // Check for critical stock
    const criticalStock = await db.query(`
      SELECT COUNT(*) as count
      FROM inventory i
      JOIN products p ON i.product_id = p.product_id
      WHERE i.quantity_on_hand <= p.minimum_stock_level
    `);
    
    if (parseInt(criticalStock.rows[0].count) > 0) {
      recommendations.push({
        priority: 'HIGH',
        message: `${criticalStock.rows[0].count} items at critical stock levels - immediate reorder required`
      });
    }
    
    // Check for expiring batches
    const expiringBatches = await db.query(`
      SELECT COUNT(*) as count
      FROM batches
      WHERE expiry_date IS NOT NULL
        AND expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days'
        AND status = 'active'
    `);
    
    if (parseInt(expiringBatches.rows[0].count) > 0) {
      recommendations.push({
        priority: 'MEDIUM',
        message: `${expiringBatches.rows[0].count} batches expiring in next 30 days - prioritize usage`
      });
    }
    
    // Check for pending QC batches
    const pendingQC = await db.query(`
      SELECT COUNT(*) as count
      FROM batches
      WHERE qc_status = 'pending'
        AND status = 'active'
    `);
    
    if (parseInt(pendingQC.rows[0].count) > 0) {
      recommendations.push({
        priority: 'MEDIUM',
        message: `${pendingQC.rows[0].count} batches pending QC approval`
      });
    }
    
    // Check database size
    const dbSize = await db.query(
      "SELECT pg_database_size(current_database()) as size"
    );
    const sizeGB = parseInt(dbSize.rows[0].size) / (1024 * 1024 * 1024);
    
    if (sizeGB > 5) {
      recommendations.push({
        priority: 'LOW',
        message: `Database size is ${sizeGB.toFixed(2)}GB - consider archiving old transactions`
      });
    }
    
    if (recommendations.length === 0) {
      console.log('✅ No critical recommendations at this time');
      console.log('   System is operating within normal parameters');
    } else {
      recommendations.forEach((rec, index) => {
        const icon = rec.priority === 'HIGH' ? '🔴' :
                     rec.priority === 'MEDIUM' ? '🟡' : '🟢';
        console.log(`${icon} [${rec.priority}] ${rec.message}`);
      });
    }
    
  } catch (error) {
    console.log(`Error generating recommendations: ${error.message}`);
  }
}

/**
 * Main health check runner
 */
async function runHealthCheck() {
  try {
    await getSystemOverview();
    
    const connected = await checkDatabaseConnection();
    if (!connected) {
      console.log('\n❌ Cannot proceed with health check - database not connected\n');
      process.exit(1);
    }
    
    await checkDatabaseSize();
    await checkRecordCounts();
    await checkConnectionPool();
    await checkInventoryStats();
    await checkRecentActivity();
    await provideRecommendations();
    
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Health check completed successfully');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
  } catch (error) {
    console.error('\n❌ Health check error:', error.message);
    process.exit(1);
  } finally {
    await db.closePool();
  }
}

// Run health check
runHealthCheck();
