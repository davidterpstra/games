/* =====================================================================
   MAIN — boot, render loop, picking, quality settings
   ===================================================================== */
const Game = {
  speed: 1, lastSpeed: 1, renderer: null, scene: null, camera: null, state: 'loading', quality: 'medium', raycaster: new THREE.Raycaster(), lodT: 0, skipSave: false, fpsT: 0, frames: 0, slowFor: 0,
  loading(p, text) { const f = $('#load-fill'); if (f) f.style.width = Math.round(p * 100) + '%'; if (text) $('#load-text').textContent = text; },
  async boot() {
    try {
      this.loading(0.05, 'Opening the map…');
      await nextFrame();
      const loaded = DataService.load();
      S = loaded.state;
      this.source = loaded.source;
      registerRemotes();
      this.quality = S.settings.quality;
      const canvas = $('#game');
      const R = new THREE.WebGLRenderer({ canvas, antialias: this.quality !== 'low', powerPreference: 'high-performance' });
      R.setPixelRatio(Math.min(devicePixelRatio || 1, this.quality === 'high' ? 2 : this.quality === 'medium' ? 1.35 : 1));
      R.setSize(innerWidth, innerHeight);
      R.outputColorSpace = THREE.SRGBColorSpace;
      R.toneMapping = THREE.ACESFilmicToneMapping; R.toneMappingExposure = 1.05;
      R.shadowMap.enabled = this.quality !== 'low';
      R.shadowMap.type = this.quality === 'high' ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
      R.shadowMap.autoUpdate = false;
      this.renderer = R;
      this.scene = new THREE.Scene();
      this.camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.3, 1200);
      addEventListener('resize', () => this.resize());
      makeWorldMaterials();
      Mats.windowGlow.vertexColors = true;
      this.loading(0.12, 'Shaping hills and rivers…'); await nextFrame();
      World.init();
      this.loading(0.28, 'Painting the land…'); await nextFrame();
      buildTerrain(this.scene); buildWater(this.scene); buildRoads(this.scene);
      this.loading(0.42, 'Building bridges and caves…'); await nextFrame();
      buildProps(this.scene); Chests.build(this.scene);
      this.loading(0.52, 'Planting forests…'); await nextFrame();
      Nodes.generate(this.scene);
      this.loading(0.64, 'Sowing flowers and grass…'); await nextFrame();
      Decor.build(this.scene, this.decorDensity());
      this.loading(0.76, 'Waking up the villagers…'); await nextFrame();
      Barriers.init(this.scene); DayNight.init(this.scene); FX.init(this.scene); Chars.init(this.scene);
      BuildRender.init(this.scene); SelRing.init(this.scene); BuildCtl.init(this.scene); EventService.init(this.scene); ZoneRender.init(this.scene);
      BuildingService.rebuildIndex(); BuildingService.initY();
      for (const b of S.buildings) BuildRender.add(b, false);
      Decor.refreshHidden(BuildRender.rects());
      ResourceService.init();
      for (const a of AREAS) U.uLocked.value[a.idx] = a.hidden || S.areas.includes(a.id) ? 0 : 1;
      Barriers.rebuild();
      for (const id of S.chests) Chests.setOpened(id, false);
      Player.init();
      NPCService.init();
      QuestService.ensure();
      Village.computeHappiness();
      this.loading(0.9, 'Lighting the lanterns…'); await nextFrame();
      Labels.init(); UI.init(); Input.init(canvas);
      if (this.source === 'save' || this.source === 'backup') this.offline = Village.offline((Date.now() - S.savedAt) / 1000);
      if (this.source === 'backup') setTimeout(() => UI.toast({ icon: '🛟', title: 'Restored from backup', text: 'Your last save was damaged, so the previous one was loaded.' }), 1200);
      this.resize();
      this.renderer.shadowMap.needsUpdate = true;
      this.loading(1, 'Ready!');
      this.showTitle();
      this.last = performance.now();
      requestAnimationFrame((t) => this.frame(t));
      addEventListener('visibilitychange', () => { if (document.hidden && this.state === 'play' && !this.skipSave) DataService.save('hidden'); });
      addEventListener('pagehide', () => { if (this.state === 'play' && !this.skipSave) DataService.save('leave'); });
    } catch (e) {
      console.error(e);
      $('#load-text').textContent = 'Something went wrong while building the world: ' + (e && e.message ? e.message : e);
    }
  },
  decorDensity() { return this.quality === 'high' ? 1 : this.quality === 'medium' ? 0.7 : 0.38; },
  decorDist() { return this.quality === 'high' ? 150 : this.quality === 'medium' ? 110 : 75; },
  showTitle() {
    $('#loading').classList.add('done');
    setTimeout(() => { $('#loading').hidden = true; }, 600);
    const t = $('#title'); t.hidden = false;
    const isNew = this.source === 'new';
    $('#t-continue').hidden = isNew;
    $('#t-new').textContent = isNew ? 'Start your village' : 'New village';
    $('#t-sub').textContent = isNew ? 'A small plot of land, one cozy house, and a lot of possibilities.' : `Welcome back to your ${levelTitle(S.level).toLowerCase()}! Day ${S.time.day} · ${S.npcs.length} residents.`;
    $('#t-continue').onclick = () => this.play();
    $('#t-new').onclick = () => {
      if (isNew) return this.play();
      UI.confirm('Start a new village?', 'This deletes your current village for good.', 'Start over', () => { DataService.reset(); this.skipSave = true; location.reload(); }, true);
    };
    this.state = 'title';
    CameraCtl.mode = 'title';
  },
  play() {
    Audio.unlock();
    $('#title').classList.add('out');
    setTimeout(() => { $('#title').hidden = true; }, 500);
    this.state = 'play';
    CameraCtl.mode = 'play';
    CameraCtl.yaw = Player.ent.yaw + Math.PI; CameraCtl.snap();
    UI.showHud();
    if (matchMedia('(pointer: coarse)').matches) document.body.classList.add('touch');
    Audio.sfx('open');
    if (this.offline && Object.keys(this.offline.res).length) {
      const o = this.offline;
      UI.dialog(`<h3>🌄 Welcome back!</h3><p>While you were away for ${fmtDur(o.sec)}, your villagers kept working:</p><div class="costs big">${UI.costHtml(o.res, false)}</div>`, [['Great!', null]]);
    } else if (S.playTime < 5) {
      setTimeout(() => UI.toast({ icon: '🌱', title: 'Welcome to Willow Glade!', text: 'Follow the quests on the left. Walk with WASD, press E near a tree to chop it.' }), 800);
    }
    DataService.save('start');
  },
  setSpeed(v) {
    v = clamp(v | 0, 0, 4);
    if (v > 0) this.lastSpeed = v;
    this.speed = v;
    if (v === 0) { Interact.stopGather(); Player.auto = null; Input.keys.clear(); }
    $$('#speed button').forEach((b) => b.classList.toggle('on', +b.dataset.speed === v));
    $('#paused').hidden = v !== 0;
    document.body.classList.toggle('is-paused', v === 0);
    Audio.sfx('tick');
  },
  togglePause() { this.setSpeed(this.speed === 0 ? this.lastSpeed : 0); },
  resize() {
    const R = this.renderer; if (!R) return;
    R.setSize(innerWidth, innerHeight);
    this.camera.aspect = innerWidth / innerHeight; this.camera.updateProjectionMatrix();
  },
  applyQuality() {
    const q = S.settings.quality;
    if (q === this.quality) return;
    this.quality = q;
    const R = this.renderer;
    R.setPixelRatio(Math.min(devicePixelRatio || 1, q === 'high' ? 2 : q === 'medium' ? 1.35 : 1));
    R.shadowMap.enabled = q !== 'low';
    R.shadowMap.type = q === 'high' ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
    DayNight.sun.castShadow = q !== 'low';
    const sz = q === 'high' ? 2048 : 1024;
    if (DayNight.sun.shadow.map) { DayNight.sun.shadow.map.dispose(); DayNight.sun.shadow.map = null; }
    DayNight.sun.shadow.mapSize.set(sz, sz);
    this.scene.traverse((o) => { if (o.material) { const ms = Array.isArray(o.material) ? o.material : [o.material]; for (const m of ms) m.needsUpdate = true; } });
    Decor.build(this.scene, this.decorDensity());
    Decor.refreshHidden(BuildRender.rects());
    R.shadowMap.needsUpdate = true;
    this.resize();
    UI.toast({ icon: '🎨', title: 'Graphics: ' + q, text: 'Anti-aliasing changes apply after a reload.' });
  },
  ray(sx, sy) {
    const v = new THREE.Vector2((sx / innerWidth) * 2 - 1, -(sy / innerHeight) * 2 + 1);
    this.raycaster.setFromCamera(v, this.camera);
    return this.raycaster.ray;
  },
  /* ground pick by marching along the ray against the heightfield */
  pickGround(sx, sy) {
    const ray = this.ray(sx, sy);
    const o = ray.origin, d = ray.direction;
    let prev = 0, t = 0;
    for (let i = 0; i < 700; i++) {
      t += 0.8 + t * 0.01;
      const x = o.x + d.x * t, y = o.y + d.y * t, z = o.z + d.z * t;
      if (Math.abs(x) > WORLD.HALF || Math.abs(z) > WORLD.HALF) return null;
      const gy = Math.max(World.heightAt(x, z), WORLD.WATER - 0.1);
      if (y <= gy) {
        let a = prev, b = t;
        for (let k = 0; k < 12; k++) { const m = (a + b) / 2; const mx = o.x + d.x * m, mz = o.z + d.z * m; if (o.y + d.y * m <= Math.max(World.heightAt(mx, mz), -0.1)) b = m; else a = m; }
        return { x: o.x + d.x * b, y: o.y + d.y * b, z: o.z + d.z * b, t: b };
      }
      prev = t;
    }
    return null;
  },
  onClick(sx, sy, button, type) {
    if (this.state !== 'play') return;
    Audio.unlock();
    if (BuildCtl.active) return BuildCtl.onClick(sx, sy, button, type);
    if (ZoneCtl.active) return ZoneCtl.onClick(sx, sy, button, type);
    if (button === 2) return;
    const ray = this.ray(sx, sy);
    const ground = this.pickGround(sx, sy);
    const gt = ground ? ground.t : 1e9;
    let best = null, bt = gt;
    const sph = new THREE.Sphere(), hit = new THREE.Vector3();
    const test = (x, y, z, r, obj) => { sph.center.set(x, y, z); sph.radius = r; if (ray.intersectSphere(sph, hit)) { const t = hit.distanceTo(ray.origin); if (t < bt + r) { bt = t; best = obj; } } };
    for (const r of NPCService.rt.values()) if (!r.ent.hidden) test(r.ent.x, r.ent.y + 1.1, r.ent.z, 0.9, { kind: r.cand ? 'welcome' : 'npc', r });
    for (const a of EventService.actors) test(a.ent.x, a.ent.y + 1.1, a.ent.z, 1, { kind: a.kind, a });
    for (const w of EventService.wolves) test(w.x, w.y + 0.8, w.z, 1.2, { kind: 'wolf', w });
    for (const c of Chests.list) if (!c.opened) test(c.x, World.groundY(c.x, c.z) + 0.5, c.z, 1, { kind: 'chest', c });
    for (const s of Barriers.signs) test(s.x, World.groundY(s.x, s.z) + 1.9, s.z, 1.6, { kind: 'sign', s });
    for (const p of Props.interact) test(p.x, World.groundY(p.x, p.z) + 1.4, p.z, 2, { kind: p.kind, p });
    if (ground) for (const n of Nodes.near(ground.x, ground.z, 3)) { if (n.gone || n.disabled) continue; const T = NODE_TYPES[n.type]; test(n.x, n.y + (T.tree ? 1.6 : 0.5) * n.s, n.z, (T.tree ? 1.6 : 1) * n.s, { kind: 'node', n }); }
    const bh = BuildRender.pick(ray);
    if (bh && bh.t < bt) { best = { kind: 'building', b: bh.b }; bt = bh.t; }
    if (!best) {
      if (ground && Village.isUnlockedAt(ground.x, ground.z)) { Player.walkTo(ground.x, ground.z, 0.5); FX.burst(new THREE.Vector3(ground.x, ground.y + 0.1, ground.z), { n: 6, color: [0xffffff, 0xfff1a8], speed: 1.5, up: 1, gravity: 2, life: 0.5, size: 0.25, kind: 1 }); }
      return;
    }
    Audio.sfx('click');
    const near = (x, z, r, fn) => { if (Math.hypot(x - Player.x, z - Player.z) <= r) fn(); else Player.walkTo(x, z, r * 0.8, fn, fn); };
    switch (best.kind) {
      case 'npc': return UI.npcCard(best.r.n);
      case 'welcome': return near(best.r.ent.x, best.r.ent.z, 2.6, () => { Interact.scan(); Interact.target = { kind: 'welcome' }; Interact.press(); });
      case 'building': return UI.buildingCard(best.b);
      case 'node': { const n = best.n; if (!Village.isUnlockedIdx(n.area)) return UI.hint('🔒 That area is not yours yet.'); return near(n.x, n.z, 2.2 + NODE_TYPES[n.type].r * 0.5, () => Interact.startGather(n)); }
      case 'chest': return near(best.c.x, best.c.z, 2.4, () => { Interact.target = { kind: 'chest', ref: best.c }; Interact.press(); });
      case 'sign': return UI.areaDialog(best.s.area);
      case 'cart': return UI.openShop('cart');
      case 'board': return UI.open('quests');
      case 'merchant': return UI.openShop('merchant');
      case 'visitor': return near(best.a.ent.x, best.a.ent.z, 3, () => { Interact.target = { kind: 'visitor' }; Interact.press(); });
      case 'wolf': return near(best.w.x, best.w.z, 3.5, () => { Interact.target = { kind: 'wolf', ref: best.w }; Interact.press(); });
    }
  },
  frame(t) {
    requestAnimationFrame((q) => this.frame(q));
    let dt = (t - this.last) / 1000; this.last = t;
    if (!(dt > 0)) dt = 0.016;
    dt = Math.min(dt, 0.1);
    U.uTime.value += dt;
    const tJs = performance.now();
    try {
      if (this.state === 'play') {
        // game speed: 0 = paused, 1..4 = the world runs that many steps per frame (you keep walking at normal speed)
        if (this.speed > 0) {
          for (let i = 0; i < this.speed; i++) Server.tick(dt);
          Player.update(dt);
          Interact.update(dt);
        }
        BuildCtl.update(dt);
      } else if (this.state === 'title') {
        NPCService.tick(dt);
      }
      Nodes.update(dt);
      BuildRender.update(dt);
      Tweens.update(dt);
      Chars.update(dt);
      CameraCtl.update(dt, this.camera);
      DayNight.update(dt, this.camera);
      FX.update(dt, this.camera);
      this.lodT -= dt;
      if (this.lodT <= 0) { this.lodT = 0.5; Decor.lod(this.camera.position.x, this.camera.position.z, this.decorDist()); }
      if (this.state === 'play') { Labels.update(this.camera); ZoneRender.labels(this.camera); UI.update(dt); }
      Audio.update(dt);
      this.jsMs = lerp(this.jsMs || 0, performance.now() - tJs, 0.05);
      this.renderer.render(this.scene, this.camera);
    } catch (e) {
      if (!this._errShown) { this._errShown = true; console.error(e); }
    }
    // performance watchdog: suggest lower quality if it stays slow
    this.frames++; this.fpsT += dt;
    if (this.fpsT > 4) {
      const fps = this.frames / this.fpsT; this.frames = 0; this.fpsT = 0;
      if (fps < 26 && this.state === 'play' && S.settings.quality !== 'low') { this.slowFor++; if (this.slowFor === 2) UI.toast({ icon: '🐢', title: 'Running slowly?', text: 'Try Graphics: Low in Settings (⚙).', action: { label: 'Use Low', fn: () => { Remote.invoke('Settings', { quality: 'low' }); this.applyQuality(); } } }); }
      else this.slowFor = 0;
    }
  },
};

// developer hook (only with ?debug in the URL): lets automated tests drive the game
if (/[?&]debug\b/.test(location.search)) window.BYV = { get S() { return S; }, Thumbs, Server, Game, Remote, Player, Nodes, NPCService, EventService, ZoneService, ZoneCtl, BuildingService, Village, UI, BuildCtl, Interact, DataService, Economy, CameraCtl, World, QuestService, Chars, AREAS, BUILDINGS };

Game.boot();
