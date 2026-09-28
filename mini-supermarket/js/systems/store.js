/* Store: everything about one supermarket — its size, shelves, warehouse,
 * upgrades, staff, deliveries and the people walking around in it.
 * Only the active store runs a live simulation; other owned stores keep
 * their saved state (and earn passive income when fully staffed). */
(function (MS) {
  'use strict';

  const U = MS.U;
  const MAX_DIRT = 12;

  // ---- Register (kassa) ------------------------------------------------------
  class Register {
    constructor(store, def) {
      this.store = store;
      this.def = def;
      this.index = def.index;
      this.queue = [];
      this.cashier = null;
      this.manual = false;
      this.current = null;
      this.scanning = false;
      this.progress = 0;
      this.scanned = 0;
      this.units = 0;
      this.flash = 0;
    }

    get staffed() { return !!(this.cashier && this.cashier.atPost) && !this.store.game.salaryUnpaid; }
    /** Checkout 1 is always open (the player runs it); others need a cashier. */
    get open() { return this.index === 0 || this.staffed; }
    get front() { return this.queue[0] || null; }
    get waitingForPlayer() {
      const f = this.front;
      return !!f && f.state === 'atCounter' && !this.scanning && !this.staffed;
    }

    scanTime() { return this.store.upgrades.value('checkoutSpeed'); }

    update(dt) {
      this.flash = Math.max(0, this.flash - dt);
      const f = this.front;
      if (!this.scanning && f && f.state === 'atCounter' && (this.staffed || this.manual)) this.start(f);
      if (!this.scanning) return;
      if (!this.current || this.current.state !== 'paying') { this.resetScan(); return; }
      this.progress += dt / this.scanTime();
      while (this.progress >= 1 && this.scanned < this.units) {
        this.progress -= 1;
        this.scanOne();
      }
      if (this.scanned >= this.units) this.finish();
    }

    start(c) {
      this.current = c;
      this.scanning = true;
      this.progress = 0;
      this.scanned = 0;
      this.units = c.itemsInCart;
      this.manual = false;
      c.state = 'paying';
    }

    scanOne() {
      this.scanned++;
      this.flash = 0.18;
      this.store.game.onScan(this);
    }

    finish() {
      const c = this.current;
      this.resetScan();
      const i = this.queue.indexOf(c);
      if (i >= 0) this.queue.splice(i, 1);
      if (c) c.pay();
    }

    resetScan() {
      this.current = null;
      this.scanning = false;
      this.progress = 0;
      this.scanned = 0;
      this.units = 0;
    }

    /** The player tapped this checkout. */
    tap() {
      if (this.scanning) {
        if (this.scanned < this.units) {
          this.progress = 0;
          this.scanOne();
          if (this.scanned >= this.units) this.finish();
        }
        return 'scan';
      }
      const f = this.front;
      if (f && f.state === 'atCounter') { this.start(f); return 'start'; }
      if (f) { this.manual = true; return 'queued'; }
      return 'empty';
    }
  }

  // ---- Store -------------------------------------------------------------------
  class Store {
    constructor(game, def, saved) {
      this.game = game;
      this.def = def;
      this.id = def.id;
      saved = saved && typeof saved === 'object' ? saved : null;

      this.owned = def.price === 0 || !!(saved && saved.owned);
      this.level = U.clamp(saved && U.isNum(saved.level) ? Math.floor(saved.level) : 1, 1, MS.MAX_STORE_LEVEL);
      this.upgrades = new MS.UpgradeSystem(this, saved && saved.upgrades);
      this.deliveries = [];
      this.inventory = new MS.Inventory(this, saved && saved.warehouse);
      this.slots = MS.Layout.SLOT_SPOTS.map((s) => ({ index: s.index, built: false, productId: null, stock: 0, targetedBy: null, lowWarned: false }));
      this.staff = [];
      this.dirt = [];
      this.missed = {};
      this.stats = { served: 0, revenue: 0, profit: 0, lost: 0, happy: 0 };
      this.rating = 0.8;
      this.profitRate = 0;
      this.netAccum = 0;
      this.netTimer = 0;

      if (saved) this.loadSaved(saved);
      else if (this.owned) this.setupStarter();

      // Runtime-only state (the live simulation).
      this.active = false;
      this.layout = new MS.Layout(this.level);
      this.customers = [];
      this.employees = [];
      this.registers = [];
      this.truck = null;
      this.spawnTimer = 1.5;
    }

    loadSaved(saved) {
      if (Array.isArray(saved.slots)) {
        for (const s of saved.slots) {
          if (!s || !U.isNum(s.index) || !this.slots[s.index]) continue;
          const slot = this.slots[s.index];
          slot.built = !!s.built;
          const p = s.productId ? MS.product(s.productId) : null;
          slot.productId = slot.built && p && p.availableIn(this.id) ? p.id : null;
          slot.stock = slot.productId && U.isNum(s.stock) ? U.clamp(Math.floor(s.stock), 0, 999) : 0;
        }
      }
      if (Array.isArray(saved.deliveries)) {
        for (const d of saved.deliveries) {
          if (!d || typeof d.items !== 'object') continue;
          const items = {};
          for (const [pid, n] of Object.entries(d.items)) if (MS.product(pid) && U.isNum(n) && n > 0) items[pid] = Math.floor(n);
          if (Object.keys(items).length) this.deliveries.push({ id: U.uid('d'), items, eta: U.clamp(U.isNum(d.eta) ? d.eta : 0, 0, 120), state: 'enroute' });
        }
      }
      if (Array.isArray(saved.staff)) {
        for (const e of saved.staff) {
          if (e && MS.STAFF_TYPES[e.type]) this.staff.push({ id: String(e.id || U.uid('e')), type: e.type, name: String(e.name || U.pick(MS.STAFF_NAMES)).slice(0, 20) });
        }
      }
      if (Array.isArray(saved.dirt)) {
        for (const d of saved.dirt.slice(0, MAX_DIRT)) {
          if (d && U.isNum(d.x) && U.isNum(d.y)) this.dirt.push({ id: U.uid('dirt'), x: d.x | 0, y: d.y | 0, kind: d.kind || 'spill', targetedBy: null, age: 99 });
        }
      }
      if (saved.missed && typeof saved.missed === 'object') {
        for (const [pid, n] of Object.entries(saved.missed)) if (MS.product(pid) && U.isNum(n)) this.missed[pid] = Math.floor(n);
      }
      if (saved.stats && typeof saved.stats === 'object') {
        for (const k of Object.keys(this.stats)) if (U.isNum(saved.stats[k])) this.stats[k] = saved.stats[k];
      }
      if (U.isNum(saved.rating)) this.rating = U.clamp(saved.rating, 0, 1);
      if (U.isNum(saved.profitRate)) this.profitRate = U.clamp(saved.profitRate, -1e6, 1e7);
    }

    /** A brand-new store opens with four stocked shelves and a bit of stock in the back. */
    setupStarter() {
      const cap = this.inventory.shelfCapacity;
      this.def.starter.forEach((pid, i) => {
        const slot = this.slots[i];
        slot.built = true;
        slot.productId = pid;
        slot.stock = cap;
        this.inventory.add(pid, MS.product(pid).pack * 2);
      });
    }

    // ---- Lifecycle -------------------------------------------------------------
    activate() {
      this.active = true;
      this.layout = new MS.Layout(this.level);
      this.rebuildObstacles();
      this.registers = this.layout.registers.map((def) => new Register(this, def));
      this.employees = this.staff.map((d) => new MS.Employee(this, d));
      this.customers = [];
      this.truck = null;
      this.spawnTimer = 1.2;
      for (const d of this.deliveries) { d.state = 'enroute'; d.eta = Math.max(d.eta, 1.5); }
      for (const s of this.slots) s.targetedBy = null;
      for (const d of this.dirt) d.targetedBy = null;
    }

    deactivate() {
      for (const c of this.customers) c.dispose();
      for (const e of this.employees) e.dispose();
      if (this.truck && this.truck.state !== 'leaving' && this.truck.hasCargo()) this.truck.delivery.state = 'enroute';
      this.customers = [];
      this.employees = [];
      this.registers = [];
      this.truck = null;
      this.active = false;
    }

    /** Grows the store one size; walls move out, existing shelves stay put. */
    expand() {
      this.level = Math.min(MS.MAX_STORE_LEVEL, this.level + 1);
      this.layout = new MS.Layout(this.level);
      this.rebuildObstacles();
      const old = this.registers;
      this.registers = this.layout.registers.map((def) => {
        const r = old[def.index];
        if (r) { r.def = def; return r; }
        return new Register(this, def);
      });
    }

    rebuildObstacles() {
      this.layout.rebuildObstacles(this.slots.filter((s) => s.built).map((s) => s.index));
      // Litter under a new shelf would be unreachable.
      this.dirt = this.dirt.filter((d) => this.layout.walkableCustomer(d.x, d.y));
    }

    // ---- Queries ---------------------------------------------------------------
    registerCount() { return MS.STORE_LEVELS[this.level].registers; }
    availableSlots() { return this.slots.filter((s) => s.index < MS.Layout.slotCountAt(this.level)); }
    builtSlots() { return this.slots.filter((s) => s.built); }
    slotFor(pid) { return this.slots.find((s) => s.built && s.productId === pid) || null; }
    assortment() { return this.slots.filter((s) => s.built && s.productId).map((s) => MS.product(s.productId)); }
    capacity() { return this.upgrades.value('capacity') + (this.level - 1) * 3; }
    /** Customers that still count toward capacity (people walking out after paying do not). */
    shoppers() {
      let n = 0;
      for (const c of this.customers) if (c.state !== 'leave' && c.state !== 'exit' && c.state !== 'gone') n++;
      return n;
    }
    staffCount(type) { return this.staff.filter((e) => e.type === type).length; }
    salaryPerMinute() {
      const mult = Math.sqrt(this.def.costMult);
      return this.staff.reduce((sum, e) => sum + Math.round(MS.STAFF_TYPES[e.type].salary * mult * 100), 0);
    }
    shelfCost() {
      const built = this.builtSlots().length;
      return Math.round((80 * Math.pow(Math.max(1, built - 3), 1.45) * this.def.costMult) / 10) * 10 * 100;
    }
    hireCost(type) {
      const n = this.staffCount(type);
      return Math.round(MS.STAFF_TYPES[type].hire * Math.pow(1.6, n) * Math.sqrt(this.def.costMult) / 10) * 10 * 100;
    }
    expansionCost() {
      const next = MS.STORE_LEVELS[this.level + 1];
      return next ? Math.round(next.cost * this.def.costMult) * 100 : 0;
    }
    isFullyAutomated() {
      return ['cashier', 'stocker', 'warehouse', 'manager'].every((t) => this.staffCount(t) > 0);
    }

    /** Seconds between new customers. */
    spawnInterval() {
      const ads = this.upgrades.value('ads');
      const ratingF = 0.55 + 0.6 * this.rating;
      const levelF = 1 + 0.2 * (this.level - 1);
      const assortF = 0.7 + 0.05 * Math.min(24, this.assortment().length);
      return 3.6 / (ads * ratingF * levelF * assortF);
    }

    /** Products a customer may ask for: mostly what is on the shelves, sometimes what is not (yet). */
    makeWishList(type) {
      const stocked = this.assortment();
      const extra = this.game.unlockedProducts(this).filter((p) => !stocked.includes(p));
      const weight = (p) => {
        let w = p.pop;
        if (type.pricey) w *= Math.pow(p.sell / 2.5, type.pricey) * (1 + p.rarityInfo.order * 0.5);
        return w;
      };
      const pool = stocked.map((p) => ({ p, w: weight(p) })).concat(extra.map((p) => ({ p, w: weight(p) * 0.06 })));
      let n = U.randInt(type.items[0], type.items[1]);
      if (this.level >= 3 && U.chance(0.35)) n++;
      const wishes = [];
      for (let i = 0; i < n && pool.length; i++) {
        const choice = U.weightedPick(pool, (o) => o.w);
        pool.splice(pool.indexOf(choice), 1);
        wishes.push({ pid: choice.p.id, qty: U.randInt(type.qty[0], type.qty[1]), got: 0, state: 'todo' });
      }
      return wishes;
    }

    chooseRegister(customer) {
      const open = this.registers.filter((r) => r.open);
      if (!open.length) return null;
      let best = null;
      for (const r of open) {
        const d = Math.abs(r.def.queue[0].x - customer.tileX);
        const score = r.queue.length * 10 + d * 0.3;
        if (!best || score < best.score) best = { r, score };
      }
      if (best.r.queue.length >= customer.type.maxQueue) return null;
      return best.r;
    }

    assignRegister(cashier) {
      const r = this.registers.find((reg) => !reg.cashier);
      if (r) r.cashier = cashier;
      return r || null;
    }

    findRestockTask(stocker) {
      let best = null;
      const cap = this.inventory.shelfCapacity;
      for (const s of this.slots) {
        if (!s.built || !s.productId) continue;
        if (s.targetedBy && s.targetedBy !== stocker.id) continue;
        if (this.inventory.qty(s.productId) <= 0) continue;
        const fill = s.stock / cap;
        if (fill >= 0.6) continue;
        if (!best || fill < best.fill) best = { slot: s, fill };
      }
      return best;
    }

    findDirtTask(cleaner) {
      let best = null;
      for (const d of this.dirt) {
        if (d.targetedBy && d.targetedBy !== cleaner.id) continue;
        const dist = Math.abs(d.x - cleaner.tileX) + Math.abs(d.y - cleaner.tileY);
        if (!best || dist < best.dist) best = { d, dist };
      }
      return best ? best.d : null;
    }

    maybeLitter(customer, dt) {
      if (this.dirt.length >= MAX_DIRT || !U.chance(dt * 0.0045)) return;
      const x = customer.tileX, y = customer.tileY;
      if (this.layout.tileAt(x, y) !== MS.Layout.T.FLOOR || !this.layout.walkableCustomer(x, y)) return;
      if (this.dirt.some((d) => d.x === x && d.y === y)) return;
      this.dirt.push({ id: U.uid('dirt'), x, y, kind: U.pick(['spill', 'litter', 'crumbs']), targetedBy: null, age: 0 });
    }

    /** Puts a customer's picked products back (they left without paying). */
    returnItems(customer) {
      for (const w of customer.wishes) {
        if (w.got <= 0) continue;
        const slot = this.slotFor(w.pid);
        if (slot) slot.stock += w.got;
        else this.inventory.add(w.pid, w.got);
        w.got = 0;
      }
    }

    onPicked(customer, slot, n) {
      this.game.effects.productFly(this, slot, customer, MS.product(slot.productId), n);
      if (slot.stock <= this.inventory.lowShelfMark() && !slot.lowWarned) {
        slot.lowWarned = true;
        this.game.onShelfLow(this, slot);
      }
    }

    noteMissed(pid) { this.missed[pid] = (this.missed[pid] || 0) + 1; }

    spawnCustomer() {
      const level = this.game.level;
      const types = Object.values(MS.CUSTOMER_TYPES).filter((t) => t.unlock <= level);
      const weights = this.def.customerWeights || {};
      const type = U.weightedPick(types, (t) => t.weight * (weights[t.id] != null ? weights[t.id] : 1));
      const c = new MS.Customer(this, type);
      if (!c.wishes.length) return null;
      this.customers.push(c);
      return c;
    }

    // ---- Simulation ------------------------------------------------------------
    update(dt) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        if (this.shoppers() < this.capacity()) {
          this.spawnTimer = this.spawnInterval() * U.rand(0.7, 1.3);
          this.spawnCustomer();
        } else {
          this.spawnTimer = 0.5; // full: try again as soon as someone is done
        }
      }

      for (const c of this.customers) c.update(dt);
      if (this.customers.some((c) => c.state === 'gone')) this.customers = this.customers.filter((c) => c.state !== 'gone');

      for (const e of this.employees) e.update(dt);

      for (const r of this.registers) {
        // A checkout that lost its cashier sends its line to another checkout.
        if (!r.open && r.queue.length && !r.scanning) {
          const moved = r.queue.splice(0);
          for (const c of moved) { c.register = null; c.goToCheckout(); }
        }
        r.update(dt);
      }

      for (const d of this.deliveries) {
        if (d.state !== 'enroute') continue;
        d.eta = Math.max(0, d.eta - dt);
        if (d.eta <= 0 && !this.truck) {
          d.state = 'truck';
          this.truck = new MS.Truck(this, d);
        }
      }
      if (this.truck) {
        this.truck.update(dt);
        if (this.truck.state === 'gone') this.truck = null;
      }

      for (const d of this.dirt) d.age += dt;

      // Net profit per second, smoothed (used for passive income of other stores).
      this.netTimer += dt;
      if (this.netTimer >= 1) {
        const perSec = this.netAccum / this.netTimer;
        this.profitRate += (perSec - this.profitRate) * Math.min(1, this.netTimer * 0.02);
        this.netAccum = 0;
        this.netTimer = 0;
      }
    }

    toJSON() {
      // Products in the baskets of shoppers who have not paid yet are saved as shelf stock.
      const carried = {};
      for (const c of this.customers) {
        if (c.state === 'leave' || c.state === 'exit' || c.state === 'gone') continue;
        for (const w of c.wishes) if (w.got > 0) carried[w.pid] = (carried[w.pid] || 0) + w.got;
      }
      const warehouse = this.inventory.toJSON();
      for (const e of this.employees) {
        if (e.type === 'stocker' && e.carry) warehouse[e.carry.pid] = (warehouse[e.carry.pid] || 0) + e.carry.n;
      }
      const slots = this.slots.filter((s) => s.built).map((s) => {
        const extra = s.productId ? carried[s.productId] || 0 : 0;
        if (extra) delete carried[s.productId];
        return { index: s.index, built: true, productId: s.productId, stock: s.stock + extra };
      });
      for (const [pid, n] of Object.entries(carried)) warehouse[pid] = (warehouse[pid] || 0) + n;
      return {
        owned: this.owned,
        level: this.level,
        upgrades: this.upgrades.toJSON(),
        warehouse,
        slots,
        deliveries: this.deliveries.map((d) => ({ items: { ...d.items }, eta: d.state === 'enroute' ? d.eta : 0 })),
        staff: this.staff.map((e) => ({ id: e.id, type: e.type, name: e.name })),
        dirt: this.dirt.map((d) => ({ x: d.x, y: d.y, kind: d.kind })),
        missed: { ...this.missed },
        stats: { ...this.stats },
        rating: this.rating,
        profitRate: this.profitRate,
      };
    }
  }

  MS.Register = Register;
  MS.Store = Store;
})((window.MS = window.MS || {}));
