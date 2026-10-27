// Shaders voor de modellen: cartoon-tinten (toon shading), contouren, randlicht en kleurbanden.
import * as THREE from 'three';

/* ---- shader voor personen, honden en huizen: randlicht (rim) + zachte kleurbanden in het licht ---- */
const SHADED = new WeakSet(),
  SHADE_T = { value: 0 };
if (typeof requestAnimationFrame === 'function') {
  const tick = t => {
    SHADE_T.value = t / 1000;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
/** Lage grafische kwaliteit (telefoons): geen contouren, dat scheelt de helft van de te tekenen vormen. */
let low = false;
export const setLowQuality = on => (low = !!on);
export function outlineFit(root, t = 0.022) {
  if (low) return root;
  const list = [];
  root.traverse(o => {
    if (o.isMesh && !o.userData.isOutline && o.visible && !o.material.transparent && !o.material.isMeshBasicMaterial) list.push(o);
  });
  for (const m of list) {
    const g = m.geometry;
    if (!g.boundingBox) g.computeBoundingBox();
    const b = g.boundingBox,
      c = b.getCenter(new THREE.Vector3()),
      sz = b.getSize(new THREE.Vector3());
    const ws = new THREE.Vector3();
    m.getWorldScale(ws);
    const half = Math.max(0.02, Math.max(sz.x * ws.x, sz.y * ws.y, sz.z * ws.z) / 2);
    const k = Math.min(1.5, 1 + t / half),
      ol = new THREE.Mesh(g, OUTLINE_MAT);
    ol.scale.setScalar(k);
    ol.position.copy(c).multiplyScalar(1 - k);
    ol.userData.isOutline = true;
    ol.raycast = () => {};
    m.add(ol);
  }
  return root;
}
export function shadeModel(root, rim = 0.32) {
  root.traverse(o => {
    if (!o.isMesh) return;
    for (const m of [].concat(o.material)) {
      if (!m || SHADED.has(m) || !(m.isMeshLambertMaterial || m.isMeshStandardMaterial || m.isMeshPhongMaterial)) continue;
      SHADED.add(m);
      const prev = m.onBeforeCompile;
      m.onBeforeCompile = (sh, r) => {
        prev && prev.call(m, sh, r);
        sh.uniforms.uST = SHADE_T;
        sh.vertexShader =
          'varying float vSY;\n' +
          sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vSY = (modelMatrix*vec4(transformed,1.0)).y;');
        sh.fragmentShader =
          'uniform float uST; varying float vSY;\n' +
          sh.fragmentShader.replace(
            '#include <opaque_fragment>',
            `
          { float lum = dot(outgoingLight, vec3(0.299, 0.587, 0.114));
            float bl = (floor(min(lum, 0.999)*3.0) + 0.5)/3.0; outgoingLight *= mix(1.0, clamp(bl/max(lum, 0.02), 0.6, 1.6), 0.6);
            float rimF = pow(1.0 - clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0), 2.6);
            outgoingLight += vec3(0.75, 0.95, 1.0) * rimF * ${rim.toFixed(2)} * (0.25 + lum);
            float sw = smoothstep(0.82, 1.0, sin(vSY*2.2 - uST*1.6)); outgoingLight += vec3(1.0, 0.95, 0.75) * sw * 0.16 * (0.3 + lum); }
          #include <opaque_fragment>`,
          );
      };
      m.customProgramCacheKey = () => 'vvshade' + rim;
      m.needsUpdate = true;
    }
  });
  return root;
}
/* ---- cartoonstijl: toon shading (3 tinten) + contour (inverted hull) ---- */
export const TOON_GRADIENT = (() => {
  // gedeeld: 3 pixels = 3 schaduwtinten
  const t = new THREE.DataTexture(new Uint8Array([90, 170, 255]), 3, 1, THREE.RedFormat, THREE.UnsignedByteType);
  t.minFilter = t.magFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.needsUpdate = true;
  return t;
})();
const toonCache = new Map();
export function toonMat(color) {
  let m = toonCache.get(color);
  if (!m) {
    m = new THREE.MeshToonMaterial({ color, gradientMap: TOON_GRADIENT });
    toonCache.set(color, m);
  }
  return m;
}
export const OUTLINE_COLOR = 0x3a1d2b,
  OUTLINE_SCALE = 1.08; // contourkleur en -dikte (1.06 - 1.08)
const OUTLINE_MAT = new THREE.MeshBasicMaterial({ color: OUTLINE_COLOR, side: THREE.BackSide }); // gedeeld door alle vissen
// Voegt aan elke mesh in object3D een contour-kindmesh toe (zelfde geometry, gedeeld materiaal). Meshes met userData.noOutline (ogen, gloed) blijven vrij.
export function addOutline(object3D, scale = OUTLINE_SCALE) {
  if (low) return object3D;
  const meshes = [];
  object3D.traverse(o => {
    if (o.isMesh && !o.userData.noOutline && !o.userData.isOutline) meshes.push(o);
  });
  for (const m of meshes) {
    const ol = new THREE.Mesh(m.geometry, OUTLINE_MAT);
    ol.scale.setScalar(scale);
    ol.userData.isOutline = true;
    m.add(ol);
  }
  return object3D;
}
// Kleuren per vissoort: pas hier gerust aan. Sleutel = soort-id (zie SPECIES in shared.js); alles is optioneel.
//   body = lijf, belly = buik, fin = vinnen/staart.   Voorbeeld:  goudvis: { body: '#ff9a2a', fin: '#e07a10' }
