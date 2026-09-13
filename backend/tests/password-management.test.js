'use strict';

// Checked-in port of the password-decoupling session's verification tests.
// Real HTTP calls against a running dev server, real DB -- see
// backend/tests/README.md.

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const axios = require('axios');

const {
  BASE_URL,
  assertServerReachable,
  login,
  authHeaders,
  getUserRow,
} = require('./helpers/test-helper');

let adminToken, adminHeaders;
let disposableUserId, disposableEmail;

before(async () => {
  await assertServerReachable();
  adminToken = await login(process.env.TEST_ADMIN_EMAIL, process.env.TEST_ADMIN_PASSWORD);
  adminHeaders = authHeaders(adminToken);

  // One disposable synthetic user shared across this file's tests --
  // deliberately not a real employee account, same reasoning as
  // role-permissions.test.js.
  disposableEmail = `test-suite-pwd-${Date.now()}@vilag.io`;
  const createRes = await axios.post(
    `${BASE_URL}/api/users`,
    {
      email: disposableEmail,
      full_name: 'Test Suite Password Disposable User',
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
});

after(async () => {
  if (disposableUserId) {
    await axios.delete(`${BASE_URL}/api/users/${disposableUserId}`, adminHeaders).catch(() => {});
  }
});

test('Update Profile with no password fields sent leaves password_hash unchanged', async () => {
  const beforeRow = await getUserRow(disposableUserId);

  // Mirrors what handleEditUser actually sends post-decoupling: profile
  // fields only, no password/tempPassword/requires_password_change/
  // forcePasswordChange anywhere in the payload.
  const putRes = await axios.put(
    `${BASE_URL}/api/users/${disposableUserId}`,
    {
      full_name: 'Test Suite Password Disposable User',
      phone_number: '0000000000',
      role: 'junior_accountant',
      department: 'Finance',
      job_title: 'Junior Accountant',
      reports_to: 'Test Suite',
    },
    adminHeaders
  );
  assert.equal(putRes.status, 200);

  const afterRow = await getUserRow(disposableUserId);
  assert.equal(afterRow.password_hash, beforeRow.password_hash, 'password_hash must be unchanged by a profile-only edit');
});

test('Set Password with fewer than 8 characters gets 400', async () => {
  await assert.rejects(
    () => axios.patch(
      `${BASE_URL}/api/users/${disposableUserId}/password`,
      { temporaryPassword: 'short', forcePasswordChange: true },
      adminHeaders
    ),
    (err) => {
      assert.equal(err.response?.status, 400);
      assert.match(err.response.data.message, /8 characters/i);
      return true;
    }
  );
});

test('full round-trip: set password -> login with it -> role/other fields unchanged -> requires_password_change reflected', async () => {
  const beforeRow = await getUserRow(disposableUserId);

  const setPassRes = await axios.patch(
    `${BASE_URL}/api/users/${disposableUserId}/password`,
    { temporaryPassword: 'RoundTripPass789!', forcePasswordChange: true },
    adminHeaders
  );
  assert.equal(setPassRes.status, 200);

  const loginRes = await axios.post(`${BASE_URL}/api/auth/login`, {
    email: disposableEmail,
    password: 'RoundTripPass789!',
  });
  assert.equal(loginRes.status, 200);
  assert.equal(loginRes.data.user.role, beforeRow.role);
  assert.equal(loginRes.data.user.department, beforeRow.department);
  assert.equal(loginRes.data.user.job_title, beforeRow.job_title);
  assert.equal(loginRes.data.user.reports_to, beforeRow.reports_to);
  assert.equal(loginRes.data.user.requires_password_change, true,
    'requires_password_change should reflect the forcePasswordChange:true passed to Set Password');
});
