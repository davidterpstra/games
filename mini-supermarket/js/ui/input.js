/* Input: mouse, touch and keyboard. Tap/click things in the store, drag to
 * pan, wheel or pinch to zoom. Taps on the checkout, a low shelf, the truck or
 * a stain do the job right away — those are the "manual" jobs staff later
 * take over. */
(function (MS) {
  'use strict';

  class Input {
    constructor(game, renderer, ui) {
      this.game = game;
      this.renderer = renderer;
      this.ui = ui;
      this.canvas = renderer.canvas;
      this.pointers = new Map();
      this.dragging = false;
      this.pinch = null;
      this.bind();
    }

    local(e) {
      const r = this.canvas.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    }

    bind() {
      const c = this.canvas;
      c.addEventListener('pointerdown', (e) => this.onDown(e));
      c.addEventListener('pointermove', (e) => this.onMove(e));
      c.addEventListener('pointerup', (e) => this.onUp(e));
      c.addEventListener('pointercancel', (e) => this.onCancel(e));
      c.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') this.setHover(null); });
      c.addEventListener('wheel', (e) => this.onWheel(e), { passive: false });
      c.addEventListener('contextmenu', (e) => e.preventDefault());
      window.addEventListener('keydown', (e) => this.onKey(e));
    }

    onDown(e) {
      this.game.audio.unlock();
      const p = this.local(e);
      this.pointers.set(e.pointerId, { x: p.x, y: p.y, sx: p.x, sy: p.y });
      try { this.canvas.setPointerCapture(e.pointerId); } catch { /* ignore */ }
      if (this.pointers.size === 1) this.dragging = false;
      if (this.pointers.size === 2) {
        const [a, b] = Array.from(this.pointers.values());
        this.pinch = { dist: Math.hypot(a.x - b.x, a.y - b.y), zoom: this.renderer.zoom };
        this.dragging = true;
      }
    }

    onMove(e) {
      const p = this.local(e);
      const ptr = this.pointers.get(e.pointerId);
      if (!ptr) {
        if (e.pointerType === 'mouse') this.setHover(this.renderer.pick(p.x, p.y), p);
        return;
      }
      const dx = p.x - ptr.x, dy = p.y - ptr.y;
      ptr.x = p.x;
      ptr.y = p.y;
      if (this.pointers.size === 2 && this.pinch) {
        const [a, b] = Array.from(this.pointers.values());
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        this.renderer.setZoom(this.pinch.zoom * (d / Math.max(1, this.pinch.dist)), (a.x + b.x) / 2, (a.y + b.y) / 2);
        return;
      }
      if (!this.dragging && Math.hypot(p.x - ptr.sx, p.y - ptr.sy) > 7) {
        this.dragging = true;
        this.canvas.classList.add('grab');
        this.setHover(null);
      }
      if (this.dragging) this.renderer.panBy(dx, dy);
    }

    onUp(e) {
      const ptr = this.pointers.get(e.pointerId);
      this.pointers.delete(e.pointerId);
      if (this.pointers.size < 2) this.pinch = null;
      if (!ptr) return;
      if (!this.dragging && this.pointers.size === 0) {
        const p = this.local(e);
        this.click(this.renderer.pick(p.x, p.y), p);
      }
      if (this.pointers.size === 0) {
        this.dragging = false;
        this.canvas.classList.remove('grab');
      }
    }

    onCancel(e) {
      this.pointers.delete(e.pointerId);
      if (this.pointers.size === 0) { this.dragging = false; this.pinch = null; this.canvas.classList.remove('grab'); }
    }

    onWheel(e) {
      e.preventDefault();
      const p = this.local(e);
      const factor = Math.exp(-e.deltaY * 0.0015);
      this.renderer.setZoom(this.renderer.zoom * factor, p.x, p.y);
    }

    setHover(h, p) {
      this.renderer.hover = h;
      this.canvas.classList.toggle('pointer', !!h);
      this.ui.showTooltip(h, p ? p.x : 0, p ? p.y : 0);
    }

    click(h, p) {
      const g = this.game;
      const ui = this.ui;
      if (ui.modalOpen) return;
      if (!h) { ui.closeInspect(); return; }
      const w = this.renderer.screenToWorld(p.x, p.y);
      switch (h.type) {
        case 'register': {
          const r = h.ref;
          if (r.open && r.queue.length) {
            g.actionCheckout(r.index);
            g.effects.ring(w.x, w.y, 'rgba(255,207,51,');
          } else {
            ui.select(h);
            if (r.open) g.actionCheckout(r.index);
          }
          break;
        }
        case 'shelf': {
          const slot = h.ref;
          const inv = g.store.inventory;
          if (slot.productId && slot.stock < inv.shelfCapacity && inv.qty(slot.productId) > 0) g.actionRestock(slot.index);
          ui.select(h);
          break;
        }
        case 'slot':
          ui.select(h);
          break;
        case 'truck':
          if (h.ref.state === 'docked' && h.ref.hasCargo()) g.actionUnload();
          else ui.select(h);
          break;
        case 'dirt':
          g.actionClean(h.ref.id);
          break;
        case 'customer':
          // Tapping the shopper standing at the till means "check them out".
          if ((h.ref.state === 'atCounter' || h.ref.state === 'paying') && h.ref.register && h.ref.register.open) {
            g.actionCheckout(h.ref.register.index);
            g.effects.ring(w.x, w.y, 'rgba(255,207,51,');
          } else {
            ui.select(h);
          }
          break;
        case 'employee':
          ui.select(h);
          break;
        case 'lot':
          ui.openModal(MS.Panels.expansionModal(g));
          break;
        case 'warehouse':
          ui.setTab('stock', true);
          ui.toast('📦 Bestel hier nieuwe voorraad voor je magazijn.', 'info');
          break;
      }
      ui.refreshNow();
    }

    onKey(e) {
      const tag = (e.target && e.target.tagName) || '';
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      const ui = this.ui;
      const g = this.game;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        g.save(true);
        return;
      }
      if (e.key === 'Escape') {
        if (ui.modalOpen) ui.closeModal();
        else ui.closeInspect();
        return;
      }
      if (ui.modalOpen || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === ' ' && !(e.target && e.target.closest && e.target.closest('button'))) {
        e.preventDefault();
        ui.setSpeed(g.paused ? g.settings.speed || 1 : 0);
      } else if (e.key === '1' || e.key === '2' || e.key === '3') {
        ui.setSpeed(+e.key);
      } else if (e.key === '+' || e.key === '=') {
        this.renderer.setZoom(this.renderer.zoom * 1.25);
      } else if (e.key === '-') {
        this.renderer.setZoom(this.renderer.zoom / 1.25);
      } else if (e.key === '0') {
        this.renderer.resetView();
      }
    }
  }

  MS.Input = Input;
})((window.MS = window.MS || {}));
