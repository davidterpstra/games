/* =====================================================================
   Terrain generation + world queries.
   A 2 m heightfield (1201 x 1201) is built from a designed "natural"
   landform, then the river, lake, festival plaza and every road are
   carved / flattened into it, so roads always sit on the ground and
   junctions meet at the same height. Physics, props, AI and rendering
   all read the same grids.
   ===================================================================== */
const GRES = 2, GN = WORLD / GRES, GV = GN + 1;

const World = {
  H: null, RD: null, RY: null, RSEG: null, BR: null, WL: null, SURF: null, FLD: null,
  roads: [], byId: {}, nodeH: {}, plazaH: 0,
  SX: [], SZ: [], SY: [], SROAD: [], SFLAG: [], // global road samples (flag: 1 bridge, 2 tunnel)
  river: null, // {pts:[[x,z]], wl:[], hw:[]}
};

/* ---------- designed landform ---------- */
const RIVER_POLY = RIVER.pts;
function riverDistApprox(x, z) {
  let m = 1e9;
  for (let i = 0; i < RIVER_POLY.length - 1; i++) {
    const a = RIVER_POLY[i], b = RIVER_POLY[i + 1];
    const d = closestOnSeg(x, z, a[0], a[1], b[0], b[1]).d;
    if (d < m) m = d;
  }
  return m;
}
function lakeQ(x, z) {
  const c = Math.cos(LAKE.rot), s = Math.sin(LAKE.rot);
  const dx = x - LAKE.x, dz = z - LAKE.z;
  const u = (dx * c - dz * s) / LAKE.rx, v = (dx * s + dz * c) / LAKE.rz;
  const ang = Math.atan2(v, u);
  const wob = 1 + 0.12 * Math.sin(ang * 3 + 1.2) + 0.07 * Math.sin(ang * 5 - 0.4);
  return Math.hypot(u, v) / wob;
}
function natural(x, z) {
  let h = 24 + fbm(x * 0.0021 + 3.1, z * 0.0021 - 1.7, 4) * 30 + fbm(x * 0.008 + 11, z * 0.008 + 4, 3) * 6;
  // Grimstone Fells to the north
  const mN = smoothstep(-560, -1010, z);
  if (mN > 0) {
    const r = ridged(x * 0.0032 + 5.3, z * 0.0032 + 2.1, 4);
    h += mN * mN * (60 + r * 175);
    // saddle the pass road climbs over
    h -= 95 * mN * Math.exp(-(((x - 10) / 190) ** 2 + ((z + 1045) / 95) ** 2) * 0.5);
    // spur ridge the Fellside tunnel cuts through
    h += 52 * Math.exp(-(((x + 45) / 42) ** 2) * 0.5) * smoothstep(-690, -810, z) * (1 - smoothstep(-950, -1050, z));
  }
  // western downs and eastern woods: a little higher
  h += 16 * smoothstep(-500, -1100, x) * (0.6 + 0.4 * fbm(x * 0.004, z * 0.004));
  h += 10 * smoothstep(700, 1100, x);
  // map edge framing hills
  const e = Math.max(Math.abs(x), Math.abs(z));
  h += smoothstep(1020, 1200, e) * (70 + 40 * fbm(x * 0.006, z * 0.006));
  // broad valley of the River Wend
  h -= 15 * (1 - smoothstep(30, 260, riverDistApprox(x, z)));
  // basin around Mere Water
  h -= 13 * (1 - smoothstep(1.0, 2.3, lakeQ(x, z)));
  return h;
}

/* ---------- farmland: rotated field grid with crops ---------- */
const FIELD_A = 0.28, FCOS = Math.cos(FIELD_A), FSIN = Math.sin(FIELD_A);
function farmMask(x, z) {
  let m = 0;
  m = Math.max(m, 1 - smoothstep(330, 470, Math.hypot(x - 40, z - 900)));
  m = Math.max(m, 1 - smoothstep(160, 300, Math.hypot(x + 700, z - 420)));
  m = Math.max(m, 1 - smoothstep(150, 260, Math.hypot(x - 620, z + 520)));
  m = Math.max(m, (1 - smoothstep(180, 300, Math.hypot(x + 380, z - 560))));
  m = Math.max(m, (1 - smoothstep(160, 280, Math.hypot(x - 420, z - 820))));
  return m;
}
function fieldAt(x, z) {
  const u = x * FCOS - z * FSIN, v = x * FSIN + z * FCOS;
  const iv = Math.floor(v / 78);
  const uo = u + hash2(iv, 7) * 120;
  const iu = Math.floor(uo / (95 + 40 * hash2(iv, 3)));
  const w = 95 + 40 * hash2(iv, 3);
  const fu = uo / w - iu, fv = v / 78 - iv;
  const edge = Math.min(fu, 1 - fu) * w < Math.min(fv, 1 - fv) * 78 ? Math.min(fu, 1 - fu) * w : Math.min(fv, 1 - fv) * 78;
  const hsh = hash2(iu * 31 + 5, iv * 17 + 3);
  const crop = hsh < 0.34 ? 0 : hsh < 0.56 ? 1 : hsh < 0.72 ? 2 : hsh < 0.86 ? 3 : 4; // pasture, wheat, ploughed, rapeseed, meadow
  return { crop, edge, id: iu * 1000 + iv };
}
const CROP_TINT = [[0.92, 1.05, 0.78], [1.45, 1.22, 0.55], [0.95, 0.72, 0.5], [1.55, 1.5, 0.32], [1.0, 1.02, 0.7]];

/* ---------- roads ---------- */
function buildRoads() {
  const W = World;
  let ph = 0, n = 0;
  for (let a = 0; a < TAU; a += TAU / 16) for (const r of [0, 30, 60]) { ph += natural(PLAZA.x + Math.cos(a) * r, PLAZA.z + Math.sin(a) * r); n++; }
  W.plazaH = ph / n + 0.5;
  const inPlaza = (k) => Math.hypot(NODES[k][0] - PLAZA.x, NODES[k][1] - PLAZA.z) < PLAZA.r + 5;
  const smoothArr = (y, rad) => {
    const N = y.length, out = new Float32Array(N);
    let acc = 0;
    // running-window mean (clamped window at the ends)
    for (let i = 0; i < N; i++) {
      let sum = 0, c = 0;
      for (let k = Math.max(0, i - rad); k <= Math.min(N - 1, i + rad); k++) { sum += y[k]; c++; }
      out[i] = sum / c;
    }
    void acc;
    return out;
  };

  // pass 1: plan geometry and the profile each road "wants" (smoothed ground, bridges, tunnels)
  const raws = ROADS.map((def) => {
    const T = ROAD_TYPES[def.t];
    const P = catmull([NODES[def.a], ...def.pts, NODES[def.b]], 2);
    const N = P.length;
    const s = new Float32Array(N);
    for (let i = 1; i < N; i++) s[i] = s[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]);
    const flag = new Uint8Array(N);
    let y = new Float32Array(N);
    for (let i = 0; i < N; i++) y[i] = natural(P[i][0], P[i][1]);
    for (let i = 0; i < N; i++) {
      const q = riverQuery(P[i][0], P[i][1]);
      if (q.d < q.hw + 9) { flag[i] = 1; y[i] = Math.max(y[i], q.wl + 3.6); }
    }
    if (def.tunnel) for (const [tx, tz, tl] of def.tunnel) for (let i = 0; i < N; i++) if (Math.hypot(P[i][0] - tx, P[i][1] - tz) < tl) flag[i] = 2;
    const R = def.t === 'M' ? 9 : def.t === 'D' ? 6 : 14;
    for (let it = 0; it < 4; it++) y = smoothArr(y, R);
    linearTunnel(y, flag, s);
    return { def, T, P, N, s, L: s[N - 1], flag, y };
  });
  // junction heights come from the roads that meet there, so every road can reach them within its grade
  for (const k in NODES) {
    if (inPlaza(k)) { W.nodeH[k] = W.plazaH; continue; }
    const vals = [];
    for (const r of raws) {
      const at = (sv) => { let i = 0; while (i < r.N - 1 && r.s[i] < sv) i++; return r.y[i]; };
      if (r.def.a === k) vals.push(at(Math.min(30, r.L / 3)));
      if (r.def.b === k) vals.push(at(Math.max(r.L - 30, r.L * 2 / 3)));
    }
    W.nodeH[k] = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : natural(NODES[k][0], NODES[k][1]);
  }

  // relax junction heights until every road can link its two ends within its grade
  for (let it = 0; it < 40; it++) {
    let worst = 0;
    for (const r of raws) {
      const a = r.def.a, b = r.def.b;
      const maxD = r.T.grade * Math.max(5, r.L - 20 - 45) * 0.97;
      const diff = W.nodeH[b] - W.nodeH[a];
      const ex = Math.abs(diff) - maxD;
      if (ex <= 0) continue;
      worst = Math.max(worst, ex);
      const fa = inPlaza(a) ? 0 : 1, fb = inPlaza(b) ? 0 : 1;
      if (!fa && !fb) continue;
      const sg = Math.sign(diff);
      W.nodeH[a] += sg * ex * fa / (fa + fb);
      W.nodeH[b] -= sg * ex * fb / (fa + fb);
    }
    if (worst < 0.01) break;
  }

  // pass 2: final profile — pinned at both junctions, hard grade limit, rounded vertical curves
  for (const r of raws) {
    const { def, T, P, N, s, L, flag } = r;
    let y = r.y;
    const hA = W.nodeH[def.a], hB = W.nodeH[def.b];
    const g = T.grade;
    const pin = () => {
      for (let i = 0; i < N; i++) {
        y[i] = lerp(hA, y[i], smoothstep(12, 70, s[i]));
        y[i] = lerp(hB, y[i], smoothstep(12, 70, L - s[i]));
      }
    };
    // cone constraint from both pinned ends (flat for the first 12 m)
    // allowed height change away from a junction: flat, then a parabolic vertical curve, then the grade
    const LC = 45;
    const bound = (d) => (d <= 0 ? 0 : d < LC ? g * d * d / (2 * LC) : g * (d - LC / 2));
    const cone = () => {
      for (let i = 0; i < N; i++) {
        const da = bound(s[i] - 10), db = bound(L - s[i] - 10);
        const lo = Math.max(hA - da, hB - db), hi = Math.min(hA + da, hB + db);
        y[i] = lo <= hi ? clamp(y[i], lo, hi) : lerp(hA, hB, smoothstep(0, 1, s[i] / L));
      }
    };
    const lipschitz = () => {
      for (let k = 1; k < N; k++) { const d = g * (s[k] - s[k - 1]); y[k] = clamp(y[k], y[k - 1] - d, y[k - 1] + d); }
      for (let k = N - 2; k >= 0; k--) { const d = g * (s[k + 1] - s[k]); y[k] = clamp(y[k], y[k + 1] - d, y[k + 1] + d); }
    };
    // bridge decks must clear the water: lift them, then let the grade limit build the approach ramps
    const deck = new Float32Array(N).fill(-1e9);
    for (let k = 0; k < N; k++) if (flag[k] === 1) deck[k] = riverQuery(P[k][0], P[k][1]).wl + 3.2;
    const lift = () => { for (let k = 0; k < N; k++) if (y[k] < deck[k]) y[k] = deck[k]; };
    pin(); lift(); lipschitz(); cone();
    const R2 = def.t === 'M' ? 6 : def.t === 'D' ? 6 : 12;
    for (let it = 0; it < 3; it++) { y = smoothArr(y, R2); lift(); lipschitz(); cone(); }
    y = smoothArr(y, 3); lift();

    const road = { def, id: def.id, name: def.name, type: def.t, T, hw: T.hw, n: N, x: new Float32Array(N), z: new Float32Array(N), y, s, flag, len: L, i0: W.SX.length, idx: W.roads.length };
    let maxG = 0;
    for (let k = 0; k < N; k++) {
      road.x[k] = P[k][0]; road.z[k] = P[k][1];
      if (k) maxG = Math.max(maxG, Math.abs(y[k] - y[k - 1]) / (s[k] - s[k - 1] || 1));
      W.SX.push(P[k][0]); W.SZ.push(P[k][1]); W.SY.push(y[k]); W.SROAD.push(W.roads.length); W.SFLAG.push(flag[k]);
    }
    road.maxGrade = maxG;
    road.tx = new Float32Array(N); road.tz = new Float32Array(N);
    for (let k = 0; k < N; k++) {
      const a = Math.max(0, k - 1), b = Math.min(N - 1, k + 1);
      const dx = road.x[b] - road.x[a], dz = road.z[b] - road.z[a], l = Math.hypot(dx, dz) || 1;
      road.tx[k] = dx / l; road.tz[k] = dz / l;
    }
    W.roads.push(road);
    W.byId[def.id] = road;
  }
}
function linearTunnel(y, flag, s) {
  const N = y.length;
  let i = 0;
  while (i < N) {
    if (flag[i] !== 2) { i++; continue; }
    let j = i;
    while (j < N && flag[j] === 2) j++;
    const a = Math.max(0, i - 1), b = Math.min(N - 1, j);
    for (let k = i; k < j; k++) y[k] = lerp(y[a], y[b], (s[k] - s[a]) / (s[b] - s[a] || 1));
    i = j;
  }
}

/* River: dense spline with a monotonic water level. */
function buildRiver() {
  const P = catmull(RIVER.pts, 4);
  const N = P.length;
  const wl = new Float32Array(N), hw = new Float32Array(N);
  let m = 1e9;
  for (let i = 0; i < N; i++) {
    let lo = 1e9;
    for (let a = -1; a <= 1; a++) lo = Math.min(lo, natural(P[i][0] + a * 6, P[i][1] + a * 6));
    m = Math.min(m, lo - 2.2);
    wl[i] = m;
    hw[i] = lerp(RIVER.hw0, RIVER.hw1, i / (N - 1)) * (1 + 0.15 * Math.sin(i * 0.11));
  }
  // smooth but stay monotonic
  for (let it = 0; it < 6; it++) for (let i = 1; i < N - 1; i++) wl[i] = Math.min(wl[i - 1], (wl[i - 1] + wl[i] + wl[i + 1]) / 3);
  World.river = { P, wl, hw, N };
}
function riverQuery(x, z) {
  const r = World.river;
  let best = 1e9, bi = 0, bt = 0;
  for (let i = 0; i < r.N - 1; i += 1) {
    const a = r.P[i], b = r.P[i + 1];
    if (Math.abs(a[0] - x) > 80 && Math.abs(b[0] - x) > 80) continue;
    const c = closestOnSeg(x, z, a[0], a[1], b[0], b[1]);
    if (c.d < best) { best = c.d; bi = i; bt = c.t; }
  }
  return { d: best, wl: lerp(r.wl[bi], r.wl[bi + 1], bt), hw: lerp(r.hw[bi], r.hw[bi + 1], bt), i: bi };
}

/* ---------- grid build (async so the loading bar can update) ---------- */
const frameYield = () => new Promise((r) => setTimeout(r, 0));
async function generateWorld(progress) {
  const W = World;
  progress(0.02, 'Shaping the river');
  buildRiver();
  await frameYield();
  progress(0.05, 'Surveying roads');
  buildRoads();
  await frameYield();

  const NV = GV * GV;
  W.H = new Float32Array(NV);
  W.RD = new Float32Array(NV).fill(1e4);
  W.RY = new Float32Array(NV);
  W.RSEG = new Int32Array(NV).fill(-1);
  W.RT = new Float32Array(NV);
  W.WL = new Float32Array(NV).fill(-1e4);
  W.RIVD = new Float32Array(NV).fill(1e4);
  W.RIVWL = new Float32Array(NV);
  W.BR = new Uint8Array(NV);
  W.SURF = new Uint8Array(NV);
  W.FLD = new Uint8Array(NV);

  // rasterise the distance to the nearest road segment
  progress(0.1, 'Laying tarmac');
  const SX = W.SX, SZ = W.SZ, SR = W.SROAD;
  const NS = SX.length;
  for (let k = 0; k < NS - 1; k++) {
    if (SR[k] !== SR[k + 1]) continue;
    const road = W.roads[SR[k]];
    const R = road.hw + 34;
    const ax = SX[k], az = SZ[k], bx = SX[k + 1], bz = SZ[k + 1];
    const i0 = Math.max(0, Math.floor((Math.min(ax, bx) - R + HALF) / GRES)), i1 = Math.min(GN, Math.ceil((Math.max(ax, bx) + R + HALF) / GRES));
    const j0 = Math.max(0, Math.floor((Math.min(az, bz) - R + HALF) / GRES)), j1 = Math.min(GN, Math.ceil((Math.max(az, bz) + R + HALF) / GRES));
    const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz || 1;
    for (let j = j0; j <= j1; j++) {
      const z = j * GRES - HALF;
      for (let i = i0; i <= i1; i++) {
        const x = i * GRES - HALF;
        let t = ((x - ax) * dx + (z - az) * dz) / l2;
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        const cx = ax + dx * t - x, cz = az + dz * t - z;
        const d = Math.sqrt(cx * cx + cz * cz) - road.hw; // distance from the road EDGE
        const id = j * GV + i;
        if (d < W.RD[id]) { W.RD[id] = d; W.RSEG[id] = k; W.RT[id] = t; }
      }
    }
    if ((k & 2047) === 0) { progress(0.1 + 0.15 * k / NS, 'Laying tarmac'); await frameYield(); }
  }
  // river distance field
  const rv = W.river;
  for (let k = 0; k < rv.N - 1; k++) {
    const R = rv.hw[k] + 30;
    const ax = rv.P[k][0], az = rv.P[k][1], bx = rv.P[k + 1][0], bz = rv.P[k + 1][1];
    const i0 = Math.max(0, Math.floor((Math.min(ax, bx) - R + HALF) / GRES)), i1 = Math.min(GN, Math.ceil((Math.max(ax, bx) + R + HALF) / GRES));
    const j0 = Math.max(0, Math.floor((Math.min(az, bz) - R + HALF) / GRES)), j1 = Math.min(GN, Math.ceil((Math.max(az, bz) + R + HALF) / GRES));
    const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz || 1;
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const x = i * GRES - HALF, z = j * GRES - HALF;
      const t = clamp(((x - ax) * dx + (z - az) * dz) / l2, 0, 1);
      const d = Math.hypot(ax + dx * t - x, az + dz * t - z) - lerp(rv.hw[k], rv.hw[k + 1], t);
      const id = j * GV + i;
      if (d < W.RIVD[id]) { W.RIVD[id] = d; W.RIVWL[id] = lerp(rv.wl[k], rv.wl[k + 1], t); }
    }
  }
  progress(0.27, 'Raising hills');
  await frameYield();

  // heights
  const H = W.H;
  for (let j = 0; j < GV; j++) {
    const z = j * GRES - HALF;
    for (let i = 0; i < GV; i++) {
      const x = i * GRES - HALF, id = j * GV + i;
      let h = natural(x, z);
      // lake
      const q = lakeQ(x, z);
      if (q < 1.6) {
        const bed = LAKE.level - 1 - 7 * smoothstep(0.98, 0.45, q);
        const bank = LAKE.level + 0.3 + Math.max(0, q - 1) * 55;
        h = Math.min(h, q < 1 ? bed : Math.max(bed, bank));
        if (q < 1) W.WL[id] = LAKE.level;
      }
      // river channel
      const rd = W.RIVD[id];
      if (rd < 30) {
        const wl = W.RIVWL[id];
        const carve = rd < 0 ? wl - 0.6 - 2.4 * Math.min(1, -rd / 4) : wl + 0.25 + rd * 0.55;
        h = Math.min(h, carve);
        if (rd < 1.5) W.WL[id] = Math.max(W.WL[id], wl);
      }
      // festival plaza
      const dp = Math.hypot(x - PLAZA.x, z - PLAZA.z);
      if (dp < PLAZA.r + 110) h = lerp(h, W.plazaH - 0.05, 1 - smoothstep(PLAZA.r + 42, PLAZA.r + 100, dp));
      // roads: flatten towards the road surface
      const k = W.RSEG[id];
      if (k >= 0) {
        const t = W.RT[id], ry = lerp(W.SY[k], W.SY[k + 1], t);
        W.RY[id] = ry;
        const d = W.RD[id];
        const fl = W.SFLAG[k] | W.SFLAG[k + 1];
        if (fl & 1) {
          if (d < 2.2) W.BR[id] = 1;
          // keep the river channel under the bridge; banks still meet the deck ends
          const rw = 1 - smoothstep(0, 10, rd);
          const w = (1 - smoothstep(1.5, 9 + Math.abs(ry - h) * 1.2, d)) * (1 - rw);
          h = lerp(h, ry - 0.05, w);
        } else if (fl & 2) {
          const w = 1 - smoothstep(1.0, 2.6, d);
          h = lerp(h, ry - 0.05, w);
        } else {
          const fall = Math.min(30, 7 + Math.abs(ry - h) * 1.25);
          const w = 1 - smoothstep(1.4, 1.4 + fall, d);
          h = lerp(h, ry - 0.05, w);
        }
      }
      H[id] = h;
    }
    if ((j & 63) === 0) { progress(0.27 + 0.33 * j / GV, 'Raising hills'); await frameYield(); }
  }

  // surfaces
  progress(0.62, 'Sowing fields');
  await frameYield();
  for (let j = 0; j < GV; j++) {
    const z = j * GRES - HALF;
    for (let i = 0; i < GV; i++) {
      const x = i * GRES - HALF, id = j * GV + i;
      const h = H[id];
      let s = S_GRASS;
      const d = W.RD[id];
      const k = W.RSEG[id];
      const hx = H[j * GV + Math.min(GN, i + 1)] - H[j * GV + Math.max(0, i - 1)];
      const hz = H[Math.min(GN, j + 1) * GV + i] - H[Math.max(0, j - 1) * GV + i];
      const slope = Math.hypot(hx, hz) / (2 * GRES);
      const fm = farmMask(x, z);
      let fld = 0;
      if (fm > 0.35) { const f = fieldAt(x, z); if (f.edge > 3) fld = f.crop + 1; }
      W.FLD[id] = fld;
      if (W.BR[id] && d < 0.35) s = W.roads[W.SROAD[k]].T.surf; // bridge deck over the water
      else if (W.WL[id] > h + 0.25) s = S_WATER;
      else if (k >= 0 && d < 0.35) s = W.roads[W.SROAD[k]].T.surf;
      else if (Math.hypot(x - PLAZA.x, z - PLAZA.z) < PLAZA.r) s = S_PAVED;
      else if (slope > 0.75) s = S_ROCK;
      else if (h > 125 + fbm(x * 0.02, z * 0.02) * 25) s = S_SNOW;
      else if (k >= 0 && d < 2.4) s = S_GRAVEL;
      else if (W.RIVD[id] < 5 || (W.WL[id] < -1e3 && lakeQ(x, z) < 1.1)) s = S_MUD;
      else if (fld === 3) s = S_DIRT;
      else if (fbm(x * 0.03 + 40, z * 0.03) > 0.42 && fm < 0.2) s = S_DIRT;
      W.SURF[id] = s;
    }
    if ((j & 127) === 0) { progress(0.62 + 0.08 * j / GV, 'Sowing fields'); await frameYield(); }
  }
}

/* ---------- queries ---------- */
function gridBilinear(A, x, z) {
  const fx = clamp((x + HALF) / GRES, 0, GN - 0.001), fz = clamp((z + HALF) / GRES, 0, GN - 0.001);
  const i = fx | 0, j = fz | 0, u = fx - i, v = fz - j, id = j * GV + i;
  return (A[id] * (1 - u) + A[id + 1] * u) * (1 - v) + (A[id + GV] * (1 - u) + A[id + GV + 1] * u) * v;
}
const cellId = (x, z) => clamp(Math.round((z + HALF) / GRES), 0, GN) * GV + clamp(Math.round((x + HALF) / GRES), 0, GN);
const hAt = (x, z) => gridBilinear(World.H, x, z);
// Ground height for driving: bridge decks win over the river bed underneath.
function groundAt(x, z, yHint = 1e9) {
  const id = cellId(x, z);
  if (World.BR[id]) {
    const ry = gridBilinear(World.RY, x, z);
    if (yHint > ry - 1.2) return ry + 0.06; // on the deck (yHint is the car's own height)
  }
  return gridBilinear(World.H, x, z);
}
const surfAt = (x, z) => World.SURF[cellId(x, z)];
const waterAt = (x, z) => World.WL[cellId(x, z)];
function roadAt(x, z) {
  const id = cellId(x, z), k = World.RSEG[id];
  if (k < 0) return null;
  return { d: World.RD[id], k, road: World.roads[World.SROAD[k]], y: World.RY[id], flag: World.SFLAG[k] };
}
function groundNormal(x, z, y, out) {
  const e = 1.2;
  const hx = groundAt(x + e, z, y) - groundAt(x - e, z, y), hz = groundAt(x, z + e, y) - groundAt(x, z - e, y);
  out.set(-hx, 2 * e, -hz).normalize();
  return out;
}
function placeName(x, z) {
  let best = null, bd = 1e9;
  for (const p of PLACES) {
    const d = Math.hypot(x - p.x, z - p.z) / p.r;
    if (d < 1 && d < bd) { bd = d; best = p; }
  }
  return best;
}

/* ---------- procedural ground textures ---------- */
function makeGroundTextures() {
  const S = 512;
  const grass = canvasTex(S, S, (x, w, h) => {
    noiseFill(x, w, h, 16, (n) => { const v = 0.75 + n * 0.5; return [92 * v, 128 * v, 58 * v]; });
    for (let i = 0; i < 9000; i++) {
      const px = rng() * w, py = rng() * h, l = 2 + rng() * 5, g = 90 + rng() * 80;
      x.strokeStyle = `rgba(${g * 0.55 | 0},${g | 0},${g * 0.35 | 0},${0.25 + rng() * 0.35})`;
      x.lineWidth = 1;
      x.beginPath(); x.moveTo(px, py); x.lineTo(px + (rng() - 0.5) * 2, py - l); x.stroke();
    }
  });
  const dirt = canvasTex(S, S, (x, w, h) => {
    noiseFill(x, w, h, 12, (n) => { const v = 0.7 + n * 0.6; return [128 * v, 104 * v, 78 * v]; });
    for (let i = 0; i < 2500; i++) {
      const g = 60 + rng() * 120, r = 0.5 + rng() * 2.2;
      x.fillStyle = `rgba(${g | 0},${g * 0.85 | 0},${g * 0.7 | 0},0.6)`;
      x.beginPath(); x.arc(rng() * w, rng() * h, r, 0, TAU); x.fill();
    }
  });
  const rock = canvasTex(S, S, (x, w, h) => {
    noiseFill(x, w, h, 8, (n, i, j) => {
      const c = 0.5 + 0.5 * Math.sin((j / h) * TAU * 6 + n * 9);
      const v = 0.55 + n * 0.45 + c * 0.12;
      return [118 * v, 114 * v, 108 * v];
    });
    x.globalAlpha = 0.25;
    for (let i = 0; i < 160; i++) {
      x.strokeStyle = rng() < 0.5 ? '#2a2826' : '#d8d2c8';
      x.lineWidth = 0.5 + rng() * 1.5;
      x.beginPath();
      let px = rng() * w, py = rng() * h;
      x.moveTo(px, py);
      for (let k = 0; k < 5; k++) { px += (rng() - 0.5) * 40; py += (rng() - 0.3) * 18; x.lineTo(px, py); }
      x.stroke();
    }
    x.globalAlpha = 1;
  });
  const snow = canvasTex(S, S, (x, w, h) => {
    noiseFill(x, w, h, 10, (n) => { const v = 0.86 + n * 0.16; return [236 * v, 242 * v, 250 * v]; });
  });
  const macro = canvasTex(256, 256, (x, w, h) => {
    noiseFill(x, w, h, 6, (n, i, j) => [255 * n, 255 * hash2(i >> 3, j >> 3) * 0.3 + 255 * n * 0.7, 128, 255]);
  }, { srgb: false });
  return { grass, dirt, rock, snow, macro };
}

/* ---------- terrain mesh: 200 m chunks with 3 LODs + skirts ---------- */
const CHUNK = 200, CHN = WORLD / CHUNK, CH_CELLS = CHUNK / GRES;
const LOD_STEPS = [2, 4, 10]; // grid cells per vertex: 4 m, 8 m, 20 m
const Terrain = { chunks: [], material: null, tex: null, group: new THREE.Group() };

function terrainVertexInfo(i, j, out) {
  // splat (grass, dirt, rock, snow) + grass tint for vertex at grid i,j
  const W = World, id = j * GV + i, x = i * GRES - HALF, z = j * GRES - HALF, h = W.H[id];
  const hx = W.H[j * GV + Math.min(GN, i + 1)] - W.H[j * GV + Math.max(0, i - 1)];
  const hz = W.H[Math.min(GN, j + 1) * GV + i] - W.H[Math.max(0, j - 1) * GV + i];
  const slope = Math.hypot(hx, hz) / (2 * GRES);
  let g = 1, d = 0, r = 0, s = 0;
  r = smoothstep(0.55, 0.95, slope);
  const sn = smoothstep(118, 138, h + fbm(x * 0.02, z * 0.02) * 25) * (1 - r * 0.7);
  s = sn;
  const surf = W.SURF[id];
  const rdd = W.RD[id];
  if (rdd < 3.2) d = Math.max(d, 1 - smoothstep(1.0, 3.2, rdd));
  if (surf === S_DIRT) d = Math.max(d, 0.85);
  if (surf === S_MUD) d = Math.max(d, 0.8);
  if (W.WL[id] > h - 0.6) d = Math.max(d, 0.7);
  const dp = Math.hypot(x - PLAZA.x, z - PLAZA.z);
  if (dp < PLAZA.r + 6) d = Math.max(d, 1 - smoothstep(PLAZA.r - 2, PLAZA.r + 6, dp));
  // moor: heather/bracken patches
  const moor = 1 - smoothstep(200, 330, Math.hypot(x - 120, z + 260));
  d = Math.max(d, moor * smoothstep(0.1, 0.5, fbm(x * 0.012, z * 0.012)) * 0.55);
  g = Math.max(0, 1 - d - r - s);
  const sum = g + d + r + s || 1;
  out.splat = [g / sum, d / sum, r / sum, s / sum];
  // tint
  let tr = 1, tg = 1, tb = 1;
  const n1 = fbm(x * 0.006 + 7, z * 0.006 - 3), n2 = fbm(x * 0.03, z * 0.03);
  tr = 0.95 + n1 * 0.25 + n2 * 0.06; tg = 1.0 + n1 * 0.12 + n2 * 0.05; tb = 0.9 + n1 * 0.1;
  const fld = W.FLD[id];
  if (fld) { const c = CROP_TINT[fld - 1]; tr *= c[0]; tg *= c[1]; tb *= c[2]; }
  if (moor > 0) { const m = moor * smoothstep(-0.2, 0.4, n2); tr = lerp(tr, 1.25, m * 0.6); tg = lerp(tg, 0.85, m * 0.6); tb = lerp(tb, 0.7, m * 0.6); }
  const dry = smoothstep(60, 110, h) * (1 - s); tr = lerp(tr, 1.18, dry * 0.5); tg = lerp(tg, 1.0, dry * 0.5); tb = lerp(tb, 0.75, dry * 0.5);
  // woodland floor: darker, browner (cheap ambient occlusion under the canopy)
  const wood = smoothstep(0.25, 0.8, treeDensityFast(x, z));
  const ao = 1 - wood * 0.38;
  tr = lerp(tr, 0.95, wood * 0.4) * ao; tg = lerp(tg, 0.8, wood * 0.4) * ao; tb *= ao;
  out.tint = [tr, tg, tb];
}

function buildChunkGeometry(ci, cj, step) {
  const W = World;
  const n = CH_CELLS / step + 1;
  const ring = 4 * (n - 1);
  const vcount = n * n + ring;
  const pos = new Float32Array(vcount * 3), nor = new Float32Array(vcount * 3), spl = new Float32Array(vcount * 4), tin = new Float32Array(vcount * 3);
  const info = {};
  const gi0 = ci * CH_CELLS, gj0 = cj * CH_CELLS;
  const put = (v, i, j, drop) => {
    const id = j * GV + i;
    let h = W.H[id];
    // coarse LODs: sink a little near roads so the road ribbon never disappears
    if (step > 2 && W.RD[id] < 4) h -= 0.25 * step;
    pos[v * 3] = i * GRES - HALF; pos[v * 3 + 1] = h - drop; pos[v * 3 + 2] = j * GRES - HALF;
    const s = step;
    const hx = W.H[j * GV + Math.min(GN, i + s)] - W.H[j * GV + Math.max(0, i - s)];
    const hz = W.H[Math.min(GN, j + s) * GV + i] - W.H[Math.max(0, j - s) * GV + i];
    const nx = -hx, ny = 2 * s * GRES, nz = -hz, l = Math.hypot(nx, ny, nz);
    nor[v * 3] = nx / l; nor[v * 3 + 1] = ny / l; nor[v * 3 + 2] = nz / l;
    terrainVertexInfo(i, j, info);
    spl.set(info.splat, v * 4); tin.set(info.tint, v * 3);
  };
  for (let b = 0; b < n; b++) for (let a = 0; a < n; a++) put(b * n + a, gi0 + a * step, gj0 + b * step, 0);
  // skirt ring
  const edge = [];
  for (let a = 0; a < n - 1; a++) edge.push([a, 0]);
  for (let b = 0; b < n - 1; b++) edge.push([n - 1, b]);
  for (let a = n - 1; a > 0; a--) edge.push([a, n - 1]);
  for (let b = n - 1; b > 0; b--) edge.push([0, b]);
  edge.forEach(([a, b], k) => put(n * n + k, gi0 + a * step, gj0 + b * step, 3 + step));
  const idx = [];
  for (let b = 0; b < n - 1; b++) for (let a = 0; a < n - 1; a++) {
    const p = b * n + a;
    // alternate diagonals for a less regular look
    if ((a + b) & 1) idx.push(p, p + n, p + 1, p + 1, p + n, p + n + 1);
    else idx.push(p, p + n, p + n + 1, p, p + n + 1, p + 1);
  }
  for (let k = 0; k < ring; k++) {
    const [a, b] = edge[k], [a2, b2] = edge[(k + 1) % ring];
    const t0 = b * n + a, t1 = b2 * n + a2, s0 = n * n + k, s1 = n * n + (k + 1) % ring;
    idx.push(t0, s0, t1, t1, s0, s1);
    idx.push(t0, t1, s0, t1, s1, s0); // both windings: skirts never show holes
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('splat', new THREE.BufferAttribute(spl, 4));
  g.setAttribute('tint', new THREE.BufferAttribute(tin, 3));
  g.setIndex(idx);
  g.computeBoundingSphere();
  g.computeBoundingBox();
  return g;
}

function makeTerrainMaterial(tex) {
  const m = new THREE.MeshStandardMaterial({ roughness: 0.94, metalness: 0, envMapIntensity: 0.5 });
  m.userData.u = { tGrass: { value: tex.grass }, tDirt: { value: tex.dirt }, tRock: { value: tex.rock }, tSnow: { value: tex.snow }, tMacro: { value: tex.macro }, uWet: { value: 0 }, uSnowCover: { value: 0 } };
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, m.userData.u);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec4 splat; attribute vec3 tint; varying vec4 vSplat; varying vec3 vTint; varying vec3 vWP;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvSplat = splat; vTint = tint; vWP = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
uniform sampler2D tGrass, tDirt, tRock, tSnow, tMacro; uniform float uWet, uSnowCover;
varying vec4 vSplat; varying vec3 vTint; varying vec3 vWP;`)
      .replace('#include <map_fragment>', `
vec2 tuv = vWP.xz * 0.115; vec2 tuv2 = vWP.xz * 0.0237 + 0.37;
vec4 mac = texture2D(tMacro, vWP.xz * 0.0019);
vec4 mac2 = texture2D(tMacro, vWP.xz * 0.011 + 0.5);
vec3 cg = mix(texture2D(tGrass, tuv).rgb, texture2D(tGrass, tuv2).rgb, 0.45) * vTint * (0.78 + 0.42 * mac.r);
vec3 cd = mix(texture2D(tDirt, tuv * 0.8).rgb, texture2D(tDirt, tuv2).rgb, 0.4) * (0.82 + 0.3 * mac2.r);
vec3 cr = mix(texture2D(tRock, vWP.xz * 0.06).rgb, texture2D(tRock, vec2(vWP.x + vWP.z, vWP.y * 1.6) * 0.045).rgb, 0.65) * (0.85 + 0.25 * mac.g);
vec3 cs = texture2D(tSnow, tuv * 0.6).rgb;
vec4 sw = vSplat;
float hg = texture2D(tGrass, tuv).g, hd = texture2D(tDirt, tuv).r, hr = texture2D(tRock, vWP.xz * 0.06).r;
sw *= vec4(0.6 + hg, 0.6 + hd, 0.5 + hr * 1.2, 1.0);
sw = pow(sw, vec4(1.6));
sw.w = max(sw.w, uSnowCover * (sw.x + sw.y) * 0.9);
sw /= max(1e-4, sw.x + sw.y + sw.z + sw.w);
vec3 tcol = cg * sw.x + cd * sw.y + cr * sw.z + cs * sw.w;
tcol *= mix(1.0, 0.62, uWet * (1.0 - sw.w));
diffuseColor.rgb *= tcol;`)
      .replace('#include <roughnessmap_fragment>', `float roughnessFactor = roughness;
roughnessFactor = mix(roughnessFactor, 0.5, uWet * (sw.y + sw.z) * 0.8);
roughnessFactor = mix(roughnessFactor, 0.7, sw.w * 0.4);`);
  };
  return m;
}

function buildTerrainMesh() {
  Terrain.tex = makeGroundTextures();
  Terrain.material = makeTerrainMaterial(Terrain.tex);
  for (let cj = 0; cj < CHN; cj++) for (let ci = 0; ci < CHN; ci++) {
    const lods = LOD_STEPS.map((s) => buildChunkGeometry(ci, cj, s));
    const mesh = new THREE.Mesh(lods[0], Terrain.material);
    mesh.receiveShadow = true;
    mesh.matrixAutoUpdate = false;
    const cx = ci * CHUNK - HALF + CHUNK / 2, cz = cj * CHUNK - HALF + CHUNK / 2;
    Terrain.chunks.push({ mesh, lods, cx, cz, lod: 0 });
    Terrain.group.add(mesh);
  }
}
function updateTerrainLod(cx, cz, q) {
  for (const c of Terrain.chunks) {
    const d = Math.max(0, Math.hypot(c.cx - cx, c.cz - cz) - CHUNK * 0.7);
    const l = d < q.terrainLod[0] ? 0 : d < q.terrainLod[1] ? 1 : 2;
    if (l !== c.lod) { c.lod = l; c.mesh.geometry = c.lods[l]; }
  }
}
