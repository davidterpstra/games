// Main menu over the live 3D menu camera (transparent, with vignette via CSS).
import { h, btn, fmtDate, fmtDuration } from './dom.js';
import { createLogo } from './Logo.js';

export function createMainMenu(ctx) {
  const { game } = ctx;
  const list = h('nav', { class: 'menu-list', 'aria-label': 'Hoofdmenu' });
  const foot = h('div', { class: 'menu-foot' }, h('span', { text: `v${game.version || '0.1.0'}` }), h('span', { class: 'dot' }), h('span', { text: 'THE GREENLANDS · Hoofdstuk 1' }));
  const el = h('section', { class: 'screen menu-screen', 'aria-label': 'Hoofdmenu' },
    h('div', { class: 'menu-vignette' }),
    h('div', { class: 'menu-content' }, createLogo(), list, ),
    foot);

  function build() {
    const save = game.gameplay?.save;
    const has = !!save?.hasSave?.();
    const info = has ? save.getInfo?.() : null;
    const items = [];
    if (has) {
      const sub = info ? [info.missionTitle, fmtDate(info.timestamp), info.playTime ? fmtDuration(info.playTime) : ''].filter(Boolean).join(' · ') : '';
      items.push(btn('Doorgaan', { cls: 'btn-primary btn-big', ic: 'play', sub, onClick: () => ctx.request('continue') }));
    }
    items.push(btn('Nieuw spel', {
      cls: has ? 'btn-big' : 'btn-primary btn-big', ic: 'compass',
      onClick: async () => {
        if (has) {
          const ok = await ctx.confirm({ title: 'Nieuw spel starten?', text: 'Je opgeslagen voortgang wordt overschreven zodra het nieuwe spel voor het eerst opslaat.', confirmLabel: 'Nieuw spel', danger: true });
          if (!ok) return;
        }
        ctx.request('newGame');
      },
    }));
    items.push(btn('Instellingen', { cls: 'btn-big', ic: 'settings', onClick: () => ctx.openPanel('settings') }));
    items.push(btn('Besturing', { cls: 'btn-big', ic: 'controls', onClick: () => ctx.openPanel('controls') }));
    items.push(btn('Over het spel', { cls: 'btn-big', ic: 'info', onClick: () => ctx.openPanel('about') }));
    list.replaceChildren(...items);
  }
  build();

  return {
    el,
    onShow() { build(); setTimeout(() => list.querySelector('button')?.focus({ preventScroll: true }), 60); },
    keyNav: list,
  };
}
