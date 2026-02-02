const express = require('express');
const router = express.Router();
const { pool } = require('../services/auth-service');
const { authenticate } = require('../middleware/auth-middleware');

// All report routes require authentication
router.use(authenticate);

// GET /api/reports/stock-levels - Stock Levels Report
router.get('/stock-levels', async (req, res) => {
  try {
    const { location_id, category_id, stock_status } = req.query;

    console.log('📊 Generating Stock Levels Report...');

    let query = `
      SELECT 
        p.product_id,
        p.sku,
        p.product_name,
        pc.category_name,
        wl.location_code,
        wl.location_name,
        COALESCE(i.quantity_on_hand, 0) as quantity_on_hand,
        COALESCE(i.quantity_allocated, 0) as quantity_allocated,
        COALESCE(i.quantity_on_hand - i.quantity_allocated, 0) as quantity_available,
        p.base_uom,
        p.reorder_level,
        p.standard_cost,
        (COALESCE(i.quantity_on_hand, 0) * COALESCE(p.standard_cost, 0)) as total_value,
        i.last_updated,
        CASE 
          WHEN COALESCE(i.quantity_on_hand, 0) = 0 THEN 'Out of Stock'
          WHEN COALESCE(i.quantity_on_hand, 0) <= p.reorder_level THEN 'Low Stock'
          ELSE 'In Stock'
        END as stock_status
      FROM products p
      LEFT JOIN product_categories pc ON p.category_id = pc.category_id
      LEFT JOIN inventory i ON p.product_id = i.product_id
      LEFT JOIN warehouse_locations wl ON i.location_id = wl.location_id
      WHERE p.is_active = true
    `;

    const params = [];
    let paramCount = 1;

    if (location_id) {
      query += ` AND i.location_id = $${paramCount}`;
      params.push(location_id);
      paramCount++;
    }

    if (category_id) {
      query += ` AND p.category_id = $${paramCount}`;
      params.push(category_id);
      paramCount++;
    }

    if (stock_status) {
      if (stock_status === 'out_of_stock') {
        query += ` AND COALESCE(i.quantity_on_hand, 0) = 0`;
      } else if (stock_status === 'low_stock') {
        query += ` AND COALESCE(i.quantity_on_hand, 0) > 0 AND COALESCE(i.quantity_on_hand, 0) <= p.reorder_level`;
      } else if (stock_status === 'in_stock') {
        query += ` AND COALESCE(i.quantity_on_hand, 0) > p.reorder_level`;
      }
    }

    query += ` ORDER BY p.sku, wl.location_code`;

    const result = await pool.query(query, params);

    console.log(`✅ Stock Levels Report: ${result.rows.length} records`);

    res.json({
      report_type: 'stock_levels',
      generated_at: new Date().toISOString(),
      total_records: result.rows.length,
      data: result.rows
    });
  } catch (error) {
    console.error('❌ Stock Levels Report error:', error.message);
    res.status(500).json({ message: error.message });
  }
});

// GET /api/reports/low-stock - Low Stock Report
router.get('/low-stock', async (req, res) => {
  try {
    const { urgency } = req.query; // 'critical', 'low', or all

    console.log('⚠️ Generating Low Stock Report...');

    let query = `
      WITH product_stock AS (
        SELECT 
          p.product_id,
          p.sku,
          p.product_name,
          pc.category_name,
          p.base_uom,
          p.reorder_level,
          COALESCE(SUM(i.quantity_on_hand), 0) as total_stock,
          p.standard_cost,
          (COALESCE(SUM(i.quantity_on_hand), 0) * COALESCE(p.standard_cost, 0)) as total_value,
          CASE 
            WHEN COALESCE(SUM(i.quantity_on_hand), 0) = 0 THEN 'critical'
            WHEN COALESCE(SUM(i.quantity_on_hand), 0) <= p.reorder_level * 0.5 THEN 'critical'
            WHEN COALESCE(SUM(i.quantity_on_hand), 0) <= p.reorder_level THEN 'low'
            ELSE 'ok'
          END as urgency,
          (COALESCE(SUM(i.quantity_on_hand), 0)::float / NULLIF(p.reorder_level, 0) * 100) as stock_percentage
        FROM products p
        LEFT JOIN product_categories pc ON p.category_id = pc.category_id
        LEFT JOIN inventory i ON p.product_id = i.product_id
        WHERE p.is_active = true AND p.reorder_level > 0
        GROUP BY p.product_id, p.sku, p.product_name, pc.category_name, p.base_uom, p.reorder_level, p.standard_cost
      )
      SELECT *
      FROM product_stock
      WHERE urgency IN ('low', 'critical')
    `;

    if (urgency === 'critical') {
      query += ` AND urgency = 'critical'`;
    } else if (urgency === 'low') {
      query += ` AND urgency = 'low'`;
    }

    query += `
      ORDER BY 
        CASE urgency 
          WHEN 'critical' THEN 1
          WHEN 'low' THEN 2
        END,
        total_stock ASC
    `;

    const result = await pool.query(query);

    console.log(`✅ Low Stock Report: ${result.rows.length} products below threshold`);

    res.json({
      report_type: 'low_stock',
      generated_at: new Date().toISOString(),
      total_records: result.rows.length,
      critical_count: result.rows.filter(r => r.urgency === 'critical').length,
      low_count: result.rows.filter(r => r.urgency === 'low').length,
      data: result.rows
    });
  } catch (error) {
    console.error('❌ Low Stock Report error:', error.message);
    res.status(500).json({ message: error.message });
  }
});

// GET /api/reports/valuation - Inventory Valuation Report
router.get('/valuation', async (req, res) => {
  try {
    const { group_by } = req.query; // 'category', 'location', or 'both'

    console.log('💰 Generating Inventory Valuation Report...');

    let query;

    if (group_by === 'category') {
      query = `
        SELECT 
          pc.category_id,
          pc.category_name,
          COUNT(DISTINCT p.product_id) as product_count,
          SUM(COALESCE(i.quantity_on_hand, 0)) as total_units,
          SUM(COALESCE(i.quantity_on_hand, 0) * COALESCE(p.standard_cost, 0)) as total_value,
          AVG(COALESCE(p.standard_cost, 0)) as avg_cost_per_unit
        FROM product_categories pc
        LEFT JOIN products p ON pc.category_id = p.category_id AND p.is_active = true
        LEFT JOIN inventory i ON p.product_id = i.product_id
        GROUP BY pc.category_id, pc.category_name
        HAVING SUM(COALESCE(i.quantity_on_hand, 0)) > 0
        ORDER BY total_value DESC
      `;
    } else if (group_by === 'location') {
      query = `
        SELECT 
          wl.location_id,
          wl.location_code,
          wl.location_name,
          wl.location_type,
          COUNT(DISTINCT i.product_id) as product_count,
          SUM(i.quantity_on_hand) as total_units,
          SUM(i.quantity_on_hand * COALESCE(p.standard_cost, 0)) as total_value,
          AVG(COALESCE(p.standard_cost, 0)) as avg_cost_per_unit
        FROM warehouse_locations wl
        LEFT JOIN inventory i ON wl.location_id = i.location_id
        LEFT JOIN products p ON i.product_id = p.product_id AND p.is_active = true
        WHERE wl.is_active = true
        GROUP BY wl.location_id, wl.location_code, wl.location_name, wl.location_type
        HAVING SUM(i.quantity_on_hand) > 0
        ORDER BY total_value DESC
      `;
    } else {
      // Both - detailed breakdown
      query = `
        SELECT 
          pc.category_name,
          wl.location_code,
          wl.location_name,
          COUNT(DISTINCT p.product_id) as product_count,
          SUM(i.quantity_on_hand) as total_units,
          SUM(i.quantity_on_hand * COALESCE(p.standard_cost, 0)) as total_value,
          AVG(COALESCE(p.standard_cost, 0)) as avg_cost_per_unit
        FROM inventory i
        JOIN products p ON i.product_id = p.product_id AND p.is_active = true
        JOIN product_categories pc ON p.category_id = pc.category_id
        JOIN warehouse_locations wl ON i.location_id = wl.location_id AND wl.is_active = true
        GROUP BY pc.category_name, wl.location_code, wl.location_name
        HAVING SUM(i.quantity_on_hand) > 0
        ORDER BY pc.category_name, total_value DESC
      `;
    }

    const result = await pool.query(query);

    // Calculate totals
    const totalValue = result.rows.reduce((sum, row) => sum + parseFloat(row.total_value || 0), 0);
    const totalUnits = result.rows.reduce((sum, row) => sum + parseInt(row.total_units || 0), 0);

    console.log(`✅ Valuation Report: Total Value = $${totalValue.toFixed(2)}`);

    res.json({
      report_type: 'inventory_valuation',
      generated_at: new Date().toISOString(),
      group_by: group_by || 'category',
      summary: {
        total_value: totalValue,
        total_units: totalUnits,
        total_groups: result.rows.length
      },
      data: result.rows
    });
  } catch (error) {
    console.error('❌ Valuation Report error:', error.message);
    res.status(500).json({ message: error.message });
  }
});

// GET /api/reports/movement - Stock Movement Report
router.get('/movement', async (req, res) => {
  try {
    const { start_date, end_date, product_id, location_id, transaction_type } = req.query;

    console.log('📈 Generating Stock Movement Report...');

    let query = `
      SELECT 
        it.transaction_date,
        it.transaction_number,
        tt.type_name as transaction_type,
        tt.display_name as transaction_type_display,
        p.sku,
        p.product_name,
        pc.category_name,
        it.quantity,
        it.uom,
        from_loc.location_code as from_location,
        to_loc.location_code as to_location,
        u.full_name as performed_by,
        it.notes,
        it.unit_cost,
        (it.quantity * COALESCE(it.unit_cost, p.standard_cost, 0)) as transaction_value
      FROM inventory_transactions it
      LEFT JOIN transaction_types tt ON it.transaction_type_id = tt.transaction_type_id
      LEFT JOIN products p ON it.product_id = p.product_id
      LEFT JOIN product_categories pc ON p.category_id = pc.category_id
      LEFT JOIN warehouse_locations from_loc ON it.from_location_id = from_loc.location_id
      LEFT JOIN warehouse_locations to_loc ON it.to_location_id = to_loc.location_id
      LEFT JOIN users u ON it.performed_by = u.user_id
      WHERE 1=1
    `;

    const params = [];
    let paramCount = 1;

    if (start_date) {
      query += ` AND it.transaction_date >= $${paramCount}`;
      params.push(start_date);
      paramCount++;
    }

    if (end_date) {
      query += ` AND it.transaction_date <= $${paramCount}`;
      params.push(end_date);
      paramCount++;
    }

    if (product_id) {
      query += ` AND it.product_id = $${paramCount}`;
      params.push(product_id);
      paramCount++;
    }

    if (location_id) {
      query += ` AND (it.from_location_id = $${paramCount} OR it.to_location_id = $${paramCount})`;
      params.push(location_id);
      paramCount++;
    }

    if (transaction_type) {
      query += ` AND tt.type_name = $${paramCount}`;
      params.push(transaction_type);
      paramCount++;
    }

    query += ` ORDER BY it.transaction_date DESC, it.created_at DESC LIMIT 1000`;

    const result = await pool.query(query, params);

    console.log(`✅ Movement Report: ${result.rows.length} transactions`);

    res.json({
      report_type: 'stock_movement',
      generated_at: new Date().toISOString(),
      filters: {
        start_date,
        end_date,
        product_id,
        location_id,
        transaction_type
      },
      total_records: result.rows.length,
      data: result.rows
    });
  } catch (error) {
    console.error('❌ Movement Report error:', error.message);
    res.status(500).json({ message: error.message });
  }
});

// GET /api/reports/transaction-summary - Transaction Summary Report
router.get('/transaction-summary', async (req, res) => {
  try {
    const { start_date, end_date, group_by } = req.query; // group_by: 'type', 'product', 'location', 'user'

    console.log('📊 Generating Transaction Summary Report...');

    let query;
    const params = [];
    let paramCount = 1;

    let dateFilter = '';
    if (start_date) {
      dateFilter += ` AND it.transaction_date >= $${paramCount}`;
      params.push(start_date);
      paramCount++;
    }
    if (end_date) {
      dateFilter += ` AND it.transaction_date <= $${paramCount}`;
      params.push(end_date);
      paramCount++;
    }

    if (group_by === 'type') {
      query = `
        SELECT 
          tt.type_name,
          tt.display_name,
          COUNT(*) as transaction_count,
          SUM(it.quantity) as total_quantity,
          SUM(it.quantity * COALESCE(it.unit_cost, p.standard_cost, 0)) as total_value
        FROM inventory_transactions it
        LEFT JOIN transaction_types tt ON it.transaction_type_id = tt.transaction_type_id
        LEFT JOIN products p ON it.product_id = p.product_id
        WHERE 1=1 ${dateFilter}
        GROUP BY tt.type_name, tt.display_name
        ORDER BY transaction_count DESC
      `;
    } else if (group_by === 'product') {
      query = `
        SELECT 
          p.sku,
          p.product_name,
          pc.category_name,
          COUNT(*) as transaction_count,
          SUM(it.quantity) as total_quantity,
          p.base_uom,
          SUM(it.quantity * COALESCE(it.unit_cost, p.standard_cost, 0)) as total_value
        FROM inventory_transactions it
        LEFT JOIN products p ON it.product_id = p.product_id
        LEFT JOIN product_categories pc ON p.category_id = pc.category_id
        WHERE 1=1 ${dateFilter}
        GROUP BY p.product_id, p.sku, p.product_name, pc.category_name, p.base_uom
        ORDER BY transaction_count DESC
        LIMIT 50
      `;
    } else if (group_by === 'location') {
      query = `
        SELECT 
          COALESCE(from_loc.location_code, to_loc.location_code) as location_code,
          COALESCE(from_loc.location_name, to_loc.location_name) as location_name,
          COUNT(*) as transaction_count,
          SUM(it.quantity) as total_quantity
        FROM inventory_transactions it
        LEFT JOIN warehouse_locations from_loc ON it.from_location_id = from_loc.location_id
        LEFT JOIN warehouse_locations to_loc ON it.to_location_id = to_loc.location_id
        WHERE (it.from_location_id IS NOT NULL OR it.to_location_id IS NOT NULL) ${dateFilter}
        GROUP BY COALESCE(from_loc.location_code, to_loc.location_code), 
                 COALESCE(from_loc.location_name, to_loc.location_name)
        ORDER BY transaction_count DESC
      `;
    } else {
      // Default: by user
      query = `
        SELECT 
          u.full_name as user_name,
          u.role,
          COUNT(*) as transaction_count,
          SUM(it.quantity) as total_quantity,
          SUM(it.quantity * COALESCE(it.unit_cost, p.standard_cost, 0)) as total_value
        FROM inventory_transactions it
        LEFT JOIN users u ON it.performed_by = u.user_id
        LEFT JOIN products p ON it.product_id = p.product_id
        WHERE 1=1 ${dateFilter}
        GROUP BY u.user_id, u.full_name, u.role
        ORDER BY transaction_count DESC
      `;
    }

    const result = await pool.query(query, params);

    console.log(`✅ Transaction Summary: ${result.rows.length} groups`);

    res.json({
      report_type: 'transaction_summary',
      generated_at: new Date().toISOString(),
      group_by: group_by || 'user',
      filters: { start_date, end_date },
      total_records: result.rows.length,
      data: result.rows
    });
  } catch (error) {
    console.error('❌ Transaction Summary Report error:', error.message);
    res.status(500).json({ message: error.message });
  }
});


// GET /api/reports/location-summary - Location Summary Report (FIXED)
router.get('/location-summary', async (req, res) => {
  try {
    console.log('📍 Generating Location Summary Report...');

    const query = `
      SELECT 
        wl.location_code,
        wl.location_name,
        wl.location_type,
        COUNT(DISTINCT i.product_id) as product_count,
        COUNT(DISTINCT pc.category_id) as category_count,
        COALESCE(SUM(i.quantity_on_hand), 0) as total_units,
        COALESCE(SUM(i.quantity_allocated), 0) as allocated_units,
        COALESCE(SUM(i.quantity_on_hand) - SUM(i.quantity_allocated), 0) as available_units,
        COALESCE(SUM(i.quantity_on_hand * p.standard_cost), 0) as total_value
      FROM warehouse_locations wl
      LEFT JOIN inventory i ON wl.location_id = i.location_id
      LEFT JOIN products p ON i.product_id = p.product_id AND p.is_active = true
      LEFT JOIN product_categories pc ON p.category_id = pc.category_id
      WHERE wl.is_active = true
      GROUP BY wl.location_id, wl.location_code, wl.location_name, wl.location_type
      ORDER BY total_value DESC
    `;

    const result = await pool.query(query);

    console.log(`✅ Location Summary: ${result.rows.length} locations`);

    res.json({
      report_type: 'location_summary',
      generated_at: new Date().toISOString(),
      total_records: result.rows.length,
      data: result.rows,
      summary: {
        total_locations: result.rows.length,
        total_inventory_value: result.rows.reduce((sum, row) => sum + (parseFloat(row.total_value) || 0), 0)
      }
    });
  } catch (error) {
    console.error('❌ Location Summary Report error:', error.message);
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
