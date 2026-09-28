/* Truck: the delivery van that brings ordered stock. It drives in along the
 * street, parks in front of the warehouse dock, waits to be unloaded (by the
 * player or a warehouse worker) and drives off again. */
(function (MS) {
  'use strict';

  const TILE = () => MS.Layout.TILE;

  class Truck {
    constructor(store, delivery) {
      this.store = store;
      this.delivery = delivery;
      const T = TILE();
      const L = store.layout;
      this.y = (L.bottom + 2.95) * T;          // base line of the wheels
      this.parkX = (L.dock.x0 - 0.4) * T;      // x of the rear (cargo) end
      this.x = -7 * T;
      this.state = 'arriving';
      this.t = 0;
      this.speed = 0;
      this.bounce = 0;
      this.width = 4.4 * T;
    }

    hasCargo() { return Object.values(this.delivery.items).some((n) => n > 0); }

    cargoUnits() {
      let n = 0;
      for (const v of Object.values(this.delivery.items)) n += v;
      return n;
    }

    /** Removes one order line (one product) from the cargo. */
    takeLine() {
      for (const [pid, n] of Object.entries(this.delivery.items)) {
        delete this.delivery.items[pid];
        if (n > 0) return { pid, n };
      }
      return null;
    }

    /** Removes all cargo at once (the player tapped the truck). */
    takeAll() {
      const lines = [];
      for (const [pid, n] of Object.entries(this.delivery.items)) if (n > 0) lines.push({ pid, n });
      this.delivery.items = {};
      return lines;
    }

    update(dt) {
      this.t += dt;
      this.bounce = Math.max(0, this.bounce - dt * 3);
      if (this.state === 'arriving') {
        const dist = this.parkX - this.x;
        const v = Math.max(40, Math.min(420, dist * 2.4));
        this.x += v * dt;
        if (this.x >= this.parkX - 0.5) {
          this.x = this.parkX;
          this.state = 'docked';
          this.bounce = 1;
          this.store.game.onTruckDocked(this.store, this);
        }
      } else if (this.state === 'docked') {
        if (!this.hasCargo()) { this.state = 'leaving'; this.speed = 20; }
      } else if (this.state === 'leaving') {
        this.speed = Math.min(520, this.speed + 380 * dt);
        this.x += this.speed * dt;
        if (this.x > (MS.Layout.W + 6) * TILE()) this.state = 'gone';
      }
    }
  }

  MS.Truck = Truck;
})((window.MS = window.MS || {}));
