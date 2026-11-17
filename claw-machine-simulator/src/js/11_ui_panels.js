/* =====================================================================
   11_ui_panels.js — contents of the 6 game panels (frontend – panels).
   Private helpers are prefixed `_up`. Only side effects: UI.registerPanel.
   ===================================================================== */

/* ---------- shared private state (keeps the user's place across re-renders) ---------- */
const _upS = {
  petSel: null, petSort: 'mult', petFilter: 'all', petSheet: false, sellMenu: false,
  idxWorld: null,
  pulse: null,
  volDrag: false, volT: 0, importText: '', exportOpen: false,
  live: [], timer: 0,
};
const _upVariantInfo = {
  normal: { badge: '', label: 'Normal' },
  golden: { badge: '★ Golden', label: '★ Golden' },
  rainbow: { badge: '🌈 Rainbow', label: '🌈 Rainbow' },
};
const _upDecor = { arcade: '🕹️', jungle: '🌴', frozen: '❄️', desert: '🏜️', space: '🚀' };

/* ---------- helpers ---------- */
function _upCall(name, args) {
  const res = Remote.invoke(name, args || {});
  if (!res || !res.ok) {
    UI.toast((res && res.err) || 'Something went wrong', 'bad');
    try { Sfx.play('error'); } catch (e) { /* ignore */ }
  }
  return res || { ok: false };
}
function _upRar(id) { return RARITY_BY_ID[id] || RARITIES[0]; }
function _upRc(id) { return _upRar(id).color; }
function _upNum(n) { return fmt(n); }
function _upClear(el) { el.innerHTML = ''; }
function _upBtn(label, cls, onClick, disabled) {
  const b = h('button', 'btn ' + (cls || ''), label);
  b.type = 'button';
  if (disabled) b.disabled = true;
  else if (onClick) b.addEventListener('click', onClick);
  return b;
}
function _upChip(html, cls) { return h('span', 'pn-chip ' + (cls || ''), html); }
function _upCountOwned(pets, id) { return pets.filter((p) => p.id === id).length; }
function _upWorldName(id) { const w = WORLD_BY_ID[id]; return w ? w.name : id; }
function _upRefresh() { try { UI.refreshPanel(); } catch (e) { /* ignore */ } }
function _upLiveAdd(el, fn) { el._upLive = fn; _upS.live.push(el); }
function _upStartTick() {
  _upStopTick();
  _upS.timer = setInterval(() => {
    _upS.live = _upS.live.filter((e) => e.isConnected);
    for (const e of _upS.live) { try { e._upLive(e); } catch (err) { /* ignore */ } }
  }, 1000);
}
function _upStopTick() { if (_upS.timer) clearInterval(_upS.timer); _upS.timer = 0; }
function _upKeepScroll(bodyEl, fn) {
  const sc = bodyEl.scrollTop;
  fn();
  bodyEl.scrollTop = sc;
}
function _upIsBadVariant(p) { return p.variant && p.variant !== 'normal'; }

/* =====================================================================
   1. PETS
   ===================================================================== */
function _upPetFilterList(pets) {
  let list = Services.petsSorted(_upS.petSort).slice();
  if (_upS.petFilter !== 'all') list = list.filter((p) => (ANIMAL_BY_ID[p.id] || {}).rarity === _upS.petFilter);
  return list.filter((p) => ANIMAL_BY_ID[p.id]);
}
function _upPetCard(p) {
  const a = ANIMAL_BY_ID[p.id];
  const pl = Game.player;
  const eq = pl.equipped.includes(p.uid);
  const c = h('button', 'pn-pet r-' + a.rarity + ' v-' + p.variant + (_upS.petSel === p.uid ? ' sel' : '') + (eq ? ' eq' : ''));
  c.type = 'button';
  c.style.setProperty('--rc', _upRc(a.rarity));
  c.setAttribute('aria-label', a.name);
  const img = h('img'); img.alt = ''; img.draggable = false; img.src = AnimalFactory.thumbnail(p.id, p.variant);
  c.appendChild(img);
  if (_upIsBadVariant(p)) c.appendChild(h('span', 'pn-vbadge ' + p.variant, p.variant === 'golden' ? '★' : '🌈'));
  if (eq) c.appendChild(h('span', 'pn-eqbadge', '✓'));
  if (p.locked) c.appendChild(h('span', 'pn-lockbadge', '🔒'));
  c.appendChild(h('span', 'pn-mult', fmtMult(Services.petMultOf(p))));
  c.addEventListener('click', () => {
    _upS.petSel = p.uid; _upS.petSheet = true;
    try { Sfx.play('click'); } catch (e) { /* */ }
    _upRefresh();
  });
  return c;
}
function _upSellMenu(pets, eqSet) {
  const m = h('div', 'pn-sellmenu');
  m.appendChild(h('div', 'pn-sellhead', 'Sell all unlocked, unequipped pets of a rarity'));
  let any = false;
  for (const r of RARITIES) {
    const list = pets.filter((p) => ANIMAL_BY_ID[p.id] && ANIMAL_BY_ID[p.id].rarity === r.id && !p.locked && !eqSet.has(p.uid));
    if (!list.length) continue;
    any = true;
    const coins = list.reduce((s, p) => s + FORMULAS.sellValue(p.id, p.variant), 0);
    const row = h('button', 'pn-sellrow r-' + r.id);
    row.type = 'button';
    row.style.setProperty('--rc', r.color);
    row.innerHTML = '<b>' + esc(r.name) + '</b><span>' + list.length + ' pets</span><em>🪙 ' + _upNum(coins) + '</em>';
    row.addEventListener('click', () => {
      const risky = r.order >= 3 || list.some((p) => _upIsBadVariant(p));
      UI.confirm('Sell ' + list.length + ' ' + r.name + ' pet' + (list.length > 1 ? 's' : '') + ' for 🪙 ' + _upNum(coins) + '?' + (risky ? ' This includes valuable pets!' : ''), () => {
        const res = _upCall('pet:sellBulk', { rarity: r.id });
        if (res.ok) { try { Sfx.play('sell'); } catch (e) { /* */ } UI.toast('Sold ' + (res.count != null ? res.count : list.length) + ' pets for 🪙 ' + _upNum(res.coins != null ? res.coins : coins), 'good'); }
        _upS.sellMenu = false; _upRefresh();
      });
    });
    m.appendChild(row);
  }
  if (!any) m.appendChild(h('div', 'muted pn-pad', 'Nothing to sell right now.'));
  return m;
}
function _upPetDetail(pet, wrap) {
  const pl = Game.player;
  const a = ANIMAL_BY_ID[pet.id];
  const r = _upRar(a.rarity);
  wrap.style.setProperty('--rc', r.color);
  const close = _upBtn('✕', 'btn-gray btn-sm pn-sheetclose', () => { _upS.petSheet = false; _upRefresh(); });
  wrap.appendChild(close);
  const view = h('div', 'pn-viewer r-' + a.rarity);
  view.id = 'pn-viewer';
  wrap.appendChild(view);
  wrap.appendChild(h('div', 'pn-dname', esc(a.name)));
  const tags = h('div', 'pn-tags');
  tags.appendChild(h('span', 'tag pn-rtag', esc(r.name)));
  const vd = VARIANTS[pet.variant];
  tags.appendChild(h('span', 'tag pn-vtag v-' + pet.variant, esc(_upVariantInfo[pet.variant] ? _upVariantInfo[pet.variant].label : (vd ? vd.name : pet.variant))));
  tags.appendChild(h('span', 'tag', '🌍 ' + esc(_upWorldName(a.world))));
  wrap.appendChild(tags);
  const mult = Services.petMultOf(pet);
  const sell = FORMULAS.sellValue(pet.id, pet.variant);
  const stats = h('div', 'pn-dstats');
  stats.innerHTML = '<div><small>Multiplier</small><b class="pn-big">' + fmtMult(mult) + '</b></div><div><small>Sell value</small><b>🪙 ' + _upNum(sell) + '</b></div>';
  wrap.appendChild(stats);
  wrap.appendChild(h('p', 'pn-desc muted', esc(a.desc || '')));
  const eq = pl.equipped.includes(pet.uid);
  const acts = h('div', 'pn-acts');
  acts.appendChild(_upBtn(eq ? 'Unequip' : 'Equip', eq ? 'btn-gray' : 'btn-green', () => {
    const res = _upCall(eq ? 'pet:unequip' : 'pet:equip', { uid: pet.uid });
    if (res.ok) { try { Sfx.play('equip'); } catch (e) { /* */ } }
    _upRefresh();
  }));
  acts.appendChild(_upBtn(pet.locked ? '🔓 Unlock' : '🔒 Lock', 'btn-blue', () => { _upCall('pet:lock', { uid: pet.uid, locked: !pet.locked }); _upRefresh(); }));
  const ev = Services.evolveInfo(pet.uid) || {};
  if (ev.next) {
    const nm = ev.next === 'golden' ? 'Golden' : ev.next === 'rainbow' ? 'Rainbow' : ev.next;
    const b = _upBtn('✨ Evolve ' + ev.have + '/' + ev.need + ' → ' + nm, 'btn-purple pn-wide', () => {
      const res = _upCall('pet:evolve', { uid: pet.uid });
      if (res.ok) {
        try { Sfx.play('evolve'); } catch (e) { /* */ }
        if (res.pet) _upS.petSel = res.pet.uid;
        UI.toast('Evolved into a ' + nm + ' ' + a.name + '!', 'rare');
      }
      _upRefresh();
    }, !ev.can);
    acts.appendChild(b);
  } else {
    acts.appendChild(h('div', 'muted pn-wide pn-maxev', '🌈 Max evolution reached'));
  }
  const canSell = !pet.locked && !eq;
  const sb = _upBtn('Sell 🪙 ' + _upNum(sell), 'btn-red pn-wide', () => {
    const doSell = () => {
      const res = _upCall('pet:sell', { uid: pet.uid });
      if (res.ok) { try { Sfx.play('sell'); } catch (e) { /* */ } UI.toast('Sold for 🪙 ' + _upNum(res.coins != null ? res.coins : sell), 'good'); _upS.petSel = null; _upS.petSheet = false; }
      _upRefresh();
    };
    if (r.order >= 3 || pet.variant !== 'normal') UI.confirm('Sell your ' + (pet.variant !== 'normal' ? pet.variant + ' ' : '') + a.name + ' (' + r.name + ') for 🪙 ' + _upNum(sell) + '?', doSell);
    else doSell();
  }, !canSell);
  acts.appendChild(sb);
  if (!canSell) acts.appendChild(h('div', 'muted pn-wide pn-hint', pet.locked ? 'Unlock this pet to sell it.' : 'Unequip this pet to sell it.'));
  wrap.appendChild(acts);
}
function _upRenderPets(body) {
  try { PetViewer.unmount(); } catch (e) { /* */ }
  const pl = Game.player;
  const st = Services.stats();
  const eqSet = new Set(pl.equipped);
  _upKeepScroll(body, () => {
    _upClear(body);
    if (_upS.petSel && !pl.pets.some((p) => p.uid === _upS.petSel)) { _upS.petSel = null; _upS.petSheet = false; }
    const root = h('div', 'pn-pets');
    const main = h('div', 'pn-pets-main');
    const chips = h('div', 'pn-chips');
    chips.appendChild(_upChip('🐾 <b>' + pl.pets.length + '/' + st.invSlots + '</b> pets', pl.pets.length >= st.invSlots ? 'warn' : ''));
    chips.appendChild(_upChip('✓ <b>' + pl.equipped.length + '/' + st.equipSlots + '</b> equipped'));
    chips.appendChild(_upChip('⚡ Pet multiplier <b>' + fmtMult(st.petMult) + '</b>', 'hi'));
    main.appendChild(chips);

    const bar = h('div', 'pn-toolbar');
    const sort = h('div', 'pn-seg');
    [['mult', 'Best ×'], ['rarity', 'Rarity'], ['new', 'Newest']].forEach(([k, l]) => {
      const b = h('button', 'pn-segb' + (_upS.petSort === k ? ' on' : ''), l); b.type = 'button';
      b.addEventListener('click', () => { _upS.petSort = k; _upRefresh(); });
      sort.appendChild(b);
    });
    bar.appendChild(sort);
    const acts = h('div', 'pn-toolacts');
    acts.appendChild(_upBtn('Equip Best', 'btn-green btn-sm', () => { const r = _upCall('pet:equipBest'); if (r.ok) { try { Sfx.play('equip'); } catch (e) { /* */ } } _upRefresh(); }));
    acts.appendChild(_upBtn('Unequip All', 'btn-gray btn-sm', () => { _upCall('pet:unequipAll'); _upRefresh(); }));
    acts.appendChild(_upBtn('Sell… ▾', 'btn-red btn-sm', () => { _upS.sellMenu = !_upS.sellMenu; _upRefresh(); }));
    bar.appendChild(acts);
    main.appendChild(bar);

    const fl = h('div', 'pn-filters');
    const mk = (id, label, color) => {
      const b = h('button', 'pn-fchip' + (_upS.petFilter === id ? ' on' : ''), label); b.type = 'button';
      if (color) b.style.setProperty('--rc', color);
      b.addEventListener('click', () => { _upS.petFilter = id; _upRefresh(); });
      fl.appendChild(b);
    };
    mk('all', 'All');
    for (const r of RARITIES) if (pl.pets.some((p) => (ANIMAL_BY_ID[p.id] || {}).rarity === r.id)) mk(r.id, esc(r.name), r.color);
    main.appendChild(fl);
    if (_upS.sellMenu) main.appendChild(_upSellMenu(pl.pets, eqSet));

    if (!pl.pets.length) {
      const e = h('div', 'pn-empty');
      e.innerHTML = '<div class="pn-empty-ico">🧸</div><b>No pets yet!</b><p>Catch animals in the claw machine to fill your collection!</p><div class="pn-arrow">⬇ Walk to the Claw Machine</div>';
      main.appendChild(e);
    } else {
      const list = _upPetFilterList(pl.pets);
      const grid = h('div', 'pn-petgrid');
      for (const p of list) grid.appendChild(_upPetCard(p));
      if (!list.length) grid.appendChild(h('div', 'muted pn-pad', 'No pets match this filter.'));
      main.appendChild(grid);
    }
    root.appendChild(main);

    const side = h('div', 'pn-pets-side' + (_upS.petSel && _upS.petSheet ? ' open' : ''));
    const pet = _upS.petSel && pl.pets.find((p) => p.uid === _upS.petSel);
    if (pet && ANIMAL_BY_ID[pet.id]) _upPetDetail(pet, side);
    else side.appendChild(h('div', 'pn-detail-empty muted', '<div>👈</div>Select a pet to see its details'));
    root.appendChild(side);
    body.appendChild(root);
    if (pet && ANIMAL_BY_ID[pet.id]) {
      const v = side.querySelector('#pn-viewer');
      try { PetViewer.mount(v, pet.id, pet.variant); } catch (e) { /* */ }
    }
  });
}

/* =====================================================================
   2. UPGRADES
   ===================================================================== */
function _upUpgradeCard(u, unlockedCount) {
  const pl = Game.player;
  const lvl = pl.upgrades[u.id] || 0;
  const worldOk = pl.worlds.unlocked.includes(u.world);
  const cap = Math.min(FORMULAS.upgradeCap(u.id, unlockedCount), u.maxLevel);
  const atMax = lvl >= u.maxLevel;
  const atCap = !atMax && lvl >= cap;
  const c = h('div', 'card pn-up' + (worldOk ? '' : ' locked') + (_upS.pulse === u.id ? ' pulse' : ''));
  c.dataset.up = u.id;
  const ico = h('div', 'pn-up-ico', u.icon || '⬆️');
  c.appendChild(ico);
  const mid = h('div', 'pn-up-mid');
  mid.innerHTML = '<div class="pn-up-name">' + esc(u.name) + '</div><div class="muted pn-up-desc">' + esc(u.desc) + '</div>';
  const cur = FORMULAS.formatUpgrade(u.id, FORMULAS.upgradeValue(u.id, lvl));
  if (worldOk) {
    const lv = h('div', 'pn-up-lv');
    lv.innerHTML = '<span class="pill">Lv ' + lvl + ' / ' + cap + '</span><span class="muted"> (max ' + u.maxLevel + ')</span>';
    mid.appendChild(lv);
    const bar = h('div', 'bar pn-up-bar'); bar.innerHTML = '<i style="width:' + Math.round(100 * lvl / u.maxLevel) + '%"></i>';
    mid.appendChild(bar);
    const val = h('div', 'pn-up-val');
    if (atMax) val.innerHTML = '<b>' + esc(cur) + '</b>';
    else val.innerHTML = '<span>' + esc(cur) + '</span> <em>→</em> <b>' + esc(FORMULAS.formatUpgrade(u.id, FORMULAS.upgradeValue(u.id, lvl + 1))) + '</b>';
    mid.appendChild(val);
  }
  c.appendChild(mid);
  const act = h('div', 'pn-up-act');
  if (!worldOk) {
    act.appendChild(h('div', 'pn-lockmsg', '🔒 Unlocks in<br><b>' + esc(_upWorldName(u.world)) + '</b>'));
  } else if (atMax) {
    act.appendChild(h('div', 'pn-maxtag', 'MAX'));
  } else if (atCap) {
    act.appendChild(h('div', 'pn-capmsg', 'Unlock the next world to raise the cap'));
  } else {
    const cost = FORMULAS.upgradeCost(u.id, lvl);
    const bal = u.currency === 'gems' ? pl.gems : pl.coins;
    const ok = bal >= cost;
    const sym = u.currency === 'gems' ? '💎' : '🪙';
    act.appendChild(_upBtn('Upgrade<br><span class="pn-cost">' + sym + ' ' + _upNum(cost) + '</span>', ok ? 'btn-green' : 'btn-gray', () => {
      const res = _upCall('upgrade:buy', { id: u.id });
      if (res.ok) { _upS.pulse = u.id; try { Sfx.play('upgrade'); } catch (e) { /* */ } }
      _upRefresh();
    }, !ok));
  }
  c.appendChild(act);
  return c;
}
function _upRenderUpgrades(body) {
  const pl = Game.player;
  const st = Services.stats();
  const world = WORLD_BY_ID[pl.worlds.current] || WORLDS[0];
  const n = pl.worlds.unlocked.length;
  const total = UPGRADES.reduce((s, u) => s + (pl.upgrades[u.id] || 0), 0);
  _upKeepScroll(body, () => {
    _upClear(body);
    const root = h('div', 'pn-upgrades');
    const head = h('div', 'pn-uphead');
    head.innerHTML = '<div class="pn-uplevel"><small>Machine level</small><b>' + total + '</b></div>' +
      '<div class="pn-upname"><small>Current machine</small><b>' + esc(world.machineName || 'Claw Machine') + '</b></div>';
    root.appendChild(head);
    const stats = h('div', 'pn-statrow');
    const S = (ico, lab, v) => '<div class="pn-stat"><span>' + ico + '</span><small>' + lab + '</small><b>' + v + '</b></div>';
    stats.innerHTML = S('💪', 'Grip', st.gripPower.toFixed(2)) + S('🏃', 'Speed', st.clawSpeed.toFixed(2) + ' m/s') +
      S('🛡️', 'Protect', Math.round(st.protection * 100) + '%') + S('📦', 'Capacity', Math.round(st.capacity)) +
      S('🍀', 'Luck', fmtMult(st.luck)) + S('✨', 'Special', fmtMult(st.special));
    root.appendChild(stats);
    const list = h('div', 'pn-uplist');
    for (const u of UPGRADES) list.appendChild(_upUpgradeCard(u, n));
    root.appendChild(list);
    body.appendChild(root);
  });
  _upS.pulse = null;
}

/* =====================================================================
   3. WORLDS
   ===================================================================== */
function _upReqBar(icon, cur, need, label) {
  const p = need <= 0 ? 1 : clamp(cur / need, 0, 1);
  const r = h('div', 'pn-req' + (p >= 1 ? ' ok' : ''));
  r.innerHTML = '<div class="pn-reqtxt"><span>' + icon + ' ' + label + '</span><b>' + _upNum(cur) + ' / ' + _upNum(need) + (p >= 1 ? ' ✓' : '') + '</b></div><div class="bar"><i style="width:' + Math.round(p * 100) + '%"></i></div>';
  return r;
}
function _upWorldCard(w, idx) {
  const pl = Game.player;
  const th = w.theme || {};
  const unlocked = pl.worlds.unlocked.includes(w.id);
  const current = pl.worlds.current === w.id;
  const c = h('div', 'pn-world' + (current ? ' current' : '') + (unlocked ? '' : ' locked'));
  c.style.setProperty('--wa', th.accent || '#4ea1ff');
  c.style.setProperty('--wb', th.neon || '#a06bff');
  c.style.setProperty('--wc', th.floorA || '#223');
  const emo = h('div', 'pn-world-emoji', _upDecor[th.decor] || '🌍');
  c.appendChild(emo);
  if (current) c.appendChild(h('div', 'pn-curbadge', 'CURRENT'));
  const info = h('div', 'pn-world-info');
  info.appendChild(h('div', 'pn-world-name', esc(w.name)));
  info.appendChild(h('div', 'pn-world-desc', esc(w.desc || '')));
  const facts = h('div', 'pn-facts');
  facts.innerHTML = '<span>🎟️ Play <b>🪙 ' + _upNum(w.playCost) + '</b></span><span>⭐ Rewards <b>' + fmtMult(w.rewardMult) + '</b></span>';
  info.appendChild(facts);
  const rc = h('div', 'pn-rchips');
  for (const rid of w.rarities || []) {
    const r = _upRar(rid);
    const t = h('span', 'pn-rchip', esc(r.name)); t.style.setProperty('--rc', r.color);
    rc.appendChild(t);
  }
  info.appendChild(rc);
  const animals = ANIMALS.filter((a) => a.world === w.id);
  const got = animals.filter((a) => (pl.discovered[a.id] || 0) > 0).length;
  info.appendChild(h('div', 'pn-disc', '📖 Discovered <b>' + got + '/' + animals.length + '</b>'));
  c.appendChild(info);
  const act = h('div', 'pn-world-act');
  if (unlocked) {
    if (current) act.appendChild(h('div', 'pn-here', '📍 You are here'));
    else act.appendChild(_upBtn('Travel ✈️', 'btn-blue btn-lg', () => {
      const res = _upCall('world:travel', { id: w.id });
      if (res.ok) { try { Sfx.play('travel'); } catch (e) { /* */ } UI.closePanel(); }
    }));
  } else {
    const chk = Services.canUnlockWorld(w.id) || {};
    const prev = WORLDS[idx - 1];
    if (!chk.prevUnlocked && prev) {
      act.appendChild(h('div', 'pn-lockmsg', '🔒 Unlock <b>' + esc(prev.name) + '</b> first'));
    } else {
      act.appendChild(_upReqBar('💪', pl.strength, w.unlock.strength, 'Strength'));
      act.appendChild(_upReqBar('🪙', pl.coins, w.unlock.coins, 'Coins'));
      act.appendChild(_upBtn('Unlock 🔓', 'btn-yellow', () => {
        const res = _upCall('world:unlock', { id: w.id });
        if (res.ok) { try { Sfx.play('unlock'); } catch (e) { /* */ } UI.toast(w.name + ' unlocked!', 'good'); }
        _upRefresh();
      }, !chk.ok));
    }
  }
  c.appendChild(act);
  return c;
}
function _upRenderWorlds(body) {
  _upKeepScroll(body, () => {
    _upClear(body);
    const root = h('div', 'pn-worlds');
    WORLDS.forEach((w, i) => root.appendChild(_upWorldCard(w, i)));
    body.appendChild(root);
  });
}

/* =====================================================================
   4. INDEX
   ===================================================================== */
function _upRenderIndex(body) {
  const pl = Game.player;
  if (!_upS.idxWorld || !WORLD_BY_ID[_upS.idxWorld]) _upS.idxWorld = pl.worlds.current;
  const all = ANIMALS.length;
  const gotAll = ANIMALS.filter((a) => (pl.discovered[a.id] || 0) > 0).length;
  _upKeepScroll(body, () => {
    _upClear(body);
    const root = h('div', 'pn-index');
    const top = h('div', 'pn-idxtop');
    const pct = all ? gotAll / all : 0;
    top.innerHTML = '<div class="pn-idxpct"><b>' + Math.floor(pct * 100) + '%</b><small>complete</small></div>' +
      '<div class="pn-idxbar"><div class="muted">Animals discovered <b>' + gotAll + '/' + all + '</b></div><div class="bar"><i style="width:' + Math.round(pct * 100) + '%"></i></div></div>';
    root.appendChild(top);
    const tabs = h('div', 'pn-tabs');
    for (const w of WORLDS) {
      const unl = pl.worlds.unlocked.includes(w.id);
      const t = h('button', 'pn-tab' + (_upS.idxWorld === w.id ? ' on' : ''), (unl ? (_upDecor[(w.theme || {}).decor] || '🌍') : '🔒') + ' <span>' + esc(w.name) + '</span>');
      t.type = 'button';
      t.style.setProperty('--wa', (w.theme || {}).accent || '#4ea1ff');
      t.addEventListener('click', () => { _upS.idxWorld = w.id; _upRefresh(); });
      tabs.appendChild(t);
    }
    root.appendChild(tabs);
    const w = WORLD_BY_ID[_upS.idxWorld];
    const animals = ANIMALS.filter((a) => a.world === w.id).sort((a, b) => _upRar(a.rarity).order - _upRar(b.rarity).order || a.mult - b.mult);
    const got = animals.filter((a) => (pl.discovered[a.id] || 0) > 0).length;
    const complete = got === animals.length && animals.length > 0;
    const wh = h('div', 'pn-idxworld');
    wh.style.setProperty('--wa', (w.theme || {}).accent || '#4ea1ff');
    const left = h('div', 'pn-idxw-l');
    left.innerHTML = '<b>' + esc(w.name) + '</b> <span class="muted">' + got + '/' + animals.length + '</span><div class="bar"><i style="width:' + Math.round(100 * got / Math.max(1, animals.length)) + '%"></i></div>';
    wh.appendChild(left);
    if (complete) {
      if (pl.indexClaimed[w.id]) wh.appendChild(h('div', 'pn-claimed', '✓ Reward claimed'));
      else wh.appendChild(_upBtn('Claim 💎 ' + _upNum(w.indexReward), 'btn-green', () => {
        const res = _upCall('index:claim', { worldId: w.id });
        if (res.ok) { try { Sfx.play('gem'); } catch (e) { /* */ } UI.toast('Index reward: 💎 ' + _upNum(res.gems != null ? res.gems : w.indexReward), 'good'); }
        _upRefresh();
      }));
    } else wh.appendChild(h('div', 'muted pn-idxreward', 'Complete for 💎 ' + _upNum(w.indexReward)));
    root.appendChild(wh);
    if (!pl.worlds.unlocked.includes(w.id)) root.appendChild(h('div', 'pn-note muted', '🔒 This world is still locked, but you can browse its animals.'));
    const grid = h('div', 'pn-idxgrid');
    for (const a of animals) {
      const n = pl.discovered[a.id] || 0;
      const r = _upRar(a.rarity);
      const c = h('div', 'pn-idx r-' + a.rarity + (n > 0 ? ' got' : ' unk'));
      c.style.setProperty('--rc', r.color);
      const img = h('img'); img.alt = ''; img.draggable = false; img.src = AnimalFactory.thumbnail(a.id, 'normal');
      c.appendChild(img);
      c.appendChild(h('div', 'pn-idx-name', n > 0 ? esc(a.name) : '???'));
      c.appendChild(h('div', 'pn-idx-rar', esc(r.name)));
      if (n > 0) c.appendChild(h('div', 'pn-idx-cnt', '×' + n + ' caught'));
      grid.appendChild(c);
    }
    root.appendChild(grid);
    body.appendChild(root);
  });
}

/* =====================================================================
   5. SHOP
   ===================================================================== */
function _upShopOwned(it) {
  const s = Game.player.shop;
  switch (it.kind) {
    case 'equipSlot': return s.equipSlots || 0;
    case 'invSlots': return s.invSlots || 0;
    case 'autoTrain': return s.autoTrain ? 1 : 0;
    default: return 0;
  }
}
function _upBoostLeft(it) {
  const b = Game.player.boosts || {};
  const exp = it.kind === 'boostLuck' ? b.luck : it.kind === 'boostCoins' ? b.coins : 0;
  return exp > Date.now() ? (exp - Date.now()) / 1000 : 0;
}
function _upRenderShop(body) {
  const pl = Game.player;
  _upS.live = [];
  _upKeepScroll(body, () => {
    _upClear(body);
    const root = h('div', 'pn-shop');
    const gem = h('div', 'pn-gembal');
    gem.innerHTML = '<span>💎</span><div><small>Your gems</small><b>' + _upNum(pl.gems) + '</b></div>';
    root.appendChild(gem);

    const d = Services.dailyInfo() || {};
    const dc = h('div', 'pn-daily' + (d.ready ? ' ready' : ''));
    const dl = h('div', 'pn-daily-l');
    dl.innerHTML = '<div class="pn-daily-t">🎁 Daily Reward</div><div class="muted">🔥 Streak: <b>' + (d.streak || 0) + '</b> day' + ((d.streak || 0) === 1 ? '' : 's') + '</div>' +
      '<div class="pn-daily-r">💎 ' + _upNum(d.gems || 0) + (d.coins ? ' &nbsp;🪙 ' + _upNum(d.coins) : '') + '</div>';
    dc.appendChild(dl);
    if (d.ready) dc.appendChild(_upBtn('Claim!', 'btn-green btn-lg pn-claimbtn', () => {
      const res = _upCall('daily:claim');
      if (res.ok) { try { Sfx.play('gem'); } catch (e) { /* */ } UI.toast('Daily reward: 💎 ' + _upNum(res.gems || 0) + (res.coins ? ' + 🪙 ' + _upNum(res.coins) : ''), 'good'); }
      _upRefresh();
    }));
    else {
      const t = h('div', 'pn-timer');
      t.innerHTML = '<small>Next reward in</small><b></b>';
      const upd = (el) => { const i = Services.dailyInfo() || {}; if (i.ready) { _upRefresh(); return; } el.querySelector('b').textContent = fmtDur(i.secondsLeft || 0); };
      t.querySelector('b').textContent = fmtDur(d.secondsLeft || 0);
      _upLiveAdd(t, upd);
      dc.appendChild(t);
    }
    root.appendChild(dc);

    const list = h('div', 'pn-shoplist');
    for (const it of GEM_SHOP) {
      const owned = _upShopOwned(it);
      const isBoost = it.kind === 'boostLuck' || it.kind === 'boostCoins';
      const done = !isBoost && it.max != null && owned >= it.max;
      const cost = Array.isArray(it.cost) ? it.cost[Math.min(owned, it.cost.length - 1)] : it.cost;
      const can = pl.gems >= cost;
      const c = h('div', 'card pn-item' + (done ? ' done' : ''));
      c.appendChild(h('div', 'pn-item-ico', it.icon || '💎'));
      const mid = h('div', 'pn-item-mid');
      mid.innerHTML = '<div class="pn-item-name">' + esc(it.name) + '</div><div class="muted pn-item-desc">' + esc(it.desc) + '</div>';
      if (!isBoost && it.max != null) mid.appendChild(h('div', 'pn-item-own', 'Owned <b>' + owned + '/' + it.max + '</b>'));
      if (isBoost) {
        const left = _upBoostLeft(it);
        const a = h('div', 'pn-active' + (left > 0 ? '' : ' off'));
        a.textContent = left > 0 ? '⏱ Active: ' + fmtDur(left) : '';
        if (left > 0) _upLiveAdd(a, (el) => { const l = _upBoostLeft(it); if (l <= 0) _upRefresh(); else el.textContent = '⏱ Active: ' + fmtDur(l); });
        mid.appendChild(a);
      }
      c.appendChild(mid);
      const act = h('div', 'pn-item-act');
      if (done) act.appendChild(h('div', 'pn-maxtag', it.max === 1 ? 'OWNED' : 'MAX'));
      else act.appendChild(_upBtn('Buy<br><span class="pn-cost">💎 ' + _upNum(cost) + '</span>', can ? 'btn-green' : 'btn-gray', () => {
        const res = _upCall('shop:buy', { id: it.id });
        if (res.ok) { try { Sfx.play('upgrade'); } catch (e) { /* */ } UI.toast(it.name + ' purchased!', 'good'); }
        _upRefresh();
      }, !can));
      c.appendChild(act);
      list.appendChild(c);
    }
    root.appendChild(list);
    const info = h('div', 'pn-info');
    info.innerHTML = '<b>💡 How to get gems</b><ul><li>Rare catches in the claw machine</li><li>Discovering new animals</li><li>Completing a world in the Index</li><li>Daily rewards</li></ul>';
    root.appendChild(info);
    body.appendChild(root);
  });
}

/* =====================================================================
   6. SETTINGS
   ===================================================================== */
function _upCopy(ta) {
  const done = () => UI.toast('Copied to clipboard', 'good');
  ta.focus(); ta.select();
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(ta.value).then(done, () => { try { document.execCommand('copy'); done(); } catch (e) { UI.toast('Select the text and copy it', 'info'); } }); return; }
  } catch (e) { /* fall through */ }
  try { document.execCommand('copy'); done(); } catch (e) { UI.toast('Select the text and copy it', 'info'); }
}
function _upToggle(label, ico, on, key) {
  const row = h('button', 'pn-toggle' + (on ? ' on' : ''));
  row.type = 'button';
  row.innerHTML = '<span class="pn-tg-l">' + ico + ' ' + label + '</span><span class="pn-sw"><i></i></span>';
  row.addEventListener('click', () => { _upCall('settings:set', { key, value: !on }); _upRefresh(); });
  return row;
}
function _upSection(title) { const s = h('div', 'card pn-sec'); s.appendChild(h('h3', 'pn-sec-t', title)); return s; }
function _upRenderSettings(body) {
  if (_upS.volDrag) return;
  const pl = Game.player;
  const set = pl.settings;
  _upS.live = [];
  _upKeepScroll(body, () => {
    _upClear(body);
    const root = h('div', 'pn-settings');

    const g = _upSection('🎨 Graphics');
    const seg = h('div', 'pn-seg pn-seg-full');
    ['auto', 'low', 'medium', 'high'].forEach((q) => {
      const b = h('button', 'pn-segb' + (set.quality === q ? ' on' : ''), q[0].toUpperCase() + q.slice(1)); b.type = 'button';
      b.addEventListener('click', () => { _upCall('settings:set', { key: 'quality', value: q }); _upRefresh(); });
      seg.appendChild(b);
    });
    g.appendChild(seg);
    g.appendChild(h('div', 'muted pn-small', 'Auto picks the best quality for your device. Choose Low if the game feels slow.'));
    root.appendChild(g);

    const a = _upSection('🔊 Audio');
    a.appendChild(_upToggle('Sound effects', '🔔', !!set.sound, 'sound'));
    a.appendChild(_upToggle('Music', '🎵', !!set.music, 'music'));
    const vol = h('div', 'pn-vol');
    const pctEl = h('b', '', Math.round((set.volume != null ? set.volume : 0.8) * 100) + '%');
    const rng = h('input'); rng.type = 'range'; rng.min = '0'; rng.max = '100'; rng.step = '1'; rng.value = String(Math.round((set.volume != null ? set.volume : 0.8) * 100));
    rng.setAttribute('aria-label', 'Volume');
    const send = (final) => {
      const now = performance.now();
      pctEl.textContent = rng.value + '%';
      if (final || now - _upS.volT > 120) { _upS.volT = now; Remote.invoke('settings:set', { key: 'volume', value: Number(rng.value) / 100 }); }
    };
    rng.addEventListener('pointerdown', () => { _upS.volDrag = true; });
    rng.addEventListener('input', () => { _upS.volDrag = true; send(false); });
    rng.addEventListener('change', () => { send(true); _upS.volDrag = false; });
    rng.addEventListener('pointerup', () => { send(true); _upS.volDrag = false; });
    vol.appendChild(h('span', '', '🔉 Volume'));
    vol.appendChild(rng); vol.appendChild(pctEl);
    a.appendChild(vol);
    root.appendChild(a);

    const sv = _upSection('💾 Save');
    const srow = h('div', 'pn-saverow');
    srow.appendChild(_upBtn('Save now', 'btn-green', () => { const ok = SaveService.save('manual'); UI.toast(ok === false ? 'Could not save' : 'Game saved', ok === false ? 'bad' : 'good'); _upRefresh(); }));
    const ls = h('div', 'muted pn-lastsaved');
    const agoTxt = () => { const t = Game.player.lastSaved; return t ? 'Last saved: ' + fmtDur((Date.now() - t) / 1000) + ' ago' : 'Not saved yet'; };
    ls.textContent = agoTxt();
    _upLiveAdd(ls, (el) => { el.textContent = agoTxt(); });
    srow.appendChild(ls);
    sv.appendChild(srow);

    sv.appendChild(h('div', 'pn-sub', 'Export save'));
    const ex = h('textarea', 'pn-ta'); ex.readOnly = true; ex.rows = 3; ex.spellcheck = false;
    try { ex.value = SaveService.exportCode(); } catch (e) { ex.value = ''; }
    ex.addEventListener('focus', () => ex.select());
    sv.appendChild(ex);
    sv.appendChild(_upBtn('📋 Copy', 'btn-blue btn-sm', () => _upCopy(ex)));

    sv.appendChild(h('div', 'pn-sub', 'Import save'));
    const im = h('textarea', 'pn-ta'); im.rows = 3; im.spellcheck = false; im.placeholder = 'Paste a save code here…'; im.value = _upS.importText;
    im.addEventListener('input', () => { _upS.importText = im.value; });
    sv.appendChild(im);
    sv.appendChild(_upBtn('Import', 'btn-yellow btn-sm', () => {
      const text = im.value.trim();
      if (!text) { UI.toast('Paste a save code first', 'bad'); return; }
      UI.confirm('Importing replaces your current progress. Continue?', () => {
        const res = SaveService.importCode(text);
        if (res && res.ok) location.reload();
        else UI.toast((res && res.err) || 'Invalid save code', 'bad');
      });
    }));
    root.appendChild(sv);

    const dz = _upSection('⚠️ Danger zone');
    dz.appendChild(_upBtn('Reset progress', 'btn-red', () => {
      UI.confirm('Reset ALL progress? This cannot be undone!', () => {
        UI.confirm('Are you really sure? Everything will be deleted.', () => { SaveService.reset(); location.reload(); });
      });
    }));
    root.appendChild(dz);

    const ct = _upSection('🎮 Controls');
    const rows = Game.isTouch
      ? [['Move', 'Joystick / D-pad'], ['Action button', 'Interact / drop / train'], ['Aim claw', 'Tap or drag in the machine'], ['Menu buttons', 'Open panels']]
      : [['Move', 'W A S D / Arrow keys'], ['Interact', 'E'], ['Drop claw / Train', 'Space'], ['Back / close', 'Esc'], ['Pets', 'I'], ['Upgrades', 'U'], ['Worlds', 'G'], ['Index', 'X'], ['Shop', 'B'], ['Settings', 'O']];
    const tb = h('div', 'pn-keys');
    const all = Game.isTouch ? rows.concat([['Keyboard', 'WASD / E / Space / Esc / I U G X B O']]) : rows.concat([['Touch', 'Joystick, action button, D-pad, tap/drag in machine']]);
    for (const [k, v] of all) tb.appendChild(h('div', 'pn-keyrow', '<span>' + esc(k) + '</span><b>' + esc(v) + '</b>'));
    ct.appendChild(tb);
    root.appendChild(ct);

    const s = pl.stats || {};
    const best = s.bestRarity ? _upRar(s.bestRarity).name : '—';
    const stc = _upSection('📊 Stats');
    const sg = h('div', 'pn-statgrid');
    const SI = (l, v) => '<div><small>' + l + '</small><b>' + v + '</b></div>';
    sg.innerHTML = SI('Plays', _upNum(s.plays || 0)) + SI('Wins', _upNum(s.wins || 0)) + SI('Slips', _upNum(s.slips || 0)) + SI('Misses', _upNum(s.misses || 0)) +
      SI('Reps', _upNum(s.reps || 0)) + SI('Best rarity', esc(best)) + SI('Play time', fmtDur(s.playTime || 0));
    stc.appendChild(sg);
    root.appendChild(stc);
    body.appendChild(root);
  });
}

/* =====================================================================
   registration
   ===================================================================== */
UI.registerPanel('pets', {
  title: 'Pets', icon: '🐾', wide: true,
  render: _upRenderPets,
  onOpen() { _upS.petSheet = false; },
  onClose() { try { PetViewer.unmount(); } catch (e) { /* */ } _upS.sellMenu = false; },
});
UI.registerPanel('upgrades', { title: 'Machine Upgrades', icon: '⬆️', render: _upRenderUpgrades });
UI.registerPanel('worlds', { title: 'Worlds', icon: '🌍', wide: true, render: _upRenderWorlds });
UI.registerPanel('index', {
  title: 'Index', icon: '📖', wide: true, render: _upRenderIndex,
  onOpen() { _upS.idxWorld = Game.player ? Game.player.worlds.current : null; },
});
UI.registerPanel('shop', { title: 'Shop', icon: '💎', render: _upRenderShop, onOpen: _upStartTick, onClose: _upStopTick });
UI.registerPanel('settings', { title: 'Settings', icon: '⚙️', render: _upRenderSettings, onOpen: _upStartTick, onClose() { _upStopTick(); _upS.volDrag = false; } });
