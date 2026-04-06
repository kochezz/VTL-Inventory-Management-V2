const express = require('express');
const router = express.Router();
const productsService = require('../services/products-service');
const { authenticate, authorize } = require('../middleware/auth-middleware');

// All product routes require authentication
router.use(authenticate);

// POST /api/products - Create new product
router.post('/', authorize(['admin', 'manager', 'ceo', 'cfo']), async (req, res) => {
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
    } = req.body;

    // Validation
    if (!sku || !product_name || !category_id || !base_uom) {
      return res.status(400).json({ 
        message: 'Missing required fields: sku, product_name, category_id, base_uom' 
      });
    }

    console.log(`📦 Creating new product: ${sku} - ${product_name}`);

    const product = await productsService.createProduct({
      sku,
      product_name,
      description,
      category_id,
      base_uom,
      standard_cost: standard_cost || 0,
      selling_price: selling_price || 0,
      reorder_level: reorder_level || 0,
      is_active: is_active !== undefined ? is_active : true
    });

    console.log(`✅ Product created: ${product.product_id}`);

    res.status(201).json(product);
  } catch (error) {
    console.error('❌ Create product route error:', error.message);
    if (error.message.includes('already exists') || error.message.includes('duplicate')) {
      res.status(409).json({ message: 'Product with this SKU already exists' });
    } else {
      res.status(500).json({ message: error.message });
    }
  }
});

// GET /api/products - Get all products with filters
router.get('/', async (req, res) => {
  try {
    const filters = {
      category_id: req.query.category_id,
      is_active: req.query.is_active !== undefined ? req.query.is_active === 'true' : undefined,
      stock_status: req.query.stock_status,
      search: req.query.search,
      sort_by: req.query.sort_by,
      sort_order: req.query.sort_order,
      limit: req.query.limit ? parseInt(req.query.limit) : undefined,
      offset: req.query.offset ? parseInt(req.query.offset) : undefined
    };

    console.log('📦 Fetching products with filters:', filters);

    const result = await productsService.getProducts(filters);
    
    console.log(`✅ Found ${result.products.length} products (Total: ${result.total})`);
    
    res.json(result);
  } catch (error) {
    console.error('❌ Get products route error:', error.message);
    res.status(500).json({ message: error.message });
  }
});

// GET /api/products/stats - Get product statistics
router.get('/stats', async (req, res) => {
  try {
    console.log('📊 Fetching product statistics');
    
    const stats = await productsService.getProductStats();
    
    console.log('✅ Product stats retrieved');
    
    res.json(stats);
  } catch (error) {
    console.error('❌ Get product stats route error:', error.message);
    res.status(500).json({ message: error.message });
  }
});

// GET /api/products/categories - Get all categories
router.get('/categories', async (req, res) => {
  try {
    console.log('📁 Fetching categories');
    
    const categories = await productsService.getCategories();
    
    console.log(`✅ Found ${categories.length} categories`);
    
    res.json(categories);
  } catch (error) {
    console.error('❌ Get categories route error:', error.message);
    res.status(500).json({ message: error.message });
  }
});

// GET /api/products/sku/:sku - Get product by SKU
router.get('/sku/:sku', async (req, res) => {
  try {
    const { sku } = req.params;
    
    console.log(`🔍 Fetching product by SKU: ${sku}`);
    
    const product = await productsService.getProductBySKU(sku);
    
    console.log(`✅ Product found: ${product.product_name}`);
    
    res.json(product);
  } catch (error) {
    console.error('❌ Get product by SKU route error:', error.message);
    res.status(404).json({ message: error.message });
  }
});

// GET /api/products/:id - Get product by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log(`🔍 Fetching product by ID: ${id}`);
    
    const product = await productsService.getProductById(id);
    
    console.log(`✅ Product found: ${product.product_name}`);
    
    res.json(product);
  } catch (error) {
    console.error('❌ Get product by ID route error:', error.message);
    res.status(404).json({ message: error.message });
  }
});
// PUT /api/products/pricing - Bulk update pricing (Admin/Execs only)
const { pool } = require('../config/database');
router.put('/pricing', authorize(['admin', 'ceo', 'cfo']), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const p of req.body.products) {
      await client.query(
        `UPDATE products SET selling_price = $1, selling_price_zmw = $2 WHERE product_id = $3`,
        [p.selling_price || 0, p.selling_price_zmw || null, p.product_id]
      );
    }
    await client.query('COMMIT');
    res.json({ success: true, message: 'Prices updated successfully' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Pricing update error:', error);
    res.status(500).json({ message: 'Failed to update pricing' });
  } finally {
    client.release();
  }
});

module.exports = router;