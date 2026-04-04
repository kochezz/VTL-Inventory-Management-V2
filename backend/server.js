// ============================================================================
// SERVER.JS — Updated for Phase B (QC Lab routes added)
// ============================================================================

const express = require('express');
const cors = require('cors');
require('dotenv').config();

const authRoutes            = require('./src/routes/auth-routes');
const productionRoutes      = require('./src/routes/production-routes');
const inventoryRoutes       = require('./src/routes/inventory-routes');
const productsRoutes        = require('./src/routes/products-routes');
const usersRoutes           = require('./src/routes/users-routes');
const dashboardRoutes       = require('./src/routes/dashboard-routes');
const reportsRoutes         = require('./src/routes/reports-routes');
const barcodeRoutes         = require('./src/routes/barcode-routes');
const productionReportsRoutes = require('./src/routes/production-reports-routes');
const settingsRoutes        = require('./src/routes/settings');
const supplierRoutes        = require('./src/routes/supplier-routes');
const poRoutes              = require('./src/routes/po-routes');
const grnRoutes             = require('./src/routes/grn-routes');
const customerRoutes        = require('./src/routes/customer-routes');
const metricsRoutes         = require('./src/routes/metrics-routes');
const analyticsRoutes       = require('./src/routes/analytics-routes');
const qmsRoutes             = require('./src/routes/qms-routes');
const labRoutes             = require('./src/routes/lab-routes'); 

const app = express();
const PORT = process.env.PORT || 3001;

// ============================================================================
// BULLETPROOF CORS MIDDLEWARE
// ============================================================================
const corsOptions = {
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    
    if (origin.includes('ngrok')) {
      return callback(null, true);
    }

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
      console.error(`🚨 CORS Blocked: The origin '${origin}' is not on the allowed list.`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/auth',                authRoutes);
app.use('/api/production',          productionRoutes);
app.use('/api/dashboard',           dashboardRoutes);
app.use('/api/inventory',           inventoryRoutes);
app.use('/api/products',            productsRoutes);
app.use('/api/users',               usersRoutes);
app.use('/api/reports',             reportsRoutes);
app.use('/api/barcode',             barcodeRoutes);
app.use('/api/production/reports',  productionReportsRoutes);
app.use('/api/signature',           require('./src/routes/signature-routes'));
app.use('/api/settings',            settingsRoutes);
app.use('/api/suppliers',           supplierRoutes);
app.use('/api/pos',                 poRoutes);
app.use('/api/grns',                grnRoutes);
app.use('/api/customers',           customerRoutes);
app.use('/api/metrics',             metricsRoutes);
app.use('/api/analytics',           analyticsRoutes);
app.use('/api/qms',                 qmsRoutes);
app.use('/api/lab',                 labRoutes);              

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Vilagio API is running',
    timestamp: new Date().toISOString()
  });
});

// ── Error handling ────────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({ message: 'CORS Error: Origin not allowed.' });
  }
  console.error('❌ Server error:', err.stack);
  res.status(500).json({ message: 'Something went wrong!' });
});

app.listen(PORT, () => {
  console.log(`🚀 Vilagio API Server running on port ${PORT}`);
  console.log(`💚 Health check: http://localhost:${PORT}/health`);
  console.log(`🧪 QC Lab API:   http://localhost:${PORT}/api/lab`);
});

// ── Global error handlers ─────────────────────────────────────────────────────
process.on('unhandledRejection', (reason, promise) => {
  console.error('🚨 Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('🚨 Uncaught Exception thrown:', error);
  process.exit(1); 
});
