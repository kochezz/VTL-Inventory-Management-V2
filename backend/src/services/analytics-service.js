// backend/src/services/analytics-service.js
// Analytics Service - Aggregates real-time data for the BI Dashboard

const { pool } = require('./auth-service');

const getDashboardMetrics = async (timeRange = '30d') => {
  // Determine date interval based on timeRange
  let interval = '30 days';
  if (timeRange === '7d') interval = '7 days';
  if (timeRange === '90d') interval = '90 days';
  if (timeRange === '1y') interval = '1 year';

  try {
    // 1. Executive KPIs
    const kpiQuery = `
      SELECT 
        SUM(actual_output) as total_output,
        AVG(yield_percentage) as avg_yield,
        SUM(planned_quantity) as total_planned,
        SUM(rejected_bottles) as total_rejected
      FROM production_batches
      WHERE production_date >= CURRENT_DATE - INTERVAL '${interval}'
      AND status IN ('completed', 'released')
    `;

    // 2. Production Output vs Yield (Daily grouping)
    // Pivots data to separate 500ml, 750ml, and 5Gal based on product_name/sku
    const productionTrendQuery = `
      SELECT 
        TO_CHAR(production_date, 'Dy') as date,
        SUM(CASE WHEN p.product_name ILIKE '%500ml%' THEN pb.actual_output ELSE 0 END) as "500ml",
        SUM(CASE WHEN p.product_name ILIKE '%750ml%' THEN pb.actual_output ELSE 0 END) as "750ml",
        SUM(CASE WHEN p.product_name ILIKE '%5 Gal%' OR p.sku ILIKE '%5GAL%' THEN pb.actual_output ELSE 0 END) as "5Gal",
        ROUND(AVG(pb.yield_percentage), 1) as yield
      FROM production_batches pb
      LEFT JOIN products p ON pb.product_id = p.product_id
      WHERE pb.production_date >= CURRENT_DATE - INTERVAL '${interval}'
      AND pb.status IN ('completed', 'released')
      GROUP BY TO_CHAR(production_date, 'Dy'), pb.production_date
      ORDER BY pb.production_date ASC
    `;

    // 3. Rejection Pareto
    // Sums up the JSONB rejection_breakdown data from batch_yield_summary
    const rejectionQuery = `
      SELECT 
        SUM((rejection_breakdown->>'underfill')::numeric) as underfill,
        SUM((rejection_breakdown->>'cap_defect')::numeric) as cap_defect,
        SUM((rejection_breakdown->>'label_defect')::numeric) as label_defect,
        SUM((rejection_breakdown->>'damaged')::numeric) as damaged,
        SUM((rejection_breakdown->>'contamination')::numeric) as contamination
      FROM batch_yield_summary bys
      JOIN production_batches pb ON bys.batch_id = pb.batch_id
      WHERE pb.production_date >= CURRENT_DATE - INTERVAL '${interval}'
    `;

    // 4. IPQC Compliance by Stage
    const complianceQuery = `
      SELECT 
        stage_name as stage,
        ROUND(COUNT(*) FILTER (WHERE all_checks_passed = true)::numeric / COUNT(*) * 100, 1) as pass_rate,
        ROUND(COUNT(*) FILTER (WHERE all_checks_passed = false)::numeric / COUNT(*) * 100, 1) as fail_rate
      FROM batch_ipqc_records
      WHERE created_at >= CURRENT_DATE - INTERVAL '${interval}'
      GROUP BY stage_name
      ORDER BY stage_name
    `;

    // Run all queries simultaneously for performance
    const [kpiRes, prodTrendRes, rejectRes, complianceRes] = await Promise.all([
      pool.query(kpiQuery),
      pool.query(productionTrendQuery),
      pool.query(rejectionQuery),
      pool.query(complianceQuery)
    ]);

    // Format Data for the Frontend
    const kpiData = kpiRes.rows[0];
    const rawRejections = rejectRes.rows[0] || {};
    
    // Map rejections to array format for Recharts PieChart
    const rejectionData = [
      { name: 'Underfill', value: parseFloat(rawRejections.underfill || 0), color: '#f97316' },
      { name: 'Cap Defect', value: parseFloat(rawRejections.cap_defect || 0), color: '#f59e0b' },
      { name: 'Label Defect', value: parseFloat(rawRejections.label_defect || 0), color: '#8b5cf6' },
      { name: 'Damaged', value: parseFloat(rawRejections.damaged || 0), color: '#ef4444' },
      { name: 'Contamination', value: parseFloat(rawRejections.contamination || 0), color: '#6b7280' }
    ].filter(item => item.value > 0); // Only send categories that actually have rejections

    // Map compliance data for Recharts BarChart
    const complianceData = complianceRes.rows.map(row => ({
      stage: row.stage,
      pass: parseFloat(row.pass_rate || 0),
      fail: parseFloat(row.fail_rate || 0)
    }));

    // Calculate OEE (Basic calculation: Output / Planned * Yield)
    const oee = kpiData.total_planned > 0 
      ? ((kpiData.total_output / kpiData.total_planned) * (kpiData.avg_yield / 100) * 100).toFixed(1)
      : 0;

    return {
      kpis: {
        totalOutput: kpiData.total_output || 0,
        avgYield: parseFloat(kpiData.avg_yield || 0).toFixed(1),
        oee: oee
      },
      productionOutputData: prodTrendRes.rows,
      rejectionData: rejectionData.length > 0 ? rejectionData : [{ name: 'No Rejections', value: 1, color: '#10b981' }],
      complianceData: complianceData
    };

  } catch (error) {
    console.error('Error calculating analytics:', error);
    throw error;
  }
};

module.exports = {
  getDashboardMetrics
};