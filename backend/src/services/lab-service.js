// ============================================================================
// LAB SERVICE — QC Water Testing Module
// backend/src/services/lab-service.js
// ============================================================================
// WORKFLOW FIX: 2-stage review (not 3)
//   Stage 1: Lab Analyst records results + digital signature → status: 'submitted'
//   Stage 2: QA signs off → status: 'pass' | 'conditional_pass' | 'fail'
//            QA is the SOLE authority to release results and issue the CoA
// ============================================================================

const { query } = require('../utils/db');
const notificationService = require('./notification-service'); // Email notifications — matches production-service.js pattern

// ── Helpers ──────────────────────────────────────────────────────────────────

async function generateLabTestNumber() {
  const result = await query(`SELECT generate_lab_test_number() AS test_number`);
  return result.rows[0].test_number;
}

function buildOverallStatus(params) {
  const anyFail = params.some(p => p.status === 'fail');
  const anyWarning = params.some(p => p.status === 'warning');
  if (anyFail) return 'fail';
  if (anyWarning) return 'warning';
  return 'pass';
}

function evaluateParameter(code, value, specs) {
  const spec = specs.find(s => s.parameter_code === code);
  if (!spec) return 'pending';

  if (spec.is_pass_fail) {
    return parseFloat(value) === 0 ? 'pass' : 'fail';
  }

  const num = parseFloat(value);
  if (isNaN(num)) return 'pending';

  const belowMin = spec.spec_min !== null && num < parseFloat(spec.spec_min);
  const aboveMax = spec.spec_max !== null && num > parseFloat(spec.spec_max);
  if (belowMin || aboveMax) return 'fail';

  // Warning band: within 10% of a limit
  const nearMin = spec.spec_min !== null && num < parseFloat(spec.spec_min) * 1.1 && num >= parseFloat(spec.spec_min);
  const nearMax = spec.spec_max !== null && num > parseFloat(spec.spec_max) * 0.9 && num <= parseFloat(spec.spec_max);
  if (nearMin || nearMax) return 'warning';

  return 'pass';
}

// ── Parameter Specs ───────────────────────────────────────────────────────────

async function getParameterSpecs() {
  const result = await query(`
    SELECT parameter_code, parameter_name, unit,
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
  const {
    shift, batch_id, ro_system_reference,
    equipment_calibration_ref, notes, parameters
  } = data;

  const testNumber = await generateLabTestNumber();
  const specs = await getParameterSpecs();

  const evaluatedParams = parameters.map(p => ({
    ...p,
    status: evaluateParameter(
      p.parameter_code,
      p.reading_value ?? p.reading_text,
      specs
    ),
    spec_min:       specs.find(s => s.parameter_code === p.parameter_code)?.spec_min,
    spec_max:       specs.find(s => s.parameter_code === p.parameter_code)?.spec_max,
    unit:           specs.find(s => s.parameter_code === p.parameter_code)?.unit,
    parameter_name: specs.find(s => s.parameter_code === p.parameter_code)?.parameter_name,
  }));

  // Overall status at creation time is always 'draft' —
  // the raw result (pass/fail/warning) is stored per parameter.
  // The test-level status only changes when QA signs off.
  const testResult = await query(`
    INSERT INTO lab_water_tests (
      test_number, test_date, shift, analyst_id,
      batch_id, ro_system_reference, equipment_calibration_ref,
      overall_status, notes
    ) VALUES ($1, CURRENT_DATE, $2, $3, $4, $5, $6, 'draft', $7)
    RETURNING *
  `, [
    testNumber, shift, analystId,
    batch_id || null,
    ro_system_reference || null,
    equipment_calibration_ref || null,
    notes || null
  ]);

  const test = testResult.rows[0];

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
      p.reading_text  ?? null,
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
      pb.batch_number,
      -- qa_reviewer_id may not exist if db_workflow_fix.sql hasn't been run yet
      -- We resolve it separately to avoid crashing if the column is missing
      NULL::text            AS qa_reviewer_name,
      NULL::text            AS qa_reviewer_employee_id
    FROM lab_water_tests lwt
    JOIN  users analyst      ON lwt.analyst_id       = analyst.user_id
    LEFT JOIN production_batches pb ON lwt.batch_id  = pb.batch_id
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
      u.full_name      AS actioned_by_name,
      u.employee_id    AS actioned_by_employee_id
    FROM lab_qa_approvals lqa
    JOIN users u ON lqa.actioned_by = u.user_id
    WHERE lqa.test_id = $1
    ORDER BY lqa.stage, lqa.actioned_at
  `, [testId]);

  const testRow = testResult.rows[0];

  // Resolve qa_reviewer_name from qa_reviewer_id if the column exists
  // This avoids crashing if db_workflow_fix.sql hasn't been run on this environment
  if (testRow.qa_reviewer_id) {
    try {
      const qaUser = await query(
        'SELECT full_name, employee_id FROM users WHERE user_id = $1',
        [testRow.qa_reviewer_id]
      );
      if (qaUser.rows.length > 0) {
        testRow.qa_reviewer_name = qaUser.rows[0].full_name;
        testRow.qa_reviewer_employee_id = qaUser.rows[0].employee_id;
      }
    } catch (e) {
      // Column doesn't exist yet — graceful fallback
      testRow.qa_reviewer_name = null;
      testRow.qa_reviewer_employee_id = null;
    }
  }

  return {
    ...testRow,
    parameters: paramsResult.rows,
    approvals:  approvalsResult.rows
  };
}

async function listLabTests(filters = {}) {
  const {
    status, date_from, date_to,
    analyst_id, limit = 50, offset = 0
  } = filters;

  const conditions = [];
  const values    = [];
  let idx = 1;

  if (status)      { conditions.push(`lwt.overall_status = $${idx++}`); values.push(status); }
  if (date_from)   { conditions.push(`lwt.test_date >= $${idx++}`);     values.push(date_from); }
  if (date_to)     { conditions.push(`lwt.test_date <= $${idx++}`);     values.push(date_to); }
  if (analyst_id)  { conditions.push(`lwt.analyst_id = $${idx++}`);     values.push(analyst_id); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  values.push(limit, offset);

  const result = await query(`
    SELECT
      lwt.test_id, lwt.test_number, lwt.test_date, lwt.shift,
      lwt.overall_status, lwt.certificate_number, lwt.pdf_url,
      lwt.created_at, lwt.submitted_at, lwt.approved_at,
      analyst.full_name    AS analyst_name,
      analyst.employee_id  AS analyst_employee_id,
      pb.batch_number,
      COUNT(ltp.param_id)                                       AS total_params,
      COUNT(CASE WHEN ltp.status = 'pass'    THEN 1 END)        AS params_passed,
      COUNT(CASE WHEN ltp.status = 'fail'    THEN 1 END)        AS params_failed,
      COUNT(CASE WHEN ltp.status = 'warning' THEN 1 END)        AS params_warning
    FROM lab_water_tests lwt
    JOIN  users analyst     ON lwt.analyst_id      = analyst.user_id
    LEFT JOIN production_batches pb ON lwt.batch_id = pb.batch_id
    LEFT JOIN lab_test_parameters ltp ON lwt.test_id = ltp.test_id
    ${where}
    GROUP BY
      lwt.test_id, lwt.test_number, lwt.test_date, lwt.shift,
      lwt.overall_status, lwt.certificate_number, lwt.pdf_url,
      lwt.created_at, lwt.submitted_at, lwt.approved_at,
      analyst.full_name, analyst.employee_id,
      pb.batch_number
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

// ── Stage 1: Analyst submits results ─────────────────────────────────────────
// The analyst records all 7 parameters and signs with their password.
// Status moves: draft → submitted (awaiting QA review)

async function submitLabTest(testId, analystId, signatureVerified) {
  const test = await getLabTestById(testId);
  if (!test) throw new Error('Lab test not found');
  if (test.analyst_id !== analystId) {
    throw new Error('Only the recording analyst can submit this test');
  }
  if (test.overall_status !== 'draft') {
    throw new Error('Test has already been submitted');
  }

  await query(`
    UPDATE lab_water_tests
    SET overall_status = 'submitted', submitted_at = NOW()
    WHERE test_id = $1
  `, [testId]);

  await query(`
    INSERT INTO lab_qa_approvals
      (test_id, stage, action, actioned_by, signature_verified, comments)
    VALUES ($1, 1, 'submit', $2, $3, 'Results recorded and submitted for QA review')
    ON CONFLICT (test_id, stage) DO UPDATE
      SET action = 'submit', actioned_by = $2,
          signature_verified = $3, actioned_at = NOW()
  `, [testId, analystId, signatureVerified]);


  // ── Notify QA team: new test pending review ──────────────────────────────
  // Pattern mirrors production-service.js submitForQA() notification block.
  // Wrapped in try/catch + .catch() so email failure never crashes the workflow.
  try {
    console.log('📧 Triggering lab QA pending review notification for:', test.test_number);
    notificationService.notifyLabQAPendingReview(
      test.test_number,
      test.shift,
      test.analyst_name || 'Lab Analyst',
      test.test_date
    ).then(() => {
      console.log('📧 Lab QA pending review email sent successfully');
    }).catch(e => {
      console.error('📧 Lab QA pending review email FAILED:', e.message);
      console.error('📧 Full error:', e);
    });
  } catch (e) {
    console.error('📧 Failed to trigger lab QA pending review email:', e.message);
  }
  return getLabTestById(testId);
}

// ── Stage 2: QA Review & Sign-off ────────────────────────────────────────────
// QA is the SOLE authority to release results.
// On approve/conditional → certificate number generated, status = pass/conditional_pass
// On reject             → status = rejected, re-test required
//
// The qa_reviewer_id column must exist on lab_water_tests.
// If it doesn't exist yet run:
//   ALTER TABLE lab_water_tests ADD COLUMN IF NOT EXISTS qa_reviewer_id UUID REFERENCES users(user_id);

async function qaReview(testId, qaUserId, action, comments, deviationNote, signatureVerified) {
  const test = await getLabTestById(testId);
  if (!test) throw new Error('Lab test not found');
  if (test.overall_status !== 'submitted') {
    throw new Error('Test is not pending QA review. Current status: ' + test.overall_status);
  }

  const validActions = ['approve', 'reject', 'conditional'];
  if (!validActions.includes(action)) throw new Error('Invalid action');

  if (action === 'conditional' && !deviationNote?.trim()) {
    throw new Error('A deviation note is mandatory for a conditional approval');
  }
  if (action === 'reject' && !comments?.trim()) {
    throw new Error('A rejection reason is required');
  }

  // Determine final status from parameter results + QA decision
  const paramStatuses = test.parameters.map(p => p.status);
  const anyFail    = paramStatuses.some(s => s === 'fail');
  const anyWarning = paramStatuses.some(s => s === 'warning');

  let newStatus;
  if (action === 'reject') {
    newStatus = 'rejected';
  } else if (action === 'conditional') {
    newStatus = 'conditional_pass';
  } else {
    // approve
    if (anyFail)    newStatus = 'conditional_pass'; // QA approved despite failures — unusual but allowed with deviation note
    else if (anyWarning) newStatus = 'conditional_pass';
    else            newStatus = 'pass';
  }

  // Generate certificate number on any pass outcome
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
    SET overall_status    = $1,
        qa_reviewer_id    = $2,
        certificate_number = $3,
        approved_at       = NOW()
    WHERE test_id = $4
  `, [newStatus, qaUserId, certNumber, testId]);

  await query(`
    INSERT INTO lab_qa_approvals
      (test_id, stage, action, actioned_by, signature_verified, comments, deviation_note)
    VALUES ($1, 2, $2, $3, $4, $5, $6)
    ON CONFLICT (test_id, stage) DO UPDATE
      SET action = $2, actioned_by = $3, signature_verified = $4,
          comments = $5, deviation_note = $6, actioned_at = NOW()
  `, [testId, action, qaUserId, signatureVerified, comments || null, deviationNote || null]);

  // Auto-raise NCR if QA approves a test with failing parameters
  if (newStatus === 'conditional_pass' && test.batch_id) {
    const failedParams = test.parameters
      .filter(p => p.status === 'fail')
      .map(p => p.parameter_name)
      .join(', ');

    await query(`
      INSERT INTO batch_deviations (
        batch_id, deviation_type, description, severity, reported_by, status
      ) VALUES ($1, 'WATER_QUALITY_FAILURE', $2, 'major', $3, 'open')
    `, [
      test.batch_id,
      `Conditional water quality certificate issued for test ${test.test_number}. ` +
      `Failed parameters: ${failedParams || 'see deviation note'}. ` +
      `QA Deviation note: ${deviationNote || 'N/A'}`,
      qaUserId
    ]);
  }

  // ── Notify stakeholders of QA decision ──────────────────────────────────
  // Mirrors notifyBatchRejected() pattern in production-service.js
  try {
    const qaUserResult = await query(
      'SELECT full_name FROM users WHERE user_id = $1',
      [qaUserId]
    );
    const qaUserName = qaUserResult.rows?.[0]?.full_name || 'QA';

    if (newStatus === 'rejected') {
      // Notify the analyst their test was rejected and a re-test is needed
      notificationService.notifyLabTestRejected(
        test.test_number,
        test.analyst_name,
        qaUserName,
        comments
      ).catch(e => console.error('📧 Lab rejection email failed:', e));

    } else {
      // Notify that certificate has been issued (pass or conditional_pass)
      notificationService.notifyLabCertificateIssued(
        test.test_number,
        certNumber,
        newStatus,
        qaUserName,
        test.analyst_name,
        deviationNote || null
      ).catch(e => console.error('📧 Lab certificate email failed:', e));
    }
  } catch (e) {
    console.error('📧 Failed to trigger lab QA decision email:', e);
  }

  return getLabTestById(testId);
}

// ── Dashboard Stats ───────────────────────────────────────────────────────────

async function getLabDashboardStats() {
  const result = await query(`
    SELECT
      COUNT(*) FILTER (WHERE test_date = CURRENT_DATE)
                                                              AS tests_today,
      COUNT(*) FILTER (WHERE overall_status = 'submitted')   AS pending_qa_review,
      COUNT(*) FILTER (WHERE overall_status IN ('pass','conditional_pass')
                        AND test_date = CURRENT_DATE)         AS valid_certs_today,
      COUNT(*) FILTER (WHERE overall_status = 'fail'
                        AND test_date >= CURRENT_DATE - INTERVAL '7 days')
                                                              AS failures_this_week,
      COUNT(*) FILTER (WHERE overall_status = 'rejected'
                        AND test_date >= CURRENT_DATE - INTERVAL '7 days')
                                                              AS rejected_this_week,
      COUNT(*) FILTER (WHERE overall_status = 'draft')        AS drafts_in_progress
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
  qaReview,                   // replaces supervisorReview + managerSignoff
  getLabDashboardStats,
};
