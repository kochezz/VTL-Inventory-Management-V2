# backend/tests/

Integration tests using Node's built-in test runner (`node:test` +
`node:assert`) — no Jest/Mocha added; this repo has zero test
dependencies today and the suite is small enough not to need one. If it
grows into something needing shared config, custom matchers, or watch-mode
DX, revisit that choice explicitly rather than letting it happen by default.

## Running

```
cd backend
npm run dev:test-server   # starts the server against the Neon "test" branch, MOCK_EMAIL_TRANSPORT=true
npm test                  # in a second terminal
```

**Set up `.env.test` once, first** (it's gitignored, never committed): copy
`backend/.env` to `backend/.env.test` and point `DATABASE_URL`/`PGHOST`/etc.
at the Neon **`test`** branch (a branch created from production, ask in the
team channel for its connection string, or create one yourself with
`neonctl branches create --name test --parent main` if you have API
access). Everything else in `.env.test` (JWT secret, Resend key, admin
login) stays identical to `.env` — only the database differs.

`npm run dev:test-server` is `cross-env MOCK_EMAIL_TRANSPORT=true ENV_FILE=.env.test nodemon server.js`:
`ENV_FILE` makes `server.js` load `.env.test` instead of `.env` (every other
startup path — `npm start`, plain `npm run dev` — is unaffected, `ENV_FILE`
unset there means `.env` as always); `MOCK_EMAIL_TRANSPORT=true` makes every
`sendEmail()` call record `{to, subject, timestamp}` in-memory instead of
calling Resend, readable via a debug route (`GET /api/_test/email-log`,
only mounted when this flag is on). A sibling debug route,
`GET /api/_test/db-host`, reports which DB host the running server is
actually using — `test-helper.js`'s `assertServerReachable()` calls it
automatically and aborts if it doesn't match this test process's own
`.env.test`-loaded `DATABASE_URL`, so a server accidentally left running
via plain `npm run dev` (real `.env`, real mail) gets caught before any
test runs against it, not after.

**`nodemon.json`** ignores `tests/**` — editing a test file no longer
restarts the running server mid-suite (a real issue found in this repo's
own history: the default nodemon watch is the whole `backend/` directory,
and a mid-run restart drops the test process's in-flight HTTP connections
with `ECONNRESET`/`ECONNREFUSED`). Backend source changes still restart it
as normal.

Plain `npm run dev`/`node server.js` (no `ENV_FILE`, no `MOCK_EMAIL_TRANSPORT`)
loads `.env` (production) and sends real mail, unchanged — that's what you
want for manual browser QA against production, and what's required for the
two real-delivery tests below. **Never run `npm test` against a server
started this way.**

## What these tests assume — read before running

- **The right server for what you're testing.** Normal test runs (create,
  submit, verify, scheduler, acknowledge, etc.) must hit a server started
  with `npm run dev:test-server`, not `npm run dev` — see above. The suite
  does not spawn the server itself; `before()` pings `/health` (server is
  up) and `/api/_test/db-host` (server is on the test branch) and fails
  fast with a clear message if either check fails. Override the target
  with `TEST_API_BASE_URL`.
- **The Neon `test` branch, never production.** `test-helper.js` loads
  `.env.test`, not `.env`, and `tests/helpers/db-safety-guard.js`'s
  `assertDatabaseIsNotProduction()` runs at import time — before any test
  executes — comparing `.env.test`'s DB host against `.env`'s. If they
  ever match (or `.env.test` is missing/misconfigured), the whole run
  aborts immediately with a clear error rather than silently touching
  production. Proven in isolation by `db-safety-guard.test.js` (doesn't
  depend on `test-helper.js`, so it isn't itself blocked by what it's
  testing). Tests use disposable rows (compliance categories/items, one
  throwaway user) tracked and deleted in `after()` hooks — not a DB
  transaction rollback, since each HTTP request commits in the *server's*
  connection, not the test's.
- **Emails are mocked by default, project-wide — not just compliance.**
  `notification-service.js`'s `sendEmail()` is the one shared function every
  notify* helper in every module (CRM, PO, QMS, engineering, compliance,
  etc.) eventually calls, so gating there covers all of them. A normal
  `npm test` run against a `dev:test-server`-started backend makes **zero**
  real Resend API calls. Assertions poll `waitForMockEmail()`
  (`GET /api/_test/email-log`) instead of scraping server logs or reasoning
  about DB rows as a proxy for "an email was sent" — a more precise check,
  not just a cheaper one.
- **The two exceptions that still hit live Resend, and only when
  explicitly un-skipped:** `compliance-approval-workflow.test.js`'s
  self-approval and reject notification tests
  (`SKIP_EMAIL_DELIVERY_TESTS=false`) are the ONLY tests meant to exercise
  real delivery. Running them requires the server to be started WITHOUT
  `MOCK_EMAIL_TRANSPORT` (i.e. `npm run dev`, not `dev:test-server`) — with
  the mock on, `sendEmail()` never reaches Resend at all and
  `waitForResendEmail()` would just time out finding nothing. Resend's
  daily send quota is real and shared across every ad hoc verification
  script and test run in this project's history; these two tests are
  skipped by default for exactly that reason.
- **`TEST_ADMIN_EMAIL` / `TEST_ADMIN_PASSWORD`** must be set (already added to
  the gitignored `backend/.env`) — the one real login the suite exercises.
- The `junior_accountant`/`cfo`/`manager` actors in these tests are **not**
  logged in with real passwords. `signTokenForRole()` looks up whichever real,
  active user currently holds that role and signs a token for them directly
  (same secret/shape as a real login). This is a deliberate difference from
  the ad hoc chat-session scripts these tests were ported from, which reset
  real employees' passwords to log in as them — acceptable for a one-off
  session, not for something `npm test` does on every run.

## Files

- `helpers/test-helper.js` — shared login/token/cleanup/Resend-polling logic.
  Loads `.env.test` and runs the production-safety guard at import time.
- `helpers/db-safety-guard.js` — the guard logic itself, pure and dependency-free
  so `db-safety-guard.test.js` can exercise it without depending on
  `test-helper.js` (which would trigger the real check).
- `db-safety-guard.test.js` — proves the safety guard works, with fake
  temp files, not real `.env`/`.env.test`.
- `compliance-date-math.test.js` — pure date-only arithmetic
  (`nextDueDateClamped`/`validateDateOnly`), no DB/server needed; run it
  under multiple `TZ` values to prove it's timezone-independent (see the
  file's own header comment for the exact commands).
- `compliance-approval-workflow.test.js` — evidence/verify self-approval-style
  workflow (admin/cfo cross-verification, return-evidence), and the
  recurrence-rule bootstrap on category approval.
- `compliance-categories.test.js` / `compliance-category-approval.test.js` —
  category CRUD, obligation_kind, approve/reject role gates and self-approval.
- `compliance-return-resubmit.test.js` — the legacy DRAFT -> submit ->
  PENDING_APPROVAL -> approve/reject/return -> resubmit machinery, still
  live for grandfathered rows; exercised via `createLegacyDraftItem` (a raw
  insert), since `createComplianceItem` no longer produces a DRAFT item for
  any new one (see `compliance-service.js`'s `NEW_VOCABULARY_STATUSES`).
- `compliance-evidence.test.js` — PDF evidence upload/download, role/item
  visibility scoping.
- `compliance-scheduler.test.js` — scheduler webhook, reminder ladder,
  NON_COMPLIANT/escalation, monthly recurrence, 12-month re-approval
  reminder, acknowledgement. Items are created directly at UPCOMING (the
  new model's starting state) via `createComplianceItem`, not the legacy
  DRAFT/submit/approve chain.
- `role-permissions.test.js` — Phase 1.5 role-drift / permission-boundary checks.

## Compliance scheduler — production activation gate

`POST /api/compliance/scheduler/run` (the webhook `compliance-scheduler.test.js`
exercises) is meant to be called on a daily schedule by an external cron
service, authenticated via the `X-Scheduler-Secret` header matching
`COMPLIANCE_SCHEDULER_SECRET`.

**Status as of 2026-09-15: both conditions below are now met. The only
remaining step is a human actually configuring the external cron service —
this repo has no part in that action and can't verify it from here.**

The two conditions that originally gated this (kept here as a record, not
because either is still open):

1. ~~IT confirms `pmakombe@vilag.io` (CFO) is a live, receiving mailbox~~ —
   confirmed. A real, unredirected send to her address on 2026-09-15
   resolved to `last_event: "delivered"` (polled via `emails.get(id)` to a
   terminal state, not inferred from `emails.list()`).
2. ~~Cleared from Resend's suppression list, with a confirmed Delivered
   send~~ — cleared via `DELETE https://api.resend.com/suppressions/{email}`
   (documented, API-accessible; no dashboard action was needed), then
   confirmed via (1).

If her mailbox ever regresses (goes quiet again, gets re-suppressed after a
future bounce), that's a new problem to re-diagnose from scratch — this
gate reflects a point-in-time confirmation, not a permanent guarantee.
`COMPLIANCE_SCHEDULER_SECRET` was also confirmed live and matching between
`backend/.env` and Render's production environment as of the same session.

`COMPLIANCE_TEST_NOTIFICATION_OVERRIDE` (see `notification-service.js`) lets
compliance-module sends be redirected to one address for a controlled test
window, without changing who the code decides to notify — useful for
re-verifying the pipeline against a known-good address without depending on
the gate above. Must stay unset in Render's production environment except
during a deliberate, time-boxed test.
