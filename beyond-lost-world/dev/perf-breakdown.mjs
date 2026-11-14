// Per-spot draw-call breakdown: which meshes (grouped by name) cost draw calls/triangles in the main and shadow pass.
//   node dev/perf-breakdown.mjs --preset medium --spot x,z,yaw [--port 5188]
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = await import('playwright')); }
const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 ? args[i + 1] : d; };
const [sx, sz, syaw] = opt('spot', '20,190,3.14').split(',').map(Number);
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
page.on('pageerror', (e) => console.log('pageerror', e.message));
await page.goto(`http://localhost:${opt('port', '5188')}/index.html?debug&autostart&nosave&quality=${opt('preset', 'medium')}`);
await page.waitForFunction(() => window.BEYOND && window.BEYOND.game.state === 'playing', null, { timeout: 240000 });
const out = await page.evaluate(async ({ sx, sz, syaw }) => {
  const B = window.BEYOND; const { renderer, scene, camera, player, world } = B;
  player.teleport(new B.THREE.Vector3(sx, world.getHeightAt(sx, sz), sz), syaw, 0);
  await new Promise((r) => setTimeout(r, 2500));
  const rec = { main: new Map(), shadow: new Map() };
  let pass = 'main';
  const orig = renderer.renderBufferDirect;
  renderer.renderBufferDirect = function (cam, sc, geo, mat, obj, group) {
    const key = (obj.name || (obj.parent && obj.parent.name ? obj.parent.name + '/' : '') + obj.type).replace(/[-_:]?\d+(,\d+)?$/, '#') + (mat.isShaderMaterial ? ' [shader]' : '');
    const m = rec[pass]; const e = m.get(key) || { calls: 0, tris: 0 };
    const idx = geo.index ? geo.index.count : geo.attributes.position.count;
    let cnt = group ? group.count : idx; if (obj.isInstancedMesh) cnt *= obj.count; else if (geo.isInstancedBufferGeometry) cnt *= geo.instanceCount;
    e.calls++; e.tris += cnt / 3; m.set(key, e);
    return orig.apply(this, arguments);
  };
  const sm = renderer.shadowMap, so = sm.render.bind(sm);
  sm.render = (...a) => { pass = 'shadow'; const r = so(...a); pass = 'main'; return r; };
  renderer.shadowMap.autoUpdate = false; renderer.shadowMap.needsUpdate = true;
  renderer.render(scene, camera);
  renderer.renderBufferDirect = orig; sm.render = so;
  const fmt = (m) => [...m].sort((a, b) => b[1].tris - a[1].tris).map(([k, v]) => `${k.padEnd(40)} calls ${String(v.calls).padStart(4)}  tris ${String(Math.round(v.tris / 1000)).padStart(6)}k`);
  return { main: fmt(rec.main), shadow: fmt(rec.shadow) };
}, { sx, sz, syaw });
const cat = (l) => { const c = {}; for (const r of l) { const name = r.split(/\s{2,}/)[0]; const n = Number(r.match(/calls\s+(\d+)/)[1]); const k = /^(oak|spruce|birch|boulder|cliffrock|pebble)/.test(name) ? 'instanced vegetation' : /^plants/.test(name) ? 'plant cells' : /^terrain/.test(name) ? 'terrain' : /^grass/.test(name) ? 'grass' : /^(pickups|doc_|item_|glint)/.test(name) ? 'gameplay objects' : /\[shader\]|^mist|^splash|Sky/.test(name) ? 'water/sky' : /:/.test(name) || /^(pillar|lamp|led|screen|structures|cups|vane)/.test(name) ? 'structures' : 'other:' + name; c[k] = (c[k] || 0) + n; } return Object.entries(c).map(([k, v]) => k + '=' + v).join('  '); };
const total = (l) => l.reduce((a, r) => a + Number(r.match(/calls\s+(\d+)/)[1]), 0);
console.log('CATEGORIES main:', cat(out.main), '\nCATEGORIES shadow:', cat(out.shadow));
console.log(`--- MAIN (${total(out.main)} calls, ${out.main.length} groups) ---\n` + out.main.slice(0, 100).join('\n') + `\n--- SHADOW (${total(out.shadow)} calls) ---\n` + out.shadow.slice(0, 30).join('\n'));
await browser.close();
