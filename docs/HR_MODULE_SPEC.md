# VTL-ERP HR Module — Implementation Specification
Version: 1.0 | Status: In Progress

## Database Tables (already migrated — DO NOT recreate)

| Table | Purpose |
|---|---|
| hr_departments | structured dept registry (seeded: QA, OPS, ENG, INV, HR, FIN, SALES, MGMT, IT) |
| hr_employees | HR extension of users table (PK = user_id, FK → users.user_id) |
| hr_contracts | signed contract records per user |
| hr_onboarding_progress | module completion tracking |
| hr_competency_signoffs | granular task sign-offs within modules |
| hr_sop_training_records | SOP training log (reads QMS by sop_reference string) |
| hr_reviews | Day 30, Day 90, PIP, annual reviews |
| hr_pips | Performance Improvement Plans |
| hr_performance_ratings | quarterly output ratings |
| hr_leave_balances | annual accrual layer on top of existing holiday_requests |
| hr_personnel_documents | document registry (files in Vercel Blob/S3, not DB) |

## Key Database Relationships

- `hr_employees.user_id` → `users.user_id` (1:1 extension, PK = FK)
- `hr_employees.department_id` → `hr_departments.id`
- `hr_employees.reports_to_user_id` → `users.user_id`
- All other `hr_*` tables use `user_id` FK → `users.user_id`
- `holiday_requests` table is EXISTING and must NOT be modified
- `users.reports_to` stays as TEXT (full name) — existing holiday approval logic depends on this

## Views Available (use these in queries — do not rewrite the logic)

| View | Purpose |
|---|---|
| v_hr_dashboard | KPI card aggregates (single row) |
| v_hr_employee_profile | full profile join of users + hr_employees |
| v_hr_onboarding_tracker | module progress per user |
| v_hr_sop_compliance | SOP training status per user |
| v_hr_probation_schedule | review schedule with overdue flags |
| v_hr_holiday_summary | bridges holiday_requests + hr_leave_balances |
| v_hr_quarterly_ratings | quarterly output ratings register |
| v_hr_compliance_snapshot | MD monthly checklist aggregates (single row) |

## Unified Role List (16 roles — constraint already applied in DB)

- **Existing DB roles:** admin, manager, production_manager, qa, viewer, warehouse_manager, warehouse_staff
- **VALID_ROLES list:** ceo, cfo, engineering, operator, sales, staff, super_viewer
- **New HR roles:** hr_admin, hr_manager

## HR Role Permissions

- **hr_admin:** full HR read/write including salary fields (basic_salary_zmw)
- **hr_manager:** read own department employees, update onboarding progress for direct reports, NO salary
- **admin:** same as hr_admin for HR module
- **All other roles:** no access to `/hr/*` routes except `/hr/me/*` (own profile)

## Backend File Locations

- Services: `backend/src/services/`
- Routes: `backend/src/routes/`
- Middleware: `backend/src/middleware/`
- Main server: (check actual path with: `find . -name "server.js" | grep -v node_modules`)
- Auth middleware: `backend/src/middleware/auth-middleware.js`
- DB connection: `backend/src/utils/db.js` or `db-enhanced.js`
- Existing users service: `backend/src/services/users-service.js`
- Pool import pattern: `const { pool } = require('./auth-service');`

## Frontend File Locations

- App pages: `frontend/app/`
- Components: `frontend/components/`
- Layout: `frontend/components/layout/DashboardLayout.tsx`
- Auth hook: `frontend/hooks/useAuth.ts`
- API base URL: `process.env.NEXT_PUBLIC_API_URL`
- Auth header pattern: `{ Authorization: \`Bearer ${token}\` }`
- Dark theme classes: `bg-dark-800`, `bg-dark-900`, `bg-dark-950`, `border-dark-700`, `border-dark-600`
- Primary colour: `primary-400`, `primary-500`, `primary-600`, `primary-700`

## Non-Negotiable Constraints (read before every session)

**NEVER modify:**
- `inventory-routes.js`, `inventory-service.js`, `products-routes.js`
- `products-service.js`, `batch-service.js`, `transaction-service.js`
- `auth-service.js`, `auth-routes.js`
- `DashboardLayout.tsx` (except adding HR nav link in Session 4)
- `holiday_requests` table or holiday management functions in `users-service.js`

**Always:**
- All new backend files use CommonJS (`require`/`module.exports`) — NOT ES modules
- All new frontend files use TypeScript with `'use client'` where needed
- Salary fields (`basic_salary_zmw`) only returned when requesting role is `hr_admin` or `admin`
- Every new API endpoint requires JWT authentication (`authenticate` middleware)
- HR routes require `hr_admin`, `hr_manager`, or `admin` role (`hr-middleware.js`)
- Commit after each session with message format: `feat(hr): Session N — description`

## HR Module Onboarding Modules (enum values)

```
phase_1_induction | phase_2_gmp_safety | module_a_finance | module_b_operations |
module_c_engineering | module_d_qa_qc | module_e_sales_admin | module_f_mgmt_systems
```

## HR Review Types (enum values)

```
day_30 | day_90 | pip_30_day | pip_final | annual_h1 | annual_h2
```

## HR Review Outcomes (enum values)

```
on_track | action_required | serious_concern | confirmed | extended |
probation_failed | pip_passed | pip_failed | pending
```

## Performance Rating Enum Values

```
rating_1_unacceptable | rating_2_below_target | rating_3_on_target |
rating_4_above_target | rating_5_exceptional
```
