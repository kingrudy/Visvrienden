// Biomen (kleuren per gebied) en de geometrie van bomen, struiken, riet en rotsen.
import * as THREE from 'three';

export const C = s => new THREE.Color(s);

export const BIOME = {
  meadow: { g1: C('#5f9a45'), g2: C('#7cb14f'), sand: C('#d3c08e'), w1: C('#4fa8b8'), w2: C('#1f5a78') },
  forest: { g1: C('#2f6a34'), g2: C('#44803c'), sand: C('#a89a6a'), w1: C('#3f8a80'), w2: C('#17484f') },
  swamp: { g1: C('#5a6a35'), g2: C('#46562c'), sand: C('#6a5a3a'), w1: C('#6f8a4c'), w2: C('#2e4a30') },
  mountain: { g1: C('#58803f'), g2: C('#7a7a74'), sand: C('#9a9a90'), w1: C('#4fb0d0'), w2: C('#1a5a8a') },
  snow: { g1: C('#eef4f8'), g2: C('#d8e6f0'), sand: C('#c0d0dc'), w1: C('#9ad0e8'), w2: C('#3a78a8') },
  tropic: { g1: C('#5aa84a'), g2: C('#7ac050'), sand: C('#eedc9c'), w1: C('#38e0d0'), w2: C('#0a8aa8') },
  spring: { g1: C('#7ac062'), g2: C('#9ad070'), sand: C('#d8d4a0'), w1: C('#7ae8d8'), w2: C('#2a9ab0') },
  moon: { g1: C('#4a5a8a'), g2: C('#5e6ea0'), sand: C('#8a90b8'), w1: C('#8a8aff'), w2: C('#2a2a7a') },
};

/* ---- losse geometrieën samenvoegen tot één mesh met vertexkleuren */
function merged(parts) {
  const pos = [],
    nor = [],
    col = [],
    idx = [];
  let base = 0;
  for (const { geo, color, m } of parts) {
    const g = geo;
    const p = g.attributes.position,
      n = g.attributes.normal,
      c = C(color),
      nm = new THREE.Matrix3().getNormalMatrix(m),
      v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).applyMatrix4(m);
      pos.push(v.x, v.y, v.z);
      v.fromBufferAttribute(n, i).applyMatrix3(nm).normalize();
      nor.push(v.x, v.y, v.z);
      col.push(c.r, c.g, c.b);
    }
    if (g.index) for (let i = 0; i < g.index.count; i++) idx.push(g.index.getX(i) + base);
    else for (let i = 0; i < p.count; i++) idx.push(base + i);
    base += p.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  out.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  out.setIndex(idx);
  return out;
}
const T = (x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) =>
  new THREE.Matrix4().compose(
    new THREE.Vector3(x, y, z),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)),
    new THREE.Vector3(sx, sy, sz),
  );
const cylG = new THREE.CylinderGeometry(0.5, 0.5, 1, 6),
  coneG = new THREE.ConeGeometry(0.5, 1, 7),
  icoG = new THREE.IcosahedronGeometry(0.5, 0);

export const TREE_GEO = {
  pine: () =>
    merged([
      { geo: cylG, color: '#5a3a20', m: T(0, 0.7, 0, 0, 0, 0, 0.5, 1.4, 0.5) },
      { geo: coneG, color: '#2e6a3a', m: T(0, 2.3, 0, 0, 0, 0, 3.2, 2.6, 3.2) },
      { geo: coneG, color: '#357a40', m: T(0, 3.8, 0, 0, 0, 0, 2.5, 2.4, 2.5) },
      { geo: coneG, color: '#3d8a48', m: T(0, 5.2, 0, 0, 0, 0, 1.7, 2.2, 1.7) },
    ]),
  snowpine: () =>
    merged([
      { geo: cylG, color: '#5a3a20', m: T(0, 0.7, 0, 0, 0, 0, 0.5, 1.4, 0.5) },
      { geo: coneG, color: '#e8f0f6', m: T(0, 2.3, 0, 0, 0, 0, 3.2, 2.6, 3.2) },
      { geo: coneG, color: '#dce8f0', m: T(0, 3.8, 0, 0, 0, 0, 2.5, 2.4, 2.5) },
      { geo: coneG, color: '#f6fafc', m: T(0, 5.2, 0, 0, 0, 0, 1.7, 2.2, 1.7) },
      { geo: coneG, color: '#2e5a4a', m: T(0, 2.0, 0, 0, 0, 0, 3.4, 2.2, 3.4) },
    ]),
  oak: () =>
    merged([
      { geo: cylG, color: '#6a4a2a', m: T(0, 1.1, 0, 0, 0, 0, 0.6, 2.2, 0.6) },
      { geo: icoG, color: '#4a9a3a', m: T(0, 3.4, 0, 0, 0, 0, 3.6, 3, 3.6) },
      { geo: icoG, color: '#5aaa44', m: T(1, 3.9, 0.5, 0, 0, 0, 2.4, 2.2, 2.4) },
      { geo: icoG, color: '#3e8a34', m: T(-1, 3.0, -0.6, 0, 0, 0, 2.6, 2.2, 2.6) },
    ]),
  birch: () =>
    merged([
      { geo: cylG, color: '#e8e4d8', m: T(0, 1.5, 0, 0, 0, 0, 0.35, 3, 0.35) },
      { geo: icoG, color: '#8ac050', m: T(0, 3.8, 0, 0, 0, 0, 2.4, 2.6, 2.4) },
      { geo: icoG, color: '#a0d060', m: T(0.6, 4.3, 0.3, 0, 0, 0, 1.6, 1.6, 1.6) },
    ]),
  palm: () =>
    merged([
      { geo: cylG, color: '#9a7a4a', m: T(0, 1.8, 0, 0, 0, 0.12, 0.4, 3.6, 0.4) },
      { geo: cylG, color: '#8a6a3a', m: T(0.4, 4.1, 0, 0, 0, 0.25, 0.32, 1.2, 0.32) },
      ...Array.from({ length: 7 }, (_, i) => ({
        geo: coneG,
        color: i % 2 ? '#3a9a3a' : '#4aaa44',
        m: T(
          0.55 + Math.cos((i / 7) * 6.28) * 1.0,
          4.5,
          Math.sin((i / 7) * 6.28) * 1.0,
          Math.sin((i / 7) * 6.28) * 1.2,
          0,
          -Math.cos((i / 7) * 6.28) * 1.2 + 0,
          0.5,
          2.4,
          0.18,
        ),
      })),
      { geo: icoG, color: '#6a4a2a', m: T(0.5, 4.2, 0.1, 0, 0, 0, 0.4, 0.4, 0.4) },
    ]),
  dead: () =>
    merged([
      { geo: cylG, color: '#4a4036', m: T(0, 1.6, 0, 0, 0, 0.05, 0.35, 3.2, 0.35) },
      { geo: cylG, color: '#4a4036', m: T(0.6, 3, 0, 0, 0, -0.9, 0.16, 1.6, 0.16) },
      { geo: cylG, color: '#4a4036', m: T(-0.5, 2.6, 0.2, 0.3, 0, 0.9, 0.14, 1.4, 0.14) },
      { geo: cylG, color: '#4a4036', m: T(0.1, 3.5, -0.4, -0.8, 0, 0.1, 0.12, 1.2, 0.12) },
    ]),
  moontree: () =>
    merged([
      { geo: cylG, color: '#4a3a5a', m: T(0, 1.1, 0, 0, 0, 0, 0.5, 2.2, 0.5) },
      { geo: icoG, color: '#7a6ad8', m: T(0, 3.4, 0, 0, 0, 0, 3.4, 3, 3.4) },
      { geo: icoG, color: '#9a8aff', m: T(0.9, 4, 0.4, 0, 0, 0, 2, 2, 2) },
    ]),
  bush: () =>
    merged([
      { geo: icoG, color: '#4a8a3a', m: T(0, 0.4, 0, 0, 0, 0, 1.4, 0.9, 1.4) },
      { geo: icoG, color: '#5a9a44', m: T(0.4, 0.5, 0.2, 0, 0, 0, 0.9, 0.7, 0.9) },
    ]),
  rock: () =>
    merged([
      { geo: icoG, color: '#8a8a86', m: T(0, 0.4, 0, 0.3, 0.5, 0.1, 1.8, 1.1, 1.5) },
      { geo: icoG, color: '#9a9a96', m: T(0.7, 0.25, 0.3, 0, 0, 0, 0.9, 0.6, 0.8) },
    ]),
  reed: () =>
    merged([
      { geo: coneG, color: '#6a8a3a', m: T(0, 0.8, 0, 0, 0, 0.06, 0.08, 1.7, 0.08) },
      { geo: coneG, color: '#7a9a44', m: T(0.15, 0.7, 0.05, 0, 0, -0.14, 0.07, 1.4, 0.07) },
      { geo: coneG, color: '#5a7a30', m: T(-0.12, 0.65, -0.05, 0.1, 0, 0.1, 0.07, 1.3, 0.07) },
      { geo: cylG, color: '#5a3a1a', m: T(0.05, 1.5, 0, 0, 0, 0.05, 0.1, 0.4, 0.1) },
    ]),
};
export const TREE_TINT = {
  pine: 0.18,
  snowpine: 0.05,
  oak: 0.2,
  birch: 0.15,
  palm: 0.15,
  dead: 0.1,
  moontree: 0.12,
  bush: 0.25,
  rock: 0.1,
  reed: 0.15,
};
