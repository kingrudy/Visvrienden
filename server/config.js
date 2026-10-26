// Instellingen van de server (via omgevingsvariabelen) en het build-id.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const PUBLIC = path.join(ROOT, 'public');
export const GAME_DIR = path.join(ROOT, 'server', 'game');
export const DATA_DIR = process.env.DATA_DIR || path.join(ROOT, 'data');
export const PORT = Number(process.env.PORT) || 8304;
// Extra poorten voor het geval een deploy-platform de containerpoort zelf herschrijft.
export const EXTRA_PORTS = (process.env.EXTRA_PORTS ?? '8080,8787')
  .split(',')
  .map(Number)
  .filter(p => p > 0 && p !== PORT);
export const ALLOW_CHEATS = process.env.ALLOW_CHEATS === '1';
export const VERSION = (() => {
  try {
    return JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version;
  } catch {
    return '?';
  }
})();

export const TICK_MS = 50;
export const MAX_ROOMS = 24;
export const ROOM_IDLE_MS = 45000; // lege kamer opruimen (of resetten als hij vast is)
export const PERMANENT_ROOMS = [
  ['Dorpsvijver', 8],
  ['Vrienden-water', 8],
];

/* Build-id: hash van alle spelbestanden en de spelregels op de server. Staat in elk script-adres
   (/b/<id>/...), zodat een browser of proxy nooit oude spelcode kan combineren met een nieuwe server. */
export const BUILD = (() => {
  const h = crypto.createHash('sha256');
  const walk = d => {
    for (const f of fs.readdirSync(d).sort()) {
      const p = path.join(d, f);
      if (f === 'vendor') continue;
      if (fs.statSync(p).isDirectory()) walk(p);
      else h.update(f).update(fs.readFileSync(p));
    }
  };
  try {
    walk(PUBLIC);
    walk(GAME_DIR);
  } catch {}
  return h.digest('hex').slice(0, 10);
})();
