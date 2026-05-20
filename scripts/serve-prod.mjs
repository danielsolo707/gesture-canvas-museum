import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { downloadHandler } from './download-server.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.resolve(__dirname, '..', 'dist');
const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = process.env.HOST || '0.0.0.0';

const MIME = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
  '.wasm': 'application/wasm',
  '.txt': 'text/plain',
};

const server = http.createServer((req, res) => {
  if (downloadHandler(req, res)) return;

  let filePath = path.join(DIST, req.url === '/' ? 'index.html' : req.url);
  const ext = path.extname(filePath);

  fs.readFile(filePath, (err, data) => {
    if (err) {
      if (err.code === 'ENOENT') {
        fs.readFile(path.join(DIST, 'index.html'), (err2, data2) => {
          if (err2) {
            res.statusCode = 500;
            res.end('Internal error');
            return;
          }
          res.setHeader('Content-Type', 'text/html');
          res.end(data2);
        });
        return;
      }
      res.statusCode = 500;
      res.end('Internal error');
      return;
    }
    res.setHeader('Content-Type', MIME[ext] || 'application/octet-stream');
    res.setHeader('Cache-Control', ext === '.html' ? 'no-cache' : 'max-age=86400');
    res.end(data);
  });
});

server.listen(PORT, HOST, () => {
  const interfaces = os.networkInterfaces();
  const addresses = [];
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (iface.family === 'IPv4' && !iface.internal) {
        addresses.push(iface.address);
      }
    }
  }

  console.log(`\n  🖼️  Gesture Canvas — Production Server`);
  console.log(`  ─────────────────────────────────────`);
  console.log(`  Local:    http://localhost:${PORT}`);
  for (const ip of addresses) {
    console.log(`  Network:  http://${ip}:${PORT}`);
  }
  console.log(`  QR Download API active at /api/upload → /api/download/:id\n`);
});
