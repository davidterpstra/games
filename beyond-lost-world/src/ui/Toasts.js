// Toasts (stack, top-centre under the compass) and cinematic banners (discoveries / missions).
// Visible in every game state.
import { h, icon } from './dom.js';

const MAX_TOASTS = 5;

export function createToasts(ctx) {
  const { bus, game } = ctx;
  const stack = h('div', { class: 'toasts', 'aria-live': 'polite' });
  const bannerEl = h('div', { class: 'banner', 'aria-live': 'polite' });
  const el = h('div', { class: 'toast-layer' }, stack, bannerEl);

  // ---- toasts -------------------------------------------------------------------------------
  function toast({ text, icon: ic, kind = 'info', itemId, count, key }) {
    if (key) {
      const existing = [...stack.children].find((n) => n.dataset.key === key && !n.classList.contains('out'));
      if (existing) {
        const n = (Number(existing.dataset.count) || 1) + (count || 1);
        existing.dataset.count = String(n);
        existing.querySelector('.toast-text').textContent = `+${n} ${existing.dataset.name}`;
        restart(existing);
        return;
      }
    }
    const node = h('div', { class: `toast toast-${kind}`, role: 'status' },
      h('span', { class: 'toast-ic' }, icon(ic || (kind === 'success' ? 'check' : kind === 'warning' ? 'info' : 'info'))),
      h('span', { class: 'toast-text', text }));
    if (key) { node.dataset.key = key; node.dataset.count = String(count || 1); node.dataset.name = text.replace(/^\+\d+\s/, ''); }
    stack.append(node);
    while (stack.children.length > MAX_TOASTS) stack.firstChild.remove();
    restart(node);
  }
  function restart(node) {
    clearTimeout(node._t);
    node.classList.remove('out');
    node.classList.remove('pop'); void node.offsetWidth; node.classList.add('pop');
    node._t = setTimeout(() => { node.classList.add('out'); setTimeout(() => node.remove(), 360); }, 3200);
  }

  bus.on('notify', ({ text, type = 'info' }) => toast({ text, kind: type }));
  bus.on('item:picked', ({ itemId, count = 1, name }) => toast({ text: `+${count} ${name}`, icon: itemId, kind: 'item', key: 'item:' + itemId, count }));
  bus.on('craft:done', ({ itemId, name }) => toast({ text: `Gemaakt: ${name}`, icon: itemId || 'crafting', kind: 'success' }));
  bus.on('objective:completed', ({ objective }) => { if (objective) toast({ text: objective.text, icon: 'check', kind: 'success' }); });

  // ---- banners ------------------------------------------------------------------------------
  const queue = [];
  let showing = false;
  function pushBanner(b) { queue.push(b); pump(); }
  function pump() {
    if (showing || !queue.length) return;
    if (game.state === 'loading' || game.state === 'menu') { setTimeout(pump, 1000); return; }
    showing = true;
    const b = queue.shift();
    bannerEl.className = `banner banner-${b.kind}`;
    bannerEl.replaceChildren(
      h('div', { class: 'banner-kicker' }, h('span', { class: 'banner-line' }), h('span', { text: b.kicker }), h('span', { class: 'banner-line' })),
      h('div', { class: 'banner-title', text: b.title }),
      ...(b.sub ? [h('div', { class: 'banner-sub', text: b.sub })] : []));
    void bannerEl.offsetWidth;
    bannerEl.classList.add('is-on');
    setTimeout(() => {
      bannerEl.classList.remove('is-on');
      setTimeout(() => { showing = false; pump(); }, 700);
    }, b.ms || 4200);
  }
  bus.on('location:discovered', ({ name }) => pushBanner({ kind: 'discover', kicker: 'ONTDEKT', title: name, sfx: 'discover' }));
  bus.on('mission:started', ({ mission }) => { if (mission) pushBanner({ kind: 'mission', kicker: 'NIEUWE MISSIE', title: mission.title, sfx: 'objective', ms: 3800 }); });
  bus.on('mission:completed', ({ mission }) => { if (mission) pushBanner({ kind: 'done', kicker: 'MISSIE VOLTOOID', title: mission.title, sfx: 'mission_complete' }); });

  return { el, toast, pushBanner };
}
