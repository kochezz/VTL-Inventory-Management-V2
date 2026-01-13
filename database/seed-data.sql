-- ============================================================
-- Vilagio Inventory Management - Sample Seed Data
-- Water Bottling Operation Test Data
-- ============================================================

-- NOTE: Run this AFTER schema.sql has been executed

BEGIN;

-- ============================================================
-- SAMPLE USERS
-- ============================================================

-- Password for all test users: 'password123'
-- Hash generated with bcrypt rounds=10
INSERT INTO users (employee_id, email, full_name, password_hash, role, badge_number, phone_number, is_active) VALUES
('VTL002', 'warehouse.manager@vilagio.com', 'John Mbogo', '$2a$10$rOqVZqGzZqR0vGqVZqGzZqR0vGqVZqGzZqR0vGqVZqGzZqR0vGqVZ', 'warehouse_manager', 'BADGE002', '+254700123456', true),
('VTL003', 'warehouse.staff1@vilagio.com', 'Mary Wanjiku', '$2a$10$rOqVZqGzZqR0vGqVZqGzZqR0vGqVZqGzZqR0vGqVZqGzZqR0vGqVZ', 'warehouse_staff', 'BADGE003', '+254700123457', true),
('VTL004', 'warehouse.staff2@vilagio.com', 'Peter Ochieng', '$2a$10$rOqVZqGzZqR0vGqVZqGzZqR0vGqVZqGzZqR0vGqVZqGzZqR0vGqVZ', 'warehouse_staff', 'BADGE004', '+254700123458', true),
('VTL005', 'production.manager@vilagio.com', 'Sarah Kimani', '$2a$10$rOqVZqGzZqR0vGqVZqGzZqR0vGqVZqGzZqR0vGqVZqGzZqR0vGqVZ', 'production_manager', 'BADGE005', '+254700123459', true),
('VTL006', 'viewer@vilagio.com', 'James Kariuki', '$2a$10$rOqVZqGzZqR0vGqVZqGzZqR0vGqVZqGzZqR0vGqVZqGzZqR0vGqVZ', 'viewer', 'BADGE006', '+254700123460', true);

-- ============================================================
-- ADDITIONAL WAREHOUSE LOCATIONS
-- ============================================================

-- Add more specific locations to existing zones
INSERT INTO warehouse_locations (location_code, location_name, location_type, parent_location_id, barcode, capacity_cubic_meters) VALUES
-- Zone A subdivisions (Raw Materials)
('A-AISLE-01', 'Aisle 1 - Pre-forms', 'aisle', (SELECT location_id FROM warehouse_locations WHERE location_code = 'ZONE-A'), 'LOC-A-AISLE-01', 50.0),
('A-AISLE-02', 'Aisle 2 - Caps & Closures', 'aisle', (SELECT location_id FROM warehouse_locations WHERE location_code = 'ZONE-A'), 'LOC-A-AISLE-02', 30.0),
('A-AISLE-03', 'Aisle 3 - Labels & Packaging', 'aisle', (SELECT location_id FROM warehouse_locations WHERE location_code = 'ZONE-A'), 'LOC-A-AISLE-03', 40.0),
('A-AISLE-04', 'Aisle 4 - Spares', 'aisle', (SELECT location_id FROM warehouse_locations WHERE location_code = 'ZONE-A'), 'LOC-A-AISLE-04', 60.0),

-- Zone B subdivisions (Finished Goods)
('B-AISLE-01', 'Aisle 1 - 500ml Products', 'aisle', (SELECT location_id FROM warehouse_locations WHERE location_code = 'ZONE-B'), 'LOC-B-AISLE-01', 80.0),
('B-AISLE-02', 'Aisle 2 - 1L Products', 'aisle', (SELECT location_id FROM warehouse_locations WHERE location_code = 'ZONE-B'), 'LOC-B-AISLE-02', 80.0),
('B-AISLE-03', 'Aisle 3 - 5L Products', 'aisle', (SELECT location_id FROM warehouse_locations WHERE location_code = 'ZONE-B'), 'LOC-B-AISLE-03', 100.0),

-- Specific bins in Aisle 1
('A-01-BIN-01', 'Bin A1-01', 'bin', (SELECT location_id FROM warehouse_locations WHERE location_code = 'A-AISLE-01'), 'LOC-A-01-BIN-01', 5.0),
('A-01-BIN-02', 'Bin A1-02', 'bin', (SELECT location_id FROM warehouse_locations WHERE location_code = 'A-AISLE-01'), 'LOC-A-01-BIN-02', 5.0),
('A-01-BIN-03', 'Bin A1-03', 'bin', (SELECT location_id FROM warehouse_locations WHERE location_code = 'A-AISLE-01'), 'LOC-A-01-BIN-03', 5.0);

-- ============================================================
-- SAMPLE PRODUCTS - RAW MATERIALS
-- ============================================================

-- Pre-forms (Bottle blanks for blow molding)
INSERT INTO products (sku, product_name, category_id, description, barcode, base_uom, base_uom_per_case, cases_per_pallet, standard_cost, requires_batch_tracking, requires_expiry_tracking, shelf_life_days, reorder_point, reorder_quantity, minimum_stock_level, maximum_stock_level, safety_stock_level, lead_time_days) VALUES

('PREFORM-500ML-28G', '500ml PET Pre-form 28g', (SELECT category_id FROM product_categories WHERE category_code = 'RAW_PREFORM'), 'PET pre-form for 500ml bottles, 28mm neck finish, 28g weight', 'PREFORM500ML28G', 'piece', 2000, 40, 0.08, true, false, NULL, 50000, 100000, 30000, 200000, 40000, 14),

('PREFORM-1L-45G', '1 Liter PET Pre-form 45g', (SELECT category_id FROM product_categories WHERE category_code = 'RAW_PREFORM'), 'PET pre-form for 1L bottles, 28mm neck finish, 45g weight', 'PREFORM1L45G', 'piece', 1500, 30, 0.12, true, false, NULL, 30000, 60000, 20000, 150000, 30000, 14),

('PREFORM-5L-120G', '5 Liter PET Pre-form 120g', (SELECT category_id FROM product_categories WHERE category_code = 'RAW_PREFORM'), 'PET pre-form for 5L bottles, 48mm neck finish, 120g weight', 'PREFORM5L120G', 'piece', 500, 20, 0.35, true, false, NULL, 10000, 20000, 5000, 50000, 8000, 21),

-- Caps
('CAP-28MM-WHITE', '28mm White Screw Cap', (SELECT category_id FROM product_categories WHERE category_code = 'RAW_CAP'), 'Food-grade PP screw cap, white color, tamper-evident', 'CAP28MMWHITE', 'piece', 5000, 50, 0.02, true, false, NULL, 100000, 200000, 50000, 500000, 80000, 10),

('CAP-28MM-BLUE', '28mm Blue Screw Cap', (SELECT category_id FROM product_categories WHERE category_code = 'RAW_CAP'), 'Food-grade PP screw cap, blue color, tamper-evident', 'CAP28MMBLUE', 'piece', 5000, 50, 0.02, true, false, NULL, 50000, 100000, 30000, 300000, 50000, 10),

('CAP-48MM-WHITE', '48mm White Screw Cap', (SELECT category_id FROM product_categories WHERE category_code = 'RAW_CAP'), 'Food-grade PP screw cap for 5L bottles, white, tamper-evident', 'CAP48MMWHITE', 'piece', 2000, 40, 0.05, true, false, NULL, 20000, 40000, 10000, 100000, 15000, 10),

-- Labels
('LABEL-500ML-DRIP', 'Drip 500ml Label - Shrink Sleeve', (SELECT category_id FROM product_categories WHERE category_code = 'RAW_LABEL'), 'PET-G shrink sleeve label for 500ml Drip bottles', 'LABEL500MLDRIP', 'piece', 10000, 80, 0.015, true, false, NULL, 80000, 150000, 50000, 400000, 70000, 14),

('LABEL-1L-DRIP', 'Drip 1L Label - Shrink Sleeve', (SELECT category_id FROM product_categories WHERE category_code = 'RAW_LABEL'), 'PET-G shrink sleeve label for 1L Drip bottles', 'LABEL1LDRIP', 'piece', 10000, 80, 0.02, true, false, NULL, 50000, 100000, 30000, 300000, 50000, 14),

('LABEL-5L-DRIP', 'Drip 5L Label - Adhesive', (SELECT category_id FROM product_categories WHERE category_code = 'RAW_LABEL'), 'Adhesive label for 5L Drip bottles', 'LABEL5LDRIP', 'piece', 5000, 50, 0.03, true, false, NULL, 20000, 40000, 10000, 150000, 15000, 14),

-- Packaging Materials
('CASE-500ML-24', '500ml Bottle Case (24-pack)', (SELECT category_id FROM product_categories WHERE category_code = 'RAW_PACKAGING'), 'Corrugated cardboard case for 24x500ml bottles', 'CASE500ML24', 'piece', 200, 10, 0.50, false, false, NULL, 5000, 10000, 3000, 30000, 5000, 7),

('CASE-1L-12', '1L Bottle Case (12-pack)', (SELECT category_id FROM product_categories WHERE category_code = 'RAW_PACKAGING'), 'Corrugated cardboard case for 12x1L bottles', 'CASE1L12', 'piece', 200, 10, 0.60, false, false, NULL, 3000, 6000, 2000, 20000, 3000, 7),

('CASE-5L-2', '5L Bottle Case (2-pack)', (SELECT category_id FROM product_categories WHERE category_code = 'RAW_PACKAGING'), 'Corrugated cardboard case for 2x5L bottles', 'CASE5L2', 'piece', 150, 8, 0.80, false, false, NULL, 2000, 4000, 1000, 15000, 2000, 7),

('PALLET-WOOD-STD', 'Standard Wood Pallet', (SELECT category_id FROM product_categories WHERE category_code = 'RAW_PACKAGING'), 'Standard Euro pallet 1200x800mm', 'PALLETWOODSTD', 'piece', 1, 1, 8.00, false, false, NULL, 50, 100, 30, 300, 50, 7),

('STRETCH-FILM-500M', 'Stretch Film Roll 500m', (SELECT category_id FROM product_categories WHERE category_code = 'RAW_PACKAGING'), 'LLDPE stretch wrap film, 500m x 500mm, 23 micron', 'STRETCHFILM500M', 'roll', 6, 1, 12.00, false, false, NULL, 30, 50, 20, 150, 30, 7);

-- Water Line Spares
INSERT INTO products (sku, product_name, category_id, description, barcode, base_uom, standard_cost, requires_batch_tracking, reorder_point, reorder_quantity, minimum_stock_level, maximum_stock_level, safety_stock_level, lead_time_days, specification_details) VALUES

('SPARE-FILTER-10MICRON', '10 Micron Sediment Filter Cartridge', (SELECT category_id FROM product_categories WHERE category_code = 'SPARE_WATERLINE'), 'Pleated sediment filter, 10" length, 10 micron rating', 'FILTER10MICRON', 'piece', 25.00, false, 10, 20, 5, 50, 8, 14, '{"length": "10 inch", "micron_rating": 10, "max_flow_rate": "5 GPM"}'),

('SPARE-FILTER-CARBON', 'Activated Carbon Filter Block', (SELECT category_id FROM product_categories WHERE category_code = 'SPARE_WATERLINE'), 'GAC carbon block filter for chlorine/taste removal', 'FILTERCARBON', 'piece', 35.00, false, 10, 20, 5, 50, 8, 14, '{"length": "10 inch", "type": "activated_carbon"}'),

('SPARE-UV-LAMP-55W', 'UV Sterilization Lamp 55W', (SELECT category_id FROM product_categories WHERE category_code = 'SPARE_WATERLINE'), 'UV-C germicidal lamp for water sterilization', 'UVLAMP55W', 'piece', 120.00, true, 5, 10, 3, 20, 5, 21, '{"wattage": "55W", "life_hours": 9000}'),

('SPARE-PUMP-SEAL', 'High Pressure Pump Seal Kit', (SELECT category_id FROM product_categories WHERE category_code = 'SPARE_WATERLINE'), 'Seal kit for high pressure water pump', 'PUMPSEALKIT', 'kit', 85.00, false, 5, 10, 3, 20, 5, 21, '{"compatible_models": ["HP100", "HP150"]}'),

('SPARE-SOLENOID-VALVE', 'Solenoid Valve 24VDC', (SELECT category_id FROM product_categories WHERE category_code = 'SPARE_WATERLINE'), '2-way solenoid valve for water control', 'SOLENOIDVALVE24V', 'piece', 45.00, false, 8, 15, 4, 30, 6, 14, '{"voltage": "24VDC", "port_size": "1/2 inch"}');

-- Blow Molder Spares
INSERT INTO products (sku, product_name, category_id, description, barcode, base_uom, standard_cost, requires_batch_tracking, reorder_point, reorder_quantity, minimum_stock_level, maximum_stock_level, safety_stock_level, lead_time_days) VALUES

('SPARE-MOLD-500ML', '500ml Bottle Mold (Complete Set)', (SELECT category_id FROM product_categories WHERE category_code = 'SPARE_BLOWER'), 'Complete bottle mold for 500ml round bottle', 'MOLD500ML', 'set', 2500.00, false, 1, 2, 1, 3, 1, 60),

('SPARE-STRETCH-ROD', 'Stretch Rod Assembly', (SELECT category_id FROM product_categories WHERE category_code = 'SPARE_BLOWER'), 'Stretch rod for blow molding machine', 'STRETCHROD', 'piece', 150.00, false, 3, 5, 2, 10, 3, 30),

('SPARE-AIR-VALVE', 'High Pressure Air Valve', (SELECT category_id FROM product_categories WHERE category_code = 'SPARE_BLOWER'), 'Pneumatic valve for blow molder', 'AIRVALVE', 'piece', 200.00, false, 3, 5, 2, 10, 3, 30);

-- ============================================================
-- SAMPLE BATCHES
-- ============================================================

-- Create batches for items requiring batch tracking
INSERT INTO batches (batch_number, product_id, received_date, manufacture_date, expiry_date, supplier_name, supplier_batch_number, qc_status, initial_quantity, current_quantity, uom, status) VALUES

-- Pre-form batches
('BATCH-PREFORM500-001', (SELECT product_id FROM products WHERE sku = 'PREFORM-500ML-28G'), '2026-01-01', '2025-12-15', NULL, 'PET Manufacturing Ltd', 'PET-500-2025-345', 'approved', 80000, 80000, 'piece', 'active'),
('BATCH-PREFORM500-002', (SELECT product_id FROM products WHERE sku = 'PREFORM-500ML-28G'), '2026-01-08', '2025-12-28', NULL, 'PET Manufacturing Ltd', 'PET-500-2025-362', 'approved', 80000, 80000, 'piece', 'active'),

('BATCH-PREFORM1L-001', (SELECT product_id FROM products WHERE sku = 'PREFORM-1L-45G'), '2025-12-20', '2025-12-10', NULL, 'PET Manufacturing Ltd', 'PET-1L-2025-344', 'approved', 45000, 45000, 'piece', 'active'),

-- Cap batches
('BATCH-CAP28W-001', (SELECT product_id FROM products WHERE sku = 'CAP-28MM-WHITE'), '2026-01-05', '2025-12-20', NULL, 'Closure Systems Inc', 'CAP-28W-2025-354', 'approved', 200000, 200000, 'piece', 'active'),
('BATCH-CAP28B-001', (SELECT product_id FROM products WHERE sku = 'CAP-28MM-BLUE'), '2026-01-05', '2025-12-20', NULL, 'Closure Systems Inc', 'CAP-28B-2025-354', 'approved', 100000, 100000, 'piece', 'active'),

-- Label batches
('BATCH-LABEL500-001', (SELECT product_id FROM products WHERE sku = 'LABEL-500ML-DRIP'), '2026-01-03', '2025-12-28', NULL, 'Print Solutions Ltd', 'DRIP-500-2025-363', 'approved', 150000, 150000, 'piece', 'active'),
('BATCH-LABEL1L-001', (SELECT product_id FROM products WHERE sku = 'LABEL-1L-DRIP'), '2026-01-03', '2025-12-28', NULL, 'Print Solutions Ltd', 'DRIP-1L-2025-363', 'approved', 80000, 80000, 'piece', 'active'),

-- UV Lamp batch (has shelf life)
('BATCH-UVLAMP-001', (SELECT product_id FROM products WHERE sku = 'SPARE-UV-LAMP-55W'), '2026-01-10', '2025-11-15', '2028-11-15', 'UV Tech Systems', 'UV-55W-2025-319', 'approved', 8, 8, 'piece', 'active');

-- ============================================================
-- SAMPLE INVENTORY
-- ============================================================

-- Pre-forms inventory
INSERT INTO inventory (product_id, location_id, batch_id, quantity_on_hand, uom) VALUES
((SELECT product_id FROM products WHERE sku = 'PREFORM-500ML-28G'), 
 (SELECT location_id FROM warehouse_locations WHERE location_code = 'A-01-BIN-01'),
 (SELECT batch_id FROM batches WHERE batch_number = 'BATCH-PREFORM500-001'),
 80000, 'piece'),

((SELECT product_id FROM products WHERE sku = 'PREFORM-500ML-28G'), 
 (SELECT location_id FROM warehouse_locations WHERE location_code = 'A-01-BIN-02'),
 (SELECT batch_id FROM batches WHERE batch_number = 'BATCH-PREFORM500-002'),
 80000, 'piece'),

((SELECT product_id FROM products WHERE sku = 'PREFORM-1L-45G'), 
 (SELECT location_id FROM warehouse_locations WHERE location_code = 'A-01-BIN-03'),
 (SELECT batch_id FROM batches WHERE batch_number = 'BATCH-PREFORM1L-001'),
 45000, 'piece');

-- Caps inventory
INSERT INTO inventory (product_id, location_id, batch_id, quantity_on_hand, uom) VALUES
((SELECT product_id FROM products WHERE sku = 'CAP-28MM-WHITE'), 
 (SELECT location_id FROM warehouse_locations WHERE location_code = 'A-AISLE-02'),
 (SELECT batch_id FROM batches WHERE batch_number = 'BATCH-CAP28W-001'),
 200000, 'piece'),

((SELECT product_id FROM products WHERE sku = 'CAP-28MM-BLUE'), 
 (SELECT location_id FROM warehouse_locations WHERE location_code = 'A-AISLE-02'),
 (SELECT batch_id FROM batches WHERE batch_number = 'BATCH-CAP28B-001'),
 100000, 'piece');

-- Labels inventory
INSERT INTO inventory (product_id, location_id, batch_id, quantity_on_hand, uom) VALUES
((SELECT product_id FROM products WHERE sku = 'LABEL-500ML-DRIP'), 
 (SELECT location_id FROM warehouse_locations WHERE location_code = 'A-AISLE-03'),
 (SELECT batch_id FROM batches WHERE batch_number = 'BATCH-LABEL500-001'),
 150000, 'piece'),

((SELECT product_id FROM products WHERE sku = 'LABEL-1L-DRIP'), 
 (SELECT location_id FROM warehouse_locations WHERE location_code = 'A-AISLE-03'),
 (SELECT batch_id FROM batches WHERE batch_number = 'BATCH-LABEL1L-001'),
 80000, 'piece');

-- Packaging inventory (no batch tracking)
INSERT INTO inventory (product_id, location_id, batch_id, quantity_on_hand, uom) VALUES
((SELECT product_id FROM products WHERE sku = 'CASE-500ML-24'), 
 (SELECT location_id FROM warehouse_locations WHERE location_code = 'A-AISLE-03'),
 NULL, 8000, 'piece'),

((SELECT product_id FROM products WHERE sku = 'CASE-1L-12'), 
 (SELECT location_id FROM warehouse_locations WHERE location_code = 'A-AISLE-03'),
 NULL, 5000, 'piece'),

((SELECT product_id FROM products WHERE sku = 'PALLET-WOOD-STD'), 
 (SELECT location_id FROM warehouse_locations WHERE location_code = 'A-AISLE-03'),
 NULL, 100, 'piece'),

((SELECT product_id FROM products WHERE sku = 'STRETCH-FILM-500M'), 
 (SELECT location_id FROM warehouse_locations WHERE location_code = 'A-AISLE-03'),
 NULL, 45, 'roll');

-- Spares inventory
INSERT INTO inventory (product_id, location_id, batch_id, quantity_on_hand, uom) VALUES
((SELECT product_id FROM products WHERE sku = 'SPARE-FILTER-10MICRON'), 
 (SELECT location_id FROM warehouse_locations WHERE location_code = 'A-AISLE-04'),
 NULL, 15, 'piece'),

((SELECT product_id FROM products WHERE sku = 'SPARE-FILTER-CARBON'), 
 (SELECT location_id FROM warehouse_locations WHERE location_code = 'A-AISLE-04'),
 NULL, 12, 'piece'),

((SELECT product_id FROM products WHERE sku = 'SPARE-UV-LAMP-55W'), 
 (SELECT location_id FROM warehouse_locations WHERE location_code = 'A-AISLE-04'),
 (SELECT batch_id FROM batches WHERE batch_number = 'BATCH-UVLAMP-001'),
 8, 'piece'),

((SELECT product_id FROM products WHERE sku = 'SPARE-PUMP-SEAL'), 
 (SELECT location_id FROM warehouse_locations WHERE location_code = 'A-AISLE-04'),
 NULL, 6, 'kit'),

((SELECT product_id FROM products WHERE sku = 'SPARE-SOLENOID-VALVE'), 
 (SELECT location_id FROM warehouse_locations WHERE location_code = 'A-AISLE-04'),
 NULL, 10, 'piece'),

((SELECT product_id FROM products WHERE sku = 'SPARE-MOLD-500ML'), 
 (SELECT location_id FROM warehouse_locations WHERE location_code = 'A-AISLE-04'),
 NULL, 2, 'set'),

((SELECT product_id FROM products WHERE sku = 'SPARE-STRETCH-ROD'), 
 (SELECT location_id FROM warehouse_locations WHERE location_code = 'A-AISLE-04'),
 NULL, 4, 'piece'),

((SELECT product_id FROM products WHERE sku = 'SPARE-AIR-VALVE'), 
 (SELECT location_id FROM warehouse_locations WHERE location_code = 'A-AISLE-04'),
 NULL, 3, 'piece');

-- ============================================================
-- SAMPLE TRANSACTIONS
-- ============================================================

-- Sample receipt transaction
INSERT INTO inventory_transactions (
    transaction_number, transaction_type, product_id, batch_id, 
    to_location_id, quantity, uom, performed_by, unit_cost, total_cost,
    reference_document_type, reference_document_number, notes
) VALUES
('RCV-20260101-0001', 'receipt',
 (SELECT product_id FROM products WHERE sku = 'PREFORM-500ML-28G'),
 (SELECT batch_id FROM batches WHERE batch_number = 'BATCH-PREFORM500-001'),
 (SELECT location_id FROM warehouse_locations WHERE location_code = 'A-01-BIN-01'),
 80000, 'piece',
 (SELECT user_id FROM users WHERE employee_id = 'VTL003'),
 0.08, 6400.00,
 'PO', 'PO-2025-1234',
 'Received 80,000 pre-forms from PET Manufacturing Ltd');

-- Sample issue transaction
INSERT INTO inventory_transactions (
    transaction_number, transaction_type, product_id, batch_id, 
    from_location_id, quantity, uom, performed_by,
    reference_document_type, reference_document_number, notes
) VALUES
('ISS-20260110-0001', 'issue',
 (SELECT product_id FROM products WHERE sku = 'PREFORM-500ML-28G'),
 (SELECT batch_id FROM batches WHERE batch_number = 'BATCH-PREFORM500-001'),
 (SELECT location_id FROM warehouse_locations WHERE location_code = 'A-01-BIN-01'),
 5000, 'piece',
 (SELECT user_id FROM users WHERE employee_id = 'VTL004'),
 'Production Order', 'PROD-001',
 'Issued 5,000 pre-forms for production');

-- ============================================================
-- SAMPLE PRODUCTION ORDER & BOM
-- ============================================================

-- Create a finished product
INSERT INTO products (sku, product_name, category_id, description, barcode, base_uom, base_uom_per_case, cases_per_pallet, requires_batch_tracking) VALUES
('BOTTLE-DRIP-500ML', 'Drip 500ml Bottled Water (Case)', (SELECT category_id FROM product_categories WHERE category_code = 'FINISHED_PRODUCT'), 'Case of 24 x 500ml Drip bottled water', 'BOTTLE500MLCASE', 'case', 24, 80, true);

-- Create bill of materials for 1 case (24 bottles)
INSERT INTO bill_of_materials (parent_product_id, component_product_id, quantity_required, uom, scrap_factor) VALUES
-- Need 24 pre-forms per case
((SELECT product_id FROM products WHERE sku = 'BOTTLE-DRIP-500ML'),
 (SELECT product_id FROM products WHERE sku = 'PREFORM-500ML-28G'),
 24, 'piece', 2.0), -- 2% scrap factor

-- Need 24 caps per case
((SELECT product_id FROM products WHERE sku = 'BOTTLE-DRIP-500ML'),
 (SELECT product_id FROM products WHERE sku = 'CAP-28MM-WHITE'),
 24, 'piece', 1.0),

-- Need 24 labels per case
((SELECT product_id FROM products WHERE sku = 'BOTTLE-DRIP-500ML'),
 (SELECT product_id FROM products WHERE sku = 'LABEL-500ML-DRIP'),
 24, 'piece', 1.5),

-- Need 1 case per case :)
((SELECT product_id FROM products WHERE sku = 'BOTTLE-DRIP-500ML'),
 (SELECT product_id FROM products WHERE sku = 'CASE-500ML-24'),
 1, 'piece', 0);

-- Create sample production order
INSERT INTO production_orders (
    order_number, order_date, product_id, planned_quantity, uom,
    status, scheduled_start_date, scheduled_end_date, created_by, production_line
) VALUES
('PROD-20260113-001', '2026-01-13',
 (SELECT product_id FROM products WHERE sku = 'BOTTLE-DRIP-500ML'),
 500, 'case', 'planned', '2026-01-14', '2026-01-14',
 (SELECT user_id FROM users WHERE employee_id = 'VTL005'),
 'Line 1 - 500ml');

-- ============================================================
-- VERIFICATION QUERIES
-- ============================================================

-- Check what was created (commented out, uncomment to run)

-- SELECT 'Users Created' as check_type, COUNT(*) as count FROM users;
-- SELECT 'Locations Created' as check_type, COUNT(*) as count FROM warehouse_locations;
-- SELECT 'Products Created' as check_type, COUNT(*) as count FROM products;
-- SELECT 'Batches Created' as check_type, COUNT(*) as count FROM batches;
-- SELECT 'Inventory Records' as check_type, COUNT(*) as count FROM inventory;
-- SELECT 'Transactions' as check_type, COUNT(*) as count FROM inventory_transactions;
-- SELECT 'Production Orders' as check_type, COUNT(*) as count FROM production_orders;
-- SELECT 'BOM Items' as check_type, COUNT(*) as count FROM bill_of_materials;

COMMIT;

-- ============================================================
-- NOTES
-- ============================================================

-- To reset and reload:
-- 1. Drop all data: TRUNCATE users, products, inventory, ... CASCADE;
-- 2. Re-run schema.sql
-- 3. Re-run this seed-data.sql

-- Test login credentials (password: 'password123'):
-- - admin@vilagio.com (admin)
-- - warehouse.manager@vilagio.com (warehouse_manager)
-- - warehouse.staff1@vilagio.com (warehouse_staff)
-- - warehouse.staff2@vilagio.com (warehouse_staff)
-- - production.manager@vilagio.com (production_manager)
-- - viewer@vilagio.com (viewer)
