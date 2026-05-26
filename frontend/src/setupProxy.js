const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function(app) {
  console.log('[PROXY] 初始化代理配置...');
  
  app.use(
    '/api',
    createProxyMiddleware({
      target: 'http://127.0.0.1:5000',
      changeOrigin: true,
      secure: false,
      onProxyReq: (proxyReq, req, res) => {
        console.log(`[PROXY] ${req.method} ${req.url} -> ${proxyReq.path}`);
        proxyReq.setHeader('X-Forwarded-For', req.connection.remoteAddress);
        proxyReq.setHeader('X-Forwarded-Proto', 'https');
      },
      onProxyRes: (proxyRes, req, res) => {
        console.log(`[PROXY] Response: ${proxyRes.statusCode} for ${req.url}`);
      },
      onError: (err, req, res) => {
        console.error(`[PROXY] Error: ${err}`);
      }
    })
  );
  
  console.log('[PROXY] 代理配置完成！');
};