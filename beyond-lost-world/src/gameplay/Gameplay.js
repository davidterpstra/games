// BEYOND – gameplay composition root. See docs/ARCHITECTURE.md → "Gameplay API".
import * as THREE from 'three';
import { getPad } from '../world/layout.js';
import { ITEMS } from './items.js';
import { createInventory } from './Inventory.js';
import { createCrafting } from './Crafting.js';
import { createInteraction } from './Interaction.js';
import { createPickups } from './Pickups.js';
import { createDocuments } from './Documents.js';
import { createLocations } from './Locations.js';
import { createCheckpoints } from './Checkpoints.js';
import { createWorldObjects } from './WorldObjects.js';
import { createMissions } from './Missions.js';
import { createSaveSystem } from './SaveSystem.js';
import { Tweens } from './tween.js';

/**
 * Creates the whole gameplay layer.
 * @param {{scene:THREE.Scene, camera:THREE.Camera, world:object, player:object, environment:object, bus:object, settings:object}} deps
 */
export function createGameplay({ scene, camera, world, player, environment, bus, settings }) {
  void camera; void settings;
  const tweens = new Tweens();
  let gameState = 'playing';
  let interactQueued = false;
  let playTime = 0, clock = 0, chapterTimer = -1;
  let quiet = false; // true while loading / resetting: no autosave from beacons

  const inventory = createInventory({ bus });
  const crafting = createCrafting({ bus, inventory });
  const interaction = createInteraction({ bus, player });
  const documents = createDocuments({ scene, world, bus, interaction });
  const pickups = createPickups({ scene, world, inventory, interaction, bus });
  const locations = createLocations({ world, player, bus });
  const checkpoints = createCheckpoints({ world, player, bus });

  let save = null;
  const worldObjects = createWorldObjects({
    scene, world, bus, inventory, interaction, documents, checkpoints, tweens,
    requestSave: () => { if (!quiet && save) save.save(); },
  });

  const stationPad = getPad('station') || { x: 20, z: 200 };
  const snapshot = {
    count: (id) => inventory.count(id),
    flag: (name) => worldObjects.has(name),
    doc: (id) => documents.hasRead(id),
    crafted: (id) => crafting.crafted.has(id),
    collected: (id) => pickups.isCollected(id),
    discovered: (id) => locations.isDiscovered(id),
    distanceFromStation: () => { const p = player.state.position; return Math.hypot(p.x - stationPad.x, p.z - stationPad.z); },
  };
  const missions = createMissions({ bus, snapshot });

  // ---- save / load ------------------------------------------------------------------------
  const collect = () => {
    const a = missions.active();
    return {
      version: 1, timestamp: Date.now(), playTime,
      missionTitle: a ? a.title : 'Hoofdstuk 1 voltooid',
      player: player.serialize(), environment: environment.serialize(),
      inventory: inventory.serialize(), missions: missions.serialize(),
      world: { collected: pickups.serialize(), flags: { ...worldObjects.serialize(), crafted: crafting.serialize() } },
      documents: documents.serialize(), discovered: locations.serialize(), checkpoint: checkpoints.id,
    };
  };

  const resetWorldState = () => {
    missions.suspended = true; // no objective checks while the state is being rebuilt
    tweens.clear();
    inventory.clear(); crafting.reset(); pickups.reset(); documents.reset(); locations.reset(); checkpoints.reset();
    worldObjects.reset(); missions.reset();
    chapterTimer = -1; interactQueued = false;
    environment.setTorch?.(false);
    interaction.resetFocus();
  };

  const apply = (d) => {
    quiet = true; missions.suspended = true;
    try {
      resetWorldState();
      inventory.restore(d.inventory);
      crafting.restore(d.world.flags.crafted);
      pickups.restore(d.world.collected);
      documents.restore(d.documents);
      locations.restore(d.discovered);
      checkpoints.restore(d.checkpoint);
      worldObjects.restore(d.world.flags);
      player.deserialize(d.player);
      environment.deserialize(d.environment);
      environment.setTorch?.(false);
      playTime = d.playTime;
      missions.suspended = false;
      missions.restore(d.missions);
    } finally { quiet = false; missions.suspended = false; }
    interaction.resetFocus();
  };
  save = createSaveSystem({ bus, collect, apply });

  // ---- events ---------------------------------------------------------------------------------
  bus.on('game:state', ({ state }) => { gameState = state; });
  bus.on('input:action', ({ action }) => { if (action === 'interact' && gameState === 'playing') interactQueued = true; });
  bus.on('inventory:changed', () => missions.evaluate());
  bus.on('craft:done', () => missions.evaluate());
  bus.on('document:open', () => missions.evaluate());
  bus.on('document:close', () => {
    if (documents.lastOpened === 'terminal' && !worldObjects.flags.chapterComplete) chapterTimer = 0.8;
  });

  // ---- api ------------------------------------------------------------------------------------
  const gameplay = {
    update(dt) {
      playTime += dt; clock += dt;
      tweens.update(dt);
      interaction.update();
      if (interactQueued) { interactQueued = false; if (gameState === 'playing') { interaction.trigger(); missions.evaluate(); } }
      pickups.update(dt);
      worldObjects.update(dt, clock);
      locations.update();
      missions.evaluate(); // cheap: a handful of closures; keeps position-based objectives responsive
      if (chapterTimer >= 0) {
        chapterTimer -= dt;
        if (chapterTimer < 0) {
          chapterTimer = -1;
          if (!worldObjects.flags.chapterComplete) { worldObjects.setChapterComplete(true); bus.emit('chapter:complete', { chapter: 1 }); }
        }
      }
    },
    newGame() {
      quiet = true;
      resetWorldState();
      missions.suspended = false;
      playTime = 0;
      const start = world.anchors.get('player.start');
      if (start) player.teleport(start.position.clone(), start.rotationY || 0, 0);
      environment.setTimeOfDay(7.5);
      environment.setWeather('clear');
      quiet = false;
      missions.begin();
      bus.emit('notify', { text: 'Druk op E om met objecten te werken.', type: 'info' });
    },
    save: { hasSave: save.hasSave, getInfo: save.getInfo, save: save.save, load: save.load, deleteSave: save.deleteSave },
    respawnAtCheckpoint() { checkpoints.respawn(); interaction.resetFocus(); },
    inventory,
    items: ITEMS,
    crafting: { recipes: crafting.recipes, canCraft: crafting.canCraft, craft: crafting.craft },
    missions: { list: missions.list, active: missions.active },
    documents: { list: documents.list, get: documents.get },
    locations: { list: locations.list },
    get playTime() { return playTime; },
  };
  // Test/debug access (not part of the contract).
  Object.defineProperty(gameplay, '_debug', { enumerable: false, value: { interaction, pickups, worldObjects, documents, locations, checkpoints, crafting, missions, tweens, flags: () => worldObjects.flags } });
  return gameplay;
}
