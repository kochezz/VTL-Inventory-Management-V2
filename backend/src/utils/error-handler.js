// src/utils/error-handler.js
// Error Handling Middleware and Custom Error Classes
// Provides consistent error handling across the entire application

/**
 * Custom Error Classes
 */

class AppError extends Error {
  constructor(message, statusCode, errorCode = null, details = null) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.details = details;
    this.isOperational = true;
    this.timestamp = new Date().toISOString();
    
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      error: this.name,
      message: this.message,
      statusCode: this.statusCode,
      errorCode: this.errorCode,
      details: this.details,
      timestamp: this.timestamp,
    };
  }
}

class ValidationError extends AppError {
  constructor(message, details = null) {
    super(message, 400, 'VALIDATION_ERROR', details);
  }
}

class DatabaseError extends AppError {
  constructor(message, details = null) {
    super(message, 500, 'DATABASE_ERROR', details);
  }
}

class NotFoundError extends AppError {
  constructor(resource, identifier = null) {
    const message = identifier 
      ? `${resource} with identifier '${identifier}' not found`
      : `${resource} not found`;
    super(message, 404, 'NOT_FOUND', { resource, identifier });
  }
}

class ConflictError extends AppError {
  constructor(message, details = null) {
    super(message, 409, 'CONFLICT', details);
  }
}

class InsufficientStockError extends AppError {
  constructor(product, requested, available) {
    super(
      `Insufficient stock for ${product}. Requested: ${requested}, Available: ${available}`,
      400,
      'INSUFFICIENT_STOCK',
      { product, requested, available }
    );
  }
}

class BatchNotAvailableError extends AppError {
  constructor(batchNumber, reason) {
    super(
      `Batch ${batchNumber} is not available: ${reason}`,
      400,
      'BATCH_NOT_AVAILABLE',
      { batchNumber, reason }
    );
  }
}

/**
 * Error Handler Function
 * Processes errors and returns standardized error responses
 */
function handleError(error) {
  // Log the error
  logError(error);

  // If it's an operational error, return formatted response
  if (error.isOperational) {
    return {
      success: false,
      ...error.toJSON(),
    };
  }

  // For programming errors, return generic message
  return {
    success: false,
    error: 'InternalServerError',
    message: 'An unexpected error occurred',
    statusCode: 500,
    errorCode: 'INTERNAL_ERROR',
    timestamp: new Date().toISOString(),
  };
}

/**
 * Database Error Handler
 * Converts PostgreSQL errors to custom error classes
 */
function handleDatabaseError(error, context = '') {
  console.error(`Database Error in ${context}:`, error);

  // PostgreSQL error codes
  const errorCode = error.code;
  
  switch (errorCode) {
    case '23505': // Unique violation
      return new ConflictError(
        'A record with this identifier already exists',
        { constraint: error.constraint, detail: error.detail }
      );
    
    case '23503': // Foreign key violation
      return new ValidationError(
        'Referenced record does not exist',
        { constraint: error.constraint, detail: error.detail }
      );
    
    case '23502': // Not null violation
      return new ValidationError(
        'Required field is missing',
        { column: error.column, detail: error.detail }
      );
    
    case '23514': // Check violation
      return new ValidationError(
        'Value violates check constraint',
        { constraint: error.constraint, detail: error.detail }
      );
    
    case '42P01': // Undefined table
      return new DatabaseError(
        'Database table not found',
        { table: error.table }
      );
    
    case '42703': // Undefined column
      return new DatabaseError(
        'Database column not found',
        { column: error.column }
      );
    
    case '53300': // Too many connections
      return new DatabaseError(
        'Database connection pool exhausted',
        { detail: error.detail }
      );
    
    case '08003': // Connection does not exist
    case '08006': // Connection failure
      return new DatabaseError(
        'Database connection failed',
        { detail: error.detail }
      );
    
    default:
      return new DatabaseError(
        error.message || 'Database operation failed',
        { code: errorCode, detail: error.detail }
      );
  }
}

/**
 * Error Logger
 * Logs errors with appropriate detail level
 */
function logError(error) {
  const timestamp = new Date().toISOString();
  
  if (error.isOperational) {
    // Operational errors - log at warning level
    console.warn(`[${timestamp}] Operational Error:`, {
      name: error.name,
      message: error.message,
      code: error.errorCode,
      details: error.details,
    });
  } else {
    // Programming errors - log at error level with full stack
    console.error(`[${timestamp}] Programming Error:`, {
      name: error.name,
      message: error.message,
      stack: error.stack,
    });
  }
}

/**
 * Async Error Wrapper
 * Wraps async functions to catch errors automatically
 */
function asyncErrorHandler(fn) {
  return async (...args) => {
    try {
      return await fn(...args);
    } catch (error) {
      throw handleDatabaseError(error, fn.name);
    }
  };
}

/**
 * Validation Helper
 * Validates input and throws ValidationError if invalid
 */
function validateRequired(fields, data) {
  const missing = [];
  
  for (const field of fields) {
    if (data[field] === undefined || data[field] === null || data[field] === '') {
      missing.push(field);
    }
  }
  
  if (missing.length > 0) {
    throw new ValidationError(
      'Required fields are missing',
      { missing_fields: missing }
    );
  }
}

/**
 * Validation Helper - Positive Number
 */
function validatePositiveNumber(value, fieldName) {
  const num = parseFloat(value);
  
  if (isNaN(num)) {
    throw new ValidationError(
      `${fieldName} must be a valid number`,
      { field: fieldName, value }
    );
  }
  
  if (num <= 0) {
    throw new ValidationError(
      `${fieldName} must be a positive number`,
      { field: fieldName, value: num }
    );
  }
  
  return num;
}

/**
 * Validation Helper - Date
 */
function validateDate(value, fieldName) {
  const date = new Date(value);
  
  if (isNaN(date.getTime())) {
    throw new ValidationError(
      `${fieldName} must be a valid date`,
      { field: fieldName, value }
    );
  }
  
  return date;
}

/**
 * Validation Helper - Enum
 */
function validateEnum(value, fieldName, allowedValues) {
  if (!allowedValues.includes(value)) {
    throw new ValidationError(
      `${fieldName} must be one of: ${allowedValues.join(', ')}`,
      { field: fieldName, value, allowed: allowedValues }
    );
  }
  
  return value;
}

/**
 * Validation Helper - UUID
 */
function validateUUID(value, fieldName) {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  
  if (!uuidRegex.test(value)) {
    throw new ValidationError(
      `${fieldName} must be a valid UUID`,
      { field: fieldName, value }
    );
  }
  
  return value;
}

/**
 * Safe JSON Parse
 * Returns null if parsing fails instead of throwing
 */
function safeJSONParse(jsonString, defaultValue = null) {
  try {
    return JSON.parse(jsonString);
  } catch (error) {
    console.warn('JSON parse failed:', error.message);
    return defaultValue;
  }
}

/**
 * Retry Handler
 * Retries a function with exponential backoff
 */
async function retryWithBackoff(fn, maxRetries = 3, baseDelay = 1000) {
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      // Don't retry operational errors
      if (error.isOperational) {
        throw error;
      }
      
      if (attempt < maxRetries) {
        const delay = baseDelay * Math.pow(2, attempt - 1);
        console.warn(`Retry attempt ${attempt}/${maxRetries} after ${delay}ms`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError;
}

module.exports = {
  // Error Classes
  AppError,
  ValidationError,
  DatabaseError,
  NotFoundError,
  ConflictError,
  InsufficientStockError,
  BatchNotAvailableError,
  
  // Error Handlers
  handleError,
  handleDatabaseError,
  logError,
  asyncErrorHandler,
  
  // Validation Helpers
  validateRequired,
  validatePositiveNumber,
  validateDate,
  validateEnum,
  validateUUID,
  
  // Utilities
  safeJSONParse,
  retryWithBackoff,
};
