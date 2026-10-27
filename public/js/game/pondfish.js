// De vissen die je in de vijvers ziet zwemmen (posities komen van de server).
import * as S from '../shared.js';
import { PONDS, SPECIES } from '../shared.js';
import * as M from '../models/index.js';
import { G, R, angDiff, clamp } from './state.js';

/* ------------------------------------------------------------------ vissen in de vijver */
export function onFish(ponds) {
  const seen = new Set();
  for (const [pid, hx, hz, list, spots] of ponds) {
    G.hot.set(pid, spots || []);
    const hr = G.herons[pid];
    if (hr) {
      hr.userData.x = hx;
      hr.userData.z = hz;
      if (!hr.visible && !hr.userData.fly) {
        hr.position.set(hx, S.heightAt(hx, hz), hz);
        hr.visible = true;
      }
    }
    for (const [id, spi, x, z, h, w, hot] of list) {
      seen.add(id);
      let f = G.fish.get(id);
      if (!f) {
        const sp = SPECIES[spi],
          mesh = M.makeFish(sp, sp.leg ? '#ffd84a' : null),
          L = clamp(0.3 * Math.cbrt(w) + 0.08, 0.14, 2.6) * (sp.shape === 'paling' ? 1.15 : 1);
        mesh.scale.setScalar(L);
        R.scene.add(mesh);
        f = {
          id,
          sp,
          mesh,
          x,
          z,
          h,
          w,
          pond: pid,
          depth: 0.45 + (((id * 37) % 100) / 100) * 1.1 + L * 0.25,
          L,
          tx: x,
          tz: z,
          th: h,
          hot,
          t: Math.random() * 6,
        };
        mesh.position.set(x, 0, z);
        G.fish.set(id, f);
      }
      f.tx = x;
      f.tz = z;
      f.th = h;
      f.hot = hot;
    }
  }
  for (const [id, f] of G.fish)
    if (!seen.has(id)) {
      R.scene.remove(f.mesh);
      G.fish.delete(id);
    }
}
export function updateFish(dt) {
  const cp = R.camera.position;
  for (const f of G.fish.values()) {
    f.x += (f.tx - f.x) * Math.min(1, dt * 5);
    f.z += (f.tz - f.z) * Math.min(1, dt * 5);
    f.h += angDiff(f.h, f.th) * Math.min(1, dt * 6);
    const dx = f.x - cp.x,
      dz = f.z - cp.z,
      near = dx * dx + dz * dz < 70 * 70;
    f.mesh.visible = near;
    if (!near) continue;
    const p = PONDS[f.pond],
      gy = S.heightAt(f.x, f.z),
      y = Math.max(gy + 0.12 + f.L * 0.1, p.waterY - f.depth);
    f.t += dt * (f.hot ? 14 : 5 + f.L);
    f.mesh.position.set(f.x, y, f.z);
    f.mesh.rotation.y = -f.h;
    f.mesh.userData.tail.rotation.y = Math.sin(f.t) * 0.5;
    f.mesh.children[0].rotation.y = Math.sin(f.t) * 0.08;
    if (f.sp.leg) f.mesh.rotation.z = Math.sin(f.t * 0.3) * 0.04;
  }
}
