// Frame timing, FPS statistics, adaptive quality and cheap scene culling.
// main.js wraps each frame with perf.begin() / perf.end(dt); perf.stats() feeds the HUD.
//
//  * Adaptive quality: when the frame rate stays low the controller walks down a ladder of cheap sacrifices
//    (rarer shadow refreshes -> thinner grass -> lower render resolution) and walks back up, one rung at a
//    time with hysteresis and back-off, once the machine has headroom again. It never touches the preset the
//    user picked, only runtime multipliers (perf/tuning.js and perf.resolutionScale).
//  * Culling: tiny gameplay objects (documents, pickup glints) far from the camera are removed from the
//    main pass, and when the player is in a pitch-black interior (bunker, cave) the outdoor vegetation is skipped.
import { tuning } from './tuning.js';

/** Ladder of runtime sacrifices, cheapest first. */
const LEVELS = [
  { shadow: 1, grass: 1, res: 1 },
  { shadow: 2, grass: 1, res: 1 },
  { shadow: 3, grass: 0.6, res: 1 },
  { shadow: 3, grass: 0.6, res: 0.85 },
  { shadow: 4, grass: 0.35, res: 0.75 },
  { shadow: 4, grass: 0.35, res: 0.62 },
  { shadow: 4, grass: 0.35, res: 0.5 },
];

const WINDOW = 1.5;          // seconds per measurement window
const SETTLE = 3;            // seconds ignored after a change
const FAR_GROUPS = ['documents', 'pickups'];

export function createPerformance({ renderer, scene, camera, world, environment, bus, settings, quality, onResolutionChange }) {
  const samples = new Float32Array(120);
  let index = 0, filled = 0, frameStart = 0;

  // ---- adaptive controller ----------------------------------------------------------------------------
  const webdriver = typeof navigator !== 'undefined' && navigator.webdriver;
  const forced = typeof location !== 'undefined' ? new URLSearchParams(location.search) : new URLSearchParams();
  let level = 0, slowWindows = 0, fastWindows = 0, settle = SETTLE + 2;
  let winTime = 0, winFrames = 0, winMax = 0, peak = 0;
  let relaxNeed = 6, lastRelaxAt = -1e9, clock = 0;
  const minLevel = quality === 'low' ? LEVELS.length - 1 : LEVELS.length - 2; // medium/high never drop below 0.62
  let gameState = 'loading';

  function applyLevel(l) {
    level = Math.max(0, Math.min(minLevel, l));
    const L = LEVELS[level];
    tuning.shadowInterval = L.shadow;
    tuning.grass = L.grass;
    if (Math.abs(perf.resolutionScale - L.res) > 1e-3) { perf.resolutionScale = L.res; onResolutionChange?.(); }
    settle = SETTLE; slowWindows = 0; fastWindows = 0;
  }

  function evaluate(fps) {
    peak = Math.max(peak, fps);
    // a display/browser locked to ~30 fps (low-power mode) must not be treated as "slow"
    const locked30 = peak < 36 && clock > 20;
    const slowBelow = locked30 ? 24 : 40;
    const fastAbove = locked30 ? 28 : 57;
    if (fps < slowBelow) { slowWindows++; fastWindows = 0; } else if (fps >= fastAbove) { fastWindows++; slowWindows = 0; } else { slowWindows = 0; fastWindows = 0; }
    if (slowWindows >= 2 && level < minLevel) {
      // escalated again soon after relaxing: be more patient before the next relax attempt
      if (clock - lastRelaxAt < 40) relaxNeed = Math.min(40, relaxNeed * 2);
      applyLevel(level + 1);
    } else if (fastWindows >= relaxNeed && level > 0) {
      lastRelaxAt = clock;
      applyLevel(level - 1);
    }
  }

  // ---- culling ---------------------------------------------------------------------------------------------
  let cullTimer = 0;
  const farRoots = [];
  let rootsTimer = 99;
  let indoorHidden = false;
  const outdoor = { nature: null, plants: null, grass: null };

  function hideLayers(obj, hide) { obj.traverse((o) => { o.layers.set(hide ? 1 : 0); }); obj.userData.perfFar = hide; }

  function cullFar(dt) {
    rootsTimer += dt;
    if (rootsTimer > 2) { // gameplay creates/changes these groups after boot
      rootsTimer = 0; farRoots.length = 0;
      for (const n of FAR_GROUPS) { const r = scene.getObjectByName(n); if (r) farRoots.push(r); }
    }
    for (const root of farRoots) {
      // paper, notebooks and pickups are far too small to be worth a shadow-map draw call each
      for (const child of root.children) {
        if (child.userData.perfTidy) continue;
        child.userData.perfTidy = true;
        child.traverse((o) => { if (o.isMesh) o.castShadow = false; });
      }
    }
    const R = Math.min(120, Math.max(70, (camera.far || 300) * 0.3));
    const near2 = (R - 8) * (R - 8), far2 = R * R;
    const cx = camera.position.x, cz = camera.position.z;
    for (const root of farRoots) {
      for (const child of root.children) {
        if (child.isInstancedMesh) continue;
        const dx = child.position.x - cx, dz = child.position.z - cz, d2 = dx * dx + dz * dz;
        const hidden = child.userData.perfFar === true;
        if (!hidden && d2 > far2) hideLayers(child, true);
        else if (hidden && d2 < near2) hideLayers(child, false);
      }
    }
  }

  function cullInterior() {
    const dark = environment && typeof environment.darkness === 'number' ? environment.darkness : 0;
    if (!outdoor.nature) {
      outdoor.nature = scene.getObjectByName('instanced-nature');
      outdoor.plants = scene.getObjectByName('plant-cells');
      outdoor.grass = scene.getObjectByName('grass');
    }
    const hide = indoorHidden ? dark > 0.85 : dark > 0.93;
    if (hide === indoorHidden) return;
    indoorHidden = hide;
    for (const o of [outdoor.nature, outdoor.plants, outdoor.grass]) if (o) o.visible = !hide;
  }

  // ---- public object ----------------------------------------------------------------------------------------
  const perf = {
    quality,
    fps: 60,
    frameMs: 16.7,
    cpuMs: 0,
    resolutionScale: 1,
    /** Adaptive quality on/off (off automatically under WebDriver/headless unless ?adapt is in the URL). */
    adaptive: !(webdriver && !forced.has('adapt')) && !forced.has('noadapt'),
    get level() { return level; },
    begin() {
      frameStart = performance.now();
    },
    end(dt) {
      perf.cpuMs = performance.now() - frameStart;
      clock += dt;
      samples[index] = dt * 1000;
      index = (index + 1) % samples.length;
      filled = Math.min(filled + 1, samples.length);
      let sum = 0;
      for (let i = 0; i < filled; i++) sum += samples[i];
      perf.frameMs = sum / filled;
      perf.fps = 1000 / perf.frameMs;

      cullTimer += dt;
      if (cullTimer > 0.3) { cullTimer = 0; cullFar(0.3); }
      cullInterior();

      // measurement window (hitches such as tab switches invalidate it)
      winTime += dt; winFrames++; winMax = Math.max(winMax, dt);
      if (winTime >= WINDOW) {
        const fps = winFrames / winTime, hitch = winMax > 0.25;
        winTime = 0; winFrames = 0; winMax = 0;
        if (settle > 0) { settle -= WINDOW; return; }
        if (hitch || !perf.adaptive || gameState === 'loading') return;
        evaluate(fps);
      }
    },
    /** Snapshot for the HUD / debug overlay. */
    stats() {
      const info = renderer.info;
      const mem = typeof performance !== 'undefined' && performance.memory ? performance.memory.usedJSHeapSize : 0;
      return {
        fps: Math.round(perf.fps), frameMs: +perf.frameMs.toFixed(1), cpuMs: +perf.cpuMs.toFixed(2),
        drawCalls: info.render.calls, triangles: info.render.triangles,
        programs: info.programs ? info.programs.length : 0,
        geometries: info.memory.geometries, textures: info.memory.textures,
        resolutionScale: +perf.resolutionScale.toFixed(2), quality: perf.quality,
        adaptiveLevel: level, heapMB: mem ? Math.round(mem / 1048576) : 0,
      };
    },
    /** Resets the adaptive ladder (e.g. after the user changed a graphics setting). */
    resetAdaptive() { applyLevel(0); settle = SETTLE + 2; },
  };

  bus.on('settings:changed', ({ key }) => { if (key === 'renderScale' || key === 'quality' || key === 'shadows') perf.resetAdaptive(); });
  bus.on('game:state', ({ state }) => { gameState = state; });
  void world; void settings;
  return perf;
}
