// three.js opzetten: renderer, camera, wereld, reigers, eenden en rimpelingen in het water.
import * as THREE from 'three';
import * as S from '../shared.js';
import { PONDS } from '../shared.js';
import * as M from '../models/index.js';
import { World } from '../world/world.js';
import { $, G, R, fx } from './state.js';

/* ------------------------------------------------------------------ three.js opzetten */
export function initThree() {
  const q = (G.quality = G.settings.q);
  R.renderer = new THREE.WebGLRenderer({ canvas: $('cv'), antialias: q >= 2, powerPreference: 'high-performance' });
  R.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, q === 0 ? 1 : q === 1 ? 1.5 : 2));
  R.renderer.outputColorSpace = THREE.SRGBColorSpace;
  R.scene = new THREE.Scene();
  R.camera = new THREE.PerspectiveCamera(65, 1, 0.1, 1600);
  R.clock = new THREE.Clock();
  const rs = () => {
    R.renderer.setSize(innerWidth, innerHeight, false);
    R.camera.aspect = innerWidth / innerHeight;
    R.camera.updateProjectionMatrix();
  };
  addEventListener('resize', rs);
  rs();
  R.world = new World(R.scene, q);
  R.world.build(msg => {
    $('bootmsg').textContent = msg;
  });
  R.minimapImg = R.world.minimap();
  // reigers en eenden
  for (const p of PONDS) {
    const h = M.makeHeron();
    h.visible = false;
    h.userData.pond = p.id;
    h.userData.fly = 0;
    h.userData.x = 0;
    h.userData.z = 0;
    R.scene.add(h);
    G.herons[p.id] = h;
    for (let i = 0; i < 3; i++) {
      const d = M.makeDuck();
      const pos = randWater(p);
      d.position.set(pos.x, p.waterY, pos.z);
      d.userData = { pond: p.id, h: Math.random() * 6.28, t: 0 };
      R.scene.add(d);
      G.ducks.push(d);
    }
  }
  // rimpelingen
  const rg = new THREE.RingGeometry(0.4, 0.5, 24);
  rg.rotateX(-Math.PI / 2);
  for (let i = 0; i < 24; i++) {
    const m = new THREE.Mesh(rg, new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, depthWrite: false }));
    m.visible = false;
    m.renderOrder = 3;
    R.scene.add(m);
    fx.push({ m, age: 9, big: 0 });
  }
}
function randWater(p) {
  for (let i = 0; i < 40; i++) {
    const a = Math.random() * 6.28,
      d = Math.sqrt(Math.random()) * p.r * 0.9,
      x = p.x + Math.cos(a) * d,
      z = p.z + Math.sin(a) * d;
    if (S.pondWater(x, z) === p.id && !S.onJetty(x, z)) return { x, z };
  }
  return { x: p.x, z: p.z };
}
export function ripple(x, z, big, y) {
  const f = fx.find(f => f.age > 2) || fx[0];
  const pw = S.pondWater(x, z);
  f.age = 0;
  f.big = big;
  f.m.position.set(x, y ?? (pw >= 0 ? PONDS[pw].waterY + 0.06 : S.heightAt(x, z) + 0.05), z);
  f.m.visible = true;
}
export function renderFrame() {
  R.renderer.render(R.scene, R.camera);
}
