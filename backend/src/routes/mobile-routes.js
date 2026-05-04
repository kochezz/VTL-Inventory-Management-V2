// ============================================================================
// MOBILE ROUTES — Aggregate endpoints for VTL Executive mobile app
// ============================================================================

const express = require('express');
const router  = express.Router();
const { authenticate, authorize } = require('../middleware/auth-middleware');
const { pool }      = require('../services/auth-service');
const mobileService = require('../services/mobile-service');
const qmsService    = require('../services/qms-service');
const { getSalesAnalytics } = require('../services/sales-analytics-service');

const MOBILE_ALLOWED_ROLES = ['admin', 'system_admin', 'ceo', 'cfo', 'manager'];

function requireMobileExecutiveAccess(req, res, next) {
  const role = String(req.user?.role ?? '').toLowerCase();
  if (!MOBILE_ALLOWED_ROLES.includes(role)) {
    return res.status(403).json({
      error: 'MOBILE_ACCESS_RESTRICTED',
      message: 'VTL Executive mobile access is restricted to Managers, CEO, CFO and System Admin users.'
    });
  }
  next();
}

router.use(authenticate);
router.use(requireMobileExecutiveAccess);

// ── Ping (auth + mobile role guard) ──────────────────────────────────────────
router.get('/ping', (req, res) => {
  res.json({ ok: true, message: 'mobile routes working' });
});

// ── Inventory transactions column diagnostic (auth + mobile role guard) ──────
router.get('/debug-inv', async (req, res) => {
  try {
    const invCols = await pool.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'inventory_transactions'
      ORDER BY ordinal_position
    `);
    const sample = await pool.query(`
      SELECT * FROM inventory_transactions LIMIT 2
    `);
    res.json({ columns: invCols.rows, sample_rows: sample.rows });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

const APPROVERS = ['admin', 'qa', 'manager', 'ceo', 'cfo'];

// ── Read endpoints ────────────────────────────────────────────────────────────

router.get('/dashboard', async (req, res) => {
  try {
    const data = await mobileService.getDashboardSummary();
    res.json(data);
  } catch (err) {
    console.error('❌ GET /api/mobile/dashboard:', err.message);
    res.status(500).json({ message: 'Failed to load dashboard summary' });
  }
});

router.get('/alerts', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const data = await mobileService.getAlertFeed(limit);
    res.json(data);
  } catch (err) {
    console.error('❌ GET /api/mobile/alerts:', err.message);
    res.status(500).json({ message: 'Failed to load alerts' });
  }
});

router.get('/operations', async (req, res) => {
  try {
    const data = await mobileService.getOperationsSummary();
    res.json(data);
  } catch (err) {
    console.error('❌ GET /api/mobile/operations:', err.message);
    res.status(500).json({ message: 'Failed to load operations summary' });
  }
});

router.get('/quality', async (req, res) => {
  try {
    const data = await mobileService.getQualitySummary();
    res.json(data);
  } catch (err) {
    console.error('❌ GET /api/mobile/quality:', err.message);
    res.status(500).json({ message: 'Failed to load quality summary' });
  }
});

router.get('/people', async (req, res) => {
  try {
    const data = await mobileService.getPeopleSummary();
    res.json(data);
  } catch (err) {
    console.error('❌ GET /api/mobile/people:', err.message);
    res.status(500).json({ message: 'Failed to load people summary' });
  }
});

router.get('/commercial', async (req, res) => {
  try {
    const data = await mobileService.getCommercialSummary();
    res.json(data);
  } catch (err) {
    console.error('❌ GET /api/mobile/commercial:', err.message);
    res.status(500).json({ message: 'Failed to load commercial summary' });
  }
});

router.get('/sales-intelligence', async (req, res) => {
  try {
    const range = req.query.range || '30d';
    const analytics = await getSalesAnalytics(range);

    res.json({
      range,
      exchangeRate: analytics.exchangeRate ?? 27,
      kpis: analytics.kpis ?? {},
      dailyTrend: Array.isArray(analytics.dailyTrend) ? analytics.dailyTrend : [],
      revenueBySku: Array.isArray(analytics.revenueBySku)
        ? analytics.revenueBySku.slice(0, 8)
        : [],
    });
  } catch (error) {
    console.error('[Mobile Sales Intelligence] Failed:', error);
    res.status(500).json({
      error: 'Failed to load mobile sales intelligence',
      dailyTrend: [],
      revenueBySku: [],
    });
  }
});

router.post('/register-device', async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ message: 'token is required' });
    const result = await mobileService.registerDevice(req.user.user_id, token);
    res.json(result);
  } catch (err) {
    console.error('❌ POST /api/mobile/register-device:', err.message);
    res.status(500).json({ message: 'Failed to register device' });
  }
});

// ── Micro-action endpoints ────────────────────────────────────────────────────

router.post('/approve/ncr/:id', authorize(APPROVERS), async (req, res) => {
  try {
    const { status, root_cause, resolution, signature_password } = req.body;
    if (!signature_password) {
      return res.status(400).json({ message: 'signature_password is required' });
    }
    const result = await qmsService.updateNCR(
      req.params.id,
      { status, root_cause, resolution },
      req.user.user_id,
      signature_password
    );
    res.json(result);
  } catch (err) {
    console.error('❌ POST /api/mobile/approve/ncr:', err.message);
    const status = err.message.includes('Invalid digital signature') ? 401
      : err.message.includes('not found') ? 404 : 500;
    res.status(status).json({ message: err.message });
  }
});

router.post('/approve/capa/:id', authorize(APPROVERS), async (req, res) => {
  try {
    const { status, effectiveness_review, signature_password } = req.body;
    if (!signature_password) {
      return res.status(400).json({ message: 'signature_password is required' });
    }
    const result = await qmsService.updateCAPA(
      req.params.id,
      { status, effectiveness_review },
      req.user.user_id,
      signature_password
    );
    res.json(result);
  } catch (err) {
    console.error('❌ POST /api/mobile/approve/capa:', err.message);
    const status = err.message.includes('Invalid digital signature') ? 401
      : err.message.includes('not found') ? 404 : 500;
    res.status(status).json({ message: err.message });
  }
});

router.post('/approve/document/:versionId', authorize(APPROVERS), async (req, res) => {
  try {
    const { signature_password } = req.body;
    if (!signature_password) {
      return res.status(400).json({ message: 'signature_password is required' });
    }
    const result = await qmsService.releaseDocument(
      req.params.versionId,
      req.user.user_id,
      signature_password,
      req.ip
    );
    res.json(result);
  } catch (err) {
    console.error('❌ POST /api/mobile/approve/document:', err.message);
    const status = err.message.includes('Invalid digital signature') ? 401
      : err.message.includes('not found') ? 404 : 500;
    res.status(status).json({ message: err.message });
  }
});

module.exports = router;
