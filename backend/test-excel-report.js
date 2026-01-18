// test-excel-report.js
// Test Excel report generation with custom output path

const db = require('./src/utils/db');
const reportingService = require('./src/services/reporting-service');
const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs');

async function testExcelReport() {
  console.log('🧪 Testing Excel Report Generation\n');
  
  // Ensure tests directory exists
  const testsDir = 'C:\\Users\\willi\\GitHub\\VTL_Inventory_MGT\\tests';
  if (!fs.existsSync(testsDir)) {
    fs.mkdirSync(testsDir, { recursive: true });
    console.log('Created tests directory:', testsDir);
  }
  
  // Generate report data
  console.log('Generating report data...');
  const reportData = await reportingService.generateStockReport({});
  console.log('Report data generated:', reportData.data.length, 'items');
  
  // Create workbook
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Vilagio Inventory System';
  workbook.created = new Date();
  
  const worksheet = workbook.addWorksheet('Stock Report');
  
  // Define columns
  worksheet.columns = [
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
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 10);
  const filename = `Stock_Report_${timestamp}.xlsx`;
  const filepath = path.join(testsDir, filename);
  
  // Write file
  console.log('\nWriting Excel file...');
  await workbook.xlsx.writeFile(filepath);
  
  const stats = fs.statSync(filepath);
  
  console.log('\n✅ Excel File Generated Successfully!');
  console.log('  Filename:', filename);
  console.log('  Filepath:', filepath);
  console.log('  Size:', (stats.size / 1024).toFixed(2), 'KB');
  console.log('  Records:', reportData.data.length);
  console.log('\n📊 Summary:');
  console.log('  Total Items:', reportData.summary.total_items);
  console.log('  Critical:', reportData.summary.critical_items);
  console.log('  Low Stock:', reportData.summary.low_stock_items);
  console.log('  OK:', reportData.summary.ok_items);
  console.log('  Total Value: $', reportData.summary.total_value.toFixed(2));
  
  await db.closePool();
}

// Run the test
testExcelReport().catch(err => {
  console.error('❌ Error:', err.message);
  console.error(err.stack);
  process.exit(1);
});