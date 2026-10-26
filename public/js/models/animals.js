// Honden (met Ironman-variant), reigers en eenden.
import * as THREE from 'three';
import { SPH, TORUS, box, cone, cyl, mat, sph } from './core.js';
import { DOGS } from './glb.js';
import { outlineFit, shadeModel } from './shading.js';

/* ------------------------------------------------------------------ hond, reiger, eend */
const DOG_COLS = ['#b8844a', '#e8d8b8', '#5a3a2a', '#8a8a8a'];
const IRON_MAP = { b8844a: '#b5121b', c89658: '#d12a2a', e8d0a0: '#f2b92c', '8a5a2a': '#7d0f17', d8aa70: '#f2b92c', c8423a: '#f2b92c' };
const IRON_GLOW = new Set(['2a1a14', 'e8c84a']); // ogen en penning lichten op (arc reactor-blauw)
function ironmanize(t, rz = 0.43, ry = 0.46) {
  t.traverse(o => {
    const m = /_([0-9a-f]{6})$/.exec(o.name || '');
    if (!m) return;
    for (const ch of o.children)
      if (ch.isMesh) {
        if (IRON_GLOW.has(m[1])) ch.material = new THREE.MeshBasicMaterial({ color: '#8ff0ff' });
        else if (IRON_MAP[m[1]]) ch.material = mat(IRON_MAP[m[1]], { flatShading: false });
      }
  });
  const body = t.getObjectByName('body');
  if (!body) return;
  const rx = new THREE.Group();
  rx.position.set(0, ry, rz);
  body.add(rx);
  const ring = new THREE.Mesh(TORUS, mat('#f2b92c'));
  ring.scale.set(0.15, 0.15, 0.15);
  rx.add(ring);
  const core = new THREE.Mesh(SPH, new THREE.MeshBasicMaterial({ color: '#b8f8ff' }));
  core.scale.set(0.09, 0.09, 0.04);
  rx.add(core);
  const halo = new THREE.Mesh(SPH, new THREE.MeshBasicMaterial({ color: '#6fe4ff', transparent: true, opacity: 0.3, depthWrite: false }));
  halo.scale.set(0.2, 0.2, 0.08);
  rx.add(halo);
}
export function makeDog(i = 0, special = null) {
  const g = makeDogBase(i, special),
    base = g.userData.update,
    u = g.userData;
  u.lying = false;
  u.lieT = 0;
  u.update = (dt, speed) => {
    base(dt, speed);
    u.lieT += ((u.lying ? 1 : 0) - u.lieT) * Math.min(1, dt * 5);
    if (u.lieT > 0.01) {
      // liggend in de mand: lichaam laag, pootjes ingeklapt, kop omlaag, rustig kwispelen
      const k = u.lieT,
        f = x => x * k;
      u.body.position.y = -0.17 * k + Math.sin(u.t * 1.2) * 0.004;
      u.legs[0].rotation.x = f(-1.2);
      u.legs[1].rotation.x = f(-1.2);
      u.legs[2].rotation.x = f(1.15);
      u.legs[3].rotation.x = f(1.15);
      if (u.head) u.head.rotation.x = f(0.3);
      u.tail.rotation.y = Math.sin(u.t * 1.5) * 0.25 * k + u.tail.rotation.y * (1 - k);
    } else if (u.head) u.head.rotation.x = 0;
  };
  shadeModel(g, 1.0);
  outlineFit(g, 0.018);
  return g;
}
function makeDogBase(i = 0, special = null) {
  const tpl = DOGS[special === 'ironman' ? 0 : i % 4];
  if (tpl) {
    // Blender-hond (public/models/dogN.glb, gemaakt met tools/make_dog.py)
    const g = new THREE.Group(),
      t = tpl.clone(true);
    g.add(t);
    const n = k => t.getObjectByName(k);
    if (special === 'ironman') ironmanize(t);
    const legs = [n('legFL'), n('legFR'), n('legBL'), n('legBR')],
      tail = n('tail'),
      head = n('head'),
      body = n('body');
    if (legs.every(Boolean) && tail && head && body) {
      g.userData = { legs, tail, head, body, t: Math.random() * 9 };
      g.userData.update = (dt, speed) => {
        const u = g.userData;
        u.t += dt * (3 + speed * 3);
        const s = Math.sin(u.t * 2) * Math.min(1, speed / 2) * 0.8;
        legs[0].rotation.x = s;
        legs[3].rotation.x = s;
        legs[1].rotation.x = -s;
        legs[2].rotation.x = -s;
        tail.rotation.y = Math.sin(u.t * 3) * 0.6;
        body.position.y = Math.abs(Math.sin(u.t * 2)) * 0.03 * Math.min(1, speed);
      };
      return g;
    }
  }
  const c = special === 'ironman' ? '#b5121b' : DOG_COLS[i % 4],
    g = new THREE.Group(),
    body = new THREE.Group();
  body.name = 'body';
  g.add(body);
  box(body, c, 0.3, 0.3, 0.7, 0, 0.45, 0);
  const head = new THREE.Group();
  head.position.set(0, 0.7, 0.4);
  body.add(head);
  box(head, c, 0.26, 0.24, 0.26, 0, 0, 0);
  box(head, '#2a1a1a', 0.1, 0.08, 0.1, 0, -0.03, 0.16);
  box(head, '#3a2a1a', 0.07, 0.18, 0.05, -0.15, -0.02, 0);
  box(head, '#3a2a1a', 0.07, 0.18, 0.05, 0.15, -0.02, 0);
  const tail = new THREE.Group();
  tail.position.set(0, 0.55, -0.35);
  body.add(tail);
  box(tail, c, 0.06, 0.06, 0.3, 0, 0.1, -0.12).rotation.x = 0.7;
  const legs = [
    [-0.1, 0.3],
    [0.1, 0.3],
    [-0.1, -0.3],
    [0.1, -0.3],
  ].map(([x, z]) => {
    const l = new THREE.Group();
    l.position.set(x, 0.32, z);
    body.add(l);
    box(l, c, 0.09, 0.32, 0.09, 0, -0.16, 0);
    return l;
  });
  g.userData = { legs, tail, head, body, t: Math.random() * 9 };
  g.userData.update = (dt, speed) => {
    const u = g.userData;
    u.t += dt * (3 + speed * 3);
    const s = Math.sin(u.t * 2) * Math.min(1, speed / 2) * 0.8;
    legs[0].rotation.x = s;
    legs[3].rotation.x = s;
    legs[1].rotation.x = -s;
    legs[2].rotation.x = -s;
    tail.rotation.y = Math.sin(u.t * 3) * 0.6;
    body.position.y = Math.abs(Math.sin(u.t * 2)) * 0.03 * Math.min(1, speed);
  };
  if (special === 'ironman') ironmanize(g, 0.37, 0.5);
  return g;
}
export function makeHeron() {
  const g = new THREE.Group(),
    body = new THREE.Group();
  g.add(body);
  cyl(body, '#c8a060', 0.012, 0.9, 0.012, -0.05, 0.45, 0);
  cyl(body, '#c8a060', 0.012, 0.9, 0.012, 0.05, 0.45, 0);
  sph(body, '#a8b4c0', 0.28, 0.3, 0.55, 0, 1.0, 0);
  const neck = new THREE.Group();
  neck.position.set(0, 1.1, 0.2);
  body.add(neck);
  cyl(neck, '#e8eef4', 0.035, 0.45, 0.035, 0, 0.22, 0.05).rotation.x = 0.35;
  sph(neck, '#e8eef4', 0.11, 0.11, 0.13, 0, 0.47, 0.12);
  cone(neck, '#e8a838', 0.025, 0.28, 0.025, 0, 0.45, 0.28).rotation.x = Math.PI / 2;
  box(neck, '#111', 0.02, 0.1, 0.12, 0, 0.5, 0.04);
  const wingL = new THREE.Group(),
    wingR = new THREE.Group();
  wingL.position.set(-0.14, 1.05, 0);
  wingR.position.set(0.14, 1.05, 0);
  body.add(wingL, wingR);
  box(wingL, '#8a96a4', 0.55, 0.02, 0.4, -0.27, 0, 0);
  box(wingR, '#8a96a4', 0.55, 0.02, 0.4, 0.27, 0, 0);
  g.userData = { body, wingL, wingR, neck };
  return g;
}
export function makeDuck() {
  const g = new THREE.Group(),
    c = Math.random() < 0.5 ? '#7a5a3a' : '#e8e0c8';
  sph(g, c, 0.32, 0.22, 0.46, 0, 0.1, 0);
  sph(g, '#2a6a3a', 0.16, 0.16, 0.16, 0, 0.3, 0.2);
  box(g, '#e8a020', 0.08, 0.03, 0.12, 0, 0.28, 0.32);
  box(g, c, 0.18, 0.1, 0.16, 0, 0.18, -0.26);
  return g;
}
