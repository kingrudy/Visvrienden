// Autoritatieve spelsimulatie voor één kamer: spelers, vissen in de vijvers, aanbeten, de worsteling, winkel, wedstrijden.

import * as S from './public/shared.js';
const { PONDS, SPECIES, SP, RARITY, BAIT, BAITS, RODS, UPGRADES, MOUNTS, TALENTS, BUFFS, ACHIEVEMENTS, QUEST_KINDS } = S;

const r1 = v => Math.round(v * 10) / 10, r2 = v => Math.round(v * 100) / 100;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = a => a[Math.floor(Math.random() * a.length)];
const NL = { timeZone: 'Europe/Amsterdam' };
export const today = () => new Intl.DateTimeFormat('sv-SE', NL).format(new Date());
const isWeekend = () => { const d = new Intl.DateTimeFormat('en-US', { ...NL, weekday: 'short' }).format(new Date()); return d === 'Sat' || d === 'Sun'; };
const DOG_NAMES = ['Bobbel', 'Snuf', 'Dobber', 'Pluk', 'Max', 'Fikkie', 'Rakker', 'Sproet', 'Knor', 'Bello', 'Wally', 'Tobbe'];

export const CFG = {
  tick: 0.05,
  maxSpeedMul: 1.7,
  heronRelocate: 150,
  merchantEvery: 12 * 60, merchantStay: 4 * 60,
  weatherMin: 180, weatherMax: 360,
  legendRespawn: 8 * 60,
  dogDigEvery: 240,
};

/* ------------------------------------------------------------------ voortgang */
export function levelInfo(xp) {
  let lvl = 1, rest = xp;
  while (lvl < S.MAX_LEVEL && rest >= S.levelNeed(lvl)) { rest -= S.levelNeed(lvl); lvl++; }
  return { level: lvl, cur: lvl >= S.MAX_LEVEL ? 0 : rest, need: lvl >= S.MAX_LEVEL ? 0 : S.levelNeed(lvl) };
}
const spent = t => Object.values(t).reduce((a, b) => a + b, 0);
export function applyTalent(save, id) {
  if (!(id in TALENTS)) return false;
  if (save.talents[id] >= S.TALENT_MAX) return false;
  if (spent(save.talents) >= save.lvl - 1) return false;
  save.talents[id]++; return true;
}
export function resetTalents(save) { for (const k of Object.keys(TALENTS)) save.talents[k] = 0; }

function seeded(str) { let h = 2166136261; for (const c of str) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return () => { h = Math.imul(h ^ (h >>> 15), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); h ^= h >>> 16; return (h >>> 0) / 4294967295; }; }
function dailyQuests(name, day, save) {
  const rng = seeded(name + day), kinds = Object.keys(QUEST_KINDS), out = [];
  const highest = Math.max(0, ...save.unlocked, 0);
  const pool = SPECIES.filter(s => !s.leg && s.pond <= highest && s.rar <= 2 && s.pond <= 5);
  while (out.length < 3) {
    const k = kinds[Math.floor(rng() * kinds.length)];
    if (out.some(q => q.kind === k)) continue;
    const K = QUEST_KINDS[k], tier = Math.min(2, Math.floor(highest / 2) + (rng() < 0.4 ? 1 : 0)), n = K.n[Math.min(2, tier)];
    const q = { id: out.length, kind: k, n, p: 0, done: false, coins: Math.round(K.coins * (K.one ? 1 : n) * (1 + highest * 0.25)), xp: Math.round(K.xp * (K.one ? 1 : n)) };
    if (k === 'species') q.sp = pool[Math.floor(rng() * pool.length)].id;
    out.push(q);
  }
  return out;
}
export function ensureDaily(u) {
  const s = u.save, day = today();
  if (!s.daily || s.daily.day !== day || !Array.isArray(s.daily.q)) s.daily = { day, q: dailyQuests(u.name, day, s) };
  return s.daily;
}
export function ensureSave(u) {
  const s = u.save || (u.save = {});
  const num = (v, d = 0) => Number.isFinite(v) ? v : d;
  s.coins = Math.max(0, num(s.coins, 80) | 0); s.xp = Math.max(0, num(s.xp) | 0); s.rep = Math.max(0, num(s.rep) | 0);
  s.talents = Object.assign({ geduld: 0, kracht: 0, gevoel: 0, geluk: 0, handelaar: 0, zuinig: 0 }, s.talents || {});
  for (const k of Object.keys(s.talents)) if (!(k in TALENTS)) delete s.talents[k]; else s.talents[k] = clamp(s.talents[k] | 0, 0, S.TALENT_MAX);
  s.lvl = levelInfo(s.xp).level;
  if (spent(s.talents) > s.lvl - 1) resetTalents(s);
  s.rods = Object.assign({ owned: [0], active: 0, dur: {} }, s.rods || {});
  if (!Array.isArray(s.rods.owned) || !s.rods.owned.includes(0)) s.rods.owned = [0, ...(s.rods.owned || [])];
  if (!s.rods.owned.includes(s.rods.active)) s.rods.active = 0;
  s.upg = Object.assign({ reel: 0, line: 0, float: 0, sonar: 0 }, s.upg || {});
  for (const k of Object.keys(UPGRADES)) s.upg[k] = clamp(s.upg[k] | 0, 0, UPGRADES[k].max);
  if (!s.baits || typeof s.baits !== 'object') s.baits = { worm: 20, made: 6, brood: 6 };
  for (const b of BAITS) s.baits[b.id] = clamp(s.baits[b.id] | 0, 0, 99);
  if (!BAIT[s.bait] || false) s.bait = 'worm';
  if (!Array.isArray(s.inv)) s.inv = [];
  s.nextId = Math.max(1, s.nextId | 0, ...s.inv.map(f => f.id + 1));
  if (!s.book || typeof s.book !== 'object') s.book = {};
  s.mounts = Object.assign({ bike: false, scooter: false, boat: false }, s.mounts || {});
  if (s.dog && typeof s.dog.name !== 'string') s.dog = null;
  if (String(u.name).toLowerCase() === 'toon') s.dog = { name: 'Iron Dog' };      // speler Toon heeft altijd een Ironman-hond
  s.stats = Object.assign({ catches: 0, released: 0, sold: 0, best: 0, bestSp: '', totalKg: 0, rareCatches: 0, epicCatches: 0, legCatches: 0, nightCatches: 0, stormCatches: 0, contestWins: 0, cooked: 0, pond: {} }, s.stats || {});
  if (!s.stats.pond || typeof s.stats.pond !== 'object') s.stats.pond = {};
  s.unlocked = Array.isArray(s.unlocked) ? [...new Set(s.unlocked.filter(i => PONDS[i]?.req))] : [];
  s.disc = Array.isArray(s.disc) ? [...new Set(s.disc.filter(i => PONDS[i]?.secret))] : [];
  if (!s.ach || typeof s.ach !== 'object') s.ach = {};
  if (!s.buffs || typeof s.buffs !== 'object') s.buffs = {};
  s.trophies = Math.max(0, s.trophies | 0);
  if (!Number.isInteger(s.look) || s.look < 0 || s.look > 3) { let h = 0; for (const ch of String(u.name)) h = (h * 31 + ch.charCodeAt(0)) >>> 0; s.look = h % 4; }
  if (!Number.isInteger(s.house)) s.house = -1;
  ensureDaily(u);
  return s;
}

/* ------------------------------------------------------------------ huizen */
export const hooks = { houses: () => [] };         // server.js vult dit met alle huizen van alle accounts
export function houseInfo(save, name) {
  const sp = Object.entries(save.book || {}).filter(([id]) => SP[id]).sort((a, b) => SP[b[0]].rar - SP[a[0]].rar || a[0].localeCompare(b[0])).map(([id, b]) => [id, b.n, b.best]);
  return { s: save.house, n: name, d: save.dog?.name || '', sp };
}

/* ------------------------------------------------------------------ kans dat een vis hapt */
export function appeal(sp, bait, tc, weather) {
  let a;
  if (sp.likes.includes(bait)) a = sp.likes[0] === bait ? 1 : 0.85;
  else if (sp.leg) return 0;
  else a = ['worm', 'made', 'brood'].includes(bait) ? 0.12 : 0.04;
  const t = sp.t;
  a *= t === 'any' ? 1 : t === 'dag' ? (tc === 'dag' ? 1 : tc === 'sch' ? 0.6 : 0.2) : t === 'nacht' ? (tc === 'nacht' ? 1 : tc === 'sch' ? 0.5 : 0.2) : (tc === 'sch' ? 1.5 : 0.6);
  if (bait === 'glow' && tc !== 'dag') a *= 1.4;
  if (weather === 'rain' && ['worm', 'made'].includes(bait)) a *= 1.15;
  if (weather === 'clear' && ['vlieg', 'spinner'].includes(bait) && tc === 'dag') a *= 1.1;
  if (weather === 'storm' && ['levend', 'glow'].includes(bait)) a *= 1.2;
  a *= weather === 'rain' ? 1.25 : weather === 'storm' ? 1.1 : weather === 'fog' ? 0.9 : 1;
  return a;
}
const legendOk = (sp, tc, weather) => sp.cond === 'storm' ? weather === 'storm' : sp.cond === 'dag' ? tc === 'dag' : sp.cond === 'sch' ? tc === 'sch' : tc === 'nacht';

/* ------------------------------------------------------------------ kamer */
export class Room {
  constructor(id, name, max, permanent, markDirty) {
    this.id = id; this.name = name; this.max = max; this.permanent = permanent; this.markDirty = markDirty;
    this.players = new Map(); this.nextPid = 1; this.emptySince = Date.now();
    this.reset();
  }
  reset() {
    this.t = 0; this.tick = 0; this.nextFid = 1;
    this.weather = 'clear'; this.weatherUntil = rnd(60, 150);
    this.fish = PONDS.map(() => []); this.legCd = {};
    this.heron = PONDS.map(p => ({ ang: p.entry + 2.4 + rnd(-0.6, 0.6), until: rnd(30, CFG.heronRelocate) }));
    this.merchant = null; this.merchantAt = rnd(120, 300);
    this.contest = null; this.contestCdUntil = 0; this.autoSlot = -1;
    this.offers = new Map(); this.nextOffer = 1; this.legT = 0;
    for (const p of PONDS) while (this.fish[p.id].length < p.fish) this.spawnFish(p, null);
    this.emptySince = Date.now();
  }
  get summary() { return { id: this.id, name: this.name, players: this.players.size, max: this.max, permanent: this.permanent, weather: this.weather, contest: !!this.contest, names: [...this.players.values()].map(p => p.name).slice(0, 8) }; }
  get tc() { return S.timeClass(S.dayPhase()); }

  /* ---------------- spelers */
  addPlayer(conn) {
    const u = conn.user, save = ensureSave(u), now = Date.now();
    const P = { id: this.nextPid++, conn, user: u, save, name: u.name, x: S.SPAWN.x + rnd(-2, 2), z: S.SPAWN.z + rnd(-2, 2), ry: Math.PI, mount: 'walk',
      fs: 0, bx: 0, bz: 0, pond: -1, waitT: 0, rollT: 0, chase: null, biteT: 0, fight: null, pending: null, reel: false, lastPos: now, lastOk: { x: 0, z: 14 }, warnAt: 0,
      dirty: true, dirtyAt: 0, dogT: rnd(60, CFG.dogDigEvery), hintT: 0, tpAt: 0, chatAt: 0 };
    P.lastOk = { x: P.x, z: P.z };
    this.players.set(P.id, P); this.emptySince = null;
    conn.send({ t: 'joined', id: P.id, room: this.summary, now, save: this.safeSave(P), weather: this.weather, merchant: this.merchantInfo(), players: [...this.players.values()].map(q => this.pinfo(q)), contest: this.contestInfo(), weekend: isWeekend(), featured: S.featuredSpecies().id, houses: hooks.houses() });
    this.broadcast({ t: 'pinfo', p: this.pinfo(P) }, P);
    this.feed(`${P.name} is komen vissen.`, 'info', P);
    return P;
  }
  removePlayer(P) {
    this.endFish(P, true);
    this.players.delete(P.id);
    this.broadcast({ t: 'pgone', id: P.id });
    this.markDirty();
    if (!this.players.size) this.emptySince = Date.now();
  }
  pinfo(P) { return { id: P.id, name: P.name, look: P.save.look, rod: P.save.rods.active, dog: P.save.dog?.name || null, lvl: P.save.lvl, mount: P.mount }; }
  safeSave(P) { return P.save; }
  send(P, o) { P.conn.send(o); }
  broadcast(o, except) { const s = JSON.stringify(o); for (const P of this.players.values()) if (P !== except) P.conn.send(s); }
  toast(P, msg, kind = 'info') { this.send(P, { t: 'toast', msg, kind }); }
  feed(msg, kind = 'info', except) { this.broadcast({ t: 'feed', msg, kind }, except); }
  dirty(P) { P.dirty = true; }

  /* ---------------- vissen in de vijver */
  randWater(p) {
    for (let i = 0; i < 60; i++) {
      const a = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random()) * p.r * 1.1, x = p.x + Math.cos(a) * d, z = p.z + Math.sin(a) * d;
      if (S.pondWater(x, z) === p.id) return { x, z };
    }
    return { x: p.x, z: p.z };
  }
  weightFor(sp) { return r2(sp.w[0] + (sp.w[1] - sp.w[0]) * Math.pow(Math.random(), sp.leg ? 1.2 : 2.2)); }
  spawnFish(p, sp) {
    if (!sp) {
      const list = SPECIES.filter(s => s.pond === p.id && !s.leg); let tot = 0; for (const s of list) tot += RARITY[s.rar].w;
      let r = Math.random() * tot; sp = list[0]; for (const s of list) { r -= RARITY[s.rar].w; if (r <= 0) { sp = s; break; } }
    }
    const pos = this.randWater(p), w = this.weightFor(sp);
    const f = { id: this.nextFid++, sp, x: pos.x, z: pos.z, h: Math.random() * 6.28, spd: rnd(0.5, 1.1), w, busy: 0, state: 'wander', scared: 0, tTurn: rnd(1, 4), pond: p.id };
    f.str = sp.str * (0.85 + 0.3 * (sp.w[1] > sp.w[0] ? (w - sp.w[0]) / (sp.w[1] - sp.w[0]) : 0.5));
    this.fish[p.id].push(f); return f;
  }
  updateFish(dt) {
    const tc = this.tc;
    for (const p of PONDS) {
      const list = this.fish[p.id];
      for (let i = list.length - 1; i >= 0; i--) {
        const f = list[i];
        if (f.busy) {
          const P = this.players.get(f.busy);
          if (!P) { f.busy = 0; f.state = 'wander'; }
          else if (f.state === 'chase') { const dx = P.bx - f.x, dz = P.bz - f.z, d = Math.hypot(dx, dz); f.h = Math.atan2(dz, dx); const s = Math.min(d, 3 * dt); f.x += Math.cos(f.h) * s; f.z += Math.sin(f.h) * s; }
          else { f.x += (P.bx - f.x) * Math.min(1, 6 * dt); f.z += (P.bz - f.z) * Math.min(1, 6 * dt); }
          continue;
        }
        if (f.scared > 0) f.scared -= dt;
        f.tTurn -= dt;
        if (f.tTurn <= 0) { f.h += rnd(-1.2, 1.2); f.spd = rnd(0.4, 1.2); f.tTurn = rnd(1.5, 5); }
        const nx = f.x + Math.cos(f.h) * f.spd * dt, nz = f.z + Math.sin(f.h) * f.spd * dt;
        if (S.pondWater(nx, nz) === p.id && !S.onJetty(nx, nz)) { f.x = nx; f.z = nz; }
        else { f.h = Math.atan2(p.z - f.z, p.x - f.x) + rnd(-0.8, 0.8); f.tTurn = rnd(1, 3); }
      }
    }
  }
  maintainFish(dt) {
    this.legT -= dt; if (this.legT > 0) return; this.legT = 4;
    const tc = this.tc, now = Date.now();
    for (const p of PONDS) {
      const list = this.fish[p.id];
      let normal = 0; for (const f of list) if (!f.sp.leg) normal++;
      while (normal < p.fish) { this.spawnFish(p, null); normal++; }
      for (const sp of SPECIES) {
        if (!sp.leg || sp.pond !== p.id) continue;
        const idx = list.findIndex(f => f.sp === sp), ok = legendOk(sp, tc, this.weather) && now > (this.legCd[sp.id] || 0);
        if (ok && idx < 0) { const f = this.spawnFish(p, sp); f.spd = 0.5; }
        else if (!ok && idx >= 0 && !list[idx].busy) list.splice(idx, 1);
      }
    }
  }

  /* ---------------- hengelen */
  baitCount(P) { return P.save.baits[P.save.bait] | 0; }
  endFish(P, silent) {
    if (P.chase) { const f = this.findFish(P.chase); if (f && f.busy === P.id) { f.busy = 0; f.state = 'wander'; f.scared = 30; } }
    if (P.pending) this.keepFish(P, P.pending.id, true);
    P.fs = 0; P.chase = null; P.fight = null; P.reel = false;
  }
  findFish(id) { for (const l of this.fish) for (const f of l) if (f.id === id) return f; return null; }
  removeFish(f) { const l = this.fish[f.pond]; const i = l.indexOf(f); if (i >= 0) l.splice(i, 1); }
  cast(P, m) {
    if (P.fs) return;
    if (P.mount === 'bike' || P.mount === 'scooter') return this.toast(P, 'Stap eerst van je voertuig af om te vissen.', 'warn');
    const rs = S.rodStats(P.save);
    if (rs.broken) return this.toast(P, 'Je hengel is kapot. Laat hem repareren bij Hengelsmid Marga.', 'warn');
    if (this.baitCount(P) <= 0) return this.toast(P, `Je hebt geen ${BAIT[P.save.bait].name.toLowerCase()} meer. Kies ander aas of koop nieuw.`, 'warn');
    const x = +m.x, z = +m.z; if (!Number.isFinite(x) || !Number.isFinite(z)) return;
    const d = Math.hypot(x - P.x, z - P.z);
    if (d > rs.cast + 3 || d < 1.5) return this.toast(P, d < 1.5 ? 'Te dichtbij.' : 'Te ver weg voor deze hengel.', 'warn');
    const pond = S.pondWater(x, z);
    if (pond < 0) return this.toast(P, 'Richt op het water.', 'warn');
    if (this.pondLocked(P, pond)) return;
    if (P.pending) this.keepFish(P, P.pending.id, true);
    P.fs = 1; P.bx = x; P.bz = z; P.pond = pond; P.waitT = 0; P.rollT = 0.5; P.chase = null; P.hintT = 0;
    this.broadcast({ t: 'ev', k: 'splash', x: r1(x), z: r1(z), id: P.id, big: 0 });
  }
  pondLocked(P, pond) { const p = PONDS[pond]; return !!(p.req && !P.save.unlocked.includes(pond)); }
  hook(P) {
    if (P.fs === 2) {
      const f = this.findFish(P.chase); if (!f) { P.fs = 0; return; }
      const rs = S.rodStats(P.save);
      P.fs = 3; P.reel = false;
      P.fight = { fid: f.id, T: 28, D: 26 + f.str * 13 + rnd(0, 8), phase: 'rest', pt: rnd(1.2, 2.2), stam: 100, snap: 0, rs, send: 0 };
      f.state = 'fight';
      this.broadcast({ t: 'ev', k: 'splash', x: r1(P.bx), z: r1(P.bz), id: P.id, big: 1 });
    } else if (P.fs === 1) {
      this.toast(P, 'Te vroeg! Wacht tot de dobber onder gaat.', 'warn');
      this.endFish(P);
    }
  }
  cancel(P) { if (P.fs === 3) { this.loseFish(P, 'Je hebt de lijn laten schieten.'); } else if (P.fs) this.endFish(P); }
  loseFish(P, msg, snap) {
    const F = P.fight, f = F && this.findFish(F.fid);
    if (f) { f.busy = 0; f.state = 'wander'; f.scared = 40; }
    if (snap) { const rod = P.save.rods.active; P.save.rods.dur[rod] = Math.max(0, (P.save.rods.dur[rod] ?? 100) - 12); this.dirty(P); }
    P.fs = 0; P.fight = null; P.chase = null; P.reel = false;
    this.send(P, { t: 'lost', msg, snap: !!snap });
  }
  updateFishing(P, dt) {
    if (!P.fs) return;
    const rs = S.rodStats(P.save);
    if (Math.hypot(P.x - P.bx, P.z - P.bz) > rs.cast + 6) { this.toast(P, 'Je lijn is te ver gespannen. Dobber binnengehaald.', 'warn'); return P.fs === 3 ? this.loseFish(P, 'De lijn knapte doordat je te ver wegliep.', true) : this.endFish(P); }
    if (P.fs === 1) {
      P.waitT += dt; P.rollT -= dt; P.hintT += dt;
      const cands = this.fish[P.pond];
      if (P.chase) {
        const f = this.findFish(P.chase);
        if (!f || f.busy !== P.id) { P.chase = null; }
        else if (Math.hypot(f.x - P.bx, f.z - P.bz) < 0.9) {
          // aas opmaken (Zuinig kan helpen)
          if (Math.random() >= P.save.talents.zuinig * 0.08) P.save.baits[P.save.bait]--;
          f.state = 'bite'; P.fs = 2; P.biteT = rs.window; this.dirty(P);
          this.broadcast({ t: 'ev', k: 'splash', x: r1(P.bx), z: r1(P.bz), id: P.id, big: 0 });
          return;
        }
      } else if (P.rollT <= 0) {
        P.rollT = 1;
        const tc = this.tc, bait = P.save.bait;
        for (const f of cands) {
          if (f.busy || f.scared > 0) continue;
          const d = Math.hypot(f.x - P.bx, f.z - P.bz); if (d > (f.sp.leg ? 30 : 18)) continue;
          const a = appeal(f.sp, bait, tc, this.weather); if (a <= 0) continue;
          const prob = clamp(a * 0.75 * rs.bite * (1 + rs.luck * 0.07 * f.sp.rar) * (f.sp.id === S.featuredSpecies().id ? S.FEATURED_BITE : 1), 0, 0.9);
          if (Math.random() < prob) { f.busy = P.id; f.state = 'chase'; P.chase = f.id; break; }
        }
      }
      if (P.hintT > 40 && !P.chase) { P.hintT = -1e9; this.toast(P, 'Het blijft stil... Probeer ander aas, een andere plek of een ander moment van de dag.', 'info'); }
    } else if (P.fs === 2) {
      P.biteT -= dt;
      if (P.biteT <= 0) {
        const f = this.findFish(P.chase); if (f) { f.busy = 0; f.state = 'wander'; f.scared = 40; }
        P.fs = 0; P.chase = null; this.send(P, { t: 'lost', msg: 'Te laat! De vis nam het aas mee.' });
      }
    } else if (P.fs === 3) this.updateFight(P, dt);
  }
  updateFight(P, dt) {
    const F = P.fight, f = this.findFish(F.fid);
    if (!f) return this.loseFish(P, 'De vis is weg.');
    const rs = F.rs = S.rodStats(P.save), sf = F.stam / 100;
    const pullF = f.str * 20 * (60 / rs.line);
    F.pt -= dt;
    if (F.pt <= 0) {
      if (F.phase === 'rest') { F.phase = 'warn'; F.pt = 0.5; }
      else if (F.phase === 'warn') { F.phase = 'run'; F.pt = (1 + Math.random() * 1.2) * (0.5 + 0.5 * sf); }
      else { F.phase = 'rest'; F.pt = (1.2 + Math.random() * 1.6) * (1.1 - Math.min(0.4, f.str * 0.1)); }
    }
    const reeling = P.reel;
    let target;
    if (F.phase === 'run') target = reeling ? 80 + pullF * (0.6 + 0.4 * sf) : 38 + pullF * 0.25 * sf;
    else if (F.phase === 'warn') target = reeling ? 62 : 12;
    else target = reeling ? 52 + pullF * 0.15 : 8;
    F.T += (target - F.T) * (1 - Math.exp(-4 * dt));
    if (F.phase === 'run') {
      F.D += (reeling ? 1.5 : 4 + pullF * 0.2 * (0.5 + 0.5 * sf)) * dt;
      F.stam = Math.max(10, F.stam - 9 * (f.str / 3 + 0.6) * dt);
    } else {
      if (reeling) F.D -= 9 * rs.reel * (1 + (1 - sf) * 0.7) * dt;
      F.stam = Math.min(100, F.stam + 1.5 * dt);
    }
    if (F.T >= 100) { F.snap += dt; } else F.snap = Math.max(0, F.snap - dt * 0.8);
    if (F.snap > 0.55) { return this.loseFish(P, 'De lijn knapte! Laat de lijn vieren als de vis trekt.', true); }
    if (F.D >= 100) return this.loseFish(P, 'De vis rukte zich los en is weg.');
    if (F.D <= 0) return this.landFish(P, f);
    F.send -= dt;
    if (F.send <= 0) { F.send = 0.1; this.send(P, { t: 'fight', T: r1(F.T), D: r1(F.D), ph: F.phase, st: Math.round(F.stam), fid: f.sp.i, w: f.w }); }
  }
  landFish(P, f) {
    const sp = f.sp, s = P.save, tc = this.tc;
    this.removeFish(f);
    if (sp.leg) this.legCd[sp.id] = Date.now() + CFG.legendRespawn * 1000;
    P.fs = 0; P.fight = null; P.chase = null; P.reel = false;
    const fish = { sp: sp.id, w: f.w, pond: sp.pond, t: Date.now() }; P.lastCatch = { sp: sp.id, w: f.w };
    const rec = !s.book[sp.id] || s.book[sp.id].best < f.w, newSp = !s.book[sp.id];
    const B = s.book[sp.id] || (s.book[sp.id] = { n: 0, best: 0, first: Date.now() });
    B.n++; if (f.w > B.best) B.best = f.w;
    const st = s.stats; st.catches++; st.totalKg = r2(st.totalKg + f.w);
    if (f.w > st.best) { st.best = f.w; st.bestSp = sp.id; }
    if (sp.rar === 2) st.rareCatches++; if (sp.rar >= 3) { st.rareCatches++; st.epicCatches++; } if (sp.leg) st.legCatches++;
    if (tc === 'nacht') st.nightCatches++; if (this.weather === 'storm') st.stormCatches++;
    if (newSp && s.house >= 0) this.broadcast({ t: 'house', h: houseInfo(s, P.name) });
    const ps = st.pond[sp.pond] || (st.pond[sp.pond] = { n: 0, sp: {} }); ps.n++; ps.sp[sp.id] = 1;
    // beloning
    const xp = Math.round((12 + Math.min(60, f.w * 3)) * (0.8 + 0.45 * sp.rar) * (sp.leg ? 3 : 1));
    this.addXp(P, xp);
    this.quest(P, 'catch', 1); this.quest(P, 'heavy', 1, { w: f.w }); this.quest(P, 'species', 1, { sp: sp.id });
    if (tc === 'nacht') this.quest(P, 'night', 1); if (sp.rar >= 2) this.quest(P, 'rare', 1);
    if (this.contest) { const b = this.contest.best[P.id]; if (!b || f.w > b.w) this.contest.best[P.id] = { w: f.w, sp: sp.id, name: P.name }; }
    // reiger?
    let heronAt = false;
    if (!s.dog) { const h = this.heronPos(sp.pond); if (h && Math.hypot(h.x - P.x, h.z - P.z) < 38) heronAt = true; }
    P.pending = { fish, id: s.nextId++, at: Date.now(), heron: heronAt, xp };
    this.send(P, { t: 'catch', fish, fid: P.pending.id, xp, rec, heron: heronAt, rarity: sp.rar, ms: heronAt ? 4000 : 9000 });
    this.broadcast({ t: 'ev', k: 'splash', x: r1(P.bx), z: r1(P.bz), id: P.id, big: 1 });
    if (sp.rar >= 3 || f.w >= 10) this.feed(`${P.name} ving ${sp.leg ? 'de legendarische ' : 'een '}${sp.name} van ${S.fmtKg(f.w)}!`, sp.leg ? 'legend' : 'rare', P);
    this.checkUnlocks(P); this.checkAch(P); this.dirty(P);
  }
  resolvePending(P, auto) {
    const pd = P.pending; if (!pd) return null; P.pending = null; return pd;
  }
  keepFish(P, fid, keep) {
    const pd = P.pending; if (!pd || pd.id !== fid) return;
    const s = P.save, sp = SP[pd.fish.sp]; P.pending = null;
    if (pd.stolen) return;
    if (keep && s.inv.length >= S.INV_MAX) { this.toast(P, 'Je visnet is vol! Verkoop vis bij een kiosk of winkel. Deze vis is teruggezet.', 'warn'); keep = false; }
    if (keep) { s.inv.push({ id: pd.id, sp: pd.fish.sp, w: pd.fish.w, pond: pd.fish.pond, t: pd.fish.t }); this.toast(P, `${sp.name} (${S.fmtKg(pd.fish.w)}) zit in je visnet.`, 'good'); }
    else {
      s.stats.released++; const rp = 1 + sp.rar * 2 + (sp.leg ? 10 : 0); s.rep += rp; this.addXp(P, Math.round(pd.xp * 0.4));
      this.quest(P, 'release', 1); this.toast(P, `${sp.name} teruggezet. +${rp} reputatie.`, 'good'); this.checkAch(P);
    }
    this.dirty(P);
  }
  heronPos(pond) { const h = this.heron[pond]; if (!h) return null; return S.shorePoint(PONDS[pond], h.ang, 1.2); }
  updateHerons(dt) {
    for (const p of PONDS) {
      const h = this.heron[p.id]; h.until -= dt;
      if (h.until <= 0) { h.ang = Math.random() * Math.PI * 2; h.until = rnd(60, CFG.heronRelocate); }
    }
  }
  updatePending(P) {
    const pd = P.pending; if (!pd) return;
    const age = Date.now() - pd.at;
    if (pd.heron && age > 4000) {
      pd.stolen = true; P.pending = null;
      this.send(P, { t: 'stolen' }); this.toast(P, `Een reiger griste je ${SP[pd.fish.sp].name} weg! Een hond zou hem hebben verjaagd.`, 'bad');
      this.broadcast({ t: 'ev', k: 'heron', pond: pd.fish.pond, id: P.id }); return;
    }
    if (age > 9000) this.keepFish(P, pd.id, true);
  }
  addXp(P, n) {
    const s = P.save, before = s.lvl; s.xp += n; s.lvl = levelInfo(s.xp).level;
    if (s.lvl > before) { this.send(P, { t: 'levelup', lvl: s.lvl }); this.feed(`${P.name} is nu niveau ${s.lvl}!`, 'info', P); this.checkAch(P); }
    this.dirty(P);
  }
  checkUnlocks(P) {
    const s = P.save;
    for (const p of PONDS) {
      if (!p.req || s.unlocked.includes(p.id)) continue;
      const ps = s.stats.pond[p.req.from]; if (!ps) continue;
      if (ps.n >= p.req.catches && Object.keys(ps.sp).length >= p.req.species) {
        s.unlocked.push(p.id); this.send(P, { t: 'unlocked', pond: p.id });
        this.feed(`${P.name} ontgrendelde de ${p.name}!`, 'rare', P); this.checkAch(P); this.dirty(P);
      }
    }
  }
  checkAch(P) {
    const s = P.save;
    for (const a of ACHIEVEMENTS) if (!s.ach[a.id] && a.test(s)) { s.ach[a.id] = Date.now(); this.send(P, { t: 'ach', id: a.id }); this.feed(`${P.name} behaalde "${a.name}"`, 'info', P); this.dirty(P); }
  }
  quest(P, kind, n, ex = {}) {
    for (const q of P.save.daily.q) {
      if (q.done || q.kind !== kind) continue;
      if (kind === 'heavy') { if (ex.w >= q.n) q.p = q.n; else continue; }
      else if (kind === 'species') { if (ex.sp === q.sp) q.p += n; else continue; }
      else q.p += n;
      if (q.p >= q.n) { q.p = q.n; q.done = true; P.save.coins += q.coins; this.toast(P, `Opdracht klaar: ${QUEST_KINDS[q.kind].text(q.n, q.sp)}! +${q.coins} munten`, 'good'); this.addXp(P, q.xp); }
      this.dirty(P);
    }
  }

  /* ---------------- berichten van spelers */
  handle(P, m) {
    switch (m.t) {
      case 'pos': return this.onPos(P, m);
      case 'cast': return this.cast(P, m);
      case 'hook': return this.hook(P);
      case 'reel': P.reel = !!m.on; return;
      case 'cancel': return this.cancel(P);
      case 'keep': return this.keepFish(P, m.fid | 0, true);
      case 'release': return this.keepFish(P, m.fid | 0, false);
      case 'bait': if (BAIT[m.id]) { P.save.bait = m.id; this.dirty(P); } return;
      case 'equip': { const r = m.rod | 0; if (P.save.rods.owned.includes(r) && !P.fs) { P.save.rods.active = r; this.dirty(P); this.broadcast({ t: 'pinfo', p: this.pinfo(P) }); } return; }
      case 'buy': return this.buy(P, m);
      case 'sell': return this.sell(P, m);
      case 'cook': return this.cook(P, m);
      case 'mount': return this.setMount(P, String(m.m));
      case 'say': return this.say(P, m);
      case 'home': { const h = S.HOUSE_SLOTS[P.save.house]; if (!h) return this.toast(P, 'Je hebt nog geen huis.', 'warn'); if (P.fs || P.mount !== 'walk') return this.toast(P, 'Haal eerst je lijn binnen en stap af.', 'warn'); if (P.fight) return; return this.tp(P, h.x, h.z - S.HOUSE_D / 2 - 2.2, 'Je staat voor je huis.'); }
      case 'emote': { const e = ['wave', 'laugh', 'thumb', 'fish'].indexOf(m.k); if (e < 0 || Date.now() - (P.emoteAt || 0) < 1500) return; P.emoteAt = Date.now(); const lc = m.k === 'fish' ? P.lastCatch : null; this.broadcast({ t: 'emote', id: P.id, k: m.k, sp: lc ? lc.sp : '', w: lc ? lc.w : 0 }); return; }
      case 'offer': return this.offer(P, m);
      case 'offerReply': return this.offerReply(P, m);
      case 'contest': return this.startContest(P);
      case 'look': { const l = m.v | 0; if (l >= 0 && l <= 3) { P.save.look = l; this.dirty(P); this.broadcast({ t: 'pinfo', p: this.pinfo(P) }); } return; }
      case 'talent': { if (applyTalent(P.save, String(m.id))) this.dirty(P); return; }
      case 'retalent': resetTalents(P.save); this.dirty(P); return;
      case 'dev': return this.dev(P, m);
    }
  }
  dev(P, m) {   // alleen voor testen: ALLOW_CHEATS=1
    if (process.env.ALLOW_CHEATS !== '1') return;
    const s = P.save;
    if (m.unlock) { s.unlocked = S.ZONE_PONDS.map(p => p.id); s.disc = [6, 7]; }
    if (m.coins) s.coins += m.coins | 0;
    if (m.xp) this.addXp(P, m.xp | 0);
    if (m.book) { for (const sp of S.SPECIES.slice(0, m.book | 0)) s.book[sp.id] = s.book[sp.id] || { n: 2, best: sp.w[1] * 0.6, first: Date.now() }; s.dog = s.dog || { name: 'Bobbel' }; this.broadcast({ t: 'house', h: houseInfo(s, P.name) }); this.dirty(P); }
    if (m.give) { for (const b of BAITS) s.baits[b.id] = 60; s.mounts = { bike: true, scooter: true, boat: true }; s.dog = s.dog || { name: 'Bobbel' }; s.rods.owned = RODS.map(r => r.id); this.broadcast({ t: 'pinfo', p: this.pinfo(P) }); }
    if (m.rod != null) { s.rods.active = m.rod | 0; this.broadcast({ t: 'pinfo', p: this.pinfo(P) }); }
    if (m.weather) { this.weather = m.weather; this.weatherUntil = 9999; this.broadcast({ t: 'wx', w: this.weather }); }
    if (m.tp) { P.mount = m.boat ? 'boat' : 'walk'; this.tp(P, +m.tp[0], +m.tp[1], null); this.send(P, { t: 'mount', m: P.mount }); this.broadcast({ t: 'pinfo', p: this.pinfo(P) }); }
    if (m.upg) for (const k of Object.keys(UPGRADES)) s.upg[k] = UPGRADES[k].max;
    if (m.contest) { this.contestCdUntil = 0; this.startContest(P); }
    this.dirty(P);
  }
  onPos(P, m) {
    const x = +m.x, z = +m.z, ry = +m.ry; if (!Number.isFinite(x) || !Number.isFinite(z)) return;
    const now = Date.now(), dt = Math.min(1, (now - P.lastPos) / 1000); P.lastPos = now;
    const base = P.mount === 'bike' ? 11 : P.mount === 'scooter' ? 16 : P.mount === 'boat' ? 7 : 9;
    const maxMove = base * CFG.maxSpeedMul * Math.max(dt, 0.05) + 3, moved = Math.hypot(x - P.x, z - P.z);
    const bad = moved > maxMove || x < S.WORLD.minX || x > S.WORLD.maxX || z < S.WORLD.minZ || z > S.WORLD.maxZ || !S.walkable(x, z, P.mount === 'boat');
    if (bad) { return this.tp(P, P.lastOk.x, P.lastOk.z, null); }
    // gesloten gebieden
    for (const p of S.ZONE_PONDS) {
      if (P.save.unlocked.includes(p.id)) continue;
      const dx = x - p.x, dz = z - p.z, d = Math.hypot(dx, dz);
      if (d < p.zr) {
        const nx = p.x + dx / d * (p.zr + 1.5), nz = p.z + dz / d * (p.zr + 1.5);
        const need = `${PONDS[p.req.from].name}: vang ${p.req.catches} vissen (minstens ${p.req.species} soorten)`;
        return this.tp(P, nx, nz, `Het hek naar de ${p.name} is dicht. ${need}.`);
      }
    }
    P.x = x; P.z = z; if (Number.isFinite(ry)) P.ry = ry; P.lastOk = { x, z };
    // verborgen vijvers ontdekken
    for (const p of PONDS) if (p.secret && !P.save.disc.includes(p.id) && Math.hypot(x - p.x, z - p.z) < 45) {
      P.save.disc.push(p.id); this.send(P, { t: 'discover', pond: p.id }); this.addXp(P, 120); this.checkAch(P); this.dirty(P);
      this.feed(`${P.name} ontdekte de ${p.name}!`, 'rare', P);
    }
  }
  tp(P, x, z, msg) {
    P.x = x; P.z = z; P.lastOk = { x, z }; P.lastPos = Date.now();
    if (Date.now() - P.tpAt > 1500 || !msg) { P.tpAt = Date.now(); this.send(P, { t: 'tp', x: r1(x), z: r1(z), msg }); }
    if (P.fs) this.endFish(P);
  }
  setMount(P, m) {
    const s = P.save;
    if (P.fs) return this.toast(P, 'Haal eerst je lijn binnen.', 'warn');
    if (m === 'walk') {
      if (P.mount === 'boat') {
        const pt = S.findNear(P.x, P.z, (a, b) => S.walkable(a, b, false), 16);
        if (!pt) return this.toast(P, 'Geen oever in de buurt. Roei dichter naar de kant.', 'warn');
        P.x = pt.x; P.z = pt.z; P.lastOk = { x: pt.x, z: pt.z }; this.send(P, { t: 'tp', x: r1(pt.x), z: r1(pt.z) });
      }
      P.mount = 'walk';
    } else if (m === 'bike' || m === 'scooter') {
      if (!s.mounts[m]) return this.toast(P, 'Je hebt dit voertuig niet.', 'warn');
      if (P.mount === 'boat') return this.toast(P, 'Stap eerst uit de boot.', 'warn');
      P.mount = m;
    } else if (m === 'boat') {
      if (!s.mounts.boat) return this.toast(P, 'Je hebt geen roeiboot. Koop er een in de winkel.', 'warn');
      if (P.mount === 'boat') return;
      const pt = S.findNear(P.x, P.z, (a, b) => S.walkable(a, b, true), 9);
      if (!pt) return this.toast(P, 'Ga bij de waterkant staan om in te stappen.', 'warn');
      P.mount = 'boat'; P.x = pt.x; P.z = pt.z; P.lastOk = { x: pt.x, z: pt.z }; this.send(P, { t: 'tp', x: r1(pt.x), z: r1(pt.z) });
    } else return;
    this.broadcast({ t: 'pinfo', p: this.pinfo(P) });
    this.send(P, { t: 'mount', m: P.mount });
  }
  nearShop(P, types) {
    for (const sh of S.SHOPS) if (types.includes(sh.type) && Math.hypot(sh.x - P.x, sh.z - P.z) <= S.SHOP_RANGE + 2) return sh;
    return null;
  }
  discount(P) { return 1 - Math.min(0.2, Math.floor(P.save.rep / 50) * 0.02); }
  buy(P, m) {
    const s = P.save, [kind, id] = String(m.item).split(':'), disc = this.discount(P);
    const pay = c => { if (s.coins < c) { this.toast(P, 'Te weinig munten.', 'warn'); return false; } s.coins -= c; return true; };
    if (kind === 'bait') {
      if (!this.nearShop(P, ['main', 'kiosk'])) return this.toast(P, 'Ga naar een winkel of kiosk.', 'warn');
      const b = BAIT[id]; if (!b) return; const packs = clamp(m.qty | 0 || 1, 1, 9);
      if ((s.baits[id] | 0) + packs * S.BAIT_PACK > 99) return this.toast(P, 'Zoveel aas kun je niet dragen (max. 99).', 'warn');
      if (!pay(Math.round(b.price * packs * disc))) return; s.baits[id] += packs * S.BAIT_PACK; this.toast(P, `${packs * S.BAIT_PACK}x ${b.name} gekocht.`, 'good');
    } else if (kind === 'rod') {
      if (!this.nearShop(P, ['main'])) return this.toast(P, 'Hengels koop je bij de Hengelwinkel in het dorp.', 'warn');
      const r = RODS[id | 0]; if (!r || s.rods.owned.includes(r.id)) return;
      if (!pay(Math.round(r.price * disc))) return; s.rods.owned.push(r.id); s.rods.active = r.id; s.rods.dur[r.id] = 100;
      this.toast(P, `${r.name} gekocht!`, 'good'); this.broadcast({ t: 'pinfo', p: this.pinfo(P) });
    } else if (kind === 'mount') {
      if (!this.nearShop(P, ['main'])) return this.toast(P, 'Voertuigen koop je bij de Hengelwinkel in het dorp.', 'warn');
      const mt = MOUNTS[id]; if (!mt || s.mounts[id]) return; if (!pay(Math.round(mt.price * disc))) return; s.mounts[id] = true; this.toast(P, `${mt.name} gekocht!`, 'good');
    } else if (kind === 'dog') {
      if (!this.nearShop(P, ['main'])) return this.toast(P, 'Een hond adopteer je bij de Hengelwinkel.', 'warn');
      if (s.dog) return; if (!pay(Math.round(S.DOG_PRICE * disc))) return; s.dog = { name: pick(DOG_NAMES) }; if (s.house >= 0) this.broadcast({ t: 'house', h: houseInfo(s, P.name) }); this.toast(P, `Je hebt ${s.dog.name} geadopteerd! Hij graaft wormen op en jaagt reigers weg.`, 'good'); this.broadcast({ t: 'pinfo', p: this.pinfo(P) });
    } else if (kind === 'upg') {
      if (!this.nearShop(P, ['smith'])) return this.toast(P, 'Upgrades doet Hengelsmid Marga.', 'warn');
      const U = UPGRADES[id]; if (!U || s.upg[id] >= U.max) return; const c = Math.round(S.upgradeCost(id, s.upg[id]) * disc);
      if (!pay(c)) return; s.upg[id]++; this.toast(P, `${U.name} verbeterd naar niveau ${s.upg[id]}.`, 'good');
    } else if (kind === 'repair') {
      if (!this.nearShop(P, ['smith'])) return this.toast(P, 'Repareren doet Hengelsmid Marga.', 'warn');
      const dur = s.rods.dur[s.rods.active] ?? 100; if (dur >= 100) return;
      const c = Math.round((100 - dur) * (1 + s.rods.active) * 1.2 * disc); if (!pay(c)) return; s.rods.dur[s.rods.active] = 100; this.toast(P, 'Hengel gerepareerd.', 'good');
    } else if (kind === 'travel') {
      const mer = this.merchant; if (!mer || Math.hypot(mer.x - P.x, mer.z - P.z) > S.SHOP_RANGE + 3) return this.toast(P, 'Ga naar de reizende verkoper.', 'warn');
      const it = mer.items.find(i => i.id === id); if (!it || mer.sold?.[P.id + id]) return;
      if (!pay(it.price)) return;
      if (it.buff) { s.buffs[it.buff] = Math.max(Date.now(), s.buffs[it.buff] || 0) + it.min * 60000; }
      else if (it.bait) s.baits[it.bait] = Math.min(99, (s.baits[it.bait] | 0) + it.qty);
      else if (it.id === 't_kist') {
        const got = []; for (let i = 0; i < 3; i++) { const b = pick(BAITS); s.baits[b.id] = Math.min(99, s.baits[b.id] + 10); got.push(b.name); }
        const c = Math.round(rnd(80, 600)); s.coins += c; this.toast(P, `In de kist: 10x ${got.join(', 10x ')} en ${c} munten!`, 'good');
      }
      (mer.sold || (mer.sold = {}))[P.id + id] = 1; if (!it.id.includes('kist')) this.toast(P, `${it.name} gekocht.`, 'good');
    } else return;
    this.dirty(P);
  }
  sell(P, m) {
    if (!this.nearShop(P, ['main', 'kiosk', 'smith'])) return this.toast(P, 'Verkopen kan bij een winkel of kiosk.', 'warn');
    const s = P.save, ids = m.all ? s.inv.map(f => f.id) : (Array.isArray(m.ids) ? m.ids.map(Number) : []);
    let total = 0, n = 0; const mult = 1 + 0.04 * s.talents.handelaar;
    s.inv = s.inv.filter(f => { if (!ids.includes(f.id)) return true; total += Math.round(S.fishValue(SP[f.sp], f.w) * mult * (f.sp === S.featuredSpecies().id ? S.FEATURED_PRICE : 1)); n++; return false; });
    if (!n) return;
    s.coins += total; s.stats.sold += n; this.quest(P, 'sell', n); this.toast(P, `${n} vis verkocht voor ${total} munten.`, 'good'); this.checkAch(P); this.dirty(P);
  }
  cook(P, m) {
    const fire = S.CAMPFIRES.find(c => Math.hypot(c.x - P.x, c.z - P.z) <= S.SHOP_RANGE); if (!fire) return this.toast(P, 'Ga bij een kampvuur staan.', 'warn');
    const s = P.save, i = s.inv.findIndex(f => f.id === (m.id | 0)); if (i < 0) return;
    const f = s.inv.splice(i, 1)[0], sp = SP[f.sp], keys = Object.keys(BUFFS);
    let h = 0; for (const c of sp.id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    const buff = keys[h % keys.length], mins = 3 + Math.min(7, f.w * 0.8);
    s.buffs[buff] = Math.max(Date.now(), s.buffs[buff] || 0) + mins * 60000; s.stats.cooked++;
    this.addXp(P, 10 + sp.rar * 8); this.quest(P, 'cook', 1);
    this.toast(P, `Je bakt ${sp.name} en eet hem op. ${BUFFS[buff].icon} ${BUFFS[buff].name}-bonus voor ${Math.round(mins)} minuten!`, 'good');
    this.broadcast({ t: 'ev', k: 'eat', id: P.id });
    this.dirty(P);
  }
  say(P, m) {
    const text = String(m.text || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 120); if (!text) return;
    if (Date.now() - P.chatAt < 500) return; P.chatAt = Date.now();
    this.broadcast({ t: 'chat', id: P.id, name: P.name, text });
  }
  offer(P, m) {
    const to = this.players.get(m.to | 0), s = P.save; if (!to || to === P) return;
    const f = s.inv.find(x => x.id === (m.fid | 0)); if (!f) return;
    if (Math.hypot(to.x - P.x, to.z - P.z) > 18) return this.toast(P, 'Die speler staat te ver weg.', 'warn');
    const price = clamp(m.price | 0, 0, 100000), oid = this.nextOffer++;
    this.offers.set(oid, { from: P.id, to: to.id, fid: f.id, price, at: Date.now() });
    this.send(to, { t: 'offer', oid, from: P.name, fish: f, price }); this.toast(P, `Aanbod gestuurd aan ${to.name}.`, 'info');
  }
  offerReply(P, m) {
    const o = this.offers.get(m.oid | 0); if (!o || o.to !== P.id) return; this.offers.delete(m.oid | 0);
    const A = this.players.get(o.from); if (!A) return this.toast(P, 'De verkoper is weg.', 'warn');
    if (!m.ok) return this.toast(A, `${P.name} wil niet.`, 'info');
    const i = A.save.inv.findIndex(f => f.id === o.fid);
    if (i < 0) return this.toast(P, 'Die vis is er niet meer.', 'warn');
    if (P.save.coins < o.price) return this.toast(P, 'Te weinig munten.', 'warn');
    if (P.save.inv.length >= S.INV_MAX) return this.toast(P, 'Je visnet is vol.', 'warn');
    if (Math.hypot(A.x - P.x, A.z - P.z) > 24) return this.toast(P, 'Jullie staan te ver uit elkaar.', 'warn');
    const f = A.save.inv.splice(i, 1)[0]; f.id = P.save.nextId++; P.save.inv.push(f);
    P.save.coins -= o.price; A.save.coins += o.price;
    this.toast(A, `${P.name} kocht je ${SP[f.sp].name}${o.price ? ' voor ' + o.price + ' munten' : ' (cadeau)'}.`, 'good'); this.toast(P, `Je kreeg een ${SP[f.sp].name} (${S.fmtKg(f.w)}).`, 'good');
    this.dirty(A); this.dirty(P);
  }

  /* ---------------- wedstrijd */
  contestInfo() {
    const c = this.contest; if (!c) return null;
    const top = Object.values(c.best).sort((a, b) => b.w - a.w).slice(0, 5).map(b => ({ name: b.name, w: b.w, sp: b.sp }));
    return { left: Math.max(0, Math.round((c.end - Date.now()) / 1000)), top, weekend: c.weekend };
  }
  startContest(P, auto) {
    if (this.contest) return P && this.toast(P, 'Er loopt al een wedstrijd.', 'warn');
    if (!auto && Date.now() < this.contestCdUntil) return this.toast(P, `Wacht nog ${Math.ceil((this.contestCdUntil - Date.now()) / 60000)} minuut voor een nieuwe wedstrijd.`, 'warn');
    const weekend = isWeekend();
    this.contest = { end: Date.now() + S.CONTEST_MS, best: {}, weekend, tick: 0 }; this.contestCdUntil = Date.now() + S.CONTEST_COOLDOWN_MS;
    this.broadcast({ t: 'feed', msg: `🏆 ${auto ? 'Weekend-toernooi' : 'Wedstrijd'} gestart! Vang in 5 minuten de zwaarste vis.${weekend ? ' (Dubbele prijzen!)' : ''}`, kind: 'rare' });
    this.broadcast({ t: 'contest', c: this.contestInfo() });
  }
  endContest() {
    const c = this.contest; this.contest = null;
    const ranks = Object.entries(c.best).sort((a, b) => b[1].w - a[1].w), prizes = [300, 150, 75], mult = c.weekend ? 2 : 1;
    ranks.slice(0, 3).forEach(([pid, b], i) => {
      const P = this.players.get(+pid); if (!P) return;
      P.save.coins += prizes[i] * mult; P.save.rep += (20 - i * 7) * mult;
      if (i === 0) { P.save.stats.contestWins++; if (c.weekend) P.save.trophies++; this.checkAch(P); }
      this.toast(P, `Je werd #${i + 1} in de wedstrijd! +${prizes[i] * mult} munten`, 'good'); this.dirty(P);
    });
    this.broadcast({ t: 'feed', msg: ranks.length ? `🏆 Wedstrijd afgelopen! Winnaar: ${ranks[0][1].name} met ${SP[ranks[0][1].sp].name} van ${S.fmtKg(ranks[0][1].w)}.` : '🏆 Wedstrijd afgelopen. Niemand ving iets!', kind: 'rare' });
    this.broadcast({ t: 'contest', c: null });
  }

  /* ---------------- tijd, weer, handelaar */
  merchantInfo() { const m = this.merchant; return m ? { x: r1(m.x), z: r1(m.z), pond: m.pond, items: m.items, left: Math.round(m.until - this.t) } : null; }
  updateWorld(dt) {
    this.weatherUntil -= dt;
    if (this.weatherUntil <= 0) {
      const r = Math.random(); this.weather = r < 0.5 ? 'clear' : r < 0.75 ? 'rain' : r < 0.9 ? 'fog' : 'storm'; this.weatherUntil = rnd(CFG.weatherMin, CFG.weatherMax);
      this.broadcast({ t: 'wx', w: this.weather });
    }
    if (this.merchant && this.t > this.merchant.until) { this.merchant = null; this.broadcast({ t: 'merchant', m: null }); this.feed('De reizende verkoper is weer vertrokken.', 'info'); }
    if (!this.merchant && this.t > this.merchantAt) {
      const pond = PONDS[Math.floor(Math.random() * 6)], pt = S.shorePoint(pond, pond.entry + 1.9, 9);
      const items = [...S.TRAVEL_ITEMS].sort(() => Math.random() - 0.5).slice(0, 4);
      this.merchant = { x: pt.x, z: pt.z, pond: pond.id, until: this.t + CFG.merchantStay, items };
      this.merchantAt = this.t + CFG.merchantEvery + rnd(0, 120);
      this.broadcast({ t: 'merchant', m: this.merchantInfo() }); this.feed(`🧳 De reizende verkoper staat bij de ${pond.name}! (4 minuten)`, 'rare');
    }
    if (this.contest && Date.now() > this.contest.end) this.endContest();
    if (!this.contest && isWeekend()) {
      const slot = Math.floor(Date.now() / (30 * 60000));
      if (slot !== this.autoSlot) { this.autoSlot = slot; this.startContest(null, true); }
    }
  }

  /* ---------------- hoofdlus */
  update(dt) {
    this.t += dt; this.tick++;
    this.updateWorld(dt); this.updateHerons(dt); this.updateFish(dt); this.maintainFish(dt);
    for (const P of this.players.values()) {
      this.updateFishing(P, dt); this.updatePending(P);
      if (P.save.dog) { P.dogT -= dt; if (P.dogT <= 0) { P.dogT = CFG.dogDigEvery; P.save.baits.worm = Math.min(99, P.save.baits.worm + 3); this.toast(P, `${P.save.dog.name} heeft 3 wormen opgegraven!`, 'good'); this.dirty(P); } }
    }
    if (this.tick % 2 === 0) {
      const ps = []; for (const P of this.players.values()) ps.push([P.id, r1(P.x), r1(P.z), r2(P.ry), P.mount === 'walk' ? 0 : P.mount === 'bike' ? 1 : P.mount === 'scooter' ? 2 : 3, P.fs, r1(P.bx), r1(P.bz), P.fight ? Math.round(P.fight.D) : 0]);
      this.broadcast({ t: 's', ps });
    }
    if (this.tick % 4 === 0) {
      for (const P of this.players.values()) {
        const ponds = [];
        for (const p of PONDS) {
          if (Math.hypot(P.x - p.x, P.z - p.z) > p.zr + 70) continue;
          const h = this.heronPos(p.id);
          ponds.push([p.id, r1(h.x), r1(h.z), this.fish[p.id].map(f => [f.id, f.sp.i, r1(f.x), r1(f.z), r2(f.h), r2(f.w), f.state === 'chase' || f.state === 'bite' ? 1 : 0])]);
        }
        this.send(P, { t: 'f', ponds });
      }
    }
    if (this.tick % 20 === 0) {
      const ci = this.contestInfo(); if (ci) this.broadcast({ t: 'contest', c: ci });
      for (const [id, o] of this.offers) if (Date.now() - o.at > 30000) this.offers.delete(id);
    }
    const now = Date.now();
    for (const P of this.players.values()) if (P.dirty && now - P.dirtyAt > 400) { P.dirty = false; P.dirtyAt = now; this.send(P, { t: 'save', save: P.save }); this.markDirty(); }
  }
}
