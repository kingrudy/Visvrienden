// Visvrienden – de client: inloggen, lobby, 3D-wereld, vissen, interface.
import * as THREE from './vendor/three/three.module.js';
import * as S from './shared.js';
import * as M from './models.js';
import { World } from './world.js';
import * as UI from './ui.js';
import * as A from './audio.js';
const { PONDS, SP, SPECIES, RARITY, BAITS, BAIT, RODS, MOUNTS } = S;
const $ = id => document.getElementById(id);
const BUILD = window.__BUILD;
const store = { get(k, d) { try { const v = localStorage.getItem('vv_' + k); return v === null ? d : JSON.parse(v); } catch { return d; } }, set(k, v) { try { localStorage.setItem('vv_' + k, JSON.stringify(v)); } catch { } } };
const isTouch = matchMedia('(pointer:coarse)').matches || 'ontouchstart' in window;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const angDiff = (a, b) => { let d = (b - a) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; };
const MOUNT_N = ['walk', 'bike', 'scooter', 'boat'];

/* ------------------------------------------------------------------ toestand */
const G = {
  ws: null, token: store.get('token', null), name: '', save: null, id: 0, inGame: false, rooms: [], panel: null,
  players: new Map(), houses: new Map(), fish: new Map(), herons: [], ducks: [], timeOff: 0, weather: 'clear', merchant: null, contest: null, weekend: false,
  settings: { q: store.get('q', isTouch ? 0 : 1), vol: store.get('vol', 60), sens: store.get('sens', 100) },
  keys: new Set(), actHeld: false, reelSent: false, lastPosSent: 0, lastSentX: 1e9, lastSentZ: 1e9,
  fight: null, catchCard: null, interact: null, photo: false, chatOpen: false, offer: null, aim: null, statusUntil: 0,
  fps: 60, hudT: 0, shake: 0, outdated: false, quality: 1,
};
const me = { x: S.SPAWN.x, z: S.SPAWN.z, y: 0, ry: Math.PI, mount: 'walk', speed: 0, fs: 0, yaw: Math.PI, pitch: -0.18, dist: 5.2, run: false };
let renderer, scene, camera, world, clock, minimapImg, E_me = null;
const fx = [];       // rimpelingen
const send = o => { if (G.ws && G.ws.readyState === 1) G.ws.send(JSON.stringify(o)); };
A.setVolume(G.settings.vol / 100);

/* ------------------------------------------------------------------ netwerk */
function connect() {
  const url = (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws';
  const ws = new WebSocket(url); G.ws = ws;
  ws.onopen = () => { if (G.token) send({ t: 'auth', token: G.token, build: BUILD }); else showScreen('auth'); };
  ws.onmessage = ev => { try { onMsg(JSON.parse(ev.data)); } catch (e) { console.error(e); } };
  ws.onclose = () => { if (G.ws === ws) { G.ws = null; if (!G.outdated) { toastGlobal('Verbinding verbroken. Pagina herladen...'); if (G.inGame) leaveGameUI(); setTimeout(() => G.ws || connect(), 2500); } } };
}
async function api(path, body) { const r = await fetch(path, { method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }); return r.json(); }
function showScreen(name) { for (const s of ['auth', 'lobby', 'game']) $(s).classList.toggle('hidden', s !== name); $('boot').classList.add('hidden'); if (name === 'lobby') refreshLobby(); }
function toastGlobal(msg, kind = 'info') {
  const d = document.createElement('div'); d.className = 'toast ' + kind; d.textContent = msg; $('toasts').appendChild(d); setTimeout(() => d.remove(), 4500);
  if ($('game').classList.contains('hidden')) { const m = $('authMsg'); if (m && !$('auth').classList.contains('hidden')) m.textContent = msg; }
}

function onMsg(m) {
  switch (m.t) {
    case 'authfail': G.token = null; store.set('token', null); showScreen('auth'); break;
    case 'authed': G.name = m.name; G.save = m.save; G.rooms = m.rooms; showScreen('lobby'); break;
    case 'outdated': G.outdated = true; break;
    case 'kicked': toastGlobal('Je bent ergens anders ingelogd.', 'warn'); break;
    case 'rooms': G.rooms = m.rooms; if (!$('lobby').classList.contains('hidden')) renderRooms(); break;
    case 'err': toastGlobal(m.msg, 'bad'); break;
    case 'left': G.save = m.save; G.rooms = m.rooms; leaveGameUI(); break;
    case 'save': G.save = m.save; onSave(); break;
    case 'look': break;
    case 'joined': startGame(m); break;
    case 's': onSnapshot(m.ps); break;
    case 'f': onFish(m.ponds); break;
    case 'pinfo': addPlayer(m.p); break;
    case 'pgone': removePlayer(m.id); break;
    case 'ev': onEvent(m); break;
    case 'house': setHouse(m.h); break;
    case 'emote': { const E = G.players.get(m.id); if (!E) break; const T = { wave: '👋', laugh: '😄', thumb: '👍' }; const txt = m.k === 'fish' ? (m.sp && SP[m.sp] ? `🐟 ${SP[m.sp].name} ${S.fmtKg(m.w)}` : '🐟 Nog niks gevangen…') : T[m.k]; if (txt) chatBubble(m.id, txt); break; }
    case 'toast': toast(m.msg, m.kind); if (m.kind === 'good') A.sfx.coin(); break;
    case 'feed': feed(m.msg, m.kind); break;
    case 'chat': feed(`<b>${UI.esc(m.name)}</b>: ${UI.esc(m.text)}`, 'chat', true); chatBubble(m.id, m.text); break;
    case 'wx': G.weather = m.w; feed({ clear: '☀️ Het klaart op.', rain: '🌧️ Het begint te regenen. Vissen bijten nu beter!', fog: '🌫️ Mist trekt over het water.', storm: '⛈️ Onweer! Legendarische vissen laten zich zien...' }[m.w], 'info'); break;
    case 'merchant': G.merchant = m.m; world.setMerchant(m.m); break;
    case 'contest': G.contest = m.c; updateContest(); break;
    case 'catch': onCatch(m); break;
    case 'lost': onLost(m); break;
    case 'stolen': G.catchCard = null; $('catchCard').classList.add('hidden'); A.sfx.heron(); break;
    case 'fight': G.fight = m; updateFightUI(); break;
    case 'unlocked': bigMsg(`🔓 ${PONDS[m.pond].name} ontgrendeld!`); A.sfx.levelup(); world.setUnlocked(G.save.unlocked); break;
    case 'discover': bigMsg(`🔮 ${PONDS[m.pond].name} ontdekt!`); A.sfx.legend(); break;
    case 'levelup': bigMsg(`⭐ Niveau ${m.lvl}!`); A.sfx.levelup(); break;
    case 'ach': toast(`🏅 Prestatie: ${S.ACH[m.id].name}`, 'good'); A.sfx.catch(2); break;
    case 'tp': me.x = m.x; me.z = m.z; if (m.msg) toast(m.msg, 'warn'); break;
    case 'mount': me.mount = m.m; updateHotbar(); break;
    case 'offer': showOffer(m); break;
  }
}

/* ------------------------------------------------------------------ inloggen en lobby */
async function doAuth(kind) {
  const username = $('user').value.trim(), password = $('pass').value; $('authMsg').textContent = '';
  try {
    const r = await api('/api/' + kind, { username, password }); if (r.err) { $('authMsg').textContent = r.err; return; }
    G.token = r.token; store.set('token', r.token); send({ t: 'auth', token: r.token, build: BUILD });
  } catch { $('authMsg').textContent = 'Geen verbinding met de server.'; }
}
$('btnLogin').onclick = () => doAuth('login'); $('btnReg').onclick = () => doAuth('register');
$('pass').addEventListener('keydown', e => { if (e.key === 'Enter') doAuth('login'); });
$('btnOut').onclick = () => { G.token = null; store.set('token', null); try { G.ws.close(); } catch { } G.ws = null; showScreen('auth'); setTimeout(connect, 100); };
$('btnQuick').onclick = () => { A.unlock(); send({ t: 'quick' }); };
$('btnCreate').onclick = () => { A.unlock(); send({ t: 'create', name: $('newName').value, max: +$('newMax').value }); };
function renderRooms() {
  $('rooms').innerHTML = G.rooms.length ? G.rooms.map(r => `<div class="rm"><div style="flex:1"><b>${UI.esc(r.name)}</b> ${r.permanent ? '' : '<span class="tag">eigen</span>'}<br><small>${r.players}/${r.max} spelers${r.names?.length ? ' · ' + r.names.map(UI.esc).join(', ') : ''} · ${S.WEATHERS[r.weather] || ''}${r.contest ? ' · 🏆 wedstrijd' : ''}</small></div><button class="pri" data-room="${r.id}" style="flex:0">Meedoen</button></div>`).join('') : '<div class="note">Geen kamers.</div>';
  $('rooms').querySelectorAll('[data-room]').forEach(b => b.onclick = () => { A.unlock(); send({ t: 'join', id: +b.dataset.room }); });
}
function refreshLobby() {
  const s = G.save; $('lobName').textContent = `Hoi ${G.name}!`; $('lobInfo').textContent = `Niveau ${s.lvl} · 🪙 ${s.coins} · ${Object.keys(s.book).length}/${SPECIES.length} soorten gevangen`;
  $('looks').innerHTML = ['🧢', '🎩', '👒', '🧥'].map((e, i) => `<button class="${s.look === i ? 'on' : ''}" data-look="${i}">${e}</button>`).join('');
  $('looks').querySelectorAll('button').forEach(b => b.onclick = () => { send({ t: 'look', v: +b.dataset.look }); G.save.look = +b.dataset.look; refreshLobby(); });
  const fs = S.featuredSpecies();
  $('lobMap').innerHTML = `<div class="note" style="margin-bottom:6px">⭐ Vis van de week: <b>${UI.esc(fs.name)}</b> (${UI.esc(PONDS[fs.pond].name)}), extra kans en 1,5× waarde</div>` + PONDS.map(p => { const list = S.speciesOf(p.id), got = list.filter(x => s.book[x.id]).length, open = !p.req || s.unlocked.includes(p.id), hid = p.secret && !s.disc.includes(p.id) && !got; return `<div class="lbrow" style="opacity:${open || got ? 1 : 0.5}"><span>${hid ? '🔮 ???' : (open ? '🌊 ' : '🔒 ') + UI.esc(p.name)}</span><span>${got}/${list.length}</span></div>`; }).join('');
  renderRooms(); api('/api/leaderboard').then(lb => { $('lb').innerHTML = lb.heaviest.length ? lb.heaviest.slice(0, 6).map((x, i) => `<div class="lbrow"><span>${i + 1}. ${UI.esc(x.name)}</span><span>${S.fmtKg(x.v)} ${UI.esc(SP[x.sp]?.name || '')}</span></div>`).join('') : 'Nog niemand heeft gevangen. Wees de eerste!'; }).catch(() => { });
}
document.querySelectorAll('[data-pn]').forEach(b => b.addEventListener('click', () => openPanel(b.dataset.pn)));

/* ------------------------------------------------------------------ three.js opzetten */
function initThree() {
  const q = G.quality = G.settings.q;
  renderer = new THREE.WebGLRenderer({ canvas: $('cv'), antialias: q >= 2, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, q === 0 ? 1 : q === 1 ? 1.5 : 2)); renderer.outputColorSpace = THREE.SRGBColorSpace;
  scene = new THREE.Scene(); camera = new THREE.PerspectiveCamera(65, 1, 0.1, 1600); clock = new THREE.Clock();
  const rs = () => { renderer.setSize(innerWidth, innerHeight, false); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); }; addEventListener('resize', rs); rs();
  world = new World(scene, q);
  world.build(msg => { $('bootmsg').textContent = msg; });
  minimapImg = world.minimap();
  // reigers en eenden
  for (const p of PONDS) {
    const h = M.makeHeron(); h.visible = false; h.userData.pond = p.id; h.userData.fly = 0; h.userData.x = 0; h.userData.z = 0; scene.add(h); G.herons[p.id] = h;
    for (let i = 0; i < 3; i++) { const d = M.makeDuck(); const pos = randWater(p); d.position.set(pos.x, p.waterY, pos.z); d.userData = { pond: p.id, h: Math.random() * 6.28, t: 0 }; scene.add(d); G.ducks.push(d); }
  }
  // rimpelingen
  const rg = new THREE.RingGeometry(0.4, 0.5, 24); rg.rotateX(-Math.PI / 2);
  for (let i = 0; i < 24; i++) { const m = new THREE.Mesh(rg, new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, depthWrite: false })); m.visible = false; m.renderOrder = 3; scene.add(m); fx.push({ m, age: 9, big: 0 }); }
}
function randWater(p) { for (let i = 0; i < 40; i++) { const a = Math.random() * 6.28, d = Math.sqrt(Math.random()) * p.r * 0.9, x = p.x + Math.cos(a) * d, z = p.z + Math.sin(a) * d; if (S.pondWater(x, z) === p.id && !S.onJetty(x, z)) return { x, z }; } return { x: p.x, z: p.z }; }
function ripple(x, z, big, y) { const f = fx.find(f => f.age > 2) || fx[0]; const pw = S.pondWater(x, z); f.age = 0; f.big = big; f.m.position.set(x, y ?? (pw >= 0 ? PONDS[pw].waterY + 0.06 : S.heightAt(x, z) + 0.05), z); f.m.visible = true; }

/* ------------------------------------------------------------------ spelers */
function addPlayer(info) {
  let E = G.players.get(info.id);
  if (!E) {
    const isMe = info.id === G.id, h = M.makeHuman(info.look, RODS[info.rod]?.color);
    E = { id: info.id, isMe, h, x: isMe ? me.x : S.SPAWN.x, z: isMe ? me.z : S.SPAWN.z, ry: 0, tx: 0, tz: 0, try: 0, mountN: 0, fs: 0, bx: 0, bz: 0, D: 0, pond: -1, speed: 0, veh: null, dogM: null, dogPos: null, bobber: M.makeBobber(), line: null, ripT: 0, first: true, bub: null, bubT: 0, info: {} };
    const lg = new THREE.BufferGeometry().setFromPoints(Array.from({ length: 16 }, () => new THREE.Vector3())); E.line = new THREE.Line(lg, new THREE.LineBasicMaterial({ color: '#f4f4f4', transparent: true, opacity: 0.85 }));
    E.line.frustumCulled = false; E.bobber.visible = E.line.visible = false;
    scene.add(h.root, E.bobber, E.line); G.players.set(info.id, E); if (isMe) E_me = E;
  }
  const o = E.info; E.info = info;
  if (!o.name || o.look !== info.look) { /* look verandert alleen in de lobby */ }
  E.h.setName(info.name + (E.isMe ? '' : ` · ${info.lvl}`), E.isMe ? '#8ff0c0' : '#ffffff'); E.h.lab.visible = !E.isMe;
  E.h.setRod(RODS[info.rod]?.color || '#c8a458');
  if (info.dog && !E.dogM) { E.dogM = M.makeDog(info.id % 4, String(info.name).toLowerCase() === 'toon' ? 'ironman' : null); E.dogPos = { x: E.x - 1.5, z: E.z - 1.5 }; scene.add(E.dogM); } else if (!info.dog && E.dogM) { scene.remove(E.dogM); E.dogM = null; }
  if (E.isMe && G.inGame && info.mount) { me.mount = info.mount; }
}
function removePlayer(id) { const E = G.players.get(id); if (!E) return; scene.remove(E.h.root, E.bobber, E.line); if (E.veh) scene.remove(E.veh.mesh); if (E.dogM) scene.remove(E.dogM); G.players.delete(id); }
function chatBubble(id, text) { const E = G.players.get(id); if (!E) return; if (E.bub) E.h.root.remove(E.bub); E.bub = M.label(text.length > 38 ? text.slice(0, 36) + '…' : text, '#ffffe0', 22); E.bub.scale.set(4.4, 1.1, 1); E.bub.position.y = 3.05; E.h.root.add(E.bub); E.bubT = 6; }
function onSnapshot(ps) {
  const seen = new Set();
  for (const [id, x, z, ry, mt, fs, bx, bz, D] of ps) {
    seen.add(id); const E = G.players.get(id); if (!E) continue;
    if (E.fs !== fs || E.bx !== bx || E.bz !== bz) { E.fs = fs; E.bx = bx; E.bz = bz; if (fs) { const pw = S.pondWater(bx, bz); E.pond = pw; } if (E.isMe) onMyFishState(fs); }
    E.D = D; E.mountN = mt;
    if (!E.isMe) { if (E.first) { E.x = x; E.z = z; E.ry = ry; E.first = false; } E.tx = x; E.tz = z; E.try = ry; }
  }
}
function onMyFishState(fs) {
  const prev = me.fs; me.fs = fs;
  if (fs === 2 && prev !== 2) { A.sfx.bite(); setStatus('AANSLAAN!', 'bite', 4000); G.shake = 0.15; }
  if (fs === 1 && prev === 0) { A.sfx.cast(); }
  if (fs === 0) { G.fight = null; $('fightUI').classList.add('hidden'); if (prev === 3 || prev === 2) setStatus('', ''); }
  if (fs === 3) { $('fightUI').classList.remove('hidden'); setStatus('', ''); }
  if (fs === 1) setStatus('Wachten op een beet...', '', 0, true);
}
function setStatus(t, cls, ms = 0, sticky = false) { const s = $('status'); s.textContent = t; s.className = cls || ''; G.statusUntil = ms ? performance.now() + ms : 0; s.dataset.sticky = sticky ? '1' : ''; }

/* ------------------------------------------------------------------ vissen in de vijver */
function onFish(ponds) {
  const seen = new Set();
  for (const [pid, hx, hz, list] of ponds) {
    const hr = G.herons[pid]; if (hr) { hr.userData.x = hx; hr.userData.z = hz; if (!hr.visible && !hr.userData.fly) { hr.position.set(hx, S.heightAt(hx, hz), hz); hr.visible = true; } }
    for (const [id, spi, x, z, h, w, hot] of list) {
      seen.add(id); let f = G.fish.get(id);
      if (!f) {
        const sp = SPECIES[spi], mesh = M.makeFish(sp, sp.leg ? '#ffd84a' : null), L = clamp(0.3 * Math.cbrt(w) + 0.08, 0.14, 2.6) * (sp.shape === 'paling' ? 1.15 : 1);
        mesh.scale.setScalar(L); scene.add(mesh); f = { id, sp, mesh, x, z, h, w, pond: pid, depth: 0.45 + ((id * 37) % 100) / 100 * 1.1 + L * 0.25, L, tx: x, tz: z, th: h, hot, t: Math.random() * 6 }; mesh.position.set(x, 0, z); G.fish.set(id, f);
      }
      f.tx = x; f.tz = z; f.th = h; f.hot = hot;
    }
  }
  for (const [id, f] of G.fish) if (!seen.has(id)) { scene.remove(f.mesh); G.fish.delete(id); }
}
function updateFish(dt) {
  const cp = camera.position;
  for (const f of G.fish.values()) {
    f.x += (f.tx - f.x) * Math.min(1, dt * 5); f.z += (f.tz - f.z) * Math.min(1, dt * 5); f.h += angDiff(f.h, f.th) * Math.min(1, dt * 6);
    const dx = f.x - cp.x, dz = f.z - cp.z, near = dx * dx + dz * dz < 70 * 70; f.mesh.visible = near; if (!near) continue;
    const p = PONDS[f.pond], gy = S.heightAt(f.x, f.z), y = Math.max(gy + 0.12 + f.L * 0.1, p.waterY - f.depth); f.t += dt * (f.hot ? 14 : 5 + f.L);
    f.mesh.position.set(f.x, y, f.z); f.mesh.rotation.y = -f.h; f.mesh.userData.tail.rotation.y = Math.sin(f.t) * 0.5; f.mesh.children[0].rotation.y = Math.sin(f.t) * 0.08;
    if (f.sp.leg) f.mesh.rotation.z = Math.sin(f.t * 0.3) * 0.04;
  }
}

/* ------------------------------------------------------------------ bewegen */
const mountSpeed = () => me.mount === 'bike' ? 11 : me.mount === 'scooter' ? 16 : me.mount === 'boat' ? 6.5 : (me.run ? 8.5 : 5);
function locked(x, z) { for (const p of S.ZONE_PONDS) if (!G.save.unlocked.includes(p.id) && Math.hypot(x - p.x, z - p.z) < p.zr) return true; return false; }
function canStand(x, z) { return x > S.WORLD.minX && x < S.WORLD.maxX && z > S.WORLD.minZ && z < S.WORLD.maxZ && S.walkable(x, z, me.mount === 'boat') && !locked(x, z); }
const move = { x: 0, z: 0 };
function readInput() {
  let mx = 0, mz = 0; const k = G.keys;
  if (k.has('KeyW') || k.has('ArrowUp')) mz += 1; if (k.has('KeyS') || k.has('ArrowDown')) mz -= 1; if (k.has('KeyA') || k.has('ArrowLeft')) mx -= 1; if (k.has('KeyD') || k.has('ArrowRight')) mx += 1;
  mx += stick.x; mz += -stick.y; const gp = pad(); if (gp) { mx += gp.mx; mz += gp.mz; }
  const l = Math.hypot(mx, mz); if (l > 1) { mx /= l; mz /= l; } move.x = mx; move.z = mz;
  me.run = k.has('ShiftLeft') || k.has('ShiftRight') || Math.hypot(stick.x, stick.y) > 0.85;
}
function updateMe(dt) {
  if (G.panel || G.photo || G.chatOpen) { move.x = move.z = 0; }
  else readInput();
  const fwd = new THREE.Vector2(Math.sin(me.yaw), Math.cos(me.yaw)), right = new THREE.Vector2(-Math.cos(me.yaw), Math.sin(me.yaw));
  const dx = right.x * move.x + fwd.x * move.z, dz = right.y * move.x + fwd.y * move.z, len = Math.hypot(dx, dz);
  let sp = mountSpeed(); if (me.fs === 3) sp = 0; else if (me.fs) sp *= 0.5; if (G.catchCard) sp *= 0.6;
  if (len > 0.01) {
    const vx = dx / Math.max(1, len) * sp * dt, vz = dz / Math.max(1, len) * sp * dt, nx = me.x + vx, nz = me.z + vz;
    if (canStand(nx, nz)) { me.x = nx; me.z = nz; } else if (canStand(nx, me.z)) me.x = nx; else if (canStand(me.x, nz)) me.z = nz;
    me.speed = sp * Math.min(1, len);
    if (!me.fs && !G.actHeld) { const ta = Math.atan2(dx, dz); me.ry += angDiff(me.ry, ta) * Math.min(1, dt * 12); }
  } else me.speed = 0;
  if (me.fs || G.actHeld || G.catchCard) me.ry += angDiff(me.ry, me.yaw) * Math.min(1, dt * 14);
  if (!canStand(me.x, me.z)) { const f = S.findNear(me.x, me.z, canStand, 10); if (f) { me.x = f.x; me.z = f.z; } }
  const now = performance.now();
  if (now - G.lastPosSent > 100 && (Math.hypot(me.x - G.lastSentX, me.z - G.lastSentZ) > 0.02 || now - G.lastPosSent > 600)) { send({ t: 'pos', x: +me.x.toFixed(2), z: +me.z.toFixed(2), ry: +me.ry.toFixed(2) }); G.lastPosSent = now; G.lastSentX = me.x; G.lastSentZ = me.z; }
}

/* ------------------------------------------------------------------ camera en richten */
const aimDir = new THREE.Vector3();
function updateCamera(dt) {
  const E = E_me; if (!E) return;
  const ty = E.y + 1.55, shoulder = 0.55, fwd = new THREE.Vector3(Math.sin(me.yaw) * Math.cos(me.pitch), Math.sin(me.pitch), Math.cos(me.yaw) * Math.cos(me.pitch)), right = new THREE.Vector3(-Math.cos(me.yaw), 0, Math.sin(me.yaw));
  const dist = G.photo ? me.dist * 1.2 : me.dist * (me.fs ? 0.85 : 1);
  const tgt = new THREE.Vector3(E.x, ty, E.z).addScaledVector(right, G.photo ? 0 : -shoulder);
  let want = tgt.clone().addScaledVector(fwd, -dist);
  if (!G.photo && world) { const k = world.treeBlock(tgt.x, tgt.y, tgt.z, want.x, want.y, want.z); if (k < 1) want = tgt.clone().lerp(want, k); }
  const gy = S.groundY(want.x, want.z); if (want.y < gy + 0.5) want.y = gy + 0.5;
  const wy = S.pondWater(want.x, want.z); if (wy >= 0 && want.y < PONDS[wy].waterY + 0.4) want.y = PONDS[wy].waterY + 0.4;
  camera.position.lerp(want, 1 - Math.exp(-dt * 18)); if (G.shake > 0) { camera.position.x += (Math.random() - 0.5) * G.shake; camera.position.y += (Math.random() - 0.5) * G.shake; G.shake = Math.max(0, G.shake - dt * 0.6); }
  camera.lookAt(camera.position.clone().add(fwd)); aimDir.copy(fwd);
}
function computeAim() {
  const rs = S.rodStats(G.save), E = E_me; let best = null;
  if (aimDir.y < -0.015) {
    for (const p of PONDS) {
      const t = (p.waterY - camera.position.y) / aimDir.y; if (t < 0 || t > 200) continue;
      let hx = camera.position.x + aimDir.x * t, hz = camera.position.z + aimDir.z * t; const d = Math.hypot(hx - E.x, hz - E.z);
      if (d > rs.cast) { hx = E.x + (hx - E.x) * rs.cast / d; hz = E.z + (hz - E.z) * rs.cast / d; }
      if (S.pondWater(hx, hz) === p.id && Math.hypot(hx - E.x, hz - E.z) >= 2) { best = { x: hx, z: hz, p, d: Math.hypot(hx - E.x, hz - E.z) }; break; }
    }
  }
  G.aim = best; const r = $('reticle'); r.className = me.fs ? '' : best ? 'ok' : 'bad';
}

/* ------------------------------------------------------------------ vissen: knoppen */
function actDown() {
  if (G.panel || G.photo || G.chatOpen) return; A.unlock(); G.actHeld = true;
  if (G.catchCard) return;
  if (me.fs === 0) {
    if (me.mount === 'bike' || me.mount === 'scooter') return toast('Stap eerst van je voertuig af (V).', 'warn');
    const bc = G.save.baits[G.save.bait] | 0;
    if (!bc) return toast(`Geen ${BAIT[G.save.bait].name.toLowerCase()} meer! Kies ander aas of koop nieuw in de winkel.`, 'warn');
    if (!G.aim) return toast('Richt op het water (kijk wat meer omlaag).', 'warn');
    send({ t: 'cast', x: +G.aim.x.toFixed(2), z: +G.aim.z.toFixed(2) }); A.sfx.cast();
  } else if (me.fs === 2) send({ t: 'hook' });
}
function actUp() { G.actHeld = false; }
function cancelLine() { if (me.fs) send({ t: 'cancel' }); }
function syncReel() { const want = me.fs === 3 && (G.actHeld || G.keys.has('Space')); if (want !== G.reelSent) { G.reelSent = want; send({ t: 'reel', on: want }); } }

/* ------------------------------------------------------------------ huizen */
function setHouse(info) {
  const slot = S.HOUSE_SLOTS[info.s]; if (!slot) return;
  let h = G.houses.get(info.s);
  if (!h) { const H = M.makeHouse(info.s); H.root.position.set(slot.x, S.heightAt(slot.x, slot.z), slot.z); scene.add(H.root); h = { H, info }; G.houses.set(info.s, h); }
  h.info = info; h.H.setOwner(info.n); h.H.setFish(info.sp.map(x => SP[x[0]]).filter(Boolean));
  updateBasket(h);
}
function houseOf(E) {      // het huis van deze speler, als hij er (bijna) binnen staat
  const nm = E.info && E.info.name; if (!nm) return null;
  for (const h of G.houses.values()) if (h.info.n === nm) { const s = S.HOUSE_SLOTS[h.info.s]; if (Math.abs(E.x - s.x) < S.HOUSE_W / 2 + 1.2 && Math.abs(E.z - s.z) < S.HOUSE_D / 2 + 1.2) return s; }
  return null;
}
function updateBasket(h) { const online = [...G.players.values()].some(p => p.info && p.info.name === h.info.n); h.H.bdog.visible = !!h.info.d && !online; }
let houseT = 0;
function updateHouses(dt) {
  houseT -= dt; const slow = houseT <= 0; if (slow) houseT = 1;
  for (const h of G.houses.values()) {
    const slot = S.HOUSE_SLOTS[h.info.s], d = Math.hypot(camera.position.x - slot.x, camera.position.z - slot.z);
    h.H.root.visible = d < 260; if (d < 40) h.H.update(dt);
    if (slow) updateBasket(h);
  }
}
function nearHouseAq() {
  let best = null, bd = 4.2;
  for (const h of G.houses.values()) { const s = S.HOUSE_SLOTS[h.info.s], ax = s.x, az = s.z + S.HOUSE_D / 2 - 1.6, d = Math.hypot(me.x - ax, me.z - az); if (d < bd) { bd = d; best = h; } }
  return best;
}

/* ------------------------------------------------------------------ vangst */
function onCatch(m) {
  const sp = SP[m.fish.sp], card = $('catchCard'); G.catchCard = { fid: m.fid, fish: m.fish, until: performance.now() + m.ms, ms: m.ms }; G.actHeld = false;
  setStatus('', ''); $('fightUI').classList.add('hidden');
  card.style.borderColor = RARITY[sp.rar].c;
  card.innerHTML = `<div class="rar" style="color:${RARITY[sp.rar].c}">${RARITY[sp.rar].n}</div><img src="${UI.fishImg(sp.id)}"><h2>${UI.esc(sp.name)}</h2><div style="font-size:22px;font-weight:800">${S.fmtKg(m.fish.w)}</div>
  <div class="note">${m.rec ? '<span class="rec">★ Nieuw record! </span>' : ''}Waarde ca. 🪙 ${S.fishValue(sp, m.fish.w)} · +${m.xp} xp</div>${m.heron ? '<div style="color:#ff8a7a;font-weight:800;margin-top:6px">🐦 Een reiger loert! Kies snel!</div>' : ''}
  <div class="row"><button class="pri" id="ccKeep">Behouden (F)</button><button id="ccRel">Terugzetten (G)</button></div><div class="row" style="margin-top:6px"><button id="ccPhoto">📸 Foto</button></div><div class="timer"><i id="ccTimer"></i></div>`;
  card.classList.remove('hidden');
  if (!isTouch) try { document.exitPointerLock(); } catch { }   // muis vrij om op de knoppen te klikken
  $('ccKeep').onclick = () => decideCatch(true); $('ccRel').onclick = () => decideCatch(false); $('ccPhoto').onclick = () => takePhoto(G.catchCard);
  if (sp.leg) { A.sfx.legend(); bigMsg(`✨ ${sp.name}!`); } else A.sfx.catch(sp.rar);
  G.shake = 0;
}
function decideCatch(keep) { const c = G.catchCard; if (!c) return; send({ t: keep ? 'keep' : 'release', fid: c.fid }); G.catchCard = null; $('catchCard').classList.add('hidden');
  if (!isTouch && !G.panel && !G.photo) try { cv.requestPointerLock?.(); } catch { }   // muis weer vastzetten voor het vissen
}
function onLost(m) { G.fight = null; $('fightUI').classList.add('hidden'); setStatus(m.msg, '', 3500); if (m.snap) { A.sfx.snap(); G.shake = 0.3; } else A.sfx.warn(); }
function updateFightUI() {
  const f = G.fight; if (!f) return; const sp = SPECIES[f.fid];
  $('tbar').firstElementChild.style.width = Math.min(100, f.T) + '%'; $('dbar').firstElementChild.style.width = (100 - f.D) + '%';
  const msg = $('fightmsg'); msg.className = f.ph; msg.textContent = f.ph === 'run' ? '⚠ HIJ TREKT! LAAT LOS!' : f.ph === 'warn' ? '❗ Hij gaat trekken...' : G.actHeld || G.keys.has('Space') ? 'Inhalen...' : 'Houd ingedrukt om in te halen';
  $('fishinfo').textContent = RARITY[sp.rar].n; $('stam').textContent = 'Vermoeidheid ' + (100 - f.st) + '%';
  if (f.ph === 'run' && G.reelSent && f.T > 70) { G.shake = 0.06; if (Math.random() < 0.3) A.sfx.warn(); }
  if (G.reelSent && f.ph !== 'run' && Math.random() < 0.5) A.sfx.reel();
}

/* ------------------------------------------------------------------ gebeurtenissen */
function onEvent(m) {
  if (m.k === 'splash') { const d = Math.hypot(m.x - me.x, m.z - me.z); ripple(m.x, m.z, m.big); A.sfx.splash(m.big, d); }
  else if (m.k === 'heron') { const h = G.herons[m.pond]; if (h) { h.userData.fly = 3; A.sfx.heron(); } }
  else if (m.k === 'eat') { if (m.id === G.id) A.sfx.eat(); }
}

/* ------------------------------------------------------------------ voertuigen en interactie */
function toggleVehicle() {
  if (me.fs) return toast('Haal eerst je lijn binnen (X).', 'warn');
  const s = G.save; const order = ['walk', 'bike', 'scooter'].filter(m => m === 'walk' || s.mounts[m]);
  if (order.length === 1) return toast('Je hebt nog geen fiets of scooter. Die koop je bij de Hengelwinkel.', 'warn');
  if (me.mount === 'boat') return toast('Stap eerst uit de boot (B).', 'warn');
  const i = order.indexOf(me.mount); send({ t: 'mount', m: order[(i + 1) % order.length] });
}
function toggleBoat() { if (me.mount === 'boat') send({ t: 'mount', m: 'walk' }); else send({ t: 'mount', m: 'boat' }); }
function cycleBait(d) { const list = BAITS.filter(b => (G.save.baits[b.id] | 0) > 0 || b.id === G.save.bait); const i = list.findIndex(b => b.id === G.save.bait); const n = list[(i + d + list.length) % list.length]; send({ t: 'bait', id: n.id }); G.save.baits[n.id] |= 0; G.save.bait = n.id; updateHotbar(); }
function findInteract() {
  let best = null, bd = 1e9; const x = me.x, z = me.z, cons = (kind, o, r, text) => { const d = Math.hypot(o.x - x, o.z - z); if (d < r && d < bd) { bd = d; best = { kind, o, text }; } };
  for (const sh of S.SHOPS) cons('shop', sh, S.SHOP_RANGE, '🛒 ' + sh.name);
  for (const c of S.CAMPFIRES) cons('fire', c, 7, '🔥 Kampvuur · vis bakken voor een bonus');
  cons('board', { x: 10, z: 22 }, 6, '📌 Prikbord · wedstrijden en geruchten');
  for (const g of S.GATES) cons('gate', g, 12, `🚧 Hek: ${PONDS[g.pond].name}`);
  if (G.merchant) cons('travel', G.merchant, 9, '🧳 Reizende verkoper');
  const aq = nearHouseAq(); if (aq && bd > 3) { best = { kind: 'aq', o: aq, text: `🐠 Aquarium van ${aq.info.n}${aq.info.d ? ' · 🐕 ' + aq.info.d : ''}` }; }
  return best;
}
function interact() {
  const it = G.interact; if (!it) return; A.sfx.ui();
  if (it.kind === 'shop') openPanel('shop', { shop: it.o, tab: UI.shopTabs(it.o)[0] });
  else if (it.kind === 'fire') openPanel('bag'); else if (it.kind === 'board') openPanel('board'); else if (it.kind === 'gate') openPanel('quests');
  else if (it.kind === 'aq') openPanel('aq', { slot: it.o.info.s });
  else if (it.kind === 'travel') openPanel('shop', { shop: { type: 'travel', name: 'Reizende verkoper', ...G.merchant }, tab: 'Aanbod', items: G.merchant.items });
}

/* ------------------------------------------------------------------ panelen */
const TITLES = { aq: '🐠 Aquarium', shop: '🛒 Winkel', bag: '🎒 Tas', book: '📖 Visboek', quests: '📋 Opdrachten', talents: '⭐ Talenten', ach: '🏅 Prestaties', map: '🗺️ Kaart', players: '👥 Spelers en handel', settings: '☰ Menu', board: '📌 Prikbord', help: '❓ Besturing' };
function openPanel(name, arg) {
  try { document.exitPointerLock(); } catch { }
  G.panel = { name, arg: arg || {} }; G.keys.clear(); G.actHeld = false; $('panelTitle').textContent = TITLES[name] || ''; $('panel').classList.remove('hidden'); renderPanel();
}
function closePanel() { G.panel = null; $('panel').classList.add('hidden'); }
function renderPanel() {
  const P = G.panel; if (!P) return; const s = G.save, body = $('panelBody'), top = body.scrollTop;
  const others = [...G.players.values()].filter(e => !e.isMe).map(e => ({ id: e.id, name: e.info.name, lvl: e.info.lvl, dog: e.info.dog, dist: Math.hypot(e.x - me.x, e.z - me.z) }));
  switch (P.name) {
    case 'shop': body.innerHTML = UI.shopHTML(s, P.arg.shop, P.arg.tab, P.arg); break;
    case 'bag': body.innerHTML = UI.bagHTML(s, {}); break;
    case 'book': body.innerHTML = UI.bookHTML(s); break;
    case 'quests': body.innerHTML = UI.questsHTML(s); break;
    case 'talents': body.innerHTML = UI.talentsHTML(s); break;
    case 'ach': body.innerHTML = UI.achHTML(s); break;
    case 'aq': { const h = G.houses.get(P.arg.slot); body.innerHTML = h ? UI.aqHTML(h.info) : '<div class="note">Dit huis is leeg.</div>'; break; }
    case 'players': body.innerHTML = UI.playersHTML(s, { others, fid: P.arg.fid }); break;
    case 'board': body.innerHTML = UI.boardHTML(s, { contest: G.contest, weekend: G.weekend }); api('/api/leaderboard').then(lb => { const e = $('lbBoard'); if (e) e.innerHTML = UI.lbHTML(lb); }).catch(() => { }); break;
    case 'settings': body.innerHTML = UI.settingsHTML(G.settings); break;
    case 'help': body.innerHTML = UI.helpHTML(); break;
    case 'map': body.innerHTML = '<canvas id="mapcv" width="560" height="660"></canvas><div class="note" style="margin-top:6px">🏠 winkel · 🔥 kampvuur · 🔒 gesloten vijver · 🧳 reizende verkoper · jij = groene pijl</div>'; drawFullMap(); break;
  }
  body.scrollTop = top;
}
$('panelClose').onclick = closePanel;
$('panel').addEventListener('mousedown', e => { if (e.target === $('panel')) closePanel(); });
$('panelBody').addEventListener('click', e => {
  const el = e.target.closest('[data-act]'); if (!el) return; const d = el.dataset, P = G.panel; A.sfx.ui();
  switch (d.act) {
    case 'shoptab': P.arg.tab = d.v; renderPanel(); break;
    case 'buy': send({ t: 'buy', item: d.item, qty: 1 }); break;
    case 'sell': send({ t: 'sell', ids: [+d.id] }); break; case 'sellall': send({ t: 'sell', all: true }); break;
    case 'equip': send({ t: 'equip', rod: +d.rod }); break;
    case 'bait': send({ t: 'bait', id: d.id }); G.save.bait = d.id; renderPanel(); updateHotbar(); break;
    case 'cook': send({ t: 'cook', id: +d.id }); break;
    case 'talent': send({ t: 'talent', id: d.id }); break; case 'retalent': send({ t: 'retalent' }); break;
    case 'offerform': openPanel('players', { fid: +d.id }); break;
    case 'offer': { const to = +$('tradeTo').value, fid = +$('tradeFish').value, price = +$('tradePrice').value | 0; send({ t: 'offer', to, fid, price }); break; }
    case 'contest': send({ t: 'contest' }); break;
    case 'help': openPanel('help'); break; case 'photo': closePanel(); startPhoto(); break;
    case 'home': closePanel(); send({ t: 'home' }); break; case 'leave': closePanel(); send({ t: 'leave' }); break; case 'close': closePanel(); break;
  }
});
$('panelBody').addEventListener('input', e => {
  if (e.target.id === 'setVol') { G.settings.vol = +e.target.value; store.set('vol', G.settings.vol); A.setVolume(G.settings.vol / 100); }
  if (e.target.id === 'setSens') { G.settings.sens = +e.target.value; store.set('sens', G.settings.sens); }
  if (e.target.id === 'setQ') { store.set('q', +e.target.value); toast('Graphics worden gewijzigd na het herladen van de pagina.', 'info'); }
});
function drawFullMap() {
  const cv = $('mapcv'); if (!cv) return; const x = cv.getContext('2d'), W = S.WORLD, sx = cv.width / (W.maxX - W.minX), sz = cv.height / (W.maxZ - W.minZ), m = (wx, wz) => [(wx - W.minX) * sx, (wz - W.minZ) * sz];
  x.imageSmoothingEnabled = true; x.drawImage(minimapImg, 0, 0, cv.width, cv.height);
  x.textAlign = 'center'; x.font = 'bold 13px system-ui'; x.lineWidth = 4;
  const lab = (t, px, py, col = '#fff') => { x.strokeStyle = 'rgba(0,0,0,.7)'; x.strokeText(t, px, py); x.fillStyle = col; x.fillText(t, px, py); };
  for (const p of PONDS) { const [px, py] = m(p.x, p.z); const hid = p.secret && !G.save.disc.includes(p.id), lk = p.req && !G.save.unlocked.includes(p.id); if (hid) continue; lab((lk ? '🔒 ' : '') + p.name, px, py - 4, lk ? '#ffb0a0' : '#fff'); }
  for (const sh of S.SHOPS) { if (sh.type === 'kiosk' && sh.pond > 0 && !(G.save.unlocked.includes(sh.pond) || (PONDS[sh.pond].secret && G.save.disc.includes(sh.pond)))) continue; const [px, py] = m(sh.x, sh.z); lab(sh.type === 'kiosk' ? '🏠' : '🛒', px, py + 5); }
  for (const c of S.CAMPFIRES) { if (c.pond > 0 && !(G.save.unlocked.includes(c.pond) || G.save.disc.includes(c.pond))) continue; const [px, py] = m(c.x, c.z); lab('🔥', px, py + 5); }
  if (G.merchant) { const [px, py] = m(G.merchant.x, G.merchant.z); lab('🧳', px, py + 5, '#e8a0ff'); }
  for (const e of G.players.values()) { const [px, py] = m(e.x, e.z); x.fillStyle = e.isMe ? '#6fe08a' : '#fff'; x.beginPath(); x.arc(px, py, e.isMe ? 6 : 4, 0, 7); x.fill(); if (!e.isMe) lab(e.info.name, px, py - 8); }
}

/* ------------------------------------------------------------------ ruilen */
function showOffer(m) {
  const o = $('offer'), sp = SP[m.fish.sp]; G.offer = m.oid;
  o.innerHTML = `<b>${UI.esc(m.from)}</b> biedt je een <b style="color:${RARITY[sp.rar].c}">${UI.esc(sp.name)}</b> (${S.fmtKg(m.fish.w)}) aan voor ${m.price ? '<b class="price">🪙 ' + m.price + '</b>' : '<b>niks (cadeau)</b>'}.<div class="row" style="margin-top:8px"><button class="pri" id="ofY">Accepteren</button><button id="ofN">Nee</button></div>`; o.classList.remove('hidden');
  const done = ok => { send({ t: 'offerReply', oid: m.oid, ok }); o.classList.add('hidden'); }; $('ofY').onclick = () => done(true); $('ofN').onclick = () => done(false); setTimeout(() => { if (G.offer === m.oid) o.classList.add('hidden'); }, 30000);
}

/* ------------------------------------------------------------------ HUD */
function toast(msg, kind = 'info') { const d = document.createElement('div'); d.className = 'toast ' + kind; d.textContent = msg; const t = $('toasts'); t.appendChild(d); while (t.children.length > 4) t.firstChild.remove(); setTimeout(() => d.remove(), 4800); }
function bigMsg(t) { const b = $('bigmsg'); b.textContent = t; b.classList.remove('hidden'); clearTimeout(bigMsg.t); bigMsg.t = setTimeout(() => b.classList.add('hidden'), 3200); }
function feed(msg, kind = 'info', html = false) { const f = $('feed'), d = document.createElement('div'); d.className = kind; if (html) d.innerHTML = msg; else d.textContent = msg; f.appendChild(d); while (f.children.length > 7) f.firstChild.remove(); setTimeout(() => { d.style.opacity = 0; setTimeout(() => d.remove(), 1000); }, 14000); }
function onSave() { world && world.setUnlocked(G.save.unlocked); if (G.panel) renderPanel(); if (G.inGame) { updateHUD(); updateHotbar(); } else if (!$('lobby').classList.contains('hidden')) refreshLobby(); }
function updateHotbar() {
  const s = G.save, hb = $('hotbar'); if (!s) return; const rs = S.rodStats(s), now = Date.now();
  const baits = BAITS.filter(b => (s.baits[b.id] | 0) > 0 || b.id === s.bait);
  hb.innerHTML = `<div id="rodbox"><b style="color:${rs.rod.color}">🎣 ${rs.rod.name}</b><span class="note">slijtage ${Math.round(rs.dur)}% · ${s.dog ? '🐕 ' + UI.esc(s.dog.name) : ''}</span></div>` +
    baits.map((b, i) => `<div class="slot ${b.id === s.bait ? 'sel' : ''} ${(s.baits[b.id] | 0) ? '' : 'empty'}" data-bait="${b.id}"><span class="k">${i + 1}</span><span class="ic">${b.icon}</span><span>${b.name}</span><span class="n">${s.baits[b.id] | 0}</span></div>`).join('') +
    Object.keys(S.BUFFS).filter(k => (s.buffs[k] || 0) > now).map(k => `<div class="slot" title="${S.BUFFS[k].desc}"><span class="ic">${S.BUFFS[k].icon}</span><span class="n">${Math.ceil((s.buffs[k] - now) / 60000)} min</span></div>`).join('');
  hb.querySelectorAll('[data-bait]').forEach(e => e.onclick = () => { send({ t: 'bait', id: e.dataset.bait }); s.bait = e.dataset.bait; updateHotbar(); });
  $('tbBait').textContent = BAIT[s.bait].icon; $('tbVeh').textContent = me.mount === 'scooter' ? '🛵' : '🚲'; $('tbBoat').textContent = me.mount === 'boat' ? '🚶' : '🛶';
}
function updateHUD() {
  const s = G.save; if (!s) return; const li = { cur: 0, need: 0 }; let xp = s.xp, l = 1; while (l < s.lvl) { xp -= S.levelNeed(l); l++; } const need = s.lvl >= S.MAX_LEVEL ? 1 : S.levelNeed(s.lvl);
  $('coins').textContent = '🪙 ' + s.coins; $('lvl').textContent = 'Niv. ' + s.lvl; $('repv').textContent = s.rep ? `★ ${s.rep}` : ''; $('xpbar').style.width = clamp(s.lvl >= S.MAX_LEVEL ? 100 : xp / need * 100, 0, 100) + '%';
  $('quests').innerHTML = '<b>📋 Opdrachten</b>' + s.daily.q.map(q => `<div class="q ${q.done ? 'done' : ''}">${UI.esc(S.QUEST_KINDS[q.kind].text(q.n, q.sp))} <span class="note">${q.p}/${q.n}</span></div>`).join('');
  const sonar = s.upg.sonar > 0; $('sonar').classList.toggle('hidden', !sonar);
}
function updateContest() {
  const c = G.contest, el = $('contest'); if (!c) { el.classList.add('hidden'); return; } el.classList.remove('hidden'); G.contestAt = performance.now();
  const left = c.left; el.innerHTML = `<b>🏆 Wedstrijd ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}</b>${c.weekend ? ' <span class="tag">×2</span>' : ''}` + (c.top.length ? c.top.slice(0, 3).map((t, i) => `<div>${i + 1}. ${UI.esc(t.name)} · ${S.fmtKg(t.w)}</div>`).join('') : '<div class="note">Vang de zwaarste vis!</div>');
}
function drawMini() {
  const cv = $('mini'), x = cv.getContext('2d'), R = cv.width / 2, scale = 0.75, step = world.grid.step, W = S.WORLD, φ = me.yaw, c = Math.cos(φ), s = Math.sin(φ);
  x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, cv.width, cv.height); x.save(); x.beginPath(); x.arc(R, R, R - 2, 0, 7); x.clip(); x.fillStyle = '#1a3a4a'; x.fillRect(0, 0, cv.width, cv.height);
  const A_ = -c * scale, B_ = s * scale, C_ = -s * scale, D_ = -c * scale, pxp = me.x, pzp = me.z, E = R - (A_ * pxp + B_ * pzp), F = R - (C_ * pxp + D_ * pzp);
  x.setTransform(A_ * step, C_ * step, B_ * step, D_ * step, A_ * W.minX + B_ * W.minZ + E, C_ * W.minX + D_ * W.minZ + F); x.imageSmoothingEnabled = true; x.drawImage(minimapImg, 0, 0);
  x.setTransform(1, 0, 0, 1, 0, 0); const m2s = (wx, wz) => [A_ * wx + B_ * wz + E, C_ * wx + D_ * wz + F];
  const dot = (wx, wz, col, r) => { const [px, py] = m2s(wx, wz); x.fillStyle = col; x.beginPath(); x.arc(px, py, r, 0, 7); x.fill(); x.strokeStyle = 'rgba(0,0,0,.6)'; x.lineWidth = 1; x.stroke(); };
  for (const sh of S.SHOPS) dot(sh.x, sh.z, sh.type === 'kiosk' ? '#ffd24a' : '#ff8a3a', 4);
  for (const g of S.GATES) dot(g.x, g.z, G.save.unlocked.includes(g.pond) ? '#7ae8a0' : '#ff6a5a', 4);
  if (G.merchant) dot(G.merchant.x, G.merchant.z, '#d08aff', 5);
  for (const e of G.players.values()) if (!e.isMe) dot(e.x, e.z, '#ffffff', 3.5);
  x.restore(); x.fillStyle = '#6fe08a'; x.strokeStyle = '#000'; x.lineWidth = 2; x.beginPath(); x.moveTo(R, R - 9); x.lineTo(R + 6, R + 6); x.lineTo(R, R + 2); x.lineTo(R - 6, R + 6); x.closePath(); x.fill(); x.stroke();
  x.fillStyle = '#fff'; x.font = 'bold 12px system-ui'; x.textAlign = 'center'; const [nx, ny] = [R - Math.sin(φ) * 0 + (-c * 0), 0]; x.fillText('▲', R, 14);
}
function drawSonar() {
  const lvl = G.save.upg.sonar; if (!lvl) return; const cv = $('sonar'), x = cv.getContext('2d'), R = cv.width / 2, range = 28, sc = (R - 4) / range;
  x.clearRect(0, 0, cv.width, cv.height); x.strokeStyle = 'rgba(80,255,180,.35)'; x.lineWidth = 1; for (const r of [R * .33, R * .66, R - 3]) { x.beginPath(); x.arc(R, R, r, 0, 7); x.stroke(); }
  x.beginPath(); x.moveTo(R, 3); x.lineTo(R, R * 2 - 3); x.moveTo(3, R); x.lineTo(R * 2 - 3, R); x.stroke();
  const E = E_me, φ = me.yaw, c = Math.cos(φ), s = Math.sin(φ), ox = me.fs ? E.bx : me.x, oz = me.fs ? E.bz : me.z;
  x.fillStyle = '#fff'; for (const f of G.fish.values()) {
    const dx = f.x - ox, dz = f.z - oz; if (Math.hypot(dx, dz) > range) continue; const px = R + (-dx * c + dz * s) * sc, py = R - (dx * s + dz * c) * sc;
    const col = lvl >= 2 ? RARITY[f.sp.rar].c : '#7affc0'; x.fillStyle = col; x.beginPath(); x.arc(px, py, 2 + Math.cbrt(f.w) * 1.2, 0, 7); x.fill(); if (lvl >= 3) { x.font = '9px system-ui'; x.fillText(f.w >= 10 ? f.w.toFixed(0) : f.w.toFixed(1), px + 4, py - 3); }
  }
  x.fillStyle = '#ff6a5a'; x.beginPath(); x.arc(R, R, 3, 0, 7); x.fill();
}

/* ------------------------------------------------------------------ foto's */
let photoCam = null;
function startPhoto() { G.photo = true; $('hud').querySelectorAll('#tl,#tr,#quests,#feed,#menubar,#hotbar,#touch,#sonar,#reticle,#status').forEach(e => { e.dataset.hid = e.style.display; e.style.display = 'none'; }); $('photoUI').classList.remove('hidden'); G.photoDist = me.dist; me.dist = 6; }
function endPhoto() { G.photo = false; $('hud').querySelectorAll('[data-hid]').forEach(e => { e.style.display = e.dataset.hid; delete e.dataset.hid; }); $('photoUI').classList.add('hidden'); me.dist = G.photoDist || 5.2; if (isTouch) $('touch').classList.remove('hidden'); }
$('photoExit').onclick = endPhoto; $('photoSnap').onclick = () => takePhoto(null);
function takePhoto(c) {
  renderFrame(); const src = renderer.domElement, cv = document.createElement('canvas'); cv.width = src.width; cv.height = src.height; const x = cv.getContext('2d'); x.drawImage(src, 0, 0);
  const w = cv.width, h = cv.height, u = h / 700; x.fillStyle = 'rgba(0,20,28,.55)'; x.fillRect(0, h - 90 * u, w, 90 * u);
  x.fillStyle = '#fff'; x.font = `bold ${30 * u}px system-ui`; x.textAlign = 'left'; const sp = c ? SP[c.fish.sp] : null;
  x.fillText(sp ? `${sp.name} · ${S.fmtKg(c.fish.w)}` : 'Visvrienden', 24 * u, h - 52 * u); x.font = `${20 * u}px system-ui`; x.fillStyle = '#bfe8ee'; x.fillText(`${G.name} · ${PONDS[nearPond()].name} · ${S.clockStr(phase())} · ${new Date().toLocaleDateString('nl-NL')}`, 24 * u, h - 22 * u);
  if (sp) { const img = new Image(); img.onload = () => { x.drawImage(img, w - 260 * u, h - 160 * u, 240 * u, 130 * u); save(); }; img.src = UI.fishImg(sp.id); } else save();
  function save() { const a = document.createElement('a'); a.download = `visvrienden-${Date.now()}.png`; a.href = cv.toDataURL('image/png'); a.click(); toast('📸 Foto opgeslagen!', 'good'); $('flash').style.transition = 'none'; $('flash').style.opacity = .8; requestAnimationFrame(() => { $('flash').style.transition = 'opacity .4s'; $('flash').style.opacity = 0; }); }
}

/* ------------------------------------------------------------------ invoer: toetsenbord, muis, touch, gamepad */
const stick = { x: 0, y: 0 };
let padState = { act: false, use: false, cancel: false, lb: false, rb: false };
function pad() {
  const gp = (navigator.getGamepads && [...navigator.getGamepads()].find(g => g)); if (!gp) return null; const dz = v => Math.abs(v) < 0.18 ? 0 : v;
  const ax = i => dz(gp.axes[i] || 0), b = i => !!gp.buttons[i]?.pressed;
  me.yaw -= ax(2) * 0.04 * (G.settings.sens / 100) * 2; me.pitch = clamp(me.pitch - ax(3) * 0.03 * (G.settings.sens / 100) * 2, -1.2, 0.7);
  const act = b(0) || b(7), use = b(2), cancel = b(1), lb = b(4), rb = b(5);
  if (act && !padState.act) actDown(); if (!act && padState.act) actUp(); if (use && !padState.use) interact(); if (cancel && !padState.cancel) cancelLine(); if (lb && !padState.lb) cycleBait(-1); if (rb && !padState.rb) cycleBait(1);
  padState = { act, use, cancel, lb, rb }; return { mx: ax(0), mz: -ax(1) };
}
addEventListener('keydown', e => {
  if (!G.inGame) return; if (G.chatOpen) { if (e.key === 'Enter') { const t = $('chatin').value.trim(); if (t) send({ t: 'say', text: t }); closeChat(); } else if (e.key === 'Escape') closeChat(); return; }
  if (e.code === 'Escape') { if (G.photo) return endPhoto(); if (G.panel) return closePanel(); openPanel('settings'); return; }
  if (G.panel) { const map = { KeyI: 'bag', KeyJ: 'book', KeyO: 'quests', KeyM: 'map', KeyT: 'talents', KeyH: 'players' }; if (map[e.code] && G.panel.name === map[e.code]) closePanel(); return; }
  if (G.photo) return; A.unlock();
  if (e.code === 'Enter') { e.preventDefault(); openChat(); return; }
  G.keys.add(e.code); if (e.repeat) return;
  switch (e.code) {
    case 'Space': e.preventDefault(); actDown(); break; case 'KeyE': interact(); break; case 'KeyX': cancelLine(); break; case 'KeyB': toggleBoat(); break; case 'KeyV': toggleVehicle(); break;
    case 'KeyZ': send({ t: 'emote', k: 'wave' }); break; case 'KeyN': send({ t: 'emote', k: 'laugh' }); break; case 'KeyK': send({ t: 'emote', k: 'thumb' }); break; case 'KeyL': send({ t: 'emote', k: 'fish' }); break;
    case 'KeyF': decideCatch(true); break; case 'KeyG': decideCatch(false); break; case 'BracketLeft': cycleBait(-1); break; case 'BracketRight': cycleBait(1); break;
    case 'KeyI': openPanel('bag'); break; case 'KeyJ': openPanel('book'); break; case 'KeyO': openPanel('quests'); break; case 'KeyM': openPanel('map'); break; case 'KeyT': openPanel('talents'); break; case 'KeyH': openPanel('players'); break; case 'KeyP': startPhoto(); break;
  }
  if (e.code.startsWith('Digit')) { const i = +e.code.slice(5) - 1, list = BAITS.filter(b => (G.save.baits[b.id] | 0) > 0 || b.id === G.save.bait); if (list[i]) { send({ t: 'bait', id: list[i].id }); G.save.bait = list[i].id; updateHotbar(); } }
});
addEventListener('keyup', e => { G.keys.delete(e.code); if (e.code === 'Space') actUp(); });
addEventListener('blur', () => { G.keys.clear(); G.actHeld = false; });
function openChat() { G.chatOpen = true; G.keys.clear(); $('chatrow').classList.remove('hidden'); $('chatin').value = ''; $('chatin').focus(); }
function closeChat() { G.chatOpen = false; $('chatrow').classList.add('hidden'); $('chatin').blur(); }
const cv = $('cv'); let dragging = false, lastX = 0, lastY = 0;
cv.addEventListener('mousedown', e => {
  if (!G.inGame || G.panel) return; A.unlock();
  if (G.photo) { dragging = true; lastX = e.clientX; lastY = e.clientY; return; }
  if (!document.pointerLockElement && !isTouch) { cv.requestPointerLock?.(); if (e.button === 0) return; }
  if (e.button === 0) actDown(); else if (e.button === 2) { dragging = true; lastX = e.clientX; lastY = e.clientY; }
});
addEventListener('mouseup', e => { if (e.button === 0) actUp(); dragging = false; });
addEventListener('mousemove', e => {
  if (!G.inGame || G.panel) return; const k = 0.0022 * G.settings.sens / 100;
  if (document.pointerLockElement === cv) { me.yaw -= e.movementX * k; me.pitch = clamp(me.pitch - e.movementY * k, -1.2, 0.7); }
  else if (dragging) { me.yaw -= (e.clientX - lastX) * k * 1.4; me.pitch = clamp(me.pitch - (e.clientY - lastY) * k * 1.4, -1.2, 0.7); lastX = e.clientX; lastY = e.clientY; }
});
cv.addEventListener('contextmenu', e => e.preventDefault());
cv.addEventListener('wheel', e => { me.dist = clamp(me.dist + e.deltaY * 0.004, 2.5, 10); }, { passive: true });
// touch
const sEl = $('stick'); let stickId = null, lookId = null, lookX = 0, lookY = 0;
sEl.addEventListener('touchstart', e => { const t = e.changedTouches[0]; stickId = t.identifier; e.preventDefault(); A.unlock(); stickMove(t); }, { passive: false });
sEl.addEventListener('touchmove', e => { for (const t of e.changedTouches) if (t.identifier === stickId) stickMove(t); e.preventDefault(); }, { passive: false });
const stickEnd = e => { for (const t of e.changedTouches) if (t.identifier === stickId) { stickId = null; stick.x = stick.y = 0; sEl.firstElementChild.style.transform = ''; } };
sEl.addEventListener('touchend', stickEnd); sEl.addEventListener('touchcancel', stickEnd);
function stickMove(t) { const r = sEl.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2; let dx = (t.clientX - cx) / (r.width / 2), dy = (t.clientY - cy) / (r.height / 2); const l = Math.hypot(dx, dy); if (l > 1) { dx /= l; dy /= l; } stick.x = dx; stick.y = dy; sEl.firstElementChild.style.transform = `translate(${dx * 38}px,${dy * 38}px)`; }
cv.addEventListener('touchstart', e => { if (G.panel) return; for (const t of e.changedTouches) if (lookId === null) { lookId = t.identifier; lookX = t.clientX; lookY = t.clientY; } A.unlock(); }, { passive: true });
cv.addEventListener('touchmove', e => { for (const t of e.changedTouches) if (t.identifier === lookId) { const k = 0.005 * G.settings.sens / 100; me.yaw -= (t.clientX - lookX) * k; me.pitch = clamp(me.pitch - (t.clientY - lookY) * k, -1.2, 0.7); lookX = t.clientX; lookY = t.clientY; } if (G.photo) e.preventDefault(); }, { passive: false });
const lookEnd = e => { for (const t of e.changedTouches) if (t.identifier === lookId) lookId = null; }; cv.addEventListener('touchend', lookEnd); cv.addEventListener('touchcancel', lookEnd);
const hold = (id, down, up) => { const el = $(id); el.addEventListener('touchstart', e => { e.preventDefault(); A.unlock(); down(); }, { passive: false }); el.addEventListener('touchend', e => { e.preventDefault(); up && up(); }); el.addEventListener('mousedown', e => { e.preventDefault(); down(); }); el.addEventListener('mouseup', () => up && up()); };
hold('tbAct', actDown, actUp); hold('tbUse', interact); hold('tbCancel', cancelLine); hold('tbVeh', toggleVehicle); hold('tbBoat', toggleBoat); hold('tbBait', () => cycleBait(1));

/* ------------------------------------------------------------------ spel starten en stoppen */
function startGame(m) {
  G.inGame = true; G.save = m.save; G.id = m.id; G.timeOff = m.now - Date.now(); G.weather = m.weather; G.merchant = m.merchant; G.contest = m.contest; G.weekend = m.weekend;
  for (const id of [...G.players.keys()]) removePlayer(id); for (const f of G.fish.values()) scene.remove(f.mesh); G.fish.clear(); E_me = null;
  me.x = S.SPAWN.x; me.z = S.SPAWN.z; me.mount = 'walk'; me.fs = 0; me.yaw = Math.PI; me.pitch = -0.2; G.fight = null; G.catchCard = null; G.actHeld = false; G.reelSent = false;
  for (const p of m.players) addPlayer(p);
  for (const h of G.houses.values()) scene.remove(h.H.root); G.houses.clear(); for (const h of m.houses || []) setHouse(h);
  world.setUnlocked(G.save.unlocked); world.setMerchant(G.merchant);
  showScreen('game'); closePanel(); if (isTouch) $('touch').classList.remove('hidden'); else $('touch').classList.add('hidden');
  $('catchCard').classList.add('hidden'); $('fightUI').classList.add('hidden'); setStatus('', ''); $('feed').innerHTML = ''; updateHUD(); updateHotbar(); updateContest();
  feed(`Welkom in ${m.room.name}! Druk op ? / Esc voor hulp en besturing.`, 'info');
  G.featured = m.featured; if (SP[m.featured]) feed(`⭐ Vis van de week: <b>${UI.esc(SP[m.featured].name)}</b> (${PONDS[SP[m.featured].pond].name}): bijt vaker en verkoopt voor 1,5×.`, 'info', true);
  const first = !G.save.stats.catches && !store.get('seenHelp', false); if (first) { store.set('seenHelp', true); setTimeout(() => openPanel('help'), 600); }
  camera.position.set(me.x, 4, me.z + 6);
}
function leaveGameUI() { G.inGame = false; closePanel(); document.exitPointerLock?.(); for (const id of [...G.players.keys()]) removePlayer(id); showScreen('lobby'); }

/* ------------------------------------------------------------------ elk beeld */
const phase = () => S.dayPhase(Date.now() + G.timeOff);
const nearPond = () => S.nearestPond(me.x, me.z);
let frameN = 0, lastBird = 0, lastCricket = 0;
function renderFrame() { renderer.render(scene, camera); }
function updatePlayers(dt) {
  const tmp = new THREE.Vector3();
  for (const E of G.players.values()) {
    if (E.isMe) { E.x = me.x; E.z = me.z; E.ry = me.ry; E.mountN = MOUNT_N.indexOf(me.mount); E.speed = me.speed; }
    else { const px = E.x, pz = E.z; E.x += (E.tx - E.x) * Math.min(1, dt * 10); E.z += (E.tz - E.z) * Math.min(1, dt * 10); E.ry += angDiff(E.ry, E.try) * Math.min(1, dt * 10); E.speed = Math.hypot(E.x - px, E.z - pz) / Math.max(dt, 0.001); }
    const mn = E.mountN, boat = mn === 3, seat = mn >= 1; const wp = boat ? S.pondWater(E.x, E.z) : -1;
    let y = boat && wp >= 0 ? PONDS[wp].waterY + 0.02 + Math.sin(world.t * 1.6 + E.id) * 0.04 : S.groundY(E.x, E.z); E.y = y;
    const mode = E.fs ? 1 : seat ? 2 : 0;
    E.h.root.position.set(E.x, y + (boat ? 0.12 : mn === 1 ? 0.28 : mn === 2 ? 0.3 : 0), E.z); E.h.root.rotation.y = E.ry;
    E.h.update(dt, boat ? 0 : E.speed, mode, E.fs === 3 ? Math.min(1, (G.fight && E.isMe ? G.fight.T : 50) / 100) : 0);
    // voertuig
    if (seat && (!E.veh || E.veh.n !== mn)) { if (E.veh) scene.remove(E.veh.mesh); const mesh = mn === 3 ? M.makeBoat() : M.makeBike(mn === 2); scene.add(mesh); E.veh = { n: mn, mesh }; }
    if (!seat && E.veh) { scene.remove(E.veh.mesh); E.veh = null; }
    if (E.veh) { E.veh.mesh.position.set(E.x, y, E.z); E.veh.mesh.rotation.y = E.ry; const w = E.veh.mesh.userData.wheels; if (w) for (const t of w) t.rotation.x += E.speed * dt * 2.2; }
    // bobber en lijn
    const vis = E.fs > 0; E.bobber.visible = E.line.visible = vis;
    if (vis) {
      E.h.root.updateMatrixWorld(true); E.h.tip.getWorldPosition(tmp); const wy = (E.pond >= 0 ? PONDS[E.pond].waterY : y), fr = E.fs === 3 ? clamp(E.D / 100, 0.08, 1) : 1;
      const bx = E.x + (E.bx - E.x) * fr, bz = E.z + (E.bz - E.z) * fr; let by = wy + 0.02 + Math.sin(world.t * 2.2 + E.id) * 0.015;
      if (E.fs === 2) by -= 0.12 + Math.abs(Math.sin(world.t * 18)) * 0.06; if (E.fs === 3) by += Math.sin(world.t * 25) * 0.02;
      E.bobber.position.set(bx, by, bz);
      const pos = E.line.geometry.attributes.position, n = pos.count, d = Math.hypot(bx - tmp.x, bz - tmp.z), sag = E.fs === 3 ? 0.15 : 0.5 + d * 0.06;
      for (let i = 0; i < n; i++) { const t = i / (n - 1); pos.setXYZ(i, tmp.x + (bx - tmp.x) * t, tmp.y + (by + 0.3 - tmp.y) * t - Math.sin(t * Math.PI) * sag, tmp.z + (bz - tmp.z) * t); }
      pos.needsUpdate = true;
      if (E.fs === 1) { E.ripT -= dt; if (E.ripT <= 0) { E.ripT = 2.2; ripple(bx, bz, 0, wy + 0.05); } } else if (E.fs === 3) { E.ripT -= dt; if (E.ripT <= 0) { E.ripT = 0.35; ripple(bx, bz, 1, wy + 0.05); } }
    }
    // hond
    if (E.dogM) {
      const dp = E.dogPos, dm = E.dogM, hs = houseOf(E);
      let tx = E.x - Math.sin(E.ry) * 1.8 + Math.cos(E.ry) * 1.1, tz = E.z - Math.cos(E.ry) * 1.8 - Math.sin(E.ry) * 1.1, basket = false;
      if (hs) {       // eigenaar is thuis: hond gaat in zijn mand liggen (via de deur naar binnen)
        const inside = (x, z) => Math.abs(x - hs.x) < S.HOUSE_W / 2 - 0.4 && Math.abs(z - hs.z) < S.HOUSE_D / 2 - 0.4, bx = hs.x - S.HOUSE_W / 2 + 1.3, bz = hs.z + S.HOUSE_D / 2 - 1.3, doorZ = hs.z - S.HOUSE_D / 2 - 1.0;
        basket = true;
        if (inside(dp.x, dp.z)) { tx = bx; tz = bz; } else if (Math.abs(dp.x - hs.x) < 1.0 && dp.z > doorZ - 0.6) { tx = hs.x; tz = hs.z - 0.5; } else { tx = hs.x; tz = doorZ; }
      }
      const dx = tx - dp.x, dz = tz - dp.z, dd = Math.hypot(dx, dz), atBasket = basket && dd < 0.35 && Math.abs(dp.x - (hs.x - S.HOUSE_W / 2 + 1.3)) < 0.5;
      let sp = 0; if (dd > (basket ? 0.3 : 1.4)) { sp = Math.min(dd * 2.5, basket ? 3 : 9); const nx = dp.x + dx / dd * sp * dt, nz = dp.z + dz / dd * sp * dt; const ok = (a, b) => S.walkable(a, b) && !S.onJetty(a, b) || S.onJetty(a, b); if (ok(nx, nz)) { dp.x = nx; dp.z = nz; dm.rotation.y = Math.atan2(dx, dz); } else if (basket && ok(nx, dp.z)) dp.x = nx; else if (basket && ok(dp.x, nz)) dp.z = nz; else if (dd > 8) { dp.x = tx; dp.z = tz; } }
      if (dd > 30) { dp.x = E.x; dp.z = E.z; }
      dm.userData.lying = atBasket; if (atBasket) { dp.x = hs.x - S.HOUSE_W / 2 + 1.3; dp.z = hs.z + S.HOUSE_D / 2 - 1.3; dm.rotation.y += angDiff(dm.rotation.y, 2.2) * Math.min(1, dt * 4); }
      dm.position.set(dp.x, S.groundY(dp.x, dp.z) + (dm.userData.lieT > 0.5 ? 0.2 : 0), dp.z); dm.userData.update(dt, atBasket ? 0 : sp);
    }
    if (E.bub) { E.bubT -= dt; if (E.bubT <= 0) { E.h.root.remove(E.bub); E.bub = null; } }
  }
}
function updateAmbient(dt) {
  const hr = G.herons;
  for (const h of hr) {
    if (!h) continue; const p = PONDS[h.userData.pond];
    if (h.userData.fly > 0) { h.userData.fly -= dt; h.position.y += dt * 6; h.position.x += dt * 8; h.userData.body = h.userData.body; const w = Math.sin(world.t * 18) * 0.9; h.userData.wingL.rotation.z = w; h.userData.wingR.rotation.z = -w; if (h.userData.fly <= 0) { h.visible = false; h.userData.wingL.rotation.z = h.userData.wingR.rotation.z = 0; } continue; }
    if (!h.visible && h.userData.x) { h.position.set(h.userData.x, S.heightAt(h.userData.x, h.userData.z), h.userData.z); h.visible = true; }
    if (h.visible) { if (Math.hypot(h.position.x - h.userData.x, h.position.z - h.userData.z) > 0.5) { h.position.x = h.userData.x; h.position.z = h.userData.z; h.position.y = S.heightAt(h.position.x, h.position.z); } h.rotation.y = Math.atan2(p.x - h.position.x, p.z - h.position.z); h.userData.neck.rotation.x = Math.sin(world.t * 0.7 + p.id) * 0.1 + (Math.sin(world.t * 0.23 + p.id * 2) > 0.92 ? 0.7 : 0); }
  }
  const cp = camera.position;
  for (const d of G.ducks) {
    const u = d.userData, p = PONDS[u.pond]; if (Math.hypot(d.position.x - cp.x, d.position.z - cp.z) > 160) { d.visible = false; continue; } d.visible = true;
    u.t -= dt; if (u.t <= 0) { u.h += (Math.random() - 0.5) * 2; u.t = 2 + Math.random() * 4; }
    const nx = d.position.x + Math.sin(u.h) * 0.5 * dt, nz = d.position.z + Math.cos(u.h) * 0.5 * dt;
    if (S.pondWater(nx, nz) === p.id && !S.onJetty(nx, nz)) { d.position.x = nx; d.position.z = nz; } else u.h = Math.atan2(p.x - d.position.x, p.z - d.position.z) + (Math.random() - 0.5);
    d.rotation.y = u.h; d.position.y = p.waterY + 0.03 + Math.sin(world.t * 1.5 + u.h) * 0.015;
  }
  for (const f of fx) { if (f.age > 2) { f.m.visible = false; continue; } f.age += dt; const k = f.age / (f.big ? 1.3 : 1.8); f.m.scale.setScalar(0.4 + k * (f.big ? 4.5 : 2.5)); f.m.material.opacity = Math.max(0, 0.7 * (1 - k)); if (k >= 1) f.age = 9; }
}
function frame() {
  requestAnimationFrame(frame); if (!renderer) return;
  const dt = Math.min(0.05, clock.getDelta()); frameN++; G.fps += (1 / Math.max(dt, 0.001) - G.fps) * 0.05;
  if (G.inGame && E_me) {
    updateMe(dt); syncReel(); updatePlayers(dt); updateHouses(dt); updateCamera(dt); computeAim(); updateFish(dt); updateAmbient(dt);
    const ph = phase(), swamp = S.zoneOf(me.x, me.z) === 2 || nearPond() === 2 && Math.hypot(me.x - PONDS[2].x, me.z - PONDS[2].z) < 140, inSnow = Math.hypot(me.x - PONDS[4].x, me.z - PONDS[4].z) < PONDS[4].zr * 1.2;
    const L = world.update(dt, camera, ph, G.weather, { snow: inSnow, swamp, fireflies: true, onThunder: () => { A.sfx.thunder(); } });
    for (const n of world.npcs) { n.update(dt, 0, 0); n.rod.visible = false; }
    // geluid
    const np = PONDS[nearPond()], dw = Math.max(0, Math.hypot(me.x - np.x, me.z - np.z) - np.r); A.ambience(clamp(1 - dw / 50, 0, 1), G.weather === 'rain' || G.weather === 'storm' ? 1 : 0, 0.5 + (G.weather === 'storm' ? 1 : 0));
    const now = performance.now(); if (L.dayW > 0.4 && G.weather === 'clear' && now - lastBird > 3500 + Math.random() * 3000) { lastBird = now; A.sfx.bird(); } if (L.nightW > 0.5 && now - lastCricket > 1400 + Math.random() * 1000) { lastCricket = now; A.sfx.cricket(); }
    // hud
    G.hudT -= dt; if (G.hudT <= 0) {
      G.hudT = 0.2; G.interact = findInteract(); const pr = $('prompt'), t = G.interact && !G.panel && !G.catchCard && !me.fs ? G.interact.text + (isTouch ? '' : '\n[E]') : ''; pr.classList.toggle('hidden', !t); if (t) pr.textContent = t;
      const z = S.zoneOf(me.x, me.z); $('pondname').textContent = (me.mount === 'boat' ? '🛶 ' : '📍 ') + PONDS[nearPond()].name + (G.weather !== 'clear' ? ' · ' + S.WEATHERS[G.weather] : '') + (G.weekend ? ' · 🎉 weekend' : '');
      $('clock').textContent = '🕐 ' + S.clockStr(ph) + ' · ' + ({ dag: 'dag', nacht: 'nacht', sch: 'schemering' })[S.timeClass(ph)];
      if (G.contest) { G.contest.left = Math.max(0, G.contest.left - 0.2); updateContest(); }
      if (G.catchCard) { const left = G.catchCard.until - performance.now(); $('ccTimer').style.width = clamp(left / G.catchCard.ms * 100, 0, 100) + '%'; }
      if (!G.catchCard && !me.fs && G.statusUntil === 0 && $('status').dataset.sticky === '') { }
      if (G.fight && me.fs === 3) updateFightUI(); if (frameN % 25 === 0) updateHotbar();
    }
    if (G.statusUntil && performance.now() > G.statusUntil) { G.statusUntil = 0; if (me.fs === 1) setStatus('Wachten op een beet...', '', 0, true); else setStatus('', ''); }
    drawMini(); if (G.save.upg.sonar && frameN % 3 === 0) drawSonar();
    if (isTouch === false) { const l = $('reticle'); l.style.display = G.photo || G.panel ? 'none' : ''; } else $('reticle').style.display = G.photo ? 'none' : '';
  } else if (world) { camera.position.set(Math.sin(performance.now() / 40000) * 60, 40, 80 + Math.cos(performance.now() / 40000) * 40); camera.lookAt(0, 0, -45); world.update(dt, camera, phase(), 'clear', {}); }
  renderFrame();
}

/* ------------------------------------------------------------------ start */
(async function boot() {
  try { initThree(); } catch (e) { $('boot').innerHTML = '<div>Dit apparaat kan geen 3D tonen (WebGL).</div><div class="note">' + e.message + '</div>'; console.error(e); return; }
  try { await M.loadAnglers(new URL('./models/', import.meta.url).href); } catch (e) { console.warn('modellen', e); }
  frame(); connect(); setTimeout(() => { if (!G.ws || G.ws.readyState !== 1) { $('bootmsg').textContent = 'Verbinden...'; } }, 1500);
  window.__vv = { G, me, S, world: () => world, send, scene: () => scene, camera: () => camera };
})();
