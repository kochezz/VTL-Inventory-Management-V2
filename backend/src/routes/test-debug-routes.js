'use strict';

// Test-only debug route, mounted in server.js ONLY when MOCK_EMAIL_TRANSPORT
// is on -- it doesn't exist at all otherwise, so it's not an attack surface
// in a normal/production run. Exists so the test process (a separate
// `node --test` process, not the server) can read what notification-service's
// mocked sendEmail() recorded, over the same real-HTTP pattern the test
// suite already uses for polling Resend's history.

const express = require('express');
const router = express.Router();
const NotificationService = require('../services/notification-service');
const authService = require('../services/auth-service');

router.get('/email-log', (req, res) => {
  res.json({ emails: NotificationService.getMockEmailLog() });
});

// Lets the test process confirm the SERVER it's driving over HTTP -- not
// just its own separate DB pool -- is actually pointed at the test
// database, not production. Returns only the host, never credentials/db
// name; still only exists at all when MOCK_EMAIL_TRANSPORT is on, same as
// this whole router. Closes a real gap: test-helper.js's own safety guard
// protects its own pool.query() calls, but every HTTP-driven test action
// (category creation, approval, etc.) runs against whatever server happens
// to be listening on BASE_URL -- which could be a plain `npm run dev`
// (real .env, no mock) someone forgot was still running.
router.get('/db-host', (req, res) => {
  try {
    res.json({ host: new URL(process.env.DATABASE_URL).host });
  } catch {
    res.status(500).json({ host: null });
  }
});

// Session I: forces authService.login()'s NEXT call to throw a plain
// (non-credential) error, so the test suite can verify auth-routes.js
// returns 503 for an infrastructure failure rather than 401 -- against the
// real running server process, not a pool.query mock the server never sees.
router.post('/force-login-error', (req, res) => {
  authService.setTestForceNextLoginError(req.body?.message || 'Simulated connection timeout');
  res.json({ ok: true });
});

module.exports = router;
