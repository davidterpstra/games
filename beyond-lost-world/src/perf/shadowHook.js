// Shadow-pass hooks.
// Shadow-only proxy meshes (merged structure casters, per-frame instanced tree/rock casters) are invisible in
// the main pass and become visible only while the shadow map is rendered. That keeps the shadow pass cheap
// (a handful of draw calls, only the geometry that can actually land inside the shadow frustum) without
// touching what the main pass draws.
import * as THREE from 'three';

const proxies = new Set();
const updaters = new Set();

/** Registers a mesh that casts shadows on behalf of other (non-casting) meshes. It is only visible during the shadow pass. */
export function addShadowProxy(mesh) {
  mesh.visible = false;
  mesh.castShadow = true;
  mesh.receiveShadow = false;
  mesh.matrixAutoUpdate = false;
  mesh.userData.shadowProxy = true;
  proxies.add(mesh);
  return mesh;
}

/** Registers fn(shadowCamera, mainCamera) – called right before every shadow-map render (to refresh instanced proxies). */
export function addShadowUpdater(fn) { updaters.add(fn); return () => updaters.delete(fn); }

/**
 * Merges the position data of `meshes` into per-side shadow proxies and turns their own shadow casting off.
 * Meshes with alpha-tested/transparent materials are left alone (they keep casting on their own).
 * @param {THREE.Mesh[]} meshes static world-space meshes
 * @param {THREE.Object3D} parent where the proxies are added
 * @returns {THREE.Mesh[]} the created proxies
 */
export function mergeShadowCasters(meshes, parent, name = 'shadow') {
  const bySide = new Map();
  for (const m of meshes) {
    const mat = m.material;
    if (!m.castShadow || m.userData.clutter || Array.isArray(mat) || mat.alphaTest > 0 || mat.transparent) continue;
    const key = (mat.shadowSide ?? mat.side) + '|' + (m.userData.cell || '');
    (bySide.get(key) || bySide.set(key, []).get(key)).push(m);
  }
  const out = [];
  for (const [key, list] of bySide) {
    const side = Number(key.split('|')[0]);
    let nv = 0, ni = 0;
    for (const m of list) { const g = m.geometry; nv += g.attributes.position.count; ni += g.index ? g.index.count : g.attributes.position.count; }
    const P = new Float32Array(nv * 3), I = new Uint32Array(ni);
    let vo = 0, io = 0;
    for (const m of list) {
      const g = m.geometry, pos = g.attributes.position, c = pos.count;
      m.updateMatrix();
      const e = m.matrix.elements;
      for (let i = 0; i < c; i++) {
        const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
        P[(vo + i) * 3] = e[0] * x + e[4] * y + e[8] * z + e[12];
        P[(vo + i) * 3 + 1] = e[1] * x + e[5] * y + e[9] * z + e[13];
        P[(vo + i) * 3 + 2] = e[2] * x + e[6] * y + e[10] * z + e[14];
      }
      if (g.index) for (let i = 0; i < g.index.count; i++) I[io + i] = g.index.getX(i) + vo;
      else for (let i = 0; i < c; i++) I[io + i] = vo + i;
      vo += c; io += g.index ? g.index.count : c;
      m.castShadow = false;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(P, 3));
    geo.setIndex(new THREE.BufferAttribute(I, 1));
    geo.computeBoundingSphere();
    const mat = new THREE.MeshBasicMaterial({ side });
    const proxy = new THREE.Mesh(geo, mat);
    proxy.name = `${name}:proxy`;
    addShadowProxy(proxy);
    parent.add(proxy);
    out.push(proxy);
  }
  return out;
}

/**
 * Wraps renderer.shadowMap.render so proxies are visible and updaters run only when a shadow map is really rendered.
 * Safe to call more than once per renderer.
 */
export function installShadowHook(renderer) {
  const sm = renderer.shadowMap;
  if (sm.__proxyHook) return;
  sm.__proxyHook = true;
  const orig = sm.render.bind(sm);
  sm.render = (lights, scene, camera) => {
    if (lights.length === 0 || sm.enabled === false || (sm.autoUpdate === false && sm.needsUpdate === false)) return orig(lights, scene, camera);
    const light = lights[0];
    if (light.shadow && light.shadow.camera) {
      light.shadow.updateMatrices(light);
      for (const fn of updaters) fn(light.shadow.camera, camera);
    }
    for (const p of proxies) p.visible = true;
    orig(lights, scene, camera);
    for (const p of proxies) p.visible = false;
    return undefined;
  };
}
