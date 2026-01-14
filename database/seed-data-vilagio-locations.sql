-- ============================================================
-- Vilagio Inventory Management - Warehouse Locations (FIXED)
-- Matches actual schema.sql structure
-- Load this BEFORE seed-data-vilagio-quantities.sql
-- ============================================================

BEGIN;

-- ============================================================
-- WAREHOUSE LOCATIONS
-- ============================================================

-- Main warehouse
INSERT INTO warehouse_locations (location_code, location_name, location_type, parent_location_id, is_active, capacity_cubic_meters, barcode) VALUES
('WH-MAIN', 'Main Warehouse - Vilagio Drip Water', 'warehouse', NULL, true, 5000.00, 'WH-MAIN');

-- Zones
INSERT INTO warehouse_locations (location_code, location_name, location_type, parent_location_id, is_active, capacity_cubic_meters, barcode) VALUES
('ZONE-A', 'Storage Zone A - Raw Materials', 'zone', 
 (SELECT location_id FROM warehouse_locations WHERE location_code = 'WH-MAIN'),
 true, 2500.00, 'ZONE-A'),

('ZONE-B', 'Storage Zone B - Finished Goods', 'zone',
 (SELECT location_id FROM warehouse_locations WHERE location_code = 'WH-MAIN'),
 true, 1500.00, 'ZONE-B');

-- Aisles in Zone A (Raw Materials & Spares)
INSERT INTO warehouse_locations (location_code, location_name, location_type, parent_location_id, is_active, capacity_cubic_meters, barcode) VALUES
('A-AISLE-01', 'Aisle A1 - Pre-forms & Large Items', 'aisle',
 (SELECT location_id FROM warehouse_locations WHERE location_code = 'ZONE-A'),
 true, 400.00, 'A-AISLE-01'),

('A-AISLE-02', 'Aisle A2 - Caps & Closures', 'aisle',
 (SELECT location_id FROM warehouse_locations WHERE location_code = 'ZONE-A'),
 true, 300.00, 'A-AISLE-02'),

('A-AISLE-03', 'Aisle A3 - Labels & Films', 'aisle',
 (SELECT location_id FROM warehouse_locations WHERE location_code = 'ZONE-A'),
 true, 350.00, 'A-AISLE-03'),

('A-AISLE-04', 'Aisle A4 - Molds & Spare Parts', 'aisle',
 (SELECT location_id FROM warehouse_locations WHERE location_code = 'ZONE-A'),
 true, 250.00, 'A-AISLE-04');

-- Bins in Aisle A1 for Pre-forms
INSERT INTO warehouse_locations (location_code, location_name, location_type, parent_location_id, is_active, barcode) VALUES
('A-01-BIN-01', 'Bin A1-01 - 500ML Pre-forms 18g', 'bin',
 (SELECT location_id FROM warehouse_locations WHERE location_code = 'A-AISLE-01'),
 true, 'A-01-BIN-01'),

('A-01-BIN-02', 'Bin A1-02 - 750ML Pre-forms 25g', 'bin',
 (SELECT location_id FROM warehouse_locations WHERE location_code = 'A-AISLE-01'),
 true, 'A-01-BIN-02'),

('A-01-BIN-03', 'Bin A1-03 - 500ML Pre-forms 23g', 'bin',
 (SELECT location_id FROM warehouse_locations WHERE location_code = 'A-AISLE-01'),
 true, 'A-01-BIN-03');

-- Production floor location (FIXED: was 'production', now 'production_floor')
INSERT INTO warehouse_locations (location_code, location_name, location_type, parent_location_id, is_active, capacity_cubic_meters, barcode) VALUES
('PROD-FLOOR', 'Production Floor', 'production_floor',
 (SELECT location_id FROM warehouse_locations WHERE location_code = 'WH-MAIN'),
 true, 500.00, 'PROD-FLOOR');

-- QC Hold area (FIXED: was 'quality_control', now 'quarantine')
INSERT INTO warehouse_locations (location_code, location_name, location_type, parent_location_id, is_active, barcode) VALUES
('QC-HOLD', 'QC Hold Area', 'quarantine',
 (SELECT location_id FROM warehouse_locations WHERE location_code = 'WH-MAIN'),
 true, 'QC-HOLD');

COMMIT;

-- ============================================================
-- VERIFICATION
-- ============================================================

-- Check locations created
-- SELECT 
--     location_code,
--     location_name,
--     location_type,
--     is_active
-- FROM warehouse_locations
-- ORDER BY location_code;

-- Should show 14 locations total:
-- 1 warehouse, 2 zones, 4 aisles, 3 bins, 1 production_floor, 1 quarantine
