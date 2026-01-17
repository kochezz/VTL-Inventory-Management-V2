// src/services/transaction-service.js
// Transaction Service - Business logic for inventory transactions
// Handles validation, processing, and inventory updates

const db = require('../utils/db');
const { v4: uuidv4 } = require('uuid');

/**
 * Generate transaction number
 * Format: RCV-20260114-0001, ISS-20260114-0001, etc.
 */
function generateTransactionNumber(type) {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
  
  const prefixes = {
    receipt: 'RCV',
    issue: 'ISS',
    transfer: 'TRF',
    adjustment: 'ADJ',
    return: 'RET',
  };
  
  const prefix = prefixes[type] || 'TXN';
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  
  return `${prefix}-${dateStr}-${random}`;
}

/**
 * Validate transaction data
 */
function validateTransaction(data) {
  const errors = [];
  
  if (!data.transaction_type) {
    errors.push('Transaction type is required');
  }
  
  if (!data.product_id) {
    errors.push('Product ID is required');
  }
  
  if (!data.quantity || data.quantity <= 0) {
    errors.push('Quantity must be greater than 0');
  }
  
  if (!data.uom) {
    errors.push('Unit of measure is required');
  }
  
  if (!data.performed_by) {
    errors.push('User ID (performed_by) is required');
  }
  
  // Location validations based on transaction type
  const needsTo = ['receipt', 'production_output', 'return', 'quality_release'];
  const needsFrom = ['issue', 'production_consume', 'waste', 'quality_hold'];
  const needsBoth = ['transfer', 'adjustment'];
  
  if (needsTo.includes(data.transaction_type) && !data.to_location_id) {
    errors.push(`${data.transaction_type} requires to_location_id`);
  }
  
  if (needsFrom.includes(data.transaction_type) && !data.from_location_id) {
    errors.push(`${data.transaction_type} requires from_location_id`);
  }
  
  if (needsBoth.includes(data.transaction_type)) {
    if (!data.from_location_id) errors.push('Transfer requires from_location_id');
    if (!data.to_location_id) errors.push('Transfer requires to_location_id');
  }
  
  return errors;
}

/**
 * Create a receive transaction (incoming stock)
 */
async function createReceiveTransaction(data) {
  const errors = validateTransaction({
    ...data,
    transaction_type: 'receipt',
  });
  
  if (errors.length > 0) {
    throw new Error(`Validation failed: ${errors.join(', ')}`);
  }
  
  return await db.transaction(async (client) => {
    // Generate transaction number
    const transactionNumber = generateTransactionNumber('receipt');
    
    // Create transaction record
    const transactionResult = await client.query(
      `INSERT INTO inventory_transactions (
        transaction_number,
        transaction_type,
        transaction_date,
        product_id,
        batch_id,
        to_location_id,
        quantity,
        uom,
        performed_by,
        reference_document_type,
        reference_document_number,
        unit_cost,
        total_cost,
        notes
      ) VALUES ($1, $2, CURRENT_TIMESTAMP, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *`,
      [
        transactionNumber,
        'receipt',
        data.product_id,
        data.batch_id || null,
        data.to_location_id,
        data.quantity,
        data.uom,
        data.performed_by,
        data.reference_document_type || 'PO',
        data.reference_document_number || null,
        data.unit_cost || null,
        data.total_cost || null,
        data.notes || null,
      ]
    );
    
    // Update or create inventory record
    const inventoryCheck = await client.query(
      `SELECT inventory_id, quantity_on_hand 
       FROM inventory 
       WHERE product_id = $1 AND location_id = $2 AND ($3::uuid IS NULL OR batch_id = $3)`,
      [data.product_id, data.to_location_id, data.batch_id]
    );
    
    if (inventoryCheck.rows.length > 0) {
      // Update existing inventory
      await client.query(
        `UPDATE inventory 
         SET quantity_on_hand = quantity_on_hand + $1,
             quantity_available = quantity_available + $1,
             last_counted_date = CURRENT_TIMESTAMP,
             updated_at = CURRENT_TIMESTAMP
         WHERE inventory_id = $2`,
        [data.quantity, inventoryCheck.rows[0].inventory_id]
      );
    } else {
      // Create new inventory record
      await client.query(
        `INSERT INTO inventory (
          product_id,
          location_id,
          batch_id,
          quantity_on_hand,
          quantity_available,
          uom,
          last_counted_date
        ) VALUES ($1, $2, $3, $4, $4, $5, CURRENT_TIMESTAMP)`,
        [data.product_id, data.to_location_id, data.batch_id, data.quantity, data.uom]
      );
    }
    
    // Update batch quantity if batch tracking
    if (data.batch_id) {
      await client.query(
        `UPDATE batches 
         SET current_quantity = current_quantity + $1,
             updated_at = CURRENT_TIMESTAMP
         WHERE batch_id = $2`,
        [data.quantity, data.batch_id]
      );
    }
    
    return transactionResult.rows[0];
  });
}

/**
 * Create an issue transaction (outgoing to production)
 */
async function createIssueTransaction(data) {
  const errors = validateTransaction({
    ...data,
    transaction_type: 'issue',
  });
  
  if (errors.length > 0) {
    throw new Error(`Validation failed: ${errors.join(', ')}`);
  }
  
  return await db.transaction(async (client) => {
    // Check available quantity
    const availableCheck = await client.query(
      `SELECT inventory_id, quantity_available 
       FROM inventory 
       WHERE product_id = $1 AND location_id = $2 AND ($3::uuid IS NULL OR batch_id = $3)`,
      [data.product_id, data.from_location_id, data.batch_id]
    );
    
    if (availableCheck.rows.length === 0) {
      throw new Error('No inventory found at specified location');
    }
    
    if (availableCheck.rows[0].quantity_available < data.quantity) {
      throw new Error(
        `Insufficient quantity. Available: ${availableCheck.rows[0].quantity_available}, Requested: ${data.quantity}`
      );
    }
    
    // Generate transaction number
    const transactionNumber = generateTransactionNumber('issue');
    
    // Create transaction record
    const transactionResult = await client.query(
      `INSERT INTO inventory_transactions (
        transaction_number,
        transaction_type,
        transaction_date,
        product_id,
        batch_id,
        from_location_id,
        quantity,
        uom,
        performed_by,
        reference_document_type,
        reference_document_number,
        notes
      ) VALUES ($1, $2, CURRENT_TIMESTAMP, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *`,
      [
        transactionNumber,
        'issue',
        data.product_id,
        data.batch_id || null,
        data.from_location_id,
        data.quantity,
        data.uom,
        data.performed_by,
        data.reference_document_type || 'Production Order',
        data.reference_document_number || null,
        data.notes || null,
      ]
    );
    
    // Update inventory - reduce quantity
    await client.query(
      `UPDATE inventory 
       SET quantity_on_hand = quantity_on_hand - $1,
           quantity_available = quantity_available - $1,
           updated_at = CURRENT_TIMESTAMP
       WHERE inventory_id = $2`,
      [data.quantity, availableCheck.rows[0].inventory_id]
    );
    
    // Update batch quantity if batch tracking
    if (data.batch_id) {
      await client.query(
        `UPDATE batches 
         SET current_quantity = current_quantity - $1,
             updated_at = CURRENT_TIMESTAMP
         WHERE batch_id = $2`,
        [data.quantity, data.batch_id]
      );
    }
    
    return transactionResult.rows[0];
  });
}

/**
 * Create a transfer transaction (move between locations)
 */
async function createTransferTransaction(data) {
  const errors = validateTransaction({
    ...data,
    transaction_type: 'transfer',
  });
  
  if (errors.length > 0) {
    throw new Error(`Validation failed: ${errors.join(', ')}`);
  }
  
  if (data.from_location_id === data.to_location_id) {
    throw new Error('From and To locations cannot be the same');
  }
  
  return await db.transaction(async (client) => {
    // Check available quantity at source
    const availableCheck = await client.query(
      `SELECT inventory_id, quantity_available 
       FROM inventory 
       WHERE product_id = $1 AND location_id = $2 AND ($3::uuid IS NULL OR batch_id = $3)`,
      [data.product_id, data.from_location_id, data.batch_id]
    );
    
    if (availableCheck.rows.length === 0) {
      throw new Error('No inventory found at source location');
    }
    
    if (availableCheck.rows[0].quantity_available < data.quantity) {
      throw new Error(
        `Insufficient quantity. Available: ${availableCheck.rows[0].quantity_available}, Requested: ${data.quantity}`
      );
    }
    
    // Generate transaction number
    const transactionNumber = generateTransactionNumber('transfer');
    
    // Create transaction record
    const transactionResult = await client.query(
      `INSERT INTO inventory_transactions (
        transaction_number,
        transaction_type,
        transaction_date,
        product_id,
        batch_id,
        from_location_id,
        to_location_id,
        quantity,
        uom,
        performed_by,
        notes
      ) VALUES ($1, $2, CURRENT_TIMESTAMP, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *`,
      [
        transactionNumber,
        'transfer',
        data.product_id,
        data.batch_id || null,
        data.from_location_id,
        data.to_location_id,
        data.quantity,
        data.uom,
        data.performed_by,
        data.notes || null,
      ]
    );
    
    // Reduce quantity at source location
    await client.query(
      `UPDATE inventory 
       SET quantity_on_hand = quantity_on_hand - $1,
           quantity_available = quantity_available - $1,
           updated_at = CURRENT_TIMESTAMP
       WHERE inventory_id = $2`,
      [data.quantity, availableCheck.rows[0].inventory_id]
    );
    
    // Add quantity at destination location
    const destCheck = await client.query(
      `SELECT inventory_id 
       FROM inventory 
       WHERE product_id = $1 AND location_id = $2 AND ($3::uuid IS NULL OR batch_id = $3)`,
      [data.product_id, data.to_location_id, data.batch_id]
    );
    
    if (destCheck.rows.length > 0) {
      // Update existing inventory at destination
      await client.query(
        `UPDATE inventory 
         SET quantity_on_hand = quantity_on_hand + $1,
             quantity_available = quantity_available + $1,
             updated_at = CURRENT_TIMESTAMP
         WHERE inventory_id = $2`,
        [data.quantity, destCheck.rows[0].inventory_id]
      );
    } else {
      // Create new inventory record at destination
      await client.query(
        `INSERT INTO inventory (
          product_id,
          location_id,
          batch_id,
          quantity_on_hand,
          quantity_available,
          uom
        ) VALUES ($1, $2, $3, $4, $4, $5)`,
        [data.product_id, data.to_location_id, data.batch_id, data.quantity, data.uom]
      );
    }
    
    return transactionResult.rows[0];
  });
}

/**
 * Create an adjustment transaction (cycle count, correction)
 */
async function createAdjustmentTransaction(data) {
  const errors = validateTransaction({
    ...data,
    transaction_type: 'adjustment',
  });
  
  if (errors.length > 0) {
    throw new Error(`Validation failed: ${errors.join(', ')}`);
  }
  
  return await db.transaction(async (client) => {
    // Get current quantity
    const currentCheck = await client.query(
      `SELECT inventory_id, quantity_on_hand 
       FROM inventory 
       WHERE product_id = $1 AND location_id = $2 AND ($3::uuid IS NULL OR batch_id = $3)`,
      [data.product_id, data.from_location_id, data.batch_id]
    );
    
    if (currentCheck.rows.length === 0) {
      throw new Error('No inventory found at specified location');
    }
    
    const currentQty = parseFloat(currentCheck.rows[0].quantity_on_hand);
    const adjustmentQty = data.quantity; // Can be positive or negative
    
    // Generate transaction number
    const transactionNumber = generateTransactionNumber('adjustment');
    
    // Create transaction record
    const transactionResult = await client.query(
      `INSERT INTO inventory_transactions (
        transaction_number,
        transaction_type,
        transaction_date,
        product_id,
        batch_id,
        from_location_id,
        to_location_id,
        quantity,
        uom,
        performed_by,
        reference_document_type,
        reference_document_number,
        notes
      ) VALUES ($1, $2, CURRENT_TIMESTAMP, $3, $4, $5, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *`,
      [
        transactionNumber,
        'adjustment',
        data.product_id,
        data.batch_id || null,
        data.from_location_id,
        adjustmentQty,
        data.uom,
        data.performed_by,
        data.reference_document_type || 'Cycle Count',
        data.reference_document_number || null,
        data.notes || `Adjusted from ${currentQty} to ${currentQty + adjustmentQty}`,
      ]
    );
    
    // Update inventory
    await client.query(
      `UPDATE inventory 
       SET quantity_on_hand = quantity_on_hand + $1,
           quantity_available = quantity_available + $1,
           last_counted_date = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE inventory_id = $2`,
      [adjustmentQty, currentCheck.rows[0].inventory_id]
    );
    
    // Update batch quantity if batch tracking
    if (data.batch_id) {
      await client.query(
        `UPDATE batches 
         SET current_quantity = current_quantity + $1,
             updated_at = CURRENT_TIMESTAMP
         WHERE batch_id = $2`,
        [adjustmentQty, data.batch_id]
      );
    }
    
    return transactionResult.rows[0];
  });
}

/**
 * Get transaction history with filters
 */
async function getTransactionHistory(filters = {}) {
  let query = `
    SELECT 
      it.*,
      p.sku,
      p.product_name,
      from_loc.location_code as from_location_code,
      to_loc.location_code as to_location_code,
      b.batch_number,
      u.full_name as performed_by_name
    FROM inventory_transactions it
    JOIN products p ON it.product_id = p.product_id
    LEFT JOIN warehouse_locations from_loc ON it.from_location_id = from_loc.location_id
    LEFT JOIN warehouse_locations to_loc ON it.to_location_id = to_loc.location_id
    LEFT JOIN batches b ON it.batch_id = b.batch_id
    LEFT JOIN users u ON it.performed_by = u.user_id
    WHERE 1=1
  `;
  
  const params = [];
  let paramCount = 1;
  
  if (filters.product_id) {
    query += ` AND it.product_id = $${paramCount}`;
    params.push(filters.product_id);
    paramCount++;
  }
  
  if (filters.transaction_type) {
    query += ` AND it.transaction_type = $${paramCount}`;
    params.push(filters.transaction_type);
    paramCount++;
  }
  
  if (filters.location_id) {
    query += ` AND (it.from_location_id = $${paramCount} OR it.to_location_id = $${paramCount})`;
    params.push(filters.location_id);
    paramCount++;
  }
  
  if (filters.start_date) {
    query += ` AND it.transaction_date >= $${paramCount}`;
    params.push(filters.start_date);
    paramCount++;
  }
  
  if (filters.end_date) {
    query += ` AND it.transaction_date <= $${paramCount}`;
    params.push(filters.end_date);
    paramCount++;
  }
  
  query += ` ORDER BY it.transaction_date DESC LIMIT ${filters.limit || 100}`;
  
  const result = await db.query(query, params);
  return result.rows;
}

module.exports = {
  createReceiveTransaction,
  createIssueTransaction,
  createTransferTransaction,
  createAdjustmentTransaction,
  getTransactionHistory,
  generateTransactionNumber,
  validateTransaction,
};
