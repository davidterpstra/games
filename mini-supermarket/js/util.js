/* Mini Supermarket — shared helpers.
 * Every script adds itself to the global `MS` namespace, so the game runs from
 * a plain file:// URL without a web server or ES modules. */
(function (MS) {
  'use strict';

  const U = {};

  U.clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  U.lerp = (a, b, t) => a + (b - a) * t;
  U.rand = (a, b) => a + Math.random() * (b - a);
  U.randInt = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
  U.pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  U.chance = (p) => Math.random() < p;
  U.dist = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);

  /** Picks an item using a weight function; returns null for an empty list. */
  U.weightedPick = (items, weightFn, rng = Math.random) => {
    let total = 0;
    for (const it of items) total += Math.max(0, weightFn(it));
    if (total <= 0) return items.length ? items[Math.floor(rng() * items.length)] : null;
    let r = rng() * total;
    for (const it of items) {
      r -= Math.max(0, weightFn(it));
      if (r <= 0) return it;
    }
    return items[items.length - 1];
  };

  U.shuffle = (arr, rng = Math.random) => {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  };

  // ---- Easing ----------------------------------------------------------
  U.ease = {
    outCubic: (t) => 1 - Math.pow(1 - t, 3),
    inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
    outBack: (t) => {
      const c1 = 1.70158, c3 = c1 + 1;
      return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
    },
    outElastic: (t) => (t === 0 || t === 1 ? t : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1),
  };

  // ---- Money (all money is stored in whole cents) -----------------------
  U.cents = (euros) => Math.round(euros * 100);

  const moneyFmt = new Intl.NumberFormat('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const intFmt = new Intl.NumberFormat('nl-NL', { maximumFractionDigits: 0 });

  /** €3,50 — always two decimals. */
  U.money = (cents) => (cents < 0 ? '-€' : '€') + moneyFmt.format(Math.abs(cents) / 100);

  /** Compact money for tight spots: €3,50 · €1.250 · €12,5K · €3,2M */
  U.moneyShort = (cents) => {
    const neg = cents < 0;
    const e = Math.abs(cents) / 100;
    let s;
    if (e < 1000) s = moneyFmt.format(e).replace(/,00$/, '');
    else if (e < 100000) s = intFmt.format(Math.floor(e));
    else if (e < 1e6) s = (e / 1000).toLocaleString('nl-NL', { maximumFractionDigits: 1 }) + 'K';
    else s = (e / 1e6).toLocaleString('nl-NL', { maximumFractionDigits: 2 }) + 'M';
    return (neg ? '-€' : '€') + s;
  };

  U.num = (n) => intFmt.format(n);
  U.pct = (f) => Math.round(f * 100) + '%';

  U.duration = (sec) => {
    sec = Math.max(0, Math.ceil(sec));
    if (sec < 60) return sec + 's';
    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
    if (h > 0) return `${h}u ${String(m).padStart(2, '0')}m`;
    return `${m}m ${String(s).padStart(2, '0')}s`;
  };

  // ---- Seeded randomness (daily challenges) -----------------------------
  U.hashString = (str) => {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  };

  U.seededRng = (seed) => {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  /** Local calendar date as YYYY-MM-DD. */
  U.todayKey = (d = new Date()) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  U.secondsUntilMidnight = () => {
    const now = new Date();
    const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    return (next - now) / 1000;
  };

  let uidCounter = 0;
  U.uid = (prefix = 'id') => `${prefix}${Date.now().toString(36)}${(uidCounter++).toString(36)}`;

  U.escape = (s) =>
    String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  U.isNum = (v) => typeof v === 'number' && Number.isFinite(v);

  // ---- Event bus ---------------------------------------------------------
  class Emitter {
    constructor() { this.handlers = {}; }
    on(evt, fn) { (this.handlers[evt] || (this.handlers[evt] = [])).push(fn); return () => this.off(evt, fn); }
    off(evt, fn) { const h = this.handlers[evt]; if (h) this.handlers[evt] = h.filter((f) => f !== fn); }
    emit(evt, data) {
      const h = this.handlers[evt];
      if (!h) return;
      for (const fn of h.slice()) {
        try { fn(data); } catch (err) { console.error(`[MS] handler for "${evt}" failed`, err); }
      }
    }
  }

  U.prefersReducedMotion = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  MS.U = U;
  MS.Emitter = Emitter;
  MS.bus = new Emitter();
})((window.MS = window.MS || {}));
