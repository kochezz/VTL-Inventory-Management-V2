// src/services/reporting-service.js
// Reporting Service - Generate Excel reports for inventory analytics
// Handles stock reports, transaction reports, batch reports, and more

const db = require('../utils/db');
const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs');

/**
 * Generate Stock Report
 * Shows current stock levels across all locations
 */
async function generateStockReport(filters = {}) {
  let query = `
    SELECT 
      p.sku,
      p.product_name,
      pc.category_name,
      wl.location_code,
      wl.location_name,
      i.quantity_on_hand,
      i.quantity_available,
      i.quantity_allocated,
      p.base_uom as uom,
      p.reorder_point,
      p.minimum_stock_level,
      CASE 
        WHEN i.quantity_on_hand <= p.minimum_stock_level THEN 'CRITICAL'
        WHEN i.quantity_on_hand <= p.reorder_point THEN 'LOW'
        ELSE 'OK'
      END as status,
      i.last_counted_date,
      p.standard_cost,
      (i.quantity_on_hand * COALESCE(p.standard_cost, 0)) as inventory_value
    FROM inventory i
    JOIN products p ON i.product_id = p.product_id
    JOIN product_categories pc ON p.category_id = pc.category_id
    JOIN warehouse_locations wl ON i.location_id = wl.location_id
    WHERE 1=1
  `;
  
  const params = [];
  let paramCount = 1;
  
  if (filters.product_sku) {
    query += ` AND p.sku = $${paramCount}`;
    params.push(filters.product_sku);
    paramCount++;
  }
  
  if (filters.location_code) {
    query += ` AND wl.location_code = $${paramCount}`;
    params.push(filters.location_code);
    paramCount++;
  }
  
  if (filters.category) {
    query += ` AND pc.category_name ILIKE $${paramCount}`;
    params.push(`%${filters.category}%`);
    paramCount++;
  }
  
  if (filters.status) {
    if (filters.status === 'CRITICAL') {
      query += ` AND i.quantity_on_hand <= p.minimum_stock_level`;
    } else if (filters.status === 'LOW') {
      query += ` AND i.quantity_on_hand <= p.reorder_point AND i.quantity_on_hand > p.minimum_stock_level`;
    }
  }
  
  query += ` ORDER BY p.sku, wl.location_code`;
  
  const result = await db.query(query, params);
  
  // Calculate summary statistics
  const summary = {
    total_items: result.rows.length,
    total_value: result.rows.reduce((sum, row) => sum + parseFloat(row.inventory_value || 0), 0),
    critical_items: result.rows.filter(r => r.status === 'CRITICAL').length,
    low_stock_items: result.rows.filter(r => r.status === 'LOW').length,
    ok_items: result.rows.filter(r => r.status === 'OK').length,
  };
  
  return {
    data: result.rows,
    summary,
    filters,
    generated_at: new Date(),
  };
}

/**
 * Generate Transaction Report
 * Shows transaction history with filters
 */
async function generateTransactionReport(filters = {}) {
  let query = `
    SELECT 
      it.transaction_number,
      it.transaction_type,
      it.transaction_date,
      p.sku,
      p.product_name,
      it.quantity,
      it.uom,
      from_loc.location_code as from_location,
      to_loc.location_code as to_location,
      b.batch_number,
      u.full_name as performed_by,
      it.reference_document_number,
      it.unit_cost,
      it.total_cost,
      it.notes
    FROM inventory_transactions it
    JOIN products p ON it.product_id = p.product_id
    LEFT JOIN warehouse_locations from_loc ON it.from_location_id = from_loc.location_id
    LEFT JOIN warehouse_locations to_loc ON it.to_location_id = to_loc.location_id
    LEFT JOIN batches b ON it.batch_id = b.batch_id
    LEFT JOIN users u ON it.performed_by = u.user_id
    WHERE 1=1
  `;
  
  const params = [];
  let paramCount = 1;
  
  if (filters.start_date) {
    query += ` AND it.transaction_date >= $${paramCount}`;
    params.push(filters.start_date);
    paramCount++;
  }
  
  if (filters.end_date) {
    query += ` AND it.transaction_date <= $${paramCount}`;
    params.push(filters.end_date);
    paramCount++;
  }
  
  if (filters.transaction_type) {
    query += ` AND it.transaction_type = $${paramCount}`;
    params.push(filters.transaction_type);
    paramCount++;
  }
  
  if (filters.product_sku) {
    query += ` AND p.sku = $${paramCount}`;
    params.push(filters.product_sku);
    paramCount++;
  }
  
  if (filters.location_code) {
    query += ` AND (from_loc.location_code = $${paramCount} OR to_loc.location_code = $${paramCount})`;
    params.push(filters.location_code);
    paramCount++;
  }
  
  query += ` ORDER BY it.transaction_date DESC LIMIT ${filters.limit || 1000}`;
  
  const result = await db.query(query, params);
  
  // Calculate summary statistics
  const summary = {
    total_transactions: result.rows.length,
    by_type: {},
    total_value: result.rows.reduce((sum, row) => sum + parseFloat(row.total_cost || 0), 0),
  };
  
  // Count by transaction type
  result.rows.forEach(row => {
    if (!summary.by_type[row.transaction_type]) {
      summary.by_type[row.transaction_type] = 0;
    }
    summary.by_type[row.transaction_type]++;
  });
  
  return {
    data: result.rows,
    summary,
    filters,
    generated_at: new Date(),
  };
}

/**
 * Generate Batch Report
 * Shows batch tracking with expiry analysis
 */
async function generateBatchReport(filters = {}) {
  let query = `
    SELECT 
      b.batch_number,
      p.sku,
      p.product_name,
      b.received_date,
      b.manufacture_date,
      b.expiry_date,
      (b.expiry_date - CURRENT_DATE) as days_until_expiry,
      b.supplier_name,
      s.supplier_code,
      b.qc_status,
      b.initial_quantity,
      b.current_quantity,
      b.uom,
      b.status,
      i.location_id,
      wl.location_code,
      wl.location_name,
      COALESCE(i.quantity_on_hand, 0) as inventory_qty
    FROM batches b
    JOIN products p ON b.product_id = p.product_id
    LEFT JOIN suppliers s ON b.supplier_id = s.supplier_id
    LEFT JOIN inventory i ON b.batch_id = i.batch_id
    LEFT JOIN warehouse_locations wl ON i.location_id = wl.location_id
    WHERE 1=1
  `;
  
  const params = [];
  let paramCount = 1;
  
  if (filters.product_sku) {
    query += ` AND p.sku = $${paramCount}`;
    params.push(filters.product_sku);
    paramCount++;
  }
  
  if (filters.qc_status) {
    query += ` AND b.qc_status = $${paramCount}`;
    params.push(filters.qc_status);
    paramCount++;
  }
  
  if (filters.status) {
    query += ` AND b.status = $${paramCount}`;
    params.push(filters.status);
    paramCount++;
  }
  
  if (filters.expiring_within_days) {
    query += ` AND b.expiry_date IS NOT NULL 
              AND b.expiry_date BETWEEN CURRENT_DATE AND (CURRENT_DATE + $${paramCount} * INTERVAL '1 day')`;
    params.push(filters.expiring_within_days);
    paramCount++;
  }
  
  query += ` ORDER BY b.expiry_date ASC NULLS LAST, b.received_date DESC`;
  
  const result = await db.query(query, params);
  
  // Calculate summary statistics
  const summary = {
    total_batches: result.rows.length,
    by_qc_status: {},
    by_status: {},
    expiring_soon: result.rows.filter(r => r.days_until_expiry !== null && r.days_until_expiry <= 30).length,
    expired: result.rows.filter(r => r.days_until_expiry !== null && r.days_until_expiry < 0).length,
  };
  
  result.rows.forEach(row => {
    if (!summary.by_qc_status[row.qc_status]) {
      summary.by_qc_status[row.qc_status] = 0;
    }
    summary.by_qc_status[row.qc_status]++;
    
    if (!summary.by_status[row.status]) {
      summary.by_status[row.status] = 0;
    }
    summary.by_status[row.status]++;
  });
  
  return {
    data: result.rows,
    summary,
    filters,
    generated_at: new Date(),
  };
}

/**
 * Generate Low Stock Report
 * Shows items below reorder point
 */
async function generateLowStockReport(filters = {}) {
  let query = `
    SELECT 
      p.sku,
      p.product_name,
      pc.category_name,
      SUM(i.quantity_on_hand) as total_quantity,
      SUM(i.quantity_available) as available_quantity,
      SUM(i.quantity_allocated) as allocated_quantity,
      p.base_uom as uom,
      p.minimum_stock_level,
      p.reorder_point,
      p.reorder_quantity,
      p.lead_time_days,
      COUNT(DISTINCT i.location_id) as location_count,
      CASE 
        WHEN SUM(i.quantity_on_hand) <= p.minimum_stock_level THEN 'CRITICAL'
        WHEN SUM(i.quantity_on_hand) <= p.reorder_point THEN 'LOW'
      END as status,
      p.standard_cost,
      (p.reorder_quantity * COALESCE(p.standard_cost, 0)) as reorder_value
    FROM products p
    JOIN product_categories pc ON p.category_id = pc.category_id
    LEFT JOIN inventory i ON p.product_id = i.product_id
    WHERE p.reorder_point IS NOT NULL
    GROUP BY p.product_id, p.sku, p.product_name, pc.category_name,
             p.base_uom, p.minimum_stock_level, p.reorder_point, 
             p.reorder_quantity, p.lead_time_days, p.standard_cost
    HAVING SUM(i.quantity_on_hand) <= p.reorder_point
  `;
  
  const params = [];
  
  if (filters.category) {
    query += ` AND pc.category_name ILIKE $1`;
    params.push(`%${filters.category}%`);
  }
  
  query += ` ORDER BY 
    CASE 
      WHEN SUM(i.quantity_on_hand) <= p.minimum_stock_level THEN 1
      ELSE 2
    END,
    SUM(i.quantity_on_hand) ASC`;
  
  const result = await db.query(query, params);
  
  // Calculate summary statistics
  const summary = {
    total_items: result.rows.length,
    critical_items: result.rows.filter(r => r.status === 'CRITICAL').length,
    low_items: result.rows.filter(r => r.status === 'LOW').length,
    total_reorder_value: result.rows.reduce((sum, row) => sum + parseFloat(row.reorder_value || 0), 0),
  };
  
  return {
    data: result.rows,
    summary,
    filters,
    generated_at: new Date(),
  };
}

/**
 * Export report to Excel
 */
async function exportToExcel(reportType, reportData) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Vilagio Inventory System';
  workbook.created = new Date();
  
  const worksheet = workbook.addWorksheet(reportType);
  
  // Define columns based on report type
  let columns = [];
  
  if (reportType === 'Stock Report') {
    columns = [
      { header: 'SKU', key: 'sku', width: 20 },
      { header: 'Product Name', key: 'product_name', width: 30 },
      { header: 'Category', key: 'category_name', width: 20 },
      { header: 'Location', key: 'location_code', width: 15 },
      { header: 'Location Name', key: 'location_name', width: 25 },
      { header: 'On Hand', key: 'quantity_on_hand', width: 12 },
      { header: 'Available', key: 'quantity_available', width: 12 },
      { header: 'Allocated', key: 'quantity_allocated', width: 12 },
      { header: 'UOM', key: 'uom', width: 10 },
      { header: 'Status', key: 'status', width: 12 },
      { header: 'Reorder Point', key: 'reorder_point', width: 15 },
      { header: 'Min Level', key: 'minimum_stock_level', width: 12 },
      { header: 'Unit Cost', key: 'standard_cost', width: 12 },
      { header: 'Value', key: 'inventory_value', width: 15 },
    ];
  } else if (reportType === 'Transaction Report') {
    columns = [
      { header: 'Transaction #', key: 'transaction_number', width: 20 },
      { header: 'Date', key: 'transaction_date', width: 20 },
      { header: 'Type', key: 'transaction_type', width: 15 },
      { header: 'SKU', key: 'sku', width: 20 },
      { header: 'Product', key: 'product_name', width: 30 },
      { header: 'Quantity', key: 'quantity', width: 12 },
      { header: 'UOM', key: 'uom', width: 10 },
      { header: 'From', key: 'from_location', width: 15 },
      { header: 'To', key: 'to_location', width: 15 },
      { header: 'Batch', key: 'batch_number', width: 20 },
      { header: 'Performed By', key: 'performed_by', width: 25 },
      { header: 'Reference', key: 'reference_document_number', width: 20 },
      { header: 'Unit Cost', key: 'unit_cost', width: 12 },
      { header: 'Total Cost', key: 'total_cost', width: 15 },
    ];
  } else if (reportType === 'Batch Report') {
    columns = [
      { header: 'Batch Number', key: 'batch_number', width: 20 },
      { header: 'SKU', key: 'sku', width: 20 },
      { header: 'Product', key: 'product_name', width: 30 },
      { header: 'Received', key: 'received_date', width: 15 },
      { header: 'Mfg Date', key: 'manufacture_date', width: 15 },
      { header: 'Expiry', key: 'expiry_date', width: 15 },
      { header: 'Days Left', key: 'days_until_expiry', width: 12 },
      { header: 'Supplier', key: 'supplier_name', width: 20 },
      { header: 'QC Status', key: 'qc_status', width: 15 },
      { header: 'Initial Qty', key: 'initial_quantity', width: 12 },
      { header: 'Current Qty', key: 'current_quantity', width: 12 },
      { header: 'UOM', key: 'uom', width: 10 },
      { header: 'Status', key: 'status', width: 12 },
      { header: 'Location', key: 'location_code', width: 15 },
    ];
  } else if (reportType === 'Low Stock Report') {
    columns = [
      { header: 'SKU', key: 'sku', width: 20 },
      { header: 'Product Name', key: 'product_name', width: 30 },
      { header: 'Category', key: 'category_name', width: 20 },
      { header: 'Total Qty', key: 'total_quantity', width: 12 },
      { header: 'Available', key: 'available_quantity', width: 12 },
      { header: 'UOM', key: 'uom', width: 10 },
      { header: 'Min Level', key: 'minimum_stock_level', width: 12 },
      { header: 'Reorder Point', key: 'reorder_point', width: 15 },
      { header: 'Reorder Qty', key: 'reorder_quantity', width: 12 },
      { header: 'Lead Time', key: 'lead_time_days', width: 12 },
      { header: 'Status', key: 'status', width: 12 },
      { header: 'Locations', key: 'location_count', width: 12 },
      { header: 'Reorder Value', key: 'reorder_value', width: 15 },
    ];
  }
  
  worksheet.columns = columns;
  
  // Style header row
  worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  worksheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF0066CC' },
  };
  worksheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };
  
  // Add data rows
  reportData.data.forEach(row => {
    const addedRow = worksheet.addRow(row);
    
    // Color code based on status
    if (row.status === 'CRITICAL') {
      addedRow.getCell('status').fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFF0000' },
      };
      addedRow.getCell('status').font = { color: { argb: 'FFFFFFFF' }, bold: true };
    } else if (row.status === 'LOW') {
      addedRow.getCell('status').fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFFA500' },
      };
    } else if (row.status === 'OK') {
      addedRow.getCell('status').fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF00FF00' },
      };
    }
  });
  
  // Add summary sheet
  const summarySheet = workbook.addWorksheet('Summary');
  summarySheet.columns = [
    { header: 'Metric', key: 'metric', width: 30 },
    { header: 'Value', key: 'value', width: 20 },
  ];
  
  summarySheet.getRow(1).font = { bold: true };
  
  // Add summary data
  Object.entries(reportData.summary).forEach(([key, value]) => {
    summarySheet.addRow({
      metric: key.replace(/_/g, ' ').toUpperCase(),
      value: typeof value === 'object' ? JSON.stringify(value) : value,
    });
  });
  
  // Generate filename
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  const filename = `${reportType.replace(/ /g, '_')}_${timestamp}.xlsx`;
  const filepath = path.join('/tmp', filename);
  
  // Write file
  await workbook.xlsx.writeFile(filepath);
  
  return {
    filename,
    filepath,
    size: fs.statSync(filepath).size,
  };
}

module.exports = {
  generateStockReport,
  generateTransactionReport,
  generateBatchReport,
  generateLowStockReport,
  exportToExcel,
};
