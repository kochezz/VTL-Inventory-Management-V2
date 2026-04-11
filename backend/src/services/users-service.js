const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');
const { pool } = require('./auth-service');

// FIX: Added 'sales' to the valid roles list
const VALID_ROLES = ['admin', 'ceo', 'cfo', 'manager', 'qa', 'engineering', 'staff', 'operator', 'sales', 'super_viewer', 'viewer'];

const getAllUsers = async () => {
  try {
    const query = `
      SELECT 
        user_id, email, full_name, preferred_name, photo_url, date_of_birth, gender, nationality, 
        national_id, home_address, personal_email, phone_number, emergency_contacts,
        employee_number, job_title, department, reports_to, employment_date, employment_status, employment_type,
        role, is_active, is_verified, requires_password_change, created_at, updated_at, last_login
      FROM users ORDER BY created_at DESC
    `;
    const result = await pool.query(query);
    return result.rows;
  } catch (error) {
    throw error;
  }
};

const getUserById = async (userId) => {
  try {
    const query = `
      SELECT 
        user_id, email, full_name, preferred_name, photo_url, date_of_birth, gender, nationality, 
        national_id, home_address, personal_email, phone_number, emergency_contacts,
        employee_number, job_title, department, reports_to, employment_date, employment_status, employment_type,
        role, is_active, is_verified, requires_password_change, created_at, updated_at, last_login
      FROM users WHERE user_id = $1
    `;
    const result = await pool.query(query, [userId]);
    if (result.rows.length === 0) throw new Error('User not found');
    return result.rows[0];
  } catch (error) {
    throw error;
  }
};

const createUser = async (userData) => {
  try {
    const { 
      email, full_name, password, role, is_active, is_verified, requires_password_change,
      preferred_name, photo_url, date_of_birth, gender, nationality, national_id, home_address, 
      personal_email, phone_number, emergency_contacts,
      employee_number, job_title, department, reports_to, employment_date, employment_status, employment_type
    } = userData;

    if (!VALID_ROLES.includes(role)) throw new Error(`Invalid role.`);
    
    const emailCheck = await pool.query('SELECT user_id FROM users WHERE email = $1', [email]);
    if (emailCheck.rows.length > 0) throw new Error('Email already exists');

    const password_hash = await bcrypt.hash(password, 10);
    const user_id = uuidv4();

    const query = `
      INSERT INTO users (
        user_id, email, full_name, password_hash, role, is_active, is_verified, requires_password_change,
        preferred_name, photo_url, date_of_birth, gender, nationality, national_id, home_address, 
        personal_email, phone_number, emergency_contacts,
        employee_number, job_title, department, reports_to, employment_date, employment_status, employment_type,
        created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, 
        $9, $10, $11, $12, $13, $14, $15, 
        $16, $17, $18, 
        $19, $20, $21, $22, $23, $24, $25,
        NOW(), NOW()
      ) RETURNING *
    `;

    const result = await pool.query(query, [
      user_id, email, full_name, password_hash, role, is_active, is_verified, 
      requires_password_change !== undefined ? requires_password_change : true,
      preferred_name || null, photo_url || null, date_of_birth || null, gender || null, 
      nationality || null, national_id || null, home_address || null, personal_email || null, 
      phone_number || null, JSON.stringify(emergency_contacts || []),
      employee_number || null, job_title || null, department || null, reports_to || null, 
      employment_date || null, employment_status || null, employment_type || null
    ]);

    delete result.rows[0].password_hash;
    return result.rows[0];
  } catch (error) {
    throw error;
  }
};

const updateUser = async (userId, userData) => {
  try {
    const { 
      password, user_id, created_at, updated_at, last_login, password_hash, requires_password_change,
      ...fieldsToUpdate 
    } = userData;

    const userCheck = await pool.query('SELECT user_id FROM users WHERE user_id = $1', [userId]);
    if (userCheck.rows.length === 0) throw new Error('User not found');

    if (fieldsToUpdate.role && !VALID_ROLES.includes(fieldsToUpdate.role)) throw new Error('Invalid role');
    if (fieldsToUpdate.email) {
      const emailCheck = await pool.query('SELECT user_id FROM users WHERE email = $1 AND user_id != $2', [fieldsToUpdate.email, userId]);
      if (emailCheck.rows.length > 0) throw new Error('Email already exists');
    }

    const updates = [];
    const values = [];
    let paramCount = 1;

    for (const [key, value] of Object.entries(fieldsToUpdate)) {
      if (value !== undefined) {
        updates.push(`${key} = $${paramCount}`);
        values.push(key === 'emergency_contacts' ? JSON.stringify(value) : value);
        paramCount++;
      }
    }

    if (requires_password_change !== undefined && !password) {
      updates.push(`requires_password_change = $${paramCount}`);
      values.push(requires_password_change);
      paramCount++;
    }

    if (password) {
      updates.push(`password_hash = $${paramCount}`);
      values.push(await bcrypt.hash(password, 10));
      paramCount++;
      updates.push(`requires_password_change = $${paramCount}`);
      values.push(requires_password_change !== undefined ? requires_password_change : true);
      paramCount++;
    }

    updates.push(`updated_at = NOW()`);
    values.push(userId);

    const query = `UPDATE users SET ${updates.join(', ')} WHERE user_id = $${paramCount} RETURNING *`;
    const result = await pool.query(query, values);
    
    delete result.rows[0].password_hash;
    return result.rows[0];
  } catch (error) {
    throw error;
  }
};

const deleteUser = async (userId) => {
  try {
    await pool.query('DELETE FROM users WHERE user_id = $1', [userId]);
    return { message: 'User deleted successfully' };
  } catch (error) {
    throw error;
  }
};

const updateUserStatus = async (userId, isActive) => {
  try {
    const result = await pool.query(`UPDATE users SET is_active = $1, updated_at = NOW() WHERE user_id = $2 RETURNING *`, [isActive, userId]);
    delete result.rows[0].password_hash;
    return result.rows[0];
  } catch (error) { throw error; }
};

const initiatePasswordReset = async (userId) => {
  try {
    const userQuery = await pool.query('SELECT email, full_name FROM users WHERE user_id = $1 AND is_active = true', [userId]);
    if (userQuery.rows.length === 0) throw new Error('User not found');
    const crypto = require('crypto');
    const resetToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    await pool.query(`INSERT INTO password_reset_tokens (user_id, token, expires_at, created_at) VALUES ($1, $2, NOW() + INTERVAL '1 hour', NOW())`, [userId, hashedToken]);
    return { message: 'Password reset initiated', dev_token: process.env.NODE_ENV === 'development' ? resetToken : undefined };
  } catch (error) { throw error; }
};

const getUserStats = async () => {
  try {
    // FIX: Added counting logic for the 'sales' role
    const result = await pool.query(`
      SELECT 
        COUNT(*) as total, COUNT(*) FILTER (WHERE is_active = true) as active,
        COUNT(*) FILTER (WHERE is_active = false) as inactive,
        COUNT(*) FILTER (WHERE role = 'admin') as admins, COUNT(*) FILTER (WHERE role = 'ceo') as ceos,
        COUNT(*) FILTER (WHERE role = 'cfo') as cfos, COUNT(*) FILTER (WHERE role = 'manager') as managers,
        COUNT(*) FILTER (WHERE role = 'engineering') as engineers, COUNT(*) FILTER (WHERE role = 'qa') as qa_users,
        COUNT(*) FILTER (WHERE role = 'staff') as staff, COUNT(*) FILTER (WHERE role = 'operator') as operators,
        COUNT(*) FILTER (WHERE role = 'sales') as sales_reps,
        COUNT(*) FILTER (WHERE role = 'super_viewer') as super_viewers, COUNT(*) FILTER (WHERE role = 'viewer') as viewers
      FROM users
    `);
    return result.rows[0];
  } catch (error) { throw error; }
};

// ============================================================================
// HR HOLIDAY MANAGEMENT
// ============================================================================

const getHolidayData = async (userId) => {
  try {
    const year = new Date().getFullYear();
    const totalAllowance = 15; 
    
    const reqQuery = await pool.query(
      `SELECT * FROM holiday_requests WHERE user_id = $1 ORDER BY created_at DESC`,
      [userId]
    );
    
    const requests = reqQuery.rows;
    
    const usedDays = requests
      .filter(r => r.status === 'Approved' && new Date(r.start_date).getFullYear() === year)
      .reduce((sum, r) => sum + r.days_requested, 0);
      
    const pendingDays = requests
      .filter(r => r.status === 'Pending' && new Date(r.start_date).getFullYear() === year)
      .reduce((sum, r) => sum + r.days_requested, 0);
      
    return {
      allowance: totalAllowance,
      used: usedDays,
      pending: pendingDays,
      remaining: totalAllowance - usedDays,
      history: requests
    };
  } catch (error) {
    throw error;
  }
};

const submitHolidayRequest = async (userId, payload) => {
  try {
    const { start_date, end_date, days_requested } = payload;
    
    if (days_requested <= 0) throw new Error('Invalid date range selected.');

    const user = await getUserById(userId);
    let managerEmail = null;
    
    if (user.reports_to) {
       const mgrQuery = await pool.query('SELECT email FROM users WHERE full_name = $1 OR user_id::text = $1 LIMIT 1', [user.reports_to]);
       if (mgrQuery.rows.length > 0) {
         managerEmail = mgrQuery.rows[0].email;
       }
    }
    
    const request_id = uuidv4();
    const result = await pool.query(
      `INSERT INTO holiday_requests (request_id, user_id, start_date, end_date, days_requested, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, 'Pending', NOW(), NOW()) RETURNING *`,
      [request_id, userId, start_date, end_date, days_requested]
    );
    
    try {
      const notificationService = require('./notification-service');
      if (notificationService.notifyHolidayRequest && managerEmail) {
        notificationService.notifyHolidayRequest(user.full_name, start_date, end_date, days_requested, managerEmail);
      }
    } catch(e) { 
      console.warn('Notice: Notification service skip (Email not sent).', e.message); 
    }
    
    return result.rows[0];
  } catch (error) {
    throw error;
  }
};

const getPendingHolidayApprovals = async (userId) => {
  try {
    const user = await getUserById(userId);
    const query = `
      SELECT hr.*, u.full_name, u.email, u.department
      FROM holiday_requests hr
      JOIN users u ON hr.user_id = u.user_id
      WHERE hr.status = 'Pending' AND (u.reports_to = $1 OR $2 = 'admin')
      ORDER BY hr.created_at ASC
    `;
    const result = await pool.query(query, [user.full_name, user.role]);
    return result.rows;
  } catch (error) {
    throw error;
  }
};

const respondToHolidayRequest = async (requestId, status, reviewerId) => {
  try {
    const reviewer = await getUserById(reviewerId);
    
    const result = await pool.query(
      `UPDATE holiday_requests SET status = $1, updated_at = NOW() WHERE request_id = $2 RETURNING *`,
      [status, requestId]
    );
    
    if (result.rows.length === 0) throw new Error('Holiday request not found');

    const reqData = result.rows[0];
    const employee = await getUserById(reqData.user_id);

    try {
      const notificationService = require('./notification-service');
      if (notificationService.notifyHolidayResponse) {
        notificationService.notifyHolidayResponse(
          employee.full_name, 
          employee.email, 
          reqData.start_date, 
          reqData.end_date, 
          status, 
          reviewer.full_name
        );
      }
    } catch(e) { 
      console.warn('Notice: Notification email skip.', e.message); 
    }

    return reqData;
  } catch (error) {
    throw error;
  }
};

module.exports = { 
  getAllUsers, 
  getUserById, 
  createUser, 
  updateUser, 
  deleteUser, 
  updateUserStatus, 
  initiatePasswordReset, 
  getUserStats,
  getHolidayData, 
  submitHolidayRequest,
  getPendingHolidayApprovals,
  respondToHolidayRequest
};