// Visual: screenshots of the key places (saved under SHOT_DIR) with automatic brightness sanity checks.
// The screenshots are meant to be LOOKED at; the automatic checks only catch black/blown-out frames.
// Each group runs in its own browser: software WebGL (SwiftShader) can balloon to many GB of RAM over a long session.
import fs from 'node:fs';
import { launch, openGame, runMain, SHOT_DIR } from './lib.mjs';
import { pngLuma } from './png.mjs';

runMain('visual', async (t, browser0) => {
  fs.mkdirSync(SHOT_DIR, { recursive: true });
  const allErrors = [];

  /** Runs `fn(ctx)` in a fresh browser + page. */
  async function group(name, query, fn) {
    const br = await launch();
    try {
      const G = await openGame(br, query);
      const { page } = G;
      const ev = (f, arg) => page.evaluate(f, arg);
      const frames = async (n = 4) => {
        const start = await ev(() => window.BEYOND.renderer.info.render.frame);
        await page.waitForFunction((a) => window.BEYOND.renderer.info.render.frame >= a, start + n, { timeout: 180000, polling: 250 });
      };
      async function shot(sname, { min = 20, max = 215, maxDark = 0.6, wait = 2 } = {}) {
        await frames(wait);
        const file = `${SHOT_DIR}/${sname}.png`;
        const buf = await page.screenshot({ path: file, timeout: 180000 });
        const l = pngLuma(buf);
        console.log(`INFO  ${sname}: mean luma ${l.mean.toFixed(0)}, dark ${(l.dark * 100).toFixed(0)}%, blown ${(l.bright * 100).toFixed(0)}%`);
        t.check(buf.length > 8000, `screenshot ${sname} saved`, `${buf.length} bytes`);
        t.check(l.mean >= min, `${sname}: not too dark`, `mean luma ${l.mean.toFixed(1)} < ${min}`);
        t.check(l.mean <= max, `${sname}: not too bright`, `mean luma ${l.mean.toFixed(1)} > ${max}`);
        t.check(l.dark <= maxDark, `${sname}: not mostly black`, `${(l.dark * 100).toFixed(0)}% of pixels black`);
      }
      const look = (px, pz, tx, ty, tz) => ev((a) => { const B = window.BEYOND, T = B.THREE; B.player.teleport(new T.Vector3(a.px, B.world.getHeightAt(a.px, a.pz), a.pz), 0, 0); window.QA.aimAt(a.tx, a.ty, a.tz); window.QA.step(3); }, { px, pz, tx, ty, tz });
      const daytime = (h = 10.5, w = 'clear') => ev(({ h, w }) => { window.BEYOND.environment.setTimeOfDay(h); window.BEYOND.environment.setWeather(w); }, { h, w });
      await t.guard(`visual group ${name}`, async () => { await fn({ page, ev, shot, look, daytime, frames }); });
      t.check(G.pageErrors.length === 0, `${name}: no page errors`, G.pageErrors.join('\n'));
      t.check(G.errors.length === 0, `${name}: no console errors`, G.errors.join(' | '));
      t.check(G.warnings.length === 0, `${name}: no console warnings`, G.warnings.slice(0, 4).join(' | '));
    } finally { await br.close().catch(() => {}); }
  }
  const AUTO = '?debug&autostart&nosave&quality=low';
  void allErrors;

  // 1. main menu (own browser, menu only) --------------------------------------------------------------
  await group('menu', '?debug&nosave&quality=low', async ({ ev, shot, daytime }) => {
    await daytime();
    await shot('01-main-menu', { min: 15 });
    const txt = await ev(() => document.body.innerText);
    t.check(!/undefined|NaN|\[object/.test(txt), 'menu text has no undefined/NaN');
  });

  await group('exploration', AUTO, async ({ ev, shot, look, daytime }) => {
    await daytime();
    await shot('02-station-interior-start');
    await look(20, 172, 20, 16, 200); await shot('03-station-exterior');
    await look(7, 112, 0, 13, 60); await shot('04-forest-path');
    await look(0, 72, 0, 12.5, 60); await shot('05-crossroads');
    await look(138, -8, 165, 11, -10); await shot('06-village-square');
    await look(104, 106, 150, 4, 150); await shot('14-lake');
  });

  await group('village + waterfall + cave', AUTO, async ({ ev, shot, look, daytime }) => {
    await daytime();
    await ev(() => { const B = window.BEYOND; B.gameplay.inventory.add('crowbar', 1); window.QA.use('village.elderDoor', 0); window.QA.step(70); window.QA.focusOn('village.journal', Math.PI / 2); });
    await shot('07-elder-house-interior');
    await look(-132, -126, -149, 30, -172); await shot('08a-waterfall');
    await look(-128, -146, -117, 18, -160); await shot('08b-cave-mouth');
    await ev(() => { const B = window.BEYOND; B.gameplay.inventory.add('torch', 1); window.QA.focusOn('cave.sundisc', 0); B.bus.emit('input:action', { action: 'torch' }); window.QA.step(40); });
    t.eq(await ev(() => window.BEYOND.environment.torchOn), true, 'torch is on in the cave');
    await shot('09-cave-chamber-torch', { min: 8, maxDark: 0.8, wait: 3 });
  });

  await group('temple', AUTO, async ({ ev, shot, look, daytime }) => {
    await daytime();
    await look(0, -130, 0, 28, -188); await shot('10a-temple-approach');
    await ev(() => { window.QA.focusOn('temple.altar', 0); window.QA.aimAt(0, 30.5, -189); window.QA.step(2); });
    await shot('10b-temple-pillars');
    await ev(() => { const B = window.BEYOND; B.gameplay.inventory.add('sundisc', 1); window.QA.use('temple.altar', 0); window.QA.step(40); for (const [id, n] of [['temple.pillar1', 3], ['temple.pillar3', 2]]) for (let i = 0; i < n; i++) { window.QA.use(id, 0); window.QA.step(40); } window.QA.step(150); });
    await shot('10c-temple-gate-open');
    await ev(() => { window.QA.focusOn('temple.keycard', 0); });
    await shot('11-temple-sanctum', { min: 8, maxDark: 0.8, wait: 3 });
    await ev(() => { window.BEYOND.gameplay.inventory.add('torch', 1); window.BEYOND.environment.setTorch(true); window.QA.step(40); });
    await shot('11b-temple-sanctum-torch', { min: 8, maxDark: 0.8, wait: 3 });
  });

  await group('bunker', AUTO, async ({ ev, shot, look, daytime }) => {
    await daytime();
    await look(-150, 55, -176, 14, 55); await shot('12-bunker-facade');
    await ev(() => { const B = window.BEYOND; B.gameplay.inventory.add('keycard', 1); window.QA.use('bunker.reader', 0); window.QA.step(200); window.QA.use('bunker.generator', Math.PI); window.QA.step(80); window.QA.use('bunker.innerDoor', 0); window.QA.step(150); window.QA.focusOn('bunker.terminal', Math.PI / 2); window.QA.step(10); });
    await shot('13-bunker-control-room', { min: 10, maxDark: 0.8, wait: 3 });
    await ev(() => { window.QA.focusOn('bunker.generator', Math.PI); });
    await shot('13b-bunker-generator-room', { min: 8, maxDark: 0.85, wait: 3 });
  });

  await group('night + weather', AUTO, async ({ ev, shot, look, daytime }) => {
    await ev(() => window.QA.use('station.beacon', 0));
    await look(20, 175, 24, 14.5, 193); await daytime(23.0); await shot('15a-night-station', { min: 4, maxDark: 0.9, wait: 3 });
    await look(138, -8, 165, 11, -10); await shot('15b-night-village', { min: 3, maxDark: 0.92, wait: 3 });
    await daytime(10.5, 'rain'); await look(7, 112, 0, 13, 60); await shot('15d-rain-forest', { min: 10, wait: 3 });
  });

  await group('ui screens', AUTO, async ({ ev, page, shot, look, daytime }) => {
    await daytime();
    await look(7, 112, 0, 13, 60);
    await ev(() => { const B = window.BEYOND; for (const [i, n] of [['wood', 4], ['resin', 2], ['fiber', 5], ['scrap', 3], ['cloth', 1], ['stone', 2]]) B.gameplay.inventory.add(i, n); });
    await ev(() => { window.BEYOND.bus.emit('input:action', { action: 'inventory' }); window.QA.step(1); });
    t.eq(await ev(() => window.BEYOND.game.state), 'inventory', 'inventory screen opens');
    await shot('16a-inventory-screen', { min: 10, max: 230 });
    const tabs = await ev(() => [...document.querySelectorAll('.inventory-screen button, .inventory-screen [role=tab]')].map((b) => b.textContent.trim()).filter(Boolean));
    console.log('INFO  inventory buttons:', JSON.stringify(tabs.slice(0, 20)));
    for (const [key, label] of [['crafting', /craft/i], ['map', /kaart/i]]) {
      const ok = await ev((src) => { const re = new RegExp(src, 'i'); const b = [...document.querySelectorAll('.inventory-screen button, .inventory-screen [role=tab]')].find((x) => re.test(x.textContent)); if (b) { b.click(); return true; } return false; }, label.source);
      t.check(ok, `inventory has a "${key}" tab`);
      if (ok) await shot(`16-tab-${key}`, { min: 10, max: 230, wait: 3 });
    }
    await ev(() => { window.BEYOND.bus.emit('input:action', { action: 'inventory' }); window.QA.step(1); });
    await ev(() => { window.BEYOND.gameplay._debug.documents.open('logbook'); });
    t.eq(await ev(() => window.BEYOND.game.state), 'reading', 'document reader opens');
    await shot('17-document-reader', { min: 10, max: 230 });
    await ev(() => window.BEYOND.bus.emit('document:close', {}));
    await ev(() => { window.BEYOND.gameplay._debug.documents.open('terminal'); });
    await shot('17b-terminal-reader', { min: 3, max: 230, maxDark: 0.97, wait: 3 }); // typewriter text appears over time (slow at 3 fps)
    await ev(() => window.BEYOND.bus.emit('document:close', {}));
    await ev(() => { window.BEYOND.bus.emit('input:action', { action: 'pause' }); });
    await shot('17c-pause-menu', { min: 8, max: 230, wait: 3 });
    await ev(() => { const b = [...document.querySelectorAll('.pause-screen .btn')].find((x) => /instellingen/i.test(x.textContent)); b && b.click(); });
    await shot('17d-settings-panel', { min: 8, max: 230, wait: 3 });
    await page.keyboard.press('Escape').catch(() => {});
    await ev(() => window.BEYOND.bus.emit('ui:request', { action: 'resume' }));
    await ev(() => { window.BEYOND.bus.emit('chapter:complete', { chapter: 1 }); });
    t.eq(await ev(() => window.BEYOND.game.state), 'ending', 'ending state reached');
    await shot('18-ending-screen', { min: 6, max: 230, wait: 3 });
    const text = await ev(() => document.body.innerText);
    const english = (text.match(/\b(Continue|Settings|Resume|Inventory|Quit|Loading|Press|Chapter complete)\b/g) || []);
    t.check(english.length === 0, 'no untranslated English UI strings in the final screen text', JSON.stringify(english));
  });
  void browser0;
});
