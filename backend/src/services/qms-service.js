// ============================================================================
// VILAGIO ERP - QMS DOCUMENT SERVICE
// ============================================================================

const { pool } = require('./auth-service'); // Or your database config path
const bcrypt = require('bcrypt');

// --- HELPER: GENERATE HTML TEMPLATES ---
function getTemplateForType(doc_type) {
  let template = '';
  switch (doc_type) {
    case 'POL': // Policy
      template = `
        <h2 style="color: #0ea5e9;">1. Purpose & Objective</h2><p>State the high-level intent of this policy.</p>
        <h2 style="color: #0ea5e9;">2. Scope</h2><p>Define who and what this policy applies to.</p>
        <h2 style="color: #0ea5e9;">3. Policy Statement</h2><p>Outline the core rules, directives, and commitments of VTL.</p>
        <h2 style="color: #0ea5e9;">4. Responsibilities</h2><p>List the departments/roles responsible for enforcing this policy.</p>
        <h2 style="color: #0ea5e9;">5. Exceptions</h2><p>List any specific scenarios where this policy does not apply.</p>
      `;
      break;
    case 'MAN': // Manual
      template = `
        <h1 style="text-align: center; color: #8b5cf6;">QUALITY SYSTEM MANUAL</h1>
        <h2 style="color: #8b5cf6;">1. Introduction & Company Profile</h2><p>Overview of VTL operations.</p>
        <h2 style="color: #8b5cf6;">2. Quality Policy</h2><p>Formal commitment to quality standards.</p>
        <h2 style="color: #8b5cf6;">3. Scope of the QMS</h2><p>Boundaries and applicability.</p>
        <h2 style="color: #8b5cf6;">4. Organizational Structure</h2><p>Leadership and departmental breakdown.</p>
        <h2 style="color: #8b5cf6;">5. System Elements</h2><p>Map to ISO 9001 clauses (Planning, Support, Operation, Performance, Improvement).</p>
      `;
      break;
    case 'FRM': // Form
      template = `
        <table border="1" style="width: 100%; border-collapse: collapse; border-color: #cbd5e1;">
          <tr style="background-color: #f1f5f9;"><td style="padding: 8px;"><strong>Date:</strong></td><td style="padding: 8px;"><br><br></td><td style="padding: 8px;"><strong>Department:</strong></td><td style="padding: 8px;"><br><br></td></tr>
          <tr><td colspan="4" style="padding: 8px;"><strong>Details / Input:</strong><br><br><br><br><br><br></td></tr>
          <tr style="background-color: #f1f5f9;"><td style="padding: 8px;"><strong>Completed By:</strong></td><td style="padding: 8px;"><br><br></td><td style="padding: 8px;"><strong>Signature:</strong></td><td style="padding: 8px;"><br><br></td></tr>
        </table>
      `;
      break;
    case 'CHK': // Checklist
      template = `
        <table border="1" style="width: 100%; border-collapse: collapse; border-color: #cbd5e1;">
          <tr style="background-color: #f1f5f9;"><th style="padding: 8px; text-align: left;">Step</th><th style="padding: 8px; text-align: left;">Task / Verification Description</th><th style="padding: 8px;">Pass</th><th style="padding: 8px;">Fail</th><th style="padding: 8px;">N/A</th><th style="padding: 8px; text-align: left;">Remarks</th></tr>
          <tr><td style="padding: 8px;">1</td><td style="padding: 8px;">Enter task description here</td><td style="padding: 8px; text-align: center;">[ ]</td><td style="padding: 8px; text-align: center;">[ ]</td><td style="padding: 8px; text-align: center;">[ ]</td><td style="padding: 8px;"></td></tr>
          <tr><td style="padding: 8px;">2</td><td style="padding: 8px;">Enter task description here</td><td style="padding: 8px; text-align: center;">[ ]</td><td style="padding: 8px; text-align: center;">[ ]</td><td style="padding: 8px; text-align: center;">[ ]</td><td style="padding: 8px;"></td></tr>
          <tr><td style="padding: 8px;">3</td><td style="padding: 8px;">Enter task description here</td><td style="padding: 8px; text-align: center;">[ ]</td><td style="padding: 8px; text-align: center;">[ ]</td><td style="padding: 8px; text-align: center;">[ ]</td><td style="padding: 8px;"></td></tr>
        </table>
      `;
      break;
    case 'LOG': // Record/Log
      template = `
        <table border="1" style="width: 100%; border-collapse: collapse; border-color: #cbd5e1;">
          <tr style="background-color: #f1f5f9;"><th style="padding: 8px; text-align: left;">Date & Time</th><th style="padding: 8px; text-align: left;">Parameter Measured</th><th style="padding: 8px; text-align: left;">Value / Reading</th><th style="padding: 8px; text-align: left;">Operator Initial</th><th style="padding: 8px; text-align: left;">Verifier Initial</th><th style="padding: 8px; text-align: left;">Comments</th></tr>
          <tr><td style="padding: 8px;"><br><br></td><td style="padding: 8px;"><br><br></td><td style="padding: 8px;"><br><br></td><td style="padding: 8px;"><br><br></td><td style="padding: 8px;"><br><br></td><td style="padding: 8px;"><br><br></td></tr>
          <tr><td style="padding: 8px;"><br><br></td><td style="padding: 8px;"><br><br></td><td style="padding: 8px;"><br><br></td><td style="padding: 8px;"><br><br></td><td style="padding: 8px;"><br><br></td><td style="padding: 8px;"><br><br></td></tr>
        </table>
      `;
      break;
    case 'REG': // Register
      template = `
        <table border="1" style="width: 100%; border-collapse: collapse; border-color: #cbd5e1;">
          <tr style="background-color: #f1f5f9;"><th style="padding: 8px; text-align: left;">Reference ID</th><th style="padding: 8px; text-align: left;">Date Logged</th><th style="padding: 8px; text-align: left;">Item Description</th><th style="padding: 8px; text-align: left;">Current Status</th><th style="padding: 8px; text-align: left;">Action Owner</th></tr>
          <tr><td style="padding: 8px;"><br><br></td><td style="padding: 8px;"><br><br></td><td style="padding: 8px;"><br><br></td><td style="padding: 8px;"><br><br></td><td style="padding: 8px;"><br><br></td></tr>
        </table>
      `;
      break;
    default:
      template = `<p>Start documenting here...</p>`;
  }
  return template;
}

const QmsService = {
  
  async getCompletionStats() {
    try {
      const query = `
        SELECT 
          s.section_id, s.section_code, s.section_name, s.color_code, s.sort_order,
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

  // ============================================================================
  // AUTO-SEQUENCING ENGINE: Get Next Available Document Code
  // ============================================================================
  async getNextDocumentCode(sectionId, docType) {
    try {
      const sectionRes = await pool.query('SELECT section_code FROM qms_sections WHERE section_id = $1', [sectionId]);
      if (sectionRes.rows.length === 0) throw new Error('Section not found');
      const sectionCode = sectionRes.rows[0].section_code;

      const prefix = `QA-${sectionCode}-${docType}-`;

      const query = `
        SELECT doc_code 
        FROM qms_documents 
        WHERE doc_code LIKE $1 
        ORDER BY doc_code DESC 
        LIMIT 1
      `;
      const result = await pool.query(query, [`${prefix}%`]);

      let nextNumber = 1;

      if (result.rows.length > 0) {
        const lastCode = result.rows[0].doc_code; 
        const parts = lastCode.split('-');
        const lastNumberStr = parts[parts.length - 1]; 
        const lastNumber = parseInt(lastNumberStr, 10);
        
        if (!isNaN(lastNumber)) {
          nextNumber = lastNumber + 1; 
        }
      }

      const paddedNumber = String(nextNumber).padStart(3, '0');
      const nextDocCode = `${prefix}${paddedNumber}`;

      return { 
        success: true, 
        next_code: nextDocCode,
        prefix_used: prefix,
        sequence_number: nextNumber
      };
    } catch (error) {
      console.error('Error generating next document code:', error);
      throw error;
    }
  },

  async createDocument(docData, userId) {
    const { doc_code, doc_name, doc_type, section_id, erp_link_module } = docData;

    const template = getTemplateForType(doc_type);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      const docRes = await client.query(`
        INSERT INTO qms_documents (doc_code, doc_name, doc_type, section_id, erp_link_module, status)
        VALUES ($1, $2, $3, $4, $5, 'PLANNED') RETURNING doc_id
      `, [doc_code, doc_name, doc_type, section_id, erp_link_module]);
      
      const newDocId = docRes.rows[0].doc_id;

      await client.query('COMMIT');
      return { doc_id: newDocId };
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  },

  // ============================================================================
  // UPDATE DOCUMENT METADATA
  // ============================================================================
  async updateDocumentMetadata(docId, updateData) {
    const { doc_code, doc_name, doc_type, section_id, erp_link_module } = updateData;
    
    try {
      // Clean, simple SQL update for document metadata
      const query = `
        UPDATE qms_documents 
        SET 
          doc_code = $1, 
          doc_name = $2, 
          doc_type = $3, 
          section_id = $4, 
          erp_link_module = $5
        WHERE doc_id = $6
        RETURNING *
      `;
      
      const result = await pool.query(query, [
        doc_code, 
        doc_name, 
        doc_type, 
        section_id, 
        erp_link_module || null, 
        docId
      ]);
      
      if (result.rows.length === 0) throw new Error('Document not found');
      
      return result.rows[0];
    } catch (error) {
      console.error('Error updating document metadata:', error);
      throw error;
    }
  },

  async createDraft(docId, userId) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const docRes = await client.query('SELECT doc_type, status, current_version_id FROM qms_documents WHERE doc_id = $1', [docId]);
      if (docRes.rows.length === 0) throw new Error('Document not found');
      
      const doc = docRes.rows[0];
      let newVersionNumber = '0.1';
      let previousContent = {};

      if (doc.status === 'RELEASED' && doc.current_version_id) {
        const prevVerRes = await client.query('SELECT version_number, content_data FROM qms_document_versions WHERE version_id = $1', [doc.current_version_id]);
        if (prevVerRes.rows.length > 0) {
          const currentVer = parseFloat(prevVerRes.rows[0].version_number);
          newVersionNumber = (currentVer + 1.0).toFixed(1); 
          previousContent = prevVerRes.rows[0].content_data;
        }
      } else if (doc.status === 'PLANNED') {
        if (doc.doc_type !== 'SOP') {
          previousContent = { html_content: getTemplateForType(doc.doc_type) };
        }
      } else {
         throw new Error(`Cannot create draft. Document is currently in ${doc.status} status.`);
      }

      const insertVerQuery = `
        INSERT INTO qms_document_versions (doc_id, version_number, content_data, authored_by, status)
        VALUES ($1, $2, $3, $4, 'DRAFT')
        RETURNING version_id
      `;
      const newVerRes = await client.query(insertVerQuery, [docId, newVersionNumber, previousContent, userId]);

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

  async releaseDocument(versionId, approverId, signaturePassword) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const userRes = await client.query('SELECT password_hash FROM users WHERE user_id = $1', [approverId]);
      const valid = await bcrypt.compare(signaturePassword, userRes.rows[0].password_hash);
      if (!valid) throw new Error('Invalid digital signature password');

      const verRes = await client.query('SELECT doc_id, version_number FROM qms_document_versions WHERE version_id = $1', [versionId]);
      if (verRes.rows.length === 0) throw new Error('Version not found');
      const docId = verRes.rows[0].doc_id;
      const draftVer = verRes.rows[0].version_number;

      const releaseVersion = draftVer === '0.1' ? '1.0' : draftVer; 

      await client.query(`
        UPDATE qms_document_versions 
        SET status = 'SUPERSEDED' 
        WHERE doc_id = $1 AND status = 'RELEASED'
      `, [docId]);

      await client.query(`
        UPDATE qms_document_versions 
        SET status = 'RELEASED', 
            version_number = $1,
            approved_by = $2, 
            effective_date = CURRENT_TIMESTAMP, 
            review_due_date = CURRENT_TIMESTAMP + INTERVAL '1 year'
        WHERE version_id = $3
      `, [releaseVersion, approverId, versionId]);

      await client.query(`
        UPDATE qms_documents 
        SET status = 'RELEASED', current_version_id = $1 
        WHERE doc_id = $2
      `, [versionId, docId]);

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

  async createAudit(auditData) {
    const { audit_type, audit_date, lead_auditor, scope, next_audit_date, invited_members } = auditData;
    
    const safeNextDate = next_audit_date === '' ? null : next_audit_date;
    const safeInvites = Array.isArray(invited_members) ? invited_members : [];

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

    if (safeInvites.length > 0) {
      try {
        const notificationService = require('./notification-service');
        const leadRes = await pool.query('SELECT full_name FROM users WHERE user_id = $1', [lead_auditor]);
        const leadName = leadRes.rows[0]?.full_name || 'QA Team';
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

  async getTrainingMatrix() {
    const usersRes = await pool.query(`SELECT user_id, full_name, role FROM users WHERE is_active = true ORDER BY full_name`);
    const docsRes = await pool.query(`
      SELECT doc_id, doc_code, doc_name, current_version_id 
      FROM qms_documents 
      WHERE status = 'RELEASED' AND doc_type IN ('SOP', 'POL', 'MAN') 
      ORDER BY doc_code
    `);
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
    await this.verifySignature(userId, signaturePassword);

    const docRes = await pool.query(`SELECT current_version_id FROM qms_documents WHERE doc_id = $1 AND status = 'RELEASED'`, [docId]);
    if (docRes.rows.length === 0) throw new Error('Document is not in RELEASED status or does not exist.');

    const versionId = docRes.rows[0].current_version_id;

    const query = `
      INSERT INTO qms_training_records (user_id, doc_id, version_id, acknowledged_at)
      VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
      ON CONFLICT (user_id, doc_id, version_id) DO NOTHING
      RETURNING *
    `;
    await pool.query(query, [userId, docId, versionId]);
    
    return { success: true, message: 'Document successfully acknowledged.' };
  },

  async listSections() {
    const result = await pool.query('SELECT * FROM qms_sections ORDER BY sort_order');
    return result.rows;
  }
};

module.exports = QmsService;