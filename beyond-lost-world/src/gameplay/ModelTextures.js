// Procedural canvas textures for item and document models (all cached, all <= 512 px).
import * as THREE from 'three';
import { mulberry32 } from '../world/layout.js';

const cache = new Map();

function canvasTexture(key, w, h, draw, { repeat = null, color = true, anisotropy = 4 } = {}) {
  if (cache.has(key)) return cache.get(key);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  draw(ctx, w, h, mulberry32(key.split('').reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) >>> 0, 7)));
  const t = new THREE.CanvasTexture(c);
  if (color) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = anisotropy;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  cache.set(key, t);
  return t;
}

function speckle(ctx, w, h, rng, n, colors, size = 2, alpha = 0.5) {
  for (let i = 0; i < n; i++) {
    ctx.globalAlpha = alpha * rng();
    ctx.fillStyle = colors[(rng() * colors.length) | 0];
    const s = 0.5 + rng() * size;
    ctx.fillRect(rng() * w, rng() * h, s, s);
  }
  ctx.globalAlpha = 1;
}

/** Long dark/light vertical streaks: tree bark (streaks run along v). */
export function barkTexture() {
  return canvasTexture('bark', 256, 256, (ctx, w, h, rng) => {
    ctx.fillStyle = '#5a4128'; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 220; i++) {
      const x = rng() * w, len = 40 + rng() * 200, y = rng() * h;
      ctx.strokeStyle = rng() < 0.5 ? `rgba(30,20,12,${0.2 + rng() * 0.5})` : `rgba(140,108,72,${0.15 + rng() * 0.35})`;
      ctx.lineWidth = 1 + rng() * 3;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.bezierCurveTo(x + (rng() - 0.5) * 8, y + len * 0.3, x + (rng() - 0.5) * 8, y + len * 0.7, x + (rng() - 0.5) * 6, y + len); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x, y - h); ctx.lineTo(x, y - h + len); ctx.stroke(); // wrap
    }
    speckle(ctx, w, h, rng, 1400, ['#2a1c10', '#8a6a44', '#3d2a18'], 2, 0.5);
  }, { repeat: [1, 1] });
}

/** Rusty sheet metal with scratches and flaking paint. */
export function rustTexture() {
  return canvasTexture('rust', 256, 256, (ctx, w, h, rng) => {
    ctx.fillStyle = '#6b4226'; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 90; i++) {
      const g = ctx.createRadialGradient(0, 0, 1, 0, 0, 10 + rng() * 40);
      const col = rng() < 0.5 ? '150,72,28' : '90,48,26';
      g.addColorStop(0, `rgba(${col},${0.35 + rng() * 0.4})`); g.addColorStop(1, `rgba(${col},0)`);
      ctx.save(); ctx.translate(rng() * w, rng() * h); ctx.fillStyle = g; ctx.fillRect(-60, -60, 120, 120); ctx.restore();
    }
    // remains of blue-grey paint
    for (let i = 0; i < 14; i++) {
      ctx.fillStyle = `rgba(86,100,110,${0.35 + rng() * 0.4})`;
      ctx.beginPath(); ctx.ellipse(rng() * w, rng() * h, 6 + rng() * 22, 4 + rng() * 14, rng() * 3, 0, 6.3); ctx.fill();
    }
    ctx.strokeStyle = 'rgba(30,20,12,0.5)'; ctx.lineWidth = 1;
    for (let i = 0; i < 30; i++) { ctx.beginPath(); const x = rng() * w, y = rng() * h; ctx.moveTo(x, y); ctx.lineTo(x + (rng() - 0.5) * 60, y + (rng() - 0.5) * 20); ctx.stroke(); }
    speckle(ctx, w, h, rng, 2000, ['#2b1a0e', '#b8682f', '#4a3220'], 2, 0.6);
    // rivets
    for (let i = 0; i < 8; i++) { const x = 20 + (i % 4) * 70, y = i < 4 ? 14 : h - 14; ctx.fillStyle = '#3a2a1c'; ctx.beginPath(); ctx.arc(x, y, 4, 0, 6.3); ctx.fill(); ctx.fillStyle = '#a56a3a'; ctx.beginPath(); ctx.arc(x - 1, y - 1, 1.6, 0, 6.3); ctx.fill(); }
  });
}

/** Woven faded linen with a stripe and hem stitching. */
export function fabricTexture() {
  return canvasTexture('fabric', 256, 256, (ctx, w, h, rng) => {
    ctx.fillStyle = '#b8ad8e'; ctx.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 2) { ctx.fillStyle = `rgba(70,60,40,${0.07 + 0.08 * rng()})`; ctx.fillRect(0, y, w, 1); }
    for (let x = 0; x < w; x += 2) { ctx.fillStyle = `rgba(255,250,230,${0.06 + 0.08 * rng()})`; ctx.fillRect(x, 0, 1, h); }
    ctx.fillStyle = 'rgba(52,86,110,0.75)'; ctx.fillRect(0, 70, w, 14); ctx.fillRect(0, 96, w, 5);
    ctx.fillStyle = 'rgba(52,86,110,0.75)'; ctx.fillRect(0, 168, w, 14);
    ctx.strokeStyle = 'rgba(60,45,30,0.55)'; ctx.setLineDash([5, 4]); ctx.lineWidth = 1;
    ctx.strokeRect(10, 10, w - 20, h - 20); ctx.setLineDash([]);
    for (let i = 0; i < 9; i++) { // stains
      const g = ctx.createRadialGradient(0, 0, 1, 0, 0, 30);
      g.addColorStop(0, 'rgba(90,64,36,0.35)'); g.addColorStop(1, 'rgba(90,64,36,0)');
      ctx.save(); ctx.translate(rng() * w, rng() * h); ctx.fillStyle = g; ctx.fillRect(-40, -40, 80, 80); ctx.restore();
    }
    speckle(ctx, w, h, rng, 900, ['#4a3a24', '#e8dfc4'], 1.5, 0.4);
  });
}

/** Engraved golden sun: used on the top face of the Sun Disc. */
export function sunDiscTexture() {
  return canvasTexture('sundisc', 512, 512, (ctx, w, h, rng) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, w / 2);
    g.addColorStop(0, '#f6d56a'); g.addColorStop(0.7, '#d9a52e'); g.addColorStop(1, '#a8741a');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    speckle(ctx, w, h, rng, 4000, ['#7a5410', '#ffe9a0'], 2, 0.4);
    const cx = w / 2, cy = h / 2;
    ctx.strokeStyle = '#6e4a0e'; ctx.fillStyle = '#6e4a0e'; ctx.lineWidth = 5; ctx.lineCap = 'round';
    for (const r of [236, 214, 128]) { ctx.beginPath(); ctx.arc(cx, cy, r, 0, 6.3); ctx.stroke(); }
    ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(cx, cy, 150, 0, 6.3); ctx.stroke();
    for (let i = 0; i < 16; i++) { // rays
      const a = (i / 16) * Math.PI * 2, long = i % 2 === 0;
      const r0 = 150, r1 = long ? 206 : 184;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a - 0.09) * r0, cy + Math.sin(a - 0.09) * r0);
      ctx.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
      ctx.lineTo(cx + Math.cos(a + 0.09) * r0, cy + Math.sin(a + 0.09) * r0);
      ctx.closePath(); ctx.fill();
    }
    for (let i = 0; i < 48; i++) { const a = (i / 48) * Math.PI * 2; ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * 218, cy + Math.sin(a) * 218); ctx.lineTo(cx + Math.cos(a) * 230, cy + Math.sin(a) * 230); ctx.stroke(); }
    // face
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(cx, cy, 70, 0, 6.3); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx - 24, cy - 12, 8, 0, 6.3); ctx.fill(); ctx.beginPath(); ctx.arc(cx + 24, cy - 12, 8, 0, 6.3); ctx.fill();
    ctx.beginPath(); ctx.moveTo(cx, cy - 8); ctx.lineTo(cx - 8, cy + 14); ctx.lineTo(cx + 8, cy + 14); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy + 22, 26, 0.25, Math.PI - 0.25); ctx.stroke();
  });
}

/** Front face of the K-7 keycard (rounded corners are transparent, used with alphaTest). */
export function cardFaceTexture() {
  return canvasTexture('card_face', 512, 324, (ctx, w, h) => {
    const r = 28;
    ctx.beginPath(); ctx.moveTo(r, 0); ctx.arcTo(w, 0, w, h, r); ctx.arcTo(w, h, 0, h, r); ctx.arcTo(0, h, 0, 0, r); ctx.arcTo(0, 0, w, 0, r); ctx.closePath(); ctx.clip();
    const g = ctx.createLinearGradient(0, 0, w, h); g.addColorStop(0, '#2d3a3c'); g.addColorStop(1, '#1a2224');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#e0b020'; ctx.fillRect(0, 0, w, 40);
    ctx.fillStyle = '#111';
    for (let x = -40; x < w + 40; x += 36) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + 18, 0); ctx.lineTo(x + 2, 40); ctx.lineTo(x - 16, 40); ctx.fill(); }
    ctx.fillStyle = '#d9d4c0'; ctx.font = 'bold 30px monospace'; ctx.fillText('PROJECT BEYOND', 24, 80);
    ctx.fillStyle = '#9fb0ad'; ctx.font = '20px monospace'; ctx.fillText('INSTALLATIE K-7  /  NIVEAU 3', 24, 108);
    // chip
    ctx.fillStyle = '#c9a43a'; ctx.fillRect(34, 138, 78, 62);
    ctx.strokeStyle = '#6b5415'; ctx.lineWidth = 2; ctx.strokeRect(34, 138, 78, 62);
    ctx.beginPath(); ctx.moveTo(34, 169); ctx.lineTo(112, 169); ctx.moveTo(73, 138); ctx.lineTo(73, 200); ctx.stroke();
    ctx.fillStyle = '#f2efe0'; ctx.font = 'bold 112px monospace'; ctx.fillText('K-7', 170, 200);
    ctx.fillStyle = '#7e8c88'; ctx.font = '18px monospace'; ctx.fillText('V. ELENA    ID 0047-3', 24, 236);
    ctx.fillStyle = '#0b0b0b'; ctx.fillRect(0, 262, w, 44);
    ctx.fillStyle = '#d4cdb4';
    for (let x = 300; x < 480; x += 5) ctx.fillRect(x, 242, 1 + ((x * 7) % 3), 14);
    ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, h); ctx.lineTo(w, 0); ctx.stroke();
  });
}

export function leatherTexture() {
  return canvasTexture('leather', 256, 256, (ctx, w, h, rng) => {
    ctx.fillStyle = '#5b3a22'; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 2600; i++) { ctx.fillStyle = `rgba(${rng() < 0.5 ? '30,16,8' : '130,92,56'},${0.1 + rng() * 0.25})`; ctx.beginPath(); ctx.arc(rng() * w, rng() * h, 1 + rng() * 2.5, 0, 6.3); ctx.fill(); }
    ctx.strokeStyle = 'rgba(20,10,5,0.4)'; for (let i = 0; i < 25; i++) { ctx.beginPath(); const x = rng() * w, y = rng() * h; ctx.moveTo(x, y); ctx.lineTo(x + (rng() - 0.5) * 80, y + (rng() - 0.5) * 80); ctx.stroke(); }
  });
}

/** Elder's journal cover: embossed sun on leather. */
export function journalCoverTexture() {
  return canvasTexture('journal_cover', 256, 320, (ctx, w, h, rng) => {
    const base = leatherTexture().image;
    ctx.drawImage(base, 0, 0, w, h);
    ctx.strokeStyle = 'rgba(210,170,90,0.75)'; ctx.fillStyle = 'rgba(210,170,90,0.75)'; ctx.lineWidth = 3;
    ctx.strokeRect(14, 14, w - 28, h - 28);
    const cx = w / 2, cy = h / 2 - 8;
    ctx.beginPath(); ctx.arc(cx, cy, 34, 0, 6.3); ctx.stroke();
    for (let i = 0; i < 12; i++) { const a = (i / 12) * 6.283; ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * 44, cy + Math.sin(a) * 44); ctx.lineTo(cx + Math.cos(a) * (i % 2 ? 56 : 66), cy + Math.sin(a) * (i % 2 ? 56 : 66)); ctx.stroke(); }
    ctx.font = 'bold 20px serif'; ctx.textAlign = 'center'; ctx.fillText('AETHARI', cx, h - 38);
    speckle(ctx, w, h, rng, 600, ['#2a170a'], 2, 0.5);
  });
}

export function notebookCoverTexture() {
  return canvasTexture('notebook_cover', 256, 340, (ctx, w, h, rng) => {
    ctx.fillStyle = '#243a4a'; ctx.fillRect(0, 0, w, h);
    speckle(ctx, w, h, rng, 2500, ['#0f1c26', '#4a6478'], 2, 0.35);
    ctx.fillStyle = '#d9d2bc'; ctx.fillRect(40, 60, w - 80, 118);
    ctx.fillStyle = '#2b2b2b'; ctx.font = 'bold 26px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('LOGBOEK', w / 2, 100);
    ctx.font = '18px sans-serif'; ctx.fillText('KESTREL', w / 2, 128); ctx.fillText('E. VOS', w / 2, 156);
    ctx.fillStyle = '#c23a2a'; ctx.fillRect(0, h - 70, w, 14);
  });
}

/** Lined paper with handwriting-like squiggles. */
export function paperTexture(tint = '#d8ceb0') {
  return canvasTexture('paper' + tint, 256, 340, (ctx, w, h, rng) => {
    ctx.fillStyle = tint; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 40; i++) {
      const g = ctx.createRadialGradient(0, 0, 1, 0, 0, 50);
      g.addColorStop(0, 'rgba(110,80,40,0.18)'); g.addColorStop(1, 'rgba(110,80,40,0)');
      ctx.save(); ctx.translate(rng() * w, rng() * h); ctx.fillStyle = g; ctx.fillRect(-60, -60, 120, 120); ctx.restore();
    }
    ctx.strokeStyle = 'rgba(40,36,30,0.65)'; ctx.lineWidth = 1.2;
    for (let y = 36; y < h - 30; y += 15) {
      let x = 24; ctx.beginPath(); ctx.moveTo(x, y);
      while (x < w - 24 - rng() * 40) { x += 3 + rng() * 5; ctx.lineTo(x, y + (rng() - 0.5) * 5); if (rng() < 0.12) x += 5; }
      ctx.stroke();
    }
    speckle(ctx, w, h, rng, 700, ['#6a5a3a'], 2, 0.4);
  });
}

/** Carved stone slab with glyphs (cave inscription). */
export function tabletTexture() {
  return canvasTexture('tablet', 256, 320, (ctx, w, h, rng) => {
    ctx.fillStyle = '#6f6a62'; ctx.fillRect(0, 0, w, h);
    speckle(ctx, w, h, rng, 5000, ['#3d3a35', '#a09a8c', '#58544c'], 3, 0.5);
    ctx.strokeStyle = '#2c2a26'; ctx.lineWidth = 4; ctx.lineCap = 'round';
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 4; col++) {
        const cx = 40 + col * 56, cy = 50 + row * 62, k = (rng() * 4) | 0;
        ctx.beginPath();
        if (k === 0) { ctx.arc(cx, cy, 14, 0, 6.3); for (let i = 0; i < 8; i++) { const a = i * 0.785; ctx.moveTo(cx + Math.cos(a) * 18, cy + Math.sin(a) * 18); ctx.lineTo(cx + Math.cos(a) * 26, cy + Math.sin(a) * 26); } }
        else if (k === 1) { ctx.arc(cx, cy, 20, 0.6, 5.6); }
        else if (k === 2) { ctx.moveTo(cx - 24, cy); ctx.bezierCurveTo(cx - 12, cy - 20, cx - 4, cy + 20, cx + 8, cy); ctx.bezierCurveTo(cx + 14, cy - 12, cx + 20, cy + 12, cx + 26, cy); }
        else { ctx.moveTo(cx - 24, cy + 18); ctx.lineTo(cx - 6, cy - 16); ctx.lineTo(cx + 4, cy); ctx.lineTo(cx + 14, cy - 10); ctx.lineTo(cx + 26, cy + 18); ctx.closePath(); }
        ctx.stroke();
      }
    }
  });
}

/** Recorder front: two reel discs with spokes. */
export function reelTexture() {
  return canvasTexture('reel', 128, 128, (ctx) => {
    ctx.fillStyle = '#1c1c1e'; ctx.beginPath(); ctx.arc(64, 64, 62, 0, 6.3); ctx.fill();
    ctx.fillStyle = '#b8bcc0'; ctx.beginPath(); ctx.arc(64, 64, 48, 0, 6.3); ctx.fill();
    ctx.fillStyle = '#1c1c1e';
    for (let i = 0; i < 3; i++) { const a = i * 2.094; ctx.beginPath(); ctx.moveTo(64, 64); ctx.arc(64, 64, 42, a, a + 0.9); ctx.closePath(); ctx.fill(); }
    ctx.fillStyle = '#8a8f94'; ctx.beginPath(); ctx.arc(64, 64, 10, 0, 6.3); ctx.fill();
  });
}

/** Soft vertical light-shaft gradient (additive). */
export function shaftTexture() {
  return canvasTexture('shaft', 16, 128, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, h, 0, 0);
    g.addColorStop(0, 'rgba(255,230,150,0.9)'); g.addColorStop(0.35, 'rgba(255,220,130,0.35)'); g.addColorStop(1, 'rgba(255,220,130,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  }, { anisotropy: 1 });
}

export function glowTexture() {
  return canvasTexture('glow', 64, 64, (ctx, w, h) => {
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,240,190,1)'); g.addColorStop(0.3, 'rgba(255,214,120,0.45)'); g.addColorStop(1, 'rgba(255,200,100,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  }, { anisotropy: 1 });
}
