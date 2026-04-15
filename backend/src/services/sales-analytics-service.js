// ============================================================================
// SALES ANALYTICS SERVICE — Phase D2 + D3
// backend/src/services/sales-analytics-service.js
// ============================================================================

const { query } = require('../utils/db'); 

const safeQuery = async (queryText) => {
  try {
    const res = await query(queryText);
    return res;
  } catch (err) {
    console.error(`[SalesAnalytics] CRITICAL Query failed: ${err.message}`);
    return { rows: [] };
  }
};

async function getLiveExchangeRate() {
  try {
    const result = await query(`
      SELECT rate_value 
      FROM exchange_rates 
      WHERE target_currency = 'ZMW' AND is_active = true 
      ORDER BY updated_at DESC LIMIT 1
    `);
    if (result.rows.length > 0) return parseFloat(result.rows[0].rate_value);
    return 27.00; 
  } catch (e) {
    console.error('⚠️ Database error fetching exchange rate for analytics:', e.message);
    return 27.00;
  }
}

const buildInterval = (timeRange) => {
  if (timeRange === '7d')  return '7 days';
  if (timeRange === '90d') return '90 days';
  if (timeRange === '1y')  return '1 year';
  return '30 days';
};

const getSalesAnalytics = async (timeRange = '30d') => {
  const interval = buildInterval(timeRange);

  // D2-1: KPIs
  // FIX: Replaced FILTER syntax with universally compatible CASE WHEN aggregation.
  const kpiRes = await safeQuery(`
    SELECT
      COUNT(*) AS total_transactions,
      COALESCE(SUM(total_amount::numeric), 0) AS total_revenue,
      COALESCE(AVG(CASE WHEN TRIM(status)='completed' THEN total_amount::numeric ELSE NULL END), 0) AS avg_order_value,
      COALESCE(SUM(order_discount_amount::numeric), 0) AS total_discounts,
      SUM(CASE WHEN TRIM(status)='voided' THEN 1 ELSE 0 END) AS void_count,
      COALESCE(SUM(CASE WHEN TRIM(status)='voided' THEN total_amount::numeric ELSE 0 END), 0) AS voided_revenue,
      COUNT(DISTINCT CASE WHEN customer_id IS NOT NULL THEN customer_id ELSE NULL END) AS unique_customers,
      SUM(CASE WHEN customer_id IS NULL AND TRIM(status)='completed' THEN 1 ELSE 0 END) AS walkin_count
    FROM sales_transactions
    WHERE transaction_date::timestamp >= NOW() - INTERVAL '${interval}'
  `);

  // D2-2: Revenue + units by SKU
  // FIX: Dynamic line_total calculation fallback
  const skuRes = await safeQuery(`
    SELECT
      p.sku,
      p.product_name,
      COALESCE(SUM(stl.quantity::numeric), 0) AS units_sold,
      COALESCE(SUM(COALESCE(stl.line_total::numeric, (stl.quantity::numeric * stl.unit_price::numeric) - COALESCE(stl.line_discount::numeric, 0))), 0) AS revenue,
      COALESCE(AVG(stl.unit_price::numeric), 0) AS avg_price,
      COUNT(DISTINCT stl.transaction_id) AS order_count,
      COALESCE(SUM(stl.line_discount::numeric), 0) AS total_discounts
    FROM sales_transaction_lines stl
    JOIN products p ON stl.product_id = p.product_id
    JOIN sales_transactions st ON stl.transaction_id = st.transaction_id
    WHERE st.transaction_date::timestamp >= NOW() - INTERVAL '${interval}'
      AND TRIM(st.status) = 'completed'
    GROUP BY p.product_id, p.sku, p.product_name
    ORDER BY revenue DESC
  `);

  // D2-3: Daily trend — B2B vs walk-in
  const dailyTrendRes = await safeQuery(`
    SELECT
      DATE(transaction_date::timestamp) AS sale_date,
      SUM(CASE WHEN TRIM(status)='completed' THEN 1 ELSE 0 END) AS transactions,
      COALESCE(SUM(CASE WHEN TRIM(status)='completed' THEN total_amount::numeric ELSE 0 END), 0) AS revenue,
      COALESCE(SUM(CASE WHEN TRIM(status)='completed' AND customer_id IS NOT NULL THEN total_amount::numeric ELSE 0 END), 0) AS b2b_revenue,
      COALESCE(SUM(CASE WHEN TRIM(status)='completed' AND customer_id IS NULL THEN total_amount::numeric ELSE 0 END), 0) AS walkin_revenue
    FROM sales_transactions
    WHERE transaction_date::timestamp >= NOW() - INTERVAL '${interval}'
    GROUP BY DATE(transaction_date::timestamp)
    ORDER BY sale_date ASC
  `);

  // D2-4: Weekly
  const weeklyRes = await safeQuery(`
    SELECT
      TO_CHAR(DATE_TRUNC('week', transaction_date::timestamp), 'DD Mon') AS week_start,
      COALESCE(SUM(total_amount::numeric), 0) AS revenue,
      COUNT(*) AS transactions
    FROM sales_transactions
    WHERE transaction_date::timestamp >= NOW() - INTERVAL '12 weeks'
      AND TRIM(status) = 'completed'
    GROUP BY DATE_TRUNC('week', transaction_date::timestamp)
    ORDER BY DATE_TRUNC('week', transaction_date::timestamp) ASC
  `);

  // D2-5: Monthly
  const monthlyRes = await safeQuery(`
    SELECT
      TO_CHAR(DATE_TRUNC('month', transaction_date::timestamp), 'Mon YYYY') AS month,
      COALESCE(SUM(total_amount::numeric), 0) AS revenue,
      COUNT(*) AS transactions
    FROM sales_transactions
    WHERE transaction_date::timestamp >= NOW() - INTERVAL '12 months'
      AND TRIM(status) = 'completed'
    GROUP BY DATE_TRUNC('month', transaction_date::timestamp)
    ORDER BY DATE_TRUNC('month', transaction_date::timestamp) ASC
  `);

  // D2-6: Peak hours heatmap
  const heatmapRes = await safeQuery(`
    SELECT
      EXTRACT(DOW FROM transaction_date::timestamp)::int AS day_of_week,
      EXTRACT(HOUR FROM transaction_date::timestamp)::int AS hour,
      COUNT(*) AS transaction_count,
      COALESCE(SUM(total_amount::numeric), 0) AS revenue
    FROM sales_transactions
    WHERE transaction_date::timestamp >= NOW() - INTERVAL '${interval}'
      AND TRIM(status) = 'completed'
    GROUP BY day_of_week, hour
    ORDER BY day_of_week, hour
  `);

  // D2-7: Payment method breakdown
  const paymentRes = await safeQuery(`
    SELECT
      payment_method,
      COUNT(*) AS count,
      COALESCE(SUM(total_amount::numeric), 0) AS revenue,
      ROUND(COUNT(*)::numeric / NULLIF(SUM(COUNT(*)) OVER (), 0) * 100, 1) AS pct
    FROM sales_transactions
    WHERE transaction_date::timestamp >= NOW() - INTERVAL '${interval}'
      AND TRIM(status) = 'completed'
    GROUP BY payment_method
    ORDER BY revenue DESC
  `);

  // D2-8: Void / return rate by day
  const voidRes = await safeQuery(`
    SELECT
      DATE(transaction_date::timestamp) AS sale_date,
      SUM(CASE WHEN TRIM(status)='completed' THEN 1 ELSE 0 END) AS completed,
      SUM(CASE WHEN TRIM(status)='voided' THEN 1 ELSE 0 END) AS voided,
      ROUND(SUM(CASE WHEN TRIM(status)='voided' THEN 1 ELSE 0 END)::numeric / NULLIF(COUNT(*), 0) * 100, 2) AS void_rate_pct
    FROM sales_transactions
    WHERE transaction_date::timestamp >= NOW() - INTERVAL '${interval}'
    GROUP BY DATE(transaction_date::timestamp)
    ORDER BY sale_date ASC
  `);

  // D2-9: Top 10 customers
  const topCustomersRes = await safeQuery(`
    SELECT
      COALESCE(c.trading_name, 'Walk-in') AS customer_name,
      c.tier_name,
      c.vtl_customer_id,
      COUNT(st.transaction_id) AS orders,
      COALESCE(SUM(st.total_amount::numeric), 0) AS revenue,
      MAX(st.transaction_date::timestamp) AS last_purchase
    FROM sales_transactions st
    LEFT JOIN customers c ON st.customer_id = c.customer_id
    WHERE st.transaction_date::timestamp >= NOW() - INTERVAL '${interval}'
      AND TRIM(st.status) = 'completed'
    GROUP BY c.customer_id, c.trading_name, c.tier_name, c.vtl_customer_id
    ORDER BY revenue DESC
    LIMIT 10
  `);

  // D3-1: SKU demand trend
  const demandTrendRes = await safeQuery(`
    SELECT
      p.sku,
      p.product_name,
      DATE_TRUNC('week', st.transaction_date::timestamp)::date AS week_start,
      COALESCE(SUM(stl.quantity::numeric), 0) AS units_sold
    FROM sales_transaction_lines stl
    JOIN products p ON stl.product_id = p.product_id
    JOIN sales_transactions st ON stl.transaction_id = st.transaction_id
    WHERE st.transaction_date::timestamp >= NOW() - INTERVAL '12 weeks'
      AND TRIM(st.status) = 'completed'
    GROUP BY p.product_id, p.sku, p.product_name, DATE_TRUNC('week', st.transaction_date::timestamp)
    ORDER BY p.sku, week_start ASC
  `);

  // D3-2: Slow movers
  // FIX: Isolated the Inventory query to prevent data duplication (Fan-out)
  const slowMoversRes = await safeQuery(`
    SELECT
      p.product_id, p.sku, p.product_name,
      p.selling_price, p.selling_price_zmw,
      COALESCE(inv.stock_on_hand, 0) AS stock_on_hand,
      COALESCE(sales.units_sold, 0) AS units_sold_period,
      COALESCE(sales.revenue, 0) AS revenue_period
    FROM products p
    LEFT JOIN (
      SELECT product_id, SUM(quantity_on_hand::numeric) AS stock_on_hand
      FROM inventory GROUP BY product_id
    ) inv ON p.product_id = inv.product_id
    LEFT JOIN (
      SELECT 
        stl.product_id,
        SUM(stl.quantity::numeric) AS units_sold,
        SUM(COALESCE(stl.line_total::numeric, (stl.quantity::numeric * stl.unit_price::numeric) - COALESCE(stl.line_discount::numeric, 0))) AS revenue
      FROM sales_transaction_lines stl
      JOIN sales_transactions st ON stl.transaction_id = st.transaction_id
      WHERE st.transaction_date::timestamp >= NOW() - INTERVAL '${interval}'
        AND TRIM(st.status) = 'completed'
      GROUP BY stl.product_id
    ) sales ON p.product_id = sales.product_id
    WHERE p.is_active = true
    GROUP BY p.product_id, p.sku, p.product_name, p.selling_price, p.selling_price_zmw, inv.stock_on_hand, sales.units_sold, sales.revenue
    ORDER BY units_sold_period ASC
  `);

  // D3-3: Bundling co-occurrence
  const bundleRes = await safeQuery(`
    SELECT
      p1.product_name AS product_a, p2.product_name AS product_b,
      p1.sku AS sku_a, p2.sku AS sku_b,
      COUNT(*) AS co_occurrence_count
    FROM sales_transaction_lines a
    JOIN sales_transaction_lines b ON a.transaction_id = b.transaction_id AND a.product_id < b.product_id
    JOIN sales_transactions st ON a.transaction_id = st.transaction_id
    JOIN products p1 ON a.product_id = p1.product_id
    JOIN products p2 ON b.product_id = p2.product_id
    WHERE st.transaction_date::timestamp >= NOW() - INTERVAL '${interval}'
      AND TRIM(st.status) = 'completed'
    GROUP BY p1.product_name, p2.product_name, p1.sku, p2.sku
    ORDER BY co_occurrence_count DESC
    LIMIT 10
  `);

  // D3-4: Seasonal pattern
  const seasonalRes = await safeQuery(`
    SELECT
      EXTRACT(YEAR FROM transaction_date::timestamp)::int AS year,
      EXTRACT(MONTH FROM transaction_date::timestamp)::int AS month_num,
      TO_CHAR(transaction_date::timestamp, 'Mon') AS month_name,
      COALESCE(SUM(total_amount::numeric), 0) AS revenue,
      SUM(CASE WHEN TRIM(status)='completed' THEN 1 ELSE 0 END) AS transactions
    FROM sales_transactions
    WHERE transaction_date::timestamp >= NOW() - INTERVAL '2 years'
      AND TRIM(status) = 'completed'
    GROUP BY year, month_num, month_name
    ORDER BY year, month_num
  `);

  // ── Assemble ──────────────────────────────────────────────────────────────
  const kpi = kpiRes.rows[0] || {};
  const totalTxns = parseInt(kpi.total_transactions || 0);
  const voidCount = parseInt(kpi.void_count || 0);
  const exchangeRate = await getLiveExchangeRate(); 

  const heatmap = Array.from({ length: 7 }, (_, d) =>
    Array.from({ length: 24 }, (_, h) => {
      const cell = heatmapRes.rows.find(r => r.day_of_week === d && r.hour === h);
      return { day: d, hour: h,
        count: parseInt(cell?.transaction_count || 0),
        revenue: parseFloat(cell?.revenue || 0) };
    })
  );

  const demandTrend = {};
  demandTrendRes.rows.forEach(r => {
    if (!demandTrend[r.sku]) demandTrend[r.sku] = { product_name: r.product_name, points: [] };
    demandTrend[r.sku].points.push({ week: r.week_start, units: parseInt(r.units_sold) });
  });

  return {
    exchangeRate, 
    kpis: {
      totalRevenue:      parseFloat(kpi.total_revenue   || 0),
      totalTransactions: totalTxns,
      avgOrderValue:     parseFloat(kpi.avg_order_value || 0),
      totalDiscounts:    parseFloat(kpi.total_discounts || 0),
      voidCount,
      voidedRevenue:     parseFloat(kpi.voided_revenue  || 0),
      voidRate:          totalTxns > 0 ? parseFloat(((voidCount / totalTxns) * 100).toFixed(2)) : 0,
      uniqueCustomers:   parseInt(kpi.unique_customers  || 0),
      walkinCount:       parseInt(kpi.walkin_count      || 0),
    },
    revenueBySku:     skuRes.rows,
    dailyTrend:       dailyTrendRes.rows,
    weeklyTrend:      weeklyRes.rows,
    monthlyTrend:     monthlyRes.rows,
    heatmap,
    paymentBreakdown: paymentRes.rows,
    voidTrend:        voidRes.rows,
    topCustomers:     topCustomersRes.rows,
    marketing: {
      demandTrend,
      slowMovers: slowMoversRes.rows,
      bundles:    bundleRes.rows,
      seasonal:   seasonalRes.rows,
    },
  };
};

const toCSV = (rows, cols) => {
  if (!rows?.length) return cols.join(',') + '\n';
  const esc = v => { const s = String(v ?? ''); return s.includes(',') || s.includes('"') ? `"${s.replace(/"/g,'""')}"` : s; };
  return [cols.join(','), ...rows.map(r => cols.map(c => esc(r[c])).join(','))].join('\n');
};

const getSalesCSVExport = async (timeRange = '30d', exportType = 'transactions') => {
  const interval = buildInterval(timeRange);

  if (exportType === 'transactions') {
    const res = await safeQuery(`
      SELECT st.receipt_number,
        TO_CHAR(st.transaction_date::timestamp,'YYYY-MM-DD HH24:MI') AS transaction_date,
        COALESCE(c.trading_name,'Walk-in') AS customer, c.tier_name,
        st.payment_method,
        ROUND(st.subtotal::numeric,2) AS subtotal,
        ROUND(st.order_discount_amount::numeric,2) AS discount,
        ROUND(st.total_amount::numeric,2) AS total,
        st.status, u.full_name AS cashier
      FROM sales_transactions st
      LEFT JOIN customers c ON st.customer_id = c.customer_id
      JOIN users u ON st.cashier_id = u.user_id
      WHERE st.transaction_date::timestamp >= NOW() - INTERVAL '${interval}'
      ORDER BY st.transaction_date::timestamp DESC
    `);
    return toCSV(res.rows, ['receipt_number','transaction_date','customer','tier_name','payment_method','subtotal','discount','total','status','cashier']);
  }
  if (exportType === 'sku_performance') {
    const res = await safeQuery(`
      SELECT p.sku, p.product_name,
        COALESCE(SUM(stl.quantity::numeric),0) AS units_sold,
        ROUND(SUM(COALESCE(stl.line_total::numeric, (stl.quantity::numeric * stl.unit_price::numeric) - COALESCE(stl.line_discount::numeric, 0)))::numeric,2) AS revenue,
        ROUND(AVG(stl.unit_price::numeric),4) AS avg_price,
        ROUND(SUM(stl.line_discount::numeric),2) AS discounts_given,
        COUNT(DISTINCT stl.transaction_id) AS order_count
      FROM sales_transaction_lines stl
      JOIN products p ON stl.product_id = p.product_id
      JOIN sales_transactions st ON stl.transaction_id = st.transaction_id
      WHERE st.transaction_date::timestamp >= NOW() - INTERVAL '${interval}'
        AND TRIM(st.status)='completed'
      GROUP BY p.product_id, p.sku, p.product_name
      ORDER BY revenue DESC
    `);
    return toCSV(res.rows, ['sku','product_name','units_sold','revenue','avg_price','discounts_given','order_count']);
  }
  if (exportType === 'bundles') {
    const res = await safeQuery(`
      SELECT p1.product_name AS product_a, p1.sku AS sku_a,
             p2.product_name AS product_b, p2.sku AS sku_b,
             COUNT(*) AS co_occurrence_count
      FROM sales_transaction_lines a
      JOIN sales_transaction_lines b ON a.transaction_id=b.transaction_id AND a.product_id < b.product_id
      JOIN sales_transactions st ON a.transaction_id=st.transaction_id
      JOIN products p1 ON a.product_id=p1.product_id
      JOIN products p2 ON b.product_id=p2.product_id
      WHERE st.transaction_date::timestamp >= NOW() - INTERVAL '${interval}' AND TRIM(st.status)='completed'
      GROUP BY p1.product_name,p2.product_name,p1.sku,p2.sku ORDER BY co_occurrence_count DESC
    `);
    return toCSV(res.rows, ['product_a','sku_a','product_b','sku_b','co_occurrence_count']);
  }
  if (exportType === 'seasonal') {
    const res = await safeQuery(`
      SELECT EXTRACT(YEAR FROM transaction_date::timestamp)::int AS year,
             TO_CHAR(transaction_date::timestamp,'Mon') AS month,
             EXTRACT(MONTH FROM transaction_date::timestamp)::int AS month_num,
             SUM(CASE WHEN TRIM(status)='completed' THEN 1 ELSE 0 END) AS transactions,
             ROUND(SUM(total_amount::numeric),2) AS revenue
      FROM sales_transactions
      WHERE transaction_date::timestamp >= NOW() - INTERVAL '2 years' AND TRIM(status)='completed'
      GROUP BY year,month,month_num ORDER BY year,month_num
    `);
    return toCSV(res.rows, ['year','month','transactions','revenue']);
  }
  return 'export_type_not_recognised\n';
};

module.exports = { getSalesAnalytics, getSalesCSVExport };