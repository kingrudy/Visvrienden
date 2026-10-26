// Bouwstenen voor de low-poly modellen: gedeelde materialen en vormen, en naamlabels.
import * as THREE from 'three';

const matCache = new Map();
export function mat(color, o = {}) {
  const key = color + JSON.stringify(o);
  let m = matCache.get(key);
  if (!m) {
    m = new THREE.MeshLambertMaterial({ color, flatShading: true, ...o });
    matCache.set(key, m);
  }
  return m;
}
export const BOX = new THREE.BoxGeometry(1, 1, 1),
  SPH = new THREE.SphereGeometry(0.5, 10, 8),
  SPH_LO = new THREE.SphereGeometry(0.5, 7, 5);
export const CYL = new THREE.CylinderGeometry(0.5, 0.5, 1, 8),
  CONE = new THREE.ConeGeometry(0.5, 1, 8),
  TORUS = new THREE.TorusGeometry(0.5, 0.08, 6, 14);
export const G = { BOX, SPH, SPH_LO, CYL, CONE, TORUS };
const put = (m, p, x, y, z) => {
  m.position.set(x, y, z);
  if (p) p.add(m);
  return m;
};
export const box = (p, c, w, h, d, x = 0, y = 0, z = 0, o) => {
  const m = new THREE.Mesh(BOX, mat(c, o));
  m.scale.set(w, h, d);
  return put(m, p, x, y, z);
};
export const sph = (p, c, w, h, d, x = 0, y = 0, z = 0, o) => {
  const m = new THREE.Mesh(SPH, mat(c, o));
  m.scale.set(w, h, d);
  return put(m, p, x, y, z);
};
export const cyl = (p, c, rx, h, rz, x = 0, y = 0, z = 0, o) => {
  const m = new THREE.Mesh(CYL, mat(c, o));
  m.scale.set(rx * 2, h, rz * 2);
  return put(m, p, x, y, z);
};
export const cone = (p, c, rx, h, rz, x = 0, y = 0, z = 0, o) => {
  const m = new THREE.Mesh(CONE, mat(c, o));
  m.scale.set(rx * 2, h, rz * 2);
  return put(m, p, x, y, z);
};
export const emis = (c, i = 1) => ({ emissive: c, emissiveIntensity: i });

export function label(text, color = '#ffffff', size = 28) {
  const c = document.createElement('canvas'),
    ctx = c.getContext('2d');
  c.width = 256;
  c.height = 64;
  ctx.font = `bold ${size}px system-ui,sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 6;
  ctx.strokeStyle = 'rgba(0,0,0,.65)';
  ctx.strokeText(text, 128, 34);
  ctx.fillStyle = color;
  ctx.fillText(text, 128, 34);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthTest: false, fog: false }));
  s.scale.set(2.6, 0.65, 1);
  s.renderOrder = 10;
  return s;
}
