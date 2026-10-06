# Rehearsal: training reconcile requests (Session L, Step 6)

For Kochez to run himself against the fresh Neon rehearsal branch, after
applying `REHEARSAL_combined_training_deploy.sql`. Not executed by Claude —
these need Kochez's own admin login, not a minted token.

## 1. Log in (get your own token)

```bash
curl -s -X POST https://<rehearsal-api-host>/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"<your admin email>","password":"<your password>"}'
```

Copy the `token` field from the response into `$TOKEN` below.

## 2. Dry run (writes nothing — confirms the numbers before committing to anything)

```bash
curl -s -X POST https://<rehearsal-api-host>/api/qms/training/reconcile \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{}'
```

`dryRun` defaults to `true` when omitted — this call is guaranteed not to
write. Compare the response's totals (`to_create`/`to_void` per user) against
this document's baseline: **74 create / 34 void / 9 active users** on the
current test branch. Report the rehearsal branch's numbers and explain any
difference (different active-user roster, different RELEASED document set,
etc. — see Session L report for what to check).

## 3. Live run (only after the dry run looks right and you've decided to proceed)

```bash
curl -s -X POST https://<rehearsal-api-host>/api/qms/training/reconcile \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"dryRun": false}'
```

The response includes `auditId` — the audit_log row for this run. Keep it:
`node scripts/undo-training-reconcile.js <auditId> --yes` reverses exactly
this run (restores voided tasks to PENDING, deletes the tasks it created —
skipping anything a real person has since completed in the meantime).
