// THE GREENLANDS nature module: terrain, water, vegetation, rocks, colliders and resource spots.
import * as THREE from 'three';
import { QUALITY_PRESETS } from '../../core/quality.js';
import { createHeightField } from './heightfield.js';
import { createTerrainTextures } from './textures.js';
import { createTerrainMesh } from './terrain.js';
import { createWater } from './water.js';

const tick = () => new Promise((r) => setTimeout(r, 0));

export async function createNature({ scene, renderer, quality = 'high', onProgress = () => {} }) {
  const preset = QUALITY_PRESETS[quality] || QUALITY_PRESETS.high;
  const aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  onProgress(0.02, 'Terrein vormen…'); await tick();
  const hf = createHeightField(preset.terrainSegments);
  await hf.fill((p) => onProgress(0.02 + p * 0.2, 'Terrein vormen…'));
  onProgress(0.22, 'Texturen schilderen…'); await tick();
  const textures = createTerrainTextures(aniso, quality === 'low' ? 256 : 512);
  await tick();
  const terrain = await createTerrainMesh({ hf, textures, quality, onProgress: (p) => onProgress(0.25 + p * 0.15, 'Grond beschilderen…') });
  scene.add(terrain.group);
  const water = createWater({ hf, scene, renderer, quality });
  onProgress(1, 'Klaar');
  return {
    terrain: {
      getHeightAt: hf.getHeightAt, getNormalAt: hf.getNormalAt, getSurfaceAt: hf.getSurfaceAt,
      getWaterSurfaceAt: hf.getWaterSurfaceAt, material: terrain.material,
    },
    colliders: [], resourceSpots: [], update(dt, t, cam) { water.update(dt, t, cam); }, setQuality() {},
  };
}
