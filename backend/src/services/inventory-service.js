const { pool } = require('./auth-service');
const { v4: uuidv4 } = require('uuid');

// Create inventory transaction (comprehensive function for all transaction types)
const createTransaction = async ({
  product_id,
  from_location_id,
  to_location_id,
  quantity,
  transaction_type, // 'RECEIVE', 'ISSUE', 'TRANSFER', 'ADJUSTMENT', 'RETURN', 'DAMAGE'
  reference_number,
  notes,
  unit_cost,
  performed_by
}) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Generate transaction number
    const prefix = {
      'RECEIVE': 'RCV',
      'ISSUE': 'ISS',
      'TRANSFER': 'TRF',
      'ADJUSTMENT': 'ADJ',
      'RETURN': 'RET',
      'DAMAGE': 'DMG'
    }[transaction_type] || 'TXN';

    const transactionNumber = `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    // Get product info
    const productQuery = await client.query(
      'SELECT product_name, sku, base_uom FROM products WHERE product_id = $1',
      [product_id]
    );

    if (productQuery.rows.length === 0) {
      throw new Error('Product not found');
    }

    const product = productQuery.rows[0];

    // Get transaction type ID
    const transactionTypeQuery = await client.query(
      "SELECT transaction_type_id FROM transaction_types WHERE type_name = $1",
      [transaction_type.toLowerCase()]
    );

    if (transactionTypeQuery.rows.length === 0) {
      throw new Error(`Transaction type '${transaction_type}' not found in database`);
    }

    const transactionTypeId = transactionTypeQuery.rows[0].transaction_type_id;

    // Update inventory based on transaction type
    switch (transaction_type) {
      case 'RECEIVE':
      case 'RETURN':
        // Add stock to destination location
        await updateInventory(client, product_id, to_location_id, quantity, 'ADD');
        break;

      case 'ISSUE':
      case 'DAMAGE':
        // Remove stock from source location
        await updateInventory(client, product_id, from_location_id, quantity, 'SUBTRACT');
        break;

      case 'TRANSFER':
        // Remove from source, add to destination
        await updateInventory(client, product_id, from_location_id, quantity, 'SUBTRACT');
        await updateInventory(client, product_id, to_location_id, quantity, 'ADD');
        break;

      case 'ADJUSTMENT':
        // Adjust stock at location (can be positive or negative)
        const location = to_location_id || from_location_id;
        const operation = quantity >= 0 ? 'ADD' : 'SUBTRACT';
        await updateInventory(client, product_id, location, Math.abs(quantity), operation);
        break;

      default:
        throw new Error('Invalid transaction type');
    }

    // Create transaction record (FIXED: removed transaction_type column)
    const transactionResult = await client.query(
      `INSERT INTO inventory_transactions (
        transaction_id,
        transaction_number,
        transaction_type_id,
        product_id,
        quantity,
        uom,
        from_location_id,
        to_location_id,
        transaction_date,
        performed_by,
        reference_document_number,
        notes,
        unit_cost,
        status,
        created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP, $9, $10, $11, $12, 'completed', CURRENT_TIMESTAMP)
      RETURNING *`,
      [
        uuidv4(),
        transactionNumber,
        transactionTypeId,
        product_id,
        Math.abs(quantity),
        product.base_uom,
        from_location_id || null,
        to_location_id || null,
        performed_by,
        reference_number || null,
        notes || null,
        unit_cost || null
      ]
    );

    // Create audit log
    await client.query(
      `INSERT INTO audit_log (
        user_id, action, table_name, record_id, 
        new_values, ip_address, performed_at, performed_by
      ) VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, $7)`,
      [
        performed_by,
        'INSERT',
        'inventory_transactions',
        transactionResult.rows[0].transaction_id,
        JSON.stringify({
          product: product.product_name,
          quantity: quantity,
          transaction_number: transactionNumber
        }),
        '127.0.0.1',
        performed_by
      ]
    );

    await client.query('COMMIT');

    console.log(`✅ ${transaction_type} transaction completed: ${transactionNumber}`);
    console.log(`   Product: ${product.product_name}`);
    console.log(`   Quantity: ${quantity} ${product.base_uom}`);

    return {
      success: true,
      transaction: {
        ...transactionResult.rows[0],
        product_name: product.product_name,
        sku: product.sku
      }
    };

  } catch (error) {
    await client.query('ROLLBACK');
    console.error(`❌ ${transaction_type} transaction error:`, error.message);
    throw error;
  } finally {
    client.release();
  }
};

// Helper function to update inventory
const updateInventory = async (client, productId, locationId, quantity, operation) => {
  // Check if inventory record exists
  const inventoryCheck = await client.query(
    'SELECT inventory_id, quantity_on_hand FROM inventory WHERE product_id = $1 AND location_id = $2',
    [productId, locationId]
  );

  const absQuantity = Math.abs(quantity);

  if (inventoryCheck.rows.length === 0) {
    // Create new inventory record (only for ADD operations)
    if (operation === 'SUBTRACT') {
      throw new Error('Cannot remove stock from non-existent inventory location');
    }

    // Fetch product UOM
    const productRes = await client.query(
      'SELECT base_uom FROM products WHERE product_id = $1',
      [productId]
    );
    const uom = productRes.rows[0]?.base_uom || 'piece';

    await client.query(
      `INSERT INTO inventory (
        inventory_id, product_id, location_id, 
        quantity_on_hand, quantity_allocated, uom,
        last_updated, created_at
      ) VALUES ($1, $2, $3, $4, 0, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [uuidv4(), productId, locationId, absQuantity, uom]
    );
  } else {
    // Update existing inventory record
    const currentQuantity = parseInt(inventoryCheck.rows[0].quantity_on_hand) || 0;

    if (operation === 'SUBTRACT' && currentQuantity < absQuantity) {
      throw new Error(`Insufficient stock. Available: ${currentQuantity}, Requested: ${absQuantity}`);
    }

    const newQuantity = operation === 'ADD' ? currentQuantity + absQuantity : currentQuantity - absQuantity;

    await client.query(
      `UPDATE inventory 
       SET quantity_on_hand = $1, last_updated = CURRENT_TIMESTAMP 
       WHERE product_id = $2 AND location_id = $3`,
      [newQuantity, productId, locationId]
    );
  }
};

// Get transaction history with filters
const getTransactionHistory = async (filters = {}) => {
  try {
    let query = `
      SELECT 
        it.*,
        p.sku,
        p.product_name,
        tt.type_name as transaction_type_name,
        fl.location_code as from_location_code,
        fl.location_name as from_location_name,
        tl.location_code as to_location_code,
        tl.location_name as to_location_name,
        u.full_name as performed_by_name
      FROM inventory_transactions it
      LEFT JOIN products p ON it.product_id = p.product_id
      LEFT JOIN transaction_types tt ON it.transaction_type_id = tt.transaction_type_id
      LEFT JOIN warehouse_locations fl ON it.from_location_id = fl.location_id
      LEFT JOIN warehouse_locations tl ON it.to_location_id = tl.location_id
      LEFT JOIN users u ON it.performed_by = u.user_id
    `;

    const conditions = [];
    const values = [];
    let paramCount = 1;

    // Filters
    if (filters.product_id) {
      conditions.push(`it.product_id = $${paramCount}`);
      values.push(filters.product_id);
      paramCount++;
    }

    if (filters.transaction_type) {
      conditions.push(`tt.type_name = $${paramCount}`);
      values.push(filters.transaction_type.toLowerCase());
      paramCount++;
    }

    if (filters.location_id) {
      conditions.push(`(it.from_location_id = $${paramCount} OR it.to_location_id = $${paramCount})`);
      values.push(filters.location_id);
      paramCount++;
    }

    if (filters.start_date) {
      conditions.push(`it.transaction_date >= $${paramCount}`);
      values.push(filters.start_date);
      paramCount++;
    }

    if (filters.end_date) {
      conditions.push(`it.transaction_date <= $${paramCount}`);
      values.push(filters.end_date);
      paramCount++;
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY it.transaction_date DESC, it.created_at DESC';

    // Pagination
    const limit = filters.limit || 50;
    const offset = filters.offset || 0;
    query += ` LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    values.push(limit, offset);

    const result = await pool.query(query, values);

    // Get total count
    let countQuery = 'SELECT COUNT(*) as total FROM inventory_transactions it';
    if (filters.transaction_type) {
      countQuery += ' LEFT JOIN transaction_types tt ON it.transaction_type_id = tt.transaction_type_id';
    }

    if (conditions.length > 0) {
      countQuery += ' WHERE ' + conditions.join(' AND ');
    }

    const countResult = await pool.query(countQuery, values.slice(0, values.length - 2));

    return {
      transactions: result.rows,
      total: parseInt(countResult.rows[0].total),
      limit,
      offset
    };

  } catch (error) {
    console.error('❌ Get transaction history error:', error.message);
    throw error;
  }
};

// Get available locations
const getLocations = async () => {
  try {
    const result = await pool.query(
      `SELECT location_id, location_code, location_name, location_type, is_active
       FROM warehouse_locations
       WHERE is_active = true
       ORDER BY location_code`
    );
    return result.rows;
  } catch (error) {
    console.error('❌ Get locations error:', error.message);
    throw error;
  }
};

// Check stock availability
const checkStockAvailability = async (productId, locationId, requiredQuantity) => {
  try {
    const result = await pool.query(
      `SELECT quantity_on_hand, quantity_allocated
       FROM inventory
       WHERE product_id = $1 AND location_id = $2`,
      [productId, locationId]
    );

    if (result.rows.length === 0) {
      return {
        available: false,
        on_hand: 0,
        allocated: 0,
        available_qty: 0
      };
    }

    const inventory = result.rows[0];
    const availableQty = (inventory.quantity_on_hand || 0) - (inventory.quantity_allocated || 0);

    return {
      available: availableQty >= requiredQuantity,
      on_hand: inventory.quantity_on_hand || 0,
      allocated: inventory.quantity_allocated || 0,
      available_qty: availableQty
    };

  } catch (error) {
    console.error('❌ Check stock availability error:', error.message);
    throw error;
  }
};

// Get adjustment reasons
const getAdjustmentReasons = () => {
  return [
    { value: 'cycle_count', label: 'Cycle Count Adjustment' },
    { value: 'damaged', label: 'Damaged/Defective Items' },
    { value: 'expired', label: 'Expired Items' },
    { value: 'found', label: 'Items Found' },
    { value: 'lost', label: 'Items Lost/Missing' },
    { value: 'reconciliation', label: 'Inventory Reconciliation' },
    { value: 'correction', label: 'Data Entry Correction' },
    { value: 'quality_control', label: 'Quality Control Rejection' },
    { value: 'other', label: 'Other (See Notes)' }
  ];
};

module.exports = {
  createTransaction,
  getTransactionHistory,
  getLocations,
  checkStockAvailability,
  getAdjustmentReasons
};
