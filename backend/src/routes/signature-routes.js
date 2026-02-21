// backend/src/routes/signature-routes.js
const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt'); // Change to 'bcryptjs' if that's what your project uses
const { pool } = require('../services/auth-service');
const { authenticate } = require('../middleware/auth-middleware');

// POST /api/signature/verify
router.post('/verify', authenticate, async (req, res) => {
  try {
    const { password } = req.body;
    const userId = req.user.user_id;

    if (!password) {
      return res.status(400).json({ message: 'Password is required for digital signature.' });
    }

    // Fetch the user's current password hash
    const result = await pool.query('SELECT password_hash FROM users WHERE user_id = $1', [userId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'User not found.' });
    }

    // Verify the password
    const isValid = await bcrypt.compare(password, result.rows[0].password_hash);
    
    if (!isValid) {
      return res.status(401).json({ message: 'Invalid digital signature: Incorrect password.' });
    }

    res.json({ success: true, message: 'Signature verified successfully.' });
  } catch (error) {
    console.error('Signature verification error:', error);
    res.status(500).json({ message: 'Internal server error during signature verification.' });
  }
});

module.exports = router;