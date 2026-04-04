// ============================================================================
// LAB SERVICE — QC Water Testing Module
// backend/src/services/lab-service.js
// ============================================================================

const { query } = require('../utils/db');

// ── Helpers ──────────────────────────────────────────────────────────────────

async function generateLabTestNumber() {
  const year = new Date().getFullYear();
  const result = await query(`SELECT generate_lab_test_number() AS test_number`);
  return result.rows[0].test_number;
}

function buildOverallStatus(params) {
  const anyFail = params.some(p => p.status === 'fail');
  const anyWarning = params.some(p => p.status === 'warning');
  if (anyFail) return 'fail';
  if (anyWarning) return 'conditional_pass';
  return 'pass';
}

function evaluateParameter(code, value, specs) {
  const spec = specs.find(s => s.parameter_code === code);
  if (!spec) return 'pending';

  if (spec.is_pass_fail) {
    // Microbial: 0 = pass, anything else = fail
    return parseFloat(value) === 0 ? 'pass' : 'fail';
  }

  const num = parseFloat(value);
  if (isNaN(num)) return 'pending';

  const belowMin = spec.spec_min !== null && num < parseFloat(spec.spec_min);
  const aboveMax = spec.spec_max !== null && num > parseFloat(spec.spec_max);

  if (belowMin || aboveMax) return 'fail';
  
  // Warning band: within 10% of limit
  const nearMin = spec.spec_min !== null && num < parseFloat(spec.spec_min) * 1.1;
  const nearMax = spec.spec_max !== null && num > parseFloat(spec.spec_max) * 0.9;
  if (nearMin || nearMax) return 'warning';

  return 'pass';
}

// ── Spec Ranges ──────────────────────────────────────────────────────────────

async function getParameterSpecs() {
  const result = await query(`
    SELECT
      parameter_code, parameter_name, unit,
      spec_min, spec_max, is_pass_fail, display_order, notes
    FROM lab_parameter_specs
    ORDER BY display_order
  `);
  return result.rows;
}

async function updateParameterSpec(parameterCode, updates, updatedBy) {
  const { spec_min, spec_max, notes } = updates;
  await query(`
    UPDATE lab_parameter_specs
    SET spec_min = $1, spec_max = $2, notes = $3,
        updated_at = NOW(), updated_by = $4
    WHERE parameter_code = $5
  `, [spec_min, spec_max, notes, updatedBy, parameterCode]);
  return getParameterSpecs();
}

// ── Test CRUD ─────────────────────────────────────────────────────────────────

async function createLabTest(data, analystId) {
  const { shift, batch_id, ro_system_reference, equipment_calibration_ref, notes, parameters } = data;

  const testNumber = await generateLabTestNumber();
  const specs = await getParameterSpecs();

  // Evaluate each parameter
  const evaluatedParams = parameters.map(p => ({
    ...p,
    status: evaluateParameter(p.parameter_code, p.reading_value ?? p.reading_text, specs),
    spec_min: specs.find(s => s.parameter_code === p.parameter_code)?.spec_min,
    spec_max: specs.find(s => s.parameter_code === p.parameter_code)?.spec_max,
    unit: specs.find(s => s.parameter_code === p.parameter_code)?.unit,
    parameter_name: specs.find(s => s.parameter_code === p.parameter_code)?.parameter_name,
  }));

  const overallStatus = buildOverallStatus(evaluatedParams);

  const testResult = await query(`
    INSERT INTO lab_water_tests (
      test_number, test_date, shift, analyst_id,
      batch_id, ro_system_reference, equipment_calibration_ref,
      overall_status, notes
    ) VALUES ($1, CURRENT_DATE, $2, $3, $4, $5, $6, $7, $8)
    RETURNING *
  `, [
    testNumber, shift, analystId,
    batch_id || null, ro_system_reference || null,
    equipment_calibration_ref || null,
    overallStatus, notes || null
  ]);

  const test = testResult.rows[0];

  // Insert parameter readings
  for (const p of evaluatedParams) {
    await query(`
      INSERT INTO lab_test_parameters (
        test_id, parameter_code, parameter_name,
        reading_value, reading_text, unit,
        spec_min, spec_max, status, notes
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
    `, [
      test.test_id,
      p.parameter_code,
      p.parameter_name,
      p.reading_value ?? null,
      p.reading_text ?? null,
      p.unit,
      p.spec_min ?? null,
      p.spec_max ?? null,
      p.status,
      p.notes ?? null
    ]);
  }

  return getLabTestById(test.test_id);
}

async function getLabTestById(testId) {
  const testResult = await query(`
    SELECT
      lwt.*,
      analyst.full_name     AS analyst_name,
      analyst.employee_id   AS analyst_employee_id,
      supervisor.full_name  AS supervisor_name,
      manager.full_name     AS manager_name,
      pb.batch_number
    FROM lab_water_tests lwt
    JOIN  users analyst        ON lwt.analyst_id       = analyst.user_id
    LEFT JOIN users supervisor ON lwt.qa_supervisor_id = supervisor.user_id
    LEFT JOIN users manager    ON lwt.qa_manager_id    = manager.user_id
    LEFT JOIN production_batches pb ON lwt.batch_id   = pb.batch_id
    WHERE lwt.test_id = $1
  `, [testId]);

  if (testResult.rows.length === 0) return null;

  const paramsResult = await query(`
    SELECT * FROM lab_test_parameters
    WHERE test_id = $1
    ORDER BY (
      SELECT display_order FROM lab_parameter_specs
      WHERE parameter_code = lab_test_parameters.parameter_code
    )
  `, [testId]);

  const approvalsResult = await query(`
    SELECT
      lqa.*,
      u.full_name AS actioned_by_name,
      u.employee_id AS actioned_by_employee_id
    FROM lab_qa_approvals lqa
    JOIN users u ON lqa.actioned_by = u.user_id
    WHERE lqa.test_id = $1
    ORDER BY lqa.stage
  `, [testId]);

  return {
    ...testResult.rows[0],
    parameters: paramsResult.rows,
    approvals: approvalsResult.rows
  };
}

async function listLabTests(filters = {}) {
  const { status, date_from, date_to, analyst_id, limit = 50, offset = 0 } = filters;

  const conditions = [];
  const values = [];
  let idx = 1;

  if (status) { conditions.push(`lwt.overall_status = $${idx++}`); values.push(status); }
  if (date_from) { conditions.push(`lwt.test_date >= $${idx++}`); values.push(date_from); }
  if (date_to) { conditions.push(`lwt.test_date <= $${idx++}`); values.push(date_to); }
  if (analyst_id) { conditions.push(`lwt.analyst_id = $${idx++}`); values.push(analyst_id); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  values.push(limit, offset);

  const result = await query(`
    SELECT
      lwt.test_id, lwt.test_number, lwt.test_date, lwt.shift,
      lwt.overall_status, lwt.certificate_number, lwt.pdf_url,
      lwt.created_at, lwt.submitted_at, lwt.approved_at,
      analyst.full_name    AS analyst_name,
      analyst.employee_id  AS analyst_employee_id,
      supervisor.full_name AS supervisor_name,
      manager.full_name    AS manager_name,
      pb.batch_number,
      COUNT(ltp.param_id)                                 AS total_params,
      COUNT(CASE WHEN ltp.status='pass'    THEN 1 END)    AS params_passed,
      COUNT(CASE WHEN ltp.status='fail'    THEN 1 END)    AS params_failed,
      COUNT(CASE WHEN ltp.status='warning' THEN 1 END)    AS params_warning
    FROM lab_water_tests lwt
    JOIN  users analyst        ON lwt.analyst_id       = analyst.user_id
    LEFT JOIN users supervisor ON lwt.qa_supervisor_id = supervisor.user_id
    LEFT JOIN users manager    ON lwt.qa_manager_id    = manager.user_id
    LEFT JOIN production_batches pb ON lwt.batch_id    = pb.batch_id
    LEFT JOIN lab_test_parameters ltp ON lwt.test_id   = ltp.test_id
    ${where}
    GROUP BY
      lwt.test_id, lwt.test_number, lwt.test_date, lwt.shift,
      lwt.overall_status, lwt.certificate_number, lwt.pdf_url,
      lwt.created_at, lwt.submitted_at, lwt.approved_at,
      analyst.full_name, analyst.employee_id,
      supervisor.full_name, manager.full_name, pb.batch_number
    ORDER BY lwt.test_date DESC, lwt.created_at DESC
    LIMIT $${idx++} OFFSET $${idx++}
  `, values);

  return result.rows;
}

// Today's valid certificates — used by Gate 1 integration
async function getTodaysValidCertificates() {
  const result = await query(`
    SELECT
      lwt.test_id, lwt.test_number, lwt.test_date,
      lwt.shift, lwt.overall_status, lwt.certificate_number,
      analyst.full_name AS analyst_name
    FROM lab_water_tests lwt
    JOIN users analyst ON lwt.analyst_id = analyst.user_id
    WHERE lwt.test_date = CURRENT_DATE
      AND lwt.overall_status IN ('pass', 'conditional_pass')
    ORDER BY lwt.approved_at DESC
  `);
  return result.rows;
}

// ── Stage 1: Analyst Submit ────────────────────────────────────────────────

async function submitLabTest(testId, analystId, signatureVerified) {
  const test = await getLabTestById(testId);
  if (!test) throw new Error('Lab test not found');
  if (test.analyst_id !== analystId) throw new Error('Only the recording analyst can submit this test');
  if (!['draft'].includes(test.overall_status)) throw new Error('Test has already been submitted');

  await query(`
    UPDATE lab_water_tests
    SET overall_status = 'submitted', submitted_at = NOW()
    WHERE test_id = $1
  `, [testId]);

  await query(`
    INSERT INTO lab_qa_approvals (test_id, stage, action, actioned_by, signature_verified, comments)
    VALUES ($1, 1, 'submit', $2, $3, 'Test submitted for QA Supervisor review')
    ON CONFLICT (test_id, stage) DO UPDATE
      SET action = 'submit', actioned_by = $2, signature_verified = $3, actioned_at = NOW()
  `, [testId, analystId, signatureVerified]);

  return getLabTestById(testId);
}

// ── Stage 2: Supervisor Review ─────────────────────────────────────────────

async function supervisorReview(testId, supervisorId, action, comments, deviationNote, signatureVerified) {
  const test = await getLabTestById(testId);
  if (!test) throw new Error('Lab test not found');
  if (!['submitted'].includes(test.overall_status)) throw new Error('Test is not pending supervisor review');

  const validActions = ['approve', 'reject', 'conditional'];
  if (!validActions.includes(action)) throw new Error('Invalid action');

  if (action === 'conditional' && !deviationNote?.trim()) {
    throw new Error('A deviation note is mandatory for a conditional approval');
  }

  let newStatus;
  if (action === 'approve') newStatus = 'manager_review';
  else if (action === 'conditional') newStatus = 'manager_review';
  else newStatus = 'rejected';

  await query(`
    UPDATE lab_water_tests
    SET overall_status = $1, qa_supervisor_id = $2
    WHERE test_id = $3
  `, [newStatus, supervisorId, testId]);

  await query(`
    INSERT INTO lab_qa_approvals (test_id, stage, action, actioned_by, signature_verified, comments, deviation_note)
    VALUES ($1, 2, $2, $3, $4, $5, $6)
    ON CONFLICT (test_id, stage) DO UPDATE
      SET action=$2, actioned_by=$3, signature_verified=$4, comments=$5, deviation_note=$6, actioned_at=NOW()
  `, [testId, action, supervisorId, signatureVerified, comments || null, deviationNote || null]);

  return getLabTestById(testId);
}

// ── Stage 3: Manager Sign-off ─────────────────────────────────────────────

async function managerSignoff(testId, managerId, action, comments, deviationNote, signatureVerified) {
  const test = await getLabTestById(testId);
  if (!test) throw new Error('Lab test not found');
  if (!['manager_review'].includes(test.overall_status)) throw new Error('Test is not pending manager sign-off');

  const validActions = ['approve', 'reject', 'conditional'];
  if (!validActions.includes(action)) throw new Error('Invalid action');

  let newStatus;
  if (action === 'approve') newStatus = 'pass';
  else if (action === 'conditional') newStatus = 'conditional_pass';
  else newStatus = 'fail';

  // Generate certificate number on pass
  let certNumber = null;
  if (newStatus === 'pass' || newStatus === 'conditional_pass') {
    const year = new Date().getFullYear();
    const countResult = await query(`
      SELECT COUNT(*) AS cnt FROM lab_water_tests
      WHERE certificate_number IS NOT NULL
        AND EXTRACT(YEAR FROM approved_at) = $1
    `, [year]);
    const seq = parseInt(countResult.rows[0].cnt) + 1;
    certNumber = `VTL-WQC-${year}-${String(seq).padStart(4, '0')}`;
  }

  await query(`
    UPDATE lab_water_tests
    SET overall_status = $1, qa_manager_id = $2,
        certificate_number = $3, approved_at = NOW()
    WHERE test_id = $4
  `, [newStatus, managerId, certNumber, testId]);

  await query(`
    INSERT INTO lab_qa_approvals (test_id, stage, action, actioned_by, signature_verified, comments, deviation_note)
    VALUES ($1, 3, $2, $3, $4, $5, $6)
    ON CONFLICT (test_id, stage) DO UPDATE
      SET action=$2, actioned_by=$3, signature_verified=$4, comments=$5, deviation_note=$6, actioned_at=NOW()
  `, [testId, action, managerId, signatureVerified, comments || null, deviationNote || null]);

  // If fail — raise NCR in batch_deviations (if linked to a batch)
  if (newStatus === 'fail' && test.batch_id) {
    await query(`
      INSERT INTO batch_deviations (
        batch_id, deviation_type, description, severity, reported_by, status
      ) VALUES ($1, 'WATER_QUALITY_FAILURE', $2, 'critical', $3, 'open')
    `, [
      test.batch_id,
      `Water quality test ${test.test_number} failed on ${test.test_date}. Certificate not issued. Production gate blocked.`,
      managerId
    ]);
  }

  return getLabTestById(testId);
}

// ── Dashboard Stats ──────────────────────────────────────────────────────────

async function getLabDashboardStats() {
  const result = await query(`
    SELECT
      COUNT(*) FILTER (WHERE test_date = CURRENT_DATE)                          AS tests_today,
      COUNT(*) FILTER (WHERE overall_status = 'submitted')                      AS pending_supervisor,
      COUNT(*) FILTER (WHERE overall_status = 'manager_review')                 AS pending_manager,
      COUNT(*) FILTER (WHERE overall_status IN ('pass','conditional_pass')
                        AND test_date = CURRENT_DATE)                           AS valid_certs_today,
      COUNT(*) FILTER (WHERE overall_status = 'fail'
                        AND test_date >= CURRENT_DATE - INTERVAL '7 days')      AS failures_this_week,
      COUNT(*) FILTER (WHERE overall_status = 'rejected'
                        AND test_date >= CURRENT_DATE - INTERVAL '7 days')      AS rejected_this_week
    FROM lab_water_tests
  `);
  return result.rows[0];
}

module.exports = {
  getParameterSpecs,
  updateParameterSpec,
  createLabTest,
  getLabTestById,
  listLabTests,
  getTodaysValidCertificates,
  submitLabTest,
  supervisorReview,
  managerSignoff,
  getLabDashboardStats,
};
