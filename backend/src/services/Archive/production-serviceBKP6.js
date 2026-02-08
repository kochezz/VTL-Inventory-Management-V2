// ============================================================================
// PRODUCTION SERVICE - FINAL VERSION
// All column names verified from actual database schema
// Date: February 7, 2026
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
    const batchRecordCode = `QA-PRO-BAT-${dateStr}-${sequence}`;
    
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
          material_status,
          warehouse_location_id,
          warehouse_location_name,
          assigned_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP)
      `;
      
      const insertValues = [
        batchId,
        inventoryData.inventory_id,
        assignment.componentId,
        inventoryData.component_type || 'raw_material',
        inventoryData.product_name,
        assignment.quantityAssigned,
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
    
    // Main batch query
    const batchQuery = `
      SELECT 
        pb.batch_id,
        pb.batch_number,
        pb.batch_record_code,
        pb.product_id,
        pb.product_name,
        p.sku,
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
    
    // Get counts (placeholders for now - we'll add IPQC and deviation tables later)
    batch.ipqc_count = 0;
    batch.deviation_count = 0;
    
    console.log(`✅ Batch details retrieved with ${batch.components.length} components and ${batch.qa_gates.length} QA gates`);
    
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
    
    let query = `
      SELECT 
        pb.batch_id,
        pb.batch_number,
        pb.batch_record_code,
        pb.product_id,
        pb.product_name,
        p.sku,
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

// Approve QA gate
const approveQAGate = async (batchId, gateId, userId) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    console.log(`✅ Approving QA gate ${gateId} for batch ${batchId}`);
    
    // Get gate info and user name
    const gateResult = await client.query(
      'SELECT gate_number FROM qa_gates WHERE gate_id = $1',
      [gateId]
    );
    
    if (gateResult.rows.length === 0) {
      throw new Error('QA gate not found');
    }
    
    const gateNumber = gateResult.rows[0].gate_number;
    
    // Get user name
    const userResult = await client.query(
      'SELECT full_name FROM users WHERE user_id = $1',
      [userId]
    );
    const userName = userResult.rows[0]?.full_name || 'Unknown';
    
    // Update gate status
    await client.query(
      `UPDATE qa_gates 
       SET status = 'approved', 
           approved_by = $1,
           approved_by_name = $2,
           approved_at = CURRENT_TIMESTAMP
       WHERE gate_id = $3`,
      [userId, userName, gateId]
    );
    
    // Update batch status based on gate
    let newStatus = '';
    if (gateNumber === 1) {
      newStatus = 'ready_for_setup';
    } else if (gateNumber === 4) {
      newStatus = 'released';
      // TODO: Update finished goods inventory here
    }
    
    if (newStatus) {
      await client.query(
        'UPDATE production_batches SET status = $1, qa_approved_at = CURRENT_TIMESTAMP WHERE batch_id = $2',
        [newStatus, batchId]
      );
    }
    
    await client.query('COMMIT');
    
    console.log(`✅ QA Gate ${gateNumber} approved for batch ${batchId}`);
    
    return { success: true, message: 'QA gate approved' };
    
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
  listBatches
};
