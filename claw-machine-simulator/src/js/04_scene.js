/* =====================================================================
   04_scene.js — 3D world: renderer, lights, themed room, stations, decor
   Public: Scene3D.  Private helpers: _sc*.  No side effects at load time.
   ===================================================================== */

/* ---------- tiny helpers ---------- */
function _scRng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function _scMix(a, b, t) { return new THREE.Color(a).lerp(new THREE.Color(b), t); }
/** f < 1 darkens, f > 1 lightens (towards white). */
function _scShade(c, f) { return f <= 1 ? _scMix(c, '#000000', 1 - f) : _scMix(c, '#ffffff', Math.min(1, f - 1)); }
function _scL2W(st, lx, lz) {
  const c = Math.cos(st.rotY), s = Math.sin(st.rotY);
  return { x: st.x + lx * c + lz * s, z: st.z - lx * s + lz * c };
}
function _scColBox(cx, cz, rot, hw, hd) {
  const c = Math.cos(rot), s = Math.sin(rot);
  let a = 1e9, b = -1e9, d = 1e9, e = -1e9;
  for (const [lx, lz] of [[-hw, -hd], [hw, -hd], [-hw, hd], [hw, hd]]) {
    const x = cx + lx * c + lz * s, z = cz - lx * s + lz * c;
    a = Math.min(a, x); b = Math.max(b, x); d = Math.min(d, z); e = Math.max(e, z);
  }
  Scene3D.colliders.push({ type: 'box', minX: a, maxX: b, minZ: d, maxZ: e });
}
function _scColCircle(x, z, r) { Scene3D.colliders.push({ type: 'circle', x, z, r }); }

function _scCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function _scTex(canvas) {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (_sc.room) _sc.room.tex.push(t);
  return t;
}
function _scRoundRect(g, x, y, w, h, r) {
  g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}
const _scFont = "'Fredoka One','Baloo 2','Fredoka',system-ui,'Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji',sans-serif";
function _scFitText(g, text, maxW, size, weight = '900') {
  let s = size;
  for (; s > 12; s -= 2) { g.font = `${weight} ${s}px ${_scFont}`; if (g.measureText(text).width <= maxW) break; }
  return s;
}
/** Draws a neon-framed sign into a canvas. */
function _scDrawSign(cv, text, o) {
  const g = cv.getContext('2d'), w = cv.width, h = cv.height;
  g.clearRect(0, 0, w, h);
  const bg = o.bg || '#141a33', fg = o.fg || '#ffffff', ac = o.accent || '#ffd23f';
  _scRoundRect(g, 6, 6, w - 12, h - 12, h * 0.22);
  const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, _scShade(bg, 1.25).getStyle()); gr.addColorStop(1, bg);
  g.fillStyle = gr; g.fill();
  g.lineWidth = Math.max(5, h * 0.06); g.strokeStyle = ac; g.shadowColor = ac; g.shadowBlur = h * 0.1; g.stroke(); g.shadowBlur = 0;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  const lines = Array.isArray(text) ? text : [text];
  const lh = (h - 24) / lines.length;
  lines.forEach((ln, i) => {
    const sz = _scFitText(g, ln, w * 0.86, Math.min(lh * 0.82, o.size || 999));
    const y = 12 + lh * (i + 0.5) + sz * 0.04;
    g.lineJoin = 'round'; g.lineWidth = sz * 0.16; g.strokeStyle = 'rgba(0,0,0,.55)'; g.strokeText(ln, w / 2, y);
    g.fillStyle = i === 0 ? fg : _scShade(fg, 0.85).getStyle(); g.shadowColor = ac; g.shadowBlur = sz * 0.18; g.fillText(ln, w / 2, y); g.shadowBlur = 0;
  });
}
function _scSign(text, w, h, x, y, z, ry, o = {}) {
  const px = o.px || 512;
  const cv = _scCanvas(px, Math.round(px * h / w));
  _scDrawSign(cv, text, o);
  const tex = _scTex(cv);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, transparent: true, fog: false, toneMapped: false }));
  m.position.set(x, y, z); m.rotation.y = ry;
  m.userData.cv = cv;
  _sc.room.group.add(m);
  return m;
}
function _scLabel(text, accent, w = 2.6) {
  const cv = _scCanvas(512, 128), g = cv.getContext('2d');
  _scRoundRect(g, 8, 10, 496, 108, 54); g.fillStyle = 'rgba(14,16,40,.78)'; g.fill();
  g.lineWidth = 8; g.strokeStyle = accent; g.stroke();
  g.textAlign = 'center'; g.textBaseline = 'middle';
  const sz = _scFitText(g, text, 430, 66);
  g.lineJoin = 'round'; g.lineWidth = sz * 0.14; g.strokeStyle = 'rgba(0,0,0,.6)'; g.strokeText(text, 256, 66);
  g.fillStyle = '#fff'; g.fillText(text, 256, 66);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: _scTex(cv), transparent: true, depthWrite: false, fog: false }));
  sp.scale.set(w, w * 0.25, 1);
  return sp;
}

/* ---------- geometry batch (everything static is baked into 1-3 meshes) ---------- */
class _scBatch {
  constructor() { this.p = []; this.n = []; this.c = []; }
  get count() { return this.p.length; }
}
class _scSet {
  constructor() {
    this.L = new _scBatch(); this.E = new _scBatch(); this.G = new _scBatch();
    this.base = new THREE.Matrix4(); this._m = new THREE.Matrix4(); this._nm = new THREE.Matrix3();
    this._q = new THREE.Quaternion(); this._e = new THREE.Euler(); this._v = new THREE.Vector3(); this._v2 = new THREE.Vector3();
    this._s = new THREE.Vector3(); this._c = new THREE.Color(); this._up = new THREE.Vector3(0, 1, 0);
  }
  setBase(x = 0, y = 0, z = 0, ry = 0, s = 1) {
    this.base.compose(this._v.set(x, y, z), this._q.setFromAxisAngle(this._up, ry), this._s.set(s, s, s));
    return this;
  }
  wall(side, along = 0, y = 0) {
    if (side === 'back') this.setBase(along, y, -ROOM.halfZ, 0);
    else if (side === 'left') this.setBase(-ROOM.halfX, y, along, Math.PI / 2);
    else this.setBase(ROOM.halfX, y, along, -Math.PI / 2);
    return this;
  }
  /** bake geometry g (consumed) at local pos (x,y,z). o: rx ry rz order sx sy sz e(mission) glow */
  geo(g, x, y, z, color, o = {}) {
    const B = o.glow ? this.G : o.e ? this.E : this.L;
    const m = this._m;
    this._e.set(o.rx || 0, o.ry || 0, o.rz || 0, o.order || 'XYZ');
    m.compose(this._v.set(x, y, z), this._q.setFromEuler(this._e), this._s.set(o.sx ?? 1, o.sy ?? 1, o.sz ?? 1));
    m.premultiply(this.base);
    this._nm.getNormalMatrix(m);
    const ng = g.index ? g.toNonIndexed() : g;
    const pos = ng.attributes.position, nor = ng.attributes.normal;
    const col = this._c.set(color), v = this._v, v2 = this._v2;
    const colf = o.cf;   // optional per-vertex colour function(y01) -> factor
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(m);
      B.p.push(v.x, v.y, v.z);
      v2.fromBufferAttribute(nor, i).applyMatrix3(this._nm).normalize();
      B.n.push(v2.x, v2.y, v2.z);
      const f = colf ? colf(pos, i) : 1;
      B.c.push(col.r * f, col.g * f, col.b * f);
    }
    if (ng !== g) ng.dispose();
    g.dispose();
  }
  box(x, y, z, w, h, d, c, o) { this.geo(new THREE.BoxGeometry(w, h, d), x, y, z, c, o); }
  cyl(x, y, z, rt, rb, h, c, o = {}) { this.geo(new THREE.CylinderGeometry(rt, rb, h, o.seg || 12), x, y, z, c, o); }
  cone(x, y, z, r, h, c, o = {}) { this.geo(new THREE.ConeGeometry(r, h, o.seg || 8), x, y, z, c, o); }
  sph(x, y, z, r, c, o = {}) { this.geo(new THREE.SphereGeometry(r, o.seg || 12, o.segH || 8), x, y, z, c, o); }
  ico(x, y, z, r, c, o = {}) { this.geo(new THREE.IcosahedronGeometry(r, o.detail || 0), x, y, z, c, o); }
  tor(x, y, z, R, r, c, o = {}) { this.geo(new THREE.TorusGeometry(R, r, o.segR || 8, o.seg || 24, o.arc || TAU), x, y, z, c, o); }
  /** Floor quad (y = height), normal up. */
  quad(x, y, z, w, d, c) {
    const B = this.L, m = this.base, v = this._v, col = this._c.set(c);
    const hw = w / 2, hd = d / 2;
    const pts = [[-hw, -hd], [-hw, hd], [hw, hd], [-hw, -hd], [hw, hd], [hw, -hd]];
    for (const [px, pz] of pts) {
      v.set(x + px, y, z + pz).applyMatrix4(m);
      B.p.push(v.x, v.y, v.z); B.n.push(0, 1, 0); B.c.push(col.r, col.g, col.b);
    }
  }
  /** Additive soft disc (bright centre -> black rim) lying on the floor. */
  pool(x, y, z, r, c, k = 1) {
    this.geo(new THREE.CircleGeometry(r, 28), x, y, z, c, {
      rx: -Math.PI / 2, glow: true,
      cf: (pos, i) => { const d = Math.hypot(pos.getX(i), pos.getY(i)) / r; return k * (1 - d) * (1 - d); },
    });
  }
  /** Soft additive beam (cone, bright at the apex end -> faint at the floor). */
  beam(x, y0, y1, z, r, c, k = 0.1) {
    const top = Math.max(y0, y1), bot = Math.min(y0, y1), h = top - bot;
    this.geo(new THREE.CylinderGeometry(0.15, r, h, 24, 1, true), x, bot + h / 2, z, c, {
      glow: true, cf: (pos, i) => k * (0.3 + 0.7 * (pos.getY(i) / h + 0.5)),
    });
  }
  /** Flat shape extruded (stars etc.), faces +Z. */
  shape(x, y, z, shp, depth, c, o) {
    const g = new THREE.ExtrudeGeometry(shp, { depth, bevelEnabled: false });
    g.translate(0, 0, -depth / 2);
    this.geo(g, x, y, z, c, o);
  }
  toGroup(shadows = true) {
    const grp = new THREE.Group();
    for (const [B, key] of [[this.L, 'lit'], [this.E, 'emi'], [this.G, 'glow']]) {
      if (!B.count) continue;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(B.p, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(B.n, 3));
      g.setAttribute('color', new THREE.Float32BufferAttribute(B.c, 3));
      g.computeBoundingSphere();
      const mesh = new THREE.Mesh(g, _sc.mats[key]);
      if (key === 'lit') { mesh.castShadow = shadows; mesh.receiveShadow = shadows; }
      if (key === 'glow') mesh.renderOrder = 2;
      mesh.userData.batch = key;
      grp.add(mesh);
    }
    return grp;
  }
}

function _scStarShape(r1, r2, n = 5) {
  const s = new THREE.Shape();
  for (let i = 0; i < n * 2; i++) {
    const a = (i / (n * 2)) * TAU + Math.PI / 2, r = i % 2 ? r2 : r1;
    if (i) s.lineTo(Math.cos(a) * r, Math.sin(a) * r); else s.moveTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  s.closePath();
  return s;
}
function _scHeartShape(sc) {
  const s = new THREE.Shape();
  s.moveTo(0, -0.7 * sc); s.bezierCurveTo(-1.3 * sc, 0.1 * sc, -0.7 * sc, 1 * sc, 0, 0.45 * sc);
  s.bezierCurveTo(0.7 * sc, 1 * sc, 1.3 * sc, 0.1 * sc, 0, -0.7 * sc);
  return s;
}

/* ---------- equipment models (baked into a set at the current base) ---------- */
function _scEquipInto(S, model, color) {
  const col = new THREE.Color(color || '#888888');
  const dark = _scShade(col, 0.55), light = _scShade(col, 1.3), metal = new THREE.Color('#9aa3b2'), steel = new THREE.Color('#5b6474');
  switch (model) {
    case 'dumbbell':
      S.cyl(0, 0, 0, 0.04, 0.04, 0.5, steel, { rz: Math.PI / 2, seg: 8 });
      for (const sx of [-1, 1]) {
        S.cyl(sx * 0.2, 0, 0, 0.15, 0.15, 0.1, col, { rz: Math.PI / 2, seg: 6 });
        S.cyl(sx * 0.29, 0, 0, 0.1, 0.1, 0.08, dark, { rz: Math.PI / 2, seg: 6 });
      }
      break;
    case 'kettlebell':
      S.sph(0, -0.05, 0, 0.22, col, { sy: 0.92 });
      S.cyl(0, -0.26, 0, 0.14, 0.15, 0.04, dark);
      S.tor(0, 0.17, 0, 0.12, 0.04, steel, { seg: 14 });
      S.sph(-0.07, 0.04, 0.17, 0.05, light, { seg: 6, segH: 4 });
      break;
    case 'barbell':
      S.cyl(0, 0, 0, 0.03, 0.03, 0.78, metal, { rz: Math.PI / 2, seg: 8 });
      for (const sx of [-1, 1]) {
        S.cyl(sx * 0.2, 0, 0, 0.23, 0.23, 0.05, col, { rz: Math.PI / 2, seg: 14 });
        S.cyl(sx * 0.26, 0, 0, 0.17, 0.17, 0.05, light, { rz: Math.PI / 2, seg: 14 });
        S.cyl(sx * 0.31, 0, 0, 0.06, 0.06, 0.05, steel, { rz: Math.PI / 2, seg: 8 });
      }
      break;
    case 'log':
      S.cyl(0, 0, 0, 0.17, 0.17, 0.62, col, { rz: Math.PI / 2, seg: 10 });
      for (const sx of [-1, 1]) S.cyl(sx * 0.311, 0, 0, 0.15, 0.15, 0.02, '#e9c98f', { rz: Math.PI / 2, seg: 10 });
      S.cyl(0, 0, 0, 0.178, 0.178, 0.08, dark, { rz: Math.PI / 2, seg: 10 });
      S.cyl(0.16, 0, 0, 0.178, 0.178, 0.06, dark, { rz: Math.PI / 2, seg: 10 });
      S.cyl(-0.16, 0, 0, 0.178, 0.178, 0.06, dark, { rz: Math.PI / 2, seg: 10 });
      break;
    case 'iceblock':
      S.box(0, 0, 0, 0.44, 0.4, 0.44, col, { ry: 0.5 });
      S.box(0.1, 0.22, 0.04, 0.26, 0.14, 0.26, light, { ry: 0.9 });
      S.box(0, 0, 0, 0.3, 0.5, 0.3, _scShade(col, 1.15), { ry: 0.2, rz: 0.15 });
      break;
    case 'boulder':
      S.ico(0, 0, 0, 0.3, col, { detail: 0, sy: 0.85 });
      S.ico(0.22, -0.12, 0.1, 0.16, dark, { detail: 0 });
      S.ico(-0.08, 0.2, 0.0, 0.1, light, { detail: 0 });
      break;
    case 'anvil':
      S.box(0, -0.2, 0, 0.34, 0.14, 0.26, steel);
      S.box(0, -0.08, 0, 0.2, 0.14, 0.18, dark);
      S.box(0, 0.08, 0, 0.5, 0.18, 0.28, col);
      S.cone(0.34, 0.08, 0, 0.14, 0.2, col, { rz: -Math.PI / 2, seg: 4 });
      S.box(0, 0.19, 0, 0.5, 0.03, 0.24, light);
      break;
    case 'meteor':
      S.ico(0, 0, 0, 0.3, '#3a2d33', { detail: 0 });
      S.ico(0, 0, 0, 0.21, col, { detail: 0, e: true });
      for (const [px, py, pz] of [[0.22, 0.14, 0.12], [-0.2, 0.1, 0.2], [0.05, -0.22, 0.2], [-0.14, 0.22, -0.14], [0.12, -0.05, -0.27]])
        S.ico(px, py, pz, 0.09, _scShade(col, 1.25), { detail: 0, e: true });
      break;
    default:
      S.sph(0, 0, 0, 0.25, col);
  }
}

/* ---------- room shell: floor, walls, lip ---------- */
function _scFloor(S, th, R) {
  const A = new THREE.Color(th.floorA), Bc = new THREE.Color(th.floorB), kind = th.decor;
  const hx = ROOM.halfX, hz = ROOM.halfZ;
  S.setBase(0, 0, 0, 0);
  const jit = (c, a) => _scShade(c, 1 + (R() - 0.5) * a);
  if (kind === 'jungle') {
    S.quad(0, 0, 0, hx * 2, hz * 2, _scShade(A, 0.45));
    for (let i = 0; i < hx * 2 / 0.6; i++) {
      let z = -hz;
      const x = -hx + 0.3 + i * 0.6;
      while (z < hz - 0.05) {
        const len = Math.min(hz - z, 2 + R() * 3);
        S.quad(x, 0.004, z + len / 2, 0.54, len - 0.05, jit(_scMix(A, Bc, R()), 0.12));
        z += len;
      }
    }
  } else if (kind === 'space') {
    S.quad(0, 0, 0, hx * 2, hz * 2, _scShade(A, 0.55));
    for (let ix = 0; ix < hx; ix++) for (let iz = 0; iz < hz; iz++)
      S.quad(-hx + 1 + ix * 2, 0.004, -hz + 1 + iz * 2, 1.9, 1.9, jit((ix + iz) % 2 ? A : Bc, 0.1));
    const gl = _scShade(th.neon, 0.5);
    for (let x = -hx; x <= hx; x += 2) S.box(x, 0.012, 0, 0.06, 0.012, hz * 2, gl, { e: true });
    for (let z = -hz; z <= hz; z += 2) S.box(0, 0.012, z, hx * 2, 0.012, 0.06, gl, { e: true });
  } else if (kind === 'frozen') {
    S.quad(0, 0, 0, hx * 2, hz * 2, _scShade(Bc, 0.8));
    for (let ix = 0; ix < hx; ix++) for (let iz = 0; iz < hz; iz++) {
      let c = jit((ix + iz) % 2 ? A : Bc, 0.1);
      if (R() < 0.08) c = _scShade(c, 1.18);
      S.quad(-hx + 1 + ix * 2, 0.004, -hz + 1 + iz * 2, 1.92, 1.92, c);
    }
  } else if (kind === 'desert') {
    S.quad(0, 0, 0, hx * 2, hz * 2, _scShade(A, 0.7));
    for (let ix = 0; ix < hx / 0.75; ix++) for (let iz = 0; iz < hz / 0.75; iz++)
      S.quad(-hx + 0.75 + ix * 1.5, 0.004, -hz + 0.75 + iz * 1.5, 1.44, 1.44, jit(_scMix(A, Bc, (ix + iz) % 2 ? 0.8 : R() * 0.4), 0.1));
  } else {
    for (let ix = 0; ix < hx * 2; ix++) for (let iz = 0; iz < hz * 2; iz++)
      S.quad(-hx + 0.5 + ix, 0, -hz + 0.5 + iz, 1, 1, jit((ix + iz) % 2 ? A : Bc, 0.05));
  }
}

function _scWalls(S, th, R) {
  const H = ROOM.height, wall = new THREE.Color(th.wall), trim = new THREE.Color(th.wallTrim);
  const decor = th.decor;
  for (const [side, L] of [['back', ROOM.halfX * 2 + 0.8], ['left', ROOM.halfZ * 2], ['right', ROOM.halfZ * 2]]) {
    S.wall(side, 0);
    S.box(0, H / 2, -0.2, L, H, 0.4, wall);
    const panels = Math.round(L / 2.2);
    const pw = L / panels;
    for (let i = 0; i < panels; i++) {
      const px = -L / 2 + pw * (i + 0.5);
      S.box(px, 3.8, 0.02, pw - 0.12, H - 2.6, 0.05, _scShade(wall, i % 2 ? 0.93 : 1.07));
    }
    if (decor === 'jungle') {
      for (let i = 0; i < L / 0.5; i++) S.box(-L / 2 + 0.25 + i * 0.5, 0.75, 0.06, 0.46, 1.5, 0.1, _scShade(trim, 0.85 + R() * 0.3));
    } else {
      S.box(0, 0.7, 0.06, L, 1.4, 0.12, trim);
    }
    S.box(0, 1.46, 0.1, L, 0.12, 0.2, _scShade(trim, 1.25));
    S.box(0, 0.09, 0.12, L, 0.18, 0.24, _scShade(trim, 0.6));
    S.box(0, H - 0.12, 0.1, L, 0.24, 0.3, _scShade(trim, 0.8));
    for (let px = -L / 2 + 0.2; px <= L / 2; px += 5.5) S.box(px, H / 2, 0.1, 0.3, H, 0.22, _scShade(trim, 0.9));
    S.box(0, 5.15, 0.05, L - 0.8, 0.1, 0.06, th.neon, { e: true });
    S.box(0, 1.6, 0.1, L - 0.8, 0.045, 0.04, th.accent, { e: true });
    if (decor === 'space') {
      for (let px = -L / 2 + 2.2; px < L / 2; px += 2.2) S.box(px, 3.8, 0.06, 0.04, H - 2.6, 0.02, '#0b1020');
      if (Scene3D.preset.decor >= 1) for (let px = -L / 2 + 0.6; px < L / 2; px += 1.1) for (const y of [1.9, 5.5])
        S.cyl(px, y, 0.07, 0.05, 0.05, 0.04, '#d9e2f5', { rx: Math.PI / 2, seg: 6 });
    }
    if (decor === 'desert') {
      for (let y = 1.9; y < 5; y += 0.55) S.box(0, y, 0.05, L, 0.04, 0.03, _scShade(wall, 0.78));
    }
    if (decor === 'frozen') {
      for (let px = -L / 2 + 0.5; px < L / 2; px += 1.3 + R()) S.sph(px, H - 0.05, 0.22, 0.4 + R() * 0.45, '#ffffff', { sy: 0.45, seg: 8, segH: 5 });
    }
  }
  // low decorative lip along the open front edge
  S.setBase(0, 0, 0, 0);
  const fz = ROOM.halfZ + 0.15;
  S.box(0, 0.16, fz, ROOM.halfX * 2 + 0.8, 0.32, 0.5, trim);
  S.box(0, 0.34, fz, ROOM.halfX * 2 + 0.8, 0.05, 0.54, _scShade(trim, 1.3));
  S.box(0, 0.37, fz - 0.05, ROOM.halfX * 2, 0.04, 0.08, th.neon, { e: true });
  for (let x = -ROOM.halfX + 1; x <= ROOM.halfX - 0.5; x += 4.4) {
    S.cyl(x, 0.5, fz, 0.2, 0.24, 0.5, _scShade(trim, 0.85));
    S.sph(x, 0.86, fz, 0.2, th.accent, { e: true, seg: 10 });
  }
}

/* ---------- stations ---------- */
function _scBuildMachineSpot(S, th) {
  const st = ROOM.stations.machine, hw = MACHINE_DIMS.width / 2 + 0.15, hd = MACHINE_DIMS.depth / 2 + 0.15;
  S.setBase(st.x, 0, st.z, 0);
  S.box(0, 0.02, 0.1, 5.4, 0.04, 4.6, _scShade(th.accent, 0.55));
  S.box(0, 0.045, 0.1, 5.0, 0.02, 4.2, _scMix(th.accent, th.neon, 0.25));
  S.box(0, 0.06, 0.1, 4.5, 0.02, 3.7, _scShade(th.accent, 0.7));
  S.box(0, 0.07, 0.1, 5.1, 0.02, 0.06, th.neon, { e: true });
  S.box(0, 0.07, 0.1 + 2.1, 5.1, 0.02, 0.06, th.neon, { e: true });
  S.box(-2.55, 0.07, 0.1, 0.06, 0.02, 4.26, th.neon, { e: true });
  S.box(2.55, 0.07, 0.1, 0.06, 0.02, 4.26, th.neon, { e: true });
  S.box(0, 0.13, 0, 3.2, 0.14, 3.2, _scShade(th.wallTrim, 0.9));
  S.box(0, 0.21, 0, 3.0, 0.03, 3.0, _scShade(th.wallTrim, 1.2));
  for (const [x, z] of [[-1.6, -1.6], [1.6, -1.6], [-1.6, 1.6], [1.6, 1.6]]) S.sph(x, 0.24, z, 0.1, th.neon, { e: true, seg: 8, segH: 6 });
  S.pool(0, 0.3, 0.2, 3.4, '#ffe9b0', 0.16);
  S.beam(0, 6.2, 0.05, 0, 3.0, '#ffe9b0', 0.035);
  _scColBox(st.x, st.z, 0, hw, hd);
}

function _scBuildTraining(S, th, worldId, R) {
  const st = ROOM.stations.training, rubber = new THREE.Color('#2a2d3a');
  S.setBase(st.x, 0, st.z, st.rotY);
  S.box(0, 0.025, 1.2, 3.6, 0.05, 2.7, rubber);
  S.box(0, 0.052, 1.2, 3.3, 0.01, 2.4, _scShade(rubber, 1.25));
  for (const sx of [-1.7, 1.7]) S.box(sx, 0.06, 1.2, 0.07, 0.01, 2.5, th.accent, { e: true });
  S.box(0, 0.06, 2.45, 3.4, 0.01, 0.07, th.accent, { e: true });
  S.box(0, 0.06, -0.12, 3.4, 0.01, 0.07, th.accent, { e: true });
  S.cyl(0, 0.065, 1.2, 0.5, 0.5, 0.012, th.accent, { e: true, seg: 20 });
  S.cyl(0, 0.07, 1.2, 0.4, 0.4, 0.012, rubber, { seg: 20 });
  // rack
  const rz = -1.0, rw = 3.1;
  for (const sx of [-rw / 2, rw / 2]) {
    S.box(sx, 1.0, rz, 0.14, 2.0, 0.14, '#3c4560');
    S.box(sx, 0.05, rz, 0.34, 0.1, 0.7, '#2b3247');
  }
  S.box(0, 2.05, rz, rw + 0.2, 0.12, 0.2, th.accent);
  const wl = (typeof TRAINING_EQUIPMENT !== 'undefined' ? TRAINING_EQUIPMENT : []);
  let items = wl.filter((e) => e.world === worldId);
  if (!items.length) items = wl.slice(0, 6);
  items = items.slice(0, 6);
  const shelfY = [0.42, 0.95, 1.48];
  for (const y of shelfY) S.box(0, y, rz, rw, 0.06, 0.52, _scMix(th.wallTrim, '#a9794a', 0.55));
  items.forEach((it, i) => {
    const row = Math.floor(i / 2), col = i % 2;
    S.setBase(...(() => { const p = _scL2W(st, (col ? 0.75 : -0.75) - (items.length === 1 ? -0.75 : 0), rz); return [p.x, 0.03 + shelfY[row] + 0.27, p.z, st.rotY, 0.82]; })());
    _scEquipInto(S, it.model, it.color);
  });
  S.setBase(st.x, 0, st.z, st.rotY);
  // floor props beside the rack
  for (let i = 0; i < 4; i++) S.cyl(2.0, 0.08 + i * 0.1, rz + 0.1, 0.3 - i * 0.02, 0.3 - i * 0.02, 0.09, i % 2 ? th.accent : '#46506b', { seg: 14 });
  S.sph(-2.0, 0.28, rz + 0.1, 0.28, _scMix(th.neon, '#ffffff', 0.15), { seg: 14, segH: 10 });
  S.tor(-2.0, 0.28, rz + 0.1, 0.28, 0.025, '#fff', { seg: 20 });
  _scColBox(_scL2W(st, 0, rz).x, _scL2W(st, 0, rz).z, st.rotY, 1.85, 0.4);
  const c1 = _scL2W(st, 2.0, rz + 0.1), c2 = _scL2W(st, -2.0, rz + 0.1);
  _scColCircle(c1.x, c1.z, 0.35); _scColCircle(c2.x, c2.z, 0.33);
  S.pool(0, 0.08, 1.2, 2.3, th.accent, 0.07);
  // wall mirror
  S.wall('left', st.z);
  S.box(0, 2.15, 0.06, 3.6, 2.5, 0.1, '#2b3247');
  S.box(0, 2.15, 0.13, 3.3, 2.2, 0.03, '#a8def5');
  for (const [x, w] of [[-0.9, 0.28], [-0.35, 0.1], [0.6, 0.4]]) S.box(x, 2.15, 0.15, w, 3.0, 0.01, '#f3fcff', { e: true, rz: 0.55 });
  S.box(0, 3.45, 0.1, 3.6, 0.1, 0.12, th.neon, { e: true });
  S.box(0, 0.85, 0.1, 3.6, 0.1, 0.12, th.neon, { e: true });
}

function _scBuildKiosk(S, th) {
  const st = ROOM.stations.upgrades;
  S.setBase(st.x, 0, st.z, st.rotY);
  const body = _scMix(th.machineBody, '#ffffff', 0.05), trim = th.machineTrim;
  S.box(0, 0.06, 0, 2.1, 0.12, 1.4, '#2b3247');
  S.box(0, 0.65, 0, 1.7, 1.1, 0.95, body);
  S.box(0, 0.65, 0.49, 1.74, 0.22, 0.04, trim);
  S.box(0, 1.2, 0.15, 1.8, 0.1, 0.8, trim);
  S.box(0, 1.92, -0.12, 1.7, 1.5, 0.7, body, { rx: -0.25 });
  S.box(0, 1.95, -0.08, 1.82, 1.62, 0.5, _scShade(body, 0.75), { rx: -0.25 });
  S.box(0, 2.9, -0.28, 1.9, 0.34, 0.8, trim);
  S.box(0, 2.9, 0.1, 1.5, 0.2, 0.04, th.neon, { e: true });
  // arrow icon on top
  S.cone(0, 3.4, -0.25, 0.34, 0.5, th.neon, { e: true, seg: 4, ry: Math.PI / 4 });
  S.box(0, 3.1, -0.25, 0.2, 0.24, 0.2, th.neon, { e: true });
  // buttons / slot
  const cols = ['#ff5e7e', '#ffd23f', '#4de08a'];
  cols.forEach((c, i) => S.cyl(-0.45 + i * 0.45, 1.27, 0.35, 0.1, 0.1, 0.07, c, { e: true, seg: 12 }));
  S.box(0, 0.7, 0.5, 0.5, 0.14, 0.03, '#10131f');
  S.box(0, 0.7, 0.52, 0.42, 0.04, 0.01, th.neon, { e: true });
  S.pool(0, 0.08, 1.3, 1.9, th.neon, 0.12);
  _scColBox(st.x, st.z, st.rotY, 1.05, 0.7);
  // screen
  const cv = _scCanvas(512, 440), g = cv.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, 440); gr.addColorStop(0, '#16224d'); gr.addColorStop(1, '#0a1030');
  g.fillStyle = gr; g.fillRect(0, 0, 512, 440);
  g.strokeStyle = 'rgba(120,200,255,.12)'; g.lineWidth = 2;
  for (let i = 0; i < 512; i += 32) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 440); g.stroke(); }
  for (let i = 0; i < 440; i += 32) { g.beginPath(); g.moveTo(0, i); g.lineTo(512, i); g.stroke(); }
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = `900 78px ${_scFont}`; g.lineWidth = 12; g.lineJoin = 'round'; g.strokeStyle = '#0a1030';
  g.shadowColor = '#4de0ff'; g.shadowBlur = 24; g.fillStyle = '#ffffff';
  g.strokeText('UPGRADES', 256, 90); g.fillText('UPGRADES', 256, 90); g.shadowBlur = 0;
  for (let i = 0; i < 3; i++) {   // stacked arrows
    const y = 330 - i * 70, a = 0.45 + i * 0.28;
    g.fillStyle = `rgba(77,224,138,${a})`; g.shadowColor = '#4de08a'; g.shadowBlur = i * 8;
    g.beginPath(); g.moveTo(256, y - 50); g.lineTo(326, y + 6); g.lineTo(284, y + 6); g.lineTo(284, y + 26); g.lineTo(228, y + 26); g.lineTo(228, y + 6); g.lineTo(186, y + 6); g.closePath(); g.fill();
  }
  g.shadowBlur = 0;
  const tex = _scTex(cv);
  const mat = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.28), mat);
  const p = _scL2W(st, 0, 0.395);
  m.position.set(p.x, 1.95 + 0.11, p.z); m.rotation.set(-0.25, st.rotY, 0, 'YXZ');
  _sc.room.group.add(m);
  _sc.kioskMat = mat;
}

function _scBuildPets(S, th) {
  const st = ROOM.stations.pets;
  S.setBase(st.x, 0, st.z, st.rotY);
  const base = _scMix(th.wallTrim, th.accent, 0.35), top = _scShade(base, 1.25);
  S.box(0, 0.05, -0.1, 4.0, 0.1, 2.8, '#2b3247');
  // back tier + front tier
  S.box(0, 0.35, -0.55, 3.6, 0.7, 1.1, base);
  S.box(0, 0.705, -0.55, 3.64, 0.04, 1.14, top);
  S.box(0, 0.15, 0.55, 3.6, 0.3, 1.0, _scShade(base, 0.9));
  S.box(0, 0.305, 0.55, 3.64, 0.04, 1.04, top);
  S.box(0, 0.35, 0.0, 3.62, 0.04, 0.03, th.neon, { e: true });
  // back board with star + arch
  S.box(0, 1.55, -1.25, 4.0, 3.0, 0.2, _scShade(th.wallTrim, 0.7));
  S.box(0, 1.55, -1.13, 3.6, 2.6, 0.06, _scMix(th.wall, th.accent, 0.2));
  S.box(0, 2.95, -1.13, 3.9, 0.1, 0.1, th.neon, { e: true });
  S.shape(0, 2.05, -1.07, _scStarShape(0.5, 0.22), 0.06, th.accent, { e: true });
  S.shape(-1.3, 1.9, -1.07, _scHeartShape(0.3), 0.05, '#ff6b9a', { e: true });
  S.shape(1.3, 1.9, -1.07, _scHeartShape(0.3), 0.05, '#ff6b9a', { e: true });
  for (const sx of [-1.9, 1.9]) { S.box(sx, 1.5, -1.0, 0.16, 3.0, 0.2, th.accent); S.sph(sx, 3.05, -1.0, 0.14, th.neon, { e: true, seg: 8 }); }
  // spots: [back mid, back left, back right, front mid, front left, front right] (best first)
  const spots = [[0, 0.73, -0.55], [-1.15, 0.73, -0.55], [1.15, 0.73, -0.55], [0, 0.33, 0.55], [-1.15, 0.33, 0.55], [1.15, 0.33, 0.55]];
  _sc.petSpots = spots.map(([lx, y, lz]) => { const p = _scL2W(st, lx, lz); S.cyl(lx, y + 0.01, lz, 0.4, 0.42, 0.03, th.neon, { e: true, seg: 20 }); S.cyl(lx, y + 0.03, lz, 0.33, 0.33, 0.02, _scShade(top, 0.8), { seg: 20 }); return { x: p.x, y: y + 0.04, z: p.z }; });
  S.pool(0, 0.08, 0.3, 2.6, th.accent, 0.1);
  _scColBox(st.x, st.z, st.rotY, 2.05, 1.3);
  // faint "?" decals lying on the empty plinths (toggled by refreshPetDisplay)
  const cv = _scCanvas(128, 128), g = cv.getContext('2d');
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = `900 92px ${_scFont}`;
  g.shadowColor = th.neon; g.shadowBlur = 18; g.fillStyle = 'rgba(255,255,255,.9)';
  g.fillText('?', 64, 70); g.shadowBlur = 0;
  const qm = new THREE.MeshBasicMaterial({ map: _scTex(cv), transparent: true, opacity: 0.5, depthWrite: false, fog: false });
  const qg = new THREE.PlaneGeometry(0.46, 0.46);
  _sc.qMarks = _sc.petSpots.map((p) => {
    const m = new THREE.Mesh(qg, qm);
    m.position.set(p.x, p.y + 0.012, p.z); m.rotation.set(-Math.PI / 2, 0, st.rotY + Math.PI / 2 + Math.PI / 2, 'YXZ');
    m.rotation.set(-Math.PI / 2, 0, 0); m.rotateOnWorldAxis(new THREE.Vector3(0, 1, 0), st.rotY);
    _sc.room.group.add(m); return m;
  });
}

function _scNextWorld() {
  const un = (Game.player && Game.player.worlds && Game.player.worlds.unlocked) || ['starter'];
  if (typeof WORLDS === 'undefined') return null;
  const sorted = WORLDS.slice().sort((a, b) => a.order - b.order);
  for (const w of sorted) if (!un.includes(w.id)) return w;
  return null;
}

function _scBuildPortal(S, th) {
  const st = ROOM.stations.portal;
  const nxt = _scNextWorld();
  S.setBase(st.x, 0, st.z, st.rotY);
  S.box(0, 0.1, 0, 4.2, 0.2, 1.5, _scShade(th.wallTrim, 0.8));
  S.box(0, 0.23, 0, 3.8, 0.06, 1.3, _scShade(th.wallTrim, 1.2));
  for (const sx of [-1.95, 1.95]) {
    S.box(sx, 1.2, 0, 0.36, 2.2, 0.5, _scShade(th.wallTrim, 0.7));
    S.box(sx, 2.4, 0, 0.5, 0.2, 0.62, th.accent);
    S.sph(sx, 2.65, 0, 0.2, th.neon, { e: true, seg: 10 });
  }
  S.box(0, 4.0, 0, 4.4, 0.3, 0.55, _scShade(th.wallTrim, 0.7));
  S.pool(0, 0.28, 1.0, 2.8, th.neon, 0.16);
  S.box(0, 0.02, 1.2, 3.0, 0.02, 1.8, _scMix(th.wallTrim, th.accent, 0.3));
  _scColBox(st.x, st.z, st.rotY, 2.1, 0.8);
  // swirling disc + ring (own materials so they can re-tint)
  const uni = { uT: { value: 0 }, uCol: { value: new THREE.Color(nxt ? nxt.theme.neon : th.neon) } };
  const mat = new THREE.ShaderMaterial({
    uniforms: uni, side: THREE.DoubleSide,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `varying vec2 vUv; uniform float uT; uniform vec3 uCol;
      void main(){
        vec2 p = (vUv - 0.5) * 2.0; float r = length(p); if (r > 1.0) discard;
        float a = atan(p.y, p.x);
        float s1 = sin(a * 3.0 + r * 9.0 - uT * 2.6) * 0.5 + 0.5;
        float s2 = sin(a * 5.0 - r * 15.0 + uT * 3.4) * 0.5 + 0.5;
        float s = s1 * 0.6 + s2 * 0.4;
        vec3 c = mix(uCol * 0.3, uCol * 1.25, s);
        c += vec3(1.0) * smoothstep(0.35, 0.0, r) * (0.55 + 0.25 * sin(uT * 3.0));
        c += uCol * smoothstep(0.78, 1.0, r) * 0.9;
        gl_FragColor = vec4(c, 1.0);
        #include <colorspace_fragment>
      }`,
  });
  const disc = new THREE.Mesh(new THREE.CircleGeometry(1.55, 40), mat);
  const dp = _scL2W(st, 0, 0.02);
  disc.position.set(dp.x, 2.2, dp.z); disc.rotation.y = st.rotY;
  const ringMat = new THREE.MeshBasicMaterial({ color: nxt ? nxt.theme.neon : th.neon, toneMapped: false });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.7, 0.17, 10, 44), ringMat);
  ring.position.copy(disc.position); ring.rotation.y = st.rotY;
  const ring2 = new THREE.Mesh(new THREE.TorusGeometry(1.7, 0.24, 8, 44), new THREE.MeshLambertMaterial({ color: _scShade(th.wallTrim, 0.9) }));
  ring2.position.copy(disc.position); ring2.rotation.y = st.rotY; ring2.scale.set(1, 1, 0.5);
  _sc.room.group.add(disc, ring, ring2);
  _sc.portal = { uni, ringMat, nxt };
  // sign above
  const sp = _scL2W(st, 0, 0.35);
  const sign = _scSign('', 3.2, 0.8, sp.x, 4.6, sp.z, st.rotY, { px: 640 });
  _sc.portalSign = sign;
  _scDrawPortalSign();
}
function _scDrawPortalSign() {
  const sg = _sc.portalSign, p = _sc.portal;
  if (!sg || !p) return;
  const nxt = _scNextWorld();
  p.nxt = nxt;
  const col = nxt ? nxt.theme.neon : '#ffd23f';
  _scDrawSign(sg.userData.cv, nxt ? ['NEXT: ' + nxt.name.toUpperCase()] : ['ALL WORLDS UNLOCKED'], { bg: '#141a33', accent: col, fg: '#ffffff' });
  sg.material.map.needsUpdate = true;
  p.ringMat.color.set(col);
  if (nxt) p.uni.uCol.value.set(nxt.theme.neon);
}

function _scBuildExpansion(S, th) {
  ROOM.expansionSlots.forEach((e) => {
    S.setBase(e.x, 0, e.z, 0);
    S.box(0, 0.03, 0, 3.0, 0.06, 3.0, '#222a40');
    S.box(0, 0.065, 0, 2.7, 0.02, 2.7, _scShade(th.accent, 0.4));
    for (const s of [-1, 1]) { S.box(s * 1.35, 0.08, 0, 0.07, 0.03, 2.8, th.neon, { e: true }); S.box(0, 0.08, s * 1.35, 2.8, 0.03, 0.07, th.neon, { e: true }); }
    S.box(0, 0.09, 0, 0.9, 0.03, 0.2, '#ffffff', { e: true });
    S.box(0, 0.09, 0, 0.2, 0.03, 0.9, '#ffffff', { e: true });
    S.pool(0, 0.1, 0, 2.4, th.neon, 0.18);
    S.beam(0, 3.2, 0.1, 0, 1.4, th.neon, 0.035);
    _scSign(['COMING SOON'], 2.2, 0.55, e.x, 2.6, -ROOM.halfZ + 0.1, 0, { px: 512, accent: '#8fa0c8', fg: '#d6def5', bg: '#171d36' });
  });
}

/* ---------- theme decoration ---------- */
const _scPAL = ['#ff4d8d', '#4dd2ff', '#ffd23f', '#7cff6b', '#b46bff', '#ff8a3d'];

function _scCabinet(S, x, z, ry, body, glow) {
  S.setBase(x, 0, z, ry);
  S.box(0, 0.5, 0, 1.1, 1.0, 0.9, body);
  S.box(0, 0.5, 0.46, 1.0, 0.8, 0.03, _scShade(body, 0.7));
  S.box(0, 1.15, 0.28, 1.1, 0.12, 0.5, _scShade(body, 0.85), { rx: 0.25 });
  S.box(0, 1.6, -0.12, 1.1, 1.0, 0.62, body);
  S.box(0, 1.62, 0.2, 0.86, 0.72, 0.04, glow, { e: true });
  S.box(0, 1.62, 0.19, 0.96, 0.82, 0.03, '#10131f');
  S.box(0, 2.24, -0.1, 1.14, 0.34, 0.7, _scShade(body, 1.15));
  S.box(0, 2.24, 0.26, 1.0, 0.22, 0.03, glow, { e: true });
  S.sph(-0.22, 1.27, 0.34, 0.07, '#ff3b5c', { seg: 8, segH: 6 });
  S.cyl(-0.22, 1.2, 0.34, 0.025, 0.025, 0.14, '#222', { seg: 6 });
  [0.12, 0.26, 0.4].forEach((bx, i) => S.cyl(bx, 1.22, 0.36, 0.05, 0.05, 0.04, _scPAL[i], { e: true, seg: 8, rx: 0.25 }));
  S.box(0.5, 1.0, 0.0, 0.04, 0.9, 0.7, glow, { e: true });
  S.box(-0.56, 1.0, 0.0, 0.04, 0.9, 0.7, glow, { e: true });
  _scColBox(S.base.elements[12], S.base.elements[14], ry, 0.62, 0.5);
}

function _scBunting(S, x0, x1, y, wallZ, R) {
  S.setBase(0, 0, wallZ, 0);
  const n = Math.round(Math.abs(x1 - x0) / 0.55);
  S.box((x0 + x1) / 2, y + 0.05, 0.02, Math.abs(x1 - x0), 0.02, 0.02, '#e9e9ef');
  for (let i = 0; i <= n; i++) {
    const t = i / n, x = lerp(x0, x1, t), sag = Math.sin(t * Math.PI) * 0.35;
    S.cone(x, y - sag - 0.17, 0.03, 0.2, 0.4, _scPAL[i % _scPAL.length], { seg: 3, rx: Math.PI, ry: Math.PI / 2, order: 'YXZ' });
  }
}

function _scDecorArcade(S, th, R, D) {
  const n = ['#ff4d8d', '#4dd2ff', '#b46bff', '#ffd23f', '#4de08a'];
  _scCabinet(S, -9.1, -8.2, 0, '#7b3fe4', n[1]);
  _scCabinet(S, -7.0, -8.2, 0, '#e5367a', n[3]);
  _scCabinet(S, 7.0, -8.2, 0, '#1fa3d9', n[0]);
  _scCabinet(S, 9.1, -8.2, 0, '#7b3fe4', n[4]);
  _scCabinet(S, -10.15, -6.3, Math.PI / 2, '#e5367a', n[2]);
  if (D >= 1) {
    _scCabinet(S, 10.15, -7.0, -Math.PI / 2, '#1fa3d9', n[3]);
    _scCabinet(S, -10.15, 8.0, Math.PI / 2, '#7b3fe4', n[4]);
    _scCabinet(S, 10.15, 7.6, -Math.PI / 2, '#e5367a', n[1]);
  }
  // neon stars / hearts on walls
  S.wall('back', 0);
  S.shape(-5.6, 3.6, 0.12, _scStarShape(0.7, 0.3), 0.1, '#ffd23f', { e: true });
  S.shape(5.6, 3.6, 0.12, _scStarShape(0.7, 0.3), 0.1, '#4dd2ff', { e: true });
  S.shape(-8.0, 4.2, 0.12, _scHeartShape(0.55), 0.1, '#ff4d8d', { e: true });
  S.shape(8.0, 4.2, 0.12, _scHeartShape(0.55), 0.1, '#7cff6b', { e: true });
  S.tor(0, 3.6, 0.14, 0.9, 0.05, '#ff4d8d', { e: true, seg: 30 });
  S.wall('left', 0); S.shape(0, 4.0, 0.12, _scStarShape(0.7, 0.3), 0.1, '#ff8a3d', { e: true });
  S.wall('right', 0); S.shape(0, 4.0, 0.12, _scStarShape(0.7, 0.3), 0.1, '#b46bff', { e: true });
  // posters
  const pc = [['#ff4d8d', '#ffd23f'], ['#4dd2ff', '#b46bff'], ['#7cff6b', '#ff8a3d']];
  [['left', 3.2], ['left', -5.2], ['right', 6.0], ['right', -0.2], ['back', -2.7], ['back', 2.7]].forEach(([w, a], i) => {
    if (w === 'back') { S.wall(w, a, 0); } else S.wall(w, a);
    const [c1, c2] = pc[i % 3], y = w === 'back' ? 4.0 : 3.3;
    S.box(0, y, 0.07, 1.1, 1.5, 0.06, '#1b1f33');
    S.box(0, y, 0.11, 0.95, 1.35, 0.02, c1);
    S.cyl(0, y + 0.2, 0.13, 0.3, 0.3, 0.02, c2, { rx: Math.PI / 2, seg: 16 });
    S.box(0, y - 0.45, 0.13, 0.6, 0.12, 0.02, '#ffffff');
  });
  _scBunting(S, -10, 10, 6.2, -ROOM.halfZ, R);
  // floor arcade-token decor: neon corner rings
  S.setBase(0, 0, 0, 0);
  for (const [x, z] of [[-10, 8.4], [10, 8.4]]) { S.cyl(x, 0.5, z, 0.3, 0.35, 1.0, '#3c3f6b'); S.sph(x, 1.15, z, 0.3, n[(x > 0) | 0 ? 0 : 1], { e: true, seg: 10 }); _scColCircle(x, z, 0.42); }
}

function _scLeafFan(S, x, z, h, R, greens, n = 9, len = 1.3) {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + R() * 0.5, lean = 0.5 + R() * 0.7, L = len * (0.7 + R() * 0.6);
    const cx = x + Math.cos(a) * Math.sin(lean) * L / 2, cz = z - Math.sin(a) * Math.sin(lean) * L / 2, cy = h + Math.cos(lean) * L / 2;
    S.cone(cx, cy, cz, 0.28, L, greens[i % greens.length], { seg: 5, sx: 0.28 / 0.28 * 0.5, sz: 1, rz: -lean, ry: a, order: 'YZX' });
  }
}
function _scDecorJungle(S, th, R, D) {
  const greens = ['#2f9e44', '#40c057', '#2b8a3e', '#69db7c', '#37b24d'];
  S.setBase(0, 0, 0, 0);
  const plants = [[-9.8, -8.2, 1.2], [9.8, -8.2, 1.3], [-9.8, 8.0, 1.0], [9.8, 7.9, 1.1], [-9.9, 1.4, 0.9], [9.9, -0.2, 0.9]];
  plants.forEach(([x, z, s]) => {
    S.setBase(0, 0, 0, 0);
    S.cyl(x, 0.3, z, 0.38 * s, 0.3 * s, 0.6, '#b5651d', { seg: 10 });
    S.cyl(x, 0.62, z, 0.4 * s, 0.4 * s, 0.08, '#8a4b14', { seg: 10 });
    S.cyl(x, 0.62, z, 0.33 * s, 0.33 * s, 0.1, '#3b2a1a', { seg: 10 });
    _scLeafFan(S, x, z, 0.65, R, greens, D >= 1 ? 13 : 8, 2.4 * s);
    for (let k = 0; k < 4; k++) S.sph(x + (R() - 0.5) * 1.0, 1.0 + R() * 0.8, z + (R() - 0.5) * 1.0, 0.09, _scPAL[k], { seg: 6, segH: 5 });
    _scColCircle(x, z, 0.5 * s);
  });
  // bamboo clusters
  const bam = [[-8.4, -8.4], [8.4, -8.4], [-10.2, 6.2], [10.3, 5.6]];
  bam.forEach(([bx, bz]) => {
    for (let i = 0; i < (D >= 1 ? 6 : 4); i++) {
      const x = bx + (R() - 0.5) * 0.9, z = bz + (R() - 0.5) * 0.6, h = 3.4 + R() * 2.4;
      S.cyl(x, h / 2, z, 0.07, 0.08, h, i % 2 ? '#9bd060' : '#7fb843', { seg: 6 });
      for (let y = 0.7; y < h - 0.2; y += 0.85) S.cyl(x, y, z, 0.095, 0.095, 0.06, '#5a8a2a', { seg: 6 });
      S.cone(x, h + 0.2, z, 0.12, 0.5, '#69db7c', { seg: 5, sx: 0.5 });
    }
    _scColCircle(bx, bz, 0.6);
  });
  // vines + hanging lanterns
  for (const [side, L, step] of [['back', 21, 1.9], ['left', 17, 2.4], ['right', 17, 2.4]]) {
    S.wall(side, 0);
    for (let p = -L / 2 + 1; p < L / 2; p += step + R()) {
      const len = 1.2 + R() * 2.2;
      S.cyl(p, ROOM.height - len / 2 - 0.2, 0.18, 0.03, 0.025, len, '#2f7a34', { seg: 5 });
      for (let k = 0; k < 3 + (D >= 1 ? 2 : 0); k++) S.ico(p + (R() - 0.5) * 0.3, ROOM.height - 0.5 - k * len / 4, 0.2, 0.13, greens[k % 5], { detail: 0, sy: 0.7 });
      if (R() < 0.3) S.sph(p, ROOM.height - len - 0.3, 0.2, 0.1, '#ff6b9a', { seg: 6, segH: 5 });
    }
  }
  // waterfall panel + rocks (back-left)
  S.wall('back', -8.1);
  S.box(0, 2.3, 0.08, 3.0, 4.2, 0.12, '#4a4033');
  S.box(0, 2.3, 0.15, 2.5, 4.0, 0.04, '#25667f');
  S.box(0, 4.55, 0.3, 3.2, 0.3, 0.55, '#6b6b6b');
  for (const [rx, rz, r] of [[-1.5, 0.7, 0.6], [1.5, 0.8, 0.55], [-0.4, 1.3, 0.4], [1.0, 1.4, 0.35], [0, 0.5, 0.5]]) S.ico(rx, r * 0.6, rz, r, '#7a766d', { detail: 0, sy: 0.7 });
  S.cyl(0, 0.08, 1.0, 1.35, 1.35, 0.1, '#58c8e8', { e: true, seg: 20 });
  S.wall('back', -8.1);
  _scColBox(-8.1, -8.0, 0, 2.0, 1.1);
  // mushrooms
  S.setBase(0, 0, 0, 0);
  for (const [x, z] of [[-10, -4.4], [10.2, -5.2], [-10, 3.2], [10.2, 8.9]]) {
    for (let i = 0; i < 3; i++) {
      const mx = x + (R() - 0.5) * 0.7, mz = z + (R() - 0.5) * 0.5, s = 0.6 + R() * 0.7;
      S.cyl(mx, 0.15 * s, mz, 0.06 * s, 0.08 * s, 0.3 * s, '#f6efe0', { seg: 6 });
      S.sph(mx, 0.34 * s, mz, 0.2 * s, '#e03131', { seg: 8, segH: 5, sy: 0.7 });
      S.sph(mx + 0.07 * s, 0.42 * s, mz, 0.04 * s, '#fff', { seg: 5, segH: 4 });
    }
  }
  if (D >= 1) {   // lanterns
    S.wall('back', 0);
    for (const x of [-3.2, 3.2]) { S.cyl(x, 4.3, 0.3, 0.02, 0.02, 1.6, '#3b2a1a', { seg: 4 }); S.sph(x, 3.4, 0.3, 0.26, '#ffb703', { e: true, seg: 10 }); }
  }
}

function _scDecorFrozen(S, th, R, D) {
  S.setBase(0, 0, 0, 0);
  const ice = ['#bfe8ff', '#9fd8f8', '#d9f2ff', '#8ccbf0'];
  // snow piles along the walls
  for (let i = 0; i < (D >= 1 ? 26 : 14); i++) {
    const side = i % 3, t = R();
    const x = side === 0 ? lerp(-10.2, 10.2, t) : side === 1 ? -10.4 : 10.4;
    const z = side === 0 ? -8.5 : lerp(-8.5, 8.4, t);
    S.sph(x, 0.12, z, 0.5 + R() * 0.6, '#f4fbff', { sy: 0.45, seg: 9, segH: 6 });
  }
  // ice block clusters
  [[-9.6, -8.0], [9.6, -8.0], [-10.0, 7.6], [10.0, 7.6], [-6.2, -8.4], [6.4, -8.4]].forEach(([x, z], k) => {
    for (let i = 0; i < 4; i++) {
      const s = 0.55 + R() * 0.55, a = (R() - 0.5) * 1.4;
      S.box(x + (R() - 0.5) * 1.1, s / 2 + (i === 3 ? 0.55 : 0), z + (R() - 0.5) * 0.7, s, s, s, ice[(i + k) % 4], { ry: a });
    }
    S.box(x, 1.3, z, 0.3, 0.3, 0.3, '#ffffff', { e: true, ry: 0.5, rz: 0.4 });
    _scColCircle(x, z, 0.85);
  });
  // crystals
  [[-10.2, 4.2, '#7ee8ff'], [10.3, -6.0, '#b794ff'], [8.0, -8.5, '#7ee8ff'], [-8.2, -8.6, '#b794ff'], [-10.1, -4.6, '#7ee8ff']].forEach(([x, z, c]) => {
    for (let i = 0; i < 5; i++) {
      const h = 0.8 + R() * 1.4, a = (i / 5) * TAU, lean = i ? 0.35 : 0;
      S.cone(x + Math.cos(a) * 0.25, h / 2, z + Math.sin(a) * 0.25, 0.16 + R() * 0.08, h, c, { e: true, seg: 5, rz: Math.cos(a) * lean, rx: Math.sin(a) * lean });
    }
    S.pool(x, 0.05, z, 1.6, c, 0.5);
    _scColCircle(x, z, 0.55);
  });
  // pine trees
  [[-9.9, -1.8], [10.1, 5.8], [9.9, -9.0 + 1.6]].forEach(([x, z]) => {
    S.cyl(x, 0.3, z, 0.12, 0.16, 0.6, '#6b4a2b', { seg: 6 });
    [[0.9, 1.15, 0.6], [0.7, 1.85, 1.2], [0.5, 2.5, 1.75]].forEach(([r, y, yy], i) => {
      S.cone(x, yy + 0.1, z, r, 1.1, i % 2 ? '#1f7a6a' : '#2a9d8f', { seg: 8 });
      S.cone(x, yy + 0.38, z, r * 0.8, 0.5, '#f4fbff', { seg: 8 });
    });
    _scColCircle(x, z, 0.55);
  });
  // snowman
  const sx = -10.0, sz = 8.3;
  S.sph(sx, 0.45, sz, 0.5, '#ffffff'); S.sph(sx, 1.15, sz, 0.38, '#ffffff'); S.sph(sx, 1.7, sz, 0.28, '#ffffff');
  S.cone(sx + 0.05, 1.7, sz + 0.28, 0.05, 0.3, '#ff8a3d', { rx: Math.PI / 2, seg: 6 });
  S.sph(sx - 0.1, 1.77, sz + 0.24, 0.035, '#222', { seg: 5, segH: 4 }); S.sph(sx + 0.12, 1.77, sz + 0.24, 0.035, '#222', { seg: 5, segH: 4 });
  S.cyl(sx, 1.98, sz, 0.2, 0.2, 0.22, '#2d3250', { seg: 10 }); S.cyl(sx, 1.88, sz, 0.32, 0.32, 0.04, '#2d3250', { seg: 10 });
  S.tor(sx, 1.45, sz, 0.3, 0.07, '#e03131', { rx: Math.PI / 2, seg: 14 });
  for (let i = 0; i < 3; i++) S.sph(sx, 0.95 - i * 0.0 + i * 0.0 + 0.2 * (i - 1) + 0.2, sz + 0.36 - 0.04 * i, 0.04, '#222', { seg: 5, segH: 4 });
  _scColCircle(sx, sz, 0.55);
  // icicles
  const H = ROOM.height;
  for (const [side, L] of [['back', 22], ['left', 18], ['right', 18]]) {
    S.wall(side, 0);
    for (let p = -L / 2 + 0.3; p < L / 2; p += 0.55 + R() * 0.3) {
      const h = 0.35 + R() * 0.9;
      S.cone(p, H - 0.25 - h / 2, 0.2, 0.07 + R() * 0.08, h, '#dff4ff', { seg: 5, rx: Math.PI });
    }
  }
  // glowing ice lamps
  S.wall('back', 0);
  for (const x of [-4.0, 4.0]) { S.sph(x, 4.1, 0.25, 0.3, '#9fe8ff', { e: true, seg: 10 }); }
}

function _scCactus(S, x, z, s, R) {
  const g = '#3fa34d', g2 = '#2f8a3e';
  S.cyl(x, 0.9 * s, z, 0.22 * s, 0.26 * s, 1.8 * s, g, { seg: 10 });
  S.sph(x, 1.8 * s, z, 0.22 * s, g, { seg: 10 });
  S.cyl(x + 0.38 * s, 1.05 * s, z, 0.11 * s, 0.11 * s, 0.5 * s, g2, { rz: Math.PI / 2, seg: 8 });
  S.cyl(x + 0.6 * s, 1.4 * s, z, 0.11 * s, 0.11 * s, 0.8 * s, g2, { seg: 8 });
  S.sph(x + 0.6 * s, 1.8 * s, z, 0.11 * s, g2, { seg: 8, segH: 6 });
  S.cyl(x - 0.35 * s, 1.35 * s, z, 0.11 * s, 0.11 * s, 0.4 * s, g2, { rz: Math.PI / 2, seg: 8 });
  S.cyl(x - 0.55 * s, 1.65 * s, z, 0.11 * s, 0.11 * s, 0.6 * s, g2, { seg: 8 });
  S.sph(x, 2.05 * s, z, 0.1 * s, '#ff6b9a', { seg: 7, segH: 5 });
  _scColCircle(x, z, 0.5 * s);
}
function _scDecorDesert(S, th, R, D) {
  S.setBase(0, 0, 0, 0);
  const sand = new THREE.Color(th.wall), stone = _scShade(th.wallTrim, 1.0);
  // pyramid + stepped blocks
  S.cone(9.6, 1.1, -8.0, 1.9, 2.2, _scShade(sand, 1.05), { seg: 4, ry: Math.PI / 4 });
  S.cone(9.6, 2.45, -8.0, 0.35, 0.5, '#ffd23f', { seg: 4, ry: Math.PI / 4, e: true });
  _scColCircle(9.6, -8.0, 1.5);
  [[-9.4, -8.2], [-10.0, 6.8]].forEach(([x, z]) => {
    S.box(x, 0.4, z, 1.8, 0.8, 1.5, stone); S.box(x + 0.15, 1.0, z, 1.3, 0.4, 1.1, _scShade(stone, 1.08)); S.box(x + 0.3, 1.4, z, 0.8, 0.4, 0.7, _scShade(stone, 1.16));
    _scColBox(x, z, 0, 0.95, 0.8);
  });
  // cacti, pots
  _scCactus(S, -6.8, -8.3, 1.0, R); _scCactus(S, 6.9, -8.3, 1.2, R); _scCactus(S, 10.1, 7.6, 1.0, R);
  if (D >= 1) { _scCactus(S, -10.2, 2.0, 0.8, R); _scCactus(S, 10.2, -0.2, 0.9, R); }
  [[-10.0, 8.5], [10.2, 3.2 + 3.4], [-10.1, -4.6], [10.1, -9.0 + 1.2]].forEach(([x, z], i) => {
    S.cyl(x, 0.35, z, 0.38, 0.26, 0.7, '#c4622d', { seg: 10 }); S.cyl(x, 0.72, z, 0.42, 0.42, 0.1, '#a84a1c', { seg: 10 });
    S.cyl(x, 0.74, z, 0.34, 0.34, 0.06, '#5a3a1b', { seg: 10 });
    S.tor(x, 0.45, z, 0.34, 0.03, '#ffd23f', { rx: Math.PI / 2, seg: 14 });
    for (let k = 0; k < 6; k++) { const a = k / 6 * TAU; S.cone(x + Math.cos(a) * 0.12, 1.0, z + Math.sin(a) * 0.12, 0.07, 0.55, '#4cae4f', { seg: 4, rz: Math.cos(a) * 0.5, rx: -Math.sin(a) * 0.5 }); }
    _scColCircle(x, z, 0.45);
  });
  // palm
  const px = -9.9, pz = -1.8 + 8.2;
  for (let i = 0; i < 7; i++) S.cyl(px + Math.sin(i * 0.18) * 0.3, 0.4 + i * 0.5, pz, 0.17 - i * 0.008, 0.2 - i * 0.008, 0.55, i % 2 ? '#b98a54' : '#a77a46', { seg: 8, rz: -0.1 });
  _scLeafFan(S, px + 0.5, pz, 3.7, R, ['#3fa34d', '#2f8a3e', '#56c45e'], 8, 1.9);
  S.sph(px + 0.5, 3.55, pz, 0.2, '#7a4b1c', { seg: 8 });
  _scColCircle(px + 0.2, pz, 0.45);
  // sun emblem (back wall, right) + hieroglyph panel (left)
  S.wall('back', 7.7);
  S.cyl(0, 3.4, 0.14, 1.0, 1.0, 0.1, '#ffd23f', { rx: Math.PI / 2, e: true, seg: 30 });
  S.cyl(0, 3.4, 0.1, 1.25, 1.25, 0.06, '#ff9f1c', { rx: Math.PI / 2, e: true, seg: 30 });
  for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; S.cone(Math.cos(a) * 1.65, 3.4 + Math.sin(a) * 1.65, 0.14, 0.2, 0.6, i % 2 ? '#ffd23f' : '#ff9f1c', { e: true, seg: 3, rz: a - Math.PI / 2 }); }
  S.wall('back', -7.7);
  S.box(0, 3.4, 0.1, 2.6, 2.2, 0.08, _scShade(stone, 0.85));
  for (let i = 0; i < 6; i++) { const c = i % 3; S.box(-0.8 + (i % 3) * 0.8, 3.9 - Math.floor(i / 3) * 0.9, 0.16, c === 1 ? 0.15 : 0.45, c === 1 ? 0.5 : 0.18, 0.04, th.accent, { e: true }); }
  // hanging cloth banners
  for (const p of [-3.6, 3.6]) { S.wall('back', p); S.box(0, 4.8, 0.2, 0.9, 1.6, 0.04, '#d6493a'); S.box(0, 4.8, 0.23, 0.5, 0.5, 0.02, '#ffd23f', { e: true, rz: 0.78 }); }
  // dunes
  for (const [x, z, r] of [[-10.5, -0.2, 1.3], [10.7, 5.4, 1.4]]) S.sph(x, 0, z, r, _scShade(sand, 1.02), { sy: 0.22, seg: 12, segH: 6 });
}

function _scDecorSpace(S, th, R, D) {
  S.setBase(0, 0, 0, 0);
  const neon = new THREE.Color(th.neon);
  // round windows
  const win = (side, along, y, planet) => {
    S.wall(side, along);
    S.tor(0, y, 0.1, 1.2, 0.14, '#9aa8c9', { seg: 32, segR: 10 });
    S.tor(0, y, 0.12, 1.34, 0.05, th.neon, { seg: 32, e: true });
    S.cyl(0, y, 0.06, 1.2, 1.2, 0.04, '#04061a', { rx: Math.PI / 2, seg: 32 });
    for (let i = 0; i < 26; i++) { const a = R() * TAU, r = Math.sqrt(R()) * 1.05; S.box(Math.cos(a) * r, y + Math.sin(a) * r, 0.1, 0.045, 0.045, 0.01, '#ffffff', { e: true }); }
    S.sph(0.35, y - 0.2, 0.1, 0.55, planet, { e: true, sz: 0.1, seg: 18, segH: 12 });
    S.tor(0.35, y - 0.2, 0.12, 0.8, 0.04, _scShade(planet, 1.3), { e: true, rx: -0.2, ry: 0, rz: 0.4, sy: 0.3, seg: 30 });
  };
  win('back', -7.4, 3.3, '#ff8a5c'); win('back', 7.4, 3.3, '#5cc8ff');
  if (D >= 1) { win('left', -6.0, 3.6, '#b794ff'); win('right', -6.5, 3.6, '#7cff9b'); win('left', 7.6, 3.6, '#ffd23f'); }
  // consoles
  const console_ = (x, z, ry, c) => {
    S.setBase(x, 0, z, ry);
    S.box(0, 0.5, 0, 2.0, 1.0, 0.8, '#3a4366'); S.box(0, 1.02, 0.12, 2.0, 0.08, 0.7, '#59648c');
    S.box(0, 1.55, -0.2, 1.9, 0.9, 0.12, '#222a45');
    S.box(-0.5, 1.55, -0.13, 0.8, 0.7, 0.03, c, { e: true }); S.box(0.5, 1.55, -0.13, 0.8, 0.7, 0.03, '#ffd23f', { e: true });
    for (let i = 0; i < 6; i++) S.cyl(-0.8 + i * 0.32, 1.09, 0.2, 0.05, 0.05, 0.04, _scPAL[i], { e: true, seg: 8 });
    _scColBox(x, z, ry, 1.05, 0.45);
  };
  console_(-3.3, -8.5, 0, th.neon); console_(3.3, -8.5, 0, '#ff5ca8');
  if (D >= 1) console_(-10.4, 2.4, Math.PI / 2, '#4de08a');
  // rocket (back-right corner)
  S.setBase(9.6, 0, -8.0, 0);
  S.cyl(0, 1.6, 0, 0.55, 0.62, 2.6, '#f3f6ff', { seg: 14 }); S.cyl(0, 0.6, 0, 0.63, 0.63, 0.5, '#e5367a', { seg: 14 });
  S.cone(0, 3.35, 0, 0.55, 1.0, '#e5367a', { seg: 14 });
  S.tor(0, 2.1, 0.0, 0.57, 0.03, '#e5367a', { rx: Math.PI / 2, seg: 14 });
  S.cyl(0, 2.2, 0.5, 0.2, 0.2, 0.1, '#7ee8ff', { rx: Math.PI / 2, e: true, seg: 14 });
  for (let i = 0; i < 3; i++) { const a = i * TAU / 3 + 0.5; S.box(Math.cos(a) * 0.72, 0.5, Math.sin(a) * 0.72, 0.1, 1.0, 0.5, '#e5367a', { ry: -a, rz: 0 }); }
  S.cyl(0, 0.05, 0, 1.1, 1.2, 0.1, '#3a4366', { seg: 14 });
  _scColCircle(9.6, -8.0, 1.0);
  // satellite dish (back-left corner)
  S.setBase(-9.7, 0, -7.6, 0.4);
  S.cyl(0, 0.6, 0, 0.12, 0.2, 1.2, '#59648c', { seg: 8 }); S.cyl(0, 0.03, 0, 0.6, 0.6, 0.06, '#3a4366', { seg: 10 });
  S.geo(new THREE.SphereGeometry(0.8, 18, 8, 0, TAU, 0, Math.PI / 2), 0, 1.5, 0.1, '#e9eef9', { rx: -(Math.PI / 2 + 0.6) }); S.sph(0, 1.78, 0.62, 0.07, '#ff5c5c', { e: true, seg: 8, segH: 6 });
  _scColCircle(-9.7, -7.6, 0.7);
  // glow ring around machine rug
  S.setBase(0, 0, ROOM.stations.machine.z, 0);
  S.tor(0, 0.03, 0, 3.7, 0.04, neon, { e: true, rx: Math.PI / 2, seg: 48, segR: 4 });
  // pipes along wall base
  for (const [side, L] of [['left', 18], ['right', 18]]) { S.wall(side, 0); S.cyl(0, 0.3, 0.2, 0.09, 0.09, L - 1, '#59648c', { rz: Math.PI / 2, seg: 8 }); }
  S.wall('back', 0);
  S.cyl(0, 0.3, 0.2, 0.09, 0.09, 20, '#59648c', { rz: Math.PI / 2, seg: 8 });
  for (let x = -9; x <= 9; x += 3) S.cyl(x, 0.3, 0.2, 0.12, 0.12, 0.14, th.neon, { rz: Math.PI / 2, e: true, seg: 8 });
}

/* ---------- ambient particles ---------- */
function _scDotTexture() {
  const cv = _scCanvas(64, 64), g = cv.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,.75)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  return _scTex(cv);
}
function _scAddParticles(mode, count, o) {
  count = Math.round(count);
  if (count < 1) return;
  const pos = new Float32Array(count * 3), col = new Float32Array(count * 3), seed = new Float32Array(count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < count; i++) {
    const hx = ROOM.halfX, hz = ROOM.halfZ;
    seed[i * 3] = Math.random() * TAU; seed[i * 3 + 1] = 0.5 + Math.random(); seed[i * 3 + 2] = Math.random();
    if (mode === 'stars') {
      const a = Math.random() * TAU, b = Math.acos(Math.random() * 1.6 - 0.8), r = 70;
      pos[i * 3] = Math.cos(a) * Math.sin(b) * r; pos[i * 3 + 1] = Math.cos(b) * r * 0.7 + 10; pos[i * 3 + 2] = Math.sin(a) * Math.sin(b) * r - 30;
    } else {
      pos[i * 3] = randRange(-hx, hx); pos[i * 3 + 1] = randRange(o.y0, o.y1); pos[i * 3 + 2] = randRange(-hz, hz);
    }
    c.set(o.colors[i % o.colors.length]); col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const m = new THREE.PointsMaterial({
    size: o.size, map: _sc.dot, vertexColors: true, transparent: true, depthWrite: false, fog: mode !== 'stars',
    blending: o.add ? THREE.AdditiveBlending : THREE.NormalBlending, opacity: o.opacity || 1,
  });
  const pts = new THREE.Points(g, m);
  pts.frustumCulled = false;
  _sc.room.group.add(pts);
  _sc.room.particles.push({ pts, mode, pos, seed, o });
}
function _scBuildParticles(th) {
  const P = Scene3D.preset.particles, d = th.decor;
  if (P <= 0) return;
  if (d === 'arcade') _scAddParticles('fall', 90 * P, { y0: 0, y1: 8, size: 0.16, colors: _scPAL, speed: 0.35 });
  else if (d === 'jungle') _scAddParticles('float', 50 * P, { y0: 0.5, y1: 4.5, size: 0.26, colors: ['#d8ff5a', '#9dff7a'], add: true });
  else if (d === 'frozen') _scAddParticles('fall', 280 * P, { y0: 0, y1: 9, size: 0.15, colors: ['#ffffff', '#dff4ff'], speed: 0.8, sway: 0.5 });
  else if (d === 'desert') _scAddParticles('float', 70 * P, { y0: 0.3, y1: 5, size: 0.14, colors: ['#ffe2a8', '#ffd08a'], add: true, drift: 1 });
  else if (d === 'space') {
    _scAddParticles('float', 22 * P, { y0: 0.8, y1: 5.5, size: 0.7, colors: [th.neon, '#ff5ca8', '#7cff9b', '#ffd23f'], add: true, opacity: 0.8 });
    _scAddParticles('stars', 260 * Math.max(0.4, P), { size: 1.6, colors: ['#ffffff', '#cfe6ff', '#ffe9b0'] });
  }
}

/* ---------- the Scene3D module ---------- */
const _sc = {
  setting: 'auto', room: null, mats: null, dot: null, time: 0, worldId: null, petSpots: [], qMarks: [], pets: [],
  petDebounce: 0, portal: null, portalSign: null, kioskMat: null, labels: [], watch: { t: 0, n: 0, sum: 0, last: -99 },
  size: { w: 1, h: 1 }, ready: false, v: null, dpr: 1,
};
const _scPRESETS = {
  low: () => ({ pixelRatio: 1, shadows: false, particles: 0.35, decor: 0.5 }),
  medium: () => ({ pixelRatio: Math.min(_sc.dpr, 1.5), shadows: false, particles: 0.7, decor: 1 }),
  high: () => ({ pixelRatio: Math.min(_sc.dpr, 2), shadows: true, particles: 1, decor: 1 }),
};
function _scResolveAuto() {
  if (!Game.isTouch) return 'high';
  return ((typeof navigator !== 'undefined' && navigator.hardwareConcurrency) || 8) <= 4 ? 'low' : 'medium';
}
function _scApplyQuality(name) {
  const old = Scene3D.preset;
  Scene3D.quality = name;
  Scene3D.preset = _scPRESETS[name]();
  if (!_sc.ready) return;
  const p = Scene3D.preset, r = Scene3D.renderer;
  r.setPixelRatio(p.pixelRatio);
  r.shadowMap.enabled = p.shadows;
  _sc.sun.castShadow = p.shadows;
  for (const k of ['lit']) _sc.mats[k].needsUpdate = true;
  _scResize();
  if (_sc.worldId && old && (old.decor !== p.decor || old.particles !== p.particles)) Scene3D.buildWorld(_sc.worldId);
}
function _scResize() {
  if (!_sc.ready) return;
  const w = Math.max(1, window.innerWidth), h = Math.max(1, window.innerHeight);
  _sc.size.w = w; _sc.size.h = h;
  Scene3D.renderer.setSize(w, h, false);
  Scene3D.camera.aspect = w / h;
  Scene3D.camera.updateProjectionMatrix();
}
function _scDisposeRoom() {
  const r = _sc.room;
  if (!r) return;
  _scClearPets();
  Scene3D.scene.remove(r.group);
  r.group.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    const ms = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
    for (const m of ms) { if (!m.userData.shared) m.dispose(); }
  });
  for (const t of r.tex) t.dispose();
  _sc.room = null; _sc.portal = null; _sc.portalSign = null; _sc.kioskMat = null; _sc.qMarks = []; _sc.petSpots = []; _sc.labels = [];
}
function _scClearPets() {
  for (const p of _sc.pets) {
    if (!p) continue;
    if (p.holder.parent) p.holder.parent.remove(p.holder);
    try { AnimalFactory.dispose(p.inner); } catch (e) { /* ignore */ }
  }
  _sc.pets = [];
}

const Scene3D = {
  renderer: null, scene: null, camera: null,
  quality: 'high', preset: null, colliders: [],

  init(canvas) {
    _sc.dpr = Math.min(window.devicePixelRatio || 1, 3);
    const saved = (Game.player && Game.player.settings && Game.player.settings.quality) || 'auto';
    _sc.setting = ['auto', 'low', 'medium', 'high'].includes(saved) ? saved : 'auto';
    const res = _sc.setting === 'auto' ? _scResolveAuto() : _sc.setting;
    Scene3D.quality = res; Scene3D.preset = _scPRESETS[res]();
    const r = new THREE.WebGLRenderer({ canvas, antialias: res !== 'low', powerPreference: 'high-performance' });
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.setPixelRatio(Scene3D.preset.pixelRatio);
    Scene3D.renderer = r;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#1b2038');
    Scene3D.scene = scene;
    const cam = new THREE.PerspectiveCamera(55, 1, 0.1, 200);
    cam.position.set(0, 9, 15); cam.lookAt(0, 1, -1);
    Scene3D.camera = cam;
    _sc.mats = {
      lit: new THREE.MeshLambertMaterial({ vertexColors: true }),
      emi: new THREE.MeshBasicMaterial({ vertexColors: true }),
      glow: new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
    };
    for (const k in _sc.mats) _sc.mats[k].userData.shared = true;
    _sc.hemi = new THREE.HemisphereLight('#ffffff', '#666688', 1.9); scene.add(_sc.hemi);
    const sun = new THREE.DirectionalLight('#ffffff', 1.7);
    sun.position.set(5, 16, 9); sun.target.position.set(0, 0, -1);
    sun.shadow.mapSize.set(1024, 1024);
    const sc = sun.shadow.camera; sc.left = -14; sc.right = 14; sc.top = 11; sc.bottom = -11; sc.near = 4; sc.far = 40;
    sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.03;
    scene.add(sun, sun.target); _sc.sun = sun;
    _sc.ready = true;
    r.shadowMap.enabled = Scene3D.preset.shadows; sun.castShadow = Scene3D.preset.shadows;
    _scResize();
    window.addEventListener('resize', _scResize);
    window.addEventListener('orientationchange', () => setTimeout(_scResize, 120));
    Bus.on('settings:changed', (d) => { if (d && d.key === 'quality') Scene3D.setQuality(d.value); });
    Bus.on('pets:changed', () => {
      clearTimeout(_sc.petDebounce);
      _sc.petDebounce = setTimeout(() => Scene3D.refreshPetDisplay(), 80);
    });
    Bus.on('world:unlocked', () => _scDrawPortalSign());
    _sc.v = { a: new THREE.Vector3() };
    r.render(scene, cam);
  },

  setQuality(q) {
    if (!['auto', 'low', 'medium', 'high'].includes(q)) q = 'auto';
    _sc.setting = q;
    _sc.watch.last = -99; _sc.watch.t = 0; _sc.watch.n = 0; _sc.watch.sum = 0;
    _scApplyQuality(q === 'auto' ? _scResolveAuto() : q);
  },

  buildWorld(worldId) {
    const world = (typeof WORLD_BY_ID !== 'undefined' && WORLD_BY_ID[worldId]) || WORLDS[0];
    const th = world.theme, decor = th.decor, D = Scene3D.preset.decor;
    _scDisposeRoom();
    _sc.worldId = world.id;
    _sc.room = { group: new THREE.Group(), tex: [], particles: [] };
    if (!_sc.dot) { /* dot texture is per-room so it can be disposed with it */ }
    _sc.dot = _scDotTexture();
    Scene3D.colliders.length = 0;
    const R = _scRng(decor.length * 977 + world.order * 31 + 7);
    const scene = Scene3D.scene;
    scene.background = new THREE.Color(th.fog);
    scene.fog = new THREE.Fog(th.fog, 38, 95);
    _sc.hemi.color.set(th.ambient); _sc.hemi.groundColor.set(_scShade(th.floorB, 0.7));
    _sc.sun.color.set(th.light);

    const S = new _scSet();
    _scFloor(S, th, R);
    _scWalls(S, th, R);
    _scBuildMachineSpot(S, th);
    _scBuildTraining(S, th, world.id, R);
    _scBuildKiosk(S, th);
    _scBuildPets(S, th);
    _scBuildPortal(S, th);
    _scBuildExpansion(S, th);
    ({ arcade: _scDecorArcade, jungle: _scDecorJungle, frozen: _scDecorFrozen, desert: _scDecorDesert, space: _scDecorSpace }[decor] || _scDecorArcade)(S, th, R, D);
    const g = S.toGroup(true);
    _sc.room.group.add(g);

    // world name sign above the machine
    _scSign([world.name.toUpperCase()], 5.0, 0.9, 0, 5.3, -ROOM.halfZ + 0.27, 0, { px: 768, accent: th.neon, fg: '#ffffff' });
    // training sign
    const tr = ROOM.stations.training;
    _scSign(['TRAINING'], 2.6, 0.62, -ROOM.halfX + 0.14, 4.25, tr.z, Math.PI / 2, { px: 512, accent: th.accent });
    // waterfall (jungle)
    if (decor === 'jungle') {
      const uni = { uT: { value: 0 } };
      const wm = new THREE.ShaderMaterial({
        uniforms: uni,
        vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
        fragmentShader: `varying vec2 vUv; uniform float uT;
          void main(){
            float v = vUv.y + uT * 0.8;
            float st = sin(vUv.x * 55.0 + sin(vUv.x * 9.0) * 2.0) * 0.5 + 0.5;
            float fl = (sin(v * 22.0 + vUv.x * 40.0) * 0.5 + 0.5) * st;
            vec3 c = mix(vec3(0.16, 0.56, 0.8), vec3(0.62, 0.92, 1.0), fl * 0.7 + (1.0 - vUv.y) * 0.25);
            c += vec3(1.0) * smoothstep(0.12, 0.0, vUv.y) * 0.6;
            gl_FragColor = vec4(c, 1.0);
            #include <colorspace_fragment>
          }`,
      });
      const wf = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 3.8), wm);
      wf.position.set(-8.1, 2.4, -ROOM.halfZ + 0.2);
      _sc.room.group.add(wf);
      _sc.room.anim = { uni };
    }

    // floating labels
    const mk = (txt, st, y, col, w) => {
      const sp = _scLabel(txt, col, w); sp.position.set(st.x, y, st.z); sp.userData.y0 = y; sp.userData.ph = Math.random() * 6;
      _sc.room.group.add(sp); _sc.labels.push(sp);
    };
    const S_ = ROOM.stations;
    mk('🕹️ CLAW MACHINE', S_.machine, 4.4, th.neon, 3.0);
    mk('🏋️ TRAIN', S_.training, 3.1, th.accent, 2.0);
    mk('⬆️ UPGRADES', S_.upgrades, 4.0, '#4de08a', 2.5);
    mk('🐾 MY PETS', S_.pets, 3.6, '#ff8fc7', 2.2);
    mk('🌀 WORLDS', S_.portal, 5.5, th.neon, 2.0);

    _scBuildParticles(th);
    scene.add(_sc.room.group);
    Scene3D.refreshPetDisplay();
  },

  refreshPetDisplay() {
    if (!_sc.room || typeof AnimalFactory === 'undefined' || !_sc.petSpots.length) return;
    let list = [];
    try {
      if (typeof Services !== 'undefined' && Services.petsSorted) list = Services.petsSorted('mult') || [];
      else if (Game.player && Game.player.pets) list = Game.player.pets;
    } catch (e) { list = []; }
    const n = _sc.petSpots.length, st = ROOM.stations.pets;
    const sorted = list.slice(0, n);
    for (let i = 0; i < n; i++) {
      const p = sorted[i], key = p ? p.id + ':' + p.variant : '';
      const cur = _sc.pets[i];
      if (cur && cur.key === key) { _sc.qMarks[i].visible = !p; continue; }
      if (cur) {
        cur.holder.parent && cur.holder.parent.remove(cur.holder);
        try { AnimalFactory.dispose(cur.inner); } catch (e) { /* ignore */ }
        _sc.pets[i] = null;
      }
      _sc.qMarks[i].visible = !p;
      if (!p) continue;
      let inner;
      try { inner = AnimalFactory.build(p.id, p.variant || 'normal'); } catch (e) { console.error('[Scene3D] pet build', e); continue; }
      const holder = new THREE.Group();
      holder.add(inner);
      holder.scale.setScalar(1.6);
      const sp = _sc.petSpots[i];
      holder.position.set(sp.x, sp.y, sp.z);
      holder.rotation.y = st.rotY;
      if (Scene3D.preset.shadows) holder.traverse((o) => { if (o.isMesh) o.castShadow = true; });
      _sc.room.group.add(holder);
      _sc.pets[i] = { key, holder, inner };
    }
  },

  buildEquipmentModel(model, color) {
    const S = new _scSet();
    S.setBase(0, 0, 0, 0);
    _scEquipInto(S, model, color);
    const g = S.toGroup(true);
    g.userData.equipModel = model;
    return g;
  },
  disposeEquipmentModel(g) { g.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); },

  toScreen(v3) {
    const cam = Scene3D.camera, v = _sc.v.a;
    cam.updateMatrixWorld();
    v.copy(v3).applyMatrix4(cam.matrixWorldInverse);
    const behind = v.z >= 0;
    v.applyMatrix4(cam.projectionMatrix);
    const w = _sc.size.w, h = _sc.size.h;
    const x = (v.x * 0.5 + 0.5) * w, y = (-v.y * 0.5 + 0.5) * h;
    return { x, y, visible: !behind && Math.abs(v.x) <= 1.05 && Math.abs(v.y) <= 1.05 };
  },

  update(dt) {
    dt = Math.min(dt, 0.25);
    const t = (_sc.time += dt), r = _sc.room;
    // watchdog (auto quality)
    if (_sc.setting === 'auto') {
      const w = _sc.watch;
      w.t += dt; w.n++; w.sum += dt;
      if (w.t >= 4) {
        const avg = (w.sum / w.n) * 1000;
        if (avg > 30 && _sc.time - w.last >= 8 && Scene3D.quality !== 'low') {
          w.last = _sc.time;
          _scApplyQuality(Scene3D.quality === 'high' ? 'medium' : 'low');
          Bus.emit('toast', { text: 'Graphics lowered for smoother play', kind: 'info' });
        }
        w.t = 0; w.n = 0; w.sum = 0;
      }
    }
    if (!r) return;
    _sc.mats.emi.color.setScalar(0.92 + 0.08 * Math.sin(t * 3));
    for (const sp of _sc.labels) sp.position.y = sp.userData.y0 + Math.sin(t * 1.6 + sp.userData.ph) * 0.09;
    if (_sc.portal) {
      _sc.portal.uni.uT.value = t;
      if (!_sc.portal.nxt) { const c = new THREE.Color().setHSL((t * 0.12) % 1, 0.9, 0.6); _sc.portal.uni.uCol.value.copy(c); _sc.portal.ringMat.color.copy(c); }
    }
    if (r.anim) r.anim.uni.uT.value = t;
    if (_sc.kioskMat) _sc.kioskMat.color.setScalar(0.88 + 0.12 * Math.sin(t * 2.2));
    for (const P of r.particles) {
      const pos = P.pos, n = pos.length / 3, o = P.o;
      if (P.mode === 'stars') { P.pts.material.opacity = 0.75 + 0.25 * Math.sin(t * 1.3); continue; }
      for (let i = 0; i < n; i++) {
        const s0 = P.seed[i * 3], s1 = P.seed[i * 3 + 1], s2 = P.seed[i * 3 + 2], k = i * 3;
        if (P.mode === 'fall') {
          pos[k + 1] -= (o.speed || 0.5) * s1 * dt;
          pos[k] += Math.sin(t * s1 + s0) * (o.sway || 0.2) * dt;
          if (pos[k + 1] < 0) { pos[k + 1] = o.y1; pos[k] = randRange(-ROOM.halfX, ROOM.halfX); pos[k + 2] = randRange(-ROOM.halfZ, ROOM.halfZ); }
        } else {
          pos[k] += Math.cos(t * 0.5 * s1 + s0) * 0.35 * dt + (o.drift ? 0.25 * dt : 0);
          pos[k + 1] += Math.sin(t * 0.7 * s1 + s0 * 2) * 0.25 * dt;
          pos[k + 2] += Math.sin(t * 0.4 * s1 + s0 * 3) * 0.3 * dt;
          if (pos[k] > ROOM.halfX) pos[k] = -ROOM.halfX;
          pos[k + 1] = clamp(pos[k + 1], o.y0, o.y1);
        }
      }
      P.pts.geometry.attributes.position.needsUpdate = true;
    }
    for (const p of _sc.pets) if (p) { try { AnimalFactory.animate(p.inner, t, 'idle', dt); } catch (e) { /* ignore */ } }
  },

  render() {
    if (_sc.ready) Scene3D.renderer.render(Scene3D.scene, Scene3D.camera);
  },
};
