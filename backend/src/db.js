const { Pool, types } = require('pg');

// Keep DATE columns as 'YYYY-MM-DD' strings (avoid timezone shifts) and NUMERIC as numbers
types.setTypeParser(1082, (v) => v);
types.setTypeParser(1700, (v) => (v === null ? null : parseFloat(v)));
types.setTypeParser(20, (v) => (v === null ? null : parseInt(v, 10)));

const DATABASE_URL = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/assetqr_db';
// All business dates ("today", overdue, ticket months) follow Cambodia time, regardless of the server clock
const APP_TZ = process.env.APP_TIMEZONE || 'Asia/Phnom_Penh';
const pool = new Pool({ connectionString: DATABASE_URL, max: 15, options: `-c timezone=${APP_TZ}` });

/** Today's date as YYYY-MM-DD in the app timezone */
function todayLocal(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: APP_TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

/** Create the target database (e.g. assetqr_db) if it does not exist yet */
async function ensureDatabase() {
  const url = new URL(DATABASE_URL);
  const name = decodeURIComponent(url.pathname.replace(/^\//, ''));
  if (!/^[A-Za-z0-9_]+$/.test(name)) return;
  url.pathname = '/postgres';
  const admin = new Pool({ connectionString: url.toString(), max: 1 });
  try {
    const { rowCount } = await admin.query('SELECT 1 FROM pg_database WHERE datname=$1', [name]);
    if (!rowCount) {
      await admin.query(`CREATE DATABASE "${name}" ENCODING 'UTF8' TEMPLATE template0`);
      console.log(`[db] created database ${name}`);
    }
  } finally {
    await admin.end();
  }
}

const query = (text, params) => pool.query(text, params);

/** Run fn(client) in a transaction */
async function tx(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

function prepare(obj, jsonFields = []) {
  const keys = Object.keys(obj);
  const values = keys.map((k) => (jsonFields.includes(k) && obj[k] !== null ? JSON.stringify(obj[k]) : obj[k]));
  return { keys, values };
}

async function insert(db, table, obj, jsonFields = []) {
  const { keys, values } = prepare(obj, jsonFields);
  const sql = `INSERT INTO ${table} (${keys.join(',')}) VALUES (${keys.map((_, i) => `$${i + 1}`).join(',')}) RETURNING *`;
  const { rows } = await db.query(sql, values);
  return rows[0];
}

async function update(db, table, id, obj, jsonFields = []) {
  const { keys, values } = prepare(obj, jsonFields);
  if (!keys.length) {
    const { rows } = await db.query(`SELECT * FROM ${table} WHERE id=$1`, [id]);
    return rows[0];
  }
  const sets = keys.map((k, i) => `${k}=$${i + 1}`).join(',');
  const { rows } = await db.query(`UPDATE ${table} SET ${sets} WHERE id=$${keys.length + 1} RETURNING *`, [...values, id]);
  return rows[0];
}

/** Copy only whitelisted fields; '' becomes null */
function pick(body, fields) {
  const out = {};
  for (const f of fields) {
    if (body && body[f] !== undefined) out[f] = body[f] === '' ? null : body[f];
  }
  return out;
}

async function logActivity(db, userId, action, entity, entityId, details) {
  try {
    await db.query(
      'INSERT INTO activity_logs (user_id, action, entity, entity_id, details) VALUES ($1,$2,$3,$4,$5)',
      [userId || null, action, entity, entityId || null, details ? JSON.stringify(details) : null]
    );
  } catch (e) {
    console.error('activity log failed', e.message);
  }
}

module.exports = { pool, query, tx, insert, update, pick, logActivity, ensureDatabase, todayLocal, APP_TZ };
