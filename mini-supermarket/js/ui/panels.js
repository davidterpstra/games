/* Panels: HTML for the side menu tabs, the inspect card, the tooltip and
 * the modals. Each tab returns a list of blocks ({ k, html }); the UI only
 * replaces blocks whose HTML changed, so buttons stay put while the game runs. */
(function (MS) {
  'use strict';

  const U = MS.U;
  const esc = U.escape;
  const block = (k, html) => ({ k, html });

  const rarityChip = (p) => `<span class="chip ${p.rarity}">${p.rarityInfo.icon} ${p.rarityInfo.name}</span>`;
  const bar = (k, cls = '') => `<div class="bar ${cls}"><i style="width:${Math.round(U.clamp(k, 0, 1) * 100)}%"></i></div>`;
  const dis = (cond) => (cond ? '' : ' disabled');

  function priceLine(p, store) {
    const sell = p.sellCents(store), buy = p.buyCents(store);
    return `<div class="price-line"><span>Verkoop <b>${U.money(sell)}</b></span><span>Kosten <b>${U.money(buy)}</b></span><span class="profit">Winst <b>${U.money(sell - buy)}</b></span></div>`;
  }

  function deliveryStatus(store) {
    const tr = store.truck;
    if (tr && tr.state === 'docked' && tr.hasCargo()) {
      return store.staffCount('warehouse') > 0
        ? `De wagen staat klaar — je magazijnmedewerker laadt uit (${tr.cargoUnits()} stuks).`
        : `De wagen staat klaar met ${tr.cargoUnits()} stuks. Tik op de wagen of op Uitladen!`;
    }
    if (tr && tr.state === 'arriving') return 'De bezorgwagen rijdt nu voor…';
    const en = store.deliveries.filter((d) => d.state === 'enroute');
    if (en.length) {
      const d = en[0];
      const boxes = Object.entries(d.items).reduce((n, [pid, u]) => n + Math.ceil(u / MS.product(pid).pack), 0);
      return `Onderweg: ${boxes} doos${boxes === 1 ? '' : 'en'} · aankomst over ${Math.ceil(d.eta)}s`;
    }
    return 'Geen bestellingen onderweg.';
  }

  // ---- 📦 Voorraad ---------------------------------------------------------------------------------
  function stockPanel(game) {
    const store = game.store;
    const inv = store.inventory;
    const out = [];
    const tr = store.truck;
    const docked = tr && tr.state === 'docked' && tr.hasCargo();
    const incoming = inv.incoming();
    out.push(block('delivery', `
      <div class="card ${docked ? 'hl' : ''}">
        <div class="card-top"><div class="emo">🚚</div>
          <div class="grow"><div class="card-title">Magazijn &amp; leveringen</div><div class="card-sub">${deliveryStatus(store)}</div></div>
          ${docked ? '<button class="btn sm yellow" data-act="unload">📦 Uitladen</button>' : ''}
        </div>
        <div class="stock-line"><span>Magazijn <b>${inv.units()} / ${inv.warehouseCapacity}</b></span>${incoming ? `<span>onderweg <b>${incoming}</b></span>` : ''}<span>vrij <b>${inv.freeSpace()}</b></span></div>
        ${bar((inv.units() + incoming) / inv.warehouseCapacity, 'blue')}
      </div>`));

    const slots = store.builtSlots().filter((s) => s.productId);
    out.push(block('ah', `<h3>🛒 In je winkel <span class="count">${slots.length} product${slots.length === 1 ? '' : 'en'} · schap max ${inv.shelfCapacity}</span></h3>`));
    if (!slots.length) out.push(block('none', '<div class="empty"><span class="big">🧺</span>Nog geen producten in de schappen. Tik op een schap in de winkel om er een product in te zetten.</div>'));
    for (const slot of slots) {
      const p = MS.product(slot.productId);
      const status = inv.status(p.id);
      const back = inv.qty(p.id);
      const inc = inv.incoming(p.id);
      const statusChip = status === 'out' ? '<span class="chip bad">🚫 Op!</span>' : status === 'low' ? '<span class="chip warn">⚠️ Bijna op</span>' : '';
      const packCost = p.packCost(store);
      const fits = Math.floor(inv.freeSpace() / p.pack);
      const fill = slot.stock / inv.shelfCapacity;
      out.push(block('p-' + p.id, `
        <div class="card ${status === 'out' ? 'bad' : status === 'low' ? 'warn' : ''}">
          <div class="card-top"><div class="emo">${p.emoji}</div>
            <div class="grow"><div class="card-title">${esc(p.name)} ${rarityChip(p)} ${statusChip}</div>${priceLine(p, store)}</div>
          </div>
          <div class="stock-line"><span>Schap <b>${slot.stock} / ${inv.shelfCapacity}</b></span><span>Magazijn <b>${back}</b></span>${inc ? `<span>+${inc} onderweg</span>` : ''}<span>Doos <b>${p.pack} st.</b></span></div>
          ${bar(fill, fill > 0.5 ? '' : fill > 0.25 ? 'warn' : 'bad')}
          <div class="actions">
            <button class="btn sm" data-act="restock" data-slot="${slot.index}"${dis(back > 0 && slot.stock < inv.shelfCapacity)}>📥 Bijvullen</button>
            <button class="btn sm primary" data-act="order" data-pid="${p.id}" data-packs="1"${dis(fits >= 1 && game.money >= packCost)} title="Een doos = ${p.pack} stuks">📦 +1 doos · ${U.moneyShort(packCost)}</button>
            <button class="btn sm" data-act="order" data-pid="${p.id}" data-packs="5"${dis(fits >= 1 && game.money >= packCost)} title="Bestel 5 dozen (of zoveel als past)">+5</button>
          </div>
        </div>`));
    }

    const stocked = new Set(slots.map((s) => s.productId));
    const others = game.unlockedProducts(store).filter((p) => !stocked.has(p.id));
    if (others.length) {
      out.push(block('oh', `<h3>📋 Nog niet in de winkel <span class="count">${others.length}</span></h3>`));
      others.sort((a, b) => (store.missed[b.id] || 0) - (store.missed[a.id] || 0) || a.unlock - b.unlock);
      for (const p of others) {
        const asked = store.missed[p.id] || 0;
        const back = inv.qty(p.id);
        out.push(block('o-' + p.id, `
          <div class="card">
            <div class="card-top"><div class="emo sm">${p.emoji}</div>
              <div class="grow"><div class="card-title">${esc(p.name)} ${rarityChip(p)}</div>
                <div class="card-sub">${MS.FIXTURES[p.fixture].icon} ${p.fixtureName} · winst ${U.money(p.profitCents(store))} p.st.${asked ? ` · <span class="chip warn">🙋 ${asked}× gevraagd</span>` : ''}${back ? ` · ${back} in magazijn` : ''}</div>
              </div>
              <button class="btn xs blue" data-act="place" data-pid="${p.id}">🧺 In schap</button>
            </div>
          </div>`));
      }
    }

    const locked = MS.allProducts()
      .filter((p) => p.availableIn(store.id) && game.productLock(store, p) && game.productLock(store, p) !== 'store')
      .sort((a, b) => a.unlock - b.unlock)
      .slice(0, 6);
    if (locked.length) {
      out.push(block('lh', '<h3>🔒 Binnenkort</h3>'));
      out.push(block('locked', `<div class="card locked">${locked.map((p) => {
        const why = game.productLock(store, p) === 'level' ? `Level ${p.unlock}` : `Winkelgrootte ${p.department.storeLevel} (${p.department.name})`;
        return `<div class="stock-line"><span style="font-size:18px">${p.emoji}</span><b>${esc(p.name)}</b> ${rarityChip(p)} <span>· ${why}</span></div>`;
      }).join('')}</div>`));
    }
    return out;
  }

  // ---- ⬆️ Upgrades -----------------------------------------------------------------------------------
  function upgradesPanel(game) {
    const store = game.store;
    const out = [];
    const cur = MS.STORE_LEVELS[store.level];
    const next = MS.STORE_LEVELS[store.level + 1];
    if (next) {
      const cost = store.expansionCost();
      const ready = game.level >= next.playerLevel;
      const slotsNow = MS.Layout.slotCountAt(store.level), slotsNext = MS.Layout.slotCountAt(next.level);
      out.push(block('expand', `
        <div class="card hl" data-anchor="expand">
          <div class="card-top"><div class="emo">🏗️</div>
            <div class="grow"><div class="card-title">Winkel uitbreiden</div><div class="card-sub">Nu: grootte ${store.level} · ${cur.name}</div></div>
          </div>
          <div class="kv" style="margin-top:10px">
            <span>Volgende</span><span>Grootte ${next.level} · ${next.name}</span>
            <span>Schapplekken</span><span>${slotsNow} → ${slotsNext}</span>
            <span>Kassa's</span><span>${cur.registers} → ${next.registers}</span>
            <span>Klanten tegelijk</span><span>+3</span>
            <span>Magazijn</span><span>+80 plekken</span>
            <span>Upgrades tot</span><span>level ${MS.UPGRADE_CAP_BY_STORE_LEVEL[next.level]}</span>
          </div>
          ${next.note ? `<div class="card-sub" style="margin-top:8px">✨ ${next.note}</div>` : ''}
          <div class="actions">${ready
            ? `<button class="btn primary wide" data-act="expand"${dis(game.money >= cost)}>🏗️ Uitbreiden · ${U.money(cost)}</button>`
            : `<span class="chip warn">🔒 Vereist level ${next.playerLevel}</span>`}</div>
        </div>`));
    } else {
      out.push(block('expand', `<div class="card good"><div class="card-top"><div class="emo">🏬</div><div class="grow"><div class="card-title">Grote supermarkt!</div><div class="card-sub">Deze winkel heeft de maximale grootte. Tijd voor een nieuwe winkel in 🗺️ Winkels?</div></div></div></div>`));
    }

    out.push(block('uh', `<h3>⬆️ Upgrades <span class="count">${store.def.icon} ${esc(store.def.name)}</span></h3>`));
    for (const def of MS.upgradeDefs) {
      const lv = store.upgrades.level(def.id);
      const cap = store.upgrades.cap(def.id);
      const maxed = lv >= def.max;
      const capped = !maxed && lv >= cap;
      const cost = store.upgrades.nextCost(def.id);
      const pips = Array.from({ length: def.max }, (_, i) => `<i class="${i < lv ? 'on' : i >= cap ? 'cap' : ''}"></i>`).join('');
      const nowTxt = def.show(def.value(lv));
      const nextTxt = maxed ? '' : ` <span class="arrow">→ ${def.show(def.value(lv + 1))}</span>`;
      let action;
      if (maxed) action = '<span class="chip ok">✔ Maximaal</span>';
      else if (capped) action = `<span class="chip warn">🏗️ Breid uit voor level ${lv + 1}</span>`;
      else action = `<button class="btn sm pink" data-act="upgrade" data-id="${def.id}"${dis(game.money >= cost)}>⬆️ Upgrade · ${U.moneyShort(cost)}</button>`;
      out.push(block('u-' + def.id, `
        <div class="card" data-anchor="u-${def.id}">
          <div class="card-top"><div class="emo">${def.icon}</div>
            <div class="grow"><div class="card-title">${def.name} <span class="chip">Lv ${lv} / ${def.max}</span></div><div class="card-sub">${def.desc}</div></div>
          </div>
          <div class="upg-level">${pips}</div>
          <div class="upg-val">Nu: <b>${nowTxt}</b>${nextTxt}</div>
          <div class="actions">${action}</div>
        </div>`));
    }
    return out;
  }

  // ---- 🧑‍💼 Personeel ---------------------------------------------------------------------------------
  function staffStatus(e) {
    if (e.state === 'strike') return '💸 Staakt — geen salaris';
    switch (e.type) {
      case 'cashier': return e.atPost && e.register ? `Aan kassa ${e.register.index + 1}` : 'Loopt naar de kassa';
      case 'stocker':
        if (e.state === 'toWarehouse' || e.state === 'grab') return 'Pakt voorraad in het magazijn';
        if (e.state === 'toShelf' || e.state === 'fill') return `Vult ${e.carry ? MS.product(e.carry.pid).emoji : ''} bij`;
        return 'Wacht op werk';
      case 'warehouse':
        if (e.state === 'toDock' || e.state === 'unload' || e.state === 'store') return 'Laadt de wagen uit';
        return 'Wacht op een levering';
      case 'cleaner': return e.state === 'toDirt' || e.state === 'clean' ? 'Maakt schoon 🧽' : 'Loopt een rondje';
      case 'manager': return 'Houdt de voorraad in de gaten';
    }
    return '';
  }

  function staffPanel(game) {
    const store = game.store;
    const out = [];
    const salary = store.salaryPerMinute();
    out.push(block('sal', `
      <div class="card ${game.salaryUnpaid ? 'bad' : ''}">
        <div class="card-top"><div class="emo">💶</div>
          <div class="grow"><div class="card-title">Salarissen: ${U.money(salary)} / min</div>
            <div class="card-sub">${game.salaryUnpaid ? '💸 Je kunt de lonen niet betalen — het personeel staakt tot er weer geld is!' : 'Personeel neemt werk van je over. Salaris gaat automatisch van je geld af.'}</div></div>
        </div>
      </div>`));
    out.push(block('sh', '<h3>🧑‍💼 Personeel aannemen</h3>'));
    for (const role of Object.values(MS.STAFF_TYPES)) {
      const count = store.staffCount(role.id);
      const max = role.max(store);
      const unlocked = game.level >= role.unlock;
      const cost = store.hireCost(role.id);
      const wage = Math.round(role.salary * Math.sqrt(store.def.costMult) * 100);
      const people = store.employees.filter((e) => e.type === role.id);
      let action;
      if (!unlocked) action = `<span class="chip">🔒 Level ${role.unlock}</span>`;
      else if (count >= max) action = `<span class="chip ok">✔ Maximum voor deze winkelgrootte</span>`;
      else action = `<button class="btn sm primary" data-act="hire" data-type="${role.id}"${dis(game.money >= cost)}>➕ Aannemen · ${U.moneyShort(cost)}</button>`;
      out.push(block('r-' + role.id, `
        <div class="card ${unlocked ? '' : 'locked'}">
          <div class="card-top"><div class="emo">${role.icon}</div>
            <div class="grow"><div class="card-title">${role.name} <span class="chip">${count} / ${max}</span></div><div class="card-sub">${role.job}</div></div>
          </div>
          <div class="price-line"><span>Salaris <b>${U.money(wage)} / min</b></span></div>
          ${people.map((e) => `<div class="stock-line"><b>${esc(e.name)}</b><span>· ${staffStatus(e)}</span><button class="btn xs danger" style="margin-left:auto" data-act="fire" data-id="${e.id}">Ontslaan</button></div>`).join('')}
          <div class="actions">${action}</div>
        </div>`));
    }
    return out;
  }

  // ---- 🏆 Uitdagingen ----------------------------------------------------------------------------------
  function challengesPanel(game) {
    const out = [];
    const ch = game.challenges;
    out.push(block('dh', `<h3>🏆 Uitdagingen van vandaag <span class="count">⏳ ${U.duration(U.secondsUntilMidnight())}</span></h3>`));
    for (const c of ch.list) {
      const done = ch.isDone(c);
      const reward = [c.reward.money ? `<span class="chip legendary">💰 ${U.moneyShort(c.reward.money)}</span>` : '', c.reward.xp ? `<span class="chip epic">⭐ ${c.reward.xp} XP</span>` : ''].join(' ');
      const progTxt = c.event === 'revenue' ? `${U.moneyShort(c.progress)} / ${U.moneyShort(c.target)}` : `${Math.floor(c.progress)} / ${c.target}`;
      out.push(block('c-' + c.id, `
        <div class="card ${c.claimed ? 'good' : done ? 'hl claimable' : ''}">
          <div class="card-top"><div class="emo">${c.claimed ? '✅' : done ? '🎁' : '🎯'}</div>
            <div class="grow"><div class="card-title">${esc(c.text)}</div><div class="card-sub">${reward}</div></div>
          </div>
          ${bar(c.progress / c.target, 'gold')}
          <div class="stock-line"><span>${progTxt}</span>
            ${c.claimed ? '<span class="chip ok" style="margin-left:auto">✔ Geclaimd</span>' : done ? `<button class="btn sm yellow" style="margin-left:auto" data-act="claim" data-id="${esc(c.id)}">🎁 Claim beloning</button>` : ''}
          </div>
        </div>`));
    }
    if (ch.allClaimed()) out.push(block('dall', '<div class="card good"><div class="card-sub">🎉 Alle uitdagingen van vandaag gehaald! Morgen staan er nieuwe klaar.</div></div>'));

    const g = game.goals.current();
    out.push(block('gh', `<h3>🎯 Doelen <span class="count">${game.goals.index} / ${MS.GOALS.length} gehaald</span></h3>`));
    if (g) {
      const p = game.goals.progress();
      const rw = [g.reward.money ? `💰 ${U.moneyShort(g.reward.money * 100)}` : '', g.reward.xp ? `⭐ ${g.reward.xp} XP` : ''].filter(Boolean).join(' · ');
      out.push(block('goal', `
        <div class="card">
          <div class="card-title">${esc(g.text)}</div>
          <div class="card-sub">${esc(g.hint)}</div>
          ${bar(p.cur / p.target, 'purple')}
          <div class="stock-line"><span>${Math.floor(p.cur)} / ${p.target}</span><span style="margin-left:auto">${rw}</span></div>
        </div>`));
    } else {
      out.push(block('goal', '<div class="card good"><div class="card-sub">🏅 Alle doelen gehaald. Jij bent een echte supermarkt-tycoon!</div></div>'));
    }

    const s = game.stats;
    const happyPct = s.served ? Math.round((s.happy / s.served) * 100) : 0;
    out.push(block('st', `
      <h4>📈 Statistieken</h4>
      <div class="card"><div class="kv">
        <span>Klanten geholpen</span><span>${U.num(s.served)}</span>
        <span>Tevreden klanten</span><span>${U.num(s.happy)} (${happyPct}%)</span>
        <span>Boos vertrokken</span><span>${U.num(s.lost)}</span>
        <span>Producten verkocht</span><span>${U.num(s.sold)}</span>
        <span>Totale omzet</span><span>${U.money(s.revenue)}</span>
        <span>Totale winst</span><span>${U.money(s.profit)}</span>
        <span>Schappen bijgevuld</span><span>${U.num(s.restocks)}</span>
        <span>Leveringen uitgeladen</span><span>${U.num(s.unloads)}</span>
      </div></div>`));
    return out;
  }

  // ---- 🗺️ Winkels ---------------------------------------------------------------------------------------
  function storesPanel(game) {
    const out = [];
    out.push(block('si', `<div class="card"><div class="card-sub">🗺️ Elke winkel heeft eigen producten, klanten, upgrades en personeel. Een winkel met kassamedewerker, vakvuller, magazijnmedewerker én manager verdient de helft van zijn gemiddelde winst door terwijl je in een andere winkel bent.${game.passiveRate() > 0 ? `<br><b>Passief inkomen nu: ${U.money(Math.round(game.passiveRate() * 60))} / min</b>` : ''}</div></div>`));
    for (const def of MS.STORES) {
      const s = game.stores[def.id];
      const active = s === game.store;
      const unlocked = game.level >= def.unlockLevel;
      let status, action;
      if (active) { status = '<span class="chip ok">📍 Hier ben je nu</span>'; action = ''; }
      else if (s.owned) {
        status = '<span class="chip ok">✔ Eigenaar</span>';
        action = `<button class="btn sm blue" data-act="switch-store" data-id="${def.id}">🚶 Ga naar ${esc(def.name)}</button>`;
      } else if (!unlocked) { status = `<span class="chip">🔒 Level ${def.unlockLevel}</span>`; action = ''; }
      else {
        status = '<span class="chip warn">🏷️ Te koop</span>';
        action = `<button class="btn sm primary" data-act="buy-store" data-id="${def.id}"${dis(game.money >= def.price * 100)}>🔑 Kopen · ${U.moneyShort(def.price * 100)}</button>`;
      }
      const specials = MS.allProducts().filter((p) => p.stores && p.stores.includes(def.id)).map((p) => p.emoji).join(' ');
      const auto = s.owned && !active ? (s.isFullyAutomated() ? `<span class="chip ok">🤖 Draait zelfstandig · ${U.money(Math.round(Math.max(0, s.profitRate) * 30))}/min</span>` : '<span class="chip">Niet volledig bemand</span>') : '';
      out.push(block('s-' + def.id, `
        <div class="card ${active ? 'hl' : unlocked || s.owned ? '' : 'locked'}">
          <div class="card-top"><div class="emo">${def.icon}</div>
            <div class="grow"><div class="card-title">${esc(def.name)} ${status}</div><div class="card-sub">${esc(def.desc)}</div></div>
          </div>
          <div class="stock-line"><span>Prijzen <b>×${String(def.priceMult).replace('.', ',')}</b></span>${s.owned ? `<span>Grootte <b>${s.level}</b></span><span>Geholpen <b>${U.num(s.stats.served)}</b></span>` : ''}${specials ? `<span>Specials ${specials}</span>` : ''}</div>
          ${auto ? `<div class="stock-line">${auto}</div>` : ''}
          ${action ? `<div class="actions">${action}</div>` : ''}
        </div>`));
    }
    return out;
  }

  // ---- 👥 Klanten ----------------------------------------------------------------------------------------
  function customerState(c) {
    const w = c.currentWish;
    const pe = w ? MS.product(w.pid).emoji : '';
    const reg = c.register ? c.register.index + 1 : '';
    switch (c.state) {
      case 'arrive': case 'enter': return 'Komt binnen';
      case 'toShelf': return `Loopt naar ${pe}`;
      case 'pick': return `Pakt ${pe}`;
      case 'waitShelf': return `Wacht bij een leeg schap ${pe}`;
      case 'toQueue': case 'queue': return `In de rij bij kassa ${reg}`;
      case 'atCounter': return `Wacht bij kassa ${reg}`;
      case 'paying': return 'Rekent af 🧾';
      default:
        return c.outcome === 'angry' ? 'Vertrekt boos 😡' : c.outcome === 'sad' ? 'Vertrekt zonder iets 😕' : 'Vertrekt tevreden 😊';
    }
  }

  function wishChips(c) {
    return c.wishes.map((w, i) => {
      const p = MS.product(w.pid);
      const cls = w.state === 'done' ? 'done' : w.state === 'todo' ? (i === c.wishIndex ? 'cur' : '') : 'missing';
      const mark = w.state === 'done' ? ' ✔' : w.state === 'todo' ? '' : ' ✖';
      return `<span class="wish ${cls}" title="${esc(p.name)}">${p.emoji} ${esc(p.name)}${w.qty > 1 ? ' ×' + w.qty : ''}${mark}</span>`;
    }).join('');
  }

  function customersPanel(game) {
    const store = game.store;
    const out = [];
    const inside = store.customers.filter((c) => c.state !== 'gone');
    const s = store.stats;
    const happyPct = s.served ? Math.round((s.happy / s.served) * 100) : 0;
    out.push(block('cs', `
      <div class="card">
        <div class="kv">
          <span>Aan het winkelen</span><span>${store.shoppers()} / ${store.capacity()}</span>
          <span>Nieuwe klant ongeveer elke</span><span>${store.spawnInterval().toFixed(1).replace('.', ',')}s</span>
          <span>Geholpen in deze winkel</span><span>${U.num(s.served)}</span>
          <span>Tevreden</span><span>${happyPct}%</span>
          <span>Netheid</span><span>${store.dirt.length ? `${Math.max(0, 100 - store.dirt.length * 8)}% (${store.dirt.length} vlekken)` : '100% ✨'}</span>
        </div>
      </div>`));
    out.push(block('ch', `<h3>🛒 Klanten in de winkel <span class="count">${inside.length}</span></h3>`));
    if (!inside.length) out.push(block('none', '<div class="empty"><span class="big">🚶</span>Er komen zo nieuwe klanten binnen…</div>'));
    for (const c of inside) {
      const waiting = c.waiting;
      out.push(block('cu-' + c.id, `
        <div class="card" data-cust="${c.id}">
          <div class="cust"><div class="emo sm">${c.type.icon}</div>
            <div class="grow" style="flex:1;min-width:0"><div class="card-title">🛒 ${esc(c.name)} <span class="chip">${c.type.name}</span></div>
              <div class="card-sub">${customerState(c)}</div>
              <div class="wish-list">${wishChips(c)}</div>
              ${waiting ? bar(c.patience / c.patienceMax, c.patience / c.patienceMax > 0.5 ? '' : 'bad') : ''}
            </div>
          </div>
        </div>`));
    }
    out.push(block('th', '<h4>Soorten klanten</h4>'));
    out.push(block('types', `<div class="card">${Object.values(MS.CUSTOMER_TYPES).map((t) => {
      const open = game.level >= t.unlock;
      return `<div class="stock-line" style="${open ? '' : 'opacity:.55'}"><span style="font-size:18px">${t.icon}</span><b>${t.name}</b><span>${open ? esc(t.desc) : `🔒 vanaf level ${t.unlock}`}</span></div>`;
    }).join('')}</div>`));
    return out;
  }

  // ---- Inspect card (selected thing in the world) --------------------------------------------------------
  function inspect(game, sel) {
    const store = game.store;
    const inv = store.inventory;
    const close = '<button class="x" data-act="close-inspect" aria-label="Sluiten">✕</button>';
    switch (sel.type) {
      case 'shelf': {
        const slot = sel.ref;
        if (!slot.productId) {
          return `${close}<div class="card-top"><div class="emo">❔</div><div class="grow"><div class="card-title">Leeg schap</div><div class="card-sub">Kies welk product hier komt te liggen.</div></div></div>
            <div class="actions"><button class="btn primary wide" data-act="assign-open" data-slot="${slot.index}">🧺 Kies product</button></div>`;
        }
        const p = MS.product(slot.productId);
        const back = inv.qty(p.id);
        const fill = slot.stock / inv.shelfCapacity;
        return `${close}<div class="card-top"><div class="emo">${p.emoji}</div><div class="grow"><div class="card-title">${esc(p.name)} ${rarityChip(p)}</div><div class="card-sub">Schap: ${MS.FIXTURES[p.fixture].icon} ${p.fixtureName} · ${p.department.name}</div></div></div>
          ${priceLine(p, store)}
          <div class="stock-line"><span>Voorraad <b>${slot.stock} / ${inv.shelfCapacity}</b></span><span>Magazijn <b>${back}</b></span>${inv.incoming(p.id) ? `<span>+${inv.incoming(p.id)} onderweg</span>` : ''}</div>
          ${bar(fill, fill > 0.5 ? '' : fill > 0.25 ? 'warn' : 'bad')}
          <div class="actions">
            <button class="btn sm" data-act="restock" data-slot="${slot.index}"${dis(back > 0 && slot.stock < inv.shelfCapacity)}>📥 Bijvullen</button>
            <button class="btn sm primary" data-act="order" data-pid="${p.id}" data-packs="1"${dis(game.money >= p.packCost(store) && inv.freeSpace() >= p.pack)}>📦 Bestel doos · ${U.moneyShort(p.packCost(store))}</button>
            <button class="btn sm ghost" data-act="assign-open" data-slot="${slot.index}">🔁 Ander product</button>
          </div>`;
      }
      case 'slot': {
        const cost = store.shelfCost();
        return `${close}<div class="card-top"><div class="emo">🔨</div><div class="grow"><div class="card-title">Nieuw schap plaatsen</div><div class="card-sub">Meer schappen = meer producten = meer klanten.</div></div></div>
          <div class="actions"><button class="btn primary wide" data-act="build" data-slot="${sel.ref.index}"${dis(game.money >= cost)}>🔨 Bouwen · ${U.money(cost)}</button></div>`;
      }
      case 'customer': {
        const c = sel.ref;
        return `${close}<div class="card-top"><div class="emo">${c.type.icon}</div><div class="grow"><div class="card-title">🛒 ${esc(c.name)}</div><div class="card-sub">${c.type.name} · ${customerState(c)}</div></div></div>
          <div class="card-sub" style="margin-top:8px">Wil:</div><div class="wish-list">${wishChips(c)}</div>
          <div class="stock-line"><span>Geduld</span></div>${bar(c.patience / c.patienceMax, c.patience / c.patienceMax > 0.5 ? '' : 'bad')}
          <div class="card-sub" style="margin-top:6px">${esc(c.type.desc)}</div>`;
      }
      case 'employee': {
        const e = sel.ref;
        const wage = Math.round(e.role.salary * Math.sqrt(store.def.costMult) * 100);
        return `${close}<div class="card-top"><div class="emo">${e.role.icon}</div><div class="grow"><div class="card-title">${esc(e.name)}</div><div class="card-sub">${e.role.name} · ${staffStatus(e)}</div></div></div>
          <div class="card-sub" style="margin-top:6px">${e.role.job}. Salaris ${U.money(wage)} / min.</div>
          <div class="actions"><button class="btn sm danger" data-act="fire" data-id="${e.id}">Ontslaan</button></div>`;
      }
      case 'register': {
        const r = sel.ref;
        const staffed = r.cashier ? `🧑‍💼 ${esc(r.cashier.name)} werkt hier` : r.index === 0 ? 'Jij bedient deze kassa. Tik om af te rekenen.' : 'Gesloten — neem een kassamedewerker aan om te openen.';
        return `${close}<div class="card-top"><div class="emo">🧾</div><div class="grow"><div class="card-title">Kassa ${r.index + 1}</div><div class="card-sub">${staffed}</div></div></div>
          <div class="stock-line"><span>In de rij <b>${r.queue.length}</b></span><span>Scantijd <b>${r.scanTime().toFixed(2).replace('.', ',')}s</b></span></div>
          ${r.open ? `<div class="actions"><button class="btn primary wide" data-act="checkout" data-reg="${r.index}"${dis(r.queue.length > 0)}>🧾 Afrekenen</button></div>` : ''}`;
      }
      case 'truck': {
        const tr = sel.ref;
        const lines = Object.entries(tr.delivery.items).map(([pid, n]) => `<span class="wish">${MS.product(pid).emoji} ×${n}</span>`).join('');
        return `${close}<div class="card-top"><div class="emo">🚚</div><div class="grow"><div class="card-title">Bezorgwagen</div><div class="card-sub">${tr.state === 'docked' ? (tr.hasCargo() ? 'Wacht om uitgeladen te worden' : 'Leeg — rijdt weg') : tr.state === 'arriving' ? 'Rijdt voor…' : 'Rijdt weg'}</div></div></div>
          <div class="wish-list">${lines || '<span class="card-sub">Leeg</span>'}</div>
          ${tr.state === 'docked' && tr.hasCargo() ? '<div class="actions"><button class="btn yellow wide" data-act="unload">📦 Uitladen</button></div>' : ''}`;
      }
    }
    return '';
  }

  function tooltip(game, h) {
    const store = game.store;
    switch (h.type) {
      case 'customer': {
        const c = h.ref;
        return `<b>🛒 ${esc(c.name)}</b> <span class="muted">${c.type.icon} ${c.type.name}</span><br>Wil: ${c.wishes.map((w) => `${MS.product(w.pid).emoji}${w.state === 'done' ? '✔' : w.state === 'todo' ? '' : '✖'}`).join(' ')}<br><span class="muted">${customerState(c)}</span>`;
      }
      case 'employee': return `<b>${h.ref.role.icon} ${esc(h.ref.name)}</b><br><span class="muted">${h.ref.role.name} · ${staffStatus(h.ref)}</span>`;
      case 'shelf': {
        const s = h.ref;
        if (!s.productId) return '<b>Leeg schap</b><br><span class="muted">Tik om een product te kiezen</span>';
        const p = MS.product(s.productId);
        const low = s.stock <= store.inventory.lowShelfMark();
        return `<b>${p.emoji} ${esc(p.name)}</b> <span class="muted">${U.money(p.sellCents(store))}</span><br>Voorraad: ${s.stock} / ${store.inventory.shelfCapacity} · magazijn ${store.inventory.qty(p.id)}${low && store.inventory.qty(p.id) > 0 ? '<br><span style="color:#b35c00">Tik om bij te vullen</span>' : ''}`;
      }
      case 'slot': return `<b>➕ Nieuw schap</b><br><span class="muted">${U.money(store.shelfCost())}</span>`;
      case 'register': {
        const r = h.ref;
        return `<b>🧾 Kassa ${r.index + 1}</b><br><span class="muted">${r.waitingForPlayer ? 'Tik om af te rekenen!' : r.cashier ? 'Bemand' : r.open ? `${r.queue.length} in de rij` : 'Gesloten'}</span>`;
      }
      case 'truck': return `<b>🚚 Bezorgwagen</b><br><span class="muted">${h.ref.state === 'docked' && h.ref.hasCargo() ? 'Tik om uit te laden' : 'Onderweg'}</span>`;
      case 'dirt': return '<b>🧽 Vlek</b><br><span class="muted">Tik om schoon te maken</span>';
      case 'lot': return '<b>🚧 Uitbreiding</b><br><span class="muted">Tik voor details</span>';
      case 'warehouse': return `<b>📦 Magazijn</b><br><span class="muted">${store.inventory.units()} / ${store.inventory.warehouseCapacity} · tik om te bestellen</span>`;
    }
    return '';
  }

  // ---- Modals -----------------------------------------------------------------------------------------------
  function productPicker(game, slotIndex) {
    const store = game.store;
    const slot = store.slots[slotIndex];
    const all = MS.allProducts().filter((p) => p.availableIn(store.id));
    const cards = all
      .sort((a, b) => (game.productLock(store, a) ? 1 : 0) - (game.productLock(store, b) ? 1 : 0) || a.unlock - b.unlock)
      .map((p) => {
        const lock = game.productLock(store, p);
        const elsewhere = store.slotFor(p.id);
        const isCur = slot.productId === p.id;
        let sub;
        if (lock === 'level') sub = `🔒 Level ${p.unlock}`;
        else if (lock === 'dept') sub = `🔒 Winkelgrootte ${p.department.storeLevel}`;
        else if (isCur) sub = 'Ligt hier nu';
        else if (elsewhere) sub = 'Ligt al in een ander schap';
        else sub = `Winst ${U.money(p.profitCents(store))} p.st.${store.inventory.qty(p.id) ? ` · ${store.inventory.qty(p.id)} in magazijn` : ''}`;
        const asked = store.missed[p.id] ? ` · 🙋 ${store.missed[p.id]}×` : '';
        const ok = !lock && !elsewhere;
        return `<button class="pcard ${isCur ? 'current' : ''}" data-act="assign" data-slot="${slotIndex}" data-pid="${p.id}"${dis(ok)}>
          <span class="pe">${p.emoji}</span><b>${esc(p.name)}</b>${rarityChip(p)}<small>${sub}${ok ? asked : ''}</small></button>`;
      }).join('');
    return `<h2>🧺 Kies een product</h2>
      <p class="lead">Welk product komt in dit schap? Voorraad uit het magazijn gaat er meteen in.</p>
      <div class="product-grid">${cards}</div>
      <div class="modal-actions">
        ${slot.productId ? `<button class="btn danger" data-act="assign" data-slot="${slotIndex}" data-pid="">🗑️ Schap leegmaken</button>` : ''}
        <button class="btn" data-act="modal-close">Annuleren</button>
      </div>`;
  }

  function intro() {
    return `<div class="intro-hero">🛒🏪🍎</div>
      <h2 style="justify-content:center">Welkom bij Mini Supermarket!</h2>
      <p class="lead" style="text-align:center">Je hebt net een kleine buurtsupermarkt geopend met <b>€1.000</b> startgeld. Maak er een supermarktketen van!</p>
      <div class="intro-steps">
        <div><b>🧾 Afrekenen</b>Staat er een klant bij de kassa? Tik op de kassa.</div>
        <div><b>📥 Bijvullen</b>Tik op een schap met ⚠️ om het bij te vullen uit het magazijn.</div>
        <div><b>📦 Bestellen</b>Bestel voorraad in 📦 Voorraad. De 🚚 bezorgwagen brengt het — tik erop om uit te laden.</div>
        <div><b>⬆️ Groeien</b>Koop upgrades, plaats schappen, neem personeel aan en breid je winkel uit.</div>
      </div>
      <p class="lead" style="text-align:center;font-size:13px">Tip: slepen = kijken, scrollen of knijpen = zoomen, spatie = pauze.</p>
      <div class="modal-actions" style="justify-content:center"><button class="btn primary big" data-act="modal-close">🚀 Open de winkel!</button></div>`;
  }

  function expansionModal(game) {
    const blocks = upgradesPanel(game);
    const html = blocks[0].html.replace('data-anchor="expand"', '');
    return `<h2>🏗️ Uitbreiden</h2>${html}<div class="modal-actions"><button class="btn" data-act="modal-close">Sluiten</button></div>`;
  }

  MS.Panels = {
    stock: stockPanel,
    upgrades: upgradesPanel,
    staff: staffPanel,
    challenges: challengesPanel,
    stores: storesPanel,
    customers: customersPanel,
    inspect,
    tooltip,
    productPicker,
    intro,
    expansionModal,
  };
})((window.MS = window.MS || {}));
