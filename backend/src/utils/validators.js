// src/utils/validators.js
// Input Validation Schemas
// Validates input data for all inventory operations

const {
  ValidationError,
  validateRequired,
  validatePositiveNumber,
  validateDate,
  validateEnum,
  validateUUID,
} = require('./error-handler');

/**
 * Transaction Type Validator
 */
const TRANSACTION_TYPES = ['receipt', 'issue', 'transfer', 'adjustment'];
const QC_STATUSES = ['pending', 'in_progress', 'approved', 'rejected', 'on_hold'];
const BATCH_STATUSES = ['active', 'inactive', 'consolidated', 'split'];

/**
 * Validate Receipt Transaction Input
 */
function validateReceiptTransaction(data) {
  // Required fields
  validateRequired([
    'product_sku',
    'location_code',
    'quantity',
    'uom',
    'transaction_date',
    'performed_by',
  ], data);

  // Validate quantity
  const quantity = validatePositiveNumber(data.quantity, 'quantity');

  // Validate transaction date
  const transactionDate = validateDate(data.transaction_date, 'transaction_date');

  // Validate unit cost if provided
  let unitCost = null;
  if (data.unit_cost !== undefined && data.unit_cost !== null) {
    unitCost = validatePositiveNumber(data.unit_cost, 'unit_cost');
  }

  return {
    product_sku: data.product_sku.toString().trim(),
    location_code: data.location_code.toString().trim(),
    quantity: quantity,
    uom: data.uom.toString().trim(),
    transaction_date: transactionDate,
    performed_by: data.performed_by.toString().trim(),
    unit_cost: unitCost,
    reference_document_type: data.reference_document_type?.toString().trim() || null,
    reference_document_number: data.reference_document_number?.toString().trim() || null,
    supplier_name: data.supplier_name?.toString().trim() || null,
    batch_number: data.batch_number?.toString().trim() || null,
    notes: data.notes?.toString().trim() || null,
  };
}

/**
 * Validate Issue Transaction Input
 */
function validateIssueTransaction(data) {
  // Required fields
  validateRequired([
    'product_sku',
    'location_code',
    'quantity',
    'uom',
    'transaction_date',
    'performed_by',
  ], data);

  // Validate quantity
  const quantity = validatePositiveNumber(data.quantity, 'quantity');

  // Validate transaction date
  const transactionDate = validateDate(data.transaction_date, 'transaction_date');

  return {
    product_sku: data.product_sku.toString().trim(),
    location_code: data.location_code.toString().trim(),
    quantity: quantity,
    uom: data.uom.toString().trim(),
    transaction_date: transactionDate,
    performed_by: data.performed_by.toString().trim(),
    reference_document_type: data.reference_document_type?.toString().trim() || null,
    reference_document_number: data.reference_document_number?.toString().trim() || null,
    batch_number: data.batch_number?.toString().trim() || null,
    cost_center: data.cost_center?.toString().trim() || null,
    notes: data.notes?.toString().trim() || null,
  };
}

/**
 * Validate Transfer Transaction Input
 */
function validateTransferTransaction(data) {
  // Required fields
  validateRequired([
    'product_sku',
    'from_location_code',
    'to_location_code',
    'quantity',
    'uom',
    'transaction_date',
    'performed_by',
  ], data);

  // Validate from and to locations are different
  if (data.from_location_code === data.to_location_code) {
    throw new ValidationError(
      'Source and destination locations must be different',
      { from: data.from_location_code, to: data.to_location_code }
    );
  }

  // Validate quantity
  const quantity = validatePositiveNumber(data.quantity, 'quantity');

  // Validate transaction date
  const transactionDate = validateDate(data.transaction_date, 'transaction_date');

  return {
    product_sku: data.product_sku.toString().trim(),
    from_location_code: data.from_location_code.toString().trim(),
    to_location_code: data.to_location_code.toString().trim(),
    quantity: quantity,
    uom: data.uom.toString().trim(),
    transaction_date: transactionDate,
    performed_by: data.performed_by.toString().trim(),
    reference_document_number: data.reference_document_number?.toString().trim() || null,
    batch_number: data.batch_number?.toString().trim() || null,
    notes: data.notes?.toString().trim() || null,
  };
}

/**
 * Validate Adjustment Transaction Input
 */
function validateAdjustmentTransaction(data) {
  // Required fields
  validateRequired([
    'product_sku',
    'location_code',
    'quantity_change',
    'uom',
    'adjustment_type',
    'reason',
    'transaction_date',
    'performed_by',
  ], data);

  // Validate adjustment type
  const adjustmentType = validateEnum(
    data.adjustment_type,
    'adjustment_type',
    ['physical_count', 'damage', 'loss', 'found', 'correction', 'other']
  );

  // Validate quantity change (can be negative)
  const quantityChange = parseFloat(data.quantity_change);
  if (isNaN(quantityChange)) {
    throw new ValidationError(
      'quantity_change must be a valid number',
      { field: 'quantity_change', value: data.quantity_change }
    );
  }

  // Validate transaction date
  const transactionDate = validateDate(data.transaction_date, 'transaction_date');

  return {
    product_sku: data.product_sku.toString().trim(),
    location_code: data.location_code.toString().trim(),
    quantity_change: quantityChange,
    uom: data.uom.toString().trim(),
    adjustment_type: adjustmentType,
    reason: data.reason.toString().trim(),
    transaction_date: transactionDate,
    performed_by: data.performed_by.toString().trim(),
    reference_document_number: data.reference_document_number?.toString().trim() || null,
    batch_number: data.batch_number?.toString().trim() || null,
    notes: data.notes?.toString().trim() || null,
  };
}

/**
 * Validate Batch Creation Input
 */
function validateBatchCreation(data) {
  // Required fields
  validateRequired([
    'product_sku',
    'location_code',
    'batch_number',
    'received_date',
    'initial_quantity',
    'uom',
  ], data);

  // Validate quantity
  const initialQuantity = validatePositiveNumber(data.initial_quantity, 'initial_quantity');

  // Validate received date
  const receivedDate = validateDate(data.received_date, 'received_date');

  // Validate manufacture date if provided
  let manufactureDate = null;
  if (data.manufacture_date) {
    manufactureDate = validateDate(data.manufacture_date, 'manufacture_date');
  }

  // Validate expiry date if provided
  let expiryDate = null;
  if (data.expiry_date) {
    expiryDate = validateDate(data.expiry_date, 'expiry_date');
    
    // Ensure expiry date is after manufacture date
    if (manufactureDate && expiryDate <= manufactureDate) {
      throw new ValidationError(
        'Expiry date must be after manufacture date',
        { manufacture_date: manufactureDate, expiry_date: expiryDate }
      );
    }
  }

  // Validate QC status
  let qcStatus = 'pending';
  if (data.qc_status) {
    qcStatus = validateEnum(data.qc_status, 'qc_status', QC_STATUSES);
  }

  return {
    product_sku: data.product_sku.toString().trim(),
    location_code: data.location_code.toString().trim(),
    batch_number: data.batch_number.toString().trim(),
    received_date: receivedDate,
    manufacture_date: manufactureDate,
    expiry_date: expiryDate,
    initial_quantity: initialQuantity,
    uom: data.uom.toString().trim(),
    supplier_name: data.supplier_name?.toString().trim() || null,
    qc_status: qcStatus,
    notes: data.notes?.toString().trim() || null,
  };
}

/**
 * Validate QC Status Update Input
 */
function validateQCStatusUpdate(data) {
  // Required fields
  validateRequired(['batch_id', 'qc_status'], data);

  // Validate batch_id as UUID
  const batchId = validateUUID(data.batch_id, 'batch_id');

  // Validate QC status
  const qcStatus = validateEnum(data.qc_status, 'qc_status', QC_STATUSES);

  return {
    batch_id: batchId,
    qc_status: qcStatus,
    qc_notes: data.qc_notes?.toString().trim() || null,
  };
}

/**
 * Validate Report Filter Input
 */
function validateReportFilters(data) {
  const validated = {};

  // Validate product_sku if provided
  if (data.product_sku) {
    validated.product_sku = data.product_sku.toString().trim();
  }

  // Validate location_code if provided
  if (data.location_code) {
    validated.location_code = data.location_code.toString().trim();
  }

  // Validate category if provided
  if (data.category) {
    validated.category = data.category.toString().trim();
  }

  // Validate start_date if provided
  if (data.start_date) {
    validated.start_date = validateDate(data.start_date, 'start_date');
  }

  // Validate end_date if provided
  if (data.end_date) {
    validated.end_date = validateDate(data.end_date, 'end_date');
    
    // Ensure end_date is after start_date
    if (validated.start_date && validated.end_date < validated.start_date) {
      throw new ValidationError(
        'End date must be after start date',
        { start_date: validated.start_date, end_date: validated.end_date }
      );
    }
  }

  // Validate transaction_type if provided
  if (data.transaction_type) {
    validated.transaction_type = validateEnum(
      data.transaction_type,
      'transaction_type',
      TRANSACTION_TYPES
    );
  }

  // Validate qc_status if provided
  if (data.qc_status) {
    validated.qc_status = validateEnum(data.qc_status, 'qc_status', QC_STATUSES);
  }

  // Validate status if provided
  if (data.status) {
    validated.status = validateEnum(data.status, 'status', BATCH_STATUSES);
  }

  // Validate expiring_within_days if provided
  if (data.expiring_within_days !== undefined && data.expiring_within_days !== null) {
    validated.expiring_within_days = validatePositiveNumber(
      data.expiring_within_days,
      'expiring_within_days'
    );
  }

  // Validate limit if provided
  if (data.limit !== undefined && data.limit !== null) {
    validated.limit = validatePositiveNumber(data.limit, 'limit');
    
    // Cap limit at 10000 to prevent performance issues
    if (validated.limit > 10000) {
      validated.limit = 10000;
    }
  }

  // Validate export_excel flag
  if (data.export_excel !== undefined) {
    validated.export_excel = Boolean(data.export_excel);
  }

  return validated;
}

/**
 * Validate Stock Check Input
 */
function validateStockCheck(data) {
  // Required fields
  validateRequired(['product_sku', 'location_code'], data);

  return {
    product_sku: data.product_sku.toString().trim(),
    location_code: data.location_code.toString().trim(),
  };
}

/**
 * Validate Batch Selection Input
 */
function validateBatchSelection(data) {
  // Required fields
  validateRequired(['product_sku', 'location_code', 'quantity'], data);

  // Validate quantity
  const quantity = validatePositiveNumber(data.quantity, 'quantity');

  // Validate selection method
  let method = 'FIFO';
  if (data.method) {
    method = validateEnum(data.method, 'method', ['FIFO', 'FEFO']);
  }

  return {
    product_sku: data.product_sku.toString().trim(),
    location_code: data.location_code.toString().trim(),
    quantity: quantity,
    method: method,
  };
}

/**
 * Sanitize String Input
 * Removes potentially dangerous characters
 */
function sanitizeString(input, maxLength = 500) {
  if (!input) return null;
  
  let sanitized = input.toString().trim();
  
  // Remove SQL injection attempts (semicolons, single quotes, double-hyphens)
  sanitized = sanitized.replace(/[';]|--/g, '');
  
  // Truncate to max length
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
  }
  
  return sanitized;
}

/**
 * Validate Email Address
 */
function validateEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  
  if (!emailRegex.test(email)) {
    throw new ValidationError(
      'Invalid email address format',
      { field: 'email', value: email }
    );
  }
  
  return email.toLowerCase().trim();
}

module.exports = {
  // Transaction Validators
  validateReceiptTransaction,
  validateIssueTransaction,
  validateTransferTransaction,
  validateAdjustmentTransaction,
  
  // Batch Validators
  validateBatchCreation,
  validateQCStatusUpdate,
  validateBatchSelection,
  
  // Report Validators
  validateReportFilters,
  
  // General Validators
  validateStockCheck,
  sanitizeString,
  validateEmail,
  
  // Constants
  TRANSACTION_TYPES,
  QC_STATUSES,
  BATCH_STATUSES,
};
