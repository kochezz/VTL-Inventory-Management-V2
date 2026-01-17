-- ============================================================
-- Vilagio Inventory Management - ACTUAL STOCK QUANTITIES
-- Load actual inventory from January 2026 inventory count
-- Run this AFTER seed-data-vilagio-actual.sql
-- ============================================================

BEGIN;

-- ============================================================
-- CREATE BATCHES FOR ITEMS REQUIRING TRACKING
-- ============================================================

INSERT INTO batches (batch_number, product_id, received_date, manufacture_date, supplier_name, qc_status, initial_quantity, current_quantity, uom, status) VALUES

-- 500ML 18g Pre-forms - Current Stock
('BATCH-PF500-18G-001', 
 (SELECT product_id FROM products WHERE sku = 'PREFORM-500ML-18G'),
 '2026-01-05', '2025-12-15', 'PET Manufacturing Ltd',
 'approved', 160000, 160000, 'piece', 'active'),

-- 750ML 25g Pre-forms - Current Stock
('BATCH-PF750-25G-001',
 (SELECT product_id FROM products WHERE sku = 'PREFORM-750ML-25G'),
 '2026-01-05', '2025-12-15', 'PET Manufacturing Ltd',
 'approved', 160000, 160000, 'piece', 'active'),

-- 500ML 23g Pre-forms - Current Stock
('BATCH-PF500-23G-001',
 (SELECT product_id FROM products WHERE sku = 'PREFORM-500ML-23G'),
 '2026-01-06', '2025-12-20', 'PET Manufacturing Ltd',
 'approved', 80000, 80000, 'piece', 'active'),

-- Generic Bottle Caps - Current Stock
('BATCH-CAP-GEN-001',
 (SELECT product_id FROM products WHERE sku = 'CAP-GENERIC'),
 '2026-01-03', '2025-12-18', 'Closure Systems Inc',
 'approved', 400000, 400000, 'piece', 'active'),

-- 5 Gallon Pre-forms
('BATCH-PF5GAL-001',
 (SELECT product_id FROM products WHERE sku = 'PREFORM-5GAL'),
 '2026-01-04', '2025-12-10', 'PET Manufacturing Ltd',
 'approved', 1200, 1200, 'piece', 'active'),

-- 5 Gallon Caps
('BATCH-CAP5GAL-001',
 (SELECT product_id FROM products WHERE sku = 'CAP-5GALLON'),
 '2026-01-03', '2025-12-18', 'Closure Systems Inc',
 'approved', 40000, 40000, 'piece', 'active'),

-- PVC Labels (batch tracking for quality control)
('BATCH-LBL-500ML-PVC-001',
 (SELECT product_id FROM products WHERE sku = 'LABEL-500ML-PVC-SLEEVE'),
 '2026-01-07', '2025-12-28', 'Print Solutions Ltd',
 'approved', 800, 800, 'kg', 'active'),

('BATCH-LBL-750ML-PVC-001',
 (SELECT product_id FROM products WHERE sku = 'LABEL-750ML-PVC-SLEEVE'),
 '2026-01-07', '2025-12-28', 'Print Solutions Ltd',
 'approved', 800, 800, 'kg', 'active'),

('BATCH-LBL-CAP-PVC-001',
 (SELECT product_id FROM products WHERE sku = 'LABEL-CAP-PVC-SLEEVE'),
 '2026-01-07', '2025-12-28', 'Print Solutions Ltd',
 'approved', 400, 400, 'kg', 'active'),

('BATCH-LBL-5GALCAP-PVC-001',
 (SELECT product_id FROM products WHERE sku = 'LABEL-5GAL-CAP-PVC'),
 '2026-01-07', '2025-12-28', 'Print Solutions Ltd',
 'approved', 400, 400, 'kg', 'active'),

-- Sticker Labels
('BATCH-LBL-500ML-STK-001',
 (SELECT product_id FROM products WHERE sku = 'LABEL-500ML-STICKER'),
 '2026-01-06', '2025-12-25', 'Print Solutions Ltd',
 'approved', 80000, 80000, 'piece', 'active'),

('BATCH-LBL-5GAL-STK-001',
 (SELECT product_id FROM products WHERE sku = 'LABEL-5GAL-STICKER'),
 '2026-01-06', '2025-12-25', 'Print Solutions Ltd',
 'approved', 40000, 40000, 'piece', 'active');

-- ============================================================
-- LOAD ACTUAL INVENTORY QUANTITIES
-- ============================================================

-- Pre-forms - 500ML 18g (160,000 pieces)
INSERT INTO inventory (product_id, location_id, batch_id, quantity_on_hand, uom, last_counted_date, last_counted_by) VALUES
((SELECT product_id FROM products WHERE sku = 'PREFORM-500ML-18G'),
 (SELECT location_id FROM warehouse_locations WHERE location_code = 'A-01-BIN-01'),
 (SELECT batch_id FROM batches WHERE batch_number = 'BATCH-PF500-18G-001'),
 160000, 'piece', '2026-01-13', (SELECT user_id FROM users WHERE employee_id = 'VTL001'));

-- Pre-forms - 750ML 25g (160,000 pieces)
INSERT INTO inventory (product_id, location_id, batch_id, quantity_on_hand, uom, last_counted_date, last_counted_by) VALUES
((SELECT product_id FROM products WHERE sku = 'PREFORM-750ML-25G'),
 (SELECT location_id FROM warehouse_locations WHERE location_code = 'A-01-BIN-02'),
 (SELECT batch_id FROM batches WHERE batch_number = 'BATCH-PF750-25G-001'),
 160000, 'piece', '2026-01-13', (SELECT user_id FROM users WHERE employee_id = 'VTL001'));

-- Pre-forms - 500ML 23g (80,000 pieces)
INSERT INTO inventory (product_id, location_id, batch_id, quantity_on_hand, uom, last_counted_date, last_counted_by) VALUES
((SELECT product_id FROM products WHERE sku = 'PREFORM-500ML-23G'),
 (SELECT location_id FROM warehouse_locations WHERE location_code = 'A-01-BIN-03'),
 (SELECT batch_id FROM batches WHERE batch_number = 'BATCH-PF500-23G-001'),
 80000, 'piece', '2026-01-13', (SELECT user_id FROM users WHERE employee_id = 'VTL001'));

-- Bottle Caps - Generic (400,000 pieces)
INSERT INTO inventory (product_id, location_id, batch_id, quantity_on_hand, uom, last_counted_date, last_counted_by) VALUES
((SELECT product_id FROM products WHERE sku = 'CAP-GENERIC'),
 (SELECT location_id FROM warehouse_locations WHERE location_code = 'A-AISLE-02'),
 (SELECT batch_id FROM batches WHERE batch_number = 'BATCH-CAP-GEN-001'),
 400000, 'piece', '2026-01-13', (SELECT user_id FROM users WHERE employee_id = 'VTL001'));

-- PVC Sleeve Labels - 500ML (800 kg)
INSERT INTO inventory (product_id, location_id, batch_id, quantity_on_hand, uom, last_counted_date, last_counted_by) VALUES
((SELECT product_id FROM products WHERE sku = 'LABEL-500ML-PVC-SLEEVE'),
 (SELECT location_id FROM warehouse_locations WHERE location_code = 'A-AISLE-03'),
 (SELECT batch_id FROM batches WHERE batch_number = 'BATCH-LBL-500ML-PVC-001'),
 800, 'kg', '2026-01-13', (SELECT user_id FROM users WHERE employee_id = 'VTL001'));

-- Label Mold - 500ML (1 set)
INSERT INTO inventory (product_id, location_id, batch_id, quantity_on_hand, uom, last_counted_date, last_counted_by) VALUES
((SELECT product_id FROM products WHERE sku = 'MOLD-LABEL-500ML'),
 (SELECT location_id FROM warehouse_locations WHERE location_code = 'A-AISLE-04'),
 NULL, -- Molds don't require batch tracking
 1, 'set', '2026-01-13', (SELECT user_id FROM users WHERE employee_id = 'VTL001'));

-- PVC Sleeve Labels - 750ML (800 kg)
INSERT INTO inventory (product_id, location_id, batch_id, quantity_on_hand, uom, last_counted_date, last_counted_by) VALUES
((SELECT product_id FROM products WHERE sku = 'LABEL-750ML-PVC-SLEEVE'),
 (SELECT location_id FROM warehouse_locations WHERE location_code = 'A-AISLE-03'),
 (SELECT batch_id FROM batches WHERE batch_number = 'BATCH-LBL-750ML-PVC-001'),
 800, 'kg', '2026-01-13', (SELECT user_id FROM users WHERE employee_id = 'VTL001'));

-- Label Mold - 750ML (1 set)
INSERT INTO inventory (product_id, location_id, batch_id, quantity_on_hand, uom, last_counted_date, last_counted_by) VALUES
((SELECT product_id FROM products WHERE sku = 'MOLD-LABEL-750ML'),
 (SELECT location_id FROM warehouse_locations WHERE location_code = 'A-AISLE-04'),
 NULL,
 1, 'set', '2026-01-13', (SELECT user_id FROM users WHERE employee_id = 'VTL001'));

-- PVC Sleeve Labels - Cap (400 kg)
INSERT INTO inventory (product_id, location_id, batch_id, quantity_on_hand, uom, last_counted_date, last_counted_by) VALUES
((SELECT product_id FROM products WHERE sku = 'LABEL-CAP-PVC-SLEEVE'),
 (SELECT location_id FROM warehouse_locations WHERE location_code = 'A-AISLE-03'),
 (SELECT batch_id FROM batches WHERE batch_number = 'BATCH-LBL-CAP-PVC-001'),
 400, 'kg', '2026-01-13', (SELECT user_id FROM users WHERE employee_id = 'VTL001'));

-- Label Mold - Cap (1 set)
INSERT INTO inventory (product_id, location_id, batch_id, quantity_on_hand, uom, last_counted_date, last_counted_by) VALUES
((SELECT product_id FROM products WHERE sku = 'MOLD-LABEL-CAP'),
 (SELECT location_id FROM warehouse_locations WHERE location_code = 'A-AISLE-04'),
 NULL,
 1, 'set', '2026-01-13', (SELECT user_id FROM users WHERE employee_id = 'VTL001'));

-- Glue Sticker Labels - 500ML (80,000 pieces)
INSERT INTO inventory (product_id, location_id, batch_id, quantity_on_hand, uom, last_counted_date, last_counted_by) VALUES
((SELECT product_id FROM products WHERE sku = 'LABEL-500ML-STICKER'),
 (SELECT location_id FROM warehouse_locations WHERE location_code = 'A-AISLE-03'),
 (SELECT batch_id FROM batches WHERE batch_number = 'BATCH-LBL-500ML-STK-001'),
 80000, 'piece', '2026-01-13', (SELECT user_id FROM users WHERE employee_id = 'VTL001'));

-- Shrink Film (1,600 kg)
INSERT INTO inventory (product_id, location_id, batch_id, quantity_on_hand, uom, last_counted_date, last_counted_by) VALUES
((SELECT product_id FROM products WHERE sku = 'FILM-SHRINK'),
 (SELECT location_id FROM warehouse_locations WHERE location_code = 'A-AISLE-03'),
 NULL,
 1600, 'kg', '2026-01-13', (SELECT user_id FROM users WHERE employee_id = 'VTL001'));

-- 5 Gallon Pre-forms (1,200 pieces)
INSERT INTO inventory (product_id, location_id, batch_id, quantity_on_hand, uom, last_counted_date, last_counted_by) VALUES
((SELECT product_id FROM products WHERE sku = 'PREFORM-5GAL'),
 (SELECT location_id FROM warehouse_locations WHERE location_code = 'A-AISLE-01'),
 (SELECT batch_id FROM batches WHERE batch_number = 'BATCH-PF5GAL-001'),
 1200, 'piece', '2026-01-13', (SELECT user_id FROM users WHERE employee_id = 'VTL001'));

-- 5 Gallon Caps (40,000 pieces)
INSERT INTO inventory (product_id, location_id, batch_id, quantity_on_hand, uom, last_counted_date, last_counted_by) VALUES
((SELECT product_id FROM products WHERE sku = 'CAP-5GALLON'),
 (SELECT location_id FROM warehouse_locations WHERE location_code = 'A-AISLE-02'),
 (SELECT batch_id FROM batches WHERE batch_number = 'BATCH-CAP5GAL-001'),
 40000, 'piece', '2026-01-13', (SELECT user_id FROM users WHERE employee_id = 'VTL001'));

-- Glue Sticker Labels - 5 Gallon (40,000 pieces)
INSERT INTO inventory (product_id, location_id, batch_id, quantity_on_hand, uom, last_counted_date, last_counted_by) VALUES
((SELECT product_id FROM products WHERE sku = 'LABEL-5GAL-STICKER'),
 (SELECT location_id FROM warehouse_locations WHERE location_code = 'A-AISLE-03'),
 (SELECT batch_id FROM batches WHERE batch_number = 'BATCH-LBL-5GAL-STK-001'),
 40000, 'piece', '2026-01-13', (SELECT user_id FROM users WHERE employee_id = 'VTL001'));

-- PVC Sleeve Labels - 5 Gallon Cap (400 kg)
INSERT INTO inventory (product_id, location_id, batch_id, quantity_on_hand, uom, last_counted_date, last_counted_by) VALUES
((SELECT product_id FROM products WHERE sku = 'LABEL-5GAL-CAP-PVC'),
 (SELECT location_id FROM warehouse_locations WHERE location_code = 'A-AISLE-03'),
 (SELECT batch_id FROM batches WHERE batch_number = 'BATCH-LBL-5GALCAP-PVC-001'),
 400, 'kg', '2026-01-13', (SELECT user_id FROM users WHERE employee_id = 'VTL001'));

-- Label Mold - 5 Gallon Cap (1 set)
INSERT INTO inventory (product_id, location_id, batch_id, quantity_on_hand, uom, last_counted_date, last_counted_by) VALUES
((SELECT product_id FROM products WHERE sku = 'MOLD-LABEL-5GAL-CAP'),
 (SELECT location_id FROM warehouse_locations WHERE location_code = 'A-AISLE-04'),
 NULL,
 1, 'set', '2026-01-13', (SELECT user_id FROM users WHERE employee_id = 'VTL001'));

-- Sachet Film (1,600 kg)
INSERT INTO inventory (product_id, location_id, batch_id, quantity_on_hand, uom, last_counted_date, last_counted_by) VALUES
((SELECT product_id FROM products WHERE sku = 'FILM-SACHET'),
 (SELECT location_id FROM warehouse_locations WHERE location_code = 'A-AISLE-03'),
 NULL,
 1600, 'kg', '2026-01-13', (SELECT user_id FROM users WHERE employee_id = 'VTL001'));

-- Sachet Mold (1 set)
INSERT INTO inventory (product_id, location_id, batch_id, quantity_on_hand, uom, last_counted_date, last_counted_by) VALUES
((SELECT product_id FROM products WHERE sku = 'MOLD-SACHET'),
 (SELECT location_id FROM warehouse_locations WHERE location_code = 'A-AISLE-04'),
 NULL,
 1, 'set', '2026-01-13', (SELECT user_id FROM users WHERE employee_id = 'VTL001'));

-- ============================================================
-- LOAD INITIAL SPARE PARTS INVENTORY (from order/expected delivery)
-- ============================================================

-- Water Treatment Spares (placing initial small quantities)
INSERT INTO inventory (product_id, location_id, batch_id, quantity_on_hand, uom) VALUES
((SELECT product_id FROM products WHERE sku = 'SPARE-WT-PP-FILTER'),
 (SELECT location_id FROM warehouse_locations WHERE location_code = 'A-AISLE-04'),
 NULL, 18, 'piece'),

((SELECT product_id FROM products WHERE sku = 'SPARE-WT-RO-MEMBRANE'),
 (SELECT location_id FROM warehouse_locations WHERE location_code = 'A-AISLE-04'),
 NULL, 8, 'piece'),

((SELECT product_id FROM products WHERE sku = 'SPARE-WT-UV-LAMP'),
 (SELECT location_id FROM warehouse_locations WHERE location_code = 'A-AISLE-04'),
 NULL, 6, 'piece'),

((SELECT product_id FROM products WHERE sku = 'SPARE-WT-UV-GLASS'),
 (SELECT location_id FROM warehouse_locations WHERE location_code = 'A-AISLE-04'),
 NULL, 6, 'piece'),

((SELECT product_id FROM products WHERE sku = 'SPARE-WT-OZONE-TUBE'),
 (SELECT location_id FROM warehouse_locations WHERE location_code = 'A-AISLE-04'),
 NULL, 1, 'piece'),

((SELECT product_id FROM products WHERE sku = 'SPARE-WT-PNEUMATIC-VALVE'),
 (SELECT location_id FROM warehouse_locations WHERE location_code = 'A-AISLE-04'),
 NULL, 2, 'piece'),

((SELECT product_id FROM products WHERE sku = 'SPARE-WT-PRESSURE-SWITCH'),
 (SELECT location_id FROM warehouse_locations WHERE location_code = 'A-AISLE-04'),
 NULL, 1, 'piece'),

((SELECT product_id FROM products WHERE sku = 'SPARE-WT-CONDUCTIVITY'),
 (SELECT location_id FROM warehouse_locations WHERE location_code = 'A-AISLE-04'),
 NULL, 2, 'piece'),

-- Blowing Machine Spares
((SELECT product_id FROM products WHERE sku = 'SPARE-BM-LAMP-AUTO'),
 (SELECT location_id FROM warehouse_locations WHERE location_code = 'A-AISLE-04'),
 NULL, 10, 'piece'),

((SELECT product_id FROM products WHERE sku = 'SPARE-BM-LAMP-SEMI'),
 (SELECT location_id FROM warehouse_locations WHERE location_code = 'A-AISLE-04'),
 NULL, 10, 'piece'),

((SELECT product_id FROM products WHERE sku = 'SPARE-BM-VALVE-LOW'),
 (SELECT location_id FROM warehouse_locations WHERE location_code = 'A-AISLE-04'),
 NULL, 2, 'piece'),

((SELECT product_id FROM products WHERE sku = 'SPARE-BM-VALVE-HIGH'),
 (SELECT location_id FROM warehouse_locations WHERE location_code = 'A-AISLE-04'),
 NULL, 8, 'piece'),

-- Filling Machine Spares
((SELECT product_id FROM products WHERE sku = 'SPARE-FM-CLAMP-SPRING'),
 (SELECT location_id FROM warehouse_locations WHERE location_code = 'A-AISLE-04'),
 NULL, 6, 'piece'),

((SELECT product_id FROM products WHERE sku = 'SPARE-FM-FLOAT'),
 (SELECT location_id FROM warehouse_locations WHERE location_code = 'A-AISLE-04'),
 NULL, 2, 'piece'),

-- Labeling Machine Spares (key items)
((SELECT product_id FROM products WHERE sku = 'SPARE-LM-BRUSH-BELT'),
 (SELECT location_id FROM warehouse_locations WHERE location_code = 'A-AISLE-04'),
 NULL, 2, 'set'),

((SELECT product_id FROM products WHERE sku = 'SPARE-LM-CUTTING-KNIFE'),
 (SELECT location_id FROM warehouse_locations WHERE location_code = 'A-AISLE-04'),
 NULL, 2, 'set'),

((SELECT product_id FROM products WHERE sku = 'SPARE-LM-RUBBER-WHEEL'),
 (SELECT location_id FROM warehouse_locations WHERE location_code = 'A-AISLE-04'),
 NULL, 2, 'set');

-- Note: Additional spares can be added as they arrive or are ordered

COMMIT;

-- ============================================================
-- VERIFICATION QUERIES
-- ============================================================

-- Check total inventory value
-- SELECT 
--     SUM(i.quantity_on_hand * p.standard_cost) as total_inventory_value
-- FROM inventory i
-- JOIN products p ON i.product_id = p.product_id
-- WHERE p.standard_cost IS NOT NULL;

-- Check current stock by category
-- SELECT 
--     pc.category_name,
--     COUNT(DISTINCT p.product_id) as product_count,
--     SUM(i.quantity_on_hand * 
--         CASE 
--             WHEN p.base_uom = 'piece' THEN 1
--             WHEN p.base_uom = 'kg' THEN 1
--             ELSE 1
--         END
--     ) as total_quantity
-- FROM inventory i
-- JOIN products p ON i.product_id = p.product_id
-- JOIN product_categories pc ON p.category_id = pc.category_id
-- GROUP BY pc.category_name
-- ORDER BY pc.category_name;

-- Check items from actual inventory image
-- SELECT 
--     p.sku,
--     p.product_name,
--     i.quantity_on_hand,
--     i.uom,
--     wl.location_code
-- FROM products p
-- LEFT JOIN inventory i ON p.product_id = i.product_id
-- LEFT JOIN warehouse_locations wl ON i.location_id = wl.location_id
-- WHERE p.sku IN (
--     'PREFORM-500ML-18G',
--     'PREFORM-750ML-25G',
--     'PREFORM-500ML-23G',
--     'CAP-GENERIC',
--     'LABEL-500ML-PVC-SLEEVE',
--     'FILM-SHRINK',
--     'PREFORM-5GAL',
--     'CAP-5GALLON'
-- )
-- ORDER BY p.sku;
