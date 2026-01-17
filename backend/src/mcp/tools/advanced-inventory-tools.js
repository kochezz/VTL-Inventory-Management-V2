// src/mcp/tools/advanced-inventory-tools.js
// Advanced MCP Tools for Stock Updates and Transactions
// Add these tools to your inventory-server.js

const transactionService = require('../../services/transaction-service');
const inventoryService = require('../../services/inventory-service');

/**
 * Tool definitions for advanced inventory operations
 */
const TOOLS = [
  {
    name: 'create_receive_transaction',
    description: 'Receive incoming stock from supplier. Creates a receipt transaction and updates inventory levels.',
    inputSchema: {
      type: 'object',
      properties: {
        product_sku: { type: 'string', description: 'Product SKU (e.g., PREFORM-500ML-18G)' },
        quantity: { type: 'number', description: 'Quantity to receive' },
        location_code: { type: 'string', description: 'Destination location code (e.g., A-01-BIN-01)' },
        batch_number: { type: 'string', description: 'Batch number (optional for batch-tracked items)' },
        reference_number: { type: 'string', description: 'PO number or reference (optional)' },
        unit_cost: { type: 'number', description: 'Cost per unit (optional)' },
        notes: { type: 'string', description: 'Additional notes' },
        user_identifier: { type: 'string', description: 'User email or employee ID' },
      },
      required: ['product_sku', 'quantity', 'location_code', 'user_identifier'],
    },
  },
  {
    name: 'create_issue_transaction',
    description: 'Issue materials to production. Creates an issue transaction and reduces inventory.',
    inputSchema: {
      type: 'object',
      properties: {
        product_sku: { type: 'string', description: 'Product SKU' },
        quantity: { type: 'number', description: 'Quantity to issue' },
        location_code: { type: 'string', description: 'Source location code' },
        batch_number: { type: 'string', description: 'Batch number (optional)' },
        reference_number: { type: 'string', description: 'Production order number (optional)' },
        notes: { type: 'string', description: 'Additional notes' },
        user_identifier: { type: 'string', description: 'User email or employee ID' },
      },
      required: ['product_sku', 'quantity', 'location_code', 'user_identifier'],
    },
  },
  {
    name: 'create_transfer_transaction',
    description: 'Transfer inventory between locations. Moves stock from one location to another.',
    inputSchema: {
      type: 'object',
      properties: {
        product_sku: { type: 'string', description: 'Product SKU' },
        quantity: { type: 'number', description: 'Quantity to transfer' },
        from_location_code: { type: 'string', description: 'Source location code' },
        to_location_code: { type: 'string', description: 'Destination location code' },
        batch_number: { type: 'string', description: 'Batch number (optional)' },
        notes: { type: 'string', description: 'Reason for transfer' },
        user_identifier: { type: 'string', description: 'User email or employee ID' },
      },
      required: ['product_sku', 'quantity', 'from_location_code', 'to_location_code', 'user_identifier'],
    },
  },
  {
    name: 'create_adjustment',
    description: 'Adjust inventory for cycle count corrections. Can increase or decrease stock.',
    inputSchema: {
      type: 'object',
      properties: {
        product_sku: { type: 'string', description: 'Product SKU' },
        adjustment_quantity: { type: 'number', description: 'Adjustment amount (positive to add, negative to remove)' },
        location_code: { type: 'string', description: 'Location code' },
        batch_number: { type: 'string', description: 'Batch number (optional)' },
        reason: { type: 'string', description: 'Reason for adjustment (e.g., "Cycle count correction")' },
        user_identifier: { type: 'string', description: 'User email or employee ID' },
      },
      required: ['product_sku', 'adjustment_quantity', 'location_code', 'reason', 'user_identifier'],
    },
  },
  {
    name: 'get_transaction_history',
    description: 'Get transaction history with optional filters. Shows all inventory movements.',
    inputSchema: {
      type: 'object',
      properties: {
        product_sku: { type: 'string', description: 'Filter by product SKU' },
        transaction_type: { 
          type: 'string', 
          enum: ['receipt', 'issue', 'transfer', 'adjustment', 'return'],
          description: 'Filter by transaction type' 
        },
        location_code: { type: 'string', description: 'Filter by location' },
        days: { type: 'number', description: 'Number of days to look back (default: 7)' },
        limit: { type: 'number', description: 'Maximum results (default: 50)' },
      },
    },
  },
  {
    name: 'check_stock_availability',
    description: 'Check if sufficient stock is available at a location for a specific quantity.',
    inputSchema: {
      type: 'object',
      properties: {
        product_sku: { type: 'string', description: 'Product SKU' },
        location_code: { type: 'string', description: 'Location code to check' },
        required_quantity: { type: 'number', description: 'Required quantity' },
        batch_number: { type: 'string', description: 'Specific batch (optional)' },
      },
      required: ['product_sku', 'location_code', 'required_quantity'],
    },
  },
];

/**
 * Main Handler Function (Added to fix the missing function error)
 */
async function handleAdvancedTools(toolName, args) {
  switch (toolName) {
    case 'create_receive_transaction':
      return await handleCreateReceiveTransaction(args);
    case 'create_issue_transaction':
      return await handleCreateIssueTransaction(args);
    case 'create_transfer_transaction':
      return await handleCreateTransferTransaction(args);
    case 'create_adjustment':
      return await handleCreateAdjustment(args);
    case 'get_transaction_history':
      return await handleGetTransactionHistory(args);
    case 'check_stock_availability':
      return await handleCheckStockAvailability(args);
    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }
}

/**
 * Individual Tool Handlers
 */

async function handleCreateReceiveTransaction(params) {
  try {
    const product = await inventoryService.getProductBySKU(params.product_sku);
    const location = await inventoryService.getLocationByCode(params.location_code);
    const user = await inventoryService.getUserByIdentifier(params.user_identifier);
    
    let batchId = null;
    if (params.batch_number) {
      const batch = await inventoryService.getBatchInfo(params.batch_number);
      batchId = batch.batch_id;
    }
    
    const transaction = await transactionService.createReceiveTransaction({
      product_id: product.product_id,
      quantity: params.quantity,
      uom: product.base_uom,
      to_location_id: location.location_id,
      batch_id: batchId,
      reference_document_type: 'PO',
      reference_document_number: params.reference_number,
      unit_cost: params.unit_cost,
      total_cost: params.unit_cost ? params.unit_cost * params.quantity : null,
      notes: params.notes,
      performed_by: user.user_id,
    });
    
    return {
      content: [{
        type: 'text',
        text: `✅ Receipt Transaction Created Successfully!\n\n` +
              `Transaction: ${transaction.transaction_number}\n` +
              `Product: ${product.sku} - ${product.product_name}\n` +
              `Quantity: ${params.quantity} ${product.base_uom}\n` +
              `Location: ${location.location_name} (${location.location_code})\n` +
              (params.batch_number ? `Batch: ${params.batch_number}\n` : '') +
              (params.reference_number ? `PO Reference: ${params.reference_number}\n` : '') +
              `Performed by: ${user.full_name}\n` +
              `Date: ${new Date(transaction.transaction_date).toLocaleString()}`,
      }],
    };
  } catch (error) {
    return {
      content: [{ type: 'text', text: `❌ Error creating receipt transaction: ${error.message}` }],
      isError: true,
    };
  }
}

async function handleCreateIssueTransaction(params) {
  try {
    const product = await inventoryService.getProductBySKU(params.product_sku);
    const location = await inventoryService.getLocationByCode(params.location_code);
    const user = await inventoryService.getUserByIdentifier(params.user_identifier);
    
    let batchId = null;
    if (params.batch_number) {
      const batch = await inventoryService.getBatchInfo(params.batch_number);
      batchId = batch.batch_id;
    }
    
    const transaction = await transactionService.createIssueTransaction({
      product_id: product.product_id,
      quantity: params.quantity,
      uom: product.base_uom,
      from_location_id: location.location_id,
      batch_id: batchId,
      reference_document_type: 'Production Order',
      reference_document_number: params.reference_number,
      notes: params.notes,
      performed_by: user.user_id,
    });
    
    return {
      content: [{
        type: 'text',
        text: `✅ Issue Transaction Created Successfully!\n\n` +
              `Transaction: ${transaction.transaction_number}\n` +
              `Product: ${product.sku} - ${product.product_name}\n` +
              `Quantity: ${params.quantity} ${product.base_uom}\n` +
              `From Location: ${location.location_name} (${location.location_code})\n` +
              (params.batch_number ? `Batch: ${params.batch_number}\n` : '') +
              (params.reference_number ? `Production Order: ${params.reference_number}\n` : '') +
              `Performed by: ${user.full_name}\n` +
              `Date: ${new Date(transaction.transaction_date).toLocaleString()}`,
      }],
    };
  } catch (error) {
    return {
      content: [{ type: 'text', text: `❌ Error creating issue transaction: ${error.message}` }],
      isError: true,
    };
  }
}

async function handleCreateTransferTransaction(params) {
  try {
    const product = await inventoryService.getProductBySKU(params.product_sku);
    const fromLocation = await inventoryService.getLocationByCode(params.from_location_code);
    const toLocation = await inventoryService.getLocationByCode(params.to_location_code);
    const user = await inventoryService.getUserByIdentifier(params.user_identifier);
    
    let batchId = null;
    if (params.batch_number) {
      const batch = await inventoryService.getBatchInfo(params.batch_number);
      batchId = batch.batch_id;
    }
    
    const transaction = await transactionService.createTransferTransaction({
      product_id: product.product_id,
      quantity: params.quantity,
      uom: product.base_uom,
      from_location_id: fromLocation.location_id,
      to_location_id: toLocation.location_id,
      batch_id: batchId,
      notes: params.notes,
      performed_by: user.user_id,
    });
    
    return {
      content: [{
        type: 'text',
        text: `✅ Transfer Transaction Created Successfully!\n\n` +
              `Transaction: ${transaction.transaction_number}\n` +
              `Product: ${product.sku} - ${product.product_name}\n` +
              `Quantity: ${params.quantity} ${product.base_uom}\n` +
              `From: ${fromLocation.location_name} (${fromLocation.location_code})\n` +
              `To: ${toLocation.location_name} (${toLocation.location_code})\n` +
              (params.batch_number ? `Batch: ${params.batch_number}\n` : '') +
              `Performed by: ${user.full_name}\n` +
              `Date: ${new Date(transaction.transaction_date).toLocaleString()}`,
      }],
    };
  } catch (error) {
    return {
      content: [{ type: 'text', text: `❌ Error creating transfer transaction: ${error.message}` }],
      isError: true,
    };
  }
}

async function handleCreateAdjustment(params) {
  try {
    const product = await inventoryService.getProductBySKU(params.product_sku);
    const location = await inventoryService.getLocationByCode(params.location_code);
    const user = await inventoryService.getUserByIdentifier(params.user_identifier);
    
    let batchId = null;
    if (params.batch_number) {
      const batch = await inventoryService.getBatchInfo(params.batch_number);
      batchId = batch.batch_id;
    }
    
    const transaction = await transactionService.createAdjustmentTransaction({
      product_id: product.product_id,
      quantity: params.adjustment_quantity,
      uom: product.base_uom,
      from_location_id: location.location_id,
      batch_id: batchId,
      reference_document_type: 'Cycle Count',
      notes: params.reason,
      performed_by: user.user_id,
    });
    
    const adjustType = params.adjustment_quantity > 0 ? 'Increase' : 'Decrease';
    
    return {
      content: [{
        type: 'text',
        text: `✅ Adjustment Transaction Created Successfully!\n\n` +
              `Transaction: ${transaction.transaction_number}\n` +
              `Product: ${product.sku} - ${product.product_name}\n` +
              `Adjustment: ${adjustType} by ${Math.abs(params.adjustment_quantity)} ${product.base_uom}\n` +
              `Location: ${location.location_name} (${location.location_code})\n` +
              (params.batch_number ? `Batch: ${params.batch_number}\n` : '') +
              `Reason: ${params.reason}\n` +
              `Performed by: ${user.full_name}\n` +
              `Date: ${new Date(transaction.transaction_date).toLocaleString()}`,
      }],
    };
  } catch (error) {
    return {
      content: [{ type: 'text', text: `❌ Error creating adjustment: ${error.message}` }],
      isError: true,
    };
  }
}

async function handleGetTransactionHistory(params) {
  try {
    const filters = { limit: params.limit || 50 };
    
    if (params.product_sku) {
      const product = await inventoryService.getProductBySKU(params.product_sku);
      filters.product_id = product.product_id;
    }
    
    if (params.location_code) {
      const location = await inventoryService.getLocationByCode(params.location_code);
      filters.location_id = location.location_id;
    }
    
    if (params.transaction_type) filters.transaction_type = params.transaction_type;
    
    if (params.days) {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - params.days);
      filters.start_date = startDate.toISOString();
    }
    
    const transactions = await transactionService.getTransactionHistory(filters);
    
    if (transactions.length === 0) {
      return {
        content: [{ type: 'text', text: 'No transactions found matching your criteria.' }],
      };
    }
    
    const response = `📋 Transaction History (${transactions.length} transactions):\n\n` +
      transactions.map((txn, index) => 
        `${index + 1}. ${txn.transaction_number} - ${txn.transaction_type.toUpperCase()}\n` +
        `   Product: ${txn.sku} - ${txn.product_name}\n` +
        `   Quantity: ${txn.quantity} ${txn.uom}\n` +
        (txn.from_location_code ? `   From: ${txn.from_location_code}\n` : '') +
        (txn.to_location_code ? `   To: ${txn.to_location_code}\n` : '') +
        (txn.batch_number ? `   Batch: ${txn.batch_number}\n` : '') +
        `   By: ${txn.performed_by_name}\n` +
        `   Date: ${new Date(txn.transaction_date).toLocaleString()}`
      ).join('\n\n');
    
    return {
      content: [{ type: 'text', text: response }],
    };
  } catch (error) {
    return {
      content: [{ type: 'text', text: `❌ Error retrieving transaction history: ${error.message}` }],
      isError: true,
    };
  }
}

async function handleCheckStockAvailability(params) {
  try {
    const product = await inventoryService.getProductBySKU(params.product_sku);
    const location = await inventoryService.getLocationByCode(params.location_code);
    
    let batchId = null;
    if (params.batch_number) {
      const batch = await inventoryService.getBatchInfo(params.batch_number);
      batchId = batch.batch_id;
    }
    
    const availability = await inventoryService.checkStockAvailability(
      product.product_id,
      location.location_id,
      params.required_quantity,
      batchId
    );
    
    const status = availability.available ? '✅ AVAILABLE' : '❌ INSUFFICIENT';
    
    return {
      content: [{
        type: 'text',
        text: `${status}\n\n` +
              `Product: ${product.sku} - ${product.product_name}\n` +
              `Location: ${location.location_name} (${location.location_code})\n` +
              (params.batch_number ? `Batch: ${params.batch_number}\n` : '') +
              `\nStock Status:\n` +
              `  Required: ${params.required_quantity} ${product.base_uom}\n` +
              `  On Hand: ${availability.quantity_on_hand || 0} ${product.base_uom}\n` +
              `  Available: ${availability.quantity_available || 0} ${product.base_uom}\n` +
              `  Allocated: ${availability.quantity_allocated || 0} ${product.base_uom}\n` +
              `\nResult: ${availability.reason}`,
      }],
    };
  } catch (error) {
    return {
      content: [{ type: 'text', text: `❌ Error checking availability: ${error.message}` }],
      isError: true,
    };
  }
}

// Corrected Export
module.exports = {
  TOOLS, // Renamed from ADVANCED_TOOLS to match server expectation
  handleAdvancedTools, // Added the missing main handler
};