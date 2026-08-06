import http from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';
import { createProxyServer } from 'node:http-proxy';

const ROOT = join(process.cwd(), 'dist_smoke');
const proxy = createProxyServer({ target: 'http://127.0.0.1:5000', changeOrigin: true });
proxy.on('error', (e, req, res) => { res.writeHead(502); res.end('proxy err: ' + e.message); });

const MIME = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json', '.svg':'image/svg+xml', '.png':'image/png', '.woff2':'font/woff2' };

const server = http.createServer((req, res) => {
  if (req.url.startsWith('/api') || req.url.startsWith('/ws')) {
    return proxy.web(req, res);
  }
  let p = decodeURIComponent(req.url.split('?')[0]);
  let file = join(ROOT, p);
  if (!existsSync(file) || statSync(file).isDirectory()) {
    // SPA fallback
    file = join(ROOT, 'index.html');
  }
  if (!existsSync(file)) { res.writeHead(404); return res.end('not found'); }
  res.writeHead(200, { 'Content-Type': MIME[extname(file)] || 'application/octet-stream' });
  createReadStream(file).pipe(res);
});
server.listen(3000, '127.0.0.1', () => console.log('serving dist_smoke on http://127.0.0.1:3000 (proxy /api -> :5000)'));
