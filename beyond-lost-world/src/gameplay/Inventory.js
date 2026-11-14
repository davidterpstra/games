// Fixed-size inventory (24 slots) with stacking. `slots` is a stable array that is mutated in place.
import { ITEMS } from './items.js';

export const SLOT_COUNT = 24;

/**
 * @param {{bus: import('../core/EventBus.js').EventBus}} deps
 */
export function createInventory({ bus }) {
  const slots = new Array(SLOT_COUNT).fill(null);
  const changed = () => bus.emit('inventory:changed', { slots });

  const inventory = {
    slots,
    /** Adds up to n items; returns how many fitted. */
    add(id, n = 1) {
      const def = ITEMS[id];
      if (!def || n <= 0) return 0;
      let left = n;
      for (const s of slots) {
        if (left <= 0) break;
        if (s && s.itemId === id && s.count < def.stack) {
          const put = Math.min(def.stack - s.count, left);
          s.count += put; left -= put;
        }
      }
      for (let i = 0; i < slots.length && left > 0; i++) {
        if (!slots[i]) {
          const put = Math.min(def.stack, left);
          slots[i] = { itemId: id, count: put }; left -= put;
        }
      }
      const added = n - left;
      if (added > 0) changed();
      if (left > 0) bus.emit('notify', { text: 'Je tas is vol.', type: 'warning' });
      return added;
    },
    /** Removes exactly n items; false (and nothing removed) if there are not enough. */
    remove(id, n = 1) {
      if (n <= 0) return true;
      if (inventory.count(id) < n) return false;
      let left = n;
      for (let i = slots.length - 1; i >= 0 && left > 0; i--) {
        const s = slots[i];
        if (s && s.itemId === id) {
          const take = Math.min(s.count, left);
          s.count -= take; left -= take;
          if (s.count <= 0) slots[i] = null;
        }
      }
      changed();
      return true;
    },
    count(id) { let c = 0; for (const s of slots) if (s && s.itemId === id) c += s.count; return c; },
    has(id, n = 1) { return inventory.count(id) >= n; },
    /** Number of items of `id` that could still be added. */
    room(id) {
      const def = ITEMS[id]; if (!def) return 0;
      let r = 0;
      for (const s of slots) r += s ? (s.itemId === id ? def.stack - s.count : 0) : def.stack;
      return r;
    },
    clear() { slots.fill(null); changed(); },
    serialize() { return slots.map((s) => (s ? { itemId: s.itemId, count: s.count } : null)); },
    /** Replaces the contents with validated saved data. */
    restore(data) {
      slots.fill(null);
      if (Array.isArray(data)) {
        for (let i = 0; i < Math.min(SLOT_COUNT, data.length); i++) {
          const s = data[i];
          if (s && ITEMS[s.itemId] && Number.isFinite(s.count) && s.count > 0) slots[i] = { itemId: s.itemId, count: Math.min(ITEMS[s.itemId].stack, Math.floor(s.count)) };
        }
      }
      changed();
    },
  };
  return inventory;
}
