'use strict';

// Compliance Module: PDF evidence upload/download
// (POST/GET /api/compliance/items/:id/evidence), and the submit-time
// requirement that evidence exists before DRAFT -> PENDING_APPROVAL.

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const axios = require('axios');

const {
  BASE_URL,
  pool,
  assertServerReachable,
  login,
  authHeaders,
  signTokenForRole,
  createComplianceCategory,
  Cleanup,
} = require('./helpers/test-helper');

const cleanup = new Cleanup();
let adminToken, adminHeaders;
let jrToken, jrHeaders, jrUser;
let cfoToken, cfoHeaders;
let categoryId;

function isoDate(offsetDays) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().split('T')[0];
}

// A minimal byte buffer is enough -- multer's fileFilter checks the form
// part's declared Content-Type (Blob's `type`), not the byte content, so
// this doesn't need to be a real, renderable PDF to exercise the route's
// own accept/reject logic.
function pdfFormData(filenameOrBytes, maybeBytes) {
  const filename = maybeBytes ? filenameOrBytes : 'evidence.pdf';
  const bytes = maybeBytes || filenameOrBytes || Buffer.from('%PDF-1.4 test evidence content');
  const fd = new FormData();
  fd.append('evidence', new Blob([bytes], { type: 'application/pdf' }), filename);
  return fd;
}

function nonPdfFormData() {
  const fd = new FormData();
  fd.append('evidence', new Blob([Buffer.from('not a pdf')], { type: 'text/plain' }), 'notes.txt');
  return fd;
}

async function createDraftItem(headers) {
  const res = await axios.post(
    `${BASE_URL}/api/compliance/items`,
    { category_id: categoryId, due_date: isoDate(30), evidence_file_ref: 'ad hoc label' },
    headers
  );
  cleanup.trackItem(res.data.item_id);
  return res.data.item_id;
}

before(async () => {
  await assertServerReachable();
  adminToken = await login(process.env.TEST_ADMIN_EMAIL, process.env.TEST_ADMIN_PASSWORD);
  adminHeaders = authHeaders(adminToken);

  ({ token: jrToken, user: jrUser } = await signTokenForRole('junior_accountant'));
  jrHeaders = authHeaders(jrToken);

  ({ token: cfoToken } = await signTokenForRole('cfo'));
  cfoHeaders = authHeaders(cfoToken);

  categoryId = await createComplianceCategory({ name: 'TEST SUITE - evidence upload', recurrence_type: 'ONE_OFF_EXPIRY' });
  cleanup.trackCategory(categoryId);
});

after(async () => {
  await cleanup.run();
});

// ── Submit gate ──────────────────────────────────────────────────────────────

test('submit is rejected with 400 when no evidence has been uploaded', async () => {
  const itemId = await createDraftItem(jrHeaders);
  await assert.rejects(
    () => axios.post(`${BASE_URL}/api/compliance/items/${itemId}/submit`, {}, jrHeaders),
    (err) => err.response?.status === 400 && /evidence/i.test(err.response.data.message)
  );
});

test('submit succeeds once a PDF has been attached', async () => {
  const itemId = await createDraftItem(jrHeaders);

  const uploadRes = await axios.post(
    `${BASE_URL}/api/compliance/items/${itemId}/evidence`,
    pdfFormData(),
    jrHeaders
  );
  assert.equal(uploadRes.status, 201);
  assert.equal(uploadRes.data.filename, 'evidence.pdf');

  const submitRes = await axios.post(`${BASE_URL}/api/compliance/items/${itemId}/submit`, {}, jrHeaders);
  assert.equal(submitRes.status, 200);
  assert.equal(submitRes.data.status, 'PENDING_APPROVAL');
});

// ── Upload validation ────────────────────────────────────────────────────────

test('a non-PDF file is rejected with 400', async () => {
  const itemId = await createDraftItem(jrHeaders);
  await assert.rejects(
    () => axios.post(`${BASE_URL}/api/compliance/items/${itemId}/evidence`, nonPdfFormData(), jrHeaders),
    (err) => err.response?.status === 400
  );
});

test('an oversized file (>10MB) is rejected with 400', async () => {
  const itemId = await createDraftItem(jrHeaders);
  const oversized = Buffer.alloc(11 * 1024 * 1024, 'x');
  await assert.rejects(
    () => axios.post(`${BASE_URL}/api/compliance/items/${itemId}/evidence`, pdfFormData('big.pdf', oversized), jrHeaders),
    (err) => err.response?.status === 400 && /10MB/i.test(err.response.data.message)
  );
});

// ── Re-upload behavior: replace, not version ────────────────────────────────

test('re-uploading evidence replaces the row rather than creating a second one', async () => {
  const itemId = await createDraftItem(jrHeaders);

  await axios.post(`${BASE_URL}/api/compliance/items/${itemId}/evidence`, pdfFormData('first.pdf', Buffer.from('first version')), jrHeaders);
  const secondUpload = await axios.post(
    `${BASE_URL}/api/compliance/items/${itemId}/evidence`,
    pdfFormData('second.pdf', Buffer.from('second version')),
    jrHeaders
  );
  assert.equal(secondUpload.status, 201);
  assert.equal(secondUpload.data.filename, 'second.pdf');

  const rows = await pool.query(`SELECT filename, file_data FROM compliance_item_evidence WHERE item_id = $1`, [itemId]);
  assert.equal(rows.rows.length, 1, 'expected exactly one evidence row after two uploads');
  assert.equal(rows.rows[0].filename, 'second.pdf');
  assert.equal(rows.rows[0].file_data.toString(), 'second version');
});

// ── Download: role/item-scoping matches item-visibility rules ───────────────

test('the creator can download their own evidence', async () => {
  const itemId = await createDraftItem(jrHeaders);
  await axios.post(`${BASE_URL}/api/compliance/items/${itemId}/evidence`, pdfFormData('mine.pdf', Buffer.from('mine')), jrHeaders);

  const downloadRes = await axios.get(`${BASE_URL}/api/compliance/items/${itemId}/evidence`, { ...jrHeaders, responseType: 'arraybuffer' });
  assert.equal(downloadRes.status, 200);
  assert.equal(downloadRes.headers['content-type'], 'application/pdf');
  assert.equal(Buffer.from(downloadRes.data).toString(), 'mine');
});

test('a non-executive with no stake in the item gets 403 downloading its evidence', async () => {
  const itemId = await createDraftItem(adminHeaders); // admin's own DRAFT item -- not jrUser's, not open for ack
  await axios.post(`${BASE_URL}/api/compliance/items/${itemId}/evidence`, pdfFormData(), adminHeaders);

  await assert.rejects(
    () => axios.get(`${BASE_URL}/api/compliance/items/${itemId}/evidence`, jrHeaders),
    (err) => err.response?.status === 403
  );
});

test('an approver (cfo) can retrieve evidence for a item pending their approval', async () => {
  const itemId = await createDraftItem(jrHeaders);
  await axios.post(`${BASE_URL}/api/compliance/items/${itemId}/evidence`, pdfFormData('for-approval.pdf', Buffer.from('approve me')), jrHeaders);
  await axios.post(`${BASE_URL}/api/compliance/items/${itemId}/submit`, {}, jrHeaders);

  const downloadRes = await axios.get(`${BASE_URL}/api/compliance/items/${itemId}/evidence`, { ...cfoHeaders, responseType: 'arraybuffer' });
  assert.equal(downloadRes.status, 200);
  assert.equal(Buffer.from(downloadRes.data).toString(), 'approve me');
});

test('downloading evidence for a nonexistent item is 404', async () => {
  await assert.rejects(
    () => axios.get(`${BASE_URL}/api/compliance/items/00000000-0000-0000-0000-000000000000/evidence`, adminHeaders),
    (err) => err.response?.status === 404
  );
});
