# Week 6 Day 2: Batch Management Implementation Guide

## 📋 Overview

**Goal:** Add advanced batch management capabilities to your inventory system

**New Features:**
- FIFO (First In, First Out) batch selection
- FEFO (First Expired, First Out) batch selection
- QC status management (pending → approved → rejected)
- Batch movement tracking
- Expiry alerts and management
- 6 new MCP tools for batch operations

---

## 📦 Files to Install

### **1. Batch Service** → `src/services/batch-service.js`
Business logic for batch operations

### **2. Batch Tools** → `src/mcp/tools/batch-tools.js`
MCP tool handlers for batch management

### **3. Updated MCP Server** → `src/mcp/servers/inventory-server.js`
Updated to include 17 total tools (11 existing + 6 new batch tools)

---

## 🚀 Installation Steps

### **Step 1: Install Files**

```bash
# Navigate to backend directory
cd C:\Users\willi\GitHub\VTL_Inventory_MGT\backend

# Create batch service
# Copy batch-service.js to src/services/batch-service.js

# Create batch tools
# Copy batch-tools.js to src/mcp/tools/batch-tools.js

# Update MCP server
# Replace src/mcp/servers/inventory-server.js with updated version
```

---

### **Step 2: Verify File Structure**

```
backend/
├── src/
│   ├── services/
│   │   ├── transaction-service.js  ← Existing (Week 6 Day 1)
│   │   ├── inventory-service.js    ← Existing (Week 6 Day 1)
│   │   └── batch-service.js        ← NEW
│   └── mcp/
│       ├── tools/
│       │   ├── advanced-inventory-tools.js  ← Existing
│       │   └── batch-tools.js               ← NEW
│       └── servers/
│           └── inventory-server.js          ← UPDATED (17 tools)
```

---

## 🧪 Testing Procedures

### **Test 1: Verify Batch Service**

```bash
node -e "
const batchService = require('./src/services/batch-service');
console.log('✅ Batch service loaded successfully');
console.log('Available functions:', Object.keys(batchService));
"
```

**Expected output:**
```
✅ Batch service loaded successfully
Available functions: [
  'createBatch',
  'updateBatchQCStatus',
  'getBatchByNumber',
  'getAvailableBatchesFIFO',
  'getAvailableBatchesFEFO',
  'getExpiringBatches',
  'getBatchMovementHistory',
  'generateBatchNumber'
]
```

---

### **Test 2: Test FIFO Batch Selection**

```bash
node -e "
const db = require('./src/utils/db');
const batchService = require('./src/services/batch-service');
const invService = require('./src/services/inventory-service');

async function test() {
  console.log('🧪 Testing FIFO Batch Selection\n');
  
  // Get product
  const product = await invService.getProductBySKU('PREFORM-500ML-18G');
  console.log('Product:', product.sku);
  
  // Get FIFO batches
  const batches = await batchService.getAvailableBatchesFIFO(product.product_id);
  
  console.log('\nFIFO Batches (oldest first):');
  batches.forEach((batch, i) => {
    console.log(\`  \${i + 1}. \${batch.batch_number}\`);
    console.log(\`     Received: \${batch.received_date}\`);
    console.log(\`     Available: \${batch.available_quantity} \${batch.uom}\`);
    console.log(\`     Location: \${batch.location_code}\`);
  });
  
  await db.closePool();
}

test().catch(console.error);
"
```

---

### **Test 3: Test FEFO Batch Selection**

```bash
node -e "
const db = require('./src/utils/db');
const batchService = require('./src/services/batch-service');
const invService = require('./src/services/inventory-service');

async function test() {
  console.log('🧪 Testing FEFO Batch Selection\n');
  
  // Get product
  const product = await invService.getProductBySKU('PREFORM-500ML-18G');
  console.log('Product:', product.sku);
  
  // Get FEFO batches with required quantity
  const result = await batchService.getAvailableBatchesFEFO(
    product.product_id,
    null,
    50000 // Need 50,000 pieces
  );
  
  console.log('\nFEFO Allocation (earliest expiry first):');
  console.log('  Required:', 50000);
  console.log('  Allocated:', result.total_allocated);
  console.log('  Fully allocated:', result.fully_allocated ? '✅' : '❌');
  console.log('\nBatches to use:');
  
  result.batches.forEach((batch, i) => {
    console.log(\`  \${i + 1}. \${batch.batch_number}\`);
    console.log(\`     Expiry: \${batch.expiry_date || 'N/A'}\`);
    console.log(\`     Use: \${batch.allocated_quantity} of \${batch.available_quantity}\`);
  });
  
  await db.closePool();
}

test().catch(console.error);
"
```

---

### **Test 4: Test QC Status Update**

```bash
node -e "
const db = require('./src/utils/db');
const batchService = require('./src/services/batch-service');

async function test() {
  console.log('🧪 Testing QC Status Update\n');
  
  // Get a batch
  const batch = await batchService.getBatchByNumber('BATCH-PF500-18G-001');
  console.log('Batch:', batch.batch_number);
  console.log('Current QC Status:', batch.qc_status);
  
  // Update to 'approved'
  const updated = await batchService.updateBatchQCStatus(
    batch.batch_id,
    'approved',
    'Quality check passed - ready for production'
  );
  
  console.log('\n✅ QC Status Updated:');
  console.log('  New Status:', updated.qc_status);
  console.log('  Notes:', updated.qc_notes);
  console.log('  Date:', updated.qc_date);
  
  await db.closePool();
}

test().catch(console.error);
"
```

---

### **Test 5: Test Expiring Batches**

```bash
node -e "
const db = require('./src/utils/db');
const batchService = require('./src/services/batch-service');

async function test() {
  console.log('🧪 Testing Expiring Batches Alert\n');
  
  // Get batches expiring in next 60 days
  const batches = await batchService.getExpiringBatches(60);
  
  console.log(\`Batches expiring in next 60 days: \${batches.length}\n\`);
  
  batches.forEach((batch, i) => {
    console.log(\`\${i + 1}. \${batch.batch_number}\`);
    console.log(\`   Product: \${batch.sku}\`);
    console.log(\`   Expiry: \${batch.expiry_date}\`);
    console.log(\`   Days left: \${Math.floor(batch.days_until_expiry)}\`);
    console.log(\`   Quantity: \${batch.quantity_on_hand}\`);
    console.log(\`   Location: \${batch.location_code || 'N/A'}\`);
  });
  
  await db.closePool();
}

test().catch(console.error);
"
```

---

### **Test 6: Start MCP Server with Batch Tools**

```bash
npm run mcp
```

**Expected output:**
```
🚀 Starting Vilagio Inventory MCP Server...
✅ Database connected successfully
✅ Vilagio Inventory MCP Server running
📦 17 tools available
   Basic Tools (5):
     - query_inventory
     - check_stock_level
     - get_low_stock_items
     - get_expiring_batches
     - search_products
   Transaction Tools (6):
     - create_receive_transaction
     - create_issue_transaction
     - create_transfer_transaction
     - create_adjustment
     - get_transaction_history
     - check_stock_availability
   Batch Tools (6):
     - get_batch_info
     - update_batch_qc_status
     - get_batches_fifo
     - get_batches_fefo
     - get_batches_expiring_soon
     - get_batch_movement_history
```

---

## 🎯 Usage Examples (with Claude Desktop)

Once MCP server is running, you can use natural language:

### **Example 1: FIFO Selection**
```
"Show me FIFO batches for PREFORM-500ML-18G, I need 50,000 pieces"
```

### **Example 2: FEFO Selection**
```
"Use FEFO method to select batches for CAP-GENERIC, need 100,000 pieces"
```

### **Example 3: Update QC Status**
```
"Approve batch BATCH-PF500-18G-001, note: Quality check passed, user: wphiri@vilag.io"
```

### **Example 4: Expiring Batches**
```
"Show me all batches expiring in the next 30 days"
```

### **Example 5: Batch Info**
```
"Get complete details for batch BATCH-PF500-18G-001"
```

### **Example 6: Batch History**
```
"Show me all transactions for batch BATCH-CAP-GEN-001"
```

---

## ✅ Verification Checklist

After installation, verify:

- [ ] batch-service.js in src/services/
- [ ] batch-tools.js in src/mcp/tools/
- [ ] inventory-server.js updated with 17 tools
- [ ] Test 1: Batch service loads ✅
- [ ] Test 2: FIFO selection works ✅
- [ ] Test 3: FEFO selection works ✅
- [ ] Test 4: QC status update works ✅
- [ ] Test 5: Expiring batches report works ✅
- [ ] Test 6: MCP server shows 17 tools ✅

---

## 🎓 Understanding FIFO vs FEFO

**FIFO (First In, First Out):**
- Uses **received date** as primary sort
- Oldest inventory used first
- Best for non-perishable items
- Prevents inventory aging

**FEFO (First Expired, First Out):**
- Uses **expiry date** as primary sort
- Items expiring soonest used first
- Essential for perishable items
- Minimizes waste from expiration

**Example:**
```
Batch A: Received Jan 1, Expires Mar 30
Batch B: Received Jan 5, Expires Mar 15

FIFO would pick: Batch A (received first)
FEFO would pick: Batch B (expires first)
```

---

## 📊 QC Status Flow

```
pending → in_progress → approved → available for use
                      → rejected → inventory unavailable
                      → on_hold → temporarily unavailable
```

**Status Effects:**
- `pending` / `in_progress` / `on_hold`: Inventory exists but unavailable
- `approved`: Inventory becomes available for transactions
- `rejected`: Inventory marked unavailable permanently

---

## 🐛 Troubleshooting

### **Issue: "Batch service not found"**
**Fix:** Verify batch-service.js is in src/services/

### **Issue: "No batches found"**
**Fix:** Check if batches have qc_status='approved' and status='active'

### **Issue: "MCP server shows 11 tools not 17"**
**Fix:** Verify inventory-server.js was updated with batch tools import

### **Issue: "FEFO returns empty"**
**Fix:** FEFO requires batches with expiry_date set

---

## 🎉 Success Criteria

Week 6 Day 2 is complete when:

1. ✅ All 6 batch tools available in MCP server
2. ✅ FIFO batch selection working
3. ✅ FEFO batch selection working
4. ✅ QC status updates functional
5. ✅ Expiring batches report working
6. ✅ Batch movement history accessible

---

## 📚 Next Steps

**Week 6 Day 3:** Location Management
- Zone-based location organization
- Location capacity tracking
- Location transfer workflows
- Pick path optimization

---

## 💡 Tips

- Always use FEFO for items with expiry dates
- Run expiring batches report weekly
- Approve batches promptly after QC to avoid delays
- Track batch movements for full traceability

---

**Need help?** Review the test scripts above or check the error messages for specific guidance!
