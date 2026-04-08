const { pool } = require('./auth-service'); // Reusing your existing DB connection

class SupplierService {
  
  // ============================================================================
  // 1. CORE UTILITY: VTL-ID GENERATOR
  // Matches roadmap format: VTL-SUP-[CATEGORY]-[YEAR]-[SEQUENCE]
  // ============================================================================
  static async generateVtlSupplierId(categoryCode) {
    const year = new Date().getFullYear();
    const prefix = `VTL-SUP-${categoryCode.toUpperCase()}-${year}-`;

    // Find the highest sequence number for this category and year
    const result = await pool.query(
      `SELECT vtl_supplier_id FROM vendors 
       WHERE vtl_supplier_id LIKE $1 
       ORDER BY vtl_supplier_id DESC LIMIT 1`,
      [`${prefix}%`]
    );

    let sequence = 1;
    if (result.rows.length > 0) {
      // Extract the last 4 digits (e.g., from "VTL-SUP-MFG-2026-0042" -> "0042")
      const lastId = result.rows[0].vtl_supplier_id;
      const lastSequence = parseInt(lastId.split('-').pop(), 10);
      sequence = lastSequence + 1;
    }

    // Pad with leading zeros (e.g., 1 -> "0001")
    const paddedSequence = sequence.toString().padStart(4, '0');
    return `${prefix}${paddedSequence}`;
  }

  // ============================================================================
  // 2. CREATE VENDOR (DRAFT MODE)
  // ============================================================================
  static async createVendor(vendorData, userId) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN'); // Start transaction

     // 1. Insert Master Vendor Record (with JSONB sections)
      // FIX: Added 'uuidv4()' for vendor_id and handled empty strings for integer fields
      const vendorResult = await client.query(
        `INSERT INTO vendors (
          vendor_id, legal_name, trading_name, registered_address, year_established, 
          company_reg_no, vat_number, primary_category, all_categories, 
          compliance_data, capabilities_data, banking_data, declaration_data, 
          status, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'DRAFT', $14)
        RETURNING vendor_id`,
        [
          uuidv4(), // Added missing vendor_id generation!
          vendorData.legal_name, 
          vendorData.trading_name, 
          vendorData.registered_address,
          // FIX: Convert empty string to null for the integer column
          vendorData.year_established === "" ? null : vendorData.year_established, 
          vendorData.company_reg_no, 
          vendorData.vat_number,
          vendorData.primary_category, 
          JSON.stringify(vendorData.all_categories || []),
          JSON.stringify(vendorData.compliance_data || {}),
          JSON.stringify(vendorData.capabilities_data || {}),
          JSON.stringify(vendorData.banking_data || {}),
          JSON.stringify(vendorData.declaration_data || {}),
          userId
        ]
      );
      
      const vendorId = vendorResult.rows[0].vendor_id;

      // 2. Insert Contacts (if provided)
      if (vendorData.contacts && vendorData.contacts.length > 0) {
        for (const contact of vendorData.contacts) {
          await client.query(
            `INSERT INTO vendor_contacts (vendor_id, full_name, position, telephone, email, is_primary)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [vendorId, contact.full_name, contact.position, contact.telephone, contact.email, contact.is_primary]
          );
        }
      }

      // 3. Insert Trade References (if provided)
      if (vendorData.references && vendorData.references.length > 0) {
        for (const ref of vendorData.references) {
          await client.query(
            `INSERT INTO vendor_references (vendor_id, company_name, contact_name, contact_details, reference_type)
             VALUES ($1, $2, $3, $4, $5)`,
            [vendorId, ref.company_name, ref.contact_name, ref.contact_details, ref.reference_type || 'trade']
          );
        }
      }

      await client.query('COMMIT');
      return { vendor_id: vendorId, status: 'DRAFT', message: 'Vendor draft saved successfully' };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // ============================================================================
  // 3. FETCH VENDORS (FOR AVL & DASHBOARDS)
  // ============================================================================
  static async listVendors(filters = {}) {
    let query = `
      SELECT v.vendor_id, v.vtl_supplier_id, v.legal_name, v.trading_name, 
             v.primary_category, v.status, v.created_at, v.qa_approved_at,
             u.full_name as created_by_name
      FROM vendors v
      LEFT JOIN users u ON v.created_by = u.user_id
      WHERE 1=1
    `;
    const params = [];

    // Filter by AVL Status (Approved / Conditionally Approved)
    if (filters.avl_only) {
      query += ` AND v.status IN ('APPROVED', 'CONDITIONALLY_APPROVED')`;
    } 
    // Filter by specific status (e.g., 'AWAITING_QA')
    else if (filters.status) {
      params.push(filters.status);
      query += ` AND v.status = $${params.length}`;
    }

    if (filters.category) {
      params.push(filters.category);
      query += ` AND v.primary_category = $${params.length}`;
    }

    query += ` ORDER BY v.created_at DESC`;
    
    const result = await pool.query(query, params);
    return result.rows;
  }

  static async getVendorById(vendorId) {
    const vendorRes = await pool.query(`SELECT * FROM vendors WHERE vendor_id = $1`, [vendorId]);
    if (vendorRes.rows.length === 0) throw new Error('Vendor not found');
    
    const vendor = vendorRes.rows[0];

    // Fetch relational data
    const [contacts, references, documents] = await Promise.all([
      pool.query(`SELECT * FROM vendor_contacts WHERE vendor_id = $1`, [vendorId]),
      pool.query(`SELECT * FROM vendor_references WHERE vendor_id = $1`, [vendorId]),
      pool.query(`SELECT * FROM vendor_documents WHERE vendor_id = $1`, [vendorId])
    ]);

    return {
      ...vendor,
      contacts: contacts.rows,
      references: references.rows,
      documents: documents.rows
    };
  }

  // ============================================================================
  // 4. WORKFLOW TRANSITIONS (SALES -> QA)
  // ============================================================================
  
  // Sales User submits the draft for QA Review
  static async submitForQA(vendorId) {
    const result = await pool.query(
      `UPDATE vendors SET status = 'AWAITING_QA', updated_at = CURRENT_TIMESTAMP 
       WHERE vendor_id = $1 AND status IN ('DRAFT', 'REVISION_REQUIRED') RETURNING *`,
      [vendorId]
    );
    if (result.rows.length === 0) throw new Error('Vendor cannot be submitted for QA at this stage.');
    return result.rows[0];
  }

  // QA Officer approves the vendor
  static async approveVendor(vendorId, qaUserId, approvalData) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Get the category to generate the ID
      const vendorRes = await client.query(`SELECT primary_category, status FROM vendors WHERE vendor_id = $1`, [vendorId]);
      if (vendorRes.rows.length === 0) throw new Error('Vendor not found');
      
      const vendor = vendorRes.rows[0];
      if (vendor.status !== 'AWAITING_QA' && vendor.status !== 'QA_REVIEW') {
        throw new Error('Vendor is not pending QA approval');
      }

      // 2. Generate the unique VTL-ID
      const vtlSupplierId = await this.generateVtlSupplierId(vendor.primary_category);
      const finalStatus = approvalData.is_conditional ? 'CONDITIONALLY_APPROVED' : 'APPROVED';

      // 3. Update the record
      const updateRes = await client.query(
        `UPDATE vendors SET 
          status = $1, 
          vtl_supplier_id = $2, 
          qa_approved_by = $3, 
          qa_approved_at = CURRENT_TIMESTAMP,
          qa_notes = $4,
          updated_at = CURRENT_TIMESTAMP
         WHERE vendor_id = $5 RETURNING *`,
        [finalStatus, vtlSupplierId, qaUserId, approvalData.notes, vendorId]
      );

      await client.query('COMMIT');
      return updateRes.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // QA Officer rejects/bounces back the vendor
  static async rejectVendor(vendorId, qaUserId, reason) {
    const result = await pool.query(
      `UPDATE vendors SET 
        status = 'REVISION_REQUIRED', 
        qa_notes = $1, 
        updated_at = CURRENT_TIMESTAMP 
       WHERE vendor_id = $2 RETURNING *`,
      [reason, vendorId]
    );
    return result.rows[0];
  }
}

module.exports = SupplierService;