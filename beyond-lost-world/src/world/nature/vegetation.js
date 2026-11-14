// Vegetation + rocks: builds the models, scatters them deterministically, registers instanced
// groups (chunked, LOD'd) and returns colliders and the data needed for resource spots.
import * as THREE from 'three';
import { QUALITY_PRESETS } from '../../core/quality.js';
import { InstanceSystem, ITEM, setItem } from './instancing.js';
import { createFloraMaterial, createRockMaterial } from './materials.js';
import { buildSpruce, buildOak, buildOakFar, buildBirch, buildBirchFar, buildBush, buildFern, buildFlowers, buildTallGrass, buildMushrooms, buildStump, buildLog } from './flora.js';
import { buildRock, buildPebble, buildPoolRim } from './rocks.js';
import { createPlantCells } from './plantcells.js';
import { addShadowUpdater } from '../../perf/shadowHook.js';
import { generateTrees, ensureTrees, generatePlants, generateRocks } from './scatter.js';

const tick = () => new Promise((r) => setTimeout(r, 0));
const LOD_SCALE = { low: 0.62, medium: 0.82, high: 1.0 };

function itemsFrom(list, fn) {
  const arr = new Float32Array(Math.max(list.length, 1) * ITEM);
  list.forEach((o, i) => { const v = fn(o); setItem(arr, i, o.x, o.y, o.z, o.rot, v.sx, v.sy, v.sz, o.color[0], o.color[1], o.color[2], o.rank ?? 0, o.variant | 0); });
  return { items: arr, count: list.length };
}

/**
 * @returns {Promise<{ update(cam, dt), setQuality(name), colliders, trees, boulders, cliffs, plants, stats }>}
 */
export async function createVegetation({ scene, hf, atlas, rockTexture, quality, water, onProgress = () => {} }) {
  const sys = new InstanceSystem(scene);
  addShadowUpdater((shadowCam, cam) => sys.updateShadow(shadowCam, cam));
  const flora = createFloraMaterial(atlas.texture);
  const rockMat = createRockMaterial(rockTexture);
  const mean = atlas.mean;
  const lowQ = quality === 'low';

  onProgress(0.0, 'Bomen modelleren…'); await tick();
  const spruce = { lod0: [buildSpruce(101, 0, mean), buildSpruce(102, 0, mean)], lod1: buildSpruce(101, 1, mean), lod2: buildSpruce(101, 2, mean) };
  await tick();
  const oak = { lod0: [buildOak(201, 0, mean), buildOak(202, 0, mean)], lod1: buildOak(201, 1, mean), lod2: buildOakFar(201, mean) };
  await tick();
  const birch = { lod0: [buildBirch(301, 0, mean), buildBirch(302, 0, mean)], lod1: buildBirch(301, 1, mean), lod2: buildBirchFar(301, mean) };

  onProgress(0.25, 'Bos planten…'); await tick();
  const trees = generateTrees(hf);
  // the first missions need pines and wood around the station
  ensureTrees(hf, trees, 20, 200, 60, 0, 8);
  ensureTrees(hf, trees, 20, 200, 60, 1, 4);
  await tick();
  onProgress(0.45, 'Planten en bloemen strooien…');
  const plants = generatePlants(hf, trees);
  await tick();
  onProgress(0.6, 'Rotsen verplaatsen…');
  const rocks = generateRocks(hf, water);
  await tick();

  // ---- tree groups --------------------------------------------------------------------------------
  const D = [55, 155, 1000];
  for (const [kind, name, def] of [[0, 'spruce', spruce], [1, 'oak', oak], [2, 'birch', birch]]) {
    const list = trees.filter((t) => t.kind === kind);
    const { items, count } = itemsFrom(list, (t) => ({ sx: t.scale, sy: t.scale, sz: t.scale }));
    sys.addGroup({ name, material: flora, lod0: def.lod0, lod1: def.lod1, lod2: def.lod2, dist: D, cast: [true, true, false], thin: true, items, count });
  }

  // ---- small plants (baked into static cells) ---------------------------------------------------------
  const plantCells = createPlantCells(scene, flora, [
    { geo: buildBush(401), list: plants.bushes.filter((p) => p.variant === 0) },
    { geo: buildBush(402), list: plants.bushes.filter((p) => p.variant === 1) },
    { geo: buildFern(411), list: plants.ferns },
    { geo: buildFlowers(421), list: plants.flowers },
    { geo: buildTallGrass(431), list: plants.tall },
    { geo: buildMushrooms(441), list: plants.mushrooms },
    { geo: buildStump(451), list: plants.stumps.filter((p) => p.variant === 0) },
    { geo: buildStump(452), list: plants.stumps.filter((p) => p.variant === 1) },
    { geo: buildLog(461, 3.2, 0.26), list: plants.logs.filter((p) => p.variant === 0) },
    { geo: buildLog(462, 4.8, 0.34), list: plants.logs.filter((p) => p.variant === 1) },
  ]);
  await tick();

  // ---- rocks ----------------------------------------------------------------------------------------
  onProgress(0.75, 'Rotsen plaatsen…');
  const det = lowQ ? 2 : 3;
  const boulderGeos = [buildRock(501, { detail: det })];
  const mkRock = (name, geos, list, dmax, cast, thin) => {
    const { items, count } = itemsFrom(list, (b) => ({ sx: b.sx, sy: b.sy, sz: b.sz }));
    if (count) sys.addGroup({ name, material: rockMat, lod0: geos, dist: [dmax, dmax, dmax], cast: [cast, false, false], thin, items, count });
  };
  for (const b of rocks.boulders) b.variant = 0;
  mkRock('boulder', boulderGeos, rocks.boulders, 240, true, false);
  mkRock('cliffrock', [buildRock(511, { detail: det, angular: true, tall: 0.9, moss: 0.4 })], rocks.cliffs, 360, true, false);
  mkRock('pebble', [buildPebble(521)], rocks.pebbles, 60, false, false);

  // stone lip around the pool
  const rim = buildPoolRim(water.poolCenter, water.poolOutline, hf.getHeightAt, 16.2, water.riverExit);
  const rimMat = createRockMaterial(rockTexture); rimMat.side = THREE.DoubleSide;
  const rimMesh = new THREE.Mesh(rim.geometry, rimMat);
  rimMesh.castShadow = true; rimMesh.receiveShadow = true; rimMesh.name = 'pool-rim';
  scene.add(rimMesh);

  // ---- colliders ----------------------------------------------------------------------------------------
  const colliders = [];
  for (const p of rim.posts) colliders.push({ type: 'circle', x: p.x, z: p.z, r: 1.0, yMin: 13, yMax: 17.6, enabled: true, surface: 'stone' });
  const treeColliders = [];
  for (const t of trees) {
    const c = { type: 'circle', x: t.x, z: t.z, r: t.rc, yMin: t.y - 1, yMax: t.y + 40, enabled: true, surface: 'wood' };
    colliders.push(c); treeColliders.push({ c, rank: t.rank });
  }
  for (const b of [...rocks.boulders, ...rocks.cliffs]) {
    colliders.push({ type: 'circle', x: b.x, z: b.z, r: b.rc, yMin: b.y - 1, yMax: b.y + b.top + b.sy * 0.2, enabled: true, surface: 'stone' });
  }
  for (const s of plants.stumps) colliders.push({ type: 'circle', x: s.x, z: s.z, r: 0.4 * s.scale, yMin: s.y - 1, yMax: s.y + 0.7 * s.scale, enabled: true, surface: 'wood' });
  const logColliders = [];
  for (const l of plants.logs) {
    const c = { type: 'box', x: l.x, z: l.z, hx: l.len * 0.5 * l.scale, hz: l.rad * l.scale, rot: l.rot, yMin: l.y - 0.5, yMax: l.y + l.rad * 1.9 * l.scale, enabled: true, surface: 'wood' };
    colliders.push(c); logColliders.push({ c, rank: l.rank });
  }

  // ---- runtime state ----------------------------------------------------------------------------------------
  let q = QUALITY_PRESETS[quality] || QUALITY_PRESETS.high;
  let params = { density: q.vegetationDensity, lodScale: LOD_SCALE[quality] ?? 1, viewDistance: q.viewDistance, plantDistance: q.plantDistance ?? 105 * (LOD_SCALE[quality] ?? 1) };
  let dirty = true, timer = 0;
  const last = new THREE.Vector3(1e9, 0, 1e9);
  function applyColliders() {
    for (const t of treeColliders) t.c.enabled = t.rank <= params.density;
    for (const l of logColliders) l.c.enabled = l.rank <= params.density;
  }
  applyColliders();

  return {
    colliders, trees, boulders: rocks.boulders, cliffs: rocks.cliffs, pebbles: rocks.pebbles, plants, system: sys,
    get stats() { return sys.stats; },
    setQuality(name) {
      q = QUALITY_PRESETS[name] || QUALITY_PRESETS.high;
      params = { density: q.vegetationDensity, lodScale: LOD_SCALE[name] ?? 1, viewDistance: q.viewDistance, plantDistance: q.plantDistance ?? 105 * (LOD_SCALE[name] ?? 1) };
      applyColliders(); dirty = true; timer = 1;
    },
    update(cam, dt) {
      timer += dt;
      if (dirty || (timer > 0.25 && Math.hypot(cam.x - last.x, cam.z - last.z) > 2.5)) {
        timer = 0; dirty = false; last.copy(cam);
        sys.update(cam, params);
      }
      plantCells.update(cam, params.density, params.plantDistance);
    },
  };
}
