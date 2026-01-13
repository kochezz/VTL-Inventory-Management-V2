# Database Schema Documentation
## Vilagio Inventory Management System

---

## 📊 Entity Relationship Overview

```
users ──┐
        ├──> inventory_transactions
        │    └──> inventory ──> products ──> product_categories
        │              │            │
        │              └──> batches ┘
        │              └──> warehouse_locations
        └──> scanner_sessions

production_orders ──> production_order_materials ──> products
                 └──> bill_of_materials ──> products
```

---

## 🗂️ Core Tables

### users
**Purpose**: User accounts and authentication

| Column | Type | Description |
|--------|------|-------------|
| user_id | UUID | Primary key |
| employee_id | VARCHAR(50) | Unique employee identifier (e.g., VTL001) |
| email | VARCHAR(255) | Unique email for login |
| full_name | VARCHAR(255) | Full name |
| password_hash | VARCHAR(255) | Bcrypt hashed password |
| role | VARCHAR(50) | admin, warehouse_manager, warehouse_staff, production_manager, viewer |
| badge_number | VARCHAR(50) | For badge scanner login |
| phone_number | VARCHAR(20) | Contact number |
| is_active | BOOLEAN | Account status |
| last_login | TIMESTAMP | Last login timestamp |

**Indexes**: email, employee_id, badge_number

**Sample Query**:
```sql
-- Get all active warehouse staff
SELECT * FROM users 
WHERE role = 'warehouse_staff' AND is_active = true;
```

---

### warehouse_locations
**Purpose**: Physical warehouse locations (zones, aisles, bins)

| Column | Type | Description |
|--------|------|-------------|
| location_id | UUID | Primary key |
| location_code | VARCHAR(50) | Unique code (e.g., A-01-BIN-01) |
| location_name | VARCHAR(255) | Descriptive name |
| location_type | VARCHAR(50) | warehouse, zone, aisle, bin, production_floor, quarantine, shipping |
| parent_location_id | UUID | For hierarchical structure (aisle → zone → warehouse) |
| barcode | VARCHAR(100) | Scannable barcode |
| capacity_cubic_meters | DECIMAL(10,2) | Storage capacity |

**Hierarchical Structure**:
```
Warehouse (WH-MAIN)
└── Zone A (ZONE-A)
    └── Aisle 1 (A-AISLE-01)
        └── Bin 1 (A-01-BIN-01)
```

**Sample Query**:
```sql
-- Get all bins in Zone A
SELECT * FROM warehouse_locations 
WHERE location_type = 'bin' 
  AND parent_location_id IN (
    SELECT location_id FROM warehouse_locations 
    WHERE location_code LIKE 'A-AISLE-%'
  );
```

---

### product_categories
**Purpose**: Product categorization

| Column | Type | Description |
|--------|------|-------------|
| category_id | UUID | Primary key |
| category_code | VARCHAR(50) | Unique code |
| category_name | VARCHAR(255) | Display name |
| description | TEXT | Category description |

**Default Categories**:
- `RAW_PREFORM`: Pre-forms for blow molding
- `RAW_CAP`: Caps and closures
- `RAW_LABEL`: Labels and shrink sleeves
- `RAW_PACKAGING`: Cases, pallets, stretch film
- `SPARE_WATERLINE`: Water treatment spares
- `SPARE_BLOWER`: Blow molder spares
- `SPARE_FILLER`: Filler equipment spares
- `SPARE_LABELER`: Labeler spares
- `FINISHED_BOTTLE`: Empty labeled bottles
- `FINISHED_PRODUCT`: Filled bottled water

---

### products
**Purpose**: Complete product catalog

| Column | Type | Description |
|--------|------|-------------|
| product_id | UUID | Primary key |
| sku | VARCHAR(100) | Unique stock keeping unit |
| product_name | VARCHAR(255) | Display name |
| category_id | UUID | Foreign key to categories |
| description | TEXT | Full description |
| barcode | VARCHAR(100) | Scannable product barcode |
| base_uom | VARCHAR(20) | Unit: piece, kg, liter, box, pallet, roll |
| base_uom_per_case | INTEGER | Units per case |
| cases_per_pallet | INTEGER | Cases per pallet |
| standard_cost | DECIMAL(10,2) | Standard unit cost |
| requires_batch_tracking | BOOLEAN | Enable batch tracking |
| requires_expiry_tracking | BOOLEAN | Track expiry dates |
| shelf_life_days | INTEGER | Shelf life if applicable |
| reorder_point | INTEGER | Trigger reorder |
| reorder_quantity | INTEGER | Order quantity |
| minimum_stock_level | INTEGER | Low stock threshold |
| maximum_stock_level | INTEGER | Max capacity |
| safety_stock_level | INTEGER | Safety buffer |
| specification_details | JSONB | Technical specs |

**UOM Conversions Example**:
```
Pre-forms:
- Base UOM: piece
- base_uom_per_case: 2000 pieces
- cases_per_pallet: 40 cases
- Therefore: 1 pallet = 80,000 pieces
```

**Sample Query**:
```sql
-- Get all products requiring batch tracking
SELECT sku, product_name, category_name
FROM products p
JOIN product_categories pc ON p.category_id = pc.category_id
WHERE requires_batch_tracking = true;
```

---

### batches
**Purpose**: Lot/batch tracking for traceability

| Column | Type | Description |
|--------|------|-------------|
| batch_id | UUID | Primary key |
| batch_number | VARCHAR(100) | Unique batch identifier |
| product_id | UUID | Foreign key to products |
| received_date | DATE | Receipt date |
| manufacture_date | DATE | Manufacture date |
| expiry_date | DATE | Expiry date (if applicable) |
| supplier_name | VARCHAR(255) | Supplier name |
| supplier_batch_number | VARCHAR(100) | Supplier's batch reference |
| qc_status | VARCHAR(50) | pending, approved, rejected, on_hold |
| qc_tested_by | UUID | QC inspector user_id |
| qc_tested_date | TIMESTAMP | QC test date |
| initial_quantity | DECIMAL(10,2) | Received quantity |
| current_quantity | DECIMAL(10,2) | Remaining quantity |
| status | VARCHAR(50) | active, depleted, quarantined, expired, recalled |

**Batch Number Format**: `BATCH-PRODUCT-SEQUENCE`
- Example: `BATCH-PREFORM500-001`

**Sample Query**:
```sql
-- Find batches expiring in next 30 days
SELECT * FROM v_expiring_batches;

-- Or manually:
SELECT b.batch_number, p.sku, b.expiry_date, b.current_quantity
FROM batches b
JOIN products p ON b.product_id = p.product_id
WHERE b.expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days'
  AND b.status = 'active'
ORDER BY b.expiry_date;
```

---

### inventory
**Purpose**: Current stock levels by location and batch

| Column | Type | Description |
|--------|------|-------------|
| inventory_id | UUID | Primary key |
| product_id | UUID | Foreign key to products |
| location_id | UUID | Foreign key to locations |
| batch_id | UUID | Foreign key to batches (NULL if no batch tracking) |
| quantity_on_hand | DECIMAL(10,2) | Physical quantity |
| quantity_allocated | DECIMAL(10,2) | Reserved for production |
| quantity_available | DECIMAL(10,2) | Computed: on_hand - allocated |
| uom | VARCHAR(20) | Unit of measure |
| last_counted_date | DATE | Last cycle count |
| last_counted_by | UUID | User who counted |

**Important**: 
- `quantity_available` is COMPUTED (on_hand - allocated)
- One record per unique combination: product + location + batch
- Products without batch tracking have `batch_id = NULL`

**Sample Query**:
```sql
-- Get total available quantity per product
SELECT 
    p.sku,
    p.product_name,
    SUM(i.quantity_available) as total_available,
    p.base_uom
FROM inventory i
JOIN products p ON i.product_id = p.product_id
GROUP BY p.product_id, p.sku, p.product_name, p.base_uom
HAVING SUM(i.quantity_available) > 0
ORDER BY total_available DESC;
```

---

### inventory_transactions
**Purpose**: Complete audit trail of all inventory movements

| Column | Type | Description |
|--------|------|-------------|
| transaction_id | UUID | Primary key |
| transaction_number | VARCHAR(100) | Auto-generated: RCV-20260113-0001 |
| transaction_type | ENUM | receipt, issue, adjustment, transfer, production_consume, production_output, return, waste, quality_hold, quality_release |
| transaction_date | TIMESTAMP | When transaction occurred |
| product_id | UUID | Product moved |
| batch_id | UUID | Batch reference (if applicable) |
| from_location_id | UUID | Source location |
| to_location_id | UUID | Destination location |
| quantity | DECIMAL(10,2) | Quantity moved |
| uom | VARCHAR(20) | Unit of measure |
| performed_by | UUID | User who performed transaction |
| approved_by | UUID | Approver (if required) |
| reference_document_type | VARCHAR(50) | PO, Production Order, etc. |
| reference_document_number | VARCHAR(100) | Document reference |
| unit_cost | DECIMAL(10,2) | Cost per unit |
| total_cost | DECIMAL(10,2) | Total transaction cost |
| scanned_barcode | VARCHAR(100) | Barcode that was scanned |
| scanner_device_id | VARCHAR(100) | Device ID |
| notes | TEXT | Additional notes |

**Transaction Types**:
- **receipt**: Receiving raw materials (to_location required)
- **issue**: Issuing to production (from_location required)
- **adjustment**: Cycle count adjustments
- **transfer**: Moving between locations
- **production_consume**: Materials consumed in production
- **production_output**: Finished goods produced
- **return**: Returning unused materials
- **waste**: Scrapped/wasted materials
- **quality_hold**: QC hold
- **quality_release**: QC release

**Transaction Number Format**: `[PREFIX]-[YYYYMMDD]-[SEQUENCE]`
- RCV-20260113-0001 (receipt)
- ISS-20260113-0001 (issue)
- ADJ-20260113-0001 (adjustment)
- TRF-20260113-0001 (transfer)

**Sample Queries**:
```sql
-- Recent transactions
SELECT * FROM v_transaction_history LIMIT 20;

-- Transactions for specific product
SELECT * FROM v_transaction_history
WHERE sku = 'PREFORM-500ML-28G'
ORDER BY transaction_date DESC;

-- Daily transaction summary
SELECT 
    DATE(transaction_date) as date,
    transaction_type,
    COUNT(*) as transaction_count,
    SUM(ABS(quantity)) as total_quantity
FROM inventory_transactions
WHERE transaction_date >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY DATE(transaction_date), transaction_type
ORDER BY date DESC, transaction_type;
```

---

## 🏭 Production Management Tables

### production_orders
**Purpose**: Link inventory to manufacturing runs

| Column | Type | Description |
|--------|------|-------------|
| order_id | UUID | Primary key |
| order_number | VARCHAR(100) | Unique order number |
| order_date | DATE | Order date |
| product_id | UUID | Product being produced |
| planned_quantity | DECIMAL(10,2) | Target quantity |
| produced_quantity | DECIMAL(10,2) | Actual produced |
| uom | VARCHAR(20) | Unit of measure |
| status | VARCHAR(50) | planned, released, in_progress, completed, cancelled |
| scheduled_start_date | DATE | Planned start |
| scheduled_end_date | DATE | Planned end |
| actual_start_date | DATE | Actual start |
| actual_end_date | DATE | Actual end |
| created_by | UUID | User who created order |
| production_line | VARCHAR(100) | Which line |

**Sample Query**:
```sql
-- Active production orders
SELECT 
    po.order_number,
    p.sku,
    po.planned_quantity,
    po.produced_quantity,
    po.status
FROM production_orders po
JOIN products p ON po.product_id = p.product_id
WHERE po.status IN ('released', 'in_progress')
ORDER BY po.scheduled_start_date;
```

---

### bill_of_materials
**Purpose**: Recipe for production - what materials are needed

| Column | Type | Description |
|--------|------|-------------|
| bom_id | UUID | Primary key |
| parent_product_id | UUID | Finished product |
| component_product_id | UUID | Raw material required |
| quantity_required | DECIMAL(10,2) | Amount per unit of parent |
| uom | VARCHAR(20) | Unit of measure |
| scrap_factor | DECIMAL(5,2) | Expected waste % |

**Example BOM**:
For 1 case of 500ml Drip Water (24 bottles):
- 24 pre-forms (+ 2% scrap = 24.48 ≈ 25)
- 24 caps (+ 1% scrap = 24.24 ≈ 25)
- 24 labels (+ 1.5% scrap = 24.36 ≈ 25)
- 1 case

**Sample Query**:
```sql
-- Get BOM for a product
SELECT 
    parent.sku as finished_product,
    component.sku as component,
    component.product_name,
    bom.quantity_required,
    bom.uom,
    bom.scrap_factor,
    bom.quantity_required * (1 + bom.scrap_factor/100) as actual_needed
FROM bill_of_materials bom
JOIN products parent ON bom.parent_product_id = parent.product_id
JOIN products component ON bom.component_product_id = component.product_id
WHERE parent.sku = 'BOTTLE-DRIP-500ML';
```

---

### production_order_materials
**Purpose**: Track material consumption per production order

| Column | Type | Description |
|--------|------|-------------|
| pom_id | UUID | Primary key |
| production_order_id | UUID | Reference to order |
| product_id | UUID | Material used |
| batch_id | UUID | Specific batch used |
| planned_quantity | DECIMAL(10,2) | Expected usage |
| issued_quantity | DECIMAL(10,2) | Actually issued |
| consumed_quantity | DECIMAL(10,2) | Actually used |
| returned_quantity | DECIMAL(10,2) | Returned unused |

---

## 🔐 Audit & Security Tables

### audit_log
**Purpose**: Immutable log of all data changes

| Column | Type | Description |
|--------|------|-------------|
| audit_id | UUID | Primary key |
| table_name | VARCHAR(100) | Which table changed |
| record_id | UUID | Which record |
| action | VARCHAR(50) | INSERT, UPDATE, DELETE |
| old_values | JSONB | Before values |
| new_values | JSONB | After values |
| changed_fields | TEXT[] | List of changed fields |
| performed_by | UUID | User who made change |
| performed_at | TIMESTAMP | When |
| ip_address | INET | IP address |
| session_id | VARCHAR(255) | Session ID |

**Sample Query**:
```sql
-- Recent changes to products
SELECT 
    audit_id,
    action,
    changed_fields,
    performed_at,
    u.full_name as changed_by
FROM audit_log al
JOIN users u ON al.performed_by = u.user_id
WHERE table_name = 'products'
ORDER BY performed_at DESC
LIMIT 20;
```

---

### scanner_sessions
**Purpose**: Track device login sessions

| Column | Type | Description |
|--------|------|-------------|
| session_id | UUID | Primary key |
| user_id | UUID | Logged in user |
| device_id | VARCHAR(100) | Scanner device ID |
| device_name | VARCHAR(255) | Friendly name |
| login_time | TIMESTAMP | Login time |
| logout_time | TIMESTAMP | Logout time |
| last_activity_time | TIMESTAMP | Last activity |
| is_active | BOOLEAN | Active session |

---

### system_alerts
**Purpose**: System-generated alerts and notifications

| Column | Type | Description |
|--------|------|-------------|
| alert_id | UUID | Primary key |
| alert_type | VARCHAR(50) | low_stock, expiring_batch, expired_batch, quality_hold, system_error |
| severity | VARCHAR(20) | info, warning, critical |
| product_id | UUID | Related product (if applicable) |
| batch_id | UUID | Related batch (if applicable) |
| location_id | UUID | Related location (if applicable) |
| alert_message | TEXT | Alert message |
| alert_data | JSONB | Additional data |
| is_acknowledged | BOOLEAN | User acknowledged |
| acknowledged_by | UUID | Who acknowledged |
| acknowledged_at | TIMESTAMP | When acknowledged |

---

## 📊 Useful Views

### v_current_stock
**Purpose**: Current stock with product details and status

```sql
SELECT * FROM v_current_stock
WHERE stock_status = 'LOW'
ORDER BY product_name;
```

**Columns**:
- product_id, sku, product_name
- category_name
- location_code, location_name
- batch_number, expiry_date
- quantity_on_hand, quantity_allocated, quantity_available
- minimum_stock_level, reorder_point
- stock_status (LOW, REORDER, OK)
- last_counted_date

---

### v_low_stock_items
**Purpose**: Items below reorder point

```sql
SELECT * FROM v_low_stock_items
ORDER BY total_available;
```

**Columns**:
- product_id, sku, product_name
- category_name
- total_available
- minimum_stock_level, reorder_point
- reorder_quantity, lead_time_days

---

### v_expiring_batches
**Purpose**: Batches expiring in next 30 days

```sql
SELECT * FROM v_expiring_batches
ORDER BY days_until_expiry;
```

**Columns**:
- batch_id, batch_number
- sku, product_name
- expiry_date, days_until_expiry
- current_quantity, uom

---

### v_transaction_history
**Purpose**: Transaction history with details

```sql
SELECT * FROM v_transaction_history
WHERE transaction_date >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY transaction_date DESC;
```

**Columns**:
- transaction_id, transaction_number
- transaction_type, transaction_date
- sku, product_name, batch_number
- quantity, uom
- from_location, to_location
- performed_by_name, employee_id

---

## 🔧 Functions & Triggers

### update_updated_at_column()
**Purpose**: Auto-update updated_at timestamp

Applied to: users, products, inventory, batches, warehouse_locations, production_orders

---

### generate_transaction_number()
**Purpose**: Auto-generate transaction numbers

Format: `[PREFIX]-[YYYYMMDD]-[SEQUENCE]`

Usage:
```sql
SELECT generate_transaction_number('receipt'::transaction_type);
-- Returns: RCV-20260113-0001
```

---

### check_low_stock_alert()
**Purpose**: Create alerts when stock drops below minimum

Triggered automatically on inventory INSERT/UPDATE

---

## 🎯 Common Query Patterns

### 1. Check Product Availability
```sql
SELECT 
    p.sku,
    p.product_name,
    SUM(i.quantity_available) as available,
    p.reorder_point
FROM products p
LEFT JOIN inventory i ON p.product_id = i.product_id
WHERE p.sku = 'PREFORM-500ML-28G'
GROUP BY p.product_id, p.sku, p.product_name, p.reorder_point;
```

### 2. Material Usage Report
```sql
SELECT 
    p.sku,
    p.product_name,
    SUM(CASE WHEN it.transaction_type = 'issue' THEN it.quantity ELSE 0 END) as total_issued,
    SUM(CASE WHEN it.transaction_type = 'return' THEN it.quantity ELSE 0 END) as total_returned,
    SUM(CASE WHEN it.transaction_type = 'issue' THEN it.quantity ELSE 0 END) - 
    SUM(CASE WHEN it.transaction_type = 'return' THEN it.quantity ELSE 0 END) as net_consumption
FROM inventory_transactions it
JOIN products p ON it.product_id = p.product_id
WHERE it.transaction_date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY p.product_id, p.sku, p.product_name
ORDER BY net_consumption DESC;
```

### 3. Location Utilization
```sql
SELECT 
    wl.location_code,
    wl.location_name,
    COUNT(DISTINCT i.product_id) as product_count,
    SUM(i.quantity_on_hand) as total_quantity,
    wl.capacity_cubic_meters
FROM warehouse_locations wl
LEFT JOIN inventory i ON wl.location_id = i.location_id
WHERE wl.location_type = 'bin'
GROUP BY wl.location_id, wl.location_code, wl.location_name, wl.capacity_cubic_meters
ORDER BY product_count DESC;
```

### 4. User Activity Report
```sql
SELECT 
    u.full_name,
    u.role,
    COUNT(it.transaction_id) as transaction_count,
    SUM(ABS(it.quantity)) as total_quantity_moved,
    MIN(it.transaction_date) as first_transaction,
    MAX(it.transaction_date) as last_transaction
FROM users u
LEFT JOIN inventory_transactions it ON u.user_id = it.performed_by
WHERE it.transaction_date >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY u.user_id, u.full_name, u.role
ORDER BY transaction_count DESC;
```

### 5. Batch Traceability
```sql
-- Where did batch go?
SELECT 
    b.batch_number,
    p.sku,
    it.transaction_type,
    it.quantity,
    wl.location_code,
    it.transaction_date,
    u.full_name
FROM batches b
JOIN inventory_transactions it ON b.batch_id = it.batch_id
JOIN products p ON b.product_id = p.product_id
LEFT JOIN warehouse_locations wl ON it.to_location_id = wl.location_id OR it.from_location_id = wl.location_id
LEFT JOIN users u ON it.performed_by = u.user_id
WHERE b.batch_number = 'BATCH-PREFORM500-001'
ORDER BY it.transaction_date;
```

---

## 🔐 Security Best Practices

1. **Never expose user_id in public APIs** - use employee_id instead
2. **Always validate transaction types** - use ENUM constraints
3. **Log all changes** - audit_log captures everything
4. **Use transactions** - wrap related operations in BEGIN/COMMIT
5. **Hash passwords** - never store plain text (use bcrypt)
6. **Validate quantities** - prevent negative stock
7. **Track scanner sessions** - know who's logged in where

---

## 📈 Performance Considerations

1. **Indexes created on**:
   - All foreign keys
   - Frequently queried fields (sku, barcode, location_code)
   - Date fields for range queries
   
2. **Use views for common queries** - pre-joined data

3. **Partition inventory_transactions** (future):
   - By date for better performance with millions of records

4. **Archive old data**:
   - Move transactions older than 2 years to archive table

---

**Document Version**: 1.0
**Last Updated**: January 13, 2026
**Maintained By**: Vilagio Tech Team
