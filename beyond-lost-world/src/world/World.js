// Composes the world from the nature module (terrain, water, vegetation) and the structures
// module (buildings, interiors, interactive props). See docs/ARCHITECTURE.md → World API.
import { createNature } from './nature/index.js';
import { createStructures } from './structures/index.js';
import { LOCATIONS, PLAY_BOUNDS } from './layout.js';
import { wind as natureWind } from './nature/materials.js';

export async function createWorld({ scene, renderer, quality, onProgress = () => {} }) {
  const nature = await createNature({
    scene, renderer, quality,
    onProgress: (p, label) => onProgress(p * 0.6, label),
  });
  const terrain = nature.terrain;

  const structures = await createStructures({
    scene, renderer, quality, terrain,
    onProgress: (p, label) => onProgress(0.6 + p * 0.4, label),
  });

  const colliders = [...nature.colliders, ...structures.colliders];
  const colliderById = new Map();
  for (const c of colliders) {
    if (c.enabled === undefined) c.enabled = true;
    if (c.id) colliderById.set(c.id, c);
  }

  const locations = LOCATIONS.map((l) => ({ ...l, y: terrain.getHeightAt(l.x, l.z) }));

  const world = {
    getHeightAt: (x, z) => terrain.getHeightAt(x, z),
    getNormalAt: (x, z) => terrain.getNormalAt(x, z),
    getSurfaceAt: (x, z) => terrain.getSurfaceAt(x, z),
    getWaterSurfaceAt: (x, z) => terrain.getWaterSurfaceAt(x, z),
    colliders,
    setColliderEnabled(id, enabled) {
      const c = colliderById.get(id);
      if (!c) { console.warn(`[world] unknown collider "${id}"`); return; }
      c.enabled = !!enabled;
    },
    anchors: structures.anchors,
    resourceSpots: [...nature.resourceSpots, ...(structures.resourceSpots || [])],
    interiorZones: structures.interiorZones,
    locations,
    bounds: PLAY_BOUNDS,
    terrainMaterial: terrain.material,
    setPowered: (group, on) => structures.setPowered(group, on),
    /** Wind strength multiplier for foliage and grass sway (driven by the weather). */
    setWind(strength) { natureWind.uWind.value = strength; },
    setQuality(name) {
      nature.setQuality(name);
      structures.setQuality?.(name);
    },
    update(dt, elapsed, camPos) {
      nature.update(dt, elapsed, camPos);
      structures.update(dt, elapsed, camPos);
    },
    /** Returns the interior zone containing p (Vector3), or null. */
    interiorAt(p) {
      for (const z of structures.interiorZones) {
        if (p.y < z.yMin || p.y > z.yMax) continue;
        const c = Math.cos(z.rot), s = Math.sin(z.rot);
        const dx = p.x - z.x, dz = p.z - z.z;
        const lx = dx * c - dz * s, lz = dx * s + dz * c;
        if (Math.abs(lx) <= z.hx && Math.abs(lz) <= z.hz) return z;
      }
      return null;
    },
  };

  const missing = ['player.start'].filter((id) => !world.anchors.has(id));
  if (missing.length) throw new Error(`World is missing required anchors: ${missing.join(', ')}`);
  return world;
}
