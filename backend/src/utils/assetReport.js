/**
 * Asset Report PDF — one A4 page per asset:
 *   header band · name + asset code + QR · key dates & cost · asset details · maintenance summary · notes · photos
 */
const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');
const sharp = require('sharp');
const { APP_TZ } = require('../db');
const { STATUS, money, pdf } = require('./export');

const { registerFonts, drawLine, wrap, measure, dmy, nowText, LOGO, BRAND } = pdf;
const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR || path.join(__dirname, '..', '..', 'uploads'));

const PAGE_W = 595.28; const PAGE_H = 841.89; const M = 36; const CW = PAGE_W - M * 2;
const INK = '#0F172A'; const MUTED = '#64748B'; const LINE = '#E2E8F0'; const SOFT = '#F8FAFC';
const PHOTO_W = (CW - 3 * 8) / 4; const PHOTO_H = 66;

const STATUS_TONE = {
  active: ['#ECFDF5', '#047857'], repair: ['#FFFBEB', '#B45309'], broken: ['#FFF1F2', '#BE123C'],
  spare: ['#F0F9FF', '#0369A1'], lost: ['#F1F5F9', '#475569'], disposed: ['#F1F5F9', '#475569'],
};
const RESULT_TONE = { pass: '#047857', issue: '#B45309', fail: '#BE123C' };

// ---------- value helpers ----------
const todayStr = () => new Intl.DateTimeFormat('en-CA', { timeZone: APP_TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const daysUntil = (d) => (d ? Math.round((Date.parse(`${String(d).slice(0, 10)}T00:00:00Z`) - Date.parse(`${todayStr()}T00:00:00Z`)) / 86400000) : null);
const dateText = (d) => (d ? dmy(d) : '—');
const stampText = (d) => (d ? new Intl.DateTimeFormat('en-GB', { timeZone: APP_TZ, day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(d)) : '—');
const val = (...parts) => parts.filter((x) => x !== null && x !== undefined && String(x).trim() !== '').join(' · ') || '—';

/** Photo → JPEG cropped to the box's aspect ratio (handles .webp, phone rotation, and keeps the PDF small) */
async function loadPhoto(src, w, h) {
  try {
    const file = path.join(UPLOAD_DIR, path.basename(String(src))); // never leave the uploads folder
    if (!fs.existsSync(file)) return null;
    return await sharp(file).rotate().resize(Math.round(w * 3), Math.round(h * 3), { fit: 'cover', position: 'attention' }).jpeg({ quality: 78, mozjpeg: true }).toBuffer();
  } catch { return null; }
}

/** Prepare QR codes and photos for every asset before drawing (PDFKit itself is synchronous) */
async function prepare(assets, base) {
  return Promise.all(assets.map(async (a) => ({
    qr: await QRCode.toBuffer(`${base}/a/${encodeURIComponent(a.code)}`, { errorCorrectionLevel: 'M', margin: 1, width: 360, color: { dark: '#0F172A', light: '#FFFFFF' } }),
    photos: (await Promise.all((Array.isArray(a.images) ? a.images : []).slice(0, 4).map((s) => loadPhoto(s, PHOTO_W, PHOTO_H)))).filter(Boolean),
  })));
}

// ---------- drawing helpers ----------
function card(doc, x, y, w, h, { fill = '#FFFFFF', stroke = LINE, r = 8 } = {}) {
  doc.roundedRect(x, y, w, h, r).lineWidth(0.8).fillAndStroke(fill, stroke);
}

/** Pill label, returns its width */
function chip(doc, text, x, y, [bg, fg]) {
  const w = measure(doc, text, true, 7.5) + 14;
  doc.roundedRect(x, y, w, 16, 8).fill(bg);
  drawLine(doc, text, x + 7, y + 3.2, { bold: true, size: 7.5, color: fg });
  return w;
}

function sectionTitle(doc, title, y) {
  doc.roundedRect(M, y + 1, 3, 11, 1.5).fill(BRAND);
  drawLine(doc, title, M + 9, y - 1, { bold: true, size: 10, color: '#1E1B4B' });
  return y + 18;
}

/** Label + value cell; value wraps to at most `lines` lines */
function field(doc, label, value, x, y, w, { lines = 2, color = INK, size = 9 } = {}) {
  drawLine(doc, label, x, y, { size: 7, color: MUTED });
  const empty = !value || value === '—';
  wrap(doc, empty ? '—' : value, w, { size, maxLines: lines }).forEach((ln, i) => drawLine(doc, ln, x, y + 11 + i * (size + 3), { size, color: empty ? '#CBD5E1' : color }));
}

// ---------- one asset page ----------
function drawAsset(doc, a, extra, { org, orgSub, generated }) {
  doc.addPage({ size: 'A4', margin: 0 });

  // header band
  doc.rect(0, 0, PAGE_W, 66).fill('#1E1B4B');
  doc.rect(0, 66, PAGE_W, 3).fill(BRAND);
  let tx = M;
  if (fs.existsSync(LOGO)) {
    doc.roundedRect(M, 13, 40, 40, 9).fill('#FFFFFF');
    doc.image(LOGO, M + 3, 16, { fit: [34, 34], align: 'center', valign: 'center' });
    tx = M + 52;
  }
  drawLine(doc, org, tx, 17, { bold: true, size: 13, color: '#FFFFFF' });
  drawLine(doc, orgSub, tx, 36, { size: 8, color: '#C7D2FE' });
  drawLine(doc, 'ASSET REPORT', M, 17, { bold: true, size: 13, color: '#FFFFFF', align: 'right', width: CW });
  drawLine(doc, `Generated ${generated}`, M, 36, { size: 8, color: '#C7D2FE', align: 'right', width: CW });

  // ---- hero: chips, name, asset code, brand · model | QR ----
  // compact: chips · name · [code box] brand·model  |  small QR
  let y = 84;
  const HERO_H = 100;
  card(doc, M, y, CW, HERO_H, { r: 10 });
  const QR = 64;                          // QR image size
  const qx = M + CW - 14 - QR;            // QR sits inside the card, no separate panel
  const leftW = qx - (M + 16) - 16;
  let cx = M + 16;
  cx += chip(doc, STATUS[a.status] || a.status || '—', cx, y + 13, STATUS_TONE[a.status] || STATUS_TONE.lost) + 5;
  if (a.category_name) cx += chip(doc, val(a.category_code, a.category_name), cx, y + 13, ['#EEF2FF', '#4338CA']) + 5;
  if (a.type_name && cx < qx - 70) chip(doc, val(a.type_number, a.type_name), cx, y + 13, [SOFT, '#475569']);

  const name = wrap(doc, a.name || '—', leftW, { bold: true, size: 15, maxLines: 1 })[0];
  drawLine(doc, name, M + 16, y + 35, { bold: true, size: 15, color: INK });

  const hy = y + 62;
  doc.font('Courier-Bold').fontSize(12.5);
  const codeW = doc.widthOfString(a.code) + 18;
  doc.roundedRect(M + 16, hy, codeW, 23, 5).lineWidth(0.8).fillAndStroke('#EEF2FF', '#C7D2FE');
  doc.fillColor('#4338CA').font('Courier-Bold').fontSize(12.5).text(a.code, M + 25, hy + 6.5, { lineBreak: false });
  const bm = val(a.brand, a.model);
  if (bm !== '—') drawLine(doc, bm, M + 16 + codeW + 12, hy + 6, { size: 8.5, color: MUTED });

  // small QR, top-right
  doc.image(extra.qr, qx, y + 12, { width: QR, height: QR });
  drawLine(doc, 'Scan to verify', qx, y + 12 + QR + 4, { size: 6.5, color: MUTED, align: 'right', width: QR / 2 + measure(doc, 'Scan to verify', false, 6.5) / 2 });

  // ---- key figures ----
  y += HERO_H + 10;
  const KW = (CW - 3 * 8) / 4; const KH = 48;
  const due = daysUntil(a.next_inspection);
  const closed = ['disposed', 'lost'].includes(a.status);
  const dueText = due === null || closed ? null : due < 0 ? [`Overdue ${-due} day${-due === 1 ? '' : 's'}`, '#BE123C'] : due === 0 ? ['Due today', '#B45309'] : [`In ${due} day${due === 1 ? '' : 's'}`, '#047857'];
  const warrantyLeft = daysUntil(a.warranty_expiry);
  const kpis = [
    ['Next inspection', dateText(a.next_inspection), dueText],
    ['Last inspection', dateText(a.last_inspection || extra.lastInspected), extra.lastResult ? [STATUS[extra.lastResult] || extra.lastResult, RESULT_TONE[extra.lastResult] || MUTED] : null],
    ['Cost (THB)', a.cost ? money(a.cost) : '—', null],
    ['Warranty expiry', dateText(a.warranty_expiry), warrantyLeft === null ? null : warrantyLeft < 0 ? ['Expired', '#BE123C'] : [`${warrantyLeft} days left`, '#047857']],
  ];
  kpis.forEach(([label, value, sub], i) => {
    const x = M + i * (KW + 8);
    card(doc, x, y, KW, KH, { fill: SOFT });
    drawLine(doc, label, x + 10, y + 8, { size: 7, color: MUTED });
    drawLine(doc, value, x + 10, y + 19, { bold: true, size: 10.5, color: value === '—' ? '#CBD5E1' : INK });
    if (sub) drawLine(doc, sub[0], x + 10, y + 34, { bold: true, size: 7, color: sub[1] });
  });

  // ---- asset details (3 × 4 grid) ----
  y = sectionTitle(doc, 'Asset details', y + KH + 12);
  const ROW = 30; const PADX = 14; const colW = (CW - PADX * 2) / 3;
  const details = [
    ['Company', val(a.company_code, a.company_name)],
    ['Department', val(a.department_no, a.department_name)],
    ['Year', a.year_code && a.year_code !== '00' ? `${a.year_code} (20${a.year_code})` : a.year_code === '00' ? '00 · fully depreciated' : '—'],
    ['Serial number', val(a.serial_number)],
    ['Location', val(a.building, a.floor, a.location_name)],
    ['Custodian', a.custodian_name ? `${a.custodian_name}${a.custodian_code ? ` (${a.custodian_code})` : ''}` : '—'],
    ['Purchase date', dateText(a.purchase_date)],
    ['Vendor', val(a.vendor)],
    ['PO / reference no.', val(a.po_number)],
    ['Inspection cycle', a.inspection_months ? `Every ${a.inspection_months} month${a.inspection_months === 1 ? '' : 's'}` : '—'],
    ['Registered by', val(a.created_by_name, stampText(a.created_at))],
    ['Last updated', stampText(a.updated_at || a.created_at)],
  ];
  const DH = 12 + Math.ceil(details.length / 3) * ROW + 2;
  card(doc, M, y, CW, DH);
  details.forEach(([label, value], i) => {
    const r = Math.floor(i / 3); const c = i % 3;
    field(doc, label, value, M + PADX + c * colW, y + 11 + r * ROW, colW - 10, { lines: 1 });
  });
  for (let r = 1; r < Math.ceil(details.length / 3); r++) {
    doc.moveTo(M + PADX, y + 6 + r * ROW).lineTo(M + CW - PADX, y + 6 + r * ROW).lineWidth(0.5).strokeColor('#F1F5F9').stroke();
  }

  // ---- maintenance summary ----
  y = sectionTitle(doc, 'Maintenance summary', y + DH + 12);
  const SH = 40;
  card(doc, M, y, CW, SH);
  const sw = (CW - PADX * 2) / 4;
  [
    ['Inspections', String(extra.inspections || 0), INK],
    ['Last result', extra.lastResult ? STATUS[extra.lastResult] || extra.lastResult : '—', RESULT_TONE[extra.lastResult] || INK],
    ['Repair jobs (open)', `${extra.repairs || 0}  (${extra.openRepairs || 0} open)`, extra.openRepairs ? '#B45309' : INK],
    ['Repair cost (THB)', extra.repairCost ? money(extra.repairCost) : '—', INK],
  ].forEach(([label, value, color], i) => {
    const x = M + PADX + i * sw;
    if (i) doc.moveTo(x - 8, y + 9).lineTo(x - 8, y + SH - 9).lineWidth(0.5).strokeColor(LINE).stroke();
    drawLine(doc, label, x, y + 8, { size: 7, color: MUTED });
    drawLine(doc, value, x, y + 19, { bold: true, size: 10, color: value === '—' ? '#CBD5E1' : color });
  });

  // ---- notes / remarks: large writing area; saved notes first, ruled lines for the rest ----
  y = sectionTitle(doc, 'Notes / Remarks', y + SH + 12);
  const NH = 100; const NL = 16; // box height, line spacing
  card(doc, M, y, CW, NH);
  let firstRule = 1;
  if (a.notes && String(a.notes).trim()) {
    const lines = wrap(doc, String(a.notes).trim(), CW - PADX * 2, { size: 8.5, maxLines: 4 });
    lines.forEach((ln, i) => drawLine(doc, ln, M + PADX, y + 6 + i * NL, { size: 8.5, color: '#334155' }));
    firstRule = lines.length + 1;
  }
  for (let i = firstRule; i * NL + 4 < NH - 4; i++) {
    doc.moveTo(M + PADX, y + i * NL + 4).lineTo(M + CW - PADX, y + i * NL + 4).lineWidth(0.5).dash(2, { space: 2 }).strokeColor('#CBD5E1').stroke().undash();
  }

  // ---- photos (up to 4, cropped to equal boxes) ----
  y = sectionTitle(doc, 'Photos', y + NH + 12);
  if (!extra.photos.length) {
    card(doc, M, y, CW, PHOTO_H, { fill: SOFT });
    drawLine(doc, 'No photos attached', M, y + PHOTO_H / 2 - 5, { size: 8.5, color: '#94A3B8', align: 'right', width: CW / 2 + measure(doc, 'No photos attached', false, 8.5) / 2 });
  }
  extra.photos.forEach((buf, i) => {
    const x = M + i * (PHOTO_W + 8);
    doc.save();
    doc.roundedRect(x, y, PHOTO_W, PHOTO_H, 8).clip();
    doc.image(buf, x, y, { width: PHOTO_W, height: PHOTO_H });
    doc.restore();
    doc.roundedRect(x, y, PHOTO_W, PHOTO_H, 8).lineWidth(0.8).strokeColor(LINE).stroke();
    if (i === 0) chip(doc, 'Main', x + 6, y + 6, ['#1E1B4B', '#FFFFFF']);
  });

  // ---- signatures: Requested by / Approved by / Received by ----
  y += PHOTO_H + 14;
  const GAP = 18; const SW = (CW - GAP * 2) / 3;
  ['Requested by', 'Approved by', 'Received by'].forEach((label, i) => {
    const x = M + i * (SW + GAP);
    drawLine(doc, `${label}:`, x, y, { bold: true, size: 8.5, color: '#1E1B4B' });
    doc.moveTo(x, y + 40).lineTo(x + SW, y + 40).lineWidth(0.8).strokeColor('#94A3B8').stroke();   // signature
    drawLine(doc, 'Signature', x, y + 43, { size: 6.5, color: '#94A3B8' });
    drawLine(doc, 'Name: ______________________', x, y + 56, { size: 7.5, color: MUTED });
    drawLine(doc, 'Date: ____ / ____ / ________', x, y + 68, { size: 7.5, color: MUTED });
  });
}

/**
 * Build the report.
 * @param {object[]} assets rows from ASSET_SELECT
 * @param {Map<number, object>} stats per asset id: { inspections, lastInspected, lastResult, repairs, openRepairs, repairCost }
 * @param {object} opt { org, orgSub, base } — base = site address used in the QR links
 */
async function buildAssetReport(assets, stats, { org, orgSub, base }) {
  const prepared = await prepare(assets, base);
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 0, autoFirstPage: false, bufferPages: true, info: { Title: 'Asset Report', Author: org } });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    registerFonts(doc);

    const generated = `${nowText()} (Cambodia time)`;
    assets.forEach((a, i) => drawAsset(doc, a, { ...(stats.get(a.id) || {}), ...prepared[i] }, { org, orgSub, generated }));
    if (!assets.length) {
      doc.addPage({ size: 'A4', margin: 0 });
      drawLine(doc, 'No records selected.', M, 80, { size: 11, color: MUTED });
    }

    // footer on every page
    const range = doc.bufferedPageRange();
    for (let p = range.start; p < range.start + range.count; p++) {
      doc.switchToPage(p);
      const fy = PAGE_H - 28;
      doc.moveTo(M, fy - 6).lineTo(PAGE_W - M, fy - 6).lineWidth(0.5).strokeColor(LINE).stroke();
      drawLine(doc, `${org} · Asset Report${assets[p] ? ` · ${assets[p].code}` : ''}`, M, fy, { size: 7, color: '#94A3B8' });
      drawLine(doc, `Page ${p + 1} of ${range.count}`, M, fy, { size: 7, color: '#94A3B8', align: 'right', width: CW });
    }
    doc.end();
  });
}

module.exports = { buildAssetReport };
