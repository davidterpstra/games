// Document reader: note/journal = aged paper (serif), terminal = green monospace with typewriter reveal,
// recording = cassette transcript. Closing emits `document:close`.
import { h, icon, btn } from './dom.js';

const KIND_LABEL = { note: 'Notitie', journal: 'Dagboek', terminal: 'Terminal', recording: 'Opname' };
const CPS = 70; // typewriter characters per second

export function createDocumentReader(ctx) {
  const { bus } = ctx;
  const body = h('div', { class: 'doc-body scroll' });
  const closeBtn = btn(ctx.isTouch() ? 'Sluiten' : 'Sluiten [E]', { cls: 'btn-primary btn-small', ic: 'close', onClick: () => bus.emit('document:close', {}) });
  const skipBtn = btn('Overslaan', { cls: 'btn-ghost btn-small', ic: 'skip', onClick: () => skip() });
  const sheet = h('article', { class: 'doc-sheet' });
  const el = h('section', { class: 'screen reader-screen', 'aria-label': 'Document' }, sheet);

  let typed = null, typedFull = '', typedN = 0, typing = false;

  function skip() {
    if (!typing) return;
    typing = false; typedN = typedFull.length; paintTyped(); skipBtn.classList.add('hidden');
  }
  function paintTyped() {
    typed.done.textContent = typedFull.slice(0, typedN);
    typed.rest.textContent = typedFull.slice(typedN);
    typed.cursor.classList.toggle('hidden', !typing);
  }

  function open({ title, body: text = '', kind = 'note' }) {
    sheet.className = `doc-sheet kind-${kind}`;
    typing = false; typed = null;
    const head = h('header', { class: 'doc-head' },
      h('span', { class: 'doc-kind' }, icon(kind === 'terminal' ? 'terminal' : kind === 'recording' ? 'tape' : 'journal'), h('span', { text: KIND_LABEL[kind] || 'Document' })),
      h('h2', { class: 'doc-heading', text: title || '' }));
    body.scrollTop = 0;
    let content;
    if (kind === 'terminal') {
      typed = { done: h('span'), rest: h('span', { class: 'ghost' }), cursor: h('span', { class: 'cursor', text: '█' }) };
      typedFull = text; typedN = 0; typing = true; skipBtn.classList.remove('hidden');
      content = h('div', { class: 'term-text', 'aria-label': text }, typed.done, typed.cursor, typed.rest);
      paintTyped();
    } else if (kind === 'recording') {
      const reels = h('div', { class: 'reels', 'aria-hidden': 'true' }, h('span', { class: 'reel' }), h('span', { class: 'reel' }));
      content = h('div', { class: 'rec-wrap' }, h('div', { class: 'rec-tape' }, reels, h('span', { class: 'rec-label', text: 'OPNAME · TRANSCRIPT' })), h('div', { class: 'rec-text', text }));
      skipBtn.classList.add('hidden');
    } else {
      content = h('div', { class: 'paper-text', text });
      skipBtn.classList.add('hidden');
    }
    body.replaceChildren(content);
    sheet.replaceChildren(head, body, h('footer', { class: 'doc-foot' }, skipBtn, closeBtn));
    setTimeout(() => closeBtn.focus({ preventScroll: true }), 80);
    ctx.sfx('page');
  }

  bus.on('document:open', open);
  window.addEventListener('keydown', (e) => {
    if (typing && el.classList.contains('is-open') && (e.key === ' ' || e.key === 'Enter')) { e.preventDefault(); skip(); }
  });
  el.addEventListener('pointerdown', (e) => { if (typing && e.target.closest('.term-text')) skip(); });

  return {
    el,
    onShow() { closeBtn.querySelector('.btn-label').textContent = ctx.isTouch() ? 'Sluiten' : 'Sluiten [E]'; },
    update(dt) {
      if (!typing) return;
      const n = Math.min(typedFull.length, typedN + Math.max(1, Math.round(dt * CPS)));
      if (n === typedN) return;
      typedN = n;
      if (n >= typedFull.length) { typing = false; skipBtn.classList.add('hidden'); }
      paintTyped();
      if (typing) body.scrollTop = body.scrollHeight;
    },
  };
}
