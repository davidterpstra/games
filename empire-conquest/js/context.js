/* =====================================================================
   EMPIRE CONQUEST — context panel (right side)
   Shows the selected territory (own, foreign or unexplored) or army,
   with every action that applies: develop, fortify, grow, build,
   recruit, tax, scout, declare war, attack, march…
   ===================================================================== */
'use strict';

const Context = {
  tab: 'overview',
  sig: '',
  qty: { infantry: 20, archers: 10, cavalry: 5, knights: 5, siege: 2 },
  lastSel: null,

  el() { return document.getElementById('context'); },

  show() {
    const sel = MapView.sel;
    const key = sel ? sel.type + sel.id : '';
    if (key !== this.lastSel) { this.tab = 'overview'; this.lastSel = key; }
    this.refresh(true);
  },

  refresh(force) {
    const s = Game.state;
    if (!s) return;
    const root = this.el();
    const sig = this.makeSig();
    if (force || sig !== this.sig) {
      if (!force && (UI.pointerDown || (document.activeElement && root.contains(document.activeElement) && document.activeElement.tagName === 'INPUT'))) return;
      const body = root.querySelector('.ctx-body');
      const scroll = body ? body.scrollTop : 0;
      this.sig = sig;
      root.innerHTML = this.render();
      const nb = root.querySelector('.ctx-body');
      if (nb) nb.scrollTop = scroll;
    } else Live.update(root);
  },

  makeSig() {
    const s = Game.state, sel = MapView.sel;
    const res = Game.player().res;
    const bucket = Math.floor(res.gold / 25) + ':' + Math.floor(res.wood / 25) + ':' + Math.floor(res.iron / 20) + ':' + Math.floor(res.food / 40);
    if (!sel) return 'none|' + Math.floor(s.day / 5) + '|' + JSON.stringify(s.missions) + Diplomacy.warsOf(0).length;
    if (sel.type === 'terr') {
      const t = sel.id, ts = s.terr[t];
      const armies = s.armies.filter((a) => a.loc === t || a.owner === 0).map((a) => a.id + ':' + Battle.total(a.units) + ':' + (a.move ? a.move.to : a.loc) + ':' + a.path.length).join(',');
      return ['t', t, this.tab, ts.owner, ts.tier, JSON.stringify(ts.b), ts.proj && ts.proj.type + ts.proj.id, ts.queue.length, JSON.stringify(ts.gar), ts.fort, ts.dev, ts.tax, s.explored[t], Math.floor(ts.pop / 20), Math.round(ts.happy / 2), bucket, armies, ts.owner >= 0 ? Diplomacy.status(0, ts.owner) : '', Math.floor(s.day / 2)].join('|');
    }
    const a = Army.byId(sel.id);
    if (!a) return 'gone';
    return ['a', a.id, JSON.stringify(a.units), a.loc, a.move ? a.move.to : '', a.path.join(','), a.general ? a.general.level : 0, a.name, MapView.orderTarget, bucket, Math.floor(s.day / 2), s.armies.filter((x) => x.loc === a.loc).length].join('|');
  },

  render() {
    const sel = MapView.sel;
    if (!sel) return this.renderNone();
    if (sel.type === 'terr') return this.renderTerritory(sel.id);
    const a = Army.byId(sel.id);
    if (!a) { MapView.sel = null; return this.renderNone(); }
    return this.renderArmy(a);
  },

  head(title, sub, color, closeable = true) {
    return `<div class="ctx-head" style="--kc:${color};--hc:${rgba(color, 0.14)}"><div class="ctx-title">${title}${closeable ? '<button class="close-btn x" data-act="deselect" data-tip="Close (Esc)">✕</button>' : ''}</div><div class="ctx-sub">${sub}</div></div>`;
  },

  /* ---------------- nothing selected ---------------- */
  renderNone() {
    const s = Game.state, k = Game.player();
    const P = Missions.context();
    const next = MISSIONS.find((m) => s.missions[m.id] === 1) || MISSIONS.find((m) => s.missions[m.id] === 0);
    let h = this.head(`⚜️ ${escapeHtml(k.short)}`, `${escapeHtml(k.ruler.title)} ${escapeHtml(k.ruler.name)} · ${Game.territoriesOf(0).length} ${plural(Game.territoriesOf(0).length, 'territory', 'territories')}`, k.color, false);
    h += `<div class="ctx-body">`;
    if (next) {
      const p = Missions.progress(next, P);
      h += `<div class="card hl click" data-act="openPanel" data-p="missions"><div class="row"><span style="font-size:26px">${next.icon}</span><div class="grow"><div class="small muted">Current objective</div><div class="card-title">${next.name}</div><div class="small">${next.desc}</div></div></div>
        ${s.missions[next.id] === 1 ? `<div class="mt">${H.btn('🎁 Claim reward', 'claimMission', { id: next.id }, { cls: 'primary small block' })}</div>` : `<div class="row small mt"><span class="grow">${H.bar(p.pct)}</span><span class="muted">${fmt(p.cur)}/${fmt(p.target)}</span></div>`}</div>`;
    }
    const wars = Diplomacy.warsOf(0);
    if (wars.length) h += `<div class="card mt click" data-act="openPanel" data-p="war" style="border-color:rgba(255,107,90,.45)"><b class="bad">⚔️ At war with ${wars.map((w) => escapeHtml(Game.k(w).short)).join(', ')}</b></div>`;
    h += `<div class="empty-state"><div class="big">🗺️</div>Select a territory or an army on the map.</div>
      <h3 class="sec">📖 How to play</h3>
      <ul class="tip-list">
        <li><b>Click</b> a territory to see it; your own lands can be developed, fortified and built up.</li>
        <li>Train soldiers in territories with <b>Barracks</b>, then raise an <b>army</b> from the garrison.</li>
        <li>Select your army and <b>click a territory</b> to plan a march, or <b>right-click</b> to march at once. Marching into hostile land is an attack.</li>
        <li><b>Independent</b> (grey) lands can be attacked at any time. Kingdoms need a declaration of war first.</li>
        <li>Terrain, walls, unit types, generals and technology decide battles. Check the <b>win chance</b> before attacking.</li>
        <li>Drag to move the map, scroll or pinch to zoom. <kbd>Space</kbd> pauses, <kbd>1</kbd><kbd>2</kbd><kbd>3</kbd> change speed.</li>
      </ul>
      <div class="mt">${H.btn('🏰 Go to your capital', 'goHome', {}, { cls: 'block' })}</div>
    </div>`;
    return h;
  },

  /* ---------------- territories ---------------- */
  renderTerritory(t) {
    const s = Game.state, ts = s.terr[t], wt = Game.wt(t);
    if (!s.explored[t]) return this.renderUnexplored(t);
    const owner = ts.owner;
    const isCap = owner >= 0 && Game.k(owner).capital === t;
    const color = Game.ownerColor(owner);
    let sub = `<span class="chip">${TIERS[ts.tier].icon} ${TIERS[ts.tier].name}</span><span class="chip" data-tip="${escapeHtml(TERRAIN[wt.terrain].desc)}">${H.terrain(t)}</span>`;
    if (wt.river) sub += '<span class="chip" data-tip="A river runs through: +20% farm output">🏞️ River</span>';
    sub += `<span class="chip">${H.kname(owner)}</span>`;
    let h = this.head(`${isCap ? '👑 ' : ''}${H.tname(t)}`, sub, color);
    h += `<div class="ctx-body">`;
    h += owner === 0 ? this.ownTerritory(t) : this.foreignTerritory(t);
    h += `</div>`;
    return h;
  },

  renderUnexplored(t) {
    const info = Kingdom.scoutInfo(0, t);
    let h = this.head('🌫️ Unexplored land', '<span class="muted">No map of this region exists yet.</span>', '#555a66');
    h += `<div class="ctx-body"><div class="empty-state"><div class="big">🧭</div>What lies beyond is unknown: the owner, its people and its defenders.</div>
      <div class="act-card"><div class="ah">🔭 Send scouts</div><div class="ad">Reveals this territory (and maybe the lands beyond). Armies also explore as they march, and conquests reveal neighbouring lands.</div>
      <div class="row between">${H.cost(info.cost)}${H.btn('Scout', 'scout', { tid: t }, { cls: 'primary small', disabled: !info.ok, why: info.reason })}</div></div></div>`;
    return h;
  },

  statGrid(t) {
    const s = Game.state, ts = s.terr[t];
    const hp = Economy.happyTarget(t, true);
    const hTip = `<b>Happiness ${Math.round(ts.happy)}%</b> (moving toward ${Math.round(hp.v)}%)<hr>${hp.parts.map(([a, v]) => `<div class="tt-row"><span>${escapeHtml(a)}</span><b class="${v >= 0 ? 'good' : 'bad'}">${v >= 0 ? '+' : ''}${v}</b></div>`).join('')}`;
    const T = TERRAIN[Game.wt(t).terrain];
    const def = Battle.defenders(t);
    return `<div class="grid2">
      <div class="stat"><div class="k">👥 Population</div><div class="v">${fmt(ts.pop)} <small>/ ${fmt(Economy.popCap(t))}</small></div></div>
      <div class="stat" data-tip="${escapeHtml(hTip)}"><div class="k">😊 Happiness</div><div class="v">${H.face(ts.happy)} ${Math.round(ts.happy)}%</div></div>
      <div class="stat" data-tip="Garrison plus armies standing here. Walls: +18% defense per level. Terrain: +${Math.round(T.defense * 100)}% defense."><div class="k">🛡️ Defenders</div><div class="v">${fmt(Battle.total(def.units))} <small>🧱${ts.fort}${T.defense ? ` ⛰️+${Math.round(T.defense * 100)}%` : ''}</small></div></div>
      <div class="stat" data-tip="Each development level adds +5% output and +25 population capacity."><div class="k">📈 Development</div><div class="v">${ts.dev} <small>/ 10</small></div></div>
    </div>`;
  },

  yieldRow(t) {
    const y = Economy.yieldOf(t, true);
    return `<div class="uchips mt">${['gold', 'food', 'wood', 'iron', 'rp'].map((k) => `<span class="chip" data-tip="${RES_NAME[k]} per day">${RES_ICON[k]} ${fmtRate(y[k])}</span>`).join('')}</div>`;
  },

  ownTerritory(t) {
    const s = Game.state, ts = s.terr[t];
    let h = this.statGrid(t) + this.yieldRow(t);
    if (ts.unrest > 5) h += `<div class="small warn mt">🔥 Recently conquered: unrest ${Math.round(ts.unrest)} (fades over time).</div>`;
    if (ts.proj) h += `<div class="act-card mt" style="border-color:rgba(111,182,255,.5)"><div class="row between"><b>${Kingdom.projectName(ts.proj)}</b><span class="row small">${Live.text('proj', t)} ${H.btn('✕', 'cancelProject', { tid: t }, { cls: 'small ghost', tip: 'Cancel (50% refund)' })}</span></div>${Live.bar('proj', t)}</div>`;
    h += `<div class="tabs mt">${[['overview', '🏛️ Manage'], ['build', '🏗️ Build'], ['military', '⚔️ Military']].map(([id, n]) => `<button class="${this.tab === id ? 'on' : ''}" data-act="ctxTab" data-t="${id}">${n}</button>`).join('')}</div>`;
    if (this.tab === 'overview') h += this.manageTab(t);
    else if (this.tab === 'build') h += this.buildTab(t);
    else h += this.militaryTab(t);
    return h;
  },

  manageTab(t) {
    const s = Game.state, ts = s.terr[t];
    const dv = Kingdom.developInfo(0, t), fo = Kingdom.fortifyInfo(0, t), ti = Kingdom.tierInfo(0, t);
    let h = '';
    h += `<div class="act-card"><div class="ah">📈 Develop <span class="muted small">(level ${ts.dev}/10)</span></div><div class="ad">Roads, workshops and irrigation: +5% output of this territory and +25 population capacity.</div>
      ${dv.maxed ? '<span class="chip gold">★ Fully developed</span>' : `<div class="row between">${H.cost(dv.cost)}<span class="small muted">⏱ ${H.days(dv.time)}</span>${H.btn('Develop', 'develop', { tid: t }, { cls: 'small ' + (dv.ok ? 'primary' : ''), disabled: !dv.ok, why: dv.reason })}</div>`}</div>`;
    h += `<div class="act-card"><div class="ah">🧱 Fortify <span class="muted small">(walls ${ts.fort}/${Kingdom.maxFort(0)})</span></div><div class="ad">Stronger walls: +18% defense per level. Siege engines can break them.</div>
      ${fo.maxed ? '<span class="chip gold">★ Maximum walls</span>' : `<div class="row between">${H.cost(fo.cost)}<span class="small muted">⏱ ${H.days(fo.time)}</span>${H.btn('Fortify', 'fortify', { tid: t }, { cls: 'small ' + (fo.ok ? 'primary' : ''), disabled: !fo.ok, why: fo.reason })}</div>`}</div>`;
    if (!ti.maxed) {
      const N = ti.next;
      h += `<div class="act-card"><div class="ah">${N.icon} Grow into a ${N.name}</div><div class="ad">Population capacity ${fmt(N.popCap)}, +${Math.round((N.mult - 1) * 100)}% production, +${N.gold} gold/day, faster recruiting and buildings up to level ${N.maxLvl}${Game.player().capital === t ? '+1' : ''}.</div>
        ${ti.reqs.map((q) => `<div class="req ${q.ok ? 'ok' : 'no'}">${q.ok ? '✔' : '✖'} ${q.text}</div>`).join('')}
        <div class="row between">${H.cost(ti.cost)}<span class="small muted">⏱ ${H.days(ti.time)}</span>${H.btn('Grow', 'growTier', { tid: t }, { cls: 'small ' + (ti.ok ? 'primary' : ''), disabled: !ti.ok, why: ti.reason })}</div></div>`;
    } else h += `<div class="act-card"><div class="ah">${TIERS[ts.tier].icon} ${TIERS[ts.tier].name}</div><div class="ad">${escapeHtml(ti.reason)}</div></div>`;
    h += `<div class="act-card"><div class="ah">💰 Taxes</div><div class="ad">More gold, or happier and faster-growing people.</div>
      <div class="seg">${TAX_LEVELS.map((x, i) => `<button class="${ts.tax === i ? 'on' : ''}" data-act="tax" data-tid="${t}" data-v="${i}" data-tip="${x.gold}× tax gold · ${x.happy >= 0 ? '+' : ''}${x.happy} happiness">${x.icon} ${x.name}</button>`).join('')}</div></div>`;
    return h;
  },

  buildTab(t) {
    const s = Game.state, ts = s.terr[t];
    const isCap = Game.player().capital === t;
    let h = `<div class="small muted" style="margin-bottom:8px">A ${TIERS[ts.tier].name} allows buildings up to level ${Kingdom.maxLevel(0, t, 'farm')}. One construction at a time per territory.</div>`;
    for (const b of BUILDING_ORDER) {
      const B = BUILDINGS[b];
      if (B.capitalOnly && !isCap) continue;
      const inf = Kingdom.buildInfo(0, t, b);
      const lvl = ts.b[b];
      const building = ts.proj && ts.proj.type === 'build' && ts.proj.id === b;
      h += `<div class="unit-row" data-tip="${escapeHtml(B.desc)}"><div class="ui">${B.icon}</div>
        <div><div class="row"><span class="un">${B.name}</span>${H.pips(lvl, B.maxLevel || 5)}</div><div class="small muted">${lvl ? B.effect(lvl) : 'Not built'}${!inf.maxed ? ` → <span style="color:var(--text-2)">${B.effect(lvl + 1)}</span>` : ''}</div>
        ${building ? `<div class="row small mt"><span class="grow">${Live.bar('proj', t)}</span>${Live.text('proj', t)}</div>` : inf.maxed ? '' : `<div class="row mt small">${H.cost(inf.cost)}<span class="muted">⏱ ${inf.time}d</span></div>`}</div>
        <div>${building ? '🔨' : inf.maxed ? '<span class="chip gold">Max</span>' : H.btn(lvl ? '⬆' : 'Build', 'build', { tid: t, b }, { cls: 'small ' + (inf.ok ? 'primary' : ''), disabled: !inf.ok, why: inf.reason, tip: lvl ? `Upgrade to level ${lvl + 1}` : '' })}</div></div>`;
    }
    return h;
  },

  militaryTab(t) {
    const s = Game.state, ts = s.terr[t];
    let h = `<h3 class="sec">🛡️ Garrison</h3>${H.units(ts.gar)}
      <div class="row between mt small"><span class="muted">Strength ${fmt(Battle.strength(ts.gar, 0))}</span>${H.btn('⚔️ Raise army', 'compose', { mode: 'create', tid: t }, { cls: 'small primary', disabled: Battle.total(ts.gar) < 1 || Army.of(0).length >= Army.maxArmies(0), why: Battle.total(ts.gar) < 1 ? 'The garrison is empty.' : `You already command ${Army.maxArmies(0)} armies.` })}</div>`;
    const here = Army.at(t, 0);
    if (here.length) h += `<div class="mt">${here.map((a) => `<div class="card click" data-act="focusArmy" data-id="${a.id}"><div class="row between"><b>🚩 ${escapeHtml(a.name)}</b><span class="small">${fmt(Battle.total(a.units))} soldiers</span></div></div>`).join('')}</div>`;
    h += `<h3 class="sec">⚒️ Recruit</h3><div class="small muted" style="margin-bottom:8px">Barracks level ${ts.b.barracks} · ${fmt(Army.availablePop(t))} people can be recruited here${ts.b.barracks ? '' : ' · Without Barracks only militia infantry (half speed)'}</div>`;
    for (const u of UNIT_ORDER) {
      const U = UNITS[u];
      const req = Army.unitReq(0, t, u);
      const max = req.ok ? Army.maxTrain(0, t, u) : 0;
      const q = clamp(this.qty[u] || 1, 1, Math.max(1, max));
      const perDay = Army.trainRate(0, t) / U.time;
      h += `<div class="unit-row ${req.ok ? '' : 'locked'}"><div class="ui">${U.icon}</div>
        <div><div class="un">${U.name} <span class="muted small">⚔${U.atk} 🛡${U.def} ❤${U.hp}</span></div>
          <div class="small">${H.cost(U.cost)} <span class="muted">each · ${fmt(perDay)}/day</span></div>
          ${req.ok ? `<div class="qty"><input type="number" min="1" max="${Math.max(1, max)}" value="${q}" data-qty="${u}"><button data-act="qty" data-u="${u}" data-v="10">+10</button><button data-act="qty" data-u="${u}" data-v="50">+50</button><button data-act="qty" data-u="${u}" data-v="max">Max ${fmt(max)}</button></div>` : `<div class="small bad">🔒 ${escapeHtml(req.reason)}</div>`}
        </div>
        <div>${req.ok ? H.btn('Train', 'train', { tid: t, u }, { cls: 'small ' + (max >= 1 ? 'primary' : ''), disabled: max < 1, why: Game.missing(0, U.cost) || 'Not enough people to recruit.' }) : ''}</div></div>`;
    }
    if (ts.queue.length) {
      h += `<h3 class="sec">⏳ Training queue</h3>`;
      ts.queue.forEach((q, i) => {
        h += `<div class="act-card"><div class="row between"><b>${UNITS[q.u].icon} ${q.n} ${UNITS[q.u].name}</b>${H.btn('✕', 'cancelTrain', { tid: t, i }, { cls: 'small ghost', tip: 'Cancel (full refund of untrained soldiers)' })}</div>
          ${i === 0 ? `<div class="row small"><span class="grow">${Live.bar('train', t, 'good')}</span>${Live.text('train', t)}</div>` : '<div class="small muted">Waiting…</div>'}</div>`;
      });
      h += `<div class="small muted mt">Queue finishes in about ${H.days(Army.queueDays(0, t))}.</div>`;
    }
    return h;
  },

  foreignTerritory(t) {
    const s = Game.state, ts = s.terr[t];
    const owner = ts.owner;
    let h = this.statGrid(t);
    const def = Battle.defenders(t);
    h += `<h3 class="sec">🛡️ Defenders</h3>${H.units(def.units)}<div class="small muted mt">Defense strength ${fmt(Battle.strength(def.units, owner))}${def.general ? ` · ★ General ${escapeHtml(def.general.name)}` : ''}</div>`;
    h += `<h3 class="sec">💎 Value</h3><div class="small muted">Output if it were yours (before your bonuses):</div>${this.yieldRow(t)}`;
    if (owner >= 0) {
      const r = Diplomacy.rel(0, owner);
      const lab = Diplomacy.relationLabel(r.v);
      h += `<div class="row between mt small"><span>Relations with ${escapeHtml(Game.k(owner).short)}</span><b class="${lab.cls}">${lab.text} (${Math.round(r.v)})</b></div>`;
      if (r.st === 'alliance') {
        h += `<div class="card mt" style="border-color:rgba(95,208,138,.45)"><b class="good">🤝 Your ally.</b> <span class="small muted">Your armies may march through allied land.</span></div>`;
        return h;
      }
      if (r.st !== 'war') {
        h += `<div class="act-card mt"><div class="ah">🕊️ At peace with ${escapeHtml(Game.k(owner).short)}</div><div class="ad">You must declare war before you can attack their lands.${r.truce > 0 ? ` <span class="warn">A truce is still in force (${Math.ceil(r.truce)} days) — breaking it angers everyone.</span>` : ''}</div>
          <div class="row">${H.btn('⚔️ Declare war', 'declareWar', { k: owner }, { cls: 'danger small' })}${H.btn('🤝 Diplomacy', 'openPanel', { p: 'diplomacy' }, { cls: 'small' })}</div></div>`;
        return h;
      }
    }
    h += `<h3 class="sec">⚔️ Attack</h3>`;
    const armies = Army.of(0);
    if (!armies.length) {
      h += `<div class="small muted">You have no army. Raise one from a garrison next to this territory (Army panel or your territory's Military tab).</div>`;
      return h;
    }
    let any = false;
    for (const a of armies) {
      const start = a.move ? a.move.to : a.loc;
      const r = Army.findPath(0, start, t, Army.speed(a));
      if (r.error) {
        h += `<div class="act-card"><div class="row between"><b>🚩 ${escapeHtml(a.name)}</b><span class="small muted">${fmt(Battle.total(a.units))}</span></div><div class="small muted">No route from ${H.tname(start)}.</div></div>`;
        continue;
      }
      any = true;
      const pred = Battle.predict(0, a.units, a.general, t, r.sea, 20);
      h += this.attackCard(a, t, r, pred);
    }
    if (!any) h += `<div class="small muted mt">None of your armies can reach this territory. You need a territory bordering it (or a sea route) to launch an attack.</div>`;
    return h;
  },

  attackCard(a, t, r, pred) {
    const pc = Math.round(pred.chance * 100);
    const eta = r.days + (a.move ? a.move.days * (1 - a.move.t) : 0);
    const verdict = pred.chance >= 0.85 ? 'Decisive victory expected' : pred.chance >= 0.6 ? 'Likely victory' : pred.chance >= 0.35 ? 'Uncertain battle' : pred.chance > 0.05 ? 'Likely defeat' : 'Hopeless';
    return `<div class="act-card">
      <div class="row between"><b>🚩 ${escapeHtml(a.name)}</b><span class="small muted">${fmt(Battle.total(a.units))} soldiers · ${H.days(eta)}</span></div>
      <div class="odds"><div class="odds-ring" style="--p:${pc};--oc:${H.pctColor(pred.chance)}"><span>${pc}%</span></div>
        <div class="small"><b style="color:${H.pctColor(pred.chance)}">${verdict}</b><br>Est. losses: <b>${fmt(pred.attLoss)}</b> of yours, <b>${fmt(pred.defLoss)}</b> of theirs<br><span class="muted">${TERRAIN[pred.terrain].icon} ${TERRAIN[pred.terrain].name}${pred.fort ? ` · 🧱 walls ${pred.fort}` : ''}${r.sea ? ' · ⛵ sea landing (−25% attack at first)' : ''}</span></div></div>
      ${H.btn('⚔️ ATTACK', 'attack', { id: a.id, tid: t }, { cls: 'attack block ' + (pred.chance >= 0.6 ? 'pulse' : '') })}
    </div>`;
  },

  /* ---------------- armies ---------------- */
  renderArmy(a) {
    const s = Game.state;
    const mine = a.owner === 0;
    const color = Game.ownerColor(a.owner);
    const status = a.move ? `🥾 Marching to <b>${H.tname(a.move.to)}</b>` : `📍 In <b>${H.tname(a.loc)}</b>`;
    let h = this.head(`🚩 ${escapeHtml(a.name)}${mine ? ' <button class="btn small ghost" data-act="renameArmy" data-id="' + a.id + '" data-tip="Rename">✎</button>' : ''}`, `${H.kname(a.owner)} · ${status}`, color);
    h += `<div class="ctx-body">`;
    const upkeep = UNIT_ORDER.reduce((x, u) => x + a.units[u] * UNITS[u].upkeep, 0);
    h += `<div class="grid2">
      <div class="stat"><div class="k">Soldiers</div><div class="v">${fmtInt(Battle.total(a.units))}</div></div>
      <div class="stat"><div class="k">Strength</div><div class="v">${fmt(Battle.strength(a.units, a.owner))}</div></div>
      <div class="stat"><div class="k">Speed</div><div class="v">${Army.speed(a).toFixed(2)}</div></div>
      <div class="stat"><div class="k">Upkeep</div><div class="v">${fmt(upkeep)} <small>💰/day</small></div></div>
    </div><div class="mt">${H.units(a.units)}</div>`;
    if (a.general) {
      const G = a.general, T = GENERAL_TRAITS[G.trait];
      h += `<div class="card mt"><div class="row"><span style="font-size:26px">🎖️</span><div class="grow"><b>General ${escapeHtml(G.name)}</b><div class="small">${T.icon} ${T.name} — ${T.desc}</div><div class="row small mt"><span class="muted">Lv ${G.level || 1}</span><span class="grow">${H.bar((G.xp || 0) / (60 * (G.level || 1)), 'good')}</span></div></div></div></div>`;
    } else if (mine) {
      const cost = Army.generalCost(0);
      h += `<div class="act-card mt"><div class="ah">🎖️ No general</div><div class="ad">A general brings a special trait (e.g. +12% attack, +15% defense, faster marching) and grows stronger with every battle.</div>${H.btn(`Hire general (${cost}💰)`, 'hireGeneral', { id: a.id }, { cls: 'small', disabled: !Game.canAfford(0, { gold: cost }), why: 'Not enough gold.' })}</div>`;
    }
    if (!mine) {
      if (a.move) h += `<div class="small muted mt">Heading for ${H.tname(a.move.to)} (${Game.ownerName(s.terr[a.move.to].owner)}).</div>`;
      h += `</div>`;
      return h;
    }
    // orders
    h += `<h3 class="sec">🧭 Orders</h3>`;
    if (a.move) h += `<div class="act-card"><div class="row between"><b>Marching${a.path.length > 1 ? ` → ${H.tname(a.path[a.path.length - 1])}` : ''}</b>${Live.text('move', a.id)}</div>${Live.bar('move', a.id)}<div>${H.btn('✋ Halt at next territory', 'stopArmy', { id: a.id }, { cls: 'small' })}</div></div>`;
    const tgt = MapView.orderTarget;
    if (tgt >= 0) h += this.orderPreview(a, tgt);
    else h += `<div class="card small"><b>Click a territory</b> on the map to plan a march or an attack.<br><span class="muted">Right-click orders the march immediately.</span></div>`;
    if (!a.move) {
      const others = Army.at(a.loc, 0).filter((x) => x !== a);
      h += `<h3 class="sec">🏕️ Camp</h3><div class="actions">
        ${H.btn('➕ Reinforce', 'compose', { mode: 'reinforce', id: a.id }, { cls: 'small', disabled: s.terr[a.loc].owner !== 0 || Battle.total(s.terr[a.loc].gar) < 1, why: 'Only from the garrison of one of your own territories.' })}
        ${H.btn('🏠 Station troops', 'compose', { mode: 'station', id: a.id }, { cls: 'small', disabled: s.terr[a.loc].owner !== 0, why: 'Only in your own territories.' })}
        ${H.btn('✂️ Split', 'compose', { mode: 'split', id: a.id }, { cls: 'small', disabled: Army.of(0).length >= Army.maxArmies(0), why: 'You command the maximum number of armies.' })}
        ${others.map((o) => H.btn(`🔗 Merge ${escapeHtml(o.name)}`, 'mergeArmy', { id: a.id, o: o.id }, { cls: 'small' })).join('')}
        ${H.btn('Disband', 'disbandArmy', { id: a.id }, { cls: 'small ghost', disabled: s.terr[a.loc].owner !== 0, why: 'Only in your own territories.' })}
      </div>`;
    }
    h += `</div>`;
    return h;
  },

  orderPreview(a, t) {
    const s = Game.state, ts = s.terr[t];
    const start = a.move ? a.move.to : a.loc;
    let h = `<div class="act-card" style="border-color:rgba(255,215,106,.5)"><div class="row between"><b>🎯 ${s.explored[t] ? H.tname(t) : 'Unexplored land'}</b>${H.btn('✕', 'clearOrder', {}, { cls: 'small ghost' })}</div>`;
    if (s.explored[t]) h += `<div class="small">${H.kname(ts.owner)} · ${H.terrain(t)} · ${TIERS[ts.tier].name}</div>`;
    const r = Army.findPath(0, start, t, Army.speed(a));
    if (r.error) {
      h += `<div class="small bad">${escapeHtml(r.error)}</div>`;
      if (ts.owner > 0 && !Diplomacy.atWar(0, ts.owner) && !Diplomacy.allied(0, ts.owner)) h += H.btn('⚔️ Declare war', 'declareWar', { k: ts.owner }, { cls: 'danger small' });
      return h + '</div>';
    }
    const eta = r.days + (a.move ? a.move.days * (1 - a.move.t) : 0);
    h += `<div class="small muted">${r.path.length} ${plural(r.path.length, 'step')} · arrives in ${H.days(eta)}${r.sea ? ' · ⛵ by sea' : ''}</div>`;
    if (r.attack) {
      if (!s.explored[t]) h += `<div class="small warn">⚠️ You do not know what defends this land.</div>${H.btn('⚔️ ATTACK', 'attack', { id: a.id, tid: t }, { cls: 'attack block' })}`;
      else {
        const pred = Battle.predict(0, a.units, a.general, t, r.sea, 20);
        const pc = Math.round(pred.chance * 100);
        h += `<div class="odds mt"><div class="odds-ring" style="--p:${pc};--oc:${H.pctColor(pred.chance)}"><span>${pc}%</span></div><div class="small">Win chance<br>Defenders: <b>${fmt(pred.defTotal)}</b>${pred.fort ? ` · 🧱${pred.fort}` : ''}<br>Est. losses: <b>${fmt(pred.attLoss)}</b> / ${fmt(pred.defLoss)}</div></div>
          ${H.btn('⚔️ ATTACK', 'attack', { id: a.id, tid: t }, { cls: 'attack block ' + (pred.chance >= 0.6 ? 'pulse' : '') })}`;
      }
    } else h += H.btn('🚩 March here', 'march', { id: a.id, tid: t }, { cls: 'primary block' });
    return h + '</div>';
  },
};

/* ---------------- context actions ---------------- */
UI.act('deselect', () => { MapView.select(null); document.getElementById('context').classList.remove('open'); });
UI.act('goHome', () => UI.goHome());
UI.act('ctxTab', (d) => { Context.tab = d.t; Context.refresh(true); Sound.play('click'); });
UI.act('develop', (d) => UI.result(Kingdom.develop(0, +d.tid), 'build'));
UI.act('fortify', (d) => UI.result(Kingdom.fortify(0, +d.tid), 'build'));
UI.act('growTier', (d) => UI.result(Kingdom.upgradeTier(0, +d.tid), 'build'));
UI.act('cancelProject', (d) => UI.confirm({ title: 'Cancel construction?', text: 'You get half of the cost back.', ok: 'Cancel project', danger: true, onOk: () => UI.result(Kingdom.cancelProject(0, +d.tid)) }));
UI.act('tax', (d) => UI.result(Kingdom.setTax(0, +d.tid, +d.v)));
UI.act('scout', (d) => UI.result(Kingdom.scout(0, +d.tid), 'notify'));
UI.act('qty', (d) => {
  const t = MapView.sel && MapView.sel.id;
  const max = Army.maxTrain(0, t, d.u);
  Context.qty[d.u] = d.v === 'max' ? Math.max(1, max) : clamp((Context.qty[d.u] || 0) + +d.v, 1, Math.max(1, max));
  Context.refresh(true);
});
UI.act('train', (d) => {
  const input = document.querySelector(`#context input[data-qty="${d.u}"]`);
  const n = input ? Math.floor(+input.value) : Context.qty[d.u];
  Context.qty[d.u] = n;
  UI.result(Army.train(0, +d.tid, d.u, n), 'build');
});
UI.act('cancelTrain', (d) => UI.result(Army.cancelTraining(0, +d.tid, +d.i)));
UI.act('clearOrder', () => { MapView.orderTarget = -1; Context.refresh(true); });
UI.act('march', (d) => { if (UI.result(Army.order(0, +d.id, +d.tid), 'march')) { MapView.orderTarget = -1; Context.refresh(true); } });
UI.act('attack', (d) => {
  const r = Army.order(0, +d.id, +d.tid);
  if (UI.result(r, 'war')) {
    MapView.orderTarget = -1;
    MapView.select({ type: 'army', id: +d.id });
    if (Game.state.speed === 0) UI.hint('⏸ The game is paused — press <b>Space</b> to march', 4);
  }
});
UI.act('mergeArmy', (d) => UI.result(Army.merge(0, +d.id, +d.o)));
UI.act('renameArmy', (d) => {
  const a = Army.byId(+d.id);
  if (!a) return;
  const m = UI.modal({ title: 'Rename army', icon: '✎', body: `<div class="field"><label>Name</label><input type="text" maxlength="28" value="${escapeHtml(a.name)}" id="rename-input"></div>`, foot: '<button class="btn" data-close>Cancel</button><button class="btn primary" id="rename-ok">Save</button>' });
  const inp = m.root.querySelector('#rename-input');
  inp.focus(); inp.select();
  const ok = () => { UI.result(Army.rename(0, a.id, inp.value)); m.close(); };
  m.root.querySelector('#rename-ok').addEventListener('click', ok);
  inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') ok(); });
});
document.addEventListener('change', (e) => {
  const el = e.target;
  if (el && el.dataset && el.dataset.qty) Context.qty[el.dataset.qty] = Math.max(1, Math.floor(+el.value || 1));
});
