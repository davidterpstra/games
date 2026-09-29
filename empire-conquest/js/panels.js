/* =====================================================================
   EMPIRE CONQUEST — main panels: Kingdom, Army, War, Diplomacy,
   Technology and Missions. Each view has sig() (re-render when it
   changes) and render(); progress bars update live in between.
   ===================================================================== */
'use strict';

/* live progress bars / counters: <div data-live="kind:arg"> */
const Live = {
  val(kind, arg) {
    const s = Game.state;
    if (kind === 'proj') { const p = s.terr[arg] && s.terr[arg].proj; return p ? { p: 1 - p.left / p.total, t: H.days(p.left) } : null; }
    if (kind === 'train') {
      const q = s.terr[arg] && s.terr[arg].queue[0];
      return q ? { p: (q.done + q.prog) / q.n, t: `${q.done}/${q.n}` } : null;
    }
    if (kind === 'research') { const r = Game.player().research; return r ? { p: 1 - r.left / r.total, t: H.days(r.left) } : null; }
    if (kind === 'move') {
      const a = Army.byId(+arg);
      return a && a.move ? { p: a.move.t, t: H.days(Army.eta(a)) } : null;
    }
    return null;
  },
  update(root) {
    if (!root) return;
    for (const el of root.querySelectorAll('[data-live]')) {
      const [kind, arg] = el.dataset.live.split(':');
      const v = this.val(kind, isNaN(+arg) ? arg : +arg);
      if (!v) continue;
      const bar = el.querySelector('i');
      if (bar) bar.style.width = clamp(v.p, 0, 1) * 100 + '%';
      const txt = el.parentElement && el.parentElement.querySelector(`[data-livetext="${el.dataset.live}"]`);
      if (txt) txt.textContent = v.t;
    }
  },
  bar(kind, arg, cls = 'info') {
    const v = this.val(kind, arg) || { p: 0, t: '' };
    return `<div class="bar ${cls} anim" data-live="${kind}:${arg}"><i style="width:${clamp(v.p, 0, 1) * 100}%"></i></div>`;
  },
  text(kind, arg) {
    const v = this.val(kind, arg) || { t: '' };
    return `<span data-livetext="${kind}:${arg}">${v.t}</span>`;
  },
};

const Panels = {
  current: null,
  sig: '',
  el() { return document.getElementById('panel'); },

  open(name) {
    this.current = name;
    this.render(true);
    this.el().classList.add('open');
    this.el().scrollTop = 0;
    const b = this.el().querySelector('.panel-body');
    if (b) b.scrollTop = 0;
  },
  close() {
    this.current = null;
    this.el().classList.remove('open');
    for (const b of document.querySelectorAll('#sidebar button')) b.classList.toggle('active', b.dataset.panel === 'map');
  },
  refresh(force) {
    if (!this.current || !Game.state) return;
    const v = this.views[this.current];
    const sig = v.sig();
    if (force || sig !== this.sig) {
      if (!force && UI.pointerDown) return;
      this.render();
    } else Live.update(this.el());
  },
  render() {
    const v = this.views[this.current];
    if (!v) return;
    const el = this.el();
    const body = el.querySelector('.panel-body');
    const scroll = body ? body.scrollTop : 0;
    this.sig = v.sig();
    el.innerHTML = `<div class="panel-head"><span class="ico">${v.icon}</span><h2>${v.title}</h2><button class="close-btn" data-act="openPanel" data-p="map" data-tip="Close (Esc)">✕</button></div>
      <div class="panel-body">${v.render()}</div>`;
    const nb = el.querySelector('.panel-body');
    if (nb) nb.scrollTop = scroll;
  },

  views: {},
};

/* ================= KINGDOM ================= */
Panels.views.kingdom = {
  title: 'Kingdom', icon: '🏰',
  sig() {
    const s = Game.state, k = Game.player();
    const cap = k.capital;
    const ts = s.terr[cap];
    const aff = BUILDING_ORDER.map((b) => (Kingdom.buildInfo(0, cap, b).ok ? 1 : 0)).join('');
    return [Math.floor(s.day / 3), aff, JSON.stringify(ts.b), ts.proj && ts.proj.type, ts.tier, JSON.stringify(k.ruler), Game.territoriesOf(0).length, k.capital].join('|');
  },
  render() {
    const s = Game.state, k = Game.player(), r = k.ruler, c = Game.cache;
    const rank = Game.ranking();
    const myRank = rank.findIndex((x) => x.id === 0) + 1;
    const xpNeed = rulerXpFor(r.level);
    let h = `<div class="card hl"><div class="ruler">
      <div class="portrait" style="background:radial-gradient(circle at 35% 30%, ${shade(k.color, 0.25)}, ${shade(k.color, -0.45)})">👑<span class="lvl">Lv ${r.level}</span></div>
      <div class="grow">
        <div class="kname" style="font-size:18px">${escapeHtml(r.title)} ${escapeHtml(r.name)}</div>
        <div class="card-sub">Ruler of the ${escapeHtml(k.name)}</div>
        <div class="row mt small"><span class="muted">Experience</span><span class="grow">${H.bar(r.xp / xpNeed, 'good')}</span><span class="muted">${Math.floor(r.xp)}/${xpNeed}</span></div>
        ${r.points > 0 ? `<div class="gold-t small mt" style="font-weight:800">✨ ${r.points} skill point${r.points > 1 ? 's' : ''} to spend!</div>` : '<div class="muted small mt">Earn experience by conquering, winning battles, research and missions.</div>'}
      </div></div>
      <div class="grid2 mt">${RULER_STATS.map((st) => `<div class="skill" data-tip="<b>${st.name}</b><br>${escapeHtml(st.desc)}"><span style="font-size:18px">${st.icon}</span><span class="grow small" style="font-weight:700">${st.name}</span><span class="sv">${r[st.id]}</span>${r.points > 0 && r[st.id] < 10 ? `<button class="plus" data-act="rulerPoint" data-s="${st.id}" data-tip="Improve ${st.name}">+</button>` : ''}</div>`).join('')}</div>
    </div>`;
    h += `<h3 class="sec">📊 The Realm</h3><div class="grid3">
      <div class="stat"><div class="k">Territories</div><div class="v">${Game.territoriesOf(0).length}</div></div>
      <div class="stat"><div class="k">Population</div><div class="v">${fmt(c.pop[0] || 0)} <small>/ ${fmt(c.popCap[0] || 0)}</small></div></div>
      <div class="stat"><div class="k">Happiness</div><div class="v">${H.face(c.happy[0] || 0)} ${Math.round(c.happy[0] || 0)}%</div></div>
      <div class="stat"><div class="k">Soldiers</div><div class="v">${fmt(c.soldiers[0] || 0)}</div></div>
      <div class="stat"><div class="k">Military power</div><div class="v">${fmt(c.power[0] || 0)}</div></div>
      <div class="stat" data-tip="Power score combines land, people, army and technology."><div class="k">World rank</div><div class="v">#${myRank} <small>of ${rank.length}</small></div></div>
    </div>`;
    // capital buildings
    const cap = k.capital, ts = s.terr[cap];
    h += `<h3 class="sec">🏰 Capital — ${H.tname(cap)}</h3>
      <div class="row between small"><span>${TIERS[ts.tier].icon} ${TIERS[ts.tier].name} · ${H.terrain(cap)}</span>${H.btn('📍 Show on map', 'focus', { tid: cap }, { cls: 'small ghost' })}</div>`;
    if (ts.proj) h += `<div class="card mt" style="border-color:rgba(111,182,255,.45)"><div class="row between"><b>${Kingdom.projectName(ts.proj)}</b>${Live.text('proj', cap)}</div><div class="mt">${Live.bar('proj', cap)}</div></div>`;
    h += `<div class="bgrid mt">${BUILDING_ORDER.map((b) => Panels.buildingCard(0, cap, b)).join('')}</div>`;
    // territories
    const terr = Game.territoriesOf(0).slice().sort((a, b) => (b === cap) - (a === cap) || s.terr[b].pop - s.terr[a].pop);
    h += `<h3 class="sec">🗺️ Territories (${terr.length})</h3>
      <div class="row between small mt" style="margin-bottom:8px"><span class="muted">Set taxes everywhere:</span><span class="seg">${TAX_LEVELS.map((t, i) => `<button data-act="taxAll" data-v="${i}" data-tip="${t.name} taxes: ${t.gold}× tax gold, ${t.happy >= 0 ? '+' : ''}${t.happy} happiness">${t.icon} ${t.name}</button>`).join('')}</span></div>
      <table class="tbl"><thead><tr><th>Territory</th><th class="num">👥</th><th class="num">😊</th><th class="num">💰/d</th><th class="num">🛡</th><th></th></tr></thead><tbody>
      ${terr.map((t) => {
        const tt = s.terr[t], y = Economy.yieldOf(t);
        return `<tr class="click" data-act="focus" data-tid="${t}"><td>${tt.owner === 0 && k.capital === t ? '👑 ' : ''}${TIERS[tt.tier].icon} ${H.tname(t)} <span class="muted small">${TERRAIN[Game.wt(t).terrain].icon}</span></td><td class="num">${fmt(tt.pop)}</td><td class="num">${H.face(tt.happy)} ${Math.round(tt.happy)}</td><td class="num">${fmtRate(y.gold)}</td><td class="num">${fmt(Battle.total(tt.gar))}${tt.fort ? ` <span class="muted">🧱${tt.fort}</span>` : ''}</td><td>${tt.proj ? '🔨' : ''}${tt.queue.length ? '🪖' : ''}${tt.unrest > 10 ? '<span data-tip="Recently conquered: unrest">🔥</span>' : ''}</td></tr>`;
      }).join('')}</tbody></table>`;
    return h;
  },
};

Panels.buildingCard = function (kid, tid, b) {
  const s = Game.state, ts = s.terr[tid], B = BUILDINGS[b];
  const info = Kingdom.buildInfo(kid, tid, b);
  const lvl = ts.b[b];
  const maxL = B.maxLevel || 5;
  const building = ts.proj && ts.proj.type === 'build' && ts.proj.id === b;
  if (B.capitalOnly && Game.k(kid).capital !== tid) return '';
  const eff = lvl > 0 ? B.effect(lvl) : '<span class="muted">Not built</span>';
  const next = !info.maxed ? `<div class="small muted">Next: ${B.effect(lvl + 1)}</div>` : '';
  let btn;
  if (building) btn = `<div class="row small"><span class="grow">${Live.bar('proj', tid)}</span>${Live.text('proj', tid)}</div>`;
  else if (info.maxed) btn = '<span class="chip gold">★ Max level</span>';
  else btn = `${H.cost(info.cost, kid)}<div class="row between"><span class="small muted">⏱ ${H.days(info.time)}</span>${H.btn(lvl ? '⬆ Upgrade' : '🔨 Build', 'build', { tid, b }, { cls: 'small ' + (info.ok ? 'primary' : ''), disabled: !info.ok, why: info.reason })}</div>`;
  return `<div class="bcard ${building ? 'building' : ''} ${info.maxed ? 'maxed' : ''}" data-bcard="${tid}:${b}">
    <div class="bhead"><div class="bico">${B.icon}</div><div class="grow"><div class="bname">${B.name}</div>${H.pips(lvl, maxL)}</div></div>
    <div class="beff" data-tip="${escapeHtml(B.desc)}">${eff}${next}</div>${btn}</div>`;
};

/* ================= ARMY ================= */
Panels.views.army = {
  title: 'Army', icon: '🪖',
  sig() {
    const s = Game.state;
    const armies = Army.of(0).map((a) => `${a.id}:${Battle.total(a.units)}:${a.loc}:${a.move ? a.move.to : ''}:${a.path.length}:${a.general ? a.general.level : 0}:${a.name}`).join(',');
    const q = Game.territoriesOf(0).map((t) => s.terr[t].queue.length + ':' + Battle.total(s.terr[t].gar)).join(',');
    return [armies, q, Math.floor(s.day / 4), Math.floor(Game.player().res.gold / 50)].join('|');
  },
  render() {
    const s = Game.state, c = Game.cache;
    const armies = Army.of(0);
    const max = Army.maxArmies(0);
    const garTotal = Game.territoriesOf(0).reduce((a, t) => a + Battle.total(s.terr[t].gar), 0);
    let h = `<div class="grid3">
      <div class="stat"><div class="k">Armies</div><div class="v">${armies.length} <small>/ ${max}</small></div></div>
      <div class="stat"><div class="k">Soldiers</div><div class="v">${fmt(c.soldiers[0] || 0)}</div></div>
      <div class="stat"><div class="k">In garrisons</div><div class="v">${fmt(garTotal)}</div></div>
    </div>
    <div class="row mt">${H.btn('⚔️ Raise new army', 'raiseArmy', {}, { cls: 'primary', disabled: armies.length >= max, why: `You command the maximum of ${max} armies. Raise Leadership or research Administration for more.` })}
    <span class="muted small grow">Armies are formed from the soldiers in a territory's garrison.</span></div>`;
    h += `<h3 class="sec">🚩 Your armies</h3>`;
    if (!armies.length) h += `<div class="empty-state"><div class="big">🏕️</div>No armies in the field. Train soldiers in a territory with Barracks, then raise an army.</div>`;
    for (const a of armies) {
      const st = a.move ? `Marching to <b>${H.tname(a.move.to)}</b>${a.path.length > 1 ? ` → ${H.tname(a.path[a.path.length - 1])}` : ''}` : `Stationed in <b>${H.tname(a.loc)}</b>`;
      const hostileTarget = a.path.length && Game.isHostile(0, s.terr[a.path[a.path.length - 1]].owner);
      h += `<div class="card ${hostileTarget ? 'hl' : ''}">
        <div class="row between"><div><div class="card-title">🚩 ${escapeHtml(a.name)} ${hostileTarget ? '<span class="chip war">⚔️ Attacking</span>' : ''}</div><div class="card-sub">${st}</div></div>
        <div class="row">${H.btn('📍', 'focusArmy', { id: a.id }, { cls: 'small', tip: 'Select on map' })}</div></div>
        <div class="mt">${H.units(a.units)}</div>
        ${a.move ? `<div class="row small mt"><span class="grow">${Live.bar('move', a.id)}</span>${Live.text('move', a.id)}</div>` : ''}
        <div class="row between mt small"><span class="muted">Strength <b style="color:var(--text)">${fmt(Battle.strength(a.units, 0))}</b> · Speed ${Army.speed(a).toFixed(1)}</span>
        ${a.general ? `<span data-tip="${escapeHtml(GENERAL_TRAITS[a.general.trait].desc)}">★ ${escapeHtml(a.general.name)} · ${GENERAL_TRAITS[a.general.trait].icon} ${GENERAL_TRAITS[a.general.trait].name} · Lv ${a.general.level || 1}</span>`
          : H.btn(`★ Hire general (${Army.generalCost(0)}💰)`, 'hireGeneral', { id: a.id }, { cls: 'small', disabled: !Game.canAfford(0, { gold: Army.generalCost(0) }), why: 'Not enough gold.' })}</div>
        ${!a.move ? `<div class="actions mt">${H.btn('➕ Reinforce', 'compose', { mode: 'reinforce', id: a.id }, { cls: 'small' })}${H.btn('🏠 Station troops', 'compose', { mode: 'station', id: a.id }, { cls: 'small' })}${H.btn('✂️ Split', 'compose', { mode: 'split', id: a.id }, { cls: 'small' })}${H.btn('Disband', 'disbandArmy', { id: a.id }, { cls: 'small ghost' })}</div>` : `<div class="actions mt">${H.btn('✋ Halt', 'stopArmy', { id: a.id }, { cls: 'small' })}</div>`}
      </div>`;
    }
    // recruitment
    const rec = Game.territoriesOf(0).filter((t) => s.terr[t].b.barracks > 0 || s.terr[t].queue.length);
    h += `<h3 class="sec">⚒️ Recruitment</h3>`;
    if (!rec.length) h += `<div class="muted small">Build Barracks to train soldiers.</div>`;
    for (const t of rec) {
      const ts = s.terr[t];
      h += `<div class="card click" data-act="recruitAt" data-tid="${t}"><div class="row between"><b>${H.tname(t)}</b><span class="small muted">⚔️ Barracks ${ts.b.barracks} · ${fmt(Battle.total(ts.gar))} in garrison</span></div>
        ${ts.queue.length ? `<div class="row small mt"><span>${UNITS[ts.queue[0].u].icon} ${UNITS[ts.queue[0].u].name}</span><span class="grow">${Live.bar('train', t, 'good')}</span>${Live.text('train', t)}${ts.queue.length > 1 ? `<span class="muted">+${ts.queue.length - 1} more</span>` : ''}</div>` : '<div class="small muted mt">Idle — click to recruit soldiers here.</div>'}</div>`;
    }
    // garrisons
    const gars = Game.territoriesOf(0).filter((t) => Battle.total(s.terr[t].gar) > 0).sort((a, b) => Battle.total(s.terr[b].gar) - Battle.total(s.terr[a].gar));
    h += `<h3 class="sec">🛡️ Garrisons</h3><table class="tbl"><thead><tr><th>Territory</th>${UNIT_ORDER.map((u) => `<th class="num" data-tip="${UNITS[u].name}">${UNITS[u].icon}</th>`).join('')}<th class="num">🧱</th></tr></thead><tbody>
      ${gars.map((t) => `<tr class="click" data-act="focus" data-tid="${t}"><td>${H.tname(t)}</td>${UNIT_ORDER.map((u) => `<td class="num">${s.terr[t].gar[u] || '<span class="muted">·</span>'}</td>`).join('')}<td class="num">${s.terr[t].fort}</td></tr>`).join('')}</tbody></table>`;
    // unit reference
    h += `<h3 class="sec">📖 Units</h3><table class="tbl"><thead><tr><th>Unit</th><th class="num">Atk</th><th class="num">Def</th><th class="num">HP</th><th class="num">Spd</th><th>Cost</th><th class="num">Time</th></tr></thead><tbody>
      ${UNIT_ORDER.map((u) => { const U = UNITS[u]; return `<tr data-tip="<b>${U.name}</b><br>${escapeHtml(U.desc)}<br><span class='muted'>Upkeep ${U.upkeep} gold/day${U.req ? '<br>Needs: ' + Panels.reqText(U.req) : ''}</span>"><td>${U.icon} ${U.name}</td><td class="num">${U.atk}</td><td class="num">${U.def}</td><td class="num">${U.hp}</td><td class="num">${U.speed}</td><td>${H.cost(U.cost)}</td><td class="num">${U.time}d</td></tr>`; }).join('')}
      </tbody></table><div class="small muted mt">Counters: Archers beat Infantry · Infantry beat Cavalry · Cavalry beat Archers & Siege · Knights beat almost everything · Siege engines break walls.</div>`;
    return h;
  },
};
Panels.reqText = function (req) {
  const out = [];
  if (req.barracks) out.push(`Barracks ${req.barracks}`);
  if (req.blacksmith) out.push(`Blacksmith ${req.blacksmith}`);
  if (req.tech) out.push(TECH_BY_ID[req.tech].name);
  return out.join(', ');
};

/* ================= WAR ================= */
Panels.views.war = {
  title: 'War', icon: '⚔️',
  sig() {
    const s = Game.state;
    return [Diplomacy.warsOf(0).join(','), s.battles.length && s.battles[0].id, Math.floor(s.day / 3), s.armies.filter((a) => a.owner !== 0 && a.move).length, Game.territoriesOf(0).length].join('|');
  },
  render() {
    const s = Game.state, c = Game.cache;
    const wars = Diplomacy.warsOf(0);
    let h = `<h3 class="sec">🔥 Active wars</h3>`;
    if (!wars.length) h += `<div class="empty-state"><div class="big">🕊️</div>Your kingdom is at peace with every realm.<br><span class="small">Independent lands can be attacked at any time. To attack a kingdom, declare war in ${H.btn('🤝 Diplomacy', 'openPanel', { p: 'diplomacy' }, { cls: 'small' })}</span></div>`;
    for (const e of wars) {
      const K = Game.k(e), r = Diplomacy.rel(0, e);
      const ws = Diplomacy.warScore(0, e);
      const ev = Diplomacy.evaluate('peace', 0, e);
      const ch = Diplomacy.chanceLabel(ev.score);
      const mine = c.power[0] || 0, theirs = c.power[e] || 0;
      h += `<div class="card kcard" style="--kc:${K.color}">
        <div class="row between"><div><div class="kname">${escapeHtml(K.name)}</div><div class="card-sub">At war for ${H.days(s.day - r.since)}</div></div><span class="chip war">⚔️ WAR</span></div>
        <div class="mt small row between"><span>War score</span><b class="${ws >= 0 ? 'good' : 'bad'}">${ws >= 0 ? 'Winning' : 'Losing'} (${Math.round(ws)})</b></div>
        <div class="relbar mt"><i style="left:${clamp((ws + 60) / 120, 0, 1) * 100}%"></i></div>
        <div class="grid2 mt">
          <div class="stat"><div class="k">Lands taken</div><div class="v"><span class="good">${(r.gain && r.gain[0]) || 0}</span> <small>vs</small> <span class="bad">${(r.gain && r.gain[e]) || 0}</span></div></div>
          <div class="stat"><div class="k">Military power</div><div class="v"><span class="${mine >= theirs ? 'good' : 'bad'}">${fmt(mine)}</span> <small>vs ${fmt(theirs)}</small></div></div>
        </div>
        <div class="row between mt"><span class="small">Peace: <b class="${ch.cls}">${ch.text}</b></span>${H.btn('🕊️ Propose peace', 'propose', { t: 'peace', k: e }, { cls: 'small', tip: Panels.reasonsTip(ev), disabled: !!ev.blocked, why: ev.blocked })}</div>
      </div>`;
    }
    // threats
    const threats = s.armies.filter((a) => a.owner !== 0 && a.move && s.terr[a.move.to].owner === 0 && s.explored[a.move.to]);
    if (threats.length) {
      h += `<h3 class="sec">⚠️ Incoming attacks</h3>`;
      for (const a of threats) h += `<div class="card click" data-act="focusArmy" data-id="${a.id}" style="border-color:rgba(255,107,90,.5)"><div class="row between"><b>${H.kname(a.owner)} · ${escapeHtml(a.name)}</b><span class="bad">${fmt(Battle.total(a.units))} soldiers</span></div><div class="small mt">Marching on <b>${H.tname(a.move.to)}</b> — arrives in ${H.days(a.move.days * (1 - a.move.t))}. Your defenders: ${fmt(Battle.total(Battle.defenders(a.move.to).units))}.</div></div>`;
    }
    // targets
    const targets = new Set();
    for (const t of Game.territoriesOf(0)) for (const a of Game.wt(t).adj) if (s.explored[a.t] && Game.isHostile(0, s.terr[a.t].owner)) targets.add(a.t);
    const list = [...targets].map((t) => ({ t, d: Battle.total(Battle.defenders(t).units) })).sort((a, b) => a.d - b.d).slice(0, 12);
    h += `<h3 class="sec">🎯 Nearby targets</h3>`;
    if (!list.length) h += `<div class="muted small">No hostile territories border your lands. Explore, or declare war on a neighbour.</div>`;
    else h += `<table class="tbl"><thead><tr><th>Territory</th><th>Owner</th><th class="num">Defenders</th><th class="num">🧱</th><th>Terrain</th></tr></thead><tbody>${list.map((x) => `<tr class="click" data-act="focus" data-tid="${x.t}"><td>${H.tname(x.t)}</td><td>${H.kname(s.terr[x.t].owner)}</td><td class="num">${fmt(x.d)}</td><td class="num">${s.terr[x.t].fort}</td><td>${H.terrain(x.t)}</td></tr>`).join('')}</tbody></table>`;
    // battles
    h += `<h3 class="sec">📜 Battle history</h3>`;
    if (!s.battles.length) h += `<div class="muted small">No battles fought yet.</div>`;
    else h += `<table class="tbl"><thead><tr><th>Day</th><th>Battle</th><th>Result</th><th class="num">Losses</th></tr></thead><tbody>${s.battles.map((b) => {
      const mine = b.att === 0;
      const won = mine ? b.win : !b.win;
      return `<tr class="click" data-act="battleReport" data-id="${b.id}"><td>${b.day + 1}</td><td>${mine ? '⚔️' : '🛡️'} ${H.tname(b.tid)} <span class="muted small">vs ${escapeHtml(Game.ownerName(mine ? b.def : b.att))}</span></td><td class="${won ? 'good' : 'bad'}">${won ? 'Victory' : 'Defeat'}</td><td class="num">${fmt(mine ? b.attLoss : b.defLoss)} / <span class="muted">${fmt(mine ? b.defLoss : b.attLoss)}</span></td></tr>`;
    }).join('')}</tbody></table>`;
    return h;
  },
};
Panels.reasonsTip = function (ev) {
  if (ev.blocked) return ev.blocked;
  return `<b>How they see it</b><hr>${ev.reasons.map(([t, v]) => `<div class="tt-row"><span>${escapeHtml(t)}</span><b class="${v >= 0 ? 'good' : 'bad'}">${v >= 0 ? '+' : ''}${v}</b></div>`).join('')}<hr><div class="tt-row"><span>Total (needs ≥ 0)</span><b class="${ev.score >= 0 ? 'good' : 'bad'}">${ev.score}</b></div>`;
};

/* ================= DIPLOMACY ================= */
Panels.views.diplomacy = {
  title: 'Diplomacy', icon: '🤝',
  sig() {
    const s = Game.state;
    return [JSON.stringify(Object.values(s.rel).map((r) => [Math.round(r.v / 3), r.st, r.trade, Math.ceil(r.truce / 10)])), s.offers.length, Math.floor(s.day / 5), s.kingdoms.map((k) => k.alive).join(''), Math.floor(Game.player().res.gold / 150)].join('|');
  },
  render() {
    const s = Game.state, c = Game.cache;
    let h = '';
    if (s.offers.length) {
      h += `<h3 class="sec">✉️ Offers</h3>`;
      for (const o of s.offers) {
        const K = Game.k(o.from);
        h += `<div class="card hl kcard" style="--kc:${K.color}"><div class="row between"><div><b>${escapeHtml(K.name)}</b><div class="card-sub">${o.type === 'peace' ? '🕊️ offers peace' : o.type === 'trade' ? '⚖️ proposes a trade agreement' : '🤝 proposes an alliance'} · expires in ${H.days(o.expires - s.day)}</div></div>
          <div class="row">${H.btn('Accept', 'offerAnswer', { id: o.id, v: 1 }, { cls: 'good small' })}${H.btn('Decline', 'offerAnswer', { id: o.id, v: 0 }, { cls: 'small' })}</div></div></div>`;
      }
    }
    h += `<h3 class="sec">👑 Kingdoms of the world</h3>`;
    const list = s.kingdoms.filter((k) => k.id !== 0).sort((a, b) => b.alive - a.alive);
    for (const K of list) {
      if (!K.alive) { h += `<div class="card kcard" style="--kc:${K.color};opacity:.5"><div class="row between"><div class="kname">${escapeHtml(K.name)}</div><span class="chip">💀 Fallen</span></div></div>`; continue; }
      const r = Diplomacy.rel(0, K.id);
      const lab = Diplomacy.relationLabel(r.v);
      const chips = [];
      chips.push(r.st === 'war' ? '<span class="chip war">⚔️ War</span>' : r.st === 'alliance' ? '<span class="chip ally">🤝 Alliance</span>' : '<span class="chip peace">🕊️ Peace</span>');
      if (r.trade && r.st !== 'war') chips.push('<span class="chip trade">⚖️ Trade</span>');
      if (r.truce > 0) chips.push(`<span class="chip" data-tip="Breaking a truce angers every kingdom.">📜 Truce ${Math.ceil(r.truce)}d</span>`);
      if (!Diplomacy.borders(0, K.id)) chips.push('<span class="chip" data-tip="You share no border.">🧭 Distant</span>');
      const acts = [];
      if (r.st === 'war') {
        const ev = Diplomacy.evaluate('peace', 0, K.id);
        acts.push(H.btn(`🕊️ Peace <span class="${Diplomacy.chanceLabel(ev.score).cls}" style="font-size:11px">(${Diplomacy.chanceLabel(ev.score).text})</span>`, 'propose', { t: 'peace', k: K.id }, { cls: 'small', tip: Panels.reasonsTip(ev), disabled: !!ev.blocked, why: ev.blocked }));
      } else {
        acts.push(H.btn('⚔️ Declare war', 'declareWar', { k: K.id }, { cls: 'small danger' }));
        if (!r.trade) {
          const ev = Diplomacy.evaluate('trade', 0, K.id);
          acts.push(H.btn(`⚖️ Trade <span class="${Diplomacy.chanceLabel(ev.score).cls}" style="font-size:11px">(${ev.blocked ? '—' : Diplomacy.chanceLabel(ev.score).text})</span>`, 'propose', { t: 'trade', k: K.id }, { cls: 'small', tip: Panels.reasonsTip(ev), disabled: !!ev.blocked, why: ev.blocked }));
        } else if (r.st !== 'alliance') acts.push(H.btn('Cancel trade', 'cancelTrade', { k: K.id }, { cls: 'small ghost' }));
        if (r.st !== 'alliance') {
          const ev = Diplomacy.evaluate('alliance', 0, K.id);
          acts.push(H.btn(`🤝 Alliance <span class="${ev.blocked ? 'muted' : Diplomacy.chanceLabel(ev.score).cls}" style="font-size:11px">(${ev.blocked ? '—' : Diplomacy.chanceLabel(ev.score).text})</span>`, 'propose', { t: 'alliance', k: K.id }, { cls: 'small', tip: Panels.reasonsTip(ev), disabled: !!ev.blocked, why: ev.blocked }));
        } else acts.push(H.btn('💔 Break alliance', 'breakAlliance', { k: K.id }, { cls: 'small ghost' }));
      }
      acts.push(H.btn(`🎁 Gift ${GIFT_AMOUNT}💰`, 'gift', { k: K.id }, { cls: 'small', tip: 'Improve relations with a generous gift.', disabled: !Game.canAfford(0, { gold: GIFT_AMOUNT }), why: 'Not enough gold.' }));
      h += `<div class="card kcard" style="--kc:${K.color}">
        <div class="row between wrap"><div><div class="kname">${escapeHtml(K.name)}</div><div class="card-sub">${escapeHtml(K.ruler.name)} · ${K.p.aggression > 0.7 ? 'Warlike' : K.p.diplomacy > 0.7 ? 'Diplomatic' : K.p.expansion > 0.7 ? 'Expansionist' : 'Balanced'}</div></div><div class="row wrap">${chips.join('')}</div></div>
        <div class="row mt small"><span class="muted">Relation</span><div class="grow relbar"><i style="left:${(r.v + 100) / 2}%"></i></div><b class="${lab.cls}" style="min-width:92px;text-align:right">${lab.text} (${Math.round(r.v)})</b></div>
        <div class="grid3 mt" style="grid-template-columns:repeat(4,1fr)">
          <div class="stat"><div class="k">Military</div><div class="v">${fmt(c.power[K.id] || 0)}</div></div>
          <div class="stat"><div class="k">Gold</div><div class="v">${fmt(K.res.gold)}</div></div>
          <div class="stat"><div class="k">Lands</div><div class="v">${Game.territoriesOf(K.id).length}</div></div>
          <div class="stat"><div class="k">People</div><div class="v">${fmt(c.pop[K.id] || 0)}</div></div>
        </div>
        <div class="actions mt">${acts.join('')}</div>
      </div>`;
    }
    h += `<div class="small muted mt">Relations improve with trade, alliances, gifts and common enemies; shared borders and conquests make neighbours wary. Hover a proposal to see how the other side weighs it.</div>`;
    return h;
  },
};

/* ================= TECHNOLOGY ================= */
Panels.views.tech = {
  title: 'Technology', icon: '🔬',
  sig() {
    const k = Game.player();
    return [Object.keys(k.techs).join(','), k.research && k.research.id, TECHS.map((t) => (Tech.info(0, t.id).ok ? 1 : 0)).join(''), Math.floor(k.res.rp / 5)].join('|');
  },
  render() {
    const k = Game.player(), r = Game.cache.rates[0] || { rp: 0 };
    let h = `<div class="grid3">
      <div class="stat"><div class="k">Research points</div><div class="v">📜 ${k.res.rp >= INFINITE_RES ? "∞" : fmt(k.res.rp)}</div></div>
      <div class="stat"><div class="k">Per day</div><div class="v">${fmtRate(r.rp)}</div></div>
      <div class="stat"><div class="k">Researched</div><div class="v">${Tech.count(0)} <small>/ ${TECHS.length}</small></div></div>
    </div>`;
    if (k.research) {
      const T = TECH_BY_ID[k.research.id];
      h += `<div class="card hl mt"><div class="row between"><b>${T.icon} Researching ${T.name}</b><span class="row">${Live.text('research', 0)} ${H.btn('✕', 'cancelResearch', {}, { cls: 'small ghost', tip: 'Cancel (50% refund)' })}</span></div><div class="mt">${Live.bar('research', 0)}</div></div>`;
    } else h += `<div class="card mt"><span class="muted small">Your scholars are idle. Choose a technology below. Build an Academy for more research points.</span></div>`;
    h += `<div class="tree mt2">`;
    for (const cat of TECH_CATS) {
      const list = TECHS.filter((t) => t.cat === cat.id).sort((a, b) => a.tier - b.tier);
      h += `<div class="tcol"><div class="tcol-head">${cat.icon} ${cat.name}</div>`;
      list.forEach((T, i) => {
        const inf = Tech.info(0, T.id);
        const st = inf.st;
        if (i > 0) h += `<div class="tlink ${Tech.status(0, list[i - 1].id) === 'done' ? 'on' : ''}"></div>`;
        const tag = st === 'done' ? '<span class="tag gold-t">✓ Researched</span>' : st === 'researching' ? '<span class="tag" style="color:var(--info)">⏳ In progress</span>' : st === 'locked' ? '<span class="tag muted">🔒 Locked</span>' : '<span class="tag good">Available</span>';
        h += `<div class="tnode ${st}"><div class="th"><span class="ti">${T.icon}</span><div class="grow"><div class="tn">${T.name}</div>${tag}</div></div>
          <div class="td">${T.desc}</div>
          ${st === 'done' ? '' : st === 'researching' ? `<div>${Live.bar('research', 0)}</div>` : `<div class="row between wrap" style="gap:6px">${H.cost(inf.cost)}<span class="small muted">⏱ ${T.time}d</span></div>${H.btn('Research', 'research', { id: T.id }, { cls: 'small block ' + (inf.ok ? 'primary' : ''), disabled: !inf.ok, why: inf.reason })}`}
        </div>`;
      });
      h += `</div>`;
    }
    h += `</div>`;
    return h;
  },
};

/* ================= MISSIONS ================= */
Panels.views.missions = {
  title: 'Missions', icon: '🎯',
  sig() {
    const s = Game.state;
    const P = Missions.context();
    return [JSON.stringify(s.missions), MISSIONS.map((m) => Math.floor(Missions.progress(m, P).pct * 20)).join('')].join('|');
  },
  render() {
    const s = Game.state;
    const P = Missions.context();
    const done = MISSIONS.filter((m) => s.missions[m.id] === 2).length;
    const order = MISSIONS.slice().sort((a, b) => {
      const sa = s.missions[a.id], sb = s.missions[b.id];
      const rank = (x) => (x === 1 ? 0 : x === 0 ? 1 : 2);
      return rank(sa) - rank(sb) || Missions.progress(b, P).pct - Missions.progress(a, P).pct;
    });
    let h = `<div class="row between"><span class="muted">Complete objectives to earn rewards and experience for your ruler.</span><span class="chip gold">🏆 ${done} / ${MISSIONS.length}</span></div><div class="mt">`;
    for (const m of order) {
      const st = s.missions[m.id];
      const p = Missions.progress(m, P);
      const reward = Object.entries(m.reward).map(([k, v]) => `<span>${RES_ICON[k]} ${fmt(v)}</span>`).join('') + `<span>⭐ ${m.xp} XP</span>`;
      h += `<div class="card mission ${st === 1 ? 'done hl' : st === 2 ? 'claimed' : ''}">
        <div class="mi">${m.icon}</div>
        <div class="grow"><div class="row between"><div class="card-title">${m.name}</div>${st === 2 ? '<span class="chip gold">✓ Claimed</span>' : ''}</div>
          <div class="card-sub">${m.desc}</div>
          ${st === 0 ? `<div class="row small mt"><span class="grow">${H.bar(p.pct, '')}</span><span class="muted">${fmt(p.cur)} / ${fmt(p.target)}</span></div>` : ''}
          <div class="row between mt"><span class="cost">${reward}</span>${st === 1 ? H.btn('🎁 Claim', 'claimMission', { id: m.id }, { cls: 'primary small' }) : ''}</div>
        </div></div>`;
    }
    h += `</div>`;
    return h;
  },
};

/* ================= panel actions ================= */
UI.act('rulerPoint', (d) => UI.result(Kingdom.spendPoint(0, d.s), 'coin'));
UI.act('build', (d, el) => {
  const ok = UI.result(Kingdom.build(0, +d.tid, d.b), 'build');
  if (ok) MapView.sparkle(+d.tid, '#9fd3ff');
});
UI.act('taxAll', (d) => UI.result(Kingdom.setTaxAll(0, +d.v)));
UI.act('raiseArmy', () => Screens.compose({ mode: 'create' }));
UI.act('compose', (d) => Screens.compose({ mode: d.mode, id: +d.id, tid: d.tid !== undefined ? +d.tid : undefined }));
UI.act('hireGeneral', (d) => UI.result(Army.hireGeneral(0, +d.id), 'fanfare'));
UI.act('stopArmy', (d) => UI.result(Army.stop(0, +d.id)));
UI.act('disbandArmy', (d) => {
  const a = Army.byId(+d.id);
  if (!a) return;
  UI.confirm({ title: 'Disband army?', text: `${escapeHtml(a.name)} will join the garrison of ${H.tname(a.loc)}. Its general (if any) will retire.`, ok: 'Disband', onOk: () => { UI.result(Army.disband(0, a.id)); MapView.select(null); } });
});
UI.act('recruitAt', (d) => {
  const t = +d.tid;
  MapView.focusTerritory(t);
  MapView.select({ type: 'terr', id: t });
  Context.tab = 'military';
  Context.refresh(true);
});
UI.act('propose', (d) => {
  const r = Diplomacy.propose(d.t, 0, +d.k);
  UI.result(r, d.t === 'peace' ? 'fanfare' : 'coin');
});
UI.act('declareWar', (d) => {
  const K = Game.k(+d.k), r = Diplomacy.rel(0, +d.k);
  const allies = Diplomacy.alliesOf(+d.k).filter((a) => a !== 0).map((a) => Game.k(a).short);
  let text = `Declare war on the <b>${escapeHtml(K.name)}</b>? Their military power is <b>${fmt(Game.cache.power[K.id] || 0)}</b> (yours: ${fmt(Game.cache.power[0] || 0)}).`;
  if (allies.length) text += `<br><br>⚠️ Their allies will join the war: <b>${allies.map(escapeHtml).join(', ')}</b>.`;
  if (r.truce > 0) text += `<br><br>⚠️ You signed a truce ${Math.round(90 - r.truce)} days ago. Breaking it will anger <b>every</b> kingdom.`;
  if (r.trade) text += `<br><br>Your trade agreement will end.`;
  UI.confirm({ title: 'Declare war?', icon: '⚔️', text, ok: '⚔️ Declare war', danger: true, onOk: () => UI.result(Diplomacy.declareWar(0, K.id), 'war') });
});
UI.act('cancelTrade', (d) => UI.result(Diplomacy.setTrade(0, +d.k, false)));
UI.act('breakAlliance', (d) => UI.confirm({ title: 'Break alliance?', text: 'Your former ally will be deeply offended (−30 relations).', ok: 'Break alliance', danger: true, onOk: () => UI.result(Diplomacy.breakAlliance(0, +d.k)) }));
UI.act('gift', (d) => UI.result(Diplomacy.gift(0, +d.k), 'coin'));
UI.act('research', (d) => UI.result(Tech.start(0, d.id), 'notify'));
UI.act('cancelResearch', () => UI.confirm({ title: 'Cancel research?', text: 'You get half of the cost back.', ok: 'Cancel research', danger: true, onOk: () => UI.result(Tech.cancel(0)) }));
