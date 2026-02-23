const express = require('express');
const router = express.Router();
const SettingsService = require('../services/settings-service');

// CORRECTED: Using your exact middleware names from dashboard-routes.js
const { authenticate, authorize } = require('../middleware/auth-middleware');

// GET: Fetch current settings & live exchange rates (Available to logged-in users)
router.get('/', authenticate, async (req, res) => {
  try {
    const settings = await SettingsService.getSettings();
    res.json(settings);
  } catch (error) {
    console.error('Settings fetch error:', error);
    res.status(500).json({ error: 'Failed to load system settings' });
  }
});

// PUT: Save new settings (Restricted to Admins only)
router.put('/', authenticate, authorize(['admin']), async (req, res) => {
  try {
    const updatedSettings = await SettingsService.updateSettings(req.body);
    res.json({ message: 'Settings saved successfully', settings: updatedSettings });
  } catch (error) {
    console.error('Settings update error:', error);
    res.status(500).json({ error: 'Failed to save settings' });
  }
});

module.exports = router;