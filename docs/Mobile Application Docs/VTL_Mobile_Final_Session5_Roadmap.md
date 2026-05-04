# VTL Executive Mobile App — Unified Final Session 5 Roadmap

**Prepared for:** Vilagio Trading Limited  
**Project:** Hybrid ERP companion mobile app — `vtl-mobile`  
**Target workflow:** Codex in VS Code  
**Current build state:** Phase 5A Session 4 deployed; Header Polish Sessions A, B, C completed; final Session 5 now needs to merge functionality, security, data correctness, bug repair, and executive-dashboard polish.

---

## 1. Purpose of This Unified Final Session

The original mobile roadmap defined the app as a **read-first executive command centre** for senior leadership, not a full ERP replacement. Its goal is to surface live signals such as production status, QMS readiness, low stock, open NCRs, CAPAs, and recent activity from the existing ERP backend.

Phase 5A improved the design system and rebuilt the Home, Operations, Quality, Commercial, and People tabs. The Header Polish sessions then introduced the `VTLAppHeader`, role-coloured avatar/header behaviour, zebra rows, coloured borders, section accents, KPI glow, status badge dots, and tab indicators.

This final Session 5 is therefore not just a generic polish pass. It should become a **stabilisation and executive-readiness session** that fixes lost context and prepares the app for APK testing.

---

## 2. Consolidated Issues to Resolve

### 2.1 Executive-only mobile access

The app is currently available to any Vilagio employee. This must be corrected.

**Required mobile access roles:**

- `admin`
- `system_admin`, if this exists in the backend role model
- `ceo`
- `cfo`
- `manager`

**Important:** Do not rely only on hiding tabs in the app. Mobile access must be enforced at the backend route level as well.

**Expected behaviour:**

1. Non-authorised users can still authenticate in the ERP web system if allowed there.
2. Non-authorised users must not access `/api/mobile/*` data.
3. The mobile app should show a clear “Access Restricted” screen after login if the authenticated user role is not allowed.
4. The restriction should not break normal web ERP access.

---

### 2.2 `quality.tsx` list key warning

Expo Go reports:

> Each child in a list should have a unique `key` prop. Check the render method of `View`. It was passed a child from `QualityScreen`.

This is usually caused by one or more `.map()` calls returning views without stable keys, or by using an unstable duplicate value such as an index where the list can change.

**Affected area:** `app/(tabs)/quality.tsx`

**Likely candidates:**

- QMS section progress rows
- NCR cards
- CAPA cards
- audit cards
- training rows
- sub-tab arrays
- dynamically rendered pill filters

**Expected fix:**

Every mapped child must have a stable key using a true database identifier first, then a deterministic fallback.

Example strategy:

```tsx
key={item.ncr_id ?? item.ncr_code ?? `ncr-${index}`}
```

---

### 2.3 Home/Dashboard must look like an executive BI command centre

The current Home/Dashboard UI is functional but still visually basic. It needs to feel closer to a high-end Power BI-style leadership cockpit.

**Design direction:**

- Keep the dark VTL executive theme.
- Do not introduce white backgrounds.
- Keep existing `VTLAppHeader`.
- Use richer KPI grouping, visual hierarchy, trend indicators, and insight cards.
- Prioritise leadership questions: “What is running?”, “What needs attention?”, “Where is risk?”, “What changed recently?”

**Recommended dashboard sections:**

1. **Executive Snapshot Hero**
   - Overall operational status: `Stable`, `Attention Required`, or `Critical`
   - QMS readiness ring/large percentage
   - Critical alert count
   - Last refreshed timestamp

2. **KPI Intelligence Grid**
   - Active Batches
   - Open NCRs
   - Overdue CAPAs
   - Finished Product Low Stock
   - Docs in Review
   - QMS Ready

3. **Risk Radar**
   - Critical NCRs
   - overdue CAPAs
   - zero-stock finished products
   - stalled or in-progress batches requiring attention

4. **Operations Pulse**
   - active batch mix by status
   - top 3 in-progress batches
   - quick link to Operations tab

5. **Recent Activity Timeline**
   - last 24 hours on Home only
   - full activity lives in People, restricted to 45 days

---

### 2.4 Batch Detail page does not pull ERP data

The Batch Detail screen currently shows placeholders for planned, output, yield, batch metadata, components, and QA gates. When an in-progress batch is opened, the screen is not receiving or mapping full data from the main web application/backend.

**Affected file:** `app/batch/[id].tsx`

**Likely affected API layer:**

- `services/api.ts`
- possible hook such as `hooks/useBatch.ts`
- existing backend route such as `/production/batches/:id`
- possible new mobile route `/api/mobile/batches/:id`

**Expected fix:**

1. Inspect the backend production route and the web ERP frontend to identify the correct batch detail endpoint and response schema.
2. Ensure the mobile app calls the correct endpoint with the correct batch identifier.
3. Add defensive mapping so the page supports different possible field names, for example:
   - `batch_number` / `record_code` / `batch_code`
   - `planned_quantity` / `planned_qty`
   - `actual_quantity` / `output_quantity`
   - `product_name`
   - `production_line`
   - `shift`
   - `supervisor_name`
   - `components`
   - `qa_gates`
4. Show skeletons while loading, meaningful error states, and “not recorded yet” only when the backend truly returns empty arrays.

---

### 2.5 People tab activity must show last 45 days only

The People tab is currently pulling very old system activity, including records around 90 days old. It should only show activity from the last 45 days.

**Affected areas:**

- Backend: `mobile-service.js` → `getPeopleSummary()`
- Mobile: `app/(tabs)/people.tsx`

**Expected fix:**

1. Apply the 45-day filter in the backend query first:

```sql
WHERE created_at >= NOW() - INTERVAL '45 days'
```

2. Keep an additional mobile-side defensive filter in case the endpoint response contains older items.
3. Update labels from generic “Recent Activity” to “Activity — Last 45 Days”.
4. Empty state should say: “No system activity recorded in the last 45 days.”

---

### 2.6 Low stock alert should focus on finished products only

Low stock alerts should focus on finished products, not equipment components.

**Affected areas:**

- Backend: dashboard and operations low-stock queries
- Mobile: Home KPI label and Operations Inventory list

**Expected fix:**

1. Inspect the products schema to identify the correct product type/category field.
2. Filter low-stock and zero-stock queries to finished goods only.
3. Rename labels to avoid ambiguity:
   - `Low Stock` → `Finished Product Low Stock`
   - `Zero Stock` → `Finished Product Zero Stock`
4. Do not remove equipment/component inventory from the ERP; only exclude it from executive low-stock alert cards.

**Possible schema filters to inspect, not blindly apply:**

```sql
LOWER(p.product_type) IN ('finished_product', 'finished product', 'finished_good', 'finished goods')
```

or

```sql
LOWER(p.category) LIKE '%finished%'
```

Codex must inspect actual table/field names before editing SQL.

---

## 3. Recommended Codex Session Flow

Run the final work in six controlled Codex sessions. Each session should be committed and tested before moving to the next.

| Session | Focus | Main Outcome |
|---|---|---|
| 5.0 | Repository audit and schema discovery | Confirm exact files, endpoints, roles, product fields, batch detail schema |
| 5.1 | Executive access control | Only managers, CEO, CFO, and admins can access mobile app/API |
| 5.2 | Backend data corrections | Batch detail data, People 45-day activity, finished-product inventory filters |
| 5.3 | Mobile bug fixes | `quality.tsx` unique keys, batch detail mapping, mobile defensive filters |
| 5.4 | Executive dashboard upgrade | Home becomes a high-end business intelligence command centre |
| 5.5 | Regression sweep and pre-APK readiness | Global polish, TypeScript, runtime checks, final commit/tag |

---

## 4. Source-aware Protection Rules

These rules should appear in every Codex prompt.

1. Do not touch the web frontend under `/frontend`.
2. Do not change commercial revenue/currency toggle logic unless a compile error requires an import-only or layout-only fix.
3. Do not uninstall or upgrade packages.
4. Do not change authentication login/logout query logic unless adding role restriction handling after login.
5. Do not break `VTLAppHeader` or remove it from screens.
6. Keep backgrounds dark: `COLORS.bg`, `COLORS.surface`, or `COLORS.surfaceAlt` only.
7. Use `SkeletonLoader` states on loading paths.
8. Guard string methods with `(value ?? '')`.
9. Use `timeAgo()` for timestamps unless an absolute date is clearer.
10. Use `formatCurrency()` for money values.
11. After each session run:

```bash
cd vtl-mobile
npx expo start --clear
```

12. Also run TypeScript/lint checks if scripts exist:

```bash
npm run typecheck
npm run lint
```

---

## 5. Acceptance Criteria

### Access control

- A non-authorised employee cannot access the mobile app dashboard.
- A non-authorised employee receives a clear restricted-access message.
- `/api/mobile/*` routes reject non-authorised roles.
- CEO, CFO, manager, and admin/system admin roles still work.

### Quality tab

- Expo warning about unique keys is gone.
- Quality tab sub-tabs render without runtime warning.
- NCR/CAPA/audit/training rows retain styling and zebra rows.

### Home dashboard

- Home screen has a clear executive snapshot.
- KPI cards are visually grouped and meaningful.
- Risk and operations insights are visible before deep scrolling.
- The screen feels like a senior leadership dashboard, not a basic KPI grid.

### Batch detail

- Tapping an in-progress batch loads actual ERP batch detail.
- Planned, output, rejected, yield, batch metadata, components, and QA gates are populated when data exists.
- Empty states only show when the backend returns no components or QA gates.
- Errors display a retry option.

### People tab

- Activity feed only shows activity from the last 45 days.
- Label clearly states “Last 45 Days”.
- Empty state is clear if no activity exists.

### Inventory alerts

- Low stock and zero stock executive alerts focus on finished products only.
- Equipment components are not included in executive low-stock cards.
- Labels make the finished-product scope clear.

---

## 6. Files Likely to Be Needed for Better Context

The prompts are designed to make Codex inspect the repository directly. However, if manual review is needed before running Codex, the most useful files to share are:

### Mobile app

- `vtl-mobile/app/_layout.tsx`
- `vtl-mobile/app/(auth)/login.tsx`
- `vtl-mobile/app/(tabs)/index.tsx`
- `vtl-mobile/app/(tabs)/operations.tsx`
- `vtl-mobile/app/(tabs)/quality.tsx`
- `vtl-mobile/app/(tabs)/people.tsx`
- `vtl-mobile/app/batch/[id].tsx`
- `vtl-mobile/services/api.ts`
- `vtl-mobile/stores/authStore.ts`
- `vtl-mobile/hooks/useDashboard.ts`
- `vtl-mobile/hooks/useOperations.ts`
- `vtl-mobile/hooks/useQuality.ts`
- `vtl-mobile/components/VTLAppHeader.tsx`
- `vtl-mobile/constants/theme.ts`

### Backend

- `backend/server.js`
- `backend/src/routes/mobile-routes.js`
- `backend/src/services/mobile-service.js`
- production batch route/service files, likely one or more of:
  - `backend/src/routes/production-routes.js`
  - `backend/src/services/production-service.js`
  - any batch-specific controller/service file
- inventory/product route/service files, likely one or more of:
  - `backend/src/routes/inventory-routes.js`
  - `backend/src/services/inventory-service.js`
  - product service/model files
- auth middleware/role middleware files, likely one or more of:
  - `backend/src/middleware/auth-middleware.js`
  - `backend/src/middleware/authorize.js`
  - auth service file that defines user roles

---

## 7. Final Recommendation

Do **not** jump straight into dashboard redesign first. The correct order is:

1. Audit actual code and database assumptions.
2. Lock down mobile access.
3. Fix backend data filters and batch detail data flow.
4. Fix `quality.tsx` key warnings.
5. Upgrade the dashboard UI.
6. Run a regression and prepare for APK.

This order reduces the risk of creating a polished dashboard that still exposes the wrong users or displays incorrect business data.
