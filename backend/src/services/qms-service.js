// ============================================================================
// VILAGIO ERP - QMS DOCUMENT SERVICE (PHASE 1)
// ============================================================================

const { pool } = require('./auth-service'); // Or your database config path
const bcrypt = require('bcrypt');

const QmsService = {
  
  // 1. Get Dashboard Completion Stats (The "X of 121" metrics)
  async getCompletionStats() {
    try {
      const query = `
        SELECT 
          s.section_id,
          s.section_code,
          s.section_name,
          s.color_code,
          s.sort_order,
          COUNT(d.doc_id) as total_docs,
          COUNT(d.doc_id) FILTER (WHERE d.status = 'RELEASED') as released_docs,
          COUNT(d.doc_id) FILTER (WHERE d.status = 'APPROVED') as approved_docs,
          COUNT(d.doc_id) FILTER (WHERE d.status = 'REVIEW') as review_docs,
          COUNT(d.doc_id) FILTER (WHERE d.status = 'DRAFT') as draft_docs
        FROM qms_sections s
        LEFT JOIN qms_documents d ON s.section_id = d.section_id
        GROUP BY s.section_id
        ORDER BY s.sort_order ASC
      `;
      const result = await pool.query(query);
      
      let totalDocs = 0;
      let totalReleased = 0;
      
      const sections = result.rows.map(row => {
        const total = parseInt(row.total_docs);
        const released = parseInt(row.released_docs);
        totalDocs += total;
        totalReleased += released;
        
        return {
          ...row,
          completion_percentage: total > 0 ? Math.round((released / total) * 100) : 0
        };
      });

      return {
        overall_completion: totalDocs > 0 ? Math.round((totalReleased / totalDocs) * 100) : 0,
        total_documents: totalDocs,
        total_released: totalReleased,
        sections
      };
    } catch (error) {
      console.error('Error fetching QMS stats:', error);
      throw error;
    }
  },

  // 2. List all documents (Master Register)
  async listDocuments(filters = {}) {
    try {
      let query = `
        SELECT 
          d.doc_id, d.doc_code, d.doc_name, d.doc_type, d.status, d.erp_link_module,
          s.section_code, s.section_name, s.color_code,
          v.version_number, v.effective_date, v.review_due_date,
          u.full_name as author_name
        FROM qms_documents d
        JOIN qms_sections s ON d.section_id = s.section_id
        LEFT JOIN qms_document_versions v ON d.current_version_id = v.version_id
        LEFT JOIN users u ON v.authored_by = u.user_id
        WHERE 1=1
      `;
      
      const params = [];
      let paramCount = 1;

      if (filters.section_id) {
        query += ` AND d.section_id = $${paramCount}`;
        params.push(filters.section_id);
        paramCount++;
      }

      if (filters.status) {
        query += ` AND d.status = $${paramCount}`;
        params.push(filters.status);
        paramCount++;
      }

      query += ` ORDER BY s.sort_order ASC, d.doc_code ASC`;
      
      const result = await pool.query(query, params);
      return result.rows;
    } catch (error) {
      console.error('Error listing QMS documents:', error);
      throw error;
    }
  },

  // 3. Get specific document details and version history
  async getDocumentById(docId) {
    try {
      const docQuery = `
        SELECT d.*, s.section_name, s.section_code 
        FROM qms_documents d
        JOIN qms_sections s ON d.section_id = s.section_id
        WHERE d.doc_id = $1
      `;
      const docResult = await pool.query(docQuery, [docId]);
      
      if (docResult.rows.length === 0) throw new Error('Document not found');
      
      const versionsQuery = `
        SELECT v.*, u.full_name as author_name 
        FROM qms_document_versions v
        LEFT JOIN users u ON v.authored_by = u.user_id
        WHERE v.doc_id = $1
        ORDER BY v.created_at DESC
      `;
      const versionsResult = await pool.query(versionsQuery, [docId]);

      return {
        ...docResult.rows[0],
        versions: versionsResult.rows
      };
    } catch (error) {
      console.error('Error fetching QMS document:', error);
      throw error;
    }
  },

  // 4. Create a Draft (either initial v0.1 or next revision)
  async createDraft(docId, userId) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const docRes = await client.query('SELECT status, current_version_id FROM qms_documents WHERE doc_id = $1', [docId]);
      if (docRes.rows.length === 0) throw new Error('Document not found');
      
      const doc = docRes.rows[0];
      let newVersionNumber = '0.1';
      let previousContent = {};

      // If document is already released, we are creating a new major/minor revision
      if (doc.status === 'RELEASED' && doc.current_version_id) {
        const prevVerRes = await client.query('SELECT version_number, content_data FROM qms_document_versions WHERE version_id = $1', [doc.current_version_id]);
        if (prevVerRes.rows.length > 0) {
          const currentVer = parseFloat(prevVerRes.rows[0].version_number);
          newVersionNumber = (currentVer + 1.0).toFixed(1); // e.g., 1.0 -> 2.0
          previousContent = prevVerRes.rows[0].content_data;
        }
      } else if (doc.status !== 'PLANNED') {
         throw new Error(`Cannot create draft. Document is currently in ${doc.status} status.`);
      }

      // Create the new draft version
      const insertVerQuery = `
        INSERT INTO qms_document_versions (doc_id, version_number, content_data, authored_by, status)
        VALUES ($1, $2, $3, $4, 'DRAFT')
        RETURNING version_id
      `;
      const newVerRes = await client.query(insertVerQuery, [docId, newVersionNumber, previousContent, userId]);

      // Update the master document status
      await client.query(`UPDATE qms_documents SET status = 'DRAFT' WHERE doc_id = $1`, [docId]);

      await client.query('COMMIT');
      return { success: true, version_id: newVerRes.rows[0].version_id, version_number: newVersionNumber };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },

  // 5. Update Draft Content (Rich text JSONB)
  async updateDraft(versionId, contentData, userId) {
    try {
      const query = `
        UPDATE qms_document_versions 
        SET content_data = $1, updated_at = CURRENT_TIMESTAMP
        WHERE version_id = $2 AND status = 'DRAFT' AND authored_by = $3
        RETURNING *
      `;
      const result = await pool.query(query, [contentData, versionId, userId]);
      if (result.rows.length === 0) throw new Error('Draft not found or you are not the author');
      return result.rows[0];
    } catch (error) {
      throw error;
    }
  },

  // 6. Submit for Review
  async submitForReview(versionId) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      const updateVer = await client.query(
        `UPDATE qms_document_versions SET status = 'REVIEW' WHERE version_id = $1 RETURNING doc_id, authored_by, version_number`, 
        [versionId]
      );
      if (updateVer.rows.length === 0) throw new Error('Version not found');
      
      const docRes = await client.query(
        `UPDATE qms_documents SET status = 'REVIEW' WHERE doc_id = $1 RETURNING doc_code, doc_name`, 
        [updateVer.rows[0].doc_id]
      );
      
      // TRIGGER EMAIL NOTIFICATION
      try {
        const notificationService = require('./notification-service');
        const authorRes = await client.query(`SELECT full_name FROM users WHERE user_id = $1`, [updateVer.rows[0].authored_by]);
        const authorName = authorRes.rows[0]?.full_name || 'System User';
        
        if (notificationService.notifyQADocumentReview) {
          notificationService.notifyQADocumentReview(
            docRes.rows[0].doc_code, 
            docRes.rows[0].doc_name, 
            updateVer.rows[0].version_number, 
            authorName
          ).catch(e => console.error('QMS Email trigger failed:', e));
        }
      } catch (e) {
        console.error('Failed to trigger QA document email:', e);
      }
      
      await client.query('COMMIT');
      return { success: true, message: 'Submitted for QA Review' };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },

  // 7. Approve & Release Document (The Gatekeeper)
  async releaseDocument(versionId, approverId, signaturePassword) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Verify Signature
      const userRes = await client.query('SELECT password_hash FROM users WHERE user_id = $1', [approverId]);
      const valid = await bcrypt.compare(signaturePassword, userRes.rows[0].password_hash);
      if (!valid) throw new Error('Invalid digital signature password');

      // 2. Get Version & Doc info
      const verRes = await client.query('SELECT doc_id, version_number FROM qms_document_versions WHERE version_id = $1', [versionId]);
      if (verRes.rows.length === 0) throw new Error('Version not found');
      const docId = verRes.rows[0].doc_id;
      const draftVer = verRes.rows[0].version_number;

      // Ensure version number becomes a solid release number (e.g. 0.1 -> 1.0)
      const releaseVersion = draftVer === '0.1' ? '1.0' : draftVer; 

      // 3. Mark old active version as SUPERSEDED
      await client.query(`
        UPDATE qms_document_versions 
        SET status = 'SUPERSEDED' 
        WHERE doc_id = $1 AND status = 'RELEASED'
      `, [docId]);

      // 4. Mark this version as RELEASED and set effective dates
      // Default review interval is 1 year (12 months)
      await client.query(`
        UPDATE qms_document_versions 
        SET status = 'RELEASED', 
            version_number = $1,
            approved_by = $2, 
            effective_date = CURRENT_TIMESTAMP, 
            review_due_date = CURRENT_TIMESTAMP + INTERVAL '1 year'
        WHERE version_id = $3
      `, [releaseVersion, approverId, versionId]);

      // 5. Update Master Document Register
      await client.query(`
        UPDATE qms_documents 
        SET status = 'RELEASED', current_version_id = $1 
        WHERE doc_id = $2
      `, [versionId, docId]);

      // 6. Record Approval Audit Trail
      await client.query(`
        INSERT INTO qms_approvals (version_id, approver_id, role, status, action_at)
        VALUES ($1, $2, 'QA_MANAGER', 'APPROVED', CURRENT_TIMESTAMP)
      `, [versionId, approverId]);

      await client.query('COMMIT');
      return { success: true, message: `Document officially released as Version ${releaseVersion}` };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },

// ============================================================================
  // PHASE 2: NCR & CAPA MANAGEMENT (With Digital Signatures & Emails)
  // ============================================================================

  // Helper function to verify signatures
  async verifySignature(userId, password) {
    const userRes = await pool.query('SELECT password_hash FROM users WHERE user_id = $1', [userId]);
    const valid = await bcrypt.compare(password, userRes.rows[0].password_hash);
    if (!valid) throw new Error('Invalid digital signature password.');
  },

  // --- NCR Methods ---
  async createNCR(ncrData, userId, signaturePassword) {
    await this.verifySignature(userId, signaturePassword);

    const { source_module, source_id, description, severity, assigned_to } = ncrData;
    
    const date = new Date();
    const dateStr = `${date.getFullYear().toString().slice(-2)}${(date.getMonth() + 1).toString().padStart(2, '0')}`;
    
    const countRes = await pool.query(`SELECT COUNT(*) FROM qms_ncr WHERE ncr_code LIKE 'NCR-${dateStr}-%'`);
    const sequence = String(parseInt(countRes.rows[0].count) + 1).padStart(3, '0');
    const ncrCode = `NCR-${dateStr}-${sequence}`;

    const query = `
      INSERT INTO qms_ncr (
        ncr_code, source_module, source_id, description, severity, raised_by, assigned_to, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'OPEN')
      RETURNING *
    `;

    const result = await pool.query(query, [ncrCode, source_module, source_id, description, severity, userId, assigned_to]);
    
    // Trigger Email if assigned
    if (assigned_to) {
      try {
        const notificationService = require('./notification-service');
        const userRes = await pool.query('SELECT email FROM users WHERE user_id = $1', [assigned_to]);
        if (userRes.rows.length > 0) {
          notificationService.notifyNCRAssigned(ncrCode, description, userRes.rows[0].email);
        }
      } catch (e) { console.error('Failed to trigger NCR email', e); }
    }

    return result.rows[0];
  },

  async listNCRs(filters = {}) {
    let query = `
      SELECT n.*, r.full_name as raised_by_name, a.full_name as assigned_to_name
      FROM qms_ncr n
      LEFT JOIN users r ON n.raised_by = r.user_id
      LEFT JOIN users a ON n.assigned_to = a.user_id
      WHERE 1=1
    `;
    const params = [];
    let paramCount = 1;
    if (filters.status) { query += ` AND n.status = $${paramCount}`; params.push(filters.status); paramCount++; }
    query += ` ORDER BY n.created_at DESC`;
    const result = await pool.query(query, params);
    return result.rows;
  },

  async updateNCR(ncrId, updateData, userId, signaturePassword) {
    await this.verifySignature(userId, signaturePassword);

    const { status, root_cause, resolution, assigned_to } = updateData;
    const updates = [];
    const values = [];
    let paramCount = 1;

    if (status) { updates.push(`status = $${paramCount}`); values.push(status); paramCount++; }
    if (root_cause) { updates.push(`root_cause = $${paramCount}`); values.push(root_cause); paramCount++; }
    if (resolution) { updates.push(`resolution = $${paramCount}`); values.push(resolution); paramCount++; }
    if (assigned_to) { updates.push(`assigned_to = $${paramCount}`); values.push(assigned_to); paramCount++; }
    if (status === 'CLOSED') { updates.push(`closed_at = CURRENT_TIMESTAMP`); }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(ncrId);

    const query = `UPDATE qms_ncr SET ${updates.join(', ')} WHERE ncr_id = $${paramCount} RETURNING *`;
    const result = await pool.query(query, values);
    if (result.rows.length === 0) throw new Error('NCR not found');

    // Trigger Email if re-assigned
    if (assigned_to) {
      try {
        const notificationService = require('./notification-service');
        const userRes = await pool.query('SELECT email FROM users WHERE user_id = $1', [assigned_to]);
        if (userRes.rows.length > 0) {
          notificationService.notifyNCRAssigned(result.rows[0].ncr_code, result.rows[0].description, userRes.rows[0].email);
        }
      } catch (e) { console.error('Failed to trigger NCR email', e); }
    }

    return result.rows[0];
  },

  // --- CAPA Methods ---
  async createCAPA(capaData, userId, signaturePassword) {
    await this.verifySignature(userId, signaturePassword);

    const { ncr_id, action_description, action_owner, due_date } = capaData;
    
    const date = new Date();
    const dateStr = `${date.getFullYear().toString().slice(-2)}${(date.getMonth() + 1).toString().padStart(2, '0')}`;
    const countRes = await pool.query(`SELECT COUNT(*) FROM qms_capa WHERE capa_code LIKE 'CAPA-${dateStr}-%'`);
    const sequence = String(parseInt(countRes.rows[0].count) + 1).padStart(3, '0');
    const capaCode = `CAPA-${dateStr}-${sequence}`;

    const client = await pool.connect();
    let createdCapa, ncrCode;
    try {
      await client.query('BEGIN');
      const query = `
        INSERT INTO qms_capa (capa_code, ncr_id, action_description, action_owner, due_date, status) 
        VALUES ($1, $2, $3, $4, $5, 'OPEN') RETURNING *
      `;
      const result = await client.query(query, [capaCode, ncr_id, action_description, action_owner, due_date]);
      createdCapa = result.rows[0];
      
      const ncrRes = await client.query(`UPDATE qms_ncr SET status = 'CAPA_REQUIRED' WHERE ncr_id = $1 RETURNING ncr_code`, [ncr_id]);
      ncrCode = ncrRes.rows[0].ncr_code;
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }

    // Trigger Email to CAPA Owner
    if (action_owner) {
      try {
        const notificationService = require('./notification-service');
        const userRes = await pool.query('SELECT email FROM users WHERE user_id = $1', [action_owner]);
        if (userRes.rows.length > 0) {
          notificationService.notifyCAPAAssigned(capaCode, ncrCode, action_description, due_date, userRes.rows[0].email);
        }
      } catch (e) { console.error('Failed to trigger CAPA email', e); }
    }

    return createdCapa;
  },

  async listCAPAs(filters = {}) {
    let query = `
      SELECT c.*, n.ncr_code, o.full_name as owner_name, v.full_name as verified_by_name
      FROM qms_capa c
      JOIN qms_ncr n ON c.ncr_id = n.ncr_id
      LEFT JOIN users o ON c.action_owner = o.user_id
      LEFT JOIN users v ON c.verified_by = v.user_id
      WHERE 1=1
    `;
    const params = [];
    let paramCount = 1;
    if (filters.status) { query += ` AND c.status = $${paramCount}`; params.push(filters.status); paramCount++; }
    query += ` ORDER BY c.created_at DESC`;
    const result = await pool.query(query, params);
    return result.rows;
  },

  async updateCAPA(capaId, updateData, userId, signaturePassword) {
    await this.verifySignature(userId, signaturePassword);

    const { status, effectiveness_review } = updateData;
    const updates = [];
    const values = [];
    let paramCount = 1;

    if (status) { updates.push(`status = $${paramCount}`); values.push(status); paramCount++; }
    if (effectiveness_review) { updates.push(`effectiveness_review = $${paramCount}`); values.push(effectiveness_review); paramCount++; }
    
    if (status === 'VERIFIED' || status === 'CLOSED') {
      updates.push(`verified_by = $${paramCount}`); values.push(userId); paramCount++;
      updates.push(`verified_at = CURRENT_TIMESTAMP`);
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(capaId);

    const query = `UPDATE qms_capa SET ${updates.join(', ')} WHERE capa_id = $${paramCount} RETURNING *`;
    const result = await pool.query(query, values);
    if (result.rows.length === 0) throw new Error('CAPA not found');
    return result.rows[0];
  },

  // ============================================================================
  // PHASE 3: INTERNAL AUDITS
  // ============================================================================

  async createAudit(auditData) {
    const { audit_type, audit_date, lead_auditor, scope, next_audit_date, invited_members } = auditData;
    
    // BUG FIX: Sanitize empty date strings to NULL so Postgres doesn't crash
    const safeNextDate = next_audit_date === '' ? null : next_audit_date;
    const safeInvites = Array.isArray(invited_members) ? invited_members : [];

    // Auto-generate Audit Code
    const date = new Date(audit_date || new Date());
    const year = date.getFullYear().toString().slice(-2);
    const countRes = await pool.query(`SELECT COUNT(*) FROM qms_audits WHERE audit_code LIKE 'AUD-${year}-%'`);
    const sequence = String(parseInt(countRes.rows[0].count) + 1).padStart(3, '0');
    const auditCode = `AUD-${year}-${sequence}`;

    const query = `
      INSERT INTO qms_audits (audit_code, audit_type, audit_date, lead_auditor, scope, next_audit_date, status, invited_members)
      VALUES ($1, $2, $3, $4, $5, $6, 'PLANNED', $7)
      RETURNING *
    `;
    const result = await pool.query(query, [auditCode, audit_type, audit_date, lead_auditor, scope, safeNextDate, safeInvites]);

    // FEATURE: Send Email Invites
    if (safeInvites.length > 0) {
      try {
        const notificationService = require('./notification-service');
        
        // Get Lead Auditor Name
        const leadRes = await pool.query('SELECT full_name FROM users WHERE user_id = $1', [lead_auditor]);
        const leadName = leadRes.rows[0]?.full_name || 'QA Team';
        
        // Get Invited Emails
        const emailRes = await pool.query('SELECT email FROM users WHERE user_id = ANY($1)', [safeInvites]);
        const emails = emailRes.rows.map(r => r.email);
        
        if (emails.length > 0) {
          notificationService.notifyAuditInvite(auditCode, audit_type, audit_date, scope, leadName, emails);
        }
      } catch (e) {
        console.error('Failed to send audit invites:', e);
      }
    }

    return result.rows[0];
  },

  async listAudits() {
    const query = `
      SELECT a.*, u.full_name as auditor_name 
      FROM qms_audits a 
      LEFT JOIN users u ON a.lead_auditor = u.user_id 
      ORDER BY a.audit_date DESC
    `;
    const result = await pool.query(query);
    return result.rows;
  },

  async updateAudit(auditId, updateData, userId, signaturePassword) {
    if (updateData.status === 'COMPLETED' && signaturePassword) {
      await this.verifySignature(userId, signaturePassword);
    }

    const { status, report_data, next_audit_date, lead_auditor, audit_date, scope, invited_members } = updateData;
    const updates = [];
    const values = [];
    let paramCount = 1;

    if (status) { updates.push(`status = $${paramCount}`); values.push(status); paramCount++; }
    if (report_data !== undefined) { updates.push(`report_data = $${paramCount}`); values.push(report_data); paramCount++; }
    if (lead_auditor) { updates.push(`lead_auditor = $${paramCount}`); values.push(lead_auditor); paramCount++; }
    if (audit_date) { updates.push(`audit_date = $${paramCount}`); values.push(audit_date); paramCount++; }
    if (scope) { updates.push(`scope = $${paramCount}`); values.push(scope); paramCount++; }
    if (invited_members) { updates.push(`invited_members = $${paramCount}`); values.push(invited_members); paramCount++; }

    // BUG FIX: Handle Next Audit Date properly
    if (next_audit_date === '') {
      updates.push(`next_audit_date = NULL`);
    } else if (next_audit_date) {
      updates.push(`next_audit_date = $${paramCount}`); values.push(next_audit_date); paramCount++;
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(auditId);

    const query = `UPDATE qms_audits SET ${updates.join(', ')} WHERE audit_id = $${paramCount} RETURNING *`;
    const result = await pool.query(query, values);
    if (result.rows.length === 0) throw new Error('Audit not found');
    return result.rows[0];
  },
  // ============================================================================
  // PHASE 3: TRAINING MATRIX & SOP ACKNOWLEDGEMENT
  // ============================================================================

  async getTrainingMatrix() {
    // 1. Get all active users
    const usersRes = await pool.query(`SELECT user_id, full_name, role FROM users WHERE is_active = true ORDER BY full_name`);
    
    // 2. Get all currently RELEASED governed documents (SOPs, Policies, Manuals)
    const docsRes = await pool.query(`
      SELECT doc_id, doc_code, doc_name, current_version_id 
      FROM qms_documents 
      WHERE status = 'RELEASED' AND doc_type IN ('SOP', 'POL', 'MAN') 
      ORDER BY doc_code
    `);

    // 3. Get all valid training records matching current versions
    const recordsRes = await pool.query(`
      SELECT user_id, doc_id, version_id, acknowledged_at 
      FROM qms_training_records
    `);

    return {
      users: usersRes.rows,
      documents: docsRes.rows,
      records: recordsRes.rows
    };
  },

  async acknowledgeDocument(userId, docId, signaturePassword) {
    // 1. Verify Digital Signature
    await this.verifySignature(userId, signaturePassword);

    // 2. Get the current released version of the document
    const docRes = await pool.query(`SELECT current_version_id FROM qms_documents WHERE doc_id = $1 AND status = 'RELEASED'`, [docId]);
    if (docRes.rows.length === 0) throw new Error('Document is not in RELEASED status or does not exist.');

    const versionId = docRes.rows[0].current_version_id;

    // 3. Insert the training record (upsert to prevent crashes if double-clicked)
    const query = `
      INSERT INTO qms_training_records (user_id, doc_id, version_id, acknowledged_at)
      VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
      ON CONFLICT (user_id, doc_id, version_id) DO NOTHING
      RETURNING *
    `;
    await pool.query(query, [userId, docId, versionId]);
    
    return { success: true, message: 'Document successfully acknowledged.' };
  }
};

module.exports = QmsService;