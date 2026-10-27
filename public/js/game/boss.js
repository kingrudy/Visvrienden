// De reuzenvis in de browser: het grote gouden model in het water, het vak rechtsboven en de feestelijke vangst.
import * as S from '../shared.js';
import { PONDS, SPECIES } from '../shared.js';
import * as M from '../models/index.js';
import * as UI from '../ui/html.js';
import * as A from '../audio.js';
import { ripple } from './scene.js';
import { bigMsg, toast } from './hud.js';
import { $, G, R, angDiff } from './state.js';

let mesh = null,
  meshSp = -1,
  t = 0,
  ringT = 0;
const pos = { x: 0, z: 0, h: 0 };

export function onBoss(b, spawn) {
  const had = G.boss;
  G.boss = b;
  if (b && spawn) {
    A.sfx.legend();
    bigMsg('🐋 Reuzenvis gezien!');
  }
  if (b && (!had || had.pond !== b.pond)) Object.assign(pos, { x: b.x, z: b.z, h: b.h });
  updateBossBox();
}
export function onBossWin(m) {
  const mine = m.names.includes(G.name);
  A.sfx.legend();
  bigMsg(mine ? '🐋 Reuzenvis gevangen!' : `🐋 ${m.names.join(', ')} vingen de reuzenvis!`);
  if (mine) toast(`Samen gevangen: ${S.fmtKg(m.w)}! +${m.reward.coins} munten, ${m.reward.xp} xp en ${m.reward.rep} reputatie`, 'good');
  G.shake = 0.3;
}
export function updateBossBox() {
  const b = G.boss,
    el = $('bossBox');
  if (!b) return el.classList.add('hidden');
  el.classList.remove('hidden');
  const left = Math.max(0, b.left | 0),
    p = PONDS[b.pond];
  el.innerHTML = `<b>🐋 Reuzenvis · ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}</b><div class="note">${UI.esc(p.name)} · ${b.n ? `${b.n} aan de haak` : 'werp in de buurt!'}</div><div class="pbar"><i style="width:${(b.hp / b.max) * 100}%"></i></div>`;
}

/** Elk beeld: model laten zwemmen en spartelen. */
export function updateBoss(dt) {
  const b = G.boss;
  if (!b) {
    if (mesh) mesh.visible = false;
    return;
  }
  if (!mesh || meshSp !== b.sp) {
    if (mesh) R.scene.remove(mesh);
    mesh = M.makeFish(SPECIES[b.sp], '#ffd84a');
    mesh.scale.setScalar(4.2);
    meshSp = b.sp;
    R.scene.add(mesh);
  }
  t += dt;
  const p = PONDS[b.pond],
    fighting = b.n > 0;
  pos.x += (b.x - pos.x) * Math.min(1, dt * 2);
  pos.z += (b.z - pos.z) * Math.min(1, dt * 2);
  pos.h += angDiff(pos.h, b.h) * Math.min(1, dt * 2);
  const ground = S.heightAt(pos.x, pos.z),
    y = Math.max(ground + 0.8, p.waterY - (fighting ? 0 : 0.2)); // rug en vin steken boven het water uit
  mesh.visible = Math.hypot(pos.x - R.camera.position.x, pos.z - R.camera.position.z) < 160;
  mesh.position.set(pos.x, y + (fighting ? Math.abs(Math.sin(t * 5)) * 0.25 : Math.sin(t) * 0.1), pos.z);
  mesh.rotation.y = -pos.h + (fighting ? Math.sin(t * 7) * 0.5 : 0);
  if (mesh.userData.tail) mesh.userData.tail.rotation.y = Math.sin(t * (fighting ? 14 : 4)) * 0.6;
  if ((ringT -= dt) <= 0) {
    ringT = fighting ? 0.5 : 2.5;
    ripple(pos.x, pos.z, 1, p.waterY + 0.06);
  }
  // tijd in het vakje laten aflopen tussen twee serverberichten
  b.left = Math.max(0, b.left - dt);
  if (Math.floor(b.left) !== Math.floor(b.left + dt)) updateBossBox();
}
