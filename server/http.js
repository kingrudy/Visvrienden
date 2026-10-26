// HTTP: statische spelbestanden (met build-id, gzip en cache) en de kleine JSON-API.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { PUBLIC, BUILD, VERSION } from './config.js';
import { register, login, limited, leaderboard, userCount } from './accounts.js';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.glb': 'model/gltf-binary',
  '.mp3': 'audio/mpeg',
  '.txt': 'text/plain; charset=utf-8',
};
const GZIP = new Set(['.html', '.js', '.css', '.json', '.svg', '.glb']);
const MAX_BODY = 4096;
const cache = new Map(); // bestand(+gzip) -> { mtime, buf }

function serveStatic(req, res) {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname),
    versioned = false;
  const vm = /^\/b\/([A-Za-z0-9]+)(\/.*)$/.exec(p);
  if (vm) {
    versioned = vm[1] === BUILD;
    p = vm[2];
  }
  if (p === '/') p = '/index.html';
  const file = path.normalize(path.join(PUBLIC, p));
  if (!file.startsWith(PUBLIC + path.sep)) {
    res.writeHead(403).end();
    return;
  }
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Niet gevonden');
      return;
    }
    const ext = path.extname(file),
      isHtml = ext === '.html';
    const immutable = !isHtml && (versioned || p.startsWith('/vendor/'));
    const headers = {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': immutable ? 'public, max-age=31536000, immutable' : 'no-store, max-age=0',
    };
    const gz = GZIP.has(ext) && /\bgzip\b/.test(req.headers['accept-encoding'] || '');
    if (gz) headers['Content-Encoding'] = 'gzip';
    const ck = file + (gz ? ':gz' : ''),
      hit = cache.get(ck);
    if (hit && hit.mtime === st.mtimeMs) {
      res.writeHead(200, headers).end(req.method === 'HEAD' ? undefined : hit.buf);
      return;
    }
    fs.readFile(file, (e, buf) => {
      if (e) {
        res.writeHead(500).end();
        return;
      }
      if (isHtml) buf = Buffer.from(buf.toString('utf8').replaceAll('__BUILD__', BUILD));
      if (gz) buf = zlib.gzipSync(buf);
      cache.set(ck, { mtime: st.mtimeMs, buf });
      res.writeHead(200, headers).end(req.method === 'HEAD' ? undefined : buf);
    });
  });
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let n = 0;
    const chunks = [];
    req.on('data', c => {
      n += c.length;
      if (n > MAX_BODY) {
        reject(new Error('te groot'));
        req.destroy();
      } else chunks.push(c);
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString() || '{}'));
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}
const json = (res, code, obj) =>
  res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }).end(JSON.stringify(obj));

/** @param {{ roomCount: () => number }} lobby */
export function createRequestHandler(lobby) {
  const routes = {
    'GET /api/leaderboard': () => [200, leaderboard()],
    'GET /api/health': () => [200, { ok: true, version: VERSION, build: BUILD, rooms: lobby.roomCount(), users: userCount() }],
    'POST /api/register': async (req, body) => auth(req, () => register(body.username, body.password)),
    'POST /api/login': async (req, body) => auth(req, () => login(body.username, body.password)),
  };
  async function auth(req, fn) {
    const ip = (req.socket.remoteAddress || '?') + (req.headers['x-forwarded-for'] || '');
    if (limited(ip)) return [429, { err: 'Te veel pogingen. Probeer het over een minuut opnieuw.' }];
    const r = await fn();
    return [r.err ? 400 : 200, r];
  }
  return async (req, res) => {
    try {
      const url = new URL(req.url, 'http://x');
      if (url.pathname.startsWith('/api/')) {
        const route = routes[req.method + ' ' + url.pathname];
        if (!route) return json(res, 404, { err: 'Onbekend' });
        let body = {};
        if (req.method === 'POST') {
          try {
            body = await readJson(req);
          } catch {
            return json(res, 400, { err: 'Ongeldig verzoek.' });
          }
        }
        const [code, out] = await route(req, body || {});
        return json(res, code, out);
      }
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        res.writeHead(405).end();
        return;
      }
      serveStatic(req, res);
    } catch (e) {
      console.error(e);
      if (!res.headersSent) res.writeHead(500).end();
    }
  };
}
