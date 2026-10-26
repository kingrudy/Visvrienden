// Vissen vanuit de speler: werpen, aanslaan, inhalen, de vangstkaart (houden/terugzetten) en de drilmeter.
import * as S from '../shared.js';
import { SP, SPECIES, RARITY, BAIT } from '../shared.js';
import * as UI from '../ui/html.js';
import * as A from '../audio.js';
import { bigMsg, setStatus, toast } from './hud.js';
import { takePhoto } from './photo.js';
import { $, G, isTouch, me, send } from './state.js';

export function onMyFishState(fs) {
  const prev = me.fs;
  me.fs = fs;
  if (fs === 2 && prev !== 2) {
    A.sfx.bite();
    setStatus('AANSLAAN!', 'bite', 4000);
    G.shake = 0.15;
  }
  if (fs === 1 && prev === 0) {
    A.sfx.cast();
  }
  if (fs === 0) {
    G.fight = null;
    $('fightUI').classList.add('hidden');
    if (prev === 3 || prev === 2) setStatus('', '');
  }
  if (fs === 3) {
    $('fightUI').classList.remove('hidden');
    setStatus('', '');
  }
  if (fs === 1) setStatus('Wachten op een beet...', '', 0, true);
}
/* ------------------------------------------------------------------ vissen: knoppen */
export function actDown() {
  if (G.panel || G.photo || G.chatOpen) return;
  A.unlock();
  G.actHeld = true;
  if (G.catchCard) return;
  if (me.fs === 0) {
    if (me.mount === 'bike' || me.mount === 'scooter') return toast('Stap eerst van je voertuig af (V).', 'warn');
    const bc = G.save.baits[G.save.bait] | 0;
    if (!bc) return toast(`Geen ${BAIT[G.save.bait].name.toLowerCase()} meer! Kies ander aas of koop nieuw in de winkel.`, 'warn');
    if (!G.aim) return toast('Richt op het water (kijk wat meer omlaag).', 'warn');
    send({ t: 'cast', x: +G.aim.x.toFixed(2), z: +G.aim.z.toFixed(2) });
    A.sfx.cast();
  } else if (me.fs === 2) send({ t: 'hook' });
}
export function actUp() {
  G.actHeld = false;
}
export function cancelLine() {
  if (me.fs) send({ t: 'cancel' });
}
export function syncReel() {
  const want = me.fs === 3 && (G.actHeld || G.keys.has('Space'));
  if (want !== G.reelSent) {
    G.reelSent = want;
    send({ t: 'reel', on: want });
  }
}
/* ------------------------------------------------------------------ vangst */
export function onCatch(m) {
  const sp = SP[m.fish.sp],
    card = $('catchCard');
  G.catchCard = { fid: m.fid, fish: m.fish, until: performance.now() + m.ms, ms: m.ms };
  G.actHeld = false;
  setStatus('', '');
  $('fightUI').classList.add('hidden');
  card.style.borderColor = RARITY[sp.rar].c;
  card.innerHTML = `<div class="rar" style="color:${RARITY[sp.rar].c}">${RARITY[sp.rar].n}</div><img src="${UI.fishImg(sp.id)}"><h2>${UI.esc(sp.name)}</h2><div style="font-size:22px;font-weight:800">${S.fmtKg(m.fish.w)}</div>
  <div class="note">${m.rec ? '<span class="rec">★ Nieuw record! </span>' : ''}Waarde ca. 🪙 ${S.fishValue(sp, m.fish.w)} · +${m.xp} xp</div>${m.heron ? '<div style="color:#ff8a7a;font-weight:800;margin-top:6px">🐦 Een reiger loert! Kies snel!</div>' : ''}
  <div class="row"><button class="pri" id="ccKeep">Behouden (F)</button><button id="ccRel">Terugzetten (G)</button></div><div class="row" style="margin-top:6px"><button id="ccPhoto">📸 Foto</button></div><div class="timer"><i id="ccTimer"></i></div>`;
  card.classList.remove('hidden');
  if (!isTouch)
    try {
      document.exitPointerLock();
    } catch {} // muis vrij om op de knoppen te klikken
  $('ccKeep').onclick = () => decideCatch(true);
  $('ccRel').onclick = () => decideCatch(false);
  $('ccPhoto').onclick = () => takePhoto(G.catchCard);
  if (sp.leg) {
    A.sfx.legend();
    bigMsg(`✨ ${sp.name}!`);
  } else A.sfx.catch(sp.rar);
  G.shake = 0;
}
export function decideCatch(keep) {
  const c = G.catchCard;
  if (!c) return;
  send({ t: keep ? 'keep' : 'release', fid: c.fid });
  G.catchCard = null;
  $('catchCard').classList.add('hidden');
  if (!isTouch && !G.panel && !G.photo)
    try {
      $('cv').requestPointerLock?.();
    } catch {} // muis weer vastzetten voor het vissen
}
export function onLost(m) {
  G.fight = null;
  $('fightUI').classList.add('hidden');
  setStatus(m.msg, '', 3500);
  if (m.snap) {
    A.sfx.snap();
    G.shake = 0.3;
  } else A.sfx.warn();
}
export function updateFightUI() {
  const f = G.fight;
  if (!f) return;
  const sp = SPECIES[f.fid];
  $('tbar').firstElementChild.style.width = Math.min(100, f.T) + '%';
  $('dbar').firstElementChild.style.width = 100 - f.D + '%';
  const msg = $('fightmsg');
  msg.className = f.ph;
  msg.textContent =
    f.ph === 'run'
      ? '⚠ HIJ TREKT! LAAT LOS!'
      : f.ph === 'warn'
        ? '❗ Hij gaat trekken...'
        : G.actHeld || G.keys.has('Space')
          ? 'Inhalen...'
          : 'Houd ingedrukt om in te halen';
  $('fishinfo').textContent = RARITY[sp.rar].n;
  $('stam').textContent = 'Vermoeidheid ' + (100 - f.st) + '%';
  if (f.ph === 'run' && G.reelSent && f.T > 70) {
    G.shake = 0.06;
    if (Math.random() < 0.3) A.sfx.warn();
  }
  if (G.reelSent && f.ph !== 'run' && Math.random() < 0.5) A.sfx.reel();
}
