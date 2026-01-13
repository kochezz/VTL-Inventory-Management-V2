# Vilagio Inventory Management - Quick Start Guide
## Phase 1: Foundation Setup

This guide will walk you through setting up the database foundation for your Vilagio inventory management system.

---

## 📋 Prerequisites Checklist

Before starting, ensure you have:

- [ ] GitHub account and access to https://github.com/kochezz/VTL-Inventory-Management
- [ ] Neon Tech account (https://neon.tech)
- [ ] VSCode installed
- [ ] Git installed
- [ ] Internet connection

---

## 🚀 Step-by-Step Setup (30 minutes)

### Step 1: Neon Database Setup (10 minutes)

1. **Go to Neon Console**
   - Visit: https://console.neon.tech
   - Sign in or create account

2. **Create New Project**
   ```
   Project Name: vilagio-inventory-prod
   Region: Choose closest to your location
   PostgreSQL Version: 16 (latest)
   ```

3. **Get Connection String**
   - Click on your project
   - Navigate to "Connection Details"
   - Copy the connection string (looks like):
   ```
   postgresql://username:password@ep-xxx-xxx.region.aws.neon.tech/neondb?sslmode=require
   ```
   - **Save this securely!**

4. **Test Connection** (Optional but recommended)
   - Click "SQL Editor" in Neon console
   - Run: `SELECT version();`
   - Should see PostgreSQL version info

---

### Step 2: Clone GitHub Repository (2 minutes)

1. **Open Terminal/Command Prompt**

2. **Clone Repository**
   ```bash
   cd ~/Documents  # or your preferred directory
   git clone https://github.com/kochezz/VTL-Inventory-Management.git
   cd VTL-Inventory-Management
   ```

3. **Verify Files**
   ```bash
   ls -la
   # You should see: README.md, .gitignore, .env.example
   ```

---

### Step 3: Upload Database Files (2 minutes)

1. **Create Database Directory**
   ```bash
   mkdir database
   ```

2. **Copy SQL Files**
   - Copy `schema.sql` to `database/schema.sql`
   - Copy `seed-data.sql` to `database/seed-data.sql`

3. **Verify Structure**
   ```bash
   tree database
   # Should show:
   # database/
   # ├── schema.sql
   # └── seed-data.sql
   ```

---

### Step 4: Execute Database Schema (10 minutes)

**Method A: Using Neon Console (Recommended for beginners)**

1. Open Neon Console SQL Editor
2. Open `database/schema.sql` in VSCode
3. Copy ENTIRE contents
4. Paste into Neon SQL Editor
5. Click "Run" or press Ctrl/Cmd + Enter
6. Wait 30-60 seconds for execution
7. Check for "Success" message

**Method B: Using psql Command Line**

```bash
# Install psql if not already installed
# macOS: brew install postgresql
# Ubuntu: sudo apt-get install postgresql-client
# Windows: Download from postgresql.org

# Run schema
psql "YOUR_NEON_CONNECTION_STRING" -f database/schema.sql

# You should see:
# CREATE EXTENSION
# CREATE TABLE
# CREATE INDEX
# ... (many lines)
# INSERT 0 4
# INSERT 0 10
```

---

### Step 5: Verify Database Creation (3 minutes)

Run these queries in Neon SQL Editor:

**Query 1: Check Tables Created**
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;
```

**Expected Output:** 15+ tables including:
- audit_log
- batches
- bill_of_materials
- inventory
- inventory_transactions
- product_categories
- products
- production_order_materials
- production_orders
- scanner_sessions
- system_alerts
- users
- warehouse_locations

**Query 2: Check Default Data**
```sql
-- Should show default product categories
SELECT * FROM product_categories;

-- Should show default admin user
SELECT employee_id, email, full_name, role FROM users;

-- Should show default locations
SELECT location_code, location_name FROM warehouse_locations;
```

---

### Step 6: Load Sample Data (5 minutes)

**Using Neon Console:**

1. Open `database/seed-data.sql` in VSCode
2. Copy ENTIRE contents
3. Paste into Neon SQL Editor
4. Click "Run"
5. Wait 30-60 seconds

**Using psql:**
```bash
psql "YOUR_NEON_CONNECTION_STRING" -f database/seed-data.sql
```

---

### Step 7: Verify Sample Data (3 minutes)

Run these verification queries:

```sql
-- Check users (should see 6 users)
SELECT employee_id, full_name, role FROM users;

-- Check products (should see 20+ products)
SELECT sku, product_name, category_id FROM products;

-- Check inventory (should see 15+ records)
SELECT 
    p.sku,
    p.product_name,
    i.quantity_on_hand,
    wl.location_code
FROM inventory i
JOIN products p ON i.product_id = p.product_id
JOIN warehouse_locations wl ON i.location_id = wl.location_id
ORDER BY p.sku;

-- Check batches (should see 8+ batches)
SELECT batch_number, product_id, status FROM batches;

-- Use the convenient view
SELECT * FROM v_current_stock;
```

---

### Step 8: Configure Environment Variables (3 minutes)

1. **Copy Example File**
   ```bash
   cp .env.example .env
   ```

2. **Edit .env File**
   ```bash
   # Using VSCode
   code .env
   
   # Or using nano
   nano .env
   ```

3. **Fill in Required Values**
   ```env
   DATABASE_URL=postgresql://username:password@your-host.neon.tech/neondb?sslmode=require
   
   JWT_SECRET=your_generated_secret_here
   
   NODE_ENV=development
   
   PORT=3000
   ```

4. **Generate JWT Secret**
   ```bash
   # On Mac/Linux
   openssl rand -base64 32
   
   # Copy output to JWT_SECRET in .env
   ```

---

### Step 9: Git Setup (2 minutes)

1. **Ensure .env is ignored**
   ```bash
   # Check .gitignore exists
   cat .gitignore | grep .env
   # Should see: .env
   ```

2. **Initial Commit**
   ```bash
   git add .
   git commit -m "Phase 1: Database foundation setup"
   git push origin main
   ```

---

## ✅ Success Checklist

After completing all steps, verify:

- [x] Neon database project created
- [x] Repository cloned locally
- [x] Database schema executed successfully
- [x] 15+ tables created
- [x] Default data loaded (4 categories, 4 locations, 1 admin user)
- [x] Sample data loaded (6 users, 20+ products, 15+ inventory records)
- [x] Can query views: `v_current_stock`, `v_low_stock_items`
- [x] .env file created and configured
- [x] Changes committed to GitHub

---

## 🧪 Testing Your Setup

### Test 1: Query Current Stock
```sql
SELECT 
    sku,
    product_name,
    location_name,
    quantity_on_hand,
    stock_status
FROM v_current_stock
WHERE stock_status = 'OK'
LIMIT 5;
```

### Test 2: Check Low Stock Items
```sql
SELECT * FROM v_low_stock_items;
```
*Should return empty or items below reorder point*

### Test 3: Transaction History
```sql
SELECT 
    transaction_number,
    transaction_type,
    sku,
    quantity,
    performed_by_name
FROM v_transaction_history
ORDER BY transaction_date DESC
LIMIT 5;
```

### Test 4: Bill of Materials
```sql
SELECT 
    pp.sku as finished_product,
    cp.sku as component,
    bom.quantity_required,
    bom.uom
FROM bill_of_materials bom
JOIN products pp ON bom.parent_product_id = pp.product_id
JOIN products cp ON bom.component_product_id = cp.product_id;
```

---

## 🐛 Troubleshooting

### Issue: "relation does not exist"
**Solution:** Schema not fully executed. Re-run `schema.sql`

### Issue: "password authentication failed"
**Solution:** Check connection string, ensure password is correct

### Issue: "SSL required"
**Solution:** Add `?sslmode=require` to connection string

### Issue: "permission denied"
**Solution:** Ensure you're the database owner in Neon

### Issue: Can't connect to Neon
**Solution:** 
1. Check internet connection
2. Verify connection string from Neon console
3. Check Neon service status

---

## 📞 Getting Help

If you encounter issues:

1. **Check Neon Status**: https://neon.tech/status
2. **Review Error Messages**: Copy full error text
3. **Check Neon Logs**: Available in console under "Monitoring"
4. **GitHub Issues**: Create issue with:
   - Error message
   - Steps to reproduce
   - Your environment (OS, PostgreSQL version)

---

## 🎯 Next Steps

Now that Phase 1 is complete:

### Immediate (This Week)
- [ ] Familiarize yourself with database structure
- [ ] Review sample queries
- [ ] Understand relationships between tables
- [ ] Try creating custom queries

### Upcoming (Next Week)
- [ ] Design API endpoints
- [ ] Plan MCP server structure
- [ ] Review authentication requirements
- [ ] Sketch mobile scanner app UI

### Phase 2 Preview (Weeks 5-8)
- Backend API development (Node.js + Express)
- MCP server implementation
- JWT authentication system
- Barcode scanning endpoints
- Real-time inventory updates

---

## 📊 Database Statistics

After completing setup, your database should have:

| Table | Records |
|-------|---------|
| product_categories | 10 |
| users | 6 |
| warehouse_locations | 14 |
| products | 22 |
| batches | 8 |
| inventory | 18 |
| inventory_transactions | 2 |
| production_orders | 1 |
| bill_of_materials | 4 |

---

## 🔐 Default Login Credentials

**⚠️ FOR TESTING ONLY - CHANGE IN PRODUCTION!**

All test users have password: `password123`

| Email | Role | Badge |
|-------|------|-------|
| admin@vilagio.com | admin | BADGE001 |
| warehouse.manager@vilagio.com | warehouse_manager | BADGE002 |
| warehouse.staff1@vilagio.com | warehouse_staff | BADGE003 |
| warehouse.staff2@vilagio.com | warehouse_staff | BADGE004 |
| production.manager@vilagio.com | production_manager | BADGE005 |
| viewer@vilagio.com | viewer | BADGE006 |

---

## 🎉 Congratulations!

You've successfully completed Phase 1: Foundation!

Your database is now ready for Phase 2 development. You have:
- ✅ Production-ready schema
- ✅ Sample data for testing
- ✅ Views for common queries
- ✅ Audit logging enabled
- ✅ Automatic triggers configured

**Time to celebrate! 🎊**

Then get ready for Phase 2: MCP Server Development!

---

**Document Version**: 1.0  
**Last Updated**: January 13, 2026  
**Next Review**: Start of Phase 2
