/* Levels, guided goals and daily challenge templates.
 * Level-up unlocks are not listed by hand: the game reads them from the
 * `unlock` fields of products, customers, staff, stores and store sizes. */
(function (MS) {
  'use strict';

  /** XP needed to go from `level` to `level + 1`. */
  MS.xpForLevel = (level) => Math.round(45 * Math.pow(level, 1.7) + 25);

  MS.XP = {
    perCustomer: 3,
    happyBonus: 2,
    shelf: 15,
    upgrade: 10,
    expansion: 120,
    hire: 10,
    clean: 1,
    newStore: 250,
  };

  /* Guided goals shown one at a time in the goal tracker. They teach the
   * loop and always give the player a next small target. Progress is the
   * lifetime total, so a goal that was already reached completes at once.
   *   stat     counter in game.stats
   *   check    (game) -> number, used instead of a stat */
  MS.GOALS = [
    { id: 'serve1', text: 'Reken je eerste klant af', hint: 'Tik op de kassa 🧾 zodra er een klant staat te wachten.', stat: 'served', target: 1, reward: { money: 50, xp: 10 } },
    { id: 'restock1', text: 'Vul een schap bij', hint: 'Tik op een schap met ⚠️ om het bij te vullen vanuit het magazijn.', stat: 'restocks', target: 1, reward: { money: 50, xp: 10 } },
    { id: 'order1', text: 'Bestel nieuwe voorraad', hint: 'Open 📦 Voorraad en bestel een doos van een product.', stat: 'orders', target: 1, reward: { money: 60, xp: 10 } },
    { id: 'unload1', text: 'Laad de bezorgwagen uit', hint: 'Tik op de 🚚 bezorgwagen voor het magazijn als hij er staat.', stat: 'unloads', target: 1, reward: { money: 60, xp: 15 } },
    { id: 'shelf1', text: 'Plaats een nieuw schap', hint: 'Tik op een leeg schapvak met ➕ en kies een product.', stat: 'shelvesBuilt', target: 1, reward: { money: 100, xp: 20 } },
    { id: 'serve25', text: 'Help 25 klanten', hint: 'Houd de schappen vol en de rij kort.', stat: 'served', target: 25, reward: { money: 120, xp: 20 } },
    { id: 'upgrade1', text: 'Koop een upgrade', hint: 'Open ⬆️ Upgrades — Kassasnelheid is een goede eerste keuze.', stat: 'upgrades', target: 1, reward: { money: 100, xp: 20 } },
    { id: 'hireCashier', text: 'Neem een kassamedewerker aan', hint: 'Open 🧑‍💼 Personeel. Dan hoef je niet meer zelf af te rekenen.', stat: 'hired_cashier', target: 1, reward: { money: 150, xp: 25 } },
    { id: 'level3', text: 'Bereik level 3', hint: 'Je verdient XP met elke verkoop en elke klant.', check: (g) => g.level, target: 3, reward: { money: 200, xp: 0 } },
    { id: 'expand2', text: 'Breid je winkel uit naar grootte 2', hint: 'Tik op het 🚧 bouwbord naast de winkel of open ⬆️ Upgrades.', check: (g) => g.store.level, target: 2, reward: { money: 400, xp: 50 } },
    { id: 'hireStocker', text: 'Neem een vakvuller aan', hint: 'Een vakvuller vult de schappen voor je bij.', stat: 'hired_stocker', target: 1, reward: { money: 300, xp: 40 } },
    { id: 'serve150', text: 'Help 150 klanten', hint: 'Meer schappen en reclame trekken meer klanten.', stat: 'served', target: 150, reward: { money: 600, xp: 80 } },
    { id: 'rare1', text: 'Verkoop een zeldzaam product 🔵', hint: 'Zeldzame producten komen vrij vanaf level 5.', stat: 'rareSold', target: 1, reward: { money: 500, xp: 60 } },
    { id: 'expand3', text: 'Breid uit naar winkelgrootte 3', hint: 'Een grotere winkel heeft meer schappen en kassa\'s.', check: (g) => g.store.level, target: 3, reward: { money: 1200, xp: 120 } },
    { id: 'challenge1', text: 'Voltooi een dagelijkse uitdaging', hint: 'Bekijk 🏆 Uitdagingen voor vandaag.', stat: 'challenges', target: 1, reward: { money: 800, xp: 80 } },
    { id: 'hireManager', text: 'Neem een filiaalmanager aan', hint: 'Vanaf level 9 bestelt een manager automatisch voorraad.', stat: 'hired_manager', target: 1, reward: { money: 2500, xp: 150 } },
    { id: 'store2', text: 'Open een tweede winkel', hint: 'Bekijk 🗺️ Winkels. City Market komt vrij op level 10.', check: (g) => g.ownedStoreCount(), target: 2, reward: { money: 5000, xp: 300 } },
    { id: 'legendary1', text: 'Verkoop een legendarisch product 🟡', hint: 'De 🍰 Legendary Cake komt vrij op level 12.', stat: 'legendarySold', target: 1, reward: { money: 8000, xp: 400 } },
    { id: 'expand5', text: 'Bouw een grote supermarkt (grootte 5)', hint: 'Winkelgrootte 5 is de maximale uitbreiding.', check: (g) => g.maxStoreLevel(), target: 5, reward: { money: 20000, xp: 800 } },
    { id: 'allStores', text: 'Bezit alle vijf winkels', hint: 'Downtown Supermarket komt vrij op level 22.', check: (g) => g.ownedStoreCount(), target: 5, reward: { money: 250000, xp: 3000 } },
  ];

  /* Daily challenges: three per day, picked with the date as seed.
   *   make(ctx, rng) -> { text, event, key?, target } or null when not possible now
   *   reward: 'money' | 'xp' | 'both' */
  const pickN = (rng, base, perLevel, level, round = 1) => Math.max(round, Math.round((base + perLevel * level) * (0.85 + rng() * 0.3) / round) * round);

  MS.CHALLENGE_TEMPLATES = [
    {
      id: 'sell', weight: 4, reward: 'money',
      make: (ctx, rng) => {
        const pool = ctx.assortment.filter((p) => p.rarity === 'common');
        if (!pool.length) return null;
        const p = pool[Math.floor(rng() * pool.length)];
        const n = pickN(rng, 18, 4, ctx.level, 5);
        return { text: `Verkoop ${n}× ${p.emoji} ${p.name}`, event: 'sold', key: p.id, target: n };
      },
    },
    {
      id: 'happy', weight: 3, reward: 'xp',
      make: (ctx, rng) => {
        const n = pickN(rng, 12, 3, ctx.level, 5);
        return { text: `Laat ${n} klanten tevreden vertrekken`, event: 'happy', target: n };
      },
    },
    {
      id: 'revenue', weight: 3, reward: 'money',
      make: (ctx, rng) => {
        const euros = pickN(rng, 150, 120, Math.pow(ctx.level, 1.35) * ctx.priceMult, 50);
        return { text: `Verdien ${MS.U.moneyShort(euros * 100)} omzet`, event: 'revenue', target: euros * 100 };
      },
    },
    {
      id: 'type', weight: 2, reward: 'both',
      make: (ctx, rng) => {
        const types = Object.values(MS.CUSTOMER_TYPES).filter((t) => t.unlock <= ctx.level && t.id !== 'normal');
        if (!types.length) return null;
        const t = types[Math.floor(rng() * types.length)];
        const n = pickN(rng, 4, 1, ctx.level);
        return { text: `Help ${n}× een ${t.icon} ${t.name.toLowerCase()}`, event: 'served', key: t.id, target: n };
      },
    },
    {
      id: 'restock', weight: 2, reward: 'money',
      make: (ctx, rng) => {
        const n = pickN(rng, 10, 2, ctx.level, 5);
        return { text: `Vul ${n} keer een schap bij`, event: 'restock', target: n };
      },
    },
    {
      id: 'unload', weight: 2, reward: 'xp',
      make: (ctx, rng) => {
        const n = pickN(rng, 3, 0.4, ctx.level);
        return { text: `Laad ${n} leveringen uit`, event: 'unload', target: n };
      },
    },
    {
      id: 'rare', weight: 2, reward: 'both',
      make: (ctx, rng) => {
        if (ctx.level < 6) return null;
        const n = pickN(rng, 6, 1, ctx.level);
        return { text: `Verkoop ${n} zeldzame producten 🔵+`, event: 'rareSold', target: n };
      },
    },
    {
      id: 'upgrade', weight: 1, reward: 'money',
      make: (ctx, rng) => {
        const n = 1 + Math.floor(rng() * 3);
        return { text: `Koop ${n} upgrade${n > 1 ? 's' : ''}`, event: 'upgrade', target: n };
      },
    },
  ];

  MS.challengeReward = (kind, level, priceMult) => {
    const money = Math.round((120 + 90 * Math.pow(level, 1.3)) * priceMult / 10) * 10 * 100;
    const xp = Math.round((40 + 22 * Math.pow(level, 1.2)) / 5) * 5;
    if (kind === 'money') return { money, xp: 0 };
    if (kind === 'xp') return { money: 0, xp };
    return { money: Math.round(money * 0.6 / 1000) * 1000, xp: Math.round(xp * 0.6) };
  };
})((window.MS = window.MS || {}));
