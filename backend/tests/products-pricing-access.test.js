'use strict';

// Finance Access Expansion: junior_accountant write access to Products
// (create) and Pricing (PUT /api/products/pricing), gated by a required
// `reason` on every pricing write, logged to price_change_log, and
// notified to the other executive roles. manager is explicitly NOT part
// of this expansion on the pricing route -- see the dedicated "manager
// still blocked" test below for the boundary that must not move.
//
// Real HTTP calls against a running dev server, real DB, mocked email
// (MOCK_EMAIL_TRANSPORT + waitForMockEmail) -- see backend/tests/README.md.

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
  waitForMockEmail,
} = require('./helpers/test-helper');

const { getEmailsByRole } = require('../src/services/notification-service');

let adminToken, adminHeaders, adminUser;
let cfoToken, cfoHeaders, cfoUser;
let jrToken, jrHeaders, jrUser;
let managerToken, managerHeaders;
let categoryId;
const productIds = [];

before(async () => {
  await assertServerReachable();
  adminToken = await login(process.env.TEST_ADMIN_EMAIL, process.env.TEST_ADMIN_PASSWORD);
  adminHeaders = authHeaders(adminToken);
  ({ user: adminUser } = await signTokenForRole('admin')); // real login above; this is only for the user row

  ({ token: cfoToken, user: cfoUser } = await signTokenForRole('cfo'));
  cfoHeaders = authHeaders(cfoToken);

  ({ token: jrToken, user: jrUser } = await signTokenForRole('junior_accountant'));
  jrHeaders = authHeaders(jrToken);

  ({ token: managerToken } = await signTokenForRole('manager'));
  managerHeaders = authHeaders(managerToken);

  const cat = await pool.query(`SELECT category_id FROM product_categories LIMIT 1`);
  categoryId = cat.rows[0].category_id;
});

after(async () => {
  if (productIds.length) {
    await pool.query(`DELETE FROM price_change_log WHERE product_id = ANY($1)`, [productIds]);
    await pool.query(`DELETE FROM products WHERE product_id = ANY($1)`, [productIds]);
  }
});

async function createTestProduct(headers, skuSuffix, sellingPrice) {
  const sku = `TEST-SUITE-${skuSuffix}-${Date.now()}`;
  const res = await axios.post(
    `${BASE_URL}/api/products`,
    { sku, product_name: `TEST SUITE - ${skuSuffix}`, category_id: categoryId, base_uom: 'EA', selling_price: sellingPrice },
    headers
  );
  productIds.push(res.data.product_id);
  return res.data.product_id;
}

// ── junior_accountant: the new write access ─────────────────────────────

test('junior_accountant CAN create a product', async () => {
  const res = await axios.post(
    `${BASE_URL}/api/products`,
    { sku: `TEST-SUITE-JR-CREATE-${Date.now()}`, product_name: 'TEST SUITE - jr create', category_id: categoryId, base_uom: 'EA', selling_price: 10 },
    jrHeaders
  );
  productIds.push(res.data.product_id);
  assert.equal(res.status, 201);
});

test('junior_accountant CAN update pricing with a reason -- logs a price_change_log row', async () => {
  const productId = await createTestProduct(jrHeaders, 'JR-PRICE', 10);
  const res = await axios.put(
    `${BASE_URL}/api/products/pricing`,
    { reason: 'TEST SUITE - correcting a data-entry error', products: [{ product_id: productId, selling_price: 15, selling_price_zmw: 405 }] },
    jrHeaders
  );
  assert.equal(res.status, 200);
  assert.equal(res.data.changes_logged, 1);

  const logRes = await pool.query(`SELECT * FROM price_change_log WHERE product_id = $1`, [productId]);
  assert.equal(logRes.rows.length, 1);
  assert.equal(Number(logRes.rows[0].old_price), 10);
  assert.equal(Number(logRes.rows[0].new_price), 15);
  assert.equal(logRes.rows[0].currency, 'USD');
  assert.equal(logRes.rows[0].reason, 'TEST SUITE - correcting a data-entry error');
  assert.equal(logRes.rows[0].changed_by, jrUser.user_id);
});

// ── reason required on every pricing write, regardless of who ───────────

test('pricing write without a reason is rejected with 400, for any authorized role', async () => {
  const productId = await createTestProduct(adminHeaders, 'NO-REASON', 20);
  await assert.rejects(
    () => axios.put(`${BASE_URL}/api/products/pricing`, { products: [{ product_id: productId, selling_price: 25 }] }, adminHeaders),
    (err) => err.response?.status === 400 && /reason/i.test(err.response?.data?.message || '')
  );
});

test('pricing write with a blank/whitespace-only reason is rejected with 400', async () => {
  const productId = await createTestProduct(adminHeaders, 'BLANK-REASON', 20);
  await assert.rejects(
    () => axios.put(`${BASE_URL}/api/products/pricing`, { reason: '   ', products: [{ product_id: productId, selling_price: 25 }] }, adminHeaders),
    (err) => err.response?.status === 400 && /reason/i.test(err.response?.data?.message || '')
  );
});

// ── manager: the boundary that must not move ─────────────────────────────
//
// manager was never on PUT /api/products/pricing and this session doesn't
// add it there. It's a DIFFERENT story on POST /api/products: manager has
// had create-product access since before this session (predates both the
// compliance-module manager work and this one) -- the session prompt's
// framing that manager should be "blocked from both" doesn't match that
// pre-existing, untouched reality, and "do not touch its access anywhere
// in this session" rules out removing it to make the framing true. This
// test asserts what's actually the case for each route rather than a
// premise contradicted by Step 0's own inventory.
test('manager still blocked from PUT /pricing (never granted, not granted here); retains its pre-existing, untouched POST /api/products access', async () => {
  await assert.rejects(
    () => axios.put(`${BASE_URL}/api/products/pricing`, { reason: 'trying anyway', products: [] }, managerHeaders),
    (err) => err.response?.status === 403
  );

  const createRes = await axios.post(
    `${BASE_URL}/api/products`,
    { sku: `TEST-SUITE-MGR-CREATE-${Date.now()}`, product_name: 'TEST SUITE - manager create (pre-existing access)', category_id: categoryId, base_uom: 'EA', selling_price: 5 },
    managerHeaders
  );
  productIds.push(createRes.data.product_id);
  assert.equal(createRes.status, 201);
});

// ── Notification recipients: junior actor -> all 3; exec actor -> other 2 ─

test('junior_accountant price change notifies all three executive roles (none of them is the actor)', async () => {
  const productId = await createTestProduct(jrHeaders, 'JR-NOTIFY', 30);
  const before = new Date();

  const res = await axios.put(
    `${BASE_URL}/api/products/pricing`,
    { reason: 'TEST SUITE - junior actor notification check', products: [{ product_id: productId, selling_price: 35 }] },
    jrHeaders
  );
  assert.equal(res.status, 200);

  const expectedEmails = await getEmailsByRole(['admin', 'cfo', 'ceo']);
  const sent = await waitForMockEmail({ subject: `Pricing Updated by ${jrUser.full_name}`, sentAfter: before });
  assert.ok(sent, 'expected a mock pricing-update email to have been sent');
  assert.deepEqual([...sent.to].sort(), [...expectedEmails].sort());
});

test('an executive (cfo) price change notifies the other two executives and excludes cfo itself', async () => {
  const productId = await createTestProduct(cfoHeaders, 'CFO-NOTIFY', 40);
  const before = new Date();

  const res = await axios.put(
    `${BASE_URL}/api/products/pricing`,
    { reason: 'TEST SUITE - executive actor notification check', products: [{ product_id: productId, selling_price: 45 }] },
    cfoHeaders
  );
  assert.equal(res.status, 200);

  const expectedEmails = await getEmailsByRole(['admin', 'ceo']); // cfo excluded
  const sent = await waitForMockEmail({ subject: `Pricing Updated by ${cfoUser.full_name}`, sentAfter: before });
  assert.ok(sent, 'expected a mock pricing-update email to have been sent');
  assert.deepEqual([...sent.to].sort(), [...expectedEmails].sort());
  assert.ok(!sent.to.includes(cfoUser.email), 'cfo must not be in the recipient list for their own change');
});

test('a price write that changes nothing (same price) logs no row and sends no notification', async () => {
  const productId = await createTestProduct(adminHeaders, 'NO-OP', 50);
  const before = new Date();

  const res = await axios.put(
    `${BASE_URL}/api/products/pricing`,
    { reason: 'TEST SUITE - no-op price write', products: [{ product_id: productId, selling_price: 50 }] },
    adminHeaders
  );
  assert.equal(res.status, 200);
  assert.equal(res.data.changes_logged, 0);

  const logRes = await pool.query(`SELECT * FROM price_change_log WHERE product_id = $1`, [productId]);
  assert.equal(logRes.rows.length, 0);

  const sent = await waitForMockEmail({ subject: `Pricing Updated by ${adminUser.full_name}`, sentAfter: before, timeoutMs: 3000 });
  assert.equal(sent, null, 'a no-op price write should not send a notification');
});
