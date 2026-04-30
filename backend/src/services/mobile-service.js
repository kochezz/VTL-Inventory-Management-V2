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
        `),
        pool.query(`SELECT COUNT(*) FROM inventory WHERE quantity_on_hand = 0`),
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

        -- NCRs raised in last 48 hours
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
        WHERE n.created_at >= NOW() - INTERVAL '48 hours'

        UNION ALL

        -- Overdue CAPAs
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

        UNION ALL

        -- Zero-stock products
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
        WHERE i.quantity_on_hand = 0 AND p.is_active = true

        UNION ALL

        -- Documents awaiting review
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

      ) alerts
      ORDER BY created_at DESC NULLS LAST
      LIMIT $1
    `;
    try {
      const result = await pool.query(query, [limit]);
      return result.rows;
    } catch (err) {
      console.error('❌ getAlertFeed error:', err.message);
      return [];
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
          AND i.quantity_on_hand <= p.reorder_level
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
    const [sectionsRes, ncrRes, capaRes, auditRes, trainingRes] = await Promise.allSettled([

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
          : 0
    };
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
          ORDER BY it.created_at DESC NULLS LAST
          LIMIT 20
        `)
      )
    ]);

    const leaderboard = leaderboardRes.status === 'fulfilled' ? leaderboardRes.value.rows : [];

    return {
      users_by_role: rolesRes.status === 'fulfilled' ? rolesRes.value.rows : [],
      training_leaderboard: {
        top_10: leaderboard.slice(0, 10),
        bottom_5: [...leaderboard].sort((a, b) => a.acknowledged_count - b.acknowledged_count).slice(0, 5)
      },
      pending_acknowledgements: pendingAckRes.status === 'fulfilled' ? pendingAckRes.value.rows : [],
      recent_activity: activityRes.status === 'fulfilled' ? activityRes.value.rows : []
    };
  }
};

module.exports = mobileService;
