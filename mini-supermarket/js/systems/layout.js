/* Store floor plan. Every store uses the same 30×20 tile grid; the store
 * size decides where the right and top walls stand, so expanding simply
 * moves walls outward and reveals floor, shelf spots and checkouts that were
 * already reserved in the plan. Existing shelves never move.
 *
 *   col 0 .......... 5 6 ......................... right  29
 *   row top   #######################################
 *             # warehouse #  shelves / aisles        #   <- shelf rows 3,5,7,9
 *             #           #                          #      aisle below each
 *        15   #           D  checkout zone (11-15)   #
 *        16   ###[dock]###[exit][in]#################
 *        17   sidewalk
 *        18-19 street (delivery truck)
 */
(function (MS) {
  'use strict';

  const TILE = 40;
  const W = 30, H = 20;
  const BOTTOM = 16;           // bottom wall row (facade with doors)
  const SIDEWALK = 17;
  const WH = { x0: 1, x1: 4 }; // warehouse interior columns
  const DIVIDER = 5;           // wall between warehouse and shop floor
  const FLOOR_X0 = 6;
  const SHELF_ROWS = [9, 7, 5, 3];
  const SHELF_COLS = [7, 10, 13, 16, 19, 22, 25];

  const T = {
    GRASS: 0, SIDEWALK: 1, STREET: 2, FLOOR: 3, WAREHOUSE: 4, WALL: 5, DOOR: 6, WH_DOOR: 7, DOCK: 8, LOT: 9,
  };

  const insideAt = (level, x, y) => {
    const L = MS.STORE_LEVELS[level];
    return x + 1 < L.right && y > L.top;
  };

  /* All shelf spots in a stable order: spots that open at store level 1 come
   * first, then the ones that open at level 2, and so on. Slot indices are
   * saved, so this order must never change. */
  const SLOT_SPOTS = (() => {
    const spots = [];
    for (const y of SHELF_ROWS) {
      for (const x of SHELF_COLS) {
        let first = 0;
        for (let l = 1; l <= MS.MAX_STORE_LEVEL; l++) if (insideAt(l, x, y)) { first = l; break; }
        if (first) spots.push({ x, y, first });
      }
    }
    spots.sort((a, b) => a.first - b.first || b.y - a.y || a.x - b.x);
    return spots.map((s, i) => ({ index: i, x: s.x, y: s.y, level: s.first }));
  })();

  class Layout {
    constructor(level) {
      const L = MS.STORE_LEVELS[level];
      this.level = level;
      this.tile = TILE;
      this.w = W;
      this.h = H;
      this.right = L.right;
      this.top = L.top;
      this.bottom = BOTTOM;
      this.sidewalk = SIDEWALK;
      this.warehouse = { x0: WH.x0, x1: WH.x1, y0: L.top + 1, y1: BOTTOM - 1 };
      this.divider = DIVIDER;
      this.floorX0 = FLOOR_X0;
      this.whDoor = { x: DIVIDER, y: BOTTOM - 1 };
      this.exitDoor = { x: 6, y: BOTTOM };
      this.entryDoor = { x: 7, y: BOTTOM };
      this.dock = { x0: WH.x0, x1: WH.x1, y: BOTTOM };
      this.dockInside = { x: 2, y: BOTTOM - 1 };
      this.truckStopX = 3; // tile column the truck's cargo door lines up with

      this.slots = SLOT_SPOTS.filter((s) => s.level <= level);

      this.registers = [];
      for (let i = 0; i < L.registers; i++) {
        const qc = 9 + 3 * i;
        const queue = [];
        for (let y = BOTTOM - 2; y >= 9; y--) queue.push({ x: qc, y });
        this.registers.push({
          index: i,
          counter: { x: qc - 1, y0: BOTTOM - 3, y1: BOTTOM - 2 },
          cashierSpot: { x: qc - 2, y: BOTTOM - 2 },
          queue,
        });
      }

      // Decoration that blocks a tile (plants, promo stand).
      this.decor = [
        { kind: 'plant', x: this.right - 1, y: BOTTOM - 1 },
        { kind: 'plant', x: FLOOR_X0, y: this.top + 1 },
        { kind: 'promo', x: this.right - 2, y: BOTTOM - 4 },
      ];
      if (level >= 3) this.decor.push({ kind: 'plant', x: this.right - 1, y: this.top + 1 });

      // Where the next expansion will go (shown as a fenced building lot).
      const next = MS.STORE_LEVELS[level + 1];
      this.lot = next ? { x0: 0, x1: next.right, y0: next.top, y1: BOTTOM, signX: (this.right + 1 + next.right) / 2, signY: BOTTOM - 3 } : null;

      this.tiles = new Uint8Array(W * H);
      this.buildTiles();
      this.blocked = new Uint8Array(W * H);
    }

    buildTiles() {
      const { right, top } = this;
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          let t = T.GRASS;
          if (y >= BOTTOM + 2) t = T.STREET;
          else if (y === SIDEWALK) t = T.SIDEWALK;
          else if (y === BOTTOM) t = x <= right ? T.WALL : T.GRASS;
          else if (y === top && x <= right) t = T.WALL;
          else if (y > top && y < BOTTOM) {
            if (x === 0 || x === right || x === DIVIDER) t = T.WALL;
            else if (x > right) t = T.GRASS;
            else if (x < DIVIDER) t = T.WAREHOUSE;
            else t = T.FLOOR;
          }
          if (this.lot && x >= this.lot.x0 && x <= this.lot.x1 && y >= this.lot.y0 && y <= this.lot.y1 && t === T.GRASS) t = T.LOT;
          this.tiles[y * W + x] = t;
        }
      }
      this.tiles[this.whDoor.y * W + this.whDoor.x] = T.WH_DOOR;
      this.tiles[this.exitDoor.y * W + this.exitDoor.x] = T.DOOR;
      this.tiles[this.entryDoor.y * W + this.entryDoor.x] = T.DOOR;
      for (let x = this.dock.x0; x <= this.dock.x1; x++) this.tiles[BOTTOM * W + x] = T.DOCK;
    }

    /** Rebuilds the obstacle map from built shelves, counters and decor. */
    rebuildObstacles(builtSlotIndices) {
      this.blocked.fill(0);
      const block = (x, y) => { if (x >= 0 && y >= 0 && x < W && y < H) this.blocked[y * W + x] = 1; };
      for (const i of builtSlotIndices) {
        const s = SLOT_SPOTS[i];
        if (s) { block(s.x, s.y); block(s.x + 1, s.y); }
      }
      for (const r of this.registers) for (let y = r.counter.y0; y <= r.counter.y1; y++) block(r.counter.x, y);
      for (const d of this.decor) block(d.x, d.y);
    }

    tileAt(x, y) {
      if (x < 0 || y < 0 || x >= W || y >= H) return -1;
      return this.tiles[y * W + x];
    }

    walkableCustomer(x, y) {
      const t = this.tileAt(x, y);
      if (t === T.FLOOR) return !this.blocked[y * W + x];
      return t === T.DOOR || t === T.SIDEWALK;
    }

    walkableStaff(x, y) {
      const t = this.tileAt(x, y);
      if (t === T.FLOOR || t === T.WAREHOUSE) return !this.blocked[y * W + x];
      return t === T.DOOR || t === T.WH_DOOR || t === T.SIDEWALK;
    }

    path(fromX, fromY, toX, toY, staff) {
      const fn = staff ? (x, y) => this.walkableStaff(x, y) : (x, y) => this.walkableCustomer(x, y);
      return MS.findPath(W, H, fn, fromX, fromY, toX, toY);
    }

    /** Tiles in front of a shelf where a customer or stocker stands. */
    accessTiles(slotIndex) {
      const s = SLOT_SPOTS[slotIndex];
      return [{ x: s.x, y: s.y + 1 }, { x: s.x + 1, y: s.y + 1 }];
    }

    randomWarehouseTile() {
      const wh = this.warehouse;
      return { x: MS.U.randInt(wh.x0, wh.x1), y: MS.U.randInt(Math.max(wh.y0, wh.y1 - 4), wh.y1 - 1) };
    }

    /** A random free aisle tile on the shop floor (for wandering staff). */
    randomFloorTile() {
      for (let tries = 0; tries < 40; tries++) {
        const x = MS.U.randInt(FLOOR_X0, this.right - 1);
        const y = MS.U.randInt(this.top + 1, BOTTOM - 1);
        if (this.walkableStaff(x, y)) return { x, y };
      }
      return { x: FLOOR_X0, y: BOTTOM - 1 };
    }

    /** World-space rectangle the camera should keep in view (optionally without the building lot). */
    viewBounds(withLot = true) {
      const next = withLot ? MS.STORE_LEVELS[this.level + 1] : null;
      const r = next ? next.right + 1 : this.right + 1;
      const top = next ? Math.min(this.top, next.top) : this.top;
      return { x0: -0.4 * TILE, y0: (top - 1.2) * TILE, x1: (r + 0.6) * TILE, y1: H * TILE };
    }
  }

  Layout.TILE = TILE;
  Layout.W = W;
  Layout.H = H;
  Layout.T = T;
  Layout.SLOT_SPOTS = SLOT_SPOTS;
  Layout.slotCountAt = (level) => SLOT_SPOTS.filter((s) => s.level <= level).length;
  MS.Layout = Layout;
})((window.MS = window.MS || {}));
