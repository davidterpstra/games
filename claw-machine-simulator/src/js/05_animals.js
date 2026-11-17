/* =====================================================================
   05_animals.js — procedural chibi plush animals (AnimalFactory) and the
   spinning pet viewer (PetViewer). See ARCHITECTURE.md sections 4 + 6.
   Everything is created lazily; nothing runs at load time.
   Design space: unit coordinates, total height ~1, front = +Z, origin at the
   bottom centre. Geometry is baked at scale (2 * radius) and cached per animal.
   ===================================================================== */

/* ---------- lazy shared state ---------- */
const _anS = { ready: false };      // temporaries + shared objects
const _anGeoCache = {};             // animalId -> { body, head, extra, meta }
const _anUnit = {};                 // unit primitive geometries
const _anMats = {};                 // shared body materials
const _anFxMats = {};               // shared fx materials
const _anFxGeos = {};               // shared fx geometries
const _anTex = {};                  // shared canvas textures
const _anThumbs = {};               // 'id:variant' -> dataURL
const _anR = { thumb: null, view: null, thumbScene: null };

function _anInit() {
  if (_anS.ready) return _anS;
  _anS.ready = true;
  _anS.m = new THREE.Matrix4();
  _anS.nm = new THREE.Matrix3();
  _anS.q = new THREE.Quaternion();
  _anS.q2 = new THREE.Quaternion();
  _anS.qi = new THREE.Quaternion();
  _anS.e = new THREE.Euler();
  _anS.p = new THREE.Vector3();
  _anS.s = new THREE.Vector3();
  _anS.v = new THREE.Vector3();
  _anS.n = new THREE.Vector3();
  _anS.up = new THREE.Vector3(0, 1, 0);
  _anS.fwd = new THREE.Vector3(0, 0, 1);
  _anS.zax = new THREE.Vector3(0, 0, 1);
  _anS.v2 = new THREE.Vector2();
  _anS.colCache = {};
  return _anS;
}

function _anRng(str) {
  let hsh = 2166136261;
  for (let i = 0; i < str.length; i++) hsh = Math.imul(hsh ^ str.charCodeAt(i), 16777619);
  return function () {
    hsh += 0x6D2B79F5;
    let t = Math.imul(hsh ^ (hsh >>> 15), 1 | hsh);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function _anCol(hex, fb) {
  const T = _anInit();
  const key = typeof hex === 'string' ? hex : (fb || '#cccccc');
  let c = T.colCache[key];
  if (!c) {
    c = new THREE.Color();
    try { c.set(key); } catch (e) { c.set(fb || '#cccccc'); }
    T.colCache[key] = c;
  }
  return c;
}
function _anMix(a, b, t) { return a.clone().lerp(b, t); }
function _anLum(c) { return 0.299 * c.r + 0.587 * c.g + 0.114 * c.b; }
const _anWhite = () => _anCol('#ffffff');
const _anBlack = () => _anCol('#000000');
const _anDark = () => _anCol('#2a2631');

function _anUnitGeo(kind) {
  let g = _anUnit[kind];
  if (g) return g;
  switch (kind) {
    case 'sph': g = new THREE.SphereGeometry(1, 12, 9); break;
    case 'sph8': g = new THREE.SphereGeometry(1, 8, 6); break;
    case 'cone': g = new THREE.ConeGeometry(1, 1, 9, 1); break;
    case 'cyl': g = new THREE.CylinderGeometry(1, 1, 1, 10, 1); break;
    case 'oct': g = new THREE.OctahedronGeometry(1, 0); break;
    default: g = new THREE.SphereGeometry(1, 10, 8);
  }
  _anUnit[kind] = g;
  return g;
}

/* ---------- geometry builder / merger ---------- */
function _anBuilder() { return { pos: [], nor: [], col: [], tint: [], idx: [], n: 0 }; }

function _anPush(b, geo, m4, col, tint) {
  const T = _anInit();
  const pa = geo.attributes.position, na = geo.attributes.normal, ix = geo.index;
  T.nm.getNormalMatrix(m4);
  const v = T.v, base = b.n;
  for (let i = 0; i < pa.count; i++) {
    v.fromBufferAttribute(pa, i).applyMatrix4(m4);
    b.pos.push(v.x, v.y, v.z);
    v.fromBufferAttribute(na, i).applyMatrix3(T.nm).normalize();
    b.nor.push(v.x, v.y, v.z);
    b.col.push(col.r, col.g, col.b);
    b.tint.push(tint);
  }
  if (ix) for (let i = 0; i < ix.count; i++) b.idx.push(base + ix.getX(i));
  else for (let i = 0; i < pa.count; i++) b.idx.push(base + i);
  b.n += pa.count;
}

function _anToGeometry(b) {
  if (!b || b.n === 0) return null;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(b.pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(b.nor, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(b.col, 3));
  g.setAttribute('aTint', new THREE.Float32BufferAttribute(b.tint, 1));
  g.setIndex(b.n > 65535 ? new THREE.Uint32BufferAttribute(b.idx, 1) : new THREE.Uint16BufferAttribute(b.idx, 1));
  g.computeBoundingSphere();
  g.computeBoundingBox();
  return g;
}

/* A "part" writes into one builder, with its own origin (ox,oy,oz) in unit space and scale k. */
function _anPart(b, k, ox, oy, oz) {
  const T = _anInit();
  const P = {
    put(g, x, y, z, sx, sy, sz, q, col, tint) {
      T.p.set((x + ox) * k, (y + oy) * k, (z + oz) * k);
      T.s.set(sx * k, sy * k, sz * k);
      T.m.compose(T.p, q || T.qi, T.s);
      _anPush(b, g, T.m, col, tint === undefined ? 1 : tint);
    },
    eul(rot) { return rot ? T.q.setFromEuler(T.e.set(rot[0], rot[1], rot[2])) : null; },
    ell(x, y, z, rx, ry, rz, col, tint, rot) {
      const big = Math.max(rx, ry, rz) * k > 0.05;
      this.put(_anUnitGeo(big ? 'sph' : 'sph8'), x, y, z, rx, ry, rz, this.eul(rot), col, tint);
    },
    cone(x, y, z, r, h, col, tint, rot) { this.put(_anUnitGeo('cone'), x, y, z, r, h, r, this.eul(rot), col, tint); },
    coneDir(x, y, z, r, h, dx, dy, dz, col, tint) {
      T.n.set(dx, dy, dz).normalize();
      T.q.setFromUnitVectors(T.up, T.n);
      this.put(_anUnitGeo('cone'), x, y, z, r, h, r, T.q, col, tint);
    },
    cyl(x, y, z, r, h, col, tint, rot) { this.put(_anUnitGeo('cyl'), x, y, z, r, h, r, this.eul(rot), col, tint); },
    oct(x, y, z, rx, ry, rz, col, tint, rot) { this.put(_anUnitGeo('oct'), x, y, z, rx, ry, rz, this.eul(rot), col, tint); },
    rod(x1, y1, z1, x2, y2, z2, r, col, tint) {
      const dx = x2 - x1, dy = y2 - y1, dz = z2 - z1;
      const len = Math.sqrt(dx * dx + dy * dy + dz * dz) || 0.001;
      T.n.set(dx / len, dy / len, dz / len);
      T.q.setFromUnitVectors(T.up, T.n);
      this.put(_anUnitGeo('cyl'), (x1 + x2) / 2, (y1 + y2) / 2, (z1 + z2) / 2, r, len, r, T.q, col, tint);
    },
    /** Torus in the local XY plane, radius 1 scaled (sx,sy,sz); optional start angle baked in. */
    torS(x, y, z, tube, arc, start, sx, sy, sz, rot, col, tint) {
      const g = new THREE.TorusGeometry(1, tube, 5, 22, arc);
      if (start) g.rotateZ(start);
      this.put(g, x, y, z, sx, sy, sz, this.eul(rot), col, tint);
      g.dispose();
    },
    /** Primitive laid on an ellipsoid surface (centre c, radii R) in direction d, local +Z = surface normal. */
    surf(geo, c, R, dx, dy, dz, sx, sy, sz, lift, col, tint, roll) {
      const l = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
      dx /= l; dy /= l; dz /= l;
      const px = c[0] + R[0] * dx, py = c[1] + R[1] * dy, pz = c[2] + R[2] * dz;
      T.n.set(dx / R[0], dy / R[1], dz / R[2]).normalize();
      T.q.setFromUnitVectors(T.fwd, T.n);
      if (roll) { T.q2.setFromAxisAngle(T.zax, roll); T.q.multiply(T.q2); }
      this.put(geo, px + T.n.x * lift, py + T.n.y * lift, pz + T.n.z * lift, sx, sy, sz, T.q, col, tint);
    },
    disc(c, R, dx, dy, dz, sx, sy, sz, lift, col, tint) {
      this.surf(_anUnitGeo(Math.max(sx, sy) * k > 0.05 ? 'sph' : 'sph8'), c, R, dx, dy, dz, sx, sy, sz, lift, col, tint);
    },
  };
  return P;
}

/* unit direction on the front hemisphere from screen-ish offsets */
function _anFront(dx, dy) { return [dx, dy, Math.sqrt(Math.max(0.02, 1 - dx * dx - dy * dy))]; }
function _anPt(c, R, dx, dy, dz) {
  const l = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
  return [c[0] + R[0] * dx / l, c[1] + R[1] * dy / l, c[2] + R[2] * dz / l];
}

/* ---------- layouts ---------- */
const _anTYPES = {
  quad:  { bc: [0, 0.31, -0.05], br: [0.28, 0.23, 0.32], hc: [0, 0.62, 0.1], hr: [0.34, 0.3, 0.3], tail: [0, 0.36, -0.36] },
  biped: { bc: [0, 0.3, 0], br: [0.22, 0.22, 0.2], hc: [0, 0.66, 0.03], hr: [0.33, 0.3, 0.29], tail: [0, 0.2, -0.2] },
  bird:  { bc: [0, 0.3, 0], br: [0.3, 0.28, 0.29], hc: [0, 0.63, 0.05], hr: [0.29, 0.26, 0.26], tail: [0, 0.3, -0.3] },
  round: { bc: [0, 0.29, 0], br: [0.37, 0.3, 0.35], hc: [0, 0.6, 0.03], hr: [0.35, 0.3, 0.32], tail: [0, 0.27, -0.35] },
  snake: { bc: [0, 0.2, 0], br: [0.3, 0.12, 0.3], hc: [0, 0.66, 0.04], hr: [0.3, 0.26, 0.28], tail: [0.3, 0.1, 0.1] },
  fish:  { bc: [0, 0.47, -0.17], br: [0.27, 0.31, 0.42], hc: [0, 0.49, 0.2], hr: [0.31, 0.29, 0.27], tail: [0, 0.47, -0.55] },
  bug:   { bc: [0, 0.29, -0.08], br: [0.31, 0.24, 0.36], hc: [0, 0.57, 0.2], hr: [0.29, 0.25, 0.25], tail: [0, 0.27, -0.42] },
};
const _anTAILTIP = {
  puff: [0, 0.08, -0.05], long: [0, 0.3, -0.22], fluffy: [0, 0.22, -0.17], curl: [0, 0.1, -0.05],
  fin: [0, 0.1, -0.2], stinger: [0, 0.02, -0.26], none: [0, 0.1, 0],
};

function _anFallbackDef() {
  return {
    id: '__fallback', name: 'Plush', rarity: 'common', size: 1, body: 'quad',
    colors: { main: '#b9bac4', accent: '#9a9ba8', belly: '#e4e4ea', eye: '#2a2a35' },
    ears: 'round', tail: 'puff', pattern: 'none', extras: [],
  };
}
function _anDef(id) {
  let a = null;
  try { a = (typeof ANIMAL_BY_ID !== 'undefined' && ANIMAL_BY_ID) ? ANIMAL_BY_ID[id] : null; } catch (e) { a = null; }
  return a || null;
}
function _anRadius(def) {
  const s = def && typeof def.size === 'number' && isFinite(def.size) ? def.size : 1;
  return clamp(0.22 * s, 0.17, 0.30);
}

/* ---------- the big builder ---------- */
function _anBuildGeo(def, key) {
  const rng = _anRng(key);
  const R = _anRadius(def);
  const k = 2 * R;
  const type = _anTYPES[def.body] ? def.body : 'quad';
  const S = _anTYPES[type];
  const colors = def.colors || {};
  const cM = _anCol(colors.main, '#b9bac4');
  const cA = _anCol(colors.accent, '#9a9ba8');
  const cB = _anCol(colors.belly, '#e8e8ee');
  const cE = _anCol(colors.eye, '#24232e');
  const ex = Array.isArray(def.extras) ? def.extras : [];
  const has = (n) => ex.indexOf(n) >= 0;
  const ears = def.ears || 'none', tail = def.tail || 'none', pattern = def.pattern || 'none';
  const dark = _anDark();
  const pink = _anCol('#ff8fa6');
  const noseC = _anCol('#3a2a30');
  const whisk = _anLum(cM) > 0.45 ? _anCol('#4a4552') : _anCol('#ffffff');

  const bc = S.bc, br = S.br, hc = S.hc, hr = S.hr;
  const isBird = type === 'bird', isFish = type === 'fish', isSnake = type === 'snake', isBug = type === 'bug';
  const hasBeak = isBird || has('beak');
  const wingsAny = isBird || has('wings');
  const finsAny = isFish || has('fins');
  const hasFlap = wingsAny || finsAny;
  const flapPivot = [0, bc[1] + 0.06, bc[2]];
  const legType = hasFlap ? null : (type === 'quad' || type === 'biped' || type === 'round' || isBug ? type : null);
  const hipY = 0.2;

  const bB = _anBuilder(), hB = _anBuilder(), xB = _anBuilder();
  const B = _anPart(bB, k, 0, 0, 0);
  const H = _anPart(hB, k, 0, 0, 0);   // head parts use head-local coordinates
  let X = null, xPivot = [0, 0, 0];
  if (hasFlap) { xPivot = flapPivot; X = _anPart(xB, k, -xPivot[0], -xPivot[1], -xPivot[2]); }
  else if (legType) { xPivot = [0, hipY, 0]; X = _anPart(xB, k, 0, -hipY, 0); }
  const L = X && !hasFlap ? X : B;   // where legs go

  /* ===== BODY ===== */
  if (isSnake) {
    const N = 20;
    let last = null;
    for (let i = 0; i < N; i++) {
      const s = i / (N - 1);
      const ang = Math.PI * 0.5 + s * Math.PI * 3;
      const rr = 0.35 - 0.17 * s;
      const x = Math.cos(ang) * rr, z = Math.sin(ang) * rr * 0.95, y = 0.09 + 0.2 * s;
      const sr = 0.075 + 0.075 * Math.pow(s, 0.8);
      const col = i % 2 ? _anMix(cM, cB, 0.28) : cM;
      B.ell(x, y, z, sr, sr * 0.95, sr, col, 1);
      last = [x, y, z, sr];
    }
    for (let i = 1; i <= 4; i++) {
      const s = i / 4;
      const col = i % 2 ? _anMix(cM, cB, 0.28) : cM;
      B.ell(last[0] * (1 - s) * 0.9, last[1] + (0.5 - last[1]) * s, last[2] + (-0.02 - last[2]) * s, 0.145, 0.15, 0.145, col, 1);
    }
    // chin/belly
    B.ell(0, 0.6, 0.06, 0.15, 0.1, 0.16, cB, 1);
  } else {
    B.ell(bc[0], bc[1], bc[2], br[0], br[1], br[2], cM, 1);
    // belly patch (front/bottom)
    if (type !== 'bug') {
      const bf = isFish ? [0, -0.06, 0.02, 0.8, 0.82, 0.98] : [0, -0.035, br[2] * 0.2, 0.78, 0.76, 0.98];
      B.ell(bc[0] + bf[0], bc[1] + bf[1], bc[2] + bf[2], br[0] * bf[3], br[1] * bf[4], br[2] * bf[5], cB, 1);
    }
    if (isBug) B.ell(bc[0], bc[1], bc[2], 0.014, br[1] * 1.03, br[2] * 1.03, dark, 0.4);   // wing-case seam
  }

  /* ===== PATTERN ===== */
  if (!isSnake) {
    if (pattern === 'spots') {
      const n = isBug ? 6 : 5;
      for (let i = 0; i < n; i++) {
        let dx = rng() * 2 - 1, dy = 0.15 + rng() * 0.85, dz = rng() * 1.5 - 1.1;
        if (isBug) dz = rng() * 1.6 - 0.9;
        const sz = 0.05 + rng() * 0.04 + (isBug ? 0.02 : 0);
        B.disc(bc, br, dx, dy, dz, sz, sz, sz * 0.45, 0.0, cA, 1);
      }
      H.disc([0, 0, 0], hr, -0.45, 0.8, 0.35, 0.05, 0.05, 0.02, 0.0, cA, 1);
      H.disc([0, 0, 0], hr, 0.55, 0.65, 0.4, 0.04, 0.04, 0.02, 0.0, cA, 1);
    } else if (pattern === 'stripes') {
      const zs = isFish ? [-0.5, -0.22, 0.05] : [-0.55, -0.15, 0.25];
      for (let i = 0; i < zs.length; i++) {
        const dz = zs[i] * br[2];
        const f = Math.sqrt(Math.max(0.05, 1 - zs[i] * zs[i]));
        B.torS(bc[0], bc[1], bc[2] + dz, 0.11, Math.PI * 1.3, -0.15 * Math.PI, br[0] * f * 1.0, br[1] * f * 1.0, 0.04, null, cA, 1);
      }
      // forehead bars
      H.disc([0, 0, 0], hr, 0, 0.62, 0.7, 0.028, 0.075, 0.02, 0.0, cA, 1);
      H.disc([0, 0, 0], hr, 0.3, 0.6, 0.66, 0.024, 0.06, 0.02, 0.0, cA, 1);
      H.disc([0, 0, 0], hr, -0.3, 0.6, 0.66, 0.024, 0.06, 0.02, 0.0, cA, 1);
    } else if (pattern === 'patch') {
      B.disc(bc, br, 0.85, 0.3, -0.15, 0.17, 0.14, 0.07, -0.005, cA, 1);
      B.disc(bc, br, -0.5, 0.75, -0.55, 0.11, 0.09, 0.05, -0.005, cA, 1);
      const d = _anFront(0.56, 0.12);
      H.disc([0, 0, 0], hr, d[0], d[1], d[2], 0.14, 0.13, 0.07, -0.005, cA, 1);
    }
  }

  /* ===== LEGS / LIMBS ===== */
  if (type === 'quad') {
    const lc = cM;
    for (const sx of [-1, 1]) for (const sz of [0.16, -0.2]) {
      L.ell(sx * 0.15, 0.1, sz, 0.095, 0.11, 0.105, lc, 1);
      L.ell(sx * 0.15, 0.035, sz + 0.035, 0.07, 0.04, 0.07, cB, 0.6);   // paw pad
    }
  } else if (type === 'biped') {
    for (const sx of [-1, 1]) {
      L.ell(sx * 0.11, 0.09, 0.03, 0.1, 0.1, 0.125, cM, 1);
      L.ell(sx * 0.11, 0.035, 0.07, 0.075, 0.04, 0.085, cB, 0.6);
      L.ell(sx * 0.27, 0.33, 0.03, 0.075, 0.13, 0.085, cM, 1, [0, 0, sx * -0.4]);
      L.ell(sx * 0.31, 0.24, 0.05, 0.06, 0.05, 0.06, cB, 0.6);
    }
  } else if (type === 'round') {
    for (const sx of [-1, 1]) L.ell(sx * 0.15, 0.05, 0.14, 0.105, 0.06, 0.13, cA, 1);
  } else if (isBug) {
    for (const sx of [-1, 1]) for (const z of [0.12, -0.06, -0.24]) {
      L.rod(sx * 0.26, 0.2, z, sx * 0.44, 0.04, z + 0.05, 0.026, cA, 1);
      L.ell(sx * 0.45, 0.03, z + 0.055, 0.04, 0.025, 0.05, cA, 1);
    }
  } else if (isBird) {
    for (const sx of [-1, 1]) {
      B.rod(sx * 0.1, 0.1, 0, sx * 0.1, 0.02, 0.01, 0.025, cA, 1);
      B.ell(sx * 0.1, 0.022, 0.07, 0.075, 0.03, 0.1, cA, 1);
    }
  }

  /* ===== TAIL ===== */
  const ta = S.tail;
  if (!isSnake || tail !== 'none') {
    const a = ta;
    if (tail === 'puff') B.ell(a[0], a[1], a[2], 0.085, 0.085, 0.085, cB, 1);
    else if (tail === 'long') {
      const pts = [[0, 0, -0.06], [0, 0.06, -0.15], [0, 0.15, -0.21], [0, 0.26, -0.22]];
      for (let i = 0; i < pts.length; i++) B.ell(a[0] + pts[i][0], a[1] + pts[i][1], a[2] + pts[i][2], 0.055, 0.055, 0.055, i === 3 ? cA : cM, 1);
    } else if (tail === 'fluffy') {
      B.ell(a[0], a[1] + 0.09, a[2] - 0.08, 0.1, 0.16, 0.11, cM, 1, [0.5, 0, 0]);
      B.ell(a[0], a[1] + 0.2, a[2] - 0.16, 0.075, 0.09, 0.08, cA, 1, [0.5, 0, 0]);
    } else if (tail === 'curl') {
      B.torS(a[0], a[1] + 0.05, a[2] - 0.04, 0.2, Math.PI * 1.7, 0, 0.065, 0.065, 0.065, [0, Math.PI / 2, 0], cA, 1);
    } else if (tail === 'fin') {
      for (const s of [-1, 1]) B.ell(a[0], a[1] + s * 0.1, a[2] - 0.07, 0.035, 0.17, 0.14, cA, 1, [s * 0.55, 0, 0]);
      B.ell(a[0], a[1], a[2] + 0.04, 0.05, 0.07, 0.09, cA, 1);
    } else if (tail === 'stinger') {
      B.ell(a[0], a[1] + 0.01, a[2] + 0.04, 0.09, 0.085, 0.1, cA, 1);
      B.coneDir(a[0], a[1] + 0.0, a[2] - 0.1, 0.06, 0.2, 0, 0.12, -1, dark, 0.3);
    }
  }
  if (isFish) {   // dorsal fin
    B.ell(0, bc[1] + br[1] * 0.92 + 0.05, bc[2] - 0.03, 0.03, 0.14, 0.17, cA, 1, [-0.35, 0, 0]);
  }
  if (has('fins') && !isFish) B.ell(0, bc[1] + br[1] * 0.92 + 0.05, bc[2] - 0.03, 0.03, 0.13, 0.15, cA, 1, [-0.35, 0, 0]);

  /* ===== BODY EXTRAS ===== */
  if (has('shell')) {
    const sc = [bc[0], bc[1] + 0.1, bc[2] - 0.03], sr = [br[0] * 1.1, br[1] * 0.95, br[2] * 1.06];
    B.ell(sc[0], sc[1], sc[2], sr[0], sr[1], sr[2], cA, 1);
    const plate = _anMix(cA, _anWhite(), 0.28);
    const ds = [[0, 1, 0, 0.1], [0.62, 0.7, 0.1, 0.075], [-0.62, 0.7, 0.1, 0.075], [0.3, 0.55, -0.7, 0.07], [-0.3, 0.55, -0.7, 0.07], [0.35, 0.5, 0.75, 0.065], [-0.35, 0.5, 0.75, 0.065]];
    for (const d of ds) B.disc(sc, sr, d[0], d[1], d[2], d[3], d[3], d[3] * 0.4, -0.004, plate, 1);
    B.torS(sc[0], sc[1] - 0.04, sc[2], 0.06, Math.PI * 2, 0, sr[0] * 0.98, sr[2] * 0.98, 0.05, [Math.PI / 2, 0, 0], _anMix(cA, _anBlack(), 0.25), 1);
  }
  if (has('scarf')) {
    const ny = hc[1] - hr[1] * 0.74, nz = hc[2] - 0.03;
    B.torS(0, ny, nz, 0.3, Math.PI * 2, 0, 0.21, 0.21, 0.17, [Math.PI / 2, 0, 0], cA, 0.6);
    B.ell(0.1, ny - 0.1, nz + 0.17, 0.065, 0.13, 0.03, cA, 0.6, [0, 0, -0.2]);
    B.ell(0.13, ny - 0.2, nz + 0.17, 0.06, 0.05, 0.028, _anMix(cA, _anWhite(), 0.3), 0.6, [0, 0, -0.2]);
  }
  if (has('crystal')) {
    const cc = _anMix(cA, _anWhite(), 0.25);
    const bx = 0, by = bc[1] + br[1] * 0.85, bz = bc[2] - 0.08;
    B.oct(bx, by + 0.12, bz, 0.07, 0.19, 0.07, cc, 0.25, [0, 0.4, 0]);
    B.oct(bx + 0.11, by + 0.05, bz + 0.03, 0.05, 0.13, 0.05, cc, 0.25, [0, 0.2, -0.45]);
    B.oct(bx - 0.11, by + 0.04, bz + 0.02, 0.05, 0.12, 0.05, cc, 0.25, [0, 0.9, 0.45]);
  }
  if (has('flame')) {
    const tp = _anTAILTIP[tail] || _anTAILTIP.puff;
    const fx0 = tail === 'none' ? 0 : ta[0] + tp[0], fy0 = tail === 'none' ? 0 : ta[1] + tp[1] + 0.02, fz0 = tail === 'none' ? 0 : ta[2] + tp[2];
    const o = _anCol('#ff8a1f'), y = _anCol('#ffd23f');
    const fl = (P, ox, oy, oz) => {
      P.coneDir(ox, oy + 0.1, oz, 0.095, 0.24, 0, 1, -0.2, o, 0);
      P.coneDir(ox + 0.07, oy + 0.06, oz, 0.06, 0.15, 0.4, 1, -0.2, o, 0);
      P.coneDir(ox - 0.07, oy + 0.06, oz, 0.06, 0.15, -0.4, 1, -0.2, o, 0);
      P.coneDir(ox, oy + 0.08, oz + 0.02, 0.05, 0.15, 0, 1, -0.2, y, 0);
    };
    if (tail === 'none') fl(H, 0, hr[1] * 0.92, -0.02); else fl(B, fx0, fy0, fz0);
  }

  /* ===== HEAD ===== */
  const hcen = [0, 0, 0];
  H.ell(0, 0, 0, hr[0], hr[1], hr[2], cM, 1);
  // cheeks/chin lightening for round plush shape
  if (!isSnake && !isFish && !isBug && !isBird && type !== 'round' && !has('snout')) {
    H.ell(0, -hr[1] * 0.2, hr[2] * 0.15, hr[0] * 0.88, hr[1] * 0.86, hr[2] * 0.9, cM, 1);
  }

  // ears
  const ep = (dx, dy, dz) => _anPt(hcen, hr, dx, dy, dz);
  for (const sx of [-1, 1]) {
    if (ears === 'round') {
      const p = ep(sx * 0.62, 0.8, 0.0);
      H.ell(p[0], p[1], p[2], 0.115, 0.115, 0.07, cM, 1, [0, sx * 0.4, 0]);
      H.ell(p[0] - sx * 0.005, p[1], p[2] + 0.03, 0.07, 0.07, 0.04, cA, 1, [0, sx * 0.4, 0]);
    } else if (ears === 'small') {
      const p = ep(sx * 0.7, 0.72, 0.0);
      H.ell(p[0], p[1], p[2], 0.07, 0.07, 0.05, cM, 1, [0, sx * 0.4, 0]);
    } else if (ears === 'pointy') {
      const p = ep(sx * 0.6, 0.78, 0.0);
      H.coneDir(p[0] + sx * 0.02, p[1] + 0.07, p[2], 0.115, 0.22, sx * 0.35, 1, 0, cM, 1);
      H.coneDir(p[0] + sx * 0.015, p[1] + 0.055, p[2] + 0.03, 0.07, 0.15, sx * 0.35, 1, 0, cA, 1);
    } else if (ears === 'long') {
      const p = ep(sx * 0.4, 0.9, 0.0);
      H.ell(p[0] + sx * 0.03, p[1] + 0.17, p[2], 0.075, 0.24, 0.05, cM, 1, [0, 0, -sx * 0.14]);
      H.ell(p[0] + sx * 0.03, p[1] + 0.16, p[2] + 0.025, 0.045, 0.19, 0.03, cA, 1, [0, 0, -sx * 0.14]);
    } else if (ears === 'floppy') {
      const p = ep(sx * 0.9, 0.45, 0.0);
      H.ell(p[0] + sx * 0.02, p[1] - 0.06, p[2], 0.075, 0.17, 0.11, cA, 1, [0, 0, sx * 0.25]);
    }
  }

  // head extras
  if (has('mane')) {
    for (let i = 0; i < 12; i++) {
      const a = i / 12 * Math.PI * 2;
      H.ell(Math.cos(a) * hr[0] * 0.98, Math.sin(a) * hr[1] * 0.98, -hr[2] * 0.2, 0.125, 0.125, 0.12, cA, 1);
    }
    for (let i = 0; i < 8; i++) {
      const a = i / 8 * Math.PI * 2 + 0.2;
      H.ell(Math.cos(a) * hr[0] * 0.8, Math.sin(a) * hr[1] * 0.8, hr[2] * 0.1, 0.1, 0.1, 0.1, _anMix(cA, cM, 0.3), 1);
    }
  }
  if (has('horn')) {
    H.coneDir(0, hr[1] * 0.9 + 0.1, hr[2] * 0.4, 0.06, 0.26, 0, 1, 0.3, cA, 0.5);
    for (let i = 0; i < 3; i++) H.torS(0, hr[1] * 0.9 + 0.045 + i * 0.07, hr[2] * 0.4 + 0.012 + i * 0.022, 0.2, Math.PI * 2, 0, 0.055 - i * 0.012, 0.055 - i * 0.012, 0.055 - i * 0.012, [Math.PI / 2 - 0.3, 0, 0], _anMix(cA, _anWhite(), 0.35), 0.5);
  }
  if (has('horns')) {
    for (const sx of [-1, 1]) {
      const p = ep(sx * 0.5, 0.82, 0.0);
      H.coneDir(p[0] + sx * 0.04, p[1] + 0.08, p[2], 0.065, 0.2, sx * 0.5, 1, -0.05, cA, 0.5);
      H.coneDir(p[0] + sx * 0.12, p[1] + 0.2, p[2], 0.045, 0.13, sx * 0.9, 0.7, -0.05, cA, 0.5);
    }
  }
  if (has('antlers')) {
    for (const sx of [-1, 1]) {
      const p = ep(sx * 0.32, 0.9, 0.0);
      const bx = p[0], by = p[1] - 0.02, bz = p[2];
      H.rod(bx, by, bz, bx + sx * 0.12, by + 0.24, bz - 0.02, 0.024, cA, 0.4);
      H.rod(bx + sx * 0.06, by + 0.12, bz - 0.01, bx + sx * 0.2, by + 0.2, bz - 0.01, 0.02, cA, 0.4);
      H.rod(bx + sx * 0.12, by + 0.24, bz - 0.02, bx + sx * 0.04, by + 0.34, bz - 0.02, 0.02, cA, 0.4);
      H.rod(bx + sx * 0.12, by + 0.24, bz - 0.02, bx + sx * 0.22, by + 0.33, bz - 0.02, 0.02, cA, 0.4);
    }
  }
  if (has('antennae')) {
    for (const sx of [-1, 1]) {
      const p = ep(sx * 0.35, 0.88, 0.25);
      H.rod(p[0], p[1], p[2], p[0] + sx * 0.12, p[1] + 0.2, p[2] + 0.03, 0.017, cA, 0.4);
      H.ell(p[0] + sx * 0.12, p[1] + 0.21, p[2] + 0.03, 0.045, 0.045, 0.045, cA, 0.4);
    }
  }
  const gold = _anCol('#ffcf33');
  if (has('crown')) {
    const cy = hr[1] * 0.93;
    H.cyl(0, cy + 0.03, -0.02, 0.135, 0.07, gold, 0, [0.1, 0, 0]);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      H.cone(Math.cos(a) * 0.115, cy + 0.1 + (Math.abs(Math.sin(a)) < 2 ? 0 : 0), -0.02 + Math.sin(a) * 0.115, 0.04, 0.1, gold, 0, null);
    }
    H.ell(0, cy + 0.035, 0.11, 0.032, 0.032, 0.02, _anCol('#ff4a6a'), 0);
  }
  if (has('hat')) {
    const cy = hr[1] * 0.9;
    H.cyl(0, cy + 0.02, -0.02, 0.2, 0.03, cA, 0.4, [0.1, 0, -0.12]);
    H.cyl(0.01, cy + 0.11, -0.02, 0.125, 0.19, cA, 0.4, [0.1, 0, -0.12]);
    H.cyl(0.005, cy + 0.06, -0.02, 0.129, 0.045, _anMix(cB, _anWhite(), 0.3), 0.2, [0.1, 0, -0.12]);
  }
  if (has('halo')) {
    H.torS(0, hr[1] + 0.2, -0.04, 0.17, Math.PI * 2, 0, 0.17, 0.17, 0.17, [Math.PI / 2 - 0.2, 0, 0], _anCol('#fff0a0'), 0);
  }
  if (has('star')) {
    const sh = new THREE.Shape();
    for (let i = 0; i < 10; i++) {
      const a = Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 0.037 : 0.08;
      if (i === 0) sh.moveTo(Math.cos(a) * r, Math.sin(a) * r); else sh.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    sh.closePath();
    const g = new THREE.ExtrudeGeometry(sh, { depth: 0.03, bevelEnabled: false });
    g.translate(0, 0, -0.015);
    const d = _anFront(0.0, 0.66);
    H.surf(g, hcen, hr, d[0], d[1], d[2], 1, 1, 1, 0.012, _anCol('#ffe14a'), 0.1);
    g.dispose();
  }

  /* ===== FACE ===== */
  const useBeak = hasBeak, hasSnout = has('snout');
  const er = clamp(hr[0] * 0.25, 0.06, 0.1);
  const ed = 0.43, ey = isFish ? 0.1 : 0.03;
  const eyeD = _anFront(ed, ey);
  const eyeLift = 0.0;
  const eyeCol = cE;
  if (has('mask')) {
    for (const sx of [-1, 1]) {
      const d = _anFront(sx * ed, ey);
      H.disc(hcen, hr, d[0], d[1], d[2], er * 1.75, er * 1.55, 0.04, -0.004, cA, 1);
    }
    const d = _anFront(0, ey + 0.02);
    H.disc(hcen, hr, d[0], d[1], d[2], er * 1.2, er * 0.95, 0.04, -0.004, cA, 1);
  }
  for (const sx of [-1, 1]) {
    const d = _anFront(sx * ed, ey);
    H.disc(hcen, hr, d[0], d[1], d[2], er, er * 1.18, er * 0.5, -0.004, eyeCol, 0);
    const d2 = _anFront(sx * ed + er * 0.5 / hr[0], ey + er * 0.55 / hr[1]);
    H.disc(hcen, hr, d2[0], d2[1], d2[2], er * 0.38, er * 0.38, er * 0.2, 0.006, _anWhite(), 0);
    const d3 = _anFront(sx * ed - er * 0.42 / hr[0], ey - er * 0.5 / hr[1]);
    H.disc(hcen, hr, d3[0], d3[1], d3[2], er * 0.2, er * 0.2, er * 0.12, 0.006, _anWhite(), 0);
  }
  if (!isFish) for (const sx of [-1, 1]) {
    const d = _anFront(sx * 0.76, -0.2);
    H.disc(hcen, hr, d[0], d[1], d[2], 0.07, 0.045, 0.02, -0.002, pink, 0);
  }
  // muzzle / snout / nose / mouth
  let noseP = null, mouthY = -0.36;
  if (useBeak) {
    if (isBird) {
      H.coneDir(0, -hr[1] * 0.2, hr[2] + 0.035, 0.085, 0.17, 0, -0.08, 1, cA, 0.5);
    } else {
      H.ell(0, -hr[1] * 0.25, hr[2] * 0.95, 0.15, 0.06, 0.15, cA, 0.5);
    }
    // keep mouth hidden under beak
    mouthY = 9;
  } else if (hasSnout) {
    H.ell(0, -hr[1] * 0.3, hr[2] * 0.8, hr[0] * 0.4, hr[1] * 0.29, hr[2] * 0.32, cB, 1);
    noseP = [0, -hr[1] * 0.2, hr[2] * 1.07];
    mouthY = -0.55;
    H.ell(noseP[0], noseP[1], noseP[2] - 0.01, 0.06, 0.042, 0.04, noseC, 0);
    for (const sx of [-1, 1]) H.ell(sx * 0.035, -hr[1] * 0.2 - 0.002, hr[2] * 1.095, 0.012, 0.012, 0.01, _anCol('#000000'), 0);
  } else if (!isFish && !isSnake) {
    const d = _anFront(0, -0.28);
    if (!isBug) H.disc(hcen, hr, d[0], d[1], d[2], 0.12, 0.085, 0.07, 0.0, cB, 1);
    const dn = _anFront(0, -0.19);
    H.disc(hcen, hr, dn[0], dn[1], dn[2], 0.05, 0.036, 0.03, 0.012, noseC, 0);
  } else {
    mouthY = -0.34;
  }
  if (mouthY < 5) {
    const mz = hasSnout ? 0 : 0;
    for (const sx of [-1, 1]) {
      const my = hasSnout ? mouthY : mouthY;
      const d = _anFront(sx * 0.07, my);
      if (isFish) H.disc(hcen, hr, 0, -0.4, 0.9, 0.04, 0.032, 0.03, 0, _anCol('#6a3a44'), 0);
      else H.surf(new THREE.TorusGeometry(1, 0.17, 4, 8, Math.PI), hcen, hr, d[0], d[1], d[2], 0.04, 0.04, 0.04, 0.0, noseC, 0, Math.PI);
    }
  }
  if (has('tusks')) {
    for (const sx of [-1, 1]) {
      const p = _anPt(hcen, hr, sx * 0.3, -0.52, 0.8);
      H.coneDir(p[0] + sx * 0.02, p[1] - 0.04, p[2] + 0.03, 0.04, 0.17, sx * 0.25, -1, 0.5, _anCol('#fff3dc'), 0.2);
    }
  }
  if (has('trunk')) {
    const z = hr[2];
    const pts = [[0.0, -0.02, z * 0.98, 0.105], [0, -0.1, z + 0.07, 0.095], [0, -0.2, z + 0.1, 0.085], [0, -0.3, z + 0.1, 0.078], [0, -0.38, z + 0.14, 0.072]];
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      H.ell(p[0], p[1], p[2], p[3], p[3] * 1.05, p[3], _anMix(cM, cA, i * 0.1), 1);
    }
    for (let i = 1; i < 4; i++) H.torS(0, pts[i][1], pts[i][2] - 0.01, 0.1, Math.PI * 2, 0, pts[i][3] * 0.98, pts[i][3] * 0.98, 0.5 * pts[i][3], [Math.PI / 2 - 0.2, 0, 0], _anMix(cM, _anBlack(), 0.12), 1);
  }
  if (has('whiskers')) {
    for (const sx of [-1, 1]) {
      const p = _anPt(hcen, hr, sx * 0.55, -0.3, 0.75);
      for (let j = -1; j <= 1; j++) {
        H.rod(p[0], p[1], p[2], p[0] + sx * 0.2, p[1] + j * 0.045 - 0.01, p[2] + 0.07, 0.0065, whisk, 0);
      }
    }
  }
  if (has('glasses')) {
    const fr = _anCol('#2b2a38');
    for (const sx of [-1, 1]) {
      const d = _anFront(sx * ed, ey);
      H.surf(new THREE.TorusGeometry(1, 0.1, 5, 18), hcen, hr, d[0], d[1], d[2], er * 1.5, er * 1.5, er * 1.5, 0.006, fr, 0);
    }
    const p = _anPt(hcen, hr, 0, ey + 0.02, 1);
    H.rod(-0.03, p[1], p[2] + 0.004, 0.03, p[1], p[2] + 0.004, 0.011, fr, 0);
    for (const sx of [-1, 1]) {
      const q1 = _anPt(hcen, hr, sx * 0.8, ey, 0.6);
      H.rod(q1[0], q1[1], q1[2], sx * hr[0] * 0.99, q1[1], 0, 0.011, fr, 0);
    }
  }
  if (has('beak') && !isBird) { /* flat bill handled above */ }

  /* ===== FLAPPERS (wings / fins) ===== */
  let wingForm = 0;
  if (hasFlap) {
    if (isBird) {
      for (const sx of [-1, 1]) {
        X.ell(sx * (br[0] + 0.02), 0.28, -0.02, 0.1, 0.2, 0.17, has('wings') ? cA : cA, 1, [0, 0, sx * 0.35]);
        X.ell(sx * (br[0] + 0.02), 0.19, 0.0, 0.07, 0.11, 0.12, _anMix(cA, cM, 0.4), 1, [0, 0, sx * 0.35]);
      }
      if (has('wings')) wingForm = 1;
    } else if (has('wings')) {
      wingForm = 1;
      for (const sx of [-1, 1]) {
        const wy = bc[1] + 0.13, wz = bc[2] - 0.17;
        X.ell(sx * 0.3, wy + 0.1, wz, 0.22, 0.17, 0.04, cA, 0.7, [0, sx * 0.6, sx * 0.45]);
        X.ell(sx * 0.36, wy + 0.13, wz - 0.07, 0.15, 0.1, 0.035, _anMix(cA, cB, 0.5), 0.7, [0, sx * 0.6, sx * 0.45]);
      }
    }
    if (finsAny) {
      for (const sx of [-1, 1]) {
        const fy = bc[1] - (isFish ? 0.04 : 0.02);
        X.ell(sx * (br[0] + 0.05), fy, bc[2] + 0.05, 0.14, 0.09, 0.05, cA, 1, [0, sx * 0.5, sx * 0.4]);
      }
    }
  }

  const geos = { body: _anToGeometry(bB), head: _anToGeometry(hB), extra: _anToGeometry(xB) };
  return {
    body: geos.body, head: geos.head, extra: geos.extra,
    meta: {
      k, R, type, cy: 0.5,
      headP: hc.slice(), xP: xPivot.slice(), extraKind: hasFlap ? 'flap' : (legType ? 'legs' : 'none'),
      hover: isBird || isFish || has('wings'),
    },
  };
}

/* ---------- materials ---------- */
function _anGradient() {
  if (_anTex.grad) return _anTex.grad;
  const t = new THREE.DataTexture(new Uint8Array([120, 175, 225, 255]), 4, 1, THREE.RedFormat);
  t.minFilter = THREE.NearestFilter; t.magFilter = THREE.NearestFilter; t.generateMipmaps = false;
  t.needsUpdate = true;
  _anTex.grad = t;
  return t;
}
function _anPatchMat(mat, kind, frag, emissive) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uAnTime = U.uTime;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aTint;\nvarying float vTint;\nvarying vec3 vAnPos;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvTint = aTint; vAnPos = position;');
    let f = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vTint;\nvarying vec3 vAnPos;\nuniform float uAnTime;')
      .replace('#include <color_fragment>', '#include <color_fragment>\n' + frag);
    if (emissive) f = f.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n' + emissive);
    sh.fragmentShader = f;
  };
  mat.customProgramCacheKey = () => 'an_' + kind;
}
function _anMaterial(variant) {
  let m = _anMats[variant];
  if (m) return m;
  if (variant === 'golden') {
    m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.32, metalness: 0.7 });
    _anPatchMat(m, 'gold',
      'float lm = dot(diffuseColor.rgb, vec3(0.299,0.587,0.114));\n' +
      'vec3 gd = vec3(1.0,0.66,0.16) * (0.5 + 1.0 * lm);\n' +
      'diffuseColor.rgb = mix(diffuseColor.rgb, gd, vTint * 0.9);',
      'totalEmissiveRadiance += vec3(0.5,0.3,0.04) * vTint;');
  } else if (variant === 'rainbow') {
    m = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: _anGradient() });
    _anPatchMat(m, 'rainbow',
      'float lm = dot(diffuseColor.rgb, vec3(0.299,0.587,0.114));\n' +
      'float hh = vAnPos.y * 5.0 + vAnPos.x * 3.0 + vAnPos.z * 2.0 - uAnTime * 0.35;\n' +
      'vec3 rc = 0.62 + 0.38 * cos(6.28318 * (hh + vec3(0.0,0.333,0.667)));\n' +
      'diffuseColor.rgb = mix(diffuseColor.rgb, rc * (0.75 + 0.5 * lm), vTint * 0.9);');
  } else {
    m = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: _anGradient() });
  }
  _anMats[variant] = m;
  return m;
}

/* ---------- FX ---------- */
function _anCanvasTex(key, size, draw) {
  if (_anTex[key]) return _anTex[key];
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c);
  _anTex[key] = t;
  return t;
}
function _anTexGlow() {
  return _anCanvasTex('glow', 128, (g, s) => {
    const gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.45)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, s, s);
  });
}
function _anTexStar() {
  return _anCanvasTex('star', 64, (g, s) => {
    const c = s / 2;
    const gr = g.createRadialGradient(c, c, 0, c, c, c);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.2, 'rgba(255,255,255,0.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, s, s);
    g.fillStyle = 'rgba(255,255,255,0.95)';
    g.beginPath();
    g.moveTo(c, 2); g.quadraticCurveTo(c + 3, c - 3, s - 2, c); g.quadraticCurveTo(c + 3, c + 3, c, s - 2);
    g.quadraticCurveTo(c - 3, c + 3, 2, c); g.quadraticCurveTo(c - 3, c - 3, c, 2); g.fill();
  });
}
function _anTexSwirl() {
  return _anCanvasTex('swirl', 128, (g, s) => {
    const c = s / 2;
    const gr = g.createRadialGradient(c, c, 0, c, c, c);
    gr.addColorStop(0, 'rgba(20,4,40,0.9)'); gr.addColorStop(0.55, 'rgba(60,14,100,0.55)'); gr.addColorStop(1, 'rgba(60,14,100,0)');
    g.fillStyle = gr; g.fillRect(0, 0, s, s);
    for (let arm = 0; arm < 3; arm++) {
      g.beginPath();
      for (let i = 0; i <= 40; i++) {
        const f = i / 40, a = arm * 2.094 + f * 4.2, r = f * c * 0.92;
        const x = c + Math.cos(a) * r, y = c + Math.sin(a) * r;
        if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
      }
      g.strokeStyle = 'rgba(190,110,255,0.55)'; g.lineWidth = 5; g.lineCap = 'round'; g.stroke();
    }
  });
}
function _anTexShadow() {
  return _anCanvasTex('shadow', 64, (g, s) => {
    const gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    gr.addColorStop(0, 'rgba(0,0,0,0.55)'); gr.addColorStop(0.6, 'rgba(0,0,0,0.22)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, s, s);
  });
}

const _anPtsVS = [
  'uniform float uTime; uniform float uViewH; uniform float uMode;',
  'attribute vec4 aS; varying float vA; varying float vH;',
  'void main(){',
  '  vec3 p = position; float ph = aS.x; float sp = aS.y; float sc = length(modelMatrix[0].xyz); float a;',
  '  if (uMode > 0.5) {',
  '    float ang = uTime * sp * 1.6 + ph * 6.2831; float r = length(p.xz);',
  '    p.x = cos(ang) * r; p.z = sin(ang) * r; p.y += sin(uTime * 2.0 + ph * 9.0) * 0.1;',
  '    a = 0.85 + 0.15 * sin(uTime * 4.0 + ph * 12.0);',
  '  } else {',
  '    float life = fract(uTime * sp * 0.22 + ph);',
  '    p.y += life * 0.5; a = sin(life * 3.14159); a *= a;',
  '    a *= 0.55 + 0.45 * sin(uTime * 7.0 + ph * 20.0);',
  '  }',
  '  vA = a; vH = ph;',
  '  vec4 mv = modelViewMatrix * vec4(p, 1.0);',
  '  gl_Position = projectionMatrix * mv;',
  '  gl_PointSize = min(80.0, aS.z * sc * uViewH * 0.5 * projectionMatrix[1][1] / max(0.05, -mv.z) * (0.45 + 0.55 * a));',
  '}',
].join('\n');
const _anPtsFS = [
  'uniform sampler2D uMap; uniform vec3 uColor; uniform float uRainbow; uniform float uTime;',
  'varying float vA; varying float vH;',
  'void main(){',
  '  vec4 t = texture2D(uMap, gl_PointCoord);',
  '  vec3 c = uColor;',
  '  if (uRainbow > 0.5) c = 0.6 + 0.4 * cos(6.28318 * (vH + uTime * 0.3 + vec3(0.0, 0.333, 0.667)));',
  '  gl_FragColor = vec4(c * 1.4, t.a * vA);',
  '  #include <colorspace_fragment>',
  '}',
].join('\n');

function _anPtsMat(hex, mode, rainbow) {
  const key = 'p:' + hex + ':' + mode + ':' + (rainbow ? 1 : 0);
  let m = _anFxMats[key];
  if (m) return m;
  m = new THREE.ShaderMaterial({
    uniforms: {
      uTime: U.uTime, uViewH: { value: 800 }, uMode: { value: mode }, uRainbow: { value: rainbow ? 1 : 0 },
      uColor: { value: new THREE.Color(hex) }, uMap: { value: mode > 0.5 ? _anTexGlow() : _anTexStar() },
    },
    vertexShader: _anPtsVS, fragmentShader: _anPtsFS,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  m.userData.obr = function (renderer) {
    renderer.getDrawingBufferSize(_anInit().v2);
    m.uniforms.uViewH.value = _anS.v2.y;
  };
  _anFxMats[key] = m;
  return m;
}
const _anPtsDefs = { sparkle: [7, 0.22, 0.4, 1.0, 1.35], light: [5, 0.16, 0.3, 0.8, 1.2], orbit: [5, 0.3, 0.3, 1.15, 1.3], big: [12, 0.2, 0.38, 0.8, 1.45] };
function _anPtsGeo(name) {
  let g = _anFxGeos[name];
  if (g) return g;
  const d = _anPtsDefs[name] || _anPtsDefs.sparkle;
  const n = d[0], rng = _anRng('fx' + name);
  const pos = new Float32Array(n * 3), as = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) {
    const a = rng() * Math.PI * 2;
    const r = d[3] + rng() * (d[4] - d[3]);
    const y = name === 'orbit' ? (i / n - 0.5) * 1.5 : (rng() - 0.35) * 1.5;
    pos[i * 3] = Math.cos(a) * r; pos[i * 3 + 1] = y; pos[i * 3 + 2] = Math.sin(a) * r;
    as[i * 4] = rng(); as[i * 4 + 1] = 0.7 + rng() * 0.8; as[i * 4 + 2] = d[2] * (0.7 + rng() * 0.6); as[i * 4 + 3] = 0;
  }
  g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aS', new THREE.BufferAttribute(as, 4));
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 3);
  _anFxGeos[name] = g;
  return g;
}
function _anBeamMat(hex) {
  const key = 'b:' + hex;
  if (_anFxMats[key]) return _anFxMats[key];
  const m = new THREE.ShaderMaterial({
    uniforms: { uTime: U.uTime, uColor: { value: new THREE.Color(hex) } },
    vertexShader: 'varying vec2 vUv; varying vec3 vN; varying vec3 vV; void main(){ vUv = uv; vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'uniform vec3 uColor; uniform float uTime; varying vec2 vUv; varying vec3 vN; varying vec3 vV;\n' +
      'void main(){ float h = vUv.y; float a = (1.0 - h); a = a * a * (0.65 + 0.25 * sin(uTime * 3.0 + h * 5.0));\n' +
      'float e = pow(abs(dot(normalize(vN), normalize(vV))), 1.3); a *= e * (0.9 + 0.1 * sin(vUv.x * 40.0 + uTime * 2.0));\n' +
      'gl_FragColor = vec4(uColor * 1.3, a * 0.75);\n#include <colorspace_fragment>\n}',
    transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
  });
  _anFxMats[key] = m;
  return m;
}
function _anSpriteMat(kind, hex) {
  const key = 's:' + kind + ':' + hex;
  if (_anFxMats[key]) return _anFxMats[key];
  let m;
  if (kind === 'void') {
    m = new THREE.SpriteMaterial({ map: _anTexSwirl(), transparent: true, depthWrite: false, opacity: 0.9 });
  } else {
    m = new THREE.SpriteMaterial({ map: _anTexGlow(), color: new THREE.Color(hex), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.8 });
  }
  _anFxMats[key] = m;
  return m;
}
function _anShineMat(hex) {
  const key = 'd:' + hex;
  if (_anFxMats[key]) return _anFxMats[key];
  const m = new THREE.MeshBasicMaterial({ map: _anTexGlow(), color: new THREE.Color(hex), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.75 });
  _anFxMats[key] = m;
  return m;
}
function _anGroundGeo() {
  if (_anFxGeos.ground) return _anFxGeos.ground;
  const g = new THREE.PlaneGeometry(1, 1); g.rotateX(-Math.PI / 2);
  _anFxGeos.ground = g;
  return g;
}
function _anBeamGeo() {
  if (_anFxGeos.beam) return _anFxGeos.beam;
  const g = new THREE.CylinderGeometry(0.34, 0.6, 1, 16, 1, true);
  _anFxGeos.beam = g;
  return g;
}

function _anBuildFx(kind, variant, R, hex, rand) {
  const grp = new THREE.Group();
  grp.name = 'an_fx';
  let any = false, spr = null, sprBase = 0, voidSpr = false;
  const addPts = (geoName, color, mode, rainbow) => {
    const m = _anPtsMat(color, mode, rainbow);
    const pts = new THREE.Points(_anPtsGeo(geoName), m);
    pts.position.y = R; pts.scale.setScalar(R); pts.rotation.y = rand() * Math.PI * 2;
    pts.frustumCulled = false; pts.renderOrder = 6; pts.onBeforeRender = m.userData.obr;
    grp.add(pts); any = true;
  };
  const addSprite = (sk, size, z) => {
    spr = new THREE.Sprite(_anSpriteMat(sk, hex));
    spr.position.set(0, R, z * R); spr.scale.set(size * R, size * R, 1);
    sprBase = size * R; spr.renderOrder = -1; grp.add(spr); any = true;
  };
  switch (kind) {
    case 'shine': {
      const m = new THREE.Mesh(_anGroundGeo(), _anShineMat(hex));
      m.position.y = 0.012; m.scale.set(R * 3.4, 1, R * 3.4); m.renderOrder = -1; grp.add(m); any = true; break;
    }
    case 'sparkle': addPts('sparkle', hex, 0, false); break;
    case 'aura': addSprite('aura', 4.4, -0.45); addPts('sparkle', hex, 0, false); break;
    case 'beam': {
      const m = new THREE.Mesh(_anBeamGeo(), _anBeamMat(hex));
      m.position.y = R * 2.5; m.scale.set(R, R * 5, R); m.renderOrder = -1; grp.add(m); any = true;
      addPts('sparkle', hex, 0, false); break;
    }
    case 'orbit': addPts('orbit', hex, 1, false); break;
    case 'void': addSprite('void', 4.6, -0.45); voidSpr = true; addPts('big', '#c58bff', 0, true); break;
    default: break;
  }
  if (kind === 'none' || kind === 'shine') {
    if (variant === 'golden') addPts('light', '#ffd24a', 0, false);
    else if (variant === 'rainbow') addPts('light', '#ffffff', 0, true);
  }
  return any ? { grp, spr, sprBase, voidSpr } : null;
}

/* ---------- public: AnimalFactory ---------- */
const AnimalFactory = {
  radiusOf(animalId) {
    return _anRadius(_anDef(animalId) || _anFallbackDef());
  },

  build(animalId, variant, opts) {
    variant = variant === 'golden' || variant === 'rainbow' ? variant : 'normal';
    opts = opts || {};
    _anInit();
    const known = _anDef(animalId);
    const def = known || _anFallbackDef();
    const ckey = known ? String(animalId) : '__fallback';
    let c = _anGeoCache[ckey];
    if (!c) { c = _anBuildGeo(def, ckey); _anGeoCache[ckey] = c; }
    const meta = c.meta, k = meta.k, R = meta.R, cyM = meta.cy * k;
    const mat = _anMaterial(variant);

    const g = new THREE.Group();
    g.name = 'animal_' + ckey;
    const rig = new THREE.Group();
    rig.position.y = cyM;
    g.add(rig);

    const mk = (geo, px, py, pz) => {
      if (!geo) return null;
      const m = new THREE.Mesh(geo, mat);
      m.position.set(px * k, (py - meta.cy) * k, pz * k);
      m.castShadow = true;
      rig.add(m);
      return m;
    };
    const body = mk(c.body, 0, 0, 0);
    const head = mk(c.head, meta.headP[0], meta.headP[1], meta.headP[2]);
    const extra = mk(c.extra, meta.xP[0], meta.xP[1], meta.xP[2]);
    const flap = meta.extraKind === 'flap' ? extra : null;
    const legs = meta.extraKind === 'legs' ? extra : null;

    const rarity = (typeof RARITY_BY_ID !== 'undefined' && RARITY_BY_ID && RARITY_BY_ID[def.rarity]) || null;
    const u = g.userData;
    u.animalId = animalId; u.variant = variant; u.radius = R; u.height = 2 * R;
    u.k = k; u.cyM = cyM; u.rig = rig; u.body = body; u.head = head; u.legs = legs; u.flap = flap;
    u.hy = head ? head.position.y : 0;
    u.hover = meta.hover; u.moving = false; u.phase = Math.random() * 100;
    u.fx = null; u.fxSpr = null; u.fxSprBase = 0; u.fxVoid = false;

    if (opts.fx !== false) {
      const kind = rarity && rarity.fx ? rarity.fx : 'none';
      const hex = (rarity && (rarity.glow || rarity.color)) || '#ffffff';
      const fx = _anBuildFx(kind, variant, R, hex, Math.random);
      if (fx) {
        g.add(fx.grp);
        u.fx = fx.grp; u.fxSpr = fx.spr; u.fxSprBase = fx.sprBase; u.fxVoid = fx.voidSpr;
      }
    }
    return g;
  },

  animate(group, t, state, dt) {
    const u = group && group.userData;
    if (!u || !u.rig) return;
    const p = u.phase, H = u.height, hv = u.hover;
    let sx = 1, sy = 1, px = 0, py = 0, rx = 0, ry = 0, rz = 0;
    let hrx = 0, hry = 0, hrz = 0, hdy = 0, lrx = 0, fs = 1, fsy = 1;
    switch (state) {
      case 'nervous': {
        hrx = -0.4 + Math.sin(t * 18 + p) * 0.05; hrz = Math.sin(t * 31 + p) * 0.1;
        px = Math.sin(t * 43 + p) * H * 0.012; rz = Math.sin(t * 37 + p) * 0.035;
        sy = 1.04; sx = 0.98; lrx = Math.sin(t * 25 + p) * 0.12;
        fs = 1 + 0.12 * Math.sin(t * 30 + p);
        if (hv) py = H * 0.04;
        break;
      }
      case 'held': {
        rz = Math.sin(t * 8 + p) * 0.28; rx = Math.sin(t * 6.3 + p) * 0.14;
        sy = 1.07; sx = 0.96; hrx = Math.sin(t * 9 + p) * 0.25; hrz = Math.sin(t * 7 + p) * 0.2;
        lrx = Math.sin(t * 13 + p) * 0.8; fs = 0.65 + 0.5 * Math.abs(Math.sin(t * 10 + p)); fsy = 1.1;
        break;
      }
      case 'fall': {
        rx = t * 2.4 + p; rz = Math.sin(t * 1.7 + p) * 0.5; hrx = -0.2; lrx = 0.5 + Math.sin(t * 5 + p) * 0.3; fs = 1.2;
        break;
      }
      case 'follow': {
        if (hv) {
          const mv = u.moving;
          py = H * 0.22 + Math.sin(t * 3.2 + p) * H * 0.04;
          fs = 0.7 + 0.45 * Math.abs(Math.sin(t * (mv ? 14 : 9) + p)); fsy = 1 + (fs - 1) * 0.5;
          rx = mv ? 0.16 : 0; hrz = Math.sin(t * 2 + p) * 0.06; hry = Math.sin(t * 1.3 + p) * 0.1;
        } else if (u.moving) {
          const ph = t * 8.5 + p, f = Math.abs(Math.sin(ph));
          py = f * H * 0.15; sy = 0.9 + 0.17 * f; sx = 1.08 - 0.1 * f;
          rx = 0.1; lrx = Math.sin(ph) * 0.8; hrz = Math.sin(ph) * 0.08; hrx = -0.05;
        } else {
          const br = Math.sin(t * 2.2 + p);
          sy = 1 + 0.022 * br; sx = 1 - 0.011 * br; hrz = Math.sin(t * 0.8 + p) * 0.07; hry = Math.sin(t * 0.6 + p * 1.7) * 0.12;
          const hc = (t * 0.25 + p) % 1;
          if (hc < 0.09) py = Math.sin(hc / 0.09 * Math.PI) * H * 0.09;
        }
        break;
      }
      case 'happy': {
        const jp = Math.abs(Math.sin(t * 5.5 + p));
        py = jp * H * 0.35 + (hv ? H * 0.1 : 0); ry = t * 7 + p; sy = 0.88 + 0.2 * jp; sx = 1.1 - 0.12 * jp;
        lrx = -0.7 * jp; fs = 0.6 + 0.6 * jp; hrx = -0.12;
        break;
      }
      default: {   // idle
        const br = Math.sin(t * 2.2 + p);
        sy = 1 + 0.022 * br; sx = 1 - 0.011 * br;
        hrz = Math.sin(t * 0.8 + p) * 0.07; hry = Math.sin(t * 0.55 + p * 1.7) * 0.12; hrx = Math.sin(t * 0.9 + p * 0.5) * 0.03;
        if (hv) {
          py = H * 0.06 + Math.sin(t * 2 + p) * H * 0.025; fs = 1 + 0.08 * Math.sin(t * 3 + p);
        } else {
          const hc = (t * 0.17 + p) % 1;
          if (hc < 0.06) { const q = Math.sin(hc / 0.06 * Math.PI); py = q * H * 0.1; sy *= 1 + q * 0.04; }
          // quick blink-like nod
          const bl = (t * 0.31 + p * 0.37) % 1;
          if (bl < 0.025) hdy = -Math.sin(bl / 0.025 * Math.PI) * H * 0.012;
        }
      }
    }
    const rig = u.rig;
    rig.scale.set(sx, sy, sx);
    rig.position.set(px, u.cyM * sy + py, 0);
    rig.rotation.set(rx, ry, rz);
    if (u.head) { u.head.rotation.set(hrx, hry, hrz); u.head.position.y = u.hy + hdy; }
    if (u.legs) u.legs.rotation.x = lrx;
    if (u.flap) u.flap.scale.set(fs, fsy, fs);
    if (u.fxSpr) {
      const s = u.fxSprBase * (1 + 0.06 * Math.sin(t * 2.5 + p));
      u.fxSpr.scale.set(s, s, 1);
      if (u.fxVoid) u.fxSpr.material.rotation = t * 0.5;
    }
  },

  thumbnail(animalId, variant) {
    variant = variant === 'golden' || variant === 'rainbow' ? variant : 'normal';
    const key = animalId + ':' + variant;
    if (_anThumbs[key]) return _anThumbs[key];
    let url = '';
    try {
      const r = _anThumbRenderer();
      const g = AnimalFactory.build(animalId, variant, { fx: false });
      const sc = _anR.thumbScene;
      sc.add(g);
      g.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(g);
      const ctr = box.getCenter(new THREE.Vector3()), sz = box.getSize(new THREE.Vector3());
      const rad = Math.max(sz.x, sz.y, sz.z) * 0.56;
      const cam = _anR.thumbCam;
      const dist = rad / Math.sin(cam.fov * Math.PI / 360) * 1.02;
      const az = 0.6, el = 0.22;
      cam.position.set(ctr.x + Math.sin(az) * Math.cos(el) * dist, ctr.y + Math.sin(el) * dist, ctr.z + Math.cos(az) * Math.cos(el) * dist);
      cam.lookAt(ctr);
      cam.updateMatrixWorld(true);
      r.render(sc, cam);
      url = r.domElement.toDataURL('image/png');
      sc.remove(g);
      AnimalFactory.dispose(g);
    } catch (e) { console.warn('[AnimalFactory.thumbnail]', e); return ''; }
    _anThumbs[key] = url;
    return url;
  },

  dispose(group) {
    if (!group) return;
    if (group.parent) group.parent.remove(group);
    const u = group.userData;
    if (u) { u.fx = null; u.fxSpr = null; u.disposed = true; }
    // geometries and materials are shared/cached on purpose: nothing per-instance to free.
  },
};

/* ---------- renderers / lights ---------- */
function _anLights(scene, strong) {
  scene.add(new THREE.HemisphereLight(0xffffff, 0xc9b9dd, strong ? 1.5 : 1.3));
  const d = new THREE.DirectionalLight(0xffffff, strong ? 2.6 : 2.3);
  d.position.set(2.5, 4, 3.5);
  scene.add(d);
  const f = new THREE.DirectionalLight(0xb8d4ff, 0.7);
  f.position.set(-3, 1.5, 2);
  scene.add(f);
}
function _anThumbRenderer() {
  if (_anR.thumb) return _anR.thumb;
  const r = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
  r.setPixelRatio(1); r.setSize(160, 160, false); r.setClearColor(0x000000, 0);
  const sc = new THREE.Scene();
  _anLights(sc, true);
  _anR.thumb = r; _anR.thumbScene = sc;
  _anR.thumbCam = new THREE.PerspectiveCamera(26, 1, 0.01, 50);
  return r;
}

const PetViewer = {
  _s: null,
  mount(el, animalId, variant) {
    this.unmount();
    if (!el) return;
    try {
      if (!_anR.view) {
        _anR.view = new THREE.WebGLRenderer({ alpha: true, antialias: true });
        _anR.view.setClearColor(0x000000, 0);
      }
      const r = _anR.view;
      const s = { el, raf: 0, w: 0, h: 0, t0: performance.now(), last: performance.now() };
      s.scene = new THREE.Scene();
      _anLights(s.scene, false);
      s.cam = new THREE.PerspectiveCamera(30, 1, 0.01, 50);
      s.group = AnimalFactory.build(animalId, variant, { fx: true });
      const R = s.group.userData.radius;
      s.R = R;
      s.shadow = new THREE.Mesh(_anGroundGeo(), new THREE.MeshBasicMaterial({ map: _anTexShadow(), transparent: true, depthWrite: false }));
      s.shadow.position.y = 0.003; s.shadow.scale.set(R * 3.2, 1, R * 3.2);
      s.scene.add(s.shadow); s.scene.add(s.group);
      const cv = r.domElement;
      cv.style.width = '100%'; cv.style.height = '100%'; cv.style.display = 'block';
      el.appendChild(cv);
      s.canvas = cv;
      this._s = s;
      const loop = () => {
        if (this._s !== s) return;
        if (!el.isConnected) { this.unmount(); return; }
        s.raf = requestAnimationFrame(loop);
        const now = performance.now(), dt = Math.min(0.1, (now - s.last) / 1000); s.last = now;
        const t = (now - s.t0) / 1000;
        const w = Math.max(120, el.clientWidth | 0), h = Math.max(120, el.clientHeight | 0);
        if (w !== s.w || h !== s.h) {
          s.w = w; s.h = h;
          r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
          r.setSize(w, h, false);
          s.cam.aspect = w / h; s.cam.updateProjectionMatrix();
          const th = Math.tan(s.cam.fov * Math.PI / 360);
          const e = s.R * 1.5;
          const dist = Math.max(e / th, e / (th * s.cam.aspect));
          s.cam.position.set(0, s.R * 1.5 + dist * 0.16, dist);
          s.cam.lookAt(0, s.R * 0.95, 0);
        }
        s.group.rotation.y = t * 0.7;
        s.group.position.y = (Math.sin(t * 2) * 0.5 + 0.5) * s.R * 0.06;
        AnimalFactory.animate(s.group, t, 'idle', dt);
        r.render(s.scene, s.cam);
      };
      s.raf = requestAnimationFrame(loop);
    } catch (e) { console.warn('[PetViewer.mount]', e); this._s = null; }
  },
  unmount() {
    const s = this._s;
    if (!s) return;
    this._s = null;
    if (s.raf) cancelAnimationFrame(s.raf);
    if (s.canvas && s.canvas.parentNode) s.canvas.parentNode.removeChild(s.canvas);
    if (s.shadow) { s.shadow.material.dispose(); s.scene.remove(s.shadow); }
    if (s.group) AnimalFactory.dispose(s.group);
  },
};
