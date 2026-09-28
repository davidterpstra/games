/* Inventory: the warehouse (magazijn) of one store and moving stock from the
 * warehouse onto shelves. Shelf stock lives on the store's slots. */
(function (MS) {
  'use strict';

  class Inventory {
    constructor(store, saved) {
      this.store = store;
      this.warehouse = {};
      if (saved && typeof saved === 'object') {
        for (const [pid, n] of Object.entries(saved)) {
          if (MS.product(pid) && MS.U.isNum(n) && n > 0) this.warehouse[pid] = Math.floor(n);
        }
      }
    }

    get shelfCapacity() { return this.store.upgrades.value('stock').shelf; }
    get warehouseCapacity() { return this.store.upgrades.value('stock').warehouse + (this.store.level - 1) * 80; }

    qty(pid) { return this.warehouse[pid] || 0; }

    units() {
      let n = 0;
      for (const v of Object.values(this.warehouse)) n += v;
      return n;
    }

    /** Units on their way (ordered, not yet unloaded). */
    incoming(pid) {
      let n = 0;
      for (const d of this.store.deliveries) {
        if (pid) n += d.items[pid] || 0;
        else for (const v of Object.values(d.items)) n += v;
      }
      return n;
    }

    freeSpace() { return Math.max(0, this.warehouseCapacity - this.units() - this.incoming()); }

    add(pid, n) {
      if (!(n > 0)) return;
      this.warehouse[pid] = this.qty(pid) + Math.floor(n);
    }

    take(pid, n) {
      const t = Math.max(0, Math.min(Math.floor(n), this.qty(pid)));
      if (t > 0) {
        this.warehouse[pid] -= t;
        if (!this.warehouse[pid]) delete this.warehouse[pid];
      }
      return t;
    }

    shelfNeed(slot) { return Math.max(0, this.shelfCapacity - slot.stock); }

    /** Moves stock from the warehouse onto a shelf; returns the units moved. */
    restock(slot, max = Infinity) {
      if (!slot || !slot.productId) return 0;
      const moved = this.take(slot.productId, Math.min(this.shelfNeed(slot), max));
      slot.stock += moved;
      return moved;
    }

    /** Stock level of a product: 'ok' | 'low' | 'out' (nothing anywhere). */
    status(pid) {
      const slot = this.store.slotFor(pid);
      const shelf = slot ? slot.stock : 0;
      const back = this.qty(pid) + this.incoming(pid);
      if (shelf + back <= 0) return 'out';
      if (back < Math.ceil(this.shelfCapacity * 0.5) || (slot && shelf <= this.lowShelfMark())) return 'low';
      return 'ok';
    }

    lowShelfMark() { return Math.max(1, Math.ceil(this.shelfCapacity * 0.25)); }

    toJSON() { return { ...this.warehouse }; }
  }

  MS.Inventory = Inventory;
})((window.MS = window.MS || {}));
