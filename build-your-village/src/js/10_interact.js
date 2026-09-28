/* =====================================================================
   CLIENT: interaction prompts, gathering loop and click targets
   ===================================================================== */
const FX_COLORS = {
  wood: [0x9c6b3f, 0xc49a66, 0x6fb34a], leaf_autumn: [0xe0892f, 0xe8b04a, 0x9c6b3f], stone: [0x9a9890, 0xbdbab2, 0x77756e], iron: [0x77746d, 0xc9703a, 0x9a9890],
  gold: [0xf2c230, 0xfff1a8, 0x7d7a74], wheat: [0xe7c85c, 0xc9ab4a, 0xfff1a8], berry: [0xd23b4a, 0x4f8a37, 0xf28bb0], water: [0xbfeaff, 0x7fd0ec, 0xffffff], crystal: [0x7fe3ff, 0xffffff, 0xb28dff],
};
const Interact = {
  target: null, scanT: 0, gathering: null, gatherT: 0, holding: false, holdP: 0,
  busy() { return false; },
  cancelAuto() { if (this.gathering) this.stopGather(); },
  candidates() {
    const px = Player.x, pz = Player.z, out = [];
    const face = (x, z) => { const a = Math.atan2(x - px, z - pz); let d = a - Player.ent.yaw; while (d > Math.PI) d -= TAU; while (d < -Math.PI) d += TAU; return Math.abs(d); };
    const push = (o, dist, prio = 0) => { o.score = dist + face(o.x, o.z) * 0.6 - prio; out.push(o); };
    // event actors
    for (const w of EventService.wolves) { const d = Math.hypot(w.x - px, w.z - pz); if (d < 4 && w.hp > 0) push({ kind: 'wolf', ref: w, x: w.x, y: w.y + 1.4, z: w.z, label: 'Chase away the wolf' }, d, 10); }
    for (const p of EventService.pickups) { const d = Math.hypot(p.x - px, p.z - pz); if (d < 3) push({ kind: 'pickup', ref: p, x: p.x, y: p.y + 1.6, z: p.z, label: 'Collect Star Fragment' }, d, 3); }
    const ev = EventService.active;
    if (ev && ev.id === 'fire' && ev.b && !ev.done) {
      const b = BuildingService.byId(ev.b);
      if (b) { const r = BuildingService.rect(b.type, b.x, b.z, b.rot); const d = Math.hypot(Math.max(r.x0 - px, 0, px - r.x1), Math.max(r.z0 - pz, 0, pz - r.z1)); if (d < 3.2) push({ kind: 'fire', ref: b, x: b.x, y: b.y + 3, z: b.z, label: 'Hold to put out the fire', hold: true }, d, 12); }
    }
    for (const a of EventService.actors) { const d = Math.hypot(a.ent.x - px, a.ent.z - pz); if (d < 3.4) push({ kind: a.kind, ref: a, x: a.ent.x, y: a.ent.y + 2.3, z: a.ent.z, label: a.kind === 'merchant' ? 'Trade with the merchant' : 'Greet the visitor' }, d, 6); }
    // villagers
    for (const r of NPCService.rt.values()) {
      if (r.ent.hidden || r.leaving) continue;
      const d = Math.hypot(r.ent.x - px, r.ent.z - pz); if (d > 2.8) continue;
      if (r.cand) push({ kind: 'welcome', ref: r, x: r.ent.x, y: r.ent.y + 2.3, z: r.ent.z, label: 'Welcome ' + r.n.name.split(' ')[0] }, d, 8);
      else push({ kind: 'npc', ref: r, x: r.ent.x, y: r.ent.y + 2.3, z: r.ent.z, label: (r.n.req ? 'Help ' : 'Talk to ') + r.n.name.split(' ')[0] }, d, r.n.req ? 4 : 1);
    }
    // world props
    for (const c of Chests.list) { if (c.opened) continue; const d = Math.hypot(c.x - px, c.z - pz); if (d < 2.8) push({ kind: 'chest', ref: c, x: c.x, y: World.groundY(c.x, c.z) + 1.4, z: c.z, label: 'Open treasure chest' }, d, 5); }
    for (const p of Props.interact) { const d = Math.hypot(p.x - px, p.z - pz); if (d < p.r) push({ kind: p.kind, ref: p, x: p.x, y: World.groundY(p.x, p.z) + p.y, z: p.z, label: p.kind === 'cart' ? 'Trade at the cart' : 'Read the quest board' }, d, 2); }
    for (const s of Barriers.signs) { const d = Math.hypot(s.x - px, s.z - pz); if (d < 3.6) push({ kind: 'sign', ref: s, x: s.x, y: World.groundY(s.x, s.z) + 3, z: s.z, label: 'Expand: ' + AREA_BY_ID[s.area].name }, d, 3); }
    // resource nodes
    for (const n of Nodes.near(px, pz, 2.3)) {
      if (n.gone || n.disabled) continue;
      const T = NODE_TYPES[n.type];
      if (!Village.isUnlockedIdx(n.area)) continue;
      const d = Math.max(0, Math.hypot(n.x - px, n.z - pz) - T.r * 0.5);
      push({ kind: 'node', ref: n, x: n.x, y: n.y + (T.tree ? 2.4 : 1.4) * n.s, z: n.z, label: T.label, hp: n.hp / T.hits }, d, 1);
    }
    // buildings (stand next to them)
    for (const b of S.buildings) {
      const cfg = BUILDINGS[b.type]; if (cfg.road || Math.abs(b.x - px) > 16 || Math.abs(b.z - pz) > 16) continue;
      const r = BuildingService.rect(b.type, b.x, b.z, b.rot);
      const d = Math.hypot(Math.max(r.x0 - px, 0, px - r.x1), Math.max(r.z0 - pz, 0, pz - r.z1));
      if (d > 1.9) continue;
      let label = 'Inspect ' + cfg.name;
      if (b.damaged) label = 'Repair (30 🪵 15 🪨)';
      else if (b.type === 'home') label = Clock.isNight() || S.time.hour >= 19 ? 'Sleep until morning' : 'Your home';
      else if (cfg.shop) label = 'Trade at the ' + cfg.name;
      push({ kind: 'building', ref: b, x: b.x, y: b.y + Math.min(6, Models.get(b.type).height) + 0.6, z: b.z, label }, d + 1.2, 0);
    }
    return out;
  },
  scan() {
    const c = this.candidates();
    c.sort((a, b) => a.score - b.score);
    this.target = c[0] || null;
  },
  update(dt) {
    this.scanT -= dt;
    if (this.scanT <= 0) { this.scanT = 0.1; if (!this.gathering) this.scan(); }
    if (this.gathering) this.gatherTick(dt);
    if (this.holding && this.target && this.target.kind === 'fire') {
      const r = Remote.invoke('Extinguish', { dt });
      if (r.ok) { this.holdP = r.p; FX.burst(new THREE.Vector3(this.target.x + randRange(-1.5, 1.5), this.target.y - 1, this.target.z + randRange(-1.5, 1.5)), { n: 2, color: FX_COLORS.water, speed: 2, up: 3, life: 0.8, size: 0.35 }); if (Math.random() < 0.1) Audio.sfx('splash'); if (r.done) { this.holding = false; this.holdP = 0; } }
    } else this.holdP = 0;
    UI.prompt(this.gathering ? { ...this.gathering.prompt, hp: this.gathering.node.hp / NODE_TYPES[this.gathering.node.type].hits } : this.target, this.holdP);
  },
  press() {
    const t = this.target;
    if (!t) return;
    switch (t.kind) {
      case 'node': return this.startGather(t.ref);
      case 'npc': return UI.npcCard(t.ref.n);
      case 'welcome': { const r = Remote.invoke('Welcome'); if (!r.ok) { UI.toast({ icon: '🏠', title: 'No room yet', text: r.err }); Audio.sfx('error'); } return; }
      case 'chest': {
        const r = Remote.invoke('OpenChest', { id: t.ref.id });
        if (r.ok) { Chests.setOpened(t.ref.id, true); FX.sparkle(new THREE.Vector3(t.ref.x, World.groundY(t.ref.x, t.ref.z) + 1, t.ref.z), 30); Audio.sfx('chest'); UI.toast({ icon: '💎', title: 'Treasure found!', text: UI.costText(t.ref.reward) }); CameraCtl.shake(0.25, 0.3); }
        return;
      }
      case 'cart': return UI.openShop('cart');
      case 'board': return UI.open('quests');
      case 'sign': return UI.areaDialog(t.ref.area);
      case 'merchant': return UI.openShop('merchant');
      case 'visitor': { const r = Remote.invoke('GreetVisitor'); if (!r.ok) UI.toast({ icon: '🎁', title: 'Visitor', text: r.err }); return; }
      case 'wolf': {
        const r = Remote.invoke('HitWolf', { id: t.ref.id });
        if (r.ok) { Player.ent.anim.act = 1; Player.ent.anim.aph = 0; setTimeout(() => { if (!Interact.gathering) Player.ent.anim.act = 0; }, 350); Audio.sfx('hit'); CameraCtl.shake(0.2, 0.2); }
        return;
      }
      case 'fire': this.holding = true; return;
      case 'pickup': {
        const r = Remote.invoke('Pickup', { id: t.ref.id });
        if (r.ok) { Player.ent.anim.act = 1; Audio.sfx('mine'); FX.sparkle(new THREE.Vector3(t.ref.x, t.ref.y + 1, t.ref.z), 10); setTimeout(() => { Player.ent.anim.act = 0; }, 350); }
        return;
      }
      case 'building': {
        const b = t.ref, cfg = BUILDINGS[b.type];
        if (b.damaged) { const r = Remote.invoke('Repair', { id: b.id }); if (!r.ok) { UI.toast({ icon: '🔨', title: 'Repair', text: r.err }); Audio.sfx('error'); } else Audio.sfx('build'); return; }
        if (b.type === 'home' && (Clock.isNight() || S.time.hour >= 19)) return UI.sleep();
        if (cfg.shop) return UI.openShop(cfg.shop);
        return UI.buildingCard(b);
      }
    }
  },
  release() { this.holding = false; },
  startGather(n) {
    const T = NODE_TYPES[n.type];
    this.gathering = { node: n, prompt: { kind: 'node', x: n.x, y: n.y + (T.tree ? 2.4 : 1.4) * n.s, z: n.z, label: T.label + '…' } };
    this.gatherT = 0.15;
    Player.auto = null;
    Player.ent.yaw = Math.atan2(n.x - Player.x, n.z - Player.z);
    Player.ent.anim.act = T.act; Player.ent.anim.aph = 0;
  },
  stopGather() { this.gathering = null; Player.ent.anim.act = 0; },
  gatherTick(dt) {
    const g = this.gathering, n = g.node, T = NODE_TYPES[n.type];
    if (n.gone || n.disabled || Math.hypot(n.x - Player.x, n.z - Player.z) > 3.6 + T.r) return this.stopGather();
    this.gatherT -= dt;
    if (this.gatherT > 0) return;
    this.gatherT = 0.6 / TOOL_TIERS[S.inv.tool].speed;
    const r = Remote.invoke('Gather', { id: n.id });
    if (!r.ok) { if (!r.silent) { UI.hint(r.err); this.stopGather(); } return; }
    Nodes.hitFx(n);
    const pos = new THREE.Vector3(n.x, n.y + (T.tree ? 1.2 : 0.6), n.z);
    FX.burst(pos, { n: 9, color: FX_COLORS[T.fx] || FX_COLORS.wood, speed: 3.4, up: 3.2, life: 0.8, size: 0.28, gravity: 11 });
    Audio.sfx(T.act === 1 ? (T.tree ? 'chop' : 'mine') : T.fish ? 'splash' : 'harvest');
    if (T.tree || T.res === 'stone') CameraCtl.shake(0.08, 0.12);
    if (r.depleted) {
      Nodes.depleteFx(n);
      if (T.tree) Audio.sfx('treefall');
      this.stopGather();
      // keep going on a neighbour of the same kind: feels great when clearing a grove
      const next = Nodes.near(Player.x, Player.z, 2.6).filter((q) => !q.gone && !q.disabled && NODE_TYPES[q.type].res === T.res && Village.isUnlockedIdx(q.area));
      if (next.length && Input.keys.has('e')) this.startGather(next[0]);
    }
  },
};
