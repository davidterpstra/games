/* =====================================================================
   BUILD YOUR VILLAGE — core utilities
   All src/js files are concatenated (in name order) into one ES module
   by build.mjs, so they share one top-level scope. Nothing here runs on
   its own; boot happens at the very end (13_main.js).
   ===================================================================== */
import * as THREE from 'three';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const invLerp = (a, b, v) => clamp((v - a) / (b - a), 0, 1);
const smoothstep = (a, b, v) => { const t = invLerp(a, b, v); return t * t * (3 - 2 * t); };
const randRange = (a, b) => a + Math.random() * (b - a);
const randInt = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const dist2 = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const isStr = (v) => typeof v === 'string' && v.length > 0 && v.length < 64;
const now = () => performance.now() / 1000;

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------- value noise ---------- */
function hash2(ix, iz) {
  let h = (Math.imul(ix | 0, 374761393) + Math.imul(iz | 0, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967295;
}
function noise2(x, z) {
  const ix = Math.floor(x), iz = Math.floor(z);
  const fx = x - ix, fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx), uz = fz * fz * (3 - 2 * fz);
  const a = hash2(ix, iz), b = hash2(ix + 1, iz), c = hash2(ix, iz + 1), d = hash2(ix + 1, iz + 1);
  return (a + (b - a) * ux + (c - a) * uz + (a - b - c + d) * ux * uz) * 2 - 1;
}
function fbm(x, z, oct = 4) {
  let s = 0, a = 0.5, f = 1, n = 0;
  for (let i = 0; i < oct; i++) { s += a * noise2(x * f, z * f); n += a; a *= 0.5; f *= 2.03; }
  return s / n;
}
function ridged(x, z, oct = 4) {
  let s = 0, a = 0.5, f = 1, n = 0;
  for (let i = 0; i < oct; i++) { s += a * (1 - Math.abs(noise2(x * f, z * f))); n += a; a *= 0.5; f *= 2.1; }
  return s / n;
}

/* ---------- geometry helpers ---------- */
function distToSeg(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az;
  const l2 = dx * dx + dz * dz;
  let t = l2 > 0 ? ((px - ax) * dx + (pz - az) * dz) / l2 : 0;
  t = clamp(t, 0, 1);
  return Math.hypot(px - (ax + dx * t), pz - (az + dz * t));
}
function distToPolyline(px, pz, pts) {
  let d = 1e9;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    const v = distToSeg(px, pz, a[0], a[1], b[0], b[1]);
    if (v < d) d = v;
  }
  return d;
}
// Catmull-Rom resample of a polyline so roads and rivers look hand drawn, not angular
function smoothPolyline(pts, step = 2) {
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    const len = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
    const n = Math.max(1, Math.ceil(len / step));
    for (let k = 0; k < n; k++) {
      const t = k / n, t2 = t * t, t3 = t2 * t;
      const f = (a, b, c, d) => 0.5 * ((2 * b) + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  out.push(pts[pts.length - 1].slice());
  return out;
}

/* ---------- easing + tweens ---------- */
const Ease = {
  linear: (t) => t,
  outCubic: (t) => 1 - Math.pow(1 - t, 3),
  inOut: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  outBack: (t) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
  outElastic: (t) => (t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (TAU / 3)) + 1),
};
const Tweens = {
  list: [],
  add(dur, fn, done, ease = Ease.linear) { const tw = { t: 0, dur, fn, done, ease }; this.list.push(tw); return tw; },
  update(dt) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const w = this.list[i];
      w.t += dt;
      const k = Math.min(1, w.t / w.dur);
      try { w.fn(w.ease(k), k); } catch (e) { console.error(e); }
      if (k >= 1) { this.list.splice(i, 1); if (w.done) try { w.done(); } catch (e) { console.error(e); } }
    }
  },
  get active() { return this.list.length > 0; },
};

/* ---------- tiny event bus (server -> client signals) ---------- */
const Bus = {
  _h: {},
  on(n, f) { (this._h[n] || (this._h[n] = [])).push(f); },
  emit(n, d) { const l = this._h[n]; if (l) for (const f of l) { try { f(d); } catch (e) { console.error('[Bus]', n, e); } } },
};

/* ---------- DOM helpers ---------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
function h(tag, cls, html) { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
function esc(s) { return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function fmt(n) {
  n = Math.floor(n);
  if (n >= 1e6) return (n / 1e6).toFixed(n >= 1e7 ? 0 : 1) + 'M';
  if (n >= 1e4) return (n / 1e3).toFixed(n >= 1e5 ? 0 : 1) + 'k';
  return String(n);
}
function fmtHour(hr) { const hh = Math.floor(hr) % 24, mm = Math.floor((hr % 1) * 60); return String(hh).padStart(2, '0') + ':' + String(mm - (mm % 10)).padStart(2, '0'); }
function fmtDur(sec) { sec = Math.max(0, Math.floor(sec)); const m = Math.floor(sec / 60), s = sec % 60; return m >= 60 ? Math.floor(m / 60) + 'h ' + (m % 60) + 'm' : m > 0 ? m + 'm ' + String(s).padStart(2, '0') + 's' : s + 's'; }
const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));

/* ---------- shared shader uniforms ---------- */
const U = {
  uTime: { value: 0 },
  uWind: { value: 1 },
  uLocked: { value: new Array(12).fill(0) },
};

/**
 * Patch a built-in material for the world: optional wind sway (scaled by
 * local height, so trunks stay put and canopies move) and optional
 * "locked area" desaturation driven by a per-vertex / per-instance aArea.
 */
function patchWorldMat(mat, { wind = 0, area = false } = {}) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = U.uTime; sh.uniforms.uWind = U.uWind; sh.uniforms.uLocked = U.uLocked;
    let head = 'uniform float uTime;\nuniform float uWind;\n';
    if (area) head += 'attribute float aArea;\nvarying float vArea;\n';
    sh.vertexShader = head + sh.vertexShader;
    let body = '';
    if (area) body += 'vArea = aArea;\n';
    if (wind > 0) {
      body += `
      #ifdef USE_INSTANCING
        vec3 wip = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
      #else
        vec3 wip = vec3(modelMatrix[3][0], modelMatrix[3][1], modelMatrix[3][2]);
      #endif
      float wph = uTime * 1.6 + wip.x * 0.21 + wip.z * 0.17;
      float wamp = ${wind.toFixed(4)} * uWind * max(transformed.y, 0.0);
      transformed.x += (sin(wph) + 0.35 * sin(wph * 2.7)) * wamp;
      transformed.z += cos(wph * 0.83) * wamp * 0.6;
      `;
    }
    sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n' + body);
    if (area) {
      sh.fragmentShader = 'uniform float uLocked[12];\nvarying float vArea;\n' + sh.fragmentShader;
      sh.fragmentShader = sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
        {
          int ai = int(vArea + 0.5);
          float lk = uLocked[ai];
          float gl = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(gl) * vec3(0.80, 0.82, 0.90), lk * 0.72);
        }`);
    }
  };
  mat.customProgramCacheKey = () => 'wm' + wind + (area ? 'a' : '');
  return mat;
}

/* ---------- Geometry builder for low-poly models ----------
   Everything becomes one non-indexed, vertex-coloured geometry per layer:
   'main' (lit, flat shaded) and 'glow' (windows / lamps, unlit). A small
   transform stack lets models reuse sub-parts at an offset/rotation. */
const _gbM = new THREE.Matrix4(), _gbQ = new THREE.Quaternion(), _gbE = new THREE.Euler(), _gbV = new THREE.Vector3(), _gbS = new THREE.Vector3();
const _gbColor = new THREE.Color();
class GB {
  constructor() {
    this.layers = { main: { p: [], c: [] }, glow: { p: [], c: [] } };
    this.stack = [];
    this.base = new THREE.Matrix4();
    this.lights = []; this.smokes = []; this.fires = [];
  }
  push(x = 0, y = 0, z = 0, ry = 0) {
    this.stack.push(this.base.clone());
    const m = new THREE.Matrix4().makeRotationY(ry); m.setPosition(x, y, z);
    this.base.multiply(m);
    return this;
  }
  pop() { this.base = this.stack.pop() || new THREE.Matrix4(); return this; }
  _m(x, y, z, ry = 0, rx = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
    _gbE.set(rx, ry, rz, 'YXZ'); _gbQ.setFromEuler(_gbE);
    _gbM.compose(_gbV.set(x, y, z), _gbQ, _gbS.set(sx, sy, sz));
    return new THREE.Matrix4().multiplyMatrices(this.base, _gbM);
  }
  _add(geo, color, m, layer = 'main', jitter = 0) {
    const g = geo.index ? geo.toNonIndexed() : geo;
    const p = g.attributes.position.array;
    if (jitter > 0) {
      for (let i = 0; i < p.length; i += 3) {
        const k = hash2(Math.round(p[i] * 97 + p[i + 2] * 13), Math.round(p[i + 1] * 101 + p[i + 2] * 57));
        const k2 = hash2(Math.round(p[i + 1] * 71 + 5), Math.round(p[i] * 43 - p[i + 2] * 89));
        p[i] *= 1 + (k - 0.5) * jitter; p[i + 1] *= 1 + (k2 - 0.5) * jitter; p[i + 2] *= 1 + (k * k2 - 0.25) * jitter;
      }
    }
    g.applyMatrix4(m);
    _gbColor.set(color);
    const L = this.layers[layer];
    for (let i = 0; i < p.length; i += 3) { L.p.push(p[i], p[i + 1], p[i + 2]); L.c.push(_gbColor.r, _gbColor.g, _gbColor.b); }
    if (g !== geo) g.dispose();
    geo.dispose();
    return this;
  }
  /* center-based box */
  box(w, h, d, color, x = 0, y = 0, z = 0, ry = 0, rx = 0, rz = 0) { return this._add(new THREE.BoxGeometry(w, h, d), color, this._m(x, y, z, ry, rx, rz)); }
  /* bottom-based box */
  boxB(w, h, d, color, x = 0, y = 0, z = 0, ry = 0) { return this.box(w, h, d, color, x, y + h / 2, z, ry); }
  /* glowing window pane (unlit layer) */
  win(w, h, d, x, y, z, ry = 0) { return this._add(new THREE.BoxGeometry(w, h, d), 0xffffff, this._m(x, y, z, ry), 'glow'); }
  glowBox(w, h, d, color, x, y, z, ry = 0) { return this._add(new THREE.BoxGeometry(w, h, d), color, this._m(x, y, z, ry), 'glow'); }
  /* bottom-based cylinder */
  cyl(rt, rb, h, seg, color, x = 0, y = 0, z = 0, ry = 0) { return this._add(new THREE.CylinderGeometry(rt, rb, h, seg), color, this._m(x, y + h / 2, z, ry)); }
  /* center-based cylinder with free rotation (logs, axles) */
  cylC(rt, rb, h, seg, color, x, y, z, rx = 0, ry = 0, rz = 0) { return this._add(new THREE.CylinderGeometry(rt, rb, h, seg), color, this._m(x, y, z, ry, rx, rz)); }
  cone(r, h, seg, color, x = 0, y = 0, z = 0, ry = 0) { return this._add(new THREE.ConeGeometry(r, h, seg), color, this._m(x, y + h / 2, z, ry)); }
  /* four-sided hip roof / pyramid with footprint w x d */
  pyr(w, d, h, color, x = 0, y = 0, z = 0, ry = 0) {
    const g = new THREE.ConeGeometry(1, 1, 4); g.rotateY(Math.PI / 4);
    return this._add(g, color, this._m(x, y + h / 2, z, ry, 0, 0, w / Math.SQRT2, h, d / Math.SQRT2));
  }
  ico(r, color, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1, detail = 0, jitter = 0.25, ry = 0) {
    return this._add(new THREE.IcosahedronGeometry(r, detail), color, this._m(x, y, z, ry, 0, 0, sx, sy, sz), 'main', jitter);
  }
  dodec(r, color, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1, jitter = 0.2, ry = 0) {
    return this._add(new THREE.DodecahedronGeometry(r, 0), color, this._m(x, y, z, ry, 0, 0, sx, sy, sz), 'main', jitter);
  }
  /* gable roof: ridge runs along z (depth d), slopes face +x/-x */
  roof(w, d, h, color, x = 0, y = 0, z = 0, ry = 0, gableColor = null) {
    const hw = w / 2, hd = d / 2;
    const P = [
      // slopes
      -hw, 0, hd, 0, h, hd, 0, h, -hd, -hw, 0, hd, 0, h, -hd, -hw, 0, -hd,
      hw, 0, hd, hw, 0, -hd, 0, h, -hd, hw, 0, hd, 0, h, -hd, 0, h, hd,
      // underside
      -hw, 0, hd, -hw, 0, -hd, hw, 0, -hd, -hw, 0, hd, hw, 0, -hd, hw, 0, hd,
    ];
    const G = [
      -hw, 0, hd, hw, 0, hd, 0, h, hd,
      hw, 0, -hd, -hw, 0, -hd, 0, h, -hd,
    ];
    const g1 = new THREE.BufferGeometry(); g1.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
    const g2 = new THREE.BufferGeometry(); g2.setAttribute('position', new THREE.Float32BufferAttribute(G, 3));
    const m = this._m(x, y, z, ry);
    this._add(g1, color, m);
    this._add(g2, gableColor == null ? color : gableColor, m.clone());
    return this;
  }
  /* wedge / lean-to roof sloping down toward +z */
  shed(w, d, h1, h2, color, x = 0, y = 0, z = 0, ry = 0) {
    const hw = w / 2, hd = d / 2;
    const v = [[-hw, 0, -hd], [hw, 0, -hd], [hw, 0, hd], [-hw, 0, hd], [-hw, h1, -hd], [hw, h1, -hd], [hw, h2, hd], [-hw, h2, hd]];
    const f = [[0, 2, 1], [0, 3, 2], [4, 5, 6], [4, 6, 7], [0, 1, 5], [0, 5, 4], [3, 7, 6], [3, 6, 2], [0, 4, 7], [0, 7, 3], [1, 2, 6], [1, 6, 5]];
    const P = []; for (const t of f) for (const i of t) P.push(...v[i]);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
    return this._add(g, color, this._m(x, y, z, ry));
  }
  light(x, y, z) { this.lights.push(new THREE.Vector3(x, y, z).applyMatrix4(this.base)); return this; }
  smoke(x, y, z) { this.smokes.push(new THREE.Vector3(x, y, z).applyMatrix4(this.base)); return this; }
  fire(x, y, z) { this.fires.push(new THREE.Vector3(x, y, z).applyMatrix4(this.base)); return this; }
  _geo(layer) {
    const L = this.layers[layer];
    if (!L.p.length) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(L.p, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(L.c, 3));
    g.computeVertexNormals();
    g.computeBoundingBox(); g.computeBoundingSphere();
    return g;
  }
  build() { return { main: this._geo('main'), glow: this._geo('glow'), lights: this.lights, smokes: this.smokes, fires: this.fires }; }
}
