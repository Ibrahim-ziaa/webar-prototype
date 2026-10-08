// Minimal static server for local testing. Serves public/ and, for convenience, tools/.
//
//   npm run serve            -> http://localhost:8080 (also reachable on your Wi-Fi IP)
//
// Phones need HTTPS for AR, so on a phone use a tunnel (see README).

import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ROOT, PUBLIC } from './lib.mjs';

const PORT = Number(process.env.PORT || 8080);

// The model MIME types matter: iOS Quick Look rejects USDZ served with the wrong one.
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.usdz': 'model/vnd.usdz+zip',
};

http.createServer((req, res) => {
  // Log each request with its device, so you can see what a phone fetched during AR.
  console.log(new Date().toLocaleTimeString(), req.method, req.url, '|', req.headers['user-agent'] || '');
  const urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const base = urlPath.startsWith('/tools/') ? ROOT : PUBLIC;
  let file = path.normalize(path.join(base, urlPath));
  if (!file.startsWith(base)) return send(res, 403, 'Forbidden');
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) {
    if (!urlPath.endsWith('/')) { res.writeHead(301, { Location: urlPath + '/' }); return res.end(); }
    file = path.join(file, 'index.html');
  }
  if (!fs.existsSync(file)) return send(res, 404, 'Not found');
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
}).listen(PORT, '0.0.0.0', () => {
  console.log(`Serving public/ at http://localhost:${PORT}`);
  for (const nets of Object.values(os.networkInterfaces())) {
    for (const n of nets) if (n.family === 'IPv4' && !n.internal) console.log(`On your Wi-Fi:  http://${n.address}:${PORT}`);
  }
});

function send(res, code, text) {
  res.writeHead(code, { 'Content-Type': 'text/plain' });
  res.end(text);
}
