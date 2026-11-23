const express = require('express');
const { query, tx, insert, update, pick, logActivity, todayLocal } = require('../db');
const { requirePerm } = require('../middleware/auth');
const { broadcast } = require('../events');

const r = express.Router();

const FIELDS = [
  'company_id', 'department_id', 'category_id', 'type_id', 'year_code',
  'name', 'brand', 'model', 'serial_number', 'purchase_date', 'cost', 'vendor', 'po_number', 'warranty_expiry',
  'location_id', 'custodian_id', 'status', 'inspection_months', 'next_inspection', 'images', 'notes',
];
const STATUSES = ['active', 'repair', 'broken', 'spare', 'lost', 'disposed'];

const SELECT = `
  SELECT a.*,
         c.code AS category_code, c.account_code AS category_account, c.name AS category_name, c.color AS category_color, c.checklist AS category_checklist,
         t.number AS type_number, t.name AS type_name,
         d.code AS department_code, d.dept_no AS department_no, d.name AS department_name,
         co.code AS company_code, co.name AS company_name,
         l.code AS location_code, l.name AS location_name, l.building, l.floor, l.room,
         cu.name AS custodian_name, cu.employee_code AS custodian_code,
         u.name AS created_by_name
    FROM assets a
    LEFT JOIN asset_codes  c  ON c.id  = a.category_id
    LEFT JOIN asset_types t  ON t.id  = a.type_id
    LEFT JOIN department_codes d  ON d.id  = a.department_id
    LEFT JOIN companies   co ON co.id = a.company_id
    LEFT JOIN locations   l  ON l.id  = a.location_id
    LEFT JOIN custodians  cu ON cu.id = a.custodian_id
    LEFT JOIN users       u  ON u.id  = a.created_by`;

// sort key -> output column of SELECT
const SORTS = {
  code: 'code', name: 'name', category: 'category_name', location: 'location_name', custodian: 'custodian_name',
  status: 'status', next_inspection: 'next_inspection', created_at: 'created_at', cost: 'cost',
};

async function dueSoonDays() {
  const { rows } = await query(`SELECT value FROM settings WHERE key='due_soon_days'`);
  return Number(rows[0]?.value) || 30;
}

/** Build the code prefix: {Company}{Dept}-{Account}-{Type}-{Year}  e.g. P401-602-01-23 */
async function buildPrefix(db, { company_id, department_id, category_id, type_id, year_code }) {
  const one = async (sql, id) => (id ? (await db.query(sql, [id])).rows[0] : null);
  const co = await one('SELECT code FROM companies WHERE id=$1', company_id);
  // departments without a number fall back to 000
  const d = await one(`SELECT COALESCE(NULLIF(dept_no,''),'000') AS code FROM department_codes WHERE id=$1`, department_id);
  // categories without an account code fall back to 170 (FIXED ASSETS)
  const c = await one(`SELECT COALESCE(NULLIF(account_code,''),'170') AS account FROM asset_codes WHERE id=$1`, category_id);
  const t = await one('SELECT number FROM asset_types WHERE id=$1', type_id);
  if (!co || !d || !c) return null;
  const year = /^\d{2}$/.test(String(year_code || '')) ? year_code : '00';
  return `${co.code}${d.code}-${c.account}-${t ? t.number : '00'}-${year}`;
}

/**
 * Running numbers are per Company + Asset account + Type only — the department and the year are NOT part
 * of the sequence.  P503-602-07-18-0001 → next CPU (any dept, any year) is e.g. P504-602-07-26-0002.
 * Prefix = <company letters><3-digit dept>-<account>-<type>-<yy>; the series drops the dept and the year.
 * SERIES_SQL must stay identical to seriesOf().
 */
const seriesOf = (prefix) => String(prefix).replace(/^([A-Za-z]*)\d{3}-(.*)-\d{2}$/, '$1-$2');
const SERIES_SQL = `regexp_replace(code_prefix, '^([A-Za-z]*)[0-9]{3}-(.*)-[0-9]{2}$', '\\1-\\2')`;

/** Serialise concurrent creates of the same series (call inside a transaction) */
const lockSeries = (db, prefix) => db.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`series:${seriesOf(prefix)}`]);

async function nextRun(db, prefix) {
  const { rows } = await db.query(
    `SELECT COALESCE(MAX(run_no),0)+1 AS n FROM assets WHERE ${SERIES_SQL} = $1`,
    [seriesOf(prefix)]
  );
  return rows[0].n;
}

const fmtCode = (prefix, run) => `${prefix}-${String(run).padStart(4, '0')}`;

function addMonths(dateStr, months) {
  const d = new Date((dateStr || todayLocal()) + 'T00:00:00Z');
  d.setUTCMonth(d.getUTCMonth() + Number(months || 6));
  return d.toISOString().slice(0, 10);
}

/** "1,2,3" → [1,2,3] (positive integers only, max 5000); null when absent/empty */
function parseIds(v) {
  if (v === undefined || v === null || v === '') return null;
  const list = [...new Set(String(v).split(',').map((s) => Number(s.trim())).filter((n) => Number.isInteger(n) && n > 0))].slice(0, 5000);
  return list.length ? list : [0]; // [0] matches nothing: an invalid list never widens to "everything"
}

/** WHERE clause for the Asset Register filters (shared by the list and the Excel / PDF export) */
async function assetFilter(q) {
  const params = [];
  const where = [];
  const add = (sql, v) => { params.push(v); where.push(sql.replace('?', `$${params.length}`)); };

  // ?ids=1,2,3 → only the records ticked in the Asset Register (export "selected")
  const ids = parseIds(q.ids);
  if (ids) add('a.id = ANY(?::int[])', ids);

  if (q.q) {
    params.push(`%${q.q}%`);
    const p = `$${params.length}`;
    where.push(`(a.code ILIKE ${p} OR a.name ILIKE ${p} OR a.serial_number ILIKE ${p} OR a.brand ILIKE ${p} OR a.model ILIKE ${p} OR cu.name ILIKE ${p})`);
  }
  for (const f of ['category_id', 'location_id', 'department_id', 'company_id', 'custodian_id', 'type_id']) {
    if (q[f]) add(`a.${f} = ?`, q[f]);
  }
  if (q.status) add('a.status = ?', q.status);
  if (q.inspection) {
    const days = await dueSoonDays();
    const active = `a.status NOT IN ('disposed','lost')`;
    if (q.inspection === 'overdue') where.push(`${active} AND a.next_inspection < CURRENT_DATE`);
    if (q.inspection === 'due_soon') where.push(`${active} AND a.next_inspection BETWEEN CURRENT_DATE AND CURRENT_DATE + ${days}`);
    if (q.inspection === 'ok') where.push(`(a.next_inspection IS NULL OR a.next_inspection > CURRENT_DATE + ${days})`);
  }
  return { whereSql: where.length ? `WHERE ${where.join(' AND ')}` : '', params };
}

// ---------- list ----------
r.get('/', async (req, res) => {
  const { whereSql, params } = await assetFilter(req.query);
  const sort = SORTS[req.query.sort] || 'code';
  const dir = req.query.dir === 'desc' ? 'DESC' : 'ASC';
  const limit = Math.min(Number(req.query.limit) || 25, 1000);
  const page = Math.max(Number(req.query.page) || 1, 1);

  const { rows } = await query(
    `SELECT x.*, COUNT(*) OVER() AS total_count FROM (${SELECT} ${whereSql}) x
     ORDER BY x.${sort} ${dir} NULLS LAST, x.id
     LIMIT ${limit} OFFSET ${(page - 1) * limit}`,
    params
  );
  res.json({ items: rows, total: rows[0]?.total_count || 0, page, limit });
});

// ---------- code preview ----------
r.get('/next-code', async (req, res) => {
  const prefix = await buildPrefix({ query }, req.query);
  if (!prefix) return res.json({ code: null, prefix: null, run: null });
  const run = await nextRun({ query }, prefix);
  res.json({ code: fmtCode(prefix, run), prefix, run });
});

// ---------- lookup by code / serial (QR scan) ----------
r.get('/lookup/:code', async (req, res) => {
  const code = String(req.params.code).trim();
  const { rows } = await query(`${SELECT} WHERE UPPER(a.code)=UPPER($1) OR UPPER(a.serial_number)=UPPER($1) LIMIT 1`, [code]);
  if (!rows[0]) return res.status(404).json({ error: 'not_found' });
  res.json(rows[0]);
});

// ---------- detail ----------
r.get('/:id', async (req, res) => {
  const { rows } = await query(`${SELECT} WHERE a.id=$1`, [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'not_found' });
  const asset = rows[0];
  const [ins, rep, act] = await Promise.all([
    query(`SELECT i.*, u.name AS inspector_name FROM inspections i LEFT JOIN users u ON u.id=i.inspector_id
           WHERE i.asset_id=$1 ORDER BY i.inspected_at DESC, i.id DESC`, [asset.id]),
    query(`SELECT rp.*, u.name AS reported_by_name FROM repairs rp LEFT JOIN users u ON u.id=rp.reported_by
           WHERE rp.asset_id=$1 ORDER BY rp.reported_at DESC, rp.id DESC`, [asset.id]),
    query(`SELECT al.*, u.name AS user_name FROM activity_logs al LEFT JOIN users u ON u.id=al.user_id
           WHERE (al.entity='asset' AND al.entity_id=$1) OR (al.details->>'asset_id')::int=$1
           ORDER BY al.created_at DESC LIMIT 30`, [asset.id]),
  ]);
  res.json({ ...asset, inspections: ins.rows, repairs: rep.rows, activity: act.rows });
});

// ---------- create ----------
r.post('/', requirePerm('assets', 'add'), async (req, res) => {
  const data = pick(req.body, FIELDS);
  if (!data.name || !data.category_id) return res.status(400).json({ error: 'required', field: !data.name ? 'name' : 'category_id' });
  if (data.status && !STATUSES.includes(data.status)) return res.status(400).json({ error: 'invalid_input' });

  const asset = await tx(async (db) => {
    const cat = (await db.query('SELECT inspection_months FROM asset_codes WHERE id=$1', [data.category_id])).rows[0];
    if (!cat) throw Object.assign(new Error('invalid_category'), { status: 400 });
    data.inspection_months = Number(data.inspection_months) || cat.inspection_months || 6;
    if (!data.next_inspection) data.next_inspection = addMonths(null, data.inspection_months);
    data.cost = Number(data.cost) || 0;
    data.images = Array.isArray(data.images) ? data.images : [];
    data.created_by = req.user.id;

    const manual = String(req.body.code || '').trim();
    if (manual && req.body.code_mode === 'manual') {
      data.code = manual.toUpperCase();
    } else {
      const prefix = await buildPrefix(db, data);
      if (!prefix) throw Object.assign(new Error('code_parts_required'), { status: 400 });
      await lockSeries(db, prefix);
      const run = await nextRun(db, prefix);
      Object.assign(data, { code_prefix: prefix, run_no: run, code: fmtCode(prefix, run) });
    }
    const row = await insert(db, 'assets', data, ['images']);
    await logActivity(db, req.user.id, 'create', 'asset', row.id, { code: row.code, name: row.name });
    return row;
  });
  res.status(201).json(asset);
  broadcast({ type: 'asset', ref: asset.id, code: asset.code, name: asset.name, by: req.user.name, byId: req.user.id });
});

// ---------- update ----------
r.put('/:id', requirePerm('assets', 'edit'), async (req, res) => {
  const data = pick(req.body, FIELDS);
  if (data.status && !STATUSES.includes(data.status)) return res.status(400).json({ error: 'invalid_input' });
  if (data.cost !== undefined) data.cost = Number(data.cost) || 0;
  const row = await tx(async (db) => {
    const cur = (await db.query('SELECT * FROM assets WHERE id=$1 FOR UPDATE', [req.params.id])).rows[0];
    if (!cur) return null;
    // Code changes only when explicitly requested
    if (req.body.code_mode === 'manual' && req.body.code && req.body.code !== cur.code) {
      Object.assign(data, { code: String(req.body.code).trim().toUpperCase(), code_prefix: null, run_no: null });
    } else if (req.body.regenerate_code) {
      const prefix = await buildPrefix(db, { ...cur, ...data });
      if (prefix && prefix !== cur.code_prefix) {
        await lockSeries(db, prefix);
        // only the year / department changed → same series, keep its running number
        const sameSeries = cur.code_prefix && cur.run_no && seriesOf(prefix) === seriesOf(cur.code_prefix);
        const run = sameSeries ? cur.run_no : await nextRun(db, prefix);
        Object.assign(data, { code_prefix: prefix, run_no: run, code: fmtCode(prefix, run) });
      }
    }
    data.updated_at = new Date();
    const updated = await update(db, 'assets', req.params.id, data, ['images']);
    const changed = Object.keys(data).filter((k) => k !== 'updated_at' && JSON.stringify(cur[k]) !== JSON.stringify(updated[k]));
    await logActivity(db, req.user.id, 'update', 'asset', updated.id, { code: updated.code, fields: changed });
    return updated;
  });
  if (!row) return res.status(404).json({ error: 'not_found' });
  res.json(row);
});

// ---------- delete ----------
r.delete('/:id', requirePerm('assets', 'delete'), async (req, res) => {
  const { rows } = await query('DELETE FROM assets WHERE id=$1 RETURNING code, name', [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'not_found' });
  await logActivity({ query }, req.user.id, 'delete', 'asset', Number(req.params.id), rows[0]);
  res.json({ ok: true });
});

module.exports = r;
module.exports.addMonths = addMonths;
module.exports.assetFilter = assetFilter;
module.exports.ASSET_SELECT = SELECT;
