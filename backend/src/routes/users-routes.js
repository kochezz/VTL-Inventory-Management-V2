const express = require('express');
const router = express.Router();
const usersService = require('../services/users-service');
const { authenticate, authorize } = require('../middleware/auth-middleware');

// All user management routes require admin authentication
router.use(authenticate);
router.use(authorize('admin'));

// GET /api/users - Get all users
router.get('/', async (req, res) => {
  try {
    console.log('📋 Fetching all users');
    
    const users = await usersService.getAllUsers();
    
    console.log(`✅ Found ${users.length} users`);
    
    res.json(users);
  } catch (error) {
    console.error('❌ Get users route error:', error.message);
    res.status(500).json({ message: error.message });
  }
});

// GET /api/users/:id - Get single user by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log(`🔍 Fetching user: ${id}`);
    
    const user = await usersService.getUserById(id);
    
    console.log(`✅ User found: ${user.email}`);
    
    res.json(user);
  } catch (error) {
    console.error('❌ Get user by ID route error:', error.message);
    res.status(404).json({ message: error.message });
  }
});

// POST /api/users - Create new user
router.post('/', async (req, res) => {
  try {
    const { email, full_name, password, role, is_active, is_verified } = req.body;

    // Validation
    if (!email || !full_name || !password || !role) {
      return res.status(400).json({ 
        message: 'Missing required fields: email, full_name, password, role' 
      });
    }

    console.log(`➕ Creating new user: ${email}`);

    const newUser = await usersService.createUser({
      email,
      full_name,
      password,
      role,
      is_active: is_active !== undefined ? is_active : true,
      is_verified: is_verified !== undefined ? is_verified : true,
      created_by: req.user.user_id
    });

    console.log(`✅ User created successfully: ${newUser.email}`);

    res.status(201).json(newUser);
  } catch (error) {
    console.error('❌ Create user route error:', error.message);
    
    // Handle duplicate email
    if (error.message.includes('already exists')) {
      return res.status(409).json({ message: error.message });
    }
    
    res.status(400).json({ message: error.message });
  }
});

// PUT /api/users/:id - Update user
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { email, full_name, password, role, is_active, is_verified } = req.body;

    console.log(`✏️ Updating user: ${id}`);

    const updatedUser = await usersService.updateUser(id, {
      email,
      full_name,
      password, // Optional - only update if provided
      role,
      is_active,
      is_verified,
      updated_by: req.user.user_id
    });

    console.log(`✅ User updated successfully: ${updatedUser.email}`);

    res.json(updatedUser);
  } catch (error) {
    console.error('❌ Update user route error:', error.message);
    
    if (error.message.includes('not found')) {
      return res.status(404).json({ message: error.message });
    }
    
    res.status(400).json({ message: error.message });
  }
});

// DELETE /api/users/:id - Delete user
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Prevent deleting yourself
    if (id === req.user.user_id) {
      return res.status(400).json({ 
        message: 'Cannot delete your own account' 
      });
    }

    console.log(`🗑️ Deleting user: ${id}`);

    await usersService.deleteUser(id);

    console.log(`✅ User deleted successfully`);

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('❌ Delete user route error:', error.message);
    
    if (error.message.includes('not found')) {
      return res.status(404).json({ message: error.message });
    }
    
    res.status(400).json({ message: error.message });
  }
});

// PATCH /api/users/:id/status - Toggle user active status
router.patch('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { is_active } = req.body;

    if (typeof is_active !== 'boolean') {
      return res.status(400).json({ 
        message: 'is_active must be a boolean' 
      });
    }

    // Prevent deactivating yourself
    if (id === req.user.user_id && !is_active) {
      return res.status(400).json({ 
        message: 'Cannot deactivate your own account' 
      });
    }

    console.log(`🔄 Toggling user status: ${id} -> ${is_active ? 'active' : 'inactive'}`);

    const updatedUser = await usersService.updateUserStatus(id, is_active);

    console.log(`✅ User status updated successfully`);

    res.json(updatedUser);
  } catch (error) {
    console.error('❌ Update user status route error:', error.message);
    
    if (error.message.includes('not found')) {
      return res.status(404).json({ message: error.message });
    }
    
    res.status(400).json({ message: error.message });
  }
});

// POST /api/users/:id/reset-password - Send password reset email
router.post('/:id/reset-password', async (req, res) => {
  try {
    const { id } = req.params;

    console.log(`🔒 Initiating password reset for user: ${id}`);

    const result = await usersService.initiatePasswordReset(id);

    console.log(`✅ Password reset initiated`);

    res.json(result);
  } catch (error) {
    console.error('❌ Reset password route error:', error.message);
    
    if (error.message.includes('not found')) {
      return res.status(404).json({ message: error.message });
    }
    
    res.status(400).json({ message: error.message });
  }
});

// GET /api/users/stats - Get user statistics
router.get('/stats/summary', async (req, res) => {
  try {
    console.log('📊 Fetching user statistics');
    
    const stats = await usersService.getUserStats();
    
    console.log('✅ User stats retrieved');
    
    res.json(stats);
  } catch (error) {
    console.error('❌ Get user stats route error:', error.message);
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
