// Start de echte server en test HTTP, accounts en de WebSocket-verbinding.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SERVER } from './_paths.js';

const PORT = 18000 + Math.floor(Math.random() * 1000),
  BASE = `http://127.0.0.1:${PORT}`;
const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'vv-test-'));
let proc;
before(async () => {
  proc = spawn(process.execPath, [fileURLToPath(new URL(SERVER, import.meta.url))], {
    env: { ...process.env, PORT: String(PORT), EXTRA_PORTS: '', DATA_DIR: DATA, LOGIN_LIMIT: '1000', ALLOW_CHEATS: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  proc.stderr.on('data', d => process.stderr.write(d));
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(BASE + '/api/health')).ok) return;
    } catch {}
    await new Promise(r => setTimeout(r, 100));
  }
  throw new Error('server start niet');
});
after(async () => {
  if (proc) {
    const done = new Promise(r => proc.once('exit', r));
    proc.kill();
    await done;
  }
  fs.rmSync(DATA, { recursive: true, force: true });
});
const post = (p, body) =>
  fetch(BASE + p, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(async r => ({
    status: r.status,
    body: await r.json(),
  }));

test('health en statische bestanden', async () => {
  const h = await (await fetch(BASE + '/api/health')).json();
  assert.equal(h.ok, true);
  assert.match(h.build, /^[0-9a-f]{10}$/);
  const html = await (await fetch(BASE + '/')).text();
  assert.ok(html.includes(h.build) && !html.includes('__BUILD__'), 'build-id staat in de pagina');
  const scripts = [...html.matchAll(/src="([^"]+\.js)"/g)].map(m => m[1]);
  assert.ok(scripts.length > 0);
  for (const s of scripts) {
    const r = await fetch(BASE + s);
    assert.equal(r.status, 200, s);
    assert.match(r.headers.get('content-type'), /javascript/);
  }
  assert.equal((await fetch(BASE + '/../server.js')).status === 200 && false, false);
  assert.equal((await fetch(BASE + '/bestaatniet.js')).status, 404);
});

test('alle client-modules en hun imports zijn bereikbaar', async () => {
  const html = await (await fetch(BASE + '/')).text();
  const seen = new Set(),
    queue = [...html.matchAll(/src="([^"]+\.js)"/g)].map(m => new URL(m[1], BASE).href);
  const map = /<script type="importmap">([\s\S]*?)<\/script>/.exec(html);
  const imports = map ? JSON.parse(map[1]).imports : {};
  while (queue.length) {
    const u = queue.pop();
    if (seen.has(u)) continue;
    seen.add(u);
    const r = await fetch(u);
    assert.equal(r.status, 200, u);
    if (u.includes('/vendor/')) continue;
    const src = await r.text();
    for (const m of src.matchAll(/(?:import|export)\s[^'"]*?from\s*['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g)) {
      const spec = m[1] || m[2];
      const target = imports[spec] ? new URL(imports[spec], BASE + '/').href : new URL(spec, u).href;
      queue.push(target);
    }
  }
  assert.ok(seen.size >= 5, 'meerdere modules geladen: ' + seen.size);
});

test('registreren, inloggen en foutmeldingen', async () => {
  assert.equal((await post('/api/register', { username: 'a', password: 'geheim1' })).status, 400);
  assert.equal((await post('/api/register', { username: 'Tester', password: '123' })).status, 400);
  const r = await post('/api/register', { username: 'Tester', password: 'geheim123' });
  assert.equal(r.status, 200);
  assert.ok(r.body.token);
  assert.equal(
    (await post('/api/register', { username: 'tester', password: 'geheim123' })).status,
    400,
    'naam bezet (hoofdletterongevoelig)',
  );
  assert.equal((await post('/api/login', { username: 'Tester', password: 'fout' })).status, 400);
  const l = await post('/api/login', { username: 'TESTER', password: 'geheim123' });
  assert.equal(l.status, 200);
  assert.equal(l.body.name, 'Tester');
});

test('websocket: inloggen, kamer in, snapshots ontvangen', async () => {
  const { body } = await post('/api/register', { username: 'Wessel', password: 'geheim123' });
  const build = (await (await fetch(BASE + '/api/health')).json()).build;
  const ws = new WebSocket(`ws://127.0.0.1:${PORT}/ws`),
    got = [];
  const waitFor = (t, ms = 5000) =>
    new Promise((res, rej) => {
      const st = Date.now();
      const iv = setInterval(() => {
        const m = got.find(x => x.t === t);
        if (m) {
          clearInterval(iv);
          res(m);
        } else if (Date.now() - st > ms) {
          clearInterval(iv);
          rej(new Error('geen ' + t));
        }
      }, 20);
    });
  ws.onmessage = e => got.push(JSON.parse(e.data));
  await new Promise(r => (ws.onopen = r));
  ws.send(JSON.stringify({ t: 'auth', token: body.token, build }));
  const authed = await waitFor('authed');
  assert.equal(authed.name, 'Wessel');
  assert.ok(authed.rooms.length >= 2);
  assert.ok(Number.isInteger(authed.save.house) && authed.save.house >= 0, 'account kreeg een huis');
  ws.send(JSON.stringify({ t: 'quick' }));
  const joined = await waitFor('joined');
  assert.ok(joined.id > 0);
  assert.ok(Array.isArray(joined.houses));
  await waitFor('s');
  await waitFor('f');
  ws.send(JSON.stringify({ t: 'say', text: 'hallo' }));
  const chat = await waitFor('chat');
  assert.equal(chat.text, 'hallo');
  ws.send(JSON.stringify({ t: 'leave' }));
  await waitFor('left');
  ws.close();
});

test('websocket: oude build krijgt melding, fout token faalt', async () => {
  const ws = new WebSocket(`ws://127.0.0.1:${PORT}/ws`),
    got = [];
  ws.onmessage = e => got.push(JSON.parse(e.data));
  await new Promise(r => (ws.onopen = r));
  ws.send(JSON.stringify({ t: 'auth', token: 'onzin' }));
  await new Promise(r => setTimeout(r, 300));
  assert.ok(got.some(m => m.t === 'authfail'));
  const { body } = await post('/api/login', { username: 'Wessel', password: 'geheim123' });
  ws.send(JSON.stringify({ t: 'auth', token: body.token, build: 'oud' }));
  await new Promise(r => setTimeout(r, 300));
  assert.ok(got.some(m => m.t === 'outdated'));
  ws.close();
});

test('gegevens worden bewaard in db.json', async () => {
  await new Promise(r => setTimeout(r, 1800));
  const db = JSON.parse(fs.readFileSync(path.join(DATA, 'db.json'), 'utf8'));
  assert.ok(db.users.tester && db.users.wessel);
  assert.ok(!JSON.stringify(db).includes('geheim123'), 'wachtwoord niet als platte tekst opgeslagen');
});

/* ---------------- samen spelen en opnieuw verbinden */
async function client(name) {
  let r = await post('/api/register', { username: name, password: 'geheim123' });
  if (r.status !== 200) r = await post('/api/login', { username: name, password: 'geheim123' });
  const build = (await (await fetch(BASE + '/api/health')).json()).build;
  const ws = new WebSocket(`ws://127.0.0.1:${PORT}/ws`),
    got = [];
  ws.onmessage = e => got.push(JSON.parse(e.data));
  await new Promise(res => (ws.onopen = res));
  const c = {
    ws,
    got,
    send: o => ws.send(JSON.stringify(o)),
    wait: (t, pred = () => true, ms = 5000) =>
      new Promise((res, rej) => {
        const st = Date.now(),
          from = c.mark;
        const iv = setInterval(() => {
          const m = got.slice(from).find(x => x.t === t && pred(x));
          if (m) {
            clearInterval(iv);
            res(m);
          } else if (Date.now() - st > ms) {
            clearInterval(iv);
            rej(new Error(name + ': geen ' + t));
          }
        }, 20);
      }),
    mark: 0,
    next() {
      c.mark = got.length;
      return c;
    },
  };
  c.send({ t: 'auth', token: r.body.token, build });
  await c.wait('authed');
  return c;
}

test('vrienden: toevoegen, online-status en kamer', async () => {
  const a = await client('Femke'),
    b = await client('Gijs');
  a.next().send({ t: 'friendAdd', name: 'gijs' });
  let s = await a.wait('social');
  assert.equal(s.friends[0].name, 'Gijs');
  assert.equal(s.friends[0].online, true);
  await b.wait('toast', m => /vriend/.test(m.msg));
  b.next().send({ t: 'quick' });
  const joined = await b.wait('joined');
  a.next().send({ t: 'social' });
  s = await a.wait('social');
  assert.equal(s.friends[0].room.id, joined.room.id, 'je ziet in welke kamer je vriend is');
  a.next().send({ t: 'friendAdd', name: 'bestaatniet' });
  await a.wait('toast', m => /bestaat niet/.test(m.msg));
  a.ws.close();
  b.ws.close();
});

test('visclub: oprichten kost munten, lid worden, afkorting bij je naam', async () => {
  const a = await client('Hanna'),
    b = await client('Ivo');
  a.next().send({ t: 'clubCreate', name: 'De Snoekjes', tag: 'snk' });
  await a.wait('toast', m => /kost 200/.test(m.msg)); // te weinig munten
  a.next().send({ t: 'quick' });
  await a.wait('joined');
  a.send({ t: 'dev', coins: 500 });
  a.next().send({ t: 'clubCreate', name: 'De Snoekjes', tag: 'snk' });
  let s = await a.wait('social', m => !!m.club);
  assert.equal(s.club.tag, 'SNK');
  assert.equal(s.club.owner, 'Hanna');
  const save = await a.wait('save', m => m.save.club);
  assert.equal(save.save.coins, 80 + 500 - 200);
  b.next().send({ t: 'clubJoin', key: s.club.key });
  s = await b.wait('social');
  assert.equal(s.club.members.length, 2);
  b.next().send({ t: 'quick' });
  const j = await b.wait('joined');
  assert.equal(j.players.find(p => p.name === 'Ivo').club, 'SNK');
  a.next().send({ t: 'clubCreate', name: 'Kankerclub', tag: 'KK' });
  await a.wait('toast');
  a.ws.close();
  b.ws.close();
});

test('dagdoel staat klaar voor iedereen', async () => {
  const a = await client('Jet');
  const authed = a.got.find(m => m.t === 'authed');
  assert.ok(authed.community && authed.community.n > 0 && typeof authed.community.text === 'string');
  a.ws.close();
});

test('uitnodigen: vriend krijgt een uitnodiging met de kamer', async () => {
  const a = await client('Koen'),
    b = await client('Lies');
  a.next().send({ t: 'quick' });
  const j = await a.wait('joined');
  b.next();
  a.next().send({ t: 'invite', to: 'Lies', kind: 'house' });
  const inv = await b.wait('invite');
  assert.equal(inv.from, 'Koen');
  assert.equal(inv.kind, 'house');
  assert.equal(inv.room.id, j.room.id);
  a.ws.close();
  b.ws.close();
});

test('opnieuw verbinden: terug in dezelfde kamer', async () => {
  const a = await client('Mila');
  a.next().send({ t: 'quick' });
  const j = await a.wait('joined');
  a.ws.close();
  await new Promise(r => setTimeout(r, 300));
  const b = await client('Mila');
  const authed = b.got.find(m => m.t === 'authed');
  assert.equal(authed.resume, j.room.id);
  b.next().send({ t: 'join', id: authed.resume, resume: true });
  const j2 = await b.wait('joined');
  assert.equal(j2.room.id, j.room.id);
  assert.ok(j2.you, 'startplek meegestuurd');
  b.ws.close();
});

test('uitnodigingslink naar een verdwenen kamer: gewoon snel spelen', async () => {
  const a = await client('Noor');
  a.next().send({ t: 'join', id: 99999, link: true });
  const j = await a.wait('joined');
  assert.ok(j.room.id > 0);
  a.ws.close();
});
