// Modal layer: stacked dialogs/panels above every screen (settings, controls, about, confirm).
// Esc closes the top-most modal (captured so main.js does not also treat it as a pause toggle).
import { h, icon, FOCUSABLE } from './dom.js';

export function createModalHost(ctx) {
  const layer = h('div', { class: 'modal-layer', 'aria-live': 'polite' });
  const stack = [];

  /** Open a modal. `content` is a node; returns { close(result) }. */
  function open({ title, content, className = '', onClose, small = false, dismissable = true }) {
    const previouslyFocused = document.activeElement;
    const closeBtn = dismissable ? h('button', { class: 'icon-btn modal-close', type: 'button', 'aria-label': 'Sluiten' }, icon('close')) : null;
    const panel = h('div', { class: `panel modal-panel ${small ? 'modal-small' : ''} ${className}`, role: 'dialog', 'aria-modal': 'true', 'aria-label': title || 'Dialoog' },
      h('header', { class: 'panel-head' }, h('h2', { class: 'panel-title', text: title || '' }), closeBtn),
      h('div', { class: 'panel-body scroll' }, content));
    const backdrop = h('div', { class: 'modal' }, panel);
    const entry = { backdrop, onClose, dismissable, closed: false };
    const close = (result) => {
      if (entry.closed) return;
      entry.closed = true;
      stack.splice(stack.indexOf(entry), 1);
      backdrop.classList.remove('is-open');
      backdrop.inert = true;
      setTimeout(() => backdrop.remove(), 260);
      ctx.sfx('ui_close');
      if (previouslyFocused && previouslyFocused.focus && document.contains(previouslyFocused)) { try { previouslyFocused.focus({ preventScroll: true }); } catch { /* ignore */ } }
      onClose && onClose(result);
      if (!stack.length) layer.classList.remove('has-modal');
    };
    entry.close = close;
    if (closeBtn) closeBtn.addEventListener('click', () => close(undefined));
    backdrop.addEventListener('pointerdown', (e) => { if (e.target === backdrop && dismissable) close(undefined); });
    layer.append(backdrop);
    layer.classList.add('has-modal');
    stack.push(entry);
    ctx.sfx('ui_open');
    requestAnimationFrame(() => {
      backdrop.classList.add('is-open');
      const f = panel.querySelector('[data-autofocus]') || [...panel.querySelectorAll('.panel-body ' + 'button,input,select')].find((n) => n.offsetParent !== null) || closeBtn;
      if (f) f.focus({ preventScroll: true });
    });
    return entry;
  }

  window.addEventListener('keydown', (e) => {
    if (!stack.length) return;
    const top = stack[stack.length - 1];
    if (e.key === 'Escape') {
      e.preventDefault(); e.stopImmediatePropagation();
      if (top.dismissable) top.close(undefined);
    } else if (e.key === 'Tab') {
      // keep focus inside the top-most modal
      const f = [...top.backdrop.querySelectorAll(FOCUSABLE)].filter((n) => n.offsetParent !== null);
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      else if (!top.backdrop.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
      e.stopPropagation();
    }
  }, true);

  return { el: layer, open, get active() { return stack.length > 0; }, closeAll() { [...stack].forEach((m) => m.close()); } };
}
