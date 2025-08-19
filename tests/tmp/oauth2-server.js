const express = require('express');
const bodyParser = require('body-parser');

const app = express();
app.use(bodyParser.urlencoded({ extended: false }));

app.post('/token', (req, res) => {
  console.log('OAuth2 Server: Token Request Headers:', req.headers); // Log headers
  const { grant_type, client_id, client_secret } = req.body;

  // Per OAuth 2.0 recommendations, prevent caching of token responses
  res.set('Cache-Control', 'no-store');
  res.set('Pragma', 'no-cache');

  if (grant_type === 'client_credentials' && client_id === 'test' && client_secret === 'secret') {
    res.json({
      access_token: 'test_access_token',
      token_type: 'bearer'
    });
  } else {
    res.status(400).json({ error: 'invalid_grant' });
  }
});

app.get('/widgets', (req, res) => {
  console.log('OAuth2 Server: Widgets Request Headers:', req.headers); // Log headers
  const authHeader = req.headers.authorization;
  if (authHeader === 'Bearer test_access_token') {
    res.json([{ id: '1', name: 'widget1' }]);
  } else {
    res.status(401).json({ error: 'unauthorized' });
  }
});

const port = 3002;
app.listen(port, () => {
  console.log(`OAuth2 server listening on port ${port}`);
});
