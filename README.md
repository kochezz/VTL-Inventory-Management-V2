# VTL-ERP · Inventory Management System

> **Vilagio Trading Limited** — Enterprise inventory & production management platform for the freshDRIP water bottling operation, Chingola, Copperbelt Province, Zambia.

[![Status](https://img.shields.io/badge/status-Phase%201%20Complete-brightgreen)](https://github.com/kochezz/VTL-Inventory-Management-V2)
[![Stack](https://img.shields.io/badge/stack-Next.js%20%7C%20Node.js%20%7C%20PostgreSQL-blue)](https://github.com/kochezz/VTL-Inventory-Management-V2)
[![Live](https://img.shields.io/badge/live-Vercel-black)](https://vilagio-erp-frontend.vercel.app)
[![License](https://img.shields.io/badge/license-Internal%20Use-red)](./LICENSE)

---

## 📌 What This Is

The **VTL Inventory Management System (VTL-IMS)** is a purpose-built, enterprise-grade ERP module designed specifically for **Vilagio Trading Limited's** water bottling operation under the **freshDRIP** brand. It manages the full inventory lifecycle of a bottled water manufacturing facility — from raw material receipt through to finished goods production — with complete traceability, batch tracking, and multi-user role-based access.

This is not a generic inventory tool. It is engineered around the operational reality of a water bottling plant: pre-forms, caps, labels, packaging materials, water treatment spares, blow molder spares, and finished bottled water products all have distinct tracking requirements that this system addresses natively.

The system is built across three integrated layers:

- A **Next.js web dashboard** deployed to Vercel for management and reporting
- A **Node.js/Express REST API backend** with MCP server architecture
- A **PostgreSQL database** hosted on Neon Tech cloud with 15+ relational tables, automated triggers, and materialized views

---

## 🎯 Business Purpose & Intent

VTL Trading Limited is in its early operational phase, importing a water bottling plant from Shanghai and building the operational infrastructure to support ISO-compliant, audit-ready production. This ERP system exists to:

1. **Eliminate manual stock sheets** — replacing paper-based or spreadsheet inventory with a real-time, multi-user system accessible from the plant floor and management office simultaneously.

2. **Enable regulatory compliance** — ZRA and food safety compliance require full traceability of raw materials through to finished product batches. The system provides batch/lot tracking, expiry date management, and an immutable audit log for every inventory movement.

3. **Support production planning** — Bill of Materials (BOM) management and production order tracking allow the system to calculate material requirements for each production run and track actual vs. planned consumption.

4. **Facilitate barcode-driven operations** — The mobile scanner application allows warehouse staff to perform goods receipt, stock issues, transfers, and cycle counts using barcode scanners, reducing data entry errors and improving speed.

5. **Provide management visibility** — Real-time dashboards surface low stock alerts, expiring batch warnings, and transaction history so management can make informed procurement and production decisions.

---

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    CLIENT LAYER                         │
│  ┌──────────────────────┐  ┌────────────────────────┐  │
│  │  Next.js Web Dashboard│  │  Mobile Scanner App    │  │
│  │  (Vercel Deployment) │  │  (React Native / PWA)  │  │
│  │  - Management UI     │  │  - Barcode Scanning    │  │
│  │  - Reports           │  │  - Goods Receipt       │  │
│  │  - Admin Panel       │  │  - Stock Issues        │  │
│  └──────────┬───────────┘  └──────────┬─────────────┘  │
└─────────────┼──────────────────────────┼────────────────┘
              │         REST API          │
┌─────────────┼──────────────────────────┼────────────────┐
│             ▼    BACKEND LAYER          ▼               │
│  ┌──────────────────────────────────────────────────┐  │
│  │           Node.js / Express API Server            │  │
│  │  ┌──────────────┐  ┌──────────────────────────┐  │  │
│  │  │  REST Routes  │  │    MCP Server Layer      │  │  │
│  │  │  - /auth      │  │  - inventory-server.js   │  │  │
│  │  │  - /inventory │  │  - advanced-inventory    │  │  │
│  │  │  - /products  │  │  - batch-tools           │  │  │
│  │  │               │  │  - reporting-tools       │  │  │
│  │  └──────────────┘  └──────────────────────────┘  │  │
│  │  ┌──────────────────────────────────────────────┐ │  │
│  │  │           Services Layer                      │ │  │
│  │  │  auth · inventory · products · batch          │ │  │
│  │  │  transaction · reporting                      │ │  │
│  │  └──────────────────────────────────────────────┘ │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────┐
│                   DATA LAYER                            │
│         PostgreSQL 14+ on Neon Tech Cloud               │
│   15+ tables · Views · Triggers · Audit Logging        │
└─────────────────────────────────────────────────────────┘
```

---

## 🧩 Core Modules

### 1. Inventory Management
The heart of the system. Tracks current stock levels per product, per warehouse location, and per batch. Every quantity is broken down into:
- **On Hand** — physical quantity present
- **Allocated** — reserved for open production orders
- **Available** — on hand minus allocated (computed automatically)

Transactions supported: Receipt · Issue · Transfer · Adjustment · Return · Waste · Quality Hold · Quality Release · Production Consume · Production Output

### 2. Product Catalogue
Full product registry with SKU-based identification, barcode support, unit-of-measure conversions (piece → case → pallet), reorder points, safety stock levels, and technical specification storage via JSONB.

**Product Categories built for freshDRIP operations:**
| Code | Description |
|------|-------------|
| `RAW_PREFORM` | Pre-forms for blow moulding (500ml, 1L, 1.5L, 5L, 20L) |
| `RAW_CAP` | Caps and closures |
| `RAW_LABEL` | Labels and shrink sleeves |
| `RAW_PACKAGING` | Cases, pallets, stretch film |
| `SPARE_WATERLINE` | Water treatment line spares |
| `SPARE_BLOWER` | Blow moulding machine spares |
| `SPARE_FILLER` | Filler equipment spares |
| `SPARE_LABELER` | Labeller spares |
| `FINISHED_BOTTLE` | Empty labelled bottles |
| `FINISHED_PRODUCT` | Filled bottled water (final product) |

### 3. Batch & Lot Tracking
Every raw material can be tracked at batch level — recording supplier, manufacture date, expiry date, and QC status. Batch traceability enables full forward and backward traceability: which batch of pre-forms went into which production run and which finished product bottles.

QC statuses: `pending` · `approved` · `rejected` · `on_hold`  
Batch statuses: `active` · `depleted` · `quarantined` · `expired` · `recalled`

### 4. Warehouse Location Management
Hierarchical location structure supporting the physical warehouse layout:
```
Warehouse (WH-MAIN)
  └── Zone (ZONE-A)
        └── Aisle (A-AISLE-01)
              └── Bin (A-01-BIN-01)
```
Each location has a scannable barcode. Location types include: warehouse, zone, aisle, bin, production floor, quarantine, shipping.

### 5. Production Order Management
Links inventory to manufacturing runs. Each production order references a Bill of Materials (BOM) that defines which raw materials are required and in what quantities (including scrap factors). The system tracks:
- Planned vs. actual quantities produced
- Materials issued to production
- Materials consumed and returned
- Production line assignment

### 6. Barcode Scanning (Mobile App)
A dedicated mobile-first scanner application covers the main warehouse workflows:
- **Receive** — goods inward from suppliers
- **Issue** — materials out to production
- **Transfer** — internal location moves
- **Count** — cycle counting

Scanner sessions are tracked by device ID, enabling accountability and session management.

### 7. Alerts & Notifications
Automated system alerts for:
- **Low Stock** — when available quantity drops below the configured minimum
- **Expiring Batches** — 30-day forward warning on batch expiry dates
- **Expired Batches** — immediate alert on day of expiry
- **Quality Hold** — QC-triggered holds requiring management action

### 8. Audit Trail
Every data change in the system is captured in an immutable `audit_log` table recording: which table, which record, old values, new values, which fields changed, who made the change, when, and from which IP address. This log cannot be deleted or modified through the application.

### 9. Role-Based Access Control (RBAC)
| Role | Access Level |
|------|-------------|
| `admin` | Full system access, user management, all configuration |
| `warehouse_manager` | Approve transactions, full reporting, user oversight |
| `warehouse_staff` | Receive, issue, transfer, count — operational transactions |
| `production_manager` | Production orders, BOM management, production reporting |
| `viewer` | Read-only access to dashboards and reports |

---

## 🗄️ Database Schema Overview

The system is built on 15+ PostgreSQL tables with automated triggers, generated transaction numbers, and pre-built views for common reporting queries.

**Core Tables:** `users` · `products` · `product_categories` · `inventory` · `inventory_transactions` · `batches` · `warehouse_locations`

**Production Tables:** `production_orders` · `production_order_materials` · `bill_of_materials`

**System Tables:** `audit_log` · `scanner_sessions` · `system_alerts`

**Key Views:**
- `v_current_stock` — current stock levels with status indicators (LOW / REORDER / OK)
- `v_low_stock_items` — items below reorder point, ready for procurement action
- `v_expiring_batches` — batches expiring within 30 days
- `v_transaction_history` — full transaction history with user and product details

**Auto-generated Transaction Numbers:**
```
RCV-20260422-0001   ← Goods Receipt
ISS-20260422-0001   ← Stock Issue
ADJ-20260422-0001   ← Adjustment
TRF-20260422-0001   ← Transfer
```

**Database:** PostgreSQL 14+ hosted on [Neon Tech](https://neon.tech) (serverless cloud PostgreSQL)

---

## 🛠️ Technology Stack

| Layer | Technology |
|-------|-----------|
| Frontend Framework | Next.js 14 (App Router) |
| Frontend Language | TypeScript |
| Styling | Tailwind CSS |
| Backend Runtime | Node.js |
| Backend Framework | Express.js |
| Backend Language | JavaScript / TypeScript |
| Database | PostgreSQL 14+ (Neon Tech Cloud) |
| Authentication | JWT (JSON Web Tokens) · bcrypt password hashing |
| Deployment (Frontend) | Vercel |
| MCP Integration | Custom MCP Server (inventory, batch, reporting tools) |
| Package Manager | npm |

**Language Breakdown:** TypeScript 48.8% · JavaScript 46.7% · PLpgSQL 3.6%

---

## 📁 Repository Structure

```
VTL-Inventory-Management-V2/
├── frontend/                    # Next.js web dashboard
│   ├── app/                     # App Router pages
│   │   ├── dashboard/           # Main dashboard
│   │   ├── inventory/           # Inventory management UI
│   │   ├── products/            # Product catalogue
│   │   └── login/               # Authentication
│   ├── components/
│   │   ├── inventory/           # Inventory forms
│   │   │   ├── ReceiveForm.tsx
│   │   │   ├── IssueForm.tsx
│   │   │   ├── TransferForm.tsx
│   │   │   ├── AdjustmentForm.tsx
│   │   │   └── TransactionHistory.tsx
│   │   └── layout/
│   │       └── DashboardLayout.tsx
│   ├── hooks/
│   │   └── useAuth.ts
│   └── scanner-app/             # Mobile barcode scanning app
│       └── src/
│           ├── screens/         # receive · issue · transfer · count
│           ├── components/      # scanner · common UI
│           └── services/        # API integration
│
├── backend/                     # Node.js/Express API
│   ├── src/
│   │   ├── api/                 # REST API server
│   │   │   ├── controllers/
│   │   │   ├── middleware/
│   │   │   └── routes/          # auth · inventory · products
│   │   ├── mcp/                 # MCP server tools
│   │   │   ├── servers/
│   │   │   │   └── inventory-server.js
│   │   │   └── tools/
│   │   │       ├── advanced-inventory-tools.js
│   │   │       ├── batch-tools.js
│   │   │       └── reporting-tools.js
│   │   ├── services/            # Business logic layer
│   │   │   ├── auth-service.js
│   │   │   ├── inventory-service.js
│   │   │   ├── products-service.js
│   │   │   ├── batch-service.js
│   │   │   ├── transaction-service.js
│   │   │   └── reporting-service.js
│   │   ├── middleware/
│   │   │   ├── auth-middleware.js
│   │   │   └── authenticate.js
│   │   └── utils/
│   │       ├── db.js · db-enhanced.js
│   │       ├── validators.js
│   │       └── error-handler.js
│   └── scripts/                 # DB inspection & test utilities
│
├── database/                    # Schema and migrations
│   ├── schema.sql               # Full database schema (15+ tables)
│   ├── seed-data.sql            # Sample data for development
│   └── migrations/              # Schema version control
│
├── WEBSITE/                     # freshDRIP public-facing website
├── config/                      # Environment configuration
├── deployment/                  # Deployment configuration
├── docs/                        # Technical documentation
│   ├── DATABASE.md              # Full schema documentation
│   ├── API.md                   # API reference (in progress)
│   └── DEPLOYMENT.md            # Deployment guide (in progress)
├── tests/                       # Unit and integration tests
│   ├── unit/
│   └── integration/
└── scripts/                     # Utility scripts
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** v18+ or v20+
- **PostgreSQL** 14+ (or a [Neon Tech](https://neon.tech) account for cloud DB)
- **Git**

### 1. Clone the Repository

```bash
git clone https://github.com/kochezz/VTL-Inventory-Management-V2.git
cd VTL-Inventory-Management-V2
```

### 2. Database Setup

Create a project on [Neon Tech](https://neon.tech) and run the schema:

```bash
psql "postgresql://[user]:[password]@[host]/[database]?sslmode=require" \
  -f database/schema.sql
```

Optionally load sample data:

```bash
psql "YOUR_NEON_CONNECTION_STRING" -f database/seed-data.sql
```

Verify by checking that 15+ tables have been created:

```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' ORDER BY table_name;
```

### 3. Backend Setup

```bash
cd backend
cp .env.example .env
# Edit .env with your Neon connection string, JWT secret, and other values
npm install
npm run dev
```

### 4. Frontend Setup

```bash
cd frontend
cp .env.example .env.local
# Edit .env.local with your API URL
npm install
npm run dev
```

The dashboard will be available at `http://localhost:3000`.

### 5. Environment Variables

Key variables required in `.env`:

```
# Database
DATABASE_URL=postgresql://[user]:[password]@[neon-host]/[database]?sslmode=require

# Authentication
JWT_SECRET=your-secret-key-here
JWT_EXPIRES_IN=24h

# API
PORT=3001
NODE_ENV=development
```

---

## 🔐 Security

- All passwords hashed with **bcrypt** (minimum 10 rounds)
- **JWT** token authentication with 24-hour expiry
- **Role-based access control** enforced at the API middleware layer
- **Immutable audit log** — every data change is recorded and cannot be altered through the application
- **Scanner session tracking** — device-level login accountability
- IP address logging on all audit events

> ⚠️ **Production Note:** Change the default admin credentials immediately on first deployment. Default credentials must never be used in production.

---

## 📊 Database Barcode Standards

| Item Type | Format | Example |
|-----------|--------|---------|
| Products | Code 128 / GS1-128 | `PREFORM-500ML-28G` |
| Locations | Code 39 / QR Code | `A-01-BIN-01` |
| Batches | GS1-128 | `BATCH-PREFORM500-001` |

---

## 📈 Development Roadmap

### ✅ Phase 1 — Foundation (Complete)
- Full PostgreSQL database schema with 15+ tables
- Automated triggers (transaction numbering, low stock alerts, audit logging)
- Core reporting views
- Next.js frontend scaffold with dashboard, inventory, products, and login pages
- Inventory transaction forms (Receive, Issue, Transfer, Adjustment)
- Backend service layer architecture (auth, inventory, products, batch, transaction, reporting)
- MCP server tools (inventory, batch, reporting)
- JWT authentication middleware
- Sample seed data for development and testing

### 🔄 Phase 2 — API & Authentication (In Progress)
- Complete REST API endpoint implementation
- Full JWT authentication flow
- Barcode scanning API endpoints
- Real-time inventory update endpoints
- Role-based middleware enforcement

### 📋 Phase 3 — Mobile Scanner App
- React Native / PWA scanner application
- Offline-capable scanning with sync
- Device session management
- Guided workflows for receive, issue, transfer, count

### 📋 Phase 4 — Reporting & Analytics
- Management dashboard with KPI widgets
- Material usage reports
- Production efficiency reports
- Export to Excel/PDF
- Configurable alert thresholds

### 📋 Phase 5 — Integration
- Linkage with freshDRIP IPQC/production reporting system
- Procurement workflow integration
- Email/SMS alerts for critical stock events
- Potential ZABS/food safety compliance reporting

---

## 🧪 Testing

```bash
# Backend unit tests
cd backend
npm test

# Integration tests
npm run test:integration

# Database connection test
node test-db-connection.js

# Specific component tests
node test-inventory.js
node test-validators.js
node test-excel-report.js
```

---

## 📚 Documentation

| Document | Status | Description |
|----------|--------|-------------|
| [DATABASE.md](./docs/DATABASE.md) | ✅ Complete | Full schema, table definitions, query patterns |
| [API.md](./docs/API.md) | 🔄 In Progress | REST API endpoint reference |
| [DEPLOYMENT.md](./docs/DEPLOYMENT.md) | 🔄 In Progress | Production deployment guide |
| USER_GUIDE.md | 📋 Planned | End-user operational guide |

---

## 🌐 Live Deployment

| Environment | URL | Status |
|-------------|-----|--------|
| Frontend (Vercel) | [vilagio-erp-frontend.vercel.app](https://vilagio-erp-frontend.vercel.app) | 🟢 Live |
| Backend API | TBC — Phase 2 | 🔄 In Progress |
| Database | Neon Tech Cloud | 🟢 Live |

---

## 🤝 Internal Use & Support

This is a proprietary internal system developed for **Vilagio Trading Limited**.

For issues, enhancement requests, or questions:
1. Create a GitHub Issue with a detailed description
2. Include error logs and steps to reproduce any bugs
3. Tag with appropriate labels: `bug` · `enhancement` · `question` · `database` · `frontend` · `backend`

**Technical Lead:** Vilagio Tech Team  
**Email:** tech@vilag.io

---

## 📄 License

Internal use only — © Vilagio Trading Limited. All rights reserved.  
See [LICENSE](./LICENSE) for full terms.

---

**Version:** 2.0.0-alpha &nbsp;|&nbsp; **Last Updated:** April 2026 &nbsp;|&nbsp; **Status:** Complete