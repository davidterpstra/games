/* =====================================================================
   SOLSTICE ROADS — core utilities
   All src/js files are concatenated (in name order) into one ES module by
   build.mjs, so they share one top-level scope. Boot happens in 17_main.js.

   Conventions: metres, seconds, radians, kg. Y is up. North is -Z.
   A heading `h` means forward = (sin h, cos h) on the XZ plane, so a
   larger heading turns LEFT; "left" = (cos h, -sin h).
   ===================================================================== */
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

const TAU = Math.PI * 2;
const DEG = Math.PI / 180;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const invLerp = (a, b, v) => clamp((v - a) / (b - a), 0, 1);
const smoothstep = (a, b, v) => { const t = invLerp(a, b, v); return t * t * (3 - 2 * t); };
const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const damp = (cur, target, rate, dt) => cur + (target - cur) * (1 - Math.exp(-rate * dt));
const $ = (id) => document.getElementById(id);
const fmtTime = (t) => {
  if (!isFinite(t)) return '--:--.--';
  const m = Math.floor(t / 60), s = t - m * 60;
  return `${m}:${s < 10 ? '0' : ''}${s.toFixed(2)}`;
};
const ordinal = (n) => n + (['th', 'st', 'nd', 'rd'][(n % 100 - 20) % 10] || ['th', 'st', 'nd', 'rd'][n % 100] || 'th');

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
let rng = mulberry32(1337);
const reseed = (s) => { rng = mulberry32(s); };
const rr = (a, b) => a + rng() * (b - a);

/* ---------- value noise (deterministic) ---------- */
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
  for (let i = 0; i < oct; i++) { s += a * noise2(x * f + i * 17.3, z * f - i * 9.1); n += a; a *= 0.5; f *= 2.03; }
  return s / n;
}
function ridged(x, z, oct = 4) {
  let s = 0, a = 0.5, f = 1, n = 0;
  for (let i = 0; i < oct; i++) { const v = 1 - Math.abs(noise2(x * f, z * f)); s += a * v * v; n += a; a *= 0.5; f *= 2.1; }
  return s / n;
}

/* ---------- 2D geometry ---------- */
function closestOnSeg(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz;
  const t = l2 > 0 ? clamp(((px - ax) * dx + (pz - az) * dz) / l2, 0, 1) : 0;
  const cx = ax + dx * t, cz = az + dz * t;
  return { t, d: Math.hypot(px - cx, pz - cz) };
}
// Do segments p0-p1 and q0-q1 intersect? (used for checkpoint gates)
function segCross(p0x, p0z, p1x, p1z, q0x, q0z, q1x, q1z) {
  const d = (p1x - p0x) * (q1z - q0z) - (p1z - p0z) * (q1x - q0x);
  if (Math.abs(d) < 1e-9) return false;
  const t = ((q0x - p0x) * (q1z - q0z) - (q0z - p0z) * (q1x - q0x)) / d;
  const u = ((q0x - p0x) * (p1z - p0z) - (q0z - p0z) * (p1x - p0x)) / d;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1;
}
// Centripetal-ish Catmull-Rom through control points, resampled every `step` metres.
function catmull(pts, step, closed = false) {
  const P = (i) => closed ? pts[(i + pts.length) % pts.length] : pts[clamp(i, 0, pts.length - 1)];
  const dense = [];
  const n = closed ? pts.length : pts.length - 1;
  for (let i = 0; i < n; i++) {
    const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
    const len = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
    const k = Math.max(2, Math.ceil(len / 0.5));
    for (let j = 0; j < k; j++) {
      const t = j / k, t2 = t * t, t3 = t2 * t;
      const f = (a, b, c, d) => 0.5 * (2 * b + (c - a) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (3 * b - a - 3 * c + d) * t3);
      dense.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  if (!closed) dense.push([pts[pts.length - 1][0], pts[pts.length - 1][1]]);
  else dense.push([dense[0][0], dense[0][1]]);
  // resample by arc length so samples are evenly spaced
  const cum = [0];
  for (let i = 1; i < dense.length; i++) cum.push(cum[i - 1] + Math.hypot(dense[i][0] - dense[i - 1][0], dense[i][1] - dense[i - 1][1]));
  const total = cum[cum.length - 1];
  const n2 = Math.max(1, Math.round(total / step));
  const out = [];
  let j = 0;
  for (let i = 0; i <= n2; i++) {
    const s = (i / n2) * total;
    while (j < cum.length - 2 && cum[j + 1] < s) j++;
    const seg = cum[j + 1] - cum[j] || 1, t = clamp((s - cum[j]) / seg, 0, 1);
    out.push([lerp(dense[j][0], dense[j + 1][0], t), lerp(dense[j][1], dense[j + 1][1], t)]);
  }
  return out;
}

/* ---------- tiny event bus ---------- */
const Bus = {
  h: {},
  on(e, f) { (this.h[e] ||= []).push(f); },
  emit(e, a) { (this.h[e] || []).forEach((f) => f(a)); },
};

/* ---------- persistent save ---------- */
const SAVE_KEY = 'solstice-roads-v1';
const Save = {
  data: { credits: 0, xp: 0, car: 0, paint: {}, best: {}, settings: null, stats: { km: 0, drift: 0, wins: 0 } },
  load() {
    try {
      const d = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
      if (d && typeof d === 'object') Object.assign(this.data, d);
    } catch (e) { /* private mode or corrupt: keep defaults */ }
  },
  write() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(this.data)); } catch (e) { /* ignore */ } },
};

/* ---------- canvas texture helpers ---------- */
function canvasTex(w, h, draw, { repeat = true, srgb = true, aniso = 8 } = {}) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const x = c.getContext('2d');
  draw(x, w, h);
  const t = new THREE.CanvasTexture(c);
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = aniso;
  return t;
}
// Fills a canvas with tileable value noise (wraps at the edges).
function noiseFill(x, w, h, cells, fn) {
  const img = x.getImageData(0, 0, w, h), d = img.data;
  const tile = (ix, iz) => hash2(((ix % cells) + cells) % cells, ((iz % cells) + cells) % cells);
  const tn = (u, v) => {
    const ix = Math.floor(u), iz = Math.floor(v), fx = u - ix, fz = v - iz;
    const ux = fx * fx * (3 - 2 * fx), uz = fz * fz * (3 - 2 * fz);
    const a = tile(ix, iz), b = tile(ix + 1, iz), c = tile(ix, iz + 1), e = tile(ix + 1, iz + 1);
    return a + (b - a) * ux + (c - a) * uz + (a - b - c + e) * ux * uz;
  };
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const u = i / w * cells, v = j / h * cells;
    let n = 0, amp = 0.5, f = 1, norm = 0;
    for (let o = 0; o < 4; o++) { n += amp * tn(u * f, v * f); norm += amp; amp *= 0.5; f *= 2; }
    n /= norm;
    const k = (j * w + i) * 4;
    const c = fn(n, i, j);
    d[k] = c[0]; d[k + 1] = c[1]; d[k + 2] = c[2]; d[k + 3] = c[3] ?? 255;
  }
  x.putImageData(img, 0, 0);
}

const showErr = (e) => {
  console.error(e);
  let d = $('err');
  if (!d) {
    d = document.createElement('pre');
    d.id = 'err';
    document.body.appendChild(d);
  }
  d.textContent = String((e && e.stack) || e).slice(0, 900);
};
addEventListener('error', (e) => showErr(e.error || e.message));
addEventListener('unhandledrejection', (e) => showErr(e.reason));
