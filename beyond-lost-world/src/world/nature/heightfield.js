// Analytic terrain shape + the sampled height grid of THE GREENLANDS.
// The grid is the single source of truth: the rendered chunks use exactly these samples and
// getHeightAt() interpolates per triangle in the same way the mesh is triangulated
// (quad (i,j): triangles (p00,p01,p11) and (p00,p11,p10), diagonal p00-p11).
import * as THREE from 'three';
import { PADS, LAKE, RIVER, PATHS, WATERFALL, WORLD_SIZE, WORLD_HALF, PLAY_BOUNDS, padDistance, getPad } from '../layout.js';
import { noise2, fbm2, clamp, lerp, sstep } from './noise.js';

// ---- hand placed guide points for the natural (pre-pad) terrain: x, z, y -----------------------------
const ANCHORS = [
  [20, 200, 14], [165, -10, 9], [0, -188, 24], [-185, 55, 12], [-140, -150, 15], [0, 60, 11],
  [150, 150, 6], [110, 190, 7], [190, 110, 6], [60, 120, 9],
  [-150, -176, 42], [-230, -100, 30], [-240, 200, 16], [-120, 130, 13], [250, 100, 9], [250, -150, 14],
  [60, -120, 17], [-90, -50, 15], [100, -140, 14], [-60, 190, 15], [230, 230, 8], [-230, -230, 34], [0, -260, 30], [250, -260, 24],
];

// ---- flat arrays of the layout polylines (allocation free nearest searches) --------------------------
const RP = RIVER.points;
const R_X = RP.map((p) => p.x), R_Z = RP.map((p) => p.z), R_Y = RP.map((p) => p.waterY);
let rd = 0, rwy = 0, rcx = 0, rcz = 0, rdx = 0, rdz = 0;
/** Nearest point on the river centre line → module vars (rd dist, rwy waterY, rcx/rcz point, rdx/rdz direction). */
function riverNear(x, z) {
  rd = 1e9;
  for (let i = 0; i < R_X.length - 1; i++) {
    const ax = R_X[i], az = R_Z[i], bx = R_X[i + 1], bz = R_Z[i + 1];
    const dx = bx - ax, dz = bz - az;
    let t = ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz);
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const cx = ax + dx * t, cz = az + dz * t;
    const d = Math.hypot(x - cx, z - cz);
    if (d < rd) { rd = d; rcx = cx; rcz = cz; rwy = R_Y[i] + (R_Y[i + 1] - R_Y[i]) * t; rdx = dx; rdz = dz; }
  }
}
const PATH_SEGS = [];
for (const path of PATHS) for (let i = 0; i < path.points.length - 1; i++) {
  const a = path.points[i], b = path.points[i + 1];
  PATH_SEGS.push({ ax: a.x, az: a.z, dx: b.x - a.x, dz: b.z - a.z, l2: (b.x - a.x) ** 2 + (b.z - a.z) ** 2, w: path.width });
}
let pd = 0, pw = 0, pcx = 0, pcz = 0;
/** Nearest point on any path → module vars (pd dist, pw width, pcx/pcz point). */
function pathNear(x, z) {
  pd = 1e9;
  for (const s of PATH_SEGS) {
    let t = ((x - s.ax) * s.dx + (z - s.az) * s.dz) / s.l2;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const cx = s.ax + s.dx * t, cz = s.az + s.dz * t;
    const d = Math.hypot(x - cx, z - cz);
    if (d < pd) { pd = d; pw = s.w; pcx = cx; pcz = cz; }
  }
}

const TUNNEL = getPad('cave_tunnel'), CHAMBER = getPad('cave_chamber');
const POOL = WATERFALL.pool;
// The waterfall lands at the cliff foot: a second round "plunge basin" joined to the pool disc.
const FALL_DIR = (() => { const dx = POOL.x - WATERFALL.top.x, dz = POOL.z - WATERFALL.top.z, l = Math.hypot(dx, dz); return { x: dx / l, z: dz / l, len: l }; })();
export const PLUNGE = Object.freeze({ x: WATERFALL.top.x + FALL_DIR.x * 10.8, z: WATERFALL.top.z + FALL_DIR.z * 10.8, r: 8.2 });
export const FALL = Object.freeze({ dirX: FALL_DIR.x, dirZ: FALL_DIR.z, len: FALL_DIR.len });
/** True inside the pool water outline (pool disc ∪ plunge basin). */
export function inPool(x, z) {
  return Math.hypot(x - POOL.x, z - POOL.z) < POOL.r || Math.hypot(x - PLUNGE.x, z - PLUNGE.z) < PLUNGE.r;
}
const HALF_W = RIVER.width / 2;

// ---- natural terrain ---------------------------------------------------------------------------------
function natural(x, z) {
  let sw = 0, sh = 0;
  for (let i = 0; i < ANCHORS.length; i++) {
    const a = ANCHORS[i];
    const dx = x - a[0], dz = z - a[1];
    const w = 1 / (dx * dx + dz * dz + 2800);
    sw += w; sh += w * a[2];
  }
  let h = sh / sw;
  h += 7.0 * fbm2(x / 120 + 3.1, z / 120 - 1.7, 3) + 2.4 * fbm2(x / 41 + 9.2, z / 41 + 4.4, 3) + 0.4 * noise2(x / 9, z / 9);

  // north-west highland / cliff the waterfall drops from
  const cw = sstep(-152, -178, z) * (1 - sstep(38, 100, Math.abs(x + 135)));
  if (cw > 0) h = lerp(h, 49 + 2.2 * fbm2(x / 30, z / 30, 3), cw);

  // calm ledge where the stream leaves the plateau
  const dtop = Math.hypot(x - WATERFALL.top.x, z - WATERFALL.top.z);
  if (dtop < 18) h = lerp(h, 48.75, 1 - sstep(5, 18, dtop));

  // hill that wraps the cave (rock shell is added by the structures agent)
  const dt = padDistance(TUNNEL, x, z), dc = Math.min(dt, padDistance(CHAMBER, x, z));
  if (dc < 30) {
    let wc = 1 - sstep(16, 28, dc);
    // keep the mouth (entrance end of the tunnel pad) open towards the pool
    const c = Math.cos(TUNNEL.rot), s = Math.sin(TUNNEL.rot);
    const dx = x - TUNNEL.x, dz = z - TUNNEL.z;
    const lx = dx * c - dz * s, lz = dx * s + dz * c;
    if (lz > TUNNEL.hz) wc *= 1 - sstep(TUNNEL.hz, TUNNEL.hz + 12, lz) * (1 - sstep(9, 17, Math.abs(lx)));
    const target = 38 + 2.0 * fbm2(x / 17, z / 17, 3);
    if (target > h) h = lerp(h, target, wc);
  }

  // hillside west of the bunker
  h += 30 * Math.exp(-(((x + 250) / 32) ** 2)) * Math.exp(-(((z - 55) / 80) ** 2));

  // mountains enclosing the island (highest in the north)
  const e = Math.max(Math.abs(x), Math.abs(z)) - 246;
  if (e > 0) {
    const t = sstep(0, 85, e);
    const north = 1 + 0.9 * sstep(120, -300, z);
    const ridge = 1 - Math.abs(fbm2(x / 75 + 40, z / 75 - 20, 3));
    h += Math.pow(t, 1.15) * 78 * north * (0.55 + 0.7 * ridge) + e * 0.18 + t * 6 * noise2(x / 14, z / 14);
  }
  return h;
}

function lakeShape(h, x, z) {
  const d = Math.hypot(x - LAKE.x, z - LAKE.z);
  const R = LAKE.radius;
  if (d > R + 30) return h;
  const top = LAKE.waterY + 0.75;
  if (d <= R) {
    const t = d / R;
    return LAKE.bottomY + (top - LAKE.bottomY) * Math.pow(t, 2.3) + 0.25 * noise2(x / 9, z / 9) * (1 - t * t);
  }
  const shore = top + 0.07 * (d - R) + 0.35 * noise2(x / 14, z / 14);
  return lerp(h, shore, 1 - sstep(0, 30, d - R));
}

function riverShape(h, x, z) {
  riverNear(x, z);
  if (rd > HALF_W + 36) return h;
  const sm = sstep(HALF_W * 0.3, HALF_W + 4, rd);
  const T = rwy - 1.6 + 2.6 * sm + 0.11 * Math.max(0, rd - (HALF_W + 4)) + 0.12 * noise2(x / 6, z / 6) * sm;
  const w = 1 - sstep(HALF_W + 6, HALF_W + 34, rd);
  return lerp(h, T, w);
}

function padShape(h, x, z) {
  for (let i = 0; i < PADS.length; i++) {
    if (padDistance(PADS[i], x, z) <= 0) return PADS[i].y;
  }
  for (let i = 0; i < PADS.length; i++) {
    const p = PADS[i];
    const d = padDistance(p, x, z);
    if (d < p.blend) h = lerp(h, p.y, 1 - sstep(0, p.blend, d));
  }
  return h;
}

function baseHeight(x, z) {
  return padShape(riverShape(lakeShape(natural(x, z), x, z), x, z), x, z);
}

/** Minimum signed distance to the pads' flat areas. */
function minPadDistance(x, z) {
  let m = 1e9;
  for (let i = 0; i < PADS.length; i++) { const d = padDistance(PADS[i], x, z); if (d < m) m = d; }
  return m;
}

function fullHeight(x, z) {
  const b = baseHeight(x, z);
  pathNear(x, z);
  const hw = pw * 0.5;
  if (pd > hw + 5) return b;
  const cx = pcx, cz = pcz, dist = pd;
  const pad = minPadDistance(x, z);
  if (pad <= 0) return b;
  riverNear(x, z);
  const riverFree = sstep(HALF_W + 6, HALF_W + 14, rd);
  const w = (1 - sstep(hw + 0.5, hw + 4.5, dist)) * sstep(0, 4, pad) * riverFree;
  if (w <= 0) return b;
  return lerp(b, baseHeight(cx, cz), w);
}

// ---- forest / meadow distribution (also used for ground painting) ------------------------------------
const WOOD_LINE = [[20, 200], [10, 130], [0, 60], [-5, -60], [0, -188]];
function woodDistance(x, z) {
  let best = 1e9;
  for (let i = 0; i < WOOD_LINE.length - 1; i++) {
    const a = WOOD_LINE[i], b = WOOD_LINE[i + 1];
    const dx = b[0] - a[0], dz = b[1] - a[1];
    let t = ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz);
    t = clamp(t, 0, 1);
    best = Math.min(best, Math.hypot(x - a[0] - dx * t, z - a[1] - dz * t));
  }
  return best;
}
const VILLAGE = getPad('village');
/** 0..1 how densely wooded the land is at (x,z). */
export function forestDensity(x, z) {
  let f = 0.52 + 0.4 * fbm2(x / 75 + 5, z / 75 + 11, 3);
  f += 0.45 * (1 - sstep(22, 85, woodDistance(x, z)));
  const dv = Math.hypot(x - VILLAGE.x, z - VILLAGE.z);
  f *= lerp(0.08, 1, sstep(70, 135, dv));
  const dl = Math.hypot(x - LAKE.x, z - LAKE.z);
  f *= lerp(0.15, 1, sstep(LAKE.radius + 8, LAKE.radius + 85, dl));
  // clearing around the crossroads and the station yard stays forested but open
  return clamp(f, 0, 1);
}
/** 0..1 how much of an open flowery meadow (village + lake surroundings, clearings). */
export function meadowFactor(x, z) {
  const f = forestDensity(x, z);
  return clamp((0.5 - f) / 0.35, 0, 1);
}

// -------------------------------------------------------------------------------------------------------
/**
 * Creates the terrain height field. Call `await hf.fill(onProgress)` before using the accessors.
 * @param {number} segments cells per side
 */
export function createHeightField(segments) {
  const N = segments, cell = WORLD_SIZE / N, W = N + 1;
  const data = new Float32Array(W * W);
  const maxF = N - 1e-4;

  async function fill(onProgress) {
    const t0 = performance.now();
    for (let j = 0; j < W; j++) {
      const z = -WORLD_HALF + j * cell;
      for (let i = 0; i < W; i++) data[j * W + i] = fullHeight(-WORLD_HALF + i * cell, z);
      if (performance.now() - t0 > 0 && j % 24 === 23) { onProgress?.(j / W); await new Promise((r) => setTimeout(r, 0)); }
    }
  }

  function getHeightAt(x, z) {
    let fx = (x + WORLD_HALF) / cell, fz = (z + WORLD_HALF) / cell;
    fx = fx < 0 ? 0 : fx > maxF ? maxF : fx; fz = fz < 0 ? 0 : fz > maxF ? maxF : fz;
    const i = fx | 0, j = fz | 0, u = fx - i, v = fz - j;
    const k = j * W + i;
    const h00 = data[k], h10 = data[k + 1], h01 = data[k + W], h11 = data[k + W + 1];
    return v >= u ? h00 + u * (h11 - h01) + v * (h01 - h00) : h00 + u * (h10 - h00) + v * (h11 - h10);
  }

  function getNormalAt(x, z, target = new THREE.Vector3()) {
    let fx = (x + WORLD_HALF) / cell, fz = (z + WORLD_HALF) / cell;
    fx = fx < 0 ? 0 : fx > maxF ? maxF : fx; fz = fz < 0 ? 0 : fz > maxF ? maxF : fz;
    const i = fx | 0, j = fz | 0, u = fx - i, v = fz - j;
    const k = j * W + i;
    const h00 = data[k], h10 = data[k + 1], h01 = data[k + W], h11 = data[k + W + 1];
    let dhdx, dhdz;
    if (v >= u) { dhdx = (h11 - h01) / cell; dhdz = (h01 - h00) / cell; } else { dhdx = (h10 - h00) / cell; dhdz = (h11 - h10) / cell; }
    return target.set(-dhdx, 1, -dhdz).normalize();
  }

  /** Smooth normal of grid vertex (i,j) (central differences) – used for the mesh normals. */
  function vertexNormal(i, j, target) {
    const i0 = Math.max(i - 1, 0), i1 = Math.min(i + 1, N), j0 = Math.max(j - 1, 0), j1 = Math.min(j + 1, N);
    const dx = (data[j * W + i1] - data[j * W + i0]) / ((i1 - i0) * cell);
    const dz = (data[j1 * W + i] - data[j0 * W + i]) / ((j1 - j0) * cell);
    return target.set(-dx, 1, -dz).normalize();
  }

  // ---- water ---------------------------------------------------------------------------------------
  /** Water surface of the river at its centre point (c) – lowered where the bed is the flat pool pad. */
  function riverSurface(cx, cz, nominal) { return Math.min(nominal, getHeightAt(cx, cz) + 0.45); }

  function getWaterSurfaceAt(x, z) {
    const h = getHeightAt(x, z);
    if (Math.hypot(x - LAKE.x, z - LAKE.z) < LAKE.radius && h < LAKE.waterY) return LAKE.waterY;
    if (inPool(x, z) && h < POOL.waterY) return POOL.waterY;
    riverNear(x, z);
    if (rd < HALF_W + 1.5) {
      const wy = riverSurface(rcx, rcz, rwy);
      if (h < wy - 0.02) return wy;
    }
    return null;
  }

  // ---- ground classification (shared by the splat map and getSurfaceAt) --------------------------------
  const ctl = { dirt: 0, sand: 0, rut: 0, litter: 0, grass: 1, ny: 1 };
  function control(x, z, h, litterValue = null, out = ctl) {
    pathNear(x, z);
    const hw = pw * 0.5;
    let dirt = 0, rut = 0;
    if (pd < hw + 2.5) {
      const en = noise2(x * 0.9, z * 0.9) * 0.7 + noise2(x * 3.1, z * 3.1) * 0.25;
      dirt = 1 - sstep(hw - 0.5 + en * 0.8, hw + 0.9 + en * 0.8, pd);
      if (pw >= 3.4 && dirt > 0.3) {
        const rr = (pd - hw * 0.46) / 0.2;
        rut = Math.exp(-rr * rr) * (0.55 + 0.45 * noise2(x * 0.7 + 3, z * 0.7)) * sstep(0.3, 0.8, dirt);
      }
    }
    let sand = 0;
    const dl = Math.hypot(x - LAKE.x, z - LAKE.z);
    if (dl < LAKE.radius + 16) sand = 1 - sstep(0.45, 1.9, h - LAKE.waterY + 0.4 * noise2(x / 5, z / 5));
    riverNear(x, z);
    if (rd < HALF_W + 9) sand = Math.max(sand, (1 - sstep(0.3, 1.5, h - rwy + 0.25 * noise2(x / 4, z / 4))) * (1 - sstep(HALF_W + 4, HALF_W + 9, rd)));
    const litter = (litterValue ?? 0) * (1 - dirt) * (1 - sand);
    // normal.y from the grid
    let fx = (x + WORLD_HALF) / cell, fz = (z + WORLD_HALF) / cell;
    fx = clamp(fx, 1, N - 1); fz = clamp(fz, 1, N - 1);
    const ci = Math.round(fx), cj = Math.round(fz);
    const gx = (data[cj * W + ci + 1] - data[cj * W + ci - 1]) / (2 * cell), gz = (data[(cj + 1) * W + ci] - data[(cj - 1) * W + ci]) / (2 * cell);
    const ny = 1 / Math.sqrt(1 + gx * gx + gz * gz);
    // grass mask: nothing under buildings, paths, water or on steep rock
    let grass = (1 - dirt) * (1 - sand) * sstep(0.76, 0.9, ny);
    const mp = minPadDistance(x, z);
    if (mp < 1.5) {
      const dv = Math.hypot(x - VILLAGE.x, z - VILLAGE.z);
      const inVillage = padDistance(VILLAGE, x, z) < 1.5 && dv > 24;
      grass *= inVillage ? 0.45 * sstep(24, 34, dv) : sstep(-1, 1.5, mp);
    }
    if (Math.hypot(x - POOL.x, z - POOL.z) < POOL.r + 1 || Math.hypot(x - PLUNGE.x, z - PLUNGE.z) < PLUNGE.r + 1) grass = 0;
    out.dirt = dirt; out.sand = sand; out.rut = rut; out.litter = litter; out.grass = grass; out.ny = ny;
    return out;
  }

  const _c = { dirt: 0, sand: 0, rut: 0, litter: 0, grass: 1, ny: 1 };
  function getSurfaceAt(x, z) {
    const h = getHeightAt(x, z);
    const wy = getWaterSurfaceAt(x, z);
    if (wy !== null && wy - h > 0.18) return 'water';
    control(x, z, h, 0, _c);
    if (_c.ny < 0.8 || h > 70) return 'stone';
    if (_c.dirt > 0.5) return 'dirt';
    if (_c.sand > 0.5) return 'sand';
    return 'grass';
  }

  return {
    N, cell, W, data, fill, getHeightAt, getNormalAt, vertexNormal, getSurfaceAt, getWaterSurfaceAt, riverSurface, control,
    forestDensity, meadowFactor,
    /** Distance (m) from the path edge (negative = on the path). */
    pathEdgeDistance(x, z) { pathNear(x, z); return pd - pw * 0.5; },
    /** Distance (m) from the river water edge (negative = in the river channel). */
    riverEdgeDistance(x, z) { riverNear(x, z); return rd - HALF_W; },
    minPadDistance,
    PLAY_BOUNDS,
  };
}
