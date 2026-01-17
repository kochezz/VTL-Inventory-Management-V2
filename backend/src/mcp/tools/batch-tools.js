// src/mcp/tools/batch-tools.js
// MCP Tools for Batch Management

const batchService = require('../../services/batch-service');
const invService = require('../../services/inventory-service');

// ============================================
// TOOL DEFINITIONS
// ============================================

const BATCH_TOOLS = [
  {
    name: 'get_batch_info',
    description: 'Get detailed information about a specific batch by batch number',
    inputSchema: {
      type: 'object',
      properties: {
        batch_number: {
          type: 'string',
          description: 'Batch number to look up',
        },
      },
      required: ['batch_number'],
    },
  },
  {
    name: 'update_batch_qc_status',
    description: 'Update the QC (Quality Control) status of a batch. Valid statuses: pending, in_progress, approved, rejected, on_hold',
    inputSchema: {
      type: 'object',
      properties: {
        batch_number: {
          type: 'string',
          description: 'Batch number to update',
        },
        qc_status: {
          type: 'string',
          enum: ['pending', 'in_progress', 'approved', 'rejected', 'on_hold'],
          description: 'New QC status',
        },
        qc_notes: {
          type: 'string',
          description: 'Notes about the QC decision',
        },
        user_email: {
          type: 'string',
          description: 'Email of user performing the update',
        },
      },
      required: ['batch_number', 'qc_status', 'user_email'],
    },
  },
  {
    name: 'get_batches_fifo',
    description: 'Get available batches for a product using FIFO (First In, First Out) method. Returns oldest batches first.',
    inputSchema: {
      type: 'object',
      properties: {
        product_sku: {
          type: 'string',
          description: 'Product SKU to find batches for',
        },
        location_code: {
          type: 'string',
          description: 'Optional: Filter by warehouse location code',
        },
        required_quantity: {
          type: 'number',
          description: 'Optional: Required quantity - will return only batches needed to fulfill this quantity',
        },
      },
      required: ['product_sku'],
    },
  },
  {
    name: 'get_batches_fefo',
    description: 'Get available batches for a product using FEFO (First Expired, First Out) method. Returns batches expiring soonest first.',
    inputSchema: {
      type: 'object',
      properties: {
        product_sku: {
          type: 'string',
          description: 'Product SKU to find batches for',
        },
        location_code: {
          type: 'string',
          description: 'Optional: Filter by warehouse location code',
        },
        required_quantity: {
          type: 'number',
          description: 'Optional: Required quantity - will return only batches needed to fulfill this quantity',
        },
      },
      required: ['product_sku'],
    },
  },
  {
    name: 'get_batches_expiring_soon',
    description: 'Get all batches that are expiring within a specified number of days',
    inputSchema: {
      type: 'object',
      properties: {
        days: {
          type: 'number',
          description: 'Number of days to look ahead for expiring batches (default: 30)',
          default: 30,
        },
        product_sku: {
          type: 'string',
          description: 'Optional: Filter by product SKU',
        },
        location_code: {
          type: 'string',
          description: 'Optional: Filter by warehouse location code',
        },
      },
    },
  },
  {
    name: 'get_batch_movement_history',
    description: 'Get complete movement/transaction history for a specific batch',
    inputSchema: {
      type: 'object',
      properties: {
        batch_number: {
          type: 'string',
          description: 'Batch number to get history for',
        },
      },
      required: ['batch_number'],
    },
  },
];

// ============================================
// TOOL HANDLERS
// ============================================

async function handleBatchTools(toolName, args) {
  try {
    switch (toolName) {
      case 'get_batch_info': {
        const batch = await batchService.getBatchByNumber(args.batch_number);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                batch: {
                  batch_number: batch.batch_number,
                  product: `${batch.sku} - ${batch.product_name}`,
                  supplier: batch.supplier_full_name || batch.supplier_name || 'N/A',
                  received_date: batch.received_date,
                  manufacture_date: batch.manufacture_date,
                  expiry_date: batch.expiry_date,
                  qc_status: batch.qc_status,
                  qc_notes: batch.qc_notes,
                  initial_quantity: `${batch.initial_quantity} ${batch.uom}`,
                  current_quantity: `${batch.current_quantity} ${batch.uom}`,
                  status: batch.status,
                  notes: batch.notes,
                },
              }, null, 2),
            },
          ],
        };
      }

      case 'update_batch_qc_status': {
        const batch = await batchService.getBatchByNumber(args.batch_number);
        const user = await invService.getUserByIdentifier(args.user_email);
        
        const updated = await batchService.updateBatchQCStatus(
          batch.batch_id,
          args.qc_status,
          args.qc_notes || null,
          user.user_id
        );
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                message: `Batch ${args.batch_number} QC status updated to ${args.qc_status}`,
                batch: {
                  batch_number: updated.batch_number,
                  qc_status: updated.qc_status,
                  qc_notes: updated.qc_notes,
                  qc_date: updated.qc_date,
                },
              }, null, 2),
            },
          ],
        };
      }

      case 'get_batches_fifo': {
        const product = await invService.getProductBySKU(args.product_sku);
        const locationId = args.location_code 
          ? (await invService.getLocationByCode(args.location_code)).location_id
          : null;
        
        const result = await batchService.getAvailableBatchesFIFO(
          product.product_id,
          locationId,
          args.required_quantity || null
        );
        
        // If required quantity was specified, return allocation details
        if (args.required_quantity) {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  success: true,
                  selection_method: 'FIFO (First In, First Out)',
                  product: `${product.sku} - ${product.product_name}`,
                  required_quantity: args.required_quantity,
                  total_allocated: result.total_allocated,
                  fully_allocated: result.fully_allocated,
                  shortage: result.shortage,
                  batches: result.batches.map(b => ({
                    batch_number: b.batch_number,
                    location: b.location_code,
                    available: parseFloat(b.available_quantity),
                    allocated: b.allocated_quantity,
                    received_date: b.received_date,
                    expiry_date: b.expiry_date || 'N/A',
                  })),
                }, null, 2),
              },
            ],
          };
        }
        
        // Otherwise return all available batches
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                selection_method: 'FIFO (First In, First Out)',
                product: `${product.sku} - ${product.product_name}`,
                total_batches: result.length,
                batches: result.map(b => ({
                  batch_number: b.batch_number,
                  location: b.location_code,
                  available: parseFloat(b.available_quantity),
                  received_date: b.received_date,
                  expiry_date: b.expiry_date || 'N/A',
                })),
              }, null, 2),
            },
          ],
        };
      }

      case 'get_batches_fefo': {
        const product = await invService.getProductBySKU(args.product_sku);
        const locationId = args.location_code 
          ? (await invService.getLocationByCode(args.location_code)).location_id
          : null;
        
        const result = await batchService.getAvailableBatchesFEFO(
          product.product_id,
          locationId,
          args.required_quantity || null
        );
        
        // If required quantity was specified, return allocation details
        if (args.required_quantity) {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  success: true,
                  selection_method: 'FEFO (First Expired, First Out)',
                  product: `${product.sku} - ${product.product_name}`,
                  required_quantity: args.required_quantity,
                  total_allocated: result.total_allocated,
                  fully_allocated: result.fully_allocated,
                  shortage: result.shortage,
                  batches: result.batches.map(b => ({
                    batch_number: b.batch_number,
                    location: b.location_code,
                    available: parseFloat(b.available_quantity),
                    allocated: b.allocated_quantity,
                    expiry_date: b.expiry_date,
                    days_until_expiry: parseInt(b.days_until_expiry),
                  })),
                }, null, 2),
              },
            ],
          };
        }
        
        // Otherwise return all available batches
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                selection_method: 'FEFO (First Expired, First Out)',
                product: `${product.sku} - ${product.product_name}`,
                total_batches: result.length,
                batches: result.map(b => ({
                  batch_number: b.batch_number,
                  location: b.location_code,
                  available: parseFloat(b.available_quantity),
                  expiry_date: b.expiry_date,
                  days_until_expiry: parseInt(b.days_until_expiry),
                })),
              }, null, 2),
            },
          ],
        };
      }

      case 'get_batches_expiring_soon': {
        const productId = args.product_sku 
          ? (await invService.getProductBySKU(args.product_sku)).product_id
          : null;
        const locationId = args.location_code 
          ? (await invService.getLocationByCode(args.location_code)).location_id
          : null;
        
        const batches = await batchService.getExpiringBatches(
          args.days || 30,
          productId,
          locationId
        );
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                days_ahead: args.days || 30,
                total_batches: batches.length,
                batches: batches.map(b => ({
                  batch_number: b.batch_number,
                  product: `${b.sku} - ${b.product_name}`,
                  location: b.location_code || 'N/A',
                  quantity: parseFloat(b.quantity_on_hand || 0),
                  expiry_date: b.expiry_date,
                  days_until_expiry: parseInt(b.days_until_expiry),
                  qc_status: b.qc_status,
                })),
              }, null, 2),
            },
          ],
        };
      }

      case 'get_batch_movement_history': {
        const batch = await batchService.getBatchByNumber(args.batch_number);
        const history = await batchService.getBatchMovementHistory(batch.batch_id);
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                batch_number: batch.batch_number,
                product: `${batch.sku} - ${batch.product_name}`,
                total_transactions: history.length,
                transactions: history.map(t => ({
                  transaction_number: t.transaction_number,
                  transaction_type: t.transaction_type,
                  date: t.transaction_date,
                  quantity: `${t.quantity} ${t.uom}`,
                  from_location: t.from_location || 'N/A',
                  to_location: t.to_location || 'N/A',
                  performed_by: t.performed_by_name,
                  reference: t.reference_document_number || 'N/A',
                  notes: t.notes || '',
                })),
              }, null, 2),
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: error.message,
          }, null, 2),
        },
      ],
      isError: true,
    };
  }
}

module.exports = {
  BATCH_TOOLS,
  handleBatchTools,
};
