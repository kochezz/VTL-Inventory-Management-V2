const express = require('express');
const cors = require('cors');
require('dotenv').config();

const authRoutes = require('./src/routes/auth-routes');
const productionRoutes = require('./src/routes/production-routes');
const inventoryRoutes = require('./src/routes/inventory-routes');
const productsRoutes = require('./src/routes/products-routes');
const usersRoutes = require('./src/routes/users-routes');
const dashboardRoutes = require('./src/routes/dashboard-routes');
const reportsRoutes = require('./src/routes/reports-routes');
const barcodeRoutes = require('./src/routes/barcode-routes');
const productionReportsRoutes = require('./src/routes/production-reports-routes');
const settingsRoutes = require('./src/routes/settings');
const supplierRoutes = require('./src/routes/supplier-routes');
const poRoutes = require('./src/routes/po-routes');
const grnRoutes = require('./src/routes/grn-routes');
const customerRoutes = require('./src/routes/customer-routes');
const metricsRoutes = require('./src/routes/metrics-routes');
const analyticsRoutes = require('./src/routes/analytics-routes');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
const corsOptions = {
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      'http://localhost:3000',
      'https://localhost:3000',
      process.env.CORS_ORIGIN
    ];
    
    if (origin.includes('ngrok')) {
      return callback(null, true);
    }
    
    if (allowedOrigins.indexOf(origin) !== -1 || allowedOrigins.includes('*')) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));

// Increase payload limit to 10MB to handle Base64 PDF Quotations
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/production', productionRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/barcode', barcodeRoutes);
app.use('/api/production/reports', productionReportsRoutes);
app.use('/api/signature', require('./src/routes/signature-routes'));
app.use('/api/settings', settingsRoutes);
app.use('/api/suppliers', supplierRoutes);
app.use('/api/pos', poRoutes);
app.use('/api/grns', grnRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/metrics', metricsRoutes);
app.use('/api/analytics', analyticsRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Vilagio API is running',
    timestamp: new Date().toISOString()
  });
});

// Express Route Error handling
app.use((err, req, res, next) => {
  console.error('❌ Server error:', err.stack);
  res.status(500).json({ message: 'Something went wrong!' });
});

app.listen(PORT, () => {
  console.log(`🚀 Vilagio API Server running on port ${PORT}`);
  console.log(`💚 Health check: http://localhost:${PORT}/health`);
});

// ============================================================================
// GLOBAL ERROR HANDLERS (Prevents Node.js from silent crashing)
// ============================================================================

// 1. Catches failed Async/Await Promises that missed a try/catch block
process.on('unhandledRejection', (reason, promise) => {
  console.error('🚨 Unhandled Rejection at:', promise, 'reason:', reason);
  // We log it, but DO NOT crash the server. It stays alive for other users.
});

// 2. Catches synchronous fat-finger errors (e.g., trying to read undefined.length)
process.on('uncaughtException', (error) => {
  console.error('🚨 Uncaught Exception thrown:', error);
  // For synchronous errors, memory might be corrupted.
  // We exit(1) specifically so PM2 catches the death and restarts it instantly with a clean slate.
  process.exit(1); 
});