const express = require('express');
const cors = require('cors');
require('dotenv').config();

const authRoutes = require('./src/routes/auth-routes');
const inventoryRoutes = require('./src/routes/inventory-routes');
const productsRoutes = require('./src/routes/products-routes');
const usersRoutes = require('./src/routes/users-routes');
const dashboardRoutes = require('./src/routes/dashboard-routes');
const reportsRoutes = require('./src/routes/reports-routes'); // NEW - Reports routes

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/reports', reportsRoutes); // NEW - Reports endpoints

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
  console.log(`📍 Running on: http://localhost:${PORT}`);
  console.log(`🏥 Health check: http://localhost:${PORT}/health`);
  console.log(`\n📋 Available Routes:`);
  console.log(`   /api/auth         - Authentication`);
  console.log(`   /api/dashboard    - Dashboard stats & data`);
  console.log(`   /api/inventory    - Inventory management`);
  console.log(`   /api/products     - Product catalog`);
  console.log(`   /api/users        - User management`);
  console.log(`   /api/reports      - Reports & analytics (NEW)`);
  console.log(`\n📊 Report Endpoints:`);
  console.log(`   GET /api/reports/stock-levels`);
  console.log(`   GET /api/reports/low-stock`);
  console.log(`   GET /api/reports/valuation`);
  console.log(`   GET /api/reports/movement`);
  console.log(`   GET /api/reports/transaction-summary`);
  console.log(`   GET /api/reports/location-summary`);
  console.log(`\n✅ Server ready!\n`);
});
