'use strict';

// Checked-in port of the Phase 1.5 / password-decoupling session's role-drift
// and permission-boundary tests. Real HTTP calls against a running dev
// server, real DB -- see backend/tests/README.md.

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const axios = require('axios');

const {
  BASE_URL,
  assertServerReachable,
  login,
  authHeaders,
  signTokenForRole,
  getUserRow,
} = require('./helpers/test-helper');

let adminToken, adminHeaders;
let jrToken, jrHeaders;
let managerToken, managerHeaders;
let disposableUserId;

before(async () => {
  await assertServerReachable();
  adminToken = await login(process.env.TEST_ADMIN_EMAIL, process.env.TEST_ADMIN_PASSWORD);
  adminHeaders = authHeaders(adminToken);

  ({ token: jrToken } = await signTokenForRole('junior_accountant'));
  jrHeaders = authHeaders(jrToken);

  ({ token: managerToken } = await signTokenForRole('manager'));
  managerHeaders = authHeaders(managerToken);
});

after(async () => {
  if (disposableUserId) {
    await axios.delete(`${BASE_URL}/api/users/${disposableUserId}`, adminHeaders).catch(() => {});
  }
});

test('junior_accountant is rejected (403) on a cfo/ceo/admin-only route', async () => {
  // PUT /api/products/pricing is authorize(['admin','ceo','cfo']) --
  // junior_accountant must never be in that list.
  await assert.rejects(
    () => axios.put(`${BASE_URL}/api/products/pricing`, { updates: [] }, jrHeaders),
    (err) => err.response?.status === 403
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

  await t.test('still has no cfo-only access (products pricing stays 403)', async () => {
    await assert.rejects(
      () => axios.put(`${BASE_URL}/api/products/pricing`, { updates: [] }, jrHeaders),
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
