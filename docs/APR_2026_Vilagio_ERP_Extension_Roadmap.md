# Vilagio ERP — Extension Roadmap
## QC Lab Module · Point of Sale Module · Database Expansion

**Document Version:** 1.0  
**Date:** April 2026  
**Company:** Vilagio Technologies Ltd. (VTL)  
**Domain:** www.vilag.io  
**Industry:** Water & Ice Manufacturing and Distribution (Zambia)  
**Prepared for:** Development Team

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Scope of Work](#2-scope-of-work)
3. [Phase A — Database & SKU Expansion](#3-phase-a--database--sku-expansion-week-1)
4. [Phase B — QC Lab Module](#4-phase-b--qc-lab-module-weeks-23)
5. [Phase C — Point of Sale Module](#5-phase-c--point-of-sale-module-weeks-46)
6. [Phase D — Customer & Sales Analytics](#6-phase-d--customer--sales-analytics-weeks-78)
7. [QA Compliance Stages](#7-qa-compliance-stages)
8. [Navigation Bar Changes](#8-navigation-bar-changes)
9. [Key Integration Touchpoints](#9-key-integration-touchpoints)
10. [Database Changes Summary](#10-database-changes-summary)
11. [New API Endpoints](#11-new-api-endpoints)
12. [New Frontend Files](#12-new-frontend-files)
13. [Effort Estimates](#13-effort-estimates)
14. [Execution Timeline](#14-execution-timeline)
15. [Risk Register](#15-risk-register)

---

## 1. Executive Summary

The Vilagio ERP has been successfully built through three major workstreams to date:

- **Phase 1** — Inventory Management System (85% complete)
- **Phase 2A/2B** — Production Module with IPQC QA Workflow, QMS Document Governance, and Closed-Loop Inventory Sync (complete)
- **HR Module** — Leave & Holiday Management, Employee Self-Service (complete)

This roadmap defines the next extension of the ERP across two major functional modules and a database expansion:

1. **QC Lab Module** — A water quality testing management system that captures 7 key parameters, routes results through a 3-stage QA review, generates a PDF water quality certificate, and gates production batches on that certificate.
2. **Point of Sale (POS) Module** — A full transaction processing system for sales assistants, covering all VTL SKUs, receipt generation, real-time inventory deduction, and customer tracking.
3. **Database Expansion** — Three new product SKUs (3.6kg Ice Spheres, 1.2kg Ice Spheres, 500ml Water Sachet) and the supporting database tables for both new modules.

**Total estimated effort:** 50–68 development hours across 8 weeks.

---

## 2. Scope of Work

### In Scope

- New product SKUs seeded into the `products` table with BOM entries
- New database tables for lab testing and sales transactions
- Lab test capture modal with 7 water quality parameters
- 3-stage QA review workflow for lab results
- PDF water quality certificate generation
- Integration of lab certificate into production batch Gate 1 checklist
- Full POS terminal interface for sales assistants
- Receipt/invoice PDF generation with VTL branding
- Real-time inventory deduction on completed sales
- Void and refund support
- End-of-day POS session reconciliation
- Customer CRM linkage for named transactions
- Sales analytics dashboard
- Navigation bar additions for all new modules
- Role-based access control for all new routes

### Out of Scope (Future Phases)

- E-commerce / online ordering
- Mobile POS application (tablet-native)
- Loyalty points / rewards programme
- Automated email marketing campaigns
- Supplier portal integration
- Route delivery management

---

## 3. Phase A — Database & SKU Expansion (Week 1)

This phase is the prerequisite for all subsequent phases. No frontend work should begin until Phase A is complete and verified in the database.

### A1 — New Product SKUs

Three new finished goods products must be added to the `products` table.

| SKU | Product Name | Category | Base UOM | Reorder Point |
|-----|-------------|----------|----------|---------------|
| `ICE-SPHERE-3600G` | FreshDrip Ice Spheres 3.6kg | `FINISHED_ICE` | kg | 50 |
| `ICE-SPHERE-1200G` | FreshDrip Ice Spheres 1.2kg | `FINISHED_ICE` | kg | 100 |
| `SACHET-WATER-500ML` | FreshDrip Water Sachet 500ml | `FINISHED_PRODUCT` | piece | 500 |

**Actions required:**

- Create a new `FINISHED_ICE` product category (or confirm mapping to `FINISHED_PRODUCT` with stakeholder sign-off)
- Insert the 3 product records with standard costs and selling prices aligned to the VTL Manufacturing Cost & Pricing Analysis
- Create BOM entries for each new SKU in the `product_bom` table
- Add initial inventory records in the relevant warehouse locations
- Verify that the production module's "finished products" dropdown correctly includes the new SKUs

### A2 — New Database Tables

Six new tables are required to support the Lab and POS modules.

#### Lab Tables

**`lab_water_tests`** — Master record for each test session

| Column | Type | Description |
|--------|------|-------------|
| `test_id` | UUID | Primary key |
| `test_number` | VARCHAR(50) | Auto-generated reference (e.g. LWT-2026-0001) |
| `test_date` | DATE | Date of testing |
| `shift` | VARCHAR(20) | Morning / Afternoon / Night |
| `analyst_id` | UUID | FK → users |
| `batch_id` | UUID | FK → production_batches (optional link) |
| `overall_status` | VARCHAR(20) | pending / pass / fail / conditional |
| `qa_supervisor_id` | UUID | FK → users |
| `qa_manager_id` | UUID | FK → users |
| `certificate_number` | VARCHAR(50) | Issued on Stage 3 approval |
| `pdf_url` | TEXT | Path to generated certificate PDF |
| `notes` | TEXT | Free-text notes |
| `created_at` | TIMESTAMP | Record creation |
| `approved_at` | TIMESTAMP | Stage 3 approval timestamp |

**`lab_test_parameters`** — Individual parameter readings per test

| Column | Type | Description |
|--------|------|-------------|
| `param_id` | UUID | Primary key |
| `test_id` | UUID | FK → lab_water_tests |
| `parameter_code` | VARCHAR(50) | pH, RO_CONDUCTIVITY, OZONE_RESIDUE, TDS, DO, TURBIDITY, MICROBIAL |
| `parameter_name` | VARCHAR(100) | Display name |
| `reading_value` | DECIMAL(10,4) | Numeric result |
| `reading_text` | VARCHAR(100) | For pass/fail fields (microbial) |
| `unit` | VARCHAR(20) | pH units, µS/cm, mg/L, NTU, etc. |
| `spec_min` | DECIMAL(10,4) | Lower acceptable limit |
| `spec_max` | DECIMAL(10,4) | Upper acceptable limit |
| `status` | VARCHAR(10) | pass / fail / warning |
| `notes` | TEXT | Analyst notes per parameter |

**`lab_qa_approvals`** — Tracks each stage of the 3-stage review

| Column | Type | Description |
|--------|------|-------------|
| `approval_id` | UUID | Primary key |
| `test_id` | UUID | FK → lab_water_tests |
| `stage` | INTEGER | 1 = Analyst, 2 = Supervisor, 3 = Manager |
| `action` | VARCHAR(20) | submit / approve / reject / conditional |
| `approved_by` | UUID | FK → users |
| `signature_verified` | BOOLEAN | Password-based digital signature |
| `comments` | TEXT | Review comments |
| `actioned_at` | TIMESTAMP | Timestamp of action |

#### Sales/POS Tables

**`pos_sessions`** — Cashier shift sessions

| Column | Type | Description |
|--------|------|-------------|
| `session_id` | UUID | Primary key |
| `session_number` | VARCHAR(50) | Auto-generated (e.g. POS-2026-0001) |
| `cashier_id` | UUID | FK → users |
| `opened_at` | TIMESTAMP | Session start |
| `closed_at` | TIMESTAMP | Session end |
| `opening_float` | DECIMAL(10,2) | Cash in drawer at open |
| `closing_cash` | DECIMAL(10,2) | Physical cash counted at close |
| `expected_cash` | DECIMAL(10,2) | System calculated cash |
| `variance` | DECIMAL(10,2) | Difference (closing - expected) |
| `status` | VARCHAR(20) | open / closed |
| `notes` | TEXT | Reconciliation notes |

**`sales_transactions`** — Transaction header record

| Column | Type | Description |
|--------|------|-------------|
| `transaction_id` | UUID | Primary key |
| `transaction_number` | VARCHAR(50) | Auto-generated receipt number (e.g. VTL-RCP-0001) |
| `session_id` | UUID | FK → pos_sessions |
| `cashier_id` | UUID | FK → users |
| `customer_id` | UUID | FK → customers (nullable for guest) |
| `transaction_date` | TIMESTAMP | Date and time of sale |
| `subtotal` | DECIMAL(10,2) | Before discount |
| `discount_amount` | DECIMAL(10,2) | Total discount applied |
| `tax_amount` | DECIMAL(10,2) | Tax if applicable |
| `total_amount` | DECIMAL(10,2) | Final amount charged |
| `payment_method` | VARCHAR(30) | cash / mobile_money / card / mixed |
| `amount_tendered` | DECIMAL(10,2) | Amount given by customer |
| `change_given` | DECIMAL(10,2) | Change returned |
| `status` | VARCHAR(20) | completed / voided / refunded |
| `void_reason` | TEXT | Required if voided |
| `notes` | TEXT | Free-text notes |
| `created_at` | TIMESTAMP | Record creation |

**`sales_transaction_lines`** — Line items per transaction

| Column | Type | Description |
|--------|------|-------------|
| `line_id` | UUID | Primary key |
| `transaction_id` | UUID | FK → sales_transactions |
| `product_id` | UUID | FK → products |
| `quantity` | DECIMAL(10,2) | Units sold |
| `unit_price` | DECIMAL(10,2) | Selling price at time of sale |
| `line_discount` | DECIMAL(10,2) | Per-line discount |
| `line_total` | DECIMAL(10,2) | (qty × unit_price) - discount |
| `inventory_location_id` | UUID | FK → warehouse_locations (source) |

**`customers`** — (Extend existing or create new)

> Note: A `customers` table may already exist under `/vendor-management/customers`. If so, reuse that table and add a `customer_type` column (retail / wholesale / institutional) if not present. If it does not exist, create:

| Column | Type | Description |
|--------|------|-------------|
| `customer_id` | UUID | Primary key |
| `customer_name` | VARCHAR(255) | Full name or business name |
| `phone_number` | VARCHAR(20) | Contact number |
| `email` | VARCHAR(255) | Email address |
| `customer_type` | VARCHAR(30) | retail / wholesale / institutional |
| `is_active` | BOOLEAN | Active status |
| `created_at` | TIMESTAMP | Record creation |

---

## 4. Phase B — QC Lab Module (Weeks 2–3)

### Overview

The QC Lab module enables Lab Analysts to record water quality test results before each production run. Results are routed through a 3-stage QA review. Upon final approval a PDF water quality certificate is generated and automatically linked to the production batch Gate 1 checklist. Production cannot proceed past Gate 1 without a valid, PASS-status certificate from the same day.

### B1 — Lab Test Capture Modal

**Route:** `/lab` or `/qc-lab`  
**Component:** `frontend/app/lab/page.tsx` (NEW)  
**Modal:** `frontend/components/lab/LabTestModal.tsx` (NEW)

The modal captures the following 7 parameters. Each parameter field records the raw numeric reading, the applicable specification range (pre-filled from system config), a computed pass/fail status, and an optional analyst note.

| Parameter | Unit | WHO / Spec Limit | Input Type |
|-----------|------|-----------------|------------|
| pH | pH units | 6.5 – 8.5 | Decimal (1 d.p.) |
| RO Conductivity | µS/cm | ≤ 500 µS/cm | Decimal |
| Ozone Residue | mg/L | ≤ 0.05 mg/L | Decimal (3 d.p.) |
| TDS (Total Dissolved Solids) | mg/L | ≤ 300 mg/L | Decimal |
| Dissolved Oxygen | mg/L | ≥ 6.0 mg/L | Decimal |
| Turbidity | NTU | < 1 NTU (drinking) | Decimal |
| Microbial Contamination | CFU/mL | 0 CFU/mL (absence) | Pass / Fail + count |

**Additional fields captured:**

- Test date and shift (Morning / Afternoon / Night)
- Analyst name (auto-populated from logged-in user)
- Equipment calibration reference number
- Water source / RO system identifier
- Optional link to a production batch
- Overall analyst comments

**Spec ranges** should be stored in a `lab_parameter_specs` config table (or application constants) so they can be updated by QA Managers without code changes.

**Auto-flagging logic:** If any parameter reading falls outside the specification range, the system automatically flags that parameter as FAIL and the overall test status defaults to `fail`. The analyst may add a note but cannot override the fail status — only a QA Supervisor (Stage 2) can mark a failing result as "conditional" with a documented justification.

### B2 — QA Review Stages

See [Section 7](#7-qa-compliance-stages) for the full compliance workflow detail.

### B3 — PDF Certificate Generation

**Service:** `backend/src/services/lab-pdf-service.js` (NEW)  
**Endpoint:** `GET /api/lab/tests/:id/certificate`

The PDF water quality certificate must include:

- VTL letterhead with logo and company details
- Certificate number and issue date
- Test date, shift, and RO system reference
- A table of all 7 parameters with readings, spec limits, and PASS/FAIL status
- Overall result (PASS / FAIL / CONDITIONAL PASS)
- Analyst name and digital signature block
- QA Supervisor name and signature block
- QA Manager name and signature block with date
- Unique QR code linking back to the digital record in the ERP
- Footer: "This certificate is valid for one production shift on the date of issue."

### B4 — Integration with Production Gate 1

The `batch_qa_gates` Gate 1 checklist must be updated to include:

- A "Water Quality Certificate" checklist item
- A lookup field that fetches today's valid lab certificates
- A link/reference storing the `test_id` of the attached certificate
- Gate 1 approval blocked programmatically if no PASS-status certificate exists for the current date

This update touches `backend/src/services/production-service.js` and the Gate 1 approval endpoint.

### B5 — Navigation Entry

Add to `DashboardLayout.tsx`:

```typescript
{ 
  name: 'QC Lab', 
  href: '/lab', 
  icon: FlaskConical,  // from lucide-react
  roles: ['admin', 'manager', 'qa'] 
}
```

Position: between "Quality (QMS)" and "Analytics" in the navigation array.

---

## 5. Phase C — Point of Sale Module (Weeks 4–6)

### Overview

The POS module enables sales assistants to process customer transactions across all VTL SKUs, issue receipts, and automatically deduct stock from inventory. It follows the Square / SaleSystem.ai paradigm adapted for the Vilagio ERP environment.

### C1 — POS Terminal Interface

**Route:** `/sales/pos`  
**Component:** `frontend/app/sales/pos/page.tsx` (NEW)

**Interface layout:**

- Left panel: Product grid showing all active finished goods SKUs with product image placeholder, name, SKU, and price. Supports search and category filter.
- Right panel: Active cart showing line items, quantities (adjustable), line totals, subtotal, discount field, and grand total.
- Bottom bar: Payment method selector, amount tendered field, change calculator, and "Complete Sale" button.

**Product grid SKUs at launch (7 total):**

1. FreshDrip 500ml Regular
2. FreshDrip 500ml Premium
3. FreshDrip 750ml Regular
4. FreshDrip 1L (if in BOM)
5. FreshDrip Water Sachet 500ml *(NEW)*
6. FreshDrip Ice Spheres 1.2kg *(NEW)*
7. FreshDrip Ice Spheres 3.6kg *(NEW)*

**Payment methods supported:**

- Cash (with change calculator)
- Mobile Money (MTN/Airtel — reference number capture)
- Card (terminal reference number capture)
- Mixed payment (partial cash + partial mobile)

**Session management:**

- Cashier must open a session with an opening float before processing sales
- Session displays running totals for the shift
- End-of-day close prompts physical cash count and generates variance report

**Stock guard:** Before completing a sale, the system checks `inventory` for sufficient `available_quantity`. If stock is insufficient, the system displays a warning and prevents completion. If stock is low (below `reorder_point`), a yellow advisory is shown but the sale can still proceed.

### C2 — Receipt & Invoice Generation

**Service:** `backend/src/services/pos-pdf-service.js` (NEW)  
**Endpoint:** `GET /api/sales/transactions/:id/receipt`

Each receipt PDF must include:

- VTL logo and company name, address, and contact details
- Receipt number (e.g. VTL-RCP-2026-00001)
- Date, time, and cashier name
- Customer name (if linked) or "Guest"
- Itemised list: product name, SKU, quantity, unit price, line total
- Subtotal, discount, tax (if applicable), and grand total
- Payment method and amount tendered
- Change given (for cash transactions)
- QR code linking to digital record
- Footer: "Thank you for your business — Vilagio Technologies Ltd."

**Receipt delivery options:**

- Print (browser print dialog)
- Download PDF
- Email (if customer email on record)
- Reprint from transaction history

### C3 — Inventory Sync

Every completed sale triggers the following automatically:

1. An `inventory_transactions` record is created with `transaction_type = 'SALE'` (new transaction type to be added, or mapped to `issue` with `reason = 'CUSTOMER_SALE'`)
2. The `inventory.quantity_on_hand` is decremented for the relevant product and location
3. The `inventory.available_quantity` is updated in real time
4. If the sale causes stock to drop below `reorder_point`, a `system_alerts` record is created
5. The `batch_finished_goods` link is maintained for full traceability (sale → finished goods → production batch → raw materials)

**Void and refund:**

- Voids cancel the transaction and reverse the inventory deduction
- Refunds create a reverse `inventory_transactions` record of type `RETURN`
- Both require a reason code and manager-level authorisation (role check)

### C4 — Navigation Entry

Add to `DashboardLayout.tsx`:

```typescript
{ 
  name: 'Sales / POS', 
  href: '/sales/pos', 
  icon: ShoppingBag,  // from lucide-react
  roles: ['admin', 'manager', 'sales'] 
}
```

Position: after "Customers (CRM)" in the navigation array.

---

## 6. Phase D — Customer & Sales Analytics (Weeks 7–8)

### D1 — CRM Linkage

Sales transactions can be processed as guest (no customer required) or linked to a named customer record. The customer lookup at POS should be a quick-search by name or phone number. New customers can be created inline from the POS screen without navigating away.

Customer records store:

- Name and contact details
- Customer type (retail / wholesale / institutional)
- Full purchase history with date, items, and totals
- Lifetime value (auto-calculated)
- Average order value
- Last purchase date
- Segment tags for marketing use

### D2 — Sales Dashboard

**Route:** `/sales/analytics`  
**Component:** `frontend/app/sales/analytics/page.tsx` (NEW)

Dashboard charts and KPIs:

| Metric | Chart Type | Period |
|--------|-----------|--------|
| Total revenue | Stat card | Today / This week / This month |
| Units sold | Stat card | Per SKU breakdown |
| Revenue by SKU | Bar chart | Configurable date range |
| Revenue trend | Line chart | Daily, weekly, monthly |
| Peak sales hours | Heatmap | Hour of day × Day of week |
| Top customers by spend | Ranked list | Rolling 30 days |
| Payment method split | Pie chart | By transaction count and value |
| Void / refund rate | Stat card | Alert if > 2% |
| Average transaction value | Stat card | Trend vs prior period |

### D3 — Marketing Intelligence Signals

The analytics layer surfaces the following signals automatically:

- **SKU demand trends** — which products are growing or declining week-over-week
- **Slow-moving product flags** — SKUs with zero sales in the past 14 days
- **Bundle opportunity detection** — products frequently purchased together (simple co-occurrence analysis)
- **Seasonal pattern identification** — week-on-week and month-on-month comparisons
- **Reorder trigger from sales velocity** — if sales rate means current stock will be exhausted within X days, raise a procurement alert

All analytics tables support CSV export for use in external marketing tools.

### D4 — Navigation Entry

Add to `DashboardLayout.tsx`:

```typescript
{ 
  name: 'Sales Analytics', 
  href: '/sales/analytics', 
  icon: BarChart3,  // from lucide-react
  roles: ['admin', 'manager', 'ceo', 'cfo'] 
}
```

Position: after "Analytics" in the navigation array.

---

## 7. QA Compliance Stages

The following 3-stage review process is recommended for the Lab QC module to align with GMP (Good Manufacturing Practice) and WHO drinking water quality standards.

### Stage 1 — Lab Analyst Submission

**Actor:** Lab Analyst (role: `qa`, `staff`)  
**Action:** Records all 7 parameter readings and submits the test record with a digital signature (password verification, consistent with the existing IPQC review pattern).  
**Outcome:** Record status changes from `draft` → `pending_supervisor_review`  
**System action:** QA Supervisor receives a dashboard notification

### Stage 2 — QA Supervisor Peer Review

**Actor:** QA Supervisor (role: `qa`, `manager`)  
**Checklist:**
- All 7 parameters have been recorded
- Equipment calibration reference is valid and current
- No readings fall outside spec without a documented justification
- Analyst identity confirmed

**Possible outcomes:**

| Decision | Status change | System action |
|----------|--------------|---------------|
| Approve | `pending_manager_signoff` | Notify QA Manager |
| Reject | `rejected` | Notify Analyst — re-test required |
| Conditional | `conditional_pending_manager` | Deviation note mandatory before proceeding |

**Digital signature required.** Consistent with existing `verifySignature()` implementation.

### Stage 3 — QA Manager Sign-Off & Certificate Issuance

**Actor:** QA Manager (role: `admin`, `manager`)  
**Checklist:**
- Stage 2 approved (or conditional with signed deviation note)
- No outstanding NCRs on this test
- Test date matches current production shift date

**Possible outcomes:**

| Decision | Status change | System action |
|----------|--------------|---------------|
| Approve | `pass` | Generate PDF certificate · link to batch |
| Approve Conditional | `conditional_pass` | Generate PDF with conditional note |
| Reject | `fail` | Raise NCR in `batch_deviations` · block Gate 1 |

**Digital signature required.**

### Failure Handling

If a test record reaches `fail` status:

1. An NCR record is created in the existing `batch_deviations` table with `deviation_type = 'WATER_QUALITY_FAILURE'`
2. Any linked production batch has its Gate 1 checklist item flagged as blocked
3. The Lab Analyst is notified to schedule a re-test
4. The re-test creates a new `lab_water_tests` record — it does not overwrite the failed record (full audit trail preserved)

### Relevant QMS SOP References

| Stage | SOP Code | Description |
|-------|---------|-------------|
| Water testing procedure | QA-WT-MON-SOP-009 | Water Treatment Monitoring |
| Pre-production water check | QA-PRO-CLR-SOP-007 | Pre-Production Clearance |
| NCR process | QA-CORE-NCR-SOP-XXX | Non-Conformance Reporting |

---

## 8. Navigation Bar Changes

The following additions are required in `frontend/components/layout/DashboardLayout.tsx`.

### New Nav Items

```typescript
// Add these to the navigation array in DashboardLayout.tsx

{ 
  name: 'QC Lab', 
  href: '/lab', 
  icon: FlaskConical,
  roles: ['admin', 'manager', 'qa'] 
},
{ 
  name: 'Sales / POS', 
  href: '/sales/pos', 
  icon: ShoppingBag,
  roles: ['admin', 'manager', 'sales'] 
},
{ 
  name: 'Sales Analytics', 
  href: '/sales/analytics', 
  icon: BarChart3,
  roles: ['admin', 'manager', 'ceo', 'cfo'] 
},
```

### Updated Icon Imports

Add to the existing lucide-react import in `DashboardLayout.tsx`:

```typescript
import { 
  // ... existing icons ...
  FlaskConical,
  ShoppingBag,
  BarChart3
} from 'lucide-react';
```

### Recommended Navigation Order (Full Updated List)

1. Dashboard
2. Products
3. Inventory
4. Production
5. QC Lab *(NEW)*
6. Quality (QMS)
7. Vendor Management
8. Customers (CRM)
9. Purchase Orders
10. Goods Receipts
11. Sales / POS *(NEW)*
12. Sales Analytics *(NEW)*
13. Analytics
14. Reports
15. Production Reports
16. Settings
17. Users (Admin only)

### New User Role

Add `sales` to the user roles to support POS-restricted access. Sales assistants should be able to access: Sales / POS only. They should not have access to: Inventory transactions, Production, QMS documents, or financial reports.

---

## 9. Key Integration Touchpoints

### Lab → Production (Critical Path)

```
Lab Analyst submits test
    ↓
QA Supervisor reviews (Stage 2)
    ↓
QA Manager approves & issues certificate (Stage 3)
    ↓
PDF certificate linked to lab_water_tests record
    ↓
Production batch Gate 1 checklist auto-populates with today's certificate
    ↓
Gate 1 approval checks: certificate_status = 'pass' AND test_date = today
    ↓
If no valid certificate → Gate 1 BLOCKED → production cannot start
```

### POS → Inventory (Closed Loop)

```
Sales assistant completes transaction
    ↓
sales_transactions record created (status: completed)
    ↓
sales_transaction_lines records created (per SKU)
    ↓
inventory_transactions record created (type: SALE / ISSUE)
    ↓
inventory.quantity_on_hand decremented per product per location
    ↓
system_alerts raised if stock drops below reorder_point
    ↓
PDF receipt generated and served to cashier
```

### QMS SOP Links

The Lab module should follow the same SOP linking pattern established in `IPQCReviewModal.tsx`. Water testing stages should link to `QA-WT-MON-SOP-009` using the existing `getRelevantSOP()` pattern.

### Sales → CRM

```
Transaction completed (named customer)
    ↓
customers.last_purchase_date updated
    ↓
customers.lifetime_value recalculated
    ↓
Purchase record visible in customer profile
    ↓
Available in Sales Analytics → Top Customers
```

---

## 10. Database Changes Summary

### New Tables (6)

| Table | Module | Purpose |
|-------|--------|---------|
| `lab_water_tests` | QC Lab | Master test session record |
| `lab_test_parameters` | QC Lab | Individual parameter readings |
| `lab_qa_approvals` | QC Lab | 3-stage review audit trail |
| `pos_sessions` | POS | Cashier shift sessions |
| `sales_transactions` | POS | Transaction header |
| `sales_transaction_lines` | POS | Line items per transaction |

### Modified Tables

| Table | Change |
|-------|--------|
| `batch_qa_gates` | Add `water_cert_id` FK → lab_water_tests |
| `inventory_transactions` | Add `SALE` and `RETURN` to transaction_type enum |
| `users` | Add `sales` to role enum |
| `customers` | Add `customer_type` column if table exists |

### New Products (3)

| SKU | Name | Category |
|-----|------|----------|
| `ICE-SPHERE-3600G` | FreshDrip Ice Spheres 3.6kg | FINISHED_ICE |
| `ICE-SPHERE-1200G` | FreshDrip Ice Spheres 1.2kg | FINISHED_ICE |
| `SACHET-WATER-500ML` | FreshDrip Water Sachet 500ml | FINISHED_PRODUCT |

---

## 11. New API Endpoints

### Lab Module Endpoints

```
GET    /api/lab/tests                        → List all lab tests (with filters)
POST   /api/lab/tests                        → Create new test record
GET    /api/lab/tests/:id                    → Get test detail with parameters
PUT    /api/lab/tests/:id                    → Update test (analyst only, pre-submission)
POST   /api/lab/tests/:id/submit             → Stage 1: Analyst submits
POST   /api/lab/tests/:id/supervisor-review  → Stage 2: Supervisor approve/reject
POST   /api/lab/tests/:id/manager-signoff    → Stage 3: Manager approve/reject
GET    /api/lab/tests/:id/certificate        → Generate / retrieve PDF certificate
GET    /api/lab/tests/today/valid            → Get today's valid certificates (for Gate 1)
GET    /api/lab/specs                        → Get parameter specification ranges
PUT    /api/lab/specs/:code                  → Update spec range (QA Manager only)
```

### POS / Sales Endpoints

```
POST   /api/sales/sessions/open              → Open cashier session
POST   /api/sales/sessions/:id/close         → Close and reconcile session
GET    /api/sales/sessions/:id               → Get session with running totals

POST   /api/sales/transactions               → Create and complete transaction
GET    /api/sales/transactions               → List transactions (filters: date, cashier, status)
GET    /api/sales/transactions/:id           → Get transaction detail
POST   /api/sales/transactions/:id/void      → Void transaction (manager auth)
POST   /api/sales/transactions/:id/refund    → Process refund
GET    /api/sales/transactions/:id/receipt   → Generate / retrieve PDF receipt

GET    /api/sales/analytics/summary          → KPI summary (revenue, units, avg value)
GET    /api/sales/analytics/by-sku           → Revenue and units per SKU
GET    /api/sales/analytics/by-period        → Time-series data
GET    /api/sales/analytics/customers        → Top customers ranking
GET    /api/sales/analytics/heatmap          → Peak hours data

GET    /api/customers                        → List customers
POST   /api/customers                        → Create customer
GET    /api/customers/:id                    → Customer detail + purchase history
PUT    /api/customers/:id                    → Update customer
```

---

## 12. New Frontend Files

### Lab Module

```
frontend/
├── app/
│   └── lab/
│       ├── page.tsx                          ← Lab dashboard / test list (NEW)
│       └── [id]/
│           └── page.tsx                      ← Test detail view (NEW)
└── components/
    └── lab/
        ├── LabTestModal.tsx                  ← Capture 7 parameters (NEW)
        ├── LabParameterRow.tsx               ← Reusable parameter input row (NEW)
        ├── LabQAReviewModal.tsx              ← Stage 2/3 review (NEW)
        └── LabCertificateBadge.tsx           ← Status badge for Gate 1 (NEW)
```

### Sales / POS Module

```
frontend/
├── app/
│   └── sales/
│       ├── pos/
│       │   └── page.tsx                      ← POS terminal (NEW)
│       ├── transactions/
│       │   └── page.tsx                      ← Transaction history (NEW)
│       └── analytics/
│           └── page.tsx                      ← Sales analytics dashboard (NEW)
└── components/
    └── sales/
        ├── ProductGrid.tsx                   ← SKU selection grid (NEW)
        ├── CartPanel.tsx                     ← Active cart (NEW)
        ├── PaymentModal.tsx                  ← Payment processing (NEW)
        ├── ReceiptModal.tsx                  ← Receipt preview + actions (NEW)
        ├── SessionManager.tsx                ← Open/close shift (NEW)
        ├── CustomerSearch.tsx                ← Inline customer lookup (NEW)
        └── SalesDashboard.tsx                ← Analytics charts (NEW)
```

### Backend Files

```
backend/src/
├── services/
│   ├── lab-service.js                        ← Lab CRUD and workflow (NEW)
│   ├── lab-pdf-service.js                    ← PDF certificate generation (NEW)
│   ├── pos-service.js                        ← POS transaction processing (NEW)
│   └── pos-pdf-service.js                    ← PDF receipt generation (NEW)
└── routes/
    ├── lab-routes.js                         ← Lab API routes (NEW)
    └── sales-routes.js                       ← POS/Sales API routes (NEW)
```

---

## 13. Effort Estimates

| Phase | Scope | Estimated Hours |
|-------|-------|----------------|
| Phase A — Database & SKU Expansion | SQL scripts, seed data, schema changes | 4–6 hrs |
| Phase B — QC Lab Module | Modal, QA workflow, PDF, Gate 1 integration | 16–20 hrs |
| Phase C — Point of Sale Module | POS UI, receipts, inventory sync, sessions | 20–28 hrs |
| Phase D — Customer & Sales Analytics | CRM, dashboard, marketing signals | 10–14 hrs |
| **Total** | | **50–68 hrs** |

### Phase B Breakdown

| Task | Hours |
|------|-------|
| Lab test capture modal (B1) | 4–5 |
| 3-stage QA review workflow (B2) | 4–5 |
| PDF certificate generation (B3) | 4–6 |
| Gate 1 integration (B4) | 2–3 |
| Navigation + backend routes | 2–3 |
| **Subtotal** | **16–22 hrs** |

### Phase C Breakdown

| Task | Hours |
|------|-------|
| POS terminal interface (C1) | 8–10 |
| Receipt / invoice PDF (C2) | 4–6 |
| Inventory sync + void/refund (C3) | 4–6 |
| Session open/close + reconciliation | 2–3 |
| Navigation + backend routes | 2–3 |
| **Subtotal** | **20–28 hrs** |

---

## 14. Execution Timeline

```
Week 1   ████████ Phase A — Database & SKU Expansion
Week 2   ████████ Phase B — Lab modal + QA workflow
Week 3   ████████ Phase B — PDF cert + Gate 1 integration
Week 4   ████████ Phase C — POS terminal interface
Week 5   ████████ Phase C — Receipts + inventory sync
Week 6   ████████ Phase C — Sessions + testing + QA sign-off
Week 7   ████████ Phase D — CRM linkage + sales dashboard
Week 8   ████████ Phase D — Analytics + marketing signals + UAT
```

### Milestone Gates

| Milestone | Target | Criteria |
|-----------|--------|----------|
| M1 — Data ready | End Week 1 | 3 new SKUs live, all tables created, migration verified |
| M2 — Lab MVP | End Week 3 | Analyst can submit test, QA Manager can approve, PDF certificate generated |
| M3 — Gate 1 blocked | End Week 3 | Production batch Gate 1 cannot be approved without valid lab cert |
| M4 — POS MVP | End Week 5 | Sales assistant can process a sale and print a receipt |
| M5 — Inventory sync live | End Week 6 | Every POS sale deducts from inventory automatically |
| M6 — Analytics live | End Week 8 | Sales dashboard showing revenue, units, and top customers |

---

## 15. Risk Register

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|-----------|
| Ice SKU BOM complexity (different production process) | Medium | High | Stakeholder sign-off before Phase A on whether ice uses existing batch flow or separate workflow |
| `customers` table conflict with existing CRM | Low | Medium | Audit existing `/vendor-management/customers` table before Phase A begins |
| PDF generation library choice | Low | Medium | Reuse existing PDF approach established in batch record work; do not introduce a new library |
| POS session state on browser refresh | Medium | Low | Store session ID in Zustand + localStorage; reconnect to open session on reload |
| Gate 1 blocking causing production delays | Low | High | Build a QA Manager override with mandatory reason capture for emergency use |
| `transaction_type` enum change in existing tables | Medium | Medium | Test inventory transaction queries against existing reports before deploying |
| Lab spec ranges vary by product / RO system | Medium | Low | Store specs in a config table (not hardcoded) from day one |

---

*End of Roadmap — Vilagio Technologies Ltd.*  
*Document prepared April 2026 | Version 1.0*
