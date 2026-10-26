// Huizen van alle spelers: bouwen, aquarium bijwerken en de hondenmand.
import * as S from '../shared.js';
import { SP } from '../shared.js';
import * as M from '../models/index.js';
import { G, R, me } from './state.js';

/* ------------------------------------------------------------------ huizen */
export function setHouse(info) {
  const slot = S.HOUSE_SLOTS[info.s];
  if (!slot) return;
  let h = G.houses.get(info.s);
  if (!h) {
    const H = M.makeHouse(info.s);
    H.root.position.set(slot.x, S.heightAt(slot.x, slot.z), slot.z);
    R.scene.add(H.root);
    h = { H, info };
    G.houses.set(info.s, h);
  }
  h.info = info;
  h.H.setOwner(info.n);
  h.H.setFish(info.sp.map(x => SP[x[0]]).filter(Boolean));
  updateBasket(h);
}
export function houseOf(E) {
  // het huis van deze speler, als hij er (bijna) binnen staat
  const nm = E.info && E.info.name;
  if (!nm) return null;
  for (const h of G.houses.values())
    if (h.info.n === nm) {
      const s = S.HOUSE_SLOTS[h.info.s];
      if (Math.abs(E.x - s.x) < S.HOUSE_W / 2 + 1.2 && Math.abs(E.z - s.z) < S.HOUSE_D / 2 + 1.2) return s;
    }
  return null;
}
function updateBasket(h) {
  const online = [...G.players.values()].some(p => p.info && p.info.name === h.info.n);
  h.H.bdog.visible = !!h.info.d && !online;
}
let houseT = 0;
export function updateHouses(dt) {
  houseT -= dt;
  const slow = houseT <= 0;
  if (slow) houseT = 1;
  for (const h of G.houses.values()) {
    const slot = S.HOUSE_SLOTS[h.info.s],
      d = Math.hypot(R.camera.position.x - slot.x, R.camera.position.z - slot.z);
    h.H.root.visible = d < 260;
    if (d < 40) h.H.update(dt);
    if (slow) updateBasket(h);
  }
}
export function nearHouseAq() {
  let best = null,
    bd = 4.2;
  for (const h of G.houses.values()) {
    const s = S.HOUSE_SLOTS[h.info.s],
      ax = s.x,
      az = s.z + S.HOUSE_D / 2 - 1.6,
      d = Math.hypot(me.x - ax, me.z - az);
    if (d < bd) {
      bd = d;
      best = h;
    }
  }
  return best;
}
