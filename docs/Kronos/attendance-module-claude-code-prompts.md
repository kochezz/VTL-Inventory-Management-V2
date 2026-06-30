# VTL Attendance Module — Claude Code Handoff Prompts (final)

**Phase 0 decisions locked in:**
- Auth: QR badge scan **or** company-email-localpart entry, both followed by a 4-digit PIN.
  PIN is the only secret; QR/email are interchangeable identifiers (single-factor).
- PIN: 4-digit, bcrypt-hashed, lockout after 5 failed attempts → 15-min lock.
- Admin issues initial PIN and handles resets; both are temporary (`pin_must_change`).
  User must change PIN before first real punch. User can self-change a known PIN.
- Photo capture: MANDATORY on every punch (primary fraud control, since PIN is weak).
- Non-scan (email-entry) punches: recorded via `entry_method` and shown as a PASSIVE
  flag in the manager view — no review-queue workflow.
- Offline-capable queue (PWA + IndexedDB + idempotent sync).
- Hours rules (finalised): normal day 8h, normal week 40h; 30-min unpaid lunch
  deducted, 15-min break paid/retained; NO grace period, NO rounding (punch-exact).
  Universal schedule 07:00-15:45 with a 60-min/day off-schedule buffer (early-in +
  late-out summed, asymmetric; <=60 discarded, excess counts toward thresholds;
  lateness does NOT offset; buffer does NOT apply on Sun/holidays).
  Daily OT = hours beyond 10/day (1.5x), taken first. Weekly OT = hours beyond
  45/week (1.5x), after daily OT removed, no double-count. The 40-45 band is NORMAL
  rate. Sunday & public holidays = 2x from the first minute (own category, not via
  weekday OT logic). Saturday counts toward the 45 weekly threshold but is not its
  own premium. Output is CLASSIFIED HOURS ONLY (no money). Under-hours flags:
  <8 net/day and <40 net/week. Public holidays live in an admin-editable table.

**How to use:** One prompt per turn. Do NOT proceed until you have reviewed the output,
applied/run it, and confirmed it. The friction is deliberate.

---

## GLOBAL GUARDRAILS — paste at the top of EVERY prompt below

> CONTEXT: You produced recon.md on this repo. Treat its findings as authoritative.
> Respect these on every change:
> - Source the DB pool with `const { pool } = require('./auth-service')`. NEVER create a
>   new `Pool` — auth-service handles Neon keep-alive and connection-termination.
> - For reference numbers, use the COUNTER logic from the DB function
>   `generate_transaction_number` (per-type, per-day sequence). Do NOT copy the
>   random-suffix JS version in transaction-service.js — it collides.
> - Do NOT touch the `users.role` CHECK constraint. The schema.sql one is STALE
>   (5 roles; live DB accepts ~16). Touching it locks out real users.
> - For manager scoping use the NEW `users.manager_id` FK only. Do NOT read
>   `users.reports_to` (ambiguous TEXT).
> - Mount routes at `/api/attendance` (majority pattern), NOT under `/hr`.
> - The ONLY existing file you may edit in this whole project is `backend/server.js`,
>   and only to add two lines registering the router. Every other change is a NEW file.
> - The 27 services, 21 routes, all middleware, and all utils in recon.md section 4
>   are READ-ONLY.
> - PINs are secrets: bcrypt-hashed like passwords, never plaintext, never logged.

---

## PROMPT 1 — Schema migration (additive only)

```
[paste global guardrails]

Database structure ONLY — no application code.

HARD CONSTRAINTS:
- NEW file in database/migrations/ (e.g. 0XX_attendance_module.sql). Do NOT edit
  schema.sql. Do NOT alter any existing table's columns, triggers, or constraints,
  with the ONE exception below.
- Include a matching rollback (down) section dropping everything this adds.
- Do NOT run against any database. Output SQL; I apply it myself.

Tables (snake_case plural, UUID PKs named <singular>_id):

- attendance_terminals: terminal_id PK, device_code UNIQUE, facility,
  location_description, allowed_ip, status (active/disabled), registered_at.

- attendance_credentials (one row per user; keeps secrets OUT of the users table
  so existing SELECT * FROM users queries never touch PIN data):
  credential_id PK, user_id FK users UNIQUE, pin_hash (bcrypt),
  badge_token UNIQUE nullable (opaque value the QR encodes; maps to user_id so a
  leaked QR image is not a leaked user_id), pin_must_change BOOL default true,
  pin_failed_attempts INT default 0, pin_locked_until timestamptz nullable,
  pin_set_at timestamptz, updated_at.

- attendance_punches — RAW, APPEND-ONLY (no updates, no deletes ever):
  punch_id PK, client_uuid UNIQUE (idempotent offline sync),
  user_id FK users, terminal_id FK attendance_terminals,
  punch_type (clock_in/clock_out), entry_method (qr/email),
  punch_timestamp timestamptz, source (online/synced_offline),
  photo_ref text NOT NULL (photo is mandatory), created_at.

- attendance_shifts — DERIVED (recomputed from punches, never hand-entered):
  shift_id PK, shift_ref auto-gen CLK-YYYYMMDD-NNNN, user_id FK,
  clock_in_punch_id FK punches, clock_out_punch_id FK nullable,
  hours_worked NUMERIC nullable, overtime_hours NUMERIC nullable,
  status (open/closed/missing_punch/manually_adjusted), computed_at.

- attendance_adjustments: adjustment_id PK, shift_id FK, adjusted_by FK users,
  reason TEXT, old_value JSONB, new_value JSONB, created_at.

- public_holidays — admin-editable, drives 2x day classification (NOT hardcoded in
  the function): holiday_id PK, holiday_date DATE UNIQUE, name TEXT,
  is_substitute BOOL default false (true for Monday substitutes when a holiday
  falls on a weekend), created_by FK users nullable, created_at.
  SEED the 2026 Zambian gazetted list (note Aug 13 is the Tripartite Election Day,
  an ad-hoc gazetted holiday, and Mar 9 / Oct 19 are weekend-substitute Mondays):
    2026-01-01 New Year's Day
    2026-03-08 International Women's Day
    2026-03-09 International Women's Day (substitute, is_substitute=true)
    2026-03-12 Youth Day
    2026-04-03 Good Friday
    2026-04-06 Easter Monday
    2026-04-28 Kenneth Kaunda Day
    2026-05-01 Labour Day
    2026-05-25 African Freedom Day
    2026-07-06 Heroes' Day
    2026-07-07 Unity Day
    2026-08-03 Farmers' Day
    2026-08-13 Tripartite Election Day (ad-hoc gazetted)
    2026-10-18 National Day of Prayer
    2026-10-19 National Day of Prayer (substitute, is_substitute=true)
    2026-10-24 Independence Day
    2026-12-25 Christmas Day
    2026-12-29 Declaration of Zambia as a Christian Nation
  These dates are 2026-specific and partly election-driven; the table is editable
  precisely so State House ad-hoc declarations and future years can be added
  without code changes.

Write generate_attendance_ref() SQL function mirroring generate_transaction_number
(per-day counter, CLK prefix, LPAD 4). Do NOT auto-trigger it; the service calls it.

THE ONE PERMITTED EXISTING-TABLE CHANGE:
- ALTER TABLE users ADD COLUMN manager_id UUID REFERENCES users(user_id). Nullable.
  No backfill. No change to any existing constraint (especially NOT the role CHECK).

After writing: show full migration SQL + rollback. List exact psql apply/rollback
commands. Execute nothing.
```

---

## PROMPT 2 — Hours-computation pure function (no DB, no HTTP, heavily tested)

```
[paste global guardrails]

Core hours logic as a PURE function — no DB, no HTTP, no side effects.
New file: backend/src/services/attendance-hours.js. Touch no existing service.

This function CLASSIFIES HOURS INTO BUCKETS. It does NOT compute pay/money. Never
multiply by a rate, never output currency. Payroll is a separate downstream system.

Input: array of punches for ONE user over a date range + a rules config + a
day-classification lookup (a function or map: date -> 'weekday'|'saturday'|
'sunday'|'public_holiday'). The caller supplies the day classification from the
public_holidays table; this function does NOT read any table itself.

Output per shift: { clock_in, clock_out, net_hours, status, flags[] }.
Plus a weekly rollup per ISO week: { normal_hours, weekday_ot_hours (1.5x band),
holiday_ot_hours (2x band), flags[] }.
NOTE the buckets are LABELS for downstream pay — this function only counts hours
into them; it does not apply the 1.5/2.0 multipliers.

THE RULES (these are the finalised business rules — encode them as the DEFAULT
config object, but keep every value a named parameter so they can be overridden):

  net_hours per shift   = elapsed - 30 (unpaid lunch). The 15-min break is PAID,
                          so it stays IN net_hours. Deduct 30 only, and only for a
                          shift long enough to contain the lunch (>= ~6h; make the
                          qualifying length a parameter, default 6h).
  grace_period_minutes  = 0  (punch-exact, no tolerance)
  rounding_minutes      = 0  (no rounding anywhere)
  normal_day_hours      = 8
  normal_week_hours     = 40   (informational; NOT an OT trigger by itself)

  SCHEDULE + OFF-SCHEDULE BUFFER (universal schedule, applies to weekdays &
  Saturdays ONLY — NOT Sundays/holidays):
    scheduled_start = 07:00, scheduled_end = 15:45 (global config, same for all
                      workers; there is no per-person shift table).
    daily_offschedule_buffer_minutes = 60.
    Per day, off_schedule_minutes = (minutes clocked in BEFORE scheduled_start)
      + (minutes clocked out AFTER scheduled_end). Summed across both ends,
      ASYMMETRIC (e.g. 40 early + 19 late = 59).
    If off_schedule_minutes <= 60: DISCARD all of it. The day is treated as the
      scheduled span; the extra attendance does NOT count as worked time and does
      NOT push toward any threshold.
    If off_schedule_minutes > 60: only the minutes BEYOND 60 count as worked time,
      added to net hours, and then flow into the normal daily-10 and weekly-45 OT
      logic. (e.g. 30 early + 45 late = 75 -> 15 min counts.)
    LATENESS DOES NOT OFFSET THE BUFFER. Time worked LATE-IN or EARLY-OUT (inside
      the scheduled window, not worked) is NOT netted against early/late buffer
      minutes. A late arrival reduces net hours (and may raise under_hours_day);
      a late departure is measured against the buffer SEPARATELY. They never cancel.
    SUNDAY & PUBLIC HOLIDAY: NO buffer. Every attended minute counts from the start
      (see the 2x rule below). Do not apply scheduled_start/end on those days.

  DAILY OT  : net hours in a single day BEYOND 10 -> weekday_ot bucket (1.5x).
              Computed FIRST.
  WEEKLY OT : after daily OT is removed, weekly net hours BEYOND 45 -> weekday_ot
              bucket (1.5x). NO DOUBLE-COUNTING: an hour already counted as daily
              OT is not counted again toward the weekly 45.
  THE 40-45 WEEKLY BAND IS NORMAL RATE. Do not treat 40-45 as OT. Only > 45 weekly
              (net of daily OT) is weekly OT.
  SATURDAY  : counts toward the weekly 45 threshold. It is NOT its own premium —
              Saturday hours are normal until the 45 weekly line is crossed, then
              1.5x like any weekday OT.
  SUNDAY & PUBLIC HOLIDAY : ALL net hours -> holiday_ot bucket (2x) from the first
              minute. These hours do NOT pass through the daily-10 or weekly-45
              logic and do NOT count toward the 45 threshold — they are their own
              category entirely.

  missed_punch_policy : clock_in with no clock_out -> status 'missing_punch',
              net_hours null. NEVER invent a clock-out time.
  max_shift_hours     = 14 : a span longer than this -> flag 'over_max_shift',
              not counted into any bucket.

  UNDER-HOURS FLAGS (flags only, no effect on buckets, no pay effect):
    - a worked weekday with net_hours < 8  -> flag 'under_hours_day'
    - an ISO week with total normal-day net < 40 -> flag 'under_hours_week'

Authentication method is irrelevant here. Do not reference PIN/QR/email/credentials.

Write a test (project's plain node test-*.js style) for EACH case below and show
the EXPECTED bucket counts in each:
1.  Normal 07:00-15:45 weekday -> net 8.0h, all normal, no flags.
2.  Span across midnight (in 22:00, out 06:00) -> correct net, correct day handling.
3.  clock_in, no clock_out -> missing_punch, net null.
4.  clock_out, no preceding clock_in -> flagged, not dropped.
5.  Two clock_ins in a row -> second opens a shift, first flagged.
6.  Double-scan seconds apart -> debounced to one.
7.  11h on a weekday -> 1h daily OT (1.5x bucket), 10h normal (minus lunch).
8.  9h/day Mon-Fri = 45 weekly, no day over 10 -> ZERO OT (45 is the line, not 40).
9.  9.5h/day Mon-Fri = 47.5 weekly, no day over 10 -> 2.5h weekly OT (beyond 45),
    proving the 40-45 band is NORMAL and only >45 is OT.
10. A day with 11h (1h daily OT) inside a week that also exceeds 45 total ->
    prove NO DOUBLE-COUNT: the daily-OT hour is not re-counted toward weekly 45.
11. Sunday work, 6h -> 6h in the 2x holiday bucket, NOT toward the 45 weekly line.
12. Public-holiday work (caller passes day='public_holiday'), 8h -> 8h in 2x bucket.
13. Saturday 5h added to a Mon-Fri 40h week (=45 total) -> Saturday still normal
    (at the 45 line, not beyond it).
14. Saturday 6h added to a Mon-Fri 40h week (=46 total) -> 1h of that Saturday is
    weekly OT (1.5x), 5h normal.
15. A 6.5h weekday shift -> net 6.0h (30-min lunch deducted), flag under_hours_day.
16. Span over max_shift_hours (15h) -> flag over_max_shift, not bucketed.
17. BUFFER, under threshold: in 06:20 (40 early), out 16:04 (19 late) = 59 off-
    schedule min -> ALL discarded; day = net 8.0h, zero OT. The 59 min does NOT
    push toward any threshold.
18. BUFFER, over threshold: in 06:30 (30 early), out 16:30 (45 late) = 75 off-
    schedule min -> 60 discarded, 15 min counts; day = net 8.25h, still under 10
    so zero daily OT, but the 0.25h accumulates toward weekly 45.
19. BUFFER, habitual: 59 off-schedule min EVERY day Mon-Fri -> all discarded each
    day; week = 40.0h net, zero OT (proves buffered minutes do NOT accumulate).
20. LATENESS NO OFFSET: in 07:30 (30 late), out 16:15 (30 late) -> the 30 late-in
    is NOT cancelled by the 30 late-out. Late-out 30 min is buffer-measured (<=60,
    discarded); late-in cuts the scheduled day -> net ~7.5h -> flag under_hours_day.
21. BUFFER ignored on Sunday: Sunday in 06:30 out 16:30 -> NO buffer; ALL attended
    time (full span minus lunch) in the 2x bucket from the first minute.
22. BUFFER ignored on public holiday: same as 21 with day='public_holiday'.

Run all tests, show passing. If ANY rule is ambiguous, STOP and ask me rather than
guessing. No DB or route code in this phase.
```

---

## PROMPT 3 — Backend service + routes + credentials + audit_log first-write

```
[paste global guardrails]

Build the attendance backend. ADDITIVE ONLY. New files:
- backend/src/services/attendance-service.js
- backend/src/routes/attendance-routes.js
- backend/src/middleware/attendance-middleware.js (mirror hr-middleware.js style)

attendance-service.js:
- Pool via `const { pool } = require('./auth-service')`.
- Imports attendance-hours.js for ALL hours math — do NOT reimplement.
- FIRST production write to audit_log (it has NEVER been written to). Write a clean
  writeAudit(client, {table_name, record_id, action, old_values, new_values,
  changed_fields, performed_by, ip_address}) helper INSIDE this service. This becomes
  the reference pattern for the codebase — make it clean. Every PIN issue/change/reset
  and every adjustment calls it.

CREDENTIAL + IDENTITY RESOLUTION (the auth core):
- Resolve identifier → user_id: a QR scan supplies badge_token; an email entry supplies
  a localpart, to which the system appends "@vilag.io" then resolves to the user. The
  user types ONLY the localpart (e.g. "wphiri"), never the full address.
- Then: check pin_locked_until (reject if locked, return minutes remaining) →
  verify 4-digit PIN against pin_hash (bcrypt) → on failure increment
  pin_failed_attempts; at 5 failures set pin_locked_until = now + 15 min and reset
  the counter → on success reset pin_failed_attempts.
- If pin_must_change is true, BLOCK the punch and return a "must change PIN" state;
  the kiosk forces a change before any real punch is recorded.

Credential endpoints (all audited):
- POST /attendance/pin/issue — admin only. Sets a temp PIN, pin_must_change=true.
- POST /attendance/pin/reset — admin only. Same, for an existing user. This is the
  impersonation-risk endpoint; its audit entry matters most.
- POST /attendance/pin/change — authenticated user. Verify old PIN → set new →
  clear pin_must_change.

Punch endpoints (mounted at /api/attendance):
- POST /punch — single online punch. Validate terminal (device_code + allowed_ip).
  Run the credential resolution + verification above. Record entry_method (qr/email).
  Store photo_ref (REQUIRED — reject a punch with no photo). Idempotent on client_uuid.
- POST /sync — batch offline queue. Array of punches, each with client_uuid,
  entry_method, photo_ref. MUST be idempotent: existing client_uuid acknowledged,
  not duplicated. Return per-item status.
- GET /register/:userId?month=YYYY-MM — derived monthly register. RBAC: user sees own;
  manager sees users where users.manager_id = themselves; admin sees any. Use the
  EXISTING authenticate + authorize from auth-middleware.js. Do NOT use the dormant
  authenticate.js. Do NOT read reports_to.
- POST /adjustment — manager/admin only. Creates adjustment, recomputes affected shift
  via attendance-hours.js, writes audit_log.

Use validators.js and error-handler.js patterns. Register the router in
backend/server.js with EXACTLY two lines (show them separately; confirm nothing else
in server.js changed).

Before finishing: run the existing test files (test-integration.js, test-inventory.js,
test-validators.js, etc.) and show they still pass — PROVING nothing broke. Then
demonstrate the new endpoints against seed data, including: a locked-out PIN, a
forced-first-change blocking a punch, and an email-localpart punch recording
entry_method=email.
```

---

## PROMPT 4 — Terminal kiosk PWA (separate app, touches nothing existing)

```
[paste global guardrails]

Dedicated clock-in terminal as a STANDALONE PWA, separate from the dashboard.
New directory: frontend/terminal-app/. Do NOT modify frontend/app/ or any existing
component.

Entry flow (two identifier paths → same PIN step):
- Path A: scan QR badge → resolves worker.
- Path B: type email LOCALPART only (e.g. "wphiri"); the app appends "@vilag.io".
  This path is for a lost/forgotten badge. It is slower by design.
- Both paths then prompt for the 4-digit PIN.
- Display the resolved worker's name + stored photo for confirmation.
- Capture a FRESH photo from the terminal camera (mandatory — no photo, no punch).
- Submit → large clear confirmation ("Clocked IN 07:42 — Wezi Phiri").
- Whole happy-path interaction under 3 seconds for a QR scan.

PIN states the kiosk must handle:
- Wrong PIN: show attempts remaining.
- Locked (pin_locked_until): show "locked, try again in N minutes" — do not let them retry.
- pin_must_change (first use after admin issue/reset): force a change-PIN
  interstitial (enter temp PIN → set new 4-digit PIN → confirm) BEFORE any punch
  is recorded.

Terminal authenticates as a DEVICE via device_code. Workers never log in as users.

Offline queue: punches captured offline → IndexedDB with a client-generated UUID +
entry_method + the captured photo, synced via POST /api/attendance/sync on reconnect.
Show "X punches pending sync". NEVER silently lose a punch; failed submit → queue it.
(Note: PIN verification and lockout require the server, so offline mode queues the
punch with its captured photo and identifier; reconcile verification on sync — flag
to me if you see a cleaner approach, do not silently change the security model.)

Sibling app sharing only the API. List every file created; confirm zero existing
files modified.
```

---

## PROMPT 5 — Dashboard integration (the only phase touching the dashboard)

```
[paste global guardrails]

Add attendance views to the existing dashboard. Purely additive: NEW pages and NEW
components, plus the MINIMUM nav entry. Do NOT alter existing inventory/product/HR
pages or shared layout beyond adding one nav link.

Add:
- Monthly attendance register on the user profile view: the worker's own shifts,
  total + overtime hours, flags for missing punches they must report. Show each
  punch's entry_method (qr/email) as a passive visible indicator.
- Manager view: register for direct reports (users.manager_id), with entry_method
  shown per punch as a PASSIVE flag (no review-queue workflow — just visible).
  Pending adjustments. Month-end reconciliation export REUSING the existing Excel
  approach (test-excel-report.js shows the library/pattern) — do not build a new one.
- Admin-only PIN management UI: issue initial PIN, reset PIN (both call the audited
  endpoints from Prompt 3). Surface clearly that issued/reset PINs are temporary.
- Gate everything with the existing useAuth hook + role checks.

Reuse existing DashboardLayout and components. List EVERY existing file you modified
and show the DIFF for each — changes must be additive and small. After: run the
frontend build; confirm existing pages still compile with no errors.
```

---

## Sequencing rules (do not skip)

1. Prompt 1 → apply migration yourself, eyeball tables, THEN Prompt 2.
2. Prompt 2 → read the test cases yourself; confirm overtime/rounding/missed-punch
   rules match what you want. Cheapest moment to catch disagreement. THEN Prompt 3.
3. Prompt 3 → read the server.js diff (exactly two lines); confirm existing tests
   still pass BEFORE Prompt 4. Test the lockout, forced-change, and email-entry paths.
4. Prompts 4 and 5 follow once the API is proven.

## Your real safety nets (not the polite guardrail text)
- "Show me the diff for every existing file you touched" (Prompts 3, 5).
- "Run the existing tests and show them passing" (Prompt 3).

## Decisions — all resolved
- OFFLINE + PIN: accepted. An offline punch is provisionally trusted until it syncs;
  verification reconciles on sync. (Prompt 4 implements this.)
- HOURS RULES: fully specified in Prompt 2's config. Weekly OT line is 45 (the 40-45
  band is normal rate); daily OT beyond 10 taken first, no double-count; Sun/holiday
  2x; Saturday counts toward 45 but no own premium; 30-min lunch deducted, 15-min
  break paid; no grace, no rounding; output is classified hours, not money.

## One caveat to revisit later (not a blocker)
- The public_holidays table is seeded for 2026 only. Someone must add 2027's dates
  (and any ad-hoc State House declarations during 2026) via the admin UI. Put a
  recurring reminder somewhere — an empty/stale holidays table silently misclassifies
  2x days as normal. This is an operational task, not a code gap.
