// Geometry builder shared by all structure sites.
// Collects transformed boxes/cylinders/arbitrary geometry per material, registers colliders in
// world space, and merges everything into one mesh per material (few draw calls).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const Y = new THREE.Vector3(0, 1, 0);
const _loc = new THREE.Matrix4(), _mat = new THREE.Matrix4(), _q = new THREE.Quaternion(), _eu = new THREE.Euler(), _p = new THREE.Vector3(), _sc = new THREE.Vector3(), _col = new THREE.Color();

/** Scale UVs of a BoxGeometry so textures tile in metres. */
function boxUV(g, w, h, d, tile, ou, ov) {
  const uv = g.attributes.uv;
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]]; // px nx py ny pz nz
  for (let f = 0; f < 6; f++) {
    const [a, b] = dims[f];
    for (let i = 0; i < 4; i++) {
      const k = f * 4 + i;
      uv.setXY(k, uv.getX(k) * a / tile + ou, uv.getY(k) * b / tile + ov);
    }
  }
}

export class Builder {
  /**
   * @param {string} name
   * @param {object} lib material library from createMaterials()
   * @param {{colliders:Array, rand:Function}} ctx
   */
  constructor(name, lib, ctx) {
    this.name = name; this.lib = lib; this.M = lib.M; this.ctx = ctx; this.rand = ctx.rand;
    this.buckets = new Map();
    this.stack = [new THREE.Matrix4()];
    this.yaws = [0];
    this.clutter = false;
  }
  get m() { return this.stack[this.stack.length - 1]; }
  get yaw() { return this.yaws[this.yaws.length - 1]; }

  /** Runs fn with a local frame (x,y,z, yaw) pushed. */
  at(x, y, z, yaw, fn) {
    _loc.compose(_p.set(x, y, z), _q.setFromAxisAngle(Y, yaw || 0), _sc.set(1, 1, 1));
    this.stack.push(new THREE.Matrix4().multiplyMatrices(this.m, _loc));
    this.yaws.push(this.yaw + (yaw || 0));
    fn(this);
    this.stack.pop(); this.yaws.pop();
  }
  /** Local → world position. */
  wp(x, y, z, out = new THREE.Vector3()) { return out.set(x, y, z).applyMatrix4(this.m); }

  _push(key, g) {
    const k = this.clutter ? key + '#c' : key;
    let list = this.buckets.get(k);
    if (!list) this.buckets.set(k, list = []);
    list.push(g);
  }

  /** Transforms an owned geometry into the current frame and stores it. */
  add(key, g, x = 0, y = 0, z = 0, o = {}) {
    _eu.set(o.rx || 0, o.ry || 0, o.rz || 0, 'YXZ');
    _q.setFromEuler(_eu);
    _sc.set(o.sx ?? o.s ?? 1, o.sy ?? o.s ?? 1, o.sz ?? o.s ?? 1);
    _loc.compose(_p.set(x, y, z), _q, _sc);
    _mat.multiplyMatrices(this.m, _loc);
    g.applyMatrix4(_mat);
    for (const n of Object.keys(g.attributes)) if (n !== 'position' && n !== 'normal' && n !== 'uv' && !(o.keepColor && n === 'color')) g.deleteAttribute(n);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    const n = g.attributes.position.count;
    const j = o.j ?? 0.07, f = 1 + (this.rand() - 0.5) * 2 * j;
    if (o.tint === undefined) _col.setRGB(1, 1, 1); else if (Array.isArray(o.tint)) _col.setRGB(o.tint[0], o.tint[1], o.tint[2]); else _col.set(o.tint);
    _col.multiplyScalar(f);
    const col = (o.keepColor && g.attributes.color) ? g.attributes.color.array : new Float32Array(n * 3);
    if (!o.keepColor) for (let i = 0; i < n; i++) { col[i * 3] = _col.r; col[i * 3 + 1] = _col.g; col[i * 3 + 2] = _col.b; }
    // optional vertical darkening toward the ground (dirt) – cheap ambient-occlusion feel
    if (o.ao) {
      const pos = g.attributes.position;
      for (let i = 0; i < n; i++) { const k = 1 - o.ao * Math.max(0, 1 - (pos.getY(i) - (o.aoY ?? 0)) / 1.2); col[i * 3] *= k; col[i * 3 + 1] *= k; col[i * 3 + 2] *= k; }
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    this._push(key, g);
  }

  /** Box centred at (x,y,z) with size w,h,d. o: {tint, rx, ry, rz, c (collider), tile, j}. */
  box(key, x, y, z, w, h, d, o = {}) {
    const g = new THREE.BoxGeometry(w, h, d);
    boxUV(g, w, h, d, o.tile ?? this.lib.tile[key] ?? 2, this.rand() * (o.noOffset ? 0 : 1), this.rand() * (o.noOffset ? 0 : 1));
    this.add(key, g, x, y, z, o);
    if (o.c) this.boxCollider(x, y, z, w, h, d, o);
  }
  /** Collider only (local coordinates). */
  solid(x, y, z, w, h, d, c = true, ry = 0) { this.boxCollider(x, y, z, w, h, d, { c, ry }); }
  boxCollider(x, y, z, w, h, d, o) {
    const c = o.c === true ? {} : o.c;
    this.wp(x, y, z, _p);
    this.ctx.colliders.push({
      id: c.id, type: 'box', x: _p.x, z: _p.z, hx: w / 2, hz: d / 2, rot: this.yaw + (o.ry || 0),
      yMin: c.yMin ?? _p.y - h / 2, yMax: c.yMax ?? _p.y + h / 2, enabled: true, surface: c.surface,
    });
  }
  circleCollider(x, y, z, r, h, c = {}) {
    this.wp(x, y, z, _p);
    this.ctx.colliders.push({ id: c.id, type: 'circle', x: _p.x, z: _p.z, r, yMin: c.yMin ?? _p.y - h / 2, yMax: c.yMax ?? _p.y + h / 2, enabled: true, surface: c.surface });
  }

  /** Cylinder (or cone) centred at (x,y,z). o.cc = circle collider (true or {surface}). */
  cyl(key, x, y, z, rt, rb, h, seg = 12, o = {}) {
    const g = new THREE.CylinderGeometry(rt, rb, h, seg, 1, !!o.open);
    const tile = o.tile ?? this.lib.tile[key] ?? 2;
    const uv = g.attributes.uv, circ = TAU * Math.max(rt, rb), ou = this.rand(), ov = this.rand();
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * circ / tile + ou, uv.getY(i) * h / tile + ov);
    this.add(key, g, x, y, z, o);
    if (o.cc) this.circleCollider(x, y, z, o.cr ?? Math.max(rt, rb), h, o.cc === true ? {} : o.cc);
  }

  /** Any geometry (owned). uvScale multiplies UVs. o.cc adds a circle collider. */
  geo(key, g, x = 0, y = 0, z = 0, o = {}) {
    if (o.uv) { const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * o.uv[0], uv.getY(i) * (o.uv[1] ?? o.uv[0])); }
    this.add(key, g, x, y, z, o);
    if (o.cc) this.circleCollider(x, y, z, o.cr ?? 0.5, o.ch ?? 1, o.cc === true ? {} : o.cc);
  }

  /** Planar quad facing +z of the current frame (rotate with o.ry). UV maps the whole texture. */
  quad(key, x, y, z, w, h, o = {}) {
    const g = new THREE.PlaneGeometry(w, h);
    if (o.uvRect) { const [u0, v0, u1, v1] = o.uvRect; const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, u0 + uv.getX(i) * (u1 - u0), v0 + uv.getY(i) * (v1 - v0)); }
    else if (o.uv) { const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * o.uv[0], uv.getY(i) * o.uv[1]); }
    this.add(key, g, x, y, z, o);
  }

  /** Merge everything into meshes (one per material, plus a '#c' clutter mesh). */
  build() {
    const group = new THREE.Group();
    group.name = this.name;
    for (const [k, list] of this.buckets) {
      const [key, flag] = k.split('#');
      const anyIndexed = list.some((g) => g.index), allIndexed = list.every((g) => g.index);
      const geoms = (anyIndexed && !allIndexed) ? list.map((g) => (g.index ? g.toNonIndexed() : g)) : list;
      const merged = mergeGeometries(geoms, false);
      if (!merged) { console.warn('[structures] merge failed', this.name, key); continue; }
      merged.computeBoundingSphere();
      const mesh = new THREE.Mesh(merged, this.M[key]);
      mesh.name = `${this.name}:${key}${flag ? ':clutter' : ''}`;
      mesh.castShadow = !this.lib.noShadow.has(key);
      mesh.receiveShadow = true;
      mesh.userData.clutter = !!flag;
      group.add(mesh);
      list.forEach((g) => g.dispose());
    }
    this.buckets.clear();
    return group;
  }
}

const TAU = Math.PI * 2;

/** Builds a standalone object (own origin, colliders discarded) from a builder callback. */
export function makeObject(lib, rand, name, fn) {
  const b = new Builder(name, lib, { colliders: [], rand });
  fn(b);
  return b.build();
}

/** Seeded helpers. */
export const pick = (rand, arr) => arr[Math.floor(rand() * arr.length) % arr.length];
export const range = (rand, a, b) => a + rand() * (b - a);

/** Local→world helper for placing top-level objects from an origin + yaw. */
export function toWorld(ox, oz, yaw, lx, lz) {
  const c = Math.cos(yaw), s = Math.sin(yaw);
  return [ox + lx * c + lz * s, oz - lx * s + lz * c];
}

/** Rotation.y such that local +z faces direction (dx,dz). */
export const yawFacing = (dx, dz) => Math.atan2(dx, dz);
