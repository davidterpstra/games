/* =====================================================================
   EMPIRE CONQUEST — boot, game loop, new game / load, autosave
   ===================================================================== */
'use strict';

const Main = {
  last: 0,
  autosaveT: 30,

  boot() {
    UI.settings = Save.loadSettings();
    Sound.init(UI.settings);
    UI.init();
    UI.updateAudioBtn();
    MapView.init(document.getElementById('map'));
    const fill = document.getElementById('loading-fill');
    const text = document.getElementById('loading-text');
    const latest = Save.latestSlot();
    const meta = latest ? Save.readMeta(latest) : null;
    const seed = meta && Number.isFinite(meta.seed) ? meta.seed : Math.floor(Math.random() * 1e6);
    const steps = [
      [15, 'Raising mountains and carving rivers…'],
      [55, 'Drawing borders between the realms…'],
      [85, 'Painting the map…'],
      [100, 'The heralds are ready.'],
    ];
    fill.style.width = steps[0][0] + '%';
    text.textContent = steps[0][1];
    // let the loading screen paint before the heavy work
    setTimeout(() => {
      try {
        fill.style.width = steps[1][0] + '%'; text.textContent = steps[1][1];
        this.ensureWorld(seed);
        fill.style.width = steps[2][0] + '%'; text.textContent = steps[2][1];
      } catch (e) {
        console.error(e);
        text.textContent = 'Something went wrong while creating the world: ' + e.message;
        return;
      }
      setTimeout(() => {
        fill.style.width = '100%'; text.textContent = steps[3][1];
        Screens.title();
        requestAnimationFrame((t) => { this.last = t; this.loop(t); });
        setTimeout(() => {
          const l = document.getElementById('loading');
          l.classList.add('fade');
          setTimeout(() => l.remove(), 600);
        }, 250);
      }, 60);
    }, 60);

    document.addEventListener('visibilitychange', () => { if (document.hidden) this.autosave(); });
    window.addEventListener('beforeunload', () => this.autosave());
  },

  ensureWorld(seed) {
    if (Game.world && Game.world.seed === seed) return;
    Game.world = MapGen.generate(seed);
    MapView.setWorld(Game.world);
    MapView.cam.x = Game.world.W / 2;
    MapView.cam.y = Game.world.H / 2;
    MapView.cam.z = MapView.minZ * 1.25;
  },

  resetCache() {
    Game.cache = { dirty: true, kTerr: [], capDist: [], rates: [], power: [], soldiers: [], popCap: [], pop: [], happy: [], rank: [], caps: [], smith: [] };
    Game.acc = 0;
  },

  startNew(opts) {
    this.ensureWorld(opts.seed);
    this.resetCache();
    Game.state = Game.newState(opts);
    this.afterLoad();
    Screens.welcome();
    Save.write('auto');
  },

  loadSlot(slot) {
    const r = Save.read(slot);
    if (!r.ok) { UI.result(r); return false; }
    try {
      this.ensureWorld(r.state.seed);
    } catch (e) {
      UI.result({ ok: false, msg: 'Could not rebuild the world for this save.' });
      return false;
    }
    if (r.state.terr.length !== Game.world.territories.length) {
      UI.result({ ok: false, msg: 'This save was made with a different world generator and cannot be loaded.' });
      return false;
    }
    this.resetCache();
    Game.state = r.state;
    this.afterLoad();
    UI.toast({ title: 'Game loaded', text: `${Game.player().name} — day ${Math.floor(Game.state.day) + 1}`, icon: '📂', kind: 'good', dur: 3000 });
    return true;
  },

  afterLoad() {
    const s = Game.state;
    Game.rebuildCache();
    Economy.tick(0);
    Missions.timer = 0;
    MapView.overlayDirty = true;
    MapView.bordersDirty = true;
    MapView.sel = null;
    MapView.orderTarget = -1;
    MapView.particles = []; MapView.rings = []; MapView.flashes = []; MapView.battlesFx = []; MapView.floats = [];
    UI.battleQueue = [];
    for (const m of UI.modalStack.slice()) m.close();
    Screens.hideTitle();
    MapView.resize();
    Panels.close();
    Context.lastSel = null;
    Context.show();
    UI.shown = {};
    UI.logSig = '';
    UI.logLen = undefined;
    if (!s.speed) s.speed = 1;
    UI.prevSpeed = s.speed;
    UI.refresh(true);
    const k = Game.player();
    if (k.alive) {
      const t = Game.wt(k.capital);
      MapView.anim = null;
      MapView.cam.x = t.cx; MapView.cam.y = t.cy; MapView.cam.z = Math.max(MapView.minZ, 0.85);
    }
    this.autosaveT = 30;
  },

  toTitle(save) {
    if (save) this.autosave();
    Game.state = null;
    Panels.close();
    MapView.sel = null;
    for (const m of UI.modalStack.slice()) m.close();
    document.getElementById('context').innerHTML = '';
    Screens.title();
    MapView.resize();
  },

  autosave() {
    const s = Game.state;
    if (!s || s.over || !UI.settings.autosave) return;
    Save.write('auto');
  },

  loop(t) {
    const dt = Math.min(0.1, Math.max(0, (t - this.last) / 1000));
    this.last = t;
    const playing = Game.state && !MapView.showTitle;
    try {
      if (playing) Game.update(dt);
      MapView.frame(dt);
      if (playing) {
        UI.tick(dt);
        if (UI.battleQueue.length && !UI.topModal()) Screens.battleReport(UI.battleQueue.shift(), true);
        this.autosaveT -= dt;
        if (this.autosaveT <= 0) { this.autosaveT = 30; this.autosave(); }
      }
    } catch (e) {
      console.error(e);
    }
    requestAnimationFrame((tt) => this.loop(tt));
  },
};

Main.boot();
