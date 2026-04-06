const { pool } = require('./auth-service');
const { v4: uuidv4 } = require('uuid');

// Create new product
const createProduct = async (productData) => {
  try {
    const {
      sku,
      product_name,
      description,
      category_id,
      base_uom,
      standard_cost,
      selling_price,
      reorder_level,
      is_active
    } = productData;

    const existingProduct = await pool.query(
      'SELECT product_id FROM products WHERE sku = $1',
      [sku]
    );

    if (existingProduct.rows.length > 0) {
      throw new Error(`Product with SKU "${sku}" already exists`);
    }

    const result = await pool.query(
      `INSERT INTO products (
        product_id,
        sku,
        product_name,
        description,
        category_id,
        base_uom,
        standard_cost,
        selling_price,
        reorder_level,
        is_active,
        created_at,
        updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING *`,
      [
        uuidv4(),
        sku,
        product_name,
        description || null,
        category_id,
        base_uom,
        standard_cost || 0,
        selling_price || 0,
        reorder_level || 0,
        is_active !== undefined ? is_active : true
      ]
    );

    console.log(`✅ Product created: ${sku} - ${product_name}`);
    return result.rows[0];
  } catch (error) {
    console.error('❌ Create product error:', error.message);
    throw error;
  }
};

// Get all products with optional filters
const getProducts = async (filters = {}) => {
  try {
    let query = `
      WITH product_stock AS (
        SELECT 
          p.product_id,
          p.sku,
          p.product_name,
          p.description,
          p.category_id,
          pc.category_name,
          p.base_uom,
          p.standard_cost,
          p.selling_price,
          p.selling_price_zmw,
          p.reorder_level,
          p.is_active,
          COALESCE(SUM(i.quantity_on_hand), 0) as total_stock,
          p.created_at,
          p.updated_at,
          CASE 
            WHEN COALESCE(SUM(i.quantity_on_hand), 0) = 0 THEN 'out_of_stock'
            WHEN COALESCE(SUM(i.quantity_on_hand), 0) <= p.reorder_level THEN 'low_stock'
            ELSE 'in_stock'
          END as stock_status
        FROM products p
        LEFT JOIN product_categories pc ON p.category_id = pc.category_id
        LEFT JOIN inventory i ON p.product_id = i.product_id
        GROUP BY 
          p.product_id, 
          p.sku, 
          p.product_name, 
          p.description,
          p.category_id,
          pc.category_name,
          p.base_uom,
          p.standard_cost,
          p.selling_price,
          p.selling_price_zmw,
          p.reorder_level,
          p.is_active,
          p.created_at,
          p.updated_at
      )
      SELECT * FROM product_stock
    `;

    const conditions = [];
    const values = [];
    let paramCount = 1;

    if (filters.category_id) {
      conditions.push(`category_id = $${paramCount}`);
      values.push(filters.category_id);
      paramCount++;
    }

    if (filters.is_active !== undefined) {
      conditions.push(`is_active = $${paramCount}`);
      values.push(filters.is_active);
      paramCount++;
    }

    if (filters.stock_status) {
      conditions.push(`stock_status = $${paramCount}`);
      values.push(filters.stock_status);
      paramCount++;
    }

    if (filters.search) {
      conditions.push(`(
        sku ILIKE $${paramCount} OR 
        product_name ILIKE $${paramCount} OR 
        description ILIKE $${paramCount}
      )`);
      values.push(`%${filters.search}%`);
      paramCount++;
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    const sortBy = filters.sort_by || 'sku';
    const sortOrder = filters.sort_order || 'ASC';
    query += ` ORDER BY ${sortBy} ${sortOrder}`;

    const limit = filters.limit || 50;
    const offset = filters.offset || 0;
    query += ` LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    values.push(limit, offset);

    const result = await pool.query(query, values);

    let countQuery = `
      WITH product_stock AS (
        SELECT 
          p.product_id,
          p.category_id,
          p.is_active,
          CASE 
            WHEN COALESCE(SUM(i.quantity_on_hand), 0) = 0 THEN 'out_of_stock'
            WHEN COALESCE(SUM(i.quantity_on_hand), 0) <= p.reorder_level THEN 'low_stock'
            ELSE 'in_stock'
          END as stock_status
        FROM products p
        LEFT JOIN inventory i ON p.product_id = i.product_id
        GROUP BY p.product_id, p.category_id, p.is_active, p.reorder_level
      )
      SELECT COUNT(*) as total FROM product_stock
    `;

    if (conditions.length > 0) {
      countQuery += ' WHERE ' + conditions.join(' AND ');
    }

    const countResult = await pool.query(countQuery, values.slice(0, values.length - 2));

    return {
      products: result.rows,
      total: parseInt(countResult.rows[0].total),
      limit,
      offset
    };
  } catch (error) {
    console.error('❌ Get products error:', error.message);
    throw error;
  }
};

const getProductById = async (productId) => {
  try {
    const query = `
      SELECT 
        p.*,
        pc.category_name,
        COALESCE(SUM(i.quantity_on_hand), 0) as total_stock,
        COUNT(DISTINCT i.location_id) as locations_count,
        COALESCE(SUM(i.quantity_allocated), 0) as allocated_stock,
        COALESCE(SUM(i.quantity_on_hand) - SUM(i.quantity_allocated), 0) as available_stock
      FROM products p
      LEFT JOIN product_categories pc ON p.category_id = pc.category_id
      LEFT JOIN inventory i ON p.product_id = i.product_id
      WHERE p.product_id = $1
      GROUP BY p.product_id, pc.category_name
    `;

    const result = await pool.query(query, [productId]);

    if (result.rows.length === 0) {
      throw new Error('Product not found');
    }

    const product = result.rows[0];

    const inventoryQuery = `
      SELECT 
        i.*,
        wl.location_code,
        wl.location_name,
        wl.location_type
      FROM inventory i
      LEFT JOIN warehouse_locations wl ON i.location_id = wl.location_id
      WHERE i.product_id = $1 AND i.quantity_on_hand > 0
      ORDER BY wl.location_code
    `;

    const inventoryResult = await pool.query(inventoryQuery, [productId]);

    return {
      ...product,
      stock_status: getStockStatus(product.total_stock, product.reorder_level),
      inventory_locations: inventoryResult.rows
    };
  } catch (error) {
    console.error('❌ Get product by ID error:', error.message);
    throw error;
  }
};

const getProductBySKU = async (sku) => {
  try {
    const query = `
      SELECT 
        p.*,
        pc.category_name,
        COALESCE(SUM(i.quantity_on_hand), 0) as total_stock
      FROM products p
      LEFT JOIN product_categories pc ON p.category_id = pc.category_id
      LEFT JOIN inventory i ON p.product_id = i.product_id
      WHERE p.sku = $1
      GROUP BY p.product_id, pc.category_name
    `;

    const result = await pool.query(query, [sku]);

    if (result.rows.length === 0) {
      throw new Error('Product not found');
    }

    return {
      ...result.rows[0],
      stock_status: getStockStatus(result.rows[0].total_stock, result.rows[0].reorder_level)
    };
  } catch (error) {
    console.error('❌ Get product by SKU error:', error.message);
    throw error;
  }
};

const getCategories = async () => {
  try {
    const query = `
      SELECT 
        pc.category_id,
        pc.category_name,
        pc.description,
        COUNT(p.product_id) as product_count
      FROM product_categories pc
      LEFT JOIN products p ON pc.category_id = p.category_id AND p.is_active = true
      GROUP BY pc.category_id, pc.category_name, pc.description
      ORDER BY pc.category_name
    `;

    const result = await pool.query(query);
    return result.rows;
  } catch (error) {
    console.error('❌ Get categories error:', error.message);
    throw error;
  }
};

const getStockStatus = (currentStock, reorderLevel) => {
  const stock = parseInt(currentStock) || 0;
  const reorder = parseInt(reorderLevel) || 1000;
  
  if (stock === 0) return 'out_of_stock';
  if (stock <= reorder) return 'low_stock';
  return 'in_stock';
};

const getProductStats = async () => {
  try {
    const statsQuery = `
      WITH product_stock AS (
        SELECT 
          p.product_id,
          p.is_active,
          pc.category_id,
          COALESCE(SUM(i.quantity_on_hand), 0) as total_stock,
          COALESCE(SUM(i.quantity_on_hand * p.standard_cost), 0) as stock_value,
          CASE 
            WHEN COALESCE(SUM(i.quantity_on_hand), 0) = 0 THEN 'out_of_stock'
            WHEN COALESCE(SUM(i.quantity_on_hand), 0) <= p.reorder_level THEN 'low_stock'
            ELSE 'in_stock'
          END as stock_status
        FROM products p
        LEFT JOIN product_categories pc ON p.category_id = pc.category_id
        LEFT JOIN inventory i ON p.product_id = i.product_id
        GROUP BY p.product_id, p.is_active, pc.category_id, p.reorder_level
      )
      SELECT 
        COUNT(DISTINCT product_id) as total_products,
        COUNT(DISTINCT CASE WHEN is_active THEN product_id END) as active_products,
        COUNT(DISTINCT category_id) as total_categories,
        SUM(total_stock) as total_stock_units,
        SUM(stock_value) as total_inventory_value,
        COUNT(DISTINCT CASE WHEN stock_status = 'low_stock' THEN product_id END) as low_stock_products,
        COUNT(DISTINCT CASE WHEN stock_status = 'out_of_stock' THEN product_id END) as out_of_stock_products
      FROM product_stock
    `;

    const result = await pool.query(statsQuery);
    return result.rows[0];
  } catch (error) {
    console.error('❌ Get product stats error:', error.message);
    throw error;
  }
};

module.exports = {
  createProduct,
  getProducts,
  getProductById,
  getProductBySKU,
  getCategories,
  getProductStats
};