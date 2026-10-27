// Visstekken zichtbaar maken: opborrelende bubbels en af en toe een springende vis.
import * as THREE from 'three';
import { PONDS, SPECIES } from '../shared.js';
import * as M from '../models/index.js';
import * as A from '../audio.js';
import { ripple } from './scene.js';
import { G, R, me } from './state.js';

const MAX_BUBBLES = 70,
  VIEW = 90; // alleen stekken binnen deze afstand van de camera
let bubbles = null,
  jumper = null,
  jumpT = 3,
  spawnT = 0,
  next = 0;

function init() {
  // één InstancedMesh voor alle bubbels: goedkoop, ook op een telefoon
  const geo = new THREE.SphereGeometry(0.16, 6, 4),
    mat = new THREE.MeshBasicMaterial({ color: '#e8fbff', transparent: true, opacity: 0.75, depthWrite: false });
  bubbles = new THREE.InstancedMesh(geo, mat, MAX_BUBBLES);
  bubbles.frustumCulled = false;
  bubbles.renderOrder = 4;
  bubbles.userData.list = Array.from({ length: MAX_BUBBLES }, () => ({ age: 9, x: 0, y: 0, z: 0, life: 1 }));
  R.scene.add(bubbles);
  // schuimkring op elke stek, goed te zien van een afstand
  const rg = new THREE.RingGeometry(1.2, 1.9, 32).rotateX(-Math.PI / 2);
  for (let i = 0; i < 8; i++) {
    const m = new THREE.Mesh(rg, new THREE.MeshBasicMaterial({ color: '#f2fbff', transparent: true, opacity: 0, depthWrite: false }));
    m.renderOrder = 3;
    m.visible = false;
    R.scene.add(m);
    rings.push(m);
  }
}
const rings = [];
const tmp = new THREE.Matrix4();
const near = () => {
  const out = [],
    c = R.camera.position;
  for (const [pid, list] of G.hot) for (const [x, z] of list) if (Math.hypot(x - c.x, z - c.z) < VIEW) out.push({ x, z, pond: pid });
  return out;
};

export function updateHotspots(dt) {
  if (!bubbles) init();
  const spots = near(),
    L = bubbles.userData.list;
  // nieuwe bubbels
  if (spots.length && (spawnT -= dt) <= 0) {
    spawnT = 0.06;
    const s = spots[(Math.random() * spots.length) | 0],
      b = L[next++ % MAX_BUBBLES];
    const a = Math.random() * 6.28,
      r = Math.random() * 2.2;
    Object.assign(b, {
      age: 0,
      life: 0.8 + Math.random() * 0.7,
      x: s.x + Math.cos(a) * r,
      z: s.z + Math.sin(a) * r,
      y: PONDS[s.pond].waterY + 0.02,
    });
    if (Math.hypot(s.x - me.x, s.z - me.z) < 14 && Math.random() < 0.2) A.sfx.bubble();
  }
  for (let i = 0; i < MAX_BUBBLES; i++) {
    const b = L[i];
    b.age += dt;
    const k = b.age / b.life,
      s = k < 1 ? 0.6 + k * 0.9 : 0;
    tmp.makeScale(s, s * 0.6, s).setPosition(b.x, b.y + k * 0.12, b.z);
    bubbles.setMatrixAt(i, tmp);
  }
  bubbles.instanceMatrix.needsUpdate = true;
  const tt = performance.now() / 1000;
  rings.forEach((m, i) => {
    const s = spots[i];
    m.visible = !!s;
    if (!s) return;
    const k = (tt * 0.5 + i * 0.37) % 1;
    m.position.set(s.x, PONDS[s.pond].waterY + 0.05, s.z);
    m.scale.setScalar(0.6 + k * 1.4);
    m.material.opacity = 0.45 * (1 - k);
  });
  // springende vis
  if (jumper?.visible) {
    const u = jumper.userData;
    u.t += dt;
    const k = u.t / 0.9;
    if (k >= 1) {
      jumper.visible = false;
      ripple(u.x1, u.z1, 0, u.y + 0.05);
    } else {
      jumper.position.set(u.x0 + (u.x1 - u.x0) * k, u.y + Math.sin(k * Math.PI) * 1.1, u.z0 + (u.z1 - u.z0) * k);
      jumper.rotation.z = (0.5 - k) * 2.2;
    }
  } else if (spots.length && (jumpT -= dt) <= 0) {
    jumpT = 4 + Math.random() * 6;
    const s = spots[(Math.random() * spots.length) | 0],
      list = SPECIES.filter(x => x.pond === s.pond && !x.leg);
    if (!jumper || jumper.userData.pond !== s.pond) {
      if (jumper) R.scene.remove(jumper);
      jumper = M.makeFish(list[(Math.random() * list.length) | 0], null);
      jumper.scale.setScalar(0.5);
      R.scene.add(jumper);
    }
    const a = Math.random() * 6.28,
      y = PONDS[s.pond].waterY;
    jumper.userData = {
      ...jumper.userData,
      pond: s.pond,
      t: 0,
      y,
      x0: s.x,
      z0: s.z,
      x1: s.x + Math.cos(a) * 1.6,
      z1: s.z + Math.sin(a) * 1.6,
    };
    jumper.rotation.y = -a;
    jumper.visible = true;
    ripple(s.x, s.z, 0, y + 0.05);
  }
}
