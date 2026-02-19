// src/services/production-reporting-service.js
// Production Reporting Service - Generate PDF reports for manufacturing
// Handles batch production reports with IPQC stages, QA gates, and personnel sign-offs

const { pool } = require('./auth-service'); // Use pool from auth-service
const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');

/**
 * Generate Comprehensive Production Batch Report
 * Includes all manufacturing details, timestamps, and sign-offs
 */
async function generateBatchProductionReport(batchId) {
  // Fetch comprehensive batch data (without production_lines and production_shifts tables)
  const batchQuery = `
    SELECT 
      pb.*,
      p.product_name,
      p.sku,
      u_created.full_name as created_by_name,
      u_supervisor.full_name as supervisor_name
    FROM production_batches pb
    JOIN products p ON pb.product_id = p.product_id
    LEFT JOIN users u_created ON pb.created_by = u_created.user_id
    LEFT JOIN users u_supervisor ON pb.supervisor_id = u_supervisor.user_id
    WHERE pb.batch_id = $1
  `;
  
  const batchResult = await pool.query(batchQuery, [batchId]);
  
  if (batchResult.rows.length === 0) {
    throw new Error('Batch not found');
  }
  
  const batch = batchResult.rows[0];
  
  // Fetch component usage
  const componentsQuery = `
    SELECT 
      bc.component_id,
      p.sku,
      p.product_name,
      bc.quantity_required,
      bc.quantity_used,
      bc.quantity_wasted,
      bc.unit,
      wl.location_code,
      wl.location_name,
      bc.issued_at,
      u.full_name as issued_by_name
    FROM batch_components bc
    JOIN products p ON bc.component_id = p.product_id
    LEFT JOIN warehouse_locations wl ON bc.warehouse_location_id = wl.location_id
    LEFT JOIN users u ON bc.issued_by = u.user_id
    WHERE bc.batch_id = $1
    ORDER BY bc.created_at
  `;
  
  const components = await pool.query(componentsQuery, [batchId]);
  
  // Fetch IPQC records with QA approvals
  const ipqcQuery = `
    SELECT 
      bir.record_id,
      bir.stage_sequence,
      isd.stage_name,
      isd.stage_code,
      isd.stage_category,
      bir.recorded_at,
      bir.recorded_by,
      u_recorded.full_name as recorded_by_name,
      bir.qa_status,
      bir.qa_reviewed_at,
      bir.qa_reviewed_by,
      u_qa.full_name as qa_reviewer_name,
      bir.qa_notes,
      bir.check_results,
      bir.observations
    FROM batch_ipqc_records bir
    JOIN ipqc_stage_definitions isd ON bir.stage_id = isd.stage_id
    LEFT JOIN users u_recorded ON bir.recorded_by = u_recorded.user_id
    LEFT JOIN users u_qa ON bir.qa_reviewed_by = u_qa.user_id
    WHERE bir.batch_id = $1
    ORDER BY bir.stage_sequence, bir.recorded_at
  `;
  
  const ipqcRecords = await pool.query(ipqcQuery, [batchId]);
  
  // Fetch QA gates
  const qaGatesQuery = `
    SELECT 
      qag.qa_gate_id,
      qag.gate_number,
      qag.gate_name,
      qag.status,
      qag.submitted_at,
      qag.submitted_by,
      u_submitted.full_name as submitted_by_name,
      qag.reviewed_at,
      qag.reviewed_by,
      u_reviewed.full_name as reviewed_by_name,
      qag.qa_notes,
      qag.checklist_results
    FROM qa_gates qag
    LEFT JOIN users u_submitted ON qag.submitted_by = u_submitted.user_id
    LEFT JOIN users u_reviewed ON qag.reviewed_by = u_reviewed.user_id
    WHERE qag.batch_id = $1
    ORDER BY qag.gate_number
  `;
  
  const qaGates = await pool.query(qaGatesQuery, [batchId]);
  
  // Fetch batch completion data
  const completionQuery = `
    SELECT 
      completed_at,
      completed_by,
      u.full_name as completed_by_name,
      actual_quantity,
      waste_quantity,
      completion_notes
    FROM production_batches pb
    LEFT JOIN users u ON pb.completed_by = u.user_id
    WHERE pb.batch_id = $1 AND pb.status = 'completed'
  `;
  
  const completion = await pool.query(completionQuery, [batchId]);
  
  return {
    batch,
    components: components.rows,
    ipqc_records: ipqcRecords.rows,
    qa_gates: qaGates.rows,
    completion: completion.rows[0] || null,
    generated_at: new Date()
  };
}

/**
 * Generate Production Summary Report
 * Shows all batches with key metrics for a date range
 */
async function generateProductionSummaryReport(filters = {}) {
  let query = `
    SELECT 
      pb.batch_id,
      pb.batch_number,
      pb.batch_record_code,
      p.sku,
      p.product_name,
      pb.planned_quantity,
      pb.actual_quantity,
      pb.waste_quantity,
      pb.status,
      pb.production_date,
      pb.created_at,
      pb.started_at,
      pb.completed_at,
      pb.production_line,
      pb.shift,
      u_supervisor.full_name as supervisor_name,
      (SELECT COUNT(*) FROM batch_ipqc_records WHERE batch_id = pb.batch_id AND qa_status = 'qa_approved') as approved_ipqc_stages,
      brm.stages_required,
      brm.stages_completed,
      CASE 
        WHEN pb.completed_at IS NOT NULL AND pb.started_at IS NOT NULL 
        THEN EXTRACT(EPOCH FROM (pb.completed_at - pb.started_at))/3600
        ELSE NULL
      END as production_hours,
      CASE 
        WHEN pb.actual_quantity > 0 AND pb.planned_quantity > 0
        THEN ROUND((pb.actual_quantity::DECIMAL / pb.planned_quantity) * 100, 2)
        ELSE NULL
      END as efficiency_percentage
    FROM production_batches pb
    JOIN products p ON pb.product_id = p.product_id
    LEFT JOIN users u_supervisor ON pb.supervisor_id = u_supervisor.user_id
    LEFT JOIN batch_record_metadata brm ON pb.batch_id = brm.batch_id
    WHERE 1=1
  `;
  
  const params = [];
  let paramCount = 1;
  
  if (filters.start_date) {
    query += ` AND pb.production_date >= $${paramCount}`;
    params.push(filters.start_date);
    paramCount++;
  }
  
  if (filters.end_date) {
    query += ` AND pb.production_date <= $${paramCount}`;
    params.push(filters.end_date);
    paramCount++;
  }
  
  if (filters.product_id) {
    query += ` AND pb.product_id = $${paramCount}`;
    params.push(filters.product_id);
    paramCount++;
  }
  
  if (filters.status) {
    query += ` AND pb.status = $${paramCount}`;
    params.push(filters.status);
    paramCount++;
  }
  
  query += ` ORDER BY pb.production_date DESC, pb.created_at DESC`;
  
  const result = await pool.query(query, params);
  
  // Calculate summary statistics
  const summary = {
    total_batches: result.rows.length,
    completed_batches: result.rows.filter(r => r.status === 'completed').length,
    in_progress_batches: result.rows.filter(r => r.status === 'in_progress').length,
    total_planned_quantity: result.rows.reduce((sum, r) => sum + parseFloat(r.planned_quantity || 0), 0),
    total_actual_quantity: result.rows.reduce((sum, r) => sum + parseFloat(r.actual_quantity || 0), 0),
    total_waste_quantity: result.rows.reduce((sum, r) => sum + parseFloat(r.waste_quantity || 0), 0),
    average_efficiency: result.rows.filter(r => r.efficiency_percentage !== null)
      .reduce((sum, r, _, arr) => sum + r.efficiency_percentage / arr.length, 0),
    total_production_hours: result.rows.filter(r => r.production_hours !== null)
      .reduce((sum, r) => sum + parseFloat(r.production_hours), 0),
    by_status: {},
    by_product: {}
  };
  
  result.rows.forEach(row => {
    if (!summary.by_status[row.status]) {
      summary.by_status[row.status] = 0;
    }
    summary.by_status[row.status]++;
    
    if (!summary.by_product[row.sku]) {
      summary.by_product[row.sku] = {
        product_name: row.product_name,
        batches: 0,
        total_quantity: 0
      };
    }
    summary.by_product[row.sku].batches++;
    summary.by_product[row.sku].total_quantity += parseFloat(row.actual_quantity || 0);
  });
  
  return {
    data: result.rows,
    summary,
    filters,
    generated_at: new Date()
  };
}

/**
 * Export Batch Production Report to PDF
 * Creates a comprehensive formatted PDF with company header
 */
async function exportBatchProductionReportToPDF(batchId, logoPath) {
  const reportData = await generateBatchProductionReport(batchId);
  const { batch, components, ipqc_records, qa_gates, completion } = reportData;
  
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 50, bottom: 50, left: 50, right: 50 }
      });
      
      const chunks = [];
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
      
      // Company Header
      if (fs.existsSync(logoPath)) {
        doc.image(logoPath, 50, 40, { width: 100 });
      }
      
      doc.fontSize(18).font('Helvetica-Bold')
         .text('VILAGIO TRADING LIMITED', 160, 45);
      doc.fontSize(9).font('Helvetica')
         .text('Plot No. 28441, Gymkhana', 160, 70)
         .text('50/50 Kitwe Road', 160, 82)
         .text('CHINGOLA', 160, 94)
         .text('Email: quality@vilag.io', 160, 106);
      
      // Report Title
      doc.moveTo(50, 130).lineTo(545, 130).stroke();
      doc.fontSize(16).font('Helvetica-Bold')
         .text('PRODUCTION BATCH RECORD', 50, 140, { align: 'center' });
      doc.fontSize(10).font('Helvetica')
         .text(`Batch Number: ${batch.batch_number}`, 50, 165, { align: 'center' });
      doc.moveTo(50, 180).lineTo(545, 180).stroke();
      
      let yPosition = 200;
      
      // Batch Information Section
      doc.fontSize(12).font('Helvetica-Bold')
         .text('BATCH INFORMATION', 50, yPosition);
      yPosition += 20;
      
      const batchInfo = [
        ['Batch Record Code:', batch.batch_record_code],
        ['Product:', `${batch.product_name} (${batch.sku})`],
        ['Production Date:', new Date(batch.production_date).toLocaleDateString()],
        ['Production Line:', batch.production_line || 'N/A'],
        ['Shift:', batch.shift || 'N/A'],
        ['Supervisor:', batch.supervisor_name || 'N/A'],
        ['Planned Quantity:', `${batch.planned_quantity} ${batch.unit || 'units'}`],
        ['Status:', batch.status.toUpperCase()],
        ['Created:', new Date(batch.created_at).toLocaleString()],
        ['Started:', batch.started_at ? new Date(batch.started_at).toLocaleString() : 'Not started'],
        ['Completed:', batch.completed_at ? new Date(batch.completed_at).toLocaleString() : 'Not completed']
      ];
      
      doc.fontSize(9).font('Helvetica');
      batchInfo.forEach(([label, value]) => {
        doc.text(label, 60, yPosition, { continued: true, width: 150 })
           .font('Helvetica-Bold')
           .text(value, { width: 300 });
        yPosition += 15;
        doc.font('Helvetica');
      });
      
      yPosition += 10;
      
      // Component Usage Section
      if (components.length > 0) {
        if (yPosition > 650) {
          doc.addPage();
          yPosition = 50;
        }
        
        doc.fontSize(12).font('Helvetica-Bold')
           .text('COMPONENT USAGE', 50, yPosition);
        yPosition += 20;
        
        // Table headers
        doc.fontSize(8).font('Helvetica-Bold');
        doc.text('Component', 60, yPosition, { width: 150 });
        doc.text('Required', 210, yPosition, { width: 50, align: 'right' });
        doc.text('Used', 270, yPosition, { width: 50, align: 'right' });
        doc.text('Wasted', 330, yPosition, { width: 50, align: 'right' });
        doc.text('Location', 390, yPosition, { width: 80 });
        doc.text('Issued By', 480, yPosition, { width: 65 });
        yPosition += 15;
        
        doc.font('Helvetica').fontSize(7);
        components.forEach(comp => {
          if (yPosition > 750) {
            doc.addPage();
            yPosition = 50;
          }
          
          doc.text(`${comp.product_name} (${comp.sku})`, 60, yPosition, { width: 140 });
          doc.text(`${comp.quantity_required} ${comp.unit}`, 210, yPosition, { width: 50, align: 'right' });
          doc.text(`${comp.quantity_used || 0} ${comp.unit}`, 270, yPosition, { width: 50, align: 'right' });
          doc.text(`${comp.quantity_wasted || 0} ${comp.unit}`, 330, yPosition, { width: 50, align: 'right' });
          doc.text(comp.location_code || 'N/A', 390, yPosition, { width: 80 });
          doc.text(comp.issued_by_name || 'N/A', 480, yPosition, { width: 65 });
          yPosition += 12;
        });
        
        yPosition += 10;
      }
      
      // QA Gates Section
      if (qa_gates.length > 0) {
        if (yPosition > 650) {
          doc.addPage();
          yPosition = 50;
        }
        
        doc.fontSize(12).font('Helvetica-Bold')
           .text('QA GATES', 50, yPosition);
        yPosition += 20;
        
        qa_gates.forEach((gate, idx) => {
          if (yPosition > 700) {
            doc.addPage();
            yPosition = 50;
          }
          
          doc.fontSize(10).font('Helvetica-Bold')
             .text(`Gate ${gate.gate_number}: ${gate.gate_name}`, 60, yPosition);
          yPosition += 15;
          
          doc.fontSize(8).font('Helvetica')
             .text(`Status: ${gate.status || 'Pending'}`, 70, yPosition);
          yPosition += 12;
          
          if (gate.submitted_at) {
            doc.text(`Submitted: ${new Date(gate.submitted_at).toLocaleString()} by ${gate.submitted_by_name}`, 70, yPosition);
            yPosition += 12;
          }
          
          if (gate.reviewed_at) {
            doc.text(`Reviewed: ${new Date(gate.reviewed_at).toLocaleString()} by ${gate.reviewed_by_name}`, 70, yPosition);
            yPosition += 12;
          }
          
          if (gate.qa_notes) {
            doc.text(`Notes: ${gate.qa_notes}`, 70, yPosition, { width: 450 });
            yPosition += 15;
          }
          
          yPosition += 5;
        });
        
        yPosition += 10;
      }
      
      // IPQC Records Section
      if (ipqc_records.length > 0) {
        if (yPosition > 600) {
          doc.addPage();
          yPosition = 50;
        }
        
        doc.fontSize(12).font('Helvetica-Bold')
           .text('IN-PROCESS QUALITY CONTROL (IPQC) RECORDS', 50, yPosition);
        yPosition += 20;
        
        ipqc_records.forEach((ipqc, idx) => {
          if (yPosition > 680) {
            doc.addPage();
            yPosition = 50;
          }
          
          doc.fontSize(10).font('Helvetica-Bold')
             .text(`Stage ${ipqc.stage_sequence}: ${ipqc.stage_name}`, 60, yPosition);
          yPosition += 15;
          
          doc.fontSize(8).font('Helvetica')
             .text(`Category: ${ipqc.stage_category} | Code: ${ipqc.stage_code}`, 70, yPosition);
          yPosition += 12;
          
          doc.text(`Recorded: ${new Date(ipqc.recorded_at).toLocaleString()} by ${ipqc.recorded_by_name}`, 70, yPosition);
          yPosition += 12;
          
          doc.text(`QA Status: ${ipqc.qa_status || 'Pending'}`, 70, yPosition);
          yPosition += 12;
          
          if (ipqc.qa_reviewed_at) {
            doc.text(`QA Reviewed: ${new Date(ipqc.qa_reviewed_at).toLocaleString()} by ${ipqc.qa_reviewer_name}`, 70, yPosition);
            yPosition += 12;
          }
          
          if (ipqc.observations) {
            doc.text(`Observations: ${ipqc.observations}`, 70, yPosition, { width: 450 });
            yPosition += 15;
          }
          
          if (ipqc.qa_notes) {
            doc.text(`QA Notes: ${ipqc.qa_notes}`, 70, yPosition, { width: 450 });
            yPosition += 15;
          }
          
          yPosition += 5;
        });
        
        yPosition += 10;
      }
      
      // Completion Section
      if (completion) {
        if (yPosition > 680) {
          doc.addPage();
          yPosition = 50;
        }
        
        doc.fontSize(12).font('Helvetica-Bold')
           .text('PRODUCTION COMPLETION', 50, yPosition);
        yPosition += 20;
        
        doc.fontSize(9).font('Helvetica')
           .text(`Completed At: ${new Date(completion.completed_at).toLocaleString()}`, 60, yPosition);
        yPosition += 15;
        
        doc.text(`Completed By: ${completion.completed_by_name}`, 60, yPosition);
        yPosition += 15;
        
        doc.text(`Actual Quantity: ${completion.actual_quantity} ${batch.unit || 'units'}`, 60, yPosition);
        yPosition += 15;
        
        if (completion.waste_quantity) {
          doc.text(`Waste Quantity: ${completion.waste_quantity} ${batch.unit || 'units'}`, 60, yPosition);
          yPosition += 15;
        }
        
        if (completion.completion_notes) {
          doc.text(`Notes: ${completion.completion_notes}`, 60, yPosition, { width: 450 });
          yPosition += 20;
        }
      }
      
      // Footer
      doc.fontSize(7).font('Helvetica')
         .text(`Generated: ${new Date().toLocaleString()}`, 50, 780)
         .text('Page ' + doc.bufferedPageRange().count, 500, 780, { width: 45, align: 'right' });
      
      doc.end();
      
    } catch (error) {
      reject(error);
    }
  });
}

module.exports = {
  generateBatchProductionReport,
  generateProductionSummaryReport,
  exportBatchProductionReportToPDF
};
