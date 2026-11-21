const express = require('express');
const bcrypt = require('bcryptjs');
const { query, update, pick, logActivity } = require('../db');
const { requireRole } = require('../middleware/auth');

const r = express.Router();
const ROLES = ['admin', 'manager', 'staff', 'viewer'];

const LIST = `
  SELECT u.id, u.name, u.email, u.role, u.phone, u.active, u.department_id, u.last_login, u.created_at,
         d.code AS department_code, d.name AS department_name,
         (EXISTS (SELECT 1 FROM activity_logs x WHERE x.user_id=u.id)
          OR EXISTS (SELECT 1 FROM inspections x WHERE x.inspector_id=u.id)
          OR EXISTS (SELECT 1 FROM repairs x WHERE x.reported_by=u.id)
          OR EXISTS (SELECT 1 FROM assets x WHERE x.created_by=u.id)) AS has_history
    FROM users u LEFT JOIN department_codes d ON d.id=u.department_id`;

const one = async (id) => (await query(`${LIST} WHERE u.id=$1`, [id])).rows[0];

r.use(requireRole('admin'));

r.get('/', async (req, res) => {
  const params = [];
  let where = '';
  if (req.query.q) {
    params.push(`%${req.query.q}%`);
    where = 'WHERE u.name ILIKE $1 OR u.email ILIKE $1 OR d.name ILIKE $1';
  }
  const { rows } = await query(`${LIST} ${where} ORDER BY u.created_at`, params);
  res.json(rows);
});

r.post('/', async (req, res) => {
  const { name, email, password, role = 'staff', phone, department_id, active = true } = req.body || {};
  if (!name || !email || !password) return res.status(400).json({ error: 'required' });
  if (String(password).length < 6) return res.status(400).json({ error: 'password_too_short' });
  if (!ROLES.includes(role)) return res.status(400).json({ error: 'invalid_input' });
  const { rows } = await query(
    `INSERT INTO users (name, email, password_hash, role, phone, department_id, active) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
    [name, String(email).trim().toLowerCase(), await bcrypt.hash(String(password), 10), role, phone || null, department_id || null, !!active]
  );
  await logActivity({ query }, req.user.id, 'create', 'user', rows[0].id, { name });
  res.status(201).json(await one(rows[0].id));
});

r.put('/:id', async (req, res) => {
  const id = Number(req.params.id);
  const data = pick(req.body, ['name', 'email', 'role', 'phone', 'department_id', 'active']);
  if (data.role && !ROLES.includes(data.role)) return res.status(400).json({ error: 'invalid_input' });
  if (data.email) data.email = String(data.email).trim().toLowerCase();
  if (data.active !== undefined) data.active = !!data.active;
  if (id === req.user.id && (data.active === false || (data.role && data.role !== 'admin'))) {
    return res.status(400).json({ error: 'cannot_modify_self' });
  }
  if (req.body?.password) {
    if (String(req.body.password).length < 6) return res.status(400).json({ error: 'password_too_short' });
    data.password_hash = await bcrypt.hash(String(req.body.password), 10);
  }
  const row = await update({ query }, 'users', id, data);
  if (!row) return res.status(404).json({ error: 'not_found' });
  // deactivation or password reset by admin signs the user out everywhere
  if ((data.active === false || data.password_hash) && id !== req.user.id) {
    await query('UPDATE users SET token_version = token_version + 1 WHERE id=$1', [id]);
  }
  res.json(await one(id));
});

// Admin resets a user's password
r.post('/:id/reset-password', async (req, res) => {
  const pw = String(req.body?.password || '');
  if (pw.length < 6) return res.status(400).json({ error: 'password_too_short' });
  const { rowCount } = await query(
    'UPDATE users SET password_hash=$1, token_version = token_version + 1 WHERE id=$2',
    [await bcrypt.hash(pw, 10), req.params.id]
  );
  if (!rowCount) return res.status(404).json({ error: 'not_found' });
  await logActivity({ query }, req.user.id, 'reset_password', 'user', Number(req.params.id));
  res.json({ ok: true });
});

// Force sign-out from all devices
r.post('/:id/logout', async (req, res) => {
  if (Number(req.params.id) === req.user.id) return res.status(400).json({ error: 'cannot_modify_self' });
  const { rowCount } = await query('UPDATE users SET token_version = token_version + 1 WHERE id=$1', [req.params.id]);
  if (!rowCount) return res.status(404).json({ error: 'not_found' });
  res.json({ ok: true });
});

// Users with work history can only be deactivated
r.delete('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (id === req.user.id) return res.status(400).json({ error: 'cannot_modify_self' });
  const u = await one(id);
  if (!u) return res.status(404).json({ error: 'not_found' });
  if (u.has_history) return res.status(409).json({ error: 'has_history' });
  await query('DELETE FROM users WHERE id=$1', [id]);
  res.json({ ok: true });
});

module.exports = r;
