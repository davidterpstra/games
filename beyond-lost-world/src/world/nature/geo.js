// Tiny procedural geometry kit: a vertex accumulator plus tubes, cards and bent cards.
// Every vertex carries position, normal, uv, colour, aWind (sway weight) and aTint (instance tint weight).
import * as THREE from 'three';
import { cellUV, barkUV } from './textures.js';

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _t = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

export class GeoBuilder {
  constructor() { this.p = []; this.n = []; this.uv = []; this.c = []; this.w = []; this.t = []; this.i = []; }
  get count() { return this.p.length / 3; }
  /** Adds a vertex and returns its index. */
  vert(px, py, pz, nx, ny, nz, u, v, shade = 1, wind = 0, tint = 0, cr = 1, cg = 1, cb = 1) {
    const k = this.p.length / 3;
    this.p.push(px, py, pz); this.n.push(nx, ny, nz); this.uv.push(u, v);
    this.c.push(cr * shade, cg * shade, cb * shade); this.w.push(wind); this.t.push(tint);
    return k;
  }
  tri(a, b, c) { this.i.push(a, b, c); }
  quad(a, b, c, d) { this.i.push(a, b, c, a, c, d); }
  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    g.setAttribute('aWind', new THREE.Float32BufferAttribute(this.w, 1));
    g.setAttribute('aTint', new THREE.Float32BufferAttribute(this.t, 1));
    g.setIndex(this.i);
    g.computeBoundingSphere(); g.computeBoundingBox();
    return g;
  }
}

/**
 * Tapered tube along a polyline.
 * @param {GeoBuilder} g
 * @param {THREE.Vector3[]} pts centre line
 * @param {number[]} radii radius per point
 * @param {number} sides radial segments
 * @param {object} o { bark:'bark'|'birch', v0, v1, uRep, shade:(t)=>n, wind:(t)=>n, color:[r,g,b], capEnd:bool, capCell:'rings', capStart }
 */
export function tube(g, pts, radii, sides, o = {}) {
  const n = pts.length;
  const { bark = 'bark', v0 = 0, v1 = 0.5, uRep = 1, shade = () => 1, wind = () => 0, color = [1, 1, 1], capEnd = false, capStart = false, capCell = 'rings' } = o;
  const rings = [];
  let nrm = null;
  for (let i = 0; i < n; i++) {
    const t = _t.copy(pts[Math.min(i + 1, n - 1)]).sub(pts[Math.max(i - 1, 0)]).normalize().clone();
    if (!nrm) {
      nrm = Math.abs(t.y) < 0.9 ? new THREE.Vector3().crossVectors(t, UP).normalize() : new THREE.Vector3(1, 0, 0).sub(t.clone().multiplyScalar(t.x)).normalize();
    } else {
      nrm = nrm.clone().sub(t.clone().multiplyScalar(nrm.dot(t))).normalize();
    }
    const bn = new THREE.Vector3().crossVectors(t, nrm);
    const start = g.count;
    const f = i / (n - 1);
    const sh = shade(f), wd = wind(f);
    const uvv = [0, 0];
    for (let k = 0; k <= sides; k++) {
      const a = (k / sides) * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
      const dx = nrm.x * ca + bn.x * sa, dy = nrm.y * ca + bn.y * sa, dz = nrm.z * ca + bn.z * sa;
      barkUV(bark, (k / sides) * uRep, v0 + (v1 - v0) * f, uvv);
      g.vert(pts[i].x + dx * radii[i], pts[i].y + dy * radii[i], pts[i].z + dz * radii[i], dx, dy, dz, uvv[0], uvv[1], sh, wd, 0, color[0], color[1], color[2]);
    }
    rings.push({ start, t, nrm, bn });
  }
  for (let i = 0; i < n - 1; i++) for (let k = 0; k < sides; k++) {
    const a = rings[i].start + k, b = a + 1, c = rings[i + 1].start + k, d = c + 1;
    g.i.push(a, b, c, b, d, c);
  }
  const cap = (i, dir) => {
    const r = rings[i];
    const c0 = g.count; const uvv = [0, 0];
    cellUV(capCell, 0.5, 0.5, uvv);
    g.vert(pts[i].x, pts[i].y, pts[i].z, r.t.x * dir, r.t.y * dir, r.t.z * dir, uvv[0], uvv[1], shade(i / (n - 1)), wind(i / (n - 1)), 0, 1, 1, 1);
    const ids = [];
    for (let k = 0; k < sides; k++) {
      const a = (k / sides) * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
      cellUV(capCell, 0.5 + 0.46 * ca, 0.5 + 0.46 * sa, uvv);
      ids.push(g.vert(pts[i].x + (r.nrm.x * ca + r.bn.x * sa) * radii[i], pts[i].y + (r.nrm.y * ca + r.bn.y * sa) * radii[i], pts[i].z + (r.nrm.z * ca + r.bn.z * sa) * radii[i],
        r.t.x * dir, r.t.y * dir, r.t.z * dir, uvv[0], uvv[1], shade(i / (n - 1)), wind(i / (n - 1)), 0, 1, 1, 1));
    }
    for (let k = 0; k < sides; k++) { if (dir > 0) g.i.push(c0, ids[k], ids[(k + 1) % sides]); else g.i.push(c0, ids[(k + 1) % sides], ids[k]); }
  };
  if (capEnd) cap(n - 1, 1);
  if (capStart) cap(0, -1);
}

/** Single card quad. right/up are half-extent vectors. cell texture runs cu left→right, cv top→bottom. */
export function card(g, c, right, up, cell, nrm, shade = 1, wind = 0, tint = 1, flipV = false, color = [1, 1, 1]) {
  const uvv = [0, 0], out = [];
  const corners = [[-1, -1, 0, 1], [1, -1, 1, 1], [1, 1, 1, 0], [-1, 1, 0, 0]];
  for (const [sx, sy, cu, cv] of corners) {
    cellUV(cell, cu, flipV ? 1 - cv : cv, uvv);
    out.push(g.vert(c.x + right.x * sx + up.x * sy, c.y + right.y * sx + up.y * sy, c.z + right.z * sx + up.z * sy, nrm.x, nrm.y, nrm.z, uvv[0], uvv[1],
      shade * (sy > 0 ? 1 : 0.9), wind * (sy > 0 ? 1 : 0.3), tint, color[0], color[1], color[2]));
  }
  g.quad(out[0], out[1], out[2], out[3]);
}

/**
 * Card made of several rows from base (cv=1) to tip (cv=0).
 * rows: [{ l: Vector3, r: Vector3, wind }]  (left/right edge points)
 */
export function bentCard(g, rows, cell, nrm, shade = 1, tint = 1, color = [1, 1, 1], shadeTip = 1) {
  const uvv = [0, 0], ids = [];
  const m = rows.length;
  for (let i = 0; i < m; i++) {
    const cv = 1 - i / (m - 1), row = rows[i];
    const sh = shade + (shadeTip - shade) * (i / (m - 1));
    cellUV(cell, 0, cv, uvv);
    const a = g.vert(row.l.x, row.l.y, row.l.z, nrm.x, nrm.y, nrm.z, uvv[0], uvv[1], sh, row.wind, tint, color[0], color[1], color[2]);
    cellUV(cell, 1, cv, uvv);
    const b = g.vert(row.r.x, row.r.y, row.r.z, nrm.x, nrm.y, nrm.z, uvv[0], uvv[1], sh, row.wind, tint, color[0], color[1], color[2]);
    ids.push([a, b]);
  }
  for (let i = 0; i < m - 1; i++) g.quad(ids[i][0], ids[i][1], ids[i + 1][1], ids[i + 1][0]);
}

/** Solid-colour lathe / blob helper: appends an icosphere-like blob (UV in the white cell). */
export function blob(g, center, rx, ry, rz, detail, color, noiseFn, wind = 0.3, tint = 1, shadeFn = null) {
  const ico = new THREE.IcosahedronGeometry(1, detail);
  const pos = ico.attributes.position;
  const uvv = [0, 0]; cellUV('white', 0.5, 0.5, uvv);
  const idxMap = new Map();
  const ids = [];
  for (let i = 0; i < pos.count; i++) {
    const key = `${pos.getX(i).toFixed(3)},${pos.getY(i).toFixed(3)},${pos.getZ(i).toFixed(3)}`;
    let id = idxMap.get(key);
    if (id === undefined) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      const k = 1 + (noiseFn ? noiseFn(x, y, z) : 0);
      const px = center.x + x * rx * k, py = center.y + y * ry * k, pz = center.z + z * rz * k;
      const sh = shadeFn ? shadeFn(y) : 0.7 + 0.3 * (y * 0.5 + 0.5);
      id = g.vert(px, py, pz, x, y * 0.8 + 0.2, z, uvv[0], uvv[1], sh, wind, tint, color[0], color[1], color[2]);
      idxMap.set(key, id);
    }
    ids.push(id);
  }
  for (let i = 0; i < ids.length; i += 3) g.i.push(ids[i], ids[i + 1], ids[i + 2]);
}
