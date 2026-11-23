const express = require('express');
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const { requireAnyWrite } = require('../middleware/auth');

const ALLOWED = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];

module.exports = (dir) => {
  const storage = multer.diskStorage({
    destination: dir,
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`);
    },
  });
  const upload = multer({
    storage,
    limits: { fileSize: 8 * 1024 * 1024, files: 10 },
    fileFilter: (_req, file, cb) => {
      const ok = ALLOWED.includes(path.extname(file.originalname).toLowerCase()) && file.mimetype.startsWith('image/');
      cb(ok ? null : Object.assign(new Error('invalid_file_type'), { status: 400 }), ok);
    },
  });

  const r = express.Router();
  r.post('/', requireAnyWrite, upload.array('files', 10), (req, res) => {
    res.json({ files: (req.files || []).map((f) => `/uploads/${f.filename}`) });
  });
  return r;
};
