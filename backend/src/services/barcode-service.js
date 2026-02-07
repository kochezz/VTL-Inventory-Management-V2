// =====================================================
// VILAGIO BARCODE SERVICE
// File: barcode-service.js
// Location: backend/src/services/barcode-service.js
// Purpose: Handle all barcode-related operations
// =====================================================

const pool = require('../config/database');

/**
 * Lookup product by barcode
 * @param {string} barcodeData - The barcode value scanned
 * @returns {Object} Product details with inventory information
 */
async function lookupProductByBarcode(barcodeData) {
  const query = `
    SELECT 
      p.product_id,
      p.sku,
      p.product_name,
      p.description,
      p.barcode_data,
      p.barcode_type,
      p.base_uom,
      p.standard_cost,
      p.selling_price,
      p.reorder_level,
      p.is_active,
      pc.category_name,
      pc.category_id,
      -- Get total stock across all locations
      COALESCE(SUM(i.quantity_on_hand), 0) as total_stock,
      -- Get stock by location
      json_agg(
        json_build_object(
          'location_id', wl.location_id,
          'location_name', wl.location_name,
          'location_code', wl.location_code,
          'quantity', COALESCE(i.quantity_on_hand, 0),
          'uom', i.uom
        ) ORDER BY wl.location_name
      ) FILTER (WHERE i.inventory_id IS NOT NULL) as stock_by_location
    FROM products p
    LEFT JOIN product_categories pc ON p.category_id = pc.category_id
    LEFT JOIN inventory i ON p.product_id = i.product_id
    LEFT JOIN warehouse_locations wl ON i.location_id = wl.location_id
    WHERE p.barcode_data = $1 AND p.is_active = true
    GROUP BY p.product_id, pc.category_name, pc.category_id
  `;

  const result = await pool.query(query, [barcodeData]);
  
  if (result.rows.length === 0) {
    return null;
  }

  return result.rows[0];
}

/**
 * Lookup warehouse location by barcode
 * @param {string} barcodeData - The location barcode scanned
 * @returns {Object} Location details
 */
async function lookupLocationByBarcode(barcodeData) {
  const query = `
    SELECT 
      location_id,
      location_code,
      location_name,
      location_type,
      address,
      city,
      country,
      location_barcode,
      barcode_type,
      is_active,
      -- Get count of products at this location
      (SELECT COUNT(DISTINCT product_id) 
       FROM inventory 
       WHERE location_id = wl.location_id 
       AND quantity_on_hand > 0) as active_products,
      -- Get total inventory value at this location
      (SELECT COALESCE(SUM(i.quantity_on_hand * p.standard_cost), 0)
       FROM inventory i
       JOIN products p ON i.product_id = p.product_id
       WHERE i.location_id = wl.location_id) as total_value
    FROM warehouse_locations wl
    WHERE location_barcode = $1 AND is_active = true
  `;

  const result = await pool.query(query, [barcodeData]);
  
  if (result.rows.length === 0) {
    return null;
  }

  return result.rows[0];
}

/**
 * Record a barcode scan for audit trail
 * @param {Object} scanData - Scan details
 * @returns {Object} Created scan record
 */
async function recordScan(scanData) {
  const {
    barcodeData,
    barcodeType = 'CODE128',
    scanType, // 'product', 'location', 'batch'
    scanAction, // 'receive', 'issue', 'transfer', 'adjustment', 'lookup'
    scanResult = 'success', // 'success', 'failed', 'not_found'
    productId = null,
    locationId = null,
    transactionId = null,
    scannedBy,
    deviceType = 'web-camera',
    deviceInfo = null,
    scanDurationMs = null,
    scanQualityScore = null,
    errorMessage = null,
    errorDetails = null,
    metadata = null
  } = scanData;

  const query = `
    INSERT INTO barcode_scans (
      barcode_data,
      barcode_type,
      scan_type,
      scan_action,
      scan_result,
      product_id,
      location_id,
      transaction_id,
      scanned_by,
      device_type,
      device_info,
      scan_duration_ms,
      scan_quality_score,
      error_message,
      error_details,
      metadata,
      scanned_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, CURRENT_TIMESTAMP)
    RETURNING *
  `;

  const values = [
    barcodeData,
    barcodeType,
    scanType,
    scanAction,
    scanResult,
    productId,
    locationId,
    transactionId,
    scannedBy,
    deviceType,
    deviceInfo ? JSON.stringify(deviceInfo) : null,
    scanDurationMs,
    scanQualityScore,
    errorMessage,
    errorDetails ? JSON.stringify(errorDetails) : null,
    metadata ? JSON.stringify(metadata) : null
  ];

  const result = await pool.query(query, values);
  return result.rows[0];
}

/**
 * Generate barcode for a product
 * @param {string} productId - Product UUID
 * @param {string} barcodeType - Type of barcode (CODE128, QRCODE, etc.)
 * @returns {Object} Updated product with barcode
 */
async function generateProductBarcode(productId, barcodeType = 'CODE128') {
  // Get product SKU
  const productQuery = 'SELECT sku, barcode_data FROM products WHERE product_id = $1';
  const productResult = await pool.query(productQuery, [productId]);
  
  if (productResult.rows.length === 0) {
    throw new Error('Product not found');
  }

  const product = productResult.rows[0];
  
  // If barcode already exists, return it
  if (product.barcode_data) {
    return {
      productId,
      barcodeData: product.barcode_data,
      barcodeType: barcodeType,
      status: 'existing'
    };
  }

  // Generate barcode using SKU
  const barcodeData = product.sku;

  // Update product with barcode
  const updateQuery = `
    UPDATE products 
    SET 
      barcode_data = $1,
      barcode_type = $2,
      barcode_generated_at = CURRENT_TIMESTAMP,
      barcode_print_count = 0
    WHERE product_id = $3
    RETURNING product_id, sku, barcode_data, barcode_type, barcode_generated_at
  `;

  const result = await pool.query(updateQuery, [barcodeData, barcodeType, productId]);
  
  return {
    ...result.rows[0],
    status: 'generated'
  };
}

/**
 * Generate barcode for a warehouse location
 * @param {string} locationId - Location UUID
 * @param {string} barcodeType - Type of barcode
 * @returns {Object} Updated location with barcode
 */
async function generateLocationBarcode(locationId, barcodeType = 'CODE128') {
  // Get location code
  const locationQuery = 'SELECT location_code, location_barcode FROM warehouse_locations WHERE location_id = $1';
  const locationResult = await pool.query(locationQuery, [locationId]);
  
  if (locationResult.rows.length === 0) {
    throw new Error('Location not found');
  }

  const location = locationResult.rows[0];
  
  // If barcode already exists, return it
  if (location.location_barcode) {
    return {
      locationId,
      barcodeData: location.location_barcode,
      barcodeType: barcodeType,
      status: 'existing'
    };
  }

  // Generate barcode using location code with prefix
  const barcodeData = `LOC-${location.location_code}`;

  // Update location with barcode
  const updateQuery = `
    UPDATE warehouse_locations 
    SET 
      location_barcode = $1,
      barcode_type = $2,
      barcode_generated_at = CURRENT_TIMESTAMP
    WHERE location_id = $3
    RETURNING location_id, location_code, location_barcode, barcode_type, barcode_generated_at
  `;

  const result = await pool.query(updateQuery, [barcodeData, barcodeType, locationId]);
  
  return {
    ...result.rows[0],
    status: 'generated'
  };
}

/**
 * Get barcode scan statistics
 * @param {Object} filters - Date range and other filters
 * @returns {Object} Scan statistics
 */
async function getScanStatistics(filters = {}) {
  const { startDate, endDate, scanType, userId } = filters;
  
  let whereConditions = ['1=1'];
  const values = [];
  let paramCount = 1;

  if (startDate) {
    whereConditions.push(`scanned_at >= $${paramCount}`);
    values.push(startDate);
    paramCount++;
  }

  if (endDate) {
    whereConditions.push(`scanned_at <= $${paramCount}`);
    values.push(endDate);
    paramCount++;
  }

  if (scanType) {
    whereConditions.push(`scan_type = $${paramCount}`);
    values.push(scanType);
    paramCount++;
  }

  if (userId) {
    whereConditions.push(`scanned_by = $${paramCount}`);
    values.push(userId);
    paramCount++;
  }

  const query = `
    SELECT 
      COUNT(*) as total_scans,
      COUNT(CASE WHEN scan_result = 'success' THEN 1 END) as successful_scans,
      COUNT(CASE WHEN scan_result = 'failed' THEN 1 END) as failed_scans,
      COUNT(CASE WHEN scan_result = 'not_found' THEN 1 END) as not_found_scans,
      COUNT(DISTINCT scanned_by) as unique_users,
      COUNT(DISTINCT product_id) as unique_products,
      COUNT(DISTINCT location_id) as unique_locations,
      AVG(scan_duration_ms) as avg_scan_time_ms,
      MIN(scan_duration_ms) as min_scan_time_ms,
      MAX(scan_duration_ms) as max_scan_time_ms,
      AVG(scan_quality_score) as avg_quality_score,
      -- Scans by type
      COUNT(CASE WHEN scan_type = 'product' THEN 1 END) as product_scans,
      COUNT(CASE WHEN scan_type = 'location' THEN 1 END) as location_scans,
      COUNT(CASE WHEN scan_type = 'batch' THEN 1 END) as batch_scans,
      -- Scans by action
      COUNT(CASE WHEN scan_action = 'receive' THEN 1 END) as receive_scans,
      COUNT(CASE WHEN scan_action = 'issue' THEN 1 END) as issue_scans,
      COUNT(CASE WHEN scan_action = 'transfer' THEN 1 END) as transfer_scans,
      COUNT(CASE WHEN scan_action = 'lookup' THEN 1 END) as lookup_scans,
      -- Device breakdown
      COUNT(CASE WHEN device_type LIKE '%mobile%' THEN 1 END) as mobile_scans,
      COUNT(CASE WHEN device_type LIKE '%web%' THEN 1 END) as web_scans,
      COUNT(CASE WHEN device_type LIKE '%handheld%' THEN 1 END) as handheld_scans
    FROM barcode_scans
    WHERE ${whereConditions.join(' AND ')}
  `;

  const result = await pool.query(query, values);
  return result.rows[0];
}

/**
 * Get recent scan history
 * @param {Object} filters - Pagination and filters
 * @returns {Array} Recent scans with details
 */
async function getRecentScans(filters = {}) {
  const { limit = 50, offset = 0, scanType, userId } = filters;
  
  let whereConditions = ['1=1'];
  const values = [limit, offset];
  let paramCount = 3;

  if (scanType) {
    whereConditions.push(`bs.scan_type = $${paramCount}`);
    values.push(scanType);
    paramCount++;
  }

  if (userId) {
    whereConditions.push(`bs.scanned_by = $${paramCount}`);
    values.push(userId);
    paramCount++;
  }

  const query = `
    SELECT 
      bs.scan_id,
      bs.barcode_data,
      bs.barcode_type,
      bs.scan_type,
      bs.scan_action,
      bs.scan_result,
      bs.scanned_at,
      bs.device_type,
      bs.scan_duration_ms,
      bs.scan_quality_score,
      bs.error_message,
      p.sku,
      p.product_name,
      wl.location_name,
      u.full_name as scanned_by_name,
      u.email as scanned_by_email
    FROM barcode_scans bs
    LEFT JOIN products p ON bs.product_id = p.product_id
    LEFT JOIN warehouse_locations wl ON bs.location_id = wl.location_id
    LEFT JOIN users u ON bs.scanned_by = u.user_id
    WHERE ${whereConditions.join(' AND ')}
    ORDER BY bs.scanned_at DESC
    LIMIT $1 OFFSET $2
  `;

  const result = await pool.query(query, values);
  return result.rows;
}

/**
 * Batch generate barcodes for multiple products
 * @param {Array} productIds - Array of product UUIDs
 * @param {string} barcodeType - Type of barcode
 * @returns {Array} Generated barcodes
 */
async function batchGenerateProductBarcodes(productIds, barcodeType = 'CODE128') {
  const results = [];
  
  for (const productId of productIds) {
    try {
      const result = await generateProductBarcode(productId, barcodeType);
      results.push({ ...result, error: null });
    } catch (error) {
      results.push({ 
        productId, 
        error: error.message,
        status: 'failed'
      });
    }
  }
  
  return results;
}

/**
 * Get barcode configuration
 * @returns {Object} Configuration settings
 */
async function getBarcodeConfiguration() {
  const query = `
    SELECT 
      config_key,
      config_value,
      config_type,
      description
    FROM barcode_configuration
    ORDER BY config_key
  `;

  const result = await pool.query(query);
  
  // Convert to key-value object
  const config = {};
  result.rows.forEach(row => {
    let value = row.config_value;
    
    // Parse value based on type
    switch (row.config_type) {
      case 'number':
        value = parseFloat(value);
        break;
      case 'boolean':
        value = value === 'true';
        break;
      case 'json':
        value = JSON.parse(value);
        break;
      default:
        value = value; // string
    }
    
    config[row.config_key] = value;
  });

  return config;
}

/**
 * Update barcode configuration
 * @param {string} configKey - Configuration key
 * @param {any} configValue - New value
 * @param {string} userId - User making the change
 * @returns {Object} Updated configuration
 */
async function updateBarcodeConfiguration(configKey, configValue, userId) {
  // Convert value to string for storage
  const valueStr = typeof configValue === 'object' 
    ? JSON.stringify(configValue) 
    : String(configValue);

  const query = `
    UPDATE barcode_configuration
    SET 
      config_value = $1,
      updated_by = $2,
      updated_at = CURRENT_TIMESTAMP
    WHERE config_key = $3
    RETURNING *
  `;

  const result = await pool.query(query, [valueStr, userId, configKey]);
  
  if (result.rows.length === 0) {
    throw new Error(`Configuration key '${configKey}' not found`);
  }

  return result.rows[0];
}

module.exports = {
  lookupProductByBarcode,
  lookupLocationByBarcode,
  recordScan,
  generateProductBarcode,
  generateLocationBarcode,
  batchGenerateProductBarcodes,
  getScanStatistics,
  getRecentScans,
  getBarcodeConfiguration,
  updateBarcodeConfiguration
};
