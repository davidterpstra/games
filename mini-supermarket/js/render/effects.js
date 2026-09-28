/* Effects: short-lived world-space feedback — floating "+€12,50" texts,
 * coins, sparkles, dust, confetti and products flying into baskets.
 * With prefers-reduced-motion everything is calmer: fewer particles and
 * texts that fade in place instead of flying. */
(function (MS) {
  'use strict';

  const U = MS.U;

  class Effects {
    constructor(game) {
      this.game = game;
      this.floaters = [];
      this.particles = [];
      this.flyers = [];
      this.rings = [];
      this.reduced = U.prefersReducedMotion();
      if (window.matchMedia) {
        const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
        const onChange = () => { this.reduced = mq.matches; };
        if (mq.addEventListener) mq.addEventListener('change', onChange);
      }
    }

    clear() {
      this.floaters.length = 0;
      this.particles.length = 0;
      this.flyers.length = 0;
      this.rings.length = 0;
    }

    count(n) { return this.reduced ? Math.max(1, Math.round(n * 0.3)) : n; }

    floatText(x, y, text, opts = {}) {
      if (this.floaters.length > 40) this.floaters.shift();
      this.floaters.push({ x, y, text, color: opts.color || '#222', size: opts.size || 13, t: 0, dur: opts.dur || 1.3, bold: !!opts.bold });
    }

    burst(x, y, n, make) {
      n = this.count(n);
      for (let i = 0; i < n; i++) this.particles.push(make(i, n));
      if (this.particles.length > 400) this.particles.splice(0, this.particles.length - 400);
    }

    coins(x, y, n) {
      this.burst(x, y, n, () => ({
        x, y, vx: U.rand(-60, 60), vy: U.rand(-150, -90), g: 320, t: 0, life: U.rand(0.7, 1),
        color: '#ffc93c', size: U.rand(4, 6), shape: 'coin', rot: 0, vr: U.rand(-8, 8),
      }));
    }

    sparkle(x, y, n, colors) {
      colors = colors || ['#ffe066', '#ffffff', '#ffb3c7', '#9be7ff'];
      this.burst(x, y, n, () => {
        const a = Math.random() * Math.PI * 2, s = U.rand(30, 110);
        return {
          x: x + U.rand(-10, 10), y: y + U.rand(-6, 6), vx: Math.cos(a) * s, vy: Math.sin(a) * s - 30, g: 40,
          t: 0, life: U.rand(0.5, 0.9), color: U.pick(colors), size: U.rand(3, 6), shape: 'star', rot: Math.random() * 3, vr: U.rand(-4, 4),
        };
      });
    }

    dust(x, y, n) {
      this.burst(x, y, n, () => ({
        x: x + U.rand(-40, 40), y: y + U.rand(-8, 8), vx: U.rand(-40, 40), vy: U.rand(-40, -10), g: -10,
        t: 0, life: U.rand(0.6, 1.2), color: U.pick(['#c9b79c', '#b8a283', '#ddd0bb']), size: U.rand(6, 13), shape: 'dust', rot: 0, vr: 0,
      }));
    }

    confetti(x, y, n, spread = 160) {
      this.burst(x, y, n, () => ({
        x: x + U.rand(-spread, spread), y: y + U.rand(-30, 10), vx: U.rand(-50, 50), vy: U.rand(-220, -80), g: 260,
        t: 0, life: U.rand(1.2, 2), color: U.pick(['#e2557a', '#ffcf33', '#39b37a', '#4f8cff', '#9b51e0', '#ff8a3d']),
        size: U.rand(4, 7), shape: 'square', rot: Math.random() * 6, vr: U.rand(-10, 10),
      }));
    }

    productFly(store, slot, customer, product, n) {
      if (this.reduced) return;
      const T = MS.Layout.TILE;
      const s = MS.Layout.SLOT_SPOTS[slot.index];
      for (let i = 0; i < Math.min(n, 3); i++) {
        this.flyers.push({
          x0: (s.x + 1) * T + U.rand(-14, 14), y0: s.y * T + 8, target: customer, x1: 0, y1: 0,
          t: -i * 0.12, dur: 0.45, emoji: product.emoji, size: 14, arc: 26,
        });
      }
    }

    boxes(x0, y0, x1, y1, n) {
      if (this.reduced) return;
      for (let i = 0; i < n; i++) {
        this.flyers.push({ x0: x0 + U.rand(-20, 20), y0, x1: x1 + U.rand(-30, 30), y1, t: -i * 0.09, dur: 0.55, emoji: '📦', size: 16, arc: 40 });
      }
    }

    scanBlip(x, y) {
      this.rings.push({ x, y: y + 12, t: 0, dur: 0.3, r: 14, color: 'rgba(255,80,80,' });
    }

    ring(x, y, color = 'rgba(255,255,255,') {
      this.rings.push({ x, y, t: 0, dur: 0.45, r: 26, color });
    }

    update(dt) {
      for (const f of this.floaters) f.t += dt;
      this.floaters = this.floaters.filter((f) => f.t < f.dur);
      for (const p of this.particles) {
        p.t += dt;
        p.vy += p.g * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.rot += p.vr * dt;
      }
      this.particles = this.particles.filter((p) => p.t < p.life);
      for (const f of this.flyers) f.t += dt;
      this.flyers = this.flyers.filter((f) => f.t < f.dur);
      for (const r of this.rings) r.t += dt;
      this.rings = this.rings.filter((r) => r.t < r.dur);
    }

    draw(ctx, sprites) {
      for (const r of this.rings) {
        const k = r.t / r.dur;
        ctx.strokeStyle = r.color + (1 - k).toFixed(2) + ')';
        ctx.lineWidth = 3 * (1 - k) + 1;
        ctx.beginPath();
        ctx.arc(r.x, r.y, r.r * (0.4 + k), 0, Math.PI * 2);
        ctx.stroke();
      }

      for (const p of this.particles) {
        const k = p.t / p.life;
        ctx.globalAlpha = Math.max(0, 1 - k * k);
        ctx.fillStyle = p.color;
        if (p.shape === 'coin') {
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.scale(Math.abs(Math.cos(p.rot)) * 0.8 + 0.2, 1);
          ctx.beginPath();
          ctx.arc(0, 0, p.size, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#e0a100';
          ctx.lineWidth = 1.2;
          ctx.stroke();
          ctx.restore();
        } else if (p.shape === 'star') {
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          const s = p.size * (1 - k * 0.5);
          ctx.beginPath();
          for (let i = 0; i < 4; i++) {
            ctx.rotate(Math.PI / 2);
            ctx.moveTo(0, 0);
            ctx.quadraticCurveTo(s * 0.25, s * 0.25, s, 0);
            ctx.quadraticCurveTo(s * 0.25, -s * 0.25, 0, 0);
          }
          ctx.fill();
          ctx.restore();
        } else if (p.shape === 'dust') {
          ctx.globalAlpha *= 0.6;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * (0.6 + k), 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          ctx.fillRect(-p.size / 2, -p.size / 3, p.size, p.size * 0.66);
          ctx.restore();
        }
      }
      ctx.globalAlpha = 1;

      for (const f of this.flyers) {
        if (f.t < 0) continue;
        const k = U.clamp(f.t / f.dur, 0, 1);
        const x1 = f.target ? f.target.x : f.x1;
        const y1 = f.target ? f.target.y - 22 : f.y1;
        const e = U.ease.inOutCubic(k);
        const x = U.lerp(f.x0, x1, e);
        const y = U.lerp(f.y0, y1, e) - Math.sin(k * Math.PI) * f.arc;
        sprites.emoji(ctx, f.emoji, x, y, f.size * (1 - k * 0.3));
      }

      for (const f of this.floaters) {
        const k = f.t / f.dur;
        const rise = this.reduced ? 0 : U.ease.outCubic(Math.min(1, k * 1.4)) * 26;
        const pop = this.reduced ? 1 : Math.min(1, U.ease.outBack(Math.min(1, f.t / 0.22)));
        ctx.globalAlpha = k > 0.7 ? (1 - k) / 0.3 : 1;
        sprites.outlinedText(ctx, f.text, f.x, f.y - rise, f.size * pop, f.color, f.bold);
      }
      ctx.globalAlpha = 1;
    }
  }

  MS.Effects = Effects;
})((window.MS = window.MS || {}));
