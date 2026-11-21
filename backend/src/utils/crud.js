const express = require('express');
const { query, insert, update, pick } = require('../db');
const { requireRole } = require('../middleware/auth');

/**
 * Generic CRUD router for simple master-data tables.
 * list(whereSql) may return a custom SELECT (alias the base table as t).
 */
function crudRouter({ table, fields, required = [], search = [], order = 't.code', list, json = [], writeRoles = ['admin', 'manager'], filters = [], beforeCreate, afterCreate }) {
  const r = express.Router();

  r.get('/', async (req, res) => {
    const params = [];
    const where = [];
    if (req.query.q && search.length) {
      params.push(`%${req.query.q}%`);
      where.push('(' + search.map((s) => `t.${s}::text ILIKE $${params.length}`).join(' OR ') + ')');
    }
    if (req.query.active === 'true') where.push('t.active = TRUE');
    for (const f of filters) {
      if (req.query[f] !== undefined && req.query[f] !== '') {
        params.push(req.query[f]);
        where.push(`t.${f} = $${params.length}`);
      }
    }
    const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : '';
    const sql = list ? list(whereSql) : `SELECT t.* FROM ${table} t ${whereSql}`;
    const { rows } = await query(`${sql} ORDER BY ${order}`, params);
    res.json(rows);
  });

  r.get('/:id', async (req, res) => {
    const { rows } = await query(`SELECT * FROM ${table} WHERE id=$1`, [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'not_found' });
    res.json(rows[0]);
  });

  r.post('/', requireRole(...writeRoles), async (req, res) => {
    const data = pick(req.body, fields);
    if (beforeCreate) await beforeCreate(data);
    for (const f of required) {
      if (data[f] === undefined || data[f] === null || String(data[f]).trim() === '') {
        return res.status(400).json({ error: 'required', field: f });
      }
    }
    const row = await insert({ query }, table, data, json);
    res.status(201).json(row);
    if (afterCreate) { try { afterCreate(row, req); } catch (e) { console.error('[afterCreate]', e.message); } }
  });

  r.put('/:id', requireRole(...writeRoles), async (req, res) => {
    const data = pick(req.body, fields);
    const row = await update({ query }, table, req.params.id, data, json);
    if (!row) return res.status(404).json({ error: 'not_found' });
    res.json(row);
  });

  r.delete('/:id', requireRole(...writeRoles), async (req, res) => {
    const { rowCount } = await query(`DELETE FROM ${table} WHERE id=$1`, [req.params.id]);
    if (!rowCount) return res.status(404).json({ error: 'not_found' });
    res.json({ ok: true });
  });

  return r;
}

module.exports = { crudRouter };
