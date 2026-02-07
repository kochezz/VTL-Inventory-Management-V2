-- ============================================================================
-- ULTRA-SIMPLE PRODUCTION BATCHES SEED
-- ============================================================================
-- Uses only the absolute minimum required columns
-- Run this if the other seed fails
-- ============================================================================

-- STEP 1: Check prerequisites
SELECT 'Checking products...' as step;
SELECT product_id, sku, product_name FROM products LIMIT 3;

SELECT 'Checking users...' as step;
SELECT user_id, email, full_name FROM users LIMIT 3;

-- STEP 2: Insert minimal test batches
-- Batch 1: Draft
INSERT INTO production_batches (
    batch_number,
    product_id,
    production_date,
    shift,
    planned_quantity,
    status,
    current_gate,
    created_by
)
SELECT
    'SIMPLE-001',
    p.product_id,
    CURRENT_DATE,
    'day',
    1000,
    'draft',
    0,
    u.user_id
FROM products p
CROSS JOIN users u
WHERE p.is_active = true
LIMIT 1;

-- Batch 2: Awaiting QA
INSERT INTO production_batches (
    batch_number,
    product_id,
    production_date,
    shift,
    planned_quantity,
    status,
    current_gate,
    created_by
)
SELECT
    'SIMPLE-002',
    p.product_id,
    CURRENT_DATE,
    'day',
    2000,
    'awaiting_qa',
    0,
    u.user_id
FROM products p
CROSS JOIN users u
WHERE p.is_active = true
LIMIT 1;

-- Batch 3: In Progress
INSERT INTO production_batches (
    batch_number,
    product_id,
    production_date,
    shift,
    planned_quantity,
    status,
    current_gate,
    created_by
)
SELECT
    'SIMPLE-003',
    p.product_id,
    CURRENT_DATE,
    'night',
    3000,
    'in_progress',
    2,
    u.user_id
FROM products p
CROSS JOIN users u
WHERE p.is_active = true
LIMIT 1;

-- STEP 3: Verify
SELECT 
    batch_id,
    batch_number,
    status,
    planned_quantity,
    production_date
FROM production_batches
WHERE batch_number LIKE 'SIMPLE-%'
ORDER BY batch_number;

SELECT COUNT(*) || ' batches created' as result FROM production_batches WHERE batch_number LIKE 'SIMPLE-%';
