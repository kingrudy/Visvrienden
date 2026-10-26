// HUD: meldingen, berichtenlijst, statusregel, munten/niveau, aasbalk, wedstrijd, minikaart en sonar.
import * as S from '../shared.js';
import { PONDS, RARITY, BAITS, BAIT } from '../shared.js';
import * as UI from '../ui/html.js';
import { renderPanel } from './panels.js';
import { refreshLobby } from './screens.js';
import { updateFightUI } from './fishing.js';
import { findInteract } from './interact.js';
import { $, G, R, clamp, isTouch, me, nearPond, send } from './state.js';

export function setStatus(t, cls, ms = 0, sticky = false) {
  const s = $('status');
  s.textContent = t;
  s.className = cls || '';
  G.statusUntil = ms ? performance.now() + ms : 0;
  s.dataset.sticky = sticky ? '1' : '';
}
/* ------------------------------------------------------------------ HUD */
export function toast(msg, kind = 'info') {
  const d = document.createElement('div');
  d.className = 'toast ' + kind;
  d.textContent = msg;
  const t = $('toasts');
  t.appendChild(d);
  while (t.children.length > 4) t.firstChild.remove();
  setTimeout(() => d.remove(), 4800);
}
export function bigMsg(t) {
  const b = $('bigmsg');
  b.textContent = t;
  b.classList.remove('hidden');
  clearTimeout(bigMsg.t);
  bigMsg.t = setTimeout(() => b.classList.add('hidden'), 3200);
}
export function feed(msg, kind = 'info', html = false) {
  const f = $('feed'),
    d = document.createElement('div');
  d.className = kind;
  if (html) d.innerHTML = msg;
  else d.textContent = msg;
  f.appendChild(d);
  while (f.children.length > 7) f.firstChild.remove();
  setTimeout(() => {
    d.style.opacity = 0;
    setTimeout(() => d.remove(), 1000);
  }, 14000);
}
export function onSave() {
  R.world && R.world.setUnlocked(G.save.unlocked);
  if (G.panel) renderPanel();
  if (G.inGame) {
    updateHUD();
    updateHotbar();
  } else if (!$('lobby').classList.contains('hidden')) refreshLobby();
}
export function updateHotbar() {
  const s = G.save,
    hb = $('hotbar');
  if (!s) return;
  const rs = S.rodStats(s),
    now = Date.now();
  const baits = BAITS.filter(b => (s.baits[b.id] | 0) > 0 || b.id === s.bait);
  hb.innerHTML =
    `<div id="rodbox"><b style="color:${rs.rod.color}">🎣 ${rs.rod.name}</b><span class="note">slijtage ${Math.round(rs.dur)}% · ${s.dog ? '🐕 ' + UI.esc(s.dog.name) : ''}</span></div>` +
    baits
      .map(
        (b, i) =>
          `<div class="slot ${b.id === s.bait ? 'sel' : ''} ${s.baits[b.id] | 0 ? '' : 'empty'}" data-bait="${b.id}"><span class="k">${i + 1}</span><span class="ic">${b.icon}</span><span>${b.name}</span><span class="n">${s.baits[b.id] | 0}</span></div>`,
      )
      .join('') +
    Object.keys(S.BUFFS)
      .filter(k => (s.buffs[k] || 0) > now)
      .map(
        k =>
          `<div class="slot" title="${S.BUFFS[k].desc}"><span class="ic">${S.BUFFS[k].icon}</span><span class="n">${Math.ceil((s.buffs[k] - now) / 60000)} min</span></div>`,
      )
      .join('');
  hb.querySelectorAll('[data-bait]').forEach(
    e =>
      (e.onclick = () => {
        send({ t: 'bait', id: e.dataset.bait });
        s.bait = e.dataset.bait;
        updateHotbar();
      }),
  );
  $('tbBait').textContent = BAIT[s.bait].icon;
  $('tbVeh').textContent = me.mount === 'scooter' ? '🛵' : '🚲';
  $('tbBoat').textContent = me.mount === 'boat' ? '🚶' : '🛶';
}
export function updateHUD() {
  const s = G.save;
  if (!s) return;
  let xp = s.xp,
    l = 1;
  while (l < s.lvl) {
    xp -= S.levelNeed(l);
    l++;
  }
  const need = s.lvl >= S.MAX_LEVEL ? 1 : S.levelNeed(s.lvl);
  $('coins').textContent = '🪙 ' + s.coins;
  $('lvl').textContent = 'Niv. ' + s.lvl;
  $('repv').textContent = s.rep ? `★ ${s.rep}` : '';
  $('xpbar').style.width = clamp(s.lvl >= S.MAX_LEVEL ? 100 : (xp / need) * 100, 0, 100) + '%';
  $('quests').innerHTML =
    '<b>📋 Opdrachten</b>' +
    s.daily.q
      .map(
        q =>
          `<div class="q ${q.done ? 'done' : ''}">${UI.esc(S.QUEST_KINDS[q.kind].text(q.n, q.sp))} <span class="note">${q.p}/${q.n}</span></div>`,
      )
      .join('');
  const sonar = s.upg.sonar > 0;
  $('sonar').classList.toggle('hidden', !sonar);
}
export function updateContest() {
  const c = G.contest,
    el = $('contest');
  if (!c) {
    el.classList.add('hidden');
    return;
  }
  el.classList.remove('hidden');
  G.contestAt = performance.now();
  const left = Math.max(0, Math.ceil(c.left));
  el.innerHTML =
    `<b>🏆 Wedstrijd ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}</b>${c.weekend ? ' <span class="tag">×2</span>' : ''}` +
    (c.top.length
      ? c.top
          .slice(0, 3)
          .map((t, i) => `<div>${i + 1}. ${UI.esc(t.name)} · ${S.fmtKg(t.w)}</div>`)
          .join('')
      : '<div class="note">Vang de zwaarste vis!</div>');
}
export function drawMini() {
  const cv = $('mini'),
    x = cv.getContext('2d'),
    rad = cv.width / 2,
    scale = 0.75,
    step = R.world.grid.step,
    W = S.WORLD,
    φ = me.yaw,
    c = Math.cos(φ),
    s = Math.sin(φ);
  x.setTransform(1, 0, 0, 1, 0, 0);
  x.clearRect(0, 0, cv.width, cv.height);
  x.save();
  x.beginPath();
  x.arc(rad, rad, rad - 2, 0, 7);
  x.clip();
  x.fillStyle = '#1a3a4a';
  x.fillRect(0, 0, cv.width, cv.height);
  const A_ = -c * scale,
    B_ = s * scale,
    C_ = -s * scale,
    D_ = -c * scale,
    pxp = me.x,
    pzp = me.z,
    E = rad - (A_ * pxp + B_ * pzp),
    F = rad - (C_ * pxp + D_ * pzp);
  x.setTransform(A_ * step, C_ * step, B_ * step, D_ * step, A_ * W.minX + B_ * W.minZ + E, C_ * W.minX + D_ * W.minZ + F);
  x.imageSmoothingEnabled = true;
  x.drawImage(R.minimapImg, 0, 0);
  x.setTransform(1, 0, 0, 1, 0, 0);
  const m2s = (wx, wz) => [A_ * wx + B_ * wz + E, C_ * wx + D_ * wz + F];
  const dot = (wx, wz, col, r) => {
    const [px, py] = m2s(wx, wz);
    x.fillStyle = col;
    x.beginPath();
    x.arc(px, py, r, 0, 7);
    x.fill();
    x.strokeStyle = 'rgba(0,0,0,.6)';
    x.lineWidth = 1;
    x.stroke();
  };
  for (const sh of S.SHOPS) dot(sh.x, sh.z, sh.type === 'kiosk' ? '#ffd24a' : '#ff8a3a', 4);
  for (const g of S.GATES) dot(g.x, g.z, G.save.unlocked.includes(g.pond) ? '#7ae8a0' : '#ff6a5a', 4);
  if (G.merchant) dot(G.merchant.x, G.merchant.z, '#d08aff', 5);
  for (const e of G.players.values()) if (!e.isMe) dot(e.x, e.z, '#ffffff', 3.5);
  x.restore();
  x.fillStyle = '#6fe08a';
  x.strokeStyle = '#000';
  x.lineWidth = 2;
  x.beginPath();
  x.moveTo(rad, rad - 9);
  x.lineTo(rad + 6, rad + 6);
  x.lineTo(rad, rad + 2);
  x.lineTo(rad - 6, rad + 6);
  x.closePath();
  x.fill();
  x.stroke();
  x.fillStyle = '#fff';
  x.font = 'bold 12px system-ui';
  x.textAlign = 'center';
  x.fillText('▲', rad, 14);
}
export function drawSonar() {
  const lvl = G.save.upg.sonar;
  if (!lvl) return;
  const cv = $('sonar'),
    x = cv.getContext('2d'),
    rad = cv.width / 2,
    range = 28,
    sc = (rad - 4) / range;
  x.clearRect(0, 0, cv.width, cv.height);
  x.strokeStyle = 'rgba(80,255,180,.35)';
  x.lineWidth = 1;
  for (const r of [rad * 0.33, rad * 0.66, rad - 3]) {
    x.beginPath();
    x.arc(rad, rad, r, 0, 7);
    x.stroke();
  }
  x.beginPath();
  x.moveTo(rad, 3);
  x.lineTo(rad, rad * 2 - 3);
  x.moveTo(3, rad);
  x.lineTo(rad * 2 - 3, rad);
  x.stroke();
  const E = R.meE,
    φ = me.yaw,
    c = Math.cos(φ),
    s = Math.sin(φ),
    ox = me.fs ? E.bx : me.x,
    oz = me.fs ? E.bz : me.z;
  x.fillStyle = '#fff';
  for (const f of G.fish.values()) {
    const dx = f.x - ox,
      dz = f.z - oz;
    if (Math.hypot(dx, dz) > range) continue;
    const px = rad + (-dx * c + dz * s) * sc,
      py = rad - (dx * s + dz * c) * sc;
    const col = lvl >= 2 ? RARITY[f.sp.rar].c : '#7affc0';
    x.fillStyle = col;
    x.beginPath();
    x.arc(px, py, 2 + Math.cbrt(f.w) * 1.2, 0, 7);
    x.fill();
    if (lvl >= 3) {
      x.font = '9px system-ui';
      x.fillText(f.w >= 10 ? f.w.toFixed(0) : f.w.toFixed(1), px + 4, py - 3);
    }
  }
  x.fillStyle = '#ff6a5a';
  x.beginPath();
  x.arc(rad, rad, 3, 0, 7);
  x.fill();
}

/* ------------------------------------------------------------------ elke 0,2 s en elk beeld */
let hudT = 0,
  hotbarT = 0,
  sonarN = 0;
/** Werk de HUD bij: knopprompt, plaats, klok, wedstrijdtijd, vangstkaart, drilmeter, minikaart en sonar. */
export function tickHud(dt, ph) {
  if ((hudT -= dt) <= 0) {
    hudT = 0.2;
    G.interact = findInteract();
    const pr = $('prompt'),
      t = G.interact && !G.panel && !G.catchCard && !me.fs ? G.interact.text + (isTouch ? '' : '\n[E]') : '';
    pr.classList.toggle('hidden', !t);
    if (t) pr.textContent = t;
    $('pondname').textContent =
      (me.mount === 'boat' ? '🛶 ' : '📍 ') +
      PONDS[nearPond()].name +
      (G.weather !== 'clear' ? ' · ' + S.WEATHERS[G.weather] : '') +
      (G.weekend ? ' · 🎉 weekend' : '');
    $('clock').textContent = '🕐 ' + S.clockStr(ph) + ' · ' + { dag: 'dag', nacht: 'nacht', sch: 'schemering' }[S.timeClass(ph)];
    if (G.contest) {
      G.contest.left = Math.max(0, G.contest.left - 0.2);
      updateContest();
    }
    if (G.catchCard) {
      const left = G.catchCard.until - performance.now();
      $('ccTimer').style.width = clamp((left / G.catchCard.ms) * 100, 0, 100) + '%';
    }
    if (G.fight && me.fs === 3) updateFightUI();
  }
  if ((hotbarT -= dt) <= 0) {
    hotbarT = 0.5;
    updateHotbar();
  } // aftellende bonussen
  if (G.statusUntil && performance.now() > G.statusUntil) {
    G.statusUntil = 0;
    if (me.fs === 1) setStatus('Wachten op een beet...', '', 0, true);
    else setStatus('', '');
  }
  drawMini();
  if (G.save.upg.sonar && ++sonarN % 3 === 0) drawSonar();
  $('reticle').style.display = G.photo || (G.panel && !isTouch) ? 'none' : '';
}
