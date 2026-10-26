// Het huis van een speler: aquarium met gevangen soorten, decor (plantjes, treintje, station, kasteel) en hondenmand.
import * as THREE from 'three';
import { makeDog } from './animals.js';
import { box, cone, cyl, sph } from './core.js';
import { makeFish } from './fish.js';
import { shadeModel } from './shading.js';

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
    if (H.plaque) g.remove(H.plaque);
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
  H.update = dt => {
    H.t += dt;
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
