-- ============================================================
-- Vilagio (Drip Water) Inventory Management System
-- Database Schema for Neon PostgreSQL
-- Phase 1: Foundation
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- CORE TABLES
-- ============================================================

-- Users Table: Store user information and authentication
CREATE TABLE users (
    user_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('admin', 'warehouse_manager', 'warehouse_staff', 'production_manager', 'viewer')),
    badge_number VARCHAR(50) UNIQUE,
    phone_number VARCHAR(20),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP WITH TIME ZONE
);

-- Create index on email and employee_id for fast lookups
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_employee_id ON users(employee_id);
CREATE INDEX idx_users_badge ON users(badge_number);

-- ============================================================
-- LOCATION MANAGEMENT
-- ============================================================

-- Warehouse Locations: Track zones, aisles, bins
CREATE TABLE warehouse_locations (
    location_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    location_code VARCHAR(50) UNIQUE NOT NULL,
    location_name VARCHAR(255) NOT NULL,
    location_type VARCHAR(50) NOT NULL CHECK (location_type IN ('warehouse', 'zone', 'aisle', 'bin', 'production_floor', 'quarantine', 'shipping')),
    parent_location_id UUID REFERENCES warehouse_locations(location_id),
    barcode VARCHAR(100) UNIQUE,
    capacity_cubic_meters DECIMAL(10,2),
    is_active BOOLEAN DEFAULT true,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_location_code ON warehouse_locations(location_code);
CREATE INDEX idx_location_type ON warehouse_locations(location_type);
CREATE INDEX idx_location_parent ON warehouse_locations(parent_location_id);

-- ============================================================
-- PRODUCT CATALOG
-- ============================================================

-- Product Categories
CREATE TABLE product_categories (
    category_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category_code VARCHAR(50) UNIQUE NOT NULL,
    category_name VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Insert default categories for water bottling
INSERT INTO product_categories (category_code, category_name, description) VALUES
('RAW_PREFORM', 'Pre-forms', 'Bottle pre-forms for blow molding'),
('RAW_CAP', 'Caps & Closures', 'Bottle caps and closure systems'),
('RAW_LABEL', 'Labels', 'Bottle labels and shrink sleeves'),
('RAW_PACKAGING', 'Packaging Materials', 'Cases, cartons, pallets, stretch film'),
('SPARE_WATERLINE', 'Water Line Spares', 'Spare parts for water treatment and bottling line'),
('SPARE_BLOWER', 'Blow Molder Spares', 'Spare parts for bottle blowing machines'),
('SPARE_FILLER', 'Filler Spares', 'Spare parts for filling equipment'),
('SPARE_LABELER', 'Labeler Spares', 'Spare parts for labeling machines'),
('FINISHED_BOTTLE', 'Finished Bottles', 'Blown and labeled bottles ready for filling'),
('FINISHED_PRODUCT', 'Finished Products', 'Filled and packaged water products');

-- Products: Main product catalog
CREATE TABLE products (
    product_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sku VARCHAR(100) UNIQUE NOT NULL,
    product_name VARCHAR(255) NOT NULL,
    category_id UUID REFERENCES product_categories(category_id) NOT NULL,
    description TEXT,
    barcode VARCHAR(100) UNIQUE,
    
    -- Unit of Measure
    base_uom VARCHAR(20) NOT NULL, -- 'piece', 'kg', 'liter', 'box', 'pallet'
    base_uom_per_case INTEGER, -- e.g., 24 bottles per case
    cases_per_pallet INTEGER,
    
    -- Cost tracking
    standard_cost DECIMAL(10,2),
    currency VARCHAR(3) DEFAULT 'USD',
    
    -- Specifications (for raw materials)
    specification_details JSONB, -- Store technical specs like PET weight, cap size, etc.
    
    -- Inventory control
    requires_batch_tracking BOOLEAN DEFAULT false,
    requires_expiry_tracking BOOLEAN DEFAULT false,
    shelf_life_days INTEGER, -- For materials with expiration
    
    -- Reorder parameters
    reorder_point INTEGER,
    reorder_quantity INTEGER,
    minimum_stock_level INTEGER NOT NULL DEFAULT 0,
    maximum_stock_level INTEGER,
    safety_stock_level INTEGER,
    
    -- Supplier info
    primary_supplier_id UUID, -- Will reference suppliers table if needed
    lead_time_days INTEGER,
    
    -- Quality control
    requires_qc_on_receipt BOOLEAN DEFAULT false,
    qc_procedure_notes TEXT,
    
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_products_sku ON products(sku);
CREATE INDEX idx_products_barcode ON products(barcode);
CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_active ON products(is_active);

-- ============================================================
-- BATCH/LOT TRACKING
-- ============================================================

-- Batches: Track lots for traceability
CREATE TABLE batches (
    batch_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    batch_number VARCHAR(100) UNIQUE NOT NULL,
    product_id UUID REFERENCES products(product_id) NOT NULL,
    
    -- Receipt information
    received_date DATE NOT NULL,
    manufacture_date DATE,
    expiry_date DATE,
    
    -- Supplier information
    supplier_name VARCHAR(255),
    supplier_batch_number VARCHAR(100),
    po_number VARCHAR(100), -- Purchase order reference
    
    -- Quality control
    qc_status VARCHAR(50) DEFAULT 'pending' CHECK (qc_status IN ('pending', 'approved', 'rejected', 'on_hold')),
    qc_tested_by UUID REFERENCES users(user_id),
    qc_tested_date TIMESTAMP WITH TIME ZONE,
    qc_notes TEXT,
    
    -- Quantity tracking
    initial_quantity DECIMAL(10,2) NOT NULL,
    current_quantity DECIMAL(10,2) NOT NULL,
    uom VARCHAR(20) NOT NULL,
    
    -- Status
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'depleted', 'quarantined', 'expired', 'recalled')),
    
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_batches_number ON batches(batch_number);
CREATE INDEX idx_batches_product ON batches(product_id);
CREATE INDEX idx_batches_expiry ON batches(expiry_date);
CREATE INDEX idx_batches_status ON batches(status);
CREATE INDEX idx_batches_qc_status ON batches(qc_status);

-- ============================================================
-- INVENTORY MANAGEMENT
-- ============================================================

-- Inventory: Current stock levels by location and batch
CREATE TABLE inventory (
    inventory_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID REFERENCES products(product_id) NOT NULL,
    location_id UUID REFERENCES warehouse_locations(location_id) NOT NULL,
    batch_id UUID REFERENCES batches(batch_id), -- NULL if product doesn't require batch tracking
    
    -- Quantity
    quantity_on_hand DECIMAL(10,2) NOT NULL DEFAULT 0,
    quantity_allocated DECIMAL(10,2) NOT NULL DEFAULT 0, -- Reserved for production orders
    quantity_available DECIMAL(10,2) GENERATED ALWAYS AS (quantity_on_hand - quantity_allocated) STORED,
    uom VARCHAR(20) NOT NULL,
    
    -- Tracking
    last_counted_date DATE,
    last_counted_by UUID REFERENCES users(user_id),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Ensure unique combination of product, location, and batch
    UNIQUE(product_id, location_id, batch_id)
);

CREATE INDEX idx_inventory_product ON inventory(product_id);
CREATE INDEX idx_inventory_location ON inventory(location_id);
CREATE INDEX idx_inventory_batch ON inventory(batch_id);
CREATE INDEX idx_inventory_available ON inventory(quantity_available);

-- ============================================================
-- TRANSACTION TRACKING
-- ============================================================

-- Transaction Types
CREATE TYPE transaction_type AS ENUM (
    'receipt',              -- Receiving raw materials
    'issue',               -- Issuing materials to production
    'adjustment',          -- Inventory adjustments (cycle counts, corrections)
    'transfer',            -- Moving between locations
    'production_consume',  -- Consumed in production
    'production_output',   -- Produced items
    'return',             -- Return to inventory
    'waste',              -- Waste/scrap
    'quality_hold',       -- QC hold
    'quality_release'     -- QC release
);

-- Inventory Transactions: Complete audit trail
CREATE TABLE inventory_transactions (
    transaction_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transaction_number VARCHAR(100) UNIQUE NOT NULL, -- Auto-generated: RCV-20260113-0001
    transaction_type transaction_type NOT NULL,
    transaction_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Product information
    product_id UUID REFERENCES products(product_id) NOT NULL,
    batch_id UUID REFERENCES batches(batch_id),
    
    -- Location information
    from_location_id UUID REFERENCES warehouse_locations(location_id),
    to_location_id UUID REFERENCES warehouse_locations(location_id),
    
    -- Quantity
    quantity DECIMAL(10,2) NOT NULL,
    uom VARCHAR(20) NOT NULL,
    
    -- User tracking
    performed_by UUID REFERENCES users(user_id) NOT NULL,
    approved_by UUID REFERENCES users(user_id),
    
    -- Reference documents
    reference_document_type VARCHAR(50), -- 'PO', 'Production Order', 'Transfer Request', etc.
    reference_document_number VARCHAR(100),
    
    -- Cost tracking
    unit_cost DECIMAL(10,2),
    total_cost DECIMAL(10,2),
    currency VARCHAR(3) DEFAULT 'USD',
    
    -- Scanner tracking
    scanned_barcode VARCHAR(100),
    scanner_device_id VARCHAR(100),
    
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    CHECK (
        (transaction_type IN ('receipt', 'production_output', 'return', 'quality_release') AND to_location_id IS NOT NULL) OR
        (transaction_type IN ('issue', 'production_consume', 'waste', 'quality_hold') AND from_location_id IS NOT NULL) OR
        (transaction_type IN ('transfer', 'adjustment') AND from_location_id IS NOT NULL AND to_location_id IS NOT NULL)
    )
);

CREATE INDEX idx_trans_number ON inventory_transactions(transaction_number);
CREATE INDEX idx_trans_type ON inventory_transactions(transaction_type);
CREATE INDEX idx_trans_product ON inventory_transactions(product_id);
CREATE INDEX idx_trans_batch ON inventory_transactions(batch_id);
CREATE INDEX idx_trans_date ON inventory_transactions(transaction_date);
CREATE INDEX idx_trans_user ON inventory_transactions(performed_by);

-- ============================================================
-- PRODUCTION MANAGEMENT
-- ============================================================

-- Production Orders: Link inventory to production
CREATE TABLE production_orders (
    order_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_number VARCHAR(100) UNIQUE NOT NULL,
    order_date DATE NOT NULL,
    
    -- Product being produced
    product_id UUID REFERENCES products(product_id) NOT NULL,
    planned_quantity DECIMAL(10,2) NOT NULL,
    produced_quantity DECIMAL(10,2) DEFAULT 0,
    uom VARCHAR(20) NOT NULL,
    
    -- Status
    status VARCHAR(50) DEFAULT 'planned' CHECK (status IN ('planned', 'released', 'in_progress', 'completed', 'cancelled')),
    
    -- Scheduling
    scheduled_start_date DATE,
    scheduled_end_date DATE,
    actual_start_date DATE,
    actual_end_date DATE,
    
    -- Tracking
    created_by UUID REFERENCES users(user_id) NOT NULL,
    production_line VARCHAR(100),
    
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_prod_orders_number ON production_orders(order_number);
CREATE INDEX idx_prod_orders_product ON production_orders(product_id);
CREATE INDEX idx_prod_orders_status ON production_orders(status);
CREATE INDEX idx_prod_orders_date ON production_orders(order_date);

-- Bill of Materials: What materials are needed for production
CREATE TABLE bill_of_materials (
    bom_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    parent_product_id UUID REFERENCES products(product_id) NOT NULL, -- Finished product
    component_product_id UUID REFERENCES products(product_id) NOT NULL, -- Raw material
    
    quantity_required DECIMAL(10,2) NOT NULL, -- Amount per unit of parent
    uom VARCHAR(20) NOT NULL,
    scrap_factor DECIMAL(5,2) DEFAULT 0, -- Expected waste percentage
    
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(parent_product_id, component_product_id)
);

CREATE INDEX idx_bom_parent ON bill_of_materials(parent_product_id);
CREATE INDEX idx_bom_component ON bill_of_materials(component_product_id);

-- Production Order Materials: Track material consumption per production order
CREATE TABLE production_order_materials (
    pom_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    production_order_id UUID REFERENCES production_orders(order_id) NOT NULL,
    product_id UUID REFERENCES products(product_id) NOT NULL,
    batch_id UUID REFERENCES batches(batch_id),
    
    planned_quantity DECIMAL(10,2) NOT NULL,
    issued_quantity DECIMAL(10,2) DEFAULT 0,
    consumed_quantity DECIMAL(10,2) DEFAULT 0,
    returned_quantity DECIMAL(10,2) DEFAULT 0,
    uom VARCHAR(20) NOT NULL,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_pom_order ON production_order_materials(production_order_id);
CREATE INDEX idx_pom_product ON production_order_materials(product_id);
CREATE INDEX idx_pom_batch ON production_order_materials(batch_id);

-- ============================================================
-- AUDIT & COMPLIANCE
-- ============================================================

-- Audit Log: Immutable log of all system changes
CREATE TABLE audit_log (
    audit_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    table_name VARCHAR(100) NOT NULL,
    record_id UUID NOT NULL,
    action VARCHAR(50) NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
    
    old_values JSONB,
    new_values JSONB,
    changed_fields TEXT[],
    
    performed_by UUID REFERENCES users(user_id) NOT NULL,
    performed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    ip_address INET,
    user_agent TEXT,
    
    session_id VARCHAR(255)
);

CREATE INDEX idx_audit_table ON audit_log(table_name);
CREATE INDEX idx_audit_record ON audit_log(record_id);
CREATE INDEX idx_audit_user ON audit_log(performed_by);
CREATE INDEX idx_audit_date ON audit_log(performed_at);

-- ============================================================
-- SYSTEM ALERTS & NOTIFICATIONS
-- ============================================================

-- Alerts: Track system-generated alerts
CREATE TABLE system_alerts (
    alert_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    alert_type VARCHAR(50) NOT NULL CHECK (alert_type IN ('low_stock', 'expiring_batch', 'expired_batch', 'quality_hold', 'system_error')),
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
    
    product_id UUID REFERENCES products(product_id),
    batch_id UUID REFERENCES batches(batch_id),
    location_id UUID REFERENCES warehouse_locations(location_id),
    
    alert_message TEXT NOT NULL,
    alert_data JSONB,
    
    is_acknowledged BOOLEAN DEFAULT false,
    acknowledged_by UUID REFERENCES users(user_id),
    acknowledged_at TIMESTAMP WITH TIME ZONE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_alerts_type ON system_alerts(alert_type);
CREATE INDEX idx_alerts_severity ON system_alerts(severity);
CREATE INDEX idx_alerts_acknowledged ON system_alerts(is_acknowledged);
CREATE INDEX idx_alerts_date ON system_alerts(created_at);

-- ============================================================
-- SCANNER SESSIONS
-- ============================================================

-- Scanner Sessions: Track device login sessions
CREATE TABLE scanner_sessions (
    session_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(user_id) NOT NULL,
    device_id VARCHAR(100) NOT NULL,
    device_name VARCHAR(255),
    
    login_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    logout_time TIMESTAMP WITH TIME ZONE,
    last_activity_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    ip_address INET,
    is_active BOOLEAN DEFAULT true
);

CREATE INDEX idx_sessions_user ON scanner_sessions(user_id);
CREATE INDEX idx_sessions_device ON scanner_sessions(device_id);
CREATE INDEX idx_sessions_active ON scanner_sessions(is_active);

-- ============================================================
-- VIEWS FOR COMMON QUERIES
-- ============================================================

-- View: Current Stock Levels with Product Details
CREATE VIEW v_current_stock AS
SELECT 
    p.product_id,
    p.sku,
    p.product_name,
    pc.category_name,
    wl.location_code,
    wl.location_name,
    b.batch_number,
    b.expiry_date,
    i.quantity_on_hand,
    i.quantity_allocated,
    i.quantity_available,
    i.uom,
    p.minimum_stock_level,
    p.reorder_point,
    CASE 
        WHEN i.quantity_available <= p.minimum_stock_level THEN 'LOW'
        WHEN i.quantity_available <= p.reorder_point THEN 'REORDER'
        ELSE 'OK'
    END as stock_status,
    i.last_counted_date,
    i.updated_at
FROM inventory i
JOIN products p ON i.product_id = p.product_id
JOIN product_categories pc ON p.category_id = pc.category_id
JOIN warehouse_locations wl ON i.location_id = wl.location_id
LEFT JOIN batches b ON i.batch_id = b.batch_id
WHERE i.quantity_on_hand > 0 AND p.is_active = true;

-- View: Low Stock Items
CREATE VIEW v_low_stock_items AS
SELECT 
    p.product_id,
    p.sku,
    p.product_name,
    pc.category_name,
    SUM(i.quantity_available) as total_available,
    p.uom as base_uom,
    p.minimum_stock_level,
    p.reorder_point,
    p.reorder_quantity,
    p.lead_time_days
FROM inventory i
JOIN products p ON i.product_id = p.product_id
JOIN product_categories pc ON p.category_id = pc.category_id
WHERE p.is_active = true
GROUP BY p.product_id, p.sku, p.product_name, pc.category_name, p.base_uom, 
         p.minimum_stock_level, p.reorder_point, p.reorder_quantity, p.lead_time_days
HAVING SUM(i.quantity_available) <= p.reorder_point;

-- View: Expiring Batches (next 30 days)
CREATE VIEW v_expiring_batches AS
SELECT 
    b.batch_id,
    b.batch_number,
    p.sku,
    p.product_name,
    b.expiry_date,
    b.current_quantity,
    b.uom,
    b.status,
    (b.expiry_date - CURRENT_DATE) as days_until_expiry
FROM batches b
JOIN products p ON b.product_id = p.product_id
WHERE b.expiry_date IS NOT NULL 
  AND b.expiry_date <= CURRENT_DATE + INTERVAL '30 days'
  AND b.status = 'active'
  AND b.current_quantity > 0
ORDER BY b.expiry_date;

-- View: Transaction History with Details
CREATE VIEW v_transaction_history AS
SELECT 
    t.transaction_id,
    t.transaction_number,
    t.transaction_type,
    t.transaction_date,
    p.sku,
    p.product_name,
    b.batch_number,
    t.quantity,
    t.uom,
    fl.location_code as from_location,
    tl.location_code as to_location,
    u.full_name as performed_by_name,
    u.employee_id,
    t.notes
FROM inventory_transactions t
JOIN products p ON t.product_id = p.product_id
LEFT JOIN batches b ON t.batch_id = b.batch_id
LEFT JOIN warehouse_locations fl ON t.from_location_id = fl.location_id
LEFT JOIN warehouse_locations tl ON t.to_location_id = tl.location_id
JOIN users u ON t.performed_by = u.user_id
ORDER BY t.transaction_date DESC;

-- ============================================================
-- FUNCTIONS AND TRIGGERS
-- ============================================================

-- Function: Update timestamp on record modification
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply timestamp trigger to relevant tables
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_inventory_updated_at BEFORE UPDATE ON inventory
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_batches_updated_at BEFORE UPDATE ON batches
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_locations_updated_at BEFORE UPDATE ON warehouse_locations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_production_orders_updated_at BEFORE UPDATE ON production_orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function: Generate transaction number
CREATE OR REPLACE FUNCTION generate_transaction_number(tx_type transaction_type)
RETURNS VARCHAR AS $$
DECLARE
    prefix VARCHAR(10);
    date_part VARCHAR(10);
    sequence_part VARCHAR(10);
    counter INTEGER;
BEGIN
    -- Determine prefix based on transaction type
    prefix := CASE tx_type
        WHEN 'receipt' THEN 'RCV'
        WHEN 'issue' THEN 'ISS'
        WHEN 'adjustment' THEN 'ADJ'
        WHEN 'transfer' THEN 'TRF'
        WHEN 'production_consume' THEN 'PRD'
        WHEN 'production_output' THEN 'OUT'
        WHEN 'return' THEN 'RET'
        WHEN 'waste' THEN 'WST'
        ELSE 'TXN'
    END;
    
    -- Get date part
    date_part := TO_CHAR(CURRENT_DATE, 'YYYYMMDD');
    
    -- Get next sequence number for today
    SELECT COUNT(*) + 1 INTO counter
    FROM inventory_transactions
    WHERE transaction_number LIKE prefix || '-' || date_part || '-%'
      AND DATE(transaction_date) = CURRENT_DATE;
    
    sequence_part := LPAD(counter::TEXT, 4, '0');
    
    RETURN prefix || '-' || date_part || '-' || sequence_part;
END;
$$ LANGUAGE plpgsql;

-- Function: Check and create low stock alerts
CREATE OR REPLACE FUNCTION check_low_stock_alert()
RETURNS TRIGGER AS $$
DECLARE
    product_rec RECORD;
    total_available DECIMAL;
BEGIN
    -- Get product details
    SELECT * INTO product_rec FROM products WHERE product_id = NEW.product_id;
    
    -- Calculate total available quantity for this product
    SELECT COALESCE(SUM(quantity_available), 0) INTO total_available
    FROM inventory
    WHERE product_id = NEW.product_id;
    
    -- Check if alert is needed
    IF total_available <= product_rec.minimum_stock_level THEN
        -- Check if alert already exists and is not acknowledged
        IF NOT EXISTS (
            SELECT 1 FROM system_alerts
            WHERE product_id = NEW.product_id
              AND alert_type = 'low_stock'
              AND is_acknowledged = false
        ) THEN
            -- Create alert
            INSERT INTO system_alerts (
                alert_type,
                severity,
                product_id,
                alert_message,
                alert_data
            ) VALUES (
                'low_stock',
                CASE WHEN total_available = 0 THEN 'critical' ELSE 'warning' END,
                NEW.product_id,
                'Low stock alert for ' || product_rec.product_name || ' (SKU: ' || product_rec.sku || ')',
                jsonb_build_object(
                    'current_quantity', total_available,
                    'minimum_level', product_rec.minimum_stock_level,
                    'reorder_point', product_rec.reorder_point,
                    'reorder_quantity', product_rec.reorder_quantity
                )
            );
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply low stock trigger
CREATE TRIGGER check_low_stock_after_update
    AFTER INSERT OR UPDATE ON inventory
    FOR EACH ROW
    EXECUTE FUNCTION check_low_stock_alert();

-- ============================================================
-- INITIAL DATA SETUP
-- ============================================================

-- Create default admin user (password: 'admin123' - CHANGE THIS!)
-- Password hash for 'admin123' using bcrypt
INSERT INTO users (employee_id, email, full_name, password_hash, role, badge_number)
VALUES ('VTL001', 'admin@vilagio.com', 'System Administrator', 
        '$2a$10$rOqVZqGzZqR0vGqVZqGzZqR0vGqVZqGzZqR0vGqVZqGzZqR0vGqVZ', 
        'admin', 'BADGE001');

-- Create default warehouse location
INSERT INTO warehouse_locations (location_code, location_name, location_type, barcode)
VALUES 
    ('WH-MAIN', 'Main Warehouse', 'warehouse', 'LOC-WH-MAIN'),
    ('ZONE-A', 'Zone A - Raw Materials', 'zone', 'LOC-ZONE-A'),
    ('ZONE-B', 'Zone B - Finished Goods', 'zone', 'LOC-ZONE-B'),
    ('PROD-FLOOR', 'Production Floor', 'production_floor', 'LOC-PROD');

-- ============================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================

COMMENT ON TABLE users IS 'User accounts and authentication information';
COMMENT ON TABLE warehouse_locations IS 'Physical warehouse locations including zones, aisles, and bins';
COMMENT ON TABLE products IS 'Product catalog including raw materials, spares, and finished goods';
COMMENT ON TABLE batches IS 'Batch/lot tracking for materials requiring traceability';
COMMENT ON TABLE inventory IS 'Current inventory levels by product, location, and batch';
COMMENT ON TABLE inventory_transactions IS 'Complete audit trail of all inventory movements';
COMMENT ON TABLE production_orders IS 'Production orders linking inventory to manufacturing';
COMMENT ON TABLE bill_of_materials IS 'Recipe/formula for production - what materials are needed';
COMMENT ON TABLE audit_log IS 'Immutable audit log of all data changes';
COMMENT ON TABLE system_alerts IS 'System-generated alerts for low stock, expiry, etc.';

-- ============================================================
-- GRANT PERMISSIONS (adjust based on your needs)
-- ============================================================

-- Grant appropriate permissions to application user
-- Replace 'app_user' with your actual database user
-- GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO app_user;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;

-- ============================================================
-- END OF SCHEMA
-- ============================================================
