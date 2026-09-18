'use strict';

// Asset Register: Finance read access (junior_accountant, manager, cfo, ceo)
// alongside Engineering, cost_usd captured at creation, and edit/delete
// routes that didn't exist before this session. Write access (create/edit/
// delete) stays exactly where it already was -- engineering_manager/admin
// only, NOT plain 'engineering' -- this session doesn't widen that
// pre-existing boundary. Real HTTP calls against a running dev server, real
// DB -- see backend/tests/README.md.

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
} = require('./helpers/test-helper');

let adminToken, adminHeaders;
let jrToken, jrHeaders;
let managerToken, managerHeaders;
let cfoToken, cfoHeaders;
let engineeringToken, engineeringHeaders;
let warehouseToken, warehouseHeaders;
const createdEquipmentIds = [];

before(async () => {
  await assertServerReachable();
  adminToken = await login(process.env.TEST_ADMIN_EMAIL, process.env.TEST_ADMIN_PASSWORD);
  adminHeaders = authHeaders(adminToken);

  ({ token: jrToken } = await signTokenForRole('junior_accountant'));
  jrHeaders = authHeaders(jrToken);

  ({ token: managerToken } = await signTokenForRole('manager'));
  managerHeaders = authHeaders(managerToken);

  ({ token: cfoToken } = await signTokenForRole('cfo'));
  cfoHeaders = authHeaders(cfoToken);

  ({ token: engineeringToken } = await signTokenForRole('engineering'));
  engineeringHeaders = authHeaders(engineeringToken);

  ({ token: warehouseToken } = await signTokenForRole('warehouse_manager'));
  warehouseHeaders = authHeaders(warehouseToken);
});

after(async () => {
  if (createdEquipmentIds.length) {
    await pool.query(`DELETE FROM equipment WHERE equipment_id = ANY($1)`, [createdEquipmentIds]);
  }
});

// ── Finance read access ──────────────────────────────────────────────────

test('junior_accountant, manager, cfo can all GET /assets/equipment and /assets/locations', async (t) => {
  for (const [name, headers] of [['junior_accountant', jrHeaders], ['manager', managerHeaders], ['cfo', cfoHeaders]]) {
    await t.test(`${name}: GET /assets/equipment`, async () => {
      const res = await axios.get(`${BASE_URL}/api/engineering/assets/equipment`, headers);
      assert.equal(res.status, 200);
    });
    await t.test(`${name}: GET /assets/locations`, async () => {
      const res = await axios.get(`${BASE_URL}/api/engineering/assets/locations`, headers);
      assert.equal(res.status, 200);
    });
  }
});

// No active ceo user exists in this DB (consistent with the rest of this
// project's test suite) -- the authorize list itself is confirmed to
// include ceo by code inspection; junior_accountant/manager/cfo above
// already exercise the same ASSET_REGISTER_READ_ROLES array live.

test('a genuinely unrelated role (warehouse_manager) still gets 403 -- read access did not leak to everyone', async () => {
  await assert.rejects(
    () => axios.get(`${BASE_URL}/api/engineering/assets/equipment`, warehouseHeaders),
    (err) => err.response?.status === 403
  );
});

// ── Write access: unchanged boundary (engineering_manager/admin only) ────

test('junior_accountant, manager, cfo all get 403 on POST/PATCH/DELETE equipment', async (t) => {
  const created = await axios.post(
    `${BASE_URL}/api/engineering/assets/equipment`,
    { equipment_code: `TS-WRITE-BOUNDARY-${Date.now()}`, name: 'TEST SUITE - write boundary check' },
    adminHeaders
  );
  createdEquipmentIds.push(created.data.equipment_id);

  for (const [name, headers] of [['junior_accountant', jrHeaders], ['manager', managerHeaders], ['cfo', cfoHeaders]]) {
    await t.test(`${name}: POST is 403`, async () => {
      await assert.rejects(
        () => axios.post(`${BASE_URL}/api/engineering/assets/equipment`, { equipment_code: 'X', name: 'X' }, headers),
        (err) => err.response?.status === 403
      );
    });
    await t.test(`${name}: PATCH is 403`, async () => {
      await assert.rejects(
        () => axios.patch(`${BASE_URL}/api/engineering/assets/equipment/${created.data.equipment_id}`, { name: 'nope' }, headers),
        (err) => err.response?.status === 403
      );
    });
    await t.test(`${name}: DELETE is 403`, async () => {
      await assert.rejects(
        () => axios.delete(`${BASE_URL}/api/engineering/assets/equipment/${created.data.equipment_id}`, headers),
        (err) => err.response?.status === 403
      );
    });
  }
});

test('plain engineering role can read but still gets 403 on write (pre-existing boundary, unchanged by this session)', async () => {
  const readRes = await axios.get(`${BASE_URL}/api/engineering/assets/equipment`, engineeringHeaders);
  assert.equal(readRes.status, 200);

  await assert.rejects(
    () => axios.post(`${BASE_URL}/api/engineering/assets/equipment`, { equipment_code: 'X', name: 'X' }, engineeringHeaders),
    (err) => err.response?.status === 403
  );
});

// ── cost_usd: captured at creation, editable, visible in detail ─────────

test('admin (engineering_manager-tier) creates equipment with cost_usd captured at creation', async () => {
  const code = `TS-COST-${Date.now()}`;
  const createRes = await axios.post(
    `${BASE_URL}/api/engineering/assets/equipment`,
    { equipment_code: code, name: 'TEST SUITE - cost capture', cost_usd: 1234.56 },
    adminHeaders
  );
  createdEquipmentIds.push(createRes.data.equipment_id);
  assert.equal(createRes.status, 201);
  assert.equal(Number(createRes.data.cost_usd), 1234.56);

  const detailRes = await axios.get(`${BASE_URL}/api/engineering/assets/equipment/${createRes.data.equipment_id}`, jrHeaders);
  assert.equal(detailRes.status, 200);
  assert.equal(Number(detailRes.data.cost_usd), 1234.56);
});

test('admin edits equipment cost_usd via PATCH', async () => {
  const createRes = await axios.post(
    `${BASE_URL}/api/engineering/assets/equipment`,
    { equipment_code: `TS-EDIT-${Date.now()}`, name: 'TEST SUITE - edit check', cost_usd: 100 },
    adminHeaders
  );
  createdEquipmentIds.push(createRes.data.equipment_id);

  const patchRes = await axios.patch(
    `${BASE_URL}/api/engineering/assets/equipment/${createRes.data.equipment_id}`,
    { cost_usd: 200, status: 'DEGRADED' },
    adminHeaders
  );
  assert.equal(patchRes.status, 200);
  assert.equal(Number(patchRes.data.cost_usd), 200);
  assert.equal(patchRes.data.status, 'DEGRADED');
  // equipment_code untouched -- the PATCH body didn't include it.
  assert.equal(patchRes.data.equipment_code, createRes.data.equipment_code);
});

test('admin deletes equipment with no linked records successfully', async () => {
  const createRes = await axios.post(
    `${BASE_URL}/api/engineering/assets/equipment`,
    { equipment_code: `TS-DELETE-${Date.now()}`, name: 'TEST SUITE - delete check' },
    adminHeaders
  );
  const equipmentId = createRes.data.equipment_id;

  const deleteRes = await axios.delete(`${BASE_URL}/api/engineering/assets/equipment/${equipmentId}`, adminHeaders);
  assert.equal(deleteRes.status, 204);

  await assert.rejects(
    () => axios.get(`${BASE_URL}/api/engineering/assets/equipment/${equipmentId}`, adminHeaders),
    (err) => err.response?.status === 404
  );
});

test('GET /assets/equipment/:id for a nonexistent id is 404', async () => {
  await assert.rejects(
    () => axios.get(`${BASE_URL}/api/engineering/assets/equipment/00000000-0000-0000-0000-000000000000`, adminHeaders),
    (err) => err.response?.status === 404
  );
});
