// Samen spelen: vrienden (met online-status), visclubs, het gezamenlijke dagdoel en uitnodigingen.
// Alles staat in db.json (db.clubs, db.community) en in de save van elke speler (save.friends, save.club).
import { db, markDirty } from './db.js';
import { today } from './game/util.js';
import { isRude } from './game/filter.js';
import { weekNo } from '../public/js/shared.js';

export const CLUB_PRICE = 200,
  CLUB_MAX = 20,
  FRIENDS_MAX = 50;

/** Wordt door de lobby ingevuld: wie is er online en waar. */
const hooks = {
  /** @type {(name: string) => any} geeft de verbinding van een speler (of undefined) */
  client: () => undefined,
  /** @type {(msg: object) => void} stuurt een bericht naar iedereen die online is */
  broadcast: () => {},
};
export function initSocial(h) {
  Object.assign(hooks, h);
  db.clubs ||= {};
  ensureCommunity();
}
const userByName = name => db.users[String(name).toLowerCase()];

/** Laat een speler weten dat zijn save veranderd is (in een kamer via de Room, anders direct). */
function saveChanged(u) {
  markDirty();
  const c = hooks.client(u.name);
  if (!c) return;
  if (c.player) c.player.dirty = true;
  else c.send({ t: 'save', save: u.save });
}

/* ------------------------------------------------------------------ vrienden */
export function friendsStatus(u) {
  return (u.save.friends || [])
    .map(name => {
      const f = userByName(name);
      if (!f) return null;
      const c = hooks.client(f.name);
      const room = c?.room ? { id: c.room.id, name: c.room.name } : null;
      const mutual = (f.save.friends || []).some(n => n.toLowerCase() === u.name.toLowerCase());
      return { name: f.name, online: !!c, room, mutual, lvl: f.save.lvl, club: clubOf(f)?.tag || '' };
    })
    .filter(Boolean)
    .sort((a, b) => b.online - a.online || a.name.localeCompare(b.name));
}
export function addFriend(u, name) {
  const f = userByName(name);
  if (!f) return 'Die speler bestaat niet.';
  if (f === u) return 'Jezelf toevoegen kan niet.';
  const list = (u.save.friends ||= []);
  if (list.some(n => n.toLowerCase() === f.name.toLowerCase())) return `${f.name} is al je vriend.`;
  if (list.length >= FRIENDS_MAX) return `Je kunt maximaal ${FRIENDS_MAX} vrienden hebben.`;
  list.push(f.name);
  saveChanged(u);
  hooks.client(f.name)?.send({ t: 'toast', msg: `${u.name} heeft je als vriend toegevoegd! Voeg ${u.name} ook toe via 👥.`, kind: 'good' });
  return null;
}
export function removeFriend(u, name) {
  const list = u.save.friends || [];
  const i = list.findIndex(n => n.toLowerCase() === String(name).toLowerCase());
  if (i >= 0) {
    list.splice(i, 1);
    saveChanged(u);
  }
}

/* ------------------------------------------------------------------ uitnodigingen */
/** Stuur een uitnodiging: kind 'room' (kom in mijn kamer) of 'house' (kom naar mijn huis). */
export function invite(from, toName, room, kind) {
  const to = userByName(toName),
    c = to && hooks.client(to.name);
  if (!c) return `${toName} is niet online.`;
  c.send({ t: 'invite', from: from.name, kind, room: room ? { id: room.id, name: room.name } : null });
  return null;
}

/* ------------------------------------------------------------------ visclubs */
const TAG_RE = /^[A-Z0-9]{2,4}$/;
const clubKey = name => String(name).trim().toLowerCase();
export const clubOf = u => (u.save.club && db.clubs[u.save.club]) || null;
export const clubTag = u => clubOf(u)?.tag || '';

function clubWeek(c) {
  const w = weekNo();
  if (c.week !== w) Object.assign(c, { week: w, weekKg: 0, weekN: 0 });
  return c;
}
export function clubList() {
  return Object.entries(db.clubs)
    .map(([key, c]) => {
      clubWeek(c);
      return {
        key,
        name: c.name,
        tag: c.tag,
        owner: c.owner,
        members: c.members.length,
        kg: Math.round(c.kg),
        weekKg: Math.round(c.weekKg),
        n: c.n,
      };
    })
    .sort((a, b) => b.weekKg - a.weekKg || b.kg - a.kg);
}
export function clubInfo(u) {
  const c = clubOf(u);
  if (!c) return null;
  clubWeek(c);
  const members = c.members
    .map(n => userByName(n))
    .filter(Boolean)
    .map(m => ({ name: m.name, lvl: m.save.lvl, online: !!hooks.client(m.name), kg: Math.round(c.contrib?.[m.name.toLowerCase()] || 0) }))
    .sort((a, b) => b.kg - a.kg);
  return {
    key: u.save.club,
    name: c.name,
    tag: c.tag,
    owner: c.owner,
    kg: Math.round(c.kg),
    weekKg: Math.round(c.weekKg),
    n: c.n,
    members,
  };
}
export function createClub(u, name, tag) {
  name = String(name || '')
    .replace(/[^\p{L}\p{N} _'-]/gu, '')
    .trim()
    .slice(0, 20);
  tag = String(tag || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 4);
  if (clubOf(u)) return 'Je zit al in een club. Verlaat die eerst.';
  if (name.length < 3) return 'Clubnaam: minimaal 3 tekens.';
  if (!TAG_RE.test(tag)) return 'Afkorting: 2 tot 4 letters of cijfers.';
  if (isRude(name) || isRude(tag)) return 'Kies een nettere naam.';
  const key = clubKey(name);
  if (db.clubs[key]) return 'Die clubnaam bestaat al.';
  if (Object.values(db.clubs).some(c => c.tag === tag)) return 'Die afkorting is al in gebruik.';
  if (u.save.coins < CLUB_PRICE) return `Een club oprichten kost ${CLUB_PRICE} munten.`;
  u.save.coins -= CLUB_PRICE;
  db.clubs[key] = clubWeek({ name, tag, owner: u.name, members: [u.name], kg: 0, n: 0, created: Date.now(), contrib: {} });
  u.save.club = key;
  saveChanged(u);
  return null;
}
export function joinClub(u, key) {
  const c = db.clubs[key];
  if (!c) return 'Die club bestaat niet meer.';
  if (clubOf(u)) return 'Je zit al in een club. Verlaat die eerst.';
  if (c.members.length >= CLUB_MAX) return `Deze club is vol (max. ${CLUB_MAX}).`;
  c.members.push(u.name);
  u.save.club = key;
  saveChanged(u);
  for (const n of c.members)
    if (n !== u.name) hooks.client(n)?.send({ t: 'toast', msg: `${u.name} is lid geworden van ${c.name}!`, kind: 'good' });
  return null;
}
export function leaveClub(u) {
  const key = u.save.club,
    c = db.clubs[key];
  u.save.club = null;
  saveChanged(u);
  if (!c) return;
  c.members = c.members.filter(n => n.toLowerCase() !== u.name.toLowerCase());
  if (!c.members.length) delete db.clubs[key];
  else if (c.owner === u.name) c.owner = c.members[0];
  markDirty();
}

/* ------------------------------------------------------------------ gezamenlijk dagdoel */
const GOALS = [
  { kind: 'catch', n: 150, text: n => `Vang vandaag samen ${n} vissen` },
  { kind: 'kg', n: 250, text: n => `Vang vandaag samen ${n} kg vis` },
  { kind: 'release', n: 60, text: n => `Zet vandaag samen ${n} vissen terug` },
  { kind: 'rare', n: 25, text: n => `Vang vandaag samen ${n} zeldzame vissen` },
];
export const COMMUNITY_REWARD = { coins: 150, xp: 150 };
function ensureCommunity() {
  const day = today();
  if (db.community?.day === day) return db.community;
  const g = GOALS[[...day].reduce((a, ch) => a + ch.charCodeAt(0), 0) % GOALS.length];
  db.community = { day, kind: g.kind, n: g.n, p: 0, by: {}, done: false };
  markDirty();
  return db.community;
}
export function communityInfo(u) {
  const c = ensureCommunity(),
    g = GOALS.find(x => x.kind === c.kind);
  const top = Object.entries(c.by)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, v]) => ({ name: userByName(name)?.name || name, v: Math.round(v * 10) / 10 }));
  return {
    text: g.text(c.n),
    kind: c.kind,
    n: c.n,
    p: Math.min(c.n, Math.round(c.p * 10) / 10),
    done: c.done,
    mine: u ? Math.round((c.by[u.name.toLowerCase()] || 0) * 10) / 10 : 0,
    top,
    reward: COMMUNITY_REWARD,
  };
}
let lastCommunityBroadcast = 0;
/** Bijdrage aan het dagdoel. Bij het halen krijgt iedereen die meedeed de beloning (ook wie offline is). */
export function addCommunity(u, kind, amount, rewardFn) {
  const c = ensureCommunity();
  if (c.kind !== kind || c.done || !(amount > 0)) return;
  const k = u.name.toLowerCase();
  c.by[k] = (c.by[k] || 0) + amount;
  c.p += amount;
  markDirty();
  if (c.p >= c.n) {
    c.done = true;
    for (const name of Object.keys(c.by)) {
      const m = userByName(name);
      if (!m) continue;
      rewardFn(m, COMMUNITY_REWARD);
      saveChanged(m);
    }
    hooks.broadcast({
      t: 'feed',
      msg: `🌍 Dagdoel gehaald: ${GOALS.find(x => x.kind === c.kind).text(c.n)}! Iedereen die meedeed krijgt 🪙 ${COMMUNITY_REWARD.coins} en ${COMMUNITY_REWARD.xp} xp.`,
      kind: 'legend',
    });
  }
  const now = Date.now();
  if (c.done || now - lastCommunityBroadcast > 3000) {
    lastCommunityBroadcast = now;
    hooks.broadcast({ t: 'community', c: communityInfo() });
  }
}

/* ------------------------------------------------------------------ vangsten tellen voor club en dagdoel */
export function onCatch(u, sp, w, rewardFn) {
  const c = clubOf(u);
  if (c) {
    clubWeek(c);
    c.kg += w;
    c.weekKg += w;
    c.n++;
    const k = u.name.toLowerCase();
    (c.contrib ||= {})[k] = (c.contrib[k] || 0) + w;
    markDirty();
  }
  addCommunity(u, 'catch', 1, rewardFn);
  addCommunity(u, 'kg', w, rewardFn);
  if (sp.rar >= 2) addCommunity(u, 'rare', 1, rewardFn);
}
export const onRelease = (u, rewardFn) => addCommunity(u, 'release', 1, rewardFn);
