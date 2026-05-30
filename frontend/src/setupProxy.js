const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function(app) {
  console.log('[PROXY] Initializing proxy configuration...');
  
  app.use(
    '/api',
    createProxyMiddleware({
      target: 'http://127.0.0.1:5000',
      changeOrigin: true,
      secure: false,
      pathRewrite: {
        '^/api': '/api'
      },
      logLevel: 'debug',
      timeout: 30000,
      proxyTimeout: 30000,
      onError: (err, req, res) => {
        console.error('[PROXY] Error:', err.message);
        if (!res.headersSent) {
          res.writeHead(504, {
            'Content-Type': 'application/json'
          });
          res.end(JSON.stringify({
            success: false,
            message: '请求超时，请稍后重试'
          }));
        }
      }
    })
  );
  
  console.log('[PROXY] Proxy configuration completed!');
};
