// BEYOND – THE LOST WORLD · boot, game loop and state machine.
// The lead developer owns this file; modules are wired together according to docs/ARCHITECTURE.md.
import * as THREE from 'three';
import { bus } from './core/EventBus.js';
import { Settings } from './core/Settings.js';
import { QUALITY_PRESETS, resolveQuality } from './core/quality.js';
import * as layout from './world/layout.js';
import { createWorld } from './world/World.js';
import { createEnvironment } from './environment/Environment.js';
import { Input } from './player/Input.js';
import { PlayerController } from './player/PlayerController.js';
import { createGameplay } from './gameplay/Gameplay.js';
import { createUI } from './ui/UI.js';
import { createPerformance } from './perf/Performance.js';

const VERSION = '0.1.0';
const params = new URLSearchParams(location.search);
const DEBUG = params.has('debug');

function showBootError(err) {
  console.error(err);
  const el = document.getElementById('boot-error');
  if (!el) return;
  el.style.display = 'grid';
  el.textContent = `BEYOND kon niet starten: ${err && err.message ? err.message : err}. Controleer of je browser WebGL ondersteunt en start de game via "npm start".`;
}

async function boot() {
  const qualityName = resolveQuality(params.get('quality') || Settings.get('quality'));
  const preset = QUALITY_PRESETS[qualityName];

  // ---- renderer / scene / camera -------------------------------------------------------------
  const container = document.getElementById('game');
  const renderer = new THREE.WebGLRenderer({ antialias: preset.antialias, powerPreference: 'high-performance', stencil: false });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = Settings.get('shadows');
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);
  renderer.domElement.tabIndex = 0;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(Settings.get('fov'), innerWidth / innerHeight, 0.1, preset.viewDistance);
  scene.add(camera); // camera children (torch view model) must render

  const applySize = () => {
    const ratio = Math.min(window.devicePixelRatio || 1, preset.pixelRatio) * Settings.get('renderScale') * (perf ? perf.resolutionScale : 1);
    renderer.setPixelRatio(Math.max(0.35, ratio));
    renderer.setSize(innerWidth, innerHeight, false);
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
  };
  let perf = null;
  applySize();
  addEventListener('resize', applySize);

  // ---- game facade + UI first, so the loading screen shows progress ------------------------------
  let state = 'loading';
  const game = {
    version: VERSION, bus, settings: Settings, layout, quality: qualityName,
    get state() { return state; },
    player: null, gameplay: null, environment: null, perf: null, world: null,
  };
  const ui = createUI({ root: document.getElementById('ui'), bus, game });
  const setState = (next) => {
    if (next === state) return;
    const previous = state;
    state = next;
    bus.emit('game:state', { state, previous });
  };
  bus.emit('game:state', { state, previous: null });
  const progress = (p, label) => bus.emit('loading:progress', { progress: p, label });
  const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));

  // ---- world --------------------------------------------------------------------------------------
  progress(0.02, 'Wereld genereren…');
  await nextFrame();
  const world = await createWorld({ scene, renderer, quality: qualityName, onProgress: (p, label) => progress(0.02 + p * 0.78, label) });
  game.world = world;

  progress(0.82, 'Atmosfeer en licht…');
  await nextFrame();
  const environment = createEnvironment({ scene, renderer, camera, world, bus, settings: Settings, quality: qualityName });
  game.environment = environment;

  progress(0.88, 'Speler voorbereiden…');
  await nextFrame();
  const input = new Input({ domElement: renderer.domElement, bus });
  const player = new PlayerController({ camera, input, world, bus });
  game.player = player;
  game.input = input;

  progress(0.93, 'Missies en voorwerpen…');
  await nextFrame();
  const gameplay = createGameplay({ scene, camera, world, player, environment, bus, settings: Settings });
  game.gameplay = gameplay;

  perf = createPerformance({ renderer, scene, camera, world, environment, bus, settings: Settings, quality: qualityName, onResolutionChange: applySize });
  game.perf = perf;
  applySize();

  // Compile shaders up front so the first frames don't stutter.
  progress(0.97, 'Shaders compileren…');
  await nextFrame();
  try { renderer.compile(scene, camera); } catch (err) { console.warn('[boot] precompile failed', err); }
  progress(1, 'Klaar');

  // ---- settings that main applies ---------------------------------------------------------------
  bus.on('settings:changed', ({ key, value }) => {
    if (key === 'fov') { camera.fov = value; camera.updateProjectionMatrix(); }
    if (key === 'renderScale') applySize();
    if (key === 'shadows') {
      renderer.shadowMap.enabled = value;
      scene.traverse((o) => { if (o.material) [].concat(o.material).forEach((m) => { m.needsUpdate = true; }); });
    }
  });

  // ---- menu camera --------------------------------------------------------------------------------
  const menuTarget = new THREE.Vector3(layout.MENU_CAMERA.target.x, layout.MENU_CAMERA.target.y, layout.MENU_CAMERA.target.z);
  const menuBase = new THREE.Vector3(layout.MENU_CAMERA.position.x, layout.MENU_CAMERA.position.y, layout.MENU_CAMERA.position.z);
  let menuTime = 0;
  const updateMenuCamera = (dt) => {
    menuTime += dt;
    const a = Math.sin(menuTime * 0.05) * 0.35;
    const off = menuBase.clone().sub(menuTarget);
    off.applyAxisAngle(new THREE.Vector3(0, 1, 0), a);
    camera.position.copy(menuTarget).add(off);
    camera.position.y += Math.sin(menuTime * 0.13) * 1.5;
    camera.lookAt(menuTarget);
  };

  // ---- state transitions ------------------------------------------------------------------------
  const enterPlaying = () => {
    setState('playing');
    input.enabled = true;
    player.enabled = true;
    input.lock();
  };
  const leavePlaying = (next) => {
    input.enabled = false;
    player.enabled = false;
    if (input.isLocked) input.unlock();
    setState(next);
  };

  const actions = {
    newGame() {
      environment.audio.unlock();
      gameplay.newGame();
      enterPlaying();
    },
    continue() {
      environment.audio.unlock();
      if (!gameplay.save.load()) { bus.emit('notify', { text: 'Geen opgeslagen spel gevonden.', type: 'warning' }); return; }
      enterPlaying();
    },
    resume() { if (state === 'paused' || state === 'inventory' || state === 'reading' || state === 'ending') enterPlaying(); },
    pause() { if (state === 'playing') leavePlaying('paused'); },
    save() {
      if (state === 'menu' || state === 'loading') return;
      if (gameplay.save.save()) bus.emit('notify', { text: 'Spel opgeslagen.', type: 'success' });
    },
    loadCheckpoint() {
      if (state === 'menu' || state === 'loading') return;
      gameplay.respawnAtCheckpoint();
      enterPlaying();
    },
    quitToMenu() {
      if (state === 'playing' || state === 'paused' || state === 'inventory' || state === 'reading' || state === 'ending') {
        gameplay.save.save();
        leavePlaying('menu');
      }
    },
    openInventory() { if (state === 'playing') leavePlaying('inventory'); },
    closeInventory() { if (state === 'inventory') enterPlaying(); },
    openMap() { if (state === 'playing') leavePlaying('inventory'); },
  };

  bus.on('ui:request', ({ action }) => {
    const fn = actions[action];
    if (fn) fn(); else console.warn(`[main] unknown ui:request "${action}"`);
  });

  bus.on('input:action', ({ action }) => {
    if (state === 'playing') {
      if (action === 'pause') actions.pause();
      else if (action === 'inventory' || action === 'map') actions.openInventory();
      else if (action === 'torch') {
        if (gameplay.inventory.has('torch')) environment.setTorch(!environment.torchOn);
        else bus.emit('notify', { text: 'Je hebt nog geen toorts. Maak er een via Crafting (Tab).', type: 'info' });
      }
    } else if (state === 'inventory') {
      if (action === 'inventory' || action === 'pause' || action === 'map') actions.closeInventory();
    } else if (state === 'reading') {
      if (action === 'interact' || action === 'pause') bus.emit('document:close', {});
    } else if (state === 'paused') {
      if (action === 'pause') actions.resume();
    }
  });

  bus.on('input:pointerlock', ({ locked }) => {
    // Browser took the pointer away (Esc, alt-tab): pause rather than leaving the player stuck.
    if (!locked && state === 'playing' && !input.isTouch) actions.pause();
  });

  bus.on('document:open', () => { if (state === 'playing') leavePlaying('reading'); });
  bus.on('document:close', () => { if (state === 'reading') enterPlaying(); });
  bus.on('chapter:complete', () => { if (state === 'playing' || state === 'reading') leavePlaying('ending'); });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && state === 'playing') { actions.pause(); gameplay.save.save(); }
  });
  addEventListener('beforeunload', () => { if (state !== 'menu' && state !== 'loading') gameplay.save.save(); });

  // ---- loop ----------------------------------------------------------------------------------------
  const clock = new THREE.Clock();
  let elapsed = 0;
  let autosaveTimer = 0;
  const tmp = new THREE.Vector3();

  function frame() {
    const dt = Math.min(clock.getDelta(), 0.1);
    elapsed += dt;
    perf.begin();

    if (state === 'playing') {
      player.update(dt);
      gameplay.update(dt);
      autosaveTimer += dt;
      if (autosaveTimer > 60) { autosaveTimer = 0; gameplay.save.save(); }
      if (player.state.position.y < -30) gameplay.respawnAtCheckpoint();
    } else if (state === 'menu') {
      updateMenuCamera(dt);
    }

    const focus = state === 'menu' ? camera.position : player.state.position;
    tmp.copy(focus);
    environment.update(dt, tmp, { simulate: state === 'playing' });
    world.update(dt, elapsed, camera.position);
    ui.update(dt);

    renderer.render(scene, camera);
    perf.end(dt);
    requestAnimationFrame(frame);
  }

  if (DEBUG) {
    window.BEYOND = { THREE, game, world, player, input, gameplay, environment, ui, perf, scene, camera, renderer, bus, Settings, actions, layout };
  }

  if (params.has('autostart')) actions.newGame();
  else setState('menu');
  requestAnimationFrame(frame);
}

boot().catch(showBootError);
