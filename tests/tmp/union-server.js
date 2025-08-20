const express = require('express');
const app = express();
app.use(express.json());

app.post('/union-any', (req, res) => {
  return res.json({ ok: true, type: 'any' });
});

app.post('/union-one', (req, res) => {
  return res.json({ ok: true, type: 'one' });
});

app.all('/union-nested', (req, res) => {
  return res.json({ ok: true, type: 'nested' });
});

app.all('/union-array', (req, res) => {
  return res.json({ ok: true, type: 'array' });
});

const port = process.env.PORT || 4556;
const host = process.env.HOST || '127.0.0.1';
app.listen(port, host, () => console.log(`Union test server listening on ${host}:${port}`));
