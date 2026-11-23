/**
 * Role-based permissions: role × module (sidebar tab) × action (view | add | edit | delete).
 * The matrix is stored in settings.role_permissions and edited by admins on the Users page.
 * Admin always has full access (so nobody can lock the system out).
 */
const { query } = require('./db');

const ROLES = ['admin', 'manager', 'staff', 'viewer'];

/** module -> actions that make sense for it (order = sidebar order) */
const MODULES = {
  dashboard: ['view'],
  scan: ['view'],
  assets: ['view', 'add', 'edit', 'delete'],
  schedule: ['view'],
  print: ['view'],
  inspections: ['view', 'add', 'delete'],
  repairs: ['view', 'add', 'edit', 'delete'],
  locations: ['view', 'add', 'edit', 'delete'],
  categories: ['view', 'add', 'edit', 'delete'],
  departments: ['view', 'add', 'edit', 'delete'],
  custodians: ['view', 'add', 'edit', 'delete'],
  companies: ['view', 'add', 'edit', 'delete'],
  reports: ['view'],
  users: ['view', 'add', 'edit', 'delete'],
  settings: ['edit'], // organization settings; the Settings page itself (profile, password) is always available
};

const MASTER = ['locations', 'categories', 'departments', 'custodians', 'companies'];
const all = (actions) => Object.fromEntries(actions.map((a) => [a, true]));

/** Defaults reproduce the behaviour the app had before permissions were configurable */
function defaults() {
  const out = {};
  for (const role of ROLES) {
    const p = {};
    for (const [m, actions] of Object.entries(MODULES)) {
      const set = (list) => { p[m] = Object.fromEntries(actions.map((a) => [a, list.includes(a)])); };
      if (role === 'admin') set(actions);
      else if (m === 'users' || m === 'settings') set([]);
      else if (role === 'viewer') set(['view']);
      else if (role === 'manager') set(['view', 'add', 'edit', 'delete']);
      else /* staff */ set(MASTER.includes(m) ? ['view'] : ['view', 'add', 'edit']);
    }
    out[role] = p;
  }
  return out;
}

/** Keep only known roles/modules/actions; anything missing falls back to the default. View is implied by any other action. */
function normalize(input) {
  const base = defaults();
  for (const role of ROLES) {
    if (role === 'admin') continue;
    for (const [m, actions] of Object.entries(MODULES)) {
      for (const a of actions) {
        const v = input?.[role]?.[m]?.[a];
        if (typeof v === 'boolean') base[role][m][a] = v;
      }
      const p = base[role][m];
      if ('view' in p && actions.some((a) => a !== 'view' && p[a])) p.view = true;
    }
  }
  base.admin = Object.fromEntries(Object.entries(MODULES).map(([m, actions]) => [m, all(actions)]));
  return base;
}

let cache = null;

async function getAll() {
  if (!cache) {
    const { rows } = await query(`SELECT value FROM settings WHERE key='role_permissions'`);
    cache = normalize(rows[0]?.value);
  }
  return cache;
}

async function getForRole(role) {
  const perms = await getAll();
  return perms[role] || normalize({}).viewer; // unknown role -> read-only
}

async function save(input) {
  const perms = normalize(input);
  await query(
    `INSERT INTO settings (key, value) VALUES ('role_permissions',$1) ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value`,
    [JSON.stringify(perms)]
  );
  cache = perms;
  return perms;
}

const has = (perms, module, action) => !!perms?.[module]?.[action];

module.exports = { ROLES, MODULES, defaults, normalize, getAll, getForRole, save, has };
