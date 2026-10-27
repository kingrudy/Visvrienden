// Het huis van een speler: aquarium met gevangen soorten, decor (plantjes, treintje, station, kasteel), hondenmand
// en de inrichting die je in de winkel koopt (setDeco).
import * as THREE from 'three';
import { makeDog } from './animals.js';
import { box, cone, cyl, sph } from './core.js';
import { makeFish } from './fish.js';
import { shadeModel } from './shading.js';
import { SP, fmtKg } from '../shared.js';

/* ------------------------------------------------------------------ huis met aquarium en hondenmand */
function plaque(text) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 128;
  const x = c.getContext('2d');
  x.fillStyle = '#5a3a1a';
  x.fillRect(0, 0, 512, 128);
  x.fillStyle = '#8a6a3a';
  x.fillRect(8, 8, 496, 112);
  let fs = 60;
  x.font = `bold ${fs}px system-ui,sans-serif`;
  while (x.measureText(text).width > 460 && fs > 20) {
    fs -= 2;
    x.font = `bold ${fs}px system-ui,sans-serif`;
  }
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  x.fillStyle = '#2a1a08';
  x.fillText(text, 256, 68);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return new THREE.Mesh(new THREE.PlaneGeometry(3.6, 0.9), new THREE.MeshBasicMaterial({ map: t }));
}
const HOUSE_COLS = ['#d9c7a3', '#c98b7a', '#8fb0c9', '#b9c98f', '#d9b4c9', '#c9b48f', '#9fc9b8'];
export function makeHouse(slot = 0) {
  const g = new THREE.Group(),
    wall = HOUSE_COLS[slot % HOUSE_COLS.length],
    W = 8,
    D = 7,
    WH = 3,
    hw = W / 2,
    hd = D / 2;
  box(g, '#8a8a84', W + 0.7, 0.5, D + 0.7, 0, -0.27, 0); // fundering
  box(g, '#9a7a52', W - 0.2, 0.06, D - 0.2, 0, -0.01, 0); // vloer (bovenkant ~ y 0.02)
  box(g, '#a04a4a', 3.4, 0.03, 2.2, 0, 0.035, -0.6);
  box(g, '#d8c8a0', 3.0, 0.035, 1.8, 0, 0.04, -0.6); // kleed
  box(g, wall, W, WH, 0.3, 0, WH / 2, hd - 0.15); // achterwand
  for (const s of [-1, 1]) box(g, wall, 0.3, WH, D, s * (hw - 0.15), WH / 2, 0); // zijwanden
  for (const s of [-1, 1]) box(g, wall, 2.4, WH, 0.3, s * 2.8, WH / 2, -hd + 0.15); // voorwand links/rechts
  box(g, wall, 3.2, WH - 2.4, 0.3, 0, 2.4 + (WH - 2.4) / 2, -hd + 0.15); // latei boven de deur
  box(g, '#6a4a2a', 3.4, 0.14, 0.4, 0, 2.4, -hd + 0.15); // deurbalk
  for (const [y, w] of [
    [3.25, 7.7],
    [3.75, 5.9],
    [4.25, 4.1],
    [4.7, 2.3],
  ]) {
    box(g, wall, w, 0.5, 0.3, 0, y, -hd + 0.15);
    box(g, wall, w, 0.5, 0.3, 0, y, hd - 0.15);
  } // geveltoppen
  const a = Math.atan2(1.7, 4.4),
    L = Math.hypot(4.4, 1.7) + 0.5;
  for (const s of [-1, 1]) {
    const r = box(g, '#9a4a3a', L, 0.16, D + 0.8, s * 2.25, 3.9, 0);
    r.rotation.z = -s * a;
  }
  box(g, '#7a3a2c', 0.4, 0.18, D + 0.8, 0, 4.78, 0);
  box(g, '#7a7a76', 0.7, 1.4, 0.7, 2.4, 4.7, 1.6); // schoorsteen
  for (const s of [-1, 1]) {
    box(g, '#ffe9a8', 0.1, 1.0, 1.1, s * (hw - 0.1), 1.6, 0.6, { emissive: '#ffcc66', emissiveIntensity: 0.35 });
    box(g, '#5a3a1a', 0.14, 0.1, 1.3, s * (hw - 0.1), 1.05, 0.6);
  } // ramen
  box(g, '#5a3a1a', 3.6, 0.12, 0.7, 0, 0.05, -hd - 0.45); // stoep
  // aquarium tegen de achterwand
  const aq = new THREE.Group();
  aq.position.set(0, 0, hd - 0.85);
  g.add(aq);
  box(aq, '#6a4a2a', 3.4, 0.85, 0.95, 0, 0.43, 0);
  box(aq, '#8a6a3a', 3.5, 0.06, 1.05, 0, 0.88, 0);
  const tank = new THREE.Group();
  tank.position.set(0, 1.5, 0);
  aq.add(tank);
  box(tank, '#3a9ac8', 3.1, 1.15, 0.8, 0, 0, 0, { transparent: true, opacity: 0.38, depthWrite: false });
  box(tank, '#e8d8a0', 3.05, 0.14, 0.78, 0, -0.5, 0); // zand
  // waterplantjes (wiegen mee) en een rond bloemetjesbosje
  const sway = [];
  for (const [x, z, c, n, hh] of [
    [-1.38, -0.3, '#2f9a4a', 4, 0.8],
    [-0.15, -0.32, '#4cc06a', 3, 0.6],
    [0.35, -0.32, '#2f9a4a', 4, 0.75],
    [0.62, -0.3, '#6ad07a', 3, 0.55],
    [1.45, 0.28, '#3aa85a', 4, 0.85],
    [-1.45, 0.3, '#58c070', 3, 0.5],
  ]) {
    const pl = new THREE.Group();
    pl.position.set(x, -0.43, z);
    tank.add(pl);
    for (let i = 0; i < n; i++) {
      const bl = new THREE.Group();
      bl.position.set((i - n / 2) * 0.05, 0, (i % 2) * 0.04);
      bl.rotation.z = (i - n / 2) * 0.12;
      pl.add(bl);
      box(bl, c, 0.045, hh * (0.7 + 0.1 * i), 0.012, 0, (hh * (0.7 + 0.1 * i)) / 2, 0);
      sph(bl, c, 0.07, 0.1, 0.03, 0, hh * (0.7 + 0.1 * i), 0);
    }
    sway.push(pl);
  }
  for (const [x, z, c] of [
    [0.0, 0.33, '#ff7ab0'],
    [-0.3, 0.33, '#ffd24a'],
    [0.75, 0.33, '#b48cff'],
  ]) {
    const bush = new THREE.Group();
    bush.position.set(x, -0.43, z);
    tank.add(bush);
    cyl(bush, '#2f8a4a', 0.02, 0.22, 0.02, 0, 0.11, 0);
    sph(bush, c, 0.14, 0.14, 0.14, 0, 0.26, 0);
    sph(bush, '#fff3a0', 0.05, 0.05, 0.05, 0, 0.3, 0.05);
    sway.push(bush);
  }
  // klein deco-treintje dat rondjes rijdt over een spoortje op het zand
  const train = new THREE.Group();
  tank.add(train);
  const TX = 1.1,
    TZ = 0.17,
    trk = new THREE.Group();
  tank.add(trk);
  for (let i = 0; i < 28; i++) {
    const a = (i / 28) * Math.PI * 2;
    const sl = box(trk, '#6a4a2a', 0.1, 0.012, 0.035, Math.cos(a) * TX, -0.425, Math.sin(a) * TZ);
    sl.rotation.y = -Math.atan2(TZ * Math.cos(a), -TX * Math.sin(a));
  }
  const mkCar = (c, kind) => {
    const car = new THREE.Group();
    train.add(car);
    box(car, '#2a2a30', kind === 'loco' ? 0.19 : 0.15, 0.025, 0.07, 0, 0.0, 0);
    for (const wx of kind === 'loco' ? [-0.07, 0, 0.07] : [-0.05, 0.05])
      for (const wz of [-0.035, 0.035])
        cyl(car, kind === 'loco' ? '#c8c8d0' : '#1a1a1a', 0.03, 0.012, 0.03, wx, -0.005, wz).rotation.x = Math.PI / 2;
    if (kind === 'loco') {
      box(car, c, 0.12, 0.07, 0.065, -0.02, 0.055, 0);
      box(car, '#ffcc33', 0.05, 0.05, 0.07, 0.05, 0.045, 0);
      cyl(car, '#222', 0.035, 0.07, 0.035, 0.07, 0.07, 0);
      cyl(car, '#f0f0f0', 0.025, 0.02, 0.025, 0.07, 0.115, 0);
      sph(car, '#ffffcc', 0.025, 0.025, 0.025, 0.095, 0.04, 0, { emissive: '#ffffaa', emissiveIntensity: 1 });
    } else {
      box(car, c, 0.13, 0.055, 0.065, 0, 0.045, 0);
      box(car, '#fff3c0', 0.09, 0.015, 0.05, 0, 0.078, 0);
    }
    return car;
  };
  const cars = [mkCar('#d83a3a', 'loco'), mkCar('#3a7ad8', 'wagon'), mkCar('#4ab85a', 'wagon')];
  cars.forEach(c => c.scale.setScalar(1.7));
  // station met poppetjes
  const peg = (par, x, y, z, c, hat) => {
    const f = new THREE.Group();
    f.position.set(x, y, z);
    par.add(f);
    cyl(f, c, 0.016, 0.05, 0.016, 0, 0.025, 0);
    sph(f, '#f2c9a0', 0.03, 0.03, 0.03, 0, 0.065, 0);
    if (hat) cyl(f, hat, 0.018, 0.014, 0.018, 0, 0.083, 0);
    return f;
  };
  const st = new THREE.Group();
  st.position.set(-0.72, -0.43, -0.34);
  tank.add(st);
  box(st, '#b59a72', 0.62, 0.03, 0.12, 0, 0.015, 0); // perron
  box(st, '#c85a5a', 0.2, 0.15, 0.1, -0.22, 0.105, -0.01);
  box(st, '#8a3a3a', 0.24, 0.025, 0.13, -0.22, 0.19, -0.01); // stationsgebouwtje + dak
  box(st, '#fff3c0', 0.035, 0.05, 0.005, -0.22, 0.11, 0.045);
  sph(st, '#fff8e0', 0.05, 0.05, 0.012, -0.22, 0.165, 0.045); // deur en klokje
  for (const x of [-0.02, 0.28]) box(st, '#5a4a3a', 0.015, 0.14, 0.015, x, 0.1, 0.04);
  box(st, '#3a7ad8', 0.34, 0.02, 0.1, 0.13, 0.18, 0.01); // overkapping
  box(st, '#fff', 0.05, 0.03, 0.005, 0.13, 0.215, 0.05); // naambordje
  const pegs = [
    [0.0, '#e8383d', '#222'],
    [0.07, '#3a7ad8', null],
    [0.14, '#ffd24a', '#c83a3a'],
    [0.2, '#4ab85a', null],
    [0.26, '#c070d8', '#2a2a2a'],
    [-0.05, '#ff8a3a', null],
  ];
  pegs.forEach(([x, c, h], i) => peg(st, x, 0.03, 0.01 + (i % 2) * 0.02, c, h));
  // kasteel
  const ca = new THREE.Group();
  ca.position.set(1.0, -0.43, -0.28);
  tank.add(ca);
  box(ca, '#bfb8a8', 0.36, 0.17, 0.16, 0, 0.085, 0);
  box(ca, '#4a3a2a', 0.07, 0.1, 0.01, 0, 0.05, 0.085);
  for (let i = -3; i <= 3; i++) box(ca, '#bfb8a8', 0.03, 0.03, 0.03, i * 0.05, 0.19, 0.07);
  for (const [x, z] of [
    [-0.2, -0.06],
    [0.2, -0.06],
    [-0.2, 0.07],
    [0.2, 0.07],
  ]) {
    cyl(ca, '#a8a090', 0.045, 0.28, 0.045, x, 0.14, z);
    cone(ca, '#c8403a', 0.065, 0.13, 0.065, x, 0.34, z);
  }
  box(ca, '#6a4a2a', 0.006, 0.12, 0.006, 0, 0.3, -0.04);
  box(ca, '#ffd24a', 0.07, 0.04, 0.004, 0.035, 0.34, -0.04);
  box(ca, '#2a2a30', 0.03, 0.05, 0.005, -0.1, 0.11, 0.082);
  box(ca, '#2a2a30', 0.03, 0.05, 0.005, 0.1, 0.11, 0.082);
  sph(tank, '#8a8a8a', 0.4, 0.28, 0.3, -0.1, -0.4, 0.2);
  sph(tank, '#7a7a8a', 0.26, 0.2, 0.22, 0.6, -0.42, -0.1);
  for (const [x, z] of [
    [-1.58, -0.42],
    [1.58, -0.42],
    [-1.58, 0.42],
    [1.58, 0.42],
  ])
    box(aq, '#2a2a30', 0.06, 1.2, 0.06, x, 1.5, z);
  box(aq, '#2a2a30', 3.2, 0.06, 0.9, 0, 2.12, 0);
  box(aq, '#fff6d8', 2.8, 0.05, 0.5, 0, 2.08, 0, { emissive: '#fff2c0', emissiveIntensity: 0.9 });
  const fishBox = new THREE.Group();
  fishBox.position.copy(tank.position);
  aq.add(fishBox);
  // hondenmand in de hoek
  const basket = new THREE.Group();
  basket.position.set(-hw + 1.3, 0, hd - 1.3);
  g.add(basket);
  cyl(basket, '#b8864a', 0.85, 0.3, 0.85, 0, 0.17, 0);
  cyl(basket, '#8a6030', 0.7, 0.32, 0.7, 0, 0.19, 0, {});
  cyl(basket, '#c85a5a', 0.66, 0.12, 0.66, 0, 0.22, 0);
  const bdog = makeDog(0);
  bdog.scale.setScalar(0.85);
  bdog.position.set(0, 0.2, 0);
  bdog.userData.lying = true;
  bdog.userData.lieT = 1;
  bdog.userData.update(0, 0);
  bdog.rotation.y = 2.2;
  basket.add(bdog);
  bdog.visible = false;
  box(g, '#6a4a2a', 0.9, 0.5, 0.6, hw - 1.1, 0.25, hd - 0.8);
  box(g, '#d8d0b8', 0.5, 0.25, 0.4, hw - 1.1, 0.62, hd - 0.8); // kastje met kist
  shadeModel(g, 0.18);
  const H = { root: g, fishBox, bdog, basket, aq, plaque: null, fish: [], sig: '', t: Math.random() * 9 };
  H.setOwner = name => {
    const iron = String(name).toLowerCase() === 'toon';
    if (iron !== H.iron) {
      H.iron = iron;
      const vis = H.bdog.visible;
      basket.remove(H.bdog);
      const d = makeDog(0, iron ? 'ironman' : null);
      d.scale.setScalar(0.85);
      d.position.set(0, 0.2, 0);
      d.rotation.y = 2.2;
      d.userData.lying = true;
      d.userData.lieT = 1;
      d.userData.update(0, 0);
      basket.add(d);
      d.visible = vis;
      H.bdog = d;
    }
    if (H.owner === name) return;
    H.owner = name;
    if (H.plaque) {
      g.remove(H.plaque);
      H.plaque.material.map.dispose();
    }
    H.plaque = plaque(`Huis van ${name}`);
    H.plaque.position.set(0, 3.55, -hd - 0.02);
    H.plaque.rotation.y = Math.PI;
    g.add(H.plaque);
  };
  // vissen in het aquarium: soorten die de eigenaar ooit ving, klein formaat
  H.setFish = species => {
    const sig = species.map(s => s.id).join(',');
    if (sig === H.sig) return;
    H.sig = sig;
    for (const f of H.fish) fishBox.remove(f.m);
    H.fish = [];
    species.slice(0, 22).forEach((sp, i) => {
      const m = makeFish(sp, null),
        k = 0.19 + Math.min(0.06, sp.w[1] * 0.001) + (sp.shape === 'paling' ? -0.02 : 0);
      m.scale.setScalar(k);
      fishBox.add(m);
      H.fish.push({
        m,
        ph: i * 1.7 + Math.random(),
        sx: 0.6 + (i % 5) * 0.12,
        y: -0.25 + (((i * 37) % 10) / 10) * 0.75,
        z: -0.22 + (((i * 17) % 10) / 10) * 0.44,
        sp: 0.18 + (i % 7) * 0.05,
      });
    });
  };
  /* ---------------- gekochte inrichting (zie DECOR in shared.js) */
  H.deco = {};
  H.setDeco = (ids = [], info = {}) => {
    const want = new Set(ids);
    for (const [id, o] of Object.entries(H.deco)) o.visible = want.has(id);
    for (const id of want)
      if (!H.deco[id] && DECO_BUILD[id])
        H.deco[id] = DECO_BUILD[id](id === 'kist' || id === 'duiker' || id === 'wrak' || id === 'koraal' ? tank : g, hw, hd);
    // trofeekast en schilderij tonen jouw prestaties
    if (H.deco.kast) H.deco.kast.userData.set?.(info.tr | 0, info.best);
    if (H.deco.schilderij) H.deco.schilderij.userData.set?.(info.best);
    shadeModel(g, 0.18); // nieuwe meubels krijgen dezelfde shader als de rest van het huis
  };
  H.update = dt => {
    H.t += dt;
    for (const o of Object.values(H.deco)) if (o.visible) o.userData.tick?.(H.t, dt);
    sway.forEach((pl, i) => {
      pl.rotation.z = Math.sin(H.t * 1.1 + i * 1.3) * 0.08;
    });
    cars.forEach((car, i) => {
      const a = -H.t * 0.45 + i * 0.4;
      car.position.set(Math.cos(a) * TX, -0.41, Math.sin(a) * TZ);
      car.rotation.y = Math.atan2(TZ * Math.cos(a), TX * Math.sin(a));
    });
    for (const f of H.fish) {
      const ph = f.ph + H.t * f.sp,
        x = Math.sin(ph) * 1.3 * f.sx,
        dx = Math.cos(ph) * f.sp;
      f.m.position.set(x, f.y + Math.sin(ph * 2.3) * 0.07, f.z + Math.sin(ph * 1.3) * 0.08);
      f.m.rotation.y = dx > 0 ? 0 : Math.PI;
      if (f.m.userData.tail) f.m.userData.tail.rotation.y = Math.sin(H.t * 8 + f.ph * 3) * 0.5;
    }
  };
  return H;
}

/* ------------------------------------------------------------------ inrichting */
const bubbleMat = new THREE.MeshBasicMaterial({ color: '#e8fbff', transparent: true, opacity: 0.6 });
/** Bubbels die vanaf (x, y, z) in het aquarium omhoog gaan. */
function bubbles(parent, x, y, z, n = 6) {
  const list = [];
  for (let i = 0; i < n; i++) {
    const b = sph(parent, '#ffffff', 0.035, 0.035, 0.035, x, y, z);
    b.material = bubbleMat;
    list.push({ b, ph: i / n });
  }
  return t => {
    for (const { b, ph } of list) {
      const k = (t * 0.35 + ph) % 1;
      b.position.set(x + Math.sin((k + ph) * 9) * 0.03, y + k * 0.95, z);
      b.scale.setScalar(0.03 + k * 0.03);
    }
  };
}
function fishPainting(best) {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 192;
  const x = c.getContext('2d'),
    sp = best && SP[best[0]];
  const gr = x.createLinearGradient(0, 0, 0, 192);
  gr.addColorStop(0, '#9fd8f0');
  gr.addColorStop(0.55, '#5fb0d0');
  gr.addColorStop(1, '#2a6a8a');
  x.fillStyle = gr;
  x.fillRect(0, 0, 256, 192);
  if (sp) {
    const [c1, c2] = sp.c;
    x.fillStyle = c1;
    x.beginPath();
    x.ellipse(118, 96, 70, 30, 0, 0, 7);
    x.fill();
    x.fillStyle = c2;
    x.beginPath();
    x.ellipse(118, 106, 52, 14, 0, 0, 7);
    x.fill();
    x.fillStyle = c1;
    x.beginPath();
    x.moveTo(186, 96);
    x.lineTo(236, 66);
    x.lineTo(236, 126);
    x.fill();
    x.fillStyle = '#fff';
    x.beginPath();
    x.arc(72, 88, 7, 0, 7);
    x.fill();
    x.fillStyle = '#123';
    x.beginPath();
    x.arc(70, 88, 3.5, 0, 7);
    x.fill();
  }
  x.fillStyle = 'rgba(0,0,0,.45)';
  x.fillRect(0, 150, 256, 42);
  x.fillStyle = '#fff';
  x.font = 'bold 18px system-ui,sans-serif';
  x.textAlign = 'center';
  x.fillText(sp ? `${sp.name} · ${fmtKg(best[1])}` : 'Nog geen vangst', 128, 177);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const DECO_BUILD = {
  /* --- in het aquarium (coördinaten in het aquarium: bodem op y -0.43) */
  kist(tank) {
    const g = new THREE.Group();
    g.position.set(0.38, -0.43, 0.27);
    tank.add(g);
    box(g, '#7a4a1a', 0.16, 0.08, 0.1, 0, 0.04, 0);
    box(g, '#d8a838', 0.17, 0.015, 0.105, 0, 0.06, 0);
    const lid = new THREE.Group();
    lid.position.set(0, 0.08, -0.05);
    g.add(lid);
    box(lid, '#8a5a24', 0.16, 0.03, 0.1, 0, 0.015, 0.05);
    sph(g, '#ffd84a', 0.1, 0.03, 0.06, 0, 0.08, 0, { emissive: '#ffcc33', emissiveIntensity: 0.5 });
    const bub = bubbles(tank, 0.38, -0.33, 0.27);
    g.userData.tick = t => {
      lid.rotation.x = -Math.max(0, Math.sin(t * 0.8)) * 0.9;
      bub(t);
    };
    return g;
  },
  duiker(tank) {
    const g = new THREE.Group();
    g.position.set(-0.85, -0.43, 0.27);
    tank.add(g);
    cyl(g, '#e8b030', 0.03, 0.09, 0.03, 0, 0.05, 0);
    sph(g, '#c8a040', 0.07, 0.07, 0.07, 0, 0.13, 0);
    sph(g, '#8fd8ff', 0.035, 0.035, 0.02, 0, 0.13, 0.03, { emissive: '#8fd8ff', emissiveIntensity: 0.4 });
    box(g, '#6a6a70', 0.05, 0.06, 0.03, 0, 0.07, -0.03);
    const bub = bubbles(tank, -0.85, -0.25, 0.27, 4);
    g.userData.tick = t => {
      g.position.y = -0.43 + Math.abs(Math.sin(t * 1.3)) * 0.02;
      bub(t + 0.3);
    };
    return g;
  },
  wrak(tank) {
    const g = new THREE.Group();
    g.position.set(0.3, -0.43, 0.0);
    g.rotation.set(0, 0.5, 0.25);
    tank.add(g);
    box(g, '#5a3a1a', 0.3, 0.06, 0.09, 0, 0.03, 0);
    box(g, '#4a2a10', 0.08, 0.05, 0.09, 0.13, 0.06, 0);
    box(g, '#6a4a2a', 0.012, 0.22, 0.012, -0.02, 0.15, 0);
    box(g, '#2a2a2a', 0.09, 0.06, 0.004, 0.02, 0.2, 0.004);
    sph(g, '#ffffff', 0.02, 0.02, 0.004, 0.02, 0.2, 0.008);
    return g;
  },
  koraal(tank) {
    const g = new THREE.Group();
    g.position.set(-0.5, -0.43, 0.02);
    tank.add(g);
    for (const [x, z, c, h] of [
      [0, 0, '#ff6a8a', 0.16],
      [0.05, 0.03, '#ff9a4a', 0.12],
      [-0.05, 0.02, '#c070ff', 0.14],
    ]) {
      cyl(g, c, 0.012, h, 0.012, x, h / 2, z);
      sph(g, c, 0.035, 0.035, 0.035, x, h, z);
      sph(g, c, 0.025, 0.025, 0.025, x + 0.025, h * 0.7, z);
    }
    return g;
  },
  /* --- in huis (coördinaten in het huis: vloer op y 0, voordeur aan de -z kant) */
  bank(g, hw) {
    const b = new THREE.Group();
    b.position.set(-hw + 0.75, 0, -0.4);
    g.add(b);
    box(b, '#4a6aa0', 0.75, 0.42, 2.0, 0, 0.21, 0);
    box(b, '#3a5a90', 0.2, 0.55, 2.0, -0.3, 0.55, 0);
    for (const s of [-1, 1]) box(b, '#3a5a90', 0.75, 0.32, 0.18, 0, 0.5, s * 0.95);
    for (const z of [-0.45, 0.45]) box(b, '#6a8ac0', 0.5, 0.1, 0.85, 0.05, 0.47, z);
    box(b, '#e8c84a', 0.1, 0.3, 0.3, -0.12, 0.66, -0.5).rotation.x = 0.2; // kussen
    return b;
  },
  lamp(g, hw, hd) {
    const l = new THREE.Group();
    l.position.set(-hw + 0.6, 0, -hd + 0.9);
    g.add(l);
    cyl(l, '#3a3a3a', 0.18, 0.04, 0.18, 0, 0.02, 0);
    cyl(l, '#5a5a5a', 0.025, 1.5, 0.025, 0, 0.77, 0);
    cone(l, '#fff3c8', 0.25, 0.32, 0.25, 0, 1.62, 0, { emissive: '#ffd890', emissiveIntensity: 0.9 });
    return l;
  },
  plant(g, hw, hd) {
    const p = new THREE.Group();
    p.position.set(hw - 0.7, 0, -hd + 0.8);
    g.add(p);
    cyl(p, '#b0603a', 0.22, 0.4, 0.22, 0, 0.2, 0);
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2,
        leaf = sph(p, i % 2 ? '#3a9a4a' : '#4ab05a', 0.18, 0.5, 0.08, Math.cos(a) * 0.15, 0.75, Math.sin(a) * 0.15);
      leaf.rotation.set(Math.sin(a) * 0.5, -a, Math.cos(a) * 0.5);
    }
    p.userData.tick = t => (p.rotation.z = Math.sin(t * 0.7) * 0.02);
    return p;
  },
  kast(g, hw) {
    const k = new THREE.Group();
    k.position.set(hw - 0.5, 0, -0.9);
    g.add(k);
    // open kast: achterwand, zijkanten, boven- en onderkant, planken en een glazen deur
    box(k, '#6a4a2a', 0.06, 1.9, 1.4, 0.22, 0.95, 0);
    for (const s of [-1, 1]) box(k, '#6a4a2a', 0.5, 1.9, 0.06, 0, 0.95, s * 0.67);
    box(k, '#6a4a2a', 0.5, 0.08, 1.4, 0, 1.86, 0);
    box(k, '#6a4a2a', 0.5, 0.2, 1.4, 0, 0.1, 0);
    box(k, '#cfe8f0', 0.02, 1.6, 1.25, -0.25, 0.98, 0, { transparent: true, opacity: 0.18 });
    for (const y of [0.55, 1.15]) box(k, '#8a6a3a', 0.45, 0.04, 1.3, 0, y, 0);
    const cups = new THREE.Group();
    k.add(cups);
    k.userData.set = (n, best) => {
      if (k.userData.sig === n + '|' + (best || []).join()) return;
      k.userData.sig = n + '|' + (best || []).join();
      cups.clear();
      for (let i = 0; i < Math.min(6, Math.max(1, n)); i++) {
        const c = new THREE.Group();
        c.position.set(-0.05, 0.57 + (i >= 3 ? 0.6 : 0), -0.4 + (i % 3) * 0.4);
        cups.add(c);
        const gold = { emissive: '#aa7a10', emissiveIntensity: 0.4 },
          col = n ? '#f2c230' : '#9a9a9a';
        cyl(c, col, 0.06, 0.03, 0.06, 0, 0.015, 0, gold);
        cyl(c, col, 0.02, 0.1, 0.02, 0, 0.08, 0, gold);
        cyl(c, col, 0.08, 0.12, 0.08, 0, 0.19, 0, gold);
      }
      const sp = best && SP[best[0]];
      if (sp) {
        const f = makeFish(sp, null);
        f.scale.setScalar(0.35);
        f.position.set(-0.05, 1.45, 0);
        f.rotation.y = Math.PI / 2;
        cups.add(f);
      }
    };
    return k;
  },
  schilderij(g, hw, hd) {
    const s = new THREE.Group();
    s.position.set(-hw + 1.3, 1.9, hd - 0.31);
    g.add(s);
    box(s, '#8a5a2a', 1.3, 1.0, 0.06, 0, 0, 0);
    const pic = new THREE.Mesh(new THREE.PlaneGeometry(1.15, 0.86), new THREE.MeshBasicMaterial());
    pic.position.z = -0.035;
    pic.rotation.y = Math.PI;
    s.add(pic);
    s.userData.set = best => {
      const sig = (best || []).join();
      if (s.userData.sig === sig) return;
      s.userData.sig = sig;
      pic.material.map?.dispose();
      pic.material.map = fishPainting(best);
      pic.material.needsUpdate = true;
    };
    return s;
  },
  haard(g, hw) {
    const h = new THREE.Group();
    h.position.set(hw - 0.45, 0, 1.6);
    g.add(h);
    box(h, '#8a7a6a', 0.6, 1.2, 1.4, 0, 0.6, 0);
    box(h, '#2a1a10', 0.1, 0.6, 0.8, -0.27, 0.42, 0);
    box(h, '#6a5a4a', 0.75, 0.1, 1.55, -0.05, 1.22, 0);
    const fire = [];
    for (const [z, c] of [
      [-0.15, '#ff7a20'],
      [0.1, '#ffb030'],
      [0, '#ffe060'],
    ])
      fire.push(cone(h, c, 0.12, 0.35, 0.12, -0.3, 0.32, z, { emissive: c, emissiveIntensity: 1 }));
    box(h, '#4a2a10', 0.12, 0.08, 0.6, -0.3, 0.16, 0);
    h.userData.tick = t =>
      fire.forEach((f, i) => {
        f.scale.y = 0.3 + Math.abs(Math.sin(t * (6 + i * 2.3) + i)) * 0.15;
      });
    return h;
  },
};
