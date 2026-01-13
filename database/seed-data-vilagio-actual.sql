-- ============================================================
-- Vilagio Inventory Management - ACTUAL INVENTORY Seed Data
-- Real inventory from January 2026
-- ============================================================

BEGIN;

-- ============================================================
-- ADDITIONAL PRODUCT CATEGORIES FOR SPARES
-- ============================================================

-- Add specific categories for different machine systems
INSERT INTO product_categories (category_code, category_name, description) VALUES
('SPARE_UV_SYSTEM', 'UV & Ozone System Spares', 'UV lamps, ozone tubes, and sterilization equipment'),
('SPARE_RO_SYSTEM', 'RO Filtration System Spares', 'RO membranes, filters, and water treatment parts'),
('SPARE_PNEUMATIC', 'Pneumatic System Spares', 'Valves, cylinders, and pneumatic components'),
('SPARE_ELECTRICAL', 'Electrical Components', 'Switches, relays, sensors, and electrical parts'),
('SPARE_SHRINK_MACHINE', 'Shrink Packaging Machine Spares', 'Heating tubes, belts, and shrink machine parts'),
('SPARE_SACHET_MACHINE', 'Sachet Machine Spares', 'Sachet filling machine components')
ON CONFLICT (category_code) DO NOTHING;

-- ============================================================
-- ACTUAL VILAGIO INVENTORY - RAW MATERIALS
-- ============================================================

-- Pre-forms (from actual inventory image)
INSERT INTO products (sku, product_name, category_id, description, barcode, base_uom, base_uom_per_case, cases_per_pallet, standard_cost, requires_batch_tracking, requires_expiry_tracking, reorder_point, reorder_quantity, minimum_stock_level, maximum_stock_level, safety_stock_level, lead_time_days) VALUES

-- 18g 500ml Pre-forms
('PREFORM-500ML-18G', '500ML PET Bottle Preform 18g', 
 (SELECT category_id FROM product_categories WHERE category_code = 'RAW_PREFORM'),
 'PET pre-form for 500ml bottles, 28mm neck finish, 18g weight - lighter weight version',
 'PF500ML18G', 'piece', 2000, 40, 0.075, true, false, 
 50000, 100000, 40000, 300000, 50000, 14),

-- 23g 500ml Pre-forms  
('PREFORM-500ML-23G', '500ML PET Bottle Preform 23g',
 (SELECT category_id FROM product_categories WHERE category_code = 'RAW_PREFORM'),
 'PET pre-form for 500ml bottles, 28mm neck finish, 23g weight - medium weight',
 'PF500ML23G', 'piece', 2000, 40, 0.085, true, false,
 30000, 80000, 20000, 200000, 30000, 14),

-- 25g 750ml Pre-forms
('PREFORM-750ML-25G', '750ML PET Bottle Preform 25g',
 (SELECT category_id FROM product_categories WHERE category_code = 'RAW_PREFORM'),
 'PET pre-form for 750ml bottles, 28mm neck finish, 25g weight',
 'PF750ML25G', 'piece', 1800, 35, 0.115, true, false,
 50000, 100000, 40000, 300000, 50000, 14),

-- 5 Gallon Pre-forms (18.9L)
('PREFORM-5GAL', '5 Gallon (18.9L) PET Bottle Preform',
 (SELECT category_id FROM product_categories WHERE category_code = 'RAW_PREFORM'),
 'Large PET pre-form for 5 gallon (18.9L) water bottles, 48mm neck finish',
 'PF5GALLON', 'piece', 400, 15, 0.45, true, false,
 500, 1500, 300, 3000, 500, 21),

-- Bottle Caps
('CAP-GENERIC', 'Bottle Cap (Multi-size)',
 (SELECT category_id FROM product_categories WHERE category_code = 'RAW_CAP'),
 'Generic bottle caps compatible with 500ml/750ml bottles, tamper-evident',
 'CAPGENERIC', 'piece', 5000, 50, 0.018, true, false,
 150000, 300000, 100000, 800000, 150000, 10),

('CAP-5GALLON', '5 Gallon Bottle Cap 48mm',
 (SELECT category_id FROM product_categories WHERE category_code = 'RAW_CAP'),
 'Large screw cap for 5 gallon bottles, 48mm, tamper-evident',
 'CAP5GAL48MM', 'piece', 2000, 40, 0.06, true, false,
 20000, 50000, 15000, 100000, 20000, 14),

-- PVC Sleeve Labels
('LABEL-500ML-PVC-SLEEVE', '500ML PVC Sleeve Label',
 (SELECT category_id FROM product_categories WHERE category_code = 'RAW_LABEL'),
 'PVC shrink sleeve label material for 500ml bottles, sold by weight',
 'LBL500MLPVC', 'kg', NULL, NULL, 15.00, true, false,
 300, 800, 200, 2000, 300, 14),

('LABEL-750ML-PVC-SLEEVE', '750ML PVC Sleeve Label',
 (SELECT category_id FROM product_categories WHERE category_code = 'RAW_LABEL'),
 'PVC shrink sleeve label material for 750ml bottles, sold by weight',
 'LBL750MLPVC', 'kg', NULL, NULL, 18.00, true, false,
 300, 800, 200, 2000, 300, 14),

('LABEL-CAP-PVC-SLEEVE', 'Cap PVC Sleeve Label',
 (SELECT category_id FROM product_categories WHERE category_code = 'RAW_LABEL'),
 'PVC shrink sleeve label for bottle caps',
 'LBLCAPPVC', 'kg', NULL, NULL, 12.00, true, false,
 200, 400, 100, 1000, 150, 14),

('LABEL-5GAL-CAP-PVC', '5 Gallon Cap PVC Sleeve Label',
 (SELECT category_id FROM product_categories WHERE category_code = 'RAW_LABEL'),
 'PVC shrink sleeve label for 5 gallon bottle caps',
 'LBL5GALCAPPVC', 'kg', NULL, NULL, 14.00, true, false,
 150, 400, 100, 1000, 150, 14),

-- Glue Sticker Labels
('LABEL-500ML-STICKER', '500ML Glue Sticker Label',
 (SELECT category_id FROM product_categories WHERE category_code = 'RAW_LABEL'),
 'Adhesive sticker label for 500ml bottles',
 'LBL500MLSTK', 'piece', 10000, 80, 0.012, true, false,
 30000, 80000, 20000, 200000, 30000, 14),

('LABEL-5GAL-STICKER', '5 Gallon Glue Sticker Label',
 (SELECT category_id FROM product_categories WHERE category_code = 'RAW_LABEL'),
 'Adhesive sticker label for 5 gallon bottles',
 'LBL5GALSTK', 'piece', 5000, 50, 0.025, true, false,
 20000, 40000, 10000, 100000, 15000, 14),

-- Label Molds
('MOLD-LABEL-500ML', '500ML Label Mold',
 (SELECT category_id FROM product_categories WHERE category_code = 'RAW_LABEL'),
 'Mold/die for 500ml bottle labels',
 'MOLD500MLLBL', 'set', NULL, NULL, 850.00, false, false,
 1, 1, 1, 3, 1, 90),

('MOLD-LABEL-750ML', '750ML Label Mold',
 (SELECT category_id FROM product_categories WHERE category_code = 'RAW_LABEL'),
 'Mold/die for 750ml bottle labels',
 'MOLD750MLLBL', 'set', NULL, NULL, 900.00, false, false,
 1, 1, 1, 3, 1, 90),

('MOLD-LABEL-CAP', 'Cap Label Mold',
 (SELECT category_id FROM product_categories WHERE category_code = 'RAW_LABEL'),
 'Mold/die for cap labels',
 'MOLDCAPLBL', 'set', NULL, NULL, 650.00, false, false,
 1, 1, 1, 2, 1, 90),

('MOLD-LABEL-5GAL-CAP', '5 Gallon Cap Label Mold',
 (SELECT category_id FROM product_categories WHERE category_code = 'RAW_LABEL'),
 'Mold/die for 5 gallon cap labels',
 'MOLD5GALCAPLBL', 'set', NULL, NULL, 750.00, false, false,
 1, 1, 1, 2, 1, 90),

-- Shrink Film
('FILM-SHRINK', 'Shrink Film for Packaging',
 (SELECT category_id FROM product_categories WHERE category_code = 'RAW_PACKAGING'),
 'LDPE/LLDPE shrink film for case packaging',
 'FILMSHRINK', 'kg', NULL, NULL, 3.50, false, false,
 800, 1600, 500, 4000, 800, 10),

-- Sachet Film
('FILM-SACHET', 'Sachet Water Film',
 (SELECT category_id FROM product_categories WHERE category_code = 'RAW_PACKAGING'),
 'Film for sachet water packaging',
 'FILMSACHET', 'kg', NULL, NULL, 4.00, false, false,
 800, 1600, 500, 4000, 800, 10),

('MOLD-SACHET', 'Sachet Water Film Mold',
 (SELECT category_id FROM product_categories WHERE category_code = 'RAW_PACKAGING'),
 'Mold/die for sachet water packaging',
 'MOLDSACHET', 'set', NULL, NULL, 1200.00, false, false,
 1, 1, 1, 2, 1, 120);

-- ============================================================
-- SPARES FROM PDF - WATER TREATMENT SYSTEM
-- ============================================================

INSERT INTO products (sku, product_name, category_id, description, barcode, base_uom, standard_cost, requires_batch_tracking, reorder_point, reorder_quantity, minimum_stock_level, maximum_stock_level, lead_time_days, specification_details) VALUES

-- PP Cotton Filters
('SPARE-WT-PP-FILTER', 'PP Cotton Filter Element',
 (SELECT category_id FROM product_categories WHERE category_code = 'SPARE_RO_SYSTEM'),
 '5 micron PP cotton filter cartridge, 10 inch length',
 'SPWTPPFILTER', 'piece', 6.00, false, 10, 18, 6, 40, 30,
 '{"lifetime": "1 year", "micron_rating": 5, "length": "10 inch"}'),

-- RO Membranes
('SPARE-WT-RO-MEMBRANE', 'RO Membrane Filter',
 (SELECT category_id FROM product_categories WHERE category_code = 'SPARE_RO_SYSTEM'),
 'Reverse osmosis membrane filter element',
 'SPWTROMEM', 'piece', 600.00, false, 4, 8, 2, 16, 45,
 '{"type": "RO", "expected_life": "2-3 years"}'),

-- UV Lamps
('SPARE-WT-UV-LAMP', 'UV Lamp Tube for Sterilization',
 (SELECT category_id FROM product_categories WHERE category_code = 'SPARE_UV_SYSTEM'),
 'UV-C germicidal lamp for water sterilization',
 'SPWTUVLAMP', 'piece', 10.00, true, 4, 6, 3, 15, 30,
 '{"wattage": "varies", "life_hours": 9000}'),

('SPARE-WT-UV-GLASS', 'UV Glass Tube',
 (SELECT category_id FROM product_categories WHERE category_code = 'SPARE_UV_SYSTEM'),
 'Quartz glass tube for UV lamp housing',
 'SPWTUVGLASS', 'piece', 8.00, false, 4, 6, 2, 12, 30,
 '{}'),

('SPARE-WT-OZONE-TUBE', 'Ozone Generator Tube',
 (SELECT category_id FROM product_categories WHERE category_code = 'SPARE_UV_SYSTEM'),
 'Ozone generation tube for water treatment',
 'SPWTOZONE', 'piece', 68.00, false, 1, 1, 1, 3, 45,
 '{}'),

-- Pneumatic Components
('SPARE-WT-PNEUMATIC-VALVE', 'Pneumatic Valve',
 (SELECT category_id FROM product_categories WHERE category_code = 'SPARE_PNEUMATIC'),
 'Pneumatic control valve for water treatment',
 'SPWTPNEUVALVE', 'piece', 220.00, false, 1, 2, 1, 4, 30,
 '{}'),

-- Electrical Components
('SPARE-WT-PRESSURE-SWITCH', 'Pressure Switch',
 (SELECT category_id FROM product_categories WHERE category_code = 'SPARE_ELECTRICAL'),
 'Pressure switch for pump control',
 'SPWTPRESSSW', 'piece', 35.00, false, 1, 1, 1, 3, 21,
 '{}'),

('SPARE-WT-CONDUCTIVITY', 'Conductivity Meter',
 (SELECT category_id FROM product_categories WHERE category_code = 'SPARE_ELECTRICAL'),
 'TDS/Conductivity measurement meter',
 'SPWTCONDMTR', 'piece', 35.00, false, 1, 2, 1, 4, 21,
 '{}'),

('SPARE-WT-POWER-SUPPLY', 'Power Supply Unit',
 (SELECT category_id FROM product_categories WHERE category_code = 'SPARE_ELECTRICAL'),
 'Power supply for water treatment system',
 'SPWTPWRSPLY', 'piece', 45.00, false, 1, 1, 1, 2, 30,
 '{}');

-- ============================================================
-- SPARES - BOTTLE BLOWING MACHINES
-- ============================================================

INSERT INTO products (sku, product_name, category_id, description, barcode, base_uom, standard_cost, requires_batch_tracking, reorder_point, reorder_quantity, minimum_stock_level, maximum_stock_level, lead_time_days) VALUES

-- Blowing Machine Lamps
('SPARE-BM-LAMP-AUTO', 'Blowing Machine Infrared Lamp (Auto)',
 (SELECT category_id FROM product_categories WHERE category_code = 'SPARE_BLOWER'),
 'Infrared heating lamp for automatic blow molder',
 'SPBMLAMPAU', 'piece', 20.00, false, 5, 10, 3, 20, 30),

('SPARE-BM-LAMP-SEMI', 'Blowing Machine Infrared Lamp (Semi-Auto)',
 (SELECT category_id FROM product_categories WHERE category_code = 'SPARE_BLOWER'),
 'Infrared heating lamp for semi-automatic blow molder',
 'SPBMLAMPSA', 'piece', 80.00, false, 5, 10, 3, 20, 30),

-- Solenoid Valves
('SPARE-BM-VALVE-LOW', 'Low Pressure Solenoid Valve',
 (SELECT category_id FROM product_categories WHERE category_code = 'SPARE_PNEUMATIC'),
 'Low pressure solenoid valve for blow molder',
 'SPBMVALVLP', 'piece', 30.00, false, 1, 2, 1, 4, 21),

('SPARE-BM-VALVE-HIGH', 'High Pressure Solenoid Valve',
 (SELECT category_id FROM product_categories WHERE category_code = 'SPARE_PNEUMATIC'),
 'High pressure solenoid valve for blow molder',
 'SPBMVALVHP', 'piece', 50.00, false, 3, 5, 2, 10, 21),

-- Regulators and Switches
('SPARE-BM-PRESSURE-REG', 'Pressure Regulator',
 (SELECT category_id FROM product_categories WHERE category_code = 'SPARE_PNEUMATIC'),
 'Air pressure regulator for blow molder',
 'SPBMPRESSREG', 'piece', 25.00, false, 1, 1, 1, 3, 21),

('SPARE-BM-MAG-SWITCH', 'Magnetic Switch (Cylinder)',
 (SELECT category_id FROM product_categories WHERE category_code = 'SPARE_ELECTRICAL'),
 'Magnetic proximity switch for cylinder positioning',
 'SPBMMAGSW', 'piece', 15.00, false, 1, 2, 1, 5, 21);

-- ============================================================
-- SPARES - FILLING MACHINE
-- ============================================================

INSERT INTO products (sku, product_name, category_id, description, barcode, base_uom, standard_cost, requires_batch_tracking, reorder_point, reorder_quantity, minimum_stock_level, maximum_stock_level, lead_time_days) VALUES

('SPARE-FM-CLAMP-SPRING', 'Rinsing Clamp Spring',
 (SELECT category_id FROM product_categories WHERE category_code = 'SPARE_FILLER'),
 'Spring for bottle rinsing clamp mechanism',
 'SPFMCLMPSPG', 'piece', 4.00, false, 4, 6, 3, 12, 21),

('SPARE-FM-SHIFT-FORK', 'Shift Fork',
 (SELECT category_id FROM product_categories WHERE category_code = 'SPARE_FILLER'),
 'Shift fork for filling machine mechanism',
 'SPFMSHFTFRK', 'piece', 3.00, false, 4, 6, 3, 12, 21),

('SPARE-FM-SCROLL-WHEEL', 'Scroll Wheel',
 (SELECT category_id FROM product_categories WHERE category_code = 'SPARE_FILLER'),
 'Scroll wheel for filling machine',
 'SPFMSCRLWHL', 'piece', 6.00, false, 4, 6, 3, 12, 21),

('SPARE-FM-IGS-BEARING-SM', 'IGS Bearing 14-16-18',
 (SELECT category_id FROM product_categories WHERE category_code = 'SPARE_FILLER'),
 'IGS bearing small size 14-16-18mm',
 'SPFMIGSBRGSM', 'piece', 8.00, false, 4, 6, 3, 12, 21),

('SPARE-FM-IGS-BEARING-LG', 'IGS Bearing 16-18-20',
 (SELECT category_id FROM product_categories WHERE category_code = 'SPARE_FILLER'),
 'IGS bearing large size 16-18-20mm',
 'SPFMIGSBRGlg', 'piece', 10.00, false, 4, 6, 3, 12, 21),

('SPARE-FM-O-RING', 'O-Ring Seal',
 (SELECT category_id FROM product_categories WHERE category_code = 'SPARE_FILLER'),
 'O-ring seal for filling machine',
 'SPFMORING', 'piece', 2.00, false, 8, 12, 6, 24, 14),

('SPARE-FM-FLOAT', 'Liquid Level Float',
 (SELECT category_id FROM product_categories WHERE category_code = 'SPARE_FILLER'),
 'Liquid level float sensor',
 'SPFMFLOAT', 'piece', 30.00, false, 1, 2, 1, 4, 21),

('SPARE-FM-CONVEYOR-CHAIN', 'Conveyor Chain',
 (SELECT category_id FROM product_categories WHERE category_code = 'SPARE_FILLER'),
 'Conveyor chain for bottle transport, sold per meter',
 'SPFMCONVCHN', 'meter', 25.00, false, 2, 5, 1, 10, 21),

('SPARE-FM-CAP-LOADER-CHAIN', 'Cap Loader Chain',
 (SELECT category_id FROM product_categories WHERE category_code = 'SPARE_FILLER'),
 'Chain for cap loading mechanism, sold per meter',
 'SPFMCAPCHN', 'meter', 35.00, false, 1, 3, 1, 5, 21);

-- ============================================================
-- SPARES - LABELING MACHINES
-- ============================================================

INSERT INTO products (sku, product_name, category_id, description, barcode, base_uom, standard_cost, requires_batch_tracking, reorder_point, reorder_quantity, minimum_stock_level, maximum_stock_level, lead_time_days) VALUES

('SPARE-LM-BRUSH-BELT', 'Under Brush Belt',
 (SELECT category_id FROM product_categories WHERE category_code = 'SPARE_LABELER'),
 'Under brush belt for label application',
 'SPLMBRSHBLT', 'set', 100.00, false, 1, 2, 1, 4, 30),

('SPARE-LM-DRIVE-BELT', 'Drive Belt / Separate Belt',
 (SELECT category_id FROM product_categories WHERE category_code = 'SPARE_LABELER'),
 'Drive and separator belts',
 'SPLMDRVBLT', 'set', 40.00, false, 1, 2, 1, 4, 21),

('SPARE-LM-ELEVATOR-BELT', 'Elevator Drive Belt (Long)',
 (SELECT category_id FROM product_categories WHERE category_code = 'SPARE_LABELER'),
 'Long elevator drive belt',
 'SPLMELEVBLT', 'set', 60.00, false, 1, 2, 1, 4, 21),

('SPARE-LM-CUTTER-MOTOR-BELT', 'Cutter Motor Belt',
 (SELECT category_id FROM product_categories WHERE category_code = 'SPARE_LABELER'),
 'Belt for label cutting motor, 3-6 month lifetime',
 'SPLMCUTMBLT', 'set', 40.00, false, 1, 2, 1, 4, 14),

('SPARE-LM-CUTTER-INNER-BELT', 'Cutter Inner Belt',
 (SELECT category_id FROM product_categories WHERE category_code = 'SPARE_LABELER'),
 'Inner belt for cutter mechanism, 3-6 month lifetime',
 'SPLMCUTIBLT', 'set', 40.00, false, 1, 2, 1, 4, 14),

('SPARE-LM-BOTTLE-BELT-LONG', 'Bottle Carrying Belt (Long)',
 (SELECT category_id FROM product_categories WHERE category_code = 'SPARE_LABELER'),
 'Long bottle carrying belt',
 'SPLMBOTBLTL', 'set', 40.00, false, 1, 2, 1, 4, 21),

('SPARE-LM-BOTTLE-BELT-SHORT', 'Bottle Carrying Belt (Short)',
 (SELECT category_id FROM product_categories WHERE category_code = 'SPARE_LABELER'),
 'Short bottle carrying belt',
 'SPLMBOTBLTS', 'set', 40.00, false, 1, 2, 1, 4, 21),

('SPARE-LM-CUTTING-KNIFE', 'Label Cutting Knife',
 (SELECT category_id FROM product_categories WHERE category_code = 'SPARE_LABELER'),
 'Cutting knife/blade for label cutter',
 'SPLMCUTKNF', 'set', 15.00, false, 1, 2, 1, 4, 21),

('SPARE-LM-RUBBER-WHEEL', 'Rubber Wheel',
 (SELECT category_id FROM product_categories WHERE category_code = 'SPARE_LABELER'),
 'Rubber wheel for label application',
 'SPLMRUBWHL', 'set', 150.00, false, 1, 2, 1, 3, 30),

('SPARE-LM-SENSOR', 'Labeler Sensor',
 (SELECT category_id FROM product_categories WHERE category_code = 'SPARE_LABELER'),
 'Optical sensor for labeler',
 'SPLMSENSOR', 'piece', 150.00, false, 1, 1, 1, 3, 30),

('SPARE-LM-HEAD-BELT', 'Machine Head Belt 136L',
 (SELECT category_id FROM product_categories WHERE category_code = 'SPARE_LABELER'),
 'Machine head belt 136L, 3-6 month lifetime',
 'SPLMHEDBLT', 'piece', 36.00, false, 1, 1, 1, 3, 14),

('SPARE-LM-SPONGE-BELT', 'Sponge Belt',
 (SELECT category_id FROM product_categories WHERE category_code = 'SPARE_LABELER'),
 'Sponge belt for label application, 3-6 month lifetime',
 'SPLMSPGBLT', 'piece', 70.00, false, 1, 1, 1, 3, 14),

('SPARE-LM-FIBER-SENSOR', 'Optical Fiber Sensor',
 (SELECT category_id FROM product_categories WHERE category_code = 'SPARE_LABELER'),
 'Optical fiber sensor, 1-2 year lifetime',
 'SPLMFIBSEN', 'piece', 70.00, false, 1, 1, 1, 2, 30),

('SPARE-LM-LABEL-SENSOR', 'Label Sensor',
 (SELECT category_id FROM product_categories WHERE category_code = 'SPARE_LABELER'),
 'Label detection sensor, 1-2 year lifetime',
 'SPLMLBLSEN', 'piece', 40.00, false, 1, 1, 1, 3, 21),

('SPARE-LM-RELAY-24V', 'DC 24V Relay',
 (SELECT category_id FROM product_categories WHERE category_code = 'SPARE_ELECTRICAL'),
 '24VDC relay for labeling machine, 1-2 year lifetime',
 'SPLMRLY24V', 'piece', 25.00, false, 1, 1, 1, 3, 21);

-- ============================================================
-- SPARES - SHRINK PACKAGING MACHINE
-- ============================================================

INSERT INTO products (sku, product_name, category_id, description, barcode, base_uom, standard_cost, requires_batch_tracking, reorder_point, reorder_quantity, minimum_stock_level, maximum_stock_level, lead_time_days) VALUES

('SPARE-SM-SILICONE-PAD', 'Silicone Pad',
 (SELECT category_id FROM product_categories WHERE category_code = 'SPARE_SHRINK_MACHINE'),
 'Silicone pad for shrink machine',
 'SPSMSILIPAD', 'piece', 34.00, false, 1, 1, 1, 3, 30),

('SPARE-SM-SEAL-KNIFE', 'Sealing Knife',
 (SELECT category_id FROM product_categories WHERE category_code = 'SPARE_SHRINK_MACHINE'),
 'Sealing knife blade',
 'SPSMSEALKNF', 'piece', 170.00, false, 1, 1, 1, 2, 30),

('SPARE-SM-HEAT-TUBE', 'Tunnel Heating Tube',
 (SELECT category_id FROM product_categories WHERE category_code = 'SPARE_SHRINK_MACHINE'),
 'Individual heating tube for shrink tunnel (10 tubes per set)',
 'SPSMHEATTUB', 'piece', 18.00, false, 5, 10, 3, 20, 21),

('SPARE-SM-HEAT-CURTAIN', 'Heating Curtain',
 (SELECT category_id FROM product_categories WHERE category_code = 'SPARE_SHRINK_MACHINE'),
 'Heat curtain for shrink tunnel',
 'SPSMHEATCRT', 'piece', 18.00, false, 1, 1, 1, 3, 30),

('SPARE-SM-RELAY-SMALL', 'Small Relay',
 (SELECT category_id FROM product_categories WHERE category_code = 'SPARE_ELECTRICAL'),
 'Small relay for shrink machine control',
 'SPSMRLYSML', 'piece', 12.00, false, 1, 1, 1, 3, 21),

('SPARE-SM-SPONGE', 'Press Sponge',
 (SELECT category_id FROM product_categories WHERE category_code = 'SPARE_SHRINK_MACHINE'),
 'Sponge for press mechanism',
 'SPSMPRSSPG', 'piece', 28.00, false, 1, 1, 1, 3, 21),

('SPARE-SM-CONV-CHAIN', 'Conveying Chain',
 (SELECT category_id FROM product_categories WHERE category_code = 'SPARE_SHRINK_MACHINE'),
 'Conveyor chain for shrink machine, sold per meter',
 'SPSMCONVCHN', 'meter', 37.00, false, 2, 5, 1, 10, 30),

('SPARE-SM-FILM-SENSOR', 'Film Optoelectric Sensor',
 (SELECT category_id FROM product_categories WHERE category_code = 'SPARE_ELECTRICAL'),
 'Optical sensor for film detection',
 'SPSMFILMSEN', 'piece', 30.00, false, 1, 1, 1, 3, 21),

('SPARE-SM-TEST-SENSOR', 'Test Optoelectric Sensor',
 (SELECT category_id FROM product_categories WHERE category_code = 'SPARE_ELECTRICAL'),
 'Test optical sensor',
 'SPSM TESTSEN', 'piece', 45.00, false, 1, 1, 1, 2, 21),

('SPARE-SM-HEAT-TAPE', 'High-Temperature Tape (Imported)',
 (SELECT category_id FROM product_categories WHERE category_code = 'SPARE_SHRINK_MACHINE'),
 'Imported high-temperature resistant tape',
 'SPSMHEATTAP', 'roll', 22.00, false, 1, 1, 1, 4, 30),

('SPARE-SM-TOUCHSCREEN', 'Touch Screen (Weinview)',
 (SELECT category_id FROM product_categories WHERE category_code = 'SPARE_ELECTRICAL'),
 'Weinview brand touchscreen HMI',
 'SPSMTCHSCR', 'piece', 200.00, false, 1, 1, 1, 2, 45),

('SPARE-SM-VFD', 'Variable Frequency Drive (Schneider)',
 (SELECT category_id FROM product_categories WHERE category_code = 'SPARE_ELECTRICAL'),
 'Schneider VFD for motor control',
 'SPSMVFD', 'piece', 230.00, false, 1, 1, 1, 2, 45),

('SPARE-SM-PLC', 'PLC Controller (Delta)',
 (SELECT category_id FROM product_categories WHERE category_code = 'SPARE_ELECTRICAL'),
 'Delta PLC for machine control',
 'SPSMPLC', 'piece', 180.00, false, 1, 1, 1, 2, 45),

('SPARE-SM-MAG-SWITCH', 'Magnetic Switch',
 (SELECT category_id FROM product_categories WHERE category_code = 'SPARE_ELECTRICAL'),
 'Magnetic proximity switch',
 'SPSMMAGSW', 'piece', 12.00, false, 1, 2, 1, 5, 21),

('SPARE-SM-SS-BELT', 'Stainless Steel Mesh Belt',
 (SELECT category_id FROM product_categories WHERE category_code = 'SPARE_SHRINK_MACHINE'),
 'Stainless steel conveyor mesh belt',
 'SPSMSSBELT', 'piece', 650.00, false, 1, 1, 1, 2, 60),

('SPARE-SM-HEAT-TUBE-HEAD', 'Machine Head Heating Tube',
 (SELECT category_id FROM product_categories WHERE category_code = 'SPARE_SHRINK_MACHINE'),
 'Heating tube for machine head',
 'SPSMHTUHEAD', 'piece', 30.00, false, 1, 2, 1, 4, 21),

-- Pneumatic cylinders
('SPARE-SM-CYL-MBL20X50', 'Mini Cylinder MBL20X50-CA (AirTac)',
 (SELECT category_id FROM product_categories WHERE category_code = 'SPARE_PNEUMATIC'),
 'AirTac mini cylinder MBL20X50',
 'SPSMCYLMBL', 'piece', 22.00, false, 1, 1, 1, 3, 30),

('SPARE-SM-CYL-SC50X400', 'Cylinder SC50X400-S (AirTac)',
 (SELECT category_id FROM product_categories WHERE category_code = 'SPARE_PNEUMATIC'),
 'AirTac standard cylinder SC50X400',
 'SPSMCYLSC4', 'piece', 70.00, false, 1, 1, 1, 2, 30),

('SPARE-SM-CYL-SC50X450', 'Cylinder SC50X450-S (AirTac)',
 (SELECT category_id FROM product_categories WHERE category_code = 'SPARE_PNEUMATIC'),
 'AirTac standard cylinder SC50X450',
 'SPSMCYLSC5', 'piece', 75.00, false, 1, 1, 1, 2, 30),

('SPARE-SM-CYL-SDA32X15', 'Cylinder SDA32X15 (AirTac)',
 (SELECT category_id FROM product_categories WHERE category_code = 'SPARE_PNEUMATIC'),
 'AirTac compact cylinder SDA32X15',
 'SPSMCYLSDA', 'piece', 25.00, false, 1, 1, 1, 3, 30),

('SPARE-SM-SENSOR-HOLDER', 'SC50 Sensor Holder (AirTac)',
 (SELECT category_id FROM product_categories WHERE category_code = 'SPARE_PNEUMATIC'),
 'Sensor mounting bracket for SC50 cylinder',
 'SPSMSENHLD', 'piece', 8.00, false, 1, 2, 1, 5, 21),

('SPARE-SM-AIR-TREATMENT', 'Air Source Treatment Unit (AirTac)',
 (SELECT category_id FROM product_categories WHERE category_code = 'SPARE_PNEUMATIC'),
 'Air filter, regulator, lubricator unit',
 'SPSMAIRTREAT', 'piece', 35.00, false, 1, 1, 1, 2, 30);

-- ============================================================
-- SPARES - SACHET FILLING MACHINE
-- ============================================================

INSERT INTO products (sku, product_name, category_id, description, barcode, base_uom, standard_cost, requires_batch_tracking, reorder_point, reorder_quantity, minimum_stock_level, maximum_stock_level, lead_time_days) VALUES

('SPARE-SCH-HEAT-PIPE', 'Electric Heat Pipe',
 (SELECT category_id FROM product_categories WHERE category_code = 'SPARE_SACHET_MACHINE'),
 'Electric heating element for sachet sealing, wearing part',
 'SPSCHHEATP', 'piece', 6.00, false, 2, 2, 1, 6, 14),

('SPARE-SCH-HT-CLOTH', 'High Temperature Cloth',
 (SELECT category_id FROM product_categories WHERE category_code = 'SPARE_SACHET_MACHINE'),
 'Heat-resistant cloth, wearing part',
 'SPSCHHTCLTH', 'piece', 3.00, false, 2, 2, 1, 6, 14),

('SPARE-SCH-SEAL-VERT', 'Vertical Sealing Silicone Strip',
 (SELECT category_id FROM product_categories WHERE category_code = 'SPARE_SACHET_MACHINE'),
 'Colored silicone strip for vertical sealing, wearing part',
 'SPSCHSEALV', 'piece', 3.00, false, 1, 1, 1, 4, 14),

('SPARE-SCH-SEAL-HORZ', 'Horizontal Sealing Silicone Strip',
 (SELECT category_id FROM product_categories WHERE category_code = 'SPARE_SACHET_MACHINE'),
 'Silicone strip for horizontal sealing, wearing part',
 'SPSCHSEALH', 'piece', 3.00, false, 1, 1, 1, 4, 14),

('SPARE-SCH-THERMOCOUPLE', 'E-Type Electric Thermocouple',
 (SELECT category_id FROM product_categories WHERE category_code = 'SPARE_ELECTRICAL'),
 'Temperature sensor for sachet machine, wearing part',
 'SPSCHTHERMO', 'piece', 4.00, false, 1, 1, 1, 4, 14),

('SPARE-SCH-TEFLON', 'Tetrafluoro Strip (PTFE)',
 (SELECT category_id FROM product_categories WHERE category_code = 'SPARE_SACHET_MACHINE'),
 'PTFE/Teflon strip, wearing part',
 'SPSCHTEFLON', 'piece', 3.00, false, 1, 1, 1, 4, 14),

('SPARE-SCH-CONTACTOR', 'AC Contactor',
 (SELECT category_id FROM product_categories WHERE category_code = 'SPARE_ELECTRICAL'),
 'AC contactor for sachet machine, wearing part',
 'SPSCHCONTAC', 'piece', 10.00, false, 1, 1, 1, 3, 21),

('SPARE-SCH-SEAL-BLOCK', 'Direct Seal Block (Steel Stamp)',
 (SELECT category_id FROM product_categories WHERE category_code = 'SPARE_SACHET_MACHINE'),
 'Steel sealing block/stamp, wearing part',
 'SPSCHSEALBLK', 'piece', 55.00, false, 1, 1, 1, 2, 30);

COMMIT;

-- ============================================================
-- VERIFICATION
-- ============================================================

-- Check categories
-- SELECT * FROM product_categories ORDER BY category_code;

-- Check all products
-- SELECT 
--     sku, 
--     product_name, 
--     pc.category_name,
--     base_uom,
--     standard_cost
-- FROM products p
-- JOIN product_categories pc ON p.category_id = pc.category_id
-- ORDER BY pc.category_code, sku;
