# VTL-ERP HR MODULE — CODEX FIX SESSION
# Fix: HR Record Creation Disconnect Between /users and /hr
# Vilagio Trading Limited | freshDRIP Water Bottling

## Purpose

This Codex fix session addresses the disconnect between the System User Management setup (`/users`) and the HR Module (`/hr/employees/[id]`).

The expected SOP flow is:

1. System Admin creates the employee account in `/users`.
2. The employee then appears in the HR Module as an active user without an HR extension record.
3. HR Admin/Admin clicks **Create HR Record**.
4. `/hr/employees/[id]?create=true` opens with the employee's existing user data already visible.
5. HR Admin/Admin completes only the HR extension fields and saves the HR record.
6. The saved profile continues to show the base user data from `users` plus the HR extension data from `hr_employees`.

The current implementation breaks this flow because the HR employee profile page depends on `GET /hr/employees/:userId`, which appears to read only from `v_hr_employee_profile`. For users without an `hr_employees` row, this returns no profile/404, so the page cannot display the user data created by the System Admin and cannot present the HR record creation form.

## Key Finding

This is not primarily a styling issue. It is a data-contract and workflow issue.

The HR module currently treats “employee profile” as “employee with an existing HR extension row.” The SOP requires the HR module to treat it as “active system user, with or without an HR extension row.”

## Important Role Clarification

Do **not** give line managers the ability to create or edit HR records.

The SOP states:

- `hr_admin` and `admin` can create and manage HR records.
- `hr_manager` can view profiles and update onboarding progress for direct reports.
- `hr_manager` cannot create reviews, PIPs, or edit salary/HR record fields.

So this fix must make the Add HR Record workflow executable for `admin` and `hr_admin`, while preserving line manager restrictions.

## Files to Review Before Editing

Read these files before making changes:

```text
docs/HR_MODULE_SPEC.md
backend/src/services/hr-service.js
backend/src/routes/hr-routes.js
backend/src/middleware/hr-middleware.js
backend/src/services/users-service.js
frontend/app/users/page.tsx
frontend/app/hr/employees/page.tsx
frontend/app/hr/employees/[id]/page.tsx
frontend/components/hr/HRLayout.tsx
frontend/hooks/useAuth.ts
```

Also check the actual route names in the repo. Do not assume `/users/:id` exists until confirmed from `users-routes.js` or equivalent.

## Functional Requirements

### Requirement 1 — Preserve Existing Functionality

Do not remove or break:

- Existing HR Dashboard KPIs.
- Existing employee list for employees who already have HR records.
- Existing onboarding, review, performance, leave balance fetches.
- Existing holiday request workflow.
- Existing `/users` creation/editing flow.
- Salary redaction rules.
- Role restrictions.

### Requirement 2 — Support Users Without HR Records

The HR Module must support active system users who do not yet have an `hr_employees` row.

For those users:

- `/hr/employees` must show them in a **Users Missing HR Record** section.
- Clicking **Create HR Record** must navigate to:

```text
/hr/employees/[user_id]?create=true
```

- `/hr/employees/[id]?create=true` must load the base user data from the `users` table.
- The page must display that base data clearly before the HR record is created.
- The HR creation form must only collect HR extension fields.

### Requirement 3 — Base User Data Must Be Pulled From `/users`

The following fields must come from the existing `users` table and must be displayed on the HR profile page even before the HR record exists:

```text
user_id
full_name
email
employee_number
job_title
department
reports_to
employment_date
employment_status
employment_type
role
is_active
```

These are already entered on the System User Management page and must not be retyped in the HR record form.

### Requirement 4 — HR Extension Fields Must Be Collected Separately

The HR record form should collect only fields belonging to `hr_employees`:

```text
department_id
reports_to_user_id
hr_status
contract_type
offer_accepted_date
basic_salary_zmw
salary_effective_date
napsa_member_number
```

Default values:

```text
hr_status: onboarding
contract_type: Probationary, or the closest enum/value used in the database
offer_accepted_date: blank
salary_effective_date: employment_date if available, otherwise blank
```

### Requirement 5 — Department Mapping

The `/users` page stores department as text.

The HR record requires `department_id` referencing `hr_departments.id`.

When creating the form:

1. Fetch departments from `GET /hr/departments`.
2. Attempt to preselect the department by matching the user’s text department to `hr_departments.name` or a known synonym.
3. Allow HR Admin/Admin to adjust the selected department.

Use a resilient mapper, for example:

```ts
function matchDepartmentId(userDepartment: string | null | undefined, departments: Department[]) {
  if (!userDepartment) return '';
  const normalized = userDepartment.trim().toLowerCase();
  const aliases: Record<string, string> = {
    'quality assurance': 'Quality Assurance',
    'qa': 'Quality Assurance',
    'production': 'Production',
    'operations': 'Production',
    'engineering': 'Engineering',
    'inventory': 'Inventory',
    'warehouse': 'Inventory',
    'human resources': 'Human Resources',
    'hr': 'Human Resources',
    'finance': 'Finance',
    'sales': 'Sales',
    'management': 'Management',
    'it': 'IT',
    'information technology': 'IT',
  };
  const target = aliases[normalized] ?? userDepartment;
  return departments.find(d => d.name.toLowerCase() === target.toLowerCase())?.id ?? '';
}
```

### Requirement 6 — Reports-To Mapping

The `/users` page stores `reports_to` as free text because the holiday approval workflow depends on it.

The HR record requires `reports_to_user_id` as a structured FK.

When creating the HR record:

1. Fetch active users from `/users` if the current role is allowed, or create a backend HR helper endpoint if needed.
2. Attempt to preselect the manager where `user.reports_to` matches another active user's `full_name`.
3. Allow HR Admin/Admin to adjust the selected manager.
4. Do **not** change or remove `users.reports_to`.

## Backend Fix

### 1. Update `hr-service.js`

Add or update functions so the HR service can return a profile for a user even if there is no HR record yet.

#### Add helper: `getBaseUserById(userId)`

```js
async function getBaseUserById(userId) {
  const result = await pool.query(`
    SELECT
      user_id,
      email,
      full_name,
      preferred_name,
      role,
      employee_number,
      job_title,
      department,
      reports_to,
      employment_date,
      employment_status,
      employment_type,
      is_active
    FROM users
    WHERE user_id = $1
    LIMIT 1
  `, [userId]);

  return result.rows[0] || null;
}
```

#### Update: `getEmployeeByUserId(userId, requestingUserRole)`

Current problem: this likely returns 404/null when `v_hr_employee_profile` has no row.

Required behavior:

1. First query `v_hr_employee_profile`.
2. If found, return the existing payload as now.
3. If not found, query the base `users` table.
4. If user exists, return:

```js
{
  profile: {
    ...baseUser,
    hr_record_exists: false,
    hr_status: null,
    department_structured: null,
    reports_to_name: baseUser.reports_to,
    onboarding_complete: false,
    onboarding_pct: 0,
    has_active_pip: false,
    probation_end_date: null,
    effective_probation_end: null,
    days_to_probation_end: null,
    basic_salary_zmw: undefined
  },
  contract: null,
  activePip: null
}
```

5. If neither HR profile nor base user exists, return `null` so the route can respond 404.
6. Keep salary redaction exactly as before.

#### Add function: `getUsersMissingHrRecord()`

```js
async function getUsersMissingHrRecord() {
  const result = await pool.query(`
    SELECT
      u.user_id,
      u.full_name,
      u.email,
      u.employee_number,
      u.job_title,
      u.department,
      u.reports_to,
      u.employment_date,
      u.employment_status,
      u.role,
      u.is_active
    FROM users u
    LEFT JOIN hr_employees he ON he.user_id = u.user_id
    WHERE u.is_active = TRUE
      AND he.user_id IS NULL
    ORDER BY u.full_name
  `);

  return result.rows;
}
```

Export it.

#### Update `createHrRecord()` return shape

After inserting/upserting into `hr_employees`, re-query `getEmployeeByUserId(userId, 'admin')` or return a joined profile so the frontend immediately receives synced base user + HR extension fields.

Do not return only the raw `hr_employees` row because it does not include `full_name`, `email`, `job_title`, `employment_date`, etc.

### 2. Update `hr-routes.js`

Add this route:

```js
GET /hr/employees-missing-records
```

Middleware:

```js
requireHrAdmin
```

Handler:

```js
router.get('/employees-missing-records', requireHrAdmin, async (req, res) => {
  try {
    const rows = await hrService.getUsersMissingHrRecord();
    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});
```

Keep this route before parameterized routes such as `/employees/:userId` if the current router path structure could conflict.

### 3. Keep Existing Route Permissions

Do not relax these:

```text
POST /hr/employees/:userId/record  -> requireHrAdmin
PUT  /hr/employees/:userId/record  -> requireHrAdmin
```

`hr_manager` must not be able to create or update the HR extension record.

## Frontend Fix

### 1. Update `frontend/app/hr/employees/page.tsx`

Add state for users missing HR records:

```ts
const [missingHrRecords, setMissingHrRecords] = useState<any[]>([]);
```

Fetch in parallel for admin/hr_admin:

```ts
const canCreateHrRecord = currentUser?.role === 'admin' || currentUser?.role === 'hr_admin';

const [employeesRes, departmentsRes, missingRes] = await Promise.all([
  axios.get(`${HR_BASE}/hr/employees`, { headers }),
  axios.get(`${HR_BASE}/hr/departments`, { headers }),
  canCreateHrRecord
    ? axios.get(`${HR_BASE}/hr/employees-missing-records`, { headers })
    : Promise.resolve({ data: [] }),
]);
```

Display the **Users Missing HR Record** table whenever `missingHrRecords.length > 0`, not only when the main HR employee table is empty.

Columns:

```text
Employee | Department / Job Title | Hire Date | Reports To | Action
```

Action:

```ts
router.push(`/hr/employees/${user.user_id}?create=true`)
```

Suggested heading:

```text
Users Missing HR Record
Active system users who need an HR extension record created.
```

This should connect directly to the Compliance Snapshot count “Missing HR Records.”

### 2. Update `frontend/app/hr/employees/[id]/page.tsx`

#### Add query param support

```ts
import { useSearchParams } from 'next/navigation';

const searchParams = useSearchParams();
const createModeRequested = searchParams.get('create') === 'true';
```

#### Update profile fetch behavior

Continue fetching:

```ts
GET /hr/employees/:id
```

But now the backend must return a base profile even when `hr_record_exists=false`.

Only fetch onboarding/reviews/leave if the HR record exists.

```ts
const empRes = await axios.get(`${HR_BASE}/hr/employees/${userId}`, { headers });
const returnedProfile = empRes.data?.profile;

setProfile(empRes.data);

if (returnedProfile?.hr_record_exists === false) {
  setOnboarding([]);
  setReviews([]);
  setLeave(null);
  return;
}

const [onbRes, revRes, leaveRes] = await Promise.all([
  axios.get(`${HR_BASE}/hr/employees/${userId}/onboarding`, { headers }),
  axios.get(`${HR_BASE}/hr/employees/${userId}/reviews`, { headers }),
  axios.get(`${HR_BASE}/hr/employees/${userId}/leave-balance`, { headers }),
]);
```

#### Add create/edit permissions

```ts
const canManageHrRecord = currentUser?.role === 'admin' || currentUser?.role === 'hr_admin';
const hasHrRecord = profile?.hr_record_exists !== false;
const showCreateForm = canManageHrRecord && (!hasHrRecord || createModeRequested);
```

If `!hasHrRecord && !canManageHrRecord`, show a read-only message:

```text
This employee has not yet had an HR record created. Please contact HR Admin.
```

#### Display base user data even before HR record exists

The Employment Details card must show:

```text
Full Name
Email
Employee Number
Job Title
Department from users.department
Reports To from users.reports_to
Employment Date
Employment Status
Employment Type
System Role
```

These fields must be read-only in the HR creation screen.

#### Add HR Record Creation Form

Create a form component in the same file or a small local component:

```tsx
function HRRecordForm({ profile, departments, users, token, onSaved }) { ... }
```

Fields:

```text
Department dropdown -> department_id
Reports To dropdown -> reports_to_user_id
HR Status dropdown -> hr_status
Contract Type dropdown/text -> contract_type
Offer Accepted Date -> offer_accepted_date
Basic Salary ZMW -> basic_salary_zmw
Salary Effective Date -> salary_effective_date
NAPSA Member Number -> napsa_member_number
```

Submit:

```ts
await axios.post(`${HR_BASE}/hr/employees/${userId}/record`, payload, { headers });
```

After save:

1. Show success message.
2. Refetch profile.
3. Navigate to `/hr/employees/${userId}` without `?create=true`.

```ts
router.replace(`/hr/employees/${userId}`);
```

### 3. Do Not Recreate User Data Inside HR Form

The HR form must not ask for:

```text
full_name
email
employee_number
job_title
employment_date
employment_status
role
```

Those belong to `/users` and must be shown as already synced base information.

## Optional But Recommended: Small Shared Type Helpers

If repeated in multiple HR pages, create:

```text
frontend/lib/hr-utils.ts
```

Only if the project already has a `lib` pattern.

Helpers:

```ts
export function formatHrStatus(...)
export function matchDepartmentId(...)
export function canManageHrRecord(role?: string) { return role === 'admin' || role === 'hr_admin'; }
export function canAccessHr(role?: string) { ... }
```

Do not create this file if it increases scope unnecessarily.

## Validation Checklist

### Backend checks

Run:

```bash
node -e "require('./backend/src/services/hr-service.js')"
node -e "require('./backend/src/routes/hr-routes.js')"
```

Start backend:

```bash
cd backend
npm run dev
```

Test with an admin/hr_admin token:

```bash
curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:PORT/hr/employees-missing-records
curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:PORT/hr/employees/USER_ID_WITHOUT_HR_RECORD
```

Expected for user without HR record:

```json
{
  "profile": {
    "user_id": "...",
    "full_name": "...",
    "email": "...",
    "job_title": "...",
    "department": "...",
    "employment_date": "...",
    "hr_record_exists": false
  },
  "contract": null,
  "activePip": null
}
```

Test create:

```bash
curl -X POST \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "department_id": 1,
    "reports_to_user_id": "MANAGER_USER_ID",
    "hr_status": "onboarding",
    "contract_type": "Probationary",
    "offer_accepted_date": "2026-06-01",
    "basic_salary_zmw": 5000,
    "salary_effective_date": "2026-06-01",
    "napsa_member_number": ""
  }' \
  http://localhost:PORT/hr/employees/USER_ID/record
```

Expected:

- HR record is created.
- The returned payload includes synced user data and HR extension data.
- `GET /hr/employees-missing-records` no longer includes that user.
- Compliance Snapshot missing record count decreases by one.

### Frontend checks

Run:

```bash
cd frontend
npm run build
npm run dev
```

Manual checks:

1. Login as admin/hr_admin.
2. Go to `/hr`.
3. Confirm Compliance Snapshot still shows Missing HR Records count.
4. Click **Add HR Record**.
5. On `/hr/employees`, confirm the **Users Missing HR Record** section appears.
6. Click **Create HR Record** for one user.
7. Confirm `/hr/employees/[id]?create=true` opens.
8. Confirm the employee’s full name, email, employee number, job title, department, reports_to, and hire date are visible from `/users` data.
9. Complete HR extension fields and save.
10. Confirm the profile reloads with HR status, probation fields, and salary fields visible only to admin/hr_admin.
11. Login as hr_manager.
12. Confirm hr_manager can view HR pages allowed by the existing layout but cannot create/save HR records.
13. Confirm hr_manager can still update onboarding only where existing implementation allows it.
14. Login as viewer/staff/operator.
15. Confirm no HR Module access.

## Protected Files

Do not modify these files unless absolutely necessary and directly related to this fix:

```text
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
frontend/app/products/
frontend/app/login/page.tsx
frontend/components/inventory/
database/
```

Do not modify the `holiday_requests` table or existing holiday approval logic.

## Expected Commit

```bash
git add backend/src/services/hr-service.js \
        backend/src/routes/hr-routes.js \
        frontend/app/hr/employees/page.tsx \
        frontend/app/hr/employees/[id]/page.tsx

git commit -m "fix(hr): sync user setup data into HR record creation flow"
```

If additional files were changed only because the actual repo structure requires it, include them in the commit and mention why in the commit body.

## Acceptance Criteria

This fix is complete only when:

- Active users without `hr_employees` rows appear in the HR module.
- The HR record creation page shows user setup data from `/users` before the HR record exists.
- The HR record form collects only HR extension fields.
- The saved HR profile displays both user data and HR data.
- Missing HR Records count and missing-record list reconcile correctly.
- HR Admin/Admin can create HR records.
- HR Manager cannot create HR records and remains limited to onboarding/direct-report responsibilities.
- Existing HR dashboard, onboarding, reviews, performance, leave, and holiday workflows still work.
