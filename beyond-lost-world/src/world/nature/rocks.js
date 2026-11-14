// Procedural rock geometry: noise-displaced icosahedra with moss on upward faces (vertex colours).
import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { mulberry32 } from '../layout.js';
import { noise2, sstep } from './noise.js';

function n3(x, y, z, s) { return noise2(x + y * 0.71 + s, z - y * 0.93 + s * 1.7); }

/**
 * @param {number} seed
 * @param {{ detail?: number, angular?: boolean, moss?: number, tall?: number }} o
 * @returns {THREE.BufferGeometry} unit-ish rock sitting on y ≈ -0.5
 */
export function buildRock(seed, o = {}) {
  const { detail = 3, angular = false, moss = 1, tall = 0.8 } = o;
  const rand = mulberry32(seed);
  let geo = new THREE.IcosahedronGeometry(1, detail);
  geo.deleteAttribute('normal'); geo.deleteAttribute('uv');
  geo = mergeVertices(geo, 1e-4);
  const pos = geo.attributes.position;
  const s0 = rand() * 100;
  const sq = 0.8 + rand() * 0.4;
  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    let d;
    if (angular) {
      const a = 1 - Math.abs(n3(x * 1.4, y * 1.4, z * 1.4, s0));
      d = 0.22 * (a * a) + 0.1 * n3(x * 3.1, y * 3.1, z * 3.1, s0 + 9);
      // planar cuts
      x = Math.round(x * 5) / 5 * 0.35 + x * 0.65; z = Math.round(z * 5) / 5 * 0.35 + z * 0.65;
    } else {
      d = 0.26 * n3(x * 1.2, y * 1.2, z * 1.2, s0) + 0.1 * n3(x * 2.9, y * 2.9, z * 2.9, s0 + 5) + 0.035 * n3(x * 7, y * 7, z * 7, s0 + 11);
    }
    const k = 1 + d;
    x *= k * sq; y *= k * tall; z *= k / sq;
    if (y < -0.45) y = -0.45 + (y + 0.45) * 0.12; // flat-ish bottom
    pos.setXYZ(i, x, y, z);
  }
  geo.computeVertexNormals();
  const nor = geo.attributes.normal;
  const col = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i), ny = nor.getY(i);
    const v = 0.78 + 0.3 * n3(x * 2.3, y * 2.3, z * 2.3, s0 + 21) + 0.12 * n3(x * 6, y * 6, z * 6, s0 + 3);
    const warm = 0.5 + 0.5 * n3(x, y, z, s0 + 33);
    let r = 0.5 * v * (0.96 + 0.08 * warm), g = 0.48 * v, b = 0.44 * v * (1.02 - 0.08 * warm);
    const m = moss * sstep(0.45, 0.78, ny) * (0.45 + 0.55 * (0.5 + 0.5 * n3(x * 3, y * 3, z * 3, s0 + 41))) * sstep(-0.55, -0.1, y);
    r += (0.2 - r) * m * 0.85; g += (0.34 - g) * m * 0.85; b += (0.1 - b) * m * 0.85;
    col[i * 3] = r; col[i * 3 + 1] = g; col[i * 3 + 2] = b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.computeBoundingSphere(); geo.computeBoundingBox();
  return geo;
}

/** Small flattened pebble. */
export function buildPebble(seed) {
  const g = buildRock(seed, { detail: 1, moss: 0, tall: 0.7 });
  return g;
}
