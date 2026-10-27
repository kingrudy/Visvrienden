// Startpunt van de client: opstarten, spel starten/verlaten en de beeldlus.
// De rest van de client staat per onderwerp in deze map (net, screens, players, fishing, hud, panels, input, ...).
import * as S from '../shared.js';
import { PONDS, SP } from '../shared.js';
import * as M from '../models/index.js';
import * as UI from '../ui/html.js';
import * as A from '../audio.js';
import { updateAmbient, updateSounds } from './ambient.js';
import { cancelCharge, syncReel, updateCharge } from './fishing.js';
import { onBoss, updateBoss } from './boss.js';
import { updateHotspots } from './hotspots.js';
import { initPwa } from './pwa.js';
import { setHouse, updateHouses } from './houses.js';
import { feed, setStatus, tickHud, updateContest, updateHUD, updateHotbar } from './hud.js';
import { computeAim, updateCamera, updateMe } from './movement.js';
import { connect } from './net.js';
import { closePanel, openPanel } from './panels.js';
import { addPlayer, removePlayer, updatePlayers } from './players.js';
import { updateFish } from './pondfish.js';
import { adaptResolution, initThree, renderFrame } from './scene.js';
import { showScreen } from './screens.js';
import { $, G, R, isTouch, me, nearPond, phase, send, store } from './state.js';
import './input.js'; // koppelt toetsenbord, muis, touch en gamepad
import './photo.js'; // knoppen van de fotomodus

/* ------------------------------------------------------------------ spel starten en stoppen */
export function startGame(m) {
  Object.assign(G, {
    inGame: true,
    save: m.save,
    id: m.id,
    timeOff: m.now - Date.now(),
    weather: m.weather,
    merchant: m.merchant,
    contest: m.contest,
    weekend: m.weekend,
    featured: m.featured,
  });
  Object.assign(G, { fight: null, catchCard: null, actHeld: false, reelSent: false, roomId: m.room.id });
  G.hot.clear();
  cancelCharge();
  const start = m.you || S.SPAWN; // na opnieuw verbinden: je oude plek
  Object.assign(me, { x: start.x, z: start.z, mount: 'walk', fs: 0, yaw: Math.PI, pitch: -0.2 });
  onBoss(m.boss);
  // vorige kamer opruimen
  for (const id of [...G.players.keys()]) removePlayer(id);
  for (const f of G.fish.values()) R.scene.remove(f.mesh);
  G.fish.clear();
  R.meE = null;
  for (const h of G.houses.values()) R.scene.remove(h.H.root);
  G.houses.clear();
  // nieuwe kamer
  for (const p of m.players) addPlayer(p);
  for (const h of m.houses || []) setHouse(h);
  R.world.setUnlocked(G.save.unlocked);
  R.world.setMerchant(G.merchant);
  showScreen('game');
  closePanel();
  $('touch').classList.toggle('hidden', !isTouch);
  $('catchCard').classList.add('hidden');
  $('fightUI').classList.add('hidden');
  setStatus('', '');
  $('feed').innerHTML = '';
  updateHUD();
  updateHotbar();
  updateContest();
  feed(`Welkom in ${m.room.name}! Druk op ? / Esc voor hulp en besturing.`, 'info');
  const fs = SP[m.featured];
  if (fs) feed(`⭐ Vis van de week: <b>${UI.esc(fs.name)}</b> (${PONDS[fs.pond].name}): bijt vaker en verkoopt voor 1,5×.`, 'info', true);
  if (!G.save.stats.catches && !store.get('seenHelp', false)) {
    store.set('seenHelp', true);
    setTimeout(() => openPanel('help'), 600);
  }
  R.camera.position.set(me.x, 4, me.z + 6);
}
export function leaveGameUI() {
  G.inGame = false;
  G.roomId = 0;
  G.boss = null;
  cancelCharge();
  $('bossBox').classList.add('hidden');
  closePanel();
  document.exitPointerLock?.();
  for (const id of [...G.players.keys()]) removePlayer(id);
  showScreen('lobby');
}

/* ------------------------------------------------------------------ elk beeld */
function frame() {
  requestAnimationFrame(frame);
  if (!R.renderer) return;
  const dt = Math.min(0.05, R.clock.getDelta());
  G.fps += (1 / Math.max(dt, 0.001) - G.fps) * 0.05;
  if (G.inGame && R.meE) {
    updateMe(dt);
    updateCharge();
    syncReel();
    updatePlayers(dt);
    updateHouses(dt);
    updateCamera(dt);
    computeAim();
    updateFish(dt);
    updateAmbient(dt);
    updateHotspots(dt);
    updateBoss(dt);
    const ph = phase(),
      p2 = PONDS[2],
      p4 = PONDS[4];
    const swamp = S.zoneOf(me.x, me.z) === 2 || (nearPond() === 2 && Math.hypot(me.x - p2.x, me.z - p2.z) < 140);
    const snow = Math.hypot(me.x - p4.x, me.z - p4.z) < p4.zr * 1.2;
    const L = R.world.update(dt, R.camera, ph, G.weather, { snow, swamp, fireflies: true, onThunder: () => A.sfx.thunder() });
    for (const n of R.world.npcs) {
      n.update(dt, 0, 0);
      n.rod.visible = false;
    }
    updateSounds(L);
    tickHud(dt, ph);
  } else if (R.world) {
    // achter het inlogscherm en de lobby: langzaam rondvliegende camera
    const t = performance.now() / 40000;
    R.camera.position.set(Math.sin(t) * 60, 40, 80 + Math.cos(t) * 40);
    R.camera.lookAt(0, 0, -45);
    R.world.update(dt, R.camera, phase(), 'clear', {});
  }
  adaptResolution(dt, G.fps);
  renderFrame();
}

/* ------------------------------------------------------------------ opstarten */
(async function boot() {
  try {
    initThree();
  } catch (e) {
    $('boot').innerHTML = '<div>Dit apparaat kan geen 3D tonen (WebGL).</div><div class="note">' + UI.esc(e.message) + '</div>';
    console.error(e);
    return;
  }
  try {
    await M.loadAnglers(new URL('../../models/', import.meta.url).href);
  } catch (e) {
    console.warn('modellen', e);
  }
  frame();
  initPwa();
  connect();
  setTimeout(() => {
    if (!G.ws || G.ws.readyState !== 1) $('bootmsg').textContent = 'Verbinden...';
  }, 1500);
  window.__vv = { G, me, S, world: () => R.world, send, scene: () => R.scene, camera: () => R.camera }; // voor testen en debuggen
})();
