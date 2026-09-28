/* Sprites: canvas drawing helpers for everything in the world — emoji
 * (cached as bitmaps), people, shelves per fixture type, checkouts and the
 * delivery truck. All coordinates are world pixels (1 tile = 40). */
(function (MS) {
  'use strict';

  const U = MS.U;
  const EMOJI_FONT = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji","Twemoji Mozilla",sans-serif';
  const TEXT_FONT = '"Fredoka","Nunito",ui-rounded,"Segoe UI",system-ui,sans-serif';

  const emojiCache = new Map();
  function emojiBitmap(ch) {
    let c = emojiCache.get(ch);
    if (c) return c;
    const S = 72;
    c = document.createElement('canvas');
    c.width = c.height = S;
    const x = c.getContext('2d');
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.font = `${Math.round(S * 0.8)}px ${EMOJI_FONT}`;
    x.fillText(ch, S / 2, S / 2 + S * 0.05);
    emojiCache.set(ch, c);
    return c;
  }

  const segmenter = typeof Intl !== 'undefined' && Intl.Segmenter ? new Intl.Segmenter('nl', { granularity: 'grapheme' }) : null;
  const graphemes = (str) => (segmenter ? Array.from(segmenter.segment(str), (s) => s.segment) : Array.from(str));

  const S = {
    TEXT_FONT,
    graphemes,

    emoji(ctx, ch, x, y, size) {
      ctx.drawImage(emojiBitmap(ch), x - size / 2, y - size / 2, size, size);
    },

    roundRect(ctx, x, y, w, h, r) {
      r = Math.min(r, w / 2, h / 2);
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
    },

    fillRound(ctx, x, y, w, h, r, color) {
      S.roundRect(ctx, x, y, w, h, r);
      ctx.fillStyle = color;
      ctx.fill();
    },

    ellipse(ctx, x, y, rx, ry, color) {
      ctx.beginPath();
      ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
    },

    outlinedText(ctx, text, x, y, size, color, bold) {
      ctx.font = `${bold ? 700 : 600} ${size}px ${TEXT_FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineJoin = 'round';
      ctx.lineWidth = Math.max(2, size * 0.28);
      ctx.strokeStyle = 'rgba(255,255,255,0.95)';
      ctx.strokeText(text, x, y);
      ctx.fillStyle = color;
      ctx.fillText(text, x, y);
    },

    shade(hex, amt) {
      const n = parseInt(hex.slice(1), 16);
      let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
      const f = (v) => U.clamp(Math.round(amt < 0 ? v * (1 + amt) : v + (255 - v) * amt), 0, 255);
      r = f(r); g = f(g); b = f(b);
      return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
    },

    /** Speech/thought bubble with emoji icons; optional progress bar under it. */
    bubble(ctx, x, y, icons, opts = {}) {
      const size = opts.size || 15;
      const list = Array.isArray(icons) ? icons : graphemes(icons);
      const w = Math.max(size + 10, list.length * (size + 2) + 8);
      const h = size + 9 + (opts.bar != null ? 5 : 0);
      const bx = x - w / 2, by = y - h;
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.18)';
      ctx.shadowBlur = 4;
      ctx.shadowOffsetY = 1;
      S.fillRound(ctx, bx, by, w, h, 8, opts.bg || '#ffffff');
      ctx.restore();
      ctx.beginPath();
      ctx.moveTo(x - 4, by + h - 0.5);
      ctx.lineTo(x, by + h + 5);
      ctx.lineTo(x + 4, by + h - 0.5);
      ctx.fillStyle = opts.bg || '#ffffff';
      ctx.fill();
      list.forEach((ic, i) => S.emoji(ctx, ic, bx + 4 + (size + 2) * i + (size + 2) / 2, by + 4 + size / 2, size));
      if (opts.bar != null) {
        const k = U.clamp(opts.bar, 0, 1);
        S.fillRound(ctx, bx + 4, by + h - 6, w - 8, 3, 1.5, 'rgba(0,0,0,0.12)');
        S.fillRound(ctx, bx + 4, by + h - 6, (w - 8) * k, 3, 1.5, k > 0.5 ? '#39b37a' : k > 0.25 ? '#f2a33a' : '#e5484d');
      }
    },

    // ---- People -------------------------------------------------------------------------------
    person(ctx, p, t, opts = {}) {
      const look = p.look;
      const x = p.x, y = p.y;
      const moving = p.moving && !opts.reduced;
      const bob = moving ? -Math.abs(Math.sin(p.phase)) * 2.2 : 0;
      const f = p.facing || 1;
      const legA = moving ? Math.sin(p.phase) * 1.8 : 0;

      S.ellipse(ctx, x, y + 1, 9.5, 3.6, 'rgba(0,0,0,0.18)');

      // Legs
      const pants = opts.staff ? '#3b4252' : S.shade(look.shirt, -0.55);
      S.fillRound(ctx, x - 5.5, y - 10 + legA, 4.6, 10 - legA, 2.2, pants);
      S.fillRound(ctx, x + 0.9, y - 10 - legA, 4.6, 10 + legA, 2.2, pants);
      S.fillRound(ctx, x - 6, y - 2 + legA * 0.6, 5.4, 3, 1.5, '#2b2b2b');
      S.fillRound(ctx, x + 0.6, y - 2 - legA * 0.6, 5.4, 3, 1.5, '#2b2b2b');

      // Arms (behind the body)
      const armSwing = moving ? Math.sin(p.phase) * 2.5 : 0;
      S.fillRound(ctx, x - 11, y - 22 + bob + armSwing, 5, 11, 2.5, S.shade(look.shirt, -0.12));
      S.fillRound(ctx, x + 6, y - 22 + bob - armSwing, 5, 11, 2.5, S.shade(look.shirt, -0.12));
      S.ellipse(ctx, x - 8.5, y - 11 + bob + armSwing, 2.6, 2.6, look.skin);
      S.ellipse(ctx, x + 8.5, y - 11 + bob - armSwing, 2.6, 2.6, look.skin);

      // Body
      S.fillRound(ctx, x - 8.5, y - 25 + bob, 17, 16, 6, look.shirt);
      S.fillRound(ctx, x - 8.5, y - 14 + bob, 17, 5, 3, S.shade(look.shirt, -0.18));
      if (opts.staff) {
        S.fillRound(ctx, x - 6, y - 21 + bob, 12, 12, 3, opts.apron || '#ffffff');
        S.fillRound(ctx, x - 3, y - 16 + bob, 6, 3.5, 1.5, 'rgba(0,0,0,0.12)');
      }

      // Head
      const hy = y - 31 + bob;
      S.ellipse(ctx, x, hy, 8.6, 8.4, look.skin);
      ctx.fillStyle = look.hair;
      ctx.beginPath();
      switch (look.hairStyle) {
        case 0: ctx.arc(x, hy - 1, 8.9, Math.PI * 1.02, Math.PI * 1.98); ctx.fill(); break;
        case 1:
          ctx.arc(x, hy - 1, 9.2, Math.PI * 0.95, Math.PI * 2.05); ctx.fill();
          S.fillRound(ctx, x - 9.5, hy - 2, 4, 10, 2, look.hair);
          S.fillRound(ctx, x + 5.5, hy - 2, 4, 10, 2, look.hair);
          break;
        case 2:
          ctx.arc(x, hy - 1, 8.9, Math.PI * 1.02, Math.PI * 1.98); ctx.fill();
          S.ellipse(ctx, x, hy - 10, 4.2, 3.6, look.hair);
          break;
        default:
          ctx.arc(x, hy - 1.5, 8.7, Math.PI * 1.05, Math.PI * 1.95); ctx.fill();
          for (let i = -2; i <= 2; i++) S.ellipse(ctx, x + i * 3.2, hy - 8.2, 2.2, 2.4, look.hair);
      }

      // Face
      const ex = f * 1.4;
      ctx.fillStyle = '#2a211b';
      S.ellipse(ctx, x - 3 + ex, hy + 0.5, 1.2, 1.5, '#2a211b');
      S.ellipse(ctx, x + 3 + ex, hy + 0.5, 1.2, 1.5, '#2a211b');
      S.ellipse(ctx, x - 5 + ex, hy + 3, 1.7, 1.1, 'rgba(255,120,120,0.35)');
      S.ellipse(ctx, x + 5 + ex, hy + 3, 1.7, 1.1, 'rgba(255,120,120,0.35)');
      ctx.strokeStyle = '#6b3d2e';
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      const mood = opts.mood == null ? 80 : opts.mood;
      if (mood >= 55) ctx.arc(x + ex, hy + 3, 2.2, 0.15 * Math.PI, 0.85 * Math.PI);
      else if (mood >= 30) { ctx.moveTo(x - 2 + ex, hy + 4.2); ctx.lineTo(x + 2 + ex, hy + 4.2); }
      else ctx.arc(x + ex, hy + 6, 2.2, 1.15 * Math.PI, 1.85 * Math.PI);
      ctx.stroke();
      if (look.glasses) {
        ctx.strokeStyle = '#222';
        ctx.lineWidth = 0.9;
        ctx.beginPath();
        ctx.arc(x - 3 + ex, hy + 0.5, 2.4, 0, Math.PI * 2);
        ctx.moveTo(x + 5.4 + ex, hy + 0.5);
        ctx.arc(x + 3 + ex, hy + 0.5, 2.4, 0, Math.PI * 2);
        ctx.stroke();
      }
      if (look.hat) {
        S.fillRound(ctx, x - 9.5, hy - 8.5, 19, 3, 1.5, '#1d1d24');
        S.fillRound(ctx, x - 6, hy - 19, 12, 11.5, 2, '#1d1d24');
        ctx.fillStyle = '#c0392b';
        ctx.fillRect(x - 6, hy - 11, 12, 2.2);
      }
      if (opts.staff) {
        // Cap in the store colour
        ctx.fillStyle = opts.apron || '#e2557a';
        ctx.beginPath();
        ctx.arc(x, hy - 2.5, 8.7, Math.PI * 1.08, Math.PI * 1.92);
        ctx.fill();
        S.fillRound(ctx, x + (f > 0 ? 2 : -10), hy - 5, 8, 2.6, 1.3, S.shade(opts.apron || '#e2557a', -0.2));
      }
      if (opts.badge) S.emoji(ctx, opts.badge, x + 9, hy - 9, 10);
    },

    basket(ctx, p, items, reduced) {
      const f = p.facing || 1;
      const bx = p.x + f * 10, by = p.y - 12 + (p.moving && !reduced ? -Math.abs(Math.sin(p.phase)) * 2 : 0);
      ctx.strokeStyle = '#8a5a2b';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(bx, by - 2, 4.5, Math.PI, 0);
      ctx.stroke();
      items.slice(0, 2).forEach((e, i) => S.emoji(ctx, e, bx - 2.5 + i * 5, by - 1, 7));
      S.fillRound(ctx, bx - 5.5, by - 1, 11, 6.5, 2, '#c98a4b');
      ctx.fillStyle = 'rgba(0,0,0,0.12)';
      ctx.fillRect(bx - 5.5, by + 2, 11, 1);
    },

    cart(ctx, p, items) {
      const f = p.facing || 1;
      const cx = p.x + f * 17, cy = p.y - 5;
      S.ellipse(ctx, cx, cy + 5, 11, 3, 'rgba(0,0,0,0.14)');
      // wheels
      S.ellipse(ctx, cx - 7, cy + 4, 2, 2, '#333');
      S.ellipse(ctx, cx + 7, cy + 4, 2, 2, '#333');
      // basket
      S.fillRound(ctx, cx - 11, cy - 13, 22, 14, 3, '#c9d2dc');
      ctx.strokeStyle = '#8795a3';
      ctx.lineWidth = 1;
      for (let i = -7; i <= 7; i += 4.5) { ctx.beginPath(); ctx.moveTo(cx + i, cy - 12); ctx.lineTo(cx + i, cy); ctx.stroke(); }
      items.slice(0, 4).forEach((e, i) => S.emoji(ctx, e, cx - 7.5 + i * 5, cy - 13 + (i % 2) * 2, 9));
      S.fillRound(ctx, cx - 11, cy - 13, 22, 3, 1.5, '#e2557a');
      // handle
      ctx.strokeStyle = '#6d7a88';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx - f * 11, cy - 12);
      ctx.lineTo(cx - f * 15, cy - 16);
      ctx.stroke();
    },

    // ---- Shelves --------------------------------------------------------------------------------
    /** Draws a shelf unit (2 tiles wide) for a product; `fill` is 0..1. */
    shelf(ctx, X, Y, T, product, fill, theme, t, opts = {}) {
      const W = 2 * T;
      const fixture = product ? product.fixture : 'shelf';
      const icon = product ? product.emoji : null;
      const count = product ? Math.ceil(U.clamp(fill, 0, 1) * 8) : 0;
      S.ellipse(ctx, X + W / 2, Y + T - 3, W / 2 - 2, 6, 'rgba(0,0,0,0.13)');
      const icons = (positions, size) => {
        for (let i = 0; i < Math.min(count, positions.length); i++) S.emoji(ctx, icon, positions[i][0], positions[i][1], size);
      };
      const grid = (x0, y0, cols, rows, dx, dy) => {
        const out = [];
        for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) out.push([x0 + c * dx + (r % 2) * 2, y0 + r * dy]);
        return out;
      };

      switch (fixture) {
        case 'crate': {
          for (let i = 0; i < 2; i++) {
            const cx = X + 3 + i * (T - 1);
            S.fillRound(ctx, cx, Y - 10, T - 4, 22, 3, '#b77a3e');
            S.fillRound(ctx, cx + 2, Y - 8, T - 8, 18, 2, '#8c5a2b');
            S.fillRound(ctx, cx, Y + 12, T - 4, 24, 3, '#c98a4b');
            ctx.fillStyle = 'rgba(0,0,0,0.12)';
            for (let s = 0; s < 3; s++) ctx.fillRect(cx + 2, Y + 17 + s * 6.5, T - 8, 1.2);
          }
          icons([...grid(X + 11, Y - 2, 2, 2, 11, 8), ...grid(X + T + 10, Y - 2, 2, 2, 11, 8)], 13);
          break;
        }
        case 'fridge': {
          S.fillRound(ctx, X + 2, Y - 18, W - 4, T + 14, 5, '#f4f7fb');
          S.fillRound(ctx, X + 2, Y - 18, W - 4, 8, 4, '#dfe6ee');
          S.fillRound(ctx, X + 5, Y - 7, W - 10, T - 1, 3, '#7fbfe6');
          ctx.fillStyle = 'rgba(255,255,255,0.8)';
          ctx.fillRect(X + 6, Y - 6, W - 12, 2);
          ctx.fillStyle = 'rgba(255,255,255,0.55)';
          ctx.fillRect(X + 5, Y + 7, W - 10, 1.4);
          ctx.fillRect(X + 5, Y + 20, W - 10, 1.4);
          icons(grid(X + 13, Y + 1, 4, 2, 17.5, 13), 12);
          ctx.fillStyle = 'rgba(255,255,255,0.35)';
          ctx.beginPath();
          ctx.moveTo(X + 12, Y - 7); ctx.lineTo(X + 22, Y - 7); ctx.lineTo(X + 10, Y + T - 8); ctx.lineTo(X + 5, Y + T - 8);
          ctx.fill();
          ctx.fillStyle = '#b8c2cc';
          ctx.fillRect(X + W / 2 - 1, Y - 7, 2, T - 1);
          break;
        }
        case 'freezer': {
          S.fillRound(ctx, X + 2, Y - 6, W - 4, T + 2, 6, '#f8fbff');
          S.fillRound(ctx, X + 5, Y - 3, W - 10, 22, 4, '#8fd3f0');
          ctx.fillStyle = 'rgba(255,255,255,0.6)';
          for (let i = 0; i < 5; i++) ctx.fillRect(X + 10 + i * 14, Y - 1 + (i % 2) * 6, 6, 1.4);
          icons(grid(X + 13, Y + 3, 4, 2, 17.5, 9), 12);
          ctx.fillStyle = 'rgba(255,255,255,0.35)';
          ctx.fillRect(X + 5, Y - 3, W - 10, 5);
          S.fillRound(ctx, X + 2, Y + 21, W - 4, 13, 4, '#e8eff7');
          ctx.fillStyle = '#4f8cff';
          ctx.fillRect(X + 2, Y + 26, W - 4, 3);
          break;
        }
        case 'rack': {
          S.fillRound(ctx, X + 2, Y - 16, W - 4, T + 12, 4, '#a0683a');
          S.fillRound(ctx, X + 5, Y - 13, W - 10, T + 6, 3, '#6e4424');
          for (let r = 0; r < 2; r++) {
            S.fillRound(ctx, X + 6, Y - 6 + r * 17, W - 12, 11, 4, '#d9a066');
            ctx.fillStyle = 'rgba(120,70,20,0.35)';
            for (let i = 0; i < 6; i++) ctx.fillRect(X + 10 + i * 11.5, Y - 5 + r * 17, 1.2, 9);
          }
          icons(grid(X + 13, Y - 6, 4, 2, 17.5, 17), 13);
          break;
        }
        case 'counter': {
          S.fillRound(ctx, X + 2, Y - 10, W - 4, T + 6, 6, '#7b3f3a');
          S.fillRound(ctx, X + 4, Y - 8, W - 8, 24, 4, '#dff4ff');
          ctx.fillStyle = 'rgba(255,255,255,0.9)';
          for (let i = 0; i < 9; i++) S.ellipse(ctx, X + 9 + i * 8, Y + 11 - (i % 3) * 2, 3, 1.5, '#ffffff');
          icons(grid(X + 13, Y - 2, 4, 2, 17.5, 9), 12);
          ctx.fillStyle = 'rgba(255,255,255,0.3)';
          ctx.fillRect(X + 4, Y - 8, W - 8, 6);
          ctx.fillStyle = S.shade('#7b3f3a', -0.25);
          ctx.fillRect(X + 2, Y + 20, W - 4, 3);
          break;
        }
        default: {
          const frame = theme.night ? '#5b6378' : '#dfe3e8';
          S.fillRound(ctx, X + 2, Y - 16, W - 4, T + 12, 4, frame);
          S.fillRound(ctx, X + 4, Y - 14, W - 8, T + 6, 3, theme.night ? '#3d4456' : '#f5f7fa');
          ctx.fillStyle = S.shade(frame, -0.2);
          ctx.fillRect(X + 4, Y - 1, W - 8, 2.4);
          ctx.fillRect(X + 4, Y + 14, W - 8, 2.4);
          icons(grid(X + 13, Y - 7, 4, 2, 17.5, 15), 13);
        }
      }

      // Price rail with a fill bar and rarity gem.
      if (product) {
        const barY = Y + T - 8;
        S.fillRound(ctx, X + 6, barY, W - 12, 5, 2.5, 'rgba(0,0,0,0.18)');
        const k = U.clamp(fill, 0, 1);
        S.fillRound(ctx, X + 6, barY, Math.max(3, (W - 12) * k), 5, 2.5, k > 0.5 ? '#39b37a' : k > 0.25 ? '#f2a33a' : '#e5484d');
        if (product.rarity !== 'common') {
          const c = product.rarityInfo.color;
          S.ellipse(ctx, X + W - 8, Y - 12, 4.5, 4.5, '#fff');
          S.ellipse(ctx, X + W - 8, Y - 12, 3.2, 3.2, c);
          if (product.rarity === 'legendary' && !opts.reduced) {
            const a = (Math.sin(t * 3) + 1) / 2;
            ctx.save();
            ctx.globalAlpha = 0.25 + a * 0.35;
            ctx.strokeStyle = '#ffd24a';
            ctx.lineWidth = 2.5;
            S.roundRect(ctx, X, Y - 19, W, T + 18, 7);
            ctx.stroke();
            ctx.restore();
          }
        }
      } else {
        S.emoji(ctx, '❔', X + W / 2, Y + 4, 16);
      }
    },

    // ---- Checkout counter ----------------------------------------------------------------------------
    register(ctx, reg, T, theme, t, customerItems) {
      const c = reg.def.counter;
      const X = c.x * T + 5, Y = c.y0 * T - 6, W = T - 10, H = (c.y1 - c.y0 + 1) * T;
      S.ellipse(ctx, X + W / 2, Y + H - 2, W / 2 + 4, 6, 'rgba(0,0,0,0.15)');
      S.fillRound(ctx, X - 2, Y, W + 4, H, 6, S.shade(theme.accent, -0.35));
      S.fillRound(ctx, X, Y + 1, W, H - 8, 5, theme.night ? '#50586b' : '#e8ecf1');
      // conveyor belt
      S.fillRound(ctx, X + 4, Y + 4, W - 8, H * 0.55, 3, '#3b3f47');
      const off = reg.scanning ? (t * 40) % 8 : 0;
      ctx.fillStyle = 'rgba(255,255,255,0.10)';
      for (let yy = Y + 6 + off; yy < Y + 4 + H * 0.55 - 2; yy += 8) ctx.fillRect(X + 5, yy, W - 10, 2);
      if (reg.scanning && customerItems.length) {
        const left = Math.max(0, reg.units - reg.scanned);
        customerItems.slice(0, Math.min(3, left)).forEach((e, i) => S.emoji(ctx, e, X + W / 2, Y + 12 + i * 11, 11));
      }
      // till
      S.fillRound(ctx, X + 3, Y + H * 0.62, W - 6, 16, 3, '#2d3139');
      S.fillRound(ctx, X + 6, Y + H * 0.62 + 3, W - 12, 8, 2, reg.scanning ? (reg.flash > 0 ? '#b6ffcf' : '#5fe39a') : '#7a8494');
      // scanner glass
      ctx.fillStyle = reg.flash > 0 ? 'rgba(255,60,60,0.9)' : 'rgba(255,60,60,0.35)';
      ctx.fillRect(X + 5, Y + H * 0.55 + 2, W - 10, 2);
      if (reg.scanning && reg.scanned > 0) S.emoji(ctx, '🛍️', X + W / 2, Y + H - 14, 13);
      // lane number sign
      const sx = X + W / 2, sy = Y - 10;
      ctx.fillStyle = '#9aa3ad';
      ctx.fillRect(sx - 1, sy, 2, 10);
      S.ellipse(ctx, sx, sy, 8, 8, reg.open ? '#39b37a' : '#b0b6be');
      ctx.font = `700 10px ${TEXT_FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#fff';
      ctx.fillText(String(reg.index + 1), sx, sy + 0.5);
    },

    // ---- Delivery truck --------------------------------------------------------------------------------
    truck(ctx, tr, T, theme, storeIcon) {
      const x = tr.x, y = tr.y;
      const bounce = Math.sin(tr.bounce * 12) * tr.bounce * 2;
      const boxW = 3.1 * T, boxH = 56, cabW = 1.25 * T;
      S.ellipse(ctx, x + (boxW + cabW) / 2, y + 2, (boxW + cabW) / 2 + 4, 7, 'rgba(0,0,0,0.22)');
      ctx.save();
      ctx.translate(0, bounce);
      // cargo box
      S.fillRound(ctx, x, y - 12 - boxH, boxW, boxH, 7, '#ffffff');
      S.fillRound(ctx, x, y - 12 - boxH, boxW, 9, 5, '#eef1f5');
      ctx.fillStyle = theme.accent;
      ctx.fillRect(x, y - 34, boxW, 7);
      S.emoji(ctx, storeIcon, x + 20, y - 12 - boxH / 2 - 6, 24);
      ctx.font = `700 13px ${TEXT_FONT}`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = S.shade(theme.accent, -0.2);
      ctx.fillText('VERS!', x + 36, y - 12 - boxH / 2 - 6);
      if (tr.state === 'docked') {
        // open side door with boxes inside
        S.fillRound(ctx, x + boxW - 44, y - 12 - boxH + 12, 36, boxH - 16, 3, '#4a3b2c');
        const units = tr.cargoUnits();
        const shown = Math.min(6, Math.ceil(units / 12));
        for (let i = 0; i < shown; i++) S.emoji(ctx, '📦', x + boxW - 35 + (i % 2) * 16, y - 12 - boxH + 22 + Math.floor(i / 2) * 11, 14);
      }
      // cab
      S.fillRound(ctx, x + boxW + 2, y - 12 - 42, cabW, 42, 9, theme.accent);
      S.fillRound(ctx, x + boxW + 12, y - 12 - 38, cabW - 16, 17, 5, '#bfe6ff');
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.fillRect(x + boxW + 15, y - 48, 5, 13);
      S.fillRound(ctx, x + boxW + cabW - 5, y - 26, 6, 5, 2, '#ffe28a');
      ctx.restore();
      // wheels
      const rot = x / 9;
      for (const wx of [x + 0.55 * T, x + 2.45 * T, x + boxW + cabW * 0.62]) {
        S.ellipse(ctx, wx, y - 8, 9, 9, '#23262d');
        S.ellipse(ctx, wx, y - 8, 4.2, 4.2, '#c7ccd4');
        ctx.strokeStyle = '#8a9099';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(wx + Math.cos(rot) * 4, y - 8 + Math.sin(rot) * 4);
        ctx.lineTo(wx - Math.cos(rot) * 4, y - 8 - Math.sin(rot) * 4);
        ctx.stroke();
      }
    },
  };

  MS.Sprites = S;
})((window.MS = window.MS || {}));
