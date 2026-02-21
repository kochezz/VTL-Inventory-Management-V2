// ============================================================================
// PRODUCTION REPORTING SERVICE - GMP Compliant & Modern PDF Layout
// ============================================================================

const PDFDocument = require('pdfkit');
const fs = require('fs');
const { pool } = require('../config/database');

const generateBatchProductionReport = async (batchId) => {
  try {
    // 1. Fetch Batch Main Info
    const batchQuery = `
      SELECT 
        pb.batch_id, pb.batch_number, pb.batch_record_code, pb.product_id,
        COALESCE(pb.product_name, p.product_name) as product_name,
        COALESCE(p.sku, 'N/A') as sku,
        pb.production_date, pb.production_line, pb.shift, pb.planned_quantity,
        pb.actual_output, pb.rejected_bottles, pb.yield_percentage, pb.status,
        pb.line_supervisor_name, pb.created_at, pb.production_started_at, pb.production_completed_at
      FROM production_batches pb
      LEFT JOIN products p ON pb.product_id = p.product_id
      WHERE pb.batch_id = $1
    `;
    const batchResult = await pool.query(batchQuery, [batchId]);
    if (batchResult.rows.length === 0) throw new Error('Batch not found');
    const batch = batchResult.rows[0];

    // 2. Fetch BOM Components Used
    const componentsQuery = `
      SELECT component_name, supplier_batch_lot, quantity_required, planned_quantity, actual_consumed, material_status
      FROM batch_components WHERE batch_id = $1 ORDER BY component_name
    `;
    const componentsResult = await pool.query(componentsQuery, [batchId]);

    // 3. Fetch IPQC Records (NOW SELECTING ALL COLUMNS FOR DETAILS)
    const ipqcQuery = `
      SELECT * FROM batch_ipqc_records WHERE batch_id = $1 ORDER BY check_sequence ASC
    `;
    const ipqcResult = await pool.query(ipqcQuery, [batchId]);

    // 4. Fetch QA Gates (Sign-offs)
    const qaGatesQuery = `
      SELECT gate_number, gate_name, status, approved_by_name, approved_at, rejection_reason
      FROM qa_gates WHERE batch_id = $1 ORDER BY gate_number ASC
    `;
    const qaGatesResult = await pool.query(qaGatesQuery, [batchId]);

    return {
      batch,
      components: componentsResult.rows,
      ipqc_records: ipqcResult.rows,
      qa_gates: qaGatesResult.rows,
      generated_at: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error in generateBatchProductionReport:', error);
    throw error;
  }
};

const exportBatchProductionReportToPDF = async (batchId, logoPath) => {
  const data = await generateBatchProductionReport(batchId);
  const { batch, components, ipqc_records, qa_gates } = data;

  return new Promise((resolve, reject) => {
    try {
      // ENABLE BUFFER PAGES: This allows us to add footers to all pages at the end
      const doc = new PDFDocument({ margin: 40, size: 'A4', bufferPages: true });
      const buffers = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve(Buffer.concat(buffers)));

      let currentY = 40;

      // Helper: Page Break Checker (Leaves room for footer)
      const checkPageBreak = (neededSpace) => {
        if (currentY + neededSpace > 750) {
          doc.addPage();
          currentY = 40;
          return true;
        }
        return false;
      };

      // Helper: Format Booleans
      const formatVal = (val) => {
        if (val === true) return 'Pass / Yes';
        if (val === false) return 'Fail / No';
        return val;
      };

      // =========================================================================
      // 1. HEADER & STATUS BAND
      // =========================================================================
      doc.rect(0, 0, 600, 6).fill('#3B82F6'); 
      
      try {
        if (logoPath && fs.existsSync(logoPath)) {
          doc.image(logoPath, 40, currentY, { height: 35 });
        }
      } catch (e) {}

      doc.fillColor('#0F172A').font('Helvetica-Bold').fontSize(22).text('BATCH PRODUCTION RECORD', 40, currentY + 45);
      doc.fillColor('#64748B').font('Helvetica').fontSize(10).text(`Generated: ${new Date().toLocaleString()}`, 40, currentY + 70);

      const statusColor = batch.status === 'released' ? '#10B981' : (batch.status === 'rejected' ? '#EF4444' : '#F59E0B');
      doc.rect(430, currentY + 45, 125, 24).fill(statusColor);
      doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(11).text(batch.status.toUpperCase().replace('_', ' '), 430, currentY + 52, { width: 125, align: 'center' });

      currentY += 110;

      // =========================================================================
      // 2. HERO SECTION: FULL-WIDTH PRODUCT HIGHLIGHT
      // =========================================================================
      doc.rect(40, currentY, 515, 70).fill('#F8FAFC').stroke('#E2E8F0');
      doc.lineWidth(1).strokeColor('#E2E8F0').stroke();

      doc.fillColor('#0F172A').font('Helvetica-Bold').fontSize(16);
      doc.text(batch.product_name || 'Unknown Product', 55, currentY + 15, { width: 485 }); 
      
      doc.fillColor('#475569').font('Helvetica').fontSize(10);
      doc.text(`Batch #: ${batch.batch_number}    |    SKU: ${batch.sku}    |    Date: ${new Date(batch.production_date).toLocaleDateString()}`, 55, currentY + 45);

      currentY += 85;

      // =========================================================================
      // 3. KPI DASHBOARD BOXES
      // =========================================================================
      const kpiY = currentY;
      
      doc.rect(40, kpiY, 160, 55).fill('#F1F5F9');
      doc.fillColor('#64748B').font('Helvetica').fontSize(10).text('Planned Quantity', 55, kpiY + 12);
      doc.fillColor('#0F172A').font('Helvetica-Bold').fontSize(18).text(`${(batch.planned_quantity || 0).toLocaleString()}`, 55, kpiY + 30);

      doc.rect(215, kpiY, 165, 55).fill('#EFF6FF');
      doc.fillColor('#2563EB').font('Helvetica-Bold').fontSize(10).text('Actual Output (Good Units)', 230, kpiY + 12);
      doc.font('Helvetica-Bold').fontSize(18).text(`${(batch.actual_output || 0).toLocaleString()}`, 230, kpiY + 30);

      const yieldVal = parseFloat(batch.yield_percentage || 100);
      doc.rect(395, kpiY, 160, 55).fill(yieldVal >= 95 ? '#ECFDF5' : '#FEF2F2');
      doc.fillColor(yieldVal >= 95 ? '#059669' : '#DC2626').font('Helvetica-Bold').fontSize(10).text('Production Yield', 410, kpiY + 12);
      doc.font('Helvetica-Bold').fontSize(18).text(`${yieldVal.toFixed(1)}%`, 410, kpiY + 30);

      currentY += 80;

      // =========================================================================
      // HELPER: HTML-STYLE TABLE DRAWING
      // =========================================================================
      const drawTable = (title, headers, rows, colWidths) => {
        checkPageBreak(100);
        
        doc.fillColor('#0F172A').font('Helvetica-Bold').fontSize(14).text(title, 40, currentY);
        currentY += 20;

        doc.rect(40, currentY, 515, 22).fill('#1E293B');
        doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(9);
        let curX = 50;
        headers.forEach((h, i) => {
          doc.text(h, curX, currentY + 6, { width: colWidths[i] });
          curX += colWidths[i] + 10;
        });
        currentY += 22;

        doc.font('Helvetica').fontSize(9);
        rows.forEach((row, rowIndex) => {
          let maxRowHeight = 20;
          row.forEach((cell, i) => {
            const h = doc.heightOfString(cell ? String(cell) : '', { width: colWidths[i] });
            if (h > maxRowHeight) maxRowHeight = h;
          });
          const rowHeight = maxRowHeight + 10; 

          checkPageBreak(rowHeight + 10);

          if (rowIndex % 2 === 0) {
            doc.rect(40, currentY, 515, rowHeight).fill('#F8FAFC');
          } else {
            doc.rect(40, currentY, 515, rowHeight).fill('#FFFFFF');
          }

          doc.fillColor('#334155');
          curX = 50;
          row.forEach((cell, i) => {
            doc.text(cell ? String(cell) : '-', curX, currentY + 5, { width: colWidths[i] });
            curX += colWidths[i] + 10;
          });

          doc.moveTo(40, currentY + rowHeight).lineTo(555, currentY + rowHeight).lineWidth(0.5).strokeColor('#E2E8F0').stroke();
          currentY += rowHeight;
        });

        currentY += 25; 
      };

      // =========================================================================
      // 4. BILL OF MATERIALS TABLE
      // =========================================================================
      if (components && components.length > 0) {
        const compHeaders = ['Component Name', 'Supplier Lot #', 'Required', 'Consumed'];
        const compWidths = [200, 115, 80, 80];
        const compRows = components.map(c => [
          c.component_name, 
          c.supplier_batch_lot || 'N/A', 
          c.planned_quantity || c.quantity_required || 0, 
          c.actual_consumed || c.planned_quantity || 0
        ]);
        drawTable('Component Traceability', compHeaders, compRows, compWidths);
      }

      // =========================================================================
      // 5. DETAILED IPQC RECORDS (FULLY RESTORED & BEAUTIFIED)
      // =========================================================================
      if (ipqc_records && ipqc_records.length > 0) {
        checkPageBreak(50);
        doc.fillColor('#0F172A').font('Helvetica-Bold').fontSize(14).text('Detailed In-Process Quality Checks (IPQC)', 40, currentY);
        currentY += 20;

        ipqc_records.forEach((record) => {
          checkPageBreak(120); // Need chunk of space for a record box

          // Stage Header Bar
          doc.rect(40, currentY, 515, 24).fill('#F1F5F9');
          doc.fillColor('#0F172A').font('Helvetica-Bold').fontSize(10);
          doc.text(`Stage ${record.stage_sequence}: ${record.stage_name}`, 48, currentY + 7);
          
          // Status Pill (Right side)
          const isApproved = record.qa_status.includes('approved');
          doc.fillColor(isApproved ? '#059669' : '#DC2626').text(
            record.qa_status.replace('_', ' ').toUpperCase(), 
            400, currentY + 7, { width: 145, align: 'right' }
          );
          currentY += 30;

          // Meta Info
          doc.fillColor('#64748B').font('Helvetica').fontSize(9);
          doc.text(`Recorded: ${new Date(record.check_time).toLocaleString()}   |   Operator: ${record.operator_name}`, 48, currentY);
          if (record.qa_reviewed_by_name) {
             doc.text(`QA Review: ${record.qa_reviewed_by_name} (${new Date(record.qa_reviewed_at).toLocaleString()})`, 48, currentY + 12);
          }
          currentY += 25;

          // Parameter Grid Parsing
          let custom = {};
          if (record.stage_custom_data) {
            try { custom = typeof record.stage_custom_data === 'string' ? JSON.parse(record.stage_custom_data) : record.stage_custom_data; } catch(e){}
          }

          const details = [];
          const addD = (k, v) => { if (v !== null && v !== undefined && v !== '') details.push({k, v: formatVal(v)}); };

          // Stage Specific Field Logic
          if (record.stage_code === 'WATER_TREATMENT' || record.stage_code === 'PRE_PRODUCTION') {
            addD('Water Source', record.water_source); addD('Raw Water pH', record.raw_water_ph);
            addD('RO Conductivity', record.ro_conductivity ? `${record.ro_conductivity} µS/cm` : null);
            addD('UV Status', record.uv_system_status); addD('Ozone Status', record.ozone_system_status);
            addD('Ozone Residual', record.ozone_residual_ppm ? `${record.ozone_residual_ppm} ppm` : null);
            addD('Treatment Approved', record.water_treatment_approved);
          } else if (record.stage_code === 'BOTTLE_BLOW') {
            addD('Visual Inspection', record.visual_inspection_pass); addD('Bottle Integrity', record.bottle_integrity);
            addD('Equipment Cleaned', record.equipment_cleaned);
          } else if (record.stage_code === 'FILLING') {
            addD('Fill Volume', record.fill_volume_ml ? `${record.fill_volume_ml} ml` : null);
            addD('Volume in Spec', record.fill_volume_within_spec); addD('Fill Pressure', record.fill_pressure ? `${record.fill_pressure} MPa` : null);
            addD('Fill Temp', record.fill_temperature ? `${record.fill_temperature} °C` : null);
          } else if (record.stage_code === 'CAPPING') {
            addD('Cap Torque', record.cap_torque_nm ? `${record.cap_torque_nm} Nm` : null); addD('Torque in Spec', record.cap_torque_within_spec);
          } else if (record.stage_code === 'LABELING') {
            addD('Visual Inspection', record.visual_inspection_pass); addD('Label Position', record.label_position_correct);
            addD('Bottle Integrity', record.bottle_integrity); addD('Seal Integrity', record.seal_integrity);
          } else if (record.stage_code === 'CODING') {
            addD('Coding Legible', record.coding_legible); addD('Tamper Evidence', record.tamper_evidence);
          } else if (record.stage_code === 'SHRINK_SEAL') {
            addD('Tamper Sticker', custom.tamper_sticker_applied); addD('Shrink Sleeve', custom.shrink_sleeve_applied);
            addD('Expiry Etched', custom.expiry_date_etched); addD('Expiry Legible', custom.expiry_date_legible);
            addD('Seal Appearance', custom.seal_appearance);
          } else if (record.stage_code === 'WASHING') {
            addD('External Wash', custom.external_wash_complete); addD('Internal Wash', custom.internal_wash_complete);
            addD('Sterilant Wash', custom.sterilant_wash_complete); addD('Rinse Temp', custom.rinse_temperature ? `${custom.rinse_temperature}°C` : null);
            addD('Bottles Clean', custom.bottles_visually_clean);
          } else if (record.stage_code === 'RETURNED_BOTTLE_INSPECTION') {
            addD('Exterior Clean', custom.exterior_clean); addD('No Cracks', custom.no_cracks_damage);
            addD('Cap Threads Intact', custom.cap_threads_intact); addD('Bottles Acceptable', custom.bottles_acceptable);
          }

          // Draw Details Grid (2 Columns)
          let col = 0;
          details.forEach((d) => {
            const x = 48 + (col * 250);
            doc.font('Helvetica-Bold').fillColor('#475569').text(`${d.k}:`, x, currentY);
            doc.font('Helvetica').fillColor('#0F172A').text(d.v, x + 110, currentY);
            
            col++;
            if (col > 1) { col = 0; currentY += 15; checkPageBreak(40); }
          });
          if (col > 0) currentY += 15;

          // Notes Section
          const notes = record.notes || record.visual_inspection_notes || record.water_treatment_notes;
          if (notes) {
            currentY += 5;
            doc.font('Helvetica-Oblique').fillColor('#64748B').text(`Notes: ${notes}`, 48, currentY, { width: 490 });
            currentY += doc.heightOfString(`Notes: ${notes}`, { width: 490 }) + 5;
          }

          // Bottom border of block
          currentY += 10;
          doc.moveTo(40, currentY).lineTo(555, currentY).lineWidth(0.5).strokeColor('#CBD5E1').stroke();
          currentY += 15;
        });
      }

      // =========================================================================
      // 6. QA GATES & 21 CFR PART 11 SIGNATURES
      // =========================================================================
      if (qa_gates && qa_gates.length > 0) {
        const qaHeaders = ['Quality Gate', 'Status', 'Digitally Signed By', 'Date/Time'];
        const qaWidths = [140, 80, 130, 125];
        const qaRows = qa_gates.map(g => [
          g.gate_name,
          g.status.toUpperCase(),
          g.approved_by_name || 'Pending',
          g.approved_at ? new Date(g.approved_at).toLocaleString() : '-'
        ]);
        drawTable('Final Quality Assurance Approvals', qaHeaders, qaRows, qaWidths);
      }

      // =========================================================================
      // 7. COMPLIANCE STATEMENT
      // =========================================================================
      checkPageBreak(60);
      doc.rect(40, currentY, 515, 50).fill('#F8FAFC').stroke('#CBD5E1');
      doc.lineWidth(1).strokeColor('#CBD5E1').stroke();
      
      doc.fillColor('#0F172A').font('Helvetica-Oblique').fontSize(9);
      doc.text('Compliance Statement:', 50, currentY + 10);
      doc.fillColor('#64748B').font('Helvetica').fontSize(8);
      doc.text(
        'This batch record was generated electronically. Actions recorded herein, including QA Approvals and IPQC records, are secured by encrypted passwords serving as legally binding Electronic Signatures in accordance with 21 CFR Part 11 and GMP guidelines.', 
        50, currentY + 22, { width: 495, align: 'justify' }
      );

      // =========================================================================
      // 8. GLOBAL FOOTERS (Applied to every page!)
      // =========================================================================
      const pages = doc.bufferedPageRange();
      for (let i = 0; i < pages.count; i++) {
        doc.switchToPage(i);
        
        // FIX: Temporarily remove the bottom margin so writing the footer doesn't trigger a new page!
        const oldBottomMargin = doc.page.margins.bottom;
        doc.page.margins.bottom = 0;
        
        // Draw Footer Divider Line
        doc.moveTo(40, 795).lineTo(555, 795).lineWidth(1).strokeColor('#E2E8F0').stroke();
        
        // Footer Text
        doc.fillColor('#64748B').font('Helvetica-Bold').fontSize(8);
        doc.text(`BATCH: ${batch.batch_number}`, 40, 805, { lineBreak: false });
        doc.font('Helvetica').text(`PRODUCT: ${batch.product_name || 'N/A'}`, 180, 805, { lineBreak: false });
        
        // Page Numbers
        doc.text(`Page ${i + 1} of ${pages.count}`, 40, 805, { width: 515, align: 'right', lineBreak: false });
        
        // Final GMP note
        doc.fillColor('#94A3B8').fontSize(7);
        doc.text('CONFIDENTIAL - OFFICIAL PRODUCTION RECORD', 40, 818, { width: 515, align: 'center', lineBreak: false });

        // Restore margin
        doc.page.margins.bottom = oldBottomMargin;
      }

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
};

const generateProductionSummaryReport = async (filters) => {
  try {
    let query = `
      SELECT 
        COUNT(*) as total_batches,
        COALESCE(SUM(planned_quantity), 0) as total_planned,
        COALESCE(SUM(actual_output), 0) as total_output,
        COALESCE(SUM(rejected_bottles), 0) as total_rejected
      FROM production_batches
      WHERE 1=1
    `;
    const params = [];
    let paramCount = 1;

    if (filters.status) {
      query += ` AND status = $${paramCount}`;
      params.push(filters.status);
      paramCount++;
    }
    if (filters.start_date) {
      query += ` AND production_date >= $${paramCount}`;
      params.push(filters.start_date);
      paramCount++;
    }
    if (filters.end_date) {
      query += ` AND production_date <= $${paramCount}`;
      params.push(filters.end_date);
      paramCount++;
    }

    const result = await pool.query(query, params);
    return {
      filters,
      summary: result.rows[0]
    };
  } catch (error) {
    console.error('Error in generateProductionSummaryReport:', error);
    throw error;
  }
};

module.exports = {
  generateBatchProductionReport,
  exportBatchProductionReportToPDF,
  generateProductionSummaryReport
};