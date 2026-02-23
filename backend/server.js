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
const supplierRoutes = require('./src/routes/supplier-routes'); // NEW - Production Reports

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      'http://localhost:3000',
      'https://localhost:3000',
      process.env.CORS_ORIGIN
    ];
    
    // Check if origin contains 'ngrok' (for dynamic ngrok URLs)
    if (origin.includes('ngrok')) {
      return callback(null, true);
    }
    
    if (allowedOrigins.indexOf(origin) !== -1 || allowedOrigins.includes('*')) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true, // Important for cookies!
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));
app.use(express.json());

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

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Vilagio API is running',
    timestamp: new Date().toISOString()
  });
});

// Error handling
app.use((err, req, res, next) => {
  console.error('❌ Server error:', err.stack);
  res.status(500).json({ message: 'Something went wrong!' });
});

app.listen(PORT, () => {
  console.log(`\n🚀 Vilagio Inventory API Server`);
  console.log(`🔗 Running on: http://localhost:${PORT}`);
  console.log(`💚 Health check: http://localhost:${PORT}/health`);
  console.log(`\n📋 Available Routes:`);
  console.log(`   /api/auth         - Authentication`);
  console.log(`   /api/production   - Production management 🏭`);
  console.log(`   /api/dashboard    - Dashboard stats & data`);
  console.log(`   /api/inventory    - Inventory management`);
  console.log(`   /api/products     - Product catalog`);
  console.log(`   /api/users        - User management`);
  console.log(`   /api/reports      - Reports & analytics`);
  console.log(`   /api/barcode      - Barcode scanning`);
  console.log(`   /api/production/reports - Production Reports 📊 (NEW)`);
  console.log(`\n🏭 Production Endpoints:`);
  console.log(`   POST /api/production/batches                    - Create new batch`);
  console.log(`   GET  /api/production/batches                    - List batches`);
  console.log(`   GET  /api/production/batches/:id                - Get batch details`);
  console.log(`   POST /api/production/batches/:id/assign-components - Assign materials`);
  console.log(`   POST /api/production/batches/:id/submit-for-qa  - Submit for QA`);
  console.log(`   POST /api/production/batches/:id/start-setup    - Start setup`);
  console.log(`   POST /api/production/batches/:id/complete       - Complete production`);
  console.log(`   GET  /api/production/qa-gates/pending           - Pending QA approvals`);
  console.log(`   POST /api/production/qa-gates/:id/approve       - Approve QA gate`);
  console.log(`   POST /api/production/qa-gates/:id/reject        - Reject QA gate`);
  console.log(`   POST /api/production/ipqc                       - Log IPQC check`);
  console.log(`   POST /api/production/water-treatment            - Log water parameters`);
  console.log(`   POST /api/production/line-setup                 - Log line setup`);
  console.log(`   GET  /api/production/dashboard/active           - Active batches`);
  console.log(`\n📊 Inventory Report Endpoints:`);
  console.log(`   GET /api/reports/stock-levels`);
  console.log(`   GET /api/reports/low-stock`);
  console.log(`   GET /api/reports/valuation`);
  console.log(`   GET /api/reports/movement`);
  console.log(`   GET /api/reports/transaction-summary`);
  console.log(`   GET /api/reports/location-summary`);
  console.log(`\n📊 Production Report Endpoints (NEW):`);
  console.log(`   GET  /api/production/reports/batches            - List batches for reports`);
  console.log(`   GET  /api/production/reports/batch/:id/preview  - Preview batch report`);
  console.log(`   GET  /api/production/reports/batch/:id/pdf      - Download batch PDF`);
  console.log(`   POST /api/production/reports/summary            - Production summary`);
  console.log(`\n📷 Barcode Endpoints:`);
  console.log(`   POST /api/barcode/scan/product        - Scan & lookup product`);
  console.log(`   POST /api/barcode/scan/location       - Scan & lookup location`);
  console.log(`   POST /api/barcode/generate/product/:id - Generate product barcode`);
  console.log(`   POST /api/barcode/generate/location/:id - Generate location barcode`);
  console.log(`   POST /api/barcode/generate/products/batch - Batch generate barcodes`);
  console.log(`   GET  /api/barcode/statistics          - Scan statistics`);
  console.log(`   GET  /api/barcode/scans/recent        - Recent scan history`);
  console.log(`   GET  /api/barcode/configuration       - Get barcode config`);
  console.log(`\n✅ Server ready!\n`);
});
