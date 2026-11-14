// Boot: loading screen -> main menu -> "Nieuw spel" starts the game.
import { launch, runMain, BASE, installHelpers, isNoise } from './lib.mjs';

runMain('boot', async (t, browser) => {
  const ctx = await browser.newContext({ viewport: { width: 960, height: 540 } });
  const page = await ctx.newPage();
  page.setDefaultTimeout(180000);
  const errors = [], warnings = [], pageErrors = [], failedReq = [];
  page.on('console', (m) => { const x = m.text(); if (isNoise(x)) return; if (m.type() === 'error') errors.push(x); else if (m.type() === 'warning') warnings.push(x); });
  page.on('pageerror', (e) => pageErrors.push(e.message));
  page.on('requestfailed', (r) => failedReq.push(r.url()));
  page.on('response', (r) => { if (r.status() >= 400) failedReq.push(r.status() + ' ' + r.url()); });

  await page.goto(BASE + '/index.html?debug&quality=low', { waitUntil: 'load' });
  const sawLoading = await page.evaluate(() => !!document.querySelector('.loading-screen') && getComputedStyle(document.querySelector('.loading-screen')).display !== 'none');
  t.check(sawLoading, 'loading screen is shown while booting');
  await page.waitForFunction(() => window.BEYOND && window.BEYOND.game.state === 'menu', null, { timeout: 240000, polling: 500 });
  await installHelpers(page);
  t.eq(await page.evaluate(() => window.BEYOND.game.state), 'menu', 'loading -> menu: game.state === "menu"');

  const labels = await page.evaluate(() => [...document.querySelectorAll('.menu-screen .btn-label')].map((b) => b.textContent.trim()));
  for (const l of ['Nieuw spel', 'Instellingen', 'Besturing', 'Over het spel']) t.check(labels.includes(l), `menu button "${l}" exists`, JSON.stringify(labels));
  t.check(await page.evaluate(() => { const m = document.querySelector('.menu-screen'); return m.classList.contains('is-open') && m.getBoundingClientRect().width > 100; }), 'main menu is visible');
  t.check(await page.evaluate(() => !!document.querySelector('.menu-screen svg, .menu-screen .logo, .menu-screen canvas, .menu-screen img')), 'menu shows the logo');
  t.check(await page.evaluate(() => !document.querySelector('.loading-screen').classList.contains('is-open')), 'loading screen closed after boot');

  // Settings / controls / about panels open
  for (const l of ['Instellingen', 'Besturing', 'Over het spel']) {
    await page.evaluate((lab) => { [...document.querySelectorAll('.menu-screen .btn')].find((b) => b.textContent.includes(lab)).click(); }, l);
    await page.waitForTimeout(500);
    const opened = await page.evaluate(() => !!document.querySelector('.modal, .panel, .overlay, dialog, .modal-backdrop'));
    t.check(opened, `menu panel "${l}" opens`);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
  }
  t.eq(await page.evaluate(() => window.BEYOND.game.state), 'menu', 'still in menu after closing panels');

  // Nieuw spel
  await page.evaluate(() => { [...document.querySelectorAll('.menu-screen .btn')].find((b) => b.textContent.includes('Nieuw spel')).click(); });
  await page.waitForFunction(() => window.BEYOND.game.state === 'playing', null, { timeout: 60000 }).catch(() => {});
  t.eq(await page.evaluate(() => window.BEYOND.game.state), 'playing', 'clicking "Nieuw spel" starts the game (state playing)');
  const info = await page.evaluate(() => {
    const B = window.BEYOND;
    const a = B.world.anchors.get('player.start'); const p = B.player.state.position;
    return { dist: Math.hypot(a.position.x - p.x, a.position.z - p.z), mission: B.gameplay.missions.active()?.id, menuVisible: document.querySelector('.menu-screen').classList.contains('is-open'), hud: !!document.querySelector('.hud') };
  });
  t.check(info.dist < 0.5, 'player stands at player.start', JSON.stringify(info));
  t.eq(info.mission, 'm1', 'first mission is active');
  t.check(!info.menuVisible, 'menu hidden once playing');
  t.check(info.hud, 'HUD present');

  await page.waitForTimeout(4000); // let some real frames render
  const stats = await page.evaluate(() => { const B = window.BEYOND; return { ...B.perf.stats(), info: { calls: B.renderer.info.render.calls, tris: B.renderer.info.render.triangles, geometries: B.renderer.info.memory.geometries, textures: B.renderer.info.memory.textures }, canvas: [B.renderer.domElement.width, B.renderer.domElement.height] }; });
  console.log('INFO  perf', JSON.stringify(stats));
  t.check(stats.drawCalls > 0 && stats.triangles > 0, 'renderer reports draw calls and triangles', JSON.stringify(stats.info));
  t.check(stats.drawCalls < 1500, 'draw calls < 1500 at start view (low quality)', `drawCalls=${stats.drawCalls}`);
  t.check(stats.triangles < 3e6, 'triangles < 3M at start view', `triangles=${stats.triangles}`);

  await page.waitForTimeout(500);
  t.check(pageErrors.length === 0, 'no uncaught page errors', pageErrors.join('\n'));
  t.check(errors.length === 0, 'no console errors (besides autoplay warnings)', errors.join(' | '));
  t.check(warnings.length === 0, 'no console warnings (besides autoplay)', warnings.slice(0, 5).join(' | '));
  t.check(failedReq.length === 0, 'no failed/404 requests', failedReq.join(' | '));
});
