/* Employee: staff members walk through the store and do the jobs the player
 * would otherwise do by tapping. Each role is a small state machine. */
(function (MS) {
  'use strict';

  const U = MS.U;

  class Employee extends MS.Walker {
    constructor(store, data) {
      super(store, { speed: 2.4, jitter: 3, staff: true });
      this.kind = 'employee';
      this.id = data.id;
      this.role = MS.STAFF_TYPES[data.type];
      this.type = data.type;
      this.name = data.name;
      this.state = 'idle';
      this.timer = U.rand(0.1, 0.6);
      this.carry = null; // { pid, n } or { icon }
      this.task = null;
      this.emote = null;
      this.look = {
        skin: U.pick(MS.SKIN_TONES),
        hair: U.pick(MS.HAIR_COLORS),
        shirt: this.role.color,
        hairStyle: U.randInt(0, 3),
        hat: false,
        glasses: U.chance(0.2),
      };
      const spawn = store.layout.randomWarehouseTile();
      this.placeAtTile(spawn.x, spawn.y);
      this.register = null;
      this.atPost = false;
      this.workFlash = 0;
    }

    get game() { return this.store.game; }
    get inventory() { return this.store.inventory; }

    say(icon, dur = 1.6) { this.emote = { icon, t: 0, dur }; }

    update(dt) {
      if (this.emote) {
        this.emote.t += dt;
        if (this.emote.t > this.emote.dur) this.emote = null;
      }
      this.workFlash = Math.max(0, this.workFlash - dt);
      const arrived = this.step(dt);
      if (this.store.game.salaryUnpaid) {
        // Nobody works for free: staff wait until wages are paid again.
        if (this.state !== 'strike') { this.say('💸', 3); this.state = 'strike'; }
        this.timer = 1;
        return;
      }
      if (this.state === 'strike') this.state = 'idle';
      switch (this.type) {
        case 'cashier': return this.updateCashier(dt, arrived);
        case 'stocker': return this.updateStocker(dt, arrived);
        case 'warehouse': return this.updateWarehouse(dt, arrived);
        case 'cleaner': return this.updateCleaner(dt, arrived);
        case 'manager': return this.updateManager(dt, arrived);
      }
    }

    // ---- Cashier -------------------------------------------------------
    updateCashier(dt, arrived) {
      if (!this.register) {
        this.register = this.store.assignRegister(this);
        this.atPost = false;
        if (this.register) {
          const s = this.register.def.cashierSpot;
          this.goTo(s.x, s.y);
          this.state = 'toPost';
        }
        return;
      }
      if (this.state === 'toPost' && (arrived || this.arrived)) {
        this.state = 'atPost';
        this.atPost = true;
        this.facing = 1;
      }
    }

    // ---- Stocker (vakvuller) --------------------------------------------
    updateStocker(dt, arrived) {
      const inv = this.inventory;
      switch (this.state) {
        case 'idle':
        case 'wander':
          this.timer -= dt;
          if (this.timer > 0) return;
          this.timer = 0.6;
          this.task = this.store.findRestockTask(this);
          if (this.task) {
            this.task.slot.targetedBy = this.id;
            const t = this.store.layout.randomWarehouseTile();
            this.goTo(t.x, t.y);
            this.state = 'toWarehouse';
          } else if (this.state === 'idle' && U.chance(0.25)) {
            const t = this.store.layout.randomWarehouseTile();
            this.goTo(t.x, t.y);
            this.state = 'wander';
          }
          return;
        case 'toWarehouse':
          if (arrived || this.arrived) { this.state = 'grab'; this.timer = 0.7; }
          return;
        case 'grab': {
          this.timer -= dt;
          if (this.timer > 0) return;
          const slot = this.task.slot;
          const need = inv.shelfNeed(slot);
          const n = slot.productId ? inv.take(slot.productId, Math.min(need, this.carryCapacity())) : 0;
          if (n <= 0) return this.dropTask();
          this.carry = { pid: slot.productId, n };
          const spot = U.pick(this.store.layout.accessTiles(slot.index));
          this.goTo(spot.x, spot.y);
          this.state = 'toShelf';
          return;
        }
        case 'toShelf':
          if (arrived || this.arrived) { this.state = 'fill'; this.timer = 0.8; this.workFlash = 0.8; }
          return;
        case 'fill': {
          this.timer -= dt;
          if (this.timer > 0) return;
          const slot = this.task.slot;
          if (slot.productId === this.carry.pid && slot.built) {
            const put = Math.min(this.carry.n, inv.shelfNeed(slot));
            slot.stock += put;
            if (this.carry.n - put > 0) inv.add(this.carry.pid, this.carry.n - put);
            if (put > 0) this.store.game.onRestocked(this.store, slot, put, false);
          } else {
            inv.add(this.carry.pid, this.carry.n);
          }
          this.carry = null;
          this.dropTask();
          return;
        }
      }
    }

    carryCapacity() { return 10 + 2 * (this.store.upgrades.level('stock') - 1); }

    dropTask() {
      if (this.task && this.task.slot && this.task.slot.targetedBy === this.id) this.task.slot.targetedBy = null;
      if (this.carry) { this.inventory.add(this.carry.pid, this.carry.n); this.carry = null; }
      this.task = null;
      this.state = 'idle';
      this.timer = 0.3;
    }

    // ---- Warehouse worker (magazijnmedewerker) ------------------------------
    updateWarehouse(dt, arrived) {
      const truck = this.store.truck;
      switch (this.state) {
        case 'idle':
        case 'wander':
          this.timer -= dt;
          if (this.timer > 0) return;
          this.timer = 0.5;
          if (truck && truck.state === 'docked' && truck.hasCargo()) {
            const d = this.store.layout.dockInside;
            this.goTo(d.x + U.randInt(0, 2), d.y);
            this.state = 'toDock';
          } else if (this.state === 'idle' && U.chance(0.2)) {
            const t = this.store.layout.randomWarehouseTile();
            this.goTo(t.x, t.y);
            this.state = 'wander';
          }
          return;
        case 'toDock':
          if (arrived || this.arrived) { this.state = 'unload'; this.timer = 0.9; this.workFlash = 0.9; }
          return;
        case 'unload': {
          this.timer -= dt;
          if (this.timer > 0) return;
          const t = this.store.truck;
          const line = t && t.state === 'docked' ? t.takeLine() : null;
          if (!line) { this.state = 'idle'; return; }
          this.inventory.add(line.pid, line.n);
          this.carry = { pid: line.pid, n: line.n };
          if (!t.hasCargo()) this.store.game.onUnloaded(this.store, t, false);
          const spot = this.store.layout.randomWarehouseTile();
          this.goTo(spot.x, spot.y);
          this.state = 'store';
          return;
        }
        case 'store':
          if (arrived || this.arrived) { this.carry = null; this.state = 'idle'; this.timer = 0.2; }
          return;
      }
    }

    // ---- Cleaner (schoonmaker) ------------------------------------------
    updateCleaner(dt, arrived) {
      switch (this.state) {
        case 'idle':
        case 'wander':
          this.timer -= dt;
          if (this.timer > 0 && !(this.state === 'wander' && this.arrived && this.timer < 1)) return;
          this.timer = 0.6;
          this.task = this.store.findDirtTask(this);
          if (this.task) {
            this.task.targetedBy = this.id;
            this.goTo(this.task.x, this.task.y);
            this.state = 'toDirt';
          } else if (this.arrived && U.chance(0.35)) {
            const t = this.store.layout.randomFloorTile();
            this.goTo(t.x, t.y);
            this.state = 'wander';
            this.timer = 3;
          }
          return;
        case 'toDirt':
          if (!this.store.dirt.includes(this.task)) { this.task = null; this.state = 'idle'; return; }
          if (arrived || this.arrived) { this.state = 'clean'; this.timer = 1.1; this.workFlash = 1.1; }
          return;
        case 'clean':
          this.timer -= dt;
          if (this.timer > 0) return;
          if (this.store.dirt.includes(this.task)) this.store.game.cleanDirt(this.store, this.task, false);
          this.task = null;
          this.state = 'idle';
          this.timer = 0.2;
          return;
      }
    }

    // ---- Manager (filiaalmanager) -------------------------------------------
    updateManager(dt, arrived) {
      this.timer -= dt;
      if (this.state === 'idle' && this.arrived && U.chance(dt * 0.15)) {
        const t = U.chance(0.5) ? this.store.layout.randomWarehouseTile() : this.store.layout.randomFloorTile();
        this.goTo(t.x, t.y);
      }
      if (this.timer > 0) return;
      this.timer = 4;
      const ordered = this.store.game.autoOrder(this.store);
      if (ordered > 0) this.say('📋', 2);
    }

    /** Called when the employee is fired or the store closes. */
    dispose() {
      if (this.task && this.task.slot && this.task.slot.targetedBy === this.id) this.task.slot.targetedBy = null;
      if (this.task && this.task.targetedBy === this.id) this.task.targetedBy = null;
      if (this.carry && this.type === 'stocker') this.inventory.add(this.carry.pid, this.carry.n);
      this.carry = null;
      if (this.register && this.register.cashier === this) this.register.cashier = null;
      this.register = null;
    }
  }

  MS.Employee = Employee;
})((window.MS = window.MS || {}));
