// BEYOND logo: sun-glyph mark (SVG) + CSS typography.
import { h } from './dom.js';

function sunMark() {
  let rays = '';
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2, long = i % 2 === 0;
    const r1 = 26, r2 = long ? 40 : 33;
    rays += `<path d="M${(48 + Math.cos(a) * r1).toFixed(1)} ${(48 + Math.sin(a) * r1).toFixed(1)}L${(48 + Math.cos(a) * r2).toFixed(1)} ${(48 + Math.sin(a) * r2).toFixed(1)}" stroke-width="${long ? 2.2 : 1.4}"/>`;
  }
  const s = document.createElement('span');
  s.className = 'logo-mark';
  s.innerHTML = `<svg viewBox="0 0 96 96" aria-hidden="true"><defs><linearGradient id="lg-gold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f3d9a0"/><stop offset="1" stop-color="#b98a3e"/></linearGradient></defs>
    <g fill="none" stroke="url(#lg-gold)" stroke-linecap="round">${rays}<circle cx="48" cy="48" r="21" stroke-width="2.2"/><circle cx="48" cy="48" r="14" stroke-width="1.2" opacity=".7"/><path d="M36 52c4 6 20 6 24 0M40 42h3M53 42h3" stroke-width="1.6"/></g>
    <circle cx="48" cy="48" r="5" fill="url(#lg-gold)"/></svg>`;
  return s;
}

/** @param {{small?: boolean}} opts */
export function createLogo({ small = false } = {}) {
  return h('div', { class: 'logo' + (small ? ' logo-small' : '') },
    sunMark(),
    h('div', { class: 'logo-text' },
      h('div', { class: 'logo-title', text: 'BEYOND' }),
      h('div', { class: 'logo-sub' }, h('span', { class: 'logo-rule' }), h('span', { text: 'THE LOST WORLD' }), h('span', { class: 'logo-rule' }))));
}
