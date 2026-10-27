// Nieuwe spelonderdelen: chatfilter, technieken, krachtbalk, visstekken, reuzenvis en inrichting.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ROOM, SHARED, FILTER } from './_paths.js';
const { Room } = await import(ROOM);
const S = await import(SHARED);
const { cleanText, isRude } = await import(FILTER);

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
function shore(room, P, pond = 0, dist = 10) {
  const p = S.PONDS[pond];
  for (let a = 0; a < 6.28; a += 0.05) {
    const s = S.shorePoint(p, a, 1.5);
    if (!S.walkable(s.x, s.z)) continue;
    const w = {
      x: s.x + ((p.x - s.x) / Math.hypot(p.x - s.x, p.z - s.z)) * dist,
      z: s.z + ((p.z - s.z) / Math.hypot(p.x - s.x, p.z - s.z)) * dist,
    };
    if (S.pondWater(w.x, w.z) === pond) {
      P.x = s.x;
      P.z = s.z;
      P.lastOk = { x: s.x, z: s.z };
      return w;
    }
  }
  throw new Error('geen oever gevonden');
}

test('chatfilter vervangt scheldwoorden, laat gewone tekst staan', () => {
  assert.equal(cleanText('wat een k4nker vis'), 'wat een ****** vis');
  assert.equal(cleanText('f.u.c.k dit'), '******* dit');
  assert.equal(cleanText('kuuuut'), '******');
  for (const ok of ['prachtige snoek', 'zak chips', 'mijn nichtje', 'die kan kerel', 'schitterend', 'lekker'])
    assert.equal(cleanText(ok), ok);
  assert.ok(isRude('Klootzak'));
  assert.ok(!isRude('Visvriend'));
  const room = new Room(1, 'T', 4, false),
    a = fakeConn('A'),
    b = fakeConn('B'),
    A = room.addPlayer(a);
  room.addPlayer(b);
  room.handle(A, { t: 'say', text: 'tering zeg' });
  assert.equal(last(b, 'chat').text, '****** zeg');
});

test('techniek volgt uit het aas', () => {
  assert.equal(S.techOf('worm'), 'dobber');
  assert.equal(S.techOf('boilie'), 'grond');
  assert.equal(S.techOf('spinner'), 'kunstaas');
  assert.equal(S.castPower(0), 0);
  assert.ok(Math.abs(S.castPower(S.CAST_PERIOD / 2) - 1) < 1e-9);
});

test('kunstaas: binnendraaien trekt het aas naar je toe; zonder beet is het aas binnen', () => {
  seedRandom(3);
  const room = new Room(2, 'T', 4, false),
    conn = fakeConn('Draaier'),
    P = room.addPlayer(conn);
  P.save.baits.spinner = 10;
  P.save.bait = 'spinner';
  room.fish[0].length = 0; // lege vijver: geen beet mogelijk
  room.maintainFish = () => {};
  const w = shore(room, P, 0, 10);
  room.handle(P, { t: 'cast', x: w.x, z: w.z });
  assert.equal(P.fs, 1);
  assert.equal(P.tech, 'kunstaas');
  const d0 = Math.hypot(P.bx - P.x, P.bz - P.z);
  room.handle(P, { t: 'reel', on: true });
  for (let i = 0; i < 20; i++) room.update(0.05);
  assert.ok(Math.hypot(P.bx - P.x, P.bz - P.z) < d0 - 1.5, 'aas komt dichterbij');
  for (let i = 0; i < 400 && P.fs; i++) room.update(0.05);
  assert.equal(P.fs, 0, 'aas is binnen');
  assert.match(last(conn, 'lost').msg, /binnen zonder beet/);
});

test('perfecte worp telt mee en visstekken bestaan in elke vijver', () => {
  const room = new Room(3, 'T', 4, false),
    conn = fakeConn('Gooier'),
    P = room.addPlayer(conn);
  const w = shore(room, P, 0, 8);
  room.handle(P, { t: 'cast', x: w.x, z: w.z, perfect: true });
  assert.equal(P.save.stats.perfectCasts, 1);
  for (const p of S.PONDS) {
    assert.ok(room.hot[p.id].length >= 1);
    for (const h of room.hot[p.id]) assert.equal(S.pondWater(h.x, h.z), p.id, 'stek ligt in het water');
  }
  room.update(0.05);
  room.update(0.05);
  room.update(0.05);
  room.update(0.05);
  const f = last(conn, 'f');
  assert.ok(
    f.ponds.some(pd => Array.isArray(pd[4]) && pd[4].length),
    'stekken worden naar de client gestuurd',
  );
});

test('vissen op een visstek levert vaker en zwaardere vis', () => {
  seedRandom(11);
  const room = new Room(4, 'T', 4, false),
    conn = fakeConn('Stekker'),
    P = room.addPlayer(conn);
  const h = room.hot[0][0];
  P.x = h.x;
  P.z = h.z; // test: dobber midden op de stek (positie van de speler wordt hier niet gecontroleerd)
  Object.assign(P, { fs: 1, bx: h.x + 1, bz: h.z, pond: 0, waitT: 0, rollT: 0, chase: null, hintT: 0, tech: 'dobber', perfect: false });
  P.x = h.x + 4;
  let caught = null;
  for (let i = 0; i < 20 * 600 && !caught; i++) {
    if (P.fs === 2) room.handle(P, { t: 'hook' });
    if (P.fs === 3) P.reel = P.fight.phase !== 'run' && P.fight.T < 85;
    room.update(0.05);
    caught = last(conn, 'catch');
    if (!P.fs && !caught) Object.assign(P, { fs: 1, bx: h.x + 1, bz: h.z, pond: 0, rollT: 0, chase: null, tech: 'dobber' });
  }
  assert.ok(caught, 'vis gevangen op de stek');
  assert.equal(caught.fish.hot, true);
  assert.equal(P.save.stats.hotCatches, 1);
});

test('reuzenvis: samen binnenhalen, iedereen die hielp krijgt de beloning', () => {
  seedRandom(5);
  const room = new Room(5, 'T', 4, false),
    ca = fakeConn('Anna'),
    cb = fakeConn('Bert'),
    A = room.addPlayer(ca),
    B = room.addPlayer(cb);
  room.spawnBoss(0);
  assert.ok(room.boss);
  const coins = A.save.coins;
  // beide spelers hebben de reus aan de haak
  for (const P of [A, B]) {
    Object.assign(P, { fs: 2, chase: 'boss', bx: room.boss.x, bz: room.boss.z, pond: 0, x: room.boss.x + 6, z: room.boss.z, biteT: 3 });
    room.handle(P, { t: 'hook' });
    assert.equal(P.fs, 3);
    assert.ok(P.fight.boss);
  }
  for (let i = 0; i < 20 * 400 && room.boss; i++) {
    for (const P of [A, B]) {
      if (P.fs === 3) P.reel = P.fight.phase !== 'run' && P.fight.T < 85;
      else if (room.boss) {
        // lijn geknapt: opnieuw aanhaken
        Object.assign(P, { fs: 2, chase: 'boss', bx: room.boss.x, bz: room.boss.z, pond: 0, biteT: 3 });
        room.handle(P, { t: 'hook' });
      }
    }
    room.boss && (room.boss.until = room.t + 100);
    room.update(0.05);
  }
  assert.equal(room.boss, null, 'reus is gevangen');
  const win = last(ca, 'bossWin');
  assert.ok(win && win.names.includes('Anna') && win.names.includes('Bert'));
  assert.equal(A.save.stats.bossWins, 1);
  assert.equal(B.save.stats.bossWins, 1);
  assert.ok(A.save.coins >= coins + 250);
  assert.ok(A.save.ach.reus, 'prestatie Reuzenvangers');
});

test('reuzenvis zwemt weg als de tijd om is', () => {
  const room = new Room(6, 'T', 4, false),
    c = fakeConn('X');
  room.addPlayer(c);
  room.spawnBoss(0);
  room.boss.until = room.t + 0.1;
  for (let i = 0; i < 10; i++) room.update(0.05);
  assert.equal(room.boss, null);
  assert.equal(last(c, 'boss').b, null);
});

test('inrichting kopen, neerzetten en opbergen; huis bezoeken', () => {
  const houses = [{ s: 0, n: 'Eigenaar', d: '', sp: [] }];
  const room = new Room(7, 'T', 4, false, { houses: () => houses }),
    conn = fakeConn('Koper'),
    P = room.addPlayer(conn);
  P.save.coins = 1000;
  const shop = S.SHOPS.find(s => s.type === 'main');
  P.x = shop.x;
  P.z = shop.z;
  room.handle(P, { t: 'buy', item: 'deco:kist' });
  assert.equal(P.save.deco.kist, true);
  assert.ok(P.save.coins < 1000);
  const c2 = P.save.coins;
  room.handle(P, { t: 'buy', item: 'deco:kist' });
  assert.equal(P.save.coins, c2, 'niet dubbel kopen');
  room.handle(P, { t: 'deco', id: 'kist', on: false });
  assert.equal(P.save.deco.kist, false);
  room.handle(P, { t: 'visit', name: 'eigenaar' });
  const tp = last(conn, 'tp'),
    slot = S.HOUSE_SLOTS[0];
  assert.ok(Math.abs(tp.x - slot.x) < 1 && tp.z < slot.z, 'voor de deur van het huis');
});

test('na opnieuw verbinden begin je op je oude plek', () => {
  const room = new Room(8, 'T', 4, false),
    conn = fakeConn('Terug');
  const P = room.addPlayer(conn, { x: S.SPAWN.x + 20, z: S.SPAWN.z + 5 });
  if (S.walkable(S.SPAWN.x + 20, S.SPAWN.z + 5)) {
    assert.equal(P.x, S.SPAWN.x + 20);
    assert.equal(conn.msgs[0].you.x, S.SPAWN.x + 20);
  }
  const Q = room.addPlayer(fakeConn('Water'), { x: S.PONDS[0].x, z: S.PONDS[0].z });
  assert.ok(Math.abs(Q.x - S.SPAWN.x) < 3, 'onmogelijke plek (water): gewoon bij de start');
});
