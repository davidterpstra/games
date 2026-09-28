/* =====================================================================
   RESOURCE NODES — trees, rocks, ore, wheat, berries, fish, crystals
   Deterministic placement (seeded) so saved ids stay valid.
   The server (ResourceService) owns hp/depletion; this module renders.
   ===================================================================== */
const NODE_TYPES = {
  oak: { res: 'wood', hits: 4, yield: 2, label: 'Chop Tree', respawn: 70, r: 0.8, act: 1, fx: 'wood', tree: true },
  oak_autumn: { res: 'wood', hits: 4, yield: 2, label: 'Chop Tree', respawn: 70, r: 0.8, act: 1, fx: 'leaf_autumn', tree: true },
  birch: { res: 'wood', hits: 3, yield: 2, label: 'Chop Tree', respawn: 60, r: 0.6, act: 1, fx: 'wood', tree: true },
  pine: { res: 'wood', hits: 4, yield: 2, label: 'Chop Tree', respawn: 70, r: 0.8, act: 1, fx: 'wood', tree: true },
  pine_snow: { res: 'wood', hits: 5, yield: 2, label: 'Chop Tree', respawn: 80, r: 0.8, act: 1, fx: 'wood', tree: true },
  rock: { res: 'stone', hits: 4, yield: 2, label: 'Mine Rock', respawn: 80, r: 1.0, act: 1, fx: 'stone' },
  iron: { res: 'iron', extra: { stone: 1 }, hits: 5, yield: 1, label: 'Mine Iron Ore', respawn: 120, r: 1.0, act: 1, fx: 'iron', minLevel: 1 },
  gold: { res: 'gold', hits: 6, yield: 1, label: 'Mine Gold', respawn: 200, r: 0.9, act: 1, fx: 'gold' },
  wheat: { res: 'wheat', hits: 1, yield: 4, label: 'Harvest Wheat', respawn: 45, r: 0.5, act: 4, fx: 'wheat', soft: true },
  berry: { res: 'food', hits: 2, yield: 2, label: 'Pick Berries', respawn: 60, r: 0.6, act: 4, fx: 'berry', soft: true },
  fish: { res: 'food', hits: 2, yield: 3, label: 'Fish', respawn: 40, r: 0, act: 4, fx: 'water', soft: true, fish: true },
  crystal: { res: 'gold', extra: { planks: 2 }, hits: 3, yield: 1, label: 'Collect Crystal', respawn: 180, r: 0.6, act: 1, fx: 'crystal', xp: 10 },
  star: { res: 'gold', extra: { planks: 4 }, hits: 3, yield: 2, label: 'Collect Star Fragment', respawn: -1, r: 0.6, act: 1, fx: 'crystal', xp: 25 },
};

const Nodes = {
  list: [], byId: new Map(), grid: new Map(), sets: {}, stumps: null, dynamic: [],
  geos() {
    const G = {};
    const oak = (c1, c2, c3) => {
      const g = new GB();
      g.cyl(0.2, 0.3, 1.9, 6, 0x7a5230, 0, 0, 0);
      g.cylC(0.08, 0.1, 0.9, 5, 0x7a5230, 0.35, 1.7, 0, 0, 0, -0.9);
      g.ico(1.45, c1, 0, 2.9, 0, 1, 0.9, 1, 0, 0.28).ico(1.05, c2, 0.75, 3.4, 0.35, 1, 0.9, 1, 0, 0.3).ico(1.0, c3, -0.7, 3.1, -0.45, 1, 0.9, 1, 0, 0.3).ico(0.8, c2, 0.1, 3.9, -0.3, 1, 0.9, 1, 0, 0.3);
      return g.build().main;
    };
    G.oak = oak(0x5da03f, 0x6fb34a, 0x4f9036);
    G.oak_autumn = oak(0xe0892f, 0xe8b04a, 0xd0602b);
    let g = new GB();
    g.cyl(0.15, 0.2, 3.0, 6, 0xeae6dc, 0, 0, 0);
    for (let i = 0; i < 5; i++) g.box(0.2, 0.06, 0.12, 0x3a3a3a, Math.cos(i * 2.3) * 0.13, 0.5 + i * 0.5, Math.sin(i * 2.3) * 0.13, i * 2.3);
    g.ico(0.95, 0x9ccc5a, 0, 3.2, 0, 1, 1.15, 1, 0, 0.3).ico(0.75, 0xb1d86a, 0.4, 3.8, 0.2, 1, 1.1, 1, 0, 0.3).ico(0.65, 0x8fc251, -0.35, 2.7, -0.3, 1, 1, 1, 0, 0.3);
    G.birch = g.build().main;
    const pine = (snow) => {
      const p = new GB();
      p.cyl(0.2, 0.27, 1.1, 6, 0x6b4a2e, 0, 0, 0);
      p.cone(1.55, 2.1, 7, 0x3f7d4a, 0, 0.8, 0).cone(1.2, 1.8, 7, 0x468a52, 0, 2.0, 0).cone(0.85, 1.6, 7, snow ? 0xdfe8ee : 0x4f975b, 0, 3.1, 0);
      if (snow) p.cone(1.25, 0.5, 7, 0xeef3f6, 0, 2.4, 0);
      return p.build().main;
    };
    G.pine = pine(false); G.pine_snow = pine(true);
    g = new GB(); g.dodec(0.95, 0x9a9890, 0, 0.45, 0, 1.25, 0.8, 1, 0.3).dodec(0.5, 0x86857e, 0.8, 0.25, 0.3, 1, 0.8, 1, 0.3).dodec(0.35, 0xaaa89f, -0.7, 0.2, -0.4, 1, 0.8, 1, 0.3);
    G.rock = g.build().main;
    g = new GB(); g.dodec(0.95, 0x6f6c68, 0, 0.45, 0, 1.2, 0.85, 1, 0.3).dodec(0.5, 0x5f5c58, 0.8, 0.25, 0.3, 1, 0.8, 1, 0.3);
    for (let i = 0; i < 6; i++) g._add(new THREE.OctahedronGeometry(0.2, 0), 0xc9703a, g._m(Math.cos(i * 1.3) * 0.75, 0.45 + (i % 3) * 0.28, Math.sin(i * 1.3) * 0.6, i, 0.5, 0, 1.2, 0.8, 1));
    G.iron = g.build().main;
    g = new GB(); g.dodec(0.85, 0x7d7a74, 0, 0.4, 0, 1.2, 0.85, 1, 0.3);
    for (let i = 0; i < 7; i++) g._add(new THREE.OctahedronGeometry(0.2, 0), 0xf2c230, g._m(Math.cos(i * 1.1) * 0.7, 0.4 + (i % 3) * 0.25, Math.sin(i * 1.1) * 0.55, i, 0.4, 0, 1, 0.8, 1));
    G.gold = g.build().main;
    g = new GB();
    for (let i = 0; i < 11; i++) {
      const a = i * 2.39, r = 0.12 + (i % 4) * 0.12, x = Math.cos(a) * r, z = Math.sin(a) * r, hh = 0.9 + (i % 3) * 0.15;
      g.box(0.04, hh, 0.04, 0xc9ab4a, x, hh / 2, z).box(0.1, 0.26, 0.1, 0xe7c85c, x, hh + 0.1, z, a);
    }
    G.wheat = g.build().main;
    g = new GB(); g.ico(0.7, 0x4f8a37, 0, 0.55, 0, 1.1, 0.85, 1, 0, 0.3).ico(0.5, 0x5e9a3e, 0.45, 0.5, 0.25, 1, 0.8, 1, 0, 0.3);
    for (let i = 0; i < 9; i++) g.ico(0.1, 0xd23b4a, Math.cos(i * 2.1) * 0.62, 0.35 + (i % 3) * 0.28, Math.sin(i * 2.1) * 0.55, 1, 1, 1, 0, 0);
    G.berry = g.build().main;
    g = new GB();
    g._add(new THREE.RingGeometry(0.55, 0.72, 14).rotateX(-Math.PI / 2), 0xe8f6ff, g._m(0, 0.05, 0));
    g._add(new THREE.RingGeometry(1.05, 1.16, 16).rotateX(-Math.PI / 2), 0xd0ecf7, g._m(0, 0.04, 0));
    g.box(0.5, 0.05, 0.16, 0x2d5a70, 0.15, -0.15, 0.2, 0.6).box(0.2, 0.05, 0.2, 0x2d5a70, -0.15, -0.15, 0.02, 0.6 + Math.PI / 4);
    G.fish = g.build().main;
    g = new GB();
    for (let i = 0; i < 5; i++) g._add(new THREE.OctahedronGeometry(0.35 + (i % 2) * 0.15, 0), 0x7fe3ff, g._m(Math.cos(i * 1.3) * 0.35, 0.6 + (i % 3) * 0.2, Math.sin(i * 1.3) * 0.35, i, 0.3 * (i % 3 - 1), 0.2, 1, 2.4, 1));
    G.crystal = g.build().main;
    g = new GB(); g._add(new THREE.OctahedronGeometry(0.6, 0), 0xfff3b0, g._m(0, 0.7, 0, 0, 0.4, 0.3, 1, 1.4, 1)).dodec(0.55, 0x6a5a8a, 0, 0.2, 0, 1.4, 0.6, 1.4, 0.3);
    G.star = g.build().main;
    g = new GB(); g.cyl(0.3, 0.36, 0.45, 7, 0x7a5230, 0, 0, 0).cyl(0.25, 0.25, 0.03, 7, 0xc49a66, 0, 0.45, 0);
    G.stump = g.build().main;
    return G;
  },
  generate(scene) {
    const G = this.geos();
    const mTree = patchWorldMat(new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }), { wind: 0.04, area: true });
    const mSoft = patchWorldMat(new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }), { wind: 0.12, area: true });
    const mRock = patchWorldMat(new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }), { area: true });
    const mGlow = patchWorldMat(new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, emissive: 0x3aa0c0, emissiveIntensity: 0.55 }), { area: true });
    const mFish = patchWorldMat(new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.75, depthWrite: false }), { area: true });
    const S = {};
    for (const t of Object.keys(NODE_TYPES)) {
      const T = NODE_TYPES[t];
      const mat = T.tree ? mTree : T.soft && !T.fish ? mSoft : T.fish ? mFish : t === 'crystal' || t === 'star' ? mGlow : mRock;
      S[t] = new ChunkedInstances(G[t], mat, { cast: !T.soft, receive: true });
    }
    this.stumpSet = new ChunkedInstances(G.stump, mRock, { cast: true, receive: true });
    this.sets = S;
    const rng = mulberry32(90210);
    let id = 0;
    const add = (type, x, z, s = 1) => {
      const y = type === 'fish' ? 0.02 : World.groundY(x, z) - (NODE_TYPES[type].tree ? 0.15 : 0.05);
      const ry = rng() * TAU;
      const node = { id: id++, type, x, z, y, ry, s, hp: NODE_TYPES[type].hits, dep: false, handle: null, stump: null, area: areaIdxAt(x, z), anim: 0, shake: 0, disabled: false };
      node.handle = S[type].add(x, y, z, ry, s);
      if (NODE_TYPES[type].tree) node.stump = this.stumpSet.add(x, y + 0.1, z, ry, 0);
      this.list.push(node); this.byId.set(node.id, node);
      const key = Math.floor(x / 8) * 1000 + Math.floor(z / 8);
      (this.grid.get(key) || this.grid.set(key, []).get(key)).push(node);
      return node;
    };
    const okSpot = (x, z, minH = 0.7) => {
      const y = World.groundY(x, z);
      if (y < minH || World.slopeAt(x, z) > 0.95) return false;
      if (World.onRoad(x, z) || World.distToRoad(x, z) < 2.2 || World.blockedStatic(x, z, 1.4)) return false;
      if (Math.hypot(x - QUARRY.x, z - QUARRY.z) < 9) return false;
      for (const c of CAVES) { const d = Math.hypot(x - c.x, z - c.z); if (d < 13 && d > 0) return false; }
      for (const b of BRIDGES) if (Math.abs(x - b.x) < b.len / 2 + 3 && Math.abs(z - b.z) < 6) return false;
      return true;
    };
    // --- the resource grove of the starting glade (guaranteed, close to spawn) ---
    const grove = [[22, -22], [26, -27], [31, -21], [24, -33], [33, -30], [29, -15], [18, -30], [35, -24], [-27, -30], [-32, -26], [-24, 27], [-30, 33]];
    grove.forEach(([x, z], i) => { if (okSpot(x, z)) add(i % 3 === 0 ? 'birch' : 'oak', x, z, 0.9 + rng() * 0.3); });
    for (const [x, z] of [[24, 22], [29, 17], [21, 29], [32, 26], [27, 33], [-20, 31], [33, 9]]) if (okSpot(x, z)) add('rock', x, z, 0.8 + rng() * 0.4);
    for (let i = 0; i < 9; i++) { const x = -26 + (i % 3) * 2.2, z = 16 + Math.floor(i / 3) * 2.2; if (okSpot(x, z)) add('wheat', x, z, 1); }
    for (const [x, z] of [[-33, -16], [-31, -12], [15, 32]]) if (okSpot(x, z)) add('berry', x, z, 1);
    // --- per-area densities: [trees, rocks, berries, wheat, iron, gold] ---
    const D = {
      0: [0.07, 0.015, 0.01, 0, 0, 0], 1: [0.52, 0.035, 0.05, 0, 0, 0], 2: [0.17, 0.05, 0.02, 0, 0, 0], 3: [0.03, 0.01, 0.01, 0.12, 0, 0],
      4: [0.09, 0.16, 0, 0, 0.035, 0], 5: [0.07, 0.03, 0.035, 0, 0, 0], 6: [0.2, 0.04, 0.02, 0, 0, 0], 7: [0.6, 0.05, 0.03, 0, 0, 0],
      8: [0.14, 0.12, 0, 0, 0.03, 0.015], 9: [0.08, 0.05, 0.01, 0, 0, 0], 10: [0.2, 0.04, 0.02, 0, 0, 0.004], 11: [0.05, 0.02, 0, 0, 0, 0],
    };
    const step = 4.6;
    for (let z = -WORLD.PLAY + 2; z < WORLD.PLAY - 2; z += step) for (let x = -WORLD.PLAY + 2; x < WORLD.PLAY - 2; x += step) {
      const px = x + (rng() - 0.5) * step * 0.9, pz = z + (rng() - 0.5) * step * 0.9;
      const ai = areaIdxAt(px, pz);
      const d = D[ai];
      if (ai === 0 && Math.hypot(px, pz) < 24) { rng(); continue; }
      const r = rng();
      const cl = noise2(px * 0.05 + 40, pz * 0.05) * 0.5 + 0.5; // clumping
      if (!okSpot(px, pz)) continue;
      const y = World.groundY(px, pz);
      let acc = d[0] * (0.4 + cl * 1.2);
      if (r < acc) {
        let t;
        if (ai === 7 || ai === 8 || ai === 4 || ai === 9) t = y > 20 ? 'pine_snow' : rng() < 0.8 ? 'pine' : 'oak';
        else if (ai === 10) t = rng() < 0.45 ? 'oak_autumn' : rng() < 0.5 ? 'oak' : 'birch';
        else if (ai === 1) t = rng() < 0.5 ? 'oak' : rng() < 0.6 ? 'birch' : rng() < 0.3 ? 'oak_autumn' : 'pine';
        else t = rng() < 0.55 ? 'oak' : rng() < 0.5 ? 'birch' : 'pine';
        add(t, px, pz, 0.85 + rng() * 0.45);
        continue;
      }
      if (r < (acc += d[1])) { add('rock', px, pz, 0.7 + rng() * 0.6); continue; }
      if (r < (acc += d[2])) { add('berry', px, pz, 0.9 + rng() * 0.3); continue; }
      if (r < (acc += d[3])) {
        if (hash2(Math.floor((px + 1000) / 17), Math.floor((pz + 1000) / 13)) < 0.28) for (let k = 0; k < 4; k++) { const qx = px + (k % 2) * 1.6, qz = pz + Math.floor(k / 2) * 1.6; if (okSpot(qx, qz)) add('wheat', qx, qz, 1); }
        continue;
      }
      if (r < (acc += d[4])) { add('iron', px, pz, 0.8 + rng() * 0.3); continue; }
      if (r < (acc += d[5])) { add('gold', px, pz, 0.8 + rng() * 0.3); continue; }
    }
    // --- quarry: dense stone + iron ---
    for (let i = 0; i < 16; i++) {
      const a = i * 0.9 + rng(), r = 9.5 + rng() * 9;
      const x = QUARRY.x + Math.cos(a) * r, z = QUARRY.z + Math.sin(a) * r;
      if (World.groundY(x, z) > 0.7 && !World.onRoad(x, z) && !World.blockedStatic(x, z, 1.2)) add(i % 4 === 0 ? 'iron' : 'rock', x, z, 0.8 + rng() * 0.4);
    }
    // --- caves: ore / crystals inside ---
    for (const c of CAVES) {
      const inner = c.id === 'iron_cave' ? ['iron', 'iron', 'iron', 'gold', 'iron', 'rock'] : ['crystal', 'gold', 'crystal', 'gold', 'crystal', 'gold'];
      inner.forEach((t, i) => {
        const a = (i / inner.length) * TAU + 0.4; const dx = Math.cos(a), dz = Math.sin(a);
        if (dx * c.dx + dz * c.dz > 0.6) return;
        add(t, c.x + dx * 6, c.z + dz * 6, 0.9);
      });
    }
    // --- fishing spots: along the river, the lake, ponds and the coast ---
    for (let i = 8; i < RIVER.length - 3; i += 7) { const [x, z] = RIVER[i]; if (x > 40 && World.groundY(x, z) < -0.8 && World.bridgeAt(x, z) == null && Math.abs(z) > 6 && Math.abs(z + 90) > 6) add('fish', x, z); }
    for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; add('fish', LAKE.x + Math.cos(a) * 17, LAKE.z + Math.sin(a) * 17); }
    for (const p of PONDS) add('fish', p.x + 1.5, p.z);
    for (let z = -100; z <= 100; z += 25) add('fish', coastX(z) + 5, z);
    for (const k in S) S[k].finalize(scene);
    this.stumpSet.finalize(scene);
  },
  near(x, z, r) {
    const out = [];
    const x0 = Math.floor((x - r) / 8), x1 = Math.floor((x + r) / 8), z0 = Math.floor((z - r) / 8), z1 = Math.floor((z + r) / 8);
    for (let gx = x0; gx <= x1; gx++) for (let gz = z0; gz <= z1; gz++) {
      const l = this.grid.get(gx * 1000 + gz); if (!l) continue;
      for (const n of l) if (!n.disabled && Math.hypot(n.x - x, n.z - z) <= r + NODE_TYPES[n.type].r) out.push(n);
    }
    return out;
  },
  nearestOfType(x, z, types, maxR = 120) {
    let best = null, bd = 1e9;
    for (const n of this.list) {
      if (n.gone || n.disabled || !types.includes(n.type)) continue;
      if (!Village.isUnlockedIdx(n.area)) continue;
      const d = Math.hypot(n.x - x, n.z - z);
      if (d < bd && d < maxR) { bd = d; best = n; }
    }
    return best;
  },
  /* visuals */
  applyMatrix(n) {
    const T = NODE_TYPES[n.type];
    let s = n.dep ? 0 : n.s;
    let y = n.y, tilt = 0;
    if (n.anim > 0 && n.animKind === 'fall') { s = n.s; tilt = n.anim; }
    if (n.anim > 0 && n.animKind === 'grow') s = n.s * (1 - n.anim);
    if (n.disabled) s = 0;
    const set = this.sets[n.type];
    if (tilt > 0) {
      _cq.setFromEuler(new THREE.Euler(tilt * 1.5, n.ry, 0, 'YXZ'));
      const m = n.handle.c.mesh; m.setMatrixAt(n.handle.i, _cm.compose(_cv.set(n.x, y - tilt * 0.6, n.z), _cq, _cs.set(s * (1 - tilt * 0.4), s * (1 - tilt * 0.4), s * (1 - tilt * 0.4)))); m.instanceMatrix.needsUpdate = true;
    } else {
      const sh = n.shake > 0 ? Math.sin(n.shake * 60) * n.shake * 0.25 : 0;
      set.set(n.handle, n.x + sh * 0.3, y, n.z, n.ry + sh, s * (1 + (n.shake > 0 ? n.shake * 0.12 : 0)), s * (1 - (n.shake > 0 ? n.shake * 0.08 : 0)));
    }
    if (n.stump) this.stumpSet.set(n.stump, n.x, n.y + 0.1, n.z, n.ry, (n.dep || (n.anim > 0 && n.animKind === 'fall')) && !n.disabled ? n.s : 0);
  },
  hitFx(n) { n.shake = 0.35; this.dynamic.includes(n) || this.dynamic.push(n); },
  depleteFx(n) {
    const T = NODE_TYPES[n.type];
    if (T.tree) { n.animKind = 'fall'; n.anim = 0.001; n.dep = false; this._falling = true; this.dynamic.includes(n) || this.dynamic.push(n); n._pendingDep = true; }
    else { n.dep = true; this.applyMatrix(n); }
  },
  respawnFx(n) { n.dep = false; n.animKind = 'grow'; n.anim = 1; this.dynamic.includes(n) || this.dynamic.push(n); },
  setDepleted(n, dep) { n.dep = dep; n.anim = 0; this.applyMatrix(n); },
  disable(n) { n.disabled = true; this.applyMatrix(n); },
  update(dt) {
    for (let i = this.dynamic.length - 1; i >= 0; i--) {
      const n = this.dynamic[i];
      let active = false;
      if (n.shake > 0) { n.shake = Math.max(0, n.shake - dt); active = true; }
      if (n.animKind === 'fall' && n.anim > 0) {
        n.anim = Math.min(1, n.anim + dt * 1.6);
        if (n.anim >= 1) { n.anim = 0; n.animKind = null; n.dep = true; FX.burst(new THREE.Vector3(n.x, n.y + 1, n.z), { n: 12, color: [0x6fb34a, 0x5da03f, 0x9c6b3f], speed: 3, up: 2, life: 1, size: 0.35 }); }
        else active = true;
      } else if (n.animKind === 'grow' && n.anim > 0) {
        n.anim = Math.max(0, n.anim - dt * 0.8);
        if (n.anim > 0) active = true; else n.animKind = null;
      }
      this.applyMatrix(n);
      if (!active) this.dynamic.splice(i, 1);
    }
  },
};
