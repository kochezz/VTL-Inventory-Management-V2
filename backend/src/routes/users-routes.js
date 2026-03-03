const express = require('express');
const router = express.Router();
const usersService = require('../services/users-service');
const { authenticate, authorize } = require('../middleware/auth-middleware');

// 1. Authenticate ALL routes
router.use(authenticate);

// ============================================================================
// SELF-SERVICE ROUTES (Any logged-in user can access their own profile)
// ============================================================================
router.get('/me/profile', async (req, res) => {
  try { res.json(await usersService.getUserById(req.user.user_id)); } 
  catch (error) { res.status(404).json({ message: error.message }); }
});

router.put('/me/profile', async (req, res) => {
  try {
    const { password, phone_number, personal_email, home_address, emergency_contacts, preferred_name } = req.body;
    const payload = { phone_number, personal_email, home_address, emergency_contacts, preferred_name };
    
    if (password) {
      payload.password = password;
      payload.requires_password_change = false; 
    }

    const updatedUser = await usersService.updateUser(req.user.user_id, payload);
    res.json(updatedUser);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// NEW: Holiday Management Self-Service Routes
router.get('/me/holidays', async (req, res) => {
  try { res.json(await usersService.getHolidayData(req.user.user_id)); }
  catch (error) { res.status(500).json({ message: error.message }); }
});

router.post('/me/holidays', async (req, res) => {
  try { res.json(await usersService.submitHolidayRequest(req.user.user_id, req.body)); }
  catch (error) { res.status(400).json({ message: error.message }); }
});

// MANAGER ROUTES: Holiday Approvals
router.get('/holidays/pending', async (req, res) => {
  try { res.json(await usersService.getPendingHolidayApprovals(req.user.user_id)); }
  catch (error) { res.status(500).json({ message: error.message }); }
});

router.put('/holidays/:id/respond', async (req, res) => {
  try { res.json(await usersService.respondToHolidayRequest(req.params.id, req.body.status, req.user.user_id)); }
  catch (error) { res.status(400).json({ message: error.message }); }
});

// ============================================================================
// ADMIN-ONLY ROUTES (HR & User Management)
// ============================================================================
router.use(authorize('admin'));

router.get('/', async (req, res) => {
  try { res.json(await usersService.getAllUsers()); } 
  catch (error) { res.status(500).json({ message: error.message }); }
});

router.get('/:id', async (req, res) => {
  try { res.json(await usersService.getUserById(req.params.id)); } 
  catch (error) { res.status(404).json({ message: error.message }); }
});

router.post('/', async (req, res) => {
  try {
    if (!req.body.email || !req.body.full_name || !req.body.password || !req.body.role) {
      return res.status(400).json({ message: 'Missing required fields' });
    }
    const newUser = await usersService.createUser(req.body);
    res.status(201).json(newUser);
  } catch (error) {
    if (error.message.includes('already exists')) return res.status(409).json({ message: error.message });
    res.status(400).json({ message: error.message });
  }
});

router.put('/:id', async (req, res) => {
  try { res.json(await usersService.updateUser(req.params.id, req.body)); } 
  catch (error) {
    if (error.message.includes('not found')) return res.status(404).json({ message: error.message });
    res.status(400).json({ message: error.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    if (req.params.id === req.user.user_id) return res.status(400).json({ message: 'Cannot delete your own account' });
    await usersService.deleteUser(req.params.id);
    res.json({ message: 'User deleted successfully' });
  } catch (error) { res.status(400).json({ message: error.message }); }
});

router.patch('/:id/status', async (req, res) => {
  try {
    if (req.params.id === req.user.user_id && !req.body.is_active) return res.status(400).json({ message: 'Cannot deactivate yourself' });
    res.json(await usersService.updateUserStatus(req.params.id, req.body.is_active));
  } catch (error) { res.status(400).json({ message: error.message }); }
});

router.post('/:id/reset-password', async (req, res) => {
  try { res.json(await usersService.initiatePasswordReset(req.params.id)); } 
  catch (error) { res.status(400).json({ message: error.message }); }
});

router.get('/stats/summary', async (req, res) => {
  try { res.json(await usersService.getUserStats()); } 
  catch (error) { res.status(500).json({ message: error.message }); }
});

module.exports = router;