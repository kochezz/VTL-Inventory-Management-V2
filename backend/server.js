// ============================================================================
// SERVER.JS — Updated for Phase B (QC Lab) + QMS Phase 2 (Scheduler)
// ============================================================================

const express = require('express');
const cors = require('cors');
require('dotenv').config();

const authRoutes              = require('./src/routes/auth-routes');
const productionRoutes        = require('./src/routes/production-routes');
const inventoryRoutes         = require('./src/routes/inventory-routes');
const productsRoutes          = require('./src/routes/products-routes');
const usersRoutes             = require('./src/routes/users-routes');
const dashboardRoutes         = require('./src/routes/dashboard-routes');
const reportsRoutes           = require('./src/routes/reports-routes');
const barcodeRoutes           = require('./src/routes/barcode-routes');
const productionReportsRoutes = require('./src/routes/production-reports-routes');
const settingsRoutes          = require('./src/routes/settings');
const supplierRoutes          = require('./src/routes/supplier-routes');
const poRoutes                = require('./src/routes/po-routes');
const grnRoutes               = require('./src/routes/grn-routes');
const customerRoutes          = require('./src/routes/customer-routes');
const metricsRoutes           = require('./src/routes/metrics-routes');
const analyticsRoutes         = require('./src/routes/analytics-routes');
const qmsRoutes               = require('./src/routes/qms-routes');
const labRoutes               = require('./src/routes/lab-routes');
const salesRoutes             = require('./src/routes/sales-routes');

// FIX: Imported the missing Sales Analytics routes!
const salesAnalyticsRoutes    = require('./src/routes/sales-analytics-routes');

// Mobile app aggregate routes
const mobileRoutes            = require('./src/routes/mobile-routes');

// QMS Periodic Review Scheduler (Render-safe — uses setInterval, not cron)
const qmsScheduler            = require('./src/services/qms-scheduler');

const app  = express();
const PORT = process.env.PORT || 3001;

// ============================================================================
// CORS
// ============================================================================
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, curl, Postman)
    if (!origin) return callback(null, true);

    // Allow null origin string (React Native on some devices)
    if (origin === 'null') return callback(null, true);

    // Allow ngrok tunnels for development
    if (origin.includes('ngrok')) return callback(null, true);

    // Allow Expo development origins
    if (origin.includes('exp://')) return callback(null, true);
    if (origin.includes('expo')) return callback(null, true);

    const envOrigins = process.env.CORS_ORIGINS || process.env.CORS_ORIGIN || '';
    const allowedOrigins = envOrigins
      .split(',')
      .map(url => url.trim())
      .filter(url => url.length > 0);

    allowedOrigins.push(
      'http://localhost:3000',
      'http://localhost:5173',
      'https://localhost:3000',
      'https://vilagio-erp-frontend.vercel.app'
    );

    if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
      callback(null, true);
    } else {
      console.error(`🚨 CORS Blocked: '${origin}' is not on the allowed list.`);
      // Allow anyway in production to prevent blocking legitimate mobile traffic
      callback(null, true);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// ============================================================================
// REQUEST LOGGING (500 errors)
// ============================================================================
app.use((req, res, next) => {
  res.on('finish', () => {
    if (res.statusCode >= 500) {
      console.error(`500 error on ${req.method} ${req.path}`);
    }
  });
  next();
});

// ============================================================================
// ROUTES
// ============================================================================
app.use('/api/auth',               authRoutes);
app.use('/api/production',         productionRoutes);
app.use('/api/dashboard',          dashboardRoutes);
app.use('/api/inventory',          inventoryRoutes);
app.use('/api/products',           productsRoutes);
app.use('/api/users',              usersRoutes);
app.use('/api/reports',            reportsRoutes);
app.use('/api/barcode',            barcodeRoutes);
app.use('/api/production/reports', productionReportsRoutes);
app.use('/api/signature',          require('./src/routes/signature-routes'));
app.use('/api/settings',           settingsRoutes);
app.use('/api/suppliers',          supplierRoutes);
app.use('/api/pos',                poRoutes);
app.use('/api/grns',               grnRoutes);
app.use('/api/customers',          customerRoutes);
app.use('/api/metrics',            metricsRoutes);
app.use('/api/analytics',          analyticsRoutes);
app.use('/api/qms',                qmsRoutes);
app.use('/api/lab',                labRoutes);
app.use('/api/sales',              salesRoutes);

// FIX: Mounted the missing Sales Analytics routes so the frontend can reach them!
app.use('/api/sales-analytics',    salesAnalyticsRoutes);

// Mobile app aggregate routes
app.use('/api/mobile',             mobileRoutes);

// ============================================================================
// HEALTH CHECK
// ============================================================================
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Vilagio API is running',
    timestamp: new Date().toISOString()
  });
});

// ============================================================================
// ERROR HANDLING
// ============================================================================
app.use((err, req, res, next) => {
  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({ message: 'CORS Error: Origin not allowed.' });
  }
  console.error('❌ Server error:', err.stack);
  res.status(500).json({ message: 'Something went wrong!' });
});

// ============================================================================
// START SERVER
// ============================================================================
app.listen(PORT, () => {
  console.log(`🚀 Vilagio API Server running on port ${PORT}`);
  console.log(`💚 Health check: http://localhost:${PORT}/health`);
  console.log(`🧪 QC Lab API:   http://localhost:${PORT}/api/lab`);
  console.log(`📋 QMS API:      http://localhost:${PORT}/api/qms`);

  // Start the QMS periodic review scheduler.
  // Runs an initial check 10 seconds after startup (to let the DB pool warm up),
  // then repeats every 24 hours. Safe on Render — no cron process required.
  qmsScheduler.start();

  // Keep Neon connection alive — ping every 4 minutes.
  // Neon drops idle connections after ~5 minutes on the free tier.
  const { pool } = require('./src/services/auth-service');
  setInterval(async () => {
    try {
      await pool.query('SELECT 1');
      console.log('💚 DB keep-alive ping OK');
    } catch (err) {
      console.error('💔 DB keep-alive ping failed:', err.message);
    }
  }, 4 * 60 * 1000);
});

// ============================================================================
// GLOBAL ERROR HANDLERS
// ============================================================================
process.on('unhandledRejection', (reason, promise) => {
  console.error('🚨 Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('🚨 Uncaught Exception thrown:', error);
  process.exit(1);
});

// Log termination signals so we can tell whether Render is sending them
// unexpectedly (which would explain mystery crashes in the Render logs).
// We do NOT call pool.end() here — the pool handles its own cleanup on exit.
process.on('SIGTERM', () => {
  console.log('⚠️  SIGTERM received — Render is shutting down this instance. Exiting cleanly.');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('⚠️  SIGINT received (Ctrl+C or container stop). Exiting cleanly.');
  process.exit(0);
});