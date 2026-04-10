// ============================================================================
// SALES ROUTES — POS Module
// backend/src/routes/sales-routes.js
// ============================================================================

const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth-middleware');
const posService = require('../services/pos-service');

router.use(authenticate);

// ── Global Pricing & Exchange Rates ───────────────────────────────────────────

router.get('/exchange-rate', async (req, res) => {
  try {
    const rate = await posService.getLiveExchangeRate();
    res.json({ exchange_rate: rate });
  } catch (err) {
    console.error('GET /sales/exchange-rate error:', err);
    res.status(500).json({ error: 'Failed to fetch live exchange rate' });
  }
});

router.post('/exchange-rate', authorize(['admin', 'cfo', 'manager']), async (req, res) => {
  try {
    const { rate_value } = req.body;
    const userId = req.user.user_id;

    if (!rate_value || isNaN(rate_value)) {
      return res.status(400).json({ error: 'Valid rate value is required' });
    }

    // Insert the new rate, effectively creating an auditable history
    await posService.setLiveExchangeRate(parseFloat(rate_value), userId);
    
    res.json({ message: 'Global exchange rate updated successfully', rate_value });
  } catch (err) {
    console.error('POST /sales/exchange-rate error:', err);
    res.status(500).json({ error: 'Failed to update live exchange rate' });
  }
});

// ── Products & Inventory ──────────────────────────────────────────────────────

router.get('/products', async (req, res) => {
  try {
    const products = await posService.getPOSProducts();
    res.json({ products });
  } catch (err) {
    console.error('GET /sales/products error:', err);
    res.status(500).json({ error: 'Failed to fetch POS products' });
  }
});

router.get('/products/:id/locations', async (req, res) => {
  try {
    const locations = await posService.getProductLocations(req.params.id);
    res.json({ locations });
  } catch (err) {
    console.error('GET /sales/products/:id/locations error:', err);
    res.status(500).json({ error: 'Failed to fetch product locations' });
  }
});

// ── Customer Search ───────────────────────────────────────────────────────────

router.get('/customers/search', async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.trim().length < 2) {
      return res.json({ customers: [] });
    }
    const customers = await posService.searchCustomers(q.trim());
    res.json({ customers });
  } catch (err) {
    console.error('GET /sales/customers/search error:', err);
    res.status(500).json({ error: 'Failed to search customers' });
  }
});

// ── Sessions ──────────────────────────────────────────────────────────────────

router.get('/sessions/active', async (req, res) => {
  try {
    const session = await posService.getActiveSession(req.user.user_id);
    res.json({ session });
  } catch (err) {
    console.error('GET /sales/sessions/active error:', err);
    res.status(500).json({ error: 'Failed to fetch active session' });
  }
});

router.post('/sessions/open', authorize(['admin', 'manager', 'staff', 'sales']), async (req, res) => {
  try {
    const { opening_float } = req.body;
    const session = await posService.openSession(req.user.user_id, opening_float);
    res.status(201).json({ session, message: 'Session opened successfully' });
  } catch (err) {
    console.error('POST /sales/sessions/open error:', err);
    res.status(400).json({ error: err.message || 'Failed to open session' });
  }
});

router.post('/sessions/:id/close', authorize(['admin', 'manager', 'staff', 'sales']), async (req, res) => {
  try {
    const { closing_cash, notes } = req.body;
    const session = await posService.closeSession(
      req.params.id, req.user.user_id, closing_cash, notes
    );
    res.json({ session, message: 'Session closed successfully' });
  } catch (err) {
    console.error('POST /sales/sessions/:id/close error:', err);
    res.status(400).json({ error: err.message || 'Failed to close session' });
  }
});

router.get('/sessions', authorize(['admin', 'manager']), async (req, res) => {
  try {
    const sessions = await posService.listSessions(req.query);
    res.json({ sessions });
  } catch (err) {
    console.error('GET /sales/sessions error:', err);
    res.status(500).json({ error: 'Failed to fetch sessions' });
  }
});

router.get('/sessions/:id', async (req, res) => {
  try {
    const session = await posService.getSessionById(req.params.id);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    res.json({ session });
  } catch (err) {
    console.error('GET /sales/sessions/:id error:', err);
    res.status(500).json({ error: 'Failed to fetch session' });
  }
});

// ── Transactions ──────────────────────────────────────────────────────────────

router.post('/transactions', authorize(['admin', 'manager', 'staff', 'sales']), async (req, res) => {
  try {
    const { lines } = req.body;
    if (!lines || lines.length === 0) {
      return res.status(400).json({ error: 'At least one product line is required' });
    }
    const transaction = await posService.createTransaction(req.body, req.user.user_id);
    res.status(201).json({ transaction, message: 'Sale completed successfully' });
  } catch (err) {
    console.error('POST /sales/transactions error:', err);
    res.status(500).json({ error: err.message || 'Failed to process transaction' });
  }
});

router.get('/transactions', async (req, res) => {
  try {
    const transactions = await posService.listTransactions(req.query);
    res.json({ transactions });
  } catch (err) {
    console.error('GET /sales/transactions error:', err);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

router.get('/transactions/:id', async (req, res) => {
  try {
    const transaction = await posService.getTransactionById(req.params.id);
    if (!transaction) return res.status(404).json({ error: 'Transaction not found' });
    res.json({ transaction });
  } catch (err) {
    console.error('GET /sales/transactions/:id error:', err);
    res.status(500).json({ error: 'Failed to fetch transaction' });
  }
});

router.post('/transactions/:id/void', authorize(['admin', 'manager']), async (req, res) => {
  try {
    const { reason } = req.body;
    if (!reason?.trim()) {
      return res.status(400).json({ error: 'A void reason is required' });
    }
    const transaction = await posService.voidTransaction(
      req.params.id, req.user.user_id, reason
    );
    res.json({ transaction, message: 'Transaction voided and inventory restored' });
  } catch (err) {
    console.error('POST /sales/transactions/:id/void error:', err);
    res.status(400).json({ error: err.message || 'Failed to void transaction' });
  }
});

router.post('/transactions/:id/email-receipt', async (req, res) => {
  try {
    const { email, currency, exchangeRate } = req.body;
    if (!email?.trim()) {
      return res.status(400).json({ error: 'Email address is required' });
    }
    await posService.sendReceiptEmail(req.params.id, email.trim(), currency, exchangeRate);
    res.json({ message: `Receipt emailed to ${email}` });
  } catch (err) {
    console.error('POST /sales/transactions/:id/email-receipt error:', err);
    res.status(500).json({ error: err.message || 'Failed to email receipt' });
  }
});

// ── Dashboard Stats ───────────────────────────────────────────────────────────

router.get('/stats', async (req, res) => {
  try {
    const stats = await posService.getPOSDashboardStats();
    res.json({ stats });
  } catch (err) {
    console.error('GET /sales/stats error:', err);
    res.status(500).json({ error: 'Failed to fetch POS stats' });
  }
});

module.exports = router;