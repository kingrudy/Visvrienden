// Vissen in cartoonstijl; kleuren per soort zijn hier aan te passen (FISH_STYLE).
import * as THREE from 'three';
import { BOX, CONE, SPH, SPH_LO, box } from './core.js';
import { addOutline, toonMat } from './shading.js';

/* ------------------------------------------------------------------ vissen */
const SHAPES = {
  slank: [1, 0.24, 0.14],
  rond: [0.8, 0.42, 0.18],
  plat: [0.75, 0.5, 0.1],
  lang: [1.3, 0.2, 0.14],
  snoek: [1.4, 0.2, 0.17],
  paling: [1.9, 0.09, 0.09],
  kat: [1.25, 0.28, 0.3],
};
export const FISH_STYLE = { goudvis: { body: '#ff9a2a' } };
const cheer = (hex, k = 1) => {
  const c = new THREE.Color(hex),
    h = {};
  c.getHSL(h);
  c.setHSL(h.h, Math.min(1, h.s * 1.3 + 0.1), Math.min(0.75, Math.max(0.4, h.l * 1.15 + 0.06)));
  return '#' + c.multiplyScalar(k).getHexString();
};
export function fishColors(sp) {
  const o = FISH_STYLE[sp.id] || {},
    body = o.body || cheer(sp.c[0]);
  return { body, belly: o.belly || cheer(sp.c[1], 1.08), fin: o.fin || (o.body ? cheer(o.body, 0.82) : cheer(sp.c[2], 0.82)) };
}
const toon = (p, geo, c, sx, sy, sz, x = 0, y = 0, z = 0) => {
  const m = new THREE.Mesh(geo, toonMat(c));
  m.scale.set(sx, sy, sz);
  m.position.set(x, y, z);
  p.add(m);
  return m;
};
const tbox = (p, c, w, h, d, x, y, z) => toon(p, BOX, c, w, h, d, x, y, z),
  tsph = (p, c, w, h, d, x, y, z) => toon(p, SPH, c, w, h, d, x, y, z),
  tcone = (p, c, rx, h, rz, x, y, z) => toon(p, CONE, c, rx * 2, h, rz * 2, x, y, z);
export function makeFish(sp, glow) {
  const g = new THREE.Group(),
    [len, hgt, wid] = SHAPES[sp.shape] || SHAPES.slank,
    C = fishColors(sp);
  const body = new THREE.Group();
  g.add(body);
  tsph(body, C.body, len * 0.75, hgt, wid, 0, 0, 0);
  tsph(body, C.belly, len * 0.6, hgt * 0.55, wid * 0.9, 0.02, -hgt * 0.22, 0);
  tsph(body, C.body, len * 0.28, hgt * 0.9, wid * 0.85, len * 0.34, 0, 0);
  if (sp.shape === 'snoek') tbox(body, C.body, 0.3, 0.05, 0.1, len * 0.52, -0.02, 0);
  if (sp.shape === 'kat')
    for (const z of [0.1, -0.1]) tbox(body, '#222', 0.18, 0.015, 0.015, len * 0.5, -0.06, z).userData.noOutline = true; // snorharen: geen contour
  const tail = new THREE.Group();
  tail.position.x = -len * 0.34;
  body.add(tail);
  tcone(tail, C.fin, hgt * 0.5, 0.3, wid * 0.4, -0.12, 0, 0).rotation.z = Math.PI / 2;
  tcone(body, C.fin, 0.07, hgt * 0.9, 0.03, 0, hgt * 0.5, 0);
  addOutline(g); // contour eerst, dan pas ogen en gloed (die krijgen er geen)
  box(body, '#111', 0.03, 0.04, wid * 1.05, len * 0.42, hgt * 0.08, 0).userData.noOutline = true; // oog
  if (glow) {
    const m = new THREE.Mesh(SPH_LO, new THREE.MeshBasicMaterial({ color: glow, transparent: true, opacity: 0.28, depthWrite: false }));
    m.scale.set(len * 1.6, hgt * 3, wid * 3.5);
    m.userData.noOutline = true;
    body.add(m);
  }
  g.userData = { tail, len };
  return g;
}
