const express = require('express');
const { crudRouter } = require('../utils/crud');
const { query } = require('../db');
const { broadcast } = require('../events');
/** real-time "new item" notification after a create */
const notify = (type, codeKey) => (row, req) =>
  broadcast({ type, ref: row.id, code: row[codeKey] || null, name: row.name, by: req.user.name, byId: req.user.id });

const r = express.Router();

r.use('/companies', crudRouter({
  module: 'companies',
  table: 'companies',
  fields: ['code', 'name', 'active'],
  required: ['code', 'name'],
  search: ['code', 'name'],
  list: (w) => `SELECT t.*, (SELECT COUNT(*) FROM assets a WHERE a.company_id=t.id) AS asset_count FROM companies t ${w}`,
}));

r.use('/departments', crudRouter({
  module: 'departments',
  table: 'department_codes',
  afterCreate: notify('department', 'dept_no'),
  fields: ['code', 'name', 'head', 'email', 'dept_no', 'active'],
  required: ['name'],
  search: ['code', 'name', 'head', 'email', 'dept_no'],
  // Dept Code ascending (102, 203 … 601), departments without a Dept Code at the end by name
  order: `(t.dept_no !~ '^[0-9]+$' OR t.dept_no IS NULL), CASE WHEN t.dept_no ~ '^[0-9]+$' THEN t.dept_no::int END, t.name`,
  list: (w) => `SELECT t.*,
                       (SELECT COUNT(*) FROM assets a WHERE a.department_id=t.id) AS asset_count,
                       (SELECT COUNT(*) FROM custodians c WHERE c.department_id=t.id) AS custodian_count
                  FROM department_codes t ${w}`,
}));

r.use('/locations', crudRouter({
  module: 'locations',
  table: 'locations',
  fields: ['code', 'name', 'building', 'floor', 'room', 'description', 'active'],
  required: ['code', 'name'],
  search: ['code', 'name', 'building', 'floor', 'room'],
  order: 't.id',
  // code is optional in the UI: auto-number LOC-001, LOC-002 ...
  beforeCreate: async (data) => {
    if (!data.code || !String(data.code).trim()) {
      const { rows } = await query(`SELECT COALESCE(MAX(SUBSTRING(code FROM '^LOC-(\\d+)$')::int),0)+1 AS n FROM locations`);
      data.code = `LOC-${String(rows[0].n).padStart(3, '0')}`;
    }
  },
  list: (w) => `SELECT t.*, (SELECT COUNT(*) FROM assets a WHERE a.location_id=t.id) AS asset_count FROM locations t ${w}`,
}));

r.use('/custodians', crudRouter({
  module: 'custodians',
  table: 'custodians',
  fields: ['employee_code', 'name', 'position', 'department_id', 'phone', 'email', 'active'],
  required: ['name'],
  search: ['employee_code', 'name', 'position', 'email'],
  order: 't.name',
  filters: ['department_id'],
  list: (w) => `SELECT t.*, d.name AS department_name, d.code AS department_code,
                       (SELECT COUNT(*) FROM assets a WHERE a.custodian_id=t.id) AS asset_count
                  FROM custodians t LEFT JOIN department_codes d ON d.id=t.department_id ${w}`,
}));

r.use('/categories', crudRouter({
  module: 'categories',
  table: 'asset_codes',
  afterCreate: notify('asset_code', 'code'),
  fields: ['code', 'account_code', 'name', 'description', 'inspection_months', 'checklist', 'color', 'active'],
  required: ['code', 'name'],
  search: ['code', 'account_code', 'name', 'description'],
  json: ['checklist'],
  // asset code ascending: numeric codes in number order (300, 400 … 615), then text codes (CONSTRCUTION, ENT, IT, TOL)
  order: `(t.code !~ '^[0-9]+$'), CASE WHEN t.code ~ '^[0-9]+$' THEN t.code::bigint END, t.code`,

  list: (w) => `SELECT t.*,
                       (SELECT COUNT(*) FROM assets a WHERE a.category_id=t.id) AS asset_count,
                       COALESCE((SELECT json_agg(json_build_object('id',x.id,'number',x.number,'name',x.name,'active',x.active) ORDER BY x.number)
                                   FROM asset_types x WHERE x.category_id=t.id), '[]') AS types
                  FROM asset_codes t ${w}`,
}));

r.use('/asset-types', crudRouter({
  module: 'categories', // types are managed inside a category: changing them counts as editing the category
  perm: { add: 'edit', edit: 'edit', delete: 'edit' },
  table: 'asset_types',
  fields: ['category_id', 'number', 'name', 'active'],
  required: ['category_id', 'number', 'name'],
  search: ['number', 'name'],
  order: 't.category_id, t.number',
  filters: ['category_id'],
}));

// Everything the asset form needs in one round-trip
r.get('/lookups', async (_req, res) => {
  const [companies, departments, categories, types, locations, custodians] = await Promise.all([
    query('SELECT id, code, name FROM companies WHERE active ORDER BY id'), // P (Poipet Resort) first = default
    // dropdown label is "504 · NAME", so list by Dept Code (departments without one at the end)
    query(`SELECT id, code, name, dept_no FROM department_codes WHERE active
           ORDER BY (dept_no !~ '^[0-9]+$' OR dept_no IS NULL), CASE WHEN dept_no ~ '^[0-9]+$' THEN dept_no::int END, name`),
    // dropdown label is "602 · NAME", so list by code (100, 110, 170, 200 … 910), text codes at the end
    query(`SELECT id, code, account_code, name, color, inspection_months, checklist FROM asset_codes WHERE active
           ORDER BY (code !~ '^[0-9]+$'), CASE WHEN code ~ '^[0-9]+$' THEN code::bigint END, code`),
    query('SELECT id, category_id, number, name FROM asset_types WHERE active ORDER BY category_id, number'),
    query('SELECT id, code, name, building, floor, room FROM locations WHERE active ORDER BY name'),
    query('SELECT id, employee_code, name, department_id FROM custodians WHERE active ORDER BY name'),
  ]);
  res.json({
    companies: companies.rows, departments: departments.rows, categories: categories.rows,
    types: types.rows, locations: locations.rows, custodians: custodians.rows,
  });
});

module.exports = r;
