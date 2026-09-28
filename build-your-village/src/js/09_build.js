/* =====================================================================
   CLIENT: building renderer (one InstancedMesh per building type) and
   the placement controller (ghost preview, green/red, rotate, paint).
   ===================================================================== */
const BuildRender = {
  scene: null, types: {}, inst: new Map(), anims: [], lights: new Map(), smokes: new Map(), fires: new Map(),
  init(scene) { this.scene = scene; },
  ensure(type, need) {
    let T = this.types[type];
    if (T && T.cap >= need) return T;
    const M = Models.get(type);
    const cap = Math.max(8, need * 2);
    const mk = (geo, mat, cast) => { const m = new THREE.InstancedMesh(geo, mat, cap); m.count = 0; m.castShadow = cast; m.receiveShadow = true; m.matrixAutoUpdate = false; this.scene.add(m); return m; };
    const nT = { cap, ids: T ? T.ids : [], main: mk(M.main, Mats.bld, !BUILDINGS[type].road), glow: M.glow ? mk(M.glow, Mats.windowGlow, false) : null, spin: M.spin ? mk(M.spin.geo, Mats.bld, true) : null, M };
    if (BUILDINGS[type].road) nT.main.receiveShadow = true;
    if (T) {
      for (const k of ['main', 'glow', 'spin']) if (T[k]) { nT[k].instanceMatrix.array.set(T[k].instanceMatrix.array.subarray(0, T.ids.length * 16)); nT[k].count = T[k].count; this.scene.remove(T[k]); T[k].dispose(); }
    }
    this.types[type] = nT;
    return nT;
  },
  matrixFor(b, sy = 1, sxz = 1) { return composeM(b.x, b.y, b.z, b.rot * Math.PI / 2, sxz, sy, _cm); },
  apply(b, sy = 1, sxz = 1) {
    const I = this.inst.get(b.id); if (!I) return;
    const T = this.types[b.type];
    const m = this.matrixFor(b, sy, sxz);
    T.main.setMatrixAt(I.idx, m); T.main.instanceMatrix.needsUpdate = true;
    if (T.glow) { T.glow.setMatrixAt(I.idx, m); T.glow.instanceMatrix.needsUpdate = true; }
    if (T.spin) this.applySpin(b, T, I, sy);
    T.main.boundingSphere = null; if (T.glow) T.glow.boundingSphere = null; if (T.spin) T.spin.boundingSphere = null;
  },
  applySpin(b, T, I, sy = 1) {
    const sp = T.M.spin, t = U.uTime.value * sp.speed + b.id;
    const base = new THREE.Matrix4().makeRotationY(b.rot * Math.PI / 2).setPosition(b.x, b.y, b.z);
    const local = new THREE.Matrix4().makeRotationZ(t).setPosition(sp.pivot[0], sp.pivot[1] * sy, sp.pivot[2]);
    T.spin.setMatrixAt(I.idx, base.multiply(local).multiply(new THREE.Matrix4().makeScale(sy, sy, sy)));
    T.spin.instanceMatrix.needsUpdate = true;
  },
  add(b, animate = false) {
    const T = this.ensure(b.type, (this.types[b.type] ? this.types[b.type].ids.length : 0) + 1);
    const idx = T.ids.length;
    T.ids.push(b.id);
    T.main.count = T.ids.length; if (T.glow) T.glow.count = T.ids.length; if (T.spin) T.spin.count = T.ids.length;
    this.inst.set(b.id, { idx, type: b.type });
    this.registerPoints(b);
    if (animate) {
      const a = { b, t: 0 };
      this.anims.push(a);
      this.apply(b, 0.02, 0.9);
    } else this.apply(b);
  },
  remove(b) {
    const I = this.inst.get(b.id); if (!I) return;
    const T = this.types[I.type];
    const last = T.ids.length - 1;
    if (I.idx !== last) {
      const movedId = T.ids[last];
      for (const k of ['main', 'glow', 'spin']) if (T[k]) { const m = new THREE.Matrix4(); T[k].getMatrixAt(last, m); T[k].setMatrixAt(I.idx, m); }
      T.ids[I.idx] = movedId;
      this.inst.get(movedId).idx = I.idx;
    }
    T.ids.pop();
    T.main.count = T.ids.length; if (T.glow) T.glow.count = T.ids.length; if (T.spin) T.spin.count = T.ids.length;
    for (const k of ['main', 'glow', 'spin']) if (T[k]) { T[k].instanceMatrix.needsUpdate = true; T[k].boundingSphere = null; }
    this.inst.delete(b.id);
    this.anims = this.anims.filter((a) => a.b !== b);
    this.lights.delete(b.id); this.smokes.delete(b.id); this.fires.delete(b.id);
    FX.lampsDirty = true;
  },
  move(b) { this.registerPoints(b); this.apply(b); },
  registerPoints(b) {
    const M = Models.get(b.type);
    const tr = (v) => { const [x, z] = BuildingService.toWorld(b, v.x, v.z); return new THREE.Vector3(x, b.y + v.y, z); };
    this.lights.set(b.id, M.lights.map(tr));
    this.smokes.set(b.id, M.smokes.map(tr));
    this.fires.set(b.id, M.fires.map(tr));
    FX.lampsDirty = true;
  },
  animating() { return this.anims.length > 0; },
  update(dt) {
    for (let i = this.anims.length - 1; i >= 0; i--) {
      const a = this.anims[i];
      a.t += dt / 1.15;
      const k = Math.min(1, a.t);
      this.apply(a.b, Math.max(0.02, Ease.outBack(k)), 0.9 + 0.1 * Ease.outCubic(k));
      if (k >= 1) { this.anims.splice(i, 1); this.apply(a.b); }
    }
    for (const type in this.types) {
      const T = this.types[type];
      if (!T.spin) continue;
      for (const id of T.ids) { const b = BuildingService.byId(id); const I = this.inst.get(id); if (b && I && !this.anims.some((a) => a.b === b)) this.applySpin(b, T, I); }
    }
  },
  rects() { return S.buildings.map((b) => BuildingService.rect(b.type, b.x, b.z, b.rot)); },
  /* ray pick against building boxes */
  pick(ray) {
    let best = null, bt = 1e9;
    const box = new THREE.Box3(), hit = new THREE.Vector3();
    for (const b of S.buildings) {
      if (BUILDINGS[b.type].road) continue;
      const r = BuildingService.rect(b.type, b.x, b.z, b.rot);
      box.min.set(r.x0 + 0.2, b.y - 0.5, r.z0 + 0.2); box.max.set(r.x1 - 0.2, b.y + Math.max(1.5, Models.get(b.type).height * 0.85), r.z1 - 0.2);
      if (ray.intersectBox(box, hit)) { const t = hit.distanceTo(ray.origin); if (t < bt) { bt = t; best = b; } }
    }
    return best ? { b: best, t: bt } : null;
  },
};

/* selection outline under a building */
const SelRing = {
  line: null,
  init(scene) {
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(new Array(3 * 41).fill(0), 3));
    this.line = new THREE.Line(g, new THREE.LineBasicMaterial({ color: 0xfff1a8, transparent: true, opacity: 0.95, depthTest: false }));
    this.line.visible = false; this.line.renderOrder = 5; scene.add(this.line);
  },
  show(b) {
    if (!b) { this.line.visible = false; return; }
    const r = BuildingService.rect(b.type, b.x, b.z, b.rot);
    const P = this.line.geometry.attributes.position;
    const pts = [];
    for (let i = 0; i < 10; i++) pts.push([lerp(r.x0, r.x1, i / 10), r.z0]);
    for (let i = 0; i < 10; i++) pts.push([r.x1, lerp(r.z0, r.z1, i / 10)]);
    for (let i = 0; i < 10; i++) pts.push([lerp(r.x1, r.x0, i / 10), r.z1]);
    for (let i = 0; i <= 10; i++) pts.push([r.x0, lerp(r.z1, r.z0, i / 10)]);
    pts.forEach(([x, z], i) => P.setXYZ(i, x, Math.max(World.groundY(x, z), b.y - 0.2) + 0.25, z));
    P.needsUpdate = true; this.line.geometry.computeBoundingSphere();
    this.line.visible = true;
  },
};

const BuildCtl = {
  active: false, type: null, rot: 0, moveId: null, ghost: null, foot: null, x: 0, z: 0, res: { ok: false }, painting: false, lastTile: '', touch: false, hasPos: false,
  init(scene) {
    this.ghostMat = new THREE.MeshBasicMaterial({ color: 0x5fd17a, transparent: true, opacity: 0.5, depthWrite: false });
    this.footMat = new THREE.MeshBasicMaterial({ color: 0x5fd17a, transparent: true, opacity: 0.32, depthWrite: false, side: THREE.DoubleSide });
    this.ghost = new THREE.Mesh(new THREE.BufferGeometry(), this.ghostMat); this.ghost.visible = false; this.ghost.renderOrder = 4;
    this.foot = new THREE.Mesh(new THREE.PlaneGeometry(1, 1, 8, 8).rotateX(-Math.PI / 2), this.footMat); this.foot.visible = false; this.foot.renderOrder = 3;
    scene.add(this.ghost); scene.add(this.foot);
  },
  start(type, moveId = null) {
    const cfg = BUILDINGS[type];
    if (!cfg) return;
    if (!moveId) { const c = BuildingService.canBuild(type); if (!c.ok && !/^Not enough/.test(c.err)) { UI.toast({ icon: '🔒', title: cfg.name, text: c.err }); Audio.sfx('error'); return; } }
    this.active = true; this.type = type; this.moveId = moveId; this.touch = document.body.classList.contains('touch');
    const mb = moveId ? BuildingService.byId(moveId) : null;
    this.rot = mb ? mb.rot : this.rot;
    this.ghost.geometry = Models.get(type).main;
    this.ghost.visible = true; this.foot.visible = true;
    UI.closePanels();
    UI.placeBar(true, type, !!moveId);
    CameraCtl.tDist = Math.max(CameraCtl.tDist, cfg.size[0] > 9 ? 34 : 26);
    // start in front of the player (touch has no hover)
    const d = Math.max(cfg.size[0], cfg.size[1]) / 2 + 3.5;
    this.setPos(mb ? mb.x : Player.x + Math.sin(Player.ent.yaw) * d, mb ? mb.z : Player.z + Math.cos(Player.ent.yaw) * d);
    if (Input.hover.in && !this.touch) this.onHover(Input.hover.x, Input.hover.y);
    Audio.sfx('open');
  },
  cancel() {
    if (!this.active) return;
    this.active = false; this.ghost.visible = false; this.foot.visible = false; this.painting = false;
    UI.placeBar(false);
  },
  rotate() { if (!this.active) return; this.rot = (this.rot + 1) & 3; this.setPos(this.x, this.z); Audio.sfx('tick'); },
  setPos(x, z) {
    [x, z] = BuildingService.snap(this.type, x, z, this.rot);
    this.x = x; this.z = z;
    let res = BuildingService.check(this.type, x, z, this.rot, this.moveId);
    if (res.ok && !this.moveId) { const c = BuildingService.canBuild(this.type); if (!c.ok) res = Object.assign({}, c, { y: res.y }); }
    this.res = res;
    const y = res.y != null ? res.y : World.groundY(x, z);
    this.ghost.position.set(x, y + 0.05, z);
    this.ghost.rotation.y = this.rot * Math.PI / 2;
    const [W, D] = BuildingService.dims(this.type, this.rot);
    this.foot.scale.set(W, 1, D);
    this.foot.position.set(x, y + 0.12, z);
    const col = res.ok ? 0x5fd17a : 0xff5a5a;
    this.ghostMat.color.setHex(col); this.footMat.color.setHex(col);
    UI.placeStatus(res);
  },
  onHover(sx, sy) {
    if (!this.active || this.touch) return;
    const p = Game.pickGround(sx, sy);
    if (p) this.setPos(p.x, p.z);
  },
  onDrag(sx, sy, p) {
    if (!BUILDINGS[this.type].road || this.moveId) return false;
    const g = Game.pickGround(sx, sy);
    if (!g) return true;
    this.painting = true;
    this.setPos(g.x, g.z);
    const key = this.x + ',' + this.z + ',' + this.rot;
    if (key !== this.lastTile && this.res.ok) { this.lastTile = key; this.confirm(true); }
    return true;
  },
  onUp() { this.painting = false; this.lastTile = ''; },
  onClick(sx, sy, button, type) {
    if (button === 2) { this.cancel(); return; }
    this.touch = type === 'touch';
    const p = Game.pickGround(sx, sy);
    if (!p) return;
    if (this.touch) { this.setPos(p.x, p.z); return; } // on touch: tap moves, the ✓ button builds
    this.setPos(p.x, p.z);
    this.confirm();
  },
  confirm(quiet = false) {
    if (!this.active) return;
    if (!this.res.ok) { if (!quiet) { Audio.sfx('error'); UI.shakePlaceBar(); } return; }
    const type = this.type;
    const r = this.moveId ? Remote.invoke('MoveBuilding', { id: this.moveId, x: this.x, z: this.z, rot: this.rot }) : Remote.invoke('PlaceBuilding', { type, x: this.x, z: this.z, rot: this.rot });
    if (!r.ok) { if (!r.silent && !quiet) { UI.toast({ icon: '⚠️', title: "Can't build here", text: r.err }); Audio.sfx('error'); } return; }
    const cfg = BUILDINGS[type];
    if (this.moveId) { this.cancel(); Audio.sfx('place'); return; }
    // keep placing roads/decor while affordable; everything else exits
    if ((cfg.road || cfg.cat === 'decor') && BuildingService.canBuild(type).ok) { this.setPos(this.x, this.z); return; }
    this.cancel();
  },
  update(dt) {
    if (!this.active) return;
    this.ghostMat.opacity = 0.42 + Math.sin(U.uTime.value * 5) * 0.08;
    if (Input.keys.has('enter')) { Input.keys.delete('enter'); this.confirm(); }
  },
};
