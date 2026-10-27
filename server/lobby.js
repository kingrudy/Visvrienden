// Lobby: verbonden spelers, kamers aanmaken/opruimen, berichten buiten een kamer, samen-spelen en de spellus.
import { BUILD, MAX_ROOMS, ROOM_IDLE_MS, PERMANENT_ROOMS, TICK_MS } from './config.js';
import { markDirty } from './db.js';
import { userByToken, prepareUser, allHouses } from './accounts.js';
import { Room } from './game/room.js';
import { applyTalent, resetTalents, ensureDaily, levelInfo } from './game/progress.js';
import { cleanText } from './game/filter.js';
import * as social from './social.js';

const MSG_PER_SECOND = 400,
  PING_EVERY_MS = 20000,
  PONG_TIMEOUT_MS = 60000,
  LOBBY_BROADCAST_S = 2,
  RESUME_MS = 120000; // na een verbroken verbinding mag je zo lang terug naar je kamer en plek

const clients = new Set();
const byUser = new Map(); // naam (kleine letters) -> Client
const rooms = new Map();
let nextRoomId = 1;

/** Eén verbonden browser. Buiten een kamer handelt de lobby de berichten af, daarbinnen de Room. */
class Client {
  constructor(ws) {
    this.ws = ws;
    this.user = null;
    this.room = null;
    this.player = null;
    this.outdated = false;
    this.msgCount = 0;
    ws.onmessage = text => this.onMessage(text);
    ws.onclose = () => this.onClose();
  }
  get closed() {
    return this.ws.closed;
  }
  send(obj) {
    this.ws.send(obj);
  }
  kill() {
    this.ws.close();
  }
  onClose() {
    clients.delete(this);
    // verbinding weggevallen midden in het spel: onthoud kamer en plek, zodat je na herverbinden verder kunt
    if (this.room && this.player && this.user) {
      this.user.resume = { room: this.room.id, x: this.player.x, z: this.player.z, at: Date.now() };
    }
    this.leaveRoom();
    if (this.user && byUser.get(this.user.name.toLowerCase()) === this) byUser.delete(this.user.name.toLowerCase());
  }
  onMessage(text) {
    if (++this.msgCount > MSG_PER_SECOND) return this.kill();
    let m;
    try {
      m = JSON.parse(text);
    } catch {
      return;
    }
    if (!m || typeof m.t !== 'string') return;
    if (m.t === 'auth') return this.auth(m);
    if (!this.user) return;
    if (this.outdated) return this.send({ t: 'err', msg: 'Herlaad de pagina om de nieuwe versie te laden.' });
    if (SOCIAL_MESSAGES[m.t]) return SOCIAL_MESSAGES[m.t](this, m); // werkt zowel in de lobby als in een kamer
    if (this.room) {
      if (m.t === 'leave') return this.leaveRoom(true);
      if (this.player) this.room.handle(this.player, m);
      return;
    }
    const handler = LOBBY_MESSAGES[m.t];
    if (handler) handler(this, m);
  }
  auth(m) {
    const u = userByToken(m.token);
    if (!u) return this.send({ t: 'authfail' });
    const key = u.name.toLowerCase(),
      old = byUser.get(key);
    if (old && old !== this) {
      // elders ingelogd: oude verbinding eruit
      old.send({ t: 'kicked' });
      old.kill();
    }
    this.user = prepareUser(u);
    byUser.set(key, this);
    if (m.build !== BUILD) {
      // oude spelcode in de browser: niet laten spelen, wel uitleggen
      this.outdated = true;
      this.send({ t: 'outdated', build: BUILD });
      this.send({ t: 'authed', name: u.name, save: u.save, rooms: [] });
      return this.send({
        t: 'err',
        msg: 'Er is een nieuwe versie van Visvrienden. Herlaad de pagina (F5, of op je telefoon omlaag trekken) om verder te spelen.',
      });
    }
    const r = u.resume,
      resume = r && Date.now() - r.at < RESUME_MS && rooms.has(r.room) ? r.room : 0;
    this.send({ t: 'authed', name: u.name, save: u.save, rooms: roomList(), resume, community: social.communityInfo(u) });
  }
  joinRoom(room, opts = {}) {
    if (room.players.size >= room.max) return this.send({ t: 'err', msg: 'Deze kamer is vol.' });
    const r = this.user.resume;
    if (opts.resume && r && r.room === room.id && Date.now() - r.at < RESUME_MS) opts = { x: r.x, z: r.z };
    else opts = {};
    this.user.resume = null;
    this.room = room;
    this.player = room.addPlayer(this, opts);
  }
  leaveRoom(notify = false) {
    if (!this.room) return;
    const room = this.room,
      P = this.player;
    this.room = null;
    this.player = null;
    if (P) room.removePlayer(P);
    if (notify && !this.closed) {
      ensureDaily(this.user);
      this.send({ t: 'left', save: this.user.save, rooms: roomList() });
    }
  }
  /** Save is buiten de spellus veranderd: in een kamer via de Room versturen, anders direct. */
  saveChanged() {
    markDirty();
    if (this.player) this.player.dirty = true;
    else this.send({ t: 'save', save: this.user.save });
  }
}

const LOBBY_MESSAGES = {
  rooms: c => c.send({ t: 'rooms', rooms: roomList() }),
  talent: (c, m) => {
    applyTalent(c.user.save, String(m.id));
    c.saveChanged();
  },
  retalent: c => {
    resetTalents(c.user.save);
    c.saveChanged();
  },
  look: (c, m) => {
    const l = m.v | 0;
    if (l >= 0 && l <= 3) {
      c.user.save.look = l;
      markDirty();
      c.send({ t: 'look', v: l });
    }
  },
  create: (c, m) => {
    if (rooms.size >= MAX_ROOMS) return c.send({ t: 'err', msg: 'Er zijn al te veel kamers. Kies een bestaande.' });
    const name =
      cleanText(
        String(m.name || '')
          .replace(/[^\p{L}\p{N} _'-]/gu, '')
          .trim()
          .slice(0, 24),
      ).replace(/\*+/g, '') || c.user.name + 's vijver';
    c.joinRoom(makeRoom(name.trim() || c.user.name + 's vijver', Math.min(8, Math.max(1, m.max | 0 || 4)), false));
  },
  join: (c, m) => {
    const r = rooms.get(m.id | 0);
    if (r) c.joinRoom(r, { resume: !!m.resume });
    else if (m.link)
      LOBBY_MESSAGES.quick(c); // uitnodigingslink naar een kamer die niet meer bestaat
    else c.send({ t: 'err', msg: 'Die kamer bestaat niet meer.' });
  },
  quick: c => {
    const best = [...rooms.values()].filter(r => r.players.size < r.max).sort((a, b) => b.players.size - a.players.size)[0];
    c.joinRoom(best || makeRoom(c.user.name + 's vijver', 4, false));
  },
};

/* ---------------- vrienden, clubs, dagdoel en uitnodigingen (in de lobby én in een kamer) */
const reply = (c, err) => {
  if (err) c.send({ t: 'toast', msg: err, kind: 'warn' });
};
const sendSocial = c =>
  c.send({
    t: 'social',
    friends: social.friendsStatus(c.user),
    club: social.clubInfo(c.user),
    clubs: social.clubList(),
    community: social.communityInfo(c.user),
  });
const SOCIAL_MESSAGES = {
  social: c => sendSocial(c),
  friendAdd: (c, m) => {
    reply(c, social.addFriend(c.user, String(m.name || '')));
    sendSocial(c);
  },
  friendDel: (c, m) => {
    social.removeFriend(c.user, String(m.name || ''));
    sendSocial(c);
  },
  clubCreate: (c, m) => {
    const err = social.createClub(c.user, m.name, m.tag);
    reply(c, err);
    if (!err) c.send({ t: 'toast', msg: `Club opgericht! Nodig je vrienden uit om lid te worden.`, kind: 'good' });
    afterClubChange(c);
  },
  clubJoin: (c, m) => {
    reply(c, social.joinClub(c.user, String(m.key || '')));
    afterClubChange(c);
  },
  clubLeave: c => {
    social.leaveClub(c.user);
    afterClubChange(c);
  },
  invite: (c, m) => {
    const kind = m.kind === 'house' ? 'house' : 'room';
    if (!c.room) return reply(c, 'Ga eerst een kamer in om iemand uit te nodigen.');
    const names =
      m.to === '*'
        ? social
            .friendsStatus(c.user)
            .filter(f => f.online)
            .map(f => f.name)
        : [String(m.to || '')];
    let sent = 0;
    for (const n of names) if (!social.invite(c.user, n, c.room, kind)) sent++;
    // spelers in dezelfde kamer krijgen bij een huisuitnodiging ook een bericht
    if (kind === 'house' && m.to === '*')
      for (const P of c.room.players.values())
        if (P !== c.player && !names.includes(P.name) && !social.invite(c.user, P.name, c.room, kind)) sent++;
    c.send({
      t: 'toast',
      msg: sent ? `Uitnodiging verstuurd (${sent}).` : 'Er is niemand online om uit te nodigen.',
      kind: sent ? 'good' : 'warn',
    });
  },
};
function afterClubChange(c) {
  if (c.room && c.player) c.room.sendPinfo(c.player);
  sendSocial(c);
}

/** Beloning (dagdoel) geven aan een speler, ook als die offline is. */
function rewardUser(u, r) {
  const c = byUser.get(u.name.toLowerCase());
  u.save.coins += r.coins;
  if (c?.room && c.player) {
    c.room.addXp(c.player, r.xp);
    c.room.toast(c.player, `🌍 Dagdoel gehaald! +${r.coins} munten en ${r.xp} xp`, 'good');
  } else {
    u.save.xp += r.xp;
    u.save.lvl = levelInfo(u.save.xp).level;
  }
}

/* ---------------- kamers */
const roomServices = {
  markDirty,
  houses: allHouses,
  clubTag: social.clubTag,
  onCatch: (u, sp, w) => social.onCatch(u, sp, w, rewardUser),
  onRelease: u => social.onRelease(u, rewardUser),
};
function makeRoom(name, max, permanent) {
  const r = new Room(nextRoomId++, name, max, permanent, roomServices);
  rooms.set(r.id, r);
  broadcastRooms();
  return r;
}
const roomList = () => [...rooms.values()].map(r => r.summary);
function broadcastRooms() {
  const msg = JSON.stringify({ t: 'rooms', rooms: roomList() });
  for (const c of clients) if (c.user && !c.room && !c.outdated) c.send(msg);
}

/* ---------------- start */
export function startLobby() {
  social.initSocial({
    client: name => byUser.get(String(name).toLowerCase()),
    broadcast: msg => {
      const s = JSON.stringify(msg);
      for (const c of clients) if (c.user && !c.outdated) c.send(s);
    },
  });
  for (const [name, max] of PERMANENT_ROOMS) makeRoom(name, max, true);

  // spellus: alle kamers met spelers bijwerken; lege kamers opruimen
  let last = process.hrtime.bigint(),
    lobbyT = 0;
  setInterval(() => {
    const now = process.hrtime.bigint(),
      dt = Math.min(0.2, Number(now - last) / 1e9);
    last = now;
    for (const r of rooms.values()) {
      if (r.players.size) r.update(dt);
      else if (r.emptySince && Date.now() - r.emptySince > ROOM_IDLE_MS) {
        if (r.permanent) r.reset();
        else {
          rooms.delete(r.id);
          broadcastRooms();
        }
      }
    }
    lobbyT += dt;
    if (lobbyT >= LOBBY_BROADCAST_S) {
      lobbyT = 0;
      broadcastRooms();
    }
  }, TICK_MS);

  // berichtenlimiet per seconde en ping/pong om dode verbindingen op te ruimen
  setInterval(() => {
    for (const c of clients) c.msgCount = 0;
  }, 1000).unref();
  setInterval(() => {
    const now = Date.now();
    for (const c of clients) {
      if (now - c.ws.pongAt > PONG_TIMEOUT_MS) c.kill();
      else c.ws.ping();
    }
  }, PING_EVERY_MS).unref();

  return {
    roomCount: () => rooms.size,
    /** @param {import('./websocket.js').WsSocket} ws */
    connect: ws => {
      clients.add(new Client(ws));
    },
  };
}
