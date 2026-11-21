const express = require('express');
const { query } = require('../db');

const r = express.Router();

r.get('/', async (_req, res) => {
  const { rows: s } = await query(`SELECT value FROM settings WHERE key='due_soon_days'`);
  const days = Number(s[0]?.value) || 30;
  const [overdue, soon, repairs] = await Promise.all([
    query(`SELECT id, code, name, next_inspection, (next_inspection - CURRENT_DATE) AS days_left FROM assets
            WHERE status NOT IN ('disposed','lost') AND next_inspection < CURRENT_DATE ORDER BY next_inspection LIMIT 10`),
    query(`SELECT id, code, name, next_inspection, (next_inspection - CURRENT_DATE) AS days_left FROM assets
            WHERE status NOT IN ('disposed','lost') AND next_inspection BETWEEN CURRENT_DATE AND CURRENT_DATE + ${days}
            ORDER BY next_inspection LIMIT 10`),
    query(`SELECT rp.id, rp.ticket_no, rp.priority, rp.problem, a.id AS asset_id, a.code FROM repairs rp JOIN assets a ON a.id=rp.asset_id
            WHERE rp.status IN ('open','in_progress','waiting_parts') ORDER BY rp.reported_at DESC LIMIT 10`),
  ]);
  const items = [
    ...overdue.rows.map((x) => ({ type: 'overdue', ...x })),
    ...repairs.rows.map((x) => ({ type: 'repair', ...x })),
    ...soon.rows.map((x) => ({ type: 'due_soon', ...x })),
  ];
  res.json({ count: overdue.rows.length + repairs.rows.length, items });
});

module.exports = r;
