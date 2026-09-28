/* =====================================================================
   WORLD — hand-shaped low-poly landscape (no default terrain look)
   Heightfield with faceted vertex-coloured triangles, water, roads,
   bridges, caves, quarry, props, decorations and locked-area barriers.
   ===================================================================== */

/* ---------- authored features ---------- */
const RIVER = smoothPolyline([[66, -250], [60, -200], [72, -160], [64, -125], [66, -90], [76, -55], [80, -20], [80, 0], [78, 25], [74, 55], [78, 86]], 3);
const STREAM = smoothPolyline([[104, 124], [126, 131], [148, 137], [172, 143], [205, 148]], 3);
const LAKE = { x: 84, z: 112, r: 31 };
const PONDS = [{ x: -14, z: -90, r: 7.5 }, { x: -142, z: -4, r: 12 }, { x: -58, z: 168, r: 9 }];
const QUARRY = { x: -62, z: -92 };
const CAVES = [
  { id: 'iron_cave', x: -160, z: -74, dx: 1, dz: 0, floor: 0 },
  { id: 'crystal_cave', x: -100, z: -157, dx: 0, dz: 1, floor: 0 },
];
const ROADS_RAW = [
  { w: 4.4, pts: [[-196, 6], [-150, 2], [-100, 8], [-45, 3], [-20, 1], [0, 0], [24, -1], [50, 1], [80, 0], [110, -2], [135, -3], [150, 0], [174, 1]] },
  { w: 4.4, pts: [[2, -196], [8, -160], [-4, -120], [4, -80], [0, -42], [0, 0], [1, 42], [-6, 80], [4, 120], [-4, 160], [0, 196]] },
  { w: 3.4, pts: [[-45, 3], [-60, -30], [-74, -58], [-88, -100], [-99, -128], [-100, -140]] },
  { w: 3.2, pts: [[-74, -58], [-110, -66], [-145, -73]] },
  { w: 3.4, pts: [[24, -1], [40, 20], [52, 48], [60, 70], [64, 82]] },
  { w: 3.6, pts: [[150, 0], [152, -50], [148, -108]] },
  { w: 3.6, pts: [[150, 0], [153, 50], [146, 108]] },
  { w: 3.2, pts: [[-6, 80], [-40, 76], [-80, 82], [-112, 78]] },
  { w: 3.4, pts: [[4, -80], [30, -84], [56, -90], [76, -90], [100, -94], [122, -100], [148, -108]] },
];
const BRIDGES = [
  { x: 80, z: 0, len: 28, w: 5.4 },
  { x: 66, z: -90, len: 26, w: 4.8 },
];
const START = { spawn: [6, 9], home: { x: -15, z: -12, rot: 1 }, cart: [10, -8.5], board: [-6, 6], sign: [5, 34] };
const CHESTS = [
  { id: 'c_forest', area: 'forest', x: -22, z: -99, reward: { coins: 150, food: 20, cos: 'shirt_berry' } },
  { id: 'c_river', area: 'river', x: 102, z: -62, reward: { coins: 250, wood: 60, cos: 'hat_bucket' } },
  { id: 'c_farm', area: 'farmland', x: -104, z: 104, reward: { coins: 300, wheat: 60, cos: 'shirt_sun' } },
  { id: 'c_hills', area: 'hills', x: -164, z: -79, reward: { coins: 350, iron: 30 } },
  { id: 'c_meadow', area: 'meadow', x: -180, z: -26, reward: { coins: 400, food: 40, cos: 'hat_beret' } },
  { id: 'c_lake', area: 'lake', x: 108, z: 160, reward: { coins: 600, gold: 5, cos: 'hat_party' } },
  { id: 'c_deep', area: 'deepwoods', x: 14, z: -170, reward: { coins: 900, planks: 30 } },
  { id: 'c_peaks', area: 'peaks', x: -104, z: -160, reward: { coins: 1200, gold: 15 } },
  { id: 'c_harbor', area: 'harbor', x: 168, z: -70, reward: { coins: 1500, tools: 10, cos: 'shirt_sky' } },
  { id: 'c_south', area: 'southhills', x: -150, z: 158, reward: { coins: 2500, gold: 25 } },
];

function coastX(z) { return 178 + 5 * Math.sin(z * 0.045) + 3 * Math.sin(z * 0.13 + 1) - Math.max(0, Math.abs(z) - 108) * 0.75; }
function rectW(x, z, x0, x1, z0, z1, f) {
  return smoothstep(x0 - f, x0 + f, x) * (1 - smoothstep(x1 - f, x1 + f, x)) * smoothstep(z0 - f, z0 + f, z) * (1 - smoothstep(z1 - f, z1 + f, z));
}

function baseHeight(x, z) {
  const n1 = fbm(x * 0.011 + 3.1, z * 0.011 - 7.3, 4);
  const n2 = noise2(x * 0.07 + 11.3, z * 0.07 - 5.1);
  let h = 3.0 + n1 * 3.6 + n2 * 0.4;
  const wh = rectW(x, z, -205, -40, -125, -40, 22);
  if (wh > 0) h += wh * (3 + 10 * smoothstep(0.45, 0.85, ridged(x * 0.017 + 4, z * 0.017, 3)));
  const wo = Math.max(rectW(x, z, -205, 40, 120, 205, 22), rectW(x, z, -205, -120, 40, 125, 22));
  if (wo > 0) h += wo * (3.2 + 3.8 * Math.sin(x * 0.034 + 0.7) * Math.cos(z * 0.029 + 1.3));
  const wm = rectW(x, z, -205, -40, -40, 40, 18);
  if (wm > 0) h += wm * (1.2 + 1.6 * noise2(x * 0.03 - 7, z * 0.03 + 2));
  const wd = rectW(x, z, -40, 125, -205, -120, 20);
  if (wd > 0) h += wd * 2.5 * fbm(x * 0.02 + 9, z * 0.02, 2);
  const dm = Math.hypot(x + 155, z + 180);
  if (dm < 100) h += 52 * Math.pow(1 - dm / 100, 1.6) * (0.65 + 0.5 * ridged(x * 0.028, z * 0.028, 3));
  const fs = 1 - smoothstep(30, 56, Math.hypot(x * 0.95, z));
  const ff = rectW(x, z, -120, 40, 40, 122, 16) * 0.9;
  const fl = Math.max(fs, ff);
  if (fl > 0) h = lerp(h, 2.7 + n2 * 0.22, fl);
  const edge = Math.max(smoothstep(194, 238, -x), smoothstep(194, 238, -z), smoothstep(194, 238, z));
  if (edge > 0) h += edge * (22 + 22 * ridged(x * 0.02 + 3, z * 0.02 - 2, 3));
  return h;
}
let QUARRY_FLOOR = 0;
function rawHeight(x, z) {
  let h = baseHeight(x, z);
  // quarry: terraced pit
  const dq = Math.hypot(x - QUARRY.x, z - QUARRY.z);
  if (dq < 27) {
    let q = lerp(QUARRY_FLOOR, h, smoothstep(5, 23, dq));
    q = Math.floor(q / 1.4) * 1.4 + 0.3;
    h = lerp(q, h, smoothstep(21, 27, dq));
  }
  // caves: mound with a hollow floor and an entrance corridor
  for (const c of CAVES) {
    const d = Math.hypot(x - c.x, z - c.z);
    if (d < 30) {
      h = Math.max(h, c.floor + 9.5 * (1 - smoothstep(11, 27, d)));
      h = lerp(c.floor, h, smoothstep(9.5, 11.6, d));
      const ex = x - c.x, ez = z - c.z;
      const along = ex * c.dx + ez * c.dz, across = Math.abs(-ex * c.dz + ez * c.dx);
      if (along > 0 && along < 30) {
        const k = 1 - smoothstep(2.8, 4.8, across);
        h = lerp(h, lerp(c.floor, h, smoothstep(17, 30, along)), k);
      }
    }
  }
  // sea + beaches
  const cx = coastX(z);
  if (x > cx - 40) {
    h = lerp(h, Math.min(h, 1.1 + (cx - x) * 0.14), smoothstep(cx - 36, cx - 6, x));
    h = lerp(h, -6.5, smoothstep(cx - 6, cx + 16, x));
  }
  // river
  if (x > 36 && x < 112) {
    const d = distToPolyline(x, z, RIVER);
    const w = 6.2 + 1.4 * noise2(z * 0.05, 3.3);
    if (d < w * 3.2) {
      h = lerp(2.3 + (h - 2.3) * 0.25, h, smoothstep(w * 1.3, w * 3.1, d));
      h = lerp(-1.9, h, smoothstep(w * 0.45, w * 1.3, d));
    }
  }
  // stream from the lake to the sea
  if (z > 110 && x > 96) {
    const d = distToPolyline(x, z, STREAM);
    if (d < 12) { h = lerp(1.9 + (h - 1.9) * 0.3, h, smoothstep(5, 12, d)); h = lerp(-1.4, h, smoothstep(1.6, 4.4, d)); }
  }
  // lake + ponds
  const lakes = [LAKE, ...PONDS];
  for (const L of lakes) {
    const d = Math.hypot(x - L.x, z - L.z);
    const r = L.r * (1 + 0.16 * noise2(x * 0.06 + L.x, z * 0.06 + L.z));
    if (d < r * 1.8) {
      h = lerp(1.7 + (h - 1.7) * 0.3, h, smoothstep(r, r * 1.75, d));
      h = lerp(L.r > 20 ? -3.2 : -1.8, h, smoothstep(r * 0.55, r * 1.05, d));
    }
  }
  return h;
}

/* ---------- terrain colours ---------- */
const _tc = (hx) => new THREE.Color(hx);
const TC = {
  g: [_tc(0x9ccc5a), _tc(0x88bb4d), _tc(0x74a945), _tc(0xafcf61)],
  f: [_tc(0x5f9a3f), _tc(0x4f8a37), _tc(0x6a9a3c), _tc(0x578f3a)],
  m: [_tc(0xadd063), _tc(0xc3da6c), _tc(0x9fcf5a), _tc(0xd2dc74)],
  o: [_tc(0x9bb95b), _tc(0xb0bd64), _tc(0x8fb055), _tc(0xa6c461)],
  dirt: _tc(0xa98458), sand: _tc(0xe8d9a3), wet: _tc(0xcbb483), under: _tc(0xa08e66), deep: _tc(0x7d8a78),
  rock: [_tc(0x9a9890), _tc(0x86857e), _tc(0xaaa89f)], snow: _tc(0xeef2f5), cave: _tc(0x6a655d),
  wheat: _tc(0xdcc15a), crop: _tc(0x8fbf4f), soil: _tc(0x9a7048), soil2: _tc(0x85603d), lav: _tc(0xa98bd0),
};
const _tcol = new THREE.Color();
function terrainColor(x, z, hgt, ny, fr, out) {
  const wx = x + noise2(x * 0.05, z * 0.05) * 9, wz = z + noise2(z * 0.05 + 7, x * 0.05) * 9;
  const ai = areaIdxAt(wx, wz);
  const n = noise2(x * 0.045 + 2, z * 0.045 - 3) * 0.5 + 0.5;
  const pal = ai === 1 || ai === 7 ? TC.f : ai === 5 ? TC.m : ai === 10 || ai === 4 || ai === 8 ? TC.o : TC.g;
  const k = n * 2.99;
  out.copy(pal[Math.floor(k)]).lerp(pal[Math.min(3, Math.floor(k) + 1)], k % 1);
  if (fr > 0.95) out.lerp(pal[3], 0.35);
  // farmland patchwork fields
  if (ai === 3) {
    const fx = Math.floor((x + 1000) / 17), fz = Math.floor((z + 1000) / 13);
    const lx = (x + 1000) % 17, lz = (z + 1000) % 13;
    const t = hash2(fx, fz);
    if (lx > 1.2 && lz > 1.2 && lx < 15.8 && lz < 11.8) {
      if (t < 0.28) out.copy(TC.wheat).lerp(TC.soil, (Math.sin(z * 2.1) > 0.6 ? 0.25 : 0));
      else if (t < 0.52) out.copy(Math.sin(x * 1.7) > 0 ? TC.crop : _tcol.copy(TC.crop).multiplyScalar(0.85));
      else if (t < 0.72) out.copy(Math.sin(z * 1.9) > 0 ? TC.soil : TC.soil2);
      else if (t < 0.78) out.copy(TC.lav);
    }
  }
  // meadow flower sprinkles
  if (ai === 5 && fr < 0.05) out.lerp(TC.m[3], 0.8);
  // forest dirt patches
  if ((ai === 1 || ai === 7) && noise2(x * 0.11, z * 0.11) > 0.55) out.lerp(TC.dirt, 0.45);
  // quarry + cave floors
  if (Math.hypot(x - QUARRY.x, z - QUARRY.z) < 21) out.copy(TC.rock[Math.floor(fr * 3)]);
  for (const c of CAVES) if (Math.hypot(x - c.x, z - c.z) < 11.5) out.copy(TC.cave);
  // rock on steep slopes, snow high up
  const steep = smoothstep(0.84, 0.66, ny);
  if (steep > 0) out.lerp(TC.rock[Math.floor(fr * 3)], steep);
  if (hgt > 26) out.lerp(TC.snow, smoothstep(26, 34, hgt + n * 6) * (0.6 + 0.4 * ny));
  // beaches and underwater
  if (hgt < 1.15) out.lerp(TC.sand, smoothstep(1.15, 0.55, hgt));
  if (hgt < 0.1) out.copy(TC.wet);
  if (hgt < -0.9) out.copy(TC.under).lerp(TC.deep, smoothstep(-1, -5, hgt));
  out.multiplyScalar(0.965 + fr * 0.06);
  return out;
}

/* =====================================================================
   World object: height queries, masks, static blockers
   ===================================================================== */
const World = {
  N: Math.round((WORLD.HALF * 2) / WORLD.GRID), // cells per side
  H: null,
  roadFine: null, // 1-unit road mask for placement rules
  staticBlocks: [], // rects that nothing may be built on / walked through {x0,x1,z0,z1,solid}
  lanterns: [], // world lantern positions (Vector3)
  bridgesY: [],
  scene: null,

  init() {
    for (const c of CAVES) c.floor = baseHeight(c.x, c.z) - 0.5;
    QUARRY_FLOOR = baseHeight(QUARRY.x, QUARRY.z) - 5;
    const N = this.N, G = WORLD.GRID, HALF = WORLD.HALF;
    this.H = new Float32Array((N + 1) * (N + 1));
    for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) this.H[j * (N + 1) + i] = rawHeight(-HALF + i * G, -HALF + j * G);
    // bridges: deck heights from the bank at each end
    for (const b of BRIDGES) {
      const hA = Math.max(0.6, this.groundY(b.x - b.len / 2, b.z)), hB = Math.max(0.6, this.groundY(b.x + b.len / 2, b.z));
      b.hA = hA; b.hB = hB;
    }
    // fine road mask (1 unit)
    const S = HALF * 2;
    this.roadFine = new Uint8Array(S * S);
    this.roads = ROADS_RAW.map((r) => ({ w: r.w, pts: smoothPolyline(r.pts, 2) }));
    for (const r of this.roads) {
      const rad = r.w / 2 + 0.35;
      for (let i = 0; i < r.pts.length - 1; i++) {
        const [ax, az] = r.pts[i], [bx, bz] = r.pts[i + 1];
        const len = Math.hypot(bx - ax, bz - az), steps = Math.ceil(len / 0.8);
        for (let s = 0; s <= steps; s++) {
          const px = lerp(ax, bx, s / steps), pz = lerp(az, bz, s / steps);
          for (let dz = -Math.ceil(rad); dz <= Math.ceil(rad); dz++) for (let dx = -Math.ceil(rad); dx <= Math.ceil(rad); dx++) {
            const gx = Math.floor(px + dx + HALF), gz = Math.floor(pz + dz + HALF);
            if (gx < 0 || gz < 0 || gx >= S || gz >= S) continue;
            if (Math.hypot(gx + 0.5 - HALF - px, gz + 0.5 - HALF - pz) <= rad) this.roadFine[gz * S + gx] = 1;
          }
        }
      }
    }
  },
  groundY(x, z) {
    const N = this.N, G = WORLD.GRID, HALF = WORLD.HALF;
    let gx = (x + HALF) / G, gz = (z + HALF) / G;
    gx = clamp(gx, 0, N - 0.0001); gz = clamp(gz, 0, N - 0.0001);
    const i = Math.floor(gx), j = Math.floor(gz), fx = gx - i, fz = gz - j;
    const R = N + 1, H = this.H;
    const h00 = H[j * R + i], h10 = H[j * R + i + 1], h01 = H[(j + 1) * R + i], h11 = H[(j + 1) * R + i + 1];
    if (fx + fz <= 1) return h00 + (h10 - h00) * fx + (h01 - h00) * fz;
    return h11 + (h01 - h11) * (1 - fx) + (h10 - h11) * (1 - fz);
  },
  bridgeAt(x, z) {
    for (const b of BRIDGES) {
      const u = x - b.x, v = z - b.z;
      if (Math.abs(u) <= b.len / 2 && Math.abs(v) <= b.w / 2) {
        const t = (u + b.len / 2) / b.len;
        return lerp(b.hA, b.hB, t) + Math.sin(t * Math.PI) * 1.1 + 0.25;
      }
    }
    return null;
  },
  /* walkable surface height (ground, bridge deck) */
  heightAt(x, z) { const b = this.bridgeAt(x, z); const g = this.groundY(x, z); return b != null ? Math.max(b, g) : g; },
  isWater(x, z, depth = -0.25) { return this.groundY(x, z) < depth && this.bridgeAt(x, z) == null; },
  slopeAt(x, z) {
    const e = 1.2;
    return Math.max(Math.abs(this.groundY(x + e, z) - this.groundY(x - e, z)), Math.abs(this.groundY(x, z + e) - this.groundY(x, z - e))) / (2 * e);
  },
  onRoad(x, z) {
    const S = WORLD.HALF * 2, gx = Math.floor(x + WORLD.HALF), gz = Math.floor(z + WORLD.HALF);
    if (gx < 0 || gz < 0 || gx >= S || gz >= S) return false;
    return this.roadFine[gz * S + gx] === 1;
  },
  distToRoad(x, z) {
    let d = 1e9;
    for (const r of this.roads) { const v = distToPolyline(x, z, r.pts) - r.w / 2; if (v < d) d = v; }
    return d;
  },
  inPlay(x, z) { return Math.abs(x) < WORLD.PLAY && Math.abs(z) < WORLD.PLAY; },
  blockedStatic(x, z, r = 0) {
    for (const b of this.staticBlocks) if (x > b.x0 - r && x < b.x1 + r && z > b.z0 - r && z < b.z1 + r) return b;
    return null;
  },
  addBlock(x0, x1, z0, z1, solid = true, tag = '') { this.staticBlocks.push({ x0: Math.min(x0, x1), x1: Math.max(x0, x1), z0: Math.min(z0, z1), z1: Math.max(z0, z1), solid, tag }); },
  /* is there water within r of (x,z)? */
  nearWater(x, z, r) {
    for (let a = 0; a < 16; a++) {
      const ang = (a / 16) * TAU;
      for (let d = 2; d <= r; d += 2) if (this.groundY(x + Math.cos(ang) * d, z + Math.sin(ang) * d) < -0.4) return true;
    }
    return false;
  },
};

/* =====================================================================
   Terrain / water / roads meshes
   ===================================================================== */
const Mats = {};
function makeWorldMaterials() {
  Mats.terrain = patchWorldMat(new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }), { area: true });
  Mats.flat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  Mats.glow = new THREE.MeshBasicMaterial({ vertexColors: true, color: 0xffffff, toneMapped: false });
  Mats.windowGlow = new THREE.MeshBasicMaterial({ color: 0x3d4b5c, toneMapped: false });
  Mats.road = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  Mats.bld = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
}

function buildTerrain(scene) {
  const N = World.N, G = WORLD.GRID, HALF = WORLD.HALF, H = World.H, R = N + 1;
  const CH = 6, CS = N / CH;
  const col = new THREE.Color();
  const va = new THREE.Vector3(), vb = new THREE.Vector3(), vc = new THREE.Vector3(), e1 = new THREE.Vector3(), e2 = new THREE.Vector3();
  const meshes = [];
  for (let cz = 0; cz < CH; cz++) for (let cx = 0; cx < CH; cx++) {
    const tris = CS * CS * 2;
    const pos = new Float32Array(tris * 9), cols = new Float32Array(tris * 9), area = new Float32Array(tris * 3);
    let p = 0, a = 0;
    const pushTri = (A, B, Cc) => {
      e1.subVectors(B, A); e2.subVectors(Cc, A);
      const nx = e1.y * e2.z - e1.z * e2.y, ny = e1.z * e2.x - e1.x * e2.z, nz = e1.x * e2.y - e1.y * e2.x;
      const nl = Math.hypot(nx, ny, nz) || 1;
      const mx = (A.x + B.x + Cc.x) / 3, my = (A.y + B.y + Cc.y) / 3, mz = (A.z + B.z + Cc.z) / 3;
      const fr = hash2(Math.floor(mx * 3.1), Math.floor(mz * 2.7));
      terrainColor(mx, mz, my, ny / nl, fr, col);
      const ai = areaIdxAt(mx, mz);
      for (const V of [A, B, Cc]) { pos[p] = V.x; pos[p + 1] = V.y; pos[p + 2] = V.z; cols[p] = col.r; cols[p + 1] = col.g; cols[p + 2] = col.b; p += 3; area[a++] = ai; }
    };
    for (let j = cz * CS; j < (cz + 1) * CS; j++) for (let i = cx * CS; i < (cx + 1) * CS; i++) {
      const x0 = -HALF + i * G, z0 = -HALF + j * G, x1 = x0 + G, z1 = z0 + G;
      const h00 = H[j * R + i], h10 = H[j * R + i + 1], h01 = H[(j + 1) * R + i], h11 = H[(j + 1) * R + i + 1];
      va.set(x0, h00, z0); vb.set(x0, h01, z1); vc.set(x1, h10, z0); pushTri(va, vb, vc);
      va.set(x1, h10, z0); vb.set(x0, h01, z1); vc.set(x1, h11, z1); pushTri(va, vb, vc);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    g.setAttribute('aArea', new THREE.BufferAttribute(area, 1));
    g.computeVertexNormals(); g.computeBoundingSphere();
    const m = new THREE.Mesh(g, Mats.terrain);
    m.receiveShadow = true; m.matrixAutoUpdate = false; m.updateMatrix();
    scene.add(m); meshes.push(m);
  }
  World.terrainMeshes = meshes;
}

function buildWater(scene) {
  const S = WORLD.HALF * 2 + 200, seg = 110;
  const g = new THREE.PlaneGeometry(S, S, seg, seg).toNonIndexed();
  g.rotateX(-Math.PI / 2);
  const p = g.attributes.position.array;
  const cols = new Float32Array(p.length);
  const shallow = new THREE.Color(0x63c7d8), deep = new THREE.Color(0x2b6fa0), c = new THREE.Color();
  for (let i = 0; i < p.length; i += 9) {
    const mx = (p[i] + p[i + 3] + p[i + 6]) / 3, mz = (p[i + 2] + p[i + 5] + p[i + 8]) / 3;
    const depth = -World.groundY(mx, mz);
    c.copy(shallow).lerp(deep, smoothstep(0.3, 5.5, depth));
    for (let k = 0; k < 9; k += 3) { cols[i + k] = c.r; cols[i + k + 1] = c.g; cols[i + k + 2] = c.b; }
  }
  g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.28, metalness: 0.05, transparent: true, opacity: 0.84, flatShading: true });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = U.uTime;
    sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      transformed.y += sin(position.x * 0.32 + uTime * 1.25) * 0.11 + cos(position.z * 0.27 + uTime * 1.05) * 0.1 + sin((position.x + position.z) * 0.6 + uTime * 2.1) * 0.04;`);
  };
  const m = new THREE.Mesh(g, mat);
  m.position.y = WORLD.WATER - 0.05;
  m.receiveShadow = false; m.renderOrder = 1;
  scene.add(m);
  World.waterMesh = m;
}

function buildRoads(scene) {
  const P = [], Cc = [];
  const cMid = new THREE.Color(0xb89363), cEdge = new THREE.Color(0x9f7a4e), c1 = new THREE.Color(), c2 = new THREE.Color();
  for (const r of World.roads) {
    const pts = r.pts;
    const L = [], Rr = [], M = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
      let dx = b[0] - a[0], dz = b[1] - a[1]; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
      const w = r.w / 2 * (1 + 0.12 * noise2(pts[i][0] * 0.3, pts[i][1] * 0.3));
      const x = pts[i][0], z = pts[i][1];
      const lx = x - dz * w, lz = z + dx * w, rx = x + dz * w, rz = z - dx * w;
      L.push([lx, World.groundY(lx, lz) + 0.09, lz]); Rr.push([rx, World.groundY(rx, rz) + 0.09, rz]); M.push([x, World.groundY(x, z) + 0.1, z]);
    }
    for (let i = 0; i < pts.length - 1; i++) {
      const [x, z] = pts[i];
      if (World.bridgeAt(x, z) != null || World.bridgeAt(pts[i + 1][0], pts[i + 1][1]) != null) continue;
      if (World.groundY(x, z) < -0.3) continue;
      const v = 0.94 + hash2(Math.floor(x * 2), Math.floor(z * 2)) * 0.1;
      c1.copy(cMid).multiplyScalar(v); c2.copy(cEdge).multiplyScalar(v);
      const quad = (A, B, C, D, ca, cb) => {
        for (const [V, cc] of [[A, ca], [B, cb], [C, ca], [C, ca], [B, cb], [D, cb]]) { P.push(...V); Cc.push(cc.r, cc.g, cc.b); }
      };
      // left strip then right strip (winding chosen so faces point up)
      quad(M[i], L[i], M[i + 1], L[i + 1], c1, c2);
      quad(Rr[i], M[i], Rr[i + 1], M[i + 1], c2, c1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(Cc, 3));
  g.computeVertexNormals();
  // make sure every triangle faces up
  const p = g.attributes.position.array, n = g.attributes.normal.array;
  for (let i = 0; i < p.length; i += 9) {
    if (n[i + 1] < 0) {
      for (let k = 0; k < 3; k++) { const t = p[i + 3 + k]; p[i + 3 + k] = p[i + 6 + k]; p[i + 6 + k] = t; }
    }
  }
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, Mats.road);
  m.receiveShadow = true;
  scene.add(m);
}

/* =====================================================================
   Static props: bridges, caves, quarry, cart, board, garden, ruins...
   ===================================================================== */
const Props = { caveShells: [], interact: [] };
function buildProps(scene) {
  const g = new GB();
  const wood = 0x9c6b3f, dark = 0x6e4a2b, stone = 0xa6a49b, stoneD = 0x8a887f;
  // --- bridges (arched wooden) ---
  for (const b of BRIDGES) {
    const n = Math.ceil(b.len / 1.1);
    for (let i = 0; i <= n; i++) {
      const u = -b.len / 2 + (i / n) * b.len, x = b.x + u;
      const y = World.bridgeAt(x, b.z) - 0.25;
      g.box(1.0, 0.22, b.w, i % 2 ? wood : 0xa7764a, x, y, b.z, 0, 0, 0);
      if (i % 3 === 0) {
        for (const s of [-1, 1]) {
          g.boxB(0.22, 1.2, 0.22, dark, x, y, b.z + s * (b.w / 2 - 0.1));
          if (i > 0 && i < n) g.cylC(0.25, 0.3, 4, 6, dark, x, y - 1.8, b.z + s * (b.w / 2 - 0.4));
        }
      }
    }
    // rails
    for (const s of [-1, 1]) {
      for (let i = 0; i < n; i++) {
        const xa = b.x - b.len / 2 + (i / n) * b.len, xb = b.x - b.len / 2 + ((i + 1) / n) * b.len;
        const ya = World.bridgeAt(xa + 0.01, b.z) + 0.85, yb = World.bridgeAt(xb - 0.01, b.z) + 0.85;
        const len = Math.hypot(xb - xa, yb - ya);
        g.box(len + 0.05, 0.14, 0.16, 0xb07f50, (xa + xb) / 2, (ya + yb) / 2, b.z + s * (b.w / 2 - 0.1), 0, 0, Math.atan2(yb - ya, xb - xa));
      }
    }
  }
  // --- quarry: scaffolding, cut blocks, crane ---
  {
    const q = QUARRY, y = World.groundY(q.x + 19, q.z);
    g.push(q.x + 19, y, q.z - 4, -Math.PI / 2);
    for (const [px, pz] of [[-2, -2], [2, -2], [-2, 2], [2, 2]]) g.boxB(0.3, 5, 0.3, dark, px, 0, pz);
    g.boxB(4.6, 0.25, 4.6, wood, 0, 2.5, 0).boxB(4.6, 0.25, 4.6, wood, 0, 5, 0);
    g.boxB(0.35, 7.5, 0.35, dark, 0, 5, 0).box(7, 0.3, 0.3, dark, 2.5, 12.3, 0).box(0.06, 5, 0.06, 0x333333, 5.8, 9.8, 0);
    g.boxB(1, 0.8, 1, stone, 5.8, 6.6, 0);
    g.pop();
    for (let i = 0; i < 9; i++) {
      const a = i * 0.7, r = 7 + (i % 3) * 3;
      const x = q.x + Math.cos(a) * r, z = q.z + Math.sin(a) * r;
      g.boxB(1.2 + (i % 2) * 0.6, 0.9, 1.1, i % 2 ? stone : stoneD, x, World.groundY(x, z) - 0.1, z, a);
    }
  }
  // --- caves: rock mound decoration + glowing crystals inside ---
  for (const c of CAVES) {
    const y = c.floor;
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * TAU; const dx = Math.cos(a), dz = Math.sin(a);
      if (dx * c.dx + dz * c.dz > 0.75) continue;
      const r = 13 + (i % 3) * 2.5, x = c.x + dx * r, z = c.z + dz * r;
      g.dodec(1.6 + (i % 4) * 0.5, i % 2 ? 0x8b8a84 : 0x77766f, x, World.groundY(x, z) + 0.5, z, 1.2, 0.9, 1.1, 0.35, a);
    }
    // entrance frame
    const ex = c.x + c.dx * 11.2, ez = c.z + c.dz * 11.2, ry = Math.atan2(c.dx, c.dz);
    g.push(ex, y, ez, ry);
    g.boxB(0.5, 5.2, 0.5, dark, -2.6, 0, 0).boxB(0.5, 5.2, 0.5, dark, 2.6, 0, 0).box(6.2, 0.55, 0.6, dark, 0, 5.3, 0);
    g.glowBox(0.25, 0.4, 0.25, 0xffc766, -2.6, 4.2, 0.4).glowBox(0.25, 0.4, 0.25, 0xffc766, 2.6, 4.2, 0.4);
    g.light(-2.6, 4.2, 0.6); g.light(2.6, 4.2, 0.6);
    g.pop();
    const crystalCol = c.id === 'crystal_cave' ? 0x7fe3ff : 0xffb36b;
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * TAU + 0.3, r = 8.5 + (i % 2);
      const x = c.x + Math.cos(a) * r, z = c.z + Math.sin(a) * r;
      if (Math.cos(a) * c.dx + Math.sin(a) * c.dz > 0.7) continue;
      g._add(new THREE.OctahedronGeometry(0.5 + (i % 3) * 0.2, 0), crystalCol, g._m(x, y + 0.6, z, a, 0.3 * (i % 3 - 1), 0.2, 1, 2.2, 1), 'glow');
    }
    // dome shell (separate mesh so it can fade when the player is inside)
    const sg = new THREE.SphereGeometry(12.2, 12, 6, 0, TAU, 0, Math.PI / 2).toNonIndexed();
    const sp = sg.attributes.position.array, keep = [], kc = [];
    const cc = new THREE.Color();
    for (let i = 0; i < sp.length; i += 9) {
      const mx = (sp[i] + sp[i + 3] + sp[i + 6]) / 3, my = (sp[i + 1] + sp[i + 4] + sp[i + 7]) / 3, mz = (sp[i + 2] + sp[i + 5] + sp[i + 8]) / 3;
      const dl = Math.hypot(mx, mz) || 1;
      if ((mx / dl) * c.dx + (mz / dl) * c.dz > 0.8 && my < 6.5) continue; // entrance hole
      for (let k = 0; k < 9; k += 3) {
        const X = sp[i + k], Y = sp[i + k + 1], Z = sp[i + k + 2];
        const j = 1 + (hash2(Math.round(X * 10), Math.round(Z * 10 + Y * 7)) - 0.5) * 0.18;
        keep.push(X * j, Y * 0.72 * j, Z * j);
      }
      cc.set(0x8a877f).multiplyScalar(0.85 + hash2(i, 7) * 0.25);
      for (let k = 0; k < 3; k++) kc.push(cc.r, cc.g, cc.b);
    }
    const shell = new THREE.BufferGeometry();
    shell.setAttribute('position', new THREE.Float32BufferAttribute(keep, 3));
    shell.setAttribute('color', new THREE.Float32BufferAttribute(kc, 3));
    shell.computeVertexNormals();
    const sm = new THREE.Mesh(shell, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, side: THREE.DoubleSide, transparent: true, opacity: 1 }));
    sm.position.set(c.x, y - 0.4, c.z);
    sm.castShadow = true; sm.receiveShadow = true;
    scene.add(sm);
    Props.caveShells.push({ mesh: sm, cave: c, fade: 1 });
  }
  // --- starting glade: home garden fence, trading cart, notice board, sign, lanterns ---
  {
    const hx = START.home.x, hz = START.home.z;
    const x0 = hx - 8.5, x1 = hx + 5.2, z0 = hz - 7.2, z1 = hz + 7.2;
    const fence = (ax, az, bx, bz) => {
      const len = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.round(len / 1.6)), ry = Math.atan2(bx - ax, bz - az);
      for (let i = 0; i <= n; i++) { const x = lerp(ax, bx, i / n), z = lerp(az, bz, i / n); g.boxB(0.18, 1.0, 0.18, 0xe9dcc3, x, World.groundY(x, z) - 0.1, z); }
      for (let i = 0; i < n; i++) {
        const xa = lerp(ax, bx, i / n), za = lerp(az, bz, i / n), xb = lerp(ax, bx, (i + 1) / n), zb = lerp(az, bz, (i + 1) / n);
        const y = (World.groundY(xa, za) + World.groundY(xb, zb)) / 2;
        for (const hy of [0.45, 0.8]) g.box(0.08, 0.1, len / n, 0xe9dcc3, (xa + xb) / 2, y + hy, (za + zb) / 2, ry);
      }
      World.addBlock(Math.min(ax, bx) - 0.2, Math.max(ax, bx) + 0.2, Math.min(az, bz) - 0.2, Math.max(az, bz) + 0.2, true, 'fence');
    };
    fence(x0, z0, x1, z0); fence(x0, z1, x1, z1); fence(x0, z0, x0, z1);
    fence(x1, z0, x1, hz - 1.8); fence(x1, hz + 1.8, x1, z1);
    // vegetable patch behind the house
    for (let r = 0; r < 4; r++) {
      const x = x0 + 1.6 + r * 0.95;
      g.boxB(0.7, 0.18, 9, 0x8a6240, x, World.groundY(x, hz) - 0.05, hz);
      for (let k = 0; k < 7; k++) g.ico(0.22, r % 2 ? 0x6fae47 : 0xe07b39, x, World.groundY(x, hz) + 0.32, hz - 3.8 + k * 1.25, 1, 0.8, 1, 0, 0.3);
    }
    // flower rows along the front fence
    for (let k = 0; k < 9; k++) {
      const z = z0 + 1 + k * 1.5; if (Math.abs(z - hz) < 2) continue;
      g.ico(0.28, [0xf28bb0, 0xffd166, 0xffffff, 0xb28dff][k % 4], x1 - 0.8, World.groundY(x1 - 0.8, z) + 0.3, z, 1, 0.8, 1, 0, 0.3);
    }
    // stepping stones from gate to road
    for (let k = 0; k < 5; k++) { const x = x1 + 0.8 + k * 1.6; g.boxB(0.9, 0.12, 0.8, 0xc9c3b3, x, World.groundY(x, hz) - 0.02, hz + (k % 2) * 0.3 - 0.15); }
    // trading cart
    const [cx, cz] = START.cart;
    g.push(cx, World.groundY(cx, cz), cz, -Math.PI / 2);
    g.boxB(3.2, 0.9, 1.9, 0xa7764a, 0, 0.7, 0).boxB(3.4, 0.15, 2.1, dark, 0, 0.6, 0);
    for (const s of [-1, 1]) g.cylC(0.6, 0.6, 0.18, 10, dark, -0.6, 0.6, s * 1.1, Math.PI / 2);
    g.box(0.12, 0.12, 2.6, dark, 2.6, 0.75, 0.5, 0.15).box(0.12, 0.12, 2.6, dark, 2.6, 0.75, -0.5, -0.15);
    for (const [px, pz] of [[-1.5, -0.9], [1.5, -0.9], [-1.5, 0.9], [1.5, 0.9]]) g.boxB(0.12, 1.8, 0.12, dark, px, 1.6, pz);
    g.roof(2.6, 3.6, 0.8, 0xd8584a, 0, 3.4, 0, Math.PI / 2, 0xf2e6cf);
    g.boxB(0.7, 0.6, 0.7, 0xc98f4c, -0.8, 1.6, 0.2).ico(0.35, 0xd9483b, 0.6, 1.9, -0.3, 1, 1, 1, 0, 0.2);
    g.cyl(0.35, 0.35, 0.7, 8, 0x8a5a33, 0.9, 1.6, 0.4);
    g.pop();
    World.addBlock(cx - 1.3, cx + 1.3, cz - 2, cz + 2.8, true, 'cart');
    Props.interact.push({ kind: 'cart', x: cx, z: cz, r: 3.6, y: 2.4 });
    // notice board
    const [bx, bz] = START.board;
    g.push(bx, World.groundY(bx, bz), bz, Math.PI / 4);
    g.boxB(0.2, 2.4, 0.2, dark, -1, 0, 0).boxB(0.2, 2.4, 0.2, dark, 1, 0, 0).boxB(2.4, 1.3, 0.14, 0xa7764a, 0, 1.0, 0);
    g.boxB(0.6, 0.45, 0.02, 0xf5ecd7, -0.5, 1.5, 0.08).boxB(0.5, 0.55, 0.02, 0xf5ecd7, 0.4, 1.3, 0.08).boxB(0.4, 0.3, 0.02, 0xffe29a, 0.1, 1.85, 0.08);
    g.roof(0.9, 2.8, 0.45, 0x7a4a2c, 0, 2.35, 0, Math.PI / 2);
    g.pop();
    World.addBlock(bx - 1, bx + 1, bz - 1, bz + 1, true, 'board');
    Props.interact.push({ kind: 'board', x: bx, z: bz, r: 3, y: 2.6 });
    // welcome sign at the south entrance
    const [sx, sz] = START.sign;
    g.push(sx, World.groundY(sx, sz), sz, 0);
    g.boxB(0.22, 2.6, 0.22, dark, -1.4, 0, 0).boxB(0.22, 2.6, 0.22, dark, 1.4, 0, 0).boxB(3.4, 0.9, 0.16, 0xc99a5b, 0, 1.5, 0);
    g.ico(0.3, 0xf28bb0, -1.4, 2.7, 0, 1, 1, 1, 0, 0.2).ico(0.3, 0xffd166, 1.4, 2.7, 0, 1, 1, 1, 0, 0.2);
    g.pop();
    World.addBlock(sx - 1.7, sx + 1.7, sz - 0.4, sz + 0.4, true, 'sign');
    Props.welcomeSign = { x: sx, z: sz };
    // road lanterns in the glade
    const lampSpots = [[3.6, -13], [-3.6, -28], [3.6, 16], [-3.6, 28], [14, 3.4], [28, -3.3], [-14, 3.8], [-30, 3.2], [3.6, -3.6]];
    for (const [lx, lz] of lampSpots) {
      const y = World.groundY(lx, lz);
      g.boxB(0.3, 0.3, 0.3, 0x5c5c5c, lx, y - 0.1, lz).boxB(0.14, 2.6, 0.14, 0x3b3530, lx, y, lz).boxB(0.5, 0.12, 0.5, 0x3b3530, lx, y + 2.6, lz);
      g.glowBox(0.34, 0.42, 0.34, 0xffd27a, lx, y + 2.93, lz);
      g.pyr(0.56, 0.56, 0.3, 0x3b3530, lx, y + 3.15, lz);
      World.lanterns.push(new THREE.Vector3(lx, y + 2.95, lz));
      World.addBlock(lx - 0.25, lx + 0.25, lz - 0.25, lz + 0.25, true, 'lamp');
    }
  }
  // --- forest campfire + logs ---
  {
    const x = 18, z = -64, y = World.groundY(x, z);
    for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU; g.dodec(0.35, 0x8a887f, x + Math.cos(a) * 0.9, y + 0.1, z + Math.sin(a) * 0.9, 1, 0.7, 1); }
    g.cylC(0.12, 0.12, 1.2, 5, dark, x, y + 0.2, z, 0, 0.6, Math.PI / 2.4).cylC(0.12, 0.12, 1.2, 5, dark, x, y + 0.2, z, 0, -0.9, Math.PI / 2.4);
    g.glowBox(0.35, 0.5, 0.35, 0xff9a3c, x, y + 0.45, z, 0.5);
    g.fire(x, y + 0.5, z);
    for (const a of [0.4, 2.3, 4.2]) g.cylC(0.35, 0.35, 2.6, 7, 0x7a5230, x + Math.cos(a) * 3, World.groundY(x + Math.cos(a) * 3, z + Math.sin(a) * 3) + 0.35, z + Math.sin(a) * 3, 0, a + Math.PI / 2, Math.PI / 2);
  }
  // --- meadow standing stones ---
  {
    const x = -112, z = 24;
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * TAU, px = x + Math.cos(a) * 7, pz = z + Math.sin(a) * 7;
      g.boxB(1.2, 3 + (i % 3) * 0.8, 0.8, 0x9d9b93, px, World.groundY(px, pz) - 0.3, pz, a);
      World.addBlock(px - 0.7, px + 0.7, pz - 0.7, pz + 0.7, true, 'stone');
    }
  }
  // --- old kingdom ruins in the south hills ---
  {
    const x = -150, z = 150;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU, px = x + Math.cos(a) * 9, pz = z + Math.sin(a) * 9;
      const hgt = 2 + hash2(i, 3) * 4;
      g.boxB(1.4, hgt, 1.4, i % 2 ? stone : stoneD, px, World.groundY(px, pz) - 0.3, pz, a);
      if (i % 2 === 0) g.box(4.2, 0.8, 1.2, stone, px + Math.cos(a + 1.2) * 1.5, World.groundY(px, pz) + hgt + 0.1, pz + Math.sin(a + 1.2) * 1.5, -a);
      World.addBlock(px - 0.8, px + 0.8, pz - 0.8, pz + 0.8, true, 'ruin');
    }
    g.boxB(5, 0.4, 5, 0xb9b4a6, x, World.groundY(x, z) - 0.2, z);
  }
  // --- lighthouse ruin + old pier on the coast ---
  {
    const z = -40, x = coastX(z) - 7, y = World.groundY(x, z);
    g.cyl(1.9, 2.3, 9, 8, 0xf1ece2, x, y - 0.5, z).cyl(1.95, 1.95, 1.5, 8, 0xc9493d, x, y + 3, z).cyl(1.6, 1.8, 1.2, 8, 0xc9493d, x, y + 8.5, z);
    g.glowBox(1.4, 1.2, 1.4, 0xfff1b8, x, y + 10.3, z).cone(1.9, 1.6, 8, 0xc9493d, x, y + 10.9, z);
    g.light(x, y + 10.3, z);
    World.addBlock(x - 2.3, x + 2.3, z - 2.3, z + 2.3, true, 'lighthouse');
    const pz = 42, px0 = coastX(pz) - 10;
    for (let i = 0; i < 12; i++) {
      const px = px0 + i * 1.3;
      g.boxB(1.2, 0.18, 3.2, i % 2 ? wood : 0xa7764a, px, 1.0, pz);
      if (i % 3 === 0) for (const s of [-1, 1]) g.cyl(0.18, 0.2, 4, 5, dark, px, -2.8, pz + s * 1.5);
    }
  }
  // --- lake: rowboat + little pier ---
  {
    const x = 72, z = 100;
    g.push(x, 0.1, z, 0.6);
    g.boxB(1.4, 0.35, 3.4, 0x9c6b3f, 0, 0, 0).boxB(1.1, 0.12, 3.0, 0x7a5230, 0, 0.3, 0).box(0.1, 0.1, 1.8, 0xd9c8a4, 0.9, 0.5, 0, 0.3);
    g.pop();
  }
  // --- deep woods: the ancient tree ---
  {
    const x = 10, z = -165, y = World.groundY(x, z);
    g.cyl(1.3, 2.2, 9, 8, 0x6b4a2e, x, y - 0.5, z);
    for (let i = 0; i < 5; i++) { const a = (i / 5) * TAU; g.cylC(0.35, 0.6, 3.4, 5, 0x6b4a2e, x + Math.cos(a) * 2.2, y + 0.4, z + Math.sin(a) * 2.2, Math.cos(a) * 1.1, 0, -Math.sin(a) * 1.1); }
    g.ico(6, 0x3f7d3f, x, y + 12, z, 1, 0.8, 1, 1, 0.25).ico(4.5, 0x4f9147, x + 3.5, y + 14, z + 2, 1, 0.8, 1, 1, 0.25).ico(4.2, 0x356f37, x - 3.5, y + 13, z - 2, 1, 0.8, 1, 1, 0.25);
    World.addBlock(x - 2.5, x + 2.5, z - 2.5, z + 2.5, true, 'bigtree');
  }
  // --- farmland: hay bales + scarecrows ---
  for (let i = 0; i < 16; i++) {
    const x = -110 + hash2(i, 1) * 140, z = 48 + hash2(i, 2) * 66;
    if (World.onRoad(x, z) || World.distToRoad(x, z) < 3) continue;
    const y = World.groundY(x, z);
    if (i % 4 === 0) {
      g.boxB(0.12, 1.9, 0.12, dark, x, y, z).box(1.4, 0.12, 0.12, dark, x, y + 1.45, z).boxB(0.5, 0.7, 0.35, 0x5b8fb9, x, y + 0.95, z).boxB(0.38, 0.38, 0.38, 0xe9c98f, x, y + 1.7, z).cyl(0.55, 0.55, 0.06, 8, 0xe2c35a, x, y + 2.05, z).cone(0.3, 0.3, 8, 0xe2c35a, x, y + 2.08, z);
    } else {
      g.cylC(0.7, 0.7, 1.2, 10, 0xe2c35a, x, y + 0.6, z, 0, i, Math.PI / 2);
    }
    World.addBlock(x - 0.8, x + 0.8, z - 0.8, z + 0.8, true, 'hay');
  }
  const built = g.build();
  const main = new THREE.Mesh(built.main, Mats.flat); main.castShadow = true; main.receiveShadow = true; scene.add(main);
  if (built.glow) { const gm = new THREE.Mesh(built.glow, Mats.glow); scene.add(gm); }
  for (const L of built.lights) World.lanterns.push(L);
  Props.fires = built.fires;
}

/* =====================================================================
   Chunked instancing (decor + resource nodes). One InstancedMesh per
   type per 80x80 chunk so frustum culling and distance LOD work.
   ===================================================================== */
const _cm = new THREE.Matrix4(), _cq = new THREE.Quaternion(), _cv = new THREE.Vector3(), _cs = new THREE.Vector3(), _cy = new THREE.Vector3(0, 1, 0);
function composeM(x, y, z, ry, s, sy = s, out = _cm) { _cq.setFromAxisAngle(_cy, ry); return out.compose(_cv.set(x, y, z), _cq, _cs.set(s, sy, s)); }
class ChunkedInstances {
  constructor(geo, mat, opts = {}) { this.geo = geo; this.mat = mat; this.opts = opts; this.chunks = new Map(); this.meshes = []; }
  add(x, y, z, ry, s, sy = s) {
    const cx = Math.floor((x + WORLD.HALF) / 80), cz = Math.floor((z + WORLD.HALF) / 80), key = cz * 16 + cx;
    let c = this.chunks.get(key);
    if (!c) { c = { items: [], mesh: null, x: -WORLD.HALF + cx * 80 + 40, z: -WORLD.HALF + cz * 80 + 40 }; this.chunks.set(key, c); }
    c.items.push({ x, y, z, ry, s, sy, area: areaIdxAt(x, z), hidden: false });
    return { c, i: c.items.length - 1 };
  }
  finalize(scene) {
    for (const c of this.chunks.values()) {
      const n = c.items.length;
      const g = new THREE.BufferGeometry();
      for (const k in this.geo.attributes) g.setAttribute(k, this.geo.attributes[k]);
      g.boundingSphere = this.geo.boundingSphere || (this.geo.computeBoundingSphere(), this.geo.boundingSphere);
      const aA = new Float32Array(n);
      c.items.forEach((it, i) => { aA[i] = it.area; });
      g.setAttribute('aArea', new THREE.InstancedBufferAttribute(aA, 1));
      const m = new THREE.InstancedMesh(g, this.mat, n);
      c.items.forEach((it, i) => m.setMatrixAt(i, composeM(it.x, it.y, it.z, it.ry, it.s, it.sy)));
      m.castShadow = !!this.opts.cast; m.receiveShadow = !!this.opts.receive;
      m.computeBoundingSphere();
      m.matrixAutoUpdate = false; m.updateMatrix();
      c.mesh = m; scene.add(m); this.meshes.push(m);
    }
  }
  set(handle, x, y, z, ry, s, sy = s) { const m = handle.c.mesh; m.setMatrixAt(handle.i, composeM(x, y, z, ry, s, sy)); m.instanceMatrix.needsUpdate = true; }
  lod(camX, camZ, dist) {
    for (const c of this.chunks.values()) if (c.mesh) c.mesh.visible = Math.hypot(c.x - camX, c.z - camZ) < dist + 57;
  }
  dispose(scene) { for (const m of this.meshes) { scene.remove(m); m.dispose(); } this.meshes = []; this.chunks.clear(); }
  /* hide instances inside rects (buildings), show the rest */
  refreshHidden(rects, only = null) {
    const hit = (r, x0, x1, z0, z1) => r.x1 > x0 && r.x0 < x1 && r.z1 > z0 && r.z0 < z1;
    for (const c of this.chunks.values()) {
      if (!c.mesh) continue;
      const bx0 = c.x - 41, bx1 = c.x + 41, bz0 = c.z - 41, bz1 = c.z + 41;
      if (only && !hit(only, bx0 - 2, bx1 + 2, bz0 - 2, bz1 + 2)) continue;
      const local = rects.filter((r) => hit(r, bx0 - 1, bx1 + 1, bz0 - 1, bz1 + 1));
      let dirty = false;
      for (let i = 0; i < c.items.length; i++) {
        const it = c.items[i];
        let hid = false;
        for (const r of local) if (it.x > r.x0 - 0.4 && it.x < r.x1 + 0.4 && it.z > r.z0 - 0.4 && it.z < r.z1 + 0.4) { hid = true; break; }
        if (hid !== it.hidden) { it.hidden = hid; c.mesh.setMatrixAt(i, composeM(it.x, it.y, it.z, it.ry, hid ? 0 : it.s, hid ? 0 : it.sy)); dirty = true; }
      }
      if (dirty) c.mesh.instanceMatrix.needsUpdate = true;
    }
  }
}

/* =====================================================================
   Decorations: grass, flowers, bushes, reeds, lily pads, mushrooms...
   ===================================================================== */
const Decor = {
  sets: {}, small: [],
  geos() {
    const G = {};
    let g = new GB();
    for (let i = 0; i < 4; i++) { const a = i * 1.7; g._add(new THREE.ConeGeometry(0.07, 0.62, 3), [0x7fb04a, 0x8fc056, 0x6c9e3e, 0x98c55a][i], g._m(Math.cos(a) * 0.12, 0.28, Math.sin(a) * 0.12, a, Math.cos(a) * 0.25, Math.sin(a) * 0.25)); }
    G.grass = g.build().main;
    g = new GB();
    for (let i = 0; i < 4; i++) { const a = i * 1.7; g._add(new THREE.ConeGeometry(0.07, 0.8, 3), [0xc2cf6a, 0xb3c85f, 0xd1d67a, 0xa9c15a][i], g._m(Math.cos(a) * 0.12, 0.36, Math.sin(a) * 0.12, a, Math.cos(a) * 0.3, Math.sin(a) * 0.3)); }
    G.grass2 = g.build().main;
    const flower = (col) => {
      const f = new GB();
      for (let i = 0; i < 3; i++) {
        const a = i * 2.1, x = Math.cos(a) * 0.22, z = Math.sin(a) * 0.22, hh = 0.35 + i * 0.08;
        f.box(0.04, hh, 0.04, 0x5d9a3a, x, hh / 2, z);
        f._add(new THREE.OctahedronGeometry(0.11, 0), col, f._m(x, hh + 0.04, z, a, 0, 0, 1.2, 0.6, 1.2));
        f._add(new THREE.OctahedronGeometry(0.05, 0), 0xffe070, f._m(x, hh + 0.09, z));
      }
      return f.build().main;
    };
    G.flower_r = flower(0xe8505b); G.flower_y = flower(0xffd166); G.flower_w = flower(0xf7f3ea); G.flower_p = flower(0xf28bb0); G.flower_b = flower(0x8aa6ff);
    g = new GB(); g.ico(0.75, 0x5e9a3e, 0, 0.5, 0, 1, 0.8, 1, 0, 0.3).ico(0.55, 0x6fae47, 0.5, 0.45, 0.2, 1, 0.8, 1, 0, 0.3).ico(0.5, 0x528c38, -0.4, 0.4, -0.25, 1, 0.8, 1, 0, 0.3);
    G.bush = g.build().main;
    g = new GB(); g.cyl(0.07, 0.09, 0.3, 5, 0xf1e6d2, 0, 0, 0).cone(0.24, 0.2, 6, 0xd9483b, 0, 0.28, 0).cyl(0.05, 0.06, 0.2, 5, 0xf1e6d2, 0.25, 0, 0.1).cone(0.14, 0.13, 6, 0xc9a26b, 0.25, 0.19, 0.1);
    G.mush = g.build().main;
    g = new GB();
    for (let i = 0; i < 6; i++) { const a = i * 1.1, r = 0.12 + (i % 3) * 0.1, hh = 1.1 + (i % 3) * 0.35; g.cyl(0.03, 0.045, hh, 4, 0x6f9a45, Math.cos(a) * r, 0, Math.sin(a) * r); if (i % 2) g.cyl(0.07, 0.07, 0.3, 5, 0x7a5230, Math.cos(a) * r, hh - 0.2, Math.sin(a) * r); }
    G.reed = g.build().main;
    g = new GB(); g.cyl(0.55, 0.55, 0.04, 8, 0x4f9a4a, 0, 0, 0); g.ico(0.12, 0xf7c6d9, 0.15, 0.08, 0.1, 1, 0.7, 1, 0, 0.2);
    G.lily = g.build().main;
    g = new GB(); g.dodec(0.3, 0x9a9890, 0, 0.08, 0, 1.3, 0.6, 1, 0.3).dodec(0.18, 0x86857e, 0.35, 0.05, 0.1, 1, 0.6, 1, 0.3);
    G.pebble = g.build().main;
    g = new GB();
    for (let i = 0; i < 5; i++) { const a = (i / 5) * TAU; g._add(new THREE.ConeGeometry(0.16, 0.9, 3), 0x3f8a3f, g._m(Math.cos(a) * 0.25, 0.3, Math.sin(a) * 0.25, a, Math.cos(a) * 0.9, Math.sin(a) * 0.9)); }
    G.fern = g.build().main;
    return G;
  },
  build(scene, density = 1) {
    this.dispose(scene);
    const G = this._geos || (this._geos = this.geos());
    const matWind = patchWorldMat(new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }), { wind: 0.22, area: true });
    const matBush = patchWorldMat(new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }), { wind: 0.05, area: true });
    const matStatic = patchWorldMat(new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }), { area: true });
    const S = {};
    for (const k of ['grass', 'grass2', 'flower_r', 'flower_y', 'flower_w', 'flower_p', 'flower_b', 'reed', 'fern']) S[k] = new ChunkedInstances(G[k], matWind);
    S.bush = new ChunkedInstances(G.bush, matBush, { cast: true, receive: true });
    S.mush = new ChunkedInstances(G.mush, matStatic);
    S.lily = new ChunkedInstances(G.lily, matStatic);
    S.pebble = new ChunkedInstances(G.pebble, matStatic);
    const rng = mulberry32(4242);
    const flowers = ['flower_r', 'flower_y', 'flower_w', 'flower_p', 'flower_b'];
    const step = 2.3 / Math.sqrt(Math.max(0.25, density));
    for (let z = -WORLD.PLAY - 20; z < WORLD.PLAY + 20; z += step) for (let x = -WORLD.PLAY - 20; x < WORLD.PLAY + 20; x += step) {
      const px = x + (rng() - 0.5) * step, pz = z + (rng() - 0.5) * step;
      const y = World.groundY(px, pz);
      const r = rng();
      const ai = areaIdxAt(px, pz);
      // water plants
      if (y < -0.2) {
        if (y > -2.4 && y < -0.6 && r < 0.035 && World.bridgeAt(px, pz) == null) S.lily.add(px, 0.02, pz, rng() * TAU, 0.7 + rng() * 0.6);
        continue;
      }
      if (y < 0.9 && r < 0.16 && World.nearWater(px, pz, 4)) { S.reed.add(px, y - 0.1, pz, rng() * TAU, 0.8 + rng() * 0.5); continue; }
      if (World.onRoad(px, pz) || World.blockedStatic(px, pz, 0.3)) continue;
      const slope = World.slopeAt(px, pz);
      if (slope > 0.9 || y > 30) { if (r < 0.03) S.pebble.add(px, y, pz, rng() * TAU, 1 + rng()); continue; }
      const forest = ai === 1 || ai === 7;
      const meadow = ai === 5;
      const n = noise2(px * 0.08 + 3, pz * 0.08);
      if (ai === 3 && hash2(Math.floor((px + 1000) / 17), Math.floor((pz + 1000) / 13)) < 0.78) { if (r < 0.1) S.grass.add(px, y, pz, rng() * TAU, 0.8 + rng() * 0.4); continue; }
      if (meadow && r < 0.3) { S[flowers[Math.floor(rng() * 5)]].add(px, y, pz, rng() * TAU, 0.9 + rng() * 0.5); continue; }
      if (r < 0.05 + (n > 0.3 ? 0.08 : 0)) { S[flowers[Math.floor(rng() * 5)]].add(px, y, pz, rng() * TAU, 0.8 + rng() * 0.5); continue; }
      if (forest && r < 0.16) { S.fern.add(px, y, pz, rng() * TAU, 0.8 + rng() * 0.6); continue; }
      if (forest && r < 0.19) { S.mush.add(px, y, pz, rng() * TAU, 0.8 + rng() * 0.8); continue; }
      if (r < 0.215) { S.bush.add(px, y - 0.1, pz, rng() * TAU, 0.7 + rng() * 0.6); continue; }
      if (r < 0.23) { S.pebble.add(px, y, pz, rng() * TAU, 0.8 + rng()); continue; }
      if (r < 0.62) (ai === 10 || ai === 4 || ai === 8 || meadow || n > 0.4 ? S.grass2 : S.grass).add(px, y - 0.05, pz, rng() * TAU, 0.7 + rng() * 0.7);
    }
    for (const k in S) S[k].finalize(scene);
    this.sets = S;
    this.small = [S.grass, S.grass2, S.flower_r, S.flower_y, S.flower_w, S.flower_p, S.flower_b, S.mush, S.pebble, S.fern, S.reed, S.lily];
  },
  dispose(scene) { for (const k in this.sets) this.sets[k].dispose(scene); this.sets = {}; this.small = []; },
  lod(camX, camZ, dist) { for (const s of this.small) s.lod(camX, camZ, dist); if (this.sets.bush) this.sets.bush.lod(camX, camZ, dist * 1.6); },
  refreshHidden(rects, only = null) { for (const k in this.sets) this.sets[k].refreshHidden(rects, only); },
};

/* =====================================================================
   Locked area barriers + For Sale signs
   ===================================================================== */
const Barriers = {
  group: null, segs: [], signs: [],
  mat: null,
  init(scene) {
    this.group = new THREE.Group(); scene.add(this.group);
    this.mat = new THREE.ShaderMaterial({
      uniforms: { uTime: U.uTime },
      vertexShader: `attribute vec3 color; varying vec3 vCol; varying vec2 vUv; void main(){ vCol = color; vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `uniform float uTime; varying vec3 vCol; varying vec2 vUv; void main(){
        float a = pow(1.0 - vUv.y, 1.6) * 0.5;
        a *= 0.75 + 0.25 * sin(uTime * 2.0 + vUv.x * 60.0);
        float band = smoothstep(0.0, 0.04, abs(fract(vUv.y * 3.0 - uTime * 0.25) - 0.5) - 0.44);
        a += band * 0.12 * (1.0 - vUv.y);
        gl_FragColor = vec4(mix(vCol, vec3(1.0), 0.35), a);
      }`,
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
    });
  },
  cellUnlocked(cx, cz) {
    if (cx < -2 || cx > 2 || cz < -2 || cz > 2) return false;
    const idx = CELL_AREA[(cz + 2) * 5 + (cx + 2)];
    return Village.isUnlockedIdx(idx);
  },
  rebuild() {
    for (const s of this.segs) { this.group.remove(s.mesh); s.mesh.geometry.dispose(); }
    for (const s of this.signs) { this.group.remove(s.mesh); }
    this.segs = []; this.signs = [];
    const edges = [];
    for (let cz = -2; cz <= 2; cz++) for (let cx = -2; cx <= 2; cx++) {
      if (!this.cellUnlocked(cx, cz)) continue;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = cx + dx, nz = cz + dz;
        if (nx < -2 || nx > 2 || nz < -2 || nz > 2) continue;
        const ai = CELL_AREA[(nz + 2) * 5 + (nx + 2)];
        if (this.cellUnlocked(nx, nz) || AREAS[ai].hidden) continue;
        edges.push({ cx, cz, dx, dz, area: AREAS[ai] });
      }
    }
    const signedEdges = new Set();
    for (const e of edges) {
      // edge line in world space
      const ex = e.cx * 80 + e.dx * 40, ez = e.cz * 80 + e.dz * 40;
      const along = e.dx !== 0 ? [0, 1] : [1, 0];
      const P = [], Cc = [], UV = [];
      const col = new THREE.Color(e.area.col);
      const n = 40;
      for (let i = 0; i < n; i++) {
        const t0 = -40 + (i / n) * 80, t1 = -40 + ((i + 1) / n) * 80;
        const ax = ex + along[0] * t0, az = ez + along[1] * t0, bx = ex + along[0] * t1, bz = ez + along[1] * t1;
        const ya = Math.max(World.groundY(ax, az), 0) - 0.5, yb = Math.max(World.groundY(bx, bz), 0) - 0.5, H = 7;
        const quad = [[ax, ya, az, i / n, 0], [bx, yb, bz, (i + 1) / n, 0], [ax, ya + H, az, i / n, 1], [ax, ya + H, az, i / n, 1], [bx, yb, bz, (i + 1) / n, 0], [bx, yb + H, bz, (i + 1) / n, 1]];
        for (const q of quad) { P.push(q[0], q[1], q[2]); UV.push(q[3] * 8, q[4]); Cc.push(col.r, col.g, col.b); }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2));
      g.setAttribute('color', new THREE.Float32BufferAttribute(Cc, 3));
      const mesh = new THREE.Mesh(g, this.mat);
      mesh.renderOrder = 2;
      this.group.add(mesh);
      this.segs.push({ mesh, area: e.area.id, e });
      // one For Sale sign per (area, edge): prefer where a road crosses
      const key = e.area.id + ':' + e.cx + ':' + e.cz;
      if (signedEdges.has(key)) continue;
      signedEdges.add(key);
      let best = null, bestScore = -1e9;
      for (let t = -34; t <= 34; t += 2) {
        const px = ex + along[0] * t - e.dx * 3, pz = ez + along[1] * t - e.dz * 3;
        const y = World.groundY(px, pz);
        if (y < 0.5 || World.slopeAt(px, pz) > 0.8) continue;
        const score = (World.distToRoad(px, pz) < 5 ? 50 : 0) - Math.abs(t) * 0.3 - (World.onRoad(px, pz) ? 60 : 0);
        if (score > bestScore) { bestScore = score; best = [px, pz]; }
      }
      if (best) this.addSign(best[0], best[1], e);
    }
  },
  addSign(x, z, e) {
    const a = e.area;
    const g = new GB();
    g.boxB(0.22, 2.4, 0.22, 0x6e4a2b, -1.1, 0, 0).boxB(0.22, 2.4, 0.22, 0x6e4a2b, 1.1, 0, 0);
    const built = g.build();
    const grp = new THREE.Group();
    const posts = new THREE.Mesh(built.main, Mats.flat); posts.castShadow = true; grp.add(posts);
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 128;
    const cx = cv.getContext('2d');
    cx.fillStyle = '#c99a5b'; cx.fillRect(0, 0, 256, 128);
    cx.fillStyle = '#b3844a'; for (let i = 0; i < 4; i++) cx.fillRect(0, i * 32 + 30, 256, 3);
    cx.fillStyle = '#3d2c1e'; cx.textAlign = 'center';
    cx.font = '700 22px Fredoka, Nunito, sans-serif'; cx.fillText('FOR SALE', 128, 34);
    cx.font = '700 26px Fredoka, Nunito, sans-serif'; cx.fillText(a.name, 128, 72);
    cx.font = '600 18px Nunito, sans-serif'; cx.fillStyle = '#5b3f22'; cx.fillText('Level ' + a.level + ' · press E', 128, 104);
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
    const board = new THREE.Mesh(new THREE.BoxGeometry(2.8, 1.4, 0.14), [Mats.signWood || (Mats.signWood = new THREE.MeshLambertMaterial({ color: 0xb3844a })), Mats.signWood, Mats.signWood, Mats.signWood, new THREE.MeshLambertMaterial({ map: tex }), new THREE.MeshLambertMaterial({ map: tex })]);
    board.position.y = 1.9; board.castShadow = true;
    grp.add(board);
    grp.position.set(x, World.groundY(x, z), z);
    grp.rotation.y = Math.atan2(-e.dx, -e.dz);
    this.group.add(grp);
    this.signs.push({ mesh: grp, area: a.id, x, z });
  },
  /* dissolve every barrier of an area, then rebuild edges for the new frontier */
  dissolve(areaId, done) {
    const segs = this.segs.filter((s) => s.area === areaId);
    const signs = this.signs.filter((s) => s.area === areaId);
    for (const s of segs) {
      const m = s.mesh; const g = m.geometry.attributes.position;
      for (let i = 0; i < 12; i++) {
        const k = Math.floor(Math.random() * g.count);
        FX.burst(new THREE.Vector3(g.getX(k), g.getY(k) + 2, g.getZ(k)), { n: 6, color: [0xffffff, 0xfff1a8, AREA_BY_ID[areaId].col], speed: 3, up: 3, gravity: -2, life: 1.6, size: 0.5, kind: 1 });
      }
    }
    Tweens.add(1.6, (t) => {
      for (const s of segs) { s.mesh.position.y = -t * 8; s.mesh.scale.y = 1 - t * 0.9; }
      for (const s of signs) { s.mesh.scale.setScalar(1 - t); }
    }, () => { this.rebuild(); done && done(); }, Ease.inOut);
  },
};

/* =====================================================================
   Treasure chests
   ===================================================================== */
const Chests = {
  list: [],
  build(scene) {
    const g = new GB();
    g.boxB(1.3, 0.7, 0.9, 0x8a5a33, 0, 0, 0).boxB(1.36, 0.12, 0.96, 0xd9a82b, 0, 0.1, 0).boxB(1.36, 0.12, 0.96, 0xd9a82b, 0, 0.55, 0);
    const base = g.build().main;
    const lg = new GB();
    lg.boxB(1.3, 0.4, 0.9, 0x9c6b3f, 0, 0, -0.45).boxB(1.36, 0.1, 0.96, 0xd9a82b, 0, 0.3, -0.45).boxB(0.2, 0.25, 0.1, 0xf2c230, 0, 0.05, 0.02);
    const lid = lg.build().main;
    for (const c of CHESTS) {
      let x = c.x, z = c.z;
      for (let k = 0; k < 40 && (World.groundY(x, z) < 0.5 || World.blockedStatic(x, z, 1)); k++) { x += Math.cos(k) * 2; z += Math.sin(k) * 2; }
      const grp = new THREE.Group();
      const b = new THREE.Mesh(base, Mats.flat); b.castShadow = true; grp.add(b);
      const l = new THREE.Mesh(lid, Mats.flat); l.position.set(0, 0.7, 0.45); l.castShadow = true; grp.add(l);
      grp.position.set(x, World.groundY(x, z), z); grp.rotation.y = hash2(x | 0, z | 0) * TAU;
      scene.add(grp);
      this.list.push({ ...c, x, z, grp, lid: l, opened: false });
      World.addBlock(x - 0.8, x + 0.8, z - 0.8, z + 0.8, true, 'chest');
    }
  },
  setOpened(id, anim) {
    const c = this.list.find((q) => q.id === id); if (!c || c.opened) return;
    c.opened = true;
    if (anim) Tweens.add(0.6, (t) => { c.lid.rotation.x = -t * 1.9; }, null, Ease.outBack); else c.lid.rotation.x = -1.9;
  },
};
