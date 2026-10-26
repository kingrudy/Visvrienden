// Roeiboot, fiets, scooter en de kar van de reizende verkoper.
import * as THREE from 'three';
import { TORUS, box, cone, emis, label, mat, sph } from './core.js';

/* ------------------------------------------------------------------ vervoer */
export function makeBoat() {
  const g = new THREE.Group();
  box(g, '#8a5a30', 1.1, 0.35, 2.6, 0, 0.1, 0);
  box(g, '#8a5a30', 0.7, 0.35, 0.8, 0, 0.1, 1.55).rotation.y = 0;
  box(g, '#a87040', 0.8, 0.06, 1.8, 0, 0.3, -0.1);
  box(g, '#c8d8e0', 1.12, 0.06, 2.62, 0, 0.28, 0, { transparent: true, opacity: 0 });
  box(g, '#6a4020', 0.08, 0.08, 1.6, -0.62, 0.45, 0).rotation.y = 0.2;
  box(g, '#6a4020', 0.08, 0.08, 1.6, 0.62, 0.45, 0).rotation.y = -0.2;
  g.userData.seatY = 0.28;
  return g;
}
export function makeBike(scooter = false) {
  const g = new THREE.Group(),
    w = scooter ? 0.28 : 0.4;
  const wheel = z => {
    const t = new THREE.Mesh(TORUS, mat('#222'));
    t.scale.set(w * 2, w * 2, 1.5);
    t.rotation.y = Math.PI / 2;
    t.position.set(0, w, z);
    g.add(t);
    return t;
  };
  g.userData.wheels = [wheel(0.55), wheel(-0.55)];
  box(g, scooter ? '#2a8ac8' : '#c83a3a', 0.08, 0.08, 1.1, 0, w + 0.25, 0);
  box(g, scooter ? '#2a8ac8' : '#c83a3a', 0.07, 0.6, 0.07, 0, w + 0.45, 0.5);
  box(g, '#222', 0.5, 0.05, 0.05, 0, w + 0.78, 0.5);
  box(g, '#222', 0.2, 0.06, 0.4, 0, w + 0.42, -0.2);
  if (scooter) {
    box(g, '#2a8ac8', 0.3, 0.07, 0.9, 0, 0.18, 0);
  }
  g.userData.seatY = w + 0.35;
  return g;
}
export function makeCart() {
  const g = new THREE.Group();
  box(g, '#7a4a2a', 1.8, 0.5, 2.8, 0, 0.8, 0);
  box(g, '#8a5a30', 1.9, 0.6, 0.12, 0, 1.2, 1.4);
  box(g, '#8a5a30', 1.9, 0.6, 0.12, 0, 1.2, -1.4);
  for (const x of [-1, 1])
    for (const z of [-0.9, 0.9]) {
      const w = new THREE.Mesh(TORUS, mat('#3a2a1a'));
      w.scale.set(1.5, 1.5, 3);
      w.rotation.y = Math.PI / 2;
      w.position.set(x * 0.95, 0.6, z);
      g.add(w);
    }
  for (const x of [-0.8, 0.8]) for (const z of [-1.2, 1.2]) box(g, '#6a3a1a', 0.09, 1.6, 0.09, x, 1.9, z);
  box(g, '#8a2ac8', 2.2, 0.1, 3.2, 0, 2.75, 0);
  cone(g, '#c86ae8', 1.8, 0.7, 2.2, 0, 3.1, 0).rotation.y = Math.PI / 4;
  box(g, '#e8b838', 1.2, 0.5, 1.2, 0, 1.3, 0);
  box(g, '#c85a5a', 0.7, 0.4, 0.7, 0.3, 1.7, 0.2);
  const lamp = sph(g, '#ffd878', 0.3, 0.3, 0.3, 1.1, 2.4, 1.5, emis('#ffcc55', 1.2));
  g.userData.lamp = lamp;
  const mark = label('🧳 Reizende verkoper', '#ffe08a');
  mark.position.set(0, 4.3, 0);
  mark.scale.set(5, 1.25, 1);
  g.add(mark);
  return g;
}
