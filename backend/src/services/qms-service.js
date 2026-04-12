// ============================================================================
// VILAGIO ERP — QMS DOCUMENT SERVICE (PHASE 1, 2 & 3 MERGED)
// ============================================================================

const { pool } = require('./auth-service'); // Adjust path to database config if needed
const bcrypt = require('bcrypt');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

// ── Content strategy per doc type ───────────────────────────────────────────
// Override at the version level; these are the DEFAULTS used on createDraft.

const CONTENT_STRATEGY_MAP = {
  SOP: 'structured',
  POL: 'structured',
  MAN: 'structured',
  FRM: 'upload',
  CHK: 'upload',
  LOG: 'upload',
  REG: 'upload',
};

// Section schemas for the structured editor (one per doc type)
const SECTION_SCHEMAS = {
  SOP: [
    { id: 'purpose',        title: '1. Purpose',                         desc: 'What this SOP governs and why it exists.' },
    { id: 'scope',          title: '2. Scope',                           desc: 'Who and what this applies to. Explicit exclusions noted.' },
    { id: 'definitions',    title: '3. Definitions',                     desc: 'Key specialist terms used in this document.' },
    { id: 'responsibilities',title: '4. Responsibilities',               desc: 'Role | Responsibility mapping.' },
    { id: 'materials',      title: '5. Required Materials / Equipment',  desc: 'Tools, chemicals, PPE, equipment needed.' },
    { id: 'procedure',      title: '6. Procedure / Instructions',        desc: 'Numbered steps. Mark critical control points.' },
    { id: 'criteria',       title: '7. Acceptance Criteria / Limits',    desc: 'Quantitative pass/fail criteria.' },
    { id: 'records',        title: '8. Records Required',                desc: 'Which forms, logs, or registers must be completed.' },
    { id: 'related',        title: '9. Related Documents',               desc: 'Codes of linked documents.' },
  ],
  POL: [
    { id: 'purpose',        title: '1. Purpose & Objective',             desc: 'State the high-level intent of this policy.' },
    { id: 'scope',          title: '2. Scope',                           desc: 'Who and what this policy applies to.' },
    { id: 'statement',      title: '3. Policy Statement',                desc: 'Core rules, directives, and commitments.' },
    { id: 'responsibilities',title: '4. Responsibilities',               desc: 'Departments/roles responsible for enforcing this policy.' },
    { id: 'exceptions',     title: '5. Exceptions',                      desc: 'Specific scenarios where this policy does not apply.' },
    { id: 'review',         title: '6. Review & Revision History',       desc: 'Review cycle and summary of changes.' },
  ],
  MAN: [
    { id: 'introduction',   title: '1. Introduction & Company Profile',  desc: 'Overview of VTL operations.' },
    { id: 'quality_policy', title: '2. Quality Policy',                  desc: 'Formal commitment to quality standards.' },
    { id: 'scope',          title: '3. Scope of the QMS',                desc: 'Boundaries and applicability.' },
    { id: 'structure',      title: '4. Organisational Structure',        desc: 'Leadership and departmental breakdown.' },
    { id: 'elements',       title: '5. System Elements',                 desc: 'Map to ISO 9001 clauses.' },
    { id: 'processes',      title: '6. Process Interactions',            desc: 'How processes interact and support each other.' },
  ],
};

// ── Audit trail helper ───────────────────────────────────────────────────────

async function writeAuditTrail(client, { doc_id, version_id, actor_id, action, from_status, to_status, notes, ip_address }) {
  await client.query(`
    INSERT INTO qms_audit_trail (doc_id, version_id, actor_id, action, from_status, to_status, notes, ip_address)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
  `, [doc_id, version_id || null, actor_id || null, action, from_status || null, to_status || null, notes || null, ip_address || null]);
}

// ── Role → doc_type training assignment logic ────────────────────────────────
// Called inside releaseDocument() after the document is released.
async function createTrainingTasksForRelease(client, docId, versionId, docType) {
  // Get all roles that need training on this doc type
  const reqRes = await client.query(
    `SELECT role FROM qms_training_requirements WHERE doc_type = $1`,
    [docType]
  );
  if (reqRes.rows.length === 0) return 0;

  const roles = reqRes.rows.map(r => r.role);

  // Get all active users matching those roles who haven't already acknowledged this specific version
  const usersRes = await client.query(`
    SELECT u.user_id
    FROM users u
    WHERE u.is_active = true
      AND u.role = ANY($1)
      AND NOT EXISTS (
        SELECT 1 FROM qms_training_records tr
        WHERE tr.user_id   = u.user_id
          AND tr.version_id = $2
      )
  `, [roles, versionId]);

  if (usersRes.rows.length === 0) return 0;

  // Bulk insert training tasks (ON CONFLICT DO NOTHING = safe to re-run)
  for (const { user_id } of usersRes.rows) {
    await client.query(`
      INSERT INTO qms_training_tasks (doc_id, version_id, user_id, status)
      VALUES ($1, $2, $3, 'PENDING')
      ON CONFLICT (version_id, user_id) DO NOTHING
    `, [docId, versionId, user_id]);
  }

  return usersRes.rows.length;
}

// ── File storage helpers ─────────────────────────────────────────────────────

const UPLOAD_DIR = process.env.QMS_UPLOAD_DIR || path.join(__dirname, '../../uploads/qms');

function ensureUploadDir() {
  if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

function buildFilePath(docId, versionId, originalName) {
  ensureUploadDir();
  const ext = path.extname(originalName) || '';
  return path.join(UPLOAD_DIR, `${docId}_${versionId}${ext}`);
}

// ── Legacy HTML template (kept for backward-compat richtext init) ────────────

function getLegacyHtmlTemplate(doc_type) {
  switch (doc_type) {
    case 'POL': return `<h2>1. Purpose & Objective</h2><p>State intent.</p><h2>2. Scope</h2><p>Define applicability.</p><h2>3. Policy Statement</h2><p>Core rules.</p>`;
    case 'MAN': return `<h1>QUALITY SYSTEM MANUAL</h1><h2>1. Introduction</h2><p>Overview.</p><h2>2. Quality Policy</h2><p>Commitment.</p>`;
    case 'FRM': return `<table border="1" style="width:100%;border-collapse:collapse;"><tr><td><strong>Date:</strong></td><td></td><td><strong>Department:</strong></td><td></td></tr><tr><td colspan="4"><strong>Details:</strong><br><br></td></tr></table>`;
    case 'CHK': return `<table border="1" style="width:100%;border-collapse:collapse;"><tr><th>Step</th><th>Task</th><th>Pass</th><th>Fail</th><th>N/A</th><th>Remarks</th></tr><tr><td>1</td><td></td><td>[ ]</td><td>[ ]</td><td>[ ]</td><td></td></tr></table>`;
    case 'LOG': return `<table border="1" style="width:100%;border-collapse:collapse;"><tr><th>Date/Time</th><th>Parameter</th><th>Value</th><th>Operator</th><th>Verifier</th><th>Comments</th></tr><tr><td></td><td></td><td></td><td></td><td></td><td></td></tr></table>`;
    case 'REG': return `<table border="1" style="width:100%;border-collapse:collapse;"><tr><th>Reference ID</th><th>Date Logged</th><th>Description</th><th>Status</th><th>Owner</th></tr><tr><td></td><td></td><td></td><td></td><td></td></tr></table>`;
    default:    return `<p>Start documenting here...</p>`;
  }
}

// ============================================================================
// SERVICE OBJECT
// ============================================================================

const QmsService = {

  // -- Schema helpers exposed to frontend ------------------------------------

  getSectionSchema(doc_type) {
    return SECTION_SCHEMAS[doc_type] || SECTION_SCHEMAS['SOP'];
  },

  getDefaultStrategy(doc_type) {
    return CONTENT_STRATEGY_MAP[doc_type] || 'structured';
  },

  // -- Stats -----------------------------------------------------------------

  async getCompletionStats() {
    const query = `
      SELECT 
        s.section_id, s.section_code, s.section_name, s.color_code, s.sort_order,
        COUNT(d.doc_id)                                                  AS total_docs,
        COUNT(d.doc_id) FILTER (WHERE d.status = 'RELEASED')            AS released_docs,
        COUNT(d.doc_id) FILTER (WHERE d.status = 'APPROVED')            AS approved_docs,
        COUNT(d.doc_id) FILTER (WHERE d.status = 'REVIEW')              AS review_docs,
        COUNT(d.doc_id) FILTER (WHERE d.status = 'DRAFT')               AS draft_docs
      FROM qms_sections s
      LEFT JOIN qms_documents d ON s.section_id = d.section_id AND d.status != 'WITHDRAWN'
      GROUP BY s.section_id
      ORDER BY s.sort_order ASC
    `;
    const result = await pool.query(query);
    let totalDocs = 0, totalReleased = 0;
    const sections = result.rows.map(row => {
      const total = parseInt(row.total_docs);
      const released = parseInt(row.released_docs);
      totalDocs += total;
      totalReleased += released;
      return { ...row, completion_percentage: total > 0 ? Math.round((released / total) * 100) : 0 };
    });
    return {
      overall_completion: totalDocs > 0 ? Math.round((totalReleased / totalDocs) * 100) : 0,
      total_documents: totalDocs,
      total_released: totalReleased,
      sections
    };
  },

  // -- Document list ---------------------------------------------------------

  async listDocuments(filters = {}) {
    let query = `
      SELECT 
        d.doc_id, d.doc_code, d.doc_name, d.doc_type, d.status, d.erp_link_module,
        d.section_id, s.section_code, s.section_name, s.color_code,
        v.version_number, v.effective_date, v.review_due_date,
        v.content_strategy,
        u.full_name AS author_name,
        owner.full_name AS owner_name
      FROM qms_documents d
      JOIN qms_sections s ON d.section_id = s.section_id
      LEFT JOIN qms_document_versions v ON d.current_version_id = v.version_id
      LEFT JOIN users u ON v.authored_by = u.user_id
      LEFT JOIN users owner ON d.doc_owner = owner.user_id
      WHERE d.status != 'WITHDRAWN'
    `;
    const params = [];
    let p = 1;
    if (filters.section_id) { query += ` AND d.section_id = $${p++}`; params.push(filters.section_id); }
    if (filters.status)     { query += ` AND d.status = $${p++}`;     params.push(filters.status); }
    query += ` ORDER BY s.sort_order ASC, d.doc_code ASC`;
    const result = await pool.query(query, params);
    return result.rows;
  },

  // -- Document detail -------------------------------------------------------

  async getDocumentById(docId) {
    const docRes = await pool.query(`
      SELECT d.*, s.section_name, s.section_code,
             owner.full_name AS owner_name
      FROM qms_documents d
      JOIN qms_sections s ON d.section_id = s.section_id
      LEFT JOIN users owner ON d.doc_owner = owner.user_id
      WHERE d.doc_id = $1
    `, [docId]);
    if (docRes.rows.length === 0) throw new Error('Document not found');

    const versionsRes = await pool.query(`
      SELECT v.*,
             a.full_name  AS author_name,
             rv.full_name AS reviewer_name,
             ap.full_name AS approver_name
      FROM qms_document_versions v
      LEFT JOIN users a  ON v.authored_by  = a.user_id
      LEFT JOIN users rv ON v.reviewer_id  = rv.user_id
      LEFT JOIN users ap ON v.approved_by  = ap.user_id
      WHERE v.doc_id = $1
      ORDER BY v.created_at DESC
    `, [docId]);

    // Linked documents
    const linksRes = await pool.query(`
      SELECT l.link_id, l.relationship,
             d.doc_id, d.doc_code, d.doc_name, d.doc_type, d.status
      FROM qms_document_links l
      JOIN qms_documents d ON l.child_doc_id = d.doc_id
      WHERE l.parent_doc_id = $1
      UNION ALL
      SELECT l.link_id, 'referenced_by' AS relationship,
             d.doc_id, d.doc_code, d.doc_name, d.doc_type, d.status
      FROM qms_document_links l
      JOIN qms_documents d ON l.parent_doc_id = d.doc_id
      WHERE l.child_doc_id = $1
    `, [docId]);

    return {
      ...docRes.rows[0],
      versions: versionsRes.rows,
      linked_documents: linksRes.rows,
    };
  },

  // -- Auto-sequencer --------------------------------------------------------

  async getNextDocumentCode(sectionId, docType) {
    const sectionRes = await pool.query('SELECT section_code FROM qms_sections WHERE section_id = $1', [sectionId]);
    if (sectionRes.rows.length === 0) throw new Error('Section not found');
    const sectionCode = sectionRes.rows[0].section_code;
    const prefix = `QA-${sectionCode}-${docType}-`;
    const result = await pool.query(
      `SELECT doc_code FROM qms_documents WHERE doc_code LIKE $1 ORDER BY doc_code DESC LIMIT 1`,
      [`${prefix}%`]
    );
    let nextNumber = 1;
    if (result.rows.length > 0) {
      const parts = result.rows[0].doc_code.split('-');
      const n = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(n)) nextNumber = n + 1;
    }
    return {
      success: true,
      next_code: `${prefix}${String(nextNumber).padStart(3, '0')}`,
      prefix_used: prefix,
      sequence_number: nextNumber
    };
  },

  // -- Create document record ------------------------------------------------

  async createDocument(docData, userId) {
    const { doc_code, doc_name, doc_type, section_id, erp_link_module, doc_owner } = docData;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const docRes = await client.query(`
        INSERT INTO qms_documents (doc_code, doc_name, doc_type, section_id, erp_link_module, doc_owner, status)
        VALUES ($1, $2, $3, $4, $5, $6, 'PLANNED') RETURNING doc_id
      `, [doc_code, doc_name, doc_type, section_id, erp_link_module || null, doc_owner || null]);
      const newDocId = docRes.rows[0].doc_id;

      await writeAuditTrail(client, {
        doc_id: newDocId, actor_id: userId,
        action: 'PLANNED', to_status: 'PLANNED',
        notes: `Document planned: ${doc_code}`
      });

      await client.query('COMMIT');
      return { doc_id: newDocId };
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  },

  // -- Update document metadata ----------------------------------------------

  async updateDocumentMetadata(docId, updateData, userId) {
    const { doc_code, doc_name, doc_type, section_id, erp_link_module, doc_owner } = updateData;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query(`
        UPDATE qms_documents 
        SET doc_code = $1, doc_name = $2, doc_type = $3, section_id = $4,
            erp_link_module = $5, doc_owner = $6
        WHERE doc_id = $7 RETURNING *
      `, [doc_code, doc_name, doc_type, section_id, erp_link_module || null, doc_owner || null, docId]);
      if (result.rows.length === 0) throw new Error('Document not found');

      await writeAuditTrail(client, {
        doc_id: docId, actor_id: userId,
        action: 'METADATA_UPDATED',
        notes: `Metadata updated: code=${doc_code}, type=${doc_type}`
      });

      await client.query('COMMIT');
      return result.rows[0];
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  },

  // -- Create draft ----------------------------------------------------------

  async createDraft(docId, userId, changeReason) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const docRes = await client.query(
        'SELECT doc_type, status, current_version_id FROM qms_documents WHERE doc_id = $1', [docId]
      );
      if (docRes.rows.length === 0) throw new Error('Document not found');
      const doc = docRes.rows[0];

      // Enforce change_reason on revisions of released docs
      if (doc.status === 'RELEASED' && !changeReason?.trim()) {
        throw new Error('A change reason is required when revising a released document.');
      }

      let newVersionNumber = '0.1';
      let previousContent = {};
      const defaultStrategy = CONTENT_STRATEGY_MAP[doc.doc_type] || 'structured';

      if (doc.status === 'RELEASED' && doc.current_version_id) {
        const prevRes = await client.query(
          'SELECT version_number, content_data FROM qms_document_versions WHERE version_id = $1',
          [doc.current_version_id]
        );
        if (prevRes.rows.length > 0) {
          const currentVer = parseFloat(prevRes.rows[0].version_number);
          newVersionNumber = (currentVer + 1.0).toFixed(1);
          // Carry forward content only for structured docs; upload docs start fresh
          if (defaultStrategy === 'structured' || defaultStrategy === 'richtext') {
            previousContent = prevRes.rows[0].content_data || {};
          }
        }
      } else if (doc.status === 'PLANNED') {
        // Pre-populate richtext types with HTML template for convenience
        if (defaultStrategy === 'richtext') {
          previousContent = { html_content: getLegacyHtmlTemplate(doc.doc_type) };
        }
        // structured docs start blank; upload docs start blank
      } else {
        throw new Error(`Cannot create draft. Document is currently in "${doc.status}" status.`);
      }

      const verRes = await client.query(`
        INSERT INTO qms_document_versions
          (doc_id, version_number, content_data, authored_by, status, content_strategy, change_reason)
        VALUES ($1, $2, $3, $4, 'DRAFT', $5, $6)
        RETURNING version_id
      `, [docId, newVersionNumber, previousContent, userId, defaultStrategy, changeReason || null]);

      const newVersionId = verRes.rows[0].version_id;

      await client.query(`UPDATE qms_documents SET status = 'DRAFT' WHERE doc_id = $1`, [docId]);

      await writeAuditTrail(client, {
        doc_id: docId, version_id: newVersionId, actor_id: userId,
        action: 'DRAFT_CREATED',
        from_status: doc.status, to_status: 'DRAFT',
        notes: changeReason || 'Initial draft'
      });

      await client.query('COMMIT');
      return { success: true, version_id: newVersionId, version_number: newVersionNumber, content_strategy: defaultStrategy };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },

  // -- Save draft content (structured / richtext) ----------------------------

  async updateDraft(versionId, contentData, userId) {
    const result = await pool.query(`
      UPDATE qms_document_versions 
      SET content_data = $1, updated_at = CURRENT_TIMESTAMP
      WHERE version_id = $2 AND status = 'DRAFT' AND authored_by = $3
      RETURNING *
    `, [contentData, versionId, userId]);
    if (result.rows.length === 0) throw new Error('Draft not found or you are not the author');

    // Write a lightweight SAVED trail entry
    await pool.query(`
      INSERT INTO qms_audit_trail (doc_id, version_id, actor_id, action, notes)
      SELECT doc_id, version_id, $1, 'SAVED', 'Content saved'
      FROM qms_document_versions WHERE version_id = $2
    `, [userId, versionId]);

    return result.rows[0];
  },

  // -- Upload file (for FRM, CHK, LOG, REG) ----------------------------------

  async uploadVersionFile(versionId, fileBuffer, originalName, userId) {
    const verRes = await pool.query(
      'SELECT doc_id, status, authored_by FROM qms_document_versions WHERE version_id = $1',
      [versionId]
    );
    if (verRes.rows.length === 0) throw new Error('Version not found');
    const ver = verRes.rows[0];
    if (ver.status !== 'DRAFT') throw new Error('File can only be uploaded to a DRAFT version');
    if (ver.authored_by !== userId) throw new Error('Only the author can upload files');

    const filePath = buildFilePath(ver.doc_id, versionId, originalName);
    fs.writeFileSync(filePath, fileBuffer);

    await pool.query(`
      UPDATE qms_document_versions
      SET file_path = $1, file_original_name = $2, content_strategy = 'upload',
          updated_at = CURRENT_TIMESTAMP
      WHERE version_id = $3
    `, [filePath, originalName, versionId]);

    await pool.query(`
      INSERT INTO qms_audit_trail (doc_id, version_id, actor_id, action, notes)
      VALUES ($1, $2, $3, 'FILE_UPLOADED', $4)
    `, [ver.doc_id, versionId, userId, `Uploaded: ${originalName}`]);

    return { success: true, file_original_name: originalName };
  },

  // -- Get file for download -------------------------------------------------

  async getVersionFile(versionId) {
    const result = await pool.query(
      'SELECT file_path, file_original_name FROM qms_document_versions WHERE version_id = $1',
      [versionId]
    );
    if (result.rows.length === 0) throw new Error('Version not found');
    const { file_path, file_original_name } = result.rows[0];
    if (!file_path) throw new Error('No file uploaded for this version');
    if (!fs.existsSync(file_path)) throw new Error('File not found on server');
    return { filePath: file_path, originalName: file_original_name };
  },

  // -- Submit for review -----------------------------------------------------

  async submitForReview(versionId, reviewerId, userId) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const updateVer = await client.query(`
        UPDATE qms_document_versions 
        SET status = 'REVIEW', reviewer_id = $1
        WHERE version_id = $2
        RETURNING doc_id, authored_by, version_number
      `, [reviewerId || null, versionId]);
      if (updateVer.rows.length === 0) throw new Error('Version not found');

      const { doc_id, authored_by, version_number } = updateVer.rows[0];

      const docRes = await client.query(
        `UPDATE qms_documents SET status = 'REVIEW' WHERE doc_id = $1 RETURNING doc_code, doc_name`,
        [doc_id]
      );

      await writeAuditTrail(client, {
        doc_id, version_id: versionId, actor_id: userId,
        action: 'SUBMITTED',
        from_status: 'DRAFT', to_status: 'REVIEW',
        notes: reviewerId ? `Assigned to reviewer ${reviewerId}` : 'Broadcast to QA role'
      });

      // Notification logic
      try {
        const notificationService = require('./notification-service');
        const authorRes = await client.query('SELECT full_name FROM users WHERE user_id = $1', [authored_by]);
        const authorName = authorRes.rows[0]?.full_name || 'System User';
        const { doc_code, doc_name } = docRes.rows[0];

        if (reviewerId) {
          const reviewerRes = await client.query('SELECT email FROM users WHERE user_id = $1', [reviewerId]);
          const reviewerEmail = reviewerRes.rows[0]?.email;
          if (reviewerEmail && notificationService.notifyQADocumentReview) {
            notificationService.notifyQADocumentReview(doc_code, doc_name, version_number, authorName)
              .catch(e => console.error('QMS review email failed:', e));
          }
        } else if (notificationService.notifyQADocumentReview) {
          notificationService.notifyQADocumentReview(doc_code, doc_name, version_number, authorName)
            .catch(e => console.error('QMS review email failed:', e));
        }
      } catch (e) {
        console.error('Failed to trigger QMS review email:', e);
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

  // -- Release document ------------------------------------------------------

  async releaseDocument(versionId, approverId, signaturePassword, ipAddress) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Verify digital signature
      const userRes = await client.query(
        'SELECT password_hash FROM users WHERE user_id = $1', [approverId]
      );
      const valid = await bcrypt.compare(signaturePassword, userRes.rows[0].password_hash);
      if (!valid) throw new Error('Invalid digital signature password');

      const verRes = await client.query(
        'SELECT doc_id, version_number FROM qms_document_versions WHERE version_id = $1',
        [versionId]
      );
      if (verRes.rows.length === 0) throw new Error('Version not found');
      const { doc_id, version_number } = verRes.rows[0];

      // Get doc type for training assignment
      const docRes = await client.query(
        'SELECT doc_type FROM qms_documents WHERE doc_id = $1', [doc_id]
      );
      const docType = docRes.rows[0].doc_type;

      const releaseVersion = version_number === '0.1' ? '1.0' : version_number;

      // Supersede previous released version
      await client.query(`
        UPDATE qms_document_versions SET status = 'SUPERSEDED'
        WHERE doc_id = $1 AND status = 'RELEASED'
      `, [doc_id]);

      // Release this version
      await client.query(`
        UPDATE qms_document_versions
        SET status = 'RELEASED',
            version_number = $1,
            approved_by = $2,
            effective_date = CURRENT_TIMESTAMP,
            review_due_date = CURRENT_TIMESTAMP + INTERVAL '1 year'
        WHERE version_id = $3
      `, [releaseVersion, approverId, versionId]);

      // Update document master record
      await client.query(`
        UPDATE qms_documents SET status = 'RELEASED', current_version_id = $1
        WHERE doc_id = $2
      `, [versionId, doc_id]);

      // Record approval
      await client.query(`
        INSERT INTO qms_approvals (version_id, approver_id, role, status, action_at)
        VALUES ($1, $2, 'QA_MANAGER', 'APPROVED', CURRENT_TIMESTAMP)
      `, [versionId, approverId]);

      // Write audit trail
      await client.query(`
        INSERT INTO qms_audit_trail (doc_id, version_id, actor_id, action, from_status, to_status, notes, ip_address)
        VALUES ($1, $2, $3, 'RELEASED', 'REVIEW', 'RELEASED', $4, $5)
      `, [doc_id, versionId, approverId, `Released as Version ${releaseVersion} (e-signature verified)`, ipAddress || null]);

      // Close any open review task for this document (it's been reviewed & re-released)
      await client.query(`
        UPDATE qms_review_tasks SET status = 'COMPLETED', updated_at = CURRENT_TIMESTAMP
        WHERE doc_id = $1 AND status = 'OPEN'
      `, [doc_id]);

      // Auto-assign training tasks
      const taskCount = await createTrainingTasksForRelease(client, doc_id, versionId, docType);

      await client.query('COMMIT');

      // Notifications (outside transaction)
      if (taskCount > 0) {
        try {
          const notificationService = require('./notification-service');
          const docInfoRes = await pool.query(
            'SELECT doc_code, doc_name FROM qms_documents WHERE doc_id = $1', [doc_id]
          );
          const { doc_code, doc_name } = docInfoRes.rows[0];

          // Get emails of all users with PENDING tasks for this version
          const pendingUsersRes = await pool.query(`
            SELECT u.email, u.full_name
            FROM qms_training_tasks tt
            JOIN users u ON tt.user_id = u.user_id
            WHERE tt.version_id = $1 AND tt.status = 'PENDING'
          `, [versionId]);

          for (const user of pendingUsersRes.rows) {
            notificationService.notifyTrainingRequired(
              doc_code, doc_name, releaseVersion, user.full_name, user.email
            ).catch(e => console.error(`Training notification failed for ${user.email}:`, e));
          }
        } catch (e) {
          console.error('Failed to send training notifications:', e);
        }
      }

      return {
        success: true,
        message: `Document released as Version ${releaseVersion}`,
        training_tasks_created: taskCount
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },

  // -- Withdraw document -----------------------------------------------------

  async withdrawDocument(docId, userId, signaturePassword, withdrawReason, ipAddress) {
    if (!withdrawReason?.trim()) throw new Error('A withdrawal reason is required.');

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const userRes = await client.query('SELECT password_hash FROM users WHERE user_id = $1', [userId]);
      const valid = await bcrypt.compare(signaturePassword, userRes.rows[0].password_hash);
      if (!valid) throw new Error('Invalid digital signature password');

      const docRes = await client.query('SELECT status FROM qms_documents WHERE doc_id = $1', [docId]);
      if (docRes.rows.length === 0) throw new Error('Document not found');
      const prevStatus = docRes.rows[0].status;

      await client.query(`
        UPDATE qms_documents
        SET status = 'WITHDRAWN', withdrawn_at = CURRENT_TIMESTAMP,
            withdrawn_by = $1, withdraw_reason = $2
        WHERE doc_id = $3
      `, [userId, withdrawReason, docId]);

      await writeAuditTrail(client, {
        doc_id: docId, actor_id: userId,
        action: 'WITHDRAWN',
        from_status: prevStatus, to_status: 'WITHDRAWN',
        notes: `Reason: ${withdrawReason}`,
        ip_address: ipAddress
      });

      await client.query('COMMIT');
      return { success: true, message: 'Document formally withdrawn.' };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },

  // -- Audit trail ----------------------------------------------------------

  async getAuditTrail(docId) {
    const result = await pool.query(`
      SELECT t.*,
             u.full_name AS actor_name,
             u.role      AS actor_role
      FROM qms_audit_trail t
      LEFT JOIN users u ON t.actor_id = u.user_id
      WHERE t.doc_id = $1
      ORDER BY t.created_at ASC
    `, [docId]);
    return result.rows;
  },

  // -- Document links -------------------------------------------------------

  async addDocumentLink(parentDocId, childDocId, relationship, userId) {
    const valid = ['references', 'implements', 'spawned_from'];
    if (!valid.includes(relationship)) throw new Error(`Invalid relationship. Must be one of: ${valid.join(', ')}`);
    if (parentDocId === childDocId) throw new Error('A document cannot be linked to itself');

    const result = await pool.query(`
      INSERT INTO qms_document_links (parent_doc_id, child_doc_id, relationship, created_by)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (parent_doc_id, child_doc_id, relationship) DO NOTHING
      RETURNING *
    `, [parentDocId, childDocId, relationship, userId]);

    return result.rows[0] || { message: 'Link already exists' };
  },

  async removeDocumentLink(linkId) {
    await pool.query('DELETE FROM qms_document_links WHERE link_id = $1', [linkId]);
    return { success: true };
  },

  // -- Signature verification -----------------------------------------------

  async verifySignature(userId, password) {
    const userRes = await pool.query('SELECT password_hash FROM users WHERE user_id = $1', [userId]);
    const valid = await bcrypt.compare(password, userRes.rows[0].password_hash);
    if (!valid) throw new Error('Invalid digital signature password.');
  },

  // -- NCR, CAPA, Audit, Training methods -----------------------------------

  async createNCR(ncrData, userId, signaturePassword) {
    await this.verifySignature(userId, signaturePassword);
    const { source_module, source_id, description, severity, assigned_to } = ncrData;
    const date = new Date();
    const dateStr = `${date.getFullYear().toString().slice(-2)}${(date.getMonth() + 1).toString().padStart(2, '0')}`;
    const countRes = await pool.query(`SELECT COUNT(*) FROM qms_ncr WHERE ncr_code LIKE 'NCR-${dateStr}-%'`);
    const sequence = String(parseInt(countRes.rows[0].count) + 1).padStart(3, '0');
    const ncrCode = `NCR-${dateStr}-${sequence}`;
    const result = await pool.query(`
      INSERT INTO qms_ncr (ncr_code, source_module, source_id, description, severity, raised_by, assigned_to, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'OPEN') RETURNING *
    `, [ncrCode, source_module, source_id, description, severity, userId, assigned_to]);
    if (assigned_to) {
      try {
        const ns = require('./notification-service');
        const userRes = await pool.query('SELECT email FROM users WHERE user_id = $1', [assigned_to]);
        if (userRes.rows.length > 0) ns.notifyNCRAssigned(ncrCode, description, userRes.rows[0].email);
      } catch (e) { console.error('NCR email failed', e); }
    }
    return result.rows[0];
  },

  async listNCRs(filters = {}) {
    let query = `
      SELECT n.*, r.full_name AS raised_by_name, a.full_name AS assigned_to_name
      FROM qms_ncr n
      LEFT JOIN users r ON n.raised_by = r.user_id
      LEFT JOIN users a ON n.assigned_to = a.user_id
      WHERE 1=1
    `;
    const params = [];
    let p = 1;
    if (filters.status) { query += ` AND n.status = $${p++}`; params.push(filters.status); }
    query += ` ORDER BY n.created_at DESC`;
    const result = await pool.query(query, params);
    return result.rows;
  },

  async updateNCR(ncrId, updateData, userId, signaturePassword) {
    await this.verifySignature(userId, signaturePassword);
    const { status, root_cause, resolution, assigned_to } = updateData;
    const updates = [], values = [];
    let p = 1;
    if (status)      { updates.push(`status = $${p++}`);      values.push(status); }
    if (root_cause)  { updates.push(`root_cause = $${p++}`);  values.push(root_cause); }
    if (resolution)  { updates.push(`resolution = $${p++}`);  values.push(resolution); }
    if (assigned_to) { updates.push(`assigned_to = $${p++}`); values.push(assigned_to); }
    if (status === 'CLOSED') updates.push(`closed_at = CURRENT_TIMESTAMP`);
    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(ncrId);
    const result = await pool.query(
      `UPDATE qms_ncr SET ${updates.join(', ')} WHERE ncr_id = $${p} RETURNING *`, values
    );
    if (result.rows.length === 0) throw new Error('NCR not found');
    return result.rows[0];
  },

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
      const result = await client.query(`
        INSERT INTO qms_capa (capa_code, ncr_id, action_description, action_owner, due_date, status)
        VALUES ($1, $2, $3, $4, $5, 'OPEN') RETURNING *
      `, [capaCode, ncr_id, action_description, action_owner, due_date]);
      createdCapa = result.rows[0];
      const ncrRes = await client.query(
        `UPDATE qms_ncr SET status = 'CAPA_REQUIRED' WHERE ncr_id = $1 RETURNING ncr_code`, [ncr_id]
      );
      ncrCode = ncrRes.rows[0].ncr_code;
      await client.query('COMMIT');
    } catch (e) { await client.query('ROLLBACK'); throw e; }
    finally { client.release(); }
    if (action_owner) {
      try {
        const ns = require('./notification-service');
        const userRes = await pool.query('SELECT email FROM users WHERE user_id = $1', [action_owner]);
        if (userRes.rows.length > 0) ns.notifyCAPAAssigned(capaCode, ncrCode, action_description, due_date, userRes.rows[0].email);
      } catch (e) { console.error('CAPA email failed', e); }
    }
    return createdCapa;
  },

  async listCAPAs(filters = {}) {
    let query = `
      SELECT c.*, n.ncr_code, o.full_name AS owner_name, v.full_name AS verified_by_name
      FROM qms_capa c
      JOIN qms_ncr n ON c.ncr_id = n.ncr_id
      LEFT JOIN users o ON c.action_owner = o.user_id
      LEFT JOIN users v ON c.verified_by = v.user_id
      WHERE 1=1
    `;
    const params = [];
    let p = 1;
    if (filters.status) { query += ` AND c.status = $${p++}`; params.push(filters.status); }
    query += ` ORDER BY c.created_at DESC`;
    const result = await pool.query(query, params);
    return result.rows;
  },

  async updateCAPA(capaId, updateData, userId, signaturePassword) {
    await this.verifySignature(userId, signaturePassword);
    const { status, effectiveness_review } = updateData;
    const updates = [], values = [];
    let p = 1;
    if (status)               { updates.push(`status = $${p++}`);               values.push(status); }
    if (effectiveness_review) { updates.push(`effectiveness_review = $${p++}`); values.push(effectiveness_review); }
    if (status === 'VERIFIED' || status === 'CLOSED') {
      updates.push(`verified_by = $${p++}`); values.push(userId);
      updates.push(`verified_at = CURRENT_TIMESTAMP`);
    }
    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(capaId);
    const result = await pool.query(
      `UPDATE qms_capa SET ${updates.join(', ')} WHERE capa_id = $${p} RETURNING *`, values
    );
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
    const result = await pool.query(`
      INSERT INTO qms_audits (audit_code, audit_type, audit_date, lead_auditor, scope, next_audit_date, status, invited_members)
      VALUES ($1, $2, $3, $4, $5, $6, 'PLANNED', $7) RETURNING *
    `, [auditCode, audit_type, audit_date, lead_auditor, scope, safeNextDate, safeInvites]);
    if (safeInvites.length > 0) {
      try {
        const ns = require('./notification-service');
        const leadRes = await pool.query('SELECT full_name FROM users WHERE user_id = $1', [lead_auditor]);
        const leadName = leadRes.rows[0]?.full_name || 'QA Team';
        const emailRes = await pool.query('SELECT email FROM users WHERE user_id = ANY($1)', [safeInvites]);
        const emails = emailRes.rows.map(r => r.email);
        if (emails.length > 0) ns.notifyAuditInvite(auditCode, audit_type, audit_date, scope, leadName, emails);
      } catch (e) { console.error('Audit invite email failed:', e); }
    }
    return result.rows[0];
  },

  async listAudits() {
    const result = await pool.query(`
      SELECT a.*, u.full_name AS auditor_name
      FROM qms_audits a
      LEFT JOIN users u ON a.lead_auditor = u.user_id
      ORDER BY a.audit_date DESC
    `);
    return result.rows;
  },

  async updateAudit(auditId, updateData, userId, signaturePassword) {
    if (updateData.status === 'COMPLETED' && signaturePassword) {
      await this.verifySignature(userId, signaturePassword);
    }
    const { status, report_data, next_audit_date, lead_auditor, audit_date, scope, invited_members } = updateData;
    const updates = [], values = [];
    let p = 1;
    if (status)          { updates.push(`status = $${p++}`);       values.push(status); }
    if (report_data !== undefined) { updates.push(`report_data = $${p++}`); values.push(report_data); }
    if (lead_auditor)    { updates.push(`lead_auditor = $${p++}`); values.push(lead_auditor); }
    if (audit_date)      { updates.push(`audit_date = $${p++}`);   values.push(audit_date); }
    if (scope)           { updates.push(`scope = $${p++}`);        values.push(scope); }
    if (invited_members) { updates.push(`invited_members = $${p++}`); values.push(invited_members); }
    if (next_audit_date === '') { updates.push(`next_audit_date = NULL`); }
    else if (next_audit_date)  { updates.push(`next_audit_date = $${p++}`); values.push(next_audit_date); }
    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(auditId);
    const result = await pool.query(
      `UPDATE qms_audits SET ${updates.join(', ')} WHERE audit_id = $${p} RETURNING *`, values
    );
    if (result.rows.length === 0) throw new Error('Audit not found');
    return result.rows[0];
  },

  async acknowledgeDocument(userId, docId, signaturePassword) {
    // Verify signature
    const userRes = await pool.query(
      'SELECT password_hash FROM users WHERE user_id = $1', [userId]
    );
    const valid = await bcrypt.compare(signaturePassword, userRes.rows[0].password_hash);
    if (!valid) throw new Error('Invalid digital signature password.');
  
    const docRes = await pool.query(
      `SELECT current_version_id FROM qms_documents WHERE doc_id = $1 AND status = 'RELEASED'`,
      [docId]
    );
    if (docRes.rows.length === 0) throw new Error('Document is not released or does not exist.');
  
    const versionId = docRes.rows[0].current_version_id;
  
    // Insert training record (the unique constraint prevents duplicates)
    await pool.query(`
      INSERT INTO qms_training_records (user_id, doc_id, version_id, acknowledged_at)
      VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
      ON CONFLICT (user_id, doc_id, version_id) DO NOTHING
    `, [userId, docId, versionId]);
  
    // Mark the training task as completed
    await pool.query(`
      UPDATE qms_training_tasks
      SET status = 'COMPLETED', completed_at = CURRENT_TIMESTAMP
      WHERE user_id = $1 AND version_id = $2 AND status = 'PENDING'
    `, [userId, versionId]);
  
    return { success: true, message: 'Document successfully acknowledged.' };
  },

  async listSections() {
    const result = await pool.query('SELECT * FROM qms_sections ORDER BY sort_order');
    return result.rows;
  },

  async listUsers() {
    const result = await pool.query(
      `SELECT user_id, full_name, role, email FROM users WHERE is_active = true ORDER BY full_name`
    );
    return result.rows;
  },

  // ============================================================================
  // PHASE 2 NEW METHODS
  // ============================================================================

  // -- My Tasks (for QMS dashboard workbench) --------------------------------
  async getMyTasks(userId) {
    // 1. Documents I am the named reviewer on (status = REVIEW)
    const reviewerDocs = await pool.query(`
      SELECT 
        'review_assignment' AS task_type,
        d.doc_id, d.doc_code, d.doc_name, d.doc_type, d.status,
        v.version_id, v.version_number, v.change_reason,
        author.full_name AS author_name,
        v.updated_at     AS task_date
      FROM qms_document_versions v
      JOIN qms_documents d ON v.doc_id = d.doc_id
      JOIN users author ON v.authored_by = author.user_id
      WHERE v.reviewer_id = $1
        AND v.status = 'REVIEW'
      ORDER BY v.updated_at DESC
    `, [userId]);

    // 2. Periodic review tasks assigned to me (doc_owner)
    const reviewTasks = await pool.query(`
      SELECT
        'periodic_review' AS task_type,
        d.doc_id, d.doc_code, d.doc_name, d.doc_type, d.status,
        null::uuid AS version_id,
        v.version_number,
        null AS change_reason,
        null AS author_name,
        rt.due_date AS task_date
      FROM qms_review_tasks rt
      JOIN qms_documents d ON rt.doc_id = d.doc_id
      JOIN qms_document_versions v ON d.current_version_id = v.version_id
      WHERE rt.assigned_to = $1
        AND rt.status = 'OPEN'
      ORDER BY rt.due_date ASC
    `, [userId]);

    // 3. Pending training tasks
    const trainingTasks = await pool.query(`
      SELECT
        'training' AS task_type,
        d.doc_id, d.doc_code, d.doc_name, d.doc_type, d.status,
        tt.version_id, v.version_number,
        null AS change_reason,
        null AS author_name,
        tt.assigned_at AS task_date
      FROM qms_training_tasks tt
      JOIN qms_documents d  ON tt.doc_id    = d.doc_id
      JOIN qms_document_versions v ON tt.version_id = v.version_id
      WHERE tt.user_id = $1
        AND tt.status  = 'PENDING'
      ORDER BY tt.assigned_at DESC
    `, [userId]);

    return {
      review_assignments: reviewerDocs.rows,
      periodic_reviews:   reviewTasks.rows,
      training_pending:   trainingTasks.rows,
      total_open: reviewerDocs.rows.length + reviewTasks.rows.length + trainingTasks.rows.length
    };
  },

  // -- QMS dashboard stats (enhanced with task counts) ----------------------
  async getDashboardSummary() {
    const result = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM qms_documents WHERE status = 'RELEASED')                AS total_released,
        (SELECT COUNT(*) FROM qms_documents WHERE status = 'REVIEW')                  AS total_in_review,
        (SELECT COUNT(*) FROM qms_documents WHERE status = 'DRAFT')                   AS total_in_draft,
        (SELECT COUNT(*) FROM qms_documents WHERE status NOT IN ('WITHDRAWN','PLANNED')) AS total_active,
        (SELECT COUNT(*) FROM qms_review_tasks WHERE status = 'OPEN')                 AS review_tasks_open,
        (SELECT COUNT(*) FROM qms_review_tasks WHERE status = 'OPEN' AND due_date < NOW()) AS overdue_count,
        (SELECT COUNT(*) FROM qms_training_tasks WHERE status = 'PENDING')            AS training_pending,
        (SELECT COUNT(*) FROM qms_ncr WHERE status = 'OPEN')                          AS ncr_open,
        (SELECT COUNT(*) FROM qms_capa WHERE status = 'OPEN')                         AS capa_open
    `);
    return result.rows[0];
  },

  // -- Dismiss a periodic review task (snooze / not applicable) -------------
  async dismissReviewTask(taskId, userId) {
    const result = await pool.query(`
      UPDATE qms_review_tasks
      SET status = 'DISMISSED', updated_at = CURRENT_TIMESTAMP
      WHERE task_id = $1 RETURNING *
    `, [taskId]);
    if (result.rows.length === 0) throw new Error('Review task not found');
    return result.rows[0];
  },

  // -- Get all open review tasks (for QA manager view) ----------------------
  async listReviewTasks(filters = {}) {
    let query = `
      SELECT rt.*, d.doc_code, d.doc_name, d.doc_type,
             v.version_number, v.review_due_date,
             u.full_name AS owner_name
      FROM qms_review_tasks rt
      JOIN qms_documents d ON rt.doc_id = d.doc_id
      JOIN qms_document_versions v ON d.current_version_id = v.version_id
      LEFT JOIN users u ON rt.assigned_to = u.user_id
      WHERE 1=1
    `;
    const params = [];
    let p = 1;
    if (filters.status) { query += ` AND rt.status = $${p++}`; params.push(filters.status); }
    query += ` ORDER BY rt.due_date ASC`;
    const result = await pool.query(query, params);
    return result.rows;
  },

  // -- Get training matrix with task completion status ----------------------
  async getTrainingMatrix() {
    const usersRes = await pool.query(
      `SELECT user_id, full_name, role FROM users WHERE is_active = true ORDER BY full_name`
    );
    const docsRes = await pool.query(`
      SELECT doc_id, doc_code, doc_name, current_version_id
      FROM qms_documents
      WHERE status = 'RELEASED' AND doc_type IN ('SOP', 'POL', 'MAN')
      ORDER BY doc_code
    `);
    const recordsRes = await pool.query(
      `SELECT user_id, doc_id, version_id, acknowledged_at FROM qms_training_records`
    );
    // Include task status so UI can show PENDING vs not-yet-assigned
    const tasksRes = await pool.query(`
      SELECT user_id, doc_id, version_id, status AS task_status, assigned_at
      FROM qms_training_tasks
    `);

    return {
      users:    usersRes.rows,
      documents: docsRes.rows,
      records:  recordsRes.rows,
      tasks:    tasksRes.rows
    };
  },

  // ============================================================================
  // PHASE 3 NEW METHODS
  // ============================================================================

  // ── 3A — NCR / CAPA TRACEABILITY ──

  async linkVersionToNCR(versionId, ncrId, userId) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      await client.query(`
        UPDATE qms_document_versions
        SET triggered_by_ncr_id = $1
        WHERE version_id = $2 AND status = 'DRAFT'
      `, [ncrId, versionId]);

      await client.query(`
        UPDATE qms_ncr
        SET triggered_version_id = $1
        WHERE ncr_id = $2
      `, [versionId, ncrId]);

      await client.query(`
        INSERT INTO qms_audit_trail (doc_id, version_id, actor_id, action, notes)
        SELECT doc_id, version_id, $1, 'NCR_LINKED', $2
        FROM qms_document_versions WHERE version_id = $3
      `, [userId, `Linked to NCR ${ncrId}`, versionId]);

      await client.query('COMMIT');
      return { success: true };
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  },

  async linkVersionToCAPA(versionId, capaId, userId) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      await client.query(`
        UPDATE qms_document_versions
        SET triggered_by_capa_id = $1
        WHERE version_id = $2 AND status = 'DRAFT'
      `, [capaId, versionId]);

      await client.query(`
        INSERT INTO qms_audit_trail (doc_id, version_id, actor_id, action, notes)
        SELECT doc_id, version_id, $1, 'CAPA_LINKED', $2
        FROM qms_document_versions WHERE version_id = $3
      `, [userId, `Linked to CAPA ${capaId}`, versionId]);

      await client.query('COMMIT');
      return { success: true };
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  },

  async getOpenNCRs() {
    const result = await pool.query(`
      SELECT ncr_id, ncr_code, description, severity, status,
             u.full_name AS raised_by_name, created_at
      FROM qms_ncr n
      LEFT JOIN users u ON n.raised_by = u.user_id
      WHERE n.status IN ('OPEN', 'CAPA_REQUIRED')
      ORDER BY n.created_at DESC
    `);
    return result.rows;
  },

  async getOpenCAPAs() {
    const result = await pool.query(`
      SELECT c.capa_id, c.capa_code, c.action_description, c.status,
             n.ncr_code, u.full_name AS owner_name, c.due_date
      FROM qms_capa c
      JOIN qms_ncr n ON c.ncr_id = n.ncr_id
      LEFT JOIN users u ON c.action_owner = u.user_id
      WHERE c.status IN ('OPEN', 'IN_PROGRESS')
      ORDER BY c.due_date ASC
    `);
    return result.rows;
  },

  async getDocumentTraceability(docId) {
    const result = await pool.query(`
      SELECT
        v.version_id, v.version_number, v.status AS version_status,
        v.change_reason, v.created_at,
        author.full_name AS author_name,
        ncr.ncr_id, ncr.ncr_code, ncr.description AS ncr_description,
        ncr.severity AS ncr_severity, ncr.status AS ncr_status,
        capa.capa_id, capa.capa_code, capa.action_description AS capa_description,
        capa.status AS capa_status
      FROM qms_document_versions v
      LEFT JOIN users author ON v.authored_by = author.user_id
      LEFT JOIN qms_ncr  ncr  ON v.triggered_by_ncr_id  = ncr.ncr_id
      LEFT JOIN qms_capa capa ON v.triggered_by_capa_id = capa.capa_id
      WHERE v.doc_id = $1
      ORDER BY v.created_at ASC
    `, [docId]);
    return result.rows;
  },

  async getNCRDocumentImpact(ncrId) {
    const result = await pool.query(`
      SELECT
        v.version_id, v.version_number, v.status,
        d.doc_id, d.doc_code, d.doc_name, d.doc_type,
        author.full_name AS author_name,
        v.created_at
      FROM qms_document_versions v
      JOIN qms_documents d ON v.doc_id = d.doc_id
      LEFT JOIN users author ON v.authored_by = author.user_id
      WHERE v.triggered_by_ncr_id = $1
      ORDER BY v.created_at DESC
    `, [ncrId]);
    return result.rows;
  },

  // ── 3B — INSPECTOR VIEW ──

  async getInspectorPack(docId) {
    const docRes = await pool.query(`
      SELECT d.*,
             s.section_code, s.section_name, s.color_code,
             owner.full_name  AS owner_name,
             owner.job_title  AS owner_title,
             owner.department AS owner_dept
      FROM qms_documents d
      JOIN qms_sections s ON d.section_id = s.section_id
      LEFT JOIN users owner ON d.doc_owner = owner.user_id
      WHERE d.doc_id = $1
    `, [docId]);
    if (docRes.rows.length === 0) throw new Error('Document not found');

    const versionsRes = await pool.query(`
      SELECT v.*,
             author.full_name   AS author_name,
             author.job_title   AS author_title,
             reviewer.full_name AS reviewer_name,
             approver.full_name AS approver_name,
             approver.job_title AS approver_title,
             ncr.ncr_code, ncr.description AS ncr_description, ncr.severity AS ncr_severity,
             capa.capa_code, capa.action_description AS capa_description
      FROM qms_document_versions v
      LEFT JOIN users author   ON v.authored_by  = author.user_id
      LEFT JOIN users reviewer ON v.reviewer_id  = reviewer.user_id
      LEFT JOIN users approver ON v.approved_by  = approver.user_id
      LEFT JOIN qms_ncr  ncr   ON v.triggered_by_ncr_id  = ncr.ncr_id
      LEFT JOIN qms_capa capa  ON v.triggered_by_capa_id = capa.capa_id
      WHERE v.doc_id = $1
      ORDER BY v.created_at ASC
    `, [docId]);

    const approvalsRes = await pool.query(`
      SELECT a.*,
             u.full_name AS approver_name,
             u.job_title AS approver_title,
             u.role      AS approver_role
      FROM qms_approvals a
      JOIN qms_document_versions v ON a.version_id = v.version_id
      LEFT JOIN users u ON a.approver_id = u.user_id
      WHERE v.doc_id = $1
      ORDER BY a.action_at ASC
    `, [docId]);

    const trainingRes = await pool.query(`
      SELECT tr.*,
             u.full_name  AS user_name,
             u.job_title  AS user_title,
             u.department AS user_dept,
             u.role       AS user_role,
             v.version_number
      FROM qms_training_records tr
      JOIN users u ON tr.user_id = u.user_id
      JOIN qms_document_versions v ON tr.version_id = v.version_id
      WHERE tr.doc_id = $1
      ORDER BY v.version_number ASC, u.full_name ASC
    `, [docId]);

    const pendingRes = await pool.query(`
      SELECT tt.*,
             u.full_name  AS user_name,
             u.job_title  AS user_title,
             u.department AS user_dept,
             u.role       AS user_role,
             v.version_number
      FROM qms_training_tasks tt
      JOIN users u ON tt.user_id = u.user_id
      JOIN qms_document_versions v ON tt.version_id = v.version_id
      WHERE tt.doc_id = $1 AND tt.status = 'PENDING'
      ORDER BY u.full_name ASC
    `, [docId]);

    const trailRes = await pool.query(`
      SELECT t.*,
             u.full_name AS actor_name,
             u.role      AS actor_role,
             u.job_title AS actor_title
      FROM qms_audit_trail t
      LEFT JOIN users u ON t.actor_id = u.user_id
      WHERE t.doc_id = $1
      ORDER BY t.created_at ASC
    `, [docId]);

    const linksRes = await pool.query(`
      SELECT l.link_id, l.relationship,
             d.doc_id, d.doc_code, d.doc_name, d.doc_type, d.status,
             v.version_number
      FROM qms_document_links l
      JOIN qms_documents d ON l.child_doc_id = d.doc_id
      LEFT JOIN qms_document_versions v ON d.current_version_id = v.version_id
      WHERE l.parent_doc_id = $1
      UNION ALL
      SELECT l.link_id, 'referenced_by' AS relationship,
             d.doc_id, d.doc_code, d.doc_name, d.doc_type, d.status,
             v.version_number
      FROM qms_document_links l
      JOIN qms_documents d ON l.parent_doc_id = d.doc_id
      LEFT JOIN qms_document_versions v ON d.current_version_id = v.version_id
      WHERE l.child_doc_id = $1
      ORDER BY relationship, doc_code
    `, [docId]);

    const ncrImpactRes = await pool.query(`
      SELECT n.ncr_id, n.ncr_code, n.description, n.severity, n.status AS ncr_status,
             n.created_at AS ncr_date, n.closed_at,
             raiser.full_name AS raised_by_name,
             v.version_number AS triggered_version,
             c.capa_code, c.action_description, c.status AS capa_status
      FROM qms_ncr n
      JOIN qms_document_versions v ON n.triggered_version_id = v.version_id
      LEFT JOIN users raiser ON n.raised_by = raiser.user_id
      LEFT JOIN qms_capa c ON c.ncr_id = n.ncr_id
      WHERE v.doc_id = $1
      ORDER BY n.created_at ASC
    `, [docId]);

    const currentVersion = versionsRes.rows.find(v => v.status === 'RELEASED');
    const trainingCompletionRate = currentVersion ? await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE tt.status = 'COMPLETED') AS completed,
        COUNT(*) AS total
      FROM qms_training_tasks tt
      WHERE tt.version_id = $1
    `, [currentVersion.version_id]) : null;

    return {
      document:         docRes.rows[0],
      versions:         versionsRes.rows,
      approvals:        approvalsRes.rows,
      training_records: trainingRes.rows,
      training_pending: pendingRes.rows,
      audit_trail:      trailRes.rows,
      linked_documents: linksRes.rows,
      ncr_capa_impact:  ncrImpactRes.rows,
      training_summary: trainingCompletionRate?.rows[0] || { completed: 0, total: 0 },
      generated_at:     new Date().toISOString(),
    };
  },

  async createShareToken(docId, userId, expiryDays = 30, recipientNote = '') {
    await pool.query(`
      UPDATE qms_audit_share_tokens
      SET is_active = false
      WHERE doc_id = $1 AND is_active = true
    `, [docId]);

    const token = crypto.randomBytes(48).toString('base64url');
    const expiresAt = new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000);

    const result = await pool.query(`
      INSERT INTO qms_audit_share_tokens
        (doc_id, token, created_by, expires_at, is_active, recipient_note)
      VALUES ($1, $2, $3, $4, true, $5)
      RETURNING *
    `, [docId, token, userId, expiresAt, recipientNote]);

    await pool.query(`
      INSERT INTO qms_audit_trail (doc_id, actor_id, action, notes)
      VALUES ($1, $2, 'SHARE_LINK_CREATED', $3)
    `, [docId, userId, `Share link created — expires ${expiresAt.toLocaleDateString()}: ${recipientNote || 'No note'}`]);

    return {
      token:      result.rows[0].token,
      expires_at: result.rows[0].expires_at,
      share_url:  `${process.env.FRONTEND_URL || 'http://localhost:3000'}/qms/inspect/${token}`,
    };
  },

  async revokeShareToken(docId, userId) {
    await pool.query(`
      UPDATE qms_audit_share_tokens
      SET is_active = false
      WHERE doc_id = $1 AND is_active = true
    `, [docId]);

    await pool.query(`
      INSERT INTO qms_audit_trail (doc_id, actor_id, action, notes)
      VALUES ($1, $2, 'SHARE_LINK_REVOKED', 'External share link revoked')
    `, [docId, userId]);

    return { success: true };
  },

  async resolveShareToken(token) {
    const result = await pool.query(`
      SELECT t.*, d.doc_code, d.doc_name
      FROM qms_audit_share_tokens t
      JOIN qms_documents d ON t.doc_id = d.doc_id
      WHERE t.token = $1
        AND t.is_active = true
        AND t.expires_at > NOW()
    `, [token]);

    if (result.rows.length === 0) return null;

    await pool.query(`
      UPDATE qms_audit_share_tokens
      SET last_accessed_at = CURRENT_TIMESTAMP,
          access_count = access_count + 1
      WHERE token = $1
    `, [token]);

    return result.rows[0];
  },

  async getActiveShareToken(docId) {
    const result = await pool.query(`
      SELECT t.*, u.full_name AS created_by_name
      FROM qms_audit_share_tokens t
      LEFT JOIN users u ON t.created_by = u.user_id
      WHERE t.doc_id = $1 AND t.is_active = true AND t.expires_at > NOW()
      ORDER BY t.created_at DESC LIMIT 1
    `, [docId]);
    return result.rows[0] || null;
  },

  // ── 3C — DOCUMENT HIERARCHY ──

  async getDocumentHierarchy(sectionId = null) {
    let docQuery = `
      SELECT
        d.doc_id AS id, d.doc_code, d.doc_name, d.doc_type, d.status,
        s.section_code, s.section_name, s.color_code,
        v.version_number
      FROM qms_documents d
      JOIN qms_sections s ON d.section_id = s.section_id
      LEFT JOIN qms_document_versions v ON d.current_version_id = v.version_id
      WHERE d.status NOT IN ('WITHDRAWN', 'PLANNED')
    `;
    const params = [];
    if (sectionId) {
      docQuery += ` AND d.section_id = $1`;
      params.push(sectionId);
    }
    docQuery += ` ORDER BY s.sort_order, d.doc_type, d.doc_code`;

    const docsRes  = await pool.query(docQuery, params);
    const linksRes = await pool.query(`
      SELECT l.link_id AS id, l.parent_doc_id AS source,
             l.child_doc_id AS target, l.relationship
      FROM qms_document_links l
      JOIN qms_documents p ON l.parent_doc_id = p.doc_id
      JOIN qms_documents c ON l.child_doc_id  = c.doc_id
      WHERE p.status NOT IN ('WITHDRAWN', 'PLANNED')
        AND c.status NOT IN ('WITHDRAWN', 'PLANNED')
    `);

    return {
      nodes: docsRes.rows,
      edges: linksRes.rows,
    };
  },

  async getDocumentLineage(docId) {
    const result = await pool.query(`
      WITH RECURSIVE lineage AS (
        SELECT doc_id, doc_code, doc_name, doc_type, status, 0 AS depth, 'self' AS direction
        FROM qms_documents WHERE doc_id = $1

        UNION ALL

        SELECT d.doc_id, d.doc_code, d.doc_name, d.doc_type, d.status,
               l.depth - 1, 'parent'
        FROM qms_documents d
        JOIN qms_document_links lnk ON lnk.parent_doc_id = d.doc_id
        JOIN lineage l ON lnk.child_doc_id = l.doc_id
        WHERE l.depth > -3

        UNION ALL

        SELECT d.doc_id, d.doc_code, d.doc_name, d.doc_type, d.status,
               l.depth + 1, 'child'
        FROM qms_documents d
        JOIN qms_document_links lnk ON lnk.child_doc_id = d.doc_id
        JOIN lineage l ON lnk.parent_doc_id = l.doc_id
        WHERE l.depth < 3
      )
      SELECT DISTINCT doc_id, doc_code, doc_name, doc_type, status, depth, direction
      FROM lineage
      ORDER BY depth, doc_code
    `, [docId]);
    return result.rows;
  }

};

// Export the helper method for testing
QmsService._createTrainingTasksForRelease = createTrainingTasksForRelease;

module.exports = QmsService;