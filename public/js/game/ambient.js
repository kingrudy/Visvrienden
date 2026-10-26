// Sfeer: reigers, eenden, rimpelingen en gebeurtenissen zoals plonsen.
import * as S from '../shared.js';
import { PONDS } from '../shared.js';
import * as A from '../audio.js';
import { ripple } from './scene.js';
import { G, R, clamp, fx, me, nearPond } from './state.js';

/* ------------------------------------------------------------------ gebeurtenissen */
export function onEvent(m) {
  if (m.k === 'splash') {
    const d = Math.hypot(m.x - me.x, m.z - me.z);
    ripple(m.x, m.z, m.big);
    A.sfx.splash(m.big, d);
  } else if (m.k === 'heron') {
    const h = G.herons[m.pond];
    if (h) {
      h.userData.fly = 3;
      A.sfx.heron();
    }
  } else if (m.k === 'eat') {
    if (m.id === G.id) A.sfx.eat();
  }
}
export function updateAmbient(dt) {
  const hr = G.herons;
  for (const h of hr) {
    if (!h) continue;
    const p = PONDS[h.userData.pond];
    if (h.userData.fly > 0) {
      h.userData.fly -= dt;
      h.position.y += dt * 6;
      h.position.x += dt * 8;
      const w = Math.sin(R.world.t * 18) * 0.9;
      h.userData.wingL.rotation.z = w;
      h.userData.wingR.rotation.z = -w;
      if (h.userData.fly <= 0) {
        h.visible = false;
        h.userData.wingL.rotation.z = h.userData.wingR.rotation.z = 0;
      }
      continue;
    }
    if (!h.visible && h.userData.x) {
      h.position.set(h.userData.x, S.heightAt(h.userData.x, h.userData.z), h.userData.z);
      h.visible = true;
    }
    if (h.visible) {
      if (Math.hypot(h.position.x - h.userData.x, h.position.z - h.userData.z) > 0.5) {
        h.position.x = h.userData.x;
        h.position.z = h.userData.z;
        h.position.y = S.heightAt(h.position.x, h.position.z);
      }
      h.rotation.y = Math.atan2(p.x - h.position.x, p.z - h.position.z);
      h.userData.neck.rotation.x = Math.sin(R.world.t * 0.7 + p.id) * 0.1 + (Math.sin(R.world.t * 0.23 + p.id * 2) > 0.92 ? 0.7 : 0);
    }
  }
  const cp = R.camera.position;
  for (const d of G.ducks) {
    const u = d.userData,
      p = PONDS[u.pond];
    if (Math.hypot(d.position.x - cp.x, d.position.z - cp.z) > 160) {
      d.visible = false;
      continue;
    }
    d.visible = true;
    u.t -= dt;
    if (u.t <= 0) {
      u.h += (Math.random() - 0.5) * 2;
      u.t = 2 + Math.random() * 4;
    }
    const nx = d.position.x + Math.sin(u.h) * 0.5 * dt,
      nz = d.position.z + Math.cos(u.h) * 0.5 * dt;
    if (S.pondWater(nx, nz) === p.id && !S.onJetty(nx, nz)) {
      d.position.x = nx;
      d.position.z = nz;
    } else u.h = Math.atan2(p.x - d.position.x, p.z - d.position.z) + (Math.random() - 0.5);
    d.rotation.y = u.h;
    d.position.y = p.waterY + 0.03 + Math.sin(R.world.t * 1.5 + u.h) * 0.015;
  }
  for (const f of fx) {
    if (f.age > 2) {
      f.m.visible = false;
      continue;
    }
    f.age += dt;
    const k = f.age / (f.big ? 1.3 : 1.8);
    f.m.scale.setScalar(0.4 + k * (f.big ? 4.5 : 2.5));
    f.m.material.opacity = Math.max(0, 0.7 * (1 - k));
    if (k >= 1) f.age = 9;
  }
}

/* ------------------------------------------------------------------ geluid */
let lastBird = 0,
  lastCricket = 0;
/** Achtergrondgeluid: kabbelend water dichtbij een vijver, regen, vogels overdag en krekels 's nachts. L = licht uit World.update. */
export function updateSounds(L) {
  const np = PONDS[nearPond()],
    dw = Math.max(0, Math.hypot(me.x - np.x, me.z - np.z) - np.r),
    storm = G.weather === 'storm';
  A.ambience(clamp(1 - dw / 50, 0, 1), G.weather === 'rain' || storm ? 1 : 0, 0.5 + (storm ? 1 : 0));
  const now = performance.now();
  if (L.dayW > 0.4 && G.weather === 'clear' && now - lastBird > 3500 + Math.random() * 3000) {
    lastBird = now;
    A.sfx.bird();
  }
  if (L.nightW > 0.5 && now - lastCricket > 1400 + Math.random() * 1000) {
    lastCricket = now;
    A.sfx.cricket();
  }
}
