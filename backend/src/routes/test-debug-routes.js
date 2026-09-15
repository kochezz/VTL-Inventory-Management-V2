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

router.get('/email-log', (req, res) => {
  res.json({ emails: NotificationService.getMockEmailLog() });
});

module.exports = router;
