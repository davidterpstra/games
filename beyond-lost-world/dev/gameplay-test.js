// Scripted playthrough of chapter 1 against a mock world / player / environment (flat terrain, stand-in structures).
// Results: window.__results = [{ name, pass, detail }], window.__done = true. Run with dev/gameplay-test.mjs.
import * as THREE from 'three';
import { EventBus } from '../src/core/EventBus.js';
import { createGameplay } from '../src/gameplay/Gameplay.js';
import { createInventory } from '../src/gameplay/Inventory.js';
import { LOCATIONS } from '../src/world/layout.js';

const params = new URLSearchParams(location.search);
const results = [];
const out = document.getElementById('out');
window.__results = results;

// ------------------------------------------------------------------------------------------------ mocks
const V = (x, y, z) => new THREE.Vector3(x, y, z);

function standIn(name, w, h, d, color = 0x888888) {
  const g = new THREE.Group(); g.name = name;
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ color }));
  m.position.y = h / 2; g.add(m);
  return g;
}
function child(group, name, x, y, z) {
  const c = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.2), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x000000 }));
  c.name = name; c.position.set(x, y, z); group.add(c); return c;
}

function createMockWorld(scene) {
  const anchors = new Map();
  const add = (id, x, y, z, rotationY = 0, object = null) => {
    const position = V(x, y, z);
    if (object) { object.position.copy(position); object.rotation.y = rotationY; scene.add(object); object.updateMatrixWorld(true); }
    anchors.set(id, { id, position, rotationY, object: object || undefined });
  };
  const colliders = ['village.elderDoor', 'temple.gate', 'bunker.door', 'bunker.innerDoor'].map((id) => ({ id, type: 'box', x: 0, z: 0, hx: 1, hz: 1, rot: 0, yMin: 0, yMax: 3, enabled: true }));
  const door = (name, w, h, d, colliderId, offset) => { const o = standIn(name, w, h, d, 0x665544); o.userData.colliderId = colliderId; if (offset) o.userData.openOffset = offset; return o; };

  add('player.start', 20, 0, 200, 0);
  add('station.logbook', 24, 0.8, 196);
  add('station.cloth', 16, 0.4, 196);
  add('station.beacon', 20, 0, 206, Math.PI, standIn('beacon', 0.4, 2, 0.4));
  child(anchors.get('station.beacon').object, 'lamp', 0, 2, 0);
  for (const [id, x, z, ry] of [['village.beacon', 160, -10, 0], ['waterfall.beacon', -135, -150, 0], ['temple.beacon', 5, -160, 0.5], ['bunker.beacon', -170, 45, 1.0]]) {
    const o = standIn('beacon', 0.4, 2, 0.4); child(o, 'lamp', 0, 2, 0);
    add(id, x, 0, z, ry, o);
  }
  add('note.forest_camp', 10, 0, 125);
  add('village.elderDoor', 170, 0, -14, 0, door('boards', 2, 2.5, 0.2, 'village.elderDoor'));
  add('village.journal', 172, 0.8, -18);
  add('village.scrap1', 155, 0, -4); add('village.scrap2', 156, 0, 0);
  add('note.village_house', 168, 0.8, -6);
  add('note.waterfall', -138, 0, -148);
  add('note.cave', -105, 0, -195);
  add('cave.sundisc', -103, 0.9, -199);
  const altar = standIn('altar', 1.5, 1, 1, 0x777777); child(altar, 'socket', 0, 1.05, 0);
  add('temple.altar', 0, 0, -170, 0, altar);
  [-4, 0, 4].forEach((x, i) => add(`temple.pillar${i + 1}`, x, 0, -176, 0, standIn('pillar', 0.8, 3, 0.8, 0x998877)));
  add('temple.gate', 0, 0, -183, 0, door('gate', 5, 5, 0.6, 'temple.gate', V(0, -5, 0)));
  add('temple.keycard', 0, 0.9, -200);
  add('temple.recording', 2, 0.9, -200);
  add('bunker.door', -185, 0, 30, 0, door('blast', 3, 3, 0.4, 'bunker.door', V(3.2, 0, 0)));
  const reader = standIn('reader', 0.3, 1.2, 0.2); child(reader, 'led', 0, 1.1, 0.12);
  add('bunker.reader', -181.5, 0, 31, 0, reader);
  const gen = standIn('generator', 1.4, 1.2, 0.8); child(gen, 'lever', 0.5, 1.0, 0.45);
  add('bunker.generator', -185, 0, 40, 0, gen);
  add('bunker.innerDoor', -185, 0, 60, 0, door('inner', 2.2, 2.6, 0.3, 'bunker.innerDoor', V(0, 0, 2.2)));
  const term = standIn('terminal', 0.8, 1.2, 0.5); child(term, 'screen', 0, 1.0, 0.26);
  add('bunker.terminal', -185, 0, 70, 0, term);

  const resourceSpots = [];
  const spots = { wood: [[0, 118], [6, 112], [-4, 108], [30, 150]], resin: [[10, 100], [14, 96]], stone: [[20, 90], [24, 86]], fiber: [[8, 70], [12, 66], [16, 62]], scrap: [[40, 40]], cloth: [[44, 36]] };
  for (const [type, list] of Object.entries(spots)) list.forEach(([x, z], i) => resourceSpots.push({ id: `res.${type}.${i}`, type, position: V(x, 0, z) }));

  const powerCalls = [];
  const world = {
    anchors, resourceSpots, colliders, powerCalls,
    locations: LOCATIONS.map((l) => ({ ...l, y: 0 })),
    getHeightAt: () => 0, getNormalAt: () => V(0, 1, 0), getSurfaceAt: () => 'grass', getWaterSurfaceAt: () => null,
    setColliderEnabled(id, e) { const c = colliders.find((k) => k.id === id); if (!c) throw new Error('unknown collider ' + id); c.enabled = !!e; },
    setPowered(g, on) { powerCalls.push([g, on]); world.powered = on; },
    powered: false,
    collider: (id) => colliders.find((k) => k.id === id),
  };
  return world;
}

class FakePlayer {
  constructor() { this.state = { position: V(0, 0, 0), velocity: V(), yaw: 0, pitch: 0 }; }
  getEyePosition(out = V()) { return out.copy(this.state.position).add(V(0, 1.7, 0)); }
  getForward(out = V()) { const { yaw, pitch } = this.state; return out.set(-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch)); }
  teleport(p, yaw, pitch = 0) { this.state.position.copy(p); this.state.yaw = yaw; this.state.pitch = pitch; }
  serialize() { const p = this.state.position; return { position: [p.x, p.y, p.z], yaw: this.state.yaw, pitch: this.state.pitch }; }
  deserialize(d) { this.state.position.set(...d.position); this.state.yaw = d.yaw; this.state.pitch = d.pitch; }
  lookAt(target) {
    const e = this.getEyePosition(), d = target.clone().sub(e);
    this.state.yaw = Math.atan2(-d.x, -d.z); this.state.pitch = Math.atan2(d.y, Math.hypot(d.x, d.z));
  }
}

function createMockEnv() {
  const env = {
    time: 12, weather: 'rain', torchOn: false, day: 1,
    setTimeOfDay(h) { env.time = h; }, getTimeOfDay: () => env.time,
    setWeather(w) { env.weather = w; }, setTorch(on) { env.torchOn = on; },
    serialize: () => ({ time: env.time, day: env.day, weather: env.weather }),
    deserialize(d) { env.time = d.time; env.day = d.day; env.weather = d.weather; },
    audio: { play() {}, unlock() {} },
  };
  return env;
}

// ------------------------------------------------------------------------------------------------ harness
async function run() {
  try { localStorage.removeItem('beyond.save.v1'); } catch { /* ignore */ }
  const bus = new EventBus();
  const log = [];
  for (const ev of ['interaction:focus', 'inventory:changed', 'item:picked', 'craft:done', 'mission:started', 'mission:updated', 'mission:completed', 'objective:completed', 'location:discovered', 'checkpoint:set', 'document:open', 'notify', 'sfx', 'game:saved', 'game:loaded', 'chapter:complete']) {
    bus.on(ev, (p) => log.push({ ev, p }));
  }
  const count = (ev, pred = () => true) => log.filter((e) => e.ev === ev && pred(e.p)).length;
  const last = (ev, pred = () => true) => { for (let i = log.length - 1; i >= 0; i--) if (log[i].ev === ev && pred(log[i].p)) return log[i].p; return null; };
  const notified = (text) => count('notify', (p) => p.text === text) > 0;
  const sfxCount = (name) => count('sfx', (p) => p.name === name);
  const mark = () => log.length;
  const since = (m, ev, pred = () => true) => log.slice(m).filter((e) => e.ev === ev && pred(e.p));

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(75, 1.5, 0.1, 500);
  const world = createMockWorld(scene);
  const player = new FakePlayer();
  const env = createMockEnv();
  const gp = createGameplay({ scene, camera, world, player, environment: env, bus, settings: {} });
  const dbg = gp._debug;
  bus.emit('game:state', { state: 'playing', previous: 'menu' });

  const step = async (name, fn) => {
    try { await fn(); results.push({ name, pass: true }); } catch (e) { results.push({ name, pass: false, detail: String(e && e.message || e) }); }
  };
  const ok = (c, msg) => { if (!c) throw new Error('assert: ' + msg); };
  const eq = (a, b, msg) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${msg}: expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); };
  const near = (a, b, tol, msg) => { if (!(Math.abs(a - b) <= tol)) throw new Error(`${msg}: expected ~${b}, got ${a}`); };

  const advance = (sec) => { for (let t = 0; t < sec; t += 1 / 30) gp.update(1 / 30); };
  const centerOf = (id) => { const d = dbg.interaction.get(id); if (!d) throw new Error('no interactable ' + id); return d._box.getCenter(V()); };
  /** Stand 1.4 m away from the interactable, looking at it. */
  const lookAtObj = (id, dist = 1.4) => {
    const c = centerOf(id);
    player.teleport(V(c.x, Math.max(0, c.y - 1.4 > 0 ? c.y - 1.4 : 0), c.z + dist), 0, 0);
    player.lookAt(c);
    gp.update(0.016);
    ok(dbg.interaction.focused && dbg.interaction.focused.id === id, `focus should be ${id}, is ${dbg.interaction.focused && dbg.interaction.focused.id}`);
  };
  const press = () => { bus.emit('input:action', { action: 'interact' }); gp.update(0.016); };
  const use = (id) => { lookAtObj(id); press(); };
  const teleport = (x, z) => { player.teleport(V(x, 0, z), 0, 0); gp.update(0.016); };
  const mission = (id) => gp.missions.list().find((m) => m.id === id);
  const obj = (mid, oid) => mission(mid).objectives.find((o) => o.id === oid);
  const flags = () => dbg.flags();

  // ------------------------------------------------------------------------------------ API shape
  await step('API shape matches ARCHITECTURE.md', () => {
    for (const k of ['update', 'newGame', 'save', 'respawnAtCheckpoint', 'inventory', 'items', 'crafting', 'missions', 'documents', 'locations']) ok(k in gp, 'missing ' + k);
    for (const k of ['hasSave', 'getInfo', 'save', 'load', 'deleteSave']) ok(typeof gp.save[k] === 'function', 'save.' + k);
    eq(Object.keys(gp.items), ['wood', 'stone', 'fiber', 'resin', 'cloth', 'scrap', 'rope', 'torch', 'crowbar', 'sundisc', 'keycard'], 'item ids');
    eq(gp.items.wood.name, 'Hout', 'dutch name'); eq(gp.items.keycard.name, 'Sleutelkaart K-7', 'keycard name');
    eq(gp.items.wood.stack, 20, 'material stack'); eq(gp.items.crowbar.stack, 1, 'tool stack');
    eq(gp.inventory.slots.length, 24, 'slots');
    eq(gp.crafting.recipes.map((r) => r.id), ['rope', 'torch', 'crowbar'], 'recipes');
    eq(gp.save.hasSave(), false, 'no save yet');
  });

  await step('Inventory: stacking, overflow "Je tas is vol.", remove/count/has', () => {
    const b = new EventBus(); const msgs = []; b.on('notify', (p) => msgs.push(p.text));
    const inv = createInventory({ bus: b });
    eq(inv.add('stone', 25), 25, 'add 25'); eq(inv.slots.filter(Boolean).length, 2, 'two stacks'); eq(inv.slots[0].count, 20, 'stack of 20');
    eq(inv.add('crowbar', 30), 22, 'tools take one slot each, 22 free'); ok(msgs.includes('Je tas is vol.'), 'bag full notify');
    eq(inv.remove('stone', 30), false, 'cannot remove more than owned'); eq(inv.count('stone'), 25, 'unchanged');
    ok(inv.remove('stone', 22), 'remove 22'); eq(inv.count('stone'), 3, 'left 3'); ok(inv.has('stone', 3) && !inv.has('stone', 4), 'has');
  });

  // ------------------------------------------------------------------------------------ new game
  await step('newGame: mission 1 active, player at start, clear weather, hint toast', () => {
    env.time = 20; env.weather = 'storm';
    const m = mark();
    gp.newGame();
    eq(gp.missions.active().id, 'm1', 'active mission'); eq(gp.missions.active().title, 'Ontwaakt', 'title');
    eq(gp.missions.list().length, 6, 'six missions'); eq(gp.missions.list().map((x) => x.status), ['active', 'locked', 'locked', 'locked', 'locked', 'locked'], 'statuses');
    eq(since(m, 'mission:started').length, 1, 'mission:started');
    ok(notified('Druk op E om met objecten te werken.'), 'E hint');
    near(env.time, 7.5, 1e-6, 'time'); eq(env.weather, 'clear', 'weather');
    near(player.state.position.x, 20, 1e-6, 'start x'); near(player.state.position.z, 200, 1e-6, 'start z');
    eq(gp.inventory.slots.filter(Boolean).length, 0, 'empty inventory');
  });

  await step('Interaction: focus event only on change, null when nothing in front', () => {
    player.teleport(V(24, 0, 197.4), 0, 0); player.lookAt(centerOf('station.logbook'));
    const m = mark();
    gp.update(0.016); gp.update(0.016); gp.update(0.016);
    const f = since(m, 'interaction:focus');
    eq(f.length, 1, 'one focus event'); eq(f[0].p.id, 'station.logbook', 'focus id'); eq(f[0].p.prompt, 'Lezen: Logboek van Dr. Vos', 'prompt'); eq(f[0].p.key, 'E', 'key');
    player.teleport(V(24, 0, 197.4), Math.PI, 0); gp.update(0.016);
    eq(last('interaction:focus'), null, 'focus lost');
    player.teleport(V(20, 0, 172), 0, 0); player.lookAt(V(20, 1, 120));
    gp.update(0.016); eq(dbg.interaction.focused, null, 'nothing far away');
  });

  await step('Mission 1: read logbook (document:open, journal)', () => {
    const m = mark();
    use('station.logbook');
    const d = since(m, 'document:open'); eq(d.length, 1, 'document:open'); eq(d[0].p.id, 'logbook', 'id'); eq(d[0].p.kind, 'journal', 'kind');
    ok(d[0].p.body.includes('\n\n') && d[0].p.body.toLowerCase().includes('toorts'), 'body has paragraphs and mentions torches');
    eq(gp.documents.list().length, 1, 'journal'); ok(gp.documents.get('logbook').title.includes('Vos'), 'get');
    ok(sfxCount('page') >= 1, 'page sfx'); ok(obj('m1', 'logbook').done, 'objective done');
  });

  await step('Mission 1: station beacon (checkpoint, lamp glow, save)', () => {
    const lamp = world.anchors.get('station.beacon').object.getObjectByName('lamp');
    eq(lamp.material.emissiveIntensity, 0, 'lamp off');
    const m = mark();
    eq(dbg.interaction.get('station.beacon').prompt(), 'Activeren: Noodbaken', 'prompt');
    use('station.beacon');
    eq(since(m, 'checkpoint:set').length, 1, 'checkpoint:set'); ok(sfxCount('beacon') >= 1, 'beacon sfx');
    advance(2.5); near(lamp.material.emissiveIntensity, 3, 0.4, 'lamp glows');
    eq(dbg.checkpoints.id, 'station.beacon', 'checkpoint'); ok(obj('m1', 'beacon').done, 'objective'); ok(gp.save.hasSave(), 'beacon saves');
    ok(since(m, 'game:saved').length >= 1, 'game:saved');
  });

  await step('Mission 1 → 2: leaving the station (>40 m) completes it', () => {
    teleport(20, 230); ok(!obj('m1', 'leave').done, 'not yet at 30 m');
    const m = mark(); teleport(20, 250);
    ok(obj('m1', 'leave').done, 'left'); eq(mission('m1').status, 'done', 'm1 done'); eq(gp.missions.active().id, 'm2', 'm2 active');
    eq(since(m, 'mission:completed').length, 1, 'mission:completed'); eq(since(m, 'mission:started')[0].p.mission.id, 'm2', 'mission:started m2');
    ok(sfxCount('mission_complete') >= 1 && sfxCount('objective') >= 1, 'sfx');
  });

  await step('Pickups: wood x2 / resin / cloth with progress counters', () => {
    use('res.wood.0');
    eq(obj('m2', 'wood').progress, [1, 2], 'wood 1/2'); eq(gp.inventory.count('wood'), 1, 'inventory');
    eq(last('item:picked').itemId, 'wood', 'item:picked'); ok(sfxCount('pickup') >= 1, 'pickup sfx');
    eq(dbg.interaction.get('res.wood.0').enabled(), false, 'collected pickup disabled');
    use('res.wood.1'); ok(obj('m2', 'wood').done, 'wood done');
    eq(dbg.interaction.get('res.wood.1').prompt(), 'Oppakken: Hout', 'prompt');
    use('res.resin.0'); ok(obj('m2', 'resin').done, 'resin');
    teleport(20, 200); use('station.cloth'); ok(obj('m2', 'cloth').done, 'cloth');
  });

  await step('Crafting: rope not possible yet, torch crafted, F hint, mission 2 done', () => {
    eq(gp.crafting.canCraft('rope'), false, 'no fibre'); eq(gp.crafting.craft('rope'), false, 'craft fails');
    eq(gp.crafting.canCraft('torch'), true, 'torch ok');
    const m = mark();
    ok(gp.crafting.craft('torch'), 'craft'); eq(gp.inventory.count('torch'), 1, 'torch in bag'); eq(gp.inventory.count('wood'), 0, 'wood consumed');
    eq(since(m, 'craft:done')[0].p.itemId, 'torch', 'craft:done'); ok(sfxCount('craft') >= 1, 'craft sfx');
    ok(notified('Druk op F om je toorts aan te steken.'), 'F hint');
    eq(mission('m2').status, 'done', 'm2 done'); eq(gp.missions.active().id, 'm3', 'm3 active');
    ok(obj('m2', 'wood').done, 'collect objectives stay done after consuming');
  });

  await step('Mission 3: discover Valdris, scrap, fibre, rope, crowbar', () => {
    const m = mark(); teleport(165, -10);
    eq(since(m, 'location:discovered').map((e) => e.p.id), ['village'], 'discovered'); ok(gp.locations.list().find((l) => l.id === 'village').discovered, 'list flag'); ok(sfxCount('discover') >= 1, 'discover sfx');
    ok(obj('m3', 'village').done, 'objective');
    use('village.scrap1'); use('village.scrap2'); ok(obj('m3', 'scrap').done, 'scrap');
    teleport(10, 68); use('res.fiber.0'); eq(gp.inventory.count('fiber'), 2, 'bundle gives 2'); eq(obj('m3', 'fiber').progress, [2, 3], 'progress'); use('res.fiber.1'); ok(obj('m3', 'fiber').done, 'fibre');
    eq(gp.crafting.canCraft('crowbar'), false, 'needs rope'); ok(gp.crafting.craft('rope'), 'rope'); ok(gp.crafting.craft('crowbar'), 'crowbar');
    eq([gp.inventory.count('rope'), gp.inventory.count('scrap'), gp.inventory.count('crowbar')], [0, 0, 1], 'consumed');
    ok(obj('m3', 'rope').done && obj('m3', 'crowbar').done, 'objectives');
  });

  await step("Elder's door: no crowbar → warning; with crowbar → boards break, collider off", () => {
    teleport(165, -10);
    gp.inventory.remove('crowbar', 1);
    let m = mark(); use('village.elderDoor');
    ok(since(m, 'notify').some((e) => e.p.text === 'Je hebt een koevoet nodig.'), 'notify'); ok(since(m, 'sfx').some((e) => e.p.name === 'error'), 'error sfx');
    eq(world.collider('village.elderDoor').enabled, true, 'still blocked');
    gp.inventory.add('crowbar', 1);
    eq(dbg.interaction.get('village.elderDoor').prompt, 'Openbreken: Planken (koevoet)', 'prompt');
    m = mark(); use('village.elderDoor');
    ok(since(m, 'sfx').some((e) => e.p.name === 'boards_break'), 'boards_break'); eq(world.collider('village.elderDoor').enabled, false, 'collider disabled');
    const boards = world.anchors.get('village.elderDoor').object; ok(boards.visible, 'animating'); advance(1.5); eq(boards.visible, false, 'boards gone');
    ok(obj('m3', 'door').done, 'objective');
  });

  await step("Elder's journal → mission 3 done, mission 4 starts", () => {
    use('village.journal');
    ok(last('document:open').body.includes('EERST DE BERG, DAN DE ZON, ALS LAATSTE DE GOLF'), 'pillar order in text');
    eq(mission('m3').status, 'done', 'm3'); eq(gp.missions.active().id, 'm4', 'm4');
    use('note.village_house'); eq(last('document:open').kind, 'note', 'note kind');
  });

  await step('Mission 4: discover cave, take Sun Disc', () => {
    teleport(0, -170); // before the disc: altar needs it
    let m = mark(); use('temple.altar');
    ok(since(m, 'notify').some((e) => e.p.text === 'Je hebt de Zonneschijf nodig.'), 'altar warning'); eq(flags().discPlaced, false, 'not placed');
    m = mark(); teleport(-103, -199); ok(since(m, 'location:discovered').some((e) => e.p.id === 'cave'), 'cave discovered');
    use('cave.sundisc'); eq(gp.inventory.count('sundisc'), 1, 'disc'); eq(mission('m4').status, 'done', 'm4'); eq(gp.missions.active().id, 'm5', 'm5');
    use('note.cave'); eq(last('document:open').id, 'cave', 'inscription');
  });

  await step('Temple: pillars locked before the disc is placed', () => {
    teleport(0, -170);
    const m = mark(); use('temple.pillar1');
    ok(since(m, 'notify').some((e) => e.p.text === 'De pilaren zitten muurvast…'), 'locked message'); eq(flags().pillars, [0, 0, 0], 'unchanged');
    ok(obj('m5', 'temple').done, 'temple discovered');
  });

  await step('Temple: altar takes the Sun Disc', () => {
    eq(dbg.interaction.get('temple.altar').prompt, 'Plaatsen: Zonneschijf', 'prompt');
    use('temple.altar'); eq(flags().discPlaced, true, 'placed'); eq(gp.inventory.count('sundisc'), 0, 'removed');
    const socket = world.anchors.get('temple.altar').object.getObjectByName('socket'); ok(socket.children.length >= 1, 'disc model on socket');
    ok(obj('m5', 'place').done, 'objective'); eq(dbg.interaction.get('temple.altar').enabled(), false, 'altar done');
  });

  await step('Temple: pillars rotate 90° eased, wrong combination keeps the gate shut', () => {
    const p2 = world.anchors.get('temple.pillar2');
    eq(dbg.interaction.get('temple.pillar2').prompt(), 'Draaien: Pilaar (Zon)', 'prompt glyph 0');
    const m = mark(); use('temple.pillar2'); ok(since(m, 'sfx').some((e) => e.p.name === 'stone_grind'), 'grind sfx');
    advance(0.4); const mid = p2.object.rotation.y; ok(mid > 0.05 && mid < Math.PI / 2 - 0.05, 'mid-rotation ' + mid);
    advance(0.8); near(p2.object.rotation.y, Math.PI / 2, 1e-3, 'quarter turn'); eq(flags().pillars, [0, 1, 0], 'state');
    eq(dbg.interaction.get('temple.pillar2').prompt(), 'Draaien: Pilaar (Maan)', 'prompt glyph 1');
    const turn = (id, n) => { for (let i = 0; i < n; i++) { use(id); advance(1); } };
    turn('temple.pillar1', 3); turn('temple.pillar3', 2);
    eq(flags().pillars, [3, 1, 2], 'combination'); eq(flags().gateOpen, false, 'gate closed (wrong)');
    eq(dbg.interaction.get('temple.pillar1').prompt(), 'Draaien: Pilaar (Berg)', 'glyph Berg'); eq(dbg.interaction.get('temple.pillar3').prompt(), 'Draaien: Pilaar (Golf)', 'glyph Golf');
  });

  await step('Temple: correct combination (Berg, Zon, Golf) sinks the gate over ~3 s', () => {
    const gate = world.anchors.get('temple.gate').object;
    for (let i = 0; i < 3; i++) { use('temple.pillar2'); advance(1); }
    eq(flags().pillars, [3, 0, 2], 'solved'); eq(flags().gateOpen, true, 'gate flag');
    near(gate.rotation.y, 0, 1e-9, 'gate unrotated');
    advance(1.5); ok(gate.position.y < -0.3 && gate.position.y > -4.8, 'sliding ' + gate.position.y);
    eq(world.collider('temple.gate').enabled, true, 'still solid halfway');
    advance(2.5); eq(world.collider('temple.gate').enabled, false, 'collider disabled at the end'); near(gate.position.y, -5, 1e-3, 'fully open'); ok(obj('m5', 'pillars').done, 'objective');
    eq(dbg.interaction.get('temple.pillar1').enabled(), false, 'pillars locked afterwards');
  });

  await step('Temple: keycard + Vos recording → mission 5 done, mission 6 active', () => {
    teleport(0, -195); use('temple.keycard'); eq(gp.inventory.count('keycard'), 1, 'keycard');
    use('temple.recording'); eq(last('document:open').kind, 'recording', 'recording kind'); ok(last('document:open').body.includes('K-7'), 'mentions K-7');
    eq(mission('m5').status, 'done', 'm5'); eq(gp.missions.active().id, 'm6', 'm6');
  });

  await step('Waterfall/forest notes readable', () => {
    use('note.waterfall'); eq(last('document:open').id, 'waterfall', 'waterfall'); use('note.forest_camp'); eq(last('document:open').id, 'forest_camp', 'forest');
  });

  await step('Bunker: reader denies without keycard, inner door/terminal need power', () => {
    teleport(-185, 40);
    const led = world.anchors.get('bunker.reader').object.getObjectByName('led');
    gp.inventory.remove('keycard', 1);
    let m = mark(); use('bunker.reader');
    ok(since(m, 'sfx').some((e) => e.p.name === 'keycard_denied'), 'denied sfx'); ok(since(m, 'notify').some((e) => e.p.text === 'Toegang geweigerd. Sleutelkaart vereist.'), 'denied text');
    eq(world.collider('bunker.door').enabled, true, 'door closed'); ok(led.material.color.r > 0.9 && led.material.color.g < 0.3, 'led red');
    gp.inventory.add('keycard', 1);
    m = mark(); use('bunker.innerDoor'); ok(since(m, 'notify').some((e) => e.p.text === 'Geen stroom.'), 'no power (door)'); eq(world.collider('bunker.innerDoor').enabled, true, 'inner closed');
    m = mark(); use('bunker.terminal'); ok(since(m, 'notify').some((e) => e.p.text === 'Geen stroom.'), 'no power (terminal)'); eq(since(m, 'document:open').length, 0, 'no document');
  });

  await step('Bunker: keycard opens the blast door (card stays), led turns green', () => {
    const led = world.anchors.get('bunker.reader').object.getObjectByName('led'); const door = world.anchors.get('bunker.door').object;
    const m = mark(); use('bunker.reader');
    ok(since(m, 'sfx').some((e) => e.p.name === 'keycard_ok'), 'ok sfx'); ok(led.material.color.g > 0.9 && led.material.color.r < 0.3, 'led green');
    advance(5); ok(since(m, 'sfx').some((e) => e.p.name === 'metal_door'), 'metal_door sfx'); near(door.position.x, -185 + 3.2, 1e-3, 'door slid'); eq(world.collider('bunker.door').enabled, false, 'collider off');
    eq(gp.inventory.count('keycard'), 1, 'keycard stays'); ok(obj('m6', 'door').done, 'objective');
  });

  await step('Bunker: generator lever restores power', () => {
    const lever = world.anchors.get('bunker.generator').object.getObjectByName('lever'); const screen = world.anchors.get('bunker.terminal').object.getObjectByName('screen');
    eq(screen.material.emissiveIntensity, 0, 'screen dark');
    const m = mark(); use('bunker.generator'); advance(0.4); ok(lever.rotation.x < -0.1 && lever.rotation.x > -1.2, 'lever mid ' + lever.rotation.x);
    advance(1); near(lever.rotation.x, -1.2, 1e-3, 'lever down'); ok(since(m, 'sfx').some((e) => e.p.name === 'power_on'), 'power_on sfx');
    eq(world.powerCalls.at(-1), ['bunker', true], 'world.setPowered'); ok(screen.material.emissiveIntensity > 0.5, 'screen glows'); ok(obj('m6', 'power').done, 'objective');
  });

  await step('Bunker: inner door opens with power, terminal opens document, chapter completes once', () => {
    const inner = world.anchors.get('bunker.innerDoor').object;
    teleport(-185, 55); use('bunker.innerDoor'); advance(3); near(inner.position.z, 60 + 2.2, 1e-3, 'inner slid'); eq(world.collider('bunker.innerDoor').enabled, false, 'collider off');
    teleport(-185, 66); const m = mark(); use('bunker.terminal');
    const d = since(m, 'document:open'); eq(d.length, 1, 'terminal doc'); eq(d[0].p.kind, 'terminal', 'kind'); ok(d[0].p.body.includes('WASTELANDS'), 'teaser');
    eq(mission('m6').status, 'done', 'm6 done'); eq(count('chapter:complete'), 0, 'not before the document closes');
    advance(2); eq(count('chapter:complete'), 0, 'still waiting while reading');
    bus.emit('document:close', {}); advance(0.5); eq(count('chapter:complete'), 0, 'delay ~0.8 s'); advance(0.6);
    eq(count('chapter:complete'), 1, 'chapter:complete'); eq(last('chapter:complete').chapter, 1, 'chapter 1');
    use('bunker.terminal'); bus.emit('document:close', {}); advance(2); eq(count('chapter:complete'), 1, 'only once');
    eq(gp.missions.active(), null, 'no active mission after chapter');
  });

  await step('Checkpoints: bunker beacon, respawn 2 m in front facing away', () => {
    teleport(-170, 45); use('bunker.beacon'); eq(last('checkpoint:set').id, 'bunker.beacon', 'set');
    teleport(0, 0); gp.respawnAtCheckpoint();
    const a = world.anchors.get('bunker.beacon'); const d = Math.hypot(player.state.position.x - a.position.x, player.state.position.z - a.position.z);
    near(d, 2, 1e-6, 'distance'); near(player.state.position.y, 0, 1e-6, 'on ground');
    const away = player.state.position.clone().sub(a.position).setY(0).normalize(); const fwd = player.getForward(); ok(away.dot(fwd) > 0.99, 'facing away');
  });

  await step('Documents: eight texts exist and journal collects them', () => {
    const ids = gp.documents.list().map((d) => d.id).sort();
    eq(ids, ['cave', 'elder_journal', 'forest_camp', 'logbook', 'recording', 'terminal', 'village_house', 'waterfall'], 'journal');
  });

  // ------------------------------------------------------------------------------------ save / load
  const snapshot = () => ({
    inv: gp.inventory.slots.map((s) => (s ? [s.itemId, s.count] : null)),
    missions: gp.missions.list().map((m) => [m.id, m.status, m.objectives.map((o) => o.done)]),
    flags: JSON.stringify(flags()),
    collected: [...dbg.pickups.entries.values()].filter((e) => e.collected).map((e) => e.id).sort(),
    docs: gp.documents.list().map((d) => d.id), disc: gp.locations.list().filter((l) => l.discovered).map((l) => l.id),
    checkpoint: dbg.checkpoints.id,
    colliders: world.colliders.map((c) => c.enabled),
  });
  let before;
  await step('Save: writes beyond.save.v1 with the documented structure', () => {
    advance(1); before = snapshot();
    const t0 = gp.playTime; ok(t0 > 10, 'playTime counted ' + t0);
    ok(gp.save.save(), 'save()');
    const raw = JSON.parse(localStorage.getItem('beyond.save.v1'));
    eq(raw.version, 1, 'version'); ok(raw.timestamp > 0 && raw.playTime > 0, 'time fields');
    for (const k of ['player', 'environment', 'inventory', 'missions', 'world', 'documents', 'discovered', 'checkpoint']) ok(k in raw, 'key ' + k);
    ok(Array.isArray(raw.world.collected) && typeof raw.world.flags === 'object', 'world shape');
    const info = gp.save.getInfo(); ok(info && info.timestamp && typeof info.playTime === 'number' && 'missionTitle' in info, 'getInfo');
    before.playTime = gp.playTime;
  });

  await step('newGame after save: everything is reset (visuals, colliders, power, pickups)', () => {
    gp.newGame();
    const s = snapshot();
    eq(s.inv.filter(Boolean).length, 0, 'inventory'); eq(s.collected, [], 'pickups visible'); eq(s.docs, [], 'documents'); eq(s.disc.length >= 0, true, 'discovered');
    ok(s.colliders.every(Boolean), 'colliders enabled'); eq(world.powerCalls.at(-1), ['bunker', false], 'power off');
    eq(gp.missions.active().id, 'm1', 'm1'); eq(gp.playTime, 0, 'playTime reset'); eq(dbg.checkpoints.id, 'player.start', 'checkpoint');
    ok(world.anchors.get('village.elderDoor').object.visible, 'boards back'); near(world.anchors.get('temple.gate').object.position.y, 0, 1e-9, 'gate back');
    near(world.anchors.get('bunker.door').object.position.x, -185, 1e-9, 'door back'); eq(world.anchors.get('bunker.generator').object.getObjectByName('lever').rotation.x, 0, 'lever back');
    eq(world.anchors.get('temple.altar').object.getObjectByName('socket').children.length, 0, 'disc removed');
    near(world.anchors.get('temple.pillar1').object.rotation.y, 0, 1e-9, 'pillar reset');
    eq(world.anchors.get('station.beacon').object.getObjectByName('lamp').material.emissiveIntensity, 0, 'lamp off');
    ok(gp.save.hasSave(), 'save still there until overwritten');
    for (const e of dbg.pickups.entries.values()) ok(e.object ? e.object.visible : true, 'pickup visible ' + e.id);
  });

  await step('Load: restores everything instantly', () => {
    const m = mark(); ok(gp.save.load(), 'load()'); eq(since(m, 'game:loaded').length, 1, 'game:loaded');
    const s = snapshot(); const keep = { ...before }; delete keep.playTime; const got = { ...s };
    eq(got, keep, 'snapshot equal');
    near(gp.playTime, before.playTime, 0.5, 'playTime');
    const w = world.anchors; const instant = (c, msg) => ok(c, 'instant ' + msg);
    instant(w.get('village.elderDoor').object.visible === false, 'boards'); instant(Math.abs(w.get('temple.gate').object.position.y + 5) < 1e-6, 'gate');
    instant(Math.abs(w.get('bunker.door').object.position.x - (-185 + 3.2)) < 1e-6, 'blast door'); instant(Math.abs(w.get('bunker.innerDoor').object.position.z - 62.2) < 1e-6, 'inner door');
    instant(Math.abs(w.get('bunker.generator').object.getObjectByName('lever').rotation.x + 1.2) < 1e-9, 'lever');
    instant(w.get('temple.altar').object.getObjectByName('socket').children.length === 1, 'disc'); eq(world.powerCalls.at(-1), ['bunker', true], 'powered');
    [3, 0, 2].forEach((st, i) => near(w.get(`temple.pillar${i + 1}`).object.rotation.y, st * Math.PI / 2, 1e-9, 'pillar' + (i + 1)));
    const led = w.get('bunker.reader').object.getObjectByName('led'); ok(led.material.color.g > 0.9, 'led green');
    for (const id of ['village.elderDoor', 'temple.gate', 'bunker.door', 'bunker.innerDoor']) eq(world.collider(id).enabled, false, 'collider ' + id);
    eq(gp.missions.active(), null, 'all missions done after chapter'); eq(flags().chapterComplete, true, 'chapter flag');
    ok(w.get('station.beacon').object.getObjectByName('lamp').material.emissiveIntensity > 2.5, 'beacon lit');
    eq(env.time > 0, true, 'env restored'); eq(env.torchOn, false, 'torch off after load');
    const dm = mark(); advance(3); eq(since(dm, 'chapter:complete').length, 0, 'no second chapter event after load');
  });

  await step('Load: mid-game save restores mission progress and recomputes objectives', () => {
    gp.newGame(); use('res.wood.0'); teleport(20, 250); // m1: logbook/beacon not done but left the station
    teleport(20, 200); use('station.logbook'); use('station.beacon'); teleport(20, 250);
    eq(gp.missions.active().id, 'm2', 'm2 active'); use('res.wood.2'); eq(obj('m2', 'wood').progress, [2, 2].map((x, i) => (i ? 2 : 2)), 'wood 2/2 (one before + one now)');
    gp.save.save(); const snap = snapshot();
    gp.newGame(); ok(gp.save.load(), 'load'); eq(snapshot(), snap, 'same state'); eq(gp.missions.active().id, 'm2', 'm2'); eq(obj('m2', 'wood').progress, [2, 2], 'progress recomputed');
    ok(dbg.interaction.get('res.wood.0').enabled() === false, 'collected stays hidden');
    use('res.resin.1'); ok(obj('m2', 'resin').done, 'game continues after load');
  });

  await step('Corrupt / invalid saves are ignored, deleteSave works', () => {
    localStorage.setItem('beyond.save.v1', '{"version":1,"nonsense":true}');
    eq(gp.save.hasSave(), false, 'invalid hasSave'); eq(gp.save.load(), false, 'invalid load'); eq(gp.save.getInfo(), null, 'info null');
    localStorage.setItem('beyond.save.v1', 'not json'); eq(gp.save.hasSave(), false, 'garbage');
    gp.save.save(); ok(gp.save.hasSave(), 'saved again'); gp.save.deleteSave(); eq(gp.save.hasSave(), false, 'deleted');
  });

  await step('Pickup hide uses zero-scale instance matrices (instanced draw calls)', () => {
    const meshes = []; scene.traverse((o) => { if (o.isInstancedMesh && o.name.startsWith('pickups_')) meshes.push(o); });
    ok(meshes.length >= 6 && meshes.length <= 9, 'few instanced meshes: ' + meshes.length);
    gp.newGame(); teleport(8, 70); use('res.fiber.0');
    const e = dbg.pickups.entries.get('res.fiber.0'); const mtx = new THREE.Matrix4(); e.inst.meshes[0].getMatrixAt(e.index, mtx);
    near(mtx.elements[0], 0, 1e-9, 'zero scale'); gp.newGame(); e.inst.meshes[0].getMatrixAt(e.index, mtx); ok(Math.abs(mtx.elements[0]) > 0.1, 'visible again');
  });

  // ------------------------------------------------------------------------------------ done
  const failed = results.filter((r) => !r.pass);
  out.innerHTML = results.map((r) => `<div class="${r.pass ? 'p' : 'f'}">${r.pass ? 'PASS' : 'FAIL'}  ${r.name}${r.pass ? '' : '\n      ' + r.detail}</div>`).join('') + `\n${results.length - failed.length}/${results.length} passed`;
  window.__done = true;
}

function runNoSave() {
  const bus = new EventBus();
  const scene = new THREE.Scene(); const world = createMockWorld(scene);
  const gp = createGameplay({ scene, camera: new THREE.PerspectiveCamera(), world, player: new FakePlayer(), environment: createMockEnv(), bus, settings: {} });
  try { localStorage.removeItem('beyond.save.v1'); } catch { /* ignore */ }
  gp.newGame();
  const saved = gp.save.save();
  let stored = null; try { stored = localStorage.getItem('beyond.save.v1'); } catch { /* ignore */ }
  try { localStorage.setItem('beyond.save.v1', '{}'); } catch { /* ignore */ }
  const has = gp.save.hasSave(); const loaded = gp.save.load();
  try { localStorage.removeItem('beyond.save.v1'); } catch { /* ignore */ }
  results.push({ name: '?nosave: never reads or writes storage', pass: saved === false && stored === null && has === false && loaded === false, detail: JSON.stringify({ saved, stored, has, loaded }) });
  out.textContent = results.map((r) => `${r.pass ? 'PASS' : 'FAIL'} ${r.name}`).join('\n');
  window.__done = true;
}

if (params.has('nosave')) runNoSave();
else run().catch((e) => { results.push({ name: 'harness crashed', pass: false, detail: String(e && e.stack || e) }); out.textContent = String(e && e.stack || e); window.__done = true; });
