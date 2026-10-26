// Bewegen (lopen, fietsen, varen), de camera achter je speler en richten op het water.
import * as THREE from 'three';
import * as S from '../shared.js';
import { PONDS } from '../shared.js';
import { pad, stick } from './input.js';
import { $, G, R, angDiff, me, send } from './state.js';

/* ------------------------------------------------------------------ bewegen */
const mountSpeed = () => (me.mount === 'bike' ? 11 : me.mount === 'scooter' ? 16 : me.mount === 'boat' ? 6.5 : me.run ? 8.5 : 5);
function locked(x, z) {
  for (const p of S.ZONE_PONDS) if (!G.save.unlocked.includes(p.id) && Math.hypot(x - p.x, z - p.z) < p.zr) return true;
  return false;
}
function canStand(x, z) {
  return (
    x > S.WORLD.minX && x < S.WORLD.maxX && z > S.WORLD.minZ && z < S.WORLD.maxZ && S.walkable(x, z, me.mount === 'boat') && !locked(x, z)
  );
}
const move = { x: 0, z: 0 };
function readInput() {
  let mx = 0,
    mz = 0;
  const k = G.keys;
  if (k.has('KeyW') || k.has('ArrowUp')) mz += 1;
  if (k.has('KeyS') || k.has('ArrowDown')) mz -= 1;
  if (k.has('KeyA') || k.has('ArrowLeft')) mx -= 1;
  if (k.has('KeyD') || k.has('ArrowRight')) mx += 1;
  mx += stick.x;
  mz += -stick.y;
  const gp = pad();
  if (gp) {
    mx += gp.mx;
    mz += gp.mz;
  }
  const l = Math.hypot(mx, mz);
  if (l > 1) {
    mx /= l;
    mz /= l;
  }
  move.x = mx;
  move.z = mz;
  me.run = k.has('ShiftLeft') || k.has('ShiftRight') || Math.hypot(stick.x, stick.y) > 0.85;
}
export function updateMe(dt) {
  if (G.panel || G.photo || G.chatOpen) {
    move.x = move.z = 0;
  } else readInput();
  const fwd = new THREE.Vector2(Math.sin(me.yaw), Math.cos(me.yaw)),
    right = new THREE.Vector2(-Math.cos(me.yaw), Math.sin(me.yaw));
  const dx = right.x * move.x + fwd.x * move.z,
    dz = right.y * move.x + fwd.y * move.z,
    len = Math.hypot(dx, dz);
  let sp = mountSpeed();
  if (me.fs === 3) sp = 0;
  else if (me.fs) sp *= 0.5;
  if (G.catchCard) sp *= 0.6;
  if (len > 0.01) {
    const vx = (dx / Math.max(1, len)) * sp * dt,
      vz = (dz / Math.max(1, len)) * sp * dt,
      nx = me.x + vx,
      nz = me.z + vz;
    if (canStand(nx, nz)) {
      me.x = nx;
      me.z = nz;
    } else if (canStand(nx, me.z)) me.x = nx;
    else if (canStand(me.x, nz)) me.z = nz;
    me.speed = sp * Math.min(1, len);
    if (!me.fs && !G.actHeld) {
      const ta = Math.atan2(dx, dz);
      me.ry += angDiff(me.ry, ta) * Math.min(1, dt * 12);
    }
  } else me.speed = 0;
  if (me.fs || G.actHeld || G.catchCard) me.ry += angDiff(me.ry, me.yaw) * Math.min(1, dt * 14);
  if (!canStand(me.x, me.z)) {
    const f = S.findNear(me.x, me.z, canStand, 10);
    if (f) {
      me.x = f.x;
      me.z = f.z;
    }
  }
  const now = performance.now();
  if (now - G.lastPosSent > 100 && (Math.hypot(me.x - G.lastSentX, me.z - G.lastSentZ) > 0.02 || now - G.lastPosSent > 600)) {
    send({ t: 'pos', x: +me.x.toFixed(2), z: +me.z.toFixed(2), ry: +me.ry.toFixed(2) });
    G.lastPosSent = now;
    G.lastSentX = me.x;
    G.lastSentZ = me.z;
  }
}

/* ------------------------------------------------------------------ R.camera en richten */
const aimDir = new THREE.Vector3();
export function updateCamera(dt) {
  const E = R.meE;
  if (!E) return;
  const ty = E.y + 1.55,
    shoulder = 0.55,
    fwd = new THREE.Vector3(Math.sin(me.yaw) * Math.cos(me.pitch), Math.sin(me.pitch), Math.cos(me.yaw) * Math.cos(me.pitch)),
    right = new THREE.Vector3(-Math.cos(me.yaw), 0, Math.sin(me.yaw));
  const dist = G.photo ? me.dist * 1.2 : me.dist * (me.fs ? 0.85 : 1);
  const tgt = new THREE.Vector3(E.x, ty, E.z).addScaledVector(right, G.photo ? 0 : -shoulder);
  let want = tgt.clone().addScaledVector(fwd, -dist);
  if (!G.photo && R.world) {
    const k = R.world.treeBlock(tgt.x, tgt.y, tgt.z, want.x, want.y, want.z);
    if (k < 1) want = tgt.clone().lerp(want, k);
  }
  const gy = S.groundY(want.x, want.z);
  if (want.y < gy + 0.5) want.y = gy + 0.5;
  const wy = S.pondWater(want.x, want.z);
  if (wy >= 0 && want.y < PONDS[wy].waterY + 0.4) want.y = PONDS[wy].waterY + 0.4;
  R.camera.position.lerp(want, 1 - Math.exp(-dt * 18));
  if (G.shake > 0) {
    R.camera.position.x += (Math.random() - 0.5) * G.shake;
    R.camera.position.y += (Math.random() - 0.5) * G.shake;
    G.shake = Math.max(0, G.shake - dt * 0.6);
  }
  R.camera.lookAt(R.camera.position.clone().add(fwd));
  aimDir.copy(fwd);
}
export function computeAim() {
  const rs = S.rodStats(G.save),
    E = R.meE;
  let best = null;
  if (aimDir.y < -0.015) {
    for (const p of PONDS) {
      const t = (p.waterY - R.camera.position.y) / aimDir.y;
      if (t < 0 || t > 200) continue;
      let hx = R.camera.position.x + aimDir.x * t,
        hz = R.camera.position.z + aimDir.z * t;
      const d = Math.hypot(hx - E.x, hz - E.z);
      if (d > rs.cast) {
        hx = E.x + ((hx - E.x) * rs.cast) / d;
        hz = E.z + ((hz - E.z) * rs.cast) / d;
      }
      if (S.pondWater(hx, hz) === p.id && Math.hypot(hx - E.x, hz - E.z) >= 2) {
        best = { x: hx, z: hz, p, d: Math.hypot(hx - E.x, hz - E.z) };
        break;
      }
    }
  }
  G.aim = best;
  const r = $('reticle');
  r.className = me.fs ? '' : best ? 'ok' : 'bad';
}
