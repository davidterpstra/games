/* Product catalogue. Add a product by adding one line to PRODUCTS — nothing
 * else needs to change. Prices are in euros here and converted to cents by
 * the Product class.
 *
 *   id       unique key (also used in saves)
 *   dept     department -> decides which fixture ("schap") it sits on
 *   buy      purchase price per unit (inkoopprijs)
 *   sell     base selling price per unit (verkoopprijs), always > buy
 *   pop      popularity: how often customers want it
 *   rarity   common | rare | epic | legendary
 *   unlock   player level that unlocks it
 *   pack     units per ordered box
 *   stores   optional list of store ids that sell it (default: every store)
 */
(function (MS) {
  'use strict';

  MS.RARITY = {
    common: { id: 'common', name: 'Common', icon: '🟢', color: '#3fae5a', xp: 1, order: 0 },
    rare: { id: 'rare', name: 'Rare', icon: '🔵', color: '#2f80ed', xp: 2, order: 1 },
    epic: { id: 'epic', name: 'Epic', icon: '🟣', color: '#9b51e0', xp: 4, order: 2 },
    legendary: { id: 'legendary', name: 'Legendary', icon: '🟡', color: '#e5a100', xp: 7, order: 3 },
  };

  /* fixture: how the shelf is drawn and what the player sees as "schap". */
  MS.FIXTURES = {
    crate: { name: 'Groentekrat', icon: '🧺' },
    rack: { name: 'Broodrek', icon: '🥖' },
    fridge: { name: 'Koelvak', icon: '🧊' },
    freezer: { name: 'Vriezer', icon: '❄️' },
    shelf: { name: 'Schap', icon: '🗄️' },
    counter: { name: 'Versvitrine', icon: '🥩' },
  };

  /* storeLevel: the expansion level a store needs before the department opens. */
  MS.DEPARTMENTS = {
    produce: { name: 'Groente & Fruit', fixture: 'crate', storeLevel: 1 },
    bakery: { name: 'Bakkerij', fixture: 'rack', storeLevel: 1 },
    dairy: { name: 'Zuivel', fixture: 'fridge', storeLevel: 1 },
    drinks: { name: 'Dranken', fixture: 'fridge', storeLevel: 1 },
    snacks: { name: 'Snoep & Snacks', fixture: 'shelf', storeLevel: 1 },
    pantry: { name: 'Houdbaar', fixture: 'shelf', storeLevel: 1 },
    frozen: { name: 'Diepvries', fixture: 'freezer', storeLevel: 1 },
    fresh: { name: 'Vlees & Vis', fixture: 'counter', storeLevel: 4 },
  };

  const P = (id, name, emoji, dept, buy, sell, pop, rarity, unlock, pack, stores) =>
    ({ id, name, emoji, dept, buy, sell, pop, rarity, unlock, pack, stores: stores || null });

  MS.PRODUCTS = [
    // --- The 10 starter products ---------------------------------------
    P('apple', 'Appel', '🍎', 'produce', 0.45, 1.40, 10, 'common', 1, 12),
    P('banana', 'Banaan', '🍌', 'produce', 0.40, 1.30, 9, 'common', 1, 12),
    P('bread', 'Brood', '🍞', 'bakery', 1.10, 3.20, 10, 'common', 1, 8),
    P('milk', 'Melk', '🥛', 'dairy', 0.85, 2.50, 10, 'common', 1, 10),
    P('eggs', 'Eieren', '🥚', 'dairy', 1.50, 4.30, 8, 'common', 1, 8),
    P('cheese', 'Kaas', '🧀', 'dairy', 2.60, 7.00, 7, 'common', 1, 6),
    P('soda', 'Frisdrank', '🥤', 'drinks', 0.90, 2.90, 9, 'common', 1, 12),
    P('chocolate', 'Chocolade', '🍫', 'snacks', 1.20, 3.60, 8, 'common', 1, 10),
    P('cookies', 'Koekjes', '🍪', 'snacks', 1.00, 3.10, 8, 'common', 1, 10),
    P('pizza', 'Pizza', '🍕', 'frozen', 2.40, 6.50, 7, 'common', 1, 6),

    // --- Unlocked by levelling up ---------------------------------------
    P('carrot', 'Wortel', '🥕', 'produce', 0.30, 1.10, 7, 'common', 2, 12),
    P('tomato', 'Tomaat', '🍅', 'produce', 0.50, 1.60, 7, 'common', 2, 12),
    P('water', 'Water', '💧', 'drinks', 0.30, 1.20, 8, 'common', 3, 12),
    P('croissant', 'Croissant', '🥐', 'bakery', 0.70, 2.30, 7, 'common', 3, 10),
    P('butter', 'Boter', '🧈', 'dairy', 1.30, 3.80, 6, 'common', 4, 8),
    P('juice', 'Sap', '🧃', 'drinks', 0.90, 2.70, 7, 'common', 4, 10),
    P('popcorn', 'Popcorn', '🍿', 'snacks', 0.80, 2.60, 6, 'common', 5, 10),
    P('pasta', 'Pasta', '🍝', 'pantry', 0.90, 2.90, 7, 'common', 5, 10),
    P('grapes', 'Druiven', '🍇', 'produce', 1.80, 6.00, 5, 'rare', 5, 8),
    P('rice', 'Rijst', '🍚', 'pantry', 0.80, 2.60, 6, 'common', 6, 10),
    P('donut', 'Donut', '🍩', 'bakery', 0.60, 2.20, 7, 'common', 6, 10),
    P('strawberry', 'Aardbeien', '🍓', 'produce', 2.00, 6.60, 5, 'rare', 6, 8),
    P('icecream', 'IJs', '🍦', 'frozen', 1.40, 4.40, 7, 'common', 7, 8),
    P('fries', 'Friet', '🍟', 'frozen', 1.20, 3.80, 7, 'common', 7, 8),
    P('cupcake', 'Cupcake', '🧁', 'bakery', 1.50, 5.60, 4, 'rare', 7, 8),
    P('coffee', 'Koffie', '☕', 'pantry', 2.40, 6.90, 6, 'common', 8, 8),
    P('avocado', 'Avocado', '🥑', 'produce', 1.60, 5.50, 5, 'rare', 8, 8),
    P('honey', 'Honing', '🍯', 'pantry', 3.00, 9.90, 4, 'rare', 9, 6),
    P('chicken', 'Kip', '🍗', 'fresh', 3.20, 9.40, 6, 'common', 8, 6),
    P('bacon', 'Spek', '🥓', 'fresh', 2.50, 7.30, 6, 'common', 8, 8),
    P('wine', 'Wijn', '🍷', 'drinks', 6.00, 15.00, 3, 'epic', 9, 6),
    P('pineapple', 'Ananas', '🍍', 'produce', 2.20, 7.30, 4, 'rare', 10, 6),
    P('fish', 'Vis', '🐟', 'fresh', 4.00, 11.50, 5, 'rare', 10, 6),
    P('sushi', 'Sushi', '🍣', 'fresh', 7.00, 17.00, 3, 'epic', 11, 6),
    P('shrimp', 'Garnalen', '🦐', 'fresh', 6.50, 16.00, 3, 'epic', 12, 6),
    P('cake', 'Legendary Cake', '🍰', 'bakery', 18.00, 42.00, 1.6, 'legendary', 12, 4),
    P('lobster', 'Kreeft', '🦞', 'fresh', 14.00, 32.00, 2, 'epic', 13, 4),
    P('luxchoc', 'Luxury Chocolate', '💎', 'snacks', 20.00, 46.00, 1.5, 'legendary', 14, 4),
    P('steak', 'Premium Steak', '🥩', 'fresh', 25.00, 56.00, 1.5, 'legendary', 15, 4),
    P('goldsoda', 'Golden Soda', '🍾', 'drinks', 30.00, 66.00, 1.2, 'legendary', 17, 4),

    // --- Store specials --------------------------------------------------
    P('bagel', 'Bagel', '🥯', 'bakery', 0.90, 3.10, 8, 'common', 1, 10, ['city']),
    P('hotdog', 'Hotdog', '🌭', 'frozen', 1.40, 4.70, 8, 'common', 1, 8, ['city']),
    P('burger', 'Burger', '🍔', 'frozen', 2.20, 7.00, 7, 'rare', 1, 8, ['city', 'downtown']),
    P('noodles', 'Noedels', '🍜', 'pantry', 1.10, 3.80, 7, 'common', 1, 10, ['city', 'downtown']),
    P('coconut', 'Kokosnoot', '🥥', 'produce', 1.20, 4.40, 8, 'common', 1, 8, ['beach']),
    P('watermelon', 'Watermeloen', '🍉', 'produce', 2.00, 6.80, 7, 'common', 1, 6, ['beach']),
    P('mango', 'Mango', '🥭', 'produce', 1.80, 6.40, 6, 'rare', 1, 8, ['beach']),
    P('cocktail', 'Cocktail', '🍹', 'drinks', 3.50, 11.50, 5, 'epic', 1, 6, ['beach']),
    P('shavedice', 'Schaafijs', '🍧', 'frozen', 1.20, 4.30, 8, 'common', 1, 8, ['beach']),
    P('pretzel', 'Pretzel', '🥨', 'bakery', 0.80, 2.90, 8, 'common', 1, 10, ['mountain']),
    P('mushroom', 'Paddenstoelen', '🍄', 'produce', 1.50, 5.10, 6, 'common', 1, 8, ['mountain']),
    P('stew', 'Stoofpot', '🍲', 'pantry', 2.80, 9.10, 6, 'rare', 1, 6, ['mountain']),
    P('tea', 'Thee', '🍵', 'pantry', 1.40, 4.70, 7, 'common', 1, 10, ['mountain']),
    P('chestnut', 'Kastanjes', '🌰', 'snacks', 1.60, 5.50, 6, 'common', 1, 8, ['mountain']),
    P('bento', 'Bento Box', '🍱', 'fresh', 5.50, 17.50, 5, 'epic', 1, 6, ['downtown']),
    P('champagne', 'Champagne', '🥂', 'drinks', 16.00, 36.00, 2, 'epic', 1, 4, ['downtown']),
    P('dumplings', 'Dumplings', '🥟', 'frozen', 2.00, 6.80, 7, 'common', 1, 8, ['downtown']),
    P('mooncake', 'Maancake', '🥮', 'bakery', 3.00, 10.50, 4, 'rare', 1, 6, ['downtown']),
  ];

  // Sanity check so a typo in the table is caught during development.
  for (const p of MS.PRODUCTS) {
    if (p.sell <= p.buy) console.warn(`[MS] product ${p.id} sells for less than it costs`);
    if (!MS.DEPARTMENTS[p.dept]) console.warn(`[MS] product ${p.id} has unknown department ${p.dept}`);
  }
})((window.MS = window.MS || {}));
