/* =====================================================================
   UI — HUD, dock, panels (Build, Inventory, Quests, Village, Shop,
   Settings), cards, toasts, popups, prompts, level-up, minimap.
   ===================================================================== */
const UI = {
  current: null, hudT: 0, dirty: true, popPool: [], pops: [], shopTab: 'cart', buildTab: 'housing', questTab: 'quests', villageTab: 'overview', card: null, lastProducePop: new Map(),
  init() {
    $$('#dock button').forEach((b) => b.addEventListener('click', () => { Audio.unlock(); this.toggle(b.dataset.open); }));
    $('#btn-settings').addEventListener('click', () => this.toggle('settings'));
    document.addEventListener('click', (e) => {
      const c = e.target.closest('[data-close]'); if (c) { this.closePanels(); this.closeCard(); Audio.sfx('close'); }
    });
    $('#btn-act').addEventListener('pointerdown', (e) => { e.preventDefault(); Audio.unlock(); if (BuildCtl.active) BuildCtl.confirm(); else Interact.press(); });
    $('#btn-act').addEventListener('pointerup', () => Interact.release());
    $('#btn-jump').addEventListener('pointerdown', (e) => { e.preventDefault(); Input.keys.add(' '); setTimeout(() => Input.keys.delete(' '), 120); });
    $('#pb-rot').addEventListener('click', () => BuildCtl.rotate());
    $('#pb-ok').addEventListener('click', () => (ZoneCtl.active ? ZoneCtl.finish() : BuildCtl.confirm()));
    $('#pb-cancel').addEventListener('click', () => (ZoneCtl.active ? ZoneCtl.cancel() : BuildCtl.cancel()));
    $('#minimap').addEventListener('click', () => this.open('village', 'land'));
    $$('#speed button').forEach((b) => b.addEventListener('click', () => Game.setSpeed(+b.dataset.speed)));
    $('#paused').addEventListener('click', () => Game.togglePause());
    this.bindBus();
    Minimap.init();
  },
  bindBus() {
    Bus.on('res', (d) => {
      this.dirty = true;
      if (d.pos && d.n > 0) {
        const far = Math.hypot(d.pos.x - Player.x, d.pos.z - Player.z) > 45;
        if (d.src === 'produce' || d.src === 'shop') { if (far) return; const k = Math.round(d.pos.x) + ':' + Math.round(d.pos.z) + d.k; if (now() - (this.lastProducePop.get(k) || 0) < 3) return; this.lastProducePop.set(k, now()); }
        this.popup(d.pos, `+${fmt(d.n)} ${ITEMS[d.k].icon}`, d.k === 'coins' ? 'coin' : '');
        if (d.k === 'coins' && !far) Audio.sfx('coin');
      }
    });
    Bus.on('xp', (d) => { this.dirty = true; if (d.pos) this.popup(d.pos, `+${d.n} XP`, 'xp'); });
    Bus.on('toast', (d) => this.toast(d));
    Bus.on('levelup', (d) => this.levelUp(d));
    Bus.on('zones', () => { ZoneRender.rebuild(); this.refreshOpen(); });
    Bus.on('building:done', ({ b }) => {
      BuildRender.anims.push({ b, t: 0.45 });
      if (Math.hypot(b.x - Player.x, b.z - Player.z) < 60) { Audio.sfx('build'); FX.sparkle(new THREE.Vector3(b.x, b.y + Models.get(b.type).height * 0.7, b.z), 22); }
      this.toast({ icon: '🏗️', title: BUILDINGS[b.type].name + ' finished!', text: 'Your villagers built it in a build zone.' });
      this.refreshOpen();
    });
    Bus.on('zone:site', ({ z, b }) => { if (now() - (this._siteT || 0) > 6) { this._siteT = now(); this.toast({ icon: ZONE_KINDS[z.kind].icon, title: 'Construction started', text: `Villagers are building a ${BUILDINGS[b.type].name} in your ${ZONE_KINDS[z.kind].name} zone.` }); } });
    Bus.on('building:placed', ({ b, cleared }) => {
      if (b.build > 0) {
        BuildRender.add(b, false);
        FX.dust(new THREE.Vector3(b.x, b.y + 0.3, b.z), 10);
        Decor.refreshHidden(BuildRender.rects(), BuildingService.rect(b.type, b.x, b.z, b.rot));
        this.refreshOpen();
        return;
      }
      BuildRender.add(b, true);
      const r = BuildingService.rect(b.type, b.x, b.z, b.rot);
      for (const [x, z] of [[r.x0, r.z0], [r.x1, r.z0], [r.x0, r.z1], [r.x1, r.z1], [b.x, b.z]]) FX.dust(new THREE.Vector3(x, b.y + 0.3, z), BUILDINGS[b.type].road ? 3 : 8);
      if (!BUILDINGS[b.type].road) { Audio.sfx('build'); CameraCtl.shake(0.3, 0.35); setTimeout(() => FX.sparkle(new THREE.Vector3(b.x, b.y + Models.get(b.type).height * 0.7, b.z), 18), 900); }
      else Audio.sfx('place');
      Decor.refreshHidden(BuildRender.rects(), BuildingService.rect(b.type, b.x, b.z, b.rot));
      if (cleared && Object.keys(cleared).length) this.toast({ icon: '🌳', title: 'Land cleared', text: this.costText(cleared) });
      this.refreshOpen();
    });
    Bus.on('building:removed', ({ b }) => { BuildRender.remove(b); FX.dust(new THREE.Vector3(b.x, b.y + 1, b.z), 20); Audio.sfx('place'); Decor.refreshHidden(BuildRender.rects(), BuildingService.rect(b.type, b.x, b.z, b.rot)); SelRing.show(null); this.refreshOpen(); });
    Bus.on('building:moved', ({ b }) => { BuildRender.move(b); FX.dust(new THREE.Vector3(b.x, b.y + 0.5, b.z), 12); Decor.refreshHidden(BuildRender.rects()); SelRing.show(null); });
    Bus.on('area', ({ id }) => {
      const a = AREA_BY_ID[id];
      Barriers.dissolve(id);
      const from = U.uLocked.value[a.idx];
      Tweens.add(2.4, (t) => { U.uLocked.value[a.idx] = from * (1 - t); }, null, Ease.inOut);
      Audio.sfx('unlock'); CameraCtl.shake(0.35, 0.6);
      FX.confetti(Player.pos(), 50);
      this.banner({ icon: '🗺️', title: a.name + ' unlocked!', text: a.desc, cls: 'unlock' }, 5);
      this.closePanels(); this.refreshOpen();
    });
    Bus.on('discover', ({ id }) => { const a = AREA_BY_ID[id]; this.toast({ icon: '🧭', title: 'Discovered: ' + a.name, text: a.desc }); Audio.sfx('quest'); });
    Bus.on('candidate', ({ name }) => { this.toast({ cls: 'cand', icon: '👋', title: 'New Resident Available!', text: `${name} is waiting at the quest board. Go say hello!`, action: { label: 'Welcome', fn: () => { const r = Remote.invoke('Welcome'); if (!r.ok) this.toast({ icon: '🏠', title: 'No room', text: r.err }); } } }); Audio.sfx('resident'); this.dirty = true; });
    Bus.on('npc:welcomed', ({ npc, home }) => { $$('.toast.cand').forEach((t) => t.remove()); this.toast({ icon: '🏡', title: npc.name + ' moved in!', text: `Their home: ${BUILDINGS[home.type].name}. ${npc.work ? 'Job: ' + PROFS[npc.prof].name + '.' : 'Build a workplace to give them a job.'}` }); Audio.sfx('resident'); const r = NPCService.rt.get(npc.id); if (r) FX.confetti(new THREE.Vector3(r.ent.x, r.ent.y + 1.5, r.ent.z), 30); this.dirty = true; });
    Bus.on('npc:job', ({ npc, b }) => { if (now() - (this._jobToast || 0) > 4) { this._jobToast = now(); this.toast({ icon: PROFS[npc.prof].icon, title: npc.name.split(' ')[0] + ' found work', text: `Now a ${PROFS[npc.prof].name} at the ${BUILDINGS[b.type].name}.` }); } });
    Bus.on('npc:request', ({ npc }) => this.toast({ icon: '❗', title: npc.name.split(' ')[0] + ' needs help', text: `Looking for ${npc.req.n} ${ITEMS[npc.req.k].name.toLowerCase()}. Find the villager with the ❗.` }));
    Bus.on('quest:ready', (q) => { this.toast({ icon: '✅', title: 'Quest complete!', text: q.title + ' — claim your reward.', cls: 'good' }); Audio.sfx('quest'); this.dirty = true; });
    Bus.on('quest:claimed', (q) => { Audio.sfx('coin'); FX.sparkle(Player.pos(), 14); this.refreshOpen(); this.dirty = true; });
    Bus.on('quests', () => { this.trackerDirty = true; });
    Bus.on('achievement', (a) => { this.toast({ icon: a.icon, title: 'Achievement: ' + a.name, text: a.desc + ' · ' + this.costText(a.reward), cls: 'ach' }); Audio.sfx('fanfare'); });
    Bus.on('newday', (d) => { this.toast({ icon: '🌅', title: 'Good morning! Day ' + d.day, text: `${d.taxes ? 'Taxes collected: +' + d.taxes + ' 🪙 · ' : ''}${d.benefit && d.benefit.paid ? 'Benefits paid: −' + d.benefit.paid + ' 🪙 to ' + d.benefit.people + ' jobless · ' : ''}+${d.xp} XP` }); if (d.benefit && d.benefit.short) this.toast({ icon: '⚠️', title: 'Treasury ran short', text: 'Jobless villagers got less than planned today.' }); Audio.sfx('bell'); this.refreshOpen(); });
    Bus.on('event:start', (ev) => { this.banner({ icon: ev.cfg.icon, title: ev.cfg.name, text: ev.cfg.desc, ev: true }); Audio.sfx(ev.id === 'wolves' ? 'wolf' : ev.id === 'festival' || ev.id === 'harvest' ? 'fanfare' : 'bell'); });
    Bus.on('event:end', (ev) => { this.hideBanner(); this.toast({ icon: ev.cfg.icon, title: ev.cfg.name + ' is over', text: ev.id === 'wolves' ? 'The wolves are gone.' : ev.id === 'fire' && ev.done ? 'Crisis averted.' : 'Back to village life.' }); });
    Bus.on('look', () => { Player.refreshLook(); this.refreshOpen(); });
    Bus.on('saved', (d) => { const s = $('#saved'); s.textContent = d.ok ? 'Saved' : 'Save failed'; s.classList.add('on'); clearTimeout(this._st); this._st = setTimeout(() => s.classList.remove('on'), 1400); });
  },
  onKey(k, e) {
    if (Game.state !== 'play') return;
    if (k === 'escape') { if (ZoneCtl.active) ZoneCtl.cancel(); else if (BuildCtl.active) BuildCtl.cancel(); else if ($('#dialog:not([hidden])')) this.closeDialog(); else { this.closePanels(); this.closeCard(); } return; }
    if (k === 'e' && !e.repeat) { if (BuildCtl.active) return; Interact.press(); return; }
    if (k === 'r' && BuildCtl.active) return BuildCtl.rotate();
    if (k === 'q' && BuildCtl.active) return BuildCtl.rotate();
    if (k === 'p') return Game.togglePause();
    if (['1', '2', '3', '4'].includes(k)) return Game.setSpeed(+k);
    const map = { b: 'build', i: 'inventory', j: 'quests', v: 'village', t: 'shop', m: 'village' };
    if (map[k]) { this.toggle(map[k], k === 'm' ? 'land' : null); }
  },
  /* ---------- panels ---------- */
  toggle(name, tab) { if (this.current === name && !tab) this.closePanels(); else this.open(name, tab); },
  open(name, tab) {
    if (BuildCtl.active && name !== 'build') BuildCtl.cancel();
    if (ZoneCtl.active) ZoneCtl.cancel();
    this.closeCard();
    $$('.panel').forEach((p) => { p.hidden = p.id !== 'panel-' + name; });
    $$('#dock button').forEach((b) => b.classList.toggle('on', b.dataset.open === name));
    this.current = name;
    if (name === 'village' && tab) this.villageTab = tab;
    if (name === 'quests' && tab) this.questTab = tab;
    if (name === 'shop' && tab) this.shopTab = tab;
    this.render(name);
    Audio.sfx('open');
  },
  closePanels() { $$('.panel').forEach((p) => { p.hidden = true; }); $$('#dock button').forEach((b) => b.classList.remove('on')); this.current = null; },
  refreshOpen() { if (this.current) this.render(this.current); if (this.card) this.card.refresh(); },
  render(name) {
    const el = $('#panel-' + name + ' .pbody');
    if (!el) return;
    if (name === 'build') el.innerHTML = this.buildHtml();
    if (name === 'inventory') el.innerHTML = this.invHtml();
    if (name === 'quests') el.innerHTML = this.questsHtml();
    if (name === 'village') el.innerHTML = this.villageHtml();
    if (name === 'shop') el.innerHTML = this.shopHtml();
    if (name === 'settings') el.innerHTML = this.settingsHtml();
    this.wire(el, name);
  },
  wire(el, name) {
    $$('[data-tab]', el).forEach((t) => t.addEventListener('click', () => {
      const v = t.dataset.tab;
      if (name === 'build') this.buildTab = v; if (name === 'quests') this.questTab = v; if (name === 'village') this.villageTab = v; if (name === 'shop') this.shopTab = v;
      Audio.sfx('tick'); this.render(name);
    }));
    if (name === 'build') {
      $$('.bcard', el).forEach((c) => {
        c.addEventListener('click', () => BuildCtl.start(c.dataset.type));
        c.addEventListener('pointerenter', () => { const d = $('#bdetail', el); if (d) d.innerHTML = this.buildDetail(c.dataset.type); });
      });
      Thumbs.fill(el);
      $$('[data-zone-new]', el).forEach((b) => b.addEventListener('click', () => ZoneCtl.start(b.dataset.zoneNew)));
      $$('[data-zone-pick]', el).forEach((s) => s.addEventListener('change', () => { const r = Remote.invoke('SetZonePick', { id: +s.dataset.zonePick, type: s.value || null }); if (!r.ok) this.toast({ icon: '🏗️', title: 'Zone', text: r.err }); Audio.sfx('tick'); }));
      $$('[data-zone-toggle]', el).forEach((b) => b.addEventListener('click', () => { Remote.invoke('ToggleZone', { id: +b.dataset.zoneToggle }); Audio.sfx('tick'); }));
      $$('[data-zone-del]', el).forEach((b) => b.addEventListener('click', () => this.confirm('Remove this zone?', 'Buildings already built stay. Villagers stop building here.', 'Remove', () => { Remote.invoke('RemoveZone', { id: +b.dataset.zoneDel }); }, true)));
    }
    $$('[data-claim]', el).forEach((b) => b.addEventListener('click', () => { const r = Remote.invoke('ClaimQuest', { id: b.dataset.claim }); if (!r.ok) this.toast({ icon: '📜', title: 'Quest', text: r.err }); else this.popupScreen(b, '+' + this.costText(r.q.reward)); }));
    $$('[data-trade]', el).forEach((b) => b.addEventListener('click', () => {
      const [dir, item, q] = b.dataset.trade.split(':');
      const qty = q === 'all' ? Math.floor(S.res[item]) : +q;
      if (qty < 1) return;
      const r = Remote.invoke('Trade', { shop: this.shopTab, item, qty, dir });
      if (!r.ok) { if (!r.silent) { this.toast({ icon: '🛒', title: 'Trade', text: r.err }); Audio.sfx('error'); } return; }
      Audio.sfx('coin'); this.popupScreen(b, dir === 'sell' ? `+${r.total} 🪙` : `-${r.total} 🪙`); this.render('shop');
    }));
    $$('[data-deal]', el).forEach((b) => b.addEventListener('click', () => { const r = Remote.invoke('MerchantDeal', { i: +b.dataset.deal }); if (!r.ok) { this.toast({ icon: '🧳', title: 'Merchant', text: r.err }); Audio.sfx('error'); } else { Audio.sfx('coin'); this.render('shop'); } }));
    $$('[data-upgrade]', el).forEach((b) => b.addEventListener('click', () => { const r = Remote.invoke('UpgradeTool'); if (!r.ok) { this.toast({ icon: '🛠️', title: 'Upgrade', text: r.err }); Audio.sfx('error'); } else { Audio.sfx('levelup'); this.refreshOpen(); } }));
    $$('[data-equip]', el).forEach((b) => b.addEventListener('click', () => { Remote.invoke('Equip', { id: b.dataset.equip }); Audio.sfx('click'); }));
    $$('[data-buyarea]', el).forEach((b) => b.addEventListener('click', () => this.areaDialog(b.dataset.buyarea)));
    $$('[data-welcome]', el).forEach((b) => b.addEventListener('click', () => { const r = Remote.invoke('Welcome'); if (!r.ok) this.toast({ icon: '🏠', title: 'No room yet', text: r.err }); this.refreshOpen(); }));
    $$('[data-npc]', el).forEach((b) => b.addEventListener('click', () => { const n = S.npcs.find((q) => q.id === +b.dataset.npc); if (n) { this.closePanels(); this.npcCard(n); } }));
    if (name === 'settings') this.wireSettings(el);
    if (name === 'village' && this.villageTab === 'policies') this.wirePolicies(el);
  },
  /* ---------- helpers ---------- */
  costText(c) { return Object.entries(c).filter(([k]) => k !== 'cos').map(([k, v]) => (k === 'xp' ? `${v} XP` : `${fmt(v)} ${ITEMS[k] ? ITEMS[k].icon : ''}`)).join(' · ') + (c.cos ? ` · 🎁 ${COSMETICS[c.cos].name}` : ''); },
  costHtml(c, check = true) {
    return Object.entries(c).map(([k, v]) => {
      if (k === 'xp') return `<span class="chip xp">${v} XP</span>`;
      if (k === 'cos') return `<span class="chip gift">🎁 ${esc(COSMETICS[v].name)}</span>`;
      const lack = check && Economy.amount(k) < v;
      return `<span class="chip${lack ? ' lack' : ''}" title="${ITEMS[k].name}">${ITEMS[k].icon} ${fmt(v)}</span>`;
    }).join('');
  },
  tabs(list, cur) { return `<div class="tabs" role="tablist">${list.map(([id, label]) => `<button role="tab" data-tab="${id}" class="${id === cur ? 'on' : ''}" aria-selected="${id === cur}">${label}</button>`).join('')}</div>`; },
  bar(p, cls = '') { return `<div class="bar ${cls}"><i style="width:${clamp(p, 0, 1) * 100}%"></i></div>`; },
  /* ---------- BUILD ---------- */
  buildHtml() {
    const cats = BUILD_CATS.map((c) => [c.id, `${c.icon} ${c.name}`]).concat([['zones', '🏗️ Zones']]);
    if (this.buildTab === 'zones') return this.tabs(cats, 'zones') + this.zonesHtml();
    const list = Object.values(BUILDINGS).filter((b) => b.cat === this.buildTab && !b.hidden).sort((a, b) => a.level - b.level);
    const cards = list.map((b) => {
      const locked = S.level < b.level;
      const can = BuildingService.canBuild(b.id);
      const owned = BuildingService.count(b.id);
      return `<button class="bcard${locked ? ' locked' : ''}${!locked && !can.ok ? ' cant' : ''}" data-type="${b.id}" ${locked ? 'disabled' : ''}>
        <div class="thumb" data-thumb="${b.id}"></div>
        <b>${esc(b.name)}</b>
        ${locked ? `<div class="lock">🔒 Level ${b.level}</div>` : `<div class="costs">${this.costHtml(b.cost)}</div>`}
        ${owned ? `<span class="owned">×${owned}</span>` : ''}
      </button>`;
    }).join('');
    return `${this.tabs(cats, this.buildTab)}<div class="bgrid">${cards}</div><div class="bdetail" id="bdetail">${this.buildDetail(list.find((b) => S.level >= b.level)?.id || list[0].id)}</div>`;
  },
  zonesHtml() {
    const kinds = Object.entries(ZONE_KINDS).map(([id, k]) => `<button class="zkind" data-zone-new="${id}" style="--zc:#${k.col.toString(16).padStart(6, '0')}"><span class="ic">${k.icon}</span><b>${k.name}</b><small>${esc(k.desc)}</small></button>`).join('');
    const list = S.zones.map((z) => {
      const K = ZONE_KINDS[z.kind], site = S.buildings.find((b) => b.zone === z.id && b.build > 0);
      const st = site ? `Building a ${BUILDINGS[site.type].name} · ${Math.round((1 - site.build / (site.buildT || 1)) * 100)}%` : ZoneService.status[z.id] || (z.paused ? 'Paused' : 'Planning…');
      return `<div class="zrow"><span class="zdot" style="background:#${K.col.toString(16).padStart(6, '0')}">${K.icon}</span><div class="grow"><b>${K.name} zone</b><small>${Math.round(z.x1 - z.x0)} × ${Math.round(z.z1 - z.z0)} · ${z.built || 0} built</small><small class="muted">${esc(st)}</small><label class="zpick"><span>Build:</span><select data-zone-pick="${z.id}" aria-label="What to build in this zone"><option value="">Villagers choose</option>${ZoneService.options(z.kind).map((b) => `<option value="${b.id}" ${z.pick === b.id ? 'selected' : ''} ${S.level < b.level ? 'disabled' : ''}>${esc(b.name)}${S.level < b.level ? ' (level ' + b.level + ')' : b.house ? ' · ' + b.house + ' residents' : ''}</option>`).join('')}</select></label></div><button class="btn sm alt" data-zone-toggle="${z.id}">${z.paused ? 'Resume' : 'Pause'}</button><button class="btn sm danger" data-zone-del="${z.id}">Remove</button></div>`;
    }).join('');
    return `<p class="muted">Mark an area and your villagers build there by themselves, paid from your storage. They always keep a reserve: they never spend the last 20% of a resource or your last 100 coins. Builders from a Workshop help all day; other villagers help in their free time. Two sites can be under construction at once.</p>
      <div class="zkinds">${kinds}</div>
      <h3>Your zones ${S.zones.length}/12</h3>${list ? `<div class="zlist">${list}</div>` : '<p class="empty">No zones yet. Pick a kind above and draw it on the ground.</p>'}`;
  },
  zoneBar(show, kind) {
    const b = $('#placebar'); b.hidden = !show; $('#dock').hidden = show; document.body.classList.toggle('placing', show);
    $('#pb-rot').hidden = show;
    if (!show) { $('#pb-ok').innerHTML = '✓ <span class="lb">Build</span>'; return; }
    const K = ZONE_KINDS[kind];
    $('#pb-name').textContent = `${K.icon} New ${K.name} zone`;
    $('#pb-cost').innerHTML = '<span class="chip">Villagers pay from storage</span>';
    $('#pb-ok').innerHTML = '✓ <span class="lb">Mark zone</span>';
    ZoneCtl.refresh();
  },
  zoneStatus(text, ok) { const s = $('#pb-status'); s.textContent = text; s.className = ok ? 'ok' : 'bad'; $('#pb-ok').disabled = !(ok && ZoneCtl.rect()); },
  buildDetail(type) {
    const b = BUILDINGS[type];
    const eff = [];
    if (b.house) eff.push(`🏠 Homes ${b.house} residents`);
    if (b.jobs) eff.push(`${PROFS[b.jobs.prof].icon} ${b.jobs.n} ${PROFS[b.jobs.prof].name}${b.jobs.n > 1 ? 's' : ''}`);
    if (b.produce) eff.push(`⚙️ ${b.consume ? this.costText(b.consume) + ' → ' : ''}${this.costText(b.produce)} per worker / 5s`);
    if (b.storage) eff.push(`📦 +${b.storage} storage`);
    if (b.happy) for (const [k, v] of Object.entries(b.happy)) eff.push(`😊 +${v} ${{ decor: 'decoration', ent: 'entertainment', safety: 'safety', service: 'services', shops: 'shops', food: 'food' }[k]}`);
    if (b.shop) eff.push(`🛒 Opens the ${SHOPS[b.shop].name} shop`);
    const why = BuildingService.canBuild(type);
    return `<div class="bd-h"><b>${esc(b.name)}</b><small>${b.size[0]}×${b.size[1]} · Level ${b.level}${b.unique ? ' · one per village' : ''}</small></div><p>${esc(b.desc)}</p><div class="effs">${eff.map((e) => `<span>${e}</span>`).join('')}</div>${!why.ok ? `<p class="warn">${esc(why.err)}</p>` : ''}`;
  },
  /* ---------- INVENTORY ---------- */
  invHtml() {
    const res = RES_KEYS.filter((k) => S.level >= ITEMS[k].level || S.res[k] > 0).map((k) => {
      const cap = Economy.cap(k);
      return `<div class="slot"><span class="ic">${ITEMS[k].icon}</span><div><b>${ITEMS[k].name}</b><small>${fmt(S.res[k])} / ${fmt(cap)}</small>${this.bar(S.res[k] / cap, S.res[k] >= cap ? 'full' : '')}</div></div>`;
    }).join('');
    const tier = TOOL_TIERS[S.inv.tool], next = TOOL_TIERS[S.inv.tool + 1];
    const cos = Object.entries(COSMETICS).map(([id, c]) => {
      const own = S.inv.cos.includes(id), on = S.inv[c.slot] === id;
      return `<button class="cos${own ? '' : ' locked'}${on ? ' on' : ''}" ${own ? `data-equip="${id}"` : 'disabled'} title="${esc(c.name)}"><span class="sw" style="background:#${c.col.toString(16).padStart(6, '0')}">${c.slot === 'hat' ? '🎩' : '👕'}</span><small>${own ? esc(c.name) : '???'}</small></button>`;
    }).join('');
    return `<h3>Resources</h3><div class="slots">${res}<div class="slot"><span class="ic">🪙</span><div><b>Coins</b><small>${fmt(S.coins)}</small></div></div></div>
      <h3>Tools</h3><div class="toolcard"><span class="ic">🛠️</span><div><b>${tier.name}</b><small>${tier.mult}× resources per swing${next ? ` · Next: ${next.name} (level ${next.level}) at the Blacksmith` : ' · The best tools in the land'}</small></div></div>
      <h3>Wardrobe</h3><div class="cosgrid">${cos}</div>
      <h3>Records</h3><div class="stats"><span>🪵 ${fmt(S.stats.gathered.wood || 0)} wood gathered</span><span>🪨 ${fmt(S.stats.gathered.stone || 0)} stone gathered</span><span>🏗️ ${S.stats.built} built</span><span>🤝 ${S.stats.helped} helped</span><span>💎 ${S.stats.chests}/${CHESTS.length} chests</span><span>⏱️ ${fmtDur(S.playTime)} played</span></div>`;
  },
  /* ---------- QUESTS ---------- */
  questsHtml() {
    const tabs = this.tabs([['quests', '📜 Quests'], ['ach', `🏆 Achievements ${Object.keys(S.ach).length}/${ACHIEVEMENTS.length}`]], this.questTab);
    if (this.questTab === 'ach') {
      return tabs + `<div class="achgrid">${ACHIEVEMENTS.map((a) => `<div class="ach${S.ach[a.id] ? ' got' : ''}"><span class="ic">${a.icon}</span><b>${esc(a.name)}</b><small>${esc(a.desc)}</small><span class="rw">${this.costText(a.reward)}</span></div>`).join('')}</div>`;
    }
    const qs = QuestService.list().map((q) => `<div class="quest${q.main ? ' main' : ''}${q.done ? ' done' : ''}">
      <div class="q-h"><span class="tag">${q.main ? 'Story' : 'Daily'}</span><b>${esc(q.title)}</b></div>
      ${q.hint ? `<small>${esc(q.hint)}</small>` : ''}
      <div class="q-p">${this.bar(q.p / q.n, q.done ? 'good' : '')}<span>${fmt(q.p)} / ${fmt(q.n)}</span></div>
      <div class="q-f"><div class="costs">${this.costHtml(q.reward, false)}</div>${q.done ? `<button class="btn good" data-claim="${q.id}">Claim</button>` : ''}</div>
    </div>`).join('');
    return tabs + `<div class="qlist">${qs}</div><p class="muted small">Story quests guide you from a hamlet to a Grand City. Daily quests refresh when you claim them.</p>`;
  },
  /* ---------- VILLAGE ---------- */
  villageHtml() {
    const tabs = this.tabs([['overview', '🏘️ Overview'], ['residents', `👥 Residents ${Village.population()}`], ['land', '🗺️ Land'], ['policies', '📋 Policies']], this.villageTab);
    if (this.villageTab === 'policies') return tabs + this.policiesHtml();
    if (this.villageTab === 'residents') {
      const rows = S.npcs.map((n) => {
        const home = BuildingService.byId(n.home), work = BuildingService.byId(n.work);
        return `<button class="row" data-npc="${n.id}"><span class="ic">${PROFS[n.prof].icon}</span><div class="grow"><b>${esc(n.name)}${n.req ? ' <span class="chip lack">❗ needs help</span>' : ''}</b><small>${PROFS[n.prof].name}${work ? ' · ' + BUILDINGS[work.type].name : ' · no job'} · ${home ? BUILDINGS[home.type].name : 'homeless'}</small><small class="muted">${esc(NPCService.activityOf(n))}</small></div><div class="mini"><span title="Happiness">${n.happy > 66 ? '😊' : n.happy > 33 ? '😐' : '😟'} ${Math.round(n.happy)}%</span><span title="Hunger">🍽️ ${Math.round(100 - n.hunger)}%</span><span title="Money">🪙 ${fmt(n.money)}</span></div></button>`;
      }).join('');
      return tabs + (S.candidate ? `<div class="callout"><span>👋 <b>${esc(S.candidate.name)}</b> wants to move in.</span><button class="btn good" data-welcome>Welcome</button></div>` : '') + (rows ? `<div class="rows">${rows}</div>` : `<p class="empty">No residents yet. Build a Small House and a traveler will come by.</p>`);
    }
    if (this.villageTab === 'land') {
      const cells = [];
      for (let cz = -2; cz <= 2; cz++) for (let cx = -2; cx <= 2; cx++) {
        const a = AREAS[CELL_AREA[(cz + 2) * 5 + (cx + 2)]];
        const own = S.areas.includes(a.id);
        cells.push(`<div class="mcell${own ? ' own' : ''}${a.hidden ? ' sea' : ''}" style="--c:${a.col}"><small>${a.hidden ? '🌊' : own ? '✓' : '🔒'}</small></div>`);
      }
      const list = AREAS.filter((a) => !a.hidden).map((a) => {
        const own = S.areas.includes(a.id);
        const adj = a.cells.some(([cx, cz]) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dz]) => Barriers.cellUnlocked(cx + dx, cz + dz)));
        return `<div class="arow${own ? ' own' : ''}"><span class="dot" style="background:${a.col}"></span><div class="grow"><b>${esc(a.name)}</b><small>${esc(a.desc)}</small></div>${own ? '<span class="chip good">Yours</span>' : `<div class="costs">${this.costHtml(a.cost)}</div><button class="btn" data-buyarea="${a.id}" ${S.level < a.level || !adj ? 'disabled' : ''}>${S.level < a.level ? 'Lv ' + a.level : !adj ? 'Not adjacent' : 'Buy'}</button>`}</div>`;
      }).join('');
      return tabs + `<div class="landwrap"><div class="landmap"><img alt="Map of the world" src="${Minimap.dataURL()}"><div class="mgrid">${cells.join('')}</div><i class="me" style="left:${((Player.x + 200) / 400) * 100}%;top:${((Player.z + 200) / 400) * 100}%"></i></div><div class="alist">${list}</div></div>`;
    }
    const hap = Village.happyCache;
    const food = S.res.food, pop = Village.population();
    const tiles = [
      ['👥', 'Population', `${pop} / ${Village.capacity()}`],
      ['😊', 'Happiness', `${Math.round(hap.total)}%`],
      ['🍞', 'Food', `${fmt(food)} (${pop ? Math.floor(food / Math.max(1, pop * 2.5)) + ' days' : '—'})`],
      ['⭐', 'Village level', `${S.level} · ${levelTitle(S.level)}`],
      ['🏠', 'Buildings', `${BuildingService.countAll()}`],
      ['🪙', 'Income', `${fmt(Economy.incomePerMin())} / min`],
      ['🗺️', 'Unlocked areas', `${S.areas.length} / ${AREAS.length - 1}`],
    ].map(([i, l, v]) => `<div class="tile"><span class="ic">${i}</span><small>${l}</small><b>${v}</b></div>`).join('');
    const fac = hap.factors.map((f) => `<div class="fac"><span>${f.icon} ${esc(f.name)}</span><b class="${f.v < 0 ? 'neg' : ''}">${f.v > 0 ? '+' : ''}${f.v}</b></div>`).join('');
    return tabs + (S.candidate ? `<div class="callout"><span>👋 <b>New Resident Available!</b> ${esc(S.candidate.name)} is waiting.</span><button class="btn good" data-welcome>Welcome</button></div>` : '') + `<div class="tiles">${tiles}</div><h3>What makes villagers happy</h3><div class="facs">${fac}</div><p class="muted small">Happier villages attract new residents faster and work harder.</p>`;
  },
  policiesHtml() {
    const b = S.policies.benefit;
    const jobless = S.npcs.filter((n) => !n.work).length;
    const share = b.mode === 'person' ? b.amount : jobless ? Math.floor(b.amount / jobless) : 0;
    const total = b.mode === 'person' ? b.amount * jobless : jobless ? share * jobless : 0;
    const relief = Math.round(clamp(share / 15, 0, 1) * 100);
    return `<div class="policy${b.on ? ' on' : ''}">
      <div class="pol-h"><span class="ic">🤲</span><div class="grow"><b>Unemployment benefit</b><small>Villagers without a job get coins from the treasury every morning. They stay happier and spend part of it in your shops.</small></div>
        <label class="switch"><input type="checkbox" id="pol-on" ${b.on ? 'checked' : ''} aria-label="Unemployment benefit on or off"><i></i></label></div>
      <div class="pol-body">
        <div class="seg" role="radiogroup"><button data-pmode="person" class="${b.mode === 'person' ? 'on' : ''}" role="radio" aria-checked="${b.mode === 'person'}">Per person</button><button data-pmode="total" class="${b.mode === 'total' ? 'on' : ''}" role="radio" aria-checked="${b.mode === 'total'}">Total budget</button></div>
        <div class="amt"><button class="btn sm alt" data-pstep="-${b.mode === 'total' ? 25 : 5}">−</button><label><input type="number" id="pol-amt" min="0" max="${b.mode === 'total' ? 100000 : 1000}" step="${b.mode === 'total' ? 25 : 1}" value="${b.amount}"> 🪙 ${b.mode === 'person' ? 'per jobless villager per day' : 'per day, shared by all jobless villagers'}</label><button class="btn sm alt" data-pstep="${b.mode === 'total' ? 25 : 5}">+</button></div>
        <div class="pol-sum"><span>👥 Jobless now: <b>${jobless}</b></span><span>🪙 Each gets: <b>${share}</b>/day</span><span>💸 Cost: <b>${total}</b>/day</span><span>😊 Takes away <b>${relief}%</b> of their unhappiness${relief < 100 ? ' (15 🪙 each = 100%)' : ''}</span></div>
        ${b.lastPaid ? `<small class="muted">Last paid on day ${b.lastPaid}: ${b.lastShare} 🪙 each.</small>` : ''}
      </div></div>
      <p class="muted small">Payment happens every morning at 06:00, together with the taxes. If the treasury runs short, everyone gets an equal part of what is left.</p>
      ${this.buildPolicyHtml()}`;
  },
  buildPolicyHtml() {
    const p = S.policies.build, t = p.town;
    const ex = BUILDINGS[BuildingService.canBuild('cottage').ok || S.level >= 5 ? 'cottage' : 'small_house'];
    const sp = PolicyService.splitCost(ex.cost);
    const label = t === 100 ? 'The town pays everything' : t === 0 ? 'The villagers pay everything' : `Town ${t}% · villagers ${100 - t}%`;
    return `<div class="policy on">
      <div class="pol-h"><span class="ic">🏗️</span><div class="grow"><b>Construction funding</b><small>Who pays when villagers build in your build zones. The villagers' part comes out of their own savings (they earn wages at work); materials the town does not supply, they buy themselves.</small></div></div>
      <div class="pol-body">
        <label class="sl"><span>${label}</span><input type="range" id="pol-town" min="0" max="100" step="10" value="${t}" aria-label="Share the town pays"></label>
        <div class="pol-sum"><span>🏛️ Town pays: <b>${t}%</b></span><span>👥 Villagers pay: <b>${100 - t}%</b></span><span>💰 Villagers' savings: <b>${fmt(PolicyService.savings())}</b> 🪙</span><span>🧾 Paid by villagers so far: <b>${fmt(p.villagersPaid)}</b> 🪙</span></div>
        <small class="muted">Example, a ${ex.name}: the town gives ${this.costText(sp.town) || 'nothing'}${sp.villagers ? `, the villagers add ${fmt(sp.villagers)} 🪙` : ''}.</small>
      </div></div>
      <p class="muted small">Buildings you place yourself are always paid by you. A lower town share saves your storage, but sites start only when the villagers have saved enough.</p>`;
  },
  wirePolicies(el) {
    const set = (p) => { Remote.invoke('SetPolicy', p); Village.computeHappiness(); this.render('village'); };
    $('#pol-on', el)?.addEventListener('change', (e) => { set({ on: e.target.checked }); Audio.sfx('tick'); });
    $$('[data-pmode]', el).forEach((b) => b.addEventListener('click', () => { const mode = b.dataset.pmode; const cur = S.policies.benefit; set({ mode, amount: mode === 'total' && cur.mode === 'person' ? cur.amount * Math.max(1, S.npcs.filter((n) => !n.work).length) : mode === 'person' && cur.mode === 'total' ? Math.max(1, Math.round(cur.amount / Math.max(1, S.npcs.filter((n) => !n.work).length))) : cur.amount }); }));
    $$('[data-pstep]', el).forEach((b) => b.addEventListener('click', () => set({ amount: Math.max(0, S.policies.benefit.amount + +b.dataset.pstep) })));
    $('#pol-amt', el)?.addEventListener('change', (e) => set({ amount: Math.max(0, +e.target.value || 0) }));
    const town = $('#pol-town', el);
    town?.addEventListener('input', () => { const v = +town.value; town.previousElementSibling.textContent = v === 100 ? 'The town pays everything' : v === 0 ? 'The villagers pay everything' : `Town ${v}% · villagers ${100 - v}%`; });
    town?.addEventListener('change', () => { Remote.invoke('SetBuildPolicy', { town: +town.value }); Audio.sfx('tick'); this.render('village'); });
  },
  /* ---------- SHOP ---------- */
  shopHtml() {
    const avail = ShopService.available();
    if (!avail.includes(this.shopTab)) this.shopTab = avail[0];
    const tabs = this.tabs(avail.map((id) => [id, id === 'merchant' ? '🧳 Merchant' : `${SHOPS[id].icon} ${SHOPS[id].name}`]), this.shopTab);
    const id = this.shopTab;
    if (id === 'merchant') {
      const m = EventService.merchant();
      if (!m) return tabs + '<p class="empty">The merchant has moved on.</p>';
      return tabs + `<p class="muted">Ilse travels the land with rare goods. Each deal is available once.</p><div class="deals">${m.deals.map((d, i) => `<div class="deal${d.sold ? ' sold' : ''}"><div class="costs">${this.costHtml(d.give)}</div><span>→</span><div class="costs">${this.costHtml(d.get, false)}</div><button class="btn good" data-deal="${i}" ${d.sold ? 'disabled' : ''}>${d.sold ? 'Sold' : 'Trade'}</button></div>`).join('')}</div>`;
    }
    const sh = SHOPS[id];
    const open = Clock.shopsOpen();
    const rows = sh.items.filter((k) => S.level >= ITEMS[k].level || S.res[k] > 0).map((k) => {
      const sp = Economy.sellPrice(k, id), bp = Economy.buyPrice(k, id);
      const sat = S.sat[k] ? ` <span class="chip lack" title="Prices recover over time">−${Math.round(S.sat[k] * 100)}%</span>` : '';
      return `<div class="trow"><span class="ic">${ITEMS[k].icon}</span><div class="grow"><b>${ITEMS[k].name}</b><small>You have ${fmt(S.res[k])}</small></div>
        <div class="tcol"><small>Sell ${sp} 🪙${sat}</small><div class="btns"><button class="btn sm" data-trade="sell:${k}:1">1</button><button class="btn sm" data-trade="sell:${k}:10">10</button><button class="btn sm" data-trade="sell:${k}:all">All</button></div></div>
        <div class="tcol"><small>Buy ${bp} 🪙</small><div class="btns"><button class="btn sm alt" data-trade="buy:${k}:1">1</button><button class="btn sm alt" data-trade="buy:${k}:10">10</button></div></div></div>`;
    }).join('');
    let tools = '';
    if (sh.tools) {
      const next = TOOL_TIERS[S.inv.tool + 1];
      tools = `<div class="toolcard"><span class="ic">🛠️</span><div class="grow"><b>${next ? 'Upgrade to ' + next.name : TOOL_TIERS[S.inv.tool].name}</b><small>${next ? `${next.mult}× resources, ${Math.round((next.speed - 1) * 100)}% faster swings · level ${next.level}` : 'Nothing left to upgrade.'}</small>${next ? `<div class="costs">${this.costHtml(next.cost)}</div>` : ''}</div>${next ? `<button class="btn good" data-upgrade ${S.level < next.level ? 'disabled' : ''}>Upgrade</button>` : ''}</div>`;
    }
    return tabs + `<p class="muted">${esc(sh.desc)} Selling a lot at once lowers the price for a while.</p>${open ? '' : '<div class="callout night"><span>🌙 Shops are closed at night. They open at 06:00. Sleep in your home to skip the night.</span></div>'}${tools}<div class="trows${open ? '' : ' closed'}">${rows}</div>`;
  },
  openShop(id) { if (id !== 'merchant' && !ShopService.available().includes(id)) id = 'cart'; this.shopTab = id; this.open('shop'); },
  /* ---------- SETTINGS ---------- */
  settingsHtml() {
    const s = S.settings;
    const sl = (k, label) => `<label class="sl"><span>${label}</span><input type="range" id="set-${k}" min="0" max="${k === 'sens' ? 2.5 : 1}" step="0.05" value="${s[k]}"></label>`;
    const last = DataService.lastSavedAt ? new Date(DataService.lastSavedAt) : null;
    const ago = last ? Math.round((Date.now() - last) / 1000) : null;
    const saveBox = `<h3>Saving</h3><div class="savebox"><span class="ic">💾</span><div class="grow"><b id="save-when">${last ? 'Last saved at ' + last.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + (ago < 60 ? ' (just now)' : ` (${Math.floor(ago / 60)} min ago)`) : 'Not saved yet this session'}</b><small>Saves automatically every 30 seconds, every morning and when you leave. Shortcut: Ctrl+S.</small></div><button class="btn good" id="set-save">Save now</button></div>`;
    return saveBox + `<h3>Graphics</h3><div class="seg" role="radiogroup">${['low', 'medium', 'high'].map((q) => `<button data-q="${q}" class="${s.quality === q ? 'on' : ''}" role="radio" aria-checked="${s.quality === q}">${q[0].toUpperCase() + q.slice(1)}</button>`).join('')}</div>
      <p class="muted small">Low turns off shadows and thins out grass for weaker devices.</p>
      <h3>Sound</h3>${sl('master', 'Master')}${sl('music', 'Music')}${sl('sfx', 'Effects')}${sl('amb', 'Ambience')}
      <h3>Controls</h3>${sl('sens', 'Camera speed')}
      <label class="tg"><input type="checkbox" id="set-names" ${s.names ? 'checked' : ''}> Show villager names</label>
      <div class="keys"><span><kbd>WASD</kbd> walk</span><span><kbd>Shift</kbd> run</span><span><kbd>Space</kbd> jump</span><span><kbd>E</kbd> interact</span><span><kbd>Drag</kbd> turn camera</span><span><kbd>Wheel</kbd> zoom</span><span><kbd>B</kbd> build</span><span><kbd>R</kbd> rotate</span><span><kbd>I J V T</kbd> menus</span><span><kbd>Ctrl+S</kbd> save</span><span><kbd>P</kbd> pause</span><span><kbd>1–4</kbd> game speed</span><span><kbd>Esc</kbd> close</span></div>
      <h3>Your village</h3>
      <div class="btnrow"><button class="btn alt" id="set-export">Copy save code</button><button class="btn alt" id="set-import">Load save code</button><button class="btn danger" id="set-reset">Start over</button></div>
      <textarea id="set-code" rows="3" placeholder="Paste a save code here, then press Load save code." aria-label="Save code"></textarea>
      <p class="muted small">Your village saves automatically every 30 seconds and when you leave. Save codes let you move it to another browser.</p>`;
  },
  saveNow() {
    const ok = DataService.save('manual');
    this.toast(ok ? { icon: '💾', title: 'Village saved', text: 'Your progress is stored in this browser.', cls: 'good' } : { icon: '⚠️', title: 'Saving failed', text: 'This browser blocks storage (private window?). Use Copy save code as a backup.' });
    Audio.sfx(ok ? 'quest' : 'error');
  },
  wireSettings(el) {
    $$('[data-q]', el).forEach((b) => b.addEventListener('click', () => { Remote.invoke('Settings', { quality: b.dataset.q }); Game.applyQuality(); this.render('settings'); }));
    for (const k of ['master', 'music', 'sfx', 'amb', 'sens']) { const i = $('#set-' + k, el); i.addEventListener('input', () => { Remote.invoke('Settings', { [k]: +i.value }); Audio.applyVolumes(); }); }
    $('#set-names', el).addEventListener('change', (e) => Remote.invoke('Settings', { names: e.target.checked }));
    $('#set-save', el).addEventListener('click', () => { this.saveNow(); this.render('settings'); });
    $('#set-export', el).addEventListener('click', () => {
      const code = DataService.exportCode(), ta = $('#set-code', el); ta.value = code;
      navigator.clipboard?.writeText(code).then(() => this.toast({ icon: '📋', title: 'Save code copied', text: 'Paste it in another browser to continue there.' })).catch(() => { ta.select(); this.toast({ icon: '📋', title: 'Save code ready', text: 'Select the text box and copy it.' }); });
    });
    $('#set-import', el).addEventListener('click', () => {
      const code = $('#set-code', el).value;
      this.confirm('Load this save?', 'Your current village will be replaced by the one in the code.', 'Load', () => { if (DataService.importCode(code)) { Game.skipSave = true; location.reload(); } else this.toast({ icon: '⚠️', title: 'That code did not work', text: 'Make sure you copied the whole code.' }); });
    });
    $('#set-reset', el).addEventListener('click', () => this.confirm('Start a new village?', 'This deletes your current village for good.', 'Delete and restart', () => { DataService.reset(); Game.skipSave = true; location.reload(); }, true));
  },
  /* ---------- cards ---------- */
  closeCard() { $('#card').hidden = true; this.card = null; SelRing.show(null); },
  showCard(html, refresh) {
    const c = $('#card'); c.innerHTML = `<button class="x" data-close aria-label="Close">✕</button>` + html; c.hidden = false;
    this.card = { refresh };
    return c;
  },
  npcCard(n) {
    this.closePanels();
    const render = () => {
      const home = BuildingService.byId(n.home), work = BuildingService.byId(n.work), r = NPCService.rt.get(n.id);
      if (!S.npcs.includes(n)) return this.closeCard();
      const c = this.showCard(`<div class="c-h"><span class="avatar" style="background:#${(PROFS[n.prof].shirt).toString(16).padStart(6, '0')}">${PROFS[n.prof].icon}</span><div><b>${esc(n.name)}</b><small>${PROFS[n.prof].name} · since day ${n.joined}</small></div></div>
        <p class="thought">“${esc(NPCService.thoughtOf(n))}”</p>
        <div class="kv"><span>Doing</span><b>${esc(NPCService.activityOf(n))}</b><span>Home</span><b>${home ? BUILDINGS[home.type].name : '—'}</b><span>Workplace</span><b>${work ? BUILDINGS[work.type].name : 'Looking for work'}</b><span>Money</span><b>🪙 ${fmt(n.money)}</b></div>
        <div class="kbar"><span>😊 Happiness</span>${this.bar(n.happy / 100, 'good')}</div><div class="kbar"><span>🍽️ Fullness</span>${this.bar(1 - n.hunger / 100, n.hunger > 70 ? 'full' : '')}</div>
        ${n.req ? `<div class="callout"><span>❗ Needs <b>${n.req.n} ${ITEMS[n.req.k].icon} ${ITEMS[n.req.k].name}</b> (you have ${fmt(S.res[n.req.k])})</span><button class="btn good" id="c-help">Give</button></div>` : ''}
        <div class="btnrow"><button class="btn alt" id="c-follow">Show on map</button></div>`, render);
      $('#c-help', c)?.addEventListener('click', () => { const res = Remote.invoke('HelpNPC', { id: n.id }); if (!res.ok) { this.toast({ icon: '🤝', title: 'Help', text: res.err }); Audio.sfx('error'); } else { Audio.sfx('quest'); render(); } });
      $('#c-follow', c)?.addEventListener('click', () => { if (r) { FX.markerTarget = { x: r.ent.x, y: r.ent.y + 2, z: r.ent.z, temp: now() + 8 }; this.toast({ icon: '📍', title: n.name.split(' ')[0] + ' is marked', text: 'Look for the gold marker.' }); } });
    };
    render();
    const r = NPCService.rt.get(n.id); if (r && !r.ent.hidden) r.ent.bubble = { text: pick(['👋', '😊', '🙂']), t: 2 };
  },
  buildingCard(b) {
    this.closePanels();
    const render = () => {
      if (!BuildingService.byId(b.id)) return this.closeCard();
      const cfg = BUILDINGS[b.type];
      const res = Village.residentsOf(b.id), wk = Village.workersOf(b.id);
      let body = `<div class="c-h"><span class="avatar">${BUILD_CATS.find((c) => c.id === cfg.cat).icon}</span><div><b>${esc(cfg.name)}</b><small>${b.damaged ? '🔥 Damaged' : cfg.shop ? (Clock.shopsOpen() ? 'Open' : 'Closed for the night') : 'Level ' + cfg.level}</small></div></div><p class="muted">${esc(cfg.desc)}</p>`;
      if (cfg.house) body += `<h4>Residents ${res.length}/${cfg.house}</h4><div class="people">${res.map((n) => `<button class="chip" data-npc="${n.id}">${PROFS[n.prof].icon} ${esc(n.name.split(' ')[0])}</button>`).join('') || '<small class="muted">Empty. A traveler will move in soon.</small>'}</div>`;
      if (cfg.jobs) body += `<h4>Workers ${wk.length}/${cfg.jobs.n}</h4><div class="people">${wk.map((n) => `<button class="chip" data-npc="${n.id}">${PROFS[n.prof].icon} ${esc(n.name.split(' ')[0])}</button>`).join('') || '<small class="muted">No workers yet. New residents take open jobs.</small>'}</div>`;
      if (cfg.produce) body += `<p class="small">⚙️ ${cfg.consume ? this.costText(cfg.consume) + ' → ' : ''}${this.costText(cfg.produce)} per worker every 5 seconds while they work (07:30–17:30).</p>`;
      if (cfg.storage) body += `<p class="small">📦 Adds ${cfg.storage} storage for every resource.</p>`;
      if (b.build > 0) body += `<div class="callout"><span>🏗️ Under construction · ${Math.round((1 - b.build / (b.buildT || 1)) * 100)}% · ${b.helpers || 0} helping</span></div>`;
      const btns = [];
      if (cfg.shop) btns.push(`<button class="btn good" id="c-trade">Trade</button>`);
      if (b.type === 'home') btns.push(`<button class="btn" id="c-sleep">Sleep</button>`);
      if (b.damaged) btns.push(`<button class="btn good" id="c-repair">Repair (30 🪵 15 🪨)</button>`);
      if (b.type !== 'home') btns.push(`<button class="btn alt" id="c-move">Move</button><button class="btn danger" id="c-demo">Demolish</button>`);
      body += `<div class="btnrow">${btns.join('')}</div>`;
      const c = this.showCard(body, render);
      $$('[data-npc]', c).forEach((x) => x.addEventListener('click', () => { const n = S.npcs.find((q) => q.id === +x.dataset.npc); if (n) this.npcCard(n); }));
      $('#c-trade', c)?.addEventListener('click', () => this.openShop(cfg.shop));
      $('#c-sleep', c)?.addEventListener('click', () => this.sleep());
      $('#c-repair', c)?.addEventListener('click', () => { const r = Remote.invoke('Repair', { id: b.id }); if (!r.ok) this.toast({ icon: '🔨', title: 'Repair', text: r.err }); render(); });
      $('#c-move', c)?.addEventListener('click', () => { this.closeCard(); BuildCtl.start(b.type, b.id); });
      $('#c-demo', c)?.addEventListener('click', () => this.confirm('Demolish ' + cfg.name + '?', 'You get half of the building cost back. People living or working here will need a new place.', 'Demolish', () => { Remote.invoke('Demolish', { id: b.id }); this.closeCard(); }, true));
      SelRing.show(b);
    };
    render();
  },
  areaDialog(id) {
    const a = AREA_BY_ID[id];
    const own = S.areas.includes(id);
    this.dialog(`<h3>🗺️ ${esc(a.name)}</h3><p>${esc(a.desc)}</p>${own ? '<p class="chip good">Already yours</p>' : `<p class="muted">Requires level ${a.level}${S.level < a.level ? ` (you are level ${S.level})` : ''}.</p><div class="costs big">${this.costHtml(a.cost)}</div>`}`,
      own ? [['Close', null]] : [['Not now', null], ['Buy land', () => { const r = Remote.invoke('BuyArea', { id }); if (!r.ok) { this.toast({ icon: '🔒', title: a.name, text: r.err }); Audio.sfx('error'); return false; } }, S.level < a.level || !Economy.has(a.cost)]]);
  },
  confirm(title, text, ok, fn, danger = false) { this.dialog(`<h3>${esc(title)}</h3><p>${esc(text)}</p>`, [['Cancel', null], [ok, fn, false, danger]]); },
  dialog(html, buttons) {
    const d = $('#dialog');
    d.innerHTML = `<div class="dlg">${html}<div class="btnrow">${buttons.map(([l, , dis, danger], i) => `<button class="btn ${i === buttons.length - 1 ? (danger ? 'danger' : 'good') : 'alt'}" data-dlg="${i}" ${dis ? 'disabled' : ''}>${esc(l)}</button>`).join('')}</div></div>`;
    d.hidden = false;
    $$('[data-dlg]', d).forEach((b) => b.addEventListener('click', () => { const fn = buttons[+b.dataset.dlg][1]; const keep = fn ? fn() === false : false; if (!keep) this.closeDialog(); }));
    Audio.sfx('open');
  },
  closeDialog() { $('#dialog').hidden = true; },
  sleep() {
    const f = $('#fade');
    const r = Remote.invoke('Sleep');
    if (!r.ok) { this.toast({ icon: '🌙', title: 'Sleep', text: r.err }); Audio.sfx('error'); return; }
    this.closeCard();
    f.classList.add('on'); f.textContent = '💤';
    setTimeout(() => { f.classList.remove('on'); f.textContent = ''; }, 1600);
  },
  /* ---------- HUD ---------- */
  update(dt) {
    this.hudT -= dt;
    if (this.hudT <= 0 || this.dirty) { this.hudT = 0.25; this.dirty = false; this.hud(); }
    if (this.trackerDirty || (this._trT = (this._trT || 0) - dt) <= 0) { this._trT = 1; this.trackerDirty = false; this.tracker(); }
    this.updatePopups(dt);
    this.updatePrompt();
    Minimap.update(dt);
  },
  hud() {
    const set = (id, v) => { const e = $(id); if (e && e.textContent !== v) { e.textContent = v; e.parentElement.classList.remove('bump'); void e.offsetWidth; e.parentElement.classList.add('bump'); } };
    set('#r-coins', fmt(S.coins)); set('#r-wood', fmt(S.res.wood)); set('#r-stone', fmt(S.res.stone)); set('#r-food', fmt(S.res.food));
    set('#r-pop', `${Village.population()}/${Village.capacity()}`);
    const hp = Math.round(Village.happiness());
    set('#r-happy', hp + '%');
    $('#r-happy-ic').textContent = hp > 70 ? '😊' : hp > 40 ? '🙂' : hp > 20 ? '😐' : '😟';
    for (const k of ['wood', 'stone', 'food']) $('#r-' + k).parentElement.classList.toggle('full', S.res[k] >= Economy.cap(k));
    $('#r-pop').parentElement.classList.toggle('alert', !!S.candidate);
    const need = xpToNext(S.level);
    $('#lvl-n').textContent = S.level;
    $('#lvl-title').textContent = levelTitle(S.level);
    $('#xp-fill').style.width = (S.xp / need) * 100 + '%';
    $('#xp-txt').textContent = `${fmt(S.xp)} / ${fmt(need)} XP`;
    const h = S.time.hour;
    $('#clock-t').textContent = fmtHour(h);
    $('#clock-ic').textContent = Clock.isNight() ? '🌙' : h < 8 ? '🌅' : h > 18.5 ? '🌇' : EventService.is('rain') ? '🌧️' : '☀️';
    $('#clock-d').textContent = `Day ${S.time.day} · ${Clock.shopsOpen() ? 'Shops open' : 'Shops closed'}`;
    const ready = QuestService.list().filter((q) => q.done).length;
    this.badge('quests', ready);
    this.badge('village', (S.candidate ? 1 : 0) + S.npcs.filter((n) => n.req).length);
    if (this.current === 'village' || this.current === 'shop') { if ((this._panelT = (this._panelT || 0) - 1) <= 0) { this._panelT = 8; } }
  },
  badge(name, n) { const b = $(`#dock button[data-open="${name}"] .badge`); if (b) { b.textContent = n; b.hidden = !n; } },
  tracker() {
    const el = $('#tracker');
    const qs = QuestService.list().slice(0, 3);
    el.innerHTML = qs.map((q) => `<button class="tq${q.done ? ' done' : ''}${q.main ? ' main' : ''}" data-open-q><b>${q.done ? '✅ ' : ''}${esc(q.title)}</b>${this.bar(q.p / q.n, q.done ? 'good' : '')}<small>${q.done ? 'Tap to claim' : `${fmt(q.p)} / ${fmt(q.n)}`}</small></button>`).join('');
    $$('[data-open-q]', el).forEach((b) => b.addEventListener('click', () => this.open('quests', 'quests')));
    // quest marker
    const m = qs[0];
    let t = null;
    if (FX.markerTarget && FX.markerTarget.temp && FX.markerTarget.temp > now()) t = FX.markerTarget;
    else if (m && m.main && !m.done && m.mark) {
      const types = { tree: ['oak', 'birch', 'pine', 'oak_autumn'], rock: ['rock'], iron: ['iron'] }[m.mark];
      if (types) { const n = Nodes.nearestOfType(Player.x, Player.z, types, 90); if (n) t = { x: n.x, y: n.y + (NODE_TYPES[n.type].tree ? 4.2 : 2) * n.s, z: n.z }; }
      if (m.mark === 'cart') t = { x: START.cart[0], y: World.groundY(START.cart[0], START.cart[1]) + 3.4, z: START.cart[1] };
      if (m.mark === 'candidate' && NPCService.cand) { const e = NPCService.cand.ent; t = { x: e.x, y: e.y + 2.6, z: e.z }; }
      if (m.mark === 'sign' && Barriers.signs.length) { let best = null, bd = 1e9; for (const s of Barriers.signs) { const d = Math.hypot(s.x - Player.x, s.z - Player.z); if (d < bd) { bd = d; best = s; } } if (best) t = { x: best.x, y: World.groundY(best.x, best.z) + 3.2, z: best.z }; }
    }
    if (t && Math.hypot(t.x - Player.x, t.z - Player.z) < 2.5 && !t.temp) t = null;
    FX.markerTarget = t;
  },
  /* ---------- toasts, hints, banners ---------- */
  toast({ icon = 'ℹ️', title = '', text = '', cls = '', action = null }) {
    const box = $('#toasts');
    const t = h('div', 'toast ' + cls, `<span class="ic">${icon}</span><div><b>${esc(title)}</b>${text ? `<small>${esc(text)}</small>` : ''}</div>`);
    if (action) { const b = h('button', 'btn sm good', esc(action.label)); b.addEventListener('click', () => { action.fn(); t.remove(); }); t.appendChild(b); }
    box.prepend(t);
    while (box.children.length > 4) box.lastChild.remove();
    setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 400); }, action ? 9000 : 4200);
  },
  hint(text) { const e = $('#hint'); e.textContent = text; e.hidden = false; clearTimeout(this._ht); this._ht = setTimeout(() => { e.hidden = true; }, 2600); },
  banner({ icon, title, text, cls = '', ev = false }, dur = 0) {
    const b = $('#event-banner');
    b.className = cls; b.innerHTML = `<span class="ic">${icon}</span><div><b>${esc(title)}</b><small>${esc(text)}</small>${ev ? '<i class="evbar"><i id="ev-fill"></i></i>' : ''}</div>`;
    b.hidden = false; b.dataset.ev = ev ? '1' : '';
    clearTimeout(this._bt);
    if (dur) this._bt = setTimeout(() => this.hideBanner(), dur * 1000);
  },
  hideBanner() { $('#event-banner').hidden = true; },
  levelUp(d) {
    const el = $('#levelup');
    if (!el.hidden && this._luAcc) { d = { ...d, unlocks: this._luAcc.unlocks.concat(d.unlocks), coins: this._luAcc.coins + d.coins }; }
    this._luAcc = d;
    el.innerHTML = `<div class="lu"><div class="lu-ring"><span>${d.level}</span></div><small>LEVEL UP</small><h2>${esc(d.title)}${d.titleChanged ? ' ✨' : ''}</h2><p>+${d.coins} 🪙</p>${d.unlocks.length ? `<div class="lu-list"><small>New unlocks</small>${d.unlocks.map((u) => `<span class="chip">${u.icon} ${esc(u.name)}</span>`).join('')}</div>` : ''}<button class="btn good" data-close-lu>Nice!</button></div>`;
    el.hidden = false;
    el.querySelector('[data-close-lu]').addEventListener('click', () => { el.hidden = true; this._luAcc = null; });
    clearTimeout(this._lut); this._lut = setTimeout(() => { el.hidden = true; this._luAcc = null; }, 6000);
    Audio.sfx('levelup');
    FX.confetti(Player.pos(), 60);
    CameraCtl.shake(0.25, 0.4);
    for (const r of NPCService.rt.values()) if (!r.ent.hidden && Math.hypot(r.ent.x - Player.x, r.ent.z - Player.z) < 40) r.ent.bubble = { text: '🎉', t: 2.5 };
    this.refreshOpen();
  },
  /* ---------- placement bar ---------- */
  placeBar(show, type, move) {
    const b = $('#placebar'); b.hidden = !show; $('#dock').hidden = show; document.body.classList.toggle('placing', show);
    if (!show) return;
    const cfg = BUILDINGS[type];
    $('#pb-name').textContent = (move ? 'Move ' : '') + cfg.name;
    $('#pb-cost').innerHTML = move ? '<span class="chip">Free</span>' : this.costHtml(cfg.cost);
  },
  placeStatus(res) { const s = $('#pb-status'); s.textContent = res.ok ? (BuildCtl.touch ? 'Tap ✓ to build here' : 'Click to build · R to rotate' + (BUILDINGS[BuildCtl.type].road ? ' · drag to paint' : '')) : res.err; s.className = res.ok ? 'ok' : 'bad'; $('#pb-ok').disabled = !res.ok; },
  shakePlaceBar() { const b = $('#placebar'); b.classList.remove('shake'); void b.offsetWidth; b.classList.add('shake'); },
  /* ---------- floating popups ---------- */
  popup(pos, text, cls = '') {
    const e = this.popPool.pop() || h('div', 'pop');
    e.className = 'pop ' + cls; e.textContent = text;
    $('#popups').appendChild(e);
    this.pops.push({ e, pos: pos.clone(), t: 0 });
  },
  popupScreen(el, text) {
    const r = el.getBoundingClientRect();
    const e = h('div', 'pop screen coin', esc(text));
    e.style.left = r.left + r.width / 2 + 'px'; e.style.top = r.top + 'px';
    document.body.appendChild(e); setTimeout(() => e.remove(), 1100);
  },
  updatePopups(dt) {
    const cam = Game.camera, v = new THREE.Vector3(), w = innerWidth, hh = innerHeight;
    for (let i = this.pops.length - 1; i >= 0; i--) {
      const p = this.pops[i];
      p.t += dt;
      if (p.t > 1.4) { p.e.remove(); this.popPool.push(p.e); this.pops.splice(i, 1); continue; }
      v.copy(p.pos); v.y += p.t * 1.6 + i * 0.02; v.project(cam);
      if (v.z > 1) { p.e.style.opacity = 0; continue; }
      p.e.style.opacity = p.t < 1 ? 1 : 1 - (p.t - 1) / 0.4;
      p.e.style.transform = `translate(${((v.x + 1) / 2) * w}px, ${((1 - v.y) / 2) * hh}px) translate(-50%, -50%) scale(${p.t < 0.15 ? 0.6 + p.t * 2.7 : 1})`;
    }
  },
  /* ---------- interaction prompt ---------- */
  _prompt: null, _hold: 0,
  prompt(t, hold) { this._prompt = t; this._hold = hold; },
  updatePrompt() {
    const el = $('#prompt'), t = this._prompt;
    const act = $('#btn-act');
    if (!t || BuildCtl.active || Game.state !== 'play') { el.hidden = true; act.classList.remove('has'); act.textContent = BuildCtl.active ? '✓' : 'E'; return; }
    const v = new THREE.Vector3(t.x, t.y, t.z).project(Game.camera);
    if (v.z > 1) { el.hidden = true; return; }
    el.hidden = false;
    const lbl = el.querySelector('span');
    if (lbl.textContent !== t.label) lbl.textContent = t.label;
    el.style.transform = `translate(${((v.x + 1) / 2) * innerWidth}px, ${((1 - v.y) / 2) * innerHeight}px) translate(-50%, -100%)`;
    const hp = el.querySelector('.hp');
    hp.hidden = t.hp == null; if (t.hp != null) hp.firstChild.style.width = clamp(t.hp, 0, 1) * 100 + '%';
    const ring = el.querySelector('.hold'); ring.hidden = !t.hold; if (t.hold) ring.style.setProperty('--p', this._hold);
    act.classList.add('has'); act.textContent = t.hold ? '🧯' : 'E';
  },
  showHud() { $('#hud').hidden = false; },
};

/* ---------------- building thumbnails (rendered once, cached) ---------------- */
const Thumbs = {
  cache: {}, scene: null, cam: null, rt: null,
  make(type) {
    if (this.cache[type]) return this.cache[type];
    const W = 160, H = 120;
    if (!this.scene) {
      this.scene = new THREE.Scene();
      this.scene.add(new THREE.HemisphereLight(0xdfefff, 0x8a7a5a, 1.3));
      const d = new THREE.DirectionalLight(0xfff2dc, 2.2); d.position.set(5, 8, 6); this.scene.add(d);
      this.cam = new THREE.PerspectiveCamera(30, W / H, 0.1, 400);
      this.rt = new THREE.WebGLRenderTarget(W, H, { samples: 4 });
      this.rt.texture.colorSpace = THREE.SRGBColorSpace;
    }
    const M = Models.get(type);
    const grp = new THREE.Group();
    grp.add(new THREE.Mesh(M.main, Mats.bld));
    if (M.glow) grp.add(new THREE.Mesh(M.glow, Mats.windowGlow));
    if (M.spin) { const s = new THREE.Mesh(M.spin.geo, Mats.bld); s.position.set(...M.spin.pivot); grp.add(s); }
    this.scene.add(grp);
    const bb = M.main.boundingBox, size = bb.getSize(new THREE.Vector3()), c = bb.getCenter(new THREE.Vector3());
    c.y = Math.max(c.y, size.y * 0.35);
    const r = Math.max(size.x, size.z, size.y * 1.2) * 1.25 + 1;
    this.cam.position.set(c.x + r * 0.9, c.y + r * 0.75, c.z + r * 1.25);
    this.cam.lookAt(c.x, c.y * 0.8, c.z);
    const R = Game.renderer;
    const prevTarget = R.getRenderTarget(), prevClear = R.getClearColor(new THREE.Color()), prevAlpha = R.getClearAlpha(), prevShadow = R.shadowMap.enabled;
    R.setRenderTarget(this.rt); R.setClearColor(0x000000, 0); R.clear(); R.render(this.scene, this.cam);
    const px = new Uint8Array(W * H * 4); R.readRenderTargetPixels(this.rt, 0, 0, W, H, px);
    R.setRenderTarget(prevTarget); R.setClearColor(prevClear, prevAlpha); R.shadowMap.enabled = prevShadow;
    this.scene.remove(grp);
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d'), img = ctx.createImageData(W, H);
    for (let y = 0; y < H; y++) img.data.set(px.subarray((H - 1 - y) * W * 4, (H - y) * W * 4), y * W * 4);
    ctx.putImageData(img, 0, 0);
    return (this.cache[type] = cv.toDataURL());
  },
  fill(el) { for (const t of $$('[data-thumb]', el)) { try { t.style.backgroundImage = `url(${this.make(t.dataset.thumb)})`; } catch (e) { console.warn('thumb', e); } } },
};

/* ---------------- minimap ---------------- */
const Minimap = {
  base: null, cv: null, ctx: null, t: 0, url: null,
  init() {
    this.cv = $('#minimap'); this.ctx = this.cv.getContext('2d');
    const N = 240, cv = document.createElement('canvas'); cv.width = N; cv.height = N;
    const c = cv.getContext('2d'), img = c.createImageData(N, N), col = new THREE.Color();
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const x = -WORLD.HALF + (i + 0.5) * 2, z = -WORLD.HALF + (j + 0.5) * 2, y = World.groundY(x, z);
      if (y < -0.2) col.setHex(0x3f8fbf).lerp(new THREE.Color(0x2b6fa0), smoothstep(0, 5, -y));
      else { terrainColor(x, z, y, 1 - Math.min(0.5, World.slopeAt(x, z) * 0.35), 0.5, col); if (World.onRoad(x, z)) col.setHex(0xc9a877); }
      col.convertLinearToSRGB();
      const k = (j * N + i) * 4; img.data[k] = col.r * 255; img.data[k + 1] = col.g * 255; img.data[k + 2] = col.b * 255; img.data[k + 3] = 255;
    }
    c.putImageData(img, 0, 0);
    this.base = cv;
  },
  dataURL() {
    const cv = document.createElement('canvas'); cv.width = cv.height = 200;
    const c = cv.getContext('2d');
    c.drawImage(this.base, 20, 20, 200, 200, 0, 0, 200, 200);
    for (let cz = -2; cz <= 2; cz++) for (let cx = -2; cx <= 2; cx++) {
      const a = AREAS[CELL_AREA[(cz + 2) * 5 + (cx + 2)]];
      if (!S.areas.includes(a.id) && !a.hidden) { c.fillStyle = 'rgba(20,24,34,0.45)'; c.fillRect((cx + 2) * 40, (cz + 2) * 40, 40, 40); }
    }
    c.fillStyle = '#5a3d2a';
    for (const b of S.buildings) { const r = BuildingService.rect(b.type, b.x, b.z, b.rot); c.fillRect((r.x0 + 200) / 2, (r.z0 + 200) / 2, Math.max(1, (r.x1 - r.x0) / 2), Math.max(1, (r.z1 - r.z0) / 2)); }
    return cv.toDataURL();
  },
  update(dt) {
    this.t -= dt; if (this.t > 0) return; this.t = 0.2;
    const c = this.ctx, W = this.cv.width, span = 170, s = W / span;
    const x0 = Player.x - span / 2, z0 = Player.z - span / 2;
    c.clearRect(0, 0, W, W);
    c.save();
    c.beginPath(); c.arc(W / 2, W / 2, W / 2 - 1, 0, TAU); c.clip();
    c.drawImage(this.base, (x0 + WORLD.HALF) / 2, (z0 + WORLD.HALF) / 2, span / 2, span / 2, 0, 0, W, W);
    // locked areas
    c.fillStyle = 'rgba(20,24,34,0.42)';
    for (let cz = -2; cz <= 2; cz++) for (let cx = -2; cx <= 2; cx++) {
      const a = AREAS[CELL_AREA[(cz + 2) * 5 + (cx + 2)]];
      if (S.areas.includes(a.id) || a.hidden) continue;
      c.fillRect((cx * 80 - 40 - x0) * s, (cz * 80 - 40 - z0) * s, 80 * s, 80 * s);
    }
    c.fillStyle = '#6b4630';
    for (const b of S.buildings) {
      if (Math.abs(b.x - Player.x) > span || Math.abs(b.z - Player.z) > span) continue;
      const r = BuildingService.rect(b.type, b.x, b.z, b.rot);
      c.fillStyle = BUILDINGS[b.type].road ? '#b99b72' : b.damaged ? '#c0392b' : '#6b4630';
      c.fillRect((r.x0 - x0) * s, (r.z0 - z0) * s, Math.max(2, (r.x1 - r.x0) * s), Math.max(2, (r.z1 - r.z0) * s));
    }
    for (const z of S.zones) { c.strokeStyle = '#' + ZONE_KINDS[z.kind].col.toString(16).padStart(6, '0'); c.lineWidth = 1.5; c.setLineDash([3, 2]); c.strokeRect((z.x0 - x0) * s, (z.z0 - z0) * s, (z.x1 - z.x0) * s, (z.z1 - z.z0) * s); }
    c.setLineDash([]);
    c.fillStyle = '#fff4c2';
    for (const r of NPCService.rt.values()) { if (r.ent.hidden) continue; c.beginPath(); c.arc((r.ent.x - x0) * s, (r.ent.z - z0) * s, r.n.req || r.cand ? 3 : 1.8, 0, TAU); c.fill(); }
    c.fillStyle = '#e74c3c';
    for (const w of EventService.wolves) { c.beginPath(); c.arc((w.x - x0) * s, (w.z - z0) * s, 2.6, 0, TAU); c.fill(); }
    if (FX.markerTarget) { c.fillStyle = '#ffd166'; const mx = clamp((FX.markerTarget.x - x0) * s, 6, W - 6), mz = clamp((FX.markerTarget.z - z0) * s, 6, W - 6); c.beginPath(); c.moveTo(mx, mz - 5); c.lineTo(mx + 4, mz); c.lineTo(mx, mz + 5); c.lineTo(mx - 4, mz); c.fill(); }
    c.restore();
    // player arrow (points where the camera looks)
    c.save(); c.translate(W / 2, W / 2); c.rotate(-Player.ent.yaw + Math.PI);
    c.fillStyle = '#ffffff'; c.strokeStyle = '#2f6e45'; c.lineWidth = 2;
    c.beginPath(); c.moveTo(0, -7); c.lineTo(5, 5); c.lineTo(0, 2); c.lineTo(-5, 5); c.closePath(); c.fill(); c.stroke();
    c.restore();
    // N marker
    c.fillStyle = 'rgba(255,255,255,0.9)'; c.font = '700 10px Nunito, sans-serif'; c.textAlign = 'center'; c.fillText('N', W / 2, 11);
    const ef = $('#ev-fill'); if (ef && EventService.active) ef.style.width = (1 - EventService.active.t / EventService.active.dur) * 100 + '%';
  },
};
