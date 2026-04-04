// ============================================================================
// EMAIL TRIGGER TEST
// backend/email_trigger_test.js
// ============================================================================
// Simulates the exact call chain that happens during a QA submission.
// Run from backend folder: node email_trigger_test.js
// ============================================================================

require('dotenv').config();
const notificationService = require('./src/services/notification-service');

async function runTriggerTest() {
  console.log('\n============================================================');
  console.log('  VILAGIO ERP — Email Trigger Chain Test');
  console.log('============================================================\n');

  // ── Test 1: notifyQAPendingReview (production flow) ──────────────────────
  console.log('TEST 1: notifyQAPendingReview (used by production-service.js)');
  console.log('------------------------------------------------------------');
  try {
    await notificationService.notifyQAPendingReview(
      'PROD-TEST-001',
      'FreshDrip 500ml Regular',
      'Test Operator'
    );
    console.log('✅ notifyQAPendingReview completed without throwing');
  } catch (err) {
    console.error('❌ notifyQAPendingReview THREW:', err.message);
    console.error('   Full error:', err);
  }

  await sleep(2000);

  // ── Test 2: notifyLabQAPendingReview (lab flow) ───────────────────────────
  console.log('\nTEST 2: notifyLabQAPendingReview (used by lab-service.js)');
  console.log('------------------------------------------------------------');
  try {
    await notificationService.notifyLabQAPendingReview(
      'LWT-2026-TEST',
      'morning',
      'Test Analyst',
      new Date().toISOString().split('T')[0]
    );
    console.log('✅ notifyLabQAPendingReview completed without throwing');
  } catch (err) {
    console.error('❌ notifyLabQAPendingReview THREW:', err.message);
    console.error('   Full error:', err);
  }

  await sleep(2000);

  // ── Test 3: notifyBatchRejected ───────────────────────────────────────────
  console.log('\nTEST 3: notifyBatchRejected');
  console.log('------------------------------------------------------------');
  try {
    await notificationService.notifyBatchRejected(
      'PROD-TEST-001',
      'FreshDrip 500ml Regular',
      'QA Tester',
      'Test rejection reason'
    );
    console.log('✅ notifyBatchRejected completed without throwing');
  } catch (err) {
    console.error('❌ notifyBatchRejected THREW:', err.message);
    console.error('   Full error:', err);
  }

  console.log('\n============================================================');
  console.log('  All 3 tests complete. Check your inbox.');
  console.log('  If tests show ✅ but no email arrives → spam folder or');
  console.log('  Resend dashboard shows delivery status.');
  console.log('============================================================\n');

  process.exit(0);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

runTriggerTest().catch(err => {
  console.error('Test script crashed:', err);
  process.exit(1);
});
