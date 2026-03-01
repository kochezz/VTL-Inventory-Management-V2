// backend/src/services/dashboard-service.js
const { pool } = require('./auth-service'); 

const DashboardService = {
  
  async getUnifiedStats(userId) {
    const stats = {
      total_products: 0, in_stock_products: 0, low_stock_products: 0, out_of_stock_products: 0,
      total_inventory_value: 0, total_inventory_units: 0,
      active_batches: 0, pending_qa: 0, today_output: 0,
      pending_training: 0, assigned_ncrs: 0,
      qa_pending_batches: 0, qa_pending_ipqc: 0
    };

    // 1. INVENTORY
    try {
      const prodQuery = `
        WITH product_stock AS (
          SELECT p.product_id, COALESCE(SUM(i.quantity_on_hand), 0) as total_stock, p.reorder_level, p.standard_cost,
            CASE 
              WHEN COALESCE(SUM(i.quantity_on_hand), 0) = 0 THEN 'out_of_stock'
              WHEN COALESCE(SUM(i.quantity_on_hand), 0) <= p.reorder_level THEN 'low_stock'
              ELSE 'in_stock'
            END as stock_status
          FROM products p LEFT JOIN inventory i ON p.product_id = i.product_id
          WHERE p.is_active = true GROUP BY p.product_id, p.reorder_level, p.standard_cost
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
      const res = await pool.query(prodQuery);
      stats.total_products = parseInt(res.rows[0].total_products || 0);
      stats.in_stock_products = parseInt(res.rows[0].in_stock || 0);
      stats.low_stock_products = parseInt(res.rows[0].low_stock || 0);
      stats.out_of_stock_products = parseInt(res.rows[0].out_of_stock || 0);
      stats.total_inventory_value = parseFloat(res.rows[0].total_inventory_value || 0);
      stats.total_inventory_units = parseInt(res.rows[0].total_units || 0);
    } catch (e) { console.error('Inv Stats Error:', e.message); }

    // 2. PRODUCTION
    try {
      const batchQuery = `
        SELECT 
          (SELECT COUNT(*) FROM production_batches WHERE status IN ('draft', 'ready_for_setup', 'in_progress')) as active_batches,
          (SELECT COUNT(*) FROM production_batches WHERE status IN ('awaiting_qa', 'completed')) as pending_qa,
          (SELECT COALESCE(SUM(actual_output), 0) FROM production_batches WHERE DATE(production_date) = CURRENT_DATE) as today_output
      `;
      const res = await pool.query(batchQuery);
      stats.active_batches = parseInt(res.rows[0].active_batches || 0);
      stats.pending_qa = parseInt(res.rows[0].pending_qa || 0);
      stats.today_output = parseInt(res.rows[0].today_output || 0);
    } catch (e) { console.error('Prod Stats Error:', e.message); }

    // 3. PERSONAL QMS
    try {
      const qmsQuery = `
        SELECT 
          (SELECT COUNT(*) FROM qms_documents d 
           WHERE d.status = 'RELEASED' AND d.doc_type IN ('SOP', 'POL', 'MAN') 
           AND NOT EXISTS (SELECT 1 FROM qms_training_records tr WHERE tr.doc_id = d.doc_id AND tr.user_id = $1 AND tr.version_id = d.current_version_id)
          ) as pending_training,
          (SELECT COUNT(*) FROM qms_ncr WHERE assigned_to = $1 AND status != 'CLOSED') as assigned_ncrs
      `;
      const res = await pool.query(qmsQuery, [userId]);
      stats.pending_training = parseInt(res.rows[0].pending_training || 0);
      stats.assigned_ncrs = parseInt(res.rows[0].assigned_ncrs || 0);
    } catch (e) { console.error('QMS Stats Error:', e.message); }

    // 4. QA DEPARTMENT (FIXED STATUS STRINGS AND DERIVATION LOGIC)
    try {
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
      const res = await pool.query(qaQuery);
      stats.qa_pending_batches = parseInt(res.rows[0].pending_batch_release || 0);
      stats.qa_pending_ipqc = parseInt(res.rows[0].pending_ipqc_reviews || 0);
    } catch (e) { console.error('QA Stats Error:', e.message); }

    return stats;
  },

  async getActiveProduction() {
    const query = `
      SELECT 
        pb.batch_id, pb.batch_number, COALESCE(pb.product_name, p.product_name) as product_name, 
        CASE 
          WHEN pb.status = 'in_progress' AND EXISTS (
              SELECT 1 FROM batch_ipqc_records 
              WHERE batch_id = pb.batch_id AND (qa_status IN ('pending', 'pending_qa_review') OR qa_status IS NULL)
          ) THEN 'awaiting_qa'
          ELSE pb.status 
        END as status,
        pb.planned_quantity, pb.actual_output, pb.yield_percentage, pb.production_date
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
        END, pb.production_date ASC
      LIMIT 6
    `;
    const result = await pool.query(query);
    return result.rows;
  }
};

module.exports = DashboardService;