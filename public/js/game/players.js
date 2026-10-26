// Spelers in de wereld: toevoegen/verwijderen, posities uit snapshots, poppetje, voertuig, dobber en lijn, chatballonnen.
import * as THREE from 'three';
import * as S from '../shared.js';
import { PONDS, RODS } from '../shared.js';
import * as M from '../models/index.js';
import { onMyFishState } from './fishing.js';
import { updateDog } from './dog.js';
import { ripple } from './scene.js';
import { G, MOUNT_N, R, angDiff, clamp, me } from './state.js';

/* ------------------------------------------------------------------ spelers */
export function addPlayer(info) {
  let E = G.players.get(info.id);
  if (!E) {
    const isMe = info.id === G.id,
      h = M.makeHuman(info.look, RODS[info.rod]?.color, String(info.name).toLowerCase() === 'toon' ? 'ironman' : null);
    E = {
      id: info.id,
      isMe,
      h,
      x: isMe ? me.x : S.SPAWN.x,
      z: isMe ? me.z : S.SPAWN.z,
      ry: 0,
      tx: 0,
      tz: 0,
      try: 0,
      mountN: 0,
      fs: 0,
      bx: 0,
      bz: 0,
      D: 0,
      pond: -1,
      speed: 0,
      veh: null,
      dogM: null,
      dogPos: null,
      bobber: M.makeBobber(),
      line: null,
      ripT: 0,
      first: true,
      bub: null,
      bubT: 0,
      info: {},
    };
    const lg = new THREE.BufferGeometry().setFromPoints(Array.from({ length: 16 }, () => new THREE.Vector3()));
    E.line = new THREE.Line(lg, new THREE.LineBasicMaterial({ color: '#f4f4f4', transparent: true, opacity: 0.85 }));
    E.line.frustumCulled = false;
    E.bobber.visible = E.line.visible = false;
    R.scene.add(h.root, E.bobber, E.line);
    G.players.set(info.id, E);
    if (isMe) R.meE = E;
  }
  E.info = info; // uiterlijk verandert alleen in de lobby, dus het poppetje blijft hetzelfde
  E.h.setName(info.name + (E.isMe ? '' : ` · ${info.lvl}`), E.isMe ? '#8ff0c0' : '#ffffff');
  E.h.lab.visible = !E.isMe;
  E.h.setRod(RODS[info.rod]?.color || '#c8a458');
  if (info.dog && !E.dogM) {
    E.dogM = M.makeDog(info.id % 4, String(info.name).toLowerCase() === 'toon' ? 'ironman' : null);
    E.dogPos = { x: E.x - 1.5, z: E.z - 1.5 };
    R.scene.add(E.dogM);
  } else if (!info.dog && E.dogM) {
    R.scene.remove(E.dogM);
    E.dogM = null;
  }
  if (E.isMe && G.inGame && info.mount) {
    me.mount = info.mount;
  }
}
export function removePlayer(id) {
  const E = G.players.get(id);
  if (!E) return;
  R.scene.remove(E.h.root, E.bobber, E.line);
  if (E.veh) R.scene.remove(E.veh.mesh);
  if (E.dogM) R.scene.remove(E.dogM);
  G.players.delete(id);
}
export function chatBubble(id, text) {
  const E = G.players.get(id);
  if (!E) return;
  if (E.bub) E.h.root.remove(E.bub);
  E.bub = M.label(text.length > 38 ? text.slice(0, 36) + '…' : text, '#ffffe0', 22);
  E.bub.scale.set(4.4, 1.1, 1);
  E.bub.position.y = 3.05;
  E.h.root.add(E.bub);
  E.bubT = 6;
}
export function onSnapshot(ps) {
  const seen = new Set();
  for (const [id, x, z, ry, mt, fs, bx, bz, D] of ps) {
    seen.add(id);
    const E = G.players.get(id);
    if (!E) continue;
    if (E.fs !== fs || E.bx !== bx || E.bz !== bz) {
      E.fs = fs;
      E.bx = bx;
      E.bz = bz;
      if (fs) {
        const pw = S.pondWater(bx, bz);
        E.pond = pw;
      }
      if (E.isMe) onMyFishState(fs);
    }
    E.D = D;
    E.mountN = mt;
    if (!E.isMe) {
      if (E.first) {
        E.x = x;
        E.z = z;
        E.ry = ry;
        E.first = false;
      }
      E.tx = x;
      E.tz = z;
      E.try = ry;
    }
  }
}
export function updatePlayers(dt) {
  const tmp = new THREE.Vector3();
  for (const E of G.players.values()) {
    if (E.isMe) {
      E.x = me.x;
      E.z = me.z;
      E.ry = me.ry;
      E.mountN = MOUNT_N.indexOf(me.mount);
      E.speed = me.speed;
    } else {
      const px = E.x,
        pz = E.z;
      E.x += (E.tx - E.x) * Math.min(1, dt * 10);
      E.z += (E.tz - E.z) * Math.min(1, dt * 10);
      E.ry += angDiff(E.ry, E.try) * Math.min(1, dt * 10);
      E.speed = Math.hypot(E.x - px, E.z - pz) / Math.max(dt, 0.001);
    }
    const mn = E.mountN,
      boat = mn === 3,
      seat = mn >= 1;
    const wp = boat ? S.pondWater(E.x, E.z) : -1;
    let y = boat && wp >= 0 ? PONDS[wp].waterY + 0.02 + Math.sin(R.world.t * 1.6 + E.id) * 0.04 : S.groundY(E.x, E.z);
    E.y = y;
    const mode = E.fs ? 1 : seat ? 2 : 0;
    E.h.root.position.set(E.x, y + (boat ? 0.12 : mn === 1 ? 0.28 : mn === 2 ? 0.3 : 0), E.z);
    E.h.root.rotation.y = E.ry;
    E.h.update(dt, boat ? 0 : E.speed, mode, E.fs === 3 ? Math.min(1, (G.fight && E.isMe ? G.fight.T : 50) / 100) : 0);
    // voertuig
    if (seat && (!E.veh || E.veh.n !== mn)) {
      if (E.veh) R.scene.remove(E.veh.mesh);
      const mesh = mn === 3 ? M.makeBoat() : M.makeBike(mn === 2);
      R.scene.add(mesh);
      E.veh = { n: mn, mesh };
    }
    if (!seat && E.veh) {
      R.scene.remove(E.veh.mesh);
      E.veh = null;
    }
    if (E.veh) {
      E.veh.mesh.position.set(E.x, y, E.z);
      E.veh.mesh.rotation.y = E.ry;
      const w = E.veh.mesh.userData.wheels;
      if (w) for (const t of w) t.rotation.x += E.speed * dt * 2.2;
    }
    // bobber en lijn
    const vis = E.fs > 0;
    E.bobber.visible = E.line.visible = vis;
    if (vis) {
      E.h.root.updateMatrixWorld(true);
      E.h.tip.getWorldPosition(tmp);
      const wy = E.pond >= 0 ? PONDS[E.pond].waterY : y,
        fr = E.fs === 3 ? clamp(E.D / 100, 0.08, 1) : 1;
      const bx = E.x + (E.bx - E.x) * fr,
        bz = E.z + (E.bz - E.z) * fr;
      let by = wy + 0.02 + Math.sin(R.world.t * 2.2 + E.id) * 0.015;
      if (E.fs === 2) by -= 0.12 + Math.abs(Math.sin(R.world.t * 18)) * 0.06;
      if (E.fs === 3) by += Math.sin(R.world.t * 25) * 0.02;
      E.bobber.position.set(bx, by, bz);
      const pos = E.line.geometry.attributes.position,
        n = pos.count,
        d = Math.hypot(bx - tmp.x, bz - tmp.z),
        sag = E.fs === 3 ? 0.15 : 0.5 + d * 0.06;
      for (let i = 0; i < n; i++) {
        const t = i / (n - 1);
        pos.setXYZ(i, tmp.x + (bx - tmp.x) * t, tmp.y + (by + 0.3 - tmp.y) * t - Math.sin(t * Math.PI) * sag, tmp.z + (bz - tmp.z) * t);
      }
      pos.needsUpdate = true;
      if (E.fs === 1) {
        E.ripT -= dt;
        if (E.ripT <= 0) {
          E.ripT = 2.2;
          ripple(bx, bz, 0, wy + 0.05);
        }
      } else if (E.fs === 3) {
        E.ripT -= dt;
        if (E.ripT <= 0) {
          E.ripT = 0.35;
          ripple(bx, bz, 1, wy + 0.05);
        }
      }
    }
    if (E.dogM) updateDog(E, dt);
    if (E.bub) {
      E.bubT -= dt;
      if (E.bubT <= 0) {
        E.h.root.remove(E.bub);
        E.bub = null;
      }
    }
  }
}
