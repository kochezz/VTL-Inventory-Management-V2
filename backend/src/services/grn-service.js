const { pool } = require('./auth-service'); // Reusing existing DB connection

class GoodsReceiptService {
  
  // ============================================================================
  // 1. AUTO-GENERATE GRN NUMBER
  // ============================================================================
  static async generateGrnNumber() {
    const year = new Date().getFullYear();
    const prefix = `VTL-GRN-${year}-`;

    const result = await pool.query(
      `SELECT grn_number FROM goods_receipt_notes 
       WHERE grn_number LIKE $1 
       ORDER BY grn_number DESC LIMIT 1`,
      [`${prefix}%`]
    );

    let sequence = 1;
    if (result.rows.length > 0) {
      const lastId = result.rows[0].grn_number;
      const lastSequence = parseInt(lastId.split('-').pop(), 10);
      sequence = lastSequence + 1;
    }

    return `${prefix}${sequence.toString().padStart(4, '0')}`;
  }

  // ============================================================================
  // 2. CREATE GOODS RECEIPT NOTE (GRN)
  // ============================================================================
  static async createGRN(grnData, userId) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Verify PO is in a receivable state
      const poRes = await client.query(
        `SELECT status FROM purchase_orders WHERE po_id = $1 FOR UPDATE`, 
        [grnData.po_id]
      );
      
      if (poRes.rows.length === 0) throw new Error('Purchase Order not found.');
      const poStatus = poRes.rows[0].status;
      
      if (!['APPROVED', 'PARTIALLY_RECEIVED'].includes(poStatus)) {
        throw new Error(`Cannot receive against this PO. Current status is ${poStatus}.`);
      }

      // 2. Generate GRN Number
      const grnNumber = await this.generateGrnNumber();
      const receiptType = grnData.receipt_type || 'PHYSICAL'; // 'PHYSICAL' or 'SERVICE'

      // 3. Insert Master GRN Record
      const grnResult = await client.query(
        `INSERT INTO goods_receipt_notes (
          grn_number, po_id, received_by, receipt_type, delivery_note_ref, notes
        ) VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING grn_id`,
        [
          grnNumber, grnData.po_id, userId, receiptType, 
          grnData.delivery_note_ref, grnData.notes
        ]
      );
      
      const grnId = grnResult.rows[0].grn_id;

      // 4. Process Line Items
      for (const item of grnData.items) {
        if (item.quantity_received <= 0) continue; // Skip items not received in this batch

        // A. Log the specific receipt
        await client.query(
          `INSERT INTO grn_line_items (grn_id, po_line_id, quantity_received, condition_status, notes)
           VALUES ($1, $2, $3, $4, $5)`,
          [grnId, item.po_line_id, item.quantity_received, item.condition_status || 'GOOD', item.notes]
        );

        // B. Update the PO Line Item to reflect new accumulated total
        await client.query(
          `UPDATE po_line_items 
           SET quantity_received = quantity_received + $1 
           WHERE line_id = $2`,
          [item.quantity_received, item.po_line_id]
        );

        // C. If PHYSICAL and mapped to a real inventory SKU, update live inventory!
        if (receiptType === 'PHYSICAL' && item.inventory_id && item.condition_status === 'GOOD') {
          // Note: Assuming standard 'inventory' table exists from previous phases.
          // This dynamically adds the received stock directly to the warehouse shelves.
          await client.query(
            `UPDATE inventory 
             SET quantity = quantity + $1, updated_at = CURRENT_TIMESTAMP
             WHERE id = $2`,
            [item.quantity_received, item.inventory_id]
          );
        }
      }

      // 5. Check if the entire PO is now Fully Received
      const totalsRes = await client.query(`
        SELECT SUM(quantity) as total_ordered, SUM(quantity_received) as total_received 
        FROM po_line_items WHERE po_id = $1
      `, [grnData.po_id]);
      
      const { total_ordered, total_received } = totalsRes.rows[0];
      const newPoStatus = parseFloat(total_received) >= parseFloat(total_ordered) 
        ? 'FULLY_RECEIVED' 
        : 'PARTIALLY_RECEIVED';

      // 6. Update PO Status
      await client.query(
        `UPDATE purchase_orders SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE po_id = $2`, 
        [newPoStatus, grnData.po_id]
      );

      await client.query('COMMIT');
      return { 
        grn_id: grnId, 
        grn_number: grnNumber, 
        po_status: newPoStatus,
        message: `GRN generated successfully. PO is now ${newPoStatus.replace('_', ' ')}.` 
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // ============================================================================
  // 3. FETCH GRN LIST (For Warehouse Dashboard)
  // ============================================================================
  static async listGRNs(filters = {}) {
    let query = `
      SELECT g.grn_id, g.grn_number, g.receipt_type, g.received_date, g.delivery_note_ref,
             p.po_number, v.legal_name as vendor_name, u.full_name as received_by_name
      FROM goods_receipt_notes g
      JOIN purchase_orders p ON g.po_id = p.po_id
      JOIN vendors v ON p.vendor_id = v.vendor_id
      JOIN users u ON g.received_by = u.user_id
      ORDER BY g.created_at DESC
    `;
    const result = await pool.query(query);
    return result.rows;
  }

  // ============================================================================
  // 4. GET SINGLE GRN DETAILS
  // ============================================================================
  static async getGRNById(grnId) {
    const grnRes = await pool.query(
      `SELECT g.*, p.po_number, v.legal_name as vendor_name, u.full_name as received_by_name
       FROM goods_receipt_notes g
       JOIN purchase_orders p ON g.po_id = p.po_id
       JOIN vendors v ON p.vendor_id = v.vendor_id
       JOIN users u ON g.received_by = u.user_id
       WHERE g.grn_id = $1`, 
      [grnId]
    );
    
    if (grnRes.rows.length === 0) throw new Error('GRN not found');
    const grn = grnRes.rows[0];

    const itemsRes = await pool.query(`
      SELECT gli.*, pli.description as item_description, pli.unit
      FROM grn_line_items gli
      JOIN po_line_items pli ON gli.po_line_id = pli.line_id
      WHERE gli.grn_id = $1
    `, [grnId]);

    return { ...grn, items: itemsRes.rows };
  }
}

module.exports = GoodsReceiptService;