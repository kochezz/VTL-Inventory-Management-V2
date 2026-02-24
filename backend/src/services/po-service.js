const { pool } = require('./auth-service'); // Reusing existing DB connection

class PurchaseOrderService {
  
  // ============================================================================
  // 1. AUTO-GENERATE PO NUMBER
  // ============================================================================
  static async generatePoNumber() {
    const year = new Date().getFullYear();
    const prefix = `VTL-PO-${year}-`;

    const result = await pool.query(
      `SELECT po_number FROM purchase_orders 
       WHERE po_number LIKE $1 
       ORDER BY po_number DESC LIMIT 1`,
      [`${prefix}%`]
    );

    let sequence = 1;
    if (result.rows.length > 0) {
      const lastId = result.rows[0].po_number;
      const lastSequence = parseInt(lastId.split('-').pop(), 10);
      sequence = lastSequence + 1;
    }

    return `${prefix}${sequence.toString().padStart(4, '0')}`;
  }

  // ============================================================================
  // 2. CREATE PURCHASE ORDER (WITH LIVE EXCHANGE RATES)
  // ============================================================================
  static async createPO(poData, userId) {
    // 1. Enforce the mandatory PDF quotation attachment
    if (!poData.quotation_pdf_base64) {
      throw new Error('A PDF Quotation must be attached to raise a Purchase Order.');
    }

    if (!poData.line_items || poData.line_items.length === 0) {
      throw new Error('Purchase Order must contain at least one line item.');
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 2. Verify Vendor is valid and Approved/Conditional
      const vendorRes = await client.query(
        `SELECT status FROM vendors WHERE vendor_id = $1`, 
        [poData.vendor_id]
      );
      
      if (vendorRes.rows.length === 0) throw new Error('Selected vendor does not exist.');
      if (!['APPROVED', 'CONDITIONALLY_APPROVED'].includes(vendorRes.rows[0].status)) {
        throw new Error('Purchase Orders can only be raised against Approved Vendors.');
      }

      // 3. FETCH LIVE EXCHANGE RATES FOR ACCURATE ROUTING
      const currency = poData.currency || 'ZMW';
      let rateToUsd = 1; // Default to 1 if USD

      if (currency !== 'USD') {
        try {
          // Fetch live rates against the USD base
          const response = await fetch('https://open.er-api.com/v6/latest/USD');
          const data = await response.json();
          
          if (data && data.rates && data.rates[currency]) {
            // The API returns how much of X currency makes 1 USD (e.g. 1 USD = 26 ZMW)
            // To get the multiplier, we divide 1 by that rate.
            rateToUsd = 1 / data.rates[currency];
          } else {
            throw new Error(`Currency ${currency} is not supported by the exchange rate provider.`);
          }
        } catch (apiError) {
          console.error('Live Exchange Rate API Error:', apiError);
          throw new Error('Could not fetch live exchange rates to calculate approval thresholds. Please try again.');
        }
      }

      // 4. Generate Number and Calculate exactly how much this is in USD right now
      const poNumber = await this.generatePoNumber();
      const totalUsdEquiv = parseFloat(poData.total_amount) * rateToUsd;

      // 5. Insert Master PO Record
      const poResult = await client.query(
        `INSERT INTO purchase_orders (
          po_number, vendor_id, raised_by, department, delivery_date, ship_via,
          currency, subtotal, tax_rate, tax_amount, shipping, other_charges, total_amount,
          total_usd_equiv, quotation_pdf_base64, summary_ref, terms, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, 'PENDING_CFO')
        RETURNING po_id, po_number, total_usd_equiv`,
        [
          poNumber, poData.vendor_id, userId, poData.department, poData.delivery_date, poData.ship_via,
          currency, poData.subtotal, poData.tax_rate, poData.tax_amount, poData.shipping, 
          poData.other_charges, poData.total_amount, totalUsdEquiv, 
          poData.quotation_pdf_base64, poData.summary_ref, poData.terms
        ]
      );
      
      const poId = poResult.rows[0].po_id;

      // 6. Insert Line Items
      for (const item of poData.line_items) {
        await client.query(
          `INSERT INTO po_line_items (po_id, item_no, description, quantity, unit, unit_price, line_total)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [poId, item.item_no, item.description, item.quantity, item.unit, item.unit_price, item.line_total]
        );
      }

      await client.query('COMMIT');
      return { 
        po_id: poId, 
        po_number: poNumber, 
        status: 'PENDING_CFO',
        total_usd_equiv: totalUsdEquiv,
        message: `PO Raised successfully. Live USD Equivalent: $${totalUsdEquiv.toFixed(2)}.` 
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // ============================================================================
  // 3. FETCH PO LIST
  // ============================================================================
  static async listPOs(filters = {}) {
    let query = `
      SELECT p.po_id, p.po_number, p.date_raised, p.currency, p.total_amount, 
             p.status, v.legal_name as vendor_name, u.full_name as raised_by_name
      FROM purchase_orders p
      JOIN vendors v ON p.vendor_id = v.vendor_id
      JOIN users u ON p.raised_by = u.user_id
      WHERE 1=1
    `;
    const params = [];

    if (filters.status) {
      params.push(filters.status);
      query += ` AND p.status = $${params.length}`;
    }

    query += ` ORDER BY p.created_at DESC`;
    
    const result = await pool.query(query, params);
    return result.rows;
  }

  // ============================================================================
  // 4. GET SINGLE PO DETAILS (Includes PDF Quotation Base64)
  // ============================================================================
  static async getPOById(poId) {
    const poRes = await pool.query(
      `SELECT p.*, v.legal_name as vendor_name, v.vtl_supplier_id, v.registered_address,
              v.banking_data, u.full_name as raised_by_name
       FROM purchase_orders p
       JOIN vendors v ON p.vendor_id = v.vendor_id
       JOIN users u ON p.raised_by = u.user_id
       WHERE p.po_id = $1`, 
      [poId]
    );
    
    if (poRes.rows.length === 0) throw new Error('Purchase Order not found');
    const po = poRes.rows[0];

    // Fetch relational data
    const [lineItems, approvals] = await Promise.all([
      pool.query(`SELECT * FROM po_line_items WHERE po_id = $1 ORDER BY item_no ASC`, [poId]),
      pool.query(`SELECT a.*, u.full_name as approver_name FROM po_approvals a JOIN users u ON a.approver_id = u.user_id WHERE po_id = $1 ORDER BY sequence_order ASC`, [poId])
    ]);

    return { ...po, line_items: lineItems.rows, approvals: approvals.rows };
  }

  // ============================================================================
  // 5. PROCESS APPROVALS (CFO & CEO TIERS)
  // ============================================================================
  static async approvePO(poId, approverId, role, notes = '') {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const poRes = await client.query(`SELECT status, total_usd_equiv FROM purchase_orders WHERE po_id = $1 FOR UPDATE`, [poId]);
      if (poRes.rows.length === 0) throw new Error('PO not found');
      
      const po = poRes.rows[0];
      let newStatus = po.status;
      let sequenceOrder = 1;

      // Logic routing based on the Live $1,000 USD equivalent calculated at creation
      if (role === 'cfo' && po.status === 'PENDING_CFO') {
        sequenceOrder = 1;
        newStatus = po.total_usd_equiv > 1000 ? 'PENDING_CEO' : 'APPROVED';
      } 
      else if (role === 'ceo' && po.status === 'PENDING_CEO') {
        sequenceOrder = 2;
        newStatus = 'APPROVED';
      } 
      else {
        throw new Error(`Invalid approval sequence. PO is currently ${po.status} and you are acting as ${role}.`);
      }

      // Log the password-verified approval
      await client.query(
        `INSERT INTO po_approvals (po_id, approver_id, approval_role, status, rejection_reason, sequence_order)
         VALUES ($1, $2, $3, 'APPROVED', $4, $5)`,
        [poId, approverId, role.toUpperCase(), notes, sequenceOrder]
      );

      // Update PO status
      await client.query(`UPDATE purchase_orders SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE po_id = $2`, [newStatus, poId]);

      await client.query('COMMIT');
      return { status: newStatus, message: `PO successfully approved by ${role.toUpperCase()}.` };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // ============================================================================
  // 6. PROCESS REJECTIONS
  // ============================================================================
  static async rejectPO(poId, approverId, role, reason) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const sequenceOrder = role === 'cfo' ? 1 : 2;

      await client.query(
        `INSERT INTO po_approvals (po_id, approver_id, approval_role, status, rejection_reason, sequence_order)
         VALUES ($1, $2, $3, 'REJECTED', $4, $5)`,
        [poId, approverId, role.toUpperCase(), reason, sequenceOrder]
      );

      await client.query(`UPDATE purchase_orders SET status = 'REJECTED', updated_at = CURRENT_TIMESTAMP WHERE po_id = $1`, [poId]);

      await client.query('COMMIT');
      return { status: 'REJECTED', message: `PO rejected by ${role.toUpperCase()}.` };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}

module.exports = PurchaseOrderService;