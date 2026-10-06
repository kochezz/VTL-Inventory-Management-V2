'use strict';

// Session I. auth-routes.js's login route used to catch ANY error from
// authService.login() and return a flat 401 -- a real credential rejection
// and a transient DB connection/timeout failure were indistinguishable to
// the client. Now only a genuine InvalidCredentialsError (wrong email or
// wrong password) is 401; everything else is 503. Real HTTP calls against
// a running dev server -- see backend/tests/README.md.

const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const axios = require('axios');

const { BASE_URL, assertServerReachable } = require('./helpers/test-helper');

before(async () => {
  await assertServerReachable();
});

test('wrong password is a real credential failure -> 401', async () => {
  await assert.rejects(
    () => axios.post(`${BASE_URL}/api/auth/login`, {
      email: process.env.TEST_ADMIN_EMAIL,
      password: 'definitely-the-wrong-password',
    }),
    (err) => {
      assert.equal(err.response?.status, 401);
      assert.equal(err.response.data.message, 'Invalid credentials');
      return true;
    }
  );
});

test('unknown email is a real credential failure -> 401', async () => {
  await assert.rejects(
    () => axios.post(`${BASE_URL}/api/auth/login`, {
      email: `no-such-user-${Date.now()}@vilag.io`,
      password: 'whatever',
    }),
    (err) => {
      assert.equal(err.response?.status, 401);
      assert.equal(err.response.data.message, 'Invalid credentials');
      return true;
    }
  );
});

test('an infrastructure failure inside login() -> 503, not 401', async () => {
  const forceRes = await axios.post(`${BASE_URL}/api/_test/force-login-error`, {
    message: 'Connection terminated due to connection timeout',
  });
  assert.equal(forceRes.status, 200);

  await assert.rejects(
    () => axios.post(`${BASE_URL}/api/auth/login`, {
      email: process.env.TEST_ADMIN_EMAIL,
      password: process.env.TEST_ADMIN_PASSWORD,
    }),
    (err) => {
      assert.equal(err.response?.status, 503, 'an infra failure must be 503, not 401');
      assert.equal(err.response.data.detail, 'Connection terminated due to connection timeout');
      return true;
    }
  );
});

test('the forced error is one-shot -- the very next login attempt succeeds normally', async () => {
  const res = await axios.post(`${BASE_URL}/api/auth/login`, {
    email: process.env.TEST_ADMIN_EMAIL,
    password: process.env.TEST_ADMIN_PASSWORD,
  });
  assert.equal(res.status, 200);
  assert.ok(res.data.token);
});
