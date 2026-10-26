// Opslag: alle accounts en sessies in één JSON-bestand, met uitgestelde schrijfacties en dagelijkse back-ups.
import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIR } from './config.js';

const DB_FILE = path.join(DATA_DIR, 'db.json');
const BACKUP_DIR = path.join(DATA_DIR, 'backups');
const KEEP_BACKUPS = 7;

fs.mkdirSync(DATA_DIR, { recursive: true });

/** @type {{ users: Record<string, any>, sessions: Record<string, { u: string, exp: number }> }} */
export const db = { users: {}, sessions: {} };
try {
  Object.assign(db, JSON.parse(fs.readFileSync(DB_FILE, 'utf8')));
} catch (e) {
  if (e.code !== 'ENOENT') console.error('db lezen mislukt:', e.message);
}
delete db.rooms; // oud, ongebruikt veld

let saveTimer = null;
export function flush() {
  clearTimeout(saveTimer);
  saveTimer = null;
  try {
    const tmp = DB_FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(db));
    fs.renameSync(tmp, DB_FILE); // atomair: nooit een half bestand
  } catch (e) {
    console.error('db schrijven mislukt:', e.message);
  }
}
/** Schrijf binnen 1,5 seconde weg (bundelt veel wijzigingen tot één schrijfactie). */
export function markDirty() {
  if (!saveTimer) saveTimer = setTimeout(flush, 1500);
}

/** Dagelijkse kopie van db.json; de laatste KEEP_BACKUPS blijven bewaard. */
export function backup() {
  try {
    if (!fs.existsSync(DB_FILE)) return;
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    const f = path.join(BACKUP_DIR, 'db-' + new Date().toISOString().slice(0, 10) + '.json');
    if (!fs.existsSync(f)) fs.copyFileSync(DB_FILE, f);
    const all = fs
      .readdirSync(BACKUP_DIR)
      .filter(n => /^db-\d{4}-\d{2}-\d{2}\.json$/.test(n))
      .sort();
    for (const n of all.slice(0, -KEEP_BACKUPS)) fs.unlinkSync(path.join(BACKUP_DIR, n));
  } catch (e) {
    console.error('back-up mislukt:', e.message);
  }
}

export function startPersistence() {
  backup();
  setInterval(() => {
    flush();
    backup();
  }, 3600000).unref();
  for (const sig of ['SIGINT', 'SIGTERM'])
    process.on(sig, () => {
      flush();
      process.exit(0);
    });
}

export const allUsers = () => Object.values(db.users);
