/* =====================================================================
   SERVER (≈ ServerScriptService/Services)
   Authoritative game state + services. The client never edits S
   directly: it calls Remote.invoke(name, args) and every handler
   validates its arguments, the player's position, costs and cooldowns
   before changing anything. Services signal the client through Bus.
   (In a browser there is no real trust boundary; this structure keeps
   the rules in one place, and maps 1:1 onto Roblox RemoteFunctions.)
   ===================================================================== */
let S = null; // the authoritative game state (saved)

/* ---------------- Remote (validated request gateway) ---------------- */
const Remote = {
  handlers: {}, last: {},
  handle(name, fn, minInterval = 0) { this.handlers[name] = { fn, minInterval }; },
  invoke(name, args = {}) {
    const h = this.handlers[name];
    if (!h) return { ok: false, err: 'Unknown request' };
    if (typeof args !== 'object' || args === null || Array.isArray(args)) return { ok: false, err: 'Bad request' };
    const t = now();
    if (h.minInterval && this.last[name] && t - this.last[name] < h.minInterval) return { ok: false, err: 'Slow down a little', silent: true };
    this.last[name] = t;
    try { return h.fn(args) || { ok: true }; } catch (e) { console.error('[Remote]', name, e); return { ok: false, err: 'Something went wrong' }; }
  },
};
const fail = (err, extra) => Object.assign({ ok: false, err }, extra || {});
const isActive = (b) => !b.damaged && !(b.build > 0);

/* ---------------- DataService ---------------- */
const SAVE_SALT = 'byv-3f9a';
const DataService = {
  KEY: 'buildyourvillage.save.v1', BAK: 'buildyourvillage.save.v1.bak',
  mem: {}, lastSave: 0, dirty: false,
  defaults() {
    return {
      v: 1, coins: 150, xp: 0, level: 1,
      res: { wood: 20, stone: 10, wheat: 0, food: 15, iron: 0, gold: 0, tools: 0, planks: 0 },
      buildings: [{ id: 1, type: 'home', x: START.home.x, z: START.home.z, rot: START.home.rot }],
      nextId: 2,
      areas: ['start'], discovered: ['start'],
      npcs: [], nextNpc: 1, candidate: null, usedNames: [],
      quests: { main: 0, base: null, side: [], notified: {} },
      ach: {},
      stats: { gathered: {}, built: 0, builtCat: {}, earned: 0, sold: 0, helped: 0, welcomed: 0, wolves: 0, fires: 0, festivals: 0, sleeps: 0, chests: 0 },
      inv: { cos: ['hat_none', 'shirt_leaf'], hat: 'hat_none', shirt: 'shirt_leaf', tool: 0 },
      settings: { quality: DataService.autoQuality(), master: 0.8, music: 0.45, sfx: 0.8, amb: 0.7, sens: 1, names: true },
      time: { day: 1, hour: 7.2 },
      nodes: { cleared: [], dep: {} },
      zones: [], nextZone: 1,
      policies: { benefit: { on: false, mode: 'person', amount: 10, lastPaid: 0, lastShare: 0 }, build: { town: 100, villagersPaid: 0 } },
      chests: [],
      ev: { next: 330 },
      sat: {},
      player: { x: START.spawn[0], z: START.spawn[1] },
      playTime: 0, savedAt: 0, created: Date.now(), tutorial: 0,
    };
  },
  autoQuality() {
    try {
      const coarse = matchMedia('(pointer: coarse)').matches;
      const cores = navigator.hardwareConcurrency || 4;
      return coarse || cores <= 4 ? 'low' : cores <= 8 ? 'medium' : 'high';
    } catch { return 'medium'; }
  },
  read(k) { try { const v = localStorage.getItem(k); return v != null ? v : (this.mem[k] ?? null); } catch { return this.mem[k] ?? null; } },
  write(k, v) { this.mem[k] = v; try { localStorage.setItem(k, v); return true; } catch { return false; } },
  remove(k) { delete this.mem[k]; try { localStorage.removeItem(k); } catch { /* ignore */ } },
  checksum(str) { let h = 0x811c9dc5; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); } return (h >>> 0).toString(16); },
  pack() {
    S.savedAt = Date.now();
    S.player = { x: Math.round(Player.x * 10) / 10, z: Math.round(Player.z * 10) / 10 };
    NPCService.writeBack();
    ResourceService.writeBack();
    const data = JSON.stringify(S);
    return JSON.stringify({ v: 1, data, sum: this.checksum(data + SAVE_SALT) });
  },
  unpack(raw) {
    if (!raw) return null;
    try {
      const o = JSON.parse(raw);
      if (!o || typeof o.data !== 'string' || this.checksum(o.data + SAVE_SALT) !== o.sum) return null;
      return this.sanitize(JSON.parse(o.data));
    } catch { return null; }
  },
  load() {
    let st = this.unpack(this.read(this.KEY)), src = 'save';
    if (!st) { st = this.unpack(this.read(this.BAK)); src = st ? 'backup' : 'new'; }
    if (!st) st = this.defaults();
    return { state: st, source: src };
  },
  save(reason = 'auto') {
    if (!S) return false;
    let ok = false;
    try {
      const str = this.pack();
      const prev = this.read(this.KEY);
      if (prev) this.write(this.BAK, prev);
      ok = this.write(this.KEY, str);
    } catch (e) { console.error('[DataService] save failed', e); }
    this.lastSave = now(); this.dirty = false;
    if (ok) this.lastSavedAt = Date.now();
    Bus.emit('saved', { ok, reason });
    return ok;
  },
  /* never trust a save: merge onto defaults and clamp everything */
  sanitize(st) {
    const d = this.defaults();
    if (!st || typeof st !== 'object') return d;
    const num = (v, def, lo = -1e12, hi = 1e12) => (isNum(v) ? clamp(v, lo, hi) : def);
    const out = d;
    out.coins = num(st.coins, d.coins, 0);
    out.level = Math.floor(num(st.level, 1, 1, MAX_LEVEL));
    out.xp = num(st.xp, 0, 0);
    for (const k of RES_KEYS) out.res[k] = num(st.res && st.res[k], d.res[k], 0);
    if (Array.isArray(st.buildings)) {
      const seen = new Set();
      out.buildings = st.buildings.filter((b) => b && BUILDINGS[b.type] && isNum(b.x) && isNum(b.z) && isNum(b.id) && !seen.has(b.id) && seen.add(b.id))
        .map((b) => { const o = { id: b.id, type: b.type, x: clamp(b.x, -WORLD.PLAY, WORLD.PLAY), z: clamp(b.z, -WORLD.PLAY, WORLD.PLAY), rot: (b.rot | 0) & 3, damaged: !!b.damaged }; if (isNum(b.build) && b.build > 0) { o.build = clamp(b.build, 0, 600); o.buildT = clamp(num(b.buildT, o.build), o.build, 600); } if (isNum(b.zone)) o.zone = b.zone; return o; });
      if (!out.buildings.some((b) => b.type === 'home')) out.buildings.unshift(d.buildings[0]);
    }
    out.nextId = Math.max(num(st.nextId, 2), ...out.buildings.map((b) => b.id + 1));
    const areaOk = (a) => typeof a === 'string' && AREA_BY_ID[a] && !AREA_BY_ID[a].hidden;
    if (Array.isArray(st.areas)) out.areas = Array.from(new Set(['start', ...st.areas.filter(areaOk)]));
    if (Array.isArray(st.discovered)) out.discovered = Array.from(new Set(['start', ...st.discovered.filter(areaOk)]));
    const bIds = new Set(out.buildings.map((b) => b.id));
    if (Array.isArray(st.npcs)) {
      out.npcs = st.npcs.filter((n) => n && isStr(n.name) && isNum(n.id)).slice(0, 90).map((n) => ({
        id: n.id, name: String(n.name).slice(0, 24), prof: PROFS[n.prof] ? n.prof : 'villager',
        home: bIds.has(n.home) ? n.home : null, work: bIds.has(n.work) ? n.work : null,
        hunger: num(n.hunger, 20, 0, 100), happy: num(n.happy, 60, 0, 100), money: num(n.money, 20, 0, 1e6),
        look: n.look && typeof n.look === 'object' ? { skin: n.look.skin | 0, hair: n.look.hair | 0, pants: n.look.pants | 0 } : { skin: 0, hair: 0, pants: 0 },
        joined: num(n.joined, 1), req: n.req && RES_KEYS.includes(n.req.k) ? { k: n.req.k, n: num(n.req.n, 5, 1, 999), until: num(n.req.until, 0) } : null,
      }));
    }
    out.nextNpc = Math.max(num(st.nextNpc, 1), ...out.npcs.map((n) => n.id + 1), 1);
    out.usedNames = Array.isArray(st.usedNames) ? st.usedNames.filter(isStr).slice(0, 200) : [];
    if (st.quests && typeof st.quests === 'object') {
      out.quests.main = Math.floor(num(st.quests.main, 0, 0, MAIN_QUESTS.length));
      out.quests.base = st.quests.base && typeof st.quests.base === 'object' ? st.quests.base : null;
      out.quests.side = Array.isArray(st.quests.side) ? st.quests.side.filter((q) => q && isStr(q.t) && isNum(q.n)).slice(0, 3) : [];
      out.quests.notified = st.quests.notified && typeof st.quests.notified === 'object' ? st.quests.notified : {};
    }
    if (st.ach && typeof st.ach === 'object') for (const a of ACHIEVEMENTS) if (st.ach[a.id]) out.ach[a.id] = true;
    if (st.stats && typeof st.stats === 'object') {
      for (const k of Object.keys(d.stats)) if (typeof d.stats[k] === 'number') out.stats[k] = num(st.stats[k], 0, 0);
      if (st.stats.gathered) for (const k of RES_KEYS) out.stats.gathered[k] = num(st.stats.gathered[k], 0, 0);
      if (st.stats.builtCat) for (const c of BUILD_CATS) out.stats.builtCat[c.id] = num(st.stats.builtCat[c.id], 0, 0);
    }
    if (st.inv) {
      out.inv.cos = Array.from(new Set(['hat_none', 'shirt_leaf', ...(Array.isArray(st.inv.cos) ? st.inv.cos.filter((c) => COSMETICS[c]) : [])]));
      out.inv.hat = out.inv.cos.includes(st.inv.hat) && COSMETICS[st.inv.hat].slot === 'hat' ? st.inv.hat : 'hat_none';
      out.inv.shirt = out.inv.cos.includes(st.inv.shirt) && COSMETICS[st.inv.shirt].slot === 'shirt' ? st.inv.shirt : 'shirt_leaf';
      out.inv.tool = Math.floor(num(st.inv.tool, 0, 0, TOOL_TIERS.length - 1));
    }
    if (st.settings) {
      const s = st.settings;
      out.settings.quality = ['low', 'medium', 'high'].includes(s.quality) ? s.quality : d.settings.quality;
      for (const k of ['master', 'music', 'sfx', 'amb']) out.settings[k] = num(s[k], d.settings[k], 0, 1);
      out.settings.sens = num(s.sens, 1, 0.3, 2.5);
      out.settings.names = s.names !== false;
    }
    if (st.time) { out.time.day = Math.floor(num(st.time.day, 1, 1, 1e6)); out.time.hour = num(st.time.hour, 7.2, 0, 23.99); }
    if (st.nodes) {
      out.nodes.cleared = Array.isArray(st.nodes.cleared) ? st.nodes.cleared.filter(isNum) : [];
      out.nodes.dep = {};
      if (st.nodes.dep && typeof st.nodes.dep === 'object') for (const [k, v] of Object.entries(st.nodes.dep)) if (isNum(v)) out.nodes.dep[k] = clamp(v, 0, 600);
    }
    if (Array.isArray(st.zones)) out.zones = st.zones.filter((z) => z && [z.x0, z.z0, z.x1, z.z1, z.id].every(isNum) && ZONE_KINDS[z.kind]).slice(0, 12).map((z) => ({ id: z.id, x0: z.x0, z0: z.z0, x1: z.x1, z1: z.z1, kind: z.kind, paused: !!z.paused, built: num(z.built, 0, 0), last: Array.isArray(z.last) ? z.last.filter((t) => BUILDINGS[t]).slice(-3) : [] }));
    out.nextZone = Math.max(num(st.nextZone, 1), ...out.zones.map((z) => z.id + 1), 1);
    if (st.policies && st.policies.benefit) {
      const b = st.policies.benefit;
      out.policies.benefit = { on: !!b.on, mode: b.mode === 'total' ? 'total' : 'person', amount: Math.floor(num(b.amount, 10, 0, b.mode === 'total' ? 100000 : 1000)), lastPaid: num(b.lastPaid, 0, 0), lastShare: num(b.lastShare, 0, 0) };
    }
    if (st.policies && st.policies.build) out.policies.build = { town: Math.round(num(st.policies.build.town, 100, 0, 100) / 10) * 10, villagersPaid: num(st.policies.build.villagersPaid, 0, 0) };
    out.chests = Array.isArray(st.chests) ? st.chests.filter((c) => CHESTS.some((q) => q.id === c)) : [];
    out.ev.next = num(st.ev && st.ev.next, 330, 30, 2000);
    out.sat = {};
    if (st.player && isNum(st.player.x) && isNum(st.player.z)) out.player = { x: clamp(st.player.x, -WORLD.PLAY, WORLD.PLAY), z: clamp(st.player.z, -WORLD.PLAY, WORLD.PLAY) };
    out.playTime = num(st.playTime, 0, 0);
    out.savedAt = num(st.savedAt, 0, 0, 1e15);
    out.created = num(st.created, Date.now(), 0, 1e15);
    out.tutorial = num(st.tutorial, 0, 0, 99);
    return out;
  },
  exportCode() { return btoa(unescape(encodeURIComponent(this.pack()))); },
  importCode(code) {
    try {
      const raw = decodeURIComponent(escape(atob(String(code).trim())));
      if (!this.unpack(raw)) return false;
      this.write(this.KEY, raw);
      return true;
    } catch { return false; }
  },
  reset() { this.remove(this.KEY); this.remove(this.BAK); },
};

/* ---------------- EconomyService ---------------- */
const Economy = {
  incomeLog: [], lastFullWarn: {},
  cap(k) {
    let c = BASE_CAP;
    for (const b of S.buildings) { const s = BUILDINGS[b.type].storage; if (s && !(b.build > 0)) c += s; }
    return c;
  },
  amount(k) { return k === 'coins' ? S.coins : S.res[k] || 0; },
  has(cost, mult = 1) { for (const k in cost) if (this.amount(k) < Math.ceil(cost[k] * mult)) return false; return true; },
  missing(cost) { for (const k in cost) if (this.amount(k) < cost[k]) return k; return null; },
  spend(cost) {
    if (!this.has(cost)) return false;
    for (const k in cost) { if (k === 'coins') S.coins -= cost[k]; else S.res[k] -= cost[k]; }
    Bus.emit('res', {});
    DataService.dirty = true;
    return true;
  },
  /* returns how much was actually added (storage caps) */
  add(k, n, src = '', pos = null) {
    if (!(n > 0)) return 0;
    if (k === 'coins') {
      S.coins += n; S.stats.earned += n;
      this.incomeLog.push({ t: now(), n });
      Bus.emit('res', { k, n, pos, src });
      return n;
    }
    if (!(k in S.res)) return 0;
    const room = Math.max(0, this.cap(k) - S.res[k]);
    const a = Math.min(n, room);
    S.res[k] += a;
    if (a < n && now() - (this.lastFullWarn[k] || 0) > 12) { this.lastFullWarn[k] = now(); Bus.emit('toast', { icon: '📦', title: `${ITEMS[k].name} storage is full`, text: 'Build a Storage Shed or sell some.' }); }
    if (a > 0) Bus.emit('res', { k, n: a, pos, src });
    DataService.dirty = true;
    return a;
  },
  grant(reward, pos = null, src = 'reward') {
    const got = {};
    for (const k in reward) {
      if (k === 'xp') { Village.addXP(reward.xp, src, pos); got.xp = reward.xp; }
      else if (k === 'cos') { if (!S.inv.cos.includes(reward.cos)) { S.inv.cos.push(reward.cos); Bus.emit('toast', { icon: '🎁', title: 'New cosmetic!', text: COSMETICS[reward.cos].name + ' — equip it in your Inventory.' }); } }
      else got[k] = this.add(k, reward[k], src, pos);
    }
    return got;
  },
  incomePerMin() {
    const t = now();
    while (this.incomeLog.length && t - this.incomeLog[0].t > 180) this.incomeLog.shift();
    const span = Math.min(180, Math.max(30, S.playTime));
    let s = 0; for (const e of this.incomeLog) s += e.n;
    return (s / span) * 60;
  },
  eventMul(item, dir) {
    const ev = EventService.active;
    if (ev && ev.id === 'harvest' && item === 'wheat' && dir === 'sell') return 1.5;
    return 1;
  },
  sellPrice(item, shop) {
    const I = ITEMS[item], sh = SHOPS[shop] || SHOPS.cart;
    const sat = S.sat[item] || 0;
    return Math.max(1, Math.round(I.sell * sh.sellMul * (1 - sat) * this.eventMul(item, 'sell') * 100) / 100);
  },
  buyPrice(item, shop) { const I = ITEMS[item], sh = SHOPS[shop]; return Math.max(1, Math.ceil(I.buy * sh.buyMul)); },
  tick(dt) { for (const k in S.sat) { S.sat[k] = Math.max(0, S.sat[k] - dt * 0.004); if (S.sat[k] === 0) delete S.sat[k]; } },
};

/* ---------------- time of day ---------------- */
const Clock = {
  rate(h) { return h >= 6 && h < 20.5 ? 1 / 18 : 1 / 8; },
  isNight() { const h = S.time.hour; return h >= 20.5 || h < 5.6; },
  shopsOpen() { const h = S.time.hour; return h >= 6 && h < 21; },
  daylight() { const h = S.time.hour; return smoothstep(5.2, 7.2, h) * (1 - smoothstep(19.2, 21.0, h)); },
  tick(dt) {
    const before = S.time.hour;
    S.time.hour += dt * this.rate(S.time.hour);
    if (S.time.hour >= 24) { S.time.hour -= 24; S.time.day++; }
    if (before < 6 && S.time.hour >= 6) Village.newDay();
  },
};

/* ---------------- VillageService ---------------- */
const Village = {
  happyCache: { total: 50, factors: [] }, happyT: 0, arriveT: 20, discoverT: 0,
  isUnlockedIdx(idx) { const a = AREAS[idx]; return !!a && !a.hidden && S && S.areas.includes(a.id); },
  isUnlockedAt(x, z) { return this.isUnlockedIdx(areaIdxAt(x, z)); },
  population() { return S.npcs.length; },
  capacity() { let c = 0; for (const b of S.buildings) if (isActive(b)) c += BUILDINGS[b.type].house || 0; return c; },
  residentsOf(bid) { return S.npcs.filter((n) => n.home === bid); },
  workersOf(bid) { return S.npcs.filter((n) => n.work === bid); },
  title() { return levelTitle(S.level); },
  sumHappy(key) { let s = 0; for (const b of S.buildings) { if (!isActive(b)) continue; const h = BUILDINGS[b.type].happy; if (h && h[key]) s += h[key]; } return s; },
  computeHappiness() {
    const pop = this.population();
    const F = [];
    const add = (name, v, icon) => F.push({ name, v: Math.round(v), icon });
    add('Base', 35, '🙂');
    // housing quality (weighted by residents)
    let q = 0, qn = 0;
    for (const n of S.npcs) { const b = BuildingService.byId(n.home); if (b) { q += BUILDINGS[b.type].quality || 1; qn++; } }
    add('Housing', qn ? (q / qn) * 3 : 3, '🏠');
    const need = Math.max(1, pop * 2), food = S.res.food;
    add(food >= need * 2 ? 'Plenty of food' : food >= need ? 'Enough food' : food > 0 ? 'Low food' : 'Food shortage', pop === 0 ? 6 : food >= need * 2 ? 12 : food >= need ? 6 : food > 0 ? -4 : -20, '🍞');
    add('Shops', Math.min(15, this.sumHappy('shops')), '🛒');
    add('Decoration', Math.min(15, this.sumHappy('decor') + S.buildings.filter((b) => b.type === 'stone_road').length * 0.1), '🌷');
    let ent = Math.min(15, this.sumHappy('ent'));
    if (EventService.is('festival')) ent += 15;
    add('Entertainment', ent, '🎭');
    add('Safety', Math.min(10, 2 + this.sumHappy('safety')), '🛡️');
    add('Services', Math.min(20, this.sumHappy('service')), '⛲');
    if (pop > 0) {
      const unemp = S.npcs.filter((n) => !n.work).length;
      if (unemp) {
        const relief = PolicyService.relief();
        add('Unemployment', -(unemp / pop) * 12 * (1 - relief), '💼');
        if (relief > 0) add('Unemployment benefit', (unemp / pop) * 4 * relief, '🤲');
      }
    }
    const dmg = S.buildings.filter((b) => b.damaged).length; if (dmg) add('Damaged buildings', -6 * dmg, '🔥');
    if (EventService.is('rain')) add('Rainy weather', -4, '🌧️');
    if (EventService.active && EventService.active.id === 'wolves' && EventService.active.stolen) add('Wolf scare', -8, '🐺');
    const total = clamp(F.reduce((s, f) => s + f.v, 0), 0, 100);
    this.happyCache = { total, factors: F };
    return this.happyCache;
  },
  happiness() { return this.happyCache.total; },
  addXP(n, src = '', pos = null) {
    if (!(n > 0)) return;
    const boost = S.buildings.some((b) => b.type === 'library') ? 1.1 : 1;
    n = Math.round(n * boost);
    S.xp += n;
    Bus.emit('xp', { n, pos, src });
    let guard = 0;
    while (S.level < MAX_LEVEL && S.xp >= xpToNext(S.level) && guard++ < 50) {
      S.xp -= xpToNext(S.level);
      S.level++;
      const unlocks = [];
      for (const b of Object.values(BUILDINGS)) if (b.level === S.level && !b.hidden) unlocks.push({ icon: BUILD_CATS.find((c) => c.id === b.cat).icon, name: b.name });
      for (const a of AREAS) if (a.level === S.level && !a.hidden) unlocks.push({ icon: '🗺️', name: a.name + ' (area)' });
      TOOL_TIERS.forEach((t) => { if (t.level === S.level) unlocks.push({ icon: '🛠️', name: t.name }); });
      const coins = 40 * S.level;
      S.coins += coins;
      Bus.emit('levelup', { level: S.level, title: levelTitle(S.level), unlocks, coins, titleChanged: LEVEL_TITLES.some(([l]) => l === S.level) });
    }
    DataService.dirty = true;
  },
  buyArea(id) {
    const a = AREA_BY_ID[id];
    if (!a || a.hidden) return fail('Unknown area');
    if (S.areas.includes(id)) return fail('Already yours');
    if (S.level < a.level) return fail(`Reach level ${a.level} first`);
    const adjacent = a.cells.some(([cx, cz]) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dz]) => Barriers.cellUnlocked(cx + dx, cz + dz)));
    if (!adjacent) return fail('Unlock a neighbouring area first');
    if (!Economy.spend(a.cost)) return fail('Not enough ' + ITEMS[Economy.missing(a.cost)].name.toLowerCase());
    S.areas.push(id);
    this.addXP(80 + a.level * 10, 'area');
    NPCService.onLandChanged();
    Bus.emit('area', { id });
    QuestService.check();
    DataService.save('area');
    return { ok: true };
  },
  newDay() {
    const pop = this.population();
    const boost = S.buildings.reduce((s, b) => s + (BUILDINGS[b.type].taxBoost || 0), 0);
    const taxes = Math.round(pop * (3 + this.happiness() / 20) * (1 + boost));
    const xp = 10 + pop * 4;
    if (taxes > 0) Economy.add('coins', taxes, 'taxes', null);
    this.addXP(xp, 'day');
    const benefit = PolicyService.payBenefit();
    Bus.emit('newday', { day: S.time.day, taxes, xp, benefit });
    NPCService.onNewDay();
    DataService.save('day');
  },
  tick(dt) {
    this.happyT -= dt;
    if (this.happyT <= 0) { this.happyT = 2; this.computeHappiness(); }
    // arrivals: a traveler comes when there is a free home and people are happy enough
    const free = this.capacity() - this.population() - (S.candidate ? 1 : 0);
    if (free > 0 && !S.candidate && this.population() < 90) {
      this.arriveT -= dt * (this.happiness() >= 25 ? 1 : 0.2);
      if (this.arriveT <= 0) { NPCService.spawnCandidate(); this.arriveT = lerp(75, 18, this.happiness() / 100); }
    } else if (!S.candidate) this.arriveT = Math.min(this.arriveT, this.population() === 0 ? 6 : lerp(75, 18, this.happiness() / 100));
    // discovery of areas by walking in
    this.discoverT -= dt;
    if (this.discoverT <= 0) {
      this.discoverT = 1;
      const a = AREAS[areaIdxAt(Player.x, Player.z)];
      if (a && !a.hidden && S.areas.includes(a.id) && !S.discovered.includes(a.id)) {
        S.discovered.push(a.id);
        this.addXP(60, 'discover', Player.pos());
        Bus.emit('discover', { id: a.id });
      }
    }
  },
  /* offline progress: a relaxed estimate of what the village made while you were away */
  offline(sec) {
    sec = clamp(sec, 0, 2 * 3600);
    if (sec < 120 || !S.npcs.length) return null;
    const mins = sec / 60, got = {};
    const workers = S.npcs.filter((n) => n.work);
    for (const n of workers) {
      const b = BuildingService.byId(n.work); if (!b || !isActive(b)) continue;
      const cfg = BUILDINGS[b.type];
      if (cfg.produce) for (const k in cfg.produce) { if (cfg.consume) continue; got[k] = (got[k] || 0) + cfg.produce[k] * 12 * mins * 0.25; }
    }
    got.coins = (got.coins || 0) + S.npcs.length * 1.5 * mins;
    const res = {};
    for (const k in got) { const a = Economy.add(k, Math.floor(got[k]), 'offline'); if (a > 0) res[k] = a; }
    return { sec, res };
  },
};

/* ---------------- BuildingService ---------------- */
const BuildingService = {
  _byId: new Map(),
  rebuildIndex() { this._byId.clear(); for (const b of S.buildings) this._byId.set(b.id, b); },
  byId(id) { return id == null ? null : this._byId.get(id) || null; },
  count(type) { let c = 0; for (const b of S.buildings) if (b.type === type) c++; return c; },
  countAll() { let c = 0; for (const b of S.buildings) if (isCountedBuilding(b.type)) c++; return c; },
  dims(type, rot) { const [w, d] = BUILDINGS[type].size; return rot % 2 ? [d, w] : [w, d]; },
  rect(type, x, z, rot) { const [W, D] = this.dims(type, rot); return { x0: x - W / 2, x1: x + W / 2, z0: z - D / 2, z1: z + D / 2 }; },
  toWorld(b, lx, lz) { const t = b.rot * Math.PI / 2, c = Math.cos(t), s = Math.sin(t); return [b.x + lx * c + lz * s, b.z - lx * s + lz * c]; },
  door(b) {
    const d = BUILDINGS[b.type].size[1], meta = MODEL_META[b.type] || {};
    const [x, z] = this.toWorld(b, 0, meta.doorBack ? -d / 2 - 1.1 : d / 2 + 1.1);
    return { x, z };
  },
  snap(type, x, z, rot) {
    const [W, D] = this.dims(type, rot);
    if (BUILDINGS[type].road) return [Math.round((x - 2) / 4) * 4 + 2, Math.round((z - 2) / 4) * 4 + 2];
    const sx = W % 2 ? Math.floor(x) + 0.5 : Math.round(x), sz = D % 2 ? Math.floor(z) + 0.5 : Math.round(z);
    return [sx, sz];
  },
  /* the placement rules, shared by the preview and the server */
  check(type, x, z, rot, ignoreId = null) {
    const cfg = BUILDINGS[type];
    if (!cfg) return fail('Unknown building');
    const r = this.rect(type, x, z, rot);
    const [W, D] = this.dims(type, rot);
    if (!World.inPlay(r.x0, r.z0) || !World.inPlay(r.x1, r.z1)) return fail('Outside the map');
    const pts = [];
    const nx = Math.max(2, Math.ceil(W)), nz = Math.max(2, Math.ceil(D));
    for (let i = 0; i <= nx; i++) for (let j = 0; j <= nz; j++) pts.push([lerp(r.x0 + 0.1, r.x1 - 0.1, i / nx), lerp(r.z0 + 0.1, r.z1 - 0.1, j / nz)]);
    for (const [px, pz] of pts) if (!Village.isUnlockedAt(px, pz)) return fail('Outside your land');
    if (cfg.needs === 'rocky' && !pts.every(([px, pz]) => [4, 8].includes(areaIdxAt(px, pz)))) return fail('Must be in the Stone Hills or Crystal Peaks');
    let minY = 1e9, maxY = -1e9, backMax = -1e9, water = 0, frontWater = 0, frontN = 0;
    const t = rot * Math.PI / 2, fx = Math.sin(t), fz = Math.cos(t);
    for (const [px, pz] of pts) {
      if (World.bridgeAt(px, pz) != null) return fail('Not on a bridge');
      const gy = World.groundY(px, pz);
      const lz = (px - x) * fx + (pz - z) * fz; // local depth, + = front
      if (cfg.needs === 'coast') {
        if (lz < -0.5) { if (gy < 0.25) return fail('The back must stand on land'); backMax = Math.max(backMax, gy); }
        if (lz > D / 2 - 1.2 && (rot % 2 ? W : D) > 0) { frontN++; if (gy < -0.4) frontWater++; }
        continue;
      }
      if (gy < 0.2) water++;
      minY = Math.min(minY, gy); maxY = Math.max(maxY, gy);
    }
    let y;
    if (cfg.needs === 'coast') {
      if (frontWater < frontN * 0.6) return fail('The front must reach out over the sea');
      const [fcx, fcz] = [x + fx * D / 2, z + fz * D / 2];
      if (fcx < coastX(fcz) - 12) return fail('Must touch the sea');
      y = Math.max(0.9, backMax);
    } else {
      if (water > 0) return fail("Can't build in water");
      if (maxY - minY > (cfg.road ? 1.3 : 2.4)) return fail('Ground is too steep');
      y = cfg.road ? maxY - 0.04 : maxY - 0.1;
      if (cfg.needs === 'water') { const [fcx, fcz] = [x + fx * (D / 2 + 1), z + fz * (D / 2 + 1)]; if (!World.nearWater(fcx, fcz, 9)) return fail('Must be near water (front facing it)'); }
    }
    // roads, props and other buildings
    let onRoad = 0;
    for (const [px, pz] of pts) if (World.onRoad(px, pz)) onRoad++;
    if (cfg.road) { if (onRoad > pts.length * 0.5) return fail('There is already a road here'); }
    else if (onRoad > 0) return fail('Would block a road');
    const sb = World.staticBlocks.find((b) => r.x1 > b.x0 && r.x0 < b.x1 && r.z1 > b.z0 && r.z0 < b.z1);
    if (sb) return fail('Something is in the way');
    for (const b of S.buildings) {
      if (b.id === ignoreId) continue;
      const o = this.rect(b.type, b.x, b.z, b.rot);
      const m = cfg.road || BUILDINGS[b.type].road ? -0.01 : 0.15;
      if (r.x1 + m > o.x0 && r.x0 - m < o.x1 && r.z1 + m > o.z0 && r.z0 - m < o.z1) return fail('Overlaps ' + BUILDINGS[b.type].name);
    }
    for (const c of CAVES) if (Math.hypot(x - c.x, z - c.z) < 14 + Math.max(W, D) / 2) return fail('Too close to the cave');
    return { ok: true, y };
  },
  canBuild(type, cost = null) {
    const cfg = BUILDINGS[type];
    cost = cost || cfg.cost;
    if (!cfg || cfg.hidden) return fail('Unknown building');
    if (S.level < cfg.level) return fail(`Unlocks at level ${cfg.level}`);
    if (cfg.unique && this.count(type) > 0) return fail('You can only build one');
    if (cfg.needs2 && this.count(cfg.needs2) === 0) return fail('Requires a ' + BUILDINGS[cfg.needs2].name);
    if (!Economy.has(cost)) return fail('Not enough ' + ITEMS[Economy.missing(cost)].name.toLowerCase());
    return { ok: true };
  },
  place(type, x, z, rot, opts = {}) {
    // zone builds may be co-funded by the villagers (Policies > Construction funding)
    const split = opts.split || null;
    const townCost = split ? split.town : BUILDINGS[type].cost;
    const can = this.canBuild(type, townCost); if (!can.ok) return can;
    [x, z] = this.snap(type, x, z, rot);
    const chk = this.check(type, x, z, rot); if (!chk.ok) return chk;
    if (split && split.villagers > PolicyService.savings()) return fail('The villagers cannot afford their share yet');
    if (!Economy.spend(townCost)) return fail('Not enough resources');
    if (split && split.villagers > 0) PolicyService.collect(split.villagers);
    const b = { id: S.nextId++, type, x, z, rot, y: chk.y, damaged: false };
    const cfg = BUILDINGS[type];
    if (opts.zone != null) {
      const value = Object.entries(cfg.cost).reduce((s, [k, v]) => s + v * (k === 'coins' ? 1 : (ITEMS[k].buy || 1) * 0.5), 0);
      b.zone = opts.zone; b.build = b.buildT = Math.round(clamp(8 + value / 45, 10, 80));
    }
    S.buildings.push(b); this._byId.set(b.id, b);
    // clearing the land yields the resources that were standing there
    const cleared = ResourceService.clearRect(this.rect(type, x, z, rot));
    S.stats.built++;
    S.stats.builtCat[cfg.cat] = (S.stats.builtCat[cfg.cat] || 0) + 1;
    const value = Object.entries(cfg.cost).reduce((s, [k, v]) => s + v * (k === 'coins' ? 1 : (ITEMS[k].buy || 1) * 0.5), 0);
    if (!b.build) Village.addXP(cfg.road ? 1 : Math.max(8, Math.round(value / 6)), 'build', new THREE.Vector3(x, chk.y + 4, z));
    this.assignJobs();
    Bus.emit('building:placed', { b, cleared });
    NPCService.onBuildingsChanged(b);
    QuestService.check();
    DataService.dirty = true;
    return { ok: true, b };
  },
  demolish(id) {
    const b = this.byId(id);
    if (!b) return fail('Unknown building');
    if (b.type === 'home') return fail("You can't demolish your home");
    const cfg = BUILDINGS[b.type];
    const refund = {};
    for (const k in cfg.cost) refund[k] = Math.floor(cfg.cost[k] * 0.5);
    S.buildings = S.buildings.filter((q) => q !== b); this._byId.delete(id);
    for (const k in refund) Economy.add(k, refund[k], 'refund');
    Bus.emit('building:removed', { b });
    NPCService.onBuildingRemoved(b);
    NPCService.onBuildingsChanged(null);
    this.assignJobs();
    DataService.dirty = true;
    return { ok: true, refund };
  },
  move(id, x, z, rot) {
    const b = this.byId(id);
    if (!b) return fail('Unknown building');
    if (b.type === 'home') return fail('Your home stays where it is');
    [x, z] = this.snap(b.type, x, z, rot);
    const chk = this.check(b.type, x, z, rot, id); if (!chk.ok) return chk;
    b.x = x; b.z = z; b.rot = rot; b.y = chk.y;
    ResourceService.clearRect(this.rect(b.type, x, z, rot));
    Bus.emit('building:moved', { b });
    NPCService.onBuildingsChanged(b);
    DataService.dirty = true;
    return { ok: true, b };
  },
  jobSlots(b) { const j = BUILDINGS[b.type].jobs; return j && isActive(b) ? j.n : 0; },
  /* fill open job slots with unemployed residents (they retrain) */
  assignJobs() {
    const open = [];
    for (const b of S.buildings) { const n = this.jobSlots(b); if (!n) continue; const have = S.npcs.filter((p) => p.work === b.id).length; for (let i = have; i < n; i++) open.push(b); }
    for (const b of open) {
      const who = S.npcs.find((p) => !p.work);
      if (!who) break;
      who.work = b.id; who.prof = BUILDINGS[b.type].jobs.prof;
      Bus.emit('npc:job', { npc: who, b });
    }
  },
  freeHome() {
    let best = null, bq = -1;
    for (const b of S.buildings) {
      const cap = BUILDINGS[b.type].house; if (!cap || !isActive(b)) continue;
      const used = S.npcs.filter((p) => p.home === b.id).length;
      const q = BUILDINGS[b.type].quality || 1;
      if (used < cap && q > bq) { best = b; bq = q; }
    }
    return best;
  },
  initY() { for (const b of S.buildings) if (!isNum(b.y)) { const c = this.check(b.type, b.x, b.z, b.rot, b.id); b.y = c.ok ? c.y : Math.max(...[[0, 0], [1, 1], [-1, -1], [1, -1], [-1, 1]].map(([u, v]) => World.groundY(b.x + u * 2, b.z + v * 2))) - 0.1; } },
};

/* ---------------- ResourceService (gathering) ---------------- */
const ResourceService = {
  lastGather: 0,
  init() {
    const cleared = new Set(S.nodes.cleared);
    for (const n of Nodes.list) {
      n.gone = false; n.hp = NODE_TYPES[n.type].hits; n.respT = 0;
      if (cleared.has(n.id)) { Nodes.disable(n); continue; }
      const d = S.nodes.dep[n.id];
      if (d != null) { n.gone = true; n.respT = d; Nodes.setDepleted(n, true); }
    }
  },
  writeBack() {
    const dep = {};
    for (const n of Nodes.list) if (n.gone && !n.disabled && NODE_TYPES[n.type].respawn > 0) dep[n.id] = Math.round(n.respT);
    S.nodes.dep = dep;
  },
  gather(id) {
    const n = Nodes.byId.get(id);
    if (!n || n.disabled) return fail('Nothing to gather');
    if (n.gone) return fail('Already harvested — it grows back soon');
    if (!Village.isUnlockedIdx(n.area)) return fail('That area is not yours yet');
    const T = NODE_TYPES[n.type];
    if (Math.hypot(Player.x - n.x, Player.z - n.z) > 4.2 + T.r) return fail('Too far away');
    const tier = TOOL_TIERS[S.inv.tool];
    const t = now();
    if (t - this.lastGather < 0.42 / tier.speed) return fail('Too fast', { silent: true });
    this.lastGather = t;
    n.hp--;
    const pos = new THREE.Vector3(n.x, n.y + 1.6, n.z);
    const amt = Math.max(1, Math.round(T.yield * tier.mult));
    const got = {};
    got[T.res] = Economy.add(T.res, amt, 'gather', pos);
    if (T.extra) for (const k in T.extra) got[k] = Economy.add(k, T.extra[k], 'gather', pos);
    for (const k in got) S.stats.gathered[k] = (S.stats.gathered[k] || 0) + got[k];
    Village.addXP(1 + (T.xp || 0), 'gather', null);
    let depleted = false;
    if (n.hp <= 0) {
      depleted = true; n.gone = true; n.respT = T.respawn > 0 ? T.respawn * (0.85 + Math.random() * 0.3) : 1e9;
      if (T.respawn < 0) n.disabled = true;
    }
    QuestService.check();
    return { ok: true, got, depleted, node: n };
  },
  clearRect(r) {
    const got = {};
    for (const n of Nodes.near((r.x0 + r.x1) / 2, (r.z0 + r.z1) / 2, Math.hypot(r.x1 - r.x0, r.z1 - r.z0) / 2 + 2)) {
      if (n.disabled || n.type === 'fish') continue;
      if (n.x < r.x0 - 0.6 || n.x > r.x1 + 0.6 || n.z < r.z0 - 0.6 || n.z > r.z1 + 0.6) continue;
      const T = NODE_TYPES[n.type];
      if (!n.gone) got[T.res] = (got[T.res] || 0) + T.yield * n.hp;
      Nodes.disable(n);
      S.nodes.cleared.push(n.id);
    }
    const added = {};
    for (const k in got) { const a = Economy.add(k, got[k], 'clear'); if (a) added[k] = a; }
    return added;
  },
  tick(dt) {
    for (const n of Nodes.list) {
      if (!n.gone || n.disabled) continue;
      n.respT -= dt;
      if (n.respT <= 0) { n.gone = false; n.hp = NODE_TYPES[n.type].hits; Nodes.respawnFx(n); }
    }
  },
};

/* ---------------- ShopService ---------------- */
const ShopService = {
  available() {
    const list = ['cart'];
    for (const [id, sh] of Object.entries(SHOPS)) if (sh.building && S.buildings.some((b) => b.type === sh.building && isActive(b))) list.push(id);
    if (EventService.is('merchant')) list.push('merchant');
    return list;
  },
  trade({ shop, item, qty, dir }) {
    if (!isStr(shop) || !isStr(item) || !isNum(qty) || !['buy', 'sell'].includes(dir)) return fail('Bad trade');
    qty = Math.floor(qty);
    if (qty < 1 || qty > 10000) return fail('Bad amount');
    if (!this.available().includes(shop) || shop === 'merchant') return fail('That shop is not available');
    if (!Clock.shopsOpen()) return fail('Shops are closed at night');
    const sh = SHOPS[shop];
    if (!sh.items.includes(item) || !ITEMS[item]) return fail('Not sold here');
    if (dir === 'sell') {
      if (S.res[item] < qty) return fail('You don\'t have that many');
      const price = this.sellPrice(item, shop);
      const total = Math.max(1, Math.floor(price * qty));
      S.res[item] -= qty;
      Economy.add('coins', total, 'sell');
      S.stats.sold += total;
      S.sat[item] = Math.min(0.45, (S.sat[item] || 0) + qty / (ITEMS[item].sell >= 6 ? 120 : 400));
      QuestService.check();
      return { ok: true, total };
    }
    const price = Economy.buyPrice(item, shop);
    const room = Economy.cap(item) - S.res[item];
    if (room <= 0) return fail('Your storage is full');
    qty = Math.min(qty, room);
    const total = price * qty;
    if (S.coins < total) return fail('Not enough coins');
    S.coins -= total; S.res[item] += qty;
    Bus.emit('res', {});
    return { ok: true, total, qty };
  },
  sellPrice(item, shop) { return Economy.sellPrice(item, shop); },
  upgradeTool() {
    const next = TOOL_TIERS[S.inv.tool + 1];
    if (!next) return fail('Your tools are the best there are');
    if (!S.buildings.some((b) => b.type === 'blacksmith')) return fail('Requires a Blacksmith');
    if (S.level < next.level) return fail(`Reach level ${next.level} first`);
    if (!Economy.spend(next.cost)) return fail('Not enough ' + ITEMS[Economy.missing(next.cost)].name.toLowerCase());
    S.inv.tool++;
    Village.addXP(60 * S.inv.tool, 'tool');
    Bus.emit('toast', { icon: '🛠️', title: next.name + '!', text: `Gathering gives ${next.mult}x resources.` });
    return { ok: true };
  },
};

/* ---------------- QuestService ---------------- */
const QuestService = {
  counter(t, k) {
    switch (t) {
      case 'gather': return S.stats.gathered[k] || 0;
      case 'sell': return S.stats.sold;
      case 'earn': return S.stats.earned;
      case 'help': return S.stats.helped;
      case 'welcome': return S.stats.welcomed;
      case 'buildCat': return S.stats.builtCat[k] || 0;
      default: return 0;
    }
  },
  isDelta(t) { return ['gather', 'sell', 'earn', 'help', 'welcome', 'buildCat'].includes(t); },
  progress(goal, base) {
    const t = goal.t, k = goal.k;
    if (this.isDelta(t)) return this.counter(t, k) - (base || 0);
    switch (t) {
      case 'build': return BuildingService.count(k);
      case 'buildAny': return BuildingService.countAll();
      case 'residents': return Village.population();
      case 'level': return S.level;
      case 'areas': return S.areas.length;
      case 'area': return S.areas.includes(k) ? 1 : 0;
      case 'roads': return BuildingService.count(k);
      case 'roadsAny': return BuildingService.count('dirt_road') + BuildingService.count('stone_road');
      default: return 0;
    }
  },
  main() { return MAIN_QUESTS[S.quests.main] || null; },
  ensure() {
    const m = this.main();
    if (m && (!S.quests.base || S.quests.base.id !== m.id)) S.quests.base = { id: m.id, v: this.isDelta(m.goal.t) ? this.counter(m.goal.t, m.goal.k) : 0 };
    while (S.quests.side.length < 2 && S.level >= 1) S.quests.side.push(this.makeSide());
  },
  makeSide() {
    const m = this.main();
    const pool = SIDE_TEMPLATES.filter((q) => S.level >= q.lvl && !S.quests.side.some((s) => s.t === q.t && s.k === q.k) && !(m && m.goal.t === q.t && (m.goal.k || null) === (q.k || null)));
    const T = pick(pool.length ? pool : SIDE_TEMPLATES);
    const n = T.n(S.level);
    const val = 20 + S.level * 12 + n * 0.5;
    const reward = { coins: Math.round(val), xp: Math.round(25 + S.level * 8) };
    if (Math.random() < 0.3) reward[pick(['wood', 'stone', 'food'])] = 10 + S.level * 3;
    return { id: 's' + Math.floor(Math.random() * 1e9), t: T.t, k: T.k, n, title: T.title(n), base: this.isDelta(T.t) ? this.counter(T.t, T.k) : 0, reward };
  },
  list() {
    this.ensure();
    const out = [];
    const m = this.main();
    if (m) out.push({ id: m.id, main: true, title: m.title, hint: m.hint, n: m.goal.n, p: Math.min(m.goal.n, this.progress(m.goal, S.quests.base && S.quests.base.v)), reward: m.reward, mark: m.mark });
    for (const s of S.quests.side) out.push({ id: s.id, main: false, title: s.title, n: s.n, p: Math.min(s.n, this.progress(s, s.base)), reward: s.reward });
    for (const q of out) q.done = q.p >= q.n;
    return out;
  },
  claim(id) {
    if (!isStr(id)) return fail('Bad quest');
    const q = this.list().find((x) => x.id === id);
    if (!q) return fail('Unknown quest');
    if (!q.done) return fail('Not finished yet');
    if (q.main) { S.quests.main++; S.quests.base = null; }
    else S.quests.side = S.quests.side.filter((s) => s.id !== id);
    Economy.grant(q.reward, null, 'quest');
    Bus.emit('quest:claimed', q);
    this.ensure();
    DataService.dirty = true;
    return { ok: true, q };
  },
  check() {
    if (!S) return;
    for (const q of this.list()) {
      if (q.done && !S.quests.notified[q.id]) { S.quests.notified[q.id] = 1; Bus.emit('quest:ready', q); }
    }
    Bus.emit('quests', {});
  },
};

/* ---------------- AchievementService ---------------- */
const AchievementService = {
  t: 0,
  conds: {
    first_house: () => BuildingService.count('small_house') + BuildingService.count('cottage') + BuildingService.count('manor') + BuildingService.count('townhouse') > 0,
    first_resident: () => Village.population() >= 1,
    village_founder: () => S.level >= 5,
    first_shop: () => S.buildings.some((b) => BUILDINGS[b.type].cat === 'shops'),
    res10: () => Village.population() >= 10,
    coins1000: () => S.coins >= 1000,
    growing_town: () => S.level >= 10,
    lumberjack: () => (S.stats.gathered.wood || 0) >= 500,
    stonemason: () => (S.stats.gathered.stone || 0) >= 500,
    explorer: () => S.discovered.length >= 6,
    treasure: () => S.stats.chests >= 3,
    night_owl: () => S.stats.sleeps >= 1,
    wolf_hunter: () => S.stats.wolves >= 5,
    firefighter: () => S.stats.fires >= 1,
    helper: () => S.stats.helped >= 10,
    happy: () => Village.population() >= 10 && Village.happiness() >= 85,
    master_builder: () => BuildingService.countAll() >= 50,
    metropolis: () => S.level >= 20,
    rich: () => S.coins >= 10000,
    b100: () => BuildingService.countAll() >= 100,
    grand_city: () => S.level >= 30,
  },
  tick(dt) {
    this.t -= dt; if (this.t > 0) return; this.t = 1.5;
    for (const a of ACHIEVEMENTS) {
      if (S.ach[a.id]) continue;
      const c = this.conds[a.id];
      if (c && c()) { S.ach[a.id] = true; Economy.grant(a.reward, null, 'achievement'); Bus.emit('achievement', a); DataService.dirty = true; }
    }
  },
};

/* ---------------- PolicyService: village rules you can switch on ---------------- */
const PolicyService = {
  /* how many coins each jobless villager gets per day under the current settings */
  shareFor(jobless) {
    const b = S.policies.benefit;
    if (!b.on || !jobless) return 0;
    return b.mode === 'person' ? b.amount : Math.floor(b.amount / jobless);
  },
  /* 0..1: how much the benefit takes away the unhappiness of being jobless (15+ coins/day = fully) */
  relief() { const b = S.policies.benefit; return b.on && b.lastPaid >= S.time.day - 1 ? clamp(b.lastShare / 15, 0, 1) : 0; },
  payBenefit() {
    const b = S.policies.benefit;
    if (!b.on) return null;
    const jobless = S.npcs.filter((n) => !n.work);
    if (!jobless.length) { b.lastShare = 0; return { paid: 0, people: 0 }; }
    let share = this.shareFor(jobless.length);
    let short = false;
    if (share * jobless.length > S.coins) { share = Math.floor(S.coins / jobless.length); short = true; }
    const paid = share * jobless.length;
    S.coins -= paid;
    for (const n of jobless) { n.money += share; n.happy = Math.min(100, n.happy + Math.min(10, share / 1.5)); }
    b.lastPaid = S.time.day; b.lastShare = share;
    Bus.emit('res', {});
    return { paid, people: jobless.length, share, short };
  },
  /* construction funding: the town pays town% of each zone build, villagers pay the rest from their savings.
     Materials the town does not supply are bought by the villagers at 80% of the shop price. */
  splitCost(cost) {
    const t = S.policies.build.town / 100;
    const town = {}; let villagers = 0;
    for (const k in cost) {
      const tv = Math.ceil(cost[k] * t);
      if (tv > 0) town[k] = tv;
      const rest = cost[k] - tv;
      villagers += k === 'coins' ? rest : rest * (ITEMS[k].buy || 4) * 0.8;
    }
    return { town, villagers: Math.ceil(villagers) };
  },
  savings() { return Math.floor(S.npcs.reduce((s, n) => s + n.money, 0)); },
  /* take the villagers' share, richest first, so nobody is left with nothing */
  collect(amount) {
    const total = this.savings(); if (amount <= 0 || total <= 0) return;
    for (const n of S.npcs) n.money = Math.max(0, n.money - amount * (n.money / total));
    S.policies.build.villagersPaid += amount;
  },
  setBuild(p) {
    if (isNum(p.town)) S.policies.build.town = clamp(Math.round(p.town / 10) * 10, 0, 100);
    DataService.dirty = true;
    return { ok: true };
  },
  set(p) {
    const b = S.policies.benefit;
    if (typeof p.on === 'boolean') b.on = p.on;
    if (p.mode === 'person' || p.mode === 'total') b.mode = p.mode;
    if (isNum(p.amount)) b.amount = Math.floor(clamp(p.amount, 0, b.mode === 'total' ? 100000 : 1000));
    DataService.dirty = true;
    return { ok: true };
  },
};

/* ---------------- misc remotes ---------------- */
const MiscService = {
  openChest(id) {
    const c = Chests.list.find((q) => q.id === id);
    if (!c) return fail('Unknown chest');
    if (S.chests.includes(id)) return fail('Already opened');
    if (Math.hypot(Player.x - c.x, Player.z - c.z) > 4) return fail('Too far away');
    S.chests.push(id); S.stats.chests++;
    Economy.grant(c.reward, new THREE.Vector3(c.x, 2, c.z), 'chest');
    Village.addXP(50, 'chest', new THREE.Vector3(c.x, 2.5, c.z));
    DataService.dirty = true;
    return { ok: true, reward: c.reward };
  },
  sleep() {
    const home = S.buildings.find((b) => b.type === 'home');
    if (Math.hypot(Player.x - home.x, Player.z - home.z) > 9) return fail('Go to your home to sleep');
    const h = S.time.hour;
    if (!(h >= 19 || h < 5)) return fail('You can only sleep in the evening or at night');
    if (h >= 19) S.time.day++;
    S.time.hour = 6.0;
    S.stats.sleeps++;
    Village.newDay();
    NPCService.onSleep();
    return { ok: true };
  },
  equip(id) {
    if (!isStr(id) || !COSMETICS[id] || !S.inv.cos.includes(id)) return fail('You don\'t own that');
    S.inv[COSMETICS[id].slot] = id;
    Bus.emit('look', {});
    DataService.dirty = true;
    return { ok: true };
  },
  settings(p) {
    const s = S.settings;
    if (['low', 'medium', 'high'].includes(p.quality)) s.quality = p.quality;
    for (const k of ['master', 'music', 'sfx', 'amb']) if (isNum(p[k])) s[k] = clamp(p[k], 0, 1);
    if (isNum(p.sens)) s.sens = clamp(p.sens, 0.3, 2.5);
    if (typeof p.names === 'boolean') s.names = p.names;
    DataService.dirty = true;
    return { ok: true };
  },
};

function registerRemotes() {
  Remote.handle('Gather', (a) => (isNum(a.id) ? ResourceService.gather(a.id) : fail('Bad node')));
  Remote.handle('PlaceBuilding', (a) => (isStr(a.type) && isNum(a.x) && isNum(a.z) && isNum(a.rot) ? BuildingService.place(a.type, a.x, a.z, (a.rot | 0) & 3) : fail('Bad request')), 0.05);
  Remote.handle('MoveBuilding', (a) => (isNum(a.id) && isNum(a.x) && isNum(a.z) && isNum(a.rot) ? BuildingService.move(a.id, a.x, a.z, (a.rot | 0) & 3) : fail('Bad request')), 0.2);
  Remote.handle('Demolish', (a) => (isNum(a.id) ? BuildingService.demolish(a.id) : fail('Bad request')), 0.3);
  Remote.handle('BuyArea', (a) => (isStr(a.id) ? Village.buyArea(a.id) : fail('Bad request')), 0.5);
  Remote.handle('Trade', (a) => ShopService.trade(a), 0.08);
  Remote.handle('UpgradeTool', () => ShopService.upgradeTool(), 0.5);
  Remote.handle('ClaimQuest', (a) => QuestService.claim(a.id), 0.2);
  Remote.handle('Welcome', () => NPCService.welcome(), 0.5);
  Remote.handle('HelpNPC', (a) => (isNum(a.id) ? NPCService.help(a.id) : fail('Bad request')), 0.3);
  Remote.handle('OpenChest', (a) => MiscService.openChest(a.id), 0.5);
  Remote.handle('Sleep', () => MiscService.sleep(), 1);
  Remote.handle('Equip', (a) => MiscService.equip(a.id), 0.1);
  Remote.handle('Settings', (a) => MiscService.settings(a), 0);
  Remote.handle('Extinguish', (a) => EventService.extinguish(a.dt), 0);
  Remote.handle('Repair', (a) => (isNum(a.id) ? EventService.repair(a.id) : fail('Bad request')), 0.5);
  Remote.handle('HitWolf', (a) => (isNum(a.id) ? EventService.hitWolf(a.id) : fail('Bad request')), 0.3);
  Remote.handle('Pickup', (a) => (isNum(a.id) ? EventService.pickup(a.id) : fail('Bad request')), 0.4);
  Remote.handle('MerchantDeal', (a) => (isNum(a.i) ? EventService.buyDeal(a.i) : fail('Bad request')), 0.3);
  Remote.handle('GreetVisitor', () => EventService.greet(), 1);
  Remote.handle('SetPolicy', (a) => PolicyService.set(a), 0);
  Remote.handle('SetBuildPolicy', (a) => PolicyService.setBuild(a), 0);
  Remote.handle('CreateZone', (a) => ZoneService.create(a), 0.3);
  Remote.handle('ToggleZone', (a) => (isNum(a.id) ? ZoneService.toggle(a.id) : fail('Bad request')), 0.2);
  Remote.handle('RemoveZone', (a) => (isNum(a.id) ? ZoneService.remove(a.id) : fail('Bad request')), 0.2);
}

/* the server heartbeat: fixed small steps, independent of rendering */
const Server = {
  acc: 0, prodT: 0, saveT: 0,
  tick(dt) {
    S.playTime += dt;
    Clock.tick(dt);
    Economy.tick(dt);
    Village.tick(dt);
    ResourceService.tick(dt);
    NPCService.tick(dt);
    EventService.tick(dt);
    ZoneService.tick(dt);
    AchievementService.tick(dt);
    this.prodT -= dt;
    if (this.prodT <= 0) { this.prodT = 5; NPCService.productionTick(); QuestService.check(); }
    this.saveT += dt;
    if (this.saveT > 30) { this.saveT = 0; DataService.save('auto'); }
  },
};
