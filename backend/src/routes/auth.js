const express = require('express');
const bcrypt = require('bcryptjs');
const { query } = require('../db');
const { signToken, authenticate } = require('../middleware/auth');

const r = express.Router();

// naive in-memory brute-force protection
const attempts = new Map();

r.post('/login', async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  if (!email || !password) return res.status(400).json({ error: 'required' });

  const key = `${req.ip}:${email}`;
  const a = attempts.get(key) || { n: 0, until: 0 };
  if (a.until > Date.now()) return res.status(429).json({ error: 'too_many_attempts' });

  const { rows } = await query('SELECT * FROM users WHERE email=$1', [email]);
  const user = rows[0];
  const ok = user && user.active && (await bcrypt.compare(password, user.password_hash));
  if (!ok) {
    a.n += 1;
    if (a.n >= 5) { a.until = Date.now() + 5 * 60 * 1000; a.n = 0; }
    attempts.set(key, a);
    return res.status(401).json({ error: 'invalid_credentials' });
  }
  attempts.delete(key);
  await query('UPDATE users SET last_login=NOW() WHERE id=$1', [user.id]);
  const { password_hash, token_version, ...safe } = user;
  res.json({ token: signToken(user), user: safe });
});

r.get('/me', authenticate, (req, res) => res.json(req.user));

r.put('/me', authenticate, async (req, res) => {
  const { name, phone, current_password, new_password } = req.body || {};
  if (new_password) {
    if (String(new_password).length < 6) return res.status(400).json({ error: 'password_too_short' });
    const { rows } = await query('SELECT password_hash FROM users WHERE id=$1', [req.user.id]);
    if (!(await bcrypt.compare(String(current_password || ''), rows[0].password_hash))) {
      return res.status(400).json({ error: 'wrong_password' });
    }
    await query('UPDATE users SET password_hash=$1 WHERE id=$2', [await bcrypt.hash(String(new_password), 10), req.user.id]);
  }
  const { rows } = await query(
    'UPDATE users SET name=COALESCE($1,name), phone=$2 WHERE id=$3 RETURNING id,name,email,role,phone,active',
    [name || null, phone ?? req.user.phone, req.user.id]
  );
  res.json(rows[0]);
});

module.exports = r;
