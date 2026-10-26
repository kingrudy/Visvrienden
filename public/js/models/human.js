// De vissers: Blender-model als dat er is, anders een eigen blokjesmodel. Speler Toon is Iron Man.
import * as THREE from 'three';
import { BOX, SPH, TORUS, box, cyl, label, mat, sph } from './core.js';
import { ANGLERS } from './glb.js';
import { outlineFit, shadeModel } from './shading.js';

/* ------------------------------------------------------------------ visser */
const LOOKS = [
  { shirt: '#c8423a', pants: '#3a4a6a', hat: 'bucket', hatC: '#e8c84a', skin: '#f1c9a5' },
  { shirt: '#3a78c8', pants: '#4a4a3a', hat: 'cap', hatC: '#2f8a4a', skin: '#d8a07a' },
  { shirt: '#4a8a4a', pants: '#6a5a3a', hat: 'straw', hatC: '#e0c878', skin: '#a8714f' },
  { shirt: '#e8962a', pants: '#2a3a4a', hat: 'hood', hatC: '#f2d23a', skin: '#f6d7bd' },
];
const IRON_RED = '#b5121b',
  IRON_GOLD = '#f2b92c';
// Iron Man-pak voor een Blender-visser: alles rood, laarzen/handen/helm goud, arc reactor op de borst
function ironmanHuman(t) {
  const glow = new THREE.MeshBasicMaterial({ color: '#8ff0ff' });
  const red = mat(IRON_RED, { flatShading: false }),
    gold = mat(IRON_GOLD, { flatShading: false });
  const gn = n => t.getObjectByName(n);
  for (const pv of ['legL', 'legR', 'armL', 'armR', 'body', 'head']) {
    const node = gn(pv);
    if (!node) continue;
    for (const grp of node.children)
      for (const m of grp.children.length ? grp.children : []) {
        if (!m.isMesh) continue;
        m.geometry.computeBoundingBox();
        const b = m.geometry.boundingBox;
        if (pv === 'head') {
          m.visible = false;
          continue;
        } // muts, haar en gezicht verdwijnen onder de helm
        if (pv.startsWith('leg'))
          m.material = b.max.y < -0.44 ? gold : red; // laarzen goud
        else if (pv.startsWith('arm')) {
          if (b.min.y < -0.7) m.visible = false;
          else m.material = b.min.y < -0.55 ? gold : red;
        } // handen goud, emmer weg
        else m.material = red;
      }
  }
  const body = gn('body'),
    head = gn('head');
  if (!body || !head) return;
  // helm: gouden gezichtsplaat met rode kruin, gloeiende ogen
  const add = (p, geo, m, sx, sy, sz, x, y, z) => {
    const o = new THREE.Mesh(geo, m);
    o.scale.set(sx, sy, sz);
    o.position.set(x, y, z);
    p.add(o);
    return o;
  };
  add(head, SPH, gold, 0.52, 0.5, 0.49, 0, 0, 0);
  add(head, SPH, red, 0.54, 0.26, 0.5, 0, 0.14, -0.005);
  add(head, BOX, gold, 0.1, 0.34, 0.1, 0, 0.2, 0.0).scale.set(0.06, 0.12, 0.3); // kam
  for (const sx of [-1, 1]) {
    add(head, BOX, glow, 0.13, 0.05, 0.03, sx * 0.1, 0.04, 0.245).rotation.z = sx * 0.12;
    add(head, SPH, red, 0.09, 0.14, 0.08, sx * 0.25, -0.02, 0);
  }
  add(head, BOX, new THREE.MeshLambertMaterial({ color: '#4a3a1a' }), 0.12, 0.018, 0.03, 0, -0.13, 0.245);
  // borst: gouden plaat met arc reactor
  const rx = new THREE.Group();
  rx.position.set(0, 1.3, 0.26);
  body.add(rx);
  add(rx, SPH, gold, 0.34, 0.3, 0.1, 0, 0, -0.02);
  add(rx, TORUS, gold, 0.17, 0.17, 0.17, 0, 0, 0.03);
  add(rx, SPH, glow, 0.1, 0.1, 0.05, 0, 0, 0.04);
  add(
    rx,
    SPH,
    new THREE.MeshBasicMaterial({ color: '#6fe4ff', transparent: true, opacity: 0.3, depthWrite: false }),
    0.22,
    0.22,
    0.09,
    0,
    0,
    0.04,
  );
  // repulsors: gloeiende handpalmen
  for (const n of ['armL', 'armR']) {
    const a = gn(n);
    if (a) add(a, SPH, glow, 0.08, 0.08, 0.04, 0, -0.64, 0.11);
  }
}
export function makeHuman(look = 0, rodColor = '#c8a458', special = null) {
  const L =
      special === 'ironman'
        ? { ...LOOKS[look % 4], shirt: IRON_RED, pants: IRON_RED, skin: IRON_GOLD, hat: 'cap', hatC: IRON_GOLD }
        : LOOKS[look % 4],
    root = new THREE.Group(),
    tpl = ANGLERS[look % 4];
  let body, legL, legR, armL, armR, head;
  if (tpl) {
    // Blender-model (public/models/anglerN.glb)
    const t = tpl.clone(true);
    root.add(t);
    const g = n => t.getObjectByName(n);
    body = g('body');
    legL = g('legL');
    legR = g('legR');
    armL = g('armL');
    armR = g('armR');
    head = g('head');
    if (special === 'ironman') ironmanHuman(t);
  } else {
    body = new THREE.Group();
    root.add(body);
    legL = new THREE.Group();
    legR = new THREE.Group();
    legL.position.set(-0.12, 0.85, 0);
    legR.position.set(0.12, 0.85, 0);
    body.add(legL, legR);
    box(legL, L.pants, 0.2, 0.85, 0.22, 0, -0.42, 0);
    box(legR, L.pants, 0.2, 0.85, 0.22, 0, -0.42, 0);
    box(legL, '#3a2a20', 0.22, 0.12, 0.3, 0, -0.84, 0.04);
    box(legR, '#3a2a20', 0.22, 0.12, 0.3, 0, -0.84, 0.04);
    box(body, L.shirt, 0.5, 0.62, 0.3, 0, 1.17, 0);
    armL = new THREE.Group();
    armR = new THREE.Group();
    armL.position.set(-0.33, 1.42, 0);
    armR.position.set(0.33, 1.42, 0);
    body.add(armL, armR);
    box(armL, L.shirt, 0.14, 0.34, 0.15, 0, -0.15, 0);
    box(armL, L.skin, 0.12, 0.3, 0.13, 0, -0.45, 0);
    box(armR, L.shirt, 0.14, 0.34, 0.15, 0, -0.15, 0);
    box(armR, L.skin, 0.12, 0.3, 0.13, 0, -0.45, 0);
    head = new THREE.Group();
    head.position.y = 1.72;
    body.add(head);
    sph(head, L.skin, 0.32, 0.34, 0.32, 0, 0, 0);
    box(head, '#222', 0.05, 0.05, 0.02, -0.08, 0.02, 0.16);
    box(head, '#222', 0.05, 0.05, 0.02, 0.08, 0.02, 0.16);
    if (L.hat === 'bucket') {
      cyl(head, L.hatC, 0.2, 0.16, 0.2, 0, 0.17, 0);
      cyl(head, L.hatC, 0.3, 0.03, 0.3, 0, 0.1, 0);
    } else if (L.hat === 'cap') {
      sph(head, L.hatC, 0.34, 0.26, 0.34, 0, 0.08, 0);
      box(head, L.hatC, 0.3, 0.03, 0.2, 0, 0.05, 0.22);
    } else if (L.hat === 'straw') {
      cyl(head, L.hatC, 0.19, 0.14, 0.19, 0, 0.18, 0);
      cyl(head, L.hatC, 0.42, 0.025, 0.42, 0, 0.1, 0);
    } else {
      sph(head, L.hatC, 0.4, 0.4, 0.4, 0, 0.02, -0.02);
      box(head, L.skin, 0.2, 0.2, 0.05, 0, 0, 0.16);
    }
  }
  // hengel
  const rod = new THREE.Group();
  rod.position.set(0.34, 0.98, 0.1);
  body.add(rod);
  const shaft = cyl(rod, rodColor, 0.018, 2.5, 0.018, 0, 1.2, 0);
  box(rod, '#333', 0.07, 0.07, 0.2, 0, 0.1, 0);
  const tip = new THREE.Object3D();
  tip.position.set(0, 2.45, 0);
  rod.add(tip);
  rod.rotation.x = 0.9;
  const lab = label('', '#fff');
  lab.position.y = 2.45;
  root.add(lab);
  const H = { root, body, legL, legR, armL, armR, head, rod, shaft, tip, lab, t: 0, labText: '', mode: 0 };
  shadeModel(root, 1.0);
  outlineFit(root, 0.02);
  H.setName = (n, color) => {
    if (H.labText === n) return;
    H.labText = n;
    const nl = label(n, color || '#fff');
    H.lab.material.map = nl.material.map;
    H.lab.material.needsUpdate = true;
  };
  H.setRod = c => {
    shaft.material = mat(c);
  };
  H.update = (dt, speed, mode, bend = 0) => {
    // mode: 0 los, 1 vissen (hengel vooruit), 2 zittend (voertuig)
    H.t += dt * (2 + speed * 1.3);
    const s = Math.sin(H.t * 2.4) * Math.min(1, speed / 3) * 0.9;
    if (mode === 2) {
      legL.rotation.x = -1.2;
      legR.rotation.x = -1.2;
      legL.position.y = legR.position.y = 0.75;
      armL.rotation.x = -0.9;
      armR.rotation.x = -0.9;
      body.position.y = -0.1;
    } else {
      legL.position.y = legR.position.y = 0.85;
      legL.rotation.x = s;
      legR.rotation.x = -s;
      body.position.y = 0;
      armL.rotation.x = -s * 0.8;
      armR.rotation.x = mode === 1 ? -1.15 : s * 0.8;
    }
    const tr = mode === 1 ? 0.65 + bend * 0.35 : 0.25;
    rod.rotation.x += (tr - rod.rotation.x) * Math.min(1, dt * 6);
    rod.visible = mode !== 2;
  };
  return H;
}
