# backend/tests/

Integration tests using Node's built-in test runner (`node:test` +
`node:assert`) — no Jest/Mocha added; this repo has zero test
dependencies today and the suite is small enough not to need one. If it
grows into something needing shared config, custom matchers, or watch-mode
DX, revisit that choice explicitly rather than letting it happen by default.

## Running

```
cd backend
npm run dev:test-server   # starts the server with MOCK_EMAIL_TRANSPORT=true
npm test                  # in a second terminal
```

`npm run dev:test-server` is `nodemon server.js` with `MOCK_EMAIL_TRANSPORT=true`
set — every `sendEmail()` call records `{to, subject, timestamp}` in-memory
instead of calling Resend, and a debug route (`GET /api/_test/email-log`,
only mounted when this flag is on) lets the test process read what was
recorded. Plain `npm run dev`/`node server.js` (no flag) still sends real
mail, unchanged — that's what you want for manual QA in a browser, and it's
also what's required for the two real-delivery tests below.

## What these tests assume — read before running

- **The right server for what you're testing.** Normal test runs (create,
  submit, approve, scheduler, acknowledge, etc.) should hit a server started
  with `npm run dev:test-server`, not `npm run dev` — see above. The suite
  does not spawn the server itself; `before()` pings `/health` and fails
  fast with a clear message if nothing answers. Override the target with
  `TEST_API_BASE_URL`.
- **The real, live Neon database** — the same one `DATABASE_URL` in `.env`
  points at for local dev. **There is no separate test database.** Tests use
  disposable rows (compliance categories/items, one throwaway user) tracked
  and deleted in `after()` hooks — not a DB transaction rollback, since each
  HTTP request commits in the *server's* connection, not the test's. Do not
  run this suite against a database you can't afford to have real rows
  briefly appear in.
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
- `compliance-approval-workflow.test.js` — Phase 2 approval workflow.
- `compliance-scheduler.test.js` — Phase 3/4 scheduler webhook, reminder
  ladder, NON_COMPLIANT/escalation, monthly recurrence, 12-month
  re-approval reminder, acknowledgement.
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
