const express = require('express');
const router = express.Router();
const productsService = require('../services/products-service');
const { authenticate, authorize } = require('../middleware/auth-middleware');
const NotificationService = require('../services/notification-service');

// Same set compliance-service.js uses for its self-approval notification
// filtering -- kept as a separate local constant rather than a shared import
// since this module has no other dependency on the compliance service.
const EXECUTIVE_ROLES = ['admin', 'cfo', 'ceo'];

// All product routes require authentication
router.use(authenticate);

// POST /api/products - Create new product
// junior_accountant added (Finance access expansion) -- manager's existing
// access here predates that session and is untouched.
router.post('/', authorize(['admin', 'manager', 'ceo', 'cfo', 'junior_accountant']), async (req, res) => {
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
// PUT /api/products/pricing - Bulk update pricing
// junior_accountant added (Finance access expansion) -- manager was never on
// this route and stays that way. Every write now requires a `reason` (the
// lightweight substitute for a blocking approval gate this module doesn't
// have: no unilateral, unexplained price change, but nothing sits pending),
// logs one price_change_log row per product whose selling_price actually
// changed (the ZMW figure is a derived/computed display value, not an
// independently-edited price, so it isn't logged separately), and notifies
// the other executive roles.
const { pool } = require('../config/database');
router.put('/pricing', authorize(['admin', 'ceo', 'cfo', 'junior_accountant']), async (req, res) => {
  const { reason } = req.body;
  if (!reason || !reason.trim()) {
    return res.status(400).json({ message: 'A reason is required for every price change.' });
  }

  const client = await pool.connect();
  client.on('error', (err) => { console.error('❌ Unexpected error on checked-out client (manual transaction):', err.message); });
  const changes = [];
  try {
    await client.query('BEGIN');
    for (const p of req.body.products) {
      const beforeRes = await client.query(
        `SELECT selling_price, product_name, sku FROM products WHERE product_id = $1`,
        [p.product_id]
      );
      const before = beforeRes.rows[0];

      await client.query(
        `UPDATE products SET selling_price = $1, selling_price_zmw = $2 WHERE product_id = $3`,
        [p.selling_price || 0, p.selling_price_zmw || null, p.product_id]
      );

      if (before) {
        const oldPrice = Number(before.selling_price) || 0;
        const newPrice = Number(p.selling_price) || 0;
        if (oldPrice !== newPrice) {
          await client.query(
            `INSERT INTO price_change_log (product_id, old_price, new_price, currency, reason, changed_by)
             VALUES ($1, $2, $3, 'USD', $4, $5)`,
            [p.product_id, oldPrice, newPrice, reason, req.user.user_id]
          );
          changes.push({ product_id: p.product_id, product_name: before.product_name, sku: before.sku, old_price: oldPrice, new_price: newPrice });
        }
      }
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Pricing update error:', error);
    return res.status(500).json({ message: 'Failed to update pricing' });
  } finally {
    client.release();
  }

  // The transaction is already committed at this point -- a notification
  // failure below must never come back to the client as "pricing update
  // failed" (the price change is real and already saved). Fire-and-forget,
  // deliberately outside the try/catch/rollback above rather than inside it
  // the way compliance-routes.js's approve endpoint does it: that route has
  // no manual BEGIN/COMMIT of its own to accidentally roll back a second
  // time, this one does.
  res.json({ success: true, message: 'Prices updated successfully', changes_logged: changes.length });

  if (changes.length > 0) {
    (async () => {
      try {
        const notifyRoles = EXECUTIVE_ROLES.filter((r) => r !== req.user.role);
        const emails = await NotificationService.getEmailsByRole(notifyRoles);
        const rowsHtml = changes
          .map((c) => `<tr><td>${c.sku}</td><td>${c.product_name}</td><td>$${c.old_price.toFixed(2)}</td><td>$${c.new_price.toFixed(2)}</td></tr>`)
          .join('');
        const html = `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
            <div style="background-color:#22c55e;padding:20px;text-align:center;color:white;"><h2>Pricing Updated</h2></div>
            <div style="padding:20px;color:#334155;">
              <p><strong>${req.user.full_name}</strong> (${req.user.role.toUpperCase()}) updated pricing on ${changes.length} product(s).</p>
              <p><strong>Reason:</strong> ${reason}</p>
              <table style="width:100%;border-collapse:collapse;margin-top:12px;">
                <thead><tr><th align="left">SKU</th><th align="left">Product</th><th align="left">Old (USD)</th><th align="left">New (USD)</th></tr></thead>
                <tbody>${rowsHtml}</tbody>
              </table>
            </div>
          </div>`;
        await NotificationService.sendEmail(emails, `Pricing Updated by ${req.user.full_name}`, html);
      } catch (notifyErr) {
        console.error('❌ Failed to send pricing-change notification:', notifyErr);
      }
    })();
  }
});

module.exports = router;