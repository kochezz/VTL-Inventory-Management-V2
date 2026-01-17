// src/api/server.js
// Main Express API Server for Vilagio Inventory Management
// Provides REST API endpoints for all inventory operations

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const db = require('../utils/db');
require('dotenv').config();

// Import routes
const authRoutes = require('./routes/auth');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// ==============================================
// MIDDLEWARE
// ==============================================

// Security headers
app.use(helmet());

// CORS configuration
const corsOptions = {
  origin: process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  maxAge: 600, // 10 minutes
};
app.use(cors(corsOptions));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(
      `[${new Date().toISOString()}] ${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`
    );
  });
  next();
});

// ==============================================
// ROUTES
// ==============================================

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    const dbHealth = await db.healthCheck();
    
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: dbHealth,
      environment: process.env.NODE_ENV || 'development',
    });
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message,
    });
  }
});

// API info endpoint
app.get('/api', (req, res) => {
  res.json({
    name: 'Vilagio Inventory Management API',
    version: '1.0.0',
    description: 'Backend API for Drip Water inventory management system',
    endpoints: {
      health: '/health',
      authentication: '/api/auth',
      products: '/api/products (coming soon)',
      inventory: '/api/inventory (coming soon)',
      transactions: '/api/transactions (coming soon)',
      reports: '/api/reports (coming soon)',
    },
    documentation: '/api/docs (coming soon)',
  });
});

// Authentication routes
app.use('/api/auth', authRoutes);

// Placeholder routes (to be implemented in Week 7-8)
app.all('/api/products*', (req, res) => {
  res.status(501).json({
    success: false,
    message: 'Products API endpoints coming in Week 7',
    availableNow: '/api/auth for authentication',
  });
});

app.all('/api/inventory*', (req, res) => {
  res.status(501).json({
    success: false,
    message: 'Inventory API endpoints coming in Week 7',
    availableNow: '/api/auth for authentication',
  });
});

app.all('/api/transactions*', (req, res) => {
  res.status(501).json({
    success: false,
    message: 'Transaction API endpoints coming in Week 7',
    availableNow: '/api/auth for authentication',
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Not found',
    message: `Cannot ${req.method} ${req.path}`,
    availableEndpoints: [
      'GET /health',
      'GET /api',
      'POST /api/auth/login',
      'POST /api/auth/logout',
      'GET /api/auth/me',
    ],
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

// ==============================================
// SERVER STARTUP
// ==============================================

async function startServer() {
  try {
    // Test database connection
    console.log('🔌 Testing database connection...');
    const connected = await db.testConnection();
    
    if (!connected) {
      console.error('❌ Failed to connect to database');
      console.error('   Please check your .env file and database configuration');
      process.exit(1);
    }

    // Start listening
    app.listen(PORT, () => {
      console.log('');
      console.log('✅ Vilagio Inventory API Server Started!');
      console.log('');
      console.log(`📡 Server running on: http://localhost:${PORT}`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log('');
      console.log('📚 Available endpoints:');
      console.log(`   GET  http://localhost:${PORT}/health`);
      console.log(`   GET  http://localhost:${PORT}/api`);
      console.log(`   POST http://localhost:${PORT}/api/auth/login`);
      console.log(`   POST http://localhost:${PORT}/api/auth/logout`);
      console.log(`   GET  http://localhost:${PORT}/api/auth/me`);
      console.log('');
      console.log('💡 Test the API:');
      console.log(`   curl http://localhost:${PORT}/health`);
      console.log('');
      console.log('🛑 Press Ctrl+C to stop the server');
      console.log('');
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('\n🛑 SIGTERM received, shutting down gracefully...');
  await db.closePool();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('\n🛑 SIGINT received, shutting down gracefully...');
  await db.closePool();
  process.exit(0);
});

// Start the server
if (require.main === module) {
  startServer();
}

module.exports = app;
