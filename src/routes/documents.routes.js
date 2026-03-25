const express = require('express');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');
const { authenticateToken } = require('../middleware/auth.middleware');

const router = express.Router();

const UPLOADS_DIR = path.resolve(__dirname, '../../uploads');
const DOC_SECRET = process.env.FILE_SIGN_SECRET || process.env.JWT_SECRET;
const DOC_TTL = parseInt(process.env.FILE_URL_TTL_SECONDS) || 120;

const ALLOWED_ROLES = ['system_manager', 'regional_manager', 'Accountant'];

// Validates that a relative path stays within UPLOADS_DIR (no traversal)
const safeFilePath = (relPath) => {
  if (!relPath || relPath.includes('..')) return null;
  const abs = path.join(UPLOADS_DIR, relPath);
  return abs.startsWith(UPLOADS_DIR + path.sep) || abs === UPLOADS_DIR ? abs : null;
};

/**
 * POST /api/documents/token
 * Body: { filename, type: 'document'|'image' }
 * Returns: { token, viewUrl }
 * Requires: valid session cookie
 * - type 'image'    → any authenticated user
 * - type 'document' → admin roles only
 */
router.post('/token', authenticateToken, (req, res) => {
  const { filename, type = 'document' } = req.body;

  if (!filename || typeof filename !== 'string') {
    return res.status(400).json({ error: 'filename is required' });
  }

  if (type === 'document' && !ALLOWED_ROLES.includes(req.user.role)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const filePath = safeFilePath(filename);
  if (!filePath || !fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File not found' });
  }

  const token = jwt.sign(
    { filename, userId: req.user.id, purpose: 'doc_view' },
    DOC_SECRET,
    { expiresIn: DOC_TTL }
  );

  res.json({ token, viewUrl: `/api/documents/view?token=${token}` });
});

/**
 * GET /api/documents/view?token=...
 * Verifies the short-lived token and streams the file.
 * No session cookie needed — token IS the auth.
 */
router.get('/view', (req, res) => {
  const { token } = req.query;
  if (!token) return res.status(401).send('Missing token');

  let payload;
  try {
    payload = jwt.verify(token, DOC_SECRET);
  } catch (err) {
    return res.status(403).send(err.name === 'TokenExpiredError' ? 'Link expired' : 'Invalid token');
  }

  if (payload.purpose !== 'doc_view') return res.status(403).send('Invalid token purpose');

  const filePath = safeFilePath(payload.filename);
  if (!filePath || !fs.existsSync(filePath)) {
    return res.status(404).send('File not found');
  }

  const ext = path.extname(payload.filename).toLowerCase();
  const inlineTypes = ['.pdf', '.jpg', '.jpeg', '.png', '.gif', '.webp'];
  const disposition = inlineTypes.includes(ext) ? 'inline' : 'attachment';
  const basename = path.basename(payload.filename);

  res.setHeader('Content-Disposition', `${disposition}; filename="${basename}"`);
  res.setHeader('Cache-Control', 'no-store');
  res.sendFile(filePath);
});

module.exports = router;
