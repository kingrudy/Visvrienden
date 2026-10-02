// Visvrienden – zelfgebouwde low-poly modellen (geen externe bestanden nodig).
import * as THREE from './vendor/three/three.module.js';

const matCache = new Map();
export function mat(color, o = {}) {
  const key = color + JSON.stringify(o);
  let m = matCache.get(key);
  if (!m) { m = new THREE.MeshLambertMaterial({ color, flatShading: true, ...o }); matCache.set(key, m); }
  return m;
}
const BOX = new THREE.BoxGeometry(1, 1, 1), SPH = new THREE.SphereGeometry(0.5, 10, 8), SPH_LO = new THREE.SphereGeometry(0.5, 7, 5);
const CYL = new THREE.CylinderGeometry(0.5, 0.5, 1, 8), CONE = new THREE.ConeGeometry(0.5, 1, 8), TORUS = new THREE.TorusGeometry(0.5, 0.08, 6, 14);
export const G = { BOX, SPH, SPH_LO, CYL, CONE, TORUS };
const put = (m, p, x, y, z) => { m.position.set(x, y, z); if (p) p.add(m); return m; };
export const box = (p, c, w, h, d, x = 0, y = 0, z = 0, o) => { const m = new THREE.Mesh(BOX, mat(c, o)); m.scale.set(w, h, d); return put(m, p, x, y, z); };
export const sph = (p, c, w, h, d, x = 0, y = 0, z = 0, o) => { const m = new THREE.Mesh(SPH, mat(c, o)); m.scale.set(w, h, d); return put(m, p, x, y, z); };
export const cyl = (p, c, rx, h, rz, x = 0, y = 0, z = 0, o) => { const m = new THREE.Mesh(CYL, mat(c, o)); m.scale.set(rx * 2, h, rz * 2); return put(m, p, x, y, z); };
export const cone = (p, c, rx, h, rz, x = 0, y = 0, z = 0, o) => { const m = new THREE.Mesh(CONE, mat(c, o)); m.scale.set(rx * 2, h, rz * 2); return put(m, p, x, y, z); };
const emis = (c, i = 1) => ({ emissive: c, emissiveIntensity: i });

export function label(text, color = '#ffffff', size = 28) {
  const c = document.createElement('canvas'), ctx = c.getContext('2d'); c.width = 256; c.height = 64;
  ctx.font = `bold ${size}px system-ui,sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(0,0,0,.65)'; ctx.strokeText(text, 128, 34); ctx.fillStyle = color; ctx.fillText(text, 128, 34);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthTest: false, fog: false }));
  s.scale.set(2.6, 0.65, 1); s.renderOrder = 10; return s;
}

/* ------------------------------------------------------------------ Blender-modellen (.glb) */
// Kleine eigen .glb-lader (alleen wat Blender hier exporteert: meshes, kleuren, node-hiërarchie).
export const ANGLERS = [null, null, null, null];
function parseGLB(buf) {
  const dv = new DataView(buf); if (dv.getUint32(0, true) !== 0x46546c67) throw new Error('geen glb');
  let off = 12, json = null, bin = null;
  while (off < buf.byteLength) { const len = dv.getUint32(off, true), type = dv.getUint32(off + 4, true); const chunk = buf.slice(off + 8, off + 8 + len); if (type === 0x4e4f534a) json = JSON.parse(new TextDecoder().decode(chunk)); else if (type === 0x004e4942) bin = chunk; off += 8 + len; }
  const NC = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }, CT = { 5120: Int8Array, 5121: Uint8Array, 5122: Int16Array, 5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array };
  const acc = i => {
    const a = json.accessors[i], bv = json.bufferViews[a.bufferView], T = CT[a.componentType], n = NC[a.type], base = (bv.byteOffset || 0) + (a.byteOffset || 0), stride = bv.byteStride;
    if (!stride || stride === T.BYTES_PER_ELEMENT * n) return new T(bin.slice(base, base + a.count * n * T.BYTES_PER_ELEMENT));
    const out = new T(a.count * n), src = new DataView(bin); for (let k = 0; k < a.count; k++) for (let j = 0; j < n; j++) { const o = base + k * stride + j * T.BYTES_PER_ELEMENT; out[k * n + j] = T === Float32Array ? src.getFloat32(o, true) : T === Uint16Array ? src.getUint16(o, true) : T === Uint32Array ? src.getUint32(o, true) : src.getUint8(o); }
    return out;
  };
  const mats = (json.materials || []).map(m => { const f = m.pbrMetallicRoughness?.baseColorFactor || [1, 1, 1, 1]; return new THREE.MeshLambertMaterial({ color: new THREE.Color().setRGB(f[0], f[1], f[2], THREE.LinearSRGBColorSpace) }); });
  const meshes = json.meshes.map(me => me.primitives.map(p => {
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(acc(p.attributes.POSITION), 3));
    if (p.attributes.NORMAL) g.setAttribute('normal', new THREE.BufferAttribute(acc(p.attributes.NORMAL), 3)); else g.computeVertexNormals();
    if (p.indices !== undefined) g.setIndex(new THREE.BufferAttribute(acc(p.indices), 1));
    return new THREE.Mesh(g, mats[p.material] || new THREE.MeshLambertMaterial({ color: '#cccccc' }));
  }));
  const nodes = json.nodes.map(nd => {
    const o = new THREE.Group(); o.name = nd.name || '';
    if (nd.matrix) o.applyMatrix4(new THREE.Matrix4().fromArray(nd.matrix)); else { if (nd.translation) o.position.fromArray(nd.translation); if (nd.rotation) o.quaternion.fromArray(nd.rotation); if (nd.scale) o.scale.fromArray(nd.scale); }
    if (nd.mesh !== undefined) for (const m of meshes[nd.mesh]) o.add(m.clone());
    return o;
  });
  json.nodes.forEach((nd, i) => (nd.children || []).forEach(c => nodes[i].add(nodes[c])));
  const sc = json.scenes[json.scene || 0], out = new THREE.Group();
  for (const i of sc.nodes) out.add(nodes[i]);
  out.traverse(o => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });
  return out;
}
export async function loadAnglers(base = 'models/') {
  await Promise.all([0, 1, 2, 3].map(async i => { try { const r = await fetch(`${base}angler${i}.glb`); if (!r.ok) return; ANGLERS[i] = parseGLB(await r.arrayBuffer()); } catch (e) { console.warn('angler' + i, e.message); } }));
  return ANGLERS.filter(Boolean).length;
}

/* ------------------------------------------------------------------ visser */
const LOOKS = [
  { shirt: '#c8423a', pants: '#3a4a6a', hat: 'bucket', hatC: '#e8c84a', skin: '#f1c9a5' },
  { shirt: '#3a78c8', pants: '#4a4a3a', hat: 'cap', hatC: '#2f8a4a', skin: '#d8a07a' },
  { shirt: '#4a8a4a', pants: '#6a5a3a', hat: 'straw', hatC: '#e0c878', skin: '#a8714f' },
  { shirt: '#e8962a', pants: '#2a3a4a', hat: 'hood', hatC: '#f2d23a', skin: '#f6d7bd' },
];
export function makeHuman(look = 0, rodColor = '#c8a458') {
  const L = LOOKS[look % 4], root = new THREE.Group(), tpl = ANGLERS[look % 4]; let body, legL, legR, armL, armR, head;
  if (tpl) {      // Blender-model (public/models/anglerN.glb)
    const t = tpl.clone(true); root.add(t); const g = n => t.getObjectByName(n);
    body = g('body'); legL = g('legL'); legR = g('legR'); armL = g('armL'); armR = g('armR'); head = g('head');
  } else {
  body = new THREE.Group(); root.add(body);
  legL = new THREE.Group(); legR = new THREE.Group(); legL.position.set(-0.12, 0.85, 0); legR.position.set(0.12, 0.85, 0); body.add(legL, legR);
  box(legL, L.pants, 0.2, 0.85, 0.22, 0, -0.42, 0); box(legR, L.pants, 0.2, 0.85, 0.22, 0, -0.42, 0);
  box(legL, '#3a2a20', 0.22, 0.12, 0.3, 0, -0.84, 0.04); box(legR, '#3a2a20', 0.22, 0.12, 0.3, 0, -0.84, 0.04);
  box(body, L.shirt, 0.5, 0.62, 0.3, 0, 1.17, 0);
  armL = new THREE.Group(); armR = new THREE.Group(); armL.position.set(-0.33, 1.42, 0); armR.position.set(0.33, 1.42, 0); body.add(armL, armR);
  box(armL, L.shirt, 0.14, 0.34, 0.15, 0, -0.15, 0); box(armL, L.skin, 0.12, 0.3, 0.13, 0, -0.45, 0);
  box(armR, L.shirt, 0.14, 0.34, 0.15, 0, -0.15, 0); box(armR, L.skin, 0.12, 0.3, 0.13, 0, -0.45, 0);
  head = new THREE.Group(); head.position.y = 1.72; body.add(head);
  sph(head, L.skin, 0.32, 0.34, 0.32, 0, 0, 0); box(head, '#222', 0.05, 0.05, 0.02, -0.08, 0.02, 0.16); box(head, '#222', 0.05, 0.05, 0.02, 0.08, 0.02, 0.16);
  if (L.hat === 'bucket') { cyl(head, L.hatC, 0.2, 0.16, 0.2, 0, 0.17, 0); cyl(head, L.hatC, 0.3, 0.03, 0.3, 0, 0.1, 0); }
  else if (L.hat === 'cap') { sph(head, L.hatC, 0.34, 0.26, 0.34, 0, 0.08, 0); box(head, L.hatC, 0.3, 0.03, 0.2, 0, 0.05, 0.22); }
  else if (L.hat === 'straw') { cyl(head, L.hatC, 0.19, 0.14, 0.19, 0, 0.18, 0); cyl(head, L.hatC, 0.42, 0.025, 0.42, 0, 0.1, 0); }
  else { sph(head, L.hatC, 0.4, 0.4, 0.4, 0, 0.02, -0.02); box(head, L.skin, 0.2, 0.2, 0.05, 0, 0, 0.16); }
  }
  // hengel
  const rod = new THREE.Group(); rod.position.set(0.34, 0.98, 0.1); body.add(rod);
  const shaft = cyl(rod, rodColor, 0.018, 2.5, 0.018, 0, 1.2, 0); box(rod, '#333', 0.07, 0.07, 0.2, 0, 0.1, 0);
  const tip = new THREE.Object3D(); tip.position.set(0, 2.45, 0); rod.add(tip);
  rod.rotation.x = 0.9;
  const lab = label('', '#fff'); lab.position.y = 2.45; root.add(lab);
  const H = { root, body, legL, legR, armL, armR, head, rod, shaft, tip, lab, t: 0, labText: '', mode: 0 };
  H.setName = (n, color) => { if (H.labText === n) return; H.labText = n; const nl = label(n, color || '#fff'); H.lab.material.map = nl.material.map; H.lab.material.needsUpdate = true; };
  H.setRod = c => { shaft.material = mat(c); };
  H.update = (dt, speed, mode, bend = 0) => {      // mode: 0 los, 1 vissen (hengel vooruit), 2 zittend (voertuig)
    H.t += dt * (2 + speed * 1.3); const s = Math.sin(H.t * 2.4) * Math.min(1, speed / 3) * 0.9;
    if (mode === 2) { legL.rotation.x = -1.2; legR.rotation.x = -1.2; legL.position.y = legR.position.y = 0.75; armL.rotation.x = -0.9; armR.rotation.x = -0.9; body.position.y = -0.1; }
    else { legL.position.y = legR.position.y = 0.85; legL.rotation.x = s; legR.rotation.x = -s; body.position.y = 0; armL.rotation.x = -s * 0.8; armR.rotation.x = mode === 1 ? -1.15 : s * 0.8; }
    const tr = mode === 1 ? 0.65 + bend * 0.35 : 0.25; rod.rotation.x += (tr - rod.rotation.x) * Math.min(1, dt * 6);
    rod.visible = mode !== 2;
  };
  return H;
}

/* ------------------------------------------------------------------ vissen */
const SHAPES = { slank: [1, 0.24, 0.14], rond: [0.8, 0.42, 0.18], plat: [0.75, 0.5, 0.1], lang: [1.3, 0.2, 0.14], snoek: [1.4, 0.2, 0.17], paling: [1.9, 0.09, 0.09], kat: [1.25, 0.28, 0.3] };
export function makeFish(sp, glow) {
  const g = new THREE.Group(), [len, hgt, wid] = SHAPES[sp.shape] || SHAPES.slank, [c1, c2, c3] = sp.c;
  const body = new THREE.Group(); g.add(body);
  sph(body, c1, len * 0.75, hgt, wid, 0, 0, 0); sph(body, c2, len * 0.6, hgt * 0.55, wid * 0.9, 0.02, -hgt * 0.22, 0);
  sph(body, c1, len * 0.28, hgt * 0.9, wid * 0.85, len * 0.34, 0, 0);
  if (sp.shape === 'snoek') box(body, c1, 0.3, 0.05, 0.1, len * 0.52, -0.02, 0);
  if (sp.shape === 'kat') { box(body, '#222', 0.18, 0.015, 0.015, len * 0.5, -0.06, 0.1); box(body, '#222', 0.18, 0.015, 0.015, len * 0.5, -0.06, -0.1); }
  const tail = new THREE.Group(); tail.position.x = -len * 0.34; body.add(tail);
  cone(tail, c3, hgt * 0.5, 0.3, wid * 0.4, -0.12, 0, 0).rotation.z = Math.PI / 2;
  const dors = cone(body, c3, 0.07, hgt * 0.9, 0.03, 0, hgt * 0.5, 0);
  box(body, '#111', 0.03, 0.04, wid * 1.05, len * 0.42, hgt * 0.08, 0);
  if (glow) { const m = new THREE.Mesh(SPH_LO, new THREE.MeshBasicMaterial({ color: glow, transparent: true, opacity: 0.28, depthWrite: false })); m.scale.set(len * 1.6, hgt * 3, wid * 3.5); body.add(m); }
  g.userData = { tail, len };
  return g;
}

/* ------------------------------------------------------------------ hond, reiger, eend */
const DOG_COLS = ['#b8844a', '#e8d8b8', '#5a3a2a', '#8a8a8a'];
export function makeDog(i = 0) {
  const c = DOG_COLS[i % 4], g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  box(body, c, 0.3, 0.3, 0.7, 0, 0.45, 0); const head = new THREE.Group(); head.position.set(0, 0.7, 0.4); body.add(head);
  box(head, c, 0.26, 0.24, 0.26, 0, 0, 0); box(head, '#2a1a1a', 0.1, 0.08, 0.1, 0, -0.03, 0.16); box(head, '#3a2a1a', 0.07, 0.18, 0.05, -0.15, -0.02, 0); box(head, '#3a2a1a', 0.07, 0.18, 0.05, 0.15, -0.02, 0);
  const tail = new THREE.Group(); tail.position.set(0, 0.55, -0.35); body.add(tail); box(tail, c, 0.06, 0.06, 0.3, 0, 0.1, -0.12).rotation.x = 0.7;
  const legs = [[-0.1, 0.3], [0.1, 0.3], [-0.1, -0.3], [0.1, -0.3]].map(([x, z]) => { const l = new THREE.Group(); l.position.set(x, 0.32, z); body.add(l); box(l, c, 0.09, 0.32, 0.09, 0, -0.16, 0); return l; });
  g.userData = { legs, tail, head, body, t: Math.random() * 9 };
  g.userData.update = (dt, speed) => { const u = g.userData; u.t += dt * (3 + speed * 3); const s = Math.sin(u.t * 2) * Math.min(1, speed / 2) * 0.8; legs[0].rotation.x = s; legs[3].rotation.x = s; legs[1].rotation.x = -s; legs[2].rotation.x = -s; tail.rotation.y = Math.sin(u.t * 3) * 0.6; body.position.y = Math.abs(Math.sin(u.t * 2)) * 0.03 * Math.min(1, speed); };
  return g;
}
export function makeHeron() {
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  cyl(body, '#c8a060', 0.012, 0.9, 0.012, -0.05, 0.45, 0); cyl(body, '#c8a060', 0.012, 0.9, 0.012, 0.05, 0.45, 0);
  sph(body, '#a8b4c0', 0.28, 0.3, 0.55, 0, 1.0, 0);
  const neck = new THREE.Group(); neck.position.set(0, 1.1, 0.2); body.add(neck);
  cyl(neck, '#e8eef4', 0.035, 0.45, 0.035, 0, 0.22, 0.05).rotation.x = 0.35; sph(neck, '#e8eef4', 0.11, 0.11, 0.13, 0, 0.47, 0.12); cone(neck, '#e8a838', 0.025, 0.28, 0.025, 0, 0.45, 0.28).rotation.x = Math.PI / 2;
  box(neck, '#111', 0.02, 0.1, 0.12, 0, 0.5, 0.04);
  const wingL = new THREE.Group(), wingR = new THREE.Group(); wingL.position.set(-0.14, 1.05, 0); wingR.position.set(0.14, 1.05, 0); body.add(wingL, wingR);
  box(wingL, '#8a96a4', 0.55, 0.02, 0.4, -0.27, 0, 0); box(wingR, '#8a96a4', 0.55, 0.02, 0.4, 0.27, 0, 0);
  g.userData = { body, wingL, wingR, neck };
  return g;
}
export function makeDuck() {
  const g = new THREE.Group(), c = Math.random() < 0.5 ? '#7a5a3a' : '#e8e0c8';
  sph(g, c, 0.32, 0.22, 0.46, 0, 0.1, 0); sph(g, '#2a6a3a', 0.16, 0.16, 0.16, 0, 0.3, 0.2); box(g, '#e8a020', 0.08, 0.03, 0.12, 0, 0.28, 0.32); box(g, c, 0.18, 0.1, 0.16, 0, 0.18, -0.26);
  return g;
}

/* ------------------------------------------------------------------ vervoer */
export function makeBoat() {
  const g = new THREE.Group();
  box(g, '#8a5a30', 1.1, 0.35, 2.6, 0, 0.1, 0); box(g, '#8a5a30', 0.7, 0.35, 0.8, 0, 0.1, 1.55).rotation.y = 0; box(g, '#a87040', 0.8, 0.06, 1.8, 0, 0.3, -0.1);
  box(g, '#c8d8e0', 1.12, 0.06, 2.62, 0, 0.28, 0, { transparent: true, opacity: 0 });
  box(g, '#6a4020', 0.08, 0.08, 1.6, -0.62, 0.45, 0).rotation.y = 0.2; box(g, '#6a4020', 0.08, 0.08, 1.6, 0.62, 0.45, 0).rotation.y = -0.2;
  g.userData.seatY = 0.28; return g;
}
export function makeBike(scooter = false) {
  const g = new THREE.Group(), w = scooter ? 0.28 : 0.4;
  const wheel = z => { const t = new THREE.Mesh(TORUS, mat('#222')); t.scale.set(w * 2, w * 2, 1.5); t.rotation.y = Math.PI / 2; t.position.set(0, w, z); g.add(t); return t; };
  g.userData.wheels = [wheel(0.55), wheel(-0.55)];
  box(g, scooter ? '#2a8ac8' : '#c83a3a', 0.08, 0.08, 1.1, 0, w + 0.25, 0); box(g, scooter ? '#2a8ac8' : '#c83a3a', 0.07, 0.6, 0.07, 0, w + 0.45, 0.5);
  box(g, '#222', 0.5, 0.05, 0.05, 0, w + 0.78, 0.5); box(g, '#222', 0.2, 0.06, 0.4, 0, w + 0.42, -0.2);
  if (scooter) { box(g, '#2a8ac8', 0.3, 0.07, 0.9, 0, 0.18, 0); }
  g.userData.seatY = w + 0.35; return g;
}
export function makeCart() {
  const g = new THREE.Group();
  box(g, '#7a4a2a', 1.8, 0.5, 2.8, 0, 0.8, 0); box(g, '#8a5a30', 1.9, 0.6, 0.12, 0, 1.2, 1.4); box(g, '#8a5a30', 1.9, 0.6, 0.12, 0, 1.2, -1.4);
  for (const x of [-1, 1]) for (const z of [-0.9, 0.9]) { const w = new THREE.Mesh(TORUS, mat('#3a2a1a')); w.scale.set(1.5, 1.5, 3); w.rotation.y = Math.PI / 2; w.position.set(x * 0.95, 0.6, z); g.add(w); }
  for (const x of [-0.8, 0.8]) for (const z of [-1.2, 1.2]) box(g, '#6a3a1a', 0.09, 1.6, 0.09, x, 1.9, z);
  box(g, '#8a2ac8', 2.2, 0.1, 3.2, 0, 2.75, 0); cone(g, '#c86ae8', 1.8, 0.7, 2.2, 0, 3.1, 0).rotation.y = Math.PI / 4;
  box(g, '#e8b838', 1.2, 0.5, 1.2, 0, 1.3, 0); box(g, '#c85a5a', 0.7, 0.4, 0.7, 0.3, 1.7, 0.2);
  const lamp = sph(g, '#ffd878', 0.3, 0.3, 0.3, 1.1, 2.4, 1.5, emis('#ffcc55', 1.2)); g.userData.lamp = lamp;
  const mark = label('🧳 Reizende verkoper', '#ffe08a'); mark.position.set(0, 4.3, 0); mark.scale.set(5, 1.25, 1); g.add(mark);
  return g;
}

/* ------------------------------------------------------------------ gebouwen en dingen */
export function signTexture(lines, w = 256, h = 128, bg = '#6a4a28', fg = '#ffe9b0') {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d');
  x.fillStyle = bg; x.fillRect(0, 0, w, h); x.strokeStyle = '#3a2410'; x.lineWidth = 8; x.strokeRect(4, 4, w - 8, h - 8);
  x.fillStyle = fg; x.textAlign = 'center'; x.textBaseline = 'middle';
  lines.forEach((l, i) => { x.font = `bold ${i === 0 ? 30 : 22}px system-ui,sans-serif`; x.fillText(l, w / 2, h / (lines.length + 1) * (i + 1)); });
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
export function signMesh(lines, w = 2.4, h = 1.2) { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: signTexture(lines), fog: true })); return m; }

export function makeShop(kind) {
  const g = new THREE.Group();
  if (kind === 'main') {
    box(g, '#a8784a', 7, 3.2, 5, 0, 1.6, 0); box(g, '#c85a3a', 7.8, 0.3, 5.8, 0, 3.4, 0); cone(g, '#b8442a', 4.9, 2, 3.8, 0, 4.4, 0).rotation.y = Math.PI / 4;
    box(g, '#3a2410', 1.2, 2.2, 0.15, 0, 1.1, 2.55); box(g, '#ffd878', 1.4, 1, 0.1, -2.2, 1.9, 2.52, emis('#ffcc55', 0.9)); box(g, '#ffd878', 1.4, 1, 0.1, 2.2, 1.9, 2.52, emis('#ffcc55', 0.9));
    const s = signMesh(['Hengelwinkel', 'van Dirk'], 4, 1.4); s.position.set(0, 3.9, 2.9); g.add(s);
    box(g, '#8a5a30', 2.6, 0.9, 1.2, 3.8, 0.45, 3.4); box(g, '#5a8ac8', 0.6, 0.1, 2.4, 3.8, 1.05, 3.4).rotation.y = 0.4;
    for (let i = 0; i < 4; i++) cyl(g, '#d8b878', 0.03, 2.8, 0.03, -3.4 + i * 0.5, 1.6, 3.2).rotation.z = 0.15 * (i - 1.5);
  } else if (kind === 'smith') {
    box(g, '#7a7a80', 5, 3, 4, 0, 1.5, 0); box(g, '#4a4a50', 5.6, 0.3, 4.6, 0, 3.1, 0); cone(g, '#3a3a40', 3.7, 1.6, 3.2, 0, 4, 0).rotation.y = Math.PI / 4;
    box(g, '#222', 0.9, 0.7, 0.5, 2.9, 0.35, 1.8); box(g, '#555', 1.1, 0.25, 0.4, 2.9, 0.82, 1.8);
    box(g, '#ff7a2a', 1.4, 0.8, 0.12, -1.3, 1.1, 2.02, emis('#ff6a1a', 1.2)); box(g, '#3a2410', 1, 2.1, 0.15, 1.2, 1.05, 2.02);
    const s = signMesh(['Hengelsmid', 'Marga'], 3.4, 1.2); s.position.set(0, 3.6, 2.4); g.add(s);
    cyl(g, '#555', 0.35, 2.2, 0.35, -2.3, 4.2, -1.2);
  } else {
    box(g, '#a8784a', 3.4, 0.9, 1.6, 0, 0.45, 0); for (const x of [-1.5, 1.5]) box(g, '#6a4a28', 0.14, 2.6, 0.14, x, 1.3, 0.7);
    box(g, '#3a8ac8', 3.8, 0.12, 2.4, 0, 2.7, 0.2).rotation.x = 0.18; box(g, '#f2f2f2', 3.8, 0.1, 0.5, 0, 2.55, 1.2).rotation.x = 0.18;
    box(g, '#c85a3a', 0.5, 0.35, 0.5, -1, 1.1, 0); box(g, '#e8c84a', 0.5, 0.35, 0.5, -0.3, 1.1, 0.1); box(g, '#5a9a5a', 0.5, 0.35, 0.5, 0.5, 1.1, 0);
    const s = signMesh(['Aas & Vis'], 2.2, 0.8); s.position.set(0, 3.2, 1.1); g.add(s);
  }
  return g;
}
export function makeCampfire() {
  const g = new THREE.Group();
  for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; cyl(g, '#6a4020', 0.08, 0.9, 0.08, Math.cos(a) * 0.35, 0.2, Math.sin(a) * 0.35).rotation.set(Math.sin(a) * 1.0, 0, -Math.cos(a) * 1.0); }
  for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; sph(g, '#777', 0.3, 0.22, 0.3, Math.cos(a) * 0.8, 0.1, Math.sin(a) * 0.8); }
  const f1 = cone(g, '#ff7a1a', 0.3, 0.9, 0.3, 0, 0.55, 0, emis('#ff6a10', 1.4)), f2 = cone(g, '#ffd23a', 0.18, 0.6, 0.18, 0, 0.5, 0, emis('#ffcc20', 1.6));
  // zitbanken
  box(g, '#7a5a30', 1.6, 0.25, 0.4, 0, 0.14, 1.7); box(g, '#7a5a30', 1.6, 0.25, 0.4, 0, 0.14, -1.7);
  g.userData = { f1, f2 }; return g;
}
export function makeGate(open) {
  const g = new THREE.Group();
  for (const x of [-3, 3]) box(g, '#6a4a28', 0.5, 4.4, 0.5, x, 2.2, 0);
  box(g, '#6a4a28', 6.6, 0.5, 0.5, 0, 4.4, 0);
  const l = new THREE.Group(), r = new THREE.Group(); l.position.set(-3, 0, 0); r.position.set(3, 0, 0); g.add(l, r);
  box(l, '#8a6a3a', 2.8, 2.2, 0.15, 1.4, 1.3, 0); box(r, '#8a6a3a', 2.8, 2.2, 0.15, -1.4, 1.3, 0);
  g.userData = { l, r }; return g;
}
export function makeJetty(j) {
  const g = new THREE.Group();
  const n = Math.ceil(j.len / 0.55);
  for (let i = 0; i < n; i++) box(g, i % 2 ? '#9a7040' : '#8a6030', 0.5, 0.1, j.w, i * 0.55 + 0.25, 0, 0);
  for (let i = 0; i <= j.len; i += 3) for (const s of [-1, 1]) cyl(g, '#5a3a1a', 0.1, 2.8, 0.1, i, -1.3, s * (j.w / 2 - 0.1));
  g.rotation.y = -j.ang; return g;
}
export function makeBobber(color = '#e8402a') {
  const g = new THREE.Group();
  sph(g, '#f6f6f6', 0.16, 0.16, 0.16, 0, 0.03, 0); sph(g, color, 0.16, 0.12, 0.16, 0, 0.1, 0); cyl(g, '#222', 0.012, 0.25, 0.012, 0, 0.25, 0);
  return g;
}
export function makeBoard() {
  const g = new THREE.Group();
  for (const x of [-1, 1]) box(g, '#5a3a1a', 0.18, 2.4, 0.18, x, 1.2, 0);
  const s = signMesh(['Prikbord', 'wedstrijden · geruchten', 'ranglijst'], 2.6, 1.5); s.position.set(0, 1.9, 0.12); g.add(s); box(g, '#8a6a3a', 2.8, 1.7, 0.1, 0, 1.9, 0);
  return g;
}
