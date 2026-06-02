const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function(app) {
  // 从环境变量读取 API 地址，支持自定义配置
  // 默认保持 localhost 兼容现有部署
  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';
  
  // API 代理
  app.use(
    '/api',
    createProxyMiddleware({
      target: API_URL,
      changeOrigin: true,
    })
  );

  // WebSocket 代理
  app.use(
    '/ws',
    createProxyMiddleware({
      target: API_URL,
      changeOrigin: true,
      ws: true,
    })
  );

  app.use(function(req, res, next) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    next();
  });
};