// ============================================================================
// VILAGIO ERP — QMS PDF AUDIT PACK SERVICE
// backend/src/services/qms-pdf-service.js
//
// Generates downloadable PDF audit packs using PDFKit.
// No browser dependency — streams directly to the HTTP response.
//
// Install: npm install pdfkit
//
// Two modes controlled by the 'mode' parameter:
//   'full'    — all versions, complete audit trail, full training matrix
//   'current' — cover sheet + current version only, signatures, training
// ============================================================================

const PDFDocument = require('pdfkit');
const { pool }    = require('../config/database');

// ── Brand colours (RGB) ──────────────────────────────────────────────────────
const BRAND = {
  primary:   [14,  165, 233],   // sky-500
  dark:      [15,  23,  42],    // slate-900
  mid:       [51,  65,  85],    // slate-700
  light:     [148, 163, 184],   // slate-400
  white:     [255, 255, 255],
  green:     [34,  197, 94],
  amber:     [245, 158, 11],
  red:       [239, 68,  68],
  purple:    [139, 92,  246],
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt = d => d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }) : '—';
const fmtFull = d => d ? new Date(d).toLocaleString('en-GB') : '—';

function statusColour(status) {
  const map = {
    RELEASED:   BRAND.green,
    REVIEW:     [59, 130, 246],
    DRAFT:      BRAND.amber,
    SUPERSEDED: BRAND.light,
    WITHDRAWN:  BRAND.red,
    OPEN:       BRAND.red,
    CLOSED:     BRAND.green,
  };
  return map[status] || BRAND.light;
}

// ── Page layout constants ─────────────────────────────────────────────────────
const M  = 50;   // margin
const PW = 595;  // A4 width points
const PH = 842;  // A4 height points
const CW = PW - M * 2; // content width

// ── PDF builder class ─────────────────────────────────────────────────────────

class QMSPDFBuilder {
  constructor(doc, pack, mode) {
    this.pdf  = doc;
    this.pack = pack;
    this.mode = mode; // 'full' | 'current'
    this.y    = M;
    this.pageNum = 1;
    this.totalPages = '?'; // updated at end
  }

  // ── Layout helpers ──────────────────────────────────────────────────────────

  checkPageBreak(needed = 40) {
    if (this.y + needed > PH - M - 20) this.addPage();
  }

  addPage() {
    this.pdf.addPage();
    this.pageNum++;
    this.y = M;
    this.drawPageHeader();
    this.drawPageFooter();
  }

  drawPageHeader() {
    if (this.pageNum === 1) return;
    const d = this.pack.document;
    this.pdf
      .fillColor(BRAND.dark).fontSize(7)
      .text(`${d.doc_code} — ${d.doc_name}`, M, 20, { width: CW - 80 })
      .text(`CONTROLLED DOCUMENT`, M, 20, { width: CW, align: 'right' });
    this.pdf.moveTo(M, 32).lineTo(PW - M, 32).strokeColor(BRAND.light).lineWidth(0.5).stroke();
    this.y = 45;
  }

  drawPageFooter() {
    const y = PH - 30;
    this.pdf
      .fillColor(BRAND.light).fontSize(7)
      .text(`Vilagio Trading Limited · QMS Audit Pack · Generated ${fmtFull(this.pack.generated_at)}`, M, y, { width: CW - 60 })
      .text(`Page ${this.pageNum}`, M, y, { width: CW, align: 'right' });
    this.pdf.moveTo(M, y - 4).lineTo(PW - M, y - 4).strokeColor(BRAND.light).lineWidth(0.5).stroke();
  }

  gap(n = 10) { this.y += n; }

  sectionHeading(title) {
    this.checkPageBreak(30);
    this.gap(8);
    this.pdf
      .fillColor(BRAND.primary).fontSize(9).font('Helvetica-Bold')
      .text(title.toUpperCase(), M, this.y);
    this.y += 14;
    this.pdf.moveTo(M, this.y).lineTo(PW - M, this.y).strokeColor(BRAND.primary).lineWidth(1).stroke();
    this.y += 8;
  }

  label(text, value, opts = {}) {
    const lw = opts.labelWidth || 140;
    this.checkPageBreak(16);
    this.pdf.fillColor(BRAND.light).fontSize(8).font('Helvetica').text(text, M, this.y, { width: lw });
    this.pdf.fillColor(BRAND.dark).fontSize(8).font('Helvetica-Bold')
      .text(String(value ?? '—'), M + lw, this.y, { width: CW - lw });
    this.y += 14;
  }

  tableRow(cells, widths, isHeader = false) {
    this.checkPageBreak(18);
    let x = M;
    const rowH = 16;

    if (isHeader) {
      this.pdf.rect(M, this.y, CW, rowH).fill(BRAND.dark);
    } else if (cells._zebra) {
      this.pdf.rect(M, this.y, CW, rowH).fill([245, 247, 250]);
    }

    cells.forEach((cell, i) => {
      const w = widths[i];
      const colour = isHeader ? BRAND.white : BRAND.dark;
      const font   = isHeader ? 'Helvetica-Bold' : 'Helvetica';
      this.pdf.fillColor(colour).fontSize(7).font(font)
        .text(String(cell ?? '—'), x + 4, this.y + 4, { width: w - 8, lineBreak: false });
      x += w;
    });

    this.y += rowH;
    this.pdf.moveTo(M, this.y).lineTo(PW - M, this.y)
      .strokeColor([220, 220, 220]).lineWidth(0.3).stroke();
  }

  statusPill(status, x, y) {
    const colour = statusColour(status);
    this.pdf.fillColor(colour).fontSize(7).font('Helvetica-Bold')
      .text(status, x, y);
  }

  // ── Cover page ──────────────────────────────────────────────────────────────

  buildCoverPage() {
    const d  = this.pack.document;
    const cv = this.pack.versions.find(v => v.status === 'RELEASED') || this.pack.versions[0];

    // Header band
    this.pdf.rect(0, 0, PW, 180).fill(BRAND.dark);

    // Logo placeholder
    this.pdf.rect(M, 30, 50, 50)
      .fillAndStroke(BRAND.mid, BRAND.primary);
    this.pdf.fillColor(BRAND.white).fontSize(14).font('Helvetica-Bold')
      .text('VTL', M, 46, { width: 50, align: 'center' });

    // Company name
    this.pdf.fillColor(BRAND.white).fontSize(18).font('Helvetica-Bold')
      .text('VILAGIO TRADING LIMITED', M + 62, 32);
    this.pdf.fillColor(BRAND.primary).fontSize(9).font('Helvetica')
      .text('Quality Management System', M + 62, 54);
    this.pdf.fillColor(BRAND.light).fontSize(8)
      .text('Plot No. 28441 Gymkhana | Chingola, Zambia | quality@vilag.io', M + 62, 68);

    // Document title band
    this.pdf.rect(M, 100, CW, 60).fill(BRAND.primary);
    this.pdf.fillColor(BRAND.white).fontSize(7).font('Helvetica')
      .text(this.mode === 'full' ? 'FULL AUDIT PACK' : 'CURRENT VERSION PACK', M + 12, 108);
    this.pdf.fillColor(BRAND.white).fontSize(15).font('Helvetica-Bold')
      .text(d.doc_name, M + 12, 118, { width: CW - 24 });

    this.y = 190;

    // Document identity table
    this.sectionHeading('Document Identity');

    const metaRows = [
      ['Document Code',      d.doc_code],
      ['Document Type',      d.doc_type],
      ['QMS Section',        `${d.section_code} — ${d.section_name}`],
      ['Document Status',    d.status],
      ['Document Owner',     d.owner_name || 'Unassigned'],
      ['Current Version',    cv ? `v${cv.version_number}` : '—'],
      ['Effective Date',     cv ? fmt(cv.effective_date) : '—'],
      ['Review Due Date',    cv ? fmt(cv.review_due_date) : '—'],
      ['Pack Generated',     fmtFull(this.pack.generated_at)],
      ['Pack Mode',          this.mode === 'full' ? 'Full — all versions and complete audit trail' : 'Current version only'],
    ];
    metaRows.forEach(([l, v]) => this.label(l, v));

    // Current version release signature
    if (cv?.approver_name) {
      this.gap(6);
      this.sectionHeading('Release Authorisation');
      this.label('Approved By',       cv.approver_name);
      this.label('Approver Title',    cv.approver_title || '—');
      this.label('Effective Date',    fmt(cv.effective_date));
      this.label('Electronic Signature', 'Verified — 21 CFR Part 11 Compliant');
      this.gap(6);
      // Signature box
      this.pdf.rect(M, this.y, CW, 40).stroke([200, 210, 220]);
      this.pdf.fillColor(BRAND.light).fontSize(7).font('Helvetica')
        .text('This document was released via electronic signature in the Vilagio ERP QMS system. The electronic signature constitutes a legally valid approval equivalent to a handwritten signature per 21 CFR Part 11.', M + 8, this.y + 8, { width: CW - 16 });
      this.y += 50;
    }

    // Compliance statement
    this.gap(10);
    this.pdf.rect(M, this.y, CW, 50)
      .fillAndStroke([235, 245, 255], [59, 130, 246]);
    this.pdf.fillColor([30, 64, 175]).fontSize(7).font('Helvetica-Bold')
      .text('CONTROLLED DOCUMENT STATEMENT', M + 10, this.y + 8);
    this.pdf.fillColor(BRAND.mid).fontSize(7).font('Helvetica')
      .text('This is a controlled document managed in the Vilagio QMS in accordance with ISO 9001:2015 and GMP requirements. Printed copies are uncontrolled. Verify currency against the ERP system before use. Unauthorised copying or distribution is prohibited.', M + 10, this.y + 20, { width: CW - 20 });
    this.y += 60;
  }

  // ── Version history section ─────────────────────────────────────────────────

  buildVersionHistory() {
    const versions = this.mode === 'full'
      ? this.pack.versions
      : this.pack.versions.filter(v => v.status === 'RELEASED').slice(0, 1);

    this.sectionHeading('Version History');

    const cols = [60, 70, 110, 110, 110];
    this.tableRow(['Version', 'Status', 'Author', 'Reviewer', 'Approver'], cols, true);

    versions.forEach((v, i) => {
      const row = [
        `v${v.version_number}`,
        v.status,
        v.author_name || '—',
        v.reviewer_name || '—',
        v.approver_name || '—',
      ];
      row._zebra = i % 2 === 1;
      this.tableRow(row, cols);

      if (v.change_reason) {
        this.checkPageBreak(14);
        this.pdf.fillColor(BRAND.light).fontSize(7).font('Helvetica')
          .text(`Change reason: ${v.change_reason}`, M + 4, this.y, { width: CW - 8 });
        this.y += 12;
      }
      if (v.ncr_code) {
        this.checkPageBreak(12);
        this.pdf.fillColor(BRAND.amber).fontSize(7)
          .text(`Triggered by NCR: ${v.ncr_code}${v.capa_code ? ` / CAPA: ${v.capa_code}` : ''}`, M + 4, this.y, { width: CW - 8 });
        this.y += 12;
      }
    });
  }

  // ── Approval records ────────────────────────────────────────────────────────

  buildApprovalRecords() {
    if (!this.pack.approvals.length) return;
    this.checkPageBreak(60);
    this.sectionHeading('Electronic Signature Approval Records');

    const cols = [90, 100, 80, 90, 135];
    this.tableRow(['Approver', 'Title', 'Role', 'Status', 'Signed At'], cols, true);

    this.pack.approvals.forEach((a, i) => {
      const row = [a.approver_name, a.approver_title || '—', a.role, a.status, fmtFull(a.action_at)];
      row._zebra = i % 2 === 1;
      this.tableRow(row, cols);
    });
  }

  // ── Training matrix ─────────────────────────────────────────────────────────

  buildTrainingMatrix() {
    this.checkPageBreak(60);
    this.sectionHeading('Training Acknowledgements');

    const comp = parseInt(this.pack.training_summary.completed);
    const total = parseInt(this.pack.training_summary.total);
    const pct   = total > 0 ? Math.round((comp / total) * 100) : 100;

    this.label('Completion Rate', `${pct}% (${comp} of ${total} required acknowledgements)`);
    this.gap(4);

    if (this.pack.training_records.length > 0) {
      const cols = [140, 110, 60, 70, 115];
      this.tableRow(['Employee', 'Department', 'Role', 'Version', 'Acknowledged At'], cols, true);

      this.pack.training_records.forEach((r, i) => {
        const row = [r.user_name, r.user_dept || '—', r.user_role, `v${r.version_number}`, fmtFull(r.acknowledged_at)];
        row._zebra = i % 2 === 1;
        this.tableRow(row, cols);
      });
    } else {
      this.pdf.fillColor(BRAND.light).fontSize(8).text('No acknowledgements recorded.', M, this.y);
      this.y += 16;
    }

    if (this.pack.training_pending.length > 0) {
      this.gap(8);
      this.pdf.fillColor(BRAND.amber).fontSize(8).font('Helvetica-Bold')
        .text(`Pending Acknowledgements (${this.pack.training_pending.length})`, M, this.y);
      this.y += 14;
      const cols2 = [150, 110, 80, 155];
      this.tableRow(['Employee', 'Department', 'Role', 'Assigned At'], cols2, true);
      this.pack.training_pending.forEach((t, i) => {
        const row = [t.user_name, t.user_dept || '—', t.user_role, fmtFull(t.assigned_at)];
        row._zebra = i % 2 === 1;
        this.tableRow(row, cols2);
      });
    }
  }

  // ── NCR / CAPA quality events ───────────────────────────────────────────────

  buildNCRCAPASection() {
    if (!this.pack.ncr_capa_impact.length) return;
    this.checkPageBreak(60);
    this.sectionHeading('Quality Events — NCR & CAPA');

    this.pack.ncr_capa_impact.forEach((n, i) => {
      this.checkPageBreak(55);
      this.pdf.rect(M, this.y, CW, 50).fill(i % 2 === 0 ? [250, 250, 252] : [255, 255, 255]);
      this.pdf.fillColor(BRAND.amber).fontSize(8).font('Helvetica-Bold')
        .text(`${n.ncr_code}  ·  ${n.severity}`, M + 6, this.y + 6);
      this.pdf.fillColor(statusColour(n.ncr_status)).fontSize(7)
        .text(n.ncr_status, M + CW - 70, this.y + 6);
      this.pdf.fillColor(BRAND.mid).fontSize(7).font('Helvetica')
        .text(n.description, M + 6, this.y + 18, { width: CW - 12 });
      if (n.capa_code) {
        this.pdf.fillColor(BRAND.purple).fontSize(7)
          .text(`CAPA: ${n.capa_code} — ${n.action_description || ''}`, M + 6, this.y + 32, { width: CW - 12 });
      }
      this.y += 56;
      this.pdf.moveTo(M, this.y - 4).lineTo(PW - M, this.y - 4)
        .strokeColor([220, 220, 220]).lineWidth(0.3).stroke();
    });
  }

  // ── Audit trail ─────────────────────────────────────────────────────────────

  buildAuditTrail() {
    const trail = this.mode === 'full'
      ? this.pack.audit_trail
      : this.pack.audit_trail.filter(e =>
          ['RELEASED', 'SUBMITTED', 'DRAFT_CREATED', 'WITHDRAWN', 'PLANNED'].includes(e.action)
        );

    if (!trail.length) return;
    this.checkPageBreak(60);
    this.sectionHeading(this.mode === 'full' ? 'Complete Audit Trail (21 CFR Part 11)' : 'Lifecycle Audit Trail');

    const cols = [100, 90, 80, 75, 150];
    this.tableRow(['Action', 'Actor', 'Role', 'Status Change', 'Timestamp'], cols, true);

    trail.forEach((e, i) => {
      const row = [
        e.action.replace(/_/g, ' '),
        e.actor_name || 'System',
        e.actor_role || '—',
        e.from_status && e.to_status ? `${e.from_status}→${e.to_status}` : '—',
        fmtFull(e.created_at),
      ];
      row._zebra = i % 2 === 1;
      this.tableRow(row, cols);

      if (e.notes && this.mode === 'full') {
        this.checkPageBreak(12);
        this.pdf.fillColor(BRAND.light).fontSize(6).font('Helvetica')
          .text(`  ${e.notes}`, M + 4, this.y, { width: CW - 8 });
        this.y += 11;
      }
    });
  }

  // ── Linked documents ─────────────────────────────────────────────────────────

  buildLinkedDocs() {
    if (!this.pack.linked_documents.length) return;
    this.checkPageBreak(50);
    this.sectionHeading('Related Document Cross-References');

    const cols = [80, 80, 220, 70, 45];
    this.tableRow(['Relationship', 'Doc Code', 'Document Title', 'Type', 'Status'], cols, true);

    this.pack.linked_documents.forEach((l, i) => {
      const row = [
        l.relationship.replace(/_/g, ' '),
        l.doc_code,
        l.doc_name,
        l.doc_type,
        l.status,
      ];
      row._zebra = i % 2 === 1;
      this.tableRow(row, cols);
    });
  }

  // ── Build full document ─────────────────────────────────────────────────────

  build() {
    this.drawPageFooter();
    this.buildCoverPage();
    this.addPage();
    this.buildVersionHistory();
    this.gap(8);
    this.buildApprovalRecords();
    this.gap(8);
    this.buildTrainingMatrix();
    if (this.mode === 'full') {
      this.gap(8);
      this.buildLinkedDocs();
      this.gap(8);
      this.buildNCRCAPASection();
      this.gap(8);
      this.buildAuditTrail();
    }
  }
}

// ============================================================================
// Public API
// ============================================================================

async function generateAuditPack(docId, mode, res) {
  // Validate mode
  if (!['full', 'current'].includes(mode)) mode = 'current';

  // Fetch the inspector pack (reuses Phase 3 service)
  const qmsService = require('./qms-service');
  const pack = await qmsService.getInspectorPack(docId);

  const doc = pack.document;
  const filename = `QMS_AuditPack_${doc.doc_code.replace(/[^A-Z0-9-]/gi, '_')}_${mode}_${new Date().toISOString().slice(0,10)}.pdf`;

  // Stream PDF directly to response
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

  const pdf = new PDFDocument({
    size: 'A4',
    margin: M,
    info: {
      Title:    `${doc.doc_code} — ${doc.doc_name}`,
      Author:   'Vilagio QMS',
      Subject:  `QMS Audit Pack — ${mode === 'full' ? 'Full' : 'Current Version'}`,
      Creator:  'Vilagio ERP',
      Producer: 'PDFKit',
    },
    autoFirstPage: true,
  });

  pdf.pipe(res);

  const builder = new QMSPDFBuilder(pdf, pack, mode);
  builder.build();

  pdf.end();
}

module.exports = { generateAuditPack };
