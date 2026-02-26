// backend/src/services/analytics-service.js
const { pool } = require('./auth-service');

// A robust query wrapper that prevents one missing table from crashing the entire BI dashboard
const safeQuery = async (queryText) => {
  try {
    const res = await pool.query(queryText);
    return res;
  } catch (err) {
    console.error(`[BI Engine] Query failed: ${err.message}`);
    return { rows: [] };
  }
};

const getDashboardMetrics = async (timeRange = '30d') => {
  let interval = '30 days';
  if (timeRange === '7d') interval = '7 days';
  if (timeRange === '90d') interval = '90 days';
  if (timeRange === '1y') interval = '1 year';
  if (timeRange === 'all') interval = '100 years';

  try {
    // ==========================================
    // 1. PRODUCTION & MANUFACTURING
    // ==========================================
    const kpiRes = await safeQuery(`
      SELECT 
        SUM(actual_output) as total_output,
        AVG(yield_percentage) as avg_yield,
        SUM(planned_quantity) as total_planned,
        SUM(rejected_bottles) as total_rejected,
        SUM(actual_output * 25) as estimated_value -- Estimated financial value of production
      FROM production_batches
      WHERE production_date >= CURRENT_DATE - INTERVAL '${interval}'
      AND status IN ('completed', 'released')
    `);

    const prodTrendRes = await safeQuery(`
      SELECT 
        TO_CHAR(pb.production_date, 'Dy') as date,
        SUM(CASE WHEN p.product_name ILIKE '%500ml%' THEN pb.actual_output ELSE 0 END) as "500ml",
        SUM(CASE WHEN p.product_name ILIKE '%750ml%' THEN pb.actual_output ELSE 0 END) as "750ml",
        SUM(CASE WHEN p.product_name ILIKE '%5 Gal%' OR p.sku ILIKE '%5GAL%' THEN pb.actual_output ELSE 0 END) as "5Gal",
        ROUND(AVG(pb.yield_percentage), 1) as yield
      FROM production_batches pb
      LEFT JOIN products p ON pb.product_id = p.product_id
      WHERE pb.production_date >= CURRENT_DATE - INTERVAL '${interval}'
      AND pb.status IN ('completed', 'released')
      GROUP BY TO_CHAR(pb.production_date, 'Dy'), pb.production_date
      ORDER BY pb.production_date ASC
    `);

    const rejectRes = await safeQuery(`
      SELECT 
        SUM((rejection_breakdown->>'underfill')::numeric) as underfill,
        SUM((rejection_breakdown->>'cap_defect')::numeric) as cap_defect,
        SUM((rejection_breakdown->>'label_defect')::numeric) as label_defect,
        SUM((rejection_breakdown->>'damaged')::numeric) as damaged,
        SUM((rejection_breakdown->>'contamination')::numeric) as contamination
      FROM batch_yield_summary bys
      JOIN production_batches pb ON bys.batch_id = pb.batch_id
      WHERE pb.production_date >= CURRENT_DATE - INTERVAL '${interval}'
    `);

    // ==========================================
    // 2. QUALITY (QMS)
    // ==========================================
    const complianceRes = await safeQuery(`
      SELECT 
        stage_name as stage,
        ROUND(COUNT(*) FILTER (WHERE all_checks_passed = true)::numeric / COUNT(*) * 100, 1) as pass_rate,
        ROUND(COUNT(*) FILTER (WHERE all_checks_passed = false)::numeric / COUNT(*) * 100, 1) as fail_rate
      FROM batch_ipqc_records
      WHERE created_at >= CURRENT_DATE - INTERVAL '${interval}'
      GROUP BY stage_name
      ORDER BY stage_name
    `);

    // ==========================================
    // 3. INVENTORY & LOCKED CASHFLOW
    // ==========================================
    const inventoryRes = await safeQuery(`
      SELECT 
        COUNT(DISTINCT product_id) as total_skus,
        SUM(quantity) as total_items,
        SUM(quantity * 15) as total_value -- Estimated Locked Cashflow (ZMW)
      FROM inventory
    `);

    // ==========================================
    // 4. CRM (CUSTOMERS & SALES)
    // ==========================================
    const crmTierRes = await safeQuery(`SELECT tier_name, COUNT(*) as count FROM customers WHERE status = 'ACTIVE' GROUP BY tier_name`);
    const crmActiveRes = await safeQuery(`SELECT COUNT(*) as total FROM customers WHERE status = 'ACTIVE'`);
    const crmPendingRes = await safeQuery(`SELECT COUNT(*) as pending FROM customers WHERE status = 'PENDING_CFO'`);

    // ==========================================
    // 5. SRM (PROCUREMENT & SPEND)
    // ==========================================
    const srmActiveRes = await safeQuery(`SELECT COUNT(*) as total FROM vendors WHERE status IN ('APPROVED', 'CONDITIONALLY_APPROVED')`);
    const poSpendRes = await safeQuery(`
      SELECT currency, SUM(total_amount) as total_spend, COUNT(*) as po_count
      FROM purchase_orders 
      WHERE status IN ('APPROVED', 'PARTIALLY_RECEIVED', 'FULLY_RECEIVED', 'CLOSED')
      AND date_raised >= CURRENT_DATE - INTERVAL '${interval}'
      GROUP BY currency
    `);
    const poPendingRes = await safeQuery(`SELECT status, COUNT(*) as count, SUM(total_amount) as value FROM purchase_orders WHERE status IN ('PENDING_CFO', 'PENDING_CEO') GROUP BY status`);


    // ==========================================
    // DATA FORMATTING FOR FRONTEND
    // ==========================================
    const kpiData = kpiRes.rows[0] || {};
    const inventoryData = inventoryRes.rows[0] || {};
    const rawRejections = rejectRes.rows[0] || {};
    
    const rejectionData = [
      { name: 'Underfill', value: parseFloat(rawRejections.underfill || 0), color: '#f97316' },
      { name: 'Cap Defect', value: parseFloat(rawRejections.cap_defect || 0), color: '#f59e0b' },
      { name: 'Label Defect', value: parseFloat(rawRejections.label_defect || 0), color: '#8b5cf6' },
      { name: 'Damaged', value: parseFloat(rawRejections.damaged || 0), color: '#ef4444' },
      { name: 'Contamination', value: parseFloat(rawRejections.contamination || 0), color: '#6b7280' }
    ].filter(item => item.value > 0);

    const complianceData = complianceRes.rows.map(row => ({
      stage: row.stage,
      pass: parseFloat(row.pass_rate || 0),
      fail: parseFloat(row.fail_rate || 0)
    }));

    const oee = kpiData.total_planned > 0 
      ? ((kpiData.total_output / kpiData.total_planned) * (kpiData.avg_yield / 100) * 100).toFixed(1)
      : 0;

    const totalPoPendingCount = poPendingRes.rows.reduce((sum, row) => sum + parseInt(row.count), 0);

    return {
      overview: {
        oee: oee,
        totalProductionValue: kpiData.estimated_value || 0,
        lockedCashflow: inventoryData.total_value || 0,
        pendingApprovals: parseInt(crmPendingRes.rows[0]?.pending || 0) + totalPoPendingCount
      },
      production: {
        kpis: {
          totalOutput: kpiData.total_output || 0,
          avgYield: parseFloat(kpiData.avg_yield || 0).toFixed(1),
          totalValue: kpiData.estimated_value || 0
        },
        trendData: prodTrendRes.rows,
        rejectionData: rejectionData.length > 0 ? rejectionData : [{ name: 'No Rejections', value: 1, color: '#10b981' }],
      },
      inventory: {
        kpis: {
          totalItems: inventoryData.total_items || 0,
          totalValue: inventoryData.total_value || 0,
          totalSkus: inventoryData.total_skus || 0
        },
        warehouseUtilization: [
          { name: 'Raw Materials (Zone A)', used: 85, color: '#3b82f6' },
          { name: 'Finished Goods (Zone B)', used: 62, color: '#10b981' },
          { name: 'Packaging (Zone C)', used: 92, color: '#f97316' }
        ]
      },
      quality: {
        complianceData: complianceData,
        accuracyTrend: [
          { day: 'Mon', accuracy: 98.5 }, { day: 'Tue', accuracy: 98.8 }, { day: 'Wed', accuracy: 98.2 }
        ]
      },
      crm: {
        totalActive: parseInt(crmActiveRes.rows[0]?.total || 0),
        pendingApproval: parseInt(crmPendingRes.rows[0]?.pending || 0),
        byTier: crmTierRes.rows.map(row => ({
          name: row.tier_name || 'Unassigned',
          value: parseInt(row.count)
        }))
      },
      srm: {
        totalActive: parseInt(srmActiveRes.rows[0]?.total || 0),
        spendByCurrency: poSpendRes.rows,
        pendingApprovals: poPendingRes.rows
      }
    };

  } catch (error) {
    console.error('Error calculating analytics:', error);
    throw error;
  }
};

module.exports = {
  getDashboardMetrics
};