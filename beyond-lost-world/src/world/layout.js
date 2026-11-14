// THE GREENLANDS – shared world layout.
// Single source of truth for where everything is. Read by terrain/nature (to shape the land,
// carve the river, keep vegetation off paths and buildings) and by structures (to place buildings).
// Coordinates: metres, Y up, north = -Z, east = +X. Terrain spans -WORLD_HALF..WORLD_HALF.
// Do not change these numbers without updating docs/ARCHITECTURE.md.

export const WORLD_SIZE = 640;
export const WORLD_HALF = WORLD_SIZE / 2;

/** The player cannot leave this square (mountains rise beyond it). */
export const PLAY_BOUNDS = Object.freeze({ minX: -268, maxX: 268, minZ: -268, maxZ: 268 });

/** Global sea/lake level reference. */
export const LAKE = Object.freeze({ id: 'lake', x: 150, z: 150, radius: 48, waterY: 4.0, bottomY: -1.5 });

/**
 * Flattened building pads. The terrain heightfield is exactly `y` inside the pad and blends
 * smoothly back to the natural terrain over `blend` metres outside it.
 * shape 'rect': centre x,z, half extents hx,hz, rotation rot (radians, same sense as Object3D.rotation.y)
 * shape 'circle': centre x,z, radius r
 * Interiors (bunker, cave) are built ON these pads; hills/rock over them are separate meshes, never terrain.
 */
export const PADS = Object.freeze([
  { id: 'station', shape: 'rect', x: 20, z: 200, hx: 26, hz: 20, rot: 0, y: 14, blend: 28 },
  { id: 'village', shape: 'circle', x: 165, z: -10, r: 58, y: 9, blend: 36 },
  { id: 'temple', shape: 'rect', x: 0, z: -188, hx: 34, hz: 40, rot: 0, y: 24, blend: 34 },
  { id: 'bunker', shape: 'rect', x: -185, z: 55, hx: 18, hz: 26, rot: 0, y: 12, blend: 22 },
  { id: 'waterfall_pool', shape: 'circle', x: -140, z: -150, r: 18, y: 15, blend: 14 },
  { id: 'cave_tunnel', shape: 'rect', x: -112, z: -176, hx: 5, hz: 18, rot: -0.45, y: 16, blend: 6 },
  { id: 'cave_chamber', shape: 'circle', x: -103, z: -199, r: 13, y: 16, blend: 6 },
  { id: 'crossroads', shape: 'circle', x: 0, z: 60, r: 9, y: 11, blend: 18 },
]);

/** Waterfall: water drops from `top` over a cliff into the pool. Cave entrance is just east of the pool. */
export const WATERFALL = Object.freeze({
  top: { x: -150, z: -176, y: 42 },
  pool: { x: -140, z: -150, r: 14, waterY: 16.2 },
  caveEntrance: { x: -118, z: -160, facing: 2.7 }, // facing = rotation.y of the cave mouth (looks roughly south-east)
});

/**
 * River from the waterfall pool down to the lake. Water surface height is linearly interpolated
 * along the polyline between `waterY` values. Width in metres.
 */
export const RIVER = Object.freeze({
  width: 9,
  points: [
    { x: -132, z: -140, waterY: 16.2 },
    { x: -104, z: -112, waterY: 14.5 },
    { x: -76, z: -72, waterY: 12.4 },
    { x: -40, z: -40, waterY: 10.6 },
    { x: 0, z: -6, waterY: 9.0 },
    { x: 40, z: 30, waterY: 7.4 },
    { x: 80, z: 70, waterY: 5.8 },
    { x: 116, z: 116, waterY: 4.0 },
  ],
});

/** Dirt paths (polylines). Terrain paints them as dirt; vegetation stays off them. */
export const PATHS = Object.freeze([
  { id: 'station_road', width: 4, points: [{ x: 20, z: 178 }, { x: 16, z: 150 }, { x: 6, z: 110 }, { x: 0, z: 60 }] },
  { id: 'village_road', width: 4, points: [{ x: 0, z: 60 }, { x: 40, z: 40 }, { x: 90, z: 20 }, { x: 130, z: 2 }, { x: 165, z: -10 }] },
  { id: 'temple_road', width: 3.5, points: [{ x: 0, z: 60 }, { x: -10, z: 10 }, { x: -5, z: -60 }, { x: 0, z: -120 }, { x: 0, z: -146 }] },
  { id: 'bunker_road', width: 3.5, points: [{ x: 0, z: 60 }, { x: -50, z: 70 }, { x: -110, z: 64 }, { x: -164, z: 55 }] },
  { id: 'waterfall_trail', width: 2.5, points: [{ x: -5, z: -60 }, { x: -50, z: -88 }, { x: -92, z: -122 }, { x: -124, z: -140 }] },
]);

/** Discoverable locations (gameplay fires 'location:discovered' when the player first comes within radius). */
export const LOCATIONS = Object.freeze([
  { id: 'station', name: 'Onderzoeksstation Kestrel', x: 20, z: 200, radius: 30 },
  { id: 'forest', name: 'Het Fluisterwoud', x: 10, z: 120, radius: 40 },
  { id: 'crossroads', name: 'De Oude Kruising', x: 0, z: 60, radius: 14 },
  { id: 'village', name: 'Verlaten dorp Valdris', x: 165, z: -10, radius: 55 },
  { id: 'lake', name: 'Het Spiegelmeer', x: 150, z: 150, radius: 60 },
  { id: 'waterfall', name: 'De Zilveren Waterval', x: -140, z: -150, radius: 30 },
  { id: 'cave', name: 'De Kristalgrot', x: -103, z: -199, radius: 16 },
  { id: 'temple', name: 'De Zonnetempel', x: 0, z: -188, radius: 42 },
  { id: 'bunker', name: 'Bunker K-7', x: -185, z: 55, radius: 32 },
]);

/** Future regions (not playable yet; shown as locked on the map). */
export const REGIONS = Object.freeze([
  { id: 'greenlands', name: 'The Greenlands', unlocked: true },
  { id: 'wastelands', name: 'The Wastelands', unlocked: false },
  { id: 'frozen_peaks', name: 'The Frozen Peaks', unlocked: false },
]);

/** Camera used behind the main menu. */
export const MENU_CAMERA = Object.freeze({ position: { x: 46, y: 36, z: 252 }, target: { x: 0, y: 18, z: 110 } });

// ---------------------------------------------------------------------------------------------
// Helpers shared by terrain, nature and structures.

/** Distance from point (px,pz) to segment (ax,az)-(bx,bz); also returns t along the segment. */
export function distToSegment(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az;
  const len2 = dx * dx + dz * dz || 1e-9;
  let t = ((px - ax) * dx + (pz - az) * dz) / len2;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + dx * t, cz = az + dz * t;
  return { dist: Math.hypot(px - cx, pz - cz), t, x: cx, z: cz };
}

/** Closest point on a polyline. Returns { dist, index (segment), t, x, z }. */
export function distToPolyline(px, pz, points) {
  let best = { dist: Infinity, index: 0, t: 0, x: 0, z: 0 };
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i], b = points[i + 1];
    const r = distToSegment(px, pz, a.x, a.z, b.x, b.z);
    if (r.dist < best.dist) best = { ...r, index: i };
  }
  return best;
}

/** Distance (m) to the nearest path centre line, plus the path's width. */
export function nearestPath(px, pz) {
  let best = { dist: Infinity, path: null };
  for (const path of PATHS) {
    const r = distToPolyline(px, pz, path.points);
    if (r.dist < best.dist) best = { dist: r.dist, path };
  }
  return best;
}

/** Signed distance to a pad's flat area (negative = inside). */
export function padDistance(pad, px, pz) {
  if (pad.shape === 'circle') return Math.hypot(px - pad.x, pz - pad.z) - pad.r;
  const c = Math.cos(pad.rot), s = Math.sin(pad.rot);
  const dx = px - pad.x, dz = pz - pad.z;
  // inverse rotate into pad space (Object3D.rotation.y convention: x' = x cos + z sin)
  const lx = dx * c - dz * s;
  const lz = dx * s + dz * c;
  const qx = Math.abs(lx) - pad.hx, qz = Math.abs(lz) - pad.hz;
  const outside = Math.hypot(Math.max(qx, 0), Math.max(qz, 0));
  return outside + Math.min(Math.max(qx, qz), 0);
}

/** Pad lookup by id. */
export function getPad(id) { return PADS.find((p) => p.id === id); }

/** Water surface height of the river at the closest polyline point, and the distance to its centre. */
export function riverInfo(px, pz) {
  const r = distToPolyline(px, pz, RIVER.points);
  const a = RIVER.points[r.index], b = RIVER.points[r.index + 1];
  return { dist: r.dist, waterY: a.waterY + (b.waterY - a.waterY) * r.t, x: r.x, z: r.z, dirX: b.x - a.x, dirZ: b.z - a.z };
}

/** Points where paths cross the river (bridges go here). Each: { pathId, x, z, angle } angle = path direction (rad, atan2(dx,dz)). */
export function findPathRiverCrossings() {
  const out = [];
  const R = RIVER.points;
  for (const path of PATHS) {
    const P = path.points;
    for (let i = 0; i < P.length - 1; i++) {
      for (let j = 0; j < R.length - 1; j++) {
        const hit = segmentIntersection(P[i], P[i + 1], R[j], R[j + 1]);
        if (hit) out.push({ pathId: path.id, x: hit.x, z: hit.z, angle: Math.atan2(P[i + 1].x - P[i].x, P[i + 1].z - P[i].z), waterY: R[j].waterY + (R[j + 1].waterY - R[j].waterY) * hit.u });
      }
    }
  }
  return out;
}

function segmentIntersection(a, b, c, d) {
  const r = { x: b.x - a.x, z: b.z - a.z }, s = { x: d.x - c.x, z: d.z - c.z };
  const den = r.x * s.z - r.z * s.x;
  if (Math.abs(den) < 1e-9) return null;
  const t = ((c.x - a.x) * s.z - (c.z - a.z) * s.x) / den;
  const u = ((c.x - a.x) * r.z - (c.z - a.z) * r.x) / den;
  if (t < 0 || t > 1 || u < 0 || u > 1) return null;
  return { x: a.x + r.x * t, z: a.z + r.z * t, t, u };
}

/** Deterministic PRNG (mulberry32) so every build of the world is identical (needed for multiplayer later). */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function rand() {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const WORLD_SEED = 1337;
