// "Over het spel": story blurb, credits and version.
import { h, icon } from './dom.js';
import { createLogo } from './Logo.js';

export function createAboutPanel(ctx) {
  return h('div', { class: 'about-panel' },
    createLogo({ small: true }),
    h('p', { class: 'about-lead', text: 'Je ontwaakt alleen in het verlaten onderzoeksstation Kestrel. Van Dr. Vos, die hier werkte, ontbreekt elk spoor, behalve een logboek vol vragen over een verdwenen volk dat de zon vereerde.' }),
    h('p', { text: 'Volg de paden door het Fluisterwoud, ontdek het stille dorp Valdris, daal af in de Kristalgrot en open de Zonnetempel. Wat daar onder de aarde wacht, is groter dan een eiland.' }),
    h('div', { class: 'about-chapters' },
      h('div', { class: 'chapter on' }, icon('compass'), h('span', { text: 'Hoofdstuk 1 · The Greenlands' }), h('em', { text: 'speelbaar' })),
      h('div', { class: 'chapter' }, icon('lock'), h('span', { text: 'Hoofdstuk 2 · The Wastelands' }), h('em', { text: 'binnenkort' })),
      h('div', { class: 'chapter' }, icon('lock'), h('span', { text: 'Hoofdstuk 3 · The Frozen Peaks' }), h('em', { text: 'binnenkort' }))),
    h('p', { class: 'about-credits', text: 'BEYOND is een browsergame, volledig procedureel gegenereerd: landschap, geluid en beeld ontstaan in je browser, zonder externe bestanden. Gebouwd met Three.js.' }),
    h('div', { class: 'about-version' }, h('span', { text: `Versie ${ctx.game.version || '0.1.0'}` }), h('span', { class: 'dot' }), h('span', { text: 'Kwaliteit: ' + (ctx.game.quality || 'auto') })));
}
