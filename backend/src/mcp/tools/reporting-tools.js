// src/mcp/tools/reporting-tools.js
// MCP Tools for Reporting and Analytics

const reportingService = require('../../services/reporting-service');

// ============================================
// TOOL DEFINITIONS
// ============================================

const REPORTING_TOOLS = [
  {
    name: 'generate_stock_report',
    description: 'Generate a comprehensive stock level report with optional Excel export. Shows current inventory across all locations with status indicators.',
    inputSchema: {
      type: 'object',
      properties: {
        product_sku: {
          type: 'string',
          description: 'Optional: Filter by specific product SKU',
        },
        location_code: {
          type: 'string',
          description: 'Optional: Filter by warehouse location code',
        },
        category: {
          type: 'string',
          description: 'Optional: Filter by product category',
        },
        status: {
          type: 'string',
          enum: ['CRITICAL', 'LOW', 'OK'],
          description: 'Optional: Filter by stock status',
        },
        export_excel: {
          type: 'boolean',
          description: 'If true, generates an Excel file',
          default: false,
        },
      },
    },
  },
  {
    name: 'generate_transaction_report',
    description: 'Generate a transaction history report with optional Excel export. Shows all inventory movements with filters for date range, type, and more.',
    inputSchema: {
      type: 'object',
      properties: {
        start_date: {
          type: 'string',
          description: 'Start date for report (ISO format: YYYY-MM-DD)',
        },
        end_date: {
          type: 'string',
          description: 'End date for report (ISO format: YYYY-MM-DD)',
        },
        transaction_type: {
          type: 'string',
          enum: ['receipt', 'issue', 'transfer', 'adjustment'],
          description: 'Optional: Filter by transaction type',
        },
        product_sku: {
          type: 'string',
          description: 'Optional: Filter by product SKU',
        },
        location_code: {
          type: 'string',
          description: 'Optional: Filter by location',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of transactions (default: 1000)',
          default: 1000,
        },
        export_excel: {
          type: 'boolean',
          description: 'If true, generates an Excel file',
          default: false,
        },
      },
    },
  },
  {
    name: 'generate_batch_report',
    description: 'Generate a batch tracking report with expiry analysis and optional Excel export. Shows batch details including QC status and expiry information.',
    inputSchema: {
      type: 'object',
      properties: {
        product_sku: {
          type: 'string',
          description: 'Optional: Filter by product SKU',
        },
        qc_status: {
          type: 'string',
          enum: ['pending', 'in_progress', 'approved', 'rejected', 'on_hold'],
          description: 'Optional: Filter by QC status',
        },
        status: {
          type: 'string',
          enum: ['active', 'inactive', 'consolidated', 'split'],
          description: 'Optional: Filter by batch status',
        },
        expiring_within_days: {
          type: 'number',
          description: 'Optional: Show batches expiring within X days',
        },
        export_excel: {
          type: 'boolean',
          description: 'If true, generates an Excel file',
          default: false,
        },
      },
    },
  },
  {
    name: 'generate_low_stock_report',
    description: 'Generate a low stock alert report with optional Excel export. Shows items below reorder point with recommended reorder quantities.',
    inputSchema: {
      type: 'object',
      properties: {
        category: {
          type: 'string',
          description: 'Optional: Filter by product category',
        },
        export_excel: {
          type: 'boolean',
          description: 'If true, generates an Excel file',
          default: false,
        },
      },
    },
  },
];

// ============================================
// TOOL HANDLERS
// ============================================

async function handleReportingTools(toolName, args) {
  try {
    switch (toolName) {
      case 'generate_stock_report': {
        const reportData = await reportingService.generateStockReport(args);
        
        let result = {
          success: true,
          report_type: 'Stock Level Report',
          generated_at: reportData.generated_at,
          filters: reportData.filters,
          summary: reportData.summary,
          record_count: reportData.data.length,
        };
        
        // If Excel export requested
        if (args.export_excel) {
          const excelFile = await reportingService.exportToExcel('Stock Report', reportData);
          result.excel_file = excelFile;
          result.download_url = `/outputs/${excelFile.filename}`;
        } else {
          // Include data for JSON response
          result.data = reportData.data.slice(0, 100); // Limit to first 100 for readability
          if (reportData.data.length > 100) {
            result.note = `Showing first 100 of ${reportData.data.length} records. Use export_excel=true for full data.`;
          }
        }
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'generate_transaction_report': {
        const reportData = await reportingService.generateTransactionReport(args);
        
        let result = {
          success: true,
          report_type: 'Transaction History Report',
          generated_at: reportData.generated_at,
          filters: reportData.filters,
          summary: reportData.summary,
          record_count: reportData.data.length,
        };
        
        // If Excel export requested
        if (args.export_excel) {
          const excelFile = await reportingService.exportToExcel('Transaction Report', reportData);
          result.excel_file = excelFile;
          result.download_url = `/outputs/${excelFile.filename}`;
        } else {
          // Include data for JSON response
          result.data = reportData.data.slice(0, 50); // Limit to first 50
          if (reportData.data.length > 50) {
            result.note = `Showing first 50 of ${reportData.data.length} records. Use export_excel=true for full data.`;
          }
        }
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'generate_batch_report': {
        const reportData = await reportingService.generateBatchReport(args);
        
        let result = {
          success: true,
          report_type: 'Batch Tracking Report',
          generated_at: reportData.generated_at,
          filters: reportData.filters,
          summary: reportData.summary,
          record_count: reportData.data.length,
        };
        
        // If Excel export requested
        if (args.export_excel) {
          const excelFile = await reportingService.exportToExcel('Batch Report', reportData);
          result.excel_file = excelFile;
          result.download_url = `/outputs/${excelFile.filename}`;
        } else {
          // Include data for JSON response
          result.data = reportData.data.slice(0, 50);
          if (reportData.data.length > 50) {
            result.note = `Showing first 50 of ${reportData.data.length} records. Use export_excel=true for full data.`;
          }
        }
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'generate_low_stock_report': {
        const reportData = await reportingService.generateLowStockReport(args);
        
        let result = {
          success: true,
          report_type: 'Low Stock Alert Report',
          generated_at: reportData.generated_at,
          filters: reportData.filters,
          summary: reportData.summary,
          record_count: reportData.data.length,
        };
        
        // If Excel export requested
        if (args.export_excel) {
          const excelFile = await reportingService.exportToExcel('Low Stock Report', reportData);
          result.excel_file = excelFile;
          result.download_url = `/outputs/${excelFile.filename}`;
        } else {
          // Include all data for low stock (typically smaller dataset)
          result.data = reportData.data;
        }
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
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
            stack: error.stack,
          }, null, 2),
        },
      ],
      isError: true,
    };
  }
}

module.exports = {
  REPORTING_TOOLS,
  handleReportingTools,
};
