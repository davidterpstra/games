// THE GREENLANDS nature module: terrain, water, vegetation, rocks, colliders and resource spots.
// See docs/ARCHITECTURE.md ("World API") for the returned shape.
import * as THREE from 'three';
import { QUALITY_PRESETS } from '../../core/quality.js';
import { createHeightField } from './heightfield.js';
import { createTerrainTexturesAsync, createFloraAtlas } from './textures.js';
import { createTerrainMesh } from './terrain.js';
import { createWater } from './water.js';
import { createVegetation } from './vegetation.js';
import { createGrass } from './grass.js';
import { generateResources } from './resources.js';
import { wind } from './materials.js';

const tick = () => new Promise((r) => setTimeout(r, 0));

/**
 * Builds the whole natural world and adds it to `scene`.
 * @param {{ scene: THREE.Scene, renderer: THREE.WebGLRenderer, quality: 'low'|'medium'|'high', onProgress?: (p:number, label:string)=>void }} o
 */
export async function createNature({ scene, renderer, quality = 'high', onProgress = () => {} }) {
  const preset = QUALITY_PRESETS[quality] || QUALITY_PRESETS.high;
  const aniso = Math.min(preset.maxAnisotropy || 8, renderer.capabilities.getMaxAnisotropy());
  const prog = (a, b) => (p, label) => onProgress(a + (b - a) * p, label);

  onProgress(0.01, 'Terrein vormen…'); await tick();
  const hf = createHeightField(preset.terrainSegments);
  await hf.fill((p) => onProgress(0.01 + p * 0.14, 'Terrein vormen…'));

  onProgress(0.16, 'Texturen schilderen…'); await tick();
  const textures = await createTerrainTexturesAsync(aniso, quality === 'low' ? 256 : 512);
  await tick();
  const atlas = createFloraAtlas(aniso);
  await tick();

  const terrain = await createTerrainMesh({ hf, textures, quality, onProgress: (p) => onProgress(0.2 + p * 0.15, 'Grond beschilderen…') });
  scene.add(terrain.group);

  onProgress(0.36, 'Water laten stromen…'); await tick();
  const water = createWater({ hf, scene, renderer, quality });

  const veg = await createVegetation({
    scene, hf, atlas, rockTexture: textures.rock, quality, water,
    onProgress: (p, label) => onProgress(0.4 + p * 0.5, label),
  });

  onProgress(0.92, 'Gras laten groeien…'); await tick();
  const grass = createGrass({ scene, hf, maps: terrain.maps, quality });

  onProgress(0.96, 'Grondstoffen verspreiden…'); await tick();
  const resourceSpots = generateResources(hf, veg);
  onProgress(1, 'Natuur klaar');

  const nature = {
    terrain: {
      getHeightAt: hf.getHeightAt,
      getNormalAt: (x, z) => hf.getNormalAt(x, z),
      getSurfaceAt: hf.getSurfaceAt,
      getWaterSurfaceAt: hf.getWaterSurfaceAt,
      material: terrain.material,
    },
    colliders: veg.colliders,
    resourceSpots,
    update(dt, elapsed, camPos) {
      wind.uTime.value = elapsed;
      water.update(dt, elapsed, camPos);
      veg.update(camPos, dt);
      grass.update(camPos);
    },
    setQuality(name) {
      veg.setQuality(name);
      grass.setQuality(name);
    },
    /** Debug / test helpers (not part of the contract). */
    _debug: { hf, veg, grass, water, terrain },
  };
  return nature;
}
