'use strict';

const { pool } = require('./auth-service');

const SALARY_ROLES = ['hr_admin', 'admin'];

function canSeeSalary(role) {
  return SALARY_ROLES.includes(role);
}

function redactSalary(row) {
  if (!row || typeof row !== 'object') return row;
  const r = { ...row };
  delete r.basic_salary_zmw;
  return r;
}

const getBaseUserById = async (userId) => {
  const result = await pool.query(
    `SELECT
      user_id,
      email,
      full_name,
      preferred_name,
      role,
      employee_number,
      job_title,
      department,
      reports_to,
      employment_date,
      employment_status,
      employment_type,
      is_active
    FROM users
    WHERE user_id = $1
    LIMIT 1`,
    [userId]
  );

  return result.rows[0] || null;
};

// ─── 1. getDashboardStats ────────────────────────────────────────────────────

const getDashboardStats = async () => {
  try {
    const result = await pool.query('SELECT * FROM v_hr_dashboard');
    return result.rows[0] || {};
  } catch (error) {
    throw error;
  }
};

// ─── 2. getAllEmployees ──────────────────────────────────────────────────────

const getAllEmployees = async (requestingUserRole) => {
  try {
    const result = await pool.query(
      'SELECT * FROM v_hr_employee_profile ORDER BY full_name'
    );
    const rows = result.rows.map((row) => ({ ...row, hr_record_exists: true }));
    if (!canSeeSalary(requestingUserRole)) {
      return rows.map(redactSalary);
    }
    return rows;
  } catch (error) {
    throw error;
  }
};

// ─── 3. getEmployeeByUserId ──────────────────────────────────────────────────

const getEmployeeByUserId = async (userId, requestingUserRole) => {
  try {
    const profileRes = await pool.query(
      'SELECT * FROM v_hr_employee_profile WHERE user_id = $1',
      [userId]
    );

    if (profileRes.rows.length === 0) {
      const baseUser = await getBaseUserById(userId);
      if (!baseUser) return null;

      return {
        profile: {
          ...baseUser,
          hr_record_exists: false,
          hr_status: null,
          department_structured: null,
          reports_to_name: baseUser.reports_to,
          onboarding_complete: false,
          onboarding_pct: 0,
          has_active_pip: false,
          probation_end_date: null,
          effective_probation_end: null,
          days_to_probation_end: null,
          basic_salary_zmw: undefined,
        },
        contract: null,
        activePip: null,
      };
    }

    const [contractRes, pipRes, hrEmpRes] = await Promise.all([
      pool.query(
        'SELECT * FROM hr_contracts WHERE user_id = $1 AND is_current = TRUE LIMIT 1',
        [userId]
      ),
      pool.query(
        'SELECT * FROM hr_pips WHERE user_id = $1 AND is_active = TRUE LIMIT 1',
        [userId]
      ),
      pool.query(
        `SELECT basic_salary_zmw, salary_effective_date, napsa_member_number,
                hr_status, contract_type, probation_end_date, probation_extended_to,
                confirmation_date, offer_accepted_date, exit_date, exit_reason,
                department_id, reports_to_user_id, onboarding_complete
         FROM hr_employees WHERE user_id = $1 LIMIT 1`,
        [userId]
      ),
    ]);

    // Merge hr_employees fields into profile (view data + direct table data)
    const hrEmpRow = hrEmpRes.rows[0] || {};
    let profile = {
      ...profileRes.rows[0],
      ...hrEmpRow,           // hr_employees fields take precedence for HR-specific data
      hr_record_exists: true,
    };

    // Re-apply salary redaction after merge
    if (!canSeeSalary(requestingUserRole)) {
      profile = redactSalary(profile);
    }

    return {
      profile,
      contract: contractRes.rows[0] || null,
      activePip: pipRes.rows[0] || null,
    };
  } catch (error) {
    throw error;
  }
};

const getUsersMissingHrRecord = async () => {
  try {
    const result = await pool.query(
      `SELECT
        u.user_id,
        u.full_name,
        u.email,
        u.employee_number,
        u.job_title,
        u.department,
        u.reports_to,
        u.employment_date,
        u.employment_status,
        u.employment_type,
        u.role,
        u.is_active
      FROM users u
      LEFT JOIN hr_employees he ON he.user_id = u.user_id
      WHERE u.is_active = TRUE
        AND he.user_id IS NULL
      ORDER BY u.full_name`
    );

    return result.rows;
  } catch (error) {
    throw error;
  }
};

const getActiveUsersForHrRecord = async () => {
  try {
    const result = await pool.query(
      `SELECT
        user_id,
        full_name,
        email,
        employee_number,
        job_title,
        department,
        reports_to,
        role,
        is_active
      FROM users
      WHERE is_active = TRUE
      ORDER BY full_name`
    );

    return result.rows;
  } catch (error) {
    throw error;
  }
};

// ─── 4. createHrRecord ──────────────────────────────────────────────────────

const createHrRecord = async (userId, hrData, createdByUserId) => {
  try {
    const {
      department_id,
      reports_to_user_id,
      hr_status,
      contract_type,
      offer_accepted_date,
      basic_salary_zmw,
      salary_effective_date,
      napsa_member_number,
    } = hrData;

    const query = `
      INSERT INTO hr_employees (
        user_id, department_id, reports_to_user_id, hr_status,
        contract_type, offer_accepted_date, basic_salary_zmw, salary_effective_date,
        napsa_member_number, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (user_id) DO UPDATE SET
        department_id          = EXCLUDED.department_id,
        reports_to_user_id     = EXCLUDED.reports_to_user_id,
        hr_status              = EXCLUDED.hr_status,
        contract_type          = EXCLUDED.contract_type,
        offer_accepted_date    = EXCLUDED.offer_accepted_date,
        basic_salary_zmw       = EXCLUDED.basic_salary_zmw,
        salary_effective_date  = EXCLUDED.salary_effective_date,
        napsa_member_number    = EXCLUDED.napsa_member_number,
        updated_at             = NOW()
      RETURNING *
    `;

    await pool.query(query, [
      userId,
      department_id || null,
      reports_to_user_id || null,
      hr_status || null,
      contract_type || null,
      offer_accepted_date || null,
      basic_salary_zmw || null,
      salary_effective_date || null,
      napsa_member_number || null,
      createdByUserId,
    ]);

    // Initialise all 8 onboarding modules with 'not_started' so the
    // onboarding tracker has real rows and the completion trigger works.
    // Uses ON CONFLICT DO NOTHING so re-running create is safe.
    const ONBOARDING_MODULES = [
      'phase_1_induction',
      'phase_2_gmp_safety',
      'module_a_finance',
      'module_b_operations',
      'module_c_engineering',
      'module_d_qa_qc',
      'module_e_sales_admin',
      'module_f_mgmt_systems',
    ];

    for (const module of ONBOARDING_MODULES) {
      await pool.query(
        `INSERT INTO hr_onboarding_progress (user_id, module, status)
         VALUES ($1, $2, 'not_started')
         ON CONFLICT (user_id, module) DO NOTHING`,
        [userId, module]
      );
    }

    return await getEmployeeByUserId(userId, 'admin');
  } catch (error) {
    throw error;
  }
};

// ─── 5. updateHrRecord ──────────────────────────────────────────────────────

const updateHrRecord = async (userId, updates, updatedByUserId) => {
  try {
    const EXCLUDED = ['user_id', 'created_at', 'created_by'];
    const setClauses = [];
    const values = [];
    let idx = 1;

    for (const [key, value] of Object.entries(updates)) {
      if (EXCLUDED.includes(key) || value === undefined) continue;
      setClauses.push(`${key} = $${idx}`);
      values.push(value);
      idx++;
    }

    if (setClauses.length === 0) throw new Error('No fields to update');

    setClauses.push(`updated_by = $${idx}`);
    values.push(updatedByUserId);
    idx++;
    setClauses.push(`updated_at = NOW()`);
    // DO NOT push a value for NOW() — it is a SQL function, not a parameter
    // Add the WHERE clause parameter AFTER all SET clauses
    values.push(userId);

    const query = `
      UPDATE hr_employees
      SET ${setClauses.join(', ')}
      WHERE user_id = $${idx}
      RETURNING *
    `;

    const result = await pool.query(query, values);
    if (result.rows.length === 0) throw new Error('Employee HR record not found');

    const roleRes = await pool.query(
      'SELECT role FROM users WHERE user_id = $1',
      [updatedByUserId]
    );
    const role = roleRes.rows[0] ? roleRes.rows[0].role : null;

    return canSeeSalary(role) ? result.rows[0] : redactSalary(result.rows[0]);
  } catch (error) {
    throw error;
  }
};

// ─── 6. getOnboardingProgress ────────────────────────────────────────────────

const getOnboardingProgress = async (userId) => {
  try {
    const result = await pool.query(
      'SELECT * FROM v_hr_onboarding_tracker WHERE user_id = $1 ORDER BY module',
      [userId]
    );
    return result.rows;
  } catch (error) {
    throw error;
  }
};

// ─── 7. upsertOnboardingModule ───────────────────────────────────────────────

const upsertOnboardingModule = async (userId, module, moduleData, trainerUserId) => {
  const VALID_MODULES = [
    'phase_1_induction', 'phase_2_gmp_safety', 'module_a_finance',
    'module_b_operations', 'module_c_engineering', 'module_d_qa_qc',
    'module_e_sales_admin', 'module_f_mgmt_systems',
  ];
  if (!module || !VALID_MODULES.includes(module)) {
    throw new Error(`Invalid onboarding module: ${module}`);
  }
  try {
    const {
      status,
      scheduled_date,
      started_date,
      completed_date,
      trainer_signed_date,
      trainee_signed_date,
      assessment_score,
      notes,
    } = moduleData;

    const query = `
      INSERT INTO hr_onboarding_progress (
        user_id, module, status, scheduled_date, started_date,
        completed_date, trainer_user_id, trainer_signed_date,
        trainee_signed_date, assessment_score, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      ON CONFLICT (user_id, module) DO UPDATE SET
        status               = EXCLUDED.status,
        scheduled_date       = EXCLUDED.scheduled_date,
        started_date         = EXCLUDED.started_date,
        completed_date       = EXCLUDED.completed_date,
        trainer_user_id      = EXCLUDED.trainer_user_id,
        trainer_signed_date  = EXCLUDED.trainer_signed_date,
        trainee_signed_date  = EXCLUDED.trainee_signed_date,
        assessment_score     = EXCLUDED.assessment_score,
        notes                = EXCLUDED.notes,
        updated_at           = NOW()
      RETURNING *
    `;

    const result = await pool.query(query, [
      userId,
      module,
      status || null,
      scheduled_date || null,
      started_date || null,
      completed_date || null,
      trainerUserId || null,
      trainer_signed_date || null,
      trainee_signed_date || null,
      assessment_score !== undefined ? assessment_score : null,
      notes || null,
    ]);

    return result.rows[0];
  } catch (error) {
    throw error;
  }
};

// ─── 8. getReviews ───────────────────────────────────────────────────────────

const getReviews = async (userId) => {
  try {
    const result = await pool.query(
      'SELECT * FROM hr_reviews WHERE user_id = $1 ORDER BY review_date DESC',
      [userId]
    );
    return result.rows;
  } catch (error) {
    throw error;
  }
};

// ─── 9. createReview ─────────────────────────────────────────────────────────

const createReview = async (userId, reviewData, conductedByUserId) => {
  try {
    const {
      review_type,
      review_date,
      scheduled_date,
      line_manager_user_id,
      performance_scores_json,
      weighted_overall_score,
      outcome,
      outcome_justification,
      action_items_json,
      confirmed_in_post,
    } = reviewData;

    const query = `
      INSERT INTO hr_reviews (
        user_id, review_type, review_date, scheduled_date,
        conducted_by_user_id, line_manager_user_id, performance_scores_json,
        weighted_overall_score, outcome, outcome_justification,
        action_items_json, confirmed_in_post, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *
    `;

    const result = await pool.query(query, [
      userId,
      review_type,
      review_date || null,
      scheduled_date || null,
      conductedByUserId,
      line_manager_user_id || null,
      performance_scores_json ? JSON.stringify(performance_scores_json) : null,
      weighted_overall_score !== undefined ? weighted_overall_score : null,
      outcome || null,
      outcome_justification || null,
      action_items_json ? JSON.stringify(action_items_json) : null,
      confirmed_in_post !== undefined ? confirmed_in_post : false,
      conductedByUserId,
    ]);

    return result.rows[0];
  } catch (error) {
    throw error;
  }
};

// ─── 10. updateReview ────────────────────────────────────────────────────────

const updateReview = async (reviewId, updates, updatedByUserId) => {
  try {
    const EXCLUDED = ['id', 'user_id', 'created_at', 'created_by'];
    const setClauses = [];
    const values = [];
    let idx = 1;

    for (const [key, value] of Object.entries(updates)) {
      if (EXCLUDED.includes(key) || value === undefined) continue;
      const jsonFields = ['performance_scores_json', 'action_items_json'];
      setClauses.push(`${key} = $${idx}`);
      values.push(jsonFields.includes(key) ? JSON.stringify(value) : value);
      idx++;
    }

    if (setClauses.length === 0) throw new Error('No fields to update');

    setClauses.push(`updated_by = $${idx}`);
    values.push(updatedByUserId);
    idx++;
    setClauses.push(`updated_at = NOW()`);
    values.push(reviewId);

    const query = `
      UPDATE hr_reviews
      SET ${setClauses.join(', ')}
      WHERE id = $${idx}
      RETURNING *
    `;

    const result = await pool.query(query, values);
    if (result.rows.length === 0) throw new Error('Review not found');
    return result.rows[0];
  } catch (error) {
    throw error;
  }
};

// ─── 11. getPipRecords ───────────────────────────────────────────────────────

const getPipRecords = async (userId) => {
  try {
    const result = await pool.query(
      'SELECT * FROM hr_pips WHERE user_id = $1 ORDER BY issued_date DESC',
      [userId]
    );
    return result.rows;
  } catch (error) {
    throw error;
  }
};

// ─── 12. createPip ───────────────────────────────────────────────────────────

const createPip = async (userId, pipData, createdByUserId) => {
  try {
    const {
      review_id,
      issued_date,
      pip_end_date,
      triggered_by_rating,
      performance_gap_json,
      targets_json,
      support_json,
    } = pipData;

    const query = `
      INSERT INTO hr_pips (
        user_id, review_id, issued_date, pip_end_date,
        triggered_by_rating, performance_gap_json, targets_json,
        support_json, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `;

    const result = await pool.query(query, [
      userId,
      review_id || null,
      issued_date || null,
      pip_end_date || null,
      triggered_by_rating || null,
      performance_gap_json ? JSON.stringify(performance_gap_json) : null,
      targets_json ? JSON.stringify(targets_json) : null,
      support_json ? JSON.stringify(support_json) : null,
      createdByUserId,
    ]);

    return result.rows[0];
  } catch (error) {
    throw error;
  }
};

// ─── 13. getPerformanceRatings ───────────────────────────────────────────────

const getPerformanceRatings = async (userId) => {
  try {
    const result = await pool.query(
      'SELECT * FROM v_hr_quarterly_ratings WHERE user_id = $1 ORDER BY year DESC, quarter DESC',
      [userId]
    );
    return result.rows;
  } catch (error) {
    throw error;
  }
};

// ─── 14. upsertPerformanceRating ─────────────────────────────────────────────

const upsertPerformanceRating = async (userId, ratingData, ratedByUserId) => {
  try {
    const {
      review_id,
      quarter,
      year,
      rating_date,
      output_scores_json,
      overall_rating,
      overall_score,
      md_notes,
      action_required,
      action_type,
    } = ratingData;

    const query = `
      INSERT INTO hr_performance_ratings (
        user_id, review_id, quarter, year, rating_date,
        output_scores_json, overall_rating, overall_score,
        md_notes, action_required, action_type, rated_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      ON CONFLICT (user_id, quarter, year) DO UPDATE SET
        review_id          = EXCLUDED.review_id,
        rating_date        = EXCLUDED.rating_date,
        output_scores_json = EXCLUDED.output_scores_json,
        overall_rating     = EXCLUDED.overall_rating,
        overall_score      = EXCLUDED.overall_score,
        md_notes           = EXCLUDED.md_notes,
        action_required    = EXCLUDED.action_required,
        action_type        = EXCLUDED.action_type,
        rated_by           = EXCLUDED.rated_by,
        updated_at         = NOW()
      RETURNING *
    `;

    const result = await pool.query(query, [
      userId,
      review_id || null,
      quarter,
      year,
      rating_date || null,
      output_scores_json ? JSON.stringify(output_scores_json) : null,
      overall_rating || null,
      overall_score !== undefined ? overall_score : null,
      md_notes || null,
      action_required !== undefined ? action_required : false,
      action_type || null,
      ratedByUserId,
    ]);

    return result.rows[0];
  } catch (error) {
    throw error;
  }
};

// ─── 15. getComplianceSnapshot ───────────────────────────────────────────────

const getComplianceSnapshot = async () => {
  try {
    const result = await pool.query('SELECT * FROM v_hr_compliance_snapshot');
    return result.rows[0] || {};
  } catch (error) {
    throw error;
  }
};

// ─── 16. getLeaveBalance ─────────────────────────────────────────────────────

const getLeaveBalance = async (userId) => {
  try {
    const result = await pool.query(
      `SELECT * FROM v_hr_holiday_summary
       WHERE user_id = $1 AND leave_year = EXTRACT(YEAR FROM CURRENT_DATE)`,
      [userId]
    );

    if (result.rows.length > 0) return result.rows[0];

    // Fallback: count approved holiday_requests for current year
    const year = new Date().getFullYear();
    const fallback = await pool.query(
      `SELECT COALESCE(SUM(days_requested), 0) AS annual_taken
       FROM holiday_requests
       WHERE user_id = $1 AND status = 'Approved'
         AND EXTRACT(YEAR FROM start_date) = $2`,
      [userId, year]
    );

    const taken = parseInt(fallback.rows[0].annual_taken, 10) || 0;
    return {
      annual_entitlement: 15,
      annual_taken: taken,
      annual_balance: 15 - taken,
    };
  } catch (error) {
    throw error;
  }
};

// ─── 17. upsertLeaveBalance ──────────────────────────────────────────────────

const upsertLeaveBalance = async (userId, year, balanceData) => {
  try {
    const {
      annual_entitlement,
      annual_taken,
      annual_carried_over,
      sick_entitlement,
      sick_taken,
    } = balanceData;

    const query = `
      INSERT INTO hr_leave_balances (
        user_id, leave_year, annual_entitlement, annual_taken,
        annual_carried_over, sick_entitlement, sick_taken
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (user_id, leave_year) DO UPDATE SET
        annual_entitlement  = EXCLUDED.annual_entitlement,
        annual_taken        = EXCLUDED.annual_taken,
        annual_carried_over = EXCLUDED.annual_carried_over,
        sick_entitlement    = EXCLUDED.sick_entitlement,
        sick_taken          = EXCLUDED.sick_taken,
        updated_at          = NOW()
      RETURNING *
    `;

    const result = await pool.query(query, [
      userId,
      year,
      annual_entitlement !== undefined ? annual_entitlement : 15,
      annual_taken !== undefined ? annual_taken : 0,
      annual_carried_over !== undefined ? annual_carried_over : 0,
      sick_entitlement !== undefined ? sick_entitlement : 0,
      sick_taken !== undefined ? sick_taken : 0,
    ]);

    return result.rows[0];
  } catch (error) {
    throw error;
  }
};

// ─── 18. getDepartments ──────────────────────────────────────────────────────

const getDepartments = async () => {
  try {
    const result = await pool.query(
      'SELECT id, code, name, description FROM hr_departments WHERE is_active = TRUE ORDER BY name'
    );
    return result.rows;
  } catch (error) {
    throw error;
  }
};

// ─── 19. getSopTrainingRecords ───────────────────────────────────────────────

const getSopTrainingRecords = async (userId) => {
  try {
    const result = await pool.query(
      'SELECT * FROM v_hr_sop_compliance WHERE user_id = $1 ORDER BY sop_reference',
      [userId]
    );
    return result.rows;
  } catch (error) {
    throw error;
  }
};

// ─── 20. upsertSopTraining ───────────────────────────────────────────────────

const upsertSopTraining = async (userId, sopData, createdByUserId) => {
  try {
    const {
      sop_reference,
      sop_title,
      sop_version,
      sop_category,
      trained_date,
      trainer_name,
      trainer_user_id,
      training_method,
      assessed,
      assessment_pass,
      assessment_date,
      employee_signed,
      signed_date,
      valid_until,
    } = sopData;

    // Soft-expire existing current records for this user + SOP
    await pool.query(
      `UPDATE hr_sop_training_records
       SET is_current = FALSE, updated_at = NOW()
       WHERE user_id = $1 AND sop_reference = $2 AND is_current = TRUE`,
      [userId, sop_reference]
    );

    const insertQuery = `
      INSERT INTO hr_sop_training_records (
        user_id, sop_reference, sop_title, sop_version, sop_category,
        trained_date, trainer_name, trainer_user_id, training_method,
        assessed, assessment_pass, assessment_date,
        employee_signed, signed_date, valid_until, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      RETURNING *
    `;

    const result = await pool.query(insertQuery, [
      userId,
      sop_reference,
      sop_title || null,
      sop_version || null,
      sop_category || null,
      trained_date || null,
      trainer_name || null,
      trainer_user_id || null,
      training_method || null,
      assessed !== undefined ? assessed : false,
      assessment_pass !== undefined ? assessment_pass : null,
      assessment_date || null,
      employee_signed !== undefined ? employee_signed : false,
      signed_date || null,
      valid_until || null,
      createdByUserId,
    ]);

    return result.rows[0];
  } catch (error) {
    throw error;
  }
};

// ─── 21. getPersonnelDocuments ───────────────────────────────────────────────

const getPersonnelDocuments = async (userId) => {
  try {
    const result = await pool.query(
      `SELECT id, document_type, document_title, document_date, version,
              storage_url, filename, file_size_bytes, content_type,
              is_filed, filed_date, notes, created_at
       FROM hr_personnel_documents
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [userId]
    );
    return result.rows;
  } catch (error) {
    throw error;
  }
};

// ─── 22. logPersonnelDocument ────────────────────────────────────────────────

const logPersonnelDocument = async (userId, docData, createdByUserId) => {
  try {
    const {
      document_type, document_title, document_date, version,
      storage_url, filename, file_size_bytes, content_type,
      is_filed, filed_date, notes,
    } = docData;

    const result = await pool.query(
      `INSERT INTO hr_personnel_documents (
        user_id, document_type, document_title, document_date, version,
        storage_url, filename, file_size_bytes, content_type,
        is_filed, filed_date, notes, created_by
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
      RETURNING *`,
      [
        userId,
        document_type || null,
        document_title || null,
        document_date || null,
        version || '1.0',
        storage_url || null,
        filename || null,
        file_size_bytes || null,
        content_type || null,
        is_filed !== undefined ? is_filed : false,
        filed_date || null,
        notes || null,
        createdByUserId,
      ]
    );
    return result.rows[0];
  } catch (error) {
    throw error;
  }
};

// ────────────────────────────────────────────────────────────────────────────

module.exports = {
  getDashboardStats,
  getAllEmployees,
  getEmployeeByUserId,
  getBaseUserById,
  getUsersMissingHrRecord,
  getActiveUsersForHrRecord,
  createHrRecord,
  updateHrRecord,
  getOnboardingProgress,
  upsertOnboardingModule,
  getReviews,
  createReview,
  updateReview,
  getPipRecords,
  createPip,
  getPerformanceRatings,
  upsertPerformanceRating,
  getComplianceSnapshot,
  getLeaveBalance,
  upsertLeaveBalance,
  getDepartments,
  getSopTrainingRecords,
  upsertSopTraining,
  getPersonnelDocuments,
  logPersonnelDocument,
};
