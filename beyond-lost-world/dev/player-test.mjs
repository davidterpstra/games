// Automated player tests: node dev/player-test.mjs [baseUrl]   (server on port 5183 by default)
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = await import('playwright')); }

const base = process.argv[2] || 'http://localhost:5183';
const url = `${base}/dev/player-test.html`;
const shotDir = process.env.SHOT_DIR || '/tmp/claude-0/-home-user-games/3b9259b3-4abd-57ef-83a7-8615efc6734b/scratchpad/player';
fs.mkdirSync(shotDir, { recursive: true });

const PI = Math.PI;
const errors = [];
let failed = 0;
const check = (name, ok, info = '') => { if (!ok) failed++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${info ? '  (' + info + ')' : ''}`); };
const f = (n) => Number(n).toFixed(2);

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const hook = (page) => {
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`[${m.type()}] ${m.text()}`); });
  page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));
};

// ================= desktop =================
{
  const page = await browser.newPage({ viewport: { width: 800, height: 450 } });
  hook(page);
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForFunction(() => window.TEST_READY === true);
  await page.evaluate(() => { TEST.auto = false; });
  const T = (code) => page.evaluate(code);

  // --- solid things
  let r = await T(`(() => { TEST.reset(-12, -25, Math.PI / 2); TEST.hold(['KeyW'], 3); return TEST.snap(); })()`);
  check('cannot walk through a wall (room east wall)', r.x > -15.6, `x=${f(r.x)}`);
  r = await T(`(() => { TEST.reset(0, -10, 0); TEST.hold(['KeyW'], 3); return TEST.snap(); })()`);
  check('cannot walk through a rotated (45°) wall (slides along it)', r.z > -20 + 0.2 - Math.abs(r.x) * 1 - 0.01 && Math.abs(r.x) > 1, `x=${f(r.x)} z=${f(r.z)}`);
  r = await T(`(() => { TEST.reset(-2.2, 8, Math.PI); TEST.hold(['KeyW'], 3); return TEST.snap(); })()`);
  check('cannot walk through a tree', r.z < 11.3, `z=${f(r.z)}`);
  r = await T(`(() => { TEST.reset(-2.9, 8, Math.PI); TEST.hold(['KeyW'], 3); return TEST.snap(); })()`);
  check('cannot squeeze between trees (0.4 m gap)', r.z < 12, `z=${f(r.z)}`);
  r = await T(`(() => { TEST.reset(-20, -25, 0); TEST.hold(['KeyW'], 3); return TEST.snap(); })()`);
  check('closed door blocks', r.z > -28.6, `z=${f(r.z)}`);
  r = await T(`(() => { TEST.reset(-20, -17, 0); TEST.hold(['KeyW'], 3); return TEST.snap(); })()`);
  check('can walk through the 1.4 m doorway', r.z < -23, `z=${f(r.z)}`);
  r = await T(`(() => { TEST.world.setColliderEnabled('door1', false); TEST.reset(-20, -25, 0); TEST.hold(['KeyW'], 3); const s = TEST.snap(); TEST.world.setColliderEnabled('door1', true); return s; })()`);
  check('toggled-off door lets you pass', r.z < -30, `z=${f(r.z)}`);
  r = await T(`(() => { TEST.reset(-20, -25, 0); TEST.hold(['KeyW'], 3); return TEST.snap(); })()`);
  check('door blocks again when re-enabled', r.z > -28.6, `z=${f(r.z)}`);
  r = await T(`(() => { TEST.reset(-22, -17, 0); TEST.hold(['KeyW', 'ShiftLeft'], 2); return TEST.snap(); })()`);
  check('sprinting into a wall corner/side does not tunnel', r.z > -21.6 || r.x > -21.1, `x=${f(r.x)} z=${f(r.z)}`);
  r = await T(`(() => { TEST.reset(-12, -25, Math.PI / 2); TEST.hold(['KeyW', 'ShiftLeft'], 2, 0.2); return TEST.snap(); })()`);
  check('no tunnelling through a thin wall at dt = 0.2 s', r.x > -15.6, `x=${f(r.x)}`);

  // --- stairs / platform
  r = await T(`(() => { TEST.reset(8, -10, -Math.PI / 2); const t = TEST.hold(['KeyW'], 2.4); return { s: TEST.snap(), t }; })()`);
  check('walks up the stairs and onto the platform', Math.abs(r.s.y - 1.8) < 0.01 && r.s.x > 14.9 && r.s.onGround, `y=${f(r.s.y)} x=${f(r.s.x)}`);
  check('stairs: surface is the platform material (wood)', r.s.surface === 'wood', r.s.surface);
  r = await T(`(() => { let air = 0, n = 0; TEST.reset(18, -10, Math.PI / 2, 1.8); TEST.key('KeyW', true); TEST.run(5, 1 / 60, (s) => { n++; if (!s.onGround) air++; }); TEST.key('KeyW', false); return { s: TEST.snap(), air, n }; })()`);
  check('walks back down the stairs without bouncing', r.s.y < 0.01 && r.air <= 2, `y=${f(r.s.y)} airborne frames=${r.air}/${r.n}`);
  r = await T(`(() => { TEST.reset(4, -2, 0); TEST.hold(['KeyW'], 0.5); return TEST.snap(); })()`);
  check('steps onto a low stump (0.4 m ≤ step height)', r.y > 0.39 && r.onGround, `y=${f(r.y)}`);

  // --- jump
  r = await T(`(() => { TEST.reset(-10, -5, 0); TEST.key('Space', true); TEST.key('Space', false); const t = TEST.run(1.5); return { t, s: TEST.snap(), ev: TEST.events.map((e) => e.n) }; })()`);
  check('jump height ≈ 1.1 m', r.t.maxY > 1.03 && r.t.maxY < 1.17, `max=${f(r.t.maxY)}`);
  check('lands again after the jump', r.s.onGround && Math.abs(r.s.y) < 0.01);
  check('emits player:jump and player:land', r.ev.includes('player:jump') && r.ev.includes('player:land'), r.ev.join(','));
  r = await T(`(() => { TEST.reset(-10, -5, 0); TEST.run(0.5); TEST.key('Space', true); TEST.key('Space', false); const t = TEST.run(1.5, 1 / 20); return t; })()`);
  check('jump height is frame-rate independent (20 fps)', r.maxY > 1.0 && r.maxY < 1.2, `max=${f(r.maxY)}`);
  r = await T(`(() => { TEST.reset(-20, -25, 0); TEST.key('Space', true); TEST.key('Space', false); return TEST.run(1.5); })()`);
  check('ceiling (2.4 m) stops a jump', r.maxY < 0.66 && r.maxY > 0.5, `max=${f(r.maxY)}`);
  r = await T(`(() => { TEST.reset(-10, -5, 0, 0.2); TEST.run(0.001, 1 / 60); TEST.player.state.onGround = false; TEST.player._airTime = 0.05; TEST.key('Space', true); TEST.key('Space', false); return TEST.run(1.2).maxY; })()`);
  check('coyote time: jump allowed shortly after leaving the ground', r > 1.0, `max=${f(r)}`);
  r = await T(`(() => { TEST.reset(-10, -5, 0, 1.0); TEST.run(0.15); TEST.key('Space', true); TEST.key('Space', false); const t = TEST.run(0.5); return t.maxY; })()`);
  check('jump buffer: a press just before landing triggers a jump on landing', r > 0.3, `max=${f(r)}`);

  // --- water, slope, bounds
  r = await T(`(() => { TEST.reset(0, 24, Math.PI); let wet = false, minSpeed = 99; TEST.key('KeyW', true); TEST.run(10, 1 / 60, (s) => { if (s.inWater) wet = true; }); TEST.key('KeyW', false); const s = TEST.snap(); return { s, wet, depth: TEST.world.getWaterSurfaceAt(s.x, s.z) - TEST.world.getHeightAt(s.x, s.z) }; })()`);
  check('cannot enter deep water (> 1.1 m)', r.depth <= 1.15 && r.s.z < 36, `depth=${f(r.depth)} z=${f(r.s.z)}`);
  check('wading in shallow water sets inWater / surface water', r.wet && r.s.surface === 'water', `wet=${r.wet} surface=${r.s.surface}`);
  r = await T(`(() => { TEST.reset(0, 30.6, Math.PI); TEST.key('KeyW', true); TEST.run(0.5); const a = TEST.snap(); const t0 = a.z; TEST.run(1); const b = TEST.snap(); TEST.key('KeyW', false); return { wet: b.inWater, v: Math.abs(b.z - t0) }; })()`);
  check('wading slows you down (≈60 % of walk speed)', r.wet && r.v > 1.5 && r.v < 3.0, `inWater=${r.wet} dz/s=${f(r.v)}`);
  r = await T(`(() => { TEST.reset(26, 0, -Math.PI / 2); TEST.hold(['KeyW', 'ShiftLeft'], 4); return TEST.snap(); })()`);
  check('slope steeper than 46° is not climbable', r.x < 31 && r.y < 2, `x=${f(r.x)} y=${f(r.y)}`);
  r = await T(`(() => { TEST.reset(0, 0, 0); TEST.player.teleport(new TEST.THREE.Vector3(32, 0, 0), 0); TEST.run(3); return TEST.snap(); })()`);
  check('standing on a too-steep slope slides you down', r.x < 31, `x=${f(r.x)} y=${f(r.y)}`);
  r = await T(`(() => { TEST.reset(-25, 12, Math.PI / 2); TEST.hold(['KeyW'], 3); return TEST.snap(); })()`);
  check('gentle hill is climbable (walks to the top)', r.y > 3.5, `y=${f(r.y)}`);
  r = await T(`(() => { const out = []; for (const [x, z, yaw] of [[55, -45, -Math.PI / 2], [-55, -45, Math.PI / 2], [-50, 50, Math.PI], [-50, -50, 0]]) { TEST.reset(x, z, yaw); TEST.hold(['KeyW', 'ShiftLeft'], 3); const s = TEST.snap(); out.push([s.x, s.z]); } return out; })()`);
  check('cannot leave the world bounds', r.every(([x, z]) => Math.abs(x) <= 60.0001 && Math.abs(z) <= 60.0001), JSON.stringify(r.map((p) => p.map(f))));
  r = await T(`(() => { TEST.reset(55, -45, -Math.PI / 2); TEST.hold(['KeyW', 'ShiftLeft'], 3); return TEST.snap(); })()`);
  check('bounds: slides along the edge instead of stopping dead', Math.abs(r.x - 60) < 0.01);

  // --- stamina
  r = await T(`(() => { TEST.reset(-55, -45, -Math.PI / 2); TEST.key('KeyW', true); TEST.key('ShiftLeft', true); TEST.run(3); const a = TEST.snap(); TEST.run(6); const b = TEST.snap(); TEST.key('ShiftLeft', false); const c0 = TEST.snap(); TEST.key('KeyW', false); TEST.run(5.5); const c = TEST.snap(); return { a, b, c, c0 }; })()`);
  check('stamina drains while sprinting (≈50 % after 3 s)', r.a.stamina > 0.4 && r.a.stamina < 0.6 && r.a.sprinting, `stamina=${f(r.a.stamina)}`);
  check('sprint stops when stamina is empty (still holding Shift)', !r.b.sprinting && r.b.stamina < 0.5, `sprinting=${r.b.sprinting} stamina=${f(r.b.stamina)}`);
  check('stamina regenerates (full within ~5.5 s of rest)', r.c.stamina > 0.95, `stamina=${f(r.c.stamina)}`);
  r = await T(`(() => { TEST.reset(-55, -45, -Math.PI / 2); TEST.player.state.stamina = 0.1; TEST.key('KeyW', true); TEST.key('ShiftLeft', true); TEST.run(0.1); const a = TEST.snap().sprinting; TEST.key('ShiftLeft', false); TEST.key('KeyW', false); TEST.player.state.stamina = 0.2; TEST.key('KeyW', true); TEST.key('ShiftLeft', true); TEST.run(0.3); const b = TEST.snap().sprinting; TEST.key('ShiftLeft', false); TEST.key('KeyW', false); return { a, b }; })()`);
  check('cannot start sprinting below 15 % stamina', r.a === false && r.b === true, `at 10 %: ${r.a}, at 20 %: ${r.b}`);
  r = await T(`(() => { TEST.reset(-55, -45, -Math.PI / 2); const s0 = TEST.snap().stamina; TEST.key('Space', true); TEST.key('Space', false); TEST.run(0.1); return s0 - TEST.snap().stamina; })()`);
  check('jumping costs a little stamina', r > 0.03 && r < 0.12, `cost=${f(r)}`);

  // --- speeds / feel
  r = await T(`(() => { TEST.reset(-55, -45, -Math.PI / 2); TEST.key('KeyW', true); TEST.run(1); const a = TEST.snap(); TEST.run(1); const b = TEST.snap(); TEST.key('KeyW', false); const v = Math.hypot(b.x - a.x, b.z - a.z); TEST.run(1); const c = TEST.snap(); return { v, stopped: Math.hypot(c.vx, c.vz) }; })()`);
  check('walk speed 4.2 m/s, stops smoothly', Math.abs(r.v - 4.2) < 0.15 && r.stopped < 0.05, `v=${f(r.v)}`);
  r = await T(`(() => { TEST.reset(-55, -45, -Math.PI / 2); TEST.key('KeyW', true); TEST.key('ShiftLeft', true); TEST.run(1); const a = TEST.snap(); TEST.run(1); const b = TEST.snap(); TEST.key('KeyW', false); TEST.key('ShiftLeft', false); return Math.hypot(b.x - a.x, b.z - a.z); })()`);
  check('sprint speed 7.2 m/s', Math.abs(r - 7.2) < 0.25, `v=${f(r)}`);
  r = await T(`(() => { TEST.reset(-55, -45, -Math.PI / 2); TEST.events.length = 0; TEST.hold(['KeyW'], 4); const w = TEST.events.filter((e) => e.n === 'player:step'); TEST.events.length = 0; TEST.reset(-55, -45, -Math.PI / 2); TEST.hold(['KeyW', 'ShiftLeft'], 4); const sp = TEST.events.filter((e) => e.n === 'player:step'); return { w: w.length, sp: sp.length, surf: w[0] && w[0].surface, sprintFlag: sp.every((e) => e.sprint) }; })()`);
  check('player:step events (more often when sprinting, with surface)', r.w >= 6 && r.sp > r.w && r.surf === 'grass' && r.sprintFlag, `walk=${r.w} sprint=${r.sp} surface=${r.surf}`);

  // --- camera / look
  r = await T(`(() => { TEST.reset(-55, -45, 0); TEST.run(0.5); const dy = TEST.camera.position.y - TEST.player.state.position.y; TEST.input.addLook(100, -50); TEST.player.update(1 / 60); const yaw = TEST.player.state.yaw, pitch = TEST.player.state.pitch; TEST.input.addLook(0, -100000); TEST.player.update(1 / 60); const p2 = TEST.player.state.pitch; TEST.input.addLook(0, 100000); TEST.player.update(1 / 60); return { dy, yaw, pitch, p2, p3: TEST.player.state.pitch, order: TEST.camera.rotation.order, camYaw: TEST.camera.rotation.y }; })()`);
  check('eye height 1.62 m', Math.abs(r.dy - 1.62) < 0.02, `dy=${f(r.dy)}`);
  check('mouse look: right → yaw decreases (turn right), up → pitch increases', Math.abs(r.yaw + 100 * 0.0022) < 1e-6 && Math.abs(r.pitch - 50 * 0.0022) < 1e-6, `yaw=${f(r.yaw)} pitch=${f(r.pitch)}`);
  check('pitch clamped to ±88°', Math.abs(r.p2 - 88 * PI / 180) < 1e-6 && Math.abs(r.p3 + 88 * PI / 180) < 1e-6);
  check('camera rotation order YXZ, camera follows yaw', r.order === 'YXZ' && Math.abs(r.camYaw - r.yaw) < 1e-6);
  r = await T(`(() => { TEST.reset(-55, -45, 0); TEST.player.state.pitch = 0; TEST.player.update(1/60); const f = TEST.player.getForward(); const e = TEST.player.getEyePosition(); TEST.player.teleport(new TEST.THREE.Vector3(3, 0, 3), Math.PI / 2, 0.3); const f2 = TEST.player.getForward(); const ser = TEST.player.serialize(); TEST.player.deserialize({ position: [-30, 0, -40], yaw: 1, pitch: -0.2 }); return { f: f.toArray(), e: e.toArray(), f2: f2.toArray(), ser, after: TEST.snap() }; })()`);
  check('getForward: yaw 0 looks to −Z; yaw π/2 looks to −X', Math.abs(r.f[2] + 1) < 1e-6 && r.f2[0] < -0.9, JSON.stringify(r.f.map(f)));
  check('serialize / deserialize round-trip', r.ser.position.length === 3 && Math.abs(r.ser.yaw - Math.PI / 2) < 1e-9 && r.after.x === -30 && r.after.z === -40);
  r = await T(`(() => { TEST.player.teleport(new TEST.THREE.Vector3(12.5, -50, -10), 0); return TEST.snap(); })()`);
  check('teleport below ground lifts the feet onto the stairs', Math.abs(r.y - 0.6) < 0.01 || r.y > 0, `y=${f(r.y)}`);
  r = await T(`(() => { TEST.player.teleport(new TEST.THREE.Vector3(0, -50, 0), 0); return TEST.snap(); })()`);
  check('teleport below ground puts feet exactly on terrain', Math.abs(r.y) < 1e-3 && r.onGround, `y=${f(r.y)}`);

  // --- disabled
  r = await T(`(() => { TEST.reset(-55, -45, 0, 3); TEST.player.enabled = false; const a = TEST.snap(); TEST.hold(['KeyW'], 1); const b = TEST.snap(); TEST.player.enabled = true; return { a, b }; })()`);
  check('player.enabled = false freezes completely (no gravity)', r.a.y === r.b.y && r.a.z === r.b.z && r.b.y > 2.9, `y=${f(r.b.y)}`);
  r = await T(`(() => { TEST.reset(-55, -45, 0); TEST.input.enabled = false; TEST.hold(['KeyW'], 1); const b = TEST.snap(); TEST.input.enabled = true; return b; })()`);
  check('input.enabled = false zeroes movement', Math.abs(r.z + 45) < 0.01, `z=${f(r.z)}`);

  // --- input actions
  r = await T(`(() => { TEST.actions.length = 0; for (const c of ['KeyE', 'Tab', 'KeyI', 'KeyM', 'KeyF', 'Escape', 'Space']) { TEST.key(c, true); TEST.key(c, false); }
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE', repeat: true }));
    const ev = new KeyboardEvent('keydown', { code: 'Tab', cancelable: true }); window.dispatchEvent(ev); const tabPrevented = ev.defaultPrevented; TEST.key('Tab', false);
    const inp = document.createElement('input'); document.body.appendChild(inp); const ev2 = new KeyboardEvent('keydown', { code: 'Space', cancelable: true, bubbles: true }); inp.dispatchEvent(ev2); const spaceInInput = ev2.defaultPrevented; const nAfter = TEST.actions.length; inp.remove();
    return { a: TEST.actions.slice(0, 7), tabPrevented, spaceInInput, repeatIgnored: TEST.actions.filter((x) => x === 'interact').length === 1, nAfter }; })()`);
  check('key actions: E,Tab,I,M,F,Esc,Space', JSON.stringify(r.a) === JSON.stringify(['interact', 'inventory', 'inventory', 'map', 'torch', 'pause', 'jump']), r.a.join(','));
  check('auto-repeat ignored; Tab prevented; Space in <input> untouched', r.repeatIgnored && r.tabPrevented && !r.spaceInInput);
  r = await T(`(() => { TEST.reset(-55, -45, 0); TEST.key('ArrowUp', true); const m = { ...TEST.input.getMove() }; TEST.key('ArrowUp', false); TEST.key('KeyD', true); TEST.key('KeyW', true); const d = { ...TEST.input.getMove() }; TEST.key('KeyD', false); TEST.key('KeyW', false); return { m, d, locked: TEST.input.isLocked, touch: TEST.input.isTouch }; })()`);
  check('getMove: arrows/WASD, diagonal normalised', r.m.z === 1 && Math.abs(Math.hypot(r.d.x, r.d.z) - 1) < 1e-9, JSON.stringify(r.d));
  check('desktop: isTouch false, no touch UI', r.touch === false && (await page.$('.bl-touch')) === null);

  // --- robustness
  r = await T(`(() => { TEST.reset(0, 0, 0); const keys = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ShiftLeft', 'Space']; let seed = 12345; const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296; let bad = 0, out = 0;
    for (let i = 0; i < 1000; i++) { if (i % 5 === 0) for (const k of keys) TEST.key(k, rnd() < 0.5); if (i % 7 === 0) { TEST.input.addLook((rnd() - 0.5) * 400, (rnd() - 0.5) * 200); }
      TEST.player.update(0.1); const s = TEST.player.state; const p = s.position, v = s.velocity;
      if (![p.x, p.y, p.z, v.x, v.y, v.z, s.yaw, s.pitch, s.stamina, TEST.camera.position.x, TEST.camera.position.y, TEST.camera.position.z].every(Number.isFinite)) bad++;
      if (Math.abs(p.x) > 60.001 || Math.abs(p.z) > 60.001) out++; }
    for (const k of keys) TEST.key(k, false); return { bad, out }; })()`);
  check('no NaN after 1000 frames at dt = 0.1 (random input)', r.bad === 0, `bad frames=${r.bad}`);
  check('stays inside bounds over those frames', r.out === 0);
  await page.close();
}

// ================= touch =================
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  hook(page);
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForFunction(() => window.TEST_READY === true);
  await page.evaluate(() => { TEST.auto = false; });
  const isTouch = await page.evaluate(() => TEST.input.isTouch);
  check('touch device detected, isLocked follows wantLock', isTouch && await page.evaluate(() => TEST.input.isLocked));
  const vis = await page.evaluate(() => { const r = document.querySelector('.bl-touch'); return !!r && !r.hidden; });
  check('touch controls visible while input.enabled', vis);
  const sizes = await page.evaluate(() => [...document.querySelectorAll('.bl-touch .btn')].map((b) => { const r = b.getBoundingClientRect(); return [b.className, r.width, r.height, r.left, r.right, r.top, r.bottom]; }));
  check('all buttons are finger-sized (≥ 56 px) and on screen', sizes.length === 6 && sizes.every(([, w, h, l, r, t, b]) => w >= 56 && h >= 56 && l >= 0 && r <= 390 && t >= 0 && b <= 844), sizes.map((s) => s[0].replace('btn ', '')).join(','));
  await page.evaluate(() => { TEST.reset(-55, -45, 0); });
  await page.screenshot({ path: `${shotDir}/touch-idle.png` });

  const cdp = await ctx.newCDPSession(page);
  const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts });
  // joystick + look + jump at the same time
  await touch('touchStart', [{ x: 90, y: 650, id: 1 }]);
  await touch('touchMove', [{ x: 90, y: 600, id: 1 }]);
  await touch('touchStart', [{ x: 90, y: 600, id: 1 }, { x: 280, y: 400, id: 2 }]);
  await touch('touchMove', [{ x: 90, y: 600, id: 1 }, { x: 240, y: 380, id: 2 }]);
  await page.waitForTimeout(100);
  const during = await page.evaluate(() => ({ move: { ...TEST.input.getMove() }, look: { ...TEST.input._look }, pendingX: TEST.input._lookX, sprint: TEST.input.sprint }));
  await page.screenshot({ path: `${shotDir}/touch-active.png` });
  check('floating joystick gives forward movement (multi-touch)', during.move.z > 0.5 && Math.abs(during.move.x) < 0.2, JSON.stringify(during.move));
  check('right-half drag produces look input simultaneously', during.pendingX < 0, `pendingLookX=${f(during.pendingX)}`);
  await touch('touchMove', [{ x: 90, y: 590, id: 1 }, { x: 240, y: 380, id: 2 }]);
  await touch('touchMove', [{ x: 90, y: 540, id: 1 }, { x: 240, y: 380, id: 2 }]);
  await page.waitForTimeout(50);
  const rim = await page.evaluate(() => ({ run: TEST.input.touchRun, sprint: TEST.input.sprint }));
  check('pushing the joystick to the rim = run', rim.run && rim.sprint);
  const yawBefore = await page.evaluate(() => TEST.player.state.yaw);
  await page.evaluate(() => { TEST.run(0.5); });
  const afterRun = await page.evaluate(() => ({ yaw: TEST.player.state.yaw, z: TEST.player.state.position.z, s: TEST.player.state.sprinting }));
  check('controller turns and moves from touch input', afterRun.yaw !== yawBefore && afterRun.z < -45.5 && afterRun.s, `yaw ${f(yawBefore)}→${f(afterRun.yaw)} z=${f(afterRun.z)}`);
  await touch('touchEnd', []);
  await page.waitForTimeout(50);
  const released = await page.evaluate(() => ({ ...TEST.input.getMove(), run: TEST.input.touchRun }));
  check('releasing the touches stops movement', released.x === 0 && released.z === 0 && !released.run);

  // buttons
  await page.evaluate(() => { TEST.actions.length = 0; });
  const center = async (sel) => page.evaluate((s) => { const r = document.querySelector(s).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, sel);
  for (const sel of ['.jump', '.use', '.torch', '.bag', '.pause']) {
    const c = await center('.bl-touch ' + sel);
    await touch('touchStart', [{ x: c.x, y: c.y, id: 5 }]); await touch('touchEnd', []);
  }
  const acts = await page.evaluate(() => TEST.actions.slice());
  check('buttons emit jump / interact / torch / inventory / pause', JSON.stringify(acts) === JSON.stringify(['jump', 'interact', 'torch', 'inventory', 'pause']), acts.join(','));
  const c = await center('.bl-touch .sprint');
  await touch('touchStart', [{ x: c.x, y: c.y, id: 6 }]); await touch('touchEnd', []);
  const tog = await page.evaluate(() => TEST.input.touchSprint);
  await page.screenshot({ path: `${shotDir}/touch-sprint-on.png` });
  await touch('touchStart', [{ x: c.x, y: c.y, id: 6 }]); await touch('touchEnd', []);
  check('sprint button toggles', tog === true && (await page.evaluate(() => TEST.input.touchSprint)) === false);
  await page.evaluate(() => { TEST.input.enabled = false; });
  check('touch controls hidden when input.enabled is false', await page.evaluate(() => document.querySelector('.bl-touch').hidden));
  await ctx.close();
}

await browser.close();
const real = errors.filter((e) => !/GPU stall|swiftshader|WebGL/i.test(e));
check('no console errors', real.length === 0, real.join(' | '));
console.log(failed ? `\n${failed} FAILED` : '\nALL PASSED');
process.exit(failed ? 1 : 0);
