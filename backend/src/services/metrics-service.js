const { pool } = require('./auth-service');

class MetricsService {
  
  static async getVendorAndCRMMetrics() {
    const client = await pool.connect();
    try {
      // 1. CUSTOMER METRICS (CRM)
      // Total customers and breakdown by tier
      const customerTierRes = await client.query(`
        SELECT tier_name, COUNT(*) as count 
        FROM customers 
        WHERE status = 'ACTIVE' 
        GROUP BY tier_name
      `);
      
      const totalCustomersRes = await client.query(`
        SELECT COUNT(*) as total FROM customers WHERE status = 'ACTIVE'
      `);

      // Recent Onboarding Pipeline
      const pendingCustomersRes = await client.query(`
        SELECT COUNT(*) as pending FROM customers WHERE status = 'PENDING_CFO'
      `);

      // 2. SUPPLIER METRICS (AVL)
      // Total Approved Suppliers
      const activeSuppliersRes = await client.query(`
        SELECT COUNT(*) as total FROM vendors WHERE status = 'APPROVED' OR status = 'CONDITIONALLY_APPROVED'
      `);

      // 3. PURCHASE ORDER METRICS (SPEND)
      // Total Spend (Approved & Received POs)
      const poSpendRes = await client.query(`
        SELECT currency, SUM(total_amount) as total_spend, COUNT(*) as po_count
        FROM purchase_orders 
        WHERE status IN ('APPROVED', 'PARTIALLY_RECEIVED', 'FULLY_RECEIVED', 'CLOSED')
        GROUP BY currency
      `);

      // Pending Financial Approvals (Bottleneck tracking)
      const pendingPOsRes = await client.query(`
        SELECT status, COUNT(*) as count, SUM(total_amount) as value
        FROM purchase_orders
        WHERE status IN ('PENDING_CFO', 'PENDING_CEO')
        GROUP BY status
      `);

      return {
        customers: {
          total_active: parseInt(totalCustomersRes.rows[0]?.total || 0),
          pending_approval: parseInt(pendingCustomersRes.rows[0]?.pending || 0),
          by_tier: customerTierRes.rows.map(row => ({
            name: row.tier_name || 'Unassigned',
            value: parseInt(row.count)
          }))
        },
        suppliers: {
          total_active: parseInt(activeSuppliersRes.rows[0]?.total || 0)
        },
        procurement: {
          spend_by_currency: poSpendRes.rows,
          pending_approvals: pendingPOsRes.rows
        }
      };
    } catch (error) {
      console.error('Error generating metrics:', error);
      throw error;
    } finally {
      client.release();
    }
  }
}

module.exports = MetricsService;