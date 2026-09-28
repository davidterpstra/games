/* Staff roles. Every role automates one job the player otherwise does by
 * tapping: checkout, refilling shelves, unloading trucks, cleaning, ordering.
 *
 *   hire     one-time hiring fee in euros (the next hire of the same role costs more)
 *   salary   euros per minute of play time
 *   unlock   player level needed
 *   max      (store) -> how many you may employ in that store
 */
(function (MS) {
  'use strict';

  MS.STAFF_TYPES = {
    cashier: {
      id: 'cashier', name: 'Kassamedewerker', icon: '🧑‍💼', job: 'Rekent klanten automatisch af',
      hire: 250, salary: 4, unlock: 1, color: '#e2557a',
      max: (store) => store.registerCount(),
    },
    stocker: {
      id: 'stocker', name: 'Vakvuller', icon: '📦', job: 'Vult schappen automatisch bij vanuit het magazijn',
      hire: 400, salary: 5, unlock: 2, color: '#39b37a',
      max: (store) => 1 + Math.floor(store.level / 2),
    },
    warehouse: {
      id: 'warehouse', name: 'Magazijnmedewerker', icon: '🚚', job: 'Laadt leveringen automatisch uit',
      hire: 450, salary: 5, unlock: 3, color: '#f28c38',
      max: (store) => (store.level >= 3 ? 2 : 1),
    },
    cleaner: {
      id: 'cleaner', name: 'Schoonmaker', icon: '🧹', job: 'Houdt de winkel netjes (tevredener klanten)',
      hire: 300, salary: 3, unlock: 4, color: '#2bb5c6',
      max: (store) => (store.level >= 3 ? 2 : 1),
    },
    manager: {
      id: 'manager', name: 'Filiaalmanager', icon: '👔', job: 'Bestelt automatisch voorraad als die bijna op is',
      hire: 2500, salary: 12, unlock: 9, color: '#5b2a86',
      max: () => 1,
    },
  };

  MS.STAFF_NAMES = [
    'Bert', 'Wendy', 'Ahmed', 'Priya', 'Kim', 'Rik', 'Anouk', 'Dirk', 'Selin', 'Mark', 'Jolien', 'Tom',
    'Ilse', 'Karim', 'Petra', 'Niels', 'Lieke', 'Omar', 'Marloes', 'Youssef', 'Chantal', 'Frank', 'Bo', 'Lin',
  ];
})((window.MS = window.MS || {}));
