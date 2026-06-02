const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

// 从环境变量读取后端和前端地址，支持自定义配置
// 默认保持 localhost 兼容现有部署
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5000';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

app.use('/api', createProxyMiddleware({
  target: BACKEND_URL,
  changeOrigin: true,
  onError: (err, req, res) => {
    console.error('[API Proxy Error]', err.message);
    if (!res.headersSent) {
      res.status(502).json({ 
        error: 'Backend service unavailable',
        message: 'Please ensure the backend service is running on port 5000'
      });
    }
  },
  onProxyReq: (proxyReq, req, res) => {
    console.log(`[API] ${req.method} ${req.url}`);
  }
}));

app.use(createProxyMiddleware({
  target: FRONTEND_URL,
  changeOrigin: true,
  ws: true,
  onError: (err, req, res) => {
    console.error('[Frontend Proxy Error]', err.message);
    if (!res.headersSent) {
      res.status(502).send(`
        <html>
          <body style="font-family: sans-serif; text-align: center; padding: 50px;">
            <h1>Frontend service unavailable</h1>
            <p>Please ensure the frontend service is running on port 3000</p>
            <p>Run: <code>npm start</code> in the frontend directory</p>
          </body>
        </html>
      `);
    }
  },
  onProxyReq: (proxyReq, req, res) => {
    proxyReq.setHeader('Host', 'localhost:3000');
  }
}));

app.listen(PORT, () => {
  console.log(`Proxy server running on http://localhost:${PORT}`);
  console.log(`  - API requests -> ${BACKEND_URL}`);
  console.log(`  - Other requests -> ${FRONTEND_URL}`);
}).on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. Please close the conflicting process.`);
  } else {
    console.error('Proxy server error:', err.message);
  }
  process.exit(1);
});