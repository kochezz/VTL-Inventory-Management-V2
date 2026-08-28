# VTL-ERP · Vilagio Trading Limited Operations Platform

> Enterprise inventory, production, QMS, HR/attendance, sales and CRM platform for the **freshDRIP** water bottling operation — Chingola, Copperbelt Province, Zambia.

[![Stack](https://img.shields.io/badge/stack-Next.js%20%7C%20Node.js%20%7C%20PostgreSQL%20%7C%20Expo-blue)](https://github.com/kochezz/VTL-Inventory-Management-V2)
[![Live](https://img.shields.io/badge/live-Vercel-black)](https://vilagio-erp-frontend.vercel.app)

---

## What This Is

VTL-ERP is Vilagio Trading Limited's in-house operations platform for its freshDRIP bottled water and ice production line. It has grown well beyond an inventory tool — the backend now carries **34 service modules** covering inventory, production batching, in-process quality control (IPQC), QMS/NCR management, HR and attendance (Kronos-style clocking), purchase orders and supplier/vendor management, sales and POS, and analytics/reporting.

The system is built across four active layers:

- **`frontend/`** — Next.js 16 / React 18 web dashboard (the primary UI: production, inventory, QMS, HR, sales, reports, admin)
- **`vtl-mobile/`** — Expo/React Native mobile app (operations, quality, commercial and people tabs; barcode/NFC-adjacent workflows)
- **`backend/`** — Node.js/Express REST API (34 services, JWT auth, MCP tool integration)
- **`database/`** — PostgreSQL 14+ on Neon Tech (serverless cloud Postgres), with SQL migrations layered on top of the base schema

Plus two adjacent, non-ERP pieces in the same repo:
- **`WEBSITE/`** — the public freshDRIP marketing site (Vite/React) — not part of the ERP application, deploys separately
- **`docs/`** — a large collection of build-session notes, specs and guides (see [Documentation](#documentation) — most of this is historical, not a maintained reference)

---

## Business Purpose

1. **Eliminate manual stock sheets** — real-time, multi-user inventory replacing paper/spreadsheets on the plant floor and in the office.
2. **Regulatory & food-safety compliance** — batch/lot tracking, expiry management, IPQC checkpoints, and an NCR (non-conformance) workflow to support ZABS/ISO-style audit trails.
3. **Production planning** — Bill of Materials and production-order tracking to compare planned vs. actual material consumption.
4. **HR & attendance** — clock-in/out, onboarding, and role-gated HR record access alongside the operational modules.
5. **Sales & commercial visibility** — customer/vendor directories, purchase orders, GRNs, and sales analytics feeding into management dashboards.

---

## User Roles & Access

Roles are enforced via a Postgres `CHECK` constraint on `users.role`, layered across two migrations:

| Role | Source | Intended access |
|---|---|---|
| `admin` | base schema | Full system access |
| `warehouse_manager` | base schema | Inventory, GRN, transfers, adjustments — approval level |
| `warehouse_staff` | base schema | Inventory transactions — operational level |
| `production_manager` | base schema | Production batches, IPQC, production reporting |
| `viewer` | base schema | Read-only dashboards/reports |
| `hr_admin` | HR extension migration | Full HR read/write, including salary data |
| `hr_manager` | HR extension migration | HR record updates for direct reports only |

**Known gap:** `backend/src/middleware/auth-middleware.js` documents and checks for a `qa` role (`authorize(['admin', 'qa'])`, and a direct `req.user.role !== 'admin' && userRole !== 'qa'` check), but **`qa` does not exist in either role `CHECK` constraint** in `database/schema.sql` or the HR migration. Anyone actually assigned `qa` today would fail the database constraint. This needs to be resolved — either add `qa` to the constraint or remove the dead code path — before it's used as the basis for role-specific documentation or navigation.

---

## Technology Stack

| Layer | Technology |
|---|---|
| Web dashboard | Next.js 16, React 18, TypeScript, Tailwind CSS |
| Mobile app | Expo ~54 (Expo Router), React Native 0.81, React 19 |
| Backend | Node.js (≥18), Express 4 |
| Database | PostgreSQL 14+ (Neon Tech serverless cloud) |
| Auth | JWT (`jsonwebtoken`) + bcrypt |
| PDF / document generation | `pdfkit`, `docx`, `jszip` |
| Notifications | Resend (SMTP), Nodemailer, optional Twilio SMS |
| Deployment (web) | Vercel |
| Marketing site | Vite + React (`WEBSITE/`, deployed independently) |

---

## Repository Structure

```
VTL-Inventory-Management-V2/
├── frontend/                 # Next.js dashboard — the primary ERP UI
│   ├── app/                  # dashboard, inventory, production, qms, hr, sales,
│   │                         # lab, attendance, vendor-management, analytics, reports,
│   │                         # pricing, products, users, settings
│   ├── components/           # feature-organized: inventory/, production/, qms/, hr/,
│   │                         # crm/, po/, grn/, vendor/, lab/, barcode/, layout/
│   ├── hooks/, utils/
│   ├── dashboard/            # empty stub — no source, empty package.json/README
│   └── scanner-app/          # empty stub — superseded by vtl-mobile/
│
├── vtl-mobile/                # Expo React Native app — the real mobile client
│   ├── app/                   # (tabs): operations, quality, commercial, people
│   │   └── (auth)/, batch/, ncr/
│   ├── components/, hooks/, services/, stores/
│
├── frontend/terminal-app/     # Separate Vite app ("vtl-terminal") — point-of-sale/terminal UI
│
├── backend/
│   ├── src/
│   │   ├── routes/            # 30+ route files: auth, inventory, production, qms, hr,
│   │   │                      # attendance, po, grn, sales, lab, mobile, barcode, etc.
│   │   ├── services/          # 34 service modules — business logic layer
│   │   ├── middleware/        # auth-middleware, authenticate, hr-middleware, attendance-middleware
│   │   ├── mcp/                # MCP tool servers (inventory, batch, reporting tools)
│   │   ├── api/                # legacy/partial — server.js + one route file, largely
│   │   │                      #    superseded by src/routes/; confirm before extending
│   │   └── config/, utils/
│   └── scripts/                # DB inspection & maintenance utilities
│
├── database/
│   ├── schema.sql              # Base schema
│   ├── migrations/             # Incremental migrations (QMS views, attendance, etc.)
│   ├── seed-data*.sql          # Multiple seed variants (users, locations, quantities)
│   └── README.md               # Database-specific documentation — see below
│
├── docs/                       # See "Documentation" section — mostly dated session logs
├── docs/HR Extension/          # HR schema + role migration source of truth
├── config/                     # auth, database, scanner configs; deployment/ (Docker — currently empty)
├── scripts/                    # database + deployment scripts
├── tests/                      # jest config scaffolded — no test files present yet
├── WEBSITE/                    # freshDRIP marketing site — separate deploy, not the ERP
└── recon.md, folder_structure.txt, FrontEnd_Details.txt, BackEnd_Details.txt
                                 # root-level scratch/planning files, not maintained docs
```

---

## Getting Started

### Backend

```bash
cd backend
npm install
cp .env.example .env      # fill in DATABASE_URL, JWT_SECRET, SMTP credentials, etc.
npm run dev                # nodemon, http://localhost:3000
```

**Set a real `JWT_SECRET`.** `auth-middleware.js` falls back to a hardcoded default (`'your-super-secret-jwt-key-change-in-production'`) if the environment variable is missing — if that default is ever live in a deployed environment, anyone can forge valid tokens. Always confirm `JWT_SECRET` is set before deploying.

### Database

```bash
psql "YOUR_NEON_CONNECTION_STRING" -f database/schema.sql
# apply migrations in database/migrations/, in date order
psql "YOUR_NEON_CONNECTION_STRING" -f database/seed-data.sql   # optional sample data
```
See [`database/README.md`](./database/README.md) for schema details, table relationships, and seed-data variants.

### Frontend (dashboard)

```bash
cd frontend
npm install
npm run dev                 # http://localhost:3000 (Next.js dev server)
```

### Mobile app

```bash
cd vtl-mobile
npm install
npx expo start
```

> Change all default/seed credentials immediately in any real deployment. Never commit populated `.env` files or real API keys — `.gitignore` already excludes `.env*`, but historical commits should still be checked if a secret has ever been added directly to a tracked file.

---

## Documentation

The canonical, current references worth keeping up to date:

| Doc | Purpose |
|---|---|
| [`database/README.md`](./database/README.md) | Schema, table relationships, seed data |
| [`docs/API.md`](./docs/API.md) | API reference |
| [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) | System architecture |
| [`docs/DATABASE.md`](./docs/DATABASE.md) | Database design notes |
| [`docs/DEPLOYMENT.md`](./docs/DEPLOYMENT.md) | Deployment guide |
| [`docs/HR_MODULE_SPEC.md`](./docs/HR_MODULE_SPEC.md) | HR module spec |
| [`docs/TROUBLESHOOTING.md`](./docs/TROUBLESHOOTING.md) | Known issues & fixes |

Everything else in `docs/` (the `07_Feb_...`, `WEEK6_DAY2_...`, `*_SESSION_HANDOFF*`, `*_SESSION_SUMMARY*` files, and the several competing "complete user guide" documents) is a dated build log from a specific development session, not a maintained reference — treat them as history, not as current truth, and expect them to disagree with each other and with the code.

**Role-based navigation guides** (a separate doc per role — admin, warehouse_manager, warehouse_staff, production_manager, viewer, hr_admin, hr_manager) are planned as a follow-on to this README, once the `qa`-role gap above is resolved.

---

## Known Housekeeping (found during this review, not yet actioned)

These don't block the app from running, but they're worth cleaning up — leaving them makes the repo actively misleading to a new contributor or an AI assistant asked to reason about it:

- **Duplicate README:** `README.md` and `VTL_README.md` were byte-for-byte identical before this update. Pick one; delete the other.
- **Dead route/service versions:** `backend/src/routes/Archive/` holds 8 versions of `production-routes` (`BKP` through `BKP7`); `services/auth-service_bkp.js` and `services/qms-service - Copy.js` sit alongside their live counterparts. None of this is imported by the live app as far as this review found, but it's easy to accidentally edit or reference the wrong file.
- **Empty stubs:** `frontend/dashboard/` and `frontend/scanner-app/` have package.json/README files but no source — likely leftover scaffolding from before `vtl-mobile/` became the real mobile app.
- **Empty `LICENSE` file** — the previous README badge claimed "Internal Use" but the file itself is 0 bytes.
- **Empty Docker config** — `config/deployment/docker/Dockerfile` and `docker-compose.yml` both exist but are empty.
- **No test suite** — `tests/` has a Jest config and setup file but zero actual test files.
- **Large root-level scratch files** — `folder_structure.txt` alone is ~48,000 lines; `recon.md`, `FrontEnd_Details.txt`, `BackEnd_Details.txt` look like working notes rather than intended repo contents.
- **Hardcoded JWT fallback secret** — see the Getting Started note above.

---

## Live Deployment

| Component | Location | Status |
|---|---|---|
| Frontend (Vercel) | [vilagio-erp-frontend.vercel.app](https://vilagio-erp-frontend.vercel.app) | Live |
| Database | Neon Tech Cloud | Live |
| Mobile app | Expo (not yet published to app stores as of this review) | In development |
