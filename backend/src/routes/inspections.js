const express = require('express');
const { query, tx, insert, logActivity, todayLocal } = require('../db');
const { requireRole } = require('../middleware/auth');
const { addMonths } = require('./assets');

const r = express.Router();
const RESULTS = ['pass', 'issue', 'fail'];

// Assets due for inspection (schedule)
r.get('/schedule', async (req, res) => {
  const { rows: s } = await query(`SELECT value FROM settings WHERE key='due_soon_days'`);
  const days = Number(req.query.days) || Number(s[0]?.value) || 30;
  const filter = req.query.filter || 'upcoming';
  const params = [];
  const where = [`a.status NOT IN ('disposed','lost')`, 'a.next_inspection IS NOT NULL'];
  if (filter === 'overdue') where.push('a.next_inspection < CURRENT_DATE');
  else if (filter === 'due_soon') where.push(`a.next_inspection BETWEEN CURRENT_DATE AND CURRENT_DATE + ${days}`);
  else if (filter === 'upcoming') where.push(`a.next_inspection <= CURRENT_DATE + ${days}`);
  if (req.query.category_id) { params.push(req.query.category_id); where.push(`a.category_id=$${params.length}`); }
  if (req.query.location_id) { params.push(req.query.location_id); where.push(`a.location_id=$${params.length}`); }
  if (req.query.q) {
    params.push(`%${req.query.q}%`);
    where.push(`(a.code ILIKE $${params.length} OR a.name ILIKE $${params.length})`);
  }
  const { rows } = await query(
    `SELECT a.id, a.code, a.name, a.status, a.next_inspection, a.last_inspection, a.inspection_months, a.images,
            c.name AS category_name, c.color AS category_color, l.name AS location_name, cu.name AS custodian_name,
            (a.next_inspection - CURRENT_DATE) AS days_left
       FROM assets a
       LEFT JOIN asset_codes c ON c.id=a.category_id
       LEFT JOIN locations l ON l.id=a.location_id
       LEFT JOIN custodians cu ON cu.id=a.custodian_id
      WHERE ${where.join(' AND ')}
      ORDER BY a.next_inspection ASC, a.code LIMIT 500`,
    params
  );
  const { rows: counts } = await query(
    `SELECT COUNT(*) FILTER (WHERE next_inspection < CURRENT_DATE) AS overdue,
            COUNT(*) FILTER (WHERE next_inspection BETWEEN CURRENT_DATE AND CURRENT_DATE + ${days}) AS due_soon,
            COUNT(*) AS total
       FROM assets WHERE status NOT IN ('disposed','lost') AND next_inspection IS NOT NULL`
  );
  res.json({ items: rows, counts: counts[0], days });
});

// History
r.get('/', async (req, res) => {
  const params = [];
  const where = [];
  if (req.query.asset_id) { params.push(req.query.asset_id); where.push(`i.asset_id=$${params.length}`); }
  if (req.query.result) { params.push(req.query.result); where.push(`i.result=$${params.length}`); }
  if (req.query.from) { params.push(req.query.from); where.push(`i.inspected_at >= $${params.length}`); }
  if (req.query.to) { params.push(req.query.to); where.push(`i.inspected_at <= $${params.length}`); }
  if (req.query.q) {
    params.push(`%${req.query.q}%`);
    where.push(`(a.code ILIKE $${params.length} OR a.name ILIKE $${params.length} OR u.name ILIKE $${params.length})`);
  }
  const limit = Math.min(Number(req.query.limit) || 25, 500);
  const page = Math.max(Number(req.query.page) || 1, 1);
  const { rows } = await query(
    `SELECT i.*, a.code AS asset_code, a.name AS asset_name, u.name AS inspector_name, COUNT(*) OVER() AS total_count
       FROM inspections i
       JOIN assets a ON a.id=i.asset_id
       LEFT JOIN users u ON u.id=i.inspector_id
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
      ORDER BY i.inspected_at DESC, i.id DESC
      LIMIT ${limit} OFFSET ${(page - 1) * limit}`,
    params
  );
  res.json({ items: rows, total: rows[0]?.total_count || 0, page, limit });
});

// Record an inspection
r.post('/', requireRole('admin', 'manager', 'staff'), async (req, res) => {
  const b = req.body || {};
  if (!b.asset_id) return res.status(400).json({ error: 'required', field: 'asset_id' });
  const result = RESULTS.includes(b.result) ? b.result : 'pass';
  const out = await tx(async (db) => {
    const asset = (await db.query('SELECT * FROM assets WHERE id=$1 FOR UPDATE', [b.asset_id])).rows[0];
    if (!asset) throw Object.assign(new Error('not_found'), { status: 404 });
    const inspectedAt = b.inspected_at || todayLocal();
    const next = b.next_inspection || addMonths(inspectedAt, asset.inspection_months);
    const row = await insert(db, 'inspections', {
      asset_id: asset.id,
      inspected_at: inspectedAt,
      inspector_id: req.user.id,
      result,
      checklist: Array.isArray(b.checklist) ? b.checklist : [],
      notes: b.notes || null,
      images: Array.isArray(b.images) ? b.images : [],
      next_inspection: next,
    }, ['checklist', 'images']);

    let status = asset.status;
    if (result === 'fail' && status === 'active') status = 'broken';
    await db.query('UPDATE assets SET last_inspection=$1, next_inspection=$2, status=$3, updated_at=NOW() WHERE id=$4',
      [inspectedAt, next, status, asset.id]);

    let repair = null;
    if (b.create_repair && result !== 'pass') {
      repair = await createRepair(db, req.user.id, {
        asset_id: asset.id, problem: b.notes || 'Inspection issue', priority: result === 'fail' ? 'high' : 'normal',
      });
    }
    await logActivity(db, req.user.id, 'inspect', 'inspection', row.id, { asset_id: asset.id, code: asset.code, result });
    return { ...row, repair };
  });
  res.status(201).json(out);
});

r.delete('/:id', requireRole('admin', 'manager'), async (req, res) => {
  const { rowCount } = await query('DELETE FROM inspections WHERE id=$1', [req.params.id]);
  if (!rowCount) return res.status(404).json({ error: 'not_found' });
  res.json({ ok: true });
});

async function createRepair(db, userId, { asset_id, problem, priority = 'normal', technician = null, reported_at, images = [] }) {
  const yymm = todayLocal().slice(2, 7).replace('-', '');
  await db.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`repair-${yymm}`]);
  const { rows } = await db.query(
    `SELECT COALESCE(MAX(SUBSTRING(ticket_no FROM '\\d+$')::int),0)+1 AS n FROM repairs WHERE ticket_no LIKE $1`,
    [`RP-${yymm}-%`]
  );
  const ticket = `RP-${yymm}-${String(rows[0].n).padStart(4, '0')}`;
  const row = await insert(db, 'repairs', {
    ticket_no: ticket, asset_id, reported_by: userId, problem, priority, technician,
    reported_at: reported_at || todayLocal(), images,
  }, ['images']);
  await db.query(`UPDATE assets SET status='repair', updated_at=NOW() WHERE id=$1 AND status IN ('active','broken','spare')`, [asset_id]);
  await logActivity(db, userId, 'repair_open', 'repair', row.id, { asset_id, ticket });
  return row;
}

module.exports = r;
module.exports.createRepair = createRepair;
