// Item definitions (Dutch names). Ids are part of the contract in docs/ARCHITECTURE.md.

const mat = (id, name, description) => ({ id, name, description, category: 'material', stack: 20 });

export const ITEMS = Object.freeze({
  wood: mat('wood', 'Hout', 'Een stevige tak, droog genoeg om te branden of te bewerken.'),
  stone: mat('stone', 'Steen', 'Een scherpe, zware steen. Altijd handig.'),
  fiber: mat('fiber', 'Plantvezel', 'Taaie groene vezels, goed te vlechten tot touw.'),
  resin: mat('resin', 'Hars', 'Plakkerige amberkleurige hars. Brandt langzaam en helder.'),
  cloth: mat('cloth', 'Lap stof', 'Een stuk gerafelde stof, geschikt als lont of verband.'),
  scrap: mat('scrap', 'Metaalschroot', 'Verroeste metalen platen en buizen van een lang vergeten tijd.'),
  rope: { id: 'rope', name: 'Touw', description: 'Stevig gevlochten touw van plantvezels.', category: 'material', stack: 20 },
  torch: { id: 'torch', name: 'Toorts', description: 'Een brandende lichtbron voor donkere plekken. Druk op F om hem aan te steken.', category: 'tool', stack: 1 },
  crowbar: { id: 'crowbar', name: 'Koevoet', description: 'Een zware koevoet van schroot. Ideaal om dichtgespijkerde planken open te breken.', category: 'tool', stack: 1 },
  sundisc: { id: 'sundisc', name: 'Zonneschijf', description: 'Een gouden schijf met een zon erin gegraveerd. Het metaal voelt warm aan, ook in het donker.', category: 'artifact', stack: 1 },
  keycard: { id: 'keycard', name: 'Sleutelkaart K-7', description: 'Een toegangskaart voor de oude bunker K-7. Niveau 3.', category: 'key', stack: 1 },
});

/** Dutch display name of an item id (falls back to the id). */
export function itemName(id) { return ITEMS[id]?.name ?? id; }
