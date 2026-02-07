// backend/src/services/production-service.js
// ✅ FINAL VERSION - No p.size, No pb.updated_at references
// Date: February 6, 2026

const { pool } = require('../config/database');

/**
 * Get list of finished products that have a BOM (Bill of Materials)
 * These are products that can be manufactured
 */
async function getFinishedProducts() {
  const query = `
    SELECT DISTINCT 
      p.product_id,
      p.product_name,
      p.sku,
      p.description,
      p.base_uom,
      p.category_id,
      COUNT(pb.component_product_id) as component_count,
      true as has_bom
    FROM products p
    INNER JOIN product_bom pb ON p.product_id = pb.parent_product_id
    WHERE p.is_active = true
    GROUP BY p.product_id, p.product_name, p.sku, p.description, p.base_uom, p.category_id
    ORDER BY p.product_name
  `;

  const result = await pool.query(query);
  return result.rows;
}

/**
 * Get available components for a finished product with multi-location inventory
 */
async function getAvailableComponents(productId) {
  const query = `
    SELECT 
      pb.component_product_id as component_id,
      p.product_name as component_name,
      p.sku,
      p.description,
      pb.quantity_required,
      pb.uom,
      i.location_id,
      wl.location_name,
      wl.location_code,
      wl.location_type,
      COALESCE(i.quantity_on_hand, 0) as available_quantity,
      COALESCE(i.quantity_reserved, 0) as quantity_reserved,
      (COALESCE(i.quantity_on_hand, 0) - COALESCE(i.quantity_reserved, 0)) as free_quantity,
      i.last_updated
    FROM product_bom pb
    INNER JOIN products p ON pb.component_product_id = p.product_id
    LEFT JOIN inventory i ON p.product_id = i.product_id
    LEFT JOIN warehouse_locations wl ON i.location_id = wl.location_id
    WHERE pb.parent_product_id = $1
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
        description: row.description,
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
        quantity_reserved: row.quantity_reserved,
        free_quantity: row.free_quantity,
        sufficient: row.free_quantity >= row.quantity_required,
        last_updated: row.last_updated
      });
    }
  });
  
  return {
    components: Array.from(componentsMap.values())
  };
}

/**
 * Validate component availability for production
 */
async function validateComponentAvailability(productId, plannedQuantity, selectedLocations) {
  const components = await getAvailableComponents(productId);
  const validations = [];
  
  for (const component of components.components) {
    const requiredQty = component.quantity_required * plannedQuantity;
    const bufferQty = Math.ceil(requiredQty * 0.05); // 5% buffer
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
}

/**
 * Create a new production batch
 */
async function createBatch(batchData, userId) {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Generate batch number: SKU-YYYYMMDD-SEQUENCE
    const today = new Date().toISOString().split('T')[0].replace(/-/g, '');
    const sequenceQuery = `
      SELECT COUNT(*) as count 
      FROM production_batches 
      WHERE batch_number LIKE $1
    `;
    const sequenceResult = await client.query(sequenceQuery, [`${batchData.sku}-${today}-%`]);
    const sequence = String(parseInt(sequenceResult.rows[0].count) + 1).padStart(3, '0');
    const batchNumber = `${batchData.sku}-${today}-${sequence}`;
    
    // Insert batch
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
    
    const batchRecordCode = `QA-PRO-BAT-LOG-${sequence}`;
    
    const values = [
      batchNumber,
      batchRecordCode,
      batchData.productId,
      batchData.productionDate,
      batchData.productionLine || 'Victory Star',
      batchData.shift || 'day',
      batchData.plannedQuantity,
      'draft',
      userId
    ];
    
    const result = await client.query(insertQuery, values);
    
    await client.query('COMMIT');
    
    return {
      success: true,
      batch: result.rows[0]
    };
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating batch:', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Assign components to a batch from specific warehouse locations
 */
async function assignComponents(batchId, componentAssignments, userId) {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    for (const assignment of componentAssignments) {
      // Insert component assignment
      const insertQuery = `
        INSERT INTO batch_components (
          batch_id,
          component_product_id,
          inventory_id,
          quantity_required,
          quantity_assigned,
          material_status,
          assigned_by,
          assigned_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
      `;
      
      // Get inventory_id for the selected location
      const inventoryQuery = `
        SELECT inventory_id 
        FROM inventory 
        WHERE product_id = $1 AND location_id = $2
      `;
      const inventoryResult = await client.query(inventoryQuery, [
        assignment.componentId,
        assignment.locationId
      ]);
      
      if (inventoryResult.rows.length === 0) {
        throw new Error(`Inventory not found for component ${assignment.componentId} at location ${assignment.locationId}`);
      }
      
      const inventoryId = inventoryResult.rows[0].inventory_id;
      
      await client.query(insertQuery, [
        batchId,
        assignment.componentId,
        inventoryId,
        assignment.quantityRequired,
        assignment.quantityAssigned,
        'reserved', // Initial status
        userId
      ]);
      
      // Update inventory reserved quantity
      const updateInventoryQuery = `
        UPDATE inventory 
        SET quantity_reserved = quantity_reserved + $1
        WHERE inventory_id = $2
      `;
      await client.query(updateInventoryQuery, [assignment.quantityAssigned, inventoryId]);
    }
    
    await client.query('COMMIT');
    
    return {
      success: true,
      message: 'Components assigned successfully'
    };
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error assigning components:', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Submit batch for QA approval (creates Gate 1 record)
 */
async function submitForQA(batchId, userId) {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Update batch status
    await client.query(
      'UPDATE production_batches SET status = $1 WHERE batch_id = $2',
      ['awaiting_qa', batchId]
    );
    
    // Create QA Gate 1 record
    const insertGateQuery = `
      INSERT INTO batch_qa_gates (
        batch_id,
        gate_number,
        gate_name,
        status,
        created_at
      ) VALUES ($1, 1, 'Pre-Production Check', 'pending', CURRENT_TIMESTAMP)
    `;
    await client.query(insertGateQuery, [batchId]);
    
    await client.query('COMMIT');
    
    return {
      success: true,
      message: 'Batch submitted for QA approval'
    };
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error submitting for QA:', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Get batch details by ID with all related data
 */
async function getBatchById(batchId) {
  // Main batch query - NO pb.updated_at reference
  const batchQuery = `
    SELECT 
      pb.batch_id,
      pb.batch_number,
      pb.batch_record_code,
      pb.product_id,
      p.product_name,
      p.sku,
      pb.production_date,
      pb.production_line,
      pb.shift,
      pb.planned_quantity,
      pb.actual_output,
      pb.status,
      pb.line_supervisor_id,
      supervisor.full_name as line_supervisor_name,
      pb.created_by,
      creator.full_name as created_by_name,
      pb.created_at
    FROM production_batches pb
    INNER JOIN products p ON pb.product_id = p.product_id
    LEFT JOIN users creator ON pb.created_by = creator.user_id
    LEFT JOIN users supervisor ON pb.line_supervisor_id = supervisor.user_id
    WHERE pb.batch_id = $1
  `;
  
  const batchResult = await pool.query(batchQuery, [batchId]);
  
  if (batchResult.rows.length === 0) {
    return null;
  }
  
  const batch = batchResult.rows[0];
  
  // Get assigned components
  const componentsQuery = `
    SELECT 
      bc.component_product_id as component_id,
      p.product_name as component_name,
      p.sku,
      bc.quantity_required,
      bc.quantity_assigned,
      bc.material_status,
      bc.supplier_batch_lot,
      wl.location_code,
      wl.location_name
    FROM batch_components bc
    INNER JOIN products p ON bc.component_product_id = p.product_id
    LEFT JOIN inventory i ON bc.inventory_id = i.inventory_id
    LEFT JOIN warehouse_locations wl ON i.location_id = wl.location_id
    WHERE bc.batch_id = $1
    ORDER BY p.product_name
  `;
  
  const componentsResult = await pool.query(componentsQuery, [batchId]);
  batch.components = componentsResult.rows;
  
  // Get QA gates
  const qaGatesQuery = `
    SELECT 
      qg.gate_id,
      qg.gate_number,
      qg.gate_name,
      qg.status,
      qg.approved_by,
      u.full_name as approved_by_name,
      qg.approved_at,
      qg.rejection_reason
    FROM batch_qa_gates qg
    LEFT JOIN users u ON qg.approved_by = u.user_id
    WHERE qg.batch_id = $1
    ORDER BY qg.gate_number
  `;
  
  const qaGatesResult = await pool.query(qaGatesQuery, [batchId]);
  batch.qa_gates = qaGatesResult.rows;
  
  // Get IPQC count
  const ipqcQuery = `
    SELECT COUNT(*) as count 
    FROM batch_ipqc_records 
    WHERE batch_id = $1
  `;
  const ipqcResult = await pool.query(ipqcQuery, [batchId]);
  batch.ipqc_count = parseInt(ipqcResult.rows[0].count);
  
  // Get deviation count
  const deviationQuery = `
    SELECT COUNT(*) as count 
    FROM batch_deviations 
    WHERE batch_id = $1
  `;
  const deviationResult = await pool.query(deviationQuery, [batchId]);
  batch.deviation_count = parseInt(deviationResult.rows[0].count);
  
  return batch;
}

/**
 * List batches with optional filters
 */
async function listBatches(filters = {}) {
  console.log('📋 Fetching batches with filters:', filters);
  
  let query = `
    SELECT 
      pb.batch_id,
      pb.batch_number,
      pb.batch_record_code,
      pb.product_id,
      p.product_name,
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
    INNER JOIN products p ON pb.product_id = p.product_id
    LEFT JOIN users u ON pb.created_by = u.user_id
    WHERE 1=1
  `;
  
  const params = [];
  let paramCount = 1;
  
  // Add filters
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
  
  // Order by created_at descending
  query += ' ORDER BY pb.created_at DESC';
  
  // Add pagination if specified
  if (filters.limit) {
    query += ` LIMIT $${paramCount}`;
    params.push(filters.limit);
    paramCount++;
  }
  
  if (filters.offset) {
    query += ` OFFSET $${paramCount}`;
    params.push(filters.offset);
  }
  
  const result = await pool.query(query, params);
  
  console.log(`✅ Found ${result.rows.length} batches`);
  
  return {
    batches: result.rows,
    total: result.rows.length,
    filters
  };
}

module.exports = {
  getFinishedProducts,
  getAvailableComponents,
  validateComponentAvailability,
  createBatch,
  assignComponents,
  submitForQA,
  getBatchById,
  listBatches
};
