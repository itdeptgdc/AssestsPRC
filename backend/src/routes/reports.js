const express = require('express');
const { query } = require('../db');
const { sendReport, sendFile, STATUS, money, pdf } = require('../utils/export');
const { buildAssetReport } = require('../utils/assetReport');
const { assetFilter, ASSET_SELECT } = require('./assets');

const r = express.Router();

r.get('/summary', async (_req, res) => {
  const group = (joinTable, fk, alias, label) =>
    query(`SELECT ${alias}.id, ${label} AS label, COUNT(a.id) AS count, COALESCE(SUM(a.cost),0) AS value
             FROM assets a LEFT JOIN ${joinTable} ${alias} ON ${alias}.id = a.${fk}
            GROUP BY ${alias}.id, ${label} ORDER BY count DESC`);

  const [byCategory, byDepartment, byLocation, byStatus, byYear, inspections, repairs] = await Promise.all([
    group('asset_codes', 'category_id', 'c', `COALESCE(c.name, '-')`),
    group('department_codes', 'department_id', 'd', `COALESCE(d.name, '-')`),
    group('locations', 'location_id', 'l', `COALESCE(l.name, '-')`),
    query(`SELECT status AS label, COUNT(*) AS count, COALESCE(SUM(cost),0) AS value FROM assets GROUP BY status ORDER BY count DESC`),
    query(`SELECT COALESCE(to_char(purchase_date,'YYYY'),'-') AS label, COUNT(*) AS count, COALESCE(SUM(cost),0) AS value
             FROM assets GROUP BY 1 ORDER BY 1`),
    query(`SELECT result AS label, COUNT(*) AS count FROM inspections
            WHERE inspected_at >= CURRENT_DATE - INTERVAL '12 months' GROUP BY result`),
    query(`SELECT status AS label, COUNT(*) AS count, COALESCE(SUM(cost),0) AS value FROM repairs GROUP BY status`),
  ]);
  res.json({
    byCategory: byCategory.rows, byDepartment: byDepartment.rows, byLocation: byLocation.rows,
    byStatus: byStatus.rows, byYear: byYear.rows, inspections: inspections.rows, repairs: repairs.rows,
  });
});

// ---------- Asset Report: one PDF page per asset (?ids=1,2,3 or the Asset Register filters) ----------
const MAX_SHEETS = 300;
r.get('/export/asset-report', async (req, res) => {
  const { whereSql, params } = await assetFilter(req.query);
  const { rows } = await query(`SELECT x.* FROM (${ASSET_SELECT} ${whereSql}) x ORDER BY x.code LIMIT ${MAX_SHEETS + 1}`, params);
  if (rows.length > MAX_SHEETS) return res.status(400).json({ error: 'too_many', max: MAX_SHEETS });

  const ids = rows.map((a) => a.id);
  const [ins, rep] = await Promise.all([
    query(`SELECT DISTINCT ON (asset_id) asset_id, inspected_at AS last, result, COUNT(*) OVER (PARTITION BY asset_id) AS n
             FROM inspections WHERE asset_id = ANY($1::int[]) ORDER BY asset_id, inspected_at DESC, id DESC`, [ids]),
    query(`SELECT asset_id, COUNT(*) AS n, COUNT(*) FILTER (WHERE status NOT IN ('done','cancelled')) AS open, COALESCE(SUM(cost),0) AS cost
             FROM repairs WHERE asset_id = ANY($1::int[]) GROUP BY asset_id`, [ids]),
  ]);
  const stats = new Map(ids.map((id) => [id, {}]));
  for (const x of ins.rows) Object.assign(stats.get(x.asset_id), { inspections: Number(x.n), lastInspected: x.last, lastResult: x.result });
  for (const x of rep.rows) Object.assign(stats.get(x.asset_id), { repairs: Number(x.n), openRepairs: Number(x.open), repairCost: Number(x.cost) });

  // QR links point at the address the user is browsing from (same as the printed labels)
  const base = /^https?:\/\/[A-Za-z0-9.\-]+(:\d{1,5})?$/.test(String(req.query.base || '')) ? req.query.base : `https://${req.get('host')}`;
  const buf = await buildAssetReport(rows, stats, { ...(await org()), base });
  const name = rows.length === 1 ? `asset-report-${rows[0].code}` : `asset-report-${rows.length}-assets`;
  sendFile(res, buf, `${name}-${pdf.fileStamp()}.pdf`, 'application/pdf');
});

// ---------- exports: ?format=xlsx (default) | pdf | csv ----------

/** Organisation name / subtitle for report headers */
async function org() {
  const { rows } = await query(`SELECT key, value FROM settings WHERE key IN ('org_name','org_subtitle')`);
  const s = Object.fromEntries(rows.map((x) => [x.key, x.value]));
  return { org: s.org_name || 'Asset PRC', orgSub: s.org_subtitle || 'Asset Registry System' };
}

/** Human-readable description of the active Asset Register filters, e.g. "Department: 504 · AG - IT · Status: In use" */
async function describeAssetFilters(q) {
  const parts = [];
  const name = async (sql, id) => (id ? (await query(sql, [id])).rows[0]?.label : null);
  const add = (label, v) => v && parts.push(`${label}: ${v}`);
  if (q.ids) parts.push(`Selected records: ${String(q.ids).split(',').filter(Boolean).length}`);
  add('Search', q.q && `"${q.q}"`);
  add('Assets', await name(`SELECT code || ' · ' || name AS label FROM asset_codes WHERE id=$1`, q.category_id));
  add('Status', q.status && (STATUS[q.status] || q.status));
  add('Location', await name(`SELECT name AS label FROM locations WHERE id=$1`, q.location_id));
  add('Department', await name(`SELECT COALESCE(dept_no || ' · ', '') || name AS label FROM department_codes WHERE id=$1`, q.department_id));
  add('Custodian', await name(`SELECT name AS label FROM custodians WHERE id=$1`, q.custodian_id));
  add('Inspection', { overdue: 'Overdue', due_soon: 'Due soon', ok: 'On schedule' }[q.inspection]);
  return parts.join('  ·  ');
}

r.get('/export/assets', async (req, res) => {
  // same filters as the Asset Register list, so the file matches what is on screen
  const { whereSql, params } = await assetFilter(req.query);
  const { rows } = await query(`SELECT x.* FROM (${ASSET_SELECT} ${whereSql}) x ORDER BY x.code`, params);
  for (const a of rows) {
    a.department = a.department_name && (a.department_no ? `${a.department_no} · ${a.department_name}` : a.department_name);
    a.asset_code = a.category_name && (a.category_code ? `${a.category_code} · ${a.category_name}` : a.category_name);
    a.type = a.type_name && `${a.type_number} - ${a.type_name}`;
    a.location = [a.building, a.floor, a.location_name].filter(Boolean).join(' · ');
    a.brand_model = [a.brand, a.model].filter(Boolean).join(' · ');
  }
  const totalCost = rows.reduce((s, a) => s + Number(a.cost || 0), 0);
  await sendReport(res, {
    format: req.query.format, name: 'asset-register', title: 'Asset Register', ...(await org()), rows,
    filters: await describeAssetFilters(req.query),
    summary: rows.length ? [`Total cost: ${money(totalCost)} THB`] : [],
    columns: [
      { key: 'code', header: 'Asset Code', type: 'code', width: 22, pdf: 13 },
      { key: 'name', header: 'Asset Name', width: 28, pdf: 14 },
      { key: 'brand_model', header: 'Brand · Model', pdf: 10, xlsx: false }, // Excel has Brand and Model separately
      { key: 'company_code', header: 'Company', width: 10 },
      { key: 'department', header: 'Department', width: 30, pdf: 13 },
      { key: 'asset_code', header: 'Assets', width: 30, pdf: 13 },
      { key: 'type', header: 'Type', width: 18, pdf: 8 },
      { key: 'year_code', header: 'Year', width: 7 },
      { key: 'serial_number', header: 'Serial Number', width: 20, pdf: 9 },
      { key: 'brand', header: 'Brand', width: 14 },
      { key: 'model', header: 'Model', width: 16 },
      { key: 'purchase_date', header: 'Date of Purchase', type: 'date', width: 14 },
      { key: 'cost', header: 'Cost Price (THB)', type: 'money', width: 16, pdf: 8 },
      { key: 'vendor', header: 'Vendor', width: 18 },
      { key: 'po_number', header: 'PO Number', width: 14 },
      { key: 'warranty_expiry', header: 'Warranty Expiry', type: 'date', width: 14 },
      { key: 'location', header: 'Location', width: 26, pdf: 11 },
      { key: 'custodian_name', header: 'Custodian', width: 22, pdf: 10 },
      { key: 'status', header: 'Status', type: 'status', width: 13, pdf: 7 },
      { key: 'last_inspection', header: 'Last Inspection', type: 'date', width: 14 },
      { key: 'next_inspection', header: 'Next Inspection', type: 'date', width: 14, pdf: 8 },
      { key: 'notes', header: 'Notes', width: 30 },
    ],
  });
});

r.get('/export/inspections', async (req, res) => {
  // same filters as the Inspection History list
  const q = req.query;
  const params = []; const where = []; const desc = [];
  const add = (sql, v) => { params.push(v); where.push(sql.replace('?', `$${params.length}`)); };
  if (q.result) { add('i.result = ?', q.result); desc.push(`Result: ${STATUS[q.result] || q.result}`); }
  if (q.from) { add('i.inspected_at >= ?', q.from); desc.push(`From: ${q.from.split('-').reverse().join('/')}`); }
  if (q.to) { add('i.inspected_at <= ?', q.to); desc.push(`To: ${q.to.split('-').reverse().join('/')}`); }
  if (q.q) { params.push(`%${q.q}%`); const p = `$${params.length}`; where.push(`(a.code ILIKE ${p} OR a.name ILIKE ${p} OR u.name ILIKE ${p})`); desc.push(`Search: "${q.q}"`); }
  const { rows } = await query(
    `SELECT i.*, a.code, a.name, u.name AS inspector FROM inspections i JOIN assets a ON a.id=i.asset_id
       LEFT JOIN users u ON u.id=i.inspector_id ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY i.inspected_at DESC, i.id DESC`, params
  );
  await sendReport(res, {
    format: req.query.format, name: 'inspection-history', title: 'Inspection History', ...(await org()), rows, filters: desc.join('  ·  '),
    columns: [
      { key: 'inspected_at', header: 'Date', type: 'date', width: 13, pdf: 8 },
      { key: 'code', header: 'Asset Code', type: 'code', width: 22, pdf: 13 },
      { key: 'name', header: 'Asset Name', width: 28, pdf: 16 },
      { key: 'result', header: 'Result', type: 'status', width: 10, pdf: 6 },
      { key: 'inspector', header: 'Inspector', width: 20, pdf: 11 },
      { key: 'notes', header: 'Notes', width: 40, pdf: 26 },
      { key: 'next_inspection', header: 'Next Inspection', type: 'date', width: 15, pdf: 9 },
    ],
  });
});

r.get('/export/repairs', async (req, res) => {
  // same filters as the Repair Jobs list (status 'active' = open / in progress / waiting parts)
  const q = req.query;
  const params = []; const where = []; const desc = [];
  if (q.status === 'active') { where.push(`rp.status IN ('open','in_progress','waiting_parts')`); desc.push('Status: Active jobs'); }
  else if (q.status) { params.push(q.status); where.push(`rp.status=$${params.length}`); desc.push(`Status: ${STATUS[q.status] || q.status}`); }
  if (q.priority) { params.push(q.priority); where.push(`rp.priority=$${params.length}`); desc.push(`Priority: ${STATUS[q.priority] || q.priority}`); }
  if (q.q) {
    params.push(`%${q.q}%`); const p = `$${params.length}`;
    where.push(`(rp.ticket_no ILIKE ${p} OR a.code ILIKE ${p} OR a.name ILIKE ${p} OR rp.problem ILIKE ${p} OR rp.technician ILIKE ${p})`);
    desc.push(`Search: "${q.q}"`);
  }
  const { rows } = await query(
    `SELECT rp.*, a.code, a.name FROM repairs rp JOIN assets a ON a.id=rp.asset_id
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY rp.reported_at DESC, rp.id DESC`, params
  );
  const totalCost = rows.reduce((s, x) => s + Number(x.cost || 0), 0);
  await sendReport(res, {
    format: req.query.format, name: 'repair-jobs', title: 'Repair Jobs', ...(await org()), rows, filters: desc.join('  ·  '),
    summary: rows.length ? [`Total repair cost: ${money(totalCost)} THB`] : [],
    columns: [
      { key: 'ticket_no', header: 'Ticket', type: 'code', width: 16, pdf: 9 },
      { key: 'reported_at', header: 'Reported', type: 'date', width: 13, pdf: 8 },
      { key: 'code', header: 'Asset Code', type: 'code', width: 22, pdf: 12 },
      { key: 'name', header: 'Asset Name', width: 26, pdf: 12 },
      { key: 'problem', header: 'Problem', width: 36, pdf: 18 },
      { key: 'priority', header: 'Priority', type: 'status', width: 10, pdf: 6 },
      { key: 'status', header: 'Status', type: 'status', width: 14, pdf: 8 },
      { key: 'technician', header: 'Technician', width: 18, pdf: 9 },
      { key: 'cost', header: 'Cost (THB)', type: 'money', width: 14, pdf: 8 },
      { key: 'completed_at', header: 'Completed', type: 'date', width: 13, pdf: 8 },
      { key: 'resolution', header: 'Resolution', width: 36 },
    ],
  });
});

module.exports = r;
