// Architectural building blocks: layered walls with door/window openings, gable roofs
// (with collapsible sections), ceilings, ivy, stairs. All build into a Builder frame.
import * as THREE from 'three';

/**
 * Wall from (x0,z0) to (x1,z1). Local wall x runs from start to end; opening.at is measured from the wall centre.
 * o: { h, t, y, layers:[{to, mat, tint}], openings:[{at,w,h,sill,kind:'door'|'window',frame,glass,shutter,out,tint}], collide, surface, tint }
 */
export function wall(b, x0, z0, x1, z1, o = {}) {
  const h = o.h ?? 2.9, t = o.t ?? 0.3, y0 = o.y ?? 0;
  const dx = x1 - x0, dz = z1 - z0, L = Math.hypot(dx, dz);
  const layers = o.layers ?? [{ mat: o.mat ?? 'plaster' }];
  const ops = (o.openings ?? []).slice().sort((a, c) => a.at - c.at);
  b.at((x0 + x1) / 2, y0, (z0 + z1) / 2, Math.atan2(-dz, dx), () => {
    const piece = (xa, xb, ya, yb) => {
      if (xb - xa < 0.02 || yb - ya < 0.02) return;
      let prev = 0;
      layers.forEach((ly, li) => {
        const to = ly.to ?? Infinity, a = Math.max(ya, prev), e = Math.min(yb, to);
        if (e - a > 0.01) b.box(ly.mat, (xa + xb) / 2, (a + e) / 2, 0, xb - xa, e - a, t + li * 0.04, { tint: ly.tint ?? o.tint });
        prev = to;
      });
    };
    let cur = -L / 2, colCur = -L / 2;
    const solid = (xa, xb) => { if (o.collide !== false && xb - xa > 0.05) b.solid((xa + xb) / 2, h / 2, 0, xb - xa, h, t, { surface: o.surface }); };
    for (const op of ops) {
      const a = op.at - op.w / 2, e = op.at + op.w / 2, oh = op.h ?? 2.3, sill = op.sill ?? 0;
      piece(cur, a, 0, h);
      if (sill > 0.01) piece(a, e, 0, sill);
      if (sill + oh < h - 0.01) piece(a, e, sill + oh, h);
      cur = e;
      if (op.kind === 'door') { solid(colCur, a); colCur = e; }
      openingDetail(b, op, a, e, sill, oh, t, h);
    }
    piece(cur, L / 2, 0, h);
    solid(colCur, L / 2);
  });
}

function openingDetail(b, op, a, e, sill, oh, t, wallH) {
  const fk = op.frame === undefined ? 'woodDark' : op.frame;
  const w = e - a, cx = (a + e) / 2, ft = t + 0.1;
  if (fk) {
    if (op.kind === 'door') {
      b.box(fk, a, oh / 2, 0, 0.12, oh, ft, { tint: op.tint });
      b.box(fk, e, oh / 2, 0, 0.12, oh, ft, { tint: op.tint });
      b.box(fk, cx, oh + 0.07, 0, w + 0.24, 0.16, ft, { tint: op.tint });
    } else {
      b.box(fk, cx, sill - 0.04, 0, w + 0.2, 0.1, ft + 0.06, { tint: op.tint });
      b.box(fk, cx, sill + oh + 0.05, 0, w + 0.2, 0.1, ft, { tint: op.tint });
      b.box(fk, a, sill + oh / 2, 0, 0.09, oh, ft, { tint: op.tint });
      b.box(fk, e, sill + oh / 2, 0, 0.09, oh, ft, { tint: op.tint });
      if (op.glass) { b.box(fk, cx, sill + oh / 2, 0, 0.05, oh, 0.05); b.box(fk, cx, sill + oh / 2, 0, w, 0.05, 0.05); }
    }
  }
  if (op.kind !== 'door' && op.glass) {
    b.quad('glass', cx, sill + oh / 2, 0, w, oh, {});
    if (op.broken) b.box('black', a + w * 0.3, sill + oh * 0.7, 0.01, 0.02, oh * 0.5, 0.01, { rz: 0.5 });
  }
  if (op.kind !== 'door' && op.shutter) {
    const out = op.out ?? 1, sw = w / 2 - 0.02, zz = out * (t / 2 + 0.05);
    const broken = op.shutter === 'broken';
    b.box('wood', a - sw / 2 - 0.05, sill + oh / 2, zz, sw, oh - 0.04, 0.05, { ry: broken ? out * 1.1 : 0, tint: op.tint });
    b.box('wood', e + sw / 2 + 0.05, sill + oh / 2 - (broken ? 0.2 : 0), zz, sw, oh - 0.04, 0.05, { rz: broken ? 0.15 : 0, ry: broken ? -out * 0.2 : 0, tint: op.tint });
  }
}

/**
 * Rectangular room shell centred on the frame origin, centre-line dims w (x) × d (z).
 * sides: { n, s, e, w } each an array of openings (at measured west→east for n/s, north→south for e/w).
 */
export function roomWalls(b, o) {
  const { w, d, t = 0.3 } = o, sides = o.sides ?? {};
  const common = { h: o.h, t, y: o.y, layers: o.layers, mat: o.mat, tint: o.tint, surface: o.surface, collide: o.collide };
  const hw = w / 2, hd = d / 2;
  const withOut = (list, out) => (list ?? []).map((op) => ({ out, ...op }));
  wall(b, -hw - t / 2, -hd, hw + t / 2, -hd, { ...common, openings: withOut(sides.n, -1) });
  wall(b, -hw - t / 2, hd, hw + t / 2, hd, { ...common, openings: withOut(sides.s, 1) });
  wall(b, hw, -hd + t / 2, hw, hd - t / 2, { ...common, openings: withOut(sides.e, -1) });
  wall(b, -hw, -hd + t / 2, -hw, hd - t / 2, { ...common, openings: withOut(sides.w, 1) });
}

/** Triangular gable-end filler. */
function gableTri(W, rise, depth) {
  const s = new THREE.Shape();
  s.moveTo(-W / 2, 0); s.lineTo(W / 2, 0); s.lineTo(0, rise - 0.05); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false });
  g.translate(0, 0, -depth / 2);
  return g;
}

/**
 * Gable roof over a w×d building whose wall top is at y. Ridge runs along local z (or x with ridgeX).
 * o: { w,d,y,rise,over,thick, mat, wallMat, gaps:[[z0,z1]], tint, underMat }
 */
export function gableRoof(b, o) {
  const { y, rise, over = 0.45, thick = 0.12, mat = 'tile', wallMat = 'plaster' } = o;
  const run = (W, D) => {
    const a = W / 2 + over, tan = rise / (W / 2), alpha = Math.atan(tan), cos = Math.cos(alpha), sin = Math.sin(alpha);
    const slant = a / cos + 0.04, segs = Math.max(1, Math.ceil((D + 2 * over) / 1.4)), seg = (D + 2 * over) / segs;
    for (const s of [-1, 1]) {
      for (let i = 0; i < segs; i++) {
        const zc = -D / 2 - over + seg * (i + 0.5);
        if (o.gaps && o.gaps.some(([g0, g1]) => zc > g0 && zc < g1)) continue;
        const cx = s * a / 2, cy = y + rise - (a / 2) * tan;
        b.box(mat, cx + s * sin * thick / 2, cy + cos * thick / 2, zc, slant, thick, seg + 0.02, { rz: -s * alpha, tint: o.tint, tile: 2 });
        b.box('wood', cx - s * sin * 0.03, cy - cos * 0.03, zc, slant, 0.06, seg, { rz: -s * alpha, tint: [0.7, 0.62, 0.55] });
      }
    }
    b.box(mat, 0, y + rise + 0.04, 0, 0.3, 0.14, D + 2 * over, { rz: Math.PI / 4, tint: o.tint ? undefined : [0.8, 0.8, 0.8] });
    const gw = W + 0.1;
    for (const s of [-1, 1]) b.geo(wallMat, gableTri(gw, rise, 0.26), 0, y, s * (D / 2), { uv: [1 / 3, 1 / 3], tint: o.wallTint });
  };
  if (o.ridgeX) b.at(0, 0, 0, Math.PI / 2, () => run(o.d, o.w)); else run(o.w, o.d);
}

/** Flat ceiling. */
export function ceiling(b, w, d, y, mat = 'wood', o = {}) { b.box(mat, 0, y, 0, w, o.t ?? 0.12, d, { tint: o.tint ?? [0.8, 0.8, 0.8] }); }

/** Floor slab with walkable collider (top at y). */
export function floorSlab(b, cx, cz, w, d, y, mat, surface, o = {}) {
  b.box(mat, cx, y - 0.1, cz, w, 0.2, d, { c: { surface, yMin: y - 0.4, yMax: y }, tint: o.tint, tile: o.tile });
}

/** Stairs from (x,y,z) going along local +z (down in z, up in y), n steps. Box collider per step. */
export function stairs(b, mat, x, y0, z, w, n, rise, run, surface = 'stone', o = {}) {
  for (let i = 0; i < n; i++) {
    const top = y0 + rise * (i + 1);
    b.box(mat, x, (top + (o.base ?? y0 - 0.5)) / 2, z + run * i + run / 2, w, top - (o.base ?? y0 - 0.5), run, { c: { surface, yMin: o.base ?? y0 - 0.5, yMax: top }, tint: o.tint, tile: o.tile });
  }
}

/** Clump of ivy quads climbing a wall (quads face +z of the current frame). */
export function ivy(b, x, y, z, w, h, o = {}) {
  const n = Math.max(1, Math.round(w * h / 3));
  for (let i = 0; i < n; i++) {
    const px = x + (b.rand() - 0.5) * w, py = y + (b.rand() - 0.5) * h, s = 0.9 + b.rand() * 1.1;
    b.quad('ivy', px, py, z + (b.rand() - 0.5) * 0.06, s, s, { rz: (b.rand() - 0.5) * 0.6, ry: o.ry ?? 0, tint: [0.7 + b.rand() * 0.4, 0.8 + b.rand() * 0.3, 0.6], j: 0.2, uv: [1, 1] });
  }
}
