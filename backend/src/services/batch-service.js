// src/services/batch-service.js
// Batch Service - Business logic for batch management
// Handles FIFO/FEFO selection, QC status updates, batch operations

const db = require('../utils/db');

/**
 * Generate batch number
 * Format: BATCH-PROD-YYYYMMDD-NNN
 */
function generateBatchNumber(productSKU) {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  
  // Extract product prefix (first part of SKU)
  const prefix = productSKU.split('-')[0].substring(0, 4).toUpperCase();
  
  return `BATCH-${prefix}-${dateStr}-${random}`;
}

/**
 * Create a new batch
 */
async function createBatch(data) {
  const errors = [];
  
  if (!data.product_id) errors.push('Product ID is required');
  if (!data.initial_quantity || data.initial_quantity <= 0) {
    errors.push('Initial quantity must be greater than 0');
  }
  
  if (errors.length > 0) {
    throw new Error(`Validation failed: ${errors.join(', ')}`);
  }
  
  // Generate batch number if not provided
  const batchNumber = data.batch_number || generateBatchNumber(data.product_sku || 'PROD');
  
  const result = await db.query(
    `INSERT INTO batches (
      batch_number,
      product_id,
      supplier_id,
      received_date,
      manufacture_date,
      expiry_date,
      supplier_name,
      qc_status,
      initial_quantity,
      current_quantity,
      uom,
      status,
      notes
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
    RETURNING *`,
    [
      batchNumber,
      data.product_id,
      data.supplier_id || null,
      data.received_date || new Date(),
      data.manufacture_date || null,
      data.expiry_date || null,
      data.supplier_name || null,
      data.qc_status || 'pending',
      data.initial_quantity,
      data.current_quantity || data.initial_quantity,
      data.uom,
      data.status || 'active',
      data.notes || null,
    ]
  );
  
  return result.rows[0];
}

/**
 * Update batch QC status
 */
async function updateBatchQCStatus(batchId, qcStatus, qcNotes = null, userId = null) {
  const validStatuses = ['pending', 'in_progress', 'approved', 'rejected', 'on_hold'];
  
  if (!validStatuses.includes(qcStatus)) {
    throw new Error(`Invalid QC status. Must be one of: ${validStatuses.join(', ')}`);
  }
  
  return await db.transaction(async (client) => {
    // Update batch QC status
    const result = await client.query(
      `UPDATE batches 
       SET qc_status = $1,
           qc_notes = $2,
           qc_date = CASE WHEN $4 IN ('approved', 'rejected') THEN CURRENT_TIMESTAMP ELSE qc_date END,
           updated_at = CURRENT_TIMESTAMP
       WHERE batch_id = $3
       RETURNING *`,
      [qcStatus, qcNotes, batchId, qcStatus]
    );
    
    if (result.rows.length === 0) {
      throw new Error('Batch not found');
    }
    
    const batch = result.rows[0];
    /*
    // If approved, make inventory available
    if (qcStatus === 'approved') {
      await client.query(
        `UPDATE inventory 
         SET quantity_available = quantity_on_hand - COALESCE(quantity_allocated, 0)
         WHERE batch_id = $1`,
        [batchId]
      );
    }
    
    // If rejected or on hold, make inventory unavailable
    if (qcStatus === 'rejected' || qcStatus === 'on_hold') {
      await client.query(
        `UPDATE inventory 
         SET quantity_available = 0
         WHERE batch_id = $1`,
        [batchId]
      );
    }
    */
    return batch;
  });
}

/**
 * Get batch details by batch number
 */
async function getBatchByNumber(batchNumber) {
  const result = await db.query(
    `SELECT 
      b.*,
      p.sku,
      p.product_name,
      s.supplier_name as supplier_full_name,
      s.supplier_code
    FROM batches b
    JOIN products p ON b.product_id = p.product_id
    LEFT JOIN suppliers s ON b.supplier_id = s.supplier_id
    WHERE b.batch_number = $1`,
    [batchNumber]
  );
  
  if (result.rows.length === 0) {
    throw new Error(`Batch "${batchNumber}" not found`);
  }
  
  return result.rows[0];
}

/**
 * Get available batches for a product using FIFO (First In, First Out)
 */
async function getAvailableBatchesFIFO(productId, locationId = null, requiredQuantity = null) {
  let query = `
    SELECT 
      b.*,
      i.location_id,
      wl.location_code,
      wl.location_name,
      COALESCE(i.quantity_available, 0) as available_quantity
    FROM batches b
    JOIN inventory i ON b.batch_id = i.batch_id
    JOIN warehouse_locations wl ON i.location_id = wl.location_id
    WHERE b.product_id = $1
      AND b.status = 'active'
      AND b.qc_status = 'approved'
      AND i.quantity_available > 0
  `;
  
  const params = [productId];
  
  if (locationId) {
    query += ` AND i.location_id = $2`;
    params.push(locationId);
  }
  
  // FIFO: Order by received date (oldest first)
  query += ` ORDER BY b.received_date ASC, b.manufacture_date ASC`;
  
  const result = await db.query(query, params);
  
  // If required quantity specified, return only batches needed
  if (requiredQuantity) {
    let remaining = requiredQuantity;
    const selectedBatches = [];
    
    for (const batch of result.rows) {
      if (remaining <= 0) break;
      
      const batchQty = Math.min(parseFloat(batch.available_quantity), remaining);
      selectedBatches.push({
        ...batch,
        allocated_quantity: batchQty,
      });
      remaining -= batchQty;
    }
    
    return {
      batches: selectedBatches,
      total_allocated: requiredQuantity - remaining,
      fully_allocated: remaining <= 0,
      shortage: remaining > 0 ? remaining : 0,
    };
  }
  
  return result.rows;
}

/**
 * Get available batches for a product using FEFO (First Expired, First Out)
 */
async function getAvailableBatchesFEFO(productId, locationId = null, requiredQuantity = null) {
  let query = `
    SELECT 
      b.*,
      i.location_id,
      wl.location_code,
      wl.location_name,
      COALESCE(i.quantity_available, 0) as available_quantity,
      (b.expiry_date - CURRENT_DATE) as days_until_expiry
    FROM batches b
    JOIN inventory i ON b.batch_id = i.batch_id
    JOIN warehouse_locations wl ON i.location_id = wl.location_id
    WHERE b.product_id = $1
      AND b.status = 'active'
      AND b.qc_status = 'approved'
      AND b.expiry_date IS NOT NULL
      AND b.expiry_date > CURRENT_DATE
      AND i.quantity_available > 0
  `;
  
  const params = [productId];
  
  if (locationId) {
    query += ` AND i.location_id = $2`;
    params.push(locationId);
  }
  
  // FEFO: Order by expiry date (earliest expiry first)
  query += ` ORDER BY b.expiry_date ASC, b.received_date ASC`;
  
  const result = await db.query(query, params);
  
  // If required quantity specified, return only batches needed
  if (requiredQuantity) {
    let remaining = requiredQuantity;
    const selectedBatches = [];
    
    for (const batch of result.rows) {
      if (remaining <= 0) break;
      
      const batchQty = Math.min(parseFloat(batch.available_quantity), remaining);
      selectedBatches.push({
        ...batch,
        allocated_quantity: batchQty,
      });
      remaining -= batchQty;
    }
    
    return {
      batches: selectedBatches,
      total_allocated: requiredQuantity - remaining,
      fully_allocated: remaining <= 0,
      shortage: remaining > 0 ? remaining : 0,
    };
  }
  
  return result.rows;
}

/**
 * Get batches expiring within specified days
 */
async function getExpiringBatches(days = 30, productId = null, locationId = null) {
  let query = `
    SELECT 
      b.*,
      p.sku,
      p.product_name,
      i.location_id,
      wl.location_code,
      wl.location_name,
      COALESCE(i.quantity_on_hand, 0) as quantity_on_hand,
      (b.expiry_date - CURRENT_DATE) as days_until_expiry
    FROM batches b
    JOIN products p ON b.product_id = p.product_id
    LEFT JOIN inventory i ON b.batch_id = i.batch_id
    LEFT JOIN warehouse_locations wl ON i.location_id = wl.location_id
    WHERE b.expiry_date IS NOT NULL
      AND b.status = 'active'
      AND b.expiry_date BETWEEN CURRENT_DATE AND (CURRENT_DATE + $1 * INTERVAL '1 day')
  `;
  
  const params = [days];
  let paramCount = 2;
  
  if (productId) {
    query += ` AND b.product_id = $${paramCount}`;
    params.push(productId);
    paramCount++;
  }
  
  if (locationId) {
    query += ` AND i.location_id = $${paramCount}`;
    params.push(locationId);
    paramCount++;
  }
  
  query += ` ORDER BY b.expiry_date ASC, b.product_id`;
  
  const result = await db.query(query, params);
  return result.rows;
}

/**
 * Get batch movement history
 */
async function getBatchMovementHistory(batchId) {
  const result = await db.query(
    `SELECT 
      it.*,
      from_loc.location_code as from_location,
      to_loc.location_code as to_location,
      u.full_name as performed_by_name
    FROM inventory_transactions it
    LEFT JOIN warehouse_locations from_loc ON it.from_location_id = from_loc.location_id
    LEFT JOIN warehouse_locations to_loc ON it.to_location_id = to_loc.location_id
    LEFT JOIN users u ON it.performed_by = u.user_id
    WHERE it.batch_id = $1
    ORDER BY it.transaction_date DESC`,
    [batchId]
  );
  
  return result.rows;
}

module.exports = {
  createBatch,
  updateBatchQCStatus,
  getBatchByNumber,
  getAvailableBatchesFIFO,
  getAvailableBatchesFEFO,
  getExpiringBatches,
  getBatchMovementHistory,
  generateBatchNumber,
};