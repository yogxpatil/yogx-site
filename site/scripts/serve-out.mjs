// Serve the static export (out/) the way a plain static host does: files as they are, a folder's index.html,
// gzip for text, long cache for hashed assets. For local checks and the e2e/perf runs; production needs no server code.
// Usage: node scripts/serve-out.mjs [port]   (default: $PORT or 3100)
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', 'out');
const port = Number(process.argv[2] || process.env.PORT || 3100);
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.txt': 'text/plain; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.webp': 'image/webp', '.jpg': 'image/jpeg',
};
const TEXT = /^(text\/|application\/json|image\/svg)/;

async function file(p) {
  try { const s = await stat(p); return s.isFile() ? p : null; } catch { return null; }
}

createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://x');
  const rel = path.normalize(decodeURIComponent(url.pathname)).replace(/^([/\\])+/, '');
  const abs = path.join(root, rel);
  if (!abs.startsWith(root)) { res.writeHead(403).end(); return; }
  let hit = await file(abs);
  if (!hit && !url.pathname.endsWith('/') && await file(path.join(abs, 'index.html'))) {
    res.writeHead(308, { Location: url.pathname + '/' + url.search }).end(); return;
  }
  hit ??= await file(path.join(abs, 'index.html'));
  const type = hit ? TYPES[path.extname(hit)] ?? 'application/octet-stream' : 'text/html; charset=utf-8';
  let body = await readFile(hit ?? path.join(root, '404.html')).catch(() => Buffer.from('not found'));
  const head = { 'Content-Type': type, 'Cache-Control': rel.startsWith('_next/static/') ? 'public, max-age=31536000, immutable' : 'no-cache' };
  if (TEXT.test(type) && /\bgzip\b/.test(req.headers['accept-encoding'] ?? '')) { body = gzipSync(body); head['Content-Encoding'] = 'gzip'; }
  res.writeHead(hit ? 200 : 404, head).end(body);
}).listen(port, () => console.log(`out/ on http://localhost:${port}`));
