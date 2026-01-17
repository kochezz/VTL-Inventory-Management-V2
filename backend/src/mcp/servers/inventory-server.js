// src/mcp/servers/inventory-server.js
// Complete MCP Server for Vilagio Inventory Management
// Now with 11 tools: 5 original + 6 advanced transaction tools

const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} = require('@modelcontextprotocol/sdk/types.js');
const db = require('../../utils/db');
const advancedTools = require('../tools/advanced-inventory-tools');

// ==============================================
// TOOL DEFINITIONS
// ==============================================

const BASIC_TOOLS = [
  {
    name: 'query_inventory',
    description: 'Search and query current inventory levels. Can filter by SKU, product name, location, category, or stock status.',
    inputSchema: {
      type: 'object',
      properties: {
        sku: {
          type: 'string',
          description: 'Product SKU (e.g., PREFORM-500ML-18G)',
        },
        product_name: {
          type: 'string',
          description: 'Product name (partial match supported)',
        },
        location_code: {
          type: 'string',
          description: 'Location code (e.g., A-01-BIN-01)',
        },
        category: {
          type: 'string',
          description: 'Product category',
        },
        stock_status: {
          type: 'string',
          enum: ['low', 'ok', 'all'],
          description: 'Filter by stock status',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of results (default: 50)',
        },
      },
    },
  },
  {
    name: 'check_stock_level',
    description: 'Check detailed stock levels for a specific product by SKU. Shows on-hand, available, allocated quantities, and stock status.',
    inputSchema: {
      type: 'object',
      properties: {
        sku: {
          type: 'string',
          description: 'Product SKU to check',
        },
      },
      required: ['sku'],
    },
  },
  {
    name: 'get_low_stock_items',
    description: 'Get list of items below reorder point. Shows items that need to be reordered with suggested quantities.',
    inputSchema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['CRITICAL', 'LOW', 'ALL'],
          description: 'Filter by urgency level (default: ALL)',
        },
      },
    },
  },
  {
    name: 'get_expiring_batches',
    description: 'Find batches expiring within a specified number of days. Useful for FEFO and quality management.',
    inputSchema: {
      type: 'object',
      properties: {
        days: {
          type: 'number',
          description: 'Number of days to look ahead (default: 30)',
        },
      },
    },
  },
  {
    name: 'search_products',
    description: 'Search product catalog by name, SKU, or category. Returns product specifications and pricing.',
    inputSchema: {
      type: 'object',
      properties: {
        search_term: {
          type: 'string',
          description: 'Search term (product name, SKU, or category)',
        },
        limit: {
          type: 'number',
          description: 'Maximum results (default: 20)',
        },
      },
      required: ['search_term'],
    },
  },
];

// Combine basic and advanced tools
const TOOLS = [
  ...BASIC_TOOLS,
  ...advancedTools.ADVANCED_TOOLS,
];

// ==============================================
// TOOL HANDLERS - BASIC TOOLS
// ==============================================

async function handleQueryInventory(params) {
  try {
    let query = 'SELECT * FROM v_current_stock WHERE 1=1';
    const queryParams = [];
    let paramCount = 1;

    if (params.sku) {
      query += ` AND sku ILIKE $${paramCount}`;
      queryParams.push(`%${params.sku}%`);
      paramCount++;
    }

    if (params.product_name) {
      query += ` AND product_name ILIKE $${paramCount}`;
      queryParams.push(`%${params.product_name}%`);
      paramCount++;
    }

    if (params.location_code) {
      query += ` AND location_code ILIKE $${paramCount}`;
      queryParams.push(`%${params.location_code}%`);
      paramCount++;
    }

    if (params.category) {
      query += ` AND category_name ILIKE $${paramCount}`;
      queryParams.push(`%${params.category}%`);
      paramCount++;
    }

    if (params.stock_status && params.stock_status !== 'all') {
      query += ` AND LOWER(status) = $${paramCount}`;
      queryParams.push(params.stock_status.toLowerCase());
      paramCount++;
    }

    query += ` ORDER BY product_name, location_code LIMIT ${params.limit || 50}`;

    const result = await db.query(query, queryParams);

    if (result.rows.length === 0) {
      return {
        content: [
          {
            type: 'text',
            text: 'No inventory found matching your criteria.',
          },
        ],
      };
    }

    const response = `📦 Found ${result.rows.length} inventory records:\n\n` +
      result.rows.map((item, index) => 
        `${index + 1}. ${item.sku} - ${item.product_name}\n` +
        `   Location: ${item.location_name} (${item.location_code})\n` +
        `   Quantity: ${item.total_quantity} ${item.uom}\n` +
        `   Available: ${item.available_quantity} ${item.uom}\n` +
        `   Status: ${item.status === 'low' ? '⚠️ LOW' : item.status === 'critical' ? '🔴 CRITICAL' : '✅ OK'}\n` +
        (item.batch_number ? `   Batch: ${item.batch_number}\n` : '') +
        (item.expiry_date ? `   Expires: ${new Date(item.expiry_date).toLocaleDateString()}\n` : '')
      ).join('\n');

    return {
      content: [
        {
          type: 'text',
          text: response,
        },
      ],
    };
  } catch (error) {
    console.error('Error in query_inventory:', error);
    return {
      content: [
        {
          type: 'text',
          text: `Error querying inventory: ${error.message}`,
        },
      ],
      isError: true,
    };
  }
}

async function handleCheckStockLevel(params) {
  try {
    const result = await db.query(
      `SELECT 
        p.sku,
        p.product_name,
        p.base_uom,
        COALESCE(SUM(i.quantity_on_hand), 0) as total_on_hand,
        COALESCE(SUM(i.quantity_available), 0) as total_available,
        COUNT(DISTINCT i.location_id) as location_count,
        p.reorder_point,
        p.min_quantity,
        p.max_quantity
      FROM products p
      LEFT JOIN inventory i ON p.product_id = i.product_id
      WHERE p.sku = $1
      GROUP BY p.product_id, p.sku, p.product_name, p.base_uom, p.reorder_point, p.min_quantity, p.max_quantity`,
      [params.sku]
    );

    if (result.rows.length === 0) {
      return {
        content: [
          {
            type: 'text',
            text: `Product with SKU "${params.sku}" not found.`,
          },
        ],
        isError: true,
      };
    }

    const stock = result.rows[0];
    const status = 
      stock.total_on_hand <= (stock.min_quantity || 0) ? '🔴 CRITICAL' :
      stock.total_on_hand <= (stock.reorder_point || 0) ? '⚠️ LOW' :
      '✅ OK';

    const response = `📊 Stock Level Report for ${stock.sku}\n\n` +
      `Product: ${stock.product_name}\n` +
      `Status: ${status}\n\n` +
      `Current Stock:\n` +
      `  On Hand: ${stock.total_on_hand} ${stock.base_uom}\n` +
      `  Available: ${stock.total_available} ${stock.base_uom}\n` +
      `  Locations: ${stock.location_count}\n\n` +
      `Thresholds:\n` +
      `  Minimum: ${stock.min_quantity || 'Not set'} ${stock.base_uom}\n` +
      `  Reorder Point: ${stock.reorder_point || 'Not set'} ${stock.base_uom}\n` +
      `  Maximum: ${stock.max_quantity || 'Not set'} ${stock.base_uom}`;

    return {
      content: [
        {
          type: 'text',
          text: response,
        },
      ],
    };
  } catch (error) {
    console.error('Error in check_stock_level:', error);
    return {
      content: [
        {
          type: 'text',
          text: `Error checking stock level: ${error.message}`,
        },
      ],
      isError: true,
    };
  }
}

async function handleGetLowStockItems(params) {
  try {
    let query = 'SELECT * FROM v_low_stock_items';
    
    if (params.status && params.status !== 'ALL') {
      query += ` WHERE status = $1`;
    }
    
    query += ' ORDER BY status DESC, total_quantity ASC';

    const result = await db.query(
      query,
      params.status && params.status !== 'ALL' ? [params.status] : []
    );

    if (result.rows.length === 0) {
      return {
        content: [
          {
            type: 'text',
            text: params.status === 'ALL' 
              ? '✅ All items are above reorder point!' 
              : `No items found with ${params.status} status.`,
          },
        ],
      };
    }

    const response = `⚠️ Low Stock Items (${result.rows.length} items):\n\n` +
      result.rows.map((item, index) => 
        `${index + 1}. ${item.sku} - ${item.product_name}\n` +
        `   Status: ${item.status === 'CRITICAL' ? '🔴 CRITICAL' : '⚠️ LOW'}\n` +
        `   Current: ${item.total_quantity} ${item.uom}\n` +
        `   Reorder Point: ${item.reorder_point} ${item.uom}\n` +
        `   Suggested Order: ${item.reorder_quantity || 'Not set'} ${item.uom}\n` +
        `   Lead Time: ${item.lead_time_days || 'Not set'} days\n` +
        `   Locations: ${item.location_count}`
      ).join('\n\n');

    return {
      content: [
        {
          type: 'text',
          text: response,
        },
      ],
    };
  } catch (error) {
    console.error('Error in get_low_stock_items:', error);
    return {
      content: [
        {
          type: 'text',
          text: `Error getting low stock items: ${error.message}`,
        },
      ],
      isError: true,
    };
  }
}

async function handleGetExpiringBatches(params) {
  try {
    const days = params.days || 30;
    
    const result = await db.query(
      `SELECT * FROM v_expiring_batches 
       WHERE days_until_expiry <= $1
       ORDER BY days_until_expiry ASC`,
      [days]
    );

    if (result.rows.length === 0) {
      return {
        content: [
          {
            type: 'text',
            text: `✅ No batches expiring in the next ${days} days.`,
          },
        ],
      };
    }

    const response = `⏰ Batches Expiring in Next ${days} Days (${result.rows.length} batches):\n\n` +
      result.rows.map((batch, index) => {
        const urgency = 
          batch.days_until_expiry <= 7 ? '🔴 URGENT' :
          batch.days_until_expiry <= 15 ? '⚠️ WARNING' :
          '📅 UPCOMING';
        
        return `${index + 1}. ${batch.sku} - ${batch.product_name}\n` +
               `   Batch: ${batch.batch_number}\n` +
               `   Urgency: ${urgency}\n` +
               `   Expires: ${new Date(batch.expiry_date).toLocaleDateString()} (${batch.days_until_expiry} days)\n` +
               `   Quantity: ${batch.current_quantity} ${batch.uom}\n` +
               `   Location: ${batch.location_name} (${batch.location_code})\n` +
               `   QC Status: ${batch.qc_status}`;
      }).join('\n\n');

    return {
      content: [
        {
          type: 'text',
          text: response,
        },
      ],
    };
  } catch (error) {
    console.error('Error in get_expiring_batches:', error);
    return {
      content: [
        {
          type: 'text',
          text: `Error getting expiring batches: ${error.message}`,
        },
      ],
      isError: true,
    };
  }
}

async function handleSearchProducts(params) {
  try {
    const result = await db.query(
      `SELECT 
        p.sku,
        p.product_name,
        p.description,
        pc.category_name,
        p.base_uom,
        p.standard_cost,
        p.currency,
        p.reorder_point,
        p.reorder_quantity,
        p.lead_time_days,
        COALESCE(SUM(i.quantity_on_hand), 0) as current_stock
      FROM products p
      LEFT JOIN product_categories pc ON p.category_id = pc.category_id
      LEFT JOIN inventory i ON p.product_id = i.product_id
      WHERE p.sku ILIKE $1 
         OR p.product_name ILIKE $1 
         OR pc.category_name ILIKE $1
      GROUP BY p.product_id, pc.category_name
      ORDER BY p.product_name
      LIMIT $2`,
      [`%${params.search_term}%`, params.limit || 20]
    );

    if (result.rows.length === 0) {
      return {
        content: [
          {
            type: 'text',
            text: `No products found matching "${params.search_term}".`,
          },
        ],
      };
    }

    const response = `🔍 Found ${result.rows.length} products:\n\n` +
      result.rows.map((product, index) => 
        `${index + 1}. ${product.sku} - ${product.product_name}\n` +
        `   Category: ${product.category_name}\n` +
        (product.description ? `   Description: ${product.description}\n` : '') +
        `   UOM: ${product.base_uom}\n` +
        (product.standard_cost ? `   Cost: ${product.standard_cost} ${product.currency}\n` : '') +
        `   Current Stock: ${product.current_stock} ${product.base_uom}\n` +
        (product.reorder_point ? `   Reorder Point: ${product.reorder_point} ${product.base_uom}\n` : '') +
        (product.lead_time_days ? `   Lead Time: ${product.lead_time_days} days` : '')
      ).join('\n\n');

    return {
      content: [
        {
          type: 'text',
          text: response,
        },
      ],
    };
  } catch (error) {
    console.error('Error in search_products:', error);
    return {
      content: [
        {
          type: 'text',
          text: `Error searching products: ${error.message}`,
        },
      ],
      isError: true,
    };
  }
}

// ==============================================
// SERVER SETUP
// ==============================================

async function runServer() {
  console.log('🚀 Starting Vilagio Inventory MCP Server...');

  // Test database connection
  const connected = await db.testConnection();
  if (!connected) {
    console.error('❌ Failed to connect to database');
    process.exit(1);
  }

  // Create MCP server
  const server = new Server(
    {
      name: 'vilagio-inventory-server',
      version: '1.1.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // Register tool list handler
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: TOOLS,
    };
  });

  // Register tool call handler
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: params } = request.params;

    try {
      switch (name) {
        // Basic tools
        case 'query_inventory':
          return await handleQueryInventory(params);
        case 'check_stock_level':
          return await handleCheckStockLevel(params);
        case 'get_low_stock_items':
          return await handleGetLowStockItems(params);
        case 'get_expiring_batches':
          return await handleGetExpiringBatches(params);
        case 'search_products':
          return await handleSearchProducts(params);

        // Advanced transaction tools
        case 'create_receive_transaction':
          return await advancedTools.handleCreateReceiveTransaction(params);
        case 'create_issue_transaction':
          return await advancedTools.handleCreateIssueTransaction(params);
        case 'create_transfer_transaction':
          return await advancedTools.handleCreateTransferTransaction(params);
        case 'create_adjustment':
          return await advancedTools.handleCreateAdjustment(params);
        case 'get_transaction_history':
          return await advancedTools.handleGetTransactionHistory(params);
        case 'check_stock_availability':
          return await advancedTools.handleCheckStockAvailability(params);

        default:
          return {
            content: [
              {
                type: 'text',
                text: `Unknown tool: ${name}`,
              },
            ],
            isError: true,
          };
      }
    } catch (error) {
      console.error(`Error executing tool ${name}:`, error);
      return {
        content: [
          {
            type: 'text',
            text: `Error: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  });

  // Start server with stdio transport
  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.log('✅ Vilagio Inventory MCP Server running');
  console.log(`📦 ${TOOLS.length} tools available`);
  console.log('   Basic Tools (5):');
  console.log('     - query_inventory');
  console.log('     - check_stock_level');
  console.log('     - get_low_stock_items');
  console.log('     - get_expiring_batches');
  console.log('     - search_products');
  console.log('   Transaction Tools (6):');
  console.log('     - create_receive_transaction');
  console.log('     - create_issue_transaction');
  console.log('     - create_transfer_transaction');
  console.log('     - create_adjustment');
  console.log('     - get_transaction_history');
  console.log('     - check_stock_availability');
  console.log('');
}

// Run the server
runServer().catch((error) => {
  console.error('❌ Server error:', error);
  process.exit(1);
});