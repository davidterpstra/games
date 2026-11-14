// Settings panel: every key of DEFAULT_SETTINGS except language. Changes apply live via Settings.set.
import { h, btn, icon } from './dom.js';

const GROUPS = [
  { title: 'Besturing', rows: [
    { key: 'mouseSensitivity', label: 'Muisgevoeligheid', type: 'range', min: 0.2, max: 3, step: 0.05, fmt: (v) => v.toFixed(2) + '×' },
    { key: 'invertY', label: 'Y-as omkeren', type: 'toggle' },
    { key: 'fov', label: 'Beeldhoek (FOV)', type: 'range', min: 60, max: 100, step: 1, fmt: (v) => Math.round(v) + '°' },
    { key: 'headBob', label: 'Camerabeweging bij lopen', type: 'toggle' },
  ] },
  { title: 'Geluid', rows: [
    { key: 'masterVolume', label: 'Hoofdvolume', type: 'range', min: 0, max: 1, step: 0.01, fmt: (v) => Math.round(v * 100) + '%' },
    { key: 'sfxVolume', label: 'Effecten', type: 'range', min: 0, max: 1, step: 0.01, fmt: (v) => Math.round(v * 100) + '%' },
    { key: 'ambientVolume', label: 'Omgeving en muziek', type: 'range', min: 0, max: 1, step: 0.01, fmt: (v) => Math.round(v * 100) + '%' },
  ] },
  { title: 'Beeld', rows: [
    { key: 'quality', label: 'Grafische kwaliteit', type: 'choice', options: [['auto', 'Auto'], ['low', 'Laag'], ['medium', 'Midden'], ['high', 'Hoog']], restart: true },
    { key: 'shadows', label: 'Schaduwen', type: 'toggle' },
    { key: 'renderScale', label: 'Renderschaal', type: 'range', min: 0.5, max: 1, step: 0.05, fmt: (v) => Math.round(v * 100) + '%' },
    { key: 'showFps', label: 'FPS tonen', type: 'toggle' },
  ] },
];

/** Builds the settings panel content. `ctx.settings` is the Settings store. */
export function createSettingsPanel(ctx) {
  const S = ctx.game.settings;
  const refreshers = [];
  const root = h('div', { class: 'settings-panel' });
  const initialQuality = ctx.initialQuality;

  const restartNote = h('div', { class: 'restart-note' },
    icon('restart'), h('span', { text: 'Wordt toegepast na herstart.' }),
    btn('Nu herstarten', { cls: 'btn-small btn-primary', onClick: () => {
      if (ctx.game.state !== 'menu' && ctx.game.state !== 'loading') ctx.request('save');
      setTimeout(() => location.reload(), 120);
    } }));
  const updateRestart = () => { restartNote.classList.toggle('is-on', S.get('quality') !== initialQuality); };

  for (const g of GROUPS) {
    const sec = h('section', { class: 'set-group' }, h('h3', { class: 'sec-title', text: g.title }));
    for (const r of g.rows) {
      const id = 'set-' + r.key;
      let control, refresh;
      if (r.type === 'range') {
        const out = h('output', { class: 'set-val', for: id });
        const input = h('input', { type: 'range', id, min: r.min, max: r.max, step: r.step, class: 'slider' });
        const paint = () => { const v = Number(input.value); out.textContent = r.fmt(v); input.style.setProperty('--fill', ((v - r.min) / (r.max - r.min) * 100).toFixed(1) + '%'); };
        input.addEventListener('input', () => { paint(); S.set(r.key, Number(input.value)); });
        input.addEventListener('change', () => ctx.sfx('ui_click'));
        refresh = () => { input.value = S.get(r.key); paint(); };
        control = h('div', { class: 'set-control' }, input, out);
      } else if (r.type === 'toggle') {
        const sw = h('button', { type: 'button', role: 'switch', id, class: 'switch' }, h('span', { class: 'switch-knob' }));
        sw.addEventListener('click', () => S.set(r.key, !S.get(r.key)));
        refresh = () => { const on = !!S.get(r.key); sw.setAttribute('aria-checked', String(on)); sw.classList.toggle('is-on', on); };
        control = h('div', { class: 'set-control' }, sw, h('span', { class: 'switch-label' }));
        const lbl = control.querySelector('.switch-label');
        const base = refresh; refresh = () => { base(); lbl.textContent = S.get(r.key) ? 'Aan' : 'Uit'; };
      } else {
        const btns = r.options.map(([val, label]) => {
          const b = h('button', { type: 'button', class: 'seg', role: 'radio', text: label });
          b.addEventListener('click', () => { S.set(r.key, val); });
          b._val = val;
          return b;
        });
        const group = h('div', { class: 'segmented', role: 'radiogroup', 'aria-labelledby': id + '-l' }, btns);
        refresh = () => btns.forEach((b) => { const on = b._val === S.get(r.key); b.classList.toggle('is-on', on); b.setAttribute('aria-checked', String(on)); });
        control = h('div', { class: 'set-control set-control-wide' }, group);
      }
      refreshers.push(refresh);
      sec.append(h('div', { class: 'set-row' }, h('label', { class: 'set-label', id: id + '-l', for: id, text: r.label }), control));
      if (r.restart) sec.append(restartNote);
    }
    root.append(sec);
  }
  root.append(h('div', { class: 'btn-row set-actions' },
    btn('Standaardwaarden', { cls: 'btn-ghost', ic: 'restart', onClick: () => { S.reset(); } })));

  const refreshAll = () => { refreshers.forEach((f) => f()); updateRestart(); };
  refreshAll();
  const off = ctx.bus.on('settings:changed', refreshAll);
  return { el: root, destroy: off };
}
