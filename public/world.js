// Visvrienden – de wereld: terrein, water, lucht, bomen, gebouwen, weer.
import * as THREE from './vendor/three/three.module.js';
import * as S from './shared.js';
import * as M from './models.js';
const { PONDS } = S, sm = S.smoothstep;
const C = s => new THREE.Color(s);
const lerpC = (a, b, t) => a.clone().lerp(b, t);

const BIOME = {
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
  const pos = [], nor = [], col = [], idx = []; let base = 0;
  for (const { geo, color, m } of parts) {
    const g = geo;
    const p = g.attributes.position, n = g.attributes.normal, c = C(color), nm = new THREE.Matrix3().getNormalMatrix(m), v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).applyMatrix4(m); pos.push(v.x, v.y, v.z);
      v.fromBufferAttribute(n, i).applyMatrix3(nm).normalize(); nor.push(v.x, v.y, v.z); col.push(c.r, c.g, c.b);
    }
    if (g.index) for (let i = 0; i < g.index.count; i++) idx.push(g.index.getX(i) + base); else for (let i = 0; i < p.count; i++) idx.push(base + i);
    base += p.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); out.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  out.setIndex(idx); return out;
}
const T = (x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));
const cylG = new THREE.CylinderGeometry(0.5, 0.5, 1, 6), coneG = new THREE.ConeGeometry(0.5, 1, 7), icoG = new THREE.IcosahedronGeometry(0.5, 0), boxG = new THREE.BoxGeometry(1, 1, 1);

const TREE_GEO = {
  pine: () => merged([{ geo: cylG, color: '#5a3a20', m: T(0, 0.7, 0, 0, 0, 0, 0.5, 1.4, 0.5) }, { geo: coneG, color: '#2e6a3a', m: T(0, 2.3, 0, 0, 0, 0, 3.2, 2.6, 3.2) }, { geo: coneG, color: '#357a40', m: T(0, 3.8, 0, 0, 0, 0, 2.5, 2.4, 2.5) }, { geo: coneG, color: '#3d8a48', m: T(0, 5.2, 0, 0, 0, 0, 1.7, 2.2, 1.7) }]),
  snowpine: () => merged([{ geo: cylG, color: '#5a3a20', m: T(0, 0.7, 0, 0, 0, 0, 0.5, 1.4, 0.5) }, { geo: coneG, color: '#e8f0f6', m: T(0, 2.3, 0, 0, 0, 0, 3.2, 2.6, 3.2) }, { geo: coneG, color: '#dce8f0', m: T(0, 3.8, 0, 0, 0, 0, 2.5, 2.4, 2.5) }, { geo: coneG, color: '#f6fafc', m: T(0, 5.2, 0, 0, 0, 0, 1.7, 2.2, 1.7) }, { geo: coneG, color: '#2e5a4a', m: T(0, 2.0, 0, 0, 0, 0, 3.4, 2.2, 3.4) }]),
  oak: () => merged([{ geo: cylG, color: '#6a4a2a', m: T(0, 1.1, 0, 0, 0, 0, 0.6, 2.2, 0.6) }, { geo: icoG, color: '#4a9a3a', m: T(0, 3.4, 0, 0, 0, 0, 3.6, 3, 3.6) }, { geo: icoG, color: '#5aaa44', m: T(1, 3.9, 0.5, 0, 0, 0, 2.4, 2.2, 2.4) }, { geo: icoG, color: '#3e8a34', m: T(-1, 3.0, -0.6, 0, 0, 0, 2.6, 2.2, 2.6) }]),
  birch: () => merged([{ geo: cylG, color: '#e8e4d8', m: T(0, 1.5, 0, 0, 0, 0, 0.35, 3, 0.35) }, { geo: icoG, color: '#8ac050', m: T(0, 3.8, 0, 0, 0, 0, 2.4, 2.6, 2.4) }, { geo: icoG, color: '#a0d060', m: T(0.6, 4.3, 0.3, 0, 0, 0, 1.6, 1.6, 1.6) }]),
  palm: () => merged([{ geo: cylG, color: '#9a7a4a', m: T(0, 1.8, 0, 0, 0, 0.12, 0.4, 3.6, 0.4) }, { geo: cylG, color: '#8a6a3a', m: T(0.4, 4.1, 0, 0, 0, 0.25, 0.32, 1.2, 0.32) }, ...Array.from({ length: 7 }, (_, i) => ({ geo: coneG, color: i % 2 ? '#3a9a3a' : '#4aaa44', m: T(0.55 + Math.cos(i / 7 * 6.28) * 1.0, 4.5, Math.sin(i / 7 * 6.28) * 1.0, Math.sin(i / 7 * 6.28) * 1.2, 0, -Math.cos(i / 7 * 6.28) * 1.2 + 0, 0.5, 2.4, 0.18) })), { geo: icoG, color: '#6a4a2a', m: T(0.5, 4.2, 0.1, 0, 0, 0, 0.4, 0.4, 0.4) }]),
  dead: () => merged([{ geo: cylG, color: '#4a4036', m: T(0, 1.6, 0, 0, 0, 0.05, 0.35, 3.2, 0.35) }, { geo: cylG, color: '#4a4036', m: T(0.6, 3, 0, 0, 0, -0.9, 0.16, 1.6, 0.16) }, { geo: cylG, color: '#4a4036', m: T(-0.5, 2.6, 0.2, 0.3, 0, 0.9, 0.14, 1.4, 0.14) }, { geo: cylG, color: '#4a4036', m: T(0.1, 3.5, -0.4, -0.8, 0, 0.1, 0.12, 1.2, 0.12) }]),
  moontree: () => merged([{ geo: cylG, color: '#4a3a5a', m: T(0, 1.1, 0, 0, 0, 0, 0.5, 2.2, 0.5) }, { geo: icoG, color: '#7a6ad8', m: T(0, 3.4, 0, 0, 0, 0, 3.4, 3, 3.4) }, { geo: icoG, color: '#9a8aff', m: T(0.9, 4, 0.4, 0, 0, 0, 2, 2, 2) }]),
  bush: () => merged([{ geo: icoG, color: '#4a8a3a', m: T(0, 0.4, 0, 0, 0, 0, 1.4, 0.9, 1.4) }, { geo: icoG, color: '#5a9a44', m: T(0.4, 0.5, 0.2, 0, 0, 0, 0.9, 0.7, 0.9) }]),
  rock: () => merged([{ geo: icoG, color: '#8a8a86', m: T(0, 0.4, 0, 0.3, 0.5, 0.1, 1.8, 1.1, 1.5) }, { geo: icoG, color: '#9a9a96', m: T(0.7, 0.25, 0.3, 0, 0, 0, 0.9, 0.6, 0.8) }]),
  reed: () => merged([{ geo: coneG, color: '#6a8a3a', m: T(0, 0.8, 0, 0, 0, 0.06, 0.08, 1.7, 0.08) }, { geo: coneG, color: '#7a9a44', m: T(0.15, 0.7, 0.05, 0, 0, -0.14, 0.07, 1.4, 0.07) }, { geo: coneG, color: '#5a7a30', m: T(-0.12, 0.65, -0.05, 0.1, 0, 0.1, 0.07, 1.3, 0.07) }, { geo: cylG, color: '#5a3a1a', m: T(0.05, 1.5, 0, 0, 0, 0.05, 0.1, 0.4, 0.1) }]),
};
const TREE_TINT = { pine: 0.18, snowpine: 0.05, oak: 0.2, birch: 0.15, palm: 0.15, dead: 0.1, moontree: 0.12, bush: 0.25, rock: 0.1, reed: 0.15 };

/* ------------------------------------------------------------------ water */
const WATER_VS = `uniform float uTime; uniform float uAmp; varying vec3 vW; varying vec3 vN;
void main(){ vec4 wp = modelMatrix*vec4(position,1.0);
  float a = wp.x*0.33+uTime*1.1, b = wp.z*0.41-uTime*0.9, c = (wp.x+wp.z)*0.7+uTime*1.7;
  float h = (sin(a)*0.5+sin(b)*0.5)*0.05*uAmp + sin(c)*0.02*uAmp;
  float dx = (cos(a)*0.33*0.5)*0.05*uAmp + cos(c)*0.7*0.02*uAmp, dz = (cos(b)*0.41*0.5)*0.05*uAmp + cos(c)*0.7*0.02*uAmp;
  wp.y += h; vW = wp.xyz; vN = normalize(vec3(-dx, 1.0, -dz)); gl_Position = projectionMatrix*viewMatrix*wp; }`;
const WATER_FS = `uniform vec3 uCam, uSun, uSunCol, uShallow, uDeep, uSky, uFogCol; uniform float uFogNear, uFogFar, uTime, uOpacity; varying vec3 vW; varying vec3 vN;
void main(){
  float n1 = sin(vW.x*1.3+vW.z*0.7+uTime*1.3)+sin(vW.z*1.9-vW.x*0.5-uTime*1.1)+sin((vW.x+vW.z)*2.7+uTime*1.9)*0.6;
  vec3 N = normalize(vN + vec3(n1*0.035, 0.0, sin(n1*2.1+vW.x*0.4)*0.035));
  vec3 V = normalize(uCam - vW); float fres = pow(1.0-max(dot(V,N),0.0), 3.0);
  vec3 col = mix(uShallow, uDeep, 0.55); col = mix(col, uSky, fres*0.75);
  vec3 R = reflect(-normalize(uSun), N); float spec = pow(max(dot(R,V),0.0), 80.0);
  col += uSunCol*spec*1.4;
  float d = length(uCam - vW); float f = smoothstep(uFogNear, uFogFar, d); col = mix(col, uFogCol, f);
  gl_FragColor = vec4(col, mix(uOpacity-0.1, 0.95, fres));
  #include <colorspace_fragment>
}`;

const SKY_VS = `varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); gl_Position.z = gl_Position.w; }`;
const SKY_FS = `uniform vec3 uZen, uHor, uSun, uSunCol; varying vec3 vD;
void main(){ float h = clamp(vD.y, -0.2, 1.0); float t = pow(max(h,0.0), 0.55);
  vec3 col = mix(uHor, uZen, t); col = mix(col, uHor*0.8, smoothstep(0.0,-0.2,vD.y));
  float s = max(dot(normalize(vD), normalize(uSun)), 0.0);
  col += uSunCol*(pow(s, 600.0)*3.0 + pow(s, 12.0)*0.25);
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}`;

export class World {
  constructor(scene, quality = 1) { this.scene = scene; this.q = quality; this.t = 0; this.waters = []; this.fences = []; this.gates = []; this.fires = []; this.cart = null; this.lilies = null; this.sunDir = new THREE.Vector3(0, 1, 0); this.fog = { near: 80, far: 520 }; }

  build(progress = () => {}) {
    const sc = this.scene;
    this.buildSky();
    progress('Terrein...');
    this.buildTerrain();
    progress('Water...');
    this.buildWaters();
    progress('Bomen...');
    this.buildForest();
    progress('Gebouwen...');
    this.buildStructures();
    this.buildWeather();
    sc.fog = new THREE.Fog('#a8d4f0', 80, 520);
    this.hemi = new THREE.HemisphereLight('#bcdcff', '#6a8a5a', 0.7); sc.add(this.hemi);
    this.sun = new THREE.DirectionalLight('#fff4d8', 1.1); sc.add(this.sun); sc.add(this.sun.target);
    this.fireLight = new THREE.PointLight('#ff9a3a', 0, 22, 1.6); sc.add(this.fireLight);
  }

  /* ---------------- terrein */
  buildTerrain() {
    const step = this.q === 0 ? 6 : 4, W = S.WORLD;
    const nx = Math.round((W.maxX - W.minX) / step) + 1, nz = Math.round((W.maxZ - W.minZ) / step) + 1;
    this.grid = { nx, nz, step }; const pos = new Float32Array(nx * nz * 3), col = new Float32Array(nx * nz * 3), hs = new Float32Array(nx * nz);
    const tmp = new THREE.Color(), c2 = new THREE.Color();
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
      const x = W.minX + i * step, z = W.minZ + j * step, h = S.heightAt(x, z), k = j * nx + i;
      pos[k * 3] = x; pos[k * 3 + 1] = h; pos[k * 3 + 2] = z; hs[k] = h;
      this.terrainColor(x, z, h, tmp, c2);
      col[k * 3] = tmp.r; col[k * 3 + 1] = tmp.g; col[k * 3 + 2] = tmp.b;
    }
    const idx = new Uint32Array((nx - 1) * (nz - 1) * 6); let q = 0;
    for (let j = 0; j < nz - 1; j++) for (let i = 0; i < nx - 1; i++) { const a = j * nx + i, b = a + 1, c = a + nx, d = c + 1; idx[q++] = a; idx[q++] = c; idx[q++] = b; idx[q++] = b; idx[q++] = c; idx[q++] = d; }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.setIndex(new THREE.BufferAttribute(idx, 1)); g.computeVertexNormals();
    this.terrain = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true })); this.scene.add(this.terrain);
    this.colors = col; this.heights = hs;
  }
  terrainColor(x, z, h, out, tmp) {
    const nz = (S.fbm(x * 0.05, z * 0.05, 9) - 0.5) * 2, n2 = S.fbm(x * 0.2, z * 0.2, 4);
    out.copy(BIOME.meadow.g1).lerp(BIOME.meadow.g2, n2);
    let near = null, nd = 1e9;
    for (const p of PONDS) {
      const d = Math.hypot(x - p.x, z - p.z), w = sm(p.zr * 1.5, p.zr * 0.85, d);
      if (w > 0) {
        const B = BIOME[p.biome]; tmp.copy(B.g1).lerp(B.g2, n2);
        if (p.biome === 'mountain') { const hh = h - p.baseY; if (hh > 9 + nz * 3) tmp.copy(BIOME.mountain.g2).lerp(C('#6c6c68'), n2); if (hh > 26 + nz * 4) tmp.set('#eef2f6'); }
        if (p.biome === 'tropic') tmp.lerp(BIOME.tropic.sand, sm(0.6, 0, d / p.r - 1.3) * 0.7);
        if (p.biome === 'swamp') tmp.multiplyScalar(0.85 + nz * 0.1);
        out.lerp(tmp, w);
      }
      if (d < nd) { nd = d; near = p; }
    }
    // oever en bodem
    for (const p of PONDS) {
      if (Math.hypot(x - p.x, z - p.z) > p.r * 1.8) continue;
      const rel = h - p.waterY;
      if (rel < 0.45) {
        const B = BIOME[p.biome];
        if (rel > -0.2) out.lerp(B.sand, 0.9);
        else out.copy(B.sand).lerp(C('#25414a'), sm(-0.1, -2.6, rel) * 0.85);
      } else if (rel < 1.1) out.lerp(BIOME[p.biome].sand, (1.1 - rel) / 0.65 * 0.55);
    }
  }

  /* ---------------- water */
  buildWaters() {
    for (const p of PONDS) {
      const B = BIOME[p.biome], size = p.r * 3.4, g = new THREE.PlaneGeometry(size, size, 40, 40); g.rotateX(-Math.PI / 2);
      const m = new THREE.ShaderMaterial({ vertexShader: WATER_VS, fragmentShader: WATER_FS, transparent: true, depthWrite: false, uniforms: {
        uTime: { value: 0 }, uAmp: { value: 1 }, uCam: { value: new THREE.Vector3() }, uSun: { value: new THREE.Vector3(0, 1, 0) }, uSunCol: { value: new THREE.Color('#fff4d8') },
        uShallow: { value: B.w1.clone() }, uDeep: { value: B.w2.clone() }, uSky: { value: new THREE.Color('#a8d4f0') }, uFogCol: { value: new THREE.Color('#a8d4f0') }, uFogNear: { value: 80 }, uFogFar: { value: 520 }, uOpacity: { value: p.biome === 'swamp' ? 0.93 : 0.8 } } });
      const mesh = new THREE.Mesh(g, m); mesh.position.set(p.x, p.waterY, p.z); mesh.renderOrder = 2; this.scene.add(mesh); this.waters.push({ mesh, p, m });
    }
    // waterlelies
    const mk = new THREE.CylinderGeometry(0.5, 0.5, 0.03, 8), pads = [], rng = i => S.rand01(i, 7, 77);
    for (const p of PONDS) {
      if (![0, 2, 5, 6].includes(p.id)) continue;
      for (let i = 0; i < 38; i++) {
        const a = rng(i + p.id * 100) * 6.28, d = Math.sqrt(rng(i * 3 + p.id * 91 + 5)) * p.r * 0.95, x = p.x + Math.cos(a) * d, z = p.z + Math.sin(a) * d;
        if (S.pondWater(x, z) === p.id && !S.onJetty(x, z) && d > p.r * 0.35) pads.push([x, p.waterY + 0.04, z, 0.5 + rng(i + 9) * 0.6, p.id === 5 ? 1 : 0]);
      }
    }
    const im = new THREE.InstancedMesh(mk, new THREE.MeshLambertMaterial({ color: '#3f8a3a' }), pads.length || 1); im.count = pads.length;
    const mm = new THREE.Matrix4(); pads.forEach((q, i) => { mm.compose(new THREE.Vector3(q[0], q[1], q[2]), new THREE.Quaternion(), new THREE.Vector3(q[3], 1, q[3])); im.setMatrixAt(i, mm); im.setColorAt(i, q[4] ? C('#e868a0') : C('#3f8a3a').lerp(C('#6aaa44'), (i % 5) / 5)); });
    this.scene.add(im);
  }

  /* ---------------- lucht */
  buildSky() {
    const g = new THREE.SphereGeometry(900, 24, 16);
    this.skyMat = new THREE.ShaderMaterial({ vertexShader: SKY_VS, fragmentShader: SKY_FS, side: THREE.BackSide, depthWrite: false, fog: false, uniforms: { uZen: { value: new THREE.Color('#3f86d8') }, uHor: { value: new THREE.Color('#b4dcf4') }, uSun: { value: new THREE.Vector3(0, 1, 0) }, uSunCol: { value: new THREE.Color('#fff4d8') } } });
    this.sky = new THREE.Mesh(g, this.skyMat); this.sky.renderOrder = -10; this.sky.frustumCulled = false; this.scene.add(this.sky);
    // sterren
    const n = 700, sp = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { const u = Math.random() * 2 - 1, a = Math.random() * 6.28, r = Math.sqrt(1 - u * u); sp[i * 3] = Math.cos(a) * r * 850; sp[i * 3 + 1] = Math.abs(u) * 850 + 20; sp[i * 3 + 2] = Math.sin(a) * r * 850; }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
    this.stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: '#ffffff', size: 2.2, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false })); this.stars.frustumCulled = false; this.scene.add(this.stars);
    // maan
    const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
    const gr = x.createRadialGradient(64, 64, 10, 64, 64, 64); gr.addColorStop(0, 'rgba(255,255,240,1)'); gr.addColorStop(0.45, 'rgba(240,244,255,1)'); gr.addColorStop(0.5, 'rgba(200,215,255,0.35)'); gr.addColorStop(1, 'rgba(200,215,255,0)'); x.fillStyle = gr; x.fillRect(0, 0, 128, 128);
    this.moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false, fog: false })); this.moon.scale.set(110, 110, 1); this.scene.add(this.moon);
    // wolken
    this.clouds = new THREE.Group(); const cm = new THREE.MeshLambertMaterial({ color: '#ffffff', transparent: true, opacity: 0.92, fog: false, emissive: '#ffffff', emissiveIntensity: 0.35 });
    for (let i = 0; i < 16; i++) {
      const cl = new THREE.Group(); const nb = 4 + Math.floor(Math.random() * 4);
      for (let k = 0; k < nb; k++) { const b = new THREE.Mesh(M.G.SPH_LO, cm); b.scale.set(40 + Math.random() * 40, 16 + Math.random() * 10, 30 + Math.random() * 25); b.position.set(k * 38 - nb * 19, Math.random() * 6, Math.random() * 20 - 10); cl.add(b); }
      cl.position.set(Math.random() * 1800 - 900, 170 + Math.random() * 70, Math.random() * 1800 - 900); cl.userData.speed = 2 + Math.random() * 3; this.clouds.add(cl);
    }
    this.cloudMat = cm; this.scene.add(this.clouds);
  }

  /* ---------------- bomen en rotsen */
  buildForest() {
    const step = this.q === 0 ? 14 : this.q === 1 ? 10 : 8, W = S.WORLD, buckets = {}, add = (t, x, z, s, r) => { if (S.houseNear(x, z, 5)) return; (buckets[t] || (buckets[t] = [])).push([x, S.heightAt(x, z), z, s, r]); };
    const avoid = [...S.SHOPS, ...S.CAMPFIRES, { x: S.SPAWN.x, z: S.SPAWN.z }, { x: 10, z: 22 }, ...S.GATES, ...S.JETTIES].map(o => [o.x, o.z]);
    const mixes = {
      meadow: [['oak', 0.45], ['birch', 0.3], ['bush', 0.6], ['rock', 0.1]], forest: [['pine', 0.6], ['oak', 0.35], ['bush', 0.3]], swamp: [['dead', 0.5], ['oak', 0.25], ['bush', 0.4]],
      mountain: [['pine', 0.45], ['rock', 0.7]], snow: [['snowpine', 0.8], ['rock', 0.2]], tropic: [['palm', 0.85], ['bush', 0.4]], spring: [['oak', 0.4], ['birch', 0.4], ['bush', 0.4]], moon: [['moontree', 0.8], ['bush', 0.2]],
    };
    const dens = { meadow: 0.14, forest: 0.8, swamp: 0.42, mountain: 0.42, snow: 0.5, tropic: 0.34, spring: 0.5, moon: 0.5 };
    for (let x = W.minX; x < W.maxX; x += step) for (let z = W.minZ; z < W.maxZ; z += step) {
      const px = x + S.rand01(x, z, 1) * step, pz = z + S.rand01(x, z, 2) * step;
      let biome = 'meadow', best = 1e9, wsum = 0;
      for (const p of PONDS) { const d = Math.hypot(px - p.x, pz - p.z); if (d < p.zr * 1.4 && d < best) { best = d; biome = p.biome; wsum = sm(p.zr * 1.45, p.zr * 0.9, d); } }
      let dn = dens[biome] * (biome === 'meadow' ? 1 : (0.15 + 0.85 * wsum)) * (0.5 + S.fbm(px * 0.02, pz * 0.02, 3));
      if (S.rand01(x, z, 3) > dn) continue;
      let bad = false;
      for (const p of PONDS) { const dx = px - p.x, dz = pz - p.z, d = Math.hypot(dx, dz); if (d < p.r * 1.8 && d < p.r * 1.45 * S.shapeAt(p, dx, dz)) { bad = true; break; } }
      if (bad || S.pondWater(px, pz) >= 0) continue;
      for (const [ax, az] of avoid) if (Math.hypot(px - ax, pz - az) < 9) { bad = true; break; }
      if (bad) continue;
      const mix = mixes[biome]; let tot = 0; for (const m of mix) tot += m[1];
      let r = S.rand01(x, z, 4) * tot, type = mix[0][0]; for (const m of mix) { r -= m[1]; if (r <= 0) { type = m[0]; break; } }
      if (type === 'rock' && biome === 'mountain') add('rock', px, pz, 1 + S.rand01(x, z, 5) * 2.2, S.rand01(x, z, 6) * 6.28);
      else add(type, px, pz, 0.8 + S.rand01(x, z, 5) * 0.7, S.rand01(x, z, 6) * 6.28);
    }
    // riet langs de oever
    for (const p of PONDS) {
      const n = p.biome === 'swamp' ? 140 : 70;
      for (let i = 0; i < n; i++) {
        const a = S.rand01(i, p.id, 11) * 6.28, d0 = p.r * (0.9 + S.rand01(i, p.id, 12) * 0.6);
        for (let d = d0; d < p.r * 1.7; d += 0.7) { const x = p.x + Math.cos(a) * d, z = p.z + Math.sin(a) * d, h = S.heightAt(x, z); if (h > p.waterY - 0.15 && h < p.waterY + 0.5 && !S.onJetty(x, z) && Math.hypot(x - S.JETTIES[p.id].x, z - S.JETTIES[p.id].z) > 7) { add('reed', x, z, 0.55 + S.rand01(i, p.id, 13) * 0.5, S.rand01(i, p.id, 14) * 6.28); break; } if (h > p.waterY + 0.5) break; }
      }
    }
    this.forest = new THREE.Group(); const mm = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
    this.treeCount = 0; this.treeGrid = new Map();
    for (const [type, list] of Object.entries(buckets)) { if (type === 'bush' || type === 'rock' || type === 'reed') continue; for (const [x, , z, sc] of list) { const k = Math.floor(x / 16) + ',' + Math.floor(z / 16); (this.treeGrid.get(k) || this.treeGrid.set(k, []).get(k)).push([x, z, sc]); } }
    for (const [type, list] of Object.entries(buckets)) {
      const geo = TREE_GEO[type](), im = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true }), list.length), tint = TREE_TINT[type];
      list.forEach(([x, y, z, s, r], i) => {
        q.setFromEuler(e.set(0, r, 0)); mm.compose(new THREE.Vector3(x, y - 0.05, z), q, new THREE.Vector3(s, s * (0.9 + (r % 1) * 0.3), s)); im.setMatrixAt(i, mm);
        const v = 1 - tint + S.rand01(x * 7, z * 7, 8) * tint * 2; im.setColorAt(i, new THREE.Color(v, v, v));
      });
      im.instanceMatrix.needsUpdate = true; this.forest.add(im); this.treeCount += list.length;
    }
    this.scene.add(this.forest);
  }

  /* ---------------- gebouwen en ander spul */
  buildStructures() {
    const sc = this.scene, add = (o, x, z, ry = 0, y) => { o.position.set(x, y ?? S.heightAt(x, z), z); o.rotation.y = ry; sc.add(o); return o; };
    this.npcs = [];
    for (const sh of S.SHOPS) {
      const g = M.makeShop(sh.type), ry = sh.type === 'kiosk' ? Math.atan2(PONDS[sh.pond].x - sh.x, PONDS[sh.pond].z - sh.z) + Math.PI : Math.atan2(S.SPAWN.x - sh.x, S.SPAWN.z - sh.z);
      add(g, sh.x, sh.z, ry);
      const h = M.makeHuman(sh.type === 'main' ? 2 : sh.type === 'smith' ? 3 : (sh.pond % 4)); h.setName(sh.type === 'kiosk' ? (sh.pond === 0 ? 'Joop' : 'Aasverkoper') : sh.name.replace('Hengelwinkel van ', '').replace('Hengelsmid ', ''), '#ffe08a');
      const fwd = sh.type === 'kiosk' ? 0.9 : 3.4, ox = sh.x + Math.sin(ry) * fwd, oz = sh.z + Math.cos(ry) * fwd;
      h.rod.visible = false; add(h.root, ox, oz, ry); this.npcs.push(h);
    }
    // prikbord
    this.board = add(M.makeBoard(), 10, 22, Math.atan2(S.SPAWN.x - 10, S.SPAWN.z - 22));
    // kampvuren
    for (const c of S.CAMPFIRES) { const f = M.makeCampfire(); add(f, c.x, c.z, 0); this.fires.push({ g: f, c }); }
    // steigers
    for (const j of S.JETTIES) { const g = M.makeJetty(j); g.position.set(j.x, PONDS[j.pond].waterY + 0.4, j.z); this.scene.add(g); }
    // hekken en poorten
    const postGeo = new THREE.CylinderGeometry(0.12, 0.14, 1.6, 5), railGeo = new THREE.BoxGeometry(1, 0.1, 0.1), pm = M.mat('#6a4a28');
    for (const p of S.ZONE_PONDS) {
      const grp = new THREE.Group(), gate = S.GATES.find(g => g.pond === p.id), n = Math.round(2 * Math.PI * p.zr / 6), posts = [];
      const ga = gate.ang;
      for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; let da = Math.abs(a - ((ga % 6.283 + 6.283) % 6.283)); if (da > Math.PI) da = 6.283 - da; if (da < 0.05) continue; posts.push([p.x + Math.cos(a) * p.zr, p.z + Math.sin(a) * p.zr, a]); }
      const ip = new THREE.InstancedMesh(postGeo, pm, posts.length), ir = new THREE.InstancedMesh(railGeo, pm, posts.length * 2), mm = new THREE.Matrix4();
      posts.forEach(([x, z, a], i) => {
        const y = S.heightAt(x, z); mm.makeTranslation(x, y + 0.7, z); ip.setMatrixAt(i, mm);
        const x2 = p.x + Math.cos(a + 2 * Math.PI / n) * p.zr, z2 = p.z + Math.sin(a + 2 * Math.PI / n) * p.zr, y2 = S.heightAt(x2, z2), L = Math.hypot(x2 - x, z2 - z);
        for (let k = 0; k < 2; k++) { const qq = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -Math.atan2(z2 - z, x2 - x), Math.atan2(y2 - y, L))); mm.compose(new THREE.Vector3((x + x2) / 2, (y + y2) / 2 + 0.55 + k * 0.5, (z + z2) / 2), qq, new THREE.Vector3(L, 1, 1)); ir.setMatrixAt(i * 2 + k, mm); }
      });
      grp.add(ip, ir); sc.add(grp); this.fences[p.id] = grp;
      const gt = M.makeGate(); add(gt, gate.x, gate.z, -(gate.ang + Math.PI / 2)); this.gates[p.id] = gt;
      const sg = M.signMesh([p.name, `Vang ${p.req.catches} vissen (${p.req.species} soorten)`, `in de ${PONDS[p.req.from].name}`], 4.4, 1.5); sg.material.side = THREE.DoubleSide; sg.position.set(0, 3.2, 0.05); gt.add(sg);
    }
    // verborgen plekken: een oude boomstronk-bord bij de verborgen vijvers (subtiel)
    // reizende verkoper (kar)
    this.cart = M.makeCart(); this.cart.visible = false; sc.add(this.cart);
  }
  setUnlocked(list) {
    for (const p of S.ZONE_PONDS) {
      const open = list.includes(p.id), f = this.fences[p.id], g = this.gates[p.id];
      if (f) f.visible = !open; if (g) { g.userData.l.rotation.y = open ? -1.5 : 0; g.userData.r.rotation.y = open ? 1.5 : 0; }
    }
  }
  setMerchant(m) {
    if (!m) { this.cart.visible = false; return; }
    this.cart.visible = true; this.cart.position.set(m.x, S.heightAt(m.x, m.z), m.z); this.cart.rotation.y = Math.atan2(PONDS[m.pond].x - m.x, PONDS[m.pond].z - m.z);
  }

  /* ---------------- weer (regen, sneeuw, vuurvliegjes) */
  buildWeather() {
    const nR = this.q === 0 ? 700 : 1600, rg = new THREE.BufferGeometry(); this.rainPos = new Float32Array(nR * 6); rg.setAttribute('position', new THREE.BufferAttribute(this.rainPos, 3));
    for (let i = 0; i < nR; i++) { const x = (Math.random() - 0.5) * 60, y = Math.random() * 30, z = (Math.random() - 0.5) * 60; this.rainPos.set([x, y, z, x, y + 0.9, z], i * 6); }
    this.rain = new THREE.LineSegments(rg, new THREE.LineBasicMaterial({ color: '#b8c8d8', transparent: true, opacity: 0.5, fog: true })); this.rain.visible = false; this.rain.frustumCulled = false; this.scene.add(this.rain); this.nRain = nR;
    const nS = 900, sg = new THREE.BufferGeometry(); this.snowPos = new Float32Array(nS * 3); for (let i = 0; i < nS; i++) this.snowPos.set([(Math.random() - 0.5) * 50, Math.random() * 25, (Math.random() - 0.5) * 50], i * 3);
    sg.setAttribute('position', new THREE.BufferAttribute(this.snowPos, 3));
    this.snow = new THREE.Points(sg, new THREE.PointsMaterial({ color: '#ffffff', size: 0.18, transparent: true, opacity: 0.9 })); this.snow.visible = false; this.snow.frustumCulled = false; this.scene.add(this.snow); this.nSnow = nS;
    const nF = 90, fg = new THREE.BufferGeometry(); this.flyPos = new Float32Array(nF * 3); this.flySeed = []; for (let i = 0; i < nF; i++) { this.flyPos.set([(Math.random() - 0.5) * 70, 0.5 + Math.random() * 3, (Math.random() - 0.5) * 70], i * 3); this.flySeed.push(Math.random() * 100); }
    fg.setAttribute('position', new THREE.BufferAttribute(this.flyPos, 3));
    this.flies = new THREE.Points(fg, new THREE.PointsMaterial({ color: '#d8ff7a', size: 0.22, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })); this.flies.frustumCulled = false; this.scene.add(this.flies); this.nFly = nF;
    this.lightning = 0; this.nextBolt = 6;
  }

  /* ---------------- elk beeld */
  /* eerste punt (0..1) op het lijnstuk a->b dat door een boomstam wordt geblokkeerd, of 1 */
  treeBlock(ax, ay, az, bx, by, bz) {
    if (!this.treeGrid) return 1;
    const N = 8;
    for (let i = 1; i <= N; i++) {
      const t = i / N, x = ax + (bx - ax) * t, z = az + (bz - az) * t, cx = Math.floor(x / 16), cz = Math.floor(z / 16);
      for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
        const l = this.treeGrid.get((cx + dx) + ',' + (cz + dz)); if (!l) continue;
        for (const [tx, tz, sc] of l) if (Math.hypot(tx - x, tz - z) < 0.9 * sc + 0.4) return Math.max(0.2, t - 1 / N);
      }
    }
    return 1;
  }
  update(dt, cam, phase, weather, ctx = {}) {
    this.t += dt;
    const e = S.sunElev(phase), sunY = Math.max(-1, Math.min(1, e - 0.15)), a = phase * Math.PI * 2;
    this.sunDir.set(Math.cos(a) * 0.85, sunY * 0.95 + 0.05 * Math.sign(sunY || 1), -0.45).normalize();
    const dayW = sm(0.08, 0.4, sunY), nightW = sm(-0.05, -0.3, sunY), duskW = Math.max(0, 1 - dayW - nightW);
    const mix = (d, du, n) => d.clone().multiplyScalar(dayW).add(du.clone().multiplyScalar(duskW)).add(n.clone().multiplyScalar(nightW));
    const zen = mix(C('#3f86d8'), C('#3a4a8a'), C('#040818')), hor = mix(C('#b4dcf4'), C('#ff9a5e'), C('#16264a'));
    const bad = weather === 'storm' ? 1 : weather === 'rain' ? 0.75 : weather === 'fog' ? 0.85 : 0, gray = C(weather === 'storm' ? '#3a424c' : '#7a828c').multiplyScalar(0.25 + 0.75 * (dayW + duskW * 0.6));
    zen.lerp(gray, bad * 0.85); hor.lerp(gray.clone().multiplyScalar(1.2), bad * 0.9);
    const sunCol = mix(C('#fff4d8'), C('#ff9a50'), C('#5a6a9a')); this.skyMat.uniforms.uZen.value.copy(zen); this.skyMat.uniforms.uHor.value.copy(hor); this.skyMat.uniforms.uSun.value.copy(this.sunDir); this.skyMat.uniforms.uSunCol.value.copy(sunCol).multiplyScalar(1 - bad * 0.8);
    this.sky.position.copy(cam.position);
    this.stars.position.copy(cam.position); this.stars.material.opacity = Math.max(0, nightW - bad * 0.8); this.stars.rotation.y = phase * 0.5;
    this.moon.position.copy(cam.position).addScaledVector(this.sunDir, -820); this.moon.material.opacity = Math.max(0, 1 - dayW * 1.5 - bad * 0.7);
    // lichten
    const useSun = sunY > -0.08, I = useSun ? 1.25 * sm(-0.05, 0.35, sunY) * (1 - bad * 0.6) : 0.4 * nightW * (1 - bad * 0.7);
    this.sun.intensity = I; this.sun.color.copy(useSun ? sunCol : C('#9ab0ff')); const ld = useSun ? this.sunDir : this.sunDir.clone().negate();
    this.sun.position.copy(cam.position).addScaledVector(ld, 100); this.sun.target.position.copy(cam.position);
    this.hemi.color.copy(mix(C('#bcdcff'), C('#a8a0c8'), C('#5a6ab0'))); this.hemi.groundColor.copy(mix(C('#6a8a5a'), C('#6a5a50'), C('#1a2a3a')));
    this.hemi.intensity = (0.45 + 0.35 * dayW + 0.1 * duskW + 0.38 * nightW) * (1 - bad * 0.25);
    // lightning
    this.nextBolt -= dt; if (weather === 'storm' && this.nextBolt <= 0) { this.lightning = 1; this.nextBolt = 4 + Math.random() * 9; ctx.onThunder && ctx.onThunder(); }
    this.lightning = Math.max(0, this.lightning - dt * 3.2); if (this.lightning > 0) this.hemi.intensity += this.lightning * 2.2;
    // mist en zicht
    let fn = 80, ff = 520; if (weather === 'rain') { fn = 40; ff = 330; } else if (weather === 'fog') { fn = 6; ff = 120; } else if (weather === 'storm') { fn = 30; ff = 260; }
    if (ctx.swamp) { fn = Math.min(fn, 25); ff = Math.min(ff, 230); }
    if (this.q === 0) ff = Math.min(ff, 360);
    this.fog.near += (fn - this.fog.near) * Math.min(1, dt); this.fog.far += (ff - this.fog.far) * Math.min(1, dt);
    this.scene.fog.near = this.fog.near; this.scene.fog.far = this.fog.far; this.scene.fog.color.copy(hor); this.scene.background = hor;
    // water
    for (const w of this.waters) {
      const u = w.m.uniforms; u.uTime.value = this.t; u.uAmp.value = weather === 'storm' ? 3.2 : weather === 'rain' ? 1.6 : 1; u.uCam.value.copy(cam.position); u.uSun.value.copy(ld); u.uSunCol.value.copy(sunCol); u.uSky.value.copy(hor); u.uFogCol.value.copy(hor); u.uFogNear.value = this.fog.near; u.uFogFar.value = this.fog.far;
      const k = 0.25 + 0.75 * (dayW + duskW * 0.6 + nightW * 0.25); u.uShallow.value.copy(BIOME[w.p.biome].w1).multiplyScalar(k); u.uDeep.value.copy(BIOME[w.p.biome].w2).multiplyScalar(k);
      if (weather === 'storm' || weather === 'rain') u.uShallow.value.lerp(C('#5a6a70'), 0.35);
    }
    // wolken
    this.cloudMat.color.copy(C('#ffffff').lerp(gray, bad * 0.8).multiplyScalar(0.25 + 0.75 * (dayW + duskW * 0.7))); this.cloudMat.emissive.copy(this.cloudMat.color).multiplyScalar(0.4); this.cloudMat.opacity = 0.9;
    for (const c of this.clouds.children) { c.position.x += c.userData.speed * dt; if (c.position.x > 1000 + cam.position.x) c.position.x -= 2000; }
    this.clouds.position.set(cam.position.x * 0.9, 0, cam.position.z * 0.9);
    // vuur
    let nearest = null, nd = 1e9;
    for (const f of this.fires) {
      const k = 0.85 + Math.sin(this.t * 14 + f.c.x) * 0.15 + Math.random() * 0.12; f.g.userData.f1.scale.set(0.6 * k, 0.9 * k * 1.3, 0.6 * k); f.g.userData.f2.scale.set(0.36 * k, 0.6 * k * 1.3, 0.36 * k);
      const d = Math.hypot(f.c.x - cam.position.x, f.c.z - cam.position.z); if (d < nd) { nd = d; nearest = f; }
    }
    if (nearest && nd < 45) { this.fireLight.position.set(nearest.c.x, S.heightAt(nearest.c.x, nearest.c.z) + 1.4, nearest.c.z); this.fireLight.intensity = (1.5 + Math.random() * 0.4) * (0.6 + 0.8 * nightW + 0.3 * duskW) * 2; } else this.fireLight.intensity = 0;
    if (this.cart.visible) { this.cart.userData.lamp.material.emissiveIntensity = 0.6 + nightW * 1.2; }
    // deeltjes
    const cp = cam.position;
    this.rain.visible = weather === 'rain' || weather === 'storm';
    if (this.rain.visible) {
      const sp = (weather === 'storm' ? 34 : 24) * dt, wind = weather === 'storm' ? 6 * dt : 1.5 * dt, P = this.rainPos;
      for (let i = 0; i < this.nRain; i++) { const k = i * 6; P[k + 1] -= sp; P[k] -= wind; P[k + 4] = P[k + 1] + 0.9; P[k + 3] = P[k] - wind * 0.9; if (P[k + 1] < 0) { P[k] = (Math.random() - 0.5) * 60; P[k + 1] = 28 + Math.random() * 4; P[k + 2] = (Math.random() - 0.5) * 60; P[k + 3] = P[k]; P[k + 5] = P[k + 2]; } }
      this.rain.geometry.attributes.position.needsUpdate = true; this.rain.position.set(cp.x, cp.y - 12, cp.z);
    }
    this.snow.visible = !!ctx.snow;
    if (this.snow.visible) { const P = this.snowPos; for (let i = 0; i < this.nSnow; i++) { const k = i * 3; P[k + 1] -= 1.6 * dt; P[k] += Math.sin(this.t + i) * 0.4 * dt; if (P[k + 1] < 0) { P[k + 1] = 24; } } this.snow.geometry.attributes.position.needsUpdate = true; this.snow.position.set(cp.x, cp.y - 8, cp.z); }
    const flyOn = nightW > 0.3 && bad < 0.5 && ctx.fireflies; this.flies.material.opacity = flyOn ? 0.9 * nightW : 0; this.flies.visible = nightW > 0.3;
    if (this.flies.visible) { const P = this.flyPos; for (let i = 0; i < this.nFly; i++) { const s = this.flySeed[i], k = i * 3; P[k] += Math.sin(this.t * 0.7 + s) * dt * 0.8; P[k + 1] += Math.cos(this.t * 0.9 + s * 2) * dt * 0.4; P[k + 2] += Math.cos(this.t * 0.6 + s * 3) * dt * 0.8; P[k + 1] = Math.max(0.4, Math.min(4, P[k + 1])); } this.flies.geometry.attributes.position.needsUpdate = true; this.flies.position.set(Math.round(cp.x / 70) * 70, S.groundY(cp.x, cp.z), Math.round(cp.z / 70) * 70); this.flies.position.set(cp.x, S.groundY(cp.x, cp.z), cp.z); }
    return { dayW, nightW, sunY, bad };
  }

  /* kaart: één pixel per terreinpunt */
  minimap() {
    const { nx, nz } = this.grid, c = document.createElement('canvas'); c.width = nx; c.height = nz; const x = c.getContext('2d'), img = x.createImageData(nx, nz), col = this.colors, hs = this.heights, W = S.WORLD;
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
      const k = j * nx + i, wx = W.minX + i * this.grid.step, wz = W.minZ + j * this.grid.step; let r = col[k * 3] * 255, g = col[k * 3 + 1] * 255, b = col[k * 3 + 2] * 255;
      const w = S.pondWater(wx, wz); if (w >= 0) { r = 40; g = 120; b = 180; }
      const sh = 0.82 + Math.max(-0.2, Math.min(0.25, ((hs[k + 1 < hs.length ? k + 1 : k] - hs[k]) * 0.15)));
      img.data[k * 4] = r * sh; img.data[k * 4 + 1] = g * sh; img.data[k * 4 + 2] = b * sh; img.data[k * 4 + 3] = 255;
    }
    x.putImageData(img, 0, 0); return c;
  }
}
