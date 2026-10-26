// Lobby: verbonden spelers, kamers aanmaken/opruimen, berichten buiten een kamer en de spellus.
import { BUILD, MAX_ROOMS, ROOM_IDLE_MS, PERMANENT_ROOMS, TICK_MS } from './config.js';
import { markDirty } from './db.js';
import { userByToken, prepareUser, allHouses } from './accounts.js';
import { Room } from './game/room.js';
import { applyTalent, resetTalents, ensureDaily } from './game/progress.js';

const MSG_PER_SECOND = 400,
  PING_EVERY_MS = 20000,
  PONG_TIMEOUT_MS = 60000,
  LOBBY_BROADCAST_S = 2;

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
      old.send({ t: 'kicked' });
      old.kill();
    } // elders ingelogd: oude verbinding eruit
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
    this.send({ t: 'authed', name: u.name, save: u.save, rooms: roomList() });
  }
  joinRoom(room) {
    if (room.players.size >= room.max) return this.send({ t: 'err', msg: 'Deze kamer is vol.' });
    this.room = room;
    this.player = room.addPlayer(this);
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
}

const saveReply = c => {
  markDirty();
  c.send({ t: 'save', save: c.user.save });
};
const LOBBY_MESSAGES = {
  rooms: c => c.send({ t: 'rooms', rooms: roomList() }),
  talent: (c, m) => {
    applyTalent(c.user.save, String(m.id));
    saveReply(c);
  },
  retalent: c => {
    resetTalents(c.user.save);
    saveReply(c);
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
      String(m.name || '')
        .replace(/[^\p{L}\p{N} _'-]/gu, '')
        .trim()
        .slice(0, 24) || c.user.name + 's vijver';
    c.joinRoom(makeRoom(name, Math.min(8, Math.max(1, m.max | 0 || 4)), false));
  },
  join: (c, m) => {
    const r = rooms.get(m.id | 0);
    if (r) c.joinRoom(r);
    else c.send({ t: 'err', msg: 'Die kamer bestaat niet meer.' });
  },
  quick: c => {
    const best = [...rooms.values()].filter(r => r.players.size < r.max).sort((a, b) => b.players.size - a.players.size)[0];
    c.joinRoom(best || makeRoom(c.user.name + 's vijver', 4, false));
  },
};

/* ---------------- kamers */
function makeRoom(name, max, permanent) {
  const r = new Room(nextRoomId++, name, max, permanent, { markDirty, houses: allHouses });
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
