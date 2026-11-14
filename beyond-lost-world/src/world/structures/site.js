// Shared registry handed to every site builder: colliders, anchors, zones, resource spots, animation hooks.
import * as THREE from 'three';
import { Builder } from './core.js';
import { mulberry32, WORLD_SEED } from '../layout.js';

/**
 * @param {object} lib material library
 * @param {object} terrain terrain API
 * @param {THREE.Group} root group receiving all site meshes
 */
export function createSite(lib, terrain, root) {
  const S = {
    lib, M: lib.M, terrain, root,
    colliders: [], zones: [], anchors: new Map(), resources: [], anim: [], powered: { bunker: [] }, clutter: [],
    rand: (seed) => mulberry32(WORLD_SEED * 7 + seed),
    /** New merged-geometry builder (colliders go straight into the world list). */
    builder(name, seed) { return new Builder(name, lib, { colliders: S.colliders, rand: S.rand(seed) }); },
    /** Builds a builder into the root group and tracks clutter meshes for setQuality. */
    commit(b) {
      const g = b.build();
      g.traverse((m) => { if (m.isMesh && m.userData.clutter) S.clutter.push(m); });
      root.add(g);
      return g;
    },
    anchor(id, pos, rotationY = 0, object) {
      const p = pos.isVector3 ? pos.clone() : new THREE.Vector3(pos[0], pos[1], pos[2]);
      const a = { id, position: p, rotationY };
      if (object) a.object = object;
      S.anchors.set(id, a);
      return a;
    },
    zone(id, x, z, hx, hz, rot, yMin, yMax, darkness) { const zn = { id, x, z, hx, hz, rot, yMin, yMax, darkness }; S.zones.push(zn); return zn; },
    resource(id, type, pos) { S.resources.push({ id, type, position: new THREE.Vector3(pos[0], pos[1], pos[2]) }); },
    /** Registers a box collider in world space. */
    box(x, z, hx, hz, rot, yMin, yMax, extra = {}) { const c = { type: 'box', x, z, hx, hz, rot, yMin, yMax, enabled: true, ...extra }; S.colliders.push(c); return c; },
    circle(x, z, r, yMin, yMax, extra = {}) { const c = { type: 'circle', x, z, r, yMin, yMax, enabled: true, ...extra }; S.colliders.push(c); return c; },
  };
  return S;
}
