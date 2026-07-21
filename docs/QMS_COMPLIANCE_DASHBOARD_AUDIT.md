# QMS Compliance Dashboard — Data Accuracy Audit

**Date:** 2026-07-21
**Scope:** Read-only audit. No code, schema, or data was modified. All DB queries were `SELECT`-only, run directly against the live Neon Postgres instance via the app's own connection pool.
**Verified against:** current code on `main` and live DB state, not README.md / BackEnd_Details.txt / FrontEnd_Details.txt (stale).

---

## Summary of root cause

The Compliance Dashboard (`/qms/compliance`) is fed by a Postgres **view**, `qms_compliance_summary`, that only returns **5 columns**:

```
active_docs, ncr_open, capa_open, capa_closed, pending_training
```

The dashboard's backend service and frontend expect **13 fields** on that same object (`overdue_review`, `due_within_30d`, `training_pending`, `training_completed`, `ncr_closed`, `total_docs`, `released`, `withdrawn`, `ncr_aged_open`, `capa_overdue`, `in_review`, plus the two that do exist: `ncr_open`, `capa_open`/`capa_closed`). Every missing field silently resolves to `undefined` in JS, which the frontend's `n()` helper (`parseInt(v) || 0`) coerces to `0`. That single stale view is the entire bug — no application code, caching layer, case/whitespace mismatch, or broken FK join is involved.

This view is **not defined anywhere in the repo** (no migration, no SQL file) — it exists only inside the database itself, evidently created for an earlier, narrower version of the dashboard and never updated when the Phase 4 Compliance Dashboard (which needs many more fields) was built on top of it.

---

## 1. Exact route + service chain powering the dashboard

| Layer | File | Function/Route |
|---|---|---|
| Frontend page | `frontend/app/qms/compliance/page.tsx` | `fetchData()` → `api.get('/qms/compliance')` |
| Backend route | `backend/src/routes/qms-routes.js:130-139` | `router.get('/compliance', ...)` → calls `qmsService.getComplianceDashboard()` |
| Service | `backend/src/services/qms-service.js:1724-1763` | `getComplianceDashboard()` |

`getComplianceDashboard()` runs 4 parallel queries against 4 DB **views** (not tables, not qms-service SQL written inline):

```js
const [summary, deptTraining, ncrAge, reviewCal] = await Promise.all([
  pool.query(`SELECT * FROM qms_compliance_summary`),
  pool.query(`SELECT * FROM qms_dept_training_compliance`),
  pool.query(`SELECT * FROM qms_ncr_age_analysis LIMIT 50`),
  pool.query(`SELECT * FROM qms_review_calendar`),
]);
```

These four view names appear **nowhere else in the codebase** except this one function — they are pure DB objects, undocumented and unversioned in source control. Confirmed via `pg_views` — all four exist as ordinary (non-materialized) views, `pg_matviews` returned zero rows.

---

## 2. Actual query logic per metric (live `pg_get_viewdef` output)

### `qms_compliance_summary` (drives the `summary` stat cards + overall score)

```sql
SELECT
  (SELECT count(*) FROM qms_documents WHERE status = 'RELEASED')                         AS active_docs,
  (SELECT count(*) FROM qms_ncr WHERE status = ANY (ARRAY['OPEN','CAPA_REQUIRED']))        AS ncr_open,
  (SELECT count(*) FROM qms_capa WHERE status = ANY (ARRAY['OPEN','IN_PROGRESS']))          AS capa_open,
  (SELECT count(*) FROM qms_capa WHERE status = ANY (ARRAY['VERIFIED','CLOSED']))           AS capa_closed,
  (SELECT count(*) FROM qms_training_tasks WHERE status = 'PENDING')                        AS pending_training;
```

That's **all** it computes. There is no `in_review`, `overdue_review`, `due_within_30d`, `total_docs`, `released`, `withdrawn`, `ncr_closed`, `ncr_aged_open`, `capa_overdue`, or `training_completed` column — despite the frontend reading all of them off `data.summary`.

### `qms_dept_training_compliance` (Training Completion by Department panel)

```sql
SELECT u.department,
  count(tt.task_id)                                                    AS total_tasks,
  count(tt.task_id) FILTER (WHERE tt.status = 'COMPLETED')             AS completed_tasks,
  count(tt.task_id) FILTER (WHERE tt.status = 'PENDING')                AS pending_tasks,
  COALESCE(round(count(...COMPLETED...) / NULLIF(count(tt.task_id),0) * 100, 1), 0) AS compliance_percentage
FROM users u
LEFT JOIN qms_training_tasks tt ON u.user_id = tt.user_id
WHERE u.is_active = true AND u.department IS NOT NULL
GROUP BY u.department;
```
This one is correctly built (`LEFT JOIN`, no FK-cast issue — see §3) and matches what the frontend consumes (`dept.completed_tasks`, `dept.total_tasks`, `dept.completion_pct`... — **note**: the frontend reads `dept.completion_pct`, but the view outputs `compliance_percentage`. That field is also silently `undefined` → `parseFloat(undefined) || 0` → renders `0%` for every department bar, a second, independent bug in the same feature area — see §5.)

### `qms_ncr_age_analysis` (NCR Age Analysis panel, feeds `ncr_age_bands`)

```sql
SELECT ncr_id, ncr_code, description, severity, status, created_at,
  EXTRACT(day FROM CURRENT_TIMESTAMP - created_at) AS days_open,
  CASE
    WHEN status = ANY (ARRAY['CLOSED','VERIFIED']) THEN 'closed'
    WHEN days_open > 90 THEN 'critical'
    WHEN days_open > 60 THEN 'overdue'
    WHEN days_open > 30 THEN 'aging'
    ELSE 'recent'
  END AS age_band
FROM qms_ncr;
```
This is self-contained (no joins) and correctly typed. Not implicated in the reported symptom.

### `qms_review_calendar` (Review Calendar / "due within 30d" ribbon)

```sql
SELECT d.doc_id, d.doc_code, d.doc_name, d.doc_type, d.doc_owner AS department,
  v.version_number, v.review_due_date,
  EXTRACT(year FROM v.review_due_date) AS due_year,
  EXTRACT(month FROM v.review_due_date) AS due_month,
  CASE
    WHEN v.review_due_date < CURRENT_TIMESTAMP THEN 'overdue'
    WHEN v.review_due_date < CURRENT_TIMESTAMP + '30 days' THEN 'critical'
    WHEN v.review_due_date < CURRENT_TIMESTAMP + '90 days' THEN 'soon'
    ELSE 'scheduled'
  END AS urgency
FROM qms_documents d
JOIN qms_document_versions v ON d.current_version_id = v.version_id
WHERE d.status = 'RELEASED' AND v.review_due_date IS NOT NULL;
```
This view *is* correct and does return real overdue/due-soon rows — **but `getComplianceDashboard()` never turns it into the `overdue_review` / `due_within_30d` counts the KPI cards read.** It's aggregated server-side into `urgency_counts` (`overdue`, `critical`, `soon`, `scheduled` — computed in `qms-service.js:1744-1745`) and returned as `data.urgency_counts`, plus the raw rows as `data.calendar_all`. But the frontend's KPI cards read `s.overdue_review` and `s.due_within_30d` off `data.summary` (i.e., off `qms_compliance_summary`), **not** `data.urgency_counts` off `data.calendar_all`. So the correct numbers are computed and shipped in the response payload, just under a key (`urgency_counts.overdue` / `urgency_counts.critical`) the KPI cards never look at.

---

## 3. Cross-checks against the schema/data

**a) Case/whitespace mismatches (the `sales_transactions.status`-style bug)** — **Ruled out.** Queried `qms_documents.status` directly:

| status | length | `status = TRIM(status)` | count |
|---|---|---|---|
| DRAFT | 5 | true | 6 |
| PENDING_APPROVAL | 16 | true | 4 |
| PLANNED | 7 | true | 72 |
| RELEASED | 8 | true | 26 |
| REVIEW | 6 | true | 25 |
| WITHDRAWN | 9 | true | 9 |

No padding, consistent casing. `COUNT(*) WHERE status = 'REVIEW'` (exact) and `COUNT(*) WHERE TRIM(UPPER(status)) = 'REVIEW'` (defensive) both return **25**. TRIM/case-insensitivity is not needed anywhere in this dashboard's queries — that pattern doesn't apply here.

**b) Caching layer** — **Ruled out.** `grep`'d `qms-service.js` for `cache|Cache|memoize` — zero matches. `getComplianceDashboard()` runs four `pool.query()` calls straight to Postgres on every request; there's no in-memory cache, no materialized view (`pg_matviews` returned 0 rows for `qms_%`), nothing analogous to the known assembled-document caching bug. The dashboard is not stale — it's just querying an incomplete view.

**c) Document-level vs version-level "in review"** — Neither, currently (the view has no `in_review` column at all). But if/when this gets fixed, note the two levels **disagree by 1**:
- `qms_documents.status = 'REVIEW'` → **25**
- `qms_document_versions.status = 'REVIEW'` → **26**

A document can have multiple versions in its history; the version-level count includes REVIEW-status version rows that aren't necessarily the document's `current_version_id` (e.g., a historical draft chain), so the two are not interchangeable. Whichever level a fix uses will matter for correctness — flagging it, not fixing it.

**d) FK joins to `users` — `::uuid` cast risk** — **Not applicable to this view chain.** `qms_compliance_summary` has no joins at all (five uncorrelated subqueries). The only view in this chain that joins to `users` is `qms_dept_training_compliance`, and it's already a `LEFT JOIN` (not silently dropping departments with a broken `INNER JOIN`). Checked column types directly: `qms_training_tasks.user_id` is native `uuid`, matching `users.user_id` — no `character varying` vs `uuid` mismatch, no cast needed, no rows silently dropped.

---

## 4. Reproducing the discrepancy

Direct read-only query against the live DB, same moment:

```sql
SELECT COUNT(*) FROM qms_documents WHERE status = 'REVIEW';
-- => 25
```

What `/qms/compliance` actually returns for `summary.in_review`:

```
undefined  →  frontend n() coerces to 0  →  "In Review: 0"
```

**Delta: 25 documents in REVIEW status, dashboard displays 0.**

Same pattern for the other zeroed/wrong metrics, using the actual current view row returned by `qms_compliance_summary`:

```json
{ "active_docs": "26", "ncr_open": "1", "capa_open": "0", "capa_closed": "1", "pending_training": "97" }
```

| Dashboard field read | Present in view row? | Resulting displayed value | Why |
|---|---|---|---|
| `in_review` | No | **0** | field doesn't exist → `undefined` → `n()` → 0 |
| `overdue_review` | No | **0** | same |
| `due_within_30d` | No | **0** | same (real value is computable from `urgency_counts`, just not wired up) |
| `total_docs` | No | **0**, drives `releasedPct = 0` → "Document readiness: 0%" | `releasedPct` ternary checks `n(s.total_docs) > 0`; false when undefined, so it hard-codes 0% instead of computing anything |
| `released` | No | **0** ("Released Docs" KPI shows 0 too, not just readiness %) | same root cause |
| `training_pending` | No (view has `pending_training`, a **name mismatch**, not just a missing field — 97 pending training tasks exist and are computed, just under the wrong key) | **0** | key mismatch |
| `training_completed` | No | **0** → `trainingPct` defaults to **100%** (divide-by-zero fallback) | `totalTraining = n(completed)+n(pending) = 0` → ternary defaults to 100, not because training is actually complete |
| `capa_overdue` | No | **0** → CAPA timeliness sub-score defaults to **100%** | same divide-by-zero-style fallback pattern |
| `ncr_closed` | No | **0** | NCR closure % is computed as `0 / (ncr_open+0) = 0%`, using the real `ncr_open=1` but a fabricated `ncr_closed=0` |

This also explains the "other metrics at 100%" part of the symptom: it's not that those sub-scores are genuinely perfect, it's that two of the four weighted sub-scores (training completion, CAPA timeliness) hit divide-by-zero fallbacks that default to 100 when their numerator/denominator inputs are missing — masking real numbers (97 pending training tasks; whatever the true CAPA-overdue count is) behind a false "fully compliant" reading.

---

## 5. Every place completion/compliance stats are calculated — confirmed divergence

Three **independent, non-shared** implementations exist, each queried by a different frontend surface:

| Function | File | Route | Consumed by | What it actually computes for "in review" |
|---|---|---|---|---|
| `getCompletionStats()` | `qms-service.js:149` | `GET /qms/stats` | `frontend/app/qms/page.tsx` (QMS home) | Per-section breakdown, inline query with `COUNT(...) FILTER (WHERE d.status = 'REVIEW')` — correct, live, per-`qms_sections` group |
| `getDashboardSummary()` | `qms-service.js:1181` | `GET /qms/dashboard-summary` | `frontend/app/qms/page.tsx` (QMS home) | `(SELECT COUNT(*) FROM qms_documents WHERE status = 'REVIEW') AS total_in_review` — a **correct, real-time** count (would return 25 right now) |
| `getComplianceDashboard()` | `qms-service.js:1724` | `GET /qms/compliance` | `frontend/app/qms/compliance/page.tsx` (Compliance Dashboard — the broken one) | Relies on the stale `qms_compliance_summary` view, which has no in-review concept at all |

So the QMS home page (`/qms`) is already computing the correct "in review" and other counts today, independently, via `getDashboardSummary()` — it just isn't the function wired into the Compliance Dashboard. The three implementations don't share a query, a helper, or a source of truth, so they will keep drifting independently: e.g. `getCompletionStats()` excludes `WITHDRAWN` docs entirely from its denominator, `getDashboardSummary()` excludes `WITHDRAWN`+`PLANNED` from `total_active`, and `qms_compliance_summary`'s `active_docs` only counts `RELEASED` — three different definitions of "how many documents count," none of which agree, and none of which is documented as canonical.

---

## Findings recap (no changes made)

1. **Root cause**: `qms_compliance_summary` — a DB-only view not tracked in source control — returns 5 columns; the Compliance Dashboard code path needs 13. Every missing field silently renders as 0 (or, via divide-by-zero fallbacks, a misleading 100%) in the frontend.
2. **Secondary bug in the same feature**: `qms_dept_training_compliance` outputs `compliance_percentage`; the frontend reads `dept.completion_pct` — another silent key mismatch, causing every department's training bar to render 0% regardless of actual data.
3. **Not the cause**: case/whitespace status mismatches (ruled out — data is clean), caching/staleness (ruled out — no cache layer, no materialized view, queries run live), broken `::uuid` FK joins (ruled out — the one user-table join is a correct `LEFT JOIN` on matching `uuid` types).
4. **Confirmed drift**: three separate, uncoordinated implementations of "compliance stats" exist across `qms-service.js` (`getCompletionStats`, `getDashboardSummary`, `getComplianceDashboard`), each with its own definition of active/in-review/released document counts.
5. **Available fix material**: `getDashboardSummary()` already contains correct, live logic for `total_in_review`, `total_released`, `training_pending`, `ncr_open`, `capa_open`; and `getComplianceDashboard()` already computes `urgency_counts.overdue`/`urgency_counts.critical` from `qms_review_calendar` — those values exist in the API response today under different keys than what the Compliance Dashboard's KPI cards read. No new query logic would need to be invented to fix this, just alignment between the `qms_compliance_summary` view's columns (or a replacement inline query) and the field names `frontend/app/qms/compliance/page.tsx` already expects.

---

## Addendum — follow-up audit (still read-only)

### 1. Field-by-field comparison of all three "stats" functions

**`getCompletionStats()`** — `qms-service.js:149` — route `GET /qms/stats` — consumed by `frontend/app/qms/page.tsx` (QMS home). Inline SQL, grouped per section (no DB view involved):

```sql
SELECT s.section_id, s.section_code, s.section_name, s.color_code, s.sort_order,
  COUNT(d.doc_id)                                       AS total_docs,
  COUNT(d.doc_id) FILTER (WHERE d.status='RELEASED')    AS released_docs,
  COUNT(d.doc_id) FILTER (WHERE d.status='APPROVED')    AS approved_docs,
  COUNT(d.doc_id) FILTER (WHERE d.status='REVIEW')      AS review_docs,
  COUNT(d.doc_id) FILTER (WHERE d.status='DRAFT')       AS draft_docs
FROM qms_sections s
LEFT JOIN qms_documents d ON s.section_id = d.section_id AND d.status != 'WITHDRAWN'
GROUP BY s.section_id
```
Returned shape: `{ overall_completion, total_documents, total_released, sections: [{ section_id, section_code, section_name, color_code, sort_order, total_docs, released_docs, approved_docs, review_docs, draft_docs, completion_percentage }] }`

**`getDashboardSummary()`** — `qms-service.js:1181` — route `GET /qms/dashboard-summary` — also consumed by `frontend/app/qms/page.tsx`. Inline SQL, single flat row, no DB view:

```sql
SELECT
  (SELECT COUNT(*) FROM qms_documents WHERE status='RELEASED')                         AS total_released,
  (SELECT COUNT(*) FROM qms_documents WHERE status='REVIEW')                           AS total_in_review,
  (SELECT COUNT(*) FROM qms_documents WHERE status='DRAFT')                            AS total_in_draft,
  (SELECT COUNT(*) FROM qms_documents WHERE status NOT IN ('WITHDRAWN','PLANNED'))     AS total_active,
  (SELECT COUNT(*) FROM qms_review_tasks WHERE status='OPEN')                          AS review_tasks_open,
  (SELECT COUNT(*) FROM qms_review_tasks WHERE status='OPEN' AND due_date < NOW())     AS overdue_count,
  (SELECT COUNT(*) FROM qms_training_tasks WHERE status='PENDING')                     AS training_pending,
  (SELECT COUNT(*) FROM qms_ncr WHERE status='OPEN')                                   AS ncr_open,
  (SELECT COUNT(*) FROM qms_capa WHERE status='OPEN')                                  AS capa_open
```
Returned shape: `{ total_released, total_in_review, total_in_draft, total_active, review_tasks_open, overdue_count, training_pending, ncr_open, capa_open }`

**`getComplianceDashboard()`** — `qms-service.js:1724` — route `GET /qms/compliance` — the `summary` object comes entirely from the `qms_compliance_summary` DB view:

Returned shape: `{ active_docs, ncr_open, capa_open, capa_closed, pending_training }`

#### Side-by-side field matrix

| Field (canonical concept) | `getCompletionStats` | `getDashboardSummary` | `getComplianceDashboard`.summary | What the Compliance Dashboard frontend actually reads |
|---|---|---|---|---|
| released doc count | `total_released` (top-level) / `released_docs` (per-section) | `total_released` | `active_docs` *(different name, same concept: `status='RELEASED'`)* | `s.released` — **present in none of the three under that exact key** |
| in-review doc count | `review_docs` (per-section only) | `total_in_review` ✅ correct, live | — *(absent)* | `s.in_review` — **absent from the view that actually feeds this page** |
| draft doc count | `draft_docs` (per-section only) | `total_in_draft` | — | not read by Compliance Dashboard |
| approved doc count | `approved_docs` (per-section only) | — | — | not read |
| total/active doc count | `total_documents` (top-level, excludes WITHDRAWN) | `total_active` (excludes WITHDRAWN **and** PLANNED — different denominator!) | — | `s.total_docs` — **absent** |
| withdrawn count | — | — | — | `s.withdrawn` — **absent from all three** |
| overdue *document reviews* (review_due_date passed) | — | — | — (exists only as `urgency_counts.overdue`, computed separately from `qms_review_calendar`, not merged into `summary`) | `s.overdue_review` — **absent from `summary`; a same-concept number exists elsewhere in the same payload under `urgency_counts.overdue`** |
| overdue *review tasks* (workflow queue) | — | `overdue_count` ⚠️ **different metric** — counts `qms_review_tasks` rows past `due_date`, not documents past `review_due_date` | — | not read (would be a false substitute if used for `overdue_review`) |
| due within 30 days | — | — | — (exists as `urgency_counts.critical`, not merged) | `s.due_within_30d` — **absent** |
| training pending | — | `training_pending` ✅ correct, live | `pending_training` *(same concept, different key name)* | `s.training_pending` — **absent under that exact key; the number exists as `pending_training`** |
| training completed | — | — | — | `s.training_completed` — **absent from all three** |
| NCR open | — | `ncr_open` | `ncr_open` ✅ present, matches | `s.ncr_open` — **present and correct** |
| NCR closed | — | — | — | `s.ncr_closed` — **absent from all three** (a per-record version exists via the separate `qms_ncr_age_analysis`/`ncr_records` payload, uncounted) |
| NCR aged-open (>30d) | — | — | — | `s.ncr_aged_open` — **absent** (derivable from `ncr_records`/`ncr_age_bands`, not merged into `summary`) |
| CAPA open | — | `capa_open` | `capa_open` ✅ present, matches | `s.capa_open` — **present and correct** |
| CAPA closed | — | — | `capa_closed` ✅ present | `s.capa_closed` — **present and correct** |
| CAPA overdue | — | — | — | `s.capa_overdue` — **absent from all three** |

Fields **exclusive** to each function (nothing else has them):
- `getCompletionStats`: the entire per-section breakdown (`section_id/code/name/color_code/sort_order`, `approved_docs`, `draft_docs`, per-section `completion_percentage`) — a dimension none of the others model at all.
- `getDashboardSummary`: `total_in_review` (correct, unused elsewhere), `total_in_draft`, `review_tasks_open`, `overdue_count` (a workflow-queue metric, not a document-review-due metric — see caution below).
- `getComplianceDashboard`/`qms_compliance_summary`: `active_docs` as a name (vs. `total_released`/`released_docs` elsewhere), `capa_closed` (the only one of the three that has it).

**Caution for any future fix**: `getDashboardSummary().overdue_count` is *not* a drop-in replacement for the Compliance Dashboard's intended `overdue_review`. It counts rows in `qms_review_tasks` (an internal workflow/assignment queue) with `status='OPEN' AND due_date < NOW()`, whereas the Compliance Dashboard's KPI card is captioned "Released docs past review date" and conceptually maps to `qms_review_calendar`'s `urgency='overdue'` bucket (built from `qms_document_versions.review_due_date`). These are two different tables and two different real-world concepts that happen to share the word "overdue" — wiring the wrong one in would compile and run without error but report the wrong number.

### 2. Live-computed values for the three symptom fields

| Field | Live correct value (direct `SELECT`) | What's actually in the API payload | Displayed on dashboard | Currently visible discrepancy? |
|---|---|---|---|---|
| `overdue_review` | **0** — `SELECT COUNT(*) FROM qms_documents d JOIN qms_document_versions v ON d.current_version_id=v.version_id WHERE d.status='RELEASED' AND v.review_due_date < CURRENT_TIMESTAMP` | not present in `summary` at all | 0 | **No, coincidentally.** All 26 released docs' review dates fall in the `qms_review_calendar` `scheduled` bucket (>90 days out) right now — cross-checked via `SELECT urgency, COUNT(*) FROM qms_review_calendar GROUP BY urgency`, which returned only `{scheduled: 26}`. The field is still structurally missing; today's true answer just happens to be 0 too, so the bug isn't currently visible on this one metric. It will misreport the moment any document's review date passes. |
| `due_within_30d` | **0** — same join, `v.review_due_date >= CURRENT_TIMESTAMP AND < CURRENT_TIMESTAMP + INTERVAL '30 days'` | not present in `summary` at all | 0 | **No, coincidentally** — same reasoning; the urgency-bucket cross-check confirms zero docs currently fall in the `critical` (30-day) band either. |
| `training_pending` | **97** — `SELECT COUNT(*) FROM qms_training_tasks WHERE status='PENDING'` (verified independently via a second query: `qms_training_tasks` rows with no matching `qms_training_records` acknowledgement for the same user/doc/version — also 97; `qms_training_tasks` totals 98 rows, 97 `PENDING` + 1 `COMPLETED`) | **present**, but under the key `pending_training`, not `training_pending` | 0 | **Yes — real, currently-visible bug.** 97 pending training tasks exist and are already computed and shipped in the response; the frontend just reads the wrong key name and silently gets `undefined → 0`. |

### 3. Provenance of `qms_compliance_summary` and the other three views

Searched full git history (`git log --all -S '<string>'`, i.e. pickaxe search across every commit, not just the current branch tip) for each view name and for the literal string `CREATE VIEW`. Results for all four view names, and for `CREATE VIEW`, converge on the **same four commits**:

| Commit | Date | Message | File changed |
|---|---|---|---|
| `4d757da` | — | Phase 1: Initial database foundation setup | (unrelated match) |
| `4be027a` | — | ERP Create Batch Successful | (unrelated match) |
| `8fd58dd` | 2026-04-12 | QMS Phase 4 Updated | `backend/src/services/qms-service.js` |
| `559f05d` | — | Drop Down Menu Updates to DEPT | `backend/src/services/qms-service - Copy.js` |
| `ab696cf` | — | Rolled back to working QMS version | `backend/src/services/qms-service - Copy.js` |
| `ee1283e` | — | Department Listing Update in QMS | `backend/src/services/qms-service - Copy.js` |

In every case, the only matching content is the JS query text `pool.query(`SELECT * FROM qms_compliance_summary`)` (and the equivalent for the other three view names) inside the service file(s) — **never** a `CREATE VIEW ...` statement, never a `.sql` file, never a docs file. `database/migrations/` contains exactly one file (`001_attendance_schema.sql`, unrelated to QMS). `database/schema.sql`, `backend/auth-schema.sql`, `backend/auth-missing-tables.sql` were also checked directly (full-repo grep for all four view names, separately from the pickaxe search) — no match in any of them either.

**Confirmed: these four views have zero source of truth in version control.** They exist purely as live objects in the Neon Postgres database, most plausibly created by hand (a direct `psql`/Neon SQL console session, or a local script that was run but never committed) at or before commit `8fd58dd` (2026-04-12, "QMS Phase 4 Updated" — the commit that first wired `getComplianceDashboard()` to query them). Whoever built the Phase 4 dashboard wrote the consuming JS code against a view they must have created out-of-band, and that view was apparently either an earlier draft (5 columns) that was never widened to match, or was copied from an even earlier, narrower stats concept and never revisited.

### 4. Sweep for other snake_case/camelCase field-name mismatches

Checked every other QMS frontend page against its backend source for the same class of bug (service returns snake_case SQL alias, frontend reads a different name):

| Frontend page | Backend source | Result |
|---|---|---|
| `frontend/app/qms/compliance/page.tsx` (dept-training panel) | `qms_dept_training_compliance` view — outputs `compliance_percentage` | **Mismatch confirmed** — frontend reads `dept.completion_pct` (`page.tsx:262`), which doesn't exist on the row. `parseFloat(undefined) \|\| 0` → every department's training bar renders **0%** regardless of real completion. Same bug family as the main dashboard bug, same root cause (nobody kept the view's column names and the frontend's expected keys in sync), different symptom. |
| `frontend/app/qms/page.tsx` (QMS home — `getCompletionStats` + `getDashboardSummary`) | inline SQL, no view | Clean — every field read (`stats.overall_completion`, `stats.total_released`, `stats.total_documents`, `summary.overdue_count`, etc.) matches its backend alias exactly. |
| `frontend/app/qms/training/page.tsx` | `getTrainingMatrix()` | Clean — no camelCase accessors found; all fields (`t.assigned_at`, `tr.date`, etc.) match returned row shape. |
| `frontend/app/qms/ncr/page.tsx` | `listNCRs()` | Clean. |
| `frontend/app/qms/capa/page.tsx` | `listCAPAs()` | Clean. |
| `frontend/app/qms/audits/page.tsx` | `listAudits()` | Clean. |
| `frontend/app/qms/hierarchy/page.tsx` | `getDocumentHierarchy()` | Clean. |
| `frontend/app/qms/documents/page.tsx` | `listDocuments()` | Clean. |
| `frontend/app/qms/review-calendar/page.tsx` | `getReviewCalendar()` | Clean — reads `d.due_year`, `d.due_month`, `doc.review_due_date`, all matching the view's actual column names. |
| `frontend/app/lab/page.tsx` (spot-checked as a comparable aggregate-stats dashboard outside QMS) | `getLabDashboardStats()` (`lab-service.js:458`) | Clean — `LabStats` interface (`tests_today`, `pending_qa_review`, `drafts_in_progress`, `valid_certs_today`, `failures_this_week`, `rejected_this_week`) matches the SQL aliases exactly, field for field. |

**Not exhaustive.** This pass covered every page inside the QMS module plus one comparable dashboard outside it (Lab). It did not check the HR, Sales, Inventory, or Production Reports modules — those were out of scope for this pass and would need the same page-by-page sweep to rule out. Within what was checked, the `compliance_percentage` / `completion_pct` mismatch on the Compliance Dashboard's department-training panel is the only other instance of this bug class found — it is not isolated to just the main `summary` object; it's a second, independent occurrence of the exact same failure mode (view column renamed/never-aligned with frontend expectation) inside the same page.

---

## Second addendum — database-wide view provenance audit (29 views, still read-only)

Scope: every one of the 29 views currently live in the database. For each: (a) full-text search of the entire repo working tree (not limited to `database/`/`migrations/` — `docs/`, `scripts/`, all `.sql`, and every other tracked file were searched) for a `CREATE VIEW`/`CREATE OR REPLACE VIEW` statement, and (b) `git log --all -S"<name>"` (pickaxe search — finds any commit that ever introduced or removed the string, including in branches/history no longer on `main`, and even if later deleted from the working tree).

### Provenance table

| View | In repo now (Y/N) | File : line | History-only commit(s) | Verdict |
|---|---|---|---|---|
| `view_available_stock` | N | — | none (0 pickaxe hits, 0 grep hits anywhere) | **Neither — fully unversioned, no trace ever** |
| `v_transaction_history` | Y | `database/schema.sql:523` | (also touched in `4d757da` 2026-01-13, `00f68e0`, `b957ef8`) | Versioned (Phase 1) — **but drifted**, see below |
| `v_current_stock` | Y | `database/schema.sql:451` | `4d757da` 2026-01-13 | Versioned (Phase 1) — matches live |
| `v_low_stock_items` | Y | `database/schema.sql:482` | `4d757da` 2026-01-13 | Versioned (Phase 1) — **but drifted**, see below |
| `v_expiring_batches` | Y | `database/schema.sql:503` | `4d757da` 2026-01-13 | Versioned (Phase 1) — **but drifted**, see below |
| `v_daily_scan_stats` | N | — | none | **Neither — fully unversioned, no trace ever** |
| `v_product_scan_history` | N | — | none | **Neither — fully unversioned, no trace ever** |
| `v_location_scan_activity` | N | — | none | **Neither — fully unversioned, no trace ever** |
| `v_pending_qa_approvals` | N | — | none | **Neither — fully unversioned, no trace ever** |
| `v_product_bom_details` | N | — | `4be027a` 2026-02-07 (only in `docs/06_Feb_COMPLETE_SESSION_HANDOFF.md` / `docs/FEB_COMPREHENSIVE_PROJECT_SUMMARY.md` prose, never a `CREATE VIEW`) | **Phantom — has a consumer, never a definition** (see below) |
| `ipqc_compliance_summary` | N | — | `2a50593` 2026-02-08 → `backend/src/services/production-service.js` query text only | **Phantom** |
| `ipqc_pending_qa_reviews` | N | — | `60cf1fe` 2026-02-12 → `production-service.js` query text only | **Phantom** |
| `batch_next_ipqc_stage` | N | — | `6547bbf` 2026-02-19 → `production-service.js` query text only | **Phantom** |
| `batch_record_completion` | N | — | `6547bbf` 2026-02-19 → `production-service.js` query text only | **Phantom** |
| `v_lab_test_summary` | N | — | none | **Neither — fully unversioned, no trace ever** |
| `v_sales_summary` | N | — | none | **Neither — fully unversioned, no trace ever** |
| `v_sku_sales_performance` | N | — | none | **Neither — fully unversioned, no trace ever** |
| `v_customer_sales_profile` | N | — | none | **Neither — fully unversioned, no trace ever** |
| `qms_compliance_summary` | N | — | `8fd58dd` 2026-04-12 → `qms-service.js` query text only (see first audit above) | **Phantom** |
| `qms_dept_training_compliance` | N | — | `8fd58dd` 2026-04-12 → `qms-service.js` query text only | **Phantom** |
| `qms_ncr_age_analysis` | N | — | `8fd58dd` 2026-04-12 → `qms-service.js` query text only | **Phantom** |
| `qms_review_calendar` | N | — | `8fd58dd` 2026-04-12 → `qms-service.js` query text only | **Phantom** |
| `v_hr_dashboard` | Y | `docs/HR Extension/vtl_hr_schema.sql:1266` | `f69467c`/`22cec32`/`df9d33a` 2026-05-11 | Versioned (HR module) — **but drifted**, see below |
| `v_hr_onboarding_tracker` | Y | `docs/HR Extension/vtl_hr_schema.sql:1355` | 2026-05-11 | Versioned — matches live (1 cosmetic change) |
| `v_hr_sop_compliance` | Y | `docs/HR Extension/vtl_hr_schema.sql:1397` | 2026-05-11 | Versioned — matches live (1 cosmetic change) |
| `v_hr_probation_schedule` | Y | `docs/HR Extension/vtl_hr_schema.sql:1431` | `7e071a1` 2026-05-15, 2026-05-11 | Versioned — matches live (1 cosmetic change) |
| `v_hr_holiday_summary` | N | — | `22cec32` 2026-05-11 → `backend/src/services/hr-service.js` query text only (plus session-notes prose) | **Phantom** |
| `v_hr_compliance_snapshot` | Y | `docs/HR Extension/vtl_hr_schema.sql:1506` | 2026-05-11 | Versioned (HR module) — **but heavily drifted**, see below |
| `v_hr_employee_profile` | N | — | `22cec32` 2026-05-11 / `5f389e0` 2026-05-15 → `hr-service.js` query text only (plus session-notes prose) | **Phantom** |

### Grouping

**Group A — genuinely versioned (9 of 29):** these have a real `CREATE VIEW` in the working tree today.
- **Phase 1 core** (`database/schema.sql`, commit `4d757da`, 2026-01-13): `v_current_stock`, `v_low_stock_items`, `v_expiring_batches`, `v_transaction_history`.
  **Correction to the README's claim:** the README lists 5 Phase-1 views including `view_available_stock`. That's wrong — `view_available_stock` has **zero** presence anywhere in `database/schema.sql`, anywhere else in the repo, or anywhere in git history (0 pickaxe hits). Only 4 of the 5 named views actually exist in `schema.sql`; `view_available_stock` belongs in the fully-unversioned group below, indistinguishable in provenance from the QMS phantom views.
- **HR module** (`docs/HR Extension/vtl_hr_schema.sql`, commits `f69467c`/`22cec32`/`df9d33a`, all 2026-05-11): `v_hr_dashboard`, `v_hr_onboarding_tracker`, `v_hr_sop_compliance`, `v_hr_probation_schedule`, `v_hr_compliance_snapshot`.

**Group B — "phantom" views: actively queried by tracked backend code, but never defined via `CREATE VIEW` anywhere in the repo's history (11 of 29):**
- QMS (4, first wired `8fd58dd` 2026-04-12): `qms_compliance_summary`, `qms_dept_training_compliance`, `qms_ncr_age_analysis`, `qms_review_calendar` — the subject of the first audit above.
- Production/IPQC (5, first traced `4be027a`/`2a50593`/`60cf1fe`/`6547bbf`, 2026-02-07 to 2026-02-19): `v_product_bom_details`, `ipqc_compliance_summary`, `ipqc_pending_qa_reviews`, `batch_next_ipqc_stage`, `batch_record_completion` — all consumed by `backend/src/services/production-service.js` (and several superseded `BKP`/`Archive` copies of it).
- HR (2, `22cec32`/`5f389e0`, 2026-05-11/15): `v_hr_employee_profile`, `v_hr_holiday_summary` — consumed by `backend/src/services/hr-service.js`. Notable: these two were built in the **same session** that correctly committed the other 5 HR views to `vtl_hr_schema.sql` (`f69467c`/`22cec32`/`df9d33a`), yet these two never made it into that file — this isn't an old/forgotten pattern, it recurred even while the "right way" was being done for sibling views in the same commit.

  **This is the same root-cause bug class as the QMS Compliance Dashboard issue, confirmed present in two more modules.** Any of these 11 views could be silently returning stale/incomplete/misaligned data the same way `qms_compliance_summary` is, with no way to audit or reproduce the deployed definition from source control.

**Group C — fully orphaned: no definition, no consumer, no mention anywhere in the repo's history at all (9 of 29):**
`view_available_stock`, `v_daily_scan_stats`, `v_product_scan_history`, `v_location_scan_activity`, `v_pending_qa_approvals`, `v_lab_test_summary`, `v_sales_summary`, `v_sku_sales_performance`, `v_customer_sales_profile`.

These differ from Group B in one important way: Group B views are at least *queried* by tracked application code (just not *defined* anywhere tracked). Group C views have **no trace at all** — not a definition, not a query, not a doc mention, in the current tree or in any past commit. Confirmed by a direct grep of the current working tree for all 8 names (`v_lab_test_summary`, `v_sales_summary`, `v_sku_sales_performance`, `v_customer_sales_profile`, `v_daily_scan_stats`, `v_product_scan_history`, `v_location_scan_activity`, `v_pending_qa_approvals`) returning zero file matches. They're live in Postgres and presumably queried by something (a BI tool, Retool/Metabase, a script, or a repo this codebase doesn't include) but nothing in *this* repository, past or present, defines or reads them.

### Drift check — versioned views vs. live deployed definitions

Diffed each of the 9 Group-A repo definitions against the live `pg_get_viewdef()` output pulled from the database:

| View | Result |
|---|---|
| `v_current_stock` | **Matches.** Only difference is Postgres's own cosmetic `::numeric` cast normalization in the CASE branches (`pg_get_viewdef` always re-renders literals with explicit casts) — not a real change. |
| `v_low_stock_items` | **Drifted — real semantic change.** Repo version aggregates `SUM(i.quantity_available) AS total_available` and gates on `HAVING SUM(quantity_available) <= reorder_point`. Live version aggregates a *different column* — `sum(i.quantity_on_hand) AS total_quantity` — and gates on `HAVING sum(quantity_on_hand) <= reorder_point`. `quantity_available` (on-hand minus allocated) and `quantity_on_hand` are not the same number; the deployed view now overstates availability by ignoring allocations. It also renamed the output column (`total_available` → `total_quantity`), added a `status` CASE column (CRITICAL/LOW/OK) the repo version doesn't have, added an `ORDER BY`, and switched `p.uom AS base_uom` to selecting a native `p.base_uom` column (implying `products` itself gained a real `base_uom` column since Phase 1, distinct from the generic `uom`). |
| `v_expiring_batches` | **Drifted.** Repo selects `b.status`; live selects `b.qc_status` instead in the output column list (the `WHERE b.status = 'active'` filter is unchanged, but any consumer reading a `status` field off a row from this view no longer gets one — it's `qc_status` now). Live also adds two joins (`inventory`, `warehouse_locations`) and two new columns (`location_code`, `location_name`) absent from the repo version. |
| `v_transaction_history` | **Drifted — substantial.** (1) `t.transaction_type` (a plain column in the repo's schema) became `tt.type_name AS transaction_type`, joined from a new `transaction_types` lookup table via `transaction_type_id` — the underlying table structure itself changed post-Phase-1 without `schema.sql` being updated. (2) `u.employee_id` (repo) → `u.badge_number` (live) — different column. (3) output column `performed_by_name` (repo) renamed to `performed_by` (live). (4) `JOIN users u` (repo, would drop rows with no `performed_by`) became `LEFT JOIN users u` (live) — a real behavior change, and a safe one, but still undocumented drift. (5) live adds `reference_document_type`, `reference_document_number`, `created_at`, none present in the repo version. |
| `v_hr_dashboard` | **Drifted.** Repo's 8th column is `day_30_due_7_days` (a probation-countdown metric). Live's 8th column is a completely unrelated `pending_holiday_approvals` (subquery on `holiday_requests`). Whichever frontend reads this view for the "day 30 due in 7 days" KPI would get nothing; whatever wants pending holiday approvals would get it, but it's not documented in the checked-in schema. |
| `v_hr_onboarding_tracker` | **Minor drift, functionally safe.** `department` column changed from `d.name AS department` (repo) to `COALESCE(d.name, u.department) AS department` (live) — a defensive null-fallback, output shape unchanged. |
| `v_hr_sop_compliance` | **Minor drift, functionally safe.** Same `COALESCE(d.name, u.department)` pattern added to `department`. |
| `v_hr_probation_schedule` | **Minor drift, functionally safe.** Same `COALESCE(d.name, u.department)` pattern added to `department`. |
| `v_hr_compliance_snapshot` | **Drifted — heavily.** Repo has 10 columns: `total_active, missing_contracts, missing_schedule_3, overdue_day_30, overdue_day_90, active_pips, incomplete_onboarding, expired_sop_training, expiring_sop_30_days, snapshot_date`. Live has 11: `total_active_users, total_with_hr_records, users_missing_hr_record, missing_contracts, overdue_day_30_reviews, overdue_day_90_reviews, active_pips, incomplete_onboarding, expired_sop_training, pending_holiday_approvals, snapshot_date`. Four repo columns were renamed (`total_active`→`total_active_users`, `overdue_day_30`→`overdue_day_30_reviews`, `overdue_day_90`→`overdue_day_90_reviews`) or dropped outright (`missing_schedule_3`, `expiring_sop_30_days` — gone from live entirely); three live columns don't exist in the repo version at all (`total_with_hr_records`, `users_missing_hr_record`, `pending_holiday_approvals`). This is effectively a different view wearing the same name. |

**Bottom line on drift:** of the 9 views that do have a real source of truth in version control, only 4 (`v_current_stock`, `v_hr_onboarding_tracker`, `v_hr_sop_compliance`, `v_hr_probation_schedule`) actually match what's deployed (3 of those 4 with a trivial safe tweak). The other 5 — including all 4 Phase-1 inventory views except `v_current_stock` — have drifted from checked-in SQL to varying degrees, two of them (`v_low_stock_items`, `v_transaction_history`, `v_hr_compliance_snapshot`) substantially enough to silently change what a consumer reads. **Having a `CREATE VIEW` in the repo is not by itself a guarantee the deployed view matches it** — this codebase has both an unversioned-views problem and a drifted-versioned-views problem, and they need to be tracked as two separate risks.

---

## `qms_review_calendar` ground-truth verification (items 6–7)

Picked the 3 RELEASED documents with the **nearest** upcoming `review_due_date` (the case most likely to expose a boundary-condition bug in the urgency `CASE` logic), plus the 3 with the **furthest-out** due dates for contrast. Current timestamp at query time: `2026-07-21T12:46:16Z`.

| doc_code | review_due_date | Manual calc (days out) | Expected urgency (per the view's own logic: overdue = past; critical = ≤30d; soon = ≤90d; else scheduled) | `qms_review_calendar` actual output | Match? |
|---|---|---|---|---|---|
| `QA-WT-CIP-SOP-010` | 2027-02-28 | ~222 days | scheduled | scheduled | ✅ |
| `QA-PRO-CLR-SOP-007` | 2027-02-28 | ~222 days | scheduled | scheduled | ✅ |
| `QA-CORE-SOP-004` | 2027-04-28 | ~281 days | scheduled | scheduled | ✅ |
| `QA-WT-OZN-LOG-004` (furthest-out sample) | 2027-06-17 | ~331 days | scheduled | scheduled | ✅ |
| `QA-WT-MON-SOP-009` (furthest-out sample) | 2027-06-17 | ~331 days | scheduled | scheduled | ✅ |
| `QA-QMS-REG-REG-003` (furthest-out sample) | 2027-06-09 | ~323 days | scheduled | scheduled | ✅ |

**No mismatch.** All 6 sampled documents' manually-computed urgency bucket matches `qms_review_calendar`'s actual output exactly. This is consistent with the earlier finding that all 26 released documents currently fall in the `scheduled` bucket (`urgency_counts` breakdown returned only `{scheduled: 26}`, zero in `overdue`/`critical`/`soon`) — the nearest review due date across the entire released document set is still ~7 months out, so there was no boundary case available to test against real data today. The view's `CASE` logic itself is verified correct against ground truth; it is not implicated in the Compliance Dashboard bug (that bug is entirely in `getComplianceDashboard()` never merging `qms_review_calendar`'s/`urgency_counts`' correct numbers into the `summary` object the frontend reads, as established in the first audit above).

---

## Housekeeping note

All read-only helper scripts used to query the database and inspect view definitions for this audit (`backend/_audit_readonly_tmp*.js`) were deleted immediately after use in every case. `git status` was re-checked after each step to confirm no stray files remained. No `CREATE`, `ALTER`, `DROP`, `INSERT`, `UPDATE`, or `DELETE` statement was executed against the database at any point — every query in both audits was a `SELECT`, `pg_get_viewdef()`, or an `information_schema`/`pg_catalog` read.
