// Procedural textures for terrain, bark, leaves and particles (canvas / DataTexture, no external files).
import * as THREE from 'three';
import { mulberry32, WORLD_SEED } from '../layout.js';
import { hash2, clamp, sstep } from './noise.js';

// ---- periodic value noise (u,v in [0,1) with integer cell periods) -------------------------------------
function pn(u, v, px, py, seed) {
  const x = u * px, y = v * py;
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = x - ix, fy = y - iy;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const x0 = ((ix % px) + px) % px, x1 = (x0 + 1) % px, y0 = ((iy % py) + py) % py, y1 = (y0 + 1) % py;
  const a = hash2(x0, y0, seed), b = hash2(x1, y0, seed), c = hash2(x0, y1, seed), d = hash2(x1, y1, seed);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}
function pfbm(u, v, px, py, oct, seed) {
  let amp = 0.5, sum = 0, norm = 0;
  for (let o = 0; o < oct; o++) { sum += amp * pn(u, v, px << o, py << o, seed + o * 31); norm += amp; amp *= 0.5; }
  return sum / norm;
}
/** Periodic cellular noise: returns [F1, F2-F1]. */
function worley(u, v, n, seed) {
  const x = u * n, y = v * n, ix = Math.floor(x), iy = Math.floor(y);
  let f1 = 9, f2 = 9;
  for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
    const cx = ix + i, cy = iy + j;
    const wx = ((cx % n) + n) % n, wy = ((cy % n) + n) % n;
    const px = cx + hash2(wx, wy, seed), py = cy + hash2(wx, wy, seed + 7);
    const d = Math.hypot(x - px, y - py);
    if (d < f1) { f2 = f1; f1 = d; } else if (d < f2) f2 = d;
  }
  return [f1, f2 - f1];
}

function makeCanvas(w, h = w) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}
/** Draws fn(ox, oy) for each wrapped copy (so strokes crossing the border tile seamlessly). */
function wrapped(size, x, y, r, fn) {
  for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
    const X = x + ox * size, Y = y + oy * size;
    if (X + r < 0 || X - r > size || Y + r < 0 || Y - r > size) continue;
    fn(ox * size, oy * size);
  }
}
const mixc = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const rgb = (c, k = 1) => `rgb(${clamp(c[0] * k, 0, 255) | 0},${clamp(c[1] * k, 0, 255) | 0},${clamp(c[2] * k, 0, 255) | 0})`;

function finishTexture(canvas, { srgb = true, maxAniso = 8, repeat = true } = {}) {
  const t = new THREE.CanvasTexture(canvas);
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = maxAniso;
  t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter;
  t.generateMipmaps = true;
  t.needsUpdate = true;
  return t;
}

function paintBase(size, fn) {
  const canvas = makeCanvas(size), ctx = canvas.getContext('2d');
  const img = ctx.createImageData(size, size), d = img.data;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const c = fn(x / size, y / size);
    const k = (y * size + x) * 4;
    d[k] = c[0]; d[k + 1] = c[1]; d[k + 2] = c[2]; d[k + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return { canvas, ctx };
}

// ---- terrain tiles ----------------------------------------------------------------------------------
function grassTile(size, rand) {
  const dark = [38, 64, 24], mid = [66, 98, 34], light = [104, 134, 52], dry = [128, 130, 62];
  const { canvas, ctx } = paintBase(size, (u, v) => {
    const n = pfbm(u, v, 6, 6, 5, 11), m = pn(u, v, 3, 3, 5);
    let c = mixc(dark, mid, sstep(0.25, 0.7, n));
    c = mixc(c, light, sstep(0.62, 0.9, n) * 0.55);
    c = mixc(c, dry, sstep(0.55, 0.85, m) * 0.28);
    return c;
  });
  ctx.lineCap = 'round';
  for (let i = 0; i < 9000; i++) {
    const x = rand() * size, y = rand() * size, a = rand() * Math.PI * 2, l = 5 + rand() * 11;
    const t = rand();
    const c = mixc(mixc(dark, mid, t), light, rand() * rand());
    ctx.strokeStyle = rgb(c, 0.85 + rand() * 0.35); ctx.lineWidth = 0.8 + rand() * 1.2;
    wrapped(size, x, y, l, (ox, oy) => {
      ctx.beginPath(); ctx.moveTo(x + ox, y + oy);
      ctx.quadraticCurveTo(x + ox + Math.cos(a) * l * 0.5 + 2, y + oy + Math.sin(a) * l * 0.5, x + ox + Math.cos(a) * l, y + oy + Math.sin(a) * l);
      ctx.stroke();
    });
  }
  return canvas;
}

function forestTile(size, rand) {
  const soil = [34, 28, 19], moss = [38, 54, 24], dark = [20, 17, 12];
  const { canvas, ctx } = paintBase(size, (u, v) => {
    const n = pfbm(u, v, 7, 7, 5, 21), m = pfbm(u, v, 3, 3, 4, 23);
    let c = mixc(dark, soil, sstep(0.2, 0.7, n));
    c = mixc(c, moss, sstep(0.55, 0.8, m) * 0.7);
    return c;
  });
  ctx.lineCap = 'round';
  const leafCols = [[84, 66, 36], [98, 78, 42], [70, 56, 32], [108, 90, 50], [58, 48, 30], [88, 62, 34], [62, 70, 36]];
  for (let i = 0; i < 1500; i++) { // needles
    const x = rand() * size, y = rand() * size, a = rand() * Math.PI * 2, l = 5 + rand() * 9;
    ctx.strokeStyle = rgb(mixc([96, 70, 38], [56, 42, 24], rand()), 0.8 + rand() * 0.4); ctx.lineWidth = 1 + rand() * 0.8;
    wrapped(size, x, y, l, (ox, oy) => { ctx.beginPath(); ctx.moveTo(x + ox, y + oy); ctx.lineTo(x + ox + Math.cos(a) * l, y + oy + Math.sin(a) * l); ctx.stroke(); });
  }
  for (let i = 0; i < 640; i++) { // leaves
    const x = rand() * size, y = rand() * size, a = rand() * Math.PI, rx = 3.5 + rand() * 5.5, ry = rx * (0.4 + rand() * 0.2);
    const c = leafCols[(rand() * leafCols.length) | 0];
    wrapped(size, x, y, rx, (ox, oy) => {
      ctx.fillStyle = rgb(c, 0.7 + rand() * 0.5);
      ctx.beginPath(); ctx.ellipse(x + ox, y + oy, rx, ry, a, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(30,20,10,0.35)'; ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.moveTo(x + ox - Math.cos(a) * rx, y + oy - Math.sin(a) * rx); ctx.lineTo(x + ox + Math.cos(a) * rx, y + oy + Math.sin(a) * rx); ctx.stroke();
    });
  }
  for (let i = 0; i < 60; i++) { // twigs
    const x = rand() * size, y = rand() * size, a = rand() * Math.PI, l = 18 + rand() * 30;
    ctx.strokeStyle = rgb([70, 52, 36], 0.7 + rand() * 0.4); ctx.lineWidth = 1.5 + rand() * 1.5;
    wrapped(size, x, y, l, (ox, oy) => { ctx.beginPath(); ctx.moveTo(x + ox, y + oy); ctx.lineTo(x + ox + Math.cos(a) * l, y + oy + Math.sin(a) * l); ctx.stroke(); });
  }
  return canvas;
}

function dirtTile(size, rand) {
  const a = [82, 62, 42], b = [112, 88, 60], c = [58, 44, 30];
  const { canvas, ctx } = paintBase(size, (u, v) => {
    const n = pfbm(u, v, 5, 5, 6, 31), m = pfbm(u, v, 14, 14, 3, 33);
    let col = mixc(c, a, sstep(0.25, 0.55, n));
    col = mixc(col, b, sstep(0.5, 0.85, n) * 0.8);
    const k = 0.85 + 0.3 * m;
    return [col[0] * k, col[1] * k, col[2] * k];
  });
  for (let i = 0; i < 420; i++) { // pebbles
    const x = rand() * size, y = rand() * size, r = 1.5 + rand() * rand() * 6;
    const g = 70 + rand() * 60, tint = rand();
    wrapped(size, x, y, r + 2, (ox, oy) => {
      ctx.fillStyle = 'rgba(20,14,8,0.35)'; ctx.beginPath(); ctx.ellipse(x + ox + 1, y + oy + 1.5, r * 1.1, r * 0.8, 0.4, 0, 7); ctx.fill();
      ctx.fillStyle = rgb([g + tint * 25, g + tint * 8, g - tint * 15]); ctx.beginPath(); ctx.ellipse(x + ox, y + oy, r, r * 0.78, 0.4, 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,240,0.12)'; ctx.beginPath(); ctx.ellipse(x + ox - r * 0.2, y + oy - r * 0.25, r * 0.5, r * 0.3, 0.4, 0, 7); ctx.fill();
    });
  }
  return canvas;
}

function rockTile(size) {
  const { canvas } = paintBase(size, (u, v) => {
    const warp = pfbm(u, v, 4, 4, 3, 41);
    const strata = pn(u + warp * 0.08, v, 3, 22, 43) * 0.6 + pn(u, v + warp * 0.05, 8, 40, 45) * 0.4;
    const n = pfbm(u, v, 6, 6, 5, 47);
    const [f1, edge] = worley(u + warp * 0.05, v, 7, 49);
    const crack = 1 - sstep(0.0, 0.07, edge);
    let k = 0.62 + 0.35 * n + 0.28 * (strata - 0.5) - 0.2 * crack - 0.08 * (1 - sstep(0, 0.5, f1));
    const warm = pn(u, v, 4, 4, 51);
    return [(100 + 18 * warm) * k * 1.25, (96 + 10 * warm) * k * 1.25, (90 - 6 * warm) * k * 1.25];
  });
  return canvas;
}

function sandTile(size, rand) {
  const { canvas, ctx } = paintBase(size, (u, v) => {
    const n = pfbm(u, v, 8, 8, 5, 61);
    const rip = 0.5 + 0.5 * Math.sin((v * 22 + pn(u, v, 4, 4, 63) * 5) * Math.PI * 2 / 3);
    const k = 0.84 + 0.2 * n + 0.07 * rip;
    return [196 * k, 176 * k, 128 * k];
  });
  for (let i = 0; i < 2500; i++) {
    const x = rand() * size, y = rand() * size, g = 90 + rand() * 120;
    ctx.fillStyle = `rgba(${g},${g * 0.9},${g * 0.7},0.45)`;
    ctx.fillRect(x, y, 1 + rand(), 1 + rand());
  }
  return canvas;
}

function macroTile(size) {
  const canvas = makeCanvas(size), ctx = canvas.getContext('2d');
  const img = ctx.createImageData(size, size), d = img.data;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = x / size, v = y / size, k = (y * size + x) * 4;
    d[k] = pfbm(u, v, 4, 4, 5, 71) * 255; d[k + 1] = pfbm(u, v, 6, 6, 4, 73) * 255; d[k + 2] = pfbm(u, v, 12, 12, 3, 75) * 255; d[k + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

/**
 * Tiling terrain textures: { grass, forest, dirt, rock, sand, macro }.
 * @param {number} maxAniso
 * @param {number} size
 */
export function createTerrainTextures(maxAniso = 8, size = 512) {
  const rand = mulberry32(WORLD_SEED + 900);
  return {
    grass: finishTexture(grassTile(size, rand), { maxAniso }),
    forest: finishTexture(forestTile(size, rand), { maxAniso }),
    dirt: finishTexture(dirtTile(size, rand), { maxAniso }),
    rock: finishTexture(rockTile(size), { maxAniso }),
    sand: finishTexture(sandTile(size, rand), { maxAniso }),
    macro: finishTexture(macroTile(256), { srgb: false, maxAniso: 4 }),
  };
}

// ---- flora atlas (bark strips + leaf cards) ----------------------------------------------------------
export const ATLAS = 1024;
/** Pixel rectangles of the flora atlas ({x,y,w,h}, y from the top). */
export const CELLS = {
  bark: { x: 0, y: 0, w: 256, h: 1024 },
  birch: { x: 256, y: 0, w: 256, h: 1024 },
  spruce: { x: 512, y: 0, w: 256, h: 256 },
  oak: { x: 768, y: 0, w: 256, h: 256 },
  birchLeaf: { x: 512, y: 256, w: 256, h: 256 },
  fern: { x: 768, y: 256, w: 256, h: 256 },
  bush: { x: 512, y: 512, w: 256, h: 256 },
  white: { x: 768, y: 512, w: 256, h: 256 },
  rings: { x: 512, y: 768, w: 256, h: 256 },
  grass: { x: 768, y: 768, w: 256, h: 256 },
};
const STRIP_PERIOD = 250;

/** UV for a point (cu,cv in 0..1 of the cell; cv from the top of the cell) – DataTexture, flipY=false. */
export function cellUV(cell, cu, cv, out = [0, 0]) {
  const c = CELLS[cell];
  const pad = 3;
  out[0] = (c.x + pad + cu * (c.w - 2 * pad)) / ATLAS;
  out[1] = (c.y + pad + cv * (c.h - 2 * pad)) / ATLAS;
  return out;
}
/** UV for bark: u in 0..1 around the trunk, v along the trunk (0..1 spans the whole strip height). */
export function barkUV(kind, u, v, out = [0, 0]) {
  const c = CELLS[kind];
  out[0] = (c.x + 3 + u * STRIP_PERIOD) / ATLAS;
  out[1] = (c.y + v * c.h) / ATLAS;
  return out;
}

function paintBark(ctx, cell, rand, birch) {
  const img = ctx.createImageData(cell.w, cell.h), d = img.data;
  for (let y = 0; y < cell.h; y++) for (let x = 0; x < cell.w; x++) {
    const u = (x % STRIP_PERIOD) / STRIP_PERIOD, v = y / cell.h;
    let r, g, b;
    if (!birch) {
      const plates = pfbm(u, v, 10, 3, 3, 81);
      const warp = pn(u, v, 5, 6, 83) * 0.06;
      const fis = pfbm(u + warp, v, 26, 6, 3, 85);
      const fissure = 1 - sstep(0.0, 0.16, Math.abs(fis - 0.5));
      const grain = pn(u, v, 60, 12, 87);
      let k = 0.62 + 0.55 * plates - 0.5 * fissure + 0.18 * (grain - 0.5);
      const lichen = sstep(0.62, 0.8, pfbm(u, v, 5, 5, 3, 89)) * 0.5;
      r = 78 * k; g = 60 * k; b = 44 * k;
      r += (60 - r) * lichen * 0.4; g += (84 - g) * lichen * 0.5; b += (44 - b) * lichen * 0.3;
    } else {
      const base = 0.86 + 0.14 * pfbm(u, v, 8, 6, 3, 91);
      const bands = sstep(0.68, 0.8, pn(u, v, 3, 64, 93)) * sstep(0.3, 0.55, pn(u, v, 9, 7, 95));
      const small = sstep(0.8, 0.92, pn(u, v, 14, 90, 97)) * 0.6;
      const peel = sstep(0.75, 0.9, pn(u, v, 5, 30, 99)) * 0.25;
      const dark = clamp(bands + small, 0, 1);
      const k = base * (1 - peel);
      r = 232 * k * (1 - dark) + 28 * dark; g = 226 * k * (1 - dark) + 26 * dark; b = 214 * k * (1 - dark) + 24 * dark;
    }
    const idx = (y * cell.w + x) * 4;
    d[idx] = r; d[idx + 1] = g; d[idx + 2] = b; d[idx + 3] = 255;
  }
  ctx.putImageData(img, cell.x, cell.y);
}

function leafPath(ctx, x, y, len, wid, ang) {
  const c = Math.cos(ang), s = Math.sin(ang);
  const P = (a, b) => [x + c * a - s * b, y + s * a + c * b];
  ctx.beginPath();
  let p = P(0, 0); ctx.moveTo(p[0], p[1]);
  let q = P(len * 0.5, wid), e = P(len, 0);
  ctx.quadraticCurveTo(q[0], q[1], e[0], e[1]);
  q = P(len * 0.5, -wid); p = P(0, 0);
  ctx.quadraticCurveTo(q[0], q[1], p[0], p[1]);
  ctx.closePath();
}

function paintSpruce(ctx, cell, rand) {
  ctx.save(); ctx.translate(cell.x, cell.y); ctx.lineCap = 'round';
  const cx = 128;
  ctx.strokeStyle = 'rgb(78,56,38)'; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(cx, 252); ctx.lineTo(cx, 6); ctx.stroke();
  for (let y = 250; y > 8; y -= 2.2) {
    const t = (250 - y) / 242;
    const maxLen = 116 * Math.pow(clamp(Math.sin(Math.PI * (0.06 + 0.9 * t)), 0.1, 1), 0.85);
    for (const side of [-1, 1]) {
      const len = maxLen * (0.78 + rand() * 0.25);
      const ang = -Math.PI / 2 + side * (0.95 + rand() * 0.25 - 0.3 * t); // forward sweep
      const droop = 0.18 * side;
      for (let n = -1; n <= 1; n++) {
        const a = ang + n * 0.14 + droop * 0.2;
        const g = 0.8 + rand() * 0.45;
        ctx.strokeStyle = `rgb(${(24 + rand() * 20) * g | 0},${(66 + rand() * 40) * g | 0},${(30 + rand() * 18) * g | 0})`;
        ctx.lineWidth = 2.2 + rand() * 1.2;
        ctx.beginPath(); ctx.moveTo(cx, y);
        ctx.quadraticCurveTo(cx + Math.cos(a) * len * 0.55, y + Math.sin(a) * len * 0.55 + 4, cx + Math.cos(a) * len, y + Math.sin(a) * len + 8);
        ctx.stroke();
      }
    }
  }
  ctx.restore();
}

function paintLeafCluster(ctx, cell, rand, opts) {
  const { count, size, colors, radius, twig } = opts;
  ctx.save(); ctx.translate(cell.x, cell.y);
  if (twig) {
    ctx.strokeStyle = 'rgb(58,44,30)'; ctx.lineCap = 'round';
    for (let i = 0; i < 9; i++) {
      const a = rand() * Math.PI * 2, r = radius * (0.5 + rand() * 0.5);
      ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(128, 128); ctx.lineTo(128 + Math.cos(a) * r, 128 + Math.sin(a) * r); ctx.stroke();
    }
  }
  for (let i = 0; i < count; i++) {
    const a = rand() * Math.PI * 2, r = Math.sqrt(rand()) * radius * (0.8 + 0.2 * Math.sin(a * 5 + 2));
    const x = 128 + Math.cos(a) * r, y = 128 + Math.sin(a) * r * 0.92;
    const len = size * (0.75 + rand() * 0.5), wid = len * (0.32 + rand() * 0.1), ang = rand() * Math.PI * 2;
    const shade = 0.62 + 0.55 * (1 - (y / 256)) * (0.6 + rand() * 0.6);
    const c = colors[(rand() * colors.length) | 0];
    ctx.fillStyle = rgb(c, shade);
    leafPath(ctx, x, y, len, wid, ang); ctx.fill();
    ctx.strokeStyle = rgb(c, shade * 0.62); ctx.lineWidth = 0.9; ctx.stroke();
    ctx.strokeStyle = rgb(mixc(c, [235, 235, 160], 0.4), shade * 0.95); ctx.lineWidth = 0.9;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(ang) * len * 0.9, y + Math.sin(ang) * len * 0.9); ctx.stroke();
  }
  ctx.restore();
}

function paintFern(ctx, cell, rand) {
  ctx.save(); ctx.translate(cell.x, cell.y); ctx.lineCap = 'round';
  const pts = (t) => [128 + Math.sin(t * 1.4) * 14 * t, 250 - t * 240];
  ctx.strokeStyle = 'rgb(52,86,34)'; ctx.lineWidth = 3;
  ctx.beginPath(); for (let t = 0; t <= 1.001; t += 0.05) { const p = pts(t); t === 0 ? ctx.moveTo(p[0], p[1]) : ctx.lineTo(p[0], p[1]); } ctx.stroke();
  for (let t = 0.1; t < 0.99; t += 0.018) {
    const p = pts(t);
    const len = 100 * Math.pow(Math.sin(Math.PI * (0.12 + 0.82 * t)), 0.9) * (0.9 + rand() * 0.2);
    for (const side of [-1, 1]) {
      const ang = -Math.PI / 2 + side * (1.15 - 0.4 * t);
      const g = 0.75 + rand() * 0.5;
      ctx.fillStyle = `rgb(${(48 + rand() * 18) * g | 0},${(98 + rand() * 40) * g | 0},${(36 + rand() * 16) * g | 0})`;
      leafPath(ctx, p[0], p[1], len, 5.2, ang); ctx.fill();
    }
  }
  ctx.restore();
}

function paintRings(ctx, cell, rand) {
  ctx.save(); ctx.translate(cell.x, cell.y);
  ctx.fillStyle = 'rgb(86,64,44)'; ctx.fillRect(0, 0, 256, 256);
  const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 118);
  g.addColorStop(0, 'rgb(205,170,118)'); g.addColorStop(1, 'rgb(186,148,100)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(128, 128, 116, 0, 7); ctx.fill();
  for (let r = 6; r < 116; r += 3 + rand() * 4) {
    ctx.strokeStyle = `rgba(110,74,40,${0.22 + rand() * 0.35})`; ctx.lineWidth = 0.8 + rand() * 1.4;
    ctx.beginPath(); ctx.ellipse(128 + rand() * 2, 128 + rand() * 2, r, r * (0.96 + rand() * 0.06), 0, 0, 7); ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(60,36,20,0.5)'; ctx.lineWidth = 1.5;
  for (let i = 0; i < 6; i++) { const a = rand() * 7; ctx.beginPath(); ctx.moveTo(128, 128); ctx.lineTo(128 + Math.cos(a) * 110, 128 + Math.sin(a) * 110); ctx.stroke(); }
  ctx.restore();
}

function paintGrassClump(ctx, cell, rand) {
  ctx.save(); ctx.translate(cell.x, cell.y);
  for (let i = 0; i < 46; i++) {
    const bx = 48 + rand() * 160, lean = (rand() - 0.5) * 70, h = 120 + rand() * 128, w = 5 + rand() * 6;
    const tipx = bx + lean, tipy = 256 - h;
    const g = ctx.createLinearGradient(0, 256, 0, tipy);
    g.addColorStop(0, `rgb(${26 + rand() * 10},${52 + rand() * 12},${18})`);
    g.addColorStop(0.6, `rgb(${66 + rand() * 24},${108 + rand() * 24},${34 + rand() * 12})`);
    g.addColorStop(1, `rgb(${130 + rand() * 40},${150 + rand() * 30},${60 + rand() * 20})`);
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(bx - w / 2, 258);
    ctx.quadraticCurveTo(bx - w * 0.3 + lean * 0.2, 256 - h * 0.6, tipx, tipy);
    ctx.quadraticCurveTo(bx + w * 0.3 + lean * 0.2, 256 - h * 0.55, bx + w / 2, 258);
    ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}

/**
 * Builds the shared flora atlas (bark strips, leaf cards, rings, white). Returns the texture and
 * the average linear colour of the leaf cells (used by far LODs).
 */
export function createFloraAtlas(maxAniso = 8) {
  const rand = mulberry32(WORLD_SEED + 950);
  const canvas = makeCanvas(ATLAS), ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.clearRect(0, 0, ATLAS, ATLAS);
  paintBark(ctx, CELLS.bark, rand, false);
  paintBark(ctx, CELLS.birch, rand, true);
  paintSpruce(ctx, CELLS.spruce, rand);
  paintLeafCluster(ctx, CELLS.oak, rand, { count: 230, size: 34, radius: 112, twig: true, colors: [[62, 98, 30], [78, 116, 36], [48, 82, 26], [96, 128, 40], [70, 106, 34]] });
  paintLeafCluster(ctx, CELLS.birchLeaf, rand, { count: 330, size: 21, radius: 112, twig: true, colors: [[110, 148, 44], [132, 164, 56], [92, 130, 38], [148, 172, 70]] });
  paintLeafCluster(ctx, CELLS.bush, rand, { count: 260, size: 26, radius: 108, twig: true, colors: [[44, 82, 30], [58, 98, 34], [38, 70, 28], [72, 106, 40]] });
  paintFern(ctx, CELLS.fern, rand);
  ctx.fillStyle = '#fff'; ctx.fillRect(CELLS.white.x, CELLS.white.y, 256, 256);
  paintRings(ctx, CELLS.rings, rand);
  paintGrassClump(ctx, CELLS.grass, rand);

  const img = ctx.getImageData(0, 0, ATLAS, ATLAS), d = img.data;
  const mean = {};
  for (const [name, c] of Object.entries(CELLS)) {
    let r = 0, g = 0, b = 0, n = 0;
    for (let y = c.y; y < c.y + c.h; y += 2) for (let x = c.x; x < c.x + c.w; x += 2) {
      const k = (y * ATLAS + x) * 4;
      if (d[k + 3] > 128) { r += (d[k] / 255) ** 2.2; g += (d[k + 1] / 255) ** 2.2; b += (d[k + 2] / 255) ** 2.2; n++; }
    }
    n = Math.max(n, 1);
    mean[name] = new THREE.Color(r / n, g / n, b / n);
    // alpha bleed: transparent texels take the cell's mean colour so mip-maps do not get dark fringes
    const mr = Math.pow(mean[name].r, 1 / 2.2) * 255, mg = Math.pow(mean[name].g, 1 / 2.2) * 255, mb = Math.pow(mean[name].b, 1 / 2.2) * 255;
    for (let y = c.y; y < c.y + c.h; y++) for (let x = c.x; x < c.x + c.w; x++) {
      const k = (y * ATLAS + x) * 4;
      if (d[k + 3] < 8) { d[k] = mr; d[k + 1] = mg; d[k + 2] = mb; d[k + 3] = 0; }
    }
  }
  const tex = new THREE.DataTexture(new Uint8Array(d.buffer), ATLAS, ATLAS, THREE.RGBAFormat, THREE.UnsignedByteType);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.minFilter = THREE.LinearMipmapLinearFilter; tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = true; tex.anisotropy = maxAniso; tex.flipY = false;
  tex.needsUpdate = true;
  return { texture: tex, mean };
}

/** Soft round sprite (mist / spray). */
export function createSoftSprite() {
  const c = makeCanvas(64), ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,0.9)'); g.addColorStop(0.45, 'rgba(255,255,255,0.35)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
