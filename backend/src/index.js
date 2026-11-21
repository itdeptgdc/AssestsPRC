require('dotenv').config();
const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { pool, ensureDatabase } = require('./db');
const { seed } = require('./seed');
const { authenticate } = require('./middleware/auth');

const PORT = process.env.PORT || 4000;
const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR || path.join(__dirname, '..', 'uploads'));
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const app = express();
app.set('trust proxy', 1);
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : true }));
app.use(express.json({ limit: '5mb' }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use('/uploads', express.static(UPLOAD_DIR, { maxAge: '7d' }));

app.get('/api/health', async (_req, res) => {
  await pool.query('SELECT 1');
  res.json({ ok: true, time: new Date().toISOString() });
});

// Public
app.use('/api/auth', require('./routes/auth'));
app.use('/api/public', require('./routes/public'));

// Authenticated
app.use('/api', authenticate);
app.use('/api/upload', require('./routes/upload')(UPLOAD_DIR));
app.use('/api/assets', require('./routes/assets'));
app.use('/api/inspections', require('./routes/inspections'));
app.use('/api/repairs', require('./routes/repairs'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/users', require('./routes/users'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/events', require('./events').router); // real-time notifications (SSE)
app.use('/api', require('./routes/master'));

app.use('/api', (_req, res) => res.status(404).json({ error: 'not_found' }));

// Error handler (Express 5 forwards async errors here)
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  if (err.code === '23505') return res.status(409).json({ error: 'duplicate', detail: err.detail });
  if (err.code === '23503') return res.status(409).json({ error: 'in_use', detail: err.detail });
  if (err.code === '22P02' || err.code === '22007' || err.code === '22008') return res.status(400).json({ error: 'invalid_input' });
  if (err.name === 'MulterError') return res.status(400).json({ error: 'upload_failed', detail: err.message });
  if (err.status) return res.status(err.status).json({ error: err.message });
  console.error(err);
  res.status(500).json({ error: 'server_error' });
});

async function init() {
  for (let attempt = 1; ; attempt++) {
    try {
      await ensureDatabase().catch((e) => {
        // no permission to create databases is fine if it already exists
        if (e.code !== '42501') throw e;
      });
      await pool.query('SELECT 1');
      break;
    } catch (e) {
      if (attempt >= 15) {
        console.error(`[db] cannot connect: ${e.message}\n     Check DATABASE_URL in backend/.env and that PostgreSQL is running.`);
        throw e;
      }
      console.log(`[db] waiting for PostgreSQL (${attempt}) ... ${e.message}`);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
  await pool.query(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));
  await seed(pool);
}

init()
  .then(() => app.listen(PORT, () => console.log(`Asset PRC API listening on :${PORT}`)))
  .catch((e) => {
    console.error('Failed to start', e);
    process.exit(1);
  });
