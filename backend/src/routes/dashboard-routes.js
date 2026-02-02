const express = require('express');
const router = express.Router();
const { pool } = require('../services/auth-service');
const { authenticate } = require('../middleware/auth-middleware');

// All dashboard routes require authentication
router.use(authenticate);

// GET /api/dashboard/stats - Get dashboard statistics
router.get('/stats', async (req, res) => {
  try {
    console.log('📊 Fetching dashboard statistics...');

    // Get total products and stock status breakdown
    const productsQuery = `
      WITH product_stock AS (
        SELECT 
          p.product_id,
          p.is_active,
          COALESCE(SUM(i.quantity_on_hand), 0) as total_stock,
          p.reorder_level,
          p.standard_cost,
          CASE 
            WHEN COALESCE(SUM(i.quantity_on_hand), 0) = 0 THEN 'out_of_stock'
            WHEN COALESCE(SUM(i.quantity_on_hand), 0) <= p.reorder_level THEN 'low_stock'
            ELSE 'in_stock'
          END as stock_status
        FROM products p
        LEFT JOIN inventory i ON p.product_id = i.product_id
        WHERE p.is_active = true
        GROUP BY p.product_id, p.is_active, p.reorder_level, p.standard_cost
      )
      SELECT 
        COUNT(*) as total_products,
        COUNT(CASE WHEN stock_status = 'in_stock' THEN 1 END) as in_stock,
        COUNT(CASE WHEN stock_status = 'low_stock' THEN 1 END) as low_stock,
        COUNT(CASE WHEN stock_status = 'out_of_stock' THEN 1 END) as out_of_stock,
        SUM(total_stock * COALESCE(standard_cost, 0)) as total_inventory_value,
        SUM(total_stock) as total_units
      FROM product_stock
    `;

    const productsResult = await pool.query(productsQuery);
    const productStats = productsResult.rows[0];

    // Get total users
    const usersQuery = `
      SELECT COUNT(*) as total_users
      FROM users
      WHERE is_active = true
    `;
    const usersResult = await pool.query(usersQuery);

    // Get transaction count for today
    const todayTransactionsQuery = `
      SELECT COUNT(*) as today_transactions
      FROM inventory_transactions
      WHERE DATE(transaction_date) = CURRENT_DATE
    `;
    const todayTxnResult = await pool.query(todayTransactionsQuery);

    // Get transaction count for last 30 days for comparison
    const last30DaysQuery = `
      SELECT COUNT(*) as last_month_transactions
      FROM inventory_transactions
      WHERE transaction_date >= CURRENT_DATE - INTERVAL '30 days'
    `;
    const last30Result = await pool.query(last30DaysQuery);

    // Get previous 30 days for comparison
    const previous30DaysQuery = `
      SELECT COUNT(*) as previous_month_transactions
      FROM inventory_transactions
      WHERE transaction_date >= CURRENT_DATE - INTERVAL '60 days'
      AND transaction_date < CURRENT_DATE - INTERVAL '30 days'
    `;
    const previous30Result = await pool.query(previous30DaysQuery);

    // Calculate percentage changes
    const currentMonthTxn = parseInt(last30Result.rows[0].last_month_transactions);
    const previousMonthTxn = parseInt(previous30Result.rows[0].previous_month_transactions);
    const txnChange = previousMonthTxn > 0 
      ? ((currentMonthTxn - previousMonthTxn) / previousMonthTxn * 100).toFixed(1)
      : 0;

    const stats = {
      total_products: parseInt(productStats.total_products),
      in_stock_products: parseInt(productStats.in_stock),
      low_stock_products: parseInt(productStats.low_stock),
      out_of_stock_products: parseInt(productStats.out_of_stock),
      total_inventory_value: parseFloat(productStats.total_inventory_value || 0),
      total_inventory_units: parseInt(productStats.total_units || 0),
      active_users: parseInt(usersResult.rows[0].total_users),
      today_transactions: parseInt(todayTxnResult.rows[0].today_transactions),
      monthly_transactions: currentMonthTxn,
      transaction_change_percent: parseFloat(txnChange)
    };

    console.log('✅ Dashboard stats retrieved:', stats);

    res.json(stats);
  } catch (error) {
    console.error('❌ Get dashboard stats error:', error.message);
    res.status(500).json({ message: error.message });
  }
});

// GET /api/dashboard/recent-transactions - Get recent transactions
router.get('/recent-transactions', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;

    console.log(`📋 Fetching ${limit} recent transactions...`);

    const query = `
      SELECT 
        it.transaction_id,
        it.transaction_number,
        it.transaction_date,
        tt.type_name as transaction_type,
        tt.display_name as transaction_type_display,
        p.sku,
        p.product_name,
        it.quantity,
        it.uom,
        fl.location_code as from_location,
        tl.location_code as to_location,
        u.full_name as performed_by
      FROM inventory_transactions it
      LEFT JOIN transaction_types tt ON it.transaction_type_id = tt.transaction_type_id
      LEFT JOIN products p ON it.product_id = p.product_id
      LEFT JOIN warehouse_locations fl ON it.from_location_id = fl.location_id
      LEFT JOIN warehouse_locations tl ON it.to_location_id = tl.location_id
      LEFT JOIN users u ON it.performed_by = u.user_id
      ORDER BY it.transaction_date DESC, it.created_at DESC
      LIMIT $1
    `;

    const result = await pool.query(query, [limit]);

    console.log(`✅ Found ${result.rows.length} recent transactions`);

    res.json(result.rows);
  } catch (error) {
    console.error('❌ Get recent transactions error:', error.message);
    res.status(500).json({ message: error.message });
  }
});

// GET /api/dashboard/low-stock-alerts - Get low stock products
router.get('/low-stock-alerts', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;

    console.log(`⚠️ Fetching ${limit} low stock alerts...`);

    const query = `
      WITH product_stock AS (
        SELECT 
          p.product_id,
          p.sku,
          p.product_name,
          pc.category_name,
          COALESCE(SUM(i.quantity_on_hand), 0) as total_stock,
          p.reorder_level,
          p.base_uom,
          CASE 
            WHEN COALESCE(SUM(i.quantity_on_hand), 0) = 0 THEN 'critical'
            WHEN COALESCE(SUM(i.quantity_on_hand), 0) <= p.reorder_level THEN 'low'
            ELSE 'ok'
          END as urgency
        FROM products p
        LEFT JOIN product_categories pc ON p.category_id = pc.category_id
        LEFT JOIN inventory i ON p.product_id = i.product_id
        WHERE p.is_active = true
        GROUP BY p.product_id, p.sku, p.product_name, pc.category_name, p.reorder_level, p.base_uom
      )
      SELECT *
      FROM product_stock
      WHERE urgency IN ('low', 'critical')
      ORDER BY 
        CASE urgency 
          WHEN 'critical' THEN 1
          WHEN 'low' THEN 2
        END,
        total_stock ASC
      LIMIT $1
    `;

    const result = await pool.query(query, [limit]);

    console.log(`✅ Found ${result.rows.length} low stock alerts`);

    res.json(result.rows);
  } catch (error) {
    console.error('❌ Get low stock alerts error:', error.message);
    res.status(500).json({ message: error.message });
  }
});

// GET /api/dashboard/locations - Get stock distribution by location
// This is an alias for /stock-by-location to match frontend expectations
router.get('/locations', async (req, res) => {
  try {
    console.log('📍 Fetching stock distribution by location...');

    const query = `
      SELECT 
        wl.location_code,
        wl.location_name,
        wl.location_type,
        COUNT(DISTINCT i.product_id) as product_count,
        COALESCE(SUM(i.quantity_on_hand), 0) as total_units,
        COALESCE(SUM(i.quantity_on_hand * COALESCE(p.standard_cost, 0)), 0) as total_value
      FROM warehouse_locations wl
      LEFT JOIN inventory i ON wl.location_id = i.location_id
      LEFT JOIN products p ON i.product_id = p.product_id
      WHERE wl.is_active = true
      GROUP BY wl.location_id, wl.location_code, wl.location_name, wl.location_type
      ORDER BY total_units DESC
    `;

    const result = await pool.query(query);

    console.log(`✅ Found ${result.rows.length} active locations`);

    res.json(result.rows);
  } catch (error) {
    console.error('❌ Get locations error:', error.message);
    res.status(500).json({ message: error.message });
  }
});

// GET /api/dashboard/stock-by-location - Alias for backward compatibility
router.get('/stock-by-location', async (req, res) => {
  // Redirect to /locations endpoint
  req.url = '/locations';
  return router.handle(req, res);
});

module.exports = router;
