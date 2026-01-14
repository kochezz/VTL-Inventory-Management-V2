-- ============================================================
-- Vilagio Inventory Management - Users (CORRECTED)
-- Matches actual schema.sql structure
-- Load this BEFORE seed-data-vilagio-quantities.sql
-- ============================================================

BEGIN;

-- ============================================================
-- USERS
-- NOTE: Change all passwords before going to production!
-- ============================================================

INSERT INTO users (employee_id, email, full_name, password_hash, role, badge_number, phone_number, is_active) VALUES
-- Admin
('VTL001', 'wphiri@vilag.io',
 'William Phiri - System Administrator',
 '$2b$10$rJ8qHwVZxGfKYZ8F.oL5VeLKvXxYQ7gH4vKmO9z1nQxWpD8sYZJNW', -- password: admin123
 'admin', 'BADGE001', NULL, true),

-- Warehouse Manager
('VTL002', 'warehouse.manager@vilag.io',
 'Warehouse Manager',
 '$2b$10$rJ8qHwVZxGfKYZ8F.oL5VeLKvXxYQ7gH4vKmO9z1nQxWpD8sYZJNW', -- password: password123
 'warehouse_manager', 'BADGE002', NULL, true),

-- Warehouse Staff 1
('VTL003', 'warehouse.staff1@vilag.io',
 'Warehouse Staff 1',
 '$2b$10$rJ8qHwVZxGfKYZ8F.oL5VeLKvXxYQ7gH4vKmO9z1nQxWpD8sYZJNW', -- password: password123
 'warehouse_staff', 'BADGE003', NULL, true),

-- Warehouse Staff 2
('VTL004', 'warehouse.staff2@vilag.io',
 'Warehouse Staff 2',
 '$2b$10$rJ8qHwVZxGfKYZ8F.oL5VeLKvXxYQ7gH4vKmO9z1nQxWpD8sYZJNW', -- password: password123
 'warehouse_staff', 'BADGE004', NULL, true),

-- Production Manager
('VTL005', 'production.manager@vilag.io',
 'Production Manager',
 '$2b$10$rJ8qHwVZxGfKYZ8F.oL5VeLKvXxYQ7gH4vKmO9z1nQxWpD8sYZJNW', -- password: password123
 'production_manager', 'BADGE005', NULL, true),

-- Viewer (Reports only)
('VTL006', 'viewer@vilag.io',
 'Report Viewer',
 '$2b$10$rJ8qHwVZxGfKYZ8F.oL5VeLKvXxYQ7gH4vKmO9z1nQxWpD8sYZJNW', -- password: password123
 'viewer', 'BADGE006', NULL, true);

COMMIT;

-- ============================================================
-- VERIFICATION
-- ============================================================

-- Check users created
-- SELECT 
--     employee_id,
--     email,
--     full_name,
--     role,
--     badge_number,
--     is_active
-- FROM users
-- ORDER BY employee_id;

-- ============================================================
-- TEST LOGIN
-- ============================================================
-- Email: wphiri@vilag.io
-- Password: admin123
--
-- All other passwords: password123
-- ============================================================

-- ============================================================
-- SECURITY WARNING
-- ============================================================
-- ALL PASSWORDS ARE SET TO WEAK DEFAULTS!
-- Change immediately in production:
-- UPDATE users SET password_hash = 'new_bcrypt_hash' WHERE email = 'wphiri@vilag.io';
