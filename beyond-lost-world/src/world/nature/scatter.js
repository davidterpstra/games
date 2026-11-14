// Deterministic placement of trees, plants, rocks and logs (seeded by WORLD_SEED).
// Rules: nothing on paths (+1.5 m), pads (+3 m), water, within 6 m of the cave mouth; the village
// centre (r < 40) stays clear, its pad edge may carry a few young trees and bushes.
import * as THREE from 'three';
import { PADS, LAKE, RIVER, WATERFALL, WORLD_SEED, WORLD_HALF, mulberry32, padDistance, getPad } from '../layout.js';
import { forestDensity, meadowFactor, woodDistance, inPool, PLUNGE } from './heightfield.js';
import { sstep, clamp, noise2 } from './noise.js';

const VILLAGE = getPad('village');
const TUNNEL = getPad('cave_tunnel'), CHAMBER = getPad('cave_chamber');
const POOL = WATERFALL.pool;
const CAVE = WATERFALL.caveEntrance;
const HALF_W = RIVER.width / 2;
const _n = new THREE.Vector3();

/** True when something of the given kind may stand at (x,z). */
export function spotOK(hf, x, z, o = {}) {
  const { pad = 3, path = 1.6, water = 2.2, slope = 0.84, villageEdge = false, cave = true } = o;
  if (Math.abs(x) > WORLD_HALF - 6 || Math.abs(z) > WORLD_HALF - 6) return false;
  if (hf.pathEdgeDistance(x, z) < path) return false;
  const dv = Math.hypot(x - VILLAGE.x, z - VILLAGE.z);
  for (let i = 0; i < PADS.length; i++) {
    const p = PADS[i];
    const d = padDistance(p, x, z);
    if (d < pad) {
      if (p === VILLAGE && villageEdge && dv > 42 && d > -16) continue;
      return false;
    }
  }
  if (hf.riverEdgeDistance(x, z) < water + 1) return false;
  const h = hf.getHeightAt(x, z);
  if (Math.hypot(x - LAKE.x, z - LAKE.z) < LAKE.radius + 14 && h < LAKE.waterY + 0.6 + water * 0.3) return false;
  if (Math.hypot(x - POOL.x, z - POOL.z) < POOL.r + water + 1 || Math.hypot(x - PLUNGE.x, z - PLUNGE.z) < PLUNGE.r + water) return false;
  if (cave) {
    if (Math.hypot(x - CAVE.x, z - CAVE.z) < 7) return false;
    if (padDistance(TUNNEL, x, z) < 8 || padDistance(CHAMBER, x, z) < 8) return false;
  }
  if (hf.getNormalAt(x, z, _n).y < slope) return false;
  return true;
}

const tint = (rand, base, spread) => [base[0] + (rand() - 0.5) * spread[0], base[1] + (rand() - 0.5) * spread[1], base[2] + (rand() - 0.5) * spread[2]];

/** Trees on a 6 m jittered grid. Returns array of { kind: 0 spruce | 1 oak | 2 birch, x, y, z, rot, scale, variant, color, rank, rc }. */
export function generateTrees(hf) {
  const out = [];
  const rand = mulberry32(WORLD_SEED + 201);
  const cell = 6, n = Math.ceil(2 * WORLD_HALF / cell);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const r = [rand(), rand(), rand(), rand(), rand(), rand(), rand(), rand(), rand()];
    const x = -WORLD_HALF + (i + 0.1 + 0.8 * r[0]) * cell, z = -WORLD_HALF + (j + 0.1 + 0.8 * r[1]) * cell;
    const f = forestDensity(x, z);
    const edge = Math.max(Math.abs(x), Math.abs(z)) - 250;
    const h = hf.getHeightAt(x, z);
    let p = f * 0.8;
    if (edge > 0) p *= (1 - sstep(0, 60, edge)) * (1 - sstep(40, 75, h));
    const dv = Math.hypot(x - VILLAGE.x, z - VILLAGE.z);
    const inVillageEdge = padDistance(VILLAGE, x, z) < 3 && dv > 42;
    if (inVillageEdge) p = 0.07; // sparse young trees at the village rim
    if (r[2] > p) continue;
    if (!spotOK(hf, x, z, { villageEdge: true, path: 1.8 })) continue;
    const wood = 1 - sstep(20, 85, woodDistance(x, z));
    const ps = clamp(0.3 + 0.55 * sstep(16, 34, h) + 0.35 * wood, 0, 0.95);
    const eWater = Math.min(hf.riverEdgeDistance(x, z), Math.hypot(x - LAKE.x, z - LAKE.z) - LAKE.radius);
    const pb = 0.14 + 0.4 * (1 - sstep(8, 45, eWater)) + 0.15 * meadowFactor(x, z);
    let kind, scale, col, rc;
    const u = r[3];
    if (u < ps) { kind = 0; scale = 0.72 + 0.6 * r[4] * r[4] + 0.1 * r[4]; col = tint(rand, [0.97, 1.0, 0.96], [0.2, 0.2, 0.2]); rc = 0.3 * scale + 0.12; }
    else if ((u - ps) / (1 - ps) < pb) { kind = 2; scale = 0.8 + 0.5 * r[4]; col = tint(rand, [1.0, 1.02, 0.95], [0.2, 0.18, 0.22]); rc = 0.17 * scale + 0.12; }
    else { kind = 1; scale = 0.85 + 0.45 * r[4]; col = tint(rand, [1.03, 1.0, 0.9], [0.3, 0.2, 0.2]); rc = 0.48 * scale + 0.1; }
    if (inVillageEdge) scale *= 0.7;
    out.push({ kind, x, z, y: h - 0.12, rot: r[5] * Math.PI * 2, scale, variant: r[6] < 0.5 ? 0 : 1, color: col, rank: r[7], rc });
  }
  return out;
}

/** Make sure at least `count` trees of `kind` (rank < 0.45) stand within `radius` of (cx,cz) but outside pads. */
export function ensureTrees(hf, trees, cx, cz, radius, kind, count) {
  let have = trees.filter((t) => t.kind === kind && t.rank < 0.45 && Math.hypot(t.x - cx, t.z - cz) < radius).length;
  const rand = mulberry32(WORLD_SEED + 250 + kind);
  for (let tries = 0; have < count && tries < 4000; tries++) {
    const a = rand() * Math.PI * 2, d = 6 + rand() * (radius - 6);
    const x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d;
    if (!spotOK(hf, x, z, { path: 2.5 })) continue;
    if (trees.some((t) => Math.hypot(t.x - x, t.z - z) < 3)) continue;
    const scale = kind === 0 ? 0.9 + rand() * 0.4 : 0.9 + rand() * 0.3;
    trees.push({ kind, x, z, y: hf.getHeightAt(x, z) - 0.12, rot: rand() * 6.28, scale, variant: rand() < 0.5 ? 0 : 1, color: [1, 1, 1], rank: rand() * 0.4, rc: (kind === 0 ? 0.3 : 0.48) * scale + 0.1 });
    have++;
  }
}

/** Jittered-grid scatter helper; the callback decides acceptance and builds the item. */
function grid(hf, cell, seed, fn) {
  const rand = mulberry32(WORLD_SEED + seed);
  const n = Math.ceil(2 * WORLD_HALF / cell);
  const out = [];
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const r = [rand(), rand(), rand(), rand(), rand(), rand(), rand()];
    const x = -WORLD_HALF + (i + 0.5 + (r[0] - 0.5) * 0.9) * cell, z = -WORLD_HALF + (j + 0.5 + (r[1] - 0.5) * 0.9) * cell;
    const it = fn(x, z, r);
    if (it) { it.rank = it.rank ?? r[6]; out.push(it); }
  }
  return out;
}

/** Bushes, ferns, flowers, tall grass, mushrooms, stumps and logs. */
export function generatePlants(hf, trees) {
  const y = (x, z) => hf.getHeightAt(x, z);
  const bushes = grid(hf, 8, 301, (x, z, r) => {
    const f = forestDensity(x, z), m = meadowFactor(x, z);
    if (r[2] > 0.18 + 0.28 * f + 0.2 * m) return null;
    if (!spotOK(hf, x, z, { villageEdge: true, pad: 3, path: 1.4, slope: 0.8 })) return null;
    return { x, y: y(x, z) - 0.05, z, rot: r[3] * 6.28, scale: 0.8 + r[4] * 0.9, variant: r[5] < 0.5 ? 0 : 1, color: tint(mulberry32(Math.floor(r[4] * 1e6)), [1, 1, 1], [0.25, 0.2, 0.2]) };
  });
  const ferns = grid(hf, 4.5, 302, (x, z, r) => {
    const f = forestDensity(x, z);
    if (r[2] > 0.62 * sstep(0.38, 0.8, f) + 0.03) return null;
    if (!spotOK(hf, x, z, { villageEdge: true, pad: 2.5, path: 1.0, slope: 0.8, water: 0.8 })) return null;
    return { x, y: y(x, z) - 0.02, z, rot: r[3] * 6.28, scale: 0.8 + r[4] * 0.8, variant: 0, color: [0.9 + r[5] * 0.2, 0.95 + r[5] * 0.15, 0.9] };
  });
  const palette = [[0.95, 0.95, 0.9], [1.0, 0.82, 0.16], [0.62, 0.38, 0.9], [0.95, 0.3, 0.38], [1.0, 0.55, 0.15]];
  const flowers = grid(hf, 2.4, 303, (x, z, r) => {
    const m = meadowFactor(x, z), f = forestDensity(x, z);
    const patch = 0.5 + 0.5 * noise2(x / 14 + 3, z / 14 - 2);
    if (r[2] > (0.62 * m * (0.25 + patch) + 0.025) * (1 - 0.4 * f)) return null;
    if (!spotOK(hf, x, z, { villageEdge: true, pad: 2, path: 0.8, slope: 0.85, water: 0.6 })) return null;
    const pi = patch > 0.62 ? (patch > 0.8 ? 2 : 1) : r[4] < 0.55 ? 0 : r[4] < 0.8 ? 1 : r[4] < 0.92 ? 3 : 4;
    const c = palette[pi];
    return { x, y: y(x, z) - 0.02, z, rot: r[3] * 6.28, scale: 0.8 + r[5] * 0.7, variant: 0, color: [c[0], c[1], c[2]] };
  });
  const tall = grid(hf, 3.2, 304, (x, z, r) => {
    const m = meadowFactor(x, z), f = forestDensity(x, z);
    if (r[2] > 0.1 + 0.4 * m + 0.12 * f) return null;
    if (!spotOK(hf, x, z, { villageEdge: true, pad: 2, path: 1.0, slope: 0.82, water: 0.4 })) return null;
    return { x, y: y(x, z) - 0.03, z, rot: r[3] * 6.28, scale: 0.8 + r[4] * 0.8, variant: 0, color: [0.9 + r[5] * 0.25, 0.95 + r[5] * 0.15, 0.85 + r[5] * 0.1] };
  });
  const capCols = [[0.8, 0.12, 0.08], [0.55, 0.35, 0.2], [0.9, 0.7, 0.3], [0.75, 0.6, 0.5], [0.85, 0.25, 0.1]];
  const mushrooms = grid(hf, 13, 305, (x, z, r) => {
    const f = forestDensity(x, z);
    if (r[2] > 0.3 * sstep(0.5, 0.85, f)) return null;
    if (!spotOK(hf, x, z, { pad: 3, path: 1.5 })) return null;
    const c = capCols[(r[4] * capCols.length) | 0];
    return { x, y: y(x, z) - 0.02, z, rot: r[3] * 6.28, scale: 0.8 + r[5], variant: 0, color: c };
  });
  const stumps = grid(hf, 22, 306, (x, z, r) => {
    const f = forestDensity(x, z);
    if (r[2] > 0.3 * sstep(0.4, 0.8, f)) return null;
    if (!spotOK(hf, x, z, { pad: 4, path: 2.5 })) return null;
    return { x, y: y(x, z), z, rot: r[3] * 6.28, scale: 0.85 + r[4] * 0.5, variant: r[5] < 0.5 ? 0 : 1, color: [1, 1, 1], rc: 0.42 };
  });
  const logs = grid(hf, 26, 307, (x, z, r) => {
    const f = forestDensity(x, z);
    if (r[2] > 0.4 * sstep(0.35, 0.8, f)) return null;
    if (!spotOK(hf, x, z, { pad: 5, path: 3, slope: 0.9 })) return null;
    const variant = r[5] < 0.5 ? 0 : 1, len = variant ? 4.8 : 3.2;
    // reject when overlapping a trunk
    for (const t of trees) if (Math.abs(t.x - x) < 4 && Math.abs(t.z - z) < 4 && Math.hypot(t.x - x, t.z - z) < len * 0.5 + t.rc) return null;
    return { x, y: y(x, z), z, rot: r[3] * 6.28, scale: 0.9 + r[4] * 0.2, variant, color: [1, 1, 1], len, rad: variant ? 0.34 : 0.26 };
  });
  return { bushes, ferns, flowers, tall, mushrooms, stumps, logs };
}

/** Boulders, cliff rocks and pebbles. Item: { x,y,z,rot,sx,sy,sz,variant,rc,top } */
export function generateRocks(hf, waterInfo) {
  const boulders = [], cliffs = [], pebbles = [];
  const y = (x, z) => hf.getHeightAt(x, z);
  const rand = mulberry32(WORLD_SEED + 401);
  const pushBoulder = (x, z, s, variant, o = {}) => {
    const sx = s * (0.9 + rand() * 0.3), sz = s * (0.9 + rand() * 0.3), sy = s * (o.flat ?? (0.7 + rand() * 0.3));
    boulders.push({ x, z, y: y(x, z) - sy * (o.sink ?? 0.28), rot: rand() * 6.28, sx, sy, sz, variant, rc: Math.max(sx, sz) * 0.82, top: sy * 0.9, color: [1, 1, 1] });
  };

  // forest boulders
  grid(hf, 11, 402, (x, z, r) => {
    const f = forestDensity(x, z);
    const ny = hf.getNormalAt(x, z, _n).y;
    const p = 0.07 + 0.1 * f + 0.5 * clamp((0.95 - ny) * 4, 0, 1);
    if (r[2] > p) return null;
    if (!spotOK(hf, x, z, { pad: 3.5, path: 2.0, slope: 0.6, water: 0.8 })) return null;
    pushBoulder(x, z, 0.55 + r[4] * r[4] * 1.5, (r[5] * 3) | 0);
    return null;
  });
  // cliff rocks on mountains and steep slopes
  grid(hf, 8, 403, (x, z, r) => {
    const ny = hf.getNormalAt(x, z, _n).y;
    const edge = Math.max(Math.abs(x), Math.abs(z)) - 238;
    const h = y(x, z);
    const steep = clamp((0.9 - ny) * 5, 0, 1);
    const p = 0.55 * steep * (edge > 0 ? 1 : 0.35) + (edge > 20 ? 0.18 : 0);
    if (r[2] > p) return null;
    if (!spotOK(hf, x, z, { pad: 3, path: 2.0, slope: 0.0, water: 0.8 })) return null;
    const s = 1.4 + r[4] * r[4] * 4.2 + (edge > 40 ? 1.5 : 0);
    const sx = s * (0.9 + r[3] * 0.5), sy = s * (0.8 + r[5] * 0.7), sz = s * (0.9 + r[6] * 0.4);
    cliffs.push({ x, z, y: h - sy * 0.3, rot: r[3] * 6.28, sx, sy, sz, variant: 0, rc: Math.max(sx, sz) * 0.8, top: sy * 0.8, color: [1, 1, 1] });
    return null;
  });
  // river banks
  const P = RIVER.points;
  for (let i = 0; i < P.length - 1; i++) {
    const a = P[i], b = P[i + 1], len = Math.hypot(b.x - a.x, b.z - a.z), n = Math.floor(len / 3.2);
    const tx = (b.x - a.x) / len, tz = (b.z - a.z) / len;
    for (let k = 0; k < n; k++) {
      for (const side of [-1, 1]) {
        if (rand() > 0.36) continue;
        const t = (k + rand()) / n, off = side * (HALF_W + 0.6 + rand() * 2.6);
        const x = a.x + (b.x - a.x) * t - tz * off, z = a.z + (b.z - a.z) * t + tx * off;
        if (!spotOK(hf, x, z, { pad: 1, path: 1.2, water: -0.5, slope: 0.5, cave: false })) continue;
        const h = y(x, z), wy = hf.getWaterSurfaceAt(x, z);
        if (wy !== null) continue;
        if (rand() < 0.5) pushBoulder(x, z, 0.35 + rand() * 0.7, (rand() * 3) | 0, { sink: 0.4 });
        else for (let q = 0; q < 3; q++) pebbles.push({ x: x + (rand() - 0.5) * 1.6, z: z + (rand() - 0.5) * 1.6, y: 0, rot: rand() * 6.28, sx: 0.1 + rand() * 0.16, sy: 0.07 + rand() * 0.08, sz: 0.1 + rand() * 0.16, variant: 0, color: [1, 1, 1] });
      }
    }
  }
  // lake shore
  for (let a = 0; a < 360; a += 2.2) {
    const th = (a + rand() * 2) * Math.PI / 180, rr = LAKE.radius + 0.5 + rand() * 4;
    const x = LAKE.x + Math.cos(th) * rr, z = LAKE.z + Math.sin(th) * rr;
    if (rand() > 0.3) continue;
    const h = y(x, z);
    if (h < LAKE.waterY + 0.05 || h > LAKE.waterY + 1.6) continue;
    if (!spotOK(hf, x, z, { pad: 1, path: 1, water: -3, slope: 0.6, cave: false })) continue;
    if (rand() < 0.35) pushBoulder(x, z, 0.4 + rand() * 0.9, (rand() * 3) | 0, { sink: 0.4 });
    else for (let q = 0; q < 4; q++) pebbles.push({ x: x + (rand() - 0.5) * 2, z: z + (rand() - 0.5) * 2, y: 0, rot: rand() * 6.28, sx: 0.1 + rand() * 0.18, sy: 0.07 + rand() * 0.08, sz: 0.1 + rand() * 0.18, variant: 0, color: [1, 1, 1] });
  }
  // pool rim: a ring of big mossy boulders holds the water back (gap where the river leaves)
  const gapAng = Math.atan2(-140 - (WATERFALL.pool.z + PLUNGE.z) / 2, -132 - (WATERFALL.pool.x + PLUNGE.x) / 2);
  for (const o of waterInfo.poolOutline) {
    const ang = Math.atan2(Math.sin(o.th - gapAng), Math.cos(o.th - gapAng));
    if (Math.abs(ang) < 0.3) continue;
    const gx = o.x + Math.cos(o.th) * 0.5, gz = o.z + Math.sin(o.th) * 0.5;
    if (y(gx, gz) > POOL.waterY + 0.5) continue;   // the cliff / ground already holds the water here
    const s = 1.15 + rand() * 0.55;
    boulders.push({ x: gx, z: gz, y: POOL.waterY - 0.7 - s * 0.1, rot: rand() * 6.28, sx: s * 1.15, sy: s * 0.95, sz: s, variant: (rand() * 3) | 0, rc: s * 0.85, top: s * 0.85, color: [1, 1, 1] });
  }
  // rocks at the foot of the waterfall
  for (let k = 0; k < 9; k++) {
    const a = rand() * 6.28, d = 4 + rand() * 2.4;
    const x = waterInfo.foot.x + Math.cos(a) * d, z = waterInfo.foot.z + Math.sin(a) * d;
    if (!inPool(x, z) && y(x, z) > POOL.waterY - 1.5 && y(x, z) < POOL.waterY + 0.6) pushBoulder(x, z, 0.7 + rand() * 0.9, (rand() * 3) | 0, { sink: 0.35 });
  }
  // scatter pebbles around boulders
  const bl = boulders.length;
  for (let i = 0; i < bl; i++) {
    const b = boulders[i];
    if (rand() > 0.45) continue;
    for (let q = 0; q < 3; q++) {
      const a = rand() * 6.28, d = b.rc + 0.3 + rand() * 0.8;
      pebbles.push({ x: b.x + Math.cos(a) * d, z: b.z + Math.sin(a) * d, y: 0, rot: rand() * 6.28, sx: 0.09 + rand() * 0.14, sy: 0.06 + rand() * 0.07, sz: 0.09 + rand() * 0.14, variant: 0, color: [1, 1, 1] });
    }
  }
  const peb = pebbles.filter((p) => { p.y = y(p.x, p.z) - 0.02; const wy = hf.getWaterSurfaceAt(p.x, p.z); return wy === null || wy < p.y - 0.05; });
  return { boulders, cliffs, pebbles: peb };
}
