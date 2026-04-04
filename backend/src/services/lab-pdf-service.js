// ============================================================================
// LAB PDF SERVICE — Certificate of Analysis (CoA) Generator
// backend/src/services/lab-pdf-service.js
// ============================================================================
// Design language mirrors the production batch report:
//   - Blue top rule, VTL logo, status badge
//   - Hero section with cert number + test metadata
//   - KPI boxes (pass/fail/warning counts)
//   - Full parameter results table with spec limits
//   - QA sign-off block with 21 CFR Part 11 statement
//   - Per-page footer with cert number and page count
// ============================================================================

const PDFDocument = require('pdfkit');
const fs          = require('fs');
const path        = require('path');

// ── Colour palette (matches production report exactly) ───────────────────────
const C = {
  blue:       '#3B82F6',
  navy:       '#0F172A',
  slate:      '#475569',
  slateLight: '#64748B',
  border:     '#E2E8F0',
  borderMid:  '#CBD5E1',
  bgLight:    '#F8FAFC',
  bgCard:     '#F1F5F9',
  bgBlue:     '#EFF6FF',
  green:      '#059669',
  greenBg:    '#ECFDF5',
  red:        '#DC2626',
  redBg:      '#FEF2F2',
  amber:      '#D97706',
  amberBg:    '#FFFBEB',
  white:      '#FFFFFF',
  tableHead:  '#1E293B',
  tableText:  '#334155',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

function formatDateShort(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric'
  });
}

function paramStatusLabel(status) {
  if (status === 'pass')    return 'PASS';
  if (status === 'fail')    return 'FAIL';
  if (status === 'warning') return 'WARNING';
  return status?.toUpperCase() || '—';
}

function paramStatusColor(status) {
  if (status === 'pass')    return C.green;
  if (status === 'fail')    return C.red;
  if (status === 'warning') return C.amber;
  return C.slateLight;
}

function overallStatusColor(status) {
  if (status === 'pass')             return C.green;
  if (status === 'conditional_pass') return C.amber;
  if (status === 'fail')             return C.red;
  if (status === 'rejected')         return C.red;
  return C.slateLight;
}

function overallStatusLabel(status) {
  if (status === 'pass')             return 'APPROVED — PASS';
  if (status === 'conditional_pass') return 'CONDITIONAL PASS';
  if (status === 'fail')             return 'FAILED';
  if (status === 'rejected')         return 'REJECTED';
  return status?.toUpperCase() || '—';
}

function formatReadingValue(param) {
  if (param.reading_value !== null && param.reading_value !== undefined) {
    return `${parseFloat(param.reading_value).toFixed(4).replace(/\.?0+$/, '')} ${param.unit || ''}`.trim();
  }
  if (param.reading_text !== null && param.reading_text !== undefined) {
    // Microbial pass/fail
    if (param.reading_text === '0') return 'Absent (0 CFU/mL)';
    return `Present (${param.reading_text} CFU/mL)`;
  }
  return '—';
}

function formatSpecLimit(param) {
  const parts = [];
  if (param.spec_min !== null && param.spec_min !== undefined) {
    parts.push(`≥ ${parseFloat(param.spec_min)}`);
  }
  if (param.spec_max !== null && param.spec_max !== undefined) {
    parts.push(`≤ ${parseFloat(param.spec_max)}`);
  }
  const limit = parts.join(' – ');
  return limit ? `${limit} ${param.unit || ''}`.trim() : (param.is_pass_fail ? 'Absent (0 CFU/mL)' : '—');
}

// ── Main PDF generator ────────────────────────────────────────────────────────

async function generateCoAPDF(test, logoPath) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 40, size: 'A4', bufferPages: true });
      const buffers = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve(Buffer.concat(buffers)));

      let currentY = 40;

      const checkPageBreak = (neededSpace) => {
        if (currentY + neededSpace > 750) {
          doc.addPage();
          currentY = 40;
          return true;
        }
        return false;
      };

      // Counts
      const passed    = test.parameters.filter(p => p.status === 'pass').length;
      const failed    = test.parameters.filter(p => p.status === 'fail').length;
      const warnings  = test.parameters.filter(p => p.status === 'warning').length;
      const total     = test.parameters.length;

      // ======================================================================
      // 1. HEADER — Blue rule + logo + title + status badge
      // ======================================================================
      doc.rect(0, 0, 600, 6).fill(C.blue);

      try {
        if (logoPath && fs.existsSync(logoPath)) {
          doc.image(logoPath, 40, currentY, { height: 35 });
        }
      } catch (e) {}

      doc.fillColor(C.navy).font('Helvetica-Bold').fontSize(22)
         .text('CERTIFICATE OF ANALYSIS', 40, currentY + 45);
      doc.fillColor(C.slateLight).font('Helvetica').fontSize(10)
         .text(`Generated: ${new Date().toLocaleString()}`, 40, currentY + 70);

      // Status badge
      const badgeColor = overallStatusColor(test.overall_status);
      doc.rect(390, currentY + 42, 165, 26).fill(badgeColor);
      doc.fillColor(C.white).font('Helvetica-Bold').fontSize(10)
         .text(overallStatusLabel(test.overall_status), 390, currentY + 50,
               { width: 165, align: 'center' });

      currentY += 110;

      // ======================================================================
      // 2. HERO SECTION — Certificate + test identity
      // ======================================================================
      doc.rect(40, currentY, 515, 75).fill(C.bgLight).stroke(C.border);

      // Certificate number (large)
      doc.fillColor(C.navy).font('Helvetica-Bold').fontSize(18)
         .text(test.certificate_number || test.test_number, 55, currentY + 12);

      doc.fillColor(C.blue).font('Helvetica-Bold').fontSize(9)
         .text('WATER QUALITY CERTIFICATE OF ANALYSIS', 55, currentY + 35);

      doc.fillColor(C.slate).font('Helvetica').fontSize(9)
         .text(
           `Test Ref: ${test.test_number}   |   Date: ${formatDateShort(test.test_date)}   |   ` +
           `Shift: ${(test.shift || '').charAt(0).toUpperCase() + (test.shift || '').slice(1)}   |   ` +
           `RO System: ${test.ro_system_reference || '—'}`,
           55, currentY + 50
         );

      if (test.batch_number) {
        doc.fillColor(C.slateLight).font('Helvetica').fontSize(9)
           .text(`Linked Production Batch: ${test.batch_number}`, 55, currentY + 63);
      }

      currentY += 92;

      // ======================================================================
      // 3. KPI BOXES — Passed / Failed / Warnings / Total
      // ======================================================================
      const kpiY = currentY;
      const kpis = [
        { label: 'Parameters Tested', value: total,    bg: C.bgCard,   fg: C.navy  },
        { label: 'Passed',            value: passed,   bg: C.greenBg,  fg: C.green },
        { label: 'Failed',            value: failed,   bg: failed > 0 ? C.redBg : C.bgCard,   fg: failed > 0 ? C.red : C.slateLight  },
        { label: 'Warnings',          value: warnings, bg: warnings > 0 ? C.amberBg : C.bgCard, fg: warnings > 0 ? C.amber : C.slateLight },
      ];

      kpis.forEach((k, i) => {
        const x = 40 + i * 130;
        doc.rect(x, kpiY, 120, 52).fill(k.bg);
        doc.fillColor(C.slateLight).font('Helvetica').fontSize(9)
           .text(k.label, x + 8, kpiY + 10, { width: 104 });
        doc.fillColor(k.fg).font('Helvetica-Bold').fontSize(20)
           .text(String(k.value), x + 8, kpiY + 26);
      });

      currentY += 70;

      // ======================================================================
      // 4. TEST DETAILS GRID
      // ======================================================================
      checkPageBreak(80);
      doc.fillColor(C.navy).font('Helvetica-Bold').fontSize(13)
         .text('Test Details', 40, currentY);
      currentY += 18;

      doc.rect(40, currentY, 515, 56).fill(C.bgLight).stroke(C.border);

      const details = [
        { k: 'Analyst',            v: `${test.analyst_name} (${test.analyst_employee_id || '—'})` },
        { k: 'Test Date',          v: formatDateShort(test.test_date) },
        { k: 'Shift',              v: (test.shift || '—').charAt(0).toUpperCase() + (test.shift || '—').slice(1) },
        { k: 'Equipment Cal. Ref', v: test.equipment_calibration_ref || '—' },
      ];

      details.forEach((d, i) => {
        const col = i % 2;
        const row = Math.floor(i / 2);
        const x = 55 + col * 258;
        const y = currentY + 10 + row * 20;
        doc.fillColor(C.slate).font('Helvetica-Bold').fontSize(9).text(`${d.k}:`, x, y);
        doc.fillColor(C.navy).font('Helvetica').fontSize(9).text(d.v, x + 120, y, { width: 128 });
      });

      currentY += 72;

      // ======================================================================
      // 5. PARAMETER RESULTS TABLE
      // ======================================================================
      checkPageBreak(120);
      doc.fillColor(C.navy).font('Helvetica-Bold').fontSize(13)
         .text('Water Quality Parameter Results', 40, currentY);
      currentY += 18;

      // Table header
      const colW = [155, 100, 130, 65, 45];
      const colX = [50, 215, 325, 465, 535];
      const headers = ['Parameter', 'Reading', 'Specification Limit', 'Unit', 'Result'];

      doc.rect(40, currentY, 515, 22).fill(C.tableHead);
      doc.fillColor(C.white).font('Helvetica-Bold').fontSize(9);
      headers.forEach((h, i) => {
        doc.text(h, colX[i], currentY + 6, { width: colW[i] });
      });
      currentY += 22;

      // Table rows
      test.parameters.forEach((param, idx) => {
        checkPageBreak(28);
        const rowH = 22;
        const bg = idx % 2 === 0 ? C.bgLight : C.white;
        doc.rect(40, currentY, 515, rowH).fill(bg);

        const statusCol = paramStatusColor(param.status);

        doc.fillColor(C.tableText).font('Helvetica').fontSize(9);
        doc.text(param.parameter_name || '—', colX[0], currentY + 6, { width: colW[0] });
        doc.text(formatReadingValue(param),    colX[1], currentY + 6, { width: colW[1] });
        doc.text(formatSpecLimit(param),       colX[2], currentY + 6, { width: colW[2] });
        doc.text(param.unit || '—',            colX[3], currentY + 6, { width: colW[3] });

        // Status pill
        const pillW = 38;
        const pillX = colX[4] - 2;
        doc.rect(pillX, currentY + 4, pillW, 14).fill(statusCol);
        doc.fillColor(C.white).font('Helvetica-Bold').fontSize(7)
           .text(paramStatusLabel(param.status), pillX, currentY + 8,
                 { width: pillW, align: 'center' });

        // Row divider
        doc.moveTo(40, currentY + rowH).lineTo(555, currentY + rowH)
           .lineWidth(0.5).strokeColor(C.border).stroke();

        currentY += rowH;

        // Per-parameter analyst note (for fails/warnings)
        if (param.notes) {
          checkPageBreak(16);
          doc.fillColor(C.slateLight).font('Helvetica-Oblique').fontSize(8)
             .text(`  Note: ${param.notes}`, colX[0], currentY + 3, { width: 480 });
          currentY += 14;
        }
      });

      currentY += 20;

      // ======================================================================
      // 6. OVERALL RESULT BANNER
      // ======================================================================
      checkPageBreak(55);
      const bannerColor = overallStatusColor(test.overall_status);
      doc.rect(40, currentY, 515, 44).fill(bannerColor);
      doc.fillColor(C.white).font('Helvetica-Bold').fontSize(13)
         .text(overallStatusLabel(test.overall_status), 55, currentY + 8, { width: 495 });
      doc.font('Helvetica').fontSize(9)
         .text(
           test.overall_status === 'pass'
             ? 'All parameters meet WHO drinking water quality guidelines and VTL internal specifications.'
             : test.overall_status === 'conditional_pass'
             ? 'Released with QA deviation note. See remarks below. Monitor parameters before next production run.'
             : 'Water quality does not meet specifications. Production is blocked pending re-test and QA clearance.',
           55, currentY + 27, { width: 495 }
         );
      currentY += 60;

      // ======================================================================
      // 7. QA SIGN-OFF BLOCK
      // ======================================================================
      checkPageBreak(90);
      doc.fillColor(C.navy).font('Helvetica-Bold').fontSize(13)
         .text('QA Sign-Off & Electronic Signature', 40, currentY);
      currentY += 18;

      const qaApproval = test.approvals?.find(a => a.stage === 2);

      doc.rect(40, currentY, 515, 65).fill(C.bgLight).stroke(C.border);

      const qaRows = [
        { k: 'QA Reviewer',      v: test.qa_reviewer_name || qaApproval?.actioned_by_name || '—' },
        { k: 'Review Action',    v: qaApproval ? (qaApproval.action.charAt(0).toUpperCase() + qaApproval.action.slice(1)) : '—' },
        { k: 'Date & Time',      v: test.approved_at ? formatDate(test.approved_at) : '—' },
        { k: 'Certificate No.',  v: test.certificate_number || '—' },
      ];

      qaRows.forEach((r, i) => {
        const col = i % 2;
        const row = Math.floor(i / 2);
        const x = 55 + col * 258;
        const y = currentY + 10 + row * 22;
        doc.fillColor(C.slate).font('Helvetica-Bold').fontSize(9).text(`${r.k}:`, x, y);
        doc.fillColor(C.navy).font('Helvetica').fontSize(9).text(r.v, x + 115, y, { width: 133 });
      });

      currentY += 82;

      // QA comments / deviation note
      if (qaApproval?.comments || qaApproval?.deviation_note) {
        checkPageBreak(50);
        doc.rect(40, currentY, 515, 1).fill(C.border);
        currentY += 10;

        if (qaApproval.comments) {
          doc.fillColor(C.slate).font('Helvetica-Bold').fontSize(9)
             .text('QA Comments:', 40, currentY);
          doc.font('Helvetica').fillColor(C.navy)
             .text(qaApproval.comments, 130, currentY, { width: 420 });
          currentY += doc.heightOfString(qaApproval.comments, { width: 420 }) + 8;
        }

        if (qaApproval.deviation_note) {
          checkPageBreak(30);
          doc.rect(40, currentY, 515, 1).fill(C.amber);
          currentY += 8;
          doc.fillColor(C.amber).font('Helvetica-Bold').fontSize(9)
             .text('⚠ Deviation Note:', 40, currentY);
          doc.fillColor(C.navy).font('Helvetica')
             .text(qaApproval.deviation_note, 130, currentY, { width: 420 });
          currentY += doc.heightOfString(qaApproval.deviation_note, { width: 420 }) + 10;
        }
      }

      // General test notes
      if (test.notes) {
        checkPageBreak(40);
        doc.fillColor(C.slateLight).font('Helvetica-Oblique').fontSize(9)
           .text(`Analyst Notes: ${test.notes}`, 40, currentY, { width: 515 });
        currentY += doc.heightOfString(`Analyst Notes: ${test.notes}`, { width: 515 }) + 12;
      }

      // ======================================================================
      // 8. COMPLIANCE STATEMENT (matches production report)
      // ======================================================================
      checkPageBreak(65);
      doc.rect(40, currentY, 515, 55).fill(C.bgLight).stroke(C.borderMid);
      doc.fillColor(C.navy).font('Helvetica-Oblique').fontSize(9)
         .text('Compliance Statement:', 50, currentY + 10);
      doc.fillColor(C.slateLight).font('Helvetica').fontSize(8)
         .text(
           'This Certificate of Analysis was generated electronically by the Vilagio ERP system. ' +
           'Parameter readings, QA approval, and electronic signatures are secured by encrypted passwords ' +
           'and constitute legally binding records in accordance with 21 CFR Part 11, GMP, and WHO ' +
           'drinking water quality guidelines (WHO Guidelines for Drinking-water Quality, 4th Edition). ' +
           'This certificate is valid for the production shift on the date of issue only.',
           50, currentY + 23, { width: 495, align: 'justify' }
         );

      currentY += 72;

      // ======================================================================
      // 9. GLOBAL FOOTERS — every page (mirrors production report pattern)
      // ======================================================================
      const pages = doc.bufferedPageRange();
      for (let i = 0; i < pages.count; i++) {
        doc.switchToPage(i);

        const oldBottomMargin = doc.page.margins.bottom;
        doc.page.margins.bottom = 0;

        doc.moveTo(40, 795).lineTo(555, 795).lineWidth(1).strokeColor(C.border).stroke();

        doc.fillColor(C.slateLight).font('Helvetica-Bold').fontSize(8);
        doc.text(
          `CoA: ${test.certificate_number || test.test_number}`,
          40, 805, { lineBreak: false }
        );
        doc.font('Helvetica').text(
          `Test Date: ${formatDateShort(test.test_date)}  |  Analyst: ${test.analyst_name || '—'}`,
          190, 805, { lineBreak: false }
        );
        doc.text(
          `Page ${i + 1} of ${pages.count}`,
          40, 805, { width: 515, align: 'right', lineBreak: false }
        );

        doc.fillColor('#94A3B8').fontSize(7)
           .text(
             'CONFIDENTIAL — VILAGIO TECHNOLOGIES LTD — OFFICIAL WATER QUALITY CERTIFICATE',
             40, 818, { width: 515, align: 'center', lineBreak: false }
           );

        doc.page.margins.bottom = oldBottomMargin;
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = { generateCoAPDF };
