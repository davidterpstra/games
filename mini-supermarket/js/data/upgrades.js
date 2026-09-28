/* Upgrades, bought per store. Add an upgrade by adding an entry here and
 * reading its value with `store.upgrades.value('<id>')` where it matters.
 *
 *   cost      price in euros to go from level 1 to 2; each next level costs `growth` times more
 *   value     (level) -> effect used by the game
 *   show      (value) -> short text shown in the menu
 * How far an upgrade can go depends on the store size (UPGRADE_CAP_BY_STORE_LEVEL),
 * which is what makes expanding the store worth it.
 */
(function (MS) {
  'use strict';

  MS.UPGRADE_CAP_BY_STORE_LEVEL = [0, 3, 4, 6, 8, 10];

  MS.UPGRADES = [
    {
      id: 'checkoutSpeed', name: 'Kassasnelheid', icon: '⚡', desc: 'Producten worden sneller gescand.',
      max: 10, cost: 150, growth: 1.72,
      value: (l) => 0.75 * Math.pow(0.86, l - 1),
      show: (v) => `${v.toFixed(2).replace('.', ',')}s per product`,
    },
    {
      id: 'capacity', name: 'Klantcapaciteit', icon: '👥', desc: 'Meer klanten tegelijk in de winkel.',
      max: 10, cost: 200, growth: 1.7,
      value: (l) => 5 + 2 * (l - 1),
      show: (v) => `${v} klanten tegelijk`,
    },
    {
      id: 'stock', name: 'Voorraadcapaciteit', icon: '📦', desc: 'Grotere schappen en een groter magazijn.',
      max: 10, cost: 180, growth: 1.7,
      value: (l) => ({ shelf: 10 + 4 * (l - 1), warehouse: 120 + 60 * (l - 1) }),
      show: (v) => `schap ${v.shelf} · magazijn ${v.warehouse}`,
    },
    {
      id: 'quality', name: 'Productkwaliteit', icon: '✨', desc: 'Betere producten: hogere verkoopprijs.',
      max: 10, cost: 300, growth: 1.85,
      value: (l) => 1 + 0.12 * (l - 1),
      show: (v) => `+${Math.round((v - 1) * 100)}% verkoopprijs`,
    },
    {
      id: 'ads', name: 'Reclame', icon: '📣', desc: 'Meer klanten per minuut.',
      max: 10, cost: 250, growth: 1.8,
      value: (l) => 1 + 0.22 * (l - 1),
      show: (v) => `×${v.toFixed(2).replace('.', ',')} klanten`,
    },
    {
      id: 'walkSpeed', name: 'Looptempo', icon: '👟', desc: 'Klanten en personeel lopen sneller.',
      max: 8, cost: 200, growth: 1.7,
      value: (l) => 1 + 0.1 * (l - 1),
      show: (v) => `+${Math.round((v - 1) * 100)}% snelheid`,
    },
    {
      id: 'delivery', name: 'Snelle levering', icon: '🚚', desc: 'De bezorgwagen komt sneller.',
      max: 6, cost: 150, growth: 1.75,
      value: (l) => 14 * Math.pow(0.84, l - 1),
      show: (v) => `levering in ${Math.round(v)}s`,
    },
  ];
})((window.MS = window.MS || {}));
