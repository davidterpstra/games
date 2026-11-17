/* =====================================================================
   06_machine.js — Claw machine: cabinet model, claw rig, physics pit,
   claw state machine, upgrade visuals.   (see ARCHITECTURE.md section 6)
   Public: ClawMachine, Machines.  Private helpers: _cm*.
   ===================================================================== */

const _cmK = {
  gravity: 11, restitution: 0.15,
  hubR: 0.06, tipR: 0.055, midR: 0.05,
  cableTopY: 2.82,
  R0: 0.1, L1: 0.22, L2: 0.26, curl: 0.07, curlAng: -0.7,
  spawnY: 2.7,
  step: 1 / 240,
};

/* ---------- lazily created scratch objects (no Three.js objects at load time) ---------- */
let _cmT = null;
function _cmTmp() {
  if (_cmT) return _cmT;
  _cmT = {
    m: new THREE.Matrix4(), m2: new THREE.Matrix4(), nm: new THREE.Matrix3(), q: new THREE.Quaternion(),
    e: new THREE.Euler(), v: new THREE.Vector3(), s: new THREE.Vector3(), c: new THREE.Color(),
    c2: new THREE.Color(), white: new THREE.Color(1, 1, 1), cache: {},
    v2: new THREE.Vector2(), plane: new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit: new THREE.Vector3(),
  };
  return _cmT;
}
function _cmUnit(key, factory) {
  const T = _cmTmp();
  let g = T.cache[key];
  if (!g) { const src = factory(); g = src.index ? src.toNonIndexed() : src; if (g !== src) src.dispose(); T.cache[key] = g; }
  return g;
}
const _cmHex = (c) => '#' + c.getHexString();

/** Accumulates transformed primitives into ONE vertex-coloured BufferGeometry. */
class _cmBuilder {
  constructor() { this.pos = []; this.nor = []; this.col = []; this.parent = null; }
  setParent(m) { this.parent = m; return this; }
  _add(geo, m, color) {
    const T = _cmTmp();
    const p = geo.attributes.position, n = geo.attributes.normal;
    T.m2.copy(m);
    if (this.parent) T.m2.premultiply(this.parent);
    T.nm.getNormalMatrix(T.m2);
    const c = T.c.set(color);
    for (let i = 0; i < p.count; i++) {
      T.v.fromBufferAttribute(p, i).applyMatrix4(T.m2);
      this.pos.push(T.v.x, T.v.y, T.v.z);
      T.v.fromBufferAttribute(n, i).applyMatrix3(T.nm).normalize();
      this.nor.push(T.v.x, T.v.y, T.v.z);
      this.col.push(c.r, c.g, c.b);
    }
    return this;
  }
  _xf(x, y, z, sx, sy, sz, rx, ry, rz) {
    const T = _cmTmp();
    T.e.set(rx || 0, ry || 0, rz || 0);
    T.q.setFromEuler(T.e);
    return T.m.compose(T.v.set(x, y, z), T.q, T.s.set(sx, sy, sz));
  }
  box(x, y, z, w, h, d, color, rx, ry, rz) {
    return this._add(_cmUnit('box', () => new THREE.BoxGeometry(1, 1, 1)), this._xf(x, y, z, w, h, d, rx, ry, rz), color);
  }
  cyl(x, y, z, r, h, color, rx, ry, rz, seg = 14) {
    return this._add(_cmUnit('cyl' + seg, () => new THREE.CylinderGeometry(1, 1, 1, seg)), this._xf(x, y, z, r, h, r, rx, ry, rz), color);
  }
  sph(x, y, z, r, color, sy = 1) {
    return this._add(_cmUnit('sph', () => new THREE.SphereGeometry(1, 14, 10)), this._xf(x, y, z, r, r * sy, r, 0, 0, 0), color);
  }
  build(withColor = true) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    if (withColor) g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.computeBoundingSphere();
    return g;
  }
}

/** Prong pose in the prong plane (x radial, y up) for openness o (0 closed .. 1 open). */
function _cmPose(o, P) {
  const K = _cmK;
  const a1 = 0.05 + 0.75 * o, a2 = -0.5 + 0.35 * o, b = a1 + a2;
  P.a1 = a1; P.a2 = a2;
  P.ex = K.R0 + K.L1 * Math.sin(a1); P.ey = -K.L1 * Math.cos(a1);
  const lx = P.ex + K.L2 * Math.sin(b), ly = P.ey - K.L2 * Math.cos(b);
  P.mx = (P.ex + lx) * 0.5; P.my = (P.ey + ly) * 0.5;
  const c = b + K.curlAng;
  P.tx = lx + K.curl * Math.sin(c); P.ty = ly - K.curl * Math.cos(c);
  return P;
}
/** Openness whose curled tips sit at the given radial distance. */
function _cmOpenForRadial(rad, P) {
  let lo = 0, hi = 1;
  for (let i = 0; i < 14; i++) { const mid = (lo + hi) * 0.5; _cmPose(mid, P); if (P.tx < rad) lo = mid; else hi = mid; }
  return (lo + hi) * 0.5;
}
function _cmSfx(name) { try { if (typeof Sfx !== 'undefined' && Sfx.play) Sfx.play(name); } catch (e) { /* ignore */ } }

class ClawMachine {
  constructor(worldId) {
    this.worldId = worldId;
    this.world = (typeof WORLD_BY_ID !== 'undefined' && (WORLD_BY_ID[worldId] || WORLD_BY_ID.starter)) || { theme: {}, machineName: 'Claw', playCost: 0 };
    this.theme = Object.assign({ machineBody: '#ff5fa2', machineTrim: '#ffd23f', pitFloor: '#6ec6ff', neon: '#46f0ff', accent: '#ffe14d' }, this.world.theme || {});
    this.group = new THREE.Group();
    this.group.name = 'ClawMachine';
    this.pitGroup = new THREE.Group();
    this.group.add(this.pitGroup);

    this.state = 'idle'; this.stateT = 0; this.timeLeft = 0; this.playId = null;
    this.t = 0;
    this.bodies = [];
    this.spawnQ = []; this.spawnCd = 0;
    this.fading = []; this.pops = [];
    this.disposed = false;

    // claw kinematics
    const home = this._home();
    this.cx = home.x; this.cz = home.z; this.cy = MACHINE_DIMS.clawTopY;
    this.vx = 0; this.vz = 0;
    this.hx = this.cx; this.hy = this.cy; this.hz = this.cz;
    this.hvx = 0; this.hvy = 0; this.hvz = 0;
    this.inX = 0; this.inY = 0;
    this.aim = { on: false, x: 0, z: 0 };
    this.swayX = 0; this.swayZ = 0; this.swayVX = 0; this.swayVZ = 0;
    this.open = 0.5; this.openTarget = 0.5; this.openSpeed = 4;
    this.pose = { a1: 0, a2: 0, ex: 0, ey: 0, mx: 0, my: 0, tx: 0, ty: 0 };
    this.prongTh = [Math.PI / 2, Math.PI / 2 + TAU / 3, Math.PI / 2 + 2 * TAU / 3];
    this.prongC = this.prongTh.map(Math.cos); this.prongS = this.prongTh.map(Math.sin);
    this.kin = new Float32Array(7 * 4); this.kinV = new Float32Array(7 * 3); this.kinInit = false;

    // play bookkeeping
    this.held = null; this.holdSlip = null; this.holdSuccess = false; this.gripT = 0; this.slipped = false;
    this.resultType = null; this.playWon = false; this.motorOn = false; this.lastTickSec = -1;
    this.stats = { clawSpeed: 0.6, capacity: 6 }; this.statsT = 0;
    this._candidate = null; this._gripDone = false; this._dropV = 0;

    // hover
    this._hover = null; this._hoverT = -1; this._hoverObj = null;
    this._camView = { pos: new THREE.Vector3(), target: new THREE.Vector3() };
    this._chuteW = new THREE.Vector3();
    this._acc = 0; this._delQ = [];
    this.resets = 0; this.pulse = {}; this.lv = {};
    this._raycaster = new THREE.Raycaster();
    this._ringCol = { good: new THREE.Color(0x35ff6b), mid: new THREE.Color(0xffd83a), bad: new THREE.Color(0xff4b4b), none: new THREE.Color(0xffffff) };
    this.flapOpen = 0; this.lightRainbow = 0; this.lightSpeed = 1.5;

    this._build();

    this._hSpawn = (d) => { if (d && d.worldId === this.worldId) this._queueSpawn(d.entry); };
    this._hRemove = (d) => { if (d && d.worldId === this.worldId) this._onRemove(d.pid); };
    this._hUpgrade = (d) => { this.applyUpgradeVisuals(); if (d && d.id) this.pulse[d.id] = 1; };
    Bus.on('pit:spawn', this._hSpawn);
    Bus.on('pit:remove', this._hRemove);
    Bus.on('upgrade:bought', this._hUpgrade);
    this.applyUpgradeVisuals();
  }

  /* ================= geometry ================= */
  _home() { const C = MACHINE_DIMS.chute; return { x: (C.minX + C.maxX) / 2, z: (C.minZ + C.maxZ) / 2 }; }

  _build() {
    const D = MACHINE_DIMS, th = this.theme, T = _cmTmp();
    const body = new THREE.Color(th.machineBody), trim = new THREE.Color(th.machineTrim), floorC = new THREE.Color(th.pitFloor);
    const accent = new THREE.Color(th.accent), neon = new THREE.Color(th.neon);
    const dark = body.clone().multiplyScalar(0.3), mid = body.clone().lerp(T.white, 0.12).multiplyScalar(0.8), light = body.clone().lerp(T.white, 0.35);
    const trimDark = trim.clone().multiplyScalar(0.65);
    const metal = new THREE.Color(0xcfd8e3);
    const base = D.baseHeight, C = D.chute, P = D.pit;
    this._mats = []; this._geos = []; this._tex = [];
    const reg = (m) => { this._mats.push(m); return m; };
    const mesh = (geo, mat, parent, name) => { this._geos.push(geo); const m = new THREE.Mesh(geo, mat); m.name = name || ''; (parent || this.group).add(m); return m; };

    this.matCab = reg(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.05 }));
    this.matNeon = reg(new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }));
    this.matGlass = reg(new THREE.MeshBasicMaterial({ color: 0xcfeaff, transparent: true, opacity: 0.12, depthWrite: false }));
    this.matChute = reg(new THREE.MeshBasicMaterial({ color: new THREE.Color(th.accent), transparent: true, opacity: 0.28, depthWrite: false }));
    this.matRig = reg(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.4, metalness: 0.35 }));
    this.matStripe = reg(new THREE.MeshBasicMaterial({ color: 0x000000, toneMapped: false }));
    this.matProng = reg(new THREE.MeshStandardMaterial({ color: 0xb8c2cc, roughness: 0.3, metalness: 0.85 }));
    this.matPad = reg(new THREE.MeshStandardMaterial({ color: 0x333a45, roughness: 0.9, metalness: 0 }));
    this.matCable = reg(new THREE.MeshStandardMaterial({ color: 0x2a2f3a, roughness: 0.6, metalness: 0.3 }));

    /* ---- static cabinet ---- */
    const B = new _cmBuilder(), N = new _cmBuilder(), G = new _cmBuilder(), G2 = new _cmBuilder(), S = new _cmBuilder();
    B.box(0, 0.07, 0, 2.5, 0.14, 2.5, dark);
    B.box(0, 0.245, 0, 2.4, 0.21, 2.4, body);                                   // bottom slab (shaft floor below)
    B.box(0, 0.695, -0.375, 2.4, 0.69, 1.65, body);                             // A  (z -1.2 .. 0.45)
    B.box(0.375, 0.695, 0.825, 1.65, 0.69, 0.75, body);                         // B  (x -0.45 .. 1.2, z 0.45 .. 1.2)
    B.box(-1.125, 0.695, 0.825, 0.15, 0.69, 0.75, body);                        // C  left wall of shaft
    B.box(-0.75, 0.695, 1.125, 0.6, 0.69, 0.15, body);                          // D  front wall of shaft
    // shaft liners (dark inside)
    const shaft = new THREE.Color(0x14141f);
    B.box(-0.75, 0.36, 0.75, 0.6, 0.02, 0.6, shaft);
    B.box(-0.46, 0.7, 0.75, 0.02, 0.68, 0.6, shaft);
    B.box(-0.75, 0.7, 0.46, 0.6, 0.68, 0.02, shaft);
    B.box(-1.04, 0.7, 0.75, 0.02, 0.68, 0.6, shaft);
    B.box(-0.75, 0.7, 1.04, 0.6, 0.68, 0.02, shaft);
    N.box(-0.75, 0.375, 0.75, 0.46, 0.006, 0.46, neon.clone().multiplyScalar(0.55));
    // corner trims + stripes + inset panels
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) B.box(sx * 1.17, 0.59, sz * 1.17, 0.14, 0.9, 0.14, trim);
    B.box(0, 0.9, 1.206, 2.2, 0.07, 0.014, trim);
    B.box(0.55, 0.5, 1.203, 1.0, 0.5, 0.01, mid);
    B.box(-0.75, 0.45, 1.205, 0.8, 0.6, 0.01, dark);
    for (const sx of [-1, 1]) {
      B.box(sx * 1.206, 0.9, 0, 0.014, 0.07, 2.2, trim);
      B.box(sx * 1.203, 0.5, 0, 0.01, 0.5, 1.9, mid);
      B.box(0, 0.9, sx * 1.206, 2.2, 0.07, 0.014, trim);
    }
    // top frame around the pit
    B.box(0, 1.08, 1.15, 2.5, 0.08, 0.2, trim);
    B.box(0, 1.08, -1.15, 2.5, 0.08, 0.2, trim);
    B.box(-1.15, 1.08, 0, 0.2, 0.08, 2.1, trim);
    B.box(1.15, 1.08, 0, 0.2, 0.08, 2.1, trim);
    // pit floor: checker tiles around the chute hole
    const f1 = floorC.clone(), f2 = floorC.clone().lerp(T.white, 0.28);
    for (let ix = 0; ix < 7; ix++) for (let iz = 0; iz < 7; iz++) {
      if (ix < 2 && iz > 4) continue;
      B.box(P.minX + 0.15 + ix * 0.3, 1.07, P.minZ + 0.15 + iz * 0.3, 0.3, 0.06, 0.3, ((ix + iz) & 1) ? f1 : f2);
    }
    // pillars + caps
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      B.box(sx * 1.125, 2.06, sz * 1.125, 0.15, 1.92, 0.15, trim);
      B.box(sx * 1.125, 1.14, sz * 1.125, 0.2, 0.08, 0.2, accent);
    }
    // top frame under the marquee
    B.box(0, 2.97, 1.125, 2.4, 0.06, 0.15, trim); B.box(0, 2.97, -1.125, 2.4, 0.06, 0.15, trim);
    B.box(-1.125, 2.97, 0, 0.15, 0.06, 2.1, trim); B.box(1.125, 2.97, 0, 0.15, 0.06, 2.1, trim);
    // back panel
    for (let i = 0; i < 7; i++) B.box(-0.9 + i * 0.3, 2.05, -1.12, 0.3, 1.9, 0.08, (i & 1) ? light : mid);
    for (let i = 0; i < 7; i++) B.cyl(-0.9 + i * 0.3, 2.2 + ((i & 1) ? 0.25 : 0), -1.07, 0.07, 0.02, (i & 1) ? accent : trim, Math.PI / 2, 0, 0, 12);
    // marquee
    B.box(0, 3.375, 0, 2.44, 0.75, 2.44, body);
    B.box(0, 3.78, 0, 2.52, 0.07, 2.52, trim);
    B.box(0, 3.0, 0, 2.52, 0.04, 2.52, trimDark);
    B.box(0, 3.38, 1.222, 2.36, 0.68, 0.012, dark);
    for (const sx of [-1, 1]) { B.box(sx * 1.222, 3.375, 0, 0.012, 0.5, 2.0, mid); N.box(sx * 1.23, 3.375, 0, 0.01, 0.06, 1.9, neon); }
    // control deck (front right)
    B.box(0.62, 0.52, 1.36, 1.1, 0.78, 0.3, trimDark);
    const deck = new THREE.Matrix4().compose(new THREE.Vector3(0.62, 0.93, 1.4), new THREE.Quaternion().setFromEuler(new THREE.Euler(0.32, 0, 0)), new THREE.Vector3(1, 1, 1));
    B.setParent(deck); N.setParent(deck);
    B.box(0, 0, 0, 1.14, 0.1, 0.5, trim);
    B.box(0, -0.03, 0.25, 1.14, 0.06, 0.04, accent);
    B.cyl(-0.3, 0.06, 0, 0.075, 0.03, shaft); B.cyl(-0.3, 0.14, 0, 0.016, 0.15, new THREE.Color(0xdde3ea)); B.sph(-0.3, 0.235, 0, 0.058, new THREE.Color(0xff3b4a));
    B.cyl(0.12, 0.065, 0.02, 0.125, 0.03, shaft); B.cyl(0.12, 0.09, 0.02, 0.095, 0.04, new THREE.Color(0x2fe06a));
    N.cyl(0.12, 0.112, 0.02, 0.07, 0.006, new THREE.Color(0xa6ffc4));
    B.box(0.44, 0.056, -0.06, 0.2, 0.014, 0.14, shaft); N.box(0.44, 0.066, -0.06, 0.1, 0.006, 0.014, neon); N.box(0.44, 0.066, -0.11, 0.16, 0.006, 0.01, accent);
    B.setParent(null); N.setParent(null);
    // neon accents
    N.box(0, 0.2, 1.208, 2.3, 0.03, 0.008, neon);
    for (const sx of [-1, 1]) N.box(sx * 1.208, 0.2, 0, 0.008, 0.03, 2.3, neon);
    N.box(0, 2.93, 1.0, 2.0, 0.03, 0.04, neon); N.box(0, 2.93, -0.9, 2.0, 0.03, 0.04, neon);
    for (const sx of [-1, 1]) N.box(sx * 1.0, 2.93, 0, 0.04, 0.03, 2.0, neon);
    N.box(C.maxX, base + C.wallHeight, (C.minZ + C.maxZ) / 2, 0.05, 0.03, C.maxZ - C.minZ, accent);
    N.box((C.minX + C.maxX) / 2, base + C.wallHeight, C.minZ, C.maxX - C.minX, 0.03, 0.05, accent);
    // rails
    for (const sx of [-1, 1]) {
      B.box(sx * 1.04, 2.96, 0, 0.07, 0.05, 2.1, metal);
      B.box(sx * 1.04, 2.92, 0, 0.035, 0.05, 2.1, dark);
      B.box(sx * 1.04, 2.96, 1.05, 0.1, 0.09, 0.04, trimDark); B.box(sx * 1.04, 2.96, -1.05, 0.1, 0.09, 0.04, trimDark);
      S.box(sx * 1.04, 2.9885, 0, 0.026, 0.008, 1.9, T.white);
    }
    // glass
    G.box(0, 2.06, 1.135, 2.1, 1.84, 0.012, T.white);
    for (const sx of [-1, 1]) G.box(sx * 1.135, 2.06, 0, 0.012, 1.84, 2.1, T.white);
    G2.box(C.maxX, base + C.wallHeight / 2, (C.minZ + C.maxZ) / 2, 0.025, C.wallHeight, C.maxZ - C.minZ, T.white);
    G2.box((C.minX + C.maxX) / 2, base + C.wallHeight / 2, C.minZ, C.maxX - C.minX, C.wallHeight, 0.025, T.white);

    this.cabMesh = mesh(B.build(), this.matCab, null, 'cabinet');
    this.neonMesh = mesh(N.build(), this.matNeon, null, 'neon');
    this.railStripes = mesh(S.build(false), this.matStripe, null, 'railStripes');
    this.glassMesh = mesh(G.build(false), this.matGlass, null, 'glass'); this.glassMesh.renderOrder = 5;
    this.chuteMesh = mesh(G2.build(false), this.matChute, null, 'chuteGlass'); this.chuteMesh.renderOrder = 5;
    const sh = Scene3D && Scene3D.preset && Scene3D.preset.shadows;
    this.cabMesh.castShadow = !!sh; this.cabMesh.receiveShadow = !!sh;

    // prize flap (hinge at top edge)
    const FB = new _cmBuilder();
    FB.box(0, -0.22, 0, 0.66, 0.44, 0.04, accent);
    FB.box(0, -0.22, 0.025, 0.56, 0.34, 0.012, trim);
    FB.box(0, -0.38, 0.04, 0.3, 0.04, 0.03, dark);
    this.flap = mesh(FB.build(), this.matCab, null, 'flap');
    this.flap.position.set(D.prizeDoor.x, 0.68, 1.228);

    /* ---- marquee sign + clover ---- */
    this.signCanvas = document.createElement('canvas'); this.signCanvas.width = 1024; this.signCanvas.height = 300;
    this.signTex = new THREE.CanvasTexture(this.signCanvas); this.signTex.colorSpace = THREE.SRGBColorSpace; this.signTex.anisotropy = 4;
    this._tex.push(this.signTex);
    this.signMat = reg(new THREE.MeshBasicMaterial({ map: this.signTex, toneMapped: false }));
    this.sign = mesh(new THREE.PlaneGeometry(2.2, 0.6), this.signMat, null, 'sign');
    this.sign.position.set(0, 3.38, 1.23);
    this.cloverCanvas = document.createElement('canvas'); this.cloverCanvas.width = 256; this.cloverCanvas.height = 256;
    this._drawClover();
    this.cloverTex = new THREE.CanvasTexture(this.cloverCanvas); this.cloverTex.colorSpace = THREE.SRGBColorSpace; this._tex.push(this.cloverTex);
    this.cloverMat = reg(new THREE.MeshBasicMaterial({ map: this.cloverTex, transparent: true, depthWrite: false, toneMapped: false }));
    this.clover = mesh(new THREE.PlaneGeometry(0.5, 0.5), this.cloverMat, null, 'clover');
    this.clover.position.set(-0.93, 3.38, 1.24); this.clover.visible = false; this.clover.renderOrder = 6;

    /* ---- chase bulbs (one InstancedMesh) ---- */
    const NB = 44, hw = 1.17, hh = 0.34, per = 4 * hw + 4 * hh;
    this.bulbN = NB; this.bulbPos = [];
    for (let i = 0; i < NB; i++) {
      let d = (i / NB) * per, x, y;
      if (d < 2 * hw) { x = -hw + d; y = hh; } else if ((d -= 2 * hw) < 2 * hh) { x = hw; y = hh - d; }
      else if ((d -= 2 * hh) < 2 * hw) { x = hw - d; y = -hh; } else { d -= 2 * hw; x = -hw; y = -hh + d; }
      this.bulbPos.push(x, 3.38 + y);
    }
    this.matBulb = reg(new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }));
    const bg = new THREE.SphereGeometry(0.032, 8, 6); this._geos.push(bg);
    this.bulbs = new THREE.InstancedMesh(bg, this.matBulb, NB); this.bulbs.frustumCulled = false;
    const mm = new THREE.Matrix4();
    for (let i = 0; i < NB; i++) { mm.makeTranslation(this.bulbPos[i * 2], this.bulbPos[i * 2 + 1], 1.238); this.bulbs.setMatrixAt(i, mm); this.bulbs.setColorAt(i, T.white); }
    this.group.add(this.bulbs);

    /* ---- claw rig ---- */
    this.bridge = new THREE.Group(); this.group.add(this.bridge);
    const BR = new _cmBuilder(), BS = new _cmBuilder();
    BR.box(0, 2.9, 0, 2.1, 0.09, 0.14, light);
    BR.box(0, 2.94, 0, 2.0, 0.025, 0.1, trim);
    for (const sx of [-1, 1]) { BR.box(sx * 1.04, 2.93, 0, 0.12, 0.09, 0.22, dark); BR.box(sx * 1.04, 2.9, 0, 0.1, 0.06, 0.2, accent); }
    BS.box(0, 2.9, 0.072, 1.9, 0.02, 0.004, T.white);
    this.bridgeMesh = mesh(BR.build(), this.matRig, this.bridge, 'bridge');
    this.bridgeStripe = mesh(BS.build(false), this.matStripe, this.bridge, 'bridgeStripe');
    this.carriage = new THREE.Group(); this.bridge.add(this.carriage);
    const CR = new _cmBuilder(), CS = new _cmBuilder();
    CR.box(0, 2.9, 0, 0.32, 0.15, 0.28, accent);
    CR.box(0, 2.985, 0, 0.26, 0.04, 0.22, trimDark);
    CR.cyl(0, 2.835, 0, 0.045, 0.04, dark);
    for (const sx of [-1, 1]) CR.cyl(sx * 0.17, 2.93, 0, 0.045, 0.04, dark, 0, 0, Math.PI / 2);
    CS.box(0, 2.9, 0.142, 0.22, 0.025, 0.004, T.white); CS.box(0, 2.9, -0.142, 0.22, 0.025, 0.004, T.white);
    this.carMesh = mesh(CR.build(), this.matRig, this.carriage, 'carriage');
    this.carStripe = mesh(CS.build(false), this.matStripe, this.carriage, 'carriageStripe');
    this.swing = new THREE.Group(); this.swing.position.y = _cmK.cableTopY; this.carriage.add(this.swing);
    this.cable = mesh(new THREE.CylinderGeometry(0.011, 0.011, 1, 6), this.matCable, this.swing, 'cable');
    this.hubGroup = new THREE.Group(); this.swing.add(this.hubGroup);
    const HB = new _cmBuilder();
    HB.sph(0, 0, 0, 0.1, light, 0.8);
    HB.cyl(0, 0.075, 0, 0.045, 0.06, dark);
    HB.cyl(0, -0.02, 0, 0.105, 0.025, accent, 0, 0, 0, 18);
    for (let i = 0; i < 3; i++) HB.sph(Math.cos(i * TAU / 3 + Math.PI / 2) * 0.1, 0, Math.sin(i * TAU / 3 + Math.PI / 2) * 0.1, 0.034, trim);
    this.hubMesh = mesh(HB.build(), this.matRig, this.hubGroup, 'hub');

    // prong geometry (shared by 3 prongs)
    const K = _cmK, W = T.white;
    const UB = new _cmBuilder(); UB.box(0, -K.L1 / 2, 0, 0.04, K.L1 + 0.02, 0.055, W); UB.sph(0, 0, 0, 0.034, W); UB.sph(0, -K.L1, 0, 0.034, W);
    const LB = new _cmBuilder(); LB.box(0, -K.L2 / 2, 0, 0.04, K.L2, 0.055, W);
    const cdx = Math.sin(K.curlAng), cdy = -Math.cos(K.curlAng);
    LB.box(cdx * K.curl / 2, -K.L2 + cdy * K.curl / 2, 0, 0.038, K.curl + 0.015, 0.05, W, 0, 0, K.curlAng);
    LB.sph(cdx * K.curl, -K.L2 + cdy * K.curl, 0, 0.03, W);
    const PB = new _cmBuilder(); PB.box(0, 0, 0, 0.03, 0.1, 0.065, W);
    const upGeo = UB.build(false), loGeo = LB.build(false), padGeo = PB.build(false);
    this.prongs = [];
    for (let i = 0; i < 3; i++) {
      const pg = new THREE.Group(); pg.rotation.y = -this.prongTh[i]; this.hubGroup.add(pg);
      const up = new THREE.Group(); up.position.set(K.R0, 0, 0); pg.add(up);
      const upM = mesh(upGeo, this.matProng, up, 'prongU');
      const lo = new THREE.Group(); lo.position.set(0, -K.L1, 0); up.add(lo);
      const loM = mesh(loGeo, this.matProng, lo, 'prongL');
      const pad = mesh(padGeo, this.matPad, lo, 'pad'); pad.position.set(-0.035, -0.19, 0); pad.visible = false;
      this.prongs.push({ pg, up, lo, upM, loM, pad });
    }
    this._geos = Array.from(new Set(this._geos));

    /* ---- target ring ---- */
    const rg = new THREE.RingGeometry(D.gripRadius - 0.055, D.gripRadius, 48); rg.rotateX(-Math.PI / 2);
    this.ringMat = reg(new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, depthTest: false, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
    this.ring = mesh(rg, this.ringMat, null, 'ring'); this.ring.renderOrder = 10; this.ring.visible = false;

    this._poseRig(0);
    this._lc1 = new THREE.Color(); this._lc2 = new THREE.Color();
    this._updateKin(0);
  }

  _drawClover() {
    const c = this.cloverCanvas, g = c.getContext('2d');
    g.clearRect(0, 0, 256, 256);
    g.save(); g.translate(128, 120);
    g.shadowColor = '#7dff6a'; g.shadowBlur = 26;
    for (let k = 0; k < 4; k++) {
      g.save(); g.rotate(Math.PI / 4 + k * Math.PI / 2);
      g.beginPath(); g.moveTo(0, -6);
      g.bezierCurveTo(-52, -26, -60, -88, -22, -92); g.bezierCurveTo(-8, -94, 0, -82, 0, -72);
      g.bezierCurveTo(0, -82, 8, -94, 22, -92); g.bezierCurveTo(60, -88, 52, -26, 0, -6);
      const gr = g.createLinearGradient(0, -90, 0, 0); gr.addColorStop(0, '#b6ff7a'); gr.addColorStop(1, '#17b24a');
      g.fillStyle = gr; g.fill(); g.lineWidth = 6; g.strokeStyle = '#eaffd0'; g.stroke();
      g.restore();
    }
    g.shadowBlur = 10; g.lineWidth = 9; g.lineCap = 'round'; g.strokeStyle = '#8cf56a';
    g.beginPath(); g.moveTo(0, 6); g.quadraticCurveTo(10, 60, 44, 96); g.stroke();
    g.restore();
  }

  _drawSign() {
    const c = this.signCanvas, g = c.getContext('2d'), W = c.width, H = c.height;
    const th = this.theme, T = _cmTmp();
    const trim = new THREE.Color(th.machineTrim), body = new THREE.Color(th.machineBody);
    const gr = g.createLinearGradient(0, 0, 0, H);
    gr.addColorStop(0, _cmHex(body.clone().lerp(T.white, 0.25))); gr.addColorStop(1, _cmHex(body.clone().multiplyScalar(0.55)));
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(0, 0, W, H * 0.42);
    g.lineWidth = 10; g.strokeStyle = _cmHex(trim); g.strokeRect(8, 8, W - 16, H - 16);
    const ff = '"Baloo 2","Fredoka One","Arial Rounded MT Bold","Trebuchet MS",system-ui,sans-serif';
    const name = String(this.world.machineName || 'Claw Machine').toUpperCase();
    let fs = 118; g.textAlign = 'center'; g.textBaseline = 'middle';
    do { g.font = '900 ' + fs + 'px ' + ff; fs -= 4; } while (g.measureText(name).width > 740 && fs > 30);
    const nx = 590, ny = 112;
    g.lineJoin = 'round'; g.lineWidth = 16; g.strokeStyle = '#2a1840'; g.strokeText(name, nx, ny);
    g.shadowColor = th.neon; g.shadowBlur = 22; g.fillStyle = '#ffffff'; g.fillText(name, nx, ny); g.shadowBlur = 0;
    const chip = (txt, x, col) => {
      g.font = '900 64px ' + ff; const w = g.measureText(txt).width + 56, y = 238, hgt = 80;
      g.fillStyle = '#2a1840'; g.beginPath(); g.roundRect(x - w / 2 - 5, y - hgt / 2 - 5, w + 10, hgt + 10, 28); g.fill();
      g.fillStyle = col; g.beginPath(); g.roundRect(x - w / 2, y - hgt / 2, w, hgt, 24); g.fill();
      g.fillStyle = '#2a1840'; g.fillText(txt, x, y + 3);
    };
    const lvSum = this._levelSum(), cap = Math.round(this.stats.capacity || 0);
    chip('CAP ' + cap, 440, _cmHex(trim));
    chip('LV ' + lvSum, 760, '#7dffb0');
    this.signTex.needsUpdate = true;
  }

  _levelSum() { const u = (Game.player && Game.player.upgrades) || {}; let s = 0; for (const k in u) if (isNum(u[k])) s += u[k]; return s; }

  /* ================= upgrades ================= */
  applyUpgradeVisuals() {
    const u = (Game.player && Game.player.upgrades) || {};
    const lv = this.lv = { strength: u.strength | 0, luck: u.luck | 0, speed: u.speed | 0, protection: u.protection | 0, capacity: u.capacity | 0, special: u.special | 0 };
    this.stats = _cmStatsOf();
    this.strTier = Math.min(5, Math.floor(lv.strength / 5));
    const m = this.matProng;
    const tiers = [[0xb8c2cc, 0.9, 0.32], [0xcd7f32, 0.9, 0.35], [0xe6edf5, 1, 0.2], [0xffd23a, 1, 0.22], [0x8ff7ff, 0.6, 0.15], [0xffffff, 0.8, 0.25]];
    const tr = tiers[this.strTier];
    m.color.set(tr[0]); m.metalness = tr[1]; m.roughness = tr[2];
    m.emissive.set(this.strTier === 4 ? 0x16c9ff : 0x000000); m.emissiveIntensity = this.strTier === 4 ? 0.7 : 0;
    this.prongThick = 1 + 0.02 * Math.min(25, lv.strength);
    const padCols = [0x3a3f4a, 0x2ecc71, 0x3aa0ff, 0xb04cff, 0xffc400];
    this.padScale = 0.8 + 0.06 * Math.min(12, lv.protection);
    if (lv.protection > 0) this.matPad.color.set(padCols[Math.min(4, Math.floor((lv.protection - 1) / 4))]);
    for (const p of this.prongs) p.pad.visible = lv.protection > 0;
    this.stripeBase = 0.12 + 0.88 * Math.min(1, lv.speed / 20);
    this.clover.visible = lv.luck >= 1;
    this.lightSpeed = 1.4 + 0.2 * lv.special;
    this.lightRainbow = clamp((lv.special - 3) / 7, 0, 1);
    this._drawSign();
  }

  /* ================= bodies / physics ================= */
  _randPitPos(r, out) {
    const P = MACHINE_DIMS.pit, C = MACHINE_DIMS.chute;
    for (let i = 0; i < 30; i++) {
      const x = randRange(P.minX + r, P.maxX - r), z = randRange(P.minZ + r, P.maxZ - r);
      if (x < C.maxX + r + 0.06 && z > C.minZ - r - 0.06) continue;
      return out.set(x, 0, z);
    }
    return out.set(0.3, 0, -0.3);
  }

  _makeBody(entry) {
    let group;
    try { group = AnimalFactory.build(entry.id, entry.variant || 'normal'); } catch (e) { console.error('[machine] build', e); group = new THREE.Group(); }
    let r = 0.22; try { r = AnimalFactory.radiusOf(entry.id) || 0.22; } catch (e) { /* ignore */ }
    const holder = new THREE.Group(); holder.rotation.order = 'XZY'; holder.add(group);
    if (Scene3D && Scene3D.preset && Scene3D.preset.shadows) group.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    this.pitGroup.add(holder);
    const b = {
      entry, pid: entry.pid, group, holder, r,
      pos: new THREE.Vector3(), vel: new THREE.Vector3(), rel: new THREE.Vector3(),
      yaw: Math.random() * TAU, yawVel: 0, tiltX: 0, tiltZ: 0, baseTX: randRange(-0.08, 0.08), baseTZ: randRange(-0.08, 0.08),
      sleeping: false, sleepT: 0, held: false, delivered: false, contact: false, ground: false, spawnT: 1, ignoreT: 0,
      phase: Math.random() * 10, state: 'idle',
    };
    this.bodies.push(b);
    return b;
  }
  _syncXform(b) {
    b.holder.position.set(b.pos.x, b.pos.y - b.r, b.pos.z);
    b.holder.rotation.set(b.tiltX, b.yaw, b.tiltZ);
  }
  _removeBody(b, dispose = true) {
    const i = this.bodies.indexOf(b);
    if (i >= 0) this.bodies.splice(i, 1);
    if (this.held === b) this.held = null;
    this._wakeNear(b.pos.x, b.pos.z, 0.8);
    if (dispose) { if (b.holder.parent) b.holder.parent.remove(b.holder); try { AnimalFactory.dispose(b.group); } catch (e) { /* ignore */ } }
  }
  _wakeNear(x, z, range) {
    for (const o of this.bodies) if (o.sleeping) { const dx = o.pos.x - x, dz = o.pos.z - z; if (dx * dx + dz * dz < range * range) { o.sleeping = false; o.sleepT = 0; } }
  }

  syncPit() {
    for (const b of this.bodies.slice()) this._removeBody(b);
    this.bodies.length = 0; this.spawnQ.length = 0; this.held = null;
    const m = Game.player && Game.player.machines && Game.player.machines[this.worldId];
    const pit = (m && m.pit) || [];
    const base = MACHINE_DIMS.baseHeight;
    let i = 0;
    for (const entry of pit) {
      const b = this._makeBody(entry);
      this._randPitPos(b.r, b.pos);
      b.pos.y = base + b.r + 0.1 + (i % 4) * 0.3 + Math.random() * 0.1;
      b.spawnT = 1; i++;
    }
    const n = this.bodies.length;
    for (let s = 0; s < 300 && n; s++) this._physics(1 / 60);
    for (const b of this.bodies) { this._syncXform(b); b.sleeping = b.sleeping || false; }
  }

  _queueSpawn(entry) {
    if (!entry || this.disposed) return;
    for (const b of this.bodies) if (b.pid === entry.pid) return;
    for (const q of this.spawnQ) if (q.pid === entry.pid) return;
    this.spawnQ.push(entry);
  }
  _onRemove(pid) {
    for (let i = this.spawnQ.length - 1; i >= 0; i--) if (this.spawnQ[i].pid === pid) this.spawnQ.splice(i, 1);
    for (const b of this.bodies) if (b.pid === pid) { this._removeBody(b); return; }
  }
  _spawnNow(entry) {
    const b = this._makeBody(entry), D = MACHINE_DIMS;
    this._randPitPos(b.r, b.pos);
    b.pos.y = _cmK.spawnY; b.spawnT = 0; b.holder.scale.setScalar(0.001);
    b.vel.set(0, 0, 0);
    this._syncXform(b);
  }

  _physics(dt) {
    this._acc += Math.min(dt, 1 / 30);
    let n = 0;
    while (this._acc >= _cmK.step && n < 8) { this._substep(_cmK.step); this._acc -= _cmK.step; n++; }
    if (n === 0) return;
    const fdt = n * _cmK.step;
    for (const b of this.bodies) {
      if (b.held || b.sleeping) { b.contact = false; continue; }
      const sp2 = b.vel.x * b.vel.x + b.vel.y * b.vel.y + b.vel.z * b.vel.z;
      if (sp2 < 0.012 && b.contact) { b.sleepT += fdt; if (b.sleepT > 0.5) { b.sleeping = true; b.vel.set(0, 0, 0); } } else b.sleepT = 0;
      b.contact = false;
    }
  }

  _substep(h) {
    const bs = this.bodies, n = bs.length, K = _cmK;
    const dragK = Math.max(0, 1 - 0.3 * h);
    for (let i = 0; i < n; i++) {
      const b = bs[i];
      if (b.ignoreT > 0) b.ignoreT -= h;
      if (b.held || b.sleeping) continue;
      const v = b.vel;
      v.y -= K.gravity * h;
      v.multiplyScalar(dragK);
      b.pos.x += v.x * h; b.pos.y += v.y * h; b.pos.z += v.z * h;
      b.ground = false;
    }
    for (let it = 0; it < 2; it++) {
      this._collideKin();
      for (let i = 0; i < n; i++) {
        const a = bs[i];
        for (let j = i + 1; j < n; j++) this._pair(a, bs[j]);
      }
      for (let i = 0; i < n; i++) this._env(bs[i]);
    }
    const fg = Math.exp(-5 * h), fc = Math.exp(-1.5 * h);
    for (let i = 0; i < n; i++) {
      const b = bs[i];
      if (b.held || b.sleeping) continue;
      const f = b.ground ? fg : b.contact ? fc : 1;
      b.vel.x *= f; b.vel.z *= f;
    }
  }

  _pair(a, b) {
    const dx = b.pos.x - a.pos.x, dy = b.pos.y - a.pos.y, dz = b.pos.z - a.pos.z;
    const rs = a.r + b.r, d2 = dx * dx + dy * dy + dz * dz;
    if (d2 >= rs * rs) return;
    const aFixed = a.held || a.sleeping, bFixed = b.held || b.sleeping;
    if (aFixed && bFixed) return;
    let d = Math.sqrt(d2), nx, ny, nz;
    if (d < 1e-5) { nx = 0; ny = 1; nz = 0; d = 0; } else { nx = dx / d; ny = dy / d; nz = dz / d; }
    const pen = rs - d;
    const rvx = b.vel.x - a.vel.x, rvy = b.vel.y - a.vel.y, rvz = b.vel.z - a.vel.z;
    const rvn = rvx * nx + rvy * ny + rvz * nz;
    // wake sleepers that get hit
    if (a.sleeping && (-rvn > 0.3 || pen > 0.035)) { a.sleeping = false; a.sleepT = 0; }
    if (b.sleeping && (rvn > 0.3 || pen > 0.035)) { b.sleeping = false; b.sleepT = 0; }
    const ma = (a.held || a.sleeping) ? 0 : 1, mb = (b.held || b.sleeping) ? 0 : 1, sum = ma + mb;
    if (sum === 0) return;
    const corr = pen * 0.8 / sum;
    a.pos.x -= nx * corr * ma; a.pos.y -= ny * corr * ma; a.pos.z -= nz * corr * ma;
    b.pos.x += nx * corr * mb; b.pos.y += ny * corr * mb; b.pos.z += nz * corr * mb;
    a.contact = true; b.contact = true;
    if (rvn < 0) {
      const e = -rvn > 0.8 ? _cmK.restitution : 0;
      const imp = -(1 + e) * rvn / sum;
      a.vel.x -= nx * imp * ma; a.vel.y -= ny * imp * ma; a.vel.z -= nz * imp * ma;
      b.vel.x += nx * imp * mb; b.vel.y += ny * imp * mb; b.vel.z += nz * imp * mb;
      const f = 0.12;
      const tx = rvx - nx * rvn, ty = rvy - ny * rvn, tz = rvz - nz * rvn;
      a.vel.x += tx * f * ma / sum; a.vel.y += ty * f * ma / sum; a.vel.z += tz * f * ma / sum;
      b.vel.x -= tx * f * mb / sum; b.vel.y -= ty * f * mb / sum; b.vel.z -= tz * f * mb / sum;
      if (-rvn > 0.4) { a.yawVel += (Math.random() - 0.5) * -rvn * 3; b.yawVel += (Math.random() - 0.5) * -rvn * 3; }
    }
  }

  _collideKin() {
    const k = this.kin, kv = this.kinV, bs = this.bodies;
    for (let i = 0; i < bs.length; i++) {
      const b = bs[i];
      if (b.held || b.ignoreT > 0) continue;
      for (let s = 0; s < 7; s++) {
        const kx = k[s * 4], ky = k[s * 4 + 1], kz = k[s * 4 + 2], kr = k[s * 4 + 3];
        const dx = b.pos.x - kx, dy = b.pos.y - ky, dz = b.pos.z - kz;
        const rs = b.r + kr, d2 = dx * dx + dy * dy + dz * dz;
        if (d2 >= rs * rs) {
          if (b.sleeping && d2 < (rs + 0.08) * (rs + 0.08)) { const sp = kv[s * 3] * kv[s * 3] + kv[s * 3 + 1] * kv[s * 3 + 1] + kv[s * 3 + 2] * kv[s * 3 + 2]; if (sp > 0.06) { b.sleeping = false; b.sleepT = 0; } }
          continue;
        }
        let d = Math.sqrt(d2), nx, ny, nz;
        if (d < 1e-5) { nx = 1; ny = 0; nz = 0; } else { nx = dx / d; ny = dy / d; nz = dz / d; }
        const pen = rs - d;
        b.pos.x += nx * pen; b.pos.y += ny * pen; b.pos.z += nz * pen;
        const kvn = kv[s * 3] * nx + kv[s * 3 + 1] * ny + kv[s * 3 + 2] * nz;
        const bvn = b.vel.x * nx + b.vel.y * ny + b.vel.z * nz;
        if (bvn < kvn) { const dv = (kvn - bvn) * 1.05; b.vel.x += nx * dv; b.vel.y += ny * dv; b.vel.z += nz * dv; }
        b.sleeping = false; b.sleepT = 0; b.contact = true;
        b.yawVel += (Math.random() - 0.5) * 1.5;
      }
    }
  }

  _env(b) {
    if (b.held || b.sleeping) return;
    const D = MACHINE_DIMS, P = D.pit, C = D.chute, base = D.baseHeight, r = b.r, p = b.pos, v = b.vel;
    let t;
    if (p.x < (t = P.minX + r)) { p.x = t; if (v.x < 0) v.x *= -0.2; b.contact = true; } else if (p.x > (t = P.maxX - r)) { p.x = t; if (v.x > 0) v.x *= -0.2; b.contact = true; }
    if (p.z < (t = P.minZ + r)) { p.z = t; if (v.z < 0) v.z *= -0.2; b.contact = true; } else if (p.z > (t = P.maxZ - r)) { p.z = t; if (v.z > 0) v.z *= -0.2; b.contact = true; }
    const inChute = p.x < C.maxX && p.z > C.minZ;
    if (!(p.x < C.maxX - 0.02 && p.z > C.minZ + 0.02)) {
      const wt = base + C.wallHeight;
      this._box(b, C.maxX - 0.02, C.maxX + 0.02, base - 0.8, wt, C.minZ - 0.02, P.maxZ + 0.1);
      this._box(b, P.minX - 0.1, C.maxX + 0.02, base - 0.8, wt, C.minZ - 0.02, C.minZ + 0.02);
    }
    if (!inChute && p.y < base + r) {
      p.y = base + r;
      if (v.y < 0) v.y = v.y < -1.3 ? -v.y * 0.2 : 0;
      b.ground = true; b.contact = true;
    }
  }

  _box(b, x0, x1, y0, y1, z0, z1) {
    const p = b.pos, v = b.vel, r = b.r;
    const qx = p.x < x0 ? x0 : p.x > x1 ? x1 : p.x, qy = p.y < y0 ? y0 : p.y > y1 ? y1 : p.y, qz = p.z < z0 ? z0 : p.z > z1 ? z1 : p.z;
    let dx = p.x - qx, dy = p.y - qy, dz = p.z - qz;
    const d2 = dx * dx + dy * dy + dz * dz;
    if (d2 >= r * r) return;
    let nx, ny, nz, pen;
    if (d2 > 1e-10) { const d = Math.sqrt(d2); nx = dx / d; ny = dy / d; nz = dz / d; pen = r - d; }
    else {
      // centre inside the box: leave through the nearest face
      const a = [p.x - x0, x1 - p.x, p.y - y0, y1 - p.y, p.z - z0, z1 - p.z];
      let mi = 0; for (let i = 1; i < 6; i++) if (a[i] < a[mi]) mi = i;
      nx = ny = nz = 0;
      if (mi === 0) nx = -1; else if (mi === 1) nx = 1; else if (mi === 2) ny = -1; else if (mi === 3) ny = 1; else if (mi === 4) nz = -1; else nz = 1;
      pen = r + a[mi];
    }
    p.x += nx * pen; p.y += ny * pen; p.z += nz * pen;
    const vn = v.x * nx + v.y * ny + v.z * nz;
    if (vn < 0) { const e = vn < -0.8 ? 0.2 : 0; v.x -= nx * vn * (1 + e); v.y -= ny * vn * (1 + e); v.z -= nz * vn * (1 + e); }
    b.contact = true;
    if (ny > 0.7) b.ground = true;
  }

  /* ================= claw state machine ================= */
  _setState(s) { this.state = s; this.stateT = 0; Bus.emit('claw:state', { state: s }); }
  isBusy() { return this.state !== 'idle'; }
  canStart() {
    const cost = (this.world && this.world.playCost) || 0;
    if (this.state !== 'idle') return { ok: false, cost, err: 'Busy' };
    if (!Game.player || Game.player.coins < cost) return { ok: false, cost, err: 'Not enough coins' };
    return { ok: true, cost, err: null };
  }
  startPlay() {
    if (this.state !== 'idle') return { ok: false, err: 'Busy' };
    let res;
    try { res = Remote.invoke('claw:start', {}); } catch (e) { res = { ok: false, err: 'Error' }; console.error(e); }
    if (res && res.ok) {
      this.playId = res.playId; this.timeLeft = (typeof ECONOMY !== 'undefined' && ECONOMY.playTime) || 20;
      this.held = null; this.holdSlip = null; this.slipped = false; this.resultType = null; this.playWon = false; this.lastTickSec = -1;
      this.aim.on = false; this.inX = 0; this.inY = 0;
      this.openTarget = 0.7; this.openSpeed = 3;
      this._setState('aim'); _cmSfx('play');
    } else Bus.emit('toast', { text: (res && res.err) || 'Cannot play', kind: 'bad' });
    return res;
  }
  setMoveInput(x, y) { this.inX = clamp(+x || 0, -1, 1); this.inY = clamp(+y || 0, -1, 1); if (this.inX !== 0 || this.inY !== 0) this.aim.on = false; }
  aimAtScreen(nx, ny) {
    if (this.state !== 'aim' || !Scene3D.camera) return;
    const T = _cmTmp();
    T.plane.constant = -(MACHINE_DIMS.baseHeight + 0.35);
    this._raycaster.setFromCamera(T.v2.set(nx, ny), Scene3D.camera);
    if (!this._raycaster.ray.intersectPlane(T.plane, T.hit)) return;
    toLocalMachine(T.hit, T.hit);
    const P = MACHINE_DIMS.pit;
    this.aim.x = clamp(T.hit.x, P.minX + 0.15, P.maxX - 0.15); this.aim.z = clamp(T.hit.z, P.minZ + 0.15, P.maxZ - 0.15); this.aim.on = true;
  }
  drop() {
    if (this.state !== 'aim') return false;
    this.aim.on = false; this.inX = 0; this.inY = 0;
    _cmSfx('drop');
    this.openTarget = 1; this.openSpeed = 4; this._dropV = 0;
    this._setState('drop');
    return true;
  }

  _statsNow() { this.stats = _cmStatsOf(); return this.stats; }

  _moveMotor(on) { if (on !== this.motorOn) { this.motorOn = on; try { if (typeof Sfx !== 'undefined' && Sfx.motor) Sfx.motor(on); } catch (e) { /* ignore */ } } }

  _dropLimit() {
    const D = MACHINE_DIMS, base = D.baseHeight;
    _cmPose(1, this.pose);
    let lim = Math.max(base + 0.03 - this.pose.ty, base + 0.03 - this.pose.my + 0.05);
    for (const b of this.bodies) {
      if (b.held) continue;
      const dx = b.pos.x - this.hx, dz = b.pos.z - this.hz, rs = b.r + _cmK.hubR - 0.02, d2 = dx * dx + dz * dz;
      if (d2 >= rs * rs) continue;
      const y = b.pos.y + Math.sqrt(rs * rs - d2);
      if (y > lim) lim = y;
    }
    return lim;
  }

  _pickCandidate() {
    const gr = MACHINE_DIMS.gripRadius;
    let best = null, bd = 1e9;
    for (const b of this.bodies) {
      if (b.held || b.delivered) continue;
      const dx = b.pos.x - this.hx, dz = b.pos.z - this.hz, d = Math.sqrt(dx * dx + dz * dz);
      if (d >= gr) continue;
      if (b.pos.y > this.hy + 0.02 || b.pos.y + b.r < this.hy - 0.5) continue;
      if (d < bd) { bd = d; best = b; }
    }
    this._candD = bd;
    return best;
  }

  _doGrip() {
    const gr = MACHINE_DIMS.gripRadius;
    const cand = this._pickCandidate();
    this._gripDone = true; this.held = null;
    if (!cand) { this.openTarget = 0; this.openSpeed = 2.2; this.resultType = 'empty'; return; }
    const alignment = clamp(1 - this._candD / gr, 0, 1);
    let res = null;
    try { res = Remote.invoke('claw:grip', { playId: this.playId, pid: cand.pid, alignment }); } catch (e) { console.error(e); }
    if (!res || !res.ok) { this.openTarget = 0; this.openSpeed = 2.2; this.resultType = 'empty'; return; }
    this.held = cand; cand.held = true; cand.sleeping = false; cand.state = 'held';
    this.holdSuccess = !!res.success; this.holdSlip = isNum(res.slipAfter) ? res.slipAfter : null; this.gripT = 0; this.slipped = false;
    cand.rel.set(cand.pos.x - this.hx, cand.pos.y - this.hy, cand.pos.z - this.hz);
    this._wakeNear(cand.pos.x, cand.pos.z, 0.8);
    // choose how far the prongs close so the tips cradle the animal
    const relY = -(cand.r + 0.07);
    let o = 0.3;
    for (let i = 0; i < 3; i++) {
      _cmPose(o, this.pose);
      const dy = this.pose.ty - relY, chord = Math.sqrt(Math.max(0, cand.r * cand.r - dy * dy));
      o = _cmOpenForRadial(clamp(chord * 0.85, 0.03, 0.2), this.pose);
    }
    this.holdRelY = relY;
    this.openTarget = o; this.openSpeed = Math.max(0.5, (this.open - o) / 0.45);
    this.resultType = this.holdSuccess ? null : 'miss';
  }

  _releaseHeld(slip) {
    const b = this.held; if (!b) return;
    this.held = null; b.held = false; b.sleeping = false; b.sleepT = 0; b.ignoreT = 0.5; b.state = 'fall';
    if (slip) b.vel.set(this.hvx + randRange(-0.35, 0.35), this.hvy, this.hvz + randRange(-0.35, 0.35)); else b.vel.set(this.hvx, Math.min(0, this.hvy), this.hvz);
    b.yawVel += randRange(-2, 2);
    this._wakeNear(b.pos.x, b.pos.z, 0.8);
  }

  _glideTo(tx, tz, speed, dt) {
    const dx = tx - this.cx, dz = tz - this.cz, d = Math.hypot(dx, dz);
    if (d < 0.004) { this.cx = tx; this.cz = tz; this.vx = 0; this.vz = 0; return true; }
    const s = speed * (0.2 + 0.8 * Math.min(1, d / 0.35)), step = Math.min(d, s * dt);
    this.cx += dx / d * step; this.cz += dz / d * step;
    this.vx = dx / d * s; this.vz = dz / d * s;
    return false;
  }

  _updateClaw(dt) {
    const D = MACHINE_DIMS, P = D.pit;
    this.statsT -= dt; if (this.statsT <= 0) { this._statsNow(); this.statsT = 0.25; }
    const sp = this.stats.clawSpeed || 0.6, st = this.state;
    this.stateT += dt;
    const px = this.cx, pz = this.cz, py = this.cy;
    let moving = false;
    if (st === 'aim') {
      let dx = this.inX, dz = -this.inY;
      const m = Math.hypot(dx, dz);
      if (m > 1) { dx /= m; dz /= m; }
      dx *= sp; dz *= sp;
      if (m < 0.05 && this.aim.on) {
        const ex = this.aim.x - this.cx, ez = this.aim.z - this.cz, d = Math.hypot(ex, ez);
        if (d < 0.012) this.aim.on = false; else { const s = sp * Math.min(1, d * 5); dx = ex / d * s; dz = ez / d * s; }
      }
      const lam = 1 / 0.12;
      this.vx = damp(this.vx, dx, lam, dt); this.vz = damp(this.vz, dz, lam, dt);
      this.cx += this.vx * dt; this.cz += this.vz * dt;
      const lx0 = P.minX + 0.15, lx1 = P.maxX - 0.15, lz0 = P.minZ + 0.15, lz1 = P.maxZ - 0.15;
      if (this.cx < lx0) { this.cx = lx0; this.vx = 0; } else if (this.cx > lx1) { this.cx = lx1; this.vx = 0; }
      if (this.cz < lz0) { this.cz = lz0; this.vz = 0; } else if (this.cz > lz1) { this.cz = lz1; this.vz = 0; }
      moving = Math.hypot(this.vx, this.vz) > 0.04;
      this.timeLeft -= dt;
      const sec = Math.ceil(Math.max(0, this.timeLeft));
      if (this.timeLeft <= 5 && sec !== this.lastTickSec && this.timeLeft > 0) { this.lastTickSec = sec; _cmSfx('tick'); }
      if (this.timeLeft <= 0) { this.timeLeft = 0; this.drop(); }
      this.openTarget = 0.7;
    } else if (st === 'drop') {
      this.vx = damp(this.vx, 0, 12, dt); this.vz = damp(this.vz, 0, 12, dt);
      const lim = this._dropLimit();
      const vmax = Math.max(1.1, sp * 1.8);
      this._dropV = Math.min(vmax, this._dropV + 6 * dt);
      this.cy = Math.max(lim, this.cy - this._dropV * dt);
      moving = true;
      if (this.cy <= lim + 1e-4 && this.stateT > 0.15) { this._gripDone = false; this._setState('close'); _cmSfx('grab'); }
    } else if (st === 'close') {
      this.vx = 0; this.vz = 0;
      if (!this._gripDone) this._doGrip();
      if (this.stateT >= 0.45) { this.gripT = 0; this._setState('lift'); }
    } else if (st === 'lift') {
      this.vx = 0; this.vz = 0;
      this.cy = Math.min(D.clawTopY, this.cy + Math.max(1.0, sp * 1.5) * dt);
      moving = true;
      if (this.cy >= D.clawTopY - 1e-4) {
        if (!this.held && !this.slipped && (this.resultType === 'empty' || this.resultType === null)) { this.resultType = 'empty'; Bus.emit('claw:result', { type: 'empty', entry: null }); }
        this._setState('return');
      }
    } else if (st === 'return') {
      const h = this._home();
      moving = true;
      if (this._glideTo(h.x, h.z, sp * 1.3, dt) && this.stateT > 0.1) { this.openTarget = 1; this.openSpeed = 4; if (this.held) this._releaseHeld(false); this._setState('release'); }
    } else if (st === 'release') {
      this.vx = 0; this.vz = 0;
      if (this.stateT >= 0.35) this._setState('settle');
    } else if (st === 'settle') {
      const waiting = !this.playWon && this.stateT < 1.5 && this._fallingNearChute();
      if (this.playWon ? this.stateT > 0.3 : !waiting && this.stateT > 0.4) this._endPlay();
    } else {
      // idle: park at home
      const h = this._home();
      this._glideTo(h.x, h.z, sp * 1.3, dt);
      this.cy = damp(this.cy, D.clawTopY, 6, dt);
      this.openTarget = 0.5; this.openSpeed = 3;
    }
    // held body slip timing
    if ((st === 'lift' || st === 'return') && this.held) {
      this.gripT += dt;
      if (this.holdSlip !== null && this.gripT >= this.holdSlip) {
        const b = this.held, type = this.holdSuccess ? 'slip' : 'miss';
        this._releaseHeld(true); this.slipped = true; this.resultType = type; this.openTarget = 1; this.openSpeed = 5;
        Bus.emit('claw:result', { type, entry: b.entry });
      }
    }
    this._moveMotor(moving && st !== 'idle');
    // openness
    const od = this.openTarget - this.open;
    this.open += clamp(od, -this.openSpeed * dt, this.openSpeed * dt);
    // sway (pendulum)
    const ax = dt > 0 ? (this.vx - (this._pvx || 0)) / dt : 0, az = dt > 0 ? (this.vz - (this._pvz || 0)) / dt : 0;
    this._pvx = this.vx; this._pvz = this.vz;
    this.swayVX += (-30 * this.swayX - 5 * this.swayVX - 0.3 * clamp(ax, -12, 12)) * dt;
    this.swayVZ += (-30 * this.swayZ - 5 * this.swayVZ + 0.3 * clamp(az, -12, 12)) * dt;
    this.swayX = clamp(this.swayX + this.swayVX * dt, -0.12, 0.12); this.swayZ = clamp(this.swayZ + this.swayVZ * dt, -0.12, 0.12);
    const len = _cmK.cableTopY - this.cy;
    const nhx = this.cx + len * Math.sin(this.swayX), nhz = this.cz - len * Math.sin(this.swayZ);
    if (dt > 0) { this.hvx = (nhx - this.hx) / dt; this.hvy = (this.cy - this.hy) / dt; this.hvz = (nhz - this.hz) / dt; }
    this.hx = nhx; this.hy = this.cy; this.hz = nhz;
    void px; void pz; void py;
    this._updateKin(dt);
    // held body follows the hub
    const b = this.held;
    if (b) {
      b.rel.x = damp(b.rel.x, 0, 10, dt); b.rel.z = damp(b.rel.z, 0, 10, dt); b.rel.y = damp(b.rel.y, this.holdRelY, 8, dt);
      b.pos.set(this.hx + b.rel.x, this.hy + b.rel.y, this.hz + b.rel.z);
      b.vel.set(this.hvx, this.hvy, this.hvz);
    }
  }

  _fallingNearChute() {
    const C = MACHINE_DIMS.chute;
    for (const b of this.bodies) {
      if (b.held || b.sleeping) continue;
      if (b.pos.y > MACHINE_DIMS.baseHeight + b.r + 0.12 && b.pos.x < C.maxX + 0.1 && b.pos.z > C.minZ - 0.1) return true;
    }
    return false;
  }

  _endPlay() {
    const result = this.playWon ? 'win' : (this.resultType || 'miss');
    const id = this.playId; this.playId = null;
    try { Remote.invoke('claw:end', { playId: id, result }); } catch (e) { console.error(e); }
    this.lastResult = result;
    this._moveMotor(false);
    this.openTarget = 0.5;
    this._setState('idle');
  }

  _updateKin(dt) {
    const k = this.kin, kv = this.kinV, P = _cmPose(this.open, this.pose), K = _cmK;
    const set = (s, x, y, z, r) => {
      if (this.kinInit && dt > 0) { kv[s * 3] = (x - k[s * 4]) / dt; kv[s * 3 + 1] = (y - k[s * 4 + 1]) / dt; kv[s * 3 + 2] = (z - k[s * 4 + 2]) / dt; }
      k[s * 4] = x; k[s * 4 + 1] = y; k[s * 4 + 2] = z; k[s * 4 + 3] = r;
    };
    set(0, this.hx, this.hy, this.hz, K.hubR);
    for (let i = 0; i < 3; i++) {
      const c = this.prongC[i], s = this.prongS[i];
      set(1 + i, this.hx + c * P.tx, this.hy + P.ty, this.hz + s * P.tx, K.tipR);
      set(4 + i, this.hx + c * P.mx, this.hy + P.my, this.hz + s * P.mx, K.midR);
    }
    this.kinInit = true;
  }

  /* ================= per frame ================= */
  update(dt) {
    if (this.disposed) return;
    dt = clamp(dt || 0, 0, 0.1);
    const n = Math.max(1, Math.ceil(dt / (1 / 30 + 1e-9))), h = dt / n;
    for (let i = 0; i < n; i++) {
      this.t += h;
      this.spawnCd -= h;
      if (this.spawnQ.length && this.spawnCd <= 0) { this._spawnNow(this.spawnQ.shift()); this.spawnCd = 0.25; }
      this._updateClaw(h);
      this._physics(h);
      this._postPhysics(h);
    }
    this._updateVisuals(dt);
  }

  _postPhysics(dt) {
    const D = MACHINE_DIMS, C = D.chute, P = D.pit, base = D.baseHeight;
    const q = this._delQ; q.length = 0;
    for (let i = 0; i < this.bodies.length; i++) {
      const b = this.bodies[i], p = b.pos;
      if (b.held) continue;
      if (!(p.x === p.x && p.y === p.y && p.z === p.z)) { this._resetBody(b); continue; }
      if (p.x < C.maxX && p.z > C.minZ && p.y < base - 0.1) { q.push(b); continue; }
      if (p.y < base - 0.6 || p.y > 3.4 || p.x < P.minX - 0.3 || p.x > P.maxX + 0.3 || p.z < P.minZ - 0.3 || p.z > P.maxZ + 0.3) this._resetBody(b);
    }
    for (let i = 0; i < q.length; i++) this._deliver(q[i]);
    q.length = 0;
  }
  _resetBody(b) {
    this.resets++;
    this._randPitPos(b.r, b.pos); b.pos.y = MACHINE_DIMS.baseHeight + b.r + 0.4; b.vel.set(0, 0, 0); b.sleeping = false; b.sleepT = 0; b.ignoreT = 0;
  }

  _deliver(b) {
    if (b.delivered) return;
    b.delivered = true;
    this._removeBody(b, false);
    this.fading.push({ holder: b.holder, group: b.group, t: 0, vy: Math.min(b.vel.y, -1) });
    let res = null;
    try { res = Remote.invoke('claw:prize', { playId: this.playId || undefined, pid: b.pid }); } catch (e) { console.error(e); }
    if (res && res.ok) {
      this.playWon = true; this.resultType = 'win';
      Bus.emit('claw:result', { type: 'win', entry: b.entry });
      this._startPrizePop(b.entry);
    } else Bus.emit('toast', { text: (res && res.err) || 'Prize error', kind: 'bad' });
  }

  _startPrizePop(entry) {
    let g;
    try { g = AnimalFactory.build(entry.id, entry.variant || 'normal'); } catch (e) { console.error(e); return; }
    const holder = new THREE.Group(); holder.add(g); holder.scale.setScalar(0.001); this.group.add(holder);
    this.pops.push({ g, holder, t: 0 });
  }

  _updateVisuals(dt) {
    const D = MACHINE_DIMS, t = this.t, st = this.state;
    // bodies
    const hubDropping = st === 'drop' || st === 'close';
    for (let i = 0; i < this.bodies.length; i++) {
      const b = this.bodies[i];
      if (b.spawnT < 1) { b.spawnT = Math.min(1, b.spawnT + dt / 0.35); b.holder.scale.setScalar(Math.max(0.001, Ease.outBack(b.spawnT))); }
      let state = 'idle';
      if (b.held) state = 'held';
      else if (!b.sleeping && b.vel.y < -1.6 && !b.ground) state = 'fall';
      else if (hubDropping) { const dx = b.pos.x - this.hx, dz = b.pos.z - this.hz; if (dx * dx + dz * dz < 0.36) state = 'nervous'; }
      if (!b.sleeping || b.held) {
        const lim = 0.35;
        const tx = b.baseTX + clamp(b.vel.z * 0.25, -lim, lim), tz = b.baseTZ + clamp(-b.vel.x * 0.25, -lim, lim);
        b.tiltX = damp(b.tiltX, tx, 8, dt); b.tiltZ = damp(b.tiltZ, tz, 8, dt);
        b.yaw += b.yawVel * dt + (b.vel.x - b.vel.z) * 0.15 * dt; b.yawVel = damp(b.yawVel, 0, 2.5, dt);
        if (b.held) b.yaw += Math.sin(t * 2 + b.phase) * 0.4 * dt;
        this._syncXform(b);
      } else { b.tiltX = damp(b.tiltX, b.baseTX, 4, dt); b.tiltZ = damp(b.tiltZ, b.baseTZ, 4, dt); b.yaw += Math.sin(t * 0.3 + b.phase) * 0.02 * dt; this._syncXform(b); }
      try { AnimalFactory.animate(b.group, t + b.phase, state, dt); } catch (e) { /* ignore */ }
    }
    // delivered bodies shrinking into the shaft
    for (let i = this.fading.length - 1; i >= 0; i--) {
      const f = this.fading[i]; f.t += dt; f.holder.position.y -= 1.2 * dt;
      f.holder.scale.setScalar(Math.max(0.001, 1 - f.t / 0.25));
      if (f.t >= 0.25) { if (f.holder.parent) f.holder.parent.remove(f.holder); try { AnimalFactory.dispose(f.group); } catch (e) { /* ignore */ } this.fading.splice(i, 1); }
    }
    // prize pops
    let flapWant = 0;
    for (let i = this.pops.length - 1; i >= 0; i--) {
      const p = this.pops[i]; p.t += dt;
      const u = Math.min(1, p.t / 0.55), door = D.prizeDoor;
      let s = 0.3 + 0.7 * Ease.outBack(Math.min(1, p.t / 0.4));
      if (p.t > 1.2) s *= Math.max(0, 1 - (p.t - 1.2) / 0.3);
      p.holder.position.set(door.x, lerp(0.12, 0.02, u) + 0.5 * Math.sin(Math.PI * u), lerp(1.1, 1.85, Ease.outBack(u)));
      p.holder.rotation.y = p.t * 5; p.holder.scale.setScalar(Math.max(0.001, s));
      try { AnimalFactory.animate(p.g, t, 'happy', dt); } catch (e) { /* ignore */ }
      if (p.t < 1.3) flapWant = 1;
      if (p.t >= 1.5) { if (p.holder.parent) p.holder.parent.remove(p.holder); try { AnimalFactory.dispose(p.g); } catch (e) { /* ignore */ } this.pops.splice(i, 1); }
    }
    this.flapOpen = damp(this.flapOpen, flapWant, 10, dt);
    this.flap.rotation.x = -this.flapOpen * 1.15;

    this._poseRig(dt);
    this._updateLights(dt);
    this._updateRing(dt);
  }

  _poseRig(dt) {
    const K = _cmK;
    this.bridge.position.z = this.cz;
    this.carriage.position.x = this.cx;
    this.swing.rotation.set(this.swayZ, 0, this.swayX);
    const len = Math.max(0.05, K.cableTopY - this.cy);
    this.hubGroup.position.y = -len;
    this.cable.scale.y = Math.max(0.001, len - 0.05); this.cable.position.y = -(len - 0.05) / 2;
    const P = _cmPose(this.open, this.pose);
    const th = this.prongThick || 1;
    for (const p of this.prongs) {
      p.up.rotation.z = P.a1; p.lo.rotation.z = P.a2;
      p.upM.scale.set(th, 1, th); p.loM.scale.set(th, 1, th);
    }
    // pulses
    const pulse = this.pulse;
    for (const k in pulse) { pulse[k] = Math.max(0, pulse[k] - dt / 0.9); if (pulse[k] <= 0) delete pulse[k]; }
    const ps = pulse.protection ? 1 + 0.5 * Math.sin(pulse.protection * Math.PI) : 1, pt = pulse.strength ? 1 + 0.25 * Math.sin(pulse.strength * Math.PI) : 1;
    const sc = (this.padScale || 1) * ps;
    for (const p of this.prongs) { p.pad.scale.setScalar(sc); if (pt !== 1) { p.upM.scale.set(th * pt, 1, th * pt); p.loM.scale.set(th * pt, 1, th * pt); } }
    // strength tier effects
    if (this.strTier >= 5) this.matProng.color.setHSL((this.t * 0.25) % 1, 0.85, 0.6);
    else if (this.strTier === 4) this.matProng.emissiveIntensity = 0.5 + 0.35 * Math.sin(this.t * 4);
    // speed stripes
    const T = _cmTmp();
    const lvS = (this.stripeBase || 0.12) + (pulse.speed ? pulse.speed : 0) + 0.12 * Math.sin(this.t * 3) * (this.lv.speed > 0 ? 1 : 0.3);
    T.c.set(this.theme.neon).multiplyScalar(clamp(lvS, 0.05, 1.6));
    this.matStripe.color.copy(T.c);
    // clover
    if (this.clover.visible) {
      const cs = (0.8 + 0.04 * Math.min(10, this.lv.luck)) * (1 + 0.06 * Math.sin(this.t * 3)) * (pulse.luck ? 1 + 0.5 * Math.sin(pulse.luck * Math.PI) : 1);
      this.clover.scale.setScalar(cs); this.cloverMat.opacity = 0.8 + 0.2 * Math.sin(this.t * 3);
    }
    const sp = pulse.capacity || pulse.special ? 1 + 0.03 * Math.sin(Math.PI * (pulse.capacity || pulse.special)) : 1;
    this.sign.scale.setScalar(sp);
  }

  _updateLights(dt) {
    const T = _cmTmp(), n = this.bulbN, t = this.t;
    const spd = this.lightSpeed, rb = this.lightRainbow, boost = this.pulse.special ? 1 + this.pulse.special : 1;
    const busy = this.state !== 'idle' ? 1.3 : 1;
    const a = this._lc1.set(this.theme.accent), nc = this._lc2.set(this.theme.neon);
    for (let i = 0; i < n; i++) {
      const ph = i / n * 6.2832 * 2 - t * spd * busy;
      const w = 0.5 + 0.5 * Math.sin(ph), br = 0.18 + 0.82 * w * w;
      T.c.copy((i & 1) ? a : nc);
      if (rb > 0) { T.c2.setHSL(((i / n) + t * 0.15 * spd) % 1, 1, 0.55); T.c.lerp(T.c2, rb); }
      T.c.multiplyScalar(br * boost);
      this.bulbs.setColorAt(i, T.c);
    }
    this.bulbs.instanceColor.needsUpdate = true;
  }

  _updateRing(dt) {
    const aiming = this.state === 'aim';
    this.ring.visible = aiming;
    if (!aiming) return;
    const h = this.getHover();
    const base = MACHINE_DIMS.baseHeight;
    let y = base + 0.02, col = this._ringCol.none;
    for (const b of this.bodies) {
      if (b.held) continue;
      const dx = b.pos.x - this.hx, dz = b.pos.z - this.hz;
      if (dx * dx + dz * dz < b.r * b.r * 0.8 && b.pos.y + b.r * 0.9 > y) y = b.pos.y + b.r * 0.9;
    }
    if (h) col = h.chance >= 0.6 ? this._ringCol.good : h.chance >= 0.3 ? this._ringCol.mid : this._ringCol.bad;
    this.ring.position.set(this.hx, y, this.hz);
    this.ringMat.color.copy(col);
    const pu = 1 + 0.06 * Math.sin(this.t * 7);
    this.ring.scale.set(pu, 1, pu);
    this.ringMat.opacity = 0.7 + 0.25 * Math.sin(this.t * 7);
  }

  /* ================= queries ================= */
  getHover() {
    if (this.state !== 'aim' && this.state !== 'idle') return null;
    if (this.t - this._hoverT < 1 / 15 && this._hoverT >= 0) return this._hover;
    this._hoverT = this.t;
    const gr = MACHINE_DIMS.gripRadius;
    let best = null, bd = 1e9, by = -1e9;
    for (const b of this.bodies) {
      if (b.held || b.delivered) continue;
      const dx = b.pos.x - this.hx, dz = b.pos.z - this.hz, d = Math.sqrt(dx * dx + dz * dz);
      if (d >= gr) continue;
      if (!best || b.pos.y > by + 0.03 || (Math.abs(b.pos.y - by) <= 0.03 && d < bd)) { best = b; bd = d; by = b.pos.y; }
    }
    if (!best) { this._hover = null; return null; }
    const alignment = clamp(1 - bd / gr, 0, 1);
    let chance = 0.5;
    try { chance = Services.previewGrip(best.pid, alignment); } catch (e) { /* ignore */ }
    this._hover = { entry: best.entry, animal: ANIMAL_BY_ID[best.entry.id], chance, alignment };
    return this._hover;
  }
  getCameraView() {
    const v = this._camView, cx = this.cx;
    toWorldMachine(v.pos.set(cx * 0.25, 3.25, 3.6), v.pos);
    toWorldMachine(v.target.set(cx * 0.15, 1.55, -0.05), v.target);
    return v;
  }
  getChuteWorldPos() {
    const h = this._home();
    return toWorldMachine(this._chuteW.set(h.x, MACHINE_DIMS.baseHeight, h.z), this._chuteW);
  }

  /* ================= cleanup ================= */
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    Bus.off('pit:spawn', this._hSpawn); Bus.off('pit:remove', this._hRemove); Bus.off('upgrade:bought', this._hUpgrade);
    this._moveMotor(false);
    try { if (typeof Sfx !== 'undefined' && Sfx.motor) Sfx.motor(false); } catch (e) { /* ignore */ }
    for (const b of this.bodies) { try { AnimalFactory.dispose(b.group); } catch (e) { /* ignore */ } }
    for (const f of this.fading) { try { AnimalFactory.dispose(f.group); } catch (e) { /* ignore */ } }
    for (const p of this.pops) { try { AnimalFactory.dispose(p.g); } catch (e) { /* ignore */ } }
    this.bodies.length = 0; this.fading.length = 0; this.pops.length = 0; this.spawnQ.length = 0;
    if (this.group.parent) this.group.parent.remove(this.group);
    for (const g of this._geos) g.dispose();
    for (const m of this._mats) m.dispose();
    for (const t of this._tex) t.dispose();
    this.bulbs.dispose();
  }
}

function _cmStatsOf() {
  let s = null;
  try { s = Services.stats(); } catch (e) { /* ignore */ }
  return { clawSpeed: (s && s.clawSpeed) || 0.6, capacity: (s && s.capacity) || 6 };
}

const Machines = {
  active: null,
  create(worldId) {
    if (this.active) { try { this.active.dispose(); } catch (e) { console.error('[Machines]', e); } this.active = null; }
    const m = new ClawMachine(worldId);
    const s = ROOM.stations.machine;
    m.group.position.set(s.x, 0, s.z);
    Scene3D.scene.add(m.group);
    this.active = m;
    return m;
  },
};
