/**
 * Report export: Excel (.xlsx), PDF and CSV from one column definition.
 *
 * columns: [{ key, header, type, width, pdf }]
 *   type  : 'text' (default) | 'code' | 'date' | 'money' | 'int' | 'status'
 *   width : Excel column width (characters)
 *   pdf   : relative column width in the PDF table; omit / false = column not shown in the PDF
 *           (the PDF is A4 landscape, so it shows the key columns; Excel has every column)
 *   xlsx  : false = PDF-only column (not in Excel / CSV)
 */
const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const { APP_TZ } = require('../db');

const FONT_DIR = path.join(__dirname, '..', '..', 'fonts');
const LOGO = path.join(__dirname, '..', '..', '..', 'frontend', 'public', 'icon-192.png');
const BRAND = '#4F46E5';

const STATUS = {
  active: 'In use', repair: 'Under repair', broken: 'Broken', spare: 'Spare', lost: 'Lost', disposed: 'Disposed',
  open: 'Open', in_progress: 'In progress', waiting_parts: 'Waiting parts', done: 'Done', cancelled: 'Cancelled',
  pass: 'Pass', issue: 'Issue', fail: 'Fail', low: 'Low', normal: 'Normal', high: 'High', urgent: 'Urgent',
};

// ---------- value helpers ----------
const isEmpty = (v) => v === null || v === undefined || v === '';
const dmy = (s) => { const m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${m[3]}/${m[2]}/${m[1]}` : String(s); };
const money = (n) => Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const nowText = () => new Intl.DateTimeFormat('en-GB', { timeZone: APP_TZ, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date());
const fileStamp = () => new Intl.DateTimeFormat('en-CA', { timeZone: APP_TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

/** Display text for a cell (PDF / CSV) */
function textOf(col, v) {
  if (isEmpty(v)) return '';
  if (col.type === 'date') return dmy(v);
  if (col.type === 'money') return money(v);
  if (col.type === 'status') return STATUS[v] || String(v);
  return typeof v === 'object' ? JSON.stringify(v) : String(v);
}

/** Native value for an Excel cell (real numbers and dates, so Excel can sort / sum) */
function excelOf(col, v) {
  if (isEmpty(v)) return null;
  if (col.type === 'date') { const m = String(v).match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])) : String(v); }
  if (col.type === 'money' || col.type === 'int') return Number(v);
  if (col.type === 'status') return STATUS[v] || String(v);
  return typeof v === 'object' ? JSON.stringify(v) : String(v);
}

function sendFile(res, buf, filename, type) {
  res.setHeader('Content-Type', type);
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Content-Length', buf.length);
  res.end(buf);
}

// ---------- CSV ----------
function buildCsv({ columns: all, rows }) {
  const columns = all.filter((c) => c.xlsx !== false);
  const cell = (s) => (/[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  const lines = [columns.map((c) => cell(c.header)).join(',')];
  for (const r of rows) lines.push(columns.map((c) => cell(textOf(c, r[c.key]))).join(','));
  return Buffer.from('﻿' + lines.join('\r\n'), 'utf8');
}

// ---------- Excel ----------
async function buildXlsx({ title, org, columns: all, rows, filters, summary }) {
  const columns = all.filter((c) => c.xlsx !== false);
  const wb = new ExcelJS.Workbook();
  wb.creator = org || 'Asset PRC';
  wb.created = new Date();
  const ws = wb.addWorksheet(title.slice(0, 31), {
    pageSetup: { orientation: 'landscape', paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.3, right: 0.3, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 } },
    headerFooter: { oddFooter: `&L${org || 'Asset PRC'} · ${title}&RPage &P of &N` },
  });
  const n = columns.length;
  const last = ws.getColumn(n).letter;

  ws.mergeCells(`A1:${last}1`);
  Object.assign(ws.getCell('A1'), { value: `${org ? org + ' — ' : ''}${title}` });
  ws.getCell('A1').font = { name: 'Calibri', size: 16, bold: true, color: { argb: 'FF1E1B4B' } };
  ws.getRow(1).height = 26;
  ws.mergeCells(`A2:${last}2`);
  ws.getCell('A2').value = [`Generated ${nowText()} (Cambodia time)`, `${rows.length} record${rows.length === 1 ? '' : 's'}`, filters].filter(Boolean).join('   ·   ');
  ws.getCell('A2').font = { size: 10, color: { argb: 'FF64748B' } };

  const H = 4; // header row
  const header = ws.getRow(H);
  columns.forEach((c, i) => {
    const cell = header.getCell(i + 1);
    cell.value = c.header;
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } };
    cell.alignment = { vertical: 'middle', horizontal: c.type === 'money' || c.type === 'int' ? 'right' : 'left', wrapText: true };
    cell.border = { bottom: { style: 'thin', color: { argb: 'FF3730A3' } } };
    ws.getColumn(i + 1).width = c.width || 16;
  });
  header.height = 24;

  const thin = { style: 'thin', color: { argb: 'FFE2E8F0' } };
  rows.forEach((r, k) => {
    const row = ws.getRow(H + 1 + k);
    columns.forEach((c, i) => {
      const cell = row.getCell(i + 1);
      cell.value = excelOf(c, r[c.key]);
      if (c.type === 'money') cell.numFmt = '#,##0.00';
      if (c.type === 'date') cell.numFmt = 'dd/mm/yyyy';
      if (c.type === 'code') cell.font = { name: 'Consolas', color: { argb: 'FF4338CA' } };
      cell.alignment = { vertical: 'top', wrapText: c.type === 'text' || c.type === undefined, horizontal: c.type === 'money' || c.type === 'int' ? 'right' : 'left' };
      cell.border = { bottom: thin };
      if (k % 2 === 1) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
    });
  });

  // total row for money columns
  const moneyCols = columns.map((c, i) => (c.type === 'money' ? i + 1 : 0)).filter(Boolean);
  if (rows.length && moneyCols.length) {
    const tr = ws.getRow(H + rows.length + 1);
    tr.getCell(1).value = 'Total';
    for (const i of moneyCols) {
      const L = ws.getColumn(i).letter;
      tr.getCell(i).value = { formula: `SUM(${L}${H + 1}:${L}${H + rows.length})`, result: rows.reduce((s, r) => s + Number(r[columns[i - 1].key] || 0), 0) };
      tr.getCell(i).numFmt = '#,##0.00';
    }
    tr.eachCell((cell) => { cell.font = { bold: true }; cell.border = { top: { style: 'thin', color: { argb: 'FF4F46E5' } } }; });
  }
  if (summary?.length) {
    const sr = H + rows.length + (moneyCols.length && rows.length ? 3 : 2);
    summary.forEach((s, k) => { ws.getCell(`A${sr + k}`).value = s; ws.getCell(`A${sr + k}`).font = { italic: true, color: { argb: 'FF64748B' } }; });
  }

  ws.views = [{ state: 'frozen', ySplit: H, xSplit: 1 }];
  ws.autoFilter = { from: { row: H, column: 1 }, to: { row: H, column: n } };
  return Buffer.from(await wb.xlsx.writeBuffer());
}

// ---------- PDF ----------
// Text is drawn run by run so Latin, Thai and Khmer each use a font that has their letters.
const SCRIPT_RE = /([฀-๿]+|[ក-៿᧠-᧿]+)/;
const fontFor = (seg, bold) => {
  const w = bold ? 'B' : 'R';
  if (/[฀-๿]/.test(seg)) return `thai${w}`;
  if (/[ក-៿᧠-᧿]/.test(seg)) return `khmer${w}`;
  return `latin${w}`;
};
const runsOf = (s) => String(s).split(SCRIPT_RE).filter((x) => x !== '');

// If a font's mark-positioning table trips the PDF library on some letter combination,
// fall back to laying out that piece without mark positioning instead of failing the whole export.
const NO_MARKS = { features: { mark: false, mkmk: false } };
function widthOf(doc, seg) {
  try { return doc.widthOfString(seg); } catch { return doc.widthOfString(seg, NO_MARKS); }
}
function textAt(doc, seg, x, y) {
  try { doc.text(seg, x, y, { lineBreak: false }); } catch { doc.text(seg, x, y, { lineBreak: false, ...NO_MARKS }); }
}

function measure(doc, s, bold, size) {
  let w = 0;
  for (const seg of runsOf(s)) { doc.font(fontFor(seg, bold)).fontSize(size); w += widthOf(doc, seg); }
  return w;
}

/** Split a long word into pieces that fit, never separating a combining mark from its letter */
function breakWord(doc, word, width, bold, size) {
  const chars = word.match(/\P{M}\p{M}*/gu) || [word];
  const out = []; let cur = '';
  for (const ch of chars) {
    if (cur && measure(doc, cur + ch, bold, size) > width) { out.push(cur); cur = ch; } else cur += ch;
  }
  if (cur) out.push(cur);
  return out;
}

/** Word-wrap text into lines that fit `width`; at most `maxLines` (the last one gets an ellipsis) */
function wrap(doc, text, width, { bold = false, size = 8, maxLines = 4 } = {}) {
  const lines = [];
  for (const para of String(text).split(/\r?\n/)) {
    let line = '';
    for (const word of para.split(/(\s+)/).filter((x) => x !== '')) {
      const tryLine = line + word;
      if (measure(doc, tryLine, bold, size) <= width) { line = tryLine; continue; }
      if (line.trim()) lines.push(line.trimEnd());
      line = '';
      if (/^\s+$/.test(word)) continue;
      if (measure(doc, word, bold, size) > width) {
        const parts = breakWord(doc, word, width, bold, size);
        lines.push(...parts.slice(0, -1));
        line = parts[parts.length - 1];
      } else line = word;
    }
    lines.push(line.trimEnd());
  }
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    let l = kept[maxLines - 1];
    while (l && measure(doc, l + '…', bold, size) > width) l = l.slice(0, -1);
    kept[maxLines - 1] = l + '…';
    return kept;
  }
  return lines;
}

function drawLine(doc, s, x, y, { bold = false, size = 8, color = '#1E293B', align = 'left', width = 0 } = {}) {
  let cx = align === 'right' ? x + width - measure(doc, s, bold, size) : x;
  doc.fillColor(color);
  for (const seg of runsOf(s)) {
    doc.font(fontFor(seg, bold)).fontSize(size);
    textAt(doc, seg, cx, y);
    cx += widthOf(doc, seg);
  }
}

function buildPdf({ title, org, orgSub, columns, rows, filters, summary }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 28, bufferPages: true, info: { Title: title, Author: org || 'Asset PRC' } });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    for (const [name, file] of [['latinR', 'NotoSans-Regular'], ['latinB', 'NotoSans-Bold'], ['thaiR', 'NotoSansThai-Regular'], ['thaiB', 'NotoSansThai-Bold'], ['khmerR', 'Battambang-Regular'], ['khmerB', 'Battambang-Bold']]) {
      doc.registerFont(name, path.join(FONT_DIR, `${file}.ttf`));
    }

    const cols = columns.filter((c) => c.pdf);
    const L = doc.page.margins.left;
    const R = doc.page.width - doc.page.margins.right;
    const W = R - L;
    const total = cols.reduce((s, c) => s + c.pdf, 0);
    const widths = cols.map((c) => (c.pdf / total) * W);
    const PAD = 4; const SIZE = 7.5; const LH = SIZE * 1.45;
    const bottom = doc.page.height - doc.page.margins.bottom - 18;

    // --- report header (first page) ---
    let y = doc.page.margins.top;
    doc.rect(L, y, W, 58).fill('#EEF2FF');
    let tx = L + 12;
    if (fs.existsSync(LOGO)) { doc.image(LOGO, L + 10, y + 7, { height: 44 }); tx = L + 64; }
    drawLine(doc, org || 'Asset PRC', tx, y + 9, { bold: true, size: 14, color: '#1E1B4B' });
    drawLine(doc, orgSub || 'Asset Registry System', tx, y + 29, { size: 8.5, color: '#64748B' });
    drawLine(doc, title, L, y + 9, { bold: true, size: 15, color: BRAND, align: 'right', width: W - 12 });
    drawLine(doc, `Generated ${nowText()} (Cambodia time)  ·  ${rows.length} record${rows.length === 1 ? '' : 's'}`, L, y + 31, { size: 8, color: '#475569', align: 'right', width: W - 12 });
    y += 64;
    if (filters) { drawLine(doc, `Filters: ${filters}`, L, y, { size: 7.5, color: '#64748B' }); y += 13; }
    if (summary?.length) { drawLine(doc, summary.join('   ·   '), L, y, { bold: true, size: 8, color: '#334155' }); y += 13; }
    y += 2;

    const drawHeader = () => {
      const hLines = cols.map((c, i) => wrap(doc, c.header, widths[i] - PAD * 2, { bold: true, size: SIZE, maxLines: 2 }));
      const h = Math.max(...hLines.map((l) => l.length)) * LH + PAD * 2;
      doc.rect(L, y, W, h).fill(BRAND);
      let x = L;
      cols.forEach((c, i) => {
        hLines[i].forEach((ln, k) => drawLine(doc, ln, x + PAD, y + PAD + k * LH, { bold: true, size: SIZE, color: '#FFFFFF', align: c.type === 'money' || c.type === 'int' ? 'right' : 'left', width: widths[i] - PAD * 2 }));
        x += widths[i];
      });
      y += h;
    };
    drawHeader();

    if (!rows.length) {
      drawLine(doc, 'No records match the selected filters.', L + PAD, y + 10, { size: 9, color: '#64748B' });
    }
    rows.forEach((r, k) => {
      const lines = cols.map((c, i) => wrap(doc, textOf(c, r[c.key]) || '—', widths[i] - PAD * 2, { size: SIZE, bold: c.type === 'code' }));
      const h = Math.max(...lines.map((l) => l.length)) * LH + PAD * 2;
      if (y + h > bottom) { doc.addPage(); y = doc.page.margins.top; drawHeader(); }
      if (k % 2 === 1) doc.rect(L, y, W, h).fill('#F8FAFC');
      doc.moveTo(L, y + h).lineTo(R, y + h).lineWidth(0.5).strokeColor('#E2E8F0').stroke();
      let x = L;
      cols.forEach((c, i) => {
        const color = c.type === 'code' ? '#4338CA' : isEmpty(r[c.key]) ? '#CBD5E1' : '#1E293B';
        lines[i].forEach((ln, j) => drawLine(doc, ln, x + PAD, y + PAD + j * LH, { size: SIZE, bold: c.type === 'code', color, align: c.type === 'money' || c.type === 'int' ? 'right' : 'left', width: widths[i] - PAD * 2 }));
        x += widths[i];
      });
      y += h;
    });

    // --- footer on every page ---
    const range = doc.bufferedPageRange();
    for (let p = range.start; p < range.start + range.count; p++) {
      doc.switchToPage(p);
      const fy = doc.page.height - doc.page.margins.bottom - 8;
      doc.moveTo(L, fy - 4).lineTo(R, fy - 4).lineWidth(0.5).strokeColor('#E2E8F0').stroke();
      drawLine(doc, `${org || 'Asset PRC'} · ${title}`, L, fy, { size: 7, color: '#94A3B8' });
      drawLine(doc, `Page ${p + 1} of ${range.count}`, L, fy, { size: 7, color: '#94A3B8', align: 'right', width: W });
    }
    doc.end();
  });
}

/**
 * Send a report in the requested format.
 * @param {object} opt { format: 'xlsx'|'pdf'|'csv', name: file base name, title, org, orgSub, columns, rows, filters, summary }
 */
async function sendReport(res, opt) {
  const format = ['pdf', 'csv'].includes(opt.format) ? opt.format : 'xlsx';
  const base = `${opt.name}-${fileStamp()}`;
  if (format === 'csv') return sendFile(res, buildCsv(opt), `${base}.csv`, 'text/csv; charset=utf-8');
  if (format === 'pdf') return sendFile(res, await buildPdf(opt), `${base}.pdf`, 'application/pdf');
  return sendFile(res, await buildXlsx(opt), `${base}.xlsx`, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
}

/** Register the Latin / Thai / Khmer fonts used by drawLine / wrap / measure */
function registerFonts(doc) {
  for (const [name, file] of [['latinR', 'NotoSans-Regular'], ['latinB', 'NotoSans-Bold'], ['thaiR', 'NotoSansThai-Regular'], ['thaiB', 'NotoSansThai-Bold'], ['khmerR', 'Battambang-Regular'], ['khmerB', 'Battambang-Bold']]) {
    doc.registerFont(name, path.join(FONT_DIR, `${file}.ttf`));
  }
}

module.exports = {
  sendReport, sendFile, STATUS, money,
  // shared PDF helpers (used by the one-page-per-asset report)
  pdf: { registerFonts, drawLine, wrap, measure, dmy, nowText, fileStamp, LOGO, BRAND },
};
