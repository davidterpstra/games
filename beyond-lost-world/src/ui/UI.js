// BEYOND UI entry point: createUI({ root, bus, game }) → { update(dt) }.
// Screens are shown/hidden by 'game:state'. The UI never changes game state itself: it emits
// `ui:request` (main performs it) or calls documented gameplay APIs (crafting.craft) and Settings.set.
import { h } from './dom.js';
import { createModalHost } from './Modal.js';
import { createConfirm } from './ConfirmDialog.js';
import { createLoadingScreen } from './LoadingScreen.js';
import { createMainMenu } from './MainMenu.js';
import { createPauseMenu } from './PauseMenu.js';
import { createHud } from './Hud.js';
import { createToasts } from './Toasts.js';
import { createInventoryScreen } from './InventoryScreen.js';
import { createDocumentReader } from './DocumentReader.js';
import { createEndingScreen } from './EndingScreen.js';
import { createSettingsPanel } from './SettingsPanel.js';
import { createControlsPanel } from './ControlsPanel.js';
import { createAboutPanel } from './AboutPanel.js';

/**
 * @param {{ root: HTMLElement, bus: import('../core/EventBus.js').EventBus, game: object }} opts
 * @returns {{ update(dt: number): void, ctx: object }}
 */
export function createUI({ root, bus, game }) {
  root.classList.add('ui-root');
  const params = new URLSearchParams(location.search);
  const coarse = window.matchMedia ? window.matchMedia('(pointer: coarse)') : { matches: false };

  const ctx = {
    root, bus, game, params,
    initialQuality: game.settings.get('quality'),
    isTouch: () => !!(game.input && game.input.isTouch) || coarse.matches,
    sfx: (name) => bus.emit('sfx', { name }),
    request: (action) => bus.emit('ui:request', { action }),
    modals: null, confirm: null,
    openPanel: null,
  };
  ctx.modals = createModalHost(ctx);
  ctx.confirm = createConfirm(ctx);
  ctx.openPanel = (name) => {
    if (name === 'settings') {
      const p = createSettingsPanel(ctx);
      ctx.modals.open({ title: 'Instellingen', content: p.el, className: 'panel-settings', onClose: () => p.destroy() });
    } else if (name === 'controls') {
      ctx.modals.open({ title: 'Besturing', content: createControlsPanel(), className: 'panel-controls' });
    } else if (name === 'about') {
      ctx.modals.open({ title: 'Over het spel', content: createAboutPanel(ctx), className: 'panel-about' });
    }
  };

  const loading = createLoadingScreen(ctx);
  const menu = createMainMenu(ctx);
  const hud = createHud(ctx);
  const pause = createPauseMenu(ctx);
  const inventory = createInventoryScreen(ctx);
  const reader = createDocumentReader(ctx);
  const ending = createEndingScreen(ctx);
  const toasts = createToasts(ctx);

  const byState = { loading, menu, playing: hud, paused: pause, inventory, reading: reader, ending };
  const all = [loading, menu, hud, pause, inventory, reader, ending];
  root.append(...all.map((s) => s.el), toasts.el, ctx.modals.el);
  for (const s of all) { s.el.inert = true; s.el.classList.add('ui-screen'); }

  let current = null;
  function setState(state) {
    const next = byState[state] || null;
    if (next === current) return;
    const prev = current;
    prev?.onHide?.();
    current = next;
    root.dataset.state = state;
    for (const s of all) {
      const on = s === next;
      s.el.classList.toggle('is-open', on);
      s.el.inert = !on;
      s.el.setAttribute('aria-hidden', String(!on));
    }
    if (state !== 'menu' && state !== 'paused' && state !== 'loading') ctx.modals.closeAll();
    next?.onShow?.();
  }
  root.dataset.touch = String(ctx.isTouch());

  bus.on('game:state', ({ state }) => setState(state));
  // M (or the openMap request) opens the inventory on the map tab.
  bus.on('input:action', ({ action }) => { if (action === 'map' && game.state === 'playing') inventory.selectTab('map', true); });
  bus.on('ui:request', ({ action }) => { if (action === 'openMap' && game.state === 'playing') inventory.selectTab('map', true); });
  // Click the document sheet area outside is not close; E/Esc handled by main.
  bus.on('document:close', () => ctx.sfx('ui_close'));

  // Hover / click sounds for every interactive control (delegated).
  let lastHover = null;
  root.addEventListener('pointerover', (e) => {
    const t = e.target.closest && e.target.closest('button, .seg, .slot, .recipe, .doc-item');
    if (t && t !== lastHover && !t.disabled) { lastHover = t; ctx.sfx('ui_hover'); } else if (!t) lastHover = null;
  });
  root.addEventListener('click', (e) => {
    const t = e.target.closest && e.target.closest('button');
    if (t && !t.disabled && !t.hasAttribute('data-nosfx')) ctx.sfx('ui_click');
  });

  // Keyboard navigation in vertical menus (arrow keys).
  root.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    const list = e.target.closest && e.target.closest('.menu-list');
    if (!list) return;
    const bs = [...list.querySelectorAll('button')];
    const i = bs.indexOf(document.activeElement);
    bs[(i + (e.key === 'ArrowDown' ? 1 : bs.length - 1)) % bs.length].focus();
    e.preventDefault();
  });

  setState(game.state || 'loading');

  function update(dt) {
    current?.update?.(dt);
  }
  // Loading screen animates until the menu is up; HUD only ticks while playing.
  return { update, ctx };
}
