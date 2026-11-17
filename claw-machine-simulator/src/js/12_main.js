/* =====================================================================
   12_main.js — boot, mode switching, world switching and the render loop.
   Integration layer: wires the modules together exactly as described in
   ARCHITECTURE.md sections 7 and 8. Contains no game rules itself.
   ===================================================================== */

const _mnState = { last: 0, booted: false, errors: {}, zero: { x: 0, y: 0 } };

/** Run fn, log only the first few errors per subsystem so one bug never freezes the loop. */
function _mnSafe(name, fn) {
  try { return fn(); } catch (e) {
    const n = (_mnState.errors[name] = (_mnState.errors[name] || 0) + 1);
    if (n <= 3) console.error('[' + name + ']', e);
    return undefined;
  }
}

function _mnShowError(msg) {
  const el = document.getElementById('loading-msg');
  if (el) el.textContent = msg;
  const ld = document.getElementById('loading');
  if (ld) ld.classList.remove('hidden');
  console.error(msg);
}

/* ---------- modes ---------- */
function _mnSetMode(mode) {
  if (Game.mode === mode) return;
  const prev = Game.mode;
  Game.mode = mode;
  if (prev === 'train') _mnSafe('player', () => Player.setTraining(false));
  if (prev === 'machine') _mnSafe('sfx', () => Sfx.motor(false));
  Input.virtual.x = 0; Input.virtual.y = 0;

  if (mode === 'machine') {
    // stand beside the machine so the avatar never blocks the view into the glass
    const st = ROOM.stations.machine;
    // (outside the machine camera's field of view: right of the cabinet, level with its front)
    const px = st.x + 2.9, pz = st.z + 0.6;
    _mnSafe('player', () => Player.setPosition(px, pz, Math.atan2(st.x - px, st.z - pz)));
    _mnSafe('camera', () => CameraRig.setMode('machine'));
  } else if (mode === 'train') {
    _mnSafe('player', () => Player.setTraining(true));
    _mnSafe('camera', () => CameraRig.setMode('train'));
  } else {
    _mnSafe('camera', () => CameraRig.setMode('follow'));
  }
  Bus.emit('mode:changed', { mode });
}

/* ---------- worlds ---------- */
function _mnEnterWorld(id) {
  if (!WORLD_BY_ID[id]) id = 'starter';
  if (Game.mode !== 'walk') _mnSetMode('walk');
  _mnSafe('scene', () => Scene3D.buildWorld(id));
  // fill the pit BEFORE the machine exists, so syncPit builds every body once (no duplicate spawns)
  _mnSafe('services', () => Services.ensurePit(id));
  _mnSafe('machine', () => { const m = Machines.create(id); m.syncPit(); m.applyUpgradeVisuals(); });
  _mnSafe('scene', () => Scene3D.refreshPetDisplay());
  const sp = ROOM.spawn;
  _mnSafe('player', () => Player.setPosition(sp.x, sp.z, sp.rotY));
  Bus.emit('world:entered', { id });
}

/* ---------- input routing ---------- */
function _mnOnAction(data) {
  const name = data && data.name;
  if (!name) return;
  // panels / reveal / confirm handle their own keys; this handler is registered before UI.init
  // so it runs first and never acts on the key press that closes an overlay
  if (UI.isBlocking()) return;
  const m = Machines.active;
  switch (name) {
    case 'interact':
      if (Game.mode === 'walk') Interact.use();
      break;
    case 'primary':
      if (Game.mode === 'machine' && m) {
        if (m.state === 'idle') m.startPlay();
        else if (m.state === 'aim') m.drop();
      } else if (Game.mode === 'train') {
        Remote.invoke('train:rep', {});
      } else if (Game.mode === 'walk') {
        Interact.use();
      }
      break;
    case 'back':
      if (Game.mode === 'machine') {
        if (!m || !m.isBusy()) _mnSetMode('walk');
        else Bus.emit('toast', { text: 'Wait until the claw is done!', kind: 'info' });
      } else if (Game.mode === 'train') {
        _mnSetMode('walk');
      }
      break;
    default:
      break;
  }
}

function _mnOnStation(data) {
  const key = data && data.key;
  if (Game.mode !== 'walk' || UI.isBlocking()) return;
  switch (key) {
    case 'machine': _mnSetMode('machine'); break;
    case 'training': _mnSetMode('train'); break;
    case 'upgrades': UI.openPanel('upgrades'); break;
    case 'pets': UI.openPanel('pets'); break;
    case 'portal': UI.openPanel('worlds'); break;
    default: break;
  }
}

/* ---------- render loop ---------- */
function _mnFrame(nowMs) {
  requestAnimationFrame(_mnFrame);
  let dt = (nowMs - _mnState.last) / 1000;
  _mnState.last = nowMs;
  if (!(dt > 0)) dt = 0;
  if (dt > 0.1) dt = 0.1;
  Game.time += dt;
  U.uTime.value = Game.time;

  _mnSafe('tweens', () => Tweens.update(dt));
  _mnSafe('services', () => Services.tick(dt));
  const m = Machines.active;
  const move = _mnSafe('input', () => Input.getMove()) || _mnState.zero;
  if (Game.mode === 'machine' && m) _mnSafe('machine', () => m.setMoveInput(move.x, move.y));
  if (m) _mnSafe('machine', () => m.update(dt));
  _mnSafe('player', () => Player.update(dt, Game.mode === 'walk' ? move : _mnState.zero));
  _mnSafe('interact', () => Interact.update());
  _mnSafe('camera', () => CameraRig.update(dt));
  _mnSafe('scene', () => Scene3D.update(dt));
  _mnSafe('fx', () => FX.update(dt));
  _mnSafe('ui', () => UI.update(dt));
  _mnSafe('render', () => Scene3D.render());
}

/* ---------- boot ---------- */
function _mnBoot() {
  try {
    try { Game.player = SaveService.load(); } catch (e) { console.error('[save] load failed', e); Game.player = PlayerData.create(); }
    const fresh = !(Game.player.stats && Game.player.stats.plays > 0);

    // main's handlers first (see _mnOnAction)
    Bus.on('input:action', _mnOnAction);
    Bus.on('station:use', _mnOnStation);
    Bus.on('world:changed', (d) => _mnEnterWorld(d && d.id));

    const canvas = document.getElementById('game-canvas');
    Scene3D.init(canvas);
    _mnSafe('sfx', () => Sfx.init());
    _mnSafe('fx', () => FX.init());
    UI.init();
    Input.init(canvas);
    Player.init();
    CameraRig.init();
    Interact.init();
    Bus.emit('mode:changed', { mode: Game.mode });

    _mnEnterWorld(Game.player.worlds.current);
    SaveService.startAutosave();

    if (Game.debug) {
      window.CMS = {
        THREE, Game, Bus, Tweens, Remote, Services, SaveService, PlayerData, Scene3D, AnimalFactory, PetViewer,
        Machines, Input, Player, CameraRig, Interact, FX, Sfx, UI, ROOM, MACHINE_DIMS,
        RARITIES, VARIANTS, ANIMALS, ANIMAL_BY_ID, WORLDS, WORLD_BY_ID, UPGRADES, TRAINING_EQUIPMENT, GEM_SHOP, ECONOMY, FORMULAS,
        setMode: _mnSetMode, enterWorld: _mnEnterWorld, errors: _mnState.errors,
      };
    }

    _mnState.last = performance.now();
    requestAnimationFrame(_mnFrame);
    _mnState.booted = true;
    window.__cmsBooted = true;
    // hide the loading screen once a couple of frames are on screen
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const ld = document.getElementById('loading');
      if (ld) ld.classList.add('hidden');
      if (SaveService.recovered) Bus.emit('toast', { text: 'Your save was restored from a backup', kind: 'info' });
      if (fresh) Bus.emit('toast', { text: 'Walk to the claw machine and press E to play!', kind: 'info' });
      else Bus.emit('toast', { text: 'Welcome back!', kind: 'good' });
      _mnSafe('services', () => { if (Services.dailyInfo().ready) Bus.emit('toast', { text: 'Your daily reward is ready in the Shop 💎', kind: 'rare' }); });
    }));
  } catch (e) {
    _mnShowError('Something went wrong while starting the game: ' + (e && e.message ? e.message : e));
    console.error(e);
  }
}

_mnBoot();
