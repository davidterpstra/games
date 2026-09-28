/* Upgrade + UpgradeSystem: the per-store upgrade levels. */
(function (MS) {
  'use strict';

  class Upgrade {
    constructor(def) {
      Object.assign(this, def);
    }

    /** Highest level allowed at a given store size. */
    capAt(storeLevel) {
      return Math.min(this.max, MS.UPGRADE_CAP_BY_STORE_LEVEL[storeLevel] || this.max);
    }

    /** Cost in cents to go from `level` to `level + 1`. */
    costAt(level, costMult) {
      return Math.round(this.cost * Math.pow(this.growth, level - 1) * costMult) * 100;
    }
  }

  MS.upgradeDefs = MS.UPGRADES.map((d) => new Upgrade(d));
  MS.upgradeDef = (id) => MS.upgradeDefs.find((u) => u.id === id);

  class UpgradeSystem {
    constructor(store, saved) {
      this.store = store;
      this.levels = {};
      for (const u of MS.upgradeDefs) {
        const lv = saved && MS.U.isNum(saved[u.id]) ? Math.floor(saved[u.id]) : 1;
        this.levels[u.id] = MS.U.clamp(lv, 1, u.max);
      }
    }

    level(id) { return this.levels[id] || 1; }
    value(id) { return MS.upgradeDef(id).value(this.level(id)); }
    cap(id) { return MS.upgradeDef(id).capAt(this.store.level); }
    isMaxed(id) { return this.level(id) >= MS.upgradeDef(id).max; }
    isCapped(id) { return this.level(id) >= this.cap(id); }
    nextCost(id) { return MS.upgradeDef(id).costAt(this.level(id), this.store.def.costMult); }

    /** Raises an upgrade by one level; the caller has already paid. */
    raise(id) {
      if (this.isCapped(id)) return false;
      this.levels[id]++;
      return true;
    }

    toJSON() { return { ...this.levels }; }
  }

  MS.Upgrade = Upgrade;
  MS.UpgradeSystem = UpgradeSystem;
})((window.MS = window.MS || {}));
