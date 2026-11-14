// Procedural canvas textures and the shared material library for all structures.
// Everything is generated at start-up (no external assets). Materials use vertex colours so that
// merged geometry can still carry per-piece tints (weathering, moss, paint variation).
import * as THREE from 'three';
import { mulberry32 } from '../layout.js';
import { QUALITY_PRESETS } from '../../core/quality.js';

const TAU = Math.PI * 2;

function cv(w, h = w) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}

/** Adds per-pixel luminance noise. */
function grain(g, w, h, rand, amt) {
  const id = g.getImageData(0, 0, w, h), d = id.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (rand() - 0.5) * amt;
    d[i] += n; d[i + 1] += n; d[i + 2] += n;
  }
  g.putImageData(id, 0, 0);
}

/** Soft blotch that wraps around the tile edges so textures stay seamless. */
function blot(g, S, x, y, r, rgb, a) {
  const ox = [0], oy = [0];
  if (x - r < 0) ox.push(S); if (x + r > S) ox.push(-S);
  if (y - r < 0) oy.push(S); if (y + r > S) oy.push(-S);
  for (const dx of ox) for (const dy of oy) {
    const gr = g.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, r);
    gr.addColorStop(0, `rgba(${rgb},${a})`); gr.addColorStop(1, `rgba(${rgb},0)`);
    g.fillStyle = gr; g.fillRect(x + dx - r, y + dy - r, 2 * r, 2 * r);
  }
}
function blots(g, S, rand, n, rmin, rmax, rgb, amin, amax) {
  for (let i = 0; i < n; i++) blot(g, S, rand() * S, rand() * S, rmin + rand() * (rmax - rmin), rgb, amin + rand() * (amax - amin));
}
/** Vertical rain streaks. */
function streaks(g, S, rand, n, rgb, a, len = 0.35) {
  for (let i = 0; i < n; i++) {
    const x = rand() * S, y = rand() * S, l = S * len * (0.3 + rand());
    const gr = g.createLinearGradient(0, y, 0, y + l);
    gr.addColorStop(0, `rgba(${rgb},0)`); gr.addColorStop(0.2, `rgba(${rgb},${a * (0.4 + rand() * 0.6)})`); gr.addColorStop(1, `rgba(${rgb},0)`);
    g.fillStyle = gr; g.fillRect(x, y, 1 + rand() * 3, l);
  }
}
const rgbs = (r, gg, b, k = 1) => `rgb(${Math.max(0, Math.min(255, r * k)) | 0},${Math.max(0, Math.min(255, gg * k)) | 0},${Math.max(0, Math.min(255, b * k)) | 0})`;

// ---------------------------------------------------------------------------------------------
// Glyphs (used on the temple pillars, reliefs, ruins). kind: sun|moon|wave|mountain|spiral|eye|zigzag|diamond

function glyphPath(g, kind, cx, cy, s) {
  g.beginPath();
  switch (kind) {
    case 'sun': {
      g.arc(cx, cy, s * 0.36, 0, TAU);
      g.moveTo(cx + s * 0.18, cy); g.arc(cx, cy, s * 0.18, 0, TAU);
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * TAU, r0 = s * 0.5, r1 = s * (i % 2 ? 0.78 : 0.95);
        g.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0); g.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
      }
      break;
    }
    case 'moon': {
      const x1 = cx - 0.1 * s, r1 = 0.7 * s, x2 = cx + 0.28 * s, r2 = 0.58 * s, t1 = 0.9757, t2 = 1.55;
      g.arc(x1, cy, r1, t1, TAU - t1, false);
      g.arc(x2, cy, r2, TAU - t2, t2, true);
      g.closePath();
      g.moveTo(cx + 0.55 * s, cy - 0.62 * s); g.lineTo(cx + 0.55 * s, cy - 0.38 * s); // little star
      g.moveTo(cx + 0.43 * s, cy - 0.5 * s); g.lineTo(cx + 0.67 * s, cy - 0.5 * s);
      break;
    }
    case 'wave': {
      for (let k = -1; k <= 1; k++) {
        for (let i = 0; i <= 40; i++) {
          const x = cx - s * 0.9 + (i / 40) * s * 1.8, y = cy + k * s * 0.42 + Math.sin((i / 40) * TAU * 2) * s * 0.17;
          i ? g.lineTo(x, y) : g.moveTo(x, y);
        }
      }
      break;
    }
    case 'mountain': {
      g.moveTo(cx - 0.95 * s, cy + 0.6 * s); g.lineTo(cx - 0.35 * s, cy - 0.35 * s); g.lineTo(cx - 0.05 * s, cy + 0.12 * s);
      g.lineTo(cx + 0.4 * s, cy - 0.75 * s); g.lineTo(cx + 0.95 * s, cy + 0.6 * s); g.closePath();
      g.moveTo(cx + 0.4 * s, cy - 0.75 * s); g.lineTo(cx + 0.25 * s, cy - 0.45 * s); g.lineTo(cx + 0.4 * s, cy - 0.38 * s); g.lineTo(cx + 0.52 * s, cy - 0.46 * s); g.lineTo(cx + 0.4 * s, cy - 0.75 * s);
      break;
    }
    case 'spiral': {
      for (let i = 0; i <= 90; i++) {
        const a = (i / 90) * TAU * 2.6, r = (i / 90) * s * 0.85;
        const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
        i ? g.lineTo(x, y) : g.moveTo(x, y);
      }
      break;
    }
    case 'eye': {
      g.moveTo(cx - s * 0.9, cy); g.quadraticCurveTo(cx, cy - s * 0.8, cx + s * 0.9, cy); g.quadraticCurveTo(cx, cy + s * 0.8, cx - s * 0.9, cy);
      g.moveTo(cx + s * 0.25, cy); g.arc(cx, cy, s * 0.25, 0, TAU);
      break;
    }
    case 'zigzag': {
      for (let k = -1; k <= 1; k += 2) {
        for (let i = 0; i <= 8; i++) {
          const x = cx - s * 0.9 + (i / 8) * s * 1.8, y = cy + k * s * 0.25 + (i % 2 ? -1 : 1) * s * 0.2;
          i ? g.lineTo(x, y) : g.moveTo(x, y);
        }
      }
      break;
    }
    default: { // diamond
      g.moveTo(cx, cy - s * 0.8); g.lineTo(cx + s * 0.55, cy); g.lineTo(cx, cy + s * 0.8); g.lineTo(cx - s * 0.55, cy); g.closePath();
      g.moveTo(cx, cy - s * 0.35); g.lineTo(cx + s * 0.25, cy); g.lineTo(cx, cy + s * 0.35); g.lineTo(cx - s * 0.25, cy); g.closePath();
    }
  }
}

/** Engraved/relief look: light lower edge, dark upper edge, dark groove core. */
export function carveGlyph(g, kind, cx, cy, s, lw = Math.max(3, s * 0.07), fill = true) {
  g.save(); g.lineCap = 'round'; g.lineJoin = 'round';
  if (fill && (kind === 'sun' || kind === 'moon' || kind === 'mountain' || kind === 'diamond')) {
    glyphPath(g, kind, cx, cy, s); g.fillStyle = 'rgba(25,18,10,0.30)'; g.fill();
  }
  const pass = (dx, dy, style, w) => { g.save(); g.translate(dx, dy); glyphPath(g, kind, cx, cy, s); g.strokeStyle = style; g.lineWidth = w; g.stroke(); g.restore(); };
  pass(lw * 0.45, lw * 0.45, 'rgba(240,226,190,0.55)', lw);
  pass(-lw * 0.35, -lw * 0.35, 'rgba(8,6,3,0.6)', lw);
  pass(0, 0, 'rgba(34,26,16,0.92)', lw * 0.7);
  g.restore();
}

// ---------------------------------------------------------------------------------------------
// Painters

function paintPlanks(S, rand, base = [124, 96, 66], n = 8, wear = 1) {
  const [c, g] = cv(S), pw = S / n;
  for (let i = 0; i < n; i++) {
    const k = 0.7 + rand() * 0.5;
    g.fillStyle = rgbs(base[0], base[1], base[2], k); g.fillRect(i * pw, 0, pw, S);
    for (let j = 0; j < 16; j++) {
      const x = i * pw + rand() * pw;
      g.strokeStyle = `rgba(30,20,10,${0.05 + rand() * 0.14})`; g.lineWidth = 0.6 + rand() * 1.5;
      g.beginPath(); g.moveTo(x, 0); let xx = x;
      for (let y = 0; y <= S; y += S / 8) { xx += (rand() - 0.5) * 3; g.lineTo(xx, y); }
      g.stroke();
    }
    if (rand() < 0.55) {
      const kx = i * pw + pw * (0.25 + rand() * 0.5), ky = rand() * S, rx = 3 + rand() * 3, ry = 6 + rand() * 7;
      g.fillStyle = 'rgba(40,24,12,0.6)'; g.beginPath(); g.ellipse(kx, ky, rx, ry, 0, 0, TAU); g.fill();
      g.strokeStyle = 'rgba(40,24,12,0.22)'; g.lineWidth = 1.2;
      for (let r = 1; r <= 3; r++) { g.beginPath(); g.ellipse(kx, ky, rx + r * 3, ry + r * 6, 0, 0, TAU); g.stroke(); }
    }
    const jy = rand() * S; g.fillStyle = 'rgba(12,8,4,0.75)'; g.fillRect(i * pw, jy, pw, 2.5);
    g.fillStyle = 'rgba(15,12,10,0.8)';
    for (const ny of [jy - 10, jy + 12]) { g.beginPath(); g.arc(i * pw + pw * 0.25, ny, 1.8, 0, TAU); g.arc(i * pw + pw * 0.75, ny, 1.8, 0, TAU); g.fill(); }
  }
  g.fillStyle = 'rgba(10,6,3,0.85)';
  for (let i = 0; i <= n; i++) g.fillRect(i * pw - 1.5, 0, 3, S);
  blots(g, S, rand, 14 * wear, 25, 70, '30,24,16', 0.12, 0.32);
  blots(g, S, rand, 10 * wear, 25, 60, '170,165,150', 0.06, 0.18);
  streaks(g, S, rand, 20, '20,14,8', 0.2);
  grain(g, S, S, rand, 22);
  return c;
}

function paintPlaster(S, rand, base = [196, 184, 160], timber = false) {
  const [c, g] = cv(S);
  g.fillStyle = rgbs(...base); g.fillRect(0, 0, S, S);
  blots(g, S, rand, 40, 30, 90, '120,100,70', 0.05, 0.16);
  blots(g, S, rand, 22, 20, 60, '255,250,235', 0.05, 0.14);
  // peeled patches showing brick/stone underneath
  for (let i = 0; i < 6; i++) {
    const x = rand() * S, y = rand() * S, w = 30 + rand() * 60, h = 20 + rand() * 45;
    g.fillStyle = rgbs(140, 108, 86, 0.8 + rand() * 0.4); g.fillRect(x, y, w, h);
    g.strokeStyle = 'rgba(60,40,28,0.5)'; g.lineWidth = 1;
    for (let r = 0; r < h; r += 9) { g.beginPath(); g.moveTo(x, y + r); g.lineTo(x + w, y + r); g.stroke(); }
  }
  g.strokeStyle = 'rgba(50,40,28,0.5)'; g.lineWidth = 1.1;
  for (let i = 0; i < 9; i++) { // cracks
    let x = rand() * S, y = rand() * S; g.beginPath(); g.moveTo(x, y);
    for (let k = 0; k < 9; k++) { x += (rand() - 0.5) * 24; y += rand() * 20; g.lineTo(x, y); }
    g.stroke();
  }
  if (timber) {
    const half = S / 2, bw = S * 0.045;
    g.fillStyle = 'rgb(58,40,28)';
    for (const p of [0, half]) { g.fillRect(p - bw / 2, 0, bw, S); g.fillRect(0, p - bw / 2, S, bw); }
    g.fillRect(S - bw / 2, 0, bw, S); g.fillRect(0, S - bw / 2, S, bw);
    g.strokeStyle = 'rgb(58,40,28)'; g.lineWidth = bw * 0.8;
    g.beginPath(); g.moveTo(bw, half - bw); g.lineTo(half - bw, bw); g.moveTo(half + bw, S - bw); g.lineTo(S - bw, half + bw); g.stroke();
    g.fillStyle = 'rgba(0,0,0,0.25)'; // grain on beams
    for (let i = 0; i < 80; i++) g.fillRect(rand() * S, rand() * S, 1, 6 + rand() * 12);
  }
  streaks(g, S, rand, 30, '70,60,40', 0.22);
  blots(g, S, rand, 10, 20, 50, '80,110,60', 0.08, 0.2);
  grain(g, S, S, rand, 26);
  return c;
}

function paintStoneBlocks(S, rand, base = [128, 122, 112], rows = 6, moss = true) {
  const [c, g] = cv(S), rh = S / rows;
  g.fillStyle = 'rgb(36,32,28)'; g.fillRect(0, 0, S, S);
  for (let r = 0; r < rows; r++) {
    let x = -rand() * 60; const y = r * rh;
    while (x < S) {
      const w = 70 + rand() * 90, k = 0.72 + rand() * 0.5, tr = rand() * 0.1;
      const bx = x + 2, bw = Math.min(w, S + 80 - bx) - 4;
      g.fillStyle = rgbs(base[0] * (1 + tr), base[1], base[2] * (1 - tr), k);
      // draw wrapped
      for (const o of [0, -S]) {
        g.fillRect(bx + o, y + 2, bw, rh - 4);
        g.fillStyle = 'rgba(255,255,240,0.18)'; g.fillRect(bx + o, y + 2, bw, 3); g.fillRect(bx + o, y + 2, 3, rh - 4);
        g.fillStyle = 'rgba(0,0,0,0.28)'; g.fillRect(bx + o, y + rh - 6, bw, 4); g.fillRect(bx + o + bw - 4, y + 2, 4, rh - 4);
        g.fillStyle = rgbs(base[0], base[1], base[2], k);
      }
      x += w;
    }
  }
  blots(g, S, rand, 50, 10, 40, '30,26,20', 0.1, 0.3);
  blots(g, S, rand, 20, 10, 30, '200,196,180', 0.06, 0.18);
  if (moss) {
    blots(g, S, rand, 18, 18, 50, '70,100,45', 0.25, 0.5);
    for (let i = 0; i < 8; i++) blot(g, S, rand() * S, S - rand() * S * 0.25, 30 + rand() * 40, '60,92,40', 0.4);
  }
  streaks(g, S, rand, 16, '20,18,14', 0.25);
  grain(g, S, S, rand, 34);
  return c;
}

function paintTemple(S, rand, mode = 'plain') {
  const [c, g] = cv(S);
  const base = [168, 150, 112];
  g.fillStyle = 'rgb(46,40,30)'; g.fillRect(0, 0, S, S);
  const rows = 4, rh = S / rows;
  for (let r = 0; r < rows; r++) {
    const off = (r % 2) * (S / 4);
    for (let i = -1; i < 2; i++) {
      const bw = S / 2, bx = i * bw + off, k = 0.82 + rand() * 0.3;
      g.fillStyle = rgbs(base[0], base[1], base[2], k);
      g.fillRect(bx + 2, r * rh + 2, bw - 4, rh - 4);
      g.fillStyle = 'rgba(255,245,215,0.2)'; g.fillRect(bx + 2, r * rh + 2, bw - 4, 4);
      g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(bx + 2, r * rh + rh - 7, bw - 4, 5);
    }
  }
  if (mode === 'carved') {
    const kinds = ['sun', 'spiral', 'wave', 'eye', 'mountain', 'zigzag', 'moon', 'diamond'];
    const n = 4, cw = S / n;
    for (let r = 0; r < rows; r += 2) {
      for (let i = 0; i < n; i++) carveGlyph(g, kinds[(i + r * 2) % kinds.length], i * cw + cw / 2, r * rh + rh / 2, rh * 0.36, 5);
    }
  }
  blots(g, S, rand, 40, 14, 50, '40,34,22', 0.08, 0.25);
  blots(g, S, rand, 14, 20, 60, '75,105,48', 0.2, 0.42);
  blots(g, S, rand, 10, 14, 40, '215,200,160', 0.08, 0.18);
  streaks(g, S, rand, 18, '30,34,18', 0.28);
  grain(g, S, S, rand, 30);
  return c;
}

function paintFlag(S, rand) {
  const [c, g] = cv(S), n = 2, w = S / n;
  g.fillStyle = 'rgb(40,36,30)'; g.fillRect(0, 0, S, S);
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const k = 0.78 + rand() * 0.3;
    g.fillStyle = rgbs(158, 142, 108, k); g.fillRect(i * w + 3, j * w + 3, w - 6, w - 6);
    g.strokeStyle = 'rgba(30,24,16,0.4)'; g.lineWidth = 1.5; // inset border lines
    g.strokeRect(i * w + 18, j * w + 18, w - 36, w - 36);
    g.strokeStyle = 'rgba(40,30,20,0.55)'; g.lineWidth = 1.4; g.beginPath();
    let x = i * w + 20 + rand() * (w - 40), y = j * w + 10; g.moveTo(x, y);
    for (let q = 0; q < 8; q++) { x += (rand() - 0.5) * 30; y += rand() * 28; g.lineTo(x, y); }
    g.stroke();
  }
  blots(g, S, rand, 40, 14, 50, '30,28,18', 0.08, 0.25);
  blots(g, S, rand, 16, 20, 50, '75,110,48', 0.2, 0.4);
  grain(g, S, S, rand, 28);
  return c;
}

function paintConcrete(S, rand) {
  const [c, g] = cv(S);
  g.fillStyle = rgbs(128, 128, 124); g.fillRect(0, 0, S, S);
  blots(g, S, rand, 50, 20, 70, '60,60,56', 0.05, 0.16);
  blots(g, S, rand, 40, 20, 60, '190,190,180', 0.05, 0.14);
  for (let i = 0; i < 160; i++) { g.fillStyle = `rgba(30,30,28,${0.2 + rand() * 0.4})`; g.fillRect(rand() * S, rand() * S, 1 + rand() * 2.5, 1 + rand() * 2.5); }
  g.fillStyle = 'rgba(20,20,18,0.55)'; g.fillRect(0, 0, S, 2.5); g.fillRect(0, 0, 2.5, S); g.fillRect(S / 2 - 1, 0, 2, S);
  g.fillStyle = 'rgba(210,210,200,0.22)'; g.fillRect(0, 2.5, S, 2); g.fillRect(2.5, 0, 2, S);
  g.fillStyle = 'rgba(15,15,12,0.4)'; g.fillRect(0, S / 2 - 1, S, 2);
  streaks(g, S, rand, 34, '24,22,18', 0.3, 0.6);
  streaks(g, S, rand, 6, '120,66,30', 0.35, 0.25);
  blots(g, S, rand, 8, 25, 60, '70,95,55', 0.08, 0.2);
  grain(g, S, S, rand, 32);
  return c;
}

function paintRust(S, rand) {
  const [c, g] = cv(S);
  g.fillStyle = rgbs(112, 70, 40); g.fillRect(0, 0, S, S);
  blots(g, S, rand, 60, 14, 60, '150,82,36', 0.15, 0.45);
  blots(g, S, rand, 50, 14, 50, '60,36,22', 0.15, 0.4);
  blots(g, S, rand, 25, 10, 40, '168,150,120', 0.1, 0.3);
  streaks(g, S, rand, 40, '40,22,12', 0.4, 0.5);
  g.strokeStyle = 'rgba(210,190,160,0.3)'; g.lineWidth = 1;
  for (let i = 0; i < 22; i++) { const x = rand() * S, y = rand() * S, l = 10 + rand() * 40, a = rand() * TAU; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke(); }
  grain(g, S, S, rand, 40);
  return c;
}

function paintCorrugated(S, rand, base = [128, 134, 130]) {
  const [c, g] = cv(S), n = 16, pw = S / n;
  for (let i = 0; i < n; i++) {
    const gr = g.createLinearGradient(i * pw, 0, (i + 1) * pw, 0);
    gr.addColorStop(0, rgbs(...base, 0.55)); gr.addColorStop(0.5, rgbs(...base, 1.25)); gr.addColorStop(1, rgbs(...base, 0.55));
    g.fillStyle = gr; g.fillRect(i * pw, 0, pw, S);
  }
  blots(g, S, rand, 30, 14, 50, '130,70,34', 0.15, 0.5);
  blots(g, S, rand, 20, 14, 40, '40,40,38', 0.1, 0.3);
  streaks(g, S, rand, 40, '90,50,24', 0.35, 0.6);
  g.fillStyle = 'rgba(30,30,30,0.7)';
  for (let y = S / 4; y < S; y += S / 4) for (let i = 0; i < n; i += 2) { g.beginPath(); g.arc(i * pw + pw / 2, y, 2, 0, TAU); g.fill(); }
  grain(g, S, S, rand, 24);
  return c;
}

function paintPanel(S, rand) {
  const [c, g] = cv(S), cols = 4, rows = 2, pw = S / cols, ph = S / rows;
  for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
    const k = 0.9 + rand() * 0.14;
    g.fillStyle = rgbs(168, 178, 180, k); g.fillRect(i * pw, j * ph, pw, ph);
    const gr = g.createLinearGradient(0, j * ph, 0, (j + 1) * ph);
    gr.addColorStop(0, 'rgba(255,255,255,0.12)'); gr.addColorStop(1, 'rgba(0,0,0,0.12)'); g.fillStyle = gr; g.fillRect(i * pw, j * ph, pw, ph);
    g.fillStyle = 'rgba(60,70,74,0.6)';
    for (const [rx, ry] of [[10, 10], [pw - 10, 10], [10, ph - 10], [pw - 10, ph - 10]]) { g.beginPath(); g.arc(i * pw + rx, j * ph + ry, 2.6, 0, TAU); g.fill(); }
  }
  g.fillStyle = 'rgba(30,38,42,0.8)';
  for (let i = 0; i <= cols; i++) g.fillRect(i * pw - 1.5, 0, 3, S);
  for (let j = 0; j <= rows; j++) g.fillRect(0, j * ph - 1.5, S, 3);
  g.fillStyle = 'rgba(255,255,255,0.3)';
  for (let i = 0; i <= cols; i++) g.fillRect(i * pw + 1.5, 0, 1.5, S);
  streaks(g, S, rand, 40, '50,44,36', 0.3, 0.7);
  blots(g, S, rand, 14, 20, 60, '150,90,50', 0.1, 0.28);
  blots(g, S, rand, 14, 20, 60, '70,100,60', 0.06, 0.16);
  grain(g, S, S, rand, 20);
  return c;
}

function paintRoofTile(S, rand, mode = 'clay') {
  const [c, g] = cv(S), rows = 12, rh = S / rows, cols = 8, cw = S / cols;
  g.fillStyle = 'rgb(40,24,18)'; g.fillRect(0, 0, S, S);
  for (let r = 0; r < rows; r++) for (let i = -1; i < cols; i++) {
    const x = i * cw + (r % 2) * cw / 2, y = r * rh, k = 0.7 + rand() * 0.5;
    g.fillStyle = mode === 'clay' ? rgbs(170, 82, 52, k) : rgbs(84, 82, 80, k);
    g.beginPath(); g.moveTo(x + 2, y); g.lineTo(x + cw - 2, y); g.lineTo(x + cw - 2, y + rh * 0.65); g.quadraticCurveTo(x + cw / 2, y + rh * 1.25, x + 2, y + rh * 0.65); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(0,0,0,0.38)'; g.lineWidth = 1.5; g.stroke();
    const gr = g.createLinearGradient(x, y, x, y + rh); gr.addColorStop(0, 'rgba(0,0,0,0.35)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.05)'); gr.addColorStop(1, 'rgba(0,0,0,0.15)');
    g.fillStyle = gr; g.fill();
  }
  blots(g, S, rand, 26, 14, 45, '70,100,45', 0.25, 0.5);
  blots(g, S, rand, 16, 14, 40, '30,26,22', 0.15, 0.35);
  streaks(g, S, rand, 20, '20,16,12', 0.25);
  grain(g, S, S, rand, 28);
  return c;
}

function paintShingle(S, rand) {
  const [c, g] = cv(S), rows = 14, rh = S / rows, cols = 10, cw = S / cols;
  g.fillStyle = 'rgb(24,18,14)'; g.fillRect(0, 0, S, S);
  for (let r = 0; r < rows; r++) for (let i = -1; i < cols; i++) {
    const x = i * cw + (r % 2) * cw * 0.5 + (rand() - 0.5) * 3, y = r * rh, k = 0.6 + rand() * 0.55;
    g.fillStyle = rgbs(96, 82, 66, k); g.fillRect(x + 1.5, y, cw - 3, rh + 3);
    g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(x + 1.5, y + rh - 2, cw - 3, 5);
    g.strokeStyle = 'rgba(20,14,8,0.3)'; g.lineWidth = 1; g.beginPath(); g.moveTo(x + cw * 0.4, y); g.lineTo(x + cw * 0.4 + (rand() - 0.5) * 4, y + rh); g.stroke();
  }
  blots(g, S, rand, 24, 14, 45, '70,100,45', 0.2, 0.45);
  blots(g, S, rand, 24, 14, 45, '150,150,140', 0.05, 0.15);
  streaks(g, S, rand, 20, '20,16,12', 0.25);
  grain(g, S, S, rand, 28);
  return c;
}

function paintCloth(S, rand, base = [196, 184, 150]) {
  const [c, g] = cv(S);
  g.fillStyle = rgbs(...base); g.fillRect(0, 0, S, S);
  g.globalAlpha = 0.18;
  for (let i = 0; i < S; i += 3) { g.fillStyle = i % 6 ? '#000' : '#fff'; g.fillRect(i, 0, 1, S); g.fillRect(0, i, S, 1); }
  g.globalAlpha = 1;
  blots(g, S, rand, 16, 14, 50, '70,56,36', 0.12, 0.3);
  blots(g, S, rand, 10, 14, 40, '70,100,50', 0.1, 0.25);
  g.strokeStyle = 'rgba(40,30,20,0.45)'; g.lineWidth = 1.5; g.setLineDash([6, 4]);
  g.strokeRect(6, 6, S - 12, S - 12); g.setLineDash([]);
  grain(g, S, S, rand, 20);
  return c;
}

function paintCobble(S, rand) {
  const [c, g] = cv(S);
  g.fillStyle = 'rgb(48,40,30)'; g.fillRect(0, 0, S, S);
  const n = 9, cs = S / n;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const cx = (i + 0.5 + (j % 2) * 0.5) * cs + (rand() - 0.5) * 6, cy = (j + 0.5) * cs + (rand() - 0.5) * 6, k = 0.7 + rand() * 0.5;
    for (const ox of [0, -S, S]) {
      g.fillStyle = rgbs(132, 124, 108, k); g.beginPath(); g.ellipse(cx + ox, cy, cs * 0.46, cs * 0.4, rand() * 0.6, 0, TAU); g.fill();
      g.fillStyle = 'rgba(255,250,230,0.14)'; g.beginPath(); g.ellipse(cx + ox - 2, cy - 2, cs * 0.3, cs * 0.22, 0, 0, TAU); g.fill();
    }
  }
  blots(g, S, rand, 40, 14, 40, '70,60,36', 0.15, 0.4);
  blots(g, S, rand, 24, 14, 40, '70,105,45', 0.2, 0.45);
  grain(g, S, S, rand, 34);
  return c;
}

function paintEarth(S, rand) {
  const [c, g] = cv(S);
  g.fillStyle = rgbs(82, 106, 54); g.fillRect(0, 0, S, S);
  blots(g, S, rand, 90, 20, 70, '60,92,40', 0.2, 0.5);
  blots(g, S, rand, 70, 20, 60, '112,128,64', 0.15, 0.4);
  blots(g, S, rand, 30, 14, 40, '104,80,52', 0.15, 0.4);
  for (let i = 0; i < 900; i++) { g.strokeStyle = `rgba(${40 + rand() * 60},${80 + rand() * 60},40,0.5)`; g.lineWidth = 1; const x = rand() * S, y = rand() * S; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (rand() - 0.5) * 4, y - 3 - rand() * 5); g.stroke(); }
  grain(g, S, S, rand, 30);
  return c;
}

function paintRock(S, rand) {
  const [c, g] = cv(S);
  g.fillStyle = rgbs(92, 96, 104); g.fillRect(0, 0, S, S);
  blots(g, S, rand, 80, 14, 60, '30,34,44', 0.2, 0.5);
  blots(g, S, rand, 60, 14, 50, '100,108,120', 0.08, 0.22);
  blots(g, S, rand, 20, 14, 40, '44,70,66', 0.12, 0.3);
  streaks(g, S, rand, 40, '18,22,30', 0.4, 0.6);
  g.strokeStyle = 'rgba(12,14,20,0.6)'; g.lineWidth = 1.5;
  for (let i = 0; i < 14; i++) { let x = rand() * S, y = rand() * S; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 8; k++) { x += (rand() - 0.5) * 30; y += (rand() - 0.5) * 30; g.lineTo(x, y); } g.stroke(); }
  g.fillStyle = 'rgba(190,215,230,0.55)'; // wet glints
  for (let i = 0; i < 70; i++) g.fillRect(rand() * S, rand() * S, 1 + rand() * 2, 1 + rand() * 2);
  grain(g, S, S, rand, 34);
  return c;
}

function paintLeaves(rand) {
  const S = 128, [c, g] = cv(S);
  for (let i = 0; i < 42; i++) {
    const x = rand() * S, y = rand() * S, a = rand() * TAU, l = 9 + rand() * 10, w = 4 + rand() * 4, k = 0.6 + rand() * 0.6;
    g.save(); g.translate(x, y); g.rotate(a);
    g.fillStyle = rgbs(60, 104, 40, k); g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(l * 0.5, -w, l, 0); g.quadraticCurveTo(l * 0.5, w, 0, 0); g.fill();
    g.strokeStyle = 'rgba(20,50,16,0.7)'; g.lineWidth = 0.8; g.beginPath(); g.moveTo(0, 0); g.lineTo(l * 0.9, 0); g.stroke();
    g.restore();
  }
  g.strokeStyle = 'rgba(48,40,24,0.9)'; g.lineWidth = 1.4;
  for (let i = 0; i < 6; i++) { let x = rand() * S, y = 0; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 6; k++) { x += (rand() - 0.5) * 16; y += S / 6; g.lineTo(x, y); } g.stroke(); }
  return c;
}

function paintChain() {
  const S = 64, [c, g] = cv(S);
  g.strokeStyle = 'rgba(110,112,110,1)'; g.lineWidth = 2;
  g.beginPath();
  for (let i = -S; i <= S * 2; i += 16) { g.moveTo(i, 0); g.lineTo(i + S, S); g.moveTo(i + S, 0); g.lineTo(i, S); }
  g.stroke();
  return c;
}

function paintPaper(rand) {
  const S = 128, [c, g] = cv(S);
  g.fillStyle = 'rgb(226,218,190)'; g.fillRect(0, 0, S, S);
  g.fillStyle = 'rgba(40,36,30,0.7)';
  for (let y = 12; y < S - 8; y += 7) { let x = 10; while (x < S - 14) { const w = 4 + rand() * 12; g.fillRect(x, y, w, 1.6); x += w + 3; } }
  blots(g, S, rand, 5, 14, 40, '120,90,50', 0.1, 0.3);
  grain(g, S, S, rand, 14);
  return c;
}

function paintMap(rand) {
  const S = 256, [c, g] = cv(S);
  g.fillStyle = 'rgb(206,196,160)'; g.fillRect(0, 0, S, S);
  g.strokeStyle = 'rgba(60,70,50,0.55)'; g.lineWidth = 1;
  for (let k = 0; k < 7; k++) { g.beginPath(); for (let i = 0; i <= 24; i++) { const a = (i / 24) * TAU, r = 30 + k * 14 + Math.sin(a * 3 + k) * 8; const x = S * 0.5 + Math.cos(a) * r * 1.1, y = S * 0.5 + Math.sin(a) * r * 0.8; i ? g.lineTo(x, y) : g.moveTo(x, y); } g.closePath(); g.stroke(); }
  g.strokeStyle = 'rgba(40,70,140,0.7)'; g.lineWidth = 2; g.beginPath(); g.moveTo(10, 40); g.bezierCurveTo(90, 60, 120, 150, 240, 190); g.stroke();
  g.strokeStyle = 'rgba(150,40,30,0.8)'; g.lineWidth = 1.5; g.setLineDash([5, 4]); g.beginPath(); g.moveTo(30, 220); g.lineTo(120, 120); g.lineTo(200, 60); g.stroke(); g.setLineDash([]);
  g.fillStyle = 'rgba(150,40,30,0.9)'; for (const [x, y] of [[30, 220], [120, 120], [200, 60]]) { g.beginPath(); g.arc(x, y, 4, 0, TAU); g.fill(); }
  g.strokeStyle = 'rgba(0,0,0,0.5)'; g.lineWidth = 4; g.strokeRect(2, 2, S - 4, S - 4);
  grain(g, S, S, rand, 18);
  return c;
}

function paintDials() {
  const [c, g] = cv(256, 160);
  g.fillStyle = '#4b5a4a'; g.fillRect(0, 0, 256, 160);
  g.fillStyle = '#2a332a'; g.fillRect(8, 8, 240, 144);
  g.fillStyle = '#d8d4c0'; g.font = 'bold 15px monospace'; g.textAlign = 'center';
  g.fillText('NOODBAKEN', 128, 28);
  for (const x of [58, 128, 198]) {
    g.fillStyle = '#e8e2cc'; g.beginPath(); g.arc(x, 78, 24, 0, TAU); g.fill();
    g.strokeStyle = '#111'; g.lineWidth = 2; g.beginPath(); g.arc(x, 78, 24, 0, TAU); g.stroke();
    for (let i = 0; i < 9; i++) { const a = Math.PI * (0.8 + i * 0.175); g.beginPath(); g.moveTo(x + Math.cos(a) * 19, 78 + Math.sin(a) * 19); g.lineTo(x + Math.cos(a) * 23, 78 + Math.sin(a) * 23); g.stroke(); }
    const a = Math.PI * (0.9 + (x % 7) * 0.12); g.strokeStyle = '#a02015'; g.lineWidth = 2.4; g.beginPath(); g.moveTo(x, 78); g.lineTo(x + Math.cos(a) * 18, 78 + Math.sin(a) * 18); g.stroke();
  }
  g.fillStyle = '#111'; for (const x of [44, 80, 176, 212]) { g.beginPath(); g.arc(x, 128, 7, 0, TAU); g.fill(); g.fillStyle = '#bbb'; g.fillRect(x - 1, 120, 2, 8); g.fillStyle = '#111'; }
  return c;
}

/** Atlas of lettered signs. Rows of 128 px on a 1024x1024 canvas. */
export const SIGN_ROWS = ['kestrel', 'valdris', 'temple', 'bunker', 'forest', 'waterfall', 'k7a', 'k7b'];
function paintSigns(rand) {
  const W = 1024, H = 1024, RH = 128, [c, g] = cv(W, H);
  const defs = [
    ['STATION KESTREL', 'wood'], ['VALDRIS', 'wood'], ['ZONNETEMPEL', 'wood'], ['BUNKER K-7', 'wood'],
    ['FLUISTERWOUD', 'wood'], ['ZILVEREN WATERVAL', 'wood'], ['K-7  VERBODEN TOEGANG', 'hazard'], ['MILITAIR TERREIN', 'hazard'],
  ];
  defs.forEach(([text, style], i) => {
    const y = i * RH;
    if (style === 'wood') {
      g.fillStyle = 'rgb(112,86,58)'; g.fillRect(0, y, W, RH);
      for (let k = 0; k < 40; k++) { g.strokeStyle = `rgba(30,20,10,${0.08 + rand() * 0.15})`; g.lineWidth = 1 + rand() * 2; g.beginPath(); g.moveTo(0, y + rand() * RH); g.lineTo(W, y + rand() * RH); g.stroke(); }
      g.fillStyle = 'rgba(30,22,12,0.5)'; g.fillRect(0, y, W, 6); g.fillRect(0, y + RH - 6, W, 6);
      g.fillStyle = 'rgb(232,220,186)'; g.font = 'bold 66px Georgia, serif';
    } else {
      g.fillStyle = 'rgb(222,184,40)'; g.fillRect(0, y, W, RH);
      g.fillStyle = 'rgba(20,20,20,0.9)';
      for (let x = -RH; x < W; x += 54) { g.beginPath(); g.moveTo(x, y + RH); g.lineTo(x + 26, y + RH); g.lineTo(x + 26 + RH, y); g.lineTo(x + RH, y); g.fill(); }
      g.fillStyle = 'rgb(236,230,210)'; g.fillRect(48, y + 20, W - 96, RH - 40);
      g.fillStyle = 'rgb(160,24,18)'; g.font = 'bold 60px Arial, sans-serif';
    }
    g.textAlign = 'center'; g.textBaseline = 'middle';
    let fs = 66; g.font = g.font.replace(/\d+px/, fs + 'px');
    while (g.measureText(text).width > W - 140 && fs > 20) { fs -= 3; g.font = g.font.replace(/\d+px/, fs + 'px'); }
    g.fillText(text, W / 2, y + RH / 2 + 3);
    blots(g, W, rand, 0, 1, 2, '0,0,0', 0, 0);
  });
  streaks(g, W, rand, 50, '40,30,20', 0.25, 0.15);
  blots(g, W, rand, 30, 20, 70, '60,60,40', 0.05, 0.2);
  grain(g, W, H, rand, 24);
  return c;
}

function paintGlyphFace(kind, rand) {
  const W = 320, H = 704, [c, g] = cv(W, H);
  g.fillStyle = rgbs(166, 150, 116); g.fillRect(0, 0, W, H);
  const gr = g.createLinearGradient(0, 0, W, 0); gr.addColorStop(0, 'rgba(0,0,0,0.18)'); gr.addColorStop(0.15, 'rgba(0,0,0,0)'); gr.addColorStop(0.85, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.2)');
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 80; i++) blot(g, W, rand() * W, rand() * H, 10 + rand() * 40, rand() < 0.5 ? '40,34,22' : '215,200,160', 0.08 + rand() * 0.15);
  for (let i = 0; i < 10; i++) { // moss lower down
    const x = rand() * W, y = H * (0.6 + rand() * 0.4); const r = 20 + rand() * 40;
    const gg = g.createRadialGradient(x, y, 0, x, y, r); gg.addColorStop(0, 'rgba(70,104,44,0.5)'); gg.addColorStop(1, 'rgba(70,104,44,0)'); g.fillStyle = gg; g.fillRect(x - r, y - r, 2 * r, 2 * r);
  }
  g.lineJoin = 'round';
  const frame = (inset, lw) => { g.save(); g.translate(0, 0); g.strokeStyle = 'rgba(235,220,185,0.5)'; g.lineWidth = lw; g.strokeRect(inset + 1.5, inset + 1.5, W - 2 * inset, H - 2 * inset); g.strokeStyle = 'rgba(8,6,3,0.7)'; g.strokeRect(inset - 1, inset - 1, W - 2 * inset, H - 2 * inset); g.restore(); };
  frame(14, 4); frame(34, 2);
  // glyph medallion
  const cy = H * 0.46;
  g.save(); g.strokeStyle = 'rgba(20,14,8,0.75)'; g.lineWidth = 5; g.beginPath(); g.arc(W / 2, cy, 138, 0, TAU); g.stroke();
  g.strokeStyle = 'rgba(235,220,185,0.4)'; g.lineWidth = 3; g.beginPath(); g.arc(W / 2 + 2, cy + 2, 138, 0, TAU); g.stroke(); g.restore();
  carveGlyph(g, kind, W / 2, cy, 104, 11);
  // small ornaments top/bottom
  carveGlyph(g, 'diamond', W / 2, 74, 26, 4); carveGlyph(g, 'diamond', W / 2, H - 74, 26, 4);
  carveGlyph(g, 'zigzag', W / 2, H - 150, 44, 4);
  grain(g, W, H, rand, 26);
  return c;
}

function paintSunRelief(rand) {
  const S = 512, [c, g] = cv(S);
  g.fillStyle = rgbs(160, 142, 106); g.fillRect(0, 0, S, S);
  for (let i = 0; i < 60; i++) blot(g, S, rand() * S, rand() * S, 14 + rand() * 40, rand() < 0.5 ? '40,34,22' : '220,205,165', 0.08 + rand() * 0.15);
  const cx = S / 2, cy = S / 2;
  for (const [r, lw] of [[236, 6], [214, 3], [120, 8], [96, 4]]) { g.strokeStyle = 'rgba(20,14,8,0.8)'; g.lineWidth = lw; g.beginPath(); g.arc(cx, cy, r, 0, TAU); g.stroke(); g.strokeStyle = 'rgba(235,220,185,0.45)'; g.lineWidth = lw * 0.6; g.beginPath(); g.arc(cx + 2, cy + 2, r, 0, TAU); g.stroke(); }
  for (let i = 0; i < 24; i++) { // rays
    const a = (i / 24) * TAU, long = i % 2 === 0;
    const r0 = 126, r1 = long ? 206 : 170, w = long ? 0.07 : 0.05;
    g.fillStyle = 'rgba(30,22,12,0.55)'; g.beginPath(); g.moveTo(cx + Math.cos(a - w) * r0, cy + Math.sin(a - w) * r0); g.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1); g.lineTo(cx + Math.cos(a + w) * r0, cy + Math.sin(a + w) * r0); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(235,220,185,0.4)'; g.lineWidth = 1.5; g.stroke();
  }
  g.fillStyle = 'rgba(26,18,10,0.35)'; g.beginPath(); g.arc(cx, cy, 90, 0, TAU); g.fill();
  carveGlyph(g, 'eye', cx, cy, 70, 7);
  grain(g, S, S, rand, 28);
  return c;
}

// ---------------------------------------------------------------------------------------------

/**
 * Creates the shared material library.
 * @returns {{ M: Object<string, THREE.Material>, tile: Object<string, number>, noShadow: Set<string>, glyph: THREE.MeshStandardMaterial[], dispose(): void }}
 */
export function createMaterials(opts = {}) {
  const b = buildMaterials(opts);
  for (const job of b.jobs) job();
  return b.finish();
}

/** Same library, but yields to the browser between the texture-painting steps so the loading screen keeps animating. */
export async function createMaterialsAsync(opts = {}) {
  const b = buildMaterials(opts);
  for (const job of b.jobs) { job(); await new Promise((r) => setTimeout(r, 0)); }
  return b.finish();
}

function buildMaterials({ renderer, quality = 'medium' } = {}) {
  const rand = mulberry32(90210);
  const S = quality === 'low' ? 256 : 512;
  const aniso = Math.min(QUALITY_PRESETS[quality]?.maxAnisotropy || 8, renderer?.capabilities?.getMaxAnisotropy?.() || 1);
  const textures = [];
  const T = (canvas, repeat = true) => {
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = aniso;
    if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
    textures.push(t); return t;
  };
  const std = (map, o = {}) => new THREE.MeshStandardMaterial({ map, vertexColors: true, roughness: 0.9, metalness: 0, ...o });
  const bump = (m, s) => { m.bumpMap = m.map; m.bumpScale = s; return m; };

  const M = {};
  const tile = {};
  const def = (key, material, tileSize) => { M[key] = material; tile[key] = tileSize; material.name = key; };

  const jobs = [
    () => { def('wood', bump(std(T(paintPlanks(S, rand, [124, 96, 66])), { roughness: 0.92 }), 1.2), 2); },
    () => { def('woodDark', bump(std(T(paintPlanks(S, rand, [78, 58, 40], 6, 1.4)), { roughness: 0.92 }), 1.2), 2); },
    () => { def('plaster', bump(std(T(paintPlaster(S, rand, [198, 186, 160])), { roughness: 0.95 }), 0.8), 3); },
    () => { def('timber', bump(std(T(paintPlaster(S, rand, [190, 176, 148], true)), { roughness: 0.95 }), 0.8), 3); },
    () => { def('stone', bump(std(T(paintStoneBlocks(S, rand)), { roughness: 0.95 }), 2.2), 2.4); },
    () => { def('stoneDark', bump(std(T(paintStoneBlocks(S, rand, [96, 96, 92], 5, true)), { roughness: 0.95 }), 2.2), 2.4); },
    () => { def('temple', bump(std(T(paintTemple(S, rand)), { roughness: 0.92 }), 2.5), 3); },
    () => { def('templeCarved', bump(std(T(paintTemple(S, rand, 'carved')), { roughness: 0.92 }), 2.5), 3); },
    () => { def('flag', bump(std(T(paintFlag(S, rand)), { roughness: 0.9 }), 2), 3); },
    () => { def('concrete', bump(std(T(paintConcrete(S, rand)), { roughness: 0.95 }), 1), 3); },
    () => { def('rust', bump(std(T(paintRust(S, rand)), { roughness: 0.7, metalness: 0.35 }), 0.8), 2); },
    () => { def('corrugated', bump(std(T(paintCorrugated(S, rand)), { roughness: 0.6, metalness: 0.4 }), 1.4), 2); },
    () => { def('panel', std(T(paintPanel(S, rand)), { roughness: 0.55, metalness: 0.35 }), 3); },
    () => { def('dish', Object.assign(M.panel.clone(), { side: THREE.DoubleSide }), 3); },
    () => { def('tile', bump(std(T(paintRoofTile(S, rand, 'clay')), { roughness: 0.85 }), 1.4), 2); },
    () => { def('slate', bump(std(T(paintRoofTile(S, rand, 'slate')), { roughness: 0.85 }), 1.4), 2); },
    () => { def('shingle', bump(std(T(paintShingle(S, rand)), { roughness: 0.95 }), 1.2), 2); },
    () => { def('cloth', std(T(paintCloth(Math.min(S, 256), rand)), { roughness: 1, side: THREE.DoubleSide }), 1.5); },
    () => { def('cobble', bump(std(T(paintCobble(S, rand)), { roughness: 0.95 }), 2), 3); },
    () => { def('earth', std(T(paintEarth(S, rand)), { roughness: 1 }), 6); },
    () => { def('rock', bump(std(T(paintRock(S, rand)), { roughness: 0.55, metalness: 0.05, side: THREE.DoubleSide }), 2.5), 4); },
    () => { def('steel', std(null, { color: 0x4a4e52, roughness: 0.45, metalness: 0.75 }), 2); },
    () => { def('black', std(null, { color: 0x151515, roughness: 0.7, metalness: 0.2 }), 2); },
    () => { def('paper', std(T(paintPaper(rand)), { roughness: 1, side: THREE.DoubleSide }), 1); },
    () => { def('map', std(T(paintMap(rand)), { roughness: 1, side: THREE.DoubleSide }), 1); },
    () => { def('dials', std(T(paintDials(), false), { roughness: 0.6 }), 1); },
    () => { def('signs', std(T(paintSigns(rand), false), { roughness: 0.85, side: THREE.DoubleSide }), 1); },
    () => { def('sunRelief', bump(std(T(paintSunRelief(rand), false), { roughness: 0.92 }), 2.5), 1); },
    () => { def('ivy', std(T(paintLeaves(rand)), { roughness: 0.9, side: THREE.DoubleSide, alphaTest: 0.5 }), 1.5); },
    () => { def('chain', std(T(paintChain()), { roughness: 0.6, metalness: 0.6, side: THREE.DoubleSide, alphaTest: 0.5 }), 2); },
    () => { def('glass', new THREE.MeshStandardMaterial({ color: 0x9fb8c0, roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.32, depthWrite: false, side: THREE.DoubleSide, vertexColors: true }), 2); },
    () => { def('lampOff', std(null, { color: 0xddd8c0, emissive: 0xfff2c8, emissiveIntensity: 0, roughness: 0.4 }), 1); },
    () => { def('ember', std(null, { color: 0x2a1408, emissive: 0xff5a14, emissiveIntensity: 1.4, roughness: 0.6 }), 1); },
    () => { M.ivy.shadowSide = THREE.DoubleSide; },
  ];

  const noShadow = new Set(['glass', 'ivy', 'chain', 'ember', 'rock']);

  function finish() {
    // glyph pillar faces (own materials, not vertex coloured) – painted after all jobs to keep the random sequence
    const glyph = ['sun', 'moon', 'wave', 'mountain'].map((k) => {
      const m = new THREE.MeshStandardMaterial({ map: T(paintGlyphFace(k, rand), false), roughness: 0.92 });
      m.bumpMap = m.map; m.bumpScale = 2.5; m.name = 'glyph_' + k; return m;
    });
    const pillarStone = new THREE.MeshStandardMaterial({ map: T(paintTemple(S, rand)), roughness: 0.92, name: 'pillarStone' });
    pillarStone.map.wrapS = pillarStone.map.wrapT = THREE.RepeatWrapping;
    return {
      M, tile, noShadow, glyph, pillarStone,
      dispose() { textures.forEach((t) => t.dispose()); Object.values(M).forEach((m) => m.dispose()); glyph.forEach((m) => m.dispose()); pillarStone.dispose(); },
    };
  }
  return { jobs, finish };
}

export { cv, grain, blot, blots, streaks, paintPlanks };
