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
      logLevel: 'debug'
    })
  );
  
  console.log('[PROXY] Proxy configuration completed!');
};
