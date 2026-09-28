/* =====================================================================
   EVENT SERVICE — random village events (never back to back)
   rain · festival · wolves · traveling merchant · harvest festival ·
   small fire · meteor shower · special visitor
   ===================================================================== */
const EventService = {
  active: null, wolves: [], pickups: [], actors: [], scene: null, nextWolfId: 1, nextPick: 1, guardT: 0, meteors: [],
  init(scene) {
    this.scene = scene;
    const g = new GB();
    const c = 0x8d8f96, d = 0x6c6e75, l = 0xd9d9dc;
    g.boxB(0.6, 0.55, 1.4, c, 0, 0.55, 0).box(0.45, 0.45, 0.5, c, 0, 1.2, 0.8).box(0.26, 0.22, 0.4, l, 0, 1.08, 1.18).box(0.1, 0.08, 0.06, 0x222222, 0, 1.18, 1.39);
    g.cone(0.1, 0.22, 4, d, -0.14, 1.42, 0.72).cone(0.1, 0.22, 4, d, 0.14, 1.42, 0.72);
    for (const [x, z] of [[-0.2, -0.5], [0.2, -0.5], [-0.2, 0.5], [0.2, 0.5]]) g.boxB(0.14, 0.58, 0.14, d, x, 0, z);
    g.box(0.14, 0.14, 0.7, d, 0, 1.0, -0.95, 0, 0.6, 0);
    g.box(0.06, 0.05, 0.06, 0xffe066, 0.1, 1.28, 1.05).box(0.06, 0.05, 0.06, 0xffe066, -0.1, 1.28, 1.05);
    this.wolfGeo = g.build().main;
    const s = new GB(); s._add(new THREE.OctahedronGeometry(0.55, 0), 0xfff3b0, s._m(0, 0.7, 0, 0, 0.3, 0.2, 1, 1.5, 1)).dodec(0.5, 0x5a4a7a, 0, 0.25, 0, 1.3, 0.6, 1.3, 0.3);
    this.starGeo = s.build().main;
    this.starMat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, emissive: 0xffe9a0, emissiveIntensity: 0.7 });
    const cg = new GB();
    cg.boxB(2.6, 1.0, 1.7, 0x6a3d9a, 0, 0.6, 0).boxB(2.8, 0.14, 1.9, 0x3b2a1e, 0, 0.5, 0);
    for (const s2 of [-1, 1]) cg.cylC(0.55, 0.55, 0.16, 10, 0x3b2a1e, -0.4, 0.55, s2 * 1.0, Math.PI / 2);
    cg.roof(2.2, 3.0, 1.0, 0xf2c230, 0, 1.6, 0, Math.PI / 2, 0x6a3d9a);
    for (let i = 0; i < 3; i++) cg.boxB(0.5, 0.4, 0.5, [0xe8505b, 0x6fc3df, 0xffd166][i], -0.8 + i * 0.8, 1.6, 0.3);
    this.cartGeo = cg.build().main;
  },
  is(id) { return !!(this.active && this.active.id === id); },
  eligible() {
    const pop = Village.population(), L = [];
    L.push('rain');
    if (pop >= 2) L.push('merchant');
    if (pop >= 4) L.push('festival');
    if (BuildingService.count('farm') + BuildingService.count('large_farm') > 0) L.push('harvest');
    if (pop >= 3 && S.level >= 4) L.push('wolves');
    if (S.buildings.filter((b) => this.flammable(b)).length >= 3) L.push('fire');
    if (Clock.isNight() && S.time.hour > 20.5) L.push('meteor');
    if (pop >= 5) L.push('visitor');
    return L;
  },
  flammable(b) { const c = BUILDINGS[b.type]; return b.type !== 'home' && !c.road && c.cat !== 'decor' && !b.damaged && b.type !== 'well' && b.type !== 'fountain'; },
  tick(dt) {
    if (this.active) {
      const ev = this.active;
      ev.t += dt;
      this.run(ev, dt);
      if (ev.t >= ev.dur || ev.finished) this.end();
    } else if (S.level >= 2 && S.playTime > 200) {
      S.ev.next -= dt;
      if (S.ev.next <= 0) {
        const list = this.eligible();
        S.ev.next = randRange(330, 560);
        if (list.length) this.start(pick(list));
      }
    }
    this.tickWolves(dt);
    this.tickActors(dt);
    this.tickPickups(dt);
  },
  start(id, force = false) {
    if (this.active && !force) return;
    const cfg = EVENTS_CFG[id];
    const ev = { id, t: 0, dur: cfg.dur, cfg };
    this.active = ev;
    if (id === 'festival') { S.stats.festivals++; NPCService.refreshLooks(); }
    if (id === 'wolves') this.spawnWolves(Math.min(6, 2 + Math.floor(S.level / 5)));
    if (id === 'merchant') this.spawnMerchant();
    if (id === 'visitor') this.spawnVisitor();
    if (id === 'fire') {
      const list = S.buildings.filter((b) => this.flammable(b));
      const b = pick(list); ev.b = b.id; ev.p = 0;
    }
    if (id === 'meteor') { ev.nextStar = 2; ev.fallen = 0; }
    Bus.emit('event:start', ev);
  },
  end() {
    const ev = this.active; if (!ev) return;
    if (ev.id === 'fire' && !ev.done) {
      const b = BuildingService.byId(ev.b);
      if (b) { b.damaged = true; BuildingService.assignJobs(); Bus.emit('toast', { icon: '🔥', title: BUILDINGS[b.type].name + ' was damaged', text: 'Repair it with 30 wood and 15 stone (press E next to it).' }); }
    }
    this.active = null;
    if (ev.id === 'festival') NPCService.refreshLooks();
    if (ev.id === 'merchant' || ev.id === 'visitor') for (const a of this.actors) this.dismiss(a);
    for (const w of this.wolves) if (w.state !== 'flee') this.flee(w);
    Bus.emit('event:end', ev);
    DataService.dirty = true;
  },
  run(ev, dt) {
    if (ev.id === 'festival') {
      ev.cf = (ev.cf || 0) - dt;
      if (ev.cf <= 0) { ev.cf = 1.2; const [x, z] = NPCService.plazaSpot(); if (Math.hypot(x - Player.x, z - Player.z) < 60) FX.confetti(new THREE.Vector3(x, World.heightAt(x, z) + 1, z), 24); }
    }
    if (ev.id === 'fire' && !ev.done) {
      const b = BuildingService.byId(ev.b);
      if (!b) { ev.finished = true; return; }
      const r = BuildingService.rect(b.type, b.x, b.z, b.rot), H = Math.min(7, Models.get(b.type).height);
      if (Math.hypot(b.x - Player.x, b.z - Player.z) < 90) for (let i = 0; i < 3; i++) FX.flame(new THREE.Vector3(randRange(r.x0 + 0.5, r.x1 - 0.5), b.y + randRange(0.5, H), randRange(r.z0 + 0.5, r.z1 - 0.5)), 1.4);
      if (Math.random() < dt * 4) FX.smoke(new THREE.Vector3(b.x + randRange(-1, 1), b.y + H + 0.5, b.z));
      for (const rr of NPCService.rt.values()) if (!rr.ent.hidden && Math.hypot(rr.ent.x - b.x, rr.ent.z - b.z) < 14 && Math.random() < dt) rr.ent.bubble = { text: '🔥😱', t: 1.5 };
    }
    if (ev.id === 'wolves') {
      if (ev.t > 3 && !this.wolves.some((w) => w.state !== 'flee')) ev.finished = true;
      for (const w of this.wolves) for (const rr of NPCService.rt.values()) if (!rr.ent.hidden && w.state !== 'flee' && Math.hypot(rr.ent.x - w.x, rr.ent.z - w.z) < 18 && rr.state !== 'walk') rr.flee = true;
    }
    if (ev.id === 'meteor') {
      if (Math.random() < dt * 3) { const a = Math.random() * TAU; const p = new THREE.Vector3(Player.x + Math.cos(a) * 150, 130 + Math.random() * 40, Player.z + Math.sin(a) * 150); for (let i = 0; i < 6; i++) FX.spawn({ x: p.x - i * 1.5, y: p.y + i * 0.6, z: p.z, vx: 60, vy: -25, vz: 10, life: 0.7, r: 1, g: 0.95, b: 0.8, s: 2.2 - i * 0.3, grav: 0, kind: 1, grow: -2, drag: 0 }); }
      ev.nextStar -= dt;
      if (ev.nextStar <= 0 && ev.fallen < 3) { ev.nextStar = 9; ev.fallen++; this.dropStar(); }
    }
    if (ev.id === 'visitor' && ev.greeted && !this.actors.length) ev.finished = true;
  },
  /* ----- fire ----- */
  extinguish(dt) {
    const ev = this.active;
    if (!ev || ev.id !== 'fire' || ev.done) return fail('Nothing is burning');
    if (!isNum(dt) || dt <= 0 || dt > 0.25) return fail('Bad request');
    const b = BuildingService.byId(ev.b); if (!b) return fail('Nothing is burning');
    const r = BuildingService.rect(b.type, b.x, b.z, b.rot);
    const d = Math.hypot(Math.max(r.x0 - Player.x, 0, Player.x - r.x1), Math.max(r.z0 - Player.z, 0, Player.z - r.z1));
    if (d > 3.6) return fail('Get closer to the fire');
    const wells = Math.min(6, BuildingService.count('well') + BuildingService.count('fountain') + BuildingService.count('fire_station') * 3);
    ev.p = Math.min(1, ev.p + dt / (4 / (1 + wells * 0.4)));
    if (ev.p >= 1) {
      ev.done = true; ev.finished = true;
      S.stats.fires++;
      Economy.add('coins', 60 + S.level * 5, 'fire', new THREE.Vector3(b.x, b.y + 4, b.z));
      Village.addXP(60, 'fire', new THREE.Vector3(b.x, b.y + 5, b.z));
      FX.burst(new THREE.Vector3(b.x, b.y + 3, b.z), { n: 30, color: [0xbfeaff, 0xffffff], speed: 5, up: 4, life: 1.2, size: 0.4, kind: 1 });
      Bus.emit('toast', { icon: '🧯', title: 'Fire put out!', text: 'The villagers cheer for you.' });
      for (const rr of NPCService.rt.values()) if (!rr.ent.hidden && Math.hypot(rr.ent.x - b.x, rr.ent.z - b.z) < 25) rr.ent.bubble = { text: '👏', t: 2.5 };
    }
    return { ok: true, p: ev.p, done: ev.p >= 1 };
  },
  repair(id) {
    const b = BuildingService.byId(id);
    if (!b || !b.damaged) return fail('Nothing to repair');
    if (Math.hypot(b.x - Player.x, b.z - Player.z) > 12) return fail('Walk to the building first');
    if (!Economy.spend({ wood: 30, stone: 15 })) return fail('You need 30 wood and 15 stone');
    b.damaged = false; BuildingService.assignJobs();
    FX.sparkle(new THREE.Vector3(b.x, b.y + 3, b.z), 24);
    Village.addXP(20, 'repair', new THREE.Vector3(b.x, b.y + 4, b.z));
    return { ok: true };
  },
  /* ----- wolves ----- */
  spawnWolves(n) {
    let cx = 0, cz = 0, k = 0;
    for (const b of S.buildings) { cx += b.x; cz += b.z; k++; }
    cx /= k; cz /= k;
    let sx = cx + 50, sz = cz;
    for (let i = 0; i < 60; i++) {
      const a = Math.random() * TAU, d = randRange(42, 62), x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d;
      if (Village.isUnlockedAt(x, z) && World.groundY(x, z) > 0.6 && World.inPlay(x, z) && World.slopeAt(x, z) < 0.8) { sx = x; sz = z; break; }
    }
    const targets = S.buildings.filter((b) => !BUILDINGS[b.type].road);
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(this.wolfGeo, Mats.flat); m.castShadow = true;
      const w = { id: this.nextWolfId++, x: sx + randRange(-4, 4), z: sz + randRange(-4, 4), y: 0, hp: 3, state: 'hunt', mesh: m, t: Math.random() * 5, target: pick(targets), fleeT: 0, hitT: 0 };
      w.y = World.heightAt(w.x, w.z);
      this.scene.add(m); this.wolves.push(w);
    }
    Audio.sfx('wolf');
  },
  flee(w) { w.state = 'flee'; w.fleeT = 0; const a = Math.atan2(w.z - (w.target ? w.target.z : 0), w.x - (w.target ? w.target.x : 0)); w.fx = Math.cos(a); w.fz = Math.sin(a); },
  hitWolf(id) {
    const w = this.wolves.find((q) => q.id === id);
    if (!w || w.state === 'flee') return fail('Gone already');
    if (Math.hypot(w.x - Player.x, w.z - Player.z) > 4.5) return fail('Too far away');
    this.damageWolf(w, Player.x, Player.z);
    return { ok: true };
  },
  damageWolf(w, fromX, fromZ) {
    w.hp--; w.hitT = 0.3;
    const a = Math.atan2(w.z - fromZ, w.x - fromX);
    w.x += Math.cos(a) * 1.2; w.z += Math.sin(a) * 1.2;
    FX.burst(new THREE.Vector3(w.x, w.y + 1, w.z), { n: 8, color: [0x8d8f96, 0xd9d9dc], speed: 2.5, up: 2, life: 0.6, size: 0.25 });
    if (w.hp <= 0) {
      this.flee(w);
      S.stats.wolves++;
      Economy.add('coins', 12 + S.level, 'wolf', new THREE.Vector3(w.x, w.y + 2, w.z));
      Village.addXP(15, 'wolf', new THREE.Vector3(w.x, w.y + 2.6, w.z));
      Audio.sfx('wolf');
    }
  },
  tickWolves(dt) {
    this.guardT -= dt;
    const guards = this.guardT <= 0 ? S.buildings.filter((b) => (b.type === 'guard_tower' || b.type === 'barracks') && Village.workersOf(b.id).length) : [];
    if (this.guardT <= 0) this.guardT = 1.6;
    for (let i = this.wolves.length - 1; i >= 0; i--) {
      const w = this.wolves[i];
      w.t += dt; w.hitT = Math.max(0, w.hitT - dt);
      let mx = 0, mz = 0, sp = 0;
      if (w.state === 'hunt') {
        const tb = w.target && BuildingService.byId(w.target.id) ? w.target : null;
        const tx = tb ? tb.x : 0, tz = tb ? tb.z : 0;
        const d = Math.hypot(tx - w.x, tz - w.z);
        const reach = tb ? Math.max(...BuildingService.dims(tb.type, tb.rot)) / 2 + 1.5 : 2;
        if (d > reach) { mx = (tx - w.x) / d; mz = (tz - w.z) / d; sp = 3.6; }
        else {
          const stolen = Math.min(S.res.food, 8);
          S.res.food -= stolen; Bus.emit('res', {});
          if (this.active && this.active.id === 'wolves') this.active.stolen = true;
          Bus.emit('toast', { icon: '🐺', title: 'A wolf stole food!', text: `-${stolen} food. Guard towers keep wolves away.` });
          this.flee(w);
        }
        for (const g of guards) {
          if (Math.hypot(g.x - w.x, g.z - w.z) < 38) {
            const from = new THREE.Vector3(g.x, g.y + 9, g.z), to = new THREE.Vector3(w.x, w.y + 0.8, w.z);
            for (let k = 0; k < 8; k++) { const p = from.clone().lerp(to, k / 8); FX.spawn({ x: p.x, y: p.y, z: p.z, vx: 0, vy: 0, vz: 0, life: 0.25 + k * 0.03, r: 0.9, g: 0.8, b: 0.5, s: 0.18, grav: 0, kind: 0, grow: 0, drag: 0 }); }
            this.damageWolf(w, g.x, g.z);
            break;
          }
        }
      } else {
        w.fleeT += dt; mx = w.fx; mz = w.fz; sp = 7.5;
        if (w.fleeT > 7) { this.scene.remove(w.mesh); this.wolves.splice(i, 1); continue; }
      }
      if (sp > 0) {
        const nx = w.x + mx * sp * dt, nz = w.z + mz * sp * dt;
        if (World.groundY(nx, nz) > -0.4 || w.state === 'flee') { w.x = nx; w.z = nz; }
        w.mesh.rotation.y = Math.atan2(mx, mz);
      }
      w.y = World.heightAt(w.x, w.z);
      const gallop = sp > 0 ? Math.abs(Math.sin(w.t * sp * 2.2)) * 0.25 : 0;
      w.mesh.position.set(w.x, w.y + gallop, w.z);
      w.mesh.rotation.x = sp > 0 ? Math.sin(w.t * sp * 2.2) * 0.12 : 0;
      w.mesh.scale.setScalar(w.hitT > 0 ? 1.15 : 1);
      if (w.state === 'flee' && w.fleeT > 5) w.mesh.scale.setScalar(Math.max(0.01, (7 - w.fleeT) / 2));
    }
  },
  /* ----- merchant & visitor (walking actors) ----- */
  spawnMerchant() {
    const x = START.cart[0] + 6, z = START.cart[1] - 5;
    const ent = Chars.spawn({ shirt: 0x6a3d9a, pants: 0x3b2a1e, skin: 0xe0ac86, hair: 0xd9d4cc, hat: 9, hatCol: 0x2b2b33 }, x, z);
    if (!ent) return;
    ent.name = 'Merchant Ilse'; ent.alert = '🧳';
    const cart = new THREE.Mesh(this.cartGeo, Mats.flat); cart.castShadow = true;
    cart.position.set(x + 2.2, World.groundY(x + 2.2, z), z); cart.rotation.y = 0.4; this.scene.add(cart);
    const lvl = S.level;
    const cosPool = ['hat_beret', 'hat_bucket', 'hat_party', 'shirt_berry', 'shirt_sky', 'shirt_sun', 'hat_top'].filter((c) => !S.inv.cos.includes(c));
    const deals = [
      { give: { coins: 150 + lvl * 8 }, get: { gold: 2 } },
      { give: { wood: 60 }, get: { coins: 160 } },
      { give: { coins: 110 }, get: { iron: 15 } },
      { give: { stone: 60 }, get: { food: 40 } },
      { give: { coins: 220 }, get: { tools: 5 } },
      { give: { food: 30 }, get: { coins: 140 } },
    ].sort(() => Math.random() - 0.5).slice(0, 3);
    if (cosPool.length) deals.push({ give: { coins: 400 + lvl * 20 }, get: { cos: pick(cosPool) } });
    this.actors.push({ kind: 'merchant', ent, cart, deals, state: 'stay' });
    ent.yaw = Math.PI * 0.8;
  },
  merchant() { return this.actors.find((a) => a.kind === 'merchant') || null; },
  buyDeal(i) {
    const m = this.merchant();
    if (!m || !this.is('merchant')) return fail('The merchant has left');
    if (Math.hypot(m.ent.x - Player.x, m.ent.z - Player.z) > 9) return fail('Walk up to the merchant first');
    const d = m.deals[i]; if (!d || d.sold) return fail('Sold out');
    if (!Economy.spend(d.give)) return fail('You can\'t afford that');
    d.sold = true;
    Economy.grant(d.get, new THREE.Vector3(m.ent.x, m.ent.y + 2.4, m.ent.z), 'merchant');
    m.ent.bubble = { text: '🤝 Pleasure!', t: 2.5 };
    return { ok: true };
  },
  spawnVisitor() {
    const [x, z] = NPCService.entryPoint();
    const ent = Chars.spawn({ shirt: 0x8c2f39, pants: 0x2f3b52, skin: 0xf1c9a5, hair: 0xe0c27a, hat: 6, hatCol: 0xf2c230 }, x, z);
    if (!ent) return;
    ent.name = 'Lady Marigold'; ent.alert = '🎁';
    const a = { kind: 'visitor', ent, state: 'walk', path: null, pi: 0, greeted: false, wait: 0 };
    const [tx, tz] = NPCService.plazaSpot();
    a.path = Nav.find(x, z, tx, tz) || [[tx, tz]];
    this.actors.push(a);
  },
  greet() {
    const a = this.actors.find((q) => q.kind === 'visitor');
    if (!a || a.greeted) return fail('The visitor has already been greeted');
    if (Math.hypot(a.ent.x - Player.x, a.ent.z - Player.z) > 5) return fail('Walk up to the visitor first');
    a.greeted = true; a.ent.alert = null;
    const hap = Village.happiness();
    const gift = { coins: Math.round(60 + hap * 3 + S.level * 20) };
    if (hap >= 70) gift.gold = 2 + Math.floor(S.level / 6);
    Economy.grant(gift, new THREE.Vector3(a.ent.x, a.ent.y + 2.4, a.ent.z), 'visitor');
    Village.addXP(50, 'visitor', new THREE.Vector3(a.ent.x, a.ent.y + 3, a.ent.z));
    a.ent.bubble = { text: hap >= 70 ? '😍 What a charming village!' : '🙂 Nice, but it could be cozier.', t: 4, big: true };
    a.ent.anim.act = 2;
    if (this.active && this.active.id === 'visitor') this.active.greeted = true;
    setTimeout(() => this.dismiss(a), 4200);
    return { ok: true, gift };
  },
  dismiss(a) {
    if (a.leaving) return;
    a.leaving = true; a.ent.alert = null; a.ent.anim.act = 0;
    const [x, z] = NPCService.entryPoint();
    a.path = Nav.find(a.ent.x, a.ent.z, x, z + 10) || [[x, z + 10]]; a.pi = 0; a.state = 'walk';
    if (a.cart) { const c = a.cart; Tweens.add(1, (t) => c.scale.setScalar(1 - t), () => this.scene.remove(c)); a.cart = null; }
  },
  tickActors(dt) {
    for (let i = this.actors.length - 1; i >= 0; i--) {
      const a = this.actors[i], e = a.ent;
      if (a.state === 'walk' && a.path) {
        const p = a.path[a.pi];
        if (!p) { a.state = 'stay'; if (a.leaving) { Chars.remove(e); this.actors.splice(i, 1); continue; } if (a.kind === 'visitor') e.bubble = { text: '👋 Hello!', t: 3 }; Chars.animate(e, 0, dt); continue; }
        const dx = p[0] - e.x, dz = p[1] - e.z, d = Math.hypot(dx, dz);
        if (d < 0.4) { a.pi++; continue; }
        const sp = 2.8; e.x += (dx / d) * sp * dt; e.z += (dz / d) * sp * dt; e.yaw = Math.atan2(dx, dz); e.y = World.heightAt(e.x, e.z);
        Chars.animate(e, sp, dt);
      } else {
        Chars.animate(e, 0, dt);
        if (a.kind === 'visitor' && !a.greeted) { a.wait += dt; if (a.wait > 6) { a.wait = 0; const [tx, tz] = NPCService.plazaSpot(); a.path = Nav.find(e.x, e.z, tx, tz) || [[tx, tz]]; a.pi = 0; a.state = 'walk'; } }
        if (a.kind === 'merchant') e.yaw = Math.atan2(Player.x - e.x, Player.z - e.z);
      }
      if (e.bubble && e.bubble.t > 0) e.bubble.t -= dt;
    }
  },
  /* ----- meteor fragments ----- */
  dropStar() {
    let x = Player.x, z = Player.z;
    for (let i = 0; i < 40; i++) {
      const a = Math.random() * TAU, d = randRange(12, 45); const px = Player.x + Math.cos(a) * d, pz = Player.z + Math.sin(a) * d;
      if (Village.isUnlockedAt(px, pz) && World.groundY(px, pz) > 0.6 && !World.onRoad(px, pz)) { x = px; z = pz; break; }
    }
    const m = new THREE.Mesh(this.starGeo, this.starMat);
    const y = World.groundY(x, z);
    const p = { id: this.nextPick++, x, z, y, hp: 3, mesh: m, fall: 1.4 };
    m.position.set(x + 30, y + 90, z - 20);
    this.scene.add(m); this.pickups.push(p);
  },
  tickPickups(dt) {
    for (const p of this.pickups) {
      if (p.fall > 0) {
        p.fall -= dt; const k = 1 - Math.max(0, p.fall) / 1.4;
        p.mesh.position.set(lerp(p.x + 30, p.x, k), lerp(p.y + 90, p.y, k * k), lerp(p.z - 20, p.z, k));
        FX.spawn({ x: p.mesh.position.x, y: p.mesh.position.y, z: p.mesh.position.z, vx: 0, vy: 0, vz: 0, life: 0.6, r: 1, g: 0.85, b: 0.5, s: 1.6, grav: 0, kind: 1, grow: -1.5, drag: 0 });
        if (p.fall <= 0) { FX.dust(new THREE.Vector3(p.x, p.y, p.z), 20); FX.sparkle(new THREE.Vector3(p.x, p.y + 1, p.z), 20); if (Math.hypot(p.x - Player.x, p.z - Player.z) < 60) CameraCtl.shake(0.5, 0.4); Audio.sfx('treefall'); }
      } else { p.mesh.rotation.y += dt; p.mesh.position.y = p.y + Math.sin(U.uTime.value * 2 + p.id) * 0.08; }
    }
  },
  pickup(id) {
    const p = this.pickups.find((q) => q.id === id);
    if (!p || p.fall > 0) return fail('Not ready');
    if (Math.hypot(p.x - Player.x, p.z - Player.z) > 3.5) return fail('Too far away');
    p.hp--;
    if (p.hp <= 0) {
      this.scene.remove(p.mesh); this.pickups = this.pickups.filter((q) => q !== p);
      Economy.grant({ gold: 2, planks: 4, xp: 25 }, new THREE.Vector3(p.x, p.y + 2, p.z), 'star');
    }
    return { ok: true };
  },
};
