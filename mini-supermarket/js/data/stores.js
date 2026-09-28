/* Stores and store sizes.
 *
 * STORE_LEVELS describes how a store grows. `right` and `top` are the tile
 * columns/rows of the right and top wall (see systems/layout.js); growing them
 * reveals more floor, shelf spots and checkouts in the world.
 *
 * STORES lists every store the player can own. A new store only needs an
 * entry here (theme colours, prices, customer mix, starting products) plus,
 * optionally, products with `stores: ['<id>']` in products.js.
 */
(function (MS) {
  'use strict';

  MS.STORE_LEVELS = [
    null,
    { level: 1, name: 'Kleine supermarkt', right: 16, top: 6, registers: 1, cost: 0, playerLevel: 1 },
    { level: 2, name: 'Extra ruimte', right: 19, top: 4, registers: 2, cost: 1500, playerLevel: 3 },
    { level: 3, name: 'Grotere winkel', right: 22, top: 4, registers: 3, cost: 3000, playerLevel: 5 },
    { level: 4, name: 'Nieuwe afdeling', right: 25, top: 2, registers: 4, cost: 12000, playerLevel: 8, note: 'Opent de afdeling 🥩 Vlees & Vis' },
    { level: 5, name: 'Grote supermarkt', right: 28, top: 2, registers: 5, cost: 30000, playerLevel: 11, note: 'Maximale grootte, alle upgrades tot level 10' },
  ];
  MS.MAX_STORE_LEVEL = MS.STORE_LEVELS.length - 1;

  const theme = (o) => Object.assign({
    floorA: '#f4efe6', floorB: '#e9e1d3', grout: 'rgba(120,100,70,0.08)',
    wall: '#f7c873', wallDark: '#d99a3d', wallTop: '#fff1d0', trim: '#e2557a',
    accent: '#e2557a', accent2: '#39b37a', sign: '#e2557a', signText: '#fff',
    outside: 'grass', ground: '#9ed36a', groundDark: '#86c056', sidewalk: '#d8d4cc', street: '#5d6470',
    warehouseFloor: '#c9ccd1', night: false,
  }, o);

  MS.STORES = [
    {
      id: 'neighborhood', name: 'Neighborhood Market', icon: '🏪', unlockLevel: 1, price: 0,
      desc: 'Je eerste winkel, in een gezellige woonwijk.',
      priceMult: 1, costMult: 1,
      customerWeights: {},
      starter: ['apple', 'bread', 'milk', 'soda'],
      theme: theme({}),
    },
    {
      id: 'city', name: 'City Market', icon: '🏙️', unlockLevel: 10, price: 25000,
      desc: 'Druk en snel: veel haastige klanten en straatvoedsel zoals 🥯 🌭 🍔 🍜.',
      priceMult: 1.6, costMult: 2.5,
      customerWeights: { hasty: 2.2, rich: 1.3, big: 0.7 },
      starter: ['bagel', 'hotdog', 'soda', 'milk'],
      theme: theme({
        floorA: '#eceff3', floorB: '#dde2e8', wall: '#8fa3b8', wallDark: '#62778c', wallTop: '#d7e1ea',
        trim: '#2f80ed', accent: '#2f80ed', accent2: '#ffcf33', sign: '#2f80ed',
        outside: 'plaza', ground: '#c6c9cf', groundDark: '#b3b7be', sidewalk: '#e0e0e0', street: '#4b515b',
      }),
    },
    {
      id: 'beach', name: 'Beach Market', icon: '🏖️', unlockLevel: 14, price: 80000,
      desc: 'Zon, zee en toeristen die tropisch fruit en 🍹 cocktails willen.',
      priceMult: 2.4, costMult: 6,
      customerWeights: { hasty: 0.6, big: 1.4, rich: 1.2 },
      starter: ['coconut', 'watermelon', 'shavedice', 'soda'],
      theme: theme({
        floorA: '#fdf6e3', floorB: '#f3e6c4', wall: '#7fd3e0', wallDark: '#46aabd', wallTop: '#dff6fa',
        trim: '#ff8a3d', accent: '#ff8a3d', accent2: '#2bb5c6', sign: '#ff8a3d',
        outside: 'sand', ground: '#f2dc9b', groundDark: '#e8cd83', sidewalk: '#efe3c2', street: '#6b6f78',
      }),
    },
    {
      id: 'mountain', name: 'Mountain Market', icon: '🏔️', unlockLevel: 18, price: 250000,
      desc: 'Een knusse berghut met stoofpot, thee en rijke wandelaars.',
      priceMult: 3.5, costMult: 14,
      customerWeights: { rich: 1.8, impatient: 0.5, hasty: 0.5 },
      starter: ['pretzel', 'tea', 'mushroom', 'cheese'],
      theme: theme({
        floorA: '#d9b98f', floorB: '#cda77a', grout: 'rgba(80,50,20,0.14)', wall: '#8b5e3c', wallDark: '#654128',
        wallTop: '#c79a6b', trim: '#c0392b', accent: '#c0392b', accent2: '#2e7d4f', sign: '#c0392b',
        outside: 'snow', ground: '#f4f8fb', groundDark: '#dde8f0', sidewalk: '#cfd6dd', street: '#59606b',
      }),
    },
    {
      id: 'downtown', name: 'Downtown Supermarket', icon: '🌆', unlockLevel: 22, price: 700000,
      desc: 'Een luxe supermarkt midden in de stad, open tot diep in de nacht.',
      priceMult: 5, costMult: 30,
      customerWeights: { rich: 2.6, big: 1.2, normal: 0.7 },
      starter: ['noodles', 'dumplings', 'mooncake', 'champagne'],
      theme: theme({
        floorA: '#2e3142', floorB: '#262938', grout: 'rgba(255,255,255,0.05)', wall: '#3d2c5e', wallDark: '#2a1d43',
        wallTop: '#6f58a8', trim: '#ff4fa3', accent: '#ff4fa3', accent2: '#35e0d0', sign: '#ff4fa3',
        outside: 'night', ground: '#2b2f3d', groundDark: '#242734', sidewalk: '#454a5a', street: '#1d2029',
        warehouseFloor: '#555a66', night: true,
      }),
    },
  ];

  MS.storeDef = (id) => MS.STORES.find((s) => s.id === id) || MS.STORES[0];
})((window.MS = window.MS || {}));
