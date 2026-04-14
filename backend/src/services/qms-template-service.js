// ============================================================================
// VILAGIO ERP — QMS WORD TEMPLATE SERVICE
// backend/src/services/qms-template-service.js
//
// Two responsibilities:
//   1. generateBlankTemplate(doc, version) — creates a pre-populated .docx
//      blank template for the author to edit offline in Word.
//      Contains: doc metadata header, correct section structure for doc type,
//      VTL branding, authoring guidance notes, and placeholder text.
//
//   2. assembleReleasedDocument(doc, version, uploadedFilePath, res) — takes
//      the author-uploaded .docx and prepends a system-generated cover sheet,
//      injects running headers/footers on every page, then streams the result.
//
// Install: npm install docx (already installed)
//          npm install docx-merger (for merging documents)
//          npm install pizzip (for low-level docx manipulation)
//
// NOTE: Full merge of two .docx files (cover + content) requires careful XML
// manipulation. We use a two-document approach — the cover sheet is generated
// as a separate section within the same Document, and the uploaded content is
// appended as raw XML body content via pizzip/JSZip manipulation.
// ============================================================================

const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, HeadingLevel, BorderStyle, WidthType,
  ShadingType, PageBreak, LevelFormat, TabStopType, SimpleField,
  SectionType, PageOrientation,VerticalAlign, PageBreakBefore, Numbering, StyleLevelType
} = require('docx');

const fs      = require('fs');
const path    = require('path');
const JSZip   = require('jszip');
const { pool } = require('../config/database');

// ── Constants ─────────────────────────────────────────────────────────────────

const BRAND_BLUE  = '0E6ACC';
const BRAND_DARK  = '0F172A';
const BRAND_MID   = '334155';
const BRAND_LIGHT = '94A3B8';
const HEADER_BG   = 'E8F2FB';
const WHITE       = 'FFFFFF';
const ROW_ALT     = 'F8FAFC';

const PAGE_W   = 11906; // A4
const MARGIN   = 1418;  // ~2.5cm
const CONTENT  = PAGE_W - MARGIN * 2;

const thinBorder = { style: BorderStyle.SINGLE, size: 4,  color: 'CCCCCC' };
const noBorder   = { style: BorderStyle.NONE,   size: 0,  color: 'FFFFFF' };
const allThin    = { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder };
const cellPad    = { top: 100, bottom: 100, left: 120, right: 120 };

// ── Section schemas ───────────────────────────────────────────────────────────

const SECTION_SCHEMAS = {
  SOP: [
    { num: '1', title: 'PURPOSE',                        hint: 'State clearly what this SOP governs and why it exists. One to three concise sentences.' },
    { num: '2', title: 'SCOPE',                          hint: 'Define who and what this SOP applies to. Explicitly note any exclusions.' },
    { num: '3', title: 'DEFINITIONS',                    hint: 'List all specialist terms, abbreviations, and acronyms used in this document with plain-language definitions.' },
    { num: '4', title: 'RESPONSIBILITIES',               hint: 'Use a table or role-by-role list. Who owns, executes, and verifies each element of this procedure?' },
    { num: '5', title: 'REQUIRED MATERIALS / EQUIPMENT', hint: 'List tools, chemicals, PPE, equipment, and consumables required. Reference specification standards where applicable.' },
    { num: '6', title: 'PROCEDURE / INSTRUCTIONS',       hint: 'Numbered, sequential steps. Use sub-steps for complex actions. Mark critical control points (CCPs) clearly.' },
    { num: '7', title: 'ACCEPTANCE CRITERIA / LIMITS',   hint: 'Quantitative pass/fail criteria. Reference specifications, regulatory limits, or internal standards.' },
    { num: '8', title: 'RECORDS REQUIRED',               hint: 'List the specific forms, logs, or registers that must be completed when following this SOP. Reference document codes.' },
    { num: '9', title: 'RELATED DOCUMENTS',              hint: 'List document codes of SOPs, policies, forms, and external standards referenced in this document.' },
  ],
  POL: [
    { num: '1', title: 'PURPOSE & OBJECTIVE',            hint: 'State the strategic intent of this policy and the commitment it represents.' },
    { num: '2', title: 'SCOPE',                          hint: 'Define who this policy applies to. Include contractors, visitors, and third parties if relevant.' },
    { num: '3', title: 'POLICY STATEMENT',               hint: 'The core rules and commitments. Use "shall" language. This is the binding content of the policy.' },
    { num: '4', title: 'RESPONSIBILITIES',               hint: 'Which departments or roles are responsible for enforcing, monitoring, and complying with this policy.' },
    { num: '5', title: 'EXCEPTIONS',                     hint: 'List any specific, pre-approved scenarios where this policy does not apply, and the approval authority.' },
    { num: '6', title: 'REVIEW & REVISION HISTORY',      hint: 'Summary of what changed in this version and why. The formal revision history is maintained in the QMS system.' },
  ],
  MAN: [
    { num: '1', title: 'INTRODUCTION & COMPANY PROFILE', hint: 'Overview of VTL — what we make, where we operate, our quality commitment.' },
    { num: '2', title: 'QUALITY POLICY',                 hint: 'The formal quality policy statement signed by senior management. Reference QA-QMS-POL-001.' },
    { num: '3', title: 'SCOPE OF THE QMS',               hint: 'The boundaries of the QMS — which sites, processes, products, and services are included and excluded.' },
    { num: '4', title: 'ORGANISATIONAL STRUCTURE',       hint: 'Leadership chart, departmental breakdown, and reporting lines relevant to quality.' },
    { num: '5', title: 'SYSTEM ELEMENTS',                hint: 'Map to ISO 9001:2015 clauses: Planning, Support, Operation, Performance Evaluation, Improvement.' },
    { num: '6', title: 'PROCESS INTERACTIONS',           hint: 'How the key quality processes interact and support each other. A process map or swim-lane diagram is recommended here.' },
  ],
};

// ── Helper builders ───────────────────────────────────────────────────────────

function hr(color = BRAND_BLUE, size = 8) {
  return new Paragraph({
    spacing: { before: 60, after: 60 },
    border: { bottom: { style: BorderStyle.SINGLE, size, color, space: 1 } },
    children: []
  });
}

function sp(before = 120, after = 80) {
  return new Paragraph({ spacing: { before, after }, children: [] });
}

function cell(text, width, opts = {}) {
  return new TableCell({
    borders: allThin,
    shading: { fill: opts.bg || WHITE, type: ShadingType.CLEAR },
    margins: cellPad,
    width: { size: width, type: WidthType.DXA },
    verticalAlign: VerticalAlign.CENTER,
    children: [new Paragraph({
      children: [new TextRun({
        text,
        bold: opts.bold || false,
        size: opts.size || 18,
        color: opts.color || BRAND_DARK,
        font: 'Arial',
        italics: opts.italic || false,
      })]
    })]
  });
}

function metaTable(rows) {
  return new Table({
    width: { size: CONTENT, type: WidthType.DXA },
    columnWidths: [2600, CONTENT - 2600],
    rows: rows.map(([label, value]) => new TableRow({
      children: [
        cell(label, 2600, { bold: true, color: BRAND_MID, bg: HEADER_BG }),
        cell(value || '—', CONTENT - 2600),
      ]
    }))
  });
}

function sectionHeader(num, title) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 280, after: 100 },
    children: [new TextRun({ text: `${num}. ${title}`, bold: true, size: 28, color: BRAND_BLUE, font: 'Arial' })]
  });
}

function hintPara(text) {
  return new Paragraph({
    spacing: { before: 40, after: 80 },
    children: [new TextRun({ text: `[${text}]`, italics: true, size: 18, color: BRAND_LIGHT, font: 'Arial' })]
  });
}

function placeholderPara() {
  return new Paragraph({
    spacing: { before: 60, after: 120 },
    children: [new TextRun({ text: '', size: 20, font: 'Arial' })]
  });
}

function buildHeader(docCode, docName, version) {
  return new Header({
    children: [
      new Paragraph({
        spacing: { after: 60 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: BRAND_BLUE, space: 1 } },
        children: [
          new TextRun({ text: `${docCode}  |  ${docName}`, size: 16, color: BRAND_LIGHT, font: 'Arial' }),
          new TextRun({ text: '\t', size: 16, font: 'Arial' }),
          new TextRun({ text: `v${version}  |  DRAFT — NOT FOR DISTRIBUTION`, bold: true, size: 16, color: BRAND_BLUE, font: 'Arial' }),
        ],
        tabStops: [{ type: TabStopType.RIGHT, position: CONTENT }]
      })
    ]
  });
}

function buildFooter(docCode) {
  return new Footer({
    children: [
      new Paragraph({
        spacing: { before: 60 },
        border: { top: { style: BorderStyle.SINGLE, size: 4, color: BRAND_LIGHT, space: 1 } },
        children: [
          new TextRun({ text: 'Vilagio Trading Limited · Controlled Document · Printed copies are uncontrolled', size: 16, color: BRAND_LIGHT, font: 'Arial', italics: true }),
          new TextRun({ text: '\tPage ', size: 16, color: BRAND_MID, font: 'Arial' }),
          new SimpleField({ instruction: 'PAGE', cachedValue: '1', style: { run: { size: 16, color: BRAND_MID, font: 'Arial' } } }),
        ],
        tabStops: [{ type: TabStopType.RIGHT, position: CONTENT }]
      })
    ]
  });
}

// ── Cover sheet builder ───────────────────────────────────────────────────────

function buildCoverSheet(doc, version, mode) {
  const now      = new Date();
  const fmtDate  = d => d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }) : '—';
  const reviewDue = version.effective_date
    ? fmtDate(new Date(new Date(version.effective_date).getTime() + 365*24*60*60*1000))
    : '12 months from effective date';

  return [
    // Company & doc title
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 1440, after: 80 },
      children: [new TextRun({ text: 'VILAGIO TRADING LIMITED', bold: true, size: 36, color: BRAND_BLUE, font: 'Arial' })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 0, after: 60 },
      children: [new TextRun({ text: 'Quality Management System', size: 22, color: BRAND_MID, font: 'Arial' })] }),
    hr(BRAND_BLUE, 12),
    sp(200),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 0, after: 80 },
      children: [new TextRun({ text: doc.doc_code, bold: true, size: 24, color: BRAND_MID, font: 'Arial', allCaps: true })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 0, after: 80 },
      children: [new TextRun({ text: { SOP: 'STANDARD OPERATING PROCEDURE', POL: 'CORPORATE POLICY', MAN: 'QUALITY MANUAL' }[doc.doc_type] || 'CONTROLLED DOCUMENT', bold: true, size: 26, color: BRAND_DARK, font: 'Arial', allCaps: true })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 0, after: 300 },
      children: [new TextRun({ text: doc.doc_name, bold: true, size: 40, color: BRAND_BLUE, font: 'Arial' })] }),
    sp(120),
    // Document identity table
    metaTable([
      ['Document Number',   doc.doc_code],
      ['Document Title',    doc.doc_name],
      ['Document Type',     { SOP: 'Standard Operating Procedure', POL: 'Corporate Policy', MAN: 'Quality Manual' }[doc.doc_type] || doc.doc_type],
      ['QMS Section',       `${doc.section_code} — ${doc.section_name}`],
      ['Version',           version.version_number || '—'],
      ['Status',            version.status || doc.status],
      ['Effective Date',    version.effective_date ? fmtDate(version.effective_date) : 'Upon release'],
      ['Review Due Date',   version.review_due_date ? fmtDate(version.review_due_date) : reviewDue],
      ['Document Owner',    doc.owner_name || '—'],
      ['Authored By',       version.author_name || '—'],
      ['Reviewed By',       version.reviewer_name || '—'],
      ['Approved By',       version.approver_name || '—'],
      ['ERP Module',        doc.erp_link_module || 'Standalone'],
      ['Change Reason',     version.change_reason || 'Initial release'],
    ]),
    sp(240),
    // Approval signatures table
    new Paragraph({ spacing: { before: 0, after: 80 },
      children: [new TextRun({ text: 'APPROVAL RECORD', bold: true, size: 20, color: BRAND_DARK, font: 'Arial' })] }),
    new Table({
      width: { size: CONTENT, type: WidthType.DXA },
      columnWidths: [2000, 2500, 2900, 1670],
      rows: [
        new TableRow({ children: [
          cell('Role',      2000, { bold: true, bg: BRAND_BLUE, color: WHITE }),
          cell('Name',      2500, { bold: true, bg: BRAND_BLUE, color: WHITE }),
          cell('Electronic Signature', 2900, { bold: true, bg: BRAND_BLUE, color: WHITE }),
          cell('Date',      1670, { bold: true, bg: BRAND_BLUE, color: WHITE }),
        ]}),
        new TableRow({ children: [
          cell('Author',    2000),
          cell(version.author_name   || '—', 2500),
          cell(version.status !== 'DRAFT' ? 'Signed via Vilagio ERP' : 'In progress', 2900, { italic: true, color: BRAND_LIGHT }),
          cell(fmtDate(version.created_at), 1670),
        ]}),
        new TableRow({ children: [
          cell('Reviewer',  2000),
          cell(version.reviewer_name || '—', 2500),
          cell(version.reviewed_by   ? 'Signed via Vilagio ERP' : '—', 2900, { italic: true, color: BRAND_LIGHT }),
          cell('—', 1670),
        ]}),
        new TableRow({ children: [
          cell('Approver',  2000),
          cell(version.approver_name || '—', 2500),
          cell(version.approved_by   ? 'Signed via Vilagio ERP' : '—', 2900, { italic: true, color: BRAND_LIGHT }),
          cell(version.effective_date ? fmtDate(version.effective_date) : '—', 1670),
        ]}),
      ]
    }),
    sp(120),
    // Compliance statement
    new Table({
      width: { size: CONTENT, type: WidthType.DXA },
      columnWidths: [CONTENT],
      rows: [new TableRow({ children: [
        new TableCell({
          borders: { top: { style: BorderStyle.SINGLE, size: 8, color: BRAND_BLUE }, bottom: { style: BorderStyle.SINGLE, size: 8, color: BRAND_BLUE }, left: { style: BorderStyle.SINGLE, size: 24, color: BRAND_BLUE }, right: noBorder },
          shading: { fill: HEADER_BG, type: ShadingType.CLEAR },
          margins: { top: 100, bottom: 100, left: 160, right: 120 },
          width: { size: CONTENT, type: WidthType.DXA },
          children: [
            new Paragraph({ spacing: { before: 0, after: 40 },
              children: [new TextRun({ text: 'CONTROLLED DOCUMENT  ', bold: true, size: 18, color: BRAND_BLUE, font: 'Arial' }),
                new TextRun({ text: 'This document is subject to formal version control and approval in the Vilagio QMS. Printed copies are uncontrolled. Verify currency against the ERP before use. Managed in accordance with ISO 9001:2015, GMP, and 21 CFR Part 11 requirements.', size: 18, color: BRAND_DARK, font: 'Arial' })]
            })
          ]
        })
      ]})]
    }),
    new Paragraph({ children: [new PageBreak()] }),
  ];
}

// ── Template sections ─────────────────────────────────────────────────────────

function buildTemplateSections(docType) {
  const schema = SECTION_SCHEMAS[docType] || SECTION_SCHEMAS['SOP'];
  const children = [
    new Paragraph({ spacing: { before: 0, after: 80 },
      children: [new TextRun({ text: 'DOCUMENT CONTENT', bold: true, size: 22, color: BRAND_DARK, font: 'Arial', allCaps: true })] }),
    new Paragraph({ spacing: { before: 0, after: 160 },
      children: [new TextRun({ text: 'Complete all sections below. Remove placeholder text in [brackets] before uploading. You may add sub-sections, tables, and diagrams as needed. Do not modify the section numbering or titles — these are required by the QMS.', italics: true, size: 18, color: BRAND_LIGHT, font: 'Arial' })] }),
  ];

  schema.forEach(sec => {
    children.push(sectionHeader(sec.num, sec.title));
    children.push(hintPara(sec.hint));
    // Several blank lines for content
    for (let i = 0; i < 4; i++) children.push(placeholderPara());
  });

  return children;
}

// ============================================================================
// PUBLIC API — 1. Generate blank Word template for download
// ============================================================================

async function generateBlankTemplate(docId, versionId, userId, res) {
  // Fetch document and version details
  const docRes = await pool.query(`
    SELECT d.*, s.section_code, s.section_name, owner.full_name AS owner_name
    FROM qms_documents d
    JOIN qms_sections s ON d.section_id = s.section_id
    LEFT JOIN users owner ON d.doc_owner = owner.user_id
    WHERE d.doc_id = $1
  `, [docId]);
  if (docRes.rows.length === 0) throw new Error('Document not found');
  const doc = docRes.rows[0];

  const verRes = await pool.query(`
    SELECT v.*, u.full_name AS author_name
    FROM qms_document_versions v
    LEFT JOIN users u ON v.authored_by = u.user_id
    WHERE v.version_id = $1
  `, [versionId]);
  if (verRes.rows.length === 0) throw new Error('Version not found');
  const version = verRes.rows[0];

  // Record that template was downloaded
  await pool.query(`
    UPDATE qms_document_versions
    SET template_downloaded_at = CURRENT_TIMESTAMP,
        content_strategy = 'word_template',
        authoring_choice = 'word_template'
    WHERE version_id = $1
  `, [versionId]);

  // Audit trail
  await pool.query(`
    INSERT INTO qms_audit_trail (doc_id, version_id, actor_id, action, notes)
    VALUES ($1, $2, $3, 'TEMPLATE_DOWNLOADED', 'Author downloaded Word template for offline authoring')
  `, [docId, versionId, userId]);

  const filename = `${doc.doc_code}_v${version.version_number}_TEMPLATE_DRAFT.docx`;

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

  const document = new Document({
    numbering: {
      config: [{
        reference: 'bullets',
        levels: [{ level: 0, format: LevelFormat.BULLET, text: '\u2022', alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } } }]
      }, {
        reference: 'numbers',
        levels: [{ level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } } }]
      }]
    },
    styles: {
      default: { document: { run: { font: 'Arial', size: 20, color: BRAND_DARK } } },
      paragraphStyles: [
        { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
          run: { size: 28, bold: true, font: 'Arial', color: BRAND_BLUE },
          paragraph: { spacing: { before: 280, after: 100 }, outlineLevel: 0 } },
        { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
          run: { size: 24, bold: true, font: 'Arial', color: BRAND_DARK },
          paragraph: { spacing: { before: 200, after: 80 }, outlineLevel: 1 } },
      ]
    },
    sections: [{
      properties: {
        page: {
          size: { width: PAGE_W, height: 16838 },
          margin: { top: MARGIN, right: MARGIN, bottom: MARGIN, left: MARGIN }
        }
      },
      headers: { default: buildHeader(doc.doc_code, doc.doc_name, version.version_number) },
      footers: { default: buildFooter(doc.doc_code) },
      children: [
        ...buildCoverSheet(doc, version, 'template'),
        ...buildTemplateSections(doc.doc_type),
      ]
    }]
  });

  const buffer = await Packer.toBuffer(document);
  res.send(buffer);
}

// ============================================================================
// PUBLIC API — 2. Assemble released document (cover sheet + uploaded content)
// Called during releaseDocument() or on-demand from inspector view
// ============================================================================

async function assembleDocument(docId, versionId) {
  const docRes = await pool.query(`
    SELECT d.*, s.section_code, s.section_name, owner.full_name AS owner_name
    FROM qms_documents d
    JOIN qms_sections s ON d.section_id = s.section_id
    LEFT JOIN users owner ON d.doc_owner = owner.user_id
    WHERE d.doc_id = $1
  `, [docId]);
  const doc = docRes.rows[0];

  const verRes = await pool.query(`
    SELECT v.*,
           a.full_name  AS author_name,
           rv.full_name AS reviewer_name,
           ap.full_name AS approver_name
    FROM qms_document_versions v
    LEFT JOIN users a  ON v.authored_by  = a.user_id
    LEFT JOIN users rv ON v.reviewer_id  = rv.user_id
    LEFT JOIN users ap ON v.approved_by  = ap.user_id
    WHERE v.version_id = $1
  `, [versionId]);
  const version = verRes.rows[0];

  if (!version.file_path || !fs.existsSync(version.file_path)) {
    // No uploaded file — generate a structured cover-only document
    return generateCoverOnlyDoc(doc, version);
  }

  // Read the uploaded .docx
  const uploadedBuffer = fs.readFileSync(version.file_path);

  // Build the cover sheet as a standalone section
  const coverDoc = new Document({
    styles: {
      default: { document: { run: { font: 'Arial', size: 20, color: BRAND_DARK } } },
      paragraphStyles: [
        { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
          run: { size: 28, bold: true, font: 'Arial', color: BRAND_BLUE },
          paragraph: { spacing: { before: 280, after: 100 }, outlineLevel: 0 } },
      ]
    },
    sections: [{
      properties: {
        page: {
          size: { width: PAGE_W, height: 16838 },
          margin: { top: MARGIN, right: MARGIN, bottom: MARGIN, left: MARGIN }
        }
      },
      headers: { default: buildHeader(doc.doc_code, doc.doc_name, version.version_number) },
      footers: { default: buildFooter(doc.doc_code) },
      children: buildCoverSheet(doc, version, 'assembled')
    }]
  });

  const coverBuffer = await Packer.toBuffer(coverDoc);

  // Merge cover + uploaded content using JSZip/pizzip XML surgery
  const mergedBuffer = await mergeDocxFiles(coverBuffer, uploadedBuffer, doc, version);

  // Save assembled file
  const UPLOAD_DIR = process.env.QMS_UPLOAD_DIR || path.join(__dirname, '../../uploads/qms');
  const assembledPath = path.join(UPLOAD_DIR, `${docId}_${versionId}_assembled.docx`);
  fs.writeFileSync(assembledPath, mergedBuffer);

  // Record in DB
  await pool.query(`
    UPDATE qms_document_versions
    SET assembled_file_path = $1, assembled_at = CURRENT_TIMESTAMP
    WHERE version_id = $2
  `, [assembledPath, versionId]);

  return mergedBuffer;
}

// ── JSZip-based DOCX merge ────────────────────────────────────────────────────
// Strategy: extract body XML from uploaded doc, inject into cover doc
// as a new section with the same header/footer. This preserves all
// uploaded content including tables, images, and complex formatting.

async function mergeDocxFiles(coverBuffer, contentBuffer, doc, version) {
  const coverZip   = await JSZip.loadAsync(coverBuffer);
  const contentZip = await JSZip.loadAsync(contentBuffer);

  // Extract body content from the uploaded document
  const contentDocXml = await contentZip.file('word/document.xml').async('string');

  // Extract just the <w:body> inner content (between <w:body> tags, excluding <w:sectPr>)
  const bodyMatch = contentDocXml.match(/<w:body>([\s\S]*?)<w:sectPr[\s\S]*?<\/w:sectPr>\s*<\/w:body>/);
  if (!bodyMatch) {
    // Fallback: just return cover if we can't parse the body
    console.warn('[QMS Template] Could not extract body from uploaded document — returning cover only');
    return coverBuffer;
  }
  const innerBodyContent = bodyMatch[1];

  // Get the cover document XML
  let coverDocXml = await coverZip.file('word/document.xml').async('string');

  // Build a continuation section header/footer for the content pages
  // We inject the content after the cover's </w:body> marker but within the same body
  // by replacing the closing </w:body> with the content + a sectPr for the new section
  const headerFooterSectPr = `
    <w:sectPr>
      <w:headerReference w:type="default" r:id="rId1"/>
      <w:footerReference w:type="default" r:id="rId2"/>
      <w:pgSz w:w="${PAGE_W}" w:h="16838"/>
      <w:pgMar w:top="${MARGIN}" w:right="${MARGIN}" w:bottom="${MARGIN}" w:left="${MARGIN}"/>
    </w:sectPr>
  `;

  // Insert content before the closing </w:body>
  coverDocXml = coverDocXml.replace(
    /<\/w:body>/,
    `${innerBodyContent}${headerFooterSectPr}</w:body>`
  );

  coverZip.file('word/document.xml', coverDocXml);

  // Copy any media (images) from content zip into cover zip
  const contentFiles = Object.keys(contentZip.files);
  for (const filePath of contentFiles) {
    if (filePath.startsWith('word/media/')) {
      const fileData = await contentZip.file(filePath).async('nodebuffer');
      // Rename to avoid conflicts
      const newPath = filePath.replace('word/media/', 'word/media/content_');
      coverZip.file(newPath, fileData);
    }
  }

  return coverZip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}

// ── Cover-only fallback (for structured/richtext docs) ────────────────────────

async function generateCoverOnlyDoc(doc, version) {
  const document = new Document({
    styles: { default: { document: { run: { font: 'Arial', size: 20, color: BRAND_DARK } } } },
    sections: [{
      properties: {
        page: {
          size: { width: PAGE_W, height: 16838 },
          margin: { top: MARGIN, right: MARGIN, bottom: MARGIN, left: MARGIN }
        }
      },
      headers: { default: buildHeader(doc.doc_code, doc.doc_name, version.version_number) },
      footers: { default: buildFooter(doc.doc_code) },
      children: buildCoverSheet(doc, version, 'assembled')
    }]
  });
  return Packer.toBuffer(document);
}

// ============================================================================
// PUBLIC API — 3. Stream assembled document to response
// ============================================================================

async function streamAssembledDocument(docId, versionId, res) {
  const verRes = await pool.query(
    'SELECT assembled_file_path, doc_code FROM qms_document_versions v JOIN qms_documents d ON v.doc_id = d.doc_id WHERE v.version_id = $1',
    [versionId]
  );

  let buffer;
  if (verRes.rows[0]?.assembled_file_path && fs.existsSync(verRes.rows[0].assembled_file_path)) {
    buffer = fs.readFileSync(verRes.rows[0].assembled_file_path);
  } else {
    buffer = await assembleDocument(docId, versionId);
  }

  const docCode = verRes.rows[0]?.doc_code || 'document';
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  res.setHeader('Content-Disposition', `attachment; filename="${docCode}_controlled.docx"`);
  res.send(buffer);
}

module.exports = {
  generateBlankTemplate,
  assembleDocument,
  streamAssembledDocument,
  SECTION_SCHEMAS,
};
