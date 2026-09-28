/* Customer types. A store can change how often each type shows up through
 * `customerWeights` in stores.js.
 *
 *   speed      walking speed multiplier
 *   patience   patience multiplier (seconds before they give up waiting)
 *   items      [min, max] different products on the shopping list
 *   qty        [min, max] units per product
 *   pricey     > 0 prefers expensive / rare products
 *   tip        share of the bill given as a tip
 *   walkout    leaves at once when a product is missing
 *   maxQueue   leaves when every checkout queue is at least this long
 *   unlock     player level needed before this type visits
 */
(function (MS) {
  'use strict';

  MS.CUSTOMER_TYPES = {
    normal: {
      id: 'normal', name: 'Normale klant', icon: '👨', badge: '',
      desc: 'Gemiddelde snelheid en gemiddeld budget.',
      speed: 1.0, patience: 1.0, items: [2, 4], qty: [1, 2], pricey: 0, tip: 0,
      walkout: false, maxQueue: 99, weight: 50, unlock: 1,
      shirts: ['#4f8cff', '#39b37a', '#f28c38', '#e2557a', '#8b6cf0', '#2bb5c6'],
    },
    hasty: {
      id: 'hasty', name: 'Haastige klant', icon: '⚡', badge: '⚡',
      desc: 'Loopt snel en wil snel geholpen worden. Geeft een fooi als het vlot gaat.',
      speed: 1.65, patience: 0.55, items: [1, 2], qty: [1, 1], pricey: 0, tip: 0.1,
      walkout: false, maxQueue: 4, weight: 16, unlock: 1,
      shirts: ['#ffcf33', '#ff8a3d'],
    },
    rich: {
      id: 'rich', name: 'Rijke klant', icon: '💰', badge: '💰',
      desc: 'Koopt het liefst dure en zeldzame producten en geeft royaal fooi.',
      speed: 0.9, patience: 1.1, items: [2, 4], qty: [1, 2], pricey: 0.9, tip: 0.15,
      walkout: false, maxQueue: 99, weight: 9, unlock: 3,
      shirts: ['#1f2a44', '#5b2a86', '#0f5c4d'],
    },
    big: {
      id: 'big', name: 'Grote shopper', icon: '🛍️', badge: '🛍️',
      desc: 'Duwt een winkelwagen en koopt veel producten tegelijk.',
      speed: 0.8, patience: 1.3, items: [4, 7], qty: [1, 3], pricey: 0, tip: 0,
      walkout: false, maxQueue: 99, weight: 12, unlock: 2,
      shirts: ['#e2557a', '#39b37a', '#4f8cff'],
    },
    impatient: {
      id: 'impatient', name: 'Ongeduldige klant', icon: '😡', badge: '😤',
      desc: 'Vertrekt meteen als een product op is of als de rij te lang is.',
      speed: 1.15, patience: 0.45, items: [1, 3], qty: [1, 2], pricey: 0, tip: 0,
      walkout: true, maxQueue: 3, weight: 12, unlock: 1,
      shirts: ['#d64545', '#b33636'],
    },
  };

  MS.CUSTOMER_NAMES = [
    'Lisa', 'Sem', 'Emma', 'Daan', 'Noor', 'Luuk', 'Julia', 'Milan', 'Sophie', 'Finn', 'Tess', 'Lucas',
    'Anna', 'Jesse', 'Sara', 'Bram', 'Eva', 'Thijs', 'Fleur', 'Ruben', 'Zoë', 'Levi', 'Mila', 'Noah',
    'Yara', 'Mohammed', 'Fatima', 'Ibrahim', 'Aisha', 'Kees', 'Truus', 'Henk', 'Ans', 'Joris', 'Femke',
    'Sven', 'Lotte', 'Jan', 'Saar', 'Stijn', 'Roos', 'Gijs', 'Iris', 'Mees', 'Nina', 'Olivier', 'Esmee',
    'Bas', 'Maud', 'Hugo', 'Liv', 'Timo', 'Elif', 'Emre', 'Sanne', 'Ravi', 'Mei', 'Kofi', 'Ingrid',
  ];

  MS.SKIN_TONES = ['#f6d3b3', '#eec19b', '#d9a57a', '#b97c52', '#8d5a3b', '#5e3b26'];
  MS.HAIR_COLORS = ['#2b1d14', '#4a2f1d', '#7a4a26', '#c98a3c', '#e7c46a', '#b8b8b8', '#1c1c1c', '#a0432c'];
})((window.MS = window.MS || {}));
