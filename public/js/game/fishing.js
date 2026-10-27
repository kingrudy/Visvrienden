// Vissen vanuit de speler: werpen, aanslaan, inhalen, de vangstkaart (houden/terugzetten) en de drilmeter.
import * as S from '../shared.js';
import { PONDS, SP, SPECIES, RARITY, BAIT } from '../shared.js';
import * as UI from '../ui/html.js';
import * as A from '../audio.js';
import { bigMsg, setStatus, toast } from './hud.js';
import { takePhoto } from './photo.js';
import { $, G, R, isTouch, me, send } from './state.js';

const WAIT_TEXT = {
  dobber: 'Wachten op een beet...',
  grond: '⚓ Aas ligt op de bodem... luister naar het belletje',
  kunstaas: '🎯 Houd ingedrukt om het kunstaas binnen te draaien',
};
export function onMyFishState(fs) {
  const prev = me.fs;
  me.fs = fs;
  if (fs === 2 && prev !== 2) {
    if (G.tech === 'grond') A.sfx.bell();
    A.sfx.bite();
    setStatus(G.tech === 'grond' ? '🔔 AANSLAAN!' : 'AANSLAAN!', 'bite', 4000);
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
  if (fs === 1) setStatus(WAIT_TEXT[G.tech] || WAIT_TEXT.dobber, '', 0, true);
}
export const waitText = () => WAIT_TEXT[G.tech] || WAIT_TEXT.dobber;
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
    G.charge = { t0: performance.now() }; // krachtbalk loopt tot je loslaat
    $('castMeter').classList.remove('hidden');
  } else if (me.fs === 2) send({ t: 'hook' });
}
export function actUp() {
  G.actHeld = false;
  if (G.charge) releaseCast();
}

/* ------------------------------------------------------------------ werpen met de krachtbalk */
const castState = () => {
  const held = (performance.now() - G.charge.t0) / 1000,
    power = S.castPower(held),
    E = R.meE,
    rs = S.rodStats(G.save);
  // de balk bepaalt hoe ver je voorbij de waterkant gooit: van vlak achter de kant tot de maximale werpafstand
  const sx = Math.sin(me.yaw),
    sz = Math.cos(me.yaw);
  let edge = rs.cast;
  for (let d = 1.5; d < rs.cast; d += 0.5)
    if (S.pondWater(E.x + sx * d, E.z + sz * d) >= 0) {
      edge = d;
      break;
    }
  const near = Math.min(rs.cast, edge + 1),
    dist = near + power * Math.max(0, rs.cast - near),
    x = E.x + sx * dist,
    z = E.z + sz * dist;
  const pond = S.pondWater(x, z),
    ok = pond >= 0 && !S.onJetty(x, z) && (!PONDS[pond].req || G.save.unlocked.includes(pond));
  return { power, x, z, ok, perfect: power >= S.CAST_PERFECT[0] && power <= S.CAST_PERFECT[1] };
};
/** Elk beeld tijdens het laden: balk en landingsplek bijwerken. */
export function updateCharge() {
  const mark = R.landMark;
  if (!G.charge || !R.meE) {
    if (mark) mark.visible = false;
    return;
  }
  if (G.panel || G.photo || me.fs) return cancelCharge();
  const c = castState();
  $('cmFill').style.width = c.power * 100 + '%';
  const lab = $('cmLabel');
  lab.textContent = c.perfect ? '✨ Perfect! Laat los!' : c.ok ? 'Laat los om te werpen' : 'Dat is geen water';
  lab.className = 'cm-label' + (c.perfect ? ' perfect' : '');
  mark.visible = true;
  mark.position.set(c.x, c.ok ? PONDS[S.pondWater(c.x, c.z)].waterY + 0.08 : S.groundY(c.x, c.z) + 0.08, c.z);
  mark.material.color.set(c.perfect ? '#ffd84a' : c.ok ? '#7ae8a0' : '#ff6a5a');
}
function releaseCast() {
  const c = castState();
  cancelCharge();
  if (!c.ok) return toast('Je worp landde op de kant. Kijk naar het water en probeer opnieuw.', 'warn');
  G.tech = S.techOf(G.save.bait);
  send({ t: 'cast', x: +c.x.toFixed(2), z: +c.z.toFixed(2), perfect: c.perfect });
  A.sfx.cast();
  if (c.perfect) {
    setStatus('✨ Perfecte worp!', 'bite', 1200);
    A.sfx.coin();
  }
}
export function cancelCharge() {
  G.charge = null;
  $('castMeter').classList.add('hidden');
  if (R.landMark) R.landMark.visible = false;
}
export function cancelLine() {
  if (me.fs) send({ t: 'cancel' });
}
export function syncReel() {
  const held = G.actHeld || G.keys.has('Space');
  const want = held && (me.fs === 3 || (me.fs === 1 && G.tech === 'kunstaas')); // kunstaas: ook binnendraaien zonder vis
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
  $('dlabel').textContent = f.boss ? 'Kracht van de reuzenvis' : 'Afstand tot de vis';
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
  $('fishinfo').textContent = f.boss ? `🐋 met ${f.boss.n} ${f.boss.n === 1 ? 'visser' : 'vissers'}` : RARITY[sp.rar].n;
  $('stam').textContent = 'Vermoeidheid ' + (100 - f.st) + '%';
  if (f.ph === 'run' && G.reelSent && f.T > 70) {
    G.shake = 0.06;
    if (Math.random() < 0.3) A.sfx.warn();
  }
  if (G.reelSent && f.ph !== 'run' && Math.random() < 0.5) A.sfx.reel();
}
