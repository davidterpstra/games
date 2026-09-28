/* Game: owns the global state (money, XP, stores, challenges) and every
 * player action. The UI and the input code only call `game.action*`
 * methods; each one checks requirements and costs before changing anything,
 * so buttons can never create money out of nothing. */
(function (MS) {
  'use strict';

  const U = MS.U;
  const START_MONEY = 100000; // €1.000,00 in cents

  const STAT_KEYS = [
    'served', 'happy', 'lost', 'revenue', 'profit', 'sold', 'restocks', 'orders', 'unloads', 'shelvesBuilt',
    'upgrades', 'expansions', 'cleaned', 'challenges', 'rareSold', 'legendarySold',
    'hired_cashier', 'hired_stocker', 'hired_warehouse', 'hired_cleaner', 'hired_manager',
  ];

  class Game {
    constructor() {
      this.bus = MS.bus;
      this.audio = new MS.Sound();
      this.music = new MS.Music();
      this.effects = new MS.Effects(this);
      this.saveSystem = new MS.SaveSystem(this);
      this.challenges = new MS.ChallengeSystem(this);
      this.goals = new MS.GoalSystem(this);
      this.speed = 1;
      this.paused = false;
      this.time = 0;
      this.autosaveTimer = 0;
      this.dayCheckTimer = 0;
      this.warnTimes = {};
      this.resetState();
    }

    resetState() {
      this.money = START_MONEY;
      this.xp = 0;
      this.level = 1;
      this.stats = {};
      for (const k of STAT_KEYS) this.stats[k] = 0;
      this.soldByProduct = {};
      this.salaryAccum = 0;
      this.salaryUnpaid = false;
      this.passiveAccum = 0;
      this.stores = {};
      for (const def of MS.STORES) this.stores[def.id] = new MS.Store(this, def, null);
      this.activeStoreId = MS.STORES[0].id;
      this.challenges.reset();
      this.goals.reset();
      this.settings = { sound: true, music: true, speed: 1 };
    }

    get store() { return this.stores[this.activeStoreId]; }

    // ---- Start / save / load ----------------------------------------------------------
    start() {
      const saved = this.saveSystem.load();
      if (saved) this.deserialize(saved);
      else this.resetState();
      this.store.activate();
      this.challenges.ensureToday();
      this.audio.enabled = this.settings.sound;
      this.music.enabled = this.settings.music;
      this.speed = this.settings.speed || 1;
      return !!saved;
    }

    newGame() {
      if (this.store) this.store.deactivate();
      this.saveSystem.clear();
      this.resetState();
      this.store.activate();
      this.challenges.ensureToday();
      this.speed = 1;
      this.paused = false;
      this.bus.emit('store:changed', this.store);
      this.bus.emit('game:reset');
    }

    serialize() {
      const stores = {};
      for (const [id, s] of Object.entries(this.stores)) if (s.owned) stores[id] = s.toJSON();
      return {
        money: this.money,
        xp: this.xp,
        level: this.level,
        stats: { ...this.stats },
        soldByProduct: { ...this.soldByProduct },
        activeStore: this.activeStoreId,
        stores,
        challenges: this.challenges.toJSON(),
        goals: this.goals.toJSON(),
        settings: { ...this.settings },
      };
    }

    deserialize(d) {
      this.resetState();
      if (U.isNum(d.money)) this.money = Math.max(0, Math.floor(d.money));
      if (U.isNum(d.level)) this.level = U.clamp(Math.floor(d.level), 1, 99);
      if (U.isNum(d.xp)) this.xp = U.clamp(Math.floor(d.xp), 0, MS.xpForLevel(this.level) - 1);
      if (d.stats && typeof d.stats === 'object') for (const k of STAT_KEYS) if (U.isNum(d.stats[k])) this.stats[k] = Math.max(0, d.stats[k]);
      if (d.soldByProduct && typeof d.soldByProduct === 'object') {
        for (const [k, v] of Object.entries(d.soldByProduct)) if (MS.product(k) && U.isNum(v)) this.soldByProduct[k] = v;
      }
      if (d.stores && typeof d.stores === 'object') {
        for (const def of MS.STORES) {
          const s = d.stores[def.id];
          if (s && (s.owned || def.price === 0)) this.stores[def.id] = new MS.Store(this, def, s);
        }
      }
      const active = this.stores[d.activeStore];
      this.activeStoreId = active && active.owned ? d.activeStore : MS.STORES[0].id;
      this.challenges.load(d.challenges);
      this.goals.load(d.goals);
      if (d.settings && typeof d.settings === 'object') {
        this.settings.sound = d.settings.sound !== false;
        this.settings.music = d.settings.music !== false;
        this.settings.speed = [1, 2, 3].includes(d.settings.speed) ? d.settings.speed : 1;
      }
    }

    save(manual) {
      const ok = this.saveSystem.save();
      if (manual) {
        if (ok) this.toast('💾 Spel opgeslagen', 'success');
        else this.toast('Opslaan lukt niet in deze browser (localStorage is geblokkeerd).', 'error');
      }
      return ok;
    }

    // ---- Main loop ---------------------------------------------------------------------
    update(dt) {
      if (this.paused) return;
      this.time += dt;
      this.store.update(dt);
      this.paySalaries(dt);
      this.passiveIncome(dt);
      this.effects.update(dt);
      this.goals.update();
      this.dayCheckTimer -= dt;
      if (this.dayCheckTimer <= 0) {
        this.dayCheckTimer = 5;
        this.challenges.ensureToday();
      }
    }

    /** Autosave uses real time, so it also works at 3× speed. */
    tickRealtime(dtReal) {
      this.autosaveTimer += dtReal;
      if (this.autosaveTimer >= 20) {
        this.autosaveTimer = 0;
        this.save(false);
      }
    }

    paySalaries(dt) {
      const perMin = this.store.salaryPerMinute();
      if (perMin <= 0) { this.salaryUnpaid = false; this.salaryAccum = 0; return; }
      this.salaryAccum = Math.min(this.salaryAccum + (perMin / 60) * dt, perMin);
      if (this.salaryAccum < 100) return; // pay per whole euro
      const due = Math.floor(this.salaryAccum / 100) * 100;
      if (this.money >= due) {
        this.money -= due;
        this.salaryAccum -= due;
        this.store.netAccum -= due;
        if (this.salaryUnpaid) {
          this.salaryUnpaid = false;
          this.toast('✅ Salarissen betaald — het personeel werkt weer.', 'success');
        }
      } else if (!this.salaryUnpaid) {
        this.salaryUnpaid = true;
        this.toast('💸 Niet genoeg geld voor de salarissen! Het personeel staakt tot je weer geld hebt.', 'error', 5000);
        this.audio.play('error');
      }
    }

    /** Fully staffed stores that are not on screen keep earning half their average profit. */
    passiveIncome(dt) {
      let rate = 0;
      for (const s of Object.values(this.stores)) {
        if (!s.owned || s === this.store || !s.isFullyAutomated()) continue;
        rate += Math.max(0, s.profitRate) * 0.5;
      }
      if (rate <= 0) return;
      this.passiveAccum += rate * dt;
      if (this.passiveAccum >= 100) {
        const whole = Math.floor(this.passiveAccum);
        this.money += whole;
        this.passiveAccum -= whole;
      }
    }

    passiveRate() {
      let rate = 0;
      for (const s of Object.values(this.stores)) {
        if (s.owned && s !== this.store && s.isFullyAutomated()) rate += Math.max(0, s.profitRate) * 0.5;
      }
      return rate;
    }

    // ---- Money, XP, rewards ----------------------------------------------------------------
    /** Call from click/tap handlers: browsers only allow sound after a user gesture. */
    unlockAudio() {
      this.audio.unlock();
      this.music.start();
    }

    canAfford(cents) { return this.money >= cents; }

    spend(cents) {
      if (!(cents >= 0) || this.money < cents) {
        this.toast(`Niet genoeg geld — je hebt nog ${U.money(cents - this.money)} nodig.`, 'error');
        this.audio.play('error');
        return false;
      }
      this.money -= cents;
      this.bus.emit('money:spent', cents);
      return true;
    }

    addXP(n, pos) {
      if (!(n > 0)) return;
      this.xp += Math.round(n);
      if (pos) this.effects.floatText(pos.x, pos.y - 18, `+${Math.round(n)} XP`, { color: '#9b51e0', size: 12, dur: 1.2 });
      let need = MS.xpForLevel(this.level);
      while (this.xp >= need) {
        this.xp -= need;
        this.level++;
        this.onLevelUp();
        need = MS.xpForLevel(this.level);
      }
    }

    giveReward(reward, title) {
      if (!reward) return;
      const parts = [];
      if (reward.money > 0) { this.money += reward.money; parts.push('+' + U.money(reward.money)); }
      if (reward.xp > 0) { this.addXP(reward.xp); parts.push(`+${reward.xp} XP`); }
      this.toast(`${title} ${parts.length ? '<b>' + parts.join(' · ') + '</b>' : ''}`, 'reward', 4200);
      this.audio.play('upgrade');
    }

    /** Everything new at the level that was just reached (read from the data files). */
    unlocksAt(level) {
      const list = [];
      for (const p of MS.allProducts()) {
        if (p.unlock === level && !p.stores) list.push({ icon: p.emoji, text: `${p.name}`, sub: `${p.rarityInfo.icon} ${p.rarityInfo.name} product` });
      }
      for (const t of Object.values(MS.CUSTOMER_TYPES)) if (t.unlock === level && level > 1) list.push({ icon: t.icon, text: t.name, sub: 'Nieuw type klant' });
      for (const s of Object.values(MS.STAFF_TYPES)) if (s.unlock === level && level > 1) list.push({ icon: s.icon, text: s.name, sub: 'Personeel om aan te nemen' });
      for (const s of MS.STORES) if (s.unlockLevel === level && level > 1) list.push({ icon: s.icon, text: s.name, sub: 'Nieuwe winkel te koop' });
      for (const l of MS.STORE_LEVELS) if (l && l.playerLevel === level && l.level > 1) list.push({ icon: '🏗️', text: `Winkelgrootte ${l.level}: ${l.name}`, sub: 'Uitbreiding beschikbaar' });
      return list;
    }

    onLevelUp() {
      this.audio.play('levelup');
      this.bus.emit('levelup', { level: this.level, unlocks: this.unlocksAt(this.level) });
    }

    // ---- Product availability -------------------------------------------------------------
    unlockedProducts(store) {
      return MS.allProducts().filter((p) => this.productLock(store, p) === null);
    }

    /** null when the product can be sold in this store, otherwise the reason. */
    productLock(store, p) {
      if (!p.availableIn(store.id)) return 'store';
      if (p.unlock > this.level) return 'level';
      if (store.level < p.department.storeLevel) return 'dept';
      return null;
    }

    ownedStoreCount() { return Object.values(this.stores).filter((s) => s.owned).length; }
    maxStoreLevel() { return Math.max(...Object.values(this.stores).filter((s) => s.owned).map((s) => s.level)); }

    track(event, key, amount = 1) {
      this.challenges.onEvent(event, key, amount);
    }

    toast(html, kind = 'info', ms) { this.bus.emit('toast', { html, kind, ms }); }

    /** Toast at most once per `sec` for the same key (avoids spam). */
    warnOnce(key, sec, html, kind = 'warn') {
      const now = this.time;
      if (this.warnTimes[key] != null && now - this.warnTimes[key] < sec) return;
      this.warnTimes[key] = now;
      this.toast(html, kind);
    }

    // ---- Events reported by the simulation ---------------------------------------------------
    completeSale(customer, { total, cost, tip, units, lines, happy }) {
      const store = customer.store;
      const earned = total + tip;
      this.money += earned;
      const profit = total - cost + tip;
      this.stats.served++;
      this.stats.revenue += earned;
      this.stats.profit += profit;
      this.stats.sold += units;
      store.stats.served++;
      store.stats.revenue += earned;
      store.stats.profit += profit;
      store.netAccum += profit;
      store.rating = store.rating * 0.93 + (customer.mood / 100) * 0.07;

      let xp = MS.XP.perCustomer + (happy ? MS.XP.happyBonus : 0);
      let rare = 0, legendary = 0;
      for (const { product, qty } of lines) {
        xp += product.rarityInfo.xp * qty;
        this.soldByProduct[product.id] = (this.soldByProduct[product.id] || 0) + qty;
        if (product.isRare) rare += qty;
        if (product.rarity === 'legendary') legendary += qty;
        this.track('sold', product.id, qty);
      }
      this.stats.rareSold += rare;
      this.stats.legendarySold += legendary;
      if (rare) this.track('rareSold', null, rare);
      if (happy) { this.stats.happy++; store.stats.happy++; this.track('happy'); }
      this.track('served', customer.type.id);
      this.track('revenue', null, earned);

      const reg = customer.register || store.registers.find((r) => r.def.queue[0].x === customer.tileX) || store.registers[0];
      const pos = this.registerPos(store, reg);
      this.effects.floatText(pos.x, pos.y - 30, '+' + U.money(earned), { color: '#1f9d55', size: 17, dur: 1.6, bold: true });
      if (tip) this.effects.floatText(pos.x + 26, pos.y - 8, `fooi ${U.money(tip)}`, { color: '#e5a100', size: 11, dur: 1.5 });
      this.effects.coins(pos.x, pos.y - 16, Math.min(8, 2 + Math.floor(earned / 500)));
      this.audio.play('coin', 0.08);
      this.addXP(xp);
      this.bus.emit('sale', { customer, earned, profit });
    }

    onCustomerLost(customer, reason) {
      const store = customer.store;
      this.stats.lost++;
      store.stats.lost++;
      store.rating = store.rating * 0.93;
      this.audio.play('angry', 0.4);
      const why = { wait: 'wachtte te lang', missing: 'product was op', queue: 'de rij was te lang' }[reason] || 'was ontevreden';
      const tip = reason === 'missing' ? ' Vul je schappen op tijd bij!'
        : !store.registers[0].staffed ? ' Tik op de kassa om klanten af te rekenen!' : ' Meer kassa\'s of kassasnelheid helpen.';
      this.warnOnce('lost-' + reason, 25, `😡 ${U.escape(customer.name)} vertrok boos: ${why}.${tip}`, 'warn');
      this.bus.emit('customer:lost', { customer, reason });
    }

    onScan(register) {
      this.audio.play('scan', 0.06);
      const pos = this.registerPos(register.store, register);
      this.effects.scanBlip(pos.x, pos.y);
    }

    onShelfLow(store, slot) {
      const p = MS.product(slot.productId);
      if (!p) return;
      const back = store.inventory.qty(p.id) + store.inventory.incoming(p.id);
      if (back <= 0) this.warnOnce('out-' + p.id, 30, `⚠️ ${p.emoji} ${p.name} is bijna op! Bestel nieuwe voorraad in 📦 Voorraad.`, 'warn');
    }

    onRestocked(store, slot, n, manual) {
      if (slot.stock > store.inventory.lowShelfMark()) slot.lowWarned = false;
      this.stats.restocks++;
      this.track('restock');
      const pos = this.slotPos(store, slot);
      this.effects.floatText(pos.x, pos.y - 26, `+${n} ${MS.product(slot.productId).emoji}`, { color: '#2f80ed', size: 14, dur: 1.2 });
      this.effects.sparkle(pos.x, pos.y - 10, manual ? 10 : 5);
      this.audio.play('pop', 0.08);
      if (manual) this.addXP(1);
    }

    onTruckDocked(store, truck) {
      this.audio.play('truck', 1);
      if (store.staffCount('warehouse') === 0) this.warnOnce('truck', 12, '🚚 De bezorgwagen staat klaar. Tik erop om hem uit te laden!', 'info');
      this.bus.emit('truck:docked');
    }

    onUnloaded(store, truck, manual) {
      const i = store.deliveries.indexOf(truck.delivery);
      if (i >= 0) store.deliveries.splice(i, 1);
      this.stats.unloads++;
      this.track('unload');
      this.addXP(3);
      this.bus.emit('unloaded');
    }

    cleanDirt(store, dirt, manual) {
      const i = store.dirt.indexOf(dirt);
      if (i < 0) return false;
      store.dirt.splice(i, 1);
      this.stats.cleaned++;
      this.track('clean');
      const T = MS.Layout.TILE;
      this.effects.sparkle((dirt.x + 0.5) * T, (dirt.y + 0.5) * T, manual ? 12 : 6, ['#9be7ff', '#ffffff', '#7fd3e0']);
      this.audio.play('clean', 0.1);
      if (manual) this.addXP(MS.XP.clean, { x: (dirt.x + 0.5) * T, y: (dirt.y + 0.5) * T });
      return true;
    }

    /** Manager logic: re-order products that are running low. Returns boxes ordered. */
    autoOrder(store) {
      const inv = store.inventory;
      const reserve = 10000 * store.def.costMult;
      let boxes = 0;
      const lines = store.assortment()
        .map((p) => ({ p, have: inv.qty(p.id) + inv.incoming(p.id) }))
        .sort((a, b) => a.have - b.have);
      for (const { p, have } of lines) {
        if (have >= inv.shelfCapacity) continue;
        const target = inv.shelfCapacity * 2;
        let packs = Math.ceil((target - have) / p.pack);
        packs = Math.min(packs, Math.floor(inv.freeSpace() / p.pack));
        const unit = p.packCost(store);
        packs = Math.min(packs, Math.floor((this.money - reserve) / unit));
        if (packs <= 0) continue;
        this.money -= packs * unit;
        this.queueDelivery(store, p.id, packs * p.pack);
        this.stats.orders++;
        boxes += packs;
      }
      if (boxes) this.warnOnce('mgr', 120, `👔 Je filiaalmanager bestelt nu zelf voorraad (${boxes} doos${boxes > 1 ? 'en' : ''}).`, 'info');
      return boxes;
    }

    queueDelivery(store, pid, units) {
      let d = store.deliveries.find((x) => x.state === 'enroute');
      if (!d) {
        d = { id: U.uid('d'), items: {}, eta: store.upgrades.value('delivery'), state: 'enroute' };
        store.deliveries.push(d);
      }
      d.items[pid] = (d.items[pid] || 0) + units;
      return d;
    }

    // ---- World positions (for effects) --------------------------------------------------------
    registerPos(store, reg) {
      const T = MS.Layout.TILE;
      const c = reg ? reg.def.counter : { x: 8, y0: 13 };
      return { x: (c.x + 0.5) * T, y: c.y0 * T };
    }

    slotPos(store, slot) {
      const s = MS.Layout.SLOT_SPOTS[slot.index];
      const T = MS.Layout.TILE;
      return { x: (s.x + 1) * T, y: s.y * T };
    }

    // ---- Player actions ---------------------------------------------------------------------------
    actionCheckout(index) {
      const reg = this.store.registers[index];
      if (!reg) return false;
      const res = reg.tap();
      if (res === 'empty') { this.toast('Er staat nog niemand bij deze kassa.', 'info'); return false; }
      if (res === 'queued') this.toast('De klant loopt naar de kassa…', 'info');
      if (res === 'start') this.audio.play('click');
      return true;
    }

    actionRestock(slotIndex) {
      const store = this.store;
      const slot = store.slots[slotIndex];
      if (!slot || !slot.built || !slot.productId) return false;
      const p = MS.product(slot.productId);
      if (store.inventory.shelfNeed(slot) <= 0) { this.toast(`${p.emoji} ${p.name}: het schap is al vol.`, 'info'); return false; }
      if (store.inventory.qty(p.id) <= 0) {
        this.toast(`Geen ${p.emoji} ${p.name} meer in het magazijn. Bestel eerst nieuwe voorraad!`, 'warn');
        this.audio.play('error');
        return false;
      }
      const moved = store.inventory.restock(slot);
      this.onRestocked(store, slot, moved, true);
      return true;
    }

    actionBuildSlot(slotIndex) {
      const store = this.store;
      const slot = store.slots[slotIndex];
      if (!slot || slot.built || slot.index >= MS.Layout.slotCountAt(store.level)) return false;
      const cost = store.shelfCost();
      if (!this.spend(cost)) return false;
      slot.built = true;
      slot.productId = null;
      slot.stock = 0;
      store.rebuildObstacles();
      this.stats.shelvesBuilt++;
      const pos = this.slotPos(store, slot);
      this.effects.dust(pos.x, pos.y + 10, 16);
      this.effects.sparkle(pos.x, pos.y, 14);
      this.effects.floatText(pos.x, pos.y - 30, '🔨 Nieuw schap!', { color: '#e5a100', size: 14, dur: 1.5, bold: true });
      this.audio.play('build');
      this.addXP(MS.XP.shelf, pos);
      this.bus.emit('shelf:built', slot);
      return true;
    }

    actionAssign(slotIndex, pid) {
      const store = this.store;
      const slot = store.slots[slotIndex];
      if (!slot || !slot.built) return false;
      if (pid) {
        const p = MS.product(pid);
        if (!p || this.productLock(store, p)) return false;
        const other = store.slotFor(pid);
        if (other && other !== slot) { this.toast(`${p.emoji} ${p.name} ligt al in een ander schap.`, 'info'); return false; }
      }
      if (slot.productId && slot.stock > 0) store.inventory.add(slot.productId, slot.stock);
      slot.productId = pid || null;
      slot.stock = 0;
      slot.lowWarned = false;
      slot.targetedBy = null;
      if (pid) {
        const p = MS.product(pid);
        const moved = store.inventory.restock(slot);
        const pos = this.slotPos(store, slot);
        this.effects.sparkle(pos.x, pos.y, 12);
        this.effects.floatText(pos.x, pos.y - 28, `${p.emoji} ${p.name}`, { color: '#333', size: 13, dur: 1.4, bold: true });
        this.audio.play('pop');
        if (!moved && !store.inventory.incoming(pid)) {
          // Nothing in the back yet: order a first box right away when possible.
          const cost = p.packCost(store);
          if (this.money >= cost && store.inventory.freeSpace() >= p.pack) {
            this.money -= cost;
            const d = this.queueDelivery(store, pid, p.pack);
            this.stats.orders++;
            this.toast(`📦 Eerste doos ${p.emoji} ${p.name} besteld (${U.money(cost)}) · levering over ${Math.ceil(d.eta)}s`, 'success');
          } else {
            this.toast(`${p.emoji} ${p.name} staat in het schap. Bestel voorraad om het te vullen!`, 'info');
          }
        }
      }
      this.bus.emit('shelf:assigned', slot);
      return true;
    }

    actionOrder(pid, packs) {
      const store = this.store;
      const p = MS.product(pid);
      packs = Math.floor(packs);
      if (!p || this.productLock(store, p) || !(packs >= 1) || packs > 99) return false;
      const fit = Math.floor(store.inventory.freeSpace() / p.pack);
      if (fit <= 0) {
        this.toast('📦 Het magazijn zit vol. Upgrade de voorraadcapaciteit of wacht tot er ruimte is.', 'warn');
        this.audio.play('error');
        return false;
      }
      const n = Math.min(packs, fit);
      const cost = n * p.packCost(store);
      if (!this.spend(cost)) return false;
      const d = this.queueDelivery(store, pid, n * p.pack);
      this.stats.orders++;
      this.audio.play('box');
      const trimmed = n < packs ? ' (meer past niet in het magazijn)' : '';
      this.toast(`📦 ${n}× doos ${p.emoji} ${p.name} besteld (+${n * p.pack}) · ${U.money(cost)} · levering over ${Math.ceil(d.eta)}s${trimmed}`, 'success');
      this.bus.emit('order', { pid, packs: n });
      return true;
    }

    actionUnload() {
      const store = this.store;
      const truck = store.truck;
      if (!truck || truck.state !== 'docked' || !truck.hasCargo()) return false;
      const lines = truck.takeAll();
      let units = 0;
      for (const l of lines) { store.inventory.add(l.pid, l.n); units += l.n; }
      const T = MS.Layout.TILE;
      const x = truck.x + 1.2 * T, y = truck.y - 1.4 * T;
      this.effects.boxes(x, y, (store.layout.dock.x0 + 1.5) * T, store.layout.bottom * T, Math.min(8, lines.length + 2));
      this.effects.floatText(x, y - 10, `+${units} 📦`, { color: '#f28c38', size: 16, dur: 1.5, bold: true });
      this.audio.play('box');
      this.onUnloaded(store, truck, true);
      return true;
    }

    actionClean(dirtId) {
      const d = this.store.dirt.find((x) => x.id === dirtId);
      return d ? this.cleanDirt(this.store, d, true) : false;
    }

    actionUpgrade(id) {
      const store = this.store;
      const def = MS.upgradeDef(id);
      if (!def) return false;
      if (store.upgrades.isMaxed(id)) { this.toast(`${def.icon} ${def.name} is al op het maximum.`, 'info'); return false; }
      if (store.upgrades.isCapped(id)) { this.toast(`Breid je winkel uit om ${def.name} verder te upgraden.`, 'info'); return false; }
      const cost = store.upgrades.nextCost(id);
      if (!this.spend(cost)) return false;
      store.upgrades.raise(id);
      this.stats.upgrades++;
      this.track('upgrade');
      this.audio.play('upgrade');
      this.addXP(MS.XP.upgrade);
      this.bus.emit('upgrade', { id, level: store.upgrades.level(id) });
      return true;
    }

    actionExpand() {
      const store = this.store;
      const next = MS.STORE_LEVELS[store.level + 1];
      if (!next) return false;
      if (this.level < next.playerLevel) { this.toast(`Je hebt level ${next.playerLevel} nodig voor deze uitbreiding.`, 'info'); return false; }
      if (!this.spend(store.expansionCost())) return false;
      store.expand();
      this.stats.expansions++;
      this.audio.play('build');
      this.addXP(MS.XP.expansion);
      this.bus.emit('expand', { store, level: store.level });
      return true;
    }

    actionHire(type) {
      const store = this.store;
      const role = MS.STAFF_TYPES[type];
      if (!role) return false;
      if (this.level < role.unlock) { this.toast(`${role.name} komt vrij op level ${role.unlock}.`, 'info'); return false; }
      if (store.staffCount(type) >= role.max(store)) { this.toast(`Je hebt al het maximum aantal ${role.name.toLowerCase()}s voor deze winkelgrootte.`, 'info'); return false; }
      if (!this.spend(store.hireCost(type))) return false;
      const used = new Set(store.staff.map((e) => e.name));
      const name = U.pick(MS.STAFF_NAMES.filter((n) => !used.has(n))) || U.pick(MS.STAFF_NAMES);
      const data = { id: U.uid('e'), type, name };
      store.staff.push(data);
      if (store.active) store.employees.push(new MS.Employee(store, data));
      this.stats['hired_' + type] = (this.stats['hired_' + type] || 0) + 1;
      this.addXP(MS.XP.hire);
      this.audio.play('upgrade');
      this.toast(`${role.icon} ${U.escape(name)} is aangenomen als ${role.name.toLowerCase()}!`, 'success');
      this.bus.emit('staff:changed');
      return true;
    }

    actionFire(id) {
      const store = this.store;
      const i = store.staff.findIndex((e) => e.id === id);
      if (i < 0) return false;
      const data = store.staff[i];
      store.staff.splice(i, 1);
      const e = store.employees.find((x) => x.id === id);
      if (e) {
        e.dispose();
        store.employees.splice(store.employees.indexOf(e), 1);
      }
      this.toast(`${U.escape(data.name)} is ontslagen.`, 'info');
      this.bus.emit('staff:changed');
      return true;
    }

    actionBuyStore(id) {
      const s = this.stores[id];
      if (!s || s.owned) return false;
      if (this.level < s.def.unlockLevel) { this.toast(`${s.def.name} komt vrij op level ${s.def.unlockLevel}.`, 'info'); return false; }
      if (!this.spend(s.def.price * 100)) return false;
      s.owned = true;
      s.setupStarter();
      this.addXP(MS.XP.newStore);
      this.toast(`${s.def.icon} Je bent nu eigenaar van <b>${s.def.name}</b>!`, 'reward', 4000);
      this.audio.play('levelup');
      this.actionSwitchStore(id);
      return true;
    }

    actionSwitchStore(id) {
      const s = this.stores[id];
      if (!s || !s.owned || s === this.store) return false;
      this.store.deactivate();
      this.activeStoreId = id;
      this.salaryAccum = 0;
      s.activate();
      this.effects.clear();
      this.bus.emit('store:changed', s);
      this.save(false);
      return true;
    }

    actionClaimChallenge(id) { return this.challenges.claim(id); }
  }

  MS.Game = Game;
})((window.MS = window.MS || {}));
