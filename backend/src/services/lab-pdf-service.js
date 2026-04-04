// ============================================================================
// LAB PDF SERVICE — Certificate of Analysis (CoA) Generator
// backend/src/services/lab-pdf-service.js
// ============================================================================
// Fixes applied:
//   v2 — Narrowed margins (25px), dropped redundant Unit column,
//         recalculated all column widths to stay within 555px safe area,
//         compressed section spacing so content fits on one page,
//         logo loading uses same robust path pattern as production report
// ============================================================================

const PDFDocument = require('pdfkit');
const fs          = require('fs');
const path        = require('path');

// ── Page geometry ─────────────────────────────────────────────────────────────
// A4 = 595pt wide. With margin 25 each side: safe area = 595 - 50 = 545pt
// Content runs from x=25 to x=570. Table inner padding: x=35 to x=560 = 525pt usable.
const M    = 25;   // margin
const PW   = 545;  // page content width  (595 - 2*25)
const TX   = 35;   // table left x (M + 10 inner padding)
const TW   = 525;  // table total width
const SAFE = 560;  // right boundary for text (TX + TW - 5 buffer)

// ── Colour palette (matches production report) ────────────────────────────────
const C = {
  blue:       '#3B82F6',
  navy:       '#0F172A',
  slate:      '#475569',
  slateLight: '#64748B',
  border:     '#E2E8F0',
  borderMid:  '#CBD5E1',
  bgLight:    '#F8FAFC',
  bgCard:     '#F1F5F9',
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

function paramStatusLabel(s) {
  if (s === 'pass')    return 'PASS';
  if (s === 'fail')    return 'FAIL';
  if (s === 'warning') return 'WARNING';
  return (s || '—').toUpperCase();
}

function paramStatusColor(s) {
  if (s === 'pass')    return C.green;
  if (s === 'fail')    return C.red;
  if (s === 'warning') return C.amber;
  return C.slateLight;
}

function overallStatusColor(s) {
  if (s === 'pass')             return C.green;
  if (s === 'conditional_pass') return C.amber;
  return C.red;
}

function overallStatusLabel(s) {
  if (s === 'pass')             return 'APPROVED — PASS';
  if (s === 'conditional_pass') return 'CONDITIONAL PASS';
  if (s === 'rejected')         return 'REJECTED';
  return 'FAILED';
}

function formatReadingValue(p) {
  if (p.reading_value !== null && p.reading_value !== undefined) {
    const num = parseFloat(p.reading_value);
    // Trim trailing zeros but keep meaningful precision
    const formatted = num % 1 === 0 ? num.toString() : num.toFixed(2).replace(/\.?0+$/, '');
    return `${formatted} ${p.unit || ''}`.trim();
  }
  if (p.reading_text !== null && p.reading_text !== undefined) {
    return p.reading_text === '0' ? 'Absent (0 CFU/mL)' : `Present (${p.reading_text} CFU/mL)`;
  }
  return '—';
}

function formatSpecLimit(p) {
  // Spec limit column now includes unit — no separate Unit column needed
  if (p.is_pass_fail) return 'Absent (0 CFU/mL required)';
  const parts = [];
  if (p.spec_min !== null && p.spec_min !== undefined) parts.push(`>= ${parseFloat(p.spec_min)}`);
  if (p.spec_max !== null && p.spec_max !== undefined) parts.push(`<= ${parseFloat(p.spec_max)}`);
  const limits = parts.join(' – ');
  return limits ? `${limits} ${p.unit || ''}`.trim() : '—';
}

// ── Logo path resolution — same pattern as production-reporting-service.js ────
function resolveLogoPath(passedLogoPath) {
  // Ordered list of candidate paths — works regardless of where the service file lives
  // __dirname for lab-pdf-service.js = backend/src/services/
  const candidates = [
    passedLogoPath,                                                    // passed by route
    path.join(__dirname, '../../public/logo-black.png'),               // src/services/ → root/public
    path.join(__dirname, '../../../public/logo-black.png'),            // extra level up
    path.join(process.cwd(), 'public/logo-black.png'),                 // process cwd
    path.join(process.cwd(), '../public/logo-black.png'),              // one above cwd
    '/opt/render/project/src/public/logo-black.png',                   // Render deployment path
  ].filter(Boolean);

  for (const candidate of candidates) {
    try {
      if (candidate && fs.existsSync(candidate)) {
        console.log('CoA PDF: logo found at:', candidate);
        return candidate;
      }
    } catch (e) {}
  }
  console.warn('CoA PDF: logo not found in any candidate path — generating without logo');
  return null;
}

// ── Main PDF generator ────────────────────────────────────────────────────────

async function generateCoAPDF(test, logoPath) {
  return new Promise((resolve, reject) => {
    try {
      // Narrowed margins (25) to gain more content space
      const doc = new PDFDocument({ margin: M, size: 'A4', bufferPages: true });
      const buffers = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve(Buffer.concat(buffers)));

      let y = M;

      // Page break guard — leave 40pt for footer
      const needsBreak = (space) => {
        if (y + space > 772) {
          doc.addPage();
          y = M;
          return true;
        }
        return false;
      };

      const passed   = test.parameters.filter(p => p.status === 'pass').length;
      const failed   = test.parameters.filter(p => p.status === 'fail').length;
      const warnings = test.parameters.filter(p => p.status === 'warning').length;
      const total    = test.parameters.length;

      const resolvedLogo = resolveLogoPath(logoPath);

      // ====================================================================
      // 1. HEADER — Blue top rule + logo + title + status badge
      //    Mirrors production-reporting-service.js header exactly
      // ====================================================================
      doc.rect(0, 0, 595, 6).fill(C.blue);

      // Logo — same try/catch guard as production report
      try {
        if (resolvedLogo) {
          doc.image(resolvedLogo, M, y, { height: 32 });
        }
      } catch (e) {
        console.warn('CoA PDF: logo not loaded —', e.message);
      }

      // Title sits to the right of where the logo would be
      doc.fillColor(C.navy).font('Helvetica-Bold').fontSize(20)
         .text('CERTIFICATE OF ANALYSIS', M, y + 38);
      doc.fillColor(C.slateLight).font('Helvetica').fontSize(9)
         .text(`Generated: ${new Date().toLocaleString()}`, M, y + 60);

      // Status badge — right-aligned in header
      const badgeColor = overallStatusColor(test.overall_status);
      doc.rect(400, y + 36, 170, 24).fill(badgeColor);
      doc.fillColor(C.white).font('Helvetica-Bold').fontSize(9)
         .text(overallStatusLabel(test.overall_status), 400, y + 44,
               { width: 170, align: 'center' });

      y += 95;

      // ====================================================================
      // 2. HERO — Certificate number + test identity
      // ====================================================================
      doc.rect(M, y, PW, 62).fill(C.bgLight).stroke(C.border);

      doc.fillColor(C.navy).font('Helvetica-Bold').fontSize(16)
         .text(test.certificate_number || test.test_number, M + 12, y + 10);

      doc.fillColor(C.blue).font('Helvetica-Bold').fontSize(8)
         .text('WATER QUALITY CERTIFICATE OF ANALYSIS', M + 12, y + 31);

      const heroMeta =
        `Test Ref: ${test.test_number}   |   Date: ${formatDateShort(test.test_date)}   |   ` +
        `Shift: ${(test.shift || '').charAt(0).toUpperCase() + (test.shift || '').slice(1)}   |   ` +
        `RO System: ${test.ro_system_reference || '—'}` +
        (test.batch_number ? `   |   Batch: ${test.batch_number}` : '');

      doc.fillColor(C.slate).font('Helvetica').fontSize(8)
         .text(heroMeta, M + 12, y + 44, { width: PW - 24 });

      y += 76;

      // ====================================================================
      // 3. KPI BOXES — 4 boxes across full width
      // ====================================================================
      const kpis = [
        { label: 'Parameters Tested', value: total,    bg: C.bgCard,                             fg: C.navy  },
        { label: 'Passed',            value: passed,   bg: C.greenBg,                            fg: C.green },
        { label: 'Failed',            value: failed,   bg: failed   > 0 ? C.redBg   : C.bgCard, fg: failed   > 0 ? C.red   : C.slateLight },
        { label: 'Warnings',          value: warnings, bg: warnings > 0 ? C.amberBg : C.bgCard, fg: warnings > 0 ? C.amber : C.slateLight },
      ];
      const kpiW = Math.floor(PW / 4);
      kpis.forEach((k, i) => {
        const kx = M + i * kpiW;
        doc.rect(kx, y, kpiW - 2, 46).fill(k.bg);
        doc.fillColor(C.slateLight).font('Helvetica').fontSize(8)
           .text(k.label, kx + 8, y + 8, { width: kpiW - 16 });
        doc.fillColor(k.fg).font('Helvetica-Bold').fontSize(18)
           .text(String(k.value), kx + 8, y + 22);
      });
      y += 58;

      // ====================================================================
      // 4. TEST DETAILS — 2-column grid
      // ====================================================================
      needsBreak(60);
      doc.fillColor(C.navy).font('Helvetica-Bold').fontSize(11)
         .text('Test Details', M, y);
      y += 14;

      doc.rect(M, y, PW, 48).fill(C.bgLight).stroke(C.border);
      const dets = [
        { k: 'Analyst',        v: `${test.analyst_name} (${test.analyst_employee_id || '—'})` },
        { k: 'Test Date',      v: formatDateShort(test.test_date) },
        { k: 'Shift',          v: (test.shift || '—').charAt(0).toUpperCase() + (test.shift || '—').slice(1) },
        { k: 'Cal. Ref',       v: test.equipment_calibration_ref || '—' },
      ];
      dets.forEach((d, i) => {
        const col = i % 2;
        const row = Math.floor(i / 2);
        const dx  = M + 12 + col * 272;
        const dy  = y + 8 + row * 18;
        doc.fillColor(C.slate).font('Helvetica-Bold').fontSize(8).text(`${d.k}:`, dx, dy);
        doc.fillColor(C.navy).font('Helvetica').fontSize(8).text(d.v, dx + 68, dy, { width: 195 });
      });
      y += 62;

      // ====================================================================
      // 5. PARAMETER RESULTS TABLE
      //    Columns (4, no Unit — unit is embedded in Spec Limit):
      //      Parameter | Reading | Specification Limit (with unit) | Result
      //      x:  35      185      305                               495
      //      w:  145      115      185                               55
      //      total: 35 + 145 + 5 + 115 + 5 + 185 + 5 + 55 = right edge 550 ✓
      // ====================================================================
      needsBreak(80);
      doc.fillColor(C.navy).font('Helvetica-Bold').fontSize(11)
         .text('Water Quality Parameter Results', M, y);
      y += 14;

      // Column geometry — verified: last col right edge = 495 + 55 = 550 < 560 safe ✓
      const COL = {
        param: { x: TX,   w: 148 },
        read:  { x: 188,  w: 112 },
        spec:  { x: 305,  w: 185 },
        res:   { x: 495,  w: 52  },
      };

      // Header row
      const HDR_H = 20;
      doc.rect(M, y, PW, HDR_H).fill(C.tableHead);
      doc.fillColor(C.white).font('Helvetica-Bold').fontSize(8);
      doc.text('Parameter',          COL.param.x, y + 5, { width: COL.param.w });
      doc.text('Reading',            COL.read.x,  y + 5, { width: COL.read.w  });
      doc.text('Specification Limit',COL.spec.x,  y + 5, { width: COL.spec.w  });
      doc.text('Result',             COL.res.x,   y + 5, { width: COL.res.w, align: 'center' });
      y += HDR_H;

      // Data rows
      test.parameters.forEach((param, idx) => {
        needsBreak(20);
        const ROW_H = 20;
        const bg = idx % 2 === 0 ? C.bgLight : C.white;
        doc.rect(M, y, PW, ROW_H).fill(bg);

        doc.fillColor(C.tableText).font('Helvetica').fontSize(8);
        doc.text(param.parameter_name || '—', COL.param.x, y + 5, { width: COL.param.w });
        doc.text(formatReadingValue(param),    COL.read.x,  y + 5, { width: COL.read.w  });
        doc.text(formatSpecLimit(param),       COL.spec.x,  y + 5, { width: COL.spec.w  });

        // Result pill — centred in last column
        const pillW = 40;
        const pillX = COL.res.x + Math.floor((COL.res.w - pillW) / 2);
        doc.rect(pillX, y + 4, pillW, 13).fill(paramStatusColor(param.status));
        doc.fillColor(C.white).font('Helvetica-Bold').fontSize(7)
           .text(paramStatusLabel(param.status), pillX, y + 8,
                 { width: pillW, align: 'center' });

        // Row divider
        doc.moveTo(M, y + ROW_H).lineTo(M + PW, y + ROW_H)
           .lineWidth(0.5).strokeColor(C.border).stroke();

        y += ROW_H;

        // Inline analyst note for out-of-spec params
        if (param.notes) {
          needsBreak(14);
          doc.fillColor(C.slateLight).font('Helvetica-Oblique').fontSize(7)
             .text(`  ↳ Note: ${param.notes}`, COL.param.x, y + 2, { width: PW - 20 });
          y += 12;
        }
      });

      y += 12;

      // ====================================================================
      // 6. OVERALL RESULT BANNER
      // ====================================================================
      needsBreak(38);
      doc.rect(M, y, PW, 36).fill(overallStatusColor(test.overall_status));
      doc.fillColor(C.white).font('Helvetica-Bold').fontSize(11)
         .text(overallStatusLabel(test.overall_status), M + 12, y + 6, { width: PW - 24 });
      doc.font('Helvetica').fontSize(8)
         .text(
           test.overall_status === 'pass'
             ? 'All parameters meet WHO drinking water quality guidelines and VTL internal specifications.'
             : test.overall_status === 'conditional_pass'
             ? 'Released with QA deviation note. Monitor parameters before the next production run.'
             : 'Water quality does not meet specifications. Production is blocked pending re-test and QA clearance.',
           M + 12, y + 22, { width: PW - 24 }
         );
      y += 46;

      // ====================================================================
      // 7. QA SIGN-OFF BLOCK
      // ====================================================================
      needsBreak(72);
      doc.fillColor(C.navy).font('Helvetica-Bold').fontSize(11)
         .text('QA Sign-Off & Electronic Signature', M, y);
      y += 14;

      const qaApproval = test.approvals?.find(a => a.stage === 2);
      doc.rect(M, y, PW, 54).fill(C.bgLight).stroke(C.border);

      const qaRows = [
        { k: 'QA Reviewer',     v: test.qa_reviewer_name || qaApproval?.actioned_by_name || '—' },
        { k: 'Review Action',   v: qaApproval ? (qaApproval.action.charAt(0).toUpperCase() + qaApproval.action.slice(1)) : '—' },
        { k: 'Date & Time',     v: test.approved_at ? formatDate(test.approved_at) : '—' },
        { k: 'Certificate No.', v: test.certificate_number || '—' },
      ];
      qaRows.forEach((r, i) => {
        const col = i % 2;
        const row = Math.floor(i / 2);
        const rx  = M + 12 + col * 272;
        const ry  = y + 8 + row * 20;
        doc.fillColor(C.slate).font('Helvetica-Bold').fontSize(8).text(`${r.k}:`, rx, ry);
        doc.fillColor(C.navy).font('Helvetica').fontSize(8).text(r.v, rx + 88, ry, { width: 175 });
      });
      y += 62;

      // QA comments / deviation note
      if (qaApproval?.comments) {
        needsBreak(28);
        doc.fillColor(C.slate).font('Helvetica-Bold').fontSize(8).text('QA Comments:', M, y);
        doc.fillColor(C.navy).font('Helvetica').fontSize(8)
           .text(qaApproval.comments, M + 90, y, { width: PW - 90 });
        y += doc.heightOfString(qaApproval.comments, { width: PW - 90 }) + 8;
      }

      if (qaApproval?.deviation_note) {
        needsBreak(28);
        doc.rect(M, y, PW, 1).fill(C.amber);
        y += 6;
        doc.fillColor(C.amber).font('Helvetica-Bold').fontSize(8)
           .text('⚠ Deviation Note:', M, y);
        doc.fillColor(C.navy).font('Helvetica').fontSize(8)
           .text(qaApproval.deviation_note, M + 100, y, { width: PW - 100 });
        y += doc.heightOfString(qaApproval.deviation_note, { width: PW - 100 }) + 8;
      }

      if (test.notes) {
        needsBreak(22);
        doc.fillColor(C.slateLight).font('Helvetica-Oblique').fontSize(8)
           .text(`Analyst Notes: ${test.notes}`, M, y, { width: PW });
        y += doc.heightOfString(`Analyst Notes: ${test.notes}`, { width: PW }) + 8;
      }

      // ====================================================================
      // 8. COMPLIANCE STATEMENT
      // ====================================================================
      needsBreak(50);
      doc.rect(M, y, PW, 46).fill(C.bgLight).stroke(C.borderMid);
      doc.fillColor(C.navy).font('Helvetica-Oblique').fontSize(8)
         .text('Compliance Statement:', M + 10, y + 8);
      doc.fillColor(C.slateLight).font('Helvetica').fontSize(7.5)
         .text(
           'This Certificate of Analysis was generated electronically by the Vilagio ERP system. ' +
           'Parameter readings, QA approval, and electronic signatures are secured by encrypted passwords ' +
           'and constitute legally binding records in accordance with 21 CFR Part 11, GMP, and WHO ' +
           'drinking water quality guidelines (4th Edition). Valid for the production shift on the date of issue only.',
           M + 10, y + 20, { width: PW - 20, align: 'justify' }
         );
      y += 54;

      // ====================================================================
      // 9. GLOBAL FOOTERS — every page (identical pattern to production report)
      // ====================================================================
      const pages = doc.bufferedPageRange();
      for (let i = 0; i < pages.count; i++) {
        doc.switchToPage(i);

        const oldBottom = doc.page.margins.bottom;
        doc.page.margins.bottom = 0;

        // Footer divider line
        doc.moveTo(M, 795).lineTo(570, 795).lineWidth(1).strokeColor(C.border).stroke();

        // Footer left: CoA number
        doc.fillColor(C.slateLight).font('Helvetica-Bold').fontSize(8)
           .text(`CoA: ${test.certificate_number || test.test_number}`, M, 805, { lineBreak: false });

        // Footer centre: date + analyst
        doc.font('Helvetica').fontSize(8)
           .text(
             `Test Date: ${formatDateShort(test.test_date)}  |  Analyst: ${test.analyst_name || '—'}`,
             M + 160, 805, { lineBreak: false }
           );

        // Footer right: page number
        doc.text(`Page ${i + 1} of ${pages.count}`, M, 805,
                 { width: 545, align: 'right', lineBreak: false });

        // Sub-footer
        doc.fillColor('#94A3B8').fontSize(7)
           .text(
             'CONFIDENTIAL — VILAGIO TECHNOLOGIES LTD — OFFICIAL WATER QUALITY CERTIFICATE',
             M, 818, { width: 545, align: 'center', lineBreak: false }
           );

        doc.page.margins.bottom = oldBottom;
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = { generateCoAPDF };
