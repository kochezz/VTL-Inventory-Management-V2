# Vilagio Inventory Management System

Enterprise-grade inventory management system for Drip Water manufacturing and bottling operations.

## 🎯 Project Overview

This system manages:
- Raw materials (pre-forms, caps, labels, packaging)
- Water line and production equipment spares
- Batch/lot tracking for compliance
- Production order management
- Real-time barcode scanning
- Complete audit trails

## 📋 Prerequisites

- **Node.js**: v18+ or v20+
- **PostgreSQL**: 14+ (Neon Tech cloud database)
- **Git**: Latest version
- **VSCode**: Recommended IDE

## 🚀 Phase 1: Foundation Setup

### Step 1: Clone Repository

```bash
git clone https://github.com/kochezz/VTL-Inventory-Management.git
cd VTL-Inventory-Management
```

### Step 2: Database Setup (Neon Tech)

1. **Create Neon Project**
   - Go to https://neon.tech
   - Create a new project named "vilagio-inventory"
   - Copy your connection string

2. **Run Database Schema**

```bash
# Using psql
psql "postgresql://[user]:[password]@[host]/[database]?sslmode=require" -f database/schema.sql

# Or using Neon's SQL Editor
# Copy contents of database/schema.sql and execute
```

3. **Verify Tables Created**

```sql
-- Run this query in Neon SQL Editor
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;
```

You should see 15+ tables including:
- users
- products
- inventory
- inventory_transactions
- batches
- warehouse_locations
- production_orders
- etc.

### Step 3: Project Structure

Create the following structure:

```
VTL-Inventory-Management/
├── database/
│   ├── schema.sql              # Main database schema
│   ├── seed-data.sql           # Sample data for testing
│   └── migrations/             # Future schema changes
├── backend/
│   ├── src/
│   │   ├── mcp/               # MCP server implementations
│   │   ├── api/               # REST API endpoints
│   │   ├── auth/              # Authentication logic
│   │   └── utils/             # Helper functions
│   ├── package.json
│   └── .env
├── frontend/
│   ├── scanner-app/           # Mobile scanning app
│   └── dashboard/             # Web dashboard
├── docs/
│   ├── API.md                 # API documentation
│   ├── DATABASE.md            # Database schema docs
│   └── DEPLOYMENT.md          # Deployment guide
├── .env.example
├── .gitignore
└── README.md
```

### Step 4: Environment Configuration

Create `.env` file in project root:

```bash
# Copy example file
cp .env.example .env

# Edit with your values
nano .env
```

Required environment variables (see .env.example):
- Database connection (Neon Tech)
- JWT secret
- API keys
- Email/notification settings

### Step 5: Backend Setup (Coming in Phase 2)

```bash
cd backend
npm install
npm run dev
```

## 📊 Database Schema Highlights

### Core Tables

**users** - User accounts and authentication
- Roles: admin, warehouse_manager, warehouse_staff, production_manager, viewer
- Badge number support for scanner login

**products** - Product catalog
- SKU, barcode, descriptions
- Category-based organization
- Reorder points and safety stock
- Unit of measure conversions

**inventory** - Current stock levels
- Product + Location + Batch tracking
- Quantity on hand, allocated, available
- Last count date and user

**inventory_transactions** - Complete audit trail
- All inventory movements
- User tracking, timestamps
- Scanner device tracking
- Reference documents (PO, production orders)

**batches** - Lot tracking for compliance
- Batch numbers, manufacture/expiry dates
- QC status tracking
- Supplier information
- Traceability

**production_orders** - Manufacturing integration
- Links materials to production
- Bill of materials (BOM)
- Material consumption tracking

### Key Features

✅ **Automatic Transaction Numbering**
- Format: RCV-20260113-0001
- Auto-generated, sequential per day

✅ **Low Stock Alerts**
- Automatic detection
- Configurable thresholds
- Alert management

✅ **Audit Logging**
- Immutable change history
- User actions tracked
- IP address logging

✅ **Batch Expiry Tracking**
- Automatic expiry alerts
- 30-day warning view
- QC status management

## 🔐 Security Considerations

### Default Credentials
⚠️ **CRITICAL**: Change default admin password immediately!

Default admin user:
- Email: admin@vilagio.com
- Password: admin123
- **CHANGE THIS IN PRODUCTION!**

### Password Hashing
- Uses bcrypt for password storage
- Minimum 10 rounds
- Never store plain text passwords

### API Authentication
- JWT tokens for session management
- Token expiration: 24 hours
- Refresh token support

### Role-Based Access Control (RBAC)

| Role | Permissions |
|------|------------|
| **admin** | Full system access, user management |
| **warehouse_manager** | Approve transactions, reports, user oversight |
| **warehouse_staff** | Receive, issue, transfer materials |
| **production_manager** | Production orders, BOM management |
| **viewer** | Read-only access to reports |

## 📱 Barcode Standards

### Product Barcodes
- **Format**: Code 128 or GS1-128
- **Structure**: SKU-based or UPC/EAN
- Example: `PREFORM-500ML-001`

### Location Barcodes
- **Format**: Code 39 or QR Code
- **Structure**: Location code
- Example: `LOC-ZONE-A-BIN-001`

### Batch Barcodes
- **Format**: GS1-128 (recommended)
- **Structure**: Batch number + Expiry date
- Example: `BATCH-20260113-001`

## 🧪 Testing Database

### Load Sample Data

```bash
# Load sample products, locations, and test data
psql "YOUR_NEON_CONNECTION_STRING" -f database/seed-data.sql
```

Sample data includes:
- 20+ sample products (pre-forms, caps, labels)
- 5 warehouse locations
- 3 test users with different roles
- Sample batches and inventory records

### Test Queries

```sql
-- Check current stock levels
SELECT * FROM v_current_stock;

-- Find low stock items
SELECT * FROM v_low_stock_items;

-- Check expiring batches
SELECT * FROM v_expiring_batches;

-- Recent transactions
SELECT * FROM v_transaction_history LIMIT 10;
```

## 📖 Next Steps

### Phase 1 Checklist (Weeks 1-4)

- [x] Database schema created
- [x] Sample data structure defined
- [ ] Database deployed to Neon
- [ ] Environment variables configured
- [ ] Test data loaded
- [ ] Database queries tested
- [ ] User authentication designed
- [ ] Documentation reviewed

### Phase 2 Preview (Weeks 5-8)

- MCP server development
- REST API implementation
- JWT authentication
- Barcode scanning endpoints
- Real-time inventory updates

## 🛠️ Development Tools

### Recommended VSCode Extensions

- PostgreSQL (Chris Kolkman)
- SQLTools
- REST Client
- ESLint
- Prettier

### Database Management

- **Neon Console**: Web-based SQL editor
- **DBeaver**: Desktop database client
- **pgAdmin**: Full-featured PostgreSQL admin

## 📚 Documentation

- [Database Schema Details](docs/DATABASE.md)
- [API Documentation](docs/API.md) - Coming soon
- [Deployment Guide](docs/DEPLOYMENT.md) - Coming soon
- [User Guide](docs/USER_GUIDE.md) - Coming soon

## 🤝 Contributing

This is an internal project for Vilagio. For questions or issues:

1. Create GitHub issue with detailed description
2. Include error logs and steps to reproduce
3. Tag with appropriate labels (bug, enhancement, question)

## 📞 Support

**Technical Lead**: [Your Name]
**Email**: tech@vilagio.com
**Slack**: #vilagio-inventory

## 📄 License

Internal use only - Vilagio Technologies Ltd.

---

**Version**: 1.0.0-alpha
**Last Updated**: January 13, 2026
**Status**: Phase 1 - Foundation Development
