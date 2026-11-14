// Physical reachability with the real colliders: scripted walking (W held, yaw steered), doors, bridges and
// a standing spot for every interactable.
import { openGame, runMain } from './lib.mjs';

runMain('reachability', async (t, browser) => {
  const { page, errors, pageErrors } = await openGame(browser);
  const ev = (fn, arg) => page.evaluate(fn, arg);
  const reach = (x, z, opts = {}) => ev(({ x, z, opts }) => window.QA.goTo(x, z, opts), { x, z, opts });
  const plan = (x, z) => ev(({ x, z }) => { const r = window.QA.planAuto(x, z, { radii: [0.36] }); return { reached: r.reached, closest: r.closest, explored: r.explored }; }, { x, z });
  const tp = (x, z, yaw = 0) => ev(({ x, z, yaw }) => window.QA.teleportXZ(x, z, yaw), { x, z, yaw });
  const zoneOf = (id) => ev((id) => { const B = window.BEYOND, p = B.player.state.position, z = B.world.interiorZones.find((q) => q.id === id); if (!z) return null; const dx = p.x - z.x, dz = p.z - z.z, c = Math.cos(z.rot), s = Math.sin(z.rot); const lx = dx * c - dz * s, lz = dx * s + dz * c; return Math.abs(lx) <= z.hx && Math.abs(lz) <= z.hz && p.y >= z.yMin - 0.5 && p.y <= z.yMax; }, id);
  const spotFor = (id, from = 0) => ev(({ id, from }) => { const r = window.QA.focusOn(id, from); return r.ok ? { x: window.QA.pos()[0], z: window.QA.pos()[2], y: window.QA.pos()[1] } : { fail: r }; }, { id, from });
  const give = (item) => ev((i) => window.BEYOND.gameplay.inventory.add(i, 1), item);
  const frames = (n) => ev((n) => window.QA.step(n), n);
  const walkCheck = (r, label, tolEnd = 1.5) => {
    t.check(r.planned, `${label}: a path exists`, r.planned ? '' : `closest approach ${JSON.stringify(r.closest)} (explored ${r.explored})`);
    if (!r.planned) return false;
    t.check(r.reached || r.endDist < tolEnd, `${label}: scripted walk reaches the goal`, `endDist=${r.endDist?.toFixed(2)} stuck=${r.stuck} last=${JSON.stringify(r.last)}`);
    t.check(!r.nan, `${label}: no NaN position`);
    t.check(!r.sunk, `${label}: never below the terrain`, `minAboveTerrain=${r.minAboveTerrain?.toFixed(2)}`);
    return r.reached || r.endDist < tolEnd;
  };

  t.check(pageErrors.length === 0, 'no page errors at boot', pageErrors.join('\n'));

  // ---- 7. every interactable has a standing spot -------------------------------------------------------
  await t.guard('interactables', async () => {
    await ev(() => { window.BEYOND.actions.newGame(); window.QA.step(3); }); // fresh state: every interactable still enabled
    const res = await ev(() => {
      const B = window.BEYOND, out = { fails: [], total: 0 };
      for (const d of B.gameplay._debug.interaction.list()) {
        out.total++;
        const r = window.QA.focusOn(d.id, 0);
        if (!r.ok) out.fails.push({ id: d.id, why: r.why, box: r.box });
      }
      return out;
    });
    console.log(`INFO  ${res.total} interactables checked`);
    t.check(res.total > 100, `interactables: ${res.total} registered`);
    t.check(res.fails.length === 0, `interactables: every one has a free, dry standing spot where it is focused (${res.fails.length} failed)`, JSON.stringify(res.fails.slice(0, 12)));
    for (const f of res.fails) t.check(false, `interactable ${f.id} focusable`, `${f.why} box=${JSON.stringify(f.box)}`);
  });

  // ---- 1. station: out of the door to the north --------------------------------------------------
  await t.guard('station', async () => {
    await ev(() => { window.BEYOND.actions.newGame(); window.QA.step(3); });
    t.eq(await zoneOf('station_main'), true, 'station: player.start is inside the station interior zone');
    const r = await reach(16, 150);
    walkCheck(r, 'station: out of the door to the station road');
    t.eq(await zoneOf('station_main'), false, 'station: player ends outside the station interior zone');
    // walk back in and to the logbook / cloth spots (items inside must be reachable from outside)
    for (const id of ['station.logbook', 'station.cloth']) {
      const s = await ev((id) => { const r = window.QA.focusOn(id, 0); return r.ok ? { ok: true, x: window.QA.pos()[0], z: window.QA.pos()[2] } : r; }, id);
      t.check(s.ok, `station: standing spot for ${id}`, JSON.stringify(s));
      if (!s.ok) continue;
      await tp(16, 150);
      const w = await reach(s.x, s.z, { endTol: 1.5 });
      walkCheck(w, `station: walk from the road to ${id}`);
    }
  });

  // ---- 2. elder's house after the boards are removed ------------------------------------------------
  await t.guard('elder house', async () => {
    await tp(165, -26);
    const door = await ev(() => { const r = window.QA.focusOn('village.journal', Math.PI / 2); return r.ok ? { x: window.QA.pos()[0], z: window.QA.pos()[2] } : r; });
    t.check(door.x !== undefined, 'elder: standing spot at the journal', JSON.stringify(door));
    await tp(165, -26);
    const blocked = await plan(door.x, door.z);
    t.eq(blocked.reached, false, 'elder: house unreachable while the boards are nailed up');
    await give('crowbar');
    await tp(165, -26);
    const u = await ev(() => { const r = window.QA.use('village.elderDoor', 0); window.QA.step(60); return r; });
    t.check(u.ok, 'elder: could pry the boards open', JSON.stringify(u));
    await tp(165, -26);
    const r = await reach(door.x, door.z);
    walkCheck(r, 'elder: walk into the house to the journal');
    t.eq(await zoneOf('village_elder_house'), true, 'elder: player ended inside the house');
  });

  // ---- 3. temple: gate, sanctum, keycard ---------------------------------------------------------
  await t.guard('temple', async () => {
    await tp(0, -146);
    const key = await ev(() => { const r = window.QA.focusOn('temple.keycard', 0); return r.ok ? { x: window.QA.pos()[0], z: window.QA.pos()[2], y: window.QA.pos()[1] } : r; });
    t.check(key.x !== undefined, 'temple: standing spot at the keycard', JSON.stringify(key));
    const rec = await ev(() => { const r = window.QA.focusOn('temple.recording', 0); return r.ok ? { x: window.QA.pos()[0], z: window.QA.pos()[2] } : r; });
    await tp(0, -146);
    const altar = await ev(() => { const r = window.QA.focusOn('temple.altar', 0); return r.ok ? { x: window.QA.pos()[0], z: window.QA.pos()[2] } : r; });
    await tp(0, -146);
    const a = await reach(altar.x, altar.z);
    walkCheck(a, 'temple: walk up the temple road/stairs to the altar');
    const toAltar = () => ev(() => window.QA.focusOn('temple.altar', 0)); // continue the checks from the platform even if the stairs are broken
    await toAltar();
    t.eq((await plan(key.x, key.z)).reached, false, 'temple: sanctum unreachable while the gate is shut');
    // solve the puzzle with the real interactions
    await give('sundisc');
    await ev(() => { window.QA.use('temple.altar', 0); window.QA.step(40); });
    for (const [id, n] of [['temple.pillar1', 3], ['temple.pillar2', 0], ['temple.pillar3', 2]]) for (let i = 0; i < n; i++) await ev((id) => { window.QA.use(id, 0); window.QA.step(40); }, id);
    await frames(150);
    t.eq(await ev(() => window.QA.flags().gateOpen), true, 'temple: gate opened by the pillar puzzle');
    await toAltar();
    const k = await reach(key.x, key.z);
    walkCheck(k, 'temple: walk through the open gate to the keycard');
    t.eq(await zoneOf('temple_sanctum'), true, 'temple: player ended inside the sanctum');
    if (rec.x !== undefined) { const r2 = await reach(rec.x, rec.z, { endTol: 1.5 }); walkCheck(r2, 'temple: walk on to the recorder'); }
    const back = await reach(0, -170);
    walkCheck(back, 'temple: walk back out through the gate');
  });

  // ---- 4. bunker: blast door, inner door ------------------------------------------------------------
  await t.guard('bunker', async () => {
    await tp(-164, 55);
    const gen = await ev(() => { const r = window.QA.focusOn('bunker.generator', Math.PI); return r.ok ? { x: window.QA.pos()[0], z: window.QA.pos()[2] } : r; });
    await tp(-164, 55);
    const term = await ev(() => { const r = window.QA.focusOn('bunker.terminal', Math.PI / 2); return r.ok ? { x: window.QA.pos()[0], z: window.QA.pos()[2] } : r; });
    await tp(-164, 55);
    t.check(gen.x !== undefined && term.x !== undefined, 'bunker: standing spots at generator and terminal', JSON.stringify({ gen, term }));
    t.eq((await plan(gen.x, gen.z)).reached, false, 'bunker: interior unreachable while the blast door is shut');
    await give('keycard');
    await ev(() => { window.QA.use('bunker.reader', 0); window.QA.step(200); });
    t.eq(await ev(() => window.QA.flags().bunkerDoorOpen), true, 'bunker: blast door opens with the keycard');
    await tp(-164, 55);
    walkCheck(await reach(gen.x, gen.z, { endTol: 1.5 }), 'bunker: walk through the blast door to the generator');
    t.eq((await plan(term.x, term.z)).reached, false, 'bunker: control room unreachable while the inner door is shut');
    await ev(() => { window.QA.use('bunker.generator', Math.PI); window.QA.step(60); });
    await ev(() => { window.QA.use('bunker.innerDoor', 0); window.QA.step(150); });
    t.eq(await ev(() => window.QA.flags().innerDoorOpen), true, 'bunker: inner door opened after power');
    walkCheck(await reach(term.x, term.z, { endTol: 1.5 }), 'bunker: walk through the inner door to the terminal');
    t.eq(await zoneOf('bunker_control'), true, 'bunker: player ended inside the control room');
  });

  // ---- 5. waterfall pool -> cave mouth -> sun disc ----------------------------------------------------
  await t.guard('cave', async () => {
    await tp(-124, -140);
    const disc = await ev(() => { const r = window.QA.focusOn('cave.sundisc', 0); return r.ok ? { x: window.QA.pos()[0], z: window.QA.pos()[2] } : r; });
    t.check(disc.x !== undefined, 'cave: standing spot at the sun disc pedestal', JSON.stringify(disc));
    await tp(-124, -140);
    walkCheck(await reach(disc.x, disc.z, { endTol: 1.5 }), 'cave: walk from the waterfall trail into the cave to the sun disc');
    t.eq(await zoneOf('cave_chamber'), true, 'cave: player ended in the cave chamber');
    // from the pool's shore
    const beacon = await ev(() => { const r = window.QA.focusOn('waterfall.beacon', 0); return r.ok ? { x: window.QA.pos()[0], z: window.QA.pos()[2] } : r; });
    t.check(beacon.x !== undefined, 'cave: standing spot at the waterfall beacon');
    await ev(() => { const a = window.QA.anchor('waterfall.beacon'); window.QA.stand(a.x, a.y, a.z, 0, 2); window.QA.step(2); });
    walkCheck(await reach(disc.x, disc.z, { endTol: 1.5 }), 'cave: walk from the waterfall beacon to the sun disc');
    // and back out
    walkCheck(await reach(-124, -140, { endTol: 2 }), 'cave: walk back out to the trail');
  });

  // ---- 6. both bridges along their paths ------------------------------------------------------------
  await t.guard('bridges', async () => {
    const cr = await ev(() => window.BEYOND.layout.findPathRiverCrossings().map((c) => ({ x: c.x, z: c.z, angle: c.angle, waterY: c.waterY })));
    t.check(cr.length >= 2, `bridges: layout has ${cr.length} path/river crossings (expected >= 2)`);
    for (const [k, c] of cr.entries()) {
      const dx = Math.sin(c.angle), dz = Math.cos(c.angle);
      const pts = [-24, -12, 0, 12, 24].map((d) => ({ x: c.x + dx * d, z: c.z + dz * d }));
      await tp(pts[0].x, pts[0].z);
      const r = await ev((pts) => { const w = window.QA.walk(pts, { tol: 1.0, maxFrames: 1200 }); w.y = window.QA.pos()[1]; return w; }, pts);
      t.check(r.reached, `bridge ${k + 1} at (${c.x.toFixed(0)},${c.z.toFixed(0)}): scripted walk across the river along the path`, JSON.stringify(r.last) + ` stuck=${r.stuck}`);
      t.check(!r.inWater, `bridge ${k + 1}: stays dry (never in water)`);
      t.check(!r.sunk && !r.nan, `bridge ${k + 1}: never sunk / NaN`);
      t.check(r.maxStepUp < 0.6, `bridge ${k + 1}: no sudden vertical jumps`, `maxStepUp=${r.maxStepUp.toFixed(2)}`);
    }
  });

  // ---- 8. resource spots sanity -----------------------------------------------------------------------
  await t.guard('resource spots', async () => {
    const bad = await ev(() => {
      const B = window.BEYOND, bad = [];
      for (const s of B.world.resourceSpots) {
        const p = s.position, th = B.world.getHeightAt(p.x, p.z), ws = B.world.getWaterSurfaceAt(p.x, p.z);
        const why = [];
        if (p.x === 0 && p.y === 0 && p.z === 0) why.push('at world origin (0,0,0)');
        else {
          if (Math.abs(p.y - th) > 1.5) why.push(`y=${p.y.toFixed(2)} vs terrain ${th.toFixed(2)}`);
          if (ws !== null && ws !== undefined && ws - th > 0.9 && !B.player.collision.groundInfoAt(p.x, p.z, 0.2, p.y + 0.5).collider) why.push('in deep water');
          if (Math.abs(p.x) > 268 || Math.abs(p.z) > 268) why.push('outside the play bounds');
        }
        if (why.length) bad.push({ id: s.id, type: s.type, pos: [+p.x.toFixed(1), +p.y.toFixed(1), +p.z.toFixed(1)], why: why.join(', ') });
      }
      return bad;
    });
    t.check(bad.length === 0, `resource spots: none misplaced (${bad.length} bad)`, JSON.stringify(bad));
    for (const b of bad) t.check(false, `resource spot ${b.id} (${b.type}) placed sensibly`, `${b.why} @ ${JSON.stringify(b.pos)}`);
    const need = await ev(() => { const c = {}; for (const s of window.BEYOND.world.resourceSpots) if (!(s.position.x === 0 && s.position.y === 0 && s.position.z === 0)) c[s.type] = (c[s.type] || 0) + 1; return c; });
    t.check(need.wood >= 2 && need.resin >= 1 && need.fiber >= 2, 'resource spots: enough wood/resin/fiber for chapter 1 (excluding origin spots)', JSON.stringify(need));
  });

  t.check(pageErrors.length === 0, 'no page errors during the walks', pageErrors.join('\n'));
  t.check(errors.length === 0, 'no console errors during the walks', errors.join(' | '));
});
