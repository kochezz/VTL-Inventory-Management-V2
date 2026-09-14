# backend/tests/

Integration tests using Node's built-in test runner (`node:test` +
`node:assert`) — no Jest/Mocha added; this repo has zero test
dependencies today and the suite is small enough not to need one. If it
grows into something needing shared config, custom matchers, or watch-mode
DX, revisit that choice explicitly rather than letting it happen by default.

## Running

```
cd backend
npm run dev          # or: node server.js — must be running first
npm test             # in a second terminal
```

## What these tests assume — read before running

- **A dev server already running** on `http://localhost:3001` (override with
  `TEST_API_BASE_URL`). The suite does not spawn the server itself; `before()`
  pings `/health` and fails fast with a clear message if nothing answers.
- **The real, live Neon database** — the same one `DATABASE_URL` in `.env`
  points at for local dev. **There is no separate test database.** Tests use
  disposable rows (compliance categories/items, one throwaway user) tracked
  and deleted in `after()` hooks — not a DB transaction rollback, since each
  HTTP request commits in the *server's* connection, not the test's. Do not
  run this suite against a database you can't afford to have real rows
  briefly appear in.
- **Real emails send.** Notification checks poll the real Resend API
  (`resend.emails.list()`) for the actual sent message — not a mock. Running
  the compliance-approval-workflow suite sends real "Self-Approved — Review
  Required" / "Compliance Item Rejected" / etc. emails to whoever currently
  holds the admin/cfo roles in the DB. Resend's daily send quota is real and
  shared across every one of this repo's ad hoc verification scripts and
  test runs — the two real-delivery tests in
  `compliance-approval-workflow.test.js` are conditionally skipped
  (`SKIP_EMAIL_DELIVERY_TESTS`, defaults to skipping) whenever that quota is
  down, since a 429 there means nothing about the code's correctness.
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
`COMPLIANCE_SCHEDULER_SECRET`. As of the Phase 3/4 pre-merge session
(2026-09-14), the webhook and its logic are merged and tested, but **the
external cron trigger has deliberately NOT been configured in production.**

**Do NOT configure the external cron to call `/api/compliance/scheduler/run`
in production until BOTH:**

1. **IT confirms `pmakombe@vilag.io` (CFO) is a live, receiving mailbox** —
   it currently has no mailbox provisioned on the company mail platform, so
   Resend has permanently suppressed it after early bounces.
2. **Her address has been manually cleared from Resend's suppression list**
   (a human action in Resend's dashboard, not something a script can do —
   it requires the mailbox to exist first) **and a real test send to it
   shows Delivered, not Suppressed.**

Until both are true, a live scheduler run's reminder/escalation/re-approval
emails will silently fail to reach the CFO for every send that includes her,
even though the webhook itself will report success. This is a manual gate
for a human to clear — not something a future session should resolve by
guessing the mailbox is probably fine by now.

`COMPLIANCE_TEST_NOTIFICATION_OVERRIDE` (see `notification-service.js`) lets
compliance-module sends be redirected to one address for a controlled test
window, without changing who the code decides to notify — useful for
re-verifying the pipeline against a known-good address without depending on
the gate above. Must stay unset in Render's production environment except
during a deliberate, time-boxed test.
