/* =====================================================================
   07_player.js — Input, Player, CameraRig, Interact
   Contract: ARCHITECTURE.md sections 6 + 7. Private helpers use prefix _pl.
   ===================================================================== */

/* ---------- shared scratch + state (private) ---------- */
const _plMove = { x: 0, y: 0 };
const _plKeys = {};                 // held move keys: { code: true }
const _plPointers = new Map();      // pointerId -> { x, y }
const _plActionKeys = {
  KeyE: 'interact', Space: 'primary', Enter: 'primary', NumpadEnter: 'primary',
  KeyI: 'panel:pets', KeyU: 'panel:upgrades', KeyG: 'panel:worlds',
  KeyX: 'panel:index', KeyB: 'panel:shop', KeyO: 'panel:settings',
};
const _plMoveKeys = {
  KeyW: [0, 1], ArrowUp: [0, 1], KeyS: [0, -1], ArrowDown: [0, -1],
  KeyA: [-1, 0], ArrowLeft: [-1, 0], KeyD: [1, 0], ArrowRight: [1, 0],
};
const _plS = {
  inited: false, canvas: null, pinch: 0, dragging: false,
  // player
  rig: null, body: null, head: null, armL: null, armR: null, legL: null, legR: null, hold: null,
  billboard: null, bbCanvas: null, bbTex: null, bbText: '',
  vx: 0, vz: 0, phase: 0, t: 0, spd: 0, rotY: 0,
  training: false, holdW: 0, heldId: null, heldModel: null,
  rep: -1, repHeld: false,
  pets: [], petT: 0,
  // camera
  camMode: 'follow', camInit: false, trans: 0, views: null, fov: 55,
  camPos: null, camLook: null, wantPos: null, wantLook: null,
  // interact
  curKey: null,
};

function _plInEditable(e) {
  const t = e.target;
  if (!t || !t.tagName) return false;
  const n = t.tagName;
  return n === 'INPUT' || n === 'TEXTAREA' || n === 'SELECT' || t.isContentEditable === true;
}
function _plBlocking() {
  return typeof UI !== 'undefined' && UI && typeof UI.isBlocking === 'function' && UI.isBlocking();
}
function _plAngleDamp(a, b, lambda, dt) {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU; else if (d < -Math.PI) d += TAU;
  return a + d * (1 - Math.exp(-lambda * dt));
}

/* ---------- rounded box with analytic normals ---------- */
function _plRoundBox(w, hh, d, r) {
  const g = new THREE.BoxGeometry(w, hh, d, 6, 6, 6);
  const pa = g.attributes.position, na = g.attributes.normal;
  const ix = w / 2 - r, iy = hh / 2 - r, iz = d / 2 - r;
  for (let i = 0; i < pa.count; i++) {
    const x = pa.getX(i), y = pa.getY(i), z = pa.getZ(i);
    const qx = clamp(x, -ix, ix), qy = clamp(y, -iy, iy), qz = clamp(z, -iz, iz);
    let nx = x - qx, ny = y - qy, nz = z - qz;
    const l = Math.hypot(nx, ny, nz) || 1;
    nx /= l; ny /= l; nz /= l;
    pa.setXYZ(i, qx + nx * r, qy + ny * r, qz + nz * r);
    na.setXYZ(i, nx, ny, nz);
  }
  return g;
}
function _plMesh(geo, mat, x, y, z) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x || 0, y || 0, z || 0);
  m.castShadow = true;
  return m;
}
function _plMat(color, rough) {
  return new THREE.MeshStandardMaterial({ color, roughness: rough == null ? 0.65 : rough, metalness: 0.0 });
}

function _plShadowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 2, 32, 32, 31);
  gr.addColorStop(0, 'rgba(0,0,0,0.5)');
  gr.addColorStop(0.6, 'rgba(0,0,0,0.25)');
  gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  return t;
}

function _plDrawBillboard(text) {
  const c = _plS.bbCanvas, g = c.getContext('2d');
  g.clearRect(0, 0, c.width, c.height);
  const W = c.width, H = c.height;
  g.fillStyle = 'rgba(25,20,60,0.78)';
  const r = 44, x = 6, y = 10, w = W - 12, hh = H - 20;
  g.beginPath();
  g.moveTo(x + r, y); g.lineTo(x + w - r, y); g.quadraticCurveTo(x + w, y, x + w, y + r);
  g.lineTo(x + w, y + hh - r); g.quadraticCurveTo(x + w, y + hh, x + w - r, y + hh);
  g.lineTo(x + r, y + hh); g.quadraticCurveTo(x, y + hh, x, y + hh - r);
  g.lineTo(x, y + r); g.quadraticCurveTo(x, y, x + r, y); g.closePath();
  g.fill();
  g.lineWidth = 6; g.strokeStyle = 'rgba(255,255,255,0.9)'; g.stroke();
  g.font = '800 64px "Baloo 2","Fredoka",system-ui,"Segoe UI Emoji","Apple Color Emoji",sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineJoin = 'round'; g.lineWidth = 9; g.strokeStyle = '#2a1d6b';
  g.strokeText(text, W / 2, H / 2 + 4);
  g.fillStyle = '#ffe14d';
  g.fillText(text, W / 2, H / 2 + 4);
  _plS.bbTex.needsUpdate = true;
}
function _plUpdateBillboard() {
  if (!_plS.bbCanvas) return;
  const s = Game.player ? Game.player.strength : 0;
  const text = '\u{1F4AA} ' + fmt(s);
  if (text === _plS.bbText) return;
  _plS.bbText = text;
  _plDrawBillboard(text);
}

/* =====================================================================
   Input
   ===================================================================== */
const Input = {
  virtual: { x: 0, y: 0 },

  init(canvas) {
    if (_plS.inited) return;
    _plS.inited = true;
    _plS.canvas = canvas;

    window.addEventListener('keydown', (e) => {
      if (_plInEditable(e)) return;
      const code = e.code;
      const isNav = code === 'Space' || code === 'ArrowUp' || code === 'ArrowDown' || code === 'ArrowLeft' || code === 'ArrowRight';
      if (isNav) e.preventDefault();
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (_plMoveKeys[code]) { _plKeys[code] = true; return; }
      if (e.repeat) return;
      let name = _plActionKeys[code];
      if (code === 'Escape') name = _plBlocking() ? 'closePanel' : 'back';
      if (name) Bus.emit('input:action', { name });
    });
    window.addEventListener('keyup', (e) => { delete _plKeys[e.code]; });
    window.addEventListener('blur', () => {
      for (const k in _plKeys) delete _plKeys[k];
      _plPointers.clear(); _plS.pinch = 0;
    });

    if (!canvas) return;
    canvas.style.touchAction = 'none';
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    const aim = (e) => {
      const m = typeof Machines !== 'undefined' ? Machines.active : null;
      if (!m || !m.aimAtScreen) return;
      const r = canvas.getBoundingClientRect();
      m.aimAtScreen(((e.clientX - r.left) / r.width) * 2 - 1, -(((e.clientY - r.top) / r.height) * 2 - 1));
    };
    canvas.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      _plPointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (_plPointers.size === 2) _plS.pinch = _plPinchDist();
      if (Game.mode === 'machine' && _plPointers.size === 1) aim(e);
    });
    canvas.addEventListener('pointermove', (e) => {
      const p = _plPointers.get(e.pointerId);
      if (!p) return;
      e.preventDefault();
      const dx = e.clientX - p.x, dy = e.clientY - p.y;
      p.x = e.clientX; p.y = e.clientY;
      if (Game.mode === 'machine') { if (_plPointers.size === 1) aim(e); return; }
      if (_plPointers.size >= 2) {
        const d = _plPinchDist();
        if (_plS.pinch > 0 && d > 0) CameraRig.zoomBy(_plS.pinch / d);
        _plS.pinch = d;
        return;
      }
      CameraRig.yaw -= dx * 0.0062;
      CameraRig.pitch = clamp(CameraRig.pitch + dy * 0.0048, 0.12, 1.25);
    });
    const up = (e) => {
      _plPointers.delete(e.pointerId);
      _plS.pinch = _plPointers.size >= 2 ? _plPinchDist() : 0;
      try { canvas.releasePointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    };
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      if (Game.mode === 'machine') return;
      CameraRig.zoomBy(Math.exp(clamp(e.deltaY, -300, 300) * 0.0011));
    }, { passive: false });
  },

  getMove() {
    if (_plBlocking()) { _plMove.x = 0; _plMove.y = 0; return _plMove; }
    let x = Input.virtual.x || 0, y = Input.virtual.y || 0;
    if (_plKeys.KeyD || _plKeys.ArrowRight) x += 1;
    if (_plKeys.KeyA || _plKeys.ArrowLeft) x -= 1;
    if (_plKeys.KeyW || _plKeys.ArrowUp) y += 1;
    if (_plKeys.KeyS || _plKeys.ArrowDown) y -= 1;
    const l = Math.hypot(x, y);
    if (l > 1) { x /= l; y /= l; }
    _plMove.x = x; _plMove.y = y;
    return _plMove;
  },
};
function _plPinchDist() {
  const a = Array.from(_plPointers.values());
  return a.length < 2 ? 0 : Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y);
}

/* =====================================================================
   Player
   ===================================================================== */
const Player = {
  group: null,
  pos: null,

  init() {
    const S = _plS;
    const group = new THREE.Group();
    group.name = 'player';
    this.group = group;
    this.pos = group.position;

    const skin = _plMat('#ffd0a6', 0.7), shirt = _plMat('#ff9f1c', 0.6), pants = _plMat('#3d5afe', 0.7);
    const shoe = _plMat('#ffffff', 0.5), cap = _plMat('#ff3d6e', 0.55), dark = _plMat('#241a3a', 0.4);
    const white = _plMat('#ffffff', 0.3), blush = _plMat('#ff8fa3', 0.8), belt = _plMat('#7a3b00', 0.6);

    // blob shadow
    const sh = new THREE.Mesh(new THREE.CircleGeometry(0.85, 24),
      new THREE.MeshBasicMaterial({ map: _plShadowTexture(), transparent: true, depthWrite: false }));
    sh.rotation.x = -Math.PI / 2; sh.position.y = 0.03; sh.renderOrder = 1;
    group.add(sh);

    const rig = new THREE.Group();
    rig.scale.setScalar(0.88);
    group.add(rig);
    S.rig = rig;

    const legGeo = _plRoundBox(0.3, 0.5, 0.32, 0.1), shoeGeo = _plRoundBox(0.34, 0.2, 0.5, 0.09);
    const mkLeg = (x) => {
      const p = new THREE.Group(); p.position.set(x, 0.72, 0);
      p.add(_plMesh(legGeo, pants, 0, -0.27, 0));
      p.add(_plMesh(shoeGeo, shoe, 0, -0.62, 0.07));
      rig.add(p); return p;
    };
    S.legL = mkLeg(0.2); S.legR = mkLeg(-0.2);

    const body = new THREE.Group(); body.position.y = 0.72; rig.add(body); S.body = body;
    body.add(_plMesh(_plRoundBox(0.84, 0.78, 0.5, 0.18), shirt, 0, 0.36, 0));
    body.add(_plMesh(_plRoundBox(0.86, 0.12, 0.52, 0.05), belt, 0, 0.04, 0));
    const badge = new THREE.Mesh(new THREE.CircleGeometry(0.15, 16), white);
    badge.position.set(0, 0.45, 0.255); body.add(badge);
    const star = new THREE.Mesh(new THREE.CircleGeometry(0.075, 5), cap);
    star.position.set(0, 0.45, 0.26); body.add(star);

    // head
    const head = new THREE.Group(); head.position.y = 0.8; body.add(head); S.head = head;
    head.add(_plMesh(_plRoundBox(0.8, 0.7, 0.72, 0.26), skin, 0, 0.36, 0));
    const eyeGeo = new THREE.SphereGeometry(0.075, 12, 10), hiGeo = new THREE.SphereGeometry(0.028, 8, 6);
    for (const sx of [-1, 1]) {
      const e = _plMesh(eyeGeo, dark, sx * 0.18, 0.38, 0.35); e.scale.set(1, 1.35, 0.5); head.add(e);
      const hl = _plMesh(hiGeo, white, sx * 0.18 + 0.025, 0.42, 0.38); head.add(hl);
      const ch = new THREE.Mesh(new THREE.CircleGeometry(0.07, 12), blush);
      ch.position.set(sx * 0.29, 0.25, 0.362); ch.scale.set(1.2, 0.8, 1); head.add(ch);
      head.add(_plMesh(new THREE.SphereGeometry(0.1, 10, 8), skin, sx * 0.41, 0.34, 0));
    }
    const smile = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.02, 6, 14, Math.PI), dark);
    smile.rotation.z = Math.PI; smile.position.set(0, 0.27, 0.362); head.add(smile);
    // cap
    const dome = _plMesh(new THREE.SphereGeometry(0.43, 20, 12, 0, TAU, 0, Math.PI / 2), cap, 0, 0.58, -0.01);
    dome.scale.set(1, 0.85, 0.98); head.add(dome);
    head.add(_plMesh(_plRoundBox(0.62, 0.06, 0.4, 0.03), cap, 0, 0.6, 0.45));
    const knob = _plMesh(new THREE.SphereGeometry(0.06, 8, 6), white, 0, 0.95, -0.01); head.add(knob);

    // arms
    const armGeo = _plRoundBox(0.24, 0.6, 0.26, 0.1), handGeo = new THREE.SphereGeometry(0.14, 12, 10);
    const mkArm = (x) => {
      const p = new THREE.Group(); p.position.set(x, 0.66, 0);
      p.add(_plMesh(armGeo, shirt, 0, -0.26, 0));
      p.add(_plMesh(handGeo, skin, 0, -0.6, 0));
      body.add(p); return p;
    };
    S.armL = mkArm(0.56); S.armR = mkArm(-0.56);

    S.hold = new THREE.Group(); S.hold.position.set(0, 0.5, 0.6); body.add(S.hold);

    // billboard
    S.bbCanvas = document.createElement('canvas'); S.bbCanvas.width = 360; S.bbCanvas.height = 112;
    S.bbTex = new THREE.CanvasTexture(S.bbCanvas);
    S.bbTex.colorSpace = THREE.SRGBColorSpace;
    S.billboard = new THREE.Sprite(new THREE.SpriteMaterial({ map: S.bbTex, transparent: true, depthTest: false, depthWrite: false }));
    S.billboard.scale.set(2.5, 0.78, 1); S.billboard.position.y = 2.65; S.billboard.renderOrder = 20;
    group.add(S.billboard);
    S.bbText = '';
    _plUpdateBillboard();

    group.position.set(ROOM.spawn.x, 0, ROOM.spawn.z);
    group.rotation.y = S.rotY = ROOM.spawn.rotY;
    Scene3D.scene.add(group);

    Bus.on('currency:changed', _plUpdateBillboard);
    Bus.on('equip:changed', () => Player.refreshPets());
    Bus.on('world:entered', () => {
      if (!group.parent) Scene3D.scene.add(group);
      Player.refreshPets();
    });
    Bus.on('train:rep', () => Player.playRep());
    this.refreshPets();
  },

  setPosition(x, z, rotY) {
    this.pos.set(x, 0, z);
    if (isNum(rotY)) { this.group.rotation.y = rotY; _plS.rotY = rotY; }
    _plS.vx = _plS.vz = 0; _plS.spd = 0;
    _plSnapPets();
  },
  getWorldPos(out) { return (out || new THREE.Vector3()).copy(this.pos); },
  getHeadWorldPos(out) { return (out || new THREE.Vector3()).set(this.pos.x, this.pos.y + 2.2, this.pos.z); },

  setTraining(on) {
    const S = _plS;
    S.training = !!on;
    if (!on) _plSetHeld(null);
    else _plSyncHeld();
  },

  playRep() {
    _plS.rep = 0;
    _plS.repHeld = _plS.training || Game.mode === 'train';
  },

  refreshPets() {
    const S = _plS;
    if (!this.group || !Game.player) return;
    const old = new Map();
    for (const p of S.pets) {
      old.set(p.uid, p);
      if (p.holder.parent) p.holder.parent.remove(p.holder);
      if (typeof AnimalFactory !== 'undefined') AnimalFactory.dispose(p.model);
    }
    S.pets = [];
    const gp = Game.player;
    const parent = Scene3D.scene;
    let i = 0;
    for (const uidv of gp.equipped || []) {
      const pet = (gp.pets || []).find((q) => q.uid === uidv);
      if (!pet) continue;
      const a = typeof ANIMAL_BY_ID !== 'undefined' ? ANIMAL_BY_ID[pet.id] : null;
      let model;
      try { model = AnimalFactory.build(pet.id, pet.variant || 'normal'); } catch (e) { console.error('[Player] pet build', e); continue; }
      model.scale.setScalar(2);
      const holder = new THREE.Group();
      holder.add(model);
      const flying = !!a && (a.body === 'bird' || a.body === 'bug' || a.body === 'fish' || (a.extras && a.extras.indexOf('wings') >= 0));
      let radius = 0.25;
      try { radius = AnimalFactory.radiusOf(pet.id) || 0.25; } catch (e) { /* ignore */ }
      const prev = old.get(pet.uid);
      const o = { uid: pet.uid, holder, model, flying, r: radius * 2, x: this.pos.x, z: this.pos.z, y: 0, vx: 0, vz: 0, rot: S.rotY, bob: i * 1.7, moving: false };
      if (prev) { o.x = prev.x; o.z = prev.z; o.y = prev.y; o.rot = prev.rot; }
      else { o.x += Math.sin(i * 2.1) * 0.8; o.z -= 0.9; }
      holder.position.set(o.x, o.y, o.z);
      parent.add(holder);
      S.pets.push(o);
      i++;
    }
    _plSnapPets(true);
  },

  update(dt, move) {
    const S = _plS;
    if (!this.group) return;
    dt = Math.min(Math.max(dt, 0), 0.1);
    if (dt <= 0) return;
    S.t += dt;
    const mode = Game.mode;
    const pos = this.pos;
    const px = pos.x, pz = pos.z;
    const m = move || _plMove;

    if (mode === 'train' || S.training) {
      const sp = ROOM.trainingSpot;
      pos.x = damp(pos.x, sp.x, 8, dt); pos.z = damp(pos.z, sp.z, 8, dt);
      S.vx = S.vz = 0;
      S.rotY = _plAngleDamp(S.rotY, sp.rotY, 10, dt);
    } else if (mode === 'machine') {
      S.vx = S.vz = 0;
      const ms = ROOM.stations.machine;
      S.rotY = _plAngleDamp(S.rotY, Math.atan2(ms.x - pos.x, ms.z - pos.z), 8, dt);
    } else {
      const yaw = CameraRig.yaw, sy = Math.sin(yaw), cy = Math.cos(yaw);
      const mx = m.x || 0, my = m.y || 0;
      const tx = (mx * cy - my * sy) * 7, tz = (-mx * sy - my * cy) * 7;
      const lam = (mx * mx + my * my) > 0.0004 ? 12 : 10;
      S.vx = damp(S.vx, tx, lam, dt); S.vz = damp(S.vz, tz, lam, dt);
      pos.x += S.vx * dt; pos.z += S.vz * dt;
      _plCollide(pos);
      if (S.vx * S.vx + S.vz * S.vz > 1.0) S.rotY = _plAngleDamp(S.rotY, Math.atan2(S.vx, S.vz), 14, dt);
    }
    pos.y = 0;
    this.group.rotation.y = S.rotY;
    S.spd = Math.hypot(pos.x - px, pos.z - pz) / dt;

    if (S.training) _plSyncHeld();
    _plPose(dt);
    _plUpdatePets(dt);
  },
};

/* ---------- held equipment ---------- */
function _plSetHeld(model) {
  const S = _plS;
  if (S.heldModel) S.hold.remove(S.heldModel);
  S.heldModel = model || null;
  if (model) S.hold.add(model);
  if (!model) S.heldId = null;
}
function _plSyncHeld() {
  const S = _plS;
  const sel = Game.player && Game.player.training ? Game.player.training.selected : null;
  if (!sel || sel === S.heldId) return;
  const eq = typeof EQUIPMENT_BY_ID !== 'undefined' ? EQUIPMENT_BY_ID[sel] : null;
  if (!eq) return;
  let model = null;
  try { model = Scene3D.buildEquipmentModel(eq.model, eq.color); } catch (e) { console.error('[Player] equip model', e); }
  _plSetHeld(model);
  S.heldId = sel;
}

/* ---------- pose / animation ---------- */
function _plPose(dt) {
  const S = _plS;
  const holding = S.training && !!S.heldModel;
  S.holdW = damp(S.holdW, holding ? 1 : 0, 9, dt);
  const sp = clamp(S.spd / 7, 0, 1.3);
  S.phase += dt * (3 + sp * 9);
  const sw = Math.sin(S.phase) * sp;
  const breathe = Math.sin(S.t * 2.2);

  // rep animation (0.35 s): crouch -> push up -> settle
  let L = 0, crouch = 0;
  if (S.rep >= 0) {
    S.rep += dt;
    const k = S.rep / 0.35;
    if (k >= 1) S.rep = -1;
    else { L = Math.pow(Math.sin(Math.PI * k), 0.8); crouch = k < 0.28 ? Math.sin(Math.PI * k / 0.28) : 0; }
  }
  const w = S.repHeld ? 1 : 0.5;
  const sy = 1 - 0.14 * crouch * w + 0.1 * L * w + breathe * 0.012;
  const sxz = 1 + 0.08 * crouch * w - 0.05 * L * w - breathe * 0.006;
  S.body.scale.set(sxz, sy, sxz);
  S.body.position.y = 0.72 - 0.1 * crouch * w + Math.abs(Math.sin(S.phase)) * 0.07 * sp + 0.06 * L * w;
  S.body.rotation.z = Math.sin(S.phase) * 0.06 * sp;
  S.body.rotation.x = 0.1 * sp - 0.08 * crouch * w;
  S.head.rotation.x = -0.04 * sp + breathe * 0.015;

  S.legL.rotation.x = sw * 0.9 - 0.3 * crouch * w;
  S.legR.rotation.x = -sw * 0.9 - 0.3 * crouch * w;

  const idle = breathe * 0.04;
  const walkA = -sw * 0.95 + idle, walkB = sw * 0.95 + idle;
  const holdA = -1.25 + S.holdW * 0;
  const rep = L * (S.repHeld ? -1.6 : -2.4);
  const hw = S.holdW;
  const aL = lerp(walkA, holdA, hw) + rep, aR = lerp(walkB, holdA, hw) + rep;
  S.armL.rotation.x = aL; S.armR.rotation.x = aR;
  S.armL.rotation.z = 0.1 - 0.12 * hw; S.armR.rotation.z = -0.1 + 0.12 * hw;

  if (S.heldModel) {
    // keep the item between the hands
    const a = S.armR.rotation.x, len = 0.74;
    S.hold.position.set(0, S.armR.position.y - len * Math.cos(a), -len * Math.sin(a) + 0.02);
    S.hold.rotation.x = 0;
    const sc = hw;
    S.hold.scale.setScalar(Math.max(0.001, sc));
  }
}

/* ---------- collisions ---------- */
function _plCollide(pos) {
  const R = 0.45;
  const bx = ROOM.halfX - 0.6, bz = ROOM.halfZ - 0.6;
  const cols = (typeof Scene3D !== 'undefined' && Scene3D.colliders) || [];
  for (let it = 0; it < 2; it++) {
    for (let i = 0; i < cols.length; i++) {
      const c = cols[i];
      if (c.type === 'circle') {
        const dx = pos.x - c.x, dz = pos.z - c.z, min = c.r + R;
        const d2 = dx * dx + dz * dz;
        if (d2 < min * min) {
          const d = Math.sqrt(d2);
          if (d < 1e-5) { pos.x = c.x + min; } else { pos.x = c.x + dx / d * min; pos.z = c.z + dz / d * min; }
        }
      } else if (c.type === 'box') {
        const qx = clamp(pos.x, c.minX, c.maxX), qz = clamp(pos.z, c.minZ, c.maxZ);
        const dx = pos.x - qx, dz = pos.z - qz, d2 = dx * dx + dz * dz;
        if (d2 < R * R) {
          if (d2 > 1e-8) { const d = Math.sqrt(d2); pos.x = qx + dx / d * R; pos.z = qz + dz / d * R; }
          else {
            // centre inside the box: leave through the nearest side
            const l = pos.x - c.minX, r = c.maxX - pos.x, f = pos.z - c.minZ, b = c.maxZ - pos.z;
            const mn = Math.min(l, r, f, b);
            if (mn === l) pos.x = c.minX - R; else if (mn === r) pos.x = c.maxX + R;
            else if (mn === f) pos.z = c.minZ - R; else pos.z = c.maxZ + R;
          }
        }
      }
    }
    pos.x = clamp(pos.x, -bx, bx); pos.z = clamp(pos.z, -bz, bz);
  }
}

/* ---------- pets ---------- */
function _plSlot(i, n, out) {
  const S = _plS, pos = Player.pos, ry = S.rotY;
  const fx = Math.sin(ry), fz = Math.cos(ry);
  if (Game.mode !== 'walk') {
    // sit beside the player (alternating sides)
    const side = i % 2 === 0 ? 1 : -1, k = Math.floor(i / 2);
    const rx = Math.cos(ry), rz = -Math.sin(ry);
    const d = 1.55 + k * 1.2;
    out.x = pos.x + rx * d * side - fx * (0.3 + k * 0.3);
    out.z = pos.z + rz * d * side - fz * (0.3 + k * 0.3);
    return;
  }
  const perRow = 5, row = Math.floor(i / perRow);
  const inRow = Math.min(perRow, n - row * perRow), idx = i - row * perRow;
  const moving = S.spd > 1;
  const R = (moving ? 2.3 : 1.9) + row * 1.3;
  const th = (idx - (inRow - 1) / 2) * (1.2 / R);
  const bx = -fx, bz = -fz, c = Math.cos(th), s = Math.sin(th);
  out.x = pos.x + (bx * c + bz * s) * R;
  out.z = pos.z + (-bx * s + bz * c) * R;
}
const _plTmpSlot = { x: 0, z: 0 };
function _plSnapPets() {
  const S = _plS, n = S.pets.length;
  for (let i = 0; i < n; i++) {
    const p = S.pets[i];
    _plSlot(i, n, _plTmpSlot);
    if (arguments[0] === true && (Math.hypot(p.x - _plTmpSlot.x, p.z - _plTmpSlot.z) < 12) && p.keep !== false) continue;
    p.x = _plTmpSlot.x; p.z = _plTmpSlot.z; p.vx = p.vz = 0;
    p.holder.position.set(p.x, p.y, p.z);
  }
}
function _plUpdatePets(dt) {
  const S = _plS, pets = S.pets, n = pets.length;
  if (!n) return;
  S.petT += dt;
  const pos = Player.pos;
  const bx = ROOM.halfX - 0.5, bz = ROOM.halfZ - 0.5;
  const walk = Game.mode === 'walk';
  for (let i = 0; i < n; i++) {
    const p = pets[i];
    _plSlot(i, n, _plTmpSlot);
    const ox = p.x, oz = p.z;
    const dist = Math.hypot(_plTmpSlot.x - p.x, _plTmpSlot.z - p.z);
    if (dist > 14) { p.x = _plTmpSlot.x; p.z = _plTmpSlot.z; }
    const lam = walk ? (dist > 3 ? 6.5 : 4.2) : 3.2;
    p.x = damp(p.x, _plTmpSlot.x, lam, dt); p.z = damp(p.z, _plTmpSlot.z, lam, dt);
    // keep apart from each other
    for (let j = 0; j < n; j++) {
      if (j === i) continue;
      const q = pets[j];
      const dx = p.x - q.x, dz = p.z - q.z, min = (p.r + q.r) * 0.9 + 0.25;
      const d2 = dx * dx + dz * dz;
      if (d2 < min * min) {
        const d = Math.sqrt(d2) || 0.001, push = (min - d) * 0.5;
        const ux = d < 0.002 ? Math.cos(i * 2.4) : dx / d, uz = d < 0.002 ? Math.sin(i * 2.4) : dz / d;
        p.x += ux * push; p.z += uz * push;
      }
    }
    // and from the player
    {
      const dx = p.x - pos.x, dz = p.z - pos.z, min = p.r + 0.7;
      const d2 = dx * dx + dz * dz;
      if (d2 < min * min) { const d = Math.sqrt(d2) || 0.001; p.x = pos.x + dx / d * min; p.z = pos.z + dz / d * min; }
    }
    p.x = clamp(p.x, -bx, bx); p.z = clamp(p.z, -bz, bz);
    p.vx = (p.x - ox) / dt; p.vz = (p.z - oz) / dt;
    const spd = Math.hypot(p.vx, p.vz);
    p.moving = spd > 0.6;
    if (p.moving) p.rot = _plAngleDamp(p.rot, Math.atan2(p.vx, p.vz), 10, dt);
    else p.rot = _plAngleDamp(p.rot, walk ? S.rotY : S.rotY, 6, dt);
    const hy = p.flying ? 0.8 + Math.sin(S.petT * 3 + p.bob) * 0.07 : 0;
    p.y = damp(p.y, hy, 5, dt);
    p.holder.position.set(p.x, p.y, p.z);
    p.holder.rotation.y = p.rot;
    p.model.userData.moving = p.moving;
    try { AnimalFactory.animate(p.model, S.petT + p.bob, p.moving ? 'follow' : 'idle', dt); } catch (e) { /* ignore */ }
  }
}

/* =====================================================================
   CameraRig
   ===================================================================== */
const CameraRig = {
  mode: 'follow',
  yaw: 0, pitch: 0.5, distance: 11,

  init() {
    const S = _plS;
    S.camPos = new THREE.Vector3(); S.camLook = new THREE.Vector3();
    S.wantPos = new THREE.Vector3(); S.wantLook = new THREE.Vector3();
    S.views = {
      follow: { yaw: 0, pitch: 0.5, distance: 11, min: 6, max: 17 },
      train: { yaw: 0.85, pitch: 0.3, distance: 5.8, min: 3.5, max: 9 },
    };
    this.mode = S.camMode = 'follow';
    this.yaw = 0; this.pitch = 0.5; this.distance = 11;
    S.camInit = false; S.trans = 0;
  },

  zoomBy(f) {
    const v = _plS.views && (_plS.views[this.mode] || _plS.views.follow);
    if (!v) return;
    this.distance = clamp(this.distance * f, v.min, v.max);
  },

  setMode(mode) {
    const S = _plS;
    if (mode === this.mode) return;
    const cur = S.views[this.mode];
    if (cur) { cur.yaw = this.yaw; cur.pitch = this.pitch; cur.distance = this.distance; }
    this.mode = S.camMode = mode;
    const nv = S.views[mode];
    if (nv) { this.yaw = nv.yaw; this.pitch = nv.pitch; this.distance = nv.distance; }
    S.trans = 0.6;
  },

  update(dt) {
    const S = _plS;
    if (!S.camPos) return;
    dt = Math.min(Math.max(dt, 0), 0.1);
    const cam = Scene3D.camera;
    const cv = Scene3D.renderer && Scene3D.renderer.domElement;
    const aspect = cv && cv.clientHeight > 0 ? cv.clientWidth / cv.clientHeight : cam.aspect || 1.6;
    const portrait = clamp(1 - aspect, 0, 0.7);
    const fov = 55 + portrait * 26;
    if (Math.abs(cam.fov - fov) > 0.05) { cam.fov = fov; cam.updateProjectionMatrix(); }

    const mode = this.mode;
    const P = Player.pos, wp = S.wantPos, wl = S.wantLook;
    let view = null;
    if (mode === 'machine' && typeof Machines !== 'undefined' && Machines.active && Machines.active.getCameraView) {
      try { view = Machines.active.getCameraView(); } catch (e) { view = null; }
    }
    if (view) {
      wp.copy(view.pos); wl.copy(view.target);
    } else {
      const train = mode === 'train';
      const pf = train ? 1 + portrait * 0.5 : 1 + portrait * 0.9;
      const d = this.distance * pf;
      const cp = Math.cos(this.pitch);
      wl.set(P.x, train ? 1.4 : 1.6, P.z);
      wp.set(wl.x + Math.sin(this.yaw) * cp * d, wl.y + Math.sin(this.pitch) * d, wl.z + Math.cos(this.yaw) * cp * d);
      wp.x = clamp(wp.x, -(ROOM.halfX - 0.4), ROOM.halfX - 0.4);
      wp.z = Math.max(wp.z, -ROOM.halfZ + 0.4);
      wp.y = Math.max(wp.y, 1.5);
    }

    if (!S.camInit) {
      S.camPos.copy(wp); S.camLook.copy(wl); S.camInit = true;
    } else {
      let lam = mode === 'follow' ? 12 : 9;
      if (S.trans > 0) { S.trans -= dt; lam = 4.8; }
      const k = 1 - Math.exp(-lam * dt);
      S.camPos.lerp(wp, k); S.camLook.lerp(wl, k);
    }
    cam.position.copy(S.camPos);
    if (typeof FX !== 'undefined' && FX && FX.shakeOffset) cam.position.add(FX.shakeOffset);
    cam.lookAt(S.camLook);
  },
};

/* =====================================================================
   Interact
   ===================================================================== */
const Interact = {
  current: null,

  init() {
    this.current = null; _plS.curKey = null;
  },

  update() {
    let best = null;
    if (Game.mode === 'walk' && Player.pos) {
      let bd = Infinity;
      const px = Player.pos.x, pz = Player.pos.z;
      for (const k in ROOM.stations) {
        const s = ROOM.stations[k];
        const d = Math.hypot(px - s.ix, pz - s.iz);
        if (d <= s.radius && d < bd) { bd = d; best = s; }
      }
    }
    const key = best ? best.key : null;
    if (key !== this.current) {
      this.current = key;
      Bus.emit('interact:prompt', { key, label: best ? best.label : '' });
    }
  },

  use() {
    if (this.current) Bus.emit('station:use', { key: this.current });
  },
};
