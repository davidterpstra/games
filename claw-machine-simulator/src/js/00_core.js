/* =====================================================================
   CLAW MACHINE SIMULATOR — core
   All src/js files are concatenated (in name order) into ONE ES module
   by build.mjs, so they share one top-level scope. See ARCHITECTURE.md.
   This file only defines shared helpers; nothing runs on its own.
   ===================================================================== */
import * as THREE from 'three';

/* ---------- math ---------- */
const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const invLerp = (a, b, v) => (a === b ? 0 : clamp((v - a) / (b - a), 0, 1));
const smoothstep = (a, b, v) => { const t = invLerp(a, b, v); return t * t * (3 - 2 * t); };
/** Frame-rate independent smoothing: move `a` towards `b` with rate `lambda` (1/s). */
const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt));
const randRange = (a, b) => a + Math.random() * (b - a);
const randInt = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const chance = (p) => Math.random() < p;
/** weights: { key: weight } -> a key chosen proportionally, or null when all weights are 0. */
function weightedPick(weights, rng = Math.random) {
  let total = 0;
  for (const k in weights) { const w = weights[k]; if (w > 0) total += w; }
  if (total <= 0) return null;
  let r = rng() * total;
  let last = null;
  for (const k in weights) {
    const w = weights[k];
    if (!(w > 0)) continue;
    last = k;
    r -= w;
    if (r <= 0) return k;
  }
  return last;
}
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = arr[i]; arr[i] = arr[j]; arr[j] = t; }
  return arr;
}

/* ---------- type checks ---------- */
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const isStr = (v) => typeof v === 'string' && v.length > 0 && v.length < 128;
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

let _coreUidN = 0;
/** Short unique id, e.g. uid('p') -> 'p_lq3k2a1x9f'. */
function uid(prefix = 'u') {
  _coreUidN = (_coreUidN + 1) % 1679616;
  return prefix + '_' + Date.now().toString(36) + _coreUidN.toString(36) + Math.random().toString(36).slice(2, 6);
}
const deepClone = (o) => JSON.parse(JSON.stringify(o));

/* ---------- easing + tweens ---------- */
const Ease = {
  linear: (t) => t,
  inQuad: (t) => t * t,
  outQuad: (t) => 1 - (1 - t) * (1 - t),
  outCubic: (t) => 1 - Math.pow(1 - t, 3),
  inOut: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  outBack: (t) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
  outElastic: (t) => (t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (TAU / 3)) + 1),
  outBounce: (t) => {
    const n1 = 7.5625, d1 = 2.75;
    if (t < 1 / d1) return n1 * t * t;
    if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
    if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
    return n1 * (t -= 2.625 / d1) * t + 0.984375;
  },
};
/** Tweens.add(seconds, fn(easedT, rawT), done?, ease?) -> handle with .kill() */
const Tweens = {
  list: [],
  add(dur, fn, done, ease = Ease.linear) {
    const tw = { t: 0, dur: Math.max(1e-4, dur), fn, done, ease, dead: false, kill() { this.dead = true; } };
    this.list.push(tw);
    return tw;
  },
  update(dt) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const w = this.list[i];
      if (w.dead) { this.list.splice(i, 1); continue; }
      w.t += dt;
      const k = Math.min(1, w.t / w.dur);
      try { w.fn(w.ease(k), k); } catch (e) { console.error('[Tween]', e); }
      if (k >= 1) {
        this.list.splice(i, 1);
        if (w.done) try { w.done(); } catch (e) { console.error('[Tween]', e); }
      }
    }
  },
};

/* ---------- event bus ---------- */
const Bus = {
  _h: {},
  on(name, fn) { (this._h[name] || (this._h[name] = [])).push(fn); return fn; },
  off(name, fn) { const l = this._h[name]; if (l) { const i = l.indexOf(fn); if (i >= 0) l.splice(i, 1); } },
  once(name, fn) { const w = (d) => { this.off(name, w); fn(d); }; return this.on(name, w); },
  emit(name, data) {
    const l = this._h[name];
    if (!l) return;
    for (const fn of l.slice()) { try { fn(data); } catch (e) { console.error('[Bus]', name, e); } }
  },
};

/* ---------- DOM helpers ---------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
/** h('div', 'cls a', '<b>html</b>') -> element */
function h(tag, cls, html) { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
function esc(s) { return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

/* ---------- number formatting (simulator style: 1.2K, 3.4M, 5.6B ...) ---------- */
const _coreSuffix = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc'];
function fmt(n) {
  if (!isNum(n)) return '0';
  const neg = n < 0; n = Math.abs(n);
  let out;
  if (n < 1000) out = n < 10 && n % 1 !== 0 ? (Math.floor(n * 10) / 10).toString() : Math.floor(n).toString();
  else {
    let i = 0;
    while (n >= 1000 && i < _coreSuffix.length - 1) { n /= 1000; i++; }
    const d = n >= 100 ? 0 : n >= 10 ? 1 : 2;
    let s = (Math.floor(n * Math.pow(10, d)) / Math.pow(10, d)).toFixed(d);
    if (s.indexOf('.') >= 0) s = s.replace(/0+$/, '').replace(/\.$/, '');
    out = s + _coreSuffix[i];
  }
  return (neg ? '-' : '') + out;
}
const fmtMult = (m) => '×' + (m >= 1000 ? fmt(m) : m >= 100 ? Math.round(m).toString() : m >= 10 ? (Math.round(m * 10) / 10).toString() : (Math.round(m * 100) / 100).toString());
const fmtPct = (p) => Math.round(clamp(p, 0, 1) * 100) + '%';
function fmtDur(sec) {
  sec = Math.max(0, Math.floor(sec));
  const hh = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  if (hh > 0) return hh + 'h ' + m + 'm';
  if (m > 0) return m + 'm ' + String(s).padStart(2, '0') + 's';
  return s + 's';
}

/* ---------- shared shader uniforms ---------- */
const U = { uTime: { value: 0 } };

/* ---------- game root ---------- */
const Game = {
  player: null,                 // PlayerData (02_data.js), set at boot
  mode: 'walk',                 // 'walk' | 'machine' | 'train'
  time: 0,                      // seconds since boot
  debug: typeof location !== 'undefined' && /[?&]debug\b/.test(location.search),
  isTouch: typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches,
};

/* ---------- room layout (shared by scene, player, machine, main) ----------
   Stations: (x, z) = model centre, rotY = model facing (front is local +Z),
   (ix, iz) = interaction point, radius = interaction radius around it. */
const ROOM = {
  halfX: 11, halfZ: 9, height: 6.5,
  spawn: { x: 0, z: 4.5, rotY: Math.PI },
  stations: {
    machine:  { key: 'machine',  x: 0,    z: -5.2, rotY: 0,            ix: 0,    iz: -3.0, radius: 1.6, label: 'Play Claw Machine' },
    training: { key: 'training', x: -7.4, z: -2.0, rotY: Math.PI / 2,  ix: -5.6, iz: -2.0, radius: 2.0, label: 'Train Strength' },
    upgrades: { key: 'upgrades', x: 8.6,  z: -3.5, rotY: -Math.PI / 2, ix: 6.9,  iz: -3.5, radius: 1.7, label: 'Machine Upgrades' },
    pets:     { key: 'pets',     x: 8.6,  z: 3.0,  rotY: -Math.PI / 2, ix: 6.7,  iz: 3.0,  radius: 2.0, label: 'Pet Collection' },
    portal:   { key: 'portal',   x: -8.6, z: 5.0,  rotY: Math.PI / 2,  ix: -6.9, iz: 5.0,  radius: 1.8, label: 'World Portal' },
  },
  trainingSpot: { x: -5.9, z: -2.0, rotY: -Math.PI / 2 },   // where the player stands while training
  expansionSlots: [{ x: -4.6, z: -6.6 }, { x: 4.6, z: -6.6 }], // future machines / decoration
};

/* ---------- claw machine dimensions (machine-local coordinates) ---------- */
const MACHINE_DIMS = {
  width: 2.4, depth: 2.4,          // outer footprint (x, z), centred on ROOM.stations.machine
  baseHeight: 1.1,                 // pit floor height (local y)
  glassTop: 3.0,                   // top of the glass box
  totalHeight: 3.75,               // incl. marquee sign
  pit: { minX: -1.05, maxX: 1.05, minZ: -1.05, maxZ: 1.05 },
  chute: { minX: -1.05, maxX: -0.45, minZ: 0.45, maxZ: 1.05, wallHeight: 0.35 }, // front-left corner hole
  clawTopY: 2.72,                  // claw hub height when raised
  gripRadius: 0.32,                // max XZ distance (claw centre -> animal centre) to grab
  prizeDoor: { x: -0.75, y: 0.45, z: 1.2 },  // front flap where prizes pop out
};
const _coreV = new THREE.Vector3();
/** World -> machine-local (machine has rotY 0, so this is just an offset). */
function toLocalMachine(v, out = new THREE.Vector3()) {
  const s = ROOM.stations.machine;
  return out.set(v.x - s.x, v.y, v.z - s.z);
}
function toWorldMachine(v, out = new THREE.Vector3()) {
  const s = ROOM.stations.machine;
  _coreV.set(v.x + s.x, v.y, v.z + s.z);
  return out.copy(_coreV);
}
