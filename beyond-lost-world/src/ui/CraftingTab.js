// Crafting tab: recipe list, ingredients (have/need), "Maken" button enabled by crafting.canCraft(id).
import { h, icon, btn } from './dom.js';

export function createCraftingTab(ctx) {
  const { bus, game } = ctx;
  const list = h('div', { class: 'recipe-list scroll', role: 'listbox', 'aria-label': 'Recepten' });
  const detail = h('aside', { class: 'recipe-detail' });
  const el = h('div', { class: 'crafting-tab' }, list, detail);
  let selected = null, sig = '', flashId = null;

  const gp = () => game.gameplay;
  const itemName = (id) => gp()?.items?.[id]?.name || id;

  function status() {
    const c = gp()?.crafting;
    if (!c) return [];
    return c.recipes.map((r) => ({ r, can: !!c.canCraft(r.id), ing: r.ingredients.map((i) => ({ ...i, have: gp().inventory.count(i.itemId) })) }));
  }

  function render() {
    const st = status();
    const s = JSON.stringify(st.map((x) => [x.r.id, x.can, x.ing.map((i) => i.have)])) + selected;
    if (s === sig) return;
    sig = s;
    if (!st.length) { list.replaceChildren(h('p', { class: 'empty-note', text: 'Geen recepten beschikbaar.' })); detail.replaceChildren(); return; }
    if (!st.some((x) => x.r.id === selected)) selected = (st.find((x) => x.can) || st[0]).r.id;
    list.replaceChildren(...st.map(({ r, can, ing }) => {
      const b = h('button', { class: `recipe ${can ? 'can' : ''} ${r.id === selected ? 'is-sel' : ''}`, type: 'button', role: 'option', 'aria-selected': String(r.id === selected) },
        h('span', { class: 'recipe-ic' }, icon(r.result.itemId)),
        h('span', { class: 'recipe-main' },
          h('span', { class: 'recipe-name', text: itemName(r.result.itemId) + (r.result.count > 1 ? ` ×${r.result.count}` : '') }),
          h('span', { class: 'recipe-mini' }, ing.map((i) => h('span', { class: `mini ${i.have >= i.count ? 'ok' : 'no'}` }, icon(i.itemId), h('b', { text: `${Math.min(i.have, 99)}/${i.count}` }))))),
        h('span', { class: 'recipe-state' }, can ? icon('check') : null));
      b.addEventListener('click', () => { selected = r.id; sig = ''; render(); ctx.sfx('ui_click'); });
      return b;
    }));
    const cur = st.find((x) => x.r.id === selected);
    const { r, can, ing } = cur;
    const make = btn(can ? 'Maken' : 'Onvoldoende materialen', { cls: can ? 'btn-primary' : '', ic: 'crafting', attrs: can ? {} : { disabled: '' } });
    make.addEventListener('click', () => {
      const ok = gp().crafting.craft(r.id);
      if (!ok) { detail.classList.remove('shake'); void detail.offsetWidth; detail.classList.add('shake'); return; }
      flashId = r.id; sig = ''; render();
    });
    detail.replaceChildren(
      h('div', { class: `detail-icon ${flashId === r.id ? 'flash' : ''}` }, icon(r.result.itemId)),
      h('h3', { class: 'detail-name', text: itemName(r.result.itemId) + (r.result.count > 1 ? ` ×${r.result.count}` : '') }),
      h('p', { class: 'detail-desc', text: r.description || gp().items?.[r.result.itemId]?.description || '' }),
      h('div', { class: 'sec-title small', text: 'Benodigd' }),
      h('ul', { class: 'ing-list' }, ing.map((i) => h('li', { class: `ing ${i.have >= i.count ? 'ok' : 'no'}` },
        icon(i.itemId), h('span', { class: 'ing-name', text: itemName(i.itemId) }), h('span', { class: 'ing-count', text: `${i.have} / ${i.count}` })))),
      make);
    flashId = null;
  }

  bus.on('inventory:changed', () => { if (el.closest('.screen.is-open') && el.closest('.tab-pane.is-on')) render(); });
  return { el, onShow() { sig = ''; render(); } };
}
