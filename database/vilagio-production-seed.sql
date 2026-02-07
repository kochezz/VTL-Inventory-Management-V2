-- ============================================================================
-- VILAGIO PRODUCTION MODULE - SEED DATA
-- ============================================================================
-- Purpose: Sample data for testing production batch system
-- Created: 2025-02-05
-- Version: 1.0
-- ============================================================================

-- ----------------------------------------------------------------------------
-- SAMPLE PRODUCTION BATCHES
-- ----------------------------------------------------------------------------

-- Batch 1: Completed and Released (Success case)
INSERT INTO production_batches (
    batch_id,
    batch_number,
    batch_record_code,
    product_id,
    product_name,
    pack_size,
    product_category,
    production_date,
    production_line,
    shift,
    planned_quantity,
    actual_output,
    rejected_bottles,
    yield_percentage,
    status,
    current_gate,
    line_supervisor_id,
    line_supervisor_name,
    created_by_name,
    created_at,
    submitted_for_qa_at,
    qa_approved_at,
    setup_started_at,
    setup_completed_at,
    production_started_at,
    production_completed_at,
    qa_released_at,
    qa_release_status
) VALUES (
    gen_random_uuid(),
    'FD-500-20250201-001',
    'QA-PRO-BAT-LOG-001',
    (SELECT product_id FROM products WHERE sku = 'WB-500-001' LIMIT 1),
    'FreshDrip Bottled Water – 500 ml',
    '500 ml',
    'Non-Premium Bottled Water',
    '2025-02-01',
    'Victory Star 3-in-1 Rinse-Fill-Cap Line',
    'day',
    10000,
    9850,
    150,
    98.50,
    'released',
    3,
    (SELECT user_id FROM users WHERE role = 'manager' LIMIT 1),
    'John Mensah',
    'Sarah Admin',
    '2025-02-01 06:00:00',
    '2025-02-01 06:15:00',
    '2025-02-01 06:30:00',
    '2025-02-01 07:00:00',
    '2025-02-01 07:45:00',
    '2025-02-01 08:00:00',
    '2025-02-01 15:30:00',
    '2025-02-01 16:00:00',
    'released'
);

-- Batch 2: Currently In Progress
INSERT INTO production_batches (
    batch_id,
    batch_number,
    batch_record_code,
    product_id,
    product_name,
    pack_size,
    product_category,
    production_date,
    production_line,
    shift,
    planned_quantity,
    actual_output,
    status,
    current_gate,
    line_supervisor_id,
    line_supervisor_name,
    created_by_name,
    created_at,
    submitted_for_qa_at,
    qa_approved_at,
    setup_started_at,
    setup_completed_at,
    production_started_at
) VALUES (
    gen_random_uuid(),
    'FD-500-20250205-001',
    'QA-PRO-BAT-LOG-002',
    (SELECT product_id FROM products WHERE sku = 'WB-500-001' LIMIT 1),
    'FreshDrip Bottled Water – 500 ml',
    '500 ml',
    'Non-Premium Bottled Water',
    '2025-02-05',
    'Victory Star 3-in-1 Rinse-Fill-Cap Line',
    'day',
    12000,
    4500,
    'in_progress',
    2,
    (SELECT user_id FROM users WHERE role = 'manager' LIMIT 1),
    'John Mensah',
    'Sarah Admin',
    '2025-02-05 06:00:00',
    '2025-02-05 06:15:00',
    '2025-02-05 06:30:00',
    '2025-02-05 07:00:00',
    '2025-02-05 07:45:00',
    '2025-02-05 08:00:00'
);

-- Batch 3: Awaiting QA Pre-Approval
INSERT INTO production_batches (
    batch_id,
    batch_number,
    batch_record_code,
    product_id,
    product_name,
    pack_size,
    product_category,
    production_date,
    production_line,
    shift,
    planned_quantity,
    status,
    current_gate,
    line_supervisor_id,
    line_supervisor_name,
    created_by_name,
    created_at,
    submitted_for_qa_at
) VALUES (
    gen_random_uuid(),
    'FD-500-20250206-001',
    'QA-PRO-BAT-LOG-003',
    (SELECT product_id FROM products WHERE sku = 'WB-500-001' LIMIT 1),
    'FreshDrip Bottled Water – 500 ml',
    '500 ml',
    'Non-Premium Bottled Water',
    '2025-02-06',
    'Victory Star 3-in-1 Rinse-Fill-Cap Line',
    'night',
    15000,
    'awaiting_qa',
    0,
    (SELECT user_id FROM users WHERE role = 'manager' LIMIT 1),
    'John Mensah',
    'Sarah Admin',
    '2025-02-05 14:00:00',
    '2025-02-05 14:15:00'
);

-- Batch 4: Draft (Being planned)
INSERT INTO production_batches (
    batch_id,
    batch_number,
    batch_record_code,
    product_id,
    product_name,
    pack_size,
    product_category,
    production_date,
    production_line,
    shift,
    planned_quantity,
    status,
    current_gate,
    created_by_name,
    created_at
) VALUES (
    gen_random_uuid(),
    'FD-500-20250207-001',
    'QA-PRO-BAT-LOG-004',
    (SELECT product_id FROM products WHERE sku = 'WB-500-001' LIMIT 1),
    'FreshDrip Bottled Water – 500 ml',
    '500 ml',
    'Non-Premium Bottled Water',
    '2025-02-07',
    'Victory Star 3-in-1 Rinse-Fill-Cap Line',
    'day',
    8000,
    'draft',
    0,
    'Sarah Admin',
    '2025-02-05 15:30:00'
);

-- Batch 5: On Hold (Quality issue)
INSERT INTO production_batches (
    batch_id,
    batch_number,
    batch_record_code,
    product_id,
    product_name,
    pack_size,
    product_category,
    production_date,
    production_line,
    shift,
    planned_quantity,
    actual_output,
    status,
    current_gate,
    line_supervisor_id,
    line_supervisor_name,
    created_by_name,
    created_at,
    production_started_at,
    notes
) VALUES (
    gen_random_uuid(),
    'FD-500-20250204-001',
    'QA-PRO-BAT-LOG-005',
    (SELECT product_id FROM products WHERE sku = 'WB-500-001' LIMIT 1),
    'FreshDrip Bottled Water – 500 ml',
    '500 ml',
    'Non-Premium Bottled Water',
    '2025-02-04',
    'Victory Star 3-in-1 Rinse-Fill-Cap Line',
    'night',
    10000,
    3200,
    'on_hold',
    2,
    (SELECT user_id FROM users WHERE role = 'manager' LIMIT 1),
    'John Mensah',
    'Sarah Admin',
    '2025-02-04 18:00:00',
    '2025-02-04 20:00:00',
    'Production paused due to fill volume inconsistency. Investigating equipment calibration.'
);

-- ----------------------------------------------------------------------------
-- BATCH COMPONENTS (For Batch 1 - Released)
-- ----------------------------------------------------------------------------

-- Get the batch_id for Batch 1
DO $$
DECLARE
    v_batch_id UUID;
    v_bottle_inventory_id UUID;
    v_cap_inventory_id UUID;
    v_label_inventory_id UUID;
BEGIN
    -- Get batch ID
    SELECT batch_id INTO v_batch_id 
    FROM production_batches 
    WHERE batch_number = 'FD-500-20250201-001';
    
    -- Get inventory IDs (assuming you have inventory records)
    SELECT inventory_id INTO v_bottle_inventory_id
    FROM inventory 
    WHERE product_id = (SELECT product_id FROM products WHERE sku LIKE 'WB-500%' LIMIT 1)
    LIMIT 1;
    
    -- Bottles
    INSERT INTO batch_components (
        batch_id,
        inventory_id,
        component_type,
        component_name,
        planned_quantity,
        actual_consumed,
        wastage,
        supplier_name,
        supplier_batch_lot,
        material_status,
        warehouse_location_name,
        assigned_at,
        consumed_at
    ) VALUES (
        v_batch_id,
        v_bottle_inventory_id,
        'bottle',
        'PET Bottle Preform 500ml',
        10500,
        10000,
        500,
        'ABC Plastics Ltd.',
        'LOT-2025-001',
        'consumed',
        'WH-A',
        '2025-02-01 06:00:00',
        '2025-02-01 15:30:00'
    );
    
    -- Caps
    INSERT INTO batch_components (
        batch_id,
        component_type,
        component_name,
        planned_quantity,
        actual_consumed,
        wastage,
        supplier_name,
        supplier_batch_lot,
        material_status,
        warehouse_location_name,
        assigned_at,
        consumed_at
    ) VALUES (
        v_batch_id,
        'cap',
        '28mm Screw Cap',
        10500,
        10000,
        500,
        'Cap Solutions Ltd.',
        'CAP-2025-045',
        'consumed',
        'WH-A',
        '2025-02-01 06:00:00',
        '2025-02-01 15:30:00'
    );
    
    -- Labels
    INSERT INTO batch_components (
        batch_id,
        component_type,
        component_name,
        planned_quantity,
        actual_consumed,
        wastage,
        supplier_name,
        supplier_batch_lot,
        material_status,
        warehouse_location_name,
        assigned_at,
        consumed_at
    ) VALUES (
        v_batch_id,
        'label',
        'FreshDrip Label 500ml',
        10500,
        10000,
        500,
        'PrintPro Limited',
        'LBL-2025-089',
        'consumed',
        'WH-B',
        '2025-02-01 06:00:00',
        '2025-02-01 15:30:00'
    );
END $$;

-- ----------------------------------------------------------------------------
-- QA GATES (For Batch 1 - All Approved)
-- ----------------------------------------------------------------------------

DO $$
DECLARE
    v_batch_id UUID;
    v_qa_user_id UUID;
BEGIN
    SELECT batch_id INTO v_batch_id 
    FROM production_batches 
    WHERE batch_number = 'FD-500-20250201-001';
    
    SELECT user_id INTO v_qa_user_id
    FROM users
    WHERE email = 'admin@vilag.io';
    
    -- Gate 1: Pre-Production Check
    INSERT INTO batch_qa_gates (
        batch_id,
        gate_number,
        gate_name,
        gate_description,
        status,
        required_role,
        approved_by,
        approver_name,
        approver_role,
        approved_at,
        checklist_data
    ) VALUES (
        v_batch_id,
        1,
        'Pre-Production Check',
        'Verify component availability, material certificates, and batch planning',
        'approved',
        'qa',
        v_qa_user_id,
        'QA Specialist',
        'admin',
        '2025-02-01 06:30:00',
        '{"material_certificates_verified": true, "supplier_approved": true, "inventory_sufficient": true, "equipment_maintenance_ok": true, "comments": "All pre-production checks passed. Ready for setup."}'::jsonb
    );
    
    -- Gate 2: Line Setup Approval
    INSERT INTO batch_qa_gates (
        batch_id,
        gate_number,
        gate_name,
        gate_description,
        status,
        required_role,
        approved_by,
        approver_name,
        approver_role,
        approved_at,
        checklist_data
    ) VALUES (
        v_batch_id,
        2,
        'Line Setup Approval',
        'Verify water treatment, line parameters, and material scanning',
        'approved',
        'qa',
        v_qa_user_id,
        'QA Specialist',
        'admin',
        '2025-02-01 07:55:00',
        '{"water_quality_ok": true, "line_setup_parameters_ok": true, "materials_scanned": true, "comments": "Setup parameters within specification. Approved to start production."}'::jsonb
    );
    
    -- Gate 3: Final QA Release
    INSERT INTO batch_qa_gates (
        batch_id,
        gate_number,
        gate_name,
        gate_description,
        status,
        required_role,
        approved_by,
        approver_name,
        approver_role,
        approved_at,
        checklist_data
    ) VALUES (
        v_batch_id,
        3,
        'Final QA Release',
        'Review complete batch data and release to warehouse',
        'approved',
        'qa_manager',
        v_qa_user_id,
        'QA Manager',
        'admin',
        '2025-02-01 16:00:00',
        '{"all_ipqc_passed": true, "yield_acceptable": true, "cleaning_verified": true, "no_deviations": true, "comments": "Batch released for distribution. All quality parameters met."}'::jsonb
    );
END $$;

-- ----------------------------------------------------------------------------
-- IPQC RECORDS (For Batch 1 - Sample checks)
-- ----------------------------------------------------------------------------

DO $$
DECLARE
    v_batch_id UUID;
    v_operator_id UUID;
BEGIN
    SELECT batch_id INTO v_batch_id 
    FROM production_batches 
    WHERE batch_number = 'FD-500-20250201-001';
    
    SELECT user_id INTO v_operator_id
    FROM users
    WHERE role = 'staff'
    LIMIT 1;
    
    -- Check 1: 08:30 AM
    INSERT INTO batch_ipqc_records (
        batch_id,
        check_time,
        check_sequence,
        checked_by,
        checker_name,
        fill_volume_ml,
        fill_volume_within_spec,
        cap_torque_nm,
        cap_torque_within_spec,
        visual_inspection_passed,
        label_position_correct,
        coding_legibility_ok,
        notes
    ) VALUES (
        v_batch_id,
        '2025-02-01 08:30:00',
        1,
        v_operator_id,
        'Production Operator',
        500.5,
        true,
        1.0,
        true,
        true,
        true,
        true,
        'All parameters within specification'
    );
    
    -- Check 2: 09:00 AM
    INSERT INTO batch_ipqc_records (
        batch_id,
        check_time,
        check_sequence,
        checked_by,
        checker_name,
        fill_volume_ml,
        fill_volume_within_spec,
        cap_torque_nm,
        cap_torque_within_spec,
        visual_inspection_passed,
        label_position_correct,
        coding_legibility_ok
    ) VALUES (
        v_batch_id,
        '2025-02-01 09:00:00',
        2,
        v_operator_id,
        'Production Operator',
        499.8,
        true,
        1.1,
        true,
        true,
        true,
        true
    );
    
    -- Check 3: 09:30 AM
    INSERT INTO batch_ipqc_records (
        batch_id,
        check_time,
        check_sequence,
        checked_by,
        checker_name,
        fill_volume_ml,
        fill_volume_within_spec,
        cap_torque_nm,
        cap_torque_within_spec,
        visual_inspection_passed,
        label_position_correct,
        coding_legibility_ok
    ) VALUES (
        v_batch_id,
        '2025-02-01 09:30:00',
        3,
        v_operator_id,
        'Production Operator',
        501.2,
        true,
        0.9,
        true,
        true,
        true,
        true
    );
    
    -- Add more IPQC checks throughout the production run...
    -- (Total production time: 08:00 - 15:30, so about 14 checks every 30 min)
    
END $$;

-- ----------------------------------------------------------------------------
-- WATER TREATMENT LOG (For Batch 1)
-- ----------------------------------------------------------------------------

DO $$
DECLARE
    v_batch_id UUID;
    v_operator_id UUID;
BEGIN
    SELECT batch_id INTO v_batch_id 
    FROM production_batches 
    WHERE batch_number = 'FD-500-20250201-001';
    
    SELECT user_id INTO v_operator_id
    FROM users
    WHERE role = 'staff'
    LIMIT 1;
    
    INSERT INTO batch_water_treatment_logs (
        batch_id,
        water_source,
        water_source_approved,
        sand_filter_status,
        sand_filter_notes,
        carbon_filter_status,
        carbon_filter_notes,
        ro_conductivity_us_cm,
        ro_conductivity_within_spec,
        uv_system_status,
        uv_intensity_value,
        ozone_injection_active,
        ozone_residual_at_filler_ppm,
        ozone_residual_within_spec,
        verified_by,
        verifier_name,
        logged_at
    ) VALUES (
        v_batch_id,
        'Approved Borehole BH-01',
        true,
        true,
        'Clean, within ΔP limits',
        true,
        'Clean, within ΔP limits',
        45.2,
        true,
        true,
        98.5,
        true,
        0.25,
        true,
        v_operator_id,
        'Production Operator',
        '2025-02-01 07:30:00'
    );
END $$;

-- ----------------------------------------------------------------------------
-- LINE SETUP (For Batch 1)
-- ----------------------------------------------------------------------------

DO $$
DECLARE
    v_batch_id UUID;
    v_operator_id UUID;
BEGIN
    SELECT batch_id INTO v_batch_id 
    FROM production_batches 
    WHERE batch_number = 'FD-500-20250201-001';
    
    SELECT user_id INTO v_operator_id
    FROM users
    WHERE role = 'staff'
    LIMIT 1;
    
    INSERT INTO batch_line_setup (
        batch_id,
        rinsing_water_source,
        rinsing_pressure_mpa,
        rinsing_pressure_ok,
        filling_method,
        fill_volume_target_ml,
        fill_volume_actual_ml,
        fill_volume_ok,
        filling_temperature,
        cap_torque_target_nm,
        cap_torque_actual_nm,
        cap_torque_ok,
        line_speed_bph,
        line_speed_ok,
        verified_by,
        verifier_name,
        setup_completed_at
    ) VALUES (
        v_batch_id,
        'Ozonated RO Water',
        0.35,
        true,
        'Gravity Filling',
        500.0,
        500.2,
        true,
        'Ambient (22°C)',
        1.0,
        1.0,
        true,
        1200,
        true,
        v_operator_id,
        'Production Operator',
        '2025-02-01 07:45:00'
    );
END $$;

-- ----------------------------------------------------------------------------
-- BATCH CODING (For Batch 1)
-- ----------------------------------------------------------------------------

DO $$
DECLARE
    v_batch_id UUID;
    v_operator_id UUID;
BEGIN
    SELECT batch_id INTO v_batch_id 
    FROM production_batches 
    WHERE batch_number = 'FD-500-20250201-001';
    
    SELECT user_id INTO v_operator_id
    FROM users
    WHERE role = 'staff'
    LIMIT 1;
    
    INSERT INTO batch_coding_traceability (
        batch_id,
        batch_code_format,
        batch_code_printed,
        production_date_printed,
        expiry_date,
        best_before_date,
        shelf_life_months,
        coding_legible,
        coding_verified,
        verified_by,
        verifier_name,
        verified_at
    ) VALUES (
        v_batch_id,
        'FD-500-YYYYMMDD-Shift',
        'FD-500-20250201-DAY',
        '2025-02-01',
        '2026-02-01',
        '2026-01-15',
        12,
        true,
        true,
        v_operator_id,
        'Production Operator',
        '2025-02-01 15:00:00'
    );
END $$;

-- ----------------------------------------------------------------------------
-- CLEANING LOG (For Batch 1)
-- ----------------------------------------------------------------------------

DO $$
DECLARE
    v_batch_id UUID;
    v_operator_id UUID;
BEGIN
    SELECT batch_id INTO v_batch_id 
    FROM production_batches 
    WHERE batch_number = 'FD-500-20250201-001';
    
    SELECT user_id INTO v_operator_id
    FROM users
    WHERE role = 'staff'
    LIMIT 1;
    
    INSERT INTO batch_cleaning_logs (
        batch_id,
        line_flush_completed,
        line_flush_sop_reference,
        equipment_cleaning_completed,
        equipment_cleaning_sop_reference,
        area_sanitation_completed,
        area_sanitation_sop_reference,
        completed_by,
        cleaner_name,
        verified_by,
        verifier_name,
        completed_at,
        verified_at
    ) VALUES (
        v_batch_id,
        true,
        'QA-GMP-CIP-SOP-004',
        true,
        'QA-GMP-MAN-SOP-005',
        true,
        'QA-GMP-CLN-SOP-003',
        v_operator_id,
        'Production Operator',
        v_operator_id,
        'Supervisor',
        '2025-02-01 15:45:00',
        '2025-02-01 15:55:00'
    );
END $$;

-- ----------------------------------------------------------------------------
-- YIELD SUMMARY (For Batch 1)
-- ----------------------------------------------------------------------------

DO $$
DECLARE
    v_batch_id UUID;
BEGIN
    SELECT batch_id INTO v_batch_id 
    FROM production_batches 
    WHERE batch_number = 'FD-500-20250201-001';
    
    INSERT INTO batch_yield_summary (
        batch_id,
        bottles_started,
        good_finished_bottles,
        rejected_bottles,
        rejection_reasons,
        production_time_minutes,
        bottles_per_hour,
        downtime_minutes,
        material_wastage_percentage,
        notes,
        calculated_at
    ) VALUES (
        v_batch_id,
        10000,
        9850,
        150,
        '{"underfilled": 50, "overfilled": 30, "damaged_bottles": 40, "missing_caps": 20, "label_defects": 10}'::jsonb,
        450,
        1200,
        15,
        1.5,
        'Excellent yield. Minor rejections within normal parameters.',
        '2025-02-01 15:30:00'
    );
END $$;

-- ----------------------------------------------------------------------------
-- FINISHED GOODS (For Batch 1)
-- ----------------------------------------------------------------------------

DO $$
DECLARE
    v_batch_id UUID;
    v_product_id UUID;
    v_location_id UUID;
BEGIN
    SELECT batch_id INTO v_batch_id 
    FROM production_batches 
    WHERE batch_number = 'FD-500-20250201-001';
    
    SELECT product_id INTO v_product_id
    FROM products 
    WHERE sku = 'WB-500-001'
    LIMIT 1;
    
    SELECT location_id INTO v_location_id
    FROM locations
    WHERE location_code = 'WH-A'
    LIMIT 1;
    
    INSERT INTO batch_finished_goods (
        batch_id,
        product_id,
        quantity_produced,
        quantity_allocated,
        warehouse_location_id,
        warehouse_location_name,
        total_pallets,
        cases_per_pallet,
        bottles_per_case,
        production_date,
        best_before_date,
        expiry_date,
        inventory_status,
        added_to_inventory_at
    ) VALUES (
        v_batch_id,
        v_product_id,
        9850,
        0,
        v_location_id,
        'WH-A - Main Warehouse',
        41,
        240,
        24,
        '2025-02-01',
        '2026-01-15',
        '2026-02-01',
        'available',
        '2025-02-01 16:00:00'
    );
END $$;

-- ----------------------------------------------------------------------------
-- PENDING QA APPROVAL (For Batch 3)
-- ----------------------------------------------------------------------------

DO $$
DECLARE
    v_batch_id UUID;
BEGIN
    SELECT batch_id INTO v_batch_id 
    FROM production_batches 
    WHERE batch_number = 'FD-500-20250206-001';
    
    -- Gate 1: Pending approval
    INSERT INTO batch_qa_gates (
        batch_id,
        gate_number,
        gate_name,
        gate_description,
        status,
        required_role,
        checklist_data
    ) VALUES (
        v_batch_id,
        1,
        'Pre-Production Check',
        'Verify component availability, material certificates, and batch planning',
        'pending',
        'qa',
        '{"material_certificates_verified": false, "supplier_approved": false, "inventory_sufficient": true, "equipment_maintenance_ok": true}'::jsonb
    );
END $$;

-- ----------------------------------------------------------------------------
-- COMPONENTS FOR BATCH 2 (In Progress)
-- ----------------------------------------------------------------------------

DO $$
DECLARE
    v_batch_id UUID;
BEGIN
    SELECT batch_id INTO v_batch_id 
    FROM production_batches 
    WHERE batch_number = 'FD-500-20250205-001';
    
    -- Bottles
    INSERT INTO batch_components (
        batch_id,
        component_type,
        component_name,
        planned_quantity,
        actual_consumed,
        supplier_name,
        supplier_batch_lot,
        material_status,
        warehouse_location_name,
        assigned_at
    ) VALUES (
        v_batch_id,
        'bottle',
        'PET Bottle Preform 500ml',
        12600,
        4500,
        'ABC Plastics Ltd.',
        'LOT-2025-005',
        'committed',
        'WH-A',
        '2025-02-05 06:00:00'
    );
    
    -- Caps
    INSERT INTO batch_components (
        batch_id,
        component_type,
        component_name,
        planned_quantity,
        actual_consumed,
        supplier_name,
        supplier_batch_lot,
        material_status,
        warehouse_location_name,
        assigned_at
    ) VALUES (
        v_batch_id,
        'cap',
        '28mm Screw Cap',
        12600,
        4500,
        'Cap Solutions Ltd.',
        'CAP-2025-050',
        'committed',
        'WH-A',
        '2025-02-05 06:00:00'
    );
    
    -- Labels
    INSERT INTO batch_components (
        batch_id,
        component_type,
        component_name,
        planned_quantity,
        actual_consumed,
        supplier_name,
        supplier_batch_lot,
        material_status,
        warehouse_location_name,
        assigned_at
    ) VALUES (
        v_batch_id,
        'label',
        'FreshDrip Label 500ml',
        12600,
        4500,
        'PrintPro Limited',
        'LBL-2025-092',
        'committed',
        'WH-B',
        '2025-02-05 06:00:00'
    );
END $$;

-- ----------------------------------------------------------------------------
-- SAMPLE IPQC FOR BATCH 2 (In Progress)
-- ----------------------------------------------------------------------------

DO $$
DECLARE
    v_batch_id UUID;
    v_operator_id UUID;
BEGIN
    SELECT batch_id INTO v_batch_id 
    FROM production_batches 
    WHERE batch_number = 'FD-500-20250205-001';
    
    SELECT user_id INTO v_operator_id
    FROM users
    WHERE role = 'staff'
    LIMIT 1;
    
    -- Latest check
    INSERT INTO batch_ipqc_records (
        batch_id,
        check_time,
        check_sequence,
        checked_by,
        checker_name,
        fill_volume_ml,
        fill_volume_within_spec,
        cap_torque_nm,
        cap_torque_within_spec,
        visual_inspection_passed,
        label_position_correct,
        coding_legibility_ok,
        notes
    ) VALUES (
        v_batch_id,
        NOW() - INTERVAL '10 minutes',
        9,
        v_operator_id,
        'Production Operator',
        500.1,
        true,
        1.0,
        true,
        true,
        true,
        true,
        'Production running smoothly'
    );
END $$;

-- ============================================================================
-- COMPLETION MESSAGE
-- ============================================================================

DO $$ 
BEGIN 
    RAISE NOTICE '============================================';
    RAISE NOTICE 'SEED DATA INSERTED SUCCESSFULLY';
    RAISE NOTICE '============================================';
    RAISE NOTICE 'Sample Batches: 5';
    RAISE NOTICE '  - 1 Released';
    RAISE NOTICE '  - 1 In Progress';
    RAISE NOTICE '  - 1 Awaiting QA';
    RAISE NOTICE '  - 1 Draft';
    RAISE NOTICE '  - 1 On Hold';
    RAISE NOTICE '============================================';
END $$;
