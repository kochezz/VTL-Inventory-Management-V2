// src/mcp/servers/inventory-server.js
// Vilagio Inventory MCP Server - Complete with Batch Management
// Total: 17 tools (5 basic + 6 transaction + 6 batch)

const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} = require('@modelcontextprotocol/sdk/types.js');

const db = require('../../utils/db');
const { BATCH_TOOLS, handleBatchTools } = require('../tools/batch-tools');
const advancedTools = require('../tools/advanced-inventory-tools');

// Import basic tools (from Week 5)
const basicInventoryTools = [
  {
    name: 'query_inventory',
    description: 'Query inventory with flexible filtering options (product, location, category, status)',
    inputSchema: {
      type: 'object',
      properties: {
        product_sku: { type: 'string', description: 'Filter by product SKU' },
        location_code: { type: 'string', description: 'Filter by location code' },
        category: { type: 'string', description: 'Filter by product category' },
        min_quantity: { type: 'number', description: 'Minimum quantity filter' },
        limit: { type: 'number', description: 'Maximum number of results (default: 50)' },
      },
    },
  },
  {
    name: 'check_stock_level',
    description: 'Get detailed stock information for a specific product at a specific location',
    inputSchema: {
      type: 'object',
      properties: {
        product_sku: { type: 'string', description: 'Product SKU to check' },
        location_code: { type: 'string', description: 'Warehouse location code' },
      },
      required: ['product_sku', 'location_code'],
    },
  },
  {
    name: 'get_low_stock_items',
    description: 'Get all products that are below reorder point or minimum quantity',
    inputSchema: {
      type: 'object',
      properties: {
        category: { type: 'string', description: 'Optional: Filter by category' },
        limit: { type: 'number', description: 'Maximum results (default: 50)' },
      },
    },
  },
  {
    name: 'get_expiring_batches',
    description: 'Get batches that are expiring within specified days',
    inputSchema: {
      type: 'object',
      properties: {
        days: { type: 'number', description: 'Days to look ahead (default: 30)' },
        product_sku: { type: 'string', description: 'Optional: Filter by product' },
      },
    },
  },
  {
    name: 'search_products',
    description: 'Search products by name, SKU, or description',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
        category: { type: 'string', description: 'Optional: Filter by category' },
        limit: { type: 'number', description: 'Maximum results (default: 20)' },
      },
      required: ['query'],
    },
  },
];

// Combine all tools
const TOOLS = [
  ...basicInventoryTools,
  ...advancedTools.TOOLS,
  ...BATCH_TOOLS,
];

// Create server
const server = new Server(
  {
    name: 'vilagio-inventory-backend',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Handle tool listing
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: TOOLS };
});

// Handle tool execution
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name: toolName, arguments: args } = request.params;

  try {
    // Route to appropriate handler based on tool name
    
    // Batch Management Tools
    if (BATCH_TOOLS.find(t => t.name === toolName)) {
      return await handleBatchTools(toolName, args || {});
    }
    
    // Advanced Inventory Tools (transactions)
    if (advancedTools.TOOLS.find(t => t.name === toolName)) {
      return await advancedTools.handleAdvancedTools(toolName, args || {});
    }
    
    // Basic Tools
    switch (toolName) {
      case 'query_inventory': {
        let query = 'SELECT * FROM v_current_stock WHERE 1=1';
        const params = [];
        let paramCount = 1;

        if (args.product_sku) {
          query += ` AND sku = $${paramCount}`;
          params.push(args.product_sku);
          paramCount++;
        }
        if (args.location_code) {
          query += ` AND location_code = $${paramCount}`;
          params.push(args.location_code);
          paramCount++;
        }
        if (args.category) {
          query += ` AND category_name ILIKE $${paramCount}`;
          params.push(`%${args.category}%`);
          paramCount++;
        }
        if (args.min_quantity) {
          query += ` AND total_quantity >= $${paramCount}`;
          params.push(args.min_quantity);
          paramCount++;
        }

        query += ` ORDER BY sku LIMIT ${args.limit || 50}`;
        const result = await db.query(query, params);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result.rows, null, 2),
            },
          ],
        };
      }

      case 'check_stock_level': {
        const result = await db.query(
          `SELECT * FROM v_current_stock 
           WHERE sku = $1 AND location_code = $2`,
          [args.product_sku, args.location_code]
        );

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result.rows, null, 2),
            },
          ],
        };
      }

      case 'get_low_stock_items': {
        let query = 'SELECT * FROM v_low_stock_items WHERE 1=1';
        const params = [];

        if (args.category) {
          query += ' AND category_name ILIKE $1';
          params.push(`%${args.category}%`);
        }

        query += ` ORDER BY status DESC, total_quantity ASC LIMIT ${args.limit || 50}`;
        const result = await db.query(query, params);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result.rows, null, 2),
            },
          ],
        };
      }

      case 'get_expiring_batches': {
        let query = 'SELECT * FROM v_expiring_batches WHERE days_until_expiry <= $1';
        const params = [args.days || 30];

        if (args.product_sku) {
          query += ' AND sku = $2';
          params.push(args.product_sku);
        }

        query += ' ORDER BY expiry_date ASC';
        const result = await db.query(query, params);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result.rows, null, 2),
            },
          ],
        };
      }

      case 'search_products': {
        const result = await db.query(
          `SELECT p.*, pc.category_name 
           FROM products p
           JOIN product_categories pc ON p.category_id = pc.category_id
           WHERE (p.product_name ILIKE $1 OR p.sku ILIKE $1 OR p.description ILIKE $1)
           ${args.category ? 'AND pc.category_name ILIKE $2' : ''}
           ORDER BY p.sku
           LIMIT ${args.limit || 20}`,
          args.category 
            ? [`%${args.query}%`, `%${args.category}%`]
            : [`%${args.query}%`]
        );

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result.rows, null, 2),
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
            error: error.message,
            tool: toolName,
          }, null, 2),
        },
      ],
      isError: true,
    };
  }
});

// Main execution
async function main() {
  console.log('🚀 Starting Vilagio Inventory MCP Server...');

  try {
    // Test database connection
    await db.query('SELECT NOW() as now, current_database() as database, version() as version');
    console.log('✅ Database connected successfully');
    
    // Test connection details
    const dbInfo = await db.query('SELECT current_database() as database, version() as version');
    console.log('✅ Database connection test successful');
    console.log('   Database:', dbInfo.rows[0].database);
    console.log('   PostgreSQL version:', dbInfo.rows[0].version.split(' ')[0], dbInfo.rows[0].version.split(' ')[1]);

    // Display server info
    console.log('✅ Vilagio Inventory MCP Server running');
    console.log(`📦 ${TOOLS.length} tools available`);
    console.log('   Basic Tools (5):');
    basicInventoryTools.forEach(t => console.log(`     - ${t.name}`));
    console.log('   Transaction Tools (6):');
    advancedTools.TOOLS.forEach(t => console.log(`     - ${t.name}`));
    console.log('   Batch Tools (6):');
    BATCH_TOOLS.forEach(t => console.log(`     - ${t.name}`));

    // Display connection pool status
    const poolInfo = await db.query('SELECT COUNT(*) as connections FROM pg_stat_activity WHERE datname = current_database()');
    console.log('🔌 Connection Pool Status:');
    console.log('   Total connections:', poolInfo.rows[0].connections);
    console.log('   Idle connections:', db.pool.idleCount || 1);
    console.log('   Waiting requests:', db.pool.waitingCount || 0);

    // Start the server
    const transport = new StdioServerTransport();
    await server.connect(transport);
  } catch (error) {
    console.error('❌ Error starting server:', error);
    process.exit(1);
  }
}

// Handle shutdown
process.on('SIGINT', async () => {
  console.log('\n👋 Shutting down server...');
  await db.closePool();
  process.exit(0);
});

main();
