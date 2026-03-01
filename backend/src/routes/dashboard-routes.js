// backend/src/routes/dashboard-routes.js
const express = require('express');
const router = express.Router();
const { pool } = require('../services/auth-service');
const { authenticate, authorize } = require('../middleware/auth-middleware');

// GET /api/dashboard/stats - Get unified ERP dashboard statistics
router.get('/stats', authenticate, authorize(['admin', 'manager', 'qa', 'staff', 'viewer']), async (req, res) => {
  try {
    console.log('📊 Fetching unified dashboard statistics...');
    const userId = req.user.user_id;

    // 1. INVENTORY STATS
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

    // 2. PRODUCTION STATS
    const productionQuery = `
      SELECT 
        (SELECT COUNT(*) FROM production_batches WHERE status IN ('draft', 'ready_for_setup', 'in_progress')) as active_batches,
        (SELECT COUNT(*) FROM production_batches WHERE status IN ('awaiting_qa', 'completed')) as pending_qa,
        (SELECT COALESCE(SUM(actual_output), 0) FROM production_batches WHERE DATE(production_date) = CURRENT_DATE) as today_output
    `;
    const productionResult = await pool.query(productionQuery);
    const prodStats = productionResult.rows[0];

    // 3. PERSONAL QMS HEALTH STATS
    const personalQmsQuery = `
      SELECT 
        (SELECT COUNT(*) FROM qms_documents d 
         WHERE d.status = 'RELEASED' AND d.doc_type IN ('SOP', 'POL', 'MAN') 
         AND NOT EXISTS (
           SELECT 1 FROM qms_training_records tr 
           WHERE tr.doc_id = d.doc_id AND tr.user_id = $1 AND tr.version_id = d.current_version_id
         )) as pending_training,
        (SELECT COUNT(*) FROM qms_ncr WHERE assigned_to = $1 AND status != 'CLOSED') as assigned_ncrs
    `;
    const personalQmsResult = await pool.query(personalQmsQuery, [userId]);
    const personalStats = personalQmsResult.rows[0];

    // 4. QA DEPARTMENT SPECIFIC STATS (FIXED to include 'pending_qa_review')
    const qaQuery = `
      SELECT 
        (SELECT COUNT(*) FROM production_batches pb
         WHERE pb.status = 'awaiting_qa'
            OR (pb.status = 'in_progress' AND EXISTS (
                SELECT 1 FROM batch_ipqc_records ipqc 
                WHERE ipqc.batch_id = pb.batch_id 
                  AND (ipqc.qa_status IN ('pending', 'pending_qa_review') OR ipqc.qa_status IS NULL)
            ))
        ) as pending_batch_release,
        
        (SELECT COUNT(*) FROM batch_ipqc_records 
         WHERE qa_status IN ('pending', 'pending_qa_review') OR qa_status IS NULL
        ) as pending_ipqc_reviews
    `;
    const qaResult = await pool.query(qaQuery);
    const qaStats = qaResult.rows[0];

    // Compile Unified Stats Object
    const stats = {
      // Inventory
      total_products: parseInt(productStats.total_products || 0),
      in_stock_products: parseInt(productStats.in_stock || 0),
      low_stock_products: parseInt(productStats.low_stock || 0),
      out_of_stock_products: parseInt(productStats.out_of_stock || 0),
      total_inventory_value: parseFloat(productStats.total_inventory_value || 0),
      total_inventory_units: parseInt(productStats.total_units || 0),
      
      // Production
      active_batches: parseInt(prodStats.active_batches || 0),
      pending_qa: parseInt(prodStats.pending_qa || 0),
      today_output: parseInt(prodStats.today_output || 0),

      // Personal User Action Center
      pending_training: parseInt(personalStats.pending_training || 0),
      assigned_ncrs: parseInt(personalStats.assigned_ncrs || 0),

      // QA specific
      qa_pending_batches: parseInt(qaStats.pending_batch_release || 0),
      qa_pending_ipqc: parseInt(qaStats.pending_ipqc_reviews || 0)
    };

    res.json(stats);
  } catch (error) {
    console.error('❌ Get dashboard stats error:', error);
    res.status(500).json({ message: error.message });
  }
});

// GET /api/dashboard/active-production (Get currently running batches)
router.get('/active-production', authenticate, authorize(['admin', 'manager', 'qa', 'staff', 'viewer']), async (req, res) => {
  try {
    // FIXED: Added the dynamic CASE statement so batches turn yellow on the dashboard
    const query = `
      SELECT 
        pb.batch_id, 
        pb.batch_number, 
        COALESCE(pb.product_name, p.product_name) as product_name, 
        CASE 
          WHEN pb.status = 'in_progress' AND EXISTS (
              SELECT 1 FROM batch_ipqc_records 
              WHERE batch_id = pb.batch_id AND (qa_status IN ('pending', 'pending_qa_review') OR qa_status IS NULL)
          ) THEN 'awaiting_qa'
          ELSE pb.status 
        END as status,
        pb.planned_quantity, 
        pb.actual_output, 
        pb.yield_percentage, 
        pb.production_date
      FROM production_batches pb
      LEFT JOIN products p ON pb.product_id = p.product_id
      WHERE pb.status NOT IN ('released', 'rejected', 'draft')
      ORDER BY 
        CASE pb.status
          WHEN 'in_progress' THEN 1
          WHEN 'ready_for_setup' THEN 2
          WHEN 'awaiting_qa' THEN 3
          WHEN 'completed' THEN 4
          ELSE 5
        END,
        pb.production_date ASC
      LIMIT 6
    `;
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (error) {
    console.error('❌ Get active production error:', error);
    res.status(500).json({ message: error.message });
  }
});

// GET /api/dashboard/recent-transactions
router.get('/recent-transactions', authenticate, authorize(['admin', 'manager', 'qa', 'staff']), async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const query = `
      SELECT 
        it.transaction_id, it.transaction_number, it.transaction_date, tt.type_name as transaction_type,
        p.product_name, it.quantity, it.uom, fl.location_code as from_location, tl.location_code as to_location
      FROM inventory_transactions it
      LEFT JOIN transaction_types tt ON it.transaction_type_id = tt.transaction_type_id
      LEFT JOIN products p ON it.product_id = p.product_id
      LEFT JOIN warehouse_locations fl ON it.from_location_id = fl.location_id
      LEFT JOIN warehouse_locations tl ON it.to_location_id = tl.location_id
      ORDER BY it.transaction_date DESC, it.created_at DESC LIMIT $1
    `;
    const result = await pool.query(query, [limit]);
    res.json(result.rows);
  } catch (error) {
    console.error('❌ Get recent transactions error:', error);
    res.status(500).json({ message: error.message });
  }
});

// GET /api/dashboard/low-stock-alerts
router.get('/low-stock-alerts', authenticate, authorize(['admin', 'manager', 'qa', 'staff', 'viewer']), async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const query = `
      WITH product_stock AS (
        SELECT p.product_id, p.sku, p.product_name, pc.category_name, COALESCE(SUM(i.quantity_on_hand), 0) as total_stock,
          p.reorder_level, p.base_uom,
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
      SELECT * FROM product_stock WHERE urgency IN ('low', 'critical')
      ORDER BY CASE urgency WHEN 'critical' THEN 1 WHEN 'low' THEN 2 END, total_stock ASC LIMIT $1
    `;
    const result = await pool.query(query, [limit]);
    res.json(result.rows);
  } catch (error) {
    console.error('❌ Get low stock alerts error:', error.message);
    res.status(500).json({ message: error.message });
  }
});

// GET /api/dashboard/locations
router.get('/locations', authenticate, authorize(['admin', 'manager', 'qa', 'staff', 'viewer']), async (req, res) => {
  try {
    const query = `
      SELECT wl.location_id, wl.location_code, wl.location_name, wl.location_type, COUNT(DISTINCT i.product_id) as product_count,
        COALESCE(SUM(i.quantity_on_hand), 0) as total_units, COALESCE(SUM(i.quantity_on_hand * COALESCE(p.standard_cost, 0)), 0) as total_value
      FROM warehouse_locations wl
      LEFT JOIN inventory i ON wl.location_id = i.location_id
      LEFT JOIN products p ON i.product_id = p.product_id
      WHERE wl.is_active = true
      GROUP BY wl.location_id, wl.location_code, wl.location_name, wl.location_type
      ORDER BY total_units DESC
    `;
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (error) {
    console.error('❌ Get locations error:', error);
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;