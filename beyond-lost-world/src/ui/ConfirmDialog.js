// Confirm dialog for destructive actions. confirm({...}) → Promise<boolean>.
import { h, btn } from './dom.js';

export function createConfirm(ctx) {
  return function confirm({ title = 'Weet je het zeker?', text = '', confirmLabel = 'Bevestigen', cancelLabel = 'Annuleren', danger = false } = {}) {
    return new Promise((resolve) => {
      let result = false;
      const yes = btn(confirmLabel, { cls: danger ? 'btn-danger' : 'btn-primary', attrs: { 'data-autofocus': '' } });
      const no = btn(cancelLabel, { cls: 'btn-ghost' });
      const content = h('div', { class: 'confirm' }, h('p', { class: 'confirm-text', text }), h('div', { class: 'btn-row' }, no, yes));
      const m = ctx.modals.open({ title, content, small: true, className: 'confirm-panel', onClose: () => resolve(result) });
      yes.addEventListener('click', () => { result = true; m.close(true); });
      no.addEventListener('click', () => m.close(false));
    });
  };
}
