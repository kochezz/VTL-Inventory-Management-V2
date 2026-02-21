// ============================================================================
// PRODUCTION SERVICE - FINAL VERSION
// All column names verified from actual database schema
// ============================================================================

const { pool } = require('../config/database');

// Get finished products (products that have a BOM)
const getFinishedProducts = async () => {
  try {
    console.log('📦 Fetching finished products with BOM...');
    
    // ✅ Uses: product_bom.finished_product_id (verified)
    const query = `
      SELECT DISTINCT
        p.product_id,
        p.product_name,
        p.sku,
        COUNT(pb.component_product_id) as component_count
      FROM products p
      INNER JOIN product_bom pb ON p.product_id = pb.finished_product_id
      WHERE p.is_active = true
      GROUP BY p.product_id, p.product_name, p.sku
      ORDER BY p.product_name
    `;

    const result = await pool.query(query);
    
    console.log(`✅ Found ${result.rows.length} finished products with BOM`);
    
    return result.rows;
  } catch (error) {
    console.error('❌ Error fetching finished products:', error);
    throw error;
  }
};

// Get available components for a product with multi-location inventory
const getAvailableComponents = async (productId) => {
  try {
    console.log(`📦 Fetching components for product: ${productId}`);
    
    // ✅ All column names verified from schema
    const query = `
      SELECT 
        pb.component_product_id as component_id,
        p.product_name as component_name,
        p.sku,
        pb.quantity_per_unit as quantity_required,
        'piece' as uom,
        i.location_id,
        wl.location_name,
        wl.location_code,
        wl.location_type,
        COALESCE(i.quantity_on_hand, 0) as available_quantity,
        COALESCE(i.quantity_allocated, 0) as quantity_allocated,
        COALESCE(i.quantity_available, 0) as free_quantity
      FROM product_bom pb
      INNER JOIN products p ON pb.component_product_id = p.product_id
      LEFT JOIN inventory i ON p.product_id = i.product_id
      LEFT JOIN warehouse_locations wl ON i.location_id = wl.location_id
      WHERE pb.finished_product_id = $1
      AND p.is_active = true
      ORDER BY p.product_name, wl.location_name
    `;

    const result = await pool.query(query, [productId]);
    
    // Group by component
    const componentsMap = new Map();
    
    result.rows.forEach(row => {
      const componentId = row.component_id;
      
      if (!componentsMap.has(componentId)) {
        componentsMap.set(componentId, {
          component_id: componentId,
          component_name: row.component_name,
          sku: row.sku,
          quantity_required: row.quantity_required,
          uom: row.uom,
          locations: []
        });
      }
      
      if (row.location_id) {
        componentsMap.get(componentId).locations.push({
          location_id: row.location_id,
          location_name: row.location_name,
          location_code: row.location_code,
          location_type: row.location_type,
          available_quantity: row.available_quantity,
          quantity_allocated: row.quantity_allocated,
          free_quantity: row.free_quantity,
          sufficient: row.free_quantity >= row.quantity_required
        });
      }
    });
    
    console.log(`✅ Found ${componentsMap.size} components`);
    
    return {
      components: Array.from(componentsMap.values())
    };
  } catch (error) {
    console.error('❌ Error fetching components:', error);
    throw error;
  }
};

// Validate component availability
const validateComponentAvailability = async (productId, plannedQuantity, selectedLocations) => {
  try {
    const components = await getAvailableComponents(productId);
    const validations = [];
    
    for (const component of components.components) {
      const requiredQty = component.quantity_required * plannedQuantity;
      const bufferQty = Math.ceil(requiredQty * 0.05);
      const totalRequired = requiredQty + bufferQty;
      
      const selectedLocation = selectedLocations.find(
        loc => loc.componentId === component.component_id
      );
      
      if (!selectedLocation) {
        validations.push({
          component_id: component.component_id,
          component_name: component.component_name,
          valid: false,
          reason: 'No location selected'
        });
        continue;
      }
      
      const location = component.locations.find(
        loc => loc.location_id === selectedLocation.locationId
      );
      
      if (!location) {
        validations.push({
          component_id: component.component_id,
          component_name: component.component_name,
          valid: false,
          reason: 'Invalid location'
        });
        continue;
      }
      
      validations.push({
        component_id: component.component_id,
        component_name: component.component_name,
        required_quantity: totalRequired,
        available_quantity: location.free_quantity,
        valid: location.free_quantity >= totalRequired,
        reason: location.free_quantity >= totalRequired ? 'OK' : 'Insufficient stock'
      });
    }
    
    return {
      valid: validations.every(v => v.valid),
      validations
    };
  } catch (error) {
    console.error('❌ Error validating components:', error);
    throw error;
  }
};

// Create a new production batch
const createBatch = async (batchData, userId) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    console.log('📦 Creating batch with data:', batchData);
    
    // Get product details
    const productResult = await client.query(
      'SELECT product_name, sku FROM products WHERE product_id = $1',
      [batchData.product_id]
    );

    if (productResult.rows.length === 0) {
      throw new Error('Product not found');
    }

    const product = productResult.rows[0];
    
    console.log('📦 Product details:', product);
    
    // ✅ SMART BATCH NUMBERING based on product type
    const date = new Date(batchData.production_date);
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear().toString().slice(-2);
    const dateStr = `${day}${month}${year}`;
    
    // Determine product code based on SKU or product name
    let productCode = 'R500'; // Default: 500ml Regular
    
    const skuUpper = (product.sku || '').toUpperCase();
    const nameUpper = (product.product_name || '').toUpperCase();
    
    console.log(`🔍 Analyzing product: SKU="${product.sku}", Name="${product.product_name}"`);
    
    // 5 Gallon products
    if (nameUpper.includes('5 GALLON') || nameUpper.includes('5-GALLON') || nameUpper.includes('5GAL') || skuUpper.includes('5GAL') || skuUpper.includes('5-GAL')) {
      if (nameUpper.includes('REFILL') || nameUpper.includes('RETURNABLE') || skuUpper.includes('REFILL')) {
        productCode = '5GB'; // 5 Gallon Refill (Returnable Bottles)
      } else {
        productCode = '5GA'; // 5 Gallon New (Blow-from-Preform)
      }
    }
    // 750ml products
    else if (nameUpper.includes('750ML') || nameUpper.includes('750 ML') || nameUpper.includes('750') || skuUpper.includes('750')) {
      if (nameUpper.includes('PREMIUM') || nameUpper.includes('PUREFLOW') || skuUpper.includes('PREMIUM') || skuUpper.includes('P')) {
        productCode = 'P750'; // 750ml Premium
      } else {
        productCode = 'R750'; // 750ml Regular
      }
    }
    // 500ml products (most common)
    else if (nameUpper.includes('500ML') || nameUpper.includes('500 ML') || nameUpper.includes('500') || skuUpper.includes('500')) {
      if (nameUpper.includes('PREMIUM') || nameUpper.includes('PUREFLOW') || skuUpper.includes('PREMIUM') || skuUpper.includes('P')) {
        productCode = 'P500'; // 500ml Premium
      } else {
        productCode = 'R500'; // 500ml Regular (default)
      }
    }
    // 1L products
    else if (nameUpper.includes('1L') || nameUpper.includes('1 L') || nameUpper.includes('1000ML') || nameUpper.includes('1LITER') || skuUpper.includes('1L')) {
      if (nameUpper.includes('PREMIUM') || skuUpper.includes('PREMIUM') || skuUpper.includes('P')) {
        productCode = 'P1L';
      } else {
        productCode = 'R1L';
      }
    }
    
    console.log(`🏷️ Product: ${product.product_name} (${product.sku}) → Code: ${productCode}`);
    
    // Get sequence for this specific product code and date
    const sequenceQuery = `
      SELECT COUNT(*) as count 
      FROM production_batches 
      WHERE DATE(production_date) = DATE($1)
      AND batch_number LIKE $2
    `;
    const sequenceResult = await client.query(sequenceQuery, [
      batchData.production_date,
      `PROD-${productCode}-${dateStr}-%`
    ]);
    const sequence = String(parseInt(sequenceResult.rows[0].count) + 1).padStart(3, '0');
    
    const batchNumber = `PROD-${productCode}-${dateStr}-${sequence}`;
    // ✅ FIX: Include productCode to avoid duplicate batch_record_code across products
    const batchRecordCode = `QA-PRO-BAT-${productCode}-${dateStr}-${sequence}`;
    
    console.log(`✅ Generated batch number: ${batchNumber}, record code: ${batchRecordCode}`);
    
    // ✅ Insert using verified column names from production_batches table
    const insertQuery = `
      INSERT INTO production_batches (
        batch_number,
        batch_record_code,
        product_id,
        production_date,
        production_line,
        shift,
        planned_quantity,
        status,
        created_by,
        created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP)
      RETURNING batch_id, batch_number, created_at
    `;
    
    const values = [
      batchNumber,
      batchRecordCode,
      batchData.product_id,
      batchData.production_date,
      batchData.production_line || 'Victory Star',
      batchData.shift || 'day',
      batchData.planned_quantity,
      'draft',
      userId
    ];
    
    const result = await client.query(insertQuery, values);
    const batchId = result.rows[0].batch_id;
    
    // Initialize batch record metadata for multi-stage IPQC tracking
    try {
      const stagesCount = await client.query(
        `SELECT COUNT(*) as total FROM ipqc_stage_definitions 
         WHERE product_id = $1 AND is_active = TRUE`,
        [batchData.product_id]
      );
      
      await client.query(
        `INSERT INTO batch_record_metadata (batch_id, stages_required)
         VALUES ($1, $2)
         ON CONFLICT (batch_id) DO NOTHING`,
        [batchId, stagesCount.rows[0].total]
      );
      
      console.log(`✅ Batch record metadata initialized - ${stagesCount.rows[0].total} stages required`);
    } catch (metadataError) {
      console.warn('⚠️  Could not initialize batch metadata:', metadataError.message);
      // Don't fail batch creation if metadata fails
    }
    
    await client.query('COMMIT');
    
    console.log(`✅ Batch created: ${batchNumber}`);
    
    return {
      batch: result.rows[0]
    };
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error creating batch:', error);
    throw error;
  } finally {
    client.release();
  }
};

// Assign components to a batch
const assignComponents = async (batchId, componentAssignments) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    console.log('📦 assignComponents called with:');
    console.log('  batchId:', batchId, '(type:', typeof batchId, ')');
    console.log('  componentAssignments:', JSON.stringify(componentAssignments, null, 2));
    console.log('  Number of components:', componentAssignments.length);
    
    for (let i = 0; i < componentAssignments.length; i++) {
      const assignment = componentAssignments[i];
      console.log(`\n🔍 Processing component ${i + 1}/${componentAssignments.length}:`);
      console.log('  componentId:', assignment.componentId, '(type:', typeof assignment.componentId, ')');
      console.log('  locationId:', assignment.locationId, '(type:', typeof assignment.locationId, ')');
      console.log('  quantityAssigned:', assignment.quantityAssigned);
      
      // ✅ VALIDATE before querying
      if (!assignment.componentId || assignment.componentId === 'undefined') {
        throw new Error(`Component ${i + 1}: componentId is undefined or invalid`);
      }
      if (!assignment.locationId || assignment.locationId === 'undefined') {
        throw new Error(`Component ${i + 1}: locationId is undefined or invalid`);
      }
      
      // Get inventory and product details
      const inventoryQuery = `
        SELECT 
          i.inventory_id, 
          p.product_name,
          pb.component_type,
          wl.location_id,
          wl.location_name
        FROM inventory i
        INNER JOIN products p ON i.product_id = p.product_id
        INNER JOIN warehouse_locations wl ON i.location_id = wl.location_id
        LEFT JOIN product_bom pb ON p.product_id = pb.component_product_id
        WHERE i.product_id = $1 AND i.location_id = $2
      `;
      
      console.log('  Executing query with:', {
        product_id: assignment.componentId,
        location_id: assignment.locationId
      });
      
      const inventoryResult = await client.query(inventoryQuery, [
        assignment.componentId,
        assignment.locationId
      ]);
      
      if (inventoryResult.rows.length === 0) {
        console.error(`❌ No inventory found for component ${assignment.componentId} at location ${assignment.locationId}`);
        throw new Error(`Inventory not found for component at selected location`);
      }
      
      const inventoryData = inventoryResult.rows[0];
      console.log('  ✅ Found inventory:', inventoryData);
      
      // ✅ Insert using VERIFIED column names from batch_components table
      const insertQuery = `
        INSERT INTO batch_components (
          batch_id,
          inventory_id,
          product_id,
          component_type,
          component_name,
          planned_quantity,
          quantity_required,       
          material_status,
          warehouse_location_id,
          warehouse_location_name,
          assigned_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_TIMESTAMP)                           
      `;
      
      const insertValues = [
        batchId,
        inventoryData.inventory_id,
        assignment.componentId,
        inventoryData.component_type || 'raw_material',
        inventoryData.product_name,
        assignment.quantityAssigned,
        assignment.quantityRequired, 
        'reserved',                       
        inventoryData.location_id,        
        inventoryData.location_name       
      ];
      
      console.log('  Inserting with values:', insertValues);
      
      await client.query(insertQuery, insertValues);
      
      // Update inventory allocated quantity
      const updateInventoryQuery = `
        UPDATE inventory 
        SET quantity_allocated = quantity_allocated + $1
        WHERE inventory_id = $2
      `;
      await client.query(updateInventoryQuery, [
        assignment.quantityAssigned, 
        inventoryData.inventory_id
      ]);
      
      console.log(`  ✅ Component ${i + 1} assigned successfully`);
    }
    
    await client.query('COMMIT');
    
    console.log('✅ All components assigned successfully');
    
    return {
      success: true,
      message: 'Components assigned successfully'
    };
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error assigning components:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      detail: error.detail,
      hint: error.hint,
      stack: error.stack
    });
    throw error;
  } finally {
    client.release();
  }
};

// Get batch by ID
const getBatchById = async (batchId) => {
  try {
    console.log(`📦 Fetching batch: ${batchId}`);
    
    // FIX: Using COALESCE to gracefully fall back to the products table if pb.product_name is blank
    const batchQuery = `
      SELECT 
        pb.batch_id,
        pb.batch_number,
        pb.batch_record_code,
        pb.product_id,
        COALESCE(pb.product_name, p.product_name) as product_name,
        COALESCE(p.sku, 'Unknown SKU') as sku,
        pb.production_date,
        pb.production_line,
        pb.shift,
        pb.planned_quantity,
        pb.actual_output,
        pb.rejected_bottles,
        pb.yield_percentage,
        pb.status,
        pb.line_supervisor_id,
        pb.line_supervisor_name,
        pb.created_by,
        creator.full_name as created_by_name,
        pb.created_at
      FROM production_batches pb
      LEFT JOIN products p ON pb.product_id = p.product_id
      LEFT JOIN users creator ON pb.created_by = creator.user_id
      WHERE pb.batch_id = $1
    `;
    
    const batchResult = await pool.query(batchQuery, [batchId]);
    
    if (batchResult.rows.length === 0) {
      throw new Error('Batch not found');
    }
    
    const batch = batchResult.rows[0];
    
    // Get components
   const componentsQuery = `
      SELECT 
        bc.product_id as component_id,
        bc.component_name,
        p.sku,
        bc.planned_quantity as quantity_assigned,
        bc.quantity_required,                      
        bc.material_status,
        bc.supplier_batch_lot,
        bc.warehouse_location_name as location_name,
        wl.location_code
      FROM batch_components bc
      LEFT JOIN products p ON bc.product_id = p.product_id
      LEFT JOIN warehouse_locations wl ON bc.warehouse_location_id = wl.location_id
      WHERE bc.batch_id = $1
      ORDER BY bc.component_name
    `;
    const componentsResult = await pool.query(componentsQuery, [batchId]);
    batch.components = componentsResult.rows;
    
    // Get QA gates
    const qaGatesQuery = `
      SELECT 
        gate_id,
        gate_number,
        gate_name,
        status,
        approved_by,
        approved_by_name,
        approved_at,
        rejection_reason,
        created_at
      FROM qa_gates
      WHERE batch_id = $1
      ORDER BY gate_number
    `;
    
    const qaGatesResult = await pool.query(qaGatesQuery, [batchId]);
    batch.qa_gates = qaGatesResult.rows;
    
    // Get IPQC checks 
    const ipqcQuery = `
      SELECT 
        ipqc_id,
        batch_id,
        check_sequence,
        check_time,
        
        -- Stage fields
        stage_id,
        stage_sequence,
        stage_name,
        stage_code,
        stage_category,
        
        -- Water treatment fields
        water_source,
        raw_water_ph,
        raw_water_conductivity,
        ro_conductivity,
        uv_system_status,
        ozone_system_status,
        ozone_residual_ppm,
        water_treatment_approved,
        water_treatment_notes,
        line_clearance_verified,
        equipment_cleaned,
        
        -- Filling fields
        fill_volume_ml,
        fill_volume_within_spec,
        fill_temperature,
        fill_pressure,
        rinsing_pressure,
        
        -- Capping fields
        cap_torque_nm,
        cap_torque_within_spec,
        
        -- Visual inspection fields
        visual_inspection_pass,
        visual_inspection_notes,
        label_position_correct,
        label_position_notes,
        bottle_integrity,
        seal_integrity,
        
        -- Coding fields
        coding_legible,
        coding_notes,
        tamper_evidence,
        
        -- Common fields
        all_checks_passed,
        operator_name,
        notes,
        created_at,
        qa_status,
        qa_reviewed_by,
        qa_reviewed_at,
        qa_rejection_reason
      FROM batch_ipqc_records
      WHERE batch_id = $1
      ORDER BY check_sequence ASC
    `;
    
    const ipqcResult = await pool.query(ipqcQuery, [batchId]);
    batch.ipqc_checks = ipqcResult.rows;
    
    // Get batch record metadata
    const metadataQuery = `
      SELECT * FROM batch_record_metadata
      WHERE batch_id = $1
    `;
    const metadataResult = await pool.query(metadataQuery, [batchId]);
    batch.record_metadata = metadataResult.rows[0] || null;
    
    // Get completion status
    const completionQuery = `
      SELECT * FROM batch_record_completion
      WHERE batch_id = $1
    `;
    const completionResult = await pool.query(completionQuery, [batchId]);
    batch.record_completion = completionResult.rows[0] || null;
    
    // Get counts
    batch.ipqc_count = ipqcResult.rows.length;
    batch.deviation_count = 0;
    
    console.log(`✅ Batch details retrieved with ${batch.components.length} components, ${batch.qa_gates.length} QA gates, and ${batch.ipqc_checks.length} IPQC checks`);
    
    return {
      batch
    };
  } catch (error) {
    console.error('❌ Error fetching batch:', error);
    throw error;
  }
};

// List batches
const listBatches = async (filters = {}) => {
  try {
    console.log('📋 Fetching batches with filters:', filters);
    
    // FIX: Using COALESCE to gracefully fall back to the products table if pb.product_name is blank
    let query = `
      SELECT 
        pb.batch_id,
        pb.batch_number,
        pb.batch_record_code,
        pb.product_id,
        COALESCE(pb.product_name, p.product_name) as product_name,
        COALESCE(p.sku, 'Unknown SKU') as sku,
        pb.production_date,
        pb.production_line,
        pb.shift,
        pb.planned_quantity,
        pb.actual_output,
        pb.status,
        pb.created_by,
        u.full_name as created_by_name,
        pb.created_at
      FROM production_batches pb
      LEFT JOIN products p ON pb.product_id = p.product_id
      LEFT JOIN users u ON pb.created_by = u.user_id
      WHERE 1=1
    `;
    
    const params = [];
    let paramCount = 1;
    
    if (filters.status) {
      query += ` AND pb.status = $${paramCount}`;
      params.push(filters.status);
      paramCount++;
    }
    
    if (filters.productId) {
      query += ` AND pb.product_id = $${paramCount}`;
      params.push(filters.productId);
      paramCount++;
    }
    
    if (filters.dateFrom) {
      query += ` AND pb.production_date >= $${paramCount}`;
      params.push(filters.dateFrom);
      paramCount++;
    }
    
    if (filters.dateTo) {
      query += ` AND pb.production_date <= $${paramCount}`;
      params.push(filters.dateTo);
      paramCount++;
    }
    
    query += ' ORDER BY pb.created_at DESC';
    
    const result = await pool.query(query, params);
    
    console.log(`✅ Found ${result.rows.length} batches`);
    
    return {
      batches: Array.isArray(result.rows) ? result.rows : [],
      total: result.rows.length
    };
  } catch (error) {
    console.error('❌ Error listing batches:', error);
    return {
      batches: [],
      total: 0
    };
  }
};

// ============================================================================
// STATUS TRANSITION FUNCTIONS
// ============================================================================

// Submit batch for QA (draft → awaiting_qa)
const submitForQA = async (batchId, userId) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    console.log(`📋 Submitting batch ${batchId} for QA`);
    
    // Update batch status
    await client.query(
      `UPDATE production_batches 
       SET status = 'awaiting_qa', 
           submitted_for_qa_at = CURRENT_TIMESTAMP
       WHERE batch_id = $1`,
      [batchId]
    );
    
    // Create QA Gate 1 (Pre-Production Check)
    await client.query(
      `INSERT INTO qa_gates (
        batch_id, gate_number, gate_name, status, created_at
      ) VALUES ($1, 1, 'Pre-Production Check', 'pending', CURRENT_TIMESTAMP)`,
      [batchId]
    );
    
    await client.query('COMMIT');
    
    console.log(`✅ Batch ${batchId} submitted for QA`);
    
    return { success: true, message: 'Batch submitted for QA approval' };
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error submitting for QA:', error);
    throw error;
  } finally {
    client.release();
  }
};

// Approve QA gate (Upgraded to handle Inventory Sync on Gate 4 and auto-fetch UOM)
const approveQAGate = async (batchId, gateId, userId, destinationLocationId = null) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    console.log(`✅ Approving QA gate ${gateId} for batch ${batchId}`);
    
    // Get gate info
    const gateResult = await client.query('SELECT gate_number, gate_name FROM qa_gates WHERE gate_id = $1', [gateId]);
    if (gateResult.rows.length === 0) throw new Error('QA gate not found');
    const gateNumber = gateResult.rows[0].gate_number;
    const gateName = gateResult.rows[0].gate_name;
    
    // Get user name
    const userResult = await client.query('SELECT full_name FROM users WHERE user_id = $1', [userId]);
    const userName = userResult.rows[0]?.full_name || 'Unknown';
    
    // Update gate status
    await client.query(
      `UPDATE qa_gates SET status = 'approved', approved_by = $1, approved_by_name = $2, approved_at = CURRENT_TIMESTAMP WHERE gate_id = $3`,
      [userId, userName, gateId]
    );
    
    let newStatus = '';
    
    if (gateNumber === 1) {
      newStatus = 'ready_for_setup';
    } else if (gateNumber === 4 || gateName === 'Final Release') {
      newStatus = 'released';
      
      // === MASSIVE ERP WIN: INVENTORY SYNC ===
      if (!destinationLocationId) {
         throw new Error('Destination warehouse location is required for final release.');
      }

      // 1. Get Batch output stats AND Product's Base UOM
      const batchDetails = await client.query(
        `SELECT pb.product_id, pb.actual_output, p.base_uom 
         FROM production_batches pb 
         LEFT JOIN products p ON pb.product_id = p.product_id 
         WHERE pb.batch_id = $1`,
        [batchId]
      );
      const { product_id, actual_output, base_uom } = batchDetails.rows[0];
      
      // Default to 'piece' if base_uom is somehow completely null
      const uom = base_uom || 'piece';

      if (actual_output && actual_output > 0) {
        
        // 2. Add Finished Goods to the Warehouse (Zone-B, QC Hold, etc.)
        const invCheck = await client.query(
          'SELECT inventory_id FROM inventory WHERE product_id = $1 AND location_id = $2',
          [product_id, destinationLocationId]
        );

        if (invCheck.rows.length > 0) {
          // Add to existing stock 
          // (Omitted quantity_available as it is auto-generated by the database!)
          await client.query(
            `UPDATE inventory 
             SET quantity_on_hand = quantity_on_hand + $1, updated_at = CURRENT_TIMESTAMP 
             WHERE inventory_id = $2`,
            [actual_output, invCheck.rows[0].inventory_id]
          );
        } else {
          // Create new stock line
          // Included the required `uom` field, omitted the auto-generated `quantity_available`
          await client.query(
            `INSERT INTO inventory (product_id, location_id, quantity_on_hand, uom, updated_at) 
             VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)`,
            [product_id, destinationLocationId, actual_output, uom]
          );
        }

        // 3. Deduct consumed Raw Materials from Inventory
        const components = await client.query(
            `SELECT inventory_id, actual_consumed, planned_quantity FROM batch_components WHERE batch_id = $1`,
            [batchId]
        );

        for (const comp of components.rows) {
            // Fallback to planned if actual_consumed wasn't recorded explicitly
            const consumed = comp.actual_consumed || comp.planned_quantity || 0; 
            if (consumed > 0) {
                // Reduces on-hand stock and removes the allocation lock
                await client.query(
                    `UPDATE inventory
                     SET quantity_on_hand = GREATEST(0, quantity_on_hand - $1),
                         quantity_allocated = GREATEST(0, quantity_allocated - $2),
                         updated_at = CURRENT_TIMESTAMP
                     WHERE inventory_id = $3`,
                    [consumed, comp.planned_quantity, comp.inventory_id]
                );
            }
        }
      }
    }
    
    if (newStatus) {
      await client.query(
        'UPDATE production_batches SET status = $1, qa_approved_at = CURRENT_TIMESTAMP WHERE batch_id = $2',
        [newStatus, batchId]
      );
    }
    
    await client.query('COMMIT');
    return { success: true, message: 'QA gate approved and Inventory Synced' };
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error approving QA gate:', error);
    throw error;
  } finally {
    client.release();
  }
};

// Reject QA gate
const rejectQAGate = async (batchId, gateId, userId, reason) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    console.log(`❌ Rejecting QA gate ${gateId} for batch ${batchId}`);
    
    // Get user name
    const userResult = await client.query(
      'SELECT full_name FROM users WHERE user_id = $1',
      [userId]
    );
    const userName = userResult.rows[0]?.full_name || 'Unknown';
    
    // Update gate status
    await client.query(
      `UPDATE qa_gates 
       SET status = 'rejected', 
           approved_by = $1,
           approved_by_name = $2,
           approved_at = CURRENT_TIMESTAMP,
           rejection_reason = $3
       WHERE gate_id = $4`,
      [userId, userName, reason, gateId]
    );
    
    // Update batch status to rejected
    await client.query(
      'UPDATE production_batches SET status = $1, rejection_reason = $2 WHERE batch_id = $3',
      ['rejected', reason, batchId]
    );
    
    await client.query('COMMIT');
    
    console.log(`❌ Batch ${batchId} rejected at QA gate`);
    
    return { success: true, message: 'QA gate rejected' };
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error rejecting QA gate:', error);
    throw error;
  } finally {
    client.release();
  }
};

// Start production (ready_for_setup → in_progress)
const startProduction = async (batchId, userId) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    console.log(`▶️ Starting production for batch ${batchId}`);
    
    // Get user name for supervisor
    const userResult = await client.query(
      'SELECT full_name FROM users WHERE user_id = $1',
      [userId]
    );
    const userName = userResult.rows[0]?.full_name || 'Unknown';
    
    await client.query(
      `UPDATE production_batches 
       SET status = 'in_progress',
           line_supervisor_id = $1,
           line_supervisor_name = $2,
           production_started_at = CURRENT_TIMESTAMP
       WHERE batch_id = $3`,
      [userId, userName, batchId]
    );
    
    await client.query('COMMIT');
    
    console.log(`✅ Production started for batch ${batchId}`);
    
    return { success: true, message: 'Production started' };
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error starting production:', error);
    throw error;
  } finally {
    client.release();
  }
};

// Complete production (in_progress → completed)
const completeProduction = async (batchId, productionData) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    console.log(`⏹️ Completing production for batch ${batchId}`);
    
    const { actual_output, rejected_bottles } = productionData;
    const totalProduced = actual_output + (rejected_bottles || 0);
    const yield_percentage = totalProduced > 0 ? (actual_output / totalProduced) * 100 : 0;
    
    await client.query(
      `UPDATE production_batches 
       SET status = 'completed',
           actual_output = $1,
           rejected_bottles = $2,
           yield_percentage = $3,
           production_completed_at = CURRENT_TIMESTAMP
       WHERE batch_id = $4`,
      [actual_output, rejected_bottles || 0, yield_percentage, batchId]
    );
    
    // Create QA Gate 4 (Final Release)
    await client.query(
      `INSERT INTO qa_gates (
        batch_id, gate_number, gate_name, status, created_at
      ) VALUES ($1, 4, 'Final Release', 'pending', CURRENT_TIMESTAMP)`,
      [batchId]
    );
    
    await client.query('COMMIT');
    
    console.log(`✅ Production completed for batch ${batchId}`);
    
    return { success: true, message: 'Production completed successfully' };
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error completing production:', error);
    throw error;
  } finally {
    client.release();
  }
};

// ============================================================================
// IPQC RECORDING FUNCTIONS - Phase 2.1
// ============================================================================

/**
 * Record an IPQC check
 * Called every 30 minutes during production
 */
const recordIPQC = async (batchId, ipqcData, userId) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    console.log(`📋 Recording IPQC check for batch ${batchId}`);
    
    // Verify batch is in production
    const batchCheck = await client.query(
      `SELECT status, batch_number FROM production_batches WHERE batch_id = $1`,
      [batchId]
    );
    
    if (batchCheck.rows.length === 0) {
      throw new Error('Batch not found');
    }
    
    if (batchCheck.rows[0].status !== 'in_progress') {
      throw new Error(`Cannot record IPQC - batch status is ${batchCheck.rows[0].status}, must be in_progress`);
    }
    
    // Get next sequence number
    const sequenceResult = await client.query(
      `SELECT COALESCE(MAX(check_sequence), 0) + 1 as next_sequence 
       FROM batch_ipqc_records WHERE batch_id = $1`,
      [batchId]
    );
    const checkSequence = sequenceResult.rows[0].next_sequence;
    
    // Get user name
    const userResult = await client.query(
      `SELECT full_name FROM users WHERE user_id = $1`,
      [userId]
    );
    const operatorName = userResult.rows[0]?.full_name || 'Unknown Operator';
    
    // Determine if all checks passed
    const allChecksPassed = 
      ipqcData.fill_volume_within_spec &&
      ipqcData.cap_torque_within_spec &&
      ipqcData.visual_inspection_pass &&
      ipqcData.label_position_correct &&
      ipqcData.coding_legible;
    
    // Insert IPQC record
    const insertQuery = `
      INSERT INTO batch_ipqc_records (
        batch_id,
        check_sequence,
        check_time,
        fill_volume_ml,
        fill_volume_within_spec,
        cap_torque_nm,
        cap_torque_within_spec,
        visual_inspection_pass,
        visual_inspection_notes,
        label_position_correct,
        label_position_notes,
        coding_legible,
        coding_notes,
        all_checks_passed,
        operator_id,
        operator_name,
        notes,
        qa_status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
      RETURNING ipqc_id, check_sequence, check_time, all_checks_passed, qa_status
    `;
    
    const result = await client.query(insertQuery, [
      batchId,
      checkSequence,
      ipqcData.check_time || new Date(),
      ipqcData.fill_volume_ml,
      ipqcData.fill_volume_within_spec,
      ipqcData.cap_torque_nm,
      ipqcData.cap_torque_within_spec,
      ipqcData.visual_inspection_pass,
      ipqcData.visual_inspection_notes || null,
      ipqcData.label_position_correct,
      ipqcData.label_position_notes || null,
      ipqcData.coding_legible,
      ipqcData.coding_notes || null,
      allChecksPassed,
      userId,
      operatorName,
      ipqcData.notes || null,
      'draft_check'  // Explicitly set to draft_check status
    ]);
    
    await client.query('COMMIT');
    
    const ipqcRecord = result.rows[0];
    
    console.log(`✅ IPQC Check #${checkSequence} recorded - Status: ${allChecksPassed ? 'PASSED' : 'FAILED'}`);
    
    return {
      success: true,
      message: `IPQC check #${checkSequence} recorded successfully`,
      ipqc: {
        ...ipqcRecord,
        batch_number: batchCheck.rows[0].batch_number
      }
    };
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error recording IPQC:', error);
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Get IPQC history for a batch
 */
const getIPQCHistory = async (batchId) => {
  try {
    console.log(`📊 Fetching IPQC history for batch ${batchId}`);
    
    const query = `
      SELECT 
        ipqc_id,
        check_sequence,
        check_time,
        fill_volume_ml,
        fill_volume_within_spec,
        cap_torque_nm,
        cap_torque_within_spec,
        visual_inspection_pass,
        visual_inspection_notes,
        label_position_correct,
        label_position_notes,
        coding_legible,
        coding_notes,
        all_checks_passed,
        operator_name,
        notes,
        qa_status,
        created_at
      FROM batch_ipqc_records
      WHERE batch_id = $1
      ORDER BY check_sequence ASC
    `;
    
    const result = await pool.query(query, [batchId]);
    
    // Get compliance summary
    const summaryQuery = `
      SELECT 
        total_checks,
        passed_checks,
        failed_checks,
        compliance_rate,
        first_check,
        last_check
      FROM ipqc_compliance_summary
      WHERE batch_id = $1
    `;
    
    const summaryResult = await pool.query(summaryQuery, [batchId]);
    const summary = summaryResult.rows[0] || {
      total_checks: 0,
      passed_checks: 0,
      failed_checks: 0,
      compliance_rate: 0,
      first_check: null,
      last_check: null
    };
    
    console.log(`✅ Found ${result.rows.length} IPQC checks - Compliance: ${summary.compliance_rate}%`);
    
    return {
      checks: result.rows,
      summary: summary
    };
    
  } catch (error) {
    console.error('❌ Error fetching IPQC history:', error);
    throw error;
  }
};

/**
 * Get next IPQC check due time
 * Assumes checks every 30 minutes
 */
const getNextIPQCDue = async (batchId) => {
  try {
    console.log(`⏰ Calculating next IPQC due time for batch ${batchId}`);
    
    // Get batch start time and last check
    const query = `
      SELECT 
        pb.production_started_at,
        pb.status,
        MAX(ipqc.check_time) as last_check_time
      FROM production_batches pb
      LEFT JOIN batch_ipqc_records ipqc ON pb.batch_id = ipqc.batch_id
      WHERE pb.batch_id = $1
      GROUP BY pb.batch_id, pb.production_started_at, pb.status
    `;
    
    const result = await pool.query(query, [batchId]);
    
    if (result.rows.length === 0) {
      throw new Error('Batch not found');
    }
    
    const batch = result.rows[0];
    
    if (batch.status !== 'in_progress') {
      return {
        is_due: false,
        message: 'Batch is not in production',
        next_due: null
      };
    }
    
    const now = new Date();
    const startTime = new Date(batch.production_started_at);
    const lastCheckTime = batch.last_check_time ? new Date(batch.last_check_time) : startTime;
    
    // Next check is 30 minutes after last check (or start time)
    const nextDueTime = new Date(lastCheckTime.getTime() + 30 * 60 * 1000);
    const isDue = now >= nextDueTime;
    const minutesUntilDue = Math.round((nextDueTime - now) / (60 * 1000));
    
    console.log(`⏰ Next IPQC ${isDue ? 'IS DUE NOW' : `due in ${minutesUntilDue} minutes`}`);
    
    return {
      is_due: isDue,
      next_due: nextDueTime,
      minutes_until_due: minutesUntilDue,
      last_check: lastCheckTime,
      message: isDue ? 'IPQC check is due now!' : `Next check in ${minutesUntilDue} minutes`
    };
    
  } catch (error) {
    console.error('❌ Error calculating next IPQC due:', error);
    throw error;
  }
};

/**
 * Delete IPQC record (Admin only, for corrections)
 */
const deleteIPQC = async (ipqcId, userId) => {
  try {
    console.log(`🗑️ Deleting IPQC record ${ipqcId} by user ${userId}`);
    
    const result = await pool.query(
      `DELETE FROM batch_ipqc_records 
       WHERE ipqc_id = $1 
       RETURNING batch_id, check_sequence`,
      [ipqcId]
    );
    
    if (result.rows.length === 0) {
      throw new Error('IPQC record not found');
    }
    
    console.log(`✅ IPQC record deleted - Check #${result.rows[0].check_sequence}`);
    
    return {
      success: true,
      message: 'IPQC record deleted successfully'
    };
    
  } catch (error) {
    console.error('❌ Error deleting IPQC:', error);
    throw error;
  }
};
/**
 * Get all IPQC checks pending QA review
 * @param {Object} filters - Optional filters (batch_id, product_name, etc.)
 * @returns {Promise<Array>} Array of pending IPQC checks
 */
async function getPendingIPQCReviews(filters = {}) {
  try {
    let query = `
      SELECT 
        ipqc.*,
        batch.batch_number,
        batch.product_name,
        batch.status as batch_status
      FROM ipqc_pending_qa_reviews ipqc
      JOIN production_batches batch ON ipqc.batch_id = batch.batch_id
      WHERE 1=1
    `;
    
    const params = [];
    let paramIndex = 1;
    
    // Optional filter by batch_id
    if (filters.batch_id) {
      query += ` AND ipqc.batch_id = $${paramIndex}`;
      params.push(filters.batch_id);
      paramIndex++;
    }
    
    // Optional filter by product
    if (filters.product_name) {
      query += ` AND batch.product_name ILIKE $${paramIndex}`;
      params.push(`%${filters.product_name}%`);
      paramIndex++;
    }
    
    query += ` ORDER BY ipqc.created_at ASC`;
    
    const result = await pool.query(query, params);
    
    return {
      success: true,
      pending_reviews: result.rows,
      total_count: result.rows.length
    };
  } catch (error) {
    console.error('Error getting pending IPQC reviews:', error);
    throw error;
  }
}

/**
 * Get single IPQC check details for QA review
 * @param {string} ipqcId - IPQC check ID
 * @returns {Promise<Object>} IPQC check details
 */
async function getIPQCForReview(ipqcId) {
  try {
    const query = `
      SELECT 
        ipqc.ipqc_id,
        ipqc.batch_id,
        batch.batch_number,
        batch.product_name,
        batch.planned_quantity,
        batch.status as batch_status,
        batch.production_started_at,
        ipqc.check_sequence,
        ipqc.check_time,
        
        -- Stage fields
        ipqc.stage_id,
        ipqc.stage_sequence,
        ipqc.stage_name,
        ipqc.stage_code,
        ipqc.stage_category,
        ipqc.stage_custom_data,
        
        -- Water treatment fields
        ipqc.water_source,
        ipqc.raw_water_ph,
        ipqc.raw_water_conductivity,
        ipqc.ro_conductivity,
        ipqc.uv_system_status,
        ipqc.ozone_system_status,
        ipqc.ozone_residual_ppm,
        ipqc.water_treatment_approved,
        ipqc.water_treatment_notes,
        ipqc.line_clearance_verified,
        ipqc.equipment_cleaned,
        
        -- Filling fields
        ipqc.fill_volume_ml,
        ipqc.fill_volume_within_spec,
        ipqc.fill_temperature,
        ipqc.fill_pressure,
        ipqc.rinsing_pressure,
        
        -- Capping fields
        ipqc.cap_torque_nm,
        ipqc.cap_torque_within_spec,
        
        -- Visual inspection fields
        ipqc.visual_inspection_pass,
        ipqc.visual_inspection_notes,
        ipqc.label_position_correct,
        ipqc.label_position_notes,
        ipqc.bottle_integrity,
        ipqc.seal_integrity,
        
        -- Coding fields
        ipqc.coding_legible,
        ipqc.coding_notes,
        ipqc.tamper_evidence,
        
        -- Common fields
        ipqc.all_checks_passed,
        ipqc.operator_name,
        ipqc.notes,
        ipqc.created_at,
        ipqc.qa_status,
        ipqc.qa_reviewed_by,
        ipqc.qa_reviewed_at,
        ipqc.qa_rejection_reason
      FROM batch_ipqc_records ipqc
      INNER JOIN production_batches batch ON ipqc.batch_id = batch.batch_id
      WHERE ipqc.ipqc_id = $1
    `;
    
    const result = await pool.query(query, [ipqcId]);
    console.log('📥 QA REVIEW:', result.rows[0].stage_code, result.rows[0].bottle_integrity);
    if (result.rows.length === 0) {
      throw new Error('IPQC check not found');
    }
    
    return {
      success: true,
      ipqc_check: result.rows[0]
    };
  } catch (error) {
    console.error('Error getting IPQC for review:', error);
    throw error;
  }
}

/**
 * Approve an IPQC check (QA action)
 * @param {string} ipqcId - IPQC check ID
 * @param {string} qaUserId - QA reviewer user ID
 * @param {string} qaUserName - QA reviewer name
 * @returns {Promise<Object>} Updated IPQC check
 */
async function approveIPQC(ipqcId, qaUserId, qaUserName) {
  try {
    const query = `
      UPDATE batch_ipqc_records
      SET 
        qa_status = 'qa_approved',
        qa_reviewed_by = $1,
        qa_reviewed_by_name = $2,
        qa_reviewed_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE ipqc_id = $3
      RETURNING *
    `;
    
    const result = await pool.query(query, [qaUserId, qaUserName, ipqcId]);
    
    if (result.rows.length === 0) {
      throw new Error('IPQC check not found');
    }
    
    // Log the approval
    console.log(`✅ IPQC check ${ipqcId} approved by ${qaUserName}`);
    
    return {
      success: true,
      message: 'IPQC check approved',
      ipqc_check: result.rows[0]
    };
  } catch (error) {
    console.error('Error approving IPQC:', error);
    throw error;
  }
}

/**
 * Reject an IPQC check (QA action)
 * @param {string} ipqcId - IPQC check ID
 * @param {string} qaUserId - QA reviewer user ID
 * @param {string} qaUserName - QA reviewer name
 * @param {string} rejectionReason - Reason for rejection
 * @returns {Promise<Object>} Updated IPQC check
 */
async function rejectIPQC(ipqcId, qaUserId, qaUserName, rejectionReason) {
  try {
    // Validation
    if (!rejectionReason || rejectionReason.trim().length === 0) {
      throw new Error('Rejection reason is required');
    }
    
    const query = `
      UPDATE batch_ipqc_records
      SET 
        qa_status = 'qa_rejected',
        qa_reviewed_by = $1,
        qa_reviewed_by_name = $2,
        qa_reviewed_at = CURRENT_TIMESTAMP,
        qa_rejection_reason = $3,
        updated_at = CURRENT_TIMESTAMP
      WHERE ipqc_id = $4
      RETURNING *
    `;
    
    const result = await pool.query(query, [
      qaUserId, 
      qaUserName, 
      rejectionReason,
      ipqcId
    ]);
    
    if (result.rows.length === 0) {
      throw new Error('IPQC check not found');
    }
    
    // Log the rejection
    console.log(`❌ IPQC check ${ipqcId} rejected by ${qaUserName}: ${rejectionReason}`);
    
    return {
      success: true,
      message: 'IPQC check rejected',
      ipqc_check: result.rows[0],
      action_required: 'Production team should review and take corrective action'
    };
  } catch (error) {
    console.error('Error rejecting IPQC:', error);
    throw error;
  }
}

/**
 * Get count of pending IPQC reviews
 * @returns {Promise<number>} Count of pending reviews
 */
async function getPendingIPQCCount() {
  try {
    const result = await pool.query('SELECT get_pending_ipqc_count() as count');
    return {
      success: true,
      pending_count: result.rows[0].count
    };
  } catch (error) {
    console.error('Error getting pending IPQC count:', error);
    throw error;
  }
}

/**
 * Get QA review statistics
 * @param {Object} filters - Optional filters (date_from, date_to, batch_id)
 * @returns {Promise<Object>} QA review statistics
 */
async function getIPQCQAStatistics(filters = {}) {
  try {
    let query = `
      SELECT 
        COUNT(*) as total_checks,
        COUNT(*) FILTER (WHERE qa_status = 'pending_qa_review') as pending,
        COUNT(*) FILTER (WHERE qa_status = 'qa_approved') as approved,
        COUNT(*) FILTER (WHERE qa_status = 'qa_rejected') as rejected,
        ROUND(
          COUNT(*) FILTER (WHERE qa_status = 'qa_approved')::DECIMAL / 
          NULLIF(COUNT(*) FILTER (WHERE qa_status != 'pending_qa_review'), 0) * 100,
          2
        ) as approval_rate,
        AVG(
          EXTRACT(EPOCH FROM (qa_reviewed_at - created_at))/3600
        ) FILTER (WHERE qa_reviewed_at IS NOT NULL) as avg_review_time_hours
      FROM batch_ipqc_records
      WHERE 1=1
    `;
    
    const params = [];
    let paramIndex = 1;
    
    if (filters.date_from) {
      query += ` AND created_at >= $${paramIndex}`;
      params.push(filters.date_from);
      paramIndex++;
    }
    
    if (filters.date_to) {
      query += ` AND created_at <= $${paramIndex}`;
      params.push(filters.date_to);
      paramIndex++;
    }
    
    if (filters.batch_id) {
      query += ` AND batch_id = $${paramIndex}`;
      params.push(filters.batch_id);
      paramIndex++;
    }
    
    const result = await pool.query(query, params);
    
    return {
      success: true,
      statistics: result.rows[0]
    };
  } catch (error) {
    console.error('Error getting IPQC QA statistics:', error);
    throw error;
  }
}

// ============================================================================
// DRAFT CHECK WORKFLOW - Submit IPQC for QA Review
// ============================================================================

/**
 * Submit draft IPQC checks for QA review
 * Changes status from 'draft_check' to 'pending_qa_review'
 */
async function submitIPQCForQAReview(batchId, userId) {
  try {
    console.log(`📤 Submitting draft IPQC checks for QA review - Batch: ${batchId}`);
    
    // Update all draft checks for this batch to pending_qa_review
    const result = await pool.query(
      `UPDATE batch_ipqc_records
       SET qa_status = 'pending_qa_review',
           updated_at = CURRENT_TIMESTAMP
       WHERE batch_id = $1
       AND qa_status = 'draft_check'
       RETURNING ipqc_id, check_sequence`,
      [batchId]
    );

    if (result.rows.length === 0) {
      console.log('⚠️  No draft IPQC checks found to submit');
      return {
        success: false,
        message: 'No draft IPQC checks found to submit'
      };
    }

    console.log(`✅ Submitted ${result.rows.length} IPQC check(s) for QA review`);
    
    return {
      success: true,
      message: `${result.rows.length} IPQC check(s) submitted for QA review`,
      submitted_checks: result.rows
    };
  } catch (error) {
    console.error('❌ Error submitting IPQC for QA review:', error);
    throw error;
  }
}

/**
 * Get count of draft IPQC checks for a batch
 */
async function getDraftIPQCCount(batchId) {
  try {
    const result = await pool.query(
      `SELECT COUNT(*) as draft_count
       FROM batch_ipqc_records
       WHERE batch_id = $1
       AND qa_status = 'draft_check'`,
      [batchId]
    );

    return parseInt(result.rows[0].draft_count);
  } catch (error) {
    console.error('Error getting draft IPQC count:', error);
    throw error;
  }
}

// ============================================================================
// MULTI-STAGE IPQC FUNCTIONS
// ============================================================================

/**
 * Get IPQC stage definitions for a product
 * @param {string} productId - Product ID
 * @returns {Promise<Object>} Stage definitions
 */
async function getIPQCStagesForProduct(productId) {
  try {
    console.log(`📋 Fetching IPQC stages for product: ${productId}`);
    
    const query = `
      SELECT 
        stage_id,
        stage_sequence,
        stage_name,
        stage_code,
        stage_category,
        requires_water_treatment,
        requires_fill_volume,
        requires_cap_torque,
        requires_visual_inspection,
        requires_label_position,
        requires_coding,
        requires_ozone_residual,
        requires_ph_check,
        requires_conductivity,
        custom_fields,
        frequency_minutes,
        is_required
      FROM ipqc_stage_definitions
      WHERE product_id = $1
      AND is_active = TRUE
      ORDER BY stage_sequence ASC
    `;
    
    const result = await pool.query(query, [productId]);
    
    console.log(`✅ Found ${result.rows.length} IPQC stages for product`);
    
    return {
      success: true,
      stages: result.rows
    };
  } catch (error) {
    console.error('❌ Error fetching IPQC stages:', error);
    throw error;
  }
}

/**
 * Get next required IPQC stage for a batch
 * @param {string} batchId - Batch ID
 * @returns {Promise<Object>} Next stage information
 */
async function getNextIPQCStage(batchId) {
  try {
    console.log(`🔍 Finding next IPQC stage for batch: ${batchId}`);
    
    const query = `
      SELECT 
        batch_id,
        product_id,
        batch_number,
        next_stage_sequence,
        next_stage_id,
        next_stage_name,
        next_stage_code,
        next_stage_category
      FROM batch_next_ipqc_stage
      WHERE batch_id = $1
    `;
    
    const result = await pool.query(query, [batchId]);
    
    if (result.rows.length === 0) {
      return {
        success: false,
        message: 'Batch not found or not in progress'
      };
    }
    
    const nextStage = result.rows[0];
    
    // If next_stage_id is null, all stages are complete
    if (!nextStage.next_stage_id) {
      console.log('✅ All IPQC stages complete for this batch');
      return {
        success: true,
        all_stages_complete: true,
        message: 'All IPQC stages are complete'
      };
    }
    
    // Get detailed stage requirements
    const stageDetails = await pool.query(
      `SELECT * FROM ipqc_stage_definitions WHERE stage_id = $1`,
      [nextStage.next_stage_id]
    );
    
    console.log(`✅ Next stage: ${nextStage.next_stage_name} (Sequence ${nextStage.next_stage_sequence})`);
    
    return {
      success: true,
      all_stages_complete: false,
      next_stage: {
        ...nextStage,
        stage_details: stageDetails.rows[0]
      }
    };
  } catch (error) {
    console.error('❌ Error finding next IPQC stage:', error);
    throw error;
  }
}

/**
 * Record a multi-stage IPQC check
 * @param {string} batchId - Batch ID
 * @param {Object} ipqcData - IPQC check data including stage info
 * @param {Object} user - User recording the check
 * @returns {Promise<Object>} Recorded IPQC check
 */
    async function recordMultiStageIPQC(batchId, ipqcData, user) {
  try {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📥 Backend recordMultiStageIPQC received:');
    console.log('   stage_code:', ipqcData.stage_code);
    console.log('   stage_custom_data:', ipqcData.stage_custom_data);
    console.log('   Type:', typeof ipqcData.stage_custom_data);
    
    if (ipqcData.stage_code === 'SHRINK_SEAL') {
      console.log('   🔍 SHRINK_SEAL Data Check:');
      console.log('      stage_custom_data:', JSON.stringify(ipqcData.stage_custom_data));
      if (ipqcData.stage_custom_data && typeof ipqcData.stage_custom_data === 'object') {
        console.log('      Keys:', Object.keys(ipqcData.stage_custom_data));
      }
    }
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        
    // Verify this is the correct next stage
    const nextStage = await getNextIPQCStage(batchId);
    
    if (nextStage.all_stages_complete) {
      throw new Error('All IPQC stages are already complete for this batch');
    }
    
    if (nextStage.next_stage.next_stage_sequence !== ipqcData.stage_sequence) {
      throw new Error(
        `Cannot record stage ${ipqcData.stage_sequence}. ` +
        `Next required stage is ${nextStage.next_stage.next_stage_sequence}: ${nextStage.next_stage.next_stage_name}`
      );
    }
    
    // Get current sequence number
    const seqResult = await pool.query(
      `SELECT COALESCE(MAX(check_sequence), 0) + 1 as next_sequence
       FROM batch_ipqc_records
       WHERE batch_id = $1`,
      [batchId]
    );
    const checkSequence = seqResult.rows[0].next_sequence;
    
    // Build INSERT query with all fields
    const insertQuery = `
      INSERT INTO batch_ipqc_records (
        batch_id,
        check_sequence,
        check_time,
        stage_id,
        stage_sequence,
        stage_name,
        stage_code,        -- Added
        stage_category,
        
        -- Water treatment fields
        water_source,
        raw_water_ph,
        raw_water_conductivity,
        ro_conductivity,
        uv_system_status,
        ozone_system_status,
        ozone_residual_ppm,
        water_treatment_approved,
        water_treatment_notes,
        
        -- Filling fields
        fill_volume_ml,
        fill_volume_within_spec,
        fill_temperature,
        fill_pressure,
        rinsing_pressure,
        
        -- Capping fields
        cap_torque_nm,
        cap_torque_within_spec,
        
        -- Inspection fields
        visual_inspection_pass,
        visual_inspection_notes,
        label_position_correct,
        label_position_notes,
        coding_legible,
        coding_notes,
        bottle_integrity,
        seal_integrity,
        tamper_evidence,
        
        -- Equipment
        equipment_cleaned,
        line_clearance_verified,
        
        -- Completion
        all_checks_passed,
        
        -- Operator
        operator_id,
        operator_name,
        notes,
        
        -- QA Status
        qa_status,
        
        -- Custom data
        stage_custom_data
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8,
        $9, $10, $11, $12, $13, $14, $15, $16, $17,
        $18, $19, $20, $21, $22,
        $23, $24,
        $25, $26, $27, $28, $29, $30, $31, $32, $33,
        $34, $35,
        $36,
        $37, $38, $39,
        $40,
        $41
      )
      RETURNING *
    `;
    
    const values = [
      batchId,                                    // $1
      checkSequence,                              // $2
      ipqcData.check_time || new Date(),         // $3
      ipqcData.stage_id,                          // $4
      ipqcData.stage_sequence,                    // $5
      ipqcData.stage_name,                        // $6
      ipqcData.stage_code,                        // $7
      ipqcData.stage_category,                    // $8
      
      // Water treatment
      ipqcData.water_source || null,             // $9
      ipqcData.raw_water_ph || null,             // $10
      ipqcData.raw_water_conductivity || null,   // $11
      ipqcData.ro_conductivity || null,          // $12
      ipqcData.uv_system_status || null,         // $13
      ipqcData.ozone_system_status || null,      // $14
      ipqcData.ozone_residual_ppm || null,       // $15
      ipqcData.water_treatment_approved || null, // $16
      ipqcData.water_treatment_notes || null,    // $17
      
      // Filling
      ipqcData.fill_volume_ml || null,           // $18
      ipqcData.fill_volume_within_spec || null,  // $19
      ipqcData.fill_temperature || null,         // $20
      ipqcData.fill_pressure || null,            // $21
      ipqcData.rinsing_pressure || null,         // $22
      
      // Capping
      ipqcData.cap_torque_nm || null,            // $23
      ipqcData.cap_torque_within_spec || null,   // $24
      
      // Inspection
      ipqcData.visual_inspection_pass || null,   // $25
      ipqcData.visual_inspection_notes || null,  // $26
      ipqcData.label_position_correct || null,   // $27
      ipqcData.label_position_notes || null,     // $28
      ipqcData.coding_legible || null,           // $29
      ipqcData.coding_notes || null,             // $30
      ipqcData.bottle_integrity || null,         // $31
      ipqcData.seal_integrity || null,           // $32
      ipqcData.tamper_evidence || null,          // $33
      
      // Equipment
      ipqcData.equipment_cleaned || null,        // $34
      ipqcData.line_clearance_verified || null,  // $35
      
      // Completion
      ipqcData.all_checks_passed || true,        // $36
      
      // Operator
      user.user_id,                               // $37
      user.full_name,                             // $38
      ipqcData.notes || null,                     // $39
      
      // QA Status
      'draft_check',                              // $40
      
      // Custom
      JSON.stringify(ipqcData.stage_custom_data || {})  // $41
    ];
    
    const result = await pool.query(insertQuery, values);
    const ipqcCheck = result.rows[0];
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('✅ Database RETURNING * shows:');
console.log('   ipqc_id:', ipqcCheck.ipqc_id);
console.log('   stage_code:', ipqcCheck.stage_code);
console.log('   stage_custom_data:', ipqcCheck.stage_custom_data);
console.log('   Type:', typeof ipqcCheck.stage_custom_data);
if (ipqcCheck.stage_code === 'SHRINK_SEAL') {
  console.log('   🔍 SHRINK_SEAL saved as:', JSON.stringify(ipqcCheck.stage_custom_data));
}
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

console.log('✅ IPQC check recorded:', ipqcCheck.ipqc_id);
    
    return {
      success: true,
      message: `IPQC check recorded successfully`,
      ipqc_check: result.rows[0]
    };
  } catch (error) {
    console.error('❌ Error recording multi-stage IPQC:', error);
    throw error;
  }
}

/**
 * Get batch record completion status
 * @param {string} batchId - Batch ID
 * @returns {Promise<Object>} Completion status
 */
async function getBatchRecordCompletion(batchId) {
  try {
    const query = `
      SELECT * FROM batch_record_completion
      WHERE batch_id = $1
    `;
    
    const result = await pool.query(query, [batchId]);
    
    if (result.rows.length === 0) {
      return {
        success: false,
        message: 'Batch not found'
      };
    }
    
    return {
      success: true,
      completion: result.rows[0]
    };
  } catch (error) {
    console.error('❌ Error getting batch record completion:', error);
    throw error;
  }
}

/**
 * Initialize batch record metadata when batch is created
 * @param {string} batchId - Batch ID
 * @param {string} productId - Product ID
 * @returns {Promise<Object>} Created metadata
 */
async function initializeBatchRecordMetadata(batchId, productId) {
  try {
    console.log(`📝 Initializing batch record metadata for: ${batchId}`);
    
    // Count required stages for this product
    const stagesCount = await pool.query(
      `SELECT COUNT(*) as total FROM ipqc_stage_definitions WHERE product_id = $1 AND is_active = TRUE`,
      [productId]
    );
    
    const query = `
      INSERT INTO batch_record_metadata (
        batch_id,
        stages_required
      ) VALUES ($1, $2)
      ON CONFLICT (batch_id) DO UPDATE
      SET stages_required = $2,
          updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `;
    
    const result = await pool.query(query, [batchId, stagesCount.rows[0].total]);
    
    console.log(`✅ Batch record metadata initialized - ${stagesCount.rows[0].total} stages required`);
    
    return {
      success: true,
      metadata: result.rows[0]
    };
  } catch (error) {
    console.error('❌ Error initializing batch record metadata:', error);
    throw error;
  }
}

module.exports = {
  getFinishedProducts,
  getAvailableComponents,
  validateComponentAvailability,
  createBatch,
  assignComponents,
  submitForQA,
  approveQAGate,
  rejectQAGate,
  startProduction,
  completeProduction,
  getBatchById,
  listBatches,
  recordIPQC,
  getIPQCHistory,
  getNextIPQCDue,
  deleteIPQC,
  getPendingIPQCReviews,
  getIPQCForReview,
  approveIPQC,
  rejectIPQC,
  getPendingIPQCCount,
  getIPQCQAStatistics,
  submitIPQCForQAReview,
  getDraftIPQCCount,
  // Multi-stage IPQC functions
  getIPQCStagesForProduct,
  getNextIPQCStage,
  recordMultiStageIPQC,
  getBatchRecordCompletion,
  initializeBatchRecordMetadata,
};