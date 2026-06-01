const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

app.use('/api', createProxyMiddleware({
  target: 'http://localhost:5000',
  changeOrigin: true,
}));

app.use(createProxyMiddleware({
  target: 'http://localhost:3000',
  changeOrigin: true,
  ws: true,
  onProxyReq: (proxyReq, req, res) => {
    proxyReq.setHeader('Host', 'localhost:3000');
  }
}));

app.listen(PORT, () => {
  console.log(`Proxy server running on http://localhost:${PORT}`);
});