const express = require('express');
const app = express();
app.use(express.json({ limit: '1mb' }));

// CORS
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// Forward all requests to KuCoin API
app.all('/proxy/*', async (req, res) => {
  try {
    // Extract target path from /proxy/api/v1/...
    const targetPath = req.originalUrl.replace('/proxy', '');
    const targetUrl = `https://api.kucoin.com${targetPath}`;
    
    // Forward all KC-API-* headers
    const headers = {};
    for (const [key, value] of Object.entries(req.headers)) {
      if (key.toLowerCase().startsWith('kc-') || key.toLowerCase() === 'content-type') {
        headers[key] = value;
      }
    }

    const options = {
      method: req.method,
      headers,
      body: ['GET', 'HEAD'].includes(req.method) ? undefined : JSON.stringify(req.body),
    };

    const response = await fetch(targetUrl, options);
    const data = await response.text();
    
    res.status(response.status)
       .set('Content-Type', 'application/json')
       .send(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok', region: 'sgp' }));

const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`KuCoin relay running on port ${PORT} in Singapore`);
});