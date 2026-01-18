// test-error-handler.js
// Test error handling classes

const {
  ValidationError,
  DatabaseError,
  NotFoundError,
  ConflictError,
  InsufficientStockError,
  BatchNotAvailableError,
  handleError,
} = require('./src/utils/error-handler');

console.log('🧪 Testing Error Handling\n');

// Test 1: ValidationError
console.log('Test 1: ValidationError');
const validationError = new ValidationError(
  'Required field is missing',
  { field: 'product_sku' }
);
console.log('✅ ValidationError created');
console.log('   Message:', validationError.message);
console.log('   Status Code:', validationError.statusCode);
console.log('   Error Code:', validationError.errorCode);
console.log('   Details:', validationError.details);

// Test 2: NotFoundError
console.log('\nTest 2: NotFoundError');
const notFoundError = new NotFoundError('Product', 'INVALID-SKU');
console.log('✅ NotFoundError created');
console.log('   Message:', notFoundError.message);
console.log('   Status Code:', notFoundError.statusCode);

// Test 3: ConflictError
console.log('\nTest 3: ConflictError');
const conflictError = new ConflictError(
  'Batch number already exists',
  { batch_number: 'BATCH-001' }
);
console.log('✅ ConflictError created');
console.log('   Message:', conflictError.message);
console.log('   Status Code:', conflictError.statusCode);

// Test 4: InsufficientStockError
console.log('\nTest 4: InsufficientStockError');
const stockError = new InsufficientStockError('PREFORM-500ML-18G', 50000, 10000);
console.log('✅ InsufficientStockError created');
console.log('   Message:', stockError.message);
console.log('   Status Code:', stockError.statusCode);
console.log('   Details:', stockError.details);

// Test 5: BatchNotAvailableError
console.log('\nTest 5: BatchNotAvailableError');
const batchError = new BatchNotAvailableError('BATCH-001', 'QC status is rejected');
console.log('✅ BatchNotAvailableError created');
console.log('   Message:', batchError.message);
console.log('   Details:', batchError.details);

// Test 6: DatabaseError
console.log('\nTest 6: DatabaseError');
const dbError = new DatabaseError(
  'Connection failed',
  { code: '08006', detail: 'timeout' }
);
console.log('✅ DatabaseError created');
console.log('   Message:', dbError.message);
console.log('   Status Code:', dbError.statusCode);

// Test 7: Error Handler
console.log('\nTest 7: Error Handler Function');
const handledError = handleError(validationError);
console.log('✅ Error handled successfully');
console.log('   Success:', handledError.success);
console.log('   Error Type:', handledError.error);
console.log('   Has Timestamp:', !!handledError.timestamp);

// Test 8: Error JSON Serialization
console.log('\nTest 8: Error JSON Serialization');
const errorJson = validationError.toJSON();
console.log('✅ Error serialized to JSON');
console.log('   Keys:', Object.keys(errorJson).join(', '));

console.log('\n✅ All error handling tests completed!');