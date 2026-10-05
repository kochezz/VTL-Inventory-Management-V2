'use strict';

// Session E hotfix: v_hr_employee_profile (SELECT *) was exposing NRC, date
// of birth, home address, personal email, emergency contacts, and (on the
// detail view only) napsa_member_number to every HR_ACCESS_ROLES member --
// not just HR. manager/production_manager/warehouse_manager/ceo/cfo could
// all pull this for every employee via GET /hr/employees(/:userId); only
// basic_salary_zmw had any redaction at all.
//
// Two tiers of coverage:
//  1. Pure unit tests against canSeeSensitivePii/redactSensitivePii
//     directly (no DB, no server) -- these run in any environment and
//     were actually executed this session.
//  2. HTTP integration tests matching this suite's usual convention
//     (real server, real DB, role-signed tokens) -- NOT run this session,
//     same reason as every other test added recently: the Neon test
//     branch's credentials are still failing with a real auth error, not
//     a cold-start timeout. Written correctly and left here for when that's
//     fixed.
//
// No real hr_admin/hr_manager account exists in this database today (the
// live roster is admin/engineering/manager/cfo/junior_accountant/qa/
// operator/viewer/warehouse_manager -- confirmed via Session D's roster
// query) -- unlike every other role used elsewhere in this suite,
// signTokenForRole('hr_admin') has nothing real to find. Those two cases
// mint a token with the role set directly instead, which is legitimate
// here specifically because the routes under test never re-check role
// against the DB (confirmed Session D, Step 2b: auth-middleware.js trusts
// the JWT payload for every request except login/refresh) -- manager and
// admin still go through signTokenForRole against real accounts.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');

const { canSeeSensitivePii, redactSensitivePii } = require('../src/services/hr-service');

const SENSITIVE_FIELDS = [
  'national_id', 'date_of_birth', 'home_address', 'personal_email',
  'emergency_contacts', 'napsa_member_number',
];

// ─── Tier 1: pure unit tests (run anywhere, run this session) ──────────────

test('canSeeSensitivePii: admin, hr_admin, hr_manager see other employees\' PII', () => {
  for (const role of ['admin', 'hr_admin', 'hr_manager']) {
    assert.equal(canSeeSensitivePii(role, 'other-user-id', 'requesting-user-id'), true, `expected ${role} to see another employee's PII`);
  }
});

test('canSeeSensitivePii: manager, production_manager, warehouse_manager, ceo, cfo do NOT see other employees\' PII', () => {
  for (const role of ['manager', 'production_manager', 'warehouse_manager', 'ceo', 'cfo']) {
    assert.equal(canSeeSensitivePii(role, 'other-user-id', 'requesting-user-id'), false, `expected ${role} to be denied another employee's PII`);
  }
});

test('canSeeSensitivePii: self-view always sees own PII regardless of role', () => {
  for (const role of ['manager', 'production_manager', 'warehouse_manager', 'ceo', 'cfo', 'viewer', 'operator']) {
    assert.equal(canSeeSensitivePii(role, 'same-id', 'same-id'), true, `expected ${role} to see their own PII via self-view`);
  }
});

test('redactSensitivePii strips exactly the 6 named fields and nothing else', () => {
  const row = {
    user_id: 'u1', full_name: 'Test Person', job_title: 'Engineer', department: 'Engineering',
    reports_to_name: 'Someone', email: 'test@vilag.io', phone_number: '0000000000', hr_status: 'confirmed',
    national_id: '123456/78/9', date_of_birth: '1990-01-01', home_address: '1 Test St',
    personal_email: 'personal@example.com', emergency_contacts: [{ name: 'X', phone: '111' }],
    napsa_member_number: 'NAPSA-1', basic_salary_zmw: '5000.00',
  };
  const redacted = redactSensitivePii(row);

  for (const field of SENSITIVE_FIELDS) {
    assert.equal(field in redacted, false, `expected ${field} to be stripped`);
  }
  // Directory fields and salary (handled by the separate, unchanged
  // redactSalary) must survive this specific redaction untouched.
  assert.equal(redacted.full_name, 'Test Person');
  assert.equal(redacted.job_title, 'Engineer');
  assert.equal(redacted.department, 'Engineering');
  assert.equal(redacted.reports_to_name, 'Someone');
  assert.equal(redacted.email, 'test@vilag.io');
  assert.equal(redacted.phone_number, '0000000000');
  assert.equal(redacted.hr_status, 'confirmed');
  assert.equal(redacted.basic_salary_zmw, '5000.00');
});

test('redactSensitivePii on null/non-object input is a no-op passthrough (matches redactSalary\'s own guard)', () => {
  assert.equal(redactSensitivePii(null), null);
  assert.equal(redactSensitivePii(undefined), undefined);
});

// ─── Tier 2: HTTP integration tests (NOT run this session -- see header) ───

const {
  BASE_URL,
  assertServerReachable,
  login,
  authHeaders,
  signTokenForRole,
} = require('./helpers/test-helper');
const axios = require('axios');

let adminHeaders, managerHeaders, hrAdminHeaders, hrManagerHeaders;
let managerToken, managerUser;
let integrationSkipReason = null;

const integrationTest = (name, fn) => test(name, async (t) => {
  if (integrationSkipReason) return t.skip(integrationSkipReason);
  return fn(t);
});

test('(setup) integration tier', async (t) => {
  try {
    await assertServerReachable();
    const adminToken = await login(process.env.TEST_ADMIN_EMAIL, process.env.TEST_ADMIN_PASSWORD);
    adminHeaders = authHeaders(adminToken);

    ({ token: managerToken, user: managerUser } = await signTokenForRole('manager'));
    managerHeaders = authHeaders(managerToken);

    // No real hr_admin/hr_manager account exists in this DB (see header) --
    // mint directly, valid because these routes never re-check role
    // against the DB for anything except login/refresh.
    const mint = (role) => jwt.sign(
      { user_id: '00000000-0000-0000-0000-000000000001', email: `test-${role}@vilag.io`, role, full_name: `Test ${role}` },
      process.env.JWT_SECRET,
      { expiresIn: '15m' }
    );
    hrAdminHeaders = authHeaders(mint('hr_admin'));
    hrManagerHeaders = authHeaders(mint('hr_manager'));
  } catch (e) {
    integrationSkipReason = `Integration tier unavailable: ${e.message}`;
    t.skip(integrationSkipReason);
  }
});

integrationTest('manager-role token: GET /hr/employees has no sensitive fields on any OTHER row', async () => {
  const res = await axios.get(`${BASE_URL}/api/hr/employees`, managerHeaders);
  assert.equal(res.status, 200);
  const otherRows = res.data.filter((r) => r.user_id !== managerUser.user_id);
  assert.ok(otherRows.length > 0, 'expected at least one other employee row to check');
  for (const row of otherRows) {
    for (const field of SENSITIVE_FIELDS) {
      assert.equal(field in row, false, `expected ${field} absent for manager viewing another employee's list row`);
    }
  }
});

integrationTest('manager-role token: GET /hr/employees/:otherUserId has no sensitive fields', async () => {
  const res = await axios.get(`${BASE_URL}/api/hr/employees`, managerHeaders);
  const other = res.data.find((r) => r.user_id !== managerUser.user_id);
  assert.ok(other, 'expected at least one other employee to check');
  const detailRes = await axios.get(`${BASE_URL}/api/hr/employees/${other.user_id}`, managerHeaders);
  assert.equal(detailRes.status, 200);
  for (const field of SENSITIVE_FIELDS) {
    assert.equal(field in detailRes.data.profile, false, `expected ${field} absent on detail view for manager`);
  }
});

integrationTest('manager-role token: self-view (own user_id) still sees own sensitive fields', async () => {
  const res = await axios.get(`${BASE_URL}/api/hr/employees/${managerUser.user_id}`, managerHeaders);
  assert.equal(res.status, 200);
  // Only asserting presence of the key, not a specific value -- a manager
  // account may legitimately have no hr_employees row / null PII yet.
  assert.ok('national_id' in res.data.profile, 'expected self-view to include national_id key');
});

integrationTest('admin token: GET /hr/employees/:otherUserId still has sensitive fields', async () => {
  const res = await axios.get(`${BASE_URL}/api/hr/employees`, adminHeaders);
  const other = res.data[0];
  const detailRes = await axios.get(`${BASE_URL}/api/hr/employees/${other.user_id}`, adminHeaders);
  assert.ok('national_id' in detailRes.data.profile, 'expected admin to still see national_id');
});

integrationTest('hr_admin token: GET /hr/employees still has sensitive fields on list', async () => {
  const res = await axios.get(`${BASE_URL}/api/hr/employees`, hrAdminHeaders);
  assert.equal(res.status, 200);
  assert.ok(res.data.length > 0 && 'national_id' in res.data[0], 'expected hr_admin to still see national_id on list');
});

integrationTest('hr_manager token: GET /hr/employees still has sensitive fields on list', async () => {
  const res = await axios.get(`${BASE_URL}/api/hr/employees`, hrManagerHeaders);
  assert.equal(res.status, 200);
  assert.ok(res.data.length > 0 && 'national_id' in res.data[0], 'expected hr_manager to still see national_id on list');
});

integrationTest('napsa_member_number is present (or explicitly null) on BOTH list and detail for an hr_admin viewer -- consistency fix', async () => {
  const listRes = await axios.get(`${BASE_URL}/api/hr/employees`, hrAdminHeaders);
  const row = listRes.data.find((r) => r.hr_record_exists);
  assert.ok(row, 'expected at least one employee with an hr_employees record');
  assert.ok('napsa_member_number' in row, 'expected napsa_member_number key present on list view now');
  const detailRes = await axios.get(`${BASE_URL}/api/hr/employees/${row.user_id}`, hrAdminHeaders);
  assert.ok('napsa_member_number' in detailRes.data.profile, 'expected napsa_member_number key present on detail view');
});
