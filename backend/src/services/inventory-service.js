// src/services/inventory-service.js
// Inventory Service - Business logic for inventory operations
// Handles stock checks, availability, and inventory queries

const db = require('../utils/db');

/**
 * Get product by SKU
 */
async function getProductBySKU(sku) {
  const result = await db.query(
    'SELECT * FROM products WHERE sku = $1',
    [sku]
  );
  
  if (result.rows.length === 0) {
    throw new Error(`Product with SKU "${sku}" not found`);
  }
  
  return result.rows[0];
}

/**
 * Get location by code
 */
async function getLocationByCode(locationCode) {
  const result = await db.query(
    'SELECT * FROM warehouse_locations WHERE location_code = $1 AND is_active = true',
    [locationCode]
  );
  
  if (result.rows.length === 0) {
    throw new Error(`Location "${locationCode}" not found or inactive`);
  }
  
  return result.rows[0];
}

/**
 * Get user by email or employee_id
 */
async function getUserByIdentifier(identifier) {
  const result = await db.query(
    `SELECT user_id, email, full_name, role 
     FROM users 
     WHERE email = $1 OR employee_id = $1 OR badge_number = $1
     AND is_active = true`,
    [identifier]
  );
  
  if (result.rows.length === 0) {
    throw new Error(`User "${identifier}" not found or inactive`);
  }
  
  return result.rows[0];
}

/**
 * Check stock availability for a product at a location
 */
async function checkStockAvailability(productId, locationId, requiredQuantity, batchId = null) {
  let query = `
    SELECT 
      i.inventory_id,
      i.quantity_on_hand,
      i.quantity_available,
      i.quantity_allocated,
      i.uom,
      p.sku,
      p.product_name,
      wl.location_code,
      b.batch_number
    FROM inventory i
    JOIN products p ON i.product_id = p.product_id
    JOIN warehouse_locations wl ON i.location_id = wl.location_id
    LEFT JOIN batches b ON i.batch_id = b.batch_id
    WHERE i.product_id = $1 AND i.location_id = $2
  `;
  
  const params = [productId, locationId];
  
  if (batchId) {
    query += ' AND i.batch_id = $3';
    params.push(batchId);
  }
  
  const result = await db.query(query, params);
  
  if (result.rows.length === 0) {
    return {
      available: false,
      reason: 'No inventory at this location',
      quantity_available: 0,
    };
  }
  
  const inventory = result.rows[0];
  const available = parseFloat(inventory.quantity_available) >= requiredQuantity;
  
  return {
    available,
    reason: available ? 'Stock available' : 'Insufficient quantity',
    quantity_available: parseFloat(inventory.quantity_available),
    quantity_on_hand: parseFloat(inventory.quantity_on_hand),
    quantity_allocated: parseFloat(inventory.quantity_allocated || 0),
    inventory_id: inventory.inventory_id,
    sku: inventory.sku,
    product_name: inventory.product_name,
    location_code: inventory.location_code,
    batch_number: inventory.batch_number,
  };
}

/**
 * Get total stock for a product across all locations
 */
async function getTotalStock(productId) {
  const result = await db.query(
    `SELECT 
      p.sku,
      p.product_name,
      p.base_uom,
      SUM(i.quantity_on_hand) as total_on_hand,
      SUM(i.quantity_available) as total_available,
      SUM(i.quantity_allocated) as total_allocated,
      COUNT(DISTINCT i.location_id) as location_count
    FROM products p
    LEFT JOIN inventory i ON p.product_id = i.product_id
    WHERE p.product_id = $1
    GROUP BY p.product_id, p.sku, p.product_name, p.base_uom`,
    [productId]
  );
  
  if (result.rows.length === 0) {
    throw new Error('Product not found');
  }
  
  return result.rows[0];
}

/**
 * Get stock by location for a product
 */
async function getStockByLocation(productId) {
  const result = await db.query(
    `SELECT 
      wl.location_code,
      wl.location_name,
      i.quantity_on_hand,
      i.quantity_available,
      i.quantity_allocated,
      i.uom,
      b.batch_number,
      b.expiry_date
    FROM inventory i
    JOIN warehouse_locations wl ON i.location_id = wl.location_id
    LEFT JOIN batches b ON i.batch_id = b.batch_id
    WHERE i.product_id = $1 AND i.quantity_on_hand > 0
    ORDER BY wl.location_code, b.expiry_date`,
    [productId]
  );
  
  return result.rows;
}

/**
 * Get batch information
 */
async function getBatchInfo(batchNumber) {
  const result = await db.query(
    `SELECT 
      b.*,
      p.sku,
      p.product_name,
      s.supplier_name
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
 * Get available batches for a product (FIFO order)
 */
async function getAvailableBatches(productId, locationId = null) {
  let query = `
    SELECT 
      b.*,
      i.quantity_on_hand,
      i.quantity_available,
      wl.location_code,
      wl.location_name
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
    query += ' AND i.location_id = $2';
    params.push(locationId);
  }
  
  query += ' ORDER BY b.manufacturing_date ASC, b.expiry_date ASC';
  
  const result = await db.query(query, params);
  return result.rows;
}

/**
 * Allocate inventory (reserve for order/production)
 */
async function allocateInventory(productId, locationId, quantity, batchId = null) {
  return await db.transaction(async (client) => {
    // Get inventory record
    let query = `
      SELECT inventory_id, quantity_available 
      FROM inventory 
      WHERE product_id = $1 AND location_id = $2
    `;
    const params = [productId, locationId];
    
    if (batchId) {
      query += ' AND batch_id = $3';
      params.push(batchId);
    }
    
    const result = await client.query(query, params);
    
    if (result.rows.length === 0) {
      throw new Error('Inventory not found');
    }
    
    const inventory = result.rows[0];
    
    if (parseFloat(inventory.quantity_available) < quantity) {
      throw new Error('Insufficient available quantity');
    }
    
    // Update allocation
    await client.query(
      `UPDATE inventory 
       SET quantity_allocated = COALESCE(quantity_allocated, 0) + $1,
           quantity_available = quantity_available - $1,
           updated_at = CURRENT_TIMESTAMP
       WHERE inventory_id = $2`,
      [quantity, inventory.inventory_id]
    );
    
    return {
      success: true,
      inventory_id: inventory.inventory_id,
      allocated_quantity: quantity,
    };
  });
}

/**
 * Deallocate inventory (cancel reservation)
 */
async function deallocateInventory(productId, locationId, quantity, batchId = null) {
  return await db.transaction(async (client) => {
    let query = `
      SELECT inventory_id, quantity_allocated 
      FROM inventory 
      WHERE product_id = $1 AND location_id = $2
    `;
    const params = [productId, locationId];
    
    if (batchId) {
      query += ' AND batch_id = $3';
      params.push(batchId);
    }
    
    const result = await client.query(query, params);
    
    if (result.rows.length === 0) {
      throw new Error('Inventory not found');
    }
    
    const inventory = result.rows[0];
    
    if (parseFloat(inventory.quantity_allocated || 0) < quantity) {
      throw new Error('Cannot deallocate more than currently allocated');
    }
    
    // Update allocation
    await client.query(
      `UPDATE inventory 
       SET quantity_allocated = quantity_allocated - $1,
           quantity_available = quantity_available + $1,
           updated_at = CURRENT_TIMESTAMP
       WHERE inventory_id = $2`,
      [quantity, inventory.inventory_id]
    );
    
    return {
      success: true,
      inventory_id: inventory.inventory_id,
      deallocated_quantity: quantity,
    };
  });
}

/**
 * Get low stock items report
 */
async function getLowStockReport(categoryId = null) {
  let query = 'SELECT * FROM v_low_stock_items';
  const params = [];
  
  if (categoryId) {
    query = `
      SELECT lsi.* 
      FROM v_low_stock_items lsi
      JOIN products p ON lsi.product_id = p.product_id
      WHERE p.category_id = $1
    `;
    params.push(categoryId);
  }
  
  query += ' ORDER BY status DESC, total_quantity ASC';
  
  const result = await db.query(query, params);
  return result.rows;
}

/**
 * Get inventory valuation
 */
async function getInventoryValuation(categoryId = null) {
  let query = `
    SELECT 
      pc.category_name,
      COUNT(DISTINCT p.product_id) as product_count,
      SUM(i.quantity_on_hand) as total_quantity,
      SUM(i.quantity_on_hand * p.standard_cost) as total_value,
      p.currency
    FROM inventory i
    JOIN products p ON i.product_id = p.product_id
    JOIN product_categories pc ON p.category_id = pc.category_id
    WHERE p.standard_cost IS NOT NULL
  `;
  
  const params = [];
  
  if (categoryId) {
    query += ' AND p.category_id = $1';
    params.push(categoryId);
  }
  
  query += ' GROUP BY pc.category_name, p.currency ORDER BY total_value DESC';
  
  const result = await db.query(query, params);
  return result.rows;
}

/**
 * Get inventory turnover metrics
 */
async function getInventoryTurnover(productId, days = 30) {
  const result = await db.query(
    `SELECT 
      p.sku,
      p.product_name,
      COALESCE(SUM(CASE WHEN it.transaction_type = 'issue' THEN it.quantity ELSE 0 END), 0) as total_issued,
      COALESCE(SUM(CASE WHEN it.transaction_type = 'receipt' THEN it.quantity ELSE 0 END), 0) as total_received,
      COALESCE(SUM(i.quantity_on_hand), 0) as current_stock,
      COUNT(DISTINCT DATE(it.transaction_date)) as active_days
    FROM products p
    LEFT JOIN inventory_transactions it ON p.product_id = it.product_id 
      AND it.transaction_date >= CURRENT_DATE - $2::integer
    LEFT JOIN inventory i ON p.product_id = i.product_id
    WHERE p.product_id = $1
    GROUP BY p.product_id, p.sku, p.product_name`,
    [productId, days]
  );
  
  if (result.rows.length === 0) {
    throw new Error('Product not found');
  }
  
  const data = result.rows[0];
  const avgDailyUsage = data.active_days > 0 ? data.total_issued / days : 0;
  const daysOfStock = avgDailyUsage > 0 ? data.current_stock / avgDailyUsage : null;
  
  return {
    ...data,
    avg_daily_usage: avgDailyUsage,
    days_of_stock: daysOfStock,
    period_days: days,
  };
}

module.exports = {
  getProductBySKU,
  getLocationByCode,
  getUserByIdentifier,
  checkStockAvailability,
  getTotalStock,
  getStockByLocation,
  getBatchInfo,
  getAvailableBatches,
  allocateInventory,
  deallocateInventory,
  getLowStockReport,
  getInventoryValuation,
  getInventoryTurnover,
};
