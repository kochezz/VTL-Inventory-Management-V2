// ============================================================================
// MOBILE SERVICE — Aggregate endpoints for VTL Executive mobile app
// ============================================================================

const { pool } = require('./auth-service');
const qmsService = require('./qms-service');

const mobileService = {

  // --------------------------------------------------------------------------
  // getDashboardSummary
  // Returns all KPI counts in a single round-trip.
  // Each query is isolated via Promise.allSettled so one failure doesn't
  // prevent the rest of the dashboard from rendering.
  // --------------------------------------------------------------------------
  async getDashboardSummary() {
    const defaults = {
      active_batches: 0,
      open_ncrs: 0,
      overdue_capas: 0,
      low_stock_items: 0,
      zero_stock_items: 0,
      pending_docs_review: 0,
      qms_completion_pct: 0,
      recent_transactions_count: 0
    };

    const [batchRes, ncrRes, capaRes, lowRes, zeroRes, docsRes, txnRes, qmsRes] =
      await Promise.allSettled([
        pool.query(`
          SELECT COUNT(*) FROM production_batches
          WHERE status NOT IN ('completed','released','rejected')
        `),
        pool.query(`SELECT COUNT(*) FROM qms_ncr WHERE status = 'OPEN'`),
        pool.query(`
          SELECT COUNT(*) FROM qms_capa
          WHERE status NOT IN ('CLOSED','VERIFIED') AND due_date < NOW()
        `),
        pool.query(`
          SELECT COUNT(DISTINCT i.inventory_id)
          FROM inventory i
          JOIN products p ON i.product_id = p.product_id
          WHERE i.quantity_on_hand > 0
            AND i.quantity_on_hand <= p.reorder_level
            AND p.is_active = true
            AND p.product_id IN (
              SELECT DISTINCT finished_product_id
              FROM product_bom
            )
        `),
        pool.query(`
          SELECT COUNT(*)
          FROM inventory i
          JOIN products p ON i.product_id = p.product_id
          WHERE i.quantity_on_hand = 0
            AND p.is_active = true
            AND p.product_id IN (
              SELECT DISTINCT finished_product_id
              FROM product_bom
            )
        `),
        pool.query(`SELECT COUNT(*) FROM qms_documents WHERE status = 'REVIEW'`),
        pool.query(`
          SELECT COUNT(*) FROM inventory_transactions
          WHERE created_at >= NOW() - INTERVAL '24 hours'
        `),
        qmsService.getCompletionStats()
      ]);

    const cnt = (res) =>
      res.status === 'fulfilled' ? parseInt(res.value?.rows?.[0]?.count || 0) : 0;

    return {
      active_batches: cnt(batchRes),
      open_ncrs: cnt(ncrRes),
      overdue_capas: cnt(capaRes),
      low_stock_items: cnt(lowRes),
      zero_stock_items: cnt(zeroRes),
      pending_docs_review: cnt(docsRes),
      recent_transactions_count: cnt(txnRes),
      qms_completion_pct:
        qmsRes.status === 'fulfilled' ? (qmsRes.value?.overall_completion || 0) : 0
    };
  },

  // --------------------------------------------------------------------------
  // getAlertFeed
  // Combines NCRs, overdue CAPAs, zero-stock items, and docs in review into
  // a single chronological feed ordered by recency.
  // --------------------------------------------------------------------------
  async getAlertFeed(limit = 20) {
    const query = `
      SELECT * FROM (

        -- NCRs this month
        SELECT
          n.ncr_id::text                    AS id,
          'NCR'                             AS type,
          'Non-Conformance: ' || n.ncr_code AS title,
          n.description,
          n.severity,
          n.created_at,
          u.full_name                       AS actor_name
        FROM qms_ncr n
        LEFT JOIN users u ON n.raised_by::uuid = u.user_id
        WHERE n.created_at >= DATE_TRUNC('month', NOW())

        UNION ALL

        -- Overdue CAPAs created this month
        SELECT
          c.capa_id::text                       AS id,
          'CAPA_OVERDUE'                        AS type,
          'Overdue CAPA: ' || c.capa_code       AS title,
          c.action_description                  AS description,
          'HIGH'                                AS severity,
          COALESCE(c.created_at, NOW())         AS created_at,
          u.full_name                           AS actor_name
        FROM qms_capa c
        LEFT JOIN users u ON c.action_owner::uuid = u.user_id
        WHERE c.due_date < NOW()
          AND c.status NOT IN ('CLOSED','VERIFIED')
          AND c.created_at >= DATE_TRUNC('month', NOW())

        UNION ALL

        -- Zero-stock products updated this month
        SELECT
          i.inventory_id::text                                AS id,
          'ZERO_STOCK'                                        AS type,
          'Zero Stock: ' || p.product_name                   AS title,
          'Product has no remaining stock'                    AS description,
          'MEDIUM'                                            AS severity,
          COALESCE(i.last_updated, NOW())                     AS created_at,
          NULL                                                AS actor_name
        FROM inventory i
        JOIN products p ON i.product_id = p.product_id
        WHERE i.quantity_on_hand = 0
          AND p.is_active = true
          AND p.product_id IN (
            SELECT DISTINCT finished_product_id
            FROM product_bom
          )
          AND COALESCE(i.last_updated, NOW()) >= DATE_TRUNC('month', NOW())

        UNION ALL

        -- Documents awaiting review created this month
        SELECT
          d.doc_id::text                                      AS id,
          'DOC_REVIEW'                                        AS type,
          'Document Review: ' || d.doc_name                  AS title,
          d.doc_code || ' requires review approval'           AS description,
          'LOW'                                               AS severity,
          d.created_at,
          NULL                                                AS actor_name
        FROM qms_documents d
        WHERE d.status = 'REVIEW'
          AND d.created_at >= DATE_TRUNC('month', NOW())

      ) alerts
      ORDER BY created_at DESC NULLS LAST
      LIMIT $1
    `;
    try {
      const result = await pool.query(query, [limit]);
      const alerts = result.rows;
      return {
        alerts,
        total_this_month: alerts.length,
        month_label: new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' }),
      };
    } catch (err) {
      console.error('❌ getAlertFeed error:', err.message);
      return { alerts: [], total_this_month: 0, month_label: '' };
    }
  },

  // --------------------------------------------------------------------------
  // getOperationsSummary
  // --------------------------------------------------------------------------
  async getOperationsSummary() {
    const [batchRes, stockRes, txnRes] = await Promise.allSettled([

      pool.query(`
        SELECT
          pb.batch_id, pb.batch_number,
          COALESCE(pb.product_name, p.product_name, 'Unknown') AS product_name,
          pb.status,
          pb.production_date AS created_at,
          u.full_name AS created_by_name
        FROM production_batches pb
        LEFT JOIN products p ON pb.product_id = p.product_id
        LEFT JOIN users u ON pb.created_by::uuid = u.user_id
        ORDER BY pb.production_date DESC NULLS LAST
        LIMIT 10
      `),

      pool.query(`
        SELECT
          p.product_id, p.product_name,
          COALESCE(p.sku, '') AS sku,
          COALESCE(SUM(i.quantity_on_hand), 0)::int AS quantity,
          p.reorder_level,
          STRING_AGG(DISTINCT l.location_name, ', ') AS warehouse_location
        FROM products p
        JOIN inventory i ON p.product_id = i.product_id
        LEFT JOIN warehouse_locations l ON i.location_id = l.location_id
        WHERE p.is_active = true
          AND i.quantity_on_hand > 0
          AND i.quantity_on_hand <= p.reorder_level
          AND p.product_id IN (
            SELECT DISTINCT finished_product_id
            FROM product_bom
          )
        GROUP BY p.product_id, p.product_name, p.sku, p.reorder_level
        ORDER BY quantity ASC
        LIMIT 10
      `),

      pool.query(`
        SELECT
          tt.type_name AS transaction_type,
          p.product_name,
          it.quantity,
          COALESCE(l.location_name, tl.location_name, 'Unknown') AS location,
          u.full_name AS operator_name,
          it.created_at
        FROM inventory_transactions it
        LEFT JOIN products p ON it.product_id = p.product_id
        LEFT JOIN transaction_types tt ON it.transaction_type_id = tt.transaction_type_id
        LEFT JOIN warehouse_locations l ON it.from_location_id = l.location_id
        LEFT JOIN warehouse_locations tl ON it.to_location_id = tl.location_id
        LEFT JOIN users u ON it.performed_by = u.user_id
        ORDER BY it.created_at DESC NULLS LAST
        LIMIT 15
      `)
    ]);

    return {
      batches: batchRes.status === 'fulfilled' ? batchRes.value.rows : [],
      low_stock: stockRes.status === 'fulfilled' ? stockRes.value.rows : [],
      recent_transactions: txnRes.status === 'fulfilled' ? txnRes.value.rows : []
    };
  },

  // --------------------------------------------------------------------------
  // getQualitySummary
  // --------------------------------------------------------------------------
  async getQualitySummary() {
    const [sectionsRes, ncrRes, capaRes, auditRes, trainingRes, docsRes] = await Promise.allSettled([

      qmsService.getCompletionStats(),

      pool.query(`
        SELECT
          n.ncr_id, n.ncr_code, n.description, n.severity, n.status,
          n.created_at,
          r.full_name AS raised_by_name,
          a.full_name AS assigned_to_name
        FROM qms_ncr n
        LEFT JOIN users r ON n.raised_by::uuid = r.user_id
        LEFT JOIN users a ON n.assigned_to::uuid = a.user_id
        WHERE n.status IN ('OPEN','CAPA_REQUIRED')
        ORDER BY n.created_at DESC NULLS LAST
        LIMIT 20
      `),

      pool.query(`
        SELECT
          c.capa_id, c.capa_code, c.action_description, c.due_date, c.status,
          COALESCE(c.created_at, NOW()) AS created_at,
          o.full_name AS owner_name
        FROM qms_capa c
        LEFT JOIN users o ON c.action_owner::uuid = o.user_id
        WHERE c.due_date < NOW()
          AND c.status NOT IN ('CLOSED','VERIFIED')
        ORDER BY c.due_date ASC
        LIMIT 20
      `),

      pool.query(`
        SELECT
          a.audit_id, a.audit_code, a.audit_type, a.audit_date,
          a.scope, a.status,
          u.full_name AS lead_auditor_name
        FROM qms_audits a
        LEFT JOIN users u ON a.lead_auditor::uuid = u.user_id
        WHERE a.audit_date >= NOW()
        ORDER BY a.audit_date ASC
        LIMIT 5
      `),

      pool.query(`
        SELECT
          d.doc_id, d.doc_code, d.doc_name, d.doc_type, d.status,
          d.current_version_id,
          v.version_number,
          u.full_name AS author_name
        FROM qms_documents d
        LEFT JOIN qms_document_versions v ON d.current_version_id = v.version_id
        LEFT JOIN users u ON v.authored_by::uuid = u.user_id
        WHERE d.status IN ('REVIEW', 'PENDING_APPROVAL')
        ORDER BY d.doc_code ASC
        LIMIT 15
      `),

      pool.query(`
        WITH total_required AS (
          SELECT COUNT(*) AS cnt
          FROM qms_documents d
          CROSS JOIN users u
          WHERE d.status = 'RELEASED'
            AND d.doc_type IN ('SOP','POL','MAN')
            AND u.is_active = true
        ),
        acknowledged AS (
          SELECT COUNT(*) AS cnt
          FROM qms_training_records tr
          JOIN qms_documents d ON tr.doc_id = d.doc_id
          JOIN users u ON tr.user_id = u.user_id
          WHERE d.status = 'RELEASED'
            AND d.doc_type IN ('SOP','POL','MAN')
            AND u.is_active = true
        )
        SELECT
          CASE WHEN t.cnt > 0
            THEN ROUND((a.cnt::float / t.cnt) * 100)
            ELSE 0
          END AS compliance_pct
        FROM total_required t, acknowledged a
      `)
    ]);

    return {
      qms_sections: sectionsRes.status === 'fulfilled' ? sectionsRes.value.sections : [],
      open_ncrs: ncrRes.status === 'fulfilled' ? ncrRes.value.rows : [],
      overdue_capas: capaRes.status === 'fulfilled' ? capaRes.value.rows : [],
      upcoming_audits: auditRes.status === 'fulfilled' ? auditRes.value.rows : [],
      training_compliance_pct:
        trainingRes.status === 'fulfilled'
          ? parseFloat(trainingRes.value?.rows?.[0]?.compliance_pct || 0)
          : 0,
      docs_in_review: docsRes.status === 'fulfilled' ? docsRes.value.rows : [],
    };
  },

  // --------------------------------------------------------------------------
  // getCommercialSummary
  // --------------------------------------------------------------------------
  async getCommercialSummary() {
    // Fetch exchange rate FIRST — used in JS after each query (no column in sales_transactions)
    let exchange_rate = 27.0;
    try {
      const rateRes = await pool.query(`
        SELECT rate_value
        FROM exchange_rates
        WHERE target_currency = 'ZMW'
          AND is_active = true
        ORDER BY updated_at DESC
        LIMIT 1
      `);
      if (rateRes.rows[0]) exchange_rate = parseFloat(rateRes.rows[0].rate_value);
      console.log('Exchange rate loaded:', exchange_rate);
    } catch (e) {
      console.error('Exchange rate fetch failed, using default 27:', e.message);
    }

    // Q1 — today stats
    let today_stats = {
      today_revenue: 0, today_revenue_zmw: 0,
      today_transactions: 0, avg_order_value: 0,
      walkin_count: 0, b2b_count: 0,
    };
    try {
      const r = await pool.query(`
        SELECT
          COALESCE(SUM(total_amount::numeric), 0)  AS today_revenue,
          COUNT(*)                                  AS today_transactions,
          COALESCE(AVG(total_amount::numeric), 0)  AS avg_order_value,
          SUM(CASE WHEN customer_id IS NULL     THEN 1 ELSE 0 END) AS walkin_count,
          SUM(CASE WHEN customer_id IS NOT NULL THEN 1 ELSE 0 END) AS b2b_count
        FROM sales_transactions
        WHERE DATE(transaction_date::timestamp) = CURRENT_DATE
          AND TRIM(status) = 'completed'
      `);
      if (r.rows[0]) today_stats = r.rows[0];
      today_stats.today_revenue_zmw =
        parseFloat(today_stats.today_revenue || 0) * exchange_rate;
    } catch (e) {
      console.error('Commercial Q1 (today_stats) failed:', e.message);
    }

    // Q2 — weekly revenue last 7 days
    let weekly_revenue = [];
    try {
      const r = await pool.query(`
        SELECT
          DATE(transaction_date::timestamp)          AS sale_date,
          COALESCE(SUM(total_amount::numeric), 0)    AS revenue,
          COUNT(*)                                    AS transactions
        FROM sales_transactions
        WHERE transaction_date::timestamp >= NOW() - INTERVAL '7 days'
          AND TRIM(status) = 'completed'
        GROUP BY DATE(transaction_date::timestamp)
        ORDER BY sale_date ASC
      `);
      weekly_revenue = r.rows.map(row => ({
        ...row,
        revenue_zmw: parseFloat(row.revenue || 0) * exchange_rate,
      }));
    } catch (e) {
      console.error('Commercial Q2 (weekly_revenue) failed:', e.message);
    }

    // Q3 — current month stats
    let monthly_stats = {
      month_revenue: 0, month_revenue_zmw: 0,
      month_transactions: 0, month_avg_order: 0,
    };
    try {
      const r = await pool.query(`
        SELECT
          COALESCE(SUM(total_amount::numeric), 0)    AS month_revenue,
          COUNT(*)                                    AS month_transactions,
          COALESCE(AVG(total_amount::numeric), 0)    AS month_avg_order
        FROM sales_transactions
        WHERE DATE_TRUNC('month', transaction_date::timestamp) = DATE_TRUNC('month', NOW())
          AND TRIM(status) = 'completed'
      `);
      if (r.rows[0]) monthly_stats = r.rows[0];
      monthly_stats.month_revenue_zmw =
        parseFloat(monthly_stats.month_revenue || 0) * exchange_rate;
    } catch (e) {
      console.error('Commercial Q3 (monthly_stats) failed:', e.message);
    }

    // Q4 — top products current month (JOIN sales_transaction_lines + products)
    let top_products = [];
    try {
      const r = await pool.query(`
        SELECT
          p.product_name,
          p.sku,
          COALESCE(SUM(stl.quantity::numeric), 0)    AS units_sold,
          COALESCE(SUM(
            COALESCE(stl.line_total::numeric,
              (stl.quantity::numeric * stl.unit_price::numeric)
              - COALESCE(stl.line_discount::numeric, 0))
          ), 0)                                       AS revenue
        FROM sales_transaction_lines stl
        JOIN products p ON stl.product_id = p.product_id
        JOIN sales_transactions st ON stl.transaction_id = st.transaction_id
        WHERE DATE_TRUNC('month', st.transaction_date::timestamp) = DATE_TRUNC('month', NOW())
          AND TRIM(st.status) = 'completed'
        GROUP BY p.product_id, p.product_name, p.sku
        ORDER BY revenue DESC
        LIMIT 6
      `);
      top_products = r.rows;
    } catch (e) {
      console.error('Commercial Q4 (top_products) failed:', e.message);
    }

    // Q5 — void stats
    let void_stats = { voided: 0, total: 0, void_rate_pct: 0, voided_revenue: 0 };
    try {
      const r = await pool.query(`
        SELECT
          SUM(CASE WHEN TRIM(status) = 'voided' THEN 1 ELSE 0 END)                       AS voided,
          COUNT(*)                                                                          AS total,
          COALESCE(SUM(CASE WHEN TRIM(status) = 'voided' THEN total_amount::numeric ELSE 0 END), 0)
                                                                                            AS voided_revenue,
          ROUND(
            SUM(CASE WHEN TRIM(status) = 'voided' THEN 1 ELSE 0 END)::numeric
            / NULLIF(COUNT(*), 0) * 100, 1
          )                                                                                 AS void_rate_pct
        FROM sales_transactions
        WHERE DATE_TRUNC('month', transaction_date::timestamp) = DATE_TRUNC('month', NOW())
      `);
      if (r.rows[0]) void_stats = r.rows[0];
    } catch (e) {
      console.error('Commercial Q5 (void_stats) failed:', e.message);
    }

    // Q6 — zero stock
    let zero_stock = [];
    try {
      const r = await pool.query(`
        SELECT
          p.product_name,
          p.sku,
          COALESCE(SUM(i.quantity_on_hand::numeric), 0) AS quantity
        FROM inventory i
        JOIN products p ON i.product_id = p.product_id
        WHERE p.is_active = true
          AND p.product_id IN (
            SELECT DISTINCT finished_product_id
            FROM product_bom
          )
        GROUP BY p.product_id, p.product_name, p.sku
        HAVING COALESCE(SUM(i.quantity_on_hand::numeric), 0) = 0
        LIMIT 10
      `);
      zero_stock = r.rows;
    } catch (e) {
      console.error('Commercial Q6 (zero_stock) failed:', e.message);
    }

    // Q7 — open POs
    let open_pos = { open_pos: 0, po_value: 0 };
    try {
      const r = await pool.query(`
        SELECT
          COUNT(*)                        AS open_pos,
          COALESCE(SUM(total_amount), 0)  AS po_value
        FROM purchase_orders
        WHERE status NOT IN ('RECEIVED','CANCELLED')
      `);
      if (r.rows[0]) open_pos = r.rows[0];
    } catch (e) {
      console.error('Commercial Q7 (open_pos) failed:', e.message);
    }

    // Q8 — previous month stats
    let prev_monthly_stats = {
      month_revenue: 0, month_revenue_zmw: 0, month_transactions: 0,
    };
    try {
      const r = await pool.query(`
        SELECT
          COALESCE(SUM(total_amount::numeric), 0)    AS month_revenue,
          COUNT(*)                                    AS month_transactions
        FROM sales_transactions
        WHERE DATE_TRUNC('month', transaction_date::timestamp)
              = DATE_TRUNC('month', NOW()) - INTERVAL '1 month'
          AND TRIM(status) = 'completed'
      `);
      if (r.rows[0]) prev_monthly_stats = r.rows[0];
      prev_monthly_stats.month_revenue_zmw =
        parseFloat(prev_monthly_stats.month_revenue || 0) * exchange_rate;
    } catch (e) {
      console.error('Commercial Q8 (prev_monthly_stats) failed:', e.message);
    }

    // Q9 — previous month top products
    let prev_top_products = [];
    try {
      const r = await pool.query(`
        SELECT
          p.product_name,
          p.sku,
          COALESCE(SUM(stl.quantity::numeric), 0)    AS units_sold,
          COALESCE(SUM(
            COALESCE(stl.line_total::numeric,
              (stl.quantity::numeric * stl.unit_price::numeric)
              - COALESCE(stl.line_discount::numeric, 0))
          ), 0)                                       AS revenue
        FROM sales_transaction_lines stl
        JOIN products p ON stl.product_id = p.product_id
        JOIN sales_transactions st ON stl.transaction_id = st.transaction_id
        WHERE DATE_TRUNC('month', st.transaction_date::timestamp)
              = DATE_TRUNC('month', NOW()) - INTERVAL '1 month'
          AND TRIM(st.status) = 'completed'
        GROUP BY p.product_id, p.product_name, p.sku
        ORDER BY revenue DESC
        LIMIT 6
      `);
      prev_top_products = r.rows;
    } catch (e) {
      console.error('Commercial Q9 (prev_top_products) failed:', e.message);
    }

    // Q10 — monthly comparison (prev + current)
    let monthly_comparison = [];
    try {
      const r = await pool.query(`
        SELECT
          DATE_TRUNC('month', transaction_date::timestamp)                       AS month_start,
          TO_CHAR(DATE_TRUNC('month', transaction_date::timestamp), 'Mon YYYY')  AS month_label,
          COALESCE(SUM(total_amount::numeric), 0)                                AS total_revenue,
          COUNT(*)                                                                AS total_transactions,
          COALESCE(AVG(total_amount::numeric), 0)                                AS avg_order_value
        FROM sales_transactions
        WHERE DATE_TRUNC('month', transaction_date::timestamp)
                >= DATE_TRUNC('month', NOW()) - INTERVAL '1 month'
          AND TRIM(status) = 'completed'
        GROUP BY DATE_TRUNC('month', transaction_date::timestamp),
                 TO_CHAR(DATE_TRUNC('month', transaction_date::timestamp), 'Mon YYYY')
        ORDER BY month_start ASC
      `);
      monthly_comparison = r.rows.map(row => ({
        ...row,
        total_revenue_zmw: parseFloat(row.total_revenue || 0) * exchange_rate,
      }));
    } catch (e) {
      console.error('Commercial Q10 (monthly_comparison) failed:', e.message);
    }

    // Q11 — week-by-week for both months
    let weekly_comparison = [];
    try {
      const r = await pool.query(`
        SELECT
          TO_CHAR(DATE_TRUNC('week', transaction_date::timestamp), 'DD Mon')    AS week_label,
          DATE_TRUNC('month', transaction_date::timestamp)                       AS month_start,
          TO_CHAR(DATE_TRUNC('month', transaction_date::timestamp), 'Mon')       AS month_short,
          COALESCE(SUM(total_amount::numeric), 0)                                AS revenue
        FROM sales_transactions
        WHERE DATE_TRUNC('month', transaction_date::timestamp)
                >= DATE_TRUNC('month', NOW()) - INTERVAL '1 month'
          AND TRIM(status) = 'completed'
        GROUP BY DATE_TRUNC('week', transaction_date::timestamp),
                 DATE_TRUNC('month', transaction_date::timestamp),
                 TO_CHAR(DATE_TRUNC('month', transaction_date::timestamp), 'Mon')
        ORDER BY DATE_TRUNC('week', transaction_date::timestamp) ASC
      `);
      weekly_comparison = r.rows;
    } catch (e) {
      console.error('Commercial Q11 (weekly_comparison) failed:', e.message);
    }

    // Q12 — payment method breakdown this month
    let payment_breakdown = [];
    try {
      const r = await pool.query(`
        SELECT
          payment_method,
          COUNT(*)                                AS transaction_count,
          COALESCE(SUM(total_amount::numeric), 0) AS revenue_usd
        FROM sales_transactions
        WHERE DATE_TRUNC('month', transaction_date::timestamp) = DATE_TRUNC('month', NOW())
          AND TRIM(status) = 'completed'
        GROUP BY payment_method
        ORDER BY revenue_usd DESC
      `);
      payment_breakdown = r.rows.map(row => ({
        ...row,
        revenue_zmw: parseFloat(row.revenue_usd || 0) * exchange_rate,
      }));
    } catch (e) {
      console.error('Commercial Q12 (payment_breakdown) failed:', e.message);
    }

    // Q13 — B2B vs Walk-in customer split (customer_id IS NULL = walk-in)
    let customer_split = {
      b2b_revenue: 0, walkin_revenue: 0,
      b2b_count: 0, walkin_count: 0,
    };
    try {
      const r = await pool.query(`
        SELECT
          COALESCE(SUM(CASE WHEN customer_id IS NOT NULL THEN total_amount::numeric ELSE 0 END), 0) AS b2b_revenue,
          COALESCE(SUM(CASE WHEN customer_id IS NULL     THEN total_amount::numeric ELSE 0 END), 0) AS walkin_revenue,
          SUM(CASE WHEN customer_id IS NOT NULL THEN 1 ELSE 0 END)                                  AS b2b_count,
          SUM(CASE WHEN customer_id IS NULL     THEN 1 ELSE 0 END)                                  AS walkin_count
        FROM sales_transactions
        WHERE DATE_TRUNC('month', transaction_date::timestamp) = DATE_TRUNC('month', NOW())
          AND TRIM(status) = 'completed'
      `);
      if (r.rows[0]) customer_split = r.rows[0];
      customer_split.b2b_revenue_zmw =
        parseFloat(customer_split.b2b_revenue || 0) * exchange_rate;
      customer_split.walkin_revenue_zmw =
        parseFloat(customer_split.walkin_revenue || 0) * exchange_rate;
    } catch (e) {
      console.error('Commercial Q13 (customer_split) failed:', e.message);
    }

    // Month-over-month derived metrics
    const curr_rev = parseFloat(monthly_stats.month_revenue) || 0;
    const prev_rev = parseFloat(prev_monthly_stats.month_revenue) || 0;
    const mom_revenue_change_pct = prev_rev === 0 ? null
      : Math.round(((curr_rev - prev_rev) / prev_rev) * 100);

    const curr_txn = parseInt(monthly_stats.month_transactions) || 0;
    const prev_txn = parseInt(prev_monthly_stats.month_transactions) || 0;
    const mom_txn_change_pct = prev_txn === 0 ? null
      : Math.round(((curr_txn - prev_txn) / prev_txn) * 100);

    return {
      exchange_rate,
      today_stats,
      weekly_revenue,
      monthly_stats,
      prev_monthly_stats,
      monthly_comparison,
      weekly_comparison,
      top_products,
      prev_top_products,
      void_stats,
      zero_stock,
      open_pos,
      payment_breakdown,
      customer_split,
      mom_revenue_change_pct,
      mom_txn_change_pct,
    };
  },

  // --------------------------------------------------------------------------
  // registerDevice — upsert an Expo push token for a user
  // Creates the table on first call (safe on Neon)
  // --------------------------------------------------------------------------
  async registerDevice(userId, pushToken) {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS mobile_device_tokens (
        token_id   SERIAL PRIMARY KEY,
        user_id    TEXT        NOT NULL,
        push_token TEXT        NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(user_id, push_token)
      )
    `);

    await pool.query(`
      INSERT INTO mobile_device_tokens (user_id, push_token, updated_at)
      VALUES ($1, $2, NOW())
      ON CONFLICT (user_id, push_token) DO UPDATE SET updated_at = NOW()
    `, [userId, pushToken]);

    return { registered: true };
  },

  // --------------------------------------------------------------------------
  // getPeopleSummary
  // --------------------------------------------------------------------------
  async getPeopleSummary() {
    const [rolesRes, leaderboardRes, pendingAckRes, activityRes] = await Promise.allSettled([

      pool.query(`
        SELECT role, COUNT(*) AS count
        FROM users
        WHERE is_active = true
        GROUP BY role
        ORDER BY count DESC
      `),

      pool.query(`
        SELECT
          u.user_id, u.full_name, u.role,
          COUNT(tr.doc_id) AS acknowledged_count
        FROM users u
        LEFT JOIN qms_training_records tr ON tr.user_id = u.user_id
        WHERE u.is_active = true
        GROUP BY u.user_id, u.full_name, u.role
        ORDER BY acknowledged_count DESC
        LIMIT 15
      `),

      pool.query(`
        SELECT
          u.user_id, u.full_name, u.email, u.role,
          COUNT(d.doc_id) AS pending_count
        FROM users u
        JOIN qms_documents d ON d.status = 'RELEASED'
          AND d.doc_type IN ('SOP','POL','MAN')
          AND d.created_at >= NOW() - INTERVAL '30 days'
        WHERE u.is_active = true
          AND NOT EXISTS (
            SELECT 1 FROM qms_training_records tr
            WHERE tr.user_id = u.user_id
              AND tr.doc_id = d.doc_id
              AND tr.version_id = d.current_version_id
          )
        GROUP BY u.user_id, u.full_name, u.email, u.role
        ORDER BY pending_count DESC
        LIMIT 20
      `),

      // Try audit_log first; fall back to inventory_transactions if it fails
      pool.query(`
        SELECT
          al.log_id::text AS activity_id,
          al.action        AS activity_type,
          al.table_name,
          al.performed_at  AS created_at,
          u.full_name      AS actor_name
        FROM audit_log al
        LEFT JOIN users u ON al.performed_by = u.user_id
        WHERE al.performed_at >= NOW() - INTERVAL '45 days'
        ORDER BY al.performed_at DESC NULLS LAST
        LIMIT 20
      `).catch(() =>
        pool.query(`
          SELECT
            it.transaction_id::text  AS activity_id,
            tt.type_name             AS activity_type,
            'inventory_transactions' AS table_name,
            it.created_at,
            u.full_name              AS actor_name
          FROM inventory_transactions it
          LEFT JOIN transaction_types tt ON it.transaction_type_id = tt.transaction_type_id
          LEFT JOIN users u ON it.performed_by = u.user_id
          WHERE it.created_at >= NOW() - INTERVAL '45 days'
          ORDER BY it.created_at DESC NULLS LAST
          LIMIT 20
        `)
      )
    ]);

    const leaderboard = leaderboardRes.status === 'fulfilled' ? leaderboardRes.value.rows : [];
    const recentActivity = activityRes.status === 'fulfilled' ? activityRes.value.rows : [];

    return {
      users_by_role: rolesRes.status === 'fulfilled' ? rolesRes.value.rows : [],
      training_leaderboard: {
        top_10: leaderboard.slice(0, 10),
        bottom_5: [...leaderboard].sort((a, b) => a.acknowledged_count - b.acknowledged_count).slice(0, 5)
      },
      pending_acknowledgements: pendingAckRes.status === 'fulfilled' ? pendingAckRes.value.rows : [],
      recent_activity: recentActivity,
      activity_window_days: 45,
      recent_activity_count: recentActivity.length
    };
  }
};

// ── Push notification helper ──────────────────────────────────────────────────
// Uses the Expo push API directly — no server-side SDK needed.
// Call this from any service that needs to notify mobile users.
async function sendPushNotification(tokens, title, body, data = {}) {
  if (!tokens || tokens.length === 0) return;

  const messages = tokens.map((to) => ({ to, sound: 'default', title, body, data }));
  try {
    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify(messages),
    });
    const result = await res.json();
    if (result.errors) console.error('📱 Push errors:', JSON.stringify(result.errors));
    else console.log(`📱 Push sent to ${tokens.length} device(s)`);
  } catch (err) {
    console.error('📱 Push notification failed:', err.message);
  }
}

// Retrieve all push tokens for a given set of roles (used by qms-service)
async function getPushTokensForRoles(roles = ['admin', 'qa_manager', 'manager']) {
  try {
    await pool.query(`CREATE TABLE IF NOT EXISTS mobile_device_tokens (
      token_id SERIAL PRIMARY KEY, user_id TEXT NOT NULL,
      push_token TEXT NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(), UNIQUE(user_id, push_token)
    )`);
    const placeholders = roles.map((_, i) => `$${i + 1}`).join(',');
    const result = await pool.query(`
      SELECT DISTINCT mdt.push_token
      FROM mobile_device_tokens mdt
      JOIN users u ON u.user_id::text = mdt.user_id
      WHERE u.role IN (${placeholders}) AND u.is_active = true
    `, roles);
    return result.rows.map((r) => r.push_token);
  } catch (err) {
    console.error('📱 getPushTokensForRoles failed:', err.message);
    return [];
  }
}

module.exports = { ...mobileService, sendPushNotification, getPushTokensForRoles };
