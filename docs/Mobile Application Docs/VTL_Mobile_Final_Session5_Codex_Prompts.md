# VTL Executive Mobile App — Final Session 5 Codex Prompts

Use these prompts in **Codex inside VS Code** from the repository root:

```text
C:\Users\willi\GitHub\VTL_Inventory_MGTv2
```

Run each prompt as a separate session. Commit and test after each session before continuing.

---

# Universal Context Block — Paste at the Start of Every Codex Session

```text
CONTEXT: VTL Executive mobile app for Vilagio Trading Limited

Project root: C:\Users\willi\GitHub\VTL_Inventory_MGTv2
Mobile app: /vtl-mobile — React Native Expo Router, TypeScript
Backend: /backend — Node/Express API connected to Neon PostgreSQL
Backend API base URL: https://vilagio-erp-backend.onrender.com/api

Current project state:
- Phase 5A Session 4 has been deployed: Operations, Quality, and People tabs were rebuilt with skeletons and polish.
- Header Polish Sessions A, B, and C have been completed: VTLAppHeader, role-coloured avatar/header, dropdown logout, zebra rows, vibrant borders, SectionHeader accent, KPI glow, StatusBadge dot, and active tab indicator.
- We now need a unified final Session 5 that fixes access control, data correctness, the Quality tab key warning, the Batch Detail data issue, People activity filtering, finished-product-only low-stock alerts, and the Home dashboard UI.

Important existing files likely involved:
- vtl-mobile/app/_layout.tsx
- vtl-mobile/app/(auth)/login.tsx
- vtl-mobile/app/(tabs)/index.tsx
- vtl-mobile/app/(tabs)/operations.tsx
- vtl-mobile/app/(tabs)/quality.tsx
- vtl-mobile/app/(tabs)/people.tsx
- vtl-mobile/app/batch/[id].tsx
- vtl-mobile/services/api.ts
- vtl-mobile/stores/authStore.ts
- vtl-mobile/constants/theme.ts
- vtl-mobile/components/VTLAppHeader.tsx
- backend/src/routes/mobile-routes.js
- backend/src/services/mobile-service.js
- backend/server.js

Protection rules:
1. Do NOT modify /frontend. The web ERP must remain untouched.
2. Do NOT uninstall, upgrade, or replace npm packages.
3. Do NOT remove VTLAppHeader or replace it with ProfileHeader.
4. Do NOT change commercial.tsx revenue query logic, currency toggle logic, or working commercial data transformations unless only fixing compile/import/layout issues.
5. Keep all backgrounds dark: COLORS.bg, COLORS.surface, or COLORS.surfaceAlt only. No white backgrounds.
6. Use existing design tokens from constants/theme.ts: COLORS, RADIUS, SHADOW, zebraRow, formatCurrency, timeAgo.
7. Use SkeletonLoader components for loading states.
8. Guard string methods: (value ?? '').toUpperCase(), etc.
9. Preserve pull-to-refresh on scroll screens.
10. Commit after each completed session.

Business requirements for final Session 5:
A. Mobile app access must be restricted to Managers, CEO, CFO, and System Admin/Admin only.
B. Fix Expo warning in app/(tabs)/quality.tsx: every child in mapped lists must have a unique stable key.
C. Upgrade Home/Dashboard to look and feel like a senior-leadership Power BI-style command centre.
D. Fix Batch Detail so an in-progress batch opens real ERP data instead of blank placeholders.
E. People tab/system activity should show only the last 45 days.
F. Low stock alerts should focus on finished products only, not equipment components.

Testing after each session:
- cd vtl-mobile
- npx expo start --clear
- If scripts exist, run npm run typecheck and npm run lint.
```

---

# Codex Session 5.0 — Repository Audit and Implementation Plan

```text
Paste the Universal Context Block first, then continue:

SESSION 5.0 — Audit current code before editing.

Goal:
Inspect the repository and produce a concise implementation plan before making changes. Do not modify files in this session unless you need to add a temporary note file, which should not be committed.

Tasks:
1. Inspect mobile auth flow:
   - vtl-mobile/app/_layout.tsx
   - vtl-mobile/app/(auth)/login.tsx
   - vtl-mobile/stores/authStore.ts
   - vtl-mobile/services/api.ts

2. Inspect current mobile backend routes:
   - backend/src/routes/mobile-routes.js
   - backend/src/services/mobile-service.js
   - backend/server.js
   - auth/authorize middleware files

3. Determine actual role names used by the system.
   Look for role values such as admin, system_admin, ceo, cfo, manager, qa, staff, operator, viewer, super_viewer.

4. Inspect batch list and batch detail flow:
   - vtl-mobile/app/(tabs)/operations.tsx
   - vtl-mobile/app/batch/[id].tsx
   - vtl-mobile/services/api.ts
   - any hooks used for operations/batch detail
   - backend production/batch routes and services

5. Inspect product/inventory schema usage:
   - backend inventory service/routes
   - backend product-related service/routes
   - SQL queries in mobile-service.js
   Identify the safest field to distinguish finished products from equipment/components.

6. Inspect People activity query:
   - backend mobile-service.js getPeopleSummary()
   - vtl-mobile/app/(tabs)/people.tsx

7. Inspect quality.tsx for every .map() call, array render, and tab-pill render that may be missing a stable key.

8. Inspect Home dashboard screen:
   - vtl-mobile/app/(tabs)/index.tsx
   Note the current data fields available from /api/mobile/dashboard and /api/mobile/alerts.

Output only:
- Exact files that need changing.
- Exact backend endpoints involved.
- Actual role names found.
- Actual product type/category field found for finished products.
- Exact batch detail endpoint and response shape if discoverable.
- A safe order of implementation.

Do not make code changes in this session.
```

---

# Codex Session 5.1 — Executive-only Mobile Access Control

```text
Paste the Universal Context Block first, then continue:

SESSION 5.1 — Restrict mobile access to executive/manager roles.

Goal:
Only Managers, CEO, CFO, and System Admin/Admin should access the mobile app and /api/mobile/* data. Regular staff/operators/viewers/sales/engineering/QA-only users should not access the executive mobile app unless their role is also manager/admin/ceo/cfo.

Allowed mobile roles:
- admin
- system_admin, if this role exists
- ceo
- cfo
- manager

Important:
- Enforce this at backend route level for /api/mobile/*.
- Also provide a clear mobile UI restricted-access state after login.
- Do not break the web ERP.
- Do not change the core auth login query logic.

Backend tasks:
1. Open backend/src/routes/mobile-routes.js.
2. Find where authenticate is applied.
3. Add a mobile role guard middleware for all /api/mobile routes.
   Prefer existing authorize middleware if it exists and supports role arrays.
   If no suitable middleware exists, create a small local middleware inside mobile-routes.js:

   const MOBILE_ALLOWED_ROLES = ['admin', 'system_admin', 'ceo', 'cfo', 'manager'];
   function requireMobileExecutiveAccess(req, res, next) {
     const role = String(req.user?.role ?? '').toLowerCase();
     if (!MOBILE_ALLOWED_ROLES.includes(role)) {
       return res.status(403).json({
         error: 'MOBILE_ACCESS_RESTRICTED',
         message: 'VTL Executive mobile access is restricted to Managers, CEO, CFO and System Admin users.'
       });
     }
     next();
   }

4. Apply this middleware after authenticate and before all mobile routes:
   router.use(authenticate);
   router.use(requireMobileExecutiveAccess);

5. If route structure already uses router.use(authenticate), patch carefully without duplicating it.

Mobile tasks:
1. Add an allowed-role helper in a sensible place. Prefer a small utility in vtl-mobile/stores/authStore.ts or vtl-mobile/utils/access.ts if utils exists.

   const MOBILE_ALLOWED_ROLES = ['admin', 'system_admin', 'ceo', 'cfo', 'manager'];
   export const hasMobileExecutiveAccess = (role?: string | null) =>
     MOBILE_ALLOWED_ROLES.includes(String(role ?? '').toLowerCase());

2. In the auth guard/root layout after user is loaded, if authenticated but not allowed:
   - render or route to an Access Restricted screen.
   - Do not show tabs.
   - Include a Sign Out button that calls logout and returns to login.

3. Create a simple screen if needed:
   - vtl-mobile/app/access-restricted.tsx
   - Use SafeAreaView, COLORS.bg, VTLAppHeader if safe, and a polished card.
   - Text: “Access Restricted”
   - Subtext: “VTL Executive mobile access is reserved for Managers, CFO, CEO and System Admin users.”

4. Ensure API 403 errors with MOBILE_ACCESS_RESTRICTED are handled gracefully if a restricted user somehow reaches a mobile query.

Testing:
- Confirm manager/ceo/cfo/admin can access tabs.
- Confirm staff/operator/viewer cannot access tabs.
- Confirm backend /api/mobile/dashboard returns 403 for restricted users.
- Confirm web ERP files were not touched.

Commit:
- git add backend/src/routes/mobile-routes.js vtl-mobile/
- git commit -m "fix: restrict VTL Executive mobile access to leadership roles"
```

---

# Codex Session 5.2 — Backend Data Corrections: Batch Detail, 45-day Activity, Finished-product Inventory

```text
Paste the Universal Context Block first, then continue:

SESSION 5.2 — Fix backend data correctness for final Session 5.

Goal:
Correct backend/mobile-service data so the mobile app receives the right business data:
1. Batch detail endpoint returns full ERP batch detail.
2. People activity is limited to last 45 days.
3. Low-stock and zero-stock executive alerts focus on finished products only.

Protection:
- Do not modify /frontend.
- Do not blindly invent table or column names. Inspect existing backend services and SQL first.
- Keep all existing successful queries working.
- Wrap optional table queries in try/catch if existing code uses that pattern.

Part A — People activity last 45 days:
1. Open backend/src/services/mobile-service.js.
2. Find getPeopleSummary().
3. Find recent_activity or audit_log query.
4. Add a backend SQL filter:
   created_at >= NOW() - INTERVAL '45 days'
5. Keep ordering DESC.
6. Return metadata if useful:
   activity_window_days: 45
   recent_activity_count: recent_activity.length

Part B — Finished-product-only low stock and zero stock:
1. Inspect products/inventory schema and existing product fields.
2. Identify the correct field to distinguish finished products.
   Use actual schema names only.
3. Patch dashboard low_stock_items and zero_stock_items metrics so they only count finished products.
4. Patch operations low_stock list so it only returns finished products.
5. Patch commercial zero_stock or stock-out impact if it is used as an executive finished-product alert.
6. Preserve existing inventory transaction feed; do not filter all transactions unless the section is explicitly low-stock or zero-stock alert.
7. Return clear field names if possible:
   finished_product_low_stock_items
   finished_product_zero_stock_items
   Keep old names as aliases for backward compatibility if mobile currently reads them:
   low_stock_items: finishedProductLowStockCount
   zero_stock_items: finishedProductZeroStockCount

Part C — Batch detail data endpoint:
1. Inspect existing backend production/batch routes and services.
2. Find the route used by the web ERP to load a batch detail page.
3. If an existing authenticated endpoint already returns full batch detail, do not duplicate logic. Document its path and ensure mobile API client can call it.
4. If no mobile-friendly endpoint exists, add GET /api/mobile/batches/:id in mobile-routes.js that calls a service method in mobile-service.js.
5. The response should include:
   - batch_id
   - batch_number or record_code
   - product_name
   - status
   - planned_quantity
   - output_quantity or actual_quantity
   - rejected_quantity
   - yield_pct, calculated if not stored
   - production_date
   - production_line
   - shift
   - supervisor_name
   - created_by_name
   - created_at
   - components array
   - qa_gates array
6. Use LEFT JOINs so missing components or QA gates do not make the whole detail fail.
7. If table names differ, map the actual result to the expected response shape.

Testing:
- Use existing route tests/manual curl if possible.
- Confirm /api/mobile/people returns only recent_activity from last 45 days.
- Confirm /api/mobile/dashboard low-stock metrics refer only to finished products.
- Confirm /api/mobile/operations low_stock list excludes equipment/components.
- Confirm batch detail route returns populated JSON for an in-progress batch.

Commit:
- git add backend/src/services/mobile-service.js backend/src/routes/mobile-routes.js
- git commit -m "fix: correct mobile executive data filters and batch detail API"
```

---

# Codex Session 5.3 — Mobile Bug Fixes: Quality Keys, Batch Detail Mapping, People Defensive Filter

```text
Paste the Universal Context Block first, then continue:

SESSION 5.3 — Fix mobile runtime issues and data mapping.

Goal:
1. Remove Expo warning from quality.tsx: every mapped child must have a unique stable key.
2. Make Batch Detail render real backend data with robust fallbacks.
3. Add mobile-side defensive filtering for People activity to last 45 days.
4. Update labels for finished-product low-stock scope.

Part A — quality.tsx unique keys:
1. Open vtl-mobile/app/(tabs)/quality.tsx.
2. Find every .map() call and every dynamically rendered child array.
3. Add stable unique keys to the top-level returned element of each map.
4. Prefer true IDs first:
   - section_id, section_code
   - ncr_id, ncr_code
   - capa_id, capa_code
   - audit_id
   - training_id, user_id, document_id
5. Use deterministic fallback only if no ID exists:
   key={`ncr-${item.ncr_code ?? index}`}
6. Do not use only index unless the list is a static tab array.
7. For static tab arrays, key by tab label/value.
8. Preserve zebraRow(index), severity borders, StatusBadge, and VTLAppHeader.

Part B — batch detail mobile screen:
1. Open:
   - vtl-mobile/app/batch/[id].tsx
   - vtl-mobile/services/api.ts
   - any batch hook if it exists
2. Ensure the screen uses the correct endpoint found in Session 5.2.
3. Add or patch an API method such as getBatchDetail(id).
4. Add a React Query hook if the screen does not already have one.
5. Map response defensively:
   const planned = Number(batch?.planned_quantity ?? batch?.planned_qty ?? 0)
   const output = Number(batch?.output_quantity ?? batch?.actual_quantity ?? batch?.output ?? 0)
   const rejected = Number(batch?.rejected_quantity ?? batch?.rejected ?? 0)
   const yieldPct = batch?.yield_pct ?? (planned > 0 ? ((output - rejected) / planned) * 100 : null)
6. Replace placeholder dashes only when data is truly missing.
7. Components section:
   - If components.length > 0, render cards/rows with product/component name, planned qty, issued qty, unit, lot/batch if available.
   - If empty, show “No components recorded for this batch.”
8. QA Gates section:
   - If qa_gates.length > 0, render gate name, status, checked_by, checked_at.
   - If empty, show “No QA gates recorded for this batch.”
9. Add loading skeletons, error state, retry action, and pull-to-refresh if applicable.
10. Keep VTLAppHeader with showBack=true and title from batch number.

Part C — people.tsx 45-day defensive filter:
1. Open vtl-mobile/app/(tabs)/people.tsx.
2. Filter recent_activity client-side to created_at >= Date.now() - 45 days.
3. Change section subtitle to “Last 45 days”.
4. Empty state: “No system activity recorded in the last 45 days.”

Part D — finished product labels:
1. In Home and Operations, update visible labels:
   - “Low Stock” to “Finished Product Low Stock” where space allows, or “FP Low Stock” on compact cards with subtitle “Finished products only”.
   - “Zero Stock” to “Finished Product Zero Stock” where displayed.
2. Preserve backward-compatible field reading:
   dashboard?.finished_product_low_stock_items ?? dashboard?.low_stock_items ?? 0

Testing:
- Expo warning about QualityScreen keys is gone.
- Quality tab switches all sub-tabs without warnings.
- Batch detail for an in-progress batch shows actual values.
- People activity older than 45 days is not displayed.
- Finished-product labels are clear.

Commit:
- git add vtl-mobile/
- git commit -m "fix: repair mobile data mapping and quality list keys"
```

---

# Codex Session 5.4 — Home Dashboard Executive BI Upgrade

```text
Paste the Universal Context Block first, then continue:

SESSION 5.4 — Upgrade Home dashboard into an executive BI command centre.

Goal:
Improve app/(tabs)/index.tsx so the first screen after login feels like a high-end senior leadership dashboard, similar to an executive Power BI mobile view, while preserving the existing VTL dark theme and working data hooks.

Protection:
- Do not modify commercial.tsx logic.
- Do not remove VTLAppHeader.
- Do not introduce new packages.
- Use existing components where possible: KpiCard, SectionHeader, StatusBadge, MiniBarChart, MiniLineIndicator, SkeletonLoader.
- Use only COLORS.bg, COLORS.surface, COLORS.surfaceAlt, and existing accent colours.

Data:
Use existing hooks/data already in index.tsx:
- dashboard summary from /api/mobile/dashboard
- alerts from /api/mobile/alerts
- optional operations data only if already safely available; do not create risky extra fetches unless a hook already exists.

Required layout:

1. VTLAppHeader remains at the top.
   - Keep notification bell as rightElement.
   - Bell red dot if high-severity alerts exist.

2. Executive Snapshot Hero card near top:
   - Large status label:
     - “Critical” if any HIGH alerts or overdue CAPAs > 0
     - “Attention Required” if medium alerts, open NCRs, or low stock > 0
     - “Stable” otherwise
   - Show qms_completion_pct prominently.
   - Show active batch count and finished product low-stock count as mini metrics.
   - Show “Updated {timeAgo/latest created_at or just now}”.
   - Use borderLeftColor based on status: red/amber/green.

3. KPI Intelligence Grid:
   Use 2-column cards but improve hierarchy and subtitles.
   Cards:
   - Active Batches — subtitle “Production pulse”
   - Open NCRs — subtitle “Quality attention”
   - Overdue CAPAs — subtitle “Action required”
   - FP Low Stock — subtitle “Finished products only”
   - Docs in Review — subtitle “QMS workflow”
   - QMS Ready — subtitle “Released document coverage”

4. Risk Radar section:
   - SectionHeader title “Risk Radar” subtitle “Items requiring leadership attention”
   - Horizontal or vertical cards for top high/medium alerts.
   - Each card: severity left border, title, short description, timeAgo.
   - Empty state: “No critical risks right now.”

5. Operations Pulse section:
   - Show a compact status mix if batch status counts are available from dashboard or operations hook.
   - If not available, show active batches and next action card using current dashboard fields.
   - Do not invent fake values.

6. Recent Activity section:
   - Keep first 8 alerts/activity items.
   - Label: “Recent Activity” subtitle “Last 24 hours”.
   - Use timeline styling with coloured severity dots and zebra backgrounds.

7. Quick Actions band:
   - Keep existing quick actions, but make the band more premium:
     bg COLORS.surfaceAlt, border COLORS.border, rounded RADIUS.xl.
   - Actions: Documents, NCRs, Batches, Sales.

8. Loading and error handling:
   - Skeleton hero and KPI cards while loading.
   - Pull-to-refresh preserved.
   - Error card with retry if dashboard fails.

Implementation guidance:
- Create small local helper functions inside index.tsx:
  getExecutiveStatus(dashboard, alerts)
  getSeverityColor(severity)
  getNumber(value)
- Use defensive values:
  dashboard?.finished_product_low_stock_items ?? dashboard?.low_stock_items ?? 0
- Keep number formatting clean.
- Avoid dense text; use visual hierarchy.

Testing:
- Home screen loads without TypeScript errors.
- Pull-to-refresh works.
- Bell navigates to notifications.
- Dashboard looks richer than the current basic grid.
- No white backgrounds.
- No console.log statements.

Commit:
- git add vtl-mobile/app/(tabs)/index.tsx
- git commit -m "feat: upgrade home dashboard to executive BI command centre"
```

---

# Codex Session 5.5 — Final Regression Sweep and Pre-APK Readiness

```text
Paste the Universal Context Block first, then continue:

SESSION 5.5 — Final regression sweep before APK testing.

Goal:
Run a careful final pass across the mobile app and touched backend files. Fix only real issues. Do not redesign large areas in this session.

Checklist:

A. Global visual rules
1. Search vtl-mobile for white backgrounds:
   - '#fff'
   - '#FFFFFF'
   - 'white'
   Replace only actual background colours with COLORS.bg/COLORS.surface/COLORS.surfaceAlt.
2. Ensure all screen roots use SafeAreaView or safe root with backgroundColor COLORS.bg.
3. Ensure cards use COLORS.surface, COLORS.border, RADIUS.lg or larger, and SHADOW.card where appropriate.

B. Runtime safety
1. Search for unsafe string methods:
   - .toUpperCase()
   - .toLowerCase()
   - .trim()
   - .split()
   - .includes()
   - .replace()
   Guard dynamic values with fallback strings.
2. Confirm every mapped child in quality.tsx, operations.tsx, people.tsx, commercial.tsx, and index.tsx has a key.
3. Remove console.log statements. Keep console.error only.

C. Data correctness
1. Confirm mobile access control remains active in backend mobile routes.
2. Confirm People activity label says Last 45 days and data is filtered.
3. Confirm low stock labels say finished product / FP and backend aliases remain backward compatible.
4. Confirm batch detail screen handles:
   - loading
   - error
   - empty components
   - empty QA gates
   - missing optional fields

D. Navigation
1. Confirm VTLAppHeader appears on tabs, notifications, and batch detail.
2. Confirm back arrow works on notifications and batch detail.
3. Confirm logout clears cache and returns to login.
4. Confirm restricted access screen has a working sign-out action.

E. Build checks
1. From /vtl-mobile run:
   npx expo start --clear
2. If available, run:
   npm run typecheck
   npm run lint
3. Fix any TypeScript errors caused by final edits.

F. Git
1. Commit final sweep:
   git add backend/ vtl-mobile/
   git commit -m "chore: final mobile executive readiness sweep"
2. Tag pre-APK:
   git tag v1.0.0-pre-apk

Output summary:
- Files changed.
- Issues fixed.
- Any remaining risks or manual checks.
```

---

# Optional Codex Session 5.6 — Manual API Verification Script

```text
Paste the Universal Context Block first, then continue:

OPTIONAL SESSION 5.6 — Add a local-only manual API verification note/script.

Goal:
Create a developer-only markdown checklist for manually verifying mobile API responses before APK build. Do not add secrets. Do not commit tokens.

Create:
- vtl-mobile/docs/mobile-api-verification.md

Include sections:
1. Login and copy JWT from secure dev flow.
2. Verify /api/mobile/dashboard.
3. Verify /api/mobile/operations.
4. Verify /api/mobile/people returns only last 45 days.
5. Verify /api/mobile/batches/:id or chosen batch detail endpoint.
6. Verify restricted roles get 403 from /api/mobile/dashboard.
7. Verify manager/ceo/cfo/admin roles get 200.

Use curl examples with placeholder token:
Authorization: Bearer <JWT_TOKEN>

Commit:
- git add vtl-mobile/docs/mobile-api-verification.md
- git commit -m "docs: add mobile API verification checklist"
```
