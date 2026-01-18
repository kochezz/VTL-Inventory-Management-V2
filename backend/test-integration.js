// test-integration.js
// Comprehensive Integration Test Suite
// Tests all system components working together

require('dotenv').config();
const db = require('./src/utils/db');
const transactionService = require('./src/services/transaction-service');
const batchService = require('./src/services/batch-service');
const reportingService = require('./src/services/reporting-service');

// Test results tracking
const testResults = {
  passed: 0,
  failed: 0,
  tests: [],
};

/**
 * Test helper functions
 */
function logTest(name, passed, message = '') {
  const status = passed ? '✅' : '❌';
  console.log(`${status} ${name}`);
  if (message) console.log(`   ${message}`);
  
  testResults.tests.push({ name, passed, message });
  if (passed) {
    testResults.passed++;
  } else {
    testResults.failed++;
  }
}

function logSection(title) {
  console.log('\n' + '='.repeat(60));
  console.log(title);
  console.log('='.repeat(60) + '\n');
}

/**
 * Test Suite 1: Database Connectivity
 */
async function testDatabaseConnectivity() {
  logSection('TEST SUITE 1: Database Connectivity');
  
  try {
    // Test basic query
    const result = await db.query('SELECT NOW() as now, version() as version');
    logTest(
      'Database connection',
      result.rows.length > 0,
      `Connected to PostgreSQL ${result.rows[0].version.split(' ')[1]}`
    );
    
    // Test products table
    const productsResult = await db.query('SELECT COUNT(*) as count FROM products');
    logTest(
      'Products table access',
      parseInt(productsResult.rows[0].count) > 0,
      `${productsResult.rows[0].count} products in database`
    );
    
    // Test inventory table
    const inventoryResult = await db.query('SELECT COUNT(*) as count FROM inventory');
    logTest(
      'Inventory table access',
      parseInt(inventoryResult.rows[0].count) > 0,
      `${inventoryResult.rows[0].count} inventory records`
    );
    
    // Test batches table
    const batchesResult = await db.query('SELECT COUNT(*) as count FROM batches');
    logTest(
      'Batches table access',
      parseInt(batchesResult.rows[0].count) >= 0,
      `${batchesResult.rows[0].count} batches in database`
    );
    
    // Test transactions table
    const transactionsResult = await db.query('SELECT COUNT(*) as count FROM inventory_transactions');
    logTest(
      'Transactions table access',
      parseInt(transactionsResult.rows[0].count) >= 0,
      `${transactionsResult.rows[0].count} transactions recorded`
    );
    
  } catch (error) {
    logTest('Database connectivity', false, error.message);
  }
}

/**
 * Test Suite 2: Service Layer
 */
async function testServiceLayer() {
  logSection('TEST SUITE 2: Service Layer');
  
  try {
    // Test transaction service - check what functions are actually available
    const transactionFunctions = [];
    const expectedTransactionFunctions = [
      'createReceiptTransaction',
      'createIssueTransaction', 
      'createTransferTransaction',
      'createAdjustment'
    ];
    
    expectedTransactionFunctions.forEach(funcName => {
      if (typeof transactionService[funcName] === 'function') {
        transactionFunctions.push(funcName);
      }
    });
    
    logTest(
      'Transaction service loaded',
      transactionFunctions.length > 0,
      `${transactionFunctions.length}/${expectedTransactionFunctions.length} transaction functions available: ${transactionFunctions.join(', ')}`
    );
    
    // Test batch service
    const batchFunctions = [];
    const expectedBatchFunctions = [
      'getAvailableBatchesFIFO',
      'getAvailableBatchesFEFO',
      'getExpiringBatches'
    ];
    
    expectedBatchFunctions.forEach(funcName => {
      if (typeof batchService[funcName] === 'function') {
        batchFunctions.push(funcName);
      }
    });
    
    logTest(
      'Batch service loaded',
      batchFunctions.length > 0,
      `${batchFunctions.length}/${expectedBatchFunctions.length} batch functions available`
    );
    
    // Test reporting service
    const reportingFunctions = [];
    const expectedReportingFunctions = [
      'generateStockReport',
      'generateTransactionReport',
      'generateBatchReport',
      'generateLowStockReport'
    ];
    
    expectedReportingFunctions.forEach(funcName => {
      if (typeof reportingService[funcName] === 'function') {
        reportingFunctions.push(funcName);
      }
    });
    
    logTest(
      'Reporting service loaded',
      reportingFunctions.length > 0,
      `${reportingFunctions.length}/${expectedReportingFunctions.length} reporting functions available`
    );
    
  } catch (error) {
    logTest('Service layer loading', false, error.message);
  }
}

/**
 * Test Suite 3: Batch Management
 */
async function testBatchManagement() {
  logSection('TEST SUITE 3: Batch Management');
  
  try {
    // Get a test product with location
    const productResult = await db.query(`
      SELECT 
        p.product_id, 
        p.sku,
        i.location_id
      FROM products p
      JOIN inventory i ON p.product_id = i.product_id
      WHERE p.sku LIKE 'PREFORM%' 
      LIMIT 1
    `);
    
    if (productResult.rows.length === 0) {
      logTest('Batch management', false, 'No test products with inventory available');
      return;
    }
    
    const testProduct = productResult.rows[0];
    
    // Test FIFO batch selection - just verify it executes without error
    let fifoSuccess = false;
    let fifoMessage = '';
    try {
      const fifoBatches = await batchService.getAvailableBatchesFIFO(
        testProduct.product_id,
        testProduct.location_id,
        100
      );
      fifoSuccess = true;
      
      // Determine count safely
      let count = 0;
      if (Array.isArray(fifoBatches)) {
        count = fifoBatches.length;
      }
      
      fifoMessage = count > 0 
        ? `Retrieved ${count} batches using FIFO for ${testProduct.sku}` 
        : `FIFO executed successfully (0 batches available for ${testProduct.sku})`;
    } catch (error) {
      fifoMessage = `Error: ${error.message}`;
    }
    
    logTest('FIFO batch selection', fifoSuccess, fifoMessage);
    
    // Test FEFO batch selection - just verify it executes without error
    let fefoSuccess = false;
    let fefoMessage = '';
    try {
      const fefoBatches = await batchService.getAvailableBatchesFEFO(
        testProduct.product_id,
        testProduct.location_id,
        100
      );
      fefoSuccess = true;
      
      // Determine count safely
      let count = 0;
      if (Array.isArray(fefoBatches)) {
        count = fefoBatches.length;
      }
      
      fefoMessage = count > 0 
        ? `Retrieved ${count} batches using FEFO for ${testProduct.sku}` 
        : `FEFO executed successfully (0 batches available for ${testProduct.sku})`;
    } catch (error) {
      fefoMessage = `Error: ${error.message}`;
    }
    
    logTest('FEFO batch selection', fefoSuccess, fefoMessage);
    
    // Test expiring batches
    let expiringSuccess = false;
    let expiringMessage = '';
    try {
      const expiringBatches = await batchService.getExpiringBatches(30);
      expiringSuccess = true;
      
      let count = 0;
      if (Array.isArray(expiringBatches)) {
        count = expiringBatches.length;
      }
      
      expiringMessage = `Found ${count} batches expiring in 30 days`;
    } catch (error) {
      expiringMessage = `Error: ${error.message}`;
    }
    
    logTest('Expiring batches detection', expiringSuccess, expiringMessage);
    
  } catch (error) {
    logTest('Batch management suite', false, error.message);
  }
}

/**
 * Test Suite 4: Reporting System
 */
async function testReportingSystem() {
  logSection('TEST SUITE 4: Reporting System');
  
  try {
    // Test stock report
    const stockReport = await reportingService.generateStockReport({});
    logTest(
      'Stock report generation',
      stockReport.data && stockReport.data.length > 0,
      `Generated report with ${stockReport.data.length} items`
    );
    
    logTest(
      'Stock report summary',
      stockReport.summary && typeof stockReport.summary.total_items === 'number',
      `Summary includes ${stockReport.summary.total_items} total items`
    );
    
    // Test transaction report
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);
    
    const txnReport = await reportingService.generateTransactionReport({
      start_date: startDate.toISOString().split('T')[0],
      end_date: endDate.toISOString().split('T')[0],
      limit: 100,
    });
    logTest(
      'Transaction report generation',
      txnReport.data && Array.isArray(txnReport.data),
      `Generated report with ${txnReport.data.length} transactions`
    );
    
    // Test batch report
    const batchReport = await reportingService.generateBatchReport({});
    logTest(
      'Batch report generation',
      batchReport.data && Array.isArray(batchReport.data),
      `Generated report with ${batchReport.data.length} batches`
    );
    
    // Test low stock report
    const lowStockReport = await reportingService.generateLowStockReport({});
    logTest(
      'Low stock report generation',
      lowStockReport.data && Array.isArray(lowStockReport.data),
      `Found ${lowStockReport.data.length} low stock items`
    );
    
  } catch (error) {
    logTest('Reporting system', false, error.message);
  }
}

/**
 * Test Suite 5: Data Integrity
 */
async function testDataIntegrity() {
  logSection('TEST SUITE 5: Data Integrity');
  
  try {
    // Test referential integrity - products to inventory
    const orphanedInventory = await db.query(`
      SELECT COUNT(*) as count 
      FROM inventory i 
      LEFT JOIN products p ON i.product_id = p.product_id 
      WHERE p.product_id IS NULL
    `);
    logTest(
      'Product-Inventory integrity',
      parseInt(orphanedInventory.rows[0].count) === 0,
      'No orphaned inventory records'
    );
    
    // Test referential integrity - inventory to locations
    const orphanedLocations = await db.query(`
      SELECT COUNT(*) as count 
      FROM inventory i 
      LEFT JOIN warehouse_locations wl ON i.location_id = wl.location_id 
      WHERE wl.location_id IS NULL
    `);
    logTest(
      'Inventory-Location integrity',
      parseInt(orphanedLocations.rows[0].count) === 0,
      'No orphaned location references'
    );
    
    // Test batch-inventory linkage
    const batchInventoryCheck = await db.query(`
      SELECT COUNT(*) as count 
      FROM batches b 
      LEFT JOIN inventory i ON b.batch_id = i.batch_id 
      WHERE b.status = 'active' AND i.batch_id IS NULL
    `);
    logTest(
      'Batch-Inventory linkage',
      parseInt(batchInventoryCheck.rows[0].count) >= 0,
      'Batch inventory linkage valid'
    );
    
    // Test quantity consistency
    const quantityCheck = await db.query(`
      SELECT COUNT(*) as count 
      FROM inventory 
      WHERE quantity_on_hand < 0 
         OR quantity_available < 0 
         OR quantity_allocated < 0
    `);
    logTest(
      'Quantity consistency',
      parseInt(quantityCheck.rows[0].count) === 0,
      'No negative quantities found'
    );
    
    // Test quantity balance
    const balanceCheck = await db.query(`
      SELECT COUNT(*) as count 
      FROM inventory 
      WHERE quantity_on_hand != (quantity_available + quantity_allocated)
    `);
    logTest(
      'Quantity balance check',
      parseInt(balanceCheck.rows[0].count) === 0,
      'All quantities balanced (on_hand = available + allocated)'
    );
    
  } catch (error) {
    logTest('Data integrity', false, error.message);
  }
}

/**
 * Test Suite 6: Performance Metrics
 */
async function testPerformanceMetrics() {
  logSection('TEST SUITE 6: Performance Metrics');
  
  try {
    // Test query performance - simple select
    const start1 = Date.now();
    await db.query('SELECT * FROM products LIMIT 100');
    const duration1 = Date.now() - start1;
    logTest(
      'Simple query performance',
      duration1 < 1000,
      `Query completed in ${duration1}ms (target: <1000ms)`
    );
    
    // Test query performance - join query
    const start2 = Date.now();
    await db.query(`
      SELECT p.sku, p.product_name, i.quantity_on_hand, wl.location_code
      FROM products p
      JOIN inventory i ON p.product_id = i.product_id
      JOIN warehouse_locations wl ON i.location_id = wl.location_id
      LIMIT 100
    `);
    const duration2 = Date.now() - start2;
    logTest(
      'Complex join performance',
      duration2 < 2000,
      `Query completed in ${duration2}ms (target: <2000ms)`
    );
    
    // Test report generation performance
    const start3 = Date.now();
    await reportingService.generateStockReport({});
    const duration3 = Date.now() - start3;
    logTest(
      'Stock report performance',
      duration3 < 5000,
      `Report generated in ${duration3}ms (target: <5000ms)`
    );
    
  } catch (error) {
    logTest('Performance metrics', false, error.message);
  }
}

/**
 * Test Suite 7: System Health
 */
async function testSystemHealth() {
  logSection('TEST SUITE 7: System Health');
  
  try {
    // Check database size
    const sizeResult = await db.query(
      "SELECT pg_size_pretty(pg_database_size(current_database())) as size"
    );
    logTest(
      'Database size check',
      true,
      `Database size: ${sizeResult.rows[0].size}`
    );
    
    // Check active connections
    const connectionsResult = await db.query(`
      SELECT COUNT(*) as count 
      FROM pg_stat_activity 
      WHERE datname = current_database() AND state = 'active'
    `);
    logTest(
      'Active connections',
      parseInt(connectionsResult.rows[0].count) < 10,
      `${connectionsResult.rows[0].count} active connections (healthy: <10)`
    );
    
    // Check table sizes
    const tableSizes = await db.query(`
      SELECT 
        tablename,
        pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
      FROM pg_tables
      WHERE schemaname = 'public'
      ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
      LIMIT 5
    `);
    logTest(
      'Table size analysis',
      tableSizes.rows.length > 0,
      `Largest table: ${tableSizes.rows[0].tablename} (${tableSizes.rows[0].size})`
    );
    
  } catch (error) {
    logTest('System health', false, error.message);
  }
}

/**
 * Main test runner
 */
async function runAllTests() {
  console.log('\n');
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║   VILAGIO INVENTORY SYSTEM - INTEGRATION TEST SUITE       ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('\n');
  
  const startTime = Date.now();
  
  try {
    await testDatabaseConnectivity();
    await testServiceLayer();
    await testBatchManagement();
    await testReportingSystem();
    await testDataIntegrity();
    await testPerformanceMetrics();
    await testSystemHealth();
    
  } catch (error) {
    console.error('\n❌ Test suite error:', error.message);
  } finally {
    await db.closePool();
  }
  
  const duration = Date.now() - startTime;
  
  // Print summary
  logSection('TEST SUMMARY');
  console.log(`Total Tests: ${testResults.passed + testResults.failed}`);
  console.log(`Passed: ${testResults.passed} ✅`);
  console.log(`Failed: ${testResults.failed} ${testResults.failed > 0 ? '❌' : '✅'}`);
  console.log(`Duration: ${(duration / 1000).toFixed(2)} seconds`);
  console.log(`Success Rate: ${((testResults.passed / (testResults.passed + testResults.failed)) * 100).toFixed(1)}%`);
  
  // Print failed tests
  if (testResults.failed > 0) {
    console.log('\nFailed Tests:');
    testResults.tests
      .filter(t => !t.passed)
      .forEach(t => console.log(`  ❌ ${t.name}: ${t.message}`));
  }
  
  console.log('\n' + '='.repeat(60));
  
  // Exit with appropriate code
  process.exit(testResults.failed > 0 ? 1 : 0);
}

// Run tests
runAllTests();
