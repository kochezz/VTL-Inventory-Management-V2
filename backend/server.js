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
const qmsRoutes = require('./src/routes/qms-routes');

const app = express();
const PORT = process.env.PORT || 3001;

// ============================================================================
// BULLETPROOF CORS MIDDLEWARE
// ============================================================================
const corsOptions = {
  origin: function (origin, callback) {
    // 1. Allow server-to-server requests or local tools (Postman/cURL)
    if (!origin) return callback(null, true);
    
    // 2. Automatically allow any ngrok URLs for testing
    if (origin.includes('ngrok')) {
      return callback(null, true);
    }

    // 3. Safely grab the env variable (checking both plural and singular just in case)
    const envOrigins = process.env.CORS_ORIGINS || process.env.CORS_ORIGIN || '';
    
    // 4. Split the string by commas and clean up any accidental spaces
    const allowedOrigins = envOrigins
      .split(',')
      .map(url => url.trim())
      .filter(url => url.length > 0);
      
    // 5. Always allow local development ports as a baseline fallback
    allowedOrigins.push('http://localhost:3000', 'http://localhost:5173', 'https://localhost:3000');

    // 6. Check if the origin is on the list, OR if the wildcard '*' is active
    if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
      callback(null, true);
    } else {
      // Log the exact URL that got rejected to the Render console for easy debugging
      console.error(`🚨 CORS Blocked: The origin '${origin}' is not on the allowed list.`);
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
app.use('/api/qms', qmsRoutes);

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
  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({ message: 'CORS Error: Origin not allowed.' });
  }
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

process.on('unhandledRejection', (reason, promise) => {
  console.error('🚨 Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('🚨 Uncaught Exception thrown:', error);
  process.exit(1); 
});