'use strict';

const { pool } = require('./auth-service');
const bcrypt   = require('bcryptjs');

// ─── 1. uploadPersonnelDocument ──────────────────────────────────────────────

const uploadPersonnelDocument = async (
  userId, fileBuffer, originalName, mimeType, docMeta, uploadedByUserId
) => {
  const {
    document_type,
    document_title,
    document_date,
    version,
    notes,
    is_gate_document,
    gate_category,
  } = docMeta;

  const result = await pool.query(
    `INSERT INTO hr_personnel_documents (
       user_id, document_type, document_title, document_date, version,
       file_data, file_original_name, file_mime_type, file_size_bytes,
       is_filed, filed_date, notes, is_gate_document, gate_category,
       created_by
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9, TRUE, NOW(), $10,$11,$12,$13)
     RETURNING id, document_type, document_title, document_date, version,
               file_original_name, file_mime_type, file_size_bytes,
               is_filed, filed_date, notes, is_gate_document, gate_category,
               manager_checked, manager_signed_by, manager_signed_at,
               created_at, created_by`,
    [
      userId,
      document_type,
      document_title || null,
      document_date || null,
      version || '1.0',
      fileBuffer,
      originalName,
      mimeType,
      fileBuffer.length,
      notes || null,
      is_gate_document === true || is_gate_document === 'true',
      gate_category || null,
      uploadedByUserId,
    ]
  );
  return result.rows[0];
};

// ─── 2. managerSignOffDocument ────────────────────────────────────────────────

const managerSignOffDocument = async (documentId, managerUserId, signaturePassword, signNote) => {
  const docRes = await pool.query(
    `SELECT d.*, u.full_name AS employee_name
     FROM hr_personnel_documents d
     JOIN users u ON d.user_id = u.user_id
     WHERE d.id = $1`,
    [documentId]
  );
  if (!docRes.rows.length) throw new Error('Document not found');

  const managerRes = await pool.query(
    `SELECT password_hash, full_name FROM users WHERE user_id = $1`,
    [managerUserId]
  );
  if (!managerRes.rows.length) throw new Error('Manager user not found');

  const { password_hash, full_name: managerName } = managerRes.rows[0];
  const valid = await bcrypt.compare(signaturePassword, password_hash);
  if (!valid) throw new Error('Invalid digital signature. Password incorrect.');

  const updateRes = await pool.query(
    `UPDATE hr_personnel_documents
     SET manager_checked    = TRUE,
         manager_signed_by  = $2,
         manager_signed_at  = NOW(),
         manager_sign_note  = $3,
         updated_at         = NOW()
     WHERE id = $1
     RETURNING id, document_type, document_title, manager_checked,
               manager_signed_at, manager_sign_note`,
    [documentId, managerUserId, signNote]
  );

  try {
    const notificationService = require('./notification-service');
    const docRow = docRes.rows[0];
    const hrAdminEmails = await notificationService.getEmailsByRole(['hr_admin', 'admin']);
    await notificationService.notifyHrDocumentSigned(
      docRow.employee_name,
      docRow.document_title,
      managerName,
      hrAdminEmails
    );
  } catch (e) {
    console.warn('HR doc sign-off email failed (non-blocking):', e.message);
  }

  return updateRes.rows[0];
};

// ─── 3. getPersonnelDocuments ─────────────────────────────────────────────────

const getPersonnelDocuments = async (userId) => {
  const result = await pool.query(
    `SELECT id, document_type, document_title, document_date, version,
            file_original_name, file_mime_type, file_size_bytes,
            is_filed, filed_date, notes, is_gate_document, gate_category,
            manager_checked, manager_signed_by, manager_signed_at,
            manager_sign_note, created_at, created_by
     FROM hr_personnel_documents
     WHERE user_id = $1
     ORDER BY created_at DESC`,
    [userId]
  );
  return result.rows;
};

// ─── 4. downloadPersonnelDocument ────────────────────────────────────────────

const downloadPersonnelDocument = async (documentId) => {
  const result = await pool.query(
    `SELECT file_data, file_original_name, file_mime_type, user_id
     FROM hr_personnel_documents
     WHERE id = $1`,
    [documentId]
  );
  if (!result.rows.length) throw new Error('Document not found');
  const row = result.rows[0];
  return {
    fileBuffer: row.file_data,
    originalName: row.file_original_name,
    mimeType: row.file_mime_type,
  };
};

// ─── 5. checkGatingDocuments ──────────────────────────────────────────────────

const GATE_REQUIREMENTS = {
  onboarding: [
    'employment_contract', 'schedule_3_receipt', 'nrc_passport_copy',
    'phase_1_signoff', 'phase_2_signoff',
  ],
  probation: [
    'day_30_review_form', 'day_90_review_form',
  ],
};

const checkGatingDocuments = async (userId, gateCategory) => {
  const required = GATE_REQUIREMENTS[gateCategory] || [];

  const result = await pool.query(
    `SELECT document_type
     FROM hr_personnel_documents
     WHERE user_id       = $1
       AND gate_category  = $2
       AND is_filed       = TRUE
       AND manager_checked = TRUE
       AND document_type  = ANY($3)`,
    [userId, gateCategory, required]
  );

  const filed   = result.rows.map(r => r.document_type);
  const missing = required.filter(t => !filed.includes(t));

  return {
    required,
    filed,
    missing,
    gateOpen: missing.length === 0,
  };
};

// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  uploadPersonnelDocument,
  managerSignOffDocument,
  getPersonnelDocuments,
  downloadPersonnelDocument,
  checkGatingDocuments,
};
