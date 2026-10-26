// De hond van een speler: loopt achter zijn baasje aan en gaat thuis via de deur in zijn mand liggen.
import * as S from '../shared.js';
import { houseOf } from './houses.js';
import { angDiff } from './state.js';

/** Werk de hond van speler E bij (E.dogM = model, E.dogPos = positie). */
export function updateDog(E, dt) {
  const dp = E.dogPos,
    dm = E.dogM,
    hs = houseOf(E);
  let tx = E.x - Math.sin(E.ry) * 1.8 + Math.cos(E.ry) * 1.1,
    tz = E.z - Math.cos(E.ry) * 1.8 - Math.sin(E.ry) * 1.1,
    basket = false;
  if (hs) {
    // eigenaar is thuis: hond gaat in zijn mand liggen (via de deur naar binnen)
    const inside = (x, z) => Math.abs(x - hs.x) < S.HOUSE_W / 2 - 0.4 && Math.abs(z - hs.z) < S.HOUSE_D / 2 - 0.4,
      bx = hs.x - S.HOUSE_W / 2 + 1.3,
      bz = hs.z + S.HOUSE_D / 2 - 1.3,
      doorZ = hs.z - S.HOUSE_D / 2 - 1.0;
    basket = true;
    if (inside(dp.x, dp.z)) {
      tx = bx;
      tz = bz;
    } else if (Math.abs(dp.x - hs.x) < 1.0 && dp.z > doorZ - 0.6) {
      tx = hs.x;
      tz = hs.z - 0.5;
    } else {
      tx = hs.x;
      tz = doorZ;
    }
  }
  const dx = tx - dp.x,
    dz = tz - dp.z,
    dd = Math.hypot(dx, dz),
    atBasket = basket && dd < 0.35 && Math.abs(dp.x - (hs.x - S.HOUSE_W / 2 + 1.3)) < 0.5;
  let sp = 0;
  if (dd > (basket ? 0.3 : 1.4)) {
    sp = Math.min(dd * 2.5, basket ? 3 : 9);
    const nx = dp.x + (dx / dd) * sp * dt,
      nz = dp.z + (dz / dd) * sp * dt;
    const ok = (a, b) => (S.walkable(a, b) && !S.onJetty(a, b)) || S.onJetty(a, b);
    if (ok(nx, nz)) {
      dp.x = nx;
      dp.z = nz;
      dm.rotation.y = Math.atan2(dx, dz);
    } else if (basket && ok(nx, dp.z)) dp.x = nx;
    else if (basket && ok(dp.x, nz)) dp.z = nz;
    else if (dd > 8) {
      dp.x = tx;
      dp.z = tz;
    }
  }
  if (dd > 30) {
    dp.x = E.x;
    dp.z = E.z;
  }
  dm.userData.lying = atBasket;
  if (atBasket) {
    dp.x = hs.x - S.HOUSE_W / 2 + 1.3;
    dp.z = hs.z + S.HOUSE_D / 2 - 1.3;
    dm.rotation.y += angDiff(dm.rotation.y, 2.2) * Math.min(1, dt * 4);
  }
  dm.position.set(dp.x, S.groundY(dp.x, dp.z) + (dm.userData.lieT > 0.5 ? 0.2 : 0), dp.z);
  dm.userData.update(dt, atBasket ? 0 : sp);
}
