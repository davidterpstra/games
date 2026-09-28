/* UI: the DOM around the canvas — top bar, side panels, inspect card,
 * tooltip, goal tracker, toasts, modals and celebrations. All buttons use
 * `data-act` attributes and one delegated click handler. */
(function (MS) {
  'use strict';

  const U = MS.U;
  const $ = (id) => document.getElementById(id);

  class UI {
    constructor(game, renderer) {
      this.game = game;
      this.renderer = renderer;
      this.tab = 'stock';
      this.blockCache = new Map();
      this.panelBusy = false;
      this.inspectTarget = null;
      this.inspectHTML = '';
      this.tipHTML = '';
      this.goalHTML = '';
      this.refresh = 0;
      this.hud = {};
      this.modalOpen = false;
      this.celebrations = [];
      this.lastMoney = game.money;
      this.goalCollapsed = window.innerWidth < 600;

      this.el = {
        panel: $('panel'), tabs: $('tabs'), inspect: $('inspect'), tooltip: $('tooltip'), goal: $('goal'),
        toasts: $('toasts'), modalRoot: $('modal-root'), celebrate: $('celebrate'), paused: $('paused-overlay'),
        money: $('st-money'), moneyStat: document.querySelector('.stat-money'), customers: $('st-customers'),
        stock: $('st-stock'), stockWarn: $('st-stock-warn'), level: $('st-level'),
        xpFill: $('st-xp-fill'), xp: $('st-xp'), mood: $('st-mood'), moodIc: $('st-mood-ic'),
        storeIcon: $('store-icon'), storeName: $('store-name'), storeSize: $('store-size'), sound: $('btn-sound'),
      };
      this.el.goal.classList.toggle('collapsed', this.goalCollapsed);
      this.bind();
      this.listen();
      this.syncTopButtons();
    }

    // ---- Wiring -------------------------------------------------------------------------------
    bind() {
      const g = this.game;
      this.el.tabs.addEventListener('click', (e) => {
        const b = e.target.closest('[data-tab]');
        if (b) this.setTab(b.dataset.tab);
      });
      document.querySelectorAll('.speed [data-speed]').forEach((b) => b.addEventListener('click', () => this.setSpeed(+b.dataset.speed)));
      this.el.sound.addEventListener('click', () => {
        g.settings.sound = !g.settings.sound;
        g.audio.setEnabled(g.settings.sound);
        this.syncTopButtons();
      });
      $('btn-save').addEventListener('click', () => g.save(true));
      $('btn-reset').addEventListener('click', () => this.confirmReset());
      $('btn-help').addEventListener('click', () => this.openModal(MS.Panels.intro()));
      $('store-btn').addEventListener('click', () => this.setTab('stores', true));
      $('stat-stock').addEventListener('click', () => this.setTab('stock', true));
      this.el.paused.addEventListener('click', () => this.setSpeed(g.settings.speed || 1));
      this.el.goal.addEventListener('click', () => {
        this.goalCollapsed = !this.goalCollapsed;
        this.el.goal.classList.toggle('collapsed', this.goalCollapsed);
      });
      document.querySelectorAll('.zoom-ctl [data-zoom]').forEach((b) => b.addEventListener('click', () => {
        const r = this.renderer;
        if (b.dataset.zoom === 'in') r.setZoom(r.zoom * 1.35);
        else if (b.dataset.zoom === 'out') r.setZoom(r.zoom / 1.35);
        else r.resetView();
      }));

      const onAct = (e) => {
        const b = e.target.closest('[data-act]');
        if (!b || b.disabled) return;
        this.game.audio.unlock();
        this.handleAction(b.dataset.act, b.dataset, b);
      };
      for (const root of [this.el.panel, this.el.inspect, this.el.modalRoot]) root.addEventListener('click', onAct);

      // Don't swap panel HTML while a button is being pressed.
      const busyOn = () => { this.panelBusy = true; };
      const busyOff = () => { setTimeout(() => { this.panelBusy = false; }, 60); };
      for (const root of [this.el.panel, this.el.inspect]) {
        root.addEventListener('pointerdown', busyOn);
        root.addEventListener('pointerup', busyOff);
        root.addEventListener('pointercancel', busyOff);
        root.addEventListener('pointerleave', busyOff);
      }
      this.el.modalRoot.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal-back') && !e.target.dataset.locked) this.closeModal();
      });
    }

    listen() {
      const bus = MS.bus;
      bus.on('toast', ({ html, kind, ms }) => this.toast(html, kind, ms));
      bus.on('levelup', (d) => this.celebrateLevel(d));
      bus.on('expand', ({ level }) => this.celebrateExpansion(level));
      bus.on('challenge:done', (c) => this.toast(`🏆 Uitdaging gehaald: ${U.escape(c.text)} — claim je beloning in 🏆 Uitdagingen!`, 'reward', 4500));
      bus.on('goal:done', () => { this.el.goal.classList.remove('done'); void this.el.goal.offsetWidth; this.el.goal.classList.add('done'); });
      bus.on('store:changed', () => { this.closeInspect(); this.blockCache.clear(); this.el.panel.innerHTML = ''; this.el.panel.scrollTop = 0; });
      bus.on('game:reset', () => { this.closeInspect(); this.blockCache.clear(); this.el.panel.innerHTML = ''; this.syncTopButtons(); });
      bus.on('shelf:built', (slot) => { this.select({ type: 'shelf', ref: slot }); this.openProductPicker(slot.index); });
    }

    // ---- Actions from buttons ----------------------------------------------------------------------------
    handleAction(act, d, btn) {
      const g = this.game;
      switch (act) {
        case 'order': g.actionOrder(d.pid, +d.packs); break;
        case 'restock': g.actionRestock(+d.slot); break;
        case 'unload': g.actionUnload(); break;
        case 'checkout': g.actionCheckout(+d.reg); break;
        case 'build': g.actionBuildSlot(+d.slot); break;
        case 'assign-open': this.openProductPicker(+d.slot); break;
        case 'assign':
          if (g.actionAssign(+d.slot, d.pid || null)) this.closeModal();
          break;
        case 'place': this.placeProduct(d.pid); break;
        case 'upgrade':
          if (g.actionUpgrade(d.id)) {
            this.floatLabel(btn, '✨ Upgrade!');
            const card = btn.closest('[data-k]');
            if (card) { card.classList.remove('pop'); void card.offsetWidth; card.classList.add('pop'); }
            const T = MS.Layout.TILE;
            const L = g.store.layout;
            g.effects.sparkle(((L.floorX0 + L.right) / 2) * T, (L.top + 4) * T, 18);
          }
          break;
        case 'expand':
          if (g.actionExpand()) this.closeModal();
          break;
        case 'hire':
          if (g.actionHire(d.type)) this.floatLabel(btn, '🎉 Aangenomen!');
          break;
        case 'fire': this.confirmFire(d.id); break;
        case 'claim':
          if (g.actionClaimChallenge(d.id)) this.floatLabel(btn, '🎁 Geclaimd!');
          break;
        case 'buy-store': this.confirmBuyStore(d.id); break;
        case 'switch-store': g.actionSwitchStore(d.id); break;
        case 'close-inspect': this.closeInspect(); break;
        case 'modal-close': this.closeModal(); break;
        case 'modal-ok': {
          const resolve = this.modalResolve;
          this.modalResolve = null;
          this.closeModal();
          if (resolve) resolve(true);
          break;
        }
      }
      this.refreshNow();
    }

    placeProduct(pid) {
      const g = this.game;
      const store = g.store;
      const empty = store.slots.find((s) => s.built && !s.productId);
      if (empty) { g.actionAssign(empty.index, pid); this.select({ type: 'shelf', ref: empty }); return; }
      const avail = MS.Layout.slotCountAt(store.level);
      const buildable = store.slots.find((s) => !s.built && s.index < avail);
      if (buildable) {
        this.select({ type: 'slot', ref: buildable });
        this.toast(`Alle schappen zijn bezet. Bouw een nieuw schap (${U.money(store.shelfCost())}) of vervang een product.`, 'info');
        return;
      }
      this.toast('Alle schapplekken zijn bezet. Breid je winkel uit of tik op een schap en kies 🔁 Ander product.', 'info', 4500);
    }

    setTab(tab, reveal) {
      this.tab = tab;
      this.el.tabs.querySelectorAll('[data-tab]').forEach((b) => b.classList.toggle('on', b.dataset.tab === tab));
      this.blockCache.clear();
      this.el.panel.innerHTML = '';
      this.el.panel.scrollTop = 0;
      this.renderPanel();
      if (reveal && window.innerWidth <= 900) document.getElementById('side').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    setSpeed(s) {
      const g = this.game;
      if (s === 0) g.paused = true;
      else { g.paused = false; g.speed = s; g.settings.speed = s; }
      this.syncTopButtons();
    }

    syncTopButtons() {
      const g = this.game;
      document.querySelectorAll('.speed [data-speed]').forEach((b) => {
        const s = +b.dataset.speed;
        b.classList.toggle('on', g.paused ? s === 0 : s === g.speed);
      });
      this.el.paused.hidden = !g.paused || this.modalOpen;
      this.el.sound.textContent = g.settings.sound ? '🔊' : '🔇';
    }

    // ---- World selection ---------------------------------------------------------------------------------------
    select(target) {
      this.renderer.selected = target;
      this.inspectTarget = target;
      this.inspectHTML = '';
      this.renderInspect();
    }

    closeInspect() {
      this.inspectTarget = null;
      this.renderer.selected = null;
      this.el.inspect.hidden = true;
      this.inspectHTML = '';
    }

    renderInspect() {
      const t = this.inspectTarget;
      if (!t) return;
      const store = this.game.store;
      const alive =
        (t.type === 'customer' && store.customers.includes(t.ref) && t.ref.isInside) ||
        (t.type === 'employee' && store.employees.includes(t.ref)) ||
        (t.type === 'truck' && store.truck === t.ref) ||
        (t.type === 'shelf' && t.ref.built) ||
        (t.type === 'slot' && !t.ref.built) ||
        t.type === 'register';
      if (!alive) {
        if (t.type === 'slot' && t.ref.built) { this.select({ type: 'shelf', ref: t.ref }); return; }
        this.closeInspect();
        return;
      }
      const html = MS.Panels.inspect(this.game, t);
      if (!html) { this.closeInspect(); return; }
      if (html !== this.inspectHTML && !this.panelBusy) {
        this.inspectHTML = html;
        this.el.inspect.innerHTML = html;
      }
      this.el.inspect.hidden = false;
    }

    showTooltip(h, sx, sy) {
      const tip = this.el.tooltip;
      if (!h || this.modalOpen) { tip.hidden = true; this.tipTarget = null; return; }
      this.tipTarget = h;
      this.tipPos = { x: sx, y: sy };
      this.updateTooltip();
    }

    updateTooltip() {
      const tip = this.el.tooltip;
      const h = this.tipTarget;
      if (!h) return;
      const html = MS.Panels.tooltip(this.game, h);
      if (!html) { tip.hidden = true; return; }
      if (html !== this.tipHTML) { this.tipHTML = html; tip.innerHTML = html; }
      tip.hidden = false;
      const stage = tip.parentElement.getBoundingClientRect();
      const w = tip.offsetWidth, hgt = tip.offsetHeight;
      let x = this.tipPos.x + 16, y = this.tipPos.y + 16;
      if (x + w > stage.width - 8) x = this.tipPos.x - w - 12;
      if (y + hgt > stage.height - 8) y = this.tipPos.y - hgt - 12;
      tip.style.left = Math.max(6, x) + 'px';
      tip.style.top = Math.max(6, y) + 'px';
    }

    // ---- Panels -------------------------------------------------------------------------------------------------
    renderPanel() {
      if (this.panelBusy) return;
      const fn = MS.Panels[this.tab];
      if (!fn) return;
      const blocks = fn(this.game);
      const root = this.el.panel;
      const keys = blocks.map((b) => b.k);
      const current = Array.from(root.children);
      const sameShape = current.length === blocks.length && current.every((el, i) => el.dataset.k === keys[i]);
      if (!sameShape) {
        const frag = document.createDocumentFragment();
        for (const b of blocks) frag.appendChild(this.makeBlock(b));
        root.replaceChildren(frag);
        return;
      }
      blocks.forEach((b, i) => {
        if (this.blockCache.get(b.k) === b.html) return;
        const el = this.makeBlock(b);
        root.replaceChild(el, current[i]);
      });
    }

    makeBlock(b) {
      const tpl = document.createElement('template');
      tpl.innerHTML = b.html.trim();
      let el = tpl.content.firstElementChild;
      if (!el || tpl.content.children.length !== 1) {
        el = document.createElement('div');
        el.innerHTML = b.html;
      }
      el.dataset.k = b.k;
      this.blockCache.set(b.k, b.html);
      return el;
    }

    updateBadges() {
      const g = this.game;
      const store = g.store;
      const inv = store.inventory;
      const warnings = store.assortment().filter((p) => inv.status(p.id) !== 'ok').length;
      const affordableUpgrades = MS.upgradeDefs.filter((u) => !store.upgrades.isCapped(u.id) && g.money >= store.upgrades.nextCost(u.id)).length
        + (MS.STORE_LEVELS[store.level + 1] && g.level >= MS.STORE_LEVELS[store.level + 1].playerLevel && g.money >= store.expansionCost() ? 1 : 0);
      const hireable = Object.values(MS.STAFF_TYPES).filter((r) => g.level >= r.unlock && store.staffCount(r.id) < r.max(store) && g.money >= store.hireCost(r.id)).length;
      const claim = g.challenges.claimableCount();
      const buyable = MS.STORES.filter((s) => !g.stores[s.id].owned && g.level >= s.unlockLevel && g.money >= s.price * 100).length;
      const set = (tab, n, cls) => {
        const b = this.el.tabs.querySelector(`[data-tab="${tab}"] .badge`);
        if (!b) return;
        b.hidden = !n;
        b.textContent = n > 9 ? '9+' : String(n);
        b.className = 'badge ' + (cls || '');
      };
      set('stock', warnings, '');
      set('upgrades', affordableUpgrades, 'good');
      set('staff', hireable, 'good');
      set('challenges', claim, 'gold');
      set('stores', buyable, 'good');
      set('customers', 0);
      this.el.stockWarn.hidden = !warnings;
      this.el.stockWarn.textContent = warnings > 9 ? '9+' : String(warnings);
    }

    renderGoal() {
      const g = this.game;
      const goal = g.goals.current();
      let html = '';
      if (goal) {
        const p = g.goals.progress();
        html = `<div class="g-head">🎯 ${U.escape(goal.text)}<span class="g-cnt">${Math.floor(p.cur)}/${p.target}</span></div>
          <div class="bar purple"><i style="width:${Math.round((p.cur / p.target) * 100)}%"></i></div>
          <div class="g-hint">${U.escape(goal.hint)}</div>`;
      }
      if (html !== this.goalHTML) {
        this.goalHTML = html;
        this.el.goal.innerHTML = html;
      }
    }

    // ---- HUD ------------------------------------------------------------------------------------------------------
    setText(key, el, text) {
      if (this.hud[key] === text) return;
      this.hud[key] = text;
      el.textContent = text;
    }

    updateHUD() {
      const g = this.game;
      const store = g.store;
      this.setText('money', this.el.money, U.money(g.money));
      if (g.money > this.lastMoney + 1) {
        const m = this.el.moneyStat;
        m.classList.remove('flash');
        void m.offsetWidth;
        m.classList.add('flash');
      }
      this.lastMoney = g.money;
      this.setText('cust', this.el.customers, `${store.shoppers()} / ${store.capacity()}`);
      const inv = store.inventory;
      let onShelves = 0;
      for (const s of store.slots) if (s.built) onShelves += s.stock;
      this.setText('stock', this.el.stock, `${U.num(onShelves + inv.units())}`);
      this.setText('lvl', this.el.level, `Level ${g.level}`);
      const need = MS.xpForLevel(g.level);
      this.setText('xp', this.el.xp, `${U.num(g.xp)} / ${U.num(need)} XP`);
      const pct = Math.round((g.xp / need) * 100) + '%';
      if (this.hud.xpw !== pct) { this.hud.xpw = pct; this.el.xpFill.style.width = pct; }
      const mood = Math.round(store.rating * 100);
      this.setText('mood', this.el.mood, `${mood}%`);
      this.setText('moodIc', this.el.moodIc, mood >= 75 ? '😊' : mood >= 50 ? '🙂' : mood >= 30 ? '😐' : '😠');
      this.setText('storeIcon', this.el.storeIcon, store.def.icon);
      this.setText('storeName', this.el.storeName, store.def.name);
      this.setText('storeSize', this.el.storeSize, `Grootte ${store.level} · ${MS.STORE_LEVELS[store.level].name}`);
    }

    update(dt) {
      this.updateHUD();
      this.refresh -= dt;
      if (this.refresh <= 0) this.refreshNow();
    }

    refreshNow() {
      this.refresh = 0.25;
      this.renderPanel();
      this.renderInspect();
      this.renderGoal();
      this.updateBadges();
      if (this.tipTarget) this.updateTooltip();
    }

    // ---- Toasts, labels, celebrations ------------------------------------------------------------------------------
    toast(html, kind = 'info', ms = 3000) {
      const box = this.el.toasts;
      while (box.children.length >= 3) box.firstElementChild.remove();
      const t = document.createElement('div');
      t.className = 'toast ' + kind;
      t.innerHTML = html;
      box.appendChild(t);
      setTimeout(() => {
        t.classList.add('out');
        setTimeout(() => t.remove(), 320);
      }, ms || 3000);
    }

    floatLabel(anchor, text) {
      if (!anchor || !anchor.getBoundingClientRect) return;
      const r = anchor.getBoundingClientRect();
      const el = document.createElement('div');
      el.className = 'float-label';
      el.textContent = text;
      el.style.left = r.left + r.width / 2 + 'px';
      el.style.top = r.top - 6 + 'px';
      document.body.appendChild(el);
      setTimeout(() => el.remove(), 1200);
    }

    showCelebration(html, ms) {
      const root = this.el.celebrate;
      root.innerHTML = '';
      const card = document.createElement('div');
      card.className = 'cele';
      card.innerHTML = html + '<div class="hint">tik om verder te gaan</div>';
      root.appendChild(card);
      const close = () => {
        if (!card.isConnected) return;
        card.classList.add('out');
        setTimeout(() => card.remove(), 360);
      };
      card.addEventListener('click', close);
      setTimeout(close, ms);
    }

    celebrateLevel({ level, unlocks }) {
      const T = MS.Layout.TILE;
      const L = this.game.store.layout;
      this.game.effects.confetti(((L.floorX0 + L.right) / 2) * T, (L.top + 2) * T, 70, L.right * T * 0.45);
      const list = unlocks.length
        ? `<ul>${unlocks.slice(0, 6).map((u) => `<li><span class="e">${u.icon}</span><span><b>${U.escape(u.text)}</b><small>${U.escape(u.sub)}</small></span></li>`).join('')}</ul>`
        : '<p>Je supermarkt groeit! Blijf klanten helpen voor nieuwe beloningen.</p>';
      this.showCelebration(`<h2><span>🎉</span><span class="grad">LEVEL UP!</span></h2><div class="lvl-num">${level}</div><p>Je bent nu level ${level}${unlocks.length ? ' — nieuw vrijgespeeld:' : ''}</p>${list}`, 5200);
    }

    celebrateExpansion(level) {
      const L = MS.STORE_LEVELS[level];
      this.showCelebration(`<h2><span>🏪</span><span class="grad">Uitgebreid!</span></h2><p style="font-size:16px;color:#2b2233">Winkelgrootte ${level}: <b>${L.name}</b></p>
        <ul><li><span class="e">🧺</span><span><b>${MS.Layout.slotCountAt(level)} schapplekken</b><small>Tik op ➕ in de winkel om schappen te bouwen</small></span></li>
        <li><span class="e">🧾</span><span><b>${L.registers} kassa's</b><small>Neem kassamedewerkers aan om ze te openen</small></span></li>
        ${L.note ? `<li><span class="e">✨</span><span><b>${U.escape(L.note)}</b></span></li>` : ''}</ul>`, 4500);
    }

    // ---- Modals -------------------------------------------------------------------------------------------------------
    openModal(html, opts = {}) {
      this.closeModal();
      const back = document.createElement('div');
      back.className = 'modal-back';
      if (opts.locked) back.dataset.locked = '1';
      back.innerHTML = `<div class="modal ${opts.wide ? 'wide' : ''}" role="dialog" aria-modal="true">${html}</div>`;
      this.el.modalRoot.appendChild(back);
      this.modalOpen = true;
      this.wasPaused = this.game.paused;
      this.game.paused = true;
      this.syncTopButtons();
      const first = back.querySelector('button:not(:disabled)');
      if (first) first.focus({ preventScroll: true });
    }

    closeModal() {
      if (!this.modalOpen) return;
      this.el.modalRoot.innerHTML = '';
      this.modalOpen = false;
      this.game.paused = !!this.wasPaused;
      if (this.modalResolve) { const r = this.modalResolve; this.modalResolve = null; r(false); }
      this.syncTopButtons();
    }

    confirm(title, text, okLabel, danger) {
      return new Promise((resolve) => {
        this.openModal(`<h2>${title}</h2><p class="lead">${text}</p>
          <div class="modal-actions"><button class="btn" data-act="modal-close">Annuleren</button>
          <button class="btn ${danger ? 'pink' : 'primary'}" data-act="modal-ok">${okLabel}</button></div>`);
        this.modalResolve = resolve;
      });
    }

    openProductPicker(slotIndex) {
      this.openModal(MS.Panels.productPicker(this.game, slotIndex), { wide: true });
    }

    async confirmReset() {
      const ok = await this.confirm('🔄 Reset Game', 'Weet je zeker dat je helemaal opnieuw wilt beginnen? <b>Je opgeslagen spel wordt verwijderd</b> — geld, levels, upgrades, winkels en personeel. Dit kun je niet ongedaan maken.', '🗑️ Ja, verwijder mijn save', true);
      if (!ok) return;
      this.game.newGame();
      this.toast('🔄 Nieuw spel gestart. Veel succes met je winkel!', 'success');
      this.openModal(MS.Panels.intro());
    }

    async confirmFire(id) {
      const e = this.game.store.staff.find((x) => x.id === id);
      if (!e) return;
      const role = MS.STAFF_TYPES[e.type];
      const ok = await this.confirm('Ontslaan?', `Wil je ${U.escape(e.name)} (${role.name.toLowerCase()}) ontslaan? Je krijgt het aannamegeld niet terug.`, 'Ontslaan', true);
      if (ok) {
        if (this.inspectTarget && this.inspectTarget.type === 'employee' && this.inspectTarget.ref.id === id) this.closeInspect();
        this.game.actionFire(id);
      }
    }

    async confirmBuyStore(id) {
      const def = MS.storeDef(id);
      const ok = await this.confirm(`${def.icon} ${U.escape(def.name)} kopen?`, `${U.escape(def.desc)}<br><br>Prijs: <b>${U.money(def.price * 100)}</b>. Je start daar met een kleine winkel, vier gevulde schappen en eigen specialiteiten. Je huidige winkel blijft van jou.`, '🔑 Kopen', false);
      if (ok) this.game.actionBuyStore(id);
    }
  }

  MS.UI = UI;
})((window.MS = window.MS || {}));
