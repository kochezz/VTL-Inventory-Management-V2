# VTL-ERP HR MODULE — CLAUDE CODE SESSION PROMPTS
# Vilagio Trading Limited | freshDRIP Water Bottling
# Use these prompts sequentially in Claude Code (VS Code).
# Each session is self-contained and includes all context needed.
# Complete each session fully before starting the next.
# ============================================================


# ============================================================
# PRE-FLIGHT: Run this command ONCE before Session 1
# Confirms your repo structure so sessions target correct paths
# ============================================================

PRE_FLIGHT_COMMAND:
  Run in your VS Code terminal before starting any session:

  find . -type f -name "server.js" | grep -v node_modules
  find . -type f -name "auth-middleware.js" | grep -v node_modules
  find . -type f -name "DashboardLayout.tsx" | grep -v node_modules

  The output tells you the exact paths. If they differ from the
  paths in these prompts, adjust accordingly before running each session.


# ============================================================
# SESSION 0 — CONTEXT FILE (Run once. Creates the HR spec file
# that every subsequent session references for consistency.)
# ============================================================

SESSION_0_PROMPT:
"""
You are working on VTL-ERP, a purpose-built enterprise inventory and HR management
system for Vilagio Trading Limited (freshDRIP water bottling, Chingola, Zambia).
The stack is: Next.js 14 (TypeScript, App Router, Tailwind) on the frontend,
Node.js/Express on the backend, PostgreSQL 14 on Neon Tech cloud.

Your ONLY task in this session is to create ONE new file:
  docs/HR_MODULE_SPEC.md

This file will be the shared context reference for all future Claude Code sessions
building the HR module. Create it with the following exact content:

---

# VTL-ERP HR Module — Implementation Specification
Version: 1.0 | Status: In Progress

## Database Tables (already migrated — DO NOT recreate)
- hr_departments       — structured dept registry (seeded: QA, OPS, ENG, INV, HR, FIN, SALES, MGMT, IT)
- hr_employees         — HR extension of users table (PK = user_id, FK → users.user_id)
- hr_contracts         — signed contract records per user
- hr_onboarding_progress — module completion tracking
- hr_competency_signoffs — granular task sign-offs within modules
- hr_sop_training_records — SOP training log (reads QMS by sop_reference string)
- hr_reviews           — Day 30, Day 90, PIP, annual reviews
- hr_pips              — Performance Improvement Plans
- hr_performance_ratings — quarterly output ratings
- hr_leave_balances    — annual accrual layer on top of existing holiday_requests
- hr_personnel_documents — document registry (files in Vercel Blob/S3, not DB)

## Key Database Relationships
- hr_employees.user_id → users.user_id (1:1 extension, PK = FK)
- hr_employees.department_id → hr_departments.id
- hr_employees.reports_to_user_id → users.user_id
- All other hr_ tables use user_id FK → users.user_id
- holiday_requests table is EXISTING and must NOT be modified
- users.reports_to stays as TEXT (full name) — existing holiday approval logic depends on this

## Views Available (use these in queries — do not rewrite the logic)
- v_hr_dashboard          — KPI card aggregates (single row)
- v_hr_employee_profile   — full profile join of users + hr_employees
- v_hr_onboarding_tracker — module progress per user
- v_hr_sop_compliance     — SOP training status per user
- v_hr_probation_schedule — review schedule with overdue flags
- v_hr_holiday_summary    — bridges holiday_requests + hr_leave_balances
- v_hr_quarterly_ratings  — quarterly output ratings register
- v_hr_compliance_snapshot — MD monthly checklist aggregates (single row)

## Unified Role List (16 roles — constraint already applied in DB)
Existing DB roles:  admin, manager, production_manager, qa, viewer, warehouse_manager, warehouse_staff
VALID_ROLES list:   ceo, cfo, engineering, operator, sales, staff, super_viewer
New HR roles:       hr_admin, hr_manager

## HR Role Permissions
- hr_admin: full HR read/write including salary fields (basic_salary_zmw)
- hr_manager: read own department employees, update onboarding progress for direct reports, NO salary
- admin: same as hr_admin for HR module
- All other roles: no access to /hr/* routes except /hr/me/* (own profile)

## Backend File Locations
- Services: backend/src/services/
- Routes:   backend/src/routes/
- Middleware: backend/src/middleware/
- Main server: (check actual path with: find . -name "server.js" | grep -v node_modules)
- Auth middleware: backend/src/middleware/auth-middleware.js
- DB connection: backend/src/utils/db.js or db-enhanced.js
- Existing users service: backend/src/services/users-service.js
- Pool import pattern: const { pool } = require('./auth-service');

## Frontend File Locations
- App pages: frontend/app/
- Components: frontend/components/
- Layout: frontend/components/layout/DashboardLayout.tsx
- Auth hook: frontend/hooks/useAuth.ts
- API base URL: process.env.NEXT_PUBLIC_API_URL
- Auth header pattern: { Authorization: `Bearer ${token}` }
- Dark theme classes: bg-dark-800, bg-dark-900, bg-dark-950, border-dark-700, border-dark-600
- Primary colour: primary-400, primary-500, primary-600, primary-700

## Non-Negotiable Constraints (read before every session)
1. NEVER modify: inventory-routes.js, inventory-service.js, products-routes.js,
   products-service.js, batch-service.js, transaction-service.js, auth-service.js,
   auth-routes.js, DashboardLayout.tsx (except adding HR nav link in Session 4)
2. NEVER modify: holiday_requests table or holiday management functions in users-service.js
3. All new backend files use CommonJS (require/module.exports) — NOT ES modules
4. All new frontend files use TypeScript with 'use client' where needed
5. salary fields (basic_salary_zmw) only returned when requesting role is hr_admin or admin
6. Every new API endpoint requires JWT authentication (authenticate middleware)
7. HR routes require hr_admin, hr_manager, or admin role (hr-middleware.js)
8. Commit after each session with message format: "feat(hr): Session N — description"

## HR Module Onboarding Modules (enum values)
phase_1_induction | phase_2_gmp_safety | module_a_finance | module_b_operations |
module_c_engineering | module_d_qa_qc | module_e_sales_admin | module_f_mgmt_systems

## HR Review Types (enum values)
day_30 | day_90 | pip_30_day | pip_final | annual_h1 | annual_h2

## HR Review Outcomes (enum values)
on_track | action_required | serious_concern | confirmed | extended |
probation_failed | pip_passed | pip_failed | pending

## Performance Rating Enum Values
rating_1_unacceptable | rating_2_below_target | rating_3_on_target |
rating_4_above_target | rating_5_exceptional

---

After creating the file, run:
  cat docs/HR_MODULE_SPEC.md | wc -l

It should return approximately 80 lines. Then commit:
  git add docs/HR_MODULE_SPEC.md
  git commit -m "docs(hr): Add HR module implementation specification"

Do NOT create any other files in this session.
"""


# ============================================================
# SESSION 1 — BACKEND: hr-service.js
# Estimated time: 20-30 minutes
# ============================================================

SESSION_1_PROMPT:
"""
You are working on VTL-ERP for Vilagio Trading Limited.
Read docs/HR_MODULE_SPEC.md first and keep it open as your reference throughout this session.

CONTEXT: The HR database schema has been fully migrated. You are now building the
backend service layer. This session creates ONE new file only.

BEFORE WRITING ANYTHING, read these existing files to understand patterns:
  - backend/src/services/users-service.js  (follow its exact require/export pattern)
  - backend/src/utils/db.js                (or db-enhanced.js — check which exists)
  - backend/src/middleware/auth-middleware.js (understand the req.user object shape)

CREATE this file: backend/src/services/hr-service.js

The file must implement these functions using the database views and tables
defined in docs/HR_MODULE_SPEC.md. Use parameterised queries ($1, $2 etc) throughout.
Pool import: const { pool } = require('./auth-service'); (match users-service.js pattern)

FUNCTIONS TO IMPLEMENT:

1. getDashboardStats()
   Query: SELECT * FROM v_hr_dashboard
   Returns: single row of KPI counts

2. getAllEmployees(requestingUserRole)
   Query: SELECT * FROM v_hr_employee_profile ORDER BY full_name
   If requestingUserRole is NOT 'hr_admin' or 'admin':
     exclude basic_salary_zmw from returned rows (delete the key before returning)
   Returns: array

3. getEmployeeByUserId(userId, requestingUserRole)
   Query: SELECT * FROM v_hr_employee_profile WHERE user_id = $1
   Same salary redaction rule as above.
   Also fetch: latest contract (SELECT * FROM hr_contracts WHERE user_id = $1 AND is_current = TRUE LIMIT 1)
   Also fetch: active PIP if any (SELECT * FROM hr_pips WHERE user_id = $1 AND is_active = TRUE LIMIT 1)
   Returns: { profile, contract, activePip }

4. createHrRecord(userId, hrData, createdByUserId)
   INSERT INTO hr_employees (user_id, department_id, reports_to_user_id, hr_status,
     contract_type, offer_accepted_date, basic_salary_zmw, salary_effective_date,
     napsa_member_number, created_by)
   VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
   ON CONFLICT (user_id) DO UPDATE SET ... (update all non-PK fields)
   RETURNING *
   Note: probation_end_date is auto-set by DB trigger from users.employment_date

5. updateHrRecord(userId, updates, updatedByUserId)
   Build dynamic UPDATE for hr_employees, appending updated_by and updated_at.
   Only update fields present in the updates object.
   Same salary redaction on return based on updatedByUserId's role
   (pass requestingUserRole as third param — look it up from users table by updatedByUserId)
   RETURNING *

6. getOnboardingProgress(userId)
   Query: SELECT * FROM v_hr_onboarding_tracker WHERE user_id = $1 ORDER BY module
   Returns: array of module rows

7. upsertOnboardingModule(userId, module, moduleData, trainerUserId)
   INSERT INTO hr_onboarding_progress (user_id, module, status, scheduled_date,
     started_date, completed_date, trainer_user_id, trainer_signed_date,
     trainee_signed_date, assessment_score, notes)
   VALUES (...)
   ON CONFLICT (user_id, module) DO UPDATE SET ...
   RETURNING *
   Note: completion trigger on DB side handles onboarding_complete flag automatically

8. getReviews(userId)
   Query: SELECT * FROM hr_reviews WHERE user_id = $1 ORDER BY review_date DESC
   Returns: array

9. createReview(userId, reviewData, conductedByUserId)
   INSERT INTO hr_reviews (user_id, review_type, review_date, scheduled_date,
     conducted_by_user_id, line_manager_user_id, performance_scores_json,
     weighted_overall_score, outcome, outcome_justification, action_items_json,
     confirmed_in_post, created_by)
   VALUES (...)
   RETURNING *

10. updateReview(reviewId, updates, updatedByUserId)
    Dynamic UPDATE on hr_reviews WHERE id = $1
    RETURNING *

11. getPipRecords(userId)
    Query: SELECT * FROM hr_pips WHERE user_id = $1 ORDER BY issued_date DESC
    Returns: array

12. createPip(userId, pipData, createdByUserId)
    INSERT INTO hr_pips (user_id, review_id, issued_date, pip_end_date,
      triggered_by_rating, performance_gap_json, targets_json, support_json,
      created_by)
    VALUES (...)
    RETURNING *

13. getPerformanceRatings(userId)
    Query: SELECT * FROM v_hr_quarterly_ratings WHERE user_id = $1 ORDER BY year DESC, quarter DESC
    Returns: array

14. upsertPerformanceRating(userId, ratingData, ratedByUserId)
    INSERT INTO hr_performance_ratings (user_id, review_id, quarter, year,
      rating_date, output_scores_json, overall_rating, overall_score,
      md_notes, action_required, action_type, rated_by)
    VALUES (...)
    ON CONFLICT (user_id, quarter, year) DO UPDATE SET ...
    RETURNING *

15. getComplianceSnapshot()
    Query: SELECT * FROM v_hr_compliance_snapshot
    Returns: single row

16. getLeaveBalance(userId)
    Query: SELECT * FROM v_hr_holiday_summary WHERE user_id = $1 AND leave_year = EXTRACT(YEAR FROM CURRENT_DATE)
    Falls back to holiday_requests if no balance row exists (for backward compat):
    If no row found: query holiday_requests for approved count this year,
    return { annual_entitlement: 15, annual_taken: count, annual_balance: 15 - count }
    (This preserves existing behaviour until balances are populated)

17. upsertLeaveBalance(userId, year, balanceData)
    INSERT INTO hr_leave_balances (user_id, leave_year, annual_entitlement,
      annual_taken, annual_carried_over, sick_entitlement, sick_taken)
    VALUES (...)
    ON CONFLICT (user_id, leave_year) DO UPDATE SET ...
    RETURNING *

18. getDepartments()
    Query: SELECT id, code, name, description FROM hr_departments WHERE is_active = TRUE ORDER BY name
    Returns: array

19. getSopTrainingRecords(userId)
    Query: SELECT * FROM v_hr_sop_compliance WHERE user_id = $1 ORDER BY sop_reference
    Returns: array

20. upsertSopTraining(userId, sopData, createdByUserId)
    INSERT INTO hr_sop_training_records (user_id, sop_reference, sop_title,
      sop_version, sop_category, trained_date, trainer_name, trainer_user_id,
      training_method, assessed, assessment_pass, assessment_date,
      employee_signed, signed_date, valid_until, created_by)
    VALUES (...)
    ON CONFLICT (user_id, sop_reference) where is_current = TRUE is a soft concept —
    set is_current = FALSE on old records first, then insert new
    RETURNING *

module.exports all 20 functions.

AFTER CREATING THE FILE:
1. Check for syntax errors: node -e "require('./backend/src/services/hr-service.js')" 
   (run from repo root — adjust path if needed)
2. Fix any require path issues until the file loads without error
3. Commit: git add backend/src/services/hr-service.js
   git commit -m "feat(hr): Session 1 — hr-service.js with 20 DB functions"

DO NOT CREATE any other files. DO NOT modify any existing files.
"""


# ============================================================
# SESSION 2 — BACKEND: Middleware + Routes + Server mount
# Estimated time: 20-25 minutes
# ============================================================

SESSION_2_PROMPT:
"""
You are working on VTL-ERP for Vilagio Trading Limited.
Read docs/HR_MODULE_SPEC.md first. Keep it open throughout this session.

BEFORE WRITING ANYTHING, read:
  - backend/src/middleware/auth-middleware.js  (understand authenticate + authorize functions)
  - backend/src/routes/auth.js OR auth-routes.js (understand route file pattern and structure)
  - backend/src/services/hr-service.js         (just created in Session 1 — know what's exported)
  - The main server file (find it: find . -name "server.js" | grep -v node_modules)

This session creates TWO new files and makes ONE targeted addition to the server file.

═══ FILE 1: backend/src/middleware/hr-middleware.js ═══

Create middleware that restricts HR routes based on role.
Import pattern must match auth-middleware.js exactly.

Implement:
  requireHrAccess — allows: admin, hr_admin, hr_manager
  requireHrAdmin  — allows: admin, hr_admin only (for salary data, PIP creation, review creation)

Both should call next() if allowed, or return:
  res.status(403).json({ message: 'Access denied. HR role required.' })

Export: { requireHrAccess, requireHrAdmin }

═══ FILE 2: backend/src/routes/hr-routes.js ═══

Create Express router. Import:
  - express Router
  - authenticate from auth-middleware (match exact import path used in other route files)
  - { requireHrAccess, requireHrAdmin } from hr-middleware
  - all functions from hr-service

Apply authenticate to ALL routes first (router.use(authenticate)).

ENDPOINTS TO IMPLEMENT:

── Dashboard & Overview ──
GET  /hr/dashboard           requireHrAccess → getDashboardStats()
GET  /hr/compliance          requireHrAdmin  → getComplianceSnapshot()
GET  /hr/departments         requireHrAccess → getDepartments()

── Employees ──
GET  /hr/employees           requireHrAccess → getAllEmployees(req.user.role)
GET  /hr/employees/:userId   requireHrAccess → getEmployeeByUserId(userId, req.user.role)
POST /hr/employees/:userId/record  requireHrAdmin → createHrRecord(userId, req.body, req.user.user_id)
PUT  /hr/employees/:userId/record  requireHrAdmin → updateHrRecord(userId, req.body, req.user.user_id)

── Onboarding ──
GET  /hr/employees/:userId/onboarding        requireHrAccess → getOnboardingProgress(userId)
PUT  /hr/employees/:userId/onboarding/:module requireHrAccess → upsertOnboardingModule(userId, module, req.body, req.user.user_id)

── SOP Training ──
GET  /hr/employees/:userId/sop-training      requireHrAccess → getSopTrainingRecords(userId)
POST /hr/employees/:userId/sop-training      requireHrAdmin  → upsertSopTraining(userId, req.body, req.user.user_id)

── Reviews ──
GET  /hr/employees/:userId/reviews           requireHrAccess → getReviews(userId)
POST /hr/employees/:userId/reviews           requireHrAdmin  → createReview(userId, req.body, req.user.user_id)
PUT  /hr/reviews/:reviewId                   requireHrAdmin  → updateReview(reviewId, req.body, req.user.user_id)

── PIPs ──
GET  /hr/employees/:userId/pips              requireHrAccess → getPipRecords(userId)
POST /hr/employees/:userId/pips              requireHrAdmin  → createPip(userId, req.body, req.user.user_id)

── Performance Ratings ──
GET  /hr/employees/:userId/ratings           requireHrAccess → getPerformanceRatings(userId)
POST /hr/employees/:userId/ratings           requireHrAdmin  → upsertPerformanceRating(userId, req.body, req.user.user_id)

── Leave Balances ──
GET  /hr/employees/:userId/leave-balance     requireHrAccess → getLeaveBalance(userId)
PUT  /hr/employees/:userId/leave-balance     requireHrAdmin  → upsertLeaveBalance(userId, new Date().getFullYear(), req.body)

Error handling: wrap all route handlers in try/catch.
On error: res.status(500).json({ message: error.message })
On not found: res.status(404).json({ message: 'Not found' })

module.exports = router;

═══ MODIFY: The main server file ═══

Find the main Express server file (the one that mounts all routes).
Add EXACTLY these two lines in the appropriate location alongside other route mounts:

  const hrRoutes = require('./src/routes/hr-routes');
  app.use('/hr', hrRoutes);

Place them after the existing route mounts, before app.listen().
DO NOT change anything else in the server file.

AFTER ALL THREE CHANGES:
1. Start the backend in dev mode: cd backend && npm run dev (or node server.js)
2. Confirm it starts without errors
3. Test one endpoint: curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:PORT/hr/departments
   (use a token from your existing login — departments requires hr_admin but test with admin token)
4. If there are import path errors, fix them by checking how other route files import middleware
5. Stop the server
6. Commit all three changes together:
   git add backend/src/middleware/hr-middleware.js
   git add backend/src/routes/hr-routes.js
   git add [main-server-file]
   git commit -m "feat(hr): Session 2 — HR middleware, routes, and server mount"

DO NOT modify any other files.
"""


# ============================================================
# SESSION 3 — BACKEND: users-service.js targeted updates
# Estimated time: 10-15 minutes
# ============================================================

SESSION_3_PROMPT:
"""
You are working on VTL-ERP for Vilagio Trading Limited.
Read docs/HR_MODULE_SPEC.md first.

CRITICAL: This session makes SURGICAL changes to an existing production file.
Read backend/src/services/users-service.js in full before making any changes.
You must preserve ALL existing functions exactly as they are.

BEFORE WRITING ANYTHING, read these files:
  - backend/src/services/users-service.js  (full file — your target)
  - backend/src/services/hr-service.js     (for context on leave balance table)

Make EXACTLY these two targeted changes to users-service.js:

═══ CHANGE 1: Update VALID_ROLES array (line ~4) ═══

Find this line:
  const VALID_ROLES = ['admin', 'ceo', 'cfo', 'manager', 'qa', 'engineering', 'staff', 'operator', 'sales', 'super_viewer', 'viewer'];

Replace it with:
  const VALID_ROLES = [
    // Roles confirmed in database
    'admin', 'manager', 'production_manager', 'qa', 'viewer',
    'warehouse_manager', 'warehouse_staff',
    // Roles in frontend/available for assignment
    'ceo', 'cfo', 'engineering', 'operator', 'sales', 'staff', 'super_viewer',
    // HR module roles
    'hr_admin', 'hr_manager'
  ];

═══ CHANGE 2: Update getHolidayData() to use hr_leave_balances when available ═══

Find the getHolidayData function. It currently uses a hardcoded totalAllowance = 15.

Replace the function body with this logic:
  1. Try to query hr_leave_balances for this user and current year:
     SELECT * FROM hr_leave_balances WHERE user_id = $1 AND leave_year = $2
  2. If a row exists, use annual_entitlement from that row as totalAllowance
  3. If no row exists, fall back to 15 (existing hardcoded behaviour — backward compatible)
  4. The rest of the function (querying holiday_requests, calculating used/pending/remaining)
     stays EXACTLY the same as it is now
  
The function signature, return shape, and all other logic must remain identical.
Only the totalAllowance source changes.

═══ CHANGE 3: Update getUserStats() to include new roles ═══

Find getUserStats(). Add counting for the missing roles.
The query currently counts: admin, ceo, cfo, manager, engineering, qa, staff, operator, sales, super_viewer, viewer
Add these COUNT FILTER lines to the SQL query:
  COUNT(*) FILTER (WHERE role = 'production_manager') as production_managers,
  COUNT(*) FILTER (WHERE role = 'warehouse_manager') as warehouse_managers,
  COUNT(*) FILTER (WHERE role = 'warehouse_staff') as warehouse_staff_count,
  COUNT(*) FILTER (WHERE role = 'hr_admin') as hr_admins,
  COUNT(*) FILTER (WHERE role = 'hr_manager') as hr_managers

DO NOT change anything else in this file.
DO NOT change the function signatures.
DO NOT change the exports.
DO NOT change holiday_requests queries.

VERIFY:
1. node -e "require('./backend/src/services/users-service.js')" — must load without error
2. Start the backend: npm run dev
3. Confirm existing /users and /users/holidays/* endpoints still work (check no 500 errors on startup)
4. Commit:
   git add backend/src/services/users-service.js
   git commit -m "feat(hr): Session 3 — Sync VALID_ROLES, update getHolidayData, extend getUserStats"

DO NOT modify any other files.
"""


# ============================================================
# SESSION 4 — FRONTEND: HRLayout component + Nav link
# Estimated time: 15-20 minutes
# ============================================================

SESSION_4_PROMPT:
"""
You are working on VTL-ERP for Vilagio Trading Limited.
Read docs/HR_MODULE_SPEC.md first.

BEFORE WRITING ANYTHING, read these files in full:
  - frontend/components/layout/DashboardLayout.tsx  (understand nav structure, icons, link pattern)
  - frontend/hooks/useAuth.ts                       (understand what user object contains)

This session creates ONE new component and makes ONE surgical addition to the nav.

═══ FILE 1 (NEW): frontend/components/hr/HRLayout.tsx ═══

Create a shared layout wrapper used by all HR module pages.
It provides:
  - A consistent page header with the HR section title and a back-to-dashboard link
  - A horizontal sub-navigation bar with links to all HR pages:
      Dashboard (/hr) | Employees (/hr/employees) | Onboarding (/hr/onboarding) |
      Reviews (/hr/reviews) | Performance (/hr/performance)
  - An access guard: if the user's role is not in
    ['admin', 'hr_admin', 'hr_manager', 'ceo', 'manager', 'production_manager',
     'warehouse_manager']
    redirect to /dashboard
  - A children prop to render page content below the sub-nav

Style guide (match existing ERP dark theme exactly):
  - Outer wrapper: min-h-screen bg-dark-950
  - Header bar: bg-dark-800 border-b border-dark-700
  - Sub-nav: bg-dark-900 border-b border-dark-700
  - Active link: text-primary-400 border-b-2 border-primary-400
  - Inactive link: text-gray-400 hover:text-white
  - Use usePathname() from next/navigation for active link detection
  - Import Users, ClipboardCheck, GraduationCap, BarChart3, Home icons from lucide-react

Props interface:
  interface HRLayoutProps {
    children: React.ReactNode;
    title: string;
    subtitle?: string;
  }

Export as default.

═══ MODIFY: frontend/components/layout/DashboardLayout.tsx ═══

Add ONE nav item to the existing navigation for the HR module.
Read the file first to find exactly where nav items are defined and how they are structured.

Add this nav item in a logical position (after Users/Admin section, before any footer items):
  - Icon: Users (or UserCheck) from lucide-react (check if already imported)
  - Label: "HR Module"
  - href: "/hr"
  - Only show when user.role is in: ['admin', 'hr_admin', 'hr_manager', 'ceo',
    'manager', 'production_manager', 'warehouse_manager']

Follow the EXACT same pattern as the other nav items in the file.
Add the Users/UserCheck icon import only if it is not already imported.
DO NOT change any other nav items, styles, or logic.

VERIFY:
1. cd frontend && npm run build (or npm run dev and check no TypeScript errors)
2. Navigate to the app — confirm HR Module appears in the nav for admin users
3. Confirm it does NOT appear for viewer/staff/operator roles
4. Commit:
   git add frontend/components/hr/HRLayout.tsx
   git add frontend/components/layout/DashboardLayout.tsx
   git commit -m "feat(hr): Session 4 — HRLayout component and nav link"

DO NOT modify any other files.
"""


# ============================================================
# SESSION 5 — FRONTEND: HR Dashboard page (/hr)
# Estimated time: 20-25 minutes
# ============================================================

SESSION_5_PROMPT:
"""
You are working on VTL-ERP for Vilagio Trading Limited.
Read docs/HR_MODULE_SPEC.md first.

BEFORE WRITING ANYTHING, read:
  - frontend/components/hr/HRLayout.tsx      (the layout wrapper you must use)
  - frontend/hooks/useAuth.ts                (for token and user)
  - frontend/app/dashboard/page.tsx          (for KPI card pattern and axios usage)

CREATE: frontend/app/hr/page.tsx

This is the HR module dashboard — the first page users see when they navigate to /hr.
It is a 'use client' component.

LAYOUT: Wrap all content in <HRLayout title="HR Dashboard" subtitle="People & compliance overview">.

SECTION 1 — KPI CARDS (fetch from GET /hr/dashboard)
Display these 8 metric cards in a responsive grid (4 columns desktop, 2 tablet, 1 mobile):
  - Total Active Employees      (value: total_active)
  - Currently Onboarding        (value: onboarding, amber colour)
  - On Probation                (value: on_probation, blue colour)
  - Confirmed Employees         (value: confirmed, green colour)
  - Employees on PIP            (value: on_pip, red colour if > 0)
  - Incomplete Onboarding       (value: incomplete_onboarding, orange if > 0)
  - Probation Reviews Due       (value: probation_due_14_days, red if > 0)
  - Pending Holiday Approvals   (value: pending_holiday_approvals, amber if > 0)

Card component pattern (match dashboard page KPICard exactly):
  dark card, coloured icon background, title + large number + subtext
  onClick navigates to relevant section (e.g. probation card → /hr/reviews)

SECTION 2 — COMPLIANCE SNAPSHOT (fetch from GET /hr/compliance)
Show a single horizontal status bar below the KPI cards.
Display these items in a row of status chips:
  - Missing Contracts: N         (red chip if > 0, green if 0)
  - Overdue Day 30 Reviews: N   (red if > 0)
  - Overdue Day 90 Reviews: N   (red if > 0)
  - Active PIPs: N              (amber if > 0)
  - Expired SOP Training: N     (orange if > 0)
  - Users Missing HR Record: N  (amber if > 0, with tooltip: "Active users with no HR extension record")

SECTION 3 — QUICK ACTIONS
Three action buttons:
  - "Add HR Record" → navigate to /hr/employees (to select user and create record)
  - "Schedule Review" → navigate to /hr/reviews
  - "View Onboarding Tracker" → navigate to /hr/onboarding

LOADING STATE: Show a centred spinner (Loader2 from lucide-react, animate-spin) while data loads.
ERROR STATE: Show a red alert bar if either fetch fails.

Data fetching:
  - Use useEffect + axios with Bearer token header
  - Fetch both endpoints in parallel with Promise.all
  - Handle 403 (show "You do not have access to the HR module")

VERIFY:
1. npm run dev — navigate to /hr (log in as admin first)
2. Confirm KPI cards render (values may be 0 if no HR records yet — that is correct)
3. npm run build — zero TypeScript errors
4. Commit:
   git add frontend/app/hr/page.tsx
   git commit -m "feat(hr): Session 5 — HR dashboard page"
"""


# ============================================================
# SESSION 6 — FRONTEND: Employees list + Employee profile
# Estimated time: 25-30 minutes
# ============================================================

SESSION_6_PROMPT:
"""
You are working on VTL-ERP for Vilagio Trading Limited.
Read docs/HR_MODULE_SPEC.md first.

BEFORE WRITING ANYTHING, read:
  - frontend/components/hr/HRLayout.tsx
  - frontend/app/users/page.tsx              (table and modal patterns to reuse)
  - frontend/hooks/useAuth.ts

CREATE TWO files:

═══ FILE 1: frontend/app/hr/employees/page.tsx ═══

Employee Status Board — shows all employees with HR lifecycle status.
Use HRLayout with title="Employees" subtitle="HR status and lifecycle tracking".
'use client'

FETCH: GET /hr/employees (returns v_hr_employee_profile rows)

Display a searchable, filterable table with these columns:
  - Employee (avatar initial + full_name + employee_number)
  - Department (department_structured ?? department_text)
  - Job Title
  - HR Status (hr_status as coloured badge — use badge colours below)
  - Onboarding (onboarding_pct as a progress bar + "X% complete")
  - Probation (days_to_probation_end — show "N days" in red if < 14, amber if < 30)
  - PIP Active (red dot icon if has_active_pip = true)
  - Actions: "View Profile" button → /hr/employees/[user_id]

HR Status badge colours:
  pre_start: gray | onboarding: blue | probation: amber | confirmed: green |
  pip_active: red | notice_period: orange | exited: gray/dim

Filters above the table:
  - Search (name, email, employee number)
  - HR Status dropdown (all / onboarding / probation / confirmed / pip_active)
  - Department dropdown (populated from GET /hr/departments)

Empty state: if no employees have HR records yet, show a helpful message:
  "No HR records found. Active users without HR records are listed below."
  Then show a secondary table of users from GET /users (admin only) with a
  "Create HR Record" button for each — clicking navigates to /hr/employees/[user_id]
  with a query param ?create=true

═══ FILE 2: frontend/app/hr/employees/[id]/page.tsx ═══

Individual Employee Profile — full HR record for one person.
Use HRLayout with title set to the employee's full_name.
'use client' — read params.id as the user_id.

FETCH on mount (parallel):
  - GET /hr/employees/:id   → profile + contract + activePip
  - GET /hr/employees/:id/onboarding
  - GET /hr/employees/:id/reviews
  - GET /hr/employees/:id/leave-balance

Display in TABS (use simple tab state, no external library):
  Tab 1: Overview
    - Two-column layout: left = user profile fields from the response
      (full_name, email, job_title, department, employment_date, employment_status,
       reports_to_name, contract_type, hr_status, confirmation_date, exit_date)
    - Right = HR extension fields (probation_end_date, effective_probation_end,
      days_to_probation_end with colour coding, onboarding_complete badge)
    - Salary section: only show basic_salary_zmw if the current user's role
      is 'admin' or 'hr_admin'. Otherwise show a locked placeholder.
    - Active PIP alert banner if has_active_pip = true (red banner at top)

  Tab 2: Onboarding
    - List each module row from the onboarding fetch
    - Show: module name (formatted), status badge, completion date, assessment score
    - Colour: completed=green, in_progress=blue, not_started=gray, not_applicable=dim

  Tab 3: Reviews
    - List review records (review_type, review_date, outcome badge, weighted_overall_score)
    - Outcomes: confirmed=green, probation_failed=red, extended=amber, pending=gray

  Tab 4: Leave
    - Cards: Annual Entitlement | Days Taken | Days Pending | Balance Remaining
    - Progress bar showing used/total
    - Note: "Leave requests are submitted from the main dashboard"

Back button: "← Back to Employees" → /hr/employees

VERIFY:
1. npm run dev — navigate to /hr/employees
2. Click a "View Profile" (or create one if no records exist)
3. npm run build — zero TypeScript errors
4. Commit:
   git add frontend/app/hr/employees/page.tsx
   git add frontend/app/hr/employees/[id]/page.tsx
   git commit -m "feat(hr): Session 6 — Employee list and profile pages"
"""


# ============================================================
# SESSION 7 — FRONTEND: Onboarding tracker page
# Estimated time: 15-20 minutes
# ============================================================

SESSION_7_PROMPT:
"""
You are working on VTL-ERP for Vilagio Trading Limited.
Read docs/HR_MODULE_SPEC.md first.

BEFORE WRITING ANYTHING, read:
  - frontend/components/hr/HRLayout.tsx
  - frontend/app/hr/employees/[id]/page.tsx   (for onboarding display pattern)

CREATE: frontend/app/hr/onboarding/page.tsx

Onboarding Tracker — MD/HR admin view of all employees' onboarding progress.
HRLayout title="Onboarding Tracker" subtitle="Module completion across all active employees"
'use client'

FETCH: GET /hr/employees (get all employees with onboarding_pct and onboarding_complete)

DISPLAY — Master tracker table:

FILTERS:
  - Search by employee name
  - Filter: All / Incomplete only / Complete only / Overdue (where any module is in_progress > 14 days)
  - Department filter

TABLE COLUMNS:
  Employee Name | Department | Start Date | Ph.1 | Ph.2 | Mod A | Mod B | Mod C | Mod D | Mod E | Mod F | Overall %

For each module column, show a compact status icon:
  ✓ (green check)         = completed
  ● (blue dot, pulsing)   = in_progress
  ○ (gray circle)         = not_started
  — (dim dash)            = not_applicable
  ⚠ (amber warning)      = in_progress AND overdue (> 14 days)

Overall % column: progress bar (green if 100%, amber if > 50%, red if < 50%)

CLICKING a row navigates to /hr/employees/[user_id]?tab=onboarding

SUMMARY ROW at the top (before the table):
  Three summary cards:
    - "Onboarding Complete" — count of employees where onboarding_complete = true
    - "In Progress" — count where hr_status = 'onboarding' AND onboarding_complete = false
    - "Overdue Modules" — count from incomplete_onboarding in the dashboard stats

Note: Individual module data per employee requires calling GET /hr/employees/:id/onboarding
for each. To avoid N+1 requests, only fetch individual module details when a row is
expanded (click to expand inline) or when navigating to the profile page.
For the master view, use only what's available in the employee list response
(onboarding_pct, onboarding_complete, hr_status).

VERIFY:
1. npm run dev → navigate to /hr/onboarding
2. Confirm table renders (if no HR records, show empty state with link to /hr/employees)
3. npm run build — zero TypeScript errors
4. Commit:
   git add frontend/app/hr/onboarding/page.tsx
   git commit -m "feat(hr): Session 7 — Onboarding tracker page"
"""


# ============================================================
# SESSION 8 — FRONTEND: Reviews + Performance pages
# Estimated time: 25-30 minutes
# ============================================================

SESSION_8_PROMPT:
"""
You are working on VTL-ERP for Vilagio Trading Limited.
Read docs/HR_MODULE_SPEC.md first.

BEFORE WRITING ANYTHING, read:
  - frontend/components/hr/HRLayout.tsx
  - frontend/app/hr/employees/page.tsx     (for table and filter patterns)

CREATE TWO files:

═══ FILE 1: frontend/app/hr/reviews/page.tsx ═══

Probation Review Schedule — shows all upcoming and overdue reviews.
HRLayout title="Probation Reviews" subtitle="Review schedule and outcomes"
'use client'

FETCH: GET /hr/employees (use probation fields from employee profiles)
The response includes: effective_probation_end, days_to_probation_end,
hr_status from v_hr_employee_profile.

For each employee on probation/onboarding, derive:
  day_30_due = employment_date + 28 days (calculate in JS)
  day_90_due = effective_probation_end

TWO SECTIONS:

Section A — "Overdue / Due This Week" (urgent attention required):
  Show employees where:
    - day_30 or day_90 is within the next 7 days, OR
    - the review is already past due (days_to_probation_end < 0)
  Display as alert cards (red border for overdue, amber for due soon):
    Employee name | Due date | Review type | Days remaining/overdue | "View Profile" button

Section B — "Full Schedule" table:
  All employees with hr_status IN ('onboarding', 'probation', 'confirmed'):
  Columns: Employee | Start Date | Day 30 Due | Day 90 Due | Day 30 Status | Day 90 Status | Actions

  Day 30 / Day 90 Status shows one of:
    - "Pending" (gray badge) if no review record and not yet due
    - "Due Soon" (amber badge) if due within 14 days
    - "OVERDUE" (red badge) if past due date
    - The outcome (green/red/amber badge) if review was completed

  "View Profile" button → /hr/employees/[user_id]?tab=reviews

Filter: Active (onboarding + probation) | All (includes confirmed)

═══ FILE 2: frontend/app/hr/performance/page.tsx ═══

Quarterly Output Ratings Register — the MD Quarterly Business Review view.
HRLayout title="Performance Ratings" subtitle="Quarterly output ratings — all staff"
'use client'

FETCH: GET /hr/employees (for employee list with current ratings)
Additionally fetch latest ratings from GET /hr/employees/:id/ratings on expand
(lazy load per employee on row click — same pattern as onboarding tracker)

PRIMARY VIEW — Current Quarter Register:
  Show current year + current quarter (compute from JS Date).
  Table: Employee | Department | Overall Rating | Score | Bonus Eligible | Action Required | PIP Issued

  Overall Rating badge colours:
    rating_1_unacceptable: red
    rating_2_below_target: orange
    rating_3_on_target: gray/white
    rating_4_above_target: blue
    rating_5_exceptional: green

  Bonus eligible: gold star icon if true
  Action required: flag icon if action_required = true

  Rows without a rating for the current quarter show "Not Yet Rated" in gray.

QUARTER SELECTOR:
  Dropdown to select Q1/Q2/Q3/Q4 and year (current year ± 1).
  When changed, re-fetch and filter ratings accordingly.

SUMMARY STATS above the table:
  - Rating distribution: small bar chart or pill counts (count per rating level)
  - Employees not yet rated this quarter: N
  - Bonus eligible this quarter: N

VERIFY:
1. npm run dev → /hr/reviews and /hr/performance both render
2. Confirm filters work and empty states display correctly
3. npm run build — zero TypeScript errors
4. Commit:
   git add frontend/app/hr/reviews/page.tsx
   git add frontend/app/hr/performance/page.tsx
   git commit -m "feat(hr): Session 8 — Reviews schedule and performance ratings pages"
"""


# ============================================================
# SESSION 9 — WIRING CHECK + FINAL PUSH
# Estimated time: 15-20 minutes
# ============================================================

SESSION_9_PROMPT:
"""
You are working on VTL-ERP for Vilagio Trading Limited.
Read docs/HR_MODULE_SPEC.md first.

This is the final session. No new files are created. This session:
  1. Verifies the complete HR module is wired correctly
  2. Fixes any remaining issues found during verification
  3. Prepares a clean final commit

RUN THESE VERIFICATION STEPS IN ORDER:

── Backend Checks ──
1. cd backend && npm run dev
   Confirm zero errors on startup.
   Confirm "HR routes mounted" or no mount errors.

2. Test the HR endpoints using curl or your API testing tool.
   Use an admin token from POST /auth/login.

   Test these in order:
   GET  /hr/departments              → expect array of 9 departments
   GET  /hr/dashboard                → expect single row with numeric counts
   GET  /hr/employees                → expect array (may be empty if no HR records yet)
   GET  /hr/compliance               → expect single row with compliance counts

3. If any endpoint returns 404: the route mount path in server.js is wrong.
   Fix the mount path. Do not change the route definitions.

4. If any endpoint returns 500: check the hr-service.js query against the actual
   DB views. Run the query directly in Neon SQL Editor to confirm it works.

── Frontend Checks ──
5. cd frontend && npm run build
   This must complete with ZERO TypeScript errors and ZERO build errors.
   Fix any errors found — they will be import path issues or type mismatches.
   Common fixes:
     - Missing 'use client' directive at top of page files
     - useRouter/usePathname imported from wrong location
     - Lucide icon not imported
     - HRLayout import path incorrect

6. npm run dev
   Navigate through each page manually:
     /hr              → dashboard KPIs render
     /hr/employees    → table renders (empty state if no HR records — correct)
     /hr/onboarding   → tracker renders
     /hr/reviews      → schedule renders
     /hr/performance  → ratings view renders

7. Confirm navigation:
   - HR Module link appears in DashboardLayout sidebar for admin user
   - HR Module link does NOT appear for viewer/operator/staff
   - HRLayout sub-nav highlights the active page correctly
   - Back navigation works from employee profile

── Final Commit ──
8. If any fixes were needed, add them to a fix commit:
   git add [any-fixed-files]
   git commit -m "fix(hr): Session 9 — Wiring fixes and verification"

9. Push everything to GitHub:
   git push origin main   (or your branch name)

10. Verify on Vercel (frontend) that the deployment succeeds — watch the Vercel
    dashboard or run: vercel --prod (if Vercel CLI is installed)

11. Update docs/HR_MODULE_SPEC.md — change Status from "In Progress" to "Complete"
    Add a section at the bottom:
      ## Implementation Status
      Backend: Complete (Sessions 1-3)
      Frontend: Complete (Sessions 4-8)
      Deployed: [date]

    git add docs/HR_MODULE_SPEC.md
    git commit -m "docs(hr): Mark HR module implementation complete"
    git push origin main

DO NOT modify any inventory, production, QMS, or auth files during this session.
If you find a bug in an existing system while testing, note it but do not fix it now.
Only fix issues directly related to the HR module.
"""

# ============================================================
# REFERENCE: Files created/modified across all sessions
# ============================================================

FILES_SUMMARY:
  Session 0 (created):
    docs/HR_MODULE_SPEC.md

  Session 1 (created):
    backend/src/services/hr-service.js

  Session 2 (created + modified):
    backend/src/middleware/hr-middleware.js   [NEW]
    backend/src/routes/hr-routes.js          [NEW]
    backend/server.js (or api/server.js)     [MODIFIED — 2 lines only]

  Session 3 (modified):
    backend/src/services/users-service.js    [MODIFIED — 3 targeted changes]

  Session 4 (created + modified):
    frontend/components/hr/HRLayout.tsx      [NEW]
    frontend/components/layout/DashboardLayout.tsx [MODIFIED — 1 nav item]

  Session 5 (created):
    frontend/app/hr/page.tsx

  Session 6 (created):
    frontend/app/hr/employees/page.tsx
    frontend/app/hr/employees/[id]/page.tsx

  Session 7 (created):
    frontend/app/hr/onboarding/page.tsx

  Session 8 (created):
    frontend/app/hr/reviews/page.tsx
    frontend/app/hr/performance/page.tsx

  Session 9 (verification + push):
    Any targeted fixes from verification + final push

  NEVER TOUCHED (protect these at all costs):
    backend/src/services/inventory-service.js
    backend/src/services/products-service.js
    backend/src/services/batch-service.js
    backend/src/services/transaction-service.js
    backend/src/services/auth-service.js
    backend/src/routes/inventory-routes.js
    backend/src/routes/products-routes.js
    backend/src/routes/auth-routes.js
    backend/src/routes/auth.js
    frontend/app/dashboard/page.tsx
    frontend/app/inventory/page.tsx
    frontend/app/products/ (all files)
    frontend/app/login/page.tsx
    frontend/components/inventory/ (all files)
    frontend/hooks/useAuth.ts
    database/ (all files — schema already migrated)
