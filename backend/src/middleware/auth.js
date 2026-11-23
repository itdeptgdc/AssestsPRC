const jwt = require('jsonwebtoken');
const { query } = require('../db');
const { getForRole, has } = require('../permissions');

const SECRET = process.env.JWT_SECRET || 'change-me-in-production';

function signToken(user) {
  return jwt.sign({ id: user.id, role: user.role, tv: user.token_version || 0 }, SECRET, { expiresIn: process.env.JWT_EXPIRES || '7d' });
}

async function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'unauthorized' });
  let payload;
  try {
    payload = jwt.verify(token, SECRET);
  } catch {
    return res.status(401).json({ error: 'unauthorized' });
  }
  const { rows } = await query(
    `SELECT u.id, u.name, u.email, u.role, u.phone, u.active, u.department_id, u.token_version, d.name AS department_name
       FROM users u LEFT JOIN department_codes d ON d.id=u.department_id WHERE u.id=$1`,
    [payload.id]
  );
  const user = rows[0];
  // inactive users and tokens revoked by "force sign out" are rejected
  if (!user || !user.active || (payload.tv || 0) !== user.token_version) return res.status(401).json({ error: 'unauthorized' });
  delete user.token_version;
  req.user = user;
  req.perms = await getForRole(user.role);
  next();
}

const requireRole = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) return res.status(403).json({ error: 'forbidden' });
  next();
};

/** requirePerm('assets', 'add') — checks the configurable role permission matrix */
const requirePerm = (module, action) => (req, res, next) => {
  if (!req.user || !has(req.perms, module, action)) return res.status(403).json({ error: 'forbidden' });
  next();
};

/** passes when the user may add or edit anything (e.g. uploading photos) */
const requireAnyWrite = (req, res, next) => {
  const ok = Object.values(req.perms || {}).some((p) => p.add || p.edit);
  if (!ok) return res.status(403).json({ error: 'forbidden' });
  next();
};

module.exports = { signToken, authenticate, requireRole, requirePerm, requireAnyWrite, SECRET };
