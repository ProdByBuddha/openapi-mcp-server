const express = require('express');

const app = express();

// Simple auth-guarded endpoints
app.get('/ping-api-key', (req, res) => {
  const key = req.header('X-API-Key');
  if (key === 'k') return res.json({ ok: true, scheme: 'apiKey' });
  return res.status(401).json({ error: 'missing_or_invalid_api_key' });
});

app.get('/ping-bearer', (req, res) => {
  const auth = req.header('Authorization') || '';
  if (auth === 'Bearer token') return res.json({ ok: true, scheme: 'bearer' });
  return res.status(401).json({ error: 'missing_or_invalid_bearer' });
});

app.get('/ping-basic', (req, res) => {
  const auth = req.header('Authorization') || '';
  const expected = Buffer.from('u:p').toString('base64');
  if (auth === `Basic ${expected}`) return res.json({ ok: true, scheme: 'basic' });
  return res.status(401).json({ error: 'missing_or_invalid_basic' });
});

const port = 3999;
app.listen(port, () => console.log(`Auth test server listening on ${port}`));

