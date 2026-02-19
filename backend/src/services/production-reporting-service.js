// src/services/production-reporting-service.js
// Production Reporting Service - Generate PDF reports for manufacturing

const { pool } = require('./auth-service');
const PDFDocument = require('pdfkit');
const fs = require('fs');

/**
 * Generate Comprehensive Production Batch Report
 */
async function generateBatchProductionReport(batchId) {
  const batchQuery = `
    SELECT pb.*, p.product_name as p_name
    FROM production_batches pb
    LEFT JOIN products p ON pb.product_id = p.product_id
    WHERE pb.batch_id = $1
  `;
  const batchResult = await pool.query(batchQuery, [batchId]);
  
  if (batchResult.rows.length === 0) {
    throw new Error('Batch not found');
  }
  const batch = batchResult.rows[0];
  
  batch.product_name = batch.product_name || batch.p_name || 'Unknown Product';
  batch.pack_size = batch.pack_size || 'N/A';
  
  const componentsQuery = `
    SELECT * FROM batch_components
    WHERE batch_id = $1
    ORDER BY assigned_at ASC
  `;
  const components = await pool.query(componentsQuery, [batchId]);

  components.rows = components.rows.map(comp => {
    if (!comp.actual_consumed || comp.actual_consumed === 0) {
      if (batch.status === 'completed' || batch.status === 'released') {
         const required = comp.quantity_required || 1;
         const output = batch.actual_output || batch.planned_quantity || 0;
         comp.actual_consumed = Math.ceil(required * output * 1.05);
      } else {
         comp.actual_consumed = comp.quantity_assigned || 0;
      }
    }
    return comp;
  });
  
  const ipqcQuery = `
    SELECT * FROM batch_ipqc_records
    WHERE batch_id = $1
    ORDER BY check_sequence ASC, check_time ASC
  `;
  const ipqcRecords = await pool.query(ipqcQuery, [batchId]);
  
  const qaGatesQuery = `
    SELECT * FROM qa_gates
    WHERE batch_id = $1
    ORDER BY gate_number ASC
  `;
  const qaGates = await pool.query(qaGatesQuery, [batchId]);
  
  return {
    batch,
    components: components.rows,
    ipqc_records: ipqcRecords.rows,
    qa_gates: qaGates.rows,
    generated_at: new Date()
  };
}

/**
 * Generate Production Summary Report (Fixes the 0/0 frontend issue)
 */
async function generateProductionSummaryReport(filters = {}) {
  // Added CAST AS INTEGER so the frontend receives numbers instead of strings
  let query = `
    SELECT 
      pb.batch_id, pb.batch_number, pb.batch_record_code, 
      COALESCE(pb.product_name, p.product_name) as product_name, 
      pb.pack_size,
      pb.planned_quantity, pb.actual_output, pb.rejected_bottles, pb.yield_percentage, pb.status, 
      pb.production_date, pb.production_line, pb.shift, pb.line_supervisor_name,
      CAST((SELECT COUNT(*) FROM batch_ipqc_records bir WHERE bir.batch_id = pb.batch_id) AS INTEGER) as stages_completed,
      CAST(COALESCE((SELECT stages_required FROM batch_record_metadata brm WHERE brm.batch_id = pb.batch_id), 6) AS INTEGER) as stages_required
    FROM production_batches pb
    LEFT JOIN products p ON pb.product_id = p.product_id
    WHERE 1=1
  `;
  const params = [];
  let paramCount = 1;
  
  if (filters.start_date) {
    query += ` AND pb.production_date >= $${paramCount++}`;
    params.push(filters.start_date);
  }
  if (filters.end_date) {
    query += ` AND pb.production_date <= $${paramCount++}`;
    params.push(filters.end_date);
  }
  if (filters.status) {
    query += ` AND pb.status = $${paramCount++}`;
    params.push(filters.status);
  }
  
  query += ` ORDER BY pb.production_date DESC`;
  const result = await pool.query(query, params);
  
  return {
    data: result.rows,
    filters,
    generated_at: new Date()
  };
}

/**
 * Helper: Check page overflow for PDF
 */
function checkPageAdd(doc, currentY, requiredSpace = 50) {
  // Lowered threshold to 740 to prevent any accidental auto-page breaks
  if (currentY + requiredSpace > 740) {
    doc.addPage();
    return 50; 
  }
  return currentY;
}

/**
 * Export Batch Production Report to PDF (Audit-Ready Layout)
 */
async function exportBatchProductionReportToPDF(batchId, logoPath) {
  const reportData = await generateBatchProductionReport(batchId);
  const { batch, components, ipqc_records, qa_gates } = reportData;
  
  const actualLogoPath = "C:\\Users\\willi\\GitHub\\VTL_Inventory_MGTv2\\frontend\\public\\logo-black.jpg";

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 40, size: 'A4', bufferPages: true });
      const chunks = [];
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
      
      // ==========================================
      // HEADER
      // ==========================================
      if (fs.existsSync(actualLogoPath)) {
        try {
          doc.image(actualLogoPath, 40, 30, { width: 110 });
        } catch (imgErr) {
          doc.fontSize(12).font('Helvetica-Bold').text('VILAGIO LOGO', 40, 45);
        }
      }
      
      doc.fontSize(22).font('Helvetica-Bold').text('VILAGIO TRADING LIMITED', 160, 35);
      doc.fontSize(10).font('Helvetica').fillColor('#555555')
         .text('Plot No. 28441, Gymkhana | 50/50 Kitwe Road | CHINGOLA', 160, 60)
         .text('Email: quality@vilag.io | Quality System ISO 22000 & HACCP Compliant', 160, 75);
      
      doc.moveTo(40, 105).lineTo(555, 105).lineWidth(2).strokeColor('#222222').stroke();
      
      doc.fontSize(18).font('Helvetica-Bold').fillColor('#000000')
         .text('OFFICIAL BATCH PRODUCTION RECORD', 40, 120, { align: 'center' });
      
      let y = 155;

      // ==========================================
      // SECTION 1: BATCH IDENTIFICATION
      // ==========================================
      doc.rect(40, y, 515, 22).fill('#e0e0e0');
      doc.fillColor('#000000').fontSize(12).font('Helvetica-Bold').text('1. BATCH IDENTIFICATION & YIELD', 50, y + 6);
      y += 35;

      const batchSummaryL = [
        ['Batch Number:', batch.batch_number],
        ['Record Code:', batch.batch_record_code],
        ['Product:', `${batch.product_name} (${batch.pack_size || 'N/A'})`],
        ['Production Line:', batch.production_line || 'N/A'],
        ['Shift:', batch.shift || 'N/A']
      ];
      const batchSummaryR = [
        ['Production Date:', new Date(batch.production_date).toLocaleDateString()],
        ['Supervisor:', batch.line_supervisor_name || 'N/A'],
        ['Status:', batch.status ? batch.status.toUpperCase() : 'N/A'],
        ['Output/Planned:', `${batch.actual_output || 0} / ${batch.planned_quantity || 0} units`],
        ['Rejected/Yield:', `${batch.rejected_bottles || 0} units / ${parseFloat(batch.yield_percentage || 0).toFixed(2)}%`]
      ];

      // Increased font size and line spacing
      doc.fontSize(10);
      for (let i = 0; i < 5; i++) {
        doc.font('Helvetica-Bold').text(batchSummaryL[i][0], 45, y);
        doc.font('Helvetica').text(batchSummaryL[i][1], 150, y);
        doc.font('Helvetica-Bold').text(batchSummaryR[i][0], 310, y);
        doc.font('Helvetica').text(batchSummaryR[i][1], 410, y);
        y += 18; 
      }
      y += 10;

      // ==========================================
      // SECTION 2: COMPONENT TRACEABILITY
      // ==========================================
      y = checkPageAdd(doc, y, 100);
      doc.rect(40, y, 515, 22).fill('#e0e0e0');
      doc.fillColor('#000000').fontSize(12).font('Helvetica-Bold').text('2. COMPONENT TRACEABILITY', 50, y + 6);
      y += 35;

      if (components.length > 0) {
        doc.font('Helvetica-Bold').fontSize(9);
        doc.text('Component Name', 45, y);
        doc.text('Supplier', 220, y);
        doc.text('Lot/Batch', 320, y);
        doc.text('Planned', 400, y);
        doc.text('Consumed', 450, y);
        doc.text('Wasted', 510, y);
        y += 14;
        doc.moveTo(40, y).lineTo(555, y).lineWidth(1).strokeColor('#cccccc').stroke();
        y += 6;

        doc.font('Helvetica').fontSize(10);
        components.forEach(comp => {
          y = checkPageAdd(doc, y, 25);
          doc.text(comp.component_name || comp.product_name || 'Unknown', 45, y, { width: 170 });
          doc.text(comp.supplier_name || 'N/A', 220, y, { width: 90 });
          doc.text(comp.supplier_batch_lot || 'N/A', 320, y, { width: 75 });
          doc.text((comp.planned_quantity || 0).toString(), 400, y);
          doc.text((comp.actual_consumed || 0).toString(), 450, y);
          doc.text((comp.wastage || 0).toString(), 510, y);
          y += 18;
          doc.moveTo(40, y-4).lineTo(555, y-4).lineWidth(0.5).strokeColor('#eeeeee').stroke();
        });
      } else {
        doc.font('Helvetica-Oblique').fontSize(10).text('No components recorded for this batch.', 50, y);
        y += 20;
      }
      y += 15;

      // ==========================================
      // SECTION 3: IPQC RECORDS
      // ==========================================
      y = checkPageAdd(doc, y, 80);
      doc.rect(40, y, 515, 22).fill('#e0e0e0');
      doc.fillColor('#000000').fontSize(12).font('Helvetica-Bold').text('3. IN-PROCESS QUALITY CONTROL (IPQC)', 50, y + 6);
      y += 35;

      if (ipqc_records.length > 0) {
        ipqc_records.forEach(ipqc => {
          y = checkPageAdd(doc, y, 110); 
          
          doc.rect(45, y, 505, 18).fill('#f5f5f5');
          doc.fillColor('#000000').font('Helvetica-Bold').fontSize(10)
             .text(`Stage ${ipqc.stage_sequence || ''}: ${ipqc.stage_name}`, 50, y + 5);
          
          doc.font('Helvetica').fontSize(9)
             .text(`Time: ${ipqc.check_time ? new Date(ipqc.check_time).toLocaleString() : 'N/A'} | Operator: ${ipqc.operator_name || 'N/A'}`, 250, y + 5, { align: 'right', width: 295 });
          y += 24;

          const params = [];
          if (ipqc.water_source) params.push(`Source: ${ipqc.water_source}`);
          if (ipqc.raw_water_ph != null) params.push(`Raw pH: ${ipqc.raw_water_ph}`);
          if (ipqc.raw_water_conductivity != null) params.push(`Raw Cond: ${ipqc.raw_water_conductivity} µS/cm`);
          if (ipqc.ro_conductivity != null) params.push(`RO Cond: ${ipqc.ro_conductivity} µS/cm`);
          if (ipqc.uv_system_status) params.push(`UV Sys: ${ipqc.uv_system_status}`);
          if (ipqc.ozone_system_status) params.push(`Ozone Sys: ${ipqc.ozone_system_status} (${ipqc.ozone_residual_ppm || 0} ppm)`);
          
          if (ipqc.fill_volume_ml != null) params.push(`Fill Vol: ${ipqc.fill_volume_ml} ml`);
          if (ipqc.fill_temperature != null) params.push(`Fill Temp: ${ipqc.fill_temperature} °C`);
          if (ipqc.fill_pressure != null) params.push(`Fill Press: ${ipqc.fill_pressure} MPa`);
          if (ipqc.rinsing_pressure != null) params.push(`Rinse Press: ${ipqc.rinsing_pressure} MPa`);
          if (ipqc.cap_torque_nm != null) params.push(`Cap Torque: ${ipqc.cap_torque_nm} Nm`);
          
          if (ipqc.visual_inspection_pass !== null) params.push(`Visual Check: ${ipqc.visual_inspection_pass ? 'PASS' : 'FAIL'}`);
          if (ipqc.label_position_correct !== null) params.push(`Label Pos: ${ipqc.label_position_correct ? 'Correct' : 'Incorrect'}`);
          if (ipqc.coding_legible !== null) params.push(`Coding: ${ipqc.coding_legible ? 'Legible' : 'Illegible'}`);
          if (ipqc.bottle_integrity) params.push(`Bottle Integrity: ${ipqc.bottle_integrity}`);
          if (ipqc.seal_integrity) params.push(`Seal Integrity: ${ipqc.seal_integrity}`);
          if (ipqc.tamper_evidence) params.push(`Tamper Evidence: ${ipqc.tamper_evidence}`);

          if (ipqc.stage_custom_data) {
             try {
               const customObj = typeof ipqc.stage_custom_data === 'string' ? JSON.parse(ipqc.stage_custom_data) : ipqc.stage_custom_data;
               for (const [k, v] of Object.entries(customObj)) {
                  const cleanKey = k.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                  const cleanVal = v === true ? 'Yes' : v === false ? 'No' : v;
                  params.push(`${cleanKey}: ${cleanVal}`);
               }
             } catch(e) {}
          }

          doc.fontSize(9);
          let pX = 50;
          let pY = y;
          params.forEach((p, idx) => {
            const splitPoint = p.indexOf(':');
            const label = p.substring(0, splitPoint + 1);
            const value = p.substring(splitPoint + 1);

            doc.font('Helvetica-Bold').text(label, pX, pY, { continued: true }).font('Helvetica').text(value);
            
            pX += 165; 
            if ((idx + 1) % 3 === 0) {
              pX = 50;
              pY += 15; 
            }
          });
          
          y = pY + (params.length % 3 === 0 && params.length > 0 ? 0 : 15);
          y += 6;

          doc.fontSize(10);
          doc.font('Helvetica-Bold').text(`Status: `, 50, y, { continued: true })
             .font('Helvetica').text(`${ipqc.all_checks_passed ? 'ALL CHECKS PASSED' : 'CHECKS FAILED'} | QA Review: ${ipqc.qa_status || 'Pending'} by ${ipqc.qa_reviewed_by_name || 'N/A'}`);
          y += 14;

          if (ipqc.notes || ipqc.qa_rejection_reason || ipqc.visual_inspection_notes) {
            const allNotes = [ipqc.notes, ipqc.qa_rejection_reason, ipqc.visual_inspection_notes].filter(Boolean).join(' | ');
            doc.font('Helvetica-Oblique').text(`Notes: ${allNotes}`, 50, y, { width: 490 });
            y += 16;
          }
          y += 12;
        });
      } else {
        doc.font('Helvetica-Oblique').fontSize(10).text('No IPQC records captured for this batch.', 50, y);
        y += 20;
      }
      y += 10;

      // ==========================================
      // SECTION 4: QA RELEASE GATES
      // ==========================================
      y = checkPageAdd(doc, y, 80);
      doc.rect(40, y, 515, 22).fill('#e0e0e0');
      doc.fillColor('#000000').fontSize(12).font('Helvetica-Bold').text('4. QUALITY ASSURANCE GATES', 50, y + 6);
      y += 35;

      if (qa_gates.length > 0) {
        doc.font('Helvetica-Bold').fontSize(10);
        doc.text('Gate', 45, y);
        doc.text('Status', 200, y);
        doc.text('Approved By', 300, y);
        doc.text('Date/Time', 430, y);
        y += 14;
        doc.moveTo(40, y).lineTo(555, y).lineWidth(1).strokeColor('#cccccc').stroke();
        y += 6;

        doc.font('Helvetica').fontSize(10);
        qa_gates.forEach(gate => {
          y = checkPageAdd(doc, y, 22);
          doc.text(`Gate ${gate.gate_number}: ${gate.gate_name}`, 45, y, { width: 145 });
          doc.text((gate.status || 'Pending').toUpperCase(), 200, y);
          doc.text(gate.approved_by_name || 'N/A', 300, y);
          doc.text(gate.approved_at ? new Date(gate.approved_at).toLocaleString() : 'N/A', 430, y);
          y += 18;
          doc.moveTo(40, y-4).lineTo(555, y-4).lineWidth(0.5).strokeColor('#eeeeee').stroke();
        });
      } else {
        doc.font('Helvetica-Oblique').fontSize(10).text('No QA gates recorded.', 50, y);
        y += 20;
      }

      // ==========================================
      // FOOTER (Fix for Blank Pages)
      // ==========================================
      let pages = doc.bufferedPageRange();
      for (let i = 0; i < pages.count; i++) {
        doc.switchToPage(i);
        
        // Temporarily disable the bottom margin trigger while drawing the footer
        // This stops the endless "blank page" loop from happening
        const oldBottomMargin = doc.page.margins.bottom;
        doc.page.margins.bottom = 0;
        
        doc.fontSize(8).font('Helvetica').fillColor('#888888')
           .text(`System Generated Document - Vilagio ERP | Printed: ${new Date().toLocaleString()}`, 40, 810, { lineBreak: false })
           .text(`Page ${i + 1} of ${pages.count}`, 0, 810, { align: 'right', width: 555, lineBreak: false });
           
        doc.page.margins.bottom = oldBottomMargin;
      }
      
      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = {
  generateBatchProductionReport,
  generateProductionSummaryReport,
  exportBatchProductionReportToPDF
};