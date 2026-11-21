const jwt = require('jsonwebtoken');
const { query } = require('../db');

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
  // Viewers are read-only everywhere (except their own profile / password)
  if (user.role === 'viewer' && req.method !== 'GET' && !req.originalUrl.startsWith('/api/auth/')) {
    return res.status(403).json({ error: 'forbidden' });
  }
  next();
}

const requireRole = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) return res.status(403).json({ error: 'forbidden' });
  next();
};

module.exports = { signToken, authenticate, requireRole, SECRET };
