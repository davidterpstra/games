// Shared furniture / prop builders. Every function draws into the current Builder frame at (x, z)
// (floor level = frame y + o.y) and registers colliders where the player could bump into it.
import * as THREE from 'three';
import { makeObject } from './core.js';

const TAU = Math.PI * 2;
const W = { surface: 'wood' };

export function crate(b, x, z, rot = 0, o = {}) {
  const w = o.w ?? 0.9, h = o.h ?? 0.8, d = o.d ?? 0.9;
  b.at(x, o.y ?? 0, z, rot, () => {
    b.box(o.mat ?? 'wood', 0, h / 2, 0, w, h, d, { c: o.nc ? undefined : { surface: 'wood' }, tint: o.tint });
    const p = 0.08;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.box('woodDark', sx * (w / 2 - p / 2), h / 2, sz * (d / 2 - p / 2), p + 0.02, h + 0.02, p + 0.02);
    b.box('woodDark', 0, h * 0.25, 0, w + 0.025, 0.07, d + 0.025);
    b.box('woodDark', 0, h * 0.75, 0, w + 0.025, 0.07, d + 0.025);
  });
}

export function barrel(b, x, z, o = {}) {
  const r = 0.36, h = 0.92;
  b.at(x, o.y ?? 0, z, 0, () => {
    b.cyl(o.mat ?? 'wood', 0, h / 2, 0, r * 0.86, r * 0.86, h, 12, { cc: { surface: 'wood' }, cr: r, tint: o.tint, tile: 1.5 });
    b.cyl(o.mat ?? 'wood', 0, h / 2, 0, r, r, h * 0.5, 12, { tint: o.tint, tile: 1.5 });
    for (const yy of [0.12, 0.3, h - 0.3, h - 0.12]) b.cyl('steel', 0, yy, 0, r * (Math.abs(yy - h / 2) < 0.25 ? 1.02 : 0.9), r * (Math.abs(yy - h / 2) < 0.25 ? 1.02 : 0.9), 0.045, 12);
    if (!o.closed) b.cyl('woodDark', 0, h - 0.01, 0, r * 0.8, r * 0.8, 0.03, 12);
  });
}

export function drum(b, x, z, o = {}) {
  const r = 0.29, h = 0.88;
  b.at(x, o.y ?? 0, z, 0, () => {
    b.cyl('rust', 0, h / 2, 0, r, r, h, 12, { cc: { surface: 'metal' }, tint: o.tint ?? [1, 0.8, 0.7], tile: 1.2 });
    for (const yy of [0.1, 0.44, h - 0.1]) b.cyl('rust', 0, yy, 0, r + 0.02, r + 0.02, 0.05, 12, { tint: [0.7, 0.6, 0.5] });
    b.cyl('steel', 0.1, h + 0.02, 0.05, 0.04, 0.04, 0.04, 8);
  });
}

export function table(b, x, z, rot = 0, o = {}) {
  const w = o.w ?? 1.5, d = o.d ?? 0.8, h = o.h ?? 0.78;
  b.at(x, o.y ?? 0, z, rot, () => {
    b.box(o.mat ?? 'wood', 0, h, 0, w, 0.06, d, { tint: o.tint, tile: 1.5 });
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.box('woodDark', sx * (w / 2 - 0.07), h / 2, sz * (d / 2 - 0.07), 0.08, h, 0.08);
    b.box('woodDark', 0, h - 0.16, 0, w - 0.2, 0.06, 0.05);
    b.solid(0, h / 2, 0, w, h + 0.03, d, W);
  });
}

export function chair(b, x, z, rot = 0, o = {}) {
  b.at(x, o.y ?? 0, z, rot, () => {
    b.box('wood', 0, 0.45, 0, 0.42, 0.05, 0.42, { tint: o.tint, tile: 1 });
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.box('woodDark', sx * 0.18, 0.22, sz * 0.18, 0.05, 0.44, 0.05);
    b.box('woodDark', 0, 0.82, -0.2, 0.42, 0.05, 0.04, { tile: 1 }); b.box('woodDark', 0, 0.68, -0.2, 0.42, 0.05, 0.04, { tile: 1 });
    for (const sx of [-1, 1]) b.box('woodDark', sx * 0.18, 0.7, -0.2, 0.04, 0.5, 0.04);
    if (!o.nc) b.solid(0, 0.45, 0, 0.44, 0.9, 0.44, W);
  });
}

export function stool(b, x, z, o = {}) {
  b.at(x, o.y ?? 0, z, 0, () => {
    b.cyl('wood', 0, 0.42, 0, 0.18, 0.18, 0.05, 10, { tile: 1 });
    for (let i = 0; i < 3; i++) { const a = (i / 3) * TAU; b.cyl('woodDark', Math.cos(a) * 0.12, 0.2, Math.sin(a) * 0.12, 0.02, 0.025, 0.4, 5, { rx: Math.sin(a) * 0.15, rz: -Math.cos(a) * 0.15 }); }
    b.circleCollider(0, 0.4, 0, 0.2, 0.8, W);
  });
}

export function bed(b, x, z, rot = 0, o = {}) {
  const w = o.w ?? 0.95, d = o.d ?? 2.0;
  b.at(x, o.y ?? 0, z, rot, () => {
    b.box('woodDark', 0, 0.28, 0, w, 0.1, d);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.box('woodDark', sx * (w / 2 - 0.04), 0.14, sz * (d / 2 - 0.04), 0.08, 0.28, 0.08);
    b.box('cloth', 0, 0.4, 0.02, w - 0.06, 0.14, d - 0.12, { tint: o.tint ?? [0.75, 0.7, 0.6], tile: 1.2 });
    b.box('cloth', 0, 0.5, -d / 2 + 0.3, w - 0.3, 0.1, 0.34, { tint: [0.95, 0.92, 0.85], tile: 1 });
    b.box('cloth', 0.02, 0.5, 0.35, w - 0.1, 0.07, d * 0.5, { tint: o.blanket ?? [0.5, 0.42, 0.34], tile: 1.2, rz: 0.02 });
    b.box('woodDark', 0, 0.62, -d / 2 - 0.02, w + 0.06, 0.7, 0.07);
    b.solid(0, 0.3, 0, w, 0.6, d, W);
  });
}

/** Two-level bunk bed. Calls o.onTop(worldPosition) with the top mattress surface. */
export function bunk(b, x, z, rot = 0, o = {}) {
  const w = 0.9, d = 2.0, H = 1.95;
  b.at(x, o.y ?? 0, z, rot, () => {
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.box('steel', sx * (w / 2 + 0.02), H / 2, sz * (d / 2 - 0.03), 0.06, H, 0.06, { tint: [0.9, 0.95, 0.9] });
    for (const yy of [0.42, 1.32]) {
      b.box('steel', 0, yy, 0, w + 0.1, 0.05, d, { tint: [0.8, 0.85, 0.8] });
      b.box('cloth', 0, yy + 0.1, 0.02, w - 0.04, 0.13, d - 0.1, { tint: o.tint ?? [0.55, 0.62, 0.55], tile: 1.2 });
      b.box('cloth', 0, yy + 0.18, -d / 2 + 0.3, w - 0.3, 0.09, 0.34, { tint: [0.92, 0.9, 0.85], tile: 1 });
    }
    b.box('cloth', 0.02, 0.62, 0.3, w - 0.06, 0.06, 1.0, { tint: [0.45, 0.5, 0.4], tile: 1.2, rz: 0.03 });
    b.box('steel', 0, 1.62, d / 2 - 0.03, w + 0.1, 0.05, 0.05); // top guard rail
    for (let i = 0; i < 5; i++) b.box('steel', w / 2 + 0.1, 0.25 + i * 0.3, d / 2 - 0.25, 0.04, 0.04, 0.3); // ladder rungs side
    b.solid(0, H / 2, 0, w + 0.1, H, d, { surface: 'metal' });
    if (o.onTop) o.onTop(b.wp(0.05, 1.5, 0.25));
  });
}

export function shelf(b, x, z, rot = 0, o = {}) {
  const w = o.w ?? 1.3, h = o.h ?? 2.0, d = o.d ?? 0.4, n = o.n ?? 4, mat = o.mat ?? 'woodDark';
  b.at(x, o.y ?? 0, z, rot, () => {
    for (const sx of [-1, 1]) b.box(mat, sx * (w / 2 - 0.03), h / 2, 0, 0.06, h, d, { tint: o.tint });
    b.box(mat, 0, h / 2, -d / 2 + 0.01, w, h, 0.02, { tint: [0.8, 0.8, 0.8] });
    for (let i = 0; i < n; i++) {
      const yy = 0.15 + (i * (h - 0.2)) / (n - 1);
      b.box(mat === 'steel' ? 'steel' : 'wood', 0, yy, 0, w - 0.04, 0.04, d, { tint: o.tint });
      b.clutter = true;
      let px = -w / 2 + 0.15;
      while (px < w / 2 - 0.15 && i < n - 1) {
        const k = b.rand(), sz = 0.1 + b.rand() * 0.16;
        if (b.rand() < 0.3) { px += 0.2; continue; }
        if (k < 0.4) b.box('woodDark', px, yy + 0.02 + sz / 2, 0, 0.05 + b.rand() * 0.05, sz + 0.1, 0.18, { tint: [0.6 + b.rand() * 0.6, 0.5 + b.rand() * 0.5, 0.45 + b.rand() * 0.3], j: 0.2 });
        else if (k < 0.7) b.cyl('glass', px, yy + 0.02 + sz / 2, 0, 0.05, 0.05, sz, 7);
        else b.box('wood', px, yy + 0.02 + sz / 2, 0, sz, sz, sz, { tint: [0.9, 0.85, 0.7] });
        px += 0.14 + b.rand() * 0.12;
      }
      b.clutter = false;
    }
    b.solid(0, h / 2, 0, w, h, d, W);
  });
}

export function locker(b, x, z, rot = 0, o = {}) {
  const n = o.n ?? 3, lw = 0.5, h = 1.9, d = 0.5;
  b.at(x, o.y ?? 0, z, rot, () => {
    const tint = o.tint ?? [0.55, 0.66, 0.6];
    for (let i = 0; i < n; i++) {
      const lx = (i - (n - 1) / 2) * lw;
      b.box('panel', lx, h / 2, 0, lw - 0.01, h, d, { tint, tile: 1.5 });
      b.box('black', lx, h - 0.25, d / 2 + 0.005, 0.28, 0.2, 0.01);
      b.box('steel', lx + 0.14, h * 0.55, d / 2 + 0.02, 0.03, 0.14, 0.03);
      b.box('black', lx, 0.12, d / 2 + 0.005, 0.32, 0.04, 0.01);
      if (o.ajar === i) b.box('panel', lx - lw / 2 - 0.1, h / 2, d / 2 + 0.2, 0.03, h - 0.04, lw - 0.04, { tint, ry: 0.5, tile: 1.5 });
    }
    b.box('steel', 0, h + 0.02, 0, n * lw + 0.02, 0.04, d + 0.02);
    b.solid(0, h / 2, 0, n * lw, h, d, { surface: 'metal' });
  });
}

export function desk(b, x, z, rot = 0, o = {}) {
  const w = o.w ?? 1.8, d = o.d ?? 0.85, h = 0.76;
  b.at(x, o.y ?? 0, z, rot, () => {
    b.box(o.mat ?? 'wood', 0, h, 0, w, 0.06, d, { tint: o.tint ?? [0.8, 0.78, 0.74], tile: 1.5 });
    for (const sx of [-1, 1]) {
      b.box('steel', sx * (w / 2 - 0.25), h / 2 - 0.02, 0, 0.5, h - 0.06, d - 0.08, { tint: [0.7, 0.75, 0.72] });
      for (let i = 0; i < 3; i++) b.box('black', sx * (w / 2 - 0.25), 0.2 + i * 0.22, d / 2 - 0.035, 0.28, 0.025, 0.02);
    }
    b.solid(0, h / 2, 0, w, h + 0.03, d, W);
  });
}

/** Desktop monitor with dim screen (screen material shared via 'black'). */
export function monitor(b, x, y, z, rot = 0, s = 1) {
  b.at(x, y, z, rot, () => {
    b.box('black', 0, 0.2 * s, 0, 0.5 * s, 0.34 * s, 0.05 * s);
    b.box('glass', 0, 0.2 * s, 0.03 * s, 0.44 * s, 0.28 * s, 0.01, { tint: [0.3, 0.45, 0.4] });
    b.box('black', 0, 0.02 * s, 0.02 * s, 0.16 * s, 0.04 * s, 0.14 * s);
    b.box('black', 0, 0.05 * s, 0, 0.05 * s, 0.1 * s, 0.04 * s);
  });
}

export function papers(b, cx, cz, y, n, spread, rot = 0) {
  b.clutter = true;
  for (let i = 0; i < n; i++) {
    b.quad('paper', cx + (b.rand() - 0.5) * spread, y + 0.003 + i * 0.001, cz + (b.rand() - 0.5) * spread, 0.21, 0.3, { rx: -Math.PI / 2, rz: b.rand() * TAU, ry: rot, tint: [0.85 + b.rand() * 0.15, 0.85 + b.rand() * 0.12, 0.8], uv: [1, 1] });
  }
  b.clutter = false;
}

export function labBench(b, x, z, rot = 0, o = {}) {
  const w = o.w ?? 3.2, d = 0.8, h = 0.92;
  b.at(x, o.y ?? 0, z, rot, () => {
    b.box('panel', 0, h / 2 - 0.04, 0, w, h - 0.08, d - 0.04, { tint: [0.6, 0.7, 0.66], tile: 2 });
    b.box('black', 0, h, 0, w + 0.06, 0.06, d, { tile: 1 });
    for (let i = 0; i < Math.floor(w / 0.8); i++) b.box('steel', -w / 2 + 0.4 + i * 0.8, h / 2, d / 2 - 0.02, 0.5, 0.04, 0.02);
    b.solid(0, h / 2, 0, w, h + 0.03, d, { surface: 'metal' });
    b.clutter = true;
    // microscope
    b.at(-w / 2 + 0.5, h + 0.03, 0, 0.3, () => {
      b.box('black', 0, 0.015, 0, 0.2, 0.03, 0.26); b.cyl('steel', 0, 0.2, -0.05, 0.025, 0.025, 0.36, 8, { rx: 0.15 });
      b.cyl('black', 0, 0.3, 0.02, 0.03, 0.03, 0.2, 8, { rx: -0.35 }); b.box('steel', 0, 0.09, 0.03, 0.14, 0.01, 0.12);
    });
    // beakers + rack
    for (let i = 0; i < 5; i++) b.cyl('glass', -0.2 + i * 0.16, h + 0.03 + 0.07, 0.15 * (i % 2 ? 1 : -1), 0.04, 0.04, 0.14 + (i % 3) * 0.04, 8, { tint: i % 2 ? [0.8, 1, 0.8] : [1, 0.9, 0.7] });
    b.box('woodDark', 0.9, h + 0.07, 0.1, 0.4, 0.1, 0.12);
    for (let i = 0; i < 4; i++) b.cyl('glass', 0.78 + i * 0.1, h + 0.18, 0.1, 0.018, 0.018, 0.18, 6);
    b.cyl('steel', w / 2 - 0.45, h + 0.15, 0, 0.18, 0.18, 0.24, 12); b.cyl('black', w / 2 - 0.45, h + 0.29, 0, 0.17, 0.17, 0.04, 12);
    b.box('black', w / 2 - 1.0, h + 0.1, -0.1, 0.34, 0.14, 0.22); b.box('lampOff', w / 2 - 1.0, h + 0.19, 0.02, 0.12, 0.012, 0.05, { tint: [0.4, 1, 0.5] });
    papers(b, 0.2, 0.2, h + 0.03, 4, 0.5);
    b.clutter = false;
  });
}

export function lampStrip(b, x, y, z, len = 1.2, rot = 0, key = 'lampOff') {
  b.at(x, y, z, rot, () => {
    b.box('steel', 0, 0.025, 0, len + 0.1, 0.05, 0.16);
    b.box(key, 0, -0.01, 0, len, 0.03, 0.1, { tint: [1, 1, 1], j: 0 });
  });
}

export function cable(b, pts, r = 0.025, mat = 'black') {
  const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)));
  b.geo(mat, new THREE.TubeGeometry(curve, Math.max(8, pts.length * 6), r, 5, false), 0, 0, 0, { uv: [4, 1] });
}

/** Fence along (x0,z0)→(x1,z1): posts + rails, with collider per section. kind: 'wood' | 'wire'. */
export function fence(b, x0, z0, x1, z1, o = {}) {
  const L = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.round(L / (o.spacing ?? 2.2))), ang = Math.atan2(-(z1 - z0), x1 - x0), h = o.h ?? 1.2;
  const hole = o.holeAt ?? -1; // section index left open (gate gap)
  b.at((x0 + x1) / 2, o.y ?? 0, (z0 + z1) / 2, ang, () => {
    const seg = L / n;
    for (let i = 0; i <= n; i++) {
      const px = -L / 2 + i * seg, lean = (b.rand() - 0.5) * (o.decay ?? 0.06);
      b.box(o.kind === 'wire' ? 'rust' : 'woodDark', px, h / 2, 0, 0.1, h + 0.1, 0.1, { rz: lean, tint: o.tint, tile: 1.2 });
    }
    for (let i = 0; i < n; i++) {
      if (i === hole) continue;
      const cx = -L / 2 + (i + 0.5) * seg;
      if (o.kind === 'wire') {
        b.quad('chain', cx, h * 0.5, 0, seg, h * 0.9, { uv: [seg / 0.6, h * 0.9 / 0.6], tint: [0.8, 0.75, 0.7] });
        b.box('rust', cx, h, 0, seg, 0.04, 0.04); b.box('rust', cx, 0.1, 0, seg, 0.03, 0.03);
      } else {
        if (b.rand() > 0.12) b.box('wood', cx, h * 0.8, 0, seg, 0.12, 0.05, { rz: (b.rand() - 0.5) * 0.06, tint: o.tint, tile: 1.5 });
        if (b.rand() > 0.12) b.box('wood', cx, h * 0.42, 0, seg, 0.12, 0.05, { rz: (b.rand() - 0.5) * 0.06, tint: o.tint, tile: 1.5 });
      }
      b.solid(cx, h / 2, 0, seg, h, 0.12, { surface: o.kind === 'wire' ? 'metal' : 'wood' });
    }
  });
}

export function sandbags(b, x, z, rot, cols = 4, rows = 3, o = {}) {
  b.at(x, o.y ?? 0, z, rot, () => {
    for (let r = 0; r < rows; r++) for (let i = 0; i < cols - (r % 2 ? 1 : 0); i++) {
      const px = (i - (cols - 1) / 2 + (r % 2 ? 0.5 : 0)) * 0.56;
      b.box('cloth', px, 0.1 + r * 0.19, (b.rand() - 0.5) * 0.04, 0.58, 0.2, 0.34, { tint: [0.62 + b.rand() * 0.12, 0.56 + b.rand() * 0.1, 0.4], rz: (b.rand() - 0.5) * 0.08, tile: 1, j: 0.15 });
    }
    b.solid(0, rows * 0.1, 0, cols * 0.56, rows * 0.19 + 0.02, 0.4, { surface: 'dirt' });
  });
}

export function woodPile(b, x, z, rot = 0, o = {}) {
  b.at(x, o.y ?? 0, z, rot, () => {
    const rows = o.rows ?? 4, cols = o.cols ?? 7;
    for (let r = 0; r < rows; r++) for (let i = 0; i < cols - r; i++) {
      b.cyl('wood', (i - (cols - r - 1) / 2) * 0.2, 0.1 + r * 0.17, 0, 0.09 + b.rand() * 0.015, 0.09, 1.0, 7, { rx: Math.PI / 2, tint: [0.7 + b.rand() * 0.4, 0.65 + b.rand() * 0.3, 0.55], tile: 0.6, j: 0.15 });
    }
    b.solid(0, rows * 0.085, 0, cols * 0.2, rows * 0.17 + 0.05, 1.0, W);
  });
}

export function sack(b, x, z, o = {}) {
  b.at(x, o.y ?? 0, z, o.rot ?? 0, () => {
    b.geo('cloth', new THREE.SphereGeometry(0.28, 8, 6), 0, 0.22, 0, { sy: 0.85, tint: o.tint ?? [0.8, 0.72, 0.55], uv: [1, 1] });
    b.cyl('cloth', 0, 0.48, 0, 0.07, 0.12, 0.12, 6, { tint: [0.6, 0.5, 0.35] });
    b.circleCollider(0, 0.25, 0, 0.28, 0.5, W);
  });
}

export function bucket(b, x, z, o = {}) {
  b.at(x, o.y ?? 0, z, 0, () => {
    b.cyl('rust', 0, 0.15, 0, 0.17, 0.12, 0.3, 10, { tint: [0.8, 0.8, 0.8], open: true, tile: 1 });
    b.cyl('woodDark', 0, 0.28, 0, 0.15, 0.15, 0.015, 10);
  });
}

export function hearth(b, x, z, rot, o = {}) {
  b.at(x, o.y ?? 0, z, rot, () => {
    b.box('stone', 0, 0.55, 0, 1.7, 1.1, 0.7, { tint: [0.85, 0.82, 0.78], c: { surface: 'stone' } });
    b.box('black', 0, 0.42, 0.18, 0.9, 0.7, 0.4);
    b.box('stone', 0, 1.2, -0.05, 1.3, 0.2, 0.55); b.box('stone', 0, 2.1, -0.1, 0.9, 1.8, 0.45, { tint: [0.8, 0.78, 0.75] });
    b.box('stone', 0, 3.0, -0.1, 0.7, 0.4, 0.4);
    b.box('woodDark', 0, 0.2, 0.3, 0.5, 0.08, 0.1, { rx: 0.2 });
    b.cyl('rust', 0.25, 0.35, 0.28, 0.14, 0.18, 0.2, 8); // pot
  });
}

export function cart(b, x, z, rot = 0, o = {}) {
  b.at(x, o.y ?? 0, z, rot, () => {
    b.box('wood', 0, 0.75, 0, 1.3, 0.12, 2.2, { tint: [0.85, 0.8, 0.75] });
    for (const sx of [-1, 1]) {
      b.box('woodDark', sx * 0.64, 1.0, 0, 0.06, 0.45, 2.2);
      b.cyl('woodDark', sx * 0.75, 0.55, 0.1, 0.55, 0.55, 0.08, 14, { rz: Math.PI / 2, tile: 1 });
      b.cyl('steel', sx * 0.75, 0.55, 0.1, 0.1, 0.1, 0.12, 8, { rz: Math.PI / 2 });
      for (let i = 0; i < 6; i++) b.box('woodDark', sx * 0.75, 0.55, 0.1, 0.05, 1.05, 0.06, { rx: (i / 6) * Math.PI });
    }
    b.box('woodDark', 0, 0.55, 0.1, 1.6, 0.06, 0.06);
    b.box('woodDark', 0, 0.9, 1.5, 0.08, 0.08, 1.4, { rx: -0.25 });
    b.box('woodDark', 0, 0.62, -1.1, 1.3, 0.35, 0.05); b.box('woodDark', 0, 1.0, -1.08, 1.28, 0.05, 0.05);
    if (o.load) { b.box('cloth', 0, 1.0, 0.1, 1.0, 0.5, 1.0, { tint: [0.6, 0.55, 0.4], rz: 0.05 }); }
    b.solid(0, 0.6, 0, 1.7, 1.2, 2.3, W);
  });
}

export function anvil(b, x, z, rot = 0, o = {}) {
  b.at(x, o.y ?? 0, z, rot, () => {
    b.cyl('wood', 0, 0.3, 0, 0.3, 0.34, 0.6, 8, { tile: 1 });
    b.box('steel', 0, 0.68, 0, 0.34, 0.16, 0.7); b.box('steel', 0, 0.58, 0, 0.2, 0.1, 0.3); b.box('steel', 0, 0.7, 0.45, 0.14, 0.1, 0.3, { rx: -0.1 });
    b.circleCollider(0, 0.4, 0, 0.4, 0.8, { surface: 'metal' });
  });
}

export function well(b, x, z, o = {}) {
  b.at(x, o.y ?? 0, z, 0, () => {
    b.cyl('stone', 0, 0.45, 0, 1.15, 1.25, 0.9, 16, { cc: { surface: 'stone' }, cr: 1.25, tint: [0.9, 0.88, 0.84], tile: 1.6 });
    b.cyl('stone', 0, 0.92, 0, 1.2, 1.2, 0.1, 16, { tint: [0.8, 0.78, 0.74] });
    b.cyl('black', 0, 0.9, 0, 0.9, 0.9, 0.04, 16);
    for (const s of [-1, 1]) b.box('woodDark', s * 1.1, 1.7, 0, 0.14, 2.4, 0.14, { tint: [0.8, 0.75, 0.7] });
    b.box('woodDark', 0, 2.82, 0, 2.5, 0.14, 0.14, { tint: [0.8, 0.75, 0.7] });
    b.box('wood', 0, 3.0, 0, 2.7, 0.08, 1.7, { rz: 0, tint: [0.7, 0.68, 0.64] });
    for (const s of [-1, 1]) b.box('shingle', s * 0.0, 3.22, s * 0.5, 2.9, 0.08, 1.15, { rx: s * 0.6, tint: [0.85, 0.8, 0.75] });
    b.cyl('woodDark', 0, 2.6, 0, 0.09, 0.09, 1.0, 8, { rz: Math.PI / 2 });
    b.cyl('black', 0, 2.1, 0, 0.012, 0.012, 1.0, 4);
    b.cyl('rust', 0, 1.55, 0, 0.14, 0.11, 0.22, 8, { open: true });
  });
}

/** Market stall with torn canvas awning. */
export function stall(b, x, z, rot = 0, o = {}) {
  b.at(x, o.y ?? 0, z, rot, () => {
    for (const sx of [-1, 1]) {
      b.box('woodDark', sx * 1.4, 1.2, 0.8, 0.12, 2.4, 0.12); b.box('woodDark', sx * 1.4, 1.0, -0.8, 0.12, 2.0, 0.12);
    }
    b.box('woodDark', 0, 2.4, 0.8, 2.9, 0.1, 0.1); b.box('woodDark', 0, 2.0, -0.8, 2.9, 0.1, 0.1);
    b.box('cloth', 0, 2.22, 0, 3.1, 0.03, 1.9, { rx: 0.22, tint: o.cloth ?? [0.7, 0.45, 0.35], tile: 1.5 });
    b.box('cloth', 0.9, 2.1, -0.25, 0.9, 0.03, 0.9, { rx: 0.9, rz: 0.2, tint: o.cloth ?? [0.7, 0.45, 0.35], tile: 1.5 });
    b.box('wood', 0, 0.85, 0.15, 2.7, 0.08, 1.0, { tint: [0.8, 0.76, 0.7] });
    for (const sx of [-1, 1]) b.box('woodDark', sx * 1.2, 0.42, 0.15, 0.1, 0.84, 0.9);
    b.solid(0, 0.45, 0.15, 2.8, 0.9, 1.05, W);
    b.clutter = true;
    for (let i = 0; i < 5; i++) b.box('wood', -1 + i * 0.5, 0.95, 0.15 + (b.rand() - 0.5) * 0.3, 0.2 + b.rand() * 0.2, 0.12, 0.2, { ry: b.rand(), tint: [0.8, 0.7, 0.5] });
    b.clutter = false;
  });
}

/** Tent: a-frame canvas tent with open front. */
export function tent(b, x, z, rot = 0, o = {}) {
  b.at(x, o.y ?? 0, z, rot, () => {
    const w = 2.6, d = 3.0, hh = 1.7, a = Math.atan2(hh, w / 2);
    const len = Math.hypot(w / 2, hh) + 0.05;
    for (const s of [-1, 1]) b.box('cloth', s * w / 4, hh / 2, 0, len, 0.025, d, { rz: -s * a, tint: o.tint ?? [0.55, 0.6, 0.45], tile: 1.5, j: 0.1 });
    b.box('woodDark', 0, hh / 2, d / 2 - 0.05, 0.06, hh, 0.06); b.box('woodDark', 0, hh / 2, -d / 2 + 0.05, 0.06, hh, 0.06);
    b.box('woodDark', 0, hh, 0, 0.05, 0.05, d + 0.2);
    // back wall and floor cloth
    const tri = new THREE.Shape(); tri.moveTo(-w / 2, 0); tri.lineTo(w / 2, 0); tri.lineTo(0, hh); tri.closePath();
    b.geo('cloth', new THREE.ShapeGeometry(tri), 0, 0, -d / 2 + 0.02, { tint: [0.45, 0.5, 0.38], uv: [0.7, 0.7] });
    b.box('cloth', 0, 0.02, 0, w - 0.2, 0.02, d - 0.1, { tint: [0.4, 0.38, 0.3], tile: 1.5 });
    // door flaps (tied open)
    b.box('cloth', -0.9, 0.7, d / 2 - 0.1, 0.5, 1.3, 0.02, { rz: 0.25, tint: [0.5, 0.55, 0.42] });
    b.solid(0, 0.8, 0, w, 1.6, d, { surface: 'dirt' });
    // sleeping roll
    b.cyl('cloth', 0.45, 0.1, -0.5, 0.16, 0.16, 1.7, 8, { rx: Math.PI / 2, rz: 0, tint: [0.4, 0.42, 0.5], tile: 1 });
  });
}

export function campfire(b, x, z, o = {}) {
  b.at(x, o.y ?? 0, z, 0, () => {
    for (let i = 0; i < 9; i++) { const a = (i / 9) * TAU; b.geo('stone', new THREE.DodecahedronGeometry(0.15 + b.rand() * 0.05, 0), Math.cos(a) * 0.55, 0.1, Math.sin(a) * 0.55, { sy: 0.7, tint: [0.8, 0.8, 0.78], uv: [0.3, 0.3], ry: b.rand() * 3 }); }
    for (let i = 0; i < 4; i++) b.cyl('woodDark', 0, 0.1, 0, 0.05, 0.05, 0.8, 5, { rx: Math.PI / 2 + 0.2, ry: i * 0.8 + b.rand() * 0.4, rz: 0, tint: [0.35, 0.33, 0.33], tile: 0.5 });
    b.cyl('black', 0, 0.025, 0, 0.45, 0.45, 0.03, 10);
    b.circleCollider(0, 0.2, 0, 0.7, 0.4, { surface: 'dirt' });
  });
}

export function backpack(b, x, z, rot = 0, o = {}) {
  b.at(x, o.y ?? 0, z, rot, () => {
    b.box('cloth', 0, 0.28, 0, 0.36, 0.5, 0.2, { tint: [0.35, 0.42, 0.28], rx: 0.1, tile: 1 });
    b.box('cloth', 0, 0.12, 0.13, 0.28, 0.2, 0.1, { tint: [0.3, 0.36, 0.24], rx: 0.1, tile: 1 });
    b.box('cloth', 0, 0.55, 0, 0.3, 0.12, 0.18, { tint: [0.32, 0.38, 0.26], rx: 0.1, tile: 1 });
    b.box('black', -0.12, 0.3, -0.12, 0.05, 0.4, 0.02); b.box('black', 0.12, 0.3, -0.12, 0.05, 0.4, 0.02);
    b.box('steel', 0, 0.2, 0.19, 0.12, 0.03, 0.02);
    b.solid(0, 0.3, 0, 0.4, 0.6, 0.3, { surface: 'dirt', yMax: 0.3 });
  });
}

export function lantern(b, x, z, o = {}) {
  b.at(x, o.y ?? 0, z, 0, () => {
    b.cyl('rust', 0, 0.02, 0, 0.1, 0.11, 0.04, 8, { tint: [0.6, 0.55, 0.5] });
    b.cyl('glass', 0, 0.17, 0, 0.075, 0.085, 0.24, 8, { tint: [1, 0.85, 0.5] });
    b.cyl('rust', 0, 0.31, 0, 0.04, 0.1, 0.06, 8, { tint: [0.6, 0.55, 0.5] });
    b.box('steel', 0, 0.37, 0, 0.12, 0.012, 0.012, { rz: 0 }); b.cyl('steel', 0, 0.35, 0, 0.04, 0.04, 0.01, 8);
    b.cyl('ember', 0, 0.12, 0, 0.02, 0.03, 0.1, 6);
  });
}

export function pot(b, x, z, y = 0, s = 1) {
  b.at(x, y, z, 0, () => {
    b.geo('rust', new THREE.SphereGeometry(0.16 * s, 8, 6, 0, TAU, 0, Math.PI * 0.75), 0, 0.17 * s, 0, { rx: Math.PI, tint: [0.8, 0.7, 0.6], uv: [0.5, 0.5] });
  });
}

/** A low stone plinth/altar-like block. */
export function plinth(b, x, z, h = 1.0, w = 1.0, key = 'temple', o = {}) {
  b.at(x, o.y ?? 0, z, o.rot ?? 0, () => {
    b.box(key, 0, 0.12, 0, w + 0.3, 0.24, w + 0.3, { c: { surface: 'stone' } });
    b.box(key, 0, h / 2 + 0.1, 0, w, h - 0.1, w, { c: { surface: 'stone' } });
    b.box(key, 0, h + 0.07, 0, w + 0.24, 0.14, w + 0.24, { c: { surface: 'stone' } });
  });
}

// ---------------------------------------------------------------------------------------------
// Beacons: tripod emergency radio with a lamp child (own material, emissiveIntensity 0).

/**
 * Builds a beacon prop group (~2.4 m tall). Child `lamp` has a unique emissive material.
 */
export function makeBeacon(lib, rand, name = 'beacon') {
  const g = makeObject(lib, rand, name, (b) => {
    for (let i = 0; i < 3; i++) {
      b.at(0, 0, 0, (i / 3) * TAU + 0.4, () => {
        b.cyl('steel', 0.3, 0.6, 0, 0.025, 0.035, 1.3, 6, { rz: Math.atan2(0.6, 1.15), tint: [0.8, 0.85, 0.8] });
        b.geo('stone', new THREE.DodecahedronGeometry(0.16, 0), 0.62, 0.07, 0, { sy: 0.6, tint: [0.7, 0.7, 0.68], uv: [0.3, 0.3] });
      });
    }
    b.cyl('steel', 0, 1.7, 0, 0.032, 0.04, 1.4, 8);
    b.cyl('steel', 0, 1.2, 0, 0.1, 0.1, 0.06, 8);
    // radio box
    b.at(0.17, 1.15, 0.0, 0, () => {
      b.box('panel', 0.14, 0, 0, 0.3, 0.3, 0.46, { tint: [0.45, 0.55, 0.45], tile: 0.5 });
      b.quad('dials', 0.292, 0.0, 0, 0.4, 0.25, { ry: Math.PI / 2, uv: [1, 1], j: 0 });
      b.box('black', 0.14, 0.17, 0, 0.32, 0.03, 0.48);
      b.cyl('black', 0.14, 0.2, 0.18, 0.012, 0.012, 0.12, 5);
      b.box('steel', 0.14, 0.12, -0.26, 0.02, 0.2, 0.04); // handle
    });
    // solar panel + antennas
    b.box('black', -0.25, 1.78, 0, 0.04, 0.4, 0.3, { rz: -0.4 });
    b.box('steel', 0, 2.0, 0, 0.012, 0.012, 0.9); b.box('steel', 0, 2.22, 0, 0.012, 0.012, 0.6);
    b.cyl('steel', 0, 2.1, 0, 0.012, 0.01, 0.9, 4);
    b.cyl('steel', 0.1, 2.05, 0.05, 0.006, 0.004, 0.7, 4, { rz: -0.12 });
    b.quad('cloth', -0.12, 1.5, 0, 0.3, 0.2, { rz: 0.1, tint: [0.9, 0.3, 0.15], uv: [0.3, 0.3], ry: 0.4 });
    b.circleCollider(0, 0.6, 0, 0.55, 1.2, { surface: 'metal' });
  });
  const mat = new THREE.MeshStandardMaterial({ color: 0x6a3a14, emissive: 0xff7a1a, emissiveIntensity: 0, roughness: 0.4 });
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.085, 12, 8), mat);
  lamp.name = 'lamp'; lamp.position.set(0, 2.5, 0);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.11, 0.05, 8), lib.M.steel); cap.position.y = 0.075; lamp.add(cap);
  g.add(lamp);
  g.userData.lampMaterial = mat;
  return g;
}

/** Cylinder rod between two points (local coordinates). */
export function rod(b, key, p1, p2, r = 0.03, seg = 5, o = {}) {
  const a = new THREE.Vector3(...p1), c = new THREE.Vector3(...p2), d = c.clone().sub(a), len = d.length();
  const g = new THREE.CylinderGeometry(r, o.r2 ?? r, len, seg, 1);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()));
  const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 0.5, uv.getY(i) * len / 2);
  b.add(key, g, (a.x + c.x) / 2, (a.y + c.y) / 2, (a.z + c.z) / 2, { tint: o.tint, j: o.j });
}
