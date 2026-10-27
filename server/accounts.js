// Accounts: registreren, inloggen, sessies, pogingenlimiet, huisplekken en de ranglijst.
import crypto from 'node:crypto';
import { promisify } from 'node:util';
import { db, markDirty, allUsers } from './db.js';
import { ensureSave, houseInfo } from './game/progress.js';
import { HOUSE_SLOTS } from '../public/js/shared.js';
import { isRude } from './game/filter.js';

const scrypt = promisify(crypto.scrypt);
const sha = s => crypto.createHash('sha256').update(s).digest('hex');
const USER_RE = /^[A-Za-z0-9_-]{3,16}$/;
const SESSION_MS = 30 * 24 * 3600 * 1000;
const ATTEMPT_WINDOW_MS = 60000,
  MAX_ATTEMPTS = Number(process.env.LOGIN_LIMIT) || 15; // pogingen per minuut per adres

const hashPw = async (pw, salt) => (await scrypt(pw, salt, 64)).toString('hex');

function newSession(key) {
  const token = crypto.randomBytes(24).toString('hex');
  db.sessions[sha(token)] = { u: key, exp: Date.now() + SESSION_MS }; // alleen de hash van het token wordt bewaard
  markDirty();
  return token;
}

export function userByToken(token) {
  if (typeof token !== 'string') return null;
  const key = sha(token),
    s = db.sessions[key];
  if (!s) return null;
  if (s.exp < Date.now()) {
    delete db.sessions[key];
    return null;
  }
  return db.users[s.u] || null;
}

/** Zorgt dat de save klopt en het account een huis heeft. */
export function prepareUser(u) {
  ensureSave(u);
  assignHouse(u);
  return u;
}

export async function register(name, pw) {
  if (typeof name !== 'string' || !USER_RE.test(name)) return { err: 'Gebruikersnaam: 3-16 tekens (letters, cijfers, _ of -).' };
  if (typeof pw !== 'string' || pw.length < 6 || pw.length > 72) return { err: 'Wachtwoord: minimaal 6 tekens.' };
  if (isRude(name)) return { err: 'Kies een nettere gebruikersnaam.' };
  const key = name.toLowerCase();
  if (db.users[key]) return { err: 'Die gebruikersnaam is al in gebruik.' };
  const salt = crypto.randomBytes(16).toString('hex'),
    hash = await hashPw(pw, salt);
  if (db.users[key]) return { err: 'Die gebruikersnaam is al in gebruik.' }; // tegelijk aangemaakt tijdens het hashen
  const u = (db.users[key] = { name, salt, hash, created: Date.now(), save: {} });
  prepareUser(u);
  return { token: newSession(key), name };
}

export async function login(name, pw) {
  const key = typeof name === 'string' ? name.toLowerCase() : '';
  const u = db.users[key];
  const h = await hashPw(typeof pw === 'string' ? pw.slice(0, 72) : '', u ? u.salt : 'x'.repeat(32)); // altijd hashen: geen timing-lek
  if (!u || !crypto.timingSafeEqual(Buffer.from(h, 'hex'), Buffer.from(u.hash, 'hex')))
    return { err: 'Onjuiste gebruikersnaam of wachtwoord.' };
  return { token: newSession(key), name: u.name };
}

/* ---------------- pogingenlimiet voor inloggen/registreren */
const attempts = new Map();
export function limited(ip) {
  const now = Date.now(),
    arr = (attempts.get(ip) || []).filter(t => now - t < ATTEMPT_WINDOW_MS);
  arr.push(now);
  attempts.set(ip, arr);
  return arr.length > MAX_ATTEMPTS;
}
setInterval(() => {
  const now = Date.now();
  for (const [ip, arr] of attempts) if (!arr.some(t => now - t < ATTEMPT_WINDOW_MS)) attempts.delete(ip);
  for (const [h, s] of Object.entries(db.sessions)) if (s.exp < now) delete db.sessions[h];
}, 600000).unref();

/* ---------------- huizen: elk account krijgt een vaste plek in het dorp */
export function assignHouse(u) {
  const s = u.save;
  if (!s || (Number.isInteger(s.house) && s.house >= 0)) return;
  const used = new Set(
    allUsers()
      .map(x => x.save?.house)
      .filter(Number.isInteger),
  );
  for (let i = 0; i < HOUSE_SLOTS.length; i++)
    if (!used.has(i)) {
      s.house = i;
      markDirty();
      return;
    }
}
export const allHouses = () =>
  allUsers()
    .filter(u => u.save && u.save.house >= 0)
    .map(u => houseInfo(u.save, u.name));

/* ---------------- ranglijst */
export function leaderboard() {
  const us = allUsers().filter(u => u.save && u.save.stats);
  const top = (f, n = 10) =>
    us
      .map(u => ({ name: u.name, v: f(u.save) }))
      .filter(x => x.v > 0)
      .sort((a, b) => b.v - a.v)
      .slice(0, n);
  return {
    heaviest: us
      .map(u => ({ name: u.name, v: u.save.stats.best || 0, sp: u.save.stats.bestSp || '' }))
      .filter(x => x.v > 0)
      .sort((a, b) => b.v - a.v)
      .slice(0, 10),
    catches: top(s => s.stats.catches),
    level: top(s => s.lvl),
    species: top(s => Object.keys(s.book || {}).length),
  };
}
export const userCount = () => Object.keys(db.users).length;
