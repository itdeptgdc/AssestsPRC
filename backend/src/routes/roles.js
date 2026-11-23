const express = require('express');
const { query, logActivity } = require('../db');
const { requireRole } = require('../middleware/auth');
const { ROLES, MODULES, defaults, getAll, save } = require('../permissions');
const { broadcast } = require('../events');

const r = express.Router();

// Editing the permission matrix is reserved for admins
r.use(requireRole('admin'));

r.get('/', async (_req, res) => {
  res.json({ roles: ROLES, modules: MODULES, permissions: await getAll(), defaults: defaults() });
});

r.put('/', async (req, res) => {
  const permissions = await save(req.body?.permissions);
  await logActivity({ query }, req.user.id, 'update', 'role_permissions', null);
  // signed-in browsers reload their own permissions (menus / buttons update without re-login)
  broadcast({ type: 'permissions', silent: true });
  res.json({ roles: ROLES, modules: MODULES, permissions, defaults: defaults() });
});

module.exports = r;
