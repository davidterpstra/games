// Dev preview for src/world/structures: stand-in terrain (flat pads + noise + river), lights, URL camera params.
//   ?x=&y=&z=&lx=&ly=&lz=  camera / look-at   &torch=1  &powered=1  &low=1  &sun=<hours 0..1 intensity>  &fov=
import * as THREE from 'three';
import { SimplexNoise } from 'three/addons/math/SimplexNoise.js';
import { PADS, padDistance, riverInfo, RIVER, mulberry32 } from '../src/world/layout.js';
import { createStructures } from '../src/world/structures/index.js';
import { runChecks } from './structures-check.js';

const q = new URLSearchParams(location.search);
const num = (k, d) => (q.has(k) ? parseFloat(q.get(k)) : d);
const log = document.getElementById('log');

const renderer = new THREE.WebGLRenderer({ antialias: false });
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9ec4de);
scene.fog = new THREE.Fog(0xb4cde0, 80, 420);
const camera = new THREE.PerspectiveCamera(num('fov', 70), innerWidth / innerHeight, 0.1, 700);

// ---------------------------------------------------------------- stand-in terrain
const simplex = new SimplexNoise({ random: mulberry32(5) });
const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
function natural(x, z) {
  let h = 12 + simplex.noise(x * 0.01, z * 0.01) * 9 + simplex.noise(x * 0.04, z * 0.04) * 2.0;
  h += 28 * Math.exp(-(((x + 108) ** 2 + (z + 188) ** 2) / (2 * 38 ** 2))); // hill around the cave
  h += 10 * Math.exp(-(((x + 190) ** 2 + (z - 55) ** 2) / (2 * 45 ** 2)));
  h += 14 * Math.exp(-(((x) ** 2 + (z + 190) ** 2) / (2 * 60 ** 2)));
  return h;
}
function height(x, z) {
  let h = natural(x, z);
  for (const p of PADS) {
    const d = padDistance(p, x, z);
    if (d < p.blend) h = THREE.MathUtils.lerp(p.y, h, smooth(0, p.blend, d));
  }
  const ri = riverInfo(x, z);
  const half = RIVER.width / 2;
  if (ri.dist < half + 6) {
    const bank = ri.waterY + 0.6, bed = ri.waterY - 1.6;
    const t = smooth(half - 1, half + 6, ri.dist);
    h = THREE.MathUtils.lerp(Math.min(h, bank) * 0 + THREE.MathUtils.lerp(bed, bank, smooth(0, half - 1, ri.dist)), Math.max(h, bank), t * 0 + t);
  }
  return h;
}
const terrain = {
  getHeightAt: height,
  getNormalAt(x, z) { const e = 0.6; return new THREE.Vector3(height(x - e, z) - height(x + e, z), 2 * e, height(x, z - e) - height(x, z + e)).normalize(); },
  getSurfaceAt() { return 'grass'; },
  getWaterSurfaceAt(x, z) { const ri = riverInfo(x, z); return ri.dist < RIVER.width / 2 ? ri.waterY : null; },
  material: null,
};
{
  const N = 320, S = 640, g = new THREE.PlaneGeometry(S, S, N, N); g.rotateX(-Math.PI / 2);
  const p = g.attributes.position, col = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i), h = height(x, z); p.setY(i, h);
    const n = terrain.getNormalAt(x, z).y, rock = smooth(0.85, 0.7, n);
    const v = 0.9 + simplex.noise(x * 0.2, z * 0.2) * 0.1;
    const c = new THREE.Color().setRGB(0.22 * v, 0.34 * v, 0.14 * v).lerp(new THREE.Color(0.4, 0.36, 0.3), rock);
    if (riverInfo(x, z).dist < 7) c.lerp(new THREE.Color(0.42, 0.36, 0.26), 0.6);
    col.set([c.r, c.g, c.b], i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.computeVertexNormals();
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }));
  m.receiveShadow = true; scene.add(m);
  // river water ribbon
  const pts = RIVER.points, verts = [], idx = [];
  pts.forEach((pt, i) => {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    const dx = b.x - a.x, dz = b.z - a.z, l = Math.hypot(dx, dz), nx = -dz / l, nz = dx / l, hw = RIVER.width / 2;
    verts.push(pt.x + nx * hw, pt.waterY, pt.z + nz * hw, pt.x - nx * hw, pt.waterY, pt.z - nz * hw);
    if (i) idx.push(i * 2 - 2, i * 2 - 1, i * 2, i * 2 - 1, i * 2 + 1, i * 2);
  });
  const wg = new THREE.BufferGeometry(); wg.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3)); wg.setIndex(idx); wg.computeVertexNormals();
  scene.add(new THREE.Mesh(wg, new THREE.MeshStandardMaterial({ color: 0x3a6f8a, roughness: 0.15, transparent: true, opacity: 0.8, side: THREE.DoubleSide })));
}

// ---------------------------------------------------------------- lights
const hemi = new THREE.HemisphereLight(0xcfe3f5, 0x4a4a38, 1.1);
const ambBase = 1.1;
const sun = new THREE.DirectionalLight(0xfff0d8, num('sun', 3.0));
sun.position.set(-120, 160, 90); sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.05;
const sc = sun.shadow.camera; sc.left = -70; sc.right = 70; sc.top = 70; sc.bottom = -70; sc.near = 10; sc.far = 500;
scene.add(hemi, sun, sun.target);
const torch = new THREE.PointLight(0xffd9a0, q.get('torch') ? 30 : 0, 22, 2);
camera.add(torch); scene.add(camera);

// ---------------------------------------------------------------- build
const t0 = performance.now();
const structures = await createStructures({ scene, renderer, quality: q.get('low') ? 'low' : 'high', terrain, onProgress: (p, l) => { log.textContent = `${(p * 100) | 0}% ${l}`; } });
const buildMs = performance.now() - t0;
if (q.get('powered')) structures.setPowered('bunker', true);

function interiorAt(p) {
  for (const z of structures.interiorZones) {
    if (p.y < z.yMin || p.y > z.yMax) continue;
    const c = Math.cos(z.rot), s = Math.sin(z.rot), dx = p.x - z.x, dz = p.z - z.z;
    if (Math.abs(dx * c - dz * s) <= z.hx && Math.abs(dx * s + dz * c) <= z.hz) return z;
  }
  return null;
}
function place() {
  const c = window.__cam || [num('x', 20), num('y', 22), num('z', 240), num('lx', 20), num('ly', 16), num('lz', 200)];
  const [x, y, z] = c;
  camera.position.set(x, y, z);
  camera.lookAt(c[3], c[4], c[5]);
  const zone = interiorAt(camera.position);
  hemi.intensity = ambBase * (zone ? 1 - zone.darkness : 1) + (zone ? 0.04 : 0);
  sun.intensity = zone ? num('sun', 3.0) * 0.25 : num('sun', 3.0);
  sun.target.position.set(x, 0, z); sun.position.set(x - 120, 160, z + 90);
  sun.target.updateMatrixWorld();
  camera.updateMatrixWorld();
}
function render() { place(); renderer.render(scene, camera); }
window.__check = () => runChecks(structures, renderer);
window.__dev = { THREE, scene, camera, renderer, structures, terrain, render, place, interiorAt, buildMs };
render();
window.__ready = true;
log.textContent = '';
console.log(`structures built in ${buildMs.toFixed(0)} ms, colliders ${structures.colliders.length}, draw calls ${renderer.info.render.calls}, tris ${renderer.info.render.triangles}`);
