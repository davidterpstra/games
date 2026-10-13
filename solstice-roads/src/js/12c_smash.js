/* =====================================================================
   Smashables: wooden fences along the farm tracks, round hay bales in
   the fields and traffic cones at the festival. Intact objects are
   instanced; hitting one hides it and throws pooled debris that tumbles,
   bounces and settles. Broken objects reappear once the player is away.
   ===================================================================== */
const Smash = { items: [], types: {}, grid: new Map(), debris: [], debrisMesh: null, cell: 20, respawnT: 0 };
const SMASH_TYPES = {
  fence: { r: 1.55, slow: 0.06, pts: 120, pieces: 5, color: 0x7a5a3c, size: [0.12, 0.12, 1.4] },
  hay: { r: 1.0, slow: 0.12, pts: 200, pieces: 7, color: 0xd8b25a, size: [0.5, 0.4, 0.5] },
  cone: { r: 0.32, slow: 0.01, pts: 60, pieces: 1, color: 0xff6a13, size: [0.3, 0.6, 0.3] },
};

function smashGeometry(type) {
  if (type === 'fence') {
    const parts = [];
    for (const x of [-1.5, 0, 1.5]) parts.push(new THREE.BoxGeometry(0.12, 1.15, 0.12).translate(x, 0.575, 0));
    for (const y of [0.35, 0.75, 1.05]) parts.push(new THREE.BoxGeometry(3.1, 0.12, 0.05).translate(0, y, 0.07));
    return mergeGeometries(parts.map((g) => g.toNonIndexed()));
  }
  if (type === 'hay') return new THREE.CylinderGeometry(0.75, 0.75, 1.2, 18).rotateZ(Math.PI / 2).translate(0, 0.75, 0);
  const cone = new THREE.ConeGeometry(0.17, 0.62, 14).translate(0, 0.33, 0);
  const base = new THREE.BoxGeometry(0.36, 0.04, 0.36).translate(0, 0.02, 0);
  return mergeGeometries([cone.toNonIndexed(), base.toNonIndexed()]);
}
function smashMaterial(type) {
  if (type === 'hay') {
    const t = canvasTex(128, 128, (x, w, h) => {
      noiseFill(x, w, h, 6, (n) => { const v = 0.75 + n * 0.4; return [214 * v, 176 * v, 92 * v]; });
      x.strokeStyle = 'rgba(120,90,40,0.5)'; for (let i = 0; i < 40; i++) { x.beginPath(); x.moveTo(0, rng() * h); x.lineTo(w, rng() * h); x.stroke(); }
    });
    return new THREE.MeshStandardMaterial({ map: t, roughness: 1 });
  }
  if (type === 'cone') {
    const t = canvasTex(64, 64, (x, w, h) => { x.fillStyle = '#ff6a13'; x.fillRect(0, 0, w, h); x.fillStyle = '#f4f4f4'; x.fillRect(0, h * 0.35, w, h * 0.15); x.fillRect(0, h * 0.62, w, h * 0.1); });
    return new THREE.MeshStandardMaterial({ map: t, roughness: 0.6 });
  }
  return new THREE.MeshStandardMaterial({ color: 0x7a5a3c, roughness: 0.95, map: PropMat.wood.map || null });
}

function buildSmashables(scene) {
  const add = (type, x, z, h) => Smash.items.push({ type, x, z, y: hAt(x, z), h, alive: true, brokenAt: 0 });
  reseed(909);
  // fences along the gravel farm tracks (not where a junction, bridge or other road is close)
  for (const road of World.roads) {
    if (road.type !== 'D') continue;
    for (let k = 10; k < road.n - 10; k += 2) {
      for (const sd of [1, -1]) {
        const lx = road.tz[k] * sd, lz = -road.tx[k] * sd, off = road.hw + 2.3;
        const x = road.x[k] + lx * off, z = road.z[k] + lz * off;
        if (farmMask(x, z) < 0.3 || road.flag[k]) continue;
        const q = roadAt(x, z);
        if (!q || q.road !== road || q.d < 1) continue;
        if (Math.hypot(x - PLAZA.x, z - PLAZA.z) < PLAZA.r + 50) continue;
        if (((k / 2) | 0) % 9 === 8) continue; // field gates
        add('fence', x, z, Math.atan2(road.tx[k], road.tz[k]) + Math.PI / 2);
      }
    }
  }
  // hay bales in the cereal fields
  for (let i = 0; i < 2500 && Smash.items.filter((s) => s.type === 'hay').length < 160; i++) {
    const x = (rng() - 0.5) * (WORLD - 200), z = (rng() - 0.5) * (WORLD - 200);
    const id = cellId(x, z);
    if (World.FLD[id] !== 2 || World.RD[id] < 4) continue;
    add('hay', x, z, rng() * TAU);
  }
  // cones lining the festival lanes
  for (const g of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) for (const sd of [-1, 1]) for (let k = 0; k < 5; k++) {
    const a = g + sd * 0.14, r = PLAZA.r - 6 - k * 6;
    add('cone', PLAZA.x + Math.cos(a) * r, PLAZA.z + Math.sin(a) * r, 0);
  }
  // instanced meshes per type + spatial hash
  const o = new THREE.Object3D();
  for (const type of Object.keys(SMASH_TYPES)) {
    const list = Smash.items.filter((s) => s.type === type);
    if (!list.length) continue;
    const mesh = new THREE.InstancedMesh(smashGeometry(type), smashMaterial(type), list.length);
    list.forEach((s, i) => {
      s.idx = i;
      o.position.set(s.x, s.y - 0.05, s.z); o.rotation.set(0, s.h, 0); o.scale.setScalar(1); o.updateMatrix();
      mesh.setMatrixAt(i, o.matrix);
    });
    mesh.castShadow = mesh.receiveShadow = true;
    scene.add(mesh);
    Smash.types[type] = mesh;
  }
  for (const s of Smash.items) {
    const k = Math.floor(s.x / Smash.cell) + ',' + Math.floor(s.z / Smash.cell);
    if (!Smash.grid.has(k)) Smash.grid.set(k, []);
    Smash.grid.get(k).push(s);
  }
  // debris pool: one instanced mesh of small planks / chunks, recoloured per piece
  const N = 160;
  Smash.debrisMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ roughness: 0.9 }), N);
  Smash.debrisMesh.frustumCulled = false;
  Smash.debrisMesh.castShadow = true;
  for (let i = 0; i < N; i++) {
    Smash.debris.push({ life: 0, p: new THREE.Vector3(), v: new THREE.Vector3(), r: new THREE.Euler(), w: new THREE.Vector3(), s: new THREE.Vector3(1, 1, 1) });
    o.position.set(0, -999, 0); o.scale.setScalar(0); o.updateMatrix(); Smash.debrisMesh.setMatrixAt(i, o.matrix);
    Smash.debrisMesh.setColorAt(i, new THREE.Color(0xffffff));
  }
  Smash.debrisHead = 0;
  scene.add(Smash.debrisMesh);
}

const _sm = new THREE.Object3D(), _scol = new THREE.Color();
function setSmashVisible(s, on) {
  const mesh = Smash.types[s.type];
  _sm.position.set(s.x, s.y - 0.05, s.z); _sm.rotation.set(0, s.h, 0); _sm.scale.setScalar(on ? 1 : 0); _sm.updateMatrix();
  mesh.setMatrixAt(s.idx, _sm.matrix);
  mesh.instanceMatrix.needsUpdate = true;
}
function smashCheck(car, isPlayer) {
  const v = car.speed;
  if (v < 2.5) return;
  const cx = Math.floor(car.x / Smash.cell), cz = Math.floor(car.z / Smash.cell);
  for (let i = cx - 1; i <= cx + 1; i++) for (let j = cz - 1; j <= cz + 1; j++) {
    const list = Smash.grid.get(i + ',' + j);
    if (!list) continue;
    for (const s of list) {
      if (!s.alive) continue;
      const T = SMASH_TYPES[s.type];
      if (Math.abs(car.y - s.y) > 3) continue;
      const hit = boxVsCollider(car.x, car.z, car.h, car.hw, car.hl, { t: 0, x: s.x, z: s.z, r: T.r });
      if (!hit) continue;
      s.alive = false; s.brokenAt = performance.now();
      setSmashVisible(s, false);
      const k = 1 - T.slow * clamp(20 / Math.max(v, 1), 0.3, 1);
      car.vx *= k; car.vz *= k;
      throwDebris(s, car);
      if (isPlayer) {
        if (Audio.started) { noiseBurst(0.18, s.type === 'hay' ? 500 : 1600, 0.3); if (s.type === 'fence') tone(140, 0.12, 'triangle', 0.25, 'sfx', 0, 0.6); }
        Cam.trauma = Math.min(1, Cam.trauma + 0.15);
        Skill.total += T.pts; Save.data.credits += Math.round(T.pts / 40);
        Smash.chain = (performance.now() - (Smash.lastT || 0) < 2500 ? (Smash.chain || 0) : 0) + 1;
        Smash.lastT = performance.now();
        notify(`SMASH${Smash.chain > 1 ? ' x' + Smash.chain : ''}  +${T.pts}`, s.type === 'hay' ? 'Hay bale' : s.type === 'cone' ? 'Cone' : 'Fence', 'skill', 1200);
      }
    }
  }
}
function throwDebris(s, car) {
  const T = SMASH_TYPES[s.type];
  const n = T.pieces + (s.type === 'fence' ? 3 : 0);
  for (let i = 0; i < n; i++) {
    const d = Smash.debris[Smash.debrisHead]; Smash.debrisHead = (Smash.debrisHead + 1) % Smash.debris.length;
    const id = Smash.debris.indexOf(d);
    d.life = 7 + Math.random() * 3;
    d.p.set(s.x + (Math.random() - 0.5) * 1.5, s.y + 0.6 + Math.random() * 0.5, s.z + (Math.random() - 0.5) * 1.5);
    d.v.set(car.vx * (0.5 + Math.random() * 0.5) + (Math.random() - 0.5) * 4, 2 + Math.random() * 4 + car.speed * 0.08, car.vz * (0.5 + Math.random() * 0.5) + (Math.random() - 0.5) * 4);
    d.r.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
    d.w.set((Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12);
    if (s.type === 'fence') { if (i < 3) d.s.set(0.12, 1.15, 0.12); else d.s.set(0.9 + Math.random() * 0.7, 0.12, 0.05); } // posts, then rail pieces
    else if (s.type === 'hay') d.s.set(0.45 + Math.random() * 0.3, 0.35, 0.45 + Math.random() * 0.3);
    else d.s.set(0.3, 0.55, 0.3);
    Smash.debrisMesh.setColorAt(id, _scol.set(T.color).multiplyScalar(0.85 + Math.random() * 0.3));
  }
  Smash.debrisMesh.instanceColor.needsUpdate = true;
  // straw dust
  if (s.type === 'hay') for (let i = 0; i < 12; i++) emit(s.x, s.y + 0.8, s.z, car.vx * 0.3 + (Math.random() - 0.5) * 5, 1 + Math.random() * 3, car.vz * 0.3 + (Math.random() - 0.5) * 5, 1.5, 0.6, 3, 0xe0c27a, 0.5, 0.5, 1.2);
}
function updateSmash(dt, player) {
  let any = false;
  for (let i = 0; i < Smash.debris.length; i++) {
    const d = Smash.debris[i];
    if (d.life <= 0) continue;
    any = true;
    d.life -= dt;
    d.v.y -= G * dt;
    d.p.addScaledVector(d.v, dt);
    d.r.x += d.w.x * dt; d.r.y += d.w.y * dt; d.r.z += d.w.z * dt;
    const gy = groundAt(d.p.x, d.p.z, d.p.y + 1) + d.s.y * 0.5;
    if (d.p.y < gy) {
      d.p.y = gy;
      if (d.v.y < -1.5) { d.v.y *= -0.3; d.v.x *= 0.6; d.v.z *= 0.6; d.w.multiplyScalar(0.5); }
      else { d.v.set(d.v.x * 0.85, 0, d.v.z * 0.85); d.w.multiplyScalar(0.8); }
    }
    const sc = d.life < 1 ? d.life : 1;
    _sm.position.copy(d.p); _sm.rotation.copy(d.r); _sm.scale.copy(d.s).multiplyScalar(sc); _sm.updateMatrix();
    Smash.debrisMesh.setMatrixAt(i, _sm.matrix);
    if (d.life <= 0) { _sm.scale.setScalar(0); _sm.updateMatrix(); Smash.debrisMesh.setMatrixAt(i, _sm.matrix); }
  }
  if (any || Smash.debrisDirty) { Smash.debrisMesh.instanceMatrix.needsUpdate = true; Smash.debrisDirty = any; }
  // put broken things back once the player is well away
  Smash.respawnT -= dt;
  if (Smash.respawnT <= 0) {
    Smash.respawnT = 2;
    const now = performance.now();
    for (const s of Smash.items) if (!s.alive && now - s.brokenAt > 45000 && Math.hypot(s.x - player.x, s.z - player.z) > 180) { s.alive = true; setSmashVisible(s, true); }
  }
}
