/* Grid A* used by customers and staff. 8 directions, no cutting corners
 * past walls or shelves. The store grid is small (30×20), so a plain binary
 * heap is plenty fast. */
(function (MS) {
  'use strict';

  class MinHeap {
    constructor() { this.items = []; }
    get size() { return this.items.length; }
    push(node, f) {
      const a = this.items;
      a.push({ node, f });
      let i = a.length - 1;
      while (i > 0) {
        const p = (i - 1) >> 1;
        if (a[p].f <= a[i].f) break;
        [a[p], a[i]] = [a[i], a[p]];
        i = p;
      }
    }
    pop() {
      const a = this.items;
      const top = a[0];
      const last = a.pop();
      if (a.length) {
        a[0] = last;
        let i = 0;
        for (;;) {
          const l = i * 2 + 1, r = l + 1;
          let m = i;
          if (l < a.length && a[l].f < a[m].f) m = l;
          if (r < a.length && a[r].f < a[m].f) m = r;
          if (m === i) break;
          [a[m], a[i]] = [a[i], a[m]];
          i = m;
        }
      }
      return top.node;
    }
  }

  const DIRS = [
    [1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1],
    [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2],
  ];

  /**
   * Finds a path of tile coordinates from (sx,sy) to (tx,ty).
   * @param {number} w grid width
   * @param {number} h grid height
   * @param {(x:number,y:number)=>boolean} walkable
   * @returns {{x:number,y:number}[]|null} tiles excluding the start, or null
   */
  function findPath(w, h, walkable, sx, sy, tx, ty) {
    if (sx === tx && sy === ty) return [];
    if (!walkable(tx, ty)) return null;
    const idx = (x, y) => y * w + x;
    const g = new Float32Array(w * h).fill(Infinity);
    const came = new Int32Array(w * h).fill(-1);
    const closed = new Uint8Array(w * h);
    const heur = (x, y) => {
      const dx = Math.abs(x - tx), dy = Math.abs(y - ty);
      return dx + dy + (Math.SQRT2 - 2) * Math.min(dx, dy);
    };
    const open = new MinHeap();
    const start = idx(sx, sy);
    g[start] = 0;
    open.push(start, heur(sx, sy));
    const goal = idx(tx, ty);

    while (open.size) {
      const cur = open.pop();
      if (cur === goal) break;
      if (closed[cur]) continue;
      closed[cur] = 1;
      const cx = cur % w, cy = (cur / w) | 0;
      for (const [dx, dy, cost] of DIRS) {
        const nx = cx + dx, ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        if (!walkable(nx, ny)) continue;
        if (dx && dy && (!walkable(cx + dx, cy) || !walkable(cx, cy + dy))) continue;
        const ni = idx(nx, ny);
        if (closed[ni]) continue;
        const ng = g[cur] + cost;
        if (ng < g[ni]) {
          g[ni] = ng;
          came[ni] = cur;
          open.push(ni, ng + heur(nx, ny));
        }
      }
    }
    if (came[goal] === -1) return null;
    const path = [];
    for (let c = goal; c !== start; c = came[c]) path.push({ x: c % w, y: (c / w) | 0 });
    return path.reverse();
  }

  MS.findPath = findPath;
})((window.MS = window.MS || {}));
