// Chapter ending: epilogue teaser + stats + buttons.
import { h, btn, fmtDuration, icon } from './dom.js';

export function createEndingScreen(ctx) {
  const { game } = ctx;
  const stats = h('div', { class: 'ending-stats' });
  const el = h('section', { class: 'screen ending-screen', 'aria-label': 'Einde van hoofdstuk 1' },
    h('div', { class: 'ending-bg' }),
    h('div', { class: 'ending-content' },
      icon('sundisc', 'ending-sun'),
      h('div', { class: 'ending-kicker', text: 'EINDE VAN HOOFDSTUK 1' }),
      h('h1', { class: 'ending-title', text: 'THE GREENLANDS' }),
      h('div', { class: 'ending-rule' }),
      h('p', { class: 'ending-epilogue', text: 'De machines in Bunker K-7 ontwaken en de terminal toont één laatste coördinaat, ver voorbij de groene heuvels. Waar de aarde droog en barstend wordt, wacht wat Dr. Vos nooit durfde te benoemen.' }),
      h('p', { class: 'ending-teaser', text: 'De reis gaat verder in THE WASTELANDS.' }),
      stats,
      h('div', { class: 'btn-row ending-actions' },
        btn('Verder verkennen', { cls: 'btn-primary btn-big', ic: 'compass', onClick: () => ctx.request('resume') }),
        btn('Hoofdmenu', { cls: 'btn-big', ic: 'home', onClick: () => ctx.request('quitToMenu') }))));

  function onShow() {
    const gp = game.gameplay;
    const locs = gp?.locations?.list?.() || [];
    const found = locs.filter((l) => l.discovered).length;
    const docs = gp?.documents?.list?.().length || 0;
    stats.replaceChildren(
      ...[['Speeltijd', fmtDuration(gp?.playTime || 0)], ['Ontdekte locaties', `${found} / ${locs.length}`], ['Gelezen documenten', String(docs)]]
        .map(([k, v]) => h('div', { class: 'stat' }, h('div', { class: 'stat-val', text: v }), h('div', { class: 'stat-key', text: k }))));
    setTimeout(() => el.querySelector('.btn-primary')?.focus({ preventScroll: true }), 400);
  }
  return { el, onShow };
}
