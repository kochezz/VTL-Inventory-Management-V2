'use strict';

const express  = require('express');
const QRCode   = require('qrcode');
const router   = express.Router();

const { authenticate }            = require('../middleware/auth-middleware');
const { requireAttendanceAdmin,
        requireAttendanceManager } = require('../middleware/attendance-middleware');
const svc                          = require('../services/attendance-service');

// ─── Helper ───────────────────────────────────────────────────────────────────

function errResponse(res, err) {
  const status = err.status || 500;
  const body   = { message: err.message };
  if (err.code)               body.code               = err.code;
  if (err.minutes_remaining != null) body.minutes_remaining = err.minutes_remaining;
  if (err.attempts_remaining != null) body.attempts_remaining = err.attempts_remaining;
  return res.status(status).json(body);
}

// ─── PIN management (JWT-protected web-app routes) ────────────────────────────

// POST /api/attendance/pin/issue
// Admin issues a first-time 4-digit PIN to an employee.
// Body: { user_id, temp_pin }
router.post('/pin/issue', authenticate, requireAttendanceAdmin, async (req, res) => {
  try {
    const { user_id, temp_pin } = req.body;
    if (!user_id || !temp_pin) {
      return res.status(400).json({ message: 'user_id and temp_pin are required' });
    }
    await svc.issuePIN(user_id, temp_pin, req.user.user_id, req.ip);
    res.json({ message: 'PIN issued. Employee must change it before first punch.' });
  } catch (err) {
    errResponse(res, err);
  }
});

// POST /api/attendance/pin/reset
// Admin resets an existing PIN (employee is locked out, forgotten PIN, etc.)
// Body: { user_id, temp_pin }
router.post('/pin/reset', authenticate, requireAttendanceAdmin, async (req, res) => {
  try {
    const { user_id, temp_pin } = req.body;
    if (!user_id || !temp_pin) {
      return res.status(400).json({ message: 'user_id and temp_pin are required' });
    }
    await svc.resetPIN(user_id, temp_pin, req.user.user_id, req.ip);
    res.json({ message: 'PIN reset. Employee must change it before next punch.' });
  } catch (err) {
    errResponse(res, err);
  }
});

// POST /api/attendance/pin/change
// Authenticated employee changes their own PIN.
// Body: { old_pin, new_pin }
router.post('/pin/change', authenticate, async (req, res) => {
  try {
    const { old_pin, new_pin } = req.body;
    if (!old_pin || !new_pin) {
      return res.status(400).json({ message: 'old_pin and new_pin are required' });
    }
    await svc.changePIN(req.user.user_id, old_pin, new_pin, req.ip);
    res.json({ message: 'PIN changed successfully.' });
  } catch (err) {
    errResponse(res, err);
  }
});

// POST /api/attendance/pin/change-kiosk
// Kiosk-only PIN change — no JWT.  Used for the first-use interstitial when
// the server returns PIN_MUST_CHANGE after an admin issue/reset.
// Body: { badge_token|email_localpart, old_pin, new_pin }
router.post('/pin/change-kiosk', async (req, res) => {
  try {
    const { badge_token, email_localpart, old_pin, new_pin } = req.body;
    if (!old_pin || !new_pin) {
      return res.status(400).json({ message: 'old_pin and new_pin are required' });
    }
    const cred = await svc.resolveIdentifier({ badge_token, email_localpart });
    await svc.changePIN(cred.user_id, old_pin, new_pin, req.ip);
    res.json({ message: 'PIN changed successfully.' });
  } catch (err) {
    errResponse(res, err);
  }
});

// ─── Kiosk routes (no JWT — terminal + PIN auth) ──────────────────────────────

// POST /api/attendance/identify
// Resolves badge_token or email_localpart to worker name (no PIN required).
// Called immediately after QR scan so the kiosk can display the worker's name
// before PIN entry.  Returns only non-sensitive data: user_id + full_name.
router.post('/identify', async (req, res) => {
  try {
    const { badge_token, email_localpart } = req.body;
    const cred = await svc.resolveIdentifier({ badge_token, email_localpart });
    res.json({ user_id: cred.user_id, full_name: cred.full_name });
  } catch (err) {
    errResponse(res, err);
  }
});

// POST /api/attendance/punch
// Single online punch from a kiosk.
// Body: { device_code, badge_token|email_localpart, pin,
//         punch_type, photo_ref, client_uuid, punched_at?, notes? }
router.post('/punch', async (req, res) => {
  try {
    const {
      device_code, badge_token, email_localpart,
      pin, punch_type, photo_ref, client_uuid, punched_at, notes,
    } = req.body;

    if (!device_code)
      return res.status(400).json({ message: 'device_code is required' });
    if (!pin)
      return res.status(400).json({ message: 'pin is required' });
    if (!punch_type || !['clock_in', 'clock_out'].includes(punch_type))
      return res.status(400).json({ message: "punch_type must be 'clock_in' or 'clock_out'" });
    if (!photo_ref)
      return res.status(400).json({ message: 'photo_ref is required' });
    if (!client_uuid)
      return res.status(400).json({ message: 'client_uuid is required' });
    if (!badge_token && !email_localpart)
      return res.status(400).json({ message: 'badge_token or email_localpart is required' });

    const ip = req.ip || req.socket?.remoteAddress;

    const { terminal_id } = await svc.validateTerminal(device_code, ip);

    const { user_id, full_name, pin_must_change } = await svc.verifyPin(
      { badge_token, email_localpart },
      pin
    );

    if (pin_must_change) {
      return res.status(403).json({
        message:  'PIN must be changed before punching. Use /pin/change from the web app.',
        code:     'PIN_MUST_CHANGE',
        user_id,
        full_name,
      });
    }

    const entry_method = badge_token ? 'qr' : 'email';

    const result = await svc.recordPunch({
      user_id, terminal_id, punch_type, punched_at,
      entry_method, photo_ref, client_uuid, notes,
    });

    res.status(result.idempotent ? 200 : 201).json({
      message:      result.idempotent ? 'Already recorded (idempotent)' : 'Punch recorded',
      punch_id:     result.punch_id,
      client_uuid:  result.client_uuid,
      user_id,
      full_name,
      punch_type,
      entry_method,
    });
  } catch (err) {
    errResponse(res, err);
  }
});

// POST /api/attendance/sync
// Batch upload of offline-queued punches. Each punch must include a
// client_uuid for idempotency. Per-item status is returned.
// Body: { device_code, punches: Array<{ user_id, punch_type, punched_at,
//           entry_method, photo_ref, client_uuid, notes? }> }
router.post('/sync', async (req, res) => {
  try {
    const { device_code, punches } = req.body;

    if (!device_code)
      return res.status(400).json({ message: 'device_code is required' });
    if (!Array.isArray(punches) || punches.length === 0)
      return res.status(400).json({ message: 'punches must be a non-empty array' });

    const ip = req.ip || req.socket?.remoteAddress;
    const { terminal_id } = await svc.validateTerminal(device_code, ip);

    // Offline punches may carry badge_token/email_localpart instead of user_id
    // (stored in IndexedDB without server round-trip). Resolve them now.
    const withTerminal = await Promise.all(
      punches.map(async p => {
        let uid = p.user_id;
        if (!uid && (p.badge_token || p.email_localpart)) {
          try {
            const cred = await svc.resolveIdentifier({
              badge_token:     p.badge_token,
              email_localpart: p.email_localpart,
            });
            uid = cred.user_id;
          } catch (_) {}
        }
        return { ...p, user_id: uid, terminal_id };
      })
    );
    const results      = await svc.syncPunches(withTerminal);

    const accepted  = results.filter(r => r.status === 'accepted').length;
    const duplicate = results.filter(r => r.status === 'duplicate').length;
    const errors    = results.filter(r => r.status === 'error').length;

    res.json({ accepted, duplicate, errors, results });
  } catch (err) {
    errResponse(res, err);
  }
});

// ─── Badge QR issuance (JWT-protected, admin only) ───────────────────────────

// POST /api/attendance/badge/issue
// Generates a fresh badge QR for an employee, revoking any existing token.
// Response carries the QR as SVG plus human-readable fields; raw_token is
// intentionally ABSENT from the response body — it lives only inside the QR.
router.post('/badge/issue', authenticate, requireAttendanceAdmin, async (req, res) => {
  try {
    const { user_id } = req.body;
    if (!user_id) return res.status(400).json({ message: 'user_id is required' });

    const { raw_token, user } = await svc.issueBadgeToken(user_id, req.user.user_id, req.ip);

    // Encode only the raw token — no URL prefix, no human-readable identifier
    const qr_svg = await QRCode.toString(raw_token, {
      type:                 'svg',
      errorCorrectionLevel: 'M',
      margin:               2,
    });

    // raw_token is NOT included here; only the QR image carries it
    res.json({
      qr_svg,
      full_name:       user.full_name,
      employee_number: user.employee_number ?? null,
      job_title:       user.job_title       ?? null,
      photo_url:       user.photo_url        ?? null,
    });
  } catch (err) {
    errResponse(res, err);
  }
});

// ─── Web-app routes (JWT-protected) ───────────────────────────────────────────

// GET /api/attendance/team
// Direct reports of the authenticated user; admin sees all active users.
router.get('/team', authenticate, async (req, res) => {
  try {
    res.json(await svc.getTeam(req.user));
  } catch (err) { errResponse(res, err); }
});

// GET /api/attendance/employees
// All active users for the admin PIN management dropdown. Admin only.
router.get('/employees', authenticate, requireAttendanceAdmin, async (req, res) => {
  try {
    res.json(await svc.getEmployees());
  } catch (err) { errResponse(res, err); }
});

// GET /api/attendance/register/:userId?month=YYYY-MM
// Returns classified shifts and weekly rollups for one employee for one month.
// Access: own register (any role), or manager of that employee, or admin.
router.get('/register/:userId', authenticate, async (req, res) => {
  try {
    const { month } = req.query;
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return res.status(400).json({ message: "month query param must be 'YYYY-MM'" });
    }
    const data = await svc.getRegister(req.params.userId, month, req.user);
    res.json(data);
  } catch (err) {
    errResponse(res, err);
  }
});

// POST /api/attendance/adjustment
// Manager or admin corrects a punch record.
// Body: { punch_id?, user_id?, adjustment_type, corrected_punched_at?,
//         corrected_punch_type?, reason }
router.post('/adjustment', authenticate, requireAttendanceManager, async (req, res) => {
  try {
    const result = await svc.createAdjustment(req.body, req.user.user_id, req.ip);
    res.status(201).json(result);
  } catch (err) {
    errResponse(res, err);
  }
});

module.exports = router;
