# Codebase Reconnaissance Report
**Date:** 2026-06-29  
**Scope:** VTL Inventory MGTv2 — pre-attendance-module build  
**Author:** Claude Code (read-only pass)

---

## 1. Conventions

### 1.1 Table Naming

All tables use **snake_case, plural** with UUID primary keys named `<singular>_id`.  
Examples: `users`, `products`, `inventory`, `batches`, `inventory_transactions`,  
`warehouse_locations`, `production_orders`, `bill_of_materials`, `audit_log`,  
`system_alerts`, `scanner_sessions`, `user_sessions`, `password_reset_tokens`.

HR tables follow the same convention with an `hr_` prefix:  
`hr_employees`, `hr_contracts`, `hr_reviews`, `hr_pips`, `hr_performance_ratings`,  
`hr_onboarding_progress`, `hr_leave_balances`, `hr_sop_training_records`, `hr_departments`.  
Legacy leave table: `holiday_requests` (no prefix — added before the HR module).

JSONB columns are used liberally for flexible fields (`specification_details`,  
`emergency_contacts`, `alert_data`, `performance_scores_json`, `action_items_json`).

### 1.2 Auto-Generated Reference Numbers — the RCV-/ISS- Pattern

**Two implementations exist (both alive, potentially inconsistent).**

**DB-side** — `database/schema.sql` lines 580–614:
```sql
CREATE OR REPLACE FUNCTION generate_transaction_number(tx_type transaction_type)
RETURNS VARCHAR AS $$
DECLARE
    prefix        VARCHAR(10);
    date_part     VARCHAR(10);
    sequence_part VARCHAR(10);
    counter       INTEGER;
BEGIN
    prefix := CASE tx_type
        WHEN 'receipt'            THEN 'RCV'
        WHEN 'issue'              THEN 'ISS'
        WHEN 'adjustment'         THEN 'ADJ'
        WHEN 'transfer'           THEN 'TRF'
        WHEN 'production_consume' THEN 'PRD'
        WHEN 'production_output'  THEN 'OUT'
        WHEN 'return'             THEN 'RET'
        WHEN 'waste'              THEN 'WST'
        ELSE 'TXN'
    END;
    date_part := TO_CHAR(CURRENT_DATE, 'YYYYMMDD');
    SELECT COUNT(*) + 1 INTO counter
    FROM inventory_transactions
    WHERE transaction_number LIKE prefix || '-' || date_part || '-%'
      AND DATE(transaction_date) = CURRENT_DATE;
    sequence_part := LPAD(counter::TEXT, 4, '0');
    RETURN prefix || '-' || date_part || '-' || sequence_part;
END;
$$ LANGUAGE plpgsql;
```
Format: `RCV-20260629-0001` (sequential per type per day).  
The function is **not** called via a DB trigger — the schema shows no auto-call trigger for it; callers must invoke it explicitly.

**JS-side** — `backend/src/services/transaction-service.js` lines 12–28:
```js
function generateTransactionNumber(type) {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
  const prefixes = { receipt:'RCV', issue:'ISS', transfer:'TRF', adjustment:'ADJ', return:'RET' };
  const prefix = prefixes[type] || 'TXN';
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `${prefix}-${dateStr}-${random}`;
}
```
Format: same visual shape but uses a **random** 4-digit suffix, not a counter — collision-prone.  
**Risk:** any new module writing transactions should call the DB function (or copy the counter logic from it), not the JS random version.

### 1.3 `audit_log` Usage

The `audit_log` table is **defined** in `database/schema.sql` (lines 370–392) with columns:  
`audit_id`, `table_name`, `record_id`, `action` (`INSERT/UPDATE/DELETE`),  
`old_values JSONB`, `new_values JSONB`, `changed_fields TEXT[]`,  
`performed_by UUID → users`, `performed_at`, `ip_address`, `user_agent`, `session_id`.

**No service or route actively writes to it.** Grep across all `backend/src/**/*.js` finds zero `INSERT INTO audit_log` statements. The table exists but is unused in application code. Any new module that wants auditing should write to it directly via raw SQL; there is no shared audit helper to call.

### 1.4 How a New Service/Route Is Wired In

The pattern — consistent across all modules — is:

1. **Create** `backend/src/services/feature-service.js`  
   — imports `pool` from `./auth-service` (the singleton pool used by all services)  
   — exports named async functions

2. **Create** `backend/src/routes/feature-routes.js`  
   — `const router = express.Router()`  
   — `router.use(authenticate)` at the top to protect all routes  
   — each endpoint calls `requireHrAccess` / `authorize(...)` as a second middleware  
   — `module.exports = router`

3. **Register** in `backend/server.js`:
   ```js
   const featureRoutes = require('./src/routes/feature-routes');
   app.use('/api/feature', featureRoutes);
   ```

**Exception — HR:** HR routes are mounted at `/hr` (not `/api/hr`) and use the custom  
`hr-middleware.js` guards instead of `authorize()`. This is intentional (see HR_BASE  
comment in `frontend/app/hr/page.tsx` line 35).

---

## 2. RBAC Mechanism

Two authenticate/authorize modules exist. Only one is in active use.

### Active: `backend/src/middleware/auth-middleware.js`

Used by all real routes (hr-routes, users-routes, and every route in server.js).

```js
// Verify JWT, decode payload, attach to req.user — NO database lookup
const authenticate = (req, res, next) => {
  const token = req.headers.authorization.replace('Bearer ', '');
  const decoded = jwt.verify(token, JWT_SECRET);  // throws on bad/expired token
  req.user = decoded;   // { user_id, email, role, full_name }
  next();
};

// Factory: authorize('admin') or authorize(['admin','manager'])
const authorize = (...allowedRoles) => (req, res, next) => {
  const roles = allowedRoles.flat();
  if (!roles.includes(req.user.role)) return res.status(403).json({ message: '...' });
  next();
};
```

**How a route declares allowed roles:**
```js
// Option A — per-handler
router.get('/endpoint', authenticate, authorize('admin', 'manager'), handler);

// Option B — all subsequent routes in a file
router.use(authenticate);
router.use(authorize('admin'));  // everything below requires admin
```

### HR sub-system: `backend/src/middleware/hr-middleware.js`

```js
const HR_ACCESS_ROLES = ['admin','hr_admin','hr_manager','manager',
                          'production_manager','warehouse_manager','ceo','cfo'];
const HR_ADMIN_ROLES  = ['admin', 'hr_admin'];

requireHrAccess  // anyone in HR_ACCESS_ROLES
requireHrAdmin   // only admin or hr_admin
```

### Dormant: `backend/src/middleware/authenticate.js`

Does a **live DB lookup** on every request to verify the user still exists and is active.  
Only imported by `backend/src/api/routes/auth.js` (the old server scaffold, not used  
in production). Do not use this for new routes — it is heavier and inconsistent with  
the rest of the codebase.

### Complete role list (from `users-service.js`)

```
admin, manager, production_manager, qa, viewer,
warehouse_manager, warehouse_staff,
ceo, cfo, engineering, operator, sales, staff, super_viewer,
hr_admin, hr_manager
```

The `users.role` column in `schema.sql` only validates against `('admin', 'warehouse_manager', 'warehouse_staff', 'production_manager', 'viewer')` — **that CHECK constraint is stale**; the live DB has been extended to accept all roles in the list above.

---

## 3. `users.manager_id` Self-Referencing FK

**Does NOT exist.**

The `database/schema.sql` `users` table has no `manager_id` column.

What does exist (inconsistently):

| Column | Table | Type | Notes |
|--------|-------|------|-------|
| `reports_to` | `users` | `VARCHAR` (TEXT) | Stores a name string **or** a user_id string — ambiguous. Used by `users-service.js submitHolidayRequest` which tries to match it against `full_name OR user_id::text`. |
| `reports_to_user_id` | `hr_employees` | `UUID → users(user_id)` | Proper FK, set in HR record creation. |

**Conclusion:** We need to add `manager_id UUID REFERENCES users(user_id)` to `users` for the attendance module to have a clean FK. The `hr_employees.reports_to_user_id` already serves this purpose for HR but is only populated for employees who have an HR record. A clean `manager_id` on `users` itself is the safer foundation.

---

## 4. Read-Only Files — Do Not Modify

These files work in production. Treat as immutable for this project.

**Server entry point**
- [backend/server.js](backend/server.js)

**Middleware**
- [backend/src/middleware/auth-middleware.js](backend/src/middleware/auth-middleware.js) — active authenticate + authorize
- [backend/src/middleware/hr-middleware.js](backend/src/middleware/hr-middleware.js) — requireHrAccess, requireHrAdmin
- [backend/src/middleware/authenticate.js](backend/src/middleware/authenticate.js) — dormant, leave alone

**DB utilities**
- [backend/src/utils/db.js](backend/src/utils/db.js)
- [backend/src/utils/db-enhanced.js](backend/src/utils/db-enhanced.js)
- [backend/src/utils/auth.js](backend/src/utils/auth.js)
- [backend/src/utils/error-handler.js](backend/src/utils/error-handler.js)
- [backend/src/utils/validators.js](backend/src/utils/validators.js)
- [backend/src/config/database.js](backend/src/config/database.js)

**Auth**
- [backend/src/services/auth-service.js](backend/src/services/auth-service.js) — singleton pool source
- [backend/src/routes/auth-routes.js](backend/src/routes/auth-routes.js)

**All existing services** (27 files)
- [backend/src/services/transaction-service.js](backend/src/services/transaction-service.js)
- [backend/src/services/batch-service.js](backend/src/services/batch-service.js)
- [backend/src/services/inventory-service.js](backend/src/services/inventory-service.js)
- [backend/src/services/users-service.js](backend/src/services/users-service.js)
- [backend/src/services/hr-service.js](backend/src/services/hr-service.js)
- [backend/src/services/hr-document-service.js](backend/src/services/hr-document-service.js)
- [backend/src/services/products-service.js](backend/src/services/products-service.js)
- [backend/src/services/dashboard-service.js](backend/src/services/dashboard-service.js)
- [backend/src/services/reporting-service.js](backend/src/services/reporting-service.js)
- [backend/src/services/production-service.js](backend/src/services/production-service.js)
- [backend/src/services/production-reporting-service.js](backend/src/services/production-reporting-service.js)
- [backend/src/services/analytics-service.js](backend/src/services/analytics-service.js)
- [backend/src/services/metrics-service.js](backend/src/services/metrics-service.js)
- [backend/src/services/qms-service.js](backend/src/services/qms-service.js)
- [backend/src/services/qms-scheduler.js](backend/src/services/qms-scheduler.js)
- [backend/src/services/lab-service.js](backend/src/services/lab-service.js)
- [backend/src/services/sales-analytics-service.js](backend/src/services/sales-analytics-service.js)
- [backend/src/services/pos-service.js](backend/src/services/pos-service.js)
- [backend/src/services/grn-service.js](backend/src/services/grn-service.js)
- [backend/src/services/po-service.js](backend/src/services/po-service.js)
- [backend/src/services/supplier-service.js](backend/src/services/supplier-service.js)
- [backend/src/services/customer-service.js](backend/src/services/customer-service.js)
- [backend/src/services/notification-service.js](backend/src/services/notification-service.js)
- [backend/src/services/mobile-service.js](backend/src/services/mobile-service.js)
- [backend/src/services/barcode-service.js](backend/src/services/barcode-service.js)
- [backend/src/services/settings-service.js](backend/src/services/settings-service.js)
- [backend/src/services/lab-pdf-service.js](backend/src/services/lab-pdf-service.js)

**All existing routes** (21 files)
- [backend/src/routes/hr-routes.js](backend/src/routes/hr-routes.js)
- [backend/src/routes/users-routes.js](backend/src/routes/users-routes.js)
- [backend/src/routes/inventory-routes.js](backend/src/routes/inventory-routes.js)
- [backend/src/routes/products-routes.js](backend/src/routes/products-routes.js)
- [backend/src/routes/production-routes.js](backend/src/routes/production-routes.js)
- [backend/src/routes/dashboard-routes.js](backend/src/routes/dashboard-routes.js)
- [backend/src/routes/reports-routes.js](backend/src/routes/reports-routes.js)
- [backend/src/routes/analytics-routes.js](backend/src/routes/analytics-routes.js)
- [backend/src/routes/metrics-routes.js](backend/src/routes/metrics-routes.js)
- [backend/src/routes/qms-routes.js](backend/src/routes/qms-routes.js)
- [backend/src/routes/lab-routes.js](backend/src/routes/lab-routes.js)
- [backend/src/routes/sales-routes.js](backend/src/routes/sales-routes.js)
- [backend/src/routes/sales-analytics-routes.js](backend/src/routes/sales-analytics-routes.js)
- [backend/src/routes/supplier-routes.js](backend/src/routes/supplier-routes.js)
- [backend/src/routes/po-routes.js](backend/src/routes/po-routes.js)
- [backend/src/routes/grn-routes.js](backend/src/routes/grn-routes.js)
- [backend/src/routes/customer-routes.js](backend/src/routes/customer-routes.js)
- [backend/src/routes/barcode-routes.js](backend/src/routes/barcode-routes.js)
- [backend/src/routes/mobile-routes.js](backend/src/routes/mobile-routes.js)
- [backend/src/routes/settings.js](backend/src/routes/settings.js)
- [backend/src/routes/signature-routes.js](backend/src/routes/signature-routes.js)

**Database schema** (source of truth for original structure; live DB has additions)
- [database/schema.sql](database/schema.sql)

**Existing test files**
- [backend/test-integration.js](backend/test-integration.js)
- [backend/test-db-connection.js](backend/test-db-connection.js)
- [backend/test-inventory.js](backend/test-inventory.js)
- [backend/test-excel-report.js](backend/test-excel-report.js)
- [backend/test-validators.js](backend/test-validators.js)
- [backend/test-error-handler.js](backend/test-error-handler.js)
- [backend/test-db-locations.js](backend/test-db-locations.js)

---

## 5. Attendance Module — Risks and Temptation Points

### Risk 1 — `users-service.js` already owns leave/holiday logic

`users-service.js` has `getHolidayData`, `submitHolidayRequest`, `getPendingHolidayApprovals`, `respondToHolidayRequest` mixed in with pure user CRUD. Attendance (clock-in/out, shift records, absence tracking) is adjacent to leave, which will **tempt you to add attendance functions into `users-service.js`**. Do not. It would grow the file further and create a dependency tangle. Attendance gets its own `attendance-service.js`.

### Risk 2 — `hr-service.js` has leave balance and compliance functions

`hr-service.js` contains `getLeaveBalance`, `upsertLeaveBalance`, `getComplianceSnapshot`. Attendance data feeds naturally into compliance snapshots. The temptation is to add attendance queries into `hr-service.js`. Do not. The HR service is already 835 lines. Cross-reference only via the DB (attendance tables that `hr-service` can later query via views).

### Risk 3 — The `users.reports_to` TEXT column

Attendance approval workflows (e.g. manager approves overtime) will need a clean manager FK. `users.reports_to` is a TEXT field that stores either a manager's `full_name` or a `user_id` string — it is **not reliable as a FK**. Do not build attendance approvals on top of it. Plan to add `users.manager_id UUID REFERENCES users(user_id)` via an `ALTER TABLE` migration, or use `hr_employees.reports_to_user_id` (only populated for employees with HR records).

### Risk 4 — `server.js` requires a two-line edit

Adding `const attendanceRoutes = require(...)` and `app.use('/api/attendance', attendanceRoutes)` to `backend/server.js` is the **only required touch to an existing file**. Every other change will be new files. Treat this edit as the single exception to the read-only rule for `server.js`.

### Risk 5 — HR mount path anomaly

HR is mounted at `/hr` not `/api/hr`. Attendance should mount at `/api/attendance` (following every other module except HR). If you need attendance to be accessible to the HR dashboard, use the standard `/api/attendance` path and have the frontend call that path — do not mount it under `/hr` to "keep it with HR".

### Risk 6 — `auth-middleware.js` temptation

Attendance-specific role checks (e.g. "only shift_supervisor can approve OT") may tempt you to add new guard functions to `auth-middleware.js`. Do not. Add attendance-specific role lists to a new `attendance-middleware.js` file, mirroring the `hr-middleware.js` pattern.

### Risk 7 — `audit_log` is defined but empty

Attendance records (clock events, manual corrections) need an audit trail. The `audit_log` table is ready but nothing writes to it yet. Attendance should be the first module to actively use it. This is an opportunity, not a risk, but be aware you'll be writing the first production usage pattern for a table that has never been written to.

### Risk 8 — Singleton pool sourcing

All 27 services import pool from `auth-service`:
```js
const { pool } = require('./auth-service');
```
Attendance service must follow the same pattern. Do **not** create a new `Pool` instance — `auth-service.js` already handles Neon's connection-termination events and keep-alive pings.

---

## Summary of Items Needed Before Writing Code

| Item | Action |
|------|--------|
| `users.manager_id` FK | `ALTER TABLE users ADD COLUMN manager_id UUID REFERENCES users(user_id)` — new migration |
| `attendance_*` tables | New DDL in a migration file (not in `schema.sql`) |
| `attendance-service.js` | New file — does not touch existing services |
| `attendance-routes.js` | New file — mirrors hr-routes.js pattern |
| `attendance-middleware.js` | New file if role logic is non-trivial |
| `server.js` | **One edit only** — add require + app.use for attendance routes |
| `audit_log` writes | First active usage — implement INSERT helper inside attendance-service |
