// Procedural models for the collectable items. Every model lies on the ground with its lowest point at y = 0.
// `getItemParts(type)` returns shared {geometry, material} parts (used for InstancedMesh as well),
// `createItemObject(type)` returns a ready Group for single objects.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { SimplexNoise } from 'three/addons/math/SimplexNoise.js';
import { mulberry32 } from '../world/layout.js';
import { barkTexture, rustTexture, fabricTexture, sunDiscTexture, cardFaceTexture } from './ModelTextures.js';

/** Makes a geometry mergeable: non-indexed with position/normal/uv/color only. */
export function prep(geo, color = [1, 1, 1]) {
  let g = geo.index ? geo.toNonIndexed() : geo;
  for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(name)) g.deleteAttribute(name);
  const n = g.attributes.position.count;
  if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
  if (typeof color === 'function') {
    const arr = new Float32Array(n * 3), p = g.attributes.position;
    for (let i = 0; i < n; i++) { const c = color(p.getX(i), p.getY(i), p.getZ(i)); arr[i * 3] = c[0]; arr[i * 3 + 1] = c[1]; arr[i * 3 + 2] = c[2]; }
    g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  } else {
    const c = color.isColor ? [color.r, color.g, color.b] : color;
    const arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { arr[i * 3] = c[0]; arr[i * 3 + 1] = c[1]; arr[i * 3 + 2] = c[2]; }
    g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  }
  return g;
}

/** Moves a geometry so it sits on y = 0 and is centred on x/z. */
export function ground(geo) {
  geo.computeBoundingBox();
  const b = geo.boundingBox;
  geo.translate(-(b.min.x + b.max.x) / 2, -b.min.y, -(b.min.z + b.max.z) / 2);
  geo.computeBoundingSphere();
  return geo;
}

/** Displaces vertices by a function of their position (shared-position vertices stay welded). */
function displace(geo, fn) {
  const p = geo.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); fn(v); p.setXYZ(i, v.x, v.y, v.z); }
  geo.computeVertexNormals();
  return geo;
}

const mats = {};
const mat = (key, make) => (mats[key] ||= make());

// ---------------------------------------------------------------------------------------------
// Branch

function limb(len, r0, r1, bend, noise, seed, tone = 1) {
  const g = new THREE.CylinderGeometry(r1, r0, len, 9, 14, false);
  displace(g, (v) => {
    const t = (v.y + len / 2) / len;
    const n = 1 + 0.2 * noise.noise3d(v.x * 40 + seed, v.y * 7, v.z * 40) + 0.07 * noise.noise3d(v.x * 120, v.y * 25 + seed, v.z * 120);
    const knob = Math.abs(v.y) < len / 2 - 0.001 ? 1 : 1;
    v.x *= n * knob; v.z *= n * knob;
    v.z += bend * Math.sin(t * Math.PI) + bend * 0.35 * Math.sin(t * 6.283 + seed);
    v.x += bend * 0.2 * Math.sin(t * Math.PI * 1.5);
  });
  g.rotateZ(-Math.PI / 2);
  return prep(g, (x, y, z) => { const k = (0.8 + 0.35 * noise.noise3d(x * 30, y * 30, z * 30)) * tone; return [0.52 * k, 0.4 * k, 0.28 * k]; });
}

function buildBranch() {
  const noise = new SimplexNoise(mulberry32(11));
  const parts = [limb(0.95, 0.05, 0.028, 0.045, noise, 1)];
  const twigs = [[-0.22, 0.6, 0.5], [0.08, -0.7, 0.4], [0.26, 0.5, 0.3]];
  twigs.forEach(([x, yaw, size], i) => {
    const tw = limb(0.34 * size + 0.12, 0.016, 0.006, 0.012, noise, 5 + i, 0.9);
    tw.translate(0.17 * size + 0.05, 0, 0);
    tw.rotateZ(0.5); tw.rotateY(yaw);
    tw.translate(x, 0.0, 0);
    parts.push(tw);
  });
  // short broken stub
  const stub = limb(0.12, 0.022, 0.012, 0, noise, 9, 1.1); stub.rotateY(-1.1); stub.translate(-0.05, 0.02, 0.01); parts.push(stub);
  const g = ground(mergeGeometries(parts));
  g.rotateZ(0.04); ground(g);
  return [{ geometry: g, material: mat('bark', () => new THREE.MeshStandardMaterial({ map: barkTexture(), bumpMap: barkTexture(), bumpScale: 2, vertexColors: true, roughness: 0.95 })) }];
}

// ---------------------------------------------------------------------------------------------
// Stone

function buildStone() {
  const noise = new SimplexNoise(mulberry32(21));
  const g = new THREE.DodecahedronGeometry(0.2, 2);
  displace(g, (v) => {
    const n = 1 + 0.22 * noise.noise3d(v.x * 5, v.y * 5, v.z * 5) + 0.06 * noise.noise3d(v.x * 22, v.y * 22, v.z * 22);
    v.multiplyScalar(n);
    v.x *= 1.25; v.z *= 0.95; v.y *= 0.62;
    if (v.y < -0.07) v.y = -0.07 + (v.y + 0.07) * 0.25; // flat bottom
  });
  const out = prep(g, (x, y, z) => {
    const k = 0.62 + 0.3 * noise.noise3d(x * 14, y * 14, z * 14);
    const moss = Math.max(0, noise.noise3d(x * 6 + 9, y * 6, z * 6)) * (y > 0 ? 1 : 0.2);
    return [(0.52 - moss * 0.18) * k, (0.5 + moss * 0.06) * k, (0.47 - moss * 0.2) * k];
  });
  ground(out);
  return [{ geometry: out, material: mat('stone', () => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, flatShading: true })) }];
}

// ---------------------------------------------------------------------------------------------
// Fibre bundle

function buildFiber() {
  const rng = mulberry32(31);
  const parts = [];
  const blades = 22;
  for (let i = 0; i < blades; i++) {
    const len = 0.46 + rng() * 0.16, w = 0.017 + rng() * 0.01;
    const g = new THREE.PlaneGeometry(w, len, 1, 8);
    const fan = (rng() - 0.5) * 0.7, lift = 0.012 + rng() * 0.05, side = rng() - 0.5;
    const layer = i * 0.0028;
    displace(g, (v) => {
      const t = (v.y + len / 2) / len;              // 0..1 along blade
      const taper = 1 - Math.pow(Math.abs(t - 0.5) * 2, 3) * 0.75;
      const px = (t - 0.5) * len;
      const arch = Math.sin(t * Math.PI) * lift;
      v.set(px * Math.cos(fan) - side * 0.05 * Math.sin(fan), layer + arch + v.x * taper * 0.2, px * Math.sin(fan) * 0.9 + side * 0.04 + v.x * taper);
    });
    parts.push(prep(g, (x) => { const k = 0.7 + rng() * 0.35; const edge = Math.min(1, Math.abs(x) / 0.2); return [0.34 * k + edge * 0.18, 0.58 * k + edge * 0.1, 0.2 * k]; }));
  }
  const tie = new THREE.TorusGeometry(0.036, 0.0085, 6, 14); tie.rotateY(Math.PI / 2); tie.translate(0, 0.036, 0);
  const tie2 = tie.clone(); tie2.translate(0.026, 0, 0);
  parts.push(prep(tie, [0.34, 0.24, 0.12]), prep(tie2, [0.3, 0.21, 0.1]));
  const g = ground(mergeGeometries(parts));
  return [{ geometry: g, material: mat('fiber', () => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, side: THREE.DoubleSide })) }];
}

// ---------------------------------------------------------------------------------------------
// Resin: bark chip with an amber lump (two parts)

function buildResin() {
  const noise = new SimplexNoise(mulberry32(41));
  const chip = new THREE.BoxGeometry(0.3, 0.035, 0.19, 8, 1, 5);
  displace(chip, (v) => {
    v.y += 0.02 * noise.noise3d(v.x * 8, 0, v.z * 8) + 0.025 * (v.x * v.x) * 4;
    v.x += 0.012 * noise.noise3d(v.z * 14, 1, 2); v.z += 0.012 * noise.noise3d(v.x * 14, 5, 3);
  });
  const chipG = prep(chip, (x, y, z) => { const k = 0.8 + 0.4 * noise.noise3d(x * 30, y * 30, z * 30); return [0.5 * k, 0.38 * k, 0.26 * k]; });
  ground(chipG);
  const lump = new THREE.IcosahedronGeometry(0.075, 3);
  displace(lump, (v) => {
    const n = 1 + 0.16 * noise.noise3d(v.x * 9, v.y * 9, v.z * 9);
    v.multiplyScalar(n); v.x *= 1.35; v.y *= 0.72; v.z *= 1.0;
  });
  const drip = new THREE.IcosahedronGeometry(0.035, 2); displace(drip, (v) => { v.y *= 0.8; v.x *= 1.2; });
  drip.translate(0.1, -0.012, 0.05);
  const drip2 = new THREE.IcosahedronGeometry(0.024, 2); drip2.translate(-0.085, -0.02, -0.055);
  const amber = mergeGeometries([prep(lump), prep(drip), prep(drip2)]);
  amber.translate(0.01, 0.063, 0.0);
  return [
    { geometry: chipG, material: mat('bark', () => new THREE.MeshStandardMaterial({ map: barkTexture(), bumpMap: barkTexture(), bumpScale: 2, vertexColors: true, roughness: 0.95 })) },
    { geometry: amber, material: mat('amber', () => new THREE.MeshPhysicalMaterial({ color: 0xe0861f, emissive: 0x9a3f06, emissiveIntensity: 0.4, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.1, transparent: true, opacity: 0.9 })) },
  ];
}

// ---------------------------------------------------------------------------------------------
// Cloth: folded fabric

function buildCloth() {
  const noise = new SimplexNoise(mulberry32(51));
  const parts = [];
  const layers = [[0.36, 0.25, 0.0, 0.0], [0.34, 0.24, 0.07, 0.0], [0.32, 0.23, -0.12, 0.0], [0.3, 0.2, 0.18, 0.0]];
  let y = 0;
  layers.forEach(([w, d, rot], i) => {
    const g = new THREE.BoxGeometry(w, 0.034, d, 12, 1, 8);
    displace(g, (v) => {
      const e = Math.min(1, Math.abs(v.x) / (w / 2)) ** 3;
      v.y += 0.012 * noise.noise3d(v.x * 7 + i * 3, v.z * 7, i) + (v.y > 0 ? 0 : 0);
      if (v.y > 0 && Math.abs(v.x) > w / 2 - 0.02) v.y += 0.012 * e; // rolled fold edge
      v.z += 0.008 * noise.noise3d(v.x * 10, i, v.z * 10);
    });
    g.rotateY(rot); g.translate(0.008 * i, y + 0.017, 0.006 * i);
    y += 0.03;
    parts.push(prep(g, [0.92 + 0.05 * (i % 2), 0.92 + 0.05 * (i % 2), 0.9]));
  });
  // a loose corner hanging over the pile
  const flap = new THREE.PlaneGeometry(0.16, 0.14, 6, 6);
  displace(flap, (v) => { const t = (v.x + 0.08) / 0.16; v.set(v.x, 0, v.y); v.y = y + 0.01 - Math.pow(t, 2.4) * 0.07 + 0.006 * noise.noise3d(v.x * 20, 0, v.z * 20); });
  flap.translate(0.14, 0, 0.12);
  parts.push(prep(flap, [0.92, 0.92, 0.9]));
  const g = ground(mergeGeometries(parts));
  return [{ geometry: g, material: mat('cloth', () => new THREE.MeshStandardMaterial({ map: fabricTexture(), vertexColors: true, roughness: 1, side: THREE.DoubleSide })) }];
}

// ---------------------------------------------------------------------------------------------
// Scrap: bent rusty plates and a pipe

function plate(w, d, bendX, bendZ, noise, seed) {
  const g = new THREE.BoxGeometry(w, 0.014, d, 10, 1, 8);
  displace(g, (v) => {
    const nx = v.x / (w / 2), nz = v.z / (d / 2);
    v.y += bendX * nx * nx + bendZ * Math.max(0, nz) ** 2 * 2 + 0.01 * noise.noise3d(v.x * 6 + seed, v.z * 6, seed);
    // ragged edge
    if (Math.abs(nx) > 0.96) v.x += 0.02 * noise.noise3d(v.z * 25 + seed, 3, 4);
    if (nz > 0.96) v.z += 0.025 * noise.noise3d(v.x * 25, 7, seed);
  });
  return g;
}

function buildScrap() {
  const noise = new SimplexNoise(mulberry32(61));
  const parts = [];
  const a = plate(0.34, 0.24, 0.02, 0.05, noise, 1); a.rotateY(0.3); a.translate(0, 0.01, 0);
  const b = plate(0.28, 0.2, -0.03, 0.04, noise, 2); b.rotateZ(0.32); b.rotateY(-0.9); b.translate(0.04, 0.06, 0.02);
  const c = plate(0.24, 0.16, 0.03, 0.02, noise, 3); c.rotateX(0.18); c.rotateY(1.7); c.translate(-0.07, 0.035, -0.05);
  parts.push(prep(a, [1, 0.95, 0.9]), prep(b, [0.9, 0.82, 0.78]), prep(c, [1, 0.9, 0.82]));
  const pipe = new THREE.CylinderGeometry(0.03, 0.03, 0.3, 14, 3, true);
  displace(pipe, (v) => { const n = 1 + 0.1 * noise.noise3d(v.x * 30, v.y * 8, v.z * 30); v.x *= n; v.z *= n; if (v.y > 0.1) v.x += (v.y - 0.1) * 0.15; });
  pipe.rotateZ(Math.PI / 2); pipe.rotateY(-0.5); pipe.translate(0.1, 0.034, 0.14);
  parts.push(prep(pipe, [0.85, 0.75, 0.7]));
  for (let i = 0; i < 3; i++) { // bolts
    const bolt = new THREE.CylinderGeometry(0.012, 0.012, 0.016, 6); bolt.translate(-0.1 + i * 0.07, 0.03 + (i % 2) * 0.03, 0.02 - i * 0.04);
    parts.push(prep(bolt, [0.4, 0.3, 0.25]));
  }
  const g = ground(mergeGeometries(parts));
  // plates use planar uv from box; fine for the rust map
  return [{ geometry: g, material: mat('rust', () => new THREE.MeshStandardMaterial({ map: rustTexture(), vertexColors: true, roughness: 0.78, metalness: 0.35, side: THREE.DoubleSide })) }];
}

// ---------------------------------------------------------------------------------------------
// Sun disc

function buildSunDisc() {
  const R = 0.27;
  const disc = new THREE.CylinderGeometry(R, R, 0.034, 64, 1, false);
  // cylinder uv: the cap uv is a disc mapping on the top (group 1) – good for our face texture
  const tex = sunDiscTexture();
  const faceMat = mat('sundisc_face', () => new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: 0xffc860, emissiveIntensity: 0.28, metalness: 0.65, roughness: 0.38 }));
  const rimMat = mat('sundisc_rim', () => new THREE.MeshStandardMaterial({ color: 0xcf9a2a, emissive: 0xffa830, emissiveIntensity: 0.22, metalness: 0.7, roughness: 0.35 }));
  disc.translate(0, 0.017, 0);
  const rim = new THREE.TorusGeometry(R, 0.013, 8, 64); rim.rotateX(Math.PI / 2); rim.translate(0, 0.019, 0);
  // groups: 0 side, 1 top, 2 bottom
  return [
    { geometry: disc, material: [rimMat, faceMat, rimMat] },
    { geometry: rim, material: rimMat },
  ];
}

// ---------------------------------------------------------------------------------------------
// Keycard

function buildKeycard() {
  const W = 0.17, H = 0.011, D = 0.108;
  const g = new THREE.BoxGeometry(W, H, D);
  g.translate(0, H / 2, 0);
  const face = mat('card_face', () => new THREE.MeshStandardMaterial({ map: cardFaceTexture(), alphaTest: 0.5, roughness: 0.4, metalness: 0.1 }));
  const edge = mat('card_edge', () => new THREE.MeshStandardMaterial({ color: 0x1d2628, roughness: 0.5 }));
  // BoxGeometry material order: +x -x +y -y +z -z
  return [{ geometry: g, material: [edge, edge, face, edge, edge, edge] }];
}

// ---------------------------------------------------------------------------------------------

const BUILDERS = { wood: buildBranch, stone: buildStone, fiber: buildFiber, resin: buildResin, cloth: buildCloth, scrap: buildScrap, sundisc: buildSunDisc, keycard: buildKeycard };
const partCache = new Map();

/** Shared model parts of an item type: Array<{geometry, material}>. */
export function getItemParts(type) {
  if (!partCache.has(type)) {
    const b = BUILDERS[type];
    if (!b) throw new Error(`No model for item "${type}"`);
    partCache.set(type, b());
  }
  return partCache.get(type);
}

/** A Group with the item's meshes (geometry/materials shared between all calls). */
export function createItemObject(type, { shadows = true } = {}) {
  const group = new THREE.Group();
  group.name = `item_${type}`;
  for (const part of getItemParts(type)) {
    const m = new THREE.Mesh(part.geometry, part.material);
    m.castShadow = shadows; m.receiveShadow = true;
    group.add(m);
  }
  return group;
}

/** Approximate half-height used for light-shaft placement etc. */
export function itemHeight(type) { return getItemParts(type)[0].geometry.boundingBox?.max.y ?? 0.1; }
