// Resource spot positions (wood, stone, fiber, resin). Pickup meshes are drawn by the gameplay module.
import * as THREE from 'three';
import { WORLD_SEED, RIVER, LAKE, mulberry32, getPad } from '../layout.js';
import { spotOK } from './scatter.js';
import { meadowFactor } from './heightfield.js';

const STATION = { x: 20, z: 200 };
const VILLAGE = getPad('village');

/**
 * @param {object} hf height field
 * @param {{ trees: Array, boulders: Array, cliffs: Array }} veg
 * @returns {Array<{ id: string, type: string, position: THREE.Vector3 }>}
 */
export function generateResources(hf, veg) {
  const rand = mulberry32(WORLD_SEED + 600);
  const out = [];
  const counts = { wood: 0, stone: 0, fiber: 0, resin: 0 };
  // spatial hash of obstacles (trunks, boulders)
  const cellS = 8, hash = new Map();
  const put = (x, z, r) => { const k = `${Math.floor(x / cellS)},${Math.floor(z / cellS)}`; (hash.get(k) || hash.set(k, []).get(k)).push([x, z, r]); };
  for (const t of veg.trees) if (t.rank < 0.5) put(t.x, t.z, t.rc);
  for (const b of [...veg.boulders, ...veg.cliffs]) put(b.x, b.z, b.rc);
  const free = (x, z, m) => {
    const ci = Math.floor(x / cellS), cj = Math.floor(z / cellS);
    for (let j = cj - 1; j <= cj + 1; j++) for (let i = ci - 1; i <= ci + 1; i++) {
      const l = hash.get(`${i},${j}`); if (!l) continue;
      for (const o of l) if (Math.hypot(o[0] - x, o[1] - z) < o[2] + m) return false;
    }
    return true;
  };
  const ok = (x, z) => spotOK(hf, x, z, { pad: 1.0, path: 1.2, water: 1.2, slope: 0.82 }) && free(x, z, 0.7) && !out.some((s) => Math.hypot(s.position.x - x, s.position.z - z) < 1.5);
  const add = (type, x, z) => {
    counts[type]++;
    out.push({ id: `${type}_${counts[type]}`, type, position: new THREE.Vector3(x, hf.getHeightAt(x, z), z) });
  };
  const pickNear = (list, filter, type, n, minD, maxD) => {
    const cands = list.filter(filter);
    for (let tries = 0; n > 0 && tries < 600 && cands.length; tries++) {
      const t = cands[(rand() * cands.length) | 0];
      const a = rand() * 6.283, d = (t.rc || t.rc === 0 ? t.rc : 0.4) + minD + rand() * (maxD - minD);
      const x = t.x + Math.cos(a) * d, z = t.z + Math.sin(a) * d;
      if (ok(x, z)) { add(type, x, z); n--; }
    }
  };
  const nearStation = (t) => Math.hypot(t.x - STATION.x, t.z - STATION.z) < 56;
  const goodTree = (t) => t.rank < 0.5;

  // mission one: wood + resin right around the station
  pickNear(veg.trees, (t) => goodTree(t) && t.kind !== 2 && nearStation(t), 'wood', 8, 0.8, 2.6);
  pickNear(veg.trees, (t) => goodTree(t) && t.kind === 0 && nearStation(t), 'resin', 4, 0.5, 0.9);
  // the rest of the world
  pickNear(veg.trees, (t) => goodTree(t) && t.kind !== 2, 'wood', 30, 0.9, 3.0);
  pickNear(veg.trees, (t) => goodTree(t) && t.kind === 0 && !nearStation(t), 'resin', 12, 0.5, 0.9);
  pickNear([...veg.boulders, ...veg.cliffs], (b) => b.sx < 3.2, 'stone', 28, 0.6, 1.6);

  // fiber: ring around the village, meadows and river banks
  for (let k = 0, tries = 0; k < 8 && tries < 400; tries++) {
    const a = (k / 8) * 6.283 + rand() * 0.6, d = VILLAGE.r + 2.0 + rand() * 8;
    const x = VILLAGE.x + Math.cos(a) * d, z = VILLAGE.z + Math.sin(a) * d;
    if (ok(x, z)) { add('fiber', x, z); k++; }
  }
  for (let k = 0, tries = 0; k < 18 && tries < 3000; tries++) {
    let x, z;
    if (k % 2 === 0) { // river bank
      const i = (rand() * (RIVER.points.length - 1)) | 0, a = RIVER.points[i], b = RIVER.points[i + 1], t = rand();
      const off = (rand() < 0.5 ? -1 : 1) * (RIVER.width / 2 + 1.5 + rand() * 3);
      const dx = b.x - a.x, dz = b.z - a.z, l = Math.hypot(dx, dz);
      x = a.x + dx * t - dz / l * off; z = a.z + dz * t + dx / l * off;
    } else { // lake meadow
      const a = rand() * 6.283, d = LAKE.radius + 4 + rand() * 40;
      x = LAKE.x + Math.cos(a) * d; z = LAKE.z + Math.sin(a) * d;
    }
    if (meadowFactor(x, z) < 0.05 && k % 2 === 1) continue;
    if (ok(x, z)) { add('fiber', x, z); k++; }
  }
  return out;
}
