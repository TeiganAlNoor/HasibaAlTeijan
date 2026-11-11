// No build step or dependencies. Local-only preview; never exposes production data.
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const port = Number(process.env.PORT || 4173);
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.ico': 'image/x-icon', '.ttf': 'font/ttf', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8', '.webmanifest': 'application/manifest+json' };
const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, 'http://localhost');
    if (decodeURIComponent(url.pathname).split(/[\\/]/u).some(part => part.startsWith('.'))) {
      response.writeHead(403).end('Forbidden'); return;
    }
    const path = resolve(root, '.' + decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname));
    if (!path.startsWith(root.endsWith(sep) ? root : root + sep) || !['GET', 'HEAD'].includes(request.method)) {
      response.writeHead(403).end('Forbidden'); return;
    }
    if (!(await stat(path)).isFile()) throw new Error('Not a file');
    const cache = /NotoSansArabic-v2\.012-e5ee313\.ttf$/u.test(path) ? 'public, max-age=31536000, immutable' : 'no-cache';
    response.writeHead(200, { 'Content-Type': types[extname(path)] || 'application/octet-stream', 'Cache-Control': cache, 'X-Content-Type-Options': 'nosniff' });
    response.end(request.method === 'HEAD' ? undefined : await readFile(path));
  } catch { response.writeHead(404).end('Not found'); }
});
server.listen(port, '127.0.0.1', () => console.log(`Hasiba Al Teijan: http://127.0.0.1:${port}`));
