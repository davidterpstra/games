// Missions tab: active mission with objectives, completed list, locked missions as "???".
import { h, icon, fill } from './dom.js';

export function createMissionsTab(ctx) {
  const { bus, game } = ctx;
  const el = h('div', { class: 'missions-tab scroll' });
  let sig = '';
  function objectives(m) {
    return h('ul', { class: 'obj-list' }, m.objectives.map((o) => h('li', { class: `obj ${o.done ? 'done' : ''}` },
      h('span', { class: 'obj-box' }, o.done ? icon('check') : null), h('span', { class: 'obj-text', text: o.text }),
      o.progress && !o.done ? h('span', { class: 'obj-progress', text: `[${o.progress[0]}/${o.progress[1]}]` }) : null)));
  }
  function render() {
    const list = game.gameplay?.missions?.list?.() || [];
    const s = JSON.stringify(list);
    if (s === sig) return;
    sig = s;
    const active = list.filter((m) => m.status === 'active');
    const done = list.filter((m) => m.status === 'done');
    const locked = list.filter((m) => m.status === 'locked');
    fill(el, 
      h('section', { class: 'mis-sec' }, h('h3', { class: 'sec-title', text: 'Actieve missie' }),
        active.length ? active.map((m) => h('article', { class: 'mission-card active' },
          h('div', { class: 'mission-head' }, icon('mission'), h('h4', { text: m.title })), h('p', { class: 'mission-desc', text: m.description }), objectives(m)))
          : h('p', { class: 'empty-note', text: 'Geen actieve missie.' })),
      done.length ? h('section', { class: 'mis-sec' }, h('h3', { class: 'sec-title', text: `Voltooid (${done.length})` }),
        done.map((m) => h('article', { class: 'mission-card done' }, h('div', { class: 'mission-head' }, icon('check'), h('h4', { text: m.title })), h('p', { class: 'mission-desc', text: m.description })))) : null,
      locked.length ? h('section', { class: 'mis-sec' }, h('h3', { class: 'sec-title', text: 'Vergrendeld' }),
        locked.map(() => h('article', { class: 'mission-card locked' }, h('div', { class: 'mission-head' }, icon('lock'), h('h4', { text: '???' }))))) : null);
  }
  bus.on('mission:started', () => { if (el.closest('.screen.is-open')) render(); });
  for (const ev of ['mission:updated', 'mission:completed', 'objective:completed']) bus.on(ev, () => { sig = ''; if (el.closest('.screen.is-open')) render(); });
  return { el, onShow() { sig = ''; render(); } };
}
