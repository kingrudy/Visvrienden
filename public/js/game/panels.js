// Panelen (tas, visboek, winkel, kaart, menu, ...): openen, tekenen en de knoppen erin.
import * as S from '../shared.js';
import { PONDS } from '../shared.js';
import * as UI from '../ui/html.js';
import * as A from '../audio.js';
import { toast, updateHotbar } from './hud.js';
import { api } from './net.js';
import { startPhoto } from './photo.js';
import { $, G, R, me, send, store } from './state.js';

/* ------------------------------------------------------------------ panelen */
const TITLES = {
  aq: '🐠 Aquarium',
  shop: '🛒 Winkel',
  bag: '🎒 Tas',
  book: '📖 Visboek',
  quests: '📋 Opdrachten',
  talents: '⭐ Talenten',
  ach: '🏅 Prestaties',
  map: '🗺️ Kaart',
  players: '👥 Spelers en handel',
  settings: '☰ Menu',
  board: '📌 Prikbord',
  help: '❓ Besturing',
};
export function openPanel(name, arg) {
  try {
    document.exitPointerLock();
  } catch {}
  G.panel = { name, arg: arg || {} };
  G.keys.clear();
  G.actHeld = false;
  $('panelTitle').textContent = TITLES[name] || '';
  $('panel').classList.remove('hidden');
  renderPanel();
}
export function closePanel() {
  G.panel = null;
  $('panel').classList.add('hidden');
}
export function renderPanel() {
  const P = G.panel;
  if (!P) return;
  const s = G.save,
    body = $('panelBody'),
    top = body.scrollTop;
  const others = [...G.players.values()]
    .filter(e => !e.isMe)
    .map(e => ({ id: e.id, name: e.info.name, lvl: e.info.lvl, dog: e.info.dog, dist: Math.hypot(e.x - me.x, e.z - me.z) }));
  switch (P.name) {
    case 'shop':
      body.innerHTML = UI.shopHTML(s, P.arg.shop, P.arg.tab, P.arg);
      break;
    case 'bag':
      body.innerHTML = UI.bagHTML(s, {});
      break;
    case 'book':
      body.innerHTML = UI.bookHTML(s);
      break;
    case 'quests':
      body.innerHTML = UI.questsHTML(s);
      break;
    case 'talents':
      body.innerHTML = UI.talentsHTML(s);
      break;
    case 'ach':
      body.innerHTML = UI.achHTML(s);
      break;
    case 'aq': {
      const h = G.houses.get(P.arg.slot);
      body.innerHTML = h ? UI.aqHTML(h.info) : '<div class="note">Dit huis is leeg.</div>';
      break;
    }
    case 'players':
      body.innerHTML = UI.playersHTML(s, { others, fid: P.arg.fid });
      break;
    case 'board':
      body.innerHTML = UI.boardHTML(s, { contest: G.contest, weekend: G.weekend });
      api('/api/leaderboard')
        .then(lb => {
          const e = $('lbBoard');
          if (e) e.innerHTML = UI.lbHTML(lb);
        })
        .catch(() => {});
      break;
    case 'settings':
      body.innerHTML = UI.settingsHTML(G.settings);
      break;
    case 'help':
      body.innerHTML = UI.helpHTML();
      break;
    case 'map':
      body.innerHTML =
        '<canvas id="mapcv" width="560" height="660"></canvas><div class="note" style="margin-top:6px">🏠 winkel · 🔥 kampvuur · 🔒 gesloten vijver · 🧳 reizende verkoper · jij = groene pijl</div>';
      drawFullMap();
      break;
  }
  body.scrollTop = top;
}
$('panelClose').onclick = closePanel;
$('panel').addEventListener('mousedown', e => {
  if (e.target === $('panel')) closePanel();
});
$('panelBody').addEventListener('click', e => {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const d = el.dataset,
    P = G.panel;
  A.sfx.ui();
  switch (d.act) {
    case 'shoptab':
      P.arg.tab = d.v;
      renderPanel();
      break;
    case 'buy':
      send({ t: 'buy', item: d.item, qty: 1 });
      break;
    case 'sell':
      send({ t: 'sell', ids: [+d.id] });
      break;
    case 'sellall':
      send({ t: 'sell', all: true });
      break;
    case 'equip':
      send({ t: 'equip', rod: +d.rod });
      break;
    case 'bait':
      send({ t: 'bait', id: d.id });
      G.save.bait = d.id;
      renderPanel();
      updateHotbar();
      break;
    case 'cook':
      send({ t: 'cook', id: +d.id });
      break;
    case 'talent':
      send({ t: 'talent', id: d.id });
      break;
    case 'retalent':
      send({ t: 'retalent' });
      break;
    case 'offerform':
      openPanel('players', { fid: +d.id });
      break;
    case 'offer': {
      const to = +$('tradeTo').value,
        fid = +$('tradeFish').value,
        price = +$('tradePrice').value | 0;
      send({ t: 'offer', to, fid, price });
      break;
    }
    case 'contest':
      send({ t: 'contest' });
      break;
    case 'help':
      openPanel('help');
      break;
    case 'photo':
      closePanel();
      startPhoto();
      break;
    case 'home':
      closePanel();
      send({ t: 'home' });
      break;
    case 'leave':
      closePanel();
      send({ t: 'leave' });
      break;
    case 'close':
      closePanel();
      break;
  }
});
$('panelBody').addEventListener('input', e => {
  if (e.target.id === 'setVol') {
    G.settings.vol = +e.target.value;
    store.set('vol', G.settings.vol);
    A.setVolume(G.settings.vol / 100);
  }
  if (e.target.id === 'setSens') {
    G.settings.sens = +e.target.value;
    store.set('sens', G.settings.sens);
  }
  if (e.target.id === 'setQ') {
    store.set('q', +e.target.value);
    toast('Graphics worden gewijzigd na het herladen van de pagina.', 'info');
  }
});
function drawFullMap() {
  const cv = $('mapcv');
  if (!cv) return;
  const x = cv.getContext('2d'),
    W = S.WORLD,
    sx = cv.width / (W.maxX - W.minX),
    sz = cv.height / (W.maxZ - W.minZ),
    m = (wx, wz) => [(wx - W.minX) * sx, (wz - W.minZ) * sz];
  x.imageSmoothingEnabled = true;
  x.drawImage(R.minimapImg, 0, 0, cv.width, cv.height);
  x.textAlign = 'center';
  x.font = 'bold 13px system-ui';
  x.lineWidth = 4;
  const lab = (t, px, py, col = '#fff') => {
    x.strokeStyle = 'rgba(0,0,0,.7)';
    x.strokeText(t, px, py);
    x.fillStyle = col;
    x.fillText(t, px, py);
  };
  for (const p of PONDS) {
    const [px, py] = m(p.x, p.z);
    const hid = p.secret && !G.save.disc.includes(p.id),
      lk = p.req && !G.save.unlocked.includes(p.id);
    if (hid) continue;
    lab((lk ? '🔒 ' : '') + p.name, px, py - 4, lk ? '#ffb0a0' : '#fff');
  }
  for (const sh of S.SHOPS) {
    if (
      sh.type === 'kiosk' &&
      sh.pond > 0 &&
      !(G.save.unlocked.includes(sh.pond) || (PONDS[sh.pond].secret && G.save.disc.includes(sh.pond)))
    )
      continue;
    const [px, py] = m(sh.x, sh.z);
    lab(sh.type === 'kiosk' ? '🏠' : '🛒', px, py + 5);
  }
  for (const c of S.CAMPFIRES) {
    if (c.pond > 0 && !(G.save.unlocked.includes(c.pond) || G.save.disc.includes(c.pond))) continue;
    const [px, py] = m(c.x, c.z);
    lab('🔥', px, py + 5);
  }
  if (G.merchant) {
    const [px, py] = m(G.merchant.x, G.merchant.z);
    lab('🧳', px, py + 5, '#e8a0ff');
  }
  for (const e of G.players.values()) {
    const [px, py] = m(e.x, e.z);
    x.fillStyle = e.isMe ? '#6fe08a' : '#fff';
    x.beginPath();
    x.arc(px, py, e.isMe ? 6 : 4, 0, 7);
    x.fill();
    if (!e.isMe) lab(e.info.name, px, py - 8);
  }
}
