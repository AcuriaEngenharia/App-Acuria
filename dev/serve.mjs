// Servidor estático simples para testar dist/local.html.
//   node dev/serve.mjs   (porta 8765; ou PORT=9000 node dev/serve.mjs)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dist = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const port = +process.env.PORT || 8765;
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.txt': 'text/plain; charset=utf-8', '.ttf': 'font/ttf', '.json': 'application/json' };
http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p === '/') p = '/local.html';
  const f = path.join(dist, path.normalize(p).replace(/^([/\\])+/, ''));
  if (!f.startsWith(dist) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('não encontrado'); }
  res.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
}).listen(port, () => console.log(`http://localhost:${port}/  (dist/local.html com banco simulado)`));
