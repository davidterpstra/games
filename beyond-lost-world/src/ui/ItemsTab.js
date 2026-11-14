// Inventory tab: 24-slot grid with item icons + counts and a details panel for the selected item.
import { h, icon } from './dom.js';

const CAT = { material: 'Materiaal', tool: 'Gereedschap', key: 'Sleutelvoorwerp', artifact: 'Artefact' };
const SLOTS = 24;

export function createItemsTab(ctx) {
  const { bus, game } = ctx;
  const grid = h('div', { class: 'slot-grid', role: 'listbox', 'aria-label': 'Inventaris' });
  const detail = h('aside', { class: 'item-detail' });
  const el = h('div', { class: 'items-tab' }, grid, detail);
  const slotEls = [];
  for (let i = 0; i < SLOTS; i++) {
    const s = h('button', { class: 'slot is-empty', type: 'button', role: 'option', 'aria-label': 'Leeg vak', 'data-nosfx': '' });
    s.addEventListener('click', () => { select(i); ctx.sfx('ui_click'); });
    s.addEventListener('keydown', (e) => {
      const cols = getCols();
      const d = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: cols, ArrowUp: -cols }[e.key];
      if (d) { const n = i + d; if (n >= 0 && n < SLOTS) { slotEls[n].focus(); select(n); e.preventDefault(); e.stopPropagation(); } }
    });
    slotEls.push(s); grid.append(s);
  }
  const getCols = () => getComputedStyle(grid).gridTemplateColumns.split(' ').length;
  let selected = 0, sig = '';

  function slots() { return game.gameplay?.inventory?.slots || []; }

  function render() {
    const sl = slots();
    const items = game.gameplay?.items || {};
    const s = JSON.stringify(sl);
    if (s === sig && detail.dataset.sel === String(selected)) return;
    sig = s;
    for (let i = 0; i < SLOTS; i++) {
      const slot = sl[i], b = slotEls[i];
      const key = slot ? slot.itemId + ':' + slot.count : '';
      if (b._k !== key) {
        b._k = key;
        b.classList.toggle('is-empty', !slot);
        if (slot) {
          const it = items[slot.itemId];
          b.replaceChildren(icon(slot.itemId, 'slot-ic'), slot.count > 1 ? h('span', { class: 'slot-count', text: String(slot.count) }) : null);
          b.dataset.item = slot.itemId;
          b.dataset.cat = it?.category || '';
          b.setAttribute('aria-label', `${it?.name || slot.itemId}, ${slot.count}`);
        } else { b.replaceChildren(); delete b.dataset.item; b.setAttribute('aria-label', 'Leeg vak'); }
      }
      b.classList.toggle('is-sel', i === selected);
      b.setAttribute('aria-selected', String(i === selected));
    }
    renderDetail();
  }

  function renderDetail() {
    const slot = slots()[selected];
    const items = game.gameplay?.items || {};
    detail.dataset.sel = String(selected);
    if (!slot) {
      const any = slots().some(Boolean);
      detail.replaceChildren(h('div', { class: 'detail-empty' }, icon('inventory'), h('p', { text: any ? 'Kies een voorwerp om de details te bekijken.' : 'Je rugzak is leeg. Verzamel hout, steen en vezels in de wildernis.' })));
      return;
    }
    const it = items[slot.itemId] || { name: slot.itemId, description: '', category: '', stack: 1 };
    detail.replaceChildren(
      h('div', { class: 'detail-icon', 'data-cat': it.category }, icon(slot.itemId)),
      h('h3', { class: 'detail-name', text: it.name }),
      h('div', { class: 'detail-meta' }, h('span', { class: 'tag', text: CAT[it.category] || 'Voorwerp' }), h('span', { class: 'tag tag-count', text: `Aantal ${slot.count}${it.stack > 1 ? ' / ' + it.stack : ''}` })),
      h('p', { class: 'detail-desc', text: it.description || '' }));
    detail.classList.remove('swap'); void detail.offsetWidth; detail.classList.add('swap');
  }

  function select(i) { selected = i; sig = ''; render(); }
  bus.on('inventory:changed', () => { if (el.closest('.is-on') && el.closest('.screen.is-open')) render(); });

  return {
    el,
    onShow() {
      sig = '';
      const sl = slots();
      if (!sl[selected]) { const f = sl.findIndex(Boolean); selected = f >= 0 ? f : 0; }
      render();
    },
  };
}
