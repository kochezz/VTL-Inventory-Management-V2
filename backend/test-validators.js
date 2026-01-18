// test-validators.js
// Test input validation logic

const validators = require('./src/utils/validators');

console.log('🧪 Testing Input Validation\n');

// Test 1: Valid receipt transaction
console.log('Test 1: Valid Receipt Transaction');
try {
  const validData = validators.validateReceiptTransaction({
    product_sku: 'PREFORM-500ML-18G',
    location_code: 'WH-MAIN',
    quantity: 50000,
    uom: 'piece',
    transaction_date: '2026-01-18',
    performed_by: 'wphiri@vilagio.io',
    unit_cost: 0.05,
  });
  console.log('✅ Valid receipt transaction passed');
  console.log('   Validated quantity:', validData.quantity);
  console.log('   Validated SKU:', validData.product_sku);
} catch (error) {
  console.log('❌ Validation failed:', error.message);
}

// Test 2: Invalid - missing required fields
console.log('\nTest 2: Missing Required Fields');
try {
  validators.validateReceiptTransaction({
    product_sku: 'PREFORM-500ML-18G',
    quantity: 50000,
    // Missing: location_code, uom, transaction_date, performed_by
  });
  console.log('❌ Should have thrown error for missing fields');
} catch (error) {
  console.log('✅ Correctly rejected missing fields');
  console.log('   Error code:', error.errorCode);
  console.log('   Missing fields:', error.details?.missing_fields);
}

// Test 3: Invalid - negative quantity
console.log('\nTest 3: Negative Quantity');
try {
  validators.validateReceiptTransaction({
    product_sku: 'PREFORM-500ML-18G',
    location_code: 'WH-MAIN',
    quantity: -100,
    uom: 'piece',
    transaction_date: '2026-01-18',
    performed_by: 'wphiri@vilagio.io',
  });
  console.log('❌ Should have thrown error for negative quantity');
} catch (error) {
  console.log('✅ Correctly rejected negative quantity');
  console.log('   Error code:', error.errorCode);
  console.log('   Error message:', error.message);
}

// Test 4: Invalid - invalid date
console.log('\nTest 4: Invalid Date');
try {
  validators.validateReceiptTransaction({
    product_sku: 'PREFORM-500ML-18G',
    location_code: 'WH-MAIN',
    quantity: 50000,
    uom: 'piece',
    transaction_date: 'not-a-date',
    performed_by: 'wphiri@vilagio.io',
  });
  console.log('❌ Should have thrown error for invalid date');
} catch (error) {
  console.log('✅ Correctly rejected invalid date');
  console.log('   Error code:', error.errorCode);
}

// Test 5: Transfer transaction - same location
console.log('\nTest 5: Transfer - Same Locations');
try {
  validators.validateTransferTransaction({
    product_sku: 'PREFORM-500ML-18G',
    from_location_code: 'WH-MAIN',
    to_location_code: 'WH-MAIN', // Same as from
    quantity: 1000,
    uom: 'piece',
    transaction_date: '2026-01-18',
    performed_by: 'wphiri@vilagio.io',
  });
  console.log('❌ Should have thrown error for same locations');
} catch (error) {
  console.log('✅ Correctly rejected same from/to locations');
  console.log('   Error message:', error.message);
}

// Test 6: Batch creation with invalid expiry
console.log('\nTest 6: Batch - Expiry Before Manufacture');
try {
  validators.validateBatchCreation({
    product_sku: 'PREFORM-500ML-18G',
    location_code: 'WH-MAIN',
    batch_number: 'TEST-BATCH-001',
    received_date: '2026-01-18',
    manufacture_date: '2026-01-15',
    expiry_date: '2026-01-10', // Before manufacture
    initial_quantity: 50000,
    uom: 'piece',
  });
  console.log('❌ Should have thrown error for expiry before manufacture');
} catch (error) {
  console.log('✅ Correctly rejected expiry before manufacture date');
  console.log('   Error message:', error.message);
}

console.log('\n✅ All validation tests completed!');