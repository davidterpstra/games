/* =====================================================================
   EMPIRE CONQUEST — shared utilities
   Plain (non-module) scripts so the game runs straight from file://.
   Every file adds its globals to the shared script scope.
   ===================================================================== */
'use strict';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
const smooth = (t) => t * t * (3 - 2 * t);

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashInts(...vals) {
  let h = 2166136261 >>> 0;
  for (const v of vals) {
    h ^= (v | 0);
    h = Math.imul(h, 16777619);
    h ^= h >>> 13;
  }
  return h >>> 0;
}

function hashStr(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

class Rng {
  constructor(seed) { this.f = mulberry32(seed >>> 0); }
  next() { return this.f(); }
  range(a, b) { return a + this.f() * (b - a); }
  int(a, b) { return Math.floor(a + this.f() * (b - a + 1)); }
  pick(arr) { return arr[Math.floor(this.f() * arr.length)]; }
  chance(p) { return this.f() < p; }
  shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(this.f() * (i + 1));
      const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }
}

/* ---------- value noise (seeded) ---------- */
function makeNoise(seed) {
  const perm = new Uint8Array(512);
  const vals = new Float32Array(256);
  const r = new Rng(seed);
  const p = [];
  for (let i = 0; i < 256; i++) { p.push(i); vals[i] = r.next() * 2 - 1; }
  r.shuffle(p);
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  const v = (ix, iy) => vals[perm[(perm[ix & 255] + iy) & 511]];
  return function (x, y) {
    const ix = Math.floor(x), iy = Math.floor(y);
    const fx = x - ix, fy = y - iy;
    const sx = smooth(fx), sy = smooth(fy);
    const a = v(ix, iy), b = v(ix + 1, iy), c = v(ix, iy + 1), d = v(ix + 1, iy + 1);
    return lerp(lerp(a, b, sx), lerp(c, d, sx), sy);
  };
}
function fbm(noise, x, y, oct = 4) {
  let s = 0, a = 0.5, f = 1, n = 0;
  for (let i = 0; i < oct; i++) { s += noise(x * f, y * f) * a; n += a; a *= 0.5; f *= 2.03; }
  return s / n;
}

/* ---------- binary min-heap ---------- */
class MinHeap {
  constructor() { this.k = []; this.v = []; }
  get size() { return this.k.length; }
  push(key, val) {
    const k = this.k, v = this.v;
    let i = k.length; k.push(key); v.push(val);
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (k[p] <= key) break;
      k[i] = k[p]; v[i] = v[p]; i = p;
    }
    k[i] = key; v[i] = val;
  }
  pop() {
    const k = this.k, v = this.v;
    const top = v[0], topK = k[0];
    const lk = k.pop(), lv = v.pop();
    if (k.length) {
      let i = 0; const n = k.length;
      for (;;) {
        let c = 2 * i + 1;
        if (c >= n) break;
        if (c + 1 < n && k[c + 1] < k[c]) c++;
        if (k[c] >= lk) break;
        k[i] = k[c]; v[i] = v[c]; i = c;
      }
      k[i] = lk; v[i] = lv;
    }
    this.lastKey = topK;
    return top;
  }
}

/* ---------- formatting ---------- */
function fmt(n) {
  if (!Number.isFinite(n)) return '0';
  const a = Math.abs(n), s = n < 0 ? '-' : '';
  if (a >= 1e6) return s + (a / 1e6).toFixed(a >= 1e7 ? 0 : 1) + 'M';
  if (a >= 1e4) return s + Math.floor(a / 1e3) + 'K';
  if (a >= 1e3) return s + (a / 1e3).toFixed(1) + 'K';
  if (a < 10 && a % 1 !== 0) return s + a.toFixed(1);
  return s + Math.floor(a);
}
function fmtInt(n) { return Math.floor(n).toLocaleString('en-US'); }
function fmtRate(n) {
  const r = Math.abs(n) < 10 ? Math.round(n * 10) / 10 : Math.round(n);
  return (r >= 0 ? '+' : '') + (Math.abs(r) < 10 ? r.toFixed(1) : fmt(r));
}
function fmtPct(n) { return (n >= 0 ? '+' : '') + Math.round(n * 100) + '%'; }
function plural(n, one, many) { return n === 1 ? one : (many || one + 's'); }
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/* ---------- colors ---------- */
function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
function rgba(hex, a) { const [r, g, b] = hexToRgb(hex); return `rgba(${r},${g},${b},${a})`; }
function shade(hex, f) {
  // f < 0 darkens, f > 0 lightens
  const [r, g, b] = hexToRgb(hex);
  const m = (c) => Math.round(f < 0 ? c * (1 + f) : c + (255 - c) * f);
  return `rgb(${m(r)},${m(g)},${m(b)})`;
}

/* ---------- tiny event bus ---------- */
const Bus = (() => {
  const map = new Map();
  return {
    on(ev, fn) { if (!map.has(ev)) map.set(ev, new Set()); map.get(ev).add(fn); return () => map.get(ev).delete(fn); },
    emit(ev, data) {
      const set = map.get(ev);
      if (!set) return;
      for (const fn of [...set]) {
        try { fn(data); } catch (e) { console.error('Bus handler failed for', ev, e); }
      }
    },
  };
})();

/* ---------- resources ---------- */
const RES_KEYS = ['gold', 'food', 'wood', 'iron', 'rp'];
const RES_ICON = { gold: '💰', food: '🌾', wood: '🪵', iron: '⛏️', rp: '📜', pop: '👥', happiness: '😊' };
const RES_NAME = { gold: 'Gold', food: 'Food', wood: 'Wood', iron: 'Iron', rp: 'Research', pop: 'Population', happiness: 'Happiness' };

function costScale(cost, f) {
  const out = {};
  for (const k in cost) out[k] = Math.ceil(cost[k] * f);
  return out;
}
function costAdd(a, b) {
  const out = { ...a };
  for (const k in b) out[k] = (out[k] || 0) + b[k];
  return out;
}
