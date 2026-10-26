// Voortgang van een speler: save-bestand controleren/repareren, niveaus, talenten, dagopdrachten en huisinfo.
import * as S from '../../public/js/shared.js';
import { clamp, today, seeded, strHash } from './util.js';
const { PONDS, SPECIES, SP, BAIT, BAITS, UPGRADES, TALENTS, QUEST_KINDS } = S;

/* ---------------- niveaus en talenten */
export function levelInfo(xp) {
  let lvl = 1,
    rest = xp;
  while (lvl < S.MAX_LEVEL && rest >= S.levelNeed(lvl)) {
    rest -= S.levelNeed(lvl);
    lvl++;
  }
  return { level: lvl, cur: lvl >= S.MAX_LEVEL ? 0 : rest, need: lvl >= S.MAX_LEVEL ? 0 : S.levelNeed(lvl) };
}
const spent = t => Object.values(t).reduce((a, b) => a + b, 0);
export function applyTalent(save, id) {
  if (!(id in TALENTS) || save.talents[id] >= S.TALENT_MAX || spent(save.talents) >= save.lvl - 1) return false;
  save.talents[id]++;
  return true;
}
export function resetTalents(save) {
  for (const k of Object.keys(TALENTS)) save.talents[k] = 0;
}

/* ---------------- dagopdrachten (zelfde opdrachten voor dezelfde speler op dezelfde dag) */
function dailyQuests(name, day, save) {
  const rng = seeded(name + day),
    kinds = Object.keys(QUEST_KINDS),
    out = [];
  const highest = Math.max(0, ...save.unlocked);
  const pool = SPECIES.filter(s => !s.leg && s.pond <= highest && s.rar <= 2 && s.pond <= 5);
  while (out.length < 3) {
    const k = kinds[Math.floor(rng() * kinds.length)];
    if (out.some(q => q.kind === k)) continue;
    const K = QUEST_KINDS[k],
      tier = Math.min(2, Math.floor(highest / 2) + (rng() < 0.4 ? 1 : 0)),
      n = K.n[tier];
    const q = {
      id: out.length,
      kind: k,
      n,
      p: 0,
      done: false,
      coins: Math.round(K.coins * (K.one ? 1 : n) * (1 + highest * 0.25)),
      xp: Math.round(K.xp * (K.one ? 1 : n)),
    };
    if (k === 'species') q.sp = pool[Math.floor(rng() * pool.length)].id;
    out.push(q);
  }
  return out;
}
export function ensureDaily(u) {
  const s = u.save,
    day = today();
  if (!s.daily || s.daily.day !== day || !Array.isArray(s.daily.q)) s.daily = { day, q: dailyQuests(u.name, day, s) };
  return s.daily;
}

/* ---------------- save controleren: vult ontbrekende velden aan en herstelt ongeldige waarden */
const isObj = v => v && typeof v === 'object' && !Array.isArray(v);
const num = (v, d = 0) => (Number.isFinite(v) ? v : d);
export function ensureSave(u) {
  const s = u.save || (u.save = {});
  s.coins = Math.max(0, num(s.coins, 80) | 0);
  s.xp = Math.max(0, num(s.xp) | 0);
  s.rep = Math.max(0, num(s.rep) | 0);
  s.talents = Object.assign(Object.fromEntries(Object.keys(TALENTS).map(k => [k, 0])), isObj(s.talents) ? s.talents : {});
  for (const k of Object.keys(s.talents))
    if (!(k in TALENTS)) delete s.talents[k];
    else s.talents[k] = clamp(s.talents[k] | 0, 0, S.TALENT_MAX);
  s.lvl = levelInfo(s.xp).level;
  if (spent(s.talents) > s.lvl - 1) resetTalents(s);
  s.rods = Object.assign({ owned: [0], active: 0, dur: {} }, isObj(s.rods) ? s.rods : {});
  if (!Array.isArray(s.rods.owned) || !s.rods.owned.includes(0)) s.rods.owned = [0, ...(Array.isArray(s.rods.owned) ? s.rods.owned : [])];
  if (!s.rods.owned.includes(s.rods.active)) s.rods.active = 0;
  if (!isObj(s.rods.dur)) s.rods.dur = {};
  s.upg = Object.assign({ reel: 0, line: 0, float: 0, sonar: 0 }, isObj(s.upg) ? s.upg : {});
  for (const k of Object.keys(UPGRADES)) s.upg[k] = clamp(s.upg[k] | 0, 0, UPGRADES[k].max);
  if (!isObj(s.baits)) s.baits = { worm: 20, made: 6, brood: 6 };
  for (const b of BAITS) s.baits[b.id] = clamp(s.baits[b.id] | 0, 0, 99);
  if (!BAIT[s.bait]) s.bait = 'worm';
  if (!Array.isArray(s.inv)) s.inv = [];
  s.nextId = Math.max(1, s.nextId | 0, ...s.inv.map(f => f.id + 1));
  if (!isObj(s.book)) s.book = {};
  s.mounts = Object.assign({ bike: false, scooter: false, boat: false }, isObj(s.mounts) ? s.mounts : {});
  if (s.dog && typeof s.dog.name !== 'string') s.dog = null;
  if (String(u.name).toLowerCase() === 'toon') s.dog = { name: 'Iron Dog' }; // speler Toon heeft altijd een Ironman-hond
  s.stats = Object.assign(
    {
      catches: 0,
      released: 0,
      sold: 0,
      best: 0,
      bestSp: '',
      totalKg: 0,
      rareCatches: 0,
      epicCatches: 0,
      legCatches: 0,
      nightCatches: 0,
      stormCatches: 0,
      contestWins: 0,
      cooked: 0,
      pond: {},
    },
    isObj(s.stats) ? s.stats : {},
  );
  if (!isObj(s.stats.pond)) s.stats.pond = {};
  s.unlocked = Array.isArray(s.unlocked) ? [...new Set(s.unlocked.filter(i => PONDS[i]?.req))] : [];
  s.disc = Array.isArray(s.disc) ? [...new Set(s.disc.filter(i => PONDS[i]?.secret))] : [];
  if (!isObj(s.ach)) s.ach = {};
  if (!isObj(s.buffs)) s.buffs = {};
  s.trophies = Math.max(0, s.trophies | 0);
  if (!Number.isInteger(s.look) || s.look < 0 || s.look > 3) s.look = strHash(u.name) % 4;
  if (!Number.isInteger(s.house)) s.house = -1;
  ensureDaily(u);
  return s;
}

/* ---------------- huis: wat bezoekers in het aquarium en de mand zien */
export function houseInfo(save, name) {
  const sp = Object.entries(save.book || {})
    .filter(([id]) => SP[id])
    .sort((a, b) => SP[b[0]].rar - SP[a[0]].rar || a[0].localeCompare(b[0]))
    .map(([id, b]) => [id, b.n, b.best]);
  return { s: save.house, n: name, d: save.dog?.name || '', sp };
}
