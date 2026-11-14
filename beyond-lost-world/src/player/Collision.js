// CollisionWorld: spatial-hash broad phase + circle-vs-circle / circle-vs-oriented-box resolution
// for the player (a vertical capsule approximated as a circle spanning [feetY, feetY + height]).
// Reads `enabled` on every query so doors can be toggled at runtime.

export const STEP_HEIGHT = 0.45;
export const PLAYER_RADIUS = 0.35;
export const PLAYER_HEIGHT = 1.75;
const HEAD_MARGIN = 0.05;   // colliders whose underside is within this of the head don't block sideways
const CELL = 8;
const EPS = 1e-4;

const key = (ix, iz) => (ix + 2048) * 8192 + (iz + 2048);

export class CollisionWorld {
  /**
   * @param {{ colliders: object[], getHeightAt(x: number, z: number): number }} world
   * @param {{ cellSize?: number }} [opts]
   */
  constructor(world, opts = {}) {
    this.world = world;
    this.cell = opts.cellSize || CELL;
    this.grid = new Map();
    this.entries = [];
    this._count = -1;
    this._stamp = 0;
    this._tmpList = [];
    this._pen = { nx: 0, nz: 0, depth: 0 };
    this._ground = { y: 0, collider: null };
    this.rebuild();
  }

  /** Rebuilds the grid when colliders were added/removed since the last build. Cheap to call every frame. */
  sync() { if (this.world.colliders.length !== this._count) this.rebuild(); }

  rebuild() {
    const cs = this.world.colliders;
    this.grid.clear();
    this.entries.length = 0;
    this._count = cs.length;
    for (const c of cs) {
      const e = { c, stamp: 0, box: c.type === 'box', x: c.x, z: c.z, r: c.r || 0, hx: c.hx || 0, hz: c.hz || 0, cos: 1, sin: 0, minX: 0, maxX: 0, minZ: 0, maxZ: 0 };
      if (e.box) {
        const rot = c.rot || 0;
        e.cos = Math.cos(rot); e.sin = Math.sin(rot);
        const ex = Math.abs(e.cos) * e.hx + Math.abs(e.sin) * e.hz;
        const ez = Math.abs(e.sin) * e.hx + Math.abs(e.cos) * e.hz;
        e.minX = c.x - ex; e.maxX = c.x + ex; e.minZ = c.z - ez; e.maxZ = c.z + ez;
      } else {
        e.minX = c.x - e.r; e.maxX = c.x + e.r; e.minZ = c.z - e.r; e.maxZ = c.z + e.r;
      }
      this.entries.push(e);
      const i0 = Math.floor(e.minX / this.cell), i1 = Math.floor(e.maxX / this.cell);
      const j0 = Math.floor(e.minZ / this.cell), j1 = Math.floor(e.maxZ / this.cell);
      for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
        const k = key(i, j);
        let bucket = this.grid.get(k);
        if (!bucket) { bucket = []; this.grid.set(k, bucket); }
        bucket.push(e);
      }
    }
  }

  /** Internal: entries whose bounding box touches the circle. */
  _query(x, z, r, out) {
    out.length = 0;
    const stamp = ++this._stamp;
    const i0 = Math.floor((x - r) / this.cell), i1 = Math.floor((x + r) / this.cell);
    const j0 = Math.floor((z - r) / this.cell), j1 = Math.floor((z + r) / this.cell);
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
      const bucket = this.grid.get(key(i, j));
      if (!bucket) continue;
      for (let n = 0; n < bucket.length; n++) {
        const e = bucket[n];
        if (e.stamp === stamp) continue;
        e.stamp = stamp;
        if (x + r < e.minX || x - r > e.maxX || z + r < e.minZ || z - r > e.maxZ) continue;
        out.push(e);
      }
    }
    return out;
  }

  /**
   * Colliders (enabled or not) whose bounds overlap the circle.
   * @param {number} x @param {number} z @param {number} r @param {object[]} [out]
   * @returns {object[]} `out`
   */
  queryCircle(x, z, r, out = []) {
    const list = this._query(x, z, r, this._tmpList);
    out.length = 0;
    for (const e of list) out.push(e.c);
    return out;
  }

  /**
   * Penetration of circle (x,z,r) into entry e. Returns true and fills `pen` (push direction + depth) on overlap.
   */
  _penetration(e, x, z, r, pen) {
    if (!e.box) {
      const dx = x - e.x, dz = z - e.z;
      const min = r + e.r;
      const d2 = dx * dx + dz * dz;
      if (d2 >= min * min) return false;
      const d = Math.sqrt(d2);
      if (d < 1e-6) { pen.nx = 1; pen.nz = 0; } else { pen.nx = dx / d; pen.nz = dz / d; }
      pen.depth = min - d;
      return true;
    }
    const dx = x - e.x, dz = z - e.z;
    const lx = dx * e.cos - dz * e.sin;
    const lz = dx * e.sin + dz * e.cos;
    const cx = lx < -e.hx ? -e.hx : lx > e.hx ? e.hx : lx;
    const cz = lz < -e.hz ? -e.hz : lz > e.hz ? e.hz : lz;
    const ox = lx - cx, oz = lz - cz;
    const d2 = ox * ox + oz * oz;
    let nlx, nlz, depth;
    if (d2 > 1e-10) {
      if (d2 >= r * r) return false;
      const d = Math.sqrt(d2);
      nlx = ox / d; nlz = oz / d; depth = r - d;
    } else {
      const px = e.hx - Math.abs(lx), pz = e.hz - Math.abs(lz);
      if (px < pz) { nlx = lx < 0 ? -1 : 1; nlz = 0; depth = px + r; }
      else { nlx = 0; nlz = lz < 0 ? -1 : 1; depth = pz + r; }
    }
    pen.nx = nlx * e.cos + nlz * e.sin;
    pen.nz = -nlx * e.sin + nlz * e.cos;
    pen.depth = depth;
    return true;
  }

  /**
   * Pushes the circle out of every enabled collider that blocks a body standing at `feetY`.
   * A collider blocks when it is enabled and its vertical range overlaps [feetY + stepHeight, feetY + height).
   * Mutates `pos` ({x, z}); `normal` (optional {x, z}) accumulates the sum of push directions.
   * @returns {boolean} whether anything pushed
   */
  resolve(pos, feetY, r = PLAYER_RADIUS, height = PLAYER_HEIGHT, normal = null) {
    const list = this._query(pos.x, pos.z, r + 0.01, this._tmpList);
    if (!list.length) return false;
    const lo = feetY + STEP_HEIGHT + EPS, hi = feetY + height - HEAD_MARGIN;
    const pen = this._pen;
    let pushed = false;
    if (normal) { normal.x = 0; normal.z = 0; }
    for (let pass = 0; pass < 3; pass++) {
      let any = false;
      for (let n = 0; n < list.length; n++) {
        const e = list[n], c = e.c;
        if (c.enabled === false || c.yMax <= lo || c.yMin >= hi) continue;
        if (!this._penetration(e, pos.x, pos.z, r, pen)) continue;
        pos.x += pen.nx * (pen.depth + EPS);
        pos.z += pen.nz * (pen.depth + EPS);
        if (normal) { normal.x += pen.nx; normal.z += pen.nz; }
        any = true; pushed = true;
      }
      if (!any) break;
    }
    return pushed;
  }

  /**
   * Ground under a circle: max(terrain height, top of any enabled collider under the circle whose
   * yMax ≤ feetY + stepHeight). Returns the shared result object { y, collider } (collider null = terrain).
   * @returns {{ y: number, collider: object|null }}
   */
  groundInfoAt(x, z, r, feetY, out = this._ground) {
    let y = this.world.getHeightAt(x, z);
    let top = null;
    const list = this._query(x, z, r, this._tmpList);
    const limit = feetY + STEP_HEIGHT + EPS;
    const pen = this._pen;
    for (let n = 0; n < list.length; n++) {
      const e = list[n], c = e.c;
      if (c.enabled === false || c.yMax > limit || c.yMax <= y) continue;
      if (!this._penetration(e, x, z, r, pen)) continue;
      y = c.yMax; top = c;
    }
    out.y = y; out.collider = top;
    return out;
  }

  /** @returns {number} ground height (see groundInfoAt). */
  groundHeightAt(x, z, r, feetY) { return this.groundInfoAt(x, z, r, feetY, this._ground).y; }

  /**
   * Lowest underside (yMin) of an enabled collider above `headY` that overlaps the circle, or Infinity.
   * Used to stop a rising body.
   */
  ceilingAt(x, z, r, headY) {
    const list = this._query(x, z, r, this._tmpList);
    const pen = this._pen;
    let best = Infinity;
    for (let n = 0; n < list.length; n++) {
      const e = list[n], c = e.c;
      if (c.enabled === false || c.yMin < headY - HEAD_MARGIN || c.yMin >= best) continue;
      if (!this._penetration(e, x, z, r, pen)) continue;
      best = c.yMin;
    }
    return best;
  }
}
