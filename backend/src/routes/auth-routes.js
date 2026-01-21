const express = require('express');
const router = express.Router();
const authService = require('../services/auth-service');
const { authenticate } = require('../middleware/auth-middleware');

// POST /api/auth/login - User login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({ 
        message: 'Email and password are required' 
      });
    }

    // Get IP address and user agent
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'];

    console.log(`\n📧 Login request for: ${email}`);
    console.log(`🌐 IP: ${ipAddress}`);
    console.log(`💻 User Agent: ${userAgent}\n`);

    // Attempt login
    const result = await authService.login(email, password, ipAddress, userAgent);
    
    res.json(result);
  } catch (error) {
    console.error('❌ Login route error:', error.message);
    res.status(401).json({ message: error.message });
  }
});

// POST /api/auth/logout - User logout
router.post('/logout', async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ 
        message: 'Refresh token is required' 
      });
    }

    const result = await authService.logout(refreshToken);
    res.json(result);
  } catch (error) {
    console.error('❌ Logout route error:', error.message);
    res.status(400).json({ message: error.message });
  }
});

// POST /api/auth/refresh - Refresh access token
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ 
        message: 'Refresh token is required' 
      });
    }

    const result = await authService.refreshAccessToken(refreshToken);
    res.json(result);
  } catch (error) {
    console.error('❌ Refresh token route error:', error.message);
    res.status(401).json({ message: error.message });
  }
});

// GET /api/auth/me - Get current user info (protected route)
router.get('/me', authenticate, async (req, res) => {
  try {
    res.json({ user: req.user });
  } catch (error) {
    console.error('❌ Get user route error:', error.message);
    res.status(500).json({ message: error.message });
  }
});

// POST /api/auth/verify - Verify token validity
router.post('/verify', async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ 
        message: 'Token is required' 
      });
    }

    const decoded = authService.verifyToken(token);
    res.json({ 
      valid: true, 
      user: decoded 
    });
  } catch (error) {
    res.status(401).json({ 
      valid: false, 
      message: error.message 
    });
  }
});

module.exports = router;
