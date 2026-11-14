// Procedural models of trees, bushes, ferns, flowers, grass clumps, mushrooms, stumps and logs.
// All builders return a BufferGeometry for the shared flora material (atlas map + vertex colours).
// Units are metres; models stand on y = 0 with the trunk axis at x = z = 0.
import * as THREE from 'three';
import { mulberry32 } from '../layout.js';
import { GeoBuilder, tube, card, bentCard, blob } from './geo.js';
import { cellUV } from './textures.js';
import { noise2 } from './noise.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const UP = V(0, 1, 0);
const TAU = Math.PI * 2;
const clamp01 = (x) => Math.max(0, Math.min(1, x));

/** Spruce: tapered trunk plus whorls of drooping frond cards. lod 0 = full, 1 = reduced, 2 = cone silhouette. */
export function buildSpruce(seed, lod, mean) {
  const rand = mulberry32(seed);
  const g = new GeoBuilder();
  const H = 12.5 + rand() * 2.5, r0 = 0.27 + rand() * 0.05, lean = (rand() - 0.5) * 0.5;
  const trunkAt = (y) => V(lean * (y / H) ** 2, y, 0);
  const radiusAt = (y) => r0 * Math.pow(Math.max(1 - y / H, 0), 0.85) + 0.025;
  const tn = lod === 0 ? 8 : lod === 1 ? 6 : 3;
  const pts = [], radii = [];
  const topY = lod === 2 ? H * 0.55 : H * 0.97;
  for (let i = 0; i <= tn; i++) { const y = (i / tn) * topY; pts.push(trunkAt(y)); radii.push(radiusAt(y)); }
  tube(g, pts, radii, lod === 0 ? 8 : lod === 1 ? 6 : 4, { bark: 'bark', v0: 0.02, v1: Math.min(0.98, 0.02 + H / 15.5), wind: (t) => 0.02 + t * t * 0.18 });
  const Lmax = 2.9 + rand() * 0.5;

  if (lod === 2) {
    const col = [mean.spruce.r * 0.95, mean.spruce.g * 0.95, mean.spruce.b * 0.95];
    const uvv = [0, 0]; cellUV('white', 0.5, 0.5, uvv);
    const layers = 4;
    for (let i = 0; i < layers; i++) {
      const t = i / layers;
      const y0 = 1.7 + (H - 2.0) * t * 0.92, hh = (H - 1.5) / layers * 1.7, R = Lmax * Math.pow(1 - t, 0.9) * 0.95 + 0.3;
      const apex = g.vert(trunkAt(y0 + hh).x, y0 + hh, 0, 0, 1, 0, uvv[0], uvv[1], 1.0, 0.5, 1, col[0], col[1], col[2]);
      const ring = [];
      const seg = 9;
      for (let k = 0; k < seg; k++) {
        const a = (k / seg) * TAU + i * 0.5, rr = R * (0.85 + 0.3 * rand());
        ring.push(g.vert(trunkAt(y0).x + Math.cos(a) * rr, y0 - 0.15 * R, Math.sin(a) * rr, Math.cos(a) * 0.8, 0.55, Math.sin(a) * 0.8, uvv[0], uvv[1], 0.6 + 0.2 * t, 0.2, 1, col[0], col[1], col[2]));
      }
      for (let k = 0; k < seg; k++) g.i.push(apex, ring[(k + 1) % seg], ring[k]);
    }
    return g.build();
  }

  const K = lod === 0 ? 24 : 12;
  const addBranch = (y, phi, L, hwScale, rel, shade) => {
    const dir = V(Math.cos(phi), 0, Math.sin(phi));
    const side = V(-Math.sin(phi), 0, Math.cos(phi));
    const roll = (rand() - 0.5) * 0.6;
    const s = side.clone().multiplyScalar(Math.cos(roll)).addScaledVector(UP, Math.sin(roll));
    const droop = (0.44 - 0.32 * rel) * L;
    const base = trunkAt(y).addScaledVector(dir, 0.1);
    const hw = L * 0.5 * hwScale;
    const rows = [0, 0.5, 1].map((t, i) => {
      const c = base.clone().addScaledVector(dir, L * t);
      c.y += i === 1 ? 0.07 * L : i === 2 ? -droop : 0;
      const w = hw * (i === 0 ? 0.45 : i === 1 ? 1 : 0.85);
      return { l: c.clone().addScaledVector(s, -w), r: c.clone().addScaledVector(s, w), wind: [0.02, 0.3, 0.75][i] * (0.4 + 0.6 * rel) };
    });
    const nrm = V(0, 0.62, 0).addScaledVector(dir, 0.7).normalize();
    bentCard(g, rows, 'spruce', nrm, shade * 0.7, 1, [1, 1, 1], shade * 1.05);
  };
  for (let k = 0; k < K; k++) {
    const t = (k + 0.5) / K;
    const y = 1.5 + (H - 2.3) * Math.pow(t, 0.9);
    const rel = (y - 1.5) / (H - 2.3);
    const L = (Lmax * Math.pow(1 - rel, 0.78) + 0.45) * (0.9 + rand() * 0.2);
    const nb = lod === 0 ? Math.max(4, Math.round(7 * (1 - rel) + 3)) : Math.max(3, Math.round(5 * (1 - rel) + 2));
    const phi0 = rand() * TAU;
    const shade = 0.62 + 0.38 * clamp01(y / H * 1.1) + (rand() - 0.5) * 0.12;
    for (let j = 0; j < nb; j++) {
      const phi = phi0 + (j / nb) * TAU + (rand() - 0.5) * 0.5;
      addBranch(y + (rand() - 0.5) * 0.25, phi, L, lod === 0 ? 1.0 : 1.3, rel, shade);
      if (lod === 0) addBranch(y - 0.28 + (rand() - 0.5) * 0.15, phi + 0.38, L * 0.78, 0.9, rel, shade * 0.92);
    }
  }
  // leader
  for (let a = 0; a < 3; a++) {
    const ang = (a / 3) * Math.PI;
    card(g, trunkAt(H - 0.8), V(Math.cos(ang) * 0.55, 0, Math.sin(ang) * 0.55), V(0, 1.1, 0), 'spruce', V(Math.cos(ang + 1.57) * 0.5, 0.8, Math.sin(ang + 1.57) * 0.5).normalize(), 1.0, 0.9, 1);
  }
  return g.build();
}

function randomCard(g, rand, center, size, cell, crownC, crownR, shadeBase, windBase, shadeTip = 1) {
  // random orientation basis
  let nx = rand() * 2 - 1, ny = (rand() * 2 - 1) * 0.8, nz = rand() * 2 - 1;
  const nl = Math.hypot(nx, ny, nz) || 1; nx /= nl; ny /= nl; nz /= nl;
  const nq = V(nx, ny, nz);
  let right = new THREE.Vector3().crossVectors(nq, UP);
  if (right.lengthSq() < 0.01) right.set(1, 0, 0);
  right.normalize();
  const up2 = new THREE.Vector3().crossVectors(nq, right).normalize();
  const rot = rand() * TAU, c = Math.cos(rot), s = Math.sin(rot);
  const r2 = right.clone().multiplyScalar(c).addScaledVector(up2, s).multiplyScalar(size * 0.5);
  const u2 = up2.clone().multiplyScalar(c).addScaledVector(right, -s).multiplyScalar(size * 0.5);
  const out = center.clone().sub(crownC);
  const dist = out.length() / crownR;
  out.normalize().multiplyScalar(0.8).addScaledVector(UP, 0.35).normalize();
  const hs = clamp01((center.y - (crownC.y - crownR)) / (2 * crownR));
  const shade = shadeBase * (0.58 + 0.42 * hs) * (0.72 + 0.28 * clamp01(dist));
  card(g, center, r2, u2, cell, out, shade * shadeTip, windBase * (0.5 + 0.7 * clamp01(dist)), 1);
}

/** Broadleaf (oak/beech): forked trunk, curved limbs, clusters of leaf cards. */
export function buildOak(seed, lod, mean) {
  const rand = mulberry32(seed);
  const g = new GeoBuilder();
  const hf = 2.3 + rand() * 1.1, r0 = 0.4 + rand() * 0.08;
  const sway = (rand() - 0.5) * 0.7, swayZ = (rand() - 0.5) * 0.7;
  const sides = lod === 0 ? 8 : lod === 1 ? 6 : 4;
  const forkP = V(sway, hf, swayZ);
  const tp = [V(0, 0, 0), V(sway * 0.3, hf * 0.35, swayZ * 0.3), V(sway * 0.75, hf * 0.7, swayZ * 0.75), forkP];
  tube(g, tp, [r0 * 1.35, r0, r0 * 0.88, r0 * 0.8], sides, { bark: 'bark', v0: 0.03, v1: 0.3, wind: (t) => t * 0.05, capEnd: false });
  const nl = 3 + (rand() < 0.5 ? 1 : 0);
  const crownC = V(sway * 0.5, hf + 3.3, swayZ * 0.5), crownR = 4.5;
  const clusters = [];
  const limbEnds = [];
  for (let i = 0; i < nl; i++) {
    const az = (i / nl) * TAU + (rand() - 0.5) * 0.9, el0 = 0.65 + rand() * 0.45, Ll = 3.5 + rand() * 1.6;
    const pts = [forkP.clone()];
    let p = forkP.clone();
    const steps = lod === 0 ? 4 : 3;
    for (let s = 1; s <= steps; s++) {
      const el = el0 + s * 0.13;
      const d = V(Math.cos(az + (rand() - 0.5) * 0.25) * Math.cos(el), Math.sin(el), Math.sin(az) * Math.cos(el));
      p = p.clone().addScaledVector(d, Ll / steps);
      pts.push(p);
    }
    const radii = pts.map((_, k) => 0.27 * (1 - 0.8 * k / steps) + 0.04);
    tube(g, pts, radii, lod === 0 ? 6 : 4, { bark: 'bark', v0: 0.3, v1: 0.55, wind: (t) => 0.05 + t * 0.3 });
    limbEnds.push(pts[pts.length - 1]);
    clusters.push({ p: pts[pts.length - 1], w: 1.4 }, { p: pts[Math.max(1, steps - 1)], w: 0.8 });
    if (lod === 0) {
      for (let sb = 0; sb < 2; sb++) {
        const base = pts[2 + sb] || pts[pts.length - 1];
        const a2 = az + (sb ? 0.8 : -0.8), el = 0.5;
        const d = V(Math.cos(a2) * Math.cos(el), Math.sin(el), Math.sin(a2) * Math.cos(el));
        const e = base.clone().addScaledVector(d, 2.1 + rand());
        tube(g, [base, base.clone().lerp(e, 0.55).add(V(0, 0.15, 0)), e], [0.09, 0.06, 0.025], 5, { bark: 'bark', v0: 0.55, v1: 0.65, wind: (t) => 0.2 + t * 0.5 });
        clusters.push({ p: e, w: 1.2 });
      }
    }
  }
  const sizeK = lod === 0 ? 1 : 1.55;
  const perCluster = lod === 0 ? 7 : 3;
  for (const c of clusters) {
    for (let k = 0; k < Math.round(perCluster * c.w); k++) {
      const off = V(rand() - 0.5, (rand() - 0.5) * 0.7, rand() - 0.5).multiplyScalar(2.3);
      randomCard(g, rand, c.p.clone().add(off), (2.1 + rand() * 1.1) * sizeK, 'oak', crownC, crownR, 1.0, 0.8);
    }
  }
  const fill = lod === 0 ? 55 : 20;
  for (let k = 0; k < fill; k++) {
    const a = rand() * TAU, e = Math.acos(1 - rand() * 1.1), r = crownR * (0.55 + 0.45 * Math.cbrt(rand()));
    const pos = crownC.clone().add(V(Math.sin(e) * Math.cos(a) * r, Math.cos(e) * r * 0.72, Math.sin(e) * Math.sin(a) * r));
    randomCard(g, rand, pos, (2.3 + rand() * 1.2) * sizeK, 'oak', crownC, crownR, 1.0, 0.8);
  }
  return g.build();
}

/** Far silhouette of a broadleaf tree: blobs + a thin trunk. */
export function buildOakFar(seed, mean) {
  const rand = mulberry32(seed + 77);
  const g = new GeoBuilder();
  const hf = 2.6;
  tube(g, [V(0, 0, 0), V(0, hf * 0.6, 0), V(0.2, hf, 0)], [0.5, 0.38, 0.3], 4, { bark: 'bark', v0: 0.03, v1: 0.3 });
  const col = [mean.oak.r * 0.92, mean.oak.g * 0.92, mean.oak.b * 0.92];
  const nf = (x, y, z) => 0.18 * noise2(x * 2.1 + seed, y * 2.1 + z * 1.7);
  blob(g, V(0, hf + 3.3, 0), 4.6, 3.3, 4.6, 1, col, nf, 0.5, 1, (y) => 0.55 + 0.45 * (y * 0.5 + 0.5));
  blob(g, V(2.0, hf + 2.3, 1.2), 2.8, 2.2, 2.8, 1, col, nf, 0.5, 1, (y) => 0.5 + 0.45 * (y * 0.5 + 0.5));
  blob(g, V(-1.8, hf + 2.7, -1.5), 2.8, 2.2, 2.8, 1, col, nf, 0.5, 1, (y) => 0.5 + 0.45 * (y * 0.5 + 0.5));
  return g.build();
}

/** Birch: slender white trunk, thin up-swept branches, light small-leaf clusters. */
export function buildBirch(seed, lod, mean) {
  const rand = mulberry32(seed);
  const g = new GeoBuilder();
  const H = 8.8 + rand() * 2.4, r0 = 0.15 + rand() * 0.04;
  const lx = (rand() - 0.5) * 1.2, lz = (rand() - 0.5) * 1.2;
  const at = (y) => V(lx * (y / H) ** 1.6 + Math.sin(y * 0.7 + seed) * 0.1, y, lz * (y / H) ** 1.6 + Math.cos(y * 0.6) * 0.1);
  const n = lod === 0 ? 8 : 5;
  const pts = [], radii = [];
  for (let i = 0; i <= n; i++) { const y = (i / n) * H * 0.98; pts.push(at(y)); radii.push(r0 * Math.pow(1 - y / H, 0.8) + 0.02); }
  tube(g, pts, radii, lod === 0 ? 7 : 5, { bark: 'birch', v0: 0.02, v1: Math.min(0.98, 0.02 + H / 12), wind: (t) => t * t * 0.3 });
  const crownC = at(H * 0.66), crownR = 3.1;
  const nb = lod === 0 ? 9 : 5;
  const clusters = [];
  for (let i = 0; i < nb; i++) {
    const y = H * (0.3 + 0.62 * (i / nb)) + rand() * 0.4;
    const az = rand() * TAU, el = 0.55 + rand() * 0.6, L = (1.2 + rand() * 1.5) * (0.6 + 0.8 * Math.sin(Math.PI * (0.2 + 0.7 * (y / H))));
    const b = at(y), d = V(Math.cos(az) * Math.cos(el), Math.sin(el), Math.sin(az) * Math.cos(el));
    const e = b.clone().addScaledVector(d, L);
    tube(g, [b, b.clone().lerp(e, 0.5).add(V(0, 0.1, 0)), e], [0.045, 0.03, 0.012], 4, { bark: 'birch', v0: 0.5, v1: 0.6, wind: (t) => 0.1 + t * 0.6 });
    clusters.push(e);
  }
  clusters.push(at(H), at(H * 0.9));
  const sizeK = lod === 0 ? 1 : 1.5;
  const per = lod === 0 ? 8 : 3;
  for (const c of clusters) for (let k = 0; k < per; k++) {
    const off = V(rand() - 0.5, (rand() - 0.5) * 0.8, rand() - 0.5).multiplyScalar(1.7);
    randomCard(g, rand, c.clone().add(off), (1.35 + rand() * 0.85) * sizeK, 'birchLeaf', crownC, crownR, 1.05, 1.0);
  }
  return g.build();
}

export function buildBirchFar(seed, mean) {
  const g = new GeoBuilder();
  const H = 9.5;
  tube(g, [V(0, 0, 0), V(0.1, H * 0.5, 0), V(0.3, H * 0.85, 0)], [0.16, 0.1, 0.04], 4, { bark: 'birch', v0: 0.02, v1: 0.7 });
  const col = [mean.birchLeaf.r * 0.98, mean.birchLeaf.g * 0.98, mean.birchLeaf.b * 0.98];
  const nf = (x, y, z) => 0.16 * noise2(x * 2.3 + seed, y * 2 + z * 1.9);
  blob(g, V(0.1, H * 0.68, 0), 2.8, 3.6, 2.8, 1, col, nf, 0.6, 1, (y) => 0.55 + 0.45 * (y * 0.5 + 0.5));
  return g.build();
}

/** Bush: a mound of crossed leaf cards. */
export function buildBush(seed) {
  const rand = mulberry32(seed);
  const g = new GeoBuilder();
  const c = V(0, 0.55, 0), R = 0.9;
  for (let k = 0; k < 15; k++) {
    const a = rand() * TAU, r = Math.sqrt(rand()) * 0.55;
    const pos = V(Math.cos(a) * r, 0.2 + rand() * 0.75, Math.sin(a) * r);
    randomCard(g, rand, pos, 0.75 + rand() * 0.5, 'bush', c, R, 1.0, 0.9);
  }
  return g.build();
}

/** Fern: a rosette of arching fronds. */
export function buildFern(seed) {
  const rand = mulberry32(seed);
  const g = new GeoBuilder();
  const nF = 9;
  for (let i = 0; i < nF; i++) {
    const phi = (i / nF) * TAU + (rand() - 0.5) * 0.4;
    const L = 0.75 + rand() * 0.4, hw = L * 0.46;
    const dir = V(Math.cos(phi), 0, Math.sin(phi)), side = V(-Math.sin(phi), 0, Math.cos(phi));
    const roll = (rand() - 0.5) * 0.7;
    const s = side.clone().multiplyScalar(Math.cos(roll)).addScaledVector(UP, Math.sin(roll));
    const lift = 0.35 + rand() * 0.3;
    const rows = [[0.05, 0.03, 0.4, 0.02], [0.5, 0.33 * lift * L * 2, 1, 0.3], [1, 0.12 * L * lift, 0.8, 0.7]].map(([t, y, w, wind]) => {
      const c = dir.clone().multiplyScalar(L * t).add(V(0, y + 0.02, 0));
      return { l: c.clone().addScaledVector(s, -hw * w), r: c.clone().addScaledVector(s, hw * w), wind };
    });
    bentCard(g, rows, 'fern', V(0, 1, 0).addScaledVector(dir, 0.35).normalize(), 0.78, 1, [1, 1, 1], 1.05);
  }
  return g.build();
}

/** Clump of wild flowers (head colour comes from the instance colour). */
export function buildFlowers(seed) {
  const rand = mulberry32(seed);
  const g = new GeoBuilder();
  const uvv = [0, 0]; cellUV('white', 0.5, 0.5, uvv);
  const n = 6;
  for (let i = 0; i < n; i++) {
    const a = rand() * TAU, r = Math.sqrt(rand()) * 0.28;
    const x = Math.cos(a) * r, z = Math.sin(a) * r, h = 0.3 + rand() * 0.3, lean = (rand() - 0.5) * 0.12;
    const stemCol = [0.16, 0.34, 0.09];
    for (let k = 0; k < 2; k++) { // crossed stem quads
      const ang = k * Math.PI / 2, ox = Math.cos(ang) * 0.006, oz = Math.sin(ang) * 0.006;
      const v0 = g.vert(x - ox, 0, z - oz, 0, 1, 0, uvv[0], uvv[1], 0.7, 0, 0, ...stemCol);
      const v1 = g.vert(x + ox, 0, z + oz, 0, 1, 0, uvv[0], uvv[1], 0.7, 0, 0, ...stemCol);
      const v2 = g.vert(x + lean + ox, h, z + oz, 0, 1, 0, uvv[0], uvv[1], 1, 0.9, 0, ...stemCol);
      const v3 = g.vert(x + lean - ox, h, z - oz, 0, 1, 0, uvv[0], uvv[1], 1, 0.9, 0, ...stemCol);
      g.quad(v0, v1, v2, v3);
    }
    // petals: hexagon fan, slightly cupped
    const hr = 0.045 + rand() * 0.03, cx = x + lean, cz = z;
    const hub = g.vert(cx, h + 0.012, cz, 0, 1, 0, uvv[0], uvv[1], 1.1, 0.95, 0, 1, 0.78, 0.12);
    const hubP = g.vert(cx, h + 0.006, cz, 0, 1, 0, uvv[0], uvv[1], 1.15, 0.95, 1);
    const ring = [];
    for (let k = 0; k < 7; k++) {
      const aa = (k / 7) * TAU;
      ring.push(g.vert(cx + Math.cos(aa) * hr, h - 0.008, cz + Math.sin(aa) * hr, 0, 1, 0, uvv[0], uvv[1], 1.15, 0.95, 1));
    }
    for (let k = 0; k < 7; k++) g.i.push(hubP, ring[(k + 1) % 7], ring[k]);
    // small yellow centre
    const ring2 = [];
    for (let k = 0; k < 5; k++) { const aa = (k / 5) * TAU; ring2.push(g.vert(cx + Math.cos(aa) * hr * 0.32, h + 0.016, cz + Math.sin(aa) * hr * 0.32, 0, 1, 0, uvv[0], uvv[1], 1.1, 0.95, 0, 1, 0.78, 0.12)); }
    for (let k = 0; k < 5; k++) g.i.push(hub, ring2[(k + 1) % 5], ring2[k]);
  }
  return g.build();
}

/** Tall grass tuft (4 crossed cards). */
export function buildTallGrass(seed) {
  const rand = mulberry32(seed);
  const g = new GeoBuilder();
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * Math.PI + rand() * 0.4, w = 0.5 + rand() * 0.25, h = 0.75 + rand() * 0.55;
    const ox = (rand() - 0.5) * 0.25, oz = (rand() - 0.5) * 0.25;
    card(g, V(ox, h * 0.5 - 0.03, oz), V(Math.cos(a) * w * 0.5, 0, Math.sin(a) * w * 0.5), V(0, h * 0.5, 0), 'grass', V(0, 1, 0).addScaledVector(V(Math.cos(a + 1.57), 0, Math.sin(a + 1.57)), 0.3).normalize(), 0.95, 1.0, 1);
  }
  return g.build();
}

function lathe(g, profile, sides, color, tint, cell = 'white', wind = 0) {
  const uvv = [0, 0]; cellUV(cell, 0.5, 0.5, uvv);
  const rows = [];
  for (let i = 0; i < profile.length; i++) {
    const a = profile[Math.max(i - 1, 0)], b = profile[Math.min(i + 1, profile.length - 1)];
    let nr = b[1] - a[1], ny = -(b[0] - a[0]);
    const l = Math.hypot(nr, ny) || 1; nr /= l; ny /= l;
    const ids = [];
    for (let k = 0; k <= sides; k++) {
      const ang = (k / sides) * TAU, c = Math.cos(ang), s = Math.sin(ang);
      ids.push(g.vert(profile[i][0] * c, profile[i][1], profile[i][0] * s, nr * c, ny, nr * s, uvv[0], uvv[1], 0.75 + 0.25 * (profile[i][1] > 0 ? 1 : 0.6), wind, tint, color[0], color[1], color[2]));
    }
    rows.push(ids);
  }
  for (let i = 0; i < rows.length - 1; i++) for (let k = 0; k < sides; k++) g.quad(rows[i][k], rows[i + 1][k], rows[i + 1][k + 1], rows[i][k + 1]);
}

/** Group of three mushrooms (cap colour = instance colour). */
export function buildMushrooms(seed) {
  const rand = mulberry32(seed);
  const g = new GeoBuilder();
  const spots = [[0, 0, 1], [0.16, 0.08, 0.7], [-0.1, 0.15, 0.5]];
  for (const [ox, oz, s] of spots) {
    const sc = s * (0.8 + rand() * 0.4) * 0.8;
    const stem = [[0.055, 0], [0.05, 0.1], [0.045, 0.2], [0.06, 0.22]].map(([r, y]) => [r * sc * 2.4, y * sc * 2.0]);
    const cap = [[0.1, 0.19], [0.17, 0.2], [0.2, 0.225], [0.18, 0.27], [0.11, 0.31], [0.04, 0.33], [0.0, 0.335]].map(([r, y]) => [r * sc * 2.3, y * sc * 2.0 + 0.0]);
    const sub = new GeoBuilder();
    lathe(sub, stem, 6, [0.85, 0.8, 0.68], 0);
    lathe(sub, cap, 8, [1, 1, 1], 1);
    // translate and append
    const base = g.count;
    for (let i = 0; i < sub.p.length; i += 3) { sub.p[i] += ox; sub.p[i + 2] += oz; }
    g.p.push(...sub.p); g.n.push(...sub.n); g.uv.push(...sub.uv); g.c.push(...sub.c); g.w.push(...sub.w); g.t.push(...sub.t);
    for (const i of sub.i) g.i.push(i + base);
  }
  return g.build();
}

/** Tree stump with flared roots and ring top. */
export function buildStump(seed) {
  const rand = mulberry32(seed);
  const g = new GeoBuilder();
  const R = 0.3 + rand() * 0.12, h = 0.45 + rand() * 0.35;
  const pts = [], radii = [];
  const n = 6;
  for (let i = 0; i < n; i++) { const t = i / (n - 1); pts.push(V(0, -0.2 + (h + 0.2) * t, 0)); radii.push(R * (1 + 0.5 * Math.pow(1 - t, 3)) * (1 - 0.06 * t)); }
  tube(g, pts, radii, 10, { bark: 'bark', v0: 0.1, v1: 0.25, capEnd: true });
  for (let k = 0; k < 3; k++) {
    const a = rand() * TAU + k * 2.1, d = V(Math.cos(a), 0, Math.sin(a));
    tube(g, [d.clone().multiplyScalar(R * 0.8).add(V(0, 0.2, 0)), d.clone().multiplyScalar(R * 1.5).add(V(0, 0.04, 0)), d.clone().multiplyScalar(R * 2.1).add(V(0, -0.1, 0))], [0.1, 0.07, 0.04], 5, { bark: 'bark', v0: 0.3, v1: 0.4 });
  }
  return g.build();
}

/** Fallen log lying along +X with branch stubs. */
export function buildLog(seed, length, radius) {
  const rand = mulberry32(seed);
  const g = new GeoBuilder();
  const n = 7, pts = [], radii = [];
  const bend = (rand() - 0.5) * 0.3;
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    pts.push(V((t - 0.5) * length, radius * 0.8 + Math.sin(t * Math.PI) * bend * 0.3, bend * Math.sin(t * Math.PI)));
    radii.push(radius * (1 - 0.14 * t) * (1 + 0.04 * Math.sin(t * 23)));
  }
  tube(g, pts, radii, 9, { bark: 'bark', v0: 0.2, v1: 0.2 + Math.min(0.7, length / 9), capEnd: true, capStart: true, shade: () => 0.85 });
  for (let k = 0; k < 3; k++) {
    const t = 0.2 + rand() * 0.6, p = pts[Math.round(t * (n - 1))], a = rand() * TAU;
    const d = V(Math.cos(a) * 0.5, 0.8, Math.sin(a) * 0.5).normalize();
    tube(g, [p.clone().addScaledVector(d, radius * 0.7), p.clone().addScaledVector(d, radius * 0.7 + 0.35)], [radius * 0.22, radius * 0.12], 5, { bark: 'bark', v0: 0.4, v1: 0.45, capEnd: true });
  }
  return g.build();
}
