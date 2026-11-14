// Crafting recipes. Ingredients are consumed, the result is added to the inventory.
import { ITEMS } from './items.js';

export const RECIPES = Object.freeze([
  { id: 'rope', result: { itemId: 'rope', count: 1 }, ingredients: [{ itemId: 'fiber', count: 3 }], description: 'Vlecht plantvezels tot een stevig touw.' },
  { id: 'torch', result: { itemId: 'torch', count: 1 }, ingredients: [{ itemId: 'wood', count: 2 }, { itemId: 'resin', count: 1 }, { itemId: 'cloth', count: 1 }], description: 'Een brandende toorts voor donkere plekken.' },
  { id: 'crowbar', result: { itemId: 'crowbar', count: 1 }, ingredients: [{ itemId: 'scrap', count: 2 }, { itemId: 'rope', count: 1 }], description: 'Een koevoet om planken en roest te lijf te gaan.' },
]);

/**
 * @param {{bus, inventory}} deps
 */
export function createCrafting({ bus, inventory }) {
  const crafted = new Set(); // recipe ids crafted at least once (used by missions, saved)
  const find = (id) => RECIPES.find((r) => r.id === id);

  const crafting = {
    recipes: RECIPES,
    crafted,
    canCraft(id) {
      const r = find(id);
      return !!r && r.ingredients.every((i) => inventory.has(i.itemId, i.count));
    },
    craft(id) {
      const r = find(id);
      if (!r || !crafting.canCraft(id)) { bus.emit('sfx', { name: 'error' }); return false; }
      for (const i of r.ingredients) inventory.remove(i.itemId, i.count);
      const added = inventory.add(r.result.itemId, r.result.count);
      if (added < r.result.count) { // no room: roll back
        if (added > 0) inventory.remove(r.result.itemId, added);
        for (const i of r.ingredients) inventory.add(i.itemId, i.count);
        bus.emit('sfx', { name: 'error' });
        return false;
      }
      crafted.add(id);
      const name = ITEMS[r.result.itemId].name;
      bus.emit('sfx', { name: 'craft' });
      bus.emit('craft:done', { recipeId: id, itemId: r.result.itemId, name });
      bus.emit('notify', { text: `Gemaakt: ${name}`, type: 'success' });
      if (id === 'torch') bus.emit('notify', { text: 'Druk op F om je toorts aan te steken.', type: 'info' });
      return true;
    },
    reset() { crafted.clear(); },
    serialize() { return [...crafted]; },
    restore(list) { crafted.clear(); if (Array.isArray(list)) for (const id of list) if (find(id)) crafted.add(id); },
  };
  return crafting;
}
