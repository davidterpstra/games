// Controls reference: desktop key bindings and touch controls.
import { h } from './dom.js';

const KEYS = [
  [['W', 'A', 'S', 'D'], 'Lopen (ook pijltjestoetsen)'], [['Muis'], 'Rondkijken'], [['Shift'], 'Sprinten'], [['Spatie'], 'Springen'],
  [['E'], 'Interactie: oppakken, openen, lezen'], [['F'], 'Toorts aan of uit'], [['Tab'], 'Inventaris en crafting (ook I)'],
  [['M'], 'Kaart'], [['Esc'], 'Pauze of sluiten'],
];
const TOUCH = [
  ['Linker duim', 'Sleep om te lopen'], ['Rechter duim', 'Sleep om rond te kijken'], ['Knop actie', 'Interactie met het object in het midden'],
  ['Knop spring', 'Springen'], ['Knop toorts', 'Toorts aan of uit'], ['Knop tas', 'Inventaris, crafting en kaart'],
];

export function createControlsPanel() {
  return h('div', { class: 'controls-panel' },
    h('section', { class: 'ctl-sec' }, h('h3', { class: 'sec-title', text: 'Toetsenbord en muis' }),
      h('div', { class: 'ctl-list' }, KEYS.map(([keys, desc]) => h('div', { class: 'ctl-row' },
        h('span', { class: 'ctl-keys' }, keys.map((k) => h('kbd', { text: k }))), h('span', { class: 'ctl-desc', text: desc }))))),
    h('section', { class: 'ctl-sec' }, h('h3', { class: 'sec-title', text: 'Aanraakbediening' }),
      h('div', { class: 'ctl-list' }, TOUCH.map(([k, desc]) => h('div', { class: 'ctl-row' },
        h('span', { class: 'ctl-keys' }, h('kbd', { class: 'kbd-wide', text: k })), h('span', { class: 'ctl-desc', text: desc }))))));
}
