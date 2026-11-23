const express = require('express');
const { query, tx, update, pick, logActivity, todayLocal } = require('../db');
const { requirePerm } = require('../middleware/auth');
const { createRepair } = require('./inspections');

const r = express.Router();
const STATUSES = ['open', 'in_progress', 'waiting_parts', 'done', 'cancelled'];
const PRIORITIES = ['low', 'normal', 'high', 'urgent'];

r.get('/', async (req, res) => {
  const params = [];
  const where = [];
  if (req.query.status === 'active') where.push(`rp.status IN ('open','in_progress','waiting_parts')`);
  else if (req.query.status) { params.push(req.query.status); where.push(`rp.status=$${params.length}`); }
  if (req.query.priority) { params.push(req.query.priority); where.push(`rp.priority=$${params.length}`); }
  if (req.query.asset_id) { params.push(req.query.asset_id); where.push(`rp.asset_id=$${params.length}`); }
  if (req.query.q) {
    params.push(`%${req.query.q}%`);
    const p = `$${params.length}`;
    where.push(`(rp.ticket_no ILIKE ${p} OR a.code ILIKE ${p} OR a.name ILIKE ${p} OR rp.problem ILIKE ${p} OR rp.technician ILIKE ${p})`);
  }
  const limit = Math.min(Number(req.query.limit) || 25, 500);
  const page = Math.max(Number(req.query.page) || 1, 1);
  const { rows } = await query(
    `SELECT rp.*, a.code AS asset_code, a.name AS asset_name, a.images AS asset_images, u.name AS reported_by_name,
            COUNT(*) OVER() AS total_count
       FROM repairs rp
       JOIN assets a ON a.id=rp.asset_id
       LEFT JOIN users u ON u.id=rp.reported_by
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
      ORDER BY CASE rp.status WHEN 'open' THEN 0 WHEN 'in_progress' THEN 1 WHEN 'waiting_parts' THEN 2 ELSE 3 END,
               CASE rp.priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END,
               rp.reported_at DESC, rp.id DESC
      LIMIT ${limit} OFFSET ${(page - 1) * limit}`,
    params
  );
  const { rows: stats } = await query(
    `SELECT COUNT(*) FILTER (WHERE status='open') AS open,
            COUNT(*) FILTER (WHERE status='in_progress') AS in_progress,
            COUNT(*) FILTER (WHERE status='waiting_parts') AS waiting_parts,
            COUNT(*) FILTER (WHERE status='done') AS done,
            COALESCE(SUM(cost) FILTER (WHERE status='done'),0) AS total_cost
       FROM repairs`
  );
  res.json({ items: rows, total: rows[0]?.total_count || 0, page, limit, stats: stats[0] });
});

r.post('/', requirePerm('repairs', 'add'), async (req, res) => {
  const b = req.body || {};
  if (!b.asset_id || !String(b.problem || '').trim()) return res.status(400).json({ error: 'required' });
  const row = await tx((db) => createRepair(db, req.user.id, {
    asset_id: b.asset_id,
    problem: String(b.problem).trim(),
    priority: PRIORITIES.includes(b.priority) ? b.priority : 'normal',
    technician: b.technician || null,
    reported_at: b.reported_at || null,
    images: Array.isArray(b.images) ? b.images : [],
  }));
  res.status(201).json(row);
});

r.put('/:id', requirePerm('repairs', 'edit'), async (req, res) => {
  const data = pick(req.body, ['status', 'priority', 'technician', 'cost', 'resolution', 'problem', 'completed_at', 'images']);
  if (data.status && !STATUSES.includes(data.status)) return res.status(400).json({ error: 'invalid_input' });
  if (data.priority && !PRIORITIES.includes(data.priority)) return res.status(400).json({ error: 'invalid_input' });
  if (data.cost !== undefined) data.cost = Number(data.cost) || 0;

  const row = await tx(async (db) => {
    const cur = (await db.query('SELECT * FROM repairs WHERE id=$1 FOR UPDATE', [req.params.id])).rows[0];
    if (!cur) return null;
    if (data.status === 'done' && !data.completed_at) data.completed_at = todayLocal();
    if (data.status && data.status !== 'done') data.completed_at = null;
    data.updated_at = new Date();
    const updated = await update(db, 'repairs', cur.id, data, ['images']);

    // Sync asset status
    if (data.status && data.status !== cur.status) {
      if (['done', 'cancelled'].includes(data.status)) {
        const { rows } = await db.query(
          `SELECT COUNT(*)::int AS n FROM repairs WHERE asset_id=$1 AND id<>$2 AND status IN ('open','in_progress','waiting_parts')`,
          [cur.asset_id, cur.id]
        );
        if (rows[0].n === 0) {
          await db.query(`UPDATE assets SET status='active', updated_at=NOW() WHERE id=$1 AND status IN ('repair','broken')`, [cur.asset_id]);
        }
      } else {
        await db.query(`UPDATE assets SET status='repair', updated_at=NOW() WHERE id=$1 AND status IN ('active','broken')`, [cur.asset_id]);
      }
      await logActivity(db, req.user.id, 'repair_' + data.status, 'repair', cur.id, { asset_id: cur.asset_id, ticket: cur.ticket_no });
    }
    return updated;
  });
  if (!row) return res.status(404).json({ error: 'not_found' });
  res.json(row);
});

r.delete('/:id', requirePerm('repairs', 'delete'), async (req, res) => {
  const { rowCount } = await query('DELETE FROM repairs WHERE id=$1', [req.params.id]);
  if (!rowCount) return res.status(404).json({ error: 'not_found' });
  res.json({ ok: true });
});

module.exports = r;
