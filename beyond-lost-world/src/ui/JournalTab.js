// Journal tab: documents read so far; click one to read it inside the screen.
import { h, icon } from './dom.js';

export function createJournalTab(ctx) {
  const { bus, game } = ctx;
  const list = h('div', { class: 'doc-list scroll', role: 'listbox', 'aria-label': 'Documenten' });
  const page = h('article', { class: 'doc-page scroll' });
  const el = h('div', { class: 'journal-tab' }, list, page);
  let selected = null, sig = '';

  function render() {
    const docs = game.gameplay?.documents?.list?.() || [];
    const s = JSON.stringify(docs.map((d) => d.id)) + selected;
    if (s === sig) return;
    sig = s;
    if (!docs.length) {
      list.replaceChildren();
      page.replaceChildren(h('div', { class: 'detail-empty' }, icon('journal'), h('p', { text: 'Je hebt nog geen documenten gelezen. Notities, logboeken en opnames die je vindt, verschijnen hier.' })));
      return;
    }
    if (!docs.some((d) => d.id === selected)) selected = docs[docs.length - 1].id;
    list.replaceChildren(...docs.map((d) => {
      const b = h('button', { class: `doc-item ${d.id === selected ? 'is-sel' : ''}`, type: 'button', role: 'option', 'aria-selected': String(d.id === selected) }, icon('journal'), h('span', { text: d.title }));
      b.addEventListener('click', () => { selected = d.id; sig = ''; render(); ctx.sfx('page'); });
      return b;
    }));
    const d = docs.find((x) => x.id === selected);
    page.replaceChildren(h('h3', { class: 'doc-title', text: d.title }), h('div', { class: 'doc-rule' }), h('div', { class: 'doc-text', text: d.body }));
    page.scrollTop = 0;
  }
  return { el, onShow() { sig = ''; render(); } };
}
