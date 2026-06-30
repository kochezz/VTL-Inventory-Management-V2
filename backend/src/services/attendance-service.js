'use strict';

const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { pool } = require('./auth-service');
const { classifyHours } = require('./attendance-hours');

const BCRYPT_ROUNDS = 10;
const PIN_LOCK_MAX  = 5;
const PIN_LOCK_MINS = 15;
const EMAIL_DOMAIN  = '@vilag.io';

// ─── Audit helper ─────────────────────────────────────────────────────────────
// `client` must expose .query() — pass a pool client inside transactions,
// or pool directly for standalone writes.
// This is the first module to write to audit_log; keep it clean so it becomes
// the reference pattern for future modules.

async function writeAudit(client, {
  table_name,
  record_id,
  action,
  old_values    = null,
  new_values    = null,
  changed_fields = null,
  performed_by,
  ip_address    = null,
}) {
  await client.query(
    `INSERT INTO audit_log
       (table_name, record_id, action, old_values, new_values,
        changed_fields, performed_by, ip_address)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      table_name,
      record_id,
      action,
      old_values    !== null ? JSON.stringify(old_values)  : null,
      new_values    !== null ? JSON.stringify(new_values)  : null,
      changed_fields,
      performed_by,
      ip_address || null,
    ]
  );
}

// ─── Credential row helper ─────────────────────────────────────────────────────
// Fetches the attendance_credentials row for a user_id, joined with u.full_name
// and u.is_active.  Returns null if no credential row exists yet.

async function _credByUserId(user_id) {
  const { rows } = await pool.query(
    `SELECT c.credential_id, c.user_id, c.pin_hash, c.badge_token,
            c.pin_failed_attempts, c.pin_locked_until, c.pin_must_change,
            u.full_name, u.is_active
     FROM attendance_credentials c
     JOIN users u ON u.user_id = c.user_id
     WHERE c.user_id = $1`,
    [user_id]
  );
  return rows[0] || null;
}

// ─── Identity resolution ───────────────────────────────────────────────────────
// Returns the credential+user row for PIN verification.
// badge_token → attendance_credentials.badge_token lookup
// email_localpart → users.email lookup, then credential lookup

async function resolveIdentifier({ badge_token, email_localpart }) {
  if (!badge_token && !email_localpart) {
    const e = new Error('badge_token or email_localpart is required');
    e.status = 400;
    throw e;
  }

  let cred;

  if (badge_token) {
    const { rows } = await pool.query(
      `SELECT c.credential_id, c.user_id, c.pin_hash, c.badge_token,
              c.pin_failed_attempts, c.pin_locked_until, c.pin_must_change,
              u.full_name, u.is_active
       FROM attendance_credentials c
       JOIN users u ON u.user_id = c.user_id
       WHERE c.badge_token = $1`,
      [badge_token]
    );
    cred = rows[0];
  } else {
    const email = email_localpart.trim().toLowerCase() + EMAIL_DOMAIN;
    const { rows: urows } = await pool.query(
      'SELECT user_id, full_name, is_active FROM users WHERE email = $1',
      [email]
    );
    if (!urows[0]) {
      const e = new Error('User not found');
      e.status = 404;
      throw e;
    }
    // Credential row may not exist yet (no PIN issued)
    const row = await _credByUserId(urows[0].user_id);
    cred = row
      ? row
      : { ...urows[0], credential_id: null, pin_hash: null,
          pin_failed_attempts: 0, pin_locked_until: null, pin_must_change: false };
  }

  if (!cred) {
    const e = new Error('User not found');
    e.status = 404;
    throw e;
  }
  if (!cred.is_active) {
    const e = new Error('Account is inactive');
    e.status = 403;
    throw e;
  }
  return cred;
}

// ─── PIN verification ──────────────────────────────────────────────────────────
// Enforces lockout, verifies bcrypt, resets counter on success.
// On success returns { user_id, full_name, pin_must_change }.

async function verifyPin({ badge_token, email_localpart }, pin) {
  const cred = await resolveIdentifier({ badge_token, email_localpart });

  if (cred.pin_locked_until && new Date(cred.pin_locked_until) > new Date()) {
    const mins = Math.ceil((new Date(cred.pin_locked_until) - Date.now()) / 60_000);
    const e = new Error(`Account locked. Try again in ${mins} minute${mins !== 1 ? 's' : ''}.`);
    e.status = 423; e.code = 'PIN_LOCKED'; e.minutes_remaining = mins;
    throw e;
  }

  if (!cred.pin_hash) {
    const e = new Error('PIN not set. Contact admin.');
    e.status = 403; e.code = 'PIN_NOT_SET';
    throw e;
  }

  const valid = await bcrypt.compare(String(pin), cred.pin_hash);

  if (!valid) {
    const attempts = (cred.pin_failed_attempts || 0) + 1;

    if (attempts >= PIN_LOCK_MAX) {
      await pool.query(
        `UPDATE attendance_credentials
         SET pin_failed_attempts = 0,
             pin_locked_until    = NOW() + ($1 * INTERVAL '1 minute'),
             updated_at          = NOW()
         WHERE user_id = $2`,
        [PIN_LOCK_MINS, cred.user_id]
      );
      const e = new Error(`Too many failed attempts. Account locked for ${PIN_LOCK_MINS} minutes.`);
      e.status = 423; e.code = 'PIN_LOCKED'; e.minutes_remaining = PIN_LOCK_MINS;
      throw e;
    }

    await pool.query(
      'UPDATE attendance_credentials SET pin_failed_attempts = $1, updated_at = NOW() WHERE user_id = $2',
      [attempts, cred.user_id]
    );
    const remaining = PIN_LOCK_MAX - attempts;
    const e = new Error(`Invalid PIN. ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining.`);
    e.status = 401; e.code = 'INVALID_PIN'; e.attempts_remaining = remaining;
    throw e;
  }

  // Success — reset counter
  await pool.query(
    'UPDATE attendance_credentials SET pin_failed_attempts = 0, pin_locked_until = NULL, updated_at = NOW() WHERE user_id = $1',
    [cred.user_id]
  );

  return { user_id: cred.user_id, full_name: cred.full_name, pin_must_change: cred.pin_must_change };
}

// ─── PIN issue / reset (admin) ─────────────────────────────────────────────────
// UPSERTs into attendance_credentials; always sets pin_must_change = TRUE.

async function _setPinAdmin(target_user_id, temp_pin, performed_by, ip_address, action_label) {
  if (!/^\d{4}$/.test(String(temp_pin))) {
    const e = new Error('PIN must be exactly 4 digits (0–9)');
    e.status = 400;
    throw e;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      'SELECT user_id FROM users WHERE user_id = $1',
      [target_user_id]
    );
    if (!rows[0]) {
      const e = new Error('User not found');
      e.status = 404;
      throw e;
    }

    const now      = new Date();
    const new_hash = await bcrypt.hash(String(temp_pin), BCRYPT_ROUNDS);

    await client.query(
      `INSERT INTO attendance_credentials
         (user_id, pin_hash, pin_must_change, pin_failed_attempts,
          pin_locked_until, pin_set_at, updated_at)
       VALUES ($1, $2, TRUE, 0, NULL, $3, $3)
       ON CONFLICT (user_id) DO UPDATE
       SET pin_hash            = EXCLUDED.pin_hash,
           pin_must_change     = TRUE,
           pin_failed_attempts = 0,
           pin_locked_until    = NULL,
           pin_set_at          = EXCLUDED.pin_set_at,
           updated_at          = EXCLUDED.updated_at`,
      [target_user_id, new_hash, now]
    );

    await writeAudit(client, {
      table_name:    'attendance_credentials',
      record_id:     target_user_id,
      action:        'UPDATE',
      new_values:    { pin_must_change: true, via: action_label },
      changed_fields: ['pin_hash', 'pin_must_change', 'pin_failed_attempts', 'pin_locked_until'],
      performed_by,
      ip_address,
    });

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function issuePIN(target_user_id, temp_pin, performed_by, ip_address) {
  return _setPinAdmin(target_user_id, temp_pin, performed_by, ip_address, 'pin_issue');
}

async function resetPIN(target_user_id, temp_pin, performed_by, ip_address) {
  return _setPinAdmin(target_user_id, temp_pin, performed_by, ip_address, 'pin_reset');
}

// ─── PIN change (user self-service via JWT session) ────────────────────────────
// Verifies old PIN against attendance_credentials, enforces lockout,
// then updates the hash and clears pin_must_change.

async function changePIN(user_id, old_pin, new_pin, ip_address) {
  if (!/^\d{4}$/.test(String(new_pin))) {
    const e = new Error('New PIN must be exactly 4 digits (0–9)');
    e.status = 400;
    throw e;
  }

  const cred = await _credByUserId(user_id);
  if (!cred) {
    const e = new Error('No PIN set. Ask an admin to issue one first.');
    e.status = 403;
    throw e;
  }

  if (cred.pin_locked_until && new Date(cred.pin_locked_until) > new Date()) {
    const mins = Math.ceil((new Date(cred.pin_locked_until) - Date.now()) / 60_000);
    const e = new Error(`Account locked. Try again in ${mins} minute${mins !== 1 ? 's' : ''}.`);
    e.status = 423; e.code = 'PIN_LOCKED'; e.minutes_remaining = mins;
    throw e;
  }

  const valid = await bcrypt.compare(String(old_pin), cred.pin_hash);

  if (!valid) {
    const attempts = (cred.pin_failed_attempts || 0) + 1;
    if (attempts >= PIN_LOCK_MAX) {
      await pool.query(
        `UPDATE attendance_credentials
         SET pin_failed_attempts = 0,
             pin_locked_until    = NOW() + ($1 * INTERVAL '1 minute'),
             updated_at          = NOW()
         WHERE user_id = $2`,
        [PIN_LOCK_MINS, user_id]
      );
      const e = new Error(`Too many failed attempts. Account locked for ${PIN_LOCK_MINS} minutes.`);
      e.status = 423; e.code = 'PIN_LOCKED'; e.minutes_remaining = PIN_LOCK_MINS;
      throw e;
    }
    await pool.query(
      'UPDATE attendance_credentials SET pin_failed_attempts = $1, updated_at = NOW() WHERE user_id = $2',
      [attempts, user_id]
    );
    const e = new Error('Old PIN is incorrect');
    e.status = 401; e.code = 'INVALID_PIN'; e.attempts_remaining = PIN_LOCK_MAX - attempts;
    throw e;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const new_hash = await bcrypt.hash(String(new_pin), BCRYPT_ROUNDS);
    await client.query(
      `UPDATE attendance_credentials
       SET pin_hash = $1, pin_must_change = FALSE,
           pin_failed_attempts = 0, pin_locked_until = NULL, updated_at = NOW()
       WHERE user_id = $2`,
      [new_hash, user_id]
    );
    await writeAudit(client, {
      table_name:    'attendance_credentials',
      record_id:     user_id,
      action:        'UPDATE',
      old_values:    { pin_must_change: cred.pin_must_change },
      new_values:    { pin_must_change: false, via: 'pin_change' },
      changed_fields: ['pin_hash', 'pin_must_change', 'pin_failed_attempts'],
      performed_by:   user_id,
      ip_address,
    });
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ─── Terminal validation ───────────────────────────────────────────────────────
// allowed_ip is VARCHAR — NULL or empty = unrestricted; otherwise exact match.
// Returns { terminal_id, terminal_name }.

async function validateTerminal(device_code, ip_address) {
  const { rows } = await pool.query(
    `SELECT terminal_id, facility, location_description, allowed_ip
     FROM attendance_terminals
     WHERE device_code = $1 AND status = 'active'`,
    [device_code]
  );

  if (!rows[0]) {
    const e = new Error(`Terminal '${device_code}' not found or disabled`);
    e.status = 403;
    throw e;
  }

  const { terminal_id, facility, location_description, allowed_ip } = rows[0];

  if (allowed_ip && allowed_ip.trim() && ip_address) {
    if (ip_address !== allowed_ip.trim()) {
      const e = new Error(`Terminal '${device_code}' is not permitted from ${ip_address}`);
      e.status = 403;
      throw e;
    }
  }

  const label = location_description
    ? `${facility} – ${location_description}`
    : facility;

  return { terminal_id, terminal_name: label };
}

// ─── Day-type resolver ─────────────────────────────────────────────────────────

function _dayType(dateStr) {
  const dow = new Date(dateStr + 'T12:00:00').getDay();
  if (dow === 0) return 'sunday';
  if (dow === 6) return 'saturday';
  return 'weekday';
}

// ─── Online punch + shift state machine ───────────────────────────────────────
// Inserts the punch (idempotent on client_uuid), then updates attendance_shifts:
//   clock_in  → marks any open shift missing_punch; opens a new shift.
//   clock_out → closes the most-recent open shift, runs classifyHours.
//
// Accept `punched_at` or `punch_timestamp` interchangeably from callers.

async function recordPunch({
  user_id,
  terminal_id,
  punch_type,
  punch_timestamp,
  punched_at,           // accepted alias for punch_timestamp
  entry_method,
  photo_ref,
  client_uuid,
  source = 'online',    // 'online' | 'synced_offline'
}) {
  const at = new Date(punch_timestamp || punched_at || Date.now());

  const { rows: [punch] } = await pool.query(
    `INSERT INTO attendance_punches
       (user_id, terminal_id, punch_type, punch_timestamp,
        entry_method, photo_ref, client_uuid, source)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (client_uuid) DO NOTHING
     RETURNING punch_id`,
    [user_id, terminal_id || null, punch_type, at,
     entry_method, photo_ref, client_uuid, source]
  );

  if (!punch) return { punch_id: null, client_uuid, idempotent: true };

  // ── Shift state machine ──────────────────────────────────────────────────────
  if (punch_type === 'clock_in') {
    await pool.query(
      `UPDATE attendance_shifts SET status = 'missing_punch' WHERE user_id = $1 AND status = 'open'`,
      [user_id]
    );
    // VARCHAR(24) limit on shift_ref — use 24 hex chars of the UUID (no hyphens)
    const shift_ref = punch.punch_id.replace(/-/g, '').slice(0, 24);
    await pool.query(
      `INSERT INTO attendance_shifts (shift_ref, user_id, clock_in_punch_id, status)
       VALUES ($1, $2, $3, 'open')
       ON CONFLICT (shift_ref) DO NOTHING`,
      [shift_ref, user_id, punch.punch_id]
    );
  } else {
    // Find the most-recent open shift for this user
    const { rows: [openShift] } = await pool.query(
      `SELECT s.shift_id, p.punch_timestamp AS t_in
       FROM attendance_shifts s
       JOIN attendance_punches p ON p.punch_id = s.clock_in_punch_id
       WHERE s.user_id = $1 AND s.status = 'open'
       ORDER BY p.punch_timestamp DESC
       LIMIT 1`,
      [user_id]
    );

    if (openShift) {
      const punchInput = [
        { type: 'clock_in',  time: openShift.t_in },
        { type: 'clock_out', time: at },
      ];
      const { shifts: [computed] } = classifyHours(punchInput, {}, _dayType);

      // Approximate per-shift bucket (weekly OT needs full-week context)
      const net    = computed.net_hours || 0;
      const dtype  = _dayType(at.toISOString().slice(0, 10));
      const isHol  = dtype === 'sunday' || dtype === 'public_holiday';
      const hot    = isHol ? net : 0;
      const normal = !isHol ? Math.min(net, 10) : 0;
      const dot    = !isHol ? Math.max(0, net - 10) : 0;

      const newStatus = computed.status === 'ok' ? 'closed' : computed.status;

      await pool.query(
        `UPDATE attendance_shifts
         SET clock_out_punch_id = $1,
             net_hours          = $2,
             normal_hours       = $3,
             weekday_ot_hours   = $4,
             holiday_ot_hours   = $5,
             status             = $6,
             flags              = $7,
             computed_at        = NOW()
         WHERE shift_id = $8`,
        [punch.punch_id, net, normal, dot, hot,
         newStatus, JSON.stringify(computed.flags), openShift.shift_id]
      );
    }
    // Orphan clock_out: punch recorded, no shift to close (no open shift found)
  }

  return { punch_id: punch.punch_id, client_uuid, idempotent: false };
}

// ─── Batch offline sync ────────────────────────────────────────────────────────
// Each punch must include user_id (resolved at kiosk time during offline session).
// Source is forced to 'synced_offline'; per-item status returned.

async function syncPunches(punches_array) {
  const REQUIRED = ['user_id', 'punch_type', 'entry_method', 'photo_ref', 'client_uuid'];
  const results  = [];

  for (const punch of punches_array) {
    const missing = REQUIRED.filter(k => !punch[k]);
    if (missing.length || (!punch.punch_timestamp && !punch.punched_at)) {
      results.push({
        client_uuid: punch.client_uuid || null,
        status:      'error',
        message:     `Missing required fields: ${[...missing, ...(!punch.punch_timestamp && !punch.punched_at ? ['punch_timestamp'] : [])].join(', ')}`,
      });
      continue;
    }
    if (!['clock_in', 'clock_out'].includes(punch.punch_type)) {
      results.push({ client_uuid: punch.client_uuid, status: 'error', message: `Invalid punch_type '${punch.punch_type}'` });
      continue;
    }
    try {
      const res = await recordPunch({ ...punch, source: 'synced_offline' });
      results.push({ client_uuid: punch.client_uuid, status: res.idempotent ? 'duplicate' : 'accepted', punch_id: res.punch_id });
    } catch (err) {
      results.push({ client_uuid: punch.client_uuid, status: 'error', message: err.message });
    }
  }

  return results;
}

// ─── Monthly register ──────────────────────────────────────────────────────────
// RBAC: admin → any; manager (has manager_id match) → their reports; else → own.
// Computes shifts+weeks fresh from raw punches using classifyHours.

async function getRegister(target_user_id, month, requester) {
  const MANAGER_ROLES = ['admin','hr_admin','hr_manager','manager',
                         'production_manager','warehouse_manager','ceo','cfo'];
  const isAdmin = requester.role === 'admin';
  const isSelf  = requester.user_id === target_user_id;
  const isMgr   = MANAGER_ROLES.includes(requester.role);

  if (!isAdmin && !isSelf) {
    if (isMgr) {
      const { rows } = await pool.query(
        'SELECT manager_id FROM users WHERE user_id = $1',
        [target_user_id]
      );
      if (!rows[0] || rows[0].manager_id !== requester.user_id) {
        const e = new Error('Access denied'); e.status = 403; throw e;
      }
    } else {
      const e = new Error('Access denied'); e.status = 403; throw e;
    }
  }

  const [year, mon] = (month || '').split('-').map(Number);
  if (!year || !mon || mon < 1 || mon > 12) {
    const e = new Error("month must be 'YYYY-MM'"); e.status = 400; throw e;
  }

  const startDate = new Date(Date.UTC(year, mon - 1, 1));
  const endDate   = new Date(Date.UTC(year, mon, 1));

  const { rows: punchRows } = await pool.query(
    `SELECT punch_id, punch_type AS type, punch_timestamp AS time,
            entry_method, source
     FROM attendance_punches
     WHERE user_id = $1 AND punch_timestamp >= $2 AND punch_timestamp < $3
     ORDER BY punch_timestamp`,
    [target_user_id, startDate, endDate]
  );

  const punchesForCalc = punchRows.map(p => ({ type: p.type, time: p.time }));
  const { shifts, weeks } = classifyHours(punchesForCalc, {}, _dayType);

  return {
    user_id:     target_user_id,
    month,
    punch_count: punchRows.length,
    shifts,
    weeks,
    punches:     punchRows,
  };
}

// ─── Manual adjustment ────────────────────────────────────────────────────────
// Requires a valid shift_id (from attendance_shifts).
// Records old/new values in attendance_adjustments and marks the shift
// as 'manually_adjusted'.

async function createAdjustment({ shift_id, reason, new_value }, performed_by, ip_address) {
  if (!shift_id) {
    const e = new Error('shift_id is required'); e.status = 400; throw e;
  }
  if (!reason?.trim()) {
    const e = new Error('reason is required'); e.status = 400; throw e;
  }

  const { rows: [shift] } = await pool.query(
    `SELECT shift_id, status, net_hours, normal_hours,
            weekday_ot_hours, holiday_ot_hours, flags
     FROM attendance_shifts WHERE shift_id = $1`,
    [shift_id]
  );
  if (!shift) {
    const e = new Error('Shift not found'); e.status = 404; throw e;
  }

  const old_value = {
    status:           shift.status,
    net_hours:        shift.net_hours,
    normal_hours:     shift.normal_hours,
    weekday_ot_hours: shift.weekday_ot_hours,
    holiday_ot_hours: shift.holiday_ot_hours,
    flags:            shift.flags,
  };

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    if (new_value) {
      await client.query(
        `UPDATE attendance_shifts
         SET net_hours          = $1,
             normal_hours       = $2,
             weekday_ot_hours   = $3,
             holiday_ot_hours   = $4,
             status             = 'manually_adjusted',
             flags              = $5,
             computed_at        = NOW()
         WHERE shift_id = $6`,
        [
          new_value.net_hours        ?? shift.net_hours,
          new_value.normal_hours     ?? shift.normal_hours,
          new_value.weekday_ot_hours ?? shift.weekday_ot_hours,
          new_value.holiday_ot_hours ?? shift.holiday_ot_hours,
          JSON.stringify(new_value.flags ?? shift.flags ?? []),
          shift_id,
        ]
      );
    }

    const { rows: [adj] } = await client.query(
      `INSERT INTO attendance_adjustments
         (shift_id, adjusted_by, reason, old_value, new_value)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING adjustment_id`,
      [shift_id, performed_by, reason.trim(),
       JSON.stringify(old_value), JSON.stringify(new_value || null)]
    );

    await writeAudit(client, {
      table_name:    'attendance_adjustments',
      record_id:     adj.adjustment_id,
      action:        'INSERT',
      old_values:    old_value,
      new_values:    new_value || null,
      changed_fields: ['net_hours', 'normal_hours', 'weekday_ot_hours', 'holiday_ot_hours', 'status'],
      performed_by,
      ip_address,
    });

    await client.query('COMMIT');
    return { adjustment_id: adj.adjustment_id };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ─── Badge token issuance ────────────────────────────────────────────────────
// Generates a fresh 32-byte base64url token, upserts it into
// attendance_credentials.badge_token (rotating any existing token), and writes
// an audit entry that records the rotation WITHOUT ever persisting the token
// value in the audit log.
//
// Security: pin_hash is never touched here. raw_token is returned to the route
// caller only so it can be encoded in a QR — it must never appear as display
// text in a response or log.

async function issueBadgeToken(target_user_id, performed_by, ip_address) {
  const { rows: uRows } = await pool.query(
    `SELECT user_id, full_name, employee_number, job_title, photo_url
     FROM users WHERE user_id = $1 AND is_active = TRUE`,
    [target_user_id]
  );
  if (!uRows[0]) {
    const e = new Error('User not found or inactive'); e.status = 404; throw e;
  }

  const raw_token = crypto.randomBytes(32).toString('base64url');
  const now       = new Date();

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Detect rotation so the audit log is informative without logging the token
    const { rows: [existing] } = await client.query(
      `SELECT badge_token IS NOT NULL AS rotating
       FROM attendance_credentials WHERE user_id = $1`,
      [target_user_id]
    );
    const rotating = existing?.rotating === true;

    await client.query(
      `INSERT INTO attendance_credentials (user_id, badge_token, updated_at)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id) DO UPDATE
       SET badge_token = EXCLUDED.badge_token,
           updated_at  = EXCLUDED.updated_at`,
      [target_user_id, raw_token, now]
    );

    await writeAudit(client, {
      table_name:    'attendance_credentials',
      record_id:     target_user_id,
      action:        'UPDATE',
      new_values:    { badge_issued: true, rotating, via: 'badge_issue' },
      changed_fields: ['badge_token'],
      performed_by,
      ip_address,
    });

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  // raw_token returned to route; route puts it in a QR only — never in JSON text
  return { raw_token, user: uRows[0] };
}

// ─── Team / employee lookups (for dashboard views) ────────────────────────────

// Returns direct reports of `requester`; admins see all active users.
async function getTeam(requester) {
  const MANAGER_ROLES = ['admin','hr_admin','hr_manager','manager',
                         'production_manager','warehouse_manager','ceo','cfo'];
  const isAdmin = requester.role === 'admin';
  const isMgr   = MANAGER_ROLES.includes(requester.role);
  if (!isAdmin && !isMgr) {
    const e = new Error('Access denied'); e.status = 403; throw e;
  }
  const { rows } = isAdmin
    ? await pool.query(
        `SELECT user_id, full_name, email, role, department
         FROM users WHERE is_active = TRUE ORDER BY full_name`
      )
    : await pool.query(
        `SELECT user_id, full_name, email, role, department
         FROM users WHERE is_active = TRUE AND manager_id = $1
         ORDER BY full_name`,
        [requester.user_id]
      );
  return { team: rows };
}

// All active users for the admin PIN management dropdown.
async function getEmployees() {
  const { rows } = await pool.query(
    `SELECT user_id, full_name, email, role
     FROM users WHERE is_active = TRUE ORDER BY full_name`
  );
  return { employees: rows };
}

module.exports = {
  writeAudit,
  resolveIdentifier,
  verifyPin,
  issuePIN,
  resetPIN,
  changePIN,
  issueBadgeToken,
  validateTerminal,
  recordPunch,
  syncPunches,
  getRegister,
  getTeam,
  getEmployees,
  createAdjustment,
};
