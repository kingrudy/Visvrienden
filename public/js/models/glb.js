// Kleine eigen .glb-lader voor de Blender-modellen (alleen wat Blender hier exporteert: meshes, kleuren, node-hiërarchie).
import * as THREE from 'three';

// Kleine eigen .glb-lader (alleen wat Blender hier exporteert: meshes, kleuren, node-hiërarchie).
export const ANGLERS = [null, null, null, null],
  DOGS = [null, null, null, null];
function parseGLB(buf) {
  const dv = new DataView(buf);
  if (dv.getUint32(0, true) !== 0x46546c67) throw new Error('geen glb');
  let off = 12,
    json = null,
    bin = null;
  while (off < buf.byteLength) {
    const len = dv.getUint32(off, true),
      type = dv.getUint32(off + 4, true);
    const chunk = buf.slice(off + 8, off + 8 + len);
    if (type === 0x4e4f534a) json = JSON.parse(new TextDecoder().decode(chunk));
    else if (type === 0x004e4942) bin = chunk;
    off += 8 + len;
  }
  const NC = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 },
    CT = { 5120: Int8Array, 5121: Uint8Array, 5122: Int16Array, 5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array };
  const acc = i => {
    const a = json.accessors[i],
      bv = json.bufferViews[a.bufferView],
      T = CT[a.componentType],
      n = NC[a.type],
      base = (bv.byteOffset || 0) + (a.byteOffset || 0),
      stride = bv.byteStride;
    if (!stride || stride === T.BYTES_PER_ELEMENT * n) return new T(bin.slice(base, base + a.count * n * T.BYTES_PER_ELEMENT));
    const out = new T(a.count * n),
      src = new DataView(bin);
    for (let k = 0; k < a.count; k++)
      for (let j = 0; j < n; j++) {
        const o = base + k * stride + j * T.BYTES_PER_ELEMENT;
        out[k * n + j] =
          T === Float32Array
            ? src.getFloat32(o, true)
            : T === Uint16Array
              ? src.getUint16(o, true)
              : T === Uint32Array
                ? src.getUint32(o, true)
                : src.getUint8(o);
      }
    return out;
  };
  const mats = (json.materials || []).map(m => {
    const f = m.pbrMetallicRoughness?.baseColorFactor || [1, 1, 1, 1];
    return new THREE.MeshLambertMaterial({ color: new THREE.Color().setRGB(f[0], f[1], f[2], THREE.LinearSRGBColorSpace) });
  });
  const meshes = json.meshes.map(me =>
    me.primitives.map(p => {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(acc(p.attributes.POSITION), 3));
      if (p.attributes.NORMAL) g.setAttribute('normal', new THREE.BufferAttribute(acc(p.attributes.NORMAL), 3));
      else g.computeVertexNormals();
      if (p.indices !== undefined) g.setIndex(new THREE.BufferAttribute(acc(p.indices), 1));
      return new THREE.Mesh(g, mats[p.material] || new THREE.MeshLambertMaterial({ color: '#cccccc' }));
    }),
  );
  const nodes = json.nodes.map(nd => {
    const o = new THREE.Group();
    o.name = nd.name || '';
    if (nd.matrix) o.applyMatrix4(new THREE.Matrix4().fromArray(nd.matrix));
    else {
      if (nd.translation) o.position.fromArray(nd.translation);
      if (nd.rotation) o.quaternion.fromArray(nd.rotation);
      if (nd.scale) o.scale.fromArray(nd.scale);
    }
    if (nd.mesh !== undefined) for (const m of meshes[nd.mesh]) o.add(m.clone());
    return o;
  });
  json.nodes.forEach((nd, i) => (nd.children || []).forEach(c => nodes[i].add(nodes[c])));
  const sc = json.scenes[json.scene || 0],
    out = new THREE.Group();
  for (const i of sc.nodes) out.add(nodes[i]);
  out.traverse(o => {
    if (o.isMesh) {
      o.castShadow = false;
      o.receiveShadow = false;
    }
  });
  return out;
}
export async function loadAnglers(base = 'models/') {
  const load = async (arr, name, i) => {
    try {
      const r = await fetch(`${base}${name}${i}.glb`);
      if (!r.ok) return;
      arr[i] = parseGLB(await r.arrayBuffer());
    } catch (e) {
      console.warn(name + i, e.message);
    }
  };
  await Promise.all([0, 1, 2, 3].flatMap(i => [load(ANGLERS, 'angler', i), load(DOGS, 'dog', i)]));
  return ANGLERS.filter(Boolean).length + DOGS.filter(Boolean).length;
}
