// Pause menu.
import { h, btn } from './dom.js';
import { createLogo } from './Logo.js';

export function createPauseMenu(ctx) {
  const resume = btn('Hervatten', { cls: 'btn-primary btn-big', ic: 'play', onClick: () => ctx.request('resume') });
  const list = h('nav', { class: 'menu-list', 'aria-label': 'Pauzemenu' },
    resume,
    btn('Opslaan', { cls: 'btn-big', ic: 'save', onClick: () => ctx.request('save') }),
    btn('Laatste checkpoint', { cls: 'btn-big', ic: 'checkpointLoad', sub: 'Terug naar het laatste radiobaken', onClick: async () => {
      if (await ctx.confirm({ title: 'Naar checkpoint?', text: 'Je keert terug naar het laatste radiobaken dat je hebt geactiveerd.', confirmLabel: 'Teruggaan' })) ctx.request('loadCheckpoint');
    } }),
    btn('Instellingen', { cls: 'btn-big', ic: 'settings', onClick: () => ctx.openPanel('settings') }),
    btn('Besturing', { cls: 'btn-big', ic: 'controls', onClick: () => ctx.openPanel('controls') }),
    btn('Naar hoofdmenu', { cls: 'btn-big', ic: 'home', onClick: async () => {
      if (await ctx.confirm({ title: 'Naar het hoofdmenu?', text: 'Je voortgang wordt automatisch opgeslagen voordat je het spel verlaat.', confirmLabel: 'Hoofdmenu' })) ctx.request('quitToMenu');
    } }));
  const el = h('section', { class: 'screen pause-screen', 'aria-label': 'Pauze' },
    h('div', { class: 'panel pause-panel' },
      createLogo({ small: true }),
      h('div', { class: 'pause-title', text: 'GEPAUZEERD' }),
      list));
  return { el, onShow() { setTimeout(() => resume.focus({ preventScroll: true }), 60); } };
}
