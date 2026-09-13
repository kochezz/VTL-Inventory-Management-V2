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
  holds the admin/cfo roles in the DB.
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
- `role-permissions.test.js` — Phase 1.5 role-drift / permission-boundary checks.
