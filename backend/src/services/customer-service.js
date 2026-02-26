const { pool } = require('./auth-service'); // Reusing existing DB connection

class CustomerService {
  
  // ============================================================================
  // 1. AUTO-GENERATE CUSTOMER ID (e.g., VTL-CUS-T2-2026-0001)
  // Only called when CFO approves the customer
  // ============================================================================
  static async generateCustomerId(tierCode) {
    const year = new Date().getFullYear();
    const prefix = `VTL-CUS-${tierCode}-${year}-`;

    const result = await pool.query(
      `SELECT vtl_customer_id FROM customers 
       WHERE vtl_customer_id LIKE $1 
       ORDER BY vtl_customer_id DESC LIMIT 1`,
      [`${prefix}%`]
    );

    let sequence = 1;
    if (result.rows.length > 0) {
      const lastId = result.rows[0].vtl_customer_id;
      const lastSequence = parseInt(lastId.split('-').pop(), 10);
      sequence = lastSequence + 1;
    }

    return `${prefix}${sequence.toString().padStart(4, '0')}`;
  }

  // ============================================================================
  // 2. CREATE NEW CUSTOMER (ONBOARDING)
  // ============================================================================
  static async createCustomer(customerData, userId) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Map the Tier Name to the exact Tier Code required by the roadmap
      let tierCode = 'T1';
      if (customerData.tier_name === 'Wholesale') tierCode = 'T2';
      if (customerData.tier_name === 'Chain') tierCode = 'T3';
      if (customerData.tier_name === 'Corporate') tierCode = 'T4';

      // 1. Insert Master Customer Record (Status: PENDING_CFO, ID is null until approved)
      const custResult = await client.query(
        `INSERT INTO customers (
          trading_name, legal_name, tpin, business_type, 
          tier, tier_name, status, payment_terms, credit_limit, 
          territory, onboarded_by
        ) VALUES ($1, $2, $3, $4, $5, $6, 'PENDING_CFO', $7, $8, $9, $10)
        RETURNING customer_id`,
        [
          customerData.trading_name, customerData.legal_name, customerData.tpin, 
          customerData.business_type, tierCode, customerData.tier_name, 
          customerData.payment_terms, customerData.credit_limit || 0, 
          customerData.territory, userId
        ]
      );
      
      const customerId = custResult.rows[0].customer_id;

      // 2. Insert Locations (Chain tier might have multiple)
      if (customerData.locations && customerData.locations.length > 0) {
        for (const loc of customerData.locations) {
          await client.query(
            `INSERT INTO customer_locations (customer_id, outlet_name, address, town, region, is_primary)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [customerId, loc.outlet_name, loc.address, loc.town, loc.region, loc.is_primary || false]
          );
        }
      }

      // 3. Insert Contacts (Crucial for WhatsApp communications)
      if (customerData.contacts && customerData.contacts.length > 0) {
        for (const contact of customerData.contacts) {
          await client.query(
            `INSERT INTO customer_contacts (customer_id, full_name, position, phone, email, whatsapp, is_primary)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [customerId, contact.full_name, contact.position, contact.phone, contact.email, contact.whatsapp, contact.is_primary || false]
          );
        }
      }

      // 4. Insert Estimated Volumes/Product Preferences
      if (customerData.products && customerData.products.length > 0) {
        for (const prod of customerData.products) {
          await client.query(
            `INSERT INTO customer_products (customer_id, estimated_monthly_volume, preferred_delivery_frequency, notes)
             VALUES ($1, $2, $3, $4)`,
            [customerId, prod.estimated_monthly_volume, prod.preferred_delivery_frequency, prod.notes]
          );
        }
      }

      await client.query('COMMIT');
      return { 
        customer_id: customerId, 
        status: 'PENDING_CFO',
        tier: tierCode,
        message: `Customer onboarded successfully and sent to CFO for approval.` 
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // ============================================================================
  // 3. FETCH CUSTOMERS LIST
  // ============================================================================
  static async listCustomers(filters = {}) {
    let query = `
      SELECT c.customer_id, c.vtl_customer_id, c.trading_name, c.tier_name, 
             c.status, c.territory, c.created_at, u.full_name as onboarded_by_name
      FROM customers c
      JOIN users u ON c.onboarded_by = u.user_id
      WHERE 1=1
    `;
    const params = [];

    if (filters.status) {
      params.push(filters.status);
      query += ` AND c.status = $${params.length}`;
    }

    query += ` ORDER BY c.created_at DESC`;
    
    const result = await pool.query(query, params);
    return result.rows;
  }

  // ============================================================================
  // 4. GET SINGLE CUSTOMER DETAILS
  // ============================================================================
  static async getCustomerById(customerId) {
    const custRes = await pool.query(
      `SELECT c.*, u.full_name as onboarded_by_name, cfo.full_name as cfo_name
       FROM customers c
       JOIN users u ON c.onboarded_by = u.user_id
       LEFT JOIN users cfo ON c.cfo_approved_by = cfo.user_id
       WHERE c.customer_id = $1`, 
      [customerId]
    );
    
    if (custRes.rows.length === 0) throw new Error('Customer not found');
    const customer = custRes.rows[0];

    // Fetch all relational data
    const [locations, contacts, products] = await Promise.all([
      pool.query(`SELECT * FROM customer_locations WHERE customer_id = $1 ORDER BY is_primary DESC`, [customerId]),
      pool.query(`SELECT * FROM customer_contacts WHERE customer_id = $1 ORDER BY is_primary DESC`, [customerId]),
      pool.query(`SELECT * FROM customer_products WHERE customer_id = $1`, [customerId])
    ]);

    return { 
      ...customer, 
      locations: locations.rows, 
      contacts: contacts.rows,
      products: products.rows
    };
  }

  // ============================================================================
  // 5. CFO APPROVAL (Generates Official ID)
  // ============================================================================
  static async approveCustomer(customerId, cfoId, notes = '') {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const custRes = await client.query(`SELECT status, tier FROM customers WHERE customer_id = $1 FOR UPDATE`, [customerId]);
      if (custRes.rows.length === 0) throw new Error('Customer not found');
      if (custRes.rows[0].status !== 'PENDING_CFO') throw new Error('Customer is not pending CFO approval.');

      const tierCode = custRes.rows[0].tier;
      
      // Generate the official roadmap ID (e.g., VTL-CUS-T3-2026-0001)
      const vtlCustomerId = await this.generateCustomerId(tierCode);

      // Update customer record
      await client.query(
        `UPDATE customers 
         SET status = 'ACTIVE', 
             vtl_customer_id = $1,
             cfo_approved_by = $2,
             approved_at = CURRENT_TIMESTAMP
         WHERE customer_id = $3`,
        [vtlCustomerId, cfoId, customerId]
      );

      await client.query('COMMIT');
      return { 
        status: 'ACTIVE', 
        vtl_customer_id: vtlCustomerId,
        message: `Customer successfully approved and assigned ID: ${vtlCustomerId}.` 
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // ============================================================================
  // 6. CFO REJECTION (Sends back to Sales)
  // ============================================================================
  static async rejectCustomer(customerId, cfoId, reason) {
    await pool.query(
      `UPDATE customers SET status = 'REVISION_REQUIRED' WHERE customer_id = $1`,
      [customerId]
    );
    return { status: 'REVISION_REQUIRED', message: 'Customer returned to Sales for revision.' };
  }
}

module.exports = CustomerService;