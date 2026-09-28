/* =====================================================================
   BUILD ZONES — mark an area, villagers build there by themselves.
   ZoneService (server) plans what the village needs, reserves a spot,
   pays from the treasury (keeping a reserve) and opens a construction
   site. Villagers walk over and hammer; helpers speed it up.
   ZoneCtl / ZoneRender (client) draw zones and construction labels.
   ===================================================================== */
const ZONE_KINDS = {
  homes: { name: 'Homes', icon: '🏠', col: 0xf2b33d, desc: 'Houses for new residents, with a few flowers and lanterns.' },
  work: { name: 'Work', icon: '🪓', col: 0xc98a4c, desc: 'Workplaces for whatever the village is short of: food, wood, stone or storage.' },
  market: { name: 'Market', icon: '🛒', col: 0x5fb3d6, desc: 'Shops, a tavern and an inn.' },
  park: { name: 'Park', icon: '🌷', col: 0x7fd17a, desc: 'Trees, flower beds, benches, fountains and statues.' },
  auto: { name: 'Anything', icon: '✨', col: 0xb28dff, desc: 'Villagers decide for themselves what the village needs most.' },
};
const ZONE_RESERVE = 0.2; // share of each storage cap the builders never spend

const ZoneService = {
  t: 3, helpT: 0, status: {},
  sites() { return S.buildings.filter((b) => b.build > 0); },
  reserve(k) { return k === 'coins' ? 100 : Economy.cap(k) * ZONE_RESERVE; },
  affordable(cost) { for (const k in cost) if (Economy.amount(k) - cost[k] < this.reserve(k)) return false; return true; },
  buildable(type) { const c = BuildingService.canBuild(type); return c.ok && this.affordable(BUILDINGS[type].cost); },
  /* what should go into this zone next? returns an ordered list of candidate types */
  plan(z) {
    const pop = Village.population(), freeHomes = Village.capacity() - pop;
    const unemployed = S.npcs.filter((n) => !n.work).length;
    const houses = ['apartments', 'villa', 'townhouse', 'tower_house', 'row_houses', 'manor', 'farmhouse', 'cottage', 'log_cabin', 'small_house'];
    const inZone = (t) => S.buildings.filter((b) => b.zone === z.id && b.type === t).length;
    const byNeed = () => {
      const L = [];
      const full = RES_KEYS.some((k) => S.res[k] >= Economy.cap(k) * 0.85);
      if (full) L.push('warehouse', 'granary', 'storage_shed');
      if (S.res.food < Math.max(20, pop * 4)) L.push('greenhouse', 'dairy_farm', 'bakery', 'orchard', 'fisher_hut', 'chicken_coop', 'farm');
      if (S.res.wheat < 20 && BuildingService.count('bakery')) L.push('large_farm', 'farm');
      if (S.res.wood < Economy.cap('wood') * 0.4) L.push('lumber_camp', 'woodcutter');
      if (S.res.stone < Economy.cap('stone') * 0.4) L.push('quarry_works', 'stonecutter', 'mine');
      if (BuildingService.count('farm') + BuildingService.count('large_farm') >= 2 && !BuildingService.count('windmill')) L.push('windmill');
      if (S.res.iron > 40 && !BuildingService.count('blacksmith')) L.push('blacksmith');
      if (unemployed) L.push('vineyard', 'sheep_pasture', 'lumber_camp', 'woodcutter', 'farm', 'beehives', 'stonecutter', 'fisher_hut', 'workshop', 'sawmill', 'guard_tower');
      return L;
    };
    const shops = ['bank', 'large_market', 'theater', 'marketplace', 'apothecary', 'tailor', 'post_office', 'general_store', 'bakery', 'butcher', 'pottery', 'market_stall', 'tavern', 'inn', 'blacksmith'].filter((t) => BUILDINGS[t].unique || BuildingService.count(t) < 2);
    const park = ['statue', 'obelisk', 'fountain', 'gazebo', 'garden_pond', 'topiary', 'rose_arch', 'bonfire', 'market_cart', 'flag_pole', 'hedge', 'planted_tree', 'flower_bed', 'bench', 'lantern', 'planted_tree', 'flower_bed'];
    let kind = z.kind;
    if (kind === 'auto') kind = freeHomes < 2 ? 'homes' : unemployed > 0 || byNeed().length ? 'work' : BuildingService.count('general_store') + BuildingService.count('market_stall') < Math.ceil(pop / 6) ? 'market' : 'park';
    if (kind === 'homes') {
      if (freeHomes >= 3) return inZone('lantern') < inZone('small_house') + inZone('cottage') ? ['lantern', 'flower_bed', 'bench'] : ['flower_bed', 'planted_tree'];
      return houses;
    }
    if (kind === 'work') return byNeed().concat(['woodcutter', 'stonecutter', 'farm']);
    if (kind === 'market') return shops;
    return park.sort(() => Math.random() - 0.5).concat(['statue', 'fountain']);
  },
  /* first free spot inside the zone, packed from one corner, with a walkway around it */
  findSpot(z, type) {
    const cfg = BUILDINGS[type];
    const cx = (z.x0 + z.x1) / 2, cz = (z.z0 + z.z1) / 2;
    const rots = [0, 2, 1, 3];
    const pad = cfg.cat === 'decor' ? 0.6 : 1.6;
    for (let zz = z.z0; zz <= z.z1; zz += 1.5) for (let xx = z.x0; xx <= z.x1; xx += 1.5) {
      for (const rot of rots) {
        const [W, D] = BuildingService.dims(type, rot);
        const [x, zc] = BuildingService.snap(type, xx + W / 2, zz + D / 2, rot);
        const r = BuildingService.rect(type, x, zc, rot);
        if (r.x0 < z.x0 || r.x1 > z.x1 || r.z0 < z.z0 || r.z1 > z.z1) continue;
        const c = BuildingService.check(type, x, zc, rot);
        if (!c.ok) continue;
        const crowded = S.buildings.some((b) => { if (BUILDINGS[b.type].road) return false; const o = BuildingService.rect(b.type, b.x, b.z, b.rot); return r.x1 + pad > o.x0 && r.x0 - pad < o.x1 && r.z1 + pad > o.z0 && r.z0 - pad < o.z1; });
        if (crowded) continue;
        const d = BuildingService.door({ type, x, z: zc, rot });
        if (World.isWater(d.x, d.z) || World.blockedStatic(d.x, d.z, 0.3)) continue;
        return { x, z: zc, rot, dist: Math.hypot(x - cx, zc - cz) };
      }
    }
    return null;
  },
  tick(dt) {
    // construction progress
    for (const b of S.buildings) {
      if (!(b.build > 0)) continue;
      let helpers = 0;
      for (const r of NPCService.rt.values()) if (r.site === b.id && r.state === 'work' && Math.hypot(r.ent.x - b.x, r.ent.z - b.z) < Math.max(...BUILDINGS[b.type].size) / 2 + 4) helpers++;
      b.helpers = helpers;
      b.build = Math.max(0, b.build - dt * (0.35 + helpers * 0.65));
      if (b.build === 0) this.complete(b);
    }
    // recruit helpers
    this.helpT -= dt;
    if (this.helpT <= 0) { this.helpT = 2.5; this.recruit(); }
    // plan new sites
    this.t -= dt;
    if (this.t > 0) return;
    this.t = 6;
    if (this.sites().length >= 2) return;
    for (const z of S.zones) {
      if (z.paused) { this.status[z.id] = 'Paused'; continue; }
      if (S.buildings.some((b) => b.zone === z.id && b.build > 0)) continue;
      const wants = this.plan(z);
      let why = 'Waiting for resources (builders keep a 20% reserve)';
      let started = false;
      for (const type of wants) {
        if (!BUILDINGS[type] || S.level < BUILDINGS[type].level) continue;
        const split = PolicyService.splitCost(BUILDINGS[type].cost);
        const can = BuildingService.canBuild(type, split.town);
        if (!can.ok) { if (/^Not enough/.test(can.err)) why = `Saving up for a ${BUILDINGS[type].name}`; continue; }
        if (!this.affordable(split.town)) { why = `Saving up for a ${BUILDINGS[type].name}`; continue; }
        if (split.villagers > PolicyService.savings()) { why = `Villagers are saving for their share of a ${BUILDINGS[type].name} (${fmt(PolicyService.savings())}/${fmt(split.villagers)} 🪙)`; continue; }
        const spot = this.findSpot(z, type);
        if (!spot) { why = 'No room left for a ' + BUILDINGS[type].name; continue; }
        const r = BuildingService.place(type, spot.x, spot.z, spot.rot, { zone: z.id, split });
        if (r.ok) { started = true; z.built = (z.built || 0) + 1; this.status[z.id] = 'Building a ' + BUILDINGS[type].name; Bus.emit('zone:site', { z, b: r.b }); break; }
      }
      if (!started) this.status[z.id] = why;
      if (this.sites().length >= 2) break;
    }
  },
  recruit() {
    const blk = scheduleBlock(S.time.hour);
    if (blk === 'sleep') return;
    for (const b of this.sites()) {
      let have = 0;
      for (const r of NPCService.rt.values()) if (r.site === b.id && (r.state === 'work' || (r.state === 'walk' && r.goal === 'build'))) have++;
      if (have >= 3) continue;
      const cands = [...NPCService.rt.values()].filter((r) => !r.cand && !r.leaving && !r.ent.hidden && r.state !== 'chat' && r.site !== b.id
        && (r.n.prof === 'builder' || !r.n.work || blk === 'evening' || blk === 'morning')
        && (r.state === 'idle' || r.state === 'sit' || (r.state === 'walk' && ['wander', 'square', 'sit'].includes(r.goal))));
      cands.sort((p, q) => (p.n.prof === 'builder' ? -50 : 0) + Math.hypot(p.ent.x - b.x, p.ent.z - b.z) - ((q.n.prof === 'builder' ? -50 : 0) + Math.hypot(q.ent.x - b.x, q.ent.z - b.z)));
      const r = cands[0];
      if (!r) continue;
      const [W, D] = BuildingService.dims(b.type, b.rot), a = Math.random() * TAU, rr = Math.max(W, D) / 2 + 1.2;
      r.site = b.id;
      if (r.state === 'sit') r.ent.anim.act = 0;
      NPCService.goTo(r, b.x + Math.cos(a) * rr, b.z + Math.sin(a) * rr, 'build', { x: b.x, z: b.z });
      r.ent.bubble = { text: '🔨', t: 2 };
    }
  },
  complete(b) {
    b.build = 0; delete b.buildT; delete b.helpers;
    const cfg = BUILDINGS[b.type];
    const value = Object.entries(cfg.cost).reduce((s, [k, v]) => s + v * (k === 'coins' ? 1 : (ITEMS[k].buy || 1) * 0.5), 0);
    Village.addXP(Math.max(8, Math.round(value / 6)), 'build', new THREE.Vector3(b.x, b.y + 4, b.z));
    for (const r of NPCService.rt.values()) if (r.site === b.id) { r.site = null; if (r.state === 'work') { r.until = 0; r.ent.anim.act = 2; r.ent.bubble = { text: '🎉', t: 2 }; } }
    BuildingService.assignJobs();
    const z = S.zones.find((q) => q.id === b.zone);
    if (z) this.status[z.id] = 'Finished a ' + cfg.name;
    Bus.emit('building:done', { b });
    QuestService.check();
    DataService.dirty = true;
  },
  create({ x0, z0, x1, z1, kind }) {
    if (![x0, z0, x1, z1].every(isNum) || !ZONE_KINDS[kind]) return fail('Bad zone');
    [x0, x1] = [Math.min(x0, x1), Math.max(x0, x1)]; [z0, z1] = [Math.min(z0, z1), Math.max(z0, z1)];
    x0 = Math.round(x0); z0 = Math.round(z0); x1 = Math.round(x1); z1 = Math.round(z1);
    if (x1 - x0 < 8 || z1 - z0 < 8) return fail('Make the zone at least 8 × 8');
    if (x1 - x0 > 70 || z1 - z0 > 70) return fail('Keep the zone under 70 × 70');
    if (S.zones.length >= 12) return fail('You can have up to 12 zones');
    let inside = 0, n = 0;
    for (let x = x0; x <= x1; x += 2) for (let z = z0; z <= z1; z += 2) { n++; if (Village.isUnlockedAt(x, z)) inside++; }
    if (inside < n * 0.6) return fail('Most of the zone must be on your own land');
    if (S.zones.some((q) => x1 > q.x0 && x0 < q.x1 && z1 > q.z0 && z0 < q.z1)) return fail('Zones cannot overlap');
    const z = { id: S.nextZone++, x0, z0, x1, z1, kind, paused: false, built: 0 };
    S.zones.push(z);
    this.status[z.id] = 'Planning…';
    this.t = Math.min(this.t, 1);
    Bus.emit('zones', {});
    DataService.dirty = true;
    return { ok: true, z };
  },
  toggle(id) { const z = S.zones.find((q) => q.id === id); if (!z) return fail('Unknown zone'); z.paused = !z.paused; this.status[z.id] = z.paused ? 'Paused' : 'Planning…'; Bus.emit('zones', {}); return { ok: true }; },
  remove(id) {
    const z = S.zones.find((q) => q.id === id); if (!z) return fail('Unknown zone');
    S.zones = S.zones.filter((q) => q !== z);
    for (const b of S.buildings) if (b.zone === id) delete b.zone;
    Bus.emit('zones', {});
    return { ok: true };
  },
};

/* ---------------- client: drawing + showing zones ---------------- */
const ZoneRender = {
  group: null, meshes: new Map(), pool: [],
  init(scene) { this.group = new THREE.Group(); scene.add(this.group); this.preview = null; this.rebuild(); },
  surface(x0, z0, x1, z1, col, fillOp, lineOp) {
    const grp = new THREE.Group();
    const nx = Math.max(2, Math.ceil((x1 - x0) / 2)), nz = Math.max(2, Math.ceil((z1 - z0) / 2));
    const g = new THREE.PlaneGeometry(1, 1, nx, nz); g.rotateX(-Math.PI / 2);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = x0 + (p.getX(i) + 0.5) * (x1 - x0), z = z0 + (p.getZ(i) + 0.5) * (z1 - z0); p.setXYZ(i, x, Math.max(World.heightAt(x, z), 0) + 0.18, z); }
    g.computeBoundingSphere();
    const fill = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: fillOp, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }));
    fill.renderOrder = 2; grp.add(fill);
    const pts = [];
    const edge = (ax, az, bx, bz) => { const n = Math.ceil(Math.hypot(bx - ax, bz - az) / 1.5); for (let i = 0; i < n; i++) { const x = lerp(ax, bx, i / n), z = lerp(az, bz, i / n); pts.push(new THREE.Vector3(x, Math.max(World.heightAt(x, z), 0) + 0.3, z)); } };
    edge(x0, z0, x1, z0); edge(x1, z0, x1, z1); edge(x1, z1, x0, z1); edge(x0, z1, x0, z0);
    const line = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: col, transparent: true, opacity: lineOp }));
    line.renderOrder = 3; grp.add(line);
    return grp;
  },
  rebuild() {
    for (const m of this.meshes.values()) { this.group.remove(m); m.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); }); }
    this.meshes.clear();
    for (const z of S.zones) { const m = this.surface(z.x0, z.z0, z.x1, z.z1, ZONE_KINDS[z.kind].col, z.paused ? 0.06 : 0.13, z.paused ? 0.35 : 0.8); this.group.add(m); this.meshes.set(z.id, m); }
  },
  showPreview(r, ok, kind) {
    if (this.preview) { this.group.remove(this.preview); this.preview.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); }); this.preview = null; }
    if (!r) return;
    this.preview = this.surface(r.x0, r.z0, r.x1, r.z1, ok ? ZONE_KINDS[kind].col : 0xff5a5a, 0.28, 1);
    this.group.add(this.preview);
  },
  /* floating "🏗️ 40%" chips over construction sites */
  labels(camera) {
    const layer = $('#labels'), v = new THREE.Vector3();
    let k = 0;
    for (const b of S.buildings) {
      if (!(b.build > 0) || Math.hypot(b.x - Player.x, b.z - Player.z) > 70) continue;
      v.set(b.x, b.y + Models.get(b.type).height * 0.5 + 2.4, b.z).project(camera);
      if (v.z > 1 || Math.abs(v.x) > 1.1 || Math.abs(v.y) > 1.1) continue;
      let el = this.pool[k];
      if (!el) { el = h('div', 'site'); layer.appendChild(el); this.pool[k] = el; }
      const p = Math.round((1 - b.build / (b.buildT || 1)) * 100);
      el.innerHTML = `<b>🏗️ ${esc(BUILDINGS[b.type].name)}</b><i><i style="width:${p}%"></i></i><small>${p}% · ${b.helpers || 0} helping</small>`;
      el.style.display = '';
      el.style.transform = `translate(${((v.x + 1) / 2) * innerWidth}px, ${((1 - v.y) / 2) * innerHeight}px) translate(-50%, -100%)`;
      k++;
    }
    for (let i = k; i < this.pool.length; i++) this.pool[i].style.display = 'none';
  },
};

const ZoneCtl = {
  active: false, kind: 'homes', a: null, b: null, pending: null, dragging: false,
  start(kind) {
    if (BuildCtl.active) BuildCtl.cancel();
    this.active = true; this.kind = kind; this.a = this.b = this.pending = null; this.dragging = false;
    UI.closePanels();
    UI.zoneBar(true, kind);
    CameraCtl.tDist = Math.max(CameraCtl.tDist, 42); CameraCtl.pitch = Math.max(CameraCtl.pitch, 0.95);
    Audio.sfx('open');
  },
  cancel() { if (!this.active) return; this.active = false; ZoneRender.showPreview(null); UI.zoneBar(false); },
  rect() { if (!this.a || !this.b) return null; return { x0: Math.min(this.a.x, this.b.x), x1: Math.max(this.a.x, this.b.x), z0: Math.min(this.a.z, this.b.z), z1: Math.max(this.a.z, this.b.z) }; },
  refresh() {
    const r = this.rect();
    if (!r) { ZoneRender.showPreview(null); UI.zoneStatus(this.a ? 'Now pick the opposite corner' : (document.body.classList.contains('touch') ? 'Tap one corner of the area' : 'Drag across the ground, or click two corners'), true); return; }
    const w = Math.round(r.x1 - r.x0), d = Math.round(r.z1 - r.z0);
    let ok = w >= 8 && d >= 8 && w <= 70 && d <= 70, msg = `${w} × ${d}`;
    if (w < 8 || d < 8) msg += ' · too small (min 8 × 8)'; else if (w > 70 || d > 70) msg += ' · too big (max 70 × 70)';
    else if (S.zones.some((q) => r.x1 > q.x0 && r.x0 < q.x1 && r.z1 > q.z0 && r.z0 < q.z1)) { ok = false; msg += ' · overlaps another zone'; }
    ZoneRender.showPreview(r, ok, this.kind);
    UI.zoneStatus(msg, ok);
  },
  onDown(sx, sy) { const g = Game.pickGround(sx, sy); this.pending = g ? { x: g.x, z: g.z } : null; },
  onDrag(sx, sy) {
    const g = Game.pickGround(sx, sy); if (!g || !this.pending) return true;
    if (!this.dragging) { this.dragging = true; this.a = this.pending; }
    this.b = { x: g.x, z: g.z }; this.refresh();
    return true;
  },
  onUp() { if (this.dragging) { this.dragging = false; this.finish(); } },
  onHover(sx, sy) { if (!this.a || this.dragging || document.body.classList.contains('touch')) return; const g = Game.pickGround(sx, sy); if (g) { this.b = { x: g.x, z: g.z }; this.refresh(); } },
  onClick(sx, sy, button) {
    if (button === 2) return this.cancel();
    const g = Game.pickGround(sx, sy); if (!g) return;
    if (!this.a || (this.a && this.b && !document.body.classList.contains('touch') && this._done)) { this._done = false; this.a = { x: g.x, z: g.z }; this.b = null; this.refresh(); return; }
    this.b = { x: g.x, z: g.z }; this.refresh();
    if (!document.body.classList.contains('touch')) this.finish();
  },
  finish() {
    const r = this.rect(); if (!r) return;
    const res = Remote.invoke('CreateZone', { ...r, kind: this.kind });
    if (!res.ok) { UI.zoneStatus(res.err, false); Audio.sfx('error'); this.a = this.b = null; this._done = true; return; }
    Audio.sfx('place');
    UI.toast({ icon: ZONE_KINDS[this.kind].icon, title: ZONE_KINDS[this.kind].name + ' zone marked', text: 'Villagers will start building here when the village can afford it.' });
    this.cancel();
  },
};
