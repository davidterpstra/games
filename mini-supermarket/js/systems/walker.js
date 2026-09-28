/* Walker: shared movement for customers and staff — follows an A* path of
 * tile centres, keeps a small personal offset so people do not overlap
 * perfectly, and tracks a walk phase for the bobbing animation. */
(function (MS) {
  'use strict';

  const TILE = () => MS.Layout.TILE;

  class Walker {
    constructor(store, opts = {}) {
      this.store = store;
      this.x = 0;
      this.y = 0;
      this.path = [];
      this.baseSpeed = opts.speed || 2.2; // tiles per second
      this.phase = Math.random() * 6;
      this.facing = 1;
      this.moving = false;
      this.ox = opts.jitter ? MS.U.rand(-opts.jitter, opts.jitter) : 0;
      this.oy = opts.jitter ? MS.U.rand(-opts.jitter * 0.6, opts.jitter * 0.6) : 0;
      this.staff = !!opts.staff;
    }

    get tileX() { return Math.floor((this.x - this.ox) / TILE()); }
    get tileY() { return Math.floor((this.y - this.oy) / TILE()); }

    placeAtTile(tx, ty) {
      this.x = (tx + 0.5) * TILE() + this.ox;
      this.y = (ty + 0.5) * TILE() + this.oy;
    }

    /** Plans a route to a tile. Falls back to a straight line if no route exists. */
    goTo(tx, ty) {
      const layout = this.store.layout;
      const sx = MS.U.clamp(this.tileX, 0, layout.w - 1);
      const sy = MS.U.clamp(this.tileY, 0, layout.h - 1);
      const tiles = layout.path(sx, sy, tx, ty, this.staff);
      const T = TILE();
      if (tiles) {
        this.path = tiles.map((t) => ({ x: (t.x + 0.5) * T + this.ox, y: (t.y + 0.5) * T + this.oy }));
      } else {
        this.path = [{ x: (tx + 0.5) * T + this.ox, y: (ty + 0.5) * T + this.oy }];
      }
      this.dest = { x: tx, y: ty };
      return !!tiles;
    }

    /** Adds a raw world-space waypoint (used to walk off-screen). */
    addWaypoint(x, y) { this.path.push({ x, y }); }

    get arrived() { return this.path.length === 0; }

    speedMult() { return this.store.upgrades.value('walkSpeed'); }

    /** Moves along the path; returns true on the frame the path is finished. */
    step(dt) {
      if (!this.path.length) { this.moving = false; return false; }
      let budget = this.baseSpeed * this.speedMult() * TILE() * dt;
      while (budget > 0 && this.path.length) {
        const wp = this.path[0];
        const dx = wp.x - this.x, dy = wp.y - this.y;
        const d = Math.hypot(dx, dy);
        if (d <= budget) {
          this.x = wp.x; this.y = wp.y;
          budget -= d;
          this.path.shift();
        } else {
          this.x += (dx / d) * budget;
          this.y += (dy / d) * budget;
          budget = 0;
        }
        if (Math.abs(dx) > 0.5) this.facing = dx > 0 ? 1 : -1;
      }
      this.moving = true;
      this.phase += dt * 11 * this.speedMult() * (this.baseSpeed / 2.2);
      if (!this.path.length) { this.moving = false; return true; }
      return false;
    }
  }

  MS.Walker = Walker;
})((window.MS = window.MS || {}));
