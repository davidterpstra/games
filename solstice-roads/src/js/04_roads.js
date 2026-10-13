/* =====================================================================
   Road meshes and road furniture: textured ribbons with markings,
   junction pads, the festival plaza, bridges, the Fellside tunnel,
   guard rails, dry-stone walls and signs.
   ===================================================================== */
const RoadGfx = { group: new THREE.Group(), materials: [], lampSpots: [], tunnelLights: [] };
const ROAD_TEX_LEN = 18; // metres of road per texture repeat

function makeRoadTexture(type) {
  const T = ROAD_TYPES[type], W = 256, Hh = 1024;
  const span = 2 * (T.hw + 0.6);
  const U = (off) => (off + span / 2) / span * W; // lateral offset (m) -> px
  const V = (m) => m / ROAD_TEX_LEN * Hh;
  return canvasTex(W, Hh, (x) => {
    if (type === 'D') {
      noiseFill(x, W, Hh, 8, (n) => { const v = 0.72 + n * 0.5; return [150 * v, 128 * v, 98 * v]; });
      // compacted wheel ruts + grassy crown
      for (const o of [-1.0, 1.0]) {
        const g = x.createLinearGradient(U(o - 0.9), 0, U(o + 0.9), 0);
        g.addColorStop(0, 'rgba(70,55,40,0)'); g.addColorStop(0.5, 'rgba(70,55,40,0.45)'); g.addColorStop(1, 'rgba(70,55,40,0)');
        x.fillStyle = g; x.fillRect(U(o - 0.9), 0, U(o + 0.9) - U(o - 0.9), Hh);
      }
      for (let i = 0; i < 2500; i++) {
        const c = 90 + rng() * 120;
        x.fillStyle = `rgba(${c | 0},${c * 0.9 | 0},${c * 0.75 | 0},0.8)`;
        x.fillRect(rng() * W, rng() * Hh, 1 + rng() * 3, 1 + rng() * 3);
      }
      for (let i = 0; i < 900; i++) {
        const cx = U((rng() - 0.5) * 0.7), cy = rng() * Hh;
        x.strokeStyle = `rgba(${60 + rng() * 40 | 0},${110 + rng() * 60 | 0},${40 + rng() * 20 | 0},0.7)`;
        x.beginPath(); x.moveTo(cx, cy); x.lineTo(cx + (rng() - 0.5) * 3, cy - 3 - rng() * 6); x.stroke();
      }
      for (const sd of [0, 1]) { // ragged grass edges
        for (let i = 0; i < 700; i++) {
          const cx = sd ? W - rng() * rng() * 30 : rng() * rng() * 30, cy = rng() * Hh;
          x.strokeStyle = `rgba(${60 + rng() * 40 | 0},${100 + rng() * 60 | 0},${40 + rng() * 20 | 0},0.8)`;
          x.beginPath(); x.moveTo(cx, cy); x.lineTo(cx + (rng() - 0.5) * 4, cy - 4 - rng() * 6); x.stroke();
        }
      }
      return;
    }
    noiseFill(x, W, Hh, 24, (n) => { const v = 0.78 + n * 0.32; return [62 * v, 63 * v, 66 * v]; });
    // aggregate
    for (let i = 0; i < 26000; i++) {
      const c = rng() < 0.5 ? 30 + rng() * 30 : 90 + rng() * 70;
      x.fillStyle = `rgba(${c | 0},${c | 0},${c * 1.02 | 0},${0.35 + rng() * 0.4})`;
      x.fillRect(rng() * W, rng() * Hh, 1 + rng() * 1.6, 1 + rng() * 1.6);
    }
    // worn wheel tracks (darker, polished)
    const tracks = type === 'B' ? [-1.6, 1.6] : [-T.hw * 0.5 - 0.8, -T.hw * 0.5 + 0.8, T.hw * 0.5 - 0.8, T.hw * 0.5 + 0.8];
    for (const o of tracks) {
      const g = x.createLinearGradient(U(o - 0.5), 0, U(o + 0.5), 0);
      g.addColorStop(0, 'rgba(15,15,18,0)'); g.addColorStop(0.5, 'rgba(15,15,18,0.28)'); g.addColorStop(1, 'rgba(15,15,18,0)');
      x.fillStyle = g; x.fillRect(U(o - 0.5), 0, U(o + 0.5) - U(o - 0.5), Hh);
    }
    // repair patches + cracks
    for (let i = 0; i < (type === 'B' ? 7 : 3); i++) {
      x.fillStyle = `rgba(${rng() < 0.5 ? '35,36,40' : '78,78,80'},${0.35 + rng() * 0.25})`;
      const pw = 20 + rng() * 60, ph = 30 + rng() * 140;
      x.fillRect(rng() * (W - pw), rng() * (Hh - ph), pw, ph);
    }
    x.strokeStyle = 'rgba(10,10,10,0.5)'; x.lineWidth = 1;
    for (let i = 0; i < 14; i++) {
      let px = rng() * W, py = rng() * Hh; x.beginPath(); x.moveTo(px, py);
      for (let k = 0; k < 6; k++) { px += (rng() - 0.5) * 20; py += (rng() - 0.5) * 30; x.lineTo(px, py); }
      x.stroke();
    }
    // edges: crumbling shoulder blending into gravel
    for (const sd of [0, 1]) {
      const e0 = sd ? U(T.hw) : 0, e1 = sd ? W : U(-T.hw);
      x.fillStyle = 'rgba(120,108,90,0.85)'; x.fillRect(e0, 0, e1 - e0, Hh);
      for (let i = 0; i < 1500; i++) {
        const c = 80 + rng() * 90;
        x.fillStyle = `rgba(${c | 0},${c * 0.92 | 0},${c * 0.8 | 0},0.9)`;
        x.fillRect(e0 + rng() * (e1 - e0) * 1.2 - (sd ? 4 : 0), rng() * Hh, 2, 2);
      }
    }
    const paint = (off, w, from, to) => {
      x.fillStyle = 'rgba(236,236,228,0.92)';
      x.fillRect(U(off - w / 2), V(from), Math.max(1.5, U(off + w / 2) - U(off - w / 2)), V(to) - V(from));
    };
    if (T.lines === 'center') {
      paint(-T.hw + 0.35, 0.15, 0, ROAD_TEX_LEN); paint(T.hw - 0.35, 0.15, 0, ROAD_TEX_LEN);
      paint(0, 0.14, 0, 3); paint(0, 0.14, 9, 12);
    } else if (T.lines === 'edge') {
      for (let m = 0; m < ROAD_TEX_LEN; m += 3) { paint(-T.hw + 0.3, 0.1, m, m + 1.5); paint(T.hw - 0.3, 0.1, m, m + 1.5); }
    }
    // weathering over the paint
    for (let i = 0; i < 5000; i++) { x.fillStyle = `rgba(50,50,52,${rng() * 0.5})`; x.fillRect(rng() * W, rng() * Hh, 1.5, 1.5); }
  });
}

function patchWetShader(mat, worldScale = 0.08) {
  mat.userData.u = mat.userData.u || {};
  Object.assign(mat.userData.u, { uWet: { value: 0 }, uSnowRoad: { value: 0 }, tPuddle: { value: RoadGfx.puddleTex } });
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, mat.userData.u);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPr;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvWPr = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uWet, uSnowRoad; uniform sampler2D tPuddle; varying vec3 vWPr;')
      .replace('#include <map_fragment>', `#include <map_fragment>
float pud = smoothstep(0.52, 0.7, texture2D(tPuddle, vWPr.xz * ${worldScale.toFixed(3)}).r);
diffuseColor.rgb *= mix(1.0, 0.5 - pud * 0.15, uWet);
// packed snow: patches on the tarmac, drifts along the verges, wheel tracks stay darker
float snp = smoothstep(0.5, 0.78, texture2D(tPuddle, vWPr.xz * 0.031 + 0.4).r);
#ifdef USE_MAP
float verge = smoothstep(0.41, 0.49, abs(vMapUv.x - 0.5));
#else
float verge = 0.0;
#endif
float sn = uSnowRoad * clamp(snp * 0.45 + verge, 0.0, 1.0);
diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.88, 0.91, 0.96), sn * 0.9);`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
roughnessFactor = mix(roughnessFactor, mix(0.3, 0.04, pud), uWet);`);
  };
  RoadGfx.materials.push(mat);
  return mat;
}

function roadMaterial(map, offset = -2) {
  const m = new THREE.MeshStandardMaterial({ map, roughness: 0.86, metalness: 0, envMapIntensity: 0.8, polygonOffset: true, polygonOffsetFactor: offset, polygonOffsetUnits: offset * 2 });
  return patchWetShader(m);
}

function buildRoadMeshes() {
  RoadGfx.puddleTex = canvasTex(256, 256, (x, w, h) => noiseFill(x, w, h, 5, (n) => [255 * n, 255 * n, 255 * n]), { srgb: false });
  const mats = {};
  for (const t of Object.keys(ROAD_TYPES)) mats[t] = roadMaterial(makeRoadTexture(t));
  for (const road of World.roads) {
    const N = road.n, hw = road.hw + 0.6;
    const pos = new Float32Array(N * 2 * 3), uv = new Float32Array(N * 2 * 2), nor = new Float32Array(N * 2 * 3);
    for (let k = 0; k < N; k++) {
      const lx = road.tz[k], lz = -road.tx[k]; // left = (tz, -tx)
      const y = road.y[k] + 0.07;
      for (let s = 0; s < 2; s++) {
        const o = s ? -hw : hw;
        const v = k * 2 + s;
        pos[v * 3] = road.x[k] + lx * o; pos[v * 3 + 1] = y; pos[v * 3 + 2] = road.z[k] + lz * o;
        uv[v * 2] = s ? 1 : 0; uv[v * 2 + 1] = road.s[k] / ROAD_TEX_LEN;
        nor[v * 3 + 1] = 1;
      }
    }
    const idx = [];
    for (let k = 0; k < N - 1; k++) { const a = k * 2; idx.push(a, a + 1, a + 2, a + 2, a + 1, a + 3); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, mats[road.type]);
    m.receiveShadow = true;
    RoadGfx.group.add(m);
  }

  // junction pads and the plaza
  const plain = canvasTex(256, 256, (x, w, h) => {
    noiseFill(x, w, h, 12, (n) => { const v = 0.78 + n * 0.3; return [62 * v, 63 * v, 66 * v]; });
    for (let i = 0; i < 9000; i++) { const c = rng() < 0.5 ? 35 : 120; x.fillStyle = `rgba(${c},${c},${c},0.4)`; x.fillRect(rng() * w, rng() * h, 1.4, 1.4); }
  });
  const gravel = canvasTex(256, 256, (x, w, h) => {
    noiseFill(x, w, h, 8, (n) => { const v = 0.72 + n * 0.5; return [150 * v, 128 * v, 98 * v]; });
  });
  const padMat = roadMaterial(plain, -4), gravMat = roadMaterial(gravel, -4);
  const deg = {};
  for (const r of World.roads) { (deg[r.def.a] ||= []).push(r); (deg[r.def.b] ||= []).push(r); }
  for (const k in NODES) {
    const [x, z] = NODES[k];
    if (Math.hypot(x - PLAZA.x, z - PLAZA.z) < PLAZA.r + 4) continue;
    const rs = deg[k] || [];
    if (rs.length < 2) continue;
    const r = Math.max(...rs.map((q) => q.hw)) + 1.6;
    const g = new THREE.CircleGeometry(r, 40).rotateX(-Math.PI / 2);
    const uvA = g.attributes.uv;
    for (let i = 0; i < uvA.count; i++) uvA.setXY(i, (uvA.getX(i) - 0.5) * r / 4, (uvA.getY(i) - 0.5) * r / 4);
    const allDirt = rs.every((q) => q.type === 'D');
    const m = new THREE.Mesh(g, allDirt ? gravMat : padMat);
    m.position.set(x, World.nodeH[k] + 0.075, z);
    m.receiveShadow = true;
    RoadGfx.group.add(m);
  }
  // festival plaza: pale concrete slabs with a painted ring
  const pz = canvasTex(512, 512, (x, w, h) => {
    noiseFill(x, w, h, 10, (n) => { const v = 0.8 + n * 0.25; return [168 * v, 164 * v, 156 * v]; });
    x.strokeStyle = 'rgba(70,66,60,0.55)'; x.lineWidth = 2;
    for (let i = 0; i <= 8; i++) { x.beginPath(); x.moveTo(i * 64, 0); x.lineTo(i * 64, 512); x.stroke(); x.beginPath(); x.moveTo(0, i * 64); x.lineTo(512, i * 64); x.stroke(); }
    for (let i = 0; i < 40; i++) { x.fillStyle = `rgba(60,60,60,${rng() * 0.12})`; x.fillRect((rng() * 8 | 0) * 64, (rng() * 8 | 0) * 64, 64, 64); }
  });
  pz.repeat.set(10, 10);
  const plazaMat = patchWetShader(new THREE.MeshStandardMaterial({ map: pz, roughness: 0.82, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -8 }));
  const pg = new THREE.CircleGeometry(PLAZA.r + 1, 96).rotateX(-Math.PI / 2);
  const plaza = new THREE.Mesh(pg, plazaMat);
  plaza.position.set(PLAZA.x, World.plazaH + 0.08, PLAZA.z);
  plaza.receiveShadow = true;
  RoadGfx.group.add(plaza);
  const ringTex = new THREE.MeshStandardMaterial({ color: 0xff3d7f, roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -12 });
  const ring = new THREE.Mesh(new THREE.RingGeometry(PLAZA.r - 4, PLAZA.r - 3.3, 96).rotateX(-Math.PI / 2), ringTex);
  ring.position.set(PLAZA.x, World.plazaH + 0.09, PLAZA.z);
  RoadGfx.group.add(ring);

  buildBridges();
  buildTunnel();
  buildRails();
  buildSigns();
  mergeByMaterial(RoadGfx.group, []);
}

/* ---------- shared props materials ---------- */
const PropMat = {};
function initPropMaterials() {
  const stone = canvasTex(512, 256, (x, w, h) => {
    x.fillStyle = '#7d776c'; x.fillRect(0, 0, w, h);
    for (let row = 0; row < 10; row++) {
      let cx = -rng() * 30;
      const y0 = row * h / 10;
      while (cx < w) {
        const bw = 26 + rng() * 40, v = 90 + rng() * 70;
        x.fillStyle = `rgb(${v | 0},${v * 0.95 | 0},${v * 0.86 | 0})`;
        x.beginPath();
        x.roundRect(cx + 1.5, y0 + 1.5, bw - 3, h / 10 - 3, 5);
        x.fill();
        cx += bw;
      }
    }
    noiseOverlay(x, w, h, 0.18);
  });
  PropMat.stone = new THREE.MeshStandardMaterial({ map: stone, roughness: 0.95 });
  PropMat.stone2 = new THREE.MeshStandardMaterial({ map: stone, roughness: 0.95, side: THREE.DoubleSide });
  PropMat.concrete = new THREE.MeshStandardMaterial({ color: 0x9a978f, roughness: 0.9, map: canvasTex(256, 256, (x, w, h) => noiseFill(x, w, h, 8, (n) => { const v = 0.8 + n * 0.3; return [180 * v, 178 * v, 170 * v]; })) });
  PropMat.metal = new THREE.MeshStandardMaterial({ color: 0xb8bec6, metalness: 0.85, roughness: 0.35 });
  PropMat.dark = new THREE.MeshStandardMaterial({ color: 0x3d444b, roughness: 0.55, metalness: 0.45 });
  PropMat.wood = new THREE.MeshStandardMaterial({ color: 0x6e5236, roughness: 0.9 });
  PropMat.white = new THREE.MeshStandardMaterial({ color: 0xeeeeea, roughness: 0.6 });
  PropMat.lamp = new THREE.MeshStandardMaterial({ color: 0xfff1d0, emissive: 0xffc36b, emissiveIntensity: 0 });
  PropMat.tunnel = new THREE.MeshStandardMaterial({ color: 0xc9c4b8, roughness: 0.8, side: THREE.DoubleSide, map: PropMat.concrete.map });
  PropMat.tunnelLamp = new THREE.MeshStandardMaterial({ color: 0xffe2a8, emissive: 0xffd28a, emissiveIntensity: 2.5 });
}
function noiseOverlay(x, w, h, a) {
  for (let i = 0; i < w * h / 6; i++) { const c = rng() < 0.5 ? 0 : 255; x.fillStyle = `rgba(${c},${c},${c},${rng() * a})`; x.fillRect(rng() * w, rng() * h, 1.5, 1.5); }
}

/* Extrude a 2D profile (lateral offset, height) along a road range. */
function sweep(road, k0, k1, profile, closed = false, uScale = 0.25) {
  const pos = [], uv = [], idx = [];
  const n = profile.length;
  for (let k = k0; k <= k1; k++) {
    const lx = road.tz[k], lz = -road.tx[k];
    let u = 0;
    for (let p = 0; p < n; p++) {
      const [o, h] = profile[p];
      if (p) u += Math.hypot(o - profile[p - 1][0], h - profile[p - 1][1]);
      pos.push(road.x[k] + lx * o, road.y[k] + h, road.z[k] + lz * o);
      uv.push(u * uScale, road.s[k] * uScale);
    }
  }
  const rows = k1 - k0 + 1;
  for (let r = 0; r < rows - 1; r++) for (let p = 0; p < n - (closed ? 0 : 1); p++) {
    const a = r * n + p, b = r * n + (p + 1) % n, c = a + n, d = b + n;
    idx.push(a, b, c, b, d, c);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}
function flagRanges(road, f) {
  const out = [];
  let k = 0;
  while (k < road.n) {
    if (road.flag[k] !== f) { k++; continue; }
    let j = k;
    while (j < road.n && road.flag[j] === f) j++;
    out.push([Math.max(0, k - 1), Math.min(road.n - 1, j)]);
    k = j;
  }
  return out;
}

function buildBridges() {
  for (const road of World.roads) for (const [k0, k1] of flagRanges(road, 1)) {
    const hw = road.hw + 0.6;
    // deck slab + stone parapets
    const deck = sweep(road, k0, k1, [[hw + 0.6, 1.0], [hw + 0.6, -1.3], [-hw - 0.6, -1.3], [-hw - 0.6, 1.0], [-hw, 1.0], [-hw, 0.05]], false, 0.3);
    const deck2 = sweep(road, k0, k1, [[hw, 0.05], [hw, 1.0], [hw + 0.6, 1.0]], false, 0.3);
    const m = new THREE.Mesh(mergeGeometries([deck, deck2]), PropMat.stone2);
    m.castShadow = m.receiveShadow = true;
    RoadGfx.group.add(m);
    // piers + parapet colliders
    for (let k = k0; k <= k1; k++) {
      const lx = road.tz[k], lz = -road.tx[k];
      if (k < k1) for (const sd of [1, -1]) {
        const o = sd * (hw + 0.3);
        Col.wall(road.x[k] + lx * o, road.z[k] + lz * o, road.x[k + 1] + lx * o, road.z[k + 1] + lz * o, 0.3, 'wall');
      }
      if ((k - k0) % 9 === 4 && k < k1 - 3) {
        const gy = hAt(road.x[k], road.z[k]);
        const top = road.y[k] - 1.3, hgt = top - gy + 2;
        if (hgt > 1) {
          const p = new THREE.Mesh(new THREE.BoxGeometry(hw * 2 + 0.6, hgt, 2.2), PropMat.stone);
          p.position.set(road.x[k], top - hgt / 2, road.z[k]);
          p.rotation.y = Math.atan2(road.tx[k], road.tz[k]);
          p.castShadow = p.receiveShadow = true;
          RoadGfx.group.add(p);
        }
      }
    }
  }
}

function buildTunnel() {
  for (const road of World.roads) for (const [k0, k1] of flagRanges(road, 2)) {
    const hw = road.hw + 0.9;
    // inner tube (arch), seen from inside
    const prof = [[-hw, 0], [-hw, 3.8]];
    for (let a = 1; a < 12; a++) { const t = a / 12 * Math.PI; prof.push([-Math.cos(t) * hw, 3.8 + Math.sin(t) * 3.2]); }
    prof.push([hw, 3.8], [hw, 0]);
    const tube = new THREE.Mesh(sweep(road, k0, k1, prof, false, 0.2), PropMat.tunnel);
    tube.receiveShadow = true;
    tube.castShadow = true;
    RoadGfx.group.add(tube);
    // lights along the ceiling + wall colliders
    for (let k = k0; k <= k1; k++) {
      const lx = road.tz[k], lz = -road.tx[k];
      if (k < k1) for (const sd of [1, -1]) {
        const o = sd * (hw - 0.2);
        Col.wall(road.x[k] + lx * o, road.z[k] + lz * o, road.x[k + 1] + lx * o, road.z[k + 1] + lz * o, 0.3, 'wall');
      }
      if ((k - k0) % 5 === 0) {
        const l = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 2.2), PropMat.tunnelLamp);
        l.position.set(road.x[k], road.y[k] + 6.9, road.z[k]);
        l.rotation.y = Math.atan2(road.tx[k], road.tz[k]);
        RoadGfx.group.add(l);
        RoadGfx.tunnelLights.push(l.position.clone());
      }
    }
    // lid: closes the cutting at the hill surface, uses the terrain material
    const W = hw + 7;
    const pos = [], spl = [], tin = [], idx = [];
    const cols = 8;
    for (let k = k0; k <= k1; k++) {
      const lx = road.tz[k], lz = -road.tx[k];
      const xl = road.x[k] + lx * W, zl = road.z[k] + lz * W, xr = road.x[k] - lx * W, zr = road.z[k] - lz * W;
      const hl = hAt(xl, zl), hr2 = hAt(xr, zr);
      for (let c = 0; c <= cols; c++) {
        const t = c / cols, o = lerp(W, -W, t);
        const y = Math.max(lerp(hl, hr2, t) + Math.sin(t * Math.PI) * 1.5, road.y[k] + 8);
        pos.push(road.x[k] + lx * o, y, road.z[k] + lz * o);
        spl.push(0.85, 0.1, 0.05, 0); tin.push(1, 1, 0.9);
      }
    }
    for (let r = 0; r < k1 - k0; r++) for (let c = 0; c < cols; c++) {
      const a = r * (cols + 1) + c, b = a + 1, d = a + cols + 1, e = d + 1;
      idx.push(a, b, d, b, e, d);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('splat', new THREE.Float32BufferAttribute(spl, 4));
    g.setAttribute('tint', new THREE.Float32BufferAttribute(tin, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    const lid = new THREE.Mesh(g, Terrain.material);
    lid.castShadow = lid.receiveShadow = true;
    RoadGfx.group.add(lid);
    // stone portals with an arch opening
    for (const k of [k0, k1]) {
      const sh = new THREE.Shape();
      const PW = hw + 7, top = Math.max(hAt(road.x[k], road.z[k]) - road.y[k] + 2, 10);
      sh.moveTo(-PW, -1); sh.lineTo(PW, -1); sh.lineTo(PW, top); sh.lineTo(-PW, top); sh.lineTo(-PW, -1);
      const hole = new THREE.Path();
      hole.moveTo(-hw, 0); hole.lineTo(hw, 0); hole.lineTo(hw, 3.8);
      for (let a = 1; a < 16; a++) { const t = a / 16 * Math.PI; hole.lineTo(Math.cos(t) * hw, 3.8 + Math.sin(t) * 3.2); }
      hole.lineTo(-hw, 3.8); hole.lineTo(-hw, 0);
      sh.holes.push(hole);
      const pg = new THREE.ExtrudeGeometry(sh, { depth: 1.6, bevelEnabled: false });
      pg.translate(0, 0, -0.8);
      const uvs = pg.attributes.uv;
      for (let i = 0; i < uvs.count; i++) uvs.setXY(i, uvs.getX(i) * 0.12, uvs.getY(i) * 0.12);
      const p = new THREE.Mesh(pg, PropMat.stone);
      p.position.set(road.x[k], road.y[k], road.z[k]);
      p.rotation.y = Math.atan2(road.tx[k], road.tz[k]);
      p.castShadow = p.receiveShadow = true;
      RoadGfx.group.add(p);
    }
  }
}

/* Guard rails (mountain pass + embankments) and dry-stone walls (farmland). */
function buildRails() {
  const posts = [], rails = [], walls = [];
  const deg = {};
  for (const r of World.roads) { deg[r.def.a] = (deg[r.def.a] || 0) + 1; deg[r.def.b] = (deg[r.def.b] || 0) + 1; }
  for (const road of World.roads) {
    const step = 2; // samples (4 m)
    for (let k = 0; k + step < road.n; k += step) {
      if (road.flag[k] || road.flag[k + step]) continue;
      if (road.s[k] < 22 || road.len - road.s[k] < 22) continue; // keep junctions open
      for (const sd of [1, -1]) {
        const lx = road.tz[k] * sd, lz = -road.tx[k] * sd;
        const lx2 = road.tz[k + step] * sd, lz2 = -road.tx[k + step] * sd;
        const off = road.hw + 1.6;
        const ax = road.x[k] + lx * off, az = road.z[k] + lz * off, bx = road.x[k + step] + lx2 * off, bz = road.z[k + step] + lz2 * off;
        // skip if another road is closer here (junction areas, parallel roads)
        const rq = roadAt(ax, az);
        if (!rq || rq.road !== road || rq.d < 0.8) continue;
        if (Math.hypot(ax - PLAZA.x, az - PLAZA.z) < PLAZA.r + 10) continue;
        const drop = road.y[k] - hAt(road.x[k] + lx * (off + 6), road.z[k] + lz * (off + 6));
        const ay = hAt(ax, az), by = hAt(bx, bz);
        if (road.T.rails && (drop > 1.2 || road.type === 'M' && sd * curvSign(road, k) < 0) || drop > 3) {
          posts.push([ax, ay, az]);
          rails.push([ax, ay + 0.62, az, bx, by + 0.62, bz]);
          Col.wall(ax, az, bx, bz, 0.15, 'rail');
        } else if (road.type !== 'D' && road.type !== 'M' && farmMask(ax, az) > 0.35 && placeKind(ax, az) !== 'village') {
          walls.push([ax + lx * 0.6, ay, az + lz * 0.6, bx + lx2 * 0.6, by, bz + lz2 * 0.6]);
          Col.wall(ax + lx * 0.6, az + lz * 0.6, bx + lx2 * 0.6, bz + lz2 * 0.6, 0.35, 'wall');
        }
      }
    }
  }
  const o = new THREE.Object3D();
  const pg = new THREE.BoxGeometry(0.16, 1.0, 0.16); pg.translate(0, 0.5, 0);
  const pm = new THREE.InstancedMesh(pg, PropMat.dark, posts.length);
  posts.forEach((p, i) => { o.position.set(p[0], p[1], p[2]); o.rotation.set(0, 0, 0); o.scale.set(1, 1, 1); o.updateMatrix(); pm.setMatrixAt(i, o.matrix); });
  pm.castShadow = true;
  const rg = new THREE.BoxGeometry(0.06, 0.34, 1);
  const rm = new THREE.InstancedMesh(rg, PropMat.metal, rails.length);
  rails.forEach((r, i) => {
    const dx = r[3] - r[0], dy = r[4] - r[1], dz = r[5] - r[2], hl = Math.hypot(dx, dz);
    o.position.set((r[0] + r[3]) / 2, (r[1] + r[4]) / 2, (r[2] + r[5]) / 2);
    o.rotation.order = 'YXZ'; o.rotation.set(-Math.atan2(dy, hl), Math.atan2(dx, dz), 0);
    o.scale.set(1, 1, Math.hypot(hl, dy) + 0.05); o.updateMatrix(); rm.setMatrixAt(i, o.matrix);
  });
  rm.castShadow = true;
  // stone wall: slightly irregular top
  const wg = new THREE.BoxGeometry(0.7, 1, 1, 1, 2, 4);
  { const a = wg.attributes.position; for (let i = 0; i < a.count; i++) if (a.getY(i) > 0.4) a.setY(i, a.getY(i) + (hash2(i, 3) - 0.5) * 0.12); wg.translate(0, 0.5, 0); wg.computeVertexNormals();
    const u = wg.attributes.uv; for (let i = 0; i < u.count; i++) u.setXY(i, u.getX(i) * 2, u.getY(i) * 0.5); }
  const wm = new THREE.InstancedMesh(wg, PropMat.stone, walls.length);
  walls.forEach((r, i) => {
    const dx = r[3] - r[0], dy = r[4] - r[1], dz = r[5] - r[2], hl = Math.hypot(dx, dz);
    o.position.set((r[0] + r[3]) / 2, Math.min(r[1], r[4]) - 0.1, (r[2] + r[5]) / 2);
    o.rotation.order = 'YXZ'; o.rotation.set(-Math.atan2(dy, hl) * 0.5, Math.atan2(dx, dz), 0);
    o.scale.set(1, 1.0 + hash2(i, 9) * 0.25 + Math.abs(dy) * 0.5, hl + 0.1); o.updateMatrix(); wm.setMatrixAt(i, o.matrix);
  });
  wm.castShadow = wm.receiveShadow = true;
  RoadGfx.group.add(pm, rm, wm);
}
function curvSign(road, k) {
  const a = Math.max(0, k - 6), b = Math.min(road.n - 1, k + 6);
  return road.tx[a] * road.tz[b] - road.tz[a] * road.tx[b]; // >0: turning right? sign only matters relatively
}
function placeKind(x, z) { const p = placeName(x, z); return p ? p.kind : ''; }

/* ---------- signs ---------- */
function signTexture(lines, { bg = '#1f5f3a', fg = '#fff', w = 512, h = 128, border = true } = {}) {
  return canvasTex(w, h, (x) => {
    x.fillStyle = bg; x.fillRect(0, 0, w, h);
    if (border) { x.strokeStyle = fg; x.lineWidth = 6; x.strokeRect(8, 8, w - 16, h - 16); }
    x.fillStyle = fg; x.textAlign = 'center'; x.textBaseline = 'middle';
    const fs = Math.min(64, (h - 30) / lines.length);
    x.font = `700 ${fs}px Saira, Arial, sans-serif`;
    lines.forEach((l, i) => x.fillText(l, w / 2, h / 2 + (i - (lines.length - 1) / 2) * fs * 1.1));
  }, { repeat: false });
}
function addSign(x, z, heading, tex, w = 2.2, h = 0.55, postH = 2.0) {
  const g = new THREE.Group();
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, postH + h, 8), PropMat.metal);
  post.position.y = (postH + h) / 2;
  const board = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.05), PropMat.metal);
  board.position.y = postH + h / 2;
  board.position.z = 0.06;
  tex.userData.mat ||= new THREE.MeshStandardMaterial({ map: tex, roughness: 0.5 });
  const face = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.98, h * 0.96), tex.userData.mat);
  face.position.set(0, postH + h / 2, 0.09);
  g.add(post, board, face);
  g.position.set(x, hAt(x, z), z);
  g.rotation.y = heading;
  g.traverse((o) => { o.castShadow = true; });
  RoadGfx.group.add(g);
  Col.circle(x, z, 0.15, 'post');
}
function buildSigns() {
  // village name boards where roads enter a village
  for (const p of PLACES) {
    if (p.kind !== 'village') continue;
    const tex = signTexture([p.name.toUpperCase()], { bg: '#f4f4ee', fg: '#1a1a1a' });
    for (const road of World.roads) {
      for (let k = 1; k < road.n; k++) {
        const d0 = Math.hypot(road.x[k - 1] - p.x, road.z[k - 1] - p.z), d1 = Math.hypot(road.x[k] - p.x, road.z[k] - p.z);
        const R = p.r * 0.95;
        if ((d0 - R) * (d1 - R) > 0) continue;
        const inward = d1 < d0 ? 1 : -1; // direction of travel that enters the village
        const lx = road.tz[k], lz = -road.tx[k];
        const o = road.hw + 2.2;
        // on the left verge (UK) facing traffic that drives in
        const sx = road.x[k] + lx * o * inward, sz = road.z[k] + lz * o * inward;
        addSign(sx, sz, Math.atan2(road.tx[k], road.tz[k]) + (inward > 0 ? Math.PI : 0), tex, 2.4, 0.7, 1.1);
      }
    }
  }
  // hairpin chevrons on the pass
  const chev = canvasTex(256, 128, (x, w, h) => {
    x.fillStyle = '#111'; x.fillRect(0, 0, w, h);
    x.fillStyle = '#fff';
    for (let i = 0; i < 3; i++) { x.beginPath(); const c = 50 + i * 75; x.moveTo(c - 25, 20); x.lineTo(c + 15, 64); x.lineTo(c - 25, 108); x.lineTo(c - 5, 108); x.lineTo(c + 35, 64); x.lineTo(c - 5, 20); x.fill(); }
  }, { repeat: false });
  const m1 = World.byId.M1;
  for (let k = 12; k < m1.n - 12; k += 6) {
    const a = k - 8, b = k + 8;
    const turn = wrapAngle(Math.atan2(m1.tx[b], m1.tz[b]) - Math.atan2(m1.tx[a], m1.tz[a]));
    if (Math.abs(turn) < 0.9) continue;
    const sd = turn > 0 ? -1 : 1; // outside of the bend
    const lx = m1.tz[k] * sd, lz = -m1.tx[k] * sd, o = m1.hw + 2.6;
    addSign(m1.x[k] + lx * o, m1.z[k] + lz * o, Math.atan2(m1.tx[k], m1.tz[k]) + Math.PI + (turn > 0 ? 0 : 0), chev, 1.3, 0.65, 0.5);
    k += 6;
  }
  // finger posts at junctions
  for (const k in NODES) {
    const [x, z] = NODES[k];
    if (Math.hypot(x - PLAZA.x, z - PLAZA.z) < PLAZA.r + 4) continue;
    const rs = World.roads.filter((r) => r.def.a === k || r.def.b === k);
    if (rs.length < 3) continue;
    const g = new THREE.Group();
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 3, 8), PropMat.white);
    post.position.y = 1.5;
    g.add(post);
    rs.forEach((r, i) => {
      const atA = r.def.a === k;
      const kk = atA ? 10 : r.n - 11;
      const dir = Math.atan2((atA ? 1 : -1) * r.tx[kk], (atA ? 1 : -1) * r.tz[kk]);
      const other = atA ? r.def.b : r.def.a;
      const dest = nodeLabel(other);
      const tex = signTexture([dest], { bg: '#fafaf5', fg: '#222', w: 512, h: 96 });
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.26, 1.6), PropMat.white);
      const face = new THREE.Mesh(new THREE.PlaneGeometry(1.55, 0.24), new THREE.MeshStandardMaterial({ map: tex }));
      const faceB = face.clone();
      face.position.x = 0.03; face.rotation.y = Math.PI / 2;
      faceB.position.x = -0.03; faceB.rotation.y = -Math.PI / 2; faceB.scale.x = -1;
      const holder = new THREE.Group();
      holder.add(arm, face, faceB);
      arm.position.z = face.position.z = faceB.position.z = 0.8;
      holder.position.y = 2.6 - i * 0.3;
      holder.rotation.y = dir;
      g.add(holder);
    });
    const rr0 = rs[0];
    const off = Math.max(...rs.map((r) => r.hw)) + 4;
    let px = x + off, pz = z + off;
    for (let t = 0; t < 8; t++) { const a = t / 8 * TAU + 0.4; const cx = x + Math.cos(a) * off, cz = z + Math.sin(a) * off; const q = roadAt(cx, cz); if (!q || q.d > 1.5) { px = cx; pz = cz; break; } }
    g.position.set(px, hAt(px, pz), pz);
    g.traverse((o) => { o.castShadow = true; });
    RoadGfx.group.add(g);
    Col.circle(px, pz, 0.15, 'post');
    void rr0;
  }
}
function nodeLabel(k) {
  const [x, z] = NODES[k];
  const p = placeName(x, z);
  if (p) return p.name;
  if (k === 'PS' || k === 'PW') return 'Grimstone Pass';
  if (k === 'MO') return 'Brackenmoor';
  if (k === 'SO') return 'Harrowfield';
  if (k === 'NE') return 'Hollin Wood';
  if (k === 'ML') return 'Mere Water';
  if (k === 'K2' || k === 'FX' || k === 'FJ') return k === 'K2' ? 'Kettlewick' : 'Festival';
  return 'Wendmoor';
}
