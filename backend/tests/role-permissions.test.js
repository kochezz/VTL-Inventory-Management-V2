'use strict';

// Checked-in port of the Phase 1.5 / password-decoupling session's role-drift
// and permission-boundary tests. Real HTTP calls against a running dev
// server, real DB -- see backend/tests/README.md.

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
  getUserRow,
} = require('./helpers/test-helper');

let adminToken, adminHeaders;
let jrToken, jrHeaders, jrUser;
let managerToken, managerHeaders;
let disposableUserId;
let vendorId, customerId, otherEmployeeId;

before(async () => {
  await assertServerReachable();
  adminToken = await login(process.env.TEST_ADMIN_EMAIL, process.env.TEST_ADMIN_PASSWORD);
  adminHeaders = authHeaders(adminToken);

  ({ token: jrToken, user: jrUser } = await signTokenForRole('junior_accountant'));
  jrHeaders = authHeaders(jrToken);

  ({ token: managerToken } = await signTokenForRole('manager'));
  managerHeaders = authHeaders(managerToken);

  // A real, active, non-junior_accountant user to prove "another employee's
  // record fails" for Attendance -- found live, not hardcoded.
  const other = await pool.query(
    `SELECT user_id FROM users WHERE role != 'junior_accountant' AND is_active = true LIMIT 1`
  );
  otherEmployeeId = other.rows[0]?.user_id;
});

after(async () => {
  if (disposableUserId) {
    await axios.delete(`${BASE_URL}/api/users/${disposableUserId}`, adminHeaders).catch(() => {});
  }
  if (vendorId) {
    await pool.query(`DELETE FROM vendors WHERE vendor_id = $1`, [vendorId]).catch(() => {});
  }
  if (customerId) {
    await pool.query(`DELETE FROM customers WHERE customer_id = $1`, [customerId]).catch(() => {});
  }
});

// INVERTED 2026-09-18 (Finance Access Expansion session): PUT
// /api/products/pricing's authorize() now includes junior_accountant --
// this was the "cfo/ceo/admin-only route" this test was named after, and
// that description is no longer true. The boundary this test originally
// protected (junior_accountant must never reach this route) has been
// deliberately moved, not eroded by accident -- see
// role-permissions.test.js's new "manager still blocked from Products +
// Pricing writes" test below for the boundary that must NOT move.
test('junior_accountant CAN now reach PUT /api/products/pricing (Finance Access Expansion), but still needs a reason', async () => {
  await assert.rejects(
    () => axios.put(`${BASE_URL}/api/products/pricing`, { products: [] }, jrHeaders),
    (err) => err.response?.status === 400 && /reason/i.test(err.response?.data?.message || '')
  );
});

test('junior_accountant can reach dashboard and mobile ping (Phase 1.5 exception), but retains no cfo-only access', async (t) => {
  // Phase 1.5 deliberately added junior_accountant to dashboard-routes.js's
  // authorize() arrays and mobile-routes.js's MOBILE_ALLOWED_ROLES as an
  // explicit exception -- but NOT to mobile-routes.js's APPROVERS array
  // (QMS NCR/CAPA/document approval), which was left untouched on purpose.
  await t.test('dashboard/stats is reachable (200)', async () => {
    const res = await axios.get(`${BASE_URL}/api/dashboard/stats`, jrHeaders);
    assert.equal(res.status, 200);
  });

  await t.test('mobile/ping is reachable (200)', async () => {
    const res = await axios.get(`${BASE_URL}/api/mobile/ping`, jrHeaders);
    assert.equal(res.status, 200);
    assert.equal(res.data.ok, true);
  });

  // INVERTED 2026-09-18 (Finance Access Expansion session): products
  // pricing is no longer a valid "still cfo-only" example -- junior_accountant
  // was deliberately given that route in this same session. Swapped for
  // POST /sales/exchange-rate, which junior_accountant was never granted
  // and still isn't (Finance Access Expansion's Step 1 only added ceo to
  // that route's authorize() array) -- this keeps the sub-test's original
  // intent intact: proving Phase 1.5's dashboard/mobile grant was narrow
  // and didn't cascade into unrelated finance-admin capabilities.
  await t.test('still has no exchange-rate access (POST /sales/exchange-rate stays 403)', async () => {
    await assert.rejects(
      () => axios.post(`${BASE_URL}/api/sales/exchange-rate`, { rate_value: 27 }, jrHeaders),
      (err) => err.response?.status === 403
    );
  });
});

test('a manager gets 403 on PATCH /api/users/:id/password', async () => {
  // The route is nested under router.use(authorize('admin')) in
  // users-routes.js -- strictly admin-only, not admin+cfo+ceo. Target user
  // id doesn't matter: the 403 must fire before the handler runs at all.
  await assert.rejects(
    () => axios.patch(
      `${BASE_URL}/api/users/00000000-0000-0000-0000-000000000000/password`,
      { temporaryPassword: 'ShouldNotWork1', forcePasswordChange: true },
      managerHeaders
    ),
    (err) => {
      assert.equal(err.response?.status, 403);
      assert.match(err.response.data.message, /admin/i);
      return true;
    }
  );
});

test('the password endpoint changes only password_hash and requires_password_change', async () => {
  // Disposable synthetic user -- deliberately NOT a real employee account,
  // so this test's side effect (an actual password change) never touches
  // anyone's real credentials, unlike the ad hoc chat-session version of
  // this test which reset Jeremiah's real password.
  const email = `test-suite-${Date.now()}@vilag.io`;
  const createRes = await axios.post(
    `${BASE_URL}/api/users`,
    {
      email,
      full_name: 'Test Suite Disposable User',
      password: 'InitialPass123!',
      role: 'junior_accountant',
      is_active: true,
      department: 'Finance',
      job_title: 'Junior Accountant',
      reports_to: 'Test Suite',
    },
    adminHeaders
  );
  disposableUserId = createRes.data.user_id;

  const before = await getUserRow(disposableUserId);

  const setPassRes = await axios.patch(
    `${BASE_URL}/api/users/${disposableUserId}/password`,
    { temporaryPassword: 'NewSuitePass456!', forcePasswordChange: true },
    adminHeaders
  );
  assert.equal(setPassRes.status, 200);

  const afterRow = await getUserRow(disposableUserId);

  assert.notEqual(afterRow.password_hash, before.password_hash, 'password_hash should have changed');
  assert.equal(afterRow.requires_password_change, true);
  assert.equal(afterRow.role, before.role, 'role must be unchanged');
  assert.equal(afterRow.department, before.department, 'department must be unchanged');
  assert.equal(afterRow.job_title, before.job_title, 'job_title must be unchanged');
  assert.equal(afterRow.reports_to, before.reports_to, 'reports_to must be unchanged');

  // And the new password actually works.
  const loginRes = await axios.post(`${BASE_URL}/api/auth/login`, { email, password: 'NewSuitePass456!' });
  assert.equal(loginRes.status, 200);
  assert.equal(loginRes.data.user.role, 'junior_accountant');
});

// ── Junior Accountant Access Expansion (per-module pass + regression checks) ──

test('Vendor Management: junior_accountant can create/edit a vendor, still cannot approve', async (t) => {
  await t.test('POST /api/suppliers succeeds', async () => {
    const res = await axios.post(
      `${BASE_URL}/api/suppliers`,
      { legal_name: 'TEST SUITE Vendor Access Check', registered_address: '1 Test St', primary_category: 'RAW' },
      jrHeaders
    );
    assert.equal(res.status, 201);
    vendorId = res.data.vendor_id;
  });

  await t.test('PUT /api/suppliers/:id succeeds', async () => {
    const res = await axios.put(
      `${BASE_URL}/api/suppliers/${vendorId}`,
      { legal_name: 'TEST SUITE Vendor Access Check (edited)', registered_address: '1 Test St', primary_category: 'RAW' },
      jrHeaders
    );
    assert.equal(res.status, 200);
  });

  await t.test('POST /:id/approve still 403 (unchanged)', async () => {
    await assert.rejects(
      () => axios.post(`${BASE_URL}/api/suppliers/${vendorId}/approve`, {}, jrHeaders),
      (err) => err.response?.status === 403
    );
  });
});

test('CRM: junior_accountant can create a customer, still cannot approve', async (t) => {
  await t.test('POST /api/customers succeeds', async () => {
    const res = await axios.post(
      `${BASE_URL}/api/customers`,
      {
        trading_name: 'TEST SUITE Customer Access Check',
        legal_name: 'TEST SUITE Customer Access Check Ltd',
        tpin: '1234567890',
        business_type: 'Retail',
        tier_name: 'Retail',
        payment_terms: 'COD',
        territory: 'Test Territory',
      },
      jrHeaders
    );
    assert.equal(res.status, 201);
    customerId = res.data.customer_id;
  });

  await t.test('POST /:id/approve still 403 (never granted -- regression guard)', async () => {
    await assert.rejects(
      () => axios.post(`${BASE_URL}/api/customers/${customerId}/approve`, {}, jrHeaders),
      (err) => err.response?.status === 403
    );
  });
});

test('Purchase Orders: junior_accountant passes the authorization gate on create, still cannot approve', async (t) => {
  await t.test('POST /api/pos is NOT 403 (passes auth; may still 400 on business validation)', async () => {
    let status;
    try {
      const res = await axios.post(`${BASE_URL}/api/pos`, { vendor_id: '00000000-0000-0000-0000-000000000000' }, jrHeaders);
      status = res.status;
    } catch (err) {
      status = err.response?.status;
    }
    assert.notEqual(status, 403, `expected NOT 403 (proving the authorize() gate let junior_accountant through), got ${status}`);
  });

  await t.test('POST /:id/approve still 403 (unchanged)', async () => {
    await assert.rejects(
      () => axios.post(`${BASE_URL}/api/pos/00000000-0000-0000-0000-000000000000/approve`, {}, jrHeaders),
      (err) => err.response?.status === 403
    );
  });
});

test('Goods Receipt: junior_accountant passes the authorization gate on create', async () => {
  let status;
  try {
    const res = await axios.post(`${BASE_URL}/api/grns`, { po_id: '00000000-0000-0000-0000-000000000000', items: [] }, jrHeaders);
    status = res.status;
  } catch (err) {
    status = err.response?.status;
  }
  assert.notEqual(status, 403, `expected NOT 403 (proving the authorize() gate let junior_accountant through), got ${status}`);
});

test('Sales/POS: junior_accountant can reach GET /api/sales/sessions', async () => {
  const res = await axios.get(`${BASE_URL}/api/sales/sessions`, jrHeaders);
  assert.equal(res.status, 200);
});

test('Inventory: junior_accountant passes the authorization gate on POST /check-availability, POST /transactions still 403', async (t) => {
  await t.test('POST /check-availability is NOT 403', async () => {
    let status;
    try {
      const res = await axios.post(
        `${BASE_URL}/api/inventory/check-availability`,
        { product_id: '00000000-0000-0000-0000-000000000000', location_id: '00000000-0000-0000-0000-000000000000', required_quantity: 1 },
        jrHeaders
      );
      status = res.status;
    } catch (err) {
      status = err.response?.status;
    }
    assert.notEqual(status, 403, `expected NOT 403, got ${status}`);
  });

  await t.test('POST /transactions still 403 (its own independent array, untouched)', async () => {
    await assert.rejects(
      () => axios.post(`${BASE_URL}/api/inventory/transactions`, {}, jrHeaders),
      (err) => err.response?.status === 403
    );
  });
});

test('QMS: junior_accountant can reach all 7 newly-granted GET routes; the open write surface is unchanged (still open, no new regression)', async (t) => {
  const getRoutes = [
    '/api/qms/compliance',
    '/api/qms/review-tasks',
  ];
  for (const route of getRoutes) {
    await t.test(`${route} is reachable (200)`, async () => {
      const res = await axios.get(`${BASE_URL}${route}`, jrHeaders);
      assert.equal(res.status, 200);
    });
  }

  await t.test('/api/qms/documents/next-code is NOT 403 (400 without query params is expected/correct, not a grant failure)', async () => {
    let status;
    try {
      const res = await axios.get(`${BASE_URL}/api/qms/documents/next-code`, jrHeaders);
      status = res.status;
    } catch (err) {
      status = err.response?.status;
    }
    assert.notEqual(status, 403, `expected NOT 403, got ${status}`);
  });

  await t.test('GET /documents/:id/inspector, /pdf, /assembled are NOT 403 (id is fake, so 404/500 is fine -- 403 would mean the grant failed)', async () => {
    for (const route of [
      '/api/qms/documents/00000000-0000-0000-0000-000000000000/inspector',
      '/api/qms/documents/00000000-0000-0000-0000-000000000000/pdf',
      '/api/qms/documents/00000000-0000-0000-0000-000000000000/assembled',
      '/api/qms/versions/00000000-0000-0000-0000-000000000000/assembled',
    ]) {
      let status;
      try {
        const res = await axios.get(`${BASE_URL}${route}`, jrHeaders);
        status = res.status;
      } catch (err) {
        status = err.response?.status;
      }
      assert.notEqual(status, 403, `${route} expected NOT 403, got ${status}`);
    }
  });

  await t.test('the ~15 previously-open write routes remain open (no accidental new restriction) -- spot check POST /ncrs', async () => {
    // Deliberately NOT restricted this session (locked decision) -- this is
    // a "confirm nothing broke" check, not a "confirm it's blocked" check.
    let status;
    try {
      const res = await axios.post(`${BASE_URL}/api/qms/ncrs`, {}, jrHeaders);
      status = res.status;
    } catch (err) {
      status = err.response?.status;
    }
    assert.notEqual(status, 403, `POST /ncrs must remain open to junior_accountant (unchanged) -- got ${status}`);
  });

  await t.test('the genuine approval/sign-off routes remain 403 for junior_accountant', async () => {
    await assert.rejects(
      () => axios.post(`${BASE_URL}/api/qms/versions/00000000-0000-0000-0000-000000000000/approve`, {}, jrHeaders),
      (err) => err.response?.status === 403
    );
    await assert.rejects(
      () => axios.post(`${BASE_URL}/api/qms/versions/00000000-0000-0000-0000-000000000000/sign-off`, {}, jrHeaders),
      (err) => err.response?.status === 403
    );
  });
});

test('Attendance: own record succeeds, another employee\'s record fails, GET /team fails', async (t) => {
  await t.test('own register succeeds (200)', async () => {
    const res = await axios.get(`${BASE_URL}/api/attendance/register/${jrUser.user_id}?month=2026-09`, jrHeaders);
    assert.equal(res.status, 200);
  });

  await t.test('another employee\'s register fails (403)', async () => {
    assert.ok(otherEmployeeId, 'expected to find at least one other active, non-junior_accountant user');
    await assert.rejects(
      () => axios.get(`${BASE_URL}/api/attendance/register/${otherEmployeeId}?month=2026-09`, jrHeaders),
      (err) => err.response?.status === 403
    );
  });

  await t.test('GET /team fails (403)', async () => {
    await assert.rejects(
      () => axios.get(`${BASE_URL}/api/attendance/team`, jrHeaders),
      (err) => err.response?.status === 403
    );
  });
});
