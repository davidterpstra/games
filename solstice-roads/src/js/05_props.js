/* =====================================================================
   Props: trees (instanced, chunked, 2 LODs, wind), rocks, bushes,
   hedgerows, GPU grass around the camera, villages (procedural houses,
   churches, pubs), street lights and water surfaces.
   ===================================================================== */
const Props = {
  group: new THREE.Group(), vegChunks: [], windMats: [], grass: null, lamps: [], waterMats: [], buildingMats: [],
  uTime: { value: 0 }, uWind: { value: 1 },
};
const VCH = 200, VCN = WORLD / VCH;

/* ---------- geometry helpers ---------- */
function colorize(g, fn) {
  const p = g.attributes.position, c = new Float32Array(p.count * 3);
  const col = new THREE.Color();
  for (let i = 0; i < p.count; i++) { fn(col, p.getX(i), p.getY(i), p.getZ(i), i); c[i * 3] = col.r; c[i * 3 + 1] = col.g; c[i * 3 + 2] = col.b; }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  return g;
}
function blob(r, detail, seed, sx = 1, sy = 1, sz = 1) {
  let g = new THREE.IcosahedronGeometry(r, detail);
  g.deleteAttribute('uv'); g.deleteAttribute('normal');
  g = mergeVertices(g);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const f = 0.78 + 0.42 * (noise2(x * 1.3 + seed, z * 1.3 + y * 0.9) * 0.5 + 0.5);
    p.setXYZ(i, x * f * sx, y * f * sy, z * f * sz);
  }
  g.computeVertexNormals();
  return g;
}
const stripUV = (g) => { if (g.attributes.uv) g.deleteAttribute('uv'); if (g.index) g = g.toNonIndexed(); if (!g.attributes.normal) g.computeVertexNormals(); return g; };
function mergeColored(parts) { return mergeGeometries(parts.map((g) => { g = stripUV(g); if (!g.attributes.normal) g.computeVertexNormals(); return g; })); }

/* Leaf atlas: left 3/4 is a cluster of leaves on transparency, right 1/4 is solid white so
   trunks and inner canopy (which sample it) keep their vertex colours. */
function makeLeafTexture() {
  return canvasTex(256, 256, (x, w, h) => {
    x.clearRect(0, 0, w, h);
    x.fillStyle = '#fff'; x.fillRect(200, 0, 56, h);
    const r = mulberry32(77);
    for (let i = 0; i < 260; i++) {
      const cx = 14 + r() * 164, cy = 14 + r() * 228;
      const dx = (cx - 96) / 90, dy = (cy - 128) / 120;
      if (dx * dx + dy * dy > 1) continue; // roughly round cluster
      const v = 150 + r() * 105;
      x.save(); x.translate(cx, cy); x.rotate(r() * TAU);
      x.fillStyle = `rgb(${v * 0.92 | 0},${v | 0},${v * 0.86 | 0})`;
      x.beginPath(); x.ellipse(0, 0, 4 + r() * 4, 9 + r() * 6, 0, 0, TAU); x.fill();
      x.strokeStyle = 'rgba(60,70,50,0.35)'; x.lineWidth = 1;
      x.beginPath(); x.moveTo(0, -10); x.lineTo(0, 10); x.stroke();
      x.restore();
    }
  }, { repeat: false });
}
/* Leaf cards scattered over canopy blobs; normals point away from the blob centre so the
   crown is lit like a volume. Other parts get a uv inside the solid strip of the atlas. */
function leafyMerge(parts, blobs, perBlob, size, tint) {
  const geos = [];
  for (const g0 of parts) {
    let g = g0.index ? g0.toNonIndexed() : g0;
    if (!g.attributes.normal) g.computeVertexNormals();
    const uv = new Float32Array(g.attributes.position.count * 2);
    for (let i = 0; i < uv.length; i += 2) { uv[i] = 0.9; uv[i + 1] = 0.5; }
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geos.push(g);
  }
  const col = new THREE.Color();
  blobs.forEach(([bx, by, bz, br], bi) => {
    for (let k = 0; k < perBlob; k++) {
      const u = hash2(bi * 97 + k, 3) * 2 - 1, a = hash2(bi * 97 + k, 7) * TAU;
      const sq = Math.sqrt(1 - u * u);
      const nx = sq * Math.cos(a), ny = u * 0.8 + 0.2, nz = sq * Math.sin(a);
      const sz = size * (0.75 + hash2(bi, k) * 0.5);
      const g = new THREE.PlaneGeometry(sz, sz).toNonIndexed();
      g.rotateX(hash2(k, bi) * TAU); g.rotateY(hash2(k + 9, bi) * TAU); g.rotateZ(hash2(k + 3, bi + 5) * TAU);
      const rr = br * (0.6 + 0.4 * hash2(k * 5, bi + 11));
      const cx = bx + nx * rr, cy = by + ny * rr, cz = bz + nz * rr;
      g.translate(cx, cy, cz);
      const p = g.attributes.position, n = new Float32Array(p.count * 3), c = new Float32Array(p.count * 3), uv = g.attributes.uv;
      for (let i = 0; i < p.count; i++) {
        const vx = p.getX(i) - bx, vy = p.getY(i) - by, vz = p.getZ(i) - bz, l = Math.hypot(vx, vy, vz) || 1;
        n[i * 3] = vx / l; n[i * 3 + 1] = vy / l; n[i * 3 + 2] = vz / l;
        const t = clamp((p.getY(i) - (by - br)) / (br * 2.2), 0, 1);
        col.setRGB(tint[0], tint[1], tint[2]).multiplyScalar(0.55 + 0.6 * t + 0.12 * (hash2(bi, k * 3) - 0.5));
        c[i * 3] = col.r; c[i * 3 + 1] = col.g; c[i * 3 + 2] = col.b;
        uv.setX(i, uv.getX(i) * 0.74);
      }
      g.setAttribute('normal', new THREE.BufferAttribute(n, 3));
      g.setAttribute('color', new THREE.BufferAttribute(c, 3));
      geos.push(g);
    }
  });
  return mergeGeometries(geos);
}

function makeTreeGeoms() {
  const T = {};
  const bark = (c) => (col, x, y) => col.setRGB(0.32, 0.24, 0.17).multiplyScalar(0.8 + 0.2 * c);
  // oak
  {
    const trunk = new THREE.CylinderGeometry(0.22, 0.42, 4.6, 7, 3); trunk.translate(0, 2.3, 0);
    colorize(trunk, bark(1));
    const parts = [trunk];
    const blobs = [[0, 6.2, 0, 2.6], [1.6, 5.4, 0.6, 1.9], [-1.5, 5.6, -0.5, 2.0], [0.4, 5.2, -1.6, 1.8], [-0.5, 5.0, 1.6, 1.8], [0.2, 7.6, 0.3, 1.7]];
    blobs.forEach(([x, y, z, r], i) => {
      const b = blob(r * 0.72, 2, i * 3.1); b.translate(x, y, z);
      colorize(b, (col, px, py, pz) => { const t = clamp((py - 3.6) / 5.2, 0, 1); col.setRGB(0.16, 0.3, 0.1).multiplyScalar(0.3 + 0.35 * t + 0.1 * hash2(i, 1)); });
      parts.push(b);
    });
    T.oak = leafyMerge(parts, blobs, 24, 2.5, [0.24, 0.42, 0.15]);
    const ft = new THREE.CylinderGeometry(0.25, 0.4, 4.6, 5); ft.translate(0, 2.3, 0); colorize(ft, bark(1));
    const fb = blob(3.3, 1, 2, 1, 0.8, 1); fb.translate(0, 6.0, 0);
    colorize(fb, (col, x, y) => col.setRGB(0.2, 0.35, 0.13).multiplyScalar(0.6 + 0.5 * clamp((y - 4) / 4, 0, 1)));
    T.oakFar = mergeColored([ft, fb]);
  }
  // pine
  {
    const trunk = new THREE.CylinderGeometry(0.15, 0.32, 3, 6); trunk.translate(0, 1.5, 0); colorize(trunk, bark(0.7));
    const parts = [trunk];
    const tiers = [[2.4, 2.4, 3.4], [3.9, 2.0, 3.0], [5.3, 1.6, 2.7], [6.6, 1.15, 2.3], [7.8, 0.7, 2.0]];
    tiers.forEach(([y, r, h], i) => {
      const c = new THREE.ConeGeometry(r, h, 10, 2, true);
      const p = c.attributes.position;
      for (let k = 0; k < p.count; k++) if (p.getY(k) < 0) { const a = Math.atan2(p.getZ(k), p.getX(k)); const f = 1 + 0.18 * Math.sin(a * 5 + i); p.setX(k, p.getX(k) * f); p.setZ(k, p.getZ(k) * f); p.setY(k, p.getY(k) - 0.25 * (1 + Math.sin(a * 7))); }
      c.translate(0, y + h / 2, 0);
      colorize(c, (col, x, py) => col.setRGB(0.1, 0.24, 0.14).multiplyScalar(0.55 + 0.55 * clamp((py - y) / h, 0, 1)));
      parts.push(c);
    });
    T.pine = mergeColored(parts);
    const ft = new THREE.CylinderGeometry(0.15, 0.3, 2.5, 4); ft.translate(0, 1.25, 0); colorize(ft, bark(0.7));
    const fc = new THREE.ConeGeometry(2.3, 7.6, 6); fc.translate(0, 2.2 + 3.8, 0);
    colorize(fc, (col, x, y) => col.setRGB(0.1, 0.23, 0.13).multiplyScalar(0.6 + 0.4 * clamp((y - 2) / 7, 0, 1)));
    T.pineFar = mergeColored([ft, fc]);
  }
  // birch
  {
    const trunk = new THREE.CylinderGeometry(0.1, 0.2, 6.5, 6, 6); trunk.translate(0, 3.25, 0);
    colorize(trunk, (col, x, y, z, i) => { const m = hash2(Math.floor(y * 3), 1) < 0.25 ? 0.25 : 0.92; col.setRGB(m, m, m * 0.97); });
    const parts = [trunk];
    const bblobs = [[0, 6.4, 0, 1.6], [0.7, 5.3, 0.3, 1.2], [-0.6, 5.6, -0.4, 1.3], [0.1, 7.6, 0, 1.1]];
    bblobs.forEach(([x, y, z, r], i) => {
      const b = blob(r * 0.72, 2, 10 + i, 1, 1.35, 1); b.translate(x, y, z);
      colorize(b, (col, px, py) => col.setRGB(0.36, 0.5, 0.2).multiplyScalar(0.6 + 0.5 * clamp((py - 4.5) / 4, 0, 1)));
      parts.push(b);
    });
    T.birch = leafyMerge(parts, bblobs.map(([x, y, z, r]) => [x, y, z, r * 1.15]), 16, 1.8, [0.42, 0.56, 0.24]);
    const ft = new THREE.CylinderGeometry(0.1, 0.18, 6, 4); ft.translate(0, 3, 0); colorize(ft, (col) => col.setRGB(0.85, 0.85, 0.82));
    const fb = blob(1.9, 1, 4, 1, 1.5, 1); fb.translate(0, 6.3, 0); colorize(fb, (col, x, y) => col.setRGB(0.35, 0.48, 0.2).multiplyScalar(0.7 + 0.4 * clamp((y - 4.5) / 4, 0, 1)));
    T.birchFar = mergeColored([ft, fb]);
  }
  // bush, hedge, rock
  T.bush = (() => { const b = blob(1, 1, 7, 1.3, 0.75, 1.2); b.translate(0, 0.45, 0); colorize(b, (col, x, y) => col.setRGB(0.18, 0.32, 0.12).multiplyScalar(0.6 + 0.6 * clamp(y, 0, 1))); return stripUV(b); })();
  T.hedge = (() => {
    const g = new THREE.BoxGeometry(1, 1, 1, 2, 3, 5);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const n = noise2(x * 3 + z * 2.1, y * 3 + z) * 0.12;
      p.setXYZ(i, x * (1 + n) * (y > 0.3 ? 0.9 : 1), y + n * 0.6, z);
    }
    g.translate(0, 0.5, 0);
    g.deleteAttribute('uv');
    g.computeVertexNormals();
    colorize(g, (col, x, y, z) => { col.setRGB(0.16, 0.3, 0.11).multiplyScalar(0.55 + 0.6 * y); if (hash2(Math.floor(x * 9 + 40), Math.floor(z * 9 + y * 7 + 40)) > 0.97) col.setRGB(0.95, 0.92, 0.85); });
    return g;
  })();
  T.rock = (() => { const b = blob(1, 1, 21, 1.3, 0.75, 1.1); b.translate(0, 0.25, 0); colorize(b, (col, x, y) => col.setRGB(0.5, 0.49, 0.46).multiplyScalar(0.7 + 0.35 * clamp(y + 0.3, 0, 1))); return stripUV(b); })();
  return T;
}

function windMaterial(strength, opts = {}) {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0, ...opts });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = Props.uTime; sh.uniforms.uWind = Props.uWind;
    // leafy breakup: world-space cell noise darkens gaps and jitters the normal
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
varying vec3 vLeafP;
float lh0(vec3 p){ return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
float lh(vec3 p){ vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(lh0(i), lh0(i + vec3(1,0,0)), f.x), mix(lh0(i + vec3(0,1,0)), lh0(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(lh0(i + vec3(0,0,1)), lh0(i + vec3(1,0,1)), f.x), mix(lh0(i + vec3(0,1,1)), lh0(i + vec3(1,1,1)), f.x), f.y), f.z); }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
float leaf = lh(vLeafP * 2.3) * 0.45 + lh(vLeafP * 6.1) * 0.35 + lh(vLeafP * 14.0) * 0.2;
float isLeaf = step(0.12, vColor.g - vColor.r);
diffuseColor.rgb *= mix(1.0, 0.45 + leaf * 0.95, isLeaf);`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
normal = normalize(normal + (vec3(lh(vLeafP * 6.0), lh(vLeafP * 6.0 + 3.1), lh(vLeafP * 6.0 + 7.7)) - 0.5) * 1.2 * isLeaf + vec3(0.0, 0.002, 0.0));`);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime, uWind; varying vec3 vLeafP;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
#ifdef USE_INSTANCING
vec2 wph = instanceMatrix[3].xz;
#else
vec2 wph = vec2(0.0);
#endif
float sway = max(0.0, transformed.y - 1.5) * ${strength.toFixed(3)} * uWind;
transformed.x += sin(uTime * 1.6 + wph.x * 0.07 + wph.y * 0.05) * sway;
transformed.z += cos(uTime * 1.3 + wph.x * 0.05 - wph.y * 0.06) * sway * 0.7;
vLeafP = position + vec3(wph.x, 0.0, wph.y);`);
  };
  Props.windMats.push(m);
  return m;
}

/* ---------- vegetation placement ---------- */
/* Coarse (8 m) cache of the woodland density for terrain shading and the map. */
const TD = { N: WORLD / 8 + 1, a: null };
function buildTreeDensityGrid() {
  TD.a = new Float32Array(TD.N * TD.N);
  for (let j = 0; j < TD.N; j++) for (let i = 0; i < TD.N; i++) TD.a[j * TD.N + i] = treeDensity(i * 8 - HALF, j * 8 - HALF)[0];
}
function treeDensityFast(x, z) {
  if (!TD.a) return 0;
  const i = clamp(Math.round((x + HALF) / 8), 0, TD.N - 1), j = clamp(Math.round((z + HALF) / 8), 0, TD.N - 1);
  return TD.a[j * TD.N + i];
}
function treeDensity(x, z) {
  const W = World, id = cellId(x, z);
  const h = W.H[id];
  if (W.RD[id] < 3.5) return [0, 0];
  if (W.WL[id] > h - 1.2 || W.RIVD[id] < 3) return [0, 0];
  const s = W.SURF[id];
  if (s === S_SNOW) return [0, 0];
  if (Math.hypot(x - PLAZA.x, z - PLAZA.z) < PLAZA.r + 45) return [0, 0];
  if (Math.abs(x) > HALF - 20 || Math.abs(z) > HALF - 20) return [0, 0];
  for (const p of PLACES) if (p.kind === 'village' && Math.hypot(x - p.x, z - p.z) < p.r * 0.75) return [0.02, 0];
  // keep the cross-country leg of the scramble clear
  const sv = EVENTS.find((e) => e.id === 'scramble').via['K2>MO'];
  for (let i = 0; i < sv.length - 1; i++) if (closestOnSeg(x, z, sv[i][0], sv[i][1], sv[i + 1][0], sv[i + 1][1]).d < 22) return [0, 0];
  if (closestOnSeg(x, z, 360, -640, 300, -600).d < 22 || closestOnSeg(x, z, 56, -110, 40, -20).d < 22) return [0, 0];
  let d = 0, type = 0; // 0 oak, 1 pine, 2 birch
  const n = fbm(x * 0.0045 + 13, z * 0.0045 - 7, 4);
  d = smoothstep(0.18, 0.45, n) * 0.55; // copses
  const hol = 1 - smoothstep(220, 340, Math.hypot(x - 930, z - 60));
  const wes = 1 - smoothstep(200, 330, Math.hypot(x + 950, z - 750));
  const edgeW = smoothstep(980, 1140, Math.max(Math.abs(x), Math.abs(z)));
  d = Math.max(d, hol * 0.95, wes * 0.95, edgeW * 0.7);
  const fells = smoothstep(-640, -760, z);
  if (fells > 0) { d = Math.max(d * (1 - fells), fells * smoothstep(0.0, 0.35, fbm(x * 0.01, z * 0.01)) * 0.7 * (1 - smoothstep(95, 125, h))); type = 1; }
  if (s === S_ROCK) d *= 0.25;
  const moor = 1 - smoothstep(180, 320, Math.hypot(x - 120, z + 260));
  d *= 1 - moor * 0.92;
  const fm = farmMask(x, z);
  if (fm > 0.3) {
    const f = fieldAt(x, z);
    d = f.edge < 2.5 ? 0.09 : d * (1 - fm);
  }
  if (lakeQ(x, z) < 1.25) d *= 0.4;
  if (type === 0) { const r = hash2(Math.floor(x * 0.11), Math.floor(z * 0.11)); if (wes > 0.3 && r < 0.45) type = 1; else if (r < 0.28) type = 2; }
  // forest edge trees thin out close to roads
  if (W.RD[id] < 9) d *= 0.35;
  return [d, type];
}

function buildVegetation(q) {
  const G = makeTreeGeoms();
  Props.geoms = G;
  const matLeaf = windMaterial(0.035);
  const matCards = windMaterial(0.035, { map: makeLeafTexture(), alphaTest: 0.45, side: THREE.DoubleSide });
  const matStill = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 });
  const chunks = [];
  for (let i = 0; i < VCN * VCN; i++) chunks.push({ trees: [[], [], []], bush: [], rock: [], hedge: [] });
  const cidx = (x, z) => clamp(Math.floor((z + HALF) / VCH), 0, VCN - 1) * VCN + clamp(Math.floor((x + HALF) / VCH), 0, VCN - 1);
  reseed(4242);
  const STEP = 6.5;
  for (let z = -HALF + 10; z < HALF - 10; z += STEP) for (let x = -HALF + 10; x < HALF - 10; x += STEP) {
    const px = x + (rng() - 0.5) * STEP * 0.9, pz = z + (rng() - 0.5) * STEP * 0.9;
    const [d, type] = treeDensity(px, pz);
    const r = rng();
    const ch = chunks[cidx(px, pz)];
    if (r < d) {
      const s = 0.75 + rng() * 0.6;
      ch.trees[type].push([px, hAt(px, pz) - 0.2, pz, s, rng() * TAU]);
      Col.circle(px, pz, 0.45 * s + 0.15, 'tree');
    } else if (r < d + 0.05 * (d > 0.05 ? 1 : 0.2)) {
      if (World.RD[cellId(px, pz)] > 1.5) ch.bush.push([px, hAt(px, pz), pz, 0.6 + rng() * 0.9, rng() * TAU]);
    }
  }
  // rocks: moor, fells, lake shore
  for (let i = 0; i < 2600; i++) {
    const x = (rng() - 0.5) * (WORLD - 60), z = (rng() - 0.5) * (WORLD - 60);
    const id = cellId(x, z);
    if (World.RD[id] < 3 || World.WL[id] > World.H[id] - 0.3) continue;
    const moor = 1 - smoothstep(150, 320, Math.hypot(x - 120, z + 260));
    const fells = smoothstep(-700, -850, z);
    const p = Math.max(moor * 0.5, fells * 0.9, World.SURF[id] === S_ROCK ? 0.8 : 0.03);
    if (rng() > p) continue;
    if (treeDensity(x, z)[0] === 0 && moor > 0.3 && rng() < 0.85) continue; // keep the scramble lanes mostly clear
    const s = 0.4 + rng() * rng() * 2.6;
    chunks[cidx(x, z)].rock.push([x, hAt(x, z) - 0.15 * s, z, s, rng() * TAU]);
    if (s > 0.9) Col.circle(x, z, s * 1.05, 'rock');
  }
  // hedgerows along field edges
  for (let z = -HALF + 20; z < HALF - 20; z += 3.6) for (let x = -HALF + 20; x < HALF - 20; x += 3.6) {
    if (farmMask(x, z) < 0.45) continue;
    const f = fieldAt(x, z);
    if (f.edge > 1.8) continue;
    const id = cellId(x, z);
    if (World.RD[id] < 3 || World.WL[id] > World.H[id] - 0.5 || World.RIVD[id] < 4) continue;
    let nearV = false;
    for (const p of PLACES) if (p.kind === 'village' && Math.hypot(x - p.x, z - p.z) < p.r * 0.7) nearV = true;
    if (nearV || Math.hypot(x - PLAZA.x, z - PLAZA.z) < PLAZA.r + 30) continue;
    // orientation: along the field edge (grid axes are rotated by FIELD_A)
    const u = x * FCOS - z * FSIN, v = x * FSIN + z * FCOS;
    const fe = fieldAt(x + 1.5 * FCOS, z - 1.5 * FSIN).id !== f.id || fieldAt(x - 1.5 * FCOS, z + 1.5 * FSIN).id !== f.id;
    const ang = fe ? -FIELD_A : Math.PI / 2 - FIELD_A;
    void u; void v;
    chunks[cidx(x, z)].hedge.push([x, hAt(x, z) - 0.15, z, 1, ang]);
    Col.circle(x, z, 1.1, 'hedge');
  }
  const o = new THREE.Object3D();
  const inst = (geo, mat, list, cast, scaleXYZ) => {
    if (!list.length) return null;
    const m = new THREE.InstancedMesh(geo, mat, list.length);
    const col = new THREE.Color();
    list.forEach((p, i) => {
      o.position.set(p[0], p[1], p[2]); o.rotation.set(0, p[4], 0);
      if (scaleXYZ) o.scale.set(...scaleXYZ(p)); else o.scale.setScalar(p[3]);
      o.updateMatrix(); m.setMatrixAt(i, o.matrix);
      m.setColorAt(i, col.setScalar(0.82 + hash2(i, list.length) * 0.36));
    });
    m.castShadow = cast; m.receiveShadow = true;
    m.computeBoundingSphere();
    Props.group.add(m);
    return m;
  };
  const near = [G.oak, G.pine, G.birch], far = [G.oakFar, G.pineFar, G.birchFar];
  for (let ci = 0; ci < chunks.length; ci++) {
    const c = chunks[ci];
    const cx = (ci % VCN) * VCH - HALF + VCH / 2, cz = Math.floor(ci / VCN) * VCH - HALF + VCH / 2;
    const vc = { cx, cz, near: [], far: [], small: [] };
    for (let t = 0; t < 3; t++) {
      const a = inst(near[t], t === 1 ? matLeaf : matCards, c.trees[t], true); if (a) vc.near.push(a);
      const b = inst(far[t], matLeaf, c.trees[t], false); if (b) vc.far.push(b);
    }
    const bu = inst(G.bush, matLeaf, c.bush, false); if (bu) vc.small.push(bu);
    const ro = inst(G.rock, matStill, c.rock, true); if (ro) vc.small.push(ro);
    const he = inst(G.hedge, matLeaf, c.hedge, true, () => [1.7, 1.6 + 0.3 * rng(), 3.9]); if (he) vc.small.push(he);
    Props.vegChunks.push(vc);
  }
  updateVegetation(0, 0, q, true);
}
function updateVegetation(x, z, q, force) {
  const nearD = q.treeFar > 900 ? 300 : q.treeFar > 700 ? 230 : 160;
  for (const c of Props.vegChunks) {
    const d = Math.max(0, Math.hypot(c.cx - x, c.cz - z) - VCH * 0.71);
    const n = d < nearD, f = !n && d < q.treeFar, s = d < Math.min(q.treeFar, 700);
    for (const m of c.near) { m.visible = n; m.castShadow = q.treeShadows || force; }
    for (const m of c.far) m.visible = f;
    for (const m of c.small) m.visible = s;
  }
}

/* ---------- GPU grass ---------- */
function buildGrass() {
  // height + density texture at 4 m
  const N = GN / 2 + 1;
  const data = new Float32Array(N * N * 4);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const id = (j * 2) * GV + i * 2, k = (j * N + i) * 4;
    data[k] = World.H[id];
    const s = World.SURF[id];
    let d = s === S_GRASS ? 0.95 : s === S_DIRT ? 0.12 : s === S_MUD ? 0.25 : 0;
    if (World.RD[id] < 2.2) d = 0;
    const fld = World.FLD[id];
    if (fld === 3) d = 0.05;
    const x = i * 4 - HALF, z = j * 4 - HALF;
    if (Math.hypot(x - PLAZA.x, z - PLAZA.z) < PLAZA.r + 46) d = 0;
    if (World.WL[id] > World.H[id] - 0.2) d = 0;
    data[k + 1] = d;
    data[k + 2] = fld;
    data[k + 3] = 1 - smoothstep(180, 320, Math.hypot(x - 120, z + 260)); // moor
  }
  const tex = new THREE.DataTexture(data, N, N, THREE.RGBAFormat, THREE.FloatType);
  tex.minFilter = tex.magFilter = THREE.NearestFilter;
  tex.needsUpdate = true;
  Props.heightTex = tex;
  // blade cluster
  const parts = [];
  for (let b = 0; b < 7; b++) {
    const g = new THREE.PlaneGeometry(0.06, 0.36, 1, 3);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const y = p.getY(i) + 0.18; p.setY(i, y); p.setX(i, p.getX(i) * (1 - y / 0.4)); p.setZ(i, y * y * 0.6); }
    g.rotateY(b * 1.3 + hash2(b, 2) * 2); g.translate((hash2(b, 5) - 0.5) * 0.35, 0, (hash2(b, 8) - 0.5) * 0.35);
    g.scale(1, 0.7 + hash2(b, 9) * 0.6, 1);
    parts.push(g);
  }
  const geo = mergeGeometries(parts);
  const ig = new THREE.InstancedBufferGeometry().copy(geo);
  ig.instanceCount = 0;
  Props.grass = { geo: ig, mesh: null, count: 0 };
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, side: THREE.DoubleSide });
  const u = { tHM: { value: tex }, uCam: { value: new THREE.Vector3() }, uR: { value: 50 }, uTime: Props.uTime, uWind: Props.uWind, uSnow: { value: 0 } };
  Props.grass.u = u;
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
uniform sampler2D tHM; uniform vec3 uCam; uniform float uR, uTime, uWind;
attribute vec3 gOff; varying vec3 vGCol;
vec4 hmS(vec2 p) {
  vec2 f = (p + ${HALF.toFixed(1)}) / 4.0; ivec2 i = ivec2(floor(f)); vec2 t = fract(f);
  i = clamp(i, ivec2(0), ivec2(${N - 2}));
  vec4 a = texelFetch(tHM, i, 0), b = texelFetch(tHM, i + ivec2(1, 0), 0), c = texelFetch(tHM, i + ivec2(0, 1), 0), d = texelFetch(tHM, i + ivec2(1, 1), 0);
  return mix(mix(a, b, t.x), mix(c, d, t.x), t.y);
}`)
      .replace('#include <beginnormal_vertex>', 'vec3 objectNormal = vec3(0.0, 1.0, 0.0);')
      .replace('#include <begin_vertex>', `
vec2 wp = gOff.xy + 2.0 * uR * floor((uCam.xz - gOff.xy) / (2.0 * uR) + 0.5);
vec4 hd = hmS(wp);
float dist = length(wp - uCam.xz);
float rnd = gOff.z;
float sc = step(rnd, hd.g) * (1.0 - smoothstep(uR * 0.55, uR * 0.98, dist));
float fld = floor(hd.b + 0.5);
float tall = fld == 2.0 ? 2.2 : fld == 1.0 ? 0.8 : fld == 5.0 ? 1.5 : 1.0;
float ca = cos(rnd * 40.0), sa = sin(rnd * 40.0);
vec3 transformed = position * sc * (0.65 + fract(rnd * 13.7) * 0.7) * vec3(1.0, tall, 1.0);
transformed.xz = mat2(ca, -sa, sa, ca) * transformed.xz;
float bend = transformed.y * transformed.y;
transformed.x += sin(uTime * 2.1 + wp.x * 0.35 + wp.y * 0.21) * 0.35 * bend * uWind;
transformed.z += cos(uTime * 1.7 + wp.x * 0.27) * 0.2 * bend * uWind;
transformed += vec3(wp.x, hd.r - 0.05, wp.y);
vec3 gc = vec3(0.36, 0.52, 0.2);
if (fld == 2.0) gc = vec3(0.62, 0.52, 0.22);
if (fld == 4.0) gc = vec3(0.6, 0.6, 0.15);
gc = mix(gc, vec3(0.42, 0.3, 0.2), hd.a * 0.5);
vGCol = gc * (0.7 + 0.45 * clamp(position.y / 0.34, 0.0, 1.0)) * (0.85 + 0.3 * fract(rnd * 71.3));`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vGCol;')
      .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb *= vGCol;');
  };
  const mesh = new THREE.Mesh(ig, mat);
  mesh.frustumCulled = false;
  mesh.receiveShadow = true;
  Props.grass.mesh = mesh;
  Props.group.add(mesh);
}
function setGrassCount(count, radius) {
  const g = Props.grass;
  if (!g) return;
  if (count !== g.count) {
    const arr = new Float32Array(count * 3);
    const r = mulberry32(99);
    for (let i = 0; i < count; i++) { arr[i * 3] = (r() * 2 - 1) * radius; arr[i * 3 + 1] = (r() * 2 - 1) * radius; arr[i * 3 + 2] = r(); }
    g.geo.setAttribute('gOff', new THREE.InstancedBufferAttribute(arr, 3));
    g.geo.instanceCount = count;
    g.count = count;
  }
  g.u.uR.value = radius;
  g.mesh.visible = count > 0;
}

/* ---------- buildings ---------- */
function facadeTex(kind) {
  // one bay: 4 m wide x 2.8 m tall, with a window
  const W = 256, Hh = 180;
  const glow = [];
  const base = canvasTex(W, Hh, (x) => {
    if (kind === 'stone') {
      x.fillStyle = '#8a8170'; x.fillRect(0, 0, W, Hh);
      for (let r = 0; r < 9; r++) { let cx = -rng() * 20; while (cx < W) { const bw = 18 + rng() * 26, v = 105 + rng() * 60; x.fillStyle = `rgb(${v | 0},${v * 0.93 | 0},${v * 0.8 | 0})`; x.fillRect(cx + 1, r * 20 + 1, bw - 2, 18); cx += bw; } }
    } else if (kind === 'brick') {
      x.fillStyle = '#6b4a3a'; x.fillRect(0, 0, W, Hh);
      for (let r = 0; r < 24; r++) for (let c = -1; c < 12; c++) { const v = 120 + rng() * 50; x.fillStyle = `rgb(${v | 0},${v * 0.52 | 0},${v * 0.38 | 0})`; x.fillRect(c * 24 + (r & 1) * 12 + 1, r * 7.5 + 1, 22, 6); }
    } else if (kind === 'render') {
      noiseFill(x, W, Hh, 6, (n) => { const v = 0.9 + n * 0.1; return [238 * v, 232 * v, 220 * v]; });
    } else { // timber barn
      x.fillStyle = '#4a3324'; x.fillRect(0, 0, W, Hh);
      for (let c = 0; c < 16; c++) { const v = 55 + rng() * 30; x.fillStyle = `rgb(${v | 0},${v * 0.75 | 0},${v * 0.55 | 0})`; x.fillRect(c * 16 + 1, 0, 14, Hh); }
    }
    noiseOverlay(x, W, Hh, 0.1);
    if (kind !== 'barn') {
      // window with frame, sill and lintel
      const wx = 88, wy = 48, ww = 80, wh = 86;
      x.fillStyle = kind === 'brick' ? '#d8d0c0' : '#efece4'; x.fillRect(wx - 6, wy - 6, ww + 12, wh + 12);
      x.fillStyle = '#20262c'; x.fillRect(wx, wy, ww, wh);
      const g = x.createLinearGradient(wx, wy, wx + ww, wy + wh); g.addColorStop(0, 'rgba(160,190,210,0.5)'); g.addColorStop(1, 'rgba(40,50,60,0.2)');
      x.fillStyle = g; x.fillRect(wx, wy, ww, wh);
      x.fillStyle = '#efece4'; x.fillRect(wx + ww / 2 - 2, wy, 4, wh); x.fillRect(wx, wy + wh / 2 - 2, ww, 4);
      x.fillStyle = 'rgba(0,0,0,0.25)'; x.fillRect(wx - 8, wy + wh + 6, ww + 16, 5);
      glow.push([wx, wy, ww, wh]);
    }
  });
  const em = canvasTex(W, Hh, (x) => {
    x.fillStyle = '#000'; x.fillRect(0, 0, W, Hh);
    for (const [wx, wy, ww, wh] of glow) { const g = x.createRadialGradient(wx + ww / 2, wy + wh / 2, 5, wx + ww / 2, wy + wh / 2, ww * 0.7); g.addColorStop(0, '#ffd08a'); g.addColorStop(1, '#a5612a'); x.fillStyle = g; x.fillRect(wx, wy, ww, wh); x.fillStyle = '#000'; x.fillRect(wx + ww / 2 - 2, wy, 4, wh); x.fillRect(wx, wy + wh / 2 - 2, ww, 4); }
  });
  const m = new THREE.MeshStandardMaterial({ map: base, emissiveMap: em, emissive: 0xffffff, emissiveIntensity: 0, roughness: 0.92 });
  Props.buildingMats.push(m);
  return m;
}
function roofTex(kind) {
  return new THREE.MeshStandardMaterial({
    roughness: kind === 'slate' ? 0.6 : 0.95,
    map: canvasTex(256, 256, (x, w, h) => {
      if (kind === 'thatch') {
        noiseFill(x, w, h, 8, (n) => { const v = 0.65 + n * 0.5; return [150 * v, 118 * v, 70 * v]; });
        for (let i = 0; i < 3000; i++) { x.strokeStyle = `rgba(${90 + rng() * 80 | 0},${70 + rng() * 60 | 0},${40 + rng() * 30 | 0},0.6)`; const px = rng() * w, py = rng() * h; x.beginPath(); x.moveTo(px, py); x.lineTo(px + (rng() - 0.5) * 3, py + 8 + rng() * 10); x.stroke(); }
      } else {
        const base = kind === 'slate' ? [70, 74, 82] : [140, 70, 50];
        x.fillStyle = `rgb(${base})`; x.fillRect(0, 0, w, h);
        for (let r = 0; r < 16; r++) for (let c = -1; c < 9; c++) {
          const v = 0.75 + rng() * 0.4;
          x.fillStyle = `rgb(${base[0] * v | 0},${base[1] * v | 0},${base[2] * v | 0})`;
          x.fillRect(c * 32 + (r & 1) * 16 + 1, r * 16 + 1, 30, 14);
          x.fillStyle = 'rgba(0,0,0,0.3)'; x.fillRect(c * 32 + (r & 1) * 16 + 1, r * 16 + 13, 30, 2);
        }
      }
    }),
  });
}
// Box with UVs scaled to world size (u per 4 m, v per 2.8 m).
function facadeBox(w, h, d) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv, n = g.attributes.normal;
  for (let i = 0; i < uv.count; i++) {
    const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i));
    const fw = ax > 0.5 ? d : w;
    if (ay > 0.5) uv.setXY(i, 0, 0);
    else uv.setXY(i, uv.getX(i) * Math.max(1, Math.round(fw / 4)), uv.getY(i) * Math.max(1, Math.round(h / 2.8)));
  }
  g.translate(0, h / 2, 0);
  return g;
}
function gableRoof(w, d, h, over = 0.4, thick = 0.25) {
  // ridge along x (width); slopes face +z / -z
  const W2 = w / 2 + over, D2 = d / 2 + over;
  const pos = [], uv = [];
  const quad = (a, b, c, e, us, vs) => { pos.push(...a, ...b, ...c, ...a, ...c, ...e); uv.push(0, 0, us, 0, us, vs, 0, 0, us, vs, 0, vs); };
  const sl = Math.hypot(D2, h);
  quad([-W2, 0, D2], [W2, 0, D2], [W2, h, 0], [-W2, h, 0], w / 3, sl / 3);
  quad([W2, 0, -D2], [-W2, 0, -D2], [-W2, h, 0], [W2, h, 0], w / 3, sl / 3);
  // underside thickness
  quad([W2, -thick, D2], [-W2, -thick, D2], [-W2, 0, D2], [W2, 0, D2], w / 3, 0.1);
  quad([-W2, -thick, -D2], [W2, -thick, -D2], [W2, 0, -D2], [-W2, 0, -D2], w / 3, 0.1);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.computeVertexNormals();
  return g;
}
function gableEnds(w, d, h) {
  const pos = [], D2 = d / 2;
  for (const sx of [-1, 1]) {
    const x = sx * w / 2;
    if (sx > 0) pos.push(x, 0, D2, x, 0, -D2, x, h, 0); else pos.push(x, 0, -D2, x, 0, D2, x, h, 0);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 2, 0, 1, 0.8, 0, 0, 2, 0, 1, 0.8], 2));
  g.computeVertexNormals();
  return g;
}
function buildingVariants() {
  const mStone = facadeTex('stone'), mBrick = facadeTex('brick'), mRender = facadeTex('render'), mBarn = facadeTex('barn');
  const rSlate = roofTex('slate'), rThatch = roofTex('thatch'), rTile = roofTex('tile');
  const door = new THREE.MeshStandardMaterial({ color: 0x2c3a52, roughness: 0.6 });
  const V = [];
  const mk = (name, w, d, wallH, roofH, wall, roof, chimneys, extra) => {
    const walls = [facadeBox(w, wallH, d), gableEnds(w, d, roofH).translate(0, wallH, 0)];
    const wallG = mergeGeometries(walls.map((g) => g.index ? g.toNonIndexed() : g));
    const roofG = gableRoof(w, d, roofH, name === 'thatch' ? 0.7 : 0.4, name === 'thatch' ? 0.6 : 0.2).translate(0, wallH, 0);
    const chim = [];
    for (const cx of chimneys) chim.push(new THREE.BoxGeometry(0.9, 2.2, 0.9).translate(cx, wallH + roofH * 0.6 + 0.6, 0));
    const doorG = new THREE.BoxGeometry(1.1, 2.1, 0.12).translate(extra?.doorX ?? 0, 1.05, d / 2 + 0.05);
    V.push({ name, w, d, h: wallH + roofH, parts: [[wallG, wall], [roofG, roof], [chim.length ? mergeGeometries(chim) : null, PropMat.stone], [doorG, door]] });
  };
  mk('cottage', 8, 6, 5.6, 2.8, mStone, rSlate, [-3.2]);
  mk('thatch', 9, 5.5, 3.2, 3.4, mRender, rThatch, [3.5], { doorX: -1 });
  mk('terrace', 16, 7, 5.6, 3.0, mBrick, rSlate, [-5.3, 0, 5.3], { doorX: -4 });
  mk('house', 10, 8, 5.6, 3.2, mRender, rTile, [3.8]);
  mk('stonehouse', 12, 7.5, 5.6, 3.2, mStone, rTile, [-5, 5]);
  mk('barn', 15, 9, 5.0, 4.0, mBarn, rSlate, []);
  return V;
}

function buildVillages() {
  const variants = buildingVariants();
  const placed = variants.map(() => []);
  const fp = []; // footprints for overlap checks
  const ok = (x, z, R) => {
    for (const f of fp) if (Math.hypot(f[0] - x, f[1] - z) < f[2] + R) return false;
    return true;
  };
  reseed(777);
  for (const p of PLACES) {
    if (p.kind !== 'village') continue;
    let count = 0;
    const special = [];
    for (const road of World.roads) {
      for (let k = 4; k < road.n - 4; k += 2) {
        const dc = Math.hypot(road.x[k] - p.x, road.z[k] - p.z);
        if (dc > p.r * 0.92) continue;
        for (const sd of [1, -1]) {
          if (rng() < 0.28) continue;
          const vi = dc > p.r * 0.7 ? (rng() < 0.45 ? 5 : 1) : [0, 1, 2, 3, 4, 0, 2][(rng() * 7) | 0];
          const V = variants[vi];
          const lx = road.tz[k] * sd, lz = -road.tx[k] * sd;
          const off = road.hw + 3.2 + V.d / 2;
          const x = road.x[k] + lx * off, z = road.z[k] + lz * off;
          const R = Math.hypot(V.w, V.d) / 2;
          if (!ok(x, z, R)) continue;
          // all four corners must be clear of every road and water
          const ang = Math.atan2(-lx, -lz); // building +z faces the road
          const c = Math.cos(ang), s = Math.sin(ang);
          let bad = false, hmin = 1e9, hmax = -1e9;
          for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1], [0, 0]]) {
            const cx = x + (a * V.w / 2) * c + (b * V.d / 2) * s, cz = z - (a * V.w / 2) * s + (b * V.d / 2) * c;
            const q = roadAt(cx, cz);
            if (q && q.d < 1.6) bad = true;
            if (waterAt(cx, cz) > hAt(cx, cz) - 1) bad = true;
            if (Math.hypot(cx - PLAZA.x, cz - PLAZA.z) < PLAZA.r + 15) bad = true;
            const h = hAt(cx, cz); hmin = Math.min(hmin, h); hmax = Math.max(hmax, h);
          }
          if (bad || hmax - hmin > 3.5) continue;
          fp.push([x, z, R]);
          placed[vi].push([x, hmin - 0.4, z, ang, hmax - hmin + 0.4]);
          Col.box(x, z, V.w / 2, V.d / 2, ang, 'building');
          count++;
          // streetlight in front, every few houses
          if (count % 3 === 0) addLamp(road.x[k] + lx * (road.hw + 1.4), road.z[k] + lz * (road.hw + 1.4), ang);
          if (count > p.houses) break;
        }
        if (count > p.houses) break;
      }
      if (count > p.houses) break;
    }
    special.push(p);
    // church + pub near the centre, away from roads
    buildChurch(p, ok, fp);
  }
  const o = new THREE.Object3D();
  variants.forEach((V, vi) => {
    const list = placed[vi];
    if (!list.length) return;
    for (const [geo, mat] of V.parts) {
      if (!geo) continue;
      const m = new THREE.InstancedMesh(geo, mat, list.length);
      list.forEach((p, i) => {
        o.position.set(p[0], p[1], p[2]); o.rotation.set(0, p[3], 0); o.scale.set(1, 1, 1);
        o.updateMatrix(); m.setMatrixAt(i, o.matrix);
      });
      m.castShadow = m.receiveShadow = true;
      Props.group.add(m);
    }
    // foundations to hide slopes
    const fm = new THREE.InstancedMesh(new THREE.BoxGeometry(V.w + 0.3, 1, V.d + 0.3).translate(0, -0.5, 0), PropMat.stone, list.length);
    list.forEach((p, i) => { o.position.set(p[0], p[1] + 0.45, p[2]); o.rotation.set(0, p[3], 0); o.scale.set(1, p[4] + 0.6, 1); o.updateMatrix(); fm.setMatrixAt(i, o.matrix); });
    fm.receiveShadow = true;
    Props.group.add(fm);
  });
}
function buildChurch(p, ok, fp) {
  // find a free spot near the village centre
  for (let t = 0; t < 60; t++) {
    const a = t * 2.4, r = 25 + t * 2;
    const x = p.x + Math.cos(a) * r, z = p.z + Math.sin(a) * r;
    const q = roadAt(x, z);
    if (q && q.d < 14) continue;
    if (!ok(x, z, 16)) continue;
    if (waterAt(x, z) > hAt(x, z) - 1) continue;
    const ang = q ? Math.atan2(q.road.tx[q.k], q.road.tz[q.k]) : 0;
    const h = hAt(x, z) - 0.3;
    const g = new THREE.Group();
    const stone = PropMat.stone;
    const nave = new THREE.Mesh(facadeBox(20, 7, 9), Props.buildingMats[0]);
    const roof = new THREE.Mesh(gableRoof(9, 20, 5).rotateY(Math.PI / 2).translate(0, 7, 0), new THREE.MeshStandardMaterial({ color: 0x4d535c, roughness: 0.6 }));
    const ends = new THREE.Mesh(gableEnds(9, 20, 5).rotateY(Math.PI / 2).translate(0, 7, 0), stone);
    nave.rotation.y = Math.PI / 2;
    const tower = new THREE.Mesh(new THREE.BoxGeometry(6, 18, 6).translate(0, 9, 0), stone);
    tower.position.z = -12.5;
    g.add(nave, roof, ends, tower);
    for (let i = 0; i < 4; i++) { // battlements + pinnacles
      const pn = new THREE.Mesh(new THREE.ConeGeometry(0.45, 2.4, 4).translate(0, 19.2, 0), stone);
      pn.position.set((i & 1 ? 1 : -1) * 2.6, 0, -12.5 + (i & 2 ? 1 : -1) * 2.6);
      g.add(pn);
    }
    const clock = new THREE.Mesh(new THREE.CircleGeometry(1.1, 24), new THREE.MeshStandardMaterial({ color: 0xf2efe6, emissive: 0xffe6b0, emissiveIntensity: 0 }));
    clock.position.set(0, 14, -9.45);
    Props.buildingMats.push(clock.material);
    g.add(clock);
    g.position.set(x, h, z);
    g.rotation.y = ang;
    g.traverse((o) => { o.castShadow = o.receiveShadow = true; });
    Props.group.add(g);
    fp.push([x, z, 16]);
    Col.box(x, z, 4.6, 10.2, ang, 'building');
    const c = Math.cos(ang), s = Math.sin(ang);
    Col.box(x - 12.5 * s, z - 12.5 * c, 3.1, 3.1, ang, 'building');
    // churchyard wall + a few yew trees
    return;
  }
}

/* ---------- street lights ---------- */
function addLamp(x, z, ang, tall = 6) {
  Props.lamps.push([x, hAt(x, z), z, ang, tall]);
  Col.circle(x, z, 0.2, 'post');
}
function buildLamps() {
  // festival plaza ring + approach
  for (let a = 0; a < TAU; a += TAU / 22) addLamp(PLAZA.x + Math.cos(a) * (PLAZA.r + 2.5), PLAZA.z + Math.sin(a) * (PLAZA.r + 2.5), -a - Math.PI / 2, 7);
  const ap = World.byId.A9;
  for (let k = 8; k < ap.n - 4; k += 12) for (const sd of [1, -1]) addLamp(ap.x[k] + ap.tz[k] * sd * (ap.hw + 1.5), ap.z[k] - ap.tx[k] * sd * (ap.hw + 1.5), 0, 7);
  const L = Props.lamps;
  const o = new THREE.Object3D();
  const pole = new THREE.CylinderGeometry(0.07, 0.11, 1, 8).translate(0, 0.5, 0);
  const head = new THREE.BoxGeometry(0.35, 0.14, 0.7).translate(0, 0, 0.55);
  const bulb = new THREE.BoxGeometry(0.26, 0.04, 0.5).translate(0, -0.08, 0.55);
  const pm = new THREE.InstancedMesh(pole, PropMat.dark, L.length), hm = new THREE.InstancedMesh(head, PropMat.dark, L.length), bm = new THREE.InstancedMesh(bulb, PropMat.lamp, L.length);
  L.forEach((p, i) => {
    o.position.set(p[0], p[1], p[2]); o.rotation.set(0, 0, 0); o.scale.set(1, p[4], 1); o.updateMatrix(); pm.setMatrixAt(i, o.matrix);
    // point the head towards the road (nearest road centre)
    const q = roadAt(p[0], p[2]);
    let ang = p[3];
    if (q) { const k = q.k; ang = Math.atan2(World.SX[k] - p[0], World.SZ[k] - p[2]); }
    p[3] = ang;
    o.position.set(p[0], p[1] + p[4], p[2]); o.rotation.set(0, ang, 0); o.scale.set(1, 1, 1); o.updateMatrix(); hm.setMatrixAt(i, o.matrix); bm.setMatrixAt(i, o.matrix);
  });
  pm.castShadow = hm.castShadow = true;
  Props.group.add(pm, hm, bm);
  // light pool positions (just below the lamp head)
  Props.lampSpots = L.map((p) => new THREE.Vector3(p[0] + Math.sin(p[3]) * 0.55, p[1] + p[4] - 0.3, p[2] + Math.cos(p[3]) * 0.55));
}

/* ---------- water ---------- */
function makeWaterMaterial() {
  const nm = canvasTex(256, 256, (x, w, h) => {
    const img = x.createImageData(w, h);
    const hgt = (i, j) => { const u = i / w * 8, v = j / h * 8; let s = 0, a = 0.5, f = 1; for (let o = 0; o < 4; o++) { s += a * (Math.sin((u * f + Math.sin(v * f * 1.3) * 0.8) * TAU / 8 * 2) + Math.cos((v * f + Math.sin(u * f * 0.9)) * TAU / 8 * 3)); a *= 0.5; f *= 2; } return s; };
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const dx = hgt(i + 1, j) - hgt(i - 1, j), dy = hgt(i, j + 1) - hgt(i, j - 1);
      const n = new THREE.Vector3(-dx * 2, -dy * 2, 1).normalize();
      const k = (j * w + i) * 4;
      img.data[k] = (n.x * 0.5 + 0.5) * 255; img.data[k + 1] = (n.y * 0.5 + 0.5) * 255; img.data[k + 2] = (n.z * 0.5 + 0.5) * 255; img.data[k + 3] = 255;
    }
    x.putImageData(img, 0, 0);
  }, { srgb: false });
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.05, metalness: 0.0, normalMap: nm, normalScale: new THREE.Vector2(0.35, 0.35), transparent: true, opacity: 0.92, envMapIntensity: 1.45 });
  m.userData.u = { uTime: Props.uTime, uFlow: { value: new THREE.Vector2(0, 0) }, tHM: { value: Props.heightTex } };
  const N = GN / 2 + 1;
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, m.userData.u);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPw;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvWPw = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
uniform float uTime; uniform sampler2D tHM; varying vec3 vWPw;
float bedHeight(vec2 p) {
  vec2 f = (p + ${HALF.toFixed(1)}) / 4.0; ivec2 i = clamp(ivec2(floor(f)), ivec2(0), ivec2(${N - 2})); vec2 t = fract(f);
  float a = texelFetch(tHM, i, 0).r, b = texelFetch(tHM, i + ivec2(1, 0), 0).r, c = texelFetch(tHM, i + ivec2(0, 1), 0).r, d = texelFetch(tHM, i + ivec2(1, 1), 0).r;
  return mix(mix(a, b, t.x), mix(c, d, t.x), t.y);
}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
// depth tint: clear and green-brown in the shallows, dark peat-blue in deep water
float wDepth = max(vWPw.y - bedHeight(vWPw.xz), 0.0);
float dk = 1.0 - exp(-wDepth * 0.5);
diffuseColor.rgb = mix(vec3(0.2, 0.34, 0.27), mix(vec3(0.03, 0.12, 0.14), vec3(0.015, 0.06, 0.09), smoothstep(2.0, 7.0, wDepth)), dk);
// lapping foam along the banks
float fn = texture2D(normalMap, vWPw.xz * 0.19 + vec2(uTime * 0.03, uTime * 0.011)).r;
float foam = (1.0 - smoothstep(0.04, 0.6, wDepth)) * smoothstep(0.42, 0.72, fn + 0.22 * sin(uTime * 1.4 - wDepth * 12.0));
diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.86, 0.9, 0.9), foam * 0.75);
diffuseColor.a *= mix(0.45, 1.0, smoothstep(0.0, 1.4, wDepth)) + foam * 0.4;`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.55, foam);')
      .replace('#include <normal_fragment_maps>', `
vec3 n1 = texture2D(normalMap, vWPw.xz * 0.045 + vec2(uTime * 0.012, uTime * 0.02)).xyz * 2.0 - 1.0;
vec3 n2 = texture2D(normalMap, vWPw.xz * 0.11 - vec2(uTime * 0.025, -uTime * 0.01)).xyz * 2.0 - 1.0;
vec3 mapN = normalize(vec3((n1.xy + n2.xy) * normalScale, 1.0));
normal = normalize(tbn * mapN);`);
  };
  Props.waterMats.push(m);
  return m;
}
function buildWater() {
  const mat = makeWaterMaterial();
  // lake: ellipse slightly bigger than the shore line (banks hide the edge)
  const lg = new THREE.CircleGeometry(1, 96).rotateX(-Math.PI / 2);
  const lake = new THREE.Mesh(lg, mat);
  lake.scale.set(LAKE.rx * 1.45, 1, LAKE.rz * 1.45);
  lake.rotation.y = LAKE.rot;
  lake.position.set(LAKE.x, LAKE.level, LAKE.z);
  lake.receiveShadow = true;
  // compute tangents for normal mapping on a plane: three uses derivative-based TBN, fine
  Props.group.add(lake);
  // river ribbon following the water level
  const r = World.river, pos = [], idx = [], uv = [];
  for (let i = 0; i < r.N; i++) {
    const a = r.P[Math.max(0, i - 1)], b = r.P[Math.min(r.N - 1, i + 1)];
    const dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1;
    const lx = dz / l, lz = -dx / l, w = r.hw[i] + 9;
    pos.push(r.P[i][0] + lx * w, r.wl[i], r.P[i][1] + lz * w, r.P[i][0] - lx * w, r.wl[i], r.P[i][1] - lz * w);
    uv.push(0, i, 1, i);
    if (i < r.N - 1) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  const river = new THREE.Mesh(g, mat);
  river.receiveShadow = true;
  Props.group.add(river);
}
