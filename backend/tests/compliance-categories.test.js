'use strict';

// Compliance Module Phase 5: category management endpoints
// (POST/GET /api/compliance/categories, PATCH /api/compliance/categories/:id)
// and the items-list endpoints (GET /api/compliance/items[/:id]) added
// alongside them to unblock the frontend's approval-queue/my-tasks views.

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
  Cleanup,
} = require('./helpers/test-helper');

const cleanup = new Cleanup();
let adminToken, adminHeaders;
let jrToken, jrHeaders, jrUser;
let cfoToken, cfoHeaders;
let warehouseToken, warehouseHeaders;

before(async () => {
  await assertServerReachable();
  adminToken = await login(process.env.TEST_ADMIN_EMAIL, process.env.TEST_ADMIN_PASSWORD);
  adminHeaders = authHeaders(adminToken);

  ({ token: jrToken, user: jrUser } = await signTokenForRole('junior_accountant'));
  jrHeaders = authHeaders(jrToken);

  ({ token: cfoToken } = await signTokenForRole('cfo'));
  cfoHeaders = authHeaders(cfoToken);

  ({ token: warehouseToken } = await signTokenForRole('warehouse_manager'));
  warehouseHeaders = authHeaders(warehouseToken);
});

after(async () => {
  await cleanup.run();
});

// ── Category creation: role gate ─────────────────────────────────────────────

test('junior_accountant gets 403 creating a category', async () => {
  await assert.rejects(
    () => axios.post(
      `${BASE_URL}/api/compliance/categories`,
      { name: 'TEST SUITE - jr blocked', recurrence_type: 'ONE_OFF_EXPIRY' },
      jrHeaders
    ),
    (err) => err.response?.status === 403
  );
});

test('admin can create a category with default reminder_ladder_days', async () => {
  const res = await axios.post(
    `${BASE_URL}/api/compliance/categories`,
    { name: 'TEST SUITE - admin create', regulator: 'PACRA', recurrence_type: 'ANNUAL_RECURRING' },
    adminHeaders
  );
  cleanup.trackCategory(res.data.category_id);
  assert.equal(res.status, 201);
  assert.equal(res.data.name, 'TEST SUITE - admin create');
  assert.equal(res.data.regulator, 'PACRA');
  assert.equal(res.data.recurrence_type, 'ANNUAL_RECURRING');
  assert.deepEqual(res.data.reminder_ladder_days, [30, 15, 10, 5]);
  assert.equal(res.data.is_active, true);
});

test('cfo can create a category with a custom reminder_ladder_days', async () => {
  const res = await axios.post(
    `${BASE_URL}/api/compliance/categories`,
    { name: 'TEST SUITE - cfo create', recurrence_type: 'MONTHLY_RECURRING', reminder_ladder_days: [14, 7, 1] },
    cfoHeaders
  );
  cleanup.trackCategory(res.data.category_id);
  assert.equal(res.status, 201);
  assert.deepEqual(res.data.reminder_ladder_days, [14, 7, 1]);
});

test('creating a category with an invalid recurrence_type is rejected with 400', async () => {
  await assert.rejects(
    () => axios.post(
      `${BASE_URL}/api/compliance/categories`,
      { name: 'TEST SUITE - bad recurrence', recurrence_type: 'WEEKLY_WHATEVER' },
      adminHeaders
    ),
    (err) => err.response?.status === 400
  );
});

// ── Category listing: open to all 4 module roles ────────────────────────────

test('junior_accountant CAN list categories (needed for the item-registration picker)', async () => {
  const created = await axios.post(
    `${BASE_URL}/api/compliance/categories`,
    { name: 'TEST SUITE - list visibility', recurrence_type: 'ONE_OFF_EXPIRY' },
    adminHeaders
  );
  cleanup.trackCategory(created.data.category_id);

  const res = await axios.get(`${BASE_URL}/api/compliance/categories`, jrHeaders);
  assert.equal(res.status, 200);
  assert.ok(res.data.some((c) => c.category_id === created.data.category_id));
});

test('inactive categories are excluded by default, included with active_only=false', async () => {
  const created = await axios.post(
    `${BASE_URL}/api/compliance/categories`,
    { name: 'TEST SUITE - inactive filter', recurrence_type: 'ONE_OFF_EXPIRY' },
    adminHeaders
  );
  cleanup.trackCategory(created.data.category_id);
  await axios.patch(`${BASE_URL}/api/compliance/categories/${created.data.category_id}`, { is_active: false }, adminHeaders);

  const defaultList = await axios.get(`${BASE_URL}/api/compliance/categories`, jrHeaders);
  assert.ok(!defaultList.data.some((c) => c.category_id === created.data.category_id), 'inactive category should be excluded by default');

  const fullList = await axios.get(`${BASE_URL}/api/compliance/categories?active_only=false`, jrHeaders);
  assert.ok(fullList.data.some((c) => c.category_id === created.data.category_id), 'inactive category should appear with active_only=false');
});

// ── Category update: role gate + immutable recurrence_type ──────────────────

test('junior_accountant gets 403 updating a category', async () => {
  const created = await axios.post(
    `${BASE_URL}/api/compliance/categories`,
    { name: 'TEST SUITE - jr update blocked', recurrence_type: 'ONE_OFF_EXPIRY' },
    adminHeaders
  );
  cleanup.trackCategory(created.data.category_id);

  await assert.rejects(
    () => axios.patch(`${BASE_URL}/api/compliance/categories/${created.data.category_id}`, { name: 'nope' }, jrHeaders),
    (err) => err.response?.status === 403
  );
});

test('attempting to change recurrence_type via PATCH is rejected with 400', async () => {
  const created = await axios.post(
    `${BASE_URL}/api/compliance/categories`,
    { name: 'TEST SUITE - immutable recurrence', recurrence_type: 'ONE_OFF_EXPIRY' },
    adminHeaders
  );
  cleanup.trackCategory(created.data.category_id);

  await assert.rejects(
    () => axios.patch(`${BASE_URL}/api/compliance/categories/${created.data.category_id}`, { recurrence_type: 'MONTHLY_RECURRING' }, adminHeaders),
    (err) => err.response?.status === 400
  );
});

test('admin can deactivate a category', async () => {
  const created = await axios.post(
    `${BASE_URL}/api/compliance/categories`,
    { name: 'TEST SUITE - deactivate', recurrence_type: 'ONE_OFF_EXPIRY' },
    adminHeaders
  );
  cleanup.trackCategory(created.data.category_id);

  const patchRes = await axios.patch(`${BASE_URL}/api/compliance/categories/${created.data.category_id}`, { is_active: false }, adminHeaders);
  assert.equal(patchRes.status, 200);
  assert.equal(patchRes.data.is_active, false);
});

// ── Items list: role-scoped visibility ───────────────────────────────────────

test('GET /items: junior_accountant sees own item, not another junior_accountant\'s item they have no stake in', async () => {
  const categoryId = await axios.post(
    `${BASE_URL}/api/compliance/categories`,
    { name: 'TEST SUITE - items scoping', recurrence_type: 'ONE_OFF_EXPIRY' },
    adminHeaders
  ).then((r) => { cleanup.trackCategory(r.data.category_id); return r.data.category_id; });

  const ownItem = await axios.post(
    `${BASE_URL}/api/compliance/items`,
    { category_id: categoryId, due_date: '2027-06-15', evidence_file_ref: 'x.pdf' },
    jrHeaders
  );
  cleanup.trackItem(ownItem.data.item_id);

  // admin's own item -- APPROVED status, not NON_COMPLIANT, so it's neither
  // jrUser's own item nor open for acknowledgement.
  const otherItem = await axios.post(
    `${BASE_URL}/api/compliance/items`,
    { category_id: categoryId, due_date: '2027-06-16', evidence_file_ref: 'x.pdf' },
    adminHeaders
  );
  cleanup.trackItem(otherItem.data.item_id);

  const listRes = await axios.get(`${BASE_URL}/api/compliance/items`, jrHeaders);
  assert.equal(listRes.status, 200);
  assert.ok(listRes.data.some((i) => i.item_id === ownItem.data.item_id), 'own item should be visible');
  assert.ok(!listRes.data.some((i) => i.item_id === otherItem.data.item_id), 'another user\'s DRAFT item should not be visible');
});

test('GET /items: admin/cfo/ceo see everything, including items they did not create', async () => {
  const categoryId = await axios.post(
    `${BASE_URL}/api/compliance/categories`,
    { name: 'TEST SUITE - executive visibility', recurrence_type: 'ONE_OFF_EXPIRY' },
    adminHeaders
  ).then((r) => { cleanup.trackCategory(r.data.category_id); return r.data.category_id; });

  const item = await axios.post(
    `${BASE_URL}/api/compliance/items`,
    { category_id: categoryId, due_date: '2027-06-17', evidence_file_ref: 'x.pdf' },
    jrHeaders
  );
  cleanup.trackItem(item.data.item_id);

  const listRes = await axios.get(`${BASE_URL}/api/compliance/items`, cfoHeaders);
  assert.ok(listRes.data.some((i) => i.item_id === item.data.item_id), 'cfo should see a junior_accountant\'s item');
});

// ── Step 3: a non-compliance role gets 403 on every compliance route ────────
// warehouse_manager has no stake in this module at all (not one of the 4
// roles decided on across every session of this build) -- confirms the
// backend gate holds regardless of what the frontend nav shows or hides.

test('warehouse_manager (non-compliance role) gets 403 on every compliance route', async (t) => {
  await t.test('GET /categories', async () => {
    await assert.rejects(
      () => axios.get(`${BASE_URL}/api/compliance/categories`, warehouseHeaders),
      (err) => err.response?.status === 403
    );
  });

  await t.test('POST /categories', async () => {
    await assert.rejects(
      () => axios.post(`${BASE_URL}/api/compliance/categories`, { name: 'x', recurrence_type: 'ONE_OFF_EXPIRY' }, warehouseHeaders),
      (err) => err.response?.status === 403
    );
  });

  await t.test('GET /items', async () => {
    await assert.rejects(
      () => axios.get(`${BASE_URL}/api/compliance/items`, warehouseHeaders),
      (err) => err.response?.status === 403
    );
  });

  await t.test('POST /items', async () => {
    await assert.rejects(
      () => axios.post(`${BASE_URL}/api/compliance/items`, { category_id: '00000000-0000-0000-0000-000000000000', due_date: '2027-01-01' }, warehouseHeaders),
      (err) => err.response?.status === 403
    );
  });
});

test('GET /items/:id: 403 for a non-executive with no stake in the item', async () => {
  const categoryId = await axios.post(
    `${BASE_URL}/api/compliance/categories`,
    { name: 'TEST SUITE - detail 403', recurrence_type: 'ONE_OFF_EXPIRY' },
    adminHeaders
  ).then((r) => { cleanup.trackCategory(r.data.category_id); return r.data.category_id; });

  const item = await axios.post(
    `${BASE_URL}/api/compliance/items`,
    { category_id: categoryId, due_date: '2027-06-18', evidence_file_ref: 'x.pdf' },
    adminHeaders
  );
  cleanup.trackItem(item.data.item_id);

  await assert.rejects(
    () => axios.get(`${BASE_URL}/api/compliance/items/${item.data.item_id}`, jrHeaders),
    (err) => err.response?.status === 403
  );
});
