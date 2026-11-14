// Plays the whole of chapter 1 in the real game, step by step, plus negative cases.
import { openGame, runMain, step, interact } from './lib.mjs';

runMain('chapter', async (t, browser) => {
  const { page, errors, pageErrors } = await openGame(browser);
  const ev = (fn, ...a) => page.evaluate(fn, ...a);
  const S = () => ev(() => ({ state: window.BEYOND.game.state, inv: window.QA.inv(), flags: window.QA.flags(), missions: window.QA.missions(), pos: window.QA.pos() }));

  /** teleport in front of the interactable, check focus + prompt, press E. */
  async function use(id, expectedPrompt, label, from = 0, opts = {}) {
    const r = await ev((a) => window.QA.focusOn(a.id, a.from, a.opts), { id, from, opts });
    t.check(r.ok, `${label}: focus on ${id}`, JSON.stringify(r));
    if (!r.ok) return false;
    if (expectedPrompt) t.eq(r.prompt, expectedPrompt, `${label}: prompt`);
    await interact(page, 3);
    return true;
  }
  const closeDoc = async (label) => {
    t.eq(await ev(() => window.BEYOND.game.state), 'reading', `${label}: state is reading`);
    await ev(() => { window.BEYOND.bus.emit('input:action', { action: 'interact' }); window.QA.step(2); });
    t.eq(await ev(() => window.BEYOND.game.state), 'playing', `${label}: closed with E, back to playing`);
  };
  const mission = async (id) => (await S()).missions.find((m) => m.id === id);
  const teleport = (x, z, yaw = 0) => ev(({ x, z, yaw }) => { const B = window.BEYOND; B.player.teleport(new B.THREE.Vector3(x, B.world.getHeightAt(x, z), z), yaw, 0); window.QA.step(3); }, { x, z, yaw });

  t.check(pageErrors.length === 0, 'no page errors at boot', pageErrors.join('\n'));

  // ---------------------------------------------------------------------------------------------
  // Negative cases in the real world (fresh game, empty inventory)
  // ---------------------------------------------------------------------------------------------
  await t.guard('negative cases', async () => {
    // boards without crowbar
    if (await use('village.elderDoor', 'Openbreken: Planken (koevoet)', 'neg boards', 0)) {
      const s = await S();
      t.eq(s.flags.elderDoorOpen, false, 'neg: boards stay shut without a crowbar');
      t.check(await ev(() => window.BEYOND.world.colliders.find((c) => c.id === 'village.elderDoor').enabled), 'neg: elder door collider still enabled');
    }
    // altar without disc, pillars before disc
    if (await use('temple.altar', 'Plaatsen: Zonneschijf', 'neg altar', 0)) t.eq((await S()).flags.discPlaced, false, 'neg: altar without disc does nothing');
    if (await use('temple.pillar1', null, 'neg pillar', 0)) {
      await ev(() => window.QA.step(40));
      const s = await S();
      t.eq(s.flags.pillars, [0, 0, 0], 'neg: pillars do not turn before the disc is placed');
    }
    // bunker reader without keycard
    if (await use('bunker.reader', 'Sleutelkaart gebruiken', 'neg reader', 0)) {
      await ev(() => window.QA.step(10));
      const s = await S();
      t.eq(s.flags.bunkerDoorOpen, false, 'neg: reader without keycard keeps blast door shut');
      t.check(await ev(() => window.BEYOND.world.colliders.find((c) => c.id === 'bunker.door').enabled), 'neg: blast door collider enabled');
    }
    // inner door without power
    if (await use('bunker.innerDoor', 'Openen: Controlekamer', 'neg inner door', 0)) {
      await ev(() => window.QA.step(10));
      const s = await S();
      t.eq(s.flags.innerDoorOpen, false, 'neg: inner door stays shut without power');
      t.check(await ev(() => window.BEYOND.world.colliders.find((c) => c.id === 'bunker.innerDoor').enabled), 'neg: inner door collider enabled');
    }
    // terminal without power
    if (await use('bunker.terminal', 'Gebruiken: Terminal', 'neg terminal', 0)) {
      t.eq(await ev(() => window.BEYOND.game.state), 'playing', 'neg: terminal without power does not open a document');
    }
    // crafting without ingredients
    t.eq(await ev(() => window.BEYOND.gameplay.crafting.craft('torch')), false, 'neg: torch cannot be crafted without ingredients');
    t.eq(await ev(() => window.BEYOND.gameplay.crafting.craft('crowbar')), false, 'neg: crowbar cannot be crafted without ingredients');
    // torch toggle without torch
    await ev(() => { window.BEYOND.bus.emit('input:action', { action: 'torch' }); });
    t.eq(await ev(() => window.BEYOND.environment.torchOn), false, 'neg: torch key does nothing without a torch');
  });

  // ---------------------------------------------------------------------------------------------
  // The real chapter, from a fresh new game
  // ---------------------------------------------------------------------------------------------
  await ev(() => { window.BEYOND.actions.newGame(); window.QA.step(3); });
  let s = await S();
  t.eq(s.state, 'playing', 'new game: state playing');
  t.eq(s.missions.map((m) => m.status), ['active', 'locked', 'locked', 'locked', 'locked', 'locked'], 'new game: only mission 1 active');
  t.eq(s.inv, {}, 'new game: inventory empty');
  const startOK = await ev(() => { const a = window.QA.anchor('player.start'); const p = window.QA.pos(); return Math.hypot(a.x - p[0], a.z - p[2]) < 0.5; });
  t.check(startOK, 'new game: player at player.start');

  // --- Mission 1 ---
  await t.guard('m1', async () => {
    if (await use('station.logbook', 'Lezen: Logboek van Dr. Vos', 'logbook', Math.PI)) {
      await closeDoc('logbook');
      t.check((await mission('m1')).done.includes('logbook'), 'm1: objective logbook done');
    }
    if (await use('station.beacon', 'Activeren: Noodbaken', 'station beacon', 0)) {
      s = await S();
      t.eq(s.flags.beacons['station.beacon'], true, 'm1: station beacon active');
      t.eq(await ev(() => window.BEYOND.gameplay._debug.checkpoints.id), 'station.beacon', 'm1: checkpoint set to station beacon');
      t.check((await mission('m1')).done.includes('beacon'), 'm1: objective beacon done');
      const lamp = await ev(() => { window.QA.step(60); const o = window.BEYOND.world.anchors.get('station.beacon').object.getObjectByName('lamp'); return o.material.emissiveIntensity; });
      t.check(lamp > 1.5, 'm1: beacon lamp glows after activation', `emissiveIntensity=${lamp}`);
    }
    if (await use('station.cloth', 'Oppakken: Lap stof', 'cloth', 0)) {
      t.eq((await S()).inv.cloth, 1, 'cloth picked up');
    }
    s = await S();
    t.check(!(await mission('m1')).done.includes('leave'), 'm1: leave not done while at the station');
    await teleport(16, 140);
    await ev(() => window.QA.step(3));
    s = await S();
    t.eq(s.missions[0].status, 'done', 'm1: done after leaving the station (>40 m)');
    t.eq(s.missions[1].status, 'active', 'm1: mission 2 starts automatically');
  });

  // --- Mission 2: wood x2, resin, cloth, torch ---
  await t.guard('m2', async () => {
    const spots = await ev(() => window.BEYOND.world.resourceSpots.map((r) => ({ id: r.id, type: r.type, x: r.position.x, y: r.position.y, z: r.position.z })));
    const real = (type) => spots.filter((r) => r.type === type && !(r.x === 0 && r.y === 0 && r.z === 0));
    const near = (type, x, z) => real(type).sort((a, b) => Math.hypot(a.x - x, a.z - z) - Math.hypot(b.x - x, b.z - z));
    const woods = near('wood', 16, 140), resins = near('resin', 16, 140);
    t.check(woods.length >= 2 && resins.length >= 1, 'm2: resource spots exist (wood, resin)');
    for (const w of woods.slice(0, 2)) if (await use(w.id, 'Oppakken: Hout', `wood ${w.id}`, 0)) t.check((await S()).inv.wood >= 1, `picked ${w.id}`);
    if (await use(resins[0].id, 'Oppakken: Hars', `resin ${resins[0].id}`, 0)) t.eq((await S()).inv.resin, 1, 'picked resin');
    s = await S();
    t.eq(s.inv.wood, 2, 'm2: wood x2 in inventory');
    t.eq(s.inv.cloth, 1, 'm2: cloth still in inventory');
    t.eq((await mission('m2')).done.sort(), ['cloth', 'resin', 'wood'], 'm2: gathering objectives done');
    t.eq(await ev(() => window.BEYOND.gameplay.crafting.craft('torch')), true, 'm2: torch crafted');
    s = await S();
    t.eq(s.inv, { torch: 1 }, 'm2: ingredients consumed, torch in inventory');
    t.eq(s.missions[1].status, 'done', 'm2: mission done');
    t.eq(s.missions[2].status, 'active', 'm2: mission 3 active');
    // torch toggle
    await ev(() => window.BEYOND.bus.emit('input:action', { action: 'torch' }));
    t.eq(await ev(() => window.BEYOND.environment.torchOn), true, 'm2: torch toggles on with F');
    await ev(() => window.BEYOND.bus.emit('input:action', { action: 'torch' }));
    t.eq(await ev(() => window.BEYOND.environment.torchOn), false, 'm2: torch toggles off with F');
  });

  // --- Mission 3 ---
  await t.guard('m3', async () => {
    await teleport(150, -10);
    t.check((await mission('m3')).done.includes('village'), 'm3: village discovered');
    for (const id of ['village.scrap1', 'village.scrap2']) if (await use(id, 'Oppakken: Metaalschroot', id, 0)) { /* ok */ }
    t.eq((await S()).inv.scrap, 2, 'm3: scrap x2');
    const spots = await ev(() => window.BEYOND.world.resourceSpots.filter((r) => r.type === 'fiber').map((r) => ({ id: r.id, x: r.position.x, z: r.position.z })));
    spots.sort((a, b) => Math.hypot(a.x - 150, a.z + 10) - Math.hypot(b.x - 150, b.z + 10));
    for (const f of spots.slice(0, 2)) await use(f.id, 'Oppakken: Plantvezel', f.id, 0);
    s = await S();
    t.check(s.inv.fiber >= 3, 'm3: fiber >= 3 (2 spots x 2)', JSON.stringify(s.inv));
    t.eq((await mission('m3')).done.includes('fiber'), true, 'm3: fiber objective done');
    t.eq(await ev(() => window.BEYOND.gameplay.crafting.craft('crowbar')), false, 'm3: crowbar not craftable without rope');
    t.eq(await ev(() => window.BEYOND.gameplay.crafting.craft('rope')), true, 'm3: rope crafted');
    t.eq(await ev(() => window.BEYOND.gameplay.crafting.craft('crowbar')), true, 'm3: crowbar crafted');
    s = await S();
    t.check(s.inv.crowbar === 1 && !s.inv.scrap && !s.inv.rope, 'm3: crowbar in inventory, scrap and rope consumed', JSON.stringify(s.inv));
    if (await use('village.elderDoor', 'Openbreken: Planken (koevoet)', 'elder door', 0)) {
      await ev(() => window.QA.step(60));
      s = await S();
      t.eq(s.flags.elderDoorOpen, true, 'm3: boards pried open');
      t.eq(await ev(() => window.BEYOND.world.colliders.find((c) => c.id === 'village.elderDoor').enabled), false, 'm3: doorway collider disabled');
      t.eq(await ev(() => window.BEYOND.world.anchors.get('village.elderDoor').object.visible), false, 'm3: boards hidden');
      t.eq(await ev(() => window.BEYOND.gameplay._debug.interaction.focused?.id ?? null) !== 'village.elderDoor', true, 'm3: boards no longer interactable');
    }
    if (await use('village.journal', 'Lezen: Dagboek van de ouderling', 'elder journal', Math.PI / 2)) {
      const body = await ev(() => window.BEYOND.gameplay.documents.get('elder_journal')?.body || '');
      t.check(/Berg/i.test(body) && /Zon/i.test(body) && /Golf/i.test(body), 'm3: journal reveals the pillar order', body.slice(0, 120));
      t.check(/grot|waterval/i.test(body), 'm3: journal reveals the cave behind the waterfall');
      await closeDoc('journal');
    }
    s = await S();
    t.eq(s.missions[2].status, 'done', 'm3: mission done');
    t.eq(s.missions[3].status, 'active', 'm3: mission 4 active');
  });

  // --- Mission 4: cave + sun disc ---
  await t.guard('m4', async () => {
    await ev(() => { const B = window.BEYOND; B.bus.emit('input:action', { action: 'torch' }); }); // torch was consumed? (crafted earlier, still in inventory)
    await teleport(-103, -190);
    t.check((await mission('m4')).done.includes('cave'), 'm4: cave discovered');
    if (await use('cave.sundisc', 'Oppakken: Zonneschijf', 'sun disc', 0)) {
      s = await S();
      t.eq(s.inv.sundisc, 1, 'm4: sun disc in inventory');
      t.eq(s.missions[3].status, 'done', 'm4: mission done');
      t.eq(s.missions[4].status, 'active', 'm4: mission 5 active');
    }
  });

  // --- Mission 5: temple ---
  await t.guard('m5', async () => {
    await teleport(0, -150);
    t.check((await mission('m5')).done.includes('temple'), 'm5: temple discovered');
    if (await use('temple.altar', 'Plaatsen: Zonneschijf', 'altar', 0)) {
      await ev(() => window.QA.step(40));
      s = await S();
      t.eq(s.flags.discPlaced, true, 'm5: disc placed');
      t.check(!s.inv.sundisc, 'm5: disc removed from inventory');
      t.eq(await ev(() => !!window.BEYOND.world.anchors.get('temple.altar').object.getObjectByName('socket').children.length), true, 'm5: disc model shown on the socket');
    }
    const gate0 = await ev(() => window.BEYOND.world.anchors.get('temple.gate').object.position.toArray());
    const turn = async (id, n) => { for (let i = 0; i < n; i++) { if (await use(id, null, `${id} turn ${i + 1}`, 0)) await ev(() => window.QA.step(40)); } };
    await turn('temple.pillar1', 3);
    t.eq((await S()).flags.pillars, [3, 0, 0], 'm5: pillar 1 shows Berg');
    await turn('temple.pillar3', 1);
    s = await S();
    t.eq(s.flags.pillars, [3, 0, 1], 'm5: pillar 3 at Maan');
    t.eq(s.flags.gateOpen, false, 'm5: gate still closed with a wrong combination');
    t.check(await ev(() => window.BEYOND.world.colliders.find((c) => c.id === 'temple.gate').enabled), 'm5: gate collider still enabled');
    await turn('temple.pillar3', 1);
    await ev(() => window.QA.step(150));
    s = await S();
    t.eq(s.flags.pillars, [3, 0, 2], 'm5: pillars Berg-Zon-Golf');
    t.eq(s.flags.gateOpen, true, 'm5: gate opened');
    t.eq(await ev(() => window.BEYOND.world.colliders.find((c) => c.id === 'temple.gate').enabled), false, 'm5: gate collider disabled');
    const gate1 = await ev(() => window.BEYOND.world.anchors.get('temple.gate').object.position.toArray());
    t.check(Math.hypot(gate1[0] - gate0[0], gate1[1] - gate0[1], gate1[2] - gate0[2]) > 2, 'm5: gate slab moved out of the doorway', JSON.stringify([gate0, gate1]));
    if (await use('temple.keycard', 'Oppakken: Sleutelkaart K-7', 'keycard', 0)) t.eq((await S()).inv.keycard, 1, 'm5: keycard picked up');
    if (await use('temple.recording', 'Afspelen: Bandrecorder', 'recording', 0)) {
      t.eq(await ev(() => window.QA.events.filter((e) => e.ev === 'document:open').pop().p.kind), 'recording', 'm5: recording document kind');
      await closeDoc('recording');
    }
    s = await S();
    t.eq(s.missions[4].status, 'done', 'm5: mission done');
    t.eq(s.missions[5].status, 'active', 'm5: mission 6 active');
  });

  // --- Mission 6: bunker ---
  await t.guard('m6', async () => {
    await teleport(-160, 55);
    t.eq(await ev(() => window.BEYOND.gameplay.locations.list().find((l) => l.id === 'bunker').discovered), true, 'm6: bunker discovered');
    if (await use('bunker.reader', 'Sleutelkaart gebruiken', 'reader', 0)) {
      await ev(() => window.QA.step(200));
      s = await S();
      t.eq(s.flags.bunkerDoorOpen, true, 'm6: blast door open');
      t.eq(await ev(() => window.BEYOND.world.colliders.find((c) => c.id === 'bunker.door').enabled), false, 'm6: blast door collider disabled');
      t.check(await ev(() => { const l = window.BEYOND.world.anchors.get('bunker.reader').object.getObjectByName('led'); return l.material.color.g > 0.5 && l.material.color.r < 0.5; }), 'm6: reader LED green');
    }
    t.eq(await ev(() => window.BEYOND.gameplay.inventory.has('keycard')), true, 'm6: keycard is kept (not consumed)');
    if (await use('bunker.innerDoor', 'Openen: Controlekamer', 'inner door w/o power', 0)) {
      await ev(() => window.QA.step(10));
      t.eq((await S()).flags.innerDoorOpen, false, 'm6: inner door refuses without power');
    }
    if (await use('bunker.generator', 'Hendel overhalen', 'generator', Math.PI)) {
      await ev(() => window.QA.step(60));
      s = await S();
      t.eq(s.flags.powered, true, 'm6: powered');
      t.check(await ev(() => Math.abs(window.BEYOND.world.anchors.get('bunker.generator').object.getObjectByName('lever').rotation.x + 1.2) < 0.05), 'm6: lever rotated to -1.2');
    }
    if (await use('bunker.innerDoor', 'Openen: Controlekamer', 'inner door', 0)) {
      await ev(() => window.QA.step(120));
      s = await S();
      t.eq(s.flags.innerDoorOpen, true, 'm6: inner door open');
      t.eq(await ev(() => window.BEYOND.world.colliders.find((c) => c.id === 'bunker.innerDoor').enabled), false, 'm6: inner door collider disabled');
    }
    if (await use('bunker.terminal', 'Gebruiken: Terminal', 'terminal', Math.PI / 2)) {
      t.eq(await ev(() => window.BEYOND.game.state), 'reading', 'm6: terminal opens the reader');
      t.eq(await ev(() => window.QA.events.filter((e) => e.ev === 'document:open').pop().p.kind), 'terminal', 'm6: terminal document kind');
      await closeDoc('terminal');
      await ev(() => window.QA.step(40));
    }
    s = await S();
    t.eq(s.missions[5].status, 'done', 'm6: mission 6 done');
    t.eq(s.state, 'ending', 'chapter complete -> state ending');
    t.eq(await ev(() => window.QA.events.filter((e) => e.ev === 'chapter:complete').length), 1, 'chapter:complete emitted exactly once');
    t.check(s.missions.every((m) => m.status === 'done'), 'all six missions done', JSON.stringify(s.missions.map((m) => m.status)));
  });

  // resume free roam after the ending
  await ev(() => { window.BEYOND.bus.emit('ui:request', { action: 'resume' }); window.QA.step(3); });
  t.eq(await ev(() => window.BEYOND.game.state), 'playing', 'after the ending: free roam resumes');

  t.check(pageErrors.length === 0, 'no page errors during the chapter', pageErrors.join('\n'));
  t.check(errors.length === 0, 'no console errors during the chapter', errors.join(' | '));
});
