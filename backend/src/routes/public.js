const express = require('express');
const { query } = require('../db');

const r = express.Router();

// Limited asset info for anyone who scans a QR label (no login)
r.get('/asset/:code', async (req, res) => {
  const { rows } = await query(
    `SELECT a.id, a.code, a.name, a.brand, a.model, a.status, a.images, a.next_inspection, a.last_inspection,
            c.name AS category_name, c.code AS category_code, c.color AS category_color, t.name AS type_name,
            d.name AS department_name, d.dept_no AS department_no,
            l.name AS location_name, l.building, l.floor, l.room, cu.name AS custodian_name,
            co.name AS company_name
       FROM assets a
       LEFT JOIN asset_codes c ON c.id=a.category_id
       LEFT JOIN asset_types t ON t.id=a.type_id
       LEFT JOIN department_codes d ON d.id=a.department_id
       LEFT JOIN locations l ON l.id=a.location_id
       LEFT JOIN custodians cu ON cu.id=a.custodian_id
       LEFT JOIN companies co ON co.id=a.company_id
      WHERE UPPER(a.code)=UPPER($1)`,
    [req.params.code]
  );
  if (!rows[0]) return res.status(404).json({ error: 'not_found' });
  res.json(rows[0]);
});

r.get('/settings', async (_req, res) => {
  const { rows } = await query(`SELECT key, value FROM settings WHERE key IN ('org_name','org_subtitle')`);
  res.json(Object.fromEntries(rows.map((x) => [x.key, x.value])));
});

module.exports = r;
