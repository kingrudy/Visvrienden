// Winkels, borden, kampvuren, hekken, steigers, dobbers en het prikbord.
import * as THREE from 'three';
import { box, cone, cyl, emis, sph } from './core.js';

/* ------------------------------------------------------------------ gebouwen en dingen */
export function signTexture(lines, w = 256, h = 128, bg = '#6a4a28', fg = '#ffe9b0') {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const x = c.getContext('2d');
  x.fillStyle = bg;
  x.fillRect(0, 0, w, h);
  x.strokeStyle = '#3a2410';
  x.lineWidth = 8;
  x.strokeRect(4, 4, w - 8, h - 8);
  x.fillStyle = fg;
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  lines.forEach((l, i) => {
    x.font = `bold ${i === 0 ? 30 : 22}px system-ui,sans-serif`;
    x.fillText(l, w / 2, (h / (lines.length + 1)) * (i + 1));
  });
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
export function signMesh(lines, w = 2.4, h = 1.2) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: signTexture(lines), fog: true }));
  return m;
}

export function makeShop(kind) {
  const g = new THREE.Group();
  if (kind === 'main') {
    box(g, '#a8784a', 7, 3.2, 5, 0, 1.6, 0);
    box(g, '#c85a3a', 7.8, 0.3, 5.8, 0, 3.4, 0);
    cone(g, '#b8442a', 4.9, 2, 3.8, 0, 4.4, 0).rotation.y = Math.PI / 4;
    box(g, '#3a2410', 1.2, 2.2, 0.15, 0, 1.1, 2.55);
    box(g, '#ffd878', 1.4, 1, 0.1, -2.2, 1.9, 2.52, emis('#ffcc55', 0.9));
    box(g, '#ffd878', 1.4, 1, 0.1, 2.2, 1.9, 2.52, emis('#ffcc55', 0.9));
    const s = signMesh(['Hengelwinkel', 'van Dirk'], 4, 1.4);
    s.position.set(0, 3.9, 2.9);
    g.add(s);
    box(g, '#8a5a30', 2.6, 0.9, 1.2, 3.8, 0.45, 3.4);
    box(g, '#5a8ac8', 0.6, 0.1, 2.4, 3.8, 1.05, 3.4).rotation.y = 0.4;
    for (let i = 0; i < 4; i++) cyl(g, '#d8b878', 0.03, 2.8, 0.03, -3.4 + i * 0.5, 1.6, 3.2).rotation.z = 0.15 * (i - 1.5);
  } else if (kind === 'smith') {
    box(g, '#7a7a80', 5, 3, 4, 0, 1.5, 0);
    box(g, '#4a4a50', 5.6, 0.3, 4.6, 0, 3.1, 0);
    cone(g, '#3a3a40', 3.7, 1.6, 3.2, 0, 4, 0).rotation.y = Math.PI / 4;
    box(g, '#222', 0.9, 0.7, 0.5, 2.9, 0.35, 1.8);
    box(g, '#555', 1.1, 0.25, 0.4, 2.9, 0.82, 1.8);
    box(g, '#ff7a2a', 1.4, 0.8, 0.12, -1.3, 1.1, 2.02, emis('#ff6a1a', 1.2));
    box(g, '#3a2410', 1, 2.1, 0.15, 1.2, 1.05, 2.02);
    const s = signMesh(['Hengelsmid', 'Marga'], 3.4, 1.2);
    s.position.set(0, 3.6, 2.4);
    g.add(s);
    cyl(g, '#555', 0.35, 2.2, 0.35, -2.3, 4.2, -1.2);
  } else {
    box(g, '#a8784a', 3.4, 0.9, 1.6, 0, 0.45, 0);
    for (const x of [-1.5, 1.5]) box(g, '#6a4a28', 0.14, 2.6, 0.14, x, 1.3, 0.7);
    box(g, '#3a8ac8', 3.8, 0.12, 2.4, 0, 2.7, 0.2).rotation.x = 0.18;
    box(g, '#f2f2f2', 3.8, 0.1, 0.5, 0, 2.55, 1.2).rotation.x = 0.18;
    box(g, '#c85a3a', 0.5, 0.35, 0.5, -1, 1.1, 0);
    box(g, '#e8c84a', 0.5, 0.35, 0.5, -0.3, 1.1, 0.1);
    box(g, '#5a9a5a', 0.5, 0.35, 0.5, 0.5, 1.1, 0);
    const s = signMesh(['Aas & Vis'], 2.2, 0.8);
    s.position.set(0, 3.2, 1.1);
    g.add(s);
  }
  return g;
}
export function makeCampfire() {
  const g = new THREE.Group();
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    cyl(g, '#6a4020', 0.08, 0.9, 0.08, Math.cos(a) * 0.35, 0.2, Math.sin(a) * 0.35).rotation.set(Math.sin(a) * 1.0, 0, -Math.cos(a) * 1.0);
  }
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    sph(g, '#777', 0.3, 0.22, 0.3, Math.cos(a) * 0.8, 0.1, Math.sin(a) * 0.8);
  }
  const f1 = cone(g, '#ff7a1a', 0.3, 0.9, 0.3, 0, 0.55, 0, emis('#ff6a10', 1.4)),
    f2 = cone(g, '#ffd23a', 0.18, 0.6, 0.18, 0, 0.5, 0, emis('#ffcc20', 1.6));
  // zitbanken
  box(g, '#7a5a30', 1.6, 0.25, 0.4, 0, 0.14, 1.7);
  box(g, '#7a5a30', 1.6, 0.25, 0.4, 0, 0.14, -1.7);
  g.userData = { f1, f2 };
  return g;
}
export function makeGate(open) {
  const g = new THREE.Group();
  for (const x of [-3, 3]) box(g, '#6a4a28', 0.5, 4.4, 0.5, x, 2.2, 0);
  box(g, '#6a4a28', 6.6, 0.5, 0.5, 0, 4.4, 0);
  const l = new THREE.Group(),
    r = new THREE.Group();
  l.position.set(-3, 0, 0);
  r.position.set(3, 0, 0);
  g.add(l, r);
  box(l, '#8a6a3a', 2.8, 2.2, 0.15, 1.4, 1.3, 0);
  box(r, '#8a6a3a', 2.8, 2.2, 0.15, -1.4, 1.3, 0);
  g.userData = { l, r };
  return g;
}
export function makeJetty(j) {
  const g = new THREE.Group();
  const n = Math.ceil(j.len / 0.55);
  for (let i = 0; i < n; i++) box(g, i % 2 ? '#9a7040' : '#8a6030', 0.5, 0.1, j.w, i * 0.55 + 0.25, 0, 0);
  for (let i = 0; i <= j.len; i += 3) for (const s of [-1, 1]) cyl(g, '#5a3a1a', 0.1, 2.8, 0.1, i, -1.3, s * (j.w / 2 - 0.1));
  g.rotation.y = -j.ang;
  return g;
}
export function makeBobber(color = '#e8402a') {
  const g = new THREE.Group();
  sph(g, '#f6f6f6', 0.16, 0.16, 0.16, 0, 0.03, 0);
  sph(g, color, 0.16, 0.12, 0.16, 0, 0.1, 0);
  cyl(g, '#222', 0.012, 0.25, 0.012, 0, 0.25, 0);
  return g;
}
export function makeBoard() {
  const g = new THREE.Group();
  for (const x of [-1, 1]) box(g, '#5a3a1a', 0.18, 2.4, 0.18, x, 1.2, 0);
  const s = signMesh(['Prikbord', 'wedstrijden · geruchten', 'ranglijst'], 2.6, 1.5);
  s.position.set(0, 1.9, 0.12);
  g.add(s);
  box(g, '#8a6a3a', 2.8, 1.7, 0.1, 0, 1.9, 0);
  return g;
}
