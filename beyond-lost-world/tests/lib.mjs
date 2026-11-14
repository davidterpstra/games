// Shared helpers for the QA tests: browser launch, game boot, tiny assertion framework, in-page step helpers.
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = await import('playwright')); }

export const BASE = process.env.BASE_URL || `http://localhost:${process.env.PORT || 5187}`;
export const SHOT_DIR = process.env.SHOT_DIR || '/tmp/claude-0/-home-user-games/3b9259b3-4abd-57ef-83a7-8615efc6734b/scratchpad/qa';

/** Collects check results for one test file. */
export function createReporter(name) {
  const results = [];
  const log = (ok, label, detail = '') => {
    results.push({ ok, label, detail });
    console.log(`${ok ? 'PASS' : 'FAIL'}  [${name}] ${label}${!ok && detail ? '  -> ' + detail : ''}`);
  };
  return {
    results,
    check(cond, label, detail = '') { log(!!cond, label, typeof detail === 'function' ? detail() : detail); return !!cond; },
    eq(actual, expected, label) {
      const ok = JSON.stringify(actual) === JSON.stringify(expected);
      log(ok, label, `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
      return ok;
    },
    /** Runs fn; a thrown error becomes one FAIL. */
    async guard(label, fn) { try { await fn(); } catch (e) { log(false, label, 'exception: ' + (e && e.message || e)); } },
  };
}

/** Launches headless Chromium (software WebGL). */
export async function launch() {
  return chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
}

const NOISE = [/AudioContext/i, /autoplay/i, /user gesture/i, /GPU stall/i, /GL Driver Message/i, /WebGL.*swiftshader/i, /Automatic fallback to software WebGL/i];
export const isNoise = (t) => NOISE.some((r) => r.test(t));

/**
 * Opens the game. `query` e.g. '?debug&autostart&nosave&quality=low'. Resolves once window.BEYOND exists and the
 * game is out of the loading state. Returns { page, errors, warnings, pageErrors }.
 */
export async function openGame(browser, query = '?debug&autostart&nosave&quality=low', { viewport = { width: 960, height: 540 }, context } = {}) {
  const ctx = context || await browser.newContext({ viewport });
  const page = await ctx.newPage();
  const errors = [], warnings = [], pageErrors = [];
  page.on('console', (m) => {
    const t = m.text();
    if (m.type() === 'error' && !isNoise(t)) errors.push(t);
    else if (m.type() === 'warning' && !isNoise(t)) warnings.push(t);
  });
  page.on('pageerror', (e) => pageErrors.push(e.message + '\n' + (e.stack || '')));
  page.setDefaultTimeout(180000);
  await page.goto(BASE + '/index.html' + query, { waitUntil: 'load' });
  await page.waitForFunction(() => window.BEYOND && window.BEYOND.game && window.BEYOND.game.state !== 'loading' && window.BEYOND.game.player, null, { timeout: 240000, polling: 500 });
  await installHelpers(page);
  return { page, errors, warnings, pageErrors, context: ctx };
}

/** Adds window.QA helpers inside the page. */
export async function installHelpers(page) {
  await page.evaluate(() => {
    const B = window.BEYOND, T = B.THREE;
    const QA = window.QA = {};
    QA.dt = 1 / 30;
    /** Runs n deterministic frames of the same updates main.js performs while playing. */
    QA.step = (n = 1, dt = QA.dt) => {
      for (let i = 0; i < n; i++) {
        if (B.game.state === 'playing') {
          B.player.update(dt); B.gameplay.update(dt);
          if (B.player.state.position.y < -30) B.gameplay.respawnAtCheckpoint();
        }
        B.environment.update(dt, B.player.state.position, { simulate: B.game.state === 'playing' });
      }
    };
    QA.anchor = (id) => { const a = B.world.anchors.get(id); return a ? { x: a.position.x, y: a.position.y, z: a.position.z, rot: a.rotationY || 0 } : null; };
    QA.pos = () => { const p = B.player.state.position; return [p.x, p.y, p.z]; };
    QA.inv = () => { const o = {}; for (const s of B.gameplay.inventory.slots) if (s) o[s.itemId] = (o[s.itemId] || 0) + s.count; return o; };
    QA.flags = () => JSON.parse(JSON.stringify(B.gameplay._debug.flags()));
    QA.missions = () => B.gameplay.missions.list().map((m) => ({ id: m.id, status: m.status, done: m.objectives.filter((o) => o.done).map((o) => o.id) }));
    QA.focus = null;
    B.bus.on('interaction:focus', (f) => { QA.focus = f; });
    QA.events = [];
    for (const ev of ['document:open', 'document:close', 'chapter:complete', 'mission:completed', 'game:state', 'checkpoint:set', 'location:discovered', 'item:picked']) {
      B.bus.on(ev, (p) => QA.events.push({ ev, p: p && typeof p === 'object' ? JSON.parse(JSON.stringify(p, (k, v) => (k === 'body' ? undefined : v))) : p }));
    }
    /** Aim the camera/player at a world point from the player's current position. */
    QA.aimAt = (x, y, z) => {
      const p = B.player.state, e = B.player.getEyePosition();
      const dx = x - e.x, dy = y - e.y, dz = z - e.z;
      p.yaw = Math.atan2(-dx, -dz);
      p.pitch = Math.atan2(dy, Math.hypot(dx, dz));
    };
    /** Teleport ~dist m in front of (x,z) from direction angle `from` (radians, direction the player stands relative to target) and look at target. */
    QA.stand = (tx, ty, tz, from, dist = 1.5, lookY = null) => {
      const sx = tx + Math.sin(from) * dist, sz = tz + Math.cos(from) * dist;
      const gy = Math.max(B.world.getHeightAt(sx, sz), ty - 0.2);
      B.player.teleport(new T.Vector3(sx, gy, sz), 0, 0);
      QA.aimAt(tx, lookY ?? ty, tz);
      B.player.teleport(new T.Vector3(sx, B.player.state.position.y, sz), B.player.state.yaw, B.player.state.pitch);
    };

    // ---- standing-spot search -------------------------------------------------------------------
    const R = 0.35, H = 1.75;
    QA.canStand = (x, z, feetY) => {
      const col = B.player.collision; col.sync();
      const g = col.groundInfoAt(x, z, R, feetY, { y: 0, collider: null });
      const pos = { x, z };
      const pushed = col.resolve(pos, g.y, R, H, null);
      const ws = B.world.getWaterSurfaceAt(x, z);
      const water = ws !== null && ws !== undefined && !g.collider && g.y < ws - 0.1 && (ws - B.world.getHeightAt(x, z)) > 0.05;
      return { ok: !pushed && !water, y: g.y, pushed, water, collider: g.collider && g.collider.id };
    };
    /** Finds a standing spot (no collider overlap, not under water) at horizontal distance `dist` from a point/box. */
    QA.spotsAround = (cx, cy, cz, half, from = 0, dists = [1.5, 1.3, 1.1, 1.8, 2.1, 0.9]) => {
      const out = [];
      for (const d of dists) for (let k = 0; k < 16; k++) {
        const a = from + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * (Math.PI / 8);
        const s = Math.sin(a), c = Math.cos(a);
        const t = Math.min(Math.abs(s) > 1e-6 ? half.x / Math.abs(s) : 1e9, Math.abs(c) > 1e-6 ? half.z / Math.abs(c) : 1e9);
        const x = cx + s * (t + d), z = cz + c * (t + d);
        for (const dy of [0.05, -0.4, -0.9, -1.4]) {
          const r = QA.canStand(x, z, cy + dy);
          if (r.ok && r.y > cy - 1.9 && r.y < cy + 0.4) { out.push({ x, y: r.y, z, a, d }); break; }
        }
      }
      return out;
    };
    /** Teleports in front of interactable `id`, aims at it and checks that interaction:focus announces it. */
    QA.focusOn = (id, from = 0, opts = {}) => {
      const d = B.gameplay._debug.interaction.get(id);
      if (!d) return { ok: false, why: 'not registered' };
      d.object?.updateWorldMatrix?.(true, true);
      const box = d._box;
      const cx = (box.min.x + box.max.x) / 2, cy = (box.min.y + box.max.y) / 2, cz = (box.min.z + box.max.z) / 2;
      const half = { x: (box.max.x - box.min.x) / 2, z: (box.max.z - box.min.z) / 2 };
      const spots = QA.spotsAround(cx, box.min.y + (opts.floorOffset ?? 0.9), cz, half, from);
      if (!spots.length) return { ok: false, why: 'no free standing spot found around ' + id, box: [cx, cy, cz] };
      let last = null;
      for (const s of spots) {
        B.player.teleport(new T.Vector3(s.x, s.y, s.z), 0, 0);
        QA.aimAt(cx, opts.aimY ?? cy, cz);
        QA.focus = null; B.gameplay._debug.interaction.resetFocus();
        QA.step(2);
        last = QA.focus && QA.focus.id;
        if (last === id) return { ok: true, spot: s, prompt: QA.focus.prompt, tried: spots.indexOf(s) + 1 };
      }
      return { ok: false, why: `focus was ${last} (tried ${spots.length} spots)`, box: [cx, cy, cz], first: spots[0] };
    };
    QA.hold = (...codes) => { B.input.keys.clear(); for (const c of codes) B.input.keys.add(c); };
    QA.release = () => B.input.keys.clear();
  });
}

/** Run several frames and return nothing; helper wrapper. */
export const step = (page, n = 3) => page.evaluate((k) => window.QA.step(k), n);

/** Emits E and runs a few frames. */
export async function interact(page, frames = 3) {
  await page.evaluate((k) => { window.BEYOND.bus.emit('input:action', { action: 'interact' }); window.QA.step(k); }, frames);
}

/** Runs the given async test main with timing; returns results. */
export async function runMain(name, main) {
  const rep = createReporter(name);
  const t0 = Date.now();
  let browser;
  try { browser = await launch(); await main(rep, browser); }
  catch (e) { rep.check(false, 'test file crashed', (e && e.stack) || String(e)); }
  finally { try { await browser?.close(); } catch {} }
  const fails = rep.results.filter((r) => !r.ok).length;
  console.log(`-- ${name}: ${rep.results.length - fails} passed, ${fails} failed (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
  process.exit(fails ? 1 : 0);
}
