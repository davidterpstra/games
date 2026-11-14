// Loading screen: logo, progress bar, status label and rotating lore tips.
import { h } from './dom.js';
import { createLogo } from './Logo.js';

const TIPS = [
  'Dr. Vos noteerde alles. Zoek naar logboeken, brieven en terminals: ze vertellen wat er is gebeurd.',
  'Een toorts maakt de donkerste grotten begaanbaar. Druk op F om hem aan of uit te zetten.',
  'Radiobakens bewaren je voortgang. Wie sterft of valt, keert terug naar het laatste baken.',
  'Houd Shift ingedrukt om te sprinten, maar je uithoudingsvermogen is niet eindeloos.',
  'Hout, steen, vezels en hars liggen verspreid over het eiland. Een goede verkenner bekijkt elke hoek.',
  'Het volk van de zon bouwde zijn tempel op een heuvel. Zoek de glimmende rand van de gouden poort.',
  'Open de inventaris met Tab om te craften, je missies te bekijken of je dagboek terug te lezen.',
  'De kaart toont alleen wat je al hebt ontdekt. Dwaal af van de paden en verras jezelf.',
];

export function createLoadingScreen(ctx) {
  const bar = h('div', { class: 'load-bar-fill' });
  const label = h('div', { class: 'load-label', text: 'Initialiseren…' });
  const pct = h('div', { class: 'load-pct', text: '0%' });
  const tip = h('p', { class: 'load-tip', text: TIPS[0] });
  const el = h('section', { class: 'screen loading-screen', 'aria-label': 'Laden' },
    h('div', { class: 'loading-center' },
      createLogo(),
      h('div', { class: 'load-progress', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '100' },
        h('div', { class: 'load-bar' }, bar),
        h('div', { class: 'load-meta' }, label, pct))),
    h('div', { class: 'load-tip-wrap' }, h('span', { class: 'tip-kicker', text: 'WIST JE DAT' }), tip));

  let shown = 0, target = 0, tipTimer = 0, tipIdx = Math.floor(Math.random() * TIPS.length);
  let lastPct = -1, lastLabel = '';
  ctx.bus.on('loading:progress', ({ progress, label: l }) => {
    target = Math.max(target, Math.min(1, progress || 0));
    if (l && l !== lastLabel) { lastLabel = l; label.textContent = l; }
  });
  const setTip = () => { tip.classList.add('swap'); setTimeout(() => { tip.textContent = TIPS[tipIdx % TIPS.length]; tip.classList.remove('swap'); }, 280); };
  tip.textContent = TIPS[tipIdx % TIPS.length];

  return {
    el,
    update(dt) {
      shown += (target - shown) * Math.min(1, dt * 6);
      if (target - shown < 0.002) shown = target;
      const p = Math.round(shown * 100);
      if (p !== lastPct) {
        lastPct = p;
        bar.style.transform = `scaleX(${(shown).toFixed(3)})`;
        pct.textContent = p + '%';
        el.querySelector('.load-progress').setAttribute('aria-valuenow', String(p));
      }
      tipTimer += dt;
      if (tipTimer > 6) { tipTimer = 0; tipIdx++; setTip(); }
    },
  };
}
