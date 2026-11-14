// Inventory screen with tabs: Inventaris, Crafting, Missies, Dagboek, Kaart. Remembers the last tab.
import { h, icon, safeStorage } from './dom.js';
import { createItemsTab } from './ItemsTab.js';
import { createCraftingTab } from './CraftingTab.js';
import { createMissionsTab } from './MissionsTab.js';
import { createJournalTab } from './JournalTab.js';
import { createMapTab } from './MapTab.js';

const TABS = [
  { id: 'items', label: 'Inventaris', icon: 'inventory', make: createItemsTab },
  { id: 'crafting', label: 'Crafting', icon: 'crafting', make: createCraftingTab },
  { id: 'missions', label: 'Missies', icon: 'mission', make: createMissionsTab },
  { id: 'journal', label: 'Dagboek', icon: 'journal', make: createJournalTab },
  { id: 'map', label: 'Kaart', icon: 'map', make: createMapTab },
];
const store = safeStorage();

export function createInventoryScreen(ctx) {
  const tabs = new Map();
  const tabBar = h('div', { class: 'tabs', role: 'tablist' });
  const body = h('div', { class: 'tab-body' });
  const closeBtn = h('button', { class: 'icon-btn inv-close', type: 'button', 'aria-label': 'Sluiten', title: 'Sluiten [Tab]' }, icon('close'));
  closeBtn.addEventListener('click', () => ctx.request('closeInventory'));

  TABS.forEach((t, i) => {
    const mod = t.make(ctx);
    const pane = h('div', { class: 'tab-pane', role: 'tabpanel', id: 'pane-' + t.id }, mod.el);
    const b = h('button', { class: 'tab', type: 'button', role: 'tab', id: 'tab-' + t.id, 'aria-controls': 'pane-' + t.id, title: `${t.label} [${i + 1}]` },
      icon(t.icon), h('span', { class: 'tab-label', text: t.label }));
    b.addEventListener('click', () => select(t.id));
    tabBar.append(b);
    body.append(pane);
    tabs.set(t.id, { ...t, mod, pane, button: b });
  });

  const el = h('section', { class: 'screen inventory-screen', 'aria-label': 'Inventaris' },
    h('div', { class: 'panel inv-panel' },
      h('header', { class: 'inv-head' }, tabBar, closeBtn),
      body));

  let current = store.get('beyond.tab.v1');
  if (!tabs.has(current)) current = 'items';
  let open = false;

  function select(id, silent = false) {
    if (!tabs.has(id)) return;
    current = id;
    store.set('beyond.tab.v1', id);
    for (const [tid, t] of tabs) {
      const on = tid === id;
      t.pane.classList.toggle('is-on', on);
      t.button.classList.toggle('is-on', on);
      t.button.setAttribute('aria-selected', String(on));
      t.button.tabIndex = on ? 0 : -1;
      t.pane.inert = !on;
    }
    if (!silent) ctx.sfx('ui_click');
    if (open) tabs.get(id).mod.onShow?.();
  }
  select(current, true);

  // Tab shortcuts while the screen is open (Tab/I/M/Esc close it in main.js).
  window.addEventListener('keydown', (e) => {
    if (!open || ctx.modals.active) return;
    const n = Number(e.key);
    if (n >= 1 && n <= TABS.length && !e.ctrlKey && !e.metaKey && !e.altKey) { select(TABS[n - 1].id); e.preventDefault(); return; }
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      if (document.activeElement && document.activeElement.closest('.tab-pane') && document.activeElement.tagName === 'INPUT') return;
      const i = TABS.findIndex((t) => t.id === current);
      if (document.activeElement && document.activeElement.classList.contains('tab')) {
        select(TABS[(i + (e.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length].id);
        tabs.get(current).button.focus();
        e.preventDefault();
      }
    }
  });

  return {
    el,
    selectTab: select,
    onShow() { open = true; select(current, true); tabs.get(current).mod.onShow?.(); },
    onHide() { open = false; },
    update(dt) { tabs.get(current)?.mod.update?.(dt); },
  };
}
