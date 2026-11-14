// Performance profile: renders the full game at several camera spots for each quality preset and prints
// draw calls, triangles (incl. shadow pass), programs, geometries, textures, heap, CPU ms and load times.
//   node dev/perf-profile.mjs [--port 5188] [--presets low,medium,high] [--spots station,forest,...]
//                             [--json out.json] [--leak] [--shots dir]
// Headless SwiftShader FPS is meaningless; only counts and CPU-side update cost are reported.
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = await import('playwright')); }

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 ? args[i + 1] : d; };
const port = opt('port', '5188');
const presets = opt('presets', 'low,medium,high').split(',');
const SPOTS = {
  station: { x: 20, z: 172, yaw: Math.PI },
  forest: { x: 10, z: 120, yaw: 0.3 },
  village: { x: 165, z: 10, yaw: 0.2 },
  temple: { x: 0, z: -140, yaw: 0 },
  lake: { x: 100, z: 100, yaw: -2.4 },
  bunker: { x: -185, z: 62, yaw: 0, anchor: 'bunker.terminal' },
  cave: { x: -103, z: -199, yaw: 0, anchor: 'cave.sundisc' },
};
const spotNames = opt('spots', Object.keys(SPOTS).join(',')).split(',');
const leak = args.includes('--leak');
const shotsDir = opt('shots', '');
if (shotsDir) fs.mkdirSync(shotsDir, { recursive: true });

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-precise-memory-info'] });
const results = [];

for (const preset of presets) {
 try {
  const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
  const msgs = [];
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') msgs.push(`[${m.type()}] ${m.text().slice(0, 160)}`); });
  page.on('pageerror', (e) => msgs.push(`[pageerror] ${e.message}`));
  await page.addInitScript((wantShots) => {
    window.__wantShots = wantShots;
    window.__stages = [];
    window.__long = [];
    const t0 = performance.now();
    try { new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__long.push(Math.round(e.duration)); }).observe({ entryTypes: ['longtask'] }); } catch { /* unsupported */ }
    const seen = new Set();
    new MutationObserver(() => {
      const el = document.querySelector('.load-label');
      if (el && !seen.has(el.textContent)) { seen.add(el.textContent); window.__stages.push([el.textContent, Math.round(performance.now() - t0)]); }
    }).observe(document, { subtree: true, childList: true, characterData: true });
  }, !!shotsDir);
  const t0 = Date.now();
  await page.goto(`http://localhost:${port}/index.html?debug&autostart&nosave&quality=${preset}`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.BEYOND && window.BEYOND.game.state === 'playing', null, { timeout: 240000 });
  const loadMs = Date.now() - t0;
  const boot = await page.evaluate(() => ({ stages: window.__stages, long: window.__long.slice().sort((a, b) => b - a).slice(0, 6) }));
  await page.waitForTimeout(1500);

  for (const name of spotNames) {
    const spot = SPOTS[name];
    const m = await page.evaluate(async ({ spot, name }) => {
      const B = window.BEYOND;
      const { renderer, scene, camera, player, world, perf } = B;
      let y = world.getHeightAt(spot.x, spot.z);
      let x = spot.x, z = spot.z;
      if (spot.anchor && world.anchors.has(spot.anchor)) {
        const a = world.anchors.get(spot.anchor);
        const p = a.position || a.pos || a;
        x = p.x - 0.0; z = p.z + 1.5; y = p.y - 0.8;
        if (name === 'bunker' || name === 'cave') { y = p.y - 0.9; }
      }
      player.teleport(new B.THREE.Vector3(x, y, z), spot.yaw, 0);
      if (name === 'lake') player.state.pitch = -0.15;
      // sample real frames for 4 s: how many of them re-render the shadow map
      const smS = renderer.shadowMap, origS = smS.render.bind(smS);
      let frames = 0, shadowed = 0;
      smS.render = (...a) => { frames++; if (smS.autoUpdate || smS.needsUpdate) shadowed++; return origS(...a); };
      await new Promise((r) => setTimeout(r, 4000));
      smS.render = origS;
      const shadowRenders = frames ? +(shadowed / frames).toFixed(2) : 0;
      const heapBefore = performance.memory ? performance.memory.usedJSHeapSize : 0;
      // count a full frame including the shadow pass
      renderer.info.autoReset = false;
      const sm = renderer.shadowMap;
      const wasAuto = sm.autoUpdate;
      sm.autoUpdate = false;
      sm.needsUpdate = true;      // full frame including a shadow-map render
      renderer.info.reset();
      renderer.render(scene, camera);
      const total = { calls: renderer.info.render.calls, tris: renderer.info.render.triangles };
      sm.needsUpdate = false;     // main pass alone
      renderer.info.reset();
      renderer.render(scene, camera);
      const main = { calls: renderer.info.render.calls, tris: renderer.info.render.triangles };
      sm.autoUpdate = wasAuto;
      renderer.info.autoReset = true;
      renderer.info.reset();
      let shadowCasters = 0;
      scene.traverse((o) => { if (o.isMesh && o.castShadow && o.visible) shadowCasters++; });
      let shot = '';
      if (window.__wantShots) { renderer.render(scene, camera); shot = renderer.domElement.toDataURL('image/jpeg', 0.85); }
      return {
        shot,
        spot: name,
        calls: total.calls, tris: total.tris, mainCalls: main.calls, mainTris: main.tris,
        shadowCalls: total.calls - main.calls, shadowTris: total.tris - main.tris, shadowRenders,
        programs: renderer.info.programs.length, geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures,
        heapMB: +(heapBefore / 1048576).toFixed(1), cpuMs: +perf.cpuMs.toFixed(1), shadowCasters,
        stats: perf.stats(),
      };
    }, { spot, name });
    if (shotsDir && m.shot) fs.writeFileSync(`${shotsDir}/${preset}-${name}.jpg`, Buffer.from(m.shot.split(',')[1], 'base64'));
    delete m.shot;
    results.push({ preset, ...m });
    console.log(`[${preset}] ${name}: calls ${m.calls} (main ${m.mainCalls} + shadow ${m.shadowCalls}), tris ${Math.round(m.tris / 1000)}k (shadow ${Math.round(m.shadowTris / 1000)}k), progs ${m.programs}`);
  }

  if (leak) {
    const snap = () => page.evaluate(() => ({ g: window.BEYOND.renderer.info.memory.geometries, t: window.BEYOND.renderer.info.memory.textures, p: window.BEYOND.renderer.info.programs.length, heap: performance.memory ? +(performance.memory.usedJSHeapSize / 1048576).toFixed(1) : 0 }));
    const before = await snap();
    for (let i = 0; i < 5; i++) {
      await page.evaluate(() => { window.BEYOND.actions.quitToMenu(); window.BEYOND.actions.newGame(); });
      await page.waitForTimeout(800);
    }
    const afterNew = await snap();
    for (const q of ['high', 'low', 'medium', 'high', 'low', preset]) {
      await page.evaluate((qq) => window.BEYOND.world.setQuality(qq), q);
      await page.waitForTimeout(500);
    }
    const afterQ = await snap();
    results.push({ preset, spot: 'LEAK', before, afterNewGameX5: afterNew, afterQualitySwitches: afterQ });
  }

  results.push({ preset, spot: 'BOOT', loadMs, ...boot, messages: [...new Set(msgs)].slice(0, 12), msgCount: msgs.length });
  await page.close();
 } catch (err) { console.log(`[${preset}] FAILED: ${err.message.split('\n')[0]}`); }
}
await browser.close();

for (const preset of presets) {
  console.log(`\n=== ${preset} ===`);
  console.log('spot      calls  tris(k)  main/shadow calls  main/shadow tris(k)  shRend  progs  geoms  texs  heapMB  cpuMs  casters');
  for (const r of results.filter((x) => x.preset === preset && x.calls !== undefined)) {
    console.log(`${r.spot.padEnd(9)} ${String(r.calls).padStart(5)} ${String(Math.round(r.tris / 1000)).padStart(8)}   ${String(r.mainCalls).padStart(5)}/${String(r.shadowCalls).padEnd(5)}         ${String(Math.round(r.mainTris / 1000)).padStart(6)}/${String(Math.round(r.shadowTris / 1000)).padEnd(6)}   ${String(r.shadowRenders).padStart(4)}  ${String(r.programs).padStart(5)} ${String(r.geometries).padStart(6)} ${String(r.textures).padStart(5)} ${String(r.heapMB).padStart(7)} ${String(r.cpuMs).padStart(6)} ${String(r.shadowCasters).padStart(7)}`);
  }
  const b = results.find((x) => x.preset === preset && x.spot === 'BOOT');
  if (!b) continue;
  console.log(`load (to playing): ${b.loadMs} ms; longest long-tasks ms: ${b.long.join(', ')}; console msgs: ${b.msgCount}`);
  console.log('stages: ' + b.stages.map(([l, t]) => `${l}@${t}`).join(' | '));
  if (b.messages.length) console.log('messages:\n  ' + b.messages.join('\n  '));
  const l = results.find((x) => x.preset === preset && x.spot === 'LEAK');
  if (l) console.log('leak:', JSON.stringify(l));
}
const out = opt('json', '');
if (out) fs.writeFileSync(out, JSON.stringify(results, null, 1));
