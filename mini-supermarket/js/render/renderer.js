/* Renderer: draws the active store on a <canvas> in a cosy 3/4 top-down
 * view, handles the camera (auto-fit, zoom, pan) and answers "what is under
 * this point?" for clicks and hovering. */
(function (MS) {
  'use strict';

  const U = MS.U;
  const S = MS.Sprites;

  class Renderer {
    constructor(game, canvas) {
      this.game = game;
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.dpr = 1;
      this.vw = 1;
      this.vh = 1;
      this.cam = { x: 600, y: 500, scale: 1 };
      this.fit = { x: 600, y: 500, scale: 1 };
      this.zoom = 1;
      this.pan = { x: 0, y: 0 };
      this.hover = null;
      this.selected = null;
      this.t = 0;
      this.decorKey = '';
      this.decor = [];
      this.traffic = [];
      this.trafficTimer = 3;
      this.construction = null;
      this.reduced = U.prefersReducedMotion();
      if (window.matchMedia) {
        const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
        if (mq.addEventListener) mq.addEventListener('change', () => { this.reduced = mq.matches; });
      }

      const ro = window.ResizeObserver ? new ResizeObserver(() => this.resize()) : null;
      if (ro) ro.observe(canvas.parentElement);
      window.addEventListener('resize', () => this.resize());
      this.resize();
      this.snapCamera();

      MS.bus.on('expand', ({ level }) => this.startConstruction(level));
      MS.bus.on('store:changed', () => { this.zoom = 1; this.pan = { x: 0, y: 0 }; this.selected = null; this.traffic = []; this.resize(); this.snapCamera(); });
      MS.bus.on('game:reset', () => { this.zoom = 1; this.pan = { x: 0, y: 0 }; this.selected = null; this.resize(); this.snapCamera(); });
    }

    get store() { return this.game.store; }
    get T() { return MS.Layout.TILE; }

    // ---- Camera ------------------------------------------------------------------------------
    resize() {
      const r = this.canvas.parentElement.getBoundingClientRect();
      this.dpr = Math.min(2, window.devicePixelRatio || 1);
      this.vw = Math.max(1, r.width);
      this.vh = Math.max(1, r.height);
      this.canvas.width = Math.round(this.vw * this.dpr);
      this.canvas.height = Math.round(this.vh * this.dpr);
      this.canvas.style.width = this.vw + 'px';
      this.canvas.style.height = this.vh + 'px';
      this.computeFit();
    }

    computeFit() {
      const b = this.store.layout.viewBounds(true);
      // On narrow screens fit the shop itself; the building lot is one swipe away.
      const f = this.vw < 700 ? this.store.layout.viewBounds(false) : b;
      const pad = 10;
      const scale = Math.min((this.vw - pad * 2) / (f.x1 - f.x0), (this.vh - pad * 2) / (f.y1 - f.y0));
      this.fit = { x: (f.x0 + f.x1) / 2, y: (f.y0 + f.y1) / 2, scale: Math.max(0.1, scale) };
      this.bounds = b;
    }

    /** Bubbles grow when zoomed out so they stay readable on small screens. */
    uiScale() { return Math.max(1, 0.85 / this.cam.scale); }

    target() {
      const scale = this.fit.scale * this.zoom;
      const b = this.bounds;
      const halfW = this.vw / 2 / scale, halfH = this.vh / 2 / scale;
      const clampAxis = (c, lo, hi, half) => (hi - lo <= half * 2 ? (lo + hi) / 2 : U.clamp(c, lo + half, hi - half));
      const x = clampAxis(this.fit.x + this.pan.x, b.x0, b.x1, halfW);
      const y = clampAxis(this.fit.y + this.pan.y, b.y0, b.y1, halfH);
      return { x, y, scale };
    }

    snapCamera() { Object.assign(this.cam, this.target()); }

    setZoom(z, sx, sy) {
      const before = sx != null ? this.screenToWorld(sx, sy) : null;
      this.zoom = U.clamp(z, 1, 3.5);
      if (before) {
        // keep the point under the cursor in place
        const tgt = this.target();
        const wx = (sx - this.vw / 2) / tgt.scale + tgt.x;
        const wy = (sy - this.vh / 2) / tgt.scale + tgt.y;
        this.pan.x += before.x - wx;
        this.pan.y += before.y - wy;
      }
      if (this.zoom === 1) this.pan = { x: 0, y: 0 };
      this.clampPan();
    }

    panBy(dxScreen, dyScreen) {
      const s = this.cam.scale;
      this.pan.x -= dxScreen / s;
      this.pan.y -= dyScreen / s;
      this.clampPan();
      this.snapCamera();
    }

    clampPan() {
      const t = this.target();
      this.pan.x = t.x - this.fit.x;
      this.pan.y = t.y - this.fit.y;
    }

    resetView() { this.zoom = 1; this.pan = { x: 0, y: 0 }; }

    screenToWorld(sx, sy) {
      return { x: (sx - this.vw / 2) / this.cam.scale + this.cam.x, y: (sy - this.vh / 2) / this.cam.scale + this.cam.y };
    }

    worldToScreen(wx, wy) {
      return { x: (wx - this.cam.x) * this.cam.scale + this.vw / 2, y: (wy - this.cam.y) * this.cam.scale + this.vh / 2 };
    }

    startConstruction(level) {
      this.computeFit();
      this.construction = { t: 0, dur: 2.4, level };
      this.decorKey = '';
      const L = this.store.layout;
      const T = this.T;
      const prev = MS.STORE_LEVELS[level - 1];
      // Dust and sparkles over the freshly built area.
      for (let i = 0; i < 8; i++) {
        const x = U.rand((prev.right) * T, (L.right + 0.5) * T);
        const y = U.rand((L.top + 1) * T, L.bottom * T);
        this.game.effects.dust(x, y, 6);
      }
      for (let i = 0; i < 5; i++) {
        const x = U.rand(L.floorX0 * T, L.right * T);
        const y = U.rand((L.top + 1) * T, (prev.top + 1) * T);
        this.game.effects.dust(x, y, 5);
      }
      this.game.effects.confetti(((L.floorX0 + L.right) / 2) * T, (L.top + 3) * T, 60, L.right * T * 0.4);
    }

    // ---- Frame ---------------------------------------------------------------------------------
    update(dt) {
      this.t += dt;
      const tgt = this.target();
      const k = this.reduced ? 1 : 1 - Math.pow(0.001, dt);
      this.cam.x = U.lerp(this.cam.x, tgt.x, k);
      this.cam.y = U.lerp(this.cam.y, tgt.y, k);
      this.cam.scale = U.lerp(this.cam.scale, tgt.scale, k);
      if (this.construction) {
        this.construction.t += dt;
        if (this.construction.t > this.construction.dur) this.construction = null;
      }
      this.updateTraffic(dt);
    }

    updateTraffic(dt) {
      if (this.game.paused) return;
      const T = this.T;
      this.trafficTimer -= dt;
      if (this.trafficTimer <= 0) {
        this.trafficTimer = U.rand(5, 12);
        this.traffic.push({ x: (MS.Layout.W + 3) * T, y: 19.9 * T, v: U.rand(90, 150), color: U.pick(['#e5484d', '#4f8cff', '#ffcf33', '#39b37a', '#f5f5f5', '#8b6cf0']) });
      }
      for (const c of this.traffic) c.x -= c.v * dt;
      this.traffic = this.traffic.filter((c) => c.x > -6 * T);
    }

    draw() {
      const ctx = this.ctx;
      const store = this.store;
      const theme = store.def.theme;
      const T = this.T;
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      ctx.fillStyle = theme.ground;
      ctx.fillRect(0, 0, this.vw, this.vh);

      const s = this.cam.scale;
      ctx.setTransform(this.dpr * s, 0, 0, this.dpr * s, this.dpr * (this.vw / 2 - this.cam.x * s), this.dpr * (this.vh / 2 - this.cam.y * s));

      if (this.decorKey !== store.id + ':' + store.level) this.buildDecor();

      this.drawGround(ctx, store, theme);
      this.drawStreet(ctx, store, theme);
      this.drawLot(ctx, store);
      this.drawFloor(ctx, store, theme);
      this.drawWarehouse(ctx, store, theme);
      this.drawBackWall(ctx, store, theme);
      this.drawSideWalls(ctx, store, theme);
      this.drawFloorItems(ctx, store, theme);

      // Everything with height is drawn back-to-front.
      const items = [];
      for (const slot of store.slots) {
        if (!slot.built) continue;
        const sp = MS.Layout.SLOT_SPOTS[slot.index];
        items.push({ y: (sp.y + 1) * T - 1, draw: () => this.drawShelfSlot(ctx, store, slot, theme) });
      }
      for (const r of store.registers) items.push({ y: (r.def.counter.y1 + 1) * T - 6, draw: () => S.register(ctx, r, T, theme, this.t, r.current ? this.cartIcons(r.current) : []) });
      for (const d of store.layout.decor) items.push({ y: (d.y + 1) * T - 2, draw: () => this.drawDecorItem(ctx, d, theme) });
      for (const d of this.decor) items.push({ y: d.y, draw: () => this.drawDecorItem(ctx, d, theme) });
      for (const c of store.customers) items.push({ y: c.y, draw: () => this.drawCustomer(ctx, c) });
      for (const e of store.employees) items.push({ y: e.y, draw: () => this.drawEmployee(ctx, e, theme) });
      if (store.truck) items.push({ y: store.truck.y, draw: () => S.truck(ctx, store.truck, T, theme, store.def.icon) });
      for (const car of this.traffic) items.push({ y: car.y, draw: () => this.drawCar(ctx, car, theme) });
      items.push({ y: store.layout.bottom * T + 30, draw: () => this.drawFacade(ctx, store, theme) });
      items.sort((a, b) => a.y - b.y);
      for (const it of items) it.draw();

      if (this.construction) this.drawConstruction(ctx, store);
      this.drawOverlays(ctx, store);
      this.game.effects.draw(ctx, S);
      this.drawHighlight(ctx, this.hover, false);
      this.drawHighlight(ctx, this.selected, true);
    }

    cartIcons(c) {
      const out = [];
      for (const w of c.wishes) if (w.got > 0) out.push(MS.product(w.pid).emoji);
      return out;
    }

    // ---- Static-ish layers ---------------------------------------------------------------------
    buildDecor() {
      const store = this.store;
      const L = store.layout;
      const theme = store.def.theme;
      const T = this.T;
      this.decorKey = store.id + ':' + store.level;
      const list = [];
      const rng = U.seededRng(U.hashString(store.id + 'decor'));
      const kinds = {
        grass: ['tree', 'tree', 'bush', 'flowers', 'tree'],
        plaza: ['planter', 'bench', 'lamp', 'planter'],
        sand: ['palm', 'palm', 'umbrella', 'shell'],
        snow: ['pine', 'pine', 'snowman', 'rock', 'pine'],
        night: ['lamp', 'planterNeon', 'bench', 'lamp'],
      }[theme.outside] || ['tree'];
      const lot = L.lot;
      const inLot = (x, y) => lot && x >= lot.x0 && x <= lot.x1 + 1 && y >= lot.y0 - 1 && y <= lot.y1;
      for (let y = 0; y < L.bottom; y++) {
        for (let x = 0; x < L.w; x++) {
          const t = L.tileAt(x, y);
          if (t !== MS.Layout.T.GRASS) continue;
          if (inLot(x, y)) continue;
          // keep a gap around the building
          if (x <= L.right + 1 && y >= L.top - 1) continue;
          if (rng() > 0.22) continue;
          list.push({ kind: kinds[Math.floor(rng() * kinds.length)], x: (x + 0.5) * T + (rng() - 0.5) * 16, y: (y + 0.8) * T, seed: rng() });
        }
      }
      // Sidewalk furniture
      for (let x = 11; x < L.w; x += 6) list.push({ kind: theme.outside === 'sand' ? 'palm' : 'lamp', x: (x + 0.5) * T, y: (L.sidewalk + 0.15) * T, seed: 0.5, small: true });
      list.push({ kind: 'carts', x: 9.4 * T, y: (L.sidewalk + 0.22) * T, seed: 0 });
      list.push({ kind: 'bin', x: 5.6 * T, y: (L.sidewalk + 0.2) * T, seed: 0 });
      this.decor = list;
    }

    drawGround(ctx, store, theme) {
      const L = store.layout;
      const T = this.T;
      const b = this.bounds;
      ctx.fillStyle = theme.ground;
      ctx.fillRect(b.x0 - 400, b.y0 - 400, b.x1 - b.x0 + 800, b.y1 - b.y0 + 800);
      // texture dots
      const rng = U.seededRng(77);
      ctx.fillStyle = theme.groundDark;
      for (let i = 0; i < 260; i++) {
        const x = rng() * L.w * T, y = rng() * L.sidewalk * T;
        const tx = Math.floor(x / T), ty = Math.floor(y / T);
        const tile = L.tileAt(tx, ty);
        if (tile !== MS.Layout.T.GRASS) continue;
        if (theme.outside === 'plaza' || theme.outside === 'night') ctx.fillRect(x, y, 10, 1.5);
        else if (theme.outside === 'snow') S.ellipse(ctx, x, y, 5, 2, theme.groundDark);
        else { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 2, y - 5); ctx.lineTo(x + 4, y); ctx.fill(); }
      }
      if (theme.outside === 'sand') {
        // the sea along the top edge
        const seaY = Math.max(0, (L.top - 3.5)) * T;
        if (seaY > b.y0 - 40) {
          ctx.fillStyle = '#5ec8e5';
          ctx.fillRect(b.x0 - 400, b.y0 - 400, b.x1 - b.x0 + 800, seaY - b.y0 + 400);
          ctx.strokeStyle = 'rgba(255,255,255,0.7)';
          ctx.lineWidth = 3;
          ctx.beginPath();
          for (let x = b.x0 - 40; x < b.x1 + 40; x += 20) ctx.lineTo(x, seaY + Math.sin(x / 30 + this.t * 1.5) * 3);
          ctx.stroke();
        }
      }
    }

    drawStreet(ctx, store, theme) {
      const L = store.layout;
      const T = this.T;
      const b = this.bounds;
      const x0 = b.x0 - 400, w = b.x1 - b.x0 + 800;
      // sidewalk
      ctx.fillStyle = theme.sidewalk;
      ctx.fillRect(x0, L.sidewalk * T, w, T);
      ctx.fillStyle = 'rgba(0,0,0,0.07)';
      for (let x = Math.floor(x0 / 20) * 20; x < x0 + w; x += 20) ctx.fillRect(x, L.sidewalk * T, 1, T);
      ctx.fillRect(x0, (L.sidewalk + 0.5) * T, w, 1);
      // curb
      ctx.fillStyle = S.shade(theme.sidewalk, -0.25);
      ctx.fillRect(x0, (L.sidewalk + 1) * T - 4, w, 4);
      // road
      ctx.fillStyle = theme.street;
      ctx.fillRect(x0, (L.sidewalk + 1) * T, w, 3 * T + 400);
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      for (let x = Math.floor(x0 / 60) * 60; x < x0 + w; x += 60) ctx.fillRect(x, 19 * T - 2, 30, 4);
      // loading bay markings in front of the dock
      ctx.strokeStyle = 'rgba(255,214,70,0.85)';
      ctx.lineWidth = 3;
      ctx.strokeRect(0.4 * T, 18 * T + 4, 4.9 * T, T - 8);
    }

    drawLot(ctx, store) {
      const L = store.layout;
      const lot = L.lot;
      if (!lot) return;
      const T = this.T;
      ctx.fillStyle = '#d8bf93';
      for (let y = lot.y0; y <= lot.y1; y++) {
        for (let x = lot.x0; x <= lot.x1; x++) {
          if (L.tileAt(x, y) === MS.Layout.T.LOT) ctx.fillRect(x * T, y * T, T + 0.5, T + 0.5);
        }
      }
      ctx.fillStyle = 'rgba(120,90,50,0.18)';
      const rng = U.seededRng(5);
      for (let i = 0; i < 90; i++) {
        const x = U.lerp(lot.x0, lot.x1 + 1, rng()) * T, y = U.lerp(lot.y0, lot.y1 + 1, rng()) * T;
        if (L.tileAt(Math.floor(x / T), Math.floor(y / T)) === MS.Layout.T.LOT) S.ellipse(ctx, x, y, 4, 2, 'rgba(120,90,50,0.18)');
      }
      // fence posts along the outer edge of the lot
      const next = MS.STORE_LEVELS[L.level + 1];
      ctx.lineWidth = 3;
      const fenceY = next.top * T + 4;
      const fenceX = (next.right + 1) * T - 4;
      const stripe = (x1, y1, x2, y2) => {
        const len = Math.hypot(x2 - x1, y2 - y1);
        const n = Math.max(1, Math.floor(len / 14));
        for (let i = 0; i < n; i++) {
          ctx.strokeStyle = i % 2 ? '#ffffff' : '#ff7a2f';
          ctx.beginPath();
          ctx.moveTo(U.lerp(x1, x2, i / n), U.lerp(y1, y2, i / n));
          ctx.lineTo(U.lerp(x1, x2, (i + 1) / n), U.lerp(y1, y2, (i + 1) / n));
          ctx.stroke();
        }
      };
      stripe(0, fenceY, fenceX, fenceY);
      stripe(fenceX, fenceY, fenceX, (L.bottom + 0.8) * T);
      // sign
      const sx = lot.signX * T, sy = lot.signY * T;
      const cost = store.expansionCost();
      const ready = this.game.level >= next.playerLevel;
      const afford = ready && this.game.money >= cost;
      const pulse = afford && !this.reduced ? 1 + Math.sin(this.t * 4) * 0.04 : 1;
      ctx.save();
      ctx.translate(sx, sy);
      ctx.scale(pulse, pulse);
      ctx.fillStyle = '#7a5a33';
      ctx.fillRect(-2, 0, 4, 34);
      ctx.shadowColor = 'rgba(0,0,0,0.25)';
      ctx.shadowBlur = 6;
      S.fillRound(ctx, -54, -52, 108, 56, 10, afford ? '#ffcf33' : '#fff3c4');
      ctx.shadowBlur = 0;
      ctx.strokeStyle = '#1f1f1f';
      ctx.lineWidth = 1.5;
      S.roundRect(ctx, -54, -52, 108, 56, 10);
      ctx.stroke();
      S.emoji(ctx, '🚧', -38, -34, 18);
      ctx.fillStyle = '#2b2b2b';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.font = `700 11px ${S.TEXT_FONT}`;
      ctx.fillText('Uitbreiding', -25, -40);
      ctx.font = `600 9.5px ${S.TEXT_FONT}`;
      ctx.fillText(next.name, -25, -28);
      ctx.textAlign = 'center';
      ctx.font = `700 12px ${S.TEXT_FONT}`;
      ctx.fillStyle = ready ? (afford ? '#1f7a44' : '#8a5a00') : '#8a8a8a';
      ctx.fillText(ready ? U.moneyShort(cost) : `🔒 level ${next.playerLevel}`, 0, -11);
      ctx.restore();
      this.lotSign = { x0: sx - 56, y0: sy - 54, x1: sx + 56, y1: sy + 34 };
      // a crane on the building lot
      if (next.top < L.top) S.emoji(ctx, '🏗️', (L.floorX0 + 2) * T, (next.top + 1.3) * T, 34);
      else S.emoji(ctx, '🏗️', lot.signX * T, (lot.signY + 2.3) * T, 30);
    }

    drawFloor(ctx, store, theme) {
      const L = store.layout;
      const T = this.T;
      // shop floor: two-tone tiles
      for (let y = L.top; y < L.bottom; y++) {
        for (let x = L.floorX0 - 1; x <= L.right; x++) {
          const checkout = y >= L.bottom - 5;
          let c = (x + y) % 2 ? theme.floorA : theme.floorB;
          if (checkout) c = S.shade(c, theme.night ? 0.06 : -0.04);
          ctx.fillStyle = c;
          ctx.fillRect(x * T, y * T, T + 0.5, T + 0.5);
        }
      }
      ctx.fillStyle = theme.grout;
      for (let y = L.top; y <= L.bottom; y++) ctx.fillRect((L.floorX0 - 1) * T, y * T - 0.5, (L.right - L.floorX0 + 2) * T, 1);
      for (let x = L.floorX0 - 1; x <= L.right + 1; x++) ctx.fillRect(x * T - 0.5, L.top * T, 1, (L.bottom - L.top) * T);
      // coloured line marking the checkout area
      ctx.fillStyle = theme.accent;
      ctx.globalAlpha = 0.35;
      ctx.fillRect(L.floorX0 * T, (L.bottom - 5) * T - 2, (L.right - L.floorX0) * T, 4);
      ctx.globalAlpha = 1;
      // welcome mat
      S.fillRound(ctx, L.exitDoor.x * T + 4, (L.bottom - 1) * T + 8, 2 * T - 8, T - 10, 5, '#5a4636');
      ctx.font = `700 9px ${S.TEXT_FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#e8d5b5';
      ctx.fillText('WELKOM', (L.exitDoor.x + 1) * T, (L.bottom - 0.4) * T);
    }

    drawWarehouse(ctx, store, theme) {
      const L = store.layout;
      const T = this.T;
      const wh = L.warehouse;
      ctx.fillStyle = theme.warehouseFloor;
      ctx.fillRect(wh.x0 * T - 14, wh.y0 * T - T, (wh.x1 - wh.x0 + 1) * T + 28, (wh.y1 - wh.y0 + 2) * T);
      ctx.fillStyle = 'rgba(0,0,0,0.05)';
      for (let y = wh.y0; y <= wh.y1; y++) ctx.fillRect(wh.x0 * T, y * T, (wh.x1 - wh.x0 + 1) * T, 1);
      // hazard stripes at the dock
      for (let i = 0; i < 16; i++) {
        ctx.fillStyle = i % 2 ? '#2b2b2b' : '#ffcf33';
        ctx.fillRect(wh.x0 * T + i * 10, L.bottom * T - 8, 10, 8);
      }
      // pallets with boxes, filled according to how full the warehouse is
      const inv = store.inventory;
      const ratio = U.clamp(inv.units() / inv.warehouseCapacity, 0, 1);
      const rows = Math.max(1, (wh.y1 - 5) - wh.y0 + 1);
      const spots = [];
      for (let r = 0; r < rows; r++) for (let c = 0; c < 4; c++) spots.push({ x: (wh.x0 + c + 0.5) * T, y: (wh.y0 + r + 0.6) * T });
      const filled = Math.ceil(ratio * spots.length * 3);
      spots.forEach((sp, i) => {
        S.fillRound(ctx, sp.x - 16, sp.y - 2, 32, 14, 2, '#b88a55');
        ctx.fillStyle = 'rgba(0,0,0,0.18)';
        ctx.fillRect(sp.x - 16, sp.y + 4, 32, 2);
        const h = Math.max(0, Math.min(3, filled - i * 3));
        for (let k = 0; k < h; k++) {
          S.fillRound(ctx, sp.x - 13 + (k % 2) * 4, sp.y - 12 - k * 10, 24, 13, 2, k % 2 ? '#d9a35f' : '#c98f4b');
          ctx.fillStyle = 'rgba(255,255,255,0.35)';
          ctx.fillRect(sp.x - 3 + (k % 2) * 4, sp.y - 12 - k * 10, 4, 13);
        }
      });
      // painted label
      ctx.save();
      ctx.font = `700 12px ${S.TEXT_FONT}`;
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(0,0,0,0.28)';
      ctx.fillText('MAGAZIJN', (wh.x0 + wh.x1 + 1) / 2 * T, (wh.y1 - 3.3) * T);
      ctx.font = `600 10px ${S.TEXT_FONT}`;
      ctx.fillText(`${inv.units()} / ${inv.warehouseCapacity}`, (wh.x0 + wh.x1 + 1) / 2 * T, (wh.y1 - 2.85) * T);
      ctx.restore();
      this.warehouseRect = { x0: wh.x0 * T, y0: wh.y0 * T, x1: (wh.x1 + 1) * T, y1: (wh.y1 + 1) * T };
    }

    drawBackWall(ctx, store, theme) {
      const L = store.layout;
      const T = this.T;
      const x0 = T - 14, x1 = L.right * T + 14;
      const yb = (L.top + 1) * T;
      S.fillRound(ctx, x0, yb - 44, x1 - x0, 12, 4, theme.wallTop);
      ctx.fillStyle = theme.wall;
      ctx.fillRect(x0, yb - 34, x1 - x0, 34);
      ctx.fillStyle = S.shade(theme.wall, -0.15);
      ctx.fillRect(x0, yb - 6, x1 - x0, 6);
      ctx.fillStyle = theme.trim;
      ctx.fillRect(x0, yb - 34, x1 - x0, 3);
      // windows, posters and a clock on the shop side
      const posters = ['🍎', '🥖', '🧀', '🥤', '🍫', '🥕', '🍕'];
      let pi = 0;
      for (let x = L.floorX0; x < L.right; x += 2) {
        const px = x * T + T * 0.5;
        if ((x - L.floorX0) % 6 === 2) {
          S.fillRound(ctx, px - 4, yb - 30, 2 * T - 12, 22, 3, '#ffffff');
          S.fillRound(ctx, px - 2, yb - 28, 2 * T - 16, 18, 2, theme.night ? '#233256' : '#bfe6ff');
          ctx.fillStyle = 'rgba(255,255,255,0.5)';
          ctx.fillRect(px + 6, yb - 27, 6, 16);
        } else if ((x - L.floorX0) % 6 === 4) {
          S.fillRound(ctx, px + 4, yb - 30, 24, 22, 3, pi % 2 ? theme.accent : theme.accent2);
          S.emoji(ctx, posters[pi++ % posters.length], px + 16, yb - 20, 15);
        }
      }
      // clock
      const cx = (L.floorX0 + 0.8) * T, cy = yb - 19;
      S.ellipse(ctx, cx, cy, 9, 9, '#ffffff');
      ctx.strokeStyle = '#333';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      const d = new Date();
      const ha = ((d.getHours() % 12) / 12) * Math.PI * 2 - Math.PI / 2, ma = (d.getMinutes() / 60) * Math.PI * 2 - Math.PI / 2;
      ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(ha) * 4.5, cy + Math.sin(ha) * 4.5);
      ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(ma) * 7, cy + Math.sin(ma) * 7);
      ctx.stroke();
      // warehouse part of the wall: plain, with a sign
      ctx.fillStyle = 'rgba(0,0,0,0.08)';
      ctx.fillRect(x0, yb - 34, (L.divider + 0.5) * T - x0, 34);
    }

    drawSideWalls(ctx, store, theme) {
      const L = store.layout;
      const T = this.T;
      const y0 = (L.top + 1) * T - 44, y1 = L.bottom * T + 8;
      const wall = (x) => {
        S.fillRound(ctx, x, y0, 14, y1 - y0, 4, theme.wallTop);
        ctx.fillStyle = S.shade(theme.wallTop, -0.1);
        ctx.fillRect(x + 11, y0 + 6, 3, y1 - y0 - 6);
      };
      wall(T - 14);
      wall(L.right * T);
      // divider between warehouse and shop, with the staff door
      const dx = L.divider * T + 13;
      const doorY = L.whDoor.y * T;
      S.fillRound(ctx, dx, y0 + 30, 14, doorY - y0 - 30, 3, theme.wallTop);
      ctx.fillStyle = S.shade(theme.wallTop, -0.1);
      ctx.fillRect(dx + 11, y0 + 36, 3, doorY - y0 - 36);
      // swinging door
      const open = store.employees.some((e) => Math.abs(e.x - (L.whDoor.x + 0.5) * T) < T && Math.abs(e.y - (L.whDoor.y + 0.5) * T) < T);
      ctx.fillStyle = '#9aa7b4';
      if (open) ctx.fillRect(dx + 2, doorY + 2, 24, 5);
      else S.fillRound(ctx, dx + 3, doorY + 2, 8, T - 4, 2, '#9aa7b4');
      S.fillRound(ctx, dx - 16, doorY - 16, 46, 12, 3, '#34495e');
      ctx.font = `700 7px ${S.TEXT_FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#fff';
      ctx.fillText('PERSONEEL', dx + 7, doorY - 9.5);
    }

    drawFacade(ctx, store, theme) {
      const L = store.layout;
      const T = this.T;
      const y = L.bottom * T;
      const x0 = T - 14, x1 = L.right * T + 14;
      const doorX0 = L.exitDoor.x * T, doorX1 = (L.entryDoor.x + 1) * T;
      const dockX0 = L.dock.x0 * T, dockX1 = (L.dock.x1 + 1) * T;
      const seg = (a, b) => {
        if (b <= a) return;
        ctx.fillStyle = theme.wallTop;
        ctx.fillRect(a, y, b - a, 8);
        ctx.fillStyle = theme.wall;
        ctx.fillRect(a, y + 8, b - a, 22);
        ctx.fillStyle = S.shade(theme.wall, -0.18);
        ctx.fillRect(a, y + 26, b - a, 4);
      };
      seg(x0, dockX0);
      seg(dockX1, doorX0);
      seg(doorX1, x1);
      // shop windows
      for (let x = L.entryDoor.x + 1.3; x < L.right - 0.8; x += 2.5) {
        S.fillRound(ctx, x * T, y + 10, 1.8 * T, 13, 2, theme.night ? '#ffe7a3' : '#cdeeff');
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        ctx.fillRect(x * T + 6, y + 11, 8, 11);
      }
      // dock door (roll-up)
      const tr = store.truck;
      const dockOpen = tr && tr.state === 'docked';
      ctx.fillStyle = dockOpen ? '#3b3024' : '#9aa3ad';
      ctx.fillRect(dockX0, y, dockX1 - dockX0, 30);
      if (!dockOpen) {
        ctx.fillStyle = 'rgba(0,0,0,0.15)';
        for (let yy = y + 3; yy < y + 30; yy += 5) ctx.fillRect(dockX0, yy, dockX1 - dockX0, 1.5);
      }
      ctx.fillStyle = '#ffcf33';
      ctx.fillRect(dockX0, y, 4, 30);
      ctx.fillRect(dockX1 - 4, y, 4, 30);
      // automatic sliding doors: open when someone is close
      const near = store.customers.some((c) => Math.abs(c.x - (doorX0 + doorX1) / 2) < 1.6 * T && Math.abs(c.y - (y + 20)) < 1.3 * T);
      this.doorOpen = U.lerp(this.doorOpen || 0, near ? 1 : 0, 0.15);
      const half = (doorX1 - doorX0) / 2;
      const slide = this.doorOpen * (half - 6);
      ctx.fillStyle = 'rgba(190,230,250,0.75)';
      ctx.fillRect(doorX0 + 2 - slide, y + 4, half - 2, 24);
      ctx.fillRect(doorX0 + half + slide, y + 4, half - 2, 24);
      ctx.fillStyle = '#6d7a88';
      ctx.fillRect(doorX0 - 3, y, 4, 30);
      ctx.fillRect(doorX1 - 1, y, 4, 30);
      ctx.fillRect(doorX0, y - 2, doorX1 - doorX0, 4);
      // store sign
      const name = store.def.name.toUpperCase();
      ctx.font = `700 13px ${S.TEXT_FONT}`;
      const tw = ctx.measureText(name).width + 44;
      const sx = Math.min((L.entryDoor.x + 1.4) * T, L.right * T - tw - 6);
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.25)';
      ctx.shadowBlur = 5;
      ctx.shadowOffsetY = 2;
      S.fillRound(ctx, sx, y - 4, tw, 24, 8, theme.sign);
      ctx.restore();
      S.emoji(ctx, store.def.icon, sx + 15, y + 8, 15);
      ctx.fillStyle = theme.signText;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(name, sx + 27, y + 8.5);
    }

    drawFloorItems(ctx, store, theme) {
      const T = this.T;
      // dirt
      for (const d of store.dirt) {
        const x = (d.x + 0.5) * T, y = (d.y + 0.5) * T;
        const fade = Math.min(1, d.age * 3);
        ctx.globalAlpha = fade;
        if (d.kind === 'spill') {
          S.ellipse(ctx, x, y + 4, 13, 7, 'rgba(120,170,220,0.55)');
          S.ellipse(ctx, x + 6, y + 1, 5, 3, 'rgba(120,170,220,0.55)');
          S.ellipse(ctx, x - 4, y + 2, 3, 1.5, 'rgba(255,255,255,0.7)');
        } else if (d.kind === 'litter') {
          ctx.save();
          ctx.translate(x, y + 3);
          ctx.rotate(0.4);
          S.fillRound(ctx, -6, -4, 12, 9, 2, '#f2f2f2');
          ctx.strokeStyle = '#b8b8b8';
          ctx.lineWidth = 1;
          ctx.strokeRect(-6, -4, 12, 9);
          ctx.restore();
          S.ellipse(ctx, x - 7, y + 7, 3, 2, '#e8d9a8');
        } else {
          for (let i = 0; i < 7; i++) S.ellipse(ctx, x + Math.cos(i * 2.3) * 9, y + 3 + Math.sin(i * 1.7) * 5, 2, 1.5, '#b88a55');
        }
        ctx.globalAlpha = 1;
      }
      // empty shelf spots you can build on
      const avail = MS.Layout.slotCountAt(store.level);
      const cost = store.shelfCost();
      for (const slot of store.slots) {
        if (slot.built || slot.index >= avail) continue;
        const sp = MS.Layout.SLOT_SPOTS[slot.index];
        const X = sp.x * T, Y = sp.y * T;
        const afford = this.game.money >= cost;
        ctx.save();
        ctx.setLineDash([6, 5]);
        ctx.lineWidth = 2;
        ctx.strokeStyle = afford ? 'rgba(57,179,122,0.9)' : 'rgba(120,120,120,0.55)';
        ctx.fillStyle = afford ? 'rgba(57,179,122,0.10)' : 'rgba(0,0,0,0.04)';
        S.roundRect(ctx, X + 4, Y + 3, 2 * T - 8, T - 6, 8);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
        S.ellipse(ctx, X + 18, Y + T / 2, 9, 9, afford ? '#39b37a' : '#a0a0a0');
        ctx.fillStyle = '#fff';
        ctx.fillRect(X + 14, Y + T / 2 - 1.3, 8, 2.6);
        ctx.fillRect(X + 16.7, Y + T / 2 - 4, 2.6, 8);
        ctx.font = `700 11px ${S.TEXT_FONT}`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = afford ? '#1f7a44' : '#777';
        ctx.fillText(U.moneyShort(cost), X + 31, Y + T / 2 + 0.5);
      }
    }

    drawShelfSlot(ctx, store, slot, theme) {
      const T = this.T;
      const sp = MS.Layout.SLOT_SPOTS[slot.index];
      const p = slot.productId ? MS.product(slot.productId) : null;
      const fill = p ? slot.stock / store.inventory.shelfCapacity : 0;
      S.shelf(ctx, sp.x * T, sp.y * T, T, p, fill, theme, this.t, { reduced: this.reduced });
    }

    drawDecorItem(ctx, d, theme) {
      const T = this.T;
      const x = d.x != null && d.kind !== 'plant' && d.kind !== 'promo' ? d.x : (d.x + 0.5) * T;
      const y = d.kind === 'plant' || d.kind === 'promo' ? (d.y + 0.85) * T : d.y;
      switch (d.kind) {
        case 'plant':
          S.ellipse(ctx, x, y + 2, 12, 4, 'rgba(0,0,0,0.15)');
          S.fillRound(ctx, x - 9, y - 12, 18, 14, 4, '#c96f3b');
          for (let i = 0; i < 5; i++) S.ellipse(ctx, x + Math.cos(i * 1.26) * 7, y - 20 + Math.sin(i * 1.26) * 5, 7, 9, i % 2 ? '#3d9b57' : '#4fb56a');
          break;
        case 'promo':
          S.ellipse(ctx, x, y + 2, 16, 5, 'rgba(0,0,0,0.15)');
          S.fillRound(ctx, x - 16, y - 16, 32, 18, 4, theme.accent);
          S.fillRound(ctx, x - 13, y - 26, 26, 14, 3, '#fff');
          ctx.font = `700 8px ${S.TEXT_FONT}`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = theme.accent;
          ctx.fillText('ACTIE!', x, y - 19);
          S.emoji(ctx, '🏷️', x, y - 7, 12);
          break;
        case 'tree': {
          S.ellipse(ctx, x, y, 16, 6, 'rgba(0,0,0,0.15)');
          ctx.fillStyle = '#8a5a2b';
          ctx.fillRect(x - 3, y - 14, 6, 14);
          const g = d.seed > 0.5 ? '#5cab4a' : '#4c9a45';
          S.ellipse(ctx, x, y - 26, 17, 15, g);
          S.ellipse(ctx, x - 6, y - 31, 9, 8, S.shade(g, 0.15));
          break;
        }
        case 'pine':
          S.ellipse(ctx, x, y, 13, 5, 'rgba(0,0,0,0.15)');
          ctx.fillStyle = '#7a4f2b';
          ctx.fillRect(x - 2.5, y - 10, 5, 10);
          for (let i = 0; i < 3; i++) {
            ctx.fillStyle = i === 2 ? '#ffffff' : '#2f6b4a';
            ctx.beginPath();
            ctx.moveTo(x, y - 46 + i * 9);
            ctx.lineTo(x - 15 + i * 3, y - 10 - (2 - i) * 9 + (i === 2 ? -26 : 0));
            ctx.lineTo(x + 15 - i * 3, y - 10 - (2 - i) * 9 + (i === 2 ? -26 : 0));
            ctx.fill();
          }
          ctx.fillStyle = '#2f6b4a';
          ctx.beginPath(); ctx.moveTo(x, y - 40); ctx.lineTo(x - 15, y - 10); ctx.lineTo(x + 15, y - 10); ctx.fill();
          ctx.fillStyle = '#ffffff';
          ctx.beginPath(); ctx.moveTo(x, y - 40); ctx.lineTo(x - 6, y - 28); ctx.lineTo(x + 6, y - 28); ctx.fill();
          break;
        case 'palm':
          S.ellipse(ctx, x, y, 12, 4, 'rgba(0,0,0,0.15)');
          ctx.strokeStyle = '#9b6b3c';
          ctx.lineWidth = 5;
          ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + 6, y - 20, x + 2, y - (d.small ? 30 : 40)); ctx.stroke();
          for (let i = 0; i < 5; i++) {
            const a = -Math.PI / 2 + (i - 2) * 0.7;
            ctx.strokeStyle = '#3aa35a';
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.moveTo(x + 2, y - (d.small ? 30 : 40));
            ctx.quadraticCurveTo(x + 2 + Math.cos(a) * 12, y - (d.small ? 30 : 40) + Math.sin(a) * 12 - 4, x + 2 + Math.cos(a) * 20, y - (d.small ? 30 : 40) + Math.sin(a) * 10 + 8);
            ctx.stroke();
          }
          break;
        case 'bush':
          S.ellipse(ctx, x, y, 12, 4, 'rgba(0,0,0,0.12)');
          S.ellipse(ctx, x - 5, y - 7, 9, 7, '#4c9a45');
          S.ellipse(ctx, x + 5, y - 8, 9, 8, '#5cab4a');
          break;
        case 'flowers':
          for (let i = 0; i < 5; i++) S.ellipse(ctx, x + (i - 2) * 5, y - 4 - (i % 2) * 3, 2.6, 2.6, ['#ff7aa2', '#ffd24a', '#ffffff', '#b28dff'][i % 4]);
          break;
        case 'planter':
        case 'planterNeon':
          S.ellipse(ctx, x, y, 14, 4, 'rgba(0,0,0,0.15)');
          S.fillRound(ctx, x - 12, y - 12, 24, 12, 3, d.kind === 'planterNeon' ? '#2a2f45' : '#9aa3ad');
          if (d.kind === 'planterNeon') {
            ctx.strokeStyle = d.seed > 0.5 ? '#ff4fa3' : '#35e0d0';
            ctx.lineWidth = 2;
            S.roundRect(ctx, x - 12, y - 12, 24, 12, 3);
            ctx.stroke();
          }
          S.ellipse(ctx, x, y - 18, 11, 9, '#4c9a45');
          break;
        case 'bench':
          S.ellipse(ctx, x, y, 16, 4, 'rgba(0,0,0,0.12)');
          ctx.fillStyle = '#6d4a2b';
          ctx.fillRect(x - 14, y - 6, 3, 6);
          ctx.fillRect(x + 11, y - 6, 3, 6);
          S.fillRound(ctx, x - 16, y - 12, 32, 6, 2, '#a86f3d');
          S.fillRound(ctx, x - 16, y - 20, 32, 5, 2, '#a86f3d');
          break;
        case 'lamp': {
          S.ellipse(ctx, x, y, 6, 2.5, 'rgba(0,0,0,0.15)');
          ctx.fillStyle = '#4b5563';
          ctx.fillRect(x - 1.5, y - 38, 3, 38);
          S.fillRound(ctx, x - 6, y - 44, 12, 8, 3, '#374151');
          if (theme.night) {
            const g = ctx.createRadialGradient(x, y - 40, 2, x, y - 40, 40);
            g.addColorStop(0, 'rgba(255,230,150,0.55)');
            g.addColorStop(1, 'rgba(255,230,150,0)');
            ctx.fillStyle = g;
            ctx.fillRect(x - 40, y - 80, 80, 80);
          }
          S.ellipse(ctx, x, y - 38, 4, 2.5, '#ffe7a3');
          break;
        }
        case 'umbrella':
          S.ellipse(ctx, x, y, 16, 5, 'rgba(0,0,0,0.12)');
          ctx.fillStyle = '#8a8a8a';
          ctx.fillRect(x - 1, y - 30, 2, 30);
          ctx.fillStyle = d.seed > 0.5 ? '#ff7a59' : '#4f8cff';
          ctx.beginPath(); ctx.moveTo(x - 20, y - 26); ctx.quadraticCurveTo(x, y - 46, x + 20, y - 26); ctx.fill();
          break;
        case 'shell':
          S.emoji(ctx, d.seed > 0.5 ? '🐚' : '⭐', x, y - 4, 12);
          break;
        case 'snowman':
          S.ellipse(ctx, x, y, 12, 4, 'rgba(0,0,0,0.12)');
          S.ellipse(ctx, x, y - 9, 10, 9, '#ffffff');
          S.ellipse(ctx, x, y - 24, 7, 7, '#ffffff');
          S.ellipse(ctx, x - 2, y - 25, 1, 1, '#222');
          S.ellipse(ctx, x + 2, y - 25, 1, 1, '#222');
          ctx.fillStyle = '#ff8a3d';
          ctx.beginPath(); ctx.moveTo(x, y - 23); ctx.lineTo(x + 7, y - 22); ctx.lineTo(x, y - 21); ctx.fill();
          break;
        case 'rock':
          S.ellipse(ctx, x, y - 5, 12, 8, '#9aa3ad');
          S.ellipse(ctx, x - 3, y - 9, 6, 3, '#ffffff');
          break;
        case 'carts':
          for (let i = 0; i < 3; i++) {
            S.fillRound(ctx, x - 14 + i * 5, y - 10, 18, 11, 2, '#c9d2dc');
            ctx.strokeStyle = '#8795a3';
            ctx.lineWidth = 1;
            S.roundRect(ctx, x - 14 + i * 5, y - 10, 18, 11, 2);
            ctx.stroke();
          }
          break;
        case 'bin':
          S.ellipse(ctx, x, y, 7, 2.5, 'rgba(0,0,0,0.15)');
          S.fillRound(ctx, x - 6, y - 16, 12, 16, 3, '#39b37a');
          S.fillRound(ctx, x - 7, y - 18, 14, 4, 2, '#2c8a5e');
          break;
      }
    }

    drawCar(ctx, car, theme) {
      const x = car.x, y = car.y;
      S.ellipse(ctx, x + 38, y + 1, 42, 6, 'rgba(0,0,0,0.2)');
      S.fillRound(ctx, x, y - 26, 80, 20, 8, car.color);
      S.fillRound(ctx, x + 18, y - 40, 42, 18, 8, S.shade(car.color, -0.1));
      S.fillRound(ctx, x + 22, y - 37, 16, 12, 3, '#cfeaff');
      S.fillRound(ctx, x + 41, y - 37, 15, 12, 3, '#cfeaff');
      S.ellipse(ctx, x + 18, y - 6, 7, 7, '#23262d');
      S.ellipse(ctx, x + 62, y - 6, 7, 7, '#23262d');
      if (theme.night) {
        const g = ctx.createRadialGradient(x, y - 16, 1, x - 20, y - 16, 40);
        g.addColorStop(0, 'rgba(255,240,180,0.7)');
        g.addColorStop(1, 'rgba(255,240,180,0)');
        ctx.fillStyle = g;
        ctx.fillRect(x - 60, y - 40, 60, 50);
      }
      S.ellipse(ctx, x + 2, y - 16, 3, 3, '#ffe7a3');
    }

    drawCustomer(ctx, c) {
      const t = this.t;
      const items = this.cartIcons(c);
      S.person(ctx, c, t, { mood: c.mood, badge: c.type.badge || null, reduced: this.reduced });
      if (c.hasCart) S.cart(ctx, c, items);
      else if (c.isInside || items.length) S.basket(ctx, c, items, this.reduced);
    }

    drawEmployee(ctx, e, theme) {
      S.person(ctx, e, this.t, { staff: true, apron: theme.accent, badge: e.role.icon, reduced: this.reduced });
      if (e.carry) S.emoji(ctx, '📦', e.x + (e.facing || 1) * 6, e.y - 20, 15);
      if (e.type === 'cleaner') {
        const f = e.facing || 1;
        const sway = e.state === 'clean' ? Math.sin(this.t * 14) * 5 : 0;
        ctx.strokeStyle = '#8a5a2b';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(e.x + f * 9, e.y - 18);
        ctx.lineTo(e.x + f * 15 + sway, e.y + 1);
        ctx.stroke();
        S.fillRound(ctx, e.x + f * 15 + sway - 6, e.y - 1, 12, 4, 2, '#6fc3df');
      }
    }

    drawConstruction(ctx, store) {
      const c = this.construction;
      const L = store.layout;
      const T = this.T;
      const prev = MS.STORE_LEVELS[c.level - 1];
      const k = c.t / c.dur;
      ctx.globalAlpha = Math.max(0, 1 - k) * 0.8;
      ctx.fillStyle = '#d8bf93';
      // the new strip on the right
      ctx.fillRect((prev.right + 0.4) * T, (L.top + 0.2) * T, (L.right - prev.right + 0.4) * T, (L.bottom - L.top) * T);
      if (L.top < prev.top) ctx.fillRect((L.floorX0 - 1) * T, (L.top + 0.2) * T, (L.right - L.floorX0 + 2) * T, (prev.top - L.top + 1) * T);
      ctx.globalAlpha = 1;
      if (!this.reduced) {
        for (let i = 0; i < 4; i++) {
          const x = U.lerp((L.floorX0 + 1) * T, (L.right - 1) * T, (i + 0.5) / 4);
          const bounce = Math.abs(Math.sin(c.t * 9 + i)) * 10;
          ctx.globalAlpha = Math.max(0, 1 - k);
          S.emoji(ctx, '🔨', x, (L.top + 1.5) * T - bounce, 22);
        }
        ctx.globalAlpha = 1;
      }
    }

    // ---- Overlays: warnings, bubbles, hints ---------------------------------------------------------------
    drawOverlays(ctx, store) {
      const T = this.T;
      const t = this.t;
      const bob = this.reduced ? 0 : Math.sin(t * 5) * 3;
      const k = this.uiScale();
      const inv = store.inventory;
      const low = inv.lowShelfMark();
      for (const slot of store.slots) {
        if (!slot.built || !slot.productId || slot.stock > low) continue;
        const sp = MS.Layout.SLOT_SPOTS[slot.index];
        const has = inv.qty(slot.productId) > 0;
        const x = (sp.x + 1) * T, y = sp.y * T - 24 + bob;
        S.bubble(ctx, x, y + 6, [has ? '⚠️' : '🚫', MS.product(slot.productId).emoji], { size: 13 * k, bg: has ? '#fff4d6' : '#ffe1e1' });
        if (slot.stock === 0) S.outlinedText(ctx, 'LEEG', x, sp.y * T + 12, 10 * Math.min(k, 1.4), '#d62d2d', true);
      }
      for (const r of store.registers) {
        if (!r.waitingForPlayer) continue;
        const c = r.def.counter;
        const x = (c.x + 0.5) * T, y = c.y0 * T - 26;
        const pulse = this.reduced ? 0.5 : (Math.sin(t * 6) + 1) / 2;
        ctx.strokeStyle = `rgba(255,207,51,${0.5 + pulse * 0.5})`;
        ctx.lineWidth = 3;
        S.roundRect(ctx, c.x * T + 1, c.y0 * T - 10, T - 2, 2 * T + 6, 8);
        ctx.stroke();
        S.bubble(ctx, x, y + bob, ['👆', '🧾'], { size: 15 * k, bg: '#fff7cc' });
      }
      const tr = store.truck;
      if (tr && tr.state === 'docked' && tr.hasCargo()) {
        const x = tr.x + 2 * T, y = tr.y - 76 + bob;
        const worker = store.staffCount('warehouse') > 0;
        S.bubble(ctx, x, y, worker ? ['📦'] : ['👆', '📦'], { size: 16 * k, bg: '#fff1e0' });
        S.outlinedText(ctx, `${tr.cargoUnits()} stuks`, x, y + 12, 10 * Math.min(k, 1.4), '#b35c00', true);
      }
      for (const c of store.customers) this.drawCustomerBubble(ctx, c);
      for (const e of store.employees) {
        if (e.emote) S.bubble(ctx, e.x, e.y - 44, e.emote.icon, { size: 13 });
      }
    }

    drawCustomerBubble(ctx, c) {
      const x = c.x, y = c.y - 44;
      if (c.emote) {
        const k = c.emote.t / c.emote.dur;
        ctx.globalAlpha = k > 0.8 ? (1 - k) / 0.2 : 1;
        S.bubble(ctx, x, y, c.emote.icon, { size: 14 });
        ctx.globalAlpha = 1;
        return;
      }
      const wish = c.currentWish;
      if ((c.state === 'toShelf' || c.state === 'pick') && wish && this.hover && this.hover.ref === c) {
        S.bubble(ctx, x, y, [MS.product(wish.pid).emoji], { size: 13 });
      } else if (c.state === 'waitShelf' && wish) {
        S.bubble(ctx, x, y, ['😟', MS.product(wish.pid).emoji], { size: 13, bar: c.patience / c.patienceMax });
      } else if ((c.state === 'queue' || c.state === 'atCounter') && c.patience / c.patienceMax < 0.65) {
        const k = c.patience / c.patienceMax;
        S.bubble(ctx, x, y, [k > 0.35 ? '😐' : '😠'], { size: 12, bar: k });
      } else if ((c.state === 'toShelf' || c.state === 'pick') && wish && c.id % 3 === 0) {
        S.bubble(ctx, x, y, [MS.product(wish.pid).emoji], { size: 12, bg: 'rgba(255,255,255,0.85)' });
      }
    }

    drawHighlight(ctx, h, strong) {
      if (!h) return;
      const r = this.rectOf(h);
      if (!r) return;
      ctx.save();
      ctx.strokeStyle = strong ? 'rgba(255,207,51,0.95)' : 'rgba(255,255,255,0.9)';
      ctx.lineWidth = strong ? 3 : 2.2;
      ctx.shadowColor = strong ? 'rgba(255,190,0,0.8)' : 'rgba(0,0,0,0.3)';
      ctx.shadowBlur = 8;
      S.roundRect(ctx, r.x0, r.y0, r.x1 - r.x0, r.y1 - r.y0, 8);
      ctx.stroke();
      ctx.restore();
    }

    // ---- Picking ---------------------------------------------------------------------------------------------
    rectOf(h) {
      const T = this.T;
      const store = this.store;
      switch (h.type) {
        case 'shelf':
        case 'slot': {
          const sp = MS.Layout.SLOT_SPOTS[h.ref.index];
          return { x0: sp.x * T, y0: sp.y * T - (h.type === 'shelf' ? 20 : 0), x1: (sp.x + 2) * T, y1: (sp.y + 1) * T };
        }
        case 'register': {
          const c = h.ref.def.counter;
          return { x0: c.x * T, y0: c.y0 * T - 20, x1: (c.x + 2) * T, y1: (c.y1 + 1) * T };
        }
        case 'customer':
        case 'employee':
          if (h.type === 'customer' && !store.customers.includes(h.ref)) return null;
          if (h.type === 'employee' && !store.employees.includes(h.ref)) return null;
          return { x0: h.ref.x - 13, y0: h.ref.y - 42, x1: h.ref.x + 13, y1: h.ref.y + 4 };
        case 'truck':
          if (store.truck !== h.ref) return null;
          return { x0: h.ref.x - 4, y0: h.ref.y - 74, x1: h.ref.x + 4.5 * T, y1: h.ref.y + 4 };
        case 'dirt':
          if (!store.dirt.includes(h.ref)) return null;
          return { x0: h.ref.x * T + 2, y0: h.ref.y * T + 2, x1: (h.ref.x + 1) * T - 2, y1: (h.ref.y + 1) * T - 2 };
        case 'lot':
          return this.lotSign || null;
        case 'warehouse':
          return this.warehouseRect || null;
      }
      return null;
    }

    pick(sx, sy) {
      const w = this.screenToWorld(sx, sy);
      const store = this.store;
      const inside = (r) => r && w.x >= r.x0 && w.x <= r.x1 && w.y >= r.y0 && w.y <= r.y1;
      const tr = store.truck;
      if (tr && tr.state !== 'leaving' && inside(this.rectOf({ type: 'truck', ref: tr }))) return { type: 'truck', ref: tr };
      // people (front-most first)
      const people = store.customers.map((c) => ({ type: 'customer', ref: c })).concat(store.employees.map((e) => ({ type: 'employee', ref: e })));
      people.sort((a, b) => b.ref.y - a.ref.y);
      for (const p of people) {
        if (p.type === 'customer' && !p.ref.isInside) continue;
        if (Math.hypot(w.x - p.ref.x, w.y - (p.ref.y - 18)) < 15) return p;
      }
      for (const r of store.registers) if (inside(this.rectOf({ type: 'register', ref: r }))) return { type: 'register', ref: r };
      for (const d of store.dirt) if (inside(this.rectOf({ type: 'dirt', ref: d }))) return { type: 'dirt', ref: d };
      const avail = MS.Layout.slotCountAt(store.level);
      for (const s of store.slots) {
        if (s.index >= avail) continue;
        const h = { type: s.built ? 'shelf' : 'slot', ref: s };
        if (inside(this.rectOf(h))) return h;
      }
      if (store.layout.lot && inside(this.lotSign)) return { type: 'lot', ref: null };
      if (inside(this.warehouseRect)) return { type: 'warehouse', ref: null };
      return null;
    }
  }

  MS.Renderer = Renderer;
})((window.MS = window.MS || {}));
