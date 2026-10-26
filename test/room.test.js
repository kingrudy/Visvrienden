// Simuleert een complete visbeurt op de server: werpen, aanslaan, drillen, vangen, behouden en verkopen.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ROOM, SHARED } from './_paths.js';
const { Room } = await import(ROOM);
const S = await import(SHARED);

function seedRandom(seed) {
  let a = seed >>> 0;
  Math.random = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function fakeConn(name) {
  return {
    user: { name, save: {} },
    msgs: [],
    send(o) {
      this.msgs.push(typeof o === 'string' ? JSON.parse(o) : o);
    },
  };
}
const last = (c, t) => c.msgs.filter(m => m.t === t).at(-1);

function fishOnce(room, P, conn, maxSec = 900) {
  const p = S.PONDS[0];
  const w = room.randWater(p);
  P.x = w.x + 3;
  P.z = w.z;
  P.lastOk = { x: P.x, z: P.z };
  room.handle(P, { t: 'cast', x: w.x, z: w.z });
  assert.equal(P.fs, 1, 'dobber ligt in het water');
  for (let i = 0; i < maxSec * 20; i++) {
    if (P.fs === 2) room.handle(P, { t: 'hook' });
    if (P.fs === 3) P.reel = P.fight.phase !== 'run' && P.fight.T < 85;
    room.update(0.05);
    if (last(conn, 'catch')) return last(conn, 'catch');
    if (!P.fs) {
      room.handle(P, { t: 'cast', x: w.x, z: w.z });
    }
  }
  return null;
}

test('een speler kan een vis vangen, houden en verkopen', () => {
  seedRandom(42);
  const room = new Room(1, 'Test', 4, false),
    conn = fakeConn('Visser'),
    P = room.addPlayer(conn);
  assert.equal(conn.msgs[0].t, 'joined');
  assert.ok(room.fish[0].length >= S.PONDS[0].fish, 'vijver zit vol vis');
  const c = fishOnce(room, P, conn);
  assert.ok(c, 'binnen de tijd een vis gevangen');
  assert.ok(S.SP[c.fish.sp], 'gevangen soort bestaat');
  assert.equal(P.save.stats.catches, 1);
  room.handle(P, { t: 'keep', fid: c.fid });
  assert.equal(P.save.inv.length, 1, 'vis zit in het visnet');
  const shop = S.SHOPS.find(s => s.type === 'main');
  P.x = shop.x;
  P.z = shop.z;
  const before = P.save.coins;
  room.handle(P, { t: 'sell', all: true });
  assert.equal(P.save.inv.length, 0);
  assert.ok(P.save.coins > before, 'munten verdiend');
});

test('terugzetten geeft reputatie', () => {
  seedRandom(7);
  const room = new Room(2, 'Test2', 4, false),
    conn = fakeConn('Zetter'),
    P = room.addPlayer(conn);
  const c = fishOnce(room, P, conn);
  assert.ok(c);
  room.handle(P, { t: 'release', fid: c.fid });
  assert.ok(P.save.rep > 0);
  assert.equal(P.save.stats.released, 1);
});

test('winkel: aas kopen kost munten, alleen bij de winkel', () => {
  const room = new Room(3, 'Test3', 4, false),
    conn = fakeConn('Koper'),
    P = room.addPlayer(conn);
  const coins = P.save.coins;
  P.x = 9999;
  room.handle(P, { t: 'buy', item: 'bait:worm' });
  assert.equal(P.save.coins, coins, 'ver van de winkel: niks gekocht');
  const shop = S.SHOPS.find(s => s.type === 'main');
  P.x = shop.x;
  P.z = shop.z;
  P.save.baits.worm = 0;
  room.handle(P, { t: 'buy', item: 'bait:worm' });
  assert.equal(P.save.baits.worm, S.BAIT_PACK);
  assert.ok(P.save.coins < coins);
});

test('spelers zien elkaar en chatten', () => {
  const room = new Room(4, 'Test4', 4, false),
    a = fakeConn('Anna'),
    b = fakeConn('Bert');
  const A = room.addPlayer(a);
  room.addPlayer(b);
  assert.ok(a.msgs.some(m => m.t === 'pinfo' && m.p.name === 'Bert'));
  room.handle(A, { t: 'say', text: 'hoi <b>' });
  const chat = last(b, 'chat');
  assert.equal(chat.text, 'hoi b');
  assert.equal(chat.name, 'Anna');
  room.update(0.05);
  room.update(0.05);
  assert.ok(last(b, 's').ps.length === 2, 'snapshot met beide spelers');
});

test('valsspelen: te grote sprong wordt teruggezet', () => {
  const room = new Room(5, 'Test5', 4, false),
    conn = fakeConn('Snel'),
    P = room.addPlayer(conn);
  const x0 = P.x;
  room.handle(P, { t: 'pos', x: x0 + 300, z: P.z, ry: 0 });
  assert.equal(P.x, x0);
  assert.equal(last(conn, 'tp').x, Math.round(x0 * 10) / 10);
});
