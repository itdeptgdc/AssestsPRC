const express = require('express');
const { query } = require('../db');
const { requirePerm } = require('../middleware/auth');

const r = express.Router();
const KEYS = ['org_name', 'org_subtitle', 'due_soon_days', 'default_inspection_months', 'currency'];

r.get('/', async (_req, res) => {
  const { rows } = await query(`SELECT key, value FROM settings WHERE key <> 'role_permissions'`);
  res.json(Object.fromEntries(rows.map((x) => [x.key, x.value])));
});

r.put('/', requirePerm('settings', 'edit'), async (req, res) => {
  for (const k of KEYS) {
    if (req.body?.[k] !== undefined) {
      await query(
        'INSERT INTO settings (key, value) VALUES ($1,$2) ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value',
        [k, JSON.stringify(req.body[k])]
      );
    }
  }
  const { rows } = await query(`SELECT key, value FROM settings WHERE key <> 'role_permissions'`);
  res.json(Object.fromEntries(rows.map((x) => [x.key, x.value])));
});

module.exports = r;
