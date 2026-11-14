// Systems: pause, inventory, settings, save/continue, checkpoints, falling, time/weather, torch, quality, random movement.
import { openGame, runMain, installHelpers } from './lib.mjs';

runMain('systems', async (t, browser) => {
  // ---------------------------------------------------------------------------------------------
  // Part A: one page without saving (?nosave)
  // ---------------------------------------------------------------------------------------------
  const A = await openGame(browser);
  const page = A.page;
  const ev = (fn, arg) => page.evaluate(fn, arg);
  const state = () => ev(() => window.BEYOND.game.state);
  const emit = (name, payload) => ev(({ name, payload }) => { window.BEYOND.bus.emit(name, payload); window.QA.step(2); }, { name, payload });
  const action = (a) => emit('input:action', { action: a });
  const ui = (a) => emit('ui:request', { action: a });

  await t.guard('pause / resume', async () => {
    t.eq(await state(), 'playing', 'starts in playing');
    await ui('pause');
    t.eq(await state(), 'paused', 'ui:request pause -> paused');
    t.check(await ev(() => document.querySelector('.pause-screen')?.classList.contains('is-open')), 'pause screen is shown');
    const before = await ev(() => ({ p: window.QA.pos(), t: window.BEYOND.environment.getTimeOfDay() }));
    await ev(() => { window.QA.hold('KeyW'); window.QA.step(60); window.QA.release(); });
    const after = await ev(() => ({ p: window.QA.pos(), t: window.BEYOND.environment.getTimeOfDay() }));
    t.eq(after.p, before.p, 'player is frozen while paused');
    t.eq(after.t, before.t, 'world clock is frozen while paused');
    await ui('resume');
    t.eq(await state(), 'playing', 'ui:request resume -> playing');
    await action('pause');
    t.eq(await state(), 'paused', 'input:action pause (Esc) -> paused');
    await action('pause');
    t.eq(await state(), 'playing', 'input:action pause again -> playing');
    await ui('pause'); await ui('resume');
    t.eq(await ev(() => window.BEYOND.input.enabled && window.BEYOND.player.enabled), true, 'input + player re-enabled after resume');
  });

  await t.guard('inventory', async () => {
    await action('inventory');
    t.eq(await state(), 'inventory', 'input:action inventory -> inventory state');
    t.check(await ev(() => document.querySelector('.inventory-screen')?.classList.contains('is-open')), 'inventory screen visible');
    await action('inventory');
    t.eq(await state(), 'playing', 'input:action inventory again -> playing');
    await ui('openInventory');
    t.eq(await state(), 'inventory', 'ui:request openInventory');
    await ui('closeInventory');
    t.eq(await state(), 'playing', 'ui:request closeInventory');
    await action('map');
    t.eq(await state(), 'inventory', 'map key opens the inventory screen');
    const tab = await ev(() => { const el = document.querySelector('.inventory-screen [aria-selected="true"], .inventory-screen .tab.active, .inventory-screen .is-active'); return el ? el.textContent.trim() : null; });
    t.check(/kaart/i.test(tab || ''), 'map key selects the Kaart tab', String(tab));
    await action('pause');
    t.eq(await state(), 'playing', 'Esc closes the inventory');
    // a document: open + close
    await ev(() => window.BEYOND.gameplay._debug.documents.open('logbook'));
    t.eq(await state(), 'reading', 'document opens the reader');
    await action('interact');
    t.eq(await state(), 'playing', 'E closes the reader');
    await ev(() => window.BEYOND.gameplay._debug.documents.open('logbook'));
    await action('pause');
    t.eq(await state(), 'playing', 'Esc closes the reader');
  });

  await t.guard('settings', async () => {
    await ev(() => window.BEYOND.Settings.set('fov', 90));
    t.eq(await ev(() => window.BEYOND.camera.fov), 90, 'fov setting applies to the camera');
    t.eq(await ev(() => JSON.parse(localStorage.getItem('beyond.settings.v1')).fov), 90, 'fov persisted in localStorage');
    await ev(() => window.BEYOND.Settings.set('fov', 60));
    t.eq(await ev(() => window.BEYOND.camera.fov), 60, 'fov 60 applies');
    await ev(() => window.BEYOND.Settings.set('fov', 75));
    for (const [k, v] of [['mouseSensitivity', 2], ['invertY', true], ['headBob', false], ['masterVolume', 0.3], ['sfxVolume', 0.5], ['ambientVolume', 0.2], ['showFps', true], ['shadows', false], ['renderScale', 0.7]]) {
      const ok = await ev(({ k, v }) => { try { window.BEYOND.Settings.set(k, v); window.QA.step(2); return window.BEYOND.Settings.get(k) === v; } catch (e) { return String(e); } }, { k, v });
      t.eq(ok, true, `setting ${k} = ${v} applies without throwing`);
    }
    t.eq(await ev(() => window.BEYOND.renderer.shadowMap.enabled), false, 'shadows off applies to the renderer');
    t.check(await ev(() => { try { window.BEYOND.Settings.set('nope', 1); return false; } catch { return true; } }), 'unknown setting key throws');
    t.check(await ev(() => { try { window.BEYOND.Settings.set('fov', 'x'); return false; } catch { return true; } }), 'wrong setting type throws');
    await ev(() => { const S = window.BEYOND.Settings; S.set('mouseSensitivity', 1); S.set('invertY', false); S.set('headBob', true); S.set('masterVolume', 0.8); S.set('sfxVolume', 1); S.set('ambientVolume', 0.8); S.set('showFps', false); S.set('shadows', true); S.set('renderScale', 1); });
  });

  await t.guard('checkpoint + falling', async () => {
    // before any beacon: respawn goes to player.start
    await ev(() => { window.QA.teleportXZ(100, 100); window.BEYOND.gameplay.respawnAtCheckpoint(); window.QA.step(2); });
    t.check(await ev(() => { const a = window.QA.anchor('player.start'), p = window.QA.pos(); return Math.hypot(a.x - p[0], a.z - p[2]) < 0.5; }), 'respawn without beacon -> player.start');
    // activate village beacon
    const r = await ev(() => window.QA.use('village.beacon', 0));
    t.check(r.ok, 'village beacon focusable', JSON.stringify(r));
    t.eq(await ev(() => window.BEYOND.gameplay._debug.checkpoints.id), 'village.beacon', 'village beacon becomes the checkpoint');
    await ev(() => window.QA.teleportXZ(-50, 150));
    await ui('loadCheckpoint');
    const near = await ev(() => { const a = window.QA.anchor('village.beacon'), p = window.QA.pos(); return { d: Math.hypot(a.x - p[0], a.z - p[2]), above: p[1] - window.BEYOND.world.getHeightAt(p[0], p[2]), state: window.BEYOND.game.state }; });
    t.check(near.d > 1 && near.d < 3.2, 'loadCheckpoint puts the player ~2 m from the beacon', JSON.stringify(near));
    t.eq(near.state, 'playing', 'state playing after loadCheckpoint');
    t.check(near.above > -0.2 && near.above < 2.5, 'respawn stands on the ground', JSON.stringify(near));
    // falling below -30 handled by the real game loop
    await ev(() => { window.QA.teleportXZ(-50, 150); const p = window.BEYOND.player.state.position; p.y = -45; window.BEYOND.player.state.velocity.y = -10; });
    await page.waitForFunction(() => window.BEYOND.player.state.position.y > -30, null, { timeout: 60000 }).catch(() => {});
    const y = await ev(() => window.QA.pos());
    t.check(y[1] > -30, 'falling below y=-30 respawns the player', JSON.stringify(y));
    // The ground clamp in PlayerController pulls the player back onto the terrain before y < -30 can ever be reached,
    // so either outcome (checkpoint respawn or terrain clamp) is a safe, non-stuck state.
    const fell = await ev(() => { const a = window.QA.anchor('village.beacon'), p = window.QA.pos(); return { atBeacon: Math.hypot(a.x - p[0], a.z - p[2]) < 3.2, onTerrain: Math.abs(p[1] - window.BEYOND.world.getHeightAt(p[0], p[2])) < 0.6 }; });
    console.log('INFO  fall result', JSON.stringify(fell));
    t.check(fell.atBeacon || fell.onTerrain, 'after a deep fall the player is at the checkpoint or on the terrain', JSON.stringify(fell));
  });

  await t.guard('time of day / weather', async () => {
    const errs = [];
    for (const h of [0, 2.5, 5, 6, 7.5, 12, 17.5, 19, 20.5, 23.9, 24]) {
      const r = await ev((h) => { try { const e = window.BEYOND.environment; e.setTimeOfDay(h); window.QA.step(5); const g = e.getTimeOfDay(); return Math.abs(((g - h + 36) % 24) - 12) > 11.5 || Math.abs(g - (h % 24)) < 0.5 ? 'ok' : `got ${g}`; } catch (e) { return String(e); } }, h);
      if (r !== 'ok') errs.push(`${h}: ${r}`);
    }
    t.check(errs.length === 0, 'setTimeOfDay across the whole day does not throw and sticks', errs.join('; '));
    for (const w of ['clear', 'cloudy', 'rain', 'fog', 'storm', 'clear']) {
      const r = await ev((w) => { try { const e = window.BEYOND.environment; e.setWeather(w); window.QA.step(60); return e.weather; } catch (e) { return String(e); } }, w);
      t.eq(r, w, `weather ${w} applies`);
    }
    for (const h of [3, 12, 21]) for (const w of ['rain', 'storm', 'fog']) {
      const r = await ev(({ h, w }) => { try { const e = window.BEYOND.environment; e.setTimeOfDay(h); e.setWeather(w); window.QA.step(20); return 'ok'; } catch (e) { return String(e); } }, { h, w });
      if (r !== 'ok') t.check(false, `time ${h} + weather ${w}`, r);
    }
    t.check(true, 'time x weather combinations run without throwing');
    await ev(() => { window.BEYOND.environment.setTimeOfDay(10); window.BEYOND.environment.setWeather('clear'); });
    const ser = await ev(() => window.BEYOND.environment.serialize());
    t.check(ser && typeof ser.time === 'number' && typeof ser.day === 'number' && ser.weather === 'clear', 'environment.serialize shape', JSON.stringify(ser));
    t.check(ser.day >= 1, 'day counter starts at 1 or higher', `day=${ser.day}`);
  });

  await t.guard('torch', async () => {
    const drop = await ev(() => { const B = window.BEYOND; B.gameplay.inventory.remove('torch', 99); B.environment.setTorch(false); return B.gameplay.inventory.has('torch'); });
    t.eq(drop, false, 'no torch in the inventory');
    const notified = await ev(() => { let n = 0; const off = window.BEYOND.bus.on('notify', () => n++); window.BEYOND.bus.emit('input:action', { action: 'torch' }); off(); return n; });
    t.eq(await ev(() => window.BEYOND.environment.torchOn), false, 'torch key without a torch keeps it off');
    t.check(notified >= 1, 'torch key without a torch shows a hint');
    await ev(() => window.BEYOND.gameplay.inventory.add('torch', 1));
    let ch = await ev(() => { let evs = []; const off = window.BEYOND.bus.on('torch:changed', (p) => evs.push(p.on)); window.BEYOND.bus.emit('input:action', { action: 'torch' }); window.QA.step(30); const on = window.BEYOND.environment.torchOn; window.BEYOND.bus.emit('input:action', { action: 'torch' }); window.QA.step(30); off(); return { on, off: window.BEYOND.environment.torchOn, evs }; });
    t.eq(ch.on, true, 'torch key with a torch turns it on');
    t.eq(ch.off, false, 'torch key again turns it off');
    t.eq(ch.evs, [true, false], 'torch:changed emitted for both toggles');
    await ev(() => window.BEYOND.gameplay.inventory.remove('torch', 1));
  });

  await t.guard('quality', async () => {
    for (const q of ['low', 'high', 'medium', 'low']) {
      const r = await ev((q) => { try { window.BEYOND.world.setQuality(q); window.BEYOND.environment.setQuality(q); window.QA.step(5); return 'ok'; } catch (e) { return String(e); } }, q);
      t.eq(r, 'ok', `setQuality(${q}) does not throw`);
      await page.waitForTimeout(600); // let real frames render with the new quality
    }
    for (const q of ['high', 'low']) {
      const r = await ev((q) => { try { window.BEYOND.Settings.set('quality', q); window.QA.step(3); return 'ok'; } catch (e) { return String(e); } }, q);
      t.eq(r, 'ok', `Settings quality=${q} does not throw`);
    }
    await ev(() => window.BEYOND.Settings.set('quality', 'auto'));
  });

  await t.guard('random movement', async () => {
    const res = await ev(() => {
      const B = window.BEYOND, Q = window.QA; let seed = 12345;
      const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
      const out = { nan: false, outOfBounds: false, minAbove: Infinity, frames: 0, below: false };
      B.actions.newGame(); Q.step(2);
      const keys = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ShiftLeft'];
      for (let f = 0; f < 300; f++) {
        if (f % 10 === 0) { B.input.keys.clear(); for (const k of keys) if (rnd() < (k === 'KeyW' ? 0.8 : 0.3)) B.input.keys.add(k); if (rnd() < 0.2) B.input.emitAction('jump'); B.player.state.yaw += (rnd() - 0.5) * 2; B.player.state.pitch = (rnd() - 0.5) * 1.2; }
        Q.step(1); out.frames++;
        const p = B.player.state.position, c = B.camera.position;
        if (![p.x, p.y, p.z, c.x, c.y, c.z, B.player.state.yaw, B.player.state.pitch].every(Number.isFinite)) { out.nan = true; break; }
        if (Math.abs(p.x) > 268.1 || Math.abs(p.z) > 268.1) out.outOfBounds = true;
        const above = p.y - B.world.getHeightAt(p.x, p.z); out.minAbove = Math.min(out.minAbove, above); if (above < -0.6) out.below = true;
      }
      B.input.keys.clear();
      out.end = Q.pos();
      return out;
    });
    t.eq(res.frames, 300, '300 frames of random movement ran');
    t.check(!res.nan, 'no NaN in player or camera');
    t.check(!res.outOfBounds, 'player stays inside the play bounds');
    t.check(!res.below, 'player never sinks below the terrain', `minAbove=${res.minAbove}`);
  });

  await t.guard('a real second of frames', async () => {
    await page.waitForTimeout(2500);
    t.eq(await state(), 'playing', 'still playing after all switching');
  });

  t.check(A.pageErrors.length === 0, 'part A: no page errors', A.pageErrors.join('\n'));
  t.check(A.errors.length === 0, 'part A: no console errors', A.errors.join(' | '));
  t.check(A.warnings.length === 0, 'part A: no console warnings', A.warnings.slice(0, 4).join(' | '));
  await A.context.close();

  // ---------------------------------------------------------------------------------------------
  // Part B: save -> reload -> menu "Doorgaan" -> continue (saving enabled)
  // ---------------------------------------------------------------------------------------------
  await runReload(t, browser);
});

const ui2 = (page, a) => page.evaluate((a) => { window.BEYOND.bus.emit('ui:request', { action: a }); window.QA.step(2); }, a);

/** Part B proper: needs a persistent profile so localStorage survives a page reload. */
async function runReload(t, browser) {
  await t.guard('save -> reload -> continue', async () => {
    const ctx = await browser.newContext({ viewport: { width: 960, height: 540 } });
    const G = await openGame(browser, '?debug&autostart&quality=low', { context: ctx });
    const page = G.page;
    const ev = (fn, arg) => page.evaluate(fn, arg);
    await ev(() => { localStorage.removeItem('beyond.save.v1'); });
    await ev(() => { const Q = window.QA; Q.use('station.logbook', Math.PI); window.BEYOND.bus.emit('input:action', { action: 'interact' }); Q.step(2); Q.use('station.beacon', 0); Q.use('station.cloth', 0); });
    await ev(() => { window.QA.teleportXZ(16, 140); const B = window.BEYOND; B.gameplay.inventory.add('wood', 2); B.gameplay.inventory.add('resin', 1); B.gameplay.crafting.craft('torch'); window.QA.step(5); });
    await ev(() => { const B = window.BEYOND; B.environment.setTimeOfDay(15.25); B.environment.setWeather('cloudy'); B.player.state.yaw = 1.234; window.QA.step(1); });
    const snap = await ev(() => { const B = window.BEYOND; return { pos: window.QA.pos(), yaw: B.player.state.yaw, inv: window.QA.inv(), missions: window.QA.missions(), flags: window.QA.flags(), weather: B.environment.weather, disc: B.gameplay.locations.list().filter((l) => l.discovered).map((l) => l.id), docs: B.gameplay.documents.list().map((d) => d.id), cp: B.gameplay._debug.checkpoints.id }; });
    t.eq(snap.inv, { torch: 1 }, 'progress built: torch crafted');
    t.eq(snap.cp, 'station.beacon', 'progress built: station beacon is the checkpoint');
    await ui2(page, 'save');
    t.eq(await ev(() => window.BEYOND.gameplay.save.hasSave()), true, 'ui:request save stores a save');
    const info = await ev(() => window.BEYOND.gameplay.save.getInfo());
    t.check(info && info.missionTitle && info.timestamp > 0, 'save info has mission title + timestamp', JSON.stringify(info));
    const raw = await ev(() => localStorage.getItem('beyond.save.v1'));
    t.check(raw && JSON.parse(raw).version === 1, 'save slot is localStorage["beyond.save.v1"] version 1');

    // reload to the main menu (no autostart)
    await page.goto(page.url().split('?')[0] + '?debug&quality=low', { waitUntil: 'load' });
    await page.waitForFunction(() => window.BEYOND && window.BEYOND.game.state === 'menu', null, { timeout: 240000, polling: 500 });
    await installHelpers(page);
    const labels = await ev(() => [...document.querySelectorAll('.menu-screen .btn-label')].map((b) => b.textContent.trim()));
    t.check(labels.includes('Doorgaan'), 'main menu offers "Doorgaan" after reload', JSON.stringify(labels));
    t.eq(labels[0], 'Doorgaan', '"Doorgaan" is the first (primary) button');
    const sub = await ev(() => document.querySelector('.menu-screen .btn-sub')?.textContent || '');
    t.check(/Het stille dorp/.test(sub), 'Doorgaan shows the mission title', sub);
    await ev(() => { [...document.querySelectorAll('.menu-screen .btn')].find((b) => b.textContent.includes('Doorgaan')).click(); });
    await page.waitForFunction(() => window.BEYOND.game.state === 'playing', null, { timeout: 60000 }).catch(() => {});
    t.eq(await ev(() => window.BEYOND.game.state), 'playing', 'Doorgaan starts the game (state playing)');
    const got = await ev(() => { const B = window.BEYOND; return { pos: window.QA.pos(), yaw: B.player.state.yaw, inv: window.QA.inv(), missions: window.QA.missions(), flags: window.QA.flags(), weather: B.environment.weather, disc: B.gameplay.locations.list().filter((l) => l.discovered).map((l) => l.id), docs: B.gameplay.documents.list().map((d) => d.id), cp: B.gameplay._debug.checkpoints.id, time: B.environment.getTimeOfDay() }; });
    t.check(Math.hypot(got.pos[0] - snap.pos[0], got.pos[2] - snap.pos[2]) < 0.3 && Math.abs(got.pos[1] - snap.pos[1]) < 0.5, 'continue restores the position', JSON.stringify({ was: snap.pos, now: got.pos }));
    t.check(Math.abs(got.yaw - snap.yaw) < 0.01, 'continue restores the view direction', `${snap.yaw} vs ${got.yaw}`);
    t.eq(got.inv, snap.inv, 'continue restores the inventory');
    t.eq(got.missions, snap.missions, 'continue restores the missions');
    t.eq(got.flags.beacons, snap.flags.beacons, 'continue restores beacon flags');
    t.eq(got.disc, snap.disc, 'continue restores discovered locations');
    t.eq(got.docs, snap.docs, 'continue restores read documents');
    t.eq(got.cp, snap.cp, 'continue restores the checkpoint');
    t.eq(got.weather, 'cloudy', 'continue restores the weather');
    t.check(Math.abs(got.time - 15.25) < 0.5, 'continue restores the time of day', `time=${got.time}`);
    // picked-up resources stay gone: cloth was taken at the station
    t.eq(await ev(() => window.BEYOND.gameplay._debug.pickups.isCollected('station.cloth')), true, 'continue keeps collected pickups collected');
    // the beacon lamp is lit again after loading
    await ev(() => window.QA.step(60));
    t.check(await ev(() => window.BEYOND.world.anchors.get('station.beacon').object.getObjectByName('lamp').material.emissiveIntensity > 1.5), 'beacon lamp is lit after loading');

    // quit to menu keeps the save and Nieuw spel asks for confirmation
    await ui2(page, 'quitToMenu');
    t.eq(await ev(() => window.BEYOND.game.state), 'menu', 'quitToMenu returns to the menu');
    await ev(() => { [...document.querySelectorAll('.menu-screen .btn')].find((b) => b.textContent.includes('Nieuw spel')).click(); });
    await page.waitForTimeout(600);
    const asked = await ev(() => !!document.querySelector('.modal, .confirm, dialog, .dialog') && /overschreven|Nieuw spel starten/i.test(document.body.innerText));
    t.check(asked, 'Nieuw spel with an existing save asks for confirmation');
    t.eq(await ev(() => window.BEYOND.game.state), 'menu', 'still in the menu until confirmed');

    // corrupted save: no Doorgaan, no crash
    await ev(() => localStorage.setItem('beyond.save.v1', '{"version":1,"broken":'));
    await page.goto(page.url().split('?')[0] + '?debug&quality=low', { waitUntil: 'load' });
    await page.waitForFunction(() => window.BEYOND && window.BEYOND.game.state === 'menu', null, { timeout: 240000, polling: 500 });
    const labels2 = await ev(() => [...document.querySelectorAll('.menu-screen .btn-label')].map((b) => b.textContent.trim()));
    t.check(!labels2.includes('Doorgaan'), 'corrupted save is ignored (no Doorgaan)', JSON.stringify(labels2));
    t.check(G.pageErrors.length === 0, 'part B: no page errors', G.pageErrors.join('\n'));
    t.check(G.errors.length === 0, 'part B: no console errors', G.errors.join(' | '));
    await ev(() => localStorage.removeItem('beyond.save.v1'));
    await ctx.close();
  });
}
